import { expect, test } from "bun:test"
import type { SfOperationOutputMap } from "../../../product/contracts/outputs.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createDecisionScenarioLookup } from "../../../product/decisions/scenario-lookup.ts"
import { selectSfScenarioCandidates } from "../../../product/host-binding/state-provider.ts"
import { createStateIsolationFixture } from "../finance-state-read-performance/fixture.ts"
import { createWp13PortfolioFixture } from "../wp13/sensitivity-fixture.ts"

/** C08 ownership only: empty, conditioned results do not certify a financial calculation. */
async function candidateFixture() {
  const f = await createStateIsolationFixture()
  try {
    let identity = 0
    const results = createSfDecisionResultStore({
      state: f.state,
      host: { requestFor: (context) => context.kind === "ui" ? f.ui.requestFor(context) : undefined,
        revalidate: async (context) => context.kind === "ui" && f.ui.revalidate(context) },
      authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef),
      verifySources: async (_value, refs) => refs.length === 0,
      createId: () => "candidate-result-" + ++identity, now: () => "2026-11-14T00:00:00Z",
    })
    const caseRef = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    const scenario: SfOperationOutputMap["sf_scenario_simulate"] = {
      id: "candidate-scenario", version: 1, components: [], currency: "USD", horizon: f.decision.horizon,
      sourceRefs: [], unresolvedConditions: ["missing"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
      costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD",
        horizon: f.decision.horizon, issues: ["inventory-unavailable"], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: [] },
    }
    const first = await results.write({ kind: "scenario", result: scenario, caseRef, requestDigest: "a".repeat(64), sourceRefs: [], idempotencyKey: "first" }, f.context)
    const second = await results.write({ kind: "scenario", result: { ...scenario, id: "other-scenario" }, caseRef, requestDigest: "b".repeat(64), sourceRefs: [], idempotencyKey: "second" }, f.context)
    if (first.status !== "ok" || second.status !== "ok") throw new Error("Real C08 result writes failed")
    f.controls.checks.length = 0
    const query = { caseRef: { ...caseRef } }
    const selector = (context: TrustedDomainContext = f.context) => selectSfScenarioCandidates(query, first.value.requestDigest, first.value.resultDigest, context)
    return { ...f, query, first: first.value, second: second.value, selector }
  } catch (error) { await f.close(); throw error }
}

test("scenario candidates retain one whole result graph, all envelope getters, order and C08 metadata", async () => {
  const f = await candidateFixture()
  try {
    const counts = { unrelated: 0, cases: 0, results: 0 }
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState
      const preference = state.preferences.private, objective = state.cases.case!.objective
      Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { counts.unrelated++; return preference } })
      Object.defineProperty(state.cases.case!, "objective", { enumerable: true, configurable: true, get: () => { counts.cases++; return objective } })
      for (const result of Object.values(state.decisionResults!)) {
        const createdAt = result.createdAt
        Object.defineProperty(result, "createdAt", { enumerable: true, configurable: true, get: () => { counts.results++; return createdAt } })
      }
      state.decisionResults!.alias = state.decisionResults![f.first.resultRef]!
    }
    const observations = []
    for (const opaque of [true, false]) {
      Object.assign(counts, { unrelated: 0, cases: 0, results: 0 })
      f.controls.checks.length = 0
      const selector = f.selector()
      const value = await f.state.read(f.request, "cases", opaque ? (state, authority) => selector(state, authority) : selector)
      expect(value.status).toBe("ok")
      if (value.status !== "ok" || !value.value) throw new Error("Candidates unavailable")
      expect(value.value).toEqual([f.first, f.first])
      expect(value.value[0]).toBe(value.value[1])
      observations.push({ ...counts, checks: f.controls.checks.length, value })
    }
    expect(observations[0]).toMatchObject({ unrelated: 1, cases: 1, results: 2, checks: 2 })
    expect(observations[1]).toMatchObject({ unrelated: 0, cases: 0, results: 2, checks: 2 })
    expect(observations[1]!.value).toEqual(observations[0]!.value)
    expect(observations[1]!.value.value).not.toBe(observations[0]!.value.value)
  } finally { await f.close() }
})

