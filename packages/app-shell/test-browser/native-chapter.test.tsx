import { afterEach, expect, test } from "bun:test"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { Sucafina } from "@orchestra/schema/sucafina"
import type { Selection } from "../src/orchestra/chapters/sucafina/contract"
import { solidDom } from "./solid-dom"

const { NativeAccessGate }: typeof import("../src/orchestra/chapters/sucafina/native-access-gate") = await import(solidDom("../src/orchestra/chapters/sucafina/native-access-gate", import.meta.dir))
const { NativeChapter }: typeof import("../src/orchestra/chapters/sucafina/native-chapter") = await import(solidDom("../src/orchestra/chapters/sucafina/native-chapter", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") = await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") = await import(solidDom("../src/context/platform", import.meta.dir))
const { createLocalePlatform }: typeof import("./native-locale-fixture") = await import(solidDom("./native-locale-fixture", import.meta.dir))
const { SF_NATIVE_ACCESS_COPY }: typeof import("../src/i18n/orchestra-chapters/sucafina-native-access") = await import(solidDom("../src/i18n/orchestra-chapters/sucafina-native-access", import.meta.dir))

const origin = "http://localhost:4110"
const initial: Selection = { surface: "dashboard", query: { page: "Headcount Overview", year: "2026" } }
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
  for (let turn = 0; turn < 200 && !check(); turn++) await new Promise((resolve) => setTimeout(resolve, 0))
  expect(check()).toBe(true)
}
async function settle() {
  for (let turn = 0; turn < 80; turn++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function mount(options: { gate?: boolean; selection?: Selection; autoUpdate?: boolean } = {}) {
  const calls: { url: string; signal: AbortSignal | null | undefined; response: ReturnType<typeof Promise.withResolvers<Response>> }[] = []
  // The HTTP seam deliberately permits a late response after cancellation.
  const controlled = Object.assign((input: string | URL | Request, init: RequestInit = {}) => {
    const response = Promise.withResolvers<Response>()
    calls.push({ url: input instanceof Request ? input.url : String(input), signal: init.signal ?? (input instanceof Request ? input.signal : undefined), response })
    return response.promise
  }, { preconnect: fetch.preconnect })
  const [selection, setSelection] = createSignal<Selection>(options.selection ?? initial)
  const emitted: Selection[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const chapter = () => createComponent(NativeChapter, {
    get selection() { return selection() },
    onSelection(value) { emitted.push(structuredClone(value)); if (options.autoUpdate !== false) setSelection(value) },
    fetch: controlled,
  })
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale: "en",
      get children() {
        if (options.gate === false) return chapter()
        return createComponent(NativeAccessGate, { origin, fetch: controlled, children: () => chapter() })
      },
    }) },
  }), host)
  let closed = false
  const close = () => { if (closed) return; closed = true; dispose(); host.remove() }
  cleanups.push(close)
  return { host, calls, emitted, selection, setSelection, close }
}

