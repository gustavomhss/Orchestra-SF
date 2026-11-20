import { afterEach, beforeAll, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { createMicrosoftInstallation } from "../../local/entry.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { integrationModule } from "../microsoft-login/integration-fixture.ts"
import { privateFixture, listenerOrigin, publicOrigin } from "../microsoft-login/private-fixture.ts"
import { group, microsoftFixture, oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"

const mount = "/sucafina"
const route = `${mount}/api/ui/team-profiles`
const teamId = "aaaaaaaa-7777-4777-8777-777777777777"
const secondTeamId = "bbbbbbbb-8888-4888-8888-888888888888"
const team = (id = teamId) => ({ id, tenantId: tenant, displayName: "Verified Team", isArchived: false })
let entry: { createMicrosoftInstallation: typeof createMicrosoftInstallation }
const cleanups: (() => Promise<void>)[] = []

beforeAll(async () => { entry = await integrationModule("modules/sucafina/Sucafinav1/local/entry.ts") })
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

async function setup(input: { teams?: boolean; supreme?: string | null; productAdmin?: boolean } = {}) {
  const privateFiles = await privateFixture()
  cleanups.push(privateFiles.close)
  const provider = await microsoftFixture({ ...(input.teams === false ? {} : { teams: "direct" }) })
  const config = {
    ...privateFiles.config,
    groups: { dashboard: input.productAdmin ? { admin: `group:${group}` } : {}, planner: {}, procurement: {} },
    grants: [],
    ...(input.teams === false ? {} : { teams: "direct" }),
    ...(input.supreme === null ? {} : { supremeAdminGroupId: input.supreme ?? group }),
  }
  await writeFile(privateFiles.file, JSON.stringify(config), { mode: 0o600 })
  const application = await entry.createMicrosoftInstallation({ origin: listenerOrigin }, privateFiles.file, privateFiles.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  cleanups.push(async () => { await application.dispose() })
  const installationId = digestSfValue({ origin: publicOrigin, mount, directory: privateFiles.directory })
  const profile = { installationId, tenantId: tenant, teamObjectId: teamId }
  const store = await openLocalStore(path.join(privateFiles.directory, "business-microsoft"), { teamProfiles: { installationId, tenantId: tenant } })
  cleanups.push(store.dispose)
  if (!store.teamProfiles) throw new Error("Actual profile policy store required")
  const policy = store.teamProfiles
  const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId, tenantId: tenant }).toString()
  const invoke = async (request: Request) => {
    const response = await application.handler(request)
    if (!response) throw new Error("Installed Teams profile route required")
    return response
  }
  const request = (pathname: string, init: RequestInit = {}) => invoke(new Request(`${publicOrigin}${pathname}`, init))
  const read = (cookie?: string, queryValue = query, init: RequestInit = {}) => request(`${route}?${queryValue}`, { ...init, headers: { ...(cookie ? { cookie } : {}), ...Object.fromEntries(new Headers(init.headers)) } })
  const command = (action = "enable", expectedRevision = 0, selected = profile) => ({ action, profile: selected, expectedRevision })
  const post = (cookie: string, value: unknown, init: RequestInit = {}) => request(`${route}?${query}`, {
    method: "POST", ...init,
    headers: { cookie, origin: publicOrigin, "content-type": "application/json", ...Object.fromEntries(new Headers(init.headers)) },
    body: typeof value === "string" ? value : JSON.stringify(value),
  })
  const login = async (account = oid) => {
    const begin = await request(`${mount}/auth/login?returnTo=${encodeURIComponent(mount + "/dashboard")}`)
    expect(begin.status).toBe(303)
    const location = begin.headers.get("location")!
    const cookie = begin.headers.getSetCookie()[0].split(";")[0]
    const code = await provider.issueCode(location, account)
    const finish = await request(`${mount}/auth/callback?state=${new URL(location).searchParams.get("state")}&code=${code}`, { headers: { cookie } })
    expect(finish.status).toBe(303)
    return finish.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
  }
  const snapshot = () => Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
    store.transaction(surface, async (value) => ({ commit: false, value }))))
  return { ...privateFiles, config, provider, application, installationId, profile, store, policy, query, request, invoke, read, post, command, login, snapshot }
}

