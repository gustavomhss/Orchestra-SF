import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PreparedChange } from "../../../product/contracts/decisions.ts"
import { createC12Fixture, prepareC12Change, readReviewDigest, changedReviewDigest } from "./fixture.ts"
import { interruptC12AfterCommit, observeC12 } from "./consumer.ts"
import { appendPendingPlannerChange } from "./partial.ts"

type Fixture = Awaited<ReturnType<typeof createC12Fixture>>

test("C12 recovery with no original receipt is read-only even after a valid review", async () => {
  const fixture = await createC12Fixture("c12-missing-receipt", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const before = await fixture.durable()
    for (const payload of [{ purpose: "recover", ...prepared.request }, application]) {
      const missing = await fixture.http("decision-recover", payload)
      expect(missing.response.status).toBe(503)
      expect(missing.body.status).toBe("unavailable")
      expect(missing.body.value).toBeUndefined()
      expect(await fixture.durable()).toEqual(before)
      expect(fixture.receiptCommits).toEqual([])
    }
    expect(object((await fixture.material()).request.pr).estAmount).toBe(100)
    expect(rows((await fixture.material()).request.history)).toEqual([])
    const applied = await fixture.http("decision-apply", application)
    expect(applied.response.status).toBe(200)
    expect(fixture.receiptCommits).toHaveLength(1)
    expect(object((await fixture.material()).request.pr).estAmount).toBe(150)
    console.info("SF_C12_MISSING_RECEIPT", JSON.stringify({ missingRecovery: "unavailable", durableMutations: 0, normalApplyAfterwards: applied.response.status }))
  } finally { await fixture.dispose() }
}, 90_000)

test("C12 a committed intent without its domain receipt cannot authorize redispatch", async () => {
  const fixture = await createC12Fixture("c12-reserved-without-receipt", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    const before = await observeC12(fixture)
    // Revoke only after the host's real intent reservation committed in C08/SQLite,
    // before confirmApplication can authorize the first domain dispatch.
    fixture.afterIntentCommit(() => fixture.revoke("alice"))
    const interrupted = await fixture.http("decision-apply", application, "alice", "c12-ambiguous-attempt")
    expect([403, 503]).toContain(interrupted.response.status)
    expect(interrupted.body.value).toBeUndefined()
    expect(fixture.intentCommits.interleavings).toBe(1)
    fixture.restoreFixtureAccess("alice")
    expect(await observeC12(fixture)).toEqual(before)
    const reserved = await fixture.durable()
    const intents = Object.values(object(object(reserved.state).transactions))
      .map((entry) => object(object(entry).value)).filter((entry) => entry.schema === "sf-c12-application-intent-v1")
    expect(intents).toHaveLength(1)
    expect(intents[0]!.admitted).toEqual(application)
    expect(object(reserved.state).receipts).toEqual({})
    expect(fixture.receiptCommits).toEqual([])
    const recovery = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(recovery.response.status).toBe(503)
    expect(recovery.body).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
    expect(await fixture.durable()).toEqual(reserved)
    const retried = await fixture.http("decision-apply", application, "alice", "c12-ambiguous-attempt")
    expect(retried.response.status).toBe(503)
    expect(retried.body).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
    expect(await fixture.durable()).toEqual(reserved)
    expect(await observeC12(fixture)).toEqual(before)
    expect(fixture.receiptCommits).toEqual([])
    console.info("SF_C12_INTENT_WITHOUT_RECEIPT", JSON.stringify({ realIntentCommits: intents.length, receiptCount: 0, recovery: recovery.response.status, ordinaryRetry: retried.response.status, domainEffects: 0 }))
  } finally { await fixture.dispose() }
}, 90_000)

