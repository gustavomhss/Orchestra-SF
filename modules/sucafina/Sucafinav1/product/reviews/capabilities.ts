import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { AuthorizedArtifact } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { Artifact } from "../../runtime/artifact.ts"
import { renderPreservedReview } from "./render.ts"
import { renderReviewBars, renderReviewChart, renderReviewTimeline, renderReviewWaterfall, renderReviewSensitivity } from "./chart.ts"
import { matchesSelectedSources } from "./references.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import { reviewChartEvidence } from "./port.ts"
import type { ReviewChart, createReviewPort } from "./port.ts"

export type ReviewCapabilityHost = {
  reviews: ReturnType<typeof createReviewPort>
  authority: SfDomainValidation
  requiredAuthority: readonly string[]
  artifacts: {
    put: (input: { reviewRef: string; sectionRefs: readonly string[]; artifact: Artifact; format: string; recordCount: number; evidenceRefs: readonly BusinessEvidenceRef[] }, context: TrustedDomainContext) => Promise<PortResult<{ artifactRef: string }>>
    read: (artifactRef: string, context: TrustedDomainContext) => Promise<PortResult<{ reviewRef: string; sectionRefs: readonly string[]; artifact: AuthorizedArtifact }>>
  }
}

export async function prepareReview(value: unknown, context: TrustedDomainContext, host: ReviewCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_review_prepare", value)
  if (!parsed.ok) return reject("sf_review_prepare", "invalid-input", "needs-input")
  const digest = digestSfValue(parsed.value)
  if (!(await host.authority.validateDomainContext(context, "sf_review_prepare", digest))) return reject("sf_review_prepare", "invalid-binding", "denied")
  const selected = await host.reviews.preview(parsed.value.selectionRef, parsed.value.sectionRefs, context, parsed.value.period)
  if (selected.status !== "ok") return reject("sf_review_prepare", selected.reason, selected.status === "conflict" ? "stale" : selected.status)
  const output = {
    selectionRef: parsed.value.selectionRef,
    sectionRefs: selected.value.map((section) => section.id),
    sourceRefs: selected.value.flatMap((section) => [...section.projection.values.flatMap((entry) => entry.sourceRefs), ...reviewChartEvidence(section.chart)]),
    gaps: selected.value.flatMap((section) => section.projection.missing.map((entry) => ({ id: `${section.id}:${entry.field}`, category: entry.field, reason: entry.reason, evidenceRefs: [] }))),
  }
  if (!decodeSfOperationOutput("sf_review_prepare", output).ok) return reject("sf_review_prepare", "invalid-output", "unavailable")
  const fresh = await host.reviews.preview(parsed.value.selectionRef, parsed.value.sectionRefs, context, parsed.value.period)
  if (fresh.status !== "ok") return reject("sf_review_prepare", "access-unavailable", "denied")
  if (digestSfValue(fresh.value) !== digestSfValue(selected.value)) return reject("sf_review_prepare", "selection-changed", "stale")
  if (!(await host.authority.revalidateDomainContext(context))) return reject("sf_review_prepare", "access-unavailable", "denied")
  const receipt = host.authority.receiptFor(context, "sf_review_prepare", digest, digestSfValue(output))
  if (!receipt) return reject("sf_review_prepare", "invalid-binding", "denied")
  return { status: "ok", result: output, receipt }
}

export async function prepareReport(value: unknown, context: TrustedDomainContext, host: ReviewCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_report_prepare", value)
  if (!parsed.ok || (parsed.value.format !== "pptx" && parsed.value.format !== "docx")) return reject("sf_report_prepare", "invalid-input", "needs-input")
  const digest = digestSfValue(parsed.value)
  if (!(await host.authority.validateDomainContext(context, "sf_report_prepare", digest))) return reject("sf_report_prepare", "invalid-binding", "denied")
  const review = await host.reviews.read(parsed.value.reviewRef, context)
  if (review.status !== "ok") return reject("sf_report_prepare", review.reason, review.status === "conflict" ? "stale" : review.status)
  const artifact = await renderPreservedReview(review.value, { title: `Review ${review.value.id}`, format: parsed.value.format, sectionRefs: parsed.value.sectionRefs })
  if (!artifact.ok) return reject("sf_report_prepare", "report-unavailable", "unavailable")
  const fresh = await host.reviews.read(parsed.value.reviewRef, context)
  if (fresh.status !== "ok") return reject("sf_report_prepare", "access-unavailable", "denied")
  if (digestSfValue(fresh.value) !== digestSfValue(review.value)) return reject("sf_report_prepare", "review-changed", "stale")
  const selected = parsed.value.sectionRefs.map((id) => review.value.sections.find((section) => section.id === id)!)
  const evidenceRefs = selected.flatMap((section) => {
    const projection = section.content as DomainProjection & { reviewChart?: ReviewChart }
    return [...projection.values.flatMap((entry) => entry.sourceRefs), ...reviewChartEvidence(projection.reviewChart)]
  })
  const stored = await host.artifacts.put({ reviewRef: parsed.value.reviewRef, sectionRefs: parsed.value.sectionRefs, artifact, format: parsed.value.format, evidenceRefs, recordCount: selected.reduce((total, section) => total + section.count, 0) }, context)
  if (stored.status !== "ok") return reject("sf_report_prepare", stored.reason, stored.status === "conflict" ? "stale" : stored.status)
  const selectedRefs = selected.flatMap((section) => section.sourceRefs)
  const omittedComments = review.value.comments.some((comment) => !matchesSelectedSources(comment.sourceRefs, selectedRefs))
  const output = {
    reviewSelectionRef: parsed.value.reviewRef, orderedResultRefs: [stored.value.artifactRef],
    coverage: selected.map((section) => ({ sectionRef: section.id, includedCount: section.count, totalCount: section.count })),
    gaps: [...selected.flatMap((section) => ((section.content as DomainProjection).missing ?? []).map((entry) => ({ id: `${section.id}:${entry.field}`, category: entry.field, reason: entry.reason, evidenceRefs: [] }))), ...(omittedComments ? [{ id: "comments-outside-selection", category: "comment", reason: "Comment sources do not match the selected sections.", evidenceRefs: [] }] : []), ...selected.flatMap((section) => {
      const chart = (section.content as DomainProjection & { reviewChart?: ReviewChart }).reviewChart
      return chart && !renderReviewChart(section.content as DomainProjection, chart) && !renderReviewBars(section.content as DomainProjection, chart) && !renderReviewTimeline(section.content as DomainProjection, chart) && !renderReviewWaterfall(section.content as DomainProjection, chart) && !renderReviewSensitivity(chart) ? [{ id: `${section.id}:chart`, category: "chart", reason: chart.status === "ok" ? "Chart rendering unavailable; captured data remains in the report." : chart.reason, evidenceRefs: [] }] : []
    })],
  }
  if (!decodeSfOperationOutput("sf_report_prepare", output).ok) return reject("sf_report_prepare", "invalid-output", "unavailable")
  if (!(await host.authority.revalidateDomainContext(context)) || (await host.reviews.read(parsed.value.reviewRef, context)).status !== "ok") return reject("sf_report_prepare", "access-unavailable", "denied")
  const receipt = host.authority.receiptFor(context, "sf_report_prepare", digest, digestSfValue(output))
  if (!receipt) return reject("sf_report_prepare", "invalid-binding", "denied")
  return { status: "ok", outputRef: stored.value.artifactRef, result: output, receipt }
}

