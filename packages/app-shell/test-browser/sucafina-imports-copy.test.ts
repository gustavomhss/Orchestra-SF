import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { Schema } from "effect"
import { createComponent, createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { SfContext } from "@orchestra/schema/sucafina/context"
import type { SfHref, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { createSfProcurementProjectionHandlers } from "../../../apps/cli/src/sucafina-product/native-ui/procurement"
import type { SfNativeHostDependencies } from "../../../apps/cli/src/sucafina-product/native-ui/router"
import { ProcurementModule } from "../../../modules/sucafina/Sucafinav1/runtime/procurement"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract"
import { compareImportProjections } from "../../../modules/sucafina/Sucafinav1/product/imports/changes"
import { plannerImportDetail } from "../../../modules/sucafina/Sucafinav1/product/imports/detail"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
import type { SfSurfaceProps } from "../src/orchestra/chapters/sucafina/context/contracts"
import { SF_U23_COPY, SF_U23_COPY_BR } from "../src/i18n/orchestra-chapters/sf-u23"
import { SF_COMMON_COPY, SF_COMMON_COPY_BR } from "../src/i18n/orchestra-chapters/sf-common"

const stamp = { installationId: "imports-installation", projectId: "imports-project", hostId: "imports-host",
  principalRef: "imports-person", policyVersion: "policy", accessRevision: "access" }
const period = { start: "2026-01-01", end: "2026-12-31" }
const selection = { serverKey: "imports-server" as SfServerKey, projectId: stamp.projectId as SfRef,
  installationId: stamp.installationId as SfRef }
const context = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "local-operator",
  destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: [] }],
  availability: [
    { family: "procurement", resource: "CAP25", state: "ready",
      operations: [{ operationId: "domain.page.CAP25", state: "ready", reason: null, operational: true }] },
    { family: "files", resource: "import-preview", state: "ready", operations: [
      "files.import-targets", "files.import-reference", "files.import-detail", "files.export.xlsx", "files.export.po",
    ].map((operationId) => ({ operationId, state: "ready", reason: null, operational: true })) },
  ],
})
type Mode = "ready" | "denied" | "stale" | "unavailable"
let mode: Mode = "ready"
let releaseRead: (() => void) | undefined
let pauseRead: Promise<void> | undefined
const calls: { operation: string; input: unknown }[] = []
const snapshot: Snapshot = {
  data: { store: { settings: { currency: "USD", levels: [], fxRates: [{ code: "USD", rate: 1 }] },
    suppliers: [], requests: {
      "PR-2026-0001": { request: { number: "PR-2026-0001", status: "issued", createdBy: stamp.principalRef,
        pr: { title: "Selected source PR", type: "product", estAmount: 0 },
        po: { number: "PO-2026-0001", currency: "USD", lines: [{ id: "line", desc: "Zero-cost source", qty: 1, unitPrice: 0 }] },
      } },
      "PR-2026-0002": { request: { number: "PR-2026-0002", status: "draft", createdBy: stamp.principalRef,
        pr: { title: "No PO", estAmount: null } } },
    } } },
  versions: { "requests:PR-2026-0001": { version: 3, by: stamp.principalRef }, "requests:PR-2026-0002": { version: 1, by: stamp.principalRef } },
  sequences: {}, audit: [], notices: [],
}
/** CAP25 producer, domain view, projection mapper, client and decoder are real.
 * Read authentication/persistence and byte egress are explicit fixture boundaries.
 * This proves UI copy/selection, not installed PO export or scanner authorization. */
