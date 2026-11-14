import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import type { CriterionRuleInput } from "../../../../product/decisions/criterion-rules.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { createSfPortfolioCoverageAuthority } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-coverage-authority.ts"
import { createPortfolioCoveragePreview } from "../../../../product/portfolio/coverage-preview.ts"
import { comparePlannerPreview } from "../../../../product/planner/preview-comparison.ts"

type Fixture = Awaited<ReturnType<typeof financialCompositionFixture>>
type CaseRef = { id: string; incarnation: string; version: number }
type Receipt = { caseRef: CaseRef; resultRef?: string }
type Promotion = Parameters<Fixture["portfolio"]["mutations"]["addAlternative"]>[0]
type Choice = Parameters<Fixture["portfolio"]["mutations"]["recordChoice"]>[0]
const horizon = { start: "2026-01-01", end: "2026-12-31" }

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Actual SQLite/C08, Planner calculations, BCS, human registries and HTTP mutations.
// Only the empty case and domain inputs are seeded; no alternative/result/choice/receipt is seeded.
async function promotionFixture(name: string, budgetMs: number) {
  const deadline = compositionTestDeadline(name, budgetMs)
  try {
    const fixture = await deadline.phase("fixture.initialize", async () => {
      const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
      deadline.own(() => value.dispose())
      return value
    })
    const { authority, business } = fixture
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
    await fixture.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `v${index}`, name: index ? "Candidate" : "Baseline", year: 2026, closed: 0,
        lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await fixture.persistence.initializeSources("planner")
    const call = await fixture.read()
    const prepared = await deadline.phase("fixture.sources", async () => {
      try {
        const sources = [] as BaselineCoverageRequest["source"][]
        const componentIds: string[][] = []
        for (const id of ["v0", "v1"]) {
          const issued = ok(await business.plannerProduct.issueSource(id, call), `Issue ${id}`)
          sources.push(issued.evidence)
          const forecast = ok(await business.planner.compareForecast({ baseRef: issued.evidence.refId, candidateRef: issued.evidence.refId, period: horizon, currency: "USD" }, call), `Project ${id}`)
          if (!forecast.baseline.components.length) throw new Error("Real forecast has no classifiable components")
          componentIds.push(forecast.baseline.components.map((component) => component.id))
        }
        return { sources, componentIds }
      } finally { authority.ui.finish(call) }
    })
    const initialRef: CaseRef = { id: "promotion-case", incarnation: "promotion-case-incarnation", version: 1 }
    const basis: BaselineCoverageRequest["basis"] = { id: "renewal", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: prepared.sources }
    const decision: DecisionCase = { ...initialRef, state: "draft", objective: "Human comparison of license renewal forecasts", horizon, currency: "USD",
      criteria: [{ id: "cost", description: "Known subtotal difference must not exceed zero", required: true }], participants: ["person"], sourceRefs: prepared.sources,
      alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(fixture.request("seed-empty-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-empty-case", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[decision.id] = decision
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error(`Empty case seed failed: ${JSON.stringify(seeded)}`)
    const registerCoverage = async (coverage: BaselineCoverageRequest, operation: string) => deadline.phase(`coverage.${operation}`, async () => {
      const human = ok(await authority.human.admit(fixture.request(operation), "decisions.coverage", coverage), "Admit human coverage")
      try { return ok(await business.withCase(human, coverage.caseRef, {}, () => business.baselineCoverage.register(coverage, human)), "Register human coverage") }
      finally { authority.human.finish(human) }
    })
    const requests: BaselineCoverageRequest[] = prepared.sources.map((source, index) => ({ caseRef: initialRef, source, basis, expectedVersion: 0,
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
        ? { categoryId, status: "included", componentRefs: prepared.componentIds[index]!, evidenceRefs: [source], scopeNote: "License service explicitly classified by the human" }
        : { categoryId, status: "pending", reason: "Awaiting human evidence" }) }))
    const classifications = [] as { coverageRef: string; version: number }[]
    for (const [index, request] of requests.entries()) classifications.push(await registerCoverage(request, `classify-v${index}`))
    const promotion = (index: number, caseRef: CaseRef): Promotion => ({ caseRef, title: index ? "Candidate" : "Baseline",
      scenario: { baseRef: prepared.sources[index]!.refId, operations: [], assumptions: [] }, coverageRef: classifications[index]!.coverageRef })
    const http = fixture.portfolio.http({ origin: "https://example.test", mount: "/product" })
    const post = async (mode: "decision-promote" | "decision-choose", payload: unknown, operation: string) => deadline.phase(`http.${mode}.${operation}`, async () => {
      const response = await http(new Request(`https://example.test/product/planner?sf=${mode}`, { method: "POST",
        signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": operation }, body: JSON.stringify(payload) }), "planner")
      if (!response) throw new Error("Portfolio route did not handle its own action")
      return { status: response.status, result: await response.json() as PortResult<Receipt> }
    })
    const snapshot = async () => {
      const result = await authority.state.read(fixture.request(), "cases", (state) => ({ case: state.cases[initialRef.id],
        results: state.decisionResults ?? {}, transactions: state.transactions, outbox: state.outbox }))
      if (result.status !== "ok" || !result.value.case) throw new Error("C08 snapshot unavailable")
      return { storageVersion: result.storageVersion, ...result.value, case: result.value.case }
    }
    const scoped = async <T>(caseRef: CaseRef, work: (call: TrustedDomainContext) => Promise<PortResult<T>>, label = "scoped.read") => deadline.phase(label, async () => {
      const read = await fixture.read()
      try { return await business.withCase(read, caseRef, {}, () => work(read)) }
      finally { authority.ui.finish(read) }
    })
    const registerRule = async (caseRef: CaseRef) => deadline.phase("criterion.register", async () => {
      const rule: CriterionRuleInput = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte", value: 0,
        unit: "USD", period: horizon, evidenceRefs: prepared.sources, expectedRuleVersion: 0 }
      const human = ok(await authority.human.admit(fixture.request("register-cost-rule"), "decisions.criteria", rule), "Admit human criterion")
      try { return ok(await business.withCase(human, caseRef, {}, () => fixture.portfolio.rules.register(rule, human)), "Register human criterion") }
      finally { authority.human.finish(human) }
    })
    return { fixture, initialRef, requests, classifications, sources: prepared.sources, promotion, post, snapshot, scoped, registerCoverage, registerRule,
      close: () => deadline.close() }
  } catch (error) { await deadline.close(); throw error }
}

type Prepared = Awaited<ReturnType<typeof promotionFixture>>
const receiptKey = (state: Prepared, operation: string) => JSON.stringify(["person", "cases", state.initialRef.id, operation])
async function committed(result: Awaited<ReturnType<Prepared["post"]>>, label: string) {
  expect(result.status).toBe(200)
  return ok(result.result, label)
}
function scenarioRef(receipt: Receipt) {
  if (!receipt.resultRef) throw new Error("Promotion did not persist its actual scenario result")
  return receipt.resultRef
}
async function promotedPair(state: Prepared) {
  const baseline = await committed(await state.post("decision-promote", state.promotion(0, state.initialRef), "promote-baseline"), "Promote baseline")
  const candidate = await committed(await state.post("decision-promote", state.promotion(1, baseline.caseRef), "promote-candidate"), "Promote candidate")
  const saved = await state.snapshot()
  expect(saved.case.alternatives).toHaveLength(2)
  await state.registerRule(candidate.caseRef)
  const comparison = ok(await state.scoped(candidate.caseRef, (call) => state.fixture.portfolio.compare({ caseRef: candidate.caseRef,
    baselineAlternativeId: saved.case.alternatives[0]!.id, alternativeId: saved.case.alternatives[1]!.id, criteria: ["cost"] }, call), "comparison.promoted-pair"), "Compare stored alternatives")
  const choice: Choice = { caseRef: candidate.caseRef, alternativeId: saved.case.alternatives[1]!.id, alternativeVersion: saved.case.alternatives[1]!.version,
    comparison: comparison.request, criteria: ["cost"], reason: "Human accepts the known subtotal while the remaining cost categories await evidence" }
  return { baseline, candidate, comparison, choice }
}

test("first HTTP promotion commits real coverage and a historical baseline supports a new choice in N+2", async () => {
  const state = await promotionFixture("portfolio-promotion-choice", 285_000)
  try {
    const empty = await state.snapshot()
    expect(empty.case.alternatives).toHaveLength(0)
    expect(empty.case.choices).toHaveLength(0)
    expect(Object.keys(empty.results)).toHaveLength(0)
    const baselineRequest = state.promotion(0, state.initialRef)
    const baseline = await committed(await state.post("decision-promote", baselineRequest, "promote-baseline"), "First promotion")
    expect(baseline.caseRef).toEqual({ ...state.initialRef, version: 2 })
    const baselineRef = scenarioRef(baseline)
    const first = await state.snapshot()
    expect(first.case.alternatives).toHaveLength(1)
    const alternative = first.case.alternatives[0]!
    expect(alternative.result).toMatchObject({ total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(alternative.result.costCoverage.entries.find((entry) => entry.categoryId === "service")?.status).toBe("included")
    expect(alternative.result.costCoverage.entries.filter((entry) => entry.status === "pending").map((entry) => entry.categoryId))
      .toEqual(RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "service"))
    expect(alternative.result.unresolvedConditions).not.toContain("scenario-coverage-reassessment-required")
    expect(first.results[baselineRef]).toMatchObject({ kind: "scenario", caseRef: baseline.caseRef, requestDigest: digestSfValue(baselineRequest.scenario),
      resultDigest: digestSfValue(alternative.result), result: alternative.result })
    expect(first.transactions[receiptKey(state, "promote-baseline:add-alternative")]).toMatchObject({ commandDigest: digestSfValue(baselineRequest),
      targetIncarnation: state.initialRef.incarnation, value: first.case })
    const retry = await committed(await state.post("decision-promote", baselineRequest, "promote-baseline"), "Retry committed promotion")
    expect(retry).toEqual(baseline)
    expect(await state.snapshot()).toEqual(first)

    const candidate = await committed(await state.post("decision-promote", state.promotion(1, baseline.caseRef), "promote-candidate"), "Second promotion")
    expect(candidate.caseRef).toEqual({ ...state.initialRef, version: 3 })
    const candidateRef = scenarioRef(candidate)
    const second = await state.snapshot()
    expect(second.results[baselineRef]).toEqual(first.results[baselineRef])
    expect(second.results[candidateRef]?.caseRef.version).toBe(3)
    const exactRead = await state.scoped(candidate.caseRef, (call) => state.fixture.business.results.read({ kind: "scenario", resultRef: baselineRef }, call), "read.exact-baseline")
    expect(exactRead).toMatchObject({ status: "denied", reason: "result-access-unavailable" })
    const historical = ok(await state.scoped(candidate.caseRef, (call) => state.fixture.business.results.readHistoricalScenario({ resultRef: baselineRef }, call), "read.historical-baseline"), "Read authorized historical baseline")
    expect(historical).toEqual(first.results[baselineRef])
    const rule = await state.registerRule(candidate.caseRef)
    expect(rule.version).toBe(1)
    const comparison = ok(await state.scoped(candidate.caseRef, (call) => state.fixture.portfolio.compare({ caseRef: candidate.caseRef,
      baselineAlternativeId: second.case.alternatives[0]!.id, alternativeId: second.case.alternatives[1]!.id, criteria: ["cost"] }, call), "comparison.actual-alternatives"), "Compare actual alternatives")
    expect(comparison.request.scenarioRefs).toEqual([baselineRef, candidateRef])
    expect(comparison.comparison).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null,
      criterionResults: [{ criterionId: "cost", state: "unknown", reason: "criterion-metric-conditioned" }] })
    const choice: Choice = { caseRef: candidate.caseRef, alternativeId: second.case.alternatives[1]!.id, alternativeVersion: 1,
      comparison: comparison.request, criteria: ["cost"], reason: "Human accepts the known subtotal while the remaining cost categories await evidence" }
    const beforeWrong = await state.snapshot()
    const mismatched = await state.post("decision-choose", { ...choice, comparison: { ...choice.comparison, scenarioRefs: [candidateRef, baselineRef] } }, "choose-mismatched")
    expect(mismatched.result.status).not.toBe("ok")
    expect(await state.snapshot()).toEqual(beforeWrong)

    const selected = await committed(await state.post("decision-choose", choice, "choose-candidate"), "New human choice")
    expect(selected.caseRef).toEqual({ ...state.initialRef, version: 4 })
    const chosen = await state.snapshot()
    expect(chosen.case.choices).toHaveLength(1)
    expect(chosen.case.ledger).toHaveLength(1)
    expect(Object.keys(chosen.outbox)).toHaveLength(1)
    const storedChoice = chosen.case.choices[0]!
    expect(storedChoice).toMatchObject({ alternativeId: choice.alternativeId, reason: choice.reason, comparisonStatus: "conditioned",
      result: { total: null }, comparison: { completeDifference: null }, values: [{ criterionRef: "cost", value: comparison.comparison.knownDifference, unit: "USD", currency: "USD", horizon }] })
    expect(storedChoice.comparison).toEqual(comparison.comparison)
    expect(chosen.case.ledger[0]).toMatchObject({ kind: "choice-recorded", caseRef: selected.caseRef, outputDigest: digestSfValue(storedChoice), rationale: choice.reason })
    expect(chosen.transactions[receiptKey(state, "choose-candidate:record-choice")]).toMatchObject({ commandDigest: digestSfValue(choice), value: chosen.case })
    expect(Object.values(chosen.outbox)[0]?.eventRef.target.eventId).toBe(chosen.case.ledger[0]!.id)
    expect(await committed(await state.post("decision-choose", choice, "choose-candidate"), "Retry actual choice")).toEqual(selected)
    expect(await state.snapshot()).toEqual(chosen)
    expect((await state.post("decision-choose", { ...choice, reason: "Changed after admission" }, "choose-candidate")).status).toBe(409)
    expect(await state.snapshot()).toEqual(chosen)
  } finally { await state.close() }
}, 300_000)

test("promotion refuses additional authority fields, changed admitted intent and revoked admission without storing a result", async () => {
  const state = await promotionFixture("portfolio-promotion-authority", 105_000)
  const { authority, business, portfolio } = state.fixture
  try {
    const request = state.promotion(0, state.initialRef)
    const before = await state.snapshot()
    expect((await state.post("decision-promote", { ...request, authority: "forged" }, "forged-http")).status).toBe(400)
    const human = ok(await authority.human.admit(state.fixture.request("exact-intent"), "decisions.promote-alternative", request), "Admit exact promotion")
    try {
      expect(await business.withCase(human, state.initialRef, {}, () => portfolio.mutations.addAlternative({ ...request, title: "Not selected by this human intent" }, human)))
        .toMatchObject({ status: "denied", reason: "human-promotion-required" })
    } finally { authority.human.finish(human) }
    state.fixture.active.value = false
    expect((await state.post("decision-promote", request, "revoked-admission")).status).toBe(403)
    state.fixture.active.value = true
    expect(await state.snapshot()).toEqual(before)
  } finally { state.fixture.active.value = true; await state.close() }
}, 120_000)

for (const change of ["source", "classification", "authority"] as const) test(`promotion rechecks ${change} changed immediately before the real C08 commit`, async () => {
  const state = await promotionFixture(`portfolio-promotion-${change}-race`, 165_000)
  const original = state.fixture.authority.state.transaction
  let reachedCommit = false
  try {
    const before = await state.snapshot()
    const operation = `race-${change}`
    state.fixture.authority.state.transaction = async (request, command, work) => {
      if (!reachedCommit && command.namespace === "cases" && command.idempotencyKey === `${operation}:add-alternative`) {
        reachedCommit = true
        if (change === "authority") state.fixture.active.value = false
        if (change === "source") await state.fixture.persistence.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
          versions.find((version) => version.id === "v0")!.lines[0]!.f[0] = 101
          return { commit: true, value: undefined }
        })
        if (change === "classification") {
          const updated: BaselineCoverageRequest = { ...state.requests[0]!, expectedVersion: 1,
            entries: state.requests[0]!.entries.map((entry) => entry.categoryId === "service" ? { categoryId: entry.categoryId, status: "pending", reason: "Human withdrew this classification" } : entry) }
          expect((await state.registerCoverage(updated, "reclassify-before-promotion-commit")).version).toBe(2)
        }
      }
      return original(request, command, work)
    }
    const denied = await state.post("decision-promote", state.promotion(0, state.initialRef), operation)
    expect(reachedCommit).toBe(true)
    expect(denied.result.status).not.toBe("ok")
    state.fixture.active.value = true
    const after = await state.snapshot()
    expect(after.case).toEqual(before.case)
    expect(after.results).toEqual(before.results)
    expect(after.outbox).toEqual(before.outbox)
    expect(after.transactions[receiptKey(state, `${operation}:add-alternative`)]).toBeUndefined()
    if (change === "source") {
      const fresh = await state.fixture.read()
      try { expect((await state.fixture.business.context.resolve(state.sources[0]!, fresh)).state).not.toBe("fresh") }
      finally { state.fixture.authority.ui.finish(fresh) }
    }
  } finally { state.fixture.authority.state.transaction = original; state.fixture.active.value = true; await state.close() }
}, 180_000)

test("historical choice rejects removed membership, replaced incarnation, changed alternative digest and stale source", async () => {
  const state = await promotionFixture("portfolio-promotion-historical-negatives", 285_000)
  try {
    const pair = await promotedPair(state)
    const before = await state.snapshot()
    const baselineRef = scenarioRef(pair.baseline)
    // These controlled corruptions exercise the read/commit boundary after real promotions.
    // They never create a successful alternative, result, receipt or choice.
    const alterCase = (change: (value: DecisionCase) => void) => state.fixture.store.transaction("dashboard", async (snapshot) => {
      const product = snapshot.data.__sfProductV1 as SfProductState
      const value = structuredClone(before.case)
      change(value)
      product.cases[value.id] = value
      return { commit: true, value: undefined }
    })
    await alterCase((value) => { value.participants = [] })
    expect((await state.post("decision-choose", pair.choice, "choice-removed-member")).result.status).not.toBe("ok")
    await alterCase((value) => { value.incarnation = "replacement-incarnation" })
    expect((await state.post("decision-choose", pair.choice, "choice-replaced-incarnation")).result.status).not.toBe("ok")
    await alterCase((value) => { value.alternatives[0]!.result = { ...value.alternatives[0]!.result, unresolvedConditions: ["Changed after storing the scenario"] } })
    expect((await state.post("decision-choose", pair.choice, "choice-alternative-digest")).result.status).not.toBe("ok")
    await alterCase(() => {})
    state.fixture.active.value = false
    expect((await state.post("decision-choose", pair.choice, "choice-revoked")).result.status).not.toBe("ok")
    state.fixture.active.value = true
    await state.fixture.persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
      versions.find((version) => version.id === "v0")!.lines[0]!.f[0] = 102
      return { commit: true, value: undefined }
    })
    expect((await state.scoped(pair.candidate.caseRef, (call) => state.fixture.business.results.readHistoricalScenario({ resultRef: baselineRef }, call))).status).not.toBe("ok")
    expect((await state.post("decision-choose", pair.choice, "choice-stale-source")).result.status).not.toBe("ok")
    const after = await state.snapshot()
    expect(after.case.choices).toHaveLength(0)
    expect(after.case.ledger).toHaveLength(0)
    expect(after.results).toEqual(before.results)
    expect(after.transactions).toEqual(before.transactions)
    expect(after.outbox).toEqual(before.outbox)
  } finally { state.fixture.active.value = true; await state.close() }
}, 300_000)

