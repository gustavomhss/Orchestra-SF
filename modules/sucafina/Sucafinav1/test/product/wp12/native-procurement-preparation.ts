import { expect } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CostCoverageBasis, CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../product/contracts/operations.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { initializeWp12ScenarioSources, WP12_SCENARIO_PERIOD } from "./native-scenario-preparation.ts"

export const WP12_PROCUREMENT_REQUEST_ID = "WP12-PURCHASE-1"
export const WP12_CONTRACT_ID = "wp12-native-contract"

export async function initializeWp12ProcurementSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await initializeWp12ScenarioSources(persistence)
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      settings: { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }], minQuotes: 2, techWeight: 80, commWeight: 20,
        criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: [{ id: "wp12-purchase-supplier-a", number: "WP12-A", legalName: "Synthetic supplier A", status: "active", categories: [], taxId: "SYNTHETIC-A" },
        { id: "wp12-purchase-supplier-b", number: "WP12-B", legalName: "Synthetic supplier B", status: "active", categories: [], taxId: "SYNTHETIC-B" }],
      requests: { [WP12_PROCUREMENT_REQUEST_ID]: { version: 1, by: "wp12-fixture-owner", request: {
        number: WP12_PROCUREMENT_REQUEST_ID, status: "src_pending", createdBy: "wp12-fixture-owner", createdAt: "2027-01-01T00:00:00.000Z",
        pr: { title: "Synthetic service purchase", type: "service", description: "Explicit domain fixture for a renewal decision",
          estAmount: 140, costCenter: "WP12", needBy: "2027-12-31", justification: "Evaluate recorded offers", recurring: false },
        sourcing: { evaluator: "wp12-fixture-owner", selectedId: null, approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1 }, quotes: [
          { id: "wp12-offer-a", supplier: "Synthetic supplier A", supplierId: "wp12-purchase-supplier-a", currency: "EUR", total: 100, techPass: true, scores: [1], cscores: [] },
          { id: "wp12-offer-b", supplier: "Synthetic supplier B", supplierId: "wp12-purchase-supplier-b", currency: "USD", total: 140, techPass: true, scores: [5], cscores: [] },
        ] },
      } } },
    }
    return { commit: true, value: undefined }
  })
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.contracts = [{ id: WP12_CONTRACT_ID, num: "WP12-CONTRACT-1", vendor: "Synthetic supplier A", name: "Service agreement",
      desc: "Explicit synthetic persisted contract", start: "2027-01-01", end: "2027-12-31", amount: 240_000, currency: "USD", notice: null, docs: [] }]
    return { commit: true, value: undefined }
  })
}

export async function selectWp12ProcurementPeriod(context: Wp12NativeMissionContext) {
  const intent = { purpose: "work-selection", period: WP12_SCENARIO_PERIOD }
  const select = context.services.procurementSelections
  if (!select) throw new Error("The real Procurement selection registry is missing")
  for (const invoke of [select.create, context.business.procurementSelections.create]) {
    const selected = await context.ui("sf_work_list", intent, (call) => invoke(call, WP12_SCENARIO_PERIOD))
    if (selected.status !== "ok") throw new Error(`Procurement period selection failed: ${selected.reason}`)
  }
}

export async function issueWp12Contract(context: Wp12NativeMissionContext) {
  const observedAt = new Date(context.at)
  if (!Number.isFinite(observedAt.getTime())) throw new Error("The host contract observation time is invalid")
  // Dashboard contracts are current record snapshots. Their observation period
  // follows the actual host clock; the financial decision horizon stays in 2027.
  const observedYear = observedAt.getUTCFullYear()
  const observationPeriod = { start: `${observedYear}-01-01`, end: `${observedYear}-12-31` }
  const selected = { id: WP12_CONTRACT_ID, fields: ["name", "amount", "currency", "notice"], period: observationPeriod }
  return context.ui("sf_contract_read", selected, async (call) => {
    const issued = await context.business.contracts.issueContract(selected, call)
    if (issued.status !== "ok") throw new Error(`Actual contract source issuance failed: ${issued.reason}`)
    const read = await context.business.procurement.readContract({ contractRef: issued.value, fields: selected.fields }, call)
    if (read.status !== "ok") throw new Error(`Actual contract source read failed: ${read.reason}`)
    const refs = read.value.values.flatMap((value) => value.sourceRefs).filter((ref, index, all) =>
      all.findIndex((other) => digestSfValue(ref) === digestSfValue(other)) === index)
    if (refs.length !== 1 || refs[0]?.kind !== "record" || refs[0].refId !== issued.value) throw new Error("The contract projection has no unique real source")
    expect(refs[0].target.surface).toBe("dashboard")
    expect(refs[0].target.recordType).toBe("contracts")
    expect(refs[0].target.period).toEqual(observationPeriod)
    expect(read.value.context.period).toEqual(observationPeriod)
    expect(read.value.missing).toContainEqual({ field: "notice", reason: "missing" })
    console.log("SF_WP12_CONTRACT_SOURCE:" + JSON.stringify({ scope: "actual-current-dashboard-contract-snapshot",
      githubSha: process.env.GITHUB_SHA ?? null, observedAt: context.at, observationPeriod, financialHorizon: WP12_SCENARIO_PERIOD,
      sourceRef: refs[0].refId, sourceSurface: refs[0].target.surface, sourceType: refs[0].target.recordType,
      sourceVersion: refs[0].target.version, projectionDigest: refs[0].target.projectionDigest,
      missingFields: read.value.missing, inferenceExecuted: false, gnativeAccepted: false }))
    return { evidence: refs[0], projection: read.value }
  })
}

