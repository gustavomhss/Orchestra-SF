import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { createSfContributionReader } from "../../../../modules/sucafina/Sucafinav1/product/ai/contribution-reader.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { SfReviewReaders } from "./review-services.ts"
import { createSfAnalysisAuthorReader } from "./analysis-author.ts"

/** Shared resident composition; native contributions and outcomes keep their live readers. */
export function createSfResidentReviewReaders(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
}) {
  const { authority, business } = input
  const readAuthorAnalysis = createSfAnalysisAuthorReader({ authority, context: business.context, resolveCase: business.resolveCase })
  const readContribution: ReturnType<typeof createSfContributionReader> = async (incoming, call) => {
    const wanted = structuredClone(incoming)
    const request = authority.host.requestFor(call)
    if (!request || call.kind !== "ui" || !await authority.host.revalidate(call)) return { status: "denied", reason: "contribution-authority-unavailable" }
    const found = await authority.state.read(request, "contributions", (stored, actor) => actor.principalRef === call.binding.principalRef &&
      actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? stored.contributions[wanted.outputRef] : undefined)
    if (found.status !== "ok") return { status: "unavailable", reason: "contribution-unavailable" }
    const decoded = decodeSfContributionEnvelope(found.value)
    if (!decoded.ok || decoded.value.id !== wanted.outputRef || digestSfValue(decoded.value.caseRef) !== digestSfValue(wanted.caseRef)) return { status: "unavailable", reason: "contribution-unavailable" }
    const bound = await business.resolveCase(call)
    const read = () => readAuthorAnalysis(decoded.value.runProvenance.runId, decoded.value.outputDigest, call)
    const result = bound.status === "ok" && digestSfValue(bound.value) === digestSfValue(wanted.caseRef) ? await read() :
      await business.withCase(call, wanted.caseRef, {}, read)
    if (result.status !== "ok") return result
    return result.value.output.id === wanted.outputRef && digestSfValue(result.value.output) === digestSfValue(decoded.value) &&
      digestSfValue(result.value.run.caseRef) === digestSfValue(wanted.caseRef) && await authority.host.revalidate(call)
      ? result : { status: "unavailable", reason: "contribution-changed" }
  }
  // Memory needs the composed Portfolio Planner, so the host binds its real
  // provider after creating Review. Until then every outcome request refuses.
  const outcome: { current?: NonNullable<SfReviewReaders["outcome"]> } = {}
  const readers: SfReviewReaders = { contributions: { contributions: readContribution, results: business.results }, outcome: {
    read: (request, call) => outcome.current?.read(request, call) ?? Promise.resolve({ status: "unavailable" }),
    authorize: (call, observations) => outcome.current?.authorize(call, observations) ?? Promise.resolve(false),
  } }
  return { readers, readContribution,
    bindOutcome: (provider: NonNullable<SfReviewReaders["outcome"]>) => { outcome.current = provider },
  }
}
