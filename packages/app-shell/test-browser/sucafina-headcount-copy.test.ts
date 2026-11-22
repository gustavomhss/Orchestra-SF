import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { Schema } from "effect"
import { createComponent, createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
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
const page = (currencies: string[], positions = true): Page => ({
  status: "ok", context: stamp,
  value: {
    capabilityId: "CAP20", selection: { year: 2026, versionId: version.id },
    allowedActionIds: [], versions: {},
    data: {
      versions: [version], selectedVersion: version,
      positions: positions ? [{
        id: "position-one", name: "Analyst", revision: 1, rateId: "rate-0",
        months: [1234.5, 0, null, null, null, null, null, null, null, null, null, null],
      }] : [],
      rates: currencies.map((cur, index) => ({ id: "rate-" + index, name: "Rate " + index, revision: 1, cur, annual: 1234.5 })),
      metrics: { fte: 1, hrTotal: 1234.5 },
    },
  },
})
let source: Result = page(["USD"])
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
// The Planner client, response schema, Headcount calculations and localized catalogs are real.
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

test("Headcount names the source currency in non-USD summaries and preserves monthly values", async () => {
  for (const [currency, lang] of [["EUR", "en"], ["BRL", "pt-BR"], ["USD", "en"]] as const) {
    const original = page([currency])
    const before = JSON.stringify(original)
    const view = mount(original, lang)
    try {
      await until(() => view.host.querySelector("[data-sf-state=ready]") !== null)
      const summary = view.host.querySelectorAll(".sf-u08-plan-summary dt")
      expect(summary[1]?.textContent).toBe(currency === "USD"
        ? translate("sf.u08.total") : translate("sf.u08.moneyInCurrency", { currency }))
      const numberLocale = lang === "en" ? "en-US" : "pt-BR"
      expect(view.host.querySelectorAll(".sf-u08-plan-summary dd")[1]?.textContent).toBe(formatted(1234.5, currency, numberLocale))
      const cells = view.host.querySelectorAll(".sf-u08-detail td")
      expect(cells[0]?.textContent).toBe(formatted(1234.5, currency, numberLocale))
      expect(cells[1]?.textContent).toBe(formatted(0, currency, numberLocale))
      expect(cells[2]?.textContent).toBe(translate("sf.u08.none"))
      expect(view.host.querySelector(".sf-u08-rate-list")?.textContent).toContain(formatted(1234.5, currency, numberLocale))
      expect(JSON.stringify(original)).toBe(before)
      expect(reads).toEqual([{ year: 2026, version: "budget-2026" }])
    } finally { view.close() }
  }
})

test("Headcount localizes missing or mixed currency without assuming USD", async () => {
  for (const currencies of [[""], ["EUR", "USD"]]) {
    const view = mount(page(currencies), "pt-BR")
    try {
      await until(() => view.host.querySelector("[data-sf-state=ready]") !== null)
      expect(view.host.querySelectorAll(".sf-u08-plan-summary dt")[1]?.textContent).toBe(translate("sf.u08.moneyUnscoped"))
      expect(view.host.querySelectorAll(".sf-u08-plan-summary dd")[1]?.textContent)
        .toBe("1.234,5 · " + translate("sf.u02.noCurrency"))
      expect(view.host.textContent).not.toContain("unspecified")
      const first = view.host.querySelector(".sf-u08-detail td")?.textContent
      expect(first).toBe(currencies[0] ? formatted(1234.5, currencies[0], "pt-BR")
        : "1.234,5 · " + translate("sf.u02.noCurrency"))
      expect(view.host.querySelector(".sf-u08-rate-list")?.textContent).toContain(first ?? "")
    } finally { view.close() }
  }
})

test("Headcount preserves scope and distinguishes denied access from an authorized empty result", async () => {
  const view = mount(page([], false), "en", false)
  try {
    await until(() => view.host.querySelector("[data-sf-state=empty]") !== null)
    expect(view.host.textContent).toContain(SF_COMMON_COPY["sf.common.empty"])
    expect(view.host.querySelector("select")?.value).toBe(version.id)
    setLocale("pt-BR")
    await until(() => view.host.textContent?.includes(SF_COMMON_COPY_BR["sf.common.empty"]) === true)
    expect(view.host.querySelector("select")?.value).toBe(version.id)
    expect(reads).toEqual([{ year: 2026, version: "budget-2026" }])
    source = { status: "denied" }
    responseStatus = 403
    setGeneration((value) => value + 1)
    await until(() => view.host.querySelector("[data-sf-state=denied]") !== null)
    expect(view.host.textContent).toContain(SF_COMMON_COPY_BR["sf.common.noAccess"])
    expect(view.host.textContent).not.toContain(SF_COMMON_COPY_BR["sf.common.empty"])
    expect(view.host.querySelector(".sf-u08")).toBeNull()
    expect(reads).toEqual([{ year: 2026, version: "budget-2026" }, { year: 2026, version: "budget-2026" }])
  } finally { view.close() }
})