async function procurement(input: unknown) {
  const read = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].input)(input)
  let admissions = 0
  const deps: SfNativeHostDependencies = {
    origin: "https://imports.test", mount: "/sf", runtime: () => undefined,
    readContext: async () => {
      if (mode === "denied") return { status: "denied" }
      admissions++
      return { status: "ok", value: mode === "stale" && admissions > 1
        ? { ...context, stamp: { ...context.stamp, accessRevision: "changed" as typeof context.stamp.accessRevision } } : context }
    },
    application: {
      authenticate: async () => ({ id: stamp.principalRef, canWrite: true, roles: [{ surface: "procurement", role: "admin" }] }),
      environment: async () => ({ at: "2026-11-22T08:00:00Z", id: () => "unused", directory: [] }),
      persistence: { transaction: async (surface, work) => {
        expect(surface).toBe("procurement")
        const result = await work(structuredClone(snapshot))
        expect(result.commit).toBe(false)
        return result.value
      } },
      domains: { planner: [], dashboard: [], procurement: [ProcurementModule] }, maxJsonBytes: 65536,
      productView: async () => mode === "unavailable" ? new Response(null, { status: 503 }) : undefined,
    },
  }
  const handler = createSfProcurementProjectionHandlers(deps).find((entry) => entry.operationId === "domain.page.CAP25")
  if (!handler) throw new Error("Native CAP25 handler missing")
  const query = new URLSearchParams()
  if (read.request) query.set("request", read.request)
  const response = await handler.handle(new Request("https://imports.test/sf/api/ui/pages/CAP25?" + query))
  return { status: response.status, body: Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(await response.json()) }
}

const before = { zero: null, removed: 0, missing: undefined, flag: true, text: "original" }
const after = { zero: 0, added: null, missing: null, flag: false, text: "" }
const detail = plannerImportDetail({ manifestId: "manifest", version: 1, sourceDigest: digestSfValue(after),
  domainReference: "authorized-planner-selection", changes: compareImportProjections(before, after), locations: {} })
