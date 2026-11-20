import { afterEach, expect, test } from "bun:test"
import { Effect, Layer, Option, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { SucafinaGroup } from "@orchestra/protocol/groups/sucafina"
import { Authorization } from "@orchestra/protocol/middleware/authorization"
import { SchemaErrorMiddleware } from "@orchestra/protocol/middleware/schema-error"
import { ServerAuth } from "../src/auth"
import { SucafinaHandler } from "../src/handlers/sucafina"
import { authorizationLayerWith } from "../src/middleware/authorization"
import { schemaErrorLayer } from "../src/middleware/schema-error"
import { SfInstallationSource, type SfTrustedInstallationSource } from "../src/sucafina-installations"

const origin = "https://sf.example.test"
const current = "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1"
const installed = { publicOrigin: origin, mount: "/sucafina", authMode: "microsoft" as const,
  tenantId: "11111111-2222-4333-8444-555555555555",
  identity: () => ({ installationId: "installed-one", projectId: "technical-placement", hostId: "loaded-host" }) }
const basic = "Basic " + btoa("orchestra:configured-host-secret")
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

// Real Authorization and discovery handlers, with an explicitly declared installed
// metadata source. This proves no corporate login, grant or Session admission.
function fixture(value: Awaited<ReturnType<SfTrustedInstallationSource["current"]>> | null = installed, failure = false) {
  const observations = { current: 0, locations: 0, privateCalls: 0 }
  const source: SfTrustedInstallationSource = {
    current: async () => { observations.current++; if (failure) throw new Error("offline"); return value ?? undefined },
    forAdmittedLocation: async () => { observations.locations++; throw new Error("No Location discovery in bootstrap") },
  }
  const probe = HttpApiGroup.make("bootstrap.probe")
    .add(HttpApiEndpoint.get("private", "/api/private", { success: Schema.String }))
    .add(HttpApiEndpoint.get("other", "/api/sucafina/other", { success: Schema.String }))
    .add(HttpApiEndpoint.post("post", "/api/sucafina/installations", { success: Schema.String }))
  const api = HttpApi.make("server").add(SucafinaGroup).add(probe)
    .middleware(Authorization).middleware(SchemaErrorMiddleware)
  const probeHandlers = HttpApiBuilder.group(api, "bootstrap.probe", (handlers) => {
    const read = () => Effect.sync(() => { observations.privateCalls++; return "private" })
    return handlers.handle("private", read).handle("other", read).handle("post", read)
  })
  const layer = HttpApiBuilder.layer(api).pipe(
    Layer.provide(Layer.mergeAll(SucafinaHandler, probeHandlers)),
    Layer.provide(Layer.succeed(SfInstallationSource, source)),
    Layer.provide(authorizationLayerWith(source)),
    Layer.provide(schemaErrorLayer),
    Layer.provide(ServerAuth.Config.configLayer({ username: "orchestra", password: Option.some("configured-host-secret") })),
    Layer.provide(HttpServer.layerServices),
  )
  const web = HttpRouter.toWebHandler(layer, { disableLogger: true })
  cleanups.push(web.dispose)
  return { ...web, observations }
}

function request(path = current, input: RequestInit = {}, publicOrigin = origin) {
  return new Request(publicOrigin + path, input)
}

test("current Microsoft metadata is reachable by exact GET and HEAD without host Basic", async () => {
  const f = fixture()
  const response = await f.handler(request())
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  expect(await response.json()).toEqual({ installations: [{
    ...installed.identity(), tenantId: installed.tenantId, publicOrigin: origin, mount: installed.mount,
    authMode: "microsoft", contractRevision: "sf-team-profile/1",
  }] })
  const head = await f.handler(request(current, { method: "HEAD" }))
  expect(head.status).toBe(200)
  expect(await head.text()).toBe("")
  expect(f.observations.locations).toBe(0)
  expect(f.observations.privateCalls).toBe(0)
})

test("bootstrap exception rejects mixed selectors, encoded duplicates and old or missing revisions before lookup", async () => {
  const f = fixture()
  const invalid = [
    "?select=current", "?select=current&contractRevision=sf-native-ui%2F1",
    "?select=current&contractRevision=sf-team-profile%2F1&select=current",
    "?select=current&contractRevision=sf-team-profile%2F1&%63ontractRevision=sf-team-profile%2F1",
    "?select=installation&contractRevision=sf-team-profile%2F1&installationId=installed-one&tenantId=" + installed.tenantId,
    "?select=ids&installationId=installed-one&projectId=technical-placement",
    "?select=location&location[directory]=%2Fwork",
    ...["installationId", "tenantId", "teamObjectId", "principalRef", "accessRevision", "projectId", "auth_token"]
      .map((key) => "?select=current&contractRevision=sf-team-profile%2F1&" + key + "=caller"),
  ]
  for (const query of invalid) {
    const response = await f.handler(request("/api/sucafina/installations" + query))
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toBe('Basic realm="Secure Area"')
  }
  expect(f.observations.current).toBe(0)
  expect(f.observations.locations).toBe(0)
})

test("public bootstrap is bound to the configured transport host and origin without forwarded hints", async () => {
  const f = fixture()
  for (const value of [
    request(current, {}, "https://other.example.test"),
    request(current, {}, "http://sf.example.test"),
    request(current, { headers: { host: "other.example.test" } }),
    request(current, { headers: { host: "sf.example.test:444" } }),
    request(current, { headers: { origin: "https://other.example.test" } }),
    request(current, { headers: { "sec-fetch-site": "cross-site" } }),
    request(current, { headers: { host: "other.example.test", "x-forwarded-host": "sf.example.test", "x-forwarded-proto": "https" } }),
  ]) expect((await f.handler(value)).status).toBe(401)
  expect((await f.handler(request(current, { headers: { host: "sf.example.test", origin, "sec-fetch-site": "same-origin" } }))).status).toBe(200)
  expect(f.observations.locations).toBe(0)
})

test("the exception does not expose other routes or mutation methods and existing Basic still works", async () => {
  const f = fixture()
  for (const value of [request("/api/private"), request("/api/sucafina/other"), request(current, { method: "POST" })]) {
    expect((await f.handler(value)).status).toBe(401)
  }
  expect(f.observations.privateCalls).toBe(0)
  expect(f.observations.current).toBe(0)
  const admitted = await f.handler(request("/api/private", { headers: { authorization: basic } }))
  expect(admitted.status).toBe(200)
  expect(f.observations.privateCalls).toBe(1)
  const malformed = await f.handler(request("/api/sucafina/installations?select=current", { headers: { authorization: basic } }))
  expect(malformed.status).toBe(400)
})

test("absent, local-operator, incomplete or failed metadata never creates a public exemption", async () => {
  // Every handler is registered for cleanup before a request can fail.
  for (const f of [
    fixture(null),
    fixture({ ...installed, tenantId: undefined }),
    fixture({ ...installed, authMode: "local-operator", publicOrigin: "http://127.0.0.1:4096" }),
    fixture({ ...installed, identity: () => undefined }),
    fixture(installed, true),
  ]) expect((await f.handler(request())).status).toBe(401)
})
