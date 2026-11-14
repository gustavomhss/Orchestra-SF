import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { BiViewRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { StoredScenarioSelection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/stored-scenario.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { readSfDecisionBiSelection } from "./bi-selections.ts"

type PlannerRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type Scope = { incoming: BiViewRequest; inputDigest: string; binding: string; selection: StoredScenarioSelection; request?: Request;
  bypass?: boolean; invalid?: "denied" | "stale"; proof?: { fence: string; projection: DomainProjection } }
type Fence = { kind: "current"; digest: string } | { kind: "unsupported" | "denied" } | undefined
type SnapshotProof = { kind: "current"; digest: string; refs: readonly PlannerRef[] } | { kind: "unsupported" | "denied" } | undefined

/** One consumed UI dispatch may reuse its completed canonical proof, never its authority. */
export function createSfBiCallScope(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  sources: Pick<PlannerSourceHost, "resolveForecastSource">
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}) {
  const { authority } = input, host = authority.host
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const current = (call: TrustedDomainContext, scope: Scope) => active.get(call) === scope && !scope.invalid && call.kind === "ui" &&
    scope.request !== undefined && host.requestFor(call) === scope.request && !scope.request.signal.aborted &&
    scope.binding === digestSfValue([call.kind, call.binding]) && scope.inputDigest === digestSfValue(scope.incoming) &&
    authority.ui.matchesIntent(call, "sf_bi_view", scope.inputDigest)
  const observedDay = async (request: Request) => {
    const at = (await host.environment(request)).at
    return typeof at === "string" && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString().slice(0, 10) : undefined
  }
  const snapshot = async (call: TrustedDomainContext, scope: Scope): Promise<SnapshotProof> => {
    if (!current(call, scope) || !await host.revalidate(call) || !current(call, scope)) return { kind: "denied" }
    const day = await observedDay(scope.request!)
    if (!current(call, scope)) return { kind: "denied" }
    if (!day) return undefined
    const found = await authority.state.read(scope.request!, "cases", async (state, actor): Promise<SnapshotProof> => {
      if (!current(call, scope) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return { kind: "denied" }
      const scenario = state.decisionResults?.[scope.selection.scenarioResultRef], comparison = state.decisionResults?.[scope.selection.comparisonRef]
      const decision = scenario && state.cases[scenario.caseRef.id]
      if (!scenario || scenario.kind !== "scenario" || !comparison || comparison.kind !== "comparison" ||
        scenario.resultRef !== scope.selection.scenarioResultRef || comparison.resultRef !== scope.selection.comparisonRef ||
        digestSfValue(scenario.caseRef) !== digestSfValue(comparison.caseRef)) return undefined
      if (!decision || decision.id !== scenario.caseRef.id ||
        decision.incarnation !== scenario.caseRef.incarnation || decision.version !== scenario.caseRef.version ||
        !decision.participants.includes(actor.principalRef)) return { kind: "denied" }
      // The fast path has no external document/calculation authority, scenario
      // operations or criterion evaluator. Their ordinary producer path remains intact.
      if (decision.criteria.length || decision.preparedChanges.length ||
        [...decision.alternatives, ...decision.choices].some((value) => value.scenario.operations.length)) return { kind: "unsupported" }
      const refs = plannerDependencies([decision, scenario, comparison])
      if (!refs?.length) return { kind: "unsupported" }
      const sources = input.lockedSourceFences()
      if (!await host.revalidate(call) || !current(call, scope)) return { kind: "denied" }
      if (!sources) return undefined
      // Keep the SQLite read scope through the final clock/authorization awaits;
      // otherwise a source could change after releasing the snapshot lock.
      const afterDay = await observedDay(scope.request!)
      if (!current(call, scope) || !await host.revalidate(call) || !current(call, scope)) return { kind: "denied" }
      if (afterDay !== day) return undefined
      // Full state catches changes without a revision bump; all three source
      // fences come from the real read scope, not separate unpinned snapshots.
      return { kind: "current", refs, digest: digestSfValue({ state, sources, day, binding: scope.binding, inputDigest: scope.inputDigest, caseRef: scenario.caseRef }) }
    })
    // C08 itself reauthorizes after its callback. No further await opens a gap
    // after that real boundary; recheck the private Request and consumed intent.
    if (!current(call, scope) || found.status === "denied") return { kind: "denied" }
    return found.status === "ok" ? found.value : undefined
  }
  const fence = async (call: TrustedDomainContext, scope: Scope): Promise<Fence> => {
    const before = await snapshot(call, scope)
    if (before?.kind !== "current") return before
    // T01: a scoped source read can materialize changed source metadata. Delegate
    // outside C08, between complete snapshot proofs; never nest a domain write.
    // The real reader retains its first/last source and current-actor checks.
    for (const ref of before.refs) {
      const source = await input.sources.resolveForecastSource(ref.refId, call)
      if (!current(call, scope) || source.status === "denied") return { kind: "denied" }
      if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(ref)) return undefined
    }
    const after = await snapshot(call, scope)
    if (after?.kind === "denied") return after
    return after?.kind === "current" && after.digest === before.digest && current(call, scope)
      ? { kind: "current", digest: after.digest } : undefined
  }
  const changed = (): PortResult<never> => ({ status: "stale", reason: "bi-call-proof-changed" })
  const denied = (): PortResult<never> => ({ status: "denied", reason: "bi-call-authority-changed" })
  const read = async (selection: StoredScenarioSelection, call: TrustedDomainContext,
    produce: () => Promise<PortResult<DomainProjection>>): Promise<PortResult<DomainProjection>> => {
    const scope = active.get(call)
    if (!scope || scope.bypass) return produce()
    if (scope.invalid) return scope.invalid === "denied" ? denied() : changed()
    if (selection.selectionRef !== scope.selection.selectionRef || selection.scenarioResultRef !== scope.selection.scenarioResultRef ||
      selection.comparisonRef !== scope.selection.comparisonRef || selection.sensitivityResultRef !== undefined) { scope.invalid = "denied"; return denied() }
    // C16 consumes before its first source callback. No unconsumed admission
    // acquires a Request, case proof or result through this private holder.
    scope.request ??= host.requestFor(call)
    const before = await fence(call, scope)
    if (before?.kind === "unsupported" && !scope.proof) { scope.bypass = true; return produce() }
    if (before?.kind === "denied") { scope.invalid = "denied"; return denied() }
    if (!before || before.kind !== "current" || scope.proof && scope.proof.fence !== before.digest) { scope.invalid = "stale"; return changed() }
    const result = scope.proof ? { status: "ok" as const, value: structuredClone(scope.proof.projection) } : await produce()
    if (result.status !== "ok") return result
    const after = await fence(call, scope)
    if (after?.kind === "denied") { scope.invalid = "denied"; return denied() }
    if (after?.kind !== "current" || after.digest !== before.digest) { scope.invalid = "stale"; return changed() }
    scope.proof ??= { fence: after.digest, projection: structuredClone(result.value) }
    return result
  }
  const run = async <Value>(request: BiViewRequest, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    const selected = readSfDecisionBiSelection(request.selectionRef)
    if (call.kind !== "ui" || !selected || !("scenarioResultRef" in selected) || selected.sensitivityResultRef ||
      request.viewId !== "BI09" && request.viewId !== "BI10") return work()
    if (active.has(call)) return { status: "denied", reason: "bi-call-already-active" }
    const scope: Scope = { incoming: request, inputDigest: digestSfValue(request), binding: digestSfValue([call.kind, call.binding]),
      selection: { selectionRef: request.selectionRef, scenarioResultRef: selected.scenarioResultRef, comparisonRef: selected.comparisonRef } }
    active.set(call, scope)
    try {
      const result = await work()
      if (result.status !== "ok" || scope.bypass || !scope.proof) return result
      // The canonical dispatcher has its own final authorization await. Check
      // the source/case/clock again after it, then identity after our final await.
      const final = await fence(call, scope)
      if (final?.kind === "denied" || !current(call, scope)) return scope.invalid === "stale" ? changed() : denied()
      return final?.kind === "current" && final.digest === scope.proof.fence && current(call, scope) ? result : changed()
    } catch (error) {
      if (scope.request && !current(call, scope)) return scope.invalid === "stale" ? changed() : denied()
      throw error
    } finally { if (active.get(call) === scope) active.delete(call) }
  }
  return { run, read }
}

/** Recursion includes provenance in assumptions, coverage, ledger and future additive fields. */
function plannerDependencies(value: unknown): readonly PlannerRef[] | undefined {
  const refs = new Map<string, PlannerRef>()
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return true
    if (Array.isArray(value)) return value.every(visit)
    if ("schema" in value && value.schema === "sf-evidence-v1") {
      if (!("kind" in value) || value.kind !== "record" || !("target" in value) || !value.target || typeof value.target !== "object" ||
        !("surface" in value.target) || value.target.surface !== "planner" || !("recordType" in value.target) || value.target.recordType !== "planner-version") return false
      const ref = value as PlannerRef
      refs.set(digestSfValue(ref), ref)
    }
    return Object.values(value).every(visit)
  }
  return visit(value) ? [...refs.values()] : undefined
}
