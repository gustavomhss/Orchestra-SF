import type { createSfContributionReader } from "../ai/contribution-reader.ts"
import type { createSfDecisionResultStore, StoredDecisionResult } from "../decisions/result-store.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import type { PreservedReview } from "../contracts/context.ts"
import type { AuthorizedArtifact } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import { decodeSfContributionEnvelope } from "../contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ReviewCapabilityHost } from "./capabilities.ts"
import type { createReviewPort } from "./port.ts"

type ReadyOutput = Extract<ContributionEnvelope, { state: "ready" }>
type DecisionOutput = Extract<ReadyOutput, { kind: "DecisionBrief" }>
type MaterialOutput = Extract<ReadyOutput, { kind: "MeetingMaterialProposal" }>
type BriefResult = { kind: "contribution"; output: ReadyOutput } | { kind: "decision-result"; value: StoredDecisionResult }
export type ReviewContributionRequest = { outputRef: string; caseRef: ContributionEnvelope["caseRef"]; expectedOutputDigest?: string }
export type ReviewContribution =
  | { kind: "DecisionBrief"; output: DecisionOutput; results: readonly BriefResult[]; links: readonly ({ kind: "contribution"; outputRef: string } | { kind: "decision-result"; resultRef: string })[] }
  | { kind: "MeetingMaterialProposal"; output: MaterialOutput; review: PreservedReview; artifacts: readonly AuthorizedArtifact[]; links: readonly ({ kind: "review"; reviewRef: string } | { kind: "artifact"; artifactRef: string })[] }

