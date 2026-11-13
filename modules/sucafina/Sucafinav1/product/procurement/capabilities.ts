import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { ProcurementPort, PortResult } from "../contracts/ports.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfOperationInputMap } from "../contracts/operations.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"

type Operation = "sf_request_read" | "sf_supplier_read" | "sf_contract_read" | "sf_sourcing_compare"
type Dependencies = { port: ProcurementPort; authority: SfDomainValidation }

async function run<K extends Operation>(operation: K, input: unknown, context: TrustedDomainContext, dependencies: Dependencies, invoke: (input: SfOperationInputMap[K], context: TrustedDomainContext) => Promise<PortResult<SfOperationOutputMap[K]>>): Promise<CapabilityResult> {
  const decoded = decodeSfOperationInput(operation, input)
  const unbound = { kind: "unbound" as const, operation, code: "invalid-input" as const, at: new Date().toISOString() }
  if (!decoded.ok) return { status: "denied", reason: "Invalid input", receipt: unbound }
  const digest = digestSfValue(decoded.value)
  // Dispatch consumes the one-use lease; a second validation would consume it twice.
  if (!(await dependencies.authority.revalidateDomainContext(context)) || !dependencies.authority.receiptFor(context, operation, digest)) return { status: "denied", reason: "Current authority unavailable", receipt: { ...unbound, code: "invalid-binding" } }
  const result = await invoke(decoded.value, context)
  if (!(await dependencies.authority.revalidateDomainContext(context))) return { status: "denied", reason: "Current authority unavailable", receipt: { ...unbound, code: "invalid-binding" } }
  const output = result.status === "ok" ? decodeSfOperationOutput(operation, result.value) : undefined
  if (result.status === "ok" && !output?.ok) return { status: "failed", reason: "Invalid producer output", receipt: { ...unbound, code: "unavailable" } }
  const receipt = dependencies.authority.receiptFor(context, operation, digest, result.status === "ok" ? digestSfValue(result.value) : undefined)
  if (!receipt) return { status: "denied", reason: "Current authority unavailable", receipt: { ...unbound, code: "invalid-binding" } }
  if (result.status !== "ok") return { status: result.status === "conflict" ? "stale" : result.status, reason: result.reason, receipt }
  return { status: "ok", result: result.value, receipt }
}

export function readRequest(input: unknown, context: TrustedDomainContext, dependencies: Dependencies) {
  return run("sf_request_read", input, context, dependencies, dependencies.port.read)
}
export function readSupplier(input: unknown, context: TrustedDomainContext, dependencies: Dependencies) {
  return run("sf_supplier_read", input, context, dependencies, dependencies.port.readSupplier)
}
export function readContract(input: unknown, context: TrustedDomainContext, dependencies: Dependencies) {
  return run("sf_contract_read", input, context, dependencies, dependencies.port.readContract)
}
export function compareSourcing(input: unknown, context: TrustedDomainContext, dependencies: Dependencies) {
  return run("sf_sourcing_compare", input, context, dependencies, dependencies.port.compareSourcing)
}

export function createProcurementCapabilities(dependencies: Dependencies): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_request_read", pack: "procurement", mode: "read", inputSchema: sfOperationInputSchemas.sf_request_read, outputSchema: sfOperationOutputSchemas.sf_request_read, handler: (input, context) => readRequest(input, context, dependencies), handlerExport: "readRequest", producerTask: "WP04.T01", grantProfiles: ["sf_procurement"], requiredAuthority: ["procurement:read"] },
    { id: "sf_supplier_read", pack: "procurement", mode: "read", inputSchema: sfOperationInputSchemas.sf_supplier_read, outputSchema: sfOperationOutputSchemas.sf_supplier_read, handler: (input, context) => readSupplier(input, context, dependencies), handlerExport: "readSupplier", producerTask: "WP04.T05", grantProfiles: ["sf_procurement"], requiredAuthority: ["procurement:read"] },
    { id: "sf_contract_read", pack: "procurement", mode: "read", inputSchema: sfOperationInputSchemas.sf_contract_read, outputSchema: sfOperationOutputSchemas.sf_contract_read, handler: (input, context) => readContract(input, context, dependencies), handlerExport: "readContract", producerTask: "WP04.T05", grantProfiles: ["sf_procurement"], requiredAuthority: ["procurement:read"] },
    { id: "sf_sourcing_compare", pack: "procurement", mode: "simulate", inputSchema: sfOperationInputSchemas.sf_sourcing_compare, outputSchema: sfOperationOutputSchemas.sf_sourcing_compare, handler: (input, context) => compareSourcing(input, context, dependencies), handlerExport: "compareSourcing", producerTask: "WP04.T03", grantProfiles: ["sf_procurement"], requiredAuthority: ["procurement:read"] },
  ]
}
