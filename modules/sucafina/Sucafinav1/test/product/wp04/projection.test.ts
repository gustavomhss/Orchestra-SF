import { expect, test } from "bun:test"
import { projectProcurementSource } from "../../../product/procurement/port.ts"
import { digestProcurementSource } from "../../../product/procurement/sources.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import { domain } from "../../../runtime/procurement.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const context: ProductContext = { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement", period, currency: "USD", sourceRefs: [], capabilities: [] }
const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "r", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "PR-1", incarnation: "one", version: 4, fields: ["status", "holder", "stageEnteredAt", "baseAmount"], projectionDigest: "digest" } }


function currentRef(snapshot: Snapshot, ref: typeof evidence, role: string) {
  const data = domain.view(snapshot, { id: "a", canWrite: true, roles: [role] }, { at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }).data
  const collection = ref.target.recordType === "procurement-supplier" ? data.suppliers : data.requests
  const record = (collection as Record<string, unknown>[]).find((row) => (ref.target.recordType === "procurement-supplier" ? row.id : row.number) === ref.target.recordId)
  const result = { ...ref, target: { ...ref.target, projectionDigest: digestProcurementSource(record, data.formSettings) } }
  return { ...result, refDigest: digestSfEvidenceRef(result) }
}

test("queue projection uses the latest submission, never a later save", () => {
  const projection = projectProcurementSource({ status: "pr_pending", value: 100, prApproval: { steps: [{ status: "pending", holderId: "holder" }] }, history: [{ action: "Requisition submitted for approval", at: "2026-01-01" }, { action: "Requisition rejected", at: "2026-01-02" }, { action: "Requisition submitted for approval", at: "2026-01-03" }, { action: "Saved", at: "2026-01-04" }] }, context, evidence)
  expect(projection.values.find((value) => value.id === "stageEnteredAt")?.value).toBe("2026-01-03")
  expect(projection.values.find((value) => value.id === "holder")?.value).toBe("holder")
})

test("missing history and holder stay unavailable, and restricted fields are omitted", () => {
  const record = { status: "pr_pending", value: null, prApproval: { steps: [{ status: "pending", holderId: null }] }, history: [] }
  const projection = projectProcurementSource(record, context, evidence)
  expect(projection.missing).toContainEqual({ field: "stageEnteredAt", reason: "unavailable" })
  expect(projection.missing).toContainEqual({ field: "holder", reason: "missing" })
  const restricted = projectProcurementSource(record, context, { ...evidence, target: { ...evidence.target, fields: ["status"] } })
  expect(restricted.values.map((value) => value.id)).toEqual(["status"])
  expect(restricted.missing).toEqual([])
})

test("requisition drafts and revisions expose their saved justification in the authorized projection", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["reason"] } }
  for (const status of ["draft", "pr_rejected"]) {
    const projection = projectProcurementSource({ status, pr: { justification: "Business reason" } }, context, ref)
    expect(projection.values[0]).toMatchObject({ id: "reason", value: "Business reason", evidenceState: "confirmed" })
  }
})

test("port authenticates against the current snapshot and does not reveal another request", async () => {
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { digestSfEvidenceRef } = await import("../../../product/contracts/canonical.ts")
  const snapshot = { data: { store: { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "other", pr: { estAmount: 100 } }, version: 4, by: "other" } }, settings: { currency: "USD" }, suppliers: [] } }, versions: { "requests:PR-1": { version: 4, by: "other" } }, sequences: {}, audit: [], notices: [] }
  const source = { ...evidence, refDigest: digestSfEvidenceRef(evidence) }
  const request = new Request("https://local.invalid/procurement")
  const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedDomainContext
  const port = createProcurementPort({
    requestFor: () => request,
    revalidate: async () => true,
    environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement", role: "requester" }] }),
    persistence: { transaction: async (_surface, work) => (await work(structuredClone(snapshot))).value },
    resolveRequestSource: async () => ({ status: "ok", value: { evidence: source, context } }),
    isCurrentRequestSource: () => true,
    resolveRequestCollection: async () => ({ status: "unavailable", reason: "not used" }),
    isCurrentRequestCollection: () => false,
    resolveSupplierSource: async () => ({ status: "unavailable", reason: "not used" }),
    isCurrentSupplierSource: () => false,
    readContractSource: async () => ({ status: "unavailable", reason: "not used" }),
  })
  expect(await port.read({ requestRef: "r" }, binding)).toEqual({ status: "unavailable", reason: "Request unavailable" })
})

