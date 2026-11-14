import { expect, test } from "bun:test"
import { decodeProductContext } from "../../../product/contracts/validation.ts"
import { sfOperationInputSchemas } from "../../../product/contracts/operations.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { CapabilityDescriptor } from "../../../product/contracts/sf-execution.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { testPersistence } from "../../fixture/persistence.ts"
import { decodeSfOperationInput, decodeSfContributionOutput, decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { sfSkillInputSchemas } from "../../../product/contracts/output-schemas.ts"
import type { SfOutputSchemaBuild } from "../../../product/contracts/generate-output-schemas.ts"
import type { CreateSfProductContribution } from "../../../product/contracts/runtime.ts"
import type { PlannerPort, FinancialAnalysis, DecisionCasePort } from "../../../product/contracts/ports.ts"
import { requiredSfCostCategories } from "../../../product/contracts/coverage-inventory.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"

const context: ProductContext = {
  installationId: "installation-1", projectId: "project-1", principalRef: "principal-1",
  accessRevision: "access-1", policyVersion: "policy-1", surface: "planner", currency: "USD",
  period: { start: "2026-01-01", end: "2026-12-31" }, capabilities: ["sf_forecast_compare"],
  sourceRefs: [{ surface: "planner", type: "forecast", id: "forecast-1", incarnation: "incarnation-1", version: 1,
    fields: ["amount"], period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: "2026-11-13T04:01:10Z" }],
}
const selection = { surface: context.surface, period: context.period, currency: context.currency, sourceRefs: context.sourceRefs }
const authority = { installationId: context.installationId, projectId: context.projectId, principalRef: context.principalRef, accessRevision: context.accessRevision, policyVersion: context.policyVersion, capabilities: context.capabilities }

// These references make package typechecking traverse every shared seam before domain consumers land.
type ContractSeams = [BusinessContextService, CapabilityDescriptor, ContributionEnvelope, SfProductStatePort, SfOutputSchemaBuild, CreateSfProductContribution, PlannerPort, FinancialAnalysis, DecisionCasePort]

test("context admission preserves explicit scope without sharing mutable input", () => {
  const result = decodeProductContext(selection, authority)
  expect(result).toEqual({ ok: true, value: context })
  if (result.ok) expect(result.value.sourceRefs).not.toBe(context.sourceRefs)
})

test("context admission rejects absent or impossible periods and unversioned references", () => {
  expect(decodeProductContext({ ...selection, period: undefined }, authority).ok).toBe(false)
  expect(decodeProductContext({ ...selection, period: { start: "2026-02-30", end: "2026-12-31" } }, authority).ok).toBe(false)
  expect(decodeProductContext({ ...selection, period: { start: "2026-12-31", end: "2026-01-01" } }, authority).ok).toBe(false)
  expect(decodeProductContext({ ...selection, sourceRefs: [{ ...context.sourceRefs[0], incarnation: "" }] }, authority).ok).toBe(false)
  expect(decodeProductContext({ ...selection, currency: "USD+EUR" }, authority).ok).toBe(false)
  expect(decodeProductContext({ ...selection, owner: "forged-owner" }, authority)).toEqual({ ok: false, reason: "unexpected-context-field" })
  expect(decodeProductContext({ ...selection, principalRef: "forged-principal" }, authority).ok).toBe(false)
})

test("all capability entry schemas close their host identity argument boundary", () => {
  expect(Object.keys(sfOperationInputSchemas)).toHaveLength(39)
  for (const schema of Object.values(sfOperationInputSchemas)) {
    expect(schema.additionalProperties).toBe(false)
    for (const key of ["principalRef", "profileId", "owner", "provider", "nativeSessionId", "credentials"])
      expect(key in schema.properties).toBe(false)
  }
})

test("reading an old installation never initializes or persists product state implicitly", async () => {
  const storage = testPersistence()
  const before = structuredClone(storage.state.dashboard)
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "incarnation-1", resolveTarget: async () => ({ incarnation: "incarnation-1" }), authorize: async () => ({ principalRef: "principal-1", policyVersion: "policy-1", accessRevision: "access-1" }) })
  expect(await state.read(new Request("https://example.test/product"), "preferences", () => "content")).toEqual({ status: "unavailable", reason: "product-state-uninitialized" })
  expect(await state.transaction(new Request("https://example.test/product"), { namespace: "preferences", expectedStorageVersion: 0, targetRef: "preferences:principal-1", targetIncarnation: "incarnation-1", idempotencyKey: "preview-1", commandDigest: "a".repeat(64) }, async (staged) => {
    staged.preferences.theme = "dark"
    return { commit: false, value: "preview" }
  })).toMatchObject({ status: "preview", storageVersion: 0, value: "preview" })
  expect(storage.state.dashboard).toEqual(before)
})

test("capability schemas reject nested authority and dangling evidence references", () => {
  expect(decodeSfOperationInput("sf_scenario_simulate", { baseRef: "baseline-1", operations: [{ kind: "replace", targetRef: "cost-1", amount: 84000 }], assumptions: [] }).ok).toBe(true)
  expect(decodeSfOperationInput("sf_scenario_simulate", { baseRef: "baseline-1", operations: [{ kind: "replace", targetRef: "cost-1", principalRef: "forged" }], assumptions: [] }).ok).toBe(false)
  expect(decodeSfOperationInput("sf_source_get", { evidenceRef: { refId: "invented" } }).ok).toBe(false)
  expect(decodeSfOperationInput("sf_routine_prepare", { publishedRecipeRef: "recipe-1", inputRefs: [], parameters: { provider: "forged" } }).ok).toBe(false)
})

