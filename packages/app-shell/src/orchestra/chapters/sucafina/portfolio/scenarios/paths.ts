import { sfParseOwnerQuery, sfSelectionFromQuery, sfSameOwnerSelection, sfAppendOwnerQuery } from "../../navigation-state/owner"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../navigation-state"
import type { SfCaseChoice } from "./model"

/** Only original A04 case refs and A05 result refs are encoded as F01 route tokens. */
export function sfDecisionHref(
  route: SfResolvedRoute<"UI42" | "UI43" | "UI44">,
  destination: "list" | "scenarios" | "portfolio-result" | "sensitivity-selection" | "sensitivity-result",
  source?: Readonly<{ caseRef?: string; resultRef?: string }>,
): string | null {
  const parent = new URL(String(route.href), "http://orchestra.invalid")
  const parsed = sfParseOwnerQuery(parent.searchParams)
  const selected = sfSelectionFromQuery(parent.searchParams, route.ownerSelection)
  if (parsed.kind === "invalid" || !selected || !sfSameOwnerSelection(selected, route.ownerSelection)) return null
  const query = new URLSearchParams()
  if (parsed.kind !== "absent") sfAppendOwnerQuery(query, selected)
  if (route.query.year !== undefined) query.set("year", String(route.query.year))
  let path: string
  if (destination === "list") path = "/orchestra/sf-portfolio/scenarios"
  else if (destination === "sensitivity-selection") path = "/orchestra/sf-portfolio/sensitivity"
  else {
    if (!source?.caseRef) return null
    const encodedCase = encodeSfRouteRef(source.caseRef)
    if (destination === "scenarios") path = "/orchestra/sf-portfolio/scenarios/" + encodedCase
    else {
      if (!source?.resultRef) return null
      const encodedResult = encodeSfRouteRef(source.resultRef)
      path = destination === "portfolio-result"
        ? "/orchestra/sf-portfolio/scenarios/" + encodedCase + "/results/" + encodedResult
        : "/orchestra/sf-portfolio/sensitivity/" + encodedCase + "/" + encodedResult
    }
  }
  const suffix = query.toString()
  return path + (suffix ? "?" + suffix : "")
}
export function sfCaseIsListed(cases: readonly SfCaseChoice[], original: string): boolean {
  return cases.some((entry) => entry.ref === original)
}
