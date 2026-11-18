import { createNativeServerEnvironment } from "./native-server-environment"
import { afterAll, expect, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import { chmod, rm } from "node:fs/promises"
import { userInfo } from "node:os"
import path from "node:path"
import type { CapabilityOperatorContract } from "@orchestra/core/capability/operator/contract"
import { CapabilityAuthorizationFixture } from "./capability-authorization-fixture"
import { Database } from "@orchestra/core/database/database"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { createRoutes } from "@orchestra/server/routes"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createNativeInstallation } from "../../../modules/sucafina/src/native-installation"
import { prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store"

const { root } = createNativeServerEnvironment()

const origin = "http://localhost:4110"
const foreignOrigin = "http://localhost:4111"
const mount = "/api/sucafina"
const password = "synthetic-host-password"
const basic = `Basic ${Buffer.from(`orchestra:${password}`).toString("base64")}`
const receiptSchema = Schema.Struct({ requestID: Schema.String, principal: Schema.String,
  origin: Schema.Literal("configured-auth"), scopeHash: Schema.String })
afterAll(async () => rm(root, { recursive: true, force: true }))

class DatabaseCapture extends Context.Service<DatabaseCapture, { storageID: string | undefined }>()("test/NativeHostBridgeDatabaseCapture") {}

async function fixture(operator?: CapabilityOperatorContract.Interface, authentication: "local-operator" | "microsoft" = "local-operator") {
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Real UID required")
  const { root: installationRoot, environment } = createNativeServerEnvironment(root)
  const configuration = await prepareLocalConfiguration(installationRoot)
  const config = await Bun.file(configuration).json()
  const installationId = randomUUID()
  await Bun.write(configuration, JSON.stringify(authentication === "local-operator"
    ? { ...config, authentication, localOperator: { installationId, uid, buyer: true } }
    : { ...config, authentication }))
  await chmod(configuration, 0o600)
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    yield* Layer.build(Database.layerFromPath(environment.ORCHESTRA_DB))
  })))
  let installation = await createNativeInstallation({ configuration, origin, environment })
  const makeServer = (factory: typeof installation) => {
    const captured: (string | undefined)[] = []
    const nativeInstallation = { handle: (request: Request) => factory.handle(request) }
    const captureNode = makeGlobalNode({ service: DatabaseCapture, layer: Layer.effect(DatabaseCapture, Effect.gen(function* () {
      const database = yield* Database.Service
      captured.push(database.storageID)
      return { storageID: database.storageID }
    })), deps: [Database.node] })
    const routes = createRoutes({ password, nativeInstallation, operator, host: [{
      id: "native-host-bridge-database-capture",
      replacements: [[Database.node, Database.layerFromPath(environment.ORCHESTRA_DB)]],
      nodes: [captureNode],
    }] })
    const web = HttpRouter.toWebHandler(routes.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true, memoMap: Layer.makeMemoMapUnsafe() })
    return { web, captured, send: (pathname: string, init: RequestInit = {}, base = origin) => web.handler(new Request(new URL(pathname, base), init), Context.makeUnsafe<unknown>(new Map())) }
  }
  let server = makeServer(installation)
  const send = (...args: Parameters<typeof server.send>) => server.send(...args)
  const health = (headers: HeadersInit = {}) => send("/api/health", { headers })
  const enroll = async (cookie?: string) => {
    const artifact = await installation.enroll()
    const html = await Bun.file(artifact.artifact).text()
    const encoded = html.match(/location\.replace\(("[^\n]+")\)/)?.[1]
    if (!encoded) throw new Error("Native enrollment handoff missing")
    const target = new URL(JSON.parse(encoded), origin)
    const init: RequestInit = cookie ? { headers: { cookie } } : {}
    const response = await send(`${target.pathname}${target.search}`, init)
    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    const native = cookies.find((cookie) => /(?:^|;\s*)Path=\/api\/sucafina(?:;|$)/i.test(cookie))
    const bridge = cookies.find((cookie) => /(?:^|;\s*)Path=\/api(?:;|$)/i.test(cookie))
    if (!native || !bridge) throw new Error("Native and host bridge cookies required")
    const nativeName = native.split("=", 1)[0]!
    const bridgeName = bridge.split("=", 1)[0]!
    expect(nativeName).not.toBe(bridgeName)
    return { response, target: `${target.pathname}${target.search}`, native, bridge, nativeName, bridgeName, pair: native.split(";")[0]!, bridgePair: bridge.split(";")[0]! }
  }
  const restart = async () => {
    await server.web.dispose()
    await installation.dispose()
    installation = await createNativeInstallation({ configuration, origin, environment })
    server = makeServer(installation)
  }
  const close = async () => { await server.web.dispose(); await installation.dispose() }
  return { root: installationRoot, environment, principalID: `macos:${installationId}:${uid}`, principalName: userInfo().username,
    get installation() { return installation }, get captured() { return server.captured }, send, health, enroll, restart, close }
}

