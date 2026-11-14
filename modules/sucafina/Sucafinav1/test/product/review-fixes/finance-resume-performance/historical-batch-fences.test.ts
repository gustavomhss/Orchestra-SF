import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createDecisionCasePort } from "../../../../product/decisions/case-port.ts"
import { decisionCoverageRef } from "../../../../product/decisions/coverage-access.ts"
import { createSfDecisionResultStore } from "../../../../product/decisions/result-store.ts"
import { createPlannerOperationVerifier } from "../../../../product/planner/operation-verifier.ts"
import { createStoredPlannerScenarioHost } from "../../../../product/planner/stored-scenarios.ts"
import { rows } from "../../../../runtime/contract.ts"
import { createWp13AnalysisFixture } from "../../wp13/sensitivity-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp13AnalysisFixture>>
type Mutation = "none" | "planner-source" | "case-version" | "stored-result" | "request-headers" | "lease" | "scalar-facade" | "store-facade"

/** Use the persisted fixture and real Planner verifier; the fixture's default
 * case verifier only checks access and cannot establish a domain-source fence. */
async function fencedScenarios(fixture: Fixture, mutation: Mutation) {
  const baseline = await fixture.results.readHistoricalScenario({ resultRef: fixture.baselineRef }, fixture.context)
  if (baseline.status !== "ok") throw new Error("Real baseline unavailable")
  const counts = { authorizeCase: 0, verifySources: 0, revalidate: 0, baselineSources: 0, fullCaseReads: 0, casesNamespaceReads: 0, facadeCalls: 0 }
  const mutationState = { reached: false }
  const read = fixture.state.read
  fixture.state.read = async (request, namespace, project) => {
    if (namespace === "cases") counts.casesNamespaceReads++
    return read(request, namespace, project)
  }
  let input: Parameters<typeof createStoredPlannerScenarioHost>[0]
  const refuse = async () => { counts.facadeCalls++; return { status: "denied" as const, reason: "replacement-facade" } }
  const mutate = async () => {
    mutationState.reached = true
    if (mutation === "planner-source") {
      const changed = await fixture.store.transaction("planner", async (snapshot) => {
        snapshot.data.versions = rows(snapshot.data.versions).map((version) => version.id === "v0" ? { ...version, closed: 10 } : version)
        return { commit: true, value: true }
      })
      expect(changed).toBe(true)
      return
    }
    if (mutation === "case-version" || mutation === "stored-result") {
      const current = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
      if (current.status !== "ok") throw new Error("Real case unavailable for mutation")
      const changed = await fixture.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, idempotencyKey: `historical-batch-${mutation}`, commandDigest: digestSfValue({ mutation }), targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation }, async (state) => {
        if (mutation === "case-version") state.cases[fixture.caseRef.id] = { ...state.cases[fixture.caseRef.id], version: fixture.caseRef.version + 1 }
        else {
          const stored = state.decisionResults?.[fixture.selectedRef]
          if (!stored) throw new Error("Real selected result unavailable for mutation")
          state.decisionResults![fixture.selectedRef] = { ...stored, createdAt: "2026-11-14T00:00:00Z" }
        }
        return { commit: true, value: true }
      })
      expect(changed.status).toBe("ok")
      return
    }
    if (mutation === "request-headers") { fixture.request.headers.set("x-finance-resume-batch", "changed"); return }
    if (mutation === "lease") { Object.assign(fixture.context, { lease: {} }); return }
    if (mutation === "scalar-facade") { input.store.readHistoricalScenario = refuse; return }
    if (mutation === "store-facade") input.store = { ...input.store, readHistoricalScenario: refuse }
  }
  const results = createSfDecisionResultStore({
    state: fixture.state,
    host: { ...fixture.host, revalidate: async (context) => { counts.revalidate++; return fixture.host.revalidate(context) } },
    authorizeCase: async (decision, context) => { counts.authorizeCase++; return fixture.access.allowed && decision.participants.includes(context.binding.principalRef) },
    verifySources: async (value, references, context) => {
      counts.verifySources++
      if (!fixture.access.allowed) return false
      // Read the actual persisted Planner source. No derived result or authority
      // is replaced with a constant to make the interleave pass.
      for (const reference of references) {
        if (reference.kind !== "record" || reference.target.surface !== "planner" || !reference.target.period) return false
        const current = await fixture.planner.compareForecast({ baseRef: reference.refId, candidateRef: reference.refId, period: reference.target.period, currency: "USD" }, context)
        if (current.status !== "ok" || !current.value.sourceRefs.some((source) => source.refDigest === reference.refDigest)) return false
      }
      if (value.kind === "scenario" && digestSfValue(value.result) === baseline.value.resultDigest) {
        counts.baselineSources++
        // Each separate result observation has two source callbacks. Mutate
        // only after the later sibling's final source check in the second one.
        if (mutation !== "none" && counts.baselineSources === 4) await mutate()
      }
      return true
    },
    createId: () => `historical-batch-unused-${++fixture.ids.value}`,
    now: () => "2026-11-13T00:00:00Z",
  })
  const verify = createPlannerOperationVerifier({
    host: fixture.host,
    planner: fixture.planner,
    sources: fixture.sources,
    scenarioInputs: {
      resolveAmount: async () => { throw new Error("Explicit amount fixture unexpectedly requested an amount reference") },
      verifyAssumption: async () => { throw new Error("Empty assumption fixture unexpectedly requested a confirmation") },
    },
  })
  const cases = createDecisionCasePort({
    state: fixture.state,
    host: fixture.host,
    creationTarget: { ref: fixture.caseRef.id, incarnation: fixture.caseRef.incarnation },
    operationIdentity: () => "historical-batch-unused-case",
    authorizeCase: async () => fixture.access.allowed,
    verifyScenarioOperations: async (decision, context) => {
      for (const alternative of decision.alternatives) if (!await verify(alternative.scenario, context)) return false
      return true
    },
    evidence: fixture.evidenceService,
    createId: () => "historical-batch-unused-case",
    now: () => "2026-11-13T00:00:00Z",
  })
  input = {
    store: results,
    cases: { ...cases, read: async (request, context) => { counts.fullCaseReads++; return cases.read(request, context) } },
    planner: fixture.planner,
    coverageRefFor: (reference, alternative) => decisionCoverageRef(reference, alternative.id, alternative.version),
  }
  return { scenarios: createStoredPlannerScenarioHost(input), counts, mutationState, restore: () => { fixture.state.read = read } }
}

