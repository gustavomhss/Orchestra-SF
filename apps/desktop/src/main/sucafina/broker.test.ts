import { afterEach, expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { mkdtemp, chmod, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfOperationBindings } from "@orchestra/schema/sucafina/common"
import { createSfDesktopBroker, type SfDesktopBrokerDependencies } from "./index"
import { createSfConnectionRegistry, validateSfCandidate, type SfDesktopOwner } from "./connections"
import { allowSfAuthNavigation } from "./auth"
import { requireSfEnrollmentUrl, readSfUnmanagedEnrollment } from "./enrollment"
import { publicSfHeaders } from "./network"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"

const descriptor: SfInstallationDescriptor = {
  installationId: "installation-A", projectId: "project-A", hostId: "host-A",
  publicOrigin: "https://tenant.example", mount: "/sucafina",
  contractRevision: "sf-native-ui/1", authMode: "microsoft",
}
const candidate = {
  serverKey: descriptor.publicOrigin,
  projectId: descriptor.projectId, baseUrl: descriptor.publicOrigin,
  credentials: { kind: "none" as const },
}
const codecs: SfOperationBindings = {
  "ctx.installations": {
    decodeInput(value) {
      if (!value || typeof value !== "object" || !("select" in value) || value.select !== "ids")
        return { status: "invalid" }
      return { status: "ok", value: value as { select: "ids"; installationId: string; projectId: string } }
    },
    decodeOutput(value) {
      return value && typeof value === "object" ? { status: "ok", value: value as { installations: typeof descriptor[] } }
        : { status: "invalid" }
    },
  },
}

const owners = new Set<{ win: EventEmitter & { webContents: EventEmitter }; sender: EventEmitter }>()
function fakeOwner(id: number) {
  const sender = Object.assign(new EventEmitter(), {
    id, mainFrame: { url: "oc://renderer/index.html" },
    isDestroyed: () => false, send: (_name: string, _data: unknown) => undefined,
  })
  const win = Object.assign(new EventEmitter(), { webContents: sender, isDestroyed: () => false })
  owners.add({ win, sender })
  return { win, sender, event: { sender, senderFrame: sender.mainFrame } }
}
const roots: string[] = []
afterEach(async () => {
  owners.clear()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function brokerFixture(contextReplies: Array<{ status: number; body: unknown }> = []) {
  const ipc = new Map<string, (event: unknown, arg: unknown) => Promise<unknown>>()
  const sessionNames: string[] = []
  const invalidations: unknown[] = []
  const queries: Array<{ url: string; session: unknown; headers: Record<string, string> }> = []
  const app = Object.assign(new EventEmitter(), { getLocale: () => "pt-BR" })
  const dialogs: Array<{ defaultId: number; cancelId: number }> = []
  const sessions = new Map<string, { clearStorageData: () => Promise<void>; clearCache: () => Promise<void> }>()
  let cleared = 0
  let failLogout = false
  class AuthWindow extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: () => undefined })
    isDestroyed() { return false }
    close() { this.emit("closed") }
    async loadURL() {
      queueMicrotask(() => {
        const event = { preventDefault() {} }
        this.webContents.emit("will-navigate", event, descriptor.publicOrigin + descriptor.mount + "/dashboard?sf=native-return&resume=abcdefghijklmnop")
        this.webContents.emit("will-redirect", event, descriptor.publicOrigin + "/orchestra/sf-home")
      })
    }
    static fromWebContents(sender: unknown) { return [...owners].find((entry) => entry.sender === sender)?.win }
  }
  const api = {
    app,
    ipcMain: {
      handle: (name: string, listener: (event: unknown, arg: unknown) => Promise<unknown>) => ipc.set(name, listener),
      removeHandler: (name: string) => ipc.delete(name),
    },
    BrowserWindow: AuthWindow,
    dialog: {
      async showMessageBox(_win: unknown, options: { defaultId: number; cancelId: number }) {
        dialogs.push(options)
        return { response: 1 }
      },
    },
    session: {
      fromPartition(name: string) {
        sessionNames.push(name)
        const existing = sessions.get(name)
        if (existing) return existing
        const value = {
          clearStorageData: async () => { cleared++ },
          clearCache: async () => undefined,
        }
        sessions.set(name, value)
        return value
      },
    },
    net: {
      request(options: { url: string; session: unknown }) {
        const req = new EventEmitter() as EventEmitter & {
          setHeader(name: string, value: string): void
          write(bytes: Buffer): void
          end(): void
          abort(): void
        }
        const headers: Record<string, string> = {}
        req.setHeader = (key, value) => { headers[key] = value }
        req.write = () => undefined
        req.abort = () => { req.emit("abort") }
        queries.push({ url: options.url, session: options.session, headers })
        req.end = () => queueMicrotask(() => {
          if (failLogout && options.url.endsWith("/auth/logout")) {
            req.emit("error", new Error("offline"))
            return
          }
          const context = options.url.includes("/api/ui/context") ? contextReplies.shift() : undefined
          const intent = options.url.includes("/api/ui/return-intents")
          const response = Object.assign(new EventEmitter(), {
            headers: options.url.includes("installations") || context || intent ? { "content-type": "application/json" } : {},
            statusCode: options.url.includes("installations") || intent ? 200 : context?.status ?? 204,
            pause: () => undefined, resume: () => undefined,
          })
          req.emit("response", response)
          queueMicrotask(() => {
            if (options.url.includes("installations"))
              response.emit("data", Buffer.from(JSON.stringify({ installations: [descriptor] })))
            if (context) response.emit("data", Buffer.from(JSON.stringify(context.body)))
            if (intent) response.emit("data", Buffer.from(JSON.stringify({ resume: "abcdefghijklmnop" })))
            response.emit("end")
          })
        })
        return req
      },
    },
  }
  const broker = createSfDesktopBroker({
    electron: api as unknown as SfDesktopBrokerDependencies["electron"],
    operations: { ...codecs, "ctx.context": SfNativeOperationBindings["ctx.context"] },
    isRendererUrl: (url) => url.startsWith("oc://renderer/"),
    isMainWindow: (win) => [...owners].some((owner) => owner.win === win),
    ownedConnection: () => undefined,
    requestLocalEnrollment: async () => { throw new Error("not configured") },
  })
  const call = (channel: string, event: unknown, arg: unknown) => {
    const handler = ipc.get(channel)
    if (!handler) throw new Error("missing channel " + channel)
    return handler(event, arg)
  }
  return { broker, call, sessionNames, invalidations, queries, dialogs, get cleared() { return cleared },
    failLogout() { failLogout = true } }
}