test("a conditioned comparison cannot publish a complete difference", () => {
  const comparison = { baselineResultRef: "baseline-1", alternativeResultRef: "alternative-1", costCoverageRefs: ["coverage-1"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null, criterionResults: [], unresolvedConditions: ["training-missing"] }
  expect(decodeSfContributionOutput("ScenarioComparison", comparison).ok).toBe(true)
  expect(decodeSfContributionOutput("ScenarioComparison", { ...comparison, completeDifference: 30000 }).ok).toBe(false)
})

test("commercial comparison admits traceable score and currency details without widening its schema", () => {
  const proposal = { proposalRef: "quote-1", eligible: true, score: 80, convertedAmount: 108, evidenceRefs: [], issues: [], components: { technical: 80, price: 75, commercial: 80, overall: 80 }, money: { originalAmount: 100, originalCurrency: "EUR", baseCurrency: "USD", fxRate: 1.08, fxSource: "submitted" } }
  const value = { requestRef: "request-1", requestVersion: 1, currency: "USD", proposals: [proposal], ranking: ["quote-1"], conditions: [], sourceRefs: [], weights: { technical: 60, commercial: 40, technicalCriteria: [{ name: "quality", weight: 100 }], commercialCriteria: [{ name: "price", weight: 100, automatic: true }] }, selection: { proposalRef: "quote-1", reason: "documented selection" } }
  expect(decodeSfContributionOutput("CommercialComparison", value).ok).toBe(true)
  expect(decodeSfContributionOutput("CommercialComparison", { ...value, proposals: [{ ...proposal, money: { ...proposal.money, fxSource: "invented" } }] }).ok).toBe(false)
  expect(decodeSfContributionOutput("CommercialComparison", { ...value, proposals: [{ ...proposal, components: { ...proposal.components, hidden: 1 } }] }).ok).toBe(false)
})

test("alternative contribution preserves the deterministic draft boundary", () => {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] }
  const value = { caseRef: "case:one:inc", proposal: { id: "alternative", version: 1, title: "Alternative", scenario: { baseRef: "base", operations: [], assumptions: [] }, result: { id: "result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: ["training"], restrictions: [], comparisonStatus: "conditioned", costCoverage: coverage, knownSubtotal: null, total: null } }, costCoverageBasis: { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [] }, coverageRef: "coverage", domainApplied: false }
  expect(decodeSfContributionOutput("AlternativeDraft", value).ok).toBe(true)
  expect(decodeSfContributionOutput("AlternativeDraft", { ...value, domainApplied: true }).ok).toBe(false)
  expect(decodeSfContributionOutput("AlternativeDraft", { ...value, proposal: { ...value.proposal, result: { ...value.proposal.result, total: 0 } } }).ok).toBe(false)
})

test("a KPI comparison retains a separate versioned source context", () => {
  const comparison = { metricRef: "metric", comparisonRef: "prior", context, version: 1, engineVersion: "engine", values: [] }
  const projection = { context, version: 2, engineVersion: "engine", components: [], values: [], missing: [], comparison }
  expect(decodeSfOperationOutput("sf_dashboard_read", projection).ok).toBe(true)
  expect(decodeSfOperationOutput("sf_dashboard_read", { ...projection, comparison: { ...comparison, context: { ...context, period: undefined } } }).ok).toBe(false)
})

test("renewal inventory cannot omit training or invent a new decision inventory", () => {
  const basis = { id: "basis-1", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [] }
  expect(requiredSfCostCategories(basis)).toEqual(RENEWAL_TRANSITION_CATEGORIES)
  expect(requiredSfCostCategories({ ...basis, categoryIds: basis.categoryIds.filter((id) => id !== "training") })).toBeUndefined()
  expect(requiredSfCostCategories({ ...basis, decisionType: "undeclared-inventory" })).toBeUndefined()
})

test("schema registries reject inherited names rather than admitting an empty schema", () => {
  for (const name of ["constructor", "__proto__", "toString", "missing-schema"]) {
    expect(Reflect.apply(decodeSfOperationInput, undefined, [name, {}]).ok).toBe(false)
    expect(Reflect.apply(decodeSfOperationOutput, undefined, [name, {}]).ok).toBe(false)
    expect(Reflect.apply(decodeSfContributionOutput, undefined, [name, {}]).ok).toBe(false)
    expect(Reflect.apply(decodeSfSkillInput, undefined, [name, {}]).ok).toBe(false)
  }
})

test("all resident input names have real closed decoders and identity stays outside the input", () => {
  expect(Object.keys(sfSkillInputSchemas)).toHaveLength(18)
  const value = { currentCase: { id: "case-1", incarnation: "incarnation-1", version: 1 }, recallScope: { cases: [], period: context.period, includeHistorical: true }, query: "contract renewal" }
  expect(decodeSfSkillInput("DecisionRecallInput", value).ok).toBe(true)
  expect(decodeSfSkillInput("DecisionRecallInput", { ...value, currentAuthorization: { principalRef: "forged" } }).ok).toBe(false)
  expect(decodeSfSkillInput("DecisionRecallInput", { ...value, recallScope: { ...value.recallScope, provider: "forged" } }).ok).toBe(false)
  expect(decodeSfSkillInput("ForecastExplainInput", { baseRef: "base", candidateRef: "candidate", period: context.period, currency: "USD" }).ok).toBe(false)
})