test("C12 recovery rejects altered digest payload principal case and target identity while preserving the real receipt", async () => {
  const fixture = await createC12Fixture("c12-recovery-identity", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    const application = { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) }
    interruptC12AfterCommit(fixture)
    const interrupted = await fixture.http("decision-apply", application, "alice", "c12-original")
    expect(interrupted.response.status).toBe(503)
    expect(interrupted.body).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    const committed = await observeC12(fixture)
    expect(committed.receipts).toHaveLength(1)
    const before = await fixture.durable()
    const wrongDigest = await fixture.http("decision-recover", { ...application, reviewDigest: changedReviewDigest(application.reviewDigest) })
    expect(wrongDigest.response.status).toBe(409)
    expect(wrongDigest.body.value).toBeUndefined()
    expect(await fixture.durable()).toEqual(before)

    for (const payload of [
      { purpose: "recover", ...prepared.request, target: { id: "PR-other" } },
      { purpose: "recover", ...prepared.request, principalRef: "bob" },
      { purpose: "recover", ...prepared.request, command: { amount: 999 } },
      { purpose: "recover", ...prepared.request, reviewDigest: application.reviewDigest },
    ]) {
      const rejected = await fixture.http("decision-recover", payload)
      expect(rejected.response.status).toBe(400)
      expect(rejected.body.value).toBeUndefined()
      expect(await fixture.durable()).toEqual(before)
    }
    for (const payload of [
      { ...prepared.request, caseRef: { ...prepared.request.caseRef, incarnation: "different-case-incarnation" } },
      { ...prepared.request, caseRef: { ...prepared.request.caseRef, id: "different-case" } },
      { ...prepared.request, caseRef: { ...prepared.request.caseRef, version: committed.decision.version + 1 } },
      { ...prepared.request, choiceId: "different-choice" },
      { ...prepared.request, changeId: "different-change" },
    ]) {
      const rejected = await fixture.http("decision-recover", { purpose: "recover", ...payload })
      expect([403, 409, 503]).toContain(rejected.response.status)
      expect(rejected.body.value).toBeUndefined()
      expect(await fixture.durable()).toEqual(before)
    }
    await fixture.select("bob")
    const beforeBob = await fixture.durable()
    const otherPrincipal = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request }, "bob")
    expect([403, 409, 503]).toContain(otherPrincipal.response.status)
    expect(otherPrincipal.body.value).toBeUndefined()
    expect(await fixture.durable()).toEqual(beforeBob)

    // These are explicit corrupt-input controls, not historical issued changes.
    // Only C08 fixture setup changes the prepared bytes; recovery may not trust them.
    const variants: { name: string; change: PreparedChange }[] = [
      { name: "command payload", change: { ...prepared.change, operation: { ...prepared.change.operation,
        command: { ...prepared.change.operation.command, values: { pr: { estAmount: 999 } } } } } },
      { name: "command digest", change: { ...prepared.change, operation: { ...prepared.change.operation,
        commandDigest: changedReviewDigest(prepared.change.operation.commandDigest) } } },
      { name: "target", change: { ...prepared.change, target: { ...prepared.change.target, id: "PR-other" },
        operation: { ...prepared.change.operation, target: { ...prepared.change.operation.target, id: "PR-other" } } } },
      { name: "incarnation", change: { ...prepared.change, target: { ...prepared.change.target, incarnation: "replacement-incarnation" },
        operation: { ...prepared.change.operation, target: { ...prepared.change.operation.target, incarnation: "replacement-incarnation" } } } },
      { name: "intention key", change: { ...prepared.change, idempotencyKey: "different-intention",
        operation: { ...prepared.change.operation, idempotencyKey: "different-intention" } } },
    ]
    for (const variant of variants) {
      const request = await replaceChange(fixture, variant.change)
      const tampered = await fixture.durable()
      const rejected = await fixture.http("decision-recover", { purpose: "recover", ...request })
      expect([403, 409, 503]).toContain(rejected.response.status)
      expect(rejected.body.value).toBeUndefined()
      expect(await fixture.durable()).toEqual(tampered)
      expect((await observeC12(fixture)).receipts).toEqual(committed.receipts)
    }
    const restored = await replaceChange(fixture, prepared.change)
    const recovered = await fixture.http("decision-recover", { purpose: "recover", ...restored }, "alice", "new-session-intention")
    expect(recovered.response.status).toBe(200)
    expect(object(recovered.body.value).receiptId).toBe(committed.receipts[0]!.id)
    expect((await observeC12(fixture)).domain).toEqual(committed.domain)
    expect((await observeC12(fixture)).receipts).toEqual(committed.receipts)
    expect((await observeC12(fixture)).decision.objective).toBe("Concurrent authorized case edit")
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_C12_RECOVERY_IDENTITY", JSON.stringify({ wrongDigest: wrongDigest.response.status, otherPrincipal: otherPrincipal.response.status, alteredPreparedInputs: variants.map((entry) => entry.name), restoredOriginal: recovered.response.status, receiptId: committed.receipts[0]!.id }))
  } finally { await fixture.dispose() }
}, 120_000)