/** Two alternatives and their coverage come from actual Planner source rows.
 * The purchase and optional contract sources are linked by real issuance before
 * case creation, never by editing a persisted case or an output envelope. */
export async function prepareWp12ProcurementCase(context: Wp12NativeMissionContext, options: {
  selected: "pending" | "complete"
  includeContract?: boolean
  withChoiceParameter?: boolean
}) {
  await selectWp12ProcurementPeriod(context)
  const requestEvidence = await context.ui("sf_request_read", { purpose: "native-purchase-source", id: WP12_PROCUREMENT_REQUEST_ID }, async (call) => {
    const issued = await context.business.individual.issue("procurement-request", WP12_PROCUREMENT_REQUEST_ID, call)
    if (issued.status !== "ok") throw new Error(`Actual purchase request issuance failed for ${WP12_PROCUREMENT_REQUEST_ID}: ${issued.reason}`)
    const source = await context.business.individual.resolve(issued.value, call)
    if (source.status !== "ok") throw new Error(`Actual purchase request source failed: ${source.reason}`)
    expect(source.value.evidence.target.recordType).toBe("procurement-request")
    expect(source.value.evidence.target.recordId).toBe(WP12_PROCUREMENT_REQUEST_ID)
    expect(source.value.evidence.target.period).toEqual(WP12_SCENARIO_PERIOD)
    expect(source.value.evidence.target.fields).toContain("approvalStage")
    return source.value.evidence
  })
  const contract = options.includeContract ? await issueWp12Contract(context) : undefined
  const definitions = [{ key: "baseline", versionId: "wp12-scenario-0", title: "Baseline", trainingAbsent: false },
    { key: "candidate", versionId: options.selected === "pending" ? "wp12-scenario-1" : "wp12-scenario-2", title: "Candidate", trainingAbsent: options.selected === "pending" }] as const
  const sources = await context.ui("sf_case_draft", { purpose: "native-purchase-planner-sources" }, async (call) => {
    const result: { definition: typeof definitions[number]; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }[] = []
    for (const definition of definitions) {
      const issued = await context.business.plannerProduct.issueSource(definition.versionId, call)
      if (issued.status !== "ok") throw new Error(`Actual purchase Planner issuance failed: ${issued.reason}`)
      result.push({ definition, evidence: issued.value.evidence })
    }
    return result
  })
  const draft = { objective: "Review the recorded decision and purchase sources for the selected period.", horizon: WP12_SCENARIO_PERIOD,
    currency: "USD", criteria: ["Evaluate the documented cost difference and retain unresolved coverage"],
    sourceRefs: [...sources.map((source) => source.evidence), requestEvidence, ...(contract ? [contract.evidence] : [])] }
  const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
  if (created.status !== "ok") throw new Error(`Actual purchase case creation failed: ${created.reason}`)
  let caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
  const basis: CostCoverageBasis = { id: `wp12-purchase-basis:${caseRef.id}`, version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: sources.map((source) => source.evidence) }
  const resultRefs: { key: typeof definitions[number]["key"]; resultRef: string }[] = []
  const sourceValueDigests = new Map<string, string>()
  const choiceOperations: ScenarioOperation[] = []
  const productHttp = context.services.productHttp
  if (!productHttp) throw new Error("The real purchase case routes are missing")
  for (const source of sources) {
    const projection = await context.ui("sf_context_get", { sourceRef: source.evidence.refId }, (call) =>
      context.business.projectPlannerEvidence(source.evidence, call, { period: WP12_SCENARIO_PERIOD, currency: "USD" }))
    if (projection.status !== "ok") throw new Error(`Actual purchase Planner projection failed: ${projection.reason}`)
    sourceValueDigests.set(source.definition.key, digestSfValue(projection.value.components.map((component) => ({ id: component.id, amount: component.amount, currency: component.currency, period: component.period }))))
    // A simulated empty scenario has no selectable sensitivity operation. For
    // the explicit human-choice mission, select a real current service value
    // and propose that same amount. This changes no source or monetary value;
    // the selected preview component still carries the domain's hypothetical state.
    if (options.withChoiceParameter && source.definition.key === "candidate") {
      const parameters = projection.value.components.filter((component) => component.id.startsWith("wp12-cost-service:") && component.period.start === WP12_SCENARIO_PERIOD.start)
      const parameter = parameters[0]
      if (parameters.length !== 1 || !parameter || parameter.currency !== "USD" || parameter.evidenceState !== "confirmed" ||
        typeof parameter.amount !== "number" || !Number.isFinite(parameter.amount)) throw new Error("The current purchase service parameter is not uniquely confirmed")
      const amounts = projection.value.values.filter((value) => value.id === `${parameter.id}:forecast`)
      const currencies = projection.value.values.filter((value) => value.id === `${parameter.id}:currency-declared`)
      const amount = amounts[0], currency = currencies[0]
      if (amounts.length !== 1 || currencies.length !== 1 || !amount || !currency || amount.granularity !== "month" || currency.granularity !== "month" ||
        amount.evidenceState !== "confirmed" || currency.evidenceState !== "confirmed" || typeof amount.value !== "number" || !Number.isFinite(amount.value) ||
        amount.currency !== "USD" || currency.value !== "USD") throw new Error("The purchase sensitivity parameter has no current declared amount and unit")
      expect(amount.value).toBe(parameter.amount)
      expect(amount.period).toEqual(parameter.period)
      expect(currency.period).toEqual(parameter.period)
      expect(amount.sourceRefs).toContainEqual(source.evidence)
      expect(currency.sourceRefs).toContainEqual(source.evidence)
      choiceOperations.push({ kind: "replace", targetRef: parameter.id, amount: amount.value, currency: "USD", period: amount.period })
    }
    const operations = options.withChoiceParameter && source.definition.key === "candidate" ? choiceOperations : []
    const entries = RENEWAL_TRANSITION_CATEGORIES.flatMap((category): CostCoverageEntry[] => {
      const components = projection.value.components.filter((component) => component.id.startsWith(`wp12-cost-${category}:`))
      if (category === "training" && source.definition.trainingAbsent) { expect(components).toHaveLength(0); return [] }
      expect(components).toHaveLength(12)
      return [{ categoryId: category, status: "included", componentRefs: components.map((component) => component.id), evidenceRefs: [source.evidence],
        scopeNote: `Human classification of the observed ${category} rows in the selected source.` }]
    })
    const coverageResponse = await productHttp(context.request({ caseRef, source: source.evidence, basis, entries, expectedVersion: 0 }, "/sucafina/planner?sf=baseline-coverage"), "planner")
    if (!coverageResponse) throw new Error("Actual purchase coverage route missing")
    const coverage = object(await coverageResponse.json()), value = object(coverage.value)
    if (coverageResponse.status !== 200 || coverage.status !== "ok" || typeof value.coverageRef !== "string") throw new Error(`Actual purchase coverage failed: ${String(coverage.reason)}`)
    const response = await productHttp(context.request({ caseRef, title: source.definition.title,
      scenario: { baseRef: source.evidence.refId, operations, assumptions: [] }, coverageRef: value.coverageRef }, "/sucafina/planner?sf=decision-promote"), "planner")
    if (!response) throw new Error("Actual purchase promotion route missing")
    const promoted = object(await response.json()), receipt = object(promoted.value), next = object(receipt.caseRef)
    if (response.status !== 200 || promoted.status !== "ok" || typeof receipt.resultRef !== "string" || next.id !== caseRef.id ||
      next.incarnation !== caseRef.incarnation || next.version !== caseRef.version + 1) throw new Error(`Actual purchase promotion failed: ${String(promoted.reason)}`)
    caseRef = { ...caseRef, version: Number(next.version) }
    resultRefs.push({ key: source.definition.key, resultRef: receipt.resultRef })
  }
  const read = await readCaseAnalysisProjection(context.request(), context.services, caseRef)
  if (read.status !== "ok") throw new Error(`Actual purchase alternatives cannot be read: ${read.reason}`)
  const get = (key: typeof definitions[number]["key"]) => {
    const source = sources.find((entry) => entry.definition.key === key)
    const alternative = read.value.case.alternatives.find((entry) => entry.scenario.baseRef === source?.evidence.refId)
    const stored = resultRefs.find((entry) => entry.key === key)
    if (!alternative || !stored) throw new Error(`Actual ${key} purchase alternative was not persisted`)
    return { alternative, resultRef: stored.resultRef }
  }
  const baseline = get("baseline"), candidate = get("candidate")
  for (const [key, item] of [["baseline", baseline], ["candidate", candidate]] as const) {
    expect(digestSfValue(item.alternative.result.components.map((component) => ({ id: component.id, amount: component.amount, currency: component.currency, period: component.period })))).toBe(sourceValueDigests.get(key))
  }
  // Observed category coverage does not turn a simulated choice into an applied
  // result. Both alternatives retain the actual engine's hypothetical boundary.
  for (const item of [baseline, candidate]) {
    expect(item.alternative.result.total).toBeNull()
    expect(item.alternative.result.comparisonStatus).toBe("conditioned")
    expect(item.alternative.result.unresolvedConditions).toContain("scenario-is-hypothetical")
    expect(item.alternative.result.restrictions).toContain("preview-not-applied")
    expect(item.alternative.result.costCoverage.basisId).toBe(basis.id)
    expect(item.alternative.result.costCoverage.basisVersion).toBe(basis.version)
  }
  expect(baseline.alternative.result.knownSubtotal).toBe(240_000)
  expect(baseline.alternative.result.costCoverage.coverageState).toBe("complete")
  expect(baseline.alternative.result.costCoverage.derivedMissingCategoryIds).toEqual([])
  for (const item of options.selected === "pending" ? [baseline] : [baseline, candidate]) {
    expect(item.alternative.result.costCoverage.entries.map((entry) => entry.categoryId).toSorted()).toEqual([...RENEWAL_TRANSITION_CATEGORIES].sort())
    expect(item.alternative.result.costCoverage.entries.every((entry) => entry.status === "included")).toBe(true)
    expect(item.alternative.result.components).toHaveLength(RENEWAL_TRANSITION_CATEGORIES.length * 12)
    if (!options.withChoiceParameter || item === baseline) {
      expect(item.alternative.result.components.every((component) => component.amount !== null && component.evidenceState === "confirmed")).toBe(true)
    }
  }
  expect(candidate.alternative.result.knownSubtotal).toBe(options.selected === "pending" ? 210_000 : 250_000)
  expect(candidate.alternative.result.costCoverage.coverageState).toBe(options.selected === "pending" ? "pending" : "complete")
  expect(candidate.alternative.result.costCoverage.derivedMissingCategoryIds).toEqual(options.selected === "pending" ? ["training"] : [])
  const training = candidate.alternative.result.components.filter((component) => component.id.startsWith("wp12-cost-training:"))
  expect(training).toHaveLength(options.selected === "pending" ? 0 : 12)
  if (options.selected === "pending") {
    expect(candidate.alternative.result.costCoverage.entries.some((entry) => entry.categoryId === "training" && entry.status === "pending" && entry.reason === "missing-category")).toBe(true)
  }
  expect(training.filter((component) => component.amount === 40_000)).toHaveLength(options.selected === "pending" ? 0 : 1)
  expect(training.filter((component) => component.amount === 0)).toHaveLength(options.selected === "pending" ? 0 : 11)
  if (options.withChoiceParameter) {
    expect(choiceOperations).toHaveLength(1)
    expect(candidate.alternative.scenario.operations).toEqual(choiceOperations)
    expect(candidate.alternative.scenario.assumptions).toEqual([])
    expect(candidate.alternative.result.components.every((component) => component.amount !== null && Number.isFinite(component.amount))).toBe(true)
    expect(candidate.alternative.result.components.filter((component) => component.evidenceState === "hypothetical").map((component) => component.id)).toEqual([choiceOperations[0]!.targetRef])
    expect(candidate.alternative.result.components.filter((component) => component.id !== choiceOperations[0]!.targetRef).every((component) => component.evidenceState === "confirmed")).toBe(true)
    console.log("SF_WP12_PURCHASE_PARAMETER:" + JSON.stringify({ scope: "real-current-source-value-selected-for-human-choice",
      githubSha: process.env.GITHUB_SHA ?? null, caseRef, variant: options.selected, operation: choiceOperations[0],
      sourceValueDigest: sourceValueDigests.get("candidate"), resultRef: candidate.resultRef, numericValuesUnchanged: true,
      selectedComponentState: "hypothetical", inferenceExecuted: false, domainApplied: false }))
  }
  const parameter = candidate.alternative.result.components.find((component) => options.withChoiceParameter
    ? component.id === choiceOperations[0]?.targetRef : component.id.startsWith("wp12-cost-service:"))
  const criterion = read.value.case.criteria[0]
  if (!parameter || !criterion) throw new Error("The actual case has no selectable service component or criterion")
  return { caseRef, case: read.value.case, requestEvidence, contract, baseline, candidate, parameterRef: parameter.id, criterionId: criterion.id }
}
