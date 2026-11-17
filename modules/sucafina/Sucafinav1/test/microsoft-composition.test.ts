import { afterAll, afterEach, beforeAll, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Layer, Tracer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import type { EntraOptions } from "../runtime/local-contract.ts"
import type { MicrosoftTransport } from "../runtime/microsoft-installation.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { microsoftFixture, group, other, oid } from "./microsoft-login/oidc-fixture.ts"
import { privateFixture, listenerOrigin, ingressOrigin, publicOrigin } from "./microsoft-login/private-fixture.ts"
import { integrationModule, removeIntegrationModules } from "./microsoft-login/integration-fixture.ts"

type Installation = { mount: `/${string}`; handler: (request: Request) => Promise<Response | undefined>; dispose: () => void | Promise<void>; transport?: MicrosoftTransport }
type Entry = {
  createMicrosoftInstallation: (context: { origin: string }, file: string | undefined, environment: Readonly<Record<string, string | undefined>>, overrides?: { fetch?: EntraOptions["fetch"]; now?: () => Date }) => Promise<Installation>
  createLocalInstallation: (context: { origin: string }, file: string | undefined, environment: Readonly<Record<string, string | undefined>>) => Promise<Installation>
}
type Loader = { composeSfInstallation: (value: unknown, origin: string) => Promise<Installation & { layer: Layer.Layer<never, never, HttpRouter.HttpRouter>; privacy: Layer.Layer<never> }> }
let entry: Entry
let loader: Loader
const cleanups: (() => Promise<void>)[] = []
beforeAll(async () => {
  entry = await integrationModule<Entry>("modules/sucafina/Sucafinav1/local/entry.ts")
  loader = await integrationModule<Loader>("apps/cli/src/sucafina-product/installation.ts")
})
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
afterAll(removeIntegrationModules)

async function setup() {
  const f = await privateFixture()
  cleanups.push(f.close)
  const provider = await microsoftFixture()
  await writeFile(f.file, JSON.stringify({ ...f.config, groups: { ...f.config.groups, dashboard: { viewer: `group:${group}`, admin: `group:${other}` } } }))
  const application = await entry.createMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  cleanups.push(async () => { await application.dispose() })
  const installation = await loader.composeSfInstallation(application, listenerOrigin)
  const spans: Tracer.NativeSpan[] = []
  const tracer = Tracer.make({ span(options) { const span = new Tracer.NativeSpan(options); spans.push(span); return span } })
  const router = HttpRouter.toWebHandler(Layer.mergeAll(installation.layer, installation.privacy, Layer.succeed(Tracer.Tracer)(tracer)).pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  cleanups.push(router.dispose)
  const store = await openLocalStore(path.join(f.directory, "business-microsoft"))
  cleanups.push(store.dispose)
  const request = (pathname: string, init: RequestInit = {}) => router.handler(new Request(`${ingressOrigin}${pathname}`, { ...init, headers: { host: new URL(ingressOrigin).host, ...Object.fromEntries(new Headers(init.headers)) } }))
  async function login(account = oid) {
    const begin = await request("/sucafina/auth/login?returnTo=%2Fsucafina%2Fdashboard")
    expect(begin.status).toBe(303)
    const location = begin.headers.get("location")!
    const url = new URL(location)
    expect(url.searchParams.get("redirect_uri")).toBe(`${publicOrigin}/sucafina/auth/callback`)
    const loginCookie = begin.headers.getSetCookie()[0].split(";")[0]
    const code = await provider.issueCode(location, account)
    const callback = `/sucafina/auth/callback?state=${url.searchParams.get("state")}&code=${code}`
    const finish = await request(callback, { headers: { cookie: loginCookie, "x-forwarded-proto": "https", "x-forwarded-host": "untrusted.example" } })
    expect(finish.status).toBe(303)
    const cookieHeader = finish.headers.getSetCookie().find((cookie) => cookie.includes("_session="))!
    expect(cookieHeader).toContain("HttpOnly")
    expect(cookieHeader).toContain("Secure")
    expect(cookieHeader).toContain("SameSite=Lax")
    expect(cookieHeader).not.toContain("Domain=")
    expect(cookieHeader).toStartWith("__Secure-")
    return { cookie: cookieHeader.split(";")[0], callback, loginCookie }
  }
  return { ...f, provider, application, installation, spans, request, login, store }
}

test("exact proposed entry and CLI route compose Microsoft login, bootstrap and existing product pages", async () => {
  const f = await setup()
  expect(f.application.transport).toEqual({ kind: "explicit-https-proxy", listenerOrigin, ingressOrigin, publicOrigin })
  const anonymous = await f.request("/sucafina/dashboard")
  expect(anonymous.status).toBe(303)
  expect(anonymous.headers.get("location")).toBe("/sucafina/auth/login?returnTo=%2Fsucafina%2Fdashboard")
  const first = await f.login()
  // The validated private installation configuration is authoritative at startup.
  // A member may read their configured surface without an unrelated admin first login.
  const memberPage = await f.request("/sucafina/dashboard", { headers: { cookie: first.cookie } })
  expect(memberPage.status).toBe(200)
  expect(memberPage.headers.get("content-type")).toContain("text/html")
  expect(await memberPage.text()).toContain("<html")
  const initialized = await f.store.transaction("dashboard", async (snapshot) => ({
    commit: false, value: { rows: snapshot.data.roleMap, audit: snapshot.audit },
  }))
  expect(initialized.rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ surface: "dashboard", role: "viewer", entra: `group:${group}`, by: "microsoft:installation-config" }),
    expect.objectContaining({ surface: "dashboard", role: "admin", entra: `group:${other}`, by: "microsoft:installation-config" }),
  ]))
  expect(initialized.audit[0]?.who).toBe("microsoft:installation-config")
  f.provider.account.groups.push(other)
  expect((await f.request("/sucafina/dashboard", { headers: { cookie: first.cookie } })).status).toBe(200)
  const rows = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.roleMap }))
  expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ surface: "dashboard", role: "viewer", entra: `group:${group}` })]))
  const guest = await f.login(other)
  const page = await f.request("/sucafina/dashboard", { headers: { cookie: guest.cookie } })
  expect(page.status).toBe(200)
  expect(page.headers.get("content-type")).toContain("text/html")
  expect(await page.text()).not.toContain("Homologação local")
  expect((await f.request("/sucafina/planner", { headers: { cookie: guest.cookie } })).status).toBe(401)
  const deniedWrite = await f.request("/sucafina/dashboard?page=IT%20Risks", { method: "POST", headers: { origin: publicOrigin, cookie: guest.cookie, "content-type": "application/json" }, body: JSON.stringify({ page: "IT Risks", action: "save", version: 0, values: { name: "Denied viewer risk", impact: 3, probability: 2 } }) })
  expect(deniedWrite.status).toBe(403)
  expect(f.spans).toHaveLength(0)
})