const reference = Schema.decodeUnknownSync(SfFiles.operations["files.import-reference"].output)({
  status: "ok", value: {
    manifest: { id: "manifest", version: 1, sourceDigest: detail.sourceDigest, format: "xlsx",
      context: { ...stamp, surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] },
      baseIdentity: [], commands: [], issues: [], state: "preview", domainApplied: false, receipts: [] },
    detail, digest: digestSfValue(detail),
  },
})
const transport: SfTransport = {
  async execute(operation, input) {
    calls.push({ operation: operation.operationId, input: structuredClone(input) })
    if (operation.operationId === "domain.page.CAP25") {
      if (pauseRead) await pauseRead
      const result = await procurement(input)
      return { kind: "response", headers: {}, status: result.status, body: Schema.decodeUnknownSync(operation.output)(result.body) }
    }
    if (operation.operationId === "files.import-targets") {
      const requested = Schema.decodeUnknownSync(SfFiles.operations["files.import-targets"].input)(input)
      return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(operation.output)({
        status: "ok", value: [{ label: "Authorized destination", surface: requested.surface,
          selectionRef: "authorized-" + requested.surface, formats: ["xlsx"], period }],
      }) }
    }
    if (operation.operationId === "files.import-reference") {
      expect(Schema.decodeUnknownSync(SfFiles.operations["files.import-reference"].input)(input))
        .toEqual({ surface: "planner", importPreviewRef: "manifest" })
      return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(operation.output)(reference) }
    }
    if (operation.operationId === "files.export.po") {
      expect(Schema.decodeUnknownSync(SfFiles.operations["files.export.po"].input)(input))
        .toEqual({ surface: "procurement", request: "PR-2026-0001" })
      return { kind: "response", status: 200, headers: { "content-type": "text/html", "content-disposition": "attachment; filename=selected-po.html" },
        body: Schema.decodeUnknownSync(operation.output)(new TextEncoder().encode("<p>Explicit byte boundary fixture</p>")) }
    }
    throw new Error("Unexpected Imports operation: " + operation.operationId)
  },
}
const [locale, setLocale] = createSignal<"en" | "pt-BR">("en")
const [permission, setPermission] = createSignal<"ready" | "denied">("ready")
const [generation, setGeneration] = createSignal(1)
const translate = (key: string, params: Record<string, string | number> = {}) => {
  const dictionary = locale() === "en" ? { ...SF_U23_COPY, ...SF_COMMON_COPY } : { ...SF_U23_COPY_BR, ...SF_COMMON_COPY_BR }
  return String(Reflect.get(dictionary, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ""))
}
const owner = {
  state: () => ({ status: permission(), ownerKey: "imports-owner", selection, context,
    owner: { serverKey: selection.serverKey, transportIdentity: "imports-transport", publicOrigin: "https://imports.test",
      projectId: stamp.projectId, installationId: stamp.installationId, principalRef: stamp.principalRef, authEpoch: 1 },
    binding: { installationId: stamp.installationId, projectId: stamp.projectId, hostId: stamp.hostId, publicOrigin: "https://imports.test" },
  }),
  generation,
  ready: () => permission() === "ready" ? { context, transport } : undefined,
}
type Frame = { children?: JSX.Element; primaryAction?: { onInvoke: () => void; disabled?: boolean } }
let frame: Frame | undefined
const fixtures: Record<string, object> = {
  context: { useSfContext: () => owner },
  language: { useLanguage: () => ({ t: translate, intl: () => locale() === "en" ? "en-US" : "pt-BR" }) },
  router: { A: (props: { children?: JSX.Element }) => props.children },
  frame: { SfPageFrame: (props: Frame) => {
    frame = props
    return props.children
  } },
}
const imports: Record<string, string> = {
  "../context": "imports-copy:context", "@/context/language": "imports-copy:language",
  "@solidjs/router": "imports-copy:router", "../shared/frame": "imports-copy:frame",
}
const compiler = createRequire(Bun.resolveSync("vite-plugin-solid", import.meta.dir))
const suffix = "?imports-copy"
Bun.plugin({
  name: "imports-copy-dom",
  setup(build) {
    build.onResolve({ filter: /^imports-copy:/ }, (args) => ({ path: args.path.slice("imports-copy:".length), namespace: "imports-copy" }))
    build.onLoad({ filter: /.*/, namespace: "imports-copy" }, (args) => ({ loader: "object", exports: fixtures[args.path] }))
    build.onLoad({ filter: /\.tsx?\?imports-copy$/ }, async (args) => {
      const file = args.path.slice(0, -suffix.length)
      const source = await Bun.file(file).text()
      const code = file.endsWith(".tsx") ? (await compiler("@babel/core").transformAsync(source, {
        filename: file, presets: [[compiler("babel-preset-solid"), { generate: "dom" }]],
        parserOpts: { plugins: ["jsx", "typescript"] }, configFile: false, babelrc: false,
      })).code : source
      const contents = code.replace(/(from\s+)(["'])([^"']+)\2/g,
        (match: string, lead: string, _quote: string, spec: string) => {
          if (imports[spec]) return lead + JSON.stringify(imports[spec])
          const resolved = Bun.resolveSync(spec, path.dirname(file))
          return /\.tsx?$/.test(resolved) && !resolved.includes("node_modules")
            ? lead + JSON.stringify(resolved + suffix) : match
        })
      return { contents, loader: "ts" }
    })
  },
})
const { SfImportsView }: typeof import("../src/orchestra/chapters/sucafina/imports") =
  await import(Bun.resolveSync("../src/orchestra/chapters/sucafina/imports", import.meta.dir) + suffix)

function mount(surfaceId: "UI55" | "UI56" | "UI57" | "UI68", language: "en" | "pt-BR" = "pt-BR") {
  mode = "ready"; calls.length = 0; pauseRead = undefined; releaseRead = undefined
  setLocale(language); setPermission("ready"); setGeneration((value) => value + 1)
  const route = { surfaceId, ownerSelection: selection, href: ("/orchestra/" + surfaceId) as SfHref, pathname: "/orchestra/" + surfaceId, query: {} }
  const props: SfSurfaceProps<"UI55" | "UI56" | "UI57" | "UI68"> = surfaceId === "UI56"
    ? { surfaceId, route: { ...route, surfaceId, kind: "entry", params: { manifestId: "manifest" as SfRef } } }
    : surfaceId === "UI57" ? { surfaceId, route: { ...route, surfaceId, kind: "history", params: {} } }
    : surfaceId === "UI55" ? { surfaceId, route: { ...route, surfaceId, kind: "entry", params: {} } }
    : { surfaceId, route: { ...route, surfaceId, kind: "entry", params: {} } }
  const host = document.createElement("div"); document.body.append(host)
  const dispose = render(() => createComponent(SfImportsView, props), host)
  return { host, close: () => { dispose(); host.remove() } }
}
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await new Promise<void>((resolve) => setImmediate(resolve))
  expect(predicate()).toBe(true)
}
function change(select: HTMLSelectElement, value: string) {
  select.value = value; select.dispatchEvent(new Event("change", { bubbles: true }))
}
function click(host: HTMLElement, key: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === translate(key))
  expect(button?.disabled).toBe(false); button!.click()
}

