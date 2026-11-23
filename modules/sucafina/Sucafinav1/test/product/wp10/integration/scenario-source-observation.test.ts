import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PlannerSourceHost } from "../../../../product/contracts/ports.ts"
import { currentSfPlannerReadonlySnapshotScope } from "../../../../product/integration/source-lifecycle.ts"
import { compareScenarios } from "../../../../product/planner/scenario-comparison-port.ts"
import type { PlannerScenarioObservation, PlannerSourceObservation } from "../../../../product/planner/scenario-comparison-port.ts"
import { rows } from "../../../../runtime/contract.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type SourceRead = Parameters<PlannerSourceObservation>[2]

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

async function fixture(deadline: Deadline) {
  // The existing native fixture leaves LocalStore and its source factory intact.
  const original = await sensitivityObservationFixture(deadline)
  const scenarios = original.business.plannerProduct.scenarios
  if (!scenarios) throw new Error("Canonical stored scenario reader unavailable")
  const input = { scenarioRefs: original.references, criteria: ["cost"] }
  const counts = { pairCalls: 0, pairWork: 0, sourceCalls: 0, sourceWork: 0, source: 0, coverage: 0, criteria: 0 }
  const owners = { pairs: [] as object[], sources: [] as object[] }
  const hooks: { beforeSource?: () => Promise<void> } = {}
  const outside = () => {
    expect(currentSfPlannerReadonlySnapshotScope(original.persistence)).toBeUndefined()
    expect(original.persistence.currentSnapshots?.()).toBeUndefined()
  }
  const captureOwner = (target: object[]) => {
    const current = currentSfPlannerReadonlySnapshotScope(original.persistence)
    if (!current?.bytesIdentity || !current.current()) throw new Error("The complete check did not enter its native readonly owner")
    target.push(current.identity)
  }
  const sources: PlannerSourceHost = {
    ...original.business.plannerSources,
    resolveForecastSource: async (...args) => {
      counts.source++
      if (hooks.beforeSource) await hooks.beforeSource()
      return original.business.plannerSources.resolveForecastSource(...args)
    },
    resolveForecastCoverage: async (...args) => {
      counts.coverage++
      return original.business.plannerSources.resolveForecastCoverage(...args)
    },
  }
  const pair: PlannerScenarioObservation = async (references, call, read) => {
    counts.pairCalls++
    outside()
    const value = await original.business.observePlannerScenarios(references, call, async () => {
      counts.pairWork++
      captureOwner(owners.pairs)
      return read()
    })
    outside()
    return value
  }
  const observe: PlannerSourceObservation = async (references, call, read) => {
    outside()
    expect(references).toEqual(original.references)
    const before = { source: counts.source, coverage: counts.coverage }
    const observed = await original.business.withPlannerObservation({ scenarioRefs: [...references], criteria: [] }, call, async () => {
      counts.sourceWork++
      captureOwner(owners.sources)
      const value = await read()
      expect(counts.source - before.source).toBe(2)
      expect(counts.coverage - before.coverage).toBe(2)
      return { status: "ok", value }
    })
    outside()
    return observed.status === "ok" ? observed.value : [false, false]
  }
  const run = async (observeSources?: PlannerSourceObservation) => {
    const digest = digestSfValue(input)
    const call = sensitivityOk(await original.authority.ui.admit(original.transport, "sf_scenario_compare", digest))
    try {
      expect(await original.authority.ui.validate(call, "sf_scenario_compare", digest)).toBe(true)
      return await original.business.withCase(call, original.caseRef, {}, () => compareScenarios({
        host: original.authority.host, sources, scenarios, observeScenarios: pair,
        ...(observeSources ? { observeSources: async (...args: Parameters<PlannerSourceObservation>) => {
          counts.sourceCalls++
          return observeSources(...args)
        } } : {}),
        criteria: { evaluate: (request, context) => {
          outside()
          counts.criteria++
          return original.portfolio.rules.evaluate({ ...request, caseRef: original.caseRef }, context)
        } },
      }, input, call))
    } finally { original.authority.ui.finish(call) }
  }
  const reset = () => {
    for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0
    owners.pairs.length = 0
    owners.sources.length = 0
    hooks.beforeSource = undefined
  }
  const state = async () => sensitivityOk(await original.authority.state.read(original.transport, "cases", (value) =>
    structuredClone({ cases: value.cases, versions: value.versions })))
  return { original, input, counts, owners, hooks, outside, observe, run, reset, state }
}

function expectCompletePhases(f: Awaited<ReturnType<typeof fixture>>, observed: boolean) {
  expect(f.counts).toEqual({ pairCalls: 3, pairWork: 3, sourceCalls: observed ? 3 : 0,
    sourceWork: observed ? 3 : 0, source: 6, coverage: 6, criteria: 2 })
  expect(f.owners.pairs).toHaveLength(3)
  expect(new Set(f.owners.pairs).size).toBe(3)
  expect(f.owners.sources).toHaveLength(observed ? 3 : 0)
  expect(new Set([...f.owners.pairs, ...f.owners.sources]).size).toBe(observed ? 6 : 3)
  f.outside()
}

