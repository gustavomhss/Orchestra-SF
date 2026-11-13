import { expect, test } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { createComponent, render } from "./lean-dom.test-helper"
import { solidDom } from "./solid-dom"
type Http = import("@/context/server").ServerConnection.Http

const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { ServerProvider, useServer, ServerConnection }: typeof import("@/context/server") = await import(solidDom("@/context/server", import.meta.dir))
const { createServerManagementController }: typeof import("@/components/dialog-select-server") = await import(solidDom("@/components/dialog-select-server", import.meta.dir))

const pin: Http = { type: "http", http: { url: "https://verified.example" } }
const foreign: Http = { type: "http", http: { url: "https://foreign.example", username: "other", password: "secret" } }
const pinKey = ServerConnection.key(pin)
const foreignKey = ServerConnection.key(foreign)

async function until(check: () => boolean) {
  for (let turn = 0; turn < 100 && !check(); turn++) await new Promise((resolve) => setTimeout(resolve, 0))
  expect(check()).toBe(true)
}

async function settle() {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function fixture(pinned: boolean, input: { current?: string | null; legacy?: string } = {}) {
  const seed = {
    list: [foreign, { type: "http", http: { url: pin.http.url, username: "stored", password: "stored-secret" }, authToken: true }],
    projects: { [foreignKey]: [{ worktree: "/foreign", expanded: true }], local: [{ worktree: "/own", expanded: true }] },
    lastProject: { [foreignKey]: "/foreign", local: "/own" },
    recentlyClosed: {},
  }
  const seededServer = input.current === undefined ? JSON.stringify(seed) : input.current
  const seededDefault = foreignKey
  const preference: { defaultServer: typeof foreignKey | null } = { defaultServer: seededDefault }
  const files = new Map<string, Map<string, string>>([
    ["orchestra.global.dat", new Map(seededServer === null ? [] : [["server", seededServer]])],
    ["default.dat", new Map(input.legacy === undefined ? [] : [["server.v3", input.legacy]])],
  ])
  const snapshot = () => Object.fromEntries(
    [...files].filter(([, store]) => store.size > 0).map(([name, store]) => [name, Object.fromEntries(store)]),
  )
  const seededStorage = snapshot()
  const writeLog: { operation: "set" | "remove"; storage: string; key: string; value?: string }[] = []
  const defaultWrites: (typeof foreignKey | null)[] = []
  const probes: string[] = []
  const actions: string[] = []
  const platform: import("@/context/platform").Platform = {
    platform: "desktop", os: "macos",
    openExternal() {}, async restart() {}, async notify() {}, async openDirectoryPickerDialog() { return null },
    storage(name) {
      const key = name ?? "default.dat"
      if (!files.has(key)) files.set(key, new Map())
      const store = files.get(key)!
      return {
        getItem: (item) => store.get(item) ?? null,
        setItem: (item, value) => { writeLog.push({ operation: "set", storage: key, key: item, value }); store.set(item, value) },
        removeItem: (item) => { writeLog.push({ operation: "remove", storage: key, key: item }); store.delete(item) },
      }
    },
    async getDefaultServer() { return preference.defaultServer },
    async setDefaultServer(key) { defaultWrites.push(key); preference.defaultServer = key; actions.push(`default:${key}`) },
  }
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false, gcTime: 0 } } })
  const host = document.createElement("div")
  document.body.append(host)
  const state: { server?: ReturnType<typeof useServer>; controller?: ReturnType<typeof createServerManagementController> } = {}
  const suppliedPin: Http = { type: "http", http: { url: pin.http.url } }
  const props = {
    defaultServer: foreignKey,
    canonicalLocalServer: pinKey,
    servers: [foreign],
    ...(pinned ? { pinnedServer: suppliedPin } : {}),
    get children() {
      return createComponent(QueryClientProvider, { client: queryClient, get children() {
        return createComponent(() => {
          const server = useServer()
          state.server = server
          state.controller = createServerManagementController({
            server,
            platform,
            navigate: () => { actions.push("navigate") },
            tabs: { removeServer: () => { actions.push("tabs") } },
            global: { servers: { list: () => server.list, health: {} } },
            language: { t: (key) => key },
            checkServerHealth: async (http) => { probes.push(http.url); return { healthy: true } },
          }, { navigateOnAdd: false })
          return null
        }, {})
      } })
    },
  }
  const dispose = render(() => createComponent(PlatformProvider, {
    value: platform,
    get children() { return createComponent(ServerProvider, props) },
  }), host)
  await until(() => !!state.server && !!state.controller)
  await settle()
  const server = state.server!
  const controller = state.controller!
  const initializationWrites = writeLog.slice()
  const initializationDefaultWrites = defaultWrites.slice()
  const mutationStart = writeLog.length
  const actionStart = actions.length
  return {
    server, controller, probes, files, suppliedPin, seededServer, seededDefault, seededStorage, snapshot, preference, writeLog, defaultWrites,
    initializationWrites, initializationDefaultWrites,
    get writes() { return writeLog.slice(mutationStart) },
    get actions() { return actions.slice(actionStart) },
    close() { dispose(); queryClient.clear(); host.remove() },
  }
}

