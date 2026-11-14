import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { compareScenarios, resolvePlannerScenarioBatch } from "../../../product/planner/scenario-comparison-port.ts"
import { domain } from "../../../runtime/planner.ts"
import { plannerAt } from "../wp03/planner-fixture.ts"
import { scenarioBatchFixture } from "./scenario-batch-fixture.ts"

function ok<T>(result: PortResult<T>): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

test("one sibling batch shares only its two canonical case observations and retains every result reread", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe()
    const current = await resolvePlannerScenarioBatch(observed.scenarios, fixture.saved, fixture.context)
    expect(current.map((entry) => ok(entry).result)).toEqual(fixture.entries.map((entry) => entry.result))
    expect(observed.counts).toEqual({ cases: 2, stores: 4, forecasts: 2, events: [
      `store:${fixture.saved[0]}`, `store:${fixture.saved[1]}`, "case",
      `forecast:${fixture.entries[0]!.scenario.baseRef}`, `forecast:${fixture.entries[1]!.scenario.baseRef}`,
      `store:${fixture.saved[0]}`, `store:${fixture.saved[1]}`, "case",
    ] })
    const next = await resolvePlannerScenarioBatch(observed.scenarios, fixture.saved, fixture.context)
    expect(next).toEqual(current)
    expect(observed.counts).toMatchObject({ cases: 4, stores: 8, forecasts: 4 })
    const duplicate = await resolvePlannerScenarioBatch(observed.scenarios, [fixture.saved[0]!, fixture.saved[0]!], fixture.context)
    const first = ok(duplicate[0]!)
    const second = ok(duplicate[1]!)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.result).not.toBe(second.result)
    expect(first.basis).not.toBe(second.basis)
    expect(first.projection).not.toBe(second.projection)
    Object.assign(first.result, { knownSubtotal: -1 })
    expect(second.result).toEqual(fixture.entries[0]!.result)
    expect(observed.counts).toMatchObject({ cases: 6, stores: 12, forecasts: 6 })
  } finally { await fixture.close() }
}, 60000)

test("units emit the identical binding with six canonical case reads, while a legacy host still performs ten", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const selection = { scenarioRef: fixture.saved[1]!, baselineRef: fixture.saved[0]!, parameterRef: "line:11" }
    const batch = fixture.observe()
    const legacy = fixture.observe()
    const issue = (observed: typeof batch, batched: boolean) => createPlannerSensitivityUnits({ host: fixture.fixture.host, cases: observed.cases, scenarios: batched ? observed.scenarios : { resolve: observed.scenarios.resolve }, store: observed.store, evidence: fixture.evidence, rules: { resolve: async () => ({ status: "unavailable", reason: "no-rule-read-during-unit-issue" }) } }).issue(selection, fixture.context)
    const current = ok(await issue(batch, true))
    const fallback = ok(await issue(legacy, false))
    expect(current).toEqual(fallback)
    expect(batch.counts).toMatchObject({ cases: 6, stores: 12, forecasts: 4 })
    expect(legacy.counts).toMatchObject({ cases: 10, stores: 12, forecasts: 4 })
    expect(current.units).toMatchObject({ parameterUnit: "USD", resultUnit: "USD", engineVersion: "planner-runtime-v1" })
    console.log("wp11 scenario batch canonical calls", { batched: { cases: batch.counts.cases, stores: batch.counts.stores, forecasts: batch.counts.forecasts }, legacy: { cases: legacy.counts.cases, stores: legacy.counts.stores, forecasts: legacy.counts.forecasts } })
  } finally { await fixture.close() }
}, 60000)

