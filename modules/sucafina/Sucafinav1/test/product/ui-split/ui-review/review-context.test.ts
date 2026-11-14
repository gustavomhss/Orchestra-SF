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
  } finally { await fixture.close() }
}, 60_000)

// Separate real-reader cases retain every assertion and the existing deadline.
test("C05 UI rejects changed review version, digest and section against the real reader", async () => {
  const fixture = await createMeetingFixture()
  try {
    const reader = createReviewThreadContext({ reviews: { read: fixture.dashboard.readReview }, host: fixture.authority.host })
    const basis = meetingBasis(fixture.original)
    const selection = { reviewRef: fixture.original.id, sectionId: fixture.original.sections[0]!.id }
    const result = await fixture.read((context) => reader.prepare(selection, basis, context))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    for (const invalid of [
      { ...result.value, reviewVersion: result.value.reviewVersion + 1 },
      { ...result.value, reviewDigest: "0".repeat(64) },
      { ...result.value, sectionId: "another-section" },
    ]) expect(await fixture.read((context) => reader.authorize(invalid, basis, context))).toBe(false)
  } finally { await fixture.close() }
}, 60_000)

test("C05 UI rejects a changed source version or incarnation for a real preserved section", async () => {
  const fixture = await createMeetingFixture()
  try {
    const reader = createReviewThreadContext({ reviews: { read: fixture.dashboard.readReview }, host: fixture.authority.host })
    const basis = meetingBasis(fixture.original)
    const selection = { reviewRef: fixture.original.id, sectionId: fixture.original.sections[0]!.id }
    const result = await fixture.read((context) => reader.prepare(selection, basis, context))
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(await fixture.read((context) => reader.authorize(result.value, { ...basis, observedVersion: basis.observedVersion + 1 }, context))).toBe(false)
    expect(await fixture.read((context) => reader.authorize(result.value, { ...basis, sourceIncarnation: "another-incarnation" }, context))).toBe(false)
  } finally { await fixture.close() }
}, 60_000)
