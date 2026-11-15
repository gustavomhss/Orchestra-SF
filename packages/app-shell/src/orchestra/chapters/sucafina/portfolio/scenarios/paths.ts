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
  const owners = ["server", "project", "installation"].map((key) => parent.searchParams.getAll(key))
  if (owners.some((set) => set.length > 1) ||
    (!owners.every((set) => set.length === 0) &&
      !owners.every((set) => set.length === 1 && !!set[0]))) return null
  const query = new URLSearchParams()
  if (owners.every((set) => set.length === 1)) {
    query.set("server", owners[0]![0]!)
    query.set("project", owners[1]![0]!)
    query.set("installation", owners[2]![0]!)
  }
  if (route.query.year !== undefined) query.set("year", String(route.query.year))
  let path: string
  if (destination === "list") path = "/orchestra/sf-portfolio/scenarios"
  else if (destination === "sensitivity-selection") path = "/orchestra/sf-sensitivity"
  else {
    if (!source?.caseRef) return null
    const encodedCase = encodeSfRouteRef(source.caseRef)
    if (destination === "scenarios") path = "/orchestra/sf-portfolio/scenarios/" + encodedCase
    else {
      if (!source?.resultRef) return null
      const encodedResult = encodeSfRouteRef(source.resultRef)
      path = destination === "portfolio-result"
        ? "/orchestra/sf-portfolio/results/" + encodedCase + "/" + encodedResult
        : "/orchestra/sf-sensitivity/" + encodedCase + "/" + encodedResult
    }
  }
  const suffix = query.toString()
  return path + (suffix ? "?" + suffix : "")
}
export function sfCaseIsListed(cases: readonly SfCaseChoice[], original: string): boolean {
  return cases.some((entry) => entry.ref === original)
}
