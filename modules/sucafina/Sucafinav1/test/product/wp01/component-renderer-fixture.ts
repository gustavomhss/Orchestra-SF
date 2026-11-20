import { createHash } from "node:crypto"
import type { ModuleServices } from "../../../index.ts"
import { contributions } from "../../../index.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { object } from "../../../runtime/contract.ts"
import { roleMap } from "../../../runtime/admin.ts"
import type { Surface } from "../../../src/identity.ts"
import { dashboardPages, plannerKeys, procurementKeys, sidebarYear, showPage } from "../../../src/nav.ts"
import { documentHtml, esc, links, listed, pageMain } from "../../../src/screen-shell.ts"
import { publicSfData } from "../../../product/integration/public-state.ts"
import { dashboardWorkbenchScript, dashboardWorkbenchWidget } from "../../../product/interface/dashboard-workbench.ts"
import { personalViewsScript, personalViewsWidget } from "../../../product/ui/personal-views.ts"
import { plannerMonthlyScript } from "../../../product/ui/planner-monthly.ts"
import { contextualDecisionScript } from "../../../product/ui/contextual-decision.ts"
import { recordSearchScript, recordSearchWidget } from "../../../product/ui/record-search.ts"
import type { createTeamProfileIdentityBoundary } from "../../../runtime/team-profile-identity.ts"

export type ComponentWidgets = Readonly<{
  dashboardWorkbench?: boolean
  personalViews?: boolean
  recordSearch?: boolean
  contextualDecision?: boolean
  accessRevision?: boolean
}>
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-SF-Fixture-Surface": "authorized-component" }
const failure = (status: number) => new Response(null, { status, headers })
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const selectionKeys = ["version", "versionId", "q", "owner", "class", "mode", "filter", "status", "topicStatus", "memberStatus", "request", "supplier"] as const

function actorFor(principal: Awaited<ReturnType<ModuleServices["authenticate"]>>, snapshot: Snapshot, surface: Surface): Actor | undefined {
  if (!principal?.id || principal.id.startsWith("local:")) return undefined
  const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
  const access = object(object(snapshot.data.access)[principal.id])
  return {
    id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [],
  }
}
function allowedPages(actor: Actor, snapshot: Snapshot, surface: Surface) {
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
  return surface === "dashboard" ? dashboardPages(actor, summaries) : surface === "planner" ? plannerKeys(actor) : procurementKeys(actor)
}

/**
 * G04 component composition only. The installed legacy HTML routes remain 404.
 * Actual Microsoft/Team authentication and Domain.view/render own the projection;
 * the component never turns a context read or a Team label into a write grant.
 */
