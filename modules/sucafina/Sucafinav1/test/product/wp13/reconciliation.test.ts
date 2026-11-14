import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CommandReceiptView, ProjectionComponent, SourceRef } from "../../../product/contracts/context.ts"
import type { DecisionCase, PortfolioResult, PreparedChangeView, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PortfolioRequest } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfStoredDecisionResult } from "../../../product/contracts/state.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import type { PortfolioBinding } from "../../../product/decisions/portfolio-bindings.ts"
import { createPortfolioReconciliation, portfolioComponentConditionDigest } from "../../../product/portfolio/reconciliation.ts"
import type { PortfolioReconciliationRequest } from "../../../product/portfolio/reconciliation.ts"
import type { PortfolioCandidate } from "../../../product/portfolio/port.ts"
import { createPortfolioProduct } from "../../../product/portfolio/product.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
// These unit tests control host admission and already-produced C08/domain observations.
// No fixture projection is an installed domain command, financial oracle or native proof.
const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" } } as TrustedDomainContext

test("reconciliation preserves the chosen composition and WP11 partial/retry receipts without writing", async () => {
  const fixture = harness()
  const read = createPortfolioReconciliation(fixture.input)
  const before = digestSfValue(fixture.owner)
  const first = await read(fixture.request, context)
  if (first.status !== "ok") throw new Error(JSON.stringify(first))
  expect(first.value.applicationState).toBe("partially-applied")
  expect(first.value.originalChoice.result.total).toBeNull()
  expect(first.value.originalChoice.costCoverage.derivedMissingCategoryIds).toContain("training")
  expect(first.value.components.map((component) => component.original.amount)).toEqual([45000, 165000])
  expect(first.value.components.map((component) => component.correlation)).toEqual(["bound", "bound"])
  expect(first.value.components.map((component) => component.effects.map((effect) => [effect.change.state, effect.receipt?.id]))).toEqual([[["applied", "receipt-a"]], [["planned", undefined]]])
  expect(first.value.components.every((component) => component.conditions.every((condition) => condition.impact.state === "unknown"))).toBe(true)
  expect(await read(fixture.request, context)).toEqual(first)
  expect(digestSfValue(fixture.owner)).toBe(before)
  fixture.completeSecond()
  const current = fixture.owner.projection.case
  const resumed = await read({ ...fixture.request, caseRef: { id: current.id, incarnation: current.incarnation, version: current.version } }, context)
  if (resumed.status !== "ok") throw new Error(JSON.stringify(resumed))
  expect(resumed.value.applicationState).toBe("applied")
  expect(resumed.value.components.map((component) => component.effects[0]?.receipt?.id)).toEqual(["receipt-a", "receipt-b"])
  expect(resumed.value.choiceDigest).toBe(first.value.choiceDigest)
  expect(resumed.value.portfolioResultDigest).toBe(first.value.portfolioResultDigest)
  expect(resumed.value.components.map((component) => component.conditions.map((condition) => condition.condition.id))).toEqual(first.value.components.map((component) => component.conditions.map((condition) => condition.condition.id)))
  expect(fixture.owner.projection.case.choices).toHaveLength(1)
  expect(fixture.owner.projection.case.receipts).toHaveLength(2)
})

