import { expect, test } from "bun:test"
import { createPlannerExactThreshold } from "../../../../product/planner/exact-threshold.ts"
import { observePlannerSensitivity } from "../../../../product/planner/sensitivity-observation.ts"
import { sensitivityObservationFixture } from "./planner-sensitivity-observation-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("exact with distinct human alternatives on the same base keeps every preview canonical", async () => {
  const deadline = compositionTestDeadline("sensitivity-shared-base-fallback")
  try {
    const world = await sensitivityObservationFixture(deadline, { sharedBase: true })
    const { fixture, observation, observe, phase, canonical } = world
    expect(fixture.promotedAlternative?.status).toBe("ok")
    if (fixture.promotedAlternative?.status !== "ok") throw new Error("Real sibling promotion unavailable")
    const before = await observation.capture(), inputBefore = world.inputDigest()
    expect(before.state.status).toBe("ok")
    if (before.state.status !== "ok") throw new Error("Real promoted case unavailable")
    const current = before.state.value.state.cases[fixture.caseRef.id]!
    expect(current.version).toBe(fixture.promotedAlternative.value.caseRef.version)
    const alternatives = current.alternatives.filter((alternative) => alternative.scenario.baseRef === world.issued.scenario.baseRef)
    expect(alternatives).toHaveLength(2)
    expect(new Set(alternatives.map((alternative) => alternative.id)).size).toBe(2)
    expect(alternatives.map((alternative) => alternative.scenario.operations[0]!.amount).sort((a, b) => a! - b!)).toEqual([80, 90])
    expect(fixture.promotedAlternative.value.resultRef).toBeString()
    const effects = { calls: 0, outside: false, previews: 0, previewsOutside: 0, authority: 0 }
    const revalidate = fixture.business.host.revalidate
    fixture.business.host.revalidate = async (call) => { effects.authority++; return revalidate(call) }
    deadline.own(() => { fixture.business.host.revalidate = revalidate })
    const composed = observePlannerSensitivity({
      units: world.units,
      preview: (incoming) => {
        effects.previews++
        if (!fixture.store.currentSnapshots()) effects.previewsOutside++
        return world.preview(incoming)
      },
      observe: (incoming, call, work) => observe(phase(incoming), call, work),
    })
    const exact = createPlannerExactThreshold(composed)
    const incoming = { request: world.request, baselineRef: world.selection.baselineRef }
    const work = () => {
      effects.calls++
      effects.outside = fixture.store.currentSnapshots() === undefined
      return canonical(incoming, () => exact(world.request, world.selection.baselineRef, fixture.call))
    }
    observation.reset()
    const control = await deadline.phase("exact.control", work), expected = { ...observation.counts }, controlEffects = { ...effects }
    expect(control.status).toBe("ok")
    if (control.status !== "ok") throw new Error("Canonical shared-base exact threshold unavailable")
    expect(control.value.value).toBeGreaterThanOrEqual(320)
    expect(control.value.value).toBeLessThan(321)
    expect(control.value.evidenceRefs.length).toBeGreaterThan(0)
    expect(controlEffects.previews).toBeGreaterThan(0)
    expect(controlEffects.previewsOutside).toBe(controlEffects.previews)
    expect(controlEffects.authority).toBeGreaterThan(0)
    expect(expected.sources).toBeGreaterThan(0)
    expect(expected.coverage).toBeGreaterThan(0)
    expect(expected.scalar + expected.batch).toBeGreaterThan(0)
    observation.reset()
    Object.assign(effects, { calls: 0, outside: false, previews: 0, previewsOutside: 0, authority: 0 })
    expect(await deadline.phase("exact.observed", () => observe(phase(incoming), fixture.call, work))).toEqual(control)
    expect(effects.calls).toBe(1)
    expect(effects.outside).toBe(true)
    expect(effects.previews).toBe(controlEffects.previews)
    expect(effects.previewsOutside).toBe(effects.previews)
    expect(effects.authority).toBeGreaterThanOrEqual(controlEffects.authority)
    expect(observation.counts.sources).toBe(expected.sources)
    expect(observation.counts.coverage).toBe(expected.coverage)
    expect(observation.counts.scalar).toBe(expected.scalar)
    expect(observation.counts.batch).toBe(expected.batch)
    expect(observation.counts.sourcesInRoot).toBe(expected.sourcesInRoot)
    expect(observation.counts.roots).toBe(expected.roots + 1)
    expect(world.inputDigest()).toBe(inputBefore)
    expect(await observation.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)
