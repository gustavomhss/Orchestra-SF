import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfStoredDecisionResult, SfProductStatePort } from "../contracts/state.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type HistoricalPortfolio = { state: "historical"; resultRef: string; originalCaseRef: CaseRef; result: Extract<SfStoredDecisionResult, { kind: "portfolio" }> ["result"]; requestDigest: string; resultDigest: string; createdAt: string }

/** A source can change while the case version stays the same; provenance, not version inequality, qualifies a saved result. */
export function createPortfolioHistory(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyHistoricalProvenance: (stored: SfStoredDecisionResult, context: TrustedDomainContext) => Promise<boolean>
}) {
  const read = (request: { caseRef: CaseRef; resultRef: string }, ctx: TrustedDomainContext) => readOne(request, ctx)
  const list = async (request: { caseRef: CaseRef }, ctx: TrustedDomainContext): Promise<PortResult<HistoricalPortfolio[]>> => {
    const source = input.host.requestFor(ctx)
    if (!source || !await input.host.revalidate(ctx).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const load = () => input.state.read(source, "cases", (state, authority) => authority.principalRef === ctx.binding.principalRef && authority.policyVersion === ctx.binding.policyVersion && authority.accessRevision === ctx.binding.accessRevision ? { current: state.cases[request.caseRef.id], results: Object.values(state.decisionResults ?? {}).filter((stored) => stored.kind === "portfolio" && stored.caseRef.id === request.caseRef.id && stored.caseRef.incarnation === request.caseRef.incarnation && stored.caseRef.version <= request.caseRef.version) } : undefined)
    const first = await load().catch(() => undefined)
    if (!first || first.status !== "ok" || !first.value?.current) return { status: "unavailable", reason: "portfolio-history-unavailable" }
    if (!allowed(first.value.current, request.caseRef, ctx) || !await input.authorizeCase(first.value.current, ctx).catch(() => false)) return { status: "denied", reason: "portfolio-history-access-unavailable" }
    const items = await Promise.all(first.value.results.map((stored) => readOne({ caseRef: request.caseRef, resultRef: stored.resultRef }, ctx)))
    const again = await load().catch(() => undefined)
    if (!again || again.status !== "ok" || !again.value?.current || !allowed(again.value.current, request.caseRef, ctx) || !await input.authorizeCase(again.value.current, ctx).catch(() => false) || digestSfValue(again.value.results) !== digestSfValue(first.value.results) || digestSfValue(again.value.current) !== digestSfValue(first.value.current) || source.signal.aborted || !await input.host.revalidate(ctx).catch(() => false)) return { status: "stale", reason: "portfolio-history-changed" }
    const accepted = items.flatMap((item) => item.status === "ok" ? [item.value] : [])
    const checked = await Promise.all(accepted.map((item) => readOne({ caseRef: request.caseRef, resultRef: item.resultRef }, ctx)))
    if (checked.some((item, index) => item.status !== "ok" || digestSfValue(item.value) !== digestSfValue(accepted[index])) || source.signal.aborted || !await input.host.revalidate(ctx).catch(() => false)) return { status: "stale", reason: "portfolio-history-changed" }
    return { status: "ok", value: accepted }
  }
  async function readOne(request: { caseRef: CaseRef; resultRef: string }, ctx: TrustedDomainContext): Promise<PortResult<HistoricalPortfolio>> {
    const source = input.host.requestFor(ctx)
    if (!source || !request.resultRef.trim() || !await input.host.revalidate(ctx).catch(() => false)) return { status: "denied", reason: "invalid-authority" }
    const load = () => input.state.read(source, "cases", (state, authority) => authority.principalRef === ctx.binding.principalRef && authority.policyVersion === ctx.binding.policyVersion && authority.accessRevision === ctx.binding.accessRevision ? { current: state.cases[request.caseRef.id], stored: state.decisionResults?.[request.resultRef] } : undefined)
    const first = await load().catch(() => undefined)
    if (!first || first.status !== "ok" || !first.value?.current || !first.value.stored) return { status: "unavailable", reason: "portfolio-history-unavailable" }
    const stored = first.value.stored
    if (!allowed(first.value.current, request.caseRef, ctx) || stored.kind !== "portfolio" || stored.resultRef !== request.resultRef || stored.caseRef.id !== request.caseRef.id || stored.caseRef.incarnation !== request.caseRef.incarnation || stored.caseRef.version > first.value.current.version || stored.resultDigest !== digestSfValue(stored.result) || !/^[a-f0-9]{64}$/.test(stored.requestDigest) || !decodeSfOperationOutput("sf_portfolio_evaluate", stored.result).ok) return { status: "denied", reason: "portfolio-history-access-unavailable" }
    if (!await input.authorizeCase(first.value.current, ctx).catch(() => false) || !await input.verifyHistoricalProvenance(stored, ctx).catch(() => false) || !await input.host.revalidate(ctx).catch(() => false)) return { status: "denied", reason: "portfolio-history-access-unavailable" }
    const again = await load().catch(() => undefined)
    if (!again || again.status !== "ok" || !again.value?.current || !again.value.stored || digestSfValue(again.value.stored) !== digestSfValue(stored) || digestSfValue(again.value.current) !== digestSfValue(first.value.current) || source.signal.aborted || !allowed(again.value.current, request.caseRef, ctx) || !await input.authorizeCase(again.value.current, ctx).catch(() => false) || !await input.verifyHistoricalProvenance(again.value.stored, ctx).catch(() => false) || !await input.host.revalidate(ctx).catch(() => false)) return { status: "stale", reason: "portfolio-history-changed" }
    return { status: "ok", value: { state: "historical", resultRef: stored.resultRef, originalCaseRef: stored.caseRef, result: structuredClone(stored.result), requestDigest: stored.requestDigest, resultDigest: stored.resultDigest, createdAt: stored.createdAt } }
  }
  return { read, list }
}

function allowed(value: DecisionCase, ref: CaseRef, context: TrustedDomainContext) {
  return value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && value.participants.includes(context.binding.principalRef) && (context.kind !== "native" || (context.binding.caseId === value.id && context.binding.caseIncarnation === value.incarnation && context.binding.caseVersion === value.version))
}