test("reconciliation retains independent evidence and command revisions while binding effects and receipts", async () => {
  // This controlled observation matches WP11's public view: source revisions 3/4,
  // domain command CAS 0/1 and resulting receipt revisions 1/2 remain distinct.
  const fixture = harness("", [0, 1])
  const before = digestSfValue(fixture.owner)
  const read = createPortfolioReconciliation(fixture.input)
  const initial = await read(fixture.request, context)
  if (initial.status !== "ok") throw new Error(`Independent revision control unavailable: ${JSON.stringify(initial)}`)
  expect(initial.value.components.map((component) => component.correlation)).toEqual(["bound", "bound"])
  expect(initial.value.components.map((component) => {
    const effect = component.effects[0]!
    return [effect.change.target.version, effect.change.expectedVersion, effect.receipt?.version]
  })).toEqual([[3, 0, 1], [4, 1, undefined]])
  expect(digestSfValue(fixture.owner)).toBe(before)
  fixture.completeSecond()
  const current = fixture.owner.projection.case
  const completed = await read({ ...fixture.request, caseRef: { id: current.id, incarnation: current.incarnation, version: current.version } }, context)
  if (completed.status !== "ok") throw new Error(`Independent revision completion unavailable: ${JSON.stringify(completed)}`)
  expect(completed.value.components.map((component) => component.effects[0]?.receipt?.version)).toEqual([1, 2])
  expect(completed.value.choiceDigest).toBe(initial.value.choiceDigest)
  expect(completed.value.portfolioResultDigest).toBe(initial.value.portfolioResultDigest)

  const wrongSource = harness("", [0, 1])
  wrongSource.owner.projection.case.preparedChanges = wrongSource.owner.projection.case.preparedChanges.map((change, index) => index ? change : { ...change, target: { ...change.target, version: 0 } })
  const unmapped = await createPortfolioReconciliation(wrongSource.input)(wrongSource.request, context)
  if (unmapped.status !== "ok") throw new Error(`Unmapped revision observation unavailable: ${JSON.stringify(unmapped)}`)
  expect(unmapped.value.components[0]?.correlation).toBe("not-prepared")
  expect(unmapped.value.components[0]?.effects).toEqual([])
  expect(unmapped.value.components[1]?.correlation).toBe("bound")
  expect(unmapped.value.unmappedChanges.map((change) => change.id)).toEqual(["change-0"])

  for (const field of ["expectedVersion", "sourceVersion"] as const) {
    for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const rejected = harness("", [0, 1])
      rejected.owner.projection.case.preparedChanges = rejected.owner.projection.case.preparedChanges.map((change, index) => index ? change : field === "expectedVersion" ? { ...change, expectedVersion: invalid } : { ...change, target: { ...change.target, version: invalid } })
      expect(await createPortfolioReconciliation(rejected.input)(rejected.request, context)).toEqual({ status: "unavailable", reason: "portfolio-reconciliation-change-invalid" })
    }
  }
})

test("reconciliation sends a source-bound price observation to the WP14 classifier while retaining original null and currency", async () => {
  const fixture = harness()
  fixture.input.readMaterialChange = async ({ condition, component }) => {
    if (component.id !== "implementation:11") return { status: "ok", value: { source: condition.source, fields: condition.fields, period: condition.period, availability: "available", before: [fixture.evidence[1]!], after: [fixture.evidence[1]!], comparison: { before: condition.choice.comparison, after: condition.choice.comparison, resultBefore: condition.choice.result, resultAfter: condition.choice.result }, componentScope: { componentId: component.id, beforeDigest: portfolioComponentConditionDigest(component), afterDigest: portfolioComponentConditionDigest(component) } } }
    return { status: "ok", value: { ...fixture.observation, componentScope: { componentId: component.id, beforeDigest: portfolioComponentConditionDigest(component), afterDigest: portfolioComponentConditionDigest(fixture.observation.comparison.resultAfter.components[0]!) } } }
  }
  const result = await createPortfolioReconciliation(fixture.input)(fixture.request, context)
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  const changed = result.value.components.find((component) => component.original.id === "implementation:11")!
  const unchanged = result.value.components.find((component) => component.original.id === "service:11")!
  expect(changed.original).toMatchObject({ amount: 45000, currency: "USD" })
  expect(changed.conditions[0]?.observation.comparison?.resultAfter.components[0]).toMatchObject({ amount: 70000, currency: "USD" })
  expect(changed.conditions[0]?.impact.state).toBe("material")
  expect(changed.conditions[0]?.signal).toMatchObject({ conditionId: changed.conditions[0]?.condition.id, choiceId: "human-choice", severity: "reconsider" })
  // Identical component evidence does not resolve the choice's unknown criterion.
  // Preserve WP14's unknown signal while distinguishing it from a price change.
  expect(unchanged.conditions[0]?.scopeReason).toBe("component-scope-bound")
  expect(unchanged.conditions[0]?.componentScope?.beforeDigest).toBe(unchanged.conditions[0]?.componentScope?.afterDigest)
  expect(unchanged.conditions[0]?.impact).toMatchObject({ state: "unknown", reason: "evidence-unavailable" })
  expect(unchanged.conditions[0]?.signal).toMatchObject({ conditionId: unchanged.conditions[0]?.condition.id, choiceId: "human-choice", severity: "unknown" })
  expect(unchanged.conditions[0]?.observation.comparison?.after).toEqual(result.value.originalChoice.comparison)
  expect(result.value.originalChoice.result.total).toBeNull()
  expect(result.value.originalChoice.result.components[0]?.amount).toBe(45000)
})

