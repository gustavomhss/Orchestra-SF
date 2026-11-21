import { expect, test } from "bun:test"
import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry, DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import type { StoredDecisionResult } from "../../../../product/decisions/result-store.ts"
import { createPlannerSensitivity } from "../../../../product/portfolio/planner-sensitivity.ts"
import { createPlannerSensitivityUnits } from "../../../../product/planner/sensitivity-units.ts"
import { createPlannerExactThreshold } from "../../../../product/planner/exact-threshold.ts"
import { comparePlannerPreview, plannerScenarioDigest } from "../../../../product/planner/preview-comparison.ts"
import { observePlannerSensitivity } from "../../../../product/planner/sensitivity-observation.ts"

// Real SQLite/C08, UI authority, Planner, human rule and host product/verifier.
// Human classification assigns the actual Planner components to service while
// training and the other categories remain pending. The production registry owns
// the assessment, evidence checks and durable classification; no assessment is supplied.
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


test("Portfolio host preserves sampled precision through persistence and a new verifier when every category is pending", async () => {
  const deadline = compositionTestDeadline("portfolio-host-pending-threshold", 285_000)
  const observations = { environmentReads: 0 }
  const trace = exactThresholdTrace(deadline, observations)
  try {
    const fixture = await deadline.phase("fixture.complete", () => exactThresholdFixture(deadline, observations, trace, { assessService: false, steps: 1 }))
    const product = fixture.portfolio.product
    if (!product) throw new Error("Actual Portfolio host product unavailable")
    const saved = ok(await deadline.phase("host.evaluate-and-store", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      product.http.sensitivity(fixture.input, fixture.caseRef, fixture.call))), "Pending-only sensitivity persistence")
    expect(saved.sensitivity.evaluated.map((point) => [point.parameterValue, point.value])).toEqual([[80, -240], [400, 80]])
    expect(saved.sensitivity).toMatchObject({ threshold: null, comparisonStatus: "conditioned",
      thresholdEvidence: { state: "sampled", interval: { minimum: 80, maximum: 400 } } })
    expect(saved.sensitivity.unresolvedConditions.some((condition) => condition.reason === "coverage:pending")).toBe(true)
    expect(saved.sensitivity.unresolvedConditions.some((condition) => condition.id === "sampled-range")).toBe(true)
    const inspect = () => fixture.authority.state.read(fixture.transport, "cases", (state) => state)
    const durable = await inspect()
    if (durable.status !== "ok") throw new Error("Persisted sampled sensitivity unavailable")
    const stored = Object.values(durable.value.decisionResults ?? {}).filter((result) => result.kind === "sensitivity")
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ resultRef: saved.sensitivityResultRef, requestDigest: digestSfValue(fixture.input),
      resultDigest: digestSfValue(saved.sensitivity), result: saved.sensitivity })
    const cold = createSfPortfolioServices({ authority: fixture.authority, business: fixture.business, ...fixture.guards })
    deadline.own(() => cold.dispose())
    const coldProduct = cold.product
    if (!coldProduct) throw new Error("Recomposed Portfolio host unavailable")
    expect(cold.proof).not.toBe(fixture.portfolio.proof)
    expect(ok(await deadline.phase("host.recomposed-read", () => fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      coldProduct.http.readSensitivity(saved.sensitivityResultRef, fixture.caseRef, fixture.call))), "Pending-only sensitivity recertification")).toEqual(saved)
    expect(await inspect()).toEqual(durable)
  } finally {
    try { await deadline.close() } finally { trace.finish() }
  }
}, 300_000)


