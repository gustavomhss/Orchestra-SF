import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { uploadAsset } from "../../../../runtime/assets.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { resolveSfDocumentEvidence } from "../../../../product/documents/evidence-resolver.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfDocumentServices } from "../../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfImportServices } from "../../../../../../../apps/cli/src/sucafina-product/import-services.ts"

test("real host persists procurement document evidence and Planner import under current authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-document-host-"))
  const driver = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) }) }
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const origin = "http://localhost:4110"
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const environment = async () => ({ at, id: randomUUID, directory: [] })
  const assets = { persistence: store, services: { signingKey: randomBytes(32), scan: async () => true } }
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
    await store.transaction("procurement", async (snapshot) => { snapshot.data.store = { suppliers: [{ id: "s1", name: "Supplier" }], settings: { uploadCap: 100000 } }; return { commit: true, value: undefined } })
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, closed: 0, locked: false, lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []
      return { commit: true, value: undefined }
    })
    const code = await identity.enroll()
    const session = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${code}`))
    const cookie = session!.headers.get("set-cookie")!.split(";")[0]!
    const request = (surface = "dashboard") => new Request(`${origin}/sucafina/${surface}`, { method: "POST", headers: { cookie, origin } })
    const principal = await store.transaction("procurement", async (snapshot) => ({ commit: false, value: await identity.authenticate(request("procurement"), { surface: "procurement", roleMap: roleMap(snapshot, "procurement") }) }))
    if (!principal) throw new Error("missing operator")
    const uploaded = await store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs, { id: principal.id, roles: ["admin"], canWrite: true, assigned: [], domains: [] }, { page: "Suppliers", action: "upload", id: "s1", version: 0, values: {} }, { at, id: () => "asset-1", directory: [] }, assets.services, "supplier", { name: "terms.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 42") })
      return { commit: result.ok, value: result }
    })
    expect(uploaded.ok).toBe(true)
    const installation = { installationId: operator.installationId, hostId: "test-host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({ identity: () => installation, installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate: identity.authenticate, environment, grants: [{ principalRef: principal.id, namespaces: ["documents", "receipts"], operations: ["sf_document_extract", "sf_knowledge_search", "sf_evidence_get", "sf_import_preview"], humanActions: ["documents.schema", "documents.confirm", "imports.admit", "imports.apply"] }], createId: randomUUID, now: () => Date.parse(at), commandIdentity: async (_, operation, digest) => digestSfValue({ operation, digest }), inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: createSfDocumentTargetAuthority({ persistence: store, authenticate: identity.authenticate, environment, assets }) })
    const runtime = { installationId: operator.installationId, directory, sourceRoot: directory, origin, mount: "/sucafina", persistence: store, authenticate: identity.authenticate, environment, assets }
    const service = createSfDocumentServices({ runtime, authority })
    const importing = createSfImportServices({ runtime, authority })
    if (!service || !importing) throw new Error("missing production services")
    const uiCall = async <T>(operation: string, payload: unknown, work: (context: TrustedUiContext) => Promise<T>) => {
      const digest = digestSfValue(payload)
      const grant = await authority.ui.admit(request(), operation, digest)
      if (grant.status !== "ok" || !await authority.ui.validate(grant.value, operation, digest)) throw new Error("UI grant unavailable")
      try { return await work(grant.value) } finally { authority.ui.finish(grant.value) }
    }
    const discovered = await uiCall("sf_document_extract", {}, (context) => service.discover(context))
    expect(discovered.status).toBe("ok")
    if (discovered.status !== "ok") return
    const selected = discovered.value.find((row) => row.label === "terms.txt")
    if (!selected) throw new Error("document not discovered")
    const admitted = await uiCall("sf_document_extract", { selectionRef: selected.selectionRef }, (context) => service.admitSelection(selected.selectionRef, context))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const schemaInput = { documentRef: admitted.value.documentId, fields: [{ id: "Price", type: "number" as const, unit: "USD" }] }
    const schemaGrant = await authority.human.admit(request(), "documents.schema", schemaInput)
    if (schemaGrant.status !== "ok") throw new Error(schemaGrant.reason)
    const schema = await service.schemas.register(schemaInput, schemaGrant.value)
    authority.human.finish(schemaGrant.value)
    expect(schema.status).toBe("ok")
    if (schema.status !== "ok") return
    const extractInput = { documentRef: admitted.value.documentId, fieldSchemaRef: schema.value.ref }
    const candidate = await uiCall("sf_document_extract", extractInput, (context) => service.documents.extract(extractInput, context))
    expect(candidate.status).toBe("ok")
    if (candidate.status !== "ok") return
    expect(candidate.value).toMatchObject({ fieldCandidate: "Price", value: 42, status: "extracted" })
    const confirmGrant = await authority.human.admit(request(), "documents.confirm", candidate.value)
    if (confirmGrant.status !== "ok") throw new Error(confirmGrant.reason)
    const confirmed = await service.documents.confirm(candidate.value.id, confirmGrant.value)
    authority.human.finish(confirmGrant.value)
    expect(confirmed.status).toBe("ok")
    if (confirmed.status !== "ok") return
    const resolution = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(resolution.state).toBe("fresh")
    const discovery = await uiCall("sf_import_preview", { surface: "planner" }, (context) => importing.discover("planner", context))
    expect(discovery.status).toBe("ok")
    if (discovery.status !== "ok") return
    const planner = discovery.value.find((row) => row.label === "FY27")
    if (!planner) throw new Error("Planner version not discovered")
    const selection = { surface: "planner" as const, selectionRef: planner.selectionRef, options: { newVersion: false, removeMissing: false, preview: {} } }
    const target = await uiCall("sf_import_preview", selection, (context) => importing.prepareTarget(selection, context))
    expect(target.status).toBe("ok")
    if (target.status !== "ok") return
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"]); sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 0])
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const importGrant = await authority.human.admit(request(), "imports.admit", { target: target.value, format: "xlsx", digest })
    if (importGrant.status !== "ok") throw new Error(importGrant.reason)
    const file = await importing.imports.admit({ target: target.value, format: "xlsx", bytes }, importGrant.value)
    authority.human.finish(importGrant.value)
    expect(file.status).toBe("ok")
    if (file.status !== "ok") return
    const previewInput = { admittedFileRef: file.value.ref, format: "xlsx", options: {} }
    const preview = await uiCall("sf_import_preview", previewInput, (context) => importing.imports.preview(previewInput, context))
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") return
    const applyInput = { manifestId: preview.value.id, version: preview.value.version }
    const applyGrant = await authority.human.admit(request(), "imports.apply", applyInput)
    if (applyGrant.status !== "ok") throw new Error(applyGrant.reason)
    const applied = await importing.imports.apply(applyInput, applyGrant.value)
    authority.human.finish(applyGrant.value)
    expect(applied.status).toBe("ok")
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: ((snapshot.data.versions as { lines: { f: (number | null)[] }[] }[])[0]!).lines[0]!.f[0] }))).toBe(0)
    const originalIdentity = await store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "asset-1") }))
    await store.transaction("procurement", async (_, blobs) => { await blobs.put("supplier/s1/asset-1", new TextEncoder().encode("Price: 99"), "text/plain"); return { commit: true, value: undefined } })
    const modified = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(modified.state).not.toBe("fresh")
    await store.transaction("procurement", async (_, blobs) => { await blobs.put("supplier/s1/asset-1", new TextEncoder().encode("Price: 42"), "text/plain"); return { commit: true, value: undefined } })
    const afterABA = await store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "asset-1") }))
    expect(afterABA?.version).toBeGreaterThan(originalIdentity?.version ?? 0)
    const staleAfterABA = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(staleAfterABA.state).not.toBe("fresh")
    await store.transaction("procurement", async (snapshot) => {
      snapshot.data.assets = []
      const suppliers = (snapshot.data.store as { suppliers: { attachments?: unknown[] }[] }).suppliers
      suppliers[0]!.attachments = []
      return { commit: true, value: undefined }
    })
    const revoked = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(revoked.state).not.toBe("fresh")
    const replaced = await store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs, { id: principal.id, roles: ["admin"], canWrite: true, assigned: [], domains: [] }, { page: "Suppliers", action: "upload", id: "s1", version: snapshot.versions["suppliers:s1"]?.version ?? 0, values: {} }, { at, id: () => "asset-1", directory: [] }, assets.services, "supplier", { name: "terms.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 99") })
      return { commit: result.ok, value: result }
    })
    expect(replaced.ok).toBe(true)
    const oldSource = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(oldSource.state).not.toBe("fresh")
  } finally { await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