test("scenario candidates detach before final authority and never lend a result to a later invocation", async () => {
  const f = await candidateFixture()
  try {
    const retained: { state?: SfProductState } = {}
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 2) return
      retained.state = snapshot.data.__sfProductV1 as SfProductState
      retained.state.decisionResults![f.first.resultRef]!.resultDigest = "changed-after-projection"
    }
    const first = await f.state.read(f.request, "cases", f.selector())
    expect(first).toMatchObject({ status: "ok", value: [f.first] })
    if (first.status !== "ok" || !first.value || !retained.state) throw new Error("Detached candidates missing")
    first.value[0]!.resultDigest = "recipient-mutation"
    retained.state.decisionResults![f.first.resultRef]!.requestDigest = "retained-snapshot-mutation"
    f.controls.observe = undefined
    const next = await f.admit()
    const second = await f.state.read(next.request, "cases", f.selector(next.context))
    expect(second).toMatchObject({ status: "ok", value: [f.first] })
    if (second.status !== "ok") throw new Error("Fresh candidates missing")
    expect(second.value).not.toBe(first.value)
    expect(f.controls.checks.map((entry) => entry.request)).toEqual([f.request, f.request, next.request, next.request])
  } finally { await f.close() }
})

test("scenario candidate wrappers and other namespaces keep the full private callback clone", async () => {
  const f = await candidateFixture()
  try {
    const selector = f.selector()
    const observed: { state?: Readonly<SfProductState> } = {}
    const wrapped = Object.assign((state: Readonly<SfProductState>, authority: Parameters<typeof selector>[1]) => {
      observed.state = state
      state.preferences.private = "callback-private"
      state.cases.case!.objective = "callback-private"
      return selector(state, authority)
    }, selector)
    expect(await f.state.read(f.request, "cases", wrapped)).toMatchObject({ status: "ok", value: [f.first] })
    expect(observed.state?.preferences.private).toBe("callback-private")
    const counts = { unrelated: 0 }
    f.controls.checks.length = 0
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState, original = state.preferences.private
      Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { counts.unrelated++; return original } })
    }
    expect(await f.state.read(f.request, "preferences", selector)).toMatchObject({ status: "ok", value: [f.first] })
    expect(counts.unrelated).toBe(1)
    f.controls.observe = undefined
    expect(await f.state.read(f.request, "preferences", (state) => state.preferences.private)).toMatchObject({ status: "ok", value: { marker: "not part of a case projection", nested: { count: 1 } } })
  } finally { await f.close() }
})

for (const fault of ["missing-map", "inherited-map", "accessor-map", "nonplain-map", "proxy-map", "proxy-state", "proxy-context", "proxy-binding"] as const) {
  test("scenario candidate unsafe " + fault + " keeps the opaque fallback and its failures", async () => {
    const f = await candidateFixture()
    try {
      const samples = []
      for (const opaque of [true, false]) {
        const counts = { unrelated: 0, traps: 0 }
        const handler = { getOwnPropertyDescriptor(target: object, key: PropertyKey) {
          counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key)
        }, getPrototypeOf(target: object) { counts.traps++; return Reflect.getPrototypeOf(target) } }
        const context = fault === "proxy-context" ? new Proxy(f.context, handler)
          : fault === "proxy-binding" ? Object.freeze({ ...f.context, binding: new Proxy(f.context.binding, handler) }) : f.context
        const selector = f.selector(context)
        // Registering a proxy must not trigger introspection before the read.
        if (fault === "proxy-context" || fault === "proxy-binding") expect(counts.traps).toBe(0)
        f.controls.checks.length = 0
        f.controls.observe = (snapshot, _request, mode, index) => {
          if (mode !== "read" || index !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState
          const original = state.preferences.private, map = state.decisionResults!
          Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { counts.unrelated++; return original } })
          if (fault === "missing-map") delete state.decisionResults
          if (fault === "inherited-map") { delete state.decisionResults; Object.setPrototypeOf(state, { decisionResults: map }) }
          if (fault === "accessor-map") Object.defineProperty(state, "decisionResults", { enumerable: true, configurable: true, get: () => map })
          if (fault === "nonplain-map") Object.setPrototypeOf(map, { marker: "inherited" })
          if (fault === "proxy-map") state.decisionResults = new Proxy(map, handler)
          if (fault === "proxy-state") snapshot.data.__sfProductV1 = new Proxy(state, handler)
        }
        const outcome = await f.state.read(f.request, "cases", opaque ? (state, authority) => selector(state, authority) : selector)
          .then((value) => ({ value }), (error: unknown) => ({ error: error instanceof Error ? error.name : String(error) }))
        samples.push({ outcome, ...counts, checks: f.controls.checks.length })
      }
      expect(samples[1]).toEqual(samples[0])
      if (fault === "proxy-map" || fault === "proxy-state") expect(samples[1]!.outcome).toHaveProperty("error")
      else expect(samples[1]).toMatchObject({ unrelated: 1, checks: 2, outcome: { value: { status: "ok" } } })
    } finally { await f.close() }
  })
}

