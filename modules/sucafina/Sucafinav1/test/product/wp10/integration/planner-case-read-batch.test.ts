import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { DecisionCasePort, PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfPlannerCaseReadBatch } from "../../../../../../../apps/cli/src/sucafina-product/planner-case-read-batch.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

async function prepare(deadline: ReturnType<typeof compositionTestDeadline>, mixed = false) {
  const cancellation = new AbortController()
  const fixture = await financialCompositionFixture({ signal: AbortSignal.any([deadline.signal, cancellation.signal]),
    beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80, 120].map((amount, index) => ({ id: "source-" + index,
      name: "Recorded service " + index, year: 2026, closed: 0,
      lines: [{ id: "line", name: "Service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  await fixture.persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const refs: Extract<BusinessEvidenceRef, { kind: "record" }>[] = []
  for (const id of ["source-0", "source-1", "source-2"])
    refs.push(ok(await fixture.business.plannerProduct.issueSource(id, call), "Issue actual Planner source").evidence)
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const companion = mixed ? await procurementSource(fixture, call, period) : undefined
  const caseRef = { id: "read-batch-case", incarnation: "read-batch-case-incarnation", version: 1 }
  // Empty C08 case plus real C02 references: no financial result, coverage
  // assertion or canonical reader is replaced by this authority fixture.
  const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Read current recorded sources", currency: "USD",
    horizon: period, criteria: [{ id: "cost", description: "Preserve source provenance", required: true }],
    participants: ["person"], sourceRefs: [...refs, ...(companion ? [companion] : [])], alternatives: [], costCoverageBases: [],
    assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("batch-case-empty"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "batch-case-empty", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Actual case authority unavailable: " + JSON.stringify(seeded))
  const batch = (read: DecisionCasePort["read"]) => createSfPlannerCaseReadBatch({
    host: fixture.business.host, state: fixture.authority.state, read, sources: fixture.business.plannerSources,
    readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences,
  })
  return { ...fixture, cancellation, call, caseRef, refs, companion, initial, batch,
    argument: { caseRef: encodeCaseRef(caseRef) } }
}

function observations(fixture: Awaited<ReturnType<typeof prepare>>, deadline: ReturnType<typeof compositionTestDeadline>) {
  const counts = { physical: 0, roots: 0, transactions: 0, sources: 0, sourcesInRoot: 0 }
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const source = fixture.business.plannerSources.resolveForecastSource
  fixture.store.transaction = (surface, work, options) => {
    counts.transactions++
    if (!fixture.store.currentSnapshots()) counts.physical++
    return transaction(surface, work, options)
  }
  fixture.store.transactionAll = (work, options) => { counts.physical++; return all(work, options) }
  fixture.store.readSnapshotRoot = (work, options) => { counts.physical++; counts.roots++; return root(work, options) }
  fixture.business.plannerSources.resolveForecastSource = (...args) => {
    counts.sources++
    if (fixture.store.currentSnapshots()) counts.sourcesInRoot++
    return source(...args)
  }
  deadline.own(() => {
    fixture.store.transaction = transaction
    fixture.store.transactionAll = all
    fixture.store.readSnapshotRoot = root
    fixture.business.plannerSources.resolveForecastSource = source
  })
  return { counts, reset: () => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0 } }
}

test("Planner case batching preserves every canonical source pass and full projection while reducing physical roots", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-canonical")
  try {
    const fixture = await prepare(deadline), measured = observations(fixture, deadline)
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
      const fixture = await prepare(deadline)
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
    const fixture = await prepare(deadline)
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
    const fixture = await prepare(deadline)
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
      const fixture = await prepare(deadline)
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
    const fixture = await prepare(deadline), other = await fixture.read()
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
    const fixture = await prepare(deadline), reached = Promise.withResolvers<void>()
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
    const fixture = await prepare(deadline), measured = observations(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
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
      canonical = await fixture.business.cases.read(fixture.argument, fixture.call)
    } finally { fixture.persistence.readSnapshotRoot = root }
    expect(canonical.status).not.toBe("ok")
    await clearScope()
    measured.reset()
    const result = await fixture.business.cases.read(fixture.argument, fixture.call)
    expect(result).toEqual(canonical)
    expect(measured.counts.roots).toBe(1)
    expect(measured.counts.sources).toBeGreaterThan(0)
    expect(measured.counts.sourcesInRoot).toBe(0)
    const restored = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false,
      value: Object.values(snapshot.sfSources!.scopes!).filter((entry) => entry.scope.recordType === "planner-version" &&
        entry.scope.recordId === fixture.refs[0]!.target.recordId) }))
    expect(restored).toHaveLength(1)
    expect(restored[0]!.alive).toBe(true)
    expect(restored[0]!.incarnation).not.toBe(fixture.refs[0]!.target.incarnation)
  } finally { await deadline.close() }
}, 120_000)

test("Mixed Planner and Procurement sources keep the full canonical fallback and current authority", async () => {
  const deadline = compositionTestDeadline("planner-case-batch-mixed")
  try {
    const fixture = await prepare(deadline, true), measured = observations(fixture, deadline)
    expect(fixture.companion?.target.surface).toBe("procurement")
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    let canonical: AuthorizedCaseProjection, originalSources: number
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Original mixed case")
      originalSources = measured.counts.sources
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const result = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Canonical mixed fallback")
    expect({ ...result, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(result.case).toEqual(fixture.initial)
    expect(measured.counts.sources).toBe(originalSources)
    expect(measured.counts.sourcesInRoot).toBe(0)
    expect(measured.counts.roots).toBe(1)
    fixture.authority.ui.finish(fixture.call)
    const refused = await fixture.business.cases.read(fixture.argument, fixture.call)
    expect(refused.status).not.toBe("ok")
    expect(Object.hasOwn(refused, "value")).toBe(false)
  } finally { await deadline.close() }
}, 120_000)

async function procurementSource(fixture: Awaited<ReturnType<typeof financialCompositionFixture>>,
  call: Awaited<ReturnType<typeof fixture.read>>, period: { start: string; end: string }) {
  await fixture.persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", fxRates: [], minQuotes: 2, techWeight: 80, commWeight: 20,
      criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: [], requests: { "MIXED-1": { version: 1, by: "person", request: {
        number: "MIXED-1", status: "src_pending", createdBy: "person", createdAt: "2026-01-01T00:00:00.000Z",
        pr: { title: "Companion purchase source", type: "service", description: "Explicit source fixture", estAmount: 140,
          costCenter: "TEST", needBy: "2026-12-31", justification: "Observe the current mixed case", recurring: false },
        sourcing: { evaluator: "person", selectedId: null, approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, quotes: [] },
      } } } }
    return { commit: true, value: undefined }
  })
  const intent = { purpose: "work-selection", period }
  const selection = await fixture.authority.ui.admit(fixture.request(), "sf_work_list", digestSfValue(intent))
  if (selection.status !== "ok" || !await fixture.authority.ui.validate(selection.value, "sf_work_list", digestSfValue(intent)))
    throw new Error("Actual Procurement selection admission unavailable")
  try {
    const selected = await fixture.business.procurementSelections.create(selection.value, period)
    if (selected.status !== "ok") throw new Error("Actual Procurement period selection unavailable")
  } finally { fixture.authority.ui.finish(selection.value) }
  const issued = await fixture.business.individual.issue("procurement-request", "MIXED-1", call)
  if (issued.status !== "ok") throw new Error("Actual mixed source unavailable: " + issued.reason)
  const resolved = await fixture.business.individual.resolve(issued.value, call)
  if (resolved.status !== "ok") throw new Error("Actual mixed projection unavailable: " + resolved.reason)
  return resolved.value.evidence
}
