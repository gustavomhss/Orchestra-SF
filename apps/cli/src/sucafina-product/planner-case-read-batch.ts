import { AsyncLocalStorage } from "node:async_hooks"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { sfPlannerEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { sfPlannerCaseDependencies } from "./planner-case-read-scope.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type Witness = { kind: "current"; digest: string; caseDigest: string }
type Fence = Witness | { kind: "unsupported" | "changed" }
type ReadResult = PortResult<AuthorizedCaseProjection>
type Observed = { kind: "read"; value: ReadResult; witness: Witness } | { kind: "unsupported" | "changed" }
type Owner = {
  call: TrustedDomainContext
  selected: { id: string; incarnation: string }
  current: () => boolean
  snapshot: () => Promise<Fence>
  pins: Set<() => boolean>
  witness?: Witness
  open: boolean
  accepting: boolean
  invalid: boolean
  children: number
}

/** Group physical reads, never canonical proofs. Each call still executes both
 * case/source/operation observations and reopens a fresh C08/C02 witness after
 * the SQLite read root has ended. Unmaterialized or mixed sources stay canonical. */
export function createSfPlannerCaseReadBatch(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  sources: Pick<PlannerSourceHost, "resolveForecastSource">
  readerIdentity: () => BusinessContextService | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}): DecisionCasePort["read"] {
  const local = new AsyncLocalStorage<Owner>()
  const active = new WeakMap<TrustedDomainContext, Owner>()
  const unavailable = (): ReadResult => ({ status: "unavailable", reason: "planner-case-observation-changed" })
  const deny = (): ReadResult => ({ status: "denied", reason: "planner-case-invocation-unavailable" })
  const changed = (owner: Owner): { kind: "changed" } => { owner.invalid = true; return { kind: "changed" } }
  const live = (owner: Owner) => owner.open && !owner.invalid && local.getStore() === owner &&
    active.get(owner.call) === owner && owner.current() && [...owner.pins].every((pin) => pin())

  const read: DecisionCasePort["read"] = async (incoming, call) => {
    const parent = local.getStore(), existing = active.get(call)
    const selected = parseCaseRef(incoming.caseRef)
    if (parent) {
      if (existing !== parent || !live(parent) || !parent.accepting || !selected ||
        selected.id !== parent.selected.id || selected.incarnation !== parent.selected.incarnation || !parent.witness) {
        changed(parent)
        return deny()
      }
      const digest = digestSfValue(incoming)
      const pin = () => digestSfValue(incoming) === digest
      parent.pins.add(pin)
      parent.children++
      try {
        const before = await parent.snapshot()
        if (!live(parent) || !pin() || before.kind !== "current" || before.digest !== parent.witness.digest) {
          changed(parent)
          return unavailable()
        }
        // A nested canonical reader performs its own complete checks. Its
        // argument remains pinned through the outer fresh egress witness.
        const value = await input.read(incoming, call)
        const after = await parent.snapshot()
        if (!live(parent) || !pin() || after.kind !== "current" || after.digest !== before.digest ||
          value.status === "ok" && digestSfValue(value.value.case) !== after.caseDigest) {
          changed(parent)
          return unavailable()
        }
        return structuredClone(value)
      } catch {
        changed(parent)
        return unavailable()
      } finally { parent.children-- }
    }
    if (existing) return deny()
    const host = input.host, persistence = host.persistence
    const root = persistence.readSnapshotRoot, snapshots = persistence.currentSnapshots
    // A root owned by another canonical consumer already controls its reads.
    // Never infer this module's authority from snapshot availability.
    if (call.kind !== "ui" || !selected || !root || !snapshots || snapshots()) return input.read(incoming, call)
    const request = host.requestFor(call), readerIdentity = input.readerIdentity, reader = readerIdentity()
    if (!request || request.signal.aborted || !reader) return input.read(incoming, call)
    const digest = digestSfValue(incoming), requestDigest = requestIdentity(request)
    const binding = call.binding, bindingDigest = digestSfValue([call.kind, binding]), lease = call.lease
    const resolve = reader.resolve, context = reader.context, canonical = input.read, source = input.sources.resolveForecastSource
    const stateRead = input.state.read, transaction = persistence.transaction
    const requestFor = host.requestFor, revalidate = host.revalidate, authenticate = host.authenticate, environmentFor = host.environment
    const sourceFences = input.lockedSourceFences
    const current = () => call.binding === binding && call.lease === lease && call.kind === "ui" &&
      digestSfValue([call.kind, call.binding]) === bindingDigest && digestSfValue(incoming) === digest &&
      host.requestFor === requestFor && host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environmentFor &&
      requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      input.host === host && host.persistence === persistence && persistence.readSnapshotRoot === root && persistence.currentSnapshots === snapshots &&
      persistence.transaction === transaction && input.state.read === stateRead && input.read === canonical &&
      input.sources.resolveForecastSource === source && input.readerIdentity === readerIdentity && readerIdentity() === reader &&
      reader.resolve === resolve && reader.context === context && input.lockedSourceFences === sourceFences
    const environment = async () => {
      const value = await environmentFor(request)
      const at = Date.parse(value.at)
      return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
        bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
    }
    const owner: Owner = { call, selected, current, snapshot: async () => ({ kind: "changed" }),
      pins: new Set(), open: true, accepting: false, invalid: false, children: 0 }
    owner.snapshot = async (): Promise<Fence> => {
      if (!live(owner) || !await revalidate(call) || !live(owner)) return changed(owner)
      const found = await stateRead(request, "cases", async (state, actor): Promise<Fence> => {
        if (!live(owner) || actor.principalRef !== binding.principalRef || actor.accessRevision !== binding.accessRevision ||
          actor.policyVersion !== binding.policyVersion) return changed(owner)
        const value = state.cases[selected.id]
        if (!value || value.id !== selected.id || value.incarnation !== selected.incarnation ||
          !value.participants.includes(actor.principalRef)) return { kind: "unsupported" }
        const refs = sfPlannerCaseDependencies(value), locked = snapshots(), fences = sourceFences()
        if (!refs?.length || !locked || !fences) return { kind: "unsupported" }
        const protectedDigest = digestSfValue({ state, snapshots: locked, sources: fences })
        const before = await environment()
        const principal = structuredClone(await authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") }))
        if (!before || !principal || principal.id !== actor.principalRef || principal.id.startsWith("local:") || !live(owner))
          return changed(owner)
        if (!refs.every((ref) => materialized(ref, call, locked.planner, principal))) return { kind: "unsupported" }
        const after = await environment()
        const again = await authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") })
        if (!after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(principal) !== digestSfValue(again) ||
          !await revalidate(call) || !live(owner) || protectedDigest !== digestSfValue({ state, snapshots: snapshots(), sources: sourceFences() }))
          return changed(owner)
        return { kind: "current", caseDigest: digestSfValue(value),
          digest: digestSfValue({ protectedDigest, principal, environment: after, input: digest, request: requestDigest, binding: bindingDigest }) }
      })
      if (!live(owner) || !await revalidate(call) || !live(owner)) return changed(owner)
      return found.status === "ok" ? found.value : { kind: "unsupported" }
    }
    active.set(call, owner)
    let result: Observed
    try {
      result = await local.run(owner, async (): Promise<Observed> => {
        if (!live(owner)) return changed(owner)
        const observed = await root(async (): Promise<Observed> => {
          const before = await owner.snapshot()
          // Fall through only before canonical execution has started.
          if (before.kind === "unsupported") return { kind: "unsupported" }
          if (before.kind !== "current" || !live(owner)) return changed(owner)
          owner.witness = before
          owner.accepting = true
          const value = await canonical(incoming, call)
          owner.accepting = false
          if (owner.children || !live(owner)) return changed(owner)
          const after = await owner.snapshot()
          if (after.kind !== "current" || after.digest !== before.digest || !live(owner) ||
            value.status === "ok" && digestSfValue(value.value.case) !== after.caseDigest) return changed(owner)
          return { kind: "read", value: structuredClone(value), witness: after }
        }, { signal: request.signal })
        if (!live(owner) || owner.children) return changed(owner)
        if (observed.kind !== "read") return observed
        // The SQLite snapshot above is closed. This read starts a new physical
        // observation, so a committed source/case change at egress cannot pass
        // by comparing two views of the same old snapshot.
        if (snapshots()) return changed(owner)
        const fresh = await owner.snapshot()
        if (fresh.kind !== "current" || fresh.digest !== observed.witness.digest || !live(owner) ||
          !await revalidate(call) || !live(owner)) return changed(owner)
        return observed
      })
    } catch {
      // LocalStore poisons a read root even when a nested writer catches its
      // own error. Never execute canonical work again after entering the root.
      result = changed(owner)
    } finally {
      owner.accepting = false
      owner.open = false
      owner.pins.clear()
      if (active.get(call) === owner) active.delete(call)
    }
    return result.kind === "unsupported" ? canonical(incoming, call) : result.kind === "read" ? result.value : unavailable()
  }
  return read
}

/** Prove only that the exact current actor scope needs no C02 write. The actual
 * source producer still opens and verifies it twice inside each canonical read. */
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
    identity.incarnation !== entry.incarnation || identity.version !== entry.version || identity.inputDigest !== digestSfValue(projection))
    return false
  const expected = sfPlannerEvidenceRef({ versionId: scope.recordId, projection: projection as Record<string, unknown>, identity }, call)
  return !!expected && digestSfValue(expected) === digestSfValue(ref) &&
    digestSfValue(entry) === digestSfValue({ scope, sourceIncarnation: source.incarnation, incarnation: entry.incarnation,
      alive: true, inputDigest: identity.inputDigest, version: entry.version })
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
