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
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { resolveSfDocumentEvidence } from "../../../../product/documents/evidence-resolver.ts"
import { createSfBusinessContext } from "../../../../product/host-binding/business-context.ts"
import { createSfDocumentSourceAccess } from "../../../../product/decision-memory/source-access.ts"
import { createPlannerProduct } from "../../../../product/planner/product.ts"
import { createPlannerImportAnalysis } from "../../../../product/planner/import-analysis.ts"
import { verifyPlannerImportTarget } from "../../../../product/imports/source-fences.ts"
import { prepareDossierEvidence } from "../../../../product/routines/dossier.ts"
import { createSfDocumentHttp } from "../../../../product/interface/document-http.ts"
import { createSfImportHttp } from "../../../../product/interface/import-http.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfDocumentServices } from "../../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfImportServices } from "../../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfRosterSources } from "../../../../../../../apps/cli/src/sucafina-product/roster-sources.ts"
import { createSfPlannerSourceHost } from "../../../../product/integration/planner-sources.ts"

test("real host persists procurement document evidence and Planner import under current authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-document-host-"))
  const driver = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) }) }
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const origin = "http://localhost:4110"
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const environment = async () => ({ at, id: randomUUID, directory: [] })
  // This fixture exercises the real host and storage; the scanner stub is not scanner qualification.
  const assets = { persistence: store, services: { signingKey: randomBytes(32), scan: async () => true } }
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
    await store.transaction("procurement", async (snapshot) => { snapshot.data.store = { suppliers: [{ id: "s1", name: "Supplier" }], settings: { uploadCap: 100000 } }; return { commit: true, value: undefined } })
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, closed: 9, locked: false, lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000], a: [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null], f: [null, null, null, null, null, null, null, null, null, 38000, 112000, 40000] }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      return { commit: true, value: undefined }
    })
    const code = await identity.enroll()
    const session = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${code}`))
    const cookie = session!.headers.get("set-cookie")!.split(";")[0]!
    const request = (surface = "dashboard") => new Request(`${origin}/sucafina/${surface}`, { method: "POST", headers: { cookie, origin, "Idempotency-Key": randomUUID() } })
    const principal = await store.transaction("procurement", async (snapshot) => ({ commit: false, value: await identity.authenticate(request("procurement"), { surface: "procurement", roleMap: roleMap(snapshot, "procurement") }) }))
    if (!principal) throw new Error("missing operator")
    const uploaded = await store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs, { id: principal.id, roles: ["admin"], canWrite: true, assigned: [], domains: [] }, { page: "Suppliers", action: "upload", id: "s1", version: 0, values: {} }, { at, id: () => "asset-1", directory: [] }, assets.services, "supplier", { name: "terms.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 42") })
      return { commit: result.ok, value: result }
    })
    expect(uploaded.ok).toBe(true)
    const installation = { installationId: operator.installationId, hostId: "test-host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({ identity: () => installation, installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate: identity.authenticate, environment, grants: [{ principalRef: principal.id, namespaces: ["documents", "receipts"], operations: ["sf_document_extract", "sf_knowledge_search", "sf_evidence_get", "sf_import_preview"], humanActions: ["documents.schema", "documents.confirm", "imports.admit", "imports.apply"] }], createId: randomUUID, now: () => Date.parse(at), commandIdentity: async (request, operation) => { if (request.method === "GET" || request.method === "HEAD") return randomUUID(); const key = request.headers.get("Idempotency-Key"); return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined }, inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: createSfDocumentTargetAuthority({ persistence: store, authenticate: identity.authenticate, environment, assets }) })
    const runtime = { installationId: operator.installationId, directory, sourceRoot: directory, origin, mount: "/sucafina", persistence: store, authenticate: identity.authenticate, environment, assets }
    const service = createSfDocumentServices({ runtime, authority })
    const plannerSources = createSfPlannerSourceHost({ host: authority.host, scopedSources: store, coverageFor: async () => ({ status: "unavailable", reason: "not-covered" }) })
    const roster = createSfRosterSources({ host: authority.host, scopedSources: store, plannerSources })
    const importing = createSfImportServices({ runtime, authority, roster })
    if (!service || !importing) throw new Error("missing production services")
    const business = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: createSfDocumentSourceAccess({ host: authority.host, read: service.documents.reader }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } })
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
    const pending = await uiCall("sf_evidence_get", { evidenceRef: candidate.value.ref }, (context) => business.resolve(candidate.value.ref, context))
    expect(pending.state).not.toBe("fresh")
    const pendingDossier = await uiCall("sf_evidence_get", { evidenceRef: candidate.value.ref }, (context) => prepareDossierEvidence({ refs: [candidate.value.ref], context, reader: service.documents.reader, revalidate: async (_: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[], call: TrustedDomainContext) => authority.host.revalidate(call) }))
    expect(pendingDossier).toMatchObject({ status: "ok", value: { entries: [{ state: "pending", evidence: { ref: candidate.value.ref } }] } })
    const confirmGrant = await authority.human.admit(request(), "documents.confirm", candidate.value)
    if (confirmGrant.status !== "ok") throw new Error(confirmGrant.reason)
    const confirmed = await service.documents.confirm(candidate.value.id, confirmGrant.value)
    authority.human.finish(confirmGrant.value)
    expect(confirmed.status).toBe("ok")
    if (confirmed.status !== "ok") return
    const resolution = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(resolution.state).toBe("fresh")
    const businessResolution = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => business.resolve(confirmed.value.ref, context))
    expect(businessResolution.state).toBe("fresh")
    expect(businessResolution.currentRef).toEqual(confirmed.value.ref)
    const confirmedDossier = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => prepareDossierEvidence({ refs: [confirmed.value.ref], context, reader: service.documents.reader, revalidate: async (_: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[], call: TrustedDomainContext) => authority.host.revalidate(call) }))
    expect(confirmedDossier).toMatchObject({ status: "ok", value: { entries: [{ state: "confirmed", evidence: { ref: confirmed.value.ref } }] } })
    const documentHttp = createSfDocumentHttp({ origin, mount: "/sucafina", runtime: () => ({ ui: authority.ui, human: authority.human, ...service }) })
    const openUrl = new URL(`${origin}/sucafina/dashboard`)
    openUrl.searchParams.set("sf", "document-open")
    openUrl.searchParams.set("ref", JSON.stringify(confirmed.value.ref))
    const presentation = await documentHttp(new Request(openUrl, { headers: { cookie } }), "dashboard")
    expect(presentation?.status).toBe(200)
    const opened = await presentation!.json()
    expect(opened.value.title).toBe("terms.txt")
    expect(String(opened.value.href).startsWith("/sucafina/procurement?asset=")).toBe(true)
    const importHttp = createSfImportHttp({ origin, mount: "/sucafina", runtime: () => ({ ui: authority.ui, human: authority.human, service: importing }) })
    const url = (mode: string) => `${origin}/sucafina/planner?sf=${mode}`
    const missingKey = await importHttp(new Request(url("import-preview"), { method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify({ admittedFileRef: "not-admitted", format: "xlsx", options: {} }) }), "planner")
    expect(missingKey?.status).toBe(403)
    const discovery = await importHttp(new Request(`${url("import-targets")}&surface=planner`, { headers: { cookie } }), "planner")
    expect(discovery?.status).toBe(200)
    const choices = await discovery!.json() as { value: { label: string; surface: string; selectionRef: string }[] }
    const planner = choices.value.find((row) => row.label === "FY27")
    if (!planner) throw new Error("Planner version not discovered")
    await uiCall("sf_import_preview", { roster: planner.selectionRef }, async (context) => {
      const selected = await importing.prepareTarget({ surface: "planner", selectionRef: planner.selectionRef, options: { newVersion: false, removeMissing: false, preview: {} } }, context)
      if (selected.status !== "ok") throw new Error(selected.reason)
      const issued = await roster.resolveRoster(selected.value, context)
      if (issued.status !== "ok") throw new Error(issued.reason)
      const forged = structuredClone(issued.value)
      forged.target.period = { start: "2028-01-01", end: "2028-12-31" }
      forged.refDigest = digestSfEvidenceRef(forged)
      const valid = await store.transaction("planner", async (snapshot) => {
        const plannerPrincipal = await identity.authenticate(request("planner"), { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!plannerPrincipal) throw new Error("Planner operator unavailable")
        const roles = plannerPrincipal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
        const actor = { id: plannerPrincipal.id, roles, canWrite: plannerPrincipal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
        return { commit: false, value: { original: roster.verifyRoster(snapshot, issued.value, actor, context), forged: roster.verifyRoster(snapshot, forged, actor, context) } }
      })
      expect(valid).toEqual({ original: true, forged: false })
    })
    const product = createPlannerProduct({ host: authority.host, scopedSources: store, coverageFor: async () => ({ status: "unavailable", reason: "not-covered" }) })
    const analyze = createPlannerImportAnalysis({ host: authority.host, issueSource: product.issueSource, readPreview: importing.imports.readPreparedPreviewForAnalysis, verifyTarget: (snapshot, manifest, actor, context) => {
      const source = manifest.baseIdentity[0]
      return !!source && verifyPlannerImportTarget(snapshot, { surface: "planner", selectionRef: planner.selectionRef, incarnation: source.incarnation, version: source.version, options: { newVersion: false, removeMissing: false, preview: {} } }, actor, context)
    } })
    const beforeAnalysis = await store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const analyses: { previewRef: string; importRequest: { admittedFileRef: string; format: string; options: {} }; period: { start: string; end: string }; currency: string }[] = []
    for (const [amount, expected] of [[124000, 602000], [118000, 596000]] as const) {
      const analysisWorkbook = new Workbook(); const analysisSheet = analysisWorkbook.addWorksheet("OPEX")
      analysisSheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Oct", "Nov", "Dec"]); analysisSheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 38000, amount, 40000])
      const analysisForm = new FormData()
      const analysisBytes = new Uint8Array(await analysisWorkbook.xlsx.writeBuffer())
      analysisForm.set("file", new File([analysisBytes], "analysis.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      analysisForm.set("surface", planner.surface); analysisForm.set("selectionRef", planner.selectionRef); analysisForm.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
      const admittedFile = await importHttp(new Request(url("import-admit"), { method: "POST", headers: { cookie, origin, "Idempotency-Key": randomUUID() }, body: analysisForm }), "planner")
      expect(admittedFile?.status).toBe(200)
      const admittedValue = await admittedFile!.json() as { value: { ref: string } }
      const importRequest = { admittedFileRef: admittedValue.value.ref, format: "xlsx", options: {} }
      const proposed = await importHttp(new Request(url("import-preview"), { method: "POST", headers: { cookie, origin, "content-type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(importRequest) }), "planner")
      expect(proposed?.status).toBe(200)
      const proposedValue = await proposed!.json() as { value: { id: string } }
      const analysisRequest = { previewRef: proposedValue.value.id, importRequest, period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }
      analyses.push(analysisRequest)
      const analysis = await uiCall("sf_import_preview", importRequest, (context) => analyze(analysisRequest, context))
      expect(analysis.status).toBe("ok")
      if (analysis.status !== "ok") throw new Error(analysis.reason)
      expect(analysis.value).toMatchObject({ analysisBasis: "import-preview", importPreviewRef: proposedValue.value.id, domainApplied: false, knownDifference: expected - 590000 })
      expect(analysis.value.baseline.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)).toBe(590000)
      expect(analysis.value.candidate.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)).toBe(expected)
      await store.transaction("dashboard", async (_, blobs) => { await blobs.put(`sf-import/${admittedValue.value.ref}`, new Uint8Array([1]), "application/octet-stream"); return { commit: true, value: undefined } })
      expect((await uiCall("sf_import_preview", importRequest, (context) => analyze(analysisRequest, context))).status).not.toBe("ok")
      await store.transaction("dashboard", async (_, blobs) => { await blobs.put(`sf-import/${admittedValue.value.ref}`, analysisBytes, "application/octet-stream"); return { commit: true, value: undefined } })
    }
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(beforeAnalysis)
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan", "Total"]); sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 0, 1200])
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
    const form = new FormData()
    form.set("file", new File([bytes], "forecast.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    form.set("surface", planner.surface); form.set("selectionRef", planner.selectionRef)
    form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
    const uploadedImport = await importHttp(new Request(url("import-admit"), { method: "POST", headers: { cookie, origin, "Idempotency-Key": randomUUID() }, body: form }), "planner")
    expect(uploadedImport?.status).toBe(200)
    const file = await uploadedImport!.json() as { value: { ref: string } }
    const previewInput = { admittedFileRef: file.value.ref, format: "xlsx", options: {} }
    const post = (mode: string, value: unknown) => importHttp(new Request(url(mode), { method: "POST", headers: { cookie, origin, "content-type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(value) }), "planner")
    const preview = await post("import-preview", previewInput)
    expect(preview?.status).toBe(200)
    const manifest = await preview!.json() as { value: { id: string; version: number } }
    const detail = await importHttp(new Request(`${url("import-detail")}&manifestId=${encodeURIComponent(manifest.value.id)}&version=${manifest.value.version}`, { headers: { cookie } }), "planner")
    expect(detail?.status).toBe(200)
    const detailValue = await detail!.json() as { value: { detail: { changes: { kind: string; source: { field?: string; address?: string } }[] } } }
    expect(detailValue.value.detail.changes).toContainEqual(expect.objectContaining({ kind: "ignored", source: expect.objectContaining({ field: "Total", address: "G2" }) }))
    const applied = await post("import-apply", { manifestId: manifest.value.id, version: manifest.value.version })
    expect(applied?.status).toBe(200)
    const receiptDetail = await importHttp(new Request(`${url("import-detail")}&manifestId=${encodeURIComponent(manifest.value.id)}&version=${manifest.value.version}`, { headers: { cookie } }), "planner")
    const receiptValue = await receiptDetail!.json() as { value: { receipt: { outcome: string; changedFields: number } } }
    expect(receiptValue.value.receipt.outcome).toBe("applied")
    expect(receiptValue.value.receipt.changedFields).toBeGreaterThan(0)
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: ((snapshot.data.versions as { lines: { f: (number | null)[] }[] }[])[0]!).lines[0]!.f[0] }))).toBe(0)
    expect((await uiCall("sf_import_preview", analyses[0]!.importRequest, (context) => analyze(analyses[0]!, context))).status).not.toBe("ok")
    const currentChoices = await importHttp(new Request(`${url("import-targets")}&surface=planner`, { headers: { cookie } }), "planner")
    const currentPlanner = ((await currentChoices!.json()) as { value: { label: string; surface: string; selectionRef: string }[] }).value.find((row) => row.label === "FY27")
    if (!currentPlanner) throw new Error("current Planner version not discovered")
    const membersWorkbook = new Workbook(); const members = membersWorkbook.addWorksheet("All Members")
    members.addRow(["Name", "Title", "Type", "Leader", "Location", "Start Date", "End Date", "Status", "Classification", "Outlook", "Notes"])
    members.addRow(["Roster person", "Analyst", "Employee", "Lead", "Geneva", "2027-01-01", "", "Active", "ignore", "ignore", "ignore"])
    membersWorkbook.addWorksheet("Summary by Leader").addRow(["Leader", "Count"])
    const membersForm = new FormData()
    membersForm.set("file", new File([new Uint8Array(await membersWorkbook.xlsx.writeBuffer())], "members.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    membersForm.set("surface", currentPlanner.surface); membersForm.set("selectionRef", currentPlanner.selectionRef); membersForm.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
    const membersAdmission = await importHttp(new Request(url("import-admit"), { method: "POST", headers: { cookie, origin, "Idempotency-Key": randomUUID() }, body: membersForm }), "planner")
    expect(membersAdmission?.status).toBe(200)
    const membersFile = await membersAdmission!.json() as { value: { ref: string } }
    const membersPreview = await post("import-preview", { admittedFileRef: membersFile.value.ref, format: "xlsx", options: {} })
    expect(membersPreview?.status).toBe(200)
    const membersManifest = await membersPreview!.json() as { value: { id: string; version: number; baseIdentity: { type: string }[] } }
    expect(membersManifest.value.baseIdentity.map((source) => source.type)).toEqual(["planner-version", "planner-roster"])
    expect((await post("import-apply", { manifestId: membersManifest.value.id, version: membersManifest.value.version }))?.status).toBe(200)
    const storedRoster = await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.roster }))
    expect(storedRoster).toEqual([{ name: "Roster person", title: "Analyst", type: "Employee", leader: "Lead", location: "Geneva", start: "2027-01-01", end: "", status: "Active" }])
    const originalIdentity = await store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "asset-1") }))
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const locked = store.transactionAll!(async () => {
      const read = () => store.transaction("procurement", async (_, blobs) => ({ commit: false, value: await blobs.get("supplier/s1/asset-1") }))
      expect(new TextDecoder().decode(await read())).toBe("Price: 42")
      entered.resolve()
      await release.promise
      expect(new TextDecoder().decode(await read())).toBe("Price: 42")
      return { commit: false, value: undefined }
    })
    await entered.promise
    const replacement = store.transaction("procurement", async (_, blobs) => { await blobs.put("supplier/s1/asset-1", new TextEncoder().encode("Price: 99"), "text/plain"); return { commit: true, value: undefined } })
    release.resolve()
    await locked
    await replacement
    const modified = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(modified.state).not.toBe("fresh")
    await store.transaction("procurement", async (_, blobs) => { await blobs.put("supplier/s1/asset-1", new TextEncoder().encode("Price: 42"), "text/plain"); return { commit: true, value: undefined } })
    const afterABA = await store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "asset-1") }))
    expect(afterABA?.version).toBeGreaterThan(originalIdentity?.version ?? 0)
    const staleAfterABA = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(staleAfterABA.state).not.toBe("fresh")
    const businessAfterABA = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => business.resolve(confirmed.value.ref, context))
    expect(businessAfterABA.state).not.toBe("fresh")
    const staleDossier = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => prepareDossierEvidence({ refs: [confirmed.value.ref], context, reader: service.documents.reader, revalidate: async (_: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[], call: TrustedDomainContext) => authority.host.revalidate(call) }))
    expect(staleDossier).toMatchObject({ status: "ok", value: { entries: [{ state: "unavailable" }] } })
    await store.transaction("procurement", async (snapshot) => {
      snapshot.data.assets = []
      const suppliers = (snapshot.data.store as { suppliers: { attachments?: unknown[] }[] }).suppliers
      suppliers[0]!.attachments = []
      return { commit: true, value: undefined }
    })
    const revoked = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(revoked.state).not.toBe("fresh")
    const revokedDossier = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => prepareDossierEvidence({ refs: [confirmed.value.ref], context, reader: service.documents.reader, revalidate: async (_: readonly Extract<BusinessEvidenceRef, { kind: "document" }>[], call: TrustedDomainContext) => authority.host.revalidate(call) }))
    expect(revokedDossier).toMatchObject({ status: "ok", value: { entries: [{ state: "unavailable" }] } })
    expect((await documentHttp(new Request(openUrl, { headers: { cookie } }), "dashboard"))?.status).not.toBe(200)
    const replaced = await store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs, { id: principal.id, roles: ["admin"], canWrite: true, assigned: [], domains: [] }, { page: "Suppliers", action: "upload", id: "s1", version: snapshot.versions["suppliers:s1"]?.version ?? 0, values: {} }, { at, id: () => "asset-1", directory: [] }, assets.services, "supplier", { name: "terms.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 99") })
      return { commit: result.ok, value: result }
    })
    expect(replaced.ok).toBe(true)
    const oldSource = await uiCall("sf_evidence_get", { evidenceRef: confirmed.value.ref }, (context) => resolveSfDocumentEvidence(confirmed.value.ref, context, service.documents.reader))
    expect(oldSource.state).not.toBe("fresh")
  } finally { await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
