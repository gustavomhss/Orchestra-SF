import type { ReviewOutcomeComparison } from "../reviews/outcome.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import { reviewInclusion } from "../reviews/inclusion.ts"
import { readReviewArtifactSeal, readReviewArtifactRenderDigest } from "../reviews/render.ts"
import type { ReviewInclusion } from "../reviews/inclusion.ts"
import { reviewDecisionEvidence } from "../reviews/decision.ts"
import { createHash } from "node:crypto"
import { digestSfValue } from "../contracts/canonical.ts"
import { reviewChartEvidence } from "../reviews/port.ts"
import type { createReviewPort } from "../reviews/port.ts"
import type { ReviewCapabilityHost } from "../reviews/capabilities.ts"
import type { ReviewChart } from "../reviews/port.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { validReportArtifactMetadata, validateReportArtifact } from "../../runtime/artifact.ts"

type ArtifactInput = Parameters<ReviewCapabilityHost["artifacts"]["put"]>[0]
type StoredReport = {
  kind: "sf-review-artifact-v1"
  reviewRef: string
  reviewDigest: string
  renderDigest?: string
  inclusion: ReviewInclusion
  sectionRefs: readonly string[]
  principalRef: string
  installationId: string
  projectId: string
  policyVersion: string
  format: string
  name: string
  mediaType: string
  recordCount: number
  evidenceRefs: ArtifactInput["evidenceRefs"]
  digest: string
  bytes: string
}

