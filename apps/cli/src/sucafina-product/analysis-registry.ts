import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfAnalysisProof, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

/** Register host-composed factories; duplicates and missing counterparts never acquire a fallback. */
export function createSfAnalysisRegistry(input: {
  producers: readonly SfInputProducer[]
  verifiers: readonly SfAnalysisVerifier[]
}) {
  const producers = [...input.producers]
  const verifiers = [...input.verifiers]
  return {
    prepare: async (selection: unknown, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<PortResult<unknown>> => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const matchingProducers = producers.flatMap((item) => item.skillIds.filter((id) => id === request.skillId).map(() => item))
      const matchingVerifiers = verifiers.flatMap((item) => item.skillIds.filter((id) => id === request.skillId).map(() => item))
      if (matchingProducers.length !== 1 || matchingVerifiers.length !== 1) return { status: "unavailable", reason: "analysis-skill-unavailable" }
      const prepared = await matchingProducers[0]!.prepare(selection, request, call)
      if (prepared.status !== "ok") return prepared
      const verified = await matchingVerifiers[0]!.verify(prepared.value, request, call)
      if (verified.status !== "ok") return verified
      if (digestSfValue(verified.value.input) !== digestSfValue(prepared.value)) return { status: "unavailable", reason: "analysis-input-mismatch" }
      return { status: "ok", value: verified.value.input }
    },
    verify: async (value: unknown, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<PortResult<SfAnalysisProof>> => {
      const matchingProducers = producers.flatMap((item) => item.skillIds.filter((id) => id === request.skillId).map(() => item))
      const matchingVerifiers = verifiers.flatMap((item) => item.skillIds.filter((id) => id === request.skillId).map(() => item))
      if (matchingProducers.length !== 1 || matchingVerifiers.length !== 1) return { status: "unavailable", reason: "analysis-skill-unavailable" }
      return matchingVerifiers[0]!.verify(value, request, call)
    },
  }
}
