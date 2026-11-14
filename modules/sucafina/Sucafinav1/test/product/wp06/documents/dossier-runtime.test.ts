import { expect, test } from "bun:test"
import { uploadAsset } from "../../../../runtime/assets.ts"
import { object, rows } from "../../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDossierServices } from "../../../../../../../apps/cli/src/sucafina-product/dossier-services.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"
import { documentFormatFixture } from "./format-fixtures.ts"

test.each(["txt", "docx", "pdf"] as const)("%s real Request dossier composes default services and preserves pending, confirmed and revoked document identity", async (format) => {
  const procurementEvidenceWrites = new WeakSet<object>()
  const fixture = await createWp06Runtime({ additionalOperations: ["sf_request_read", "sf_work_list"], procurementEvidenceWrites })
  const business = createSfBusinessServices({ authority: fixture.authority, persistence: fixture.store, proposalCoverageWrites: new WeakSet(), procurementEvidenceWrites, documentRead: fixture.documents.documents.reader })
  const dossier = createSfDossierServices({ runtime: fixture.runtime, authority: fixture.authority, business, documents: fixture.documents })
  if (!dossier) throw new Error("Dossier service did not compose")
  const request = async (mode: string, query: Record<string, string> = {}, cookie = fixture.cookie) => {
    const url = new URL(`${fixture.origin}/sucafina/procurement`)
    url.searchParams.set("sf", mode)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await dossier.http(new Request(url, { headers: { cookie } }), "procurement")
    if (!response) throw new Error("Dossier route missing")
    return response
  }
  try {
    const source = await documentFormatFixture(format, "Price: 42")
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: {
        r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id, pr: { title: "Current Request", estAmount: 42 }, history: [] } },
      } }
      return { commit: true, value: undefined }
    })
    const uploaded = await fixture.store.transaction("procurement", async (snapshot, blobs) => {
      const value = await uploadAsset(snapshot, blobs, { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] },
        { page: "Requests", action: "upload", id: "r1", version: snapshot.versions["requests:r1"]?.version ?? 0, values: {} },
        { at: fixture.at, id: () => "asset-r1", directory: [] }, fixture.runtime.assets.services, "quote", { name: `terms.${source.extension}`, type: source.mediaType, bytes: source.bytes })
      return { commit: value.ok, value }
    })
    expect(uploaded.ok).toBe(true)
    const sources = await (await fixture.documentRequest("document-sources")).json() as { value: { selectionRef: string }[] }
    expect(sources.value).toHaveLength(1)
    const admitted = await fixture.documentRequest("document-admit", { selectionRef: sources.value[0]!.selectionRef })
    expect(admitted.status).toBe(200)
    const documentRef = ((await admitted.json()) as { value: { documentRef: string } }).value.documentRef
    const registered = await (await fixture.documentRequest("document-schema", { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })).json() as { value: { ref: string } }
    const extracted = await fixture.documentRequest("document-extract", { documentRef, fieldSchemaRef: registered.value.ref })
    expect(extracted.status).toBe(200)
    const candidate = decodeSfOperationOutput("sf_document_extract", (await extracted.json()).value)
    if (!candidate.ok) throw new Error("Document candidate schema failed")
    const page = await request("sourcing-dossier")
    expect(page.status).toBe(200)
    expect(page.headers.get("content-security-policy")).toContain("sha256-")
    expect(await page.text()).toContain("Pending confirmation")
    expect((await request("sourcing-dossier", {}, "")).status).toBe(403)
    expect((await request("sourcing-dossier", { unexpected: "value" })).status).toBe(400)
    const rejectedRequests = [
      { request: new Request(`${fixture.origin}/sucafina/procurement?sf=sourcing-dossier`, { method: "POST", headers: { cookie: fixture.cookie } }), status: 405 },
      { request: new Request(`${fixture.origin}/sucafina/procurement?sf=sourcing-dossier`, { headers: { cookie: fixture.cookie, "sec-fetch-site": "cross-site" } }), status: 403 },
      { request: new Request(`${fixture.origin}/sucafina/planner?sf=sourcing-dossier`, { headers: { cookie: fixture.cookie } }), status: 403 },
      { request: new Request(`${fixture.origin}/sucafina/procurement?sf=sourcing-dossier&sf=sourcing-dossier-read`, { headers: { cookie: fixture.cookie } }), status: 400 },
    ]
    for (const rejected of rejectedRequests) expect((await dossier.http(rejected.request, "procurement"))?.status).toBe(rejected.status)
    const selections = await request("sourcing-dossier-requests", { start: "2026-01-01", end: "2026-12-31" })
    expect(selections.status).toBe(200)
    const requests = await selections.json() as { value: { requestRef: string; label: string }[] }
    expect(requests.value.map((item) => item.label)).toEqual(["Request r1"])
    const requestRef = requests.value[0]!.requestRef
    const before = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
    const pending = await request("sourcing-dossier-read", { requestRef })
    expect(pending.status).toBe(200)
    expect(await pending.json()).toMatchObject({ status: "ok", value: { comparison: null, documents: [{ state: "pending", evidence: { status: "extracted", ref: candidate.value.ref, value: 42, unit: "USD", version: candidate.value.ref.target.revision } }] } })
    const presentation = await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(candidate.value.ref) })
    expect(presentation.status).toBe(200)
    expect(await presentation.json()).toMatchObject({ status: "ok", value: { title: `terms.${source.extension}`, excerpt: "42", location: `text:${candidate.value.ref.target.segment.start}-${candidate.value.ref.target.segment.end}`, href: expect.stringContaining("/sucafina/procurement?asset=") } })
    expect(await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))).toBe(before)
    // This follows the default resolver's individual-Request fallback, including its exact approvalStage field allowlist.
    const individual = await fixture.uiCall("sf_request_read", { requestRef }, (call) => business.individual.issue("procurement-request", "r1", call))
    expect(individual.status).toBe("ok")
    if (individual.status !== "ok") throw new Error(individual.reason)
    const individualDossier = await request("sourcing-dossier-read", { requestRef: individual.value })
    expect(individualDossier.status).toBe(200)
    expect(await individualDossier.json()).toMatchObject({ value: { documents: [{ state: "pending", evidence: { ref: candidate.value.ref } }] } })
    const confirmation = await fixture.documentRequest("document-confirm", candidate.value)
    expect(confirmation.status).toBe(200)
    const confirmed = decodeSfOperationOutput("sf_document_extract", (await confirmation.json()).value)
    if (!confirmed.ok) throw new Error("Confirmed evidence schema failed")
    const confirmedRef = { ...candidate.value.ref, target: { ...candidate.value.ref.target, confirmationVersion: 1 }, refDigest: "" }
    confirmedRef.refDigest = digestSfEvidenceRef(confirmedRef)
    expect(confirmed.value.id).toBe(candidate.value.id)
    expect(confirmed.value.ref).toEqual(confirmedRef)
    expect(confirmed.value.ref.refDigest).not.toBe(candidate.value.ref.refDigest)
    const current = await request("sourcing-dossier-read", { requestRef })
    expect(current.status).toBe(200)
    expect(await current.json()).toMatchObject({ value: { documents: [{ state: "confirmed", evidence: { status: "confirmed", ref: confirmed.value.ref, value: 42 } }] } })
    const confirmedSource = await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(confirmed.value.ref) })
    expect(confirmedSource.status).toBe(200)
    expect(await confirmedSource.json()).toMatchObject({ status: "ok", value: { excerpt: "42" } })
    const other = await request("sourcing-dossier-read", { requestRef }, fixture.otherCookie)
    expect(other.status).toBe(403)
    const otherResult = await other.json() as { status: string }
    expect(otherResult.status).toBe("denied")
    expect(JSON.stringify(otherResult)).not.toContain(candidate.value.ref.refId)
    await fixture.store.transaction("procurement", async (_, blobs) => {
      await blobs.put("quote/r1/asset-r1", new TextEncoder().encode("Price: 99"), source.mediaType)
      return { commit: true, value: undefined }
    })
    const stale = await request("sourcing-dossier-read", { requestRef })
    expect(stale.status).toBe(200)
    expect(await stale.json()).toMatchObject({ status: "ok", value: { documents: [] } })
    const staleSource = await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(confirmed.value.ref) })
    expect(staleSource.status).toBe(409)
    expect(await staleSource.json()).toMatchObject({ status: "stale" })
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.assets = rows(snapshot.data.assets).filter((asset) => asset.id !== "asset-r1")
      object(object(object(object(snapshot.data.store).requests).r1).request).attachments = []
      return { commit: true, value: undefined }
    })
    const revoked = await request("sourcing-dossier-read", { requestRef })
    expect(revoked.status).toBe(200)
    expect(await revoked.json()).toMatchObject({ status: "ok", value: { documents: [] } })
    expect(await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: object(object(object(object(snapshot.data.store).requests).r1).request).status }))).toBe("sourcing")
  } finally { business.dispose(); await fixture.dispose() }
}, 120_000)

