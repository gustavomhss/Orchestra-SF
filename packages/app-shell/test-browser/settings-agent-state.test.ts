import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import path from "node:path"
import { createComponent } from "solid-js"
import { createStore } from "solid-js/store"
import { render } from "solid-js/web"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import type { NormalizedProviderListResponse } from "@orchestra/session-ui/context"
import type { Agent, Model, Provider } from "../src/v2-wire"
import { ServerConnection } from "../src/context/server"
import { ORCHESTRA_COPY } from "../src/i18n/orchestra"

const compiler = createRequire(Bun.resolveSync("vite-plugin-solid", import.meta.dir))
const suffix = "?settings-agents"
const subject = (specifier: string) => Bun.resolveSync(specifier, import.meta.dir) + suffix
const reads: string[] = []
const navigations: string[] = []
const drafts: { server: ServerConnection.Key; directory: string }[] = []
const pending = new Map<string, ReturnType<typeof Promise.withResolvers<NormalizedProviderListResponse>>>()
const server: ServerConnection.Http = { type: "http", http: { url: "http://settings-agents.test" } }
const agents: Agent[] = [
  { id: "maestro", name: "Maestro", mode: "primary", permission: [], options: {},
    model: { providerID: "fixture", modelID: "tools" } },
  { id: "review", name: "Review", mode: "all", permission: [], options: {} },
  { id: "research", name: "Research", mode: "subagent", permission: [], options: {},
    model: { providerID: "fixture", modelID: "tools" } },
  { id: "hidden", name: "Hidden", mode: "all", hidden: true, permission: [], options: {} },
]
const key = (directory: string) => ["settings-agents", "providers", directory]
const sync = {
  child: () => [{ agent: agents, load: { agent: "ready" } }],
  queryOptions: {
    providers: (directory: string) => ({
      queryKey: key(directory),
      queryFn: () => {
        reads.push(directory)
        const request = pending.get(directory)
        if (!request) throw new Error("Unexpected provider scope: " + directory)
        return request.promise
      },
      retry: false,
      staleTime: Infinity,
    }),
  },
}
const fixtures: Record<string, object> = {
  sync: { useServerSync: () => () => sync },
  tabs: { useTabs: () => ({
    ready: () => true,
    newDraft: async (draft: { server: ServerConnection.Key; directory: string }) => { drafts.push(draft) },
  }) },
  router: { useNavigate: () => (destination: string) => { navigations.push(destination) } },
  platform: { usePlatform: () => ({ openExternal() {} }) },
  language: { useLanguage: () => ({
    t: (name: string, values: Record<string, string | number> = {}) =>
      String(Reflect.get(ORCHESTRA_COPY, name) ?? name)
        .replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? "")),
  }) },
}
const imports: Record<string, string> = {
  "@/context/server-sync": "settings-agents:sync",
  "@/context/tabs": "settings-agents:tabs",
  "@solidjs/router": "settings-agents:router",
  "@/context/platform": "settings-agents:platform",
  "@/context/language": "settings-agents:language",
}

