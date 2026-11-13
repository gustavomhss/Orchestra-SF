import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { createProcurementSourcingEvidence } from "../../../../modules/sucafina/Sucafinav1/product/procurement/sourcing-evidence.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { withoutObservationTimes, type SfAnalysisDependencies, type SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfSourcingVerifier(dependencies: SfAnalysisDependencies & { sourcingEvidence: ReturnType<typeof createProcurementSourcingEvidence> }): SfAnalysisVerifier {
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
        if (actual.status !== "ok" || !actual.value.comparison || actual.value.stage !== value.request.stage || actual.value.evidence.target.version !== value.request.version ||
          value.weightsAndEligibility.length || actual.value.weights.technicalCriteria.length || actual.value.weights.commercialCriteria.length) return undefined
        const ref = actual.value.evidence
        if (digestSfValue(value.sourceRefs) !== digestSfValue([ref]) || !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref))) return undefined
        const offers = value.authorizedOffers.map((offer) => ({ offerRef: offer.offerRef, version: offer.version, currency: offer.currency, amount: offer.amount }))
        const realOffers = actual.value.offers.map((offer) => ({ offerRef: offer.offerRef, version: offer.version, currency: offer.currency, amount: offer.amount }))
        if (digestSfValue(offers) !== digestSfValue(realOffers) || value.authorizedOffers.some((offer) => digestSfValue(offer.evidenceRefs) !== digestSfValue([ref]))) return undefined
        const rates = value.submittedFx.map((rate) => ({ from: rate.from, rate: rate.rate }))
        if (digestSfValue(rates) !== digestSfValue(actual.value.submittedFx) || value.submittedFx.some((rate) => (rate.rate !== null && (!Number.isFinite(rate.rate) || rate.rate <= 0)) || rate.to !== actual.value.submittedBaseCurrency ||
          digestSfValue(rate.period) !== digestSfValue(actual.value.context.period) || digestSfValue(rate.evidenceRefs) !== digestSfValue([ref]))) return undefined
        const sources = await dependencies.context.context({ refs: [ref] }, currentCall)
        if (sources.length !== 1 || sources[0]?.state !== "fresh" || !sources[0].authorizedProjection || !sources[0].currentRef ||
          digestSfValue(sources[0].currentRef) !== digestSfValue(ref) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources, replay: actual.value.comparison }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "sourcing-proof-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, freshCall) => {
        const current = await read(freshCall)
        return current && output.kind === "CommercialComparison" && digestSfValue(output.evidenceRefs) === digestSfValue(current.replay.sourceRefs) &&
          digestSfValue(withoutObservationTimes(output.payload)) === digestSfValue(withoutObservationTimes(current.replay))
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}
