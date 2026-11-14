import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DomainProjection, SourceRef } from "../../../../product/contracts/context.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../product/contracts/operations.ts"
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
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Each group creates its own real Planner/Portfolio evaluation, persisted result,
// Review receipt and authenticated HTTP consumer. Historical human selection and
// binding remain explicit C08 fixture data; no result or receipt is synthesized.
// Splitting independent counterproofs does not fix product latency or qualify
// Portfolio selection/C12 Apply. Every group requires hosted execution at the
// unchanged 105 s cooperative / 120 s outer budget.
async function reviewPortfolioFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => fixture.dispose())
    return fixture
  })
  const { authority, business, portfolio, persistence, guards } = fixture
  const assets = createSfExtendedAssets()
  deadline.own(() => assets.dispose())
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "history-case", incarnation: "history-incarnation", version: 1 }
  const call = await deadline.phase("fixture.authority", async () => {
    const call = await fixture.read()
    deadline.own(() => authority.ui.finish(call))
    return call
  })
  const browserChecks: { current?: Awaited<ReturnType<typeof prepareSfReviewAccessBrowser>> } = {}
  deadline.own(() => browserChecks.current?.dispose())
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
  const produced = await deadline.phase("portfolio.produce", () => business.withCase(call, caseRef, {}, async () => {
    const issued = await business.plannerProduct.issueSource("history-forecast", call)
    if (issued.status !== "ok") return issued
    const forecast = await deadline.phase("planner.forecast", () => business.planner.compareForecast({ baseRef: issued.value.evidence.refId, candidateRef: issued.value.evidence.refId, period, currency: "USD" }, call))
    if (forecast.status !== "ok") return forecast
    // A candidate must carry an actual operation. Select the real February
    // component; January is closed, and exclusion remains a hypothetical preview.
    const targets = forecast.value.baseline.components.filter((component) => component.period.start === "2026-02-01" && component.period.end === "2026-02-28")
    expect(targets).toHaveLength(1)
    const target = targets[0]
    if (!target || target.amount === null || target.currency !== "USD" || !target.sourceRefs.length) return { status: "unavailable", reason: "authorized-preview-target-unavailable" }
    expect(target.amount).toBeGreaterThan(0)
    const scenario: ScenarioRequest = { baseRef: issued.value.evidence.refId,
      operations: [{ kind: "exclude", targetRef: target.id, currency: target.currency, period: target.period }], assumptions: [] }
    const preview = await deadline.phase("planner.simulate", () => business.planner.simulateScenario(scenario, call))
    if (preview.status !== "ok") return preview
    expect(preview.value).toMatchObject({ comparisonStatus: "conditioned", total: null })
    expect(preview.value.components.find((component) => component.id === target.id)).toMatchObject({ amount: 0, evidenceState: "hypothetical" })
    expect(preview.value.restrictions).toContain("preview-not-applied")
    const unchanged = await deadline.phase("planner.forecast-unchanged", () => business.planner.compareForecast({ baseRef: issued.value.evidence.refId, candidateRef: issued.value.evidence.refId, period, currency: "USD" }, call))
    if (unchanged.status !== "ok") return unchanged
    expect(unchanged.value.baseline.components.find((component) => component.id === target.id)).toEqual(target)
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
      revalidate: authority.host.revalidate, createReceipt: async (context, operation, inputDigest, resultDigest) =>
        await authority.host.revalidate(context) ? business.receipt(context, operation, inputDigest, resultDigest) : undefined, decisions: portfolio.mutations, enabledOperations: ["sf_portfolio_evaluate"],
      persistence: { results: business.results, portfolioBindings: portfolio.portfolioBindings, caseFor: business.resolveCase, idempotencyKey: async (digest) => `history:${digest}` } })
    const evaluated = await deadline.phase("portfolio.evaluate", () => producer.port.evaluate(request, call))
    if (evaluated.status !== "ok") return evaluated
    const stored = await deadline.phase("portfolio.persist", () => business.results.write({ kind: "portfolio", result: evaluated.value, caseRef, requestDigest: digestSfValue(request),
      sourceRefs: evaluated.value.evidenceRefs, idempotencyKey: "history-portfolio" }, call))
    if (stored.status !== "ok" || stored.value.kind !== "portfolio") return { status: "unavailable", reason: "portfolio-result-not-committed" }
    const candidate = await createDecisionCandidateResolver(business.cases)(candidateRef, call)
    if (candidate.status !== "ok") return candidate
    return { status: "ok", value: { stored: stored.value, request, candidate: candidate.value } }
  }))
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
  const captureSelection = { projection: captured }
  const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => (await Promise.all(refs.map(async (ref) =>
    await historical.currentSource(ref, context) || await historical.historicalSource(ref, context)))).every(Boolean) && await authority.host.revalidate(context)
  // The published agenda has no direct Portfolio item. Capture a selected
  // authorized section with the real preserve port; all subsequent reads use
  // the unmodified default application and its authenticated HTTP consumer.
  const captureServices = createReviewServices({ state: authority.state, host: authority.host, authority: authority.authority, evidence: historical.evidence,
    creationTarget: authority.creationTarget, operationIdentity: business.operationIdentity, requiredAuthority: ["reviews:read"], maxBytes: 2 * 1024 * 1024, now: () => fixture.at,
    selection: { select: async () => ({ status: "ok", value: [{ id: "portfolio", title: "Selected Portfolio", period, recordCount: 1, projection: captureSelection.projection }] }),
      authorizeSections: (context, sections) => sources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: sources,
      authorizeDecision: decisions.authorizeDecision,
      authorizeComments: async (context, values) => !values.length && await authority.host.revalidate(context),
      authorizeSensitivity: async (context, values) => !values.length && await authority.host.revalidate(context),
      authorizeOutcome: async (context, values) => !values.length && await authority.host.revalidate(context),
      authorizeOutcomeComparison: async (context, values) => !values.length && await authority.host.revalidate(context) } })
  const human = createReviewHumanPort({ state: authority.state, reviews: captureServices.reviews, human: authority.human, ui: authority.ui, creationTarget: authority.creationTarget })
  const preserved = await deadline.phase("review.preserve", () => human.preserve(fixture.request("history-preserve"), { selectionRef: "selected-portfolio", sectionRefs: ["portfolio"] }))
  expect(preserved.status).toBe("ok")
  if (preserved.status !== "ok") throw new Error(preserved.reason)
  const original = structuredClone(preserved.value)
  const sealed = await authority.state.read(fixture.request(), "reviews", (state) => Object.entries(state.transactions).find(([, receipt]) =>
    receipt.namespace === "reviews" && !!receipt.value && typeof receipt.value === "object" && "reviewRef" in receipt.value && receipt.value.reviewRef === original.id))
  if (sealed.status !== "ok" || !sealed.value) throw new Error("Original Review receipt unavailable")
  const [receiptKey, receipt] = sealed.value
  const http = createSfExtendedHttp({ authority, business, bi, reviews: application, persistence, origin: "https://example.test", assets })
  const invoke = (request: Request) => deadline.phase(`http.${new URL(request.url).searchParams.get("sf")}`, () => http(new Request(request, { signal: deadline.signal }), "dashboard"))
  const get = (mode: string, ref = original.id) => invoke(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: mode, reviewRef: ref })}`))
  const getSource = () => invoke(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "review-source", reviewRef: original.id, referenceId: source.value.refId })}`))
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
  const post = (mode: string, payload: unknown, operation: string) => invoke(new Request(`https://example.test/dashboard?sf=${mode}`, { method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json", "x-operation": operation }, body: JSON.stringify(payload) }))
  const mutate = (work: (state: SfProductState) => void) => fixture.store.transaction("dashboard", async (snapshot) => {
    work(snapshot.data.__sfProductV1 as SfProductState); return { commit: true, value: undefined }
  })
  const reviewPageUrl = `https://example.test/dashboard?${new URLSearchParams({ sf: "review", reviewRef: original.id, sectionId: "portfolio", start: period.start, end: period.end })}`
  return { deadline, fixture, authority, business, persistence, assets, period, caseRef, call, browserChecks, stored,
    binding, bindingKey, application, bi, human, original, receiptKey, receipt, http, invoke, get, getSource, post, mutate, reviewPageUrl,
    captureSelection, sourceRef: source.value }
}

type ReviewPortfolioFixture = Awaited<ReturnType<typeof reviewPortfolioFixture>>

async function withReviewPortfolio(name: string, work: (fixture: ReviewPortfolioFixture) => Promise<void>) {
  const deadline = compositionTestDeadline(`review-portfolio-http.${name}`, 105_000)
  try { await work(await reviewPortfolioFixture(deadline)) }
  finally { await deadline.close() }
}

async function reportArtifact({ post, invoke, original }: ReviewPortfolioFixture) {
  const report = await post("review-report", { reviewRef: original.id, format: "docx", sectionRefs: ["portfolio"] }, "history-report")
  expect(report?.status).toBe(200)
  const reportBody = await report!.json()
  expect(reportBody.status).toBe("ok")
  const download = () => invoke(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "review-download", artifactRef: reportBody.outputRef })}`))
  const artifact = await download()
  expect(artifact?.status).toBe(200)
  expect((await artifact!.arrayBuffer()).byteLength).toBeGreaterThan(500)
  return { download }
}

async function preserveSuccessor({ deadline, human, fixture, original }: ReviewPortfolioFixture) {
  const successor = await deadline.phase("review.successor", () => human.preserve(fixture.request("history-successor"), { selectionRef: "selected-portfolio", sectionRefs: ["portfolio"], previousReviewRef: original.id }))
  if (successor.status !== "ok") throw new Error(successor.reason)
  return successor
}

test("Review grouped reads keep exact receipts and current authority without lending a proof to another invocation", async () => {
  await withReviewPortfolio("read-scope", async ({ application, authority, business, fixture, call, caseRef, original, mutate }) => {
    const scope = application.readScope
    const request = authority.host.requestFor(call)
    if (!scope || !request) throw new Error("Real Review read scope unavailable")
    await scope.run(request, async () => {
      const first = await application.reviews.read(original.id, call)
      expect(first.status).toBe("ok")
      if (first.status !== "ok") throw new Error(first.reason)
      const immutable = structuredClone(first.value)
      first.value.createdAt = "2026-01-02T00:00:00Z"
      const locked = await authority.state.read(request, "reviews", async () => {
        expect(business.lockedSourceFences()).toBeDefined()
        return application.reviews.read(original.id, call)
      })
      expect(locked.status).toBe("ok")
      if (locked.status !== "ok") throw new Error("Real C08 group unavailable")
      expect(locked.value).toEqual({ status: "ok", value: immutable })
      try {
        await mutate((state) => { state.cases[caseRef.id]!.participants = [] })
        expect(fixture.active.value).toBe(true)
        expect(await authority.host.revalidate(call)).toBe(true)
        await scope.prepare([original.id], call)
        const revoked = await authority.state.read(request, "reviews", () => application.reviews.read(original.id, call))
        expect(revoked.status).toBe("ok")
        if (revoked.status !== "ok") throw new Error("Real C08 group unavailable")
        expect(revoked.value.status).toBe("denied")
        expect(revoked.value).not.toHaveProperty("value")
      } finally { await mutate((state) => { state.cases[caseRef.id]!.participants = ["person"] }) }
      const restored = await application.reviews.read(original.id, call)
      expect(restored).toEqual({ status: "ok", value: immutable })
    })
    // A second invocation with the very same Request and call still needs its
    // own producer proof. A C08 reader cannot acquire it by borrowing the first.
    await scope.run(request, async () => {
      const next = await authority.state.read(request, "reviews", () => application.reviews.read(original.id, call))
      expect(next.status).toBe("ok")
      if (next.status !== "ok") throw new Error("Real C08 group unavailable")
      expect(next.value.status).toBe("denied")
      expect(next.value).not.toHaveProperty("value")
    })
    const replacement = await scope.run(new Request(request), () => application.reviews.read(original.id, call))
    expect(replacement.status).toBe("denied")
    expect(replacement).not.toHaveProperty("value")
  })
}, 120_000)

// R3-W13-SOURCE-EGRESS-02: preserve real bodies and receipts, pause only the
// actual BCS destination read, and change C08 without changing the session.
for (const revocation of ["current-case", "previous-case", "successor-body"] as const) {
  test(`Review source HTTP protects ${revocation} after destination resolution without exposing labels or URLs`, async () => {
    await withReviewPortfolio(`source-egress-${revocation}`, async ({ deadline, fixture, authority, business, bi, application, persistence, assets,
      call, caseRef, original, sourceRef, captureSelection, human, period, mutate }) => {
      let selected = original
      if (revocation !== "current-case") {
        // The successor intentionally has a distinct, real Dashboard source
        // and no Portfolio decision. It stays authorized when the original
        // case is revoked, so checking only the successor cannot pass the test.
        await persistence.transaction("dashboard", async (snapshot) => {
          const owners = snapshot.data.opexOwners as { id: string; name: string; budget: number }[]
          owners.push({ id: "successor-owner", name: "Successor source", budget: 2400 })
          return { commit: true, value: undefined }
        })
        const issued = await business.dashboardRecords.issue({ page: "OPEX Detail", recordType: "opexOwners", recordId: "successor-owner", fields: ["budget"], period }, call)
        if (issued.status !== "ok") throw new Error(issued.reason)
        const projected = await business.dashboardRecords.read(issued.value.refId, call)
        if (projected.status !== "ok") throw new Error(projected.reason)
        expect(projected.value.decision).toBeUndefined()
        expect(projected.value.values.flatMap((value) => [value.drilldown, ...value.sourceRefs]).some((ref) => ref?.refId === sourceRef.refId)).toBe(false)
        captureSelection.projection = projected.value
        const successor = await human.preserve(fixture.request("source-successor"), { selectionRef: "selected-successor-source",
          sectionRefs: ["portfolio"], previousReviewRef: original.id })
        if (successor.status !== "ok") throw new Error(successor.reason)
        selected = successor.value
        expect(selected.previousReviewRef).toBe(original.id)
        expect((await application.reviews.read(selected.id, call)).status).toBe("ok")
        expect((await application.reviews.read(original.id, call)).status).toBe("ok")
      }
      const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      let armed = false, destinationResolved = false
      const finalReads: { reference: string; locked: boolean }[] = []
      const observedBusiness = { ...business, context: { ...business.context,
        resolve: async (...args: Parameters<typeof business.context.resolve>) => {
          const result = await business.context.resolve(...args)
          if (armed) {
            armed = false
            expect(args[0]).toEqual(sourceRef)
            expect(result.state).toBe("fresh")
            expect(result.authorizedProjection).toBeDefined()
            destinationResolved = true
            reached.resolve()
            await release.promise
          }
          return result
        },
      } }
      const observedReviews = { ...application, reviews: { ...application.reviews,
        read: async (...args: Parameters<typeof application.reviews.read>) => {
          if (destinationResolved) finalReads.push({ reference: args[0], locked: !!business.lockedSourceFences() })
          return application.reviews.read(...args)
        },
      } }
      const http = createSfExtendedHttp({ authority, business: observedBusiness, bi, reviews: observedReviews, persistence, origin: "https://example.test", assets })
      const url = `https://example.test/dashboard?${new URLSearchParams({ sf: "review-source", reviewRef: selected.id, referenceId: sourceRef.refId })}`
      const invoke = () => deadline.phase("http.review-source", () => http(new Request(url, { signal: deadline.signal }), "dashboard"))
      const positive = await invoke()
      expect(positive?.status).toBe(200)
      const before = await positive!.json() as { links: { label: string; url: string }[] }
      expect(before.links.length).toBeGreaterThan(0)
      expect(before.links.every((link) => !!link.label && !!link.url)).toBe(true)
      armed = true
      const pending = invoke()
      try {
        await Promise.race([reached.promise, pending.then((response) => { throw new Error(`Review source did not reach its real destination: ${response?.status}`) })])
        expect(destinationResolved).toBe(true)
        if (revocation === "successor-body") {
          await mutate((state) => { state.reviews[selected.id] = { ...selected, createdAt: "2026-01-02T00:00:00Z" } })
          expect((await application.reviews.read(original.id, call)).status).toBe("ok")
        } else {
          await mutate((state) => { state.cases[caseRef.id]!.participants = [] })
          if (revocation === "previous-case") expect((await application.reviews.read(selected.id, call)).status).toBe("ok")
        }
        expect(fixture.active.value).toBe(true)
        expect(await authority.host.revalidate(call)).toBe(true)
        // The Dashboard source itself is still authorized and unchanged.
        expect((await business.context.resolve(sourceRef, call)).state).toBe("fresh")
        release.resolve()
        const denied = await pending
        expect(denied?.status).toBe(403)
        const text = await denied!.text()
        const body = JSON.parse(text)
        expect(body).toMatchObject({ status: "denied" })
        expect(body).not.toHaveProperty("links")
        expect(body).not.toHaveProperty("value")
        for (const link of before.links) {
          expect(text).not.toContain(link.label)
          expect(text).not.toContain(link.url)
        }
        expect(finalReads.map((entry) => entry.reference)).toEqual(revocation === "previous-case" ? [selected.id, original.id] : [selected.id])
        // Both protected producers use the same actual C08 read scope;
        // sequential unprotected rereads cannot satisfy this observation.
        expect(finalReads.every((entry) => entry.locked)).toBe(true)
      } finally {
        release.resolve()
        await pending.catch(() => undefined)
        await mutate((state) => { state.cases[caseRef.id]!.participants = ["person"]; state.reviews[selected.id] = selected })
      }
      destinationResolved = false
      const recovered = await invoke()
      expect(recovered?.status).toBe(200)
      expect(await recovered!.json()).toEqual(before)
    })
  }, 120_000)
}