function barrier() {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  return { entered: entered.promise, release: () => release.resolve(), hold: async () => { entered.resolve(); await release.promise } }
}

async function unchanged(f: Awaited<ReturnType<typeof setup>>) {
  expect(await f.policy.read()).toEqual({ configRevision: 0, profiles: [] })
  expect(await f.policy.audit()).toEqual([])
}

test("admin-http: real confidential installation lists configuration for a supreme member without Teams or RoleRows", async () => {
  const f = await setup({ teams: false })
  const cookie = await f.login()
  const business = await f.snapshot()
  const response = await f.read(cookie)
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  const value = await response.json()
  expect(value).toEqual({ status: "ok", configRevision: 0, profiles: [] })
  expect(Schema.is(TeamProfile.AdminListResult)(value)).toBe(true)
  expect(f.provider.requests.some((request) => request.url.includes("/joinedTeams") || request.url.includes("/teams/"))).toBe(false)
  const unavailable = await f.post(cookie, f.command())
  expect(unavailable.status).toBe(503)
  expect(await unavailable.json()).toEqual({ status: "unavailable", reason: "capability-disabled" })
  await unchanged(f)
  expect(await f.snapshot()).toEqual(business)
})

test("admin-http: enabling a verified Team, retrying and removing the last profile are atomic and leave business untouched", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  const business = await f.snapshot()
  expect(f.provider.directTeams.get(oid)).toEqual([])
  const enabled = await f.post(cookie, f.command())
  expect(enabled.status).toBe(200)
  const enabledValue = await enabled.json()
  expect(enabledValue).toEqual({ status: "ok", configRevision: 1, changed: true })
  expect(Schema.is(TeamProfile.AdminConfigureResult)(enabledValue)).toBe(true)
  const result = await f.read(cookie)
  const body = await result.text()
  expect(JSON.parse(body)).toEqual({ status: "ok", configRevision: 1, profiles: [{ profile: Schema.decodeUnknownSync(TeamProfile.Ref)(f.profile), enabled: true }] })
  for (const secret of ["synthetic-access-", "synthetic-refresh-", "supremeAdminGroupId", "principalObjectId", "accessRevision", "audit", "grants", "epoch", group]) expect(body).not.toContain(secret)
  expect(await (await f.post(cookie, f.command("enable", 1))).json()).toEqual({ status: "ok", configRevision: 1, changed: false })
  expect(await f.policy.audit()).toHaveLength(1)
  // Removal must remain possible after Graph loses Team-read permission.
  f.provider.hooks.before = (request) => new URL(request.url).pathname.startsWith("/v1.0/teams/") ? Response.json({ error: "forbidden" }, { status: 403 }) : undefined
  const before = f.provider.requests.filter((request) => request.url.includes("/teams/")).length
  const removed = await f.post(cookie, f.command("remove", 1))
  expect(removed.status).toBe(200)
  expect(await removed.json()).toEqual({ status: "ok", configRevision: 2, changed: true })
  expect(f.provider.requests.filter((request) => request.url.includes("/teams/"))).toHaveLength(before)
  expect(await (await f.read(cookie)).json()).toEqual({ status: "ok", configRevision: 2, profiles: [] })
  expect(await f.policy.audit()).toHaveLength(2)
  expect(await f.snapshot()).toEqual(business)
})

