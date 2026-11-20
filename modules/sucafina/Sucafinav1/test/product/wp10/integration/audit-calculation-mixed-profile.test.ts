import { expect, test } from "bun:test"
import { c17MixedPoint, c17MixedSpan } from "../../../../runtime/audit-c17-mixed-profile.ts"
import { calculationMixedFixture } from "./calculation-mixed-fixture.ts"

// CI-only copy of the complete sibling test. Its original fixture, statements,
// callbacks, assertions and 120000ms budget remain; only numeric observers are added.
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test("the actual mixed producer admits both calculation siblings concurrently inside one owned root", async () => {
  const auditFixture = c17MixedSpan("siblings.fixture")
  const f = await calculationMixedFixture(2), together = gate()
  auditFixture()
  const lease = await f.admit("sf_scenario_simulate")
  try {
    const references = f.inners.map((value) => value.calculation)
    const auditProduce = c17MixedSpan("siblings.produce")
    const mixed = await f.produce(references)
    auditProduce()
    const roots = f.control.roots, completedRoots = f.control.rootsClosed
    let rootActive = false
    const root = f.persistence.readSnapshotRoot
    f.persistence.readSnapshotRoot = (work, options) => root(async () => {
      rootActive = true
      c17MixedPoint("siblings.root.enter")
      try { return await work() } finally { rootActive = false; c17MixedPoint("siblings.root.leave") }
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
        c17MixedPoint("siblings.barrier.enter")
        if (entered.size === targets.size) { together.release(); c17MixedPoint("siblings.barrier.release") }
        await together.promise
      }
      const result = await resolve(ref, call)
      if (first && ref.kind === "calculation") { finished.add(ref.target.runId); c17MixedPoint("siblings.barrier.complete") }
      return result
    }
    const auditIssue = c17MixedSpan("siblings.issue")
    expect(await f.business.calculations.issue(mixed.calculation.target.runId, lease.call))
      .toEqual({ status: "ok", value: mixed.calculation })
    auditIssue()
    expect([...entered].sort()).toEqual([...targets].sort())
    expect([...finished].sort()).toEqual([...targets].sort())
    expect(exactOwners).toEqual([true, true])
    expect(f.control.roots - roots).toBe(1)
    expect(f.control.rootsClosed - completedRoots).toBe(1)
    expect(f.persistence.currentSnapshots()).toBeUndefined()
    expect((await f.business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally { together.release(); f.authority.ui.finish(lease.call); await f.dispose() }
}, 120000)
