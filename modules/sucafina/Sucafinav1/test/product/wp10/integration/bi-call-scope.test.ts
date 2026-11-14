import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import type { BiViewRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import { createSfBiCallScope } from "../../../../../../../apps/cli/src/sucafina-product/bi-call-scope.ts"
import { sfDecisionBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Real annual inputs, human coverage/promotions, comparison producer and C08
// persistence, matching the BI/browser acceptance fixture. No stored result,
// producer response, native admission or authorization is invented here.
async function prepare(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => value.dispose())
    return value
  })
  const { authority, business, portfolio, persistence } = fixture
  // This authority/privacy fixture projects one whole month from two real
  // annual sources. The case and human coverage retain that same horizon;
  // it does not claim annual coverage or a complete financial comparison.
  const period = { start: "2026-01-01", end: "2026-01-31" }
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `bi-v${index}`, name: index ? "BI candidate" : "BI baseline", year: 2026, closed: 0,
      lines: [{ id: "line", name: "Private license service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { requests: {}, suppliers: [], settings: { currency: "USD" } }
    return { commit: true, value: undefined }
  })
  await persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => authority.ui.finish(call))
  const sources: BaselineCoverageRequest["source"][] = []
  const componentIds: string[][] = []
  for (const index of [0, 1]) {
    const issued = ok(await deadline.phase(`source.${index}`, () => business.plannerProduct.issueSource(`bi-v${index}`, call)), "Issue real BI source")
    const forecast = ok(await deadline.phase(`forecast.${index}`, () => business.planner.compareForecast({ baseRef: issued.evidence.refId,
      candidateRef: issued.evidence.refId, period, currency: "USD" }, call)), "Read real BI forecast")
    expect(forecast.baseline.components.length).toBeGreaterThan(0)
    expect(forecast.baseline.context.period).toEqual(period)
    expect(issued.evidence.target.period).toEqual({ start: "2026-01-01", end: "2026-12-31" })
    sources.push(issued.evidence)
    componentIds.push(forecast.baseline.components.map((component) => component.id))
  }
  const initialRef = { id: "bi-private-case", incarnation: "bi-private-incarnation", version: 1 }
  const basis: BaselineCoverageRequest["basis"] = { id: "bi-renewal", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
  const initial: DecisionCase = { ...initialRef, state: "draft", objective: "Real comparison for BI access counterproof", horizon: period, currency: "USD",
    criteria: [], participants: ["person"], sourceRefs: sources, alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(fixture.request("bi-empty-case"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "bi-empty-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error(`Empty BI case: ${JSON.stringify(seeded)}`)
  const classifications: { coverageRef: string; version: number }[] = []
  for (const [index, source] of sources.entries()) {
    const coverage: BaselineCoverageRequest = { caseRef: initialRef, source, basis, expectedVersion: 0,
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
        ? { categoryId, status: "included", componentRefs: componentIds[index]!, evidenceRefs: [source], scopeNote: "Human classifies license service; all other categories remain pending" }
        : { categoryId, status: "pending", reason: "Awaiting human evidence" }) }
    const human = ok(await authority.human.admit(fixture.request(`bi-coverage-${index}`), "decisions.coverage", coverage), "Admit human BI coverage")
    try { classifications.push(ok(await deadline.phase(`coverage.${index}`, () => business.withCase(human, initialRef, {}, () => business.baselineCoverage.register(coverage, human))), "Register human BI coverage")) }
    finally { authority.human.finish(human) }
  }
  const mutationHttp = portfolio.http({ origin: "https://example.test", mount: "/product" })
  const promote = async (index: number, caseRef: typeof initialRef) => {
    const payload = { caseRef, title: index ? "BI candidate" : "BI baseline", scenario: { baseRef: sources[index]!.refId, operations: [], assumptions: [] }, coverageRef: classifications[index]!.coverageRef }
    const response = await deadline.phase(`promotion.${index}`, () => mutationHttp(new Request("https://example.test/product/planner?sf=decision-promote", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": `bi-promote-${index}` }, body: JSON.stringify(payload) }), "planner"))
    expect(response?.status).toBe(200)
    const receipt = ok(await response!.json() as PortResult<{ caseRef: typeof initialRef; resultRef?: string }>, "Promote real BI scenario")
    if (!receipt.resultRef) throw new Error("Actual promotion did not persist its scenario")
    return { caseRef: receipt.caseRef, resultRef: receipt.resultRef }
  }
  const baseline = await promote(0, initialRef)
  const candidate = await promote(1, baseline.caseRef)
  const snapshot = await authority.state.read(fixture.request(), "cases", (state) => state.cases[initialRef.id])
  if (snapshot.status !== "ok" || !snapshot.value) throw new Error("Promoted BI case unavailable")
  expect(snapshot.value.alternatives).toHaveLength(2)
  expect(snapshot.value.choices).toHaveLength(0)
  for (const alternative of snapshot.value.alternatives) {
    expect(alternative.result).toMatchObject({ comparisonStatus: "conditioned", total: null, costCoverage: { coverageState: "pending" } })
    expect(alternative.result.horizon).toEqual(period)
    expect(alternative.result.costCoverage.entries.find((entry) => entry.categoryId === "service")?.status).toBe("included")
    expect(alternative.result.knownSubtotal).toBeGreaterThan(0)
  }
  const persisted = ok(await business.withCase(call, candidate.caseRef, {}, async () => {
    const selected = await deadline.phase("comparison.produce", () => portfolio.compare({ caseRef: candidate.caseRef,
      baselineAlternativeId: snapshot.value!.alternatives[0]!.id, alternativeId: snapshot.value!.alternatives[1]!.id, criteria: [] }, call))
    if (selected.status !== "ok") return selected
    expect(selected.value.comparison.comparisonStatus).toBe("conditioned")
    expect(selected.value.comparison.completeDifference).toBeNull()
    return deadline.phase("comparison.persist", () => business.calculations.persist({ kind: "comparison", request: selected.value.request,
      result: selected.value.comparison }, "bi-comparison", call))
  }), "Persist real BI comparison")
  const selectionRef = sfDecisionBiSelection({ scenarioResultRef: candidate.resultRef, comparisonRef: persisted.resultRef })
  const selection = { selectionRef, scenarioResultRef: candidate.resultRef, comparisonRef: persisted.resultRef }
  const counts = { produced: 0 }
  const admit = async (signal: AbortSignal = deadline.signal) => {
    const request: BiViewRequest = { viewId: "BI09", selectionRef, period: { ...period } }
    const call = ok(await authority.ui.admit(new Request(fixture.request(), { signal }), "sf_bi_view", digestSfValue(request)), "Admit actual BI call")
    deadline.own(() => authority.ui.finish(call))
    return { request, call }
  }
  const consume = async (request: BiViewRequest, call: TrustedUiContext) => {
    expect(authority.host.requestFor(call)).toBeUndefined()
    expect(await authority.ui.validate(call, "sf_bi_view", digestSfValue(request))).toBe(true)
  }
  const produce = (request: BiViewRequest, call: TrustedUiContext): Promise<PortResult<DomainProjection>> => {
    counts.produced++
    // Holder counterproofs use one real stored-scenario projection. The separate
    // BI/browser test exercises the entire canonical persisted projection,
    // descriptor, dispatcher and presenter, including all three resolutions.
    return business.withCase(call, candidate.caseRef, {}, async () => {
      const scenarios = business.plannerProduct.scenarios
      if (!scenarios) return { status: "unavailable", reason: "actual-stored-scenarios-unavailable" }
      const result = await scenarios.resolve(candidate.resultRef, call)
      if (result.status !== "ok") return result
      expect(result.value.projection.context.period).toEqual(request.period)
      return { status: "ok", value: result.value.projection }
    })
  }
  const scope = (observed = authority) => createSfBiCallScope({ authority: observed, sources: business.plannerSources, lockedSourceFences: business.lockedSourceFences })
  return { ...fixture, selection, counts, admit, consume, produce, scope, caseRef: candidate.caseRef }
}

test("BI proof starts only after real UI consumption, clones within one invocation and cannot cross a new call or UTC day", async () => {
  const deadline = compositionTestDeadline("bi-call-scope-identity")
  try {
    const fixture = await prepare(deadline), scope = fixture.scope()
    const unconsumed = await fixture.admit()
    expect(await scope.run(unconsumed.request, unconsumed.call, () => scope.read(fixture.selection, unconsumed.call,
      () => fixture.produce(unconsumed.request, unconsumed.call)))).toEqual({ status: "denied", reason: "bi-call-authority-changed" })
    expect(fixture.counts.produced).toBe(0)
    for (const iteration of [1, 2]) {
      const { request, call } = await fixture.admit()
      const value = await deadline.phase(`same-day.${iteration}`, () => scope.run(request, call, async () => {
        await fixture.consume(request, call)
        const first = ok(await scope.read(fixture.selection, call, () => fixture.produce(request, call)), "Actual stored Planner projection")
        fixture.clock.at = "2026-11-14T23:59:59Z"
        const again = ok(await scope.read(fixture.selection, call, () => fixture.produce(request, call)), "Same-dispatch BI proof")
        expect(again).toEqual(first)
        expect(again).not.toBe(first)
        expect(again.engineVersion).toBe("planner-runtime-v1")
        expect(fixture.counts.produced).toBe(iteration)
        return { status: "ok", value: true }
      }))
      expect(value).toEqual({ status: "ok", value: true })
    }
    const { request, call } = await fixture.admit()
    const midnight = await deadline.phase("midnight", () => scope.run(request, call, async () => {
      await fixture.consume(request, call)
      expect((await scope.read(fixture.selection, call, () => fixture.produce(request, call))).status).toBe("ok")
      fixture.clock.at = "2026-11-15T00:00:00Z"
      const changed = await scope.read(fixture.selection, call, () => fixture.produce(request, call))
      expect(changed).toEqual({ status: "stale", reason: "bi-call-proof-changed" })
      expect(changed).not.toHaveProperty("value")
      expect(fixture.counts.produced).toBe(3)
      return changed
    }))
    expect(midnight.status).toBe("stale")
  } finally { await deadline.close() }
}, 120_000)

test("BI proof refuses overlapping and reentrant callers without lending or invalidating the owning invocation", async () => {
  const deadline = compositionTestDeadline("bi-call-scope-lexical")
  try {
    const fixture = await prepare(deadline), scope = fixture.scope()
    const { request, call } = await fixture.admit()
    const ready = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const pending = deadline.phase("lexical.owner", () => scope.run(request, call, async () => {
      await fixture.consume(request, call)
      const first = ok(await scope.read(fixture.selection, call, () => fixture.produce(request, call)), "Owning BI projection")
      expect(await scope.run(request, call, async () => { throw new Error("Reentrant BI work must not execute") }))
        .toEqual({ status: "denied", reason: "bi-call-already-active" })
      ready.resolve()
      await release.promise
      const again = ok(await scope.read(fixture.selection, call, () => fixture.produce(request, call)), "Owner retains its proof after overlap")
      expect(again).toEqual(first)
      expect(again).not.toBe(first)
      expect(fixture.counts.produced).toBe(1)
      return { status: "ok", value: true }
    }))
    try {
      await Promise.race([ready.promise, pending.then(() => { throw new Error("BI owner did not reach its completed proof") })])
      // These continuations began outside run(), although they share its real
      // consumed context, Request, actor, source versions and case membership.
      const reads = await Promise.all([0, 1].map(() => scope.read(fixture.selection, call, () => fixture.produce(request, call))))
      for (const value of reads) {
        expect(value).toEqual({ status: "denied", reason: "bi-call-authority-changed" })
        expect(value).not.toHaveProperty("value")
      }
      expect(await scope.run(request, call, async () => { throw new Error("Overlapping BI work must not execute") }))
        .toEqual({ status: "denied", reason: "bi-call-already-active" })
      expect(fixture.counts.produced).toBe(1)
      release.resolve()
      expect(await pending).toEqual({ status: "ok", value: true })
    } finally { release.resolve(); await pending }
  } finally { await deadline.close() }
}, 120_000)

test("BI proof rejects current case revocation, unversioned C08 result corruption and changed input without repeating a producer", async () => {
  const deadline = compositionTestDeadline("bi-call-scope-state")
  try {
    const fixture = await prepare(deadline), scope = fixture.scope()
    const stateBefore = await fixture.authority.state.read(fixture.request(), "cases", (state) => structuredClone(state))
    if (stateBefore.status !== "ok") throw new Error("Actual C08 snapshot unavailable")
    for (const mutation of ["case", "result", "input"] as const) {
      const { request, call } = await fixture.admit(), before = fixture.counts.produced
      const result = await deadline.phase(`reject.${mutation}`, () => scope.run(request, call, async () => {
        await fixture.consume(request, call)
        expect((await scope.read(fixture.selection, call, () => fixture.produce(request, call))).status).toBe("ok")
        if (mutation === "input") request.period.end = "2026-02-28"
        if (mutation !== "input") await fixture.store.transaction("dashboard", async (snapshot) => {
          const state = snapshot.data.__sfProductV1 as SfProductState
          if (mutation === "case") state.cases[fixture.caseRef.id]!.participants = []
          if (mutation === "result") state.decisionResults![fixture.selection.comparisonRef]!.resultDigest = "0".repeat(64)
          expect(state.revision).toBe(stateBefore.value.revision)
          expect(state.versions.cases).toBe(stateBefore.value.versions.cases)
          return { commit: true, value: undefined }
        })
        expect(await fixture.authority.host.revalidate(call)).toBe(true)
        const changed = await scope.read(fixture.selection, call, () => fixture.produce(request, call))
        expect(changed).toEqual(mutation === "result" ? { status: "stale", reason: "bi-call-proof-changed" }
          : { status: "denied", reason: "bi-call-authority-changed" })
        expect(changed).not.toHaveProperty("value")
        expect(fixture.counts.produced).toBe(before + 1)
        return changed
      }))
      expect(result.status).toBe(mutation === "result" ? "stale" : "denied")
      // Restore only this test's deliberate corruption to the actual persisted
      // producer output; no synthetic result or authority response is introduced.
      await fixture.store.transaction("dashboard", async (snapshot) => {
        snapshot.data.__sfProductV1 = structuredClone(stateBefore.value)
        return { commit: true, value: undefined }
      })
    }
  } finally { await deadline.close() }
}, 120_000)

test("BI proof fences all three actual domain snapshots even when the C08 revision and Planner reference stay unchanged", async () => {
  const deadline = compositionTestDeadline("bi-call-scope-sources")
  try {
    const fixture = await prepare(deadline), scope = fixture.scope()
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      const { request, call } = await fixture.admit(), before = fixture.counts.produced
      const result = await deadline.phase(`fence.${surface}`, () => scope.run(request, call, async () => {
        await fixture.consume(request, call)
        expect((await scope.read(fixture.selection, call, () => fixture.produce(request, call))).status).toBe("ok")
        const original = await fixture.authority.state.read(fixture.request(), "cases", (state) => digestSfValue(state))
        await fixture.store.transaction(surface, async (snapshot) => {
          snapshot.data.__biCounterproof = surface
          return { commit: true, value: undefined }
        })
        expect(await fixture.authority.host.revalidate(call)).toBe(true)
        expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => digestSfValue(state))).toEqual(original)
        const changed = await scope.read(fixture.selection, call, () => fixture.produce(request, call))
        expect(changed).toEqual({ status: "stale", reason: "bi-call-proof-changed" })
        expect(changed).not.toHaveProperty("value")
        expect(fixture.counts.produced).toBe(before + 1)
        return changed
      }))
      expect(result.status).toBe("stale")
      await fixture.store.transaction(surface, async (snapshot) => { delete snapshot.data.__biCounterproof; return { commit: true, value: undefined } })
    }
    const { request, call } = await fixture.admit(), before = fixture.counts.produced
    const materialized = await deadline.phase("source-metadata-change", () => scope.run(request, call, async () => {
      await fixture.consume(request, call)
      expect((await scope.read(fixture.selection, call, () => fixture.produce(request, call))).status).toBe("ok")
      await fixture.store.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
        versions[1]!.lines[0]!.f[0] = versions[1]!.lines[0]!.f[0]! + 1
        return { commit: true, value: undefined }
      })
      // The actual scoped reader may now materialize a changed source identity.
      // It must deny the old proof without attempting a nested C08/domain write.
      const changed = await scope.read(fixture.selection, call, () => fixture.produce(request, call))
      expect(changed).toEqual({ status: "stale", reason: "bi-call-proof-changed" })
      expect(changed).not.toHaveProperty("value")
      expect(fixture.counts.produced).toBe(before + 1)
      expect(await fixture.business.readSourceFences(call)).toBeDefined()
      expect(await fixture.authority.host.revalidate(call)).toBe(true)
      return changed
    }))
    expect(materialized.status).toBe("stale")
  } finally { await deadline.close() }
}, 120_000)

