import { expect, test } from "bun:test"
import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { CostCoverageBasis, DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Real SQLite/C08, UI authority, Planner, human rule and host product/verifier.
// The only coverage fixture declares unresolved training. Binding real source
// observations as case alternatives is fixture setup, not human promotion.
// This new budget covers calculation plus independent durable recertification
// and retry; it changes no existing test budget and leaves 15s for cleanup.
test("Portfolio host persists an exact known-subtotal threshold, recertifies it after composition, retries once and refuses revoked authority", async () => {
  const deadline = compositionTestDeadline("portfolio-host-exact-threshold", 285_000)
  const observations = { environmentReads: 0 }
  const trace = exactThresholdTrace(deadline, observations)
  const phase = async <T>(name: string, work: () => Promise<T>) => {
    const before = observations.environmentReads
    try { return await trace.call(`phase.${name}`, () => deadline.phase(name, work), {}, true) }
    finally {
      console.info("SF_EXACT_THRESHOLD_OBSERVATION", JSON.stringify({ phase: name,
        environmentReads: observations.environmentReads - before, totalEnvironmentReads: observations.environmentReads }))
    }
  }
  try {
    const fixture = await phase("fixture.complete", () => exactThresholdFixture(deadline, observations, trace))
    const product = fixture.portfolio.product
    if (!product) throw new Error("Actual Portfolio host product is unavailable")
    const inspect = async () => {
      const state = await fixture.authority.state.read(fixture.transport, "cases", (value) => ({
        decision: value.cases[fixture.caseRef.id],
        results: Object.values(value.decisionResults ?? {}).filter((result) => result.caseRef.id === fixture.caseRef.id &&
          result.caseRef.incarnation === fixture.caseRef.incarnation).sort((left, right) => left.resultRef.localeCompare(right.resultRef)),
      }))
      if (state.status !== "ok") throw new Error(`Actual C08 inspection failed: ${state.status}`)
      return { storageVersion: state.storageVersion, ...state.value }
    }
    const before = await phase("storage.before", inspect)
    expect(before.results.map((result) => result.kind)).toEqual(["scenario", "scenario"])
    const saved = ok(await phase("host.evaluate-and-store", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      product.http.sensitivity(fixture.input, fixture.caseRef, fixture.call))), "Host sensitivity evaluation")
    expect(saved.caseRef).toEqual(fixture.caseRef)
    expect(saved.sensitivityResultRef).toMatch(/^decision-result:/)
    expect(saved.sensitivity).toMatchObject({ scenarioRef: fixture.input.scenarioRef, parameterRef: "line:1",
      unit: "USD", parameterUnit: "USD", resultUnit: "USD", engineVersion: "planner-runtime-v1", comparisonStatus: "conditioned" })
    expect(saved.sensitivity.evaluated.map((point) => [point.parameterValue, point.value])).toEqual([[80, -240], [240, -80], [400, 80]])
    expect(new Set(saved.sensitivity.evaluated.map((point) => point.resultRef)).size).toBe(3)
    expect(saved.sensitivity.thresholdEvidence.state).toBe("exact")
    if (saved.sensitivity.thresholdEvidence.state !== "exact" || saved.sensitivity.threshold === null)
      throw new Error("The actual host did not produce an exact threshold")
    expect(saved.sensitivity.threshold).toBe(saved.sensitivity.thresholdEvidence.value)
    // IEEE addition may create a short plateau at 320. The canonical producer
    // must certify its last accepted representable value, not pick a sample.
    expect(saved.sensitivity.threshold).toBeGreaterThanOrEqual(320)
    expect(saved.sensitivity.threshold).toBeLessThan(321)
    expect(saved.sensitivity.evaluated.some((point) => point.parameterValue === saved.sensitivity.threshold)).toBe(false)
    expect(new Set(saved.sensitivity.thresholdEvidence.evidenceRefs.map((ref) => ref.refDigest))).toEqual(new Set(fixture.sources.map((ref) => ref.refDigest)))
    expect(saved.sensitivity.unresolvedConditions.some((condition) => condition.reason === "coverage:pending")).toBe(true)
    expect(saved.sensitivity.unresolvedConditions.some((condition) => condition.reason.includes("training"))).toBe(true)
    expect(saved.sensitivity.unresolvedConditions.some((condition) => condition.id === "known-subtotal-threshold")).toBe(true)
    const durable = await phase("storage.persisted", inspect)
    expect(durable.results.filter((result) => result.kind === "scenario")).toHaveLength(5)
    const stored = durable.results.filter((result) => result.kind === "sensitivity")
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ resultRef: saved.sensitivityResultRef, requestDigest: digestSfValue(fixture.input),
      resultDigest: digestSfValue(saved.sensitivity), result: saved.sensitivity })
    expect(durable.decision).toEqual(before.decision)
    expect(durable.decision?.choices).toEqual([])
    expect(durable.decision?.preparedChanges).toEqual([])

    // A new host service/verifier has no prior in-memory proof. C08, the Request
    // and authority remain real and open; this does not claim a store restart.
    const cold = createSfPortfolioServices({ authority: fixture.authority, business: fixture.business, ...fixture.guards })
    deadline.own(() => cold.dispose())
    trace.observeHost("recomposed", cold)
    const coldProduct = cold.product
    if (!coldProduct) throw new Error("Recomposed Portfolio host product is unavailable")
    expect(coldProduct).not.toBe(product)
    expect(cold.proof).not.toBe(fixture.portfolio.proof)
    const coldBefore = observations.environmentReads
    const reread = ok(await phase("host.recomposed-read", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      coldProduct.http.readSensitivity(saved.sensitivityResultRef, fixture.caseRef, fixture.call))), "Recomposed host sensitivity read")
    expect(reread).toEqual(saved)
    expect(observations.environmentReads).toBeGreaterThan(coldBefore)
    expect(await phase("storage.after-read", inspect)).toEqual(durable)
    const retried = ok(await phase("host.same-operation-retry", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      coldProduct.http.sensitivity(fixture.input, fixture.caseRef, fixture.call))), "Recomposed host sensitivity retry")
    expect(retried).toEqual(saved)
    expect(await phase("storage.after-retry", inspect)).toEqual(durable)

    // Enter the same valid case scope before revoking the real authenticator.
    // The consumer sees the same persisted result, Request, input and context;
    // denial cannot be attributed to an absent fixture selector or a new ID.
    const identity = digestSfValue(fixture.call.binding)
    const inputDigest = digestSfValue(fixture.input)
    const revoked = await phase("host.authority-revoked", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, async () => {
      expect(ok(await fixture.business.resolveCase(fixture.call), "Case before revocation")).toEqual(fixture.caseRef)
      expect(fixture.authority.host.requestFor(fixture.call)).toBe(fixture.transport)
      fixture.active.value = false
      const refused = await coldProduct.http.readSensitivity(saved.sensitivityResultRef, fixture.caseRef, fixture.call)
      expect(refused.status).toBe("denied")
      expect(Object.hasOwn(refused, "value")).toBe(false)
      const refusedRetry = await coldProduct.http.sensitivity(fixture.input, fixture.caseRef, fixture.call)
      expect(refusedRetry.status).toBe("denied")
      expect(Object.hasOwn(refusedRetry, "value")).toBe(false)
      expect(digestSfValue(fixture.call.binding)).toBe(identity)
      expect(digestSfValue(fixture.input)).toBe(inputDigest)
      return refused
    }))
    expect(revoked.status).toBe("denied")
    expect(Object.hasOwn(revoked, "value")).toBe(false)
  } finally {
    try { await deadline.close() } finally { trace.finish() }
  }
}, 300_000)

