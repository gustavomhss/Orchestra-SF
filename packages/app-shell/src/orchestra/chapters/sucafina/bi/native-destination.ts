import type { SfInstallationDescriptor, SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import { sfNativeRouteSpecs, matchSfNativeRoutePath } from "../route-registry"
import { encodeSfRouteRef } from "../navigation-state"
import { safeBiDestination } from "./safe-destination"

const dashboardPages: Readonly<Record<string, string>> = {
  "Executive Dashboard": "CAP01", "Hot Topics & Actions": "CAP02", "Budget Overview": "CAP03",
  "OPEX Detail": "CAP04", "CAPEX Projects": "CAP05", "Headcount Overview": "CAP06",
  "Team Structure": "CAP07", "Talent Review": "CAP08", "Portfolio Dashboard": "CAP09",
  "All Projects": "CAP10", "IT Operations": "CAP11", "IT Security KPIs": "CAP12",
  "IT Risks": "CAP13", "Vendor Contracts": "CAP14", "Stakeholder Management": "CAP15",
  "IT Performance Contract": "CAP16",
}

/** Current producer URLs already name native pages. Admit only the same
 * destinations and selectors emitted by extended-source-links; the path codec
 * rejects noncanonical opaque refs. The caller supplies the current owner.
 */
function nativeProducerDestination(value: string, binding: SfInstallationDescriptor): URL | undefined {
  if (!value || [...value].some((ch) => ch.charCodeAt(0) <= 32 || ch.charCodeAt(0) === 127 || ch === "\\" || ch === "#")) return
  if (!URL.canParse(binding.publicOrigin)) return
  const origin = new URL(binding.publicOrigin)
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) return
  const mount = binding.mount === "/" ? "" : binding.mount.replace(/\/$/, "")
  if (mount && (!mount.startsWith("/") || mount.includes("//") || ["%", "\\", "?", "#"].some((part) => mount.includes(part)) ||
      mount.split("/").some((part) => part === "." || part === ".."))) return
  if (!URL.canParse(value, origin.origin)) return
  const source = new URL(value, origin.origin)
  if (!["http:", "https:"].includes(source.protocol) || source.origin !== origin.origin ||
      source.username || source.password || source.hash) return
  const candidate = matchSfNativeRoutePath(source.pathname)
  if (!candidate) return
  const query = source.searchParams, keys = [...query.keys()]
  if (new Set(keys).size !== keys.length ||
      [...query.values()].some((item) => !item || item.length > 4096 || /[\u0000-\u001f\u007f]/.test(item))) return
  const only = (allowed: readonly string[]) => keys.every((key) => allowed.includes(key))
  const year = query.get("year")
  if (year !== null && !/^\d{4}$/.test(year)) return
  if (candidate.surfaceId === "CAP17" && candidate.kind === "entry") {
    if (!query.has("version") || !only(["version", "year"])) return
  } else if (candidate.kind === "entry" && Object.values(dashboardPages).includes(candidate.surfaceId)) {
    if (["CAP01", "CAP11", "CAP12"].includes(candidate.surfaceId)) {
      if (!only(["year", "month"]) || !year || !/^202[4-7]$/.test(year) ||
          !/^(?:[1-9]|1[0-2])$/.test(query.get("month") ?? "")) return
    } else if (["CAP14", "CAP15", "CAP16"].includes(candidate.surfaceId)) {
      if (keys.length) return
    } else if (!only(["year"])) return
  } else if (candidate.surfaceId === "CAP25" && candidate.kind === "entry") {
    if (!only(["request"])) return
  } else if (candidate.surfaceId === "CAP27" && candidate.kind === "detail") {
    if (keys.length) return
  } else return
  return source
}

/** Translate only an already-proven producer destination into its published
 * native route. This is a selector, never authorization: F01 admits the route
 * and the native leaf reads the same source again before rendering.
 */
export function nativeBiDestination(value: string, binding: SfInstallationDescriptor,
  selection: SfOwnerSelection): string | undefined {
  if (selection.projectId !== binding.projectId ||
      selection.installationId !== binding.installationId || !selection.serverKey) return
  const native = nativeProducerDestination(value, binding)
  if (native) {
    const owner = new URLSearchParams({ server: String(selection.serverKey), project: String(selection.projectId),
      installation: String(selection.installationId) })
    for (const [key, value] of native.searchParams) owner.set(key, value)
    return native.pathname + "?" + owner.toString()
  }
  const safe = safeBiDestination(value, binding)
  if (!safe) return
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
  const pathname = reference ? spec.pattern.replace(/:[A-Za-z]+/, encodeSfRouteRef(reference)) : spec.pattern
  const candidate = matchSfNativeRoutePath(pathname)
  if (!candidate || candidate.surfaceId !== surface || candidate.kind !== kind) return
  return pathname + "?" + params.toString()
}