test("pin overrides persisted and supplied foreign server while keeping stored profiles intact", async () => {
  const f = await fixture(true)
  try {
    expect(f.files.get("orchestra.global.dat")?.get("server")).toBe(f.seededServer)
    expect(f.preference.defaultServer).toBe(f.seededDefault)
    expect(f.initializationWrites).toEqual([])
    expect(f.initializationDefaultWrites).toEqual([])
    expect(f.server.list).toEqual([pin])
    expect(f.server.current).toEqual(pin)
    expect(f.server.key).toBe(pinKey)
    expect(Reflect.get(f.server, "pinned")).toEqual(pin)
    expect(f.files.get("orchestra.global.dat")?.get("server")).toBe(f.seededServer)
    expect(f.preference.defaultServer).toBe(f.seededDefault)
    expect(f.writes).toEqual([])
  } finally { f.close() }
})

test("pinned provider blocks foreign activation, add and removal without persistence writes", async () => {
  const f = await fixture(true)
  try {
    const before = f.files.get("orchestra.global.dat")?.get("server")
    f.server.setActive(foreignKey)
    expect(f.server.add(foreign)).toBeUndefined()
    f.server.remove(foreignKey)
    f.server.remove(pinKey)
    await settle()
    expect(f.server.key).toBe(pinKey)
    expect(f.server.list).toEqual([pin])
    expect(f.files.get("orchestra.global.dat")?.get("server")).toBe(before)
    expect(f.writes).toEqual([])
  } finally { f.close() }
})

test("same-origin credentialed profile cannot alter the captured canonical pin", async () => {
  const f = await fixture(true)
  try {
    f.server.add({ type: "http", http: { url: pin.http.url, username: "injected", password: "injected-secret" }, authToken: true })
    await settle()
    expect(f.server.current).toEqual(pin)
    expect(f.server.list).toEqual([pin])
    expect(Reflect.get(f.server, "pinned")).toEqual(pin)
    expect(f.writes).toEqual([])
  } finally { f.close() }
})

test("the provider captures an immutable copy of the verified pin", async () => {
  const f = await fixture(true)
  try {
    f.suppliedPin.http.url = "https://changed.example"
    f.suppliedPin.http.password = "later-secret"
    expect(f.server.current).toEqual(pin)
    expect(f.server.list).toEqual([pin])
    expect(Reflect.get(f.server, "pinned")).toEqual(pin)
    expect(f.server.key).toBe(pinKey)
  } finally { f.close() }
})

test("pin uses canonical local project scope and retains independent foreign project state", async () => {
  const f = await fixture(true)
  try {
    expect(f.initializationWrites).toEqual([])
    expect(f.initializationDefaultWrites).toEqual([])
    expect(f.snapshot()).toEqual(f.seededStorage)
    expect(f.server.scope()).toBe("local")
    expect(f.server.projects.list()).toEqual([{ worktree: "/own", expanded: true }])
    f.server.projects.open("/own-new")
    f.server.projects.touch("/own-new")
    await settle()
    expect(f.server.projects.last()).toBe("/own-new")
    expect(f.server.projects.list().map((project) => project.worktree)).toContain("/own-new")
    expect(f.server.projects.forServer(foreignKey).list()).toEqual([{ worktree: "/foreign", expanded: true }])
    expect(f.writes.some((entry) => entry.operation === "set" && entry.storage === "orchestra.global.dat" && entry.key === "server")).toBe(true)
    const stored = f.files.get("orchestra.global.dat")?.get("server")
    expect(stored).toBeDefined()
    expect(stored).not.toBe(f.seededServer)
    expect(JSON.parse(stored!)).toMatchObject({
      list: [foreign, { type: "http", http: { url: pin.http.url, username: "stored", password: "stored-secret" }, authToken: true }],
      projects: { local: [{ worktree: "/own-new", expanded: true }, { worktree: "/own", expanded: true }], [foreignKey]: [{ worktree: "/foreign", expanded: true }] },
      lastProject: { local: "/own-new", [foreignKey]: "/foreign" },
    })
    expect(f.preference.defaultServer).toBe(f.seededDefault)
    expect(f.defaultWrites).toEqual([])
  } finally { f.close() }
})

