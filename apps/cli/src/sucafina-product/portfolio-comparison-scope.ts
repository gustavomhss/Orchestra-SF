import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createDecisionComparisonService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/comparison.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type Compare = ReturnType<typeof createDecisionComparisonService>
type Value = Extract<Awaited<ReturnType<Compare>>, { status: "ok" }>["value"]
type Scope = { request: Request; binding: string; proofs: Map<string, { fence: string; value: Value }> }
export type SfComparisonInvocation = <T>(call: TrustedDomainContext, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>

/** Completed canonical comparisons may be reused only inside one lexical invocation.
 * Each fence independently reopens every supported Planner source. All other
 * dependency kinds continue through the complete canonical comparison.
 */
export function createSfPortfolioComparisonScope(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: Pick<ReturnType<typeof createSfBusinessServices>, "selectedCase" | "lockedSourceFences" | "plannerSources">
  compareCanonical: Compare
}) {
  const host = input.authority.host
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const execution = new AsyncLocalStorage<Scope>()
  const current = (call: TrustedDomainContext, scope: Scope) => active.get(call) === scope && execution.getStore() === scope &&
    host.requestFor(call) === scope.request && !scope.request.signal.aborted && scope.binding === digestSfValue([call.kind, call.binding])
  const day = async (request: Request) => {
    const at = (await host.environment(request)).at
    return typeof at === "string" && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString().slice(0, 10) : undefined
  }
  const sample = async (call: TrustedDomainContext, scope: Scope, caseRef: Parameters<Compare>[0]["caseRef"]) => {
    if (!current(call, scope) || !await host.revalidate(call) || !current(call, scope)) return undefined
    const beforeDay = await day(scope.request)
    const selected = await input.business.selectedCase(call)
    if (!beforeDay || selected.status !== "ok" || digestSfValue(selected.value) !== digestSfValue(caseRef) || !current(call, scope)) return undefined
    // No financial/source producer is entered while C08 owns its read scope.
    // The final clock and authority reads remain inside it; the state provider
    // performs its own final reauthorization before releasing the snapshot.
    const found = await input.authority.state.read(scope.request, "preferences", async (state, actor) => {
      const decision = state.cases[selected.value.id]
      if (!decision || decision.id !== selected.value.id || decision.incarnation !== selected.value.incarnation || decision.version !== selected.value.version ||
        actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
        !decision.participants.includes(actor.principalRef) || !current(call, scope)) return undefined
      const refs = plannerOnlyEvidence(decision)
      if (!refs) return undefined
      const afterDay = await day(scope.request)
      const authorized = await host.revalidate(call)
      const sources = input.business.lockedSourceFences()
      // The complete state, including preferences, audit, transactions and
      // native runs, participates. Only synchronous checks follow this await.
      return sources && afterDay === beforeDay && authorized && current(call, scope)
        ? { refs, digest: digestSfValue({ state, sources, day: afterDay, caseRef: selected.value, binding: scope.binding, actor }) } : undefined
    })
    return found.status === "ok" && found.value && current(call, scope) ? found.value : undefined
  }
  const fence = async (call: TrustedDomainContext, scope: Scope, caseRef: Parameters<Compare>[0]["caseRef"]) => {
    const before = await sample(call, scope, caseRef)
    if (!before) return undefined
    // Hashes never stand in for the source's current granular authorization.
    // Do not memoize these reads, even when an identical proof already exists.
    for (const reference of before.refs) {
      const source = await input.business.plannerSources.resolveForecastSource(reference.refId, call)
      if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(reference) || !current(call, scope)) return undefined
    }
    const after = await sample(call, scope, caseRef)
    return after && after.digest === before.digest && digestSfValue(after.refs) === digestSfValue(before.refs) ? after.digest : undefined
  }
  const denied = (): PortResult<never> => ({ status: "denied", reason: "portfolio-comparison-invocation-unavailable" })
  const compare: Compare = async (request, call) => {
    const captured = structuredClone(request)
    const requestDigest = digestSfValue(captured)
    const unchanged = () => digestSfValue(request) === requestDigest
    const scope = active.get(call)
    // A separate overlapping caller cannot borrow the private lexical scope.
    if (scope && !current(call, scope)) return denied()
    if (!scope || captured.criteria.length) return input.compareCanonical(captured, call)
    const before = await fence(call, scope, captured.caseRef)
    if (!unchanged() || !current(call, scope)) return denied()
    const key = digestSfValue({ request: captured, binding: scope.binding })
    const proof = scope.proofs.get(key)
    if (before && proof?.fence === before) {
      const value = structuredClone(proof.value)
      const after = await fence(call, scope, captured.caseRef)
      if (!after || !current(call, scope)) return denied()
      return after === before && unchanged() && current(call, scope) ? { status: "ok", value }
        : { status: "stale", reason: "portfolio-comparison-proof-changed" }
    }
    scope.proofs.delete(key)
    const result = await input.compareCanonical(captured, call)
    if (result.status !== "ok") return result
    if (!before) {
      // Unsupported dependencies remain a full producer invocation. No result
      // from this path is installed in the proof map.
      return unchanged() && current(call, scope) ? result : denied()
    }
    const after = await fence(call, scope, captured.caseRef)
    if (!after || !current(call, scope)) return denied()
    if (after !== before || !unchanged()) return { status: "stale", reason: "portfolio-comparison-proof-changed" }
    scope.proofs.set(key, { fence: after, value: structuredClone(result.value) })
    return result
  }
  const run: SfComparisonInvocation = async (call, work) => {
    const prior = active.get(call)
    if (prior) return current(call, prior) ? work() : denied()
    const request = host.requestFor(call)
    if (!request || request.signal.aborted || !await host.revalidate(call) || active.has(call) || host.requestFor(call) !== request || request.signal.aborted) return denied()
    const scope: Scope = { request, binding: digestSfValue([call.kind, call.binding]), proofs: new Map() }
    active.set(call, scope)
    return execution.run(scope, async () => {
      try {
        const result = await work()
        // The producer/consumer owns its final awaited authority boundary.
        // Do not add another await after that boundary releases its snapshot.
        return current(call, scope) ? result : denied()
      } finally { if (active.get(call) === scope) active.delete(call) }
    })
  }
  return { compare, run }
}

