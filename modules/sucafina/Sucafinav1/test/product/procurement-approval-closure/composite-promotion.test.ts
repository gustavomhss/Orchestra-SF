import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { BaselineCoverageRequest } from "../../../product/decisions/baseline-coverage.ts"
import { object } from "../../../runtime/contract.ts"
import type { Actor, Command } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/procurement.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Receipt = { caseRef: CaseRef; resultRef?: string }
const period = { start: "2026-01-01", end: "2026-12-31" }
const requester: Actor = { id: "person", roles: ["requester"], canWrite: true }

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// The empty case and Planner input are fixtures. Real Procurement commands issue
// the source; real human coverage, installed HTTP promotion, producer proof and
// SQLite/C08 create every alternative/result. This is not approval or C12 Apply.
async function fixture() {
  const value = await financialCompositionFixture()
  try {
    const { authority, business, persistence } = value
    const execute = (actor: Actor, command: Command) => persistence.transaction("procurement", async (snapshot) => {
      const result = domain.execute(snapshot, actor, command, { at: value.at, id: randomUUID, directory: [{ id: "person", name: "Person" }] })
      return { commit: result.ok, value: result }
    })
    const settings = await execute({ id: "person", roles: ["admin"], canWrite: true }, { page: "Settings", action: "reset", version: 0, values: {} })
    if (!settings.ok) throw new Error("Procurement settings initialization failed")
    const created = await execute(requester, { page: "Requests", action: "create", version: 0, values: { pr: {
      title: "Current 100 USD requisition", type: "service", description: "Composite promotion source", estAmount: 100,
      recurring: false, expenseType: "OPEX", costCenter: "IT", needBy: "2026-12-01", justification: "Compare an explicit estimate",
    } } })
    if (!created.ok) throw new Error("Real requisition creation failed")
    const requestId = String(object(created.value).number)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "composite-plan", name: "Current Planner baseline", year: 2026, closed: 0,
        lines: [{ id: "service", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const selectionDigest = digestSfValue({ purpose: "work-selection", period })
    const read = ok(await authority.ui.admit(value.request("read-composite-sources"), "sf_work_list", selectionDigest), "Admit current source selection")
    if (!await authority.ui.validate(read, "sf_work_list", selectionDigest)) throw new Error("Source selection intent unavailable")
    const prepared = await (async () => {
      try {
        ok(await business.procurementSelections.create(read, period), "Select the actual Procurement period")
        const procurementRef = ok(await business.individual.issue("procurement-request", requestId, read), "Issue current requisition")
        const procurement = ok(await business.individual.resolveForPreparation(procurementRef, read), "Resolve current requisition")
        const planner = ok(await business.plannerProduct.issueSource("composite-plan", read), "Issue current Planner source")
        const projection = ok(await business.planner.compareForecast({ baseRef: planner.evidence.refId, candidateRef: planner.evidence.refId, period, currency: "USD" }, read), "Project the current baseline")
        return { procurement: procurement.evidence, planner: planner.evidence, componentIds: projection.baseline.components.map((component) => component.id) }
      } finally { authority.ui.finish(read) }
    })()
    expect(prepared.procurement.target.fields).toContain("originalAmount")
    const initialRef: CaseRef = { id: "composite-promotion", incarnation: "composite-promotion-incarnation", version: 1 }
    const basis: BaselineCoverageRequest["basis"] = { id: "composite-coverage", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [prepared.planner] }
    const decision: DecisionCase = { ...initialRef, state: "draft", objective: "Review a distinct Procurement hypothesis with current Planner evidence",
      horizon: period, currency: "USD", criteria: [], participants: ["person"], sourceRefs: [prepared.planner, prepared.procurement],
      alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(value.request("seed-empty-composite-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-empty-composite-case", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[decision.id] = decision
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error("Empty composite case unavailable")
    const coverage: BaselineCoverageRequest = { caseRef: initialRef, source: prepared.planner, basis, expectedVersion: 0,
      entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
        ? { categoryId, status: "included", componentRefs: prepared.componentIds, evidenceRefs: [prepared.planner], scopeNote: "Human classifies the current Planner service only" }
        : { categoryId, status: "pending", reason: "Awaiting human evidence" }) }
    const human = ok(await authority.human.admit(value.request("classify-composite-baseline"), "decisions.coverage", coverage), "Admit human coverage")
    const registered = await (async () => {
      try { return ok(await business.withCase(human, initialRef, {}, () => business.baselineCoverage.register(coverage, human)), "Register genuine baseline coverage") }
      finally { authority.human.finish(human) }
    })()
    const request = (caseRef: CaseRef, amount?: number) => ({ caseRef, title: amount === undefined ? "Source-only Planner observation" : "Explicit 120 USD requisition hypothesis",
      scenario: { baseRef: prepared.planner.refId, operations: amount === undefined ? [] : [{ kind: "replace" as const, targetRef: prepared.procurement.refId, amount, currency: "USD", period }], assumptions: [] },
      coverageRef: registered.coverageRef })
    const http = value.portfolio.http({ origin: "https://example.test", mount: "/product" })
    const post = async (payload: ReturnType<typeof request>, operation: string) => {
      const response = await http(new Request("https://example.test/product/planner?sf=decision-promote", { method: "POST",
        headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": operation }, body: JSON.stringify(payload) }), "planner")
      if (!response) throw new Error("Installed promotion route unavailable")
      return { status: response.status, result: await response.json() as PortResult<Receipt> }
    }
    const snapshot = async () => {
      const result = await authority.state.read(value.request(), "cases", (state) => ({ decision: state.cases[initialRef.id],
        results: state.decisionResults ?? {}, transactions: state.transactions, outbox: state.outbox }))
      if (result.status !== "ok" || !result.value.decision) throw new Error("Current C08 state unavailable")
      return { storageVersion: result.storageVersion, ...result.value, decision: result.value.decision }
    }
    const official = () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    return { value, execute, initialRef, prepared, requestId, request, post, snapshot, official }
  } catch (error) { await value.dispose(); throw error }
}

test("composite HTTP promotion preserves its exact hypothetical proof and never applies the 120 USD requisition edit", async () => {
  const state = await fixture()
  try {
    const official = await state.official()
    const base = await state.post(state.request(state.initialRef), "promote-source-only")
    expect(base.status).toBe(200)
    const baselineReceipt = ok(base.result, "Promote the source-only baseline")
    const before = await state.snapshot()
    const baseline = before.decision.alternatives[0]!
    expect(baseline.scenario.operations).toEqual([])
    expect(baseline.result.unresolvedConditions).not.toContain("scenario-is-hypothetical")
    expect(baseline.result.restrictions).not.toContain("preview-not-applied")
    expect(baseline.result.knownSubtotal).toBe(1200)
    const proposal = state.request(baselineReceipt.caseRef, 120)
    const promoted = await state.post(proposal, "promote-external-120")
    expect(promoted.status).toBe(200)
    const receipt = ok(promoted.result, "Promote the exact composite hypothesis")
    const after = await state.snapshot()
    expect(receipt.caseRef).toEqual({ ...baselineReceipt.caseRef, version: baselineReceipt.caseRef.version + 1 })
    expect(after.decision.alternatives).toHaveLength(2)
    const alternative = after.decision.alternatives[1]!
    expect(alternative.scenario).toEqual(proposal.scenario)
    expect(alternative.result).toMatchObject({ knownSubtotal: 1200, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(alternative.result.unresolvedConditions.filter((condition) => condition === "scenario-is-hypothetical")).toHaveLength(1)
    expect(alternative.result.restrictions.filter((restriction) => restriction === "preview-not-applied")).toHaveLength(1)
    expect(alternative.result.unresolvedConditions).toContain(`external-operation:${digestSfValue(proposal.scenario.operations[0])}:procurement-replacement-cost-unresolved`)
    expect(alternative.result.sourceRefs).toContainEqual(state.prepared.procurement)
    expect(alternative.result.sourceRefs).toContainEqual(state.prepared.planner)
    expect(alternative.result.components.some((component) => component.sourceRefs.some((ref) => ref.surface === "procurement"))).toBe(false)
    expect(receipt.resultRef).toBeDefined()
    const stored = after.results[receipt.resultRef!]
    expect(stored?.result).toEqual(alternative.result)
    expect(stored?.resultDigest).toBe(digestSfValue(alternative.result))
    expect(after.decision.choices).toEqual([])
    expect(after.decision.preparedChanges).toEqual([])
    expect(after.decision.receipts).toEqual([])
    expect(await state.official()).toEqual(official)
    // The current source remains a 100 USD draft; promotion only persisted the hypothesis.
    expect(object(object(official.data.store).requests)[state.requestId]).toMatchObject({ request: { status: "draft", pr: { estAmount: 100 } } })
    expect(await state.post(proposal, "promote-external-120")).toEqual(promoted)
    expect(await state.snapshot()).toEqual(after)
    expect(await state.official()).toEqual(official)
    const stale = await state.post(proposal, "stale-case-promotion")
    expect(stale.status).toBe(409)
    expect(stale.result.status).not.toBe("ok")
    expect(await state.snapshot()).toEqual(after)
    expect(await state.official()).toEqual(official)
  } finally { await state.value.dispose() }
})

for (const fault of ["authority", "source"] as const) test(`composite promotion refuses ${fault} changed before its exact C08 commit`, async () => {
  const state = await fixture()
  const original = state.value.authority.state.transaction
  let reached = false
  let editedOfficial: Awaited<ReturnType<typeof state.official>> | undefined
  try {
    const before = await state.snapshot(), official = await state.official()
    const operation = `composite-race-${fault}`
    state.value.authority.state.transaction = async (request, command, work) => {
      if (!reached && command.namespace === "cases" && command.idempotencyKey === `${operation}:add-alternative`) {
        reached = true
        if (fault === "authority") state.value.active.value = false
        else {
          const changed = await state.execute(requester, { page: "Requests", action: "save", id: state.requestId,
            version: official.versions[`requests:${state.requestId}`]!.version, values: { pr: { estAmount: 110 } } })
          expect(changed.ok).toBe(true)
          editedOfficial = await state.official()
        }
      }
      return original(request, command, work)
    }
    const rejected = await state.post(state.request(state.initialRef, 120), operation)
    expect(reached).toBe(true)
    expect(rejected.status).not.toBe(200)
    expect(rejected.result.status).not.toBe("ok")
    expect(rejected.result).not.toHaveProperty("value")
    state.value.active.value = true
    expect(await state.snapshot()).toEqual(before)
    expect(await state.official()).toEqual(editedOfficial ?? official)
  } finally {
    state.value.authority.state.transaction = original
    state.value.active.value = true
    await state.value.dispose()
  }
})
