import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { DecisionCasePort, PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createDashboardSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createSfDashboardCaseReadBatch } from "../../../../../../../apps/cli/src/sucafina-product/dashboard-case-read-batch.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

async function prepare(deadline: ReturnType<typeof compositionTestDeadline>, signals = false) {
  const cancellation = new AbortController()
  const fixture = await financialCompositionFixture({ clock: { at: "2027-01-15T12:00:00.000Z" },
    signal: AbortSignal.any([deadline.signal, cancellation.signal]), beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "dashboard-companion", name: "Recorded service", year: 2027, closed: 0,
      lines: [{ id: "line", name: "Service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  await fixture.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.projects = [
      { id: "delivery", name: "Shared delivery name", status: "Planning", risk: "Low", budget: 0, spent: 0, pct: 0,
        milestones: [{ id: "release", name: "Delivery checkpoint", date: "2027-05-15", status: "upcoming" }] },
      { id: "homonym", name: "Shared delivery name", status: "Planning", risk: "Low", budget: 0, spent: 0, pct: 0, milestones: [] },
    ]
    snapshot.data.capexProjects = [{ id: "investment", name: "Shared delivery name", year: 2027, ownerId: "person" }]
    snapshot.data.capexEntries = []
    if (signals) snapshot.data.risks = [{ id: "batch-risk", title: "Actual delivery risk", impact: 5, probability: 5,
      status: "open", due: "2027-01-10" }]
    return { commit: true, value: undefined }
  })
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const planner = ok(await fixture.business.plannerProduct.issueSource("dashboard-companion", call), "Actual Planner companion").evidence
  const pageSelection = ok(await createDashboardSourceIssuer({ host: fixture.business.host, scopedSources: fixture.persistence })({
    page: signals ? "Executive Dashboard" : "Portfolio Dashboard", fields: [signals ? "signals" : "milestoneDates"], period }, call),
  "Actual Dashboard page")
  const page = pageSelection.evidence
  // The real page reader materializes its risk signal before the case is saved.
  // Later comparisons start from the same physical source closure.
  const warmed = signals ? ok(await fixture.business.dashboard.read({ selectionRef: pageSelection.selectionRef,
    fields: ["signals"], period }, call), "Actual signal source materialization") : undefined
  const records: Extract<BusinessEvidenceRef, { kind: "record" }>[] = []
  for (const selection of [{ page: "Portfolio Dashboard", recordType: "projects", recordId: "delivery" },
    { page: "Portfolio Dashboard", recordType: "projects", recordId: "homonym" },
    { page: "CAPEX Projects", recordType: "capexProjects", recordId: "investment" }])
    records.push(ok(await fixture.business.dashboardRecords.issue({ ...selection, fields: ["name"], period }, call), "Actual Dashboard record"))
  const refs = [planner, page, ...records]
  const caseRef = { id: "dashboard-batch-case", incarnation: "dashboard-batch-incarnation", version: 1 }
  // Real C08 admission owns an empty case; all five C02 references above came
  // from their original issuers. No result, coverage or reader is substituted.
  const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Read actual dependency sources", currency: "USD",
    horizon: period, criteria: [{ id: "cost", description: "Preserve exact source provenance", required: true }],
    participants: ["person"], sourceRefs: refs, alternatives: [], costCoverageBases: [], assumptions: [],
    questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  ok(await fixture.authority.state.transaction(fixture.request("dashboard-batch-case"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "dashboard-batch-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  }), "Actual C08 case creation")
  const batch = (read: DecisionCasePort["read"]) => createSfDashboardCaseReadBatch({
    host: fixture.business.host, state: fixture.authority.state, read, sources: fixture.business.plannerSources,
    readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences,
    dashboard: { port: fixture.business.dashboard, sources: fixture.business.dashboardSources,
      records: fixture.business.dashboardRecords, scopedSources: fixture.persistence,
      readerIdentity: () => [fixture.business.dashboardDecisions, fixture.business.dashboardDecisions.resolveEvidence,
        fixture.business.dashboardDecisions.proveContinuity] },
  })
  return { ...fixture, cancellation, call, caseRef, refs, initial, batch, warmed, argument: { caseRef: encodeCaseRef(caseRef) } }
}

function observations(fixture: Awaited<ReturnType<typeof prepare>>, deadline: ReturnType<typeof compositionTestDeadline>) {
  const counts = { physical: 0, roots: 0, transactions: 0, planner: 0, page: 0, record: 0,
    scoped: 0, issued: 0, plannerInRoot: 0, pageInRoot: 0, recordInRoot: 0, scopedInRoot: 0, issuedInRoot: 0 }
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const planner = fixture.business.plannerSources.resolveForecastSource
  const page = fixture.business.dashboardSources.resolveDashboardSource
  const record = fixture.business.dashboardRecords.read, issue = fixture.business.dashboardRecords.issue
  const scoped = fixture.persistence.resolveScopedSource
  fixture.store.transaction = (surface, work, options) => {
    counts.transactions++
    if (!fixture.store.currentSnapshots()) counts.physical++
    return transaction(surface, work, options)
  }
  fixture.store.transactionAll = (work, options) => { counts.physical++; return all(work, options) }
  fixture.store.readSnapshotRoot = (work, options) => { counts.physical++; counts.roots++; return root(work, options) }
  fixture.business.plannerSources.resolveForecastSource = (...args) => {
    counts.planner++; if (fixture.store.currentSnapshots()) counts.plannerInRoot++
    return planner(...args)
  }
  fixture.business.dashboardSources.resolveDashboardSource = (...args) => {
    counts.page++; if (fixture.store.currentSnapshots()) counts.pageInRoot++
    return page(...args)
  }
  fixture.business.dashboardRecords.read = (...args) => {
    counts.record++; if (fixture.store.currentSnapshots()) counts.recordInRoot++
    return record(...args)
  }
  fixture.business.dashboardRecords.issue = (...args) => {
    counts.issued++; if (fixture.store.currentSnapshots()) counts.issuedInRoot++
    return issue(...args)
  }
  fixture.persistence.resolveScopedSource = (...args) => {
    counts.scoped++; if (fixture.store.currentSnapshots()) counts.scopedInRoot++
    return scoped(...args)
  }
  deadline.own(() => {
    fixture.store.transaction = transaction; fixture.store.transactionAll = all; fixture.store.readSnapshotRoot = root
    fixture.business.plannerSources.resolveForecastSource = planner; fixture.business.dashboardSources.resolveDashboardSource = page
    fixture.business.dashboardRecords.read = record; fixture.business.dashboardRecords.issue = issue
    fixture.persistence.resolveScopedSource = scoped
  })
  return { counts, reset: () => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0 } }
}

test("Dashboard case batching preserves the real page and record callbacks and every byte of protected state", async () => {
  const deadline = compositionTestDeadline("dashboard-case-batch-canonical")
  try {
    const fixture = await prepare(deadline), measured = observations(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Actual LocalStore readonly root unavailable")
    const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    let canonical: AuthorizedCaseProjection, originalCost: typeof measured.counts
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Original Dashboard case")
      originalCost = { ...measured.counts }
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const observed = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Mounted Dashboard batch")
    const batchedCost = { ...measured.counts }
    expect({ ...observed, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(observed.case).toEqual(fixture.initial)
    expect(observed.evidenceRefs).toEqual(fixture.refs)
    expect(batchedCost.roots).toBeGreaterThan(0)
    expect(batchedCost.physical).toBeLessThan(originalCost.physical)
    for (const key of ["planner", "page", "record", "scoped"] as const) {
      expect(batchedCost[key]).toBe(originalCost[key])
      expect(batchedCost[key]).toBeGreaterThan(0)
    }
    expect(batchedCost.plannerInRoot).toBe(batchedCost.planner)
    expect(batchedCost.pageInRoot).toBe(batchedCost.page)
    expect(batchedCost.recordInRoot).toBe(batchedCost.record)
    expect(batchedCost.scopedInRoot).toBe(batchedCost.scoped)
    expect([originalCost.plannerInRoot, originalCost.pageInRoot, originalCost.recordInRoot, originalCost.scopedInRoot]).toEqual([0, 0, 0, 0])
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(before)
    observed.case.objective = "Caller-owned value"
    measured.reset()
    const next = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Independent Dashboard invocation")
    expect({ ...next, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(next.case).not.toBe(observed.case)
    expect(measured.counts.page).toBe(originalCost.page)
    expect(measured.counts.record).toBe(originalCost.record)
    console.log("SF_DASHBOARD_CASE_BATCH_COST:" + JSON.stringify({ canonical: originalCost, batched: batchedCost,
      completeProjectionEqual: true, currentDay: fixture.clock.at, unchangedC08AndC02: true, canonicalCallbacksPreserved: true }))
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["source", "case", "day", "record-reader", "scope-reader", "dashboard-evidence", "actor", "lease", "abort"] as const) {
  test("Dashboard batching rejects " + boundary + " drift after its physical root has closed", async () => {
    const deadline = compositionTestDeadline("dashboard-case-batch-egress-" + boundary)
    try {
      const fixture = await prepare(deadline)
      const root = fixture.persistence.readSnapshotRoot
      if (!root) throw new Error("Actual LocalStore readonly root unavailable")
      let reached = 0, canonical = 0
      fixture.persistence.readSnapshotRoot = async (work, options) => {
        const value = await root(work, options)
        expect(fixture.store.currentSnapshots()).toBeUndefined()
        reached++
        if (boundary === "source") await fixture.persistence.transaction("dashboard", async (snapshot) => {
          const projects = snapshot.data.projects as { id: string; name: string }[]
          projects.find((project) => project.id === "delivery")!.name = "Changed after the physical root"
          return { commit: true, value: undefined }
        })
        if (boundary === "case") await fixture.store.transaction("dashboard", async (snapshot) => {
          (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Committed at egress"
          return { commit: true, value: undefined }
        })
        if (boundary === "day") fixture.clock.at = "2027-01-16T00:00:00.000Z"
        if (boundary === "record-reader") {
          const original = fixture.business.dashboardRecords.read
          fixture.business.dashboardRecords.read = (...args) => original(...args)
        }
        if (boundary === "scope-reader") {
          const original = fixture.persistence.resolveScopedSource
          fixture.persistence.resolveScopedSource = (...args) => original(...args)
        }
        if (boundary === "dashboard-evidence") {
          const original = fixture.business.dashboardDecisions.resolveEvidence
          fixture.business.dashboardDecisions.resolveEvidence = (...args) => original(...args)
        }
        if (boundary === "actor") fixture.active.value = false
        if (boundary === "lease") fixture.authority.ui.finish(fixture.call)
        if (boundary === "abort") fixture.cancellation.abort(new Error("Actual Dashboard request cancelled at egress"))
        return value
      }
      deadline.own(() => { fixture.persistence.readSnapshotRoot = root })
      const read = fixture.batch(async (...args) => { canonical++; return fixture.business.cases.read(...args) })
      const result = await read(fixture.argument, fixture.call)
      expect(reached).toBe(1)
      expect(canonical).toBe(1)
      expect(result).toEqual({ status: "unavailable", reason: "dashboard-case-observation-changed" })
      expect(Object.hasOwn(result, "value")).toBe(false)
    } finally { await deadline.close() }
  }, 120_000)
}

test("Dashboard signal pages remain on the canonical path because their read can issue additional C02 records", async () => {
  const deadline = compositionTestDeadline("dashboard-case-batch-signal-fallback")
  try {
    const fixture = await prepare(deadline, true), measured = observations(fixture, deadline)
    expect(fixture.warmed?.values.some((value) => value.sourceRefs.some((ref) => ref.kind === "record" &&
      ref.target.recordType === "risks" && ref.target.recordId === "batch-risk"))).toBe(true)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Actual LocalStore readonly root unavailable")
    let canonical: AuthorizedCaseProjection, originalCost: typeof measured.counts
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Original signal page")
      originalCost = { ...measured.counts }
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const observed = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Canonical signal fallback")
    expect({ ...observed, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(observed.case).toEqual(fixture.initial)
    expect(measured.counts.page).toBe(originalCost.page)
    expect(measured.counts.record).toBe(originalCost.record)
    expect(measured.counts.page).toBeGreaterThan(0)
    expect(measured.counts.record).toBeGreaterThan(0)
    expect(measured.counts.issued).toBe(originalCost.issued)
    expect(measured.counts.issued).toBeGreaterThan(0)
    expect(measured.counts.issuedInRoot).toBe(0)
    expect(originalCost.issuedInRoot).toBe(0)
    expect(measured.counts.pageInRoot).toBe(0)
    expect(measured.counts.recordInRoot).toBe(0)
    fixture.authority.ui.finish(fixture.call)
    const denied = await fixture.business.cases.read(fixture.argument, fixture.call)
    expect(denied.status).not.toBe("ok")
    expect(Object.hasOwn(denied, "value")).toBe(false)
  } finally { await deadline.close() }
}, 120_000)