test("admin-http: disabled profiles remain configured and missing removal never fabricates a revision", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  expect(await (await f.post(cookie, f.command())).json()).toMatchObject({ status: "ok", configRevision: 1 })
  const disabled = await f.post(cookie, f.command("disable", 1))
  expect(disabled.status).toBe(200)
  expect(await disabled.json()).toEqual({ status: "ok", configRevision: 2, changed: true })
  expect(await (await f.read(cookie)).json()).toEqual({ status: "ok", configRevision: 2, profiles: [{ profile: f.profile, enabled: false }] })
  const missing = await f.post(cookie, f.command("remove", 2, { ...f.profile, teamObjectId: secondTeamId }))
  expect(missing.status).toBe(404)
  expect(await missing.json()).toEqual({ status: "not-found" })
  expect(await f.policy.audit()).toHaveLength(2)
})

test("admin-http: two simultaneous writers using one revision cannot overwrite each other", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  f.provider.teamResources.set(secondTeamId, team(secondTeamId))
  const cookie = await f.login()
  const results = await Promise.all([
    f.post(cookie, f.command()),
    f.post(cookie, f.command("enable", 0, { ...f.profile, teamObjectId: secondTeamId })),
  ])
  expect(results.map((response) => response.status).sort()).toEqual([200, 409])
  const bodies = await Promise.all(results.map((response) => response.json()))
  expect(bodies).toEqual(expect.arrayContaining([{ status: "ok", configRevision: 1, changed: true }, { status: "conflict", configRevision: 1 }]))
  expect((await f.policy.read()).profiles).toHaveLength(1)
  expect(await f.policy.audit()).toHaveLength(1)
})

test("admin-http: a product administrator and JWT admin claims do not replace the configured supreme group", async () => {
  const f = await setup({ supreme: other, productAdmin: true })
  Object.assign(f.provider.claims, { roles: ["admin"], email: "admin@example.test" })
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  for (const response of [await f.read(cookie), await f.post(cookie, f.command())]) {
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ status: "denied" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
  expect(f.provider.requests.some((request) => request.url.includes("/teams/"))).toBe(false)
  await unchanged(f)
})

test("admin-http: an unconfigured supreme group denies without inventing defaults", async () => {
  const f = await setup({ supreme: null })
  const cookie = await f.login()
  const before = f.provider.requests.length
  expect(await (await f.read(cookie)).json()).toEqual({ status: "denied" })
  expect(await (await f.post(cookie, f.command())).json()).toEqual({ status: "denied" })
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)
})

test("admin-http: absent, duplicated, revoked and claimed credentials reveal no profile configuration", async () => {
  const f = await setup()
  const cookie = await f.login()
  for (const response of [
    await f.read(),
    await f.read(cookie + "; " + cookie),
    await f.read(undefined, f.query, { headers: { authorization: "Basic synthetic-only", "x-principal-id": oid, "x-role": "admin" } }),
    await f.read(undefined, f.query, { headers: { authorization: "Bearer synthetic-only" } }),
  ]) {
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: "unauthenticated" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
  expect((await f.request(`${mount}/auth/logout`, { method: "POST", headers: { cookie, origin: publicOrigin } })).status).toBe(204)
  expect((await f.read(cookie)).status).toBe(401)
  expect((await f.post(cookie, f.command())).status).toBe(401)
  await unchanged(f)
})

test("admin-http: removing current supreme membership revokes both read and mutation without a cache", async () => {
  const f = await setup()
  const cookie = await f.login()
  expect((await f.read(cookie)).status).toBe(200)
  f.provider.account.groups.splice(0)
  expect(await (await f.read(cookie)).json()).toEqual({ status: "denied" })
  expect(await (await f.post(cookie, f.command())).json()).toEqual({ status: "denied" })
  await unchanged(f)
})

test("admin-http: malformed, duplicate and cross-bound selectors are rejected before Graph", async () => {
  const f = await setup()
  const cookie = await f.login()
  const before = f.provider.requests.length
  for (const query of [
    "", f.query + "&extra=1", f.query + "&tenantId=" + tenant,
    f.query + "&%74enantId=" + tenant,
    f.query.replace("sf-team-profile%2F1", "sf-native-ui%2F1"),
    new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: f.installationId }).toString(),
    f.query.replace(tenant, "not-a-tenant"),
  ]) {
    const response = await f.read(cookie, query)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: "invalid-request" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
  for (const query of [
    new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: "another-installation", tenantId: tenant }).toString(),
    new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: f.installationId, tenantId: other }).toString(),
  ]) expect((await f.read(cookie, query)).status).toBe(403)
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)
})