test("BI egress returns denied after actor revocation, Request abort or lease removal at its final asynchronous boundaries", async () => {
  const deadline = compositionTestDeadline("bi-call-scope-egress")
  try {
    const fixture = await prepare(deadline)
    for (const boundary of ["actor", "lease", "state", "abort"] as const) {
      const cancellation = new AbortController()
      const { request, call } = await fixture.admit(AbortSignal.any([deadline.signal, cancellation.signal])), before = fixture.counts.produced
      const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      const marker = { armed: false, environments: 0, authorizations: 0, states: 0 }
      const readState: typeof fixture.authority.state.read = async (source, namespace, read) => {
        const value = await fixture.authority.state.read(source, namespace, read)
        if (marker.armed && ++marker.states === 2 && boundary === "state") { reached.resolve(); await release.promise }
        return value
      }
      const observed = { ...fixture.authority, state: { ...fixture.authority.state, read: readState }, host: { ...fixture.authority.host,
        environment: async (source: Request) => {
          const value = await fixture.authority.host.environment(source)
          if (marker.armed && ++marker.environments === 4 && (boundary === "actor" || boundary === "abort")) { reached.resolve(); await release.promise }
          return value
        },
        revalidate: async (context: Parameters<typeof fixture.authority.host.revalidate>[0]) => {
          const value = await fixture.authority.host.revalidate(context)
          if (marker.armed && ++marker.authorizations === 6 && boundary === "lease") { reached.resolve(); await release.promise }
          return value
        },
      } }
      const scope = fixture.scope(observed)
      const pending = deadline.phase(`last-await.${boundary}`, () => scope.run(request, call, async () => {
        await fixture.consume(request, call)
        expect((await scope.read(fixture.selection, call, () => fixture.produce(request, call))).status).toBe("ok")
        marker.armed = true
        return { status: "ok", value: true }
      }))
      try {
        await Promise.race([reached.promise, pending.then(() => { throw new Error(`Real BI egress did not reach ${boundary} boundary`) })])
        if (boundary === "actor") fixture.active.value = false
        if (boundary === "lease" || boundary === "state") fixture.authority.ui.finish(call)
        if (boundary === "abort") cancellation.abort(new Error("BI Request revoked during its final clock await"))
        release.resolve()
        const changed = await pending
        expect(changed).toEqual({ status: "denied", reason: "bi-call-authority-changed" })
        expect(changed).not.toHaveProperty("value")
        expect(fixture.counts.produced).toBe(before + 1)
        expect(await fixture.authority.host.revalidate(call)).toBe(false)
      } finally { release.resolve(); fixture.active.value = true }
    }
  } finally { await deadline.close() }
}, 120_000)

