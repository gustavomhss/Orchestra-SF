import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext } from "../contracts/sf-execution.ts"
import { dispatchSfCapability } from "../host-binding/capability-dispatch.ts"
import { createBiDescriptor, readBiPresentation } from "./capabilities.ts"
import type { BiPresentationPort } from "./capabilities.ts"
import type { BiSelection } from "./catalog.ts"
import { sameBiContext, sameBiProjection } from "./projection.ts"
import type { BiPresentation } from "./semantics.ts"

export type BiPresentationResult = {
  request: BiViewRequest
  projection: DomainProjection
  presentation: BiPresentation
  receipt: BoundCapabilityReceipt
}

/** Both transports consume the same dispatcher and verify that rendering uses its exact result. */
export async function dispatchBiPresentation(incoming: BiViewRequest, context: TrustedDomainContext, source: BiPresentationPort, authority: SfDomainValidation): Promise<PortResult<BiPresentationResult>> {
  const request = structuredClone(incoming)
  const dispatched = await dispatchSfCapability({
    operation: "sf_bi_view", payload: request, context,
    descriptors: [createBiDescriptor(source, authority)], authority,
    validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok,
    validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_bi_view", value.result).ok,
  })
  if (dispatched.status !== "ok") return { status: dispatched.status, reason: dispatched.reason }
  const output = decodeSfOperationOutput("sf_bi_view", dispatched.result)
  if (!output.ok) return { status: "unavailable", reason: "invalid-operation-output" }
  const presented = await readBiPresentation(request, context, source, authority)
  if (presented.status !== "ok") return presented
  if (!sameBiProjection(output.value, presented.value.projection)) return { status: "stale", reason: "projection-changed-before-presentation" }
  return { status: "ok", value: { request, projection: output.value, presentation: presented.value.presentation, receipt: dispatched.receipt } }
}

/** Reopen one current mark through C17; no collection URL or source identity is reconstructed. */
export async function readBiDestination(input: {
  request: BiViewRequest
  selection: BiSelection
  context: TrustedDomainContext
  source: BiPresentationPort
  authority: SfDomainValidation
  business: Pick<BusinessContextService, "resolve">
}): Promise<PortResult<{ selection: BiSelection; source: BusinessEvidenceResolution }>> {
  const request = structuredClone(input.request)
  const selection = structuredClone(input.selection)
  if (selection.selectionRef !== request.selectionRef || digestSfValue(selection.context.period) !== digestSfValue(request.period)) return { status: "stale", reason: "selection-context-changed" }
  if (selection.visualPeriod && (!isSfPeriod(selection.visualPeriod) || selection.visualPeriod.start < request.period.start || selection.visualPeriod.end > request.period.end)) return { status: "unavailable", reason: "selection-visual-period-invalid" }
  const current = await dispatchBiPresentation(request, input.context, input.source, input.authority)
  if (current.status !== "ok") return current
  const projection = current.value.projection
  const row = projection.values.find((value) => value.id === selection.valueId)
  if (!row || !row.drilldown || !selection.reference) return { status: "unavailable", reason: "selection-source-unavailable" }
  if (projection.version !== selection.projectionVersion || projection.engineVersion !== selection.engineVersion || !sameBiContext(projection.context, selection.context) || digestSfValue(row.drilldown) !== digestSfValue(selection.reference)) return { status: "stale", reason: "selection-source-changed" }
  const resolved = await input.business.resolve(structuredClone(row.drilldown), input.context)
  const source = structuredClone(resolved)
  if (source.state === "revoked") return { status: "denied", reason: "selection-source-revoked" }
  if (source.state === "historical" || source.state === "stale" || source.state === "replaced") return { status: "stale", reason: "selection-source-changed" }
  if (!decodeSfOperationOutput("sf_source_get", source).ok || source.state !== "fresh" || !source.authorizedProjection || digestSfValue(source.ref) !== digestSfValue(row.drilldown) || source.accessRevision !== input.context.binding.accessRevision) return { status: "unavailable", reason: "selection-source-unavailable" }
  if (!await input.source.revalidate(request, input.context, structuredClone(projection)) || !await input.authority.revalidateDomainContext(input.context)) return { status: "denied", reason: "access-changed" }
  return { status: "ok", value: { selection, source } }
}