test("connection approval rejects arbitrary origins, URL credentials, unknown keys and sidecar impersonation", () => {
  expect(validateSfCandidate(candidate, undefined)).toEqual(candidate)
  expect(validateSfCandidate({ ...candidate, baseUrl: "http://tenant.example" }, undefined)).toBeUndefined()
  expect(validateSfCandidate({ ...candidate, baseUrl: "https://user:pass@tenant.example" }, undefined)).toBeUndefined()
  expect(validateSfCandidate({ ...candidate, admin: true }, undefined)).toBeUndefined()
  expect(validateSfCandidate({ ...candidate, serverKey: "sidecar" }, undefined)).toBeUndefined()
})

test("native consent defaults to cancel and does not reveal a connection across owners", async () => {
  const first = fakeOwner(1)
  const second = fakeOwner(2)
  const copy: Array<{ defaultId: number; cancelId: number }> = []
  const revoked: string[] = []
  const ownerOne: SfDesktopOwner = { window: first.win as unknown as SfDesktopOwner["window"],
    sender: first.sender as unknown as SfDesktopOwner["sender"], frame: first.sender.mainFrame as SfDesktopOwner["frame"] }
  const ownerTwo: SfDesktopOwner = { window: second.win as unknown as SfDesktopOwner["window"],
    sender: second.sender as unknown as SfDesktopOwner["sender"], frame: second.sender.mainFrame as SfDesktopOwner["frame"] }
  const registry = createSfConnectionRegistry({
    app: { getLocale: () => "pt-BR" } as unknown as Parameters<typeof createSfConnectionRegistry>[0]["app"],
    dialog: { showMessageBox: async (_win: unknown, options: { defaultId: number; cancelId: number }) => {
      copy.push(options)
      return { response: 1 }
    } } as unknown as Parameters<typeof createSfConnectionRegistry>[0]["dialog"],
    ownedConnection: () => undefined, validOwner: () => true,
    onReplaced: async (connection, reason) => { revoked.push(reason + ":" + connection.candidate.serverKey) },
  })
  const approved = await registry.register(candidate, ownerOne)
  expect(approved.status).toBe("approved")
  expect(copy).toEqual([expect.objectContaining({ defaultId: 0, cancelId: 0 })])
  expect(registry.get(ownerTwo, candidate.serverKey, candidate.projectId)).toBeUndefined()
  expect(registry.get(ownerOne, candidate.serverKey, candidate.projectId)).toBeDefined()
  await registry.invalidateServer(candidate.serverKey)
  expect(revoked).toEqual(["server-removed:" + candidate.serverKey])
})