function capabilityOperatorURL(f: Awaited<ReturnType<typeof fixture>>) {
  return `/api/capability/operator?location[directory]=${encodeURIComponent(f.root)}`
}

test("credential denials", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const credentialCases: HeadersInit[] = [{}, { cookie: `${session.bridgeName}=forged` },
      { cookie: `${session.bridgePair}; ${session.bridgePair}` }, { cookie: session.pair }]
    for (const headers of credentialCases) {
      expect((await f.health(headers)).status).toBe(401)
      expect((await f.send(capabilityOperatorURL(f), { headers })).status).toBe(401)
    }
    const microsoft = await fixture(undefined, "microsoft")
    try {
      expect(await (await microsoft.send(`${mount}/status`)).json()).toMatchObject({ configured: false, authenticated: false })
      expect((await microsoft.health({ cookie: session.bridgePair })).status).toBe(401)
      expect((await microsoft.health()).status).toBe(401)
    } finally { await microsoft.close() }
  } finally { await f.close() }
})

test("redemption bridge", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const second = await f.enroll()
    expect(session.response.status).toBe(303)
    expect(session.response.headers.get("location")).toBe("/orchestra/sucafina/dashboard")
    expect(session.native).toMatch(/HttpOnly/i)
    expect(session.bridge).toMatch(/HttpOnly/i)
    expect(session.bridge).toMatch(/SameSite=Lax/i)
    expect(session.bridge).not.toContain(password)
    expect((await f.health({ cookie: session.bridgePair })).status).toBe(200)
    expect(f.captured).toContain(createHash("sha256").update(path.resolve(f.environment.ORCHESTRA_DB)).digest("hex"))
    const noCookie = await (await f.send(`${mount}/status`)).json()
    const nativeOnly = await (await f.send(`${mount}/status`, { headers: { cookie: session.pair } })).json()
    const bridgeOnly = await (await f.send(`${mount}/status`, { headers: { cookie: session.bridgePair } })).json()
    const both = await (await f.send(`${mount}/status`, { headers: { cookie: `${session.pair}; ${session.bridgePair}` } })).json()
    expect(noCookie.hostAuthenticated).not.toBe(true)
    expect(nativeOnly.authenticated).toBe(true)
    expect(nativeOnly.hostAuthenticated).not.toBe(true)
    expect(bridgeOnly.authenticated).not.toBe(true)
    expect(bridgeOnly).toMatchObject({ configured: true, authentication: "local-operator", authenticated: false, hostAuthenticated: false })
    expect(both).toMatchObject({
      configured: true,
      authentication: "local-operator",
      authenticated: true,
      principal: { id: f.principalID, name: f.principalName },
      hostAuthenticated: true,
    })
    expect(both.sessionScope).toMatch(/^[0-9a-f]{64}$/)
    const secondStatus = await (await f.send(`${mount}/status`, {
      headers: { cookie: `${second.pair}; ${second.bridgePair}` },
    })).json()
    expect(secondStatus).toMatchObject({
      configured: true,
      authentication: "local-operator",
      authenticated: true,
      principal: { id: f.principalID, name: f.principalName },
      hostAuthenticated: true,
    })
    expect(secondStatus.sessionScope).toMatch(/^[0-9a-f]{64}$/)
    expect(secondStatus.sessionScope).not.toBe(both.sessionScope)
    const nativeFirstBridgeSecond = await (await f.send(`${mount}/status`, {
      headers: { cookie: `${session.pair}; ${second.bridgePair}` },
    })).json()
    expect(nativeFirstBridgeSecond).toMatchObject({ authenticated: true, hostAuthenticated: false })
    const nativeSecondBridgeFirst = await (await f.send(`${mount}/status`, {
      headers: { cookie: `${second.pair}; ${session.bridgePair}` },
    })).json()
    expect(nativeSecondBridgeFirst).toMatchObject({ authenticated: true, hostAuthenticated: false })
    const replay = await f.send(session.target)
    expect(replay.status).toBe(403)
    expect(replay.headers.getSetCookie().some((cookie) => /Path=\/api(?:;|$)/i.test(cookie))).toBe(false)
  } finally { await f.close() }
})