test("comparison starts independent batches for its initial and final observations", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe()
    const current = ok(await compareScenarios({ host: fixture.fixture.host, sources: fixture.sources, scenarios: observed.scenarios }, { scenarioRefs: fixture.saved, criteria: [] }, fixture.context))
    expect(current).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    expect(observed.counts).toMatchObject({ cases: 4, stores: 8, forecasts: 4 })
    const secondContext = await fixture.admit()
    const independent = fixture.observe()
    const simultaneous = await Promise.all([resolvePlannerScenarioBatch(independent.scenarios, [fixture.saved[0]!], fixture.context), resolvePlannerScenarioBatch(independent.scenarios, [fixture.saved[0]!], secondContext)])
    expect(simultaneous.map((entries) => entries.map((entry) => ok(entry).result))).toEqual([[fixture.entries[0]!.result], [fixture.entries[0]!.result]])
    expect(independent.counts).toMatchObject({ cases: 4, stores: 4, forecasts: 2 })
    const admin = await fixture.admit("admin")
    expect((await resolvePlannerScenarioBatch(independent.scenarios, [fixture.saved[0]!], admin))[0]!.status).toBe("denied")
    expect(independent.counts).toMatchObject({ cases: 4, stores: 5, forecasts: 2 })
  } finally { await fixture.close() }
}, 60000)

test("different cases and historical producer versions form separate groups and retain order, cardinality and refusal", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const current = await fixture.changeCase((value) => ({ ...value, version: 2 }))
    const entry = fixture.entries[0]!
    const newer = ok(await fixture.results.write({ kind: "scenario", caseRef: { id: current.id, incarnation: current.incarnation, version: current.version }, result: entry.result, requestDigest: digestSfValue(entry.scenario), sourceRefs: entry.result.sourceRefs, idempotencyKey: "batch-newer-producer" }, fixture.context))
    const other = fixture.entries[1]!
    const otherCase = ok(await fixture.results.write({ kind: "scenario", caseRef: fixture.otherCaseRef, result: other.result, requestDigest: digestSfValue(other.scenario), sourceRefs: other.result.sourceRefs, idempotencyKey: "batch-other-case" }, fixture.context))
    const observed = fixture.observe()
    const references = [fixture.saved[1]!, newer.resultRef, otherCase.resultRef, fixture.saved[1]!, "decision-result:missing"]
    const currentResults = await resolvePlannerScenarioBatch(observed.scenarios, references, fixture.context)
    expect(currentResults).toHaveLength(references.length)
    expect(currentResults.slice(0, 4).map((entry) => ok(entry).result)).toEqual([fixture.entries[1]!.result, entry.result, other.result, fixture.entries[1]!.result])
    expect(currentResults[4]).toEqual({ status: "unavailable", reason: "result-unavailable" })
    expect(observed.counts).toMatchObject({ cases: 6, stores: 9, forecasts: 4 })
  } finally { await fixture.close() }
}, 60000)

test("ledger, alternative and coverage changes between phases invalidate every sibling without a version shortcut", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const changes: ((value: DecisionCase) => DecisionCase)[] = [
      (value) => ({ ...value, ledger: [...value.ledger, { id: "batch-event", caseRef: fixture.caseRef, kind: "analysis-accepted", principalRef: fixture.context.binding.principalRef, at: plannerAt, consideredActions: [], factualGaps: [], lifecycleState: value.state, rationale: "Adversarial persisted ledger change during an observation", evidenceRefs: [], outputDigest: "a".repeat(64) }] }),
      (value) => ({ ...value, alternatives: value.alternatives.map((alternative, index) => index === 0 ? { ...alternative, title: "Changed title" } : alternative) }),
      (value) => ({ ...value, costCoverageBases: value.costCoverageBases.map((basis) => ({ ...basis, additionalCategoryIds: ["changed-scope"] })) }),
    ]
    for (const change of changes) {
      const observed = fixture.observe()
      observed.hooks.afterForecast = async (count) => { if (count === 1) await fixture.changeCase(change) }
      const current = await resolvePlannerScenarioBatch(observed.scenarios, fixture.saved, fixture.context)
      expect(current).toEqual(fixture.saved.map(() => ({ status: "stale", reason: "case-changed" })))
      expect(observed.counts).toMatchObject({ cases: 2, stores: 4, forecasts: 2 })
    }
  } finally { await fixture.close() }
}, 60000)

