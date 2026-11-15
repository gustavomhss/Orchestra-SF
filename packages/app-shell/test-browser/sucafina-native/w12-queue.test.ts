import { expect, test } from "bun:test"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import {
  SF_QUEUE_INITIAL_FILTERS,
  sfQueueFilterOptions,
  sfQueueFilterRows,
  sfQueueFindRow,
  sfQueueMeasuredWait,
  sfQueueVisible,
} from "../../src/orchestra/chapters/sucafina/procurement/queues/model"
import type { SfProcurementQueueRow } from "../../src/orchestra/chapters/sucafina/procurement/queues/model"

// PRESENTATION-ONLY fixtures. Not a simulated host, installed producer, grant,
// authenticated owner or end-to-end Procurement acceptance.
const ref = (id: string): SfRef => id as SfRef
const row = (id: string, overrides: Partial<SfProcurementQueueRow> = {}): SfProcurementQueueRow => ({
  id: ref(id),
  group: "waitingForYou",
  sourceRef: "source-" + id,
  sourceDigest: "digest-" + id,
  version: 3,
  status: "pr_pending",
  subject: "Source subject " + id,
  holder: "holder-1",
  approvalStage: "PR",
  stageEnteredAt: "2026-11-14T11:00:00Z",
  ageDays: 0,
  baseAmount: 0,
  baseCurrency: "USD",
  submittedAmount: 0,
  submittedCurrency: "USD",
  originalAmount: 0,
  originalCurrency: "USD",
  monetaryState: "known",
  reason: null,
  nextStep: "Review approval",
  ...overrides,
})

test("W12 filters only the authorized provided rows; it never invents other holders, counts or server ordering", () => {
  const input = [
    row("r_b", { holder: "someone-else", group: "waitingForOthers", status: "src_pending", approvalStage: "Sourcing" }),
    row("r_a", { holder: "holder-1" }),
    row("r_c", { holder: null, group: "unassigned", status: "po_pending", approvalStage: "PO" }),
  ]
  const selected = sfQueueFilterRows(input, { group: null, status: null, stage: null, query: "" })
  expect(selected.map((item) => item.id)).toEqual([ref("r_b"), ref("r_a"), ref("r_c")])
  expect(sfQueueFilterRows(input, { group: null, status: "pr_pending", stage: "PR", query: "" }).map((item) => item.id)).toEqual([ref("r_a")])
  expect(sfQueueFilterRows(input, { group: null, status: null, stage: null, query: "sourcing" }).map((item) => item.id)).toEqual([ref("r_b")])
  expect(sfQueueFilterOptions(input)).toEqual({
    statuses: ["src_pending", "pr_pending", "po_pending"],
    stages: ["Sourcing", "PR", "PO"],
    groups: ["waitingForOthers", "waitingForYou", "unassigned"],
  })
  expect(input[0]?.holder).toBe("someone-else")
  expect(input[2]?.holder).toBeNull()
})

test("W12 maps authorized empty vs filtered-empty without treating partial, denial or failure as zero", () => {
  const source = [row("r_a")]
  expect(sfQueueVisible("ready", [], SF_QUEUE_INITIAL_FILTERS, undefined).state).toBe("empty")
  expect(sfQueueVisible("ready", source, { group: null, status: "po_issued", stage: null, query: "" }, undefined).state).toBe("filtered-empty")
  expect(sfQueueVisible("partial", [], SF_QUEUE_INITIAL_FILTERS, undefined).state).toBe("partial")
  for (const failure of ["denied", "session-expired", "unavailable", "loading", "stale", "not-found"] as const) {
    const visible = sfQueueVisible(failure, source, SF_QUEUE_INITIAL_FILTERS, ref("r_a"))
    expect(visible.state).toBe(failure)
    expect(visible.rows).toEqual([])
    expect(visible.selected).toBeUndefined()
  }
})

test("W12 only selects by the producer's original opaque request ref, never a title or position", () => {
  const source = [
    row("r_one", { subject: "The same title", version: 1 }),
    row("r_two", { subject: "The same title", version: 4 }),
  ]
  expect(sfQueueFindRow(source, ref("r_two"))?.version).toBe(4)
  expect(sfQueueFindRow(source, ref("The same title"))).toBeUndefined()
  expect(sfQueueVisible("ready", source, SF_QUEUE_INITIAL_FILTERS, ref("r_two")).selected?.id).toBe(ref("r_two"))
  expect(sfQueueVisible("ready", source, SF_QUEUE_INITIAL_FILTERS, ref("removed")).selected).toBeUndefined()
})

test("W12 preserves measured zero and rejects absent/unproven aging, without Date.now or SLA math", () => {
  const measured = sfQueueMeasuredWait(row("r_a", { ageDays: 0 }))
  expect(measured).toEqual({ kind: "measured", at: "2026-11-14T11:00:00Z", days: 0 })
  expect(sfQueueMeasuredWait(row("r_b", { stageEnteredAt: null, ageDays: 2 }))).toEqual({ kind: "unavailable" })
  expect(sfQueueMeasuredWait(row("r_c", { stageEnteredAt: "2026-11-14T11:00:00Z", ageDays: null }))).toEqual({ kind: "unavailable" })
  expect(sfQueueMeasuredWait(row("r_d", { ageDays: -1 }))).toEqual({ kind: "unavailable" })
  expect(sfQueueMeasuredWait(row("r_e", { ageDays: Number.NaN }))).toEqual({ kind: "unavailable" })
})
