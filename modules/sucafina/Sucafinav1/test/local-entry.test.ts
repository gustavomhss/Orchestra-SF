import { afterEach, expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import path from "node:path"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { createLocalIdentity } from "../runtime/local-identity.ts"
import type { EntraClient } from "../runtime/local-contract.ts"
import { createOperatorIdentity } from "../runtime/operator-identity.ts"
import { loadLocalConfiguration } from "../runtime/local-configuration.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { createLocalInstallation } from "../local/entry.ts"

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })
async function setup() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-entry-"))
  directories.push(root)
  const file = await prepareLocalConfiguration(root)
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  return { root, file, environment }
}
const origin = "http://localhost:4110"

test("unconfigured installation exposes honest readiness and never grants business access", async () => {
  const f = await setup()
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  try {
    const response = await installation.handler(new Request(`${origin}/sucafina/status`))
    expect(response?.status).toBe(200)
    expect(await response!.json()).toEqual({ login: "not-configured", uploads: "unavailable-scanner-not-configured", notifications: "queued-transport-not-configured" })
    expect((await installation.handler(new Request(`${origin}/sucafina/planner`)))?.status).toBe(503)
    expect((await installation.handler(new Request(`${origin}/sucafina/status`, { method: "POST" })))?.status).toBe(405)
  } finally { await installation.dispose() }
})

test("configured IDs do not imply proven login or active scanner; unauthorized browser is directed to local login", async () => {
  const f = await setup()
  const config = await Bun.file(f.file).json()
  config.tenantId = "d89390a4-9315-466c-ab6d-ece154d4753d"
  config.clientId = "fe8424ba-3458-46d0-9964-e2db1da03742"
  await Bun.write(f.file, JSON.stringify(config))
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  try {
    const response = await installation.handler(new Request(`${origin}/sucafina/status`))
    expect(await response!.json()).toEqual({ login: "configured-unverified", uploads: "unavailable-scanner-not-configured", notifications: "queued-transport-not-configured" })
    const business = await installation.handler(new Request(`${origin}/sucafina/planner`))
    expect(business?.status).toBe(303)
    expect(business!.headers.get("location")).toBe("/sucafina/auth/login?returnTo=%2Fsucafina%2Fplanner")
    expect((await installation.handler(new Request("http://other.example/sucafina/status")))?.status).toBe(403)
  } finally { await installation.dispose() }
})

test("origin mismatch and nonisolated host paths fail before any host DB can be opened", async () => {
  const f = await setup()
  await expect(createLocalInstallation({ origin: "http://localhost:4111" }, f.file, f.environment)).rejects.toThrow()
  await expect(createLocalInstallation({ origin }, f.file, {})).rejects.toThrow()
  expect(await Bun.file(path.join(f.root, "host-data", "orchestra.db")).exists()).toBe(false)
  expect(await Bun.file(path.join(f.root, "business", "installation.sqlite")).exists()).toBe(false)
})


async function localAccess() {
  const f = await setup()
  const config = await Bun.file(f.file).json()
  config.authentication = "local-operator"
  config.localOperator = { installationId: "12ec06d9-4201-4370-a3e9-e9a72f213dc9", uid: userInfo().uid }
  await Bun.write(f.file, JSON.stringify(config))
  const loaded = await loadLocalConfiguration(f.file)
  const store = await openLocalStore(path.join(f.root, "business-local"))
  const operator = { ...config.localOperator, name: userInfo().username }
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: loaded.keys.session })
  const code = await identity.enroll()
  return { ...f, store, code, operator }
}

test("explicit local operator opens all surfaces after private enrollment and visibly labels homology", async () => {
  const f = await localAccess()
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  try {
    const anonymous = await installation.handler(new Request(`${origin}/sucafina/dashboard`))
    expect(anonymous?.status).toBe(303)
    const enrolled = await installation.handler(new Request(`${origin}/sucafina/auth/local?code=${f.code}`))
    expect(enrolled?.status).toBe(303)
    const cookie = enrolled!.headers.getSetCookie()[0].split(";")[0]
    for (const surface of ["dashboard", "planner", "procurement"]) {
      const response = await installation.handler(new Request(`${origin}/sucafina/${surface}`, { headers: { cookie } }))
      expect(response?.status).toBe(200)
      expect(response!.headers.get("content-type")).toContain("text/html")
      const html = await response!.text()
      expect(html).toContain("Homologação local")
      expect(html).toContain(userInfo().username)
      expect(html).toContain("Microsoft 365 desativado neste perfil")
    }
    const status = await installation.handler(new Request(`${origin}/sucafina/status`))
    expect(await status!.json()).toMatchObject({ login: "local-operator" })
  } finally { await installation.dispose(); await f.store.dispose() }
})

