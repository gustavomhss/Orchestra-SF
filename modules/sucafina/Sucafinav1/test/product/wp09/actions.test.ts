import { expect, test } from "bun:test"
import { prepareFollowups } from "../../../product/routines/actions.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"

const source: SourceRef = { surface: "dashboard", type: "topic", id: "topic", incarnation: "inc", version: 1, fields: ["notes"], period: { start: "2027-01-01", end: "2027-01-31" }, observedAt: "2027-01-31T00:00:00Z" }

test("followups preserve explicit fields and leave ambiguous owner and deadline unresolved", () => {
  const note = { noteId: "note-1", text: "ver com alguém", source }
  const result = prepareFollowups({ notes: [note, note] })
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ ownerId: null, dueDate: null, priority: null, missing: ["owner", "due-date", "priority"], state: "proposed", source })
  expect(prepareFollowups({ notes: [{ ...note, ownerId: "person-1", dueDate: "2027-01-31", priority: "normal", existingActionRef: "action-1" }] })[0]).toMatchObject({ ownerId: "person-1", dueDate: "2027-01-31", priority: "normal", existingActionRef: "action-1", missing: [] })
})

test("conflicting copies of a note do not silently select an owner or action", () => {
  const note = { noteId: "note", text: "Discuss", source, ownerId: "a" }
  const result = prepareFollowups({ notes: [note, { ...note, ownerId: "b" }] })
  expect(result).toEqual([{ noteId: "note", source, state: "conflict" }])
  const separate = prepareFollowups({ notes: [note, { ...note, source: { ...source, incarnation: "replacement" } }] })
  expect(separate).toHaveLength(2)
  expect(prepareFollowups({ notes: [{ ...note, priority: "high" }, { ...note, priority: "normal" }] })[0]).toMatchObject({ state: "conflict" })
})

test("a note cannot silently change field or period basis, and emitted proposals are isolated from input mutation", () => {
  const selected = { noteId: "n", text: "Review", source: structuredClone(source), ownerId: " ", dueDate: " ", priority: "normal" as const }
  const prepared = prepareFollowups({ notes: [selected] })
  expect(prepared[0]).toMatchObject({ ownerId: null, dueDate: null, missing: ["owner", "due-date"] })
  selected.source.fields = ["private"]
  expect(prepared[0]!.source.fields).toEqual(["notes"])
  expect(prepareFollowups({ notes: [selected, { ...selected, source }] })).toMatchObject([{ state: "conflict" }])
  expect(prepareFollowups({ notes: [selected, { ...selected, source: { ...selected.source, period: { start: "2027-02-01", end: "2027-02-28" } } }] })).toMatchObject([{ state: "conflict" }])
  expect(prepareFollowups({ notes: [{ ...selected, text: " " }] })[0]).toMatchObject({ missing: ["action", "owner", "due-date"] })
})

