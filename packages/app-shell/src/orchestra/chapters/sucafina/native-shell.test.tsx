import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { SucafinaRequestError } from "./contract"
import type { ControllerState } from "./contract"
import type { Platform } from "@/context/platform"

// The shared DOM compiler lives outside the app's composite TypeScript project.
const { solidDom } = await import("../../../../test-browser/" + "solid-dom") as {
  solidDom: (specifier: string, dir: string) => string
}
const { NativeShell }: typeof import("./native-shell") = await import(solidDom("./native-shell", import.meta.dir))
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { createLocalePlatform } = await import("../../../../test-browser/" + "native-locale-fixture") as {
  createLocalePlatform: () => Platform
}

const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((close) => close()))

function page(canWrite = true): Sucafina.PageState {
  return {
    surface: "planner", page: "Overview", pages: ["Overview", "OPEX", "CAPEX", "Headcount", "Entities & allocations", "FX rates", "Versions"],
    actor: { id: "operator", name: "Owner", canWrite, roles: ["admin"], assigned: [], domains: [] },
    year: 2026, month: 1, data: {}, versions: {}, directory: [],
  }
}

function draft(name = "Overview"): Sucafina.Command {
  return { page: name, action: "save", version: 1, values: {} }
}

function mount(initial: ControllerState = { page: page(), loading: false, saving: false, warnings: [] }, locale: "en" | "br" = "en") {
  const [state, setState] = createSignal(initial)
  const [surfaces, setSurfaces] = createSignal<readonly Sucafina.Surface[]>(["dashboard", "planner", "procurement"])
  const calls = { save: 0, refresh: 0, discard: 0, surfaces: [] as string[], pages: [] as string[] }
  const context: { language?: ReturnType<typeof useLanguage> } = {}
  const host = document.createElement("div")
  const filter = document.createElement("div")
  filter.dataset.testid = "filter"
  filter.textContent = "Authorized filters"
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale, get children() { return createComponent(() => {
        context.language = useLanguage()
        return createComponent(NativeShell, {
    controller: {
      state,
      async save() { calls.save++ },
      async refresh() { calls.refresh++ },
      async discardDraft() { calls.discard++ },
    },
    surface: "planner",
    get surfaces() { return surfaces() },
    onSurface(value) { calls.surfaces.push(value) },
    onPage(value) { calls.pages.push(value) },
    filters: filter,
    children(value) {
      const child = document.createElement("div")
      child.dataset.testid = "child"
      child.textContent = `Authorized page: ${value.page}`
      return child
    },
        })
      }, {}) },
    }) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, calls, state, setState, setSurfaces, language: context.language! }
}

function button(host: HTMLElement, label: string) {
  const found = [...host.querySelectorAll("button")].find((item) => item.textContent?.trim() === label)
  if (!found) throw new Error(`Missing button ${label}`)
  return found
}

function select(host: HTMLElement, label: string) {
  const found = [...host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent === label)?.querySelector("select")
  if (!found) throw new Error(`Missing selector ${label}`)
  return found
}

test("selectors expose and forward only authorized applications and pages", () => {
  const view = mount()
  const application = select(view.host, "Application")
  const pages = select(view.host, "Page")
  expect([...application.options].map((option) => option.value)).toEqual(["dashboard", "planner", "procurement"])
  expect([...application.options].map((option) => option.textContent)).toEqual(["Dashboard", "Planner", "Procurement"])
  expect([...pages.options].map((option) => option.value)).toEqual(["Overview", "OPEX", "CAPEX", "Headcount", "Entities & allocations", "FX rates", "Versions"])
  expect(pages.value).toBe("Overview")
  expect(application.value).toBe("planner")
  application.value = "dashboard"
  application.dispatchEvent(new Event("change", { bubbles: true }))
  pages.value = "OPEX"
  pages.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls.surfaces).toEqual(["dashboard"])
  expect(view.calls.pages).toEqual(["OPEX"])
  view.setSurfaces([])
  expect(select(view.host, "Application").disabled).toBe(true)
})

test("forged selector values are not forwarded", () => {
  const view = mount()
  const application = select(view.host, "Application")
  const pages = select(view.host, "Page")
  for (const target of [application, pages]) {
    const forged = document.createElement("option")
    forged.value = "unauthorized"
    target.append(forged)
    target.value = forged.value
    target.dispatchEvent(new Event("change", { bubbles: true }))
  }
  expect(view.calls.surfaces).toEqual([])
  expect(view.calls.pages).toEqual([])
})

