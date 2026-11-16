import { memoryKindOf, respawnFromRecord, validate, versioned } from "@orchestra/atlas-boundary/business-memory-ports"
import type { DurableMemory, MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { digestSfValue } from "../contracts/canonical.ts"

/** Operates only on a snapshot already isolated by the caller's persistence transaction. */
export function createSfAtlasDurableMemory(partition: { events: Array<Parameters<ReturnType<typeof versioned>["set"]>> }): DurableMemory {
  const store: DurableMemory = {
    path: "__sfProductV1.atlas",
    read() {
      const log: ReturnType<typeof versioned> = new Map()
      let rejected = 0
      if (!Array.isArray(partition.events)) return { store: [], log, rejected: 1, unreadable: true as const }
      for (const item of partition.events) {
        try {
          if (!Array.isArray(item) || item.length !== 2 || !item[1] || typeof item[1] !== "object") {
            rejected++
            continue
          }
          const [id, event] = item
          const record = event.payload as MemoryRecord
          if (!record || typeof record.owner !== "string" || !record.owner.trim() || (record.kind !== "task" && record.kind !== "project") || memoryKindOf(record.entry) !== record.kind || !validate(record.kind, record.entry).valid ||
            !Number.isSafeInteger(event.seq) || event.seq !== log.size + 1 || log.has(id)) {
            rejected++
            continue
          }
          // Atlas/KERNEL-9 deliberately excludes seq from content identity. Compare
          // the authentic event bytes to Atlas' canonical event *without* either
          // ordinal, then validate the persisted append ordinal independently.
          const expected = versioned([record]).get(id)
          if (!expected) {
            rejected++
            continue
          }
          const { seq: _persistedSeq, ...persistedIdentity } = event
          const { seq: _canonicalSeq, ...canonicalIdentity } = expected
          if (digestSfValue(persistedIdentity) !== digestSfValue(canonicalIdentity)) {
            rejected++
            continue
          }
          log.set(id, event)
        } catch {
          rejected++
        }
      }
      // Never expose a partial set: corruption in any ordinal, identity or
      // record invalidates the entire owner journal for reads and appends.
      if (rejected) return { store: [], log: new Map(), rejected }
      // Keep the physical append order; sorting could conceal corruption.
      return { store: respawnFromRecord(log), log, rejected: 0 }
    },
    append(record: MemoryRecord) {
      const existing = store.read()
      if (existing.rejected) throw new Error("Atlas snapshot is invalid")
      if ((record.kind !== "task" && record.kind !== "project") || memoryKindOf(record.entry) !== record.kind || !validate(record.kind, record.entry).valid || !record.owner.trim()) throw new Error("Atlas record is invalid")
      const [event] = versioned([record]).values()
      if (!event || existing.log.has(event.id)) return
      // The verified journal is contiguous from 1. Count is therefore the
      // durable head; after process restart the next append remains monotonic.
      const seq = existing.log.size + 1
      if (!Number.isSafeInteger(seq)) throw new Error("Atlas sequence exhausted")
      partition.events.push([event.id, { ...event, seq }])
    },
  }
  return store
}