test("local owner writes persist in isolated local data and audit the actual OS account", async () => {
  const f = await localAccess()
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  const corporate = await openLocalStore(path.join(f.root, "business"))
  try {
    const enrolled = await installation.handler(new Request(`${origin}/sucafina/auth/local?code=${f.code}`))
    const cookie = enrolled!.headers.getSetCookie()[0].split(";")[0]
    const post = (headers: Record<string, string>) => installation.handler(new Request(`${origin}/sucafina/dashboard?page=IT%20Risks`, {
      method: "POST", headers: { "content-type": "application/json", origin, ...headers },
      body: JSON.stringify({ page: "IT Risks", action: "save", version: 0, values: { name: "Local risk", impact: 3, probability: 2 } }),
    }))
    expect((await post({}))?.status).toBe(401)
    expect((await post({ cookie, origin: "https://untrusted.example" }))?.status).toBe(403)
    expect((await post({ cookie }))?.status).toBe(200)
    await f.store.transaction("dashboard", async (snapshot) => {
      expect(snapshot.audit).toHaveLength(1)
      expect(snapshot.audit[0].who).toBe(`macos:${f.operator.installationId}:${f.operator.uid}`)
      expect(snapshot.audit[0].name).toBe(userInfo().username)
      expect(snapshot.data.roleMap).toBeUndefined()
      return { commit: false, value: undefined }
    })
    await corporate.transaction("dashboard", async (snapshot) => {
      expect(snapshot.data).toEqual({})
      expect(snapshot.audit).toEqual([])
      return { commit: false, value: undefined }
    })
  } finally { await installation.dispose(); await f.store.dispose(); await corporate.dispose() }
})

test("local profile is never an implicit fallback and rejects another UID before opening data", async () => {
  const f = await setup()
  const config = await Bun.file(f.file).json()
  config.localOperator = { installationId: "12ec06d9-4201-4370-a3e9-e9a72f213dc9", uid: userInfo().uid }
  await Bun.write(f.file, JSON.stringify(config))
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  try { expect((await installation.handler(new Request(`${origin}/sucafina/dashboard`)))?.status).toBe(503) }
  finally { await installation.dispose() }
  config.authentication = "local-operator"
  config.localOperator.uid++
  await Bun.write(f.file, JSON.stringify(config))
  await expect(createLocalInstallation({ origin }, f.file, f.environment)).rejects.toThrow("actual installation owner")
  expect(await Bun.file(path.join(f.root, "business-local", "installation.sqlite")).exists()).toBe(false)
})


test("corporate and local sessions never cross profiles or mutate the other profile's existing records", async () => {
  const f = await localAccess()
  const corporate = await openLocalStore(path.join(f.root, "business"))
  const loaded = await loadLocalConfiguration(f.file)
  const person = { id: "0a94c7ea-77f4-4411-84ad-1c7aceb17d82", name: "Corporate fixture account" }
  const client: EntraClient = {
    authorization: async () => "https://login.microsoftonline.com/fixture",
    exchange: async () => ({ person, tokens: { accessToken: "synthetic-token", expiresAt: Date.now() + 3600000 } }),
    refresh: async () => { throw new Error("Unexpected refresh") }, person: async () => person,
    directory: async () => [person], resolve: async () => ({ id: person.id, canWrite: false, roles: [] }),
  }
  const corporateIdentity = createLocalIdentity({ origin, mount: "/sucafina", client, secrets: corporate.secrets, key: loaded.keys.session })
  const begin = await corporateIdentity.handle(new Request(`${origin}/sucafina/auth/login`))
  const loginCookie = begin!.headers.getSetCookie()[0].split(";")[0]
  const state = loginCookie.slice(loginCookie.indexOf("=") + 1)
  const redeemed = await corporateIdentity.handle(new Request(`${origin}/sucafina/auth/callback?state=${state}&code=fixture`, { headers: { cookie: loginCookie } }))
  const corporateCookie = redeemed!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
  expect(await corporateIdentity.person(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie: corporateCookie } }))).toEqual(person)
  await corporate.transaction("dashboard", async (snapshot) => { snapshot.data.marker = "corporate-only"; return { commit: true, value: undefined } })
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  const command = { page: "IT Risks", action: "save", version: 0, values: { name: "Do not cross", impact: 3, probability: 2 } }
  try {
    const login = await installation.handler(new Request(`${origin}/sucafina/auth/local?code=${f.code}`))
    const localCookie = login!.headers.getSetCookie()[0].split(";")[0]
    expect((await installation.handler(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie: corporateCookie } })))?.status).toBe(303)
    expect((await installation.handler(new Request(`${origin}/sucafina/dashboard?page=IT%20Risks`, { method: "POST", headers: { origin, cookie: corporateCookie, "content-type": "application/json" }, body: JSON.stringify(command) })))?.status).toBe(401)
    for (const headers of [
      new Headers({ cookie: localCookie, "content-type": "application/json" }),
      new Headers({ cookie: localCookie, origin, "sec-fetch-site": "cross-site", "content-type": "application/json" }),
    ]) expect((await installation.handler(new Request(`${origin}/sucafina/dashboard`, { method: "POST", headers, body: JSON.stringify(command) })))?.status).toBe(403)
    await f.store.transaction("dashboard", async (snapshot) => { snapshot.data.marker = "local-only"; return { commit: true, value: undefined } })
    const config = await Bun.file(f.file).json()
    config.authentication = "microsoft"
    config.tenantId = "03f7f457-22a4-42bc-9470-4bcf0dd1d652"
    config.clientId = "03f7f457-22a4-42bc-9470-4bcf0dd1d653"
    await Bun.write(f.file, JSON.stringify(config))
    const microsoft = await createLocalInstallation({ origin }, f.file, f.environment)
    try {
      expect((await microsoft.handler(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie: localCookie } })))?.status).toBe(303)
      expect((await microsoft.handler(new Request(`${origin}/sucafina/dashboard?page=IT%20Risks`, { method: "POST", headers: { origin, cookie: localCookie, "content-type": "application/json" }, body: JSON.stringify(command) })))?.status).toBe(401)
    } finally { await microsoft.dispose() }
    await corporate.transaction("dashboard", async (snapshot) => { expect(snapshot.data).toEqual({ marker: "corporate-only" }); expect(snapshot.audit).toEqual([]); return { commit: false, value: undefined } })
    await f.store.transaction("dashboard", async (snapshot) => { expect(Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "localJobState"))).toEqual({ marker: "local-only" }); expect(snapshot.audit).toEqual([]); return { commit: false, value: undefined } })
  } finally { await installation.dispose(); await corporate.dispose(); await f.store.dispose() }
})


