/* 238: deterministic negative contract tests. NOT_RUN until inert postimages composed. */
import { test, expect } from "bun:test"
import { createSfTransport } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { validateSfOwnedLocationProbe } from "../../../../../../apps/desktop/src/main/sucafina/connections"
import { createSfDesktopOriginBridge238 } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/desktop-origin-bridge238"
import type { ServerConnection } from "../../../../../../packages/app-shell/src/context/server-connection"
import type { SfDesktopCapability, SfDesktopInvalidation } from "@orchestra/client/sucafina/transport"
import type { SfInstallationDescriptor, SfOwnerSelection } from "@orchestra/schema/sucafina/context"

const blockedFetch = (message: string, onCall?: () => void): typeof fetch => Object.assign(async () => {
  onCall?.()
  throw new Error(message)
}, { preconnect() { onCall?.(); throw new Error(message) } })
const origin = "https://tenant.example"
const descriptor: SfInstallationDescriptor = {
  installationId: "original-install", projectId: "original-project",
  hostId: "original-host", publicOrigin: origin, mount: "/sucafina",
  contractRevision: "sf-native-ui/1", authMode: "microsoft",
}
const server: ServerConnection.Any = { type: "http", http: { url: origin } }
const selected = { serverKey: origin, projectId: "original-project",
  installationId: "original-install" } as SfOwnerSelection

test("main-owned location source rejects foreign origins, credentials, extra keys, or changed directory", () => {
  const owned = { serverKey: origin, baseUrl: origin, credentials: { kind: "none" as const } }
  const probe = { ...owned, location: { directory: "/real/project" } }
  expect(validateSfOwnedLocationProbe(probe, owned)).toBeDefined()
  expect(validateSfOwnedLocationProbe(probe, undefined)).toBeUndefined()
  expect(validateSfOwnedLocationProbe({ ...probe, baseUrl: "https://evil.example" }, owned)).toBeUndefined()
  expect(validateSfOwnedLocationProbe({ ...probe, credentials: { kind: "basic", username: "x", password: "x" } }, owned)).toBeUndefined()
  expect(validateSfOwnedLocationProbe({ ...probe, injected: "grant" }, owned)).toBeUndefined()
  expect(validateSfOwnedLocationProbe({ ...probe, location: { directory: "/real/project", owner: "forged" } }, owned)).toBeUndefined()
  expect(validateSfOwnedLocationProbe({ ...probe, baseUrl: "http://public.example" }, owned)).toBeUndefined()
})

function fake(options: { deny?: boolean; mismatch?: boolean } = {}) {
  let invalidation: ((event: SfDesktopInvalidation) => void) | undefined
  let invokes = 0
  const releases: unknown[] = []
  const native: SfDesktopCapability = {
    registerConnection: async (candidate) => options.deny
      ? { status: "cancelled" }
      : { status: "approved", serverKey: candidate.serverKey, projectId: candidate.projectId,
          transportIdentity: "real-broker-discriminator", generation: 7 },
    discoverLocation: async () => ({ status: "unavailable", reason: "connection-unapproved" }),
    bind: async (_, callback) => {
      invalidation = callback
      return { status: "ok", bindingHandle: "registered-only-in-main", generation: 7,
        descriptor: options.mismatch ? { ...descriptor, publicOrigin: "https://evil.example" } : descriptor }
    },
    invoke: async () => { invokes++; return { kind: "transport-error", reason: "contract-unavailable" } },
    abort: async () => undefined,
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async (request) => { releases.push(request) },
  }
  const revoked: string[] = []
  const bridge = createSfDesktopOriginBridge238({
    server, desktop: native, directory: "/real/project", fetch: blockedFetch("renderer must not fetch Sucafina"), onInvalidated: (reason) => { revoked.push(reason) },
  })
  return { bridge, revoked, releases, get invalidation() { return invalidation }, get invokes() { return invokes } }
}

