import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfPlannerSourceHost } from "../../../product/integration/planner-sources.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createPlannerSourceIssuer } from "../../../product/planner/source-issuer.ts"
import { createPlannerVersionsHost } from "../../../product/planner/versions-host.ts"

export const plannerPeriod = { start: "2027-01-01", end: "2027-12-31" }
export const plannerAt = "2026-11-13T00:00:00Z"

export function plannerSnapshot(): Snapshot {
  return { data: {
    roleMap: ["admin", "finance", "hr", "viewer"].map((role) => ({ surface: "planner", role, entra: `${role}-group`, version: 1, by: "admin" })),
    versions: [72000, 84000, 78000].map((license, index) => ({ id: `v${index}`, name: `Plan ${index}`, year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000], a: [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null], f: [null, null, null, null, null, null, null, null, null, 38000, 40000 + license, 40000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
    officials: { "2027": "v0" }, entities: [], allocations: [], roster: [],
  }, versions: {}, sequences: {}, audit: [], notices: [] }
}

/** Actual storage, private authority registries, scoped sources and Planner domain. Identities are deterministic test admissions, not a resident-runtime witness. */
export async function plannerFixture(initial = plannerSnapshot()) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-ports-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  await store.transaction("planner", async (snapshot) => { Object.assign(snapshot, structuredClone(initial)); return { commit: true, value: undefined } })
  const access = { allowed: true, revision: "1", now: Date.parse(plannerAt), generation: 1 }
  const identity = (request: Request) => {
    const principalRef = request.headers.get("authorization")
    return access.allowed && principalRef && ["admin", "finance", "hr", "viewer"].includes(principalRef) ? { installationId: "i", projectId: "p", principalRef, policyVersion: "1", accessRevision: access.revision } : undefined
  }
  const ui = createSfUiAuthority({ authorize: async (request) => identity(request), commandIdentity: async (_request, operation, digest) => `${operation}:${digest}`, createId: randomUUID, now: () => access.now, privateCommands: ["sf-human:planner.read", "sf-human:planner.preview", "sf-human:planner.apply"] })
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => {
      const current = identity(admission.request)
      return current ? { ...current, hostId: "h", locationId: "l", providerGeneration: access.generation, expiresAt: new Date(Date.now() + 60_000).toISOString() } : undefined
    },
    revalidateAdmission: async (admission, binding) => {
      const current = identity(admission.request)
      return !!current && current.principalRef === binding.principalRef && current.accessRevision === binding.accessRevision && access.generation === binding.providerGeneration
    },
  })
  const authority = createSfDomainAuthority({ native: registry, ui })
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => plannerAt) })
  await persistence.initializeSources("planner")
  const host: DomainPortHost = {
    persistence,
    authenticate: async (request, context) => {
      const current = identity(request)
      return current ? resolve(current.principalRef, [...context!.roleMap], (group) => group === `${current.principalRef}-group`) : null
    },
    environment: async () => ({ at: plannerAt, id: randomUUID, directory: [] }),
    requestFor: authority.requestFor,
    revalidate: authority.revalidateDomainContext,
  }
  const sources = createSfPlannerSourceHost({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "cost-coverage-not-published" }) })
  const issueSource = createPlannerSourceIssuer({ host, scopedSources: persistence, sources })
  const planner = createPlannerPort({ host, sources })
  const versions = createPlannerVersionsHost({ host, humanAuthorize: async (context, action, payload) => context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && await ui.revalidate(context) })
  const admit = async (operation: string, payload: unknown, principal = "finance", consume = false, signal?: AbortSignal) => {
    const digest = digestSfValue(payload)
    const admitted = await ui.admit(new Request("https://example.test/planner", { method: "POST", headers: { authorization: principal }, signal }), operation, digest)
    if (admitted.status !== "ok" || (consume && !await ui.validate(admitted.value, operation, digest))) throw new Error("UI fixture admission failed")
    return admitted.value
  }
  const readSnapshot = () => persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  return { directory, store, access, ui, registry, authority, persistence, host, sources, issueSource, planner, versions, admit, readSnapshot, close: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
