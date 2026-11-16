/* 238: deterministic negative contract tests. NOT_RUN until inert postimages composed. */
import { test, expect } from "bun:test"
import { validateSfOwnedLocationProbe } from "../../../../../../apps/desktop/src/main/sucafina/connections"
import { createSfDesktopOriginBridge238 } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/desktop-origin-bridge238"
import { ServerConnection } from "../../../../../../packages/app-shell/src/context/server"
import type { SfDesktopCapability, SfDesktopInvalidation } from "@orchestra/client/sucafina/transport"
import type { SfInstallationDescriptor, SfOwnerSelection } from "@orchestra/schema/sucafina/context"

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
    server, desktop: native, directory: "/real/project", fetch: async () => {
      throw new Error("renderer must not fetch Sucafina")
    }, onInvalidated: (reason) => { revoked.push(reason) },
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
  expect(await f.bridge.listByIds({ ...selected, serverKey: "https://other.example" },
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