test("cancelled approval and foreign descriptor cannot become installed context", async () => {
  for (const settings of [{ deny: true }, { mismatch: true }]) {
    const fixture = fake(settings)
    const read = await fixture.bridge.listByIds(selected, new AbortController().signal)
    expect(read).toBeUndefined()
    expect(fixture.bridge.transportIdentity(selected)).toBe("")
    fixture.bridge.dispose()
  }
})
test("cross-owner selection does not register or invoke", async () => {
  const f = fake()
  expect(await f.bridge.listByIds({ ...selected, serverKey: "https://other.example" as SfOwnerSelection["serverKey"] },
    new AbortController().signal)).toBeUndefined()
  expect(f.invokes).toBe(0)
  f.bridge.dispose()
})
test("invalidated owner retires the bound handle and forbids stale transport reuse", async () => {
  const f = fake()
  const list = await f.bridge.listByIds(selected, new AbortController().signal)
  expect(list?.installations).toHaveLength(1)
  const transport = f.bridge.createTransport(descriptor, 1, () => 1)
  expect(transport).toBeDefined()
  f.invalidation?.({ bindingHandle: "registered-only-in-main", generation: 7, reason: "access-revoked" })
  expect(f.revoked).toEqual(["access-revoked"])
  expect(f.bridge.transportIdentity(selected)).toBe("")
  const absent = await f.bridge.login({
    surfaceId: "UI29", kind: "entry", params: {}, ownerSelection: selected,
    pathname: "/orchestra/sf-home", href: "/orchestra/sf-home" as never, query: {},
  })
  expect(absent.status).toBe("denied")
  expect(f.invokes).toBe(0)
  f.bridge.dispose()
})
test("unapproved main-owned lookup has no browser fallback", async () => {
  const f = fake()
  expect(await f.bridge.listByLocation("/real/project", new AbortController().signal)).toBeUndefined()
  expect(await f.bridge.listByLocation("/other/project", new AbortController().signal)).toBeUndefined()
  expect(f.invokes).toBe(0)
  f.bridge.dispose()
})