type View = ReturnType<typeof mount>
function reply(view: View, index: number, body: unknown, code = 200) {
  view.calls[index]!.response.resolve(Response.json(body, { status: code }))
}
async function admitted(view: View, body: Sucafina.Status = status) {
  await until(() => view.calls.length === 1)
  expect(new URL(view.calls[0]!.url).pathname).toBe("/api/sucafina/status")
  reply(view, 0, body)
  await until(() => view.calls.length === 2)
}
async function shown(view: View) {
  await admitted(view)
  reply(view, 1, page)
  await until(() => Boolean(view.host.textContent?.includes("Projected Person")))
}
function selectLabel(view: View, label: string, value: string) {
  const element = [...view.host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent === label)?.querySelector("select")
  if (!element) throw new Error(`Missing ${label} selector`)
  element.value = value
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

test("outside the gate the chapter shows access guidance and makes no request", async () => {
  const view = mount({ gate: false })
  await settle()
  expect(view.calls).toEqual([])
  expect(view.host.textContent).not.toContain("Projected Person")
  expect([SF_NATIVE_ACCESS_COPY["sucafina.native.access.signedOut"], SF_NATIVE_ACCESS_COPY["sucafina.native.access.signedOutDescription"], SF_NATIVE_ACCESS_COPY["sucafina.native.access.unconfigured"], SF_NATIVE_ACCESS_COPY["sucafina.native.access.unconfiguredDescription"]].some((copy) => view.host.textContent?.includes(copy))).toBe(true)
})

test("held gate status permits no state read or host bootstrap", async () => {
  const view = mount()
  await until(() => view.calls.length === 1)
  await settle()
  expect(view.calls.map((call) => new URL(call.url).pathname)).toEqual(["/api/sucafina/status"])
  expect(view.host.textContent).not.toContain("Projected Person")
})

test("verified session reads exactly once from its origin and renders the projected row", async () => {
  const view = mount()
  await shown(view)
  expect(view.calls).toHaveLength(2)
  const request = new URL(view.calls[1]!.url)
  expect(request.origin).toBe(origin)
  expect(request.pathname).toBe("/api/sucafina/dashboard/state")
  expect(request.searchParams.get("page")).toBe("Headcount Overview")
  expect(request.searchParams.get("year")).toBe("2026")
  expect(view.host.querySelector('[data-sf-view-group="dashboard-people"]')?.textContent).toContain("Projected Person")
})

test("view query, page and surface changes emit parent selections and fetch only after updates", async () => {
  const view = mount({ autoUpdate: false })
  await shown(view)
  selectLabel(view, "Year", "2025")
  expect(view.emitted.at(-1)).toEqual({ surface: "dashboard", query: { page: "Headcount Overview", year: "2025" } })
  await settle()
  expect(view.calls).toHaveLength(2)
  view.setSelection(view.emitted.at(-1)!)
  await until(() => view.calls.length === 3)
  expect(new URL(view.calls[2]!.url).searchParams.get("year")).toBe("2025")
  reply(view, 2, { ...page, year: 2025 })
  await until(() => Boolean(view.host.textContent?.includes("Projected Person")))
  selectLabel(view, "Page", "Team Structure")
  expect(view.emitted.at(-1)).toEqual({ surface: "dashboard", query: { page: "Team Structure", year: "2025" } })
  await settle()
  expect(view.calls).toHaveLength(3)
  view.setSelection(view.emitted.at(-1)!)
  await until(() => view.calls.length === 4)
  expect(new URL(view.calls[3]!.url).searchParams.get("page")).toBe("Team Structure")
  reply(view, 3, { ...page, page: "Team Structure", year: 2025, data: { ...page.data, cio: {} } })
  await until(() => Boolean(view.host.textContent?.includes("Projected Person")))
  selectLabel(view, "Application", "planner")
  expect(view.emitted.at(-1)).toEqual({ surface: "planner", query: {} })
  await settle()
  expect(view.calls).toHaveLength(4)
  view.setSelection(view.emitted.at(-1)!)
  await until(() => view.calls.length === 5)
  const request = new URL(view.calls[4]!.url)
  expect(request.origin).toBe(origin)
  expect(request.pathname).toBe("/api/sucafina/planner/state")
  expect(request.searchParams.has("page")).toBe(false)
  expect(request.searchParams.has("year")).toBe(false)
})

test("unauthorized surface clears visible data and starts no read", async () => {
  const view = mount()
  await shown(view)
  view.setSelection({ surface: "procurement", query: { page: "Suppliers" } })
  await settle()
  expect(view.calls).toHaveLength(2)
  expect(view.host.textContent).not.toContain("Projected Person")
})

test("401, 403 and a mismatched response principal invalidate gate and hide private data", async () => {
  for (const failure of [401, 403, "identity"] as const) {
    const view = mount()
    await shown(view)
    view.setSelection({ surface: "dashboard", query: { page: "Headcount Overview", year: "2025" } })
    await until(() => view.calls.length === 3)
    if (failure === "identity") reply(view, 2, { ...page, actor: { ...page.actor, id: "foreign" } })
    if (failure !== "identity") reply(view, 2, { secret: "PRIVATE-ERROR-BODY" }, failure)
    await until(() => Boolean(view.host.textContent?.includes("Sign in to Sucafina")))
    expect(view.host.textContent).not.toContain("Projected Person")
    expect(view.host.textContent).not.toContain("PRIVATE-ERROR-BODY")
    view.close()
  }
})

test("same-scope gate refresh retains the rendered node and does not read again", async () => {
  const view = mount()
  await shown(view)
  const node = view.host.querySelector('[data-sf-native-view]')
  expect(node).not.toBeNull()
  window.dispatchEvent(new Event("focus"))
  await until(() => view.calls.length === 3)
  expect(new URL(view.calls[2]!.url).pathname).toBe("/api/sucafina/status")
  reply(view, 2, structuredClone(status))
  await settle()
  expect(view.host.querySelector('[data-sf-native-view]')).toBe(node)
  expect(view.host.textContent).toContain("Projected Person")
  expect(view.selection()).toEqual(initial)
  expect(view.calls).toHaveLength(3)
})

test("changed gate scope aborts old read and ignores its late private response", async () => {
  const view = mount()
  await admitted(view)
  const old = view.calls[1]!
  window.dispatchEvent(new Event("focus"))
  await until(() => view.calls.length === 3)
  reply(view, 2, { ...status, sessionScope: "b".repeat(64) })
  await until(() => view.calls.length === 4)
  expect(old.signal?.aborted).toBe(true)
  reply(view, 1, { ...page, data: { members: [{ id: "old", name: "Old Private Row" }], leaders: [] } })
  await settle()
  expect(view.host.textContent).not.toContain("Old Private Row")
  reply(view, 3, page)
  await until(() => Boolean(view.host.textContent?.includes("Projected Person")))
})

test("disposing the chapter aborts a pending read and ignores its late response", async () => {
  const view = mount()
  await admitted(view)
  const pending = view.calls[1]!
  view.close()
  expect(pending.signal?.aborted).toBe(true)
  reply(view, 1, page)
  await settle()
  expect(view.host.textContent).not.toContain("Projected Person")
  expect(view.calls).toHaveLength(2)
})
