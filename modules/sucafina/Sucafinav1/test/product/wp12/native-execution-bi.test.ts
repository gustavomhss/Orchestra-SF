import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { SfBiArtifact } from "../../../product/contracts/state.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const datedId = "milestone:wp12-bi-project:delivery:date"
const undatedId = "milestone:wp12-bi-project:follow-up:date"
const requiredOperations = ["sf_bi_view", "sf_kpi_explain", "sf_source_get", "sf_dashboard_read"]

test("native contextual BI uses the real Dashboard producer and durable chart/table selection across host reload", async () => {
  await withWp12NativeMissionHost({ label: "contextual-bi", operations: ["sf_case_draft", "sf_case_read", "sf_dashboard_read", "sf_bi_view", "sf_context_get", "sf_source_get", "sf_kpi_explain"],
    namespaces: ["cases", "preferences", "contributions", "bi-artifacts", "atlas", "receipts", "outbox"],
    initialize: async (persistence) => {
      // Raw source records only: source identities, projections, artifacts, cases,
      // selections, native runs and contributions are produced by real services.
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.projects = [{ id: "wp12-bi-project", name: "Synthetic milestone selection", status: "Planning", risk: "Low", budget: 0, spent: 0, pct: 0, milestones: [
          { id: "delivery", name: "Delivery", date: "2027-05-15", status: "upcoming" },
          { id: "follow-up", name: "Follow-up", date: "", status: "upcoming" },
        ] }]
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const prepared = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-produzir-bi-contextual")
      if (!selected || !skill || !context.services.analysisInputs || !context.services.productHttp) throw new Error("The real contextual BI mission is not composed")
      const selection = { page: "Portfolio Dashboard", fields: ["milestoneDates"], period }
      const issued = await context.ui("sf_dashboard_read", selection, (call) => createDashboardSourceIssuer({ host: context.business.host,
        scopedSources: context.persistence })(selection, call))
      if (issued.status !== "ok") throw new Error(`The real Dashboard source was refused: ${issued.reason}`)
      const dashboardSelection = { selectionRef: issued.value.selectionRef, fields: selection.fields, period }
      const projection = await context.ui("sf_dashboard_read", dashboardSelection, (call) => context.business.dashboard.read(dashboardSelection, call))
      if (projection.status !== "ok") throw new Error(`The real Dashboard producer was refused: ${projection.reason}`)
      expect(projection.value.values.find((value) => value.id === datedId)).toMatchObject({ value: "2027-05-15", unit: "date", evidenceState: "confirmed" })
      expect(projection.value.values.find((value) => value.id === undatedId)).toMatchObject({ value: null, unit: "date", evidenceState: "absent" })
      expect(projection.value.missing).toContainEqual({ field: undatedId, reason: "missing" })
      expect(new Set(projection.value.values.map((value) => value.id)).size).toBe(projection.value.values.length)
      const objective = "Mostre os marcos do recorte autorizado com uma visualização aprovada e sua tabela equivalente. Consulte sf_dashboard_read, sf_bi_view e sf_source_get. Preserve datas observadas, ausências e referências canônicas; produza ContextualBIProposal sem inventar uma data nem substituir o produtor."
      const draft = { objective, horizon: period, currency: "USD", criteria: ["Preserve authorized source periods and explicitly missing dates"], sourceRefs: [issued.value.evidence] }
      const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
      if (created.status !== "ok") throw new Error(`The real BI case was refused: ${created.reason}`)
      const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
      const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
        skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
        requestedOperationScope: ["sf_dashboard_read", "sf_bi_view", "sf_source_get"] },
        selection: { viewId: "BI08", version: 1, filters: [{ field: "period", values: [period.start, period.end] }], dashboardSelection } }
      const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/dashboard?sf=workbench-analysis"), "dashboard")
      if (!response) throw new Error("The real BI input HTTP route is missing")
      const body = object(await response.json())
      if (response.status !== 200 || body.status !== "ok") throw new Error(`The real BI input producer failed: ${String(body.reason)}`)
      const decoded = decodeSfSkillInput("ContextualBIInput", body.value)
      if (!decoded.ok) throw new Error("The real BI input failed its canonical schema")
      expect(decoded.value.businessQuestion).toBe(objective)
      expect(decoded.value.dashboardSelection).toEqual(dashboardSelection)
      expect(decoded.value.approvedViews).toContainEqual({ id: "BI08", version: 1, allowedFilters: ["period"] })
      expect(decoded.value.projectionRefs).toEqual([issued.value.evidence])
      const artifact = await readProducedArtifact(context, caseRef)
      expect(artifact.projectionDigest).toBe(digestSfValue(artifact.projection))
      expect(artifact.tableDigest).toBe(digestSfValue({ rows: artifact.rows, period: artifact.period, presentation: artifact.presentation }))
      expect(artifact.rows.find((row) => row.id === datedId)?.value).toBe("2027-05-15")
      expect(artifact.rows.find((row) => row.id === undatedId)?.value).toBeNull()
      expect(artifact.dashboardSelection).toEqual(dashboardSelection)
      expect(artifact.projectionRefs).toEqual(decoded.value.projectionRefs)
      const presentation = await readPresentation(context, dashboardSelection.selectionRef)
      expect(presentation.values).toEqual(artifact.projection.values)
      const sourceLinks = await readSourceLinks(context, dashboardSelection.selectionRef, datedId)
      expect(sourceLinks.some((entry) => String(entry.url).includes("Portfolio+Dashboard") || String(entry.url).includes("Portfolio%20Dashboard"))).toBe(true)
      for (const selection of [
        { ...incoming.selection, viewId: "BI99" },
        { ...incoming.selection, filters: [{ field: "period", values: ["2026-01-01", "2026-12-31"] }] },
      ]) {
        const changed = { ...incoming, selection }
        expect((await context.human("analysis.prepare", changed, (call) => context.services.analysisInputs!.prepare(call, changed))).status).not.toBe("ok")
      }
      const restored = await context.human("analysis.prepare", incoming, (call) => context.services.analysisInputs!.prepare(call, incoming))
      if (restored.status !== "ok") throw new Error("The authorized BI selection could not be reopened")
      expect(digestSfValue(await readProducedArtifact(context, caseRef))).toBe(digestSfValue(artifact))
      console.log("SF_WP12_NATIVE_BI_INPUT:" + JSON.stringify({ scope: "real-dashboard-producer-c08-artifacts-and-wp05-http", githubSha: process.env.GITHUB_SHA ?? null,
        profileId: selected.profile.id, skillId: skill.id, caseRef, inputDigest: digestSfValue(decoded.value), projectionRef: artifact.projectionRef, tableRef: artifact.tableRef,
        tableDigest: artifact.tableDigest, absentDate: undatedId, sourceLinks: sourceLinks.length,
        referencesExposedByCanonicalInput: { canonicalProjectionRefs: Object.hasOwn(decoded.value, "canonicalProjectionRefs"), tableRef: Object.hasOwn(decoded.value, "tableRef") },
        inferenceExecuted: false, gnativeAccepted: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: restored.value })
        return { incoming, artifact, witness: undefined }
      }
      expectSpawn(import.meta.path)
      // No private artifact identifiers are injected into the objective. The model
      // must obtain everything through the actual admitted input and native tools.
      const witness = await executeWp12NativeMission(context, { request: incoming.request, skillInput: restored.value, expectedKind: "ContextualBIProposal",
        requiredTools: ["sf_dashboard_read", "sf_bi_view", "sf_source_get"].map((operation) => ({ operation })) })
      expect(witness.receipt.profileId).toBe("sf_finance")
      expect(witness.receipt.skillId).toBe("sf-produzir-bi-contextual")
      if (witness.output.kind !== "ContextualBIProposal") throw new Error("The native BI output kind changed")
      expect(witness.output.payload).toEqual({ approvedViewId: "BI08", canonicalProjectionRefs: [artifact.projectionRef],
        filters: incoming.selection.filters, tableRef: artifact.tableRef, sourceRefs: decoded.value.projectionRefs })
      return { incoming, artifact, witness }
    })
    await open("reopened", async (context) => {
      const restored = await context.human("analysis.prepare", prepared.incoming, (call) => context.services.analysisInputs!.prepare(call, prepared.incoming))
      if (restored.status !== "ok") throw new Error(`The real BI input could not be reopened: ${restored.reason}`)
      const artifact = await readProducedArtifact(context, prepared.incoming.request.caseRef)
      expect(digestSfValue(artifact)).toBe(digestSfValue(prepared.artifact))
      const presentation = await readPresentation(context, prepared.incoming.selection.dashboardSelection.selectionRef)
      expect(presentation.values).toEqual(artifact.projection.values)
      expect((await readSourceLinks(context, artifact.dashboardSelection.selectionRef, datedId)).length).toBeGreaterThan(0)
      if (prepared.witness) {
        const consumed = await readWp12NativeMissionAfterReload(context, prepared.witness)
        expect(consumed.output.kind).toBe("ContextualBIProposal")
      }
      const observedOperations = [...new Set(prepared.witness?.tools.map((tool) => tool.operation) ?? [])]
      const missingRequiredOperations = requiredOperations.filter((operation) => !observedOperations.includes(operation))
      console.log("SF_WP12_NATIVE_BI_REOPEN:" + JSON.stringify({ scope: "real-persisted-bi-selection-and-wp05-http-after-host-reload", githubSha: process.env.GITHUB_SHA ?? null,
        projectionRef: artifact.projectionRef, tableRef: artifact.tableRef, tableDigest: artifact.tableDigest,
        consumer: "WP05 bi-data/bi-source", nativeContributionConsumed: Boolean(prepared.witness),
        requiredOperations, observedOperations, missingRequiredOperations, normativeSkillWitnessComplete: missingRequiredOperations.length === 0,
        am02: { profileId: "sf_finance", skillId: "sf-produzir-bi-contextual", operation: "sf_bi_view",
          nativeCallObserved: Boolean(prepared.witness && prepared.witness.receipt.profileId === "sf_finance" &&
            prepared.witness.receipt.skillId === "sf-produzir-bi-contextual" && observedOperations.includes("sf_bi_view")) },
        gnativeAccepted: false, independentGnativeReview: false }))
      await context.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.projects = []; return { commit: true, value: undefined } })
      const removed = await context.human("analysis.prepare", prepared.incoming, (call) => context.services.analysisInputs!.prepare(call, prepared.incoming))
      expect(removed.status).not.toBe("ok")
      if (prepared.witness) expect((await context.human("analysis.read", { runRef: prepared.witness.runRef }, (call) => context.services.analyses!.output(call, prepared.witness!.runRef))).status).not.toBe("ok")
      console.log("SF_WP12_NATIVE_BI_SOURCE_REMOVED:" + JSON.stringify({ scope: "source-deletion-not-acl-revocation", status: removed.status, oldSelectionRejected: true }))
    })
  })
}, 600_000)

