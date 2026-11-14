import { expect, test } from "bun:test"
import { closeReviewMeeting } from "../../../product/reviews/closure.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("meeting closure accepts only an authorized, unchanged review and the matching handoff", async () => {
  const context = { kind: "ui", binding: { principalRef: "principal", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const handoff = { caseRef: "case", actionRef: "action", sourceRefs: [] }
  const review = { id: "review", version: 1, createdAt: "2026-11-13T00:00:00Z", sections: [], sourceRefs: [], comments: [] }
  const access = { allowed: true, change: false, calls: 0 }
  const input: Parameters<typeof closeReviewMeeting>[0] = {
    context, handoffContext: context, handoff, reviewRef: "review",
    reviews: { read: async () => ({ status: "ok", value: access.change ? { ...review, version: 2 } : review }) },
    authorizeHandoff: async () => access.allowed,
    dispatch: async () => {
      access.calls++
      return { status: "ok", result: { ...handoff, domainApplied: false }, receipt: { kind: "ui", operation: "sf_handoff_prepare", handlerExport: "prepareHandoff", inputDigest: "input", resultDigest: "output", principalRef: "principal", callId: "call", requestId: "request", accessRevision: "a", at: "2026-11-13T00:00:00Z" } }
    },
  }
  expect((await closeReviewMeeting(input)).status).toBe("ok")
  access.allowed = false
  expect((await closeReviewMeeting(input)).status).toBe("denied")
  expect(access.calls).toBe(1)
  access.allowed = true
  input.dispatch = async () => {
    access.change = true
    return { status: "ok", result: { ...handoff, domainApplied: false }, receipt: { kind: "ui", operation: "sf_handoff_prepare", handlerExport: "prepareHandoff", inputDigest: "input", resultDigest: "output", principalRef: "principal", callId: "call", requestId: "request", accessRevision: "a", at: "2026-11-13T00:00:00Z" } }
  }
  expect(await closeReviewMeeting(input)).toMatchObject({ status: "denied", reason: "review-access-unavailable" })
})
