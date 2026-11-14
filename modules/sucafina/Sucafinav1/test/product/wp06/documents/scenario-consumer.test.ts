import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { uploadAsset } from "../../../../runtime/assets.ts"
import { object, rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { SfDocumentScenarioRequest, SfDocumentScenarioResult, SfDocumentScenarioTarget } from "../../../../product/documents/scenario-inputs.ts"
import { createSfDocumentScenarioHttp } from "../../../../product/interface/document-scenario-http.ts"
import { sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"
import atlasPackage from "../../../../../../../modules/atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }

test("a confirmed document amount reaches the real Planner scenario through HTTP without copying, applying or surviving source revocation", async () => {
  const root = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  const fixture = await createWp06Runtime({ additionalOperations: ["sf_scenario_simulate"], additionalHumanActions: ["planner.preview"] })
  const business = createSfBusinessServices({ authority: fixture.authority, persistence: fixture.store, proposalCoverageWrites: new WeakSet(), documentRead: fixture.documents.documents.reader })
  // Repository version metadata is real; the absent scanner is explicit and is not Atlas qualification.
  business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
    manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const service = business.documentScenarios
  if (!service) throw new Error("Document scenario service missing")
  const http = createSfDocumentScenarioHttp({ origin: fixture.origin, mount: "/sucafina", authority: fixture.authority, service })
  const send = async (mode: string, options: { ref?: Extract<BusinessEvidenceRef, { kind: "document" }>; body?: unknown; cookie?: string } = {}) => {
    const url = new URL(`${fixture.origin}/sucafina/procurement`)
    url.searchParams.set("sf", mode)
    if (options.ref) url.searchParams.set("ref", JSON.stringify(options.ref))
    const request = new Request(url, options.body === undefined ? { headers: { cookie: options.cookie ?? fixture.cookie } } : {
      method: "POST", headers: { cookie: options.cookie ?? fixture.cookie, origin: fixture.origin, "content-type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify(options.body),
    })
    const response = await http(request, "procurement")
    if (!response) throw new Error("Document scenario route missing")
    return response
  }
  const official = () => fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue({ versions: snapshot.data.versions, officials: snapshot.data.officials }) }))
  const upload = () => fixture.store.transaction("procurement", async (snapshot, blobs) => {
    const value = await uploadAsset(snapshot, blobs, { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] },
      { page: "Requests", action: "upload", id: "r1", version: snapshot.versions["requests:r1"]?.version ?? 0, values: {} },
      { at: fixture.at, id: () => "quote-1", directory: [] }, fixture.runtime.assets.services, "quote", { name: "scenario.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 42") })
    return { commit: value.ok, value }
  })
  try {
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: { r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id, pr: { title: "Scenario source" }, history: [] } } } }
      return { commit: true, value: undefined }
    })
    await fixture.store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "Scenario baseline", year: 2027, closed: 0, locked: false,
        lines: [{ id: "opex", sec: "opex", el: "licenses", name: "Existing license", desc: "", cur: "USD", proj: "", owner: "", entity: "", alloc: "", annual: 1200,
          b: Array(12).fill(100), bm: Array(12).fill(false), a: Array(12).fill(null), f: Array(12).fill(null) }], projects: [], fx: [],
        hc: { positions: [], rates: [], hrAF: {}, inc: 0, incMonth: 1 }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      return { commit: true, value: undefined }
    })
    expect((await upload()).ok).toBe(true)
    const discovered = await fixture.documentRequest("document-sources")
    expect(discovered.status).toBe(200)
    const sources = await discovered.json() as { value: { selectionRef: string }[] }
    expect(sources.value).toHaveLength(1)
    const admitted = await fixture.documentRequest("document-admit", { selectionRef: sources.value[0]!.selectionRef })
    expect(admitted.status).toBe(200)
    const documentRef = ((await admitted.json()) as { value: { documentRef: string } }).value.documentRef
    const schema = await fixture.documentRequest("document-schema", { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })
    expect(schema.status).toBe(200)
    const fieldSchemaRef = ((await schema.json()) as { value: { ref: string } }).value.ref
    const extraction = await fixture.documentRequest("document-extract", { documentRef, fieldSchemaRef })
    expect(extraction.status).toBe(200)
    const candidate = decodeSfOperationOutput("sf_document_extract", (await extraction.json()).value)
    if (!candidate.ok) throw new Error("Candidate schema failed")
    const pending = await send("document-scenario-targets", { ref: candidate.value.ref })
    expect(pending.status).toBe(400)
    expect(await pending.json()).toEqual({ status: "needs-input", reason: "confirmed-document-required" })
    const confirmation = await fixture.documentRequest("document-confirm", candidate.value)
    expect(confirmation.status).toBe(200)
    const confirmed = decodeSfOperationOutput("sf_document_extract", (await confirmation.json()).value)
    if (!confirmed.ok) throw new Error("Confirmed document schema failed")
    expect(confirmed.value.ref.refId).toBe(candidate.value.ref.refId)
    expect(confirmed.value.ref.target).toEqual({ ...candidate.value.ref.target, confirmationVersion: 1 })
    expect(confirmed.value.ref.refDigest).not.toBe(candidate.value.ref.refDigest)
    const list = await send("document-scenario-targets", { ref: confirmed.value.ref })
    expect(list.status).toBe(200)
    const targets = await list.json() as { value: SfDocumentScenarioTarget[] }
    const target = targets.value.find((value) => value.targetRef === "opex:1")
    if (!target) throw new Error("Authorized January destination missing")
    const input: SfDocumentScenarioRequest = { documentRef: confirmed.value.ref, baseRef: target.baseRef, targetRef: target.targetRef, period: target.period }
    expect(input).not.toHaveProperty("amount")
    const page = await send("document-scenario", { ref: confirmed.value.ref })
    expect(page.status).toBe(200)
    expect(page.headers.get("content-security-policy")).toContain("sha256-")
    expect(await page.text()).toContain("Preview scenario")
    const before = await official()
    const direct = await fixture.uiCall("sf_scenario_simulate", input, (context) => service.preview(input, context))
    expect(direct).toEqual({ status: "denied", reason: "document-scenario-human-authority-required" })
    const result = await send("document-scenario-preview", { body: input })
    expect(result.status).toBe(200)
    const observed = await result.json() as { value: SfDocumentScenarioResult }
    expect(observed.value.domainApplied).toBe(false)
    expect(observed.value.request.operations).toEqual([{ kind: "replace", targetRef: "opex:1", amount: 42, currency: "USD", period: { start: "2027-01-01", end: "2027-01-31" } }])
    expect(observed.value.request.assumptions).toEqual([{ id: `document:${confirmed.value.id}`, value: 42, evidenceRefs: [confirmed.value.ref], state: "confirmed" }])
    expect(observed.value.evidence.ref).toEqual(confirmed.value.ref)
    expect(observed.value.scenario.sourceRefs).toContainEqual(confirmed.value.ref)
    expect(observed.value.scenario.components.find((value) => value.id === "opex:1")).toMatchObject({ amount: 42, currency: "USD", evidenceState: "hypothetical" })
    expect(observed.value.scenario).toMatchObject({ comparisonStatus: "conditioned", knownSubtotal: 1142, total: null, costCoverage: { coverageState: "pending" } })
    expect(observed.value.scenario.costCoverage.issues).toContain("inventory-unavailable")
    expect(observed.value.scenario.restrictions).toContain("preview-not-applied")
    expect(await official()).toBe(before)
    expect((await send("document-scenario-preview", { body: { ...input, amount: 999 } })).status).toBe(400)
    expect((await send("document-scenario-preview", { body: input, cookie: "" })).status).toBe(403)
    const other = await send("document-scenario-preview", { body: input, cookie: fixture.otherCookie })
    expect([403, 409]).toContain(other.status)
    const otherValue = await other.json() as { status: string; value?: unknown }
    expect(["denied", "stale"]).toContain(otherValue.status)
    expect(otherValue.value).toBeUndefined()
    await fixture.store.transaction("planner", async (snapshot) => { rows(rows(snapshot.data.versions)[0]!.lines)[0]!.name = "Changed destination"; return { commit: true, value: undefined } })
    const changed = await send("document-scenario-preview", { body: input })
    expect(changed.status).toBe(409)
    expect((await changed.json()).status).toBe("stale")
    const latestList = await send("document-scenario-targets", { ref: confirmed.value.ref })
    expect(latestList.status).toBe(200)
    const currentTarget = ((await latestList.json()) as { value: SfDocumentScenarioTarget[] }).value.find((value) => value.targetRef === "opex:1")
    if (!currentTarget) throw new Error("Current destination missing")
    const currentInput = { ...input, baseRef: currentTarget.baseRef }
    const changedOfficial = await official()
    await fixture.store.transaction("procurement", async (_, blobs) => { await blobs.put("quote/r1/quote-1", new TextEncoder().encode("Price: 99"), "text/plain"); return { commit: true, value: undefined } })
    const stale = await send("document-scenario-preview", { body: currentInput })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ status: "stale", reason: "document-scenario-source-changed" })
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.assets = rows(snapshot.data.assets).filter((asset) => asset.id !== "quote-1")
      object(object(object(object(snapshot.data.store).requests).r1).request).attachments = []
      return { commit: true, value: undefined }
    })
    const revoked = await send("document-scenario-preview", { body: currentInput })
    expect([403, 409]).toContain(revoked.status)
    const revokedValue = await revoked.json() as { status: string; reason: string; value?: unknown }
    expect(["denied", "stale"]).toContain(revokedValue.status)
    expect(revokedValue.reason).toBe("document-scenario-source-changed")
    expect(revokedValue.value).toBeUndefined()
    expect((await upload()).ok).toBe(true)
    const replacedIdentity = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "quote-1") }))
    expect(replacedIdentity?.incarnation).not.toBe(confirmed.value.ref.target.incarnation)
    const replaced = await send("document-scenario-preview", { body: currentInput })
    expect(replaced.status).toBe(409)
    expect(await replaced.json()).toEqual({ status: "stale", reason: "document-scenario-source-changed" })
    expect(await official()).toBe(changedOfficial)
  } finally { business.dispose(); await fixture.dispose() }
}, 180_000)
