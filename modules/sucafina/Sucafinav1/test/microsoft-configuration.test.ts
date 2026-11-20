import { afterEach, expect, test } from "bun:test"
import { chmod, link, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { bindMicrosoftInstallation, loadMicrosoftConfiguration, validateMicrosoftConfiguration } from "../runtime/microsoft-configuration.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import { microsoftFixture, other, oid, group, syntheticSecret } from "./microsoft-login/oidc-fixture.ts"
import { privateFixture, listenerOrigin, publicOrigin, ingressOrigin } from "./microsoft-login/private-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { await Promise.all(cleanups.splice(0).map((close) => close())) })
async function fixture() { const f = await privateFixture(); cleanups.push(f.close); return f }

test("Microsoft configuration is explicit, immutable, minimal and separate from the agent workspace", async () => {
  const f = await fixture()
  const loaded = await loadMicrosoftConfiguration(f.file)
  expect(loaded.config.origin).toBe(publicOrigin)
  expect(loaded.config.grants).toEqual([])
  expect(loaded.config.groups.dashboard.viewer).toBe(`group:${group}`)
  expect(Object.isFrozen(loaded.config)).toBe(true)
  expect(Object.isFrozen(loaded.config.groups.dashboard)).toBe(true)
  expect(Object.isFrozen(loaded.config.grants)).toBe(true)
  expect(loaded.config).not.toHaveProperty("teams")
  expect(loaded.config).not.toHaveProperty("clientSecret")
  expect(JSON.stringify(loaded)).not.toContain(syntheticSecret)
  expect(await loaded.clientSecret()).toBe(syntheticSecret)
  expect(await Bun.file(path.join(f.directory, "business-microsoft", "installation.sqlite")).exists()).toBe(false)
})

test("missing, unsafe, legacy or incoherent Microsoft configuration fails closed", async () => {
  const f = await fixture()
  for (const mutation of [
    { deployment: undefined }, { authentication: "local-operator" }, { tenantId: null }, { tenantId: "common" }, { clientId: "" },
    { origin: "http://mvp.example.test" }, { origin: "https://localhost" }, { origin: "https://localhost." }, { origin: "https://mvp.localhost." }, { origin: "https://127.0.0.1" }, { origin: "https://mvp.example.test/path" },
    { origin: "https://user:pass@mvp.example.test" }, { ingressOrigin: "https://mvp.example.test" }, { listenerOrigin: undefined },
    { mount: "/sucafina/../api" }, { workspaceDirectory: "./workspace" }, { scanner: {} }, { scanner: { host: "external.example", port: 3310 } },
    { groups: {} }, { groups: { dashboard: { admin: "Administrator name" }, planner: {}, procurement: {} } },
    { groups: { dashboard: { administrator: `group:${group}` }, planner: {}, procurement: {} } },
    { grants: undefined }, { grants: [{ principalRef: "person@example.test", namespaces: [], operations: [] }] },
    { grants: [{ principalRef: oid, namespaces: ["root"], operations: [] }] }, { grants: [{ principalRef: oid, namespaces: [], operations: ["sf_admin_everything"] }] },
    { grants: [{ principalRef: oid, namespaces: [], operations: [], humanActions: ["approve.everything"] }] },
    { grants: [{ principalRef: oid, namespaces: [], operations: [] }, { principalRef: oid.toUpperCase(), namespaces: [], operations: [] }] },
    { teams: undefined }, { teams: null }, { teams: false }, { teams: true }, { teams: "all" }, { teams: "Direct" }, { teams: {} },
    { supremeAdminGroupId: undefined }, { supremeAdminGroupId: null }, { supremeAdminGroupId: "Administrators" }, { supremeAdminGroupId: `group:${group}` }, { supremeAdminGroupId: {} },
    { sessionSeconds: 28801 }, { sessionSeconds: 0 }, { loginSeconds: 601 }, { localOperator: { uid: 0 } }, { clientSecret: syntheticSecret },
  ]) expect(() => validateMicrosoftConfiguration({ ...f.config, ...mutation })).toThrow()
  for (const value of [undefined, null, [], "", {}]) expect(() => validateMicrosoftConfiguration(value)).toThrow()
  await expect(prepareMicrosoftInstallation({ origin: listenerOrigin }, undefined, f.environment)).rejects.toThrow()
  await expect(prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, { ...f.environment, SUCAFINA_LOCAL_CONFIG: "local.json" })).rejects.toThrow()
  await expect(prepareMicrosoftInstallation({ origin: "http://127.0.0.1:4111" }, f.file, f.environment)).rejects.toThrow()
  await expect(prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, {})).rejects.toThrow()
  expect(await Bun.file(path.join(f.directory, "microsoft-identity.json")).exists()).toBe(false)
})

