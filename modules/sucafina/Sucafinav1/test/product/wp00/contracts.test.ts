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
import { decodeSfOperationInput, decodeSfContributionOutput } from "../../../product/contracts/schema-admission.ts"
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

test("renewal inventory cannot omit training or invent a new decision inventory", () => {
  const basis = { id: "basis-1", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [] }
  expect(requiredSfCostCategories(basis)).toEqual(RENEWAL_TRANSITION_CATEGORIES)
  expect(requiredSfCostCategories({ ...basis, categoryIds: basis.categoryIds.filter((id) => id !== "training") })).toBeUndefined()
  expect(requiredSfCostCategories({ ...basis, decisionType: "undeclared-inventory" })).toBeUndefined()
})
