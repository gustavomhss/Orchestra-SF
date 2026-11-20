import { expect, test } from "bun:test"
import { createSfPlannerCalculationRoot } from "../../../../../../../apps/cli/src/sucafina-product/planner-calculation-root.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { calculationRootFixture } from "./calculation-root-fixture.ts"
import { calculationMixedFixture } from "./calculation-mixed-fixture.ts"

const refused = { status: "unavailable", reason: "calculation-read-root-unavailable" } as const
const marker = () => ({ status: "ok" as const, value: { marker: ["private"] } })
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}
async function protocol() {
  const f = await calculationRootFixture()
  const lease = await f.admit("sf_scenario_simulate")
  const manager = createSfPlannerCalculationRoot({ host: f.authority.host })
  return { ...f, lease, manager, close: async () => { f.authority.ui.finish(lease.call); await f.dispose() } }
}

test("an unsupported preparation preserves the complete producer without owning a root and remains one-shot", async () => {
  const f = await protocol()
  try {
    let initialized = 0, works = 0
    const prepared = await f.manager.prepare(f.lease.call, async () => { initialized++; return "unsupported" }, () => true)
    if (!prepared) throw new Error("Unsupported preparation unavailable")
    const actual = await prepared.run(async () => {
      works++
      return f.persistence.transaction("planner", async (snapshot) =>
        ({ commit: false, value: { status: "ok" as const, value: digestSfValue(snapshot) } }))
    })
    expect(actual.status).toBe("ok")
    expect(initialized).toBe(1)
    expect(works).toBe(1)
    expect(f.control.roots).toBe(0)
    expect(await prepared.run(async () => { works++; return marker() })).toEqual(refused)
    expect(works).toBe(1)
  } finally { await f.close() }
}, 120000)

test("an unsupported token refuses a foreign C08 scope that appeared after preparation", async () => {
  const f = await protocol()
  try {
    let works = 0
    const prepared = await f.manager.prepare(f.lease.call, async () => "unsupported", () => true)
    if (!prepared) throw new Error("Unsupported preparation unavailable")
    const result = await f.persistence.transaction("planner", async () => ({ commit: false,
      value: await prepared.run(async () => { works++; return marker() }) }))
    expect(result).toEqual(refused)
    expect(works).toBe(0)
    expect(f.control.roots).toBe(0)
  } finally { await f.close() }
}, 120000)

for (const boundary of ["false", "throw", "drift"] as const) {
  test(`failed initializer ${boundary} cannot become an unsupported legacy attempt`, async () => {
    const f = await protocol()
    try {
      let initialized = 0
      const prepared = await f.manager.prepare(f.lease.call, async () => {
        initialized++
        if (boundary === "throw") throw new Error("Actual initialization failed")
        if (boundary === "drift") f.lease.request.headers.set("x-changed", "1")
        return boundary === "false" ? false : "unsupported"
      }, () => true)
      expect(prepared).toBeUndefined()
      expect(initialized).toBe(1)
      expect(f.control.roots).toBe(0)
    } finally { await f.close() }
  }, 120000)
}

for (const boundary of ["before-work", "during-work"] as const) {
  test(`unsupported legacy work refuses revoked authority ${boundary}`, async () => {
    const f = await protocol()
    try {
      let works = 0
      const prepared = await f.manager.prepare(f.lease.call, async () => "unsupported", () => true)
      if (!prepared) throw new Error("Unsupported preparation unavailable")
      if (boundary === "before-work") f.control.active = false
      const result = await prepared.run(async () => {
        works++
        if (boundary === "during-work") f.control.active = false
        return marker()
      })
      expect(result).toEqual(refused)
      expect(works).toBe(boundary === "before-work" ? 0 : 1)
      expect(f.control.roots).toBe(0)
    } finally { await f.close() }
  }, 120000)
}

for (const boundary of ["owned", "foreign"] as const) {
  test(`an existing ${boundary} scope skips the mixed initializer entirely`, async () => {
    const f = await protocol()
    try {
      let initialized = 0, works = 0
      const work = async () => {
        const prepared = await f.manager.prepare(f.lease.call, async () => {
          initialized++
          throw new Error("An inherited scope must not initialize")
        }, () => true)
        if (!prepared) throw new Error("Inherited scope unavailable")
        return prepared.run(async () => { works++; return marker() })
      }
      const result = boundary === "foreign"
        ? await f.persistence.transaction("planner", async () => ({ commit: false, value: await work() }))
        : await (async () => {
          const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
          if (!prepared) throw new Error("Owner preparation unavailable")
          return prepared.run(work)
        })()
      expect(result).toEqual(marker())
      expect(initialized).toBe(0)
      expect(works).toBe(1)
      expect(f.control.roots).toBe(boundary === "owned" ? 1 : 0)
    } finally { await f.close() }
  }, 120000)
}