test("Imports localizes source/history labels without changing selection, wire values or authority", async () => {
  const view = mount("UI55")
  try {
    const source = view.host.querySelector<HTMLSelectElement>("select")!
    expect([...source.options].map((option) => [option.value, option.textContent])).toEqual([
      ["planner", "Planejador"], ["dashboard", "Painel"],
    ])
    change(source, "dashboard")
    click(view.host, "sf.u23.find")
    await until(() => view.host.querySelectorAll("select")[1]?.options.length === 2)
    const destination = view.host.querySelectorAll("select")[1]!
    change(destination, "authorized-dashboard")
    const count = calls.length
    setLocale("en")
    expect(source.value).toBe("dashboard")
    expect(destination.value).toBe("authorized-dashboard")
    expect([...source.options].map((option) => option.textContent)).toEqual(["Planner", "Dashboard"])
    expect(calls).toHaveLength(count)
    expect(calls[0]).toEqual({ operation: "files.import-targets", input: { surface: "dashboard" } })
    setPermission("denied")
    await until(() => view.host.querySelector("[data-sf-state=denied]") !== null)
    expect(view.host.querySelector("select")).toBeNull()
    expect(calls).toHaveLength(count)
  } finally { view.close() }
  const history = mount("UI57")
  try {
    expect(history.host.textContent).toContain("Referência da prévia de importação")
    setLocale("en")
    expect(history.host.textContent).toContain("Import preview reference")
    expect(calls).toHaveLength(0)
  } finally { history.close() }
})

test("Imports displays actual diff states distinctly from null, zero, false and empty text in both locales", async () => {
  const view = mount("UI56")
  try {
    click(view.host, "sf.u23.reconcile")
    await until(() => view.host.querySelectorAll(".sf-files-change").length === detail.changes.length)
    const texts = () => Object.fromEntries([...view.host.querySelectorAll(".sf-files-change")].map((entry) => [
      entry.querySelector(".sf-technical-details code")?.textContent,
      [...entry.querySelectorAll(".sf-files-diff > div > p")].map((value) => value.textContent),
    ]))
    expect(texts()).toEqual({ "/added": ["ausente", "nulo"], "/flag": ["true", "false"], "/missing": ["indefinido", "nulo"],
      "/removed": ["0", "ausente"], "/text": ['"original"', '""'], "/zero": ["nulo", "0"] })
    for (const entry of view.host.querySelectorAll(".sf-files-change"))
      expect([...entry.querySelectorAll(".sf-files-diff h4")].map((heading) => heading.textContent))
        .toEqual(["Antes da importação", "Valor proposto"])
    const unchanged = JSON.stringify(reference), count = calls.length
    setLocale("en")
    expect(texts()).toEqual({ "/added": ["absent", "null"], "/flag": ["true", "false"], "/missing": ["undefined", "null"],
      "/removed": ["0", "absent"], "/text": ['"original"', '""'], "/zero": ["null", "0"] })
    for (const entry of view.host.querySelectorAll(".sf-files-change"))
      expect([...entry.querySelectorAll(".sf-files-diff h4")].map((heading) => heading.textContent))
        .toEqual(["Before import", "Proposed value"])
    expect(JSON.stringify(reference)).toBe(unchanged)
    expect(calls).toHaveLength(count)
    expect(calls.every((call) => call.operation === "files.import-reference")).toBe(true)
    setPermission("denied")
    await until(() => view.host.querySelector("[data-sf-state=denied]") !== null)
    expect(view.host.querySelectorAll(".sf-files-change")).toHaveLength(0)
  } finally { view.close() }
})

