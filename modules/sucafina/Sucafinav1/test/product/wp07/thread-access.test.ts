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

test("a later conversation exceeding the capture limit does not revoke preserved comments", async () => {
  const context = { kind: "ui", binding: { principalRef: "p", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sources = [{ surface: "dashboard", type: "projects", id: "one", incarnation: "inc", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" }] as const
  const messages = [{ id: "original", incarnation: "original-inc", version: 1, authorRef: "author", body: "captured", createdAt: "2026-11-13T00:00:00Z" }]
  const comments = createReviewThreadComments({ host: { revalidate: async () => true }, maxMessages: 1, authorizeSourceMapping: async () => true, threads: { read: async (id) => ({ status: "ok", value: { id, kind: "comment", sourceRef: "source", sourceIncarnation: "inc", observedVersion: 1, period, evidenceRefs: [], messages } }) } })
  const captured = await comments.capture("thread", sources, context)
  if (captured.status !== "ok") throw new Error(captured.reason)
  messages.push({ id: "reply", incarnation: "reply-inc", version: 1, authorRef: "author", body: "later", createdAt: "2026-11-13T00:01:00Z" })
  expect(await comments.authorizeComments(context, captured.value)).toBe(true)
  expect(await comments.capture("thread", sources, context)).toEqual({ status: "unavailable", reason: "thread-capture-limit-exceeded" })
  expect(captured.value).toHaveLength(1)
  expect(captured.value[0]?.content).toBe("captured")
})

test("a source mapping callback cannot rewrite the captured canonical message", async () => {
  const context = { kind: "ui", binding: { principalRef: "p", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sources = [{ surface: "dashboard", type: "projects", id: "one", incarnation: "inc", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" }] as const
  const thread = { id: "thread", kind: "comment" as const, sourceRef: "source", sourceIncarnation: "inc", observedVersion: 1, period, evidenceRefs: [], messages: [{ id: "message", incarnation: "message-inc", version: 1, authorRef: "author", body: "canonical", createdAt: "2026-11-13T00:00:00Z" }] }
  const comments = createReviewThreadComments({ host: { revalidate: async () => true }, maxMessages: 10, authorizeSourceMapping: async (value) => { value.messages[0]!.body = "rewritten"; return true }, threads: { read: async () => ({ status: "ok", value: thread }) } })
  const captured = await comments.capture("thread", sources, context)
  if (captured.status !== "ok") throw new Error(captured.reason)
  expect(captured.value[0]?.content).toBe("canonical")
  expect(thread.messages[0]?.body).toBe("canonical")
})
