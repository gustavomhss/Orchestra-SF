import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { createSfDecisionResultStore, readHistoricalScenarios } from "../../../product/decisions/result-store.ts"
import { domain } from "../../../runtime/planner.ts"
import { plannerAt } from "../wp03/planner-fixture.ts"
import { scenarioBatchFixture } from "../wp11/scenario-batch-fixture.ts"

function ok<T>(result: PortResult<T>): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(result.status + ": " + result.reason)
  return result.value
}

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release: () => release() }
}

/** The real state/source producers remain in charge; hooks act after their checks. */
function observeResults(fixture: Awaited<ReturnType<typeof scenarioBatchFixture>>) {
  const counts = { reads: 0, cases: 0, sources: 0 }
  const hooks: { afterSources?: (count: number) => void | Promise<void> } = {}
  const results = createSfDecisionResultStore({
    state: { ...fixture.state, read: (request, namespace, reader) => {
      if (namespace === "cases") counts.reads++
      return fixture.state.read(request, namespace, reader)
    } },
    host: fixture.fixture.host,
    authorizeCase: async (decision, context) => {
      counts.cases++
      return decision.participants.includes(context.binding.principalRef) && await fixture.fixture.host.revalidate(context)
    },
    verifySources: async (_value, refs, context) => {
      const checked = await Promise.all(refs.map(async (ref) => {
        const current = await fixture.fixture.sources.resolveForecastSource(ref.refId, context)
        return ref.kind === "record" && current.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(ref)
      }))
      counts.sources++
      await hooks.afterSources?.(counts.sources)
      return checked.every(Boolean)
    },
    createId: () => { throw new Error("Observation must not write a result") },
    now: () => plannerAt,
  })
  return { results, counts, hooks }
}

test("analysis sibling observations use three C08 snapshots and retain all scalar case/source callbacks", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const canonical = observeResults(fixture)
    const scalar = observeResults(fixture)
    const calls: string[] = []
    const opaque = { ...scalar.results, readHistoricalScenario: async (...args: Parameters<typeof scalar.results.readHistoricalScenario>) => {
      calls.push(args[0].resultRef)
      return scalar.results.readHistoricalScenario(...args)
    } }
    const batch = await readHistoricalScenarios(canonical.results, fixture.saved, fixture.context, "parallel-joint")
    const individual = await readHistoricalScenarios(opaque, fixture.saved, fixture.context, "parallel-joint")
    expect(batch.map((entry) => ok(entry))).toEqual(individual.map((entry) => ok(entry)))
    expect(canonical.counts).toEqual({ reads: 3, cases: 4, sources: 4 })
    expect(scalar.counts).toEqual({ reads: 6, cases: 4, sources: 4 })
    expect(calls).toEqual(fixture.saved)
    expect(batch[0]).not.toBe(individual[0])
  } finally { await fixture.close() }
}, 60000)

test("opaque concurrent readers retain their shared object until the final joint clone", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const gates = [deferred(), deferred()]
    const returned = [deferred(), deferred()]
    const calls: string[] = []
    const shared = { status: "ok" as const, value: ok(await fixture.results.readHistoricalScenario({ resultRef: fixture.saved[0]! }, fixture.context)) }
    const opaque = { ...fixture.results, readHistoricalScenario: async (...args: Parameters<typeof fixture.results.readHistoricalScenario>) => {
      const index = calls.length
      calls.push(args[0].resultRef)
      const value = ok(await fixture.results.readHistoricalScenario(...args))
      await gates[index]!.promise
      shared.value = value
      returned[index]!.release()
      return shared
    } }
    const pending = readHistoricalScenarios(opaque, fixture.saved, fixture.context, "parallel-joint")
    expect(calls).toEqual(fixture.saved)
    gates[0]!.release()
    await returned[0]!.promise
    await Promise.resolve()
    gates[1]!.release()
    const observed = await pending
    expect(observed.map((entry) => ok(entry).resultRef)).toEqual([fixture.saved[1]!, fixture.saved[1]!])
    expect(observed[0]).toBe(observed[1])
    expect(observed[0]).not.toBe(shared)
    shared.value.resultRef = "changed-after-return"
    expect(ok(observed[0]!).resultRef).toBe(fixture.saved[1]!)
  } finally { await fixture.close() }
}, 60000)

test("an opaque reader replaced during its pending pair cannot release observations or restart", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const ready = deferred()
    const gate = deferred()
    const calls = { original: 0, replacement: 0 }
    const opaque = { ...fixture.results, readHistoricalScenario: async (...args: Parameters<typeof fixture.results.readHistoricalScenario>) => {
      const result = await fixture.results.readHistoricalScenario(...args)
      if (++calls.original === 2) ready.release()
      await gate.promise
      return result
    } }
    const pending = readHistoricalScenarios(opaque, fixture.saved, fixture.context, "parallel-joint")
    await ready.promise
    opaque.readHistoricalScenario = async (...args) => {
      calls.replacement++
      return fixture.results.readHistoricalScenario(...args)
    }
    gate.release()
    expect(await pending).toEqual(fixture.saved.map(() => ({ status: "denied", reason: "historical-reader-changed" })))
    expect(calls).toEqual({ original: 2, replacement: 0 })
  } finally { await fixture.close() }
}, 60000)