test("default Review HTTP retains the persisted Portfolio at N after the case reaches N+1", async () => {
  await withReviewPortfolio("historical-page", async ({ invoke, original, period, stored }) => {
    const page = await invoke(new Request(`https://example.test/dashboard?${new URLSearchParams({ sf: "review", reviewRef: original.id, sectionId: "portfolio", start: period.start, end: period.end })}`))
    expect(page?.status).toBe(200)
    expect(await page!.text()).toContain(stored.resultRef)
  })
}, 120_000)

test("Review creates a real report and download and rejects both case and session revocation", async () => {
  await withReviewPortfolio("report-download", async (context) => {
    const { fixture, get, mutate, caseRef } = context
    const { download } = await reportArtifact(context)
    await mutate((state) => { state.cases[caseRef.id]!.participants = [] })
    expect((await get("review-read"))?.status).toBe(403)
    expect((await download())?.status).toBe(403)
    await mutate((state) => { state.cases[caseRef.id]!.participants = ["person"] })
    // Reopen the actual artifact with restored membership before the independent
    // session denial. The downloaded bytes were produced by review-report above.
    expect((await get("review-read"))?.status).toBe(200)
    expect((await download())?.status).toBe(200)
    fixture.active.value = false
    expect((await get("review-read"))?.status).toBe(403)
    expect((await download())?.status).toBe(403)
  })
}, 120_000)