test("scenario candidate predicates observe mutable requests and context bindings after C08 admission", async () => {
  const f = await candidateFixture()
  try {
    for (const change of ["id", "incarnation", "version", "replace"] as const) {
      f.query.caseRef = { ...f.first.caseRef }
      f.controls.checks.length = 0
      const selector = f.selector()
      f.controls.observe = (_snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        if (change === "replace") { f.query.caseRef = { ...f.query.caseRef, id: "changed" }; return }
        if (change === "version") { f.query.caseRef.version = 0; return }
        f.query.caseRef[change] = "changed"
      }
      expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: [] })
      expect(f.controls.checks).toHaveLength(2)
    }
    f.query.caseRef = { ...f.first.caseRef }
    for (const change of ["mutation", "replacement", "accessor"] as const) {
      const binding = { current: Object.freeze({ ...f.context.binding }) }
      const mutable = { ...f.context, binding: { ...f.context.binding } }
      const context = change === "accessor" ? Object.freeze({ ...f.context, get binding() { return binding.current } }) : mutable
      const selector = f.selector(context)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        if (change === "accessor") { binding.current = Object.freeze({ ...binding.current, principalRef: "outsider" }); return }
        if (change === "replacement") { mutable.binding = { ...mutable.binding, accessRevision: "changed" }; return }
        mutable.binding.principalRef = "outsider"
      }
      expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
      expect(f.controls.checks).toHaveLength(2)
    }
  } finally { await f.close() }
})

test("scenario candidate maps preserve failures inside an unmatched result envelope", async () => {
  const f = await candidateFixture()
  try {
    for (const opaque of [true, false]) {
      f.controls.checks.length = 0
      f.controls.observe = (snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        Object.defineProperty(state.decisionResults![f.second.resultRef]!, "createdAt", {
          enumerable: true, configurable: true, get: () => { throw new Error("unmatched envelope getter") },
        })
      }
      const selector = f.selector()
      await expect(f.state.read(f.request, "cases", opaque ? (state, authority) => selector(state, authority) : selector))
        .rejects.toThrow("unmatched envelope getter")
      expect(f.controls.checks).toHaveLength(1)
    }
  } finally { await f.close() }
})

test("scenario candidates cannot reuse another principal or a copied Request", async () => {
  const f = await candidateFixture()
  try {
    const selector = f.selector()
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: [f.first] })
    const outsider = await f.admit("outsider")
    expect(await f.state.read(outsider.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
    expect(await f.state.read(new Request(f.request), "cases", selector)).toEqual({ status: "denied", reason: "product-access-unavailable" })
  } finally { await f.close() }
})

