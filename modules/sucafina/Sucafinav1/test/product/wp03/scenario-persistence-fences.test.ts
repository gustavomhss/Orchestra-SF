import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { createWp05SensitivityFixture } from "../wp05/engine-fixture.ts"

test("scenario persistence replays the real composed producer before and after writing and rejects forged totals", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    const current = await fixture.planner.simulateScenario(fixture.scenario, fixture.context)
    expect(current.status).toBe("ok")
    if (current.status !== "ok") throw new Error("Planner result unavailable")
    const counts = { writes: 0, replays: 0 }
    const store = { ...fixture.results, write: async (...args: Parameters<typeof fixture.results.write>) => {
      counts.writes++
      return fixture.results.write(...args)
    } }
    const resolveCase = async (): Promise<PortResult<typeof fixture.caseRef>> => {
      const read = await fixture.cases.read({ caseRef: encodeCaseRef(fixture.caseRef) }, fixture.context)
      return read.status === "ok" ? { status: "ok", value: { id: read.value.case.id, incarnation: read.value.case.incarnation, version: read.value.case.version } } : read
    }
    const replay = { ...fixture.planner, simulateScenario: async (...args: Parameters<typeof fixture.planner.simulateScenario>) => {
      counts.replays++
      return fixture.planner.simulateScenario(...args)
    } }
    const input = { kind: "scenario" as const, request: fixture.scenario, result: current.value }
    const persist = createPlannerResultPersistence({ store, resolveCase })
    expect(await persist(input, "missing-replay", fixture.context)).toEqual({ status: "unavailable", reason: "scenario-replay-unavailable" })
    expect(counts.writes).toBe(0)
    expect(await persist({ ...input, result: { ...current.value, knownSubtotal: 210001 } }, "forged-subtotal", fixture.context, replay)).toEqual({ status: "stale", reason: "scenario-replay-changed" })
    expect(await persist({ ...input, result: { ...current.value, components: current.value.components.map((component) => component.id === "implementation:11" ? { ...component, amount: 45001 } : component) } }, "forged-component", fixture.context, replay)).toEqual({ status: "stale", reason: "scenario-replay-changed" })
    expect(counts.writes).toBe(0)
    const replayCount = counts.replays
    const saved = await persist(input, "persist-composed", fixture.context, replay)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") throw new Error(`Producer persistence unavailable: ${JSON.stringify(saved)}`)
    expect(counts.replays - replayCount).toBe(2)
    expect(counts.writes).toBe(1)
    const stored = await fixture.results.read({ kind: "scenario", resultRef: saved.value.resultRef }, fixture.context)
    expect(stored.status).toBe("ok")
    if (stored.status !== "ok" || stored.value.kind !== "scenario") throw new Error("Persisted scenario unavailable")
    expect(stored.value.result).toEqual(input.result)
    expect(stored.value.requestDigest).toBe(digestSfValue(input.request))
    expect(stored.value.result.restrictions).toContain("preview-not-applied")
    expect(stored.value.result.total).toBeNull()
    expect(await persist(input, "persist-composed", fixture.context, replay)).toEqual(saved)
    const byRequest = await fixture.results.readByRequest({ caseRef: fixture.caseRef, kind: "scenario", idempotencyKey: "persist-composed", requestDigest: digestSfValue(input.request) }, fixture.context)
    expect(byRequest).toMatchObject({ status: "ok", value: { state: "found", result: { resultRef: saved.value.resultRef } } })
    const decision = await fixture.cases.read({ caseRef: encodeCaseRef(fixture.caseRef) }, fixture.context)
    expect(decision.status).toBe("ok")
    if (decision.status !== "ok") throw new Error("Current decision unavailable")
    expect(decision.value.case.choices).toEqual([])
    expect(decision.value.case.preparedChanges).toEqual([])
    expect(decision.value.case.receipts).toEqual([])

    const revokedAfterWrite = createPlannerResultPersistence({ store: { ...fixture.results, write: async (...args) => {
      const result = await fixture.results.write(...args)
      if (result.status === "ok") fixture.revokeSource(fixture.scenario.baseRef)
      return result
    } }, resolveCase, replay })
    const denied = await revokedAfterWrite(input, "lost-authority-after-save", fixture.context)
    expect(denied.status).not.toBe("ok")
    expect("value" in denied).toBe(false)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
  } finally { await fixture.cleanup() }
}, 180000)

test("scenario persistence detects a changed case selection after the actual result commit", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    const produced = await fixture.planner.simulateScenario(fixture.scenario, fixture.context)
    expect(produced.status).toBe("ok")
    if (produced.status !== "ok") throw new Error("Planner result unavailable")
    const selection = { ...fixture.caseRef }
    const persist = createPlannerResultPersistence({ store: { ...fixture.results, write: async (...args) => {
      const result = await fixture.results.write(...args)
      if (result.status === "ok") selection.version++
      return result
    } }, replay: fixture.planner, resolveCase: async () => ({ status: "ok", value: selection }) })
    expect(await persist({ kind: "scenario", request: fixture.scenario, result: produced.value }, "case-selection-changed", fixture.context)).toEqual({ status: "stale", reason: "scenario-case-changed" })
  } finally { await fixture.cleanup() }
}, 180000)
