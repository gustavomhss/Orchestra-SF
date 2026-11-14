import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createPlannerConfirmationObserver } from "../../../product/planner/confirmation.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createCollaborationConfirmationSource } from "../../../product/collaboration/confirmation-source.ts"
import { createConfirmationObservationReceipts } from "../../../product/collaboration/confirmation-observations.ts"
import { createConfirmationPort } from "../../../product/collaboration/confirmation.ts"

export const routinePlannerPeriod = { start: "2027-01-01", end: "2027-12-31" }
export const routineJanuary = { start: "2027-01-01", end: "2027-01-31" }

/** Actual SQLite, scoped sources, UI/human authority and domain producers; no native Session claim. */
export async function createRoutinePlannerFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-routine-planner-"))
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const origin = "https://example.test"
  const access = { allowed: true }
  await store.transaction("planner", async (snapshot) => {
    snapshot.data = {
      roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }],
      versions: [72000, 84000, 78000].map((license, index) => ({ id: `v${index}`, name: `Plan ${index}`, year: 2027, closed: 9,
        lines: [{ id: "line", name: "Licenses", ownerId: "owner:finance", sec: "opex", el: "licenses", cur: "USD", b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000], a: [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null], f: [null, null, null, null, null, null, null, null, null, 38000, 40000 + license, 40000] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
      })),
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [],
    }
    return { commit: true, value: undefined }
  })
  const identity = (request: Request) => access.allowed && request.headers.get("authorization") === "finance"
    ? { installationId: "i", projectId: "p", principalRef: "finance", accessRevision: "1", policyVersion: "1" } : undefined
  const ui = createSfUiAuthority({ authorize: async (request) => identity(request), commandIdentity: async (request, operation, digest) => `${request.headers.get("intention") ?? "read"}:${operation}:${digest}`, createId: randomUUID, now: () => Date.parse(at), privateCommands: ["sf-human:collaboration.confirmation.confirm", "sf-human:reviews.preserve"] })
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const host: DomainPortHost = {
    persistence,
    authenticate: async (request, options) => identity(request) ? resolve("finance", [...options!.roleMap], (group) => group === "finance-group") : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
  const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, _namespace, target) => target === creationTarget.ref ? { incarnation: creationTarget.incarnation } : undefined, authorize: async (request) => identity(request) })
  const human = createSfHumanAuthority({ origin, ui })
  const collaborationHuman = createCollaborationHumanAuthority({ origin, ui })
  const product = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "cost-coverage-not-published" }) })
  const observer = createPlannerConfirmationObserver({ host, issueSource: product.issueSource, planner: product.planner })
  const confirmationSource = createCollaborationConfirmationSource({ planner: observer })
  const receipts = createConfirmationObservationReceipts({ host, observe: confirmationSource.observe, now: () => Date.parse(at) })
  const confirmations = createConfirmationPort({ state, host, creationTarget, human: collaborationHuman, observe: confirmationSource.observe, fence: confirmationSource.fence, verifyObserved: receipts.verifyObserved, createId: randomUUID, now: () => at })
  const request = (intention = "read") => new Request(`${origin}/routines`, { method: "POST", headers: { origin, authorization: "finance", intention } })
  const admitted = await ui.admit(request(), "sf_work_list", digestSfValue({}))
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_work_list", digestSfValue({}))) throw new Error("fixture admission failed")
  const context = admitted.value
  const source = async (versionId: string) => {
    const result = await product.issueSource(versionId, context)
    if (result.status !== "ok") throw new Error(`planner source unavailable: ${result.reason}`)
    return result.value.evidence
  }
  const confirm = async (scope: ConfirmationScope, key: string) => {
    const prepared = await receipts.prepare(scope, context)
    if (prepared.status !== "ok") throw new Error(`confirmation observation failed: ${prepared.reason}`)
    const before = await state.read(request(), "confirmations", () => null)
    const command = { scope, observedSourceVersion: prepared.value.sourceVersion, expectedScopeFingerprint: prepared.value.scopeFingerprint, expectedStorageVersion: before.status === "ok" ? before.storageVersion : 0, idempotencyKey: key }
    const humanContext = await collaborationHuman.admit(request(key), "collaboration.confirmation.confirm", command)
    if (humanContext.status !== "ok") throw new Error(`confirmation admission failed: ${humanContext.reason}`)
    try {
      const saved = await confirmations.confirm(command, humanContext.value)
      if (saved.status !== "ok") throw new Error(`confirmation failed: ${saved.reason}`)
      return saved.value
    } finally { collaborationHuman.finish(humanContext.value) }
  }
  const editActual = (versionId: string, month: number, value: number) => persistence.transaction("planner", async (snapshot) => {
    const versions = snapshot.data.versions as { id: string; lines: { a: (number | null)[] }[] }[]
    versions.find((version) => version.id === versionId)!.lines[0]!.a[month] = value
    return { commit: true, value: undefined }
  })
  return { store, persistence, host, ui, human, state, creationTarget, product, observer, confirmations, context, at, request, source, confirm, editActual, access,
    dispose: async () => { ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
