import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { PlannerPort } from "../contracts/ports.ts"
import type { createPlannerResultPersistence } from "./persistence.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"

type ReceiptFactory = (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => BoundCapabilityReceipt | undefined | Promise<BoundCapabilityReceipt | undefined>

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

export async function simulateScenario(payload: unknown, context: TrustedDomainContext, port: PlannerPort, createReceipt: ReceiptFactory, persist?: ReturnType<typeof createPlannerResultPersistence>): Promise<CapabilityResult> {
  const operation = "sf_scenario_simulate"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const inputDigest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, inputDigest)
  if (!admission) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  if (!persist) return { status: "unavailable", reason: "result-persistence-unavailable", receipt: admission }
  const result = await port.simulateScenario(parsed.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const saved = await persist({ kind: "scenario", request: parsed.value, result: result.value }, admission.callId, context)
  if (saved.status !== "ok") return { status: saved.status === "conflict" ? "failed" : saved.status, reason: saved.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, inputDigest, digestSfValue(result.value))
  if (!receipt) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", result: result.value, receipt, outputRef: saved.value.resultRef }
}

export async function compareScenarios(payload: unknown, context: TrustedDomainContext, port: PlannerPort, createReceipt: ReceiptFactory, persist?: ReturnType<typeof createPlannerResultPersistence>): Promise<CapabilityResult> {
  const operation = "sf_scenario_compare"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const inputDigest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, inputDigest)
  if (!admission) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  if (!persist) return { status: "unavailable", reason: "result-persistence-unavailable", receipt: admission }
  const result = await port.compareScenarios(parsed.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const saved = await persist({ kind: "comparison", request: parsed.value, result: result.value }, admission.callId, context, port)
  if (saved.status !== "ok") return { status: saved.status === "conflict" ? "failed" : saved.status, reason: saved.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, inputDigest, digestSfValue(result.value))
  if (!receipt) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", result: result.value, receipt, outputRef: saved.value.resultRef }
}

export function createPlannerCapabilities(port: PlannerPort, createReceipt: ReceiptFactory, persist?: ReturnType<typeof createPlannerResultPersistence>): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_forecast_compare", pack: "planning", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_forecast_compare, outputSchema: sfOperationOutputSchemas.sf_forecast_compare, handler: (payload, context) => compareForecast(payload, context, port, createReceipt), handlerExport: "compareForecast", producerTask: "WP03.T01", grantProfiles: ["sf_finance"], requiredAuthority: ["planner:read"] },
    { id: "sf_scenario_simulate", pack: "planning", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_scenario_simulate, outputSchema: sfOperationOutputSchemas.sf_scenario_simulate, handler: (payload, context) => simulateScenario(payload, context, port, createReceipt, persist), handlerExport: "simulateScenario", producerTask: "WP03.T01", grantProfiles: ["sf_finance", "sf_portfolio", "sf_reviewer"], requiredAuthority: ["planner:read"] },
    { id: "sf_scenario_compare", pack: "planning", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_scenario_compare, outputSchema: sfOperationOutputSchemas.sf_scenario_compare, handler: (payload, context) => compareScenarios(payload, context, port, createReceipt, persist), handlerExport: "compareScenarios", producerTask: "WP03.T05", grantProfiles: ["sf_finance", "sf_portfolio", "sf_reviewer"], requiredAuthority: ["planner:read"] },
  ]
}
