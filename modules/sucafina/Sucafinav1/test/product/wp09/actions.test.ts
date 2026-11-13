import { expect, test } from "bun:test"
import { prepareFollowups } from "../../../product/routines/actions.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"

test("followups preserve explicit fields and leave ambiguous owner and deadline unresolved", () => {
  const source = { id: "topic" } as SourceRef
  const note = { noteId: "note-1", text: "ver com alguém", source }
  const result = prepareFollowups({ notes: [note, note] })
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ ownerId: null, dueDate: null, priority: null, missing: ["owner", "due-date", "priority"], state: "proposed", source })
  expect(prepareFollowups({ notes: [{ ...note, ownerId: "person-1", dueDate: "2027-01-31", priority: "normal", existingActionRef: "action-1" }] })[0]).toMatchObject({ ownerId: "person-1", dueDate: "2027-01-31", priority: "normal", existingActionRef: "action-1", missing: [] })
})

test("conflicting copies of a note do not silently select an owner or action", () => {
  const source = { surface: "dashboard", type: "topic", id: "topic", incarnation: "inc", version: 1 } as SourceRef
  const note = { noteId: "note", text: "Discuss", source, ownerId: "a" }
  const result = prepareFollowups({ notes: [note, { ...note, ownerId: "b" }] })
  expect(result).toEqual([{ noteId: "note", source, state: "conflict" }])
  const separate = prepareFollowups({ notes: [note, { ...note, source: { ...source, incarnation: "replacement" } }] })
  expect(separate).toHaveLength(2)
  expect(prepareFollowups({ notes: [{ ...note, priority: "high" }, { ...note, priority: "normal" }] })[0]).toMatchObject({ state: "conflict" })
})
