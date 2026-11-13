import { afterEach, expect, test } from "bun:test"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { solidDom } from "./solid-dom"

const { default: SucafinaPage }: typeof import("../src/orchestra/chapters/sucafina/page") = await import(solidDom("../src/orchestra/chapters/sucafina/page", import.meta.dir))
const { NativeAccessGate }: typeof import("../src/orchestra/chapters/sucafina/native-access-gate") = await import(solidDom("../src/orchestra/chapters/sucafina/native-access-gate", import.meta.dir))
const { LanguageProvider, loadLocaleDict }: typeof import("../src/context/language") = await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") = await import(solidDom("../src/context/platform", import.meta.dir))
const { createLocalePlatform }: typeof import("./native-locale-fixture") = await import(solidDom("./native-locale-fixture", import.meta.dir))

const status = {
  configured: true, authenticated: true, authentication: "local-operator", enrollmentRequired: false,
  surfaces: ["dashboard", "planner"], principal: { id: "operator-1", name: "Operator One" },
  sessionScope: "a".repeat(64), hostAuthenticated: true,
} satisfies Sucafina.Status
const page = {
  surface: "dashboard", page: "Headcount Overview", pages: ["Headcount Overview", "Team Structure"],
  actor: { id: status.principal.id, name: status.principal.name, canWrite: true, roles: ["admin"], assigned: [], domains: [] },
  year: 2026, month: 1, data: { members: [{ id: "member-1", name: "Projected Person", type: "Employee", status: "Active" }], leaders: [] },
  versions: {}, directory: [],
} satisfies Sucafina.PageState
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((close) => close()))

async function until(check: () => boolean) {
  for (let turn = 0; turn < 200 && !check(); turn++) await new Promise((resolve) => setTimeout(resolve, 5))
  expect(check()).toBe(true)
}
async function settle() {
  for (let turn = 0; turn < 40; turn++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 10))
}

function mount(path: string, options: { gate?: boolean; locale?: "en" | "br"; prior?: string } = {}) {
  const calls: { request: Request; response: ReturnType<typeof Promise.withResolvers<Response>> }[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const response = Promise.withResolvers<Response>()
    calls.push({ request, response })
    return response.promise
  } })
  const origin = server.url.origin
  const host = document.createElement("div")
  document.body.append(host)
  const history = createMemoryHistory()
  if (options.prior) history.set({ value: options.prior, scroll: false, replace: true })
  history.set({ value: path, scroll: false, replace: !options.prior })
  const route = () => createComponent(MemoryRouter, { history, get children() {
    return createComponent(Route, { path: "/orchestra/sucafina/*rest", component: SucafinaPage })
  } })
  let dispose: (() => void) | undefined
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    dispose?.()
    calls.forEach((call) => call.response.resolve(new Response(null, { status: 503 })))
    server.stop(true)
    host.remove()
  }
  cleanups.push(close)
  dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale: options.locale ?? "en",
      get children() {
        if (options.gate === false) return createComponent(SucafinaPage, {})
        return createComponent(NativeAccessGate, { origin, children: () => route() })
      },
    }) },
  }), host)
  return { calls, host, history, origin, close }
}