test("pinned management prevents add input preview and submit health probes", async () => {
  const f = await fixture(true)
  try {
    f.controller.startAdd()
    f.controller.handleFormChange()("https://probe-add.example")
    f.controller.handleFormUsernameChange()("user")
    f.controller.handleFormPasswordChange()("secret")
    expect(f.probes).toEqual([])
    f.controller.submitForm()
    await settle()
    expect(f.probes).toEqual([])
    expect(f.actions).toEqual([])
    expect(f.writes).toEqual([])
    expect(f.server.key).toBe(pinKey)
  } finally { f.close() }
})

test("pinned management blocks edit preview, select, default and removal", async () => {
  const f = await fixture(true)
  try {
    f.controller.startEdit(pin)
    f.controller.handleFormChange()("https://probe-edit.example")
    f.controller.handleFormPasswordChange()("secret")
    f.controller.submitForm()
    await f.controller.select(foreign, true)
    await f.controller.select(foreign)
    await f.controller.setDefault(foreignKey)
    await f.controller.handleRemove(pinKey)
    await settle()
    expect(f.probes).toEqual([])
    expect(f.actions).toEqual([])
    expect(f.writes).toEqual([])
    expect(f.server.current).toEqual(pin)
    expect(f.server.key).toBe(pinKey)
  } finally { f.close() }
})

test("unpinned provider and management retain profile selection and health preview", async () => {
  const f = await fixture(false)
  try {
    expect(f.server.key).toBe(foreignKey)
    expect(f.server.current?.http.url).toBe(foreign.http.url)
    f.controller.startAdd()
    f.controller.handleFormChange()("https://ordinary.example")
    await settle()
    expect(f.probes).toContain("https://ordinary.example")
    f.controller.submitForm()
    await until(() => f.server.list.some((item) => item.http.url === "https://ordinary.example"))
    expect(f.server.list.some((item) => item.http.url === foreign.http.url)).toBe(true)
    expect(f.writes.length).toBeGreaterThan(0)
  } finally { f.close() }
})


test("pinned hydration preserves an incomplete current record without rewriting defaults", async () => {
  const raw = JSON.stringify({ list: [foreign], projects: { [foreignKey]: [{ worktree: "/foreign", expanded: true }] } })
  const f = await fixture(true, { current: raw })
  try {
    expect(f.snapshot()).toEqual(f.seededStorage)
    expect(f.files.get("orchestra.global.dat")?.get("server")).toBe(raw)
    expect(f.preference.defaultServer).toBe(f.seededDefault)
    expect(f.writeLog).toEqual([])
    expect(f.defaultWrites).toEqual([])
    expect(f.server.current).toEqual(pin)
    expect(f.server.projects.forServer(foreignKey).list()).toEqual([{ worktree: "/foreign", expanded: true }])
  } finally { f.close() }
})

test("pinned hydration preserves corrupt current JSON without deleting it", async () => {
  const raw = '{"list":['
  const f = await fixture(true, { current: raw })
  try {
    expect(f.snapshot()).toEqual(f.seededStorage)
    expect(f.files.get("orchestra.global.dat")?.get("server")).toBe(raw)
    expect(f.preference.defaultServer).toBe(f.seededDefault)
    expect(f.writeLog).toEqual([])
    expect(f.defaultWrites).toEqual([])
    expect(f.server.current).toEqual(pin)
    expect(f.server.key).toBe(pinKey)
  } finally { f.close() }
})

test("pinned hydration reads legacy canonical projects in local scope without promoting or deleting legacy storage", async () => {
  const raw = JSON.stringify({
    list: [foreign],
    projects: { [pinKey]: [{ worktree: "/legacy-own", expanded: true }], [foreignKey]: [{ worktree: "/foreign", expanded: true }] },
    lastProject: { [pinKey]: "/legacy-own", [foreignKey]: "/foreign" },
    recentlyClosed: {},
  })
  const f = await fixture(true, { current: null, legacy: raw })
  try {
    expect(f.snapshot()).toEqual(f.seededStorage)
    expect(f.files.get("default.dat")?.get("server.v3")).toBe(raw)
    expect(f.files.get("orchestra.global.dat")?.has("server")).toBe(false)
    expect(f.preference.defaultServer).toBe(f.seededDefault)
    expect(f.writeLog).toEqual([])
    expect(f.defaultWrites).toEqual([])
    expect(f.server.scope()).toBe("local")
    expect(f.server.projects.list()).toEqual([{ worktree: "/legacy-own", expanded: true }])
    expect(f.server.projects.last()).toBe("/legacy-own")
    expect(f.server.projects.forServer(foreignKey).list()).toEqual([{ worktree: "/foreign", expanded: true }])
    expect(f.server.current).toEqual(pin)
  } finally { f.close() }
})
