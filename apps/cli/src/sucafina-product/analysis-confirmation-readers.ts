import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ConfirmationRecord, ConfirmationScope, ConfirmationValidityProjection, Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import type { createSfAnalysisSelectionScope } from "./analysis-selection-scope.ts"

export type SfAnalysisConfirmationReader = (selection: { refs: readonly BusinessEvidenceRef[]; period: Period }, call: TrustedDomainContext) => Promise<PortResult<readonly ConfirmationValidityProjection[]>>
export type SfExecutiveConfirmationBindings = {
  confirmations?: SfAnalysisConfirmationReader
  readHumanSelection?: ReturnType<typeof createSfAnalysisSelectionScope>["read"]
}
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)
const unavailable = (): PortResult<never> => ({ status: "unavailable", reason: "review-confirmation-unavailable" })
const scopeKey = (scope: ConfirmationScope) => digestSfValue({ ...scope, fields: [...scope.fields].sort(), materialDependencies: [...scope.materialDependencies].sort((a, b) => digestSfValue(a).localeCompare(digestSfValue(b))) })

/** Evaluation timestamps change on every observation; all material validity fields remain exact. */
export function sfConfirmationMaterial(values: readonly ConfirmationValidityProjection[]) {
  return values.map(({ evaluatedAt: _evaluatedAt, ...value }) => value)
}

function scopeMatches(ref: BusinessEvidenceRef, source: ConfirmationScope["sourceRef"], fields: readonly string[], period: Period) {
  // This only locates candidates. The unchanged original incarnation stays in the C08 record;
  // C06 must prove continuity, or project stale/replaced, for the current authorized observer.
  if (ref.kind !== "record" || ref.target.surface !== source.surface || ref.target.recordType !== source.type || ref.target.recordId !== source.id) return false
  // Planner publishes annual source evidence while its C06 summary may cover a selected subperiod.
  // Only that published mapping permits containment; the real observer validates summary/manifest.
  if (source.surface === "planner" && source.type === "planner-version") return !!ref.target.period && ref.target.period.start <= period.start && ref.target.period.end >= period.end
  return same(ref.target.period, period) && same([...ref.target.fields].sort(), [...fields].sort())
}

/** C08 indexes locate only the selected scopes. Public C06/C08 ports reauthorize and project every record. */
export function createSfAnalysisConfirmationReader(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  state: SfProductStatePort
  confirmation: ReturnType<typeof createCollaborationHost>["confirmation"]
}): SfAnalysisConfirmationReader {
  return async (selection, call) => {
    const request = input.host.requestFor(call)
    const port = input.confirmation
    const wanted = structuredClone(selection)
    const binding = digestSfValue([call.kind, call.binding])
    if (!request || request.signal.aborted || !port || !await input.host.revalidate(call) || wanted.refs.some((ref) => ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId)) return unavailable()
    const selected = (record: ConfirmationRecord) => same(record.scope.period, wanted.period) && wanted.refs.some((ref) => scopeMatches(ref, record.scope.sourceRef, record.scope.fields, wanted.period))
    const load = () => input.state.read(request, "confirmations", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
      ? Object.entries(state.confirmations).filter(([, record]) => selected(record)).map(([key, record]) => ({ key, record })).sort((a, b) => a.key.localeCompare(b.key)) : undefined)
    const first = await load()
    if (first.status === "unavailable" && first.reason === "product-state-uninitialized") {
      const again = await load()
      return again.status === "unavailable" && again.reason === first.reason && binding === digestSfValue([call.kind, call.binding]) && !request.signal.aborted && await input.host.revalidate(call) ? { status: "ok", value: [] } : unavailable()
    }
    if (first.status !== "ok" || !first.value || first.value.some(({ key, record }) => key !== record.id || !same(record.sourceRef, record.scope.sourceRef) || record.scope.materialDependencies.some((dependency) => !wanted.refs.some((ref) => scopeMatches(ref, dependency, dependency.fields, dependency.period))))) return unavailable()
    const records = first.value.map(({ record }) => record)
    const scopes = records.map((record) => record.scope).filter((scope, index, all) => all.findIndex((other) => scopeKey(other) === scopeKey(scope)) === index)
    const find = async () => {
      const found = await Promise.all(scopes.map((scope) => port.find(scope, call)))
      return found.every((result, index) => result.status === "ok" && same([...result.value.confirmationIds].sort(), records.filter((record) => scopeKey(record.scope) === scopeKey(scopes[index]!)).map((record) => record.id).sort()))
    }
    if (!await find()) return unavailable()
    const observe = async (record: ConfirmationRecord) => {
      const inspected = await port.inspect(record.id, call)
      const projected = await port.project(record.id, call)
      if (inspected.status !== "ok" || projected.status !== "ok" || inspected.value.confirmationId !== record.id || projected.value.confirmationId !== record.id || inspected.value.authorId !== record.authorId || inspected.value.confirmedAt !== record.confirmedAt || inspected.value.observedSourceVersion !== record.observedSourceVersion || !same(inspected.value.period, wanted.period) || projected.value.state === "unavailable" || inspected.value.validity.state === "unavailable" || !Number.isFinite(Date.parse(projected.value.evaluatedAt)) || !same(sfConfirmationMaterial([inspected.value.validity]), sfConfirmationMaterial([projected.value]))) return undefined
      return projected.value
    }
    const initial = await Promise.all(records.map(observe))
    if (initial.some((value) => !value)) return unavailable()
    const current = await Promise.all(records.map(observe))
    if (current.some((value) => !value) || !same(sfConfirmationMaterial(initial.filter((value): value is NonNullable<typeof value> => !!value)), sfConfirmationMaterial(current.filter((value): value is NonNullable<typeof value> => !!value))) || !await find()) return unavailable()
    const again = await load()
    if (again.status !== "ok" || !again.value || again.storageVersion !== first.storageVersion || !same(again.value, first.value) || binding !== digestSfValue([call.kind, call.binding]) || !same(wanted, selection) || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
    return { status: "ok", value: current.filter((value): value is NonNullable<typeof value> => !!value) }
  }
}
