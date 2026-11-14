import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { inflateRawSync } from "node:zlib"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { ReviewDraft } from "../../../product/contracts/outputs.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { object } from "../../../runtime/contract.ts"
import { dispatchWp12Ui, executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
type ReviewSnapshot = ReturnType<typeof readReviewSnapshot>
const horizon = { start: "2027-01-01", end: "2027-12-31" }
const period = { start: "2027-01-01", end: "2027-01-31" }
const operations = ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_source_get", "sf_forecast_compare", "sf_review_prepare", "sf_report_prepare", "sf_artifact_get"]
const executiveRequired = ["sf_review_prepare", "sf_case_read", "sf_source_get", "sf_routine_catalog", "sf_routine_prepare", "sf_routine_run", "sf_routine_status", "sf_routine_result"]
const meetingRequired = ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"]

test("native executive report routes and meeting review preparation consume real public human selections without changing either output contract", async () => {
  await withWp12NativeMissionHost({ label: "review-crossroutes", operations,
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "reviews", "threads", "relations", "confirmations"],
    humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "reviews.preserve"],
    initialize: async (persistence) => {
      // Raw synthetic annual forecasts only. Agenda identities, preserved review,
      // case, inputs, reports and all receipts are issued by installed services.
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [0, 1].map((side) => ({ id: `wp12-crossreview-${side}`, name: `Explicit cross-route forecast ${side}`, year: 2027, closed: 0,
          lines: [0, 1].map((index) => ({ id: `crossreview-${side}-${index + 1}`, name: `Selected line ${index + 1}`, ownerId: "wp12-crossreview-owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array<number>(12).fill(100 + index), a: Array<null>(12).fill(null), f: Array<number>(12).fill(100 + index - side * 5) })),
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
          officials: { "2027": "wp12-crossreview-0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    },
  }, async ({ open }) => {
    const initial = await open("initial", async (context) => {
      const sources = await phase("sources", () => context.ui("sf_case_draft", { purpose: "public-review-crossroute-sources" }, async (call) => {
        const baseline = await context.business.plannerProduct.issueSource("wp12-crossreview-0", call)
        const candidate = await context.business.plannerProduct.issueSource("wp12-crossreview-1", call)
        if (baseline.status !== "ok" || candidate.status !== "ok") throw new Error("The actual cross-route Planner sources were not issued")
        return [baseline.value.evidence, candidate.value.evidence] as const
      }))
      const domainDigest = await plannerDigest(context)
      // These are publicly returned human selections, produced before the case.
      // No private artifact/agenda store is read to populate the objective.
      const agenda = await post(context, "review-agenda", { items: [{ id: "crossreview-selected", kind: "forecast-comparison", title: "Human-selected January forecasts",
        baseRef: sources[0].refId, candidateRef: sources[1].refId, currency: "USD", period, sides: ["baseline", "candidate"] }] })
      const selection = object(agenda.value)
      if (typeof selection.selectionRef !== "string" || !Array.isArray(selection.sectionRefs) || selection.sectionRefs.length !== 2 || selection.sectionRefs.some((ref) => typeof ref !== "string")) throw new Error("The actual agenda did not return its public selectors")
      const sectionRefs = selection.sectionRefs.map(String)
      const reviewSelection = { selectionRef: selection.selectionRef, sectionRefs, period }
      const preview = await post(context, "review-preview", reviewSelection)
      const reviewDraft = decodeSfOperationOutput("sf_review_prepare", preview.result)
      if (!reviewDraft.ok) throw new Error("The actual selected review preview failed its schema")
      expect(reviewDraft.value.sectionRefs).toEqual(sectionRefs)
      const preserved = await post(context, "review-preserve", { selectionRef: reviewSelection.selectionRef, sectionRefs })
      const review = readReviewSnapshot(preserved.value)
      expect(review.sectionRefs).toEqual(sectionRefs)
      expect(refSet(reviewDraft.value.sourceRefs)).toBe(review.evidenceSet)
      expect(reviewDraft.value.gaps).toEqual(review.gaps)
      const publicSelection = { preservedReviewRef: { id: review.id, version: review.version }, reviewSelection }
      const objective = "Prepare the factual executive brief or meeting material requested by the selected skill. The human explicitly selected the public review and current agenda returned by WP07: " + JSON.stringify(publicSelection) + ". Read that exact current agenda with sf_review_prepare, prepare DOCX with sf_report_prepare from the selected preservedReviewRef.id and sectionRefs, and read the artifactRef actually returned with sf_artifact_get. Keep the selected period, complete table and source gaps. For DecisionBrief preserve the case objective and leave non-routine orderedResultRefs empty; the generated report is an auxiliary tool result. For MeetingMaterialProposal use the real generated artifact and preserved review. Do not invent a routine result, admission or business decision."
      const draft = { objective, horizon, currency: "USD", criteria: ["Use only the explicitly selected public review and agenda", "Preserve every selected January value and missing actual without truncation"], sourceRefs: sources }
      const created = await phase("case", () => context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call)))
      if (created.status !== "ok") throw new Error(`The actual public-selection case failed: ${created.reason}`)
      const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
      const caseDigest = digestSfValue(created.value)
      const executive: Preparation = { request: requestFor(context, "sf-preparar-revisao-executiva", caseRef, objective),
        selection: { ...reviewSelection, decisionRefs: [caseRef], includeConfirmations: false, includeRoutineResults: false } }
      const meeting: Preparation = { request: requestFor(context, "sf-produzir-material-reuniao", caseRef, objective),
        selection: { reviewRef: publicSelection.preservedReviewRef, decisionRefs: [], sectionRefs, routineResultRefs: [] } }
      const executiveInput = decodeSfSkillInput("ExecutiveReviewInput", await prepare(context, executive))
      const meetingInput = decodeSfSkillInput("MeetingMaterialInput", await prepare(context, meeting))
      if (!executiveInput.ok || !meetingInput.ok) throw new Error("The actual cross-route mission inputs failed their canonical schemas")
      expect(executiveInput.value.reviewSelection).toEqual(reviewSelection)
      expect(executiveInput.value.factualRoutineResults).toEqual([])
      expect(meetingInput.value).toEqual({ preservedReviewRef: publicSelection.preservedReviewRef, decisionRefs: [], factualRoutineResults: [], authorizedSections: sectionRefs })
      expect(Object.hasOwn(executiveInput.value, "preservedReviewRef")).toBe(false)
      expect(Object.hasOwn(meetingInput.value, "reviewSelection")).toBe(false)
      console.log("SF_WP12_REVIEW_CROSSROUTES_INPUT:" + JSON.stringify({ scope: "real-public-human-selections-before-case-and-closed-host-inputs", githubSha: process.env.GITHUB_SHA ?? null,
        caseRef, publicSelection, objectiveDigest: digestSfValue(objective), reviewDigest: review.digest, selectedValueCount: review.valueIds.length,
        selectionsDiscoveredByModel: false, privateStoreIdsSupplied: false, c07AdmissionObserved: false, inferenceExecuted: false, gnativeAccepted: false }))

      const completed: { witness: Wp12CompletedNativeMission; audit: Awaited<ReturnType<typeof readNativeCrossroute>>; digest: string }[] = []
      let uiArtifact: { artifactRef: string; digest: string } | undefined
      for (const task of [
        { incoming: executive, input: executiveInput.value, kind: "DecisionBrief" as const },
        { incoming: meeting, input: meetingInput.value, kind: "MeetingMaterialProposal" as const },
      ]) {
        if (!context.models.length) {
          observeWp12UnavailableMission(context, { request: task.incoming.request, skillInput: task.input })
          continue
        }
        const currentInput = await prepare(context, task.incoming)
        expect(digestSfValue(currentInput)).toBe(digestSfValue(task.input))
        expectSpawn(import.meta.path)
        const witness = await phase(`native:${task.incoming.request.skillId}`, () => executeWp12NativeMission(context, {
          request: task.incoming.request, skillInput: currentInput, expectedKind: task.kind,
          requiredTools: [{ operation: "sf_review_prepare", handlerExport: "prepareReview" }, { operation: "sf_report_prepare", handlerExport: "prepareReport" },
            { operation: "sf_artifact_get", handlerExport: "readArtifact" }, ...(task.kind === "DecisionBrief" ? [{ operation: "sf_case_read" }, { operation: "sf_source_get" }] : [])],
        }))
        if (witness.output.kind === "DecisionBrief") {
          expect(witness.output.payload.caseRef).toBe(encodeCaseRef(caseRef))
          expect(witness.output.payload.caseVersion).toBe(caseRef.version)
          expect(witness.output.payload.objective).toBe(objective)
          expect(witness.output.payload.conditions).toEqual(reviewDraft.value.gaps)
          expect(witness.output.payload.orderedResultRefs).toEqual([])
          expect(witness.output.payload.runRef).toBeUndefined()
          expect(witness.output.payload.resultRef).toBeUndefined()
        } else if (witness.output.kind !== "MeetingMaterialProposal") throw new Error("The native cross-route mission changed its output kind")
        const audit = await readNativeCrossroute(context, witness, { reviewSelection, review, expectedDraft: reviewDraft.value })
        // This artifactRef comes only from the completed native report tool result.
        // A UI artifact is never substituted for it, even if bytes would match.
        const download = await downloadReport(context, audit.report.artifactRef, review)
        await consumeContribution(context, witness, review, audit.report.artifactRef)
        completed.push({ witness, audit, digest: download.digest })
      }
      if (!context.models.length) {
        const report = await dispatchWp12Ui(context, "sf_report_prepare", { reviewRef: review.id, sectionRefs, format: "docx" })
        if (report.status !== "ok") throw new Error(`The actual UI report preparation failed: ${report.reason}`)
        const material = decodeSfOperationOutput("sf_report_prepare", report.result)
        if (!material.ok || material.value.orderedResultRefs.length !== 1) throw new Error("The UI report returned no actual artifact")
        const artifactRef = material.value.orderedResultRefs[0]!
        const artifact = await dispatchWp12Ui(context, "sf_artifact_get", { artifactRef })
        if (artifact.status !== "ok") throw new Error(`The actual UI artifact reader failed: ${artifact.reason}`)
        const decoded = decodeSfOperationOutput("sf_artifact_get", artifact.result)
        if (!decoded.ok) throw new Error("The actual UI artifact failed its canonical schema")
        expect(decoded.value.artifactRef).toBe(artifactRef)
        expect(refSet(decoded.value.evidenceRefs)).toBe(review.evidenceSet)
        expect(report.receipt.kind).toBe("ui")
        expect(artifact.receipt.kind).toBe("ui")
        uiArtifact = { artifactRef, digest: (await downloadReport(context, artifactRef, review)).digest }
        console.log("SF_WP12_REVIEW_CROSSROUTES_UI_ONLY:" + JSON.stringify({ scope: "actual-ui-report-and-download-no-native-attribution", artifactRef,
          reportReceipt: report.receipt, artifactReceipt: artifact.receipt, nativeCallObserved: false, gnativeAccepted: false }))
      }
      expect(await plannerDigest(context)).toBe(domainDigest)
      expect(await caseDataDigest(context, caseRef)).toBe(caseDigest)
      return { caseRef, caseDigest, domainDigest, review, reviewSelection, reviewDraft: reviewDraft.value, meeting, meetingInputDigest: digestSfValue(meetingInput.value), completed, uiArtifact }
    })
    await open("reopened", async (context) => {
      const review = await getReview(context, initial.review.id)
      expect(review.digest).toBe(initial.review.digest)
      expect(digestSfValue(await prepare(context, initial.meeting))).toBe(initial.meetingInputDigest)
      if (initial.uiArtifact) expect((await downloadReport(context, initial.uiArtifact.artifactRef, review)).digest).toBe(initial.uiArtifact.digest)
      for (const item of initial.completed) {
        await readWp12NativeMissionAfterReload(context, item.witness)
        const audit = await readNativeCrossroute(context, item.witness, { reviewSelection: initial.reviewSelection, review, expectedDraft: initial.reviewDraft })
        expect(digestSfValue(audit)).toBe(digestSfValue(item.audit))
        expect((await downloadReport(context, audit.report.artifactRef, review)).digest).toBe(item.digest)
        await consumeContribution(context, item.witness, review, audit.report.artifactRef)
      }
      expect(await plannerDigest(context)).toBe(initial.domainDigest)
      expect(await caseDataDigest(context, initial.caseRef)).toBe(initial.caseDigest)
      console.log("SF_WP12_REVIEW_CROSSROUTES_REOPEN:" + JSON.stringify({ scope: "durable-public-review-native-tool-artifact-and-wp07-consumer", githubSha: process.env.GITHUB_SHA ?? null,
        reviewRef: review.id, reviewDigest: review.digest, uiArtifact: initial.uiArtifact ?? null,
        nativeArtifacts: initial.completed.map(({ witness, audit }) => ({ skillId: witness.receipt.skillId, runRef: witness.runRef, artifactRef: audit.report.artifactRef,
          reportCallId: audit.report.callId, artifactCallId: audit.artifact.callId, outputRef: witness.output.id,
          observedOperations: [...new Set(witness.tools.map((tool) => tool.operation))],
          missingRequiredOperations: (witness.receipt.skillId === "sf-preparar-revisao-executiva" ? executiveRequired : meetingRequired).filter((operation) => !witness.tools.some((tool) => tool.operation === operation)) })),
        selectionsDiscoveredByModel: false, originalAgendaRecreatedAfterReload: false, newExecutivePreparationAfterReloadClaimed: false,
        historicalSourceMutationCoveredHere: false, c07AdmissionObserved: false, gnativeAccepted: false, independentGnativeReview: false }))
    })
  })
}, 420_000)

function requestFor(context: Wp12NativeMissionContext, skillId: string, caseRef: Preparation["request"]["caseRef"], objective: string) {
  const profile = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
  const skill = profile?.skills.find((entry) => entry.id === skillId)
  if (!profile || !skill) throw new Error(`The installed Maestro selection omitted ${skillId}`)
  const scope = skillId === "sf-preparar-revisao-executiva" ? ["sf_review_prepare", "sf_case_read", "sf_source_get", "sf_report_prepare", "sf_artifact_get"] : meetingRequired
  for (const operation of scope) {
    expect(profile.profile.allowedOperations).toContain(operation)
    expect(skill.allowedOperations).toContain(operation)
    expect(profile.operationIds).toContain(operation)
  }
  return { caseRef, objective, profileId: profile.profile.id, profileVersion: profile.profile.version, skillId: skill.id, skillVersion: skill.version,
    manifestDigest: profile.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [...scope] }
}

async function prepare(context: Wp12NativeMissionContext, input: Preparation) {
  return phase(`prepare:${input.request.skillId}`, async () => {
    const response = await context.services.productHttp?.(context.request({ action: "prepare", input }, "/sucafina/planner?sf=workbench-analysis"), "planner")
    if (!response) throw new Error("The actual workbench preparation route is absent")
    const body = object(await response.json())
    if (response.status !== 200 || body.status !== "ok") throw new Error(`The actual ${input.request.skillId} input failed: ${String(body.reason)}`)
    return body.value
  })
}

async function post(context: Wp12NativeMissionContext, action: string, input: unknown) {
  return phase(action, async () => {
    const response = await context.services.productHttp?.(context.request(input, `/sucafina/dashboard?sf=${action}`), "dashboard")
    if (!response) throw new Error(`The actual ${action} route is absent`)
    const body = object(await response.json())
    if (response.status !== 200 || body.status !== "ok") throw new Error(`The actual ${action} failed: ${String(body.reason)}`)
    return body
  })
}

function refSet(refs: readonly BusinessEvidenceRef[]) { return digestSfValue([...new Set(refs.map((ref) => digestSfValue(ref)))].sort()) }

function readReviewSnapshot(value: unknown) {
  const review = object(value)
  if (typeof review.id !== "string" || typeof review.version !== "number" || !Number.isSafeInteger(review.version) || !Array.isArray(review.sections)) throw new Error("The actual preserved review identity is incomplete")
  const sections = review.sections.map((raw) => {
    const section = object(raw), projection = object(section.content)
    if (typeof section.id !== "string" || typeof section.title !== "string" || section.count !== 1 || !Array.isArray(projection.values) || !Array.isArray(projection.missing)) throw new Error("The actual preserved review section is incomplete")
    expect(section.period).toEqual(period)
    expect(object(projection.context).period).toEqual(period)
    const values = projection.values.map(object)
    const capturedRows = values.map((entry) => {
      if (typeof entry.id !== "string" || !entry.id || !Array.isArray(entry.sourceRefs)) throw new Error("The actual captured value has no source identity")
      if (entry.value !== null && typeof entry.value !== "string" && typeof entry.value !== "boolean" && (typeof entry.value !== "number" || !Number.isFinite(entry.value))) throw new Error("The actual captured value is invalid")
      if (entry.unit !== undefined && typeof entry.unit !== "string" || entry.currency !== undefined && typeof entry.currency !== "string") throw new Error("The actual captured value has an invalid unit")
      expect(entry.period).toEqual(period)
      const sourceIds = entry.sourceRefs.map((raw) => {
        const ref = object(raw)
        if (typeof ref.refId !== "string" || !ref.refId) throw new Error("The actual captured value has an invalid evidence reference")
        return ref.refId
      })
      return { id: entry.id, cells: [`${entry.id}: ${entry.value === null ? "unavailable" : String(entry.value)}${entry.unit ? ` ${entry.unit}` : ""}${entry.currency ? ` ${entry.currency}` : ""}`,
        `${period.start} – ${period.end}`, sourceIds.join(", ") || "unavailable"] }
    })
    const valueIds = capturedRows.map((row) => row.id)
    expect(valueIds).toHaveLength(22)
    expect(new Set(valueIds).size).toBe(22)
    const evidenceDigests = values.flatMap((entry) => (Array.isArray(entry.sourceRefs) ? entry.sourceRefs : []).map((ref) => digestSfValue(ref)))
    const gaps = projection.missing.map((raw) => {
      const missing = object(raw)
      if (typeof missing.field !== "string" || typeof missing.reason !== "string") throw new Error("A captured producer gap lacks its field or reason")
      return { id: `${section.id}:${missing.field}`, category: missing.field, reason: missing.reason, evidenceRefs: [] }
    })
    return { id: section.id, title: section.title, count: 1, valueIds, capturedRows, evidenceDigests, gaps }
  })
  expect(sections).toHaveLength(2)
  const valueIds = sections.flatMap((section) => section.valueIds)
  expect(valueIds).toHaveLength(44)
  expect(new Set(valueIds).size).toBe(38)
  return { id: review.id, version: review.version, digest: digestSfValue(value), sectionRefs: sections.map((section) => section.id), sections, valueIds,
    evidenceSet: digestSfValue([...new Set(sections.flatMap((section) => section.evidenceDigests))].sort()), gaps: sections.flatMap((section) => section.gaps) }
}

async function getReview(context: Wp12NativeMissionContext, id: string) {
  return phase("review-read-after-reload", async () => {
    const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?sf=review-read&reviewRef=${encodeURIComponent(id)}`, "GET"), "dashboard")
    if (!response) throw new Error("The actual review reader is absent")
    const body = object(await response.json())
    if (response.status !== 200 || body.status !== "ok") throw new Error(`The actual preserved review read failed: ${String(body.reason)}`)
    return readReviewSnapshot(body.value)
  })
}

async function plannerDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
}

async function caseDataDigest(context: Wp12NativeMissionContext, caseRef: Preparation["request"]["caseRef"]) {
  const request = { caseRef: encodeCaseRef(caseRef) }
  const result = await context.ui("sf_case_read", request, (call) => context.business.cases.read(request, call))
  if (result.status !== "ok") throw new Error(`The actual cross-route case cannot be reread: ${result.reason}`)
  return digestSfValue(result.value.case)
}

async function readNativeCrossroute(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, selected: {
  reviewSelection: { selectionRef: string; sectionRefs: string[]; period: typeof period }
  review: ReviewSnapshot
  expectedDraft: ReviewDraft
}) {
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId), order: "asc" }))
  const calls = messages.flatMap((message, messageIndex) => message.type !== "assistant" || !message.time.completed || message.error ? [] : message.content.flatMap((part) => {
    if (part.type !== "tool" || part.state.status !== "completed" || !completed.tools.some((tool) => tool.operation === part.name && tool.toolCallId === part.id)) return []
    const receipt = object(part.state.structured.receipt)
    expect(receipt).toMatchObject({ kind: "native", operation: part.name, runId: completed.runRef, nativeSessionId: completed.receipt.nativeSessionId,
      principalRef: context.principalRef, callId: part.id, resultDigest: digestSfValue(part.state.structured.result) })
    return [{ operation: part.name, callId: part.id, messageId: message.id, messageIndex, receipt, result: part.state.structured.result }]
  }))
  const exact = (operation: string, payload: unknown) => {
    const result = calls.find((call) => call.operation === operation && call.receipt.inputDigest === digestSfValue(payload))
    if (!result) throw new Error(`The actual native ${operation} call did not use the human-selected public reference`)
    return result
  }
  const reviewCall = exact("sf_review_prepare", selected.reviewSelection)
  const draft = decodeSfOperationOutput("sf_review_prepare", reviewCall.result)
  if (!draft.ok) throw new Error("The actual native review preview failed its canonical schema")
  expect(draft.value).toEqual(selected.expectedDraft)
  expect(refSet(draft.value.sourceRefs)).toBe(selected.review.evidenceSet)
  expect(draft.value.sectionRefs).toEqual(selected.review.sectionRefs)
  expect(draft.value.gaps).toEqual(selected.review.gaps)
  const reportCall = exact("sf_report_prepare", { reviewRef: selected.review.id, sectionRefs: selected.review.sectionRefs, format: "docx" })
  const report = decodeSfOperationOutput("sf_report_prepare", reportCall.result)
  if (!report.ok || report.value.orderedResultRefs.length !== 1) throw new Error("The actual native report returned no unique generated artifact")
  const artifactRef = report.value.orderedResultRefs[0]!
  expect(report.value.reviewSelectionRef).toBe(selected.review.id)
  expect(report.value.coverage).toEqual(selected.review.sections.map((section) => ({ sectionRef: section.id, includedCount: section.count, totalCount: section.count })))
  const artifactCall = exact("sf_artifact_get", { artifactRef })
  expect(reportCall.messageIndex).toBeLessThan(artifactCall.messageIndex)
  const artifact = decodeSfOperationOutput("sf_artifact_get", artifactCall.result)
  if (!artifact.ok) throw new Error("The actual native artifact result failed its schema")
  expect(artifact.value).toMatchObject({ artifactRef, format: "docx", recordCount: 2 })
  expect(refSet(artifact.value.evidenceRefs)).toBe(selected.review.evidenceSet)
  if (completed.output.kind === "MeetingMaterialProposal") {
    expect(completed.output.payload).toEqual(report.value)
    expect(digestSfValue(completed.output.evidenceRefs)).toBe(digestSfValue(artifact.value.evidenceRefs))
  } else if (completed.output.kind === "DecisionBrief") {
    expect(completed.output.payload.orderedResultRefs).toEqual([])
    expect(refSet(completed.output.evidenceRefs)).toBe(selected.review.evidenceSet)
  } else throw new Error("The cross-route native output has an unexpected kind")
  return { review: { callId: reviewCall.callId, receipt: reviewCall.receipt, result: draft.value },
    report: { callId: reportCall.callId, messageId: reportCall.messageId, receipt: reportCall.receipt, result: report.value, artifactRef },
    artifact: { callId: artifactCall.callId, messageId: artifactCall.messageId, receipt: artifactCall.receipt, result: artifact.value },
    referenceOrigin: "explicit-human-public-selection", autonomousDiscovery: false }
}

async function consumeContribution(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, review: ReviewSnapshot, nativeArtifactRef: string) {
  const body = await post(context, "review-contribution", { outputRef: completed.output.id, caseRef: completed.caseRef, expectedOutputDigest: completed.output.outputDigest })
  const result = object(body.value)
  expect(result.kind).toBe(completed.output.kind)
  expect(digestSfValue(result.output)).toBe(digestSfValue(completed.output))
  if (completed.output.kind === "MeetingMaterialProposal") {
    expect(digestSfValue(result.review)).toBe(review.digest)
    if (!Array.isArray(result.artifacts) || !Array.isArray(result.links)) throw new Error("The actual meeting consumer returned no artifact links")
    expect(result.artifacts).toHaveLength(1)
    expect(object(result.artifacts[0]).artifactRef).toBe(nativeArtifactRef)
    expect(result.links).toContainEqual({ kind: "review", reviewRef: review.id })
    expect(result.links).toContainEqual({ kind: "artifact", artifactRef: nativeArtifactRef })
  } else {
    expect(result.results).toEqual([])
    expect(result.links).toEqual([])
  }
}

async function downloadReport(context: Wp12NativeMissionContext, artifactRef: string, review: ReviewSnapshot) {
  return phase("download-selected-artifact", async () => {
    const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?sf=review-download&artifactRef=${encodeURIComponent(artifactRef)}`, "GET"), "dashboard")
    if (!response) throw new Error("The actual artifact download consumer is absent")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("wordprocessingml")
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(1000)
    assertCompleteDocx(bytes, review)
    return { digest: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }
  })
}

function assertCompleteDocx(bytes: Buffer, review: ReviewSnapshot) {
  let footer = bytes.length - 22
  while (footer >= Math.max(0, bytes.length - 65_557) && bytes.readUInt32LE(footer) !== 0x06054b50) footer--
  if (footer < 0 || bytes.readUInt32LE(footer) !== 0x06054b50) throw new Error("The downloaded DOCX has no ZIP directory")
  const count = bytes.readUInt16LE(footer + 10)
  if (!count || count > 4096) throw new Error("The downloaded DOCX has an invalid ZIP entry count")
  let offset = bytes.readUInt32LE(footer + 16), xml: string | undefined
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("The downloaded DOCX directory is incomplete")
    const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20)
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"), local = bytes.readUInt32LE(offset + 42)
    if (name === "word/document.xml") {
      if (xml !== undefined || local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("The downloaded document XML is invalid")
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
      if (start + size > bytes.length || (method !== 0 && method !== 8)) throw new Error("The downloaded document XML is truncated")
      const source = bytes.subarray(start, start + size)
      xml = (method === 0 ? source : inflateRawSync(source, { maxOutputLength: 16 * 1024 * 1024 })).toString("utf8")
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (!xml) throw new Error("The downloaded DOCX contains no document XML")
  const documentXml = xml
  const normalized = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, "")
  const tables = [...documentXml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)]
  expect(tables).toHaveLength(review.sections.length)
  const actualIds: string[] = []
  tables.forEach((table, sectionIndex) => {
    const section = review.sections[sectionIndex]!
    const rows = [...table[1]!.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map((row) =>
      [...row[1]!.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((cell) => normalized(cell[1]!)))
    expect(rows[0]).toEqual(["Capturedvalue", "Period", "Sources"])
    // Compare every complete rendered row with the captured producer value, unit,
    // currency, selected period and source IDs. Identity-only matching would let
    // an altered amount pass. Null remains the literal unavailable marker.
    expect(rows.slice(1)).toEqual(section.capturedRows.map((row) => row.cells.map(normalized)))
    const preceding = documentXml.slice(0, table.index)
    const headings = [...preceding.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].filter((paragraph) => /<w:pStyle\b[^>]*w:val="Heading1"/.test(paragraph[0]))
    expect(normalized(headings.at(-1)?.[0] ?? "")).toBe(normalized(`${section.title} · ${period.start} – ${period.end}`))
    for (const row of rows.slice(1)) {
      const matches = section.valueIds.filter((id) => row[0]?.startsWith(`${normalized(id)}:`))
      if (matches.length !== 1) throw new Error("A downloaded table cell does not identify one captured producer value in its section")
      actualIds.push(matches[0]!)
    }
  })
  expect(actualIds).toHaveLength(44)
  expect(actualIds.toSorted()).toEqual(review.valueIds.toSorted())
  for (const section of review.sections) expect(normalized(documentXml)).toContain(normalized(section.title))
  expect(normalized(documentXml)).toContain(period.start)
  expect(normalized(documentXml)).toContain(period.end)
}

let sequence = 0
async function phase<T>(name: string, work: () => Promise<T>): Promise<T> {
  const index = ++sequence, started = performance.now()
  const record = (state: string) => console.log("SF_WP12_REVIEW_CROSSROUTES_PHASE:" + JSON.stringify({ githubSha: process.env.GITHUB_SHA ?? null, sequence: index, phase: name, state, elapsedMs: Math.round(performance.now() - started) }))
  record("started")
  try { const result = await work(); record("returned"); return result } catch (error) { record("failed"); throw error }
}
