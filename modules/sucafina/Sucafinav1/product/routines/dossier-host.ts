import { digestSfValue } from "../contracts/canonical.ts"
import type { ProcurementPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementSourcingEvidence } from "../procurement/sourcing-evidence.ts"
import { prepareSourcingDossier } from "./dossier.ts"
import type { ProcurementPreparation, SourcingDossierHost } from "./dossier.ts"
import { routineContextMaterial, routineProjectionMaterial } from "./material.ts"

/** Compose the WP04 domain and WP06 Request-document ports without decoding their opaque selectors. */
export function createSourcingDossierPreparation(input: {
  procurement: Pick<ProcurementPort, "read">
  sourcingEvidence: ReturnType<typeof createProcurementSourcingEvidence>
  selectedDocuments: SourcingDossierHost["selectedDocuments"]
  reader: SourcingDossierHost["reader"]
  revalidateAuthority: (context: TrustedDomainContext) => Promise<boolean>
}) {
  const prepare = async (requestRef: string, context: TrustedDomainContext): Promise<PortResult<ProcurementPreparation>> => {
    if (!await input.revalidateAuthority(context)) return { status: "denied", reason: "dossier-authority-unavailable" }
    const request = await input.procurement.read({ requestRef }, context)
    if (request.status !== "ok") return request
    const sourcing = await input.sourcingEvidence(requestRef, context)
    if (sourcing.status !== "ok") return sourcing
    if (sourcing.value.evidence.refId !== requestRef || sourcing.value.evidence.target.version !== request.value.version) return { status: "stale", reason: "dossier-request-changed" }
    return { status: "ok", value: { request: request.value, comparison: sourcing.value.comparison, sourcing: sourcing.value, limitations: [] } }
  }
  return (requestRef: string, context: TrustedDomainContext) => prepareSourcingDossier({
    requestRef,
    context,
    prepareProcurement: prepare,
    selectedDocuments: input.selectedDocuments,
    reader: input.reader,
    revalidateProcurement: async (material, call) => {
      const current = await prepare(requestRef, call)
      // Stage/source versions remain exact; the displayed clock-derived age is an observation.
      const digest = (value: ProcurementPreparation) => digestSfValue({ ...value, ...(value.sourcing ? { sourcing: { ...value.sourcing, context: routineContextMaterial(value.sourcing.context) } } : {}), request: routineProjectionMaterial(value.request) })
      return current.status === "ok" && digest(current.value) === digest(material) && await input.revalidateAuthority(call)
    },
    revalidate: async (refs, call) => {
      const current = await input.selectedDocuments(requestRef, call)
      const identity = (values: typeof refs) => digestSfValue([...new Set(values.map((ref) => digestSfValue(ref)))].sort())
      return current.status === "ok" && identity(current.value) === identity(refs) && await input.revalidateAuthority(call)
    },
  })
}