test("a mixed replay prepares an actual auxiliary source before its witness without replacing its cited source", async () => {
  const f = await calculationMixedFixture(1)
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const inner = f.inners[0]
    if (!inner) throw new Error("Actual inner calculation unavailable")
    const mixed = await f.produce([inner.calculation])
    const before = await f.sources()
    const entries = (value: typeof before, id: string) => Object.values(value?.scopes ?? {})
      .filter((entry) => entry.scope.recordType === "planner-version" && entry.scope.recordId === id)
    const cited = structuredClone(entries(before, "v0"))
    expect(cited.length).toBeGreaterThan(0)
    expect(entries(before, "v1")).toEqual([])
    const counts = [f.control.roots, f.control.rootCallbacks, f.control.rootsClosed]
    let rootActive = false, prepared = false
    const preparationScopes: boolean[] = [], rootSources: string[] = []
    const root = f.persistence.readSnapshotRoot
    f.persistence.readSnapshotRoot = (work, options) => root(async () => {
      rootActive = true
      rootSources.push(digestSfValue(f.persistence.currentSnapshots()?.planner.sfSources))
      try { return await work() }
      finally {
        rootSources.push(digestSfValue(f.persistence.currentSnapshots()?.planner.sfSources))
        rootActive = false
      }
    }, options)
    let auxiliary: Awaited<ReturnType<typeof f.business.plannerProduct.issueSource>> | undefined
    f.control.coverage = async (call) => {
      if (prepared) return
      prepared = true
      preparationScopes.push(rootActive || f.persistence.currentSnapshots() !== undefined)
      auxiliary = await f.business.plannerProduct.issueSource("v1", call)
      if (auxiliary.status !== "ok") throw new Error("Actual auxiliary source preparation refused")
    }
    expect(await f.business.calculations.issue(mixed.calculation.target.runId, lease.call))
      .toEqual({ status: "ok", value: mixed.calculation })
    const after = await f.sources()
    expect(preparationScopes).toEqual([false])
    expect(auxiliary?.status).toBe("ok")
    expect(entries(after, "v1").length).toBeGreaterThan(0)
    expect(entries(after, "v0")).toEqual(cited)
    expect(rootSources).toHaveLength(2)
    expect(rootSources[0]).toBe(rootSources[1])
    expect(rootSources[0]).toBe(digestSfValue(after))
    expect([f.control.roots - counts[0]!, f.control.rootCallbacks - counts[1]!, f.control.rootsClosed - counts[2]!]).toEqual([1, 1, 1])
    expect(await f.business.plannerSources.resolveForecastSource(mixed.source.refId, lease.call))
      .toEqual({ status: "ok", value: { versionId: "v0", evidence: mixed.source } })
    expect((await f.business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally { f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)

test("the actual mixed producer admits both calculation siblings concurrently inside one owned root", async () => {
  const f = await calculationMixedFixture(2), together = gate()
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const references = f.inners.map((value) => value.calculation)
    const mixed = await f.produce(references)
    const roots = f.control.roots, completedRoots = f.control.rootsClosed
    let rootActive = false
    const root = f.persistence.readSnapshotRoot
    f.persistence.readSnapshotRoot = (work, options) => root(async () => {
      rootActive = true
      try { return await work() } finally { rootActive = false }
    }, options)
    const targets = new Set(references.map((ref) => ref.target.runId)), entered = new Set<string>(), finished = new Set<string>()
    const exactOwners: boolean[] = []
    const resolve = f.business.context.resolve
    f.business.context.resolve = async (ref, call) => {
      const first = rootActive && ref.kind === "calculation" && targets.has(ref.target.runId) && !entered.has(ref.target.runId)
      if (first && ref.kind === "calculation") {
        entered.add(ref.target.runId)
        exactOwners.push(call === lease.call && f.authority.host.requestFor(call) === lease.request &&
          f.persistence.currentSnapshots() !== undefined)
        if (entered.size === targets.size) together.release()
        await together.promise
      }
      const result = await resolve(ref, call)
      if (first && ref.kind === "calculation") finished.add(ref.target.runId)
      return result
    }
    expect(await f.business.calculations.issue(mixed.calculation.target.runId, lease.call))
      .toEqual({ status: "ok", value: mixed.calculation })
    expect([...entered].sort()).toEqual([...targets].sort())
    expect([...finished].sort()).toEqual([...targets].sort())
    expect(exactOwners).toEqual([true, true])
    expect(f.control.roots - roots).toBe(1)
    expect(f.control.rootsClosed - completedRoots).toBe(1)
    expect(f.persistence.currentSnapshots()).toBeUndefined()
    expect((await f.business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally { together.release(); f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)

test("a real mixed request with another Planner base preserves the complete unsupported producer", async () => {
  const f = await calculationMixedFixture()
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const other = await f.source("v1")
    const mixed = await f.produce([other])
    const roots = f.control.roots, coverage = f.control.coverageReads
    const before = await f.sources()
    let resultReads = 0
    const read = f.business.results.readForCalculation
    f.business.results.readForCalculation = async (...args) => { resultReads++; return read(...args) }
    expect(await f.business.calculations.issue(mixed.calculation.target.runId, lease.call))
      .toEqual({ status: "ok", value: mixed.calculation })
    expect(mixed.calculation.target.sourceRefs).toContainEqual(other)
    expect(resultReads).toBeGreaterThan(0)
    expect(f.control.coverageReads).toBeGreaterThan(coverage)
    expect(f.control.roots).toBe(roots)
    expect(await f.sources()).toEqual(before)
    expect((await f.business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally { f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)

test("a mixed preparation that changes its original Request cannot execute the producer as fallback", async () => {
  const f = await calculationMixedFixture(1)
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const inner = f.inners[0]
    if (!inner) throw new Error("Actual inner calculation unavailable")
    const mixed = await f.produce([inner.calculation])
    const roots = f.control.roots
    let resultReads = 0, preparations = 0
    const read = f.business.results.readForCalculation
    f.business.results.readForCalculation = async (...args) => { resultReads++; return read(...args) }
    f.control.coverage = async (call) => {
      preparations++
      const original = f.authority.host.requestFor(call)
      if (!original) throw new Error("Original Request unavailable")
      original.headers.set("x-mixed-preparation-changed", "1")
    }
    const result = await f.business.calculations.issue(mixed.calculation.target.runId, lease.call)
    expect(result.status).not.toBe("ok")
    expect(Object.hasOwn(result, "value")).toBe(false)
    expect(preparations).toBe(1)
    expect(resultReads).toBe(0)
    expect(f.control.roots).toBe(roots)
  } finally { f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)

test("a poisoned mixed replay cannot retry outside its owned root or publish a result", async () => {
  const f = await calculationMixedFixture(1)
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const inner = f.inners[0]
    if (!inner) throw new Error("Actual inner calculation unavailable")
    const mixed = await f.produce([inner.calculation])
    const roots = f.control.roots, closed = f.control.rootsClosed
    let rootActive = false, attempted = 0, swallowed = 0, afterPoisonOutside = 0
    const root = f.persistence.readSnapshotRoot
    f.persistence.readSnapshotRoot = (work, options) => root(async () => {
      rootActive = true
      try { return await work() } finally { rootActive = false }
    }, options)
    f.control.coverage = async () => {
      if (attempted && !rootActive) afterPoisonOutside++
      if (!rootActive || attempted) return
      attempted++
      try {
        await f.persistence.transaction("planner", async (snapshot) => {
          snapshot.data.mixedPoisonWrite = true
          return { commit: true, value: undefined }
        })
      } catch { swallowed++ }
    }
    const result = await f.business.calculations.issue(mixed.calculation.target.runId, lease.call)
    expect(result.status).not.toBe("ok")
    expect(Object.hasOwn(result, "value")).toBe(false)
    expect([attempted, swallowed, afterPoisonOutside]).toEqual([1, 1, 0])
    expect(f.control.roots - roots).toBe(1)
    expect(f.control.rootsClosed - closed).toBe(0)
    expect(await f.persistence.transaction("planner", async (snapshot) =>
      ({ commit: false, value: snapshot.data.mixedPoisonWrite }))).toBeUndefined()
  } finally { f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)

test("a mixed replay under a foreign C08 owner keeps its full producer without another root or warmup", async () => {
  const f = await calculationMixedFixture(1)
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const inner = f.inners[0]
    if (!inner) throw new Error("Actual inner calculation unavailable")
    const mixed = await f.produce([inner.calculation])
    const roots = f.control.roots, observedScopes: boolean[] = []
    f.control.coverage = async () => { observedScopes.push(f.persistence.currentSnapshots() !== undefined) }
    const result = await f.persistence.transaction("planner", async () => ({ commit: false,
      value: await f.business.calculations.issue(mixed.calculation.target.runId, lease.call) }))
    expect(result).toEqual({ status: "ok", value: mixed.calculation })
    expect(observedScopes.length).toBeGreaterThan(0)
    expect(observedScopes.every(Boolean)).toBe(true)
    expect(f.control.roots).toBe(roots)
    expect(f.persistence.currentSnapshots()).toBeUndefined()
  } finally { f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)
