import { expect, test } from "bun:test"
import { createSfPortfolioAuthority } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-authority.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ScenarioCompareRequest } from "../../../../product/contracts/operations.ts"
import type { PlannerSourceHost, PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { currentSfPlannerReadonlySnapshotScope } from "../../../../product/integration/source-lifecycle.ts"
import type { PlannerScenarioObservation, PlannerSourceObservation } from "../../../../product/planner/scenario-comparison-port.ts"
import { rows } from "../../../../runtime/contract.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Mode = "canonical" | "observed"
type Kind = "pair" | "source"
type Scope = NonNullable<ReturnType<typeof currentSfPlannerReadonlySnapshotScope>>

async function fixture(deadline: Deadline) {
  const original = await sensitivityObservationFixture(deadline)
  const counts = { pairCalls: 0, pairWork: 0, sourceCalls: 0, sourceWork: 0, source: 0, coverage: 0, criteria: 0 }
  const control: { mode: Mode; criterionDepth: number;
    insideSource?: (checks: readonly boolean[]) => Promise<void>;
    afterSource?: (checks: readonly boolean[]) => Promise<void> } = { mode: "observed", criterionDepth: 0 }
  const owners: { kind: Kind; criterion: boolean; scope: Scope }[] = []
  const pairResults: Awaited<ReturnType<PlannerScenarioObservation>>[] = []
  const sourceReads: { values: boolean[]; source: number; coverage: number }[] = []
  const sourceReturns: boolean[][] = []
  const innerResults: unknown[] = []
  const outside = () => {
    expect(currentSfPlannerReadonlySnapshotScope(original.persistence)).toBeUndefined()
    expect(original.persistence.currentSnapshots?.()).toBeUndefined()
  }
  const captureOwner = (kind: Kind) => {
    // An unsupported witness must still execute its canonical reader. Positive
    // assertions below require every expected native owner, without turning a
    // missing proof into the refusal that a negative test is trying to observe.
    try {
      const scope = currentSfPlannerReadonlySnapshotScope(original.persistence)
      if (scope?.bytesIdentity && scope.current()) owners.push({ kind, criterion: control.criterionDepth > 0, scope })
    } catch { /* The canonical reader owns an ended or unsupported scope. */ }
  }
  const sources: PlannerSourceHost = {
    ...original.business.plannerSources,
    resolveForecastSource: async (...args) => {
      counts.source++
      return original.business.plannerSources.resolveForecastSource(...args)
    },
    resolveForecastCoverage: async (...args) => {
      counts.coverage++
      return original.business.plannerSources.resolveForecastCoverage(...args)
    },
  }
  const pair: PlannerScenarioObservation = async (references, call, read) => {
    outside()
    expect(references).toEqual(original.references)
    counts.pairCalls++
    const result = await original.business.observePlannerScenarios(references, call, async () => {
      counts.pairWork++
      captureOwner("pair")
      const value = await read()
      pairResults.push(structuredClone(value))
      return value
    })
    outside()
    return result
  }
  const observeSources: PlannerSourceObservation = async (references, call, read) => {
    outside()
    expect(references).toEqual(original.references)
    counts.sourceCalls++
    const completeRead = async () => {
      counts.sourceWork++
      captureOwner("source")
      const before = { source: counts.source, coverage: counts.coverage }
      const value = await read()
      sourceReads.push({ values: structuredClone(value), source: counts.source - before.source,
        coverage: counts.coverage - before.coverage })
      await control.insideSource?.(value)
      return value
    }
    // The baseline delegates to the complete canonical source/coverage loop.
    // The observed mode invokes the very callback exported by the installation.
    const value = control.mode === "observed"
      ? await original.business.observePlannerSources(references, call, completeRead)
      : await completeRead()
    sourceReturns.push(structuredClone(value))
    outside()
    await control.afterSource?.(value)
    return value
  }
  // These are caller-side counters, not replacements of the native reader ports
  // held by Business. LocalStore, SourcePersistence and those ports stay intact.
  const business = { ...original.business, plannerSources: sources,
    observePlannerScenarios: pair, observePlannerSources: observeSources }
  const portfolio = createSfPortfolioAuthority({ authority: original.authority, business,
    proposalCoverageWrites: original.writes, proof: () => original.portfolio.proof })
  const evaluate = portfolio.rules.evaluate
  portfolio.rules.evaluate = async (...args) => {
    outside()
    counts.criteria++
    control.criterionDepth++
    try { return await evaluate(...args) }
    finally { control.criterionDepth--; outside() }
  }
  const run = async <Value>(mode: Mode, criteria: string[],
    work: (call: TrustedDomainContext) => Promise<PortResult<Value>>) => {
    control.mode = mode
    const input: ScenarioCompareRequest = { scenarioRefs: original.references, criteria }
    const digest = digestSfValue(input)
    const call = sensitivityOk(await original.authority.ui.admit(original.transport, "sf_scenario_compare", digest))
    try {
      expect(await original.authority.ui.validate(call, "sf_scenario_compare", digest)).toBe(true)
      return await original.business.withCase(call, original.caseRef, {}, async () => {
        const result = await work(call)
        innerResults.push(structuredClone(result))
        return result
      })
    } finally { original.authority.ui.finish(call) }
  }
  const compare = (mode: Mode = "observed") => run(mode, ["cost"], (call) =>
    portfolio.planner.compareScenarios({ scenarioRefs: original.references, criteria: ["cost"] }, call))
  const metric = (mode: Mode = "observed") => run(mode, [], async (call) => {
    const rule = sensitivityOk(await portfolio.rules.resolve({ caseRef: original.caseRef, criterionId: "cost" }, call))
    return portfolio.readMetric({ caseRef: original.caseRef, criterionId: "cost", ruleRef: rule.ruleRef,
      ruleVersion: rule.version, metricRef: rule.metricRef, scenarioRef: original.references[1]!,
      baselineRef: original.references[0]! }, call)
  })
  const state = async () => sensitivityOk(await original.authority.state.read(original.transport, "cases",
    (value) => structuredClone(value)))
  const reset = () => {
    for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0
    owners.length = 0
    pairResults.length = 0
    sourceReads.length = 0
    sourceReturns.length = 0
    innerResults.length = 0
    control.insideSource = undefined
    control.afterSource = undefined
    expect(control.criterionDepth).toBe(0)
  }
  return { original, portfolio, counts, control, owners, pairResults, sourceReads, sourceReturns,
    innerResults, outside, compare, metric, state, reset }
}

function complete(f: Awaited<ReturnType<typeof fixture>>, mode: Mode, pairs: number, criteria: number, nested: number) {
  expect(f.counts).toEqual({ pairCalls: pairs, pairWork: pairs, sourceCalls: pairs, sourceWork: pairs,
    source: pairs * 2, coverage: pairs * 2, criteria })
  expect(f.pairResults).toHaveLength(pairs)
  expect(f.pairResults.every((batch) => batch.length === 2 && batch.every((value) => value.status === "ok"))).toBe(true)
  expect(f.sourceReads).toEqual(Array.from({ length: pairs }, () => ({ values: [true, true], source: 2, coverage: 2 })))
  expect(f.sourceReturns).toEqual(Array.from({ length: pairs }, () => [true, true]))
  const pairOwners = f.owners.filter((owner) => owner.kind === "pair")
  const sourceOwners = f.owners.filter((owner) => owner.kind === "source")
  expect(pairOwners).toHaveLength(pairs)
  expect(sourceOwners).toHaveLength(mode === "observed" ? pairs : 0)
  expect(pairOwners.filter((owner) => owner.criterion)).toHaveLength(nested)
  expect(sourceOwners.filter((owner) => owner.criterion)).toHaveLength(mode === "observed" ? nested : 0)
  expect(new Set(f.owners.map((owner) => owner.scope.identity)).size).toBe(f.owners.length)
  for (const owner of f.owners) {
    expect(owner.scope.bytesIdentity).toBeDefined()
    const closed = () => { try { return !owner.scope.current() } catch { return true } }
    expect(closed()).toBe(true)
  }
  f.outside()
}

test("Portfolio facade wires source owners independently of its pair and criterion producers", async () => {
  const deadline = compositionTestDeadline("portfolio-source-facade")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const state = await f.state()
    const canonical = sensitivityOk(await deadline.phase("canonical-facade-and-real-criterion", () => f.compare("canonical")))
    expect(canonical).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null,
      criterionResults: [{ criterionId: "cost", state: "unknown", reason: "criterion-metric-conditioned" }] })
    // Three outer phases and two real metric comparisons (two phases each).
    // Both evaluations of the conditioned criterion remain outside those owners.
    complete(f, "canonical", 7, 2, 4)
    const identities: object[] = []
    for (let index = 0; index < 2; index++) {
      f.reset()
      const observed = sensitivityOk(await deadline.phase("installed-facade-observation-" + index, () => f.compare()))
      expect(observed).toEqual(canonical)
      complete(f, "observed", 7, 2, 4)
      identities.push(...f.owners.map((owner) => owner.scope.identity))
    }
    expect(new Set(identities).size).toBe(28)
    expect(await f.state()).toEqual(state)
  } finally { await deadline.close() }
}, 120_000)