for (const fault of ["headers", "revocation", "abort"] as const) {
  test("scenario candidates retain the final authority and cancellation boundary for " + fault, async () => {
    const f = await candidateFixture()
    try {
      const controller = new AbortController()
      const admitted = await f.admit("principal", controller.signal)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, request, mode, index) => {
        if (mode !== "read" || index !== 2) return
        if (fault === "headers") request.headers.set("authorization", "changed")
        if (fault === "revocation") f.controls.enabled = false
        if (fault === "abort") controller.abort(new Error("candidate read cancelled"))
      }
      const pending = f.state.read(admitted.request, "cases", f.selector(admitted.context))
      if (fault === "abort") await expect(pending).rejects.toThrow("candidate read cancelled")
      else expect(await pending).toEqual({ status: "denied", reason: "product-authority-changed" })
      expect(f.controls.checks).toHaveLength(2)
      f.controls.observe = undefined
      if (fault === "revocation") expect(await f.state.read(admitted.request, "cases", f.selector(admitted.context))).toEqual({ status: "denied", reason: "product-access-unavailable" })
    } finally { await f.close() }
  })
}

test("real scenario lookup keeps scalar read order and ambiguity without borrowing a prior invocation", async () => {
  const f = await createWp13PortfolioFixture()
  try {
    // Freeze this unchanged fixture's original data context, without adding any grant.
    Object.freeze(f.context.binding); Object.freeze(f.context)
    const query = { caseRef: { ...f.caseRef }, alternativeId: "selected", alternativeVersion: 1 }
    const trace: string[] = []
    const read = f.state.read, readCase = f.cases.read, readResult = f.results.readHistoricalScenario
    const lookup = createDecisionScenarioLookup({ ...f })
    const traces = []
    for (const opaque of [true, false]) {
      trace.length = 0
      f.state.read = (request, namespace, callback) => {
        trace.push("state:" + namespace)
        return read(request, namespace, opaque ? (state, authority) => callback(state, authority) : callback)
      }
      f.cases.read = (...args) => { trace.push("case"); return readCase(...args) }
      f.results.readHistoricalScenario = (...args) => { trace.push("result"); return readResult(...args) }
      expect(await lookup(query, f.context)).toMatchObject({ status: "ok", value: { resultRef: f.selectedRef } })
      expect(trace.filter((entry) => entry === "case" || entry === "result")).toEqual(["case", "result", "case", "result"])
      traces.push([...trace])
    }
    expect(traces[1]).toEqual(traces[0])
    f.state.read = read; f.cases.read = readCase; f.results.readHistoricalScenario = readResult
    const current = await f.state.read(f.request, "cases", (state) => state.decisionResults![f.selectedRef])
    if (current.status !== "ok") throw new Error("Current stored result missing")
    const duplicated = await f.state.transaction(f.request, { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: f.caseRef.id, targetIncarnation: f.caseRef.incarnation, idempotencyKey: "ambiguous-producer", commandDigest: "c".repeat(64) }, async (state) => {
      state.decisionResults!.duplicate = { ...state.decisionResults![f.selectedRef]!, resultRef: "duplicate" }
      return { commit: true, value: true }
    })
    expect(duplicated.status).toBe("ok")
    expect(await lookup(query, f.context)).toEqual({ status: "conflict", reason: "scenario-result-ambiguous" })
    f.access.allowed = false
    expect(await lookup(query, f.context)).toMatchObject({ status: "denied" })
  } finally { await f.cleanup() }
}, 30000)

test("real scenario lookup still rechecks both scalar results after mid-read revocation", async () => {
  const f = await createWp13PortfolioFixture()
  try {
    Object.freeze(f.context.binding); Object.freeze(f.context)
    const lookup = createDecisionScenarioLookup({ ...f })
    const original = f.results.readHistoricalScenario
    let reads = 0
    f.results.readHistoricalScenario = async (...args) => {
      const result = await original(...args)
      if (++reads === 1) f.access.allowed = false
      return result
    }
    expect(await lookup({ caseRef: f.caseRef, alternativeId: "selected", alternativeVersion: 1 }, f.context))
      .toEqual({ status: "stale", reason: "scenario-result-changed" })
    expect(reads).toBe(2)
    f.access.allowed = true
    f.results.readHistoricalScenario = original
    expect(await lookup({ caseRef: f.caseRef, alternativeId: "selected", alternativeVersion: 1 }, f.context)).toMatchObject({ status: "ok", value: { resultRef: f.selectedRef } })
  } finally { await f.cleanup() }
}, 30000)
