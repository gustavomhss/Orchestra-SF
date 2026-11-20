import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductState, SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfCalculationCaseScope } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-recall-scope.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { sfPlannerEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"

type Calculation = Extract<BusinessEvidenceRef, { kind: "calculation" }>
type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type CaseRef = { id: string; incarnation: string; version: number }
type Leaf = { caseRef: CaseRef; baseRef: string; refs: readonly RecordRef[]; reference: Calculation }
type Witness = { kind: "current"; digest: string; leaf: Leaf } | { kind: "unsupported" }
type Proof = { runId: string; reference: Calculation; digest: string; witness: string; resolution?: BusinessEvidenceResolution }
type Owner = { call: TrustedDomainContext; current: () => boolean; pins: Set<() => boolean>; open: boolean; invalid: boolean;
  children: number; readers: number; busy: boolean; proof?: Proof }

/** A completed leaf proof belongs to one readonly ancestry invocation. No pending
 * Promise, outer calculation, publication or historical result is reusable. */
export function createSfPlannerCalculationAncestryScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  sources: PlannerSourceHost
  withCalculationCase: SfCalculationCaseScope
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  identities: () => readonly unknown[]
  requireCanonicalReplay: (runId: string, call: TrustedDomainContext) => boolean
}) {
  const local = new AsyncLocalStorage<Owner>()
  const active = new WeakMap<TrustedDomainContext, Owner>()
  const changed = <Value>(): PortResult<Value> => ({ status: "unavailable", reason: "calculation-ancestry-observation-changed" })
  const live = (owner: Owner) => owner.open && !owner.invalid && local.getStore() === owner &&
    active.get(owner.call) === owner && owner.current() && [...owner.pins].every((pin) => pin())
  const invalidate = (owner: Owner) => { owner.invalid = true; owner.proof = undefined }
  const original = async <Value>(owner: Owner, work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    owner.readers++
    try {
      const result = await work()
      if (!live(owner)) { invalidate(owner); return changed() }
      return result
    } finally { owner.readers-- }
  }
  const snapshot = async (owner: Owner, runId: string): Promise<Witness | undefined> => {
    const host = input.host, request = host.requestFor(owner.call)
    // A caller-owned SQLite snapshot cannot prove current committed authority.
    if (!request || host.persistence.currentSnapshots?.() || !live(owner) || !await host.revalidate(owner.call) || !live(owner)) return undefined
    const observe = async (state: Readonly<SfProductState>, authority: { principalRef: string; accessRevision: string; policyVersion: string }) => {
      if (!live(owner) || authority.principalRef !== owner.call.binding.principalRef ||
        authority.accessRevision !== owner.call.binding.accessRevision || authority.policyVersion !== owner.call.binding.policyVersion) return undefined
      const leaf = leafFor(state, runId, owner.call)
      if (!leaf) return { kind: "unsupported" as const }
      const locked = host.persistence.currentSnapshots?.(), fences = input.lockedSourceFences()
      if (!locked?.dashboard || !locked.planner || !locked.procurement || !fences) return undefined
      const protectedDigest = digestSfValue({ state, locked, fences })
      const environment = await host.environment(request)
      const day = dayOf(environment.at)
      const principal = structuredClone(await host.authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") }))
      if (!day || !principal || principal.id !== authority.principalRef || principal.id.startsWith("local:") || !live(owner) ||
        !leaf.refs.every((ref) => materialized(ref, owner.call, locked.planner, principal))) return undefined
      const again = await host.environment(request)
      const actor = await host.authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") })
      const currentEnvironment = { day: dayOf(again.at), directory: again.directory, bankKey: again.bankKey ? Array.from(again.bankKey) : undefined }
      const observedEnvironment = { day, directory: environment.directory, bankKey: environment.bankKey ? Array.from(environment.bankKey) : undefined }
      if (digestSfValue(principal) !== digestSfValue(actor) || digestSfValue(observedEnvironment) !== digestSfValue(currentEnvironment) ||
        !await host.revalidate(owner.call) || !live(owner) ||
        digestSfValue({ state, locked: host.persistence.currentSnapshots?.(), fences: input.lockedSourceFences() }) !== protectedDigest) return undefined
      return { kind: "current" as const, leaf, state, authority, locked, fences, principal, environment: currentEnvironment }
    }
    // Request bindings require their own real preferences grant. A cases grant
    // alone never substitutes for that namespace's current admission.
    const preferences = await input.state.read(request, "preferences", observe)
    const found = await input.state.read(request, "cases", observe)
    if (!live(owner) || host.persistence.currentSnapshots?.() || found.status !== "ok" || !found.value ||
      preferences.status !== "ok" || !preferences.value || digestSfValue(preferences.value) !== digestSfValue(found.value)) return undefined
    if (found.value.kind === "unsupported") return found.value
    // The clock is observed once more after C08's own final authorization awaits.
    const finalEnvironment = await host.environment(request)
    if (!live(owner) || host.persistence.currentSnapshots?.() ||
      digestSfValue({ day: dayOf(finalEnvironment.at), directory: finalEnvironment.directory,
        bankKey: finalEnvironment.bankKey ? Array.from(finalEnvironment.bankKey) : undefined }) !== digestSfValue(found.value.environment)) return undefined
    // Preserve both full C08 envelopes, including every revision and incarnation.
    return { kind: "current", leaf: found.value.leaf, digest: digestSfValue({ preferences, cases: found }) }
  }
  const fence = async (owner: Owner, runId: string): Promise<Witness | undefined> => {
    const before = await snapshot(owner, runId)
    if (before?.kind !== "current") return before
    const checked = await input.withCalculationCase(owner.call, before.leaf.caseRef, async (): Promise<PortResult<string>> => {
      const coverage = await input.sources.resolveForecastCoverage(before.leaf.baseRef, owner.call)
      if (!live(owner) || coverage.status !== "ok") return changed()
      const coverageDigest = digestSfValue(coverage)
      owner.pins.add(() => digestSfValue(coverage) === coverageDigest)
      const refs = plannerRecords([before.leaf.refs, coverage.value])
      if (!refs?.length) return changed()
      // Every reuse executes the real source readers and coverage authority.
      // These callbacks stay outside C08 and are fenced by full committed state.
      for (const ref of refs) {
        const found = await input.sources.resolveForecastSource(ref.refId, owner.call)
        if (!live(owner) || found.status !== "ok" || digestSfValue(found.value.evidence) !== digestSfValue(ref)) return changed()
        const sourceDigest = digestSfValue(found)
        owner.pins.add(() => digestSfValue(found) === sourceDigest)
      }
      return { status: "ok", value: digestSfValue(coverage.value) }
    }, async (result) => {
      if (result.status !== "ok") return result
      const after = await snapshot(owner, runId)
      return after?.kind === "current" && after.digest === before.digest && live(owner) ? result : changed()
    })
    return checked.status === "ok" && live(owner)
      ? { kind: "current", leaf: before.leaf, digest: digestSfValue({ snapshot: before.digest, coverage: checked.value }) } : undefined
  }
  const reuse = async <Value>(runId: string, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>,
    reference: (value: Value) => Calculation | undefined, cached: (proof: Proof) => Value | undefined,
    retain: (proof: Proof, value: Value) => void, forceCanonical = false): Promise<PortResult<Value>> => {
    const owner = local.getStore()
    if (!owner) return work()
    if (owner.call !== call || !live(owner)) { invalidate(owner); return changed() }
    if (owner.busy || owner.proof && owner.proof.runId !== runId) return original(owner, work)
    owner.busy = true
    owner.readers++
    try {
      const before = await fence(owner, runId)
      if (before?.kind === "unsupported" && !owner.proof) {
        owner.busy = false
        return await original(owner, work)
      }
      if (before?.kind !== "current" || owner.proof && owner.proof.witness !== before.digest) { invalidate(owner); return changed() }
      const previous = !forceCanonical && owner.proof ? cached(owner.proof) : undefined
      const result: PortResult<Value> = previous === undefined ? await work() : { status: "ok", value: structuredClone(previous) }
      if (!live(owner)) { invalidate(owner); return changed() }
      if (result.status !== "ok") { invalidate(owner); return result }
      const issued = reference(result.value), valueDigest = digestSfValue(result.value)
      if (!issued || digestSfValue(issued) !== digestSfValue(before.leaf.reference)) { invalidate(owner); return changed() }
      const after = await fence(owner, runId)
      if (after?.kind !== "current" || after.digest !== before.digest || digestSfValue(result.value) !== valueDigest || !live(owner)) { invalidate(owner); return changed() }
      const proof = owner.proof ?? { runId, reference: structuredClone(issued), digest: digestSfValue(issued), witness: after.digest }
      retain(proof, result.value)
      owner.proof = proof
      return result
    } catch { invalidate(owner); return changed() }
    finally { owner.readers--; owner.busy = false }
  }
  const replay = (runId: string, call: TrustedDomainContext, work: () => Promise<PortResult<Calculation>>) =>
    reuse(runId, call, work, (value) => value, (proof) => proof.reference, () => {}, input.requireCanonicalReplay(runId, call))
  const resolve = async (ref: BusinessEvidenceRef, call: TrustedDomainContext,
    work: () => Promise<BusinessEvidenceResolution>): Promise<BusinessEvidenceResolution> => {
    const owner = local.getStore()
    if (!owner || ref.kind !== "calculation") return work()
    const digest = digestSfValue(ref)
    owner.pins.add(() => digestSfValue(ref) === digest)
    const found = await reuse(ref.target.runId, call, async () => ({ status: "ok", value: await work() }),
      (value) => value.state === "fresh" && value.currentRef?.kind === "calculation" && !!value.authorizedProjection &&
        value.accessRevision === call.binding.accessRevision && digestSfValue(value.ref) === digest &&
        digestSfValue(value.currentRef) === digest ? value.currentRef : undefined,
      (proof) => proof.digest === digest ? proof.resolution : undefined,
      (proof, value) => { proof.resolution = structuredClone(value) })
    return found.status === "ok" ? { ...found.value, checkedAt: new Date().toISOString() }
      : { state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }
  }
  const observe = async <Value>(incoming: unknown, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    const parent = local.getStore()
    if (parent) {
      if (parent.call !== call || !live(parent)) { invalidate(parent); return changed() }
      const digest = digestSfValue(incoming)
      parent.pins.add(() => digestSfValue(incoming) === digest)
      parent.children++
      try { return await original(parent, work) }
      finally { parent.children-- }
    }
    if (call.kind !== "ui" || active.has(call) || !nestedPlannerClosure(incoming) || input.host.persistence.currentSnapshots?.()) return work()
    const host = input.host, state = input.state, sources = input.sources, persistence = host.persistence
    const requestFor = host.requestFor, revalidate = host.revalidate, authenticate = host.authenticate, environment = host.environment
    const stateRead = state.read, snapshots = persistence.currentSnapshots, transaction = persistence.transaction, transactionAll = persistence.transactionAll
    const sourceReaders = identities(sources), identity = input.identities, readers = [...identity()]
    const withCase = input.withCalculationCase, locked = input.lockedSourceFences, requireCanonical = input.requireCanonicalReplay
    const request = requestFor(call), binding = call.binding, lease = call.lease
    if (!request || request.signal.aborted) return changed()
    const bindingDigest = digestSfValue([call.kind, binding]), inputDigest = digestSfValue(incoming), requestDigest = requestIdentity(request)
    const current = () => call.kind === "ui" && call.binding === binding && call.lease === lease &&
      digestSfValue([call.kind, call.binding]) === bindingDigest && digestSfValue(incoming) === inputDigest &&
      requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      input.host === host && host.persistence === persistence && host.requestFor === requestFor && host.revalidate === revalidate &&
      host.authenticate === authenticate && host.environment === environment && input.state === state && state.read === stateRead &&
      persistence.currentSnapshots === snapshots && persistence.transaction === transaction && persistence.transactionAll === transactionAll &&
      input.sources === sources && sameIdentities(identities(sources), sourceReaders) && input.identities === identity &&
      sameIdentities(identity(), readers) && input.withCalculationCase === withCase && input.lockedSourceFences === locked &&
      input.requireCanonicalReplay === requireCanonical
    const owner: Owner = { call, current, pins: new Set(), open: true, invalid: false, children: 0, readers: 0, busy: false }
    active.set(call, owner)
    try {
      return await local.run(owner, async () => {
        if (!live(owner) || !await revalidate(call) || !live(owner)) return changed()
        const result = await work()
        if (!live(owner) || owner.children || owner.readers) { invalidate(owner); return changed() }
        if (owner.proof) {
          owner.busy = true
          const final = await fence(owner, owner.proof.runId)
          if (final?.kind !== "current" || final.digest !== owner.proof.witness || !live(owner)) { invalidate(owner); return changed() }
        }
        return result
      })
    } catch { invalidate(owner); return changed() }
    finally { owner.open = false; owner.proof = undefined; owner.pins.clear(); if (active.get(call) === owner) active.delete(call) }
  }
  return { observe, replay, resolve }
}

function leafFor(state: Readonly<SfProductState>, runId: string, call: TrustedDomainContext): Leaf | undefined {
  const stored = state.decisionResults?.[runId]
  const record = object(state.preferences["sf:proposal-coverage:scenario-request:" + digestSfValue(runId)])
  if (!stored || stored.kind !== "scenario" || record.schema !== "sf-scenario-request-v1" || record.resultRef !== runId ||
    record.engineVersion !== "planner-runtime-v1" || record.requestDigest !== stored.requestDigest || record.resultDigest !== stored.resultDigest ||
    record.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "recordDigest")))) return undefined
  const parsed = decodeSfOperationInput("sf_scenario_simulate", record.request)
  const selected = state.cases[stored.caseRef.id]
  if (!parsed.ok || parsed.value.assumptions.length || parsed.value.operations.length || digestSfValue(parsed.value) !== stored.requestDigest ||
    digestSfValue(record.caseRef) !== digestSfValue(stored.caseRef) || stored.resultDigest !== digestSfValue(stored.result) ||
    !selected || selected.incarnation !== stored.caseRef.incarnation || selected.version !== stored.caseRef.version ||
    !selected.participants.includes(call.binding.principalRef)) return undefined
  const refs = plannerRecords([stored, record])
  if (!refs?.length || !refs.some((ref) => ref.refId === parsed.value.baseRef)) return undefined
  const initial: Calculation = { schema: "sf-evidence-v1", kind: "calculation", refId: "planner-calculation:" + encodeURIComponent(runId),
    installationId: call.binding.installationId, projectId: call.binding.projectId, refDigest: "", evidenceLevel: "proposal",
    target: { calculationId: "planner:scenario", runId, engineVersion: "planner-runtime-v1", inputDigest: stored.requestDigest,
      resultDigest: stored.resultDigest, sourceRefs: stored.sourceRefs, period: stored.result.horizon, currency: stored.result.currency } }
  return { caseRef: structuredClone(stored.caseRef), baseRef: parsed.value.baseRef, refs,
    reference: { ...initial, refDigest: digestSfEvidenceRef(initial) } }
}
function evidence(value: unknown): readonly BusinessEvidenceRef[] | undefined {
  const found: BusinessEvidenceRef[] = [], seen = new Set<object>()
  const visit = (item: unknown, depth: number): boolean => {
    if (!item || typeof item !== "object") return true
    if (depth > 64 || seen.has(item)) return false
    seen.add(item)
    let valid = true
    if (!Array.isArray(item) && "schema" in item && item.schema === "sf-evidence-v1") found.push(item as BusinessEvidenceRef)
    else valid = Object.values(item).every((child) => visit(child, depth + 1))
    seen.delete(item)
    return valid
  }
  try { if (!visit(value, 0)) return undefined; sfEvidenceSourceMaps(found); return found } catch { return undefined }
}
function plannerRecords(value: unknown): readonly RecordRef[] | undefined {
  const refs = evidence(value)
  if (!refs?.length || refs.some((ref) => ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version")) return undefined
  return [...new Map((refs as readonly RecordRef[]).map((ref) => [digestSfValue(ref), ref])).values()]
}
function nestedPlannerClosure(value: unknown) {
  const refs = evidence(value)
  let nested = false
  const visit = (ref: BusinessEvidenceRef): boolean => {
    if (ref.kind === "record") return ref.target.surface === "planner" && ref.target.recordType === "planner-version"
    if (ref.kind === "case-event") { nested = true; return ref.target.evidenceRefs.every(visit) }
    if (ref.kind === "calculation" && ref.target.calculationId === "planner:scenario" && ref.target.engineVersion === "planner-runtime-v1") {
      if (ref.target.sourceRefs.some((source) => source.kind !== "record")) nested = true
      return ref.target.sourceRefs.every(visit)
    }
    return false
  }
  return !!refs?.length && refs.every(visit) && nested
}
/** Same zero-write admission as the installed Planner source producer. */
function materialized(ref: RecordRef, call: TrustedDomainContext, snapshot: Snapshot,
  principal: NonNullable<Awaited<ReturnType<DomainPortHost["authenticate"]>>>) {
  const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
  const selector = sfPlannerProjectionSelector(snapshot, { id: principal.id, roles,
    canWrite: principal.canWrite && roles.some((role) => role !== "viewer") })
  const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision,
    policyVersion: call.binding.policyVersion, recordType: "planner-version", recordId: ref.target.recordId, selector }
  const entry = snapshot.sfSources?.scopes?.[digestSfValue(scope)]
  const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId), identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectSfSourceScope("planner", snapshot, scope)
  if (!entry || !source || !identity || !projection || typeof projection !== "object" || Array.isArray(projection) ||
    identity.incarnation !== entry.incarnation || identity.version !== entry.version || identity.inputDigest !== digestSfValue(projection)) return false
  const expected = sfPlannerEvidenceRef({ versionId: scope.recordId, projection: projection as Record<string, unknown>, identity }, call)
  return !!expected && digestSfValue(expected) === digestSfValue(ref) &&
    digestSfValue(entry) === digestSfValue({ scope, sourceIncarnation: source.incarnation, incarnation: entry.incarnation,
      alive: true, inputDigest: identity.inputDigest, version: entry.version })
}
function identities(value: object): readonly unknown[] { return [value, ...Object.entries(value).flatMap(([key, item]) => [key, item])] }
function sameIdentities(left: readonly unknown[], right: readonly unknown[]) { return left.length === right.length && left.every((value, index) => value === right[index]) }
function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
function dayOf(at: string) { const parsed = Date.parse(at); return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : undefined }