async function exactThresholdFixture(deadline: ReturnType<typeof compositionTestDeadline>, observations: { environmentReads: number }, trace: ReturnType<typeof exactThresholdTrace>) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => {
      observations.environmentReads++
      trace.pulse()
      deadline.check()
    } })
    deadline.own(() => value.dispose())
    trace.observeShared(value.business)
    trace.observeHost("primary", value.portfolio)
    return value
  })
  const setup = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(setup))
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "exact-threshold-case", incarnation: "exact-threshold-incarnation", version: 1 }
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `v${index}`, name: index ? "Candidate" : "Baseline", year: 2026, closed: 0,
      lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  const sources: CostCoverageBasis["sourceRefs"][number][] = []
  for (const id of ["v0", "v1"]) {
    const issued = ok(await fixture.business.plannerProduct.issueSource(id, setup), `Actual Planner source ${id}`)
    sources.push(issued.evidence)
  }
  const basis: CostCoverageBasis = { id: "exact-threshold-basis", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: sources }
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Certify only the known-subtotal threshold", horizon: period, currency: "USD",
    participants: ["person"], criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], sourceRefs: sources,
    alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("exact-threshold-case"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "exact-threshold-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[caseRef.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Exact-threshold case fixture unavailable")
  fixture.business.bindForecastCoverage(async (reference, context) => {
    const source = await fixture.business.plannerSources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    return { status: "ok", value: { coverageRef: "fixture:exact-threshold-pending-coverage", basis,
      assessment: { basisId: basis.id, basisVersion: basis.version, alternativeId: source.value.versionId === "v0" ? "baseline" : "candidate", alternativeVersion: 1,
        currency: "USD", horizon: period, issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
        entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
  })
  const produced = ok(await deadline.phase("fixture.produce-scenarios", () => fixture.business.withCase(setup, caseRef, {}, async () => {
    const alternatives: DecisionCase["alternatives"][number][] = []
    const resultRefs: string[] = []
    for (const [index, source] of sources.entries()) {
      const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
      const result = await fixture.business.planner.simulateScenario(scenario, setup)
      if (result.status !== "ok") return result
      const saved = await fixture.business.results.write({ kind: "scenario", result: result.value, caseRef,
        requestDigest: digestSfValue(scenario), sourceRefs: result.value.sourceRefs, idempotencyKey: `exact-threshold-source-${index}` }, setup)
      if (saved.status !== "ok") return saved
      resultRefs.push(saved.value.resultRef)
      alternatives.push({ id: index ? "candidate" : "baseline", version: 1, title: index ? "Candidate" : "Baseline", scenario, result: result.value })
    }
    return { status: "ok", value: { alternatives, resultRefs } }
  })), "Actual Planner scenario production")
  const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[caseRef.id])
  if (current.status !== "ok") throw new Error("Exact-threshold fixture versions unavailable")
  const bound = await fixture.authority.state.transaction(fixture.request("exact-threshold-alternatives"), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "exact-threshold-alternatives", commandDigest: digestSfValue(produced.alternatives) }, async (state) => {
    state.cases[caseRef.id] = { ...initial, alternatives: produced.alternatives }
    return { commit: true, value: true }
  })
  if (bound.status !== "ok") throw new Error("Actual source observations could not be bound to the fixture case")
  const product = fixture.portfolio.product
  if (!product) throw new Error("Actual Portfolio host product is unavailable")
  const units = ok(await deadline.phase("fixture.issue-units", () => fixture.business.withCase(setup, caseRef, {}, () =>
    product.http.sensitivityUnits({ caseRef, scenarioRef: produced.resultRefs[1]!, baselineRef: produced.resultRefs[0]!, parameterRef: "line:1" }, setup))), "Actual Planner sensitivity units")
  expect(units.units).toMatchObject({ baselineRef: produced.resultRefs[0], parameterRef: "line:1", parameterUnit: "USD", resultUnit: "USD", engineVersion: "planner-runtime-v1" })
  expect(units.parameterOperation).toMatchObject({ kind: "replace", targetRef: "line:1", amount: 80, currency: "USD" })
  const ruleInput = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const, value: 0,
    unit: "USD", period, evidenceRefs: sources, expectedRuleVersion: 0, sensitivity: units.units }
  const human = ok(await fixture.authority.human.admit(fixture.request("exact-threshold-rule"), "decisions.criteria", ruleInput), "Actual human criterion admission")
  try {
    ok(await deadline.phase("fixture.register-human-rule", () => fixture.business.withCase(human, caseRef, {}, () =>
      fixture.portfolio.rules.register(ruleInput, human))), "Actual human sensitivity rule registration")
  } finally { fixture.authority.human.finish(human) }
  const input: SensitivityRequest = { scenarioRef: produced.resultRefs[1]!,
    parameterBounds: { parameterRef: "line:1", minimum: 80, maximum: 400, steps: 2 }, criterion: { id: "cost", operator: "lte", value: 0 } }
  const transport = fixture.request("exact-threshold-one-operation")
  const call = ok(await fixture.authority.ui.admit(transport, "sf_sensitivity_evaluate", digestSfValue(input)), "Actual sensitivity UI admission")
  deadline.own(() => fixture.authority.ui.finish(call))
  if (!await fixture.authority.ui.validate(call, "sf_sensitivity_evaluate", digestSfValue(input))) throw new Error("Actual sensitivity UI validation failed")
  return { ...fixture, call, transport, caseRef, sources, input }
}

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${result.status}/${result.reason}`)
  return result.value
}

// Observe calls on the actual objects already consumed by the host. Every
// wrapper delegates the same arguments once and returns the same value or
// throws the same error. No factory, numerical result or authority is replaced.
// Durations are inclusive and overlap; environment reads are API calls, not I/O.
function exactThresholdTrace(deadline: ReturnType<typeof compositionTestDeadline>, observations: { environmentReads: number }) {
  type Frame = { id: number; parentId: number | null; name: string; startedAt: number; details: Record<string, unknown> }
  type Metric = { started: number; completed: number; threw: number; inclusiveMs: number; maximumMs: number; outcomes: Record<string, number> }
  const scope = new AsyncLocalStorage<Frame>()
  const active = new Map<number, Frame>()
  const metrics = new Map<string, Metric>()
  const clock = { startedAt: performance.now(), lastPulseAt: performance.now(), nextId: 0 }
  const emit = (event: Record<string, unknown>) => console.info("SF_EXACT_THRESHOLD_TRACE", JSON.stringify({
    elapsedMs: Math.round(performance.now() - clock.startedAt), environmentReads: observations.environmentReads, ...event,
  }))
  const outcome = (value: unknown): string => {
    if (typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return `array:${value.length}`
    if (value && typeof value === "object" && "status" in value && typeof value.status === "string") return value.status
    if (value && typeof value === "object" && "state" in value && typeof value.state === "string") return value.state
    return "returned"
  }
  const summary = (state: string) => emit({ state, aborted: deadline.signal.aborted,
    active: [...active.values()].map((frame) => ({ id: frame.id, parentId: frame.parentId, name: frame.name,
      activeMs: Math.round(performance.now() - frame.startedAt), details: frame.details })),
    metrics: Object.fromEntries([...metrics].map(([name, metric]) => [name, { ...metric,
      inclusiveMs: Math.round(metric.inclusiveMs), maximumMs: Math.round(metric.maximumMs),
      active: metric.started - metric.completed - metric.threw }])),
  })
  const call = async <T>(name: string, work: () => Promise<T>, details: Record<string, unknown> = {}, verbose = false): Promise<T> => {
    const metric: Metric = metrics.get(name) ?? { started: 0, completed: 0, threw: 0, inclusiveMs: 0, maximumMs: 0, outcomes: {} }
    metrics.set(name, metric)
    const ordinal = ++metric.started
    const sampled = verbose || ordinal <= 2 || (ordinal & (ordinal - 1)) === 0
    const frame = { id: ++clock.nextId, parentId: scope.getStore()?.id ?? null, name, startedAt: performance.now(), details }
    active.set(frame.id, frame)
    if (sampled) emit({ state: "started", id: frame.id, parentId: frame.parentId, name, ordinal, details })
    return scope.run(frame, async () => {
      try {
        const value = await work()
        const status = outcome(value)
        metric.completed++
        metric.outcomes[status] = (metric.outcomes[status] ?? 0) + 1
        const durationMs = performance.now() - frame.startedAt
        if (sampled || durationMs >= 1_500 || !["ok", "true", "fresh", "returned"].includes(status) && !status.startsWith("array:"))
          emit({ state: "returned", id: frame.id, parentId: frame.parentId, name, ordinal, status,
            durationMs: Math.round(durationMs), details })
        return value
      } catch (error) {
        metric.threw++
        emit({ state: "threw", id: frame.id, parentId: frame.parentId, name, ordinal,
          durationMs: Math.round(performance.now() - frame.startedAt), errorName: error instanceof Error ? error.name : typeof error, details })
        throw error
      } finally {
        const durationMs = performance.now() - frame.startedAt
        metric.inclusiveMs += durationMs
        metric.maximumMs = Math.max(metric.maximumMs, durationMs)
        active.delete(frame.id)
      }
    })
  }
  const observed = <Args extends unknown[], Value>(name: string, original: (...args: Args) => Promise<Value>,
    describe: (...args: Args) => Record<string, unknown> = () => ({}), verbose = false) =>
    function (this: unknown, ...args: Args) {
      return call(name, () => original.apply(this, args), describe(...args), verbose)
    }
  const install = <Owner extends object, Key extends keyof Owner>(owner: Owner, key: Key, decorate: (original: Owner[Key]) => Owner[Key]) => {
    const original = owner[key]
    owner[key] = decorate(original)
    deadline.own(() => { owner[key] = original })
  }
  const observeHost = (label: string, host: ReturnType<typeof createSfPortfolioServices>) => {
    const units = host.units
    // This is the host's exposed units object. Product-internal units and the
    // lexical issue inside resolve are not claimed as calls to this wrapper.
    if (units) {
      install(units, "issue", (original) => observed(`${label}.hostUnits.issue`, original,
        (request) => ({ scenarioRef: request.scenarioRef, baselineRef: request.baselineRef, parameterRef: request.parameterRef }), true))
      install(units, "resolve", (original) => observed(`${label}.hostUnits.resolve`, original, () => ({}), true))
      install(units, "revalidate", (original) => observed(`${label}.hostUnits.revalidate`, original, () => ({}), true))
    }
    // This is the real numeric producer, not the whole lexical preview
    // comparator: its surrounding source/scenario reads are separate scopes.
    install(host.planner, "simulateScenario", (original) => observed(`${label}.planner.simulateScenario`, original,
      (request) => ({ baseRef: request.baseRef, operations: request.operations.map((operation) => ({
        kind: operation.kind, targetRef: operation.targetRef, amount: operation.amount,
      })) }), true))
    install(host.sensitivityBindings, "bind", (original) => observed(`${label}.sensitivityBindings.bind`, original, () => ({}), true))
    install(host.sensitivityBindings, "read", (original) => observed(`${label}.sensitivityBindings.read`, original, () => ({}), true))
    if (host.proof) install(host.proof, "verifySensitivity", (original) => observed(`${label}.proof.verifySensitivity`, original, () => ({}), true))
    emit({ state: "observing-host", label, exposedUnits: Boolean(units), proof: Boolean(host.proof) })
  }
  const observeShared = (business: Awaited<ReturnType<typeof financialCompositionFixture>>["business"]) => {
    const scenarios = business.plannerProduct.scenarios
    if (scenarios) {
      install(scenarios, "resolve", (original) => observed("shared.scenarios.resolve", original, (reference) => ({ reference })))
      const resolveMany = scenarios.resolveMany
      if (resolveMany) install(scenarios, "resolveMany", () => observed("shared.scenarios.resolveMany", resolveMany,
        (references) => ({ references: [...references] })))
    }
    install(business.cases, "read", (original) => observed("shared.cases.read", original))
    install(business.results, "read", (original) => observed("shared.results.read", original, (request) => ({ kind: request.kind, resultRef: request.resultRef })))
    install(business.results, "readHistoricalScenario", (original) => observed("shared.results.readHistoricalScenario", original, (request) => ({ resultRef: request.resultRef })))
    install(business.results, "readByRequest", (original) => observed("shared.results.readByRequest", original, (request) => ({ kind: request.kind })))
    install(business.results, "write", (original) => observed("shared.results.write", original, (request) => ({ kind: request.kind }), true))
    install(business.context, "resolve", (original) => observed("shared.evidence.resolve", original))
    install(business.context, "context", (original) => observed("shared.evidence.context", original))
    install(business.plannerSources, "resolveForecastSource", (original) => observed("shared.sources.resolveForecastSource", original))
    install(business.plannerSources, "resolveForecastCoverage", (original) => observed("shared.sources.resolveForecastCoverage", original))
    emit({ state: "observing-shared", scenarios: Boolean(scenarios), scenarioBatch: Boolean(scenarios?.resolveMany) })
  }
  return { call, observeHost, observeShared,
    pulse: () => {
      const at = performance.now()
      if (at - clock.lastPulseAt < 15_000) return
      clock.lastPulseAt = at
      summary("pulse")
    },
    finish: () => { summary("finished"); scope.disable() },
  }
}
