// Draft for promotion to packages/server/test/native-server-adapter.test.ts.
// Missing integration contracts: createRoutes must accept the structural `nativeInstallation`
// option ({ handle(Request): Promise<Response | undefined> }); Protocol must expose the
// one-use /auth/local and /auth/logout routes and preserve their response headers/status.
// The server owns bridge issuance/verification, including capability middleware. This draft
// covers the adapter boundary; separate bridge, Chrome and pinned-client suites are required.
import { createNativeServerEnvironment } from "./native-server-environment"
import { afterAll, expect, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import { chmod, rm } from "node:fs/promises"
import path from "node:path"
import { Database } from "@orchestra/core/database/database"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { createRoutes } from "@orchestra/server/routes"
import { Context, Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createNativeInstallation } from "../../../modules/sucafina/src/native-installation"
import { prepareLocalConfiguration } from "../../../modules/sucafina/Sucafinav1/runtime/local-configuration"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store"

const { root, environment } = createNativeServerEnvironment()

const origin = "http://localhost:4110"
const mount = "/api/sucafina"
const password = "synthetic-host-password"
const basic = `Basic ${Buffer.from(`orchestra:${password}`).toString("base64")}`
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

class DatabaseCapture extends Context.Service<DatabaseCapture, { storageID: string | undefined }>()("test/NativeServerDatabaseCapture") {}

async function fixture() {
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Real UID required")
  const configuration = await prepareLocalConfiguration(root)
  const config = await Bun.file(configuration).json()
  await Bun.write(configuration, JSON.stringify({ ...config, authentication: "local-operator", localOperator: { installationId: randomUUID(), uid, buyer: true } }))
  await chmod(configuration, 0o600)
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    yield* Layer.build(Database.layerFromPath(environment.ORCHESTRA_DB))
  })))
  const store = await openLocalStore(path.join(root, "business-local"))
  await store.transaction("dashboard", async (snapshot) => {
    snapshot.data.risks = [{ id: "adapter-risk", name: "Before", impact: 2, probability: 2, status: "open", createdAt: "2026-01-01T00:00:00.000Z" }]
    snapshot.versions["risks:adapter-risk"] = { version: 4, by: "original-writer" }
    return { commit: true, value: undefined }
  })
  await store.dispose()
  const installation = await createNativeInstallation({ configuration, origin, environment })
  const observed: { url: string; method: string; origin: string | null; cookie: string | null; body: unknown }[] = []
  const nativeInstallation = {
    async handle(request: Request) {
      observed.push({ url: request.url, method: request.method, origin: request.headers.get("origin"), cookie: request.headers.get("cookie"), body: request.method === "POST" && request.headers.get("content-type")?.includes("application/json") ? await request.clone().json() : undefined })
      return installation.handle(request)
    },
  }
  // The option is structural here; current createRoutes ignores it until the Server contract is added.
  const captured: (string | undefined)[] = []
  const captureNode = makeGlobalNode({
    service: DatabaseCapture,
    layer: Layer.effect(DatabaseCapture, Effect.gen(function* () {
      const database = yield* Database.Service
      captured.push(database.storageID)
      return { storageID: database.storageID }
    })),
    deps: [Database.node],
  })
  const options = { password, nativeInstallation, host: [{
    id: "native-server-database-capture",
    replacements: [[Database.node, Database.layerFromPath(environment.ORCHESTRA_DB)] as const],
    nodes: [captureNode],
  }] }
  const routes = createRoutes(options)
  const web = HttpRouter.toWebHandler(routes.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true, memoMap: Layer.makeMemoMapUnsafe() })
  const send = (pathname: string, init: RequestInit = {}, base = origin) => web.handler(new Request(new URL(pathname, base), init), Context.makeUnsafe<unknown>(new Map()))
  const enroll = async () => {
    const artifact = await installation.enroll()
    const html = await Bun.file(artifact.artifact).text()
    const encoded = html.match(/location\.replace\(("[^\n]+")\)/)?.[1]
    if (!encoded) throw new Error("Native enrollment handoff missing")
    const target = new URL(JSON.parse(encoded), origin)
    const response = await send(`${target.pathname}${target.search}`)
    const cookies = response.headers.getSetCookie()
    const native = cookies.find((cookie) => /Path=\/api\/sucafina(?:;|$)/i.test(cookie))
    const bridge = cookies.find((cookie) => /Path=\/api(?:;|$)/i.test(cookie))
    if (!native || !bridge) throw new Error("Native and host bridge cookies required")
    return { response, native, bridge, pair: native.split(";")[0]!, bridgePair: bridge.split(";")[0]! }
  }
  const close = async () => { await web.dispose(); await installation.dispose() }
  return { installation, observed, captured, send, enroll, close }
}

