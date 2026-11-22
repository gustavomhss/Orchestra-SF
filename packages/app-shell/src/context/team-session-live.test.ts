import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SessionEvent } from "@orchestra/schema/session-event"
import { SessionMessage } from "@orchestra/schema/session-message"
import { createTeamSessionLive } from "./team-session-live"
import { teamTranscriptRows } from "./team-session-transcript"

const sessionID = "ses_team_live", assistantMessageID = "msg_team_assistant"
let serial = 0
const event = (type: string, data: Record<string, unknown>) => Schema.encodeSync(SessionEvent.All)(
  Schema.decodeUnknownSync(SessionEvent.All)({ id: "evt_team_live_" + ++serial, type,
    data: { sessionID, assistantMessageID, timestamp: 10 + serial, ...data } }))
const assistant = (text = "HTTP text") => Schema.encodeSync(SessionMessage.Assistant)(
  Schema.decodeUnknownSync(SessionMessage.Assistant)({
    type: "assistant", id: assistantMessageID, agent: "analyst", model: { providerID: "test", id: "model" },
    time: { created: 1 }, content: [
      { type: "text", id: "answer", text },
      { type: "tool", id: "tool", name: "read", time: { created: 1, ran: 2, completed: 3 },
        state: { status: "completed", input: {}, structured: {}, content: [{ type: "text", text: "tool result" }] } },
    ],
  }))

test("late hydration never appends a live delta to an unknown HTTP watermark", () => {
  const live = createTeamSessionLive(), base = assistant()
  expect(live.apply(event("session.next.text.delta", { textID: "answer", delta: "duplicate" }), [base])).toBe(false)
  expect(live.merge([base])).toEqual([base])
  expect(live.apply(event("session.next.text.ended", { textID: "answer", text: "authoritative full value" }), [base])).toBe(true)
  const result = live.merge([base])[0]
  expect(result?.type).toBe("assistant")
  if (result?.type !== "assistant") throw new Error("assistant expected")
  expect(result.content.find((part) => part.id === "answer")).toMatchObject({ text: "authoritative full value" })
  expect(result.content.find((part) => part.id === "tool")).toEqual(base.content[1])
})

test("a stream start admits incremental text, rejects repeated events and preserves stable IDs", () => {
  const live = createTeamSessionLive()
  live.apply(event("session.next.step.started", { agent: "analyst", model: { providerID: "test", id: "model" } }), [])
  const start = event("session.next.text.started", { textID: "answer" })
  live.apply(start, [])
  const delta = event("session.next.text.delta", { textID: "answer", delta: "first" })
  expect(live.apply(delta, [])).toBe(true)
  expect(live.apply(delta, [])).toBe(false)
  expect(live.apply(start, [])).toBe(false)
  live.apply(event("session.next.text.delta", { textID: "answer", delta: " second" }), [])
  const result = live.merge([])[0]
  expect(result?.type === "assistant" && result.content[0]).toEqual({ type: "text", id: "answer", text: "first second" })
  live.apply(event("session.next.text.ended", { textID: "answer", text: "first second" }), [])
  expect(live.apply(event("session.next.text.delta", { textID: "answer", delta: " late" }), [])).toBe(false)
  live.clear()
  expect(live.merge([])).toEqual([])
})

test("HTTP text ahead of an observed start stays visible until the stream catches up or ends", () => {
  const live = createTeamSessionLive(), base = assistant("already observed")
  live.apply(event("session.next.text.started", { textID: "answer" }), [base])
  live.apply(event("session.next.text.delta", { textID: "answer", delta: "already" }), [base])
  const before = live.merge([base])[0]
  expect(before?.type === "assistant" && before.content[0]).toMatchObject({ text: "already observed" })
  live.apply(event("session.next.text.ended", { textID: "answer", text: "already observed final" }), [base])
  const after = live.merge([base])[0]
  expect(after?.type === "assistant" && after.content[0]).toMatchObject({ text: "already observed final" })
})

test("completed HTTP settlement keeps tool parts, billing and full final reasoning", () => {
  const live = createTeamSessionLive(), base = assistant()
  live.apply(event("session.next.reasoning.started", { reasoningID: "thought" }), [base])
  live.apply(event("session.next.reasoning.delta", { reasoningID: "thought", delta: "partial" }), [base])
  live.apply(event("session.next.reasoning.ended", { reasoningID: "thought", text: "full reasoning" }), [base])
  live.apply(event("session.next.step.ended", { finish: "stop", cost: 2, tokens: { input: 3, output: 4, reasoning: 5, cache: { read: 6, write: 7 } } }), [base])
  const result = live.merge([base])[0]
  expect(result?.type).toBe("assistant")
  if (result?.type !== "assistant") throw new Error("assistant expected")
  expect(result.content.find((part) => part.id === "thought")).toMatchObject({ text: "full reasoning" })
  expect(result.cost).toBe(2)
  expect(result.tokens?.reasoning).toBe(5)
  expect(result.content.find((part) => part.id === "tool")).toEqual(base.content[1])
})

test("native transcript projection keeps message identities and exposes attachment names without file requests", () => {
  const base = assistant()
  const info = { id: sessionID, projectID: "technical-only", title: "A", location: { directory: "/technical" },
    cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, time: { created: 1, updated: 1 },
    namespace: { version: 1 as const, authorityGeneration: 1, owner: {
      profile: { installationId: "one", tenantId: "11111111-2222-4333-8444-555555555555", teamObjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      principal: { tenantId: "11111111-2222-4333-8444-555555555555", principalObjectId: "11111111-1111-4111-8111-111111111111" },
    } } }
  const user = Schema.encodeSync(SessionMessage.User)(Schema.decodeUnknownSync(SessionMessage.User)({
    id: "msg_user", type: "user", text: "Review this", time: { created: 0 },
    files: [{ uri: "file:///private/cost.csv", mime: "text/csv", name: "cost.csv" }],
  }))
  const rows = teamTranscriptRows(info, [base, user])
  expect(rows[0]?.id).toBe(assistantMessageID)
  const row = rows[0]
  if (row?.kind !== "message") throw new Error("message row expected")
  expect(row.parts.map((part) => part.id)).toEqual(["answer", "tool"])
  expect(row.info.sessionID).toBe(sessionID)
  expect(row.parts.find((part) => part.type === "tool")).toMatchObject({ callID: "tool" })
  const userRow = rows[1]
  expect(userRow?.kind === "message" && userRow.attachments).toEqual(["cost.csv"])
  expect(userRow?.kind === "message" && userRow.parts.some((part) => part.type === "file")).toBe(false)
})
