import type { SfSurfaceProps } from "../../../context/contracts"
import { encodeSfRouteRef } from "../../../navigation-state"

export function sfHotTopicProposalRoute(props: SfSurfaceProps<"UI54">, reference: string): string {
  const query = new URLSearchParams({
    server: props.route.ownerSelection.serverKey,
    project: props.route.ownerSelection.projectId,
  })
  if (props.route.ownerSelection.installationId) query.set("installation", props.route.ownerSelection.installationId)
  return "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference) + "?" + query.toString()
}
