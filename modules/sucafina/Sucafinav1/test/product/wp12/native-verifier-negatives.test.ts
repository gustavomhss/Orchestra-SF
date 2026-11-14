import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { createSfForecastVerifier, withoutObservationTimes } from "../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"
import { digestSfContribution, digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfContributionOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { FinancialAnalysis } from "../../../product/contracts/ports.ts"
import type { ForecastExplainInput } from "../../../product/contracts/skill-inputs.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload,
  withWp12NativeMissionHost, type Wp12NativeMissionContext } from "./native-mission-harness.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const objective = "Explique a comparação entre os forecasts selecionados. Leia as referências selecionadas com sf_source_get e invoque sf_forecast_compare. Preserve o FinancialAnalysis canônico e suas limitações, sem inventar causalidade, valores, cobertura ou operações."

function attacks(input: ForecastExplainInput) {
  const total = input.forecastComparison.candidate.values.find((value) => value.id.endsWith(":1:outlook"))
  if (!total || total.value !== 56_000) throw new Error("The real Planner did not expose the selected monthly total")
  const source = input.sourceRefs[0]
  if (!source || source.kind !== "record") throw new Error("The real producer did not issue a record source")
  // This is deliberately adversarial input, never an issued source or grant.
  // Re-sealing it rules out a mere reference-digest mismatch as the only fence.
  const invented = { ...structuredClone(source), refId: `${source.refId}:not-issued`,
    target: { ...structuredClone(source.target), recordId: "wp12-not-issued-forecast" } }
  invented.refDigest = digestSfEvidenceRef(invented)
  const inventedRefs = [invented, ...input.sourceRefs.slice(1)]
  return [
    { id: "false-monthly-total", schemaAdmitted: true, body: { kind: "FinancialAnalysis" as const,
      payload: { ...structuredClone(input.forecastComparison), candidate: { ...structuredClone(input.forecastComparison.candidate),
        values: input.forecastComparison.candidate.values.map((value) => value.id === total.id ? { ...structuredClone(value), value: 956_000 } : structuredClone(value)) } },
      evidenceRefs: structuredClone(input.sourceRefs) } },
    { id: "operation-outside-schema", schemaAdmitted: false, body: { kind: "FinancialAnalysis" as const,
      payload: { ...structuredClone(input.forecastComparison), operations: [{ operation: "set-financial-total", value: 956_000, currency: "USD" }] },
      evidenceRefs: structuredClone(input.sourceRefs) } },
    { id: "invented-source-reference", schemaAdmitted: true, body: { kind: "FinancialAnalysis" as const,
      payload: { ...structuredClone(input.forecastComparison), sourceRefs: inventedRefs }, evidenceRefs: inventedRefs } },
  ]
}

function assertEngineValues(value: FinancialAnalysis) {
  expect(value.analysisBasis).toBe("domain")
  expect(value.baseline.engineVersion).toBe("planner-runtime-v1")
  expect(value.candidate.engineVersion).toBe("planner-runtime-v1")
  expect(value.baseline.components).toHaveLength(12)
  expect(value.candidate.components).toHaveLength(12)
  expect(value.baseline.components.every((component) => component.evidenceState === "confirmed" && component.amount !== null)).toBe(true)
  expect(value.candidate.components.every((component) => component.evidenceState === "confirmed" && component.amount !== null)).toBe(true)
  expect(value.baseline.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)).toBe(590_000)
  expect(value.candidate.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)).toBe(596_000)
  expect(value.baseline.values.find((entry) => entry.id.endsWith(":1:outlook"))?.value).toBe(50_000)
  expect(value.candidate.values.find((entry) => entry.id.endsWith(":1:outlook"))?.value).toBe(56_000)
  expect(value.knownDifference).toBe(6_000)
  expect(value.comparison.knownDifference).toBe(6_000)
  // The sources establish monthly values, not a C10 cost-coverage basis.
  expect(value.comparison.comparisonStatus).toBe("conditioned")
  expect(value.completeDifference).toBeNull()
  expect(value.comparison.completeDifference).toBeNull()
  expect(value.gaps).toContain("cost-coverage-unavailable")
}

