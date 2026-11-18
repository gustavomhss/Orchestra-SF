import type { DomainProjection } from "../contracts/context.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { BiViewRequest, PortfolioRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { readBiPresentation } from "./capabilities.ts"
import { sameBiProjection } from "./projection.ts"
import type { BiPresentation } from "./semantics.ts"
import type { BiPresentationPort } from "./capabilities.ts"

export type PortfolioBiBundle = { projection: DomainProjection; presentation: BiPresentation }
/** Revalidate the binding, selection and all portfolio/evidence references even when bundle is omitted. */
export type PortfolioBiHost = {
  readView: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<PortfolioBiBundle>>
  revalidate: (request: BiViewRequest, context: TrustedDomainContext, bundle?: PortfolioBiBundle, expectedProjection?: DomainProjection) => Promise<boolean>
}

/** One request-local bundle keeps the domain result and its visual projection together. */
export async function readPortfolioBi(request: BiViewRequest, context: TrustedDomainContext, host: PortfolioBiHost, authority: SfDomainValidation) {
  if (request.viewId !== "BI09" && request.viewId !== "BI10" && request.viewId !== "BI11") return { status: "unavailable", reason: "unsupported-view" } as const
  const state: { bundle?: PortfolioBiBundle } = {}
  const source: BiPresentationPort = {
    async read(input, binding) {
      const result = await host.readView(input, binding)
      if (result.status !== "ok") return result
      const bundle = structuredClone(result.value)
      if (bundle.projection.decision?.kind !== "portfolio" || !bundle.projection.decision.portfolioResultRef.trim()) return { status: "unavailable", reason: "decision-unavailable" }
      state.bundle = bundle
      return { status: "ok", value: bundle.projection }
    },
    async describe() {
      if (!state.bundle) return { status: "unavailable", reason: "bundle-unavailable" }
      return { status: "ok", value: state.bundle.presentation }
    },
    async revalidate(input, binding) {
      const bundle = structuredClone(state.bundle)
      const digest = digestSfValue(bundle ?? null)
      return await host.revalidate(input, binding, bundle) && digestSfValue(bundle ?? null) === digest
    },
  }
  const result = await readBiPresentation(request, context, source, authority)
  if (result.status !== "ok") return result
  if (!state.bundle) return { status: "unavailable", reason: "bundle-unavailable" } as const
  return result
}

/** A trusted resolver binds a BI selection to the real portfolio evaluation and its projection. */
export function bindPortfolioBiPort(input: {
  portfolio: { evaluate: (request: PortfolioRequest, context: TrustedDomainContext) => Promise<PortResult<PortfolioResult>> }
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ request: PortfolioRequest; project: (portfolio: PortfolioResult) => { projection: DomainProjection; presentation: BiPresentation } }>>
  revalidate: PortfolioBiHost["revalidate"]
}): PortfolioBiHost {
  return {
    revalidate: input.revalidate,
    async readView(incoming, context) {
      const request = structuredClone(incoming)
      const forwarded = structuredClone(request)
      const binding = await input.resolve(forwarded, context)
      if (binding.status !== "ok") return binding
      if (digestSfValue(forwarded) !== digestSfValue(request)) return { status: "stale", reason: "selection-changed" }
      const selected = structuredClone(binding.value.request)
      const project = binding.value.project
      if (selected.scope.horizon.start !== request.period.start || selected.scope.horizon.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      const evaluated = structuredClone(selected)
      const portfolio = structuredClone(await input.portfolio.evaluate(evaluated, context))
      if (portfolio.status !== "ok") return portfolio
      if (digestSfValue(evaluated) !== digestSfValue(selected)) return { status: "stale", reason: "selection-changed" }
      const projectedInput = structuredClone(portfolio.value)
      const projected = structuredClone(project(projectedInput))
      if (digestSfValue(projectedInput) !== digestSfValue(portfolio.value)) return { status: "stale", reason: "portfolio-changed-by-projection" }
      if (projected.projection.context.period.start !== request.period.start || projected.projection.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      const decision = projected.projection.decision
      if (decision?.kind !== "portfolio" || !decision.portfolioResultRef.trim()) return { status: "unavailable", reason: "decision-unavailable" }
      if (digestSfValue(decision.portfolio) !== digestSfValue(portfolio.value)) return { status: "stale", reason: "portfolio-mismatch" }
      return { status: "ok", value: projected }
    },
  }
}

/** The host resolves a scoped BI selection to a persisted portfolio result, never a fabricated reference. */
export function bindStoredPortfolioBiPort(input: {
  readProjection: (request: { selectionRef: string; portfolioResultRef: string }, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  resolve: (request: BiViewRequest, context: TrustedDomainContext) => Promise<PortResult<{ portfolioResultRef: string; present: (projection: DomainProjection) => BiPresentation }>>
  revalidate: PortfolioBiHost["revalidate"]
}): PortfolioBiHost {
  return {
    revalidate: input.revalidate,
    async readView(incoming, context) {
      const request = structuredClone(incoming)
      const forwarded = structuredClone(request)
      const resolved = await input.resolve(forwarded, context)
      if (resolved.status !== "ok") return resolved
      if (digestSfValue(forwarded) !== digestSfValue(request)) return { status: "stale", reason: "selection-changed" }
      const selection = { selectionRef: request.selectionRef, portfolioResultRef: resolved.value.portfolioResultRef }
      const present = resolved.value.present
      if (!selection.portfolioResultRef.trim()) return { status: "unavailable", reason: "decision-unavailable" }
      const selected = structuredClone(selection)
      const projection = structuredClone(await input.readProjection(selected, context))
      if (projection.status !== "ok") return projection
      if (digestSfValue(selected) !== digestSfValue(selection)) return { status: "stale", reason: "selection-changed" }
      if (projection.value.context.period.start !== request.period.start || projection.value.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      if (projection.value.decision?.kind !== "portfolio" || projection.value.decision.portfolioResultRef !== selection.portfolioResultRef) return { status: "stale", reason: "portfolio-reference-mismatch" }
      const presentationInput = structuredClone(projection.value)
      const presentation = structuredClone(present(presentationInput))
      if (!sameBiProjection(presentationInput, projection.value)) return { status: "stale", reason: "projection-changed-by-presentation" }
      return { status: "ok", value: { projection: projection.value, presentation } }
    },
  }
}

/** C16 uses the same host source but returns the frozen DomainProjection output. */
export function createPortfolioBiSource(host: PortfolioBiHost): BiPresentationPort {
  return {
    revalidate: (request, context, projection) => host.revalidate(request, context, undefined, projection),
    async read(request, context) {
      if (request.viewId !== "BI09" && request.viewId !== "BI10" && request.viewId !== "BI11") return { status: "unavailable", reason: "unsupported-view" }
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId) return { status: "unavailable", reason: "view-mismatch" }
      if (result.value.projection.decision?.kind !== "portfolio" || !result.value.projection.decision.portfolioResultRef.trim()) return { status: "unavailable", reason: "decision-unavailable" }
      return { status: "ok", value: result.value.projection }
    },
    async describe(request, context, projection) {
      if (request.viewId !== "BI09" && request.viewId !== "BI10" && request.viewId !== "BI11") return { status: "unavailable", reason: "unsupported-view" }
      const result = await host.readView(request, context)
      if (result.status !== "ok") return result
      if (result.value.presentation.viewId !== request.viewId || !sameBiProjection(result.value.projection, projection)) return { status: "stale", reason: "projection-changed" }
      return { status: "ok", value: result.value.presentation }
    },
  }
}
