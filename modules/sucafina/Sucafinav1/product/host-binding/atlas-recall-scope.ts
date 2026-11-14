import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../contracts/state.ts"
import type { createSfAtlasMemory } from "./atlas-memory.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type CalculationRef = Extract<BusinessEvidenceRef, { kind: "calculation" }>
type PlannerRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type RecallResult = Awaited<ReturnType<ReturnType<typeof createSfAtlasMemory>["recall"]>>
export type SfCalculationCaseScope = <Value>(call: TrustedDomainContext, selected: CaseRef,
  work: () => Promise<PortResult<Value>>, egress?: (value: PortResult<Value>) => Promise<PortResult<Value>>) => Promise<PortResult<Value>>
type Proof = { incoming: BusinessEvidenceRef; ref: CalculationRef; refDigest: string; fence: string; resolution: BusinessEvidenceResolution }
type Scope = { call: TrustedDomainContext; request: Request; binding: string; incoming: { id: string; incarnation: string }; inputDigest: string;
  selected: CaseRef; busy: boolean; closed: boolean; invalid: boolean; proof?: Proof }
type SnapshotProof = { kind: "current"; digest: string; baseRef: string } | { kind: "unsupported" } | undefined
type Fence = { kind: "current"; digest: string } | { kind: "unsupported" } | undefined

/** Reuse one completed record-only calculation inside one authenticated Atlas recall. */
export function createSfAtlasRecallScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  sources: PlannerSourceHost
  readPlanner: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  calculation: (ref: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<BusinessEvidenceResolution>
  withCalculationCase: SfCalculationCaseScope
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  now: () => string
}) {
  // A WeakMap alone would let an unrelated overlapping call borrow this proof.
  // AsyncLocalStorage limits it to descendants of the one recall invocation.
  const local = new AsyncLocalStorage<Scope>()
  const active = new WeakSet<TrustedDomainContext>()
  const current = (scope: Scope) => local.getStore() === scope && !scope.closed && !scope.invalid && active.has(scope.call) &&
    scope.call.kind === "ui" && input.host.requestFor(scope.call) === scope.request && !scope.request.signal.aborted &&
    digestSfValue([scope.call.kind, scope.call.binding]) === scope.binding && digestSfValue(scope.incoming) === scope.inputDigest &&
    (!scope.proof || digestSfValue(scope.proof.incoming) === scope.proof.refDigest)
  const day = async (request: Request) => {
    const at = (await input.host.environment(request)).at
    return typeof at === "string" && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString().slice(0, 10) : undefined
  }
  const snapshot = async (scope: Scope, ref: CalculationRef): Promise<SnapshotProof> => {
    if (!current(scope) || !await input.host.revalidate(scope.call) || !current(scope)) return undefined
    const observedDay = await day(scope.request)
    if (!observedDay || !current(scope)) return undefined
    const found = await input.state.read(scope.request, "cases", async (state, actor): Promise<SnapshotProof> => {
      const selected = state.cases[scope.selected.id]
      if (!current(scope) || actor.principalRef !== scope.call.binding.principalRef || actor.accessRevision !== scope.call.binding.accessRevision ||
        actor.policyVersion !== scope.call.binding.policyVersion || !selected || selected.id !== scope.selected.id ||
        selected.incarnation !== scope.selected.incarnation || selected.version !== scope.selected.version || !selected.participants.includes(actor.principalRef)) return undefined
      const baseRef = recordOnlyRequest(state, scope.selected, ref)
      if (!baseRef) return { kind: "unsupported" }
      const sources = input.lockedSourceFences()
      if (!sources || !await input.host.revalidate(scope.call) || !current(scope)) return undefined
      // Hold C08's real read scope through the final clock and authorization
      // awaits. C08 itself reauthorizes once more after this callback returns.
      const finalDay = await day(scope.request)
      if (finalDay !== observedDay || !await input.host.revalidate(scope.call) || !current(scope)) return undefined
      return { kind: "current", baseRef,
        digest: digestSfValue({ state, sources, day: observedDay, binding: scope.binding, input: scope.inputDigest, selected: scope.selected, ref }) }
    })
    return current(scope) && found.status === "ok" ? found.value : undefined
  }
  const fence = async (scope: Scope, ref: CalculationRef): Promise<Fence> => {
    const before = await snapshot(scope, ref)
    if (before?.kind !== "current") return before
    // These real readers may materialize source metadata. T01 requires them
    // outside C08, bracketed by complete snapshots, never under its transaction.
    const coverage = await input.sources.resolveForecastCoverage(before.baseRef, scope.call)
    if (!current(scope) || coverage.status !== "ok") return undefined
    const refs = plannerRefs([ref.target.sourceRefs, coverage.value])
    if (!refs?.length) return { kind: "unsupported" }
    for (const source of refs) {
      const resolved = await input.readPlanner(source, scope.call)
      if (!current(scope) || resolved.state !== "fresh" || !resolved.currentRef || !resolved.authorizedProjection ||
        resolved.accessRevision !== scope.call.binding.accessRevision || digestSfValue(resolved.ref) !== digestSfValue(source) ||
        digestSfValue(resolved.currentRef) !== digestSfValue(source)) return undefined
    }
    const after = await snapshot(scope, ref)
    // The record reader verifies its actual projection against the pinned ref;
    // UTC day and all source/state bytes fence the deterministic calculation.
    return after?.kind === "current" && after.digest === before.digest && current(scope)
      ? { kind: "current", digest: digestSfValue({ snapshot: after.digest, coverage: coverage.value }) } : undefined
  }
  const resolve = async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const scope = local.getStore()
    if (!scope || scope.call !== call || scope.closed || scope.busy || ref.kind !== "calculation" || ref.target.calculationId !== "planner:scenario" ||
      !ref.target.sourceRefs.length || !plannerRefs(ref.target.sourceRefs)?.length || scope.proof && scope.proof.refDigest !== digestSfValue(ref))
      return input.calculation(ref, call)
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: input.now() })
    if (!current(scope)) return unavailable()
    const captured = structuredClone(ref), refDigest = digestSfValue(ref)
    scope.busy = true
    try {
      const before = await fence(scope, captured)
      if (before?.kind === "unsupported" && !scope.proof) return await input.calculation(ref, call)
      if (before?.kind !== "current" || scope.proof && scope.proof.fence !== before.digest) { scope.invalid = true; return unavailable() }
      // Never hold a Promise or serialize recursive work. Reentry above reaches
      // the unchanged financial producer and its existing cycle guard.
      const result = scope.proof ? structuredClone(scope.proof.resolution) : await input.calculation(ref, call)
      if (result.state !== "fresh") return result
      if (!result.currentRef || !result.authorizedProjection || result.accessRevision !== call.binding.accessRevision ||
        digestSfValue(result.ref) !== refDigest || digestSfValue(result.currentRef) !== refDigest) return unavailable()
      const after = await fence(scope, captured)
      if (after?.kind !== "current" || after.digest !== before.digest || digestSfValue(ref) !== refDigest || !current(scope)) { scope.invalid = true; return unavailable() }
      scope.proof ??= { incoming: ref, ref: captured, refDigest, fence: after.digest, resolution: structuredClone(result) }
      return { ...result, checkedAt: input.now() }
    } finally { scope.busy = false }
  }
  const recall = async (incoming: { id: string; incarnation: string }, call: TrustedDomainContext, work: () => Promise<RecallResult>): Promise<RecallResult> => {
    if (call.kind !== "ui") return work()
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), inputDigest = digestSfValue(incoming)
    if (!request || request.signal.aborted || active.has(call) || !await input.host.revalidate(call)) return { status: "unavailable" }
    const selected = await input.state.read(request, "cases", (state, actor) => {
      const value = state.cases[incoming.id]
      if (!value || value.incarnation !== incoming.incarnation || !value.participants.includes(actor.principalRef) || actor.principalRef !== call.binding.principalRef ||
        actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
      const selected = { id: value.id, incarnation: value.incarnation, version: value.version }
      return { selected, eligible: value.sourceRefs.some((ref) => ref.kind === "calculation" && recordOnlyRequest(state, selected, ref) !== undefined) }
    })
    if (selected.status !== "ok" || !selected.value || active.has(call) || input.host.requestFor(call) !== request || request.signal.aborted ||
      binding !== digestSfValue([call.kind, call.binding]) || inputDigest !== digestSfValue(incoming)) return { status: "unavailable" }
    // Preserve the original historical/mixed-domain path, including its case
    // semantics. Merely having Atlas mounted does not enable proof reuse.
    if (!selected.value.eligible) return work()
    const scope: Scope = { call, request, binding, incoming, inputDigest, selected: selected.value.selected, busy: false, closed: false, invalid: false }
    active.add(call)
    try {
      return await local.run(scope, async () => {
        const result = await input.withCalculationCase<RecallResult>(call, scope.selected, async () => ({ status: "ok", value: await work() }), async (result) => {
          if (result.status !== "ok" || result.value.status !== "ok" || !scope.proof) return result
          // The private case wrapper calls this AFTER its own final await while
          // retaining the exact CaseScope needed by the real coverage callback.
          scope.busy = true
          try {
            const final = await fence(scope, scope.proof.ref)
            return final?.kind === "current" && final.digest === scope.proof.fence && current(scope)
              ? result : { status: "unavailable", reason: "atlas-recall-proof-changed" }
          } finally { scope.busy = false }
        })
        return result.status === "ok" && current(scope) ? result.value : { status: "unavailable" }
      })
    } catch { return { status: "unavailable" } }
    finally { scope.closed = true; scope.proof = undefined; active.delete(call) }
  }
  return { recall, resolve }
}

