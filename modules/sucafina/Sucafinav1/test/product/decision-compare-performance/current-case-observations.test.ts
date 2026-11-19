import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { rows } from "../../../runtime/contract.ts"
import { createWp13PortfolioFixture } from "../wp13/sensitivity-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp13PortfolioFixture>>
type Fault = "none" | "case" | "source" | "revoke" | "method" | "port" | "read-return" | "read-return-getter" | "borrowed"

// Real SQLite/C08 writes and Planner results. Authentication and evidence
// admission retain the fixture's declared boundary; this is no installed UI
// or financial-approval proof.
async function history() {
  const f = await createWp13PortfolioFixture()
  try {
    const current = await f.state.read(f.request, "cases", (state) => state.cases[f.caseRef.id])
    if (current.status !== "ok") throw new Error("Current case unavailable")
    const nextCaseRef = { ...f.caseRef, version: f.caseRef.version + 1 }
    const revised = await f.state.transaction(f.request, {
      namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: f.caseRef.id, targetIncarnation: f.caseRef.incarnation,
      idempotencyKey: "case-observation-revision", commandDigest: digestSfValue(nextCaseRef),
    }, async (state) => {
      state.cases[f.caseRef.id] = { ...state.cases[f.caseRef.id]!, version: nextCaseRef.version }
      return { commit: true, value: true }
    })
    expect(revised.status).toBe("ok")
    const newer = await f.results.write({ kind: "scenario", result: f.selectedResult,
      caseRef: nextCaseRef, requestDigest: digestSfValue(f.scenario), sourceRefs: [f.evidence],
      idempotencyKey: "case-observation-newer-producer" }, f.context)
    if (newer.status !== "ok") throw new Error("New producer result was not persisted")
    const older = await f.results.readHistoricalScenario({ resultRef: f.baselineRef }, f.context)
    if (older.status !== "ok") throw new Error("Original producer result unavailable")
    expect(older.value.caseRef).toEqual(f.caseRef)
    expect(newer.value.caseRef).toEqual(nextCaseRef)
    expect(older.value.caseRef.version).not.toBe(newer.value.caseRef.version)
    return { ...f, nextCaseRef, newer: newer.value, older: older.value }
  } catch (error) { await f.cleanup(); throw error }
}

function observe(f: Awaited<ReturnType<typeof history>>, fault: Fault) {
  const counts = { caseReads: 0, forecasts: 0, replacementCalls: 0 }
  let changed = false
  const verify = createPlannerOperationVerifier({ host: f.host, planner: f.planner, sources: f.sources,
    scenarioInputs: {
      resolveAmount: async () => { throw new Error("Explicit amounts must not resolve an invented amount") },
      verifyAssumption: async () => { throw new Error("Empty assumptions must not acquire a confirmation") },
    } })
  const port = createDecisionCasePort({ state: f.state, host: f.host,
    creationTarget: { ref: f.caseRef.id, incarnation: f.caseRef.incarnation },
    operationIdentity: () => "case-observation-unused", authorizeCase: async () => f.access.allowed,
    verifyScenarioOperations: async (decision, context) => {
      for (const alternative of decision.alternatives) if (!await verify(alternative.scenario, context)) return false
      return true
    },
    evidence: f.evidenceService, createId: () => "case-observation-unused", now: () => "2026-11-19T00:00:00Z",
  })
  type Observation = Awaited<ReturnType<typeof port.read>>
  const borrowed: Observation[] = []
  let input: Parameters<typeof createStoredPlannerScenarioHost>[0]
  const replacement: typeof port.read = async () => {
    counts.replacementCalls++
    return { status: "denied", reason: "replacement-case-reader" }
  }
  const cases = { ...port, read: async (...args: Parameters<typeof port.read>) => {
    counts.caseReads++
    const current = await port.read(...args)
    borrowed.push(current)
    if (fault === "read-return" && !changed) { changed = true; input.cases.read = replacement }
    if (fault === "read-return-getter" && counts.caseReads === 2 && current.status === "ok") {
      const value = current.value
      // The real read already finished. Substitute only its borrowed wrapper
      // so the swap happens during the consumer's structuredClone.
      return { status: "ok" as const, get value() {
        changed = true; input.cases.read = replacement
        return value
      } }
    }
    return current
  } }
  const change = async () => {
    changed = true
    if (fault === "method") { input.cases.read = replacement; return }
    if (fault === "port") { input.cases = { ...cases, read: replacement }; return }
    if (fault === "revoke") { f.access.allowed = false; return }
    if (fault === "borrowed") {
      const first = borrowed[0]
      if (!first || first.status !== "ok") throw new Error("No borrowed observation to corrupt")
      first.value.case.objective = "corrupted borrowed case"
      first.value.case.alternatives[0]!.title = "corrupted borrowed alternative"
      return
    }
    if (fault === "source") {
      const result = await f.store.transaction("planner", async (snapshot) => {
        snapshot.data.versions = rows(snapshot.data.versions).map((version) => version.id === "v0" ? { ...version, closed: 10 } : version)
        return { commit: true, value: true }
      })
      expect(result).toBe(true)
      return
    }
    const current = await f.state.read(f.request, "cases", (state) => state.cases[f.caseRef.id])
    if (current.status !== "ok") throw new Error("Case unavailable for independent change")
    const result = await f.state.transaction(f.request, {
      namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: f.caseRef.id, targetIncarnation: f.caseRef.incarnation,
      idempotencyKey: "case-observation-during-projection", commandDigest: digestSfValue({ fault }),
    }, async (state) => {
      state.cases[f.caseRef.id] = { ...state.cases[f.caseRef.id]!,
        version: f.nextCaseRef.version + 1, objective: "changed after the selected forecasts" }
      return { commit: true, value: true }
    })
    expect(result.status).toBe("ok")
  }
  input = {
    store: f.results, cases,
    planner: { compareForecast: async (...args: Parameters<typeof f.planner.compareForecast>) => {
      const result = await f.planner.compareForecast(...args)
      counts.forecasts++
      const at = fault === "method" || fault === "port" || fault === "borrowed" ? 1 : 2
      if (!changed && fault !== "none" && fault !== "read-return" && fault !== "read-return-getter" && counts.forecasts === at) await change()
      return result
    } },
    coverageRefFor: (reference, alternative) => decisionCoverageRef(reference, alternative.id, alternative.version),
  }
  const scenarios = createStoredPlannerScenarioHost(input)
  if (!scenarios.resolveMany) throw new Error("Scenario batch unavailable")
  return { read: scenarios.resolveMany, counts, changed: () => changed }
}