test.each(["source-change", "logout"] as const)("real sourcing dossier preserves Request proposal terms and refuses %s during its egress reread", async (change) => {
  const procurementEvidenceWrites = new WeakSet<object>()
  const fixture = await createWp06Runtime({ additionalOperations: ["sf_request_read", "sf_work_list"], procurementEvidenceWrites })
  const business = createSfBusinessServices({ authority: fixture.authority, persistence: fixture.store, proposalCoverageWrites: new WeakSet(), procurementEvidenceWrites, documentRead: fixture.documents.documents.reader })
  const dossier = createSfDossierServices({ runtime: fixture.runtime, authority: fixture.authority, business, documents: fixture.documents })
  if (!dossier) throw new Error("Dossier service did not compose")
  const request = async (service: NonNullable<typeof dossier>, mode: string, query: Record<string, string>) => {
    const url = new URL(`${fixture.origin}/sucafina/procurement`)
    url.searchParams.set("sf", mode)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await service.http(new Request(url, { headers: { cookie: fixture.cookie } }), "procurement")
    if (!response) throw new Error("Dossier route missing")
    return response
  }
  try {
    const initialized = await fixture.authority.state.transaction(fixture.request(), { namespace: "documents", expectedStorageVersion: 0,
      idempotencyKey: "dossier-empty-documents", commandDigest: digestSfValue({ purpose: "dossier-empty-documents" }),
      targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation },
    async () => ({ commit: true, value: true }))
    expect(initialized.status).toBe("ok")
    const settings = initialProcurementSettings()
    settings.fxRates = [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }]
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings, requests: { r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id,
        pr: { title: "Current commercial terms", estAmount: 32400 }, history: [], sourcing: {
          selectedId: "B", selectionJustification: "Recorded Request choice", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 },
          quotes: [
            { id: "A", supplier: "A", total: 32400, currency: "USD", techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] },
            { id: "B", supplier: "B", total: 28000, currency: "EUR", techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] },
          ],
        } } } } }
      return { commit: true, value: undefined }
    })
    const selections = await request(dossier, "sourcing-dossier-requests", { start: "2026-01-01", end: "2026-12-31" })
    expect(selections.status).toBe(200)
    const selected = await selections.json() as { value: { requestRef: string; label: string }[] }
    expect(selected.value.map((entry) => entry.label)).toEqual(["Request r1"])
    const requestRef = selected.value[0]!.requestRef
    const source = await fixture.uiCall("sf_request_read", { requestRef }, (context) => business.sourcingEvidence(requestRef, context))
    if (source.status !== "ok") throw new Error(`Current commercial source unavailable: ${source.reason}`)
    const before = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
    const response = await request(dossier, "sourcing-dossier-read", { requestRef })
    expect(response.status).toBe(200)
    const body: unknown = await response.json()
    const value = object(object(body).value)
    expect(value.sourcing).toEqual(source.value)
    expect(value.comparison).toEqual(source.value.comparison)
    expect(object(value.commercialSources).proposalTerms).toEqual({ status: "available", sourceRef: source.value.evidence,
      offers: source.value.offers, submittedBaseCurrency: "USD", submittedFx: [{ from: "EUR", rate: 1.08 }, { from: "USD", rate: 1 }] })
    expect(source.value.offers).toEqual([
      { offerRef: "A", version: source.value.evidence.target.version, amount: 32400, currency: "USD", technicalPass: true },
      { offerRef: "B", version: source.value.evidence.target.version, amount: 28000, currency: "EUR", technicalPass: true },
    ])
    expect(source.value.evidence.refId).toBe(requestRef)
    expect(source.value.comparison?.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeCloseTo(30240, 6)
    expect(object(value.request).version).toBe(source.value.evidence.target.version)
    expect(object(value.request).context).toEqual(source.value.context)
    expect(rows(object(value.request).values).length).toBeGreaterThan(0)
    expect(rows(object(value.request).values).every((entry) => digestSfValue(entry.sourceRefs) === digestSfValue([source.value.evidence]))).toBe(true)
    expect(object(value.commercialSources).supplierRegister).toEqual({ status: "not-selected" })
    expect(object(value.summary).ranking).toEqual(source.value.comparison?.ranking)
    expect(object(object(value.explanation).selection)).toMatchObject({ state: "recorded", proposalRef: "B", message: expect.stringContaining("Recorded Request choice") })
    expect(value.documents).toEqual([])
    expect(value.nextSteps).toContainEqual(expect.objectContaining({ kind: "select-document" }))
    expect(object(value.draft)).toMatchObject({ domainApplied: false, sourceRefs: [source.value.evidence], gaps: expect.arrayContaining(["document-evidence-unavailable"]) })
    expect(await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))).toBe(before)

    // Interleave a real persisted source edit or credential revocation at the
    // existing second read. All returned sourcing values still come from WP04.
    const progress = { reads: 0, changed: false }
    const fenced = createSfDossierServices({ runtime: fixture.runtime, authority: fixture.authority, documents: fixture.documents,
      business: { ...business, sourcingEvidence: async (ref, context) => {
        progress.reads += 1
        if (progress.reads === 2) {
          if (change === "source-change") await fixture.store.transaction("procurement", async (snapshot) => {
            const sourcing = object(object(object(object(object(snapshot.data.store).requests).r1).request).sourcing)
            rows(sourcing.quotes)[0]!.total = 99999
            return { commit: true, value: undefined }
          })
          if (change === "logout") {
            const logout = await fixture.identity.handle(new Request(`${fixture.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: fixture.cookie, origin: fixture.origin } }))
            expect(logout?.status).toBe(204)
          }
          progress.changed = true
        }
        return business.sourcingEvidence(ref, context)
      } },
    })
    if (!fenced) throw new Error("Fenced dossier service did not compose")
    const refused = await request(fenced, "sourcing-dossier-read", { requestRef })
    expect(progress).toEqual({ reads: 2, changed: true })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ status: "denied" })
    const after = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
    if (change === "logout") {
      expect(after).toBe(before)
      const revoked = await request(dossier, "sourcing-dossier-read", { requestRef })
      expect(revoked.status).toBe(403)
      expect(await revoked.json()).toEqual({ status: "denied" })
    }
    if (change === "source-change") {
      expect(after).not.toBe(before)
      const stale = await request(dossier, "sourcing-dossier-read", { requestRef })
      expect(stale.status).toBe(409)
      expect(await stale.json()).toEqual({ status: "stale" })
    }
  } finally { business.dispose(); await fixture.dispose() }
}, 120_000)
