import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessContextService } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfStoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { createPortfolioHistory } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-history.ts"
import { createPortfolioHistoricalProvenance } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/history-provenance.ts"
import { createReviewDecisionAccess } from "../../../../modules/sucafina/Sucafinav1/product/reviews/decision-access.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioServices } from "./portfolio-services.ts"

type AccessInput = Parameters<typeof createReviewDecisionAccess>[0]
type CaseRef = { id: string; incarnation: string; version: number }
type Scope = { caseRef: CaseRef; caseDigest: string; storedDigest: string; resultDigest: string }

/** Read-only Review scope comes from an authenticated C08 result, never a caller's case selector. */
export function createSfReviewPortfolioHistory(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  portfolio: ReturnType<typeof createSfPortfolioServices>
  evidence: BusinessContextService
  sensitivity: AccessInput["sensitivity"]
  portfolioHistory?: AccessInput["portfolioHistory"]
}) {
  const { authority, business } = input
  const host = authority.host
  const scopeFor = async (resultRef: string, call: TrustedDomainContext, expected?: SfStoredDecisionResult): Promise<PortResult<Scope>> => {
    const denied = (): PortResult<Scope> => ({ status: "denied", reason: "review-portfolio-case-unavailable" })
    try {
      const request = host.requestFor(call)
      if (!request || request.signal.aborted || !resultRef.trim() || !await host.revalidate(call)) return denied()
      const authorityDigest = digestSfValue([call.kind, call.binding])
      const load = () => authority.state.read(request, "cases", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
        const stored = state.decisionResults?.[resultRef]
        const current = stored && state.cases[stored.caseRef.id]
        if (!stored || stored.schema !== "sf-decision-result-v1" || stored.kind !== "portfolio" || stored.resultRef !== resultRef ||
          stored.resultDigest !== digestSfValue(stored.result) || !/^[a-f0-9]{64}$/.test(stored.requestDigest) || !stored.sourceRefs.length ||
          !decodeSfOperationOutput("sf_portfolio_evaluate", stored.result).ok || expected && digestSfValue(expected) !== digestSfValue(stored) ||
          !current || current.id !== stored.caseRef.id || current.incarnation !== stored.caseRef.incarnation || !current.participants.includes(actor.principalRef) ||
          !Number.isSafeInteger(stored.caseRef.version) || stored.caseRef.version < 0 || !Number.isSafeInteger(current.version) || current.version < stored.caseRef.version ||
          call.kind === "native" && (call.binding.caseId !== current.id || call.binding.caseIncarnation !== current.incarnation || call.binding.caseVersion !== current.version)) return undefined
        return { current, stored }
      })
      const first = await load()
      if (first.status !== "ok" || !first.value || !await business.authorizeCase(first.value.current, call)) return denied()
      const again = await load()
      if (again.status !== "ok" || !again.value || digestSfValue(first.value) !== digestSfValue(again.value) ||
        !await business.authorizeCase(again.value.current, call) || request.signal.aborted || authorityDigest !== digestSfValue([call.kind, call.binding]) || !await host.revalidate(call)) return denied()
      const { current, stored } = again.value
      return { status: "ok", value: { caseRef: { id: current.id, incarnation: current.incarnation, version: current.version },
        caseDigest: digestSfValue(current), storedDigest: digestSfValue(stored), resultDigest: stored.resultDigest } }
    } catch { return denied() }
  }
  const caseFor = (resultRef: string, expected?: SfStoredDecisionResult) => async (call: TrustedDomainContext): Promise<PortResult<CaseRef>> => {
    const scope = await scopeFor(resultRef, call, expected)
    return scope.status === "ok" ? { status: "ok", value: scope.value.caseRef } : scope
  }
  const portfolioHistory = input.portfolioHistory ?? createPortfolioHistory({ state: authority.state, host, authorizeCase: business.authorizeCase,
    verifyHistoricalProvenance: (stored, call) => createPortfolioHistoricalProvenance({
      readHistoricalBinding: input.portfolio.portfolioBindings.readHistoricalBinding, caseFor: caseFor(stored.resultRef, stored),
      cases: business.cases, evidence: input.evidence, host,
    })(stored, call),
  })
  const authorizeDecision: ReturnType<typeof createReviewDecisionAccess> = async (call, decisions) => {
    try {
      if (!await host.revalidate(call)) return false
      // A closure per persisted result also keeps parallel, multi-case Review sections disjoint.
      const checked = await Promise.all(decisions.map(async (decision) => {
        if (decision.kind !== "portfolio") return createReviewDecisionAccess({ host, results: business.results, sensitivity: input.sensitivity })(call, [decision])
        const first = await scopeFor(decision.portfolioResultRef, call)
        if (first.status !== "ok" || first.value.resultDigest !== digestSfValue(decision.portfolio)) return false
        const currentCase = async (context: TrustedDomainContext): Promise<PortResult<CaseRef>> => {
          const current = await scopeFor(decision.portfolioResultRef, context)
          return current.status === "ok" && digestSfValue(current.value) === digestSfValue(first.value)
            ? { status: "ok", value: current.value.caseRef } : { status: "denied", reason: "review-portfolio-case-changed" }
        }
        const access = createReviewDecisionAccess({ host, results: business.results, sensitivity: input.sensitivity, portfolioHistory, currentCase })
        if (!await access(call, [decision])) return false
        const again = await scopeFor(decision.portfolioResultRef, call)
        return again.status === "ok" && digestSfValue(again.value) === digestSfValue(first.value)
      }))
      return checked.every(Boolean) && await host.revalidate(call)
    } catch { return false }
  }
  return { portfolioHistory, authorizeDecision }
}
