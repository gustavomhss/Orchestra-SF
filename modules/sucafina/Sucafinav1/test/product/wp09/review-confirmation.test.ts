import { expect, test } from "bun:test"
import { createScopedReviewHost } from "../../../product/routines/review-confirmation.ts"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const projection = { version: 8, values: [], components: [], missing: [] } as unknown as DomainProjection

test("review consumes the producer's current scope projection even when the global version changes", async () => {
  const host = createScopedReviewHost({ readTopic: async () => ({ status: "ok", value: { projection, confirmationId: "jan" } }), revalidate: async () => true, confirmation: { project: async (id) => ({ status: "ok", value: { confirmationId: id, state: "valid", reason: "unchanged-scope", scopeFingerprint: "same", evaluatedSourceVersion: 8, evaluatedAt: "2026-11-13" } }) } })
  const result = await prepareFactualReview({ topicRefs: ["jan"], context, host })
  if (result.status !== "ok" || result.value.topics[0]?.state !== "available") throw new Error("review unavailable")
  expect(result.value.topics[0].review).toBe("confirmed")
})

test("a missing producer or unavailable scope never becomes a fresh review request", async () => {
  const base = { readTopic: async () => ({ status: "ok" as const, value: { projection, confirmationId: "jan" } }), revalidate: async () => true }
  const result = await prepareFactualReview({ topicRefs: ["private"], context, host: createScopedReviewHost(base) })
  expect(result.status === "ok" && result.value.topics[0]).toEqual({ state: "unavailable", reason: "source-unavailable" })
  expect(JSON.stringify(result)).not.toContain("private")
})
