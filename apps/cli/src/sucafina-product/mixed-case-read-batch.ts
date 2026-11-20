import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import type { Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { Period, ProductContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCasePort, DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfCaseReadBatch } from "./case-read-batch.ts"
import { sfPlannerRecordMaterialized } from "./planner-case-read-batch.ts"
import { sfProcurementRecordMaterialized } from "./procurement-record-read-scope.ts"

type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Mixed local records share only a physical readonly root. There is no case,
 * record or financial proof cache, and the Planner logical scope stays narrow. */
export function createSfMixedCaseReadBatch(input: {
  host: DomainPortHost
  state: SfProductStatePort
  read: DecisionCasePort["read"]
  sources: Pick<PlannerSourceHost, "resolveForecastSource">
  readerIdentity: () => BusinessContextService | undefined
  lockedSourceFences: () => Record<"dashboard" | "planner" | "procurement", string> | undefined
  procurement: {
    contextFor: (call: TrustedDomainContext) => Promise<PortResult<ProductContext>>
    selection: (call: TrustedDomainContext) => { period: Period; expiresAt: number } | undefined
    isCurrentRecord: (snapshot: Snapshot, ref: RecordRef) => boolean
    readerIdentity: () => readonly unknown[]
  }
}): DecisionCasePort["read"] {
  return createSfCaseReadBatch(input, { kind: "mixed",
    identity: () => [input.sources, input.sources.resolveForecastSource, input.procurement, input.procurement.contextFor,
      input.procurement.selection, input.procurement.isCurrentRecord, input.procurement.readerIdentity, ...input.procurement.readerIdentity()],
    forCall: (call) => {
      const selection = input.procurement.selection(call), request = input.host.requestFor(call)
      if (!selection || selection.expiresAt <= Date.now() || !request || request.signal.aborted) return undefined
      const selectionDigest = digestSfValue(selection)
      const current = () => input.host.requestFor(call) === request && !request.signal.aborted &&
        input.procurement.selection(call) === selection && selection.expiresAt > Date.now() &&
        digestSfValue(selection) === selectionDigest
      return { current, dependencies: mixedDependencies, witness: async (refs, snapshots, plannerPrincipal) => {
        const context = await input.procurement.contextFor(call)
        if (!current()) return { kind: "changed" }
        if (context.status !== "ok") return { kind: "unsupported" }
        if (context.value.surface !== "procurement" || context.value.installationId !== call.binding.installationId ||
          context.value.projectId !== call.binding.projectId || context.value.principalRef !== call.binding.principalRef ||
          context.value.accessRevision !== call.binding.accessRevision || context.value.policyVersion !== call.binding.policyVersion ||
          digestSfValue(context.value.period) !== digestSfValue(selection.period)) return { kind: "changed" }
        const principal = structuredClone(await input.host.authenticate(request, {
          surface: "procurement", roleMap: roleMap(snapshots.procurement, "procurement") }))
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:") || !current())
          return { kind: "changed" }
        const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
        if (!refs.every((ref) => ref.target.surface === "planner"
          ? sfPlannerRecordMaterialized(ref, call, snapshots.planner, plannerPrincipal)
          : input.procurement.isCurrentRecord(snapshots.procurement, ref) &&
            sfProcurementRecordMaterialized(ref, call, snapshots.procurement, context.value, roles, principal.canWrite)))
          return { kind: "unsupported" }
        const again = await input.procurement.contextFor(call)
        const actor = await input.host.authenticate(request, {
          surface: "procurement", roleMap: roleMap(snapshots.procurement, "procurement") })
        if (!current() || again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(context.value) ||
          digestSfValue(actor) !== digestSfValue(principal) || !await input.host.revalidate(call) || !current())
          return { kind: "changed" }
        return { kind: "current", value: { selection: structuredClone(selection), context: context.value, principal } }
      } }
    },
  })
}

/** Only ordinary current cases with Planner bases and explicit individual
 * Procurement request evidence. Other routes retain their actual producer. */
function mixedDependencies(value: DecisionCase): readonly RecordRef[] | undefined {
  if (value.preparedChanges.length || value.receipts.length ||
    [...value.alternatives, ...value.choices].some((item) => item.scenario.operations.some((operation) =>
      operation.replacementRef !== undefined || operation.targetRef.startsWith("sf-procurement:") ||
      !["replace", "exclude", "include", "defer"].includes(operation.kind)))) return undefined
  const refs = new Map<string, RecordRef>(), seen = new Set<object>()
  const visit = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return true
    if (seen.has(item)) return true
    seen.add(item)
    if (Array.isArray(item)) return item.every(visit)
    if ("schema" in item && item.schema === "sf-evidence-v1") {
      const ref = item as BusinessEvidenceRef
      if (ref.kind !== "record" || !ref.target.period || ref.refDigest !== digestSfEvidenceRef(ref)) return false
      const planner = ref.target.surface === "planner" && ref.target.recordType === "planner-version"
      const procurement = ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" &&
        ref.refId.startsWith("sf-procurement:")
      if (!planner && !procurement) return false
      refs.set(digestSfValue(ref), ref)
    }
    return Object.values(item).every(visit)
  }
  if (!visit(value)) return undefined
  const selected = [...refs.values()], planner = selected.filter((ref) => ref.target.surface === "planner")
  if (!planner.length || !selected.some((ref) => ref.target.surface === "procurement")) return undefined
  const bases = new Set(planner.map((ref) => ref.refId))
  return [...value.alternatives, ...value.choices].every((item) => bases.has(item.scenario.baseRef)) ? selected : undefined
}
