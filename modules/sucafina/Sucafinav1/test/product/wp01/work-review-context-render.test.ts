import { expect, test } from "bun:test"
import { workReviewContext } from "../../../product/ui/work-review-context.ts"

// Rendering boundary only. These published-format inputs do not simulate C05,
// C06, C08 or the shared host, and confer no authority to read a preserved review.
const digest = "a".repeat(64)
const action = { closureRef: "closure-one", reviewRef: "review-one", reviewVersion: 2, reviewDigest: digest }
const discussion = { reviewRef: "review-two", reviewVersion: 3, reviewDigest: digest, sectionId: "financial-section" }
const unavailable = '<p data-work-review-context-unavailable>Review context is unavailable.</p>'

test("My work review rendering remains absent for legacy items and an empty authorized context list", () => {
  for (const item of [undefined, null, 4, [], {}, { title: "Existing work", state: "open" }, { reviewContexts: undefined, reviewContext: undefined }, { reviewContexts: [] }]) {
    expect(workReviewContext(item)).toBe("")
  }
})

test("My work renders exact action review references and versions without exposing their digest", () => {
  const html = workReviewContext({ reviewContexts: [action, { ...action, closureRef: "closure-two", reviewRef: "review-three", reviewVersion: 4 }] })
  expect(html).toContain("Preserved review context")
  expect(html).toContain("<dt>Review reference</dt><dd>review-one</dd>")
  expect(html).toContain("<dt>Version</dt><dd>2</dd>")
  expect(html).toContain("<dt>Follow-up reference</dt><dd>closure-one</dd>")
  expect(html).toContain("<dt>Review reference</dt><dd>review-three</dd>")
  expect(html).toContain("<dt>Version</dt><dd>4</dd>")
  expect(html).toContain("<dt>Follow-up reference</dt><dd>closure-two</dd>")
  expect(html.match(/<dt>Review reference<\/dt>/g)).toHaveLength(2)
  expect(html).not.toContain(digest)
  expect(html).not.toContain("reviewDigest")
})

test("My work keeps the preserved section distinct from action closure context", () => {
  const html = workReviewContext({ reviewContexts: [action], reviewContext: discussion })
  expect(html).toContain("<dt>Review reference</dt><dd>review-two</dd>")
  expect(html).toContain("<dt>Version</dt><dd>3</dd>")
  expect(html).toContain("<dt>Section</dt><dd>financial-section</dd>")
  expect(html).toContain("<dt>Follow-up reference</dt><dd>closure-one</dd>")
  expect(html.match(/<dt>Review reference<\/dt>/g)).toHaveLength(2)
  expect(workReviewContext({ reviewContext: discussion })).not.toContain("Follow-up reference")
})

test("My work rejects malformed review metadata without rendering partial or private context", () => {
  const invalid: unknown[] = [
    { reviewContexts: null }, { reviewContexts: action }, { reviewContext: [] },
    { reviewContexts: [{ ...action, privateDiagnostic: "PRIVATE-CONTEXT" }] },
    { reviewContexts: [{ ...action, [Symbol("private")]: "PRIVATE-CONTEXT" }] },
    { reviewContexts: [{ ...action, reviewRef: " " }] },
    { reviewContexts: [{ ...action, closureRef: " " }] },
    { reviewContexts: [{ ...action, reviewVersion: "2" }] },
    { reviewContexts: [{ ...action, reviewVersion: 0 }] },
    { reviewContexts: [{ ...action, reviewVersion: 1.5 }] },
    { reviewContexts: [{ ...action, reviewVersion: Number.POSITIVE_INFINITY }] },
    { reviewContexts: [{ ...action, reviewVersion: Number.MAX_SAFE_INTEGER + 1 }] },
    { reviewContexts: [{ ...action, reviewDigest: undefined }] },
    { reviewContexts: [{ ...action, reviewDigest: "not-a-producer-digest" }] },
    { reviewContexts: [action, action] },
    { reviewContexts: [discussion] },
    { reviewContext: action },
    { reviewContext: { ...discussion, sectionId: null } },
    { reviewContext: { ...discussion, closureRef: "PRIVATE-CONTEXT" } },
    { reviewContexts: [action], reviewContext: { ...discussion, reviewDigest: "invalid" } },
  ]
  for (const item of invalid) {
    const html = workReviewContext(item)
    expect(html).toBe(unavailable)
    expect(html).not.toContain("PRIVATE-CONTEXT")
    expect(html).not.toContain("review-one")
    expect(html).not.toContain("financial-section")
  }
})

test("My work escapes review and section references as text without creating elements or links", () => {
  const html = workReviewContext({
    reviewContexts: [{ ...action, reviewRef: '<script>alert("review")</script>', closureRef: 'closure<&"one' }],
    reviewContext: { ...discussion, sectionId: '<img src=x onerror="alert(1)">' },
  })
  expect(html).toContain("&lt;script&gt;alert(&quot;review&quot;)&lt;/script&gt;")
  expect(html).toContain("closure&lt;&amp;&quot;one")
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;")
  expect(html).not.toMatch(/<(?:script|img|a)\b/i)
  expect(html).not.toContain(digest)
})

test("My work review context is passive and carries no navigation or mutation trigger", () => {
  const html = workReviewContext({ reviewContexts: [action], reviewContext: discussion })
  expect(html).not.toMatch(/<(?:a|button|form|input|script|iframe)\b/i)
  expect(html).not.toMatch(/\b(?:href|onclick|onload|formaction)=/i)
  expect(html).not.toContain("data-work-destination")
  expect(html).not.toContain("review-thread-context")
  expect(html).not.toContain("collaboration-thread-create")
  expect(html).not.toContain("collaboration-answer-confirm")
  expect(html).not.toContain("sf_review_prepare")
  expect(html).not.toContain("reviewDigest")
  expect(html).not.toContain(digest)
})

test("My work review rendering preserves the supplied metadata and its order", () => {
  const item = { title: "Existing work", reviewContexts: [{ ...action, closureRef: "closure-z" }, { ...action, closureRef: "closure-a" }], reviewContext: { ...discussion } }
  const before = structuredClone(item)
  const html = workReviewContext(item)
  expect(item).toEqual(before)
  expect(html.indexOf("closure-z")).toBeLessThan(html.indexOf("closure-a"))
  expect(html.indexOf("closure-a")).toBeLessThan(html.indexOf("financial-section"))
})

test("My work reports unavailable metadata when a provider accessor fails without leaking its failure", () => {
  const item = { get reviewContexts(): unknown { throw new Error("PRIVATE-PROVIDER-DETAIL") } }
  const entry = { ...action, get reviewDigest(): string { throw new Error("PRIVATE-DIGEST-DETAIL") } }
  expect(workReviewContext(item)).toBe(unavailable)
  expect(workReviewContext({ reviewContexts: [entry] })).toBe(unavailable)
  expect(workReviewContext(item)).not.toContain("PRIVATE-PROVIDER-DETAIL")
  expect(workReviewContext({ reviewContexts: [entry] })).not.toContain("PRIVATE-DIGEST-DETAIL")
})
