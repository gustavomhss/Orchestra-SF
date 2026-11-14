import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import { createPlannerSensitivityUnits } from "../../../../product/planner/sensitivity-units.ts"
import { rows } from "../../../../runtime/contract.ts"
import { createWp13AnalysisFixture } from "../../wp13/sensitivity-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp13AnalysisFixture>>

function observe(fixture: Fixture, afterRule?: () => Promise<void>) {
  const counts = { selectedReads: 0, baselineReads: 0, caseReads: 0, scenarioBatches: 0, rules: 0, evidenceResolves: 0 }
  const resolveMany = fixture.scenarios.resolveMany
  if (!resolveMany) throw new Error("Real scenario batch resolver unavailable")
  const issuer = createPlannerSensitivityUnits({
    host: fixture.host,
    cases: { ...fixture.cases, read: async (request, context) => { counts.caseReads++; return fixture.cases.read(request, context) } },
    scenarios: { ...fixture.scenarios, resolveMany: async (references, context) => { counts.scenarioBatches++; return resolveMany(references, context) } },
    store: { ...fixture.results, readHistoricalScenario: async (request, context) => {
      if (request.resultRef === fixture.selectedRef) counts.selectedReads++
      if (request.resultRef === fixture.baselineRef) counts.baselineReads++
      return fixture.results.readHistoricalScenario(request, context)
    } },
    evidence: { ...fixture.evidenceService, resolve: async (reference, context) => { counts.evidenceResolves++; return fixture.evidenceService.resolve(reference, context) } },
    rules: { resolve: async (request, context) => {
      counts.rules++
      const result = await fixture.rules.resolve(request, context)
      if (counts.rules === 1 && afterRule) {
        if (result.status !== "ok") throw new Error(`Initial real rule unavailable: ${result.reason}`)
        await afterRule()
      }
      return result
    } },
  })
  return { issuer, counts }
}

function selection(fixture: Fixture): SensitivityRequest {
  return { scenarioRef: fixture.selectedRef, parameterBounds: { parameterRef: "line:11", minimum: 100000, maximum: 120000, steps: 2 }, criterion: { id: "renewal-difference", operator: "gte", value: 0 } }
}

test("units resolution reuses only its first observation and rereads both sides in every operation", async () => {
  const started = performance.now()
  const fixture = await createWp13AnalysisFixture()
  const fixtureMs = performance.now() - started
  try {
    const measured = observe(fixture)
    const request = selection(fixture)
    const admittedAt = performance.now()
    const first = await measured.issuer.resolve(request, fixture.context)
    console.info(JSON.stringify({ phase: "units.resolve.first", fixtureMs, durationMs: performance.now() - admittedAt, counters: measured.counts, result: first.status }))
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error(`Real units unavailable: ${first.reason}`)
    expect(first.value.caseRef).toEqual(fixture.caseRef)
    expect(first.value.parameterUnit).toBe("EUR")
    expect(first.value.resultUnit).toBe("USD")
    expect(first.value.metadataDigest).toBe(fixture.issued.value.metadataDigest)
    // Counts concern direct calls by units.resolve; nested producers are neither
    // intercepted nor replaced. Every observed call forwards to the real port.
    expect(measured.counts).toEqual({ selectedReads: 2, baselineReads: 2, caseReads: 2, scenarioBatches: 2, rules: 2, evidenceResolves: 4 })
    const repeatedAt = performance.now()
    const second = await measured.issuer.resolve(request, fixture.context)
    console.info(JSON.stringify({ phase: "units.resolve.new-operation", durationMs: performance.now() - repeatedAt, counters: measured.counts, result: second.status }))
    expect(second).toEqual(first)
    expect(measured.counts).toEqual({ selectedReads: 4, baselineReads: 4, caseReads: 4, scenarioBatches: 4, rules: 4, evidenceResolves: 8 })
    fixture.access.allowed = false
    expect((await measured.issuer.resolve(request, fixture.context)).status).toBe("denied")
  } finally { await fixture.cleanup() }
}, 120000)

for (const mutation of ["case-version", "planner-source", "revocation", "request-headers", "lease", "incoming-request"] as const) {
  test(`units resolution rejects ${mutation} during the rule callback after its first observation`, async () => {
    const fixture = await createWp13AnalysisFixture()
    try {
      const request = selection(fixture)
      const mutationState = { reached: false }
      const measured = observe(fixture, async () => {
        mutationState.reached = true
        if (mutation === "case-version") {
          const current = await fixture.state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
          if (current.status !== "ok") throw new Error("Real case unavailable for version mutation")
          const changed = await fixture.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, idempotencyKey: "units-rule-case-change", commandDigest: digestSfValue({ mutation }), targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation }, async (value) => {
            value.cases[fixture.caseRef.id] = { ...value.cases[fixture.caseRef.id], version: fixture.caseRef.version + 1 }
            return { commit: true, value: true }
          })
          expect(changed.status).toBe("ok")
          return
        }
        if (mutation === "planner-source") {
          const changed = await fixture.store.transaction("planner", async (snapshot) => {
            snapshot.data.versions = rows(snapshot.data.versions).map((version) => version.id === "v0" ? { ...version, closed: 10 } : version)
            return { commit: true, value: true }
          })
          expect(changed).toBe(true)
          return
        }
        if (mutation === "revocation") { fixture.access.allowed = false; return }
        if (mutation === "request-headers") { fixture.request.headers.set("x-finance-resume-observation", "changed"); return }
        if (mutation === "lease") { Object.assign(fixture.context, { lease: {} }); return }
        request.parameterBounds.maximum += 1
      })
      const started = performance.now()
      const result = await measured.issuer.resolve(request, fixture.context)
      console.info(JSON.stringify({ phase: `units.resolve.rule-${mutation}`, durationMs: performance.now() - started, counters: measured.counts, result }))
      expect(mutationState.reached).toBe(true)
      expect(result.status).toBe(mutation === "case-version" || mutation === "planner-source" ? "stale" : "denied")
    } finally { await fixture.cleanup() }
  }, 120000)
}
