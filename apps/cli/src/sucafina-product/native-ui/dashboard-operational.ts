import { Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { DashboardPortfolio } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages, sidebarYear } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { SF_DOMAIN_PAGES, projectSfDomainData, projectSfDomainVersions } from "./domain/projection.ts"
import type { SfNativeHostDependencies } from "./router.ts"

/** Only the mounted Portfolio view is known to be read-only; audited views stay off. */
export async function observeSfDashboardPages(application: SfNativeHostDependencies["application"], request: Request, stamp: SfContextStamp) {
  const environment = await application.environment(request)
  const now = new Date(environment.at)
  if (request.signal.aborted || !Number.isFinite(now.getTime())) return []
  const validate = {
    CAP09: Schema.is(SfDomain.operations["domain.page.CAP09"].output),
    CAP10: Schema.is(SfDomain.operations["domain.page.CAP10"].output),
    CAP13: Schema.is(SfDomain.operations["domain.page.CAP13"].output),
    CAP14: Schema.is(SfDomain.operations["domain.page.CAP14"].output),
    CAP15: Schema.is(SfDomain.operations["domain.page.CAP15"].output),
    CAP16: Schema.is(SfDomain.operations["domain.page.CAP16"].output),
  }
  const caps = ["CAP09", "CAP10", "CAP13", "CAP14", "CAP15", "CAP16"] as const
  const first = await application.persistence.transaction("dashboard", async (snapshot) => {
    const principal = await application.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef || request.signal.aborted)
      return { commit: false, value: undefined }
    const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((item): item is string => typeof item === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((item): item is string => typeof item === "string") : [] }
    const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
    const allowed = dashboardPages(actor, summaries)
    const selection = { year: sidebarYear(), month: now.getMonth() + 1 }
    const eligible = caps.filter((cap) => allowed.includes(SF_DOMAIN_PAGES[cap]) &&
      application.domains.dashboard.find((item) => item.pages.includes(SF_DOMAIN_PAGES[cap]))?.domain === DashboardPortfolio.domain)
    if (!eligible.length) return { commit: false, value: { observations: [], versionFence: JSON.stringify(snapshot.versions) } }
    const view = DashboardPortfolio.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
    const observations = caps.flatMap((cap) => {
      if (!eligible.includes(cap)) return []
      try {
        const data = projectSfDomainData(cap, publicSfData(view.data), selection.year)
        if (!data) return []
        const output = { status: "ok", context: stamp, value: { capabilityId: cap, selection, data,
          versions: projectSfDomainVersions(cap, view.versions), allowedActionIds: [] } }
        if (!validate[cap](output)) return []
        return [{ operationId: `domain.page.${cap}` as const, state: "ready" as const, reason: null, operational: true as const }]
      } catch {
        return []
      }
    })
    return { commit: false, value: { observations, versionFence: JSON.stringify(snapshot.versions) } }
  }, { signal: request.signal })
  if (!first || request.signal.aborted) return []
  const current = await application.persistence.transaction("dashboard", async (snapshot) => {
    const principal = await application.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef || request.signal.aborted ||
      JSON.stringify(snapshot.versions) !== first.versionFence) return { commit: false, value: [] }
    const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((item): item is string => typeof item === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((item): item is string => typeof item === "string") : [] }
    const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
    const allowed = dashboardPages(actor, summaries)
    return { commit: false, value: first.observations.filter((entry) => {
      const cap = caps.find((item) => entry.operationId === `domain.page.${item}`)
      if (!cap || !allowed.includes(SF_DOMAIN_PAGES[cap])) return false
      return application.domains.dashboard.find((item) => item.pages.includes(SF_DOMAIN_PAGES[cap]))?.domain === DashboardPortfolio.domain
    }) }
  }, { signal: request.signal })
  return request.signal.aborted ? [] : current
}
