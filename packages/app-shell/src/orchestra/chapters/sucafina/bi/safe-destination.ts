import { sfOwnerQueryKeys } from "../navigation-state/owner"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"

/** Producer links are data. Bind egress to the current authenticated installation. */
export function safeBiDestination(value: string, binding: Pick<SfInstallationDescriptor, "publicOrigin" | "mount">): string | undefined {
  if (!value || [...value].some((ch) => ch.charCodeAt(0) <= 32 || ch.charCodeAt(0) === 127 || ch === "\\" || ch === "#")) return
  if (!URL.canParse(binding.publicOrigin)) return
  const origin = new URL(binding.publicOrigin)
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) return
  const mount = binding.mount === "/" ? "" : binding.mount.replace(/\/$/, "")
  if (mount && (!mount.startsWith("/") || mount.includes("//") || ["%", "\\", "?", "#"].some((part) => mount.includes(part)) ||
      mount.split("/").some((part) => part === "." || part === ".."))) return
  const base = origin.origin + mount + "/dashboard"
  if (!URL.canParse(value, base)) return
  const target = new URL(value, base)
  if (!["http:", "https:"].includes(target.protocol) || target.origin !== origin.origin ||
      target.username || target.password || target.hash ||
      !["dashboard", "planner", "procurement"].some((name) => target.pathname === mount + "/" + name)) return
  const params = target.searchParams
  const keys = [...params.keys()]
  if (!keys.length || new Set(keys).size !== keys.length ||
      keys.some((key) => sfOwnerQueryKeys.some((name) => name === key)) ||
      [...params.values()].some((item) => !item || item.length > 4096 || /[\u0000-\u001f\u007f]/.test(item))) return
  const only = (allowed: string[]) => keys.every((key) => allowed.includes(key))
  const year = params.get("year")
  if (year && !/^\d{4}$/.test(year)) return
  const page = params.get("page")
  if (target.pathname === mount + "/planner") {
    if (page !== "Overview" || !params.has("version") || !only(["page", "version", "year"])) return
  } else if (target.pathname === mount + "/procurement") {
    if (page === "Suppliers") {
      if (!params.has("supplier") || !only(["page", "supplier", "year"])) return
    } else if (page === "Requests") {
      if (!(params.has("request") !== params.has("filter")) ||
          (params.has("filter") && params.get("filter") !== "All") ||
          !only(["page", "request", "filter", "year"])) return
    } else return
  } else if (params.get("sf") === "workbench-case") {
    if (!params.has("caseRef") || !only(["sf", "caseRef"])) return
  } else {
    const pages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects",
      "Hot Topics & Actions", "Headcount Overview", "Team Structure", "Talent Review",
      "IT Operations", "IT Security KPIs", "Portfolio Dashboard", "All Projects", "IT Risks",
      "Vendor Contracts", "Stakeholder Management", "IT Performance Contract"]
    if (!page || !pages.includes(page)) return
    const scoped = page === "IT Operations" ? ["opsYear", "operationsMonth"] :
      page === "IT Security KPIs" ? ["secYear", "securityMonth"] :
      page === "Executive Dashboard" ? ["execYear", "executiveMonth"] : []
    if (!only(["page", "year", ...scoped])) return
    if (scoped.length) {
      const scopeYear = params.get(scoped[0]!)
      const month = params.get(scoped[1]!)
      if (!scopeYear || !/^202[4-7]$/.test(scopeYear) || !month ||
          !/^(?:[1-9]|1[0-2])$/.test(month)) return
    }
  }
  return target.href
}
