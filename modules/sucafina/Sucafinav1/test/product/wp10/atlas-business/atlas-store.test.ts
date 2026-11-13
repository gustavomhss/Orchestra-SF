import { expect, test } from "bun:test"
import type { MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { createSfAtlasDurableMemory } from "../../../../product/host-binding/atlas-store.ts"

const first: MemoryRecord = { owner: "sf-case-v1:first", kind: "task", entry: { taskId: "work:1", attempted: ["A"], failedWith: [], stoppedAt: "decided", lesson: "Reason A" } }
const second: MemoryRecord = { owner: "sf-case-v1:first", kind: "task", entry: { taskId: "work:2", attempted: ["B"], failedWith: [], stoppedAt: "decided", lesson: "Reason B" } }

test("snapshot store preserves ordered canonical events and deduplicates identical records", () => {
  const partition: Parameters<typeof createSfAtlasDurableMemory>[0] = { events: [] }
  const store = createSfAtlasDurableMemory(partition)
  store.append(first)
  store.append(second)
  store.append(first)
  const reopened = createSfAtlasDurableMemory(structuredClone(partition)).read()
  expect(reopened.rejected).toBe(0)
  expect(reopened.store).toEqual([first, second])
  expect([...reopened.log.values()].map((event) => event.seq)).toEqual([1, 2])
})

test("snapshot store reports tampered or duplicate event identities", () => {
  const partition: Parameters<typeof createSfAtlasDurableMemory>[0] = { events: [] }
  const store = createSfAtlasDurableMemory(partition)
  store.append(first)
  const event = partition.events[0]!
  partition.events[0] = [event[0], { ...event[1], payload: second }]
  expect(store.read().rejected).toBeGreaterThan(0)
  expect(store.read().store).toEqual([])
  expect(() => store.append(second)).toThrow()
  partition.events.push(partition.events[0]!)
  expect(store.read().rejected).toBeGreaterThan(1)
})