test("authority revoked after result rereads is rejected by the fresh final case observation", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe()
    observed.hooks.afterStore = (count) => { if (count === 4) fixture.fixture.access.allowed = false }
    const current = await resolvePlannerScenarioBatch(observed.scenarios, fixture.saved, fixture.context)
    expect(current).toEqual(fixture.saved.map(() => ({ status: "denied", reason: "invalid-authority" })))
    expect(observed.counts).toMatchObject({ cases: 2, stores: 4, forecasts: 2 })
  } finally { await fixture.close() }
}, 60000)

test("a real Planner source change during projection invalidates both stored siblings", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe()
    observed.hooks.afterForecast = async (count) => {
      if (count !== 1) return
      const changed = await fixture.fixture.persistence.transaction("planner", async (snapshot) => {
        const result = domain.execute(snapshot, { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f10: 113000 } }, { at: plannerAt, id: () => "batch-source-change", directory: [] })
        return { commit: result.ok, value: result }
      })
      expect(changed.ok).toBe(true)
    }
    const current = await resolvePlannerScenarioBatch(observed.scenarios, fixture.saved, fixture.context)
    expect(current).toEqual(fixture.saved.map(() => ({ status: "denied", reason: "result-access-unavailable" })))
    expect(observed.counts).toMatchObject({ cases: 1, stores: 4, forecasts: 2 })
  } finally { await fixture.close() }
}, 60000)

test("retained store and case callback objects cannot rewrite an earlier observation", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe()
    const retained: { case?: AuthorizedCaseProjection["case"]; stored?: Awaited<ReturnType<typeof fixture.results.readHistoricalScenario>> } = {}
    observed.hooks.afterCase = (count, value) => { if (count === 1 && value.status === "ok") retained.case = value.value.case }
    observed.hooks.afterStore = (count, value) => { if (count === 1) retained.stored = value }
    observed.hooks.afterForecast = async (count) => {
      if (count !== 1) return
      const changed = await fixture.changeCase((value) => ({ ...value, objective: "Changed during projection" }))
      if (retained.case) Object.assign(retained.case, changed)
      if (retained.stored?.status === "ok") Object.assign(retained.stored.value, { requestDigest: "b".repeat(64) })
    }
    expect(await resolvePlannerScenarioBatch(observed.scenarios, fixture.saved, fixture.context)).toEqual(fixture.saved.map(() => ({ status: "stale", reason: "case-changed" })))
    expect(observed.counts).toMatchObject({ cases: 2, stores: 4, forecasts: 2 })
  } finally { await fixture.close() }
}, 60000)

test("batch refusals and malformed cardinality never fall back to individual resolution", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = fixture.observe()
    const resolve = async () => { throw new Error("Batch refusal must not fall back") }
    expect(await resolvePlannerScenarioBatch({ resolve, resolveMany: async () => [] }, fixture.saved, fixture.context)).toEqual(fixture.saved.map(() => ({ status: "unavailable", reason: "scenario-batch-invalid" })))
    expect(await resolvePlannerScenarioBatch({ resolve, resolveMany: async () => fixture.saved.map(() => ({ status: "denied", reason: "revoked" })) }, fixture.saved, fixture.context)).toEqual(fixture.saved.map(() => ({ status: "denied", reason: "revoked" })))
    const legacy = await resolvePlannerScenarioBatch({ resolve: observed.scenarios.resolve }, fixture.saved, fixture.context)
    expect(legacy.map((entry) => ok(entry).result)).toEqual(fixture.entries.map((entry) => entry.result))
    expect(observed.counts).toMatchObject({ cases: 4, stores: 4, forecasts: 2 })
  } finally { await fixture.close() }
}, 60000)