test("a copied canonical facade replaced during its final source callback is denied", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = observeResults(fixture)
    const facade = { ...observed.results }
    let replacementCalls = 0
    observed.hooks.afterSources = (count) => {
      if (count !== 4) return
      facade.readHistoricalScenario = async (...args) => {
        replacementCalls++
        return observed.results.readHistoricalScenario(...args)
      }
    }
    expect(await readHistoricalScenarios(facade, fixture.saved, fixture.context, "parallel-joint"))
      .toEqual(fixture.saved.map(() => ({ status: "denied", reason: "historical-reader-changed" })))
    expect(observed.counts).toEqual({ reads: 3, cases: 4, sources: 4 })
    expect(replacementCalls).toBe(0)
  } finally { await fixture.close() }
}, 60000)

test("a complete case change in the last source callback invalidates both historical siblings", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = observeResults(fixture)
    observed.hooks.afterSources = async (count) => {
      if (count === 4) await fixture.changeCase((value) => ({ ...value, objective: "Changed after every source callback" }))
    }
    expect(await readHistoricalScenarios(observed.results, fixture.saved, fixture.context, "parallel-joint"))
      .toEqual(fixture.saved.map(() => ({ status: "denied", reason: "result-access-unavailable" })))
    expect(observed.counts).toEqual({ reads: 3, cases: 4, sources: 4 })
    const current = await fixture.state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
    expect(current.status).toBe("ok")
    if (current.status !== "ok") throw new Error("Persisted case unavailable")
    expect(current.value).toMatchObject({ version: 1, objective: "Changed after every source callback" })
  } finally { await fixture.close() }
}, 60000)

test("a real Planner write between source phases cannot authenticate the earlier baseline result", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = observeResults(fixture)
    let changed = false
    observed.hooks.afterSources = async (count) => {
      if (count !== 2) return
      const saved = await fixture.fixture.persistence.transaction("planner", async (snapshot) => {
        const result = domain.execute(snapshot, { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f10: 113000 } }, { at: plannerAt, id: () => "analysis-source-change", directory: [] })
        return { commit: result.ok, value: result }
      })
      expect(saved.ok).toBe(true)
      changed = saved.ok
    }
    const observedResults = await readHistoricalScenarios(observed.results, fixture.saved, fixture.context, "parallel-joint")
    expect(changed).toBe(true)
    expect(observedResults[0]).toEqual({ status: "denied", reason: "result-access-unavailable" })
    expect(observedResults).toHaveLength(2)
  } finally { await fixture.close() }
}, 60000)

test("authority revoked in the last source callback cannot survive the final C08 fence", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const observed = observeResults(fixture)
    observed.hooks.afterSources = (count) => { if (count === 4) fixture.fixture.access.allowed = false }
    expect(await readHistoricalScenarios(observed.results, fixture.saved, fixture.context, "parallel-joint"))
      .toEqual(fixture.saved.map(() => ({ status: "denied", reason: "result-access-unavailable" })))
    expect(observed.counts.sources).toBe(4)
  } finally { await fixture.close() }
}, 60000)

test("historical producer versions remain distinct and preserve later complete-case observation groups", async () => {
  const fixture = await scenarioBatchFixture()
  try {
    const current = await fixture.changeCase((value) => ({ ...value, version: 2 }))
    const entry = fixture.entries[0]!
    const newer = ok(await fixture.results.write({ kind: "scenario", caseRef: { id: current.id, incarnation: current.incarnation, version: current.version }, result: entry.result, requestDigest: digestSfValue(entry.scenario), sourceRefs: entry.result.sourceRefs, idempotencyKey: "analysis-newer-producer" }, fixture.context))
    const references = [fixture.saved[1]!, newer.resultRef, fixture.saved[1]!]
    const results = (await readHistoricalScenarios(fixture.results, references, fixture.context, "parallel-joint")).map((entry) => ok(entry))
    expect(results.map((value) => value.resultRef)).toEqual(references)
    expect(results.map((value) => value.caseRef.version)).toEqual([1, 2, 1])
    expect(results[0]).not.toBe(results[2])
    const observed = fixture.observe()
    const resolved = (await observed.scenarios.resolveMany!(references, fixture.context)).map((entry) => ok(entry))
    expect(resolved.map((value) => value.result)).toEqual([fixture.entries[1]!.result, entry.result, fixture.entries[1]!.result])
    expect(observed.counts).toMatchObject({ cases: 4, stores: 6, forecasts: 3 })
  } finally { await fixture.close() }
}, 60000)
