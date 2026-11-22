import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { projectionDigest, type ResolvedScenario } from "../../../../product/planner/scenario-comparison-port.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

test("Portfolio reuses completed Planner criteria only inside its invocation and reopens rule, source and access authority", async () => {
  const deadline = compositionTestDeadline("portfolio-criteria-invocation")
  try {
    const fixture = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline))
    const scenarios = fixture.business.plannerProduct.scenarios
    if (!scenarios?.resolveMany) throw new Error("The real native scenario batch is required")
    const decision = sensitivityOk(await fixture.authority.state.read(fixture.transport, "cases", (state) => state.cases[fixture.caseRef.id]))
    if (!decision || decision.alternatives.length !== 2) throw new Error("Both native promotions must be durable")
    const request = { caseRef: fixture.caseRef, baselineAlternativeId: decision.alternatives[0]!.id,
      alternativeId: decision.alternatives[1]!.id, criteria: ["cost"] }
    const compare = () => fixture.portfolio.compare(request, fixture.call)
    const within = <T>(work: () => Promise<PortResult<T>>) => fixture.business.withCase(fixture.call, fixture.caseRef, {}, work)
    const original = sensitivityOk(await deadline.phase("canonical-control", () => within(compare)))
    expect(original.comparison.comparisonStatus).toBe("conditioned")
    expect(original.comparison.criterionResults).toEqual([{ criterionId: "cost", state: "unknown", reason: "criterion-metric-conditioned" }])
    const resolve = scenarios.resolve, batch = scenarios.resolveMany
    const sources = fixture.business.plannerSources, coverage = sources.resolveForecastCoverage
    const availability: { coverage: "ok" | "denied" | "unavailable" } = { coverage: "ok" }
    sources.resolveForecastCoverage = async (...args) => availability.coverage === "ok" ? coverage(...args)
      : { status: availability.coverage, reason: "test-live-coverage-unavailable" }
    const calls = { scalar: 0, batch: 0 }
    scenarios.resolve = async (...args) => { calls.scalar++; return resolve(...args) }
    scenarios.resolveMany = async (...args) => { calls.batch++; return batch(...args) }
    try {
      const observed = sensitivityOk(await deadline.phase("observed-invocation", () => within(() =>
        fixture.portfolio.withComparisonObservation(fixture.call, async () => {
          const first = sensitivityOk(await deadline.phase("cold-scenarios", compare))
          const firstCalls = { ...calls }
          expect(first).toEqual(original)
          expect(firstCalls.batch).toBeGreaterThan(0)
          const repeated = sensitivityOk(await deadline.phase("warm-scenarios", compare))
          expect(repeated).toEqual(first)
          expect(calls).toEqual(firstCalls)
          // Mutating a returned scenario cannot alter its private completed data.
          const reader = fixture.portfolio.observedScenarios
          if (!reader) throw new Error("Observed scenario reader unavailable")
          const scenario = sensitivityOk(await reader.resolve(fixture.references[1]!, fixture.call))
          const expected = structuredClone(scenario)
          Object.assign(scenario.result, { knownSubtotal: 999 })
          expect(sensitivityOk(await reader.resolve(fixture.references[1]!, fixture.call))).toEqual(expected)
          expect(calls).toEqual(firstCalls)
          const rule = sensitivityOk(await fixture.portfolio.rules.resolve({ caseRef: fixture.caseRef, criterionId: "cost" }, fixture.call))
          const input = { caseRef: fixture.caseRef, criterionId: rule.criterionId, metricRef: rule.metricRef,
            operator: rule.operator, value: rule.value + 1, unit: rule.unit, period: rule.period, evidenceRefs: rule.evidenceRefs,
            expectedRuleVersion: rule.version, sensitivity: rule.sensitivity }
          const transport = new Request(fixture.transport.url, { method: "POST", signal: deadline.signal,
            headers: { origin: new URL(fixture.transport.url).origin } })
          const human = sensitivityOk(await fixture.authority.human.admit(transport, "decisions.criteria", input))
          try {
            const saved = sensitivityOk(await fixture.business.withCase(human, fixture.caseRef, {}, () => fixture.portfolio.rules.register(input, human)))
            expect(saved.version).toBe(rule.version + 1)
          } finally { fixture.authority.human.finish(human) }
          sensitivityOk(await compare())
          expect(calls.batch).toBeGreaterThan(firstCalls.batch)
          return { status: "ok" as const, value: first }
        }))))
      expect(observed).toEqual(original)
      const afterInvocation = { ...calls }
      sensitivityOk(await deadline.phase("new-invocation", () => within(() =>
        fixture.portfolio.withComparisonObservation(fixture.call, compare))))
      expect(calls.batch).toBeGreaterThan(afterInvocation.batch)

      // Another asynchronous caller using the same opaque call cannot borrow
      // the lexical observation while its owner is suspended.
      let entered!: () => void, release!: () => void
      const ready = new Promise<void>((resolve) => { entered = resolve })
      const waiting = new Promise<void>((resolve) => { release = resolve })
      const held = within(() => fixture.portfolio.withComparisonObservation(fixture.call, async () => {
        entered()
        await waiting
        return { status: "ok" as const, value: true }
      }))
      await ready
      try { expect((await within(compare)).status).not.toBe("ok") }
      finally { release() }
      expect(sensitivityOk(await held)).toBe(true)

    } finally {
      scenarios.resolve = resolve
      scenarios.resolveMany = batch
      sources.resolveForecastCoverage = coverage
    }
  } finally { await deadline.close() }
}, 120_000)


