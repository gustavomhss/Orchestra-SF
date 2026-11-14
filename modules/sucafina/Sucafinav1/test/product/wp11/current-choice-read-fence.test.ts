import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { createCurrentChoicePreview, type CurrentChoiceBinding } from "../../../product/decisions/current-choice-preview.ts"
import type { CurrentChoicePromotion } from "../../../product/decisions/current-choice-promotion.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const horizon = { start: "2027-01-01", end: "2027-12-31" }
const at = "2026-11-14T00:00:00Z"

function source(refId: string, version: number): RecordEvidence {
  const value: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "source", incarnation: "source-incarnation", version, fields: ["lines"], period: horizon, projectionDigest: digestSfValue({ version }) } }
  return { ...value, refDigest: digestSfEvidenceRef(value) }
}

function pendingResult(id: string, reference: RecordEvidence, alternativeVersion: number): ScenarioResult {
  return { id, version: 0, currency: "USD", horizon, components: [], sourceRefs: [reference], comparisonStatus: "conditioned", knownSubtotal: null, total: null, unresolvedConditions: ["reader-fixture-no-financial-claim"], restrictions: ["preview-not-applied"], costCoverage: { basisId: "basis", basisVersion: reference.target.version, alternativeId: "selected", alternativeVersion, currency: "USD", horizon, coverageState: "pending", entries: [], derivedMissingCategoryIds: [], issues: ["inventory-unavailable"], evaluatedSourceRefs: [reference] } }
}

/** Reader fence only: C08 choice/binding are seeded and all financial values remain unknown.
 * Real UI admission, SQLite transactions and result-store reads exercise the authorization race.
 * This does not replace the canonical choice/preview/promotion or native-session journeys.
 */
