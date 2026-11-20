import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfMemoryInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-memory.ts"
import { createSfPlannerObservationBatch } from "../../../../../../../apps/cli/src/sucafina-product/planner-observation-batch.ts"
import { sfPlannerCaseReadAdmission } from "../../../../../../../apps/cli/src/sucafina-product/planner-case-read-batch.ts"
import { plannerObservationFixture, memoryObservationFixture, observePlannerPhase } from "./planner-observation-batch-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("a complete comparison phase preserves every canonical callback and full C08/C02 while reducing only physical reads", async () => {
  const deadline = compositionTestDeadline("planner-physical-phase")
  try {
    const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
    const before = await observation.capture()
    observation.reset()
    const control = await observation.canonical()
    const canonical = { ...observation.counts }
    expect(control.status).toBe("ok")
    if (control.status !== "ok") throw new Error("Actual comparison unavailable")
    expect(control.value.knownDifference).toBe(-240)
    expect(control.value.comparisonStatus).toBe("conditioned")
    expect(canonical.sources).toBeGreaterThan(0)
    expect(canonical.coverage).toBeGreaterThan(0)
    expect(canonical.scalar + canonical.batch).toBeGreaterThan(0)
    observation.reset()
    const observed = await observation.observe(observation.phase, fixture.call, observation.canonical)
    const batched = { ...observation.counts }
    expect(observed).toEqual(control)
    expect(batched.sources).toBe(canonical.sources)
    expect(batched.coverage).toBe(canonical.coverage)
    expect(batched.scalar).toBe(canonical.scalar)
    expect(batched.batch).toBe(canonical.batch)
    expect(batched.sourcesInRoot).toBe(batched.sources)
    expect(batched.roots).toBe(1)
    expect(batched.physical).toBeLessThan(canonical.physical)
    expect(await observation.capture()).toEqual(before)
    observation.reset()
    expect(await observation.observe(observation.phase, fixture.call, observation.canonical)).toEqual(control)
    expect(observation.counts).toEqual(batched)
    expect(await observation.capture()).toEqual(before)
    console.info("SF_PLANNER_PHASE_PHYSICAL", JSON.stringify({ canonical, batched }))
  } finally { await deadline.close() }
}, 120_000)

for (const mixed of [false, true]) {
  test("the actual Portfolio comparison and metric wiring retains full current " + (mixed ? "mixed" : "Planner") + " reads", async () => {
    const deadline = compositionTestDeadline("planner-physical-wiring-" + mixed)
    try {
      const fixture = await plannerObservationFixture(deadline, mixed), observation = observePlannerPhase(fixture, deadline)
      const before = await observation.capture()
      const compared = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
        observation.reset()
        const result = await fixture.portfolio.planner.compareScenarios({
          scenarioRefs: [fixture.request.baselineRef, fixture.request.scenarioRef], criteria: ["cost"],
        }, fixture.call)
        expect(result.status).toBe("ok")
        if (result.status !== "ok") throw new Error("Actual criterion comparison unavailable")
        expect(result.value.knownDifference).toBe(-240)
        expect(result.value.comparisonStatus).toBe("conditioned")
        const criteria = result.value.criterionResults
        expect(criteria).toHaveLength(1)
        if (!criteria) throw new Error("Actual criterion result missing")
        expect(criteria[0]!.criterionId).toBe("cost")
        expect(criteria[0]!.state).toBe("unknown")
        expect(observation.counts.roots).toBe(mixed ? 2 : 1)
        expect(observation.counts.sources).toBeGreaterThan(0)
        expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
        observation.reset()
        const metric = await fixture.portfolio.readMetric(fixture.request, fixture.call)
        expect(metric.status).toBe("ok")
        if (metric.status !== "ok") throw new Error("Actual metric unavailable")
        expect(metric.value.value).toBe(-240)
        expect(metric.value.unit).toBe("USD")
        expect(metric.value.state).toBe("conditioned")
        expect(observation.counts.roots).toBe(mixed ? 2 : 1)
        expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
        return result
      })
      expect(compared.status).toBe("ok")
      expect(await observation.capture()).toEqual(before)
    } finally { await deadline.close() }
  }, 120_000)
}

