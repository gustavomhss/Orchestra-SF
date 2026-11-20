import { expect, test } from "bun:test"
import type { AuthorizedCaseProjection } from "../../../../product/contracts/business-context.ts"
import type { DecisionCasePort, PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { prepareCaseReadBatch, observeCaseReadBatch } from "./case-read-batch-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

test("Planner case batching preserves every canonical source pass and full projection while reducing physical roots", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-canonical")
  try {
    const fixture = await prepareCaseReadBatch(deadline), measured = observeCaseReadBatch(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    const stateBefore = await fixture.authority.state.read(fixture.request(), "cases", (state) => state)
    const snapshotsBefore = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    let canonical: AuthorizedCaseProjection
    let originalCost: typeof measured.counts
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Original canonical case")
      originalCost = { ...measured.counts }
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const observed = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Batched canonical case")
    const batchedCost = { ...measured.counts }
    expect({ ...observed, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(observed.case).toEqual(fixture.initial)
    expect(observed.evidenceRefs).toEqual(fixture.refs)
    expect(batchedCost.roots).toBe(1)
    expect(batchedCost.physical).toBeLessThan(originalCost.physical)
    expect(batchedCost.sources).toBe(originalCost.sources)
    expect(batchedCost.sources).toBeGreaterThan(0)
    expect(batchedCost.sourcesInRoot).toBe(batchedCost.sources)
    expect(originalCost.sourcesInRoot).toBe(0)
    expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => state)).toEqual(stateBefore)
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(snapshotsBefore)
    observed.case.objective = "Caller-owned clone"
    measured.reset()
    const next = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Fresh next invocation")
    expect({ ...next, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(measured.counts.sources).toBe(originalCost.sources)
    expect(measured.counts.roots).toBe(1)
    expect(next.case).not.toBe(observed.case)
    console.log("SF_PLANNER_CASE_BATCH_COST:" + JSON.stringify({ canonical: originalCost, batched: batchedCost,
      equalCompleteProjection: true, freshSecondInvocation: true, unchangedProtectedState: true }))
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["source", "case", "day", "request", "input", "reader", "source-reader", "actor", "lease", "abort"] as const) {
  test("Planner case batching reopens " + boundary + " after the SQLite root has ended", async () => {
    const deadline = compositionTestDeadline("planner-case-batch-egress-" + boundary)
    try {
      const fixture = await prepareCaseReadBatch(deadline)
      const root = fixture.persistence.readSnapshotRoot
      if (!root) throw new Error("Real LocalStore read root unavailable")
      let reached = 0
      fixture.persistence.readSnapshotRoot = async (work, options) => {
        const value = await root(work, options)
        expect(fixture.store.currentSnapshots()).toBeUndefined()
        reached++
        if (boundary === "source" || boundary === "case") await fixture.store.transaction(boundary === "source" ? "planner" : "dashboard", async (snapshot) => {
          if (boundary === "source") {
            const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
            versions[0]!.lines[0]!.f[0] = 101
          } else (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Committed at egress"
          return { commit: true, value: undefined }
        })
        if (boundary === "day") fixture.clock.at = "2026-11-15T00:00:00Z"
        if (boundary === "request") fixture.authority.host.requestFor(fixture.call)!.headers.set("x-case-egress", "changed")
        if (boundary === "input") fixture.argument.caseRef = encodeCaseRef({ id: "other", incarnation: "other-incarnation" })
        if (boundary === "reader") fixture.business.evidence.current = undefined
        if (boundary === "source-reader") {
          const original = fixture.business.plannerSources.resolveForecastSource
          fixture.business.plannerSources.resolveForecastSource = (...args) => original(...args)
        }
        if (boundary === "actor") fixture.active.value = false
        if (boundary === "lease") fixture.authority.ui.finish(fixture.call)
        if (boundary === "abort") fixture.cancellation.abort(new Error("Real request cancelled at egress"))
        return value
      }
      deadline.own(() => { fixture.persistence.readSnapshotRoot = root })
      const result = await fixture.business.cases.read(fixture.argument, fixture.call)
      expect(reached).toBe(1)
      expect(result).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
      expect(Object.hasOwn(result, "value")).toBe(false)
    } finally { await deadline.close() }
  }, 120_000)
}

test("A caught nested write poisons the physical Planner read and never retries canonical work", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-writer")
  try {
    const fixture = await prepareCaseReadBatch(deadline)
    const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    let canonical = 0, attempted = 0, caught = false
    const read = fixture.batch(async (...args) => {
      canonical++
      const result = await fixture.business.cases.read(...args)
      expect(result.status).toBe("ok")
      attempted++
      try {
        await fixture.persistence.transaction("planner", async (snapshot) => {
          snapshot.data.unrequestedWrite = "must never commit"
          return { commit: true, value: undefined }
        })
      } catch { caught = true }
      return result
    })
    expect(await read(fixture.argument, fixture.call)).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
    expect(canonical).toBe(1)
    expect(attempted).toBe(1)
    expect(caught).toBe(true)
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

test("An overlapping caller cannot enter the same Planner read owner and the next call starts fresh", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-overlap")
  try {
    const fixture = await prepareCaseReadBatch(deadline)
    const other = await fixture.read()
    deadline.own(() => fixture.authority.ui.finish(other))
    const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    let canonical = 0
    const read = fixture.batch(async (...args) => {
      canonical++
      const result = await fixture.business.cases.read(...args)
      reached.resolve()
      await release.promise
      return result
    })
    const pending = read(fixture.argument, fixture.call)
    let independent: ReturnType<DecisionCasePort["read"]> | undefined
    try {
      await Promise.race([reached.promise, pending.then(() => { throw new Error("Canonical read did not reach the physical root") })])
      expect(await read(fixture.argument, fixture.call)).toEqual({ status: "denied", reason: "planner-case-invocation-unavailable" })
      expect(canonical).toBe(1)
      independent = read(fixture.argument, other)
    } finally { release.resolve() }
    expect((await pending).status).toBe("ok")
    expect((await independent)?.status).toBe("ok")
    expect((await read(fixture.argument, fixture.call)).status).toBe("ok")
    expect(canonical).toBe(3)
  } finally { await deadline.close() }
}, 120_000)


for (const changeChild of [false, true]) {
  test("A nested canonical Planner read keeps its argument pinned through fresh egress: " + changeChild, async () => {
    const deadline = compositionTestDeadline("planner-case-batch-nested-" + changeChild)
    try {
      const fixture = await prepareCaseReadBatch(deadline)
      const child = { ...fixture.argument }
      const root = fixture.persistence.readSnapshotRoot
      if (!root) throw new Error("Real LocalStore read root unavailable")
      fixture.persistence.readSnapshotRoot = async (work, options) => {
        const result = await root(work, options)
        expect(fixture.store.currentSnapshots()).toBeUndefined()
        if (changeChild) child.caseRef = encodeCaseRef({ id: "other", incarnation: "other-incarnation" })
        return result
      }
      deadline.own(() => { fixture.persistence.readSnapshotRoot = root })
      let canonical = 0
      const read: DecisionCasePort["read"] = fixture.batch(async (...args) => {
        canonical++
        const result = await fixture.business.cases.read(...args)
        if (canonical === 1) {
          const nested = await read(child, fixture.call)
          const first = ok(result, "Original canonical read"), second = ok(nested, "Nested canonical read")
          expect({ ...second, checkedAt: first.checkedAt }).toEqual(first)
        }
        return result
      })
      const result = await read(fixture.argument, fixture.call)
      expect(canonical).toBe(2)
      if (changeChild) expect(result).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
      else expect(ok(result, "Completed independent canonical passes").case).toEqual(fixture.initial)
    } finally { await deadline.close() }
  }, 120_000)
}

test("A nested foreign call cannot borrow the Planner owner even when its refusal is caught", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-foreign")
  try {
    const fixture = await prepareCaseReadBatch(deadline), other = await fixture.read()
    deadline.own(() => fixture.authority.ui.finish(other))
    let canonical = 0
    const read: DecisionCasePort["read"] = fixture.batch(async (...args) => {
      canonical++
      const result = await fixture.business.cases.read(...args)
      expect((await read(fixture.argument, other))).toEqual({ status: "denied", reason: "planner-case-invocation-unavailable" })
      return result
    })
    expect(await read(fixture.argument, fixture.call)).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
    expect(canonical).toBe(1)
    expect(await fixture.authority.host.revalidate(other)).toBe(true)
  } finally { await deadline.close() }
}, 120_000)

test("A detached canonical child cannot outlive the physical Planner owner", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-detached")
  const release = Promise.withResolvers<void>()
  let detached: ReturnType<DecisionCasePort["read"]> | undefined
  try {
    const fixture = await prepareCaseReadBatch(deadline), reached = Promise.withResolvers<void>()
    let canonical = 0
    const read: DecisionCasePort["read"] = fixture.batch(async (...args) => {
      canonical++
      const position = canonical
      const result = await fixture.business.cases.read(...args)
      if (position === 1) {
        detached = read({ ...fixture.argument }, fixture.call)
        await reached.promise
      } else {
        reached.resolve()
        await release.promise
      }
      return result
    })
    expect(await read(fixture.argument, fixture.call)).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
    expect(canonical).toBe(2)
  } finally {
    release.resolve()
    if (detached) expect(await detached).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
    await deadline.close()
  }
}, 120_000)

test("An unmaterialized current Planner scope falls through before canonical work and retains actual C02 behavior", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-unmaterialized")
  try {
    const fixture = await prepareCaseReadBatch(deadline), measured = observeCaseReadBatch(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    // This guard owns the Planner adapter only. Its fallback still uses the
    // actual case reader; other composed batch adapters cannot add probe roots.
    const plannerOnly = fixture.batch(async (...args) => {
      const available = fixture.persistence.readSnapshotRoot
      try {
        fixture.persistence.readSnapshotRoot = undefined
        return await fixture.business.cases.read(...args)
      } finally { fixture.persistence.readSnapshotRoot = available }
    })
    const protectedBefore = await fixture.authority.state.read(fixture.request(), "cases", (state) => state)
    const currentScopes = () => fixture.store.transaction("planner", async (snapshot) => ({ commit: false,
      value: Object.values(snapshot.sfSources!.scopes!).filter((entry) => entry.scope.recordType === "planner-version" &&
        entry.scope.recordId === fixture.refs[0]!.target.recordId) }))
    const clearScope = () => fixture.store.transaction("planner", async (snapshot) => {
      const entries = snapshot.sfSources!.scopes!
      const keys = Object.keys(entries).filter((key) => entries[key]!.scope.recordType === "planner-version" &&
        entries[key]!.scope.recordId === fixture.refs[0]!.target.recordId)
      expect(keys).toHaveLength(1)
      delete entries[keys[0]!]
      return { commit: true, value: undefined }
    })
    let canonical: Awaited<ReturnType<DecisionCasePort["read"]>>
    try {
      fixture.persistence.readSnapshotRoot = undefined
      await clearScope()
      const missing = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
      canonical = await plannerOnly(fixture.argument, fixture.call)
      // BCS checks the captured scope before reaching the source issuer. A
      // missing access binding cannot be silently recreated by reading a case.
      expect(await currentScopes()).toEqual([])
      expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(missing)
    } finally { fixture.persistence.readSnapshotRoot = root }
    expect(canonical.status).not.toBe("ok")
    expect(canonical).toEqual({ status: "unavailable", reason: "case-evidence-unavailable" })
    // Reissue through the real authenticated producer before clearing again.
    // The new scope must not make the case's old captured selector valid.
    const controlSource = ok(await fixture.business.plannerProduct.issueSource(fixture.refs[0]!.target.recordId, fixture.call), "Reissue canonical control source")
    expect(controlSource.evidence.target.incarnation).not.toBe(fixture.refs[0]!.target.incarnation)
    expect(await plannerOnly(fixture.argument, fixture.call)).toEqual(canonical)
    await clearScope()
    const missing = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    measured.reset()
    const result = await plannerOnly(fixture.argument, fixture.call)
    expect(result).toEqual(canonical)
    expect(measured.counts.roots).toBe(1)
    expect(measured.counts.sources).toBeGreaterThan(0)
    expect(measured.counts.sourcesInRoot).toBe(0)
    expect(await currentScopes()).toEqual([])
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(missing)
    const issued = ok(await fixture.business.plannerProduct.issueSource(fixture.refs[0]!.target.recordId, fixture.call), "Reissue observed source")
    const restored = await currentScopes()
    expect(restored).toHaveLength(1)
    expect(restored[0]!.alive).toBe(true)
    expect(restored[0]!.incarnation).not.toBe(fixture.refs[0]!.target.incarnation)
    expect(restored[0]!.incarnation).toBe(issued.evidence.target.incarnation)
    expect(issued.evidence.target.incarnation).not.toBe(controlSource.evidence.target.incarnation)
    expect(await plannerOnly(fixture.argument, fixture.call)).toEqual(canonical)
    expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => state)).toEqual(protectedBefore)
  } finally { await deadline.close() }
}, 120_000)

test("The Planner-only adapter keeps mixed sources on its full canonical fallback", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-mixed")
  try {
    const fixture = await prepareCaseReadBatch(deadline, true), measured = observeCaseReadBatch(fixture, deadline)
    // The production composition also has a separate mixed physical adapter.
    // Isolate this Planner-only admission against the real canonical fallback;
    // no source reader or assertion is replaced by that control.
    const plannerOnly = fixture.batch(async (...args) => {
      const available = fixture.persistence.readSnapshotRoot
      try {
        fixture.persistence.readSnapshotRoot = undefined
        return await fixture.business.cases.read(...args)
      } finally { fixture.persistence.readSnapshotRoot = available }
    })
    expect(fixture.companion?.target.surface).toBe("procurement")
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    let canonical: AuthorizedCaseProjection, originalSources: number
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await plannerOnly(fixture.argument, fixture.call), "Original mixed case")
      originalSources = measured.counts.sources
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const result = ok(await plannerOnly(fixture.argument, fixture.call), "Canonical mixed fallback")
    expect({ ...result, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(result.case).toEqual(fixture.initial)
    expect(measured.counts.sources).toBe(originalSources)
    expect(measured.counts.sourcesInRoot).toBe(0)
    expect(measured.counts.roots).toBe(1)
    fixture.authority.ui.finish(fixture.call)
    const refused = await plannerOnly(fixture.argument, fixture.call)
    expect(refused.status).not.toBe("ok")
    expect(Object.hasOwn(refused, "value")).toBe(false)
  } finally { await deadline.close() }
}, 120_000)

