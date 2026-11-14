import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { AlternativeDraftRequest, ScenarioRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type SfAlternativeSelectionRequest = { caseRef: CaseRef; request: AlternativeDraftRequest; scenario: ScenarioRequest; coverageRef: string;
  mutation: { expectedStorageVersion: number; idempotencyKey: string } }
export type SfAlternativeSelection = Omit<SfAlternativeSelectionRequest, "mutation"> & { schema: "sf-alternative-selection-v1"; coverageDigest: string;
  principalRef: string; accessRevision: string; policyVersion: string; installationId: string; projectId: string; recordDigest: string }

/** A human binds the exact text request to an executable scenario; prose is never parsed as an operation. */
export function createSfAlternativeSelections(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
}) {
  const { authority, business } = input
  const host = authority.host
  const sameActor = (actor: SfStateAuthority, call: TrustedDomainContext) => actor.principalRef === call.binding.principalRef &&
    actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
  const key = (request: AlternativeDraftRequest, call: TrustedDomainContext) => `sf:proposal-coverage:alternative-selection:${digestSfValue({ requestDigest: digestSfValue(request),
    principalRef: call.binding.principalRef, installationId: call.binding.installationId, projectId: call.binding.projectId })}`
  const currentCase = async (caseRef: CaseRef, call: TrustedDomainContext) => {
    const source = host.requestFor(call)
    if (!source || !await host.revalidate(call) || call.kind === "native" && (call.binding.caseId !== caseRef.id || call.binding.caseIncarnation !== caseRef.incarnation ||
      call.binding.caseVersion !== caseRef.version)) return undefined
    const found = await authority.state.read(source, "cases", (state, actor) => {
      const decision = state.cases[caseRef.id]
      return sameActor(actor, call) && decision?.incarnation === caseRef.incarnation && decision.version === caseRef.version && decision.participants.includes(actor.principalRef) ? decision : undefined
    })
    return found.status === "ok" && found.value && await host.revalidate(call) ? found : undefined
  }
  const validate = async (selection: Pick<SfAlternativeSelection, "caseRef" | "request" | "scenario" | "coverageRef">, call: TrustedDomainContext) => {
    if (!decodeSfOperationInput("sf_alternative_draft", selection.request).ok || !decodeSfOperationInput("sf_scenario_simulate", selection.scenario).ok ||
      selection.request.caseRef !== encodeCaseRef(selection.caseRef) || !selection.coverageRef.trim() || selection.coverageRef.startsWith("proposal-coverage:")) return undefined
    const current = await currentCase(selection.caseRef, call)
    const projected = await business.cases.read({ caseRef: selection.request.caseRef }, call)
    if (!current || projected.status !== "ok" || projected.value.case.version !== selection.caseRef.version) return undefined
    const supplied = [...selection.request.sourceRefs, ...selection.request.proposal.sourceRefs, ...selection.scenario.assumptions.flatMap((value) => value.evidenceRefs)]
    if (supplied.some((ref) => !projected.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref)))) return undefined
    const source = await business.plannerSources.resolveForecastSource(selection.scenario.baseRef, call)
    const coverage = await business.plannerSources.resolveForecastCoverage(selection.coverageRef, call)
    if (source.status !== "ok" || coverage.status !== "ok" || coverage.value.coverageRef !== selection.coverageRef ||
      !projected.value.evidenceRefs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence)) ||
      coverage.value.assessment.currency !== current.value!.currency || digestSfValue(coverage.value.assessment.horizon) !== digestSfValue(current.value!.horizon) ||
      !coverage.value.assessment.evaluatedSourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence))) return undefined
    const refs = [...supplied, ...coverage.value.basis.sourceRefs, ...coverage.value.assessment.evaluatedSourceRefs]
    const evidence = await business.context.context({ refs }, call)
    if (evidence.length !== refs.length || evidence.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef ||
      item.accessRevision !== call.binding.accessRevision || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref))) return undefined
    const again = await currentCase(selection.caseRef, call)
    return again && digestSfValue(again.value) === digestSfValue(current.value) && await host.revalidate(call) ? { current, coverage: coverage.value } : undefined
  }
  const read = async (request: AlternativeDraftRequest, call: TrustedDomainContext): Promise<PortResult<SfAlternativeSelection>> => {
    const source = host.requestFor(call)
    if (!source || !decodeSfOperationInput("sf_alternative_draft", request).ok || !await host.revalidate(call)) return { status: "denied", reason: "alternative-selection-authority-unavailable" }
    const load = () => authority.state.read(source, "preferences", (state, actor) => sameActor(actor, call) ? state.preferences[key(request, call)] : undefined)
    const found = await load()
    if (found.status !== "ok" || !isSelection(found.value)) return { status: "needs-input", reason: "human-alternative-selection-required" }
    const selection = found.value
    if (selection.recordDigest !== selectionDigest(selection) || digestSfValue(selection.request) !== digestSfValue(request) ||
      selection.principalRef !== call.binding.principalRef || selection.accessRevision !== call.binding.accessRevision || selection.policyVersion !== call.binding.policyVersion ||
      selection.installationId !== call.binding.installationId || selection.projectId !== call.binding.projectId) return { status: "denied", reason: "alternative-selection-scope-changed" }
    const proof = await validate(selection, call)
    if (!proof || digestSfValue(proof.coverage) !== selection.coverageDigest) return { status: "stale", reason: "alternative-selection-source-changed" }
    const again = await load()
    return again.status === "ok" && digestSfValue(again.value) === digestSfValue(selection) && await host.revalidate(call)
      ? { status: "ok", value: selection } : { status: "stale", reason: "alternative-selection-changed" }
  }
  const candidates = async (caseRef: CaseRef, scenario: ScenarioRequest, call: TrustedDomainContext): Promise<PortResult<readonly SfAlternativeSelection[]>> => {
    const source = host.requestFor(call)
    if (!source || !await currentCase(caseRef, call)) return { status: "denied", reason: "alternative-selection-case-unavailable" }
    const values = await authority.state.read(source, "preferences", (state, actor) => sameActor(actor, call) ? Object.entries(state.preferences)
      .filter(([name]) => name.startsWith("sf:proposal-coverage:alternative-selection:")).map(([, value]) => value).filter(isSelection)
      .filter((value) => digestSfValue(value.caseRef) === digestSfValue(caseRef) && digestSfValue(value.scenario) === digestSfValue(scenario)) : undefined)
    if (values.status !== "ok" || !values.value) return { status: "unavailable", reason: "alternative-selection-unavailable" }
    const checked = await Promise.all(values.value.map((value) => read(value.request, call)))
    return { status: "ok", value: checked.flatMap((value) => value.status === "ok" ? [value.value] : []) }
  }
  const select = async (request: SfAlternativeSelectionRequest, call: TrustedDomainContext): Promise<PortResult<SfAlternativeSelection>> => {
    const source = host.requestFor(call)
    if (call.kind !== "ui" || !source || !business.operationIdentity(call) || !await authority.human.authorize(call, "decisions.alternative.select", request) ||
      !Number.isSafeInteger(request.mutation.expectedStorageVersion) || request.mutation.expectedStorageVersion < 0 || !request.mutation.idempotencyKey.trim()) return { status: "denied", reason: "human-alternative-selection-required" }
    const before = await business.readSourceFences(call)
    const proof = await validate(request, call)
    if (!before || !proof) return { status: "unavailable", reason: "alternative-selection-evidence-unavailable" }
    const initial: SfAlternativeSelection = { schema: "sf-alternative-selection-v1", caseRef: structuredClone(request.caseRef), request: structuredClone(request.request),
      scenario: structuredClone(request.scenario), coverageRef: request.coverageRef, coverageDigest: digestSfValue(proof.coverage),
      principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      installationId: call.binding.installationId, projectId: call.binding.projectId, recordDigest: "" }
    const record = { ...initial, recordDigest: selectionDigest(initial) }
    const work = async (state: SfProductState, actor: SfStateAuthority) => {
      const locked = business.lockedSourceFences()
      if (!sameActor(actor, call) || !locked || digestSfValue(locked) !== digestSfValue(before) || digestSfValue(state.cases[request.caseRef.id]) !== digestSfValue(proof.current.value) ||
        !await authority.human.authorize(call, "decisions.alternative.select", request)) return { commit: false, value: undefined }
      state.preferences[key(request.request, call)] = record
      return { commit: true, value: true }
    }
    input.proposalCoverageWrites.add(work)
    const saved = await authority.state.transaction(source, { namespace: "preferences", sourceFence: "all", ...request.mutation,
      checkNamespaces: [{ namespace: "cases", expectedStorageVersion: proof.current.storageVersion }], targetRef: request.caseRef.id,
      targetIncarnation: request.caseRef.incarnation, commandDigest: digestSfValue(request) }, work).finally(() => input.proposalCoverageWrites.delete(work))
    return saved.status === "ok" && saved.value ? read(request.request, call) : { status: saved.status === "conflict" ? "conflict" : "unavailable", reason: "alternative-selection-not-persisted" }
  }
  return { read, select, candidates }
}

function selectionDigest(value: SfAlternativeSelection) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest"))) }
function isSelection(value: unknown): value is SfAlternativeSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Partial<SfAlternativeSelection>
  return row.schema === "sf-alternative-selection-v1" && !!row.caseRef && !!row.request && !!row.scenario && typeof row.coverageRef === "string" &&
    typeof row.coverageDigest === "string" && typeof row.recordDigest === "string"
}