test("a global criterion change cannot attribute a different component's price to an unchanged component", async () => {
  const fixture = harness()
  fixture.input.readMaterialChange = async ({ condition, component }) => component.id !== "service:11" ? { status: "unavailable", reason: "not-requested" } : { status: "ok", value: { source: condition.source, fields: condition.fields, period: condition.period, availability: "available", before: [fixture.evidence[1]!], after: [fixture.evidence[1]!], comparison: fixture.observation.comparison, componentScope: { componentId: component.id, beforeDigest: portfolioComponentConditionDigest(component), afterDigest: portfolioComponentConditionDigest(fixture.observation.comparison.resultAfter.components[1]!) } } }
  const result = await createPortfolioReconciliation(fixture.input)(fixture.request, context)
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  const unchanged = result.value.components.find((component) => component.original.id === "service:11")!.conditions[0]!
  expect(unchanged.scopeReason).toBe("component-unchanged-comparison-changed")
  expect(unchanged.impact.state).toBe("unknown")
  expect(unchanged.signal?.severity).toBe("unknown")
  expect(unchanged.observation.comparison).toEqual(fixture.observation.comparison)
})

test("reconciliation refuses a substituted historical selection even when its numbers match the choice", async () => {
  const fixture = harness()
  fixture.origin.candidates[0]!.operations = [{ kind: "replace", targetRef: "different-effect", amount: 45000, currency: "USD", period: horizon }]
  expect(await createPortfolioReconciliation(fixture.input)(fixture.request, context)).toEqual({ status: "conflict", reason: "portfolio-reconciliation-composition-mismatch" })
  const other = harness()
  other.origin.stored.resultRef = "decision-result:another-portfolio"
  expect(await createPortfolioReconciliation(other.input)(other.request, context)).toEqual({ status: "unavailable", reason: "portfolio-reconciliation-origin-invalid" })
})

test("reconciliation refuses receipt substitution, revoked sources and a different current principal", async () => {
  const substituted = harness()
  substituted.owner.projection.case.receipts = [{ ...substituted.owner.projection.case.receipts[0]!, idempotencyKey: "different-effect" }]
  expect(await createPortfolioReconciliation(substituted.input)(substituted.request, context)).toEqual({ status: "unavailable", reason: "portfolio-reconciliation-receipt-unbound" })
  const revoked = harness()
  revoked.owner.revoked = true
  expect(await createPortfolioReconciliation(revoked.input)(revoked.request, context)).toEqual({ status: "denied", reason: "portfolio-reconciliation-evidence-unavailable" })
  const principal = harness()
  expect((await createPortfolioReconciliation(principal.input)(principal.request, { ...context, binding: { ...context.binding, principalRef: "other" } } as TrustedDomainContext)).status).not.toBe("ok")
})

