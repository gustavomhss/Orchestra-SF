import { expect, test } from "bun:test"
import { createStoredScenarioBiProjection } from "../../../../product/analytics/stored-scenario.ts"
import { sameBiProjection } from "../../../../product/analytics/projection.ts"
import type { BiViewRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "../../wp05/engine-fixture.ts"
import { sfDecisionBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { sfBiDecisionNavigation, readSfBiDecisionDestination } from "../../../../../../../apps/cli/src/sucafina-product/extended-bi-navigation.ts"
import type { SfBiDecisionReaders } from "../../../../../../../apps/cli/src/sucafina-product/extended-bi-navigation.ts"
import { sfBiSourceNavigationKey } from "../../../../../../../apps/cli/src/sucafina-product/extended-bi-navigation-view.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

function ok<T>(value: PortResult<T>): T {
  if (value.status !== "ok") throw new Error(JSON.stringify(value))
  return value.value
}

/** Published domain fixture: real Planner, C08 results, cases and sensitivity.
 * Its source declarations and human grants are fixtures. This adapter check is
 * not a native proof or the still-blocked decision-promote browser workflow. */
async function producedNavigation() {
  const domain = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "omitted", composed: true })
  try {
    const selection = { scenarioResultRef: domain.selectedRef, comparisonRef: domain.comparisonRef, sensitivityResultRef: domain.saved.sensitivityResultRef }
    const request: BiViewRequest = { viewId: "BI11", selectionRef: sfDecisionBiSelection(selection), period: wp05Horizon }
    const readProjection = async () => {
      const found = await domain.planner.compareForecast({ baseRef: domain.scenario.baseRef, candidateRef: domain.scenario.baseRef, currency: "USD", period: wp05Horizon }, domain.context)
      return found.status === "ok" ? { status: "ok" as const, value: found.value.candidate } : found
    }
    const project = createStoredScenarioBiProjection({ results: domain.results, readSensitivity: domain.persistent.read, readProjection,
      revalidateProjection: async (_selection, expected, _caseRef, context) => {
        const current = await readProjection()
        return current.status === "ok" && sameBiProjection(current.value, expected) && await domain.host.revalidate(context)
      } })
    const projection = ok(await project({ ...selection, selectionRef: request.selectionRef }, domain.context))
    const readers: SfBiDecisionReaders = { results: domain.results, plannerSources: domain.sources, cases: domain.cases, context: domain.evidence,
      collaboration: { resolveQuestion: async () => ({ status: "unavailable", reason: "question-producer-not-in-this-domain-fixture" }) },
      sourceLinks: async () => [] }
    const catalog = sfBiDecisionNavigation(request, projection)
    const open = (token: string, snapshot = catalog.snapshot) => readSfBiDecisionDestination(request, projection, snapshot, token, domain.context, new URL("https://example.test/product/dashboard?sf=bi"), readers)
    return { domain, request, projection, catalog, open }
  } catch (error) { await domain.cleanup(); throw error }
}

test("BI decision destinations read the actual recorded scenario, comparison, sensitivity sample and cost coverage", async () => {
  const fixture = await producedNavigation()
  try {
    const { catalog, domain, projection, request } = fixture
    const scenario = catalog.entries.find((entry) => entry.kind === "result" && entry.key === domain.selectedRef)
    const comparison = catalog.entries.find((entry) => entry.kind === "result" && entry.key === domain.comparisonRef)
    const sample = catalog.entries.find((entry) => entry.kind === "result" && entry.key === domain.saved.sensitivity.evaluated[0]?.resultRef)
    const coverage = catalog.entries.find((entry) => entry.kind === "coverage" && entry.key === domain.comparison.costCoverageRefs[0])
    expect(scenario).toBeDefined(); expect(comparison).toBeDefined(); expect(sample).toBeDefined(); expect(coverage).toBeDefined()
    const result = ok(await fixture.open(scenario!.token))
    expect(result.reference).toBe(domain.selectedRef)
    expect(result.facts).toContainEqual({ label: "Subtotal conhecido", value: String(domain.selectedResult.knownSubtotal) })
    expect(result.facts).toContainEqual({ label: "Total completo", value: "Indisponível" })
    expect(ok(await fixture.open(comparison!.token)).reference).toBe(domain.comparisonRef)
    expect(ok(await fixture.open(sample!.token)).reference).toBe(domain.saved.sensitivity.evaluated[0]!.resultRef)
    const assessment = ok(await domain.sources.resolveForecastCoverage(coverage!.key, domain.context))
    expect(ok(await fixture.open(coverage!.token)).facts).toContainEqual({ label: "Cobertura", value: assessment.assessment.coverageState })
    const source = projection.decision?.kind === "scenario" ? projection.decision.scenario.components.find((item) => item.sourceRefs.length)?.sourceRefs[0] : undefined
    expect(source).toBeDefined()
    expect(catalog.entries.some((entry) => entry.kind === "source" && entry.key === sfBiSourceNavigationKey(source!))).toBe(true)
    expect(catalog.entries.some((entry) => entry.kind === "evidence" && entry.key === domain.selectedResult.sourceRefs[0]!.refDigest)).toBe(true)
    const reobserved = structuredClone(projection)
    for (const source of reobserved.context.sourceRefs) source.observedAt = "2026-11-14T20:00:00Z"
    for (const component of reobserved.components) for (const source of component.sourceRefs) source.observedAt = "2026-11-14T20:00:00Z"
    if (reobserved.decision?.kind === "scenario") for (const component of reobserved.decision.scenario.components) for (const source of component.sourceRefs) source.observedAt = "2026-11-14T20:00:00Z"
    expect(sfBiDecisionNavigation(request, reobserved)).toEqual(catalog)
  } finally { await fixture.domain.cleanup() }
}, 120_000)

