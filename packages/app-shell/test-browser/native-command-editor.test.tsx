import { afterEach, expect, test } from "bun:test"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { Sucafina } from "@orchestra/schema/sucafina"
import { Schema } from "effect"
import type { Selection } from "../src/orchestra/chapters/sucafina/contract"
import { solidDom } from "./solid-dom"

const { NativeAccessGate }: typeof import("../src/orchestra/chapters/sucafina/native-access-gate") = await import(solidDom("../src/orchestra/chapters/sucafina/native-access-gate", import.meta.dir))
const { NativeChapter }: typeof import("../src/orchestra/chapters/sucafina/native-chapter") = await import(solidDom("../src/orchestra/chapters/sucafina/native-chapter", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") = await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") = await import(solidDom("../src/context/platform", import.meta.dir))
const { createLocalePlatform }: typeof import("./native-locale-fixture") = await import(solidDom("./native-locale-fixture", import.meta.dir))

const origin = "http://localhost:4110"
const initial: Selection = { surface: "dashboard", query: { page: "Headcount Overview", year: "2026" } }
const status = {
  configured: true, authenticated: true, authentication: "local-operator", enrollmentRequired: false,
  surfaces: ["dashboard"], principal: { id: "editor-person", name: "Synthetic Editor" },
  sessionScope: "e".repeat(64), hostAuthenticated: true,
} satisfies Sucafina.Status
// Authorized literal descriptors qualify the generic UI, not domain eligibility or financial calculations.
const action = {
  key: "edit-profile", label: { en: "Save profile", br: "Salvar perfil" },
  target: { collection: "members", id: "fixture-member" },
  command: {
    page: "Headcount Overview", action: "fixture-save", id: "fixture-member", version: 7,
    values: {
      name: "Authorized profile", amount: 12, enabled: true, notes: "Fixture note", category: "7",
      untouched: { marker: "retain-default" },
      teams: [{ team: "Alpha", members: [{ name: "First member" }] }],
    },
  },
  fields: [
    { kind: "text", path: ["name"], label: { en: "Display name", br: "Nome de exibição" } },
    { kind: "number", path: ["amount"], label: { en: "Allocation", br: "Alocação" } },
    { kind: "checkbox", path: ["enabled"], label: { en: "Enabled", br: "Ativo" } },
    { kind: "textarea", path: ["notes"], label: { en: "Notes", br: "Notas" }, blank: "null" },
    {
      kind: "select", path: ["category"], label: { en: "Category", br: "Categoria" },
      options: [
        { value: 7, label: { en: "Numeric seven", br: "Sete numérico" } },
        { value: "7", label: { en: "Text seven", br: "Sete textual" } },
      ],
    },
    {
      kind: "list", path: ["teams"], label: { en: "Teams", br: "Equipes" },
      add: { team: "New team", members: [] }, remove: true,
      fields: [
        { kind: "text", path: ["team"], label: { en: "Team name", br: "Nome da equipe" } },
        {
          kind: "list", path: ["members"], label: { en: "Members", br: "Membros" },
          add: { name: "New member" }, remove: true,
          fields: [{ kind: "text", path: ["name"], label: { en: "Member name", br: "Nome do membro" } }],
        },
      ],
    },
  ],
} satisfies Sucafina.NativeAction
const page = Schema.decodeUnknownSync(Sucafina.PageState)({
  surface: "dashboard", page: "Headcount Overview", pages: ["Headcount Overview", "Team Structure"],
  actor: { id: status.principal.id, name: status.principal.name, canWrite: true, roles: ["admin"], assigned: [], domains: [] },
  year: 2026, month: 1,
  data: { members: [{ id: "fixture-member", name: "Projected Person", type: "Employee", status: "Active" }], leaders: [] },
  versions: { "members:fixture-member": { version: 7, by: "earlier-editor" } }, directory: [], actions: [action],
} satisfies Sucafina.PageState)
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
function mount(locale: "en" | "br" = "en") {
  const calls: { request: Request; response: ReturnType<typeof Promise.withResolvers<Response>>; replied: boolean }[] = []
  const controlled = Object.assign((input: string | URL | Request, init: RequestInit = {}) => {
    const response = Promise.withResolvers<Response>()
    calls.push({ request: new Request(input, init), response, replied: false })
    return response.promise
  }, { preconnect: fetch.preconnect })
  const [selection, setSelection] = createSignal<Selection>(initial)
  const emitted: Selection[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale,
      get children() { return createComponent(NativeAccessGate, {
        origin, fetch: controlled,
        children: () => createComponent(NativeChapter, {
          get selection() { return selection() },
          onSelection(value) { emitted.push(structuredClone(value)); setSelection(value) },
          fetch: controlled,
        }),
      }) },
    }) },
  }), host)
  const closed = { value: false }
  const close = () => { if (closed.value) return; closed.value = true; dispose(); host.remove() }
  cleanups.push(close)
  return { host, calls, emitted, selection, setSelection, close }
}
type Mounted = ReturnType<typeof mount>
function reply(view: Mounted, index: number, body: unknown, code = 200) {
  const call = view.calls[index]!
  call.replied = true
  call.response.resolve(Response.json(body, { status: code }))
}
async function admit(view: Mounted, body: unknown = page) {
  await until(() => view.calls.length === 1)
  expect(new URL(view.calls[0]!.request.url).pathname).toBe("/api/sucafina/status")
  reply(view, 0, status)
  await until(() => view.calls.length === 2)
  expect(new URL(view.calls[1]!.request.url).pathname).toBe("/api/sucafina/dashboard/state")
  reply(view, 1, body)
}
async function shown(view: Mounted, body: Sucafina.PageState = page) {
  await admit(view, body)
  await until(() => view.host.textContent?.includes("Projected Person") === true)
}
function controls(root: ParentNode, label: string) {
  return [...root.querySelectorAll("label")]
    .filter((item) => item.querySelector("span")?.textContent === label)
    .flatMap((item) => {
      const element = item.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")
      return element ? [element] : []
    })
}
function control(root: ParentNode, label: string) {
  const found = controls(root, label)
  if (found.length !== 1) throw new Error(`Expected one labeled ${label} control, received ${found.length}`)
  return found[0]!
}
function button(root: ParentNode, name: string) {
  const found = [...root.querySelectorAll("button")].filter((item) => (item.getAttribute("aria-label") ?? item.textContent?.trim()) === name)
  if (found.length !== 1) throw new Error(`Expected one ${name} button, received ${found.length}`)
  return found[0]!
}
function selectValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  if (!(element instanceof HTMLSelectElement)) throw new Error("Expected a select control")
  element.value = value
  element.dispatchEvent(new Event("change", { bubbles: true }))
}
function enter(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event("input", { bubbles: true }))
}
async function choose(view: Mounted, locale: "en" | "br" = "en") {
  selectValue(control(view.host, locale === "en" ? "Action" : "Ação"), action.key)
  await until(() => controls(view.host, locale === "en" ? "Display name" : "Nome de exibição").length === 1)
}
function posts(view: Mounted) {
  return view.calls.filter((call) => call.request.method === "POST")
}
async function posted(view: Mounted, count = 1) {
  await until(() => posts(view).length === count)
  const call = posts(view)[count - 1]!
  expect(new URL(call.request.url).origin).toBe(origin)
  expect(new URL(call.request.url).pathname).toBe("/api/sucafina/dashboard/commands")
  const body: unknown = await call.request.clone().json()
  return body
}
function lists(root: ParentNode, label: string) {
  return [...root.querySelectorAll("fieldset")].filter((item) => item.querySelector(":scope > legend")?.textContent === label)
}
function addRow(list: HTMLFieldSetElement) {
  const found = [...list.querySelectorAll("button")].filter((item) => item.closest("fieldset") === list && item.textContent?.trim() === "Add row")
  expect(found).toHaveLength(1)
  found[0]!.click()
}

