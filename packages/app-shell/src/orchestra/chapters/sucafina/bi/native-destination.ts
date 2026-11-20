import type { SfInstallationDescriptor, SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import { sfNativeRouteSpecs, matchSfNativeRoutePath } from "../route-registry"
import { safeBiDestination } from "./safe-destination"

const dashboardPages: Readonly<Record<string, string>> = {
  "Executive Dashboard": "CAP01", "Hot Topics & Actions": "CAP02", "Budget Overview": "CAP03",
  "OPEX Detail": "CAP04", "CAPEX Projects": "CAP05", "Headcount Overview": "CAP06",
  "Team Structure": "CAP07", "Talent Review": "CAP08", "Portfolio Dashboard": "CAP09",
  "All Projects": "CAP10", "IT Operations": "CAP11", "IT Security KPIs": "CAP12",
  "IT Risks": "CAP13", "Vendor Contracts": "CAP14", "Stakeholder Management": "CAP15",
  "IT Performance Contract": "CAP16",
}

/** Translate only an already-proven producer destination into its published
 * native route. This is a selector, never authorization: F01 admits the route
 * and the native leaf reads the same source again before rendering.
 */
export function nativeBiDestination(value: string, binding: SfInstallationDescriptor,
  selection: SfOwnerSelection): string | undefined {
  const safe = safeBiDestination(value, binding)
  if (!safe || selection.projectId !== binding.projectId ||
      selection.installationId !== binding.installationId || !selection.serverKey) return
  const source = new URL(safe), query = source.searchParams
  const mount = binding.mount === "/" ? "" : binding.mount.replace(/\/$/, "")
  let surface: string | undefined, kind = "entry", reference: string | undefined
  const params = new URLSearchParams({
    server: String(selection.serverKey), project: String(selection.projectId),
    installation: String(selection.installationId),
  })
  if (source.pathname === mount + "/planner") {
    surface = "CAP17"
    params.set("version", query.get("version")!)
    if (query.has("year")) params.set("year", query.get("year")!)
  } else if (source.pathname === mount + "/procurement") {
    // These native record routes intentionally have no period selector.
    if (query.has("year")) return
    if (query.get("page") === "Suppliers") { surface = "CAP27"; kind = "detail"; reference = query.get("supplier")! }
    else {
      surface = "CAP25"
      if (query.has("request")) { kind = "detail"; reference = query.get("request")! }
    }
  } else if (query.get("sf") === "workbench-case") {
    surface = "UI34"; reference = query.get("caseRef")!
  } else {
    surface = dashboardPages[query.get("page")!]
    if (!surface) return
    const scoped = surface === "CAP01" ? ["execYear", "executiveMonth"] :
      surface === "CAP11" ? ["opsYear", "operationsMonth"] :
      surface === "CAP12" ? ["secYear", "securityMonth"] : undefined
    if (scoped) {
      const year = query.get(scoped[0]!)!, month = query.get(scoped[1]!)!
      if (query.has("year") && query.get("year") !== year) return
      params.set("year", year); params.set("month", month)
    } else if (query.has("year")) {
      if (["CAP14", "CAP15", "CAP16"].includes(surface)) return
      params.set("year", query.get("year")!)
    }
  }
  const spec = sfNativeRouteSpecs.find((item) => item.surfaceId === surface && item.kind === kind)
  if (!spec) return
  const pathname = reference ? spec.pattern.replace(/:[A-Za-z]+/, encodeURIComponent(reference)) : spec.pattern
  const candidate = matchSfNativeRoutePath(pathname)
  if (!candidate || candidate.surfaceId !== surface || candidate.kind !== kind) return
  return pathname + "?" + params.toString()
}