test("real mounted transport rejects wrong host, missing Origin and replay; logout revokes the copied cookie", async () => {
  const f = await setup()
  const signed = await f.login()
  expect((await f.request(signed.callback, { headers: { cookie: signed.loginCookie } })).status).toBe(403)
  expect((await f.request("/sucafina/status", { headers: { host: "evil.example", "x-forwarded-host": new URL(ingressOrigin).host } })).status).toBe(403)
  expect((await f.request("/sucafina/status", { headers: { forwarded: "proto=https;host=evil.example", "x-forwarded-proto": "https", "x-forwarded-host": "evil.example" } })).status).toBe(200)
  for (const headers of [new Headers({ cookie: signed.cookie }), new Headers({ cookie: signed.cookie, origin: "https://evil.example" }), new Headers({ cookie: signed.cookie, origin: publicOrigin, "sec-fetch-site": "cross-site" })]) {
    expect((await f.request("/sucafina/auth/logout", { method: "POST", headers })).status).toBe(403)
    expect((await f.request("/sucafina/dashboard", { method: "POST", headers })).status).toBe(403)
  }
  for (const pathname of ["/sucafina-other", "/outside"]) expect((await f.request(pathname)).status).toBe(404)
  expect((await f.request("/sucafina/auth/logout", { method: "POST", headers: { cookie: signed.cookie, origin: publicOrigin } })).status).toBe(204)
  expect((await f.request("/sucafina/dashboard", { headers: { cookie: signed.cookie } })).status).toBe(303)
  expect(f.spans).toHaveLength(0)
})

test("listener privacy blocks tracing before malformed callbacks; capture works without the cloud privacy layer", async () => {
  const f = await setup()
  for (const pathname of ["/sucafina/auth/callback?code=synthetic-only&state=bad", "/sucafina/auth/%63allback?code=synthetic-only&state=bad", "/sucafina/auth/callback?error=access_denied", "/outside?code=synthetic-only"]) {
    const result = await f.request(pathname, { headers: { cookie: "synthetic-only", authorization: "Bearer synthetic-only" } })
    expect(result.status).toBeGreaterThanOrEqual(400)
  }
  expect(f.spans).toHaveLength(0)
  const visible: Tracer.NativeSpan[] = []
  const ended = Promise.withResolvers<void>()
  const tracer = Tracer.make({ span(options) {
    const span = new Tracer.NativeSpan(options)
    const finish = span.end.bind(span)
    span.end = (at, exit) => { finish(at, exit); ended.resolve() }
    visible.push(span)
    return span
  } })
  const control = HttpRouter.toWebHandler(Layer.merge(f.installation.layer, Layer.succeed(Tracer.Tracer)(tracer)).pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  const timeout = setTimeout(() => ended.reject(new Error("Synthetic HTTP trace control did not complete")), 5000)
  try {
    await control.handler(new Request(`${ingressOrigin}/sucafina/auth/callback?code=synthetic-control`, { headers: { host: new URL(ingressOrigin).host } }))
    // Effect schedules HTTP attributes and span.end after resolving the response promise.
    await ended.promise
    expect(visible.some((span) => span.attributes.get("url.query") === "code=synthetic-control")).toBe(true)
  } finally { clearTimeout(timeout); await control.dispose() }
})

test("installed profile fails closed before private business state and never promotes the local operator to HTTPS", async () => {
  const f = await privateFixture()
  cleanups.push(f.close)
  await expect(entry.createMicrosoftInstallation({ origin: listenerOrigin }, undefined, f.environment)).rejects.toThrow()
  await expect(entry.createMicrosoftInstallation({ origin: listenerOrigin }, f.file, { ...f.environment, SUCAFINA_LOCAL_CONFIG: "other.json" })).rejects.toThrow()
  await expect(entry.createMicrosoftInstallation({ origin: "http://127.0.0.1:9999" }, f.file, f.environment)).rejects.toThrow()
  await expect(entry.createLocalInstallation({ origin: publicOrigin }, f.file, f.environment)).rejects.toThrow()
  expect(await Bun.file(path.join(f.directory, "business-microsoft", "installation.sqlite")).exists()).toBe(false)
  const provider = await microsoftFixture()
  const application = await entry.createMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  cleanups.push(async () => { await application.dispose() })
  await expect(loader.composeSfInstallation(application, "http://127.0.0.1:9999")).rejects.toThrow()
  await expect(loader.composeSfInstallation({ ...application, transport: { ...application.transport, kind: "auto-forwarded" } }, listenerOrigin)).rejects.toThrow()
})
