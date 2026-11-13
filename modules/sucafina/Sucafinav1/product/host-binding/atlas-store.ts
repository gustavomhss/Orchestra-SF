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
          if (!record || typeof record.owner !== "string" || !record.owner.trim() || (record.kind !== "task" && record.kind !== "project") || memoryKindOf(record.entry) !== record.kind || !validate(record.kind, record.entry).valid || !Number.isSafeInteger(event.seq) || event.seq < 0 || log.has(id)) {
            rejected++
            continue
          }
          const expected = versioned([record]).get(id)
          if (!expected || digestSfValue({ ...event, seq: expected.seq }) !== digestSfValue(expected)) {
            rejected++
            continue
          }
          log.set(id, event)
        } catch {
          rejected++
        }
      }
      // Never expose a partial set: a caller must refuse both task and project reads/writes.
      if (rejected) return { store: [], log: new Map(), rejected }
      const ordered = new Map([...log].sort((a, b) => a[1].seq - b[1].seq))
      return { store: respawnFromRecord(ordered), log: ordered, rejected: 0 }
    },
    append(record: MemoryRecord) {
      const existing = store.read()
      if (existing.rejected) throw new Error("Atlas snapshot is invalid")
      if ((record.kind !== "task" && record.kind !== "project") || memoryKindOf(record.entry) !== record.kind || !validate(record.kind, record.entry).valid || !record.owner.trim()) throw new Error("Atlas record is invalid")
      const [event] = versioned([record]).values()
      if (!event || existing.log.has(event.id)) return
      const seq = Math.max(0, ...[...existing.log.values()].map((item) => item.seq)) + 1
      partition.events.push([event.id, { ...event, seq }])
    },
  }
  return store
}
