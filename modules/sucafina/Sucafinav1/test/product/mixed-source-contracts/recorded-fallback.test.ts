import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { createMixedPlannerFixture } from "./planner-fixture.ts"

test("mixed recorded Planner fallback reads real captured base and amount originals while Procurement stays independently authorized", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("mixed-recorded-fallback", 165_000)
  try {
    const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
    const original = structuredClone(f.decision)
    const firstBase = await f.business.context.resolve(f.refs.base, f.call)
    const firstAmount = await f.business.context.resolve(f.refs.replacement, f.call)
    expect(firstBase.state).toBe("fresh")
    expect(firstAmount.state).toBe("fresh")
    expect((await f.business.context.resolve(f.refs.procurement, f.call)).state).toBe("fresh")
    expect(f.alternative.result.total).toBeNull()
    expect(f.alternative.result.comparisonStatus).toBe("conditioned")
    expect(f.alternative.result.components.find((entry) => entry.id === "line:2")?.amount).toBe(80)
    const capture = await deadline.phase("actual-capture", f.archive)
    expect(capture.status).toBe("committed")
    await f.setForecast(150, "replacement")
    expect((await f.business.plannerSources.resolveForecastSource(f.refs.base.refId, f.call)).status).toBe("ok")
    expect((await f.business.plannerProduct.scenarioInputs.resolveAmount(f.scenario.operations[1]!.replacementRef!, f.call)).status).toBe("stale")
    const before = await f.audit()
    expect(await deadline.phase("historical-amount-fallback", () => f.access(f.decision, f.call))).toBe(true)
    expect(f.observations.fallback).toBe(1)
    expect(await f.audit()).toEqual(before)
    await f.setForecast(160)
    expect((await f.business.plannerSources.resolveForecastSource(f.refs.base.refId, f.call)).status).toBe("stale")
    const historicalBase = await f.business.context.resolve(f.refs.base, f.call)
    const historicalAmount = await f.business.context.resolve(f.refs.replacement, f.call)
    expect(historicalBase.state).toBe("historical")
    expect(historicalAmount.state).toBe("historical")
    expect(historicalBase.authorizedProjection).toEqual(firstBase.authorizedProjection)
    expect(historicalAmount.authorizedProjection).toEqual(firstAmount.authorizedProjection)
    expect(historicalBase.currentRef?.refDigest).not.toBe(f.refs.base.refDigest)
    expect(historicalAmount.currentRef?.refDigest).not.toBe(f.refs.replacement.refDigest)
    f.observations.refs.length = 0
    f.observations.fallback = 0
    const historicalBefore = await f.audit()
    expect(await deadline.phase("historical-base-fallback", () => f.access(f.decision, f.call))).toBe(true)
    expect(f.observations.fallback).toBe(1)
    for (const ref of [f.refs.base, f.refs.replacement]) {
      expect(f.observations.refs.filter((entry) => entry.id === ref.refId)).toEqual([
        { id: ref.refId, state: "historical" }, { id: ref.refId, state: "historical" },
      ])
    }
    // The outer guard observes twice; the recorded verifier observes twice both
    // before and after Planner awaits. The archive never substitutes authority.
    expect(f.observations.refs.filter((entry) => entry.id === f.refs.procurement.refId)).toEqual(
      Array.from({ length: 6 }, () => ({ id: f.refs.procurement.refId, state: "fresh" })))
    expect(await f.audit()).toEqual(historicalBefore)
    const opened = await deadline.phase("installed-case-read", () => f.business.cases.read({ caseRef: encodeCaseRef(f.decision) }, f.call))
    expect(opened.status).toBe("ok")
    if (opened.status !== "ok") throw new Error(opened.reason)
    expect(opened.value.case.alternatives).toEqual(original.alternatives)
    expect((await f.preview()).status).not.toBe("ok")
    expect(f.decision).toEqual(original)
    expect(await f.audit()).toEqual(historicalBefore)
    expect(opened.value.case.choices).toEqual([])
    expect(opened.value.case.preparedChanges).toEqual([])
    expect(opened.value.case.receipts).toEqual([])
    console.info("SF_MIXED_RECORDED_PROOF", JSON.stringify({ fixture: "real-planner-archive-current-procurement", fallbackCount: f.observations.fallback,
      baseOriginal: historicalBase.ref.refDigest, amountOriginal: historicalAmount.ref.refDigest,
      captureStatus: capture.status, captureEvent: capture.sourceEventId, scannerVersion: capture.scanner.version,
      observations: f.observations.refs, immutableCaseDigest: digestSfValue(original), financialApproval: false, originalM31Closed: false }))
  } finally { await deadline.close() }
}, 180_000)