test("admin-http: unsafe methods and cross-origin requests retain the private closed response", async () => {
  const f = await setup()
  const cookie = await f.login()
  const before = f.provider.requests.length
  for (const method of ["PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
    const response = await f.read(cookie, f.query, { method, headers: { origin: publicOrigin } })
    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET, POST")
    expect(response.headers.get("cache-control")).toBe("no-store")
    if (method !== "HEAD") expect(await response.json()).toEqual({ status: "invalid-request" })
  }
  for (const headers of [
    new Headers({ cookie, "content-type": "application/json" }),
    new Headers({ cookie, origin: "https://foreign.example.test", "content-type": "application/json" }),
    new Headers({ cookie, origin: publicOrigin, "sec-fetch-site": "cross-site", "content-type": "application/json" }),
  ]) {
    const response = await f.request(`${route}?${f.query}`, { method: "POST", headers, body: JSON.stringify(f.command()) })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ status: "denied" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
  const foreign = await f.invoke(new Request(`https://foreign.example.test${route}?${f.query}`, { headers: { cookie } }))
  expect(foreign.status).toBe(403)
  expect(foreign.headers.get("cache-control")).toBe("no-store")
  expect(await foreign.json()).toEqual({ status: "denied" })
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)
})

test("admin-http: cross-bound and extra-authority command fields cannot reach configure", async () => {
  const f = await setup()
  const cookie = await f.login()
  const before = f.provider.requests.length
  for (const value of [
    { ...f.command(), principal: { tenantId: tenant, principalObjectId: oid } },
    { ...f.command(), accessRevision: "fake-proof" },
    { ...f.command(), supremeAdminGroupId: group },
    { ...f.command(), grants: [] },
    { ...f.command(), action: "create" },
    { ...f.command(), expectedRevision: "0" },
    { ...f.command(), expectedRevision: -1 },
    { ...f.command(), expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...f.command(), profile: { ...f.profile, projectId: "old-repo" } },
  ]) {
    const response = await f.post(cookie, value)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: "invalid-request" })
  }
  for (const profile of [{ ...f.profile, installationId: "another-installation" }, { ...f.profile, tenantId: other }]) {
    expect((await f.post(cookie, f.command("enable", 0, profile))).status).toBe(403)
  }
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)
})

test("admin-http: duplicate JSON keys and prototype-bearing objects are rejected from original bytes", async () => {
  const f = await setup()
  const cookie = await f.login()
  const raw = JSON.stringify(f.command())
  const before = f.provider.requests.length
  for (const body of [
    raw.replace('"action":"enable"', '"action":"disable","action":"enable"'),
    raw.replace('"action":"enable"', '"act\\u0069on":"disable","action":"enable"'),
    raw.replace('"expectedRevision":0', '"expectedRevision":5,"expectedRevision":0'),
    raw.replace(`"tenantId":"${tenant}"`, `"tenantId":"${other}","tenantId":"${tenant}"`),
    raw.slice(0, -1) + ',"__proto__":{"admin":true}}',
    raw.slice(0, -1) + ',"constructor":{"prototype":{"admin":true}}}',
    raw.replace('"profile":{', '"profile":{"prototype":{},'),
  ]) {
    const response = await f.post(cookie, body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: "invalid-request" })
  }
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)
})