test("private files reject permissive modes, symlinks, hardlinks and missing credentials", async () => {
  const f = await fixture()
  await chmod(f.file, 0o644)
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
  await chmod(f.file, 0o600)
  const secret = path.join(f.directory, "client-secret.txt")
  await rm(secret)
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
  await writeFile(path.join(f.directory, "other.txt"), syntheticSecret, { mode: 0o600 })
  await symlink(path.join(f.directory, "other.txt"), secret)
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
  await rm(secret)
  await link(path.join(f.directory, "other.txt"), secret)
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
  await rm(secret)
  await writeFile(secret, "x".repeat(4097), { mode: 0o600 })
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
  await rm(secret)
  await writeFile(secret, syntheticSecret, { mode: 0o600 })
  await writeFile(path.join(f.directory, "bank.key"), await readFile(path.join(f.directory, "session.key")))
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow("Independent")
})

test("credentials cannot be placed in, above or aliased into the configured workspace", async () => {
  const f = await fixture()
  const child = path.join(f.directory, "workspace")
  await mkdir(child, { mode: 0o700 })
  for (const workspaceDirectory of [f.directory, f.root, child]) {
    await writeFile(f.file, JSON.stringify({ ...f.config, workspaceDirectory }))
    await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
  }
  const alias = path.join(f.root, "alias")
  await symlink(f.workspaceDirectory, alias)
  await writeFile(f.file, JSON.stringify({ ...f.config, workspaceDirectory: alias }))
  await expect(loadMicrosoftConfiguration(f.file)).rejects.toThrow()
})

test("durable tenant/client pin prevents cross-tenant reuse after a configuration change", async () => {
  const f = await fixture()
  const loaded = await loadMicrosoftConfiguration(f.file)
  await bindMicrosoftInstallation(loaded.directory, loaded.config)
  await bindMicrosoftInstallation(loaded.directory, loaded.config)
  for (const change of [{ tenantId: other }, { clientId: other }]) await expect(bindMicrosoftInstallation(loaded.directory, validateMicrosoftConfiguration({ ...f.config, ...change }))).rejects.toThrow("identity cannot change")
  const pin = JSON.parse(await readFile(path.join(f.directory, "microsoft-identity.json"), "utf8"))
  expect(pin.tenantId).toBe(f.config.tenantId)
  const second = await fixture()
  await mkdir(path.join(second.directory, "business-microsoft"), { mode: 0o700 })
  await expect(bindMicrosoftInstallation(second.directory, validateMicrosoftConfiguration(second.config))).rejects.toThrow("cannot be adopted")
})

test("explicit principal grants preserve canonical operations without granting roles", async () => {
  const f = await fixture()
  const configured = validateMicrosoftConfiguration({ ...f.config, grants: [{ principalRef: oid, namespaces: ["preferences"], operations: ["sf_work_list"], humanActions: ["views.read"] }] })
  expect(configured.grants).toEqual([{ principalRef: oid, namespaces: ["preferences"], operations: ["sf_work_list"], humanActions: ["views.read"] }])
  expect(configured.groups.dashboard).toEqual(f.config.groups.dashboard)
  expect(configured.grants.find((grant) => grant.principalRef === other)).toBeUndefined()
})