test("private maintenance routes enforce local identity, origin and confirmation; logout revokes utility access", async () => {
  const f = await localAccess()
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  try {
    expect((await installation.handler(new Request(`${origin}/sucafina/backups`)))?.status).toBe(303)
    expect((await installation.handler(new Request(`${origin}/sucafina/notifications`)))?.status).toBe(303)
    const enrolled = await installation.handler(new Request(`${origin}/sucafina/auth/local?code=${f.code}`))
    const cookie = enrolled!.headers.getSetCookie()[0].split(";")[0]!
    const post = (body: unknown, extra: Record<string, string> = {}) => installation.handler(new Request(`${origin}/sucafina/backups`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", ...extra }, body: JSON.stringify(body) }))
    expect((await post({ action: "backup-now", values: { surface: "dashboard" } }, { origin: "http://other.example" }))?.status).toBe(403)
    expect((await post({ action: "run-maintenance" }))?.status).toBe(200)
    expect((await post({ action: "backup-now", values: { surface: "dashboard" } }))?.status).toBe(200)
    const page = await installation.handler(new Request(`${origin}/sucafina/backups`, { headers: { cookie } }))
    expect(page?.status).toBe(200)
    expect(page?.headers.get("content-security-policy")).toContain("script-src 'sha256-")
    const html = await page!.text()
    expect(html).toContain("Create backup")
    expect(html).toContain("Restore backup")
    expect((await post({ action: "restore-backup", confirmed: true, version: 0, values: { surface: "dashboard", id: "../escape" } }))?.status).toBe(422)
    expect((await installation.handler(new Request(`${origin}/sucafina/notifications`, { method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify({ ids: ["not-a-message"] }) })))?.status).toBe(422)
    const logout = await installation.handler(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie, origin } }))
    expect(logout?.status).toBe(204)
    expect((await installation.handler(new Request(`${origin}/sucafina/backups`, { headers: { cookie } })))?.status).toBe(303)
    expect((await installation.handler(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie } })))?.status).toBe(303)
    const signedOut = await installation.handler(new Request(`${origin}/sucafina/auth/login`))
    const signedOutHtml = await signedOut!.text()
    expect(signedOutHtml).toContain("Abrir Sucafina")
    expect(signedOutHtml).not.toMatch(/<button\b[^>]*\bdata-logout/)
  } finally { await installation.dispose(); await f.store.dispose() }
})


test("restoration pins a selected old archive before protective capture applies retention", async () => {
  const f = await localAccess()
  const installation = await createLocalInstallation({ origin }, f.file, f.environment)
  try {
    const enrolled = await installation.handler(new Request(`${origin}/sucafina/auth/local?code=${f.code}`))
    const cookie = enrolled!.headers.getSetCookie()[0].split(";")[0]!
    const post = (body: unknown) => installation.handler(new Request(`${origin}/sucafina/backups`, { method: "POST", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify(body) }))
    expect((await post({ action: "run-maintenance" }))?.status).toBe(200)
    await f.store.transaction("dashboard", async (snapshot) => { snapshot.data.selectionProof = "old selected state"; return { commit: true, value: undefined } })
    const backups = await createLocalBackups(path.join(f.root, "backups-local"))
    const old = await backups.capture(f.store, "dashboard", new Date(Date.now() - 40 * 86400000).toISOString())
    await f.store.transaction("dashboard", async (snapshot) => { snapshot.data.selectionProof = "current state"; return { commit: true, value: undefined } })
    const version = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.versions.dataset?.version ?? 0 }))
    const result = await post({ action: "restore-backup", confirmed: true, version, values: { surface: "dashboard", id: old.id } })
    expect(result?.status).toBe(200)
    expect(await result!.json()).toMatchObject({ ok: true })
    expect(await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.selectionProof }))).toBe("old selected state")
    expect(await backups.source.load("dashboard", old.id)).toBeUndefined()
  } finally { await installation.dispose(); await f.store.dispose() }
})
