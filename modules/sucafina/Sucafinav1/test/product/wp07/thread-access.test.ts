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

test("one current thread snapshot serves its messages only within the exact source authorization pass", async () => {
  const context = { kind: "ui", binding: { principalRef: "p", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sources = [{ surface: "dashboard", type: "projects", id: "one", incarnation: "inc", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" }] as const
  const thread = { id: "thread", kind: "comment" as const, sourceRef: "source", sourceIncarnation: "inc", observedVersion: 1, period, evidenceRefs: [], messages: [
    { id: "first", incarnation: "first-inc", version: 1, authorRef: "author", body: "first captured", createdAt: "2026-11-13T00:00:00Z" },
    { id: "second", incarnation: "second-inc", version: 1, authorRef: "author", body: "second captured", createdAt: "2026-11-13T00:01:00Z" },
  ] }
  const observations = { reads: 0, mappedIncarnations: [] as string[] }
  const comments = createReviewThreadComments({ host: { revalidate: async () => true }, maxMessages: 10,
    authorizeSourceMapping: async (_thread, selected) => {
      observations.mappedIncarnations.push(selected[0]?.incarnation ?? "")
      return selected.length === 1 && selected[0]?.incarnation === "inc"
    },
    threads: { read: async () => { observations.reads++; return { status: "ok", value: thread } } },
  })
  const captured = await comments.capture("thread", sources, context)
  if (captured.status !== "ok") throw new Error(captured.reason)
  expect(captured.value.map((comment) => comment.content)).toEqual(["first captured", "second captured"])
  expect(observations.reads).toBe(2)
  observations.reads = 0
  expect(await comments.authorizeComments(context, captured.value)).toBe(true)
  expect(observations.reads).toBe(2)
  expect(await comments.authorizeComments(context, captured.value.map((comment, index) => index === 1 ? { ...comment, sourceRefs: [{ ...sources[0], incarnation: "replacement" }] } : comment))).toBe(false)
  expect(observations.mappedIncarnations).toContain("replacement")
  thread.messages[1]!.body = "changed without version"
  expect(await comments.authorizeComments(context, captured.value)).toBe(false)
  expect(captured.value[1]?.content).toBe("second captured")
})

test("capture refuses changed thread evidence while its source association is pending", async () => {
  const context = { kind: "ui", binding: { principalRef: "p", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sources = [{ surface: "dashboard", type: "projects", id: "one", incarnation: "inc", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" }] as const
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: "record", installationId: "i", projectId: "p", refDigest: "claimed", evidenceLevel: "observed" as const, target: { surface: "dashboard" as const, recordType: "projects", recordId: "one", incarnation: "inc", version: 1, fields: ["name"], period, projectionDigest: "projection" } }
  const thread = { id: "thread", kind: "comment" as const, sourceRef: "record", sourceIncarnation: "inc", observedVersion: 1, period, evidenceRefs: [evidence], messages: [{ id: "message", incarnation: "message-inc", version: 1, authorRef: "author", body: "captured", createdAt: "2026-11-13T00:00:00Z" }] }
  const boundary = { entered: () => {}, resume: () => {} }
  const entered = new Promise<void>((resolve) => { boundary.entered = resolve })
  const pending = new Promise<void>((resolve) => { boundary.resume = resolve })
  const comments = createReviewThreadComments({ host: { revalidate: async () => true }, maxMessages: 10, authorizeSourceMapping: async () => { boundary.entered(); await pending; return true }, threads: { read: async () => ({ status: "ok", value: thread }) } })
  const capture = comments.capture("thread", sources, context)
  await entered
  thread.evidenceRefs[0]!.target.incarnation = "replacement"
  boundary.resume()
  expect(await capture).toEqual({ status: "unavailable", reason: "thread-access-unavailable" })
})

test("capture returns no comments after authority is revoked during source association", async () => {
  const context = { kind: "ui", binding: { principalRef: "p", installationId: "i", projectId: "p", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const sources = [{ surface: "dashboard", type: "projects", id: "one", incarnation: "inc", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" }] as const
  const thread = { id: "thread", kind: "comment" as const, sourceRef: "source", sourceIncarnation: "inc", observedVersion: 1, period, evidenceRefs: [], messages: [{ id: "message", incarnation: "message-inc", version: 1, authorRef: "author", body: "restricted", createdAt: "2026-11-13T00:00:00Z" }] }
  const boundary = { allowed: true, entered: () => {}, resume: () => {} }
  const entered = new Promise<void>((resolve) => { boundary.entered = resolve })
  const pending = new Promise<void>((resolve) => { boundary.resume = resolve })
  const comments = createReviewThreadComments({ host: { revalidate: async () => boundary.allowed }, maxMessages: 10, authorizeSourceMapping: async () => { boundary.entered(); await pending; return true }, threads: { read: async () => ({ status: "ok", value: thread }) } })
  const capture = comments.capture("thread", sources, context)
  await entered
  boundary.allowed = false
  boundary.resume()
  expect(await capture).toEqual({ status: "denied", reason: "thread-access-unavailable" })
})