test("the real empty memory selection keeps two independent full phases and fresh callbacks on the next invocation", async () => {
  const deadline = compositionTestDeadline("memory-physical-phases")
  try {
    const fixture = await memoryObservationFixture(deadline)
    const before = { state: await fixture.authority.state.read(fixture.stateRequest(), "cases", (state, actor) => ({ state, actor })),
      snapshots: await fixture.store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) })) }
    const counts = { roots: 0, sources: 0, sourcesInRoot: 0 }, observed: unknown[] = []
    const root = fixture.store.readSnapshotRoot, source = fixture.business.plannerSources.resolveForecastSource
    fixture.store.readSnapshotRoot = (work, options) => { counts.roots++; return root(work, options) }
    fixture.business.plannerSources.resolveForecastSource = (...args) => {
      counts.sources++
      if (fixture.store.currentSnapshots()) counts.sourcesInRoot++
      return source(...args)
    }
    deadline.own(() => { fixture.store.readSnapshotRoot = root; fixture.business.plannerSources.resolveForecastSource = source })
    const producer = createSfMemoryInputProducer({ ...fixture.dependencies,
      withMemoryObservation: (request, call, work) => fixture.business.withMemoryObservation(request, call, (recall) =>
        work(async (incoming, trusted) => { const result = await recall(incoming, trusted); observed.push(structuredClone(result)); return result })) })
    expect(await producer.prepare(fixture.selection, fixture.request, fixture.call)).toEqual({ status: "ok", value: fixture.selection })
    expect(counts.roots).toBe(2)
    expect(counts.sources).toBeGreaterThan(0)
    expect(counts.sourcesInRoot).toBe(counts.sources)
    const first = { ...counts }
    for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0
    expect(await producer.prepare(fixture.selection, fixture.request, fixture.call)).toEqual({ status: "ok", value: fixture.selection })
    expect(counts).toEqual(first)
    expect(observed).toHaveLength(4)
    for (const result of observed)
      expect(result).toEqual({ status: "ok", matches: [], limitations: [], accessRevision: fixture.call.binding.accessRevision })
    expect(await fixture.authority.state.read(fixture.stateRequest(), "cases", (state, actor) => ({ state, actor }))).toEqual(before.state)
    expect(await fixture.store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) }))).toEqual(before.snapshots)
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["selected-precedent", "historical"] as const) {
  test("a " + boundary + " recall delegates its actual canonical closure without a phase owner", async () => {
    const deadline = compositionTestDeadline("memory-physical-fallback-" + boundary)
    try {
      const fixture = await memoryObservationFixture(deadline)
      const input = { host: fixture.business.host, state: fixture.authority.state, sources: fixture.business.plannerSources,
        readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences }
      const observe = createSfPlannerObservationBatch({ ...input, admissions: [sfPlannerCaseReadAdmission(input)],
        readerIdentities: () => [fixture.business.caseRecall] })
      const request = { caseRef: fixture.caseRef, limit: 50, scope: { query: fixture.selection.query,
        recallScope: { ...fixture.selection.recallScope,
          cases: boundary === "selected-precedent" ? [{ id: "not-an-authorized-precedent", incarnation: "not-a-grant", version: 1 }] : [],
          includeHistorical: boundary === "historical" } } }
      let roots = 0, calls = 0
      const root = fixture.store.readSnapshotRoot
      fixture.store.readSnapshotRoot = (work, options) => { roots++; return root(work, options) }
      deadline.own(() => { fixture.store.readSnapshotRoot = root })
      const canonical = async () => { calls++; return { status: "ok" as const, value: await fixture.business.caseRecall(request, fixture.call) } }
      const control = await canonical(), controlRoots = roots
      roots = 0; calls = 0
      expect(await observe({ kind: "empty-recall", caseRef: fixture.caseRef, request }, fixture.call, canonical)).toEqual(control)
      expect(calls).toBe(1)
      expect(roots).toBe(controlRoots)
      expect(await fixture.authority.host.revalidate(fixture.call)).toBe(true)
    } finally { await deadline.close() }
  }, 120_000)
}

