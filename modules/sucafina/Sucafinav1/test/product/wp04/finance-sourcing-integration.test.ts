import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createSfSourcingInput, createSfSourcingVerifier } from "../../../../../../apps/cli/src/sucafina-product/analysis-verifier-procurement.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfContributionOutput, decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createSfProcurementSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createProcurementCapabilities } from "../../../product/procurement/capabilities.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementSourcingEvidence } from "../../../product/procurement/sourcing-evidence.ts"
import { createProcurementUiBindings } from "../../../product/procurement/ui-bindings.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"

test("sourcing comparison crosses the shared dispatcher with frozen money, criteria and a real UI receipt", async () => {
  const fixture = await sourcingFixture()
  try {
    const before = await fixture.requestMaterial()
    const result = await fixture.compare()
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("shared sourcing dispatch unavailable")
    const decoded = decodeSfOperationOutput("sf_sourcing_compare", result.result)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("closed comparison schema refused actual producer")
    expect(decodeSfContributionOutput("CommercialComparison", result.result).ok).toBe(true)
    expect(decoded.value.ranking).toEqual(["A", "B"])
    expect(decoded.value.weights?.technical).toBe(60)
    expect(decoded.value.weights?.commercial).toBe(40)
    expect(decoded.value.weights?.technicalCriteria).toHaveLength(5)
    expect(decoded.value.weights?.commercialCriteria).toHaveLength(3)
    const euro = decoded.value.proposals.find((proposal) => proposal.proposalRef === "B")
    expect(euro?.money).toEqual({ originalAmount: 28000, originalCurrency: "EUR", baseCurrency: "USD", fxRate: 1.08, fxSource: "submitted" })
    expect(euro?.convertedAmount).toBeCloseTo(30240, 6)
    expect(euro?.components?.overall).toBe(85)
    expect(decoded.value.proposals.find((proposal) => proposal.proposalRef === "A")?.score).toBeCloseTo(87.93333333333334, 10)
    expect(decoded.value.proposals.find((proposal) => proposal.proposalRef === "C")?.eligible).toBe(false)
    expect(decoded.value.selection).toEqual({ proposalRef: "A", reason: "Recorded technical preference" })
    expect(decoded.value.sourceRefs).toEqual([fixture.evidence])
    expect(result.receipt.kind).toBe("ui")
    if (result.receipt.kind !== "ui") throw new Error("UI receipt absent")
    expect(result.receipt.handlerExport).toBe("compareSourcing")
    expect(result.receipt.principalRef).toBe("buyer")
    expect(result.receipt.inputDigest).toBe(digestSfValue(fixture.payload))
    expect(result.receipt.resultDigest).toBe(digestSfValue(result.result))
    expect(await fixture.requestMaterial()).toEqual(before)

    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, actor: "forged" }).ok).toBe(false)
    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, proposals: decoded.value.proposals.map((proposal) => ({ ...proposal, money: { ...proposal.money, secret: "extra" } })) }).ok).toBe(false)
    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, weights: { ...decoded.value.weights, forgedWeight: 1 } }).ok).toBe(false)
    expect(decodeSfOperationOutput("sf_sourcing_compare", { ...decoded.value, proposals: decoded.value.proposals.map((proposal) => ({ ...proposal, score: Number.NaN })) }).ok).toBe(false)

    const call = await fixture.admit("sf_sourcing_compare", fixture.payload, false)
    expect((await fixture.dispatch({ ...fixture.payload, actor: "forged" }, call)).status).toBe("denied")
    expect((await fixture.dispatch(fixture.payload, call)).status).toBe("ok")
    expect((await fixture.dispatch(fixture.payload, call)).status).toBe("denied")
  } finally { await fixture.dispose() }
})

