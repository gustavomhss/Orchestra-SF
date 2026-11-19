import { expect, test } from "bun:test"
import type { SfOperationOutputMap } from "../../../product/contracts/outputs.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { createSfDecisionResultStore, readHistoricalScenarios } from "../../../product/decisions/result-store.ts"
import { createStateIsolationFixture } from "./fixture.ts"

type Settings = Parameters<typeof createSfDecisionResultStore>[0]

/** This is a C08 ownership fixture, not evidence for a financial calculation. */
async function resultFixture() {
  const f = await createStateIsolationFixture()
  const calls = { authorizeCase: 0, verifySources: 0, revalidate: 0 }
  const hooks: { authorizeCase?: Settings["authorizeCase"]; verifySources?: Settings["verifySources"] } = {}
  let identity = 0
  const results = createSfDecisionResultStore({
    state: f.state,
    host: {
      requestFor: (context) => context.kind === "ui" ? f.ui.requestFor(context) : undefined,
      revalidate: async (context) => { calls.revalidate++; return context.kind === "ui" && f.ui.revalidate(context) },
    },
    authorizeCase: async (value, context) => {
      calls.authorizeCase++
      return value.participants.includes(context.binding.principalRef) && (!hooks.authorizeCase || await hooks.authorizeCase(value, context))
    },
    verifySources: async (value, refs, context) => {
      calls.verifySources++
      return refs.length === 0 && (!hooks.verifySources || await hooks.verifySources(value, refs, context))
    },
    createId: () => "isolation-result-" + ++identity, now: () => "2026-11-14T00:00:00Z",
  })
  const caseRef = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
  const comparison = await results.write({ kind: "comparison",
    result: { baselineResultRef: "baseline", alternativeResultRef: "alternative", costCoverageRefs: ["coverage"], criterionResults: [],
      unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null },
    caseRef, requestDigest: "b".repeat(64), sourceRefs: [], idempotencyKey: "comparison" }, f.context)
  const scenario: SfOperationOutputMap["sf_scenario_simulate"] = { id: "scenario", version: 1, components: [], currency: "USD", horizon: f.decision.horizon,
    sourceRefs: [], unresolvedConditions: ["missing"], restrictions: [], costCoverage: { basisId: "basis", basisVersion: 1,
      alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: f.decision.horizon, issues: ["inventory-unavailable"],
      evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: [] },
    comparisonStatus: "conditioned", knownSubtotal: null, total: null }
  const first = await results.write({ kind: "scenario", result: scenario, caseRef, requestDigest: "c".repeat(64), sourceRefs: [], idempotencyKey: "first" }, f.context)
  const second = await results.write({ kind: "scenario", result: { ...scenario, id: "second-scenario" }, caseRef, requestDigest: "d".repeat(64), sourceRefs: [], idempotencyKey: "second" }, f.context)
  if (comparison.status !== "ok" || first.status !== "ok" || second.status !== "ok") {
    await f.close()
    throw new Error("C08 result ownership seed unavailable")
  }
  const reset = () => { Object.assign(calls, { authorizeCase: 0, verifySources: 0, revalidate: 0 }); f.controls.checks.length = 0 }
  reset()
  return { ...f, results, calls, hooks, reset, comparison: comparison.value, first: first.value, second: second.value }
}