test("edits labeled fields and posts the exact frozen command, CAS, zero, false and explicit null", async () => {
  const view = mount()
  await shown(view)
  await choose(view)
  enter(control(view.host, "Display name"), "Edited fixture")
  enter(control(view.host, "Allocation"), "0")
  const enabled = control(view.host, "Enabled")
  if (!(enabled instanceof HTMLInputElement)) throw new Error("Expected checkbox")
  enabled.checked = false
  enabled.dispatchEvent(new Event("change", { bubbles: true }))
  enter(control(view.host, "Notes"), "")
  expect([...view.host.querySelectorAll("textarea")].some((item) => item.value === JSON.stringify(action.command.values))).toBe(false)
  button(view.host, "Save profile").click()
  expect(await posted(view)).toEqual({
    ...action.command, confirmed: false,
    values: { ...action.command.values, name: "Edited fixture", amount: 0, enabled: false, notes: null },
  })
  const index = view.calls.indexOf(posts(view)[0]!)
  reply(view, index, { ok: true })
  await until(() => view.calls.length === index + 2)
  expect(view.calls[index + 1]!.request.method).toBe("GET")
  reply(view, index + 1, page)
  await until(() => controls(view.host, "Display name").length === 0)
  expect(posts(view)).toHaveLength(1)
})

