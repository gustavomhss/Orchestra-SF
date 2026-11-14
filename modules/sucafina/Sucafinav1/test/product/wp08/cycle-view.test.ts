import { expect, test } from "bun:test"
import { createCollaborationCycleView } from "../../../product/collaboration/cycle-view.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const period = { start: "2026-03-01", end: "2026-03-31" }

function projection(version = 1) {
  return { case: { id: "case-1", incarnation: "inc-1", version, horizon: { start: "2026-01-01", end: "2026-12-31" }, participants: ["principal"], questions: [], sourceRefs: [] } } as never
}

test("cycle view returns an explicitly empty cycle without implying completion", async () => {
  const value = projection()
  const view = createCollaborationCycleView({
    cases: { read: async () => ({ status: "ok", value }) },
    work: { list: async () => ({ status: "ok", value: { items: [] } }) } as never,
    host: { revalidate: async () => true },
  })
  const result = await view.read({ caseRef: "case:case-1:inc-1", selection: { selectionRef: "selection", period } }, context)
  expect(result).toMatchObject({ status: "ok", value: { period, participants: ["principal"], state: "empty" } })
  expect(result.status === "ok" && "complete" in result.value).toBe(false)
})

test("cycle view rejects periods outside the authorized case horizon before listing work", async () => {
  let listed = false
  const view = createCollaborationCycleView({
    cases: { read: async () => ({ status: "ok", value: projection() }) },
    work: { list: async () => { listed = true; return { status: "ok", value: { items: [] } } } } as never,
    host: { revalidate: async () => true },
  })
  const result = await view.read({ caseRef: "case:case-1:inc-1", selection: { selectionRef: "selection", period: { start: "2025-12-01", end: "2026-01-31" } } }, context)
  expect(result).toMatchObject({ status: "needs-input", reason: "period-outside-case-horizon" })
  expect(listed).toBe(false)
})

test("cycle view refuses case changes before egress", async () => {
  let reads = 0
  const view = createCollaborationCycleView({
    cases: { read: async () => ({ status: "ok", value: projection(++reads === 1 ? 1 : 2) }) },
    work: { list: async () => ({ status: "ok", value: { items: [] } }) } as never,
    host: { revalidate: async () => true },
  })
  expect(await view.read({ caseRef: "case:case-1:inc-1", selection: { selectionRef: "selection", period } }, context)).toMatchObject({ status: "stale", reason: "case-changed" })
})