test("save requires a matching writable draft and an idle controller", () => {
  const view = mount()
  const save = button(view.host, "Save")
  expect(save.disabled).toBe(true)
  view.setState((current) => ({ ...current, draft: draft("Other") }))
  expect(save.disabled).toBe(true)
  view.setState((current) => ({ ...current, draft: draft(), page: page(false) }))
  expect(save.disabled).toBe(true)
  view.setState((current) => ({ ...current, page: page(), loading: true }))
  expect(save.disabled).toBe(true)
  expect(view.host.textContent).toContain("Unsaved changes")
  expect([...view.host.querySelectorAll('[role="status"]')].map((item) => item.textContent)).toContain("Loading…")
  expect(button(view.host, "Refresh").disabled).toBe(true)
  expect(button(view.host, "Discard changes and reload").disabled).toBe(true)
  view.setState((current) => ({ ...current, loading: false, saving: true }))
  expect(save.disabled).toBe(true)
  expect([...view.host.querySelectorAll('[role="status"]')].map((item) => item.textContent)).toContain("Saving…")
  expect(button(view.host, "Refresh").disabled).toBe(true)
  expect(button(view.host, "Discard changes and reload").disabled).toBe(true)
  view.setState((current) => ({ ...current, saving: false }))
  expect(save.disabled).toBe(false)
})

test("save, refresh and discard delegate to the controller", () => {
  const view = mount({ page: page(), draft: draft(), loading: false, saving: false, warnings: [] })
  expect([...view.host.querySelectorAll("button")].map((item) => item.type)).toEqual(["button", "button", "button"])
  button(view.host, "Save").click()
  button(view.host, "Refresh").click()
  button(view.host, "Discard changes and reload").click()
  expect([view.calls.save, view.calls.refresh, view.calls.discard]).toEqual([1, 1, 1])
  view.setState((current) => ({ ...current, draft: undefined }))
  expect(view.host.textContent).not.toContain("Discard changes and reload")
  view.setState((current) => ({ ...current, conflict: new SucafinaRequestError(409, "Conflict") }))
  expect(button(view.host, "Discard changes and reload").disabled).toBe(false)
})

test("renders warnings, validation and conflict as text without exposing stored data", () => {
  const hostile = '<img src=x onerror="alert(1)">'
  const view = mount({
    page: page(), loading: false, saving: false, warnings: [hostile],
    error: new SucafinaRequestError(422, hostile, { errors: [hostile] }),
    conflict: new SucafinaRequestError(409, hostile, { by: hostile, stored: { secret: "do-not-display" } }),
  })
  const alerts = [...view.host.querySelectorAll('[role="alert"]')]
  expect(alerts).toHaveLength(2)
  expect(alerts[0]?.textContent).toContain(hostile)
  expect(alerts[1]?.textContent).toContain(hostile)
  expect(view.host.querySelector('[role="status"]')?.textContent).toContain(hostile)
  expect(view.host.querySelector("img")).toBeNull()
  expect(view.host.textContent).not.toContain("do-not-display")
  expect(alerts[1]?.querySelector("bdi")?.textContent).toBe(hostile)
  expect(alerts[1]?.textContent).toContain(`Last changed by ${hostile}.`)
})

test("removes filters, identity, page choices and children when authorization clears the page", () => {
  const view = mount()
  expect(view.host.querySelector("h1")?.textContent).toBe("Overview")
  expect(view.host.querySelector("header p")?.textContent).toBe("Explore and manage Sucafina information.")
  expect(view.host.querySelector('[data-testid="filter"]')).not.toBeNull()
  expect(view.host.querySelector('[data-testid="child"]')?.textContent).toBe("Authorized page: Overview")
  expect(view.host.querySelector("bdi")?.textContent).toBe("Owner")
  view.setState((current) => ({ ...current, page: undefined, draft: undefined }))
  expect(view.host.querySelector("h1")?.textContent).toBe("Sucafina")
  expect(view.host.querySelector('[data-testid="filter"]')).toBeNull()
  expect(view.host.querySelector('[data-testid="child"]')).toBeNull()
  expect(view.host.querySelector("bdi")).toBeNull()
  expect([...view.host.querySelectorAll("label")].some((label) => label.textContent?.includes("Page"))).toBe(false)
  expect(view.host.textContent).toContain("No page is available")
  expect(button(view.host, "Save").disabled).toBe(true)
  view.setState((current) => ({ ...current, page: page(false) }))
  expect(view.host.querySelector('[data-testid="filter"]')).not.toBeNull()
  expect(view.host.querySelector('[data-testid="child"]')).not.toBeNull()
  expect(view.host.textContent).toContain("Read-only")
})


