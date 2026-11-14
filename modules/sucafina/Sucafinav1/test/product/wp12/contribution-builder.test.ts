import { expect, test } from "bun:test"
import { buildSfContribution } from "../../../product/ai/contribution-builder.ts"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import { sfRunFixture } from "./run-fixture.ts"
import { matchesSfRunOutput } from "../../../product/ai/run-provenance.ts"

const { caseRef, receipt, run } = sfRunFixture()
const candidate = { kind: "MatchExplanation", payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [] }
const input = { run, candidate, actualModel: { providerID: "provider", id: "model" }, outputId: "output", createdAt: "2026-11-13T00:00:00Z" }

function reviewRun(): SfNativeRunRecord {
  const fixture = sfRunFixture()
  return { ...fixture.run, runRef: "review", skillId: "sf-contestar-decisao",
    native: { sessionID: "review-session", skillReceipt: { ...receipt, runId: "review", nativeSessionId: "review-session", profileId: "sf_reviewer", skillId: "sf-contestar-decisao" } },
    selection: { ...fixture.run.selection,
      profile: { ...fixture.profile, id: "sf_reviewer", allowedSkills: ["sf-contestar-decisao"], outputTypes: ["CritiqueReport", "UnresolvedCondition"] },
      skills: [{ ...fixture.skill, id: "sf-contestar-decisao", allowedProfiles: ["sf_reviewer"], outputSchemaRefs: ["CritiqueReport", "UnresolvedCondition"] }],
    },
    reviewTarget: { targetRunId: "author", targetSessionId: "author-session", targetOutputDigest: "e".repeat(64), caseRef },
  }
}

test("host builds persisted provenance from the observed assistant model and skill receipt", () => {
  const result = buildSfContribution(input)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.runProvenance).toMatchObject({ ...receipt, actualModel: "provider/model", contextFingerprint: "context" })
  expect(result.value.outputDigest).toBe(digestSfContribution(result.value))
  expect(buildSfContribution({ ...input, actualModel: { providerID: "provider", id: "other" } })).toEqual({ status: "denied", reason: "invalid-native-output-context" })
  expect(buildSfContribution({ ...input, candidate: { ...candidate, runProvenance: {} } })).toEqual({ status: "failed", reason: "invalid-native-output" })
  expect(buildSfContribution({ ...input, candidate: { ...candidate, payload: {} } })).toEqual({ status: "failed", reason: "invalid-native-output" })
  expect(buildSfContribution({ ...input, run: { ...run, native: { sessionID: "session", skillReceipt: { ...receipt, runId: "another-run" } } } })).toEqual({ status: "denied", reason: "invalid-native-output-context" })
  expect(buildSfContribution({ ...input, run: { ...run, native: { sessionID: "session", skillReceipt: { ...receipt, sourceDigest: "9".repeat(64) } } } })).toEqual({ status: "denied", reason: "invalid-native-output-context" })
  expect(buildSfContribution({ ...input, run: { ...run, selection: { ...run.selection, skills: [] } } })).toEqual({ status: "denied", reason: "invalid-native-output-context" })
})

test("review provenance is assigned by the host for an independent run", () => {
  const review = reviewRun()
  const result = buildSfContribution({ ...input, run: review, candidate: { kind: "CritiqueReport", payload: { claimIssues: [], unresolvedConditions: [], evidenceRefs: [] }, evidenceRefs: [] } })
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || result.value.kind !== "CritiqueReport" || result.value.state !== "ready") return
  expect(result.value.payload).toMatchObject({ targetRunId: "author", targetOutputDigest: "e".repeat(64), reviewerRunId: "review", reviewerSessionId: "review-session" })
  expect(buildSfContribution({ ...input, run: { ...review, reviewTarget: { ...review.reviewTarget!, targetSessionId: "review-session" } }, candidate: { kind: "CritiqueReport", payload: { claimIssues: [], unresolvedConditions: [], evidenceRefs: [] }, evidenceRefs: [] } })).toMatchObject({ status: "denied", reason: "invalid-review-output-context" })
})

