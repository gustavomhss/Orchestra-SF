import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { AuthorizedCaseProjection } from "../../../../product/contracts/business-context.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

// The only seeds are source rows and an empty case. C02 issuance, human
// classification and HTTP promotion produce every coverage/result/alternative.
async function prepare(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal,
      beforeEnvironment: async () => deadline.check() })
    deadline.own(() => value.dispose())
    return value
  })
  const horizon = { start: "2026-01-01", end: "2026-12-31" }
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80, 120].map((amount, index) => ({ id: "populated-source-" + index,
      name: "Recorded service " + index, year: 2026, closed: 0,
      lines: [{ id: "line", name: "Service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  await fixture.persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const sources = await deadline.phase("fixture.issue-and-project", async () => {
    const values = []
    for (const index of [0, 1, 2]) {
      const issued = ok(await fixture.business.plannerProduct.issueSource("populated-source-" + index, call), "Issue real C02 source")
      const projection = ok(await fixture.business.projectPlannerEvidence(issued.evidence, call, { period: horizon, currency: "USD" }),
        "Project actual Planner components")
      expect(projection.components).toHaveLength(12)
      const targets = projection.components.filter((component) => component.id === "line:1")
      expect(targets).toHaveLength(1)
      const target = targets[0]!
      if (target.amount === null || !Number.isFinite(target.amount) || target.evidenceState !== "confirmed" || !target.sourceRefs.length)
        throw new Error("The actual January source component is not confirmed")
      values.push({ evidence: issued.evidence, componentRefs: projection.components.map((component) => component.id),
        operation: { kind: "replace" as const, targetRef: target.id, amount: target.amount,
          currency: target.currency, period: target.period } })
    }
    return values
  })
  const initialRef = { id: "populated-case", incarnation: "populated-case-incarnation", version: 1 }
  const basis: BaselineCoverageRequest["basis"] = { id: "populated-renewal", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources.map((source) => source.evidence) }
  const initial: DecisionCase = { ...initialRef, state: "draft", objective: "Inspect actually promoted Planner alternatives",
    horizon, currency: "USD", participants: ["person"], criteria: [{ id: "cost", description: "Preserve pending cost categories", required: true }],
    sourceRefs: basis.sourceRefs, alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("populated-empty-case"), { namespace: "cases",
    expectedStorageVersion: 0, targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "populated-empty-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("The empty C08 fixture was not admitted")
  const classifications = []
  for (const [index, source] of sources.entries()) {
    const request: BaselineCoverageRequest = { caseRef: initialRef, source: source.evidence, basis, expectedVersion: 0,
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
        ? { categoryId, status: "included", componentRefs: source.componentRefs, evidenceRefs: [source.evidence],
          scopeNote: "Human classification of the observed license service components" }
        : { categoryId, status: "pending", reason: "No evidence has been supplied for this category" }) }
    classifications.push(await deadline.phase("fixture.coverage-" + index, async () => {
      const human = ok(await fixture.authority.human.admit(fixture.request("populated-coverage-" + index),
        "decisions.coverage", request), "Admit actual human coverage")
      try {
        return ok(await fixture.business.withCase(human, initialRef, {}, () => fixture.business.baselineCoverage.register(request, human)),
          "Register actual coverage")
      } finally { fixture.authority.human.finish(human) }
    }))
  }
  const http = fixture.portfolio.http({ origin: "https://example.test", mount: "/product" })
  let caseRef = initialRef
  const promotions = []
  for (const [index, source] of sources.entries()) {
    const request = { caseRef, title: "Promoted alternative " + index, scenario: { baseRef: source.evidence.refId,
      operations: [source.operation], assumptions: [] }, coverageRef: classifications[index]!.coverageRef }
    const receipt = await deadline.phase("fixture.promote-" + index, async () => {
      const response = await http(new Request("https://example.test/product/planner?sf=decision-promote", { method: "POST",
        signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json",
          "x-operation": "populated-promote-" + index }, body: JSON.stringify(request) }), "planner")
      if (!response) throw new Error("The real promotion route did not handle its own action")
      expect(response.status).toBe(200)
      return ok(await response.json() as PortResult<{ caseRef: typeof initialRef; resultRef?: string }>, "Promote actual scenario")
    })
    expect(receipt.caseRef).toEqual({ ...caseRef, version: caseRef.version + 1 })
    if (!receipt.resultRef) throw new Error("The actual promotion did not persist a C09 result")
    caseRef = receipt.caseRef
    promotions.push({ request, receipt })
  }
  const stored = await fixture.authority.state.read(fixture.request(), "cases", (state) =>
    ({ decision: state.cases[caseRef.id], results: state.decisionResults }))
  if (stored.status !== "ok" || !stored.value.decision) throw new Error("Promoted C08 state is unavailable")
  const decision = stored.value.decision
  expect(decision.version).toBe(4)
  expect(decision.alternatives).toHaveLength(3)
  expect(decision.choices).toEqual([])
  expect(decision.preparedChanges).toEqual([])
  expect(decision.receipts).toEqual([])
  for (const [index, promotion] of promotions.entries()) {
    const alternative = decision.alternatives[index]!
    expect(alternative.scenario).toEqual(promotion.request.scenario)
    expect(alternative.scenario.operations).toEqual([sources[index]!.operation])
    expect(alternative.result).toMatchObject({ total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(alternative.result.restrictions).toContain("preview-not-applied")
    expect(alternative.result.components.filter((component) => component.evidenceState === "hypothetical")).toHaveLength(1)
    expect(alternative.result.costCoverage.entries.find((entry) => entry.categoryId === "service")?.status).toBe("included")
    expect(alternative.result.costCoverage.entries.filter((entry) => entry.status === "pending").map((entry) => entry.categoryId))
      .toEqual(RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "service"))
    expect(stored.value.results?.[promotion.receipt.resultRef!]).toMatchObject({ kind: "scenario", caseRef: promotion.receipt.caseRef,
      requestDigest: digestSfValue(promotion.request.scenario), resultDigest: digestSfValue(alternative.result), result: alternative.result })
  }
  const snapshots = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
  for (const source of sources) expect(Object.values(snapshots.planner.sfSources?.scopes ?? {}).some((entry) =>
    entry.scope.principalRef === call.binding.principalRef && entry.scope.accessRevision === call.binding.accessRevision &&
    entry.scope.policyVersion === call.binding.policyVersion && entry.scope.recordType === "planner-version" &&
    entry.scope.recordId === source.evidence.target.recordId && entry.alive &&
    entry.incarnation === source.evidence.target.incarnation && entry.version === source.evidence.target.version)).toBe(true)
  return { ...fixture, call, caseRef, sources, decision, promotions, argument: { caseRef: encodeCaseRef(caseRef) } }
}

function observations(fixture: Awaited<ReturnType<typeof prepare>>, deadline: ReturnType<typeof compositionTestDeadline>) {
  const counts = { physical: 0, roots: 0, sources: 0, sourcesInRoot: 0 }
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const source = fixture.business.plannerSources.resolveForecastSource
  fixture.store.transaction = (surface, work, options) => {
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

test("Planner physical batching preserves both operation passes over three actually promoted alternatives", async () => {
  const deadline = compositionTestDeadline("planner-populated-parity")
  try {
    const fixture = await prepare(deadline), measured = observations(fixture, deadline)
    const root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    const before = await fixture.authority.state.read(fixture.request(), "cases", (state) => state)
    expect(before.status).toBe("ok")
    const snapshots = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    let canonical: AuthorizedCaseProjection
    let canonicalCost: typeof measured.counts
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = ok(await deadline.phase("read.canonical", () => fixture.business.cases.read(fixture.argument, fixture.call)),
        "Canonical populated case")
      canonicalCost = { ...measured.counts }
    } finally { fixture.persistence.readSnapshotRoot = root }
    measured.reset()
    const observed = ok(await deadline.phase("read.batched", () => fixture.business.cases.read(fixture.argument, fixture.call)),
      "Batched populated case")
    const batchedCost = { ...measured.counts }
    expect({ ...observed, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(observed.case).toEqual(fixture.decision)
    // Three references x two evidence passes x two source reads, plus three
    // operations x two guard passes x four source reads. These are live calls.
    expect(canonicalCost.sources).toBe(36)
    expect(batchedCost.sources).toBe(canonicalCost.sources)
    expect(canonicalCost.sourcesInRoot).toBe(0)
    expect(batchedCost.sourcesInRoot).toBe(batchedCost.sources)
    expect(batchedCost.roots).toBe(1)
    expect(batchedCost.physical).toBeLessThan(canonicalCost.physical)
    expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => state)).toEqual(before)
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(snapshots)
    observed.case.alternatives[0]!.scenario.operations[0]!.targetRef = "caller-owned-copy"
    measured.reset()
    const fresh = ok(await fixture.business.cases.read(fixture.argument, fixture.call), "Fresh independent populated observation")
    expect({ ...fresh, checkedAt: canonical.checkedAt }).toEqual(canonical)
    expect(measured.counts.sources).toBe(canonicalCost.sources)
    expect(measured.counts.roots).toBe(1)
    expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => state)).toEqual(before)
    console.log("SF_PLANNER_POPULATED_BATCH:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null,
      caseRef: fixture.caseRef, actualPromotionCount: fixture.promotions.length,
      resultRefs: fixture.promotions.map((promotion) => promotion.receipt.resultRef),
      canonical: canonicalCost, batched: batchedCost, fullProjectionEqual: true, protectedStateUnchanged: true, freshSecondInvocation: true }))
  } finally { await deadline.close() }
}, 120_000)

