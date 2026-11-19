import { expect, test } from "bun:test"
import { createApprovalFixture } from "./fixture.ts"

test("preparation requires the live UI admission, the same Request and current write authority", async () => {
  const fixture = await createApprovalFixture()
  try {
    const draft = await fixture.review()
    const action = { kind: "save-estimate" as const, amount: 140 }
    const plan = await fixture.lifecycle.prepare({ review: draft.review, action }, draft.context)
    if (plan.status !== "ok") throw new Error("Initial human draft plan unavailable")
    const initial = await fixture.snapshot()
    const initialWrites = fixture.writes.length
    const forged = structuredClone(draft.context)
    expect((await fixture.lifecycle.review(draft.sourceRef, forged)).status).toBe("denied")
    expect((await fixture.lifecycle.prepare({ review: draft.review, action }, forged)).status).toBe("denied")
    fixture.ui.finish(draft.context)
    expect((await fixture.lifecycle.review(draft.sourceRef, draft.context)).status).toBe("denied")
    expect((await fixture.lifecycle.prepare({ review: draft.review, action }, draft.context)).status).toBe("denied")
    expect(await fixture.snapshot()).toEqual(initial)
    expect(fixture.writes).toHaveLength(initialWrites)

    const writer = await fixture.review()
    const writable = await fixture.snapshot()
    const writableWrites = fixture.writes.length
    fixture.actors.alice!.canWrite = false
    expect((await fixture.lifecycle.review(writer.sourceRef, writer.context)).status).toBe("denied")
    expect((await fixture.lifecycle.prepare({ review: writer.review, action }, writer.context)).status).toBe("denied")
    expect((await fixture.post("alice", plan.value.command)).status).toBe(403)
    expect(await fixture.snapshot()).toEqual(writable)
    expect(fixture.writes).toHaveLength(writableWrites)
    fixture.actors.alice!.canWrite = true

    const authorized = await fixture.review()
    const accessible = await fixture.snapshot()
    const accessibleWrites = fixture.writes.length
    fixture.access.allowed = false
    expect((await fixture.lifecycle.prepare({ review: authorized.review, action }, authorized.context)).status).toBe("denied")
    expect((await fixture.post("alice", plan.value.command)).status).toBe(401)
    expect(await fixture.snapshot()).toEqual(accessible)
    expect(fixture.writes).toHaveLength(accessibleWrites)
    fixture.access.allowed = true

    const originalRequest = await fixture.review()
    const current = await fixture.snapshot()
    const writes = fixture.writes.length
    originalRequest.request.headers.set("authorization", "Bearer bob")
    expect((await fixture.lifecycle.review(originalRequest.sourceRef, originalRequest.context)).status).toBe("denied")
    expect((await fixture.lifecycle.prepare({ review: originalRequest.review, action }, originalRequest.context)).status).toBe("denied")
    expect(await fixture.snapshot()).toEqual(current)
    expect(fixture.writes).toHaveLength(writes)
  } finally { await fixture.dispose() }
})

test("a changed requisition invalidates source and review without silently refreshing the retained command CAS", async () => {
  const fixture = await createApprovalFixture()
  try {
    const original = await fixture.review()
    const action = { kind: "save-estimate" as const, amount: 140 }
    const prepared = await fixture.lifecycle.prepare({ review: original.review, action }, original.context)
    if (prepared.status !== "ok") throw new Error("Original draft plan unavailable")
    const retained = structuredClone(prepared.value)
    expect((await fixture.post("alice", { page: "Requests", action: "save", id: fixture.requestId, version: original.review.domainVersion, values: { pr: { title: "A separate explicit edit" } } })).status).toBe(200)
    const changed = await fixture.snapshot()
    const writes = fixture.writes.length
    expect((await fixture.lifecycle.review(original.sourceRef, original.context)).status).toBe("stale")
    expect((await fixture.lifecycle.prepare({ review: original.review, action }, original.context)).status).toBe("stale")
    expect((await fixture.post("alice", prepared.value.command)).status).toBe(409)
    expect(prepared.value).toEqual(retained)
    expect(await fixture.snapshot()).toEqual(changed)
    expect(fixture.writes).toHaveLength(writes)
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { title: "A separate explicit edit", estAmount: 100 } })

    // Only this new explicit source issuance and review may produce a new CAS plan.
    const fresh = await fixture.review()
    const next = await fixture.lifecycle.prepare({ review: fresh.review, action }, fresh.context)
    if (next.status !== "ok") throw new Error("New source review unavailable")
    expect(next.value.command.version).toBe(retained.command.version + 1)
    expect(next.value.review.source).not.toEqual(retained.review.source)
    expect(next.value.command.values).toEqual({ pr: { estAmount: 140 } })
    expect(next.value.approvalGranted).toBe(false)
    expect(next.value.receipt).toBeNull()
  } finally { await fixture.dispose() }
})