type View = ReturnType<typeof mount>
function reply(view: View, index: number, body: unknown, code = 200) {
  view.calls[index]!.response.resolve(Response.json(body, { status: code }))
}
async function grant(view: View) {
  await until(() => view.calls.length === 1)
  expect(new URL(view.calls[0]!.request.url).pathname).toBe("/api/sucafina/status")
  reply(view, 0, status)
  await until(() => view.calls.length >= 2)
}
async function shown(view: View) {
  await grant(view)
  reply(view, 1, page)
  await until(() => Boolean(view.host.textContent?.includes("Projected Person")))
}
function choose(view: View, label: string, value: string) {
  const element = [...view.host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent === label)?.querySelector("select")
  if (!element) throw new Error(`Missing ${label} select`)
  element.value = value
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

test("page without session or router renders access guidance and performs no IO", async () => {
  const view = mount("/orchestra/sucafina/dashboard", { gate: false })
  await settle()
  expect(view.calls).toHaveLength(0)
  expect(view.host.textContent).toContain("Sign in to Sucafina")
  expect(view.host.textContent).not.toContain("Projected Person")
})

test("held gate status keeps the actual route inert", async () => {
  const view = mount("/orchestra/sucafina/dashboard")
  await until(() => view.calls.length === 1)
  await settle()
  expect(view.calls.map((call) => new URL(call.request.url).pathname)).toEqual(["/api/sucafina/status"])
  expect(view.host.textContent).not.toContain("Projected Person")
})

test("base, invalid, unauthorized and extra route segments replace to the first permitted surface", async () => {
  for (const path of ["/orchestra/sucafina", "/orchestra/sucafina/unknown", "/orchestra/sucafina/procurement", "/orchestra/sucafina/dashboard/extra"]) {
    const prior = "/orchestra/sucafina/planner"
    const view = mount(path + "?page=Suppliers&server=https%3A%2F%2Fevil.example", { prior })
    await grant(view)
    await until(() => view.history.get() === "/orchestra/sucafina/dashboard")
    expect(view.calls).toHaveLength(2)
    const request = new URL(view.calls[1]!.request.url)
    expect(request.origin).toBe(view.origin)
    expect(request.pathname).toBe("/api/sucafina/dashboard/state")
    expect(request.search).toBe("")
    view.history.back()
    await until(() => view.history.get() === prior)
    expect(view.history.get()).toBe(prior)
    view.close()
  }
})

test("route round-trips known encoded filters and strips an injected server parameter from requests", async () => {
  const view = mount("/orchestra/sucafina/dashboard?page=Headcount%20Overview&year=2026&q=Caf%C3%A9%20%26%20tea&server=https%3A%2F%2Fevil.example")
  await shown(view)
  const initial = new URL(view.calls[1]!.request.url)
  expect(initial.origin).toBe(view.origin)
  expect(initial.searchParams.get("q")).toBe("Café & tea")
  expect(initial.searchParams.has("server")).toBe(false)
  choose(view, "Year", "2025")
  await until(() => view.calls.length === 3)
  const route = new URL(view.history.get(), view.origin)
  expect(route.searchParams.get("page")).toBe("Headcount Overview")
  expect(route.searchParams.get("q")).toBe("Café & tea")
  expect(route.searchParams.get("year")).toBe("2025")
  expect(route.searchParams.has("server")).toBe(false)
  const request = new URL(view.calls[2]!.request.url)
  expect(request.origin).toBe(view.origin)
  expect(request.searchParams.get("q")).toBe("Café & tea")
  expect(request.searchParams.get("year")).toBe("2025")
  reply(view, 2, { ...page, year: 2025 })
  await until(() => Boolean(view.host.textContent?.includes("Projected Person")))
  choose(view, "Page", "Team Structure")
  await until(() => view.calls.length === 4)
  expect(new URL(view.history.get(), view.origin).searchParams.get("page")).toBe("Team Structure")
  expect(new URL(view.calls[3]!.request.url).searchParams.get("page")).toBe("Team Structure")
  expect(new URL(view.calls[3]!.request.url).searchParams.get("q")).toBe("Café & tea")
})

test("surface control clears incompatible page and filters from the route and read", async () => {
  const view = mount("/orchestra/sucafina/dashboard?page=Headcount%20Overview&year=2026&q=old")
  await shown(view)
  choose(view, "Application", "planner")
  await until(() => view.calls.length === 3)
  expect(view.history.get()).toBe("/orchestra/sucafina/planner")
  const request = new URL(view.calls[2]!.request.url)
  expect(request.origin).toBe(view.origin)
  expect(request.pathname).toBe("/api/sucafina/planner/state")
  expect(request.search).toBe("")
})

test("navigation to an unauthorized surface never reads it or retains private rows", async () => {
  const view = mount("/orchestra/sucafina/dashboard?page=Headcount%20Overview")
  await shown(view)
  view.history.set({ value: "/orchestra/sucafina/procurement?page=Suppliers", replace: false, scroll: false })
  await until(() => view.history.get() === "/orchestra/sucafina/dashboard")
  await settle()
  expect(view.calls.every((call) => !new URL(call.request.url).pathname.includes("procurement"))).toBe(true)
  expect(view.host.textContent).not.toContain("Projected Person")
})

test("sign out clears private UI before held logout and failed logout never restores it", async () => {
  const view = mount("/orchestra/sucafina/dashboard?page=Headcount%20Overview")
  await shown(view)
  const button = [...view.host.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Sign out")
  expect(button).toBeDefined()
  button!.click()
  expect(view.host.textContent).not.toContain("Projected Person")
  await until(() => view.calls.length === 3)
  const logout = view.calls[2]!.request
  expect(new URL(logout.url).pathname).toBe("/api/sucafina/auth/logout")
  expect(logout.method).toBe("POST")
  view.calls[2]!.response.resolve(new Response("PRIVATE-LOGOUT-ERROR", { status: 500 }))
  await until(() => Boolean(view.host.querySelector('[role="alert"]')))
  expect(view.host.textContent).not.toContain("PRIVATE-LOGOUT-ERROR")
  expect(view.host.textContent).not.toContain("Projected Person")
  window.dispatchEvent(new Event("focus"))
  await settle()
  expect(view.calls).toHaveLength(3)
})

test("Brazilian Portuguese route exposes the actual Sair button", async () => {
  await loadLocaleDict("br")
  const view = mount("/orchestra/sucafina/dashboard?page=Headcount%20Overview", { locale: "br" })
  await shown(view)
  const button = [...view.host.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Sair")
  expect(button).toBeDefined()
  button!.click()
  expect(view.host.textContent).not.toContain("Projected Person")
  await until(() => view.calls.length === 3)
  expect(new URL(view.calls[2]!.request.url).pathname).toBe("/api/sucafina/auth/logout")
})