test("two approved frames get distinct in-memory SF Sessions; cross-frame handles are rejected", async () => {
  const fixture = brokerFixture()
  try {
    const a = fakeOwner(10)
    const b = fakeOwner(11)
    expect((await fixture.call("sf-native-register-connection", a.event, candidate) as { status: string }).status).toBe("approved")
    expect((await fixture.call("sf-native-register-connection", b.event, candidate) as { status: string }).status).toBe("approved")
    const select = { serverKey: candidate.serverKey, projectId: descriptor.projectId, installationId: descriptor.installationId }
    const first = await fixture.call("sf-native-bind", a.event, select) as { status: string; bindingHandle: string; generation: number }
    const second = await fixture.call("sf-native-bind", b.event, select) as { status: string; bindingHandle: string; generation: number }
    expect(first.status).toBe("ok")
    expect(second.status).toBe("ok")
    const owned = fixture.sessionNames.filter((name) => name.startsWith("sf-native-") && !name.includes("discovery"))
    expect(owned).toHaveLength(2)
    expect(new Set(owned).size).toBe(2)
    const foreign = await fixture.call("sf-native-invoke", b.event, {
      kind: "request", bindingHandle: first.bindingHandle, generation: first.generation,
      operationId: "ctx.context", requestId: crypto.randomUUID(), input: undefined,
    })
    expect(foreign).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(fixture.queries.every((query) => query.url.startsWith("https://tenant.example/api/sucafina/installations?"))).toBe(true)
  } finally { await fixture.broker.dispose() }
})

test("logout fences the old handle first and clears only that SF jar if offline", async () => {
  const fixture = brokerFixture()
  try {
    const a = fakeOwner(20)
    await fixture.call("sf-native-register-connection", a.event, candidate)
    const selected = await fixture.call("sf-native-bind", a.event, {
      serverKey: candidate.serverKey, projectId: descriptor.projectId, installationId: descriptor.installationId,
    }) as { status: string; bindingHandle: string; generation: number }
    expect(selected.status).toBe("ok")
    fixture.failLogout()
    const result = await fixture.call("sf-native-logout", a.event, {
      bindingHandle: selected.bindingHandle, generation: selected.generation,
    })
    expect(result).toEqual({ status: "cleared", remote: "unavailable" })
    const later = await fixture.call("sf-native-invoke", a.event, {
      kind: "request", bindingHandle: selected.bindingHandle, generation: selected.generation,
      operationId: "ctx.context", requestId: crypto.randomUUID(), input: undefined,
    })
    expect(later).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(fixture.cleared).toBeGreaterThan(1) // discovery plus logout jar
  } finally { await fixture.broker.dispose() }
})

test("auth allowlist permits only the SF auth mount/marker and named Microsoft origins", () => {
  expect(allowSfAuthNavigation("https://tenant.example/sucafina/auth/login", descriptor)).toBe(true)
  expect(allowSfAuthNavigation("https://login.microsoftonline.com/tenant/oauth2/authorize", descriptor)).toBe(true)
  expect(allowSfAuthNavigation("https://evil.example/auth/login", descriptor)).toBe(false)
  expect(allowSfAuthNavigation("https://tenant.example/orchestra/sf-dashboard/executive", descriptor)).toBe(false)
  expect(allowSfAuthNavigation("javascript:alert(1)", descriptor)).toBe(false)
  expect(allowSfAuthNavigation("https://tenant.example/sucafina/dashboard?sf=native-return&resume=abc", descriptor)).toBe(false)
})

test("local enrollment is exact, owner-only, and never trusts arbitrary file URL", async () => {
  const local: SfInstallationDescriptor = { ...descriptor, publicOrigin: "http://127.0.0.1:42391", authMode: "local-operator" }
  const url = local.publicOrigin + local.mount + "/auth/local?code=" + "a".repeat(64)
  expect(requireSfEnrollmentUrl(url, local)).toBe(url)
  expect(() => requireSfEnrollmentUrl(url + "&code=" + "b".repeat(64), local)).toThrow()
  expect(() => requireSfEnrollmentUrl("file:///tmp/open-local.html", local)).toThrow()
  expect(() => requireSfEnrollmentUrl("https://evil.example/steal?code=" + "a".repeat(64), local)).toThrow()
  if (process.getuid?.() === undefined) return
  const root = await mkdtemp(join(tmpdir(), "sf-native-w01-"))
  roots.push(root)
  const file = join(root, "open-local.html")
  const original = '<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Abrindo homologação local</title><p>Abrindo homologação local…</p><script>location.replace('
    + JSON.stringify(url) + ')</script>'
  await writeFile(file, original, { mode: 0o600 })
  expect(await readSfUnmanagedEnrollment(file, local)).toBe(url)
  await chmod(file, 0o644)
  await expect(readSfUnmanagedEnrollment(file, local)).rejects.toThrow()
})