function plannerOnlyEvidence(decision: DecisionCase): readonly Extract<BusinessEvidenceRef, { kind: "record" }>[] | undefined {
  // This narrow path has no criterion, receipt, calculation, document, HR,
  // Procurement or command authority. The canonical producer handles all such
  // cases normally; a broad state digest cannot authorize those dependencies.
  if (decision.criteria.length || decision.choices.length || decision.preparedChanges.length || decision.receipts.length || decision.ledger.length ||
    decision.questions.length || decision.alternatives.some((alternative) => alternative.scenario.operations.length ||
      alternative.result.components.some((component) => component.sourceRefs.some((source) => source.surface !== "planner")))) return undefined
  const refs = [...decision.sourceRefs, ...decision.costCoverageBases.flatMap((basis) => basis.sourceRefs), ...decision.assumptions.flatMap((value) => value.evidenceRefs),
    ...decision.alternatives.flatMap((alternative) => [...alternative.scenario.assumptions.flatMap((value) => value.evidenceRefs), ...alternative.result.sourceRefs,
      ...alternative.result.costCoverage.evaluatedSourceRefs, ...alternative.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])]
  if (!refs.length || refs.some((reference) => reference.kind !== "record" || reference.target.surface !== "planner" || reference.target.recordType !== "planner-version")) return undefined
  return refs.filter((reference, index) => refs.findIndex((other) => digestSfValue(other) === digestSfValue(reference)) === index) as readonly Extract<BusinessEvidenceRef, { kind: "record" }>[]
}
