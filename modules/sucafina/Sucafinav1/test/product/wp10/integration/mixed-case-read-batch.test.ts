import { expect, test } from "bun:test"
import type { AuthorizedCaseProjection } from "../../../../product/contracts/business-context.ts"
import type { DecisionCasePort, PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { object } from "../../../../runtime/contract.ts"
import { prepareCaseReadBatch, observeCaseReadBatch, selectCaseReadBatchPeriod } from "./case-read-batch-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

test("Mixed case batching keeps all Planner and Procurement producers while reducing physical roots", async () => {
  const deadline = compositionTestDeadline("mixed-case-batch-canonical")
  try {
    const fixture = await prepareCaseReadBatch(deadline, true), measured = observeCaseReadBatch(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    const stateBefore = await fixture.authority.state.read(fixture.request(), "cases", (state) => state)
    const snapshotsBefore = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    let canonical: AuthorizedCaseProjection, originalCost: typeof measured.counts
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Original mixed case")
      originalCost = { ...measured.counts }
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const observed = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Qualified mixed case")
    const batchedCost = { ...measured.counts }
    expect({ ...observed, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(observed.case).toEqual(fixture.initial)
    expect(observed.evidenceRefs).toEqual([...fixture.refs, fixture.companion!])
    expect(batchedCost.roots).toBeGreaterThan(0)
    expect(batchedCost.physical).toBeLessThan(originalCost.physical)
    expect(batchedCost.sources).toBe(originalCost.sources)
    expect(batchedCost.procurementSources).toBe(originalCost.procurementSources)
    expect(batchedCost.sources).toBeGreaterThan(0)
    expect(batchedCost.procurementSources).toBeGreaterThan(0)
    expect(batchedCost.sourcesInRoot).toBe(batchedCost.sources)
    expect(batchedCost.procurementInRoot).toBe(batchedCost.procurementSources)
    expect(originalCost.sourcesInRoot).toBe(0)
    expect(originalCost.procurementInRoot).toBe(0)
    expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => state)).toEqual(stateBefore)
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(snapshotsBefore)
    observed.case.objective = "Caller-owned mixed projection"
    measured.reset()
    const next = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Fresh mixed invocation")
    expect({ ...next, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(measured.counts.sources).toBe(originalCost.sources)
    expect(measured.counts.procurementSources).toBe(originalCost.procurementSources)
    expect(next.case).not.toBe(observed.case)
    console.log("SF_MIXED_CASE_BATCH_COST:" + JSON.stringify({ canonical: originalCost, batched: batchedCost,
      equalCompleteProjection: true, bothSourceProducersRetained: true, unchangedProtectedState: true, freshSecondInvocation: true }))
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["planner-source", "procurement-source", "case", "currency", "selection", "reader", "issuance-reader", "preparation-reader", "continuity-reader", "actor", "lease", "request", "abort"] as const) {
  test("Mixed case batching rejects " + boundary + " changes after its physical root", async () => {
    const deadline = compositionTestDeadline("mixed-case-batch-egress-" + boundary)
    try {
      const fixture = await prepareCaseReadBatch(deadline, true), measured = observeCaseReadBatch(fixture, deadline)
      const root = fixture.persistence.readSnapshotRoot
      if (!root) throw new Error("Real LocalStore read root unavailable")
      const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
      let reached = 0
      fixture.persistence.readSnapshotRoot = async (work, options) => {
        const initialReads = measured.counts.procurementSources
        const result = await root(work, options)
        // Observe the actual Procurement producer, not the private batch result
        // shape. The preceding Planner-only admission performs no canonical read.
        if (measured.counts.procurementSources === initialReads) return result
        expect(fixture.store.currentSnapshots()).toBeUndefined()
        reached++
        if (boundary === "planner-source" || boundary === "procurement-source" || boundary === "case" || boundary === "currency") {
          const surface = boundary === "planner-source" ? "planner" : boundary === "case" ? "dashboard" : "procurement"
          await fixture.store.transaction(surface, async (snapshot) => {
            if (boundary === "planner-source") {
              const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
              versions[0]!.lines[0]!.f[0] = 101
            }
            if (boundary === "case") (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Committed mixed case change"
            if (boundary === "procurement-source") {
              const request = object(object(object(snapshot.data.store).requests)["MIXED-1"]).request
              object(object(request).pr).estAmount = 141
            }
            if (boundary === "currency") object(object(snapshot.data.store).settings).currency = "EUR"
            return { commit: true, value: undefined }
          })
        }
        if (boundary === "selection") {
          // A genuine new human selection replaces the previous private owner.
          // Equal period/data does not let the old read borrow the new lease.
          await selectCaseReadBatchPeriod(fixture, fixture.initial.horizon)
          expect(await fixture.authority.host.revalidate(fixture.call)).toBe(true)
          expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(before)
        }
        if (boundary === "reader") {
          const original = fixture.business.individual.resolve
          fixture.business.individual.resolve = (...args) => original(...args)
        }
        if (boundary === "issuance-reader") {
          const original = fixture.business.individual.issueForActor
          fixture.business.individual.issueForActor = (...args) => original(...args)
        }
        if (boundary === "preparation-reader") {
          const original = fixture.business.individual.resolveForPreparation
          fixture.business.individual.resolveForPreparation = (...args) => original(...args)
        }
        if (boundary === "continuity-reader") {
          const original = fixture.business.procurementDecisions.proveContinuity
          fixture.business.procurementDecisions.proveContinuity = (...args) => original(...args)
        }
        if (boundary === "actor") fixture.active.value = false
        if (boundary === "lease") fixture.authority.ui.finish(fixture.call)
        if (boundary === "request") fixture.authority.host.requestFor(fixture.call)!.headers.set("x-mixed-egress", "changed")
        if (boundary === "abort") fixture.cancellation.abort(new Error("Actual mixed request cancelled"))
        return result
      }
      deadline.own(() => { fixture.persistence.readSnapshotRoot = root })
      const result = await fixture.business.cases.read(fixture.argument, fixture.call)
      expect(reached).toBe(1)
      expect(result).toEqual({ status: "unavailable", reason: "mixed-case-observation-changed" })
      expect(Object.hasOwn(result, "value")).toBe(false)
    } finally { await deadline.close() }
  }, 120_000)
}

test("An unexpected Procurement write cannot escape the mixed read root or trigger canonical retry", async () => {
  const deadline = compositionTestDeadline("mixed-case-batch-write")
  try {
    const fixture = await prepareCaseReadBatch(deadline, true), measured = observeCaseReadBatch(fixture, deadline)
    const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const source = fixture.business.individual.resolve
    let attempts = 0, caught = false
    fixture.business.individual.resolve = async (...args) => {
      const result = await source(...args)
      if (attempts === 0) {
        attempts++
        expect(fixture.store.currentSnapshots()).toBeDefined()
        try {
          await fixture.persistence.transaction("procurement", async (snapshot) => {
            snapshot.data.unrequestedWrite = "must never commit"
            return { commit: true, value: undefined }
          })
        } catch { caught = true }
      }
      return result
    }
    deadline.own(() => { fixture.business.individual.resolve = source })
    measured.reset()
    const result = await fixture.business.cases.read(fixture.argument, fixture.call)
    expect(result).toEqual({ status: "unavailable", reason: "mixed-case-observation-changed" })
    expect(attempts).toBe(1)
    expect(caught).toBe(true)
    expect(measured.counts.procurementSources).toBeGreaterThan(0)
    expect(measured.counts.procurementInRoot).toBe(measured.counts.procurementSources)
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

test("An unmaterialized Procurement scope retains the original canonical producer outside the mixed batch", async () => {
  const deadline = compositionTestDeadline("mixed-case-batch-unmaterialized")
  try {
    const fixture = await prepareCaseReadBatch(deadline, true), measured = observeCaseReadBatch(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root || !fixture.companion) throw new Error("Real mixed source and read root required")
    const clearScope = () => fixture.store.transaction("procurement", async (snapshot) => {
      const entries = snapshot.sfSources!.scopes!
      const keys = Object.keys(entries).filter((key) => entries[key]!.scope.recordType === "procurement-request" &&
        entries[key]!.scope.recordId === fixture.companion!.target.recordId)
      for (const key of keys) delete entries[key]
      return { commit: true, value: keys.length }
    })
    const currentScopes = () => fixture.store.transaction("procurement", async (snapshot) => ({ commit: false,
      value: Object.values(snapshot.sfSources!.scopes!).filter((entry) => entry.scope.recordType === "procurement-request" &&
        entry.scope.recordId === fixture.companion!.target.recordId && entry.alive).length }))
    let canonical: Awaited<ReturnType<DecisionCasePort["read"]>>, canonicalScopes: number
    try {
      fixture.persistence.readSnapshotRoot = undefined
      expect(await clearScope()).toBeGreaterThan(0)
      canonical = await fixture.business.cases.read(fixture.argument, fixture.call)
      canonicalScopes = await currentScopes()
    } finally { fixture.persistence.readSnapshotRoot = root }
    await clearScope()
    measured.reset()
    expect(await fixture.business.cases.read(fixture.argument, fixture.call)).toEqual(canonical)
    expect(measured.counts.procurementSources).toBeGreaterThan(0)
    expect(measured.counts.procurementInRoot).toBe(0)
    expect(measured.counts.sourcesInRoot).toBe(0)
    expect(await currentScopes()).toBe(canonicalScopes)
  } finally { await deadline.close() }
}, 120_000)
