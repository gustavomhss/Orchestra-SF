import type { SourceRef } from "../contracts/context.ts"
import type { HotTopicIntent } from "../dashboard/hot-topics.ts"

/** Only fields explicitly supplied in selected notes become proposed commitments. */
export function prepareFollowups(input: {
  notes: readonly { noteId: string; text: string; source: SourceRef; ownerId?: string; dueDate?: string; priority?: HotTopicIntent["priority"]; existingActionRef?: string }[]
}) {
  const groups = new Map<string, typeof input.notes[number][]>()
  input.notes.forEach((note) => {
    const key = JSON.stringify([note.source.surface, note.source.type, note.source.id, note.source.incarnation, note.noteId])
    groups.set(key, [...groups.get(key) ?? [], note])
  })
  return [...groups.values()].map((notes) => {
    const note = notes[0]!
    if (notes.some((other) => other.text !== note.text || other.ownerId !== note.ownerId || other.dueDate !== note.dueDate || other.priority !== note.priority || other.existingActionRef !== note.existingActionRef || other.source.version !== note.source.version || (other.priority !== undefined && !["critical", "high", "normal"].includes(other.priority)))) {
      return { noteId: note.noteId, source: note.source, state: "conflict" as const }
    }
    return {
      noteId: note.noteId,
      text: note.text,
      source: note.source,
      ownerId: note.ownerId ?? null,
      dueDate: note.dueDate ?? null,
      priority: note.priority ?? null,
      existingActionRef: note.existingActionRef ?? null,
      missing: [!note.ownerId && "owner", !note.dueDate && "due-date", !note.priority && "priority"].filter((item): item is string => !!item),
      state: "proposed" as const,
    }
  })
}
