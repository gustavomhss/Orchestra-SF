// Composição desta instalação. Não é plugin de ferramenta nem inicia outro servidor.
import { dashboardScreen } from "./src/dashboard-screen.ts"
import { plannerScreen } from "./src/planner-screen.ts"
import { procurementScreen } from "./src/procurement-screen.ts"
import type { ResolvedActor, Surface } from "./src/identity.ts"
import type { ScreenActor } from "./src/screen-shell.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "./src/nav.ts"

type Context = { request: Request; actor: ScreenActor }
type DashboardData = Omit<Parameters<typeof dashboardScreen>[0], "actor" | "key" | "year" | "ownYear">
type PlannerData = Omit<Parameters<typeof plannerScreen>[0], "actor" | "key">
type ProcurementData = Omit<Parameters<typeof procurementScreen>[0], "actor" | "key" | "filter" | "query">

export type Installation = {
  // O host autentica a sessão e resolve os papéis pelo directório. Nunca vem do corpo ou query.
  authenticate: (request: Request) => Promise<ResolvedActor | null>
  dashboard: (context: Context) => Promise<DashboardData>
  planner: (context: Context) => Promise<PlannerData>
  procurement: (context: Context) => Promise<ProcurementData>
}

/** Devolve undefined fora do mount para o host continuar o seu próprio router. Só leitura. */
export function createInstallationHandler(mount: string, installation: Installation) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(mount)) throw new Error("Invalid module mount")
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return undefined
    const surface = url.pathname.slice(mount.length + 1)
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return response("Not found", 404)
    if (request.method !== "GET" && request.method !== "HEAD")
      return response("Method not allowed", 405, { Allow: "GET, HEAD" })
    const resolved = await installation.authenticate(request)
    if (!resolved) return response("Authentication required", 401)
    const actor = surfaceActor(resolved, surface)
    if (!actor.roles.length) return response("Access denied", 403)
    if (surface === "planner" && !plannerKeys(actor).length) return response("Access denied", 403)
    if (surface === "procurement" && !procurementKeys(actor).length) return response("Access denied", 403)
    if (surface === "dashboard" && !dashboardPages(actor).length) return response("Access denied", 403)
    const page = url.searchParams.get("page") ?? undefined
    const year = readYear(url.searchParams.get("year"))
    const ownYear = readYear(url.searchParams.get("own"))
    if (year === null || ownYear === null) return response("Invalid year", 400)
    const context = { request, actor }
    const screen =
      surface === "dashboard"
        ? dashboardScreen({
            ...(await installation.dashboard(context)),
            actor,
            key: page,
            year,
            ownYear,
          })
        : surface === "planner"
          ? plannerScreen({
              ...(await installation.planner(context)),
              actor,
              key: page,
            })
          : procurementScreen({
              ...(await installation.procurement(context)),
              actor,
              key: page,
              filter: url.searchParams.get("filter") ?? undefined,
              query: url.searchParams.get("q") ?? undefined,
            })
    if (!screen.drawn.active.drawn) return response("Page unavailable", 403)
    return response(request.method === "HEAD" ? null : screen.html, 200, {
      "Content-Type": "text/html; charset=utf-8",
    })
  }
}

function surfaceActor(resolved: ResolvedActor, surface: Surface): ScreenActor {
  const roles = resolved.roles.filter((row) => row.surface === surface).map((row) => row.role)
  return {
    id: resolved.id,
    canWrite: resolved.canWrite && roles.some((role) => role !== "viewer"),
    roles,
  }
}

function readYear(value: string | null): number | null | undefined {
  if (value === null || value === "") return undefined
  if (!/^202[4-7]$/.test(value)) return null
  return Number(value)
}

function response(body: string | null, status: number, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
  })
}