test("different historical producer versions share only their identical live-case read within each phase", async () => {
  const f = await history()
  try {
    const measured = observe(f, "none")
    const refs = [f.baselineRef, f.newer.resultRef, f.baselineRef]
    const result = await measured.read(refs, f.context)
    expect(result.map((entry) => entry.status)).toEqual(["ok", "ok", "ok"])
    expect(result.flatMap((entry) => entry.status === "ok" ? [entry.value.result] : []))
      .toEqual([f.baselineResult, f.selectedResult, f.baselineResult])
    expect(result.flatMap((entry) => entry.status === "ok" ? [entry.value.coverageRef] : []))
      .toEqual([decisionCoverageRef(f.nextCaseRef, "baseline", 1), decisionCoverageRef(f.nextCaseRef, "selected", 1), decisionCoverageRef(f.nextCaseRef, "baseline", 1)])
    expect(measured.counts).toEqual({ caseReads: 2, forecasts: 3, replacementCalls: 0 })
    expect(result[0]).toEqual(result[2])
    if (result[0]!.status !== "ok" || result[2]!.status !== "ok") throw new Error("Duplicate result unavailable")
    expect(result[0]!.value).not.toBe(result[2]!.value)
    expect(result[0]!.value.basis).not.toBe(result[2]!.value.basis)
    expect(result[0]!.value.projection).not.toBe(result[2]!.value.projection)
    const period = structuredClone(result[2]!.value.projection.context.period)
    Object.assign(result[0]!.value.projection.context.period, { start: "2099-01-01" })
    expect(result[2]!.value.projection.context.period).toEqual(period)
    Array.prototype.push.call(result[0]!.value.result.unresolvedConditions, "caller mutation")
    expect(result[2]!.value.result.unresolvedConditions).not.toContain("caller mutation")
    expect((await measured.read(refs, f.context)).map((entry) => entry.status)).toEqual(["ok", "ok", "ok"])
    expect(measured.counts.caseReads).toBe(4)
    expect(await f.results.readHistoricalScenario({ resultRef: f.baselineRef }, f.context)).toEqual({ status: "ok", value: f.older })
    expect(await f.results.readHistoricalScenario({ resultRef: f.newer.resultRef }, f.context)).toEqual({ status: "ok", value: f.newer })
  } finally { await f.cleanup() }
}, 30_000)

for (const fault of ["case", "source", "revoke", "method", "port", "read-return"] as const) {
  test("historical live-case grouping refuses " + fault + " without releasing a cached result", async () => {
    const f = await history()
    try {
      const measured = observe(f, fault)
      const result = await measured.read([f.baselineRef, f.newer.resultRef], f.context)
      expect(measured.changed()).toBe(true)
      expect(result).toHaveLength(2)
      expect(result.every((entry) => entry.status !== "ok" && !Object.hasOwn(entry, "value"))).toBe(true)
      if (fault === "case" || fault === "source") expect(measured.counts.caseReads).toBe(2)
      if (fault === "method" || fault === "port" || fault === "read-return") {
        expect(measured.counts.replacementCalls).toBe(0)
        expect(result.map((entry) => entry.status)).toEqual(["denied", "denied"])
      }
    } finally { await f.cleanup() }
  }, 30_000)
}

test("an earlier borrowed case cannot mutate the private per-phase observation", async () => {
  const f = await history()
  try {
    const measured = observe(f, "borrowed")
    const result = await measured.read([f.baselineRef, f.newer.resultRef], f.context)
    expect(measured.changed()).toBe(true)
    expect(result.map((entry) => entry.status)).toEqual(["ok", "ok"])
    expect(result.flatMap((entry) => entry.status === "ok" ? [entry.value.result] : []))
      .toEqual([f.baselineResult, f.selectedResult])
    expect(measured.counts.caseReads).toBe(2)
  } finally { await f.cleanup() }
}, 30_000)

for (const singleton of [false, true]) {
  test("the final borrowed getter cannot replace the case reader at egress" + (singleton ? " for one result" : " for siblings"), async () => {
    const f = await history()
    try {
      const measured = observe(f, "read-return-getter")
      const references = singleton ? [f.newer.resultRef] : [f.baselineRef, f.newer.resultRef]
      const result = await measured.read(references, f.context)
      expect(measured.changed()).toBe(true)
      expect(measured.counts.caseReads).toBe(2)
      expect(measured.counts.replacementCalls).toBe(0)
      expect(result.map((entry) => entry.status)).toEqual(references.map(() => "denied"))
      expect(result.every((entry) => !Object.hasOwn(entry, "value"))).toBe(true)
    } finally { await f.cleanup() }
  }, 30_000)
}