test("admin-http: media type, content encoding, length, malformed UTF-8 and truncated bodies fail without effects", async () => {
  const f = await setup()
  const cookie = await f.login()
  const before = f.provider.requests.length
  for (const [headers, status] of [
    [{ "content-type": "text/plain" }, 415],
    [{ "content-type": "application/jsonp" }, 415],
    [{ "content-type": "application/json; charset=latin1" }, 415],
    [{ "content-encoding": "gzip" }, 415],
    [{ "content-length": "8193" }, 413],
    [{ "content-length": "2, 3" }, 400],
    [{ "content-length": String(new TextEncoder().encode(JSON.stringify(f.command())).length + 1) }, 400],
  ] as const) expect((await f.post(cookie, f.command(), { headers })).status).toBe(status)
  for (const body of ["", "{", "[]", "null", JSON.stringify(f.command()).slice(0, -1)]) {
    expect((await f.post(cookie, body)).status).toBe(400)
  }
  const invalidUtf8 = await f.request(`${route}?${f.query}`, { method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/json" }, body: new Uint8Array([0xc3, 0x28]) })
  expect(invalidUtf8.status).toBe(400)
  expect((await f.post(cookie, " ".repeat(8193), { headers: { "content-length": "1" } })).status).toBe(413)
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)
})

test("admin-http: streamed complete JSON is admitted only after EOF; an unterminated body times out without mutation", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  const before = f.provider.requests.length
  const stopped = { value: false }
  const bytes = new TextEncoder().encode(JSON.stringify(f.command()))
  const hanging = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(bytes) },
    cancel() { stopped.value = true; return new Promise<void>(() => undefined) },
  })
  const timeout = await f.request(`${route}?${f.query}`, { method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/json" }, body: hanging, duplex: "half" } as RequestInit)
  expect(timeout.status).toBe(408)
  expect(await timeout.json()).toEqual({ status: "invalid-request" })
  expect(stopped.value).toBe(true)
  expect(f.provider.requests).toHaveLength(before)
  await unchanged(f)

  const streamed = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, 17)); controller.enqueue(bytes.slice(17)); controller.close() } })
  const response = await f.request(`${route}?${f.query}`, { method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/json" }, body: streamed, duplex: "half" } as RequestInit)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: "ok", configRevision: 1, changed: true })
}, 15000)

test("admin-http: cancellation during command streaming closes the reader and cannot write configuration", async () => {
  const f = await setup()
  const cookie = await f.login()
  const controller = new AbortController()
  const entered = Promise.withResolvers<void>()
  const stopped = { value: false }
  const body = new ReadableStream<Uint8Array>({
    pull(stream) { stream.enqueue(new TextEncoder().encode('{"action":')); entered.resolve() },
    cancel() { stopped.value = true },
  }, { highWaterMark: 0 })
  const pending = f.request(`${route}?${f.query}`, { method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/json" }, body, signal: controller.signal, duplex: "half" } as RequestInit)
  await entered.promise
  controller.abort()
  const response = await pending
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ status: "invalid-request" })
  expect(stopped.value).toBe(true)
  await unchanged(f)
})

for (const kind of ["membership", "team"] as const) {
  test(`admin-http: provider refusal during ${kind} is unavailable and cannot persist an empty success`, async () => {
    const f = await setup()
    f.provider.teamResources.set(teamId, team())
    const cookie = await f.login()
    f.provider.hooks.before = (request) => {
      const path = new URL(request.url).pathname
      return (kind === "membership" ? path === "/v1.0/me/checkMemberGroups" : path.startsWith("/v1.0/teams/"))
        ? Response.json({ error: { message: "synthetic-private-provider-detail" } }, { status: 403 }) : undefined
    }
    const response = await f.post(cookie, f.command())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: "unavailable", reason: "forbidden" })
    await unchanged(f)
  })
}

