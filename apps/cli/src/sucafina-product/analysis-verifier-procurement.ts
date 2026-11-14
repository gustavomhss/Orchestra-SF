import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SourcingComparisonInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { createProcurementSourcingEvidence } from "../../../../modules/sucafina/Sucafinav1/product/procurement/sourcing-evidence.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { withoutObservationTimes, type SfAnalysisDependencies, type SfAnalysisVerifier } from "./analysis-verifier.ts"

type SourcingDependencies = { sourcingEvidence: ReturnType<typeof createProcurementSourcingEvidence> }
type SourcingEvidence = Extract<Awaited<ReturnType<SourcingDependencies["sourcingEvidence"]>>, { status: "ok" }>["value"]

/** Host preparation reads the same current domain evidence that verification will replay. */
export function createSfSourcingInput(dependencies: SourcingDependencies) {
  return async (requestRef: string, call: TrustedDomainContext): Promise<PortResult<SourcingComparisonInput>> => {
    const actual = await dependencies.sourcingEvidence(requestRef, call)
    if (actual.status !== "ok") return actual
    const value = sourcingInput(actual.value)
    return value ? { status: "ok", value } : { status: "needs-input", reason: "sourcing-input-material-unavailable" }
  }
}

export function createSfSourcingVerifier(dependencies: Pick<SfAnalysisDependencies, "cases" | "context" | "host"> & SourcingDependencies): SfAnalysisVerifier {
  return {
    skillIds: ["sf-comparar-sourcing"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("SourcingComparisonInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return undefined
        const actual = await dependencies.sourcingEvidence(value.request.requestRef, currentCall)
        if (actual.status !== "ok" || !actual.value.comparison) return undefined
        const expected = sourcingInput(actual.value)
        if (!expected || digestSfValue(value) !== digestSfValue(expected)) return undefined
        const ref = actual.value.evidence
        if (!current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) return undefined
        const sources = await dependencies.context.context({ refs: [ref] }, currentCall)
        if (sources.length !== 1 || sources[0]?.state !== "fresh" || !sources[0].authorizedProjection || !sources[0].currentRef ||
          digestSfValue(sources[0].currentRef) !== digestSfValue(ref) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources, replay: actual.value.comparison }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "sourcing-proof-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, freshCall) => {
        if (output.state !== "ready") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(freshCall)
        return current && output.kind === "CommercialComparison" && digestSfValue(output.evidenceRefs) === digestSfValue(current.replay.sourceRefs) &&
          digestSfValue(withoutObservationTimes(output.payload)) === digestSfValue(withoutObservationTimes(current.replay))
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}

function sourcingInput(actual: SourcingEvidence): SourcingComparisonInput | undefined {
  const ref = actual.evidence
  const weights = actual.weights
  if (!actual.comparison || weights.technical === null || weights.commercial === null ||
    actual.offers.some((offer) => !offer.currency) ||
    actual.submittedFx.some((rate) => !actual.submittedBaseCurrency || (rate.rate !== null && (!Number.isFinite(rate.rate) || rate.rate <= 0))) ||
    [...weights.technicalCriteria, ...weights.commercialCriteria].some((criterion) => !criterion.name.trim() || criterion.weight === null)) return undefined
  // Configured criteria have names and ordered positions, no stable IDs. JSON tuple refs
  // preserve group, position and name without ambiguous separators or name collisions.
  // `required` follows the existing score validator: technical and manual commercial
  // assessments are required; automatic price is calculated. Offer eligibility remains
  // the domain's CommercialComparison result, never an invented numeric criterion.
  const value: SourcingComparisonInput = {
    request: { requestRef: ref.refId, version: ref.target.version, stage: actual.stage },
    authorizedOffers: actual.offers.map((offer) => ({ offerRef: offer.offerRef, version: offer.version, currency: offer.currency!, amount: offer.amount, evidenceRefs: [ref] })),
    submittedFx: actual.submittedFx.map((rate) => ({ from: rate.from, to: actual.submittedBaseCurrency!, period: actual.context.period, rate: rate.rate, evidenceRefs: [ref] })),
    weightsAndEligibility: [
      { criterionRef: JSON.stringify(["procurement-sourcing-v1", "weight", "technical"]), weight: weights.technical, required: true, evidenceRefs: [ref] },
      { criterionRef: JSON.stringify(["procurement-sourcing-v1", "weight", "commercial"]), weight: weights.commercial, required: true, evidenceRefs: [ref] },
      ...weights.technicalCriteria.map((criterion, index) => ({ criterionRef: JSON.stringify(["procurement-sourcing-v1", "technical", index, criterion.name]), weight: criterion.weight!, required: true, evidenceRefs: [ref] })),
      ...weights.commercialCriteria.map((criterion, index) => ({ criterionRef: JSON.stringify(["procurement-sourcing-v1", "commercial", index, criterion.name]), weight: criterion.weight!, required: !criterion.automatic, evidenceRefs: [ref] })),
    ],
    sourceRefs: [ref],
  }
  const decoded = decodeSfSkillInput("SourcingComparisonInput", value)
  return decoded.ok ? decoded.value : undefined
}