async function durableState(context: Wp12NativeMissionContext, caseId: string) {
  const planner = await context.persistence.transaction("planner", async (snapshot) => ({ commit: false,
    value: digestSfValue({ versions: snapshot.data.versions, officials: snapshot.data.officials,
      entities: snapshot.data.entities, allocations: snapshot.data.allocations, roster: snapshot.data.roster }) }))
  const decision = await context.services.state.read(context.request(), "cases", (state) => state.cases[caseId])
  const outputs = await context.services.state.read(context.request(), "contributions", (state) => ({
    contributions: state.contributions, nativeRuns: state.nativeRuns ?? {} }))
  if (decision.status !== "ok" || !decision.value || outputs.status !== "ok") throw new Error("Real C08 state was not readable")
  return { planner, caseDigest: digestSfValue(decision.value), publicationDigest: digestSfValue(outputs.value),
    outputRefs: Object.keys(outputs.value.contributions).sort(), runRefs: Object.keys(outputs.value.nativeRuns).sort() }
}

test("real Forecast verifier refuses a false total, an out-of-schema operation and an invented source while preserving Planner and C08", async () => {
  await withWp12NativeMissionHost({ label: "verifier-negatives",
    operations: ["sf_case_draft", "sf_case_read", "sf_forecast_compare", "sf_context_get", "sf_source_get", "sf_evidence_get", "sf_freshness_check"],
    initialize: async (persistence) => {
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [50_000, 56_000].map((first, index) => ({
          id: `wp12-verifier-${index}`, name: `Selected forecast ${index}`, year: 2027, closed: 0,
          lines: [{ id: "wp12-verifier-service", name: "Selected service", ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: "USD",
            b: [first, ...Array<number>(10).fill(50_000), 40_000], a: Array<null>(12).fill(null),
            f: [first, ...Array<number>(10).fill(50_000), 40_000] }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
          officials: { "2027": "wp12-verifier-0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const result = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-explicar-forecast")
      if (!selected || !skill || !context.services.productHttp) throw new Error("The real forecast host is incomplete")
      const decision = await context.ui("sf_case_draft", { purpose: "verifier-source-selection" }, async (call) => {
        const base = await context.business.plannerProduct.issueSource("wp12-verifier-0", call)
        const candidate = await context.business.plannerProduct.issueSource("wp12-verifier-1", call)
        if (base.status !== "ok" || candidate.status !== "ok") throw new Error("The real Planner refused source issuance")
        const draft = { objective, horizon: period, currency: "USD", criteria: ["Preservar valores, fontes e limites do domínio"],
          sourceRefs: [base.value.evidence, candidate.value.evidence] }
        return context.ui("sf_case_draft", draft, (create) => context.business.cases.draft(draft, create))
      })
      if (decision.status !== "ok") throw new Error(`The real case was not created: ${decision.reason}`)
      const caseRef = { id: decision.value.id, incarnation: decision.value.incarnation, version: decision.value.version }
      const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
        skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest,
        outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_forecast_compare", "sf_source_get"] },
        selection: { caseRef, baseRef: decision.value.sourceRefs[0]!.refId, candidateRef: decision.value.sourceRefs[1]!.refId, period, currency: "USD" } }
      const before = await durableState(context, caseRef.id)
      expect(before.outputRefs).toEqual([])
      expect(before.runRefs).toEqual([])
      const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming },
        "/sucafina/planner?sf=workbench-analysis"), "planner")
      if (!response) throw new Error("The mounted host input route was not available")
      expect(response.status).toBe(200)
      const prepared = object(await response.json())
      expect(prepared.status).toBe("ok")
      const decoded = decodeSfSkillInput("ForecastExplainInput", prepared.value)
      if (!decoded.ok) throw new Error("The real producer did not return ForecastExplainInput")
      const input = decoded.value
      assertEngineValues(input.forecastComparison)
      expect(await durableState(context, caseRef.id)).toEqual(before)
      const verifier = createSfForecastVerifier(context.business)
      const comparisonDigest = digestSfValue(withoutObservationTimes(input.forecastComparison))
      const checked = await context.human("analysis.prepare", incoming, (call) => context.business.withCase(call, caseRef, {}, async () => {
        const proof = await verifier.verify(input, incoming.request, call)
        if (proof.status !== "ok") throw new Error(`The actual domain verifier refused the genuine input: ${proof.reason}`)
        expect(proof.value.sources.every((source) => source.state === "fresh" && !!source.authorizedProjection)).toBe(true)
        // This deliberately invokes only the verifier's body-level predicate.
        // Reflect.apply crosses its static ContributionEnvelope signature: no
        // run, model, provenance or SkillLoadReceipt is fabricated to fill it.
        // The control is verified fields, not an admitted/published contribution.
        const control: unknown = await Reflect.apply(proof.value.acceptsOutput, undefined, [{ kind: "FinancialAnalysis",
          payload: input.forecastComparison, evidenceRefs: input.sourceRefs }, call])
        expect(control).toEqual({ status: "ok", value: true })
        for (const attack of attacks(input)) {
          const schema = decodeSfContributionOutput(attack.body.kind, attack.body.payload)
          expect(schema.ok).toBe(attack.schemaAdmitted)
          if (!attack.schemaAdmitted) expect(schema).toEqual({ ok: false, reason: "invalid-contribution-output" })
          const rejected: unknown = await Reflect.apply(proof.value.acceptsOutput, undefined, [attack.body, call])
          expect(rejected).toEqual({ status: "unavailable", reason: "analysis-output-unverified" })
          if (attack.id === "invented-source-reference") {
            const invented = attack.body.evidenceRefs[0]!
            expect(invented.refDigest).toBe(digestSfEvidenceRef(invented))
            const resolution = await context.business.context.resolve(invented, call)
            expect(resolution.state).not.toBe("fresh")
            expect(resolution.authorizedProjection).toBeUndefined()
          }
          const replay = await context.business.planner.compareForecast(incoming.selection, call)
          if (replay.status !== "ok") throw new Error(`Real Planner replay failed after ${attack.id}: ${replay.reason}`)
          assertEngineValues(replay.value)
          expect(digestSfValue(withoutObservationTimes(replay.value))).toBe(comparisonDigest)
          expect(await durableState(context, caseRef.id)).toEqual(before)
          console.log("SF_WP12_VERIFIER_NEGATIVE:" + JSON.stringify({ criterion: "WP12.T03.CHK.02", attack: attack.id,
            scope: "real-domain-verifier-with-adversarial-body", githubSha: process.env.GITHUB_SHA ?? null,
            authentication: "real-ui-authority-over-explicit-synthetic-principal", candidateProvenance: "none",
            caseRef, inputDigest: digestSfValue(input), candidateDigest: digestSfValue(attack.body), schemaAdmitted: schema.ok,
            semanticResult: rejected, engineDigestBefore: comparisonDigest,
            engineDigestAfter: digestSfValue(withoutObservationTimes(replay.value)), plannerStoreDigest: before.planner,
            caseUnchanged: true, c08Unchanged: true, envelopeAdmissionExecuted: false,
            malformedPublicationAttemptExecuted: false, inferenceExecuted: false, gnativeAccepted: false }))
        }
        return { status: "ok", value: true } as const
      }))
      expect(checked).toEqual({ status: "ok", value: true })
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: input })
        return { caseRef, selection: incoming.selection, comparisonDigest, before, after: before, completed: undefined }
      }
      expectSpawn(import.meta.path)
      const completed = await executeWp12NativeMission(context, { request: incoming.request, skillInput: input,
        expectedKind: "FinancialAnalysis", requiredTools: [{ operation: "sf_forecast_compare", handlerExport: "compareForecast" },
          { operation: "sf_source_get", handlerExport: "resolveSfSource" }] })
      if (completed.output.state !== "ready" || completed.output.kind !== "FinancialAnalysis") throw new Error("The real native output changed kind or state")
      const output = completed.output
      assertEngineValues(output.payload)
      const after = await durableState(context, caseRef.id)
      expect(after.planner).toBe(before.planner)
      expect(after.caseDigest).toBe(before.caseDigest)
      expect(after.outputRefs).toEqual([output.id])
      expect(after.runRefs).toEqual([completed.runRef])
      const nativeChecked = await context.human("analysis.read", { runRef: completed.runRef }, (call) => context.business.withCase(call, caseRef, {}, async () => {
        const proof = await verifier.verify(input, incoming.request, call)
        if (proof.status !== "ok") throw new Error("The real verifier could not reopen the native output's domain inputs")
        expect(await proof.value.acceptsOutput(output, call)).toEqual({ status: "ok", value: true })
        for (const attack of attacks(input)) {
          // These are attacks on a clone of an actually published envelope. The
          // original run, Session and receipt remain byte-for-byte unchanged.
          const candidate = { ...structuredClone(output), payload: attack.body.payload, evidenceRefs: attack.body.evidenceRefs }
          candidate.outputDigest = digestSfContribution(candidate)
          expect(digestSfValue(candidate.runProvenance)).toBe(digestSfValue(output.runProvenance))
          expect(decodeSfContributionOutput(candidate.kind, candidate.payload).ok).toBe(attack.schemaAdmitted)
          expect(await proof.value.acceptsOutput(candidate, call)).toEqual({ status: "unavailable", reason: "analysis-output-unverified" })
          expect(await durableState(context, caseRef.id)).toEqual(after)
          console.log("SF_WP12_VERIFIER_NEGATIVE:" + JSON.stringify({ criterion: "WP12.T03.CHK.02", attack: attack.id,
            scope: "real-native-envelope-rechecked-by-real-domain-verifier", githubSha: process.env.GITHUB_SHA ?? null,
            runRef: completed.runRef, nativeSessionId: completed.receipt.nativeSessionId,
            outputRef: output.id, originalOutputDigest: output.outputDigest, candidateOutputDigest: candidate.outputDigest,
            originalPublicationExecuted: true, malformedPublicationAttemptExecuted: false,
            semanticRefusalObserved: true, c08Unchanged: true, inferenceExecuted: true, gnativeAccepted: false }))
        }
        return { status: "ok", value: true } as const
      }))
      expect(nativeChecked).toEqual({ status: "ok", value: true })
      return { caseRef, selection: incoming.selection, comparisonDigest, before, after, completed }
    })
    // Domain preservation and C08 absence/integrity are observed after a fresh
    // host opens the same store, including when no provider is configured.
    await open("reopened", async (context) => {
      expect(await durableState(context, result.caseRef.id)).toEqual(result.after)
      await context.ui("sf_forecast_compare", result.selection, async (call) => {
        const replay = await context.business.planner.compareForecast(result.selection, call)
        if (replay.status !== "ok") throw new Error(`Planner replay failed after host reload: ${replay.reason}`)
        assertEngineValues(replay.value)
        expect(digestSfValue(withoutObservationTimes(replay.value))).toBe(result.comparisonDigest)
      })
      if (result.completed) await readWp12NativeMissionAfterReload(context, result.completed)
      expect(await durableState(context, result.caseRef.id)).toEqual(result.after)
      console.log("SF_WP12_VERIFIER_NEGATIVE_REOPEN:" + JSON.stringify({ criterion: "WP12.T03.CHK.02",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: result.caseRef, plannerStoreDigest: result.before.planner,
        comparisonDigest: result.comparisonDigest, domainAndC08Preserved: true,
        nativePublicationObserved: !!result.completed, malformedPublicationAttemptExecuted: false,
        remainingBoundary: "The installed host exposes no external candidate-publication port; these negatives observe schema/domain refusal, not an adversarial native completion reaching its private publisher.",
        gnativeAccepted: false }))
    })
  })
}, 420_000)