for (const steps of [1, 2]) {
  test("sensitivity revalidates every real sample in order through independent read owners: " + (steps + 1) + " points", async () => {
    const deadline = compositionTestDeadline("sensitivity-sample-pairs-" + steps, 105_000)
    const observations = { environmentReads: 0 }, trace = exactThresholdTrace(deadline, observations)
    try {
      const fixture = await exactThresholdFixture(deadline, observations, trace, { assessService: false, steps })
      const watched = observeSensitivitySamples(fixture, deadline)
      const result = ok(await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
        watched.evaluate(fixture.input, fixture.call)), "Real sample revalidation")
      expect(result.evaluated.map((point) => [point.parameterValue, point.value])).toEqual(
        steps === 1 ? [[80, -240], [400, 80]] : [[80, -240], [240, -80], [400, 80]])
      expect(result.thresholdEvidence).toMatchObject({ state: "sampled", interval: steps === 1
        ? { minimum: 80, maximum: 400 } : { minimum: 240, maximum: 400 } })
      expect(result.threshold).toBeNull()
      expect(result.comparisonStatus).toBe("conditioned")
      expect(result.unresolvedConditions.some((condition) => condition.reason === "coverage:pending")).toBe(true)
      expect(result.evaluated.map((point) => point.resultRef)).toEqual(watched.samples.map((sample) => sample.stored.resultRef))
      expect(watched.events).toEqual(watched.samples.flatMap((_sample, index) =>
        ["read-start:" + index, "read-end:" + index, "preview-start:" + index, "preview-end:" + index]))
      expect(watched.maximumActive()).toBe(1)
      expect(watched.samples).toHaveLength(steps + 1)
      for (const sample of watched.samples) {
        expect(sample.reads).toBe(1)
        expect(sample.previews).toBe(1)
        expect(sample.canonicalCalls).toBe(1)
        expect(sample.readStatus).toBe("ok")
        expect(sample.previewStatus).toBe("ok")
        expect(sample.inRoot).toBe(true)
        expect(sample.outside).toBe(true)
        expect(sample.inputStable).toBe(true)
        expect(sample.sameCall).toBe(true)
        expect(sample.readDigest).toBe(digestSfValue(sample.stored))
        expect(sample.previewDigest).toBe(plannerScenarioDigest(sample.stored.result))
        expect(sample.stored.resultDigest).toBe(digestSfValue(sample.stored.result))
        expect(sample.previewRequestDigest).toBe(sample.stored.requestDigest)
      }
      expect(watched.readersIntact()).toBe(true)
      const durable = ok(await fixture.authority.state.read(fixture.transport, "cases", (state) => ({
        decision: state.cases[fixture.caseRef.id],
        results: Object.values(state.decisionResults ?? {}).filter((value) => value.caseRef.id === fixture.caseRef.id),
      })), "Actual sample persistence")
      expect(durable.results.filter((value) => value.kind === "scenario")).toHaveLength(steps + 3)
      expect(durable.results.filter((value) => value.kind === "sensitivity")).toEqual([])
      expect(durable.decision?.choices).toEqual([])
      expect(durable.decision?.preparedChanges).toEqual([])
      for (const sample of watched.samples)
        expect(durable.results.find((value) => value.resultRef === sample.stored.resultRef)).toEqual(sample.stored)
    } finally {
      try { await deadline.close() } finally { trace.finish() }
    }
  }, 120_000)
}

for (const fault of ["reader", "source", "authority"] as const) {
  test("sample revalidation retains all pairs and refuses real " + fault + " drift at physical egress", async () => {
    const deadline = compositionTestDeadline("sensitivity-sample-egress-" + fault, 105_000)
    const observations = { environmentReads: 0 }, trace = exactThresholdTrace(deadline, observations)
    try {
      const fixture = await exactThresholdFixture(deadline, observations, trace, { assessService: false, steps: 1 })
      const watched = observeSensitivitySamples(fixture, deadline, fault)
      const requestDigest = digestSfValue(fixture.input), binding = fixture.call.binding, lease = fixture.call.lease
      const result = await fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
        watched.evaluate(fixture.input, fixture.call))
      expect(watched.effect.calls).toBe(1)
      expect(watched.effect.outside).toBe(true)
      expect(watched.samples).toHaveLength(2)
      expect(watched.samples.map((sample) => sample.reads)).toEqual([1, 1])
      expect(watched.samples.map((sample) => sample.previews)).toEqual([1, 1])
      expect(watched.events).toEqual(watched.samples.flatMap((_sample, index) =>
        ["read-start:" + index, "read-end:" + index, "preview-start:" + index, "preview-end:" + index]))
      expect(watched.maximumActive()).toBe(1)
      expect(watched.samples[0]!.canonicalCalls).toBe(1)
      expect(watched.samples[0]!.inRoot).toBe(true)
      expect(watched.samples[0]!.outside).toBe(true)
      expect(watched.samples[0]!.previewStatus).toBe("unavailable")
      expect(watched.samples.every((sample) => sample.inputStable && sample.sameCall)).toBe(true)
      expect(result).toEqual(fault === "authority"
        ? { status: "denied", reason: "case-selection-authority-changed" }
        : { status: "stale", reason: "source-or-authority-changed" })
      expect(Object.hasOwn(result, "value")).toBe(false)
      expect(digestSfValue(fixture.input)).toBe(requestDigest)
      expect(fixture.call.binding).toBe(binding)
      expect(fixture.call.lease).toBe(lease)
      if (fault === "reader") expect(watched.effect.readerChanged).toBe(true)
      if (fault === "source") expect(watched.effect.committed).toBe(true)
      if (fault === "authority") {
        expect(fixture.active.value).toBe(false)
        expect(await fixture.authority.host.revalidate(fixture.call)).toBe(false)
      }
    } finally {
      try { await deadline.close() } finally { trace.finish() }
    }
  }, 120_000)
}

