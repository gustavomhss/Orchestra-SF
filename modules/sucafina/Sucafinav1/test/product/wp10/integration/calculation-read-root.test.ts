import { expect, test } from "bun:test"
import { createSfPlannerCalculationRoot } from "../../../../../../../apps/cli/src/sucafina-product/planner-calculation-root.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import { calculationRootFixture } from "./calculation-root-fixture.ts"

// Real SQLite/C08 and admitted UI leases. Marker values test root ownership;
// calculation composition below uses only actual produced/persisted scenarios.
const refused = { status: "unavailable", reason: "calculation-read-root-unavailable" } as const
const marker = () => ({ status: "ok" as const, value: { marker: ["private"] } })

async function fixture(count = 0) {
  const value = await calculationRootFixture(count)
  const lease = await value.admit("sf_scenario_simulate")
  const configuration = { host: value.authority.host }
  const manager = createSfPlannerCalculationRoot(configuration)
  return { ...value, lease, configuration, manager,
    close: async () => { value.authority.ui.finish(lease.call); await value.dispose() } }
}
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test("a cold Planner source prepares before the witness and is re-read inside one accepted root", async () => {
  const f = await fixture()
  try {
    const identity = () => f.persistence.transaction("planner", async (snapshot) =>
      ({ commit: false, value: digestSfValue(snapshot.sfSources) }))
    const before = await identity()
    let initialized = 0, reference: string | undefined
    const preparationScopes: boolean[] = [], workScopes: boolean[] = []
    const prepared = await f.manager.prepare(f.lease.call, async () => {
      initialized++
      preparationScopes.push(f.persistence.currentSnapshots() !== undefined)
      const issued = await f.business.plannerProduct.issueSource("v0", f.lease.call)
      if (issued.status !== "ok") return false
      reference = issued.value.evidence.refId
      return true
    }, () => true)
    expect(prepared).toBeDefined()
    if (!prepared || !reference) throw new Error("Real source preparation failed")
    const baseline = await identity()
    expect(baseline).not.toBe(before)
    const selected = reference
    const observations: Awaited<ReturnType<typeof f.business.plannerSources.resolveForecastSource>>[] = []
    const result = await prepared.run(async () => {
      workScopes.push(f.persistence.currentSnapshots() !== undefined)
      const first = await f.business.plannerSources.resolveForecastSource(selected, f.lease.call)
      const second = await f.business.plannerSources.resolveForecastSource(selected, f.lease.call)
      observations.push(first, second)
      return second
    })
    expect(result.status).toBe("ok")
    expect(observations[1]).toEqual(observations[0])
    const observed = observations[1]
    if (!observed) throw new Error("Second actual source observation unavailable")
    expect(result).toEqual(observed)
    expect(await identity()).toBe(baseline)
    expect(preparationScopes).toEqual([false])
    expect(workScopes).toEqual([true])
    expect(initialized).toBe(1)
    expect([f.control.roots, f.control.rootCallbacks, f.control.rootsClosed]).toEqual([1, 1, 1])
    let repeated = false
    expect(await prepared.run(async () => { repeated = true; return marker() })).toEqual(refused)
    expect(repeated).toBe(false)
  } finally { await f.close() }
}, 120000)

test("a value stays private until the adapter accepts the root and is detached from the producer", async () => {
  const f = await fixture(), entered = gate(), release = gate()
  try {
    f.control.afterRoot = async () => { entered.release(); await release.promise }
    const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
    if (!prepared) throw new Error("Preparation unavailable")
    const produced = marker()
    let settled = false
    const pending = prepared.run(async () => produced).then((value) => { settled = true; return value })
    await entered.promise
    expect(settled).toBe(false)
    produced.value.marker.push("changed after callback")
    release.release()
    expect(await pending).toEqual(marker())
    expect(f.persistence.currentSnapshots()).toBeUndefined()
  } finally { release.release(); await f.close() }
}, 120000)

test("a swallowed nested write poisons the owned root and never retries the producer outside", async () => {
  const f = await fixture()
  try {
    let works = 0, swallowed = false
    const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
    if (!prepared) throw new Error("Preparation unavailable")
    const result = await prepared.run(async () => {
      works++
      try { await f.persistence.transaction("planner", async (snapshot) => {
        snapshot.data.forbiddenRootWrite = true
        return { commit: true, value: true }
      }) } catch { swallowed = true }
      return marker()
    })
    expect(result).toEqual(refused)
    expect(swallowed).toBe(true)
    expect(works).toBe(1)
    expect([f.control.roots, f.control.rootCallbacks, f.control.rootsClosed]).toEqual([1, 1, 0])
    expect(await f.persistence.transaction("planner", async (snapshot) =>
      ({ commit: false, value: snapshot.data.forbiddenRootWrite }))).toBeUndefined()
  } finally { await f.close() }
}, 120000)

