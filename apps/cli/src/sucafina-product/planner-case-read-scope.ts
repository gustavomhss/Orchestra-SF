import { AsyncLocalStorage } from "node:async_hooks"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type PlannerRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type Selection = { caseRef: CaseRef }
export type SfPlannerCaseObservation = <Value>(incoming: Selection, call: TrustedDomainContext,
  work: () => Promise<PortResult<Value>>) => Promise<PortResult<Value>>
type Scope = {
  call: TrustedDomainContext; incoming: Selection; selected: CaseRef; inputDigest: string
  request: Request; requestDigest: string; binding: TrustedDomainContext["binding"]; bindingDigest: string
  lease: TrustedDomainContext["lease"]; reader: BusinessContextService
  resolve: BusinessContextService["resolve"]; context: BusinessContextService["context"]
  read: DecisionCasePort["read"]; source: PlannerSourceHost["resolveForecastSource"]
  open: boolean; busy: boolean; invalid?: "denied" | "stale"
  proof?: { fence: string; value: AuthorizedCaseProjection }
}
type Fence = { kind: "current"; digest: string; caseDigest: string; refs: readonly PlannerRef[] } |
  { kind: "unsupported" | "denied" | "stale" }

/** One read-only scenario observation may reuse a completed local Planner case projection.
 * Canonical case/source/operation checks run before the first proof. Every reuse
 * independently reopens the complete protected state, real sources and authority. */
export function createSfPlannerCaseReadScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  sources: Pick<PlannerSourceHost, "resolveForecastSource">
  readerIdentity: () => BusinessContextService | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}) {
  const local = new AsyncLocalStorage<Scope>()
  const active = new WeakMap<TrustedDomainContext, Scope>()
  const current = (scope: Scope) => scope.open && !scope.invalid && local.getStore() === scope && active.get(scope.call) === scope &&
    scope.call.kind === "ui" && scope.call.binding === scope.binding && scope.call.lease === scope.lease &&
    digestSfValue([scope.call.kind, scope.call.binding]) === scope.bindingDigest &&
    input.host.requestFor(scope.call) === scope.request && !scope.request.signal.aborted &&
    requestIdentity(scope.request) === scope.requestDigest && digestSfValue(scope.incoming) === scope.inputDigest &&
    input.readerIdentity() === scope.reader && scope.reader.resolve === scope.resolve && scope.reader.context === scope.context &&
    input.read === scope.read && input.sources.resolveForecastSource === scope.source
  const environment = async (scope: Scope) => {
    const observed = await input.host.environment(scope.request)
    const at = Date.parse(observed.at)
    return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(observed.directory),
      bankKey: observed.bankKey ? Array.from(observed.bankKey) : undefined } : undefined
  }
  const snapshot = async (scope: Scope): Promise<Fence> => {
    if (!current(scope) || !await input.host.revalidate(scope.call) || !current(scope)) return { kind: "denied" }
    const found = await input.state.read(scope.request, "cases", async (state, actor): Promise<Fence> => {
      const call = scope.call, selected = scope.selected
      const value = state.cases[selected.id]
      if (!current(scope) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
        actor.policyVersion !== call.binding.policyVersion || !value || value.id !== selected.id || value.incarnation !== selected.incarnation ||
        value.version !== selected.version || !value.participants.includes(actor.principalRef)) return { kind: "denied" }
      const refs = sfPlannerCaseDependencies(value)
      const snapshots = input.host.persistence.currentSnapshots?.(), sources = input.lockedSourceFences()
      if (!refs?.length || !snapshots || !sources) return { kind: "unsupported" }
      const protectedDigest = digestSfValue({ state, snapshots, sources })
      const before = await environment(scope)
      const principal = structuredClone(await input.host.authenticate(scope.request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") }))
      if (!before || !principal || principal.id !== actor.principalRef || principal.id.startsWith("local:") || !current(scope)) return { kind: "denied" }
      const after = await environment(scope)
      const again = await input.host.authenticate(scope.request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") })
      if (!after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(principal) !== digestSfValue(again) ||
        !await input.host.revalidate(call) || !current(scope)) return { kind: "denied" }
      if (protectedDigest !== digestSfValue({ state, snapshots: input.host.persistence.currentSnapshots?.(), sources: input.lockedSourceFences() }))
        return { kind: "stale" }
      return { kind: "current", refs, caseDigest: digestSfValue(value),
        digest: digestSfValue({ protectedDigest, principal, environment: after, input: scope.inputDigest,
          request: scope.requestDigest, binding: scope.bindingDigest }) }
    })
    if (!current(scope) || found.status === "denied") return { kind: "denied" }
    return found.status === "ok" ? found.value : { kind: "stale" }
  }
  const fence = async (scope: Scope): Promise<Fence> => {
    const before = await snapshot(scope)
    if (before.kind !== "current") return before
    // Source metadata may be materialized only outside the C08 witness. The
    // actual source reader retains its own current-actor and first/last checks.
    for (const ref of before.refs) {
      const source = await input.sources.resolveForecastSource(ref.refId, scope.call)
      if (!current(scope) || source.status === "denied") return { kind: "denied" }
      if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(ref)) return { kind: "stale" }
    }
    const after = await snapshot(scope)
    return after.kind === "current" && after.digest === before.digest && current(scope) ? after :
      after.kind === "denied" ? after : { kind: "stale" }
  }
  const failure = (scope: Scope, kind: "denied" | "stale"): PortResult<never> => {
    scope.invalid = kind
    return kind === "denied" ? { status: "denied", reason: "case-access-unavailable" } :
      { status: "stale", reason: "scenario-source-changed" }
  }
  const read: DecisionCasePort["read"] = async (incoming, call) => {
    const scope = active.get(call)
    if (scope && local.getStore() !== scope) return { status: "denied", reason: "scenario-case-invocation-unavailable" }
    if (!scope) return input.read(incoming, call)
    if (!current(scope)) return failure(scope, scope.invalid ?? "denied")
    const ref = parseCaseRef(incoming.caseRef), argumentDigest = digestSfValue(incoming)
    if (!ref || ref.id !== scope.selected.id || ref.incarnation !== scope.selected.incarnation) return input.read(incoming, call)
    // Neither recursive nor overlapping canonical calls borrow a pending proof.
    if (scope.busy) return input.read(incoming, call)
    scope.busy = true
    try {
      const before = await fence(scope)
      if (before.kind === "unsupported" && !scope.proof) return await input.read(incoming, call)
      if (before.kind !== "current") return failure(scope, before.kind === "denied" ? "denied" : "stale")
      if (!current(scope)) return failure(scope, scope.invalid ?? "denied")
      if (digestSfValue(incoming) !== argumentDigest || scope.proof && scope.proof.fence !== before.digest) return failure(scope, "stale")
      if (scope.proof) return { status: "ok", value: { ...structuredClone(scope.proof.value), checkedAt: new Date().toISOString() } }
      const result = await input.read(incoming, call)
      if (result.status !== "ok") return result
      const after = await fence(scope)
      if (after.kind !== "current") return failure(scope, after.kind === "denied" ? "denied" : "stale")
      if (!current(scope) || digestSfValue(incoming) !== argumentDigest || before.digest !== after.digest ||
        digestSfValue(result.value.case) !== after.caseDigest) return failure(scope, "stale")
      scope.proof = { fence: after.digest, value: structuredClone(result.value) }
      return { status: "ok", value: structuredClone(result.value) }
    } finally { scope.busy = false }
  }
  const run: SfPlannerCaseObservation = async (incoming, call, work) => {
    if (call.kind !== "ui") return work()
    const request = input.host.requestFor(call), reader = input.readerIdentity()
    if (!request || !reader || !input.host.persistence.currentSnapshots) return work()
    if (active.has(call)) return { status: "denied", reason: "scenario-case-already-active" }
    const scope: Scope = { call, incoming, selected: structuredClone(incoming.caseRef), inputDigest: digestSfValue(incoming),
      request, requestDigest: requestIdentity(request), binding: call.binding, bindingDigest: digestSfValue([call.kind, call.binding]),
      lease: call.lease, reader, resolve: reader.resolve, context: reader.context, read: input.read,
      source: input.sources.resolveForecastSource, open: true, busy: false }
    active.set(call, scope)
    try {
      return await local.run(scope, async () => {
        if (!current(scope) || !await input.host.revalidate(call) || !current(scope)) return failure(scope, "denied")
        const result = await work()
        if (result.status !== "ok") return result
        if (!current(scope)) return failure(scope, scope.invalid ?? "denied")
        if (!scope.proof) return result
        const final = await fence(scope)
        if (final.kind !== "current") return failure(scope, final.kind === "denied" ? "denied" : "stale")
        return current(scope) && final.digest === scope.proof.fence ? result : failure(scope, "stale")
      })
    } finally { scope.open = false; scope.proof = undefined; if (active.get(call) === scope) active.delete(call) }
  }
  // A public read-only comparison may already belong to scenario preparation
  // or verification. Join only that exact lexical owner; an overlapping caller
  // never sees its proof, and nested run() keeps its original refusal.
  const observe: SfPlannerCaseObservation = async (incoming, call, work) => {
    const owner = local.getStore(), scope = active.get(call)
    if (!scope) {
      if (owner) return { status: "denied", reason: "scenario-case-invocation-unavailable" }
      return run(incoming, call, work)
    }
    if (owner !== scope) return { status: "denied", reason: "scenario-case-invocation-unavailable" }
    if (!current(scope)) return failure(scope, scope.invalid ?? "denied")
    if (digestSfValue(incoming.caseRef) !== digestSfValue(scope.selected))
      return { status: "denied", reason: "scenario-case-selection-unavailable" }
    const incomingDigest = digestSfValue(incoming)
    const result = await work()
    if (result.status !== "ok") return result
    if (!current(scope)) return failure(scope, scope.invalid ?? "denied")
    if (digestSfValue(incoming) !== incomingDigest) return failure(scope, "stale")
    if (!scope.proof) return result
    // Reopen the same complete C08/source/actor/day witness after the child's
    // final await. No Promise or pending canonical read is shared by this join.
    const final = await fence(scope)
    if (final.kind !== "current") return failure(scope, final.kind === "denied" ? "denied" : "stale")
    return current(scope) && digestSfValue(incoming) === incomingDigest && final.digest === scope.proof.fence
      ? result : failure(scope, "stale")
  }
  return { read, run, observe }
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }

/** No remote/calculation/draft source or unfinished command can borrow a local proof. */
export function sfPlannerCaseDependencies(value: DecisionCase): readonly PlannerRef[] | undefined {
  if (value.preparedChanges.length || value.receipts.length ||
    [...value.alternatives, ...value.choices].some((item) => item.scenario.operations.some((operation) =>
      operation.replacementRef !== undefined || operation.targetRef.startsWith("sf-procurement:") ||
      !["replace", "exclude", "include", "defer"].includes(operation.kind)))) return undefined
  const refs = new Map<string, PlannerRef>(), seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return true
    if (seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" ||
        !ref.target.period || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      refs.set(digestSfValue(ref), ref)
    }
    return Object.values(item).every(visit)
  }
  if (!visit(value)) return undefined
  const ids = new Set([...refs.values()].map((ref) => ref.refId))
  return [...value.alternatives, ...value.choices].every((item) => ids.has(item.scenario.baseRef)) ? [...refs.values()] : undefined
}
