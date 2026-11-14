import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission } from "./native-mission-harness.ts"

test("Maestro frames two real case selections and its native contribution reopens with the selected evidence", async () => {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const objective = "Enquadre a decisão destas fontes autorizadas. Use sf_case_read e sf_case_draft para produzir IntentFrame com objetivo, período, USD, critérios e sourceRefs retornados pela porta. Preserve analysisBasis domain e domainApplied false."
  await withWp12NativeMissionHost({ label: "intent", operations: ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_freshness_check"],
    initialize: async (persistence) => {
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [120, 100, 80].map((amount, index) => ({ id: `wp12-intent-forecast-${index}`, name: `Synthetic intent source ${index}`,
          year: 2027, closed: 0, lines: [{ id: "wp12-intent-service", name: "Synthetic service", ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(120), a: Array(12).fill(null), f: Array(12).fill(amount) }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
          officials: { "2027": "wp12-intent-forecast-0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const completed = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
      const skill = selected?.skills.find((entry) => entry.id === "sf-enquadrar-decisao")
      if (!selected || !skill || !context.services.analysisInputs || !context.services.analyses || !context.services.productHttp)
        throw new Error("Native Maestro host services are incomplete")
      const sources = await context.ui("sf_case_draft", { purpose: "intent-material-source-selection" }, async (call) => {
        const base = await context.business.plannerProduct.issueSource("wp12-intent-forecast-0", call)
        const first = await context.business.plannerProduct.issueSource("wp12-intent-forecast-1", call)
        const second = await context.business.plannerProduct.issueSource("wp12-intent-forecast-2", call)
        if (base.status !== "ok" || first.status !== "ok" || second.status !== "ok") throw new Error("Real Planner intent sources were refused")
        return { base: base.value.evidence, first: first.value.evidence, second: second.value.evidence }
      })
      const prepared = []
      for (const material of [sources.first, sources.second]) {
        const draft = { objective, horizon: period, currency: "USD", criteria: ["Compare the selected current sources without changing the domain"],
          sourceRefs: [sources.base, material] }
        const decision = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
        if (decision.status !== "ok") throw new Error(`Real intent case creation failed: ${decision.reason}`)
        const caseRef = { id: decision.value.id, incarnation: decision.value.incarnation, version: decision.value.version }
        const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
          skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
          requestedOperationScope: ["sf_case_read", "sf_case_draft"] },
          selection: { evidenceRefIds: decision.value.sourceRefs.map((source) => source.refId) } }
        // This host route admits analysis.prepare and stores the selected input.
        // The older WP01 prepare route uses a different case projection adapter.
        const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
        if (!response) throw new Error("Real workbench analysis preparation route is missing")
        const body = object(await response.json())
        expect(response.status).toBe(200)
        expect(body.status).toBe("ok")
        const decoded = decodeSfSkillInput("DecisionIntentInput", body.value)
        if (!decoded.ok) throw new Error("Real intent producer returned an invalid DecisionIntentInput")
        expect(decoded.value.intentText).toBe(objective)
        expect(decoded.value.case).toEqual(caseRef)
        expect(decoded.value.context.period).toEqual(period)
        expect(decoded.value.context.currency).toBe("USD")
        expect(decoded.value.context.sourceRefs).toHaveLength(2)
        expect(decoded.value.selectedSourceRefs).toEqual(decision.value.sourceRefs)
        prepared.push({ incoming, input: decoded.value, sourceRefs: decision.value.sourceRefs })
        console.log("SF_WP12_NATIVE_INTENT_INPUT:" + JSON.stringify({ scope: "real-host-http-input-producer", githubSha: process.env.GITHUB_SHA ?? null,
          route: "workbench-analysis:prepare", skillId: skill.id, profileId: selected.profile.id, caseRef,
          inputDigest: digestSfValue(decoded.value), sourceRefIds: decoded.value.selectedSourceRefs.map((source) => source.refId), inferenceExecuted: false }))
      }
      expect(prepared).toHaveLength(2)
      expect(prepared[0]!.incoming.request.objective).toBe(prepared[1]!.incoming.request.objective)
      expect(digestSfValue(prepared[0]!.input)).not.toBe(digestSfValue(prepared[1]!.input))
      expect(digestSfValue(prepared[0]!.input.selectedSourceRefs)).not.toBe(digestSfValue(prepared[1]!.input.selectedSourceRefs))

      const first = prepared[0]!
      const outsideCase = { ...first.incoming, selection: { evidenceRefIds: [sources.base.refId, sources.second.refId] } }
      const refusedSource = await context.human("analysis.prepare", outsideCase, (call) => context.services.analysisInputs!.prepare(call, outsideCase))
      expect(refusedSource.status).toBe("unavailable")
      const changedRequest = { ...first.incoming, request: { ...first.incoming.request, objective: "Different unapproved objective" } }
      const refusedIntent = await context.human("analysis.prepare", first.incoming, (call) => context.services.analysisInputs!.prepare(call, changedRequest))
      expect(refusedIntent).toEqual({ status: "denied", reason: "analysis-input-authority-unavailable" })
      const unchangedDomain = await context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
      console.log("SF_WP12_NATIVE_INTENT_NEGATIVES:" + JSON.stringify({ scope: "real-host-input-admission", githubSha: process.env.GITHUB_SHA ?? null,
        outsideCase: refusedSource.status, changedAuthorizedRequest: refusedIntent.status, inferenceExecuted: false }))
      if (!context.models.length) {
        for (const item of prepared) observeWp12UnavailableMission(context, { request: item.incoming.request, skillInput: item.input })
        return [] satisfies Wp12CompletedNativeMission[]
      }
      expectSpawn(import.meta.path)
      const witnesses: Wp12CompletedNativeMission[] = []
      for (const item of prepared) {
        // A rejected preparation cannot supply the selection used by this run.
        const restored = await context.human("analysis.prepare", item.incoming, (call) => context.services.analysisInputs!.prepare(call, item.incoming))
        if (restored.status !== "ok") throw new Error("The authorized intent selection could not be restored")
        expect(digestSfValue(restored.value)).toBe(digestSfValue(item.input))
        const witness = await executeWp12NativeMission(context, { request: item.incoming.request, skillInput: restored.value,
          expectedKind: "IntentFrame", requiredTools: [{ operation: "sf_case_read" }, { operation: "sf_case_draft" }] })
        if (witness.output.kind !== "IntentFrame") throw new Error("Native Maestro returned a different output kind")
        expect(witness.output.payload.sourceRefs).toEqual(item.sourceRefs)
        expect(witness.output.evidenceRefs).toEqual(item.sourceRefs)
        expect(witness.output.payload.horizon).toEqual(period)
        expect(witness.output.payload.currency).toBe("USD")
        expect(witness.output.payload.domainApplied).toBe(false)
        expect(witness.output.payload.analysisBasis).toBe("domain")
        expect(witness.output.payload.criteria.length).toBeGreaterThan(0)
        witnesses.push(witness)
      }
      expect(witnesses[0]!.receipt.nativeSessionId).not.toBe(witnesses[1]!.receipt.nativeSessionId)
      expect(witnesses[0]!.output.outputDigest).not.toBe(witnesses[1]!.output.outputDigest)
      expect(await context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))).toBe(unchangedDomain)
      return witnesses
    })
    if (!completed.length) return
    await open("reopened", async (context) => {
      for (const witness of completed) {
        const consumed = await readWp12NativeMissionAfterReload(context, witness)
        if (consumed.output.kind !== "IntentFrame") throw new Error("The reopened intent contribution changed kind")
        expect(consumed.html).toContain("Decision framing")
        expect(consumed.html).toContain("USD")
        expect(consumed.html).toContain(period.start)
        expect(consumed.html).toContain(period.end)
        const current = await readCaseAnalysisProjection(context.request(), context.services, witness.caseRef)
        if (current.status !== "ok") throw new Error("The framed case could not be reopened through its real read grant")
        expect(current.value.case.sourceRefs).toEqual(consumed.output.payload.sourceRefs)
        expect(current.value.case.objective).toBe(objective)
        expect(current.value.case.horizon).toEqual(period)
      }
    })
  })
}, 420_000)