test("download header projection strips cookies, redirect and unsafe filenames", () => {
  const headers = publicSfHeaders({
    "content-type": "application/octet-stream",
    "content-disposition": 'attachment; filename="safe.csv"',
    "set-cookie": "access=secret", "authorization": "Bearer secret", "location": "https://evil.example",
    "x-sf-access-revision": "9",
  })
  expect(headers).toEqual({
    "content-type": "application/octet-stream",
    "content-disposition": 'attachment; filename="safe.csv"',
    "x-sf-access-revision": "9",
  })
  expect(publicSfHeaders({ "content-disposition": 'attachment; filename="../../evil"' })["content-disposition"]).toBeUndefined()
})

const context231 = {
  stamp: {
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
    principalRef: "principal-A", policyVersion: "policy-1", accessRevision: "access-1",
  },
  contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [],
}

async function bindForContext(fixture: ReturnType<typeof brokerFixture>, owner: ReturnType<typeof fakeOwner>) {
  expect((await fixture.call("sf-native-register-connection", owner.event, candidate) as { status: string }).status).toBe("approved")
  const binding = await fixture.call("sf-native-bind", owner.event, {
    serverKey: candidate.serverKey, projectId: descriptor.projectId, installationId: descriptor.installationId,
  }) as { status: string; bindingHandle: string; generation: number }
  expect(binding.status).toBe("ok")
  return { bindingHandle: binding.bindingHandle, generation: binding.generation }
}

function readContext(fixture: ReturnType<typeof brokerFixture>, owner: ReturnType<typeof fakeOwner>,
  binding: { bindingHandle: string; generation: number }) {
  return fixture.call("sf-native-invoke", owner.event, {
    kind: "request", ...binding, requestId: crypto.randomUUID(), operationId: "ctx.context",
    input: { installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId },
  })
}

test("initial validated 401 retains the binding for the original desktop login", async () => {
  const fixture = brokerFixture([
    { status: 401, body: { status: "unauthenticated" } },
    { status: 200, body: { status: "ok", value: context231 } },
  ])
  try {
    const owner = fakeOwner(101)
    const binding = await bindForContext(fixture, owner)
    expect(await readContext(fixture, owner, binding)).toMatchObject({
      kind: "json-response", status: 401, body: { status: "unauthenticated" },
    })
    const route = {
      surfaceId: "UI29", kind: "entry", params: {}, query: {},
      pathname: "/orchestra/sf-home", href: "/orchestra/sf-home",
      ownerSelection: { serverKey: candidate.serverKey, projectId: descriptor.projectId, installationId: descriptor.installationId },
    }
    expect(await fixture.call("sf-native-login", owner.event, { ...binding, returnRoute: route }))
      .toMatchObject({ status: "authenticated", context: context231 })
    expect(fixture.queries.some((item) => item.url.endsWith("/api/ui/return-intents"))).toBe(true)
  } finally { await fixture.broker.dispose() }
})

test.each([
  { label: "malformed initial 401", replies: [{ status: 401, body: { status: "unauthenticated", extra: true } }] },
  { label: "initial 403", replies: [{ status: 403, body: { status: "denied" } }] },
  { label: "401 after authenticated context", replies: [
    { status: 200, body: { status: "ok", value: context231 } },
    { status: 401, body: { status: "unauthenticated" } },
  ] },
])("$label revokes the binding", async ({ replies }) => {
  const fixture = brokerFixture(replies)
  try {
    const owner = fakeOwner(102)
    const binding = await bindForContext(fixture, owner)
    if (replies.length === 2) expect(await readContext(fixture, owner, binding)).toMatchObject({ kind: "json-response", status: 200 })
    expect(await readContext(fixture, owner, binding)).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(await readContext(fixture, owner, binding)).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
  } finally { await fixture.broker.dispose() }
})
