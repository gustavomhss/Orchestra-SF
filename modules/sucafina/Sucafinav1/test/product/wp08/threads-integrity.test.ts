import { expect, test } from "bun:test"
import { isThread } from "../../../product/collaboration/threads.ts"
import type { CollaborationThread } from "../../../product/collaboration/threads.ts"

function thread(): CollaborationThread {
  return { id: "thread", kind: "clarification", sourceRef: "source", sourceIncarnation: "inc", observedVersion: 7, period: { start: "2027-01-01", end: "2027-01-31" }, recipientRef: "person-B", state: "open", messages: [{ id: "message", incarnation: "message-inc", version: 1, body: "Why?", authorRef: "person-A", createdAt: "2026-11-13T00:00:00Z" }], evidenceRefs: [{ schema: "sf-evidence-v1", kind: "record", refId: "source", installationId: "installation", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "version", incarnation: "inc", version: 7, fields: ["amount"], period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: "b".repeat(64) } }] }
}

test("a stored conversation cannot retarget its observed version, incarnation, or period", () => {
  const original = thread()
  expect(isThread(original)).toBe(true)
  expect(isThread({ ...original, observedVersion: 8 })).toBe(false)
  expect(isThread({ ...original, sourceIncarnation: "replacement" })).toBe(false)
  expect(isThread({ ...original, sourceRef: "other-source" })).toBe(false)
  expect(isThread({ ...original, period: { start: "2028-01-01", end: "2028-01-31" } })).toBe(false)
  expect(isThread({ ...original, evidenceRefs: [...original.evidenceRefs, ...original.evidenceRefs] })).toBe(false)
})

test("stored communication has a real first message and an explicit recipient for questions", () => {
  const original = thread()
  expect(isThread({ ...original, messages: [] })).toBe(false)
  expect(isThread({ ...original, recipientRef: undefined })).toBe(false)
  expect(isThread({ ...original, recipientRef: { name: "person-B" } })).toBe(false)
  expect(isThread({ ...original, messages: [...original.messages, ...original.messages] })).toBe(false)
  expect(isThread({ ...original, kind: "comment", recipientRef: undefined })).toBe(true)
})