test("Portfolio scenario reuse checks current producers, both coverages and committed sources", async () => {
  const deadline = compositionTestDeadline("portfolio-criteria-dependencies")
  try {
    const fixture = await sensitivityObservationFixture(deadline)
    const scenarios = fixture.business.plannerProduct.scenarios
    if (!scenarios?.resolveMany) throw new Error("The real native scenario batch is required")
    const decision = sensitivityOk(await fixture.authority.state.read(fixture.transport, "cases", (state) => state.cases[fixture.caseRef.id]))
    if (!decision || decision.alternatives.length !== 2) throw new Error("Both native promotions must be durable")
    const request = { caseRef: fixture.caseRef, baselineAlternativeId: decision.alternatives[0]!.id,
      alternativeId: decision.alternatives[1]!.id, criteria: ["cost"] }
    const compare = () => fixture.portfolio.compare(request, fixture.call)
    const within = <T>(work: () => Promise<PortResult<T>>) => fixture.business.withCase(fixture.call, fixture.caseRef, {}, work)
    const sources = fixture.business.plannerSources, coverage = sources.resolveForecastCoverage
    const availability: { coverage: "ok" | "denied" | "unavailable" } = { coverage: "ok" }
    sources.resolveForecastCoverage = async (...args) => availability.coverage === "ok" ? coverage(...args)
      : { status: availability.coverage, reason: "test-live-coverage-unavailable" }
    try {
      // Changed providers cannot disclose warmed data. Criterion evaluation
      // itself still goes through the original comparison observation.
      sensitivityOk(await within(() => fixture.portfolio.withComparisonObservation(fixture.call, async () => {
        sensitivityOk(await compare())
        const current = scenarios.resolveMany
        scenarios.resolveMany = async (...args) => current!(...args)
        try { expect((await compare()).status).not.toBe("ok") }
        finally { scenarios.resolveMany = current }
        const evaluate = fixture.portfolio.rules.evaluate
        fixture.portfolio.rules.evaluate = (...args) => evaluate(...args)
        try { expect((await compare()).status).not.toBe("ok") }
        finally { fixture.portfolio.rules.evaluate = evaluate }
        const product = fixture.business.plannerProduct
        const simulate = product.planner.simulateScenario
        product.planner.simulateScenario = (...args) => simulate(...args)
        try { expect((await compare()).status).not.toBe("ok") }
        finally { product.planner.simulateScenario = simulate }
        fixture.business.plannerProduct = { ...product }
        try { expect((await compare()).status).not.toBe("ok") }
        finally { fixture.business.plannerProduct = product }
        return { status: "ok" as const, value: true }
      })))
      for (const failure of ["denied", "unavailable"] as const) {
        sensitivityOk(await within(() => fixture.portfolio.withComparisonObservation(fixture.call, async () => {
          sensitivityOk(await compare())
          availability.coverage = failure
          // The callback identity stays the same after the successful warmup.
          try { expect((await compare()).status).not.toBe("ok") }
          finally { availability.coverage = "ok" }
          return { status: "ok" as const, value: true }
        })))
      }

      // A real committed Planner source mutation invalidates the closed proof.
      sensitivityOk(await within(() => fixture.portfolio.withComparisonObservation(fixture.call, async () => {
        sensitivityOk(await compare())
        await fixture.persistence.transaction("planner", async (snapshot) => {
          const before = digestSfValue(snapshot.data)
          snapshot.data = { ...snapshot.data, versions: [] }
          expect(digestSfValue(snapshot.data)).not.toBe(before)
          return { commit: true, value: true }
        })
        expect((await compare()).status).not.toBe("ok")
        return { status: "ok" as const, value: true }
      })))
    } finally { sources.resolveForecastCoverage = coverage }
  } finally { await deadline.close() }
}, 120_000)

