import { AsyncLocalStorage } from "node:async_hooks"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { approvalStageEntry } from "../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import type { RequestView } from "../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { Period, ProductContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { procurementRequestFields, projectProcurementScope } from "../../../../modules/sucafina/Sucafinav1/product/procurement/source-projection.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type Witness = { kind: "sf-procurement-evidence-fence"; digest: string; snapshots: string; sources: string;
  environment: string; principal: string }
type Fence = Witness | { kind: "unsupported" } | { kind: "changed" }

export type SfProcurementRecordReadScopeInput = {
  host: DomainPortHost
  state: SfProductStatePort
  contextFor: (call: TrustedDomainContext) => Promise<PortResult<ProductContext>>
  selection: (call: TrustedDomainContext) => { period: Period; expiresAt: number } | undefined
  readerIdentity: () => object | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}
export type SfProcurementRecordObservation<Value> =
  | { kind: "observed"; value: Value }
  | { kind: "unsupported" }
  | { kind: "changed" }

type Dependencies = Pick<SfProcurementRecordReadScopeInput, "host" | "state" | "contextFor" | "selection" | "lockedSourceFences"> & {
  persistence: DomainPortHost["persistence"]
  snapshots: DomainPortHost["persistence"]["currentSnapshots"]
}
type Participation = { dependencies: Dependencies; call: TrustedDomainContext; request: Request; current: () => boolean;
  refs: ReadonlySet<string>; witness: Witness; pins: Set<() => boolean>; parent?: Participation;
  open: boolean; accepting: boolean; invalid: boolean; children: number }

// Only this module can establish an owner, after its complete witness under the
// actual read transaction. Snapshot availability alone is never a capability.
const participation = new AsyncLocalStorage<Participation>()

