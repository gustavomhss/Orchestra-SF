import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { Schema } from "effect"
import { createComponent, createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { SfContext } from "@orchestra/schema/sucafina/context"
import { createSfPlannerProjectionHandlers } from "../../../apps/cli/src/sucafina-product/native-ui/planner"
import type { SfNativeHostDependencies } from "../../../apps/cli/src/sucafina-product/native-ui/router"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract"
import type { SfHref, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../src/orchestra/chapters/sucafina/context/contracts"
import { SF_U02_COPY, SF_U02_COPY_BR } from "../src/i18n/orchestra-chapters/sf-u02"
import { SF_U08_COPY, SF_U08_COPY_BR } from "../src/i18n/orchestra-chapters/sf-u08"
import { SF_COMMON_COPY, SF_COMMON_COPY_BR } from "../src/i18n/orchestra-chapters/sf-common"

type Read = typeof SfPlanner.operations["domain.page.CAP20"]
type Result = Schema.Schema.Type<Read["output"]>
type Page = Extract<Result, { status: "ok" }>
const stamp = {
  installationId: "headcount-installation", projectId: "headcount-project", hostId: "headcount-host",
  principalRef: "headcount-principal", policyVersion: "1", accessRevision: "1",
}
const version = { id: "budget-2026", name: "Budget 2026", year: 2026, locked: false, closed: 0, official: false }
async function projected(currencies: readonly { cur: string; fx: number }[], positions = true, annual: number | null = 1200): Promise<Page> {
  const snapshot: Snapshot = {
    data: {
      versions: [{
        ...version, lines: [], projects: [], lists: {},
        hc: {
          positions: positions ? currencies.map((_, index) => ({
            id: index === 0 ? "position-one" : "position-" + index,
            name: "Analyst " + index, include: true, fte: 1, start: 1, end: 1,
            domain: "IT", rateId: "rate-" + index,
          })) : [],
          rates: currencies.map(({ cur }, index) => ({
            id: "rate-" + index, name: "Rate " + index, annual, cur, locs: "",
          })),
          inc: 0, incMonth: 1, hrAF: {},
        },
        fx: currencies.map(({ cur, fx }) => ({ id: cur || "empty", cur, rate: fx })),
      }],
      officials: {}, entities: [], allocations: [], roster: [],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
  const before = JSON.stringify(snapshot)
  const context = Schema.decodeUnknownSync(SfContext)({
    stamp, contractRevision: "sf-native-ui/1", authMode: "local-operator",
    destinations: [{ capabilityId: "CAP20", surface: "planner", page: "Headcount", canRead: true, allowedActionIds: [] }],
    availability: [],
  })
  const dependencies: SfNativeHostDependencies = {
    origin: "http://headcount.test", mount: "/sf",
    runtime: () => undefined,
    readContext: async () => ({ status: "ok", value: context }),
    application: {
      authenticate: async () => ({
        id: stamp.principalRef, canWrite: true, roles: [{ surface: "planner", role: "admin" }],
      }),
      environment: async () => ({ at: "2026-01-01T00:00:00.000Z", id: () => "unused-read-id", directory: [] }),
      persistence: {
        transaction: async (surface, work) => {
          expect(surface).toBe("planner")
          const result = await work(structuredClone(snapshot))
          expect(result.commit).toBe(false)
          return result.value
        },
      },
      domains: { planner: [], dashboard: [], procurement: [] },
      maxJsonBytes: 65536,
    },
  }
  // This is the production native CAP20 handler calling domain.view and its USD HR calculation,
  // with fixture authentication/persistence. It is a producer/consumer proof, not an installed-host claim.
  const handler = createSfPlannerProjectionHandlers(dependencies).find((item) => item.operationId === "domain.page.CAP20")
  if (!handler) throw new Error("CAP20 handler missing")
  const response = await handler.handle(new Request("http://headcount.test/sf/api/ui/pages/CAP20?year=2026&version=budget-2026"))
  expect(response.status).toBe(200)
  const result = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP20"].output)(await response.json())
  if (result.status !== "ok") throw new Error("CAP20 producer refused the fixture")
  expect(JSON.stringify(snapshot)).toBe(before)
  return result
}
let source: Result = { status: "denied" }
let responseStatus = 200
const reads: Schema.Schema.Type<Read["input"]>[] = []
const [locale, setLocale] = createSignal<"en" | "pt-BR">("en")
const [permission, setPermission] = createSignal<"ready" | "denied">("ready")
const [generation, setGeneration] = createSignal(1)
const translate = (name: string, values: Record<string, string | number> = {}) => {
  const dictionary = locale() === "en"
    ? { ...SF_COMMON_COPY, ...SF_U02_COPY, ...SF_U08_COPY }
    : { ...SF_COMMON_COPY_BR, ...SF_U02_COPY_BR, ...SF_U08_COPY_BR }
  return String(Reflect.get(dictionary, name) ?? name)
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""))
}
const active = {
  context: {
    stamp,
    destinations: [{ capabilityId: "CAP20", surface: "planner", page: "Headcount", canRead: true, allowedActionIds: [] }],
  },
  transport: {
    execute: async (operation: Read, input: unknown) => {
      expect(operation.operationId).toBe("domain.page.CAP20")
      reads.push(Schema.decodeUnknownSync(operation.input)(input))
      const body = Schema.decodeUnknownSync(operation.output)(JSON.parse(JSON.stringify(source)))
      return { kind: "response", status: responseStatus, body }
    },
  },
  drafts: { acquire: () => { throw new Error("A read-only view must not create an editing draft") } },
}
const owner = {
  state: () => ({ status: permission() }),
  generation,
  ready: () => permission() === "ready" ? active : undefined,
}
const fixtures: Record<string, object> = {
  context: { useSfContext: () => owner },
  language: { useLanguage: () => ({ t: translate, intl: () => locale() === "en" ? "en-US" : "pt-BR" }) },
  frame: { SfPageFrame: (props: { children?: JSX.Element }) => props.children },
  review: { SfChangeReview: () => { throw new Error("This read-only test must not open a mutation review") } },
  presentation: {
    useSfPresentation: () => ({ t: translate }), sfCommonKey: (key: string) => key,
    SfActionButton: () => null, SfCoverageView: () => null, SfMessageText: () => null, SfTextValue: () => null,
  },
}
const imports: Record<string, string> = {
  "../../context": "headcount-copy:context",
  "@/context/language": "headcount-copy:language",
  "../../shared/frame": "headcount-copy:frame",
  "../../shared/change-review": "headcount-copy:review",
  "../frame/presentation": "headcount-copy:presentation",
}
const compiler = createRequire(Bun.resolveSync("vite-plugin-solid", import.meta.dir))
const suffix = "?headcount-copy"
// Compile an isolated production view/StatePanel graph; only owner/presentation boundaries are fixtures.
// The Planner producer/mapper, client, response schema, view and localized catalogs are real.
Bun.plugin({
  name: "headcount-copy-dom",
  setup(build) {
    build.onResolve({ filter: /^headcount-copy:/ }, (args) => ({
      path: args.path.slice("headcount-copy:".length), namespace: "headcount-copy",
    }))
    build.onLoad({ filter: /.*/, namespace: "headcount-copy" }, (args) => ({
      loader: "object", exports: fixtures[args.path],
    }))
    build.onLoad({ filter: /\.tsx?\?headcount-copy$/ }, async (args) => {
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
          if (imports[spec]) return lead + JSON.stringify(imports[spec])
          const resolved = Bun.resolveSync(spec, path.dirname(file))
          return /\.tsx?$/.test(resolved) && !resolved.includes("node_modules")
            ? lead + JSON.stringify(resolved + suffix) : match
        })
      return { contents, loader: "ts" }
    })
  },
})
const { SfPlannerHeadcountView }: typeof import("../src/orchestra/chapters/sucafina/planner/headcount") =
  await import(Bun.resolveSync("../src/orchestra/chapters/sucafina/planner/headcount", import.meta.dir) + suffix)