test("reconciliation rejects a changed ledger, borrowed callback mutation and a changed read during egress", async () => {
  const ledger = harness()
  ledger.owner.projection.case.ledger = [{ ...ledger.owner.projection.case.ledger[0]!, outputDigest: "f".repeat(64) }]
  expect(await createPortfolioReconciliation(ledger.input)(ledger.request, context)).toEqual({ status: "unavailable", reason: "portfolio-reconciliation-choice-unbound" })
  const mutated = harness()
  mutated.input.readMaterialChange = async (request) => { request.component.amount = 0; return { status: "unavailable", reason: "unused" } }
  expect(await createPortfolioReconciliation(mutated.input)(mutated.request, context)).toEqual({ status: "stale", reason: "portfolio-reconciliation-condition-mutated" })
  const changed = harness()
  let reads = 0
  changed.input.readPortfolio = async () => {
    if (++reads === 2) changed.owner.projection.case.state = "reconsidering"
    return { status: "ok", value: changed.origin }
  }
  expect(await createPortfolioReconciliation(changed.input)(changed.request, context)).toEqual({ status: "stale", reason: "portfolio-reconciliation-changed" })
})

test("reconciliation does not reinterpret another source or missing data as a material price signal", async () => {
  const different = harness()
  different.input.readMaterialChange = async () => ({ status: "ok", value: { ...different.observation, source: { ...different.observation.source, id: "copied-forecast" } } })
  expect(await createPortfolioReconciliation(different.input)(different.request, context)).toEqual({ status: "unavailable", reason: "portfolio-reconciliation-materiality-unbound" })
  const missing = harness()
  missing.input.readMaterialChange = async () => ({ status: "unavailable", reason: "missing-fx" })
  const result = await createPortfolioReconciliation(missing.input)(missing.request, context)
  expect(result.status === "ok" && result.value.components.every((component) => component.conditions.every((condition) => condition.impact.state === "unknown" && condition.observation.comparison === undefined))).toBe(true)
  const forged = harness()
  forged.input.readMaterialChange = async ({ component }) => ({ status: "ok", value: { ...forged.observation, componentScope: { componentId: component.id, beforeDigest: portfolioComponentConditionDigest(component), afterDigest: "f".repeat(64) } } })
  expect(await createPortfolioReconciliation(forged.input)(forged.request, context)).toEqual({ status: "unavailable", reason: "portfolio-reconciliation-component-scope-invalid" })
})

test("reconciliation refuses authority mutation after the final successful revalidation", async () => {
  const positive = harness()
  let finalCalls = 0
  const validate = (trusted: TrustedDomainContext) => trusted.kind === "ui" && trusted.binding.principalRef === "principal" && trusted.binding.accessRevision === "access"
  positive.input.host.revalidate = async (trusted) => { finalCalls++; return validate(trusted) }
  const accepted = await createPortfolioReconciliation(positive.input)(positive.request, structuredClone(context))
  if (accepted.status !== "ok") throw new Error(`Authority control unavailable: ${JSON.stringify(accepted)}`)
  expect(accepted.value.choiceId).toBe(positive.request.choiceId)
  expect(finalCalls).toBeGreaterThan(0)

  for (const field of ["principalRef", "accessRevision", "kind"] as const) {
    const fixture = harness()
    const trusted = structuredClone(context)
    let calls = 0
    let injected = false
    fixture.input.host.revalidate = async (observed) => {
      const valid = validate(observed)
      calls++
      if (valid && calls === finalCalls) {
        if (field === "kind") Object.assign(observed, { kind: "native" })
        else Object.assign(observed.binding, { [field]: `${field}-changed-after-validation` })
        injected = true
      }
      // The callback validated the admitted authority before mutating its borrowed object.
      return valid
    }
    const denied = await createPortfolioReconciliation(fixture.input)(fixture.request, trusted)
    expect(injected).toBe(true)
    expect(calls).toBe(finalCalls)
    expect(denied.status).not.toBe("ok")
    expect("value" in denied).toBe(false)
  }
})

