import { describe, expect, test } from "bun:test"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const projection = { version: 8, values: [], components: [], missing: [] } as unknown as DomainProjection

describe("factual review", () => {
  test("uses scoped validity despite a newer global version and deduplicates topics", async () => {
    const result = await prepareFactualReview({ topicRefs: ["january", "january"], context, host: {
      readTopic: async () => ({ status: "ok", value: { projection, confirmation: { state: "valid", confirmationId: "c", evaluatedSourceVersion: 8, evaluatedAt: "2026-01-01", reason: "unchanged-scope", scopeFingerprint: "same" } } }),
      revalidate: async () => true,
    } })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.value.topics).toHaveLength(1)
    expect(result.value.topics[0]?.state === "available" && result.value.topics[0].review).toBe("confirmed")
  })

  test("does not disclose a topic after access loss or a failed egress check", async () => {
    const host = {
      readTopic: async () => ({ status: "denied", reason: "private" } as const),
      revalidate: async () => true,
    }
    const result = await prepareFactualReview({ topicRefs: ["secret"], context, host })
    expect(JSON.stringify(result)).not.toContain("secret")
    expect(JSON.stringify(result)).not.toContain("private")
    expect(await prepareFactualReview({ topicRefs: ["secret"], context, host: { ...host, revalidate: async () => false } })).toEqual({ status: "denied", reason: "access-changed" })
  })
})

test("review compares selected projections without treating missing amounts as zero", async () => {
  const period = { start: "2027-01-01", end: "2027-01-31" }
  const value = { id: "forecast", value: 100, currency: "USD", period, granularity: "month" as const, sourceRefs: [], drilldown: null, evidenceState: "confirmed" as const }
  const previous = { ...projection, values: [value] }
  const current = { ...projection, values: [{ ...value, value: 120 }] }
  const host = { readTopic: async () => ({ status: "ok" as const, value: { projection: current, previousProjection: previous, confirmation: null } }), revalidate: async () => true }
  const result = await prepareFactualReview({ topicRefs: ["topic"], context, host })
  if (result.status !== "ok" || result.value.topics[0]?.state !== "available") throw new Error("review unavailable")
  expect(result.value.topics[0].changes).toMatchObject([{ state: "changed", delta: 20 }])
  const missing = await prepareFactualReview({ topicRefs: ["topic"], context, host: { ...host, readTopic: async () => ({ status: "ok", value: { projection: { ...current, values: [{ ...value, value: null, evidenceState: "absent" }] }, previousProjection: previous, confirmation: null } }) } })
  if (missing.status !== "ok" || missing.value.topics[0]?.state !== "available") throw new Error("review unavailable")
  expect(missing.value.topics[0].changes).toMatchObject([{ state: "changed", delta: null }])
})

test("a restricted historical projection cannot leak through review changes", async () => {
  const previousProjection = { ...projection, values: [{ id: "private", value: 999 }], missing: [{ field: "private", reason: "restricted" }] } as unknown as DomainProjection
  const result = await prepareFactualReview({ topicRefs: ["topic"], context, host: {
    readTopic: async () => ({ status: "ok", value: { projection, previousProjection, confirmation: null } }),
    revalidate: async () => true,
  } })
  expect(JSON.stringify(result)).not.toContain("999")
  expect(result.status === "ok" && result.value.topics[0]).toEqual({ state: "unavailable", reason: "source-unavailable" })
})

test("review refuses a previously authorized review when access is revoked before output", async () => {
  let reads = 0
  const result = await prepareFactualReview({ topicRefs: [], currentReviewRef: "current", previousReviewRef: "previous", context, host: {
    readTopic: async () => ({ status: "unavailable", reason: "unused" }),
    readPreviousReview: async (id) => ++reads <= 2
      ? { status: "ok", value: { id, version: 1, createdAt: "2026-01-01", sourceRefs: [], sections: [], comments: [], ...(id === "current" ? { previousReviewRef: "previous" } : {}) } }
      : { status: "denied", reason: "revoked" },
    revalidate: async () => true,
  } })
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
})

test("review uses the producer's record count instead of counting projection values", async () => {
  const period = { start: "2027-01-01", end: "2027-01-31" }
  const current = { ...projection, context: { period, sourceRefs: [] } } as unknown as DomainProjection
  const result = await prepareFactualReview({ topicRefs: ["topic"], context, host: {
    readTopic: async () => ({ status: "ok", value: { projection: current, recordCount: 4, confirmation: null } }),
    revalidate: async () => true,
  } })
  if (result.status !== "ok") throw new Error("review unavailable")
  expect(result.value.draft.sections[0]).toMatchObject({ count: 4, content: current })
})
