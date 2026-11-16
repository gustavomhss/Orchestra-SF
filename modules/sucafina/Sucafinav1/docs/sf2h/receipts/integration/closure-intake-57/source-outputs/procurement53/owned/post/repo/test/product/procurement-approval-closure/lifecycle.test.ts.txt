import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import type { ProcurementApprovalAction } from "../../../product/procurement/decision-preparation.ts"
import { procurementPreparationIssue } from "../../../product/procurement/prepared.ts"
import { createApprovalFixture } from "./fixture.ts"

test("explicit canonical save, submit and approve bind 140 to its frozen holder and retained CAS survives SQLite reopen", async () => {
  const fixture = await createApprovalFixture()
  const lifecycle = { current: fixture, closed: false }
  try {
    const draft = await fixture.review()
    expect(draft.review).toMatchObject({ stage: "draft", amount: 100, currency: "USD", submittedAmount: null, holderId: null, allowedActions: ["save-estimate", "submit-current"] })
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    expect(await fixture.lifecycle.review(draft.sourceRef, draft.context)).toEqual({ status: "ok", value: draft.review })
    const action: ProcurementApprovalAction = { kind: "save-estimate", amount: 140 }
    const preparing = fixture.lifecycle.prepare({ review: draft.review, action }, draft.context)
    action.amount = 900
    const edit = await preparing
    if (edit.status !== "ok") throw new Error(`Draft edit preparation unavailable: ${edit.reason}`)
    expect(edit.value).toMatchObject({ kind: "procurement-pr-lifecycle-v1", action: { kind: "save-estimate", amount: 140 }, requiresExplicitAction: true, approvalGranted: false, receipt: null })
    expect(edit.value.command).toEqual({ page: "Requests", action: "save", id: fixture.requestId, version: draft.review.domainVersion, confirmed: false, values: { pr: { estAmount: 140 } } })
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    // The effect is a separate, explicit POST through the production command endpoint.
    expect((await fixture.post("alice", edit.value.command)).status).toBe(200)
    const saved = await fixture.snapshot()
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 140 } })
    expect(saved.versions[`requests:${fixture.requestId}`]?.version).toBe(draft.review.domainVersion + 1)
    expect(saved.audit).toHaveLength(before.audit.length + 1)
    expect(saved.audit.at(-1)).toMatchObject({ who: "alice", name: "Alice", record: `requests:${fixture.requestId}` })
    expect(fixture.writes).toHaveLength(writes + 1)
    expect((await fixture.post("alice", edit.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(saved)
    expect(fixture.writes).toHaveLength(writes + 1)

    const submission = await fixture.review()
    const beforeSubmit = await fixture.snapshot()
    const submitWrites = fixture.writes.length
    expect(await fixture.lifecycle.prepare({ review: submission.review, action: { kind: "submit-current", amount: 100 } }, submission.context)).toEqual({ status: "needs-input", reason: "requisition-amount-mismatch" })
    const submit = await fixture.lifecycle.prepare({ review: submission.review, action: { kind: "submit-current", amount: 140 } }, submission.context)
    if (submit.status !== "ok") throw new Error(`Submission preparation unavailable: ${submit.reason}`)
    expect(submit.value.command).toEqual({ page: "Requests", action: "submit_pr", id: fixture.requestId, version: submission.review.domainVersion, confirmed: false, values: {} })
    expect(submit.value.approvalGranted).toBe(false)
    expect(submit.value.receipt).toBeNull()
    expect(await fixture.snapshot()).toEqual(beforeSubmit)
    expect(fixture.writes).toHaveLength(submitWrites)
    expect((await fixture.post("alice", submit.value.command)).status).toBe(200)
    const submitted = await fixture.snapshot()
    expect(await fixture.current()).toMatchObject({ status: "pr_pending", pr: { estAmount: 140 }, prApproval: { amount: 140 }, prApprovalBaseCurrency: "USD" })
    expect(rows(object((await fixture.current()).prApproval).steps).filter((step) => step.status === "pending")).toMatchObject([{ holderId: "bob" }])
    expect(submitted.audit).toHaveLength(beforeSubmit.audit.length + 1)
    expect(fixture.writes).toHaveLength(submitWrites + 1)
    expect((await fixture.post("alice", submit.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(submitted)

    const approval = await fixture.review("bob")
    expect(approval.review).toMatchObject({ stage: "pr_pending", amount: 140, submittedAmount: 140, currency: "USD", submittedCurrency: "USD", holderId: "bob", allowedActions: ["approve-submitted", "reject-submitted"] })
    const beforeApprove = await fixture.snapshot()
    const approveWrites = fixture.writes.length
    const approve = await fixture.lifecycle.prepare({ review: approval.review, action: { kind: "approve-submitted", amount: 140, holderId: "bob", comment: "Approve the submitted 140 USD" } }, approval.context)
    if (approve.status !== "ok") throw new Error(`Approval preparation unavailable: ${approve.reason}`)
    expect(approve.value.command).toEqual({ page: "Requests", action: "approve", id: fixture.requestId, version: approval.review.domainVersion, confirmed: false, values: { comment: "Approve the submitted 140 USD" } })
    expect(approve.value.approvalGranted).toBe(false)
    expect(approve.value.receipt).toBeNull()
    expect(await fixture.snapshot()).toEqual(beforeApprove)
    expect(fixture.writes).toHaveLength(approveWrites)
    expect((await fixture.post("bob", approve.value.command)).status).toBe(200)
    const approved = await fixture.snapshot()
    expect(await fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140 }, prApprovalBaseCurrency: "USD" })
    expect(rows(object((await fixture.current()).prApproval).steps)).toMatchObject([{ status: "approved", holderId: "bob" }])
    expect(approved.versions[`requests:${fixture.requestId}`]?.version).toBe(approval.review.domainVersion + 1)
    expect(approved.audit).toHaveLength(beforeApprove.audit.length + 1)
    expect(approved.audit.at(-1)).toMatchObject({ who: "bob", name: "Bob", record: `requests:${fixture.requestId}` })
    expect(fixture.writes).toHaveLength(approveWrites + 1)
    expect((await fixture.post("bob", approve.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(approved)
    expect(fixture.writes).toHaveLength(approveWrites + 1)

    await fixture.close()
    lifecycle.closed = true
    const reopened = await createApprovalFixture({ directory: fixture.directory, requestId: fixture.requestId })
    lifecycle.current = reopened
    lifecycle.closed = false
    const persisted = await reopened.snapshot()
    expect(persisted.data).toEqual(approved.data)
    expect(persisted.versions).toEqual(approved.versions)
    expect(persisted.audit).toEqual(approved.audit)
    expect(persisted.notices).toEqual(approved.notices)
    expect(persisted.sequences).toEqual(approved.sequences)
    const reopenWrites = reopened.writes.length
    expect((await reopened.post("bob", approve.value.command)).status).toBe(409)
    expect(await reopened.snapshot()).toEqual(persisted)
    expect(reopened.writes).toHaveLength(reopenWrites)

    // This cycle proves the three canonical effects. It creates no C12 receipt or post-approval save.
    const after = await reopened.review()
    const final = await reopened.snapshot()
    const finalWrites = reopened.writes.length
    expect(after.review.allowedActions).toEqual([])
    expect(await reopened.lifecycle.prepare({ review: after.review, action: { kind: "save-estimate", amount: 160 } }, after.context)).toEqual({ status: "denied", reason: "requisition-action-unavailable" })
    const forbidden = { page: "Requests", action: "save", id: reopened.requestId, version: after.review.domainVersion, values: { pr: { estAmount: 160 } } }
    expect(procurementPreparationIssue(final, forbidden)).toBe("requisition-stage-not-editable")
    expect((await reopened.post("alice", forbidden)).status).toBe(403)
    expect(await reopened.snapshot()).toEqual(final)
    expect(reopened.writes).toHaveLength(finalWrites)
  } finally { if (!lifecycle.closed) await lifecycle.current.dispose() }
})

test("reject and resubmit require a fresh review of 140; the retained approval of 100 cannot approve it", async () => {
  const fixture = await createApprovalFixture()
  try {
    const submitted = await prepare(fixture, "alice", { kind: "submit-current", amount: 100 })
    expect((await fixture.post("alice", submitted.plan.command)).status).toBe(200)
    const pending = await fixture.review("bob")
    const oldApprove = await fixture.lifecycle.prepare({ review: pending.review, action: { kind: "approve-submitted", amount: 100, holderId: "bob", comment: "Old snapshot" } }, pending.context)
    if (oldApprove.status !== "ok") throw new Error("Original pending approval unavailable")
    const reject = await fixture.lifecycle.prepare({ review: pending.review, action: { kind: "reject-submitted", amount: 100, holderId: "bob", reason: "Return the submitted 100 for revision" } }, pending.context)
    if (reject.status !== "ok") throw new Error("Rejection preparation unavailable")
    expect(reject.value.command).toEqual({ page: "Requests", action: "reject", id: fixture.requestId, version: pending.review.domainVersion, confirmed: false, values: { reason: "Return the submitted 100 for revision" } })
    expect((await fixture.post("bob", reject.value.command)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "pr_rejected", pr: { estAmount: 100 }, prApproval: { amount: 100 } })
    const rejected = await fixture.snapshot()
    expect((await fixture.post("bob", reject.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(rejected)

    const revised = await prepare(fixture, "alice", { kind: "save-estimate", amount: 140 })
    expect(revised.review.stage).toBe("pr_rejected")
    expect((await fixture.post("alice", revised.plan.command)).status).toBe(200)
    const resubmit = await prepare(fixture, "alice", { kind: "submit-current", amount: 140 })
    expect(resubmit.plan.command.values).toEqual({})
    expect((await fixture.post("alice", resubmit.plan.command)).status).toBe(200)
    const resubmitted = await fixture.snapshot()
    const writes = fixture.writes.length
    expect(await fixture.current()).toMatchObject({ status: "pr_pending", pr: { estAmount: 140 }, prApproval: { amount: 140 } })
    expect((await fixture.lifecycle.prepare({ review: pending.review, action: { kind: "approve-submitted", amount: 100, holderId: "bob", comment: "Old snapshot" } }, pending.context)).status).toBe("stale")
    expect((await fixture.post("bob", oldApprove.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(resubmitted)
    expect(fixture.writes).toHaveLength(writes)

    const current = await prepare(fixture, "bob", { kind: "approve-submitted", amount: 140, holderId: "bob", comment: "New submitted snapshot" })
    expect(current.plan.command.version).toBeGreaterThan(oldApprove.value.command.version)
    expect((await fixture.post("bob", current.plan.command)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140 } })
  } finally { await fixture.dispose() }
})

test("amount, holder and admin cannot authorize a replacement of the submitted snapshot", async () => {
  const fixture = await createApprovalFixture()
  try {
    const submit = await prepare(fixture, "alice", { kind: "submit-current", amount: 100 })
    expect((await fixture.post("alice", submit.plan.command)).status).toBe(200)
    const pending = await fixture.review("bob")
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    expect(await fixture.lifecycle.prepare({ review: pending.review, action: { kind: "approve-submitted", amount: 140, holderId: "bob", comment: "Unwritten replacement" } }, pending.context)).toEqual({ status: "needs-input", reason: "requisition-amount-mismatch" })
    expect(await fixture.lifecycle.prepare({ review: pending.review, action: { kind: "approve-submitted", amount: 100, holderId: "alice", comment: "Wrong holder" } }, pending.context)).toEqual({ status: "needs-input", reason: "submitted-snapshot-mismatch" })
    const injected = { kind: "approve-submitted" as const, amount: 100, holderId: "bob", comment: "Hidden replacement", pr: { estAmount: 140 } }
    expect(await fixture.lifecycle.prepare({ review: pending.review, action: injected }, pending.context)).toEqual({ status: "needs-input", reason: "explicit-requisition-action-required" })
    expect(await fixture.lifecycle.prepare({ review: { ...pending.review, submittedAmount: 140 }, action: { kind: "approve-submitted", amount: 140, holderId: "bob", comment: "Forged review" } }, pending.context)).toEqual({ status: "stale", reason: "requisition-review-changed" })
    expect(await fixture.lifecycle.prepare({ review: pending.review, action: { kind: "reject-submitted", amount: 100, holderId: "bob", reason: " " } }, pending.context)).toEqual({ status: "needs-input", reason: "explicit-requisition-action-required" })
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    fixture.actors.alice!.roles = ["admin"]
    const admin = await fixture.review()
    const protectedSnapshot = await fixture.snapshot()
    const protectedWrites = fixture.writes.length
    expect(admin.review.allowedActions).toEqual([])
    expect(await fixture.lifecycle.prepare({ review: admin.review, action: { kind: "approve-submitted", amount: 100, holderId: "bob", comment: "No holder override" } }, admin.context)).toEqual({ status: "denied", reason: "requisition-action-unavailable" })
    expect((await fixture.post("alice", { page: "Requests", action: "approve", id: fixture.requestId, version: admin.review.domainVersion, values: { comment: "No holder override" } })).status).toBe(403)
    expect(await fixture.snapshot()).toEqual(protectedSnapshot)
    expect(fixture.writes).toHaveLength(protectedWrites)
    expect(await fixture.current()).toMatchObject({ status: "pr_pending", pr: { estAmount: 100 }, prApproval: { amount: 100 } })
  } finally { await fixture.dispose() }
})

async function prepare(fixture: Awaited<ReturnType<typeof createApprovalFixture>>, principal: string, action: ProcurementApprovalAction) {
  const admitted = await fixture.review(principal)
  const prepared = await fixture.lifecycle.prepare({ review: admitted.review, action }, admitted.context)
  if (prepared.status !== "ok") throw new Error(`Explicit ${action.kind} preparation unavailable: ${prepared.reason}`)
  return { ...admitted, plan: prepared.value }
}
