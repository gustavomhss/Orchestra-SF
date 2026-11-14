import { digestSfValue } from "../contracts/canonical.ts"
import type { RoutineResult } from "../contracts/context.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createRoutineCapabilities } from "./capabilities.ts"
import { createRoutinePublicationCatalog } from "./publication.ts"
import type { RoutineResultAccess } from "./result-access.ts"

/** Composition uses the real C08 ports and host-owned publication/authority bindings. */
export function createSfRoutineProduct(input: {
  publication: Parameters<typeof createRoutinePublicationCatalog>[0]
  routines: Omit<BusinessPorts["routines"], "catalog">
  capabilities: Omit<Parameters<typeof createRoutineCapabilities>[0], "routines">
  resultAccess?: RoutineResultAccess
  discovery: {
    /** Read references from the host's authorized routine index, not from model input. */
    listRunRefs: (context: TrustedDomainContext) => Promise<PortResult<readonly string[]>>
    /** Validate the real Request and every source/artifact before returning results. */
    revalidate: (context: TrustedDomainContext, runs: readonly RoutineResult[]) => Promise<boolean>
  }
}) {
  const routines: BusinessPorts["routines"] = { ...input.routines, catalog: createRoutinePublicationCatalog(input.publication) }
  const descriptors = createRoutineCapabilities({ ...input.capabilities, routines,
    ...(input.resultAccess ? { resolveResult: async (run, context) => {
      if (!run.runRef) return { status: "needs-input" as const, reason: "result-not-ready" }
      const output = await input.resultAccess!.readResult(run.runRef, context)
      return output.status === "ok" ? { status: "ok" as const, value: output.value.run } : output
    } } : {}),
  })
  return {
    routines,
    descriptors,
    /** Same authenticated output reader for a product page, file link and decision consumer. */
    async openResult(runRef: string, context: TrustedDomainContext) {
      if (!input.resultAccess) return { status: "unavailable" as const, reason: "result-reader-unavailable" }
      const digest = digestSfValue({ runRef })
      if (!input.capabilities.authority.receiptFor(context, "sf_routine_result", digest) || !await input.capabilities.authority.revalidateDomainContext(context))
        return { status: "denied" as const, reason: "routine-access-unavailable" }
      const result = await input.resultAccess.readResult(runRef, context)
      if (result.status !== "ok") return result
      if (!await input.capabilities.authority.revalidateDomainContext(context) || !await input.capabilities.revalidateOutput(context, result.value.run))
        return { status: "denied" as const, reason: "routine-access-unavailable" }
      return result
    },
    /** Discovery does not promote an admission or assert that an occurrence completed. */
    async discoverRuns(context: TrustedDomainContext): Promise<PortResult<readonly RoutineResult[]>> {
      const digest = digestSfValue({ purpose: "routine-discovery" })
      if (context.kind !== "ui" || !input.capabilities.authority.receiptFor(context, "sf_routine_status", digest) || !await input.capabilities.authority.revalidateDomainContext(context)) return { status: "denied", reason: "routine-access-unavailable" }
      if (!await input.discovery.revalidate(context, [])) return { status: "denied", reason: "routine-access-unavailable" }
      const listed = await input.discovery.listRunRefs(context)
      if (listed.status !== "ok") return listed
      const refs = [...new Set(listed.value)]
      if (refs.length > 100 || refs.some((ref) => !ref.trim())) return { status: "unavailable", reason: "routine-index-invalid" }
      const reads = await Promise.all(refs.map((ref) => routines.readRun(ref, context)))
      if (reads.some((read, index) => read.status !== "ok" ? read.status !== "denied" : read.value.runRef !== refs[index] || read.value.principalRef !== context.binding.principalRef || read.value.projectId !== context.binding.projectId)) return { status: "unavailable", reason: "routine-index-unavailable" }
      const runs = reads.flatMap((read) => read.status === "ok" ? [read.value] : [])
      if (!await input.capabilities.authority.revalidateDomainContext(context) || !await input.discovery.revalidate(context, runs)) return { status: "denied", reason: "routine-access-unavailable" }
      return { status: "ok", value: runs }
    },
  }
}