function mount(body: Result, lang: "en" | "pt-BR", detail = true) {
  source = body
  responseStatus = 200
  reads.length = 0
  setLocale(lang)
  setPermission("ready")
  setGeneration((value) => value + 1)
  const props: SfSurfaceProps<"CAP20"> = {
    surfaceId: "CAP20",
    route: {
      surfaceId: "CAP20",
      ownerSelection: { serverKey: "headcount-server" as SfServerKey, projectId: "headcount-project" as SfRef },
      href: "/orchestra/sf-headcount?year=2026&version=budget-2026" as SfHref,
      pathname: "/orchestra/sf-headcount", query: { year: 2026, version: version.id as SfRef },
      ...(detail ? { kind: "position", params: { positionRef: "position-one" as SfRef } } : { kind: "entry", params: {} }),
    },
  }
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(SfPlannerHeadcountView, props), host)
  return { host, close: () => { dispose(); host.remove() } }
}
async function until(predicate: () => boolean) {
  for (let n = 0; n < 100 && !predicate(); n++) await new Promise<void>((resolve) => setImmediate(resolve))
  expect(predicate()).toBe(true)
}
const formatted = (value: number, currency: string, lang: string) =>
  new Intl.NumberFormat(lang, { style: "currency", currency, maximumFractionDigits: 2 }).format(value)

