import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

/** Proves the original run and current case access; it never reissues a fresh calculation. */
export function createSfReviewCalculationHistory(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  authorizeCase?: (value: DecisionCase, call: TrustedDomainContext) => Promise<boolean>
}) {
  return async (ref: Extract<BusinessEvidenceRef, { kind: "calculation" }>, call: TrustedDomainContext) => {
    try {
      const { authority } = input
      const request = authority.host.requestFor(call)
      if (!request || !input.authorizeCase || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || ref.target.calculationId !== "planner:scenario" || ref.target.engineVersion !== "planner-runtime-v1" ||
        ref.refId !== `planner-calculation:${encodeURIComponent(ref.target.runId)}` || ref.refDigest !== digestSfEvidenceRef(ref) || !await authority.host.revalidate(call)) return undefined
      sfEvidenceSourceMaps([ref])
      const proof = await authority.state.read(request, "cases", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
        const stored = state.decisionResults?.[ref.target.runId]
        const current = stored ? state.cases[stored.caseRef.id] : undefined
        return stored && current ? { stored, current } : undefined
      })
      const binding = await authority.state.read(request, "preferences", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
        ? state.preferences[`sf:proposal-coverage:scenario-request:${digestSfValue(ref.target.runId)}`] : undefined)
      if (proof.status !== "ok" || !proof.value || binding.status !== "ok" || !binding.value) return undefined
      const { stored, current } = proof.value
      const bound = object(binding.value)
      if (stored.schema !== "sf-decision-result-v1" || stored.kind !== "scenario" || stored.resultRef !== ref.target.runId || stored.requestDigest !== ref.target.inputDigest ||
        stored.resultDigest !== ref.target.resultDigest || stored.resultDigest !== digestSfValue(stored.result) || !decodeSfOperationOutput("sf_scenario_simulate", stored.result).ok ||
        !same(stored.sourceRefs, ref.target.sourceRefs) || !same(stored.result.horizon, ref.target.period) || stored.result.currency !== ref.target.currency ||
        !stored.sourceRefs.length || stored.sourceRefs.some((source) => source.kind !== "record" || source.installationId !== call.binding.installationId || source.projectId !== call.binding.projectId) ||
        current.id !== stored.caseRef.id || current.incarnation !== stored.caseRef.incarnation || !Number.isSafeInteger(current.version) || !Number.isSafeInteger(stored.caseRef.version) ||
        stored.caseRef.version < 1 || current.version < stored.caseRef.version || !current.participants.includes(call.binding.principalRef) ||
        call.kind === "native" && (call.binding.caseId !== current.id || call.binding.caseIncarnation !== current.incarnation || call.binding.caseVersion !== current.version)) return undefined
      const schema = decodeSfOperationInput("sf_scenario_simulate", bound.request)
      if (bound.schema !== "sf-scenario-request-v1" || bound.resultRef !== stored.resultRef || !same(bound.caseRef, stored.caseRef) || bound.requestDigest !== stored.requestDigest ||
        bound.resultDigest !== stored.resultDigest || bound.engineVersion !== ref.target.engineVersion || Object.keys(bound).length !== 8 ||
        bound.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(bound).filter(([key]) => key !== "recordDigest"))) ||
        !schema.ok || digestSfValue(schema.value) !== stored.requestDigest || schema.value.assumptions.length || schema.value.operations.some((operation) => operation.replacementRef)) return undefined
      const closure = [...stored.result.sourceRefs, ...stored.result.costCoverage.evaluatedSourceRefs,
        ...stored.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      sfEvidenceSourceMaps([...stored.sourceRefs, ...closure])
      if (closure.some((source) => source.kind !== "record" || !stored.sourceRefs.some((known) => same(known, source))) ||
        !await input.authorizeCase(current, call) || request.signal.aborted || !await authority.host.revalidate(call)) return undefined
      return digestSfValue({ stored, current, binding: bound })
    } catch { return undefined }
  }
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