// Compose the real sampling producer around local observation callbacks. These
// facades delegate once; they never replace a registered scenario/result reader
// or claim the private batch provenance of those canonical producers.
function observeSensitivitySamples(fixture: Awaited<ReturnType<typeof exactThresholdFixture>>,
  deadline: ReturnType<typeof compositionTestDeadline>, fault?: "reader" | "source" | "authority") {
  type StoredScenario = Extract<StoredDecisionResult, { kind: "scenario" }>
  type Sample = { stored: StoredScenario; index: number; reads: number; previews: number; canonicalCalls: number;
    canonicalFinished: boolean; inRoot: boolean; outside: boolean; inputStable: boolean; sameCall: boolean;
    readStatus?: string; previewStatus?: string; readDigest?: string; previewDigest?: string; previewRequestDigest?: string }
  const samples: Sample[] = [], events: string[] = []
  const local = new AsyncLocalStorage<Sample>()
  const activity = { active: 0, maximum: 0 }
  const effect = { calls: 0, outside: false, committed: false, readerChanged: false }
  const results = fixture.business.results
  const read = results.read, write = results.write
  const source = fixture.business.plannerSources.resolveForecastSource
  const coverage = fixture.business.plannerSources.resolveForecastCoverage
  const scenarios = fixture.business.plannerProduct.scenarios
  if (!scenarios) throw new Error("Real stored-scenario producer unavailable")
  const scalar = scenarios.resolve, batch = scenarios.resolveMany
  const evidence = fixture.business.context.resolve
  const root = fixture.store.readSnapshotRoot
  const phases = observePlannerSensitivity({
    units: createPlannerSensitivityUnits({ host: fixture.authority.host, cases: fixture.business.cases, scenarios,
      store: results, evidence: fixture.business.context, rules: fixture.portfolio.rules }),
    preview: async (request, call) => {
      const sample = local.getStore()
      if (sample) { sample.canonicalCalls++; sample.inRoot = fixture.store.currentSnapshots() !== undefined }
      const result = await comparePlannerPreview({ host: fixture.authority.host, sources: fixture.business.plannerSources,
        scenarios, planner: fixture.portfolio.planner }, request, call)
      if (sample) sample.canonicalFinished = true
      return result
    },
    observe: (request, call, work) => fixture.business.withPlannerObservation(request, call, work),
  })
  const threshold = createPlannerExactThreshold({ units: phases.units, preview: phases.preview })
  const evaluate = createPlannerSensitivity({
    results: { ...results,
      write: async (request, call) => {
        const result = await write.call(results, request, call)
        if (request.kind === "scenario" && result.status === "ok" && result.value.kind === "scenario") {
          samples.push({ stored: structuredClone(result.value), index: samples.length, reads: 0, previews: 0, canonicalCalls: 0,
            canonicalFinished: false, inRoot: false, outside: false, inputStable: true, sameCall: call === fixture.call })
        }
        return result
      },
      read: async (request, call) => {
        const sample = request.kind === "scenario" ? samples.find((entry) => entry.stored.resultRef === request.resultRef) : undefined
        if (sample) { sample.reads++; sample.sameCall &&= call === fixture.call; events.push("read-start:" + sample.index) }
        const result = await read.call(results, request, call)
        if (sample) { sample.readStatus = result.status; if (result.status === "ok") sample.readDigest = digestSfValue(result.value); events.push("read-end:" + sample.index) }
        return result
      },
    },
    resolve: phases.units.resolve, revalidate: phases.units.revalidate,
    preview: async (request, call) => {
      const sample = samples.find((entry) => entry.reads > 0 && entry.stored.requestDigest === digestSfValue(request.scenario))
      if (!sample) return phases.preview(request, call)
      sample.previews++
      sample.sameCall &&= call === fixture.call
      const incomingDigest = digestSfValue(request)
      sample.previewRequestDigest = digestSfValue(request.scenario)
      events.push("preview-start:" + sample.index)
      activity.active++
      activity.maximum = Math.max(activity.maximum, activity.active)
      try {
        const result = await local.run(sample, () => phases.preview(request, call))
        sample.previewStatus = result.status
        sample.inputStable &&= digestSfValue(request) === incomingDigest
        sample.outside = fixture.store.currentSnapshots() === undefined
        if (result.status === "ok") sample.previewDigest = plannerScenarioDigest(result.value.sample)
        return result
      } finally { activity.active--; events.push("preview-end:" + sample.index) }
    },
    exactThreshold: (request, binding, call) => fixture.business.withPlannerObservation({ request, binding }, call,
      () => threshold(request, binding.baselineRef, call)),
    idempotencyKey: async (digest, call) => {
      const identity = fixture.business.operationIdentity(call)
      return identity && await fixture.authority.host.revalidate(call)
        ? "extended:" + digestSfValue({ identity, digest }) : undefined
    },
  })
  if (fault) fixture.store.readSnapshotRoot = async (work, options) => {
    const value = await root(work, options)
    const sample = local.getStore()
    if (sample?.index === 0 && sample.canonicalFinished && !effect.calls && fixture.store.currentSnapshots() === undefined) {
      effect.calls++
      effect.outside = true
      if (fault === "reader") {
        fixture.business.context.resolve = (...args) => evidence.call(fixture.business.context, ...args)
        effect.readerChanged = fixture.business.context.resolve !== evidence
      }
      if (fault === "source") {
        const written = await fixture.persistence.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
          const version = versions.find((entry) => entry.id === "v1")
          if (!version) throw new Error("Actual candidate source unavailable")
          version.lines[0]!.f[0] = 81
          return { commit: true, value: version.lines[0]!.f[0] }
        })
        const stored = await fixture.store.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
          return { commit: false, value: versions.find((entry) => entry.id === "v1")?.lines[0]?.f[0] }
        })
        effect.committed = written === 81 && stored === 81
      }
      if (fault === "authority") fixture.active.value = false
    }
    return value
  }
  deadline.own(() => {
    fixture.store.readSnapshotRoot = root
    fixture.business.context.resolve = evidence
    local.disable()
  })
  return { evaluate, samples, events, effect, maximumActive: () => activity.maximum,
    readersIntact: () => results.read === read && results.write === write &&
      fixture.business.plannerSources.resolveForecastSource === source && fixture.business.plannerSources.resolveForecastCoverage === coverage &&
      fixture.business.plannerProduct.scenarios === scenarios && scenarios.resolve === scalar && scenarios.resolveMany === batch &&
      fixture.business.context.resolve === evidence }
}