test("Portfolio coverage reopens real human selection and preserves incomplete costs across Request and source changes", async () => {
  const state = await promotionFixture("portfolio-coverage-authority", 285_000)
  try {
    const pair = await promotedPair(state)
    const { authority, business, portfolio } = state.fixture
    const saved = await state.snapshot()
    const alternative = saved.case.alternatives[1]!
    const parameter = alternative.result.components[0]
    if (!parameter) throw new Error("Actual Planner component unavailable")
    const request = { scenarioRef: scenarioRef(pair.candidate), parameterBounds: { parameterRef: parameter.id, minimum: 0, maximum: 2000, steps: 2 },
      criterion: { id: "cost", operator: "lte" as const, value: 0 } }
    const baselineRef = scenarioRef(pair.baseline)
    const resolve = createSfPortfolioCoverageAuthority({ authority, business, registries: portfolio })
    const absent = await state.scoped(pair.candidate.caseRef, (call) => resolve(request, baselineRef, call), "coverage.no-human-selection")
    expect(absent).toEqual({ status: "unavailable", reason: "portfolio-coverage-selection-unavailable" })
    const selection = { caseRef: pair.candidate.caseRef, baselineAlternativeId: saved.case.alternatives[0]!.id,
      alternativeId: alternative.id, criteria: ["cost"], expectedVersion: 0 }
    const human = ok(await authority.human.admit(state.fixture.request("select-coverage-pair"), "decisions.select-portfolio", selection), "Admit portfolio selection")
    try { ok(await business.withCase(human, selection.caseRef, {}, () => portfolio.selection.register(selection, human)), "Register actual selection") }
    finally { authority.human.finish(human) }
    const before = await state.snapshot()
    const checked = await state.scoped(pair.candidate.caseRef, async (call) => {
      const resolved = ok(await resolve(request, baselineRef, call), "Resolve authenticated coverage authority")
      expect(resolved.decision).toEqual(before.case)
      expect(resolved.storedResult).toEqual(alternative.result)
      expect(resolved.storedResult.costCoverage.coverageState).toBe("pending")
      expect(resolved.classification.notApplicableEntries ?? []).toHaveLength(0)
      expect(resolved.baseline.classification.notApplicableEntries ?? []).toHaveLength(0)
      expect(await resolved.isStillValid(call)).toBe(true)
      const other = await state.fixture.read()
      try { expect(await resolved.isStillValid(other)).toBe(false) }
      finally { authority.ui.finish(other) }
      expect((await resolve({ ...request, criterion: { ...request.criterion, value: 1 } }, baselineRef, call)).status).not.toBe("ok")
      const scenarios = business.plannerProduct.scenarios
      if (!scenarios || !portfolio.units) throw new Error("Actual Planner sensitivity ports unavailable")
      const preview = createPortfolioCoveragePreview({ units: portfolio.units, resolveAuthority: resolve,
        preview: (value, trusted) => comparePlannerPreview({ host: authority.host, sources: business.plannerSources, scenarios, planner: portfolio.planner }, value, trusted) })
      // The original no-op results preserve explicit pending category reasons.
      // The canonical issuer refuses those unresolved sources before issuing a certificate.
      expect(resolved.storedResult.unresolvedConditions.some((condition) => condition.startsWith("coverage:"))).toBe(true)
      const refused = await preview.issue(request, baselineRef, call)
      expect(refused).toEqual({ status: "unavailable", reason: "coverage-source-unresolved" })
      expect(refused).not.toHaveProperty("value")
      expect(await state.snapshot()).toEqual(before)
      const source = authority.host.requestFor(call)
      if (!source) throw new Error("Authentic Request unavailable")
      source.headers.set("x-coverage-replaced", "changed")
      expect(await resolved.isStillValid(call)).toBe(false)
      source.headers.delete("x-coverage-replaced")
      expect(await resolved.isStillValid(call)).toBe(true)
      await state.fixture.persistence.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions as { id: string; lines: { b: number[]; f: number[] }[] }[]
        const line = versions.find((value) => value.id === "v1")!.lines[0]!
        line.b[0] = 90
        line.f[0] = 90
        return { commit: true, value: undefined }
      })
      expect(await resolved.isStillValid(call)).toBe(false)
      expect((await resolve(request, baselineRef, call)).status).not.toBe("ok")
      return { status: "ok" as const, value: true }
    }, "coverage.current-authority-and-counterproofs")
    expect(checked).toEqual({ status: "ok", value: true })
    expect((await state.snapshot()).case).toEqual(before.case)
  } finally { state.fixture.active.value = true; await state.close() }
}, 300_000)


test("Portfolio coverage refuses a revoked authentic UI admission before exposing authority data", async () => {
  const fixture = await financialCompositionFixture()
  const call = await fixture.read()
  try {
    const resolve = createSfPortfolioCoverageAuthority({ authority: fixture.authority, business: fixture.business, registries: fixture.portfolio })
    fixture.active.value = false
    const result = await resolve({ scenarioRef: "untrusted-scenario", parameterBounds: { parameterRef: "untrusted-parameter", minimum: 0, maximum: 1, steps: 2 },
      criterion: { id: "cost", operator: "lte", value: 0 } }, "untrusted-baseline", call)
    expect(result).toEqual({ status: "denied", reason: "portfolio-coverage-authority-unavailable" })
    fixture.active.value = true
    // A revoked admission is not revived by a subsequently valid session.
    expect(await fixture.authority.host.revalidate(call)).toBe(false)
  } finally { fixture.authority.ui.finish(call); await fixture.dispose() }
}, 120_000)