test("a foreign C08 owner runs the original path without source preparation or a new root", async () => {
  const f = await fixture()
  try {
    let initialized = 0, works = 0
    const result = await f.persistence.transaction("planner", async () => {
      const prepared = await f.manager.prepare(f.lease.call, async () => { initialized++; return true }, () => true)
      if (!prepared) throw new Error("Foreign scope unavailable")
      return { commit: false, value: await prepared.run(async () => {
        works++
        return f.persistence.transaction("dashboard", async (snapshot) =>
          ({ commit: false, value: { status: "ok" as const, value: digestSfValue(snapshot) } }))
      }) }
    })
    expect(result.status).toBe("ok")
    expect(initialized).toBe(0)
    expect(works).toBe(1)
    expect(f.control.roots).toBe(0)
  } finally { await f.close() }
}, 120000)

test("a poisoned foreign root cannot become a fresh owned or legacy attempt", async () => {
  const f = await fixture()
  try {
    let initialized = 0, inside: unknown, outerRejected = false
    try { await f.persistence.transaction("planner", async () => {
      try { await f.persistence.transaction("dashboard", async () => ({ commit: true, value: true })) } catch {}
      inside = await f.manager.prepare(f.lease.call, async () => { initialized++; return true }, () => true)
      return { commit: false, value: inside }
    }) } catch { outerRejected = true }
    expect(inside).toBeUndefined()
    expect(outerRejected).toBe(true)
    expect(initialized).toBe(0)
    expect(f.control.roots).toBe(0)
  } finally { await f.close() }
}, 120000)

for (const boundary of ["headers", "request", "provider", "method", "owner", "abort", "authority"] as const) {
  test(`owned replay refuses ${boundary} changes after work without fallback`, async () => {
    const f = await fixture()
    try {
      let works = 0, owner = true
      const prepared = await f.manager.prepare(f.lease.call, async () => true, () => owner)
      if (!prepared) throw new Error("Preparation unavailable")
      const result = await prepared.run(async () => {
        works++
        if (boundary === "headers") f.lease.request.headers.set("x-changed", "1")
        if (boundary === "request") {
          const copy = new Request(f.lease.request)
          f.authority.host.requestFor = () => copy
        }
        if (boundary === "provider") f.authority.host.persistence = { ...f.persistence }
        if (boundary === "method") {
          const original = f.persistence.transaction
          f.persistence.transaction = (...args) => original(...args)
        }
        if (boundary === "owner") owner = false
        if (boundary === "abort") f.lease.controller.abort()
        if (boundary === "authority") f.control.active = false
        return marker()
      })
      expect(result).toEqual(refused)
      expect(works).toBe(1)
      expect(f.control.roots).toBe(1)
    } finally { await f.close() }
  }, 120000)
}

for (const boundary of ["no-callback", "twice", "after-callback-error"] as const) {
  test(`adapter ${boundary} cannot publish a staged replay`, async () => {
    const f = await fixture()
    try {
      const original = f.persistence.readSnapshotRoot
      f.persistence.readSnapshotRoot = async (work, options) => {
        if (boundary === "no-callback") return true as unknown as Awaited<ReturnType<typeof work>>
        return original(async () => {
          const result = await work()
          if (boundary === "twice") await work()
          if (boundary === "after-callback-error") throw new Error("Fixture adapter refused completion")
          return result
        }, options)
      }
      let works = 0
      const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
      if (!prepared) throw new Error("Preparation unavailable")
      expect(await prepared.run(async () => { works++; return marker() })).toEqual(refused)
      expect(works).toBe(boundary === "no-callback" ? 0 : 1)
    } finally { await f.close() }
  }, 120000)
}

test("different admitted calls cannot join a physical root and closed descendants cannot fall back", async () => {
  const f = await fixture(), released = gate()
  const second = await f.admit("sf_scenario_simulate")
  let escaped: Promise<unknown> | undefined
  try {
    const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
    if (!prepared) throw new Error("Preparation unavailable")
    let foreign: unknown, escapedAllowed: boolean | undefined, escapedInitialization = 0
    const result = await prepared.run(async () => {
      foreign = await f.manager.prepare(second.call, async () => true, () => true)
      escaped = (async () => {
        await released.promise
        escapedAllowed = f.manager.allows(f.lease.call)
        return f.manager.prepare(f.lease.call, async () => { escapedInitialization++; return true }, () => true)
      })()
      return marker()
    })
    expect(result).toEqual(marker())
    expect(foreign).toBeUndefined()
    released.release()
    expect(await escaped).toBeUndefined()
    expect(escapedAllowed).toBe(false)
    expect(escapedInitialization).toBe(0)
    expect(f.control.roots).toBe(1)
  } finally {
    released.release(); await escaped
    f.authority.ui.finish(second.call); await f.close()
  }
}, 120000)