/** Group one complete canonical read only when every current source scope is already materialized. */
export function createSfProcurementRecordReadScope(input: SfProcurementRecordReadScopeInput) {
  return async <Value>(incoming: readonly BusinessEvidenceRef[], call: TrustedDomainContext,
    work: () => Promise<Value>): Promise<SfProcurementRecordObservation<Value>> => {
    const parent = participation.getStore()
    if (parent && (!live(parent) || !parent.accepting)) return changed(parent)
    if (call.kind !== "ui" || !input.host.persistence.currentSnapshots || !incoming.length) return parent ? changed(parent) : { kind: "unsupported" }
    const selected = structuredClone(incoming).filter(procurementRecord)
    if (selected.length !== incoming.length) return parent ? changed(parent) : { kind: "unsupported" }
    const readerIdentity = input.readerIdentity
    const request = input.host.requestFor(call), selection = input.selection(call), reader = readerIdentity()
    if (!request || request.signal.aborted) return changed(parent)
    if (!selection || !reader) return parent ? changed(parent) : { kind: "unsupported" }
    const requestDigest = requestIdentity(request), binding = digestSfValue([call.kind, call.binding])
    const lease = call.lease, bindingIdentity = call.binding
    const incomingDigest = digestSfValue(incoming), selectionDigest = digestSfValue(selection)
    const dependencies: Dependencies = { host: input.host, state: input.state, contextFor: input.contextFor,
      selection: input.selection, lockedSourceFences: input.lockedSourceFences, persistence: input.host.persistence,
      snapshots: input.host.persistence.currentSnapshots }
    const current = () => input.host.requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      call.lease === lease && call.binding === bindingIdentity && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(incoming) === incomingDigest &&
      input.selection(call) === selection && selection.expiresAt > Date.now() && digestSfValue(selection) === selectionDigest &&
      input.readerIdentity === readerIdentity && readerIdentity() === reader &&
      sameDependencies(dependencies, { host: input.host, state: input.state, contextFor: input.contextFor, selection: input.selection,
        lockedSourceFences: input.lockedSourceFences, persistence: input.host.persistence, snapshots: input.host.persistence.currentSnapshots })
    const environment = async () => {
      const value = await input.host.environment(request)
      const at = Date.parse(value.at)
      return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
        bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
    }
    const completed: { owner?: Participation } = {}
    if (parent) parent.children++
    try {
      if (parent && sameDependencies(parent.dependencies, dependencies)) {
        // Full references, not refId/currentRef, define the admitted closure.
        // A changed inner call must poison its owner even if a caller restores
        // mutable headers/auth/environment before the owner's final witness.
        if (parent.call !== call || parent.request !== request || !selected.every((ref) => parent.refs.has(digestSfValue(ref))))
          return changed(parent)
        const pinned = () => live(parent) && parent.accepting && current() &&
          digestSfValue(input.host.persistence.currentSnapshots?.()) === parent.witness.snapshots &&
          digestSfValue(input.lockedSourceFences()) === parent.witness.sources
        const boundary = async () => {
          if (!pinned() || !await input.host.revalidate(call) || !pinned()) return false
          const before = await environment()
          if (!before || digestSfValue(before) !== parent.witness.environment || !pinned()) return false
          // currentSnapshots returns defensive copies. Reopen it after the
          // awaited environment call; compare bytes, never object identity.
          const locked = input.host.persistence.currentSnapshots?.()
          if (!locked || digestSfValue(locked) !== parent.witness.snapshots) return false
          const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") })
          if (!principal || digestSfValue(principal) !== parent.witness.principal || !pinned()) return false
          const after = await environment()
          return !!after && digestSfValue(after) === parent.witness.environment && pinned() && await input.host.revalidate(call) && pinned()
        }
        if (!await boundary()) return changed(parent)
        const value = await work()
        if (!await boundary()) return changed(parent)
        parent.pins.add(current)
        // Every child executes its actual canonical producer. No projection,
        // pending Promise, authorization result or environment value is reused.
        return { kind: "observed", value: structuredClone(value) }
      }
      const enteredEnvironment = await environment()
      if (!enteredEnvironment || !current() || !await input.host.revalidate(call) || !current()) return changed(parent)
      const environmentDigest = digestSfValue(enteredEnvironment)
      const snapshot = async (): Promise<Fence> => {
        if (!current() || !await input.host.revalidate(call) || !current()) return { kind: "changed" }
        // The canonical archive reader already requires preferences authority.
        // The private witness covers all C08 bytes, including Atlas captures.
        const found = await input.state.read(request, "preferences", async (state, actor): Promise<Fence> => {
          if (!current() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
            actor.policyVersion !== call.binding.policyVersion) return { kind: "changed" }
          const locked = input.host.persistence.currentSnapshots?.(), sources = input.lockedSourceFences()
          if (!locked || !sources) return { kind: "unsupported" }
          const snapshotDigest = digestSfValue(locked)
          const before = await environment()
          const context = await input.contextFor(call)
          const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") })
          if (!before || digestSfValue(before) !== environmentDigest || !principal || principal.id !== actor.principalRef ||
            principal.id.startsWith("local:") || !current()) return { kind: "changed" }
          if (context.status !== "ok") return { kind: "unsupported" }
          if (context.value.surface !== "procurement" || context.value.installationId !== call.binding.installationId ||
            context.value.projectId !== call.binding.projectId || context.value.principalRef !== actor.principalRef ||
            context.value.accessRevision !== actor.accessRevision || context.value.policyVersion !== actor.policyVersion ||
            digestSfValue(context.value.period) !== digestSfValue(selection.period)) return { kind: "changed" }
          const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
          if (!selected.every((ref) => materialized(ref, call, locked.procurement, context.value, roles, principal.canWrite))) return { kind: "unsupported" }
          const after = await environment()
          const again = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") })
          if (!after || digestSfValue(after) !== environmentDigest || digestSfValue(principal) !== digestSfValue(again) ||
            !await input.host.revalidate(call) || !current() || snapshotDigest !== digestSfValue(input.host.persistence.currentSnapshots?.()) ||
            digestSfValue(sources) !== digestSfValue(input.lockedSourceFences())) return { kind: "changed" }
          return { kind: "sf-procurement-evidence-fence", snapshots: snapshotDigest, sources: digestSfValue(sources),
            environment: environmentDigest, principal: digestSfValue(principal),
            digest: digestSfValue({ state, snapshots: snapshotDigest, sources, principal,
              context: context.value, environment: enteredEnvironment, selection, request: requestDigest, binding, input: incomingDigest }) }
        })
        const finalEnvironment = await environment()
        if (!finalEnvironment || digestSfValue(finalEnvironment) !== environmentDigest || !await input.host.revalidate(call) || !current())
          return { kind: "changed" }
        // Missing archive authority/state is not an extra grant or a new
        // prerequisite for the canonical fresh-source fallthrough.
        return found.status === "ok" ? found.value : { kind: "unsupported" }
      }
      const result = await input.host.persistence.transaction<SfProcurementRecordObservation<Value>>("dashboard", async () => {
        const before = await snapshot()
        // Only absence of the zero-write closure before canonical work may
        // return to the ordinary producer outside this root.
        if (before.kind === "unsupported") return { commit: false, value: { kind: "unsupported" } }
        if (before.kind !== "sf-procurement-evidence-fence" || !current()) return { commit: false, value: changed(parent) }
        const scope: Participation = { dependencies, call, request, current, refs: new Set(selected.map((ref) => digestSfValue(ref))),
          witness: before, pins: new Set(), parent, open: true, accepting: true, invalid: false, children: 0 }
        completed.owner = scope
        try {
          return await participation.run(scope, async () => {
            if (!live(scope)) return { commit: false, value: changed(scope) }
            const value = await work()
            scope.accepting = false
            // Detached children cannot outlive the owner or make an otherwise
            // successful parent return while canonical work is still pending.
            if (scope.children || !live(scope)) return { commit: false, value: changed(scope) }
            const after = await snapshot()
            if (after.kind !== "sf-procurement-evidence-fence" || after.digest !== before.digest || !live(scope))
              return { commit: false, value: changed(scope) }
            // Preserve every canonical result, including undefined, without caching it.
            return { commit: false, value: { kind: "observed" as const, value: structuredClone(value) } }
          })
        } finally { scope.accepting = false; scope.open = false }
      }, { signal: request.signal })
      const owner = completed.owner
      // Closing lexical admission is separate from releasing pins. A real
      // persistence wrapper may yield after the protected callback returns;
      // readers/inputs remain bound through that final awaited egress.
      if (!current() || result.kind === "changed" || owner && (owner.invalid || owner.children || ![...owner.pins].every((pin) => pin())) ||
        parent && (!live(parent) || !parent.accepting)) return changed(owner ?? parent)
      if (result.kind === "observed") {
        if (!owner) return changed(parent)
        // A separately qualified nested owner also retains its completed
        // readers/inputs until the surrounding root's final egress.
        if (parent) {
          parent.pins.add(current)
          for (const pin of owner.pins) parent.pins.add(pin)
        }
      }
      return result
    } catch {
      // A nested writer poisons the actual LocalStore root. Never retry it or
      // any canonical failure outside the scope after execution has begun.
      return changed(parent)
    } finally { completed.owner?.pins.clear(); if (parent) parent.children-- }
  }
}

