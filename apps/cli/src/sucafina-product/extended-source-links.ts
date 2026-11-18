import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Links are derived from producer-authorized evidence, never an incoming URL. */
export async function sfExtendedSourceLinks(input: { business: ReturnType<typeof createSfBusinessServices>; reference: BusinessEvidenceRef; call: TrustedDomainContext; url: URL }) {
  const refs: BusinessEvidenceRef[] = input.reference.kind === "calculation" ? [...input.reference.target.sourceRefs] : [input.reference]
  const links: { label: string; url: string }[] = []
  for (const reference of refs) {
    if (reference.kind !== "record") continue
    const current = await input.business.context.resolve(reference, input.call)
    if (current.state !== "fresh" || digestSfValue(current.ref) !== digestSfValue(reference)) continue
    const target = reference.target
    const url = new URL(input.url)
    url.pathname = url.pathname.replace(/\/dashboard\/?$/, `/${target.surface}`); url.search = ""; url.hash = ""
    if (target.surface === "planner") { url.searchParams.set("page", "Overview"); url.searchParams.set("version", target.recordId) }
    else if (target.surface === "procurement") {
      if (target.recordType === "procurement-request-selection") { url.searchParams.set("page", "Requests"); url.searchParams.set("filter", "All") }
      else if (target.recordType.includes("supplier")) { url.searchParams.set("page", "Suppliers"); url.searchParams.set("supplier", target.recordId) }
      else if (target.recordType.includes("request")) { url.searchParams.set("page", "Requests"); url.searchParams.set("request", target.recordId) }
      else continue
    } else {
      let page = target.recordType === "dashboard-page" ? target.recordId : undefined
      if (!page) {
        const pages: Record<string, string> = { hotTopics: "Hot Topics & Actions", projects: "All Projects", members: "Talent Review", risks: "IT Risks", contracts: "Vendor Contracts", stakeholders: "Stakeholder Management", opsTickets: "IT Operations", secKpi: "IT Security KPIs", opexOwners: "OPEX Detail", capexProjects: "CAPEX Projects", "itperf-item": "IT Performance Contract" }
        page = pages[target.recordType]
      }
      if (!page) continue
      url.searchParams.set("page", page)
      const scoped = page === "IT Operations" ? ["opsYear", "operationsMonth"] :
        page === "IT Security KPIs" ? ["secYear", "securityMonth"] : page === "Executive Dashboard" ? ["execYear", "executiveMonth"] : undefined
      if (scoped) {
        // These pages render one calendar month. A partial or multi-month
        // source cannot be represented by silently choosing its first month.
        const period = target.period
        if (!isSfPeriod(period)) continue
        const year = period.start.slice(0, 4), month = period.start.slice(5, 7)
        if (!/^202[4-7]$/.test(year) || period.start !== `${year}-${month}-01` ||
          period.end !== `${year}-${month}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}`) continue
        url.searchParams.set(scoped[0]!, year)
        url.searchParams.set(scoped[1]!, String(Number(month)))
      }
    }
    if (target.period) url.searchParams.set("year", target.period.start.slice(0, 4))
    links.push({ label: `${target.surface} · ${target.recordId} · v${target.version}${target.period ? ` · ${target.period.start} a ${target.period.end}` : ""}`, url: `${url.pathname}${url.search}` })
  }
  return await input.business.host.revalidate(input.call) ? [...new Map(links.map((link) => [link.url, link])).values()] : []
}
