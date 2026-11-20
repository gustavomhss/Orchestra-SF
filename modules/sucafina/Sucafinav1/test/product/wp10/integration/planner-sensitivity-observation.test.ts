import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { sfPlannerSensitivityObservation, sfPlannerSensitivitySources } from "../../../../../../../apps/cli/src/sucafina-product/planner-sensitivity-observation.ts"
import { sensitivityObservationFixture } from "./planner-sensitivity-observation-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

for (const selected of [
  ...["units", "resolve", "revalidate", "preview", "exact", "bound-exact"].map((name) => ({ name, sourceOnly: false })),
  ...["preview", "exact"].map((name) => ({ name, sourceOnly: true })),
]) {
  const { name, sourceOnly } = selected
  test("the complete " + name + (sourceOnly ? " source-only" : "") + " sensitivity phase retains canonical callbacks and every current envelope", async () => {
    const deadline = compositionTestDeadline("sensitivity-physical-" + name)
    try {
      const world = await sensitivityObservationFixture(deadline, { sourceOnly })
      const { fixture, observation, observe, phase, canonical } = world
      const selected = world.cases.find((entry) => entry.name === name)!
      const work: () => Promise<PortResult<unknown>> = selected.work
      const before = await observation.capture(), inputBefore = world.inputDigest()
      observation.reset()
      const control = await canonical(selected.incoming, work), expected = { ...observation.counts }
      expect(control.status).toBe("ok")
      if (control.status !== "ok") throw new Error("Canonical sensitivity observation unavailable")
      if (name === "revalidate") expect(control.value).toBe(true)
      if (name === "exact" || name === "bound-exact") {
        expect(control.value).toMatchObject({ value: expect.any(Number), evidenceRefs: expect.any(Array) })
        const value = control.value as { value: number; evidenceRefs: readonly unknown[] }
        expect(value.value).toBeGreaterThanOrEqual(320)
        expect(value.value).toBeLessThan(321)
        expect(value.evidenceRefs.length).toBeGreaterThan(0)
      }
      expect(expected.sources).toBeGreaterThan(0)
      expect(expected.coverage).toBeGreaterThan(0)
      expect(expected.scalar + expected.batch).toBeGreaterThan(0)
      observation.reset()
      const result = await observe(phase(selected.incoming), fixture.call, () => canonical(selected.incoming, work))
      const batched = { ...observation.counts }
      expect(result).toEqual(control)
      expect(batched.sources).toBe(expected.sources)
      expect(batched.coverage).toBe(expected.coverage)
      expect(batched.scalar).toBe(expected.scalar)
      expect(batched.batch).toBe(expected.batch)
      expect(batched.sourcesInRoot).toBe(batched.sources)
      expect(batched.roots).toBe(1)
      expect(batched.physical).toBeLessThan(expected.physical)
      expect(world.inputDigest()).toBe(inputBefore)
      expect(await observation.capture()).toEqual(before)
      observation.reset()
      expect(await observe(phase(selected.incoming), fixture.call, () => canonical(selected.incoming, work))).toEqual(control)
      expect(observation.counts).toEqual(batched)
      expect(await observation.capture()).toEqual(before)
      console.info("SF_SENSITIVITY_PHASE_PHYSICAL", JSON.stringify({ name, sourceOnly, canonical: expected, batched }))
    } finally { await deadline.close() }
  }, 120_000)
}

