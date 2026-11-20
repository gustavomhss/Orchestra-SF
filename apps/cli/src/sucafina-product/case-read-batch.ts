import { AsyncLocalStorage } from "node:async_hooks"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
export type SfCaseReadBatchSourceScope = {
  current: () => boolean
  dependencies: (value: DecisionCase) => readonly RecordRef[] | undefined
  witness: (refs: readonly RecordRef[], snapshots: Record<"dashboard" | "planner" | "procurement", Snapshot>,
    plannerPrincipal: NonNullable<Awaited<ReturnType<DomainPortHost["authenticate"]>>>) =>
    Promise<{ kind: "current"; value: unknown } | { kind: "unsupported" | "changed" }>
}
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

/** Common physical owner. Domain adapters prove the zero-write source closure;
 * every canonical callback and the fresh external C08/C02 witness remain here. */
export function createSfCaseReadBatch(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  readerIdentity: () => BusinessContextService | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}, admission: {
  kind: "planner" | "mixed" | "dashboard"
  identity: () => readonly unknown[]
  forCall: (call: TrustedDomainContext) => SfCaseReadBatchSourceScope | undefined
}): DecisionCasePort["read"] {
  const kind = admission.kind
  const local = new AsyncLocalStorage<Owner>()
  const active = new WeakMap<TrustedDomainContext, Owner>()
  const unavailable = (): ReadResult => ({ status: "unavailable", reason: kind + "-case-observation-changed" })
  const deny = (): ReadResult => ({ status: "denied", reason: kind + "-case-invocation-unavailable" })
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
    const sourceIdentity = admission.identity, identities = [...sourceIdentity()], sourcesForCall = admission.forCall
    const sources = sourcesForCall(call)
    if (!sources) return input.read(incoming, call)
    const sourceCurrent = sources.current, dependencies = sources.dependencies, sourceWitness = sources.witness
    const resolve = reader.resolve, context = reader.context, canonical = input.read
    const stateRead = input.state.read, transaction = persistence.transaction
    const requestFor = host.requestFor, revalidate = host.revalidate, authenticate = host.authenticate, environmentFor = host.environment
    const sourceFences = input.lockedSourceFences
    const current = () => admission.kind === kind && call.binding === binding && call.lease === lease && call.kind === "ui" &&
      digestSfValue([call.kind, call.binding]) === bindingDigest && digestSfValue(incoming) === digest &&
      host.requestFor === requestFor && host.revalidate === revalidate && host.authenticate === authenticate && host.environment === environmentFor &&
      requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      input.host === host && host.persistence === persistence && persistence.readSnapshotRoot === root && persistence.currentSnapshots === snapshots &&
      persistence.transaction === transaction && input.state.read === stateRead && input.read === canonical &&
      admission.identity === sourceIdentity && sameIdentities(sourceIdentity(), identities) && admission.forCall === sourcesForCall &&
      sources.current === sourceCurrent && sources.dependencies === dependencies && sources.witness === sourceWitness && sourceCurrent() &&
      input.readerIdentity === readerIdentity && readerIdentity() === reader &&
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
        const refs = dependencies(value), locked = snapshots(), fences = sourceFences()
        if (!refs?.length || !locked || !fences) return { kind: "unsupported" }
        const protectedDigest = digestSfValue({ state, snapshots: locked, sources: fences })
        const before = await environment()
        const principal = structuredClone(await authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") }))
        if (!before || !principal || principal.id !== actor.principalRef || principal.id.startsWith("local:") || !live(owner))
          return changed(owner)
        const qualified = await sourceWitness(refs, locked, principal)
        if (!live(owner)) return changed(owner)
        if (qualified.kind !== "current") return qualified
        const after = await environment()
        const again = await authenticate(request, { surface: "planner", roleMap: roleMap(locked.planner, "planner") })
        if (!after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(principal) !== digestSfValue(again) ||
          !await revalidate(call) || !live(owner) || protectedDigest !== digestSfValue({ state, snapshots: snapshots(), sources: sourceFences() }))
          return changed(owner)
        return { kind: "current", caseDigest: digestSfValue(value),
          digest: digestSfValue({ protectedDigest, principal, sources: qualified.value, environment: after, input: digest, request: requestDigest, binding: bindingDigest }) }
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

function sameIdentities(left: readonly unknown[], right: readonly unknown[]) { return left.length === right.length && left.every((value, index) => value === right[index]) }
function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