test("aging uses the trusted observation time and leaves unproven ages unavailable", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["status", "ageDays"] } }
  const record = { status: "pr_pending", prApproval: { steps: [{ status: "pending", holderId: "a" }] }, history: [{ action: "Requisition submitted for approval", at: "2026-01-01T00:00:00Z" }, { action: "Saved", at: "2026-01-02T00:00:00Z" }] }
  expect(projectProcurementSource(record, context, ref, "2026-01-04T00:00:00Z").values.find((value) => value.id === "ageDays")?.value).toBe(3)
  const unknown = projectProcurementSource({ ...record, history: [] }, context, ref, "2026-01-04T00:00:00Z")
  expect(unknown.values.find((value) => value.id === "ageDays")?.value).toBeNull()
  expect(unknown.missing).toContainEqual({ field: "ageDays", reason: "unavailable" })
  expect(projectProcurementSource({ ...record, prApproval: { steps: [] } }, context, ref, "2026-01-04T00:00:00Z").values.find((value) => value.id === "ageDays")?.value).toBeNull()
  expect(projectProcurementSource({ ...record, history: [{ action: "Requisition submitted for approval", at: "invalid" }] }, context, ref, "2026-01-04T00:00:00Z").values.find((value) => value.id === "ageDays")?.value).toBeNull()
  expect(projectProcurementSource({ ...record, history: [{ action: "Requisition submitted for approval", at: "2026-02-31T00:00:00Z" }] }, context, ref, "2026-03-04T00:00:00Z").values.find((value) => value.id === "ageDays")?.value).toBeNull()
})

test("sourcing comparison reads the authorized request and uses frozen FX", async () => {
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { digestSfEvidenceRef } = await import("../../../product/contracts/canonical.ts")
  const { initialProcurementSettings } = await import("../../../src/initial-settings.ts")
  const reference = { ...evidence, target: { ...evidence.target, fields: ["sourcing"], period } }
  const settings = initialProcurementSettings()
  settings.fxRates = [{ code: "EUR", rate: 2 }]
  const snapshot = { data: { store: { requests: { "PR-1": { request: { number: "PR-1", status: "src_pending", createdBy: "a", sourcing: { approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 }, quotes: [{ id: "A", supplier: "A", total: 32400, currency: "USD", techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] }, { id: "B", supplier: "B", total: 28000, currency: "EUR", techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] }] } }, version: 4, by: "a" } }, settings, suppliers: [] } }, versions: { "requests:PR-1": { version: 4, by: "a" } }, sequences: {}, audit: [], notices: [] }
  const source = currentRef(snapshot, reference, "buyer")
  const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedDomainContext
  const host = {
    requestFor: () => new Request("https://local.invalid/procurement"), revalidate: async () => true,
    environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: "buyer" }] }),
    persistence: { transaction: async (_surface, work) => (await work(structuredClone(snapshot))).value },
    resolveRequestSource: async () => ({ status: "ok" as const, value: { evidence: source, context } }), isCurrentRequestSource: () => true,
    resolveRequestCollection: async () => ({ status: "unavailable" as const, reason: "not used" }), isCurrentRequestCollection: () => false,
    resolveSupplierSource: async () => ({ status: "unavailable" as const, reason: "not used" }), isCurrentSupplierSource: () => false,
    readContractSource: async () => ({ status: "unavailable" as const, reason: "not used" }),
  } satisfies import("../../../product/procurement/port.ts").ProcurementSourceHost
  const port = createProcurementPort(host)
  const result = await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.ranking).toEqual(["A", "B"])
  expect(result.value.proposals.find((quote) => quote.proposalRef === "B")?.convertedAmount).toBeCloseTo(30240, 6)
  expect(result.value.proposals.find((quote) => quote.proposalRef === "A")?.score).toBeCloseTo(87.933333, 4)
  const { createProcurementSourcingEvidence } = await import("../../../product/procurement/sourcing-evidence.ts")
  const facts = await createProcurementSourcingEvidence(host)("r", binding)
  expect(facts).toMatchObject({ status: "ok", value: { stage: "src_pending", submittedBaseCurrency: "USD", submittedFx: expect.arrayContaining([{ from: "EUR", rate: 1.08 }]), offers: expect.arrayContaining([expect.objectContaining({ offerRef: "B", amount: 28000, currency: "EUR", version: 4 })]), weights: { technical: 60, commercial: 40 }, comparison: { ranking: ["A", "B"] } } })
  expect((await createProcurementSourcingEvidence(host)("forged", binding)).status).toBe("denied")
  const missingCurrency = structuredClone(snapshot)
  missingCurrency.data.store.requests["PR-1"].request.sourcing.quotes[1]!.currency = ""
  const incompleteHost = { ...host, persistence: { transaction: async (_surface, work) => (await work(structuredClone(missingCurrency))).value }, resolveRequestSource: async () => ({ status: "ok" as const, value: { evidence: currentRef(missingCurrency, reference, "buyer"), context } }) } satisfies import("../../../product/procurement/port.ts").ProcurementSourceHost
  const missingFacts = await createProcurementSourcingEvidence(incompleteHost)("r", binding)
  expect(missingFacts).toMatchObject({ status: "ok", value: { offers: expect.arrayContaining([expect.objectContaining({ offerRef: "B", currency: null })]) } })
  const configured = [...settings.criteria, ...settings.commCriteria].map((criterion) => criterion.name)
  expect((await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: configured }, binding)).status).toBe("ok")
  expect((await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: ["invented"] }, binding)).status).toBe("needs-input")
  settings.criteria = []
  const incomplete = await port.compareSourcing({ requestRef: "r", proposalRefs: ["A", "B"], criteria: [] }, binding)
  expect(incomplete.status).toBe("stale")
  expect((await createProcurementSourcingEvidence(host)("r", binding)).status).toBe("stale")
})

