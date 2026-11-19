import type { Actor, Environment, Snapshot } from "./contract.ts"
import { ProcurementModule } from "./procurement.ts"

export const REQUESTS_NEW = "/orchestra/sf-procurement/requests/new"
export const REQUESTS_LIST = "/orchestra/sf-procurement/requests"

const writer: Actor = { id: "orchestra-requests", canWrite: true, roles: ["admin", "requester", "buyer"] }

export function requestsRouteKind(pathname: string): "new" | "list" | undefined {
  if (pathname === REQUESTS_NEW) return "new"
  if (pathname === REQUESTS_LIST) return "list"
  return undefined
}

export function requestsRouteDocument(kind: "new" | "list", input?: {
  actor?: Actor
  data?: Record<string, unknown>
  versions?: Snapshot["versions"]
  at?: string
  postTo?: string
}): string {
  const at = input?.at ?? new Date().toISOString()
  const actor = input?.actor ?? writer
  const data = input?.data ?? { requests: [], formSettings: { currency: "USD" }, directory: [] }
  const body = ProcurementModule.render("Requests", data, {
    actor,
    year: Number(at.slice(0, 4)) || 2026,
    month: Number(at.slice(5, 7)) || 1,
    at,
    versions: input?.versions ?? {},
  }) ?? ""
  const opened = kind === "list" ? body.replaceAll("<details ", "<details open ") : body
  const postTo = input?.postTo ?? ""
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Requests</title></head><body><h1>Requests</h1>${opened}<script>${submitScript(postTo)}</script></body></html>`
}

export function requestsViewDocument(kind: "new" | "list", snapshot: Snapshot, actor: Actor, environment: Environment, postTo?: string): string {
  const viewed = ProcurementModule.domain.view(snapshot, actor, environment)
  return requestsRouteDocument(kind, {
    actor,
    data: viewed.data,
    versions: viewed.versions,
    at: environment.at,
    postTo,
  })
}

function submitScript(postTo: string): string {
  return `
document.querySelectorAll("form[data-command]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    const values = {}
    const assign = (name, value) => {
      const path = name.split(".")
      let node = values
      for (let index = 0; index < path.length - 1; index++) {
        node[path[index]] = node[path[index]] && typeof node[path[index]] === "object" ? node[path[index]] : {}
        node = node[path[index]]
      }
      node[path[path.length - 1]] = value
    }
    for (const input of form.elements) {
      if (!input.name || input.disabled || input.type === "submit" || input.type === "button") continue
      assign(input.name, input.type === "checkbox" ? input.checked : input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value)
    }
    const command = { page: form.dataset.page, action: form.dataset.command, id: form.dataset.record || undefined, version: Number(form.dataset.version || "0"), values }
    const targets = [${JSON.stringify(postTo)}, location.pathname, "/sucafina/procurement"].filter((target, index, all) => target && all.indexOf(target) === index)
    let ok = false
    for (const target of targets) {
      const response = await fetch(target, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(command) })
      const type = response.headers.get("content-type") || ""
      if (!response.ok || !type.includes("application/json")) continue
      const body = await response.json()
      if (body && body.ok === true) { ok = true; break }
    }
    if (ok) location.reload()
  })
})`
}
