import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { object } from "../../../../runtime/contract.ts"
import type { Actor } from "../../../../runtime/contract.ts"
import { createSfSourcePersistence, sfScopedSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority, sfHumanActions } from "../../../../product/integration/human-authority.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfImportHost } from "../../../../product/imports/host.ts"
import type { ImportTarget } from "../../../../product/imports/staged-files.ts"
import { verifyDashboardImportTarget } from "../../../../product/imports/source-fences.ts"

test("human JSON restore keeps private state and returns the same receipt after source replacement", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-backup-e2e-"))
  const driver = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const identity = createOperatorIdentity({ origin: "http://localhost:4110", mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  try {
    await store.initializeSources("dashboard")
    await store.initializeSources("planner")
    await store.initializeSources("procurement")
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.risks = [{ id: "r1", name: "Before" }]; snapshot.data.roleMap = []; snapshot.data.budgetLineIds = { protected: "current" }; return { commit: true, value: undefined } })
    const code = await identity.enroll()
    const session = await identity.handle(new Request(`http://localhost:4110/sucafina/auth/local?code=${code}`))
    const cookie = session!.headers.get("set-cookie")!.split(";")[0]!
    const request = new Request("http://localhost:4110/sucafina/dashboard", { method: "POST", headers: { cookie, origin: "http://localhost:4110" } })
    const principal = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: await identity.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }) }))
    if (!principal) throw new Error("missing operator")
    const access = { installationId: operator.installationId, projectId: "project", principalRef: principal.id, policyVersion: "policy", accessRevision: "access" }
    const ui = createSfUiAuthority({ privateCommands: sfHumanActions.map((action) => `sf-human:${action}`), authorize: async () => access, createId: randomUUID, now: () => Date.parse(at), commandIdentity: async (_, operation) => operation })
    const human = createSfHumanAuthority({ origin: "http://localhost:4110", ui })
    const host = { persistence: store, authenticate: identity.authenticate, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context) }
    const actorFor = async (snapshot: Parameters<typeof roleMap>[0]) => {
      const current = await identity.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!current) return undefined
      const entry = object(object(snapshot.data.access)[current.id])
      const roles = current.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
      return { id: current.id, roles, canWrite: current.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(entry.assigned) ? entry.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(entry.domains) ? entry.domains.filter((value): value is string => typeof value === "string") : [] } satisfies Actor
    }
    const observed = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: { actor: await actorFor(snapshot), roles: roleMap(snapshot, "dashboard") } }))
    if (!observed.actor?.canWrite || !observed.actor.roles.includes("admin")) throw new Error("operator must be admin")
    const scope = { principalRef: principal.id, accessRevision: access.accessRevision, policyVersion: access.policyVersion, recordType: "dashboard-dataset", recordId: "all", selector: { kind: "dashboard-dataset-v1", actor: observed.actor, roleMapDigest: digestSfValue(observed.roles), fields: ["data"] } }
    const beforeABA = await store.readScopedSource("dashboard", scope, async () => true)
    if (!beforeABA) throw new Error("dataset source unavailable")
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.risks = [{ id: "r1", name: "Transient" }]; return { commit: true, value: undefined } })
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.risks = [{ id: "r1", name: "Before" }]; return { commit: true, value: undefined } })
    const initial = await store.readScopedSource("dashboard", scope, async () => true)
    if (!initial) throw new Error("dataset source unavailable")
    expect(initial.incarnation).toBe(beforeABA.incarnation)
    expect(initial.version).toBeGreaterThan(beforeABA.version)
    expect(initial.inputDigest).toBe(beforeABA.inputDigest)
    const target = { surface: "dashboard" as const, selectionRef: `sf-dataset:${encodeURIComponent(initial.incarnation)}:${initial.version}`, incarnation: initial.incarnation, version: initial.version, options: { newVersion: false, removeMissing: false, preview: {} } }
    const state = createSfProductState({ persistence: store, createId: randomUUID, authorize: async (received, snapshot) => await identity.authenticate(received, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }) ? { principalRef: principal.id, accessRevision: access.accessRevision, policyVersion: access.policyVersion } : undefined, resolveTarget: async (_, snapshot, __, ref) => ref === target.selectionRef ? sfScopedSourceIdentity(snapshot, scope) : undefined })
    const authorizeTarget = async (_target: ImportTarget, context: TrustedDomainContext, mode?: "receipt") => {
      if (!await host.revalidate(context)) return false
      return store.transaction("dashboard", async (snapshot) => {
        const actor = await actorFor(snapshot)
        if (!actor?.canWrite || !actor.roles.includes("admin")) return { commit: false, value: false }
        return { commit: false, value: mode === "receipt" || sfScopedSourceIdentity(snapshot, scope)?.incarnation === initial.incarnation }
      })
    }
    const resolveTarget = async () => {
      const source = await store.resolveScopedSource("dashboard", initial.incarnation, async () => true)
      if (!source) return { status: "unavailable" as const, reason: "dataset-unavailable" }
      const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", evidenceLevel: "observed", refId: target.selectionRef, installationId: access.installationId, projectId: access.projectId, refDigest: "", target: { surface: "dashboard", recordType: "dashboard-dataset", recordId: "all", incarnation: source.incarnation, version: source.version, fields: ["data"], projectionDigest: source.inputDigest } }
      evidence.refDigest = digestSfEvidenceRef(evidence)
      return { status: "ok" as const, value: { page: "IT Risks", evidence } }
    }
    const imports = createSfImportHost({ host, assets: store, services: { scan: async () => true, signingKey: randomBytes(32) }, state, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeTarget, authorizeAdmission: (payload, context) => human.authorize(context, "imports.admit", payload), preview: { revalidate: host.revalidate }, apply: { revalidate: host.revalidate, confirm: (manifest, context) => human.authorize(context, "imports.apply", { manifestId: manifest.id, version: manifest.version }) }, planner: { resolveTarget: async () => ({ status: "unavailable", reason: "not-used" }), verifyTarget: () => false }, dashboard: { resolveTarget, verifyScope: verifyDashboardImportTarget } })
    const bytes = new TextEncoder().encode(JSON.stringify({ risks: [{ id: "r1", name: "After" }], roleMap: [{ protected: "forged" }], budgetLineIds: { protected: "forged" } }))
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const admission = await human.admit(request, "imports.admit", { target, format: "json", digest })
    if (admission.status !== "ok") throw new Error(admission.reason)
    const file = await imports.admit({ target, format: "json", bytes }, admission.value)
    human.finish(admission.value)
    expect(file.status).toBe("ok")
    if (file.status !== "ok") return
    const selection = { admittedFileRef: file.value.ref, format: "json", options: {} }
    const previewGrant = await ui.admit(request, "sf_import_preview", digestSfValue(selection))
    if (previewGrant.status !== "ok" || !await ui.validate(previewGrant.value, "sf_import_preview", digestSfValue(selection))) throw new Error("preview grant")
    const preview = await imports.preview(selection, previewGrant.value)
    ui.finish(previewGrant.value)
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    const applyInput = { manifestId: preview.value.id, version: preview.value.version }
    const apply = async () => { const grant = await human.admit(request, "imports.apply", applyInput); if (grant.status !== "ok") throw new Error(grant.reason); const result = await imports.apply(applyInput, grant.value); human.finish(grant.value); return result }
    const first = await apply()
    expect(first.status).toBe("ok")
    const after = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(after.data.risks).toEqual([{ id: "r1", name: "After" }])
    expect(after.data.roleMap).toEqual([])
    expect(after.data.budgetLineIds).toEqual({ protected: "current" })
    expect(after.data.__sfProductV1).toBeDefined()
    expect(await apply()).toEqual(first)
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(after.audit.length)
  } finally { await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
