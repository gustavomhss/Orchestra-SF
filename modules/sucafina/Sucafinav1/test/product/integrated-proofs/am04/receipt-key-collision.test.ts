import { expect, test } from "bun:test"
import { object, rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { receiptProofKey, receiptProofTransactionKey, receiptReviewBinding } from "../../../../product/decisions/receipt-review-binding.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest } from "../../c12-receipt-recovery/fixture.ts"
import { observeC12 } from "../../c12-receipt-recovery/consumer.ts"

// The public Procurement HTTP action creates the original transaction, domain
// effect and receipt. A new original HTTP Apply admission scopes retry/collision
// against the same C08 state port and composite identity, never a borrowed lease.
test("AM04 original domain receipt is replayed by identical key+digest and different content is rejected before mutation callback", async () => {
  const fixture = await createC12Fixture("am04-durable-key-digest", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const digest = readReviewDigest(reviewed.body)
    const application = { ...prepared.request, reviewDigest: digest }
    const applicationKey = "am04-key-digest-original-human-command"
    const applied = await fixture.http("decision-apply", application, "alice", applicationKey)
    expect(applied.response.status).toBe(200)
    const committed = await observeC12(fixture)
    expect(committed.receipts).toHaveLength(1)
    expect(object(committed.domain.request.pr).estAmount).toBe(150)
    expect(rows(committed.domain.request.history)).toHaveLength(1)
    const recorded = committed.receipts[0]!
    expect(recorded).toMatchObject({
      surface: "procurement", idempotencyKey: prepared.change.idempotencyKey,
      commandDigest: prepared.change.operation.commandDigest, result: { ok: true },
    })
    const transaction = await fixture.authority.state.read(fixture.request(), "receipts",
      (state, authority) => state.transactions[receiptProofTransactionKey(
        authority.principalRef, prepared.change.target.id, prepared.change.idempotencyKey)])
    if (transaction.status !== "ok" || !transaction.value) throw new Error("Original durable receipt transaction absent")
    expect(transaction.value.commandDigest).toBe(receiptReviewBinding(prepared.change, digest))
    expect(transaction.value.value).toEqual(recorded)
    const receiptState = await fixture.authority.state.read(fixture.request(), "receipts", () => true)
    const caseState = await fixture.authority.state.read(fixture.request(), "cases", () => true)
    if (receiptState.status !== "ok" || caseState.status !== "ok") throw new Error("Authorized storage versions unavailable")
    const command = {
      namespace: "receipts" as const, domainSurface: "procurement" as const,
      expectedStorageVersion: receiptState.storageVersion,
      additionalNamespaces: [{ namespace: "cases" as const, expectedStorageVersion: caseState.storageVersion }],
      targetRef: prepared.change.target.id, targetIncarnation: prepared.change.target.incarnation,
      idempotencyKey: receiptProofKey(prepared.change.idempotencyKey),
      commandDigest: receiptReviewBinding(prepared.change, digest),
    }
    let duplicateDomainCallbacks = 0
    const forbidden = async () => {
      duplicateDomainCallbacks++
      throw new Error("DUPLICATE_DOMAIN_MUTATION_EXECUTED")
    }
    // A fresh Request outside a human Apply cannot reuse a completed lease.
    expect(await fixture.authority.state.transaction(fixture.request(), command, forbidden))
      .toEqual({ status: "denied", reason: "target-access-unavailable" })
    const retryRequest = fixture.request("alice", "decision-apply", application, applicationKey)
    const probes: { count: number; same?: unknown; changed?: unknown; copiedRequest?: unknown } = { count: 0 }
    // This scheduling hook runs after a real receipt read, outside the store lock,
    // while THIS HTTP Request has its own original human/withCase/Apply admission.
    fixture.afterReceiptRead(async () => {
      probes.count++
      probes.same = await fixture.authority.state.transaction(retryRequest, command, forbidden)
      probes.changed = await fixture.authority.state.transaction(retryRequest, {
        ...command, commandDigest: digestSfValue({
          schema: "am04-collision-probe-v1", originalReceiptId: recorded.id, alteredContent: true,
        }),
      }, forbidden)
      // Identical headers/body/key on another Request do not borrow that admission.
      probes.copiedRequest = await fixture.authority.state.transaction(
        fixture.request("alice", "decision-apply", application, applicationKey), command, forbidden)
    })
    const replayed = await fixture.application(retryRequest)
    expect(probes.count).toBe(1)
    expect(fixture.receiptReads.interleavings).toBe(1)
    expect(probes.same).toMatchObject({ status: "ok", value: recorded })
    expect(probes.changed).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    expect(probes.copiedRequest).toEqual({ status: "denied", reason: "target-access-unavailable" })
    expect(replayed?.status).toBe(200)
    expect(object(await replayed?.json())).toEqual(applied.body)
    // The exact admitted Request also loses receipt-write authority after HTTP exit.
    expect(await fixture.authority.state.transaction(retryRequest, command, forbidden))
      .toEqual({ status: "denied", reason: "target-access-unavailable" })
    expect(duplicateDomainCallbacks).toBe(0)
    expect(await observeC12(fixture)).toEqual(committed)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_AM04_REAL_RECEIPT_IDEMPOTENCY_COMPONENT", JSON.stringify({
      originalReceiptId: recorded.id, realDomainCommand: "Procurement Requests.save",
      identicalKeyAndDigestRecoveredOriginal: true, changedDigestConflict: true,
      duplicateDomainCallbacks: 0, physicalHistoryEffects: 1,
      store: "SQLite transactionAll", requestAuthority: "component fixture, not installed corporate identity",
      hostedRun: "NOT_RUN",
    }))
  } finally { await fixture.dispose() }
}, 90_000)