export async function readArtifact(value: unknown, context: TrustedDomainContext, host: ReviewCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_artifact_get", value)
  if (!parsed.ok) return reject("sf_artifact_get", "invalid-input", "needs-input")
  const digest = digestSfValue(parsed.value)
  if (!(await host.authority.validateDomainContext(context, "sf_artifact_get", digest))) return reject("sf_artifact_get", "invalid-binding", "denied")
  const stored = await host.artifacts.read(parsed.value.artifactRef, context)
  if (stored.status !== "ok") return reject("sf_artifact_get", stored.reason, stored.status === "conflict" ? "stale" : stored.status)
  if (stored.value.artifact.artifactRef !== parsed.value.artifactRef || stored.value.artifact.accessRevision !== context.binding.accessRevision) return reject("sf_artifact_get", "artifact-unavailable", "denied")
  const review = await host.reviews.read(stored.value.reviewRef, context)
  if (review.status !== "ok" || !(await host.authority.revalidateDomainContext(context))) return reject("sf_artifact_get", "access-unavailable", "denied")
  const selected = stored.value.sectionRefs.map((id) => review.value.sections.find((section) => section.id === id))
  if (new Set(stored.value.sectionRefs).size !== stored.value.sectionRefs.length || selected.some((section) => !section) || selected.reduce((total, section) => total + (section?.count ?? 0), 0) !== stored.value.artifact.recordCount) return reject("sf_artifact_get", "artifact-coverage-mismatch", "denied")
  const evidence = selected.flatMap((section) => {
    if (!section) return []
    const projection = section.content as DomainProjection & { reviewChart?: ReviewChart }
    return [...projection.values.flatMap((entry) => entry.sourceRefs), ...reviewChartEvidence(projection.reviewChart)]
  })
  const admitted = new Set(evidence.map((ref) => digestSfValue(ref)))
  if (stored.value.artifact.evidenceRefs.some((ref) => !admitted.has(digestSfValue(ref)))) return reject("sf_artifact_get", "artifact-evidence-mismatch", "denied")
  if (!decodeSfOperationOutput("sf_artifact_get", stored.value.artifact).ok) return reject("sf_artifact_get", "invalid-output", "unavailable")
  const receipt = host.authority.receiptFor(context, "sf_artifact_get", digest, digestSfValue(stored.value.artifact))
  if (!receipt) return reject("sf_artifact_get", "invalid-binding", "denied")
  return { status: "ok", result: stored.value.artifact, receipt }
}

export function createReviewCapabilities(host: ReviewCapabilityHost): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_review_prepare", pack: "documents_reports", mode: "prepare", inputSchema: sfOperationInputSchemas.sf_review_prepare, outputSchema: sfOperationOutputSchemas.sf_review_prepare, handler: (input, context) => prepareReview(input, context, host), handlerExport: "prepareReview", producerTask: "WP07.T02", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority },
    { id: "sf_report_prepare", pack: "documents_reports", mode: "prepare", inputSchema: sfOperationInputSchemas.sf_report_prepare, outputSchema: sfOperationOutputSchemas.sf_report_prepare, handler: (input, context) => prepareReport(input, context, host), handlerExport: "prepareReport", producerTask: "WP07.T04", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority },
    { id: "sf_artifact_get", pack: "documents_reports", mode: "read", inputSchema: sfOperationInputSchemas.sf_artifact_get, outputSchema: sfOperationOutputSchemas.sf_artifact_get, handler: (input, context) => readArtifact(input, context, host), handlerExport: "readArtifact", producerTask: "WP07.T04", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority },
  ]
}

function reject(operation: string, reason: string, status: "needs-input" | "stale" | "denied" | "unavailable" | "provider-conflict" | "failed"): CapabilityResult {
  return { status, reason, receipt: { kind: "unbound", operation, code: status === "needs-input" ? "invalid-input" : status === "denied" ? "invalid-binding" : "unavailable", at: new Date().toISOString() } }
}