test("two joined descendants execute their real transactions concurrently within one owner", async () => {
  const f = await fixture()
  try {
    let childPreparation = 0
    const entered = [gate(), gate()]
    const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
    if (!prepared) throw new Error("Preparation unavailable")
    const result = await prepared.run(async () => {
      const children = await Promise.all([0, 1].map(() =>
        f.manager.prepare(f.lease.call, async () => { childPreparation++; return true }, () => true)))
      const values = await Promise.all(children.map((child, index) => {
        if (!child) throw new Error("Joined descendant unavailable")
        return child.run(async () => {
          entered[index]!.release()
          await entered[1 - index]!.promise
          return f.persistence.transaction("planner", async (snapshot) =>
            ({ commit: false, value: { status: "ok" as const, value: digestSfValue(snapshot) } }))
        })
      }))
      return { status: "ok", value: values }
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value[0]).toEqual(result.value[1])
    expect(result.value.map((value) => value.status)).toEqual(["ok", "ok"])
    expect(childPreparation).toBe(0)
    expect([f.control.roots, f.control.rootCallbacks, f.control.rootsClosed]).toEqual([1, 1, 1])
  } finally { await f.close() }
}, 120000)

test("an unfinished descendant prevents its owner from publishing and loses access after close", async () => {
  const f = await fixture(), entered = gate(), released = gate()
  let child: Promise<unknown> | undefined
  try {
    const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
    if (!prepared) throw new Error("Preparation unavailable")
    const result = await prepared.run(async () => {
      const nested = await f.manager.prepare(f.lease.call, async () => true, () => true)
      if (!nested) throw new Error("Joined scope unavailable")
      child = nested.run(async () => { entered.release(); await released.promise; return marker() })
      await entered.promise
      return marker()
    })
    expect(result).toEqual(refused)
    released.release()
    expect(await child).toEqual(refused)
    expect(f.control.roots).toBe(1)
  } finally { released.release(); await child; await f.close() }
}, 120000)

test("a Request changed between preparation and the witness cannot enter an owned replay", async () => {
  const f = await fixture()
  try {
    let works = 0
    const prepared = await f.manager.prepare(f.lease.call, async () => true, () => true)
    if (!prepared) throw new Error("Preparation unavailable")
    f.lease.request.headers.set("x-after-prepare", "changed")
    expect(await prepared.run(async () => { works++; return marker() })).toEqual(refused)
    expect(works).toBe(0)
    expect(f.control.roots).toBe(0)
  } finally { await f.close() }
}, 120000)

test("the real calculation service keeps direct issues unscoped and joins a valid ancestral child", async () => {
  const f = await fixture(3), foreign = await f.admit("sf_scenario_simulate")
  try {
    const [first, second, third] = f.calculations
    if (!first || !second || !third) throw new Error("Actual calculations unavailable")
    const reads = f.business.results.readForCalculation
    let started = 0, completed = 0, step = 0
    let foreignResult: unknown
    const nested: PortResult<Extract<BusinessEvidenceRef, { kind: "calculation" }>>[] = []
    f.business.results.readForCalculation = async (...args) => {
      started++
      try { return await reads(...args) } finally { completed++ }
    }
    f.control.coverage = async (call) => {
      if (step === 0) {
        step = 1
        nested[0] = await f.business.calculations.issue(second.target.runId, call)
      } else if (step === 1 && f.persistence.currentSnapshots() !== undefined) {
        step = 2
        foreignResult = await f.business.calculations.issue(third.target.runId, foreign.call)
        nested[1] = await f.business.calculations.issue(third.target.runId, call)
      }
    }
    expect(await f.business.calculations.issue(first.target.runId, f.lease.call)).toEqual({ status: "ok", value: first })
    expect(nested).toEqual([{ status: "ok", value: second }, { status: "ok", value: third }])
    expect(foreignResult).toEqual(refused)
    expect(step).toBe(2)
    expect([started, completed]).toEqual([18, 18])
    expect([f.control.roots, f.control.rootCallbacks, f.control.rootsClosed]).toEqual([1, 1, 1])
    expect(f.persistence.currentSnapshots()).toBeUndefined()
    expect((await f.business.selectedCase(f.lease.call)).status).toBe("unavailable")
  } finally { f.authority.ui.finish(foreign.call); await f.close() }
}, 120000)

test("the real service refuses an escaped owned descendant before selecting a new route", async () => {
  const f = await fixture(2), released = gate()
  let escaped: ReturnType<typeof f.business.calculations.issue> | undefined
  try {
    const [first, second] = f.calculations
    if (!first || !second) throw new Error("Actual calculations unavailable")
    let step = 0, reads = 0
    const read = f.authority.state.read
    f.authority.state.read = (...args) => { reads++; return read(...args) }
    f.control.coverage = async (call) => {
      if (step === 0) {
        step = 1
        const result = await f.business.calculations.issue(second.target.runId, call)
        if (result.status !== "ok") throw new Error(result.reason)
      } else if (step === 1 && f.persistence.currentSnapshots() !== undefined) {
        step = 2
        escaped = (async () => { await released.promise; return f.business.calculations.issue(first.target.runId, call) })()
      }
    }
    expect(await f.business.calculations.issue(first.target.runId, f.lease.call)).toEqual({ status: "ok", value: first })
    expect(step).toBe(2)
    const completedReads = reads, completedRoots = f.control.roots
    released.release()
    expect(await escaped).toEqual(refused)
    expect(reads).toBe(completedReads)
    expect(f.control.roots).toBe(completedRoots)
    expect(completedRoots).toBe(1)
  } finally { released.release(); await escaped; await f.close() }
}, 120000)