test("Imports localizes all PO states while retaining the native authorized PR selection and re-reading before export", async () => {
  for (const state of ["idle", "loading", "ready", "denied", "stale", "unavailable"] as const) {
    expect(SF_U23_COPY[("sf.u23.poState." + state) as keyof typeof SF_U23_COPY]).toBe(state)
    expect(SF_U23_COPY_BR[("sf.u23.poState." + state) as keyof typeof SF_U23_COPY]).not.toBe(state)
  }
  const view = mount("UI68")
  try {
    const format = view.host.querySelector<HTMLSelectElement>("select")!
    expect(format.querySelector('option[value="po"]')?.textContent).toBe("Pedido de compra individual / aprovações (HTML)")
    pauseRead = new Promise<void>((resolve) => { releaseRead = resolve })
    change(format, "po")
    expect(view.host.textContent).toContain("Seleção: Carregando.")
    expect(view.host.textContent).toContain("Pedido de compra autorizado atual")
    expect(view.host.textContent).toContain("Selecione um pedido pela referência da solicitação de origem")
    releaseRead!(); pauseRead = undefined
    await until(() => view.host.textContent?.includes("Seleção: Pronto.") === true)
    const selected = view.host.querySelectorAll("select")[1]!
    expect([...selected.options].map((option) => option.value)).toEqual(["", "PR-2026-0001"])
    change(selected, "PR-2026-0001")
    const count = calls.length
    setLocale("en")
    expect(view.host.textContent).toContain("Selection: ready.")
    expect(selected.value).toBe("PR-2026-0001")
    expect(format.value).toBe("po")
    expect(calls).toHaveLength(count)
    expect(frame?.primaryAction?.disabled).toBe(false)
    frame!.primaryAction!.onInvoke()
    await until(() => view.host.querySelector("[data-sf-export=authorized-bytes]") !== null)
    expect(calls.slice(-2)).toEqual([
      { operation: "domain.page.CAP25", input: { request: "PR-2026-0001" } },
      { operation: "files.export.po", input: { surface: "procurement", request: "PR-2026-0001" } },
    ])
    expect(view.host.textContent).toContain("selected-po.html. To download again, request fresh authorization.")
    expect(view.host.querySelector('a[download]')).toBeNull()
    setLocale("pt-BR")
    expect(view.host.textContent).toContain("selected-po.html. Para baixar novamente, solicite uma nova autorização.")
    for (const failure of ["denied", "stale", "unavailable"] as const) {
      mode = failure
      click(view.host, "sf.u23.poRefresh")
      await until(() => view.host.textContent?.includes(translate("sf.u23.selection", { state: translate("sf.u23.poState." + failure) })) === true)
      expect(view.host.querySelectorAll("select")[1]?.value).toBe("")
      expect(view.host.querySelectorAll("select")[1]?.disabled).toBe(true)
      expect(view.host.querySelector("[data-sf-export=authorized-bytes]")).toBeNull()
    }
    expect(calls.filter((call) => call.operation === "files.export.po")).toHaveLength(1)
  } finally { releaseRead?.(); view.close() }
})