test("the actual Portfolio units and HTTP composition enter the sensitivity owner independently", async () => {
  const deadline = compositionTestDeadline("sensitivity-physical-wiring")
  try {
    const world = await sensitivityObservationFixture(deadline)
    const { fixture, observation, selection } = world
    const before = await observation.capture()
    const units = fixture.portfolio.units, product = fixture.portfolio.product
    if (!units || !product) throw new Error("Actual Portfolio sensitivity composition unavailable")
    await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      observation.reset()
      const issued = await units.issue(selection, fixture.call)
      expect(issued).toEqual({ status: "ok", value: world.issued })
      expect(observation.counts.roots).toBe(1)
      expect(observation.counts.sources).toBeGreaterThan(0)
      expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
      observation.reset()
      const resolved = await units.resolve(world.request, fixture.call)
      expect(resolved).toEqual({ status: "ok", value: world.binding })
      expect(observation.counts.roots).toBe(1)
      expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
      observation.reset()
      expect(await units.revalidate(world.binding, fixture.call)).toBe(true)
      expect(observation.counts.roots).toBe(1)
      expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
      observation.reset()
      const publicUnits = await product.http.sensitivityUnits({ ...selection, caseRef: fixture.caseRef }, fixture.call)
      expect(publicUnits.status).toBe("ok")
      if (publicUnits.status !== "ok") throw new Error("Actual HTTP sensitivity units unavailable")
      expect(publicUnits.value.units).toEqual(world.issued.units)
      expect(observation.counts.roots).toBe(1)
      expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
      return publicUnits
    })
    expect(await observation.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

for (const fault of ["unknown-shape", "outside-scenario", "outside-preview", "new-assumption", "different-operation", "foreign-binding", "source-currency", "source-period"] as const) {
  test("an ineligible " + fault + " sensitivity phase preserves the full canonical fallback", async () => {
    const deadline = compositionTestDeadline("sensitivity-physical-fallback-" + fault)
    try {
      const world = await sensitivityObservationFixture(deadline, { sourceOnly: fault === "source-currency" || fault === "source-period" })
      const { fixture, observation, observe, phase, canonical } = world
      const incoming = fault === "unknown-shape" ? { ...world.selection, implicitSource: "not-an-admission" }
        : fault === "outside-scenario" ? { ...world.selection, scenarioRef: "unpublished-result-outside-selected-case" }
        : fault === "outside-preview" ? { ...world.previewRequest, scenario: { ...world.previewRequest.scenario, baseRef: "unselected-source" } }
        : fault === "new-assumption" ? { ...world.previewRequest, scenario: { ...world.previewRequest.scenario,
          assumptions: [{ id: "unadmitted-assumption", value: true, evidenceRefs: [], state: "hypothetical" }] } }
        : fault === "different-operation" ? { ...world.previewRequest, scenario: { ...world.previewRequest.scenario,
          operations: world.previewRequest.scenario.operations.map((operation) => ({ ...operation, currency: "EUR" })) } }
        : fault === "source-currency" ? { ...world.previewRequest, scenario: { ...world.previewRequest.scenario,
          operations: world.previewRequest.scenario.operations.map((operation) => ({ ...operation, currency: "EUR" })) } }
        : fault === "source-period" ? { ...world.previewRequest, scenario: { ...world.previewRequest.scenario,
          operations: world.previewRequest.scenario.operations.map((operation) => ({ ...operation, period: { start: "2026-02-01", end: "2026-02-28" } })) } }
        : { ...world.binding, caseRef: { ...fixture.caseRef, incarnation: "not-the-selected-case" } }
      if (fault === "unknown-shape") expect(sfPlannerSensitivityObservation(incoming)).toBe(false)
      let calls = 0
      // This guard observes the canonical producer itself, even when the outer
      // descriptor is unsupported. It proves fallback is once, with no grant
      // inferred from a request shape or from another result's case.
      const work = () => { calls++; return canonical(world.selection, () => world.units.issue(world.selection, fixture.call)) }
      const before = await observation.capture()
      observation.reset()
      const control = await work(), expected = { ...observation.counts }
      expect(control.status).toBe("ok")
      observation.reset(); calls = 0
      expect(await observe(phase(incoming), fixture.call, work)).toEqual(control)
      expect(calls).toBe(1)
      expect(observation.counts.sources).toBe(expected.sources)
      expect(observation.counts.coverage).toBe(expected.coverage)
      expect(observation.counts.scalar).toBe(expected.scalar)
      expect(observation.counts.batch).toBe(expected.batch)
      expect(observation.counts.sourcesInRoot).toBe(expected.sourcesInRoot)
      expect(observation.counts.roots).toBe(expected.roots + (fault === "unknown-shape" ? 0 : 1))
      expect(await observation.capture()).toEqual(before)
    } finally { await deadline.close() }
  }, 120_000)
}

for (const fault of ["source", "case", "reader", "request", "lease", "final-day", "final-actor", "post-envelope-day"] as const) {
  test("a sensitivity phase refuses " + fault + " drift after the root and before release", async () => {
    const deadline = compositionTestDeadline("sensitivity-physical-egress-" + fault)
    try {
      const world = await sensitivityObservationFixture(deadline)
      const { fixture, observation, observe, phase, canonical } = world
      const before = await observation.capture()
      const effects = { calls: 0, outside: false, authority: 0, allowed: false, committed: false }
      observation.faults.afterRoot = async () => {
        effects.outside = fixture.store.currentSnapshots() === undefined
        if (fault === "source") {
          await fixture.store.transaction("planner", async (snapshot) => {
            const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
            versions.find((version) => version.id === "v1")!.lines[0]!.f[0] = 81
            effects.committed = true
            return { commit: true, value: undefined }
          })
        }
        if (fault === "case") {
          const current = await fixture.authority.state.read(fixture.stateRequest(), "cases", (state) => state)
          if (current.status !== "ok") throw new Error("Current C08 authority unavailable")
          const saved = await fixture.authority.state.transaction(fixture.stateRequest(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
            targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation,
            idempotencyKey: "sensitivity-egress", commandDigest: digestSfValue({ objective: "changed outside" }) }, async (state) => {
            state.cases[fixture.caseRef.id]!.objective = "Changed after the completed sensitivity read"
            return { commit: true, value: true }
          })
          effects.committed = saved.status === "ok" && saved.value
        }
        if (fault === "reader") {
          const resolve = world.units.resolve
          world.units.resolve = (...args) => resolve(...args)
        }
        if (fault === "request") observation.host.requestFor(fixture.call)!.headers.set("x-sensitivity-egress", "changed")
        if (fault === "lease") fixture.authority.ui.finish(fixture.call)
        if (fault === "final-day" || fault === "final-actor") observation.faults.afterAuthority = (allowed) => {
          if (++effects.authority !== 4) return
          effects.allowed = allowed
          if (fault === "final-day") fixture.clock.at = "2026-11-15T00:00:00Z"
          else observation.faults.actor = true
        }
        if (fault === "post-envelope-day") observation.faults.afterEnvelope = () => { fixture.clock.at = "2026-11-15T00:00:00Z" }
      }
      const result = await observe(phase(world.selection), fixture.call, async () => {
        effects.calls++
        return canonical(world.selection, () => world.units.issue(world.selection, fixture.call))
      })
      expect(effects.outside).toBe(true)
      expect(effects.calls).toBe(1)
      expect(result.status).toBe("unavailable")
      expect(Object.hasOwn(result, "value")).toBe(false)
      if (fault === "source" || fault === "case") expect(effects.committed).toBe(true)
      else expect(await observation.snapshots()).toEqual(before.snapshots)
      if (fault === "final-day" || fault === "final-actor") { expect(effects.authority).toBe(4); expect(effects.allowed).toBe(true) }
      if (fault === "final-actor") expect(observation.faults.actorObserved).toBe(true)
    } finally { await deadline.close() }
  }, 120_000)
}

test("a sensitivity child pins its input until fresh egress and cannot borrow a foreign source", async () => {
  const deadline = compositionTestDeadline("sensitivity-physical-child")
  try {
    const world = await sensitivityObservationFixture(deadline)
    const { fixture, observation, observe, phase, canonical } = world
    const incoming = { request: world.request, baselineRef: world.selection.baselineRef }, child = structuredClone(world.previewRequest)
    let childCalls = 0
    const work = async () => {
      const first = await canonical(world.selection, () => world.units.issue(world.selection, fixture.call))
      const second = await observe(phase(child), fixture.call, () => { childCalls++; return world.preview(child) })
      expect(second.status).toBe("ok")
      return first
    }
    expect((await observe(phase(incoming), fixture.call, work)).status).toBe("ok")
    expect(childCalls).toBe(1)
    observation.faults.afterRoot = async () => { child.scenario.operations[0]!.amount = 241 }
    expect((await observe(phase(incoming), fixture.call, work)).status).toBe("unavailable")
    expect(childCalls).toBe(2)
    let foreignCalls = 0
    const foreign = await observe(phase(incoming), fixture.call, async () => {
      const result = await canonical(world.selection, () => world.units.issue(world.selection, fixture.call))
      const rejected = await observe(phase({ ...child, scenario: { ...child.scenario, baseRef: "unselected-source" } }), fixture.call, async () => {
        foreignCalls++
        return world.preview(child)
      })
      expect(rejected.status).not.toBe("ok")
      return result
    })
    expect(foreignCalls).toBe(0)
    expect(foreign.status).toBe("unavailable")
  } finally { await deadline.close() }
}, 120_000)

test("a caught write poisons sensitivity observation without repeating its real producer", async () => {
  const deadline = compositionTestDeadline("sensitivity-physical-write")
  try {
    const world = await sensitivityObservationFixture(deadline)
    const { fixture, observation, observe, phase, canonical } = world
    const before = await observation.capture()
    if (before.state.status !== "ok") throw new Error("C08 control unavailable")
    const attempted = { calls: 0, callback: false, caught: false }
    const result = await observe(phase(world.selection), fixture.call, async () => {
      attempted.calls++
      const result = await canonical(world.selection, () => world.units.issue(world.selection, fixture.call))
      try {
        await fixture.authority.state.transaction(fixture.stateRequest(), { namespace: "cases", expectedStorageVersion: before.state.storageVersion,
          targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: "forbidden-sensitivity-write",
          commandDigest: digestSfValue({ action: "forbidden-sensitivity-write" }) }, async (state) => {
          attempted.callback = true
          state.cases[fixture.caseRef.id]!.objective = "A sensitivity read cannot publish"
          return { commit: true, value: true }
        })
      } catch { attempted.caught = true }
      return result
    })
    expect(attempted).toEqual({ calls: 1, callback: true, caught: true })
    expect(result.status).toBe("unavailable")
    expect(await observation.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

test("a changed persisted scenario body cannot obtain a sensitivity owner from its old digest", async () => {
  const deadline = compositionTestDeadline("sensitivity-physical-result-digest")
  try {
    const world = await sensitivityObservationFixture(deadline)
    const { fixture, observation } = world
    const before = await observation.capture()
    if (before.state.status !== "ok") throw new Error("Real C08 envelope unavailable")
    const state = structuredClone(before.state.value.state), decision = state.cases[fixture.caseRef.id]!
    expect(sfPlannerSensitivitySources(world.selection, decision, state, fixture.sources)).toBe(true)
    const stored = state.decisionResults?.[world.selection.scenarioRef]
    if (!stored || stored.kind !== "scenario" || stored.result.knownSubtotal === null) throw new Error("Real stored scenario unavailable")
    stored.result.knownSubtotal += 1
    expect(digestSfValue(stored.result)).not.toBe(stored.resultDigest)
    expect(sfPlannerSensitivitySources(world.selection, decision, state, fixture.sources)).toBe(false)
    // The adversarial envelope is a detached input to admission, never persisted
    // as a replacement result or used as a financial proof.
    expect(await observation.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)
