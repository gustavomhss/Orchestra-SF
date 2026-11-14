import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DomainProjection, SourceRef } from "../../../../product/contracts/context.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../../product/portfolio/candidates.ts"
import { createProductionPortfolio } from "../../../../product/portfolio/production.ts"
import { createReviewServices } from "../../../../product/reviews/services.ts"
import { createReviewHumanPort } from "../../../../product/reviews/human.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { createSfReviewServices } from "../../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import { createSfReviewPortfolioHistory } from "../../../../../../../apps/cli/src/sucafina-product/review-portfolio-history.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import { createSfExtendedAssets } from "../../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { prepareSfReviewAccessBrowser } from "./review-access-browser-fixture.ts"

// Real Planner/Portfolio evaluation, result persistence, Review receipt, HTTP and
// report/download consumers. The historical human selection/binding is explicit
// C08 fixture data; this does not qualify a new Portfolio selection or C12 Apply.
test("default Review HTTP retains a persisted Portfolio at N after the case reaches N+1 and suppresses revoked history", async () => {
  const fixture = await financialCompositionFixture()
  const { authority, business, portfolio, persistence, guards } = fixture
  const assets = createSfExtendedAssets()
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "history-case", incarnation: "history-incarnation", version: 1 }
  const call = await fixture.read()
  const browserChecks: { current?: Awaited<ReturnType<typeof prepareSfReviewAccessBrowser>> } = {}
  try {
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "history-forecast", name: "Historical forecast", year: 2026, closed: 1,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Historical Portfolio", horizon: period, currency: "USD", criteria: [],
      participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(fixture.request("history-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "history-case", commandDigest: digestSfValue(initial) },
    async (state) => { state.cases[initial.id] = initial; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Case fixture was not committed")
    business.bindForecastCoverage(async (reference, context) => {
      const source = await business.plannerSources.resolveForecastSource(reference, context)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: "fixture:history-pending-coverage", basis: { id: "history-basis", version: 1, decisionType: "renewal-transition-v1",
        categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] }, assessment: { basisId: "history-basis", basisVersion: 1,
        alternativeId: "selected", alternativeVersion: 1, currency: "USD", horizon: period, issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence],
        coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
    })
    const produced = await business.withCase(call, caseRef, {}, async () => {
      const issued = await business.plannerProduct.issueSource("history-forecast", call)
      if (issued.status !== "ok") return issued
      // A Portfolio candidate must carry a real, replayable operation. The
      // producer intentionally rejects an empty baseline as a candidate.
      const scenario = { baseRef: issued.value.evidence.refId, operations: [{ kind: "replace" as const, targetRef: "line:2", amount: 110,
        currency: "USD", period: { start: "2026-02-01", end: "2026-02-28" } }], assumptions: [] }
      const preview = await business.planner.simulateScenario(scenario, call)
      if (preview.status !== "ok") return preview
      const current = await authority.state.read(fixture.request(), "cases", (state) => state.cases[caseRef.id])
      if (current.status !== "ok") return { status: "unavailable", reason: "case-fixture-unavailable" }
      const changed = await authority.state.transaction(fixture.request("history-alternative"), { namespace: "cases", expectedStorageVersion: current.storageVersion,
        targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "history-alternative", commandDigest: digestSfValue(preview.value) }, async (state) => {
        state.cases[caseRef.id] = { ...initial, sourceRefs: [issued.value.evidence], alternatives: [{ id: "selected", version: 1, title: "Selected", scenario, result: preview.value }] }
        return { commit: true, value: true }
      })
      if (changed.status !== "ok") return { status: "unavailable", reason: "alternative-fixture-unavailable" }
      const candidateRef = portfolioCandidateRef({ caseRef: encodeCaseRef(caseRef), caseVersion: caseRef.version, alternativeId: "selected", alternativeVersion: 1 })
      const request = { scope: { horizon: period, currency: "USD" }, candidateRefs: [candidateRef], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
      const producer = createProductionPortfolio({ cases: business.cases, planner: business.planner, sources: business.plannerSources, evidence: business.context,
        revalidate: authority.host.revalidate, createReceipt: business.receipt, decisions: portfolio.mutations, enabledOperations: ["sf_portfolio_evaluate"],
        persistence: { results: business.results, portfolioBindings: portfolio.portfolioBindings, caseFor: business.resolveCase, idempotencyKey: async (digest) => `history:${digest}` } })
      const evaluated = await producer.port.evaluate(request, call)
      if (evaluated.status !== "ok") return evaluated
      const stored = await business.results.write({ kind: "portfolio", result: evaluated.value, caseRef, requestDigest: digestSfValue(request),
        sourceRefs: evaluated.value.evidenceRefs, idempotencyKey: "history-portfolio" }, call)
      if (stored.status !== "ok" || stored.value.kind !== "portfolio") return { status: "unavailable", reason: "portfolio-result-not-committed" }
      const candidate = await createDecisionCandidateResolver(business.cases)(candidateRef, call)
      if (candidate.status !== "ok") return candidate
      return { status: "ok", value: { stored: stored.value, request, candidate: candidate.value } }
    })
    expect(produced.status, produced.status !== "ok" ? produced.reason : undefined).toBe("ok")
    if (produced.status !== "ok") throw new Error(produced.reason)
    const { stored, request, candidate } = produced.value
    expect(stored.result.combinations[0]!.eligibility).toBe("conditioned")
    expect(stored.result.combinations[0]!.comparisonStatus).toBe("conditioned")
    // Explicit historical selection fixture, preserved as data in C08. No
    // permissive replacement for the production historical reader is installed.
    const selectionBody = { schema: "sf-portfolio-selection-v1", selectionRef: "portfolio-selection:history-fixture", caseRef,
      baselineAlternativeId: "selected", alternativeId: "selected", baselineRef: "fixture-baseline", alternativeRef: "fixture-alternative", criteria: [],
      comparisonDigest: digestSfValue(stored.result), version: 1, principalRef: "person", accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion, createdAt: fixture.at }
    const selection = { ...selectionBody, selectionDigest: digestSfValue(selectionBody) }
    const bindingBody = { schema: "sf-portfolio-binding-v1", caseRef, resultRef: stored.resultRef, resultDigest: stored.resultDigest, request,
      requestDigest: stored.requestDigest, proof: { candidates: [{ ref: request.candidateRefs[0]!, digest: digestSfValue(candidate) }], selectionDigest: selection.selectionDigest }, createdAt: fixture.at }
    const binding = { ...bindingBody, bindingDigest: digestSfValue(bindingBody) }
    const bindingKey = `sf:criterion-rule:portfolio:${digestSfValue(stored.resultRef)}`
    const versions = await authority.state.read(fixture.request(), "preferences", (state) => state.versions)
    if (versions.status !== "ok") throw new Error("Preferences unavailable")
    const capture = async (state: SfProductState) => {
      state.preferences[`sf:criterion-rule:selection:history:${selection.selectionRef}`] = selection
      state.preferences[bindingKey] = binding
      return { commit: true, value: true }
    }
    guards.proposalCoverageWrites.add(capture)
    const bound = await authority.state.transaction(fixture.request("history-binding"), { namespace: "preferences", domainSurface: "planner",
      expectedStorageVersion: versions.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation,
      idempotencyKey: "history-binding", commandDigest: digestSfValue(binding) }, capture).finally(() => guards.proposalCoverageWrites.delete(capture))
    if (bound.status !== "ok") throw new Error("Historical binding fixture was not committed")
    const bi = createSfBiServices({ authority, business, portfolio })
    const composed = createSfReviewServices({ authority, business, portfolio, bi, persistence, origin: "https://example.test" })
    const application = composed.application
    if (!application) throw new Error("Default Review application unavailable")
    const historical = composed.historical!
    const decisions = createSfReviewPortfolioHistory({ authority, business, portfolio, evidence: historical.evidence,
      sensitivity: { read: async () => ({ status: "unavailable", reason: "no-sensitivity-in-fixture" }) } })
    const source = await business.dashboardRecords.issue({ page: "OPEX Detail", recordType: "opexOwners", recordId: "owner", fields: ["budget"], period }, call)
    if (source.status !== "ok") throw new Error(source.reason)
    const projection = await business.dashboardRecords.read(source.value.refId, call)
    if (projection.status !== "ok") throw new Error(projection.reason)
    const captured: DomainProjection = { ...projection.value, decision: { kind: "portfolio", portfolioResultRef: stored.resultRef, portfolio: stored.result } }
    const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => (await Promise.all(refs.map(async (ref) =>
      await historical.currentSource(ref, context) || await historical.historicalSource(ref, context)))).every(Boolean) && await authority.host.revalidate(context)
    // The published agenda has no direct Portfolio item. Capture a selected
    // authorized section with the real preserve port; all subsequent reads use
    // the unmodified default application and its authenticated HTTP consumer.
    const captureServices = createReviewServices({ state: authority.state, host: authority.host, authority: authority.authority, evidence: historical.evidence,
      creationTarget: authority.creationTarget, operationIdentity: business.operationIdentity, requiredAuthority: ["reviews:read"], maxBytes: 2 * 1024 * 1024, now: () => fixture.at,
      selection: { select: async () => ({ status: "ok", value: [{ id: "portfolio", title: "Selected Portfolio", period, recordCount: 1, projection: captured }] }),
        authorizeSections: (context, sections) => sources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: sources,
        authorizeDecision: decisions.authorizeDecision,
        authorizeComments: async (context, values) => !values.length && await authority.host.revalidate(context),
        authorizeSensitivity: async (context, values) => !values.length && await authority.host.revalidate(context),
        authorizeOutcome: async (context, values) => !values.length && await authority.host.revalidate(context),
        authorizeOutcomeComparison: async (context, values) => !values.length && await authority.host.revalidate(context) } })
    const human = createReviewHumanPort({ state: authority.state, reviews: captureServices.reviews, human: authority.human, ui: authority.ui, creationTarget: authority.creationTarget })
    const preserved = await human.preserve(fixture.request("history-preserve"), { selectionRef: "selected-portfolio", sectionRefs: ["portfolio"] })
    expect(preserved.status).toBe("ok")
    if (preserved.status !== "ok") throw new Error(preserved.reason)
    const original = structuredClone(preserved.value)
    const sealed = await authority.state.read(fixture.request(), "reviews", (state) => Object.entries(state.transactions).find(([, receipt]) =>
      receipt.namespace === "reviews" && !!receipt.value && typeof receipt.value === "object" && "reviewRef" in receipt.value && receipt.value.reviewRef === original.id))
    if (sealed.status !== "ok" || !sealed.value) throw new Error("Original Review receipt unavailable")
    const [receiptKey, receipt] = sealed.value
    const http = createSfExtendedHttp({ authority, business, bi, reviews: application, persistence, origin: "https://example.test", assets })
    const get = (mode: string, ref = original.id) => http(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: mode, reviewRef: ref })}`), "dashboard")
    const getSource = () => http(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "review-source", reviewRef: original.id, referenceId: source.value.refId })}`), "dashboard")
    const first = await get("review-read")
    expect(first?.status).toBe(200)
    expect(await first!.json()).toEqual(preserved)
    const advance = await authority.state.read(fixture.request(), "cases", (state) => state.cases[caseRef.id]!)
    if (advance.status !== "ok") throw new Error("Current case unavailable")
    const advanced = await authority.state.transaction(fixture.request("history-advance"), { namespace: "cases", expectedStorageVersion: advance.storageVersion,
      targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "history-advance", commandDigest: digestSfValue({ version: 2 }) }, async (state) => {
      state.cases[caseRef.id] = { ...state.cases[caseRef.id]!, version: 2, objective: "Ordinary case progress" }
      return { commit: true, value: true }
    })
    if (advanced.status !== "ok") throw new Error("Case did not advance")
    // A fresh GET owns no private business.withCase binding. The historical
    // reader must derive its case only from the authenticated stored result.
    expect((await business.resolveCase(call)).status).toBe("unavailable")
    expect((await business.results.read({ kind: "portfolio", resultRef: stored.resultRef }, call)).status).toBe("denied")
    const reopened = await get("review-read")
    expect(reopened?.status).toBe(200)
    expect(await reopened!.json()).toEqual({ status: "ok", value: original })
    const page = await http(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "review", reviewRef: original.id, sectionId: "portfolio", start: period.start, end: period.end })}`), "dashboard")
    expect(page?.status).toBe(200)
    expect(await page!.text()).toContain(stored.resultRef)
    const post = (mode: string, payload: unknown, operation: string) => http(new Request(`https://example.test/dashboard?sf=${mode}`, { method: "POST",
      headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": operation }, body: JSON.stringify(payload) }), "dashboard")
    const report = await post("review-report", { reviewRef: original.id, format: "docx", sectionRefs: ["portfolio"] }, "history-report")
    expect(report?.status).toBe(200)
    const reportBody = await report!.json()
    expect(reportBody.status).toBe("ok")
    const download = () => http(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "review-download", artifactRef: reportBody.outputRef })}`), "dashboard")
    const artifact = await download()
    expect(artifact?.status).toBe(200)
    expect((await artifact!.arrayBuffer()).byteLength).toBeGreaterThan(500)
    const successor = await human.preserve(fixture.request("history-successor"), { selectionRef: "selected-portfolio", sectionRefs: ["portfolio"], previousReviewRef: original.id })
    if (successor.status !== "ok") throw new Error(successor.reason)
    const compared = await get("review-comparison", successor.value.id)
    expect(compared?.status).toBe(200)
    expect(await compared!.json()).toMatchObject({ status: "ok", value: { comparison: { state: "compared" } } })
    const mutate = (work: (state: SfProductState) => void) => fixture.store.transaction("dashboard", async (snapshot) => {
      work(snapshot.data.__sfProductV1 as SfProductState); return { commit: true, value: undefined }
    })
    browserChecks.current = await prepareSfReviewAccessBrowser({ http, privateText: "Selected Portfolio",
      url: `https://example.test/dashboard?${new URLSearchParams({ sf: "review", reviewRef: original.id, sectionId: "portfolio", start: period.start, end: period.end })}` })
    await mutate((state) => { state.cases[caseRef.id]!.participants = [] })
    // The principal remains authenticated and can get a new read admission.
    // Only access to this case has been removed, which must clear the page just
    // like a denied source read; it is not a logout or an expired UI lease.
    expect(fixture.active.value).toBe(true)
    expect(await authority.host.revalidate(call)).toBe(true)
    const stillAuthenticated = await fixture.read()
    expect(await authority.host.revalidate(stillAuthenticated)).toBe(true)
    authority.ui.finish(stillAuthenticated)
    await browserChecks.current.verifyAfterCaseRevocation()
    await browserChecks.current.dispose()
    browserChecks.current = undefined
    for (const denied of [await get("review"), await getSource(), await get("review-update")]) {
      expect(denied?.status).toBe(403)
      const body = await denied!.json()
      expect(body).toMatchObject({ status: "denied" })
      expect(body).not.toHaveProperty("value")
      expect(body).not.toHaveProperty("selectedSection")
    }
    expect((await get("review-read"))?.status).toBe(403)
    expect((await download())?.status).toBe(403)
    await mutate((state) => { state.cases[caseRef.id]!.participants = ["person"]; state.cases[caseRef.id]!.incarnation = "replacement" })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.cases[caseRef.id]!.incarnation = caseRef.incarnation; state.preferences[bindingKey] = { ...binding, resultDigest: "0".repeat(64) } })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.preferences[bindingKey] = binding; state.decisionResults![stored.resultRef] = { ...stored, resultDigest: "0".repeat(64) } })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.decisionResults![stored.resultRef] = stored; state.reviews[original.id] = { ...original, createdAt: "2026-01-02T00:00:00Z" } })
    // The legitimate successor cites exactly the same source and must not
    // authorize a different body's tampered receipt/capture.
    expect((await get("review-read", successor.value.id))?.status).toBe(200)
    expect((await get("review-read"))?.status).toBe(403)
    // Source-history receipt validation protects captures after a source edit.
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]; return { commit: true, value: undefined } })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.reviews[original.id] = original })
    expect((await get("review-read"))?.status).toBe(200)
    // An ordinary source edit leaves the preserved Review authorized. A stale
    // backlink remains 409 and must not be mislabeled as access revocation.
    expect((await get("review"))?.status).toBe(200)
    const staleSource = await getSource()
    expect(staleSource?.status).toBe(409)
    expect(await staleSource!.json()).toEqual({ status: "unavailable", reason: "source-or-destination-period-unavailable" })
    await mutate((state) => { state.transactions[receiptKey] = { ...receipt, value: { schema: "sf-review-receipt-v1", reviewRef: original.id, reviewDigest: "0".repeat(64) } } })
    expect((await get("review-read"))?.status).toBe(403)
    expect((await get("review-read", successor.value.id))?.status).toBe(200)
    await mutate((state) => { state.transactions[receiptKey] = receipt })
    expect((await get("review-read"))?.status).toBe(200)
    fixture.active.value = false
    expect((await get("review-read"))?.status).toBe(403)
    expect((await download())?.status).toBe(403)
  } finally {
    try { await browserChecks.current?.dispose() }
    finally { authority.ui.finish(call); assets.dispose(); await fixture.dispose() }
  }
}, 120_000)