for (const cause of ["membership", "logout", "abort"] as const) {
  test(`admin-http: ${cause} while Team verification is pending fences the mutation`, async () => {
    const f = await setup()
    f.provider.teamResources.set(teamId, team())
    const cookie = await f.login()
    const controller = new AbortController()
    const gate = barrier()
    f.provider.hooks.before = async (request) => {
      if (!new URL(request.url).pathname.startsWith("/v1.0/teams/")) return undefined
      await gate.hold()
      return undefined
    }
    const pending = f.post(cookie, f.command(), { signal: controller.signal })
    await gate.entered
    if (cause === "membership") f.provider.account.groups.splice(0)
    if (cause === "logout") expect((await f.request(`${mount}/auth/logout`, { method: "POST", headers: { cookie, origin: publicOrigin } })).status).toBe(204)
    if (cause === "abort") controller.abort()
    gate.release()
    const response = await pending
    expect(response.status).toBe(cause === "membership" ? 403 : 401)
    expect(await response.json()).toEqual({ status: cause === "membership" ? "denied" : "unauthenticated" })
    await unchanged(f)
  })
}

test("admin-http: owner policy reload is current and a changed immutable tenant cannot retarget the installation", async () => {
  const f = await setup()
  const cookie = await f.login()
  expect((await f.read(cookie)).status).toBe(200)
  await writeFile(f.file, JSON.stringify({ ...f.config, supremeAdminGroupId: other }), { mode: 0o600 })
  expect(await (await f.read(cookie)).json()).toEqual({ status: "denied" })
  await writeFile(f.file, JSON.stringify({ ...f.config, tenantId: other }), { mode: 0o600 })
  const invalid = await f.post(cookie, f.command())
  expect(invalid.status).toBe(503)
  expect(await invalid.json()).toEqual({ status: "unavailable", reason: "policy-unavailable" })
  await unchanged(f)
})

const sharedDocument = (model = "provider/shared") => ({
  version: 1, settings: { model, default_agent: "analyst", agents: { analyst: { name: "Shared analyst", system: "Use approved evidence.", model } } },
})
const configPost = (f: Awaited<ReturnType<typeof setup>>, cookie: string, value: unknown, init: RequestInit = {}) =>
  f.request(`${route}/configuration?${f.query}`, {
    method: "POST", ...init,
    headers: { cookie, origin: publicOrigin, "content-type": "application/json", ...Object.fromEntries(new Headers(init.headers)) },
    body: typeof value === "string" ? value : JSON.stringify(value),
  })
const configRead = (f: Awaited<ReturnType<typeof setup>>, cookie: string, teamObjectId = teamId) =>
  f.request(`${route}/configuration?${f.query}&teamObjectId=${teamObjectId}`, { headers: { cookie } })

test("configuration-http: actual installation exposes only closed shared data and commits its revision with audit", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  const before = await f.snapshot()
  expect((await f.post(cookie, f.command())).status).toBe(200)
  expect((await configRead(f, cookie)).status).toBe(404)
  const write = await configPost(f, cookie, { profile: f.profile, expectedRevision: 1, document: sharedDocument() })
  expect(write.status).toBe(200)
  expect(await write.json()).toEqual({ status: "ok", configRevision: 2, changed: true })
  const read = await configRead(f, cookie)
  expect(read.status).toBe(200)
  expect(read.headers.get("cache-control")).toBe("no-store")
  const value = await read.json()
  expect(Schema.is(TeamProfile.ConfigurationReadResult)(value)).toBe(true)
  expect(value).toEqual({ status: "ok", configuration: {
    origin: "installation-team-store", profile: f.profile, configRevision: 2, document: sharedDocument(),
  } })
  expect(f.provider.directTeams.get(oid)).toEqual([])
  expect(f.provider.requests.some((request) => request.url.includes("/joinedTeams"))).toBe(false)
  const audit = await f.policy.audit()
  expect(audit.map((row) => row.action)).toEqual(["enable", "configuration"])
  expect(JSON.stringify(audit)).not.toContain("Use approved evidence")
  expect(await f.snapshot()).toEqual(before)
})