test("browser denies a foreign publicOrigin before any fetch; no cross-origin CORS workaround", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { location: { origin: "https://different-shell.example" } },
  })
  try {
    let fetches = 0
    const transport = createSfTransport({
      binding: descriptor, generation: 1, currentGeneration: () => 1,
      operations: SfNativeOperationBindings,
      fetch: blockedFetch("forbidden renderer fetch", () => { fetches++ }),
    })
    const result = await createSfContextClient(transport)["ctx.context"]({
      installationId: descriptor.installationId, projectId: descriptor.projectId,
      hostId: descriptor.hostId,
    }, { signal: new AbortController().signal })
    expect(result.kind).toBe("transport-error")
    expect(fetches).toBe(0)
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

test("stale provider generation refuses native invoke even with an approved binding", async () => {
  const f = fake()
  expect(await f.bridge.listByIds(selected, new AbortController().signal)).toBeDefined()
  const stale = f.bridge.createTransport(descriptor, 9, () => 10)
  const result = await createSfContextClient(stale)["ctx.context"]({
    installationId: descriptor.installationId, projectId: descriptor.projectId,
    hostId: descriptor.hostId,
  }, { signal: new AbortController().signal })
  expect(result.kind).toBe("transport-error")
  expect(f.invokes).toBe(0)
  f.bridge.dispose()
})


test("session expiry requires a fresh binding; stale transports and invalidations cannot revive the old owner", async () => {
  const callbacks: Array<(event: SfDesktopInvalidation) => void> = []
  const calls: string[] = []
  const revocations: string[] = []
  const native: SfDesktopCapability = {
    registerConnection: async (candidate) => ({
      status: "approved", serverKey: candidate.serverKey, projectId: candidate.projectId,
      transportIdentity: "broker-owner", generation: 7,
    }),
    bind: async (_, callback) => {
      callbacks.push(callback)
      return { status: "ok", bindingHandle: "handle-" + callbacks.length, generation: 7, descriptor }
    },
    invoke: async (request) => {
      calls.push(request.bindingHandle)
      return { kind: "transport-error", reason: "contract-unavailable" }
    },
    abort: async () => undefined,
    login: async (request) => {
      calls.push("login:" + request.bindingHandle)
      return { status: "denied" }
    },
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async () => undefined,
  }
  const bridge = createSfDesktopOriginBridge238({
    desktop: native, server, directory: "/real/project",
    fetch: blockedFetch("unexpected renderer fetch"),
    onInvalidated: (reason) => { revocations.push(reason) },
  })
  const contextInput = {
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
  }
  const route = {
    surfaceId: "UI29" as const, kind: "entry" as const, params: {}, ownerSelection: selected,
    pathname: "/orchestra/sf-home", href: "/orchestra/sf-home" as never, query: {},
  }
  try {
    expect(await bridge.listByIds(selected, new AbortController().signal)).toBeDefined()
    const old = bridge.createTransport(descriptor, 1, () => 1)
    await createSfContextClient(old)["ctx.context"](contextInput, { signal: new AbortController().signal })
    expect(calls).toEqual(["handle-1"])
    callbacks[0]!({ bindingHandle: "handle-1", generation: 7, reason: "session-expired" })
    expect(revocations).toEqual(["session-expired"])
    expect(bridge.transportIdentity(selected)).toBe("")
    expect((await bridge.login(route)).status).toBe("denied")
    await createSfContextClient(old)["ctx.context"](contextInput, { signal: new AbortController().signal })
    expect(calls).toEqual(["handle-1"])

    // This is the discovery performed by owner.reload() after the explicit reconnect.
    expect(await bridge.listByIds(selected, new AbortController().signal)).toBeDefined()
    expect(callbacks).toHaveLength(2)
    const fresh = bridge.createTransport(descriptor, 2, () => 2)
    await createSfContextClient(fresh)["ctx.context"](contextInput, { signal: new AbortController().signal })
    expect(calls).toEqual(["handle-1", "handle-2"])
    callbacks[0]!({ bindingHandle: "handle-1", generation: 7, reason: "session-expired" })
    expect(revocations).toEqual(["session-expired"])
    expect(bridge.transportIdentity(selected)).toBe("broker-owner")
    await createSfContextClient(old)["ctx.context"](contextInput, { signal: new AbortController().signal })
    await bridge.login(route)
    expect(calls).toEqual(["handle-1", "handle-2", "login:handle-2"])
  } finally { bridge.dispose() }
})

test("reconnect bind completing after abort is released and cannot publish an owner", async () => {
  let finishBind: ((value: { status: "ok"; bindingHandle: string; generation: number; descriptor: SfInstallationDescriptor }) => void) | undefined
  let bindStarted: (() => void) | undefined
  const started = new Promise<void>((resolve) => { bindStarted = resolve })
  const released: string[] = []
  const native: SfDesktopCapability = {
    registerConnection: async (candidate) => ({
      status: "approved", serverKey: candidate.serverKey, projectId: candidate.projectId,
      transportIdentity: "broker-owner", generation: 7,
    }),
    bind: async () => new Promise((resolve) => { finishBind = resolve; bindStarted?.() }),
    invoke: async () => { throw new Error("aborted binding must not invoke") },
    abort: async () => undefined,
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async (request) => { if (request.kind === "binding") released.push(request.bindingHandle) },
  }
  const bridge = createSfDesktopOriginBridge238({
    desktop: native, server, directory: "/real/project",
    fetch: blockedFetch("unexpected renderer fetch"),
    onInvalidated: () => { throw new Error("no active owner was bound") },
  })
  try {
    const abort = new AbortController()
    const pending = bridge.listByIds(selected, abort.signal)
    await started
    abort.abort()
    finishBind!({ status: "ok", bindingHandle: "late-handle", generation: 7, descriptor })
    expect(await pending).toBeUndefined()
    expect(released).toEqual(["late-handle"])
    expect(bridge.transportIdentity(selected)).toBe("")
  } finally { bridge.dispose() }
})

function stagedFixture() {
  const callbacks = new Map<string, (event: SfDesktopInvalidation) => void>()
  const released: string[] = []
  const releaseRequests: Parameters<SfDesktopCapability["release"]>[0][] = []
  const revoked: string[] = []
  let delay: Promise<void> = Promise.resolve()
  let next = 0
  const desktop: SfDesktopCapability = {
    registerConnection: async (candidate) => {
      await delay
      return { status: "approved", serverKey: candidate.serverKey, projectId: candidate.projectId,
        transportIdentity: candidate.projectId, generation: 7 }
    },
    bind: async (selection, callback) => {
      const handle = `handle-${++next}`
      callbacks.set(handle, callback)
      return { status: "ok", bindingHandle: handle, generation: 7,
        descriptor: { ...descriptor, projectId: selection.projectId, installationId: selection.installationId } }
    },
    invoke: async () => ({ kind: "transport-error", reason: "contract-unavailable" }),
    abort: async () => undefined,
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async (request) => { releaseRequests.push(request); if (request.kind === "binding") released.push(request.bindingHandle) },
  }
  const bridge = createSfDesktopOriginBridge238({ desktop, server, directory: "/real/project",
    fetch: blockedFetch("unexpected renderer fetch"), onInvalidated: (reason) => revoked.push(reason) })
  return { bridge, callbacks, released, releaseRequests, revoked, delay: (value: Promise<void>) => { delay = value } }
}
const other = { ...selected, projectId: "other-project", installationId: "other-install" } as SfOwnerSelection

test("preflight retains the active binding until promotion and discard only releases the candidate", async () => {
  const f = stagedFixture()
  expect(await f.bridge.listByIds(selected, new AbortController().signal)).toBeDefined()
  const stage = f.bridge.stage(other, new AbortController().signal)
  expect(await stage.listByIds()).toBeDefined()
  expect(f.bridge.transportIdentity(selected)).toBe(selected.projectId)
  expect(f.bridge.transportIdentity(other)).toBe("")
  stage.discard()
  expect(f.released).toEqual(["handle-2"])
  expect(f.releaseRequests).toHaveLength(1)
  expect(f.releaseRequests.every((request) => request.kind === "binding")).toBe(true)
  expect(f.bridge.transportIdentity(selected)).toBe(selected.projectId)
  f.bridge.dispose()
})

test("promotion transfers invalidation ownership and releases the old binding", async () => {
  const f = stagedFixture()
  await f.bridge.listByIds(selected, new AbortController().signal)
  const stage = f.bridge.stage(other, new AbortController().signal)
  await stage.listByIds()
  expect(stage.promote()).toBe(true)
  expect(f.released).toEqual(["handle-1"])
  expect(f.bridge.transportIdentity(other)).toBe(other.projectId)
  f.callbacks.get("handle-1")?.({ bindingHandle: "handle-1", generation: 7, reason: "access-revoked" })
  expect(f.revoked).toEqual([])
  f.callbacks.get("handle-2")?.({ bindingHandle: "handle-2", generation: 7, reason: "access-revoked" })
  expect(f.revoked).toEqual(["access-revoked"])
  expect(f.bridge.transportIdentity(other)).toBe("")
  f.bridge.dispose()
})

test("aborted and superseded candidates cannot publish a late binding", async () => {
  const f = stagedFixture()
  await f.bridge.listByIds(selected, new AbortController().signal)
  let unblock = () => {}
  f.delay(new Promise<void>((resolve) => { unblock = resolve }))
  const abort = new AbortController()
  const late = f.bridge.stage(other, abort.signal)
  const pending = late.listByIds()
  abort.abort()
  unblock()
  expect(await pending).toBeUndefined()
  expect(late.promote()).toBe(false)
  expect(f.bridge.transportIdentity(selected)).toBe(selected.projectId)
  f.delay(Promise.resolve())
  const first = f.bridge.stage(other, new AbortController().signal)
  const second = f.bridge.stage(other, new AbortController().signal)
  await first.listByIds()
  await second.listByIds()
  expect(second.promote()).toBe(true)
  expect(first.promote()).toBe(false)
  first.discard()
  expect(f.bridge.transportIdentity(other)).toBe(other.projectId)
  f.bridge.dispose()
})

test("revocation during preflight fences candidate promotion", async () => {
  const f = stagedFixture()
  await f.bridge.listByIds(selected, new AbortController().signal)
  const stage = f.bridge.stage(other, new AbortController().signal)
  await stage.listByIds()
  f.callbacks.get("handle-1")?.({ bindingHandle: "handle-1", generation: 7, reason: "access-revoked" })
  expect(stage.promote()).toBe(false)
  stage.discard()
  expect(f.bridge.transportIdentity(other)).toBe("")
  expect(f.released).toContain("handle-2")
  f.bridge.dispose()
})

test("navigation retains the old binding when discard is declined and promotes after confirmation", async () => {
  const { createSfNavigationState } = await import("../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/navigation-state")
  const f = stagedFixture()
  await f.bridge.listByIds(selected, new AbortController().signal)
  const staged = new WeakMap<AbortSignal, ReturnType<typeof f.bridge.stage>>()
  let discard = false
  let invalidations = 0
  let commits = 0
  const route = { surfaceId: "UI29", kind: "entry", params: {}, ownerSelection: other,
    pathname: "/orchestra/sf-home", href: "/orchestra/sf-home" as never, query: {} } as const
  const nav = createSfNavigationState({
    selected: () => selected, currentHref: () => "http://shell.example/orchestra/sf-home",
    currentOwnerKey: () => "old" as never, hasDirtyDrafts: () => true,
    confirmDiscard: async () => {
      expect(f.bridge.transportIdentity(selected)).toBe(selected.projectId)
      return discard
    },
    invalidateOwner: () => { invalidations++ },
    commit: () => { commits++ }, validateRetained: (_, values) => values,
    resolveAuthorizedRoute: async (_, selection, signal) => {
      const stage = f.bridge.stage(selection, signal)
      staged.set(signal, stage)
      if (!await stage.listByIds()) return { status: "denied" }
      return { status: "authorized", route, ownerKey: "new" as never }
    },
    finishPreflight: (signal, commit) => {
      const stage = staged.get(signal)
      if (!stage) return false
      staged.delete(signal)
      if (commit) return stage.promote()
      stage.discard()
      return true
    },
  })
  const href = `/orchestra/sf-home?server=${encodeURIComponent(other.serverKey)}&project=${other.projectId}&installation=${other.installationId}`
  expect((await nav.requestNativeTransition(href, "link")).status).toBe("kept-editing")
  expect(f.bridge.transportIdentity(selected)).toBe(selected.projectId)
  expect(commits).toBe(0)
  expect(invalidations).toBe(0)
  discard = true
  expect((await nav.requestNativeTransition(href, "link")).status).toBe("committed")
  expect(f.bridge.transportIdentity(other)).toBe(other.projectId)
  expect(commits).toBe(1)
  expect(invalidations).toBe(1)
  nav.dispose()
  f.bridge.dispose()
})
