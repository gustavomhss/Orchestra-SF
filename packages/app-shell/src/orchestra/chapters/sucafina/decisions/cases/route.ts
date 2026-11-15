/**
 * N24 closed UI33–UI37 route links, using the F01 opaque reference codec.
 * These are only same-owner href candidates; F01 still validates the target
 * at navigation time. 125 must adopt the central manifest builder on merge.
 */
import { encodeSfRouteRef } from "../../navigation-state"
import type { SfHref, SfResolvedRoute } from "@orchestra/schema/sucafina/context"

export type SfDecisionDestination = "list" | "case" | "alternatives" | "assumptions" | "questions"

export function sfDecisionHref(
  route: SfResolvedRoute,
  destination: SfDecisionDestination,
  caseRef?: string,
): SfHref {
  if (destination !== "list" && !caseRef) throw new Error("missing case reference")
  const segment = caseRef ? "/" + encodeSfRouteRef(caseRef) : ""
  const suffix = destination === "list" ? "" : destination === "case" ? "" : "/" + destination
  const pathname = "/orchestra/sf-decisions" + (destination === "list" ? "" : segment + suffix)
  const selected = route.ownerSelection
  // Partial owner selection must NEVER be encoded; F01 resolves shell selection
  // when no explicit installation is present.
  const query = selected.installationId ? new URLSearchParams({
    server: selected.serverKey,
    project: selected.projectId,
    installation: selected.installationId,
  }).toString() : ""
  return (pathname + (query ? "?" + query : "")) as SfHref
}
