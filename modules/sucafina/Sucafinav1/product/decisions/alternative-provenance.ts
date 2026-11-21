import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { AlternativeDraftRequest } from "../contracts/operations.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { BoundCapabilityReceipt, TrustedCallContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../contracts/state.ts"
import { encodeCaseRef } from "./case-port.ts"

type NativeReceipt = Extract<BoundCapabilityReceipt, { kind: "native" }>
export type AlternativeCapabilityProvenance = {
  schema: "sf-alternative-provenance-v1"
  caseRef: { id: string; incarnation: string; version: number }
  installationId: string
  projectId: string
  policyVersion: string
  operationIdentity: string
  request: AlternativeDraftRequest
  output: SfOperationOutputMap["sf_alternative_draft"]
  receipt: NativeReceipt
  recordDigest: string
}

/** Called only on the trusted capability bridge after it has verified the active call lease. */
export function captureAlternativeProvenance(request: AlternativeDraftRequest, output: SfOperationOutputMap["sf_alternative_draft"], receipt: BoundCapabilityReceipt, context: TrustedCallContext, operationIdentity: string): AlternativeCapabilityProvenance | undefined {
  if (!operationIdentity.trim() || receipt.kind !== "native" || receipt.operation !== "sf_alternative_draft" || receipt.handlerExport !== "draftAlternative" || receipt.runId !== context.binding.runId || receipt.nativeSessionId !== context.binding.nativeSessionId || receipt.providerGeneration !== context.binding.providerGeneration || receipt.principalRef !== context.binding.principalRef || receipt.accessRevision !== context.binding.accessRevision || !receipt.callId.trim() || !Number.isFinite(Date.parse(receipt.at)) || receipt.inputDigest !== digestSfValue(request) || receipt.resultDigest !== digestSfValue(output) || !decodeSfOperationInput("sf_alternative_draft", request).ok || !decodeSfOperationOutput("sf_alternative_draft", output).ok || output.domainApplied !== false || request.caseRef !== encodeCaseRef({ id: context.binding.caseId, incarnation: context.binding.caseIncarnation }) || output.caseRef !== request.caseRef) return undefined
  const value = { schema: "sf-alternative-provenance-v1" as const, caseRef: { id: context.binding.caseId, incarnation: context.binding.caseIncarnation, version: context.binding.caseVersion }, installationId: context.binding.installationId, projectId: context.binding.projectId, policyVersion: context.binding.policyVersion, operationIdentity, request: structuredClone(request), output: structuredClone(output), receipt: structuredClone(receipt) }
  return { ...value, recordDigest: digestSfValue(value) }
}

/** Validates a bridge-captured record against the exact C11 publication; it does not authenticate the capture. */
export function verifyAlternativePublication(record: AlternativeCapabilityProvenance, run: SfNativeRunRecord, output: ContributionEnvelope) {
  const { recordDigest, ...value } = record
  return record.schema === "sf-alternative-provenance-v1" && !!record.operationIdentity.trim() && recordDigest === digestSfValue(value) && record.receipt.kind === "native" && record.receipt.operation === "sf_alternative_draft" && record.receipt.handlerExport === "draftAlternative" && !!record.receipt.callId.trim() && record.receipt.inputDigest === digestSfValue(record.request) && record.receipt.resultDigest === digestSfValue(record.output) && decodeSfOperationInput("sf_alternative_draft", record.request).ok && decodeSfOperationOutput("sf_alternative_draft", record.output).ok && record.output.domainApplied === false && record.request.caseRef === encodeCaseRef(record.caseRef) && record.output.caseRef === record.request.caseRef && run.native?.sessionID === record.receipt.nativeSessionId && run.runRef === record.receipt.runId && run.principalRef === record.receipt.principalRef && run.accessRevision === record.receipt.accessRevision && run.policyVersion === record.policyVersion && digestSfValue(run.caseRef) === digestSfValue(record.caseRef) && String(output.kind) === "AlternativeDraft" && output.state === "ready" && output.id === run.outputRef && output.runProvenance.runId === run.runRef && output.accessRevision === run.accessRevision && digestSfValue(output.caseRef) === digestSfValue(record.caseRef) && output.outputDigest === digestSfContribution(output) && digestSfValue(output.payload) === record.receipt.resultDigest
}

/** This key belongs in C08 preferences, atomically alongside the C11 run and output. */
export function alternativeProvenanceKey(record: AlternativeCapabilityProvenance) {
  return `sf:proposal-coverage:alternative-provenance:${digestSfValue({ runRef: record.receipt.runId, operationIdentity: record.operationIdentity, callId: record.receipt.callId, inputDigest: record.receipt.inputDigest, resultDigest: record.receipt.resultDigest })}`
}