test("typed select options preserve numeric seven separately from textual seven on the wire", async () => {
  for (const choice of [{ label: "Numeric seven", value: 7 }, { label: "Text seven", value: "7" }]) {
    const view = mount()
    await shown(view)
    await choose(view)
    const category = control(view.host, "Category")
    if (!(category instanceof HTMLSelectElement)) throw new Error("Expected Category select")
    const option = [...category.options].find((item) => item.textContent === choice.label)
    if (!option) throw new Error(`Missing ${choice.label}`)
    selectValue(category, option.value)
    button(view.host, "Save profile").click()
    expect(await posted(view)).toEqual({ ...action.command, confirmed: false, values: { ...action.command.values, category: choice.value } })
    view.close()
  }
})

test("nested list additions and removals post relative row edits without holes or unrelated value loss", async () => {
  const view = mount()
  await shown(view)
  await choose(view)
  addRow(lists(view.host, "Teams")[0]!)
  expect(controls(view.host, "Team name")).toHaveLength(2)
  enter(controls(view.host, "Team name")[1]!, "Beta")
  addRow(lists(view.host, "Members")[1]!)
  addRow(lists(view.host, "Members")[1]!)
  enter(controls(lists(view.host, "Members")[1]!, "Member name")[1]!, "Survivor")
  button(lists(view.host, "Members")[1]!, "Remove row 1: Members").click()
  button(lists(view.host, "Teams")[0]!, "Remove row 1: Teams").click()
  expect(controls(view.host, "Team name")).toHaveLength(1)
  expect(control(view.host, "Member name").value).toBe("Survivor")
  button(view.host, "Save profile").click()
  expect(await posted(view)).toEqual({
    ...action.command, confirmed: false,
    values: { ...action.command.values, teams: [{ team: "Beta", members: [{ name: "Survivor" }] }] },
  })
})

test("dangerous confirmation Cancel posts nothing and Yes sends confirmed true exactly once", async () => {
  const view = mount()
  await shown(view, { ...page, actions: [{ ...action, danger: true, confirm: { en: "Delete this fixture?", br: "Excluir este exemplo?" } }] })
  await choose(view)
  button(view.host, "Save profile").click()
  await until(() => view.host.querySelector("dialog[open]") !== null)
  expect(view.host.querySelector("dialog")?.textContent).toContain("Delete this fixture?")
  expect(posts(view)).toEqual([])
  button(view.host.querySelector("dialog")!, "Cancel").click()
  await settle()
  expect(view.host.querySelector("dialog")).toBeNull()
  expect(posts(view)).toEqual([])
  expect(control(view.host, "Display name").value).toBe(action.command.values.name)
  button(view.host, "Save profile").click()
  await until(() => view.host.querySelector("dialog[open]") !== null)
  button(view.host.querySelector("dialog")!, "Yes, continue").click()
  expect(await posted(view)).toEqual({ ...action.command, confirmed: true })
  await settle()
  expect(posts(view)).toHaveLength(1)
})

test("409 retains the edited draft, original CAS and conflict through refresh without automatic retry", async () => {
  const view = mount()
  await shown(view)
  await choose(view)
  enter(control(view.host, "Display name"), "Unsaved private name")
  button(view.host, "Save profile").click()
  const expected = { ...action.command, confirmed: false, values: { ...action.command.values, name: "Unsaved private name" } }
  expect(await posted(view)).toEqual(expected)
  reply(view, view.calls.indexOf(posts(view)[0]!), { ok: false, status: 409, by: "Other Editor", stored: { name: "Server revision" } }, 409)
  await until(() => view.host.querySelector('[role="alert"]')?.textContent?.includes("Changes conflict") === true)
  expect(view.host.textContent).toContain("Other Editor")
  expect(control(view.host, "Display name").value).toBe("Unsaved private name")
  button(view.host, "Refresh").click()
  await until(() => view.calls.length === 4)
  reply(view, 3, { ...page, actions: [{ ...action, command: { ...action.command, version: 99, values: { ...action.command.values, name: "New defaults" } } }] })
  await until(() => !button(view.host, "Refresh").disabled)
  await settle()
  expect(control(view.host, "Display name").value).toBe("Unsaved private name")
  expect(view.host.querySelector('[role="alert"]')?.textContent).toContain("Changes conflict")
  expect(posts(view)).toHaveLength(1)
  button(view.host, "Save profile").click()
  expect(await posted(view, 2)).toEqual(expected)
})

