import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfSourcingInput } from "./analysis-verifier-procurement.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Prepare a skill input from the current authorized case and Procurement producer. */
export function createSfSourcingInputs(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: Pick<ReturnType<typeof createSfBusinessServices>, "sourcingEvidence" | "cases" | "context" | "withCase">
}): NonNullable<SfHostServices["sourcingInputs"]> {
  const prepare = createSfSourcingInput({ sourcingEvidence: input.business.sourcingEvidence })
  return { prepare: async (call, incoming) => {
    const request = structuredClone(incoming)
    const digest = digestSfValue(request)
    if (!input.authority.ui.matchesIntent(call, "sf_sourcing_compare", digest) || !await input.authority.host.revalidate(call))
      return { status: "denied", reason: "sourcing-input-authority-unavailable" }
    return input.business.withCase(call, request.caseRef, {}, async () => {
      const current = await input.business.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return { status: "stale", reason: "sourcing-case-changed" }
      const selected = current.value.evidenceRefs.find((ref) => ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" && ref.refId === request.requestRef)
      if (!selected) return { status: "denied", reason: "sourcing-source-outside-case" }
      const prepared = await prepare(request.requestRef, call)
      if (prepared.status !== "ok") return prepared
      if (prepared.value.sourceRefs.length !== 1 || digestSfValue(prepared.value.sourceRefs[0]) !== digestSfValue(selected)) return { status: "stale", reason: "sourcing-source-changed" }
      const sources = await input.business.context.context({ refs: prepared.value.sourceRefs }, call)
      const again = await input.business.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (sources.length !== 1 || sources.some((source) => source.state !== "fresh" || !source.authorizedProjection || !source.currentRef || digestSfValue(source.currentRef) !== digestSfValue(selected)) ||
        again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await input.authority.host.revalidate(call) ||
        !input.authority.ui.matchesIntent(call, "sf_sourcing_compare", digest)) return { status: "stale", reason: "sourcing-source-or-authority-changed" }
      return prepared
    })
  } }
}