async function readProducedArtifact(context: Wp12NativeMissionContext, caseRef: SfBiArtifact["caseRef"]) {
  // This is a read-only persistence assertion after the real producer ran. It is
  // separate from the mounted WP05 consumer and is never supplied to the model.
  const stored = await context.services.state.read(context.request(), "bi-artifacts", (state, authority) => authority.principalRef === context.principalRef
    ? Object.values(state.biArtifacts ?? {}).filter((artifact) => digestSfValue(artifact.caseRef) === digestSfValue(caseRef)) : [])
  if (stored.status !== "ok" || stored.value.length !== 1) throw new Error("The real producer did not persist exactly one BI artifact")
  return stored.value[0]!
}

async function readPresentation(context: Wp12NativeMissionContext, selectionRef: string) {
  const query = new URLSearchParams({ sf: "bi-data", viewId: "BI08", selectionRef, start: period.start, end: period.end })
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!response) throw new Error("The real WP05 presentation consumer is not mounted")
  const body = object(await response.json())
  expect(response.status).toBe(200)
  expect(object(body.receipt)).toMatchObject({ kind: "ui", operation: "sf_bi_view" })
  expect(object(body.presentation).viewId).toBe("BI08")
  const decoded = decodeSfOperationOutput("sf_bi_view", body.projection)
  if (!decoded.ok) throw new Error(`The real WP05 presentation failed: ${String(body.reason)}`)
  return decoded.value
}

async function readSourceLinks(context: Wp12NativeMissionContext, selectionRef: string, valueId: string) {
  const query = new URLSearchParams({ sf: "bi-source", viewId: "BI08", selectionRef, valueId, start: period.start, end: period.end })
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?${query}`, "GET"), "dashboard")
  if (!response) throw new Error("The real WP05 source consumer is not mounted")
  const body = object(await response.json())
  expect(response.status).toBe(200)
  const links = Array.isArray(body.links) ? body.links.map(object) : []
  expect(links.length).toBeGreaterThan(0)
  return links
}