test("C08 result reads keep three snapshots and callback counts without cloning unrelated state", async () => {
  const f = await resultFixture()
  try {
    const metadata: { storageVersion: number; aggregateRevision: number; incarnation: string }[] = []
    const observation = { mode: "canonical" as "canonical" | "opaque", reads: 0, unrelated: 0, cases: 0, results: 0 }
    const read = f.state.read
    f.state.read = async (request, namespace, callback) => {
      if (namespace === "cases") observation.reads++
      const result = await read(request, namespace, observation.mode === "opaque" ? (state, authority) => callback(state, authority) : callback)
      if (namespace === "cases" && result.status === "ok") metadata.push({ storageVersion: result.storageVersion, aggregateRevision: result.aggregateRevision, incarnation: result.incarnation })
      return result
    }
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index % 2 !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState
      const unrelated = state.preferences.private, current = state.cases.case!, objective = current.objective
      Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { observation.unrelated++; return unrelated } })
      Object.defineProperty(current, "objective", { enumerable: true, configurable: true, get: () => { observation.cases++; return objective } })
      for (const stored of Object.values(state.decisionResults ?? {})) {
        const createdAt = stored.createdAt
        Object.defineProperty(stored, "createdAt", { enumerable: true, configurable: true, get: () => { observation.results++; return createdAt } })
      }
    }
    const samples: { mode: string; reads: number; unrelated: number; cases: number; results: number; checks: number; callbacks: typeof f.calls; metadata: typeof metadata }[] = []
    for (const mode of ["opaque", "canonical"] as const) {
      Object.assign(observation, { mode, reads: 0, unrelated: 0, cases: 0, results: 0 })
      metadata.length = 0
      f.reset()
      expect(await f.results.read({ resultRef: f.comparison.resultRef, kind: "comparison" }, f.context)).toEqual({ status: "ok", value: f.comparison })
      samples.push({ ...observation, checks: f.controls.checks.length, callbacks: { ...f.calls }, metadata: [...metadata] })
    }
    expect(samples[0]).toMatchObject({ reads: 3, unrelated: 3, cases: 3, results: 9, checks: 6 })
    expect(samples[1]).toMatchObject({ reads: 3, unrelated: 0, cases: 3, results: 3, checks: 6 })
    expect(samples[0]!.metadata).toEqual(Array.from({ length: 3 }, () => ({ storageVersion: 4, aggregateRevision: 4, incarnation: "state-incarnation" })))
    expect(samples[1]!.metadata).toEqual(samples[0]!.metadata)
    expect(samples[1]!.callbacks).toEqual(samples[0]!.callbacks)
    expect(samples[1]!.callbacks.authorizeCase).toBe(2)
    expect(samples[1]!.callbacks.verifySources).toBe(2)
    f.controls.observe = undefined
    expect(await f.results.read({ resultRef: "missing", kind: "comparison" }, f.context)).toMatchObject({ status: "unavailable" })
    expect(await f.results.read({ resultRef: f.first.resultRef, kind: "comparison" }, f.context)).toMatchObject({ status: "unavailable" })
    const retained: { prior?: Parameters<Settings["verifySources"]>[0] } = {}
    f.hooks.verifySources = async (value) => {
      if (retained.prior?.kind === "comparison") retained.prior.result.knownDifference = 888888
      retained.prior = value
      return true
    }
    expect(await f.results.read({ resultRef: f.comparison.resultRef, kind: "comparison" }, f.context)).toEqual({ status: "ok", value: f.comparison })
  } finally { await f.close() }
})

test("C08 selected result batches preserve duplicate order, private values and all callbacks", async () => {
  const f = await resultFixture()
  try {
    const observations: { reads: number; checks: number; callbacks: typeof f.calls }[] = []
    const read = f.state.read
    for (const opaque of [true, false]) {
      let reads = 0
      f.state.read = async (request, namespace, callback) => {
        if (namespace === "cases") reads++
        return read(request, namespace, opaque ? (state, authority) => callback(state, authority) : callback)
      }
      f.reset()
      const result = await readHistoricalScenarios(f.results, [f.first.resultRef, "missing", f.second.resultRef, f.first.resultRef], f.context)
      expect(result).toEqual([{ status: "ok", value: f.first }, { status: "unavailable", reason: "result-unavailable" },
        { status: "ok", value: f.second }, { status: "ok", value: f.first }])
      const first = result[0]!, duplicate = result[3]!
      if (first.status !== "ok" || duplicate.status !== "ok") throw new Error("C08 sibling result missing")
      expect(first.value).not.toBe(duplicate.value)
      first.value.createdAt = "mutated by recipient"
      expect(duplicate.value.createdAt).toBe(f.first.createdAt)
      observations.push({ reads, checks: f.controls.checks.length, callbacks: { ...f.calls } })
    }
    expect(observations[0]).toEqual({ reads: 3, checks: 6, callbacks: { authorizeCase: 6, verifySources: 6, revalidate: 13 } })
    expect(observations[1]).toEqual(observations[0])
    expect(await f.results.readHistoricalScenario({ resultRef: f.first.resultRef }, f.context)).toEqual({ status: "ok", value: f.first })
  } finally { await f.close() }
})

for (const fault of ["case-callback", "source-callback", "case-identity", "case-body", "result-metadata", "result-selection", "authority"] as const) {
  test("C08 selected result reads refuse " + fault + " changes at existing callback fences", async () => {
    const f = await resultFixture()
    try {
      let reached = false
      if (fault === "case-callback") f.hooks.authorizeCase = async (value) => { reached = true; value.objective = "mutated callback"; return true }
      else f.hooks.verifySources = async (value) => {
        if (fault === "source-callback") { reached = true; if (value.kind === "comparison") value.result.knownDifference = 999999; return true }
        if (f.calls.verifySources !== 2) return true
        reached = true
        if (fault === "authority") { f.controls.enabled = false; return true }
        await f.store.transaction("dashboard", async (snapshot) => {
          const state = snapshot.data.__sfProductV1 as SfProductState
          if (fault === "case-identity") state.cases.case!.incarnation = "replacement-incarnation"
          if (fault === "case-body") state.cases.case!.objective = "changed after source verification"
          if (fault === "result-metadata") state.decisionResults![f.comparison.resultRef]!.createdAt = "2026-11-15T00:00:00Z"
          if (fault === "result-selection") state.decisionResults![f.comparison.resultRef] = structuredClone(f.first)
          return { commit: true, value: true }
        })
        return true
      }
      const result = await f.results.read({ resultRef: f.comparison.resultRef, kind: "comparison" }, f.context)
      expect(reached).toBe(true)
      expect(result.status).not.toBe("ok")
      expect(result).not.toHaveProperty("value")
    } finally { await f.close() }
  })
}