for (const revocation of ["membership", "preferences read"] as const) test(`current-choice read suppresses its binding when ${revocation} changes during the final case authorization`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-current-choice-read-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const request = new Request("https://example.test/current-choice-read", { headers: { authorization: "reader-fixture" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const ui = createSfUiAuthority({ authorize: async (incoming) => incoming === request && incoming.headers.get("authorization") === "reader-fixture" ? identity : undefined, commandIdentity: async () => "read-current-choice", createId: () => "ui-request", now: () => Date.parse(at) })
  let admittedContext: TrustedUiContext | undefined
  try {
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 2 }
    const intentDigest = digestSfValue({ caseRef })
    const admitted = await ui.admit(request, "sf_case_read", intentDigest)
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_case_read", intentDigest)) throw new Error("Reader UI admission unavailable")
    const context = admitted.value
    admittedContext = context
    const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = { requestFor: (trusted) => trusted.kind === "ui" ? ui.requestFor(trusted) : undefined, revalidate: (trusted) => trusted.kind === "ui" ? ui.revalidate(trusted) : Promise.resolve(false) }
    const writes = new WeakSet<object>()
    const access = { preferencesRead: true, preferencesWrite: true }
    const state = createSfProductState({ persistence: store, proposalCoverageWrites: writes, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (incoming, _snapshot, namespace, mode) => incoming === request && (namespace !== "preferences" || (mode === "read" ? access.preferencesRead : access.preferencesWrite)) && await ui.revalidate(context) ? { principalRef: identity.principalRef, policyVersion: identity.policyVersion, accessRevision: identity.accessRevision } : undefined })
    const originalSource = source("original-source", 1)
    const currentSource = source("current-source", 2)
    const originalScenario: ScenarioRequest = { baseRef: originalSource.refId, operations: [], assumptions: [] }
    const currentScenario: ScenarioRequest = { ...originalScenario, baseRef: currentSource.refId }
    const originalResult = pendingResult("original-preview", originalSource, 1)
    const choice: ChoiceRecord = { id: "choice", alternativeId: "selected", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [originalSource], principalRef: identity.principalRef, reason: "Seeded historical reader fixture; no application authorized.", at, scenario: originalScenario, result: originalResult, comparison: { baselineResultRef: "retained-baseline", alternativeResultRef: "retained-original", costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["reader-fixture-no-financial-claim"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null }, comparisonStatus: "conditioned", costCoverage: originalResult.costCoverage }
    const decision: DecisionCase = { ...caseRef, state: "chosen", objective: "inspect a private current-choice binding", currency: "USD", horizon, criteria: [], participants: [identity.principalRef], sourceRefs: [originalSource, currentSource], alternatives: [{ id: "selected", version: 1, title: "Historical selection", scenario: originalScenario, result: originalResult }], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-current-choice-reader", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Reader case seed unavailable")
    const authorizeCase = async (value: DecisionCase) => value.id === caseRef.id && value.incarnation === caseRef.incarnation && value.participants.includes(identity.principalRef) && await ui.revalidate(context)
    let nextId = 0
    const results = createSfDecisionResultStore({ state, host, authorizeCase, verifySources: async (_value, refs) => refs.every((ref) => digestSfValue(ref) === digestSfValue(currentSource)) && await ui.revalidate(context), createId: () => `reader-result-${++nextId}`, now: () => at })
    const producer = await results.write({ kind: "scenario", caseRef, requestDigest: digestSfValue(currentScenario), result: pendingResult("producer-preview", currentSource, 2), sourceRefs: [currentSource], idempotencyKey: "reader-producer" }, context)
    const reviewed = await results.write({ kind: "scenario", caseRef, requestDigest: digestSfValue(currentScenario), result: pendingResult("reviewed-preview", currentSource, 2), sourceRefs: [currentSource], idempotencyKey: "reader-reviewed" }, context)
    if (producer.status !== "ok" || reviewed.status !== "ok") throw new Error("Reader scenario persistence unavailable")
    const promotion: CurrentChoicePromotion = { caseRef, choiceId: choice.id, choiceDigest: digestSfValue(choice), alternativeRef: { id: "selected", version: 1 }, resultRef: reviewed.value.resultRef, resultDigest: reviewed.value.resultDigest, scenario: currentScenario, coverageRef: "fixture-current-coverage" }
    const bindingBody = { schema: "sf-current-choice-binding-v1" as const, promotion, originalSource, source: currentSource, producerResultRef: producer.value.resultRef, producerResultDigest: producer.value.resultDigest }
    const binding: CurrentChoiceBinding = { ...bindingBody, recordDigest: digestSfValue(bindingBody) }
    const preferences = await state.read(request, "preferences", () => null)
    if (preferences.status !== "ok") throw new Error("Reader preferences unavailable")
    const putBinding = async (value: SfProductState) => { value.preferences[`sf:proposal-coverage:current-choice:${digestSfValue(promotion.resultRef)}`] = binding; return { commit: true, value: true } }
    writes.add(putBinding)
    const persisted = await state.transaction(request, { namespace: "preferences", expectedStorageVersion: preferences.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-private-current-choice-binding", commandDigest: digestSfValue(binding) }, putBinding).finally(() => writes.delete(putBinding))
    if (persisted.status !== "ok" || !persisted.value) throw new Error("Reader private binding unavailable")
    // Reading a retained binding must not require permission to write it.
    access.preferencesWrite = false

    const race = { armed: false, authorizations: 0, applied: false }
    let unexpectedProducerCalls = 0
    const unused = (): never => { unexpectedProducerCalls += 1; throw new Error("Reader must not calculate, prepare, promote or dispatch") }
    const unusedAsync = async (): Promise<never> => unused()
    const preview = createCurrentChoicePreview({ state, host, results, writes,
      sources: { resolveForecastCoverage: unusedAsync }, coverageEvidence: { entries: unusedAsync, resolve: unusedAsync, supports: unused, verifySnapshot: unused },
      authorizePreview: async () => false, resimulate: unusedAsync, registerCoverage: unusedAsync, verifySnapshot: unused,
      operationIdentity: (trusted) => trusted.kind === "ui" ? ui.operationIdentity(trusted) : undefined,
      verifySources: async (value) => digestSfValue(value.originalSource) === digestSfValue(originalSource) && digestSfValue(value.source) === digestSfValue(currentSource) && await ui.revalidate(context),
      authorizeCase: async (value) => {
        const allowed = await authorizeCase(value)
        if (race.armed && ++race.authorizations === 2) {
          if (revocation === "membership") {
            const current = await state.read(request, "cases", (stored) => stored.cases[caseRef.id])
            if (current.status !== "ok" || !current.value) throw new Error("Race case unavailable")
            const removed = await state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "remove-member-during-final-authorization", commandDigest: digestSfValue({ caseRef, remove: identity.principalRef }) }, async (stored) => {
              const actual = stored.cases[caseRef.id]
              if (!actual || digestSfValue(actual) !== digestSfValue(current.value)) return { commit: false, value: false }
              stored.cases[caseRef.id] = { ...actual, version: actual.version + 1, participants: [] }
              return { commit: true, value: true }
            })
            if (removed.status !== "ok" || !removed.value) throw new Error("Membership race did not commit")
          } else {
            access.preferencesRead = false
          }
          race.applied = true
        }
        // The callback legitimately authorized the supplied snapshot. The global
        // UI lease remains valid; final case and namespace fences must see the change.
        return allowed
      },
    })
    expect(await preview.read(promotion, context)).toEqual({ status: "ok", value: binding })
    race.armed = true
    const read = await preview.read(promotion, context)
    expect(race).toEqual({ armed: true, authorizations: 2, applied: true })
    expect(read).toEqual({ status: "stale", reason: "choice-preview-changed" })
    expect(read).not.toHaveProperty("value")
    expect(await ui.revalidate(context)).toBe(true)
    const after = await state.read(request, "cases", (stored) => stored.cases[caseRef.id])
    expect(after).toMatchObject({ status: "ok", value: { version: revocation === "membership" ? 3 : 2, participants: revocation === "membership" ? [] : [identity.principalRef], choices: [choice], preparedChanges: [], receipts: [] } })
    if (revocation === "preferences read") expect(await state.read(request, "preferences", () => true)).toEqual({ status: "denied", reason: "product-access-unavailable" })
    expect(decision.participants).toEqual([identity.principalRef])
    expect(unexpectedProducerCalls).toBe(0)
  } finally {
    if (admittedContext) ui.finish(admittedContext)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