test("standalone reviewer conditions require the same independent host-owned target as a critique", () => {
  const review = reviewRun()
  const condition = { kind: "UnresolvedCondition", payload: { id: "training-question", category: "training", reason: "Confirm the omitted training category before comparing complete costs.", evidenceRefs: [] }, evidenceRefs: [] }
  const result = buildSfContribution({ ...input, run: review, candidate: condition })
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.runProvenance).toMatchObject({ reviewerRunId: "review", targetRunId: "author", targetOutputDigest: "e".repeat(64) })
  expect(matchesSfRunOutput(review, result.value)).toBe(true)
  expect(buildSfContribution({ ...input, run: { ...review, reviewTarget: undefined }, candidate: condition })).toEqual({ status: "denied", reason: "invalid-review-output-context" })
  for (const target of [
    { ...review.reviewTarget!, targetRunId: "review" },
    { ...review.reviewTarget!, targetSessionId: "review-session" },
    { ...review.reviewTarget!, targetRunId: " " },
    { ...review.reviewTarget!, targetSessionId: " " },
    { ...review.reviewTarget!, caseRef: { ...caseRef, version: 2 } },
  ]) expect(buildSfContribution({ ...input, run: { ...review, reviewTarget: target }, candidate: condition })).toEqual({ status: "denied", reason: "invalid-review-output-context" })
  const changedTarget = { ...result.value, runProvenance: { ...result.value.runProvenance, targetOutputDigest: "f".repeat(64) } }
  changedTarget.outputDigest = digestSfContribution(changedTarget)
  expect(matchesSfRunOutput(review, changedTarget)).toBe(false)
})

test("malformed review payloads fail while missing or reused review authority stays denied", () => {
  const review = reviewRun()
  const evidenceReview: SfNativeRunRecord = { ...review, skillId: "sf-revisar-evidencias",
    native: { ...review.native!, skillReceipt: { ...review.native!.skillReceipt, skillId: "sf-revisar-evidencias" } },
    selection: { ...review.selection,
      profile: { ...review.selection.profile, allowedSkills: ["sf-revisar-evidencias"], outputTypes: ["ClaimIssue"] },
      skills: [{ ...review.selection.skills[0]!, id: "sf-revisar-evidencias", outputSchemaRefs: ["ClaimIssue"] }],
    },
  }
  for (const selected of [{ run: review, kind: "CritiqueReport" }, { run: evidenceReview, kind: "ClaimIssue" }]) {
    for (const malformed of [null, { kind: "FinancialAnalysis", payload: {}, evidenceRefs: [] }]) {
      expect(buildSfContribution({ ...input, run: selected.run, candidate: malformed })).toEqual({ status: "failed", reason: malformed === null ? "invalid-native-output" : "native-output-kind-not-granted" })
      expect(buildSfContribution({ ...input, run: { ...selected.run, reviewTarget: undefined }, candidate: malformed })).toEqual({ status: "denied", reason: "invalid-review-output-context" })
      expect(buildSfContribution({ ...input, run: { ...selected.run, reviewTarget: { ...selected.run.reviewTarget!, targetSessionId: selected.run.native!.sessionID } }, candidate: malformed })).toEqual({ status: "denied", reason: "invalid-review-output-context" })
    }
    for (const payload of [null, [], { targetRunId: "model-selected-author" }]) {
      const malformed = { kind: selected.kind, payload, evidenceRefs: [] }
      expect(buildSfContribution({ ...input, run: selected.run, candidate: malformed })).toEqual({ status: "failed", reason: "invalid-native-output" })
      expect(buildSfContribution({ ...input, run: { ...selected.run, reviewTarget: undefined }, candidate: malformed })).toEqual({ status: "denied", reason: "invalid-review-output-context" })
      expect(buildSfContribution({ ...input, run: { ...selected.run, reviewTarget: { ...selected.run.reviewTarget!, targetSessionId: selected.run.native!.sessionID } }, candidate: malformed })).toEqual({ status: "denied", reason: "invalid-review-output-context" })
    }
  }
})

test("durable output must belong to the active skill and observed model", () => {
  const fixture = sfRunFixture()
  expect(matchesSfRunOutput(fixture.run, fixture.output)).toBe(true)
  const anotherSkill = { ...fixture.skill, id: "different-skill", outputSchemaRefs: ["MatchExplanation"] }
  const wrongGrant = { ...fixture.run, selection: { ...fixture.run.selection, skills: [{ ...fixture.skill, outputSchemaRefs: ["FinancialAnalysis"] }, anotherSkill] } }
  expect(matchesSfRunOutput(wrongGrant, fixture.output)).toBe(false)
  expect(buildSfContribution({ ...input, run: wrongGrant })).toEqual({ status: "failed", reason: "native-output-kind-not-granted" })
  const forgedModel = { ...fixture.output, runProvenance: { ...fixture.output.runProvenance, actualModel: "provider/unobserved" } }
  forgedModel.outputDigest = digestSfContribution(forgedModel)
  expect(matchesSfRunOutput(fixture.run, forgedModel)).toBe(false)
  const forgedReceipt = { ...fixture.output, runProvenance: { ...fixture.output.runProvenance, loadedMessageId: "unobserved-message" } }
  forgedReceipt.outputDigest = digestSfContribution(forgedReceipt)
  expect(matchesSfRunOutput(fixture.run, forgedReceipt)).toBe(false)
})