/** Eligibility never replaces the first canonical request/result-store read. */
function recordOnlyRequest(state: Readonly<SfProductState>, selected: CaseRef, ref: CalculationRef): string | undefined {
  if (ref.target.calculationId !== "planner:scenario" || !ref.target.sourceRefs.length || !plannerRefs(ref.target.sourceRefs)?.length) return undefined
  const stored = state.decisionResults?.[ref.target.runId]
  const requests = Object.values(state.preferences).filter((value): value is Record<string, unknown> => !!value && typeof value === "object" &&
    "schema" in value && value.schema === "sf-scenario-request-v1" && "resultRef" in value && value.resultRef === ref.target.runId)
  if (!stored || stored.kind !== "scenario" || requests.length !== 1) return undefined
  const request = requests[0]!, parsed = decodeSfOperationInput("sf_scenario_simulate", request.request)
  return parsed.ok && !parsed.value.assumptions.length && !parsed.value.operations.length && request.engineVersion === "planner-runtime-v1" &&
    ref.target.engineVersion === request.engineVersion && digestSfValue(request.caseRef) === digestSfValue(selected) && digestSfValue(stored.caseRef) === digestSfValue(selected) &&
    ref.target.sourceRefs.some((source) => source.refId === parsed.value.baseRef) && plannerRefs([request, stored])?.length
    ? parsed.value.baseRef : undefined
}

/** Reject mixed/recursive evidence closures instead of inferring their authority. */
function plannerRefs(value: unknown): readonly PlannerRef[] | undefined {
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
