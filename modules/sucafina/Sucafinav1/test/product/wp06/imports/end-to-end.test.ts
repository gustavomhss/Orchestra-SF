import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority, sfHumanActions } from "../../../../product/integration/human-authority.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { projectPlannerSource } from "../../../../product/planner/port.ts"
import { createSfImportHost } from "../../../../product/imports/host.ts"

test("human workbook admission, Planner preview, atomic receipt and retry survive SQLite reopen", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-import-e2e-"))
  const key = randomBytes(32)
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const open = async () => {
    const driver = await openLocalStore(directory)
    const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
    await store.initializeSources("dashboard")
    await store.initializeSources("planner")
    const identity = createOperatorIdentity({ origin: "http://localhost:4110", mount: "/sucafina", operator, secrets: driver.secrets, key })
    return { driver, store, identity }
  }
  const app = await open()
  try {
    await app.store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, locked: false, lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []
      return { commit: true, value: undefined }
    })
    const code = await app.identity.enroll()
    const session = await app.identity.handle(new Request(`http://localhost:4110/sucafina/auth/local?code=${code}`))
    const cookie = session!.headers.get("set-cookie")!.split(";")[0]!
    const request = new Request("http://localhost:4110/sucafina/dashboard", { method: "POST", headers: { cookie, origin: "http://localhost:4110" } })
    const principal = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: await app.identity.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") }) }))
    if (!principal) throw new Error("missing operator")
    const targetIdentity = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "v1") }))
    if (!targetIdentity) throw new Error("missing Planner source")
    const access = { installationId: operator.installationId, projectId: "project", principalRef: principal.id, policyVersion: "policy", accessRevision: "access" }
    const ui = createSfUiAuthority({ privateCommands: sfHumanActions.map((action) => `sf-human:${action}`), authorize: async () => access, createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), commandIdentity: async (_, operation) => operation })
    const human = createSfHumanAuthority({ origin: "http://localhost:4110", ui })
    const host = { persistence: app.store, authenticate: app.identity.authenticate, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context) }
    const state = createSfProductState({ persistence: app.store, createId: randomUUID, authorize: async (input, snapshot) => await app.identity.authenticate(input, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }) ? { principalRef: principal.id, accessRevision: "access", policyVersion: "policy" } : undefined, resolveTarget: async (_, __, ___, ref) => { const snapshot = (app.store as typeof app.store & { currentSnapshots?: () => { planner: Snapshot } | undefined }).currentSnapshots?.()?.planner; return snapshot ? sfSourceIdentity(snapshot, "planner-version", ref) : undefined } })
    const actor = { id: principal.id, roles: principal.roles.filter((row) => row.surface === "planner").map((row) => row.role), canWrite: principal.canWrite, assigned: [], domains: [] }
    const target = { surface: "planner" as const, selectionRef: "v1", incarnation: targetIdentity.incarnation, version: targetIdentity.version, options: { newVersion: false, removeMissing: false, preview: {} } }
    const resolveTarget = async () => app.store.transaction("planner", async (snapshot) => {
      const source = sfSourceIdentity(snapshot, "planner-version", "v1")
      const projection = projectPlannerSource(snapshot, actor, "v1")
      if (!source || !projection) return { commit: false, value: { status: "unavailable" as const, reason: "source-unavailable" } }
      const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "source-v1", installationId: access.installationId, projectId: access.projectId, refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v1", incarnation: source.incarnation, version: source.version, fields: Object.keys(projection).sort(), period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: digestSfValue({ versionId: "v1", projection }) } }
      evidence.refDigest = digestSfEvidenceRef(evidence)
      return { commit: false, value: { status: "ok" as const, value: { versionId: "v1", evidence } } }
    })
    const targetAllowed = async () => app.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "v1")?.incarnation === target.incarnation }))
    const imports = createSfImportHost({ host, assets: app.store, services: { scan: async () => true, signingKey: randomBytes(32) }, state, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeTarget: targetAllowed, authorizeAdmission: (payload, context) => human.authorize(context, "imports.admit", payload), preview: { revalidate: host.revalidate }, apply: { revalidate: host.revalidate, confirm: (manifest, context) => human.authorize(context, "imports.apply", { manifestId: manifest.id, version: manifest.version }) }, planner: { resolveTarget, verifyTarget: (snapshot, selection) => { const current = sfSourceIdentity(snapshot, "planner-version", selection.selectionRef); return current?.incarnation === selection.incarnation && current.version === selection.version } }, dashboard: { resolveTarget: async () => ({ status: "unavailable", reason: "dashboard-not-in-test" }), verifyScope: () => false } })
    const book = new Workbook(); const sheet = book.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"]); sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 0])
    const bytes = new Uint8Array(await book.xlsx.writeBuffer())
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const grant = await human.admit(request, "imports.admit", { target, format: "xlsx", digest })
    if (grant.status !== "ok") throw new Error(grant.reason)
    const file = await imports.admit({ target, format: "xlsx", bytes }, grant.value)
    human.finish(grant.value)
    expect(file.status).toBe("ok")
    if (file.status !== "ok") return
    const selection = { admittedFileRef: file.value.ref, format: "xlsx", options: {} }
    const previewGrant = await ui.admit(request, "sf_import_preview", digestSfValue(selection))
    if (previewGrant.status !== "ok" || !await ui.validate(previewGrant.value, "sf_import_preview", digestSfValue(selection))) throw new Error("preview grant")
    const preview = await imports.preview(selection, previewGrant.value)
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    const domainBeforeAnalysis = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const analysis = await imports.readPreviewForAnalysis({ previewRef: preview.value.id, request: selection }, previewGrant.value)
    expect(analysis.status).toBe("ok")
    if (analysis.status === "ok") {
      expect(analysis.value.manifest).toEqual(preview.value)
      expect(analysis.value.detail.manifestId).toBe(preview.value.id)
    }
    const reopenedPreview = await imports.readPreviewReference(preview.value.id, previewGrant.value)
    expect(reopenedPreview.status).toBe("ok")
    if (reopenedPreview.status === "ok") {
      expect(reopenedPreview.value.manifest).toEqual(preview.value)
      expect(reopenedPreview.value.detail.manifestId).toBe(preview.value.id)
      expect(reopenedPreview.value.manifest.commands.every((command) => !("command" in command))).toBe(true)
    }
    expect((await imports.readPreviewReference("another-preview", previewGrant.value)).status).not.toBe("ok")
    expect(await imports.readPreviewReference(preview.value.id, { ...previewGrant.value, binding: { ...previewGrant.value.binding, principalRef: "other-principal" } })).toMatchObject({ status: "denied" })
    expect(await imports.readPreviewForAnalysis({ previewRef: preview.value.id, request: { ...selection, options: { sheet: "other" } } }, previewGrant.value)).toMatchObject({ status: "stale" })
    expect(await imports.readPreviewForAnalysis({ previewRef: preview.value.id, request: { ...selection, admittedFileRef: "other" } }, previewGrant.value)).toMatchObject({ status: "stale" })
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(domainBeforeAnalysis)
    await app.store.transaction("dashboard", async (_, blobs) => { await blobs.put(`sf-import/${file.value.ref}`, new Uint8Array([1, 2, 3]), "application/octet-stream"); return { commit: true, value: undefined } })
    expect((await imports.readPreviewForAnalysis({ previewRef: preview.value.id, request: selection }, previewGrant.value)).status).not.toBe("ok")
    expect((await imports.readPreviewReference(preview.value.id, previewGrant.value)).status).not.toBe("ok")
    await app.store.transaction("dashboard", async (_, blobs) => { await blobs.put(`sf-import/${file.value.ref}`, bytes, "application/octet-stream"); return { commit: true, value: undefined } })
    ui.finish(previewGrant.value)
    expect(await imports.readPreviewReference(preview.value.id, previewGrant.value)).toMatchObject({ status: "denied" })
    const applyInput = { manifestId: preview.value.id, version: preview.value.version }
    const apply = async () => { const grant = await human.admit(request, "imports.apply", applyInput); if (grant.status !== "ok") throw new Error(grant.reason); const result = await imports.apply(applyInput, grant.value); human.finish(grant.value); return result }
    const first = await apply()
    expect(first.status).toBe("ok")
    const after = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect((after.data.versions as { lines: { f: (number | null)[] }[] }[])[0]!.lines[0]!.f[0]).toBe(0)
    expect(await apply()).toEqual(first)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(after.audit.length)
    await app.driver.dispose()
    const reopened = await open()
    try { expect(await reopened.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(after.audit.length) } finally { await reopened.driver.dispose() }
  } finally { await app.driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
