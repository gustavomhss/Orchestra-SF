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
type Fence = { kind: "sf-procurement-evidence-fence"; digest: string } | { kind: "unsupported" } | { kind: "changed" }

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

/** Group one complete canonical read only when every current source scope is already materialized. */
export function createSfProcurementRecordReadScope(input: SfProcurementRecordReadScopeInput) {
  return async <Value>(incoming: readonly BusinessEvidenceRef[], call: TrustedDomainContext,
    work: () => Promise<Value>): Promise<SfProcurementRecordObservation<Value>> => {
    if (call.kind !== "ui" || !input.host.persistence.currentSnapshots || !incoming.length) return { kind: "unsupported" }
    const selected = structuredClone(incoming).filter(procurementRecord)
    if (selected.length !== incoming.length) return { kind: "unsupported" }
    const request = input.host.requestFor(call), selection = input.selection(call), reader = input.readerIdentity()
    if (!request || request.signal.aborted) return { kind: "changed" }
    if (!selection || !reader) return { kind: "unsupported" }
    const requestDigest = requestIdentity(request), binding = digestSfValue([call.kind, call.binding])
    const lease = call.lease, bindingIdentity = call.binding
    const incomingDigest = digestSfValue(incoming), selectionDigest = digestSfValue(selection)
    const current = () => input.host.requestFor(call) === request && !request.signal.aborted && requestIdentity(request) === requestDigest &&
      call.lease === lease && call.binding === bindingIdentity && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(incoming) === incomingDigest &&
      input.selection(call) === selection && selection.expiresAt > Date.now() && digestSfValue(selection) === selectionDigest && input.readerIdentity() === reader
    const environment = async () => {
      const value = await input.host.environment(request)
      const at = Date.parse(value.at)
      return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
        bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
    }
    try {
      const enteredEnvironment = await environment()
      if (!enteredEnvironment || !current() || !await input.host.revalidate(call) || !current()) return { kind: "changed" }
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
          return { kind: "sf-procurement-evidence-fence", digest: digestSfValue({ state, snapshots: snapshotDigest, sources, principal,
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
        if (before.kind !== "sf-procurement-evidence-fence" || !current()) return { commit: false, value: { kind: "changed" } }
        const value = await work()
        const after = await snapshot()
        if (after.kind !== "sf-procurement-evidence-fence" || after.digest !== before.digest || !current())
          return { commit: false, value: { kind: "changed" } }
        // Preserve every canonical result, including undefined, without caching it.
        return { commit: false, value: { kind: "observed", value: structuredClone(value) } }
      }, { signal: request.signal })
      if (!current()) return { kind: "changed" }
      return result
    } catch {
      // A nested writer poisons the actual LocalStore root. Never retry it or
      // any canonical failure outside the scope after execution has begun.
      return { kind: "changed" }
    }
  }
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