function staleFor(phase: number) {
  return { status: "stale" as const, reason: phase === 1 ? "scenario-source-or-coverage-changed"
    : phase === 2 ? "scenario-or-authority-changed" : "criterion-or-authority-changed" }
}

test("Planner source observations preserve complete comparisons and independent phase owners", async () => {
  const deadline = compositionTestDeadline("scenario-source-observation")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const canonical = sensitivityOk(await deadline.phase("canonical-source-checks", () => f.run()))
    expect(canonical).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    expect(canonical.criterionResults).toHaveLength(1)
    expectCompletePhases(f, false)
    const state = await f.state()
    const allOwners: object[] = []
    for (let iteration = 0; iteration < 2; iteration++) {
      f.reset()
      const observed = sensitivityOk(await deadline.phase("complete-source-observation-" + iteration, () => f.run(f.observe)))
      expect(observed).toEqual(canonical)
      expectCompletePhases(f, true)
      allOwners.push(...f.owners.pairs, ...f.owners.sources)
    }
    expect(new Set(allOwners).size).toBe(12)
    f.reset()
    // The callback receives detached checks. Mutating that array must not alter
    // the private canonical result used to verify its returned snapshot.
    const detached = await deadline.phase("retained-checks-cannot-corrupt-the-private-canonical-snapshot", () =>
      f.run((references, call, read) => f.observe(references, call, async () => {
        const values = await read()
        expect(values).toEqual([true, true])
        const captured = structuredClone(values)
        expect(Reflect.set(values, 0, false)).toBe(true)
        expect(values).not.toEqual(captured)
        return captured
      })))
    expect(detached).toEqual({ status: "ok", value: canonical })
    expectCompletePhases(f, true)
    expect(await f.state()).toEqual(state)

    f.reset()
    const reader = f.original.business.plannerSources.resolveForecastSource
    let admittedReaderAttack = 0
    try {
      const changed = await deadline.phase("reader-drift-after-a-complete-admitted-source-read", () =>
        f.run((references, call, read) => f.observe(references, call, async () => {
          const value = await read()
          expect(value).toEqual([true, true])
          admittedReaderAttack++
          f.original.business.plannerSources.resolveForecastSource = (...args) => reader(...args)
          return value
        })))
      expect(changed.status).not.toBe("ok")
      expect(admittedReaderAttack).toBe(1)
      expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
    } finally { f.original.business.plannerSources.resolveForecastSource = reader }

    f.reset()
    let closedAuthorityAttack = 0
    try {
      const revoked = await deadline.phase("authority-revoked-between-independent-source-phases", () =>
        f.run(async (references, call, read) => {
          const value = await f.observe(references, call, read)
          expect(value).toEqual([true, true])
          f.outside()
          closedAuthorityAttack++
          f.original.control.active = false
          return value
        }))
      expect(revoked.status).not.toBe("ok")
      expect(closedAuthorityAttack).toBe(1)
      expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
    } finally { f.original.control.active = true }
    expect(await f.state()).toEqual(state)

    f.reset()
    let closedSourceAttack = 0
    const changed = await deadline.phase("planner-source-changed-after-the-first-source-owner", () =>
      f.run(async (references, call, read) => {
        const value = await f.observe(references, call, read)
        expect(value).toEqual([true, true])
        f.outside()
        if (++closedSourceAttack === 1) await f.original.persistence.transaction("planner", async (snapshot) => {
          const line = rows(rows(snapshot.data.versions).find((version) => version.id === "v0")?.lines)[0]
          if (!line || !Array.isArray(line.b)) throw new Error("The canonical Planner baseline is absent")
          line.b[0] = 999
          return { commit: true, value: undefined }
        })
        return value
      }))
    expect(changed.status).not.toBe("ok")
    expect(closedSourceAttack).toBe(1)
    expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
  } finally { await deadline.close() }
}, 120_000)