test("a lexical comparison child retains its full closure and argument pin until the parent closes", async () => {
  const deadline = compositionTestDeadline("planner-physical-nested")
  try {
    const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
    const child = structuredClone(observation.phase), calls = { outer: 0, child: 0 }
    const nested = () => observation.observe(observation.phase, fixture.call, async () => {
      calls.outer++
      const first = await observation.canonical()
      const second = await observation.observe(child, fixture.call, async () => { calls.child++; return observation.canonical(child.request) })
      expect(second).toEqual(first)
      return first
    })
    expect((await nested()).status).toBe("ok")
    expect(calls).toEqual({ outer: 1, child: 1 })
    observation.faults.afterRoot = async () => { child.request.scenarioRefs[1] += "-changed-after-child-return" }
    expect((await nested()).status).toBe("unavailable")
    expect(calls).toEqual({ outer: 2, child: 2 })
  } finally { await deadline.close() }
}, 120_000)

for (const fault of ["outside-scenario", "unsupported-shape"] as const) {
  test("a nested " + fault + " cannot borrow the selected case physical owner", async () => {
    const deadline = compositionTestDeadline("planner-physical-child-" + fault)
    try {
      const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
      const child = structuredClone(observation.phase)
      if (fault === "outside-scenario") child.request.scenarioRefs[1] = "unpublished-result-not-in-selected-case"
      const request = fault === "unsupported-shape" ? { ...child.request, implicitSource: "unadmitted" } : child.request
      let childCalls = 0
      const result = await observation.observe(observation.phase, fixture.call, async () => {
        const canonical = await observation.canonical()
        const rejected = await observation.observe({ ...child, request }, fixture.call, async () => {
          childCalls++
          return observation.canonical(child.request)
        })
        expect(rejected.status).not.toBe("ok")
        return canonical
      })
      expect(childCalls).toBe(0)
      expect(result.status).toBe("unavailable")
    } finally { await deadline.close() }
  }, 120_000)
}

for (const fault of ["final-day", "final-actor", "post-envelope-day", "case", "reader"] as const) {
  test("a read phase rejects " + fault + " drift after the physical root closes", async () => {
    const deadline = compositionTestDeadline("planner-physical-egress-" + fault)
    try {
      const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
      const before = await observation.capture(), effects = { outside: false, authority: 0, allowed: false, calls: 0, written: false }
      observation.faults.afterRoot = async () => {
        effects.outside = fixture.store.currentSnapshots() === undefined
        if (fault === "final-day" || fault === "final-actor") observation.faults.afterAuthority = (allowed) => {
          if (++effects.authority !== 4) return
          effects.allowed = allowed
          if (fault === "final-day") fixture.clock.at = "2026-11-15T00:00:00Z"
          else observation.faults.actor = true
        }
        if (fault === "post-envelope-day") observation.faults.afterEnvelope = () => { fixture.clock.at = "2026-11-15T00:00:00Z" }
        if (fault === "reader") {
          const original = fixture.scenarios.resolve
          fixture.scenarios.resolve = (...args) => original(...args)
        }
        if (fault === "case") {
          const current = await fixture.authority.state.read(fixture.stateRequest(), "cases", (state) => state)
          if (current.status !== "ok") throw new Error("Fresh C08 authority unavailable")
          const saved = await fixture.authority.state.transaction(fixture.stateRequest(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
            targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation,
            idempotencyKey: "physical-phase-egress", commandDigest: digestSfValue({ action: "change-objective" }) }, async (state) => {
            state.cases[fixture.caseRef.id]!.objective = "Changed outside the closed physical snapshot"
            return { commit: true, value: true }
          })
          effects.written = saved.status === "ok" && saved.value
        }
      }
      const result = await observation.observe(observation.phase, fixture.call, async () => { effects.calls++; return observation.canonical() })
      expect(effects.outside).toBe(true)
      expect(effects.calls).toBe(1)
      expect(result.status).toBe("unavailable")
      expect(Object.hasOwn(result, "value")).toBe(false)
      if (fault === "final-day" || fault === "final-actor") { expect(effects.authority).toBe(4); expect(effects.allowed).toBe(true) }
      if (fault === "final-actor") expect(observation.faults.actorObserved).toBe(true)
      if (fault === "case") {
        expect(effects.written).toBe(true)
        expect((await observation.capture()).snapshots).not.toEqual(before.snapshots)
      } else expect(await observation.snapshots()).toEqual(before.snapshots)
    } finally { await deadline.close() }
  }, 120_000)
}

