import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import type { SfOperationInputMap } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import type { QuestionProposal, SfOperationOutputMap } from "../contracts/outputs.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"

type Operation = "sf_work_list" | "sf_question_prepare" | "sf_answer_read" | "sf_relation_read" | "sf_handoff_prepare"
export type CollaborationCapabilityHost = {
  execute: <K extends Operation>(operation: K, value: SfOperationInputMap[K], context: TrustedDomainContext) => Promise<PortResult<SfOperationOutputMap[K]>>
  createReceipt: (context: TrustedDomainContext, operation: Operation, inputDigest: string, resultDigest?: string) => Promise<BoundCapabilityReceipt | undefined>
  requiredAuthority: Record<Operation, readonly string[]>
  recordQuestionPreparation?: (result: QuestionProposal, receipt: BoundCapabilityReceipt, context: TrustedDomainContext) => Promise<boolean>
}

export const listWork = (value: unknown, context: TrustedDomainContext, host: CollaborationCapabilityHost) => execute("sf_work_list", value, context, host)
export const prepareQuestion = (value: unknown, context: TrustedDomainContext, host: CollaborationCapabilityHost) => execute("sf_question_prepare", value, context, host)
export const readAnswer = (value: unknown, context: TrustedDomainContext, host: CollaborationCapabilityHost) => execute("sf_answer_read", value, context, host)
export const readRelations = (value: unknown, context: TrustedDomainContext, host: CollaborationCapabilityHost) => execute("sf_relation_read", value, context, host)
export const prepareHandoff = (value: unknown, context: TrustedDomainContext, host: CollaborationCapabilityHost) => execute("sf_handoff_prepare", value, context, host)

export function createCollaborationCapabilities(host: CollaborationCapabilityHost): readonly CapabilityDescriptor[] {
  const entries: readonly (Omit<CapabilityDescriptor, "id" | "pack" | "inputSchema" | "outputSchema" | "requiredAuthority"> & { id: Operation })[] = [
    { id: "sf_work_list", mode: "read", handlerExport: "listWork", producerTask: "WP08.T04", grantProfiles: ["sf_maestro"], handler: (value, context) => listWork(value, context, host) },
    { id: "sf_question_prepare", mode: "prepare", handlerExport: "prepareQuestion", producerTask: "WP08.T06", grantProfiles: ["sf_maestro"], handler: (value, context) => prepareQuestion(value, context, host) },
    { id: "sf_answer_read", mode: "read", handlerExport: "readAnswer", producerTask: "WP08.T02", grantProfiles: ["sf_maestro"], handler: (value, context) => readAnswer(value, context, host) },
    { id: "sf_relation_read", mode: "read", handlerExport: "readRelations", producerTask: "WP08.T01", grantProfiles: ["sf_maestro", "sf_portfolio"], handler: (value, context) => readRelations(value, context, host) },
    { id: "sf_handoff_prepare", mode: "prepare", handlerExport: "prepareHandoff", producerTask: "WP08.T05", grantProfiles: ["sf_maestro"], handler: (value, context) => prepareHandoff(value, context, host) },
  ]
  return entries.map((entry) => ({ ...entry, pack: "collaboration", inputSchema: sfOperationInputSchemas[entry.id], outputSchema: sfOperationOutputSchemas[entry.id], requiredAuthority: host.requiredAuthority[entry.id] }))
}

async function execute<K extends Operation>(operation: K, value: unknown, context: TrustedDomainContext, host: CollaborationCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput(operation, value)
  if (!parsed.ok) return { status: "needs-input", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const digest = digestSfValue(parsed.value)
  const admission = await host.createReceipt(context, operation, digest)
  if (!admission) return { status: "denied", reason: "authority-unavailable", receipt: { kind: "unbound", operation, code: "invalid-binding", at: new Date().toISOString() } }
  const result = await host.execute(operation, parsed.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "stale" : result.status, reason: result.reason, receipt: admission }
  if (!decodeSfOperationOutput(operation, result.value).ok) return { status: "unavailable", reason: "invalid-output", receipt: admission }
  const receipt = await host.createReceipt(context, operation, digest, digestSfValue(result.value))
  if (!receipt) return { status: "denied", reason: "authority-changed", receipt: { kind: "unbound", operation, code: "invalid-binding", at: new Date().toISOString() } }
  if (operation === "sf_question_prepare" && host.recordQuestionPreparation) {
    const question = decodeSfOperationOutput("sf_question_prepare", result.value)
    if (!question.ok || !await host.recordQuestionPreparation(question.value, receipt, context)) return { status: "unavailable", reason: "question-preparation-unavailable", receipt }
  }
  return { status: "ok", result: result.value, receipt }
}

