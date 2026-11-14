import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { approvalStageEntry } from "../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import type { RequestView } from "../../../../modules/sucafina/Sucafinav1/src/procurement-screen.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type Fence = { kind: "sf-scenario-procurement-fence"; digest: string } | { kind: "unsupported" } | { kind: "changed" }

/** A witness for completed, duplicate fresh Procurement observations in one guard invocation. */
export function createSfScenarioProcurementProofScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  selection: (call: TrustedDomainContext) => { period: Period; expiresAt: number } | undefined
  readerIdentity: () => object | undefined
  isCurrentRecord: (snapshot: Snapshot, evidence: RecordRef) => boolean
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
}) {
  return (value: DecisionCase, call: TrustedDomainContext) => {
    if (call.kind !== "ui") return undefined
    const records = procurementRecords(value)
    const request = input.host.requestFor(call), selection = input.selection(call), reader = input.readerIdentity()
    if (!records?.length || !request || !selection || !reader) return undefined
    const valueDigest = digestSfValue(value), binding = digestSfValue([call.kind, call.binding])
    const requestDigest = requestIdentity(request), selectionDigest = digestSfValue(selection)
    const life = { open: true }
    const current = () => life.open && call.kind === "ui" && input.host.requestFor(call) === request && !request.signal.aborted &&
      requestIdentity(request) === requestDigest && digestSfValue([call.kind, call.binding]) === binding && digestSfValue(value) === valueDigest &&
      input.selection(call) === selection && selection.expiresAt > Date.now() && digestSfValue(selection) === selectionDigest && input.readerIdentity() === reader
    const environment = async () => {
      const observed = await input.host.environment(request)
      const at = Date.parse(observed.at)
      return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(observed.directory),
        bankKey: observed.bankKey ? Array.from(observed.bankKey) : undefined } : undefined
    }
    const snapshot = async (): Promise<Fence> => {
      if (!current() || !await input.host.revalidate(call) || !current()) return { kind: "changed" }
      const found = await input.state.read(request, "cases", async (state, actor): Promise<Fence> => {
        if (!current() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision ||
          actor.policyVersion !== call.binding.policyVersion) return { kind: "changed" }
        const stored = state.cases[value.id]
        if (!stored || stored.id !== value.id || stored.incarnation !== value.incarnation || !stored.participants.includes(actor.principalRef) ||
          digestSfValue(stored) !== valueDigest) return { kind: "changed" }
        const locked = input.host.persistence.currentSnapshots?.(), sources = input.lockedSourceFences()
        if (!locked || !sources) return { kind: "unsupported" }
        // Eligibility uses the actual published source predicate. It never
        // substitutes for the guard's two canonical BCS resolutions below.
        if (records.some((ref) => {
          const record = object(object(object(locked.procurement.data.store).requests)[ref.target.recordId]).request
          return !record || !input.isCurrentRecord(locked.procurement, ref) || approvalStageEntry(record as RequestView)
        })) return { kind: "unsupported" }
        const productDigest = digestSfValue(locked.dashboard.data.__sfProductV1)
        const before = await environment()
        const principal = structuredClone(await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") }))
        if (!before || !principal || principal.id !== actor.principalRef || principal.id.startsWith("local:") || !current()) return { kind: "changed" }
        const after = await environment()
        const again = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(locked.procurement, "procurement") })
        if (!after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(principal) !== digestSfValue(again) ||
          !await input.host.revalidate(call) || !current() || productDigest !== digestSfValue(input.host.persistence.currentSnapshots?.()?.dashboard.data.__sfProductV1) ||
          digestSfValue(sources) !== digestSfValue(input.lockedSourceFences())) return { kind: "changed" }
        // State includes originals/captures, receipts, preferences and every
        // protected namespace. C08 retains its lock and reauthorizes on return.
        return { kind: "sf-scenario-procurement-fence", digest: digestSfValue({ state, product: productDigest, sources, principal,
          environment: after, selection, request: requestDigest, binding, value: valueDigest }) }
      })
      return found.status === "ok" && current() ? found.value : { kind: "changed" }
    }
    return { current, snapshot, close: () => { life.open = false } }
  }
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }

/** Mixed evidence and implicit replacement selectors keep the canonical path. */
function procurementRecords(value: DecisionCase) {
  if ([...value.alternatives, ...value.choices].some((item) => item.scenario.assumptions.length || item.scenario.operations.some((operation) =>
    operation.kind !== "replace" || operation.replacementRef !== undefined))) return undefined
  const refs = new Map<string, RecordRef>(), seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return true
    if (seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.kind !== "record" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" ||
        !ref.refId.startsWith("sf-procurement:") || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      refs.set(digestSfValue(ref), ref)
    }
    return Object.values(item).every(visit)
  }
  if (!visit(value)) return undefined
  const ids = new Set([...refs.values()].map((ref) => ref.refId))
  return [...value.alternatives, ...value.choices].every((item) => ids.has(item.scenario.baseRef) &&
    item.scenario.operations.every((operation) => ids.has(operation.targetRef))) ? [...refs.values()] : undefined
}
