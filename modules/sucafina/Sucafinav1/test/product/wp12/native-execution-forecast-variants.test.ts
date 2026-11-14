import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { ForecastExplainInput } from "../../../product/contracts/skill-inputs.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload,
  withWp12NativeMissionHost, type Wp12NativeMissionContext } from "./native-mission-harness.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
// Keep the objective unchanged between variants. Only the domain source data
// changes; no expected number, missing field or answer is supplied to the model.
const objective = "Explique a comparação entre os forecasts selecionados. Invoque sf_forecast_compare e preserve o FinancialAnalysis canônico, suas fontes e limitações. Não invente causa, conversão, cobertura ou valor ausente."
const annual = (first: number | null = 50_000) => [first, ...Array<number>(10).fill(50_000), 40_000]
type Variant = { id: string; base: readonly (number | null)[]; candidate: readonly (number | null)[]; currency: string;
  expectedDifference: number | null; missing?: "missing-fx" | "missing" }
const variants: readonly Variant[] = [
  { id: "increase-12000", base: annual(), candidate: annual(62_000), currency: "USD", expectedDifference: 12_000 },
  { id: "increase-6000", base: annual(), candidate: annual(56_000), currency: "USD", expectedDifference: 6_000 },
  { id: "unchanged", base: annual(), candidate: annual(), currency: "USD", expectedDifference: 0 },
  { id: "observed-zero", base: Array<number>(12).fill(0), candidate: Array<number>(12).fill(0), currency: "USD", expectedDifference: 0 },
  { id: "missing-fx", base: annual(), candidate: annual(62_000), currency: "BRL", expectedDifference: null, missing: "missing-fx" },
  { id: "missing-month", base: annual(), candidate: annual(null), currency: "USD", expectedDifference: null, missing: "missing" },
]

function verifyInput(input: ForecastExplainInput, variant: Variant) {
  const analysis = input.forecastComparison
  expect(input.selectedPeriod).toEqual(period)
  expect(input.currency).toBe("USD")
  expect(input.sourceRefs).toEqual(analysis.sourceRefs)
  expect(input.sourceRefs).toHaveLength(2)
  expect(analysis.knownDifference).toBe(variant.expectedDifference)
  expect(analysis.comparison.knownDifference).toBe(variant.expectedDifference)
  expect(analysis.baseline.components.filter((component) => component.id.startsWith("wp12-variant-service:"))).toHaveLength(12)
  expect(analysis.candidate.components.filter((component) => component.id.startsWith("wp12-variant-service:"))).toHaveLength(12)
  // These domain sources do not establish a C10 cost coverage basis. A known
  // arithmetic difference must never be promoted to a complete comparison.
  expect(analysis.comparison.comparisonStatus).toBe("conditioned")
  expect(analysis.completeDifference).toBeNull()
  expect(analysis.comparison.completeDifference).toBeNull()
  expect(analysis.gaps).toContain("cost-coverage-unavailable")
  expect(analysis.analysisBasis).toBe("domain")
  if (variant.missing) {
    expect(analysis.gaps.some((gap) => gap.endsWith(`:${variant.missing}`))).toBe(true)
    expect(analysis.candidate.components.some((component) => component.amount === null && component.evidenceState === "absent")).toBe(true)
    expect(analysis.comparison.knownDifference).toBeNull()
  } else {
    if (variant.expectedDifference === null) throw new Error("A known forecast variant requires a numeric expected difference")
    const sum = (side: typeof analysis.baseline) => side.components.reduce((total, component) => {
      if (component.amount === null) throw new Error("Known forecast unexpectedly contains an absent component")
      return total + component.amount
    }, 0)
    expect(sum(analysis.candidate) - sum(analysis.baseline)).toBe(variant.expectedDifference)
    expect(analysis.baseline.components.every((component) => component.evidenceState === "confirmed")).toBe(true)
    expect(analysis.candidate.components.every((component) => component.evidenceState === "confirmed")).toBe(true)
    if (variant.id === "observed-zero") expect(analysis.candidate.components.every((component) => component.amount === 0)).toBe(true)
    else {
      expect(sum(analysis.baseline)).toBe(590_000)
      expect(sum(analysis.candidate)).toBe(590_000 + variant.expectedDifference)
    }
  }
  expect(input.registeredReasons).toEqual([])
}

async function domainDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("planner", async (snapshot) => ({ commit: false,
    value: digestSfValue({ versions: snapshot.data.versions, officials: snapshot.data.officials }) }))
}

