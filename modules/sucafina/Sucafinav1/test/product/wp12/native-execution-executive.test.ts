import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { inflateRawSync } from "node:zlib"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"

type Preparation = Parameters<NonNullable<SfHostServices["analysisInputs"]>["prepare"]>[1]
type ReviewSnapshot = ReturnType<typeof reviewSnapshot>
const period = { start: "2027-01-01", end: "2027-12-31" }
const operations = ["sf_case_draft", "sf_case_read", "sf_context_get", "sf_source_get", "sf_forecast_compare",
  "sf_review_prepare", "sf_report_prepare", "sf_artifact_get", "sf_work_list"]
const objective = "Prepare the factual executive review and complete meeting material for the selected forecasts. Keep observed gaps explicit, preserve each source and period, and do not invent a routine result or a business decision."

test("real executive and meeting inputs use a preserved WP07 review and complete downloadable material, with native consumers when installed", async () => {
  await withWp12NativeMissionHost({ label: "executive-meeting", operations,
    namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas", "reviews", "threads", "relations", "confirmations"],
    humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "reviews.preserve"],
    initialize: initializeReviewSources }, async (harness) => {
    const initial = await harness.open("initial", async (context) => {
      const sources = await context.ui("sf_case_draft", { purpose: "executive-meeting-source-selection" }, async (call) => {
        const base = await context.business.plannerProduct.issueSource("wp12-review-0", call)
        const candidate = await context.business.plannerProduct.issueSource("wp12-review-1", call)
        if (base.status !== "ok" || candidate.status !== "ok") throw new Error("The real Planner review sources were not issued")
        return [base.value.evidence, candidate.value.evidence] as const
      })
      const draft = { objective, horizon: period, currency: "USD", criteria: ["Keep factual coverage and source gaps visible"], sourceRefs: sources }
      const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
      if (created.status !== "ok") throw new Error(`The executive case was not persisted: ${created.reason}`)
      const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
      const domainBefore = await plannerDigest(context)
      const agenda = await postReview(context, "review-agenda", { items: [{ id: "wp12-review-forecast", kind: "forecast-comparison",
        title: "Authorized forecasts for the executive meeting", baseRef: sources[0].refId, candidateRef: sources[1].refId,
        currency: "USD", period, sides: ["baseline", "candidate"], agendaNote: "Human-selected factual comparison; no routine result was selected." }] })
      expect(agenda.response.status).toBe(200)
      expect(agenda.body.status).toBe("ok")
      const selected = object(agenda.body.value)
      if (typeof selected.selectionRef !== "string" || !Array.isArray(selected.sectionRefs) ||
        selected.sectionRefs.length !== 2 || selected.sectionRefs.some((ref) => typeof ref !== "string")) throw new Error("The real WP07 agenda was not selected")
      const sectionRefs = selected.sectionRefs.map(String)
      const selectionRef = selected.selectionRef
      const preview = await postReview(context, "review-preview", { selectionRef, sectionRefs, period })
      expect(preview.response.status).toBe(200)
      expect(preview.body.status).toBe("ok")
      const preparedReview = decodeSfOperationOutput("sf_review_prepare", preview.body.result)
      if (!preparedReview.ok) throw new Error("WP07 did not return its admitted review preview")
      expect(preparedReview.value.sectionRefs).toEqual(sectionRefs)
      expect(preparedReview.value.sourceRefs.length).toBeGreaterThan(0)

      const executive: Preparation = { request: missionRequest(context, "sf-preparar-revisao-executiva", caseRef),
        selection: { selectionRef, sectionRefs, decisionRefs: [caseRef], period, includeConfirmations: false, includeRoutineResults: false } }
      const executivePrepared = await prepareThroughHost(context, executive)
      expect(executivePrepared.response.status).toBe(200)
      expect(executivePrepared.body.status).toBe("ok")
      const executiveInput = decodeSfSkillInput("ExecutiveReviewInput", executivePrepared.body.value)
      if (!executiveInput.ok) throw new Error("The installed host did not produce ExecutiveReviewInput")
      expect(executiveInput.value.reviewSelection).toEqual({ selectionRef, sectionRefs, period })
      expect(executiveInput.value.decisionRefs).toEqual([caseRef])
      expect(executiveInput.value.factualRoutineResults).toEqual([])
      expect(executiveInput.value.confirmations).toEqual([])
      const c07Executive = await prepareThroughHost(context, { ...executive,
        selection: { ...object(executive.selection), includeRoutineResults: true } })
      expect(c07Executive.response.status).toBe(503)
      expect(c07Executive.body).toMatchObject({ status: "unavailable", reason: "review-result-link-unavailable" })
      const inventedSection = await prepareThroughHost(context, { ...executive,
        selection: { ...object(executive.selection), sectionRefs: ["never-selected-review-section"] } })
      expect(inventedSection.body.status).toBe("unavailable")

      const preserved = await postReview(context, "review-preserve", { selectionRef, sectionRefs })
      expect(preserved.response.status).toBe(200)
      expect(preserved.body.status).toBe("ok")
      const review = reviewSnapshot(preserved.body.value)
      expect(review.sectionRefs).toEqual(sectionRefs)
      expect(review.valueIds.length).toBeGreaterThan(12)
      expect(review.sections.every((section) => section.count === 1 && section.valueIds.length > 12)).toBe(true)
      const reports: { artifactRef: string; format: "docx" | "pptx"; digest: string; bytes: number }[] = []
      for (const format of ["docx", "pptx"] as const) {
        const report = await postReview(context, "review-report", { reviewRef: review.id, sectionRefs, format })
        expect(report.response.status).toBe(200)
        expect(report.body.status).toBe("ok")
        const parsed = decodeSfOperationOutput("sf_report_prepare", report.body.result)
        if (!parsed.ok) throw new Error("The WP07 report producer returned no material proposal")
        expect(parsed.value.reviewSelectionRef).toBe(review.id)
        expect(parsed.value.orderedResultRefs).toHaveLength(1)
        expect(parsed.value.coverage).toEqual(review.sections.map((section) => ({ sectionRef: section.id, includedCount: section.count, totalCount: section.count })))
        const artifactRef = parsed.value.orderedResultRefs[0]!
        const artifact = await downloadReview(context, artifactRef)
        assertCompleteArchive(artifact.bytes, format, review)
        reports.push({ artifactRef, format, digest: artifact.digest, bytes: artifact.bytes.length })
      }

      // Forecast sections contain financial projections, not C09 decision-result
      // links. The producer must retain that explicit empty decision selection.
      const meeting: Preparation = { request: missionRequest(context, "sf-produzir-material-reuniao", caseRef),
        selection: { reviewRef: { id: review.id, version: review.version }, decisionRefs: [], sectionRefs, routineResultRefs: [] } }
      const meetingPrepared = await prepareThroughHost(context, meeting)
      expect(meetingPrepared.response.status).toBe(200)
      expect(meetingPrepared.body.status).toBe("ok")
      const meetingInput = decodeSfSkillInput("MeetingMaterialInput", meetingPrepared.body.value)
      if (!meetingInput.ok) throw new Error("The installed host did not produce MeetingMaterialInput")
      expect(meetingInput.value).toEqual({ preservedReviewRef: { id: review.id, version: review.version }, decisionRefs: [],
        factualRoutineResults: [], authorizedSections: sectionRefs })
      const c07Meeting = await prepareThroughHost(context, { ...meeting,
        selection: { ...object(meeting.selection), routineResultRefs: ["never-admitted-routine-result"] } })
      expect(c07Meeting.response.status).toBe(503)
      expect(c07Meeting.body).toMatchObject({ status: "unavailable", reason: "review-result-link-unavailable" })
      const unlinkedCase = await prepareThroughHost(context, { ...meeting,
        selection: { ...object(meeting.selection), decisionRefs: [caseRef] } })
      expect(unlinkedCase.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const replacedReview = await prepareThroughHost(context, { ...meeting,
        selection: { ...object(meeting.selection), reviewRef: { id: review.id, version: review.version + 1 } } })
      expect(replacedReview.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      expect(await plannerDigest(context)).toBe(domainBefore)
      const noRuns = await context.human("analysis.read", { caseRef }, (call) => context.services.analyses!.list(call, caseRef))
      expect(noRuns).toEqual({ status: "ok", value: [] })
      console.log("SF_WP12_NATIVE_REVIEW_INPUTS:" + JSON.stringify({ scope: "real-WP07-selection-preservation-export-and-host-inputs",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef, selectionRef, reviewRef: review.id, reviewDigest: review.digest,
        sectionRefs, capturedValueCount: review.valueIds.length, executiveInputDigest: digestSfValue(executiveInput.value),
        meetingInputDigest: digestSfValue(meetingInput.value), reports, c07ResultsObserved: false, c07AdmissionObserved: false,
        c09DecisionResultsLinkedToMaterial: 0, inferenceExecuted: false, nativeContributionRef: null, gnativeAccepted: false }))

      const completed: Wp12CompletedNativeMission[] = []
      for (const task of [{ incoming: executive, input: executiveInput.value, kind: "DecisionBrief" as const },
        { incoming: meeting, input: meetingInput.value, kind: "MeetingMaterialProposal" as const }]) {
        const restored = await prepareThroughHost(context, task.incoming)
        expect(restored.response.status).toBe(200)
        expect(restored.body.status).toBe("ok")
        expect(digestSfValue(restored.body.value)).toBe(digestSfValue(task.input))
        if (!context.models.length) {
          observeWp12UnavailableMission(context, { request: task.incoming.request, skillInput: restored.body.value })
          continue
        }
        expectSpawn(import.meta.path)
        const witness = await executeWp12NativeMission(context, { request: task.incoming.request, skillInput: restored.body.value,
          expectedKind: task.kind, requiredTools: task.kind === "DecisionBrief"
            ? [{ operation: "sf_case_read" }, { operation: "sf_review_prepare", handlerExport: "prepareReview" }]
            : [{ operation: "sf_report_prepare", handlerExport: "prepareReport" }, { operation: "sf_artifact_get", handlerExport: "readArtifact" }] })
        if (witness.output.kind === "DecisionBrief") {
          expect(witness.output.payload.caseRef).toBe(encodeCaseRef(caseRef))
          expect(witness.output.payload.caseVersion).toBe(caseRef.version)
          expect(witness.output.payload.objective).toBe(objective)
          expect(witness.output.payload.conditions).toEqual(preparedReview.value.gaps)
          expect(witness.output.payload.orderedResultRefs).toEqual([])
          expect(witness.output.payload.runRef).toBeUndefined()
          expect(witness.output.payload.resultRef).toBeUndefined()
        } else if (witness.output.kind === "MeetingMaterialProposal") {
          expect(witness.output.payload.reviewSelectionRef).toBe(review.id)
          expect(witness.output.payload.orderedResultRefs).toHaveLength(1)
          expect(witness.output.payload.coverage).toEqual(review.sections.map((section) => ({ sectionRef: section.id, includedCount: section.count, totalCount: section.count })))
        } else throw new Error("The native review changed its requested output kind")
        await consumeReviewContribution(context, witness, review)
        completed.push(witness)
      }
      return { caseRef, review, reports, meeting, meetingInputDigest: digestSfValue(meetingInput.value), completed }
    })

    await harness.open("reopened", async (context) => {
      const opened = await getReview(context, initial.review.id)
      expect(opened.digest).toBe(initial.review.digest)
      for (const report of initial.reports) {
        const downloaded = await downloadReview(context, report.artifactRef)
        expect(downloaded.digest).toBe(report.digest)
        assertCompleteArchive(downloaded.bytes, report.format, opened)
      }
      const currentInput = await prepareThroughHost(context, initial.meeting)
      expect(currentInput.response.status).toBe(200)
      expect(currentInput.body.status).toBe("ok")
      expect(digestSfValue(currentInput.body.value)).toBe(initial.meetingInputDigest)
      for (const witness of initial.completed) {
        await readWp12NativeMissionAfterReload(context, witness)
        await consumeReviewContribution(context, witness, opened)
      }
      // Exercise a real source revision after preserving the review. The saved
      // report remains historical; a fresh analysis may not silently use it.
      await context.persistence.transaction("planner", async (snapshot) => {
        if (!Array.isArray(snapshot.data.versions)) throw new Error("Review Planner versions disappeared")
        const version = snapshot.data.versions.map(object).find((value) => value.id === "wp12-review-1")
        if (!version || !Array.isArray(version.lines)) throw new Error("Review candidate lines disappeared")
        const line = object(version.lines[0])
        if (!Array.isArray(line.f) || typeof line.f[0] !== "number") throw new Error("Review candidate forecast disappeared")
        line.f[0] += 777
        return { commit: true, value: undefined }
      })
      expect((await getReview(context, initial.review.id)).digest).toBe(initial.review.digest)
      for (const report of initial.reports) expect((await downloadReview(context, report.artifactRef)).digest).toBe(report.digest)
      const staleInput = await prepareThroughHost(context, initial.meeting)
      expect(staleInput.body).toMatchObject({ status: "unavailable", reason: "analysis-source-unavailable" })
      const unauthorized = new Request(new URL(`/sucafina/dashboard?sf=review-download&artifactRef=${encodeURIComponent(initial.reports[0]!.artifactRef)}`, context.origin))
      const refused = await context.services.productHttp!(unauthorized, "dashboard")
      if (!refused) throw new Error("The real review download route disappeared")
      expect(refused.status).toBe(403)
      expect(refused.headers.get("content-type")).not.toContain("officedocument")
      console.log("SF_WP12_NATIVE_REVIEW_REOPEN:" + JSON.stringify({ scope: "real-preserved-review-and-download-after-source-change",
        githubSha: process.env.GITHUB_SHA ?? null, reviewRef: initial.review.id, reviewDigest: initial.review.digest,
        reports: initial.reports, consumerRef: "createReviewHttp:review-read/review-download", inputReopened: true,
        preservedAfterSourceChange: true, newAnalysisFromHistoricalSourceRefused: true, unauthenticatedDownloadRefused: true,
        nativeContributionsConsumed: initial.completed.map((result) => result.output.id), c07AdmissionObserved: false,
        c07ResultsObserved: false, allEighteenSkillsAccepted: false, independentGnativeReview: false }))
    })
  })
}, 420_000)

async function initializeReviewSources(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [0, 1].map((side) => ({ id: `wp12-review-${side}`, name: `Explicit synthetic review forecast ${side}`, year: 2027, closed: 0,
      lines: Array.from({ length: 16 }, (_, index) => ({ id: `review-${side}-${String(index + 1).padStart(2, "0")}`, name: `Synthetic review line ${index + 1}`,
        ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: "USD", b: Array<number>(12).fill(100 + index),
        a: Array<null>(12).fill(null), f: Array<number>(12).fill(100 + index - side * 5) })),
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
      officials: { "2027": "wp12-review-0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
}

function missionRequest(context: Wp12NativeMissionContext, skillId: string, caseRef: Preparation["request"]["caseRef"]) {
  const profile = context.services.selected.find((entry) => entry.profile.id === "sf_maestro")
  const skill = profile?.skills.find((entry) => entry.id === skillId)
  if (!profile || !skill) throw new Error(`Installed Maestro does not publish ${skillId}`)
  return { caseRef, objective, profileId: profile.profile.id, profileVersion: profile.profile.version, skillId: skill.id, skillVersion: skill.version,
    manifestDigest: profile.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => operations.includes(operation)) }
}

async function prepareThroughHost(context: Wp12NativeMissionContext, input: Preparation) {
  const response = await context.services.productHttp?.(context.request({ action: "prepare", input }, "/sucafina/planner?sf=workbench-analysis"), "planner")
  if (!response) throw new Error("The host did not mount workbench analysis preparation")
  return { response, body: object(await response.json()) }
}

async function postReview(context: Wp12NativeMissionContext, action: string, body: unknown) {
  const response = await context.services.productHttp?.(context.request(body, `/sucafina/dashboard?sf=${action}`), "dashboard")
  if (!response) throw new Error(`The host did not mount ${action}`)
  return { response, body: object(await response.json()) }
}

async function getReview(context: Wp12NativeMissionContext, id: string) {
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?sf=review-read&reviewRef=${encodeURIComponent(id)}`, "GET"), "dashboard")
  if (!response) throw new Error("The host did not mount review-read")
  const body = object(await response.json())
  expect(response.status).toBe(200)
  expect(body.status).toBe("ok")
  return reviewSnapshot(body.value)
}

function reviewSnapshot(value: unknown) {
  const review = object(value)
  if (typeof review.id !== "string" || !Number.isSafeInteger(review.version) || !Array.isArray(review.sections)) throw new Error("The preserved review identity is incomplete")
  const sections = review.sections.map((item) => {
    const section = object(item), projection = object(section.content)
    if (typeof section.id !== "string" || typeof section.title !== "string" || typeof section.count !== "number" ||
      !Array.isArray(projection.values) || !projection.values.length) throw new Error("A selected preserved section has no complete captured values")
    const valueIds = projection.values.map((entry) => {
      const value = object(entry)
      if (typeof value.id !== "string" || !value.id.trim()) throw new Error("A captured review value has no identity")
      return value.id
    })
    return { id: section.id, title: section.title, count: section.count, valueIds }
  })
  return { id: review.id, version: Number(review.version), digest: digestSfValue(value), sections,
    sectionRefs: sections.map((section) => section.id), valueIds: sections.flatMap((section) => section.valueIds) }
}

async function downloadReview(context: Wp12NativeMissionContext, artifactRef: string) {
  const response = await context.services.productHttp?.(context.request(undefined, `/sucafina/dashboard?sf=review-download&artifactRef=${encodeURIComponent(artifactRef)}`, "GET"), "dashboard")
  if (!response) throw new Error("The host did not mount review-download")
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("officedocument")
  const bytes = Buffer.from(await response.arrayBuffer())
  expect(bytes.length).toBeGreaterThan(1000)
  return { bytes, digest: createHash("sha256").update(bytes).digest("hex") }
}

async function consumeReviewContribution(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission, review: ReviewSnapshot) {
  const consumed = await postReview(context, "review-contribution", { outputRef: completed.output.id,
    caseRef: completed.caseRef, expectedOutputDigest: completed.output.outputDigest })
  expect(consumed.response.status).toBe(200)
  expect(consumed.body.status).toBe("ok")
  const value = object(consumed.body.value)
  expect(value.kind).toBe(completed.output.kind)
  expect(digestSfValue(value.output)).toBe(digestSfValue(completed.output))
  if (completed.output.kind === "MeetingMaterialProposal") {
    expect(digestSfValue(value.review)).toBe(review.digest)
    if (!Array.isArray(value.artifacts) || !Array.isArray(value.links)) throw new Error("The material consumer returned no real artifact links")
    expect(value.artifacts).toHaveLength(1)
    const artifact = object(value.artifacts[0])
    if (typeof artifact.artifactRef !== "string" || (artifact.format !== "docx" && artifact.format !== "pptx")) throw new Error("The material artifact is not a supported generated document")
    expect(completed.output.payload.orderedResultRefs).toEqual([artifact.artifactRef])
    expect(value.links).toContainEqual({ kind: "review", reviewRef: review.id })
    expect(value.links).toContainEqual({ kind: "artifact", artifactRef: artifact.artifactRef })
    assertCompleteArchive((await downloadReview(context, artifact.artifactRef)).bytes, artifact.format, review)
  } else {
    expect(value.results).toEqual([])
    expect(value.links).toEqual([])
  }
  console.log("SF_WP12_NATIVE_REVIEW_CONSUMER:" + JSON.stringify({ scope: "native-contribution-consumed-by-WP07",
    githubSha: process.env.GITHUB_SHA ?? null, skillId: completed.receipt.skillId, runRef: completed.runRef,
    outputRef: completed.output.id, outputDigest: completed.output.outputDigest, consumerRef: "createReviewHttp:review-contribution",
    observedAction: completed.output.kind === "MeetingMaterialProposal" ? "opened-preserved-review-and-downloaded-full-artifact" : "opened-durable-decision-brief",
    c07ResultsObserved: false, independentGnativeReview: false }))
}

async function plannerDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.versions) }))
}

/** Inspect the downloaded Office package, not its stored metadata. Every captured
 * value must appear across the actual document or slide XML, including beyond 12 rows. */
function assertCompleteArchive(bytes: Buffer, format: "docx" | "pptx", review: ReviewSnapshot) {
  let footer = bytes.length - 22
  while (footer >= Math.max(0, bytes.length - 65_557) && bytes.readUInt32LE(footer) !== 0x06054b50) footer--
  if (footer < 0 || bytes.readUInt32LE(footer) !== 0x06054b50) throw new Error("The downloaded Office package has no ZIP directory")
  const count = bytes.readUInt16LE(footer + 10)
  if (!count || count > 4096) throw new Error("The downloaded Office package has an invalid entry count")
  let offset = bytes.readUInt32LE(footer + 16)
  const texts: string[] = []
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("The downloaded Office ZIP directory is incomplete")
    const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20)
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8")
    const local = bytes.readUInt32LE(offset + 42)
    if ((format === "docx" && name === "word/document.xml") || (format === "pptx" && /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
      if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("The downloaded Office XML is missing")
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
      if (start + size > bytes.length || (method !== 0 && method !== 8)) throw new Error("The downloaded Office XML is truncated or unsupported")
      const source = bytes.subarray(start, start + size)
      texts.push((method === 0 ? source : inflateRawSync(source, { maxOutputLength: 16 * 1024 * 1024 })).toString("utf8"))
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  expect(texts.length).toBeGreaterThan(0)
  const text = texts.join("").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, "")
  for (const section of review.sections) {
    expect(text).toContain(section.title.replace(/\s+/g, ""))
    for (const id of section.valueIds) expect(text).toContain(id.replace(/\s+/g, ""))
  }
  expect(text).toContain(period.start)
  expect(text).toContain(period.end)
}
