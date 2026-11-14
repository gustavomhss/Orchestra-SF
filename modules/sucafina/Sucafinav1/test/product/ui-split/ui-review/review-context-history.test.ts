import { expect, test } from "bun:test"
import { createReviewThreadContext } from "../../../../product/reviews/thread-context.ts"
import { workReviewContext } from "../../../../product/ui/work-review-context.ts"
import { createMeetingFixture, meetingBasis } from "./meeting-fixture.ts"

test("C05 UI preserves the issued section context after a legitimate financial change and a fresh read admission", async () => {
  const fixture = await createMeetingFixture()
  try {
    const reader = createReviewThreadContext({ reviews: { read: fixture.dashboard.readReview }, host: fixture.authority.host })
    const basis = meetingBasis(fixture.original)
    const selection = { reviewRef: fixture.original.id, sectionId: fixture.original.sections[0]!.id }
    const first = await fixture.read((context) => reader.prepare(selection, basis, context))
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error(first.reason)
    const html = workReviewContext({ reviewContext: first.value })
    const changed = await fixture.changeBudget()
    expect(changed.status).toBe(200)
    expect(await changed.json()).toMatchObject({ ok: true })
    const reopened = await fixture.read((context) => reader.prepare(selection, basis, context))
    expect(reopened.status).toBe("ok")
    if (reopened.status !== "ok") throw new Error(reopened.reason)
    expect(reopened.value).toEqual(first.value)
    expect(workReviewContext({ reviewContext: reopened.value })).toBe(html)
    expect(await fixture.read((context) => reader.authorize(first.value, basis, context))).toBe(true)
    const saved = await fixture.stored()
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") throw new Error("Real preserved review state unavailable")
    expect(saved.value.reviews[fixture.original.id]).toEqual(fixture.original)
    expect(saved.value.receipts).toBe(1)
  } finally { await fixture.close() }
}, 60_000)

test("C05 UI cannot reuse a preserved review pin after current read access is revoked", async () => {
  const fixture = await createMeetingFixture()
  try {
    const reader = createReviewThreadContext({ reviews: { read: fixture.dashboard.readReview }, host: fixture.authority.host })
    const basis = meetingBasis(fixture.original)
    const selection = { reviewRef: fixture.original.id, sectionId: fixture.original.sections[0]!.id }
    await fixture.read(async (context) => {
      const first = await reader.prepare(selection, basis, context)
      expect(first.status).toBe("ok")
      if (first.status !== "ok") throw new Error(first.reason)
      fixture.policy.readable = false
      const read = await fixture.dashboard.readReview(fixture.original.id, context)
      expect(read.status).toBe("denied")
      expect("value" in read).toBe(false)
      const prepared = await reader.prepare(selection, basis, context)
      expect(prepared.status).toBe("denied")
      expect("value" in prepared).toBe(false)
      expect(await reader.authorize(first.value, basis, context)).toBe(false)
    })
    const response = await fetch(fixture.historyUrl, { headers: { cookie: fixture.cookie } })
    expect(response.status).toBe(403)
    const body = await response.text()
    expect(body).not.toContain("Preserved Operations")
    expect(body).not.toContain(fixture.original.id)
    expect(body).not.toContain("1300")
  } finally { await fixture.close() }
}, 60_000)