test("bridge equals Basic", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const configured = yield* CapabilityAuthorizationFixture.make({
      password: Option.some(password),
      scope: { placements: "instance", actions: ["*"] },
    })
    const f = yield* Effect.promise(() => fixture(configured.operator))
    yield* Effect.promise(async () => {
      try {
        const session = await f.enroll()
        const url = capabilityOperatorURL(f)
        const request = async (headers: HeadersInit) => {
          const response = await f.send(url, { headers })
          expect(response.status).toBe(200)
          return Schema.decodeUnknownSync(receiptSchema)(await response.json())
        }
        const bridge = await request({ cookie: session.bridgePair })
        const basicReceipt = await request({ authorization: basic })
        expect(bridge.principal.trim()).not.toBe("")
        expect(bridge.scopeHash).toMatch(/^[0-9a-f]{64}$/)
        expect(bridge).toMatchObject({ principal: basicReceipt.principal, origin: basicReceipt.origin, scopeHash: basicReceipt.scopeHash })
        expect((await f.send(url)).status).toBe(401)
      } finally { await f.close() }
    })
  })))
})

test("capability middleware independently validates the native bridge", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const capability = yield* CapabilityAuthorizationFixture.make({
        password: Option.some(password),
        scope: { placements: "instance", actions: ["*"] },
        nativeInstallation: f.installation,
        origin,
      })
      const positive = yield* capability.request({ headers: { cookie: session.bridgePair, origin } })
      expect(positive.status).toBe(200)
      const receipt = yield* CapabilityAuthorizationFixture.binding(positive)
      expect(receipt).toMatchObject({ principal: "host-operator", origin: "configured-auth" })
      expect(receipt.scopeHash).toMatch(/^[0-9a-f]{64}$/)
      const entered = capability.domain.entered
      const invalid = [
        { cookie: session.bridgePair.replace(/[a-f0-9]{64}$/, "0".repeat(64)), origin },
        { cookie: `${session.bridgePair}; ${session.bridgePair}`, origin },
        { cookie: session.bridgePair, origin: "http://attacker.example" },
      ]
      for (const headers of invalid) {
        const response = yield* capability.request({ headers })
        expect(response.status).toBe(401)
        expect(capability.domain.entered).toBe(entered)
      }
      const logout = yield* Effect.promise(() => f.send(`${mount}/auth/logout`, {
        method: "POST",
        headers: { origin, cookie: session.pair },
      }))
      expect(logout.status).toBe(204)
      const revoked = yield* capability.request({ headers: { cookie: session.bridgePair, origin } })
      expect(revoked.status).toBe(401)
      expect(capability.domain.entered).toBe(entered)
    })))
  } finally { await f.close() }
})

test("unsafe POST origin", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const write = (headers: Record<string, string>) => f.send(`/api/capability/targets/remove?location[directory]=${encodeURIComponent(f.root)}`, {
      method: "POST",
      headers: { cookie: session.bridgePair, origin, "sec-fetch-site": "same-origin", "content-type": "application/json", "idempotency-key": "bridge-origin-denial", ...headers },
      body: JSON.stringify({}),
    })
    const origins: Record<string, string>[] = [{ origin: "http://attacker.example" }, { "sec-fetch-site": "cross-site" }, { origin: "" }]
    for (const headers of origins) {
      expect((await write(headers)).status).toBe(401)
      expect((await f.send(capabilityOperatorURL(f), { headers: { cookie: session.bridgePair, ...headers } })).status).toBe(401)
    }
    expect((await write({})).status).toBe(400)
    expect((await f.send(`/api/capability/targets/remove?location[directory]=${encodeURIComponent(f.root)}`, {
      method: "POST", headers: { authorization: basic, origin, "content-type": "application/json", "idempotency-key": "bridge-basic-control" }, body: JSON.stringify({}),
    })).status).toBe(400)
  } finally { await f.close() }
})

test("cross-origin GET", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    expect((await f.health({ cookie: session.bridgePair, origin: "http://attacker.example" })).status).toBe(401)
    expect((await f.send(capabilityOperatorURL(f), { headers: { cookie: session.bridgePair, origin: "http://attacker.example" } })).status).toBe(401)
  } finally { await f.close() }
})

test("configured installation rejects a different-port audience", async () => {
  const f = await fixture()
  const foreign = await fixture()
  try {
    const session = await foreign.enroll()
    expect((await foreign.health({ cookie: session.bridgePair })).status).toBe(200)
    expect((await foreign.send("/api/health", { headers: { cookie: session.bridgePair } }, foreignOrigin)).status).toBe(401)
    expect((await foreign.send(capabilityOperatorURL(foreign), { headers: { cookie: session.bridgePair } }, foreignOrigin)).status).toBe(401)
    expect((await f.health({ cookie: session.bridgePair })).status).toBe(401)
    expect((await f.send(capabilityOperatorURL(f), { headers: { cookie: session.bridgePair } })).status).toBe(401)
  } finally { await Promise.all([f.close(), foreign.close()]) }
})

