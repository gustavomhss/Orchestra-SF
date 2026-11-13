import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { DecisionIntentInput, ScenarioComparisonInput } from "../contracts/skill-inputs.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { SfAnalysisRequest } from "./analysis-input-port.ts"

export function hasCaseAnalysisInput(skillId: string) {
  return skillId === "sf-comparar-cenarios" || skillId === "sf-enquadrar-decisao"
}

/** A native-analysis grant never substitutes for the saved case's own read grant. */
export async function readCaseAnalysisProjection(request: Request, runtime: Pick<SfHostServices, "ui" | "dispatch">,
  caseRef: SfAnalysisRequest["caseRef"]): Promise<PortResult<AuthorizedCaseProjection>> {
  const payload = { caseRef: encodeCaseRef(caseRef) }
  const admitted = await runtime.ui.admit(request, "sf_case_read", digestSfValue(payload))
  if (admitted.status !== "ok") return { status: admitted.status === "unavailable" ? "unavailable" : "denied", reason: "case-access-unavailable" }
  try {
    const result = await runtime.dispatch("sf_case_read", payload, admitted.value).catch(() => undefined)
    if (!result) return { status: "unavailable", reason: "case-read-unavailable" }
    if (result.status !== "ok") return { status: result.status === "denied" ? "denied" : result.status === "stale" ? "stale" : "unavailable", reason: "case-read-unavailable" }
    const decoded = decodeSfOperationOutput("sf_case_read", result.result)
    if (!decoded.ok) return { status: "unavailable", reason: "case-projection-invalid" }
    const value = decoded.value
    const binding = admitted.value.binding
    if (value.context.installationId !== binding.installationId || value.context.projectId !== binding.projectId ||
      value.context.principalRef !== binding.principalRef || value.context.policyVersion !== binding.policyVersion ||
      value.context.accessRevision !== binding.accessRevision || value.case.id !== caseRef.id ||
      value.case.incarnation !== caseRef.incarnation || !await runtime.ui.revalidate(admitted.value))
      return { status: "denied", reason: "case-access-changed" }
    if (value.case.version !== caseRef.version) return { status: "stale", reason: "case-changed" }
    return { status: "ok", value }
  } finally { runtime.ui.finish(admitted.value) }
}

/** Project an authorized saved case. The existing analysis-start verifier still
 * replays the domain calculation and validates all sources before native work. */
export async function prepareCaseAnalysisInput(request: Request, runtime: SfHostServices, input: {
  request: SfAnalysisRequest; selection: Record<string, unknown>
}): Promise<PortResult<ScenarioComparisonInput | DecisionIntentInput>> {
  const wanted = structuredClone(input)
  if (!hasCaseAnalysisInput(wanted.request.skillId)) return { status: "unavailable", reason: "analysis-inputs-unavailable" }
  const scenario = wanted.request.skillId === "sf-comparar-cenarios"
  const selected = wanted.selection.alternatives
  if (scenario && (Object.keys(wanted.selection).some((key) => !["caseRef", "alternatives"].includes(key)) ||
    digestSfValue(wanted.selection.caseRef) !== digestSfValue(wanted.request.caseRef) || !Array.isArray(selected) || selected.length !== 2 ||
    !selected.every((item) => isAlternative(item)) || selected[0]?.id === selected[1]?.id))
    return { status: "needs-input", reason: "scenario-selection-invalid" }
  if (!scenario && Object.keys(wanted.selection).length) return { status: "needs-input", reason: "intent-selection-invalid" }

  const read = () => readCaseAnalysisProjection(request, runtime, wanted.request.caseRef)
  const current = await read()
  if (current.status !== "ok") return current
  const domain = current.value.case
  let value: ScenarioComparisonInput | DecisionIntentInput
  if (scenario) {
    if (!Array.isArray(selected) || !selected.every(isAlternative)) return { status: "needs-input", reason: "scenario-selection-invalid" }
    const matches = selected.map((choice) => domain.alternatives.filter((alternative) => alternative.id === choice.id && alternative.version === choice.version))
    if (matches.some((items) => items.length !== 1)) return { status: "stale", reason: "scenario-alternative-changed" }
    const alternatives = matches.map((items) => items[0]!)
    value = {
      alternatives: alternatives.map(({ id, version, title, result }) => ({ id, version, title, result })),
      costCoverageBases: domain.costCoverageBases,
      operations: alternatives.flatMap((alternative) => alternative.scenario.operations),
      currency: domain.currency,
      horizon: domain.horizon,
    }
  } else {
    const source = domain.sourceRefs.find((ref) => ref.kind === "record")
    const routeSurface = new URL(request.url).pathname.split("/").at(-1)
    const surface = source?.kind === "record" ? source.target.surface : routeSurface === "dashboard" || routeSurface === "planner" || routeSurface === "procurement" ? routeSurface : undefined
    if (!surface) return { status: "needs-input", reason: "intent-surface-unavailable" }
    value = {
      intentText: wanted.request.objective,
      case: wanted.request.caseRef,
      // No import preview or invented SourceRef observation timestamp is added.
      // The actual evidence identities remain in selectedSourceRefs.
      context: { surface, period: domain.horizon, currency: domain.currency, sourceRefs: [] },
      selectedSourceRefs: domain.sourceRefs,
    }
  }
  const again = await read()
  if (again.status !== "ok") return again
  if (digestSfValue({ case: again.value.case, refs: again.value.evidenceRefs }) !== digestSfValue({ case: domain, refs: current.value.evidenceRefs }))
    return { status: "stale", reason: "case-changed" }
  return { status: "ok", value: structuredClone(value) }
}

function isAlternative(value: unknown): value is { id: string; version: number } {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => key === "id" || key === "version") &&
    "id" in value && typeof value.id === "string" && !!value.id.trim() && "version" in value &&
    typeof value.version === "number" && Number.isSafeInteger(value.version) && value.version >= 0
}