async function exactThresholdFixture(deadline: ReturnType<typeof compositionTestDeadline>, observations: { environmentReads: number }, trace: ReturnType<typeof exactThresholdTrace>, options: { assessService?: boolean; steps?: number } = {}) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => {
      observations.environmentReads++
      trace.pulse()
      deadline.check()
    } })
    deadline.own(() => value.dispose())
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
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
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
  for (const [index, source] of sources.entries()) {
    if (source.kind !== "record") throw new Error("Actual Planner record source required")
    const projection = ok(await fixture.business.withCase(setup, caseRef, {}, () =>
      fixture.business.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period, currency: "USD" }, setup)), "Actual coverage component projection").baseline
    expect(projection.components).toHaveLength(12)
    expect(projection.components.every((component) => component.amount !== null && component.evidenceState === "confirmed" && component.sourceRefs.length > 0)).toBe(true)
    const entries: CostCoverageEntry[] = [
      ...(options.assessService === false ? [] : [{ status: "included" as const, categoryId: "service",
        componentRefs: projection.components.map((component) => component.id), evidenceRefs: [source],
        scopeNote: "The selected license forecast supplies these twelve service components; other cost categories remain unresolved." }]),
      { status: "pending", categoryId: "training", reason: "No training evidence has been supplied" },
    ]
    const coverageRequest = { caseRef, source, basis, entries, expectedVersion: 0 }
    const human = ok(await fixture.authority.human.admit(fixture.request(`exact-threshold-coverage-${index}`), "decisions.coverage", coverageRequest), "Actual human coverage admission")
    try {
      const registered = ok(await deadline.phase(`fixture.classify-coverage-${index}`, () => fixture.business.withCase(human, caseRef, {}, () =>
        fixture.business.baselineCoverage.register(coverageRequest, human))), "Actual baseline coverage registration")
      const observed = ok(await fixture.business.withCase(human, caseRef, {}, () =>
        fixture.business.baselineCoverage.resolveForecastCoverage(registered.coverageRef, human)), "Actual registered coverage")
      expect(observed.assessment.coverageState).toBe("pending")
      expect(observed.assessment.entries.find((entry) => entry.categoryId === "training")).toEqual(entries.at(-1))
      expect(observed.assessment.entries.filter((entry) => entry.status !== "pending"))
        .toEqual(options.assessService === false ? [] : [entries[0]])
    } finally { fixture.authority.human.finish(human) }
  }
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
      alternatives.push({ id: result.value.costCoverage.alternativeId, version: result.value.costCoverage.alternativeVersion, title: index ? "Candidate" : "Baseline", scenario, result: result.value })
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
    parameterBounds: { parameterRef: "line:1", minimum: 80, maximum: 400, steps: options.steps ?? 2 }, criterion: { id: "cost", operator: "lte", value: 0 } }
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

// Observe named phases and the environment callback installed before composition.
// Do not replace registered readers: their identities carry batch provenance.
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
  return { call,
    pulse: () => {
      const at = performance.now()
      if (at - clock.lastPulseAt < 15_000) return
      clock.lastPulseAt = at
      summary("pulse")
    },
    finish: () => { summary("finished"); scope.disable() },
  }
}
