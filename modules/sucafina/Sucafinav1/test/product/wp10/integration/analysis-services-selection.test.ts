import { expect, test } from "bun:test"
import { digestSfContribution } from "../../../../product/contracts/canonical.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import type { ScenarioComparison } from "../../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { readSfReviewAuthorSelection } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services-readers.ts"
import { createSfCritiqueInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-critique.ts"
import type { SfAnalysisRequest } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"

test("human review selectors cannot introduce native sessions, tickets, or a foreign case binding", () => {
  const selector = { runRef: "author-run", outputDigest: "a".repeat(64) }
  expect(readSfReviewAuthorSelection(selector)).toEqual(selector)
  for (const extra of [{ targetSessionId: "forged" }, { executionTicket: "forged" }, { caseRef: { id: "foreign" } }, { targetRunId: "author-run" }])
    expect(readSfReviewAuthorSelection({ ...selector, ...extra })).toBeUndefined()
  expect(readSfReviewAuthorSelection({ ...selector, outputDigest: "not-a-digest" })).toBeUndefined()
  expect(readSfReviewAuthorSelection({ ...selector, runRef: " " })).toBeUndefined()
  expect(readSfReviewAuthorSelection(null)).toBeUndefined()
})

const caseRef = { id: "case", incarnation: "case-life", version: 3 }
const comparison: ScenarioComparison = { baselineResultRef: "baseline-result", alternativeResultRef: "alternative-result", costCoverageRefs: [],
  criterionResults: [], unresolvedConditions: [], comparisonStatus: "complete", knownDifference: 20, completeDifference: 20 }
const request: SfAnalysisRequest = { caseRef, profileId: "sf_reviewer", profileVersion: "1", skillId: "sf-contestar-decisao", skillVersion: "1",
  manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review the compared alternatives" }
const call = { kind: "ui", binding: { principalRef: "person", accessRevision: "access" } } as TrustedDomainContext

function critiqueFixture(replay: ScenarioComparison = comparison) {
  let comparisons = 0
  const draft: ContributionEnvelope = { schemaVersion: "sf-contribution-v1", id: "author-output", kind: "ScenarioComparison", state: "ready", caseRef, payload: comparison,
    evidenceRefs: [], accessRevision: "access", outputDigest: "", createdAt: "2026-01-01T00:00:00.000Z", runProvenance: {
      runId: "author-run", nativeSessionId: "author-session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64),
      skillId: "sf-comparar-cenarios", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "message",
      loadedAt: "2026-01-01T00:00:00.000Z", manifestDigest: "d".repeat(64), actualModel: "provider/model", contextFingerprint: "e".repeat(64),
    } }
  const output: ContributionEnvelope = { ...draft, outputDigest: digestSfContribution(draft) }
  const dependencies = {
    cases: { read: async () => ({ status: "ok", value: { case: { ...caseRef, alternatives: [{ id: "baseline" }, { id: "alternative" }], choices: [] }, evidenceRefs: [] } }) },
    planner: { compareScenarios: async () => { comparisons += 1; return { status: "ok", value: replay } } },
    context: { context: async () => [] },
    host: { revalidate: async () => true },
    readAuthorAnalysis: async () => ({ status: "ok", value: { run: { state: "ready", runRef: "author-run", outputRef: "author-output", native: { sessionID: "author-session" }, caseRef }, output } }),
    readHistoricalAuthor: async () => { throw new Error("A pre-choice review cannot claim historical authority") },
    readAnswerEffectSelection: async () => ({ status: "ok", value: { state: "none" } }),
    answerEffect: async () => { throw new Error("A pre-choice review cannot manufacture an answer effect") },
  } as unknown as Parameters<typeof createSfCritiqueInputProducer>[0]
  return { producer: createSfCritiqueInputProducer(dependencies), comparisons: () => comparisons,
    selection: { authorRunRef: "author-run", outputDigest: output.outputDigest, choiceRefs: [], alternativeRefs: ["baseline", "alternative"], evidenceRefIds: [] } }
}

test("pre-choice critique assembles an input only after replaying the saved author comparison", async () => {
  const fixture = critiqueFixture()
  const result = await fixture.producer.prepare(fixture.selection, request, call)
  expect(result).toMatchObject({ status: "ok", value: { choiceRefs: [], alternativeRefs: ["baseline", "alternative"], comparison } })
  expect(fixture.comparisons()).toBe(2)
})

test("pre-choice critique refuses a changed comparison and cannot invent an answered-question effect", async () => {
  const changed = critiqueFixture({ ...comparison, knownDifference: 30, completeDifference: 30 })
  expect(await changed.producer.prepare(changed.selection, request, call)).toMatchObject({ status: "unavailable" })
  const unanswered = critiqueFixture()
  expect(await unanswered.producer.prepare({ ...unanswered.selection, responseRef: "unverified-answer" }, request, call)).toMatchObject({ status: "unavailable" })
})
