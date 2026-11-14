import type { SourceRef } from "../contracts/context.ts"
import type { HotTopicIntent } from "../dashboard/hot-topics.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/** Only fields explicitly supplied in selected notes become proposed commitments. */
export function prepareFollowups(input: {
  notes: readonly { noteId: string; text: string; source: SourceRef; ownerId?: string; dueDate?: string; priority?: HotTopicIntent["priority"]; existingActionRef?: string }[]
}) {
  const groups = new Map<string, typeof input.notes[number][]>()
  structuredClone(input.notes).forEach((note) => {
    const key = JSON.stringify([note.source.surface, note.source.type, note.source.id, note.source.incarnation, note.noteId])
    groups.set(key, [...groups.get(key) ?? [], note])
  })
  return [...groups.values()].map((notes) => {
    const note = notes[0]!
    if (notes.some((other) => other.text !== note.text || other.ownerId !== note.ownerId || other.dueDate !== note.dueDate || other.priority !== note.priority || other.existingActionRef !== note.existingActionRef || !sameSelection(other.source, note.source) || (other.priority !== undefined && !["critical", "high", "normal"].includes(other.priority)))) {
      return { noteId: note.noteId, source: note.source, state: "conflict" as const }
    }
    return {
      noteId: note.noteId,
      text: note.text,
      source: note.source,
      ownerId: note.ownerId?.trim() ? note.ownerId : null,
      dueDate: note.dueDate?.trim() ? note.dueDate : null,
      priority: note.priority ?? null,
      existingActionRef: note.existingActionRef?.trim() ? note.existingActionRef : null,
      missing: [!note.text.trim() && "action", !note.ownerId?.trim() && "owner", !note.dueDate?.trim() && "due-date", !note.priority && "priority"].filter((item): item is string => !!item),
      state: "proposed" as const,
    }
  })
}

function sameSelection(left: SourceRef, right: SourceRef) {
  // Observation timestamps may differ, but a different field/period selection is another basis.
  const basis = (source: SourceRef) => ({ surface: source.surface, type: source.type, id: source.id, incarnation: source.incarnation, version: source.version, fields: [...source.fields].sort(), period: source.period })
  return digestSfValue(basis(left)) === digestSfValue(basis(right))
}

