import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { DecisionCasePort } from "../contracts/ports.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "./case-port.ts"
import type { createDecisionProposalService } from "./proposals.ts"

type DecisionCapabilityHost = {
  cases: DecisionCasePort
  requiredAuthority: { read: readonly string[]; draft: readonly string[]; receipt: readonly string[]; alternative: readonly string[] }
  alternative?: ReturnType<typeof createDecisionProposalService>
  createReceipt: (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => BoundCapabilityReceipt | undefined
}

export async function readCase(value: unknown, context: TrustedDomainContext, host: DecisionCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_case_read", value)
  if (!parsed.ok) return reject("sf_case_read", "invalid-case-reference", "invalid-input", "needs-input")
  if (!host.createReceipt(context, "sf_case_read", digestSfValue(parsed.value))) return reject("sf_case_read", "authority-unavailable", "invalid-binding")
  const result = await host.cases.read(parsed.value, context)
  if (result.status !== "ok") return reject("sf_case_read", result.reason, result.status === "denied" ? "invalid-binding" : "unavailable", result.status === "conflict" ? "stale" : result.status)
  if (!decodeSfOperationOutput("sf_case_read", result.value).ok) return reject("sf_case_read", "invalid-case-projection", "unavailable", "unavailable")
  const receipt = host.createReceipt(context, "sf_case_read", digestSfValue(parsed.value), digestSfValue(result.value))
  if (!receipt) return reject("sf_case_read", "authority-unavailable", "invalid-binding")
  return { status: "ok", result: result.value, receipt }
}

export async function draftCase(value: unknown, context: TrustedDomainContext, host: DecisionCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_case_draft", value)
  if (!parsed.ok) return reject("sf_case_draft", "invalid-case-draft", "invalid-input", "needs-input")
  if (!host.createReceipt(context, "sf_case_draft", digestSfValue(parsed.value))) return reject("sf_case_draft", "authority-unavailable", "invalid-binding")
  if (context.kind === "native") {
    const intent = await host.cases.prepareIntent(parsed.value, context)
    if (intent.status !== "ok") return reject("sf_case_draft", intent.reason, intent.status === "denied" ? "invalid-binding" : "unavailable", intent.status === "conflict" ? "stale" : intent.status)
    if (!decodeSfOperationOutput("sf_case_draft", intent.value).ok) return reject("sf_case_draft", "invalid-intent-frame", "unavailable", "unavailable")
    const receipt = host.createReceipt(context, "sf_case_draft", digestSfValue(parsed.value), digestSfValue(intent.value))
    if (!receipt) return reject("sf_case_draft", "authority-unavailable", "invalid-binding")
    return { status: "ok", outputRef: encodeCaseRef({ id: context.binding.caseId, incarnation: context.binding.caseIncarnation }), result: intent.value, receipt }
  }
  const result = await host.cases.draft(parsed.value, context)
  if (result.status !== "ok") return reject("sf_case_draft", result.reason, result.status === "denied" ? "invalid-binding" : "unavailable", result.status === "conflict" ? "stale" : result.status)
  const output = { objective: result.value.objective, horizon: result.value.horizon, currency: result.value.currency, criteria: result.value.criteria, sourceRefs: result.value.sourceRefs, gaps: [], domainApplied: false as const, analysisBasis: "domain" as const }
  if (!decodeSfOperationOutput("sf_case_draft", output).ok) return reject("sf_case_draft", "invalid-intent-frame", "unavailable", "unavailable")
  const receipt = host.createReceipt(context, "sf_case_draft", digestSfValue(parsed.value), digestSfValue(output))
  if (!receipt) return reject("sf_case_draft", "authority-unavailable", "invalid-binding")
  return { status: "ok", outputRef: encodeCaseRef(result.value), result: output, receipt }
}

export async function draftAlternative(value: unknown, context: TrustedDomainContext, host: DecisionCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_alternative_draft", value)
  if (!parsed.ok) return reject("sf_alternative_draft", "invalid-alternative-proposal", "invalid-input", "needs-input")
  if (!host.alternative) return reject("sf_alternative_draft", "alternative-producer-unavailable", "unavailable", "unavailable")
  if (!host.createReceipt(context, "sf_alternative_draft", digestSfValue(parsed.value))) return reject("sf_alternative_draft", "authority-unavailable", "invalid-binding")
  const result = await host.alternative(parsed.value, context)
  if (result.status !== "ok") return reject("sf_alternative_draft", result.reason, result.status === "denied" ? "invalid-binding" : "unavailable", result.status === "conflict" ? "stale" : result.status)
  if (!decodeSfOperationOutput("sf_alternative_draft", result.value).ok) return reject("sf_alternative_draft", "invalid-alternative-output", "unavailable", "unavailable")
  const receipt = host.createReceipt(context, "sf_alternative_draft", digestSfValue(parsed.value), digestSfValue(result.value))
  if (!receipt) return reject("sf_alternative_draft", "authority-unavailable", "invalid-binding")
  return { status: "ok", result: result.value, receipt }
}

export function encodeReceiptRef(caseRef: string, receiptId: string) {
  return `receipt:${encodeURIComponent(caseRef)}:${encodeURIComponent(receiptId)}`
}

export function parseReceiptRef(value: string): { caseRef: string; receiptId: string } | undefined {
  const match = /^receipt:([^:]+):([^:]+)$/.exec(value)
  if (!match) return undefined
  try {
    const caseRef = decodeURIComponent(match[1]!)
    const receiptId = decodeURIComponent(match[2]!)
    if (!receiptId.trim() || encodeReceiptRef(caseRef, receiptId) !== value) return undefined
    return { caseRef, receiptId }
  } catch {
    return undefined
  }
}

export async function readReceipt(value: unknown, context: TrustedDomainContext, host: DecisionCapabilityHost): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput("sf_receipt_get", value)
  if (!parsed.ok) return reject("sf_receipt_get", "invalid-receipt-reference", "invalid-input", "needs-input")
  const ref = parseReceiptRef(parsed.value.receiptRef)
  if (!ref) return reject("sf_receipt_get", "invalid-receipt-reference", "invalid-input", "needs-input")
  if (!host.createReceipt(context, "sf_receipt_get", digestSfValue(parsed.value))) return reject("sf_receipt_get", "authority-unavailable", "invalid-binding")
  const result = await host.cases.read({ caseRef: ref.caseRef }, context)
  if (result.status !== "ok") return reject("sf_receipt_get", result.reason, result.status === "denied" ? "invalid-binding" : "unavailable", result.status === "conflict" ? "stale" : result.status)
  const matches = result.value.case.receipts.filter((item) => item.id === ref.receiptId)
  if (matches.length !== 1) return reject("sf_receipt_get", "receipt-unavailable", "unavailable", "unavailable")
  const output = { receipts: [matches[0]!] }
  if (!decodeSfOperationOutput("sf_receipt_get", output).ok) return reject("sf_receipt_get", "invalid-receipt", "unavailable", "unavailable")
  const bound = host.createReceipt(context, "sf_receipt_get", digestSfValue(parsed.value), digestSfValue(output))
  if (!bound) return reject("sf_receipt_get", "authority-unavailable", "invalid-binding")
  return { status: "ok", result: output, receipt: bound }
}