test("stock counts open stages only and retains a stage-specific drilldown", async () => {
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { digestSfEvidenceRef } = await import("../../../product/contracts/canonical.ts")
  const makeRef = (id: string, type: string, fields: string[]) => {
    const ref = { ...evidence, refId: id, target: { ...evidence.target, recordId: id, recordType: type, fields } }
    return { ...ref, refDigest: digestSfEvidenceRef(ref) }
  }
  const selection = makeRef("selection", "procurement-request-selection", ["status"])
  const stage = makeRef("draft-selection", "procurement-request-selection", ["status"])
  const snapshot = { data: { store: { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "a" }, version: 4, by: "a" }, "PR-2": { request: { number: "PR-2", status: "po_issued", createdBy: "a" }, version: 4, by: "a" } }, settings: { currency: "USD" }, suppliers: [] } }, versions: { "requests:PR-1": { version: 4, by: "a" }, "requests:PR-2": { version: 4, by: "a" } }, sequences: {}, audit: [], notices: [] }
  const openRef = currentRef(snapshot, makeRef("PR-1", "procurement-request", ["status", "ageDays"]), "buyer")
  const closedRef = currentRef(snapshot, makeRef("PR-2", "procurement-request", ["status"]), "buyer")
  const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedDomainContext
  const port = createProcurementPort({
    requestFor: () => new Request("https://local.invalid/procurement"), revalidate: async () => true,
    environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement", role: "buyer" }] }),
    persistence: { transaction: async (_surface, work) => (await work(structuredClone(snapshot))).value },
    resolveRequestSource: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestSource: () => true,
    resolveRequestCollection: async () => ({ status: "ok", value: { context, selection, statusSelections: { draft: stage }, requests: [openRef, closedRef] } }), isCurrentRequestCollection: () => true,
    resolveSupplierSource: async () => ({ status: "unavailable", reason: "not used" }), isCurrentSupplierSource: () => false,
    readContractSource: async () => ({ status: "unavailable", reason: "not used" }),
  })
  const result = await port.list("selection", binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.stock.values.map((value) => [value.id, value.value, value.drilldown?.refId])).toEqual([["stock:draft", 1, "draft-selection"]])
  expect(result.value.queue.map((item) => item.values.find((value) => value.id === "status")?.value)).toEqual(["draft", "po_issued"])
  expect(result.value.queue.map((item) => item.values.find((value) => value.id === "status")?.drilldown?.refId)).toEqual(["PR-1", "PR-2"])
})