test("HTTP reconciliation preserves the admitted selection when authorization mutates the caller request", async () => {
  // A and B are separately valid selections in the same controlled case. The counterexample
  // proves selection preservation, not a cross-case ACL or installed-host admission claim.
  for (const selected of ["a", "b"] as const) {
    const control = httpHarness()
    const request = selected === "a" ? control.a : control.b
    const accepted = await httpProduct(control.input).http.reconcile(structuredClone(request), structuredClone(context))
    if (accepted.status !== "ok") throw new Error(`HTTP selection ${selected} control unavailable: ${JSON.stringify(accepted)}`)
    expect([accepted.value.portfolioResultRef, accepted.value.combinationId, accepted.value.choiceId]).toEqual([request.portfolioResultRef, request.combinationId, request.choiceId])
  }
  const fixture = httpHarness()
  const incoming = structuredClone(fixture.a)
  const caseFor = fixture.input.caseFor
  let calls = 0
  let injected = false
  fixture.input.caseFor = async (trusted) => {
    const current = await caseFor(trusted)
    if (++calls === 1) {
      Object.assign(incoming, { portfolioResultRef: fixture.b.portfolioResultRef, combinationId: fixture.b.combinationId, choiceId: fixture.b.choiceId })
      injected = true
    }
    return current
  }
  const result = await httpProduct(fixture.input).http.reconcile(incoming, structuredClone(context))
  expect(injected).toBe(true)
  expect(calls).toBeGreaterThan(0)
  expect(incoming.choiceId).toBe(fixture.b.choiceId)
  if (result.status !== "ok") throw new Error(`The admitted selection A was not retained: ${JSON.stringify(result)}`)
  expect([result.value.portfolioResultRef, result.value.combinationId, result.value.choiceId]).toEqual([fixture.a.portfolioResultRef, fixture.a.combinationId, fixture.a.choiceId])
  expect(result.value.choiceId).not.toBe(fixture.b.choiceId)
})

test("HTTP reconciliation fences authority from ingress before the core captures it", async () => {
  const nextRevision = "access-next"
  const positive = httpHarness()
  const current = structuredClone(context)
  Object.assign(current.binding, { accessRevision: nextRevision })
  Object.assign(positive.owner.projection.context, { accessRevision: nextRevision })
  const accepted = await httpProduct(positive.input).http.reconcile(positive.a, current)
  if (accepted.status !== "ok") throw new Error(`Current authority control unavailable: ${JSON.stringify(accepted)}`)
  expect(accepted.value.choiceId).toBe(positive.a.choiceId)

  const fixture = httpHarness()
  const borrowed = structuredClone(context)
  const caseFor = fixture.input.caseFor
  let injected = false
  fixture.input.caseFor = async (trusted) => {
    const selected = await caseFor(trusted)
    if (!injected) {
      Object.assign(trusted.binding, { accessRevision: nextRevision })
      Object.assign(fixture.owner.projection.context, { accessRevision: nextRevision })
      injected = true
    }
    return selected
  }
  const denied = await httpProduct(fixture.input).http.reconcile(fixture.a, borrowed)
  expect(injected).toBe(true)
  expect(denied.status).toBe("denied")
  expect("value" in denied).toBe(false)
})

