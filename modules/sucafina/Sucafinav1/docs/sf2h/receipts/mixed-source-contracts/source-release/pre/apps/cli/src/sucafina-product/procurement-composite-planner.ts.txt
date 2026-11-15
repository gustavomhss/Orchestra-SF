import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { createCompositeDecisionPlanner } from "../../../../modules/sucafina/Sucafinav1/product/decisions/composite-planner.ts"
import { createProcurementReadonlySourceResolver } from "../../../../modules/sucafina/Sucafinav1/product/procurement/scenario-producer.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Attach an evidenced PR hypothesis to a Planner scenario without quantifying or executing that external effect. */
export function createSfProcurementCompositePlanner(input: {
  host: DomainPortHost
  state: SfProductStatePort
  planner: PlannerPort
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  readSourceFences: (call: TrustedDomainContext) => Promise<unknown | undefined>
}) {
  const readonly = createProcurementReadonlySourceResolver({ host: input.host })
  const supports = (request: ScenarioRequest) => typeof request.baseRef === "string" && !request.baseRef.startsWith("sf-procurement:") && Array.isArray(request.operations) && request.operations.some((operation) => typeof operation.targetRef === "string" && operation.targetRef.startsWith("sf-procurement:"))
  const planner: PlannerPort = { ...input.planner, simulateScenario: async (incoming, call) => {
    const request = structuredClone(incoming)
    if (!supports(request)) return input.planner.simulateScenario(request, call)
    const parsed = decodeSfOperationInput("sf_scenario_simulate", request)
    if (!parsed.ok || digestSfValue(parsed.value) !== digestSfValue(request)) return { status: "needs-input", reason: "invalid-composite-procurement-scenario" }
    const transport = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding])
    const current = () => !!transport && !transport.signal.aborted && input.host.requestFor(call) === transport && binding === digestSfValue([call.kind, call.binding])
    if (!current() || !transport || !await input.host.revalidate(call)) return { status: "denied", reason: "composite-scenario-authority-unavailable" }
    const selected = await input.selectedCase(call)
    if (selected.status !== "ok") return selected
    const readCase = async (): Promise<DecisionCase | undefined> => {
      const selectedAgain = await input.selectedCase(call)
      if (selectedAgain.status !== "ok" || digestSfValue(selectedAgain.value) !== digestSfValue(selected.value)) return undefined
      const result = await input.state.read(transport, "cases", (state, actor) => {
        const value = state.cases[selected.value.id]
        return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          value?.incarnation === selected.value.incarnation && value.version === selected.value.version && value.participants.includes(actor.principalRef) ? structuredClone(value) : undefined
      })
      return result.status === "ok" && current() && await input.host.revalidate(call) ? result.value : undefined
    }
    const decision = await readCase(), fences = await input.readSourceFences(call)
    if (!decision || !fences) return { status: "denied", reason: "composite-scenario-case-unavailable" }
    const attached = decision.sourceRefs.filter((ref): ref is RecordRef => ref.kind === "record" && ref.installationId === call.binding.installationId && ref.projectId === call.binding.projectId && ref.refDigest === digestSfEvidenceRef(ref))
    if (attached.filter((ref) => ref.refId === request.baseRef && ref.target.surface === "planner" && ref.target.recordType === "planner-version").length !== 1) return { status: "denied", reason: "composite-planner-source-not-attached" }
    const external = request.operations.filter((operation) => operation.targetRef.startsWith("sf-procurement:"))
    if (new Set(external.map((operation) => operation.targetRef)).size !== external.length) return { status: "needs-input", reason: "duplicate-composite-procurement-target" }
    if (external.some((operation) => operation.kind !== "replace" || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || operation.currency !== decision.currency || digestSfValue(operation.period) !== digestSfValue(decision.horizon))) return { status: "needs-input", reason: "explicit-composite-requisition-amount-required" }
    const resolve = async (ref: BusinessEvidenceRef): Promise<BusinessEvidenceResolution> => {
      const environment = await input.host.environment(transport)
      const unavailable: BusinessEvidenceResolution = { state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: environment.at }
      if (!Number.isFinite(Date.parse(environment.at)) || !current() || ref.kind !== "record" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" || !ref.target.fields.includes("originalAmount") || !attached.some((entry) => digestSfValue(entry) === digestSfValue(ref))) return unavailable
      const source = await readonly.resolveSource(ref.refId, call)
      if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(ref)) return unavailable
      const projected = await readonly.readProjection(ref.refId, call)
      if (projected.status !== "ok" || projected.value.version !== ref.target.version || projected.value.context.currency !== decision.currency || digestSfValue(projected.value.context.period) !== digestSfValue(decision.horizon)) return unavailable
      const again = await readonly.resolveSource(ref.refId, call)
      if (again.status !== "ok" || digestSfValue(again.value.evidence) !== digestSfValue(ref) || !current() || !await input.host.revalidate(call)) return unavailable
      return { ...unavailable, state: "fresh", currentRef: source.value.evidence, authorizedProjection: projected.value }
    }
    const composite = createCompositeDecisionPlanner({ planner: input.planner, revalidate: async (context) => context === call && current() && await input.host.revalidate(call),
      evidence: { context: async ({ refs }, context) => context === call ? Promise.all(refs.map(resolve)) : [] },
      resolveOperation: async (operation, context) => {
        if (context !== call || !current()) return { status: "denied", reason: "composite-scenario-authority-unavailable" }
        if (!operation.targetRef.startsWith("sf-procurement:")) return { status: "ok", value: { kind: "planner", operationDigest: digestSfValue(operation) } }
        const matches = attached.filter((ref) => ref.refId === operation.targetRef && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request")
        if (matches.length !== 1) return { status: "denied", reason: "composite-procurement-source-not-attached" }
        const found = await resolve(matches[0]!)
        if (found.state !== "fresh") return { status: "stale", reason: "composite-procurement-source-changed" }
        return { status: "ok", value: { kind: "external", operationDigest: digestSfValue(operation), sourceRefs: [matches[0]!], condition: "procurement-replacement-cost-unresolved" } }
      } })
    const result = await composite.simulateScenario(request, call)
    if (result.status !== "ok") return result
    if (result.value.comparisonStatus !== "conditioned" || result.value.total !== null || result.value.currency !== decision.currency || digestSfValue(result.value.horizon) !== digestSfValue(decision.horizon)) return { status: "needs-input", reason: "composite-planner-result-basis-unavailable" }
    if (!current() || digestSfValue(await readCase()) !== digestSfValue(decision) || digestSfValue(await input.readSourceFences(call)) !== digestSfValue(fences) || !await input.host.revalidate(call)) return { status: "stale", reason: "composite-scenario-source-or-case-changed" }
    return result
  } }
  return { planner, supports }
}
