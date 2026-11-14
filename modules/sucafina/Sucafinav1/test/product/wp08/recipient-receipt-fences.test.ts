import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"
import { createReviewAnswersFixture } from "./review-answers-fixture.ts"
import { receiptQuestion, receiptState, replyIntent, replyWith } from "./recipient-receipt-fixture.ts"

test("recipient receipt revocation before retry denies the old admission and leaves C08 intact", async () => {
  const f = await createThreadActorsFixture()
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    available(await replyWith(f, intent))
    const before = await receiptState(f, thread.id)
    const admission = await f.admit("reader-b", "collaboration.thread.reply", intent)
    f.actors["reader-b"]!.enabled = false
    if (!f.port.recipientActions) throw new Error("Recipient actions unavailable")
    const refused = await f.port.recipientActions.reply(intent.id, intent.body, intent.mutation, admission)
    expect(refused.status).not.toBe("ok")
    expect(JSON.stringify(refused)).not.toContain(intent.body)
    expect(JSON.stringify(refused)).not.toContain("mutationReceipt")
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { await f.dispose() }
}, 120000)

test("recipient receipt host revocation after the final reader cannot disclose the saved outcome", async () => {
  const f = await createThreadActorsFixture()
  const authorize = f.human.authorize
  try {
    const thread = await receiptQuestion(f)
    const intent = await replyIntent(f, thread.id)
    available(await replyWith(f, intent))
    const before = await receiptState(f, thread.id)
    let checks = 0
    f.human.authorize = async (context, action, payload) => {
      const allowed = await authorize(context, action, payload)
      // Exact replay has no write callback: check 1 admits it; check 2
      // follows the final recipient reader at the result-release boundary.
      if (allowed && action === "collaboration.thread.reply" && ++checks === 2) f.actors["reader-b"]!.enabled = false
      return allowed
    }
    const refused = await replyWith(f, intent)
    expect(checks).toBe(2)
    expect(refused.status).not.toBe("ok")
    expect(JSON.stringify(refused)).not.toContain(intent.body)
    expect(JSON.stringify(refused)).not.toContain("mutationReceipt")
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { f.human.authorize = authorize; await f.dispose() }
}, 120000)

test("recipient receipt C05 ACL revocation after the final reader cannot be replaced by host authorization", async () => {
  const f = await createReviewAnswersFixture()
  const authorize = f.human.authorize
  try {
    const thread = await receiptQuestion(f, f.basis)
    const intent = await replyIntent(f, thread.id)
    available(await replyWith(f, intent))
    const before = await receiptState(f, thread.id)
    let checks = 0
    f.human.authorize = async (context, action, payload) => {
      const allowed = await authorize(context, action, payload)
      if (allowed && action === "collaboration.thread.reply" && ++checks === 2) f.access["reader-b"] = false
      return allowed
    }
    const refused = await replyWith(f, intent)
    expect(checks).toBe(2)
    expect(await f.host.revalidate(f.recipient)).toBe(true)
    expect(refused.status).not.toBe("ok")
    expect(JSON.stringify(refused)).not.toContain(intent.body)
    expect(JSON.stringify(refused)).not.toContain("mutationReceipt")
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { f.human.authorize = authorize; await f.dispose() }
}, 120000)

test("recipient receipt C05 self lease denies ACL revocation after the last asynchronous review fence", async () => {
  const f = await createReviewAnswersFixture()
  const authorize = f.human.authorize
  const source = f.options.reviewAnswerSource
  if (!source) throw new Error("Review source unavailable")
  const prepare = source.prepareThreadFence
  try {
    const thread = await receiptQuestion(f, f.basis)
    const intent = await replyIntent(f, thread.id)
    available(await replyWith(f, intent))
    const before = await receiptState(f, thread.id)
    let humanChecks = 0
    let revoked = false
    f.human.authorize = async (context, action, payload) => {
      const allowed = await authorize(context, action, payload)
      if (allowed && action === "collaboration.thread.reply") humanChecks += 1
      return allowed
    }
    source.prepareThreadFence = async (basis, context) => {
      const fence = await prepare.call(source, basis, context)
      if (!fence) return undefined
      return async () => {
        const allowed = await fence()
        if (allowed && humanChecks === 2) { f.access["reader-b"] = false; revoked = true }
        return allowed
      }
    }
    const refused = await replyWith(f, intent)
    expect(revoked).toBe(true)
    expect(humanChecks).toBe(2)
    expect(await f.host.revalidate(f.recipient)).toBe(true)
    expect(refused.status).not.toBe("ok")
    expect(JSON.stringify(refused)).not.toContain(intent.body)
    expect(JSON.stringify(refused)).not.toContain("mutationReceipt")
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { source.prepareThreadFence = prepare; f.human.authorize = authorize; await f.dispose() }
}, 120000)

test("recipient receipt C05 new reply still refuses review revocation at the commit fence", async () => {
  const f = await createReviewAnswersFixture()
  const authorize = f.human.authorize
  const transaction = f.state.transaction
  try {
    const thread = await receiptQuestion(f, f.basis)
    const intent = await replyIntent(f, thread.id)
    const before = await receiptState(f, thread.id)
    const review = await f.state.read(f.request("person"), "reviews", () => null)
    if (review.status !== "ok") throw new Error("Review storage unavailable")
    let envelope: Parameters<typeof f.state.transaction>[1] | undefined
    f.state.transaction = (request, command, work) => {
      if (command.idempotencyKey === intent.mutation.idempotencyKey) envelope = structuredClone(command)
      return transaction(request, command, work)
    }
    let revoked = false
    f.human.authorize = async (context, action, payload) => {
      const allowed = await authorize(context, action, payload)
      if (allowed && action === "collaboration.thread.reply" && f.persistence.currentSnapshots?.()) { revoked = true; f.access["reader-b"] = false }
      return allowed
    }
    const refused = await replyWith(f, intent)
    expect(revoked).toBe(true)
    expect(envelope?.sourceFence).toBe("all")
    expect(envelope?.checkNamespaces).toEqual([{ namespace: "reviews", expectedStorageVersion: review.storageVersion }])
    expect(refused.status).not.toBe("ok")
    expect(JSON.stringify(refused)).not.toContain(intent.body)
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { f.state.transaction = transaction; f.human.authorize = authorize; await f.dispose() }
}, 120000)

test("recipient receipt C05 physical source replacement with the same text ID cannot revive a saved reply", async () => {
  const f = await createReviewAnswersFixture()
  try {
    const thread = await receiptQuestion(f, f.basis)
    const intent = await replyIntent(f, thread.id)
    available(await replyWith(f, intent))
    const before = await receiptState(f, thread.id)
    const original = await f.snapshots()
    const physical = sfSourceIdentity(original.dashboard, "projects", "project")
    expect(physical).toBeDefined()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: original.dashboard.versions["projects:project"]!.version, values: {} })
    // Canonical commands reject tombstone reuse. This is an explicitly hostile
    // storage replacement, observed by the real physical lifecycle producer.
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [...rows(snapshot.data.projects), { ...object(rows(original.dashboard.data.projects).find((row) => row.id === "project")), id: "project", name: "Replacement source with the same ID" }]
      return { commit: true, value: undefined }
    })
    const replacement = sfSourceIdentity((await f.snapshots()).dashboard, "projects", "project")
    expect(replacement).toBeDefined()
    expect(replacement!.incarnation).not.toBe(physical!.incarnation)
    const refused = await replyWith(f, intent)
    expect(refused.status).not.toBe("ok")
    expect(JSON.stringify(refused)).not.toContain(intent.body)
    expect(JSON.stringify(refused)).not.toContain("mutationReceipt")
    expect(await receiptState(f, thread.id)).toEqual(before)
  } finally { await f.dispose() }
}, 120000)