test("recorded mixed verifier rechecks Procurement after real historical Planner reads", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("mixed-recorded-external-race", 165_000)
  try {
    const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
    const capture = await deadline.phase("actual-capture", f.archive)
    await f.setForecast(150)
    expect(await f.recorded(f.decision, f.alternative, f.call)).toBe(true)
    const race: { fired: boolean; after?: Awaited<ReturnType<typeof f.audit>> } = { fired: false }
    f.observations.refs.length = 0
    f.observations.afterResolve = async (ref) => {
      if (race.fired || ref.refId !== f.refs.base.refId) return
      expect(f.observations.refs.at(-1)).toEqual({ id: ref.refId, state: "historical" })
      expect(f.observations.refs.filter((entry) => entry.id === f.refs.procurement.refId)).toEqual(
        Array.from({ length: 2 }, () => ({ id: f.refs.procurement.refId, state: "fresh" })))
      const version = await f.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.versions[`requests:${f.requestId}`]!.version }))
      expect((await f.execute({ page: "Requests", action: "save", id: f.requestId, version, values: { pr: { estAmount: 175 } } })).ok).toBe(true)
      race.fired = true
      race.after = await f.audit()
    }
    // Invoke the real recorded verifier directly so the outer global source
    // fence cannot mask a missing reauthorization inside this producer.
    const allowed = await deadline.phase("external-drift-during-planner", () => f.recorded(f.decision, f.alternative, f.call))
    expect(allowed).toBe(false)
    expect(race.fired).toBe(true)
    expect(f.observations.refs.filter((entry) => entry.id === f.refs.procurement.refId).length).toBeGreaterThan(2)
    if (!race.after) throw new Error("Procurement drift race omitted its durable audit observation")
    expect(await f.audit()).toEqual(race.after)
    console.info("SF_MIXED_RECORDED_PROOF", JSON.stringify({ fixture: "external-drift-during-planner", captureStatus: capture.status,
      eventFired: race.fired, allowed, observations: f.observations.refs, effectsDigest: digestSfValue(race.after), financialEffect: false }))
  } finally { await deadline.close() }
}, 180_000)

test("mixed fallback refuses genuine source change between independent reads and never substitutes latest values", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("mixed-recorded-source-race", 165_000)
  try {
    const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
    await deadline.phase("actual-capture", f.archive)
    await f.setForecast(150)
    expect(await f.access(f.decision, f.call)).toBe(true)
    const original = structuredClone(f.decision)
    const race: { fired: boolean; after?: Awaited<ReturnType<typeof f.audit>> } = { fired: false }
    f.observations.refs.length = 0
    f.observations.afterResolve = async (ref) => {
      if (race.fired || ref.refId !== f.refs.base.refId) return
      expect(f.observations.refs.at(-1)).toEqual({ id: ref.refId, state: "historical" })
      race.fired = true
      await f.setForecast(170)
      race.after = await f.audit()
    }
    expect(await deadline.phase("real-source-race", () => f.access(f.decision, f.call))).toBe(false)
    expect(race.fired).toBe(true)
    expect(race.after).toBeDefined()
    expect(f.observations.refs.filter((entry) => entry.id === f.refs.base.refId)).toHaveLength(2)
    if (!race.after) throw new Error("Planner source race omitted its durable audit observation")
    expect(await f.audit()).toEqual(race.after)
    expect(f.decision).toEqual(original)
    delete f.observations.afterResolve
    expect(await f.access(f.decision, f.call)).toBe(true)
    expect(f.decision.alternatives[0]!.result.components.find((entry) => entry.id === "line:2")?.amount).toBe(80)
    // Deleting then recreating a Planner source preserves visible ID only.
    await f.persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = []; return { commit: true, value: undefined } })
    await f.setForecast(170)
    const recreated = await f.audit()
    expect(await f.access(f.decision, f.call)).toBe(false)
    expect((await f.business.cases.read({ caseRef: encodeCaseRef(f.decision) }, f.call)).status).not.toBe("ok")
    expect(await f.audit()).toEqual(recreated)
    console.info("SF_MIXED_RECORDED_PROOF", JSON.stringify({ fixture: "source-race-and-recreation", eventFired: race.fired,
      independentPlannerReads: f.observations.refs.filter((entry) => entry.id === f.refs.base.refId).length,
      originalCaseDigest: digestSfValue(original), denied: true, financialEffect: false }))
  } finally { await deadline.close() }
}, 180_000)