test("A stored unissued component selector is rejected by the populated canonical and batched operation guards", async () => {
  const deadline = compositionTestDeadline("planner-populated-selector")
  try {
    const fixture = await prepare(deadline)
    // Adversarial C08 edit: change only the stored selector after real promotion.
    // The original C09 result and coverage remain untouched.
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const decision = (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!
      decision.alternatives[2]!.scenario.operations[0]!.targetRef = "never-issued-component"
      return { commit: true, value: undefined }
    })
    const measured = observations(fixture, deadline), root = fixture.persistence.readSnapshotRoot
    if (!root) throw new Error("Real LocalStore read root unavailable")
    const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    let canonical: Awaited<ReturnType<typeof fixture.business.cases.read>>
    let canonicalSources: number
    try {
      fixture.persistence.readSnapshotRoot = undefined
      measured.reset()
      canonical = await fixture.business.cases.read(fixture.argument, fixture.call)
      canonicalSources = measured.counts.sources
    } finally { fixture.persistence.readSnapshotRoot = root }
    expect(canonical).toEqual({ status: "unavailable", reason: "case-evidence-unavailable" })
    measured.reset()
    const observed = await fixture.business.cases.read(fixture.argument, fixture.call)
    expect(observed).toEqual(canonical)
    expect(Object.hasOwn(observed, "value")).toBe(false)
    expect(measured.counts.sources).toBe(canonicalSources)
    expect(measured.counts.sources).toBeGreaterThan(0)
    expect(measured.counts.sourcesInRoot).toBe(measured.counts.sources)
    expect(measured.counts.roots).toBe(1)
    expect(await fixture.authority.host.revalidate(fixture.call)).toBe(true)
    expect(await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["source", "case-operation"] as const) {
  test("A populated Planner read refuses a committed " + boundary + " change after both operation passes", async () => {
    const deadline = compositionTestDeadline("planner-populated-egress-" + boundary)
    try {
      const fixture = await prepare(deadline), measured = observations(fixture, deadline)
      const root = fixture.persistence.readSnapshotRoot
      if (!root) throw new Error("Real LocalStore read root unavailable")
      let completed = 0
      fixture.persistence.readSnapshotRoot = async (work, options) => {
        const value = await root(work, options)
        expect(fixture.store.currentSnapshots()).toBeUndefined()
        // All 36 real source calls, including the last operation/source check,
        // must have completed before this independent committed mutation.
        expect(measured.counts.sources).toBe(36)
        expect(measured.counts.sourcesInRoot).toBe(36)
        const committed = await fixture.store.transaction(boundary === "source" ? "planner" : "dashboard", async (snapshot) => {
          if (boundary === "source") {
            const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
            versions[2]!.lines[0]!.f[0]! += 1
          } else {
            const decision = (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!
            decision.alternatives[2]!.scenario.operations[0]!.targetRef = "changed-after-operation-check"
          }
          return { commit: true, value: true }
        })
        expect(committed).toBe(true)
        completed++
        return value
      }
      deadline.own(() => { fixture.persistence.readSnapshotRoot = root })
      measured.reset()
      const result = await fixture.business.cases.read(fixture.argument, fixture.call)
      expect(completed).toBe(1)
      expect(result).toEqual({ status: "unavailable", reason: "planner-case-observation-changed" })
      expect(Object.hasOwn(result, "value")).toBe(false)
      expect(measured.counts.roots).toBe(1)
      expect(await fixture.authority.host.revalidate(fixture.call)).toBe(true)
    } finally { await deadline.close() }
  }, 120_000)
}
