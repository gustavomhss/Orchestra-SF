import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "../c12-receipt-recovery/fixture.ts"
import { interruptC12AfterCommit, observeC12 } from "../c12-receipt-recovery/consumer.ts"

for (const kind of ["choice", "prepared-change"] as const) {
  test(`C12 recovery refuses a duplicate ${kind} identity before admission without linking or redispatching`, async () => {
    const fixture = await createC12Fixture(`c12-duplicate-${kind}-admission`, "https://local.invalid")
    try {
      const prepared = await prepareC12Change(fixture)
      const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
      expect(reviewed.response.status).toBe(200)
      interruptC12AfterCommit(fixture)
      const interrupted = await fixture.http("decision-apply", {
        ...prepared.request, reviewDigest: readReviewDigest(reviewed.body),
      }, "alice", `c12-duplicate-${kind}-original`)
      expect(interrupted.response.status).toBe(503)
      expect(interrupted.body).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
      const committed = await observeC12(fixture)
      expect(fixture.receiptCommits).toHaveLength(1)
      expect(committed.receipts).toHaveLength(1)
      expect(committed.receipts[0]!.principalRef).toBe("alice")
      expect(committed.receipts[0]!.result.ok).toBe(true)
      expect(committed.decision.receipts).toEqual([])
      expect(committed.decision.preparedChanges).toEqual([prepared.change])
      expect(object(committed.domain.request.pr).estAmount).toBe(150)
      expect(committed.domain.version).toEqual({ version: 1, by: "alice" })
      expect(rows(committed.domain.request.history)).toHaveLength(1)
      expect(rows(committed.domain.request.history)[0]).toMatchObject({ action: "Saved", by: "alice" })
      const current = await fixture.storedCase()
      const originalChoice = current.value.choices.find((choice) => choice.id === prepared.request.choiceId)!
      const duplicateChoice = {
        ...originalChoice,
        reason: "A second entry reuses the original choice identity with a different amount",
        scenario: { ...originalChoice.scenario, operations: originalChoice.scenario.operations.map((operation) => ({ ...operation, amount: 900 })) },
      }
      const duplicateChange = {
        ...prepared.change,
        operation: { ...prepared.change.operation, command: {
          ...prepared.change.operation.command, values: { pr: { estAmount: 900 } },
        } },
      }
      // Corrupt-input setup through real C08: preserve the valid first entry so
      // find() cannot distinguish this ambiguous identity from the original intent.
      const changed = {
        ...current.value, version: current.value.version + 1,
        choices: kind === "choice" ? [...current.value.choices, duplicateChoice] : current.value.choices,
        preparedChanges: kind === "prepared-change" ? [...current.value.preparedChanges, duplicateChange] : current.value.preparedChanges,
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
      const before = await observeC12(fixture)
      expect(before.decision).toEqual(changed)
      expect(before.decision.choices[0]).toEqual(originalChoice)
      expect(before.decision.preparedChanges[0]).toEqual(prepared.change)
      expect(before.decision.choices.filter((choice) => choice.id === originalChoice.id)).toHaveLength(kind === "choice" ? 2 : 1)
      expect(before.decision.preparedChanges.filter((change) => change.id === prepared.change.id)).toHaveLength(kind === "prepared-change" ? 2 : 1)
      const durable = await fixture.durable()
      const recovery = await fixture.http("decision-recover", {
        purpose: "recover", ...prepared.request,
        caseRef: { id: changed.id, incarnation: changed.incarnation, version: changed.version },
      }, "alice", `c12-duplicate-${kind}-recovery`)
      const observed = await observeC12(fixture)
      console.info("SF_C12_DUPLICATE_IDENTITY_OBSERVED", JSON.stringify({
        kind, status: recovery.response.status, result: recovery.body,
        effects: fixture.receiptCommits.length, receipts: observed.receipts.length,
        linkedReceipts: observed.decision.receipts.length,
        initialCaseVersion: changed.version, observedCaseVersion: observed.decision.version,
        choiceCount: observed.decision.choices.length, preparedChangeCount: observed.decision.preparedChanges.length,
      }))
      expect(recovery.response.status).toBe(409)
      expect(recovery.body).toEqual({ status: "stale", reason: "prepared-case-changed" })
      expect(recovery.body.value).toBeUndefined()
      expect(JSON.stringify(recovery.body)).not.toContain(committed.receipts[0]!.id)
      expect(await fixture.durable()).toEqual(durable)
      expect(observed).toEqual(before)
      expect(observed.domain).toEqual(committed.domain)
      expect(observed.receipts).toEqual(committed.receipts)
      expect(observed.decision.objective).toBe(committed.decision.objective)
      expect(observed.decision.ledger).toEqual(committed.decision.ledger)
      expect(observed.decision.receipts).toEqual([])
      expect(observed.decision.preparedChanges.every((change) => change.state === "planned" && change.receipt === undefined)).toBe(true)
      expect(fixture.receiptCommits).toHaveLength(1)
    } finally { await fixture.dispose() }
  }, 90_000)
}