test("Portfolio readMetric keeps canonical payloads and refuses drift after an admitted source read", async () => {
  const deadline = compositionTestDeadline("portfolio-source-metric")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const state = await f.state()
    const canonical = sensitivityOk(await deadline.phase("canonical-metric", () => f.metric("canonical")))
    expect(canonical).toMatchObject({ caseRef: f.original.caseRef, criterionId: "cost",
      metricRef: "planner:known-subtotal-difference", scenarioRef: f.original.references[1],
      baselineRef: f.original.references[0], value: -20, unit: "USD",
      period: { start: "2027-01-01", end: "2027-01-31" }, state: "conditioned" })
    expect(canonical.evidenceRefs).toHaveLength(2)
    expect(canonical.engineVersion).not.toBe("")
    complete(f, "canonical", 2, 0, 0)

    f.reset()
    const observed = sensitivityOk(await deadline.phase("installed-metric", () => f.metric()))
    expect(observed).toEqual(canonical)
    complete(f, "observed", 2, 0, 0)
    expect(await f.state()).toEqual(state)

    f.reset()
    const coverage = f.original.business.plannerSources.resolveForecastCoverage
    let readerAttack = 0
    f.control.insideSource = async (checks) => {
      expect(checks).toEqual([true, true])
      readerAttack++
      f.original.business.plannerSources.resolveForecastCoverage = (...args) => coverage(...args)
    }
    try {
      const refused = await deadline.phase("coverage-reader-changed-before-source-owner-egress", () => f.metric())
      expect(refused.status).not.toBe("ok")
      expect(readerAttack).toBe(1)
      expect(f.innerResults).toEqual([{ status: "stale", reason: "scenario-source-or-coverage-changed" }])
      expect(f.counts).toMatchObject({ pairCalls: 1, pairWork: 1, sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
      expect(f.sourceReads).toEqual([{ values: [true, true], source: 2, coverage: 2 }])
      expect(f.sourceReturns).toEqual([[false, false]])
      expect(f.owners.filter((owner) => owner.kind === "source")).toHaveLength(1)
    } finally { f.original.business.plannerSources.resolveForecastCoverage = coverage }
    expect(await f.state()).toEqual(state)

    f.reset()
    let revocations = 0
    f.control.afterSource = async (checks) => {
      expect(checks).toEqual([true, true])
      f.outside()
      revocations++
      f.original.control.active = false
    }
    try {
      const refused = await deadline.phase("authority-revoked-after-a-closed-source-owner", () => f.metric())
      expect(refused.status).not.toBe("ok")
      expect(revocations).toBe(1)
      expect(f.counts).toMatchObject({ pairWork: 1, sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
      expect(f.sourceReturns).toEqual([[true, true]])
    } finally { f.original.control.active = true }
    expect(await f.state()).toEqual(state)

    f.reset()
    let changes = 0
    f.control.afterSource = async (checks) => {
      expect(checks).toEqual([true, true])
      f.outside()
      if (++changes === 1) await f.original.persistence.transaction("planner", async (snapshot) => {
        const line = rows(rows(snapshot.data.versions).find((version) => version.id === "v0")?.lines)[0]
        if (!line || !Array.isArray(line.b)) throw new Error("The canonical Planner baseline is absent")
        line.b[0] = 999
        return { commit: true, value: undefined }
      })
    }
    const changed = await deadline.phase("real-source-change-between-independent-metric-phases", () => f.metric())
    expect(changed.status).not.toBe("ok")
    expect(changes).toBe(1)
    expect(f.counts).toMatchObject({ pairCalls: 2, pairWork: 2, sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
    expect(f.pairResults).toHaveLength(2)
    expect(f.pairResults[1]!).toHaveLength(2)
    expect(f.pairResults[1]!.some((value) => value.status !== "ok")).toBe(true)
    expect(f.sourceReturns).toEqual([[true, true]])
    expect(await f.state()).toEqual(state)
    f.outside()
  } finally { await deadline.close() }
}, 120_000)
