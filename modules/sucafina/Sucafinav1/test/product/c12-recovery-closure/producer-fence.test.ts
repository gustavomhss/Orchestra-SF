import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { receiptProofMatches } from "../../../product/decisions/receipt-review-binding.ts"
import { openPlannerRecoveryFixture } from "./planner-fixture.ts"

test("C12 direct producer requires private review admission and replays only its genuine original raw receipt", async () => {
  const fixture = await openPlannerRecoveryFixture()
  try {
    const ready = await fixture.prepare()
    const before = await fixture.observe()
    // The authenticated body includes the real review digest. Its presence alone
    // cannot replace createDecisionReviewAdmission's exact private binding.
    const unbound = await fixture.admit("decisions.apply", ready.original, "unbound-original-review")
    expect(await fixture.producer.executePrepared(ready.request, unbound))
      .toEqual({ status: "needs-input", reason: "review-proof-required" })
    expect(await fixture.observe()).toEqual(before)
    expect(fixture.counters.domainExecutions).toBe(0)

    const admitted = await fixture.admitApply(ready.original)
    const applied = await fixture.producer.executePrepared(ready.request, admitted)
    expect(applied.status).toBe("ok")
    if (applied.status !== "ok") throw new Error(applied.reason)
    const after = await fixture.observe()
    const receipt = applied.value
    const proof = Object.values(after.state.transactions).filter((entry) => entry.namespace === "receipts")
    expect(proof).toHaveLength(1)
    expect(proof[0]).toMatchObject({ namespace: "receipts", principalRef: "finance", targetRef: "v1",
      targetIncarnation: ready.change.target.incarnation,
      scopeDigest: digestSfValue({ namespaces: ["cases", "receipts"], domainSurface: "planner" }), value: receipt })
    expect(proof[0]!.value).toEqual(receipt)
    expect(Object.values(after.state.receipts)).toEqual([receipt])
    expect(after.decision!.receipts).toHaveLength(0)
    expect(after.decision!.preparedChanges[0]!.state).toBe("planned")
    expect(after.domain.versions["v1:lines:line"]?.version).toBe(1)
    expect(after.domain.audit.length).toBe(before.domain.audit.length + 1)
    expect(rows(rows(after.domain.data.versions).find((value) => value.id === "v1")?.lines)[0]?.f)
      .toEqual([42, ...Array(11).fill(100)])
    expect(fixture.counters.domainExecutions).toBe(1)
    expect(fixture.counters.receiptCommits).toBe(1)
    expect(fixture.counters.caseReconciliations).toBe(0)
    // These are read-only challenges to a real C08 proof, not fabricated receipts.
    expect(receiptProofMatches(after.state, ready.change.target, receipt, "finance")).toBe(true)
    expect(receiptProofMatches(after.state, { ...ready.change.target, id: "v0" }, receipt, "finance")).toBe(false)
    expect(receiptProofMatches(after.state, { ...ready.change.target, incarnation: "recreated-target" }, receipt, "finance")).toBe(false)
    expect(receiptProofMatches(after.state, ready.change.target, receipt, "other")).toBe(false)

    expect(await fixture.producer.executePrepared(ready.request, await fixture.admitApply(ready.original, "finance", "fresh-authentic-retry")))
      .toEqual(applied)
    expect((await fixture.producer.executePrepared(ready.request, await fixture.admitApply(ready.original, "other", "different-actor"))).status)
      .not.toBe("ok")
    // A raw historical receipt without a retained outer intent cannot authorize
    // case reconciliation from today's mutable choice or dispatch again.
    expect(await fixture.apply(ready.original, { mode: "recover" }))
      .toEqual({ status: "unavailable", reason: "original-intent-unverifiable" })
    expect(fixture.counters.dispatch).toBe(0)
    expect(await fixture.observe()).toEqual(after)
    expect(fixture.counters.domainExecutions).toBe(1)
    expect(fixture.counters.receiptCommits).toBe(1)
    console.info("SF_C12_DIRECT_RAW_RECEIPT", JSON.stringify({ receiptId: receipt.id, receiptDigest: digestSfValue(receipt),
      scopeDigest: proof[0]!.scopeDigest, target: proof[0]!.targetRef, domainExecutions: fixture.counters.domainExecutions }))
  } finally { await fixture.close() }
})

test("C12 direct producer refuses a genuine domain receipt committed by C08 under the wrong proof scope", async () => {
  let fixture = await openPlannerRecoveryFixture()
  try {
    const ready = await fixture.prepare()
    const before = await fixture.observe()
    const transaction = fixture.state.transaction
    let alteredScope = 0
    // Adversarial persistence contract: execute the real producer callback and
    // real C08/domain transaction, but remove its cases scope once. C08 computes
    // the wrong scope proof itself. No receipt value or transaction is seeded.
    fixture.state.transaction = (request, command, work) => {
      if (!alteredScope && command.namespace === "receipts" && command.domainSurface === "planner") {
        alteredScope++
        const wrongScope = { ...command }
        delete wrongScope.additionalNamespaces
        return transaction(request, wrongScope, work)
      }
      return transaction(request, command, work)
    }
    const rejected = await fixture.producer.executePrepared(ready.request, await fixture.admitApply(ready.original))
    fixture.state.transaction = transaction
    expect(alteredScope).toBe(1)
    expect(rejected.status).toBe("unavailable")
    expect("value" in rejected).toBe(false)
    const committed = await fixture.observe()
    const receipts = Object.values(committed.state.receipts)
    const proofs = Object.values(committed.state.transactions).filter((entry) => entry.namespace === "receipts")
    expect(receipts).toHaveLength(1)
    expect(proofs).toHaveLength(1)
    expect(proofs[0]!.value).toEqual(receipts[0])
    expect(proofs[0]!.scopeDigest).toBe(digestSfValue({ namespaces: ["receipts"], domainSurface: "planner" }))
    expect(receiptProofMatches(committed.state, ready.change.target, receipts[0]!, "finance")).toBe(false)
    expect(committed.domain.versions["v1:lines:line"]?.version).toBe(1)
    expect(committed.domain.audit.length).toBe(before.domain.audit.length + 1)
    expect(committed.decision!.receipts).toHaveLength(0)
    expect(fixture.counters.domainExecutions).toBe(1)
    expect(fixture.counters.receiptCommits).toBe(1)

    const directory = fixture.directory
    const oldAuthority = fixture.ui
    await fixture.close(false)
    fixture = await openPlannerRecoveryFixture({ directory, caseRef: ready.request.caseRef })
    expect(fixture.ui).not.toBe(oldAuthority)
    expect(await fixture.observe()).toEqual(committed)
    const recovered = await fixture.producer.executePrepared(ready.request, await fixture.admitApply(ready.original))
    expect(recovered.status).toBe("unavailable")
    expect("value" in recovered).toBe(false)
    expect(await fixture.observe()).toEqual(committed)
    expect(fixture.counters.domainExecutions).toBe(0)
    expect(fixture.counters.receiptCommits).toBe(0)
    console.info("SF_C12_WRONG_SCOPE_REFUSED", JSON.stringify({ receiptId: receipts[0]!.id,
      rawReceiptDigest: digestSfValue(receipts[0]), retainedScopeDigest: proofs[0]!.scopeDigest,
      reopen: "SQLite-and-services", redispatch: fixture.counters.domainExecutions, exposedReceipt: "value" in recovered }))
  } finally { await fixture.close() }
})
