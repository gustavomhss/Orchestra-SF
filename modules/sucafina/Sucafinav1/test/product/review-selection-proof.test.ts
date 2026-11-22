import { expect, test } from "bun:test"
import type { TrustedUiContext } from "../../product/contracts/sf-execution.ts"
import { createReviewPort } from "../../product/reviews/port.ts"
import type { ReviewHost, ReviewSection } from "../../product/reviews/port.ts"
import { createReviewRoutineSelection } from "../../product/reviews/routine-selection.ts"
import type { RoutineReviewResult } from "../../product/routines/review-result.ts"

const issuedAt = "2026-01-01T00:00:00Z"
const period = { start: "2026-01-01", end: "2026-01-31" }
const authority = { installationId: "install", projectId: "project", principalRef: "owner" }
const context: TrustedUiContext = {
  kind: "ui",
  binding: { ...authority, requestId: "request", accessRevision: "current-access", policyVersion: "current-policy",
    expiresAt: "2026-01-01T01:00:00Z" },
  lease: {} as TrustedUiContext["lease"],
}
const request = { runRef: "run", resultRef: "result", outputDigest: "a".repeat(64) }
const section: ReviewSection = {
  id: "section", title: "January", period, recordCount: 0,
  projection: {
    context: { ...authority, surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [],
      accessRevision: "historic-access", policyVersion: "current-policy" },
    version: 1, engineVersion: "fixture", components: [], values: [], missing: [],
    comparison: {
      metricRef: "metric", comparisonRef: "comparison", version: 1, engineVersion: "fixture", values: [],
      context: { ...authority, surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [],
        accessRevision: "current-access", policyVersion: "historic-policy" },
    },
  },
}

async function fixture() {
  const result: RoutineReviewResult = {
    run: { ...authority, runRef: request.runRef, resultRef: request.resultRef, documentId: "document",
      publishedVersion: "1", admission: "admitted", admissionRef: "admission", admissionVersion: 1,
      correlationId: "correlation", sourceRefs: [], pending: [] },
    execution: { ...request, state: "completed", revision: "1" },
    output: { ...authority, ...request, schema: "sf-routine-artifact-v1", correlationId: "correlation",
      documentId: "document", publishedVersion: "1", inputDigest: "b".repeat(64), sourceRefs: [], createdAt: issuedAt },
    draft: { kind: "review-draft", previousReview: null, period, sections: [], pendencies: [], nextSteps: [],
      coverage: { selectedTopics: 1, includedTopics: 1, unavailableTopics: 0, omittedTopics: 0, includedRecordCount: 0 } },
    agendaSnapshot: { sections: [section], sectionRefs: [section.id], sectionRecordRefs: [], agendaNotes: [], gaps: [] },
  }
  const controls = {
    reads: 0,
    now: issuedAt,
    authorized: true,
    afterSelect: () => {},
    onRead: () => {},
    selected: (sections: readonly ReviewSection[]) => sections,
  }
  const allow = async () => true
  const routine = createReviewRoutineSelection({
    results: { read: async (ref, binding) => {
      expect(ref).toBe(request.runRef)
      expect(binding).toBe(context)
      controls.reads++
      controls.onRead()
      return { status: "ok", value: structuredClone(result) }
    } },
    revalidate: async () => controls.authorized,
    now: () => controls.now,
  })
  const selection = await routine.create(request, context)
  if (selection.status !== "ok") throw new Error(selection.reason)
  const { selectionRef } = selection.value
  const port = createReviewPort({
    state: {} as ReviewHost["state"],
    creationTarget: { ref: "reviews", incarnation: "reviews-1" },
    now: () => controls.now,
    requestFor: () => undefined,
    select: async (...args) => {
      const selected = await routine.select(...args)
      controls.afterSelect()
      return selected.status === "ok" ? { ...selected, value: controls.selected(selected.value) } : selected
    },
    historicalSelectionProof: routine.historicalSelectionProof,
    authorizeSections: allow, authorizeComments: allow, authorizeOutcomeComparison: allow,
    authorizeOutcome: allow, authorizeDecision: allow, authorizeSensitivity: allow,
    revalidate: allow, revalidateEvidence: allow,
  })
  return { controls, result, selectionRef, routine, preview: () => port.preview(selectionRef, [section.id], context) }
}

test("historical Reports selection reopens the exact section with both stamps intact", async () => {
  const sample = await fixture()
  expect(await sample.preview()).toEqual({ status: "ok", value: [section] })
  expect(sample.controls.reads).toBe(3)
})

test("historical Reports selection cannot authorize altered content with the same stamps", async () => {
  const sample = await fixture()
  sample.controls.selected = (sections) => sections.map((entry) => ({ ...entry, title: "Altered" }))
  expect(await sample.preview()).toEqual({ status: "denied", reason: "context-mismatch" })
  expect(sample.controls.reads).toBe(3)
})

for (const failure of ["digest", "access", "expiration", "release"] as const) {
  test(`historical Reports selection refuses a change in ${failure} during proof`, async () => {
    const sample = await fixture()
    sample.controls.afterSelect = () => {
      sample.controls.onRead = () => {
        if (failure === "digest" && sample.result.agendaSnapshot)
          sample.result.agendaSnapshot.sections = [{ ...section, title: "Changed by the producer" }]
        if (failure === "access") sample.controls.authorized = false
        if (failure === "expiration") sample.controls.now = "2026-01-01T00:15:00Z"
        if (failure === "release") sample.routine.release(sample.selectionRef)
      }
    }
    expect(await sample.preview()).toEqual({ status: "denied", reason: "context-mismatch" })
    expect(sample.controls.reads).toBe(3)
  })
}
