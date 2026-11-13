import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { BusinessContextRequest, BusinessRecallRequest } from "../contracts/operations.ts"
import type { RecallFeatures, RecallScope } from "../decision-memory/recall.ts"
import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { rankSfAtlasRecall } from "./atlas-memory.ts"
import type { createSfAtlasMemory } from "./atlas-memory.ts"
import type { BoundCapabilityReceipt, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"

type EvidenceCapabilityHost = {
  context: BusinessContextService
  memory: ReturnType<typeof createSfAtlasMemory>
  contextSelections: (request: BusinessContextRequest, call: TrustedDomainContext) => Promise<readonly BusinessEvidenceRef[] | undefined>
  recallSelections: (request: BusinessRecallRequest, call: TrustedDomainContext) => Promise<{ caseRefs: readonly { id: string; incarnation: string }[]; features: RecallFeatures } | undefined>
  featuresForCase: (value: AuthorizedCaseProjection, call: TrustedDomainContext) => Promise<RecallFeatures | undefined>
  runtimeVersions: Pick<RecallScope, "boundaryVersion" | "schemaVersion" | "manifestVersion" | "skillVersion">
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
  createReceipt: (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => BoundCapabilityReceipt | undefined
}

export async function resolveSfSource(value: unknown, call: TrustedDomainContext, host: EvidenceCapabilityHost): Promise<CapabilityResult> {
  const input = decodeSfOperationInput("sf_source_get", value)
  if (!input.ok) return reject("sf_source_get", "invalid-input", "needs-input")
  if (!host.createReceipt(call, "sf_source_get", digestSfValue(input.value))) return reject("sf_source_get", "invalid-binding")
  const result = await host.context.resolve(input.value.evidenceRef, call)
  if (["unavailable", "revoked", "missing", "invalid", "replaced"].includes(result.state)) return reject("sf_source_get", "unavailable")
  return deliver("sf_source_get", input.value, result, call, host)
}

export async function resolveSfBusinessEvidence(value: unknown, call: TrustedDomainContext, host: EvidenceCapabilityHost): Promise<CapabilityResult> {
  const input = decodeSfOperationInput("sf_evidence_get", value)
  if (!input.ok) return reject("sf_evidence_get", "invalid-input", "needs-input")
  if (!host.createReceipt(call, "sf_evidence_get", digestSfValue(input.value))) return reject("sf_evidence_get", "invalid-binding")
  const result = await host.context.resolve(input.value.evidenceRef, call)
  if (["unavailable", "revoked", "missing", "invalid", "replaced"].includes(result.state)) return reject("sf_evidence_get", "unavailable")
  return deliver("sf_evidence_get", input.value, result, call, host)
}

export async function checkSfFreshness(value: unknown, call: TrustedDomainContext, host: EvidenceCapabilityHost): Promise<CapabilityResult> {
  const input = decodeSfOperationInput("sf_freshness_check", value)
  if (!input.ok) return reject("sf_freshness_check", "invalid-input", "needs-input")
  if (!host.createReceipt(call, "sf_freshness_check", digestSfValue(input.value))) return reject("sf_freshness_check", "invalid-binding")
  const result = { resolutions: await host.context.context({ refs: input.value.evidenceRefs }, call) }
  if (result.resolutions.some((item) => ["unavailable", "revoked", "missing", "invalid", "replaced"].includes(item.state))) return reject("sf_freshness_check", "unavailable")
  return deliver("sf_freshness_check", input.value, result, call, host)
}

export async function readSfBusinessContext(value: unknown, call: TrustedDomainContext, host: EvidenceCapabilityHost): Promise<CapabilityResult> {
  const input = decodeSfOperationInput("sf_context_get", value)
  if (!input.ok) return reject("sf_context_get", "invalid-input", "needs-input")
  if (!host.createReceipt(call, "sf_context_get", digestSfValue(input.value))) return reject("sf_context_get", "invalid-binding")
  const refs = await host.contextSelections(input.value, call)
  if (!refs || (input.value.selectionRefs.length > 0 && refs.length === 0)) return reject("sf_context_get", "unavailable")
  const resolutions = await host.context.context({ refs }, call)
  if (resolutions.some((item) => ["unavailable", "revoked", "missing", "invalid", "replaced"].includes(item.state))) return reject("sf_context_get", "unavailable")
  return deliver("sf_context_get", input.value, { resolutions, accessRevision: call.binding.accessRevision }, call, host)
}

export async function recallSfDecisions(value: unknown, call: TrustedDomainContext, host: EvidenceCapabilityHost): Promise<CapabilityResult> {
  const input = decodeSfOperationInput("sf_decision_recall", value)
  if (!input.ok) return reject("sf_decision_recall", "invalid-input", "needs-input")
  if (!host.createReceipt(call, "sf_decision_recall", digestSfValue(input.value))) return reject("sf_decision_recall", "invalid-binding")
  const selection = await host.recallSelections(input.value, call)
  if (!selection || (input.value.selectionRefs.length > 0 && selection.caseRefs.length === 0) || new Set(selection.caseRefs.map((ref) => JSON.stringify([ref.id, ref.incarnation]))).size !== selection.caseRefs.length) return reject("sf_decision_recall", "unavailable")
  const ranked = await rankSfAtlasRecall({ memory: host.memory, caseRefs: selection.caseRefs, features: selection.features, featuresForCase: host.featuresForCase, runtimeVersions: host.runtimeVersions, call, proveContinuity: host.proveContinuity, revalidate: host.revalidate })
  if (ranked.status !== "ok") return reject("sf_decision_recall", "unavailable")
  const matches = []
  for (const item of ranked.cases.slice(0, input.value.limit)) {
    const current = await host.memory.recall(item.candidateCaseRef, call)
    if (current.status !== "ok") return reject("sf_decision_recall", "unavailable")
    const record = current.records.find((candidate) => candidate.recordDigest === item.atlasTrace.recordDigest)
    if (!record) return reject("sf_decision_recall", "unavailable")
    matches.push({ caseRef: item.candidateCaseRef, memoryRecordRef: record.envelope.eventId, explanation: { candidateCaseRef: item.candidateCaseRef, matchedCriteria: item.matchedCriteria, currentDifferences: item.currentDifferences, sourceStates: item.sourceStates, limitations: item.limitations }, evidenceRefs: record.envelope.evidenceRefs })
  }
  const checked = await rankSfAtlasRecall({ memory: host.memory, caseRefs: selection.caseRefs, features: selection.features, featuresForCase: host.featuresForCase, runtimeVersions: host.runtimeVersions, call, proveContinuity: host.proveContinuity, revalidate: host.revalidate })
  if (checked.status !== "ok" || digestSfValue(checked.cases) !== digestSfValue(ranked.cases) || !await host.revalidate(call)) return reject("sf_decision_recall", "unavailable")
  return deliver("sf_decision_recall", input.value, { matches, limitations: ["Semelhança não recomenda uma escolha."], accessRevision: call.binding.accessRevision }, call, host)
}

function deliver(operation: "sf_context_get" | "sf_decision_recall" | "sf_source_get" | "sf_evidence_get" | "sf_freshness_check", input: unknown, result: unknown, call: TrustedDomainContext, host: EvidenceCapabilityHost): CapabilityResult {
  const output = decodeSfOperationOutput(operation, result)
  if (!output.ok) return reject(operation, "unavailable")
  const receipt = host.createReceipt(call, operation, digestSfValue(input), digestSfValue(result))
  if (!receipt) return reject(operation, "invalid-binding")
  return { status: "ok", result: output.value, receipt }
}

function reject(operation: string, code: "invalid-input" | "invalid-binding" | "unavailable", status: "needs-input" | "unavailable" = "unavailable"): CapabilityResult {
  return { status, reason: code, receipt: { kind: "unbound", operation, code, at: new Date().toISOString() } }
}
