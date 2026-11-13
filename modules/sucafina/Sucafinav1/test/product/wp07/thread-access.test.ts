import { expect, test } from "bun:test"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewThreadComments } from "../../../product/reviews/thread-access.ts"

test("captured comment requires the exact thread message, source association and current authority", async () => {
  const context = { kind: "ui", binding: { principalRef: "p", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sources = [{ surface: "dashboard", type: "projects", id: "one", incarnation: "inc", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" }] as const
  const state = { allowed: true, body: "original", replied: false, version: 1, history: false }
  const comments = createReviewThreadComments({ host: { revalidate: async () => state.allowed }, maxMessages: 10, authorizeSourceMapping: async () => state.allowed,
    history: { readVersion: async (_threadId, messageId, incarnation, version) => state.history && messageId === "message" && incarnation === "message-inc" && version === 1 ? { status: "ok", value: { message: { id: "message", incarnation: "message-inc", version: 1, authorRef: "author", body: "original", createdAt: "2026-11-13T00:00:00Z" }, evidenceRefs: [], period } } : { status: "unavailable", reason: "missing" } },
    threads: { read: async (id) => ({ status: "ok", value: { id, kind: "comment", sourceRef: "source", sourceIncarnation: "inc", observedVersion: 1, period, evidenceRefs: [], messages: [{ id: "message", incarnation: "message-inc", version: state.version, authorRef: "author", body: state.body, createdAt: "2026-11-13T00:00:00Z" }, ...(state.replied ? [{ id: "reply", incarnation: "reply-inc", version: 1, authorRef: "other", body: "later reply", createdAt: "2026-11-13T00:01:00Z" }] : [])] } }) },
  })
  const captured = await comments.capture("thread", sources, context)
  if (captured.status !== "ok") throw new Error("comment unavailable")
  expect(captured.value).toHaveLength(1)
  expect(await comments.authorizeComments(context, captured.value)).toBe(true)
  expect(await comments.authorizeComments(context, captured.value.map((comment) => ({ ...comment, content: "forged" })))).toBe(false)
  state.replied = true
  expect(await comments.authorizeComments(context, captured.value)).toBe(true)
  state.body = "changed without version"
  expect(await comments.authorizeComments(context, captured.value)).toBe(false)
  state.version = 2
  state.history = true
  expect(await comments.authorizeComments(context, captured.value)).toBe(true)
  state.allowed = false
  expect(await comments.authorizeComments(context, captured.value)).toBe(false)
})
