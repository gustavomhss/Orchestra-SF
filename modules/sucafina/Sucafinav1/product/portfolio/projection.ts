import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createStoredPortfolioReader } from "./stored.ts"

/** Bind a real, authorized domain projection to an already persisted portfolio contribution. */
export function createStoredPortfolioProjection(input: {
  readPortfolio: ReturnType<typeof createStoredPortfolioReader>
  readProjection: (selectionRef: string, context: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
  revalidateProjection: (selectionRef: string, projection: DomainProjection, portfolio: { portfolioResultRef: string; portfolio: PortfolioResult; caseRef: { id: string; incarnation: string; version: number } }, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: { selectionRef: string; portfolioResultRef: string }, context: TrustedDomainContext): Promise<PortResult<DomainProjection>> => {
    if (!request.selectionRef.trim() || !request.portfolioResultRef.trim()) return { status: "needs-input", reason: "portfolio-selection-required" }
    const portfolio = await input.readPortfolio(request.portfolioResultRef, context)
    if (portfolio.status !== "ok") return portfolio
    if (portfolio.value.portfolioResultRef !== request.portfolioResultRef) return { status: "stale", reason: "portfolio-reference-mismatch" }
    const projection = await input.readProjection(request.selectionRef, context)
    if (projection.status !== "ok") return projection
    if (projection.value.decision || projection.value.context.installationId !== context.binding.installationId || projection.value.context.projectId !== context.binding.projectId || projection.value.context.principalRef !== context.binding.principalRef || projection.value.context.accessRevision !== context.binding.accessRevision || projection.value.context.policyVersion !== context.binding.policyVersion) return { status: "denied", reason: "projection-scope-mismatch" }
    if (!await input.revalidateProjection(request.selectionRef, projection.value, portfolio.value, context)) return { status: "stale", reason: "projection-changed" }
    const latest = await input.readPortfolio(request.portfolioResultRef, context)
    if (latest.status !== "ok") return latest
    if (digestSfValue(latest.value) !== digestSfValue(portfolio.value) || !await input.revalidateProjection(request.selectionRef, projection.value, portfolio.value, context)) return { status: "stale", reason: "portfolio-or-projection-changed" }
    return { status: "ok", value: { ...projection.value, missing: [...projection.value.missing, ...portfolio.value.portfolio.combinations.filter((combination) => !combination.analysis).map((combination) => ({ field: `portfolio:${combination.id}:analysis`, reason: "unavailable" as const }))], decision: { kind: "portfolio", portfolioResultRef: portfolio.value.portfolioResultRef, portfolio: portfolio.value.portfolio } } }
  }
}