function sameDependencies(left: Dependencies, right: Dependencies) {
  return left.host === right.host && left.state === right.state && left.persistence === right.persistence && left.snapshots === right.snapshots &&
    left.contextFor === right.contextFor && left.selection === right.selection && left.lockedSourceFences === right.lockedSourceFences
}

function live(scope: Participation): boolean {
  return scope.open && !scope.invalid && scope.current() && [...scope.pins].every((pin) => pin()) && (!scope.parent || live(scope.parent))
}

function changed(scope?: Participation): { kind: "changed" } {
  for (let owner = scope; owner; owner = owner.parent) owner.invalid = true
  return { kind: "changed" }
}

/** Predict only that issueForActor's current scope needs no write; the producer still proves history. */
function materialized(ref: RecordRef, call: TrustedDomainContext, snapshot: Snapshot, context: ProductContext, roles: string[], canWrite: boolean) {
  if (ref.schema !== "sf-evidence-v1" || ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== call.binding.installationId ||
    ref.projectId !== call.binding.projectId || digestSfValue(ref.target.fields) !== digestSfValue(procurementRequestFields) ||
    digestSfValue(ref.target.period) !== digestSfValue(context.period) || !/^[A-Z]{3}$/.test(context.currency)) return false
  const record = object(object(object(snapshot.data.store).requests)[ref.target.recordId]).request
  if (!record || approvalStageEntry(record as RequestView)) return false
  const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
    recordType: "procurement-request", recordId: ref.target.recordId, selector: { kind: "procurement-record-v1", roles,
      canWrite: canWrite && roles.some((role) => role !== "viewer"), roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")),
      fields: [...procurementRequestFields], period: context.period, currency: context.currency } }
  // Historical incarnation/version stays on ref. The no-write check is for
  // the current actor's exact key, never for the original archived selector.
  const entry = snapshot.sfSources?.scopes?.[digestSfValue(scope)]
  const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId), identity = sfScopedSourceIdentity(snapshot, scope)
  const projection = projectProcurementScope("procurement", snapshot, scope)
  if (!entry || !source || !identity || projection === undefined || identity.incarnation !== entry.incarnation || identity.version !== entry.version ||
    identity.inputDigest !== digestSfValue(projection)) return false
  return digestSfValue(entry) === digestSfValue({ scope, sourceIncarnation: source.incarnation, incarnation: entry.incarnation,
    alive: true, inputDigest: identity.inputDigest, version: entry.version })
}

function procurementRecord(ref: BusinessEvidenceRef): ref is RecordRef {
  return ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" &&
    ref.refId.startsWith("sf-procurement:")
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
