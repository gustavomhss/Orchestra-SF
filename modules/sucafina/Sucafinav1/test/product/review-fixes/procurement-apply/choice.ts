import { randomUUID } from "node:crypto"
import { object } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PreparedCommand } from "../../../../product/contracts/context.ts"
import type { CostCoverageBasis, DecisionCase, PreparedChange, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../../product/contracts/operations.ts"
import { createChoiceSnapshot } from "../../../../product/decisions/choice.ts"
import { at, period } from "./fixture.ts"
import type { Fixture } from "./fixture.ts"

export async function seedChoice(fixture: Fixture, amount = 150) {
  const current = await fixture.storedCase()
  const ref = fixture.evidence
  const operation: ScenarioOperation = { kind: "replace", targetRef: ref.refId, amount, currency: "USD", period }
  const basis: CostCoverageBasis = { id: "fixture-basis", version: 1, decisionType: "requisition", categoryIds: ["purchase"], additionalCategoryIds: [], sourceRefs: [ref] }
  // A persisted choice with explicitly pending coverage. No model execution or
  // SkillLoadReceipt is fabricated; all preparation/review/Apply consumers are real.
  const result: ScenarioResult = {
    id: "fixture-result", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [ref],
    unresolvedConditions: ["Coverage pending in seeded decision"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: amount, total: null,
    costCoverage: { basisId: basis.id, basisVersion: basis.version, alternativeId: "fixture-alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: ["Coverage pending"], evaluatedSourceRefs: [ref], coverageState: "pending", entries: [{ status: "pending", categoryId: "purchase", reason: "Fixture has no complete cost assertion" }], derivedMissingCategoryIds: ["purchase"] },
  }
  const seeded: DecisionCase = {
    ...current.value, version: current.value.version + 1, state: "chosen", participants: ["alice"],
    alternatives: [{ id: "fixture-alternative", version: 1, title: "Explicit amount replacement", scenario: { baseRef: ref.refId, operations: [operation], assumptions: [] }, result }], costCoverageBases: [basis],
  }
  const choice = createChoiceSnapshot({
    case: seeded, alternativeId: "fixture-alternative", alternativeVersion: 1,
    comparison: { baselineResultRef: "fixture-baseline", alternativeResultRef: result.id, costCoverageRefs: [], criterionResults: [], unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: amount - 100, completeDifference: null },
    criteria: seeded.criteria.map((criterion) => criterion.id), values: [], evidenceRefs: [ref], id: "fixture-choice", principalRef: "alice", reason: "Review the exact persisted choice", at,
  })
  if (choice.status !== "ok") throw new Error(`typed choice fixture invalid: ${choice.reason}`)
  const saved = await fixture.authority.state.transaction(fixture.request(), {
    namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: seeded.id, targetIncarnation: seeded.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue({ seeded, choice: choice.choice }),
  }, async (state) => { state.cases[seeded.id] = { ...seeded, choices: [choice.choice] }; return { commit: true, value: true } })
  if (saved.status !== "ok") throw new Error(`choice fixture persistence unavailable: ${saved.status}`)
  return { caseRef: { id: seeded.id, incarnation: seeded.incarnation, version: seeded.version }, choiceId: choice.choice.id, operations: [operation] }
}

export async function prepare(fixture: Fixture, amount = 150) {
  const chosen = await seedChoice(fixture, amount)
  const response = await fixture.http("decision-prepare-changes", chosen)
  if (response.response.status !== 200) throw new Error(`real preparation failed: ${JSON.stringify(response.body)}`)
  const current = await fixture.storedCase()
  const change = current.value.preparedChanges[0]
  if (current.value.preparedChanges.length !== 1 || !change) throw new Error("exactly one prepared change required")
  return { change, request: { caseRef: readCaseRef(object(response.body.value).caseRef), choiceId: chosen.choiceId, changeId: change.id } }
}

/** Models an existing malformed/no-op record, not a claimed historical execution.
 * Its fixture digest is only negative input: this does not prove a prior command
 * was issued, a historical receipt existed, or receipt recovery succeeded.
 */
export async function seedLegacyChange(fixture: Fixture, amount: number) {
  const call = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId })
  const projection = await fixture.business.procurement.read({ requestRef: fixture.evidence.refId }, call)
  fixture.authority.ui.finish(call)
  if (projection.status !== "ok") throw new Error(`legacy fixture projection unavailable: ${projection.reason}`)
  const current = await fixture.storedCase()
  const choice = current.value.choices[0]
  if (!choice) throw new Error("legacy fixture requires a persisted choice")
  const evidence = fixture.evidence.target
  const target = { surface: "procurement" as const, type: evidence.recordType, id: evidence.recordId, incarnation: evidence.incarnation, version: evidence.version, fields: evidence.fields, period, observedAt: at }
  const version = (await fixture.material()).version.version
  const operation: PreparedCommand = {
    id: "legacy-operation", target, expectedVersion: version, idempotencyKey: "legacy-operation",
    command: { page: "Requests", action: "save", id: target.id, version, values: { pr: { estAmount: amount } } },
    commandDigest: digestSfValue({ fixture: "legacy-ignored-pr-intent", target, amount, version }), requiredAuthority: ["procurement:write"],
    preview: { ...projection.value, values: projection.value.values.map((value) => ({ ...value, evidenceState: value.value === null ? "absent" as const : "hypothetical" as const })) },
  }
  const change: PreparedChange = {
    id: "legacy-change", caseId: current.value.id, caseVersion: current.value.version + 1, choiceId: choice.id, target,
    expectedVersion: version, operation, preview: choice.result, requiredAuthority: operation.requiredAuthority, idempotencyKey: operation.idempotencyKey, state: "planned",
  }
  await replaceChanges(fixture, [change])
  const saved = await fixture.storedCase()
  return { change, request: { caseRef: { id: saved.value.id, incarnation: saved.value.incarnation, version: saved.value.version }, choiceId: choice.id, changeId: change.id } }
}

export async function replaceChanges(fixture: Fixture, changes: readonly PreparedChange[]) {
  const current = await fixture.storedCase()
  const updated: DecisionCase = { ...current.value, version: current.value.version + 1, preparedChanges: changes }
  const result = await fixture.authority.state.transaction(fixture.request(), {
    namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: updated.id, targetIncarnation: updated.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(updated),
  }, async (state) => { state.cases[updated.id] = updated; return { commit: true, value: true } })
  if (result.status !== "ok") throw new Error(`change fixture persistence failed: ${result.status}`)
}

export function readCaseRef(value: unknown) {
  const ref = object(value)
  if (typeof ref.id !== "string" || typeof ref.incarnation !== "string" || typeof ref.version !== "number" || !Number.isSafeInteger(ref.version)) throw new Error("HTTP case reference invalid")
  return { id: ref.id, incarnation: ref.incarnation, version: ref.version }
}

export function readReviewDigest(body: Record<string, unknown>) {
  const digest = object(body.value).reviewDigest
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) throw new Error(`real review digest unavailable: ${JSON.stringify(body)}`)
  return digest
}