test("C12 recovery rechecks revocation after its receipt read and rejects a replaced physical target", async () => {
  const fixture = await createC12Fixture("c12-last-read-revocation", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    expect((await fixture.http("decision-apply", { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) })).response.status).toBe(200)
    const committed = await observeC12(fixture)
    const before = await fixture.durable()
    const reads = fixture.receiptReads.count
    // The target already has a linked real receipt, so replay must return it only
    // after reauthorization of the actual persisted receipt read.
    fixture.afterReceiptRead(() => fixture.revoke("alice"))
    const revoked = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(fixture.receiptReads.count).toBe(reads + 1)
    expect(fixture.receiptReads.interleavings).toBe(1)
    expect([403, 503]).toContain(revoked.response.status)
    expect(revoked.body.value).toBeUndefined()
    expect(JSON.stringify(revoked.body)).not.toContain(committed.receipts[0]!.id)
    expect(await fixture.durable()).toEqual(before)
    fixture.restoreFixtureAccess("alice")
    const allowed = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(allowed.response.status).toBe(200)
    expect(object(allowed.body.value).receiptId).toBe(committed.receipts[0]!.id)
    expect(await observeC12(fixture)).toEqual(committed)

    const recover = fixture.business.procurementDecisions.recover
    const retentionResults: Awaited<ReturnType<typeof recover>>[] = []
    // Observe the real producer return without replacing its value. The composed
    // withCase boundary must still reauthorize before disclosing that response.
    fixture.business.procurementDecisions.recover = async (...args) => {
      const result = await recover(...args)
      retentionResults.push(structuredClone(result))
      return result
    }
    fixture.beforeRetentionReadReturn(() => fixture.revoke("alice"))
    const lastReadRevoked = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
      .finally(() => { fixture.business.procurementDecisions.recover = recover })
    expect(fixture.receiptReads.finalReadInterleavings).toBe(1)
    expect(retentionResults).toEqual([{ status: "unavailable", reason: "receipt-authority-changed" }])
    expect(lastReadRevoked.response.status).toBe(403)
    expect(lastReadRevoked.body).toEqual({ status: "denied", reason: "case-selection-authority-changed" })
    expect(JSON.stringify(lastReadRevoked.body)).not.toContain(committed.receipts[0]!.id)
    expect(await fixture.durable()).toEqual(before)
    fixture.restoreFixtureAccess("alice")
    const finalAllowed = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(finalAllowed.response.status).toBe(200)
    expect(finalAllowed.body).toEqual(allowed.body)
    expect(await observeC12(fixture)).toEqual(committed)

    await fixture.persistence.transaction("procurement", async (snapshot) => {
      delete object(object(snapshot.data.store).requests)["PR-1"]
      return { commit: true, value: undefined }
    })
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      object(object(snapshot.data.store).requests)["PR-1"] = { request: committed.domain.request, version: 1, by: "alice" }
      return { commit: true, value: undefined }
    })
    const replacement = await fixture.durable()
    const rejected = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect([403, 409, 503]).toContain(rejected.response.status)
    expect(rejected.body.value).toBeUndefined()
    expect(await fixture.durable()).toEqual(replacement)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_C12_REVOKED_OR_REPLACED", JSON.stringify({ revocationAfterReceiptRead: true, revokedStatus: revoked.response.status, lastStateReadRevocation: lastReadRevoked.response.status, retentionResult: retentionResults[0], egressReason: lastReadRevoked.body.reason, finalReadInterleavings: fixture.receiptReads.finalReadInterleavings, reauthorizedStatus: finalAllowed.response.status, replacementStatus: rejected.response.status, duplicateEffects: 0 }))
  } finally { await fixture.dispose() }
}, 90_000)

test("C12 Procurement recovery preserves partial execution and cannot dispatch another domain", async () => {
  const fixture = await createC12Fixture("c12-other-domain-partial", "https://local.invalid")
  try {
    const prepared = await prepareC12Change(fixture)
    const reviewed = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(reviewed.response.status).toBe(200)
    expect((await fixture.http("decision-apply", { ...prepared.request, reviewDigest: readReviewDigest(reviewed.body) })).response.status).toBe(200)
    const committed = await observeC12(fixture)
    const foreign = await appendPendingPlannerChange(fixture)
    const partial = await fixture.durable()
    const denied = await fixture.http("decision-recover", { purpose: "recover", ...foreign.request })
    expect([403, 409, 503]).toContain(denied.response.status)
    expect(denied.body.value).toBeUndefined()
    expect(await fixture.durable()).toEqual(partial)
    const recovered = await fixture.http("decision-recover", { purpose: "recover", ...prepared.request })
    expect(recovered.response.status).toBe(200)
    expect(object(recovered.body.value).receiptId).toBe(committed.receipts[0]!.id)
    expect(await fixture.durable()).toEqual(partial)
    const after = await observeC12(fixture)
    expect(after.decision.state).toBe("partially-applied")
    expect(after.decision.preparedChanges.find((change) => change.id === foreign.change.id)).toEqual(foreign.change)
    expect(after.receipts).toEqual(committed.receipts)
    expect(after.domain).toEqual(committed.domain)
    expect(fixture.receiptCommits).toHaveLength(1)
    console.info("SF_C12_PARTIAL_DOMAIN", JSON.stringify({ otherDomain: "planner", otherDomainState: "planned", foreignRecovery: denied.response.status, originalRecovery: recovered.response.status, originalReceipt: committed.receipts[0]!.id, otherDomainReceiptFabricated: false }))
  } finally { await fixture.dispose() }
}, 90_000)

async function replaceChange(fixture: Fixture, change: PreparedChange) {
  const current = await fixture.storedCase()
  const next = { ...current.value, version: current.value.version + 1,
    preparedChanges: current.value.preparedChanges.map((item) => item.id === change.id ? change : item) }
  const saved = await fixture.authority.state.transaction(fixture.request(), {
    namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: next.id, targetIncarnation: next.incarnation,
    idempotencyKey: randomUUID(), commandDigest: digestSfValue(next),
  }, async (state) => { state.cases[next.id] = next; return { commit: true, value: true } })
  if (saved.status !== "ok") throw new Error("C08 negative fixture update failed: " + saved.status)
  return { caseRef: { id: next.id, incarnation: next.incarnation, version: next.version }, choiceId: change.choiceId, changeId: change.id }
}