test("Review compares an actually preserved historical Portfolio successor", async () => {
  await withReviewPortfolio("successor-comparison", async (context) => {
    const { get } = context
    const successor = await preserveSuccessor(context)
    const compared = await get("review-comparison", successor.value.id)
    expect(compared?.status).toBe(200)
    expect(await compared!.json()).toMatchObject({ status: "ok", value: { comparison: { state: "compared" } } })
  })
}, 120_000)

// R1-D1-HTTP-EGRESS-01: each revocation variant has its own positive history and
// real asset build. Access changes while delivery awaits the final asset gate.
for (const revocation of ["case", "session"] as const) {
  test(`Review HTTP fences ${revocation} revocation after reading the real browser asset and recovers`, async () => {
    await withReviewPortfolio(`egress-${revocation}`, async ({ deadline, authority, business, bi, application, persistence, assets, reviewPageUrl, fixture, mutate, caseRef, call, stored, invoke }) => {
      const gate = { reached: () => {}, release: () => {}, script: "" }
      const reached = new Promise<void>((resolve) => { gate.reached = resolve })
      const released = new Promise<void>((resolve) => { gate.release = resolve })
      const gatedHttp = createSfExtendedHttp({ authority, business, bi, reviews: application, persistence, origin: "https://example.test",
        assets: { bi: assets.bi, reviews: async () => {
          // Preserve the actual built asset; neither HTTP output nor an access
          // decision is replaced. Hold only delivery after the real await.
          const script = await assets.reviews()
          gate.script = script
          gate.reached()
          await released
          return script
        } } })
      const pendingPage = deadline.phase(`egress.${revocation}.page`, () => gatedHttp(new Request(reviewPageUrl, { signal: deadline.signal }), "dashboard"))
      try {
        await Promise.race([reached, pendingPage.then((response) => {
          throw new Error(`Review did not reach the final asset gate: ${response?.status ?? "no-response"}`)
        })])
        expect(gate.script.length).toBeGreaterThan(0)
        if (revocation === "case") {
          await mutate((state) => { state.cases[caseRef.id]!.participants = [] })
          expect(fixture.active.value).toBe(true)
          expect(await authority.host.revalidate(call)).toBe(true)
          const authenticated = await fixture.read()
          try { expect(await authority.host.revalidate(authenticated)).toBe(true) }
          finally { authority.ui.finish(authenticated) }
        } else {
          fixture.active.value = false
        }
        gate.release()
        const denied = await pendingPage
        expect(denied?.status, `Review egress after ${revocation} revocation`).toBe(403)
        expect(denied!.headers.get("content-type")).toContain("application/json")
        const text = await denied!.text()
        const body = JSON.parse(text)
        expect(body).toMatchObject({ status: "denied" })
        expect(body).not.toHaveProperty("value")
        expect(body).not.toHaveProperty("selectedSection")
        expect(body).not.toHaveProperty("bootstrap")
        expect(text).not.toContain("data-sf-review-bootstrap")
        expect(text).not.toContain("<script")
        expect(text).not.toContain("Selected Portfolio")
        expect(text).not.toContain(stored.resultRef)
      } finally {
        gate.release()
        await pendingPage.catch(() => undefined)
        fixture.active.value = true
        await mutate((state) => { state.cases[caseRef.id]!.participants = ["person"] })
      }
      // Each race leaves a recoverable authorized application. A fresh request
      // must reopen the real selected content after restoring the same access.
      const recovered = await invoke(new Request(reviewPageUrl))
      expect(recovered?.status, `Review recovery after ${revocation} revocation`).toBe(200)
      const restored = await recovered!.text()
      expect(restored).toContain("data-sf-review-bootstrap")
      expect(restored).toContain("Selected Portfolio")
      expect(restored).toContain(stored.resultRef)
    })
  }, 120_000)
}