test("a warm Portfolio observation cannot survive real UI authority revocation", async () => {
  const deadline = compositionTestDeadline("portfolio-criteria-revocation")
  try {
    const fixture = await sensitivityObservationFixture(deadline)
    const request = { scenarioRefs: fixture.references, criteria: ["cost"] }
    let warmed = false
    const result = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.portfolio.withComparisonObservation(fixture.call, async () => {
        sensitivityOk(await fixture.portfolio.planner.compareScenarios(request, fixture.call))
        warmed = true
        fixture.control.active = false
        expect((await fixture.portfolio.planner.compareScenarios(request, fixture.call)).status).not.toBe("ok")
        expect(await fixture.authority.host.revalidate(fixture.call)).toBe(false)
        return { status: "ok" as const, value: true }
      }))
    expect(warmed).toBe(true)
    expect(result.status).not.toBe("ok")
  } finally { await deadline.close() }
}, 120_000)


test("sibling sensitivity reads independently reopen one baseline while recursive reads remain refused", async () => {
  const deadline = compositionTestDeadline("portfolio-sibling-scenarios")
  try {
    const fixture = await sensitivityObservationFixture(deadline)
    const scenarios = fixture.business.plannerProduct.scenarios
    const reader = fixture.portfolio.observedScenarios
    if (!scenarios || !reader?.resolveMany) throw new Error("Real scalar and batch scenario readers are required")
    const within = <T>(work: () => Promise<PortResult<T>>) => fixture.business.withCase(fixture.call, fixture.caseRef, {}, work)
    const reference = fixture.references[0]!
    const observed = (value: ResolvedScenario) => ({ ...value, projection: projectionDigest(value.projection) })
    const original = observed(sensitivityOk(await within(() => scenarios.resolve(reference, fixture.call))))
    const resolve = scenarios.resolve
    let entered!: () => void, release!: () => void
    const started = new Promise<void>((ready) => { entered = ready })
    const waiting = new Promise<void>((ready) => { release = ready })
    let calls = 0
    scenarios.resolve = async (...args) => {
      calls++
      if (calls === 1) { entered(); await waiting }
      return resolve(...args)
    }
    try {
      sensitivityOk(await within(() => fixture.portfolio.withComparisonObservation(fixture.call, async () => {
        const pending = reader.resolve(reference, fixture.call)
        await started
        let sibling: Awaited<typeof pending>
        try { sibling = await reader.resolve(reference, fixture.call) }
        finally { release() }
        const first = sensitivityOk(await pending)
        expect(observed(sensitivityOk(sibling))).toEqual(original)
        expect(observed(first)).toEqual(original)
        expect(calls).toBe(2)
        // Both completed scalar and batch consumers retain their own values.
        const [scalar, batch] = await Promise.all([
          reader.resolve(reference, fixture.call),
          reader.resolveMany!([...fixture.references], fixture.call),
        ])
        expect(observed(sensitivityOk(scalar))).toEqual(original)
        expect(batch).toHaveLength(fixture.references.length)
        expect(batch.every((value) => value.status === "ok")).toBe(true)
        const copied = sensitivityOk(batch[0]!)
        Object.assign(copied.result, { knownSubtotal: 999 })
        expect(observed(sensitivityOk(scalar))).toEqual(original)
        return { status: "ok" as const, value: true }
      })))
    } finally { release(); scenarios.resolve = resolve }

    // A reader that recursively calls the same facade is not a sibling.
    let recursion: PortResult<unknown> | undefined
    scenarios.resolve = async (...args) => {
      recursion = await reader.resolve(...args)
      return resolve(...args)
    }
    try {
      sensitivityOk(await within(() => fixture.portfolio.withComparisonObservation(fixture.call, async () => {
        const value = await reader.resolve(reference, fixture.call)
        expect(recursion).toEqual({ status: "denied", reason: "portfolio-comparison-invocation-unavailable" })
        expect(observed(sensitivityOk(value))).toEqual(original)
        return { status: "ok" as const, value: true }
      })))
    } finally { scenarios.resolve = resolve }
  } finally { await deadline.close() }
}, 120_000)
