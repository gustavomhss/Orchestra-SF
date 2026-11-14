import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createReviewThreadContext } from "../../../../product/reviews/thread-context.ts"
import { workReviewContext } from "../../../../product/ui/work-review-context.ts"
import { createMeetingFixture, meetingBasis, meetingTotal } from "./meeting-fixture.ts"

// The pin issuer calls Dashboard's real review reader twice. Rendering does not
// grant access; the installed My work host must supply this authorized metadata.
test("C05 UI renders the exact section context issued from the real preserved review reader", async () => {
  const fixture = await createMeetingFixture()
  try {
    const reader = createReviewThreadContext({ reviews: { read: fixture.dashboard.readReview }, host: fixture.authority.host })
    const basis = meetingBasis(fixture.original)
    const selection = { reviewRef: fixture.original.id, sectionId: fixture.original.sections[0]!.id }
    const result = await fixture.read((context) => reader.prepare(selection, basis, context))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value).toEqual({ ...selection, reviewVersion: fixture.original.version, reviewDigest: digestSfValue(fixture.original) })
    const before = structuredClone(result.value)
    const html = workReviewContext({ reviewContext: result.value })
    expect(html).toContain(`<dt>Review reference</dt><dd>${fixture.original.id}</dd>`)
    expect(html).toContain(`<dt>Section</dt><dd>${selection.sectionId}</dd>`)
    expect(html).toContain(`<dt>Version</dt><dd>${fixture.original.version}</dd>`)
    expect(html).not.toContain(result.value.reviewDigest)
    expect(html).not.toMatch(/<(?:a|button|form|script)\b/i)
    expect(result.value).toEqual(before)
    expect(meetingTotal(fixture.original)).toBe(1300)
    expect(await fixture.read((context) => reader.authorize(result.value, basis, context))).toBe(true)
    for (const invalid of [
      { ...result.value, reviewVersion: result.value.reviewVersion + 1 },
      { ...result.value, reviewDigest: "0".repeat(64) },
      { ...result.value, sectionId: "another-section" },
    ]) expect(await fixture.read((context) => reader.authorize(invalid, basis, context))).toBe(false)
    expect(await fixture.read((context) => reader.authorize(result.value, { ...basis, observedVersion: basis.observedVersion + 1 }, context))).toBe(false)
    expect(await fixture.read((context) => reader.authorize(result.value, { ...basis, sourceIncarnation: "another-incarnation" }, context))).toBe(false)
  } finally { await fixture.close() }
}, 60_000)

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