test("BI decision destinations reject a foreign association, changed physical ref, changed authority and revoked source", async () => {
  const fixture = await producedNavigation()
  try {
    const { projection, request, catalog, domain } = fixture
    const scenario = catalog.entries.find((entry) => entry.kind === "result" && entry.key === domain.selectedRef)!
    const foreign = structuredClone(projection)
    if (foreign.decision?.kind !== "scenario") throw new Error("Scenario projection required")
    // Attacker-controlled pairing: a real but unselected result is not a
    // destination of this selection merely because its id exists in C08.
    foreign.decision.scenarioResultRef = domain.baselineRef
    foreign.decision.scenario = domain.baselineResult
    const forged = sfBiDecisionNavigation(request, foreign)
    const foreignToken = forged.entries.find((entry) => entry.kind === "result" && entry.key === domain.baselineRef)!.token
    expect(await fixture.open(foreignToken)).toEqual({ status: "denied", reason: "destination-outside-current-bi-selection" })
    expect(await fixture.open(scenario.token, forged.snapshot)).toEqual({ status: "denied", reason: "destination-outside-current-bi-selection" })
    const physical = structuredClone(projection)
    if (physical.decision?.kind !== "scenario") throw new Error("Scenario projection required")
    const changed = physical.decision.scenario.components.find((item) => item.sourceRefs.length)!.sourceRefs[0]!
    changed.incarnation = `${changed.incarnation}-recreated`
    const changedCatalog = sfBiDecisionNavigation(request, physical)
    const changedSource = changedCatalog.entries.find((entry) => entry.kind === "source" && entry.key === sfBiSourceNavigationKey(changed))!
    expect(await fixture.open(changedSource.token)).toMatchObject({ status: "denied" })
    const differentAuthority = structuredClone(projection); differentAuthority.context.accessRevision = "another-access-revision"
    expect(await fixture.open(scenario.token, sfBiDecisionNavigation(request, differentAuthority).snapshot)).toMatchObject({ status: "denied" })
    domain.revokeSource(domain.scenario.baseRef)
    const revoked = await fixture.open(scenario.token)
    expect(revoked.status).not.toBe("ok"); expect(revoked).not.toHaveProperty("value")
    domain.request.headers.set("authorization", "revoked")
    const session = await fixture.open(scenario.token)
    expect(session.status).toBe("denied"); expect(session).not.toHaveProperty("value")
  } finally { await fixture.domain.cleanup() }
}, 120_000)

test("BI decision HTTP rejects duplicate selectors and unassociated results through actual UI admission", async () => {
  const fixture = await financialCompositionFixture()
  try {
    const bi = createSfBiServices({ authority: fixture.authority, business: fixture.business, portfolio: fixture.portfolio })
    const http = createSfExtendedHttp({ authority: fixture.authority, business: fixture.business, bi, persistence: fixture.persistence,
      reviews: undefined, origin: "https://example.test", assets: { bi: async () => "", reviews: async () => "" } })
    const params = new URLSearchParams({ sf: "bi-decision", viewId: "BI09", selectionRef: sfDecisionBiSelection({ scenarioResultRef: "decision-result:foreign", comparisonRef: "decision-result:foreign-comparison" }), start: "2026-01-01", end: "2026-12-31", snapshot: "a".repeat(64), target: "b".repeat(64) })
    const response = await http(new Request(`https://example.test/dashboard?${params}`), "dashboard")
    expect(response?.status).toBe(403)
    expect(await response!.json()).not.toHaveProperty("value")
    params.append("target", "c".repeat(64))
    expect((await http(new Request(`https://example.test/dashboard?${params}`), "dashboard"))?.status).toBe(400)
    params.delete("target"); params.set("target", "b".repeat(64)); fixture.active.value = false
    expect((await http(new Request(`https://example.test/dashboard?${params}`), "dashboard"))?.status).toBe(403)
  } finally { await fixture.dispose() }
}, 120_000)
