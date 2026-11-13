import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { PlannerPort } from "../contracts/ports.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"

type ReceiptFactory = (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => Promise<BoundCapabilityReceipt | undefined>

export async function compareForecast(payload: unknown, context: TrustedDomainContext, port: PlannerPort, createReceipt: ReceiptFactory): Promise<CapabilityResult> {
  const operation = "sf_forecast_compare"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const inputDigest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, inputDigest)
  if (!admission) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  const result = await port.compareForecast(parsed.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, inputDigest, digestSfValue(result.value))
  if (!receipt) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", result: result.value, receipt }
}

export function createPlannerCapabilities(port: PlannerPort, createReceipt: ReceiptFactory): readonly CapabilityDescriptor[] {
  return [{ id: "sf_forecast_compare", pack: "planning", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_forecast_compare, outputSchema: sfOperationOutputSchemas.sf_forecast_compare, handler: (payload, context) => compareForecast(payload, context, port, createReceipt), handlerExport: "compareForecast", producerTask: "WP03.T01", grantProfiles: ["sf_finance"], requiredAuthority: ["planner:read"] }]
}