test("configuration-http: simultaneous edits and semantic retries retain one revision, with no lost update", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  expect((await f.post(cookie, f.command())).status).toBe(200)
  const written = await Promise.all(["provider/one", "provider/two"].map((model) =>
    configPost(f, cookie, { profile: f.profile, expectedRevision: 1, document: sharedDocument(model) })))
  expect(written.map((response) => response.status).sort()).toEqual([200, 409])
  const selected = Schema.decodeUnknownSync(TeamProfile.ConfigurationReadResult)(await (await configRead(f, cookie)).json())
  if (selected.status !== "ok") throw new Error("Actual shared configuration required")
  const retry = await configPost(f, cookie, { document: selected.configuration.document, expectedRevision: 2, profile: f.profile })
  expect(await retry.json()).toEqual({ status: "ok", configRevision: 2, changed: false })
  expect(await f.policy.audit()).toHaveLength(2)
})

test("configuration-http: hostile fields, bindings, duplicate JSON and missing CSRF origin never reach configuration writes", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  expect((await f.post(cookie, f.command())).status).toBe(200)
  const before = await f.snapshot()
  const valid = { profile: f.profile, expectedRevision: 1, document: sharedDocument() }
  const invalid: unknown[] = [
    { ...valid, document: { version: 1, settings: { providers: { personal: { token: "forbidden" } } } } },
    { ...valid, document: { version: 1, settings: { agents: { analyst: { engine: "claude-code" } } } } },
    { ...valid, document: { version: 1, settings: { instructions: ["/private/instructions"] } } },
    { ...valid, expectedRevision: "1" },
    JSON.stringify(valid).replace('"expectedRevision":1', '"expectedRevision":1,"expectedRevision":1'),
  ]
  for (const value of invalid) expect((await configPost(f, cookie, value)).status).toBe(400)
  expect((await configPost(f, cookie, { ...valid, profile: { ...f.profile, installationId: "foreign" } })).status).toBe(403)
  expect((await configPost(f, cookie, valid, { headers: { origin: "" } })).status).toBe(403)
  expect((await configPost(f, cookie, " ".repeat(65537))).status).toBe(413)
  expect((await f.request(`${route}/configuration?${f.query}&teamObjectId=${teamId}&teamObjectId=${teamId}`, { headers: { cookie } })).status).toBe(400)
  expect(await f.policy.read()).toEqual({ configRevision: 1, profiles: [{ profile: f.profile, enabled: true }] })
  expect(await f.policy.audit()).toHaveLength(1)
  expect(await f.snapshot()).toEqual(before)
})

test("configuration-http: the supreme group is reread inside CAS and after a shared read before publication", async () => {
  const f = await setup()
  f.provider.teamResources.set(teamId, team())
  const cookie = await f.login()
  expect((await f.post(cookie, f.command())).status).toBe(200)
  let proofs = 0
  f.provider.hooks.before = (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups" && ++proofs === 2) f.provider.account.groups = []
    return undefined
  }
  const denied = await configPost(f, cookie, { profile: f.profile, expectedRevision: 1, document: sharedDocument() })
  expect(denied.status).toBe(403)
  expect(await f.policy.audit()).toHaveLength(1)
  expect(await f.policy.readConfiguration(Schema.decodeUnknownSync(TeamProfile.Ref)(f.profile))).toBeUndefined()
  f.provider.hooks.before = undefined
  f.provider.account.groups = [group]
  expect((await configPost(f, cookie, { profile: f.profile, expectedRevision: 1, document: sharedDocument() })).status).toBe(200)
  proofs = 0
  f.provider.hooks.before = (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups" && ++proofs === 2) f.provider.account.groups = []
    return undefined
  }
  const hidden = await configRead(f, cookie)
  expect(hidden.status).toBe(403)
  expect(await hidden.json()).toEqual({ status: "denied" })
  expect(await f.policy.audit()).toHaveLength(2)
})
