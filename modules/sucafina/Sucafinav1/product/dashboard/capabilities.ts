import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { DashboardPort, PortResult } from "../contracts/ports.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { KpiExplainRequest } from "../contracts/operations.ts"
import type { BoundCapabilityReceipt, CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"

type ReceiptFactory = (context: TrustedDomainContext, operation: string, inputDigest: string, resultDigest?: string) => Promise<BoundCapabilityReceipt | undefined>
export type DashboardKpiPort = { explain: (request: KpiExplainRequest, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>> }

export async function readDashboard(payload: unknown, context: TrustedDomainContext, port: DashboardPort, createReceipt: ReceiptFactory): Promise<CapabilityResult> {
  const operation = "sf_dashboard_read"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const digest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, digest)
  if (!admission) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  const result = await port.read(parsed.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, digest, digestSfValue(result.value))
  if (!receipt) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", result: result.value, receipt }
}

export async function explainKpi(payload: unknown, context: TrustedDomainContext, port: DashboardKpiPort, createReceipt: ReceiptFactory): Promise<CapabilityResult> {
  const operation = "sf_kpi_explain"
  const parsed = decodeSfOperationInput(operation, payload)
  if (!parsed.ok) return { status: "denied", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
  const digest = digestSfValue(parsed.value)
  const admission = await createReceipt(context, operation, digest)
  if (!admission) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  const result = await port.explain(parsed.value, context)
  if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admission }
  const receipt = await createReceipt(context, operation, digest, digestSfValue(result.value))
  if (!receipt) return { status: "unavailable", reason: "receipt-unavailable", receipt: { kind: "unbound", operation, code: "unavailable", at: new Date().toISOString() } }
  return { status: "ok", result: result.value, receipt }
}

export function createDashboardCapabilities(port: DashboardPort & DashboardKpiPort, createReceipt: ReceiptFactory): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_dashboard_read", pack: "performance", mode: "read", inputSchema: sfOperationInputSchemas.sf_dashboard_read, outputSchema: sfOperationOutputSchemas.sf_dashboard_read, handler: (payload, context) => readDashboard(payload, context, port, createReceipt), handlerExport: "readDashboard", producerTask: "WP02.T01", grantProfiles: ["sf_maestro", "sf_finance", "sf_portfolio"], requiredAuthority: ["dashboard:read"] },
    { id: "sf_kpi_explain", pack: "performance", mode: "read", inputSchema: sfOperationInputSchemas.sf_kpi_explain, outputSchema: sfOperationOutputSchemas.sf_kpi_explain, handler: (payload, context) => explainKpi(payload, context, port, createReceipt), handlerExport: "explainKpi", producerTask: "WP02.T01", grantProfiles: ["sf_maestro", "sf_finance", "sf_portfolio"], requiredAuthority: ["dashboard:read"] },
  ]
}