export function createAuthorizedComponentRenderer(input: Readonly<{
  origin: string
  mount: string
  boundary: ReturnType<typeof createTeamProfileIdentityBoundary>
  services: ModuleServices
  widgets?: ComponentWidgets
}>) {
  return async (request: Request, surface: Surface): Promise<Response> => {
    const url = new URL(request.url)
    if (request.method !== "GET" || url.origin !== input.origin || url.pathname !== input.mount + "/" + surface ||
      request.headers.get("sec-fetch-site") === "cross-site" || request.headers.has("origin") && request.headers.get("origin") !== input.origin)
      return failure(403)
    if ([...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) return failure(400)
    const admitted = await input.boundary.admit(request)
    if (!admitted) return failure(await input.boundary.identity.person(request) ? 403 : 401)
    const environment = await input.services.environment(request)
    const now = new Date(environment.at)
    if (!Number.isFinite(now.getTime())) return failure(503)
    const prepared = await input.services.productView?.(request, surface, url.searchParams.get("page") ?? undefined)
    if (prepared instanceof Response) return prepared
    try {
      const projection = await input.services.persistence.transaction(surface, async (snapshot) => {
        const principal = await input.services.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
        const actor = actorFor(principal, snapshot, surface)
        if (!actor || actor.id !== admitted.principal.principalObjectId) return { commit: false, value: undefined }
        const pages = allowedPages(actor, snapshot, surface)
        const page = url.searchParams.get("page") ?? (surface === "planner" && pages.includes("Overview") ? "Overview" : pages[0])
        if (!page || !pages.includes(page)) return { commit: false, value: undefined }
        const active = showPage(page)
        const contribution = contributions[surface].find((item) => item.pages.includes(page))
        if (!active.drawn || active.surface !== surface || !contribution) return { commit: false, value: undefined }
        if (prepared && !await prepared.current(snapshot, actor)) return { commit: false, value: undefined }
        const auditBefore = snapshot.audit.length
        const view = contribution.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
        const selected = Object.fromEntries(selectionKeys.flatMap((key) => url.searchParams.has(key) ? [[key, url.searchParams.get(key)]] : []))
        const sidebar = sidebarYear(url.searchParams.has("year") ? Number(url.searchParams.get("year")) : undefined)
        const ownYearKey = page === "Executive Dashboard" ? "execYear" : page === "IT Operations" ? "opsYear" : page === "IT Security KPIs" ? "secYear" : undefined
        const ownMonthKey = page === "Executive Dashboard" ? "executiveMonth" : page === "IT Operations" ? "operationsMonth" : page === "IT Security KPIs" ? "securityMonth" : undefined
        const year = ownYearKey ? sidebarYear(Number(url.searchParams.get(ownYearKey) ?? url.searchParams.get("own") ?? now.getUTCFullYear())) : sidebar
        const month = Number(ownMonthKey && url.searchParams.get(ownMonthKey) || url.searchParams.get("month") || now.getUTCMonth() + 1)
        if (!Number.isSafeInteger(month) || month < 1 || month > 12) return { commit: false, value: undefined }
        const body = contribution.render(page, { ...publicSfData(view.data), ...prepared?.data, ...selected },
          { actor, year, month, at: environment.at, versions: view.versions })
        if (body === undefined) return { commit: false, value: undefined }
        const revision = hash({ profile: admitted.profile, principal: admitted.principal, configRevision: admitted.configRevision, actor, roleMap: roleMap(snapshot, surface) })
        const years = [2024, 2025, 2026, 2027].map((value) => '<option' + (value === sidebar ? ' selected' : '') + '>' + value + '</option>').join("")
        const sidebarControls = '<label>Financial year<select data-year="sidebar">' + years + '</select></label>' +
          (input.widgets?.recordSearch ? recordSearchWidget(surface) : "")
        const content = body +
          (input.widgets?.dashboardWorkbench && surface === "dashboard" ? dashboardWorkbenchWidget(page) : "") +
          (input.widgets?.personalViews ? personalViewsWidget({ surface, page }) : "")
        const scripts = [
          surface === "planner" ? plannerMonthlyScript : "",
          input.widgets?.dashboardWorkbench && surface === "dashboard" ? dashboardWorkbenchScript : "",
          input.widgets?.personalViews ? personalViewsScript : "",
          input.widgets?.recordSearch ? recordSearchScript : "",
          input.widgets?.contextualDecision ? contextualDecisionScript : "",
        ].filter(Boolean)
        const title = surface === "dashboard" ? "CIO Dashboard" : surface === "planner" ? "IT Budget Planner" : "IT Procurement"
        const html = documentHtml(title, surface, links(listed(pages, surface)),
          pageMain({ drawn: true, key: page, index: active.index }, content), "", sidebarControls,
          input.widgets?.accessRevision === false ? undefined : revision)
          .replace("</body>", '<p data-component-fixture hidden>' + esc("G04 authorized component; installed navigation is covered by G02") +
            "</p>" + scripts.map((script) => "<script>" + script + "</script>").join("") + "</body>")
        return { commit: snapshot.audit.length > auditBefore, value: {
          html, page, actor: hash(actor), versions: hash(snapshot.versions), revision,
        } }
      }, { signal: request.signal })
      if (!projection) return failure(403)
      if (request.signal.aborted || !await input.boundary.profiles.revalidate(admitted)) return failure(403)
      const retained = await input.services.persistence.transaction(surface, async (snapshot) => {
        const principal = await input.services.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
        const actor = actorFor(principal, snapshot, surface)
        return { commit: false, value: !!actor && actor.id === admitted.principal.principalObjectId &&
          hash(actor) === projection.actor && allowedPages(actor, snapshot, surface).includes(projection.page) &&
          hash(snapshot.versions) === projection.versions && (!prepared || await prepared.current(snapshot, actor)) }
      }, { signal: request.signal })
      if (!retained || request.signal.aborted || !await input.boundary.profiles.revalidate(admitted)) return failure(403)
      return new Response(projection.html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8",
        ...(input.widgets?.accessRevision === false ? {} : { "X-SF-Access-Revision": projection.revision }) } })
    } finally { prepared?.finish() }
  }
}