test("Review browser clears selected content after case revocation while the session remains authenticated", async () => {
  await withReviewPortfolio("browser-case-revocation", async ({ deadline, browserChecks, http, assets, original, period, mutate, caseRef, fixture, authority, call, get, getSource }) => {
    await deadline.phase("browser.prepare", async () => {
      // Own the browser before phase's post-await deadline check can throw.
      browserChecks.current = await prepareSfReviewAccessBrowser({ http, reviewAsset: assets.reviews, signal: deadline.signal, privateText: "Selected Portfolio",
        url: `https://example.test/dashboard?${new URLSearchParams({ sf: "review", reviewRef: original.id, sectionId: "portfolio", start: period.start, end: period.end })}` })
    })
    await mutate((state) => { state.cases[caseRef.id]!.participants = [] })
    // The principal remains authenticated and can get a new read admission.
    // Only access to this case has been removed, which must clear the page just
    // like a denied source read; it is not a logout or an expired UI lease.
    expect(fixture.active.value).toBe(true)
    expect(await authority.host.revalidate(call)).toBe(true)
    const stillAuthenticated = await fixture.read()
    expect(await authority.host.revalidate(stillAuthenticated)).toBe(true)
    authority.ui.finish(stillAuthenticated)
    await deadline.phase("browser.revoke-case", () => browserChecks.current!.verifyAfterCaseRevocation())
    await browserChecks.current!.dispose()
    browserChecks.current = undefined
    for (const denied of [await get("review"), await getSource(), await get("review-update")]) {
      expect(denied?.status).toBe(403)
      const body = await denied!.json()
      expect(body).toMatchObject({ status: "denied" })
      expect(body).not.toHaveProperty("value")
      expect(body).not.toHaveProperty("selectedSection")
    }
    expect((await get("review-read"))?.status).toBe(403)
  })
}, 120_000)