function harness(suffix = "", commandVersions?: readonly number[]) {
  const sources: SourceRef[] = [
    { surface: "planner", type: "line", id: "implementation", incarnation: "implementation-inc", version: 3, fields: ["amount"], period: horizon, observedAt: "2026-11-14T00:00:00Z" },
    { surface: "procurement", type: "contract", id: "service", incarnation: "service-inc", version: 4, fields: ["amount"], period: horizon, observedAt: "2026-11-14T00:00:00Z" },
  ]
  const record = (source: SourceRef): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: `${source.surface}:${source.id}:${source.version}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: source.surface, recordType: source.type, recordId: source.id, incarnation: source.incarnation, version: source.version, fields: source.fields, period: source.period, projectionDigest: digestSfValue(source) } }
    return { ...ref, refDigest: digestSfEvidenceRef(ref) }
  }
  const evidence = sources.map(record)
  const components: ProjectionComponent[] = sources.map((source, index) => ({ id: index ? "service:11" : "implementation:11", amount: index ? 165000 : 45000, currency: "USD", period: horizon, evidenceState: "confirmed", sourceRefs: [source] }))
  const scenario = { baseRef: evidence[0]!.refId, operations: components.map((component) => ({ kind: "replace" as const, targetRef: component.id, amount: component.amount!, currency: component.currency, period: component.period })), assumptions: [] }
  const result: ScenarioResult = { id: "combined", version: 1, components, currency: "USD", horizon, sourceRefs: evidence, unresolvedConditions: ["training:missing-category"], restrictions: [], knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "selected", alternativeVersion: 1, currency: "USD", horizon, issues: ["training:missing-category"], evaluatedSourceRefs: evidence, coverageState: "pending", entries: [{ categoryId: "implementation", status: "included", componentRefs: ["implementation:11"], evidenceRefs: [evidence[0]!], scopeNote: "Original implementation price" }, { categoryId: "training", status: "pending", reason: "missing-category" }], derivedMissingCategoryIds: ["training"] } }
  const comparison = { comparisonStatus: "conditioned" as const, baselineResultRef: "decision-result:baseline", alternativeResultRef: "decision-result:scenario", costCoverageRefs: ["coverage:base", "coverage:selected"], knownDifference: -30000, completeDifference: null, criterionResults: [{ criterionId: "advantage", state: "unknown" as const, reason: "training:missing-category" }], unresolvedConditions: result.unresolvedConditions }
  const caseRef = { id: "case", incarnation: "case-inc", version: 4 }
  const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Preserve both domain commitments", horizon, currency: "USD", criteria: [{ id: "advantage", required: true, description: "Minimum advantage" }], participants: ["principal"], sourceRefs: evidence, alternatives: [{ id: "selected", version: 1, title: "Reviewed composition", scenario, result }], costCoverageBases: [{ id: "basis", version: 1, decisionType: "renewal-transition", categoryIds: ["implementation", "training"], additionalCategoryIds: [], sourceRefs: evidence }], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const chosen = createChoiceSnapshot({ case: decision, alternativeId: "selected", alternativeVersion: 1, comparison, alternativeResultRef: comparison.alternativeResultRef, criteria: ["advantage"], values: [{ criterionRef: "advantage", value: null, unit: "USD", currency: "USD", horizon }], evidenceRefs: evidence, id: `human-choice${suffix}`, principalRef: "principal", reason: "Review the known costs while training is unresolved", at: "2026-11-14T01:00:00Z" })
  if (chosen.status !== "ok") throw new Error(chosen.reason)
  const candidate: PortfolioCandidate = { ref: `portfolio-candidate:chosen${suffix}`, caseRef: "case:case:case-inc", operations: scenario.operations, scenario, result }
  const request: PortfolioRequest = { scope: { horizon, currency: "USD" }, candidateRefs: [candidate.ref], operations: [], constraints: ["advantage"], priorities: [], explorationLimit: 1 }
  const combinationId = digestSfValue({ candidates: [candidate.ref], operations: scenario.operations })
  const portfolio: PortfolioResult = { combinations: [{ id: combinationId, caseRefs: [candidate.caseRef], components, costCoverageRefs: comparison.costCoverageRefs, conflicts: [], restrictions: [], comparisonStatus: "conditioned", eligibility: "conditioned", analysis: { scenarioResultRef: comparison.alternativeResultRef, scenario: result, comparisonRef: "decision-result:comparison", comparison } }], evidenceRefs: evidence, limitations: ["finite-enumeration"] }
  const stored: Extract<SfStoredDecisionResult, { kind: "portfolio" }> = { schema: "sf-decision-result-v1", kind: "portfolio", resultRef: `decision-result:portfolio${suffix}`, result: portfolio, caseRef, requestDigest: digestSfValue(request), resultDigest: digestSfValue(portfolio), sourceRefs: evidence, principalRef: "principal", policyVersion: "policy", accessRevision: "access", createdAt: "2026-11-14T00:00:00Z" }
  const bindingBody = { schema: "sf-portfolio-binding-v1" as const, caseRef, resultRef: stored.resultRef, resultDigest: stored.resultDigest, request, requestDigest: stored.requestDigest, proof: { candidates: [{ ref: candidate.ref, digest: digestSfValue(candidate) }], selectionDigest: digestSfValue("human-selection") }, createdAt: stored.createdAt }
  const binding: PortfolioBinding = { ...bindingBody, bindingDigest: digestSfValue(bindingBody) }
  const changes: PreparedChangeView[] = sources.map((source, index) => ({ id: `change-${index}`, caseId: decision.id, caseVersion: 5, choiceId: chosen.choice.id, target: source, expectedVersion: commandVersions?.[index] ?? source.version, operationRef: `command-${index}`, preview: result, requiredAuthority: [source.surface], idempotencyKey: `domain-effect-${index}`, state: index ? "planned" : "applied", ...(index ? {} : { receiptRef: "receipt-a" }) }))
  const receipt = (index: number): CommandReceiptView => ({ id: index ? "receipt-b" : "receipt-a", idempotencyKey: changes[index]!.idempotencyKey, commandDigest: digestSfValue(`command-${index}`), targetIncarnation: sources[index]!.incarnation, principalRef: "principal", surface: sources[index]!.surface, version: changes[index]!.expectedVersion + 1, at: "2026-11-14T02:00:00Z", status: "applied", errors: [] })
  const receiptEvidence = (value: CommandReceiptView): BusinessEvidenceRef => {
    const ref: BusinessEvidenceRef = { schema: "sf-evidence-v1", kind: "receipt", refId: value.id, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { receiptId: value.id, surface: value.surface, idempotencyKey: value.idempotencyKey, targetIncarnation: value.targetIncarnation, commandDigest: value.commandDigest, version: value.version } }
    return { ...ref, refDigest: digestSfEvidenceRef(ref) }
  }
  const projection: AuthorizedCaseProjection = { context: { kind: "ui", installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }, case: { ...decision, version: 6, state: "partially-applied", choices: [chosen.choice], preparedChanges: changes, receipts: [receipt(0)], ledger: [{ id: `choice-event${suffix}`, kind: "choice-recorded", caseRef: { ...caseRef, version: 5 }, principalRef: chosen.choice.principalRef, at: chosen.choice.at, consideredActions: [chosen.choice.alternativeId], factualGaps: chosen.choice.result.unresolvedConditions, lifecycleState: "chosen", rationale: chosen.choice.reason, evidenceRefs: chosen.choice.evidenceRefs, outputDigest: digestSfValue(chosen.choice) }] }, events: [], evidenceRefs: [...evidence, receiptEvidence(receipt(0))], checkedAt: "2026-11-14T02:00:00Z" }
  projection.events = projection.case.ledger
  const owner = { projection, revoked: false }
  const origin = { stored, binding, candidates: [candidate] }
  const nextSource = { ...sources[0]!, version: 4 }
  const nextEvidence = record(nextSource)
  const afterResult: ScenarioResult = { ...result, knownSubtotal: 235000, components: [{ ...components[0]!, amount: 70000, sourceRefs: [nextSource] }, components[1]!] }
  const observation = { source: nextSource, fields: nextSource.fields, period: horizon, availability: "available" as const, before: [evidence[0]!], after: [nextEvidence], comparison: { before: comparison, after: { ...comparison, alternativeResultRef: "decision-result:price70000", knownDifference: -5000, criterionResults: [{ criterionId: "advantage", state: "failed" as const, reason: "canonical-producer-reported-failure" }] }, resultBefore: result, resultAfter: afterResult } }
  const input: Parameters<typeof createPortfolioReconciliation>[0] = {
    cases: { read: async () => ({ status: "ok", value: owner.projection }) },
    evidence: { context: async ({ refs }, trusted) => refs.map((ref) => ({ state: owner.revoked ? "revoked" as const : "fresh" as const, ref, accessRevision: trusted.binding.accessRevision, checkedAt: "2026-11-14T02:00:00Z" })) },
    host: { revalidate: async (trusted) => trusted.binding.principalRef === "principal" },
    caseFor: async () => ({ status: "ok", value: { id: owner.projection.case.id, incarnation: owner.projection.case.incarnation, version: owner.projection.case.version } }),
    readPortfolio: async () => ({ status: "ok", value: origin }),
  }
  const readRequest: PortfolioReconciliationRequest = { caseRef: { ...caseRef, version: 6 }, portfolioResultRef: stored.resultRef, combinationId, choiceId: chosen.choice.id }
  const completeSecond = () => {
    owner.projection = { ...owner.projection, case: { ...owner.projection.case, version: 7, state: "applied", preparedChanges: changes.map((change) => change.id === "change-1" ? { ...change, state: "applied", receiptRef: "receipt-b" } : change), receipts: [receipt(0), receipt(1)] }, evidenceRefs: [...evidence, receiptEvidence(receipt(0)), receiptEvidence(receipt(1))] }
  }
  return { owner, origin, input, request: readRequest, evidence, observation, completeSecond }
}

function httpHarness() {
  const first = harness()
  const second = harness("-b")
  first.owner.projection.case.choices = [...first.owner.projection.case.choices, ...second.owner.projection.case.choices]
  first.owner.projection.case.ledger = [...first.owner.projection.case.ledger, ...second.owner.projection.case.ledger]
  first.owner.projection.events = first.owner.projection.case.ledger
  first.input.readPortfolio = async (request) => {
    const matched = [first, second].find((fixture) => request.resultRef === fixture.request.portfolioResultRef && request.combinationId === fixture.request.combinationId)
    return matched ? { status: "ok", value: matched.origin } : { status: "unavailable", reason: "controlled-selection-unavailable" }
  }
  return { input: first.input, owner: first.owner, a: first.request, b: second.request }
}

function httpProduct(input: Parameters<typeof createPortfolioReconciliation>[0]) {
  // Only the real public HTTP adapter and reconciliation are exercised. Its read
  // fence now owns a real LocalStore root and one stable admitted Request. Domain
  // observations remain the controlled unit fixture; unrelated producers fail on use.
  return { http: { reconcile: async (request: PortfolioReconciliationRequest, trusted: TrustedDomainContext) => {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-http-read-"))
    await chmod(directory, 0o700)
    const store = await openLocalStore(directory)
    const admittedRequest = new Request("https://example.test/controlled-reconciliation")
    try {
      const unused = async (): Promise<never> => { throw new Error("Unexpected unrelated portfolio operation") }
      return await createPortfolioProduct({
        host: { persistence: store, authenticate: unused, environment: unused, requestFor: () => admittedRequest, revalidate: input.host.revalidate },
        cases: { draft: unused, prepareIntent: unused, read: input.cases.read },
        evidence: { resolve: unused, context: input.evidence.context, recall: unused, emitFromLedger: unused },
        planner: { planner: { compareForecast: unused, simulateScenario: unused, compareScenarios: unused, evaluateSensitivity: unused }, sources: { resolveForecastSource: unused, resolveForecastCoverage: unused }, scenarios: { resolve: unused } },
        results: { write: unused, read: unused, readForCalculation: unused, readHistoricalScenario: unused, readHistoricalCalculation: unused, readByRequest: unused },
        rules: { register: unused, resolve: unused, evaluate: unused },
        selection: { register: unused, read: unused, inspect: unused },
        portfolioBindings: { proofs: unused, bind: unused, read: unused, list: unused, readHistoricalBinding: unused },
        comparisonBindings: { bind: unused, read: unused, proofs: unused },
        sensitivityBindings: { bind: unused, read: unused },
        decisions: { prepareChanges: unused },
        createReceipt: unused,
        caseFor: input.caseFor,
        idempotencyKey: unused,
        reconciliation: input,
      }).http.reconcile(request, trusted)
    } finally {
      await store.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  } } }
}