test("page, auth and descriptor withdrawal remove the private form without posting its draft", async () => {
  for (const withdrawal of ["page", "auth", "actions"] as const) {
    const view = mount()
    await shown(view)
    await choose(view)
    enter(control(view.host, "Display name"), "WITHDRAWN-PRIVATE-DRAFT")
    if (withdrawal === "page") view.setSelection({ surface: "dashboard", query: { page: "Team Structure", year: "2026" } })
    if (withdrawal !== "page") button(view.host, "Refresh").click()
    await until(() => view.calls.length === 3)
    const withdrawn = { ...page, page: withdrawal === "page" ? "Team Structure" : page.page, actions: [], data: { ...page.data, cio: {} } }
    reply(view, 2, withdrawal === "auth" ? { secret: "PRIVATE-DENIAL" } : withdrawn, withdrawal === "auth" ? 403 : 200)
    await until(() => controls(view.host, "Display name").length === 0)
    await settle()
    view.calls.forEach((call, index) => { if (!call.replied && call.request.method === "GET") reply(view, index, withdrawn) })
    await settle()
    expect(controls(view.host, "Action")).toHaveLength(0)
    expect(view.host.textContent).not.toContain("WITHDRAWN-PRIVATE-DRAFT")
    expect(view.host.textContent).not.toContain("PRIVATE-DENIAL")
    expect([...view.host.querySelectorAll("input,textarea")].some((item) => "value" in item && item.value === "WITHDRAWN-PRIVATE-DRAFT")).toBe(false)
    expect(posts(view)).toEqual([])
    view.close()
  }
})

test("malformed, prototype-path, duplicate and page-mismatched descriptors fail closed", async () => {
  const invalid = [
    [{ ...action, fields: [{ kind: "script", path: ["name"], label: { en: "Invalid", br: "Inválido" } }] }],
    [{ ...action, fields: [{ kind: "text", path: ["__proto__", "polluted"], label: { en: "Invalid", br: "Inválido" } }] }],
    [action, structuredClone(action)],
    [{ ...action, command: { ...action.command, page: "Team Structure" } }],
    [{ ...action, fields: [action.fields[0], action.fields[0]] }],
    [{ ...action, fields: [{ kind: "text", path: [], label: { en: "Invalid", br: "Inválido" } }] }],
  ]
  for (const actions of invalid) {
    const view = mount()
    await admit(view, { ...page, actions })
    await until(() => view.host.querySelector('[role="alert"]') !== null || view.host.textContent?.includes("Projected Person") === true)
    await settle()
    expect(controls(view.host, "Action")).toHaveLength(0)
    expect(controls(view.host, "Display name")).toHaveLength(0)
    expect(controls(view.host, "Invalid")).toHaveLength(0)
    expect(view.host.querySelector("dialog")).toBeNull()
    const save = button(view.host, "Save")
    expect(save.disabled).toBe(true)
    save.click()
    await settle()
    expect(posts(view)).toEqual([])
    view.close()
  }
})

test("unsaved navigation Cancel preserves the draft and Yes navigates, with human EN and BR labels", async () => {
  for (const locale of ["en", "br"] as const) {
    const view = mount(locale)
    await shown(view)
    await choose(view, locale)
    const name = locale === "en" ? "Display name" : "Nome de exibição"
    const pageLabel = locale === "en" ? "Page" : "Página"
    const cancel = locale === "en" ? "Cancel" : "Cancelar"
    const accept = locale === "en" ? "Yes, continue" : "Sim, continuar"
    expect([...view.host.querySelectorAll("h2")].some((heading) => heading.textContent === (locale === "en" ? "Save profile" : "Salvar perfil"))).toBe(true)
    enter(control(view.host, name), "Unsaved navigation fixture")
    selectValue(control(view.host, pageLabel), "Team Structure")
    await until(() => view.host.querySelector("dialog[open]") !== null)
    expect(view.host.querySelector("dialog")?.textContent).toContain(locale === "en" ? "Discard unsaved changes and continue?" : "Descartar alterações não salvas e continuar?")
    button(view.host.querySelector("dialog")!, cancel).click()
    await settle()
    expect(view.emitted).toEqual([])
    expect(view.calls).toHaveLength(2)
    expect(control(view.host, name).value).toBe("Unsaved navigation fixture")
    expect(control(view.host, pageLabel).value).toBe("Headcount Overview")
    selectValue(control(view.host, pageLabel), "Team Structure")
    await until(() => view.host.querySelector("dialog[open]") !== null)
    button(view.host.querySelector("dialog")!, accept).click()
    await until(() => view.calls.some((call) => new URL(call.request.url).searchParams.get("page") === "Team Structure"))
    expect(view.emitted).toEqual([{ surface: "dashboard", query: { ...initial.query, page: "Team Structure" } }])
    const next = view.calls.findIndex((call) => new URL(call.request.url).searchParams.get("page") === "Team Structure")
    reply(view, next, { ...page, page: "Team Structure", actions: [], data: { ...page.data, cio: {} } })
    await until(() => controls(view.host, pageLabel)[0]?.value === "Team Structure")
    expect(control(view.host, pageLabel).value).toBe("Team Structure")
    expect(controls(view.host, name)).toHaveLength(0)
    expect(posts(view)).toEqual([])
    view.close()
  }
})