/** Private product-state persistence; the installation must provide its durable C08 adapter. */
export function createReviewArtifactStorage(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  reviews: ReturnType<typeof createReviewPort>
  creationTarget: { ref: string; incarnation: string }
  operationIdentity: (context: TrustedDomainContext, entry: ArtifactInput) => string | undefined
  maxBytes: number
}) {
  async function load(ref: string, context: TrustedDomainContext): Promise<PortResult<{ stored: StoredReport; bytes: Uint8Array }>> {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context) || !/^report:[a-f0-9]{64}$/.test(ref)) return { status: "denied", reason: "artifact-unavailable" }
    const result = await input.state.read(request, "documents", (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
      return state.documents[ref]
    })
    if (result.status !== "ok" || !result.value || typeof result.value !== "object") return { status: "denied", reason: "artifact-unavailable" }
    const stored = result.value as StoredReport
    // The stored policy stamp describes creation. Authority above and the exact
    // preserved review below are checked under the current policy on every read.
    if (stored.kind !== "sf-review-artifact-v1" || stored.principalRef !== context.binding.principalRef || stored.installationId !== context.binding.installationId || stored.projectId !== context.binding.projectId || typeof stored.policyVersion !== "string" || !stored.policyVersion.trim() || !Array.isArray(stored.sectionRefs) || !Array.isArray(stored.evidenceRefs) || typeof stored.bytes !== "string" || typeof stored.digest !== "string" || typeof stored.name !== "string" || typeof stored.mediaType !== "string" || !stored.inclusion || typeof stored.inclusion !== "object" || typeof stored.reviewRef !== "string" || typeof stored.reviewDigest !== "string" || !["docx", "pptx"].includes(stored.format) || !Number.isSafeInteger(stored.recordCount) || stored.recordCount < 0) return { status: "denied", reason: "artifact-unavailable" }
    if (!validReportArtifactMetadata({ name: stored.name, type: stored.mediaType }, stored.format)) return { status: "denied", reason: "artifact-unavailable" }
    // Reject oversized encodings before allocating their decoded bytes.
    if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0 || !stored.bytes.length || stored.bytes.length > Math.ceil(input.maxBytes / 3) * 4 || !/^[a-f0-9]{64}$/.test(stored.digest)) return { status: "unavailable", reason: "artifact-integrity-failed" }
    const bytes = Buffer.from(stored.bytes, "base64")
    if (!bytes.length || bytes.length > input.maxBytes || bytes.toString("base64") !== stored.bytes || createHash("sha256").update(bytes).digest("hex") !== stored.digest || !await validateReportArtifact({ name: stored.name, type: stored.mediaType, bytes }, stored.format, input.maxBytes)) return { status: "unavailable", reason: "artifact-integrity-failed" }
    const review = await input.reviews.read(stored.reviewRef, context)
    if (review.status !== "ok" || digestSfValue(review.value) !== stored.reviewDigest) return { status: "denied", reason: "artifact-unavailable" }
    const inclusion = reviewInclusion(review.value, stored.sectionRefs)
    if (!inclusion || digestSfValue(inclusion) !== digestSfValue(stored.inclusion)) return { status: "denied", reason: "artifact-unavailable" }
    if (inclusion.sections.reduce((total, section) => total + section.recordCount, 0) !== stored.recordCount) return { status: "denied", reason: "artifact-coverage-mismatch" }
    if (digestSfValue(inclusion.sections.flatMap((section) => section.sourceRefs)) !== digestSfValue(stored.evidenceRefs)) return { status: "denied", reason: "artifact-evidence-mismatch" }
    if (!await input.host.revalidate(context) || request.signal.aborted) return { status: "denied", reason: "artifact-unavailable" }
    return { status: "ok", value: { stored, bytes: new Uint8Array(bytes) } }
  }
  return {
    async put(entry: ArtifactInput, context: TrustedDomainContext): Promise<PortResult<{ artifactRef: string }>> {
      const trace = (stage: string) => { if (process.env.SF_REPORTS_TRACE === "1") console.error("SF_REPORTS_TRACE_PUT_" + stage) }
      trace("ENTER")
      const request = input.host.requestFor(context)
      const operation = input.operationIdentity(context, entry)
      if (!request || !operation || !await input.host.revalidate(context)) return { status: "denied", reason: "artifact-unavailable" }
      if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0 || !(entry.artifact.bytes instanceof Uint8Array) || entry.artifact.bytes.length > input.maxBytes || !entry.artifact.bytes.length || !validReportArtifactMetadata(entry.artifact, entry.format) || !Number.isSafeInteger(entry.recordCount) || entry.recordCount < 0 || new Set(entry.sectionRefs).size !== entry.sectionRefs.length) return { status: "needs-input", reason: "invalid-artifact" }
      const review = await input.reviews.read(entry.reviewRef, context)
      trace("REVIEW_DONE")
      if (review.status !== "ok") return { status: "denied", reason: "artifact-unavailable" }
      const inclusion = readReviewArtifactSeal(entry.artifact, review.value, entry.sectionRefs)
      const renderDigest = readReviewArtifactRenderDigest(entry.artifact, review.value, entry.sectionRefs)
      trace("PROOF_DONE")
      if (!inclusion || !renderDigest) return { status: "denied", reason: "artifact-render-proof-unavailable" }
      const selected = entry.sectionRefs.map((id) => review.value.sections.find((section) => section.id === id))
      if (selected.some((section) => !section) || selected.reduce((total, section) => total + (section?.count ?? 0), 0) !== entry.recordCount) return { status: "denied", reason: "artifact-coverage-mismatch" }
      const evidence = selected.flatMap((section) => {
        const projection = section!.content as DomainProjection & { reviewChart?: ReviewChart }
        return [...projection.values.flatMap((value) => value.sourceRefs), ...reviewChartEvidence(projection.reviewChart), ...reviewDecisionEvidence(projection.decision), ...((projection as DomainProjection & { reviewOutcome?: ObservedResultProjection }).reviewOutcome?.sourceRefs ?? []), ...((projection as DomainProjection & { reviewOutcomeComparison?: ReviewOutcomeComparison }).reviewOutcomeComparison?.baselineRefs ?? []), ...((projection as DomainProjection & { reviewOutcomeComparison?: ReviewOutcomeComparison }).reviewOutcomeComparison?.sourceRefs ?? [])]
      })
      if (digestSfValue(evidence) !== digestSfValue(entry.evidenceRefs)) return { status: "denied", reason: "artifact-evidence-mismatch" }
      trace("EVIDENCE_DONE")
      // Detach the sealed bytes and metadata before the asynchronous ZIP inspection.
      const artifact = { name: entry.artifact.name, type: entry.artifact.type, bytes: new Uint8Array(entry.artifact.bytes) }
      const digest = createHash("sha256").update(artifact.bytes).digest("hex")
      const stored: StoredReport = { kind: "sf-review-artifact-v1", reviewRef: entry.reviewRef, reviewDigest: digestSfValue(review.value), renderDigest, inclusion, sectionRefs: [...entry.sectionRefs], principalRef: context.binding.principalRef, installationId: context.binding.installationId, projectId: context.binding.projectId, policyVersion: context.binding.policyVersion, format: entry.format, name: artifact.name, mediaType: artifact.type, recordCount: entry.recordCount, evidenceRefs: structuredClone(entry.evidenceRefs), digest, bytes: Buffer.from(artifact.bytes).toString("base64") }
      trace("VALIDATE_ENTER")
      const valid = await validateReportArtifact(artifact, stored.format, input.maxBytes)
      trace("VALIDATE_DONE")
      if (!valid) return { status: "needs-input", reason: "invalid-artifact" }
      const ref = `report:${digestSfValue({ installation: context.binding.installationId, project: context.binding.projectId, principal: context.binding.principalRef, operation })}`
      // ZIP container timestamps can change on an exact retry. The command identifies the
      // preserved content; the first committed bytes remain the immutable downloadable file.
      const commandDigest = digestSfValue(reportIntent(stored))
      trace("BEFORE_READ_ENTER")
      const before = await input.state.read(request, "documents", (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
        return state.documents[ref]
      })
      trace("BEFORE_READ_DONE")
      if (before.status !== "ok" && !(before.status === "unavailable" && before.reason === "product-state-uninitialized")) return { status: "unavailable", reason: "artifact-storage-unavailable" }
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "artifact-unavailable" }
      if (before.status === "ok" && before.value) {
        const existing = await load(ref, context)
        if (existing.status !== "ok") return existing
        if (digestSfValue(reportIntent(existing.value.stored)) !== commandDigest) return { status: "conflict", reason: "artifact-operation-reused" }
        return { status: "ok", value: { artifactRef: ref } }
      }
      trace("TX_ENTER")
      const saved = await input.state.transaction(request, { namespace: "documents", expectedStorageVersion: before.status === "ok" ? before.storageVersion : 0, targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation, idempotencyKey: operation, commandDigest }, async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || state.documents[ref]) return { commit: false, value: false }
        state.documents[ref] = stored
        return { commit: true, value: true }
      })
      trace("TX_DONE")
      if (saved.status === "unavailable" || saved.status === "denied") return saved
      if (saved.status !== "ok" || !saved.value) {
        const existing = await load(ref, context)
        if (existing.status === "ok" && digestSfValue(reportIntent(existing.value.stored)) === commandDigest) return { status: "ok", value: { artifactRef: ref } }
        if (saved.status === "conflict") return saved
        return { status: "conflict", reason: "artifact-storage-conflict" }
      }
      const current = await load(ref, context)
      if (current.status !== "ok") return current
      return { status: "ok", value: { artifactRef: ref } }
    },
    async read(ref: string, context: TrustedDomainContext): Promise<PortResult<{ reviewRef: string; sectionRefs: readonly string[]; artifact: { artifactRef: string; format: string; recordCount: number; evidenceRefs: ArtifactInput["evidenceRefs"]; accessRevision: string } }>> {
      const result = await load(ref, context)
      if (result.status !== "ok") return result
      return { status: "ok", value: { reviewRef: result.value.stored.reviewRef, sectionRefs: result.value.stored.sectionRefs, artifact: { artifactRef: ref, format: result.value.stored.format, recordCount: result.value.stored.recordCount, evidenceRefs: result.value.stored.evidenceRefs, accessRevision: context.binding.accessRevision } } }
    },
    async inclusion(ref: string, context: TrustedDomainContext): Promise<PortResult<ReviewInclusion & { artifactRef: string; artifactDigest: string }>> {
      const result = await load(ref, context)
      if (result.status !== "ok") return result
      return { status: "ok", value: { ...result.value.stored.inclusion, artifactRef: ref, artifactDigest: result.value.stored.digest } }
    },
    async download(ref: string, context: TrustedDomainContext): Promise<Response> {
      const result = await load(ref, context)
      if (result.status !== "ok") return new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store" } })
      return new Response(new Uint8Array(result.value.bytes), { headers: { "Content-Type": result.value.stored.mediaType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.value.stored.name)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } })
    },
  }
}

function reportIntent(stored: StoredReport) {
  return {
    kind: stored.kind, reviewRef: stored.reviewRef, reviewDigest: stored.reviewDigest, renderDigest: stored.renderDigest ?? "legacy-renderer",
    inclusion: stored.inclusion, sectionRefs: stored.sectionRefs, principalRef: stored.principalRef,
    installationId: stored.installationId, projectId: stored.projectId, policyVersion: stored.policyVersion,
    format: stored.format, name: stored.name, mediaType: stored.mediaType,
    recordCount: stored.recordCount, evidenceRefs: stored.evidenceRefs,
  }
}