test("English shell copy retains exact text and page labels", () => {
  const view = mount()
  expect(view.host.querySelector("h1")?.textContent).toBe("Overview")
  expect(view.host.querySelector("header p")?.textContent).toBe("Explore and manage Sucafina information.")
  expect(view.host.textContent).toContain("Signed in as Owner")
  expect([...select(view.host, "Page").options].map((option) => option.textContent)).toEqual(["Overview", "OPEX", "CAPEX", "Headcount", "Entities & allocations", "FX rates", "Versions"])
})

test("Portuguese shell translates labels without changing page values or exposing markup", async () => {
  const current = page(false)
  const hostile = '<img src=x onerror="alert(1)">'
  const view = mount({ page: { ...current, actor: { ...current.actor, name: hostile }, pages: [...current.pages, hostile] }, loading: false, saving: false, warnings: [] }, "br")
  await view.language.ready.promise
  for (let attempt = 0; attempt < 100 && (view.language.locale() !== "br" || view.language.t("sucafina.native.shell.readOnly") !== "Somente leitura"); attempt++) await Bun.sleep(10)
  expect(view.language.locale()).toBe("br")
  expect(view.language.t("sucafina.native.shell.readOnly")).toBe("Somente leitura")
  expect(view.host.textContent).toContain("Somente leitura")
  expect(view.host.textContent).toContain(`Conectado como ${hostile}`)
  expect(view.host.querySelector("h1")?.textContent).toBe("Visão geral")
  expect(view.host.querySelector("img")).toBeNull()
  const pages = select(view.host, "Página")
  expect([...pages.options].map((option) => option.value)).toEqual([...current.pages, hostile])
  expect([...pages.options].at(-1)?.textContent).toBe(hostile)
  pages.value = "Headcount"
  pages.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls.pages).toEqual(["Headcount"])
  expect(button(view.host, "Salvar").disabled).toBe(true)
})


test("changing locale updates the same shell and keeps route values", async () => {
  const current = page(false)
  const name = "ليلى Alice"
  const view = mount({ page: { ...current, actor: { ...current.actor, name } }, loading: false, saving: false, warnings: [], conflict: new SucafinaRequestError(409, "Conflict", { by: name }) })
  await view.language.ready.promise
  expect(view.language.locale()).toBe("en")
  expect(view.host.querySelector("h1")?.textContent).toBe("Overview")
  expect(view.host.querySelector("bdi")?.textContent).toBe(name)
  expect(view.host.querySelector('[role="alert"] bdi')?.textContent).toBe(name)
  expect(view.host.textContent).toContain(`Signed in as ${name}`)
  expect(view.host.textContent).toContain(`Last changed by ${name}.`)
  view.language.setLocale("br")
  for (let attempt = 0; attempt < 100 && (view.language.locale() !== "br" || view.language.t("sucafina.native.shell.page.overview") !== "Visão geral"); attempt++) await Bun.sleep(10)
  expect(view.language.locale()).toBe("br")
  expect(view.language.t("sucafina.native.shell.page.overview")).toBe("Visão geral")
  expect(view.host.querySelector("h1")?.textContent).toBe("Visão geral")
  expect(select(view.host, "Página").options[0]?.textContent).toBe("Visão geral")
  expect(select(view.host, "Aplicativo").options[0]?.textContent).toBe("Painel")
  expect([...select(view.host, "Página").options].map((option) => option.value)).toEqual([...current.pages])
  expect(view.host.querySelector("bdi")?.textContent).toBe(name)
  view.language.setLocale("en")
  for (let attempt = 0; attempt < 100 && (view.language.locale() !== "en" || view.language.t("sucafina.native.shell.page.overview") !== "Overview"); attempt++) await Bun.sleep(10)
  expect(view.language.locale()).toBe("en")
  expect(view.language.t("sucafina.native.shell.page.overview")).toBe("Overview")
  expect(view.host.querySelector("h1")?.textContent).toBe("Overview")
  expect(select(view.host, "Page").options[0]?.textContent).toBe("Overview")
  expect(select(view.host, "Application").options[0]?.textContent).toBe("Dashboard")
  expect([...select(view.host, "Page").options].map((option) => option.value)).toEqual([...current.pages])
})
