import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { Schema } from "effect"
import { batch, createComponent, createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { SfContext, type SfHref, type SfRef, type SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfSurfaceProps } from "../src/orchestra/chapters/sucafina/context/contracts"
import type { SfExecutiveLink, SfExecutiveSourceRoute } from "../src/orchestra/chapters/sucafina/cross-links"
import { SF_CROSS_COPY, SF_CROSS_COPY_BR } from "../src/i18n/orchestra-chapters/sf-cross"
import { SF_U02_COPY, SF_U02_COPY_BR } from "../src/i18n/orchestra-chapters/sf-u02"
import { SF_COMMON_COPY, SF_COMMON_COPY_BR } from "../src/i18n/orchestra-chapters/sf-common"

const stamp = {
  installationId: "cross-installation", projectId: "cross-project", hostId: "cross-host",
  principalRef: "cross-principal", policyVersion: "1", accessRevision: "1",
}
const context = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "local-operator",
  destinations: ["CAP01", "CAP02", "CAP13", "CAP15"].map((capabilityId) => ({
    capabilityId, surface: "dashboard", page: capabilityId, canRead: true, allowedActionIds: [],
  })),
  availability: ["CAP01", "CAP02", "CAP13", "CAP15"].map((resource) => ({
    family: "domain-read", resource, state: "ready",
    operations: [
      { operationId: "domain.page." + resource, state: "ready", reason: null, operational: true },
      ...(resource === "CAP01" ? ["projection.review", "dashboard.dashboard-agenda", "dashboard.dashboard-review-preserve"]
        .map((operationId) => ({ operationId, state: "ready", reason: null, operational: true })) : []),
    ],
  })),
})
type Reply = Readonly<{ status: number; body: unknown }>
const replies = new Map<string, Reply | (() => Promise<Reply>)>()
const reads: { id: string; input: unknown; signal: AbortSignal }[] = []
const navigations: { from: SfExecutiveSourceRoute; target: SfExecutiveLink }[] = []
const [locale, setLocale] = createSignal<"en" | "pt-BR">("en")
const [permission, setPermission] = createSignal<"ready" | "denied">("ready")
const [generation, setGeneration] = createSignal(1)
const translate = (name: string, values: Record<string, string | number> = {}) => {
  const dictionary = locale() === "en"
    ? { ...SF_COMMON_COPY, ...SF_U02_COPY, ...SF_CROSS_COPY }
    : { ...SF_COMMON_COPY_BR, ...SF_U02_COPY_BR, ...SF_CROSS_COPY_BR }
  return String(Reflect.get(dictionary, name) ?? name)
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""))
}
function page(capabilityId: string, data?: object): Reply {
  const empty: Record<string, object> = {
    CAP01: { signals: [] }, CAP02: { hotTopics: [] }, CAP13: { risks: [] }, CAP15: { stakeholders: [] },
  }
  return {
    status: 200, body: {
      status: "ok", context: stamp,
      value: { capabilityId, selection: {}, data: data ?? empty[capabilityId], versions: {}, allowedActionIds: [] },
    },
  }
}
// Authentication/IO and F01 admission are explicit fixture boundaries. The typed clients,
// response codecs, availability guard, read lifecycle, views and StatePanel are production code.
const transport: SfTransport = {
  execute: async (operation, input, options) => {
    reads.push({ id: operation.operationId, input: Schema.decodeUnknownSync(operation.input)(input), signal: options.signal })
    const source = replies.get(operation.operationId) ?? page(operation.operationId.slice("domain.page.".length))
    const reply = typeof source === "function" ? await source() : source
    return { kind: "response", status: reply.status, headers: {}, body: Schema.decodeUnknownSync(operation.output)(reply.body) }
  },
}
const active = { context, transport, drafts: { acquire: () => { throw new Error("This read must not create a draft") } } }
const owner = {
  state: () => ({ status: permission() }), generation,
  ready: () => permission() === "ready" ? active : undefined,
  followExecutiveLink: async (from: SfExecutiveSourceRoute, target: SfExecutiveLink) => {
    navigations.push({ from, target })
    return "committed"
  },
}
const fixtures: Record<string, object> = {
  context: { useSfContext: () => owner },
  language: { useLanguage: () => ({
    t: translate, intl: () => locale() === "en" ? "en-US" : "pt-BR",
    plural: (key: string, _count: number, values: Record<string, string | number>) => translate(key, values),
  }) },
  frame: { SfPageFrame: (props: { children?: JSX.Element }) => props.children, SfDisplayValueText: () => null },
  icon: { Icon: () => null },
  edit: {
    SfU02Edit: () => { throw new Error("This read must not open an editor") },
    sfU02ExecutiveTarget: () => ({ kind: "unavailable" }),
  },
  presentation: {
    useSfPresentation: () => ({ t: translate, locale }), sfCommonKey: (key: string) => key,
    SF_STATE_FALLBACK_KEY: { ready: "sf.common.ready", loading: "sf.common.loading", denied: "sf.common.noAccess", unavailable: "sf.common.unavailable" },
    SfActionButton: () => null, SfCoverageView: () => null, SfMessageText: () => null, SfTextValue: () => null,
  },
}
const imports: Record<string, string> = {
  "../context": "crosslinks-copy:context",
  "../../context": "crosslinks-copy:context",
  "@/context/language": "crosslinks-copy:language",
  "@orchestra/ui/icon": "crosslinks-copy:icon",
  "../../shared/frame": "crosslinks-copy:frame",
  "../shared/frame/presentation": "crosslinks-copy:presentation",
  "../../shared/frame/presentation": "crosslinks-copy:presentation",
  "../frame/presentation": "crosslinks-copy:presentation",
}
const compiler = createRequire(Bun.resolveSync("vite-plugin-solid", import.meta.dir))
const suffix = "?crosslinks-copy"
Bun.plugin({
  name: "crosslinks-copy-dom",
  setup(build) {
    build.onResolve({ filter: /^crosslinks-copy:/ }, (args) => ({
      path: args.path.slice("crosslinks-copy:".length), namespace: "crosslinks-copy",
    }))
    build.onLoad({ filter: /.*/, namespace: "crosslinks-copy" }, (args) => ({
      loader: "object", exports: fixtures[args.path],
    }))
    build.onLoad({ filter: /\.tsx?\?crosslinks-copy$/ }, async (args) => {
      const file = args.path.slice(0, -suffix.length)
      const source = await Bun.file(file).text()
      const code = file.endsWith(".tsx")
        ? (await compiler("@babel/core").transformAsync(source, {
            filename: file, presets: [[compiler("babel-preset-solid"), { generate: "dom" }]],
            parserOpts: { plugins: ["jsx", "typescript"] }, configFile: false, babelrc: false,
          })).code
        : source
      const contents = code.replace(/(from\s+)(["'])([^"']+)\2/g,
        (match: string, lead: string, _quote: string, spec: string) => {
          if (spec === "./edit" && file.endsWith("/dashboard/executive/index.tsx")) {
            return lead + JSON.stringify("crosslinks-copy:edit")
          }
          if (imports[spec]) return lead + JSON.stringify(imports[spec])
          const resolved = Bun.resolveSync(spec, path.dirname(file))
          return /\.tsx?$/.test(resolved) && !resolved.includes("node_modules")
            ? lead + JSON.stringify(resolved + suffix) : match
        })
      return { contents, loader: "ts" }
    })
  },
})
const { SfExecutiveRelatedLinks }: typeof import("../src/orchestra/chapters/sucafina/cross-links/view") =
  await import(Bun.resolveSync("../src/orchestra/chapters/sucafina/cross-links/view", import.meta.dir) + suffix)
const { SfExecutiveDashboard }: typeof import("../src/orchestra/chapters/sucafina/dashboard/executive") =
  await import(Bun.resolveSync("../src/orchestra/chapters/sucafina/dashboard/executive", import.meta.dir) + suffix)
const route: SfSurfaceProps<"CAP01">["route"] = {
  surfaceId: "CAP01", kind: "entry", params: {}, query: { year: 2026, month: 11 },
  ownerSelection: { serverKey: "cross-server" as SfServerKey, projectId: "cross-project" as SfRef, installationId: "cross-installation" as SfRef },
  href: "/orchestra/sf-dashboard/executive?year=2026&month=11" as SfHref, pathname: "/orchestra/sf-dashboard/executive",
}
function reset(lang: "en" | "pt-BR" = "en") {
  replies.clear(); reads.length = 0; navigations.length = 0
  batch(() => { setLocale(lang); setPermission("ready"); setGeneration((value) => value + 1) })
}
function mount(executive = false, omit: "risk" | "stakeholder" | "topic" = "stakeholder") {
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => executive
    ? createComponent(SfExecutiveDashboard, { surfaceId: "CAP01", route })
    : createComponent(SfExecutiveRelatedLinks, { from: route, omit }), host)
  return { host, close: () => { dispose(); host.remove() } }
}
async function until(predicate: () => boolean) {
  for (let n = 0; n < 100 && !predicate(); n++) await new Promise<void>((resolve) => setImmediate(resolve))
  expect(predicate()).toBe(true)
}
async function settled(host: HTMLElement) {
  await until(() => host.querySelector("select option")?.textContent === translate("sf.cross.select"))
}
const emptyText = () => translate("sf.cross.empty")

test("executive links distinguish denied producer reads from authorized empty results", async () => {
  for (const reply of [
    { status: 403, body: { status: "denied" } },
    { status: 401, body: { status: "unauthenticated" } },
    { status: 200, body: { status: "denied" } },
  ]) {
    reset("pt-BR")
    replies.set("domain.page.CAP13", reply)
    const view = mount()
    try {
      await settled(view.host)
      expect(view.host.querySelector("[data-sf-state=denied]")?.textContent).toContain(translate("sf.common.noAccess"))
      expect(view.host.textContent).not.toContain(emptyText())
      expect(view.host.querySelector("[data-sf-state=unavailable]")).toBeNull()
      replies.clear()
      setGeneration((value) => value + 1)
      await settled(view.host)
      expect(view.host.querySelector("[data-sf-state=denied]")).toBeNull()
      expect(view.host.textContent).toContain(emptyText())
      setPermission("denied")
      await until(() => view.host.querySelector("[data-sf-state=denied]") !== null)
      expect(view.host.textContent).not.toContain(emptyText())
    } finally { view.close() }
  }

  reset()
  replies.set("domain.page.CAP13", { status: 403, body: { status: "denied" } })
  replies.set("domain.page.CAP02", page("CAP02", { hotTopics: [{ id: "original-topic", action: "Authorized topic" }] }))
  const partial = mount()
  try {
    await settled(partial.host)
    expect(partial.host.querySelector("[data-sf-state=denied]")).not.toBeNull()
    expect(partial.host.textContent).toContain("Authorized topic")
    expect(partial.host.textContent).not.toContain(emptyText())
    const select = partial.host.querySelector("select")!
    select.value = JSON.stringify(["topic", "original-topic"])
    select.dispatchEvent(new Event("change", { bubbles: true }))
    partial.host.querySelector<HTMLButtonElement>("[data-sf-executive-action=topic] button")!.click()
    await until(() => navigations.length === 1)
    expect(navigations[0]).toEqual({ from: route, target: { kind: "topic", ref: "original-topic" } })
  } finally { partial.close() }
})

test("executive reference copy localizes labels without changing canonical refs or selection", async () => {
  reset("pt-BR")
  replies.set("domain.page.CAP13", page("CAP13", { risks: [{ id: 0, title: "Displayed risk title" }] }))
  replies.set("domain.page.CAP15", page("CAP15", { stakeholders: [{ id: "stakeholder/raw+ref", name: "Displayed person" }] }))
  const view = mount(false, "topic")
  try {
    await settled(view.host)
    expect(view.host.querySelector("h3")?.textContent).toBe(translate("sf.cross.references"))
    expect(view.host.querySelector("label span")?.textContent).toBe(translate("sf.cross.openCanonical"))
    const select = view.host.querySelector("select")!
    expect([...select.options].slice(1).map((option) => option.textContent).sort()).toEqual([
      translate("sf.cross.kind.risk") + " · Displayed risk title",
      translate("sf.cross.kind.stakeholder") + " · Displayed person",
    ].sort())
    const selection = JSON.stringify(["stakeholder", "stakeholder/raw+ref"])
    select.value = selection
    select.dispatchEvent(new Event("change", { bubbles: true }))
    const button = view.host.querySelector<HTMLButtonElement>("[data-sf-executive-action=stakeholder] button")!
    expect(button.textContent).toBe(translate("sf.cross.open"))
    const before = reads.length
    setLocale("en")
    expect(select.value).toBe(selection)
    expect(button.textContent).toBe(translate("sf.cross.open"))
    expect([...select.options].some((option) => option.textContent === "Risk · Displayed risk title")).toBe(true)
    expect(reads.length).toBe(before)
    button.click()
    await until(() => navigations.length === 1)
    expect(navigations[0]).toEqual({ from: route, target: { kind: "stakeholder", ref: "stakeholder/raw+ref" } })
    select.value = JSON.stringify(["risk", "0"])
    select.dispatchEvent(new Event("change", { bubbles: true }))
    view.host.querySelector<HTMLButtonElement>("[data-sf-executive-action=risk] button")!.click()
    await until(() => navigations.length === 2)
    expect(navigations[1].target).toEqual({ kind: "risk", ref: "0" })
    expect(reads.map((read) => read.id).sort()).toEqual(["domain.page.CAP13", "domain.page.CAP15"])
    expect(reads.every((read) => JSON.stringify(read.input) === "{}")).toBe(true)
  } finally { view.close() }
})

test("executive links preserve empty, unavailable and stale-owner read behavior", async () => {
  reset()
  const view = mount()
  try {
    await settled(view.host)
    expect(view.host.textContent).toContain(emptyText())
    expect(view.host.querySelector("[data-sf-state]")).toBeNull()
    replies.set("domain.page.CAP13", { status: 503, body: { status: "unavailable", reason: "fixture-outage" } })
    setGeneration((value) => value + 1)
    await settled(view.host)
    expect(view.host.querySelector("[data-sf-state=unavailable]")).not.toBeNull()
    expect(view.host.textContent).not.toContain(emptyText())
    const pending = Promise.withResolvers<Reply>()
    replies.set("domain.page.CAP13", () => pending.promise)
    setGeneration((value) => value + 1)
    await until(() => view.host.querySelector("select option")?.textContent === translate("sf.cross.loading"))
    const oldRead = reads.at(-2)!
    setPermission("denied")
    expect(oldRead.signal.aborted).toBe(true)
    pending.resolve(page("CAP13", { risks: [{ id: "old-owner", title: "Old owner private title" }] }))
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(view.host.textContent).not.toContain("Old owner private title")
    expect(view.host.querySelector("select")!.options.length).toBe(1)
    replies.clear()
    batch(() => { setPermission("ready"); setGeneration((value) => value + 1) })
    await settled(view.host)
    expect(view.host.textContent).toContain(emptyText())
    expect(view.host.querySelector("[data-sf-state]")).toBeNull()
  } finally { view.close() }
})

test("Executive navigation uses catalog text in both languages and preserves its targets", async () => {
  reset("pt-BR")
  const view = mount(true)
  try {
    await until(() => view.host.querySelector("[data-sf-state=ready]") !== null)
    const nav = view.host.querySelector("[data-sf-executive-crosslinks]")!
    for (const lang of ["pt-BR", "en"] as const) {
      setLocale(lang)
      expect(nav.getAttribute("aria-label")).toBe(translate("sf.cross.nav"))
      expect([...nav.querySelectorAll("button")].map((button) => button.textContent)).toEqual(
        ["sf.cross.agenda", "sf.cross.topics", "sf.cross.risks", "sf.cross.stakeholders"].map((key) => translate(key)),
      )
    }
    for (const button of nav.querySelectorAll<HTMLButtonElement>("button")) {
      expect(button.disabled).toBe(false)
      button.click()
    }
    await until(() => navigations.length === 4)
    expect(navigations.map((item) => item.target)).toEqual([
      { kind: "agenda" }, { kind: "topics" }, { kind: "risks" }, { kind: "stakeholders" },
    ])
    expect(navigations.every((item) => item.from === route)).toBe(true)
    expect(reads.map((read) => read.id)).toEqual(["domain.page.CAP01"])
    expect(reads[0]?.input).toEqual({ execYear: 2026, executiveMonth: 11 })
  } finally { view.close() }
})