// Scope only the external context fixtures to this compiled graph. Solid Query, roster, model validation,
// card DOM and actions remain the production implementations; other tests' module registry is untouched.
Bun.plugin({
  name: "settings-agents-dom",
  setup(build) {
    build.onResolve({ filter: /^settings-agents:/ }, (args) => ({
      path: args.path.slice("settings-agents:".length), namespace: "settings-agents",
    }))
    build.onLoad({ filter: /.*/, namespace: "settings-agents" }, (args) => ({
      loader: "object", exports: fixtures[args.path],
    }))
    build.onLoad({ filter: /\.tsx?\?settings-agents$/ }, async (args) => {
      const file = args.path.slice(0, -suffix.length)
      const source = (await Bun.file(file).text()).replace(/import\.meta\.glob(<[^>]*>)?\([^)]*\)/g, "({})")
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
const { AgentsSection }: typeof import("../src/components/settings-v2/view/capabilities-section") =
  await import(subject("../src/components/settings-v2/view/capabilities-section"))
const { AgentsRoster }: typeof import("../src/orchestra/chapters/agents-view") =
  await import(subject("../src/orchestra/chapters/agents-view"))

function catalog(connected: string[], status: Model["status"] = "active", toolcall = true, present = true): NormalizedProviderListResponse {
  const model: Model = {
    id: "tools", providerID: "fixture", name: "Fixture tools", api: { id: "tools", url: "", npm: "" },
    capabilities: {
      temperature: false, reasoning: false, attachment: false, toolcall,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false }, interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 4096, output: 1024 }, status, options: {}, headers: {}, release_date: "",
  }
  const provider: Provider = { id: "fixture", name: "Fixture", source: "api", env: [], options: {},
    models: present ? { tools: model } : {} }
  return { all: new Map([[provider.id, provider]]), connected, default: {} }
}

async function until(predicate: () => boolean) {
  for (let n = 0; n < 100 && !predicate(); n++) await new Promise<void>((resolve) => setImmediate(resolve))
  expect(predicate()).toBe(true)
}

test("Settings agent availability follows the scoped live provider catalog without changing agent configuration", async () => {
  const [state, setState] = createStore({ directory: "/one" })
  const first = Promise.withResolvers<NormalizedProviderListResponse>()
  const second = Promise.withResolvers<NormalizedProviderListResponse>()
  pending.set("/one", first)
  pending.set("/two", second)
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const host = document.createElement("div")
  document.body.append(host)
  const original = JSON.stringify(agents)
  const dispose = render(() => createComponent(QueryClientProvider, {
    client: query,
    get children() { return createComponent(AgentsSection, {
      server, get directory() { return state.directory },
    }) },
  }), host)
  const badge = (name: string) => host.querySelector('[data-agent="' + name + '"] .mx-badge.good, [data-agent="' + name + '"] .mx-badge.bad')
  const update = async (next: NormalizedProviderListResponse) => {
    query.setQueryData(key(state.directory), next)
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  try {
    await until(() => host.querySelectorAll("[data-agent]").length === 3)
    expect(badge("Maestro")).toBeNull()
    expect(badge("Review")).toBeNull()
    first.resolve(catalog([]))
    await until(() => badge("Maestro")?.classList.contains("bad") === true)
    expect(badge("Maestro")?.textContent).toBe("fixture is not connected in this project.")
    expect(badge("Review")?.textContent).toBe("No provider is connected in this project.")

    await update(catalog(["fixture"]))
    await until(() => badge("Maestro")?.classList.contains("good") === true)
    expect(badge("Maestro")?.textContent).toBe("Available")
    expect(badge("Review")?.textContent).toBe("Available")

    await update(catalog(["fixture"], "deprecated"))
    await until(() => badge("Maestro")?.classList.contains("bad") === true)
    expect(badge("Maestro")?.textContent).toBe("fixture/tools is unavailable in this project.")
    await update(catalog(["fixture"], "active", true, false))
    expect(badge("Research")?.textContent).toBe("fixture/tools is unavailable in this project.")
    await update(catalog(["fixture"], "active", false))
    expect(badge("Maestro")?.textContent).toContain("fixture/tools")
    expect(badge("Maestro")?.classList.contains("bad")).toBe(true)
    expect(badge("Maestro")?.textContent).not.toContain("is unavailable")
    await update(catalog([]))
    expect(badge("Maestro")?.textContent).toBe("fixture is not connected in this project.")

    await update(catalog(["fixture"]))
    setState("directory", "/two")
    await until(() => reads.includes("/two"))
    expect(badge("Maestro")).toBeNull()
    second.reject(new Error("provider read failed"))
    await until(() => query.getQueryState(key("/two"))?.status === "error")
    expect(badge("Maestro")).toBeNull()
    await update(catalog([]))
    await until(() => badge("Maestro")?.classList.contains("bad") === true)

    const configure = [...host.querySelectorAll("button")].find((button) => button.textContent === "Configure")!
    configure.click()
    expect(navigations).toEqual(["/orchestra/agents"])
    const chats = [...host.querySelectorAll("button")].filter((button) => button.textContent === "Open Chat")
    expect(chats).toHaveLength(1)
    chats[0]!.click()
    await until(() => drafts.length === 1)
    expect(drafts).toEqual([{ server: ServerConnection.key(server), directory: "/two" }])
    expect(JSON.stringify(agents)).toBe(original)
    expect(reads).toEqual(["/one", "/two"])
  } finally {
    dispose()
    query.clear()
    host.remove()
    pending.clear()
  }
})

test("the Agents roster distinguishes all mode and keeps only Maestro's chat entry", () => {
  const opened: string[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(AgentsRoster, {
    agents, availability: () => undefined, scope: "/one", stats: () => ({}),
    onOpen: (agent) => opened.push(agent.id ?? agent.name), onChat() {},
  }), host)
  try {
    const cards = [...host.querySelectorAll("li.agent")]
    expect(cards.map((card) => card.querySelector(".agent-role")?.textContent)).toEqual(["Lead agent", "all", "Specialist"])
    expect(host.querySelectorAll(".agent-chat")).toHaveLength(1)
    cards[1]!.querySelector<HTMLButtonElement>(".agent-open")!.click()
    expect(opened).toEqual(["review"])
  } finally {
    dispose()
    host.remove()
  }
})
