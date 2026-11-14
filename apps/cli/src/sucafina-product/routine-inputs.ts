import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCasePort, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { routineSourceDigest } from "./routine-services.ts"
import type { SfRoutineServicesInput } from "./routine-services.ts"

/** C07 selectors name evidence already attached to the authorized case; they never carry source authority. */
export function createSfRoutineInputReaders(input: {
  cases: DecisionCasePort
  context: BusinessContextService
  resolveCase: SfRoutineServicesInput["resolveCase"]
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}) {
  const readCase = async (context: TrustedDomainContext) => {
    if (!await input.revalidate(context)) return { status: "denied" as const, reason: "routine-input-authority-unavailable" }
    const selected = await input.resolveCase(context)
    if (selected.status !== "ok") return selected
    const found = await input.cases.read({ caseRef: encodeCaseRef(selected.value) }, context)
    if (found.status !== "ok") return found
    if (found.value.case.version !== selected.value.version || !await input.revalidate(context)) return { status: "stale" as const, reason: "routine-case-changed" }
    return found
  }
  const resolveInputs: SfRoutineServicesInput["resolveInputs"] = async (references, context) => {
    if (references.length > 128 || references.some((ref) => !ref.trim()) || new Set(references).size !== references.length)
      return { status: "needs-input", reason: "routine-input-selection-invalid" }
    const selected = [...references]
    const current = await readCase(context)
    if (current.status !== "ok") return current
    const evidence = selected.map((reference) => current.value.evidenceRefs.filter((ref) => ref.refDigest === reference || ref.refId === reference))
    if (evidence.some((matches) => matches.length !== 1)) return { status: "denied", reason: "routine-input-outside-case" }
    const resolved = await input.context.context({ refs: evidence.flat() }, context)
    if (resolved.length !== selected.length || resolved.some((value, index) => value.state !== "fresh" || !value.currentRef ||
      digestSfValue(value.ref) !== digestSfValue(evidence[index]![0]) || digestSfValue(value.currentRef) !== digestSfValue(value.ref) || !value.authorizedProjection))
      return { status: "unavailable", reason: "routine-input-source-unavailable" }
    // SourceRef is C07's current contract. Never invent one for a document/policy without a domain projection.
    if (resolved.some((value) => !value.authorizedProjection || !("components" in value.authorizedProjection) || !value.authorizedProjection.context.sourceRefs.length))
      return { status: "unavailable", reason: "routine-input-source-projection-unavailable" }
    const sources = resolved.flatMap((value) => value.authorizedProjection && "components" in value.authorizedProjection ? value.authorizedProjection.context.sourceRefs : [])
      .filter((source, index, all) => all.findIndex((other) => routineSourceDigest([other]) === routineSourceDigest([source])) === index)
    const latest = await readCase(context)
    if (latest.status !== "ok") return latest
    if (digestSfValue(latest.value.case) !== digestSfValue(current.value.case) || digestSfValue(latest.value.evidenceRefs) !== digestSfValue(current.value.evidenceRefs))
      return { status: "stale", reason: "routine-input-case-changed" }
    return await input.revalidate(context) ? { status: "ok", value: structuredClone(sources) } : { status: "denied", reason: "routine-input-authority-unavailable" }
  }
  const revalidateSources: SfRoutineServicesInput["revalidateSources"] = async (sources, context) => {
    if (!await input.revalidate(context)) return false
    if (!sources.length) return true
    const current = await readCase(context)
    if (current.status !== "ok") return false
    const results = await Promise.all(current.value.evidenceRefs.map((ref) => resolveInputs([ref.refDigest], context)))
    const available = results.flatMap((result) => result.status === "ok" ? result.value : [])
    return sources.every((source) => available.some((item) => routineSourceDigest([item]) === routineSourceDigest([source]))) && await input.revalidate(context)
  }
  const listInputs = async (context: TrustedDomainContext): Promise<PortResult<readonly { inputRef: string; sourceRefs: readonly SourceRef[] }[]>> => {
    const current = await readCase(context)
    if (current.status !== "ok") return current
    const results = await Promise.all(current.value.evidenceRefs.map(async (ref) => {
      const sources = await resolveInputs([ref.refDigest], context)
      return sources.status === "ok" ? [{ inputRef: ref.refDigest, sourceRefs: sources.value }] : []
    }))
    return await input.revalidate(context) ? { status: "ok", value: results.flat() } : { status: "denied", reason: "routine-input-authority-unavailable" }
  }
  return { resolveInputs, revalidateSources, listInputs }
}
