import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { rows } from "../../../runtime/contract.ts"
import { createWp13AnalysisFixture } from "../wp13/sensitivity-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp13AnalysisFixture>>

function observe(fixture: Fixture, options: { scalar?: boolean; afterFirstEvidence?: () => Promise<void> } = {}) {
  const counts = { resultEnvelopes: 0, authorizeCase: 0, verifySources: 0, resultAuthority: 0, caseReads: 0, scenarioBatches: 0, rules: 0, evidence: 0, scalarHooks: 0 }
  const order: string[] = []
  const results = createSfDecisionResultStore({
    // The facade observes only this reader's C08 envelopes. Its admission
    // callbacks below continue through the fixture's real case/evidence ports.
    state: { ...fixture.state, read: async (request, namespace, project) => {
      if (namespace === "cases") counts.resultEnvelopes++
      return fixture.state.read(request, namespace, project)
    } },
    host: { ...fixture.host, revalidate: async (context) => {
      counts.resultAuthority++
      return fixture.host.revalidate(context)
    } },
    authorizeCase: async (value, context) => {
      counts.authorizeCase++
      const current = await fixture.cases.read({ caseRef: encodeCaseRef(value) }, context)
      return current.status === "ok" && digestSfValue(current.value.case) === digestSfValue(value)
    },
    verifySources: async (_value, refs, context) => {
      counts.verifySources++
      const observations = await fixture.evidenceService.context({ refs }, context)
      return observations.length === refs.length && observations.every((entry, index) => entry.state === "fresh" && entry.accessRevision === context.binding.accessRevision && digestSfValue(entry.ref) === digestSfValue(refs[index]))
    },
    createId: () => { throw new Error("Units reads must not write a result") },
    now: () => "2026-11-13T00:00:00Z",
  })
  const store = options.scalar ? { ...results, readHistoricalScenario: async (...args: Parameters<typeof results.readHistoricalScenario>) => {
    counts.scalarHooks++
    order.push(`${args[0].resultRef}:start`)
    const result = await results.readHistoricalScenario(...args)
    order.push(`${args[0].resultRef}:end`)
    return result
  } } : { ...results }
  const resolveMany = fixture.scenarios.resolveMany
  if (!resolveMany) throw new Error("Real scenario batch unavailable")
  const issuer = createPlannerSensitivityUnits({
    host: fixture.host,
    cases: { ...fixture.cases, read: async (request, context) => { counts.caseReads++; return fixture.cases.read(request, context) } },
    scenarios: { ...fixture.scenarios, resolveMany: async (references, context) => { counts.scenarioBatches++; return resolveMany(references, context) } },
    store,
    evidence: { ...fixture.evidenceService, resolve: async (reference, context) => {
      counts.evidence++
      const result = await fixture.evidenceService.resolve(reference, context)
      if (counts.evidence === 1) await options.afterFirstEvidence?.()
      return result
    } },
    rules: { resolve: async (request, context) => { counts.rules++; return fixture.rules.resolve(request, context) } },
  })
  return { issuer, counts, order }
}

function request(fixture: Fixture): SensitivityRequest {
  return { scenarioRef: fixture.selectedRef, parameterBounds: { parameterRef: "line:11", minimum: 100000, maximum: 120000, steps: 2 }, criterion: { id: "renewal-difference", operator: "gte", value: 0 } }
}

