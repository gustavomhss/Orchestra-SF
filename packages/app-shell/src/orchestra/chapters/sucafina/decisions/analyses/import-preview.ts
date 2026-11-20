import type { SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../navigation-state"

/** Candidate native route only. F01 admits this owner and the imports producer
 * reauthorizes the original manifest; this helper never creates an SfHref grant.
 */
export function sfAnalysisImportPreviewDestination(
  output: Readonly<{ importPreviewRef?: string }>,
  owner: SfOwnerSelection,
): string | undefined {
  if (!output.importPreviewRef || !owner.serverKey || !owner.projectId || !owner.installationId) return undefined
  return "/orchestra/sf-imports/" + encodeSfRouteRef(output.importPreviewRef) + "/preview?" +
    new URLSearchParams({ server: owner.serverKey, project: owner.projectId, installation: owner.installationId }).toString()
}
