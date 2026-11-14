import type { BiViewRequest } from "../contracts/operations.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext, CapabilityDescriptor, CapabilityResult } from "../contracts/sf-execution.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { biViews } from "./catalog.ts"
import { hasBiDecision } from "./projection.ts"
import type { BiViewId } from "./catalog.ts"
import { resolveBiPresentation } from "./semantics.ts"
import type { BiPresentation } from "./semantics.ts"

export type BiSourcePort = {
  read: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  revalidate: (request: BiViewRequest, context: TrustedDomainContext, projection?: DomainProjection) => Promise<boolean>
}

/** A host fence must check the exact observed selection and projection, without changing either. */
export async function revalidateBiSnapshot(source: BiSourcePort, request: BiViewRequest, context: TrustedDomainContext, projection?: DomainProjection) {
  const snapshot = structuredClone({ request, ...(projection ? { projection } : {}) })
  const digest = digestSfValue(snapshot)
  return await source.revalidate(snapshot.request, context, snapshot.projection) && digestSfValue(snapshot) === digest
}

export async function readBiView(incoming: BiViewRequest, context: TrustedDomainContext, source: BiSourcePort, authority: SfDomainValidation): Promise<PortResult<DomainProjection>> {
  const decoded = decodeSfOperationInput("sf_bi_view", incoming)
  if (!decoded.ok) return { status: "needs-input", reason: "invalid-selection-or-period" }
  const request = structuredClone(decoded.value)
  const inputDigest = digestSfValue(request)
  const receipt = authority.receiptFor(context, "sf_bi_view", inputDigest)
  if (!receipt || receipt.operation !== "sf_bi_view" || receipt.inputDigest !== inputDigest || receipt.handlerExport !== "readBiView" || receipt.kind !== context.kind || receipt.principalRef !== context.binding.principalRef || receipt.accessRevision !== context.binding.accessRevision || !await authority.revalidateDomainContext(context)) return { status: "denied", reason: "authority-unavailable" }
  if (context.kind === "native" && (receipt.kind !== "native" || receipt.runId !== context.binding.runId || receipt.nativeSessionId !== context.binding.nativeSessionId || receipt.providerGeneration !== context.binding.providerGeneration)) return { status: "denied", reason: "authority-unavailable" }
  if (context.kind === "ui" && (receipt.kind !== "ui" || receipt.requestId !== context.binding.requestId)) return { status: "denied", reason: "authority-unavailable" }
  if (!request.selectionRef || !isSfPeriod(request.period)) return { status: "needs-input", reason: "invalid-selection-or-period" }
  if (!biViews.some((view) => view.id === request.viewId)) return { status: "unavailable", reason: "unsupported-view" }
  if (!await revalidateBiSnapshot(source, request, context)) return { status: "denied", reason: "binding-unavailable" }
  const result = await source.read(structuredClone(request), context)
  if (result.status !== "ok") return result
  const output = decodeSfOperationOutput("sf_bi_view", result.value)
  if (!output.ok) return { status: "unavailable", reason: "invalid-operation-output" }
  // Retain the checked bytes across host awaits; callbacks never receive the returned snapshot.
  const projection = structuredClone(output.value)
  if (["BI09", "BI10", "BI11"].includes(request.viewId) && !hasBiDecision(projection, request.viewId)) return { status: "unavailable", reason: "decision-unavailable" }
  if (projection.context.installationId !== context.binding.installationId || projection.context.projectId !== context.binding.projectId || projection.context.principalRef !== context.binding.principalRef || projection.context.accessRevision !== context.binding.accessRevision || projection.context.policyVersion !== context.binding.policyVersion) return { status: "denied", reason: "context-mismatch" }
  if (new Set(projection.values.map((value) => value.id)).size !== projection.values.length) return { status: "unavailable", reason: "duplicate-value-id" }
  if (projection.context.period.start !== request.period.start || projection.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
  if (!await revalidateBiSnapshot(source, request, context, projection) || !await authority.revalidateDomainContext(context)) return { status: "denied", reason: "access-changed" }
  return { status: "ok", value: projection }
}

// The host supplies the trusted source and creates the authenticated C16 receipt.
export const biCapability = {
  id: "sf_bi_view",
  pack: "performance",
  mode: "read",
  inputSchema: sfOperationInputSchemas.sf_bi_view,
  outputSchema: sfOperationOutputSchemas.sf_bi_view,
  handlerExport: "readBiView",
  producerTask: "WP05.T04",
  grantProfiles: ["sf_maestro", "sf_finance", "sf_portfolio"],
} as const

export type BiPresentationPort = BiSourcePort & {
  describe: (request: BiViewRequest, context: TrustedDomainContext, projection: DomainProjection) => Promise<PortResult<BiPresentation>>
}

export async function readBiPresentation(incoming: BiViewRequest, context: TrustedDomainContext, source: BiPresentationPort, authority: SfDomainValidation) {
  const request = structuredClone(incoming)
  const projection = await readBiView(request, context, source, authority)
  if (projection.status !== "ok") return projection
  const presentation = await source.describe(structuredClone(request), context, structuredClone(projection.value))
  if (presentation.status !== "ok") return presentation
  const description = structuredClone(presentation.value)
  if (description.viewId !== request.viewId) return { status: "unavailable", reason: "view-mismatch" } as const
  const resolved = resolveBiPresentation(projection.value, description)
  if (resolved.status !== "ok") return resolved
  if (!await revalidateBiSnapshot(source, request, context, projection.value) || !await authority.revalidateDomainContext(context)) return { status: "denied", reason: "access-changed" } as const
  return { status: "ok", value: { projection: projection.value, presentation: description } } as const
}

/** Descriptor for the shared UI/native dispatcher. The host supplies its private authority registry. */
export function createBiDescriptor(source: BiSourcePort, authority: SfDomainValidation): CapabilityDescriptor {
  const reject = (reason: string, code: "invalid-binding" | "invalid-input" | "unavailable" = "invalid-binding"): CapabilityResult => ({
    status: code === "unavailable" ? "unavailable" : "denied",
    reason,
    receipt: { kind: "unbound", operation: "sf_bi_view", code, at: new Date().toISOString() },
  })
  return {
    ...biCapability,
    requiredAuthority: [],
    async handler(input, context) {
      const decoded = decodeSfOperationInput("sf_bi_view", input)
      if (!decoded.ok) return reject("invalid-operation-input", "invalid-input")
      const inputDigest = digestSfValue(decoded.value)
      // Dispatch consumes the one-use binding; direct unconsumed calls cannot obtain a receipt.
      if (!authority.receiptFor(context, "sf_bi_view", inputDigest) || !await authority.revalidateDomainContext(context)) return reject("authority-unavailable")
      const result = await readBiView(decoded.value, context, source, authority)
      if (result.status !== "ok") {
        const status = result.status === "conflict" ? "stale" : result.status
        return { status, reason: result.reason, receipt: { kind: "unbound", operation: "sf_bi_view", code: status === "provider-conflict" ? "provider-conflict" : "unavailable", at: new Date().toISOString() } }
      }
      const output = decodeSfOperationOutput("sf_bi_view", result.value)
      if (!output.ok) return reject("invalid-operation-output", "unavailable")
      if (!await authority.revalidateDomainContext(context)) return reject("authority-changed")
      const resultDigest = digestSfValue(output.value)
      const receipt = authority.receiptFor(context, "sf_bi_view", inputDigest, resultDigest)
      if (!receipt || receipt.handlerExport !== "readBiView" || receipt.operation !== "sf_bi_view" || receipt.inputDigest !== inputDigest || receipt.resultDigest !== resultDigest || receipt.kind !== context.kind || receipt.principalRef !== context.binding.principalRef || receipt.accessRevision !== context.binding.accessRevision) return reject("receipt-unavailable")
      if (context.kind === "native" && (receipt.kind !== "native" || receipt.runId !== context.binding.runId || receipt.nativeSessionId !== context.binding.nativeSessionId || receipt.providerGeneration !== context.binding.providerGeneration)) return reject("receipt-unavailable")
      if (context.kind === "ui" && (receipt.kind !== "ui" || receipt.requestId !== context.binding.requestId)) return reject("receipt-unavailable")
      return { status: "ok", result: output.value, receipt }
    },
  }
}

/** Route only to producers explicitly registered by the host; unimplemented views stay unavailable. */
export function createBiSourceRouter(routes: Readonly<Partial<Record<BiViewId, BiPresentationPort>>>): BiPresentationPort {
  return {
    async read(request, context) {
      const route = Object.entries(routes).find(([id]) => id === request.viewId)?.[1]
      if (!route) return { status: "unavailable", reason: "producer-unavailable" }
      return route.read(request, context)
    },
    async describe(request, context, projection) {
      const route = Object.entries(routes).find(([id]) => id === request.viewId)?.[1]
      if (!route) return { status: "unavailable", reason: "producer-unavailable" }
      return route.describe(request, context, projection)
    },
    async revalidate(request, context, projection) {
      const route = Object.entries(routes).find(([id]) => id === request.viewId)?.[1]
      return route ? route.revalidate(request, context, projection) : true
    },
  }
}