export function createDecisionCapabilities(host: DecisionCapabilityHost): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_case_read", pack: "decisions", mode: "read", inputSchema: sfOperationInputSchemas.sf_case_read, outputSchema: sfOperationOutputSchemas.sf_case_read, handler: (input, context) => readCase(input, context, host), handlerExport: "readCase", producerTask: "WP11.T01", grantProfiles: ["sf_maestro", "sf_finance", "sf_procurement", "sf_portfolio", "sf_reviewer"], requiredAuthority: host.requiredAuthority.read },
    { id: "sf_receipt_get", pack: "decisions", mode: "read", inputSchema: sfOperationInputSchemas.sf_receipt_get, outputSchema: sfOperationOutputSchemas.sf_receipt_get, handler: (input, context) => readReceipt(input, context, host), handlerExport: "readReceipt", producerTask: "WP11.T04", grantProfiles: ["sf_procurement"], requiredAuthority: host.requiredAuthority.receipt },
    ...(host.alternative ? [{ id: "sf_alternative_draft", pack: "decisions", mode: "prepare" as const, inputSchema: sfOperationInputSchemas.sf_alternative_draft, outputSchema: sfOperationOutputSchemas.sf_alternative_draft, handler: (input: unknown, context: TrustedDomainContext) => draftAlternative(input, context, host), handlerExport: "draftAlternative", producerTask: "WP11.T02", grantProfiles: ["sf_finance", "sf_procurement", "sf_portfolio"] as const, requiredAuthority: host.requiredAuthority.alternative }] : []),
    { id: "sf_case_draft", pack: "decisions", mode: "prepare", inputSchema: sfOperationInputSchemas.sf_case_draft, outputSchema: sfOperationOutputSchemas.sf_case_draft, handler: (input, context) => draftCase(input, context, host), handlerExport: "draftCase", producerTask: "WP11.T01", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority.draft },
  ]
}

function reject(operation: string, reason: string, code: "invalid-input" | "invalid-binding" | "unavailable", status: "needs-input" | "stale" | "denied" | "unavailable" | "provider-conflict" | "failed" = "denied"): CapabilityResult {
  return { status, reason, receipt: { kind: "unbound", operation, code, at: new Date().toISOString() } }
}