test("Finance units pairs keep every authority callback and use six fresh C08 envelopes", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const measured = observe(fixture)
    const selection = { scenarioRef: fixture.selectedRef, baselineRef: fixture.baselineRef, parameterRef: "line:11" }
    const started = performance.now()
    const first = await measured.issuer.issue(selection, fixture.context)
    console.info(JSON.stringify({ phase: "finance-units-pairs.issue", durationMs: performance.now() - started, result: first.status, counts: measured.counts }))
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error(`Real units unavailable: ${first.reason}`)
    expect(first.value).toEqual(fixture.issued.value)
    expect(first.value.caseRef).toEqual(fixture.caseRef)
    expect(first.value.units).toMatchObject({ parameterUnit: "EUR", resultUnit: "USD", baselineRef: fixture.baselineRef })
    expect(measured.counts).toMatchObject({ authorizeCase: 8, verifySources: 8, resultAuthority: 16, caseReads: 2, scenarioBatches: 2, rules: 0, evidence: 2, scalarHooks: 0 })
    // The old scalar pairs return the same values and callbacks but read twelve
    // C08 envelopes. The two new batches must each make three fresh observations.
    expect(measured.counts.resultEnvelopes).toBe(6)
    const second = await measured.issuer.issue(selection, fixture.context)
    expect(second).toEqual(first)
    expect(measured.counts).toMatchObject({ resultEnvelopes: 12, authorizeCase: 16, verifySources: 16, resultAuthority: 32, caseReads: 4, scenarioBatches: 4, evidence: 4 })
    fixture.access.allowed = false
    expect((await measured.issuer.issue(selection, fixture.context)).status).toBe("denied")
  } finally { await fixture.cleanup() }
}, 120000)

test("Finance units resolution preserves rule chronology and batches only its final pair", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const selection = request(fixture)
    const expected = await fixture.issuer.resolve(selection, fixture.context)
    if (expected.status !== "ok") throw new Error(`Canonical binding unavailable: ${expected.reason}`)
    const measured = observe(fixture)
    const started = performance.now()
    const result = await measured.issuer.resolve(selection, fixture.context)
    console.info(JSON.stringify({ phase: "finance-units-pairs.resolve", durationMs: performance.now() - started, result: result.status, counts: measured.counts }))
    expect(result).toEqual(expected)
    expect(measured.counts).toMatchObject({ authorizeCase: 8, verifySources: 8, resultAuthority: 16, caseReads: 2, scenarioBatches: 2, rules: 2, evidence: 4, scalarHooks: 0 })
    // Selected observation precedes rule resolution; the baseline observation
    // follows it. Only the later pair may share their three C08 envelopes.
    expect(measured.counts.resultEnvelopes).toBe(9)
  } finally { await fixture.cleanup() }
}, 120000)

test("Finance units pairs retain concurrent entry and every hook of a scalar facade", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const measured = observe(fixture, { scalar: true })
    const result = await measured.issuer.issue({ scenarioRef: fixture.selectedRef, baselineRef: fixture.baselineRef, parameterRef: "line:11" }, fixture.context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(`Facade units unavailable: ${result.reason}`)
    expect(result.value).toEqual(fixture.issued.value)
    expect(measured.counts).toMatchObject({ resultEnvelopes: 12, authorizeCase: 8, verifySources: 8, resultAuthority: 16, scalarHooks: 4 })
    // The caller's previous Promise.all started both scalar readers before
    // either settled. Do not silently serialize opaque facade callbacks.
    expect(measured.order.slice(0, 2)).toEqual([`${fixture.selectedRef}:start`, `${fixture.baselineRef}:start`])
    expect(measured.order.slice(4, 6)).toEqual([`${fixture.selectedRef}:start`, `${fixture.baselineRef}:start`])
  } finally { await fixture.cleanup() }
}, 120000)

test("Finance units pair grouping detects a real Planner source change between observations", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const changed = { reached: false }
    const measured = observe(fixture, { afterFirstEvidence: async () => {
      changed.reached = true
      const applied = await fixture.store.transaction("planner", async (snapshot) => {
        snapshot.data.versions = rows(snapshot.data.versions).map((version) => version.id === "v0" ? { ...version, closed: 10 } : version)
        return { commit: true, value: true }
      })
      expect(applied).toBe(true)
    } })
    const result = await measured.issuer.issue({ scenarioRef: fixture.selectedRef, baselineRef: fixture.baselineRef, parameterRef: "line:11" }, fixture.context)
    console.info(JSON.stringify({ phase: "finance-units-pairs.source-change", result, counts: measured.counts }))
    expect(changed.reached).toBe(true)
    expect(result).toEqual({ status: "stale", reason: "sensitivity-source-changed" })
    expect(measured.counts.scenarioBatches).toBe(2)
    expect(measured.counts.caseReads).toBe(2)
  } finally { await fixture.cleanup() }
}, 120000)