test("Review historical HTTP rejects a replacement case incarnation and recovers the original", async () => {
  await withReviewPortfolio("case-integrity", async ({ mutate, caseRef, get }) => {
    await mutate((state) => { state.cases[caseRef.id]!.participants = ["person"]; state.cases[caseRef.id]!.incarnation = "replacement" })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.cases[caseRef.id]!.incarnation = caseRef.incarnation })
    expect((await get("review-read"))?.status).toBe(200)
  })
}, 120_000)

test("Review historical HTTP rejects an altered Portfolio binding and recovers the actual binding", async () => {
  await withReviewPortfolio("binding-integrity", async ({ mutate, caseRef, bindingKey, binding, get }) => {
    await mutate((state) => { state.cases[caseRef.id]!.incarnation = caseRef.incarnation; state.preferences[bindingKey] = { ...binding, resultDigest: "0".repeat(64) } })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.preferences[bindingKey] = binding })
    expect((await get("review-read"))?.status).toBe(200)
  })
}, 120_000)

test("Review historical HTTP rejects an altered stored Portfolio result and recovers the real result", async () => {
  await withReviewPortfolio("result-integrity", async ({ mutate, bindingKey, binding, stored, get }) => {
    await mutate((state) => { state.preferences[bindingKey] = binding; state.decisionResults![stored.resultRef] = { ...stored, resultDigest: "0".repeat(64) } })
    expect((await get("review-read"))?.status).toBe(403)
    await mutate((state) => { state.decisionResults![stored.resultRef] = stored })
    expect((await get("review-read"))?.status).toBe(200)
  })
}, 120_000)

test("Review rejects an altered body despite a legitimate successor and preserves history after a real source edit", async () => {
  await withReviewPortfolio("body-source-and-backlink", async (context) => {
    const { mutate, stored, original, get, persistence, getSource } = context
    const successor = await preserveSuccessor(context)
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
  })
}, 120_000)

test("Review historical capture needs its own intact receipt after a source edit despite a legitimate successor", async () => {
  await withReviewPortfolio("receipt-integrity", async (context) => {
    const { mutate, receiptKey, receipt, original, persistence, get } = context
    const successor = await preserveSuccessor(context)
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]; return { commit: true, value: undefined } })
    // The unchanged body and its actual receipt authorize the history first.
    expect((await get("review-read"))?.status).toBe(200)
    await mutate((state) => { state.transactions[receiptKey] = { ...receipt, value: { schema: "sf-review-receipt-v1", reviewRef: original.id, reviewDigest: "0".repeat(64) } } })
    expect((await get("review-read"))?.status).toBe(403)
    expect((await get("review-read", successor.value.id))?.status).toBe(200)
    await mutate((state) => { state.transactions[receiptKey] = receipt })
    expect((await get("review-read"))?.status).toBe(200)
  })
}, 120_000)