for (const variant of variants) test(`real host Finance prepares ${variant.id} and verifies native output when an installed model is available`, async () => {
  await withWp12NativeMissionHost({ label: `forecast-${variant.id}`,
    operations: ["sf_case_draft", "sf_case_read", "sf_forecast_compare", "sf_context_get", "sf_source_get", "sf_evidence_get", "sf_freshness_check"],
    initialize: async (persistence) => {
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [variant.base, variant.candidate].map((amounts, index) => ({
          id: `wp12-variant-${index}`, name: `Authorized forecast ${index}`, year: 2027, closed: 0,
          lines: [{ id: "wp12-variant-service", name: "Authorized service", ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: variant.currency,
            b: [...amounts], a: Array<null>(12).fill(null), f: [...amounts] }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
          officials: { "2027": "wp12-variant-0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const result = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-explicar-forecast")
      if (!selected || !skill || !context.services.productHttp) throw new Error("Native forecast host services are incomplete")
      const before = await domainDigest(context)
      const decision = await context.ui("sf_case_draft", { purpose: "forecast-variant-sources" }, async (call) => {
        const base = await context.business.plannerProduct.issueSource("wp12-variant-0", call)
        const candidate = await context.business.plannerProduct.issueSource("wp12-variant-1", call)
        if (base.status !== "ok" || candidate.status !== "ok") throw new Error("Forecast variant source issuance failed")
        const draft = { objective, horizon: period, currency: "USD", criteria: ["Preservar os valores e limites retornados pelo domínio"],
          sourceRefs: [base.value.evidence, candidate.value.evidence] }
        return context.ui("sf_case_draft", draft, (create) => context.business.cases.draft(draft, create))
      })
      if (decision.status !== "ok") throw new Error(`Forecast variant case creation failed: ${decision.reason}`)
      const caseRef = { id: decision.value.id, incarnation: decision.value.incarnation, version: decision.value.version }
      const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
        skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest,
        outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_forecast_compare"] },
        selection: { caseRef, baseRef: decision.value.sourceRefs[0]!.refId, candidateRef: decision.value.sourceRefs[1]!.refId, period, currency: "USD" } }
      // This is the mounted host route used by the complete skill registry. It
      // authenticates this Request and admits analysis.prepare itself.
      const prepared = await context.services.productHttp(context.request({ action: "prepare", input: incoming },
        "/sucafina/planner?sf=workbench-analysis"), "planner")
      if (!prepared) throw new Error("Native forecast preparation route was not mounted")
      const body = object(await prepared.json())
      expect(prepared.status).toBe(200)
      expect(body.status).toBe("ok")
      const decoded = decodeSfSkillInput("ForecastExplainInput", body.value)
      if (!decoded.ok) throw new Error("Native forecast preparation did not produce ForecastExplainInput")
      verifyInput(decoded.value, variant)
      expect(await domainDigest(context)).toBe(before)
      console.log("SF_WP12_FORECAST_VARIANT_INPUT:" + JSON.stringify({ variant: variant.id, githubSha: process.env.GITHUB_SHA ?? null,
        caseRef, inputDigest: digestSfValue(decoded.value), objectiveDigest: digestSfValue(objective),
        knownDifference: decoded.value.forecastComparison.knownDifference, completeDifference: decoded.value.forecastComparison.completeDifference,
        gaps: decoded.value.forecastComparison.gaps, sourceRefIds: decoded.value.sourceRefs.map((ref) => ref.refId),
        producer: "workbench-analysis:prepare", domainUnchanged: true, inferenceExecuted: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: decoded.value })
        return { completed: undefined, before }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: decoded.value,
        expectedKind: "FinancialAnalysis", requiredTools: [{ operation: "sf_forecast_compare", handlerExport: "compareForecast" }] })
      if (completed.output.kind !== "FinancialAnalysis") throw new Error("Native forecast output kind changed")
      verifyInput({ ...decoded.value, forecastComparison: completed.output.payload }, variant)
      expect(await domainDigest(context)).toBe(before)
      return { completed, before }
    })
    // Reopen even in the unavailable branch: input preparation must preserve the
    // official financial data durably, independently of provider availability.
    await open("reopened", async (context) => {
      expect(await domainDigest(context)).toBe(result.before)
      if (!result.completed) return
      const rendered = await readWp12NativeMissionAfterReload(context, result.completed)
      if (rendered.output.kind !== "FinancialAnalysis") throw new Error("Reload changed the native forecast output kind")
      expect(rendered.output.payload.knownDifference).toBe(variant.expectedDifference)
      expect(rendered.html).toContain(`Known difference: ${variant.expectedDifference ?? "Unavailable"}`)
      expect(rendered.html).toContain("conditioned")
      expect(await domainDigest(context)).toBe(result.before)
    })
  })
}, 180_000)