test("exact native family is delegated while Host Basic remains separate", async () => {
  const f = await fixture()
  try {
    expect((await f.send("/api/health")).status).toBe(401)
    expect((await f.send("/api/health", { headers: { authorization: basic } })).status).toBe(200)
    expect(f.captured).toContain(createHash("sha256").update(path.resolve(environment.ORCHESTRA_DB)).digest("hex"))
    const status = await f.send(`${mount}/status`)
    expect(status.status).toBe(200)
    expect(await status.json()).toMatchObject({ configured: true, authentication: "local-operator", authenticated: false })
    expect((await f.send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { authorization: basic } })).status).toBe(401)
    const before = f.observed.length
    await f.send("/api/sucafina-extra/status", { headers: { authorization: basic } })
    const unknown = await f.send("/api/sucafina/status-extra", { headers: { authorization: basic } })
    expect(unknown.status).toBe(404)
    expect(f.observed.slice(before).some((entry) => new URL(entry.url).pathname.startsWith("/api/sucafina-extra"))).toBe(false)
    expect(f.observed.slice(before).some((entry) => new URL(entry.url).pathname === "/api/sucafina/status-extra")).toBe(true)
  } finally { await f.close() }
})

test("one-use redemption preserves 303, location, native cookie and distinct bridge", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    expect(session.response.status).toBe(303)
    expect(session.response.headers.get("location")).toBe("/orchestra/sucafina/dashboard")
    expect(session.native).toMatch(/HttpOnly/i)
    expect(session.native).toMatch(/SameSite=Lax/i)
    expect(session.bridge).toMatch(/HttpOnly/i)
    expect(session.bridge).toMatch(/SameSite=Lax/i)
    expect(session.bridge).not.toContain(password)
    expect((await f.send("/api/health", { headers: { cookie: session.bridgePair } })).status).toBe(200)
    const nativeOnly = await f.send(`${mount}/status`, { headers: { cookie: session.pair } })
    const nativeStatus = await nativeOnly.json()
    expect(nativeStatus.authenticated).toBe(true)
    expect(nativeStatus.hostAuthenticated).not.toBe(true)
    const both = await f.send(`${mount}/status`, { headers: { cookie: `${session.pair}; ${session.bridgePair}` } })
    expect(await both.json()).toMatchObject({ authenticated: true, hostAuthenticated: true })
  } finally { await f.close() }
})

test("command reconstructs request origin, cookie and typed JSON and preserves conflict", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    const body = { page: "IT Risks", action: "save", id: "adapter-risk", version: 4, values: { name: "After", impact: 3, probability: 2 } }
    const command = () => f.send(`${mount}/dashboard/commands`, { method: "POST", headers: { origin, cookie: session.pair, "content-type": "application/json" }, body: JSON.stringify(body) })
    expect((await command()).status).toBe(200)
    const received = f.observed.findLast((entry) => entry.method === "POST" && new URL(entry.url).pathname === `${mount}/dashboard/commands`)
    expect(received).toMatchObject({ url: `${origin}${mount}/dashboard/commands`, origin, cookie: session.pair, body })
    const stale = await command()
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ by: expect.any(String) })
    const state = await f.send(`${mount}/dashboard/state?page=IT%20Risks&year=2026&month=1`, { headers: { cookie: session.pair } })
    expect(state.status).toBe(200)
    expect(f.observed.findLast((entry) => entry.method === "GET" && new URL(entry.url).pathname === `${mount}/dashboard/state`)).toMatchObject({
      url: `${origin}${mount}/dashboard/state?page=IT%20Risks&year=2026&month=1`,
      method: "GET", cookie: session.pair, origin: null,
    })
    expect(JSON.stringify(await state.json())).toContain("After")
  } finally { await f.close() }
})

test("foreign Origin and cross-site POST are rejected without mutating the record", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    expect((await f.send(`${mount}/status`, {}, "http://127.0.0.1:4110")).status).toBe(403)
    const body = { page: "IT Risks", action: "save", id: "adapter-risk", version: 4, values: { name: "Forbidden" } }
    const origins: Record<string, string>[] = [{ origin: "http://attacker.example" }, { origin, "sec-fetch-site": "cross-site" }, {}]
    for (const headers of origins) {
      const response = await f.send(`${mount}/dashboard/commands`, { method: "POST", headers: { ...headers, cookie: session.pair, "content-type": "application/json" }, body: JSON.stringify(body) })
      expect(response.status).toBe(403)
    }
    const state = await f.send(`${mount}/dashboard/state?page=IT%20Risks`, { headers: { cookie: session.pair } })
    const value = await state.text()
    expect(state.status).toBe(200)
    expect(value).toContain("Before")
    expect(value).not.toContain("Forbidden")
  } finally { await f.close() }
})

test("disposed factory resolves unavailable through Server", async () => {
  const f = await fixture()
  try {
    const session = await f.enroll()
    await f.installation.dispose()
    for (const pathname of [`${mount}/status`, `${mount}/dashboard/state?page=IT%20Risks`]) {
      const response = await f.send(pathname, { headers: { cookie: session.pair } })
      expect(response.status).toBe(503)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  } finally { await f.close() }
})