test("historical batch keeps each real callback and ordered failures across duplicate occurrences", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const observed = await fencedScenarios(fixture, "none")
    try {
      if (!observed.scenarios.resolveMany) throw new Error("Real scenario batch unavailable")
      const started = performance.now()
      const result = await observed.scenarios.resolveMany([fixture.selectedRef, "unknown-result", fixture.baselineRef, fixture.selectedRef], fixture.context)
      console.info(JSON.stringify({ phase: "historical-batch.callback-multiplicity", durationMs: performance.now() - started, counters: observed.counts, statuses: result.map((entry) => entry.status) }))
      expect(result.map((entry) => entry.status)).toEqual(["ok", "unavailable", "ok", "ok"])
      expect(result[0]).toEqual(result[3])
      expect(observed.counts).toEqual({ authorizeCase: 12, verifySources: 12, revalidate: 25, baselineSources: 4, fullCaseReads: 2, casesNamespaceReads: 10, facadeCalls: 0 })
    } finally { observed.restore() }
  } finally { await fixture.cleanup() }
}, 120000)

for (const mutation of ["planner-source", "case-version", "stored-result", "request-headers", "lease", "scalar-facade", "store-facade"] as const) {
  test(`historical batch refuses ${mutation} after the later sibling's final source callback`, async () => {
    const fixture = await createWp13AnalysisFixture()
    try {
      const observed = await fencedScenarios(fixture, mutation)
      try {
        if (!observed.scenarios.resolveMany) throw new Error("Real scenario batch unavailable")
        const started = performance.now()
        const result = await observed.scenarios.resolveMany([fixture.selectedRef, fixture.baselineRef], fixture.context)
        console.info(JSON.stringify({ phase: `historical-batch.final-source-${mutation}`, durationMs: performance.now() - started, counters: observed.counts, statuses: result.map((entry) => entry.status) }))
        expect(observed.mutationState.reached).toBe(true)
        expect(observed.counts.baselineSources).toBe(4)
        expect(result).toHaveLength(2)
        expect(result[0]!.status).not.toBe("ok")
        if (mutation === "planner-source") {
          // The final C08 snapshot alone cannot see Planner drift. Refusal must
          // follow from the unchanged complete-case domain operation verifier.
          expect(observed.counts.fullCaseReads).toBe(2)
          expect(result.map((entry) => entry.status)).toEqual(["unavailable", "unavailable"])
        }
        if (mutation === "scalar-facade" || mutation === "store-facade") {
          expect(result.map((entry) => entry.status)).toEqual(["denied", "denied"])
          expect(observed.counts.facadeCalls).toBe(0)
        }
      } finally { observed.restore() }
    } finally { await fixture.cleanup() }
  }, 120000)
}

