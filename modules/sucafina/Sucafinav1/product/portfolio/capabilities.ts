import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { PortfolioPort } from "./port.ts"
import type { createPersistentPortfolioPort } from "./result-store.ts"
import type { createPersistentSensitivityPort } from "./sensitivity-store.ts"

export type PortfolioCapabilityPersistence = {
  evaluateAndStore: ReturnType<typeof createPersistentPortfolioPort>["evaluateAndStore"]
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
}

export type SensitivityCapabilityPersistence = {
  evaluateAndStore: ReturnType<typeof createPersistentSensitivityPort>["evaluateAndStore"]
  caseFor: PortfolioCapabilityPersistence["caseFor"]
}

type ReceiptFactory = (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => Promise<BoundCapabilityReceipt | undefined>

export async function evaluatePortfolio(payload: unknown, context: TrustedDomainContext, port: PortfolioPort, createReceipt: ReceiptFactory, persistence?: PortfolioCapabilityPersistence): Promise<CapabilityResult> {
  const operation = "sf_portfolio_evaluate"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const digest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, digest)
  if (!admission || admission.handlerExport !== "evaluatePortfolio" || admission.operation !== operation || admission.inputDigest !== digest || admission.principalRef !== context.binding.principalRef || admission.accessRevision !== context.binding.accessRevision || admission.kind !== context.kind) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  if (!persistence) return { status: "unavailable", reason: "portfolio-persistence-unavailable", receipt: admission }
  const caseRef = await persistence.caseFor(context)
  if (caseRef.status !== "ok") return { status: caseRef.status === "conflict" ? "failed" : caseRef.status, reason: caseRef.reason, receipt: admission }
  const result = await persistence.evaluateAndStore(parsed.value, caseRef.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, digest, digestSfValue(result.value.portfolio))
  if (!receipt || receipt.handlerExport !== "evaluatePortfolio" || receipt.operation !== operation || receipt.inputDigest !== digest || receipt.resultDigest !== digestSfValue(result.value.portfolio) || receipt.principalRef !== context.binding.principalRef || receipt.accessRevision !== context.binding.accessRevision || receipt.kind !== context.kind) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", outputRef: result.value.portfolioResultRef, result: result.value.portfolio, receipt }
}

export async function evaluateSensitivity(payload: unknown, context: TrustedDomainContext, port: PortfolioPort, createReceipt: ReceiptFactory, persistence?: SensitivityCapabilityPersistence): Promise<CapabilityResult> {
  const operation = "sf_sensitivity_evaluate"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const digest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, digest)
  if (!admission || admission.handlerExport !== "evaluateSensitivity" || admission.operation !== operation || admission.inputDigest !== digest || admission.principalRef !== context.binding.principalRef || admission.accessRevision !== context.binding.accessRevision || admission.kind !== context.kind) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  if (!persistence) return { status: "unavailable", reason: "sensitivity-persistence-unavailable", receipt: admission }
  const caseRef = await persistence.caseFor(context)
  if (caseRef.status !== "ok") return { status: caseRef.status === "conflict" ? "failed" : caseRef.status, reason: caseRef.reason, receipt: admission }
  const result = await persistence.evaluateAndStore(parsed.value, caseRef.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, digest, digestSfValue(result.value.sensitivity))
  if (!receipt || receipt.handlerExport !== "evaluateSensitivity" || receipt.operation !== operation || receipt.inputDigest !== digest || receipt.resultDigest !== digestSfValue(result.value.sensitivity) || receipt.principalRef !== context.binding.principalRef || receipt.accessRevision !== context.binding.accessRevision || receipt.kind !== context.kind) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", outputRef: result.value.sensitivityResultRef, result: result.value.sensitivity, receipt }
}

export function createPortfolioCapabilities(port: PortfolioPort, createReceipt: ReceiptFactory, persistence?: PortfolioCapabilityPersistence, sensitivityPersistence?: SensitivityCapabilityPersistence): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_portfolio_evaluate", pack: "planning", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_portfolio_evaluate, outputSchema: sfOperationOutputSchemas.sf_portfolio_evaluate, handler: (payload, context) => evaluatePortfolio(payload, context, port, createReceipt, persistence), handlerExport: "evaluatePortfolio", producerTask: "WP13.T02", grantProfiles: ["sf_portfolio"], requiredAuthority: ["planner:read"] },
    { id: "sf_sensitivity_evaluate", pack: "planning", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_sensitivity_evaluate, outputSchema: sfOperationOutputSchemas.sf_sensitivity_evaluate, handler: (payload, context) => evaluateSensitivity(payload, context, port, createReceipt, sensitivityPersistence), handlerExport: "evaluateSensitivity", producerTask: "WP13.T03", grantProfiles: ["sf_finance", "sf_reviewer"], requiredAuthority: ["planner:read"] },
  ]
}
