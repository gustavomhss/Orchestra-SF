import { afterEach, expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { mkdtemp, chmod, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfOperationBindings } from "@orchestra/schema/sucafina/common"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfDesktopBroker, type SfDesktopBrokerDependencies } from "./index"
import { createSfConnectionRegistry, validateSfCandidate, type SfDesktopOwner } from "./connections"
import { allowSfAuthNavigation } from "./auth"
import { requireSfEnrollmentUrl, readSfUnmanagedEnrollment } from "./enrollment"
import { publicSfHeaders } from "./network"

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

function brokerFixture(files?: { state: "ready" | "unavailable"; accessRevision: string; contextStatus?: 401 | 403 }) {
  const ipc = new Map<string, (event: unknown, arg: unknown) => Promise<unknown>>()
  const sessionNames: string[] = []
  const invalidations: unknown[] = []
  const queries: Array<{ url: string; session: unknown; headers: Record<string, string> }> = []
  const app = Object.assign(new EventEmitter(), { getLocale: () => "pt-BR" })
  const dialogs: Array<{ defaultId: number; cancelId: number }> = []
  const sessions = new Map<string, { clearStorageData: () => Promise<void>; clearCache: () => Promise<void> }>()
  let cleared = 0
  let failLogout = false
  const api = {
    app,
    ipcMain: {
      handle: (name: string, listener: (event: unknown, arg: unknown) => Promise<unknown>) => ipc.set(name, listener),
      removeHandler: (name: string) => ipc.delete(name),
    },
    BrowserWindow: {
      fromWebContents: (sender: unknown) => [...owners].find((entry) => entry.sender === sender)?.win,
    },
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
          const url = new URL(options.url)
          const operation = files?.state === "ready"
            ? { operationId: "files.asset.link", state: "ready", operational: true, reason: null }
            : { operationId: "files.asset.link", state: "unavailable", operational: false, reason: "producer-unavailable" }
          const body = url.pathname === "/api/sucafina/installations" ? { installations: [descriptor] }
            : files && url.pathname === "/sucafina/api/ui/context" ? { status: "ok", value: {
                contractRevision: descriptor.contractRevision, authMode: descriptor.authMode,
                stamp: { installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
                  principalRef: "person", policyVersion: "policy", accessRevision: files.accessRevision },
                destinations: [], availability: [{ family: "files", resource: "documents", state: operation.state, operations: [operation] }],
              } }
            : files && url.searchParams.has("asset-link") ? { ok: true, query: "asset=fixture", expires: "2030-01-01T00:00:00Z" }
            : undefined
          const response = Object.assign(new EventEmitter(), {
            headers: body ? { "content-type": "application/json" } : {},
            statusCode: (url.pathname === "/sucafina/api/ui/context" ? files?.contextStatus : undefined) ?? (body ? 200 : 204),
            pause: () => undefined, resume: () => undefined,
          })
          req.emit("response", response)
          queueMicrotask(() => {
            if (body) response.emit("data", Buffer.from(JSON.stringify(body)))
            response.emit("end")
          })
        })
        return req
      },
    },
  }
  const broker = createSfDesktopBroker({
    electron: api as unknown as SfDesktopBrokerDependencies["electron"],
    operations: files ? SfNativeOperationBindings : codecs,
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

test("Files dispatch requires the same authorized context and current producer readiness", async () => {
  const files: NonNullable<Parameters<typeof brokerFixture>[0]> = { state: "ready", accessRevision: "revision-1" }
  const fixture = brokerFixture(files)
  try {
    const owner = fakeOwner(30)
    await fixture.call("sf-native-register-connection", owner.event, candidate)
    const binding = await fixture.call("sf-native-bind", owner.event, {
      serverKey: candidate.serverKey, projectId: descriptor.projectId, installationId: descriptor.installationId,
    }) as { status: string; bindingHandle: string; generation: number }
    expect(binding.status).toBe("ok")
    const invoke = (operationId: string, input: unknown) => fixture.call("sf-native-invoke", owner.event, {
      kind: "request", requestId: crypto.randomUUID(), bindingHandle: binding.bindingHandle, generation: binding.generation,
      operationId, input,
    })
    const readAsset = () => invoke("files.asset.link", { surface: "dashboard", assetId: "fixture" })
    expect(await invoke("ctx.context", { installationId: descriptor.installationId,
      projectId: descriptor.projectId, hostId: descriptor.hostId })).toMatchObject({ kind: "json-response", status: 200 })
    expect(await readAsset()).toMatchObject({ kind: "json-response", status: 200, body: { ok: true } })
    const destination = descriptor.publicOrigin + "/sucafina/dashboard?asset-link=fixture"
    expect(fixture.queries.filter((query) => query.url === destination)).toHaveLength(1)

    files.state = "unavailable"
    expect(await readAsset()).toEqual({ kind: "request-not-dispatched", reason: "contract-unavailable" })
    files.state = "ready"
    files.accessRevision = "revision-2"
    expect(await readAsset()).toEqual({ kind: "request-not-dispatched", reason: "contract-unavailable" })
    files.contextStatus = 401
    expect(await readAsset()).toEqual({ kind: "request-not-dispatched", reason: "contract-unavailable" })
    expect(await readAsset()).toEqual({ kind: "request-not-dispatched", reason: "contract-unavailable" })
    expect(fixture.queries.filter((query) => query.url === destination)).toHaveLength(1)
    expect(fixture.queries.filter((query) => new URL(query.url).pathname === "/sucafina/api/ui/context")).toHaveLength(5)
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