test("incomplete sourcing remains conditioned across the closed shared dispatcher and input verifier", async () => {
  for (const variant of ["missing-fx", "missing-assessment", "single-offer"] as const) {
    const fixture = await sourcingFixture(variant)
    try {
      const result = await fixture.compare()
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(`${variant}: sourcing dispatch unavailable`)
      const comparison = decodeSfOperationOutput("sf_sourcing_compare", result.result)
      if (!comparison.ok) throw new Error(`${variant}: closed comparison schema refused output`)
      expect(comparison.value.ranking).toEqual([])
      expect(comparison.value.proposals.every((proposal) => proposal.score === null)).toBe(true)
      expect(comparison.value.conditions.length).toBeGreaterThan(0)
      if (variant === "missing-fx") expect(comparison.value.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeNull()
      const input = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
      expect(input.status).toBe("ok")
      if (input.status !== "ok") throw new Error(`${variant}: explicit incomplete material unavailable`)
      expect((await fixture.verifier.verify(input.value, fixture.analysisRequest, fixture.issuer)).status).toBe("ok")
      if (variant === "missing-fx") expect(input.value.submittedFx.find((rate) => rate.from === "EUR")?.rate).toBeNull()
    } finally { await fixture.dispose() }
  }
})

test("sourcing verifier checks current weights, manual requirements, evidence and offer eligibility", async () => {
  const fixture = await sourcingFixture()
  try {
    const prepared = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
    if (prepared.status !== "ok") throw new Error("host sourcing input unavailable")
    const input = prepared.value
    expect(input.weightsAndEligibility).toHaveLength(10)
    expect(input.weightsAndEligibility.find((criterion) => criterion.criterionRef === '["procurement-sourcing-v1","technical",0,"Functional / technical fit"]')).toEqual({ criterionRef: '["procurement-sourcing-v1","technical",0,"Functional / technical fit"]', weight: 35, required: true, evidenceRefs: [fixture.evidence] })
    expect(input.weightsAndEligibility.find((criterion) => criterion.criterionRef === '["procurement-sourcing-v1","commercial",0,"Price (calculated — lowest offer scores highest)"]')?.required).toBe(false)
    expect((await fixture.verifier.verify(input, fixture.analysisRequest, fixture.issuer)).status).toBe("ok")
    const forged = [
      { ...input, weightsAndEligibility: [] },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 0 ? { ...criterion, weight: criterion.weight + 1 } : criterion) },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 2 ? { ...criterion, required: false } : criterion) },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 2 ? { ...criterion, criterionRef: input.weightsAndEligibility[0]!.criterionRef } : criterion) },
      { ...input, weightsAndEligibility: input.weightsAndEligibility.map((criterion, index) => index === 2 ? { ...criterion, evidenceRefs: [] } : criterion) },
      { ...input, authorizedOffers: input.authorizedOffers.map((offer, index) => index === 0 ? { ...offer, amount: 1 } : offer) },
      { ...input, submittedFx: input.submittedFx.map((rate) => rate.from === "EUR" ? { ...rate, rate: 2 } : rate) },
    ]
    for (const value of forged) expect((await fixture.verifier.verify(value, fixture.analysisRequest, fixture.issuer)).status).toBe("unavailable")
    expect((await fixture.verifier.verify({ ...input, authority: "forged" }, fixture.analysisRequest, fixture.issuer)).status).toBe("needs-input")

    await fixture.persistence.transaction("procurement", async (snapshot) => {
      const record = object(object(object(snapshot.data.store).requests)["PR-1"]).request
      const proposal = rows(object(object(record).sourcing).quotes).find((quote) => quote.id === "C")
      if (!proposal) throw new Error("noncompliant offer unavailable")
      proposal.techPass = true
      return { commit: true, value: undefined }
    })
    expect((await fixture.verifier.verify(input, fixture.analysisRequest, fixture.issuer)).status).toBe("unavailable")
    expect((await fixture.compare()).status).toBe("stale")
  } finally { await fixture.dispose() }
})

test("revoked sourcing authority cannot reuse a prepared input or a dispatched comparison", async () => {
  const fixture = await sourcingFixture()
  try {
    const input = await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)
    if (input.status !== "ok") throw new Error("host sourcing input unavailable")
    expect((await fixture.compare()).status).toBe("ok")
    fixture.revoke()
    expect((await fixture.compare()).status).toBe("denied")
    expect((await fixture.prepareInput(fixture.evidence.refId, fixture.issuer)).status).toBe("denied")
    expect((await fixture.verifier.verify(input.value, fixture.analysisRequest, fixture.issuer)).status).toBe("unavailable")
  } finally { await fixture.dispose() }
})