test("a caught real C08 write poisons the phase without replaying its canonical comparison", async () => {
  const deadline = compositionTestDeadline("planner-physical-write")
  try {
    const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
    const before = await observation.capture()
    if (before.state.status !== "ok") throw new Error("C08 control unavailable")
    const attempted = { calls: 0, callback: false, caught: false }
    const result = await observation.observe(observation.phase, fixture.call, async () => {
      attempted.calls++
      const canonical = await observation.canonical()
      try {
        await fixture.authority.state.transaction(fixture.stateRequest(), { namespace: "cases", expectedStorageVersion: before.state.storageVersion,
          targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: "forbidden-phase-write",
          commandDigest: digestSfValue({ action: "forbidden-phase-write" }) }, async (state) => {
          attempted.callback = true
          state.cases[fixture.caseRef.id]!.objective = "A readonly phase cannot publish this"
          return { commit: true, value: true }
        })
      } catch { attempted.caught = true }
      return canonical
    })
    expect(attempted).toEqual({ calls: 1, callback: true, caught: true })
    expect(result.status).toBe("unavailable")
    expect(await observation.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)


test("a foreign canonical snapshot receives the complete phase callback without a new owner", async () => {
  const deadline = compositionTestDeadline("planner-physical-foreign-owner")
  try {
    const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
    const before = await observation.capture()
    observation.reset()
    const control = await observation.canonical(), controlCounts = { ...observation.counts }
    expect(control.status).toBe("ok")
    observation.reset()
    let calls = 0
    const result = await fixture.store.transaction("planner", async () => ({ commit: false,
      value: await observation.observe(observation.phase, fixture.call, async () => { calls++; return observation.canonical() }) }))
    expect(result).toEqual(control)
    expect(calls).toBe(1)
    expect(observation.counts.roots).toBe(0)
    expect(observation.counts.sources).toBe(controlCounts.sources)
    expect(observation.counts.coverage).toBe(controlCounts.coverage)
    expect(observation.counts.scalar).toBe(controlCounts.scalar)
    expect(observation.counts.batch).toBe(controlCounts.batch)
    expect(observation.counts.sourcesInRoot).toBe(observation.counts.sources)
    expect(await observation.capture()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

test("an unfinished lexical comparison child cannot return a successful result after its parent closes", async () => {
  const deadline = compositionTestDeadline("planner-physical-child-pending")
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let child: Promise<PortResult<unknown>> | undefined
  let entered = false
  try {
    const fixture = await plannerObservationFixture(deadline), observation = observePlannerPhase(fixture, deadline)
    const started = Promise.withResolvers<void>()
    const result = await observation.observe(observation.phase, fixture.call, async () => {
      child = observation.observe(structuredClone(observation.phase), fixture.call, async () => {
        entered = true
        started.resolve()
        await pending
        return observation.canonical()
      })
      // A regression that refuses the child before work must fail promptly,
      // rather than making this guard wait for its outer test deadline.
      void child.then(() => started.resolve(), () => started.resolve())
      await started.promise
      return fixture.business.cases.read({ caseRef: encodeCaseRef(fixture.caseRef) }, fixture.call)
    })
    expect(entered).toBe(true)
    expect(result.status).toBe("unavailable")
    release()
    expect(child).toBeDefined()
    expect((await child!).status).toBe("unavailable")
  } finally { release(); await child; await deadline.close() }
}, 120_000)
