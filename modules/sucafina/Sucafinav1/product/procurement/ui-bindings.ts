import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { SfOperationInputMap } from "../contracts/operations.ts"
import type { CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"

type Operation = "sf_request_read" | "sf_supplier_read" | "sf_contract_read" | "sf_sourcing_compare"

// The application supplies its authenticated request and the same dispatcher used by the host.
export function createProcurementUiBindings(input: {
  authority: Pick<ReturnType<typeof createSfUiAuthority>, "admit" | "finish">
  dispatch: (operation: string, payload: unknown, context: TrustedDomainContext) => Promise<CapabilityResult>
}) {
  async function call<K extends Operation>(request: Request, operation: K, payload: SfOperationInputMap[K]): Promise<CapabilityResult> {
    const decoded = decodeSfOperationInput(operation, payload)
    if (!decoded.ok) return { status: "denied", reason: "Invalid input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
    const admission = await input.authority.admit(request, operation, digestSfValue(decoded.value))
    if (admission.status !== "ok") return { status: admission.status === "conflict" ? "stale" : admission.status, reason: admission.reason, receipt: { kind: "unbound", operation, code: "invalid-binding", at: new Date().toISOString() } }
    try {
      return await input.dispatch(operation, decoded.value, admission.value)
    } finally {
      input.authority.finish(admission.value)
    }
  }
  return {
    readRequest: (request: Request, payload: SfOperationInputMap["sf_request_read"]) => call(request, "sf_request_read", payload),
    readSupplier: (request: Request, payload: SfOperationInputMap["sf_supplier_read"]) => call(request, "sf_supplier_read", payload),
    readContract: (request: Request, payload: SfOperationInputMap["sf_contract_read"]) => call(request, "sf_contract_read", payload),
    compareSourcing: (request: Request, payload: SfOperationInputMap["sf_sourcing_compare"]) => call(request, "sf_sourcing_compare", payload),
  }
}