test("aging for the next holder starts at the preceding approval, or remains unavailable without that event", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["ageDays"] } }
  const record = { status: "pr_pending", prApproval: { steps: [{ levelName: "First", status: "approved" }, { levelName: "Second", status: "pending", holderId: "b" }] }, history: [{ action: "Requisition submitted for approval", at: "2026-01-01T00:00:00Z" }, { action: "Requisition approved by First", at: "2026-01-03T00:00:00Z" }, { action: "Saved", at: "2026-01-04T00:00:00Z" }] }
  expect(projectProcurementSource(record, context, ref, "2026-01-05T00:00:00Z").values[0]?.value).toBe(2)
  const missing = projectProcurementSource({ ...record, history: [record.history[0]] }, context, ref, "2026-01-05T00:00:00Z")
  expect(missing.values[0]?.value).toBeNull()
})

test("supplier projection returns authorized fields and refuses bank fields", async () => {
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { digestSfEvidenceRef } = await import("../../../product/contracts/canonical.ts")
  const ref = { ...evidence, target: { ...evidence.target, recordType: "procurement-supplier", recordId: "sup-1", fields: ["legalName", "iban"] } }
  const snapshot = { data: { store: { requests: {}, settings: { currency: "USD" }, suppliers: [{ id: "sup-1", legalName: "Supplier", iban: "secret" }] } }, versions: { "suppliers:sup-1": { version: 4, by: "a" } }, sequences: {}, audit: [], notices: [] }
  const source = currentRef(snapshot, ref, "buyer")
  const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedDomainContext
  const identity = { role: "buyer" }
  const port = createProcurementPort({
    requestFor: () => new Request("https://local.invalid/procurement"), revalidate: async () => true,
    environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement", role: identity.role }] }),
    persistence: { transaction: async (_surface, work) => (await work(structuredClone(snapshot))).value },
    resolveRequestSource: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestSource: () => false,
    resolveRequestCollection: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestCollection: () => false,
    resolveSupplierSource: async () => ({ status: "ok", value: { evidence: source, context } }), isCurrentSupplierSource: () => true,
    readContractSource: async () => ({ status: "unavailable", reason: "not used" }),
  })
  const result = await port.readSupplier({ supplierRef: "s", fields: ["legalName"] }, binding)
  expect(result.status).toBe("ok")
  expect(JSON.stringify(result)).not.toContain("secret")
  expect(await port.readSupplier({ supplierRef: "s", fields: ["iban"] }, binding)).toMatchObject({ status: "denied" })
  identity.role = "unrecognized"
  expect(await port.readSupplier({ supplierRef: "s", fields: ["legalName"] }, binding)).toMatchObject({ status: "denied" })
})

test("decision preparation is deterministic and does not change the request", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["subject", "reason", "nextStep"] } }
  const record = { status: "src_pending", pr: { title: "Renewal" }, sourcing: { selectionJustification: "Delivery condition" } }
  const before = structuredClone(record)
  const first = projectProcurementSource(record, context, ref)
  expect(projectProcurementSource(record, context, ref)).toEqual(first)
  expect(first.values.map((value) => [value.id, value.value])).toEqual([["subject", "Renewal"], ["reason", "Delivery condition"], ["nextStep", "PO draft after all approvals"]])
  expect(record).toEqual(before)
  expect(projectProcurementSource({ status: "po_approved" }, context, { ...ref, target: { ...ref.target, fields: ["nextStep"] } }).values[0]?.value).toBe("Issue purchase order internally")
})

