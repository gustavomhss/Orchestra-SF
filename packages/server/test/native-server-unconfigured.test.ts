import { afterAll, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { Database } from "@orchestra/core/database/database"
import { createRoutes } from "@orchestra/server/routes"
import { Context, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createNativeServerEnvironment } from "./native-server-environment"

const { root, environment } = createNativeServerEnvironment()
const origin = "http://localhost:4110"
const password = "synthetic-unconfigured-host-password"
const basic = `Basic ${Buffer.from(`orchestra:${password}`).toString("base64")}`
const mount = "/api/sucafina"
const web = HttpRouter.toWebHandler(createRoutes({ password, host: [{
  id: "native-unconfigured-private-database",
  replacements: [[Database.node, Database.layerFromPath(environment.ORCHESTRA_DB)] as const],
}] }).pipe(Layer.provide(HttpServer.layerServices)), {
  disableLogger: true,
  memoMap: Layer.makeMemoMapUnsafe(),
})
afterAll(async () => {
  await web.dispose()
  await rm(root, { recursive: true, force: true })
})

function send(pathname: string, init: RequestInit = {}) {
  return web.handler(new Request(new URL(pathname, origin), init), Context.makeUnsafe<unknown>(new Map()))
}

test("unconfigured native status is anonymously readable as setup guidance without identity", async () => {
  const response = await send(`${mount}/status`)
  expect(response.status).toBe(200)
  expect(response.headers.get("www-authenticate")).toBeNull()
  expect(response.headers.get("set-cookie")).toBeNull()
  expect(response.headers.getSetCookie()).toEqual([])
  const body = await response.json()
  expect(body).toMatchObject({
    configured: false,
    authentication: "unconfigured",
    authenticated: false,
    enrollmentRequired: false,
    surfaces: [],
  })
  expect(body).not.toHaveProperty("principal")
  expect(body).not.toHaveProperty("sessionScope")
})

test("unconfigured native business state and command stay unavailable with or without Host Basic", async () => {
  const requests: [string, RequestInit?][] = [
    [`${mount}/dashboard/state?page=IT%20Risks`],
    [`${mount}/dashboard/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: "IT Risks", action: "save", version: 1, values: {} }) }],
    [`${mount}/dashboard/state?page=IT%20Risks`, { headers: { authorization: basic } }],
    [`${mount}/dashboard/commands`, { method: "POST", headers: { authorization: basic, "content-type": "application/json" }, body: JSON.stringify({ page: "IT Risks", action: "save", version: 1, values: {} }) }],
  ]
  for (const [pathname, init] of requests) {
    const response = await send(pathname, init)
    expect(response.status).toBe(503)
    expect(response.headers.get("www-authenticate")).toBeNull()
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(await response.json()).toMatchObject({ _tag: "ServiceUnavailableError", service: "sucafina" })
  }
})

test("Host health and real Location APIs retain Basic while near-prefix native paths are not public", async () => {
  const health = await send("/api/health")
  expect(health.status).toBe(401)
  expect(health.headers.get("www-authenticate")).toMatch(/^Basic\b/i)
  expect((await send("/api/health", { headers: { authorization: basic } })).status).toBe(200)

  const locationApi = `/api/skill/catalog?location[directory]=${encodeURIComponent(root)}`
  const ordinaryApi = await send(locationApi)
  expect(ordinaryApi.status).toBe(401)
  expect(ordinaryApi.headers.get("www-authenticate")).toMatch(/^Basic\b/i)
  expect((await send(locationApi, { headers: { authorization: basic } })).status).toBe(200)

  for (const pathname of ["/api/sucafina-extra/status", `${mount}/status-extra`]) {
    const response = await send(pathname)
    expect(response.status).toBeGreaterThanOrEqual(400)
  }
})
