import { expect, test } from "bun:test"
import { readWorkReviewContexts } from "../../../product/collaboration/work-review-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

// Boundary projection only. The actual C05 + action + work composition is
// exercised by WP07 closure-work.test.ts; this test confers no source authority.
test("work review context rejects extra private fields, malformed values and provider exceptions without leaking them", async () => {
  const context = { kind: "ui", binding: { principalRef: "reader" } } as TrustedDomainContext
  const entry = { closureRef: "closure", reviewRef: "review", reviewVersion: 1, reviewDigest: "a".repeat(64) }
  const unavailable = { status: "unavailable" as const, reason: "work-review-context-unavailable" }
  const extra = await readWorkReviewContexts(async () => ({ status: "ok", value: [{ ...entry, privateDiagnostic: "private sentinel" }] }), "topic", context)
  expect(extra).toEqual(unavailable)
  expect(JSON.stringify(extra)).not.toContain("private sentinel")
  const nonserializable = await readWorkReviewContexts(async () => ({ status: "ok", value: [{ ...entry, privateDiagnostic: () => "private callable" }] }), "topic", context)
  expect(nonserializable).toEqual(unavailable)
  const throwing = { ...entry, get reviewDigest(): string { throw new Error("private provider failure") } }
  expect(await readWorkReviewContexts(async () => ({ status: "ok", value: [throwing] }), "topic", context)).toEqual(unavailable)
  expect(await readWorkReviewContexts(async () => ({ status: "ok", value: [{ ...entry, reviewVersion: 0 }] }), "topic", context)).toEqual(unavailable)
  expect(await readWorkReviewContexts(async () => ({ status: "unavailable", reason: "private provider reason" }), "topic", context)).toEqual(unavailable)
  const projected = await readWorkReviewContexts(async () => ({ status: "ok", value: [entry] }), "topic", context)
  expect(projected).toEqual({ status: "ok", value: [entry] })
  entry.reviewRef = "mutated after return"
  expect(projected.status === "ok" && projected.value[0]?.reviewRef).toBe("review")
})