test("Headcount keeps producer USD amounts distinct from native rate currency", async () => {
  const cases = [
    { currencies: [{ cur: "EUR", fx: 1.2 }], month: 120, total: 120, lang: "en" },
    { currencies: [{ cur: "BRL", fx: 0.2 }], month: 20, total: 20, lang: "pt-BR" },
    { currencies: [{ cur: "USD", fx: 1 }], month: 100, total: 100, lang: "en" },
    { currencies: [{ cur: "EUR", fx: 1.2 }, { cur: "BRL", fx: 0.2 }], month: 120, total: 140, lang: "pt-BR" },
  ] as const
  for (const item of cases) {
    const original = await projected(item.currencies)
    expect(original.value.data.metrics?.hrTotal).toBe(item.total)
    expect(original.value.data.positions[0]?.months?.slice(0, 2)).toEqual([item.month, 0])
    expect(original.value.data.rates?.map((rate) => [rate.cur, rate.annual]))
      .toEqual(item.currencies.map(({ cur }) => [cur, 1200]))
    const before = JSON.stringify(original)
    const view = mount(original, item.lang)
    try {
      await until(() => view.host.querySelector("[data-sf-state=ready]") !== null)
      expect(view.host.querySelectorAll(".sf-u08-plan-summary dt")[1]?.textContent).toBe(translate("sf.u08.total"))
      const numberLocale = item.lang === "en" ? "en-US" : "pt-BR"
      expect(view.host.querySelectorAll(".sf-u08-plan-summary dd")[1]?.textContent).toBe(formatted(item.total, "USD", numberLocale))
      const cells = view.host.querySelectorAll(".sf-u08-detail td")
      expect(cells[0]?.textContent).toBe(formatted(item.month, "USD", numberLocale))
      expect(cells[1]?.textContent).toBe(formatted(0, "USD", numberLocale))
      expect(view.host.querySelector(".sf-u08-detail h3")?.textContent).toBe(translate("sf.u08.monthly"))
      for (const { cur } of item.currencies)
        expect(view.host.querySelector(".sf-u08-rate-list")?.textContent).toContain(formatted(1200, cur, numberLocale))
      expect(JSON.stringify(original)).toBe(before)
      expect(reads.length).toBeGreaterThan(0)
      expect(reads.every((read) => read.year === 2026 && read.version === "budget-2026")).toBe(true)
    } finally { view.close() }
  }
})

test("Headcount localizes missing rate currency and keeps null annual distinct from zero", async () => {
  const original = await projected([{ cur: "", fx: 1 }])
  const view = mount(original, "pt-BR")
  try {
    await until(() => view.host.querySelector("[data-sf-state=ready]") !== null)
    expect(view.host.querySelector(".sf-u08-rate-list")?.textContent)
      .toContain("1.200 · " + translate("sf.u02.noCurrency"))
    expect(view.host.textContent).not.toContain("unspecified")
    expect(view.host.querySelectorAll(".sf-u08-plan-summary dd")[1]?.textContent).toBe(formatted(100, "USD", "pt-BR"))
    expect(view.host.querySelector(".sf-u08-detail td")?.textContent).toBe(formatted(100, "USD", "pt-BR"))
  } finally { view.close() }
  const absent = await projected([{ cur: "EUR", fx: 1.2 }], true, null)
  expect(absent.value.data.rates?.[0]?.annual).toBeNull()
  const missing = mount(absent, "en")
  try {
    await until(() => missing.host.querySelector("[data-sf-state=ready]") !== null)
    expect(missing.host.querySelector(".sf-u08-rate-list")?.textContent).toContain(SF_U08_COPY["sf.u08.none"])
    expect(missing.host.querySelector(".sf-u08-detail td")?.textContent).toBe(formatted(0, "USD", "en-US"))
  } finally { missing.close() }
})

test("Headcount preserves scope and distinguishes denied access from an authorized empty result", async () => {
  const view = mount(await projected([], false), "en", false)
  try {
    await until(() => view.host.querySelector("[data-sf-state=empty]") !== null)
    expect(view.host.textContent).toContain(SF_COMMON_COPY["sf.common.empty"])
    expect(view.host.querySelector("select")?.value).toBe(version.id)
    const beforeReads = reads.length
    setLocale("pt-BR")
    await until(() => view.host.textContent?.includes(SF_COMMON_COPY_BR["sf.common.empty"]) === true)
    expect(view.host.querySelector("select")?.value).toBe(version.id)
    expect(reads).toHaveLength(beforeReads)
    source = { status: "denied" }
    responseStatus = 403
    setGeneration((value) => value + 1)
    await until(() => view.host.querySelector("[data-sf-state=denied]") !== null)
    expect(view.host.textContent).toContain(SF_COMMON_COPY_BR["sf.common.noAccess"])
    expect(view.host.textContent).not.toContain(SF_COMMON_COPY_BR["sf.common.empty"])
    expect(view.host.querySelector(".sf-u08")).toBeNull()
    expect(reads.length).toBeGreaterThan(beforeReads)
    expect(reads.every((read) => read.year === 2026 && read.version === "budget-2026")).toBe(true)
  } finally { view.close() }
})