test("fixed proxy transport never infers the public origin from forwarded headers", async () => {
  const f = await fixture()
  const provider = await microsoftFixture()
  const profile = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  const translated = microsoftRequest(new Request(`${ingressOrigin}/sucafina/dashboard?page=IT%20Risks`, { headers: { host: new URL(ingressOrigin).host, forwarded: "host=evil.example;proto=https", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" } }), profile.transport)
  expect(translated?.url).toBe(`${publicOrigin}/sucafina/dashboard?page=IT%20Risks`)
  expect(translated?.headers.has("forwarded")).toBe(false)
  expect(translated?.headers.has("x-forwarded-proto")).toBe(false)
  expect(microsoftRequest(new Request("http://evil.example/sucafina/dashboard", { headers: { host: "evil.example", "x-forwarded-host": new URL(ingressOrigin).host } }), profile.transport)).toBeUndefined()
  expect(microsoftRequest(new Request(`${ingressOrigin}/sucafina/dashboard`, { headers: { host: "evil.example" } }), profile.transport)).toBeUndefined()
  const post = microsoftRequest(new Request(`${ingressOrigin}/sucafina/auth/logout`, { method: "POST", headers: { host: new URL(ingressOrigin).host, origin: publicOrigin }, body: "fixture-body" }), profile.transport)
  expect(post?.headers.get("origin")).toBe(publicOrigin)
  expect(await post?.text()).toBe("fixture-body")
})

test("Microsoft factory keeps minimum login scopes when Teams reading is not configured", async () => {
  const f = await fixture()
  const provider = await microsoftFixture()
  const profile = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  expect(profile.loaded.config).not.toHaveProperty("teams")
  expect(profile.client).not.toHaveProperty("teams")
  expect(profile.client).not.toHaveProperty("joinedTeams")
  const authorization = new URL(await profile.client.authorization({
    state: "synthetic-state", nonce: "synthetic-nonce", challenge: "synthetic-challenge",
    redirectUri: `${publicOrigin}/sucafina/auth/callback`,
  }))
  expect(authorization.searchParams.get("scope")).toBe("openid profile offline_access User.Read")
  expect(profile.loaded.config.groups).toEqual(f.config.groups)
  expect(profile.grants).toEqual([])
  expect(provider.requests.every((request) => new URL(request.url).origin === "https://login.microsoftonline.com")).toBe(true)
  expect(await Bun.file(path.join(f.directory, "business-microsoft", "installation.sqlite")).exists()).toBe(false)
})

test("explicit Teams reading is reversible without changing the installation identity or access policy", async () => {
  const f = await fixture()
  const provider = await microsoftFixture({ teams: "direct" })
  const baseline = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  const pin = await readFile(path.join(f.directory, "microsoft-identity.json"), "utf8")
  const groups = { dashboard: {}, planner: {}, procurement: {} }
  await writeFile(f.file, JSON.stringify({ ...f.config, teams: "direct", groups }))
  const enabled = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  expect(enabled.loaded.config.teams).toBe("direct")
  expect(enabled.client.teams).toBe("direct")
  expect(typeof enabled.client.joinedTeams).toBe("function")
  expect(Object.isFrozen(enabled.loaded.config)).toBe(true)
  expect(enabled.loaded.config.groups).toEqual(groups)
  expect(enabled.grants).toEqual([])
  const input = { state: "synthetic-state", nonce: "synthetic-nonce", challenge: "synthetic-challenge", redirectUri: `${publicOrigin}/sucafina/auth/callback` }
  expect(new URL(await enabled.client.authorization(input)).searchParams.get("scope")).toBe("openid profile offline_access User.Read Team.ReadBasic.All")
  expect(await readFile(path.join(f.directory, "microsoft-identity.json"), "utf8")).toBe(pin)
  // The configured capability is fixed for each prepared installation, not read from later requests.
  expect(baseline.client).not.toHaveProperty("joinedTeams")
  expect(new URL(await baseline.client.authorization(input)).searchParams.get("scope")).toBe("openid profile offline_access User.Read")

  await writeFile(f.file, JSON.stringify({ ...f.config, groups }))
  const disabled = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  expect(disabled.loaded.config).not.toHaveProperty("teams")
  expect(disabled.client).not.toHaveProperty("teams")
  expect(disabled.client).not.toHaveProperty("joinedTeams")
  expect(new URL(await disabled.client.authorization(input)).searchParams.get("scope")).toBe("openid profile offline_access User.Read")
  expect(disabled.loaded.config.groups).toEqual(groups)
  expect(disabled.grants).toEqual([])
  expect(await readFile(path.join(f.directory, "microsoft-identity.json"), "utf8")).toBe(pin)
  expect(provider.requests.every((request) => new URL(request.url).origin === "https://login.microsoftonline.com")).toBe(true)
  expect(await Bun.file(path.join(f.directory, "business-microsoft", "installation.sqlite")).exists()).toBe(false)
})

test("supreme administration policy is explicit, canonical and read fresh independently of Teams", async () => {
  const f = await fixture()
  await writeFile(f.file, JSON.stringify({ ...f.config, supremeAdminGroupId: other.toUpperCase() }))
  const provider = await microsoftFixture()
  const profile = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  expect(profile.loaded.config.supremeAdminGroupId).toBe(other)
  expect(await profile.readTeamProfilePolicy()).toEqual({ supremeAdminGroupId: other })
  expect(profile.client.joinedTeams).toBeUndefined()
  await writeFile(f.file, JSON.stringify({ ...f.config, supremeAdminGroupId: group, teams: "direct" }))
  expect(await profile.readTeamProfilePolicy()).toEqual({ supremeAdminGroupId: group, teams: "direct" })
  expect(profile.loaded.config.supremeAdminGroupId).toBe(other)
  expect(profile.client.joinedTeams).toBeUndefined()
  await writeFile(f.file, JSON.stringify(f.config))
  expect(await profile.readTeamProfilePolicy()).toEqual({})
})

test("current policy cannot retarget the captured installation or replace its private keys", async () => {
  const f = await fixture()
  const provider = await microsoftFixture()
  const profile = await prepareMicrosoftInstallation({ origin: listenerOrigin }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  const workspaceDirectory = path.join(f.root, "second-workspace")
  await mkdir(workspaceDirectory, { mode: 0o700 })
  for (const mutation of [
    { tenantId: other }, { clientId: other }, { origin: "https://another.example.test" },
    { mount: "/other" }, { listenerOrigin: "http://127.0.0.1:4999" }, { ingressOrigin: "http://another.example.test" },
    { workspaceDirectory },
  ]) {
    await writeFile(f.file, JSON.stringify({ ...f.config, ...mutation }))
    await expect(profile.readTeamProfilePolicy()).rejects.toThrow("binding changed")
  }
  await writeFile(f.file, JSON.stringify(f.config))
  const bankKey = await readFile(path.join(f.directory, "bank.key"))
  bankKey[0] ^= 1
  await writeFile(path.join(f.directory, "bank.key"), bankKey)
  await expect(profile.readTeamProfilePolicy()).rejects.toThrow("keys changed")
})