/** Opens the persisted C11 output and every target under the consumer's current authority. */
export function createReviewContributionConsumer(input: {
  contributions: ReturnType<typeof createSfContributionReader>
  reviews: Pick<ReturnType<typeof createReviewPort>, "read">
  artifacts: Pick<ReviewCapabilityHost["artifacts"], "read">
  results?: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}) {
  const read = async (request: ReviewContributionRequest, context: TrustedDomainContext): Promise<PortResult<ReadyOutput>> => {
    const result = await input.contributions({ outputRef: request.outputRef, caseRef: request.caseRef }, context)
    if (result.status !== "ok") return { status: result.status, reason: "review-contribution-unavailable" }
    const parsed = decodeSfContributionEnvelope(result.value.output)
    if (!parsed.ok || parsed.value.state !== "ready" || parsed.value.id !== request.outputRef || digestSfValue(parsed.value.caseRef) !== digestSfValue(request.caseRef) || parsed.value.accessRevision !== context.binding.accessRevision || digestSfContribution(parsed.value) !== parsed.value.outputDigest) return { status: "unavailable", reason: "review-contribution-invalid" }
    if (request.expectedOutputDigest && request.expectedOutputDigest !== parsed.value.outputDigest) return { status: "stale", reason: "review-contribution-changed" }
    return { status: "ok", value: structuredClone(parsed.value) }
  }
  const readResult = async (ref: string, caseRef: ContributionEnvelope["caseRef"], context: TrustedDomainContext): Promise<PortResult<BriefResult>> => {
    if (!ref.startsWith("decision-result:")) {
      const result = await read({ outputRef: ref, caseRef }, context)
      if (result.status !== "ok") return result
      if (result.value.kind === "DecisionBrief" || result.value.kind === "MeetingMaterialProposal") return { status: "unavailable", reason: "review-brief-result-kind-unavailable" }
      return { status: "ok", value: { kind: "contribution", output: result.value } }
    }
    if (!input.results) return { status: "unavailable", reason: "review-decision-reader-unavailable" }
    for (const kind of ["scenario", "comparison", "sensitivity", "portfolio"] as const) {
      const result = await input.results.read({ resultRef: ref, kind }, context)
      if (result.status !== "ok") {
        if (result.status !== "unavailable") return { status: result.status, reason: "review-brief-result-unavailable" }
        continue
      }
      if (result.value.resultRef !== ref || result.value.kind !== kind || digestSfValue(result.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(result.value.result) !== result.value.resultDigest) return { status: "unavailable", reason: "review-brief-result-invalid" }
      return { status: "ok", value: { kind: "decision-result", value: structuredClone(result.value) } }
    }
    return { status: "unavailable", reason: "review-brief-result-unavailable" }
  }
  return async (incoming: ReviewContributionRequest, context: TrustedDomainContext): Promise<PortResult<ReviewContribution>> => {
    if (!validRequest(incoming)) return { status: "needs-input", reason: "invalid-review-contribution" }
    const request = structuredClone(incoming)
    if (!await input.revalidate(context)) return { status: "denied", reason: "review-contribution-unavailable" }
    const loaded = await read(request, context)
    if (loaded.status !== "ok") return loaded
    const output = loaded.value
    if (output.kind === "DecisionBrief") {
      const brief = output.payload
      // The producer binds the physical case with encodeCaseRef. An executive brief may
      // contain only its verified objective and conditions, without a result to open.
      if (brief.caseRef !== encodeCaseRef(request.caseRef) || brief.caseVersion !== request.caseRef.version || brief.orderedResultRefs.some((ref) => !ref.trim()) || new Set(brief.orderedResultRefs).size !== brief.orderedResultRefs.length || brief.orderedResultRefs.includes(output.id) || (!brief.orderedResultRefs.length && (brief.runRef !== undefined || brief.resultRef !== undefined))) return { status: "unavailable", reason: "review-brief-references-unavailable" }
      const results: BriefResult[] = []
      for (const outputRef of brief.orderedResultRefs) {
        const result = await readResult(outputRef, request.caseRef, context)
        if (result.status !== "ok") return { status: result.status, reason: "review-brief-result-unavailable" }
        results.push(result.value)
      }
      for (const result of results) {
        const current = await readResult(result.kind === "contribution" ? result.output.id : result.value.resultRef, request.caseRef, context)
        if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(result)) return { status: current.status === "denied" ? "denied" : "stale", reason: "review-brief-result-unavailable" }
      }
      const current = await read({ ...request, expectedOutputDigest: output.outputDigest }, context)
      if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(output)) return { status: current.status === "denied" ? "denied" : "stale", reason: "review-contribution-changed" }
      if (!await input.revalidate(context)) return { status: "denied", reason: "review-contribution-unavailable" }
      return { status: "ok", value: { kind: "DecisionBrief", output, results, links: results.map((result) => result.kind === "contribution" ? { kind: "contribution", outputRef: result.output.id } : { kind: "decision-result", resultRef: result.value.resultRef }) } }
    }
    if (output.kind !== "MeetingMaterialProposal") return { status: "unavailable", reason: "review-contribution-kind-unavailable" }
    const material = output.payload
    if (!material.orderedResultRefs.length || new Set(material.orderedResultRefs).size !== material.orderedResultRefs.length || !material.coverage.length || new Set(material.coverage.map((section) => section.sectionRef)).size !== material.coverage.length) return { status: "unavailable", reason: "review-material-references-unavailable" }
    const review = await input.reviews.read(material.reviewSelectionRef, context)
    if (review.status !== "ok" || review.value.id !== material.reviewSelectionRef) return { status: "denied", reason: "review-material-unavailable" }
    const reviewDigest = digestSfValue(review.value)
    const sectionRefs = material.coverage.map((entry) => entry.sectionRef)
    if (material.coverage.some((entry) => !Number.isSafeInteger(entry.includedCount) || entry.includedCount < 0 || entry.includedCount !== entry.totalCount || review.value.sections.find((section) => section.id === entry.sectionRef)?.count !== entry.includedCount)) return { status: "unavailable", reason: "review-material-coverage-mismatch" }
    const recordCount = material.coverage.reduce((total, entry) => total + entry.includedCount, 0)
    const artifacts: AuthorizedArtifact[] = []
    const selections: (readonly string[])[] = []
    for (const artifactRef of material.orderedResultRefs) {
      const result = await input.artifacts.read(artifactRef, context)
      // Coverage counts describe a set. The persisted artifact owns the selected
      // section order; a proposed coverage table must not reorder that selection.
      if (result.status !== "ok" || result.value.reviewRef !== review.value.id || result.value.sectionRefs.length !== sectionRefs.length || new Set(result.value.sectionRefs).size !== sectionRefs.length || result.value.sectionRefs.some((id) => !sectionRefs.includes(id)) || (selections.length > 0 && digestSfValue(result.value.sectionRefs) !== digestSfValue(selections[0])) || result.value.artifact.artifactRef !== artifactRef || result.value.artifact.accessRevision !== context.binding.accessRevision || result.value.artifact.recordCount !== recordCount || !["docx", "pptx"].includes(result.value.artifact.format)) return { status: "denied", reason: "review-material-artifact-unavailable" }
      selections.push([...result.value.sectionRefs])
      artifacts.push(structuredClone(result.value.artifact))
    }
    for (const [index, artifact] of artifacts.entries()) {
      const current = await input.artifacts.read(artifact.artifactRef, context)
      if (current.status !== "ok" || current.value.reviewRef !== review.value.id || digestSfValue(current.value.sectionRefs) !== digestSfValue(selections[index]) || digestSfValue(current.value.artifact) !== digestSfValue(artifact)) return { status: "denied", reason: "review-material-artifact-unavailable" }
    }
    const currentReview = await input.reviews.read(review.value.id, context)
    if (currentReview.status !== "ok" || digestSfValue(currentReview.value) !== reviewDigest) return { status: "denied", reason: "review-material-unavailable" }
    const current = await read({ ...request, expectedOutputDigest: output.outputDigest }, context)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(output)) return { status: current.status === "denied" ? "denied" : "stale", reason: "review-contribution-changed" }
    if (!await input.revalidate(context)) return { status: "denied", reason: "review-contribution-unavailable" }
    return { status: "ok", value: { kind: "MeetingMaterialProposal", output, review: currentReview.value, artifacts, links: [{ kind: "review", reviewRef: currentReview.value.id }, ...artifacts.map((artifact) => ({ kind: "artifact" as const, artifactRef: artifact.artifactRef }))] } }
  }
}

function validRequest(value: unknown): value is ReviewContributionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const request = value as Record<string, unknown>
  if (Object.keys(request).some((key) => !["outputRef", "caseRef", "expectedOutputDigest"].includes(key)) || typeof request.outputRef !== "string" || !request.outputRef.trim() || (request.expectedOutputDigest !== undefined && (typeof request.expectedOutputDigest !== "string" || !/^[a-f0-9]{64}$/.test(request.expectedOutputDigest))) || !request.caseRef || typeof request.caseRef !== "object" || Array.isArray(request.caseRef)) return false
  const caseRef = request.caseRef as Record<string, unknown>
  return Object.keys(caseRef).every((key) => ["id", "incarnation", "version"].includes(key)) && typeof caseRef.id === "string" && !!caseRef.id.trim() && typeof caseRef.incarnation === "string" && !!caseRef.incarnation.trim() && Number.isSafeInteger(caseRef.version) && Number(caseRef.version) > 0
}
