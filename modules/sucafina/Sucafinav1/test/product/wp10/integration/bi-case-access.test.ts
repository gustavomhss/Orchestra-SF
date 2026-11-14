import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfDecisionBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import { createSfExtendedAssets } from "../../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { prepareSfBiAccessBrowser } from "./bi-access-browser-fixture.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Actual Planner input, human classification/promotion, SQLite/C08 result
// persistence, BI options, C16 presentation and browser source navigation.
// The identity and domain inputs are fixture boundaries; no result body or
// authorization response is substituted and no complete-finance claim is made.
test("BI clears a real persisted case after participant revocation with the session valid and discards a delayed authorized source", async () => {
  const deadline = compositionTestDeadline("bi-case-access")
  try {
    const fixture = await deadline.phase("fixture.initialize", () => financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() }))
    deadline.own(() => fixture.dispose())
    const { authority, business, portfolio, persistence } = fixture
    const period = { start: "2026-01-01", end: "2026-12-31" }
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `bi-v${index}`, name: index ? "BI candidate" : "BI baseline", year: 2026, closed: 0,
        lines: [{ id: "line", name: "Private license service", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: {}, suppliers: [], settings: { currency: "USD" } }
      return { commit: true, value: undefined }
    })
    await persistence.initializeSources("planner")
    const call = await fixture.read()
    deadline.own(() => authority.ui.finish(call))
    const sources: BaselineCoverageRequest["source"][] = []
    const componentIds: string[][] = []
    for (const index of [0, 1]) {
      const issued = ok(await deadline.phase(`source.${index}`, () => business.plannerProduct.issueSource(`bi-v${index}`, call)), "Issue real BI source")
      const forecast = ok(await deadline.phase(`forecast.${index}`, () => business.planner.compareForecast({ baseRef: issued.evidence.refId,
        candidateRef: issued.evidence.refId, period, currency: "USD" }, call)), "Read real BI forecast")
      expect(forecast.baseline.components.length).toBeGreaterThan(0)
      sources.push(issued.evidence)
      componentIds.push(forecast.baseline.components.map((component) => component.id))
    }
    const initialRef = { id: "bi-private-case", incarnation: "bi-private-incarnation", version: 1 }
    const basis: BaselineCoverageRequest["basis"] = { id: "bi-renewal", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: sources }
    const initial: DecisionCase = { ...initialRef, state: "draft", objective: "Real comparison for BI access counterproof", horizon: period, currency: "USD",
      criteria: [], participants: ["person"], sourceRefs: sources, alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(fixture.request("bi-empty-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "bi-empty-case", commandDigest: digestSfValue(initial) }, async (state) => {
      state.cases[initial.id] = initial
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error(`Empty BI case: ${JSON.stringify(seeded)}`)
    const classifications: { coverageRef: string; version: number }[] = []
    for (const [index, source] of sources.entries()) {
      const coverage: BaselineCoverageRequest = { caseRef: initialRef, source, basis, expectedVersion: 0,
        entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
          ? { categoryId, status: "included", componentRefs: componentIds[index]!, evidenceRefs: [source], scopeNote: "Human classifies license service; all other categories remain pending" }
          : { categoryId, status: "pending", reason: "Awaiting human evidence" }) }
      const human = ok(await authority.human.admit(fixture.request(`bi-coverage-${index}`), "decisions.coverage", coverage), "Admit human BI coverage")
      try { classifications.push(ok(await deadline.phase(`coverage.${index}`, () => business.withCase(human, initialRef, {}, () => business.baselineCoverage.register(coverage, human))), "Register human BI coverage")) }
      finally { authority.human.finish(human) }
    }
    const mutationHttp = portfolio.http({ origin: "https://example.test", mount: "/product" })
    const promote = async (index: number, caseRef: typeof initialRef) => {
      const payload = { caseRef, title: index ? "BI candidate" : "BI baseline", scenario: { baseRef: sources[index]!.refId, operations: [], assumptions: [] }, coverageRef: classifications[index]!.coverageRef }
      const response = await deadline.phase(`promotion.${index}`, () => mutationHttp(new Request("https://example.test/product/planner?sf=decision-promote", {
        method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": `bi-promote-${index}` }, body: JSON.stringify(payload) }), "planner"))
      expect(response?.status).toBe(200)
      const receipt = ok(await response!.json() as PortResult<{ caseRef: typeof initialRef; resultRef?: string }>, "Promote real BI scenario")
      if (!receipt.resultRef) throw new Error("Actual promotion did not persist its scenario")
      return { caseRef: receipt.caseRef, resultRef: receipt.resultRef }
    }
    const baseline = await promote(0, initialRef)
    const candidate = await promote(1, baseline.caseRef)
    const snapshot = await authority.state.read(fixture.request(), "cases", (state) => state.cases[initialRef.id])
    if (snapshot.status !== "ok" || !snapshot.value) throw new Error("Promoted BI case unavailable")
    expect(snapshot.value.alternatives).toHaveLength(2)
    expect(snapshot.value.choices).toHaveLength(0)
    for (const alternative of snapshot.value.alternatives) {
      expect(alternative.result).toMatchObject({ comparisonStatus: "conditioned", total: null, costCoverage: { coverageState: "pending" } })
      expect(alternative.result.costCoverage.entries.find((entry) => entry.categoryId === "service")?.status).toBe("included")
      expect(alternative.result.knownSubtotal).toBeGreaterThan(0)
    }
    const persisted = ok(await business.withCase(call, candidate.caseRef, {}, async () => {
      const selected = await deadline.phase("comparison.produce", () => portfolio.compare({ caseRef: candidate.caseRef,
        baselineAlternativeId: snapshot.value!.alternatives[0]!.id, alternativeId: snapshot.value!.alternatives[1]!.id, criteria: [] }, call))
      if (selected.status !== "ok") return selected
      expect(selected.value.comparison.comparisonStatus).toBe("conditioned")
      expect(selected.value.comparison.completeDifference).toBeNull()
      return deadline.phase("comparison.persist", () => business.calculations.persist({ kind: "comparison", request: selected.value.request,
        result: selected.value.comparison }, "bi-comparison", call))
    }), "Persist real BI comparison")
    const selectionRef = sfDecisionBiSelection({ scenarioResultRef: candidate.resultRef, comparisonRef: persisted.resultRef })
    const assets = createSfExtendedAssets()
    deadline.own(() => assets.dispose())
    const actualBi = createSfBiServices({ authority, business, portfolio })
    const dispatches = { positive: 0, replaysDenied: 0 }
    const bi: typeof actualBi = { ...actualBi,
      dispatchPresentation: async (request, context) => {
        // Observe and return the actual dispatcher output unchanged. Repeating
        // that exact call exercises the original one-use authority, not a
        // substitute validator or an invented successful response.
        const result = await actualBi.dispatchPresentation(request, context)
        if (result.status !== "ok") return result
        expect(result.value.receipt).toMatchObject({ kind: "ui", operation: "sf_bi_view", handlerExport: "readBiView", inputDigest: digestSfValue(request),
          resultDigest: digestSfValue(result.value.projection), principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision })
        if (context.kind !== "ui" || result.value.receipt.kind !== "ui") throw new Error("BI HTTP must retain the real UI receipt")
        expect(result.value.receipt.requestId).toBe(context.binding.requestId)
        dispatches.positive++
        const replay = await actualBi.dispatchPresentation(request, context)
        expect(replay.status).toBe("denied")
        expect(replay).not.toHaveProperty("value")
        dispatches.replaysDenied++
        return result
      },
    }
    const http = createSfExtendedHttp({ authority, business, bi, reviews: undefined, persistence, origin: "https://example.test", assets })
    // The actual empty Procurement queue also exercises its nested one-use
    // sf_work_list admission. Empty data is not an unavailable producer.
    const procurementOptions = await deadline.phase("bi05.options", () => http(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "bi-options", viewId: "BI05", start: period.start, end: period.end })}`, { signal: deadline.signal }), "dashboard"))
    expect(procurementOptions?.status).toBe(200)
    const procurement = await procurementOptions!.json()
    expect(procurement.status).toBe("ok")
    expect(procurement.value.choices).toHaveLength(1)
    expect(procurement.value.choices[0].label).toContain("0 registros")
    const browser = await deadline.phase("browser.prepare", () => prepareSfBiAccessBrowser({ http, signal: deadline.signal, selectionRef,
      privateReferences: [candidate.resultRef, persisted.resultRef],
      url: `https://example.test/dashboard?${new URLSearchParams({ sf: "bi", viewId: "BI09", selectionRef, start: period.start, end: period.end })}` }))
    deadline.own(() => browser.dispose())
    expect(dispatches.positive).toBeGreaterThan(0)
    expect(dispatches.replaysDenied).toBe(dispatches.positive)
    // Controlled ACL mutation, not a replacement reader or a logout. No result,
    // source, principal grant, session generation or policy revision is changed.
    await fixture.store.transaction("dashboard", async (state) => {
      const product = state.data.__sfProductV1 as SfProductState
      product.cases[initialRef.id]!.participants = []
      return { commit: true, value: undefined }
    })
    expect(fixture.active.value).toBe(true)
    expect(await authority.host.revalidate(call)).toBe(true)
    const stillAuthenticated = await fixture.read()
    try { expect(await authority.host.revalidate(stillAuthenticated)).toBe(true) }
    finally { authority.ui.finish(stillAuthenticated) }
    await deadline.phase("browser.revoke-case", () => browser.verifyAfterCaseRevocation())
    const revoked = await deadline.phase("bi09.revoked-data", () => http(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "bi-data", viewId: "BI09", selectionRef, start: period.start, end: period.end })}`, { signal: deadline.signal }), "dashboard"))
    expect(revoked?.status).toBe(403)
    const denied = await revoked!.json()
    expect(denied).toMatchObject({ status: "denied" })
    expect(denied).not.toHaveProperty("projection")
    expect(denied).not.toHaveProperty("presentation")
  } finally { await deadline.close() }
}, 120_000)
