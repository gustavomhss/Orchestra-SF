import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "../c12-receipt-recovery/fixture.ts"
import { observeC12 } from "../c12-receipt-recovery/consumer.ts"

// The amount inside the accepted choice is material to the reviewed application.
// A real C08 edit after the domain commit must not be treated as an unrelated objective edit.
test("C12 composed reconciliation refuses a material choice replacement after the domain committed", async () => {
  const fixture = await createC12Fixture("c12-composed-material-choice-race", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const before = (await fixture.storedCase()).value
    const originalChoice = before.choices.find((choice) => choice.id === prepared.request.choiceId)!
    const materialChoice = {
      ...originalChoice,
      reason: "Concurrent material choice now requests 900, not the reviewed 150",
      scenario: { ...originalChoice.scenario, operations: originalChoice.scenario.operations.map((operation) => ({ ...operation, amount: 900 })) },
    }
    fixture.afterReceiptCommit(async () => {
      const current = await fixture.storedCase()
      const changed = {
        ...current.value,
        version: current.value.version + 1,
        objective: "Concurrent authorized edit must survive the rejected reconciliation",
        choices: current.value.choices.map((choice) => choice.id === materialChoice.id ? materialChoice : choice),
      }
      const saved = await fixture.authority.state.transaction(fixture.request(), {
        namespace: "cases", expectedStorageVersion: current.storageVersion,
        targetRef: changed.id, targetIncarnation: changed.incarnation,
        idempotencyKey: randomUUID(), commandDigest: digestSfValue(changed),
      }, async (state) => {
        state.cases[changed.id] = changed
        return { commit: true, value: true }
      })
      expect(saved.status).toBe("ok")
    })
    const first = await fixture.http("decision-apply", {
      ...prepared.request, reviewDigest: readReviewDigest(reviewed.body),
    }, "alice", "c12-composed-material-race")
    const observed = await observeC12(fixture)
    // These effect/history checks precede the expected refusal so a red diagnostic
    // still distinguishes committed domain work from a pre-dispatch fixture failure.
    expect(fixture.receiptCommits).toHaveLength(1)
    expect(observed.receipts).toHaveLength(1)
    expect(observed.receipts[0]!.principalRef).toBe("alice")
    expect(observed.receipts[0]!.result.ok).toBe(true)
    expect(object(observed.domain.request.pr).estAmount).toBe(150)
    expect(observed.domain.version).toEqual({ version: 1, by: "alice" })
    expect(rows(observed.domain.request.history)).toHaveLength(1)
    expect(rows(observed.domain.request.history)[0]).toMatchObject({ action: "Saved", by: "alice" })
    expect(observed.decision.choices.find((choice) => choice.id === originalChoice.id)).toEqual(materialChoice)
    expect(observed.decision.objective).toBe("Concurrent authorized edit must survive the rejected reconciliation")
    expect(observed.decision.ledger).toEqual(before.ledger)
    console.info("SF_C12_MATERIAL_INTERLEAVING_OBSERVED", JSON.stringify({
      status: first.response.status, result: first.body,
      effects: fixture.receiptCommits.length, authoritativeReceipts: observed.receipts.length,
      linkedReceipts: observed.decision.receipts.length,
      initialCaseVersion: before.version, observedCaseVersion: observed.decision.version,
      materialChoicePreserved: digestSfValue(observed.decision.choices.find((choice) => choice.id === originalChoice.id)) === digestSfValue(materialChoice),
    }))
    expect(first.response.status).toBe(409)
    expect(observed.decision.version).toBe(before.version + 1)
    expect(observed.decision.receipts).toEqual([])
    expect(observed.decision.preparedChanges).toEqual(before.preparedChanges)
    const recovery = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(recovery.response.status).toBe(409)
    expect(recovery.body).toEqual({ status: "conflict", reason: "application-intent-mismatch" })
    expect(await observeC12(fixture)).toEqual(observed)
    expect(fixture.receiptCommits).toHaveLength(1)
  } finally { await fixture.dispose() }
}, 90_000)