async function sourcingFixture(variant?: "missing-fx" | "missing-assessment" | "single-offer") {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-sourcing-dispatch-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: projectProcurementScope })
  await persistence.initializeSources("dashboard")
  await persistence.initializeSources("procurement")
  const settings = initialProcurementSettings()
  settings.fxRates = [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }]
  const quotes = [
    { id: "A", supplier: "A", total: 32400, currency: "USD", techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] },
    { id: "B", supplier: "B", total: 28000, currency: "EUR", techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] },
    { id: "C", supplier: "C", total: 29000, currency: "USD", techPass: false, scores: [5, 5, 5, 5, 5], cscores: [null, 5, 5] },
  ]
  if (variant === "missing-assessment") quotes[0]!.cscores[2] = null
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      requests: { "PR-1": { request: { number: "PR-1", createdBy: "buyer", status: "src_pending", pr: { title: "Sourcing comparison" }, sourcing: { selectedId: "A", selectionJustification: "Recorded technical preference", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: variant === "missing-fx" ? null : 1.08 }, quotes: variant === "single-offer" ? quotes.slice(0, 1) : quotes } }, version: 1, by: "buyer" } },
      settings, suppliers: [], issued: { pr: ["PR-1"], po: [] },
    }
    return { commit: true, value: undefined }
  })
  const access = { allowed: true }
  const authorized = (request: Request) => access.allowed && request.headers.get("authorization") === "Bearer buyer"
  const ui = createSfUiAuthority({
    authorize: async (request) => authorized(request) ? { installationId: "i", projectId: "p", principalRef: "buyer", accessRevision: "1", policyVersion: "1" } : undefined,
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now,
  })
  const request = new Request("https://local.invalid/procurement", { headers: { authorization: "Bearer buyer" } })
  const host: DomainPortHost = {
    persistence,
    requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
    revalidate: (call) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false),
    environment: async () => ({ at, directory: [], id: randomUUID }),
    authenticate: async (request) => authorized(request) ? { id: "buyer", canWrite: true, roles: [{ surface: "procurement", role: "buyer" }] } : null,
  }
  const admit = async (operation: string, payload: unknown, consume = true) => {
    const admitted = await ui.admit(request, operation, digestSfValue(payload))
    if (admitted.status !== "ok") throw new Error("UI admission unavailable")
    if (consume && !await ui.validate(admitted.value, operation, digestSfValue(payload))) throw new Error("UI intent unavailable")
    return admitted.value
  }
  const issuer = await admit("sf_request_read", { requestRef: "issuer" })
  const contextFor = async () => ({ status: "ok" as const, value: { installationId: "i", projectId: "p", principalRef: "buyer", accessRevision: "1", policyVersion: "1", surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
  const sources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
  const issued = await sources.issue("procurement-request", "PR-1", issuer)
  if (issued.status !== "ok") throw new Error("scoped request unavailable")
  const source = await sources.resolve(issued.value, issuer)
  if (source.status !== "ok") throw new Error("scoped evidence unavailable")
  const evidence = source.value.evidence
  const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-fixture-scope" })
  const sourceHost = { ...host, resolveRequestSource: sources.resolve, resolveSupplierSource: sources.resolve, isCurrentRequestSource: sources.isCurrent, isCurrentSupplierSource: sources.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable }
  const port = createProcurementPort(sourceHost)
  const authority: SfDomainValidation = {
    validateDomainContext: (call, operation, digest) => call.kind === "ui" ? ui.validate(call, operation, digest) : Promise.resolve(false),
    revalidateDomainContext: host.revalidate,
    receiptFor: (call, operation, digest, result) => call.kind === "ui" ? ui.receiptFor(call, operation, digest, result) : undefined,
  }
  const descriptors = createProcurementCapabilities({ port, authority })
  const dispatch = (payload: unknown, call: TrustedDomainContext) => dispatchSfCapability({ operation: "sf_sourcing_compare", payload, context: call, descriptors, authority,
    validateInput: (descriptor, value) => descriptor.id === "sf_sourcing_compare" && decodeSfOperationInput("sf_sourcing_compare", value).ok,
    validateOutput: (descriptor, value) => descriptor.id === "sf_sourcing_compare" && (value.status !== "ok" || decodeSfOperationOutput("sf_sourcing_compare", value.result).ok),
  })
  const bindings = createProcurementUiBindings({ authority: ui, dispatch: (_operation, payload, call) => dispatch(payload, call) })
  const payload = { requestRef: issued.value, proposalRefs: variant === "single-offer" ? ["A"] : ["A", "B", "C"], criteria: [...settings.criteria, ...settings.commCriteria].map((criterion) => criterion.name) }
  const resolveSource = createSfProcurementSourceAccess({ host, resolve: sources.resolve, procurement: port })
  const context = createSfBusinessContext({ revalidate: host.revalidate, resolveSource, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not requested by sourcing verification" }) })
  const state = createSfProductState({ persistence, createId: randomUUID,
    authorize: async (request) => authorized(request) ? { principalRef: "buyer", accessRevision: "1", policyVersion: "1" } : undefined,
    resolveTarget: async (request, _snapshot, _namespace, targetRef) => authorized(request) && targetRef === "cases-root" ? { incarnation: "cases-root-v1" } : undefined,
  })
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "cases-root", incarnation: "cases-root-v1" }, operationIdentity: (call) => call.kind === "ui" ? ui.operationIdentity(call) : undefined, authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call), evidence: context, createId: randomUUID, now: () => at })
  const draft = { objective: "Compare the recorded sourcing proposals", criteria: ["Technical fit", "Commercial terms"], horizon: period, currency: "USD", sourceRefs: [evidence] }
  const caseCall = await admit("sf_case_draft", draft)
  const created = await cases.draft(draft, caseCall)
  if (created.status !== "ok") throw new Error(`case draft unavailable: ${created.reason}`)
  const sourcingEvidence = createProcurementSourcingEvidence(sourceHost)
  const verifier = createSfSourcingVerifier({ cases, context, host, sourcingEvidence })
  const analysisRequest = { caseRef: { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }, profileId: "sf_procurement", profileVersion: "1.0.0", skillId: "sf-comparar-sourcing", skillVersion: "1.0.0", manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_sourcing_compare"], objective: draft.objective }
  return { persistence, issuer, evidence, payload, admit, dispatch, verifier, analysisRequest,
    compare: () => bindings.compareSourcing(request, payload), prepareInput: createSfSourcingInput({ sourcingEvidence }),
    revoke: () => { access.allowed = false },
    requestMaterial: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.store) })),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