test("business auth separation", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const url = `${mount}/dashboard/state?page=IT%20Risks`
    const status = await f.send(url, { headers: { cookie: session.bridgePair } })
    expect(status.status).toBe(401)
    const view = await f.send(url, { headers: { cookie: session.pair } })
    expect(view.status).toBe(200)
    const basicOnly = await f.send(url, { headers: { authorization: basic } })
    expect(basicOnly.status).toBe(401)
  } finally { await f.close() }
})

test("logout revokes cookies", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const logout = await f.send(`${mount}/auth/logout`, { method: "POST", headers: { origin, cookie: `${session.pair}; ${session.bridgePair}` } })
    expect(logout.status).toBe(204)
    const cleared = logout.headers.getSetCookie()
    expect(cleared).toHaveLength(2)
    expect(cleared.map((cookie) => cookie.split("=", 1)[0]).sort()).toEqual([session.nativeName, session.bridgeName].sort())
    expect(cleared.some((cookie) => /(?:^|;\s*)Path=\/api\/sucafina(?:;|$)/i.test(cookie))).toBe(true)
    expect(cleared.some((cookie) => /Path=\/api(?:;|$)/i.test(cookie))).toBe(true)
    expect((await f.send("/api/health", { headers: { cookie: session.bridgePair } })).status).toBe(401)
    expect((await f.send(capabilityOperatorURL(f), { headers: { cookie: session.bridgePair } })).status).toBe(401)
    const status = await f.send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie: session.pair } })
    expect(status.status).toBe(401)
  } finally { await f.close() }
})

test("factory unavailable", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const businessURL = `${mount}/dashboard/state?page=IT%20Risks`
    expect((await f.health({ cookie: session.bridgePair })).status).toBe(200)
    expect((await f.send(businessURL, { headers: { cookie: session.pair } })).status).toBe(200)
    await f.installation.dispose()
    expect((await f.health({ cookie: session.bridgePair })).status).toBe(401)
    const challenge = await f.health()
    expect(challenge.status).toBe(401)
    expect(challenge.headers.get("www-authenticate")).toBe('Basic realm="Secure Area"')
    const unavailable = await f.send(businessURL, { headers: { cookie: session.pair } })
    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get("cache-control")).toBe("no-store")
  } finally { await f.close() }
})

test("store TTL expiry denies business, Host and capability access", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const businessURL = `${mount}/dashboard/state?page=IT%20Risks`
    expect((await f.send(businessURL, { headers: { cookie: session.pair } })).status).toBe(200)
    expect((await f.health({ cookie: session.bridgePair })).status).toBe(200)
    expect((await f.send(capabilityOperatorURL(f), { headers: { cookie: session.bridgePair } })).status).toBe(200)
    const sessionID = session.pair.split("=", 2)[1]!
    const secretKey = `operator-session:${createHash("sha256").update(sessionID).digest("hex")}`
    const store = await openLocalStore(path.join(f.root, "business-local"))
    try {
      const secret = await store.secrets.get(secretKey, Date.now())
      expect(secret).toBeInstanceOf(Uint8Array)
      if (!secret) throw new Error("Validated native session secret missing")
      await store.secrets.put(secretKey, secret, Date.now() - 1)
      expect(await store.secrets.get(secretKey, Date.now())).toBeUndefined()
    } finally { await store.dispose() }
    expect((await f.send(businessURL, { headers: { cookie: session.pair } })).status).toBe(401)
    expect((await f.health({ cookie: session.bridgePair })).status).toBe(401)
    expect((await f.send(capabilityOperatorURL(f), { headers: { cookie: session.bridgePair } })).status).toBe(401)
  } finally { await f.close() }
})

test("bridge survives restart", async () => {
  const f = await fixture()
  try {
    const first = await f.enroll()
    expect((await f.health({ cookie: first.bridgePair })).status).toBe(200)
    await f.restart()
    expect((await f.health({ cookie: first.bridgePair })).status).toBe(200)
  } finally { await f.close() }
})

test("reenrollment revokes cookies", async () => {
  const f = await fixture()
  try {
    const first = await f.enroll()
    const second = await f.enroll(first.pair)
    expect(second.response.status).toBe(303)
    expect((await f.health({ cookie: first.bridgePair })).status).toBe(401)
    expect((await f.health({ cookie: second.bridgePair })).status).toBe(200)
    expect((await f.send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie: first.pair } })).status).toBe(401)
    expect((await f.send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie: second.pair } })).status).toBe(200)
  } finally { await f.close() }
})
