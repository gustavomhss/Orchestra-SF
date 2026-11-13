import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DecisionCase, ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const basis = { id: "renewal-v1", version: 4, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, sourceRefs: [], additionalCategoryIds: [] }

test("human-confirmed conditional choice persists its C10 caveat and provenance", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-human-choice-"))
  await chmod(directory, 0o700)
  const db = await openLocalStore(directory)
  const actor = { active: true, time: Date.parse("2026-11-13T16:00:00Z"), requestId: 0, eventId: 0 }
  const humanAction = "decisions.choose"
  const command = `sf-human:${humanAction}`
  const ui = createSfUiAuthority({
    authorize: async (request) => request.headers.get("x-principal") === "decision-maker" && actor.active
      ? { installationId: "install", projectId: "project", principalRef: "decision-maker", policyVersion: "policy-1", accessRevision: "access-1" }
      : undefined,
    commandIdentity: async (request, selected) => request.headers.get("x-principal") === "decision-maker" && selected === command ? "human-choice-command" : undefined,
    privateCommands: [command], createId: () => `human-request-${++actor.requestId}`, now: () => actor.time,
  })
  const human = createSfHumanAuthority({ origin: "https://example.test", ui })
  const state = createSfProductState({ persistence: db, createId: () => "state-inc", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => ({ incarnation: targetRef === "renewal-case" ? "renewal-inc" : targetRef }), authorize: async (request) => {
    const principalRef = request.headers.get("x-principal")
    return principalRef === "decision-maker" ? { principalRef, policyVersion: "policy-1", accessRevision: "access-1" } : undefined
  } })
  const seedRequest = new Request("https://example.test/seed", { headers: { "x-principal": "decision-maker" } })
  const result: ScenarioResult = {
    id: "replacement-result-v1", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
    unresolvedConditions: ["training:missing-category"], restrictions: [], comparisonStatus: "conditioned",
    costCoverage: { basisId: basis.id, basisVersion: basis.version, alternativeId: "replacement", alternativeVersion: 1, currency: "USD", horizon,
      issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "missing-category" }], derivedMissingCategoryIds: ["training"] },
    knownSubtotal: 210000, total: null,
  }
  const comparison: ScenarioComparison = { baselineResultRef: "current-cost", alternativeResultRef: result.id, costCoverageRefs: ["coverage-v1"], criterionResults: [], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null }
  const operation = { caseRef: { id: "renewal-case", incarnation: "renewal-inc", version: 1 }, alternativeId: "replacement", alternativeVersion: 1, comparison: { scenarioRefs: ["current-cost", result.id], criteria: ["cost"] }, criteria: ["cost"], reason: "Proceed while training remains unpriced" }
  const decision: DecisionCase = {
    id: "renewal-case", incarnation: "renewal-inc", version: 1, state: "comparing", objective: "renewal cost comparison", horizon, currency: "USD",
    criteria: [{ id: "cost", description: "Total cost", required: true }], participants: ["decision-maker"], sourceRefs: [],
    alternatives: [{ id: "replacement", version: 1, title: "Replace provider", scenario: { baseRef: "current-cost", operations: [], assumptions: [] }, result }],
    costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [],
  }

  try {
    const seeded = await state.transaction(seedRequest, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-renewal", commandDigest: "a".repeat(64), targetRef: decision.id, targetIncarnation: decision.incarnation }, async (staged) => {
      staged.cases[decision.id] = decision
      return { commit: true, value: true }
    })
    expect(seeded.status).toBe("ok")

    const currentRequest = () => new Request("https://example.test/decisions/choose", { method: "POST", headers: { origin: "https://example.test", "x-principal": "decision-maker" } })
    const host = { requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
    const unavailable = async () => ({ status: "unavailable" as const, reason: "not-used" })
    const choiceMutation = createDecisionMutations({
      state, host,
      planner: { compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: async () => ({ status: "ok", value: comparison }), evaluateSensitivity: unavailable },
      sources: { resolveForecastSource: unavailable, resolveForecastCoverage: unavailable },
      authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef),
      authorizeMutation: (_operation, payload, context) => human.authorize(context, humanAction, payload),
      verifyMutation: (_snapshot, _operation, payload, context) => context.kind === "ui" && ui.matchesIntent(context, command, digestSfValue(payload)),
      operationIdentity: (context) => ui.operationIdentity(context),
      confirmChoice: (_caseRef, _alternativeId, context) => human.authorize(context, humanAction, operation),
      resolveQuestion: unavailable, resolveAnswer: unavailable, confirmAnswer: async () => false,
      resolveChoiceValues: async () => ({ status: "ok", value: [] }), prepareDomainCommands: unavailable,
      createId: () => `choice-event-${++actor.eventId}`, now: () => new Date(actor.time).toISOString(),
    })
    const request = operation
    const forged = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "decision-maker", requestId: "forged", policyVersion: "policy-1", accessRevision: "access-1", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    expect((await choiceMutation.recordChoice(request, forged)).status).toBe("denied")
    expect((await human.admit(new Request("https://example.test/decisions/choose", { method: "POST", headers: { origin: "https://untrusted.example", "x-principal": "decision-maker" } }), humanAction, operation)).status).toBe("denied")

    const post = currentRequest()
    const revokedAdmission = await human.admit(post, humanAction, operation)
    expect(revokedAdmission.status).toBe("ok")
    if (revokedAdmission.status !== "ok") throw new Error(revokedAdmission.reason)
    actor.active = false
    expect((await choiceMutation.recordChoice(request, revokedAdmission.value)).status).toBe("denied")
    const unchanged = await state.read(seedRequest, "cases", (current) => current.cases[decision.id])
    expect(unchanged).toMatchObject({ status: "ok", value: { version: 1, choices: [] } })

    actor.active = true
    const admitted = await human.admit(currentRequest(), humanAction, operation)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    expect(await human.authorize(admitted.value, humanAction, { ...operation, alternativeId: "other-option" })).toBe(false)
    expect(await human.authorize(admitted.value, "decisions.apply", operation)).toBe(false)
    const chosen = await choiceMutation.recordChoice(request, admitted.value)
    expect(chosen).toMatchObject({ status: "ok", value: { caseRef: { id: decision.id, incarnation: decision.incarnation, version: 2 } } })
    const persisted = await state.read(seedRequest, "cases", (current) => current.cases[decision.id])
    expect(persisted).toMatchObject({ status: "ok", value: { version: 2, state: "chosen", choices: [{ principalRef: "decision-maker", comparisonStatus: "conditioned", basisVersion: basis.version, result: { knownSubtotal: 210000, total: null }, comparison: { knownDifference: 30000, completeDifference: null }, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } }], ledger: [{ kind: "choice-recorded", principalRef: "decision-maker" }] } })
  } finally {
    await db.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("C10 complete coverage needs every category and fresh source resolution", () => {
  const evidenceRef: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "training-cost", installationId: "install", projectId: "project", refDigest: "e".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "training-quote", incarnation: "training-inc", version: 2, fields: ["amount"], period: horizon, projectionDigest: "f".repeat(64) } }
  const evidence: BusinessEvidenceResolution = { ref: evidenceRef, state: "fresh", accessRevision: "access-1", checkedAt: "2026-11-13T16:00:00Z" }
  const entries = RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "training").map((categoryId) => ({ status: "not-applicable" as const, categoryId, justification: "Covered by reviewed renewal scope", evidenceRefs: [evidenceRef] }))
  const common = { basis: { ...basis, sourceRefs: [evidenceRef] }, alternativeId: "replacement", alternativeVersion: 2, currency: "USD", horizon, components: [{ id: "training-cost", amount: 40000, currency: "USD", period: horizon, evidenceState: "confirmed" as const, sourceRefs: [{ surface: "planner" as const, type: "quote", id: "training-quote", incarnation: "training-inc", version: 2, fields: ["amount"], period: horizon, observedAt: "2026-11-13T16:00:00Z" }] }], evidence: [evidence], supports: () => true }
  const resolved = assessCostCoverage({ ...common, entries: [...entries, { status: "included", categoryId: "training", componentRefs: ["training-cost"], evidenceRefs: [evidenceRef], scopeNote: "Training is priced" }] })
  expect(resolved).toMatchObject({ coverageState: "complete", basisVersion: 4, alternativeVersion: 2, derivedMissingCategoryIds: [] })
  const sourceRevoked = assessCostCoverage({ ...common, evidence: [{ ...evidence, state: "revoked" }], entries: [...entries, { status: "included", categoryId: "training", componentRefs: ["training-cost"], evidenceRefs: [evidenceRef], scopeNote: "Training is priced" }] })
  expect(sourceRevoked).toMatchObject({ coverageState: "unavailable", issues: ["evidence-unavailable"] })
})
