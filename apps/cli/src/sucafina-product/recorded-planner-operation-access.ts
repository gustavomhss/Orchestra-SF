import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, Period, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { plannerValueRef } from "../../../../modules/sucafina/Sucafinav1/product/planner/scenario-inputs.ts"

type PlannerRef = Extract<BusinessEvidenceRef, { kind: "record" }>
type StoredScenario = Pick<DecisionCase["alternatives"][number], "scenario" | "result">
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)

/** Read-only C08/C17 authorization for an already stored Planner scenario.
 * Nothing here admits, resimulates, prepares or applies an operation. C17 owns
 * the original capture and independently proves today's access/physical lineage. */
export function createSfRecordedPlannerOperationAccess(input: {
  host: DomainPortHost
  state: SfProductStatePort
  resolveEvidence: BusinessContextService["resolve"]
}) {
  // This stores only an in-flight recursion sentinel, never a successful grant.
  const pending = new WeakMap<TrustedDomainContext, { cycle: boolean }>()
  return async (incoming: DecisionCase, selected: StoredScenario, call: TrustedDomainContext): Promise<boolean> => {
    const running = pending.get(call)
    if (running) { running.cycle = true; return false }
    const frame = { cycle: false }
    pending.set(call, frame)
    try {
      const decision = structuredClone(incoming)
      const item = structuredClone(selected)
      const request = input.host.requestFor(call)
      const binding = digestSfValue([call.kind, call.binding])
      const currentAuthority = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request &&
        binding === digestSfValue([call.kind, call.binding]) && !frame.cycle
      if (!currentAuthority() || !await input.host.revalidate(call) || !request ||
        ![...decision.alternatives, ...decision.choices].some((entry) => same(entry.scenario, item.scenario) && same(entry.result, item.result))) return false
      const parsed = decodeSfOperationInput("sf_scenario_simulate", item.scenario)
      if (!parsed.ok || !same(parsed.value, item.scenario) || item.result.currency !== "USD") return false
      const readStored = async () => {
        const found = await input.state.read(request, "cases", (state, authority) => {
          const value = state.cases[decision.id]
          return authority.principalRef === call.binding.principalRef && authority.accessRevision === call.binding.accessRevision &&
            authority.policyVersion === call.binding.policyVersion && value?.participants.includes(authority.principalRef) && same(value, decision) &&
            (call.kind === "ui" || value.id === call.binding.caseId && value.incarnation === call.binding.caseIncarnation && value.version === call.binding.caseVersion)
        })
        return found.status === "ok" && found.value === true && currentAuthority() && await input.host.revalidate(call)
      }
      if (!await readStored()) return false
      const refs = [...decision.sourceRefs, ...item.result.sourceRefs, ...item.result.costCoverage.evaluatedSourceRefs,
        ...item.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      const originals = new Map<string, PlannerRef>()
      const select = (selector: string) => {
        const matches = refs.filter((ref): ref is PlannerRef => ref.kind === "record" && ref.target.surface === "planner" &&
          ref.target.recordType === "planner-version" && ref.refId === selector)
        const ref = matches[0]
        if (!ref || matches.some((other) => !same(other, ref)) || ref.refDigest !== digestSfEvidenceRef(ref) || !ref.target.period ||
          ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return undefined
        originals.set(ref.refId, ref)
        return ref
      }
      const base = select(item.scenario.baseRef)
      if (!base || !coversMonths(base.target.period!, item.result.horizon)) return false
      const operations = item.scenario.operations.filter((operation) => !operation.replacementRef?.startsWith("hot-topic-draft:"))
      if (!operations.length) return false
      const replacements = operations.map((operation) => operation.replacementRef ? amountSelector(operation.replacementRef) : undefined)
      if (operations.some((operation, index) => operation.replacementRef && (!replacements[index] || !select(replacements[index]!.source)))) return false
      const read = async () => {
        const values: { ref: PlannerRef; resolution: BusinessEvidenceResolution; projection: DomainProjection }[] = []
        // Separate protected reads avoid nested domain/metadata transactions.
        for (const ref of originals.values()) {
          const resolution = structuredClone(await input.resolveEvidence(structuredClone(ref), call))
          const projection = originalProjection(ref, resolution, call)
          if (!projection || !currentAuthority()) return undefined
          values.push({ ref, resolution, projection })
        }
        return values
      }
      const first = await read()
      const baseline = first?.find((entry) => entry.ref.refId === base.refId)
      // At least one stale selector must be backed by a protected capture.
      // This also covers an unchanged base with a historical amount reference.
      if (!first || !baseline || !first.some((entry) => entry.resolution.state === "historical")) return false
      for (const [index, operation] of operations.entries()) {
        const target = baseline.projection.components.filter((component) => component.id === operation.targetRef &&
          component.period.start >= item.result.horizon.start && component.period.end <= item.result.horizon.end)
        if (target.length !== 1 || !target[0]!.sourceRefs.length || target[0]!.sourceRefs.some((ref) => !covered(ref, base))) return false
        // The source producer owns the amount semantics. This selects the exact
        // retained monthly value; it never calculates a replacement or result.
        const replacement = replacements[index]
        if (replacement) {
          const source = first.find((entry) => entry.ref.refId === replacement.source)
          const values = source?.projection.values.filter((value) => value.id === replacement.value)
          const value = values?.[0]
          if (!source || values?.length !== 1 || !value || typeof value.value !== "number" || !Number.isFinite(value.value) ||
            value.evidenceState !== "confirmed" || value.granularity !== "month" || !value.currency ||
            !value.sourceRefs.length || value.sourceRefs.some((ref) => !same(ref, source.ref)) || !same(value.period, target[0]!.period) ||
            value.currency !== item.result.currency || operation.amount !== undefined || operation.currency !== undefined && operation.currency !== value.currency ||
            operation.period !== undefined && !same(operation.period, value.period)) return false
        }
      }
      const second = await read()
      if (!second || !same(first.map(stableObservation), second.map(stableObservation)) || !await readStored() ||
        !await input.host.revalidate(call) || !currentAuthority() || !same(incoming, decision) || !same(selected, item)) return false
      return true
    } catch { return false }
    finally { pending.delete(call) }
  }
}

function originalProjection(ref: PlannerRef, resolution: BusinessEvidenceResolution, call: TrustedDomainContext) {
  const current = resolution.currentRef
  const projection = resolution.authorizedProjection
  if ((resolution.state !== "fresh" && resolution.state !== "historical") || !same(resolution.ref, ref) || resolution.accessRevision !== call.binding.accessRevision ||
    !current || current.kind !== "record" || current.refDigest !== digestSfEvidenceRef(current) || current.installationId !== ref.installationId || current.projectId !== ref.projectId ||
    current.target.surface !== "planner" || current.target.recordType !== ref.target.recordType || current.target.recordId !== ref.target.recordId ||
    !same([...current.target.fields].sort(), [...ref.target.fields].sort()) || !same(current.target.period, ref.target.period) ||
    !projection || !("values" in projection) || projection.engineVersion !== "planner-runtime-v1" || projection.version !== ref.target.version ||
    projection.context.installationId !== ref.installationId || projection.context.projectId !== ref.projectId || projection.context.surface !== "planner" ||
    projection.context.currency !== "USD" || !same(projection.context.period, ref.target.period) || !projection.context.sourceRefs.length ||
    projection.context.sourceRefs.some((source) => !covered(source, ref)) || new Set(projection.values.map((value) => value.id)).size !== projection.values.length ||
    new Set(projection.components.map((component) => component.id)).size !== projection.components.length) return undefined
  if (resolution.state === "fresh" && (!same(current, ref) || projection.context.principalRef !== call.binding.principalRef ||
    projection.context.accessRevision !== call.binding.accessRevision || projection.context.policyVersion !== call.binding.policyVersion)) return undefined
  if (resolution.state === "historical" && !resolution.differences) return undefined
  return projection
}

function stableObservation(value: { ref: PlannerRef; resolution: BusinessEvidenceResolution; projection: DomainProjection }) {
  const { checkedAt: _checkedAt, ...resolution } = value.resolution
  // Historical bytes/context remain exact. Only fresh observation timestamps vary.
  const source = (ref: SourceRef) => ({ ...ref, observedAt: "" })
  return resolution.state === "historical" ? resolution : { ...resolution, authorizedProjection: { ...value.projection,
    context: { ...value.projection.context, sourceRefs: value.projection.context.sourceRefs.map(source) },
    components: value.projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(source) })) } }
}

function amountSelector(reference: string) {
  const parts = /^planner-value:([^:]+):([^:]+)$/.exec(reference)
  if (!parts) return undefined
  try {
    const source = decodeURIComponent(parts[1]!)
    const value = decodeURIComponent(parts[2]!)
    return source && /:(?:[1-9]|1[0-2]):(?:budget|actual|forecast)$/.test(value) && plannerValueRef(source, value) === reference ? { source, value } : undefined
  } catch { return undefined }
}

function covered(source: SourceRef, ref: PlannerRef) {
  return source.surface === "planner" && source.type === ref.target.recordType && source.id === ref.target.recordId &&
    source.incarnation === ref.target.incarnation && source.version === ref.target.version && !!ref.target.period &&
    ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end && source.fields.every((field) => ref.target.fields.includes(field))
}

function coversMonths(outer: Period, inner: Period) {
  const start = /^(\d{4})-(\d{2})-01$/.exec(inner.start)
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inner.end)
  return outer.start <= inner.start && outer.end >= inner.end && !!start && !!end && start[1] === end[1] &&
    Number(start[2]) >= 1 && Number(start[2]) <= Number(end[2]) && Number(end[2]) <= 12 &&
    Number(end[3]) === new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()
}