test("Planner source observations reject incomplete shapes and forged source decisions", async () => {
  const deadline = compositionTestDeadline("scenario-source-boundary")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const state = await f.state()
    const faults: { name: string; phase: number; shape: (values: boolean[]) => boolean[] }[] = [
      { name: "empty-first", phase: 1, shape: () => [] },
      { name: "short-first", phase: 1, shape: (values) => values.slice(0, 1) },
      { name: "extra-first", phase: 1, shape: (values) => [...values, true] },
      { name: "sparse-first", phase: 1, shape: (values) => {
        expect(Reflect.deleteProperty(values, 0)).toBe(true)
        return values
      } },
      { name: "nonboolean-first", phase: 1, shape: (values) => {
        expect(Reflect.set(values, 1, "true")).toBe(true)
        return values
      } },
      { name: "empty-second", phase: 2, shape: () => [] },
      { name: "short-final", phase: 3, shape: (values) => values.slice(0, 1) },
    ]
    for (const fault of faults) {
      f.reset()
      const result = await deadline.phase(fault.name, () => f.run(async (references, call, read) => {
        const value = await f.observe(references, call, read)
        expect(value).toEqual([true, true])
        return f.counts.sourceCalls === fault.phase ? fault.shape(value) : value
      }))
      expect(result).toEqual(staleFor(fault.phase))
      expect(f.counts).toEqual({ pairCalls: fault.phase, pairWork: fault.phase, sourceCalls: fault.phase,
        sourceWork: fault.phase, source: fault.phase * 2, coverage: fault.phase * 2, criteria: fault.phase === 3 ? 2 : 0 })
      expect(await f.state()).toEqual(state)
    }

    f.reset()
    const fabricated = await deadline.phase("true-without-the-canonical-producer", () => f.run(async () => [true, true]))
    expect(fabricated).toEqual(staleFor(1))
    expect(f.counts).toMatchObject({ pairCalls: 1, sourceCalls: 1, sourceWork: 0, source: 0, coverage: 0 })
    expect(await f.state()).toEqual(state)

    f.reset()
    const replaced = await deadline.phase("false-canonical-checks-cannot-be-replaced-with-true", () =>
      f.run(async (_references, _call, read) => {
        f.original.control.active = false
        try {
          const value = await read()
          expect(value).toEqual([false, false])
          return [true, true]
        } finally { f.original.control.active = true }
      }))
    expect(replaced).toEqual(staleFor(1))
    expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 0, source: 2, coverage: 2 })
    expect(await f.state()).toEqual(state)

    f.reset()
    const thrown = await deadline.phase("observer-throw-does-not-replay-completed-source-checks", () =>
      f.run(async (references, call, read) => {
        const value = await f.observe(references, call, read)
        expect(value).toEqual([true, true])
        throw new Error("The source observer rejected its complete result")
      }))
    expect(thrown).toEqual(staleFor(1))
    expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
    expect(await f.state()).toEqual(state)
  } finally { await deadline.close() }
}, 120_000)

test("Planner source observations do not share pending or expired canonical callbacks", async () => {
  const deadline = compositionTestDeadline("scenario-source-lifetime")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const canonical = sensitivityOk(await deadline.phase("canonical-lifetime-reference", () => f.run()))
    const state = await f.state()
    f.reset()
    const retained: SourceRead[] = []
    const completed = await deadline.phase("completed-source-callbacks-expire-with-their-phase", () =>
      f.run(async (references, call, read) => {
        retained.push(read)
        return f.observe(references, call, read)
      }))
    expect(completed).toEqual({ status: "ok", value: canonical })
    expectCompletePhases(f, true)
    expect(retained).toHaveLength(3)
    const completedCounts = { ...f.counts }
    for (const read of retained) expect(await read()).toEqual([false, false])
    expect(f.counts).toEqual(completedCounts)
    expect(await f.state()).toEqual(state)

    f.reset()
    let duplicate = 0
    const repeated = await deadline.phase("a-duplicate-call-invalidates-the-phase-without-a-second-producer", () =>
      f.run((references, call, read) => f.observe(references, call, async () => {
        const original = await read()
        expect(original).toEqual([true, true])
        duplicate++
        expect(await read()).toEqual([false, false])
        return original
      })))
    expect(repeated).toEqual(staleFor(1))
    expect(duplicate).toBe(1)
    expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 1, source: 2, coverage: 2 })
    expect(await f.state()).toEqual(state)

    f.reset()
    const entered = gate(), release = gate()
    let pending: Promise<boolean[]> | undefined, late: SourceRead | undefined
    f.hooks.beforeSource = async () => {
      entered.release()
      await release.promise
    }
    try {
      const refused = await deadline.phase("a-pending-canonical-read-cannot-release-a-forged-result", () =>
        f.run(async (_references, _call, read) => {
          late = read
          pending = read().finally(entered.release)
          await entered.promise
          return [true, true]
        }))
      expect(refused).toEqual(staleFor(1))
      expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 0, source: 1, coverage: 0 })
      if (!pending || !late) throw new Error("The actual canonical source reader did not start")
      release.release()
      expect(await pending).toEqual([false, false])
      expect(f.counts).toMatchObject({ sourceCalls: 1, sourceWork: 0, source: 2, coverage: 2 })
      const settled = { ...f.counts }
      expect(await late()).toEqual([false, false])
      expect(f.counts).toEqual(settled)
    } finally {
      release.release()
      await pending
      f.hooks.beforeSource = undefined
    }
    expect(await f.state()).toEqual(state)
  } finally { await deadline.close() }
}, 120_000)
