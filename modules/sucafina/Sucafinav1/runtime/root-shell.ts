import { roleMap } from "./admin.ts"
import { htmlPolicy } from "./application.ts"
import type { Application } from "./application.ts"
import { object } from "./contract.ts"
import type { Actor } from "./contract.ts"
import type { Surface } from "../src/identity.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV, dashboardPages, plannerKeys, procurementKeys } from "../src/nav.ts"
import { documentHtml, links, pageMain } from "../src/screen-shell.ts"

const plannerModes = new Set(["imports", "import-reference", "import-targets", "import-admit", "import-preview", "import-detail", "import-apply", "workbench-planner"])
const procurementModes = new Set(["documents", "document-scenario", "sourcing-dossier"])

/** The product document lives at `/`. Retired console paths stay on their own handler. */
export async function serveRootShell(request: Request, binding: {
  origin: string
  mount: string
  application: Application
  dispatch: (request: Request) => Promise<Response | undefined>
}): Promise<Response | undefined> {
  const url = new URL(request.url)
  if (url.origin !== binding.origin || url.pathname !== "/") return undefined
  if (!["GET", "HEAD", "POST"].includes(request.method))
    return text("Method not allowed", 405, { Allow: "GET, HEAD, POST" })
  const selected = selection(url)
  const chapter = await rewrite(request, `${binding.mount}/${selected.surface}`)
  if (request.method === "POST" || url.searchParams.has("sf")) {
    if (request.method !== "POST") {
      const product = await binding.application.product?.(chapter, selected.surface)
      if (product) return retarget(product, binding.mount)
    }
    return retarget(await binding.dispatch(chapter) ?? text("Not found", 404), binding.mount)
  }
  const environment = await binding.application.environment(chapter)
  const viewedPage = await binding.application.productView?.(chapter, selected.surface, selected.page)
  const prepared = viewedPage instanceof Response ? undefined : viewedPage
  try {
    return await binding.application.persistence.transaction(selected.surface, async (snapshot) => {
      const principal = await binding.application.authenticate(chapter, { surface: selected.surface, roleMap: roleMap(snapshot, selected.surface) })
      if (!principal?.id || principal.id.startsWith("local:"))
        return { commit: false, value: text("Authentication required", 401) }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === selected.surface).map((row) => row.role)
      const actor: Actor = {
        id: principal.id,
        canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        roles,
        assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
        domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [],
      }
      const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string") : []
      const allowed = selected.surface === "dashboard" ? dashboardPages(actor, summaries) : selected.surface === "planner" ? plannerKeys(actor) : procurementKeys(actor)
      if (!allowed.includes(selected.page)) return { commit: false, value: text("Access denied", 403) }
      const contribution = binding.application.domains[selected.surface].find((item) => item.pages.includes(selected.page))
      if (!contribution) return { commit: false, value: text("Page implementation unavailable", 503) }
      const viewed = contribution.domain.view(snapshot, actor, environment)
      const data = { ...viewed.data, ...prepared?.data, ...queryData(url) }
      const body = contribution.render(selected.page, data, {
        actor,
        year: yearOf(url, environment.at),
        month: monthOf(url, environment.at),
        at: environment.at,
        versions: viewed.versions,
      })
      if (body === undefined) return { commit: false, value: text("Page implementation unavailable", 503) }
      const nav = links(allowed.map((key, index) => ({ key, index })))
      const title = selected.surface === "planner" ? "IT Budget Planner" : selected.surface === "procurement" ? "Procurement" : "Dashboard"
      const html = documentHtml(title, selected.surface, nav, pageMain({ drawn: true, key: selected.page, index: allowed.indexOf(selected.page) }, body), "")
      return { commit: false, value: present(new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html) } }), binding.mount) }
    })
  } finally {
    prepared?.finish()
  }
}

function selection(url: URL): { surface: Surface; page: string } {
  const page = url.searchParams.get("page") ?? ""
  const mode = url.searchParams.get("sf") ?? ""
  if ((PROCUREMENT_NAV as readonly string[]).includes(page)) return { surface: "procurement", page }
  if ((PLANNER_TABS as readonly string[]).includes(page)) return { surface: "planner", page }
  if ((DASHBOARD_PAGES as readonly string[]).includes(page)) return { surface: "dashboard", page }
  if (plannerModes.has(mode)) return { surface: "planner", page: "Overview" }
  if (procurementModes.has(mode)) return { surface: "procurement", page: "Requests" }
  if (mode) return { surface: "dashboard", page: "Executive Dashboard" }
  const hinted = url.searchParams.get("surface")
  if (hinted === "planner") return { surface: "planner", page: "Overview" }
  if (hinted === "dashboard") return { surface: "dashboard", page: "Executive Dashboard" }
  return { surface: "procurement", page: "Requests" }
}

function queryData(url: URL) {
  return Object.fromEntries([...url.searchParams.entries()].filter(([key]) => key !== "sf" && key !== "surface"))
}

function yearOf(url: URL, at: string) {
  const year = Number(url.searchParams.get("year") ?? new Date(at).getUTCFullYear())
  return Number.isSafeInteger(year) ? year : new Date(at).getUTCFullYear()
}

function monthOf(url: URL, at: string) {
  const month = Number(url.searchParams.get("month") ?? new Date(at).getUTCMonth() + 1)
  return Number.isSafeInteger(month) ? month : 1
}

async function rewrite(request: Request, pathname: string) {
  const url = new URL(request.url)
  url.pathname = pathname
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer()
  return new Request(url, { method: request.method, headers: request.headers, body, signal: request.signal })
}

async function retarget(response: Response, mount: string) {
  const type = response.headers.get("content-type") ?? ""
  if (type.toLowerCase().includes("text/html")) return present(response, mount)
  if (!type.toLowerCase().includes("json") || !response.body) return response
  const body = (await response.text()).replaceAll(`${mount}/dashboard`, "/").replaceAll(`${mount}/planner`, "/").replaceAll(`${mount}/procurement`, "/")
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  return new Response(body, { status: response.status, headers })
}

async function present(response: Response, mount: string) {
  const type = response.headers.get("content-type") ?? ""
  if (!type.toLowerCase().includes("text/html") || !response.body) return response
  const html = (await response.text())
    .replaceAll(`${mount}/dashboard`, "/")
    .replaceAll(`${mount}/planner`, "/")
    .replaceAll(`${mount}/procurement`, "/")
  const linked = html.includes(">Workbench</a>") ? html : html.replace('aria-label="Applications">', 'aria-label="Applications"><a href="/?sf=workbench">Workbench</a>')
  const marked = linked.includes(">Decisions</") ? linked : linked.replace('<div id="content" class="content">', '<div id="content" class="content"><h2>Decisions</h2>')
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  headers.set("content-security-policy", htmlPolicy(marked))
  return new Response(marked, { status: response.status, headers })
}

function text(body: string, status: number, extra: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", ...extra } })
}
