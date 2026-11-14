import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import { createRenewalChoiceHistory } from "./renewal-choice-fixture.ts"
import { createRenewalHumanChoices, type RenewalHumanChoiceRequest } from "./renewal-human-choice-fixture.ts"

const refFor = (decision: DecisionCase) => ({ id: decision.id, incarnation: decision.incarnation, version: decision.version })

/** Real human admission/intent, canonical Planner readers and C08 in one case.
 * Source revision/classification is the published synthetic financial fixture, not a browser/native proof.
 */
test("new human operations replace a choice after the quote revision and retain that choice with a new reason without rewriting any history", async () => {
  const history = await createRenewalChoiceHistory()
  const human = createRenewalHumanChoices(history)
  try {
    const firstRequest: RenewalHumanChoiceRequest = {
      caseRef: history.before.caseRef,
      alternativeId: "selected", alternativeVersion: history.before.selectedResult.costCoverage.alternativeVersion,
      comparison: { scenarioRefs: [history.before.baselineRef, history.before.selectedRef], criteria: ["renewal-difference"] },
      criteria: ["renewal-difference"], reason: "Choose the transition conditionally while its explicitly excluded training quote is still missing; no application is authorized.",
    }
    const originalOperation = "human-chooses-conditioned-transition"
    expect((await human.admit(originalOperation, firstRequest, "https://untrusted.example")).status).toBe("denied")
    const firstGrant = await human.admit(originalOperation, firstRequest)
    if (firstGrant.status !== "ok") throw new Error(firstGrant.reason)
    expect(human.ui.operationIdentity(firstGrant.value)).toBe(originalOperation)
    expect(await human.human.authorize(firstGrant.value, "decisions.apply", firstRequest)).toBe(false)
    const plannerBeforeFirstChoice = await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const first = await human.mutations.recordChoice(firstRequest, firstGrant.value)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error(`First human choice failed:${first.reason}`)
    const selected = await history.readCase()
    expect(selected.choices).toHaveLength(1)
    const originalChoice = structuredClone(selected.choices[0]!)
    const originalDigest = digestSfValue(originalChoice)
    expect(originalChoice).toMatchObject({ principalRef: "finance", alternativeId: "selected", reason: firstRequest.reason, result: { knownSubtotal: 210000, total: null }, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
    expect(await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBeforeFirstChoice)

    const after = await history.resolveTraining()
    human.adoptPhase(after)
    expect(after.caseRef.id).toBe(first.value.caseRef.id)
    expect(after.caseRef.incarnation).toBe(first.value.caseRef.incarnation)
    expect(after.selectedResult).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete" } })
    expect(after.comparison).toMatchObject({ knownDifference: 10000, completeDifference: 10000, criterionResults: [{ state: "failed" }] })
    expect(digestSfValue((await history.readCase()).choices[0])).toBe(originalDigest)
    const plannerAfterQuote = await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))

    const replacementRequest: RenewalHumanChoiceRequest = {
      caseRef: after.caseRef,
      alternativeId: "baseline", alternativeVersion: after.baselineResult.costCoverage.alternativeVersion,
      comparison: { scenarioRefs: [after.selectedRef, after.baselineRef], criteria: ["renewal-difference"] },
      criteria: ["renewal-difference"], reason: "Replace the earlier transition choice with renewal after seeing the separate training quote and its current cost. The original transition criterion is not silently rebound to this reversed comparison.",
    }
    const replacementOperation = "human-replaces-transition-with-renewal"
    expect((await human.mutations.recordChoice(replacementRequest, firstGrant.value)).status).toBe("denied")
    const replacementGrant = await human.admit(replacementOperation, replacementRequest)
    if (replacementGrant.status !== "ok") throw new Error(replacementGrant.reason)
    expect(replacementGrant.value).not.toBe(firstGrant.value)
    expect(human.ui.operationIdentity(replacementGrant.value)).toBe(replacementOperation)
    expect(await human.human.authorize(replacementGrant.value, "decisions.choose", firstRequest)).toBe(false)
    const replacement = await human.mutations.recordChoice(replacementRequest, replacementGrant.value)
    expect(replacement.status).toBe("ok")
    if (replacement.status !== "ok") throw new Error(`Replacement human choice failed:${replacement.reason}`)
    const replaced = await history.readCase()
    expect(replaced.choices).toHaveLength(2)
    const replacementChoice = structuredClone(replaced.choices[1]!)
    const replacementDigest = digestSfValue(replacementChoice)
    expect(replacementChoice.id).not.toBe(originalChoice.id)
    expect(replacementChoice).toMatchObject({ principalRef: "finance", alternativeId: "baseline", alternativeVersion: replacementRequest.alternativeVersion, reason: replacementRequest.reason, basisVersion: after.basis.version, result: { knownSubtotal: 240000, total: 240000 }, comparison: { comparisonStatus: "complete", knownDifference: -10000, completeDifference: -10000, criterionResults: [{ criterionId: "renewal-difference", state: "unknown" }] } })
    expect(replaced.choices[0]).toEqual(originalChoice)

    const retainRequest: RenewalHumanChoiceRequest = { ...replacementRequest, caseRef: refFor(replaced), reason: "Retain the renewal choice after reviewing the implementation schedule; preserve the quoted numbers and authorize no official application." }
    expect((await human.mutations.recordChoice(retainRequest, replacementGrant.value)).status).toBe("denied")
    // A newly admitted payload still cannot overwrite a prior operation's receipt.
    const reusedIdentity = await human.admit(replacementOperation, retainRequest)
    if (reusedIdentity.status !== "ok") throw new Error(reusedIdentity.reason)
    expect(await human.mutations.recordChoice(retainRequest, reusedIdentity.value)).toMatchObject({ status: "conflict", reason: "idempotency-content-changed" })
    expect(await history.readCase()).toEqual(replaced)

    const retainOperation = "human-retains-renewal-with-reviewed-reason"
    const retainGrant = await human.admit(retainOperation, retainRequest)
    if (retainGrant.status !== "ok") throw new Error(retainGrant.reason)
    expect(new Set([human.ui.operationIdentity(firstGrant.value), human.ui.operationIdentity(replacementGrant.value), human.ui.operationIdentity(retainGrant.value)]).size).toBe(3)
    const retained = await human.mutations.recordChoice(retainRequest, retainGrant.value)
    expect(retained.status).toBe("ok")
    if (retained.status !== "ok") throw new Error(`Retained human choice failed:${retained.reason}`)
    const final = await history.readCase()
    expect(final.choices).toHaveLength(3)
    expect(new Set(final.choices.map((choice) => choice.id)).size).toBe(3)
    expect(final.choices[0]).toEqual(originalChoice)
    expect(final.choices[1]).toEqual(replacementChoice)
    expect(digestSfValue(final.choices[0])).toBe(originalDigest)
    expect(digestSfValue(final.choices[1])).toBe(replacementDigest)
    expect(final.choices[2]).toMatchObject({ alternativeId: replacementChoice.alternativeId, alternativeVersion: replacementChoice.alternativeVersion, basisVersion: replacementChoice.basisVersion, reason: retainRequest.reason, result: replacementChoice.result, comparison: replacementChoice.comparison })
    expect(final.choices[2]!.id).not.toBe(replacementChoice.id)
    expect(final.ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(3)
    expect(final.ledger.filter((event) => event.kind === "choice-recorded").map((event) => event.outputDigest)).toEqual(final.choices.map((choice) => digestSfValue(choice)))
    expect(final.preparedChanges).toEqual([])
    expect(final.receipts).toEqual([])

    // Distinct choices produce distinct durable receipts; historical retries do not create a fourth choice.
    expect(await human.mutations.recordChoice(firstRequest, firstGrant.value)).toEqual(first)
    expect(await human.mutations.recordChoice(replacementRequest, replacementGrant.value)).toEqual(replacement)
    expect(await human.mutations.recordChoice(retainRequest, retainGrant.value)).toEqual(retained)
    expect(await history.readCase()).toEqual(final)
    const request = human.host.requestFor(retainGrant.value)
    if (!request) throw new Error("Retained human request unavailable")
    const receipts = await human.state.read(request, "cases", (state) => [originalOperation, replacementOperation, retainOperation].map((operation) => state.transactions[JSON.stringify(["finance", "cases", final.id, `${operation}:record-choice`])]))
    if (receipts.status !== "ok") throw new Error("Human operation receipts unavailable")
    expect(receipts.value.map((receipt) => receipt?.commandDigest)).toEqual([firstRequest, replacementRequest, retainRequest].map((payload) => digestSfValue(payload)))
    expect(await history.fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerAfterQuote)
  } finally {
    human.finish()
    await history.cleanup()
  }
}, 180000)