test("revocation during the domain read prevents returning the projection", async () => {
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { digestSfEvidenceRef } = await import("../../../product/contracts/canonical.ts")
  const snapshot = { data: { store: { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "a", pr: { estAmount: 100 } }, version: 4, by: "a" } }, settings: { currency: "USD" }, suppliers: [] } }, versions: { "requests:PR-1": { version: 4, by: "a" } }, sequences: {}, audit: [], notices: [] }
  const source = currentRef(snapshot, evidence, "requester")
  const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", requestId: "r", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedDomainContext
  const access = { active: true }
  const port = createProcurementPort({
    requestFor: () => new Request("https://local.invalid/procurement"), revalidate: async () => access.active,
    environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: () => "unused" }),
    authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement", role: "requester" }] }),
    persistence: { transaction: async (_surface, work) => { const result = await work(structuredClone(snapshot)); access.active = false; return result.value } },
    resolveRequestSource: async () => ({ status: "ok", value: { evidence: source, context } }), isCurrentRequestSource: () => true,
    resolveRequestCollection: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestCollection: () => false,
    resolveSupplierSource: async () => ({ status: "unavailable", reason: "not used" }), isCurrentSupplierSource: () => false,
    readContractSource: async () => ({ status: "unavailable", reason: "not used" }),
  })
  expect(await port.read({ requestRef: "r" }, binding)).toEqual({ status: "denied", reason: "Current authority unavailable" })
})

test("projection reports PO original amount and submitted FX without replacing the base value", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["originalAmount", "originalCurrency", "fxRate", "fxSource", "baseAmount", "monetaryState"] } }
  const projection = projectProcurementSource({ status: "po_approved", value: 30240, po: { currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", lines: [{ qty: 1, unitPrice: 28000 }] } }, context, ref, "2026-01-01T00:00:00Z", { fxRates: [{ code: "EUR", rate: 2 }] })
  expect(Object.fromEntries(projection.values.map((value) => [value.id, value.value]))).toEqual({ baseAmount: 30240, originalAmount: 28000, originalCurrency: "EUR", fxRate: 1.08, fxSource: "submitted", monetaryState: "approved" })
  const historical = projectProcurementSource({ status: "po_approved", value: null, po: { currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", approval: { amount: 30240 }, lines: [{ qty: 1, unitPrice: 28000 }] } }, { ...context, currency: "EUR" }, { ...ref, target: { ...ref.target, fields: ["baseAmount", "submittedAmount", "submittedCurrency", "submittedFxRate"] } })
  expect(Object.fromEntries(historical.values.map((value) => [value.id, value.value]))).toEqual({ baseAmount: null, submittedAmount: 30240, submittedCurrency: "USD", submittedFxRate: 1.08 })
})

test("a legacy PO with no currency identifies the base default as an estimate", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["baseAmount", "originalCurrency", "fxSource"] } }
  const projection = projectProcurementSource({ status: "po_draft", value: 100, po: { lines: [{ qty: 1, unitPrice: 100 }] } }, context, ref)
  expect(projection.values.find((value) => value.id === "fxSource")?.value).toBe("base-default")
  expect(projection.values.find((value) => value.id === "baseAmount")?.evidenceState).toBe("estimated")
  expect(projection.missing).toContainEqual({ field: "originalCurrency", reason: "missing" })
})

test("unrecognized imported status stays explicitly unavailable", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["status", "monetaryState"] } }
  const projection = projectProcurementSource({ status: "unrecognized" }, context, ref)
  expect(projection.values.map((value) => value.value)).toEqual([null, null])
  expect(projection.missing).toContainEqual({ field: "status", reason: "unavailable" })
})

test("approval stage is the current pending level and is scoped to its evidence", () => {
  const ref = { ...evidence, target: { ...evidence.target, fields: ["approvalStage"] } }
  const record = { status: "pr_pending", prApproval: { steps: [{ status: "approved", levelName: "First" }, { status: "pending", holderId: "b", levelName: "Finance" }] } }
  const projection = projectProcurementSource(record, context, ref)
  expect(projection.values).toMatchObject([{ id: "approvalStage", value: "Finance", sourceRefs: [ref], evidenceState: "confirmed" }])
  const missing = projectProcurementSource({ ...record, prApproval: { steps: [{ status: "pending" }] } }, context, ref)
  expect(missing.values[0]).toMatchObject({ id: "approvalStage", value: null, evidenceState: "absent" })
  expect(missing.missing).toContainEqual({ field: "approvalStage", reason: "missing" })
})
