import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import type { Application } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Actor } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { publicSfData } from "../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { documentHtml, esc, pageMain } from "../../../../modules/sucafina/Sucafinav1/src/screen-shell.ts"
import type { Surface } from "../../../../modules/sucafina/Sucafinav1/src/identity.ts"

const filters = [
  "version",
  "owner",
  "class",
  "q",
  "mode",
  "filter",
  "status",
  "risk",
  "priority",
  "topicStatus",
  "memberStatus",
  "projectStatus",
  "projectRisk",
  "stakeholderPriority",
  "opsMonth",
  "tab",
  "request",
  "supplier",
]

export async function renderInstalledConsole(request: Request, surface: string, application: Application): Promise<Response | undefined> {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined
  if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return undefined
  const named = surface
  const url = new URL(request.url)
  const page = url.searchParams.get("page")
  if (!page || url.searchParams.getAll("page").length !== 1) return undefined
  const environment = await application.environment(request)
  const prepared = await application.productView?.(request, named, page)
  const productView = prepared instanceof Response ? undefined : prepared
  try {
    const read = (work: (snapshot: Parameters<Parameters<Application["persistence"]["transaction"]>[1]>[0]) => Promise<{ commit: boolean; value: Response | undefined }>) =>
      application.assets
        ? application.assets.persistence.transaction(named, (snapshot) => work(snapshot), { signal: request.signal })
        : application.persistence.transaction(named, work, { signal: request.signal })
    return await read(async (snapshot) => {
      const principal = await application.authenticate(request, { surface: named, roleMap: roleMap(snapshot, named) })
      if (!principal || !principal.id || principal.id.startsWith("local:"))
        return { commit: false, value: text("Authentication required", 401) }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === named).map((row) => row.role)
      const actor: Actor = {
        id: principal.id,
        canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        roles,
        assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
        domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [],
      }
      const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string") : []
      const allowed = named === "dashboard" ? dashboardPages(actor, summaries) : named === "planner" ? plannerKeys(actor) : procurementKeys(actor)
      if (!allowed.includes(page)) return { commit: false, value: undefined }
      if (productView && !await productView.current(snapshot, actor))
        return { commit: false, value: text("The current queue is unavailable. Refresh the page to read the current authorized records.", 503) }
      const year = yearParam(url.searchParams.get("year"))
      if (year === null) return { commit: false, value: text("Invalid year", 400) }
      const now = new Date(environment.at)
      const monthParam = url.searchParams.get("month")
      if (monthParam && !/^([1-9]|1[0-2])$/.test(monthParam))
        return { commit: false, value: text("Invalid month", 400) }
      const contribution = application.domains[named].find((item) => item.pages.includes(page))
      const view = contribution?.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
      if (!view || !contribution) return { commit: false, value: undefined }
      const query = Object.fromEntries(filters.filter((key) => url.searchParams.has(key)).map((key) => [key, url.searchParams.get(key)]))
      const content = contribution.render(page, { ...publicSfData(view.data), ...query, sidebarYear: year ?? 2026, ...productView?.data }, {
        actor,
        year: year ?? Math.min(2027, Math.max(2024, now.getUTCFullYear())),
        month: monthParam ? Number(monthParam) : now.getUTCMonth() + 1,
        at: environment.at,
        versions: view.versions,
      })
      if (content === undefined) return { commit: false, value: text("Page implementation unavailable", 503) }
      const nav = allowed.map((key, index) => `<a data-index="${index}" href="?page=${encodeURIComponent(key)}">${esc(key)}</a>`).join("")
      const title = named === "dashboard" ? "CIO Dashboard" : named === "planner" ? "IT Budget Planner" : "IT Procurement"
      const html = documentHtml(title, named, nav, pageMain({ drawn: true, key: page, index: allowed.indexOf(page) }, content), "")
      return {
        commit: false,
        value: new Response(request.method === "HEAD" ? null : html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        }),
      }
    })
  } finally {
    productView?.finish()
  }
}

function yearParam(value: string | null): number | null | undefined {
  if (!value) return undefined
  return /^202[4-7]$/.test(value) ? Number(value) : null
}

function text(body: string, status: number) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
}

export type InstalledSurface = Surface
