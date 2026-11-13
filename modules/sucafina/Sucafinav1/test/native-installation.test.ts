import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, lstat, mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import path from "node:path"
import { createNativeInstallation } from "../../src/native-installation.ts"
import type { NativeInstallationOptions } from "../../src/native-installation.ts"
import { createOperatorIdentity } from "../runtime/operator-identity.ts"
import { loadLocalConfiguration, prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { rows } from "../runtime/contract.ts"

const origin = "http://localhost:4110"
const mount = "/api/sucafina"
const landing = "/orchestra/sucafina/dashboard"
const legacyMount = "/sucafina"
const marker = "testtemporaryprivateinstallation"
const riskId = `${marker}-risk`
const riskKey = `risks:${riskId}`
const createdAt = "2026-01-01T00:00:00.000Z"
const secretRaw = `${marker}-raw`
const ownerUid = readOwnerUid()
const ownerName = userInfo().username
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const unconfigured = {
  configured: false,
  authentication: "unconfigured",
  authenticated: false,
  enrollmentRequired: false,
  surfaces: [],
}
const signedOut = {
  configured: true,
  authentication: "local-operator",
  authenticated: false,
  enrollmentRequired: true,
  surfaces: [],
}

test("missing configuration reports unconfigured status and creates no installation files", async () => {
  const root = await privateRoot()
  const before = await listing(root)
  const installation = await createNativeInstallation({ origin, environment: isolated(path.join(root, `${marker}-uncreated`)) })
  try {
    expect(await listing(root)).toEqual(before)
    await absentDatabases(root)
    expect(await installation.handle(new Request(`${origin}/api/sucafina-extra`))).toBeUndefined()
    expect(await readStatus(await installation.handle(statusRequest()))).toEqual(unconfigured)
    const business = expectStatus(await installation.handle(stateRequest("dashboard", "IT Risks")), 503)
    const text = await business.text()
    expect(text).not.toContain("Microsoft 365")
    await expect(installation.enroll()).rejects.toThrow()
    expect(await listing(root)).toEqual(before)
  } finally {
    await installation.dispose()
  }
})

test("configuration without a local-operator profile stays unconfigured and creates no database", async () => {
  const fixture = await prepared()
  const before = await privateBytes(fixture.root)
  const installation = await createNativeInstallation({ configuration: fixture.file, origin, environment: fixture.environment })
  try {
    expect(await readStatus(await installation.handle(statusRequest()))).toEqual(unconfigured)
    expectStatus(await installation.handle(stateRequest("planner", "Overview")), 503)
    await expect(installation.enroll()).rejects.toThrow()
    await absentDatabases(fixture.root)
    expect(await privateBytes(fixture.root)).toEqual(before)
  } finally {
    await installation.dispose()
  }
})

test("a local operator record without the authentication flag writes no database", async () => {
  const fixture = await prepared()
  await configure(fixture.file, { localOperator: { installationId: fixture.installationId, uid: ownerUid, buyer: true } })
  const before = await privateBytes(fixture.root)
  const installation = await createNativeInstallation({ configuration: fixture.file, origin, environment: fixture.environment })
  try {
    expect(await readStatus(await installation.handle(statusRequest()))).toEqual(unconfigured)
    expect(expectStatus(await installation.handle(stateRequest("dashboard", "IT Risks")), 503).status).toBe(503)
    await expect(installation.enroll()).rejects.toThrow()
    await absentDatabases(fixture.root)
    expect(await privateBytes(fixture.root)).toEqual(before)
  } finally {
    await installation.dispose()
  }
})

test("microsoft configuration stays unconfigured and does not serve a fallback page", async () => {
  const fixture = await prepared()
  await configure(fixture.file, { authentication: "microsoft", tenantId: randomUUID(), clientId: randomUUID() })
  const before = await privateBytes(fixture.root)
  const installation = await createNativeInstallation({ configuration: fixture.file, origin, environment: fixture.environment })
  try {
    expect(await readStatus(await installation.handle(statusRequest()))).toEqual(unconfigured)
    const business = expectStatus(await installation.handle(stateRequest("procurement", "Dashboard")), 503)
    const text = await business.text()
    expect(text).not.toContain("Microsoft 365")
    await expect(installation.enroll()).rejects.toThrow()
    await absentDatabases(fixture.root)
    expect(await privateBytes(fixture.root)).toEqual(before)
  } finally {
    await installation.dispose()
  }
})

test("invalid configuration rejects before creating a database", async () => {
  const fixture = await prepared()
  await Bun.write(fixture.file, "{")
  await chmod(fixture.file, 0o600)
  await expectRejected({ configuration: fixture.file, origin, environment: fixture.environment }, fixture.root)
})

test("origin mismatch rejects before creating a database", async () => {
  const fixture = await operatorFixture()
  await expectRejected({ configuration: fixture.file, origin: "http://localhost:4111", environment: fixture.environment }, fixture.root)
})

test("nonisolated environment rejects before creating a database", async () => {
  const fixture = await operatorFixture()
  await expectRejected({ configuration: fixture.file, origin, environment: {} }, fixture.root)
})

test("a different owner UID rejects before creating a database", async () => {
  const fixture = await prepared()
  await configure(fixture.file, {
    authentication: "local-operator",
    localOperator: { installationId: fixture.installationId, uid: ownerUid + 1, buyer: true },
  })
  await expectRejected({ configuration: fixture.file, origin, environment: fixture.environment }, fixture.root)
})

test("startup keeps the preseeded store and serves signed-out local-operator status", async () => {
  const local = await localInstallation()
  try {
    expect(await capture(local.root)).toEqual(local.seeded)
    expect(await privateBytes(local.root)).toEqual(local.files)
    await absentHostDatabases(local.root)
    expect(await local.installation.handle(new Request(`${origin}/api/sucafina-extra`))).toBeUndefined()
    expect(await readStatus(await local.installation.handle(statusRequest()))).toEqual(signedOut)
    const posted = expectStatus(await local.installation.handle(new Request(`${origin}${mount}/status`, { method: "POST" })), 405)
    expect(posted.headers.get("allow")).toBe("GET")
    expect(expectStatus(await local.installation.handle(new Request(`${origin}${mount}`)), 404).status).toBe(404)
    expect(expectStatus(await local.installation.handle(new Request(`${origin}${mount}/unknown`)), 404).status).toBe(404)
    expect(expectStatus(await local.installation.handle(new Request(stateUrl("dashboard", "IT Risks", origin, "download=1"))), 404).status).toBe(404)
    expect(expectStatus(await local.installation.handle(new Request(stateUrl("dashboard", "IT Risks"), { method: "POST", headers: { origin } })), 405).headers.get("allow")).toBe("GET")
    expect(expectStatus(await local.installation.handle(new Request(`${origin}${mount}/dashboard/commands`)), 405).headers.get("allow")).toBe("POST")
    const anonymous = expectStatus(await local.installation.handle(stateRequest("dashboard", "IT Risks")), 401)
    expect(await anonymous.text()).toBe("Authentication required")
    const denied = expectStatus(await local.installation.handle(postCommand(4, { origin })), 401)
    expect(await denied.text()).toBe("Authentication required")
    expect(expectStatus(await local.installation.handle(postCommand(4, {})), 403).status).toBe(403)
    expect(expectStatus(await local.installation.handle(postCommand(4, { origin, "sec-fetch-site": "cross-site" })), 403).status).toBe(403)
    expect(expectStatus(await local.installation.handle(postCommand(4, { origin: "http://localhost:4111" })), 403).status).toBe(403)
    expect(expectStatus(await local.installation.handle(statusRequest(undefined, "http://127.0.0.1:4110")), 403).status).toBe(403)
    const basic = Buffer.from(`${ownerName}:${marker}`).toString("base64")
    expect(await readStatus(await local.installation.handle(new Request(`${origin}${mount}/status`, { headers: { authorization: `Basic ${basic}` } })))).toEqual(signedOut)
    const basicState = expectStatus(await local.installation.handle(new Request(stateUrl("dashboard", "IT Risks"), { headers: { authorization: `Basic ${basic}` } })), 401)
    expect(await basicState.text()).toBe("Authentication required")
    expect(await capture(local.root)).toEqual(local.seeded)
    expect(await privateBytes(local.root)).toEqual(local.files)
  } finally {
    await local.installation.dispose()
  }
})

test("enrollment returns a private one-use artifact path and withholds the credential", async () => {
  const local = await localInstallation()
  try {
    const sentinel = path.join(local.root, "open-local.html")
    await Bun.write(sentinel, `${marker}-sentinel`)
    await chmod(sentinel, 0o600)
    const opened = await openArtifact(local.installation, local.root)
    expect(await Bun.file(sentinel).text()).toBe(`${marker}-sentinel`)
    expect((await readdir(local.root)).filter((name) => name.endsWith(".html")).sort()).toEqual(["open-local.html", "open-native.html"])
    const redeemed = await redeem(local.installation, opened.code)
    expect(redeemed.handle).not.toBe(opened.code)
    expect(JSON.stringify(opened.result)).not.toContain(opened.code)
    expect(JSON.stringify(opened.result)).not.toContain(redeemed.handle)
    const replay = expectAuth(await local.installation.handle(new Request(opened.target.href)), 403)
    expect(replay.headers.getSetCookie()).toEqual([])
    expect(await replay.text()).not.toContain(opened.code)
    const login = expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/login`)), 200)
    expect(login.headers.getSetCookie()).toEqual([])
    const guidance = await login.text()
    expect(guidance.trim().length).toBeGreaterThan(0)
    expect(guidance).not.toContain(opened.code)
    expect(guidance).not.toContain("Microsoft 365 application is not configured")
    expect(expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/enroll`)), 404).status).toBe(404)
    expect(await capture(local.root)).toEqual(local.seeded)
    expect(await privateBytes(local.root)).toEqual(local.files)
  } finally {
    await local.installation.dispose()
  }
})

test("native and legacy cookies and codes stay on their own mounts", async () => {
  const local = await localInstallation()
  const store = await openLocalStore(path.join(local.root, "business-local"))
  try {
    const legacy = createOperatorIdentity({
      origin,
      mount: legacyMount,
      operator: { installationId: local.installationId, uid: ownerUid, name: ownerName, buyer: true },
      key: local.loaded.keys.session,
      secrets: store.secrets,
    })
    const legacyCode = await legacy.enroll()
    const legacyResponse = expectAuth(await legacy.handle(new Request(`${origin}${legacyMount}/auth/local?code=${legacyCode}`)), 303)
    const legacyHeader = legacyResponse.headers.getSetCookie()[0]!
    const legacyPair = legacyHeader.split(";")[0]!
    const native = await redeem(local.installation, (await openArtifact(local.installation, local.root)).code)
    expect(native.pair.split("=")[0]).not.toBe(legacyPair.split("=")[0])
    expect(cookieAttribute(native.header, "Path")).toBe(mount)
    expect(cookieAttribute(legacyHeader, "Path")).toBe(legacyMount)
    expect(await readStatus(await local.installation.handle(statusRequest(legacyPair)))).toEqual(signedOut)
    const legacyState = expectStatus(await local.installation.handle(stateRequest("dashboard", "IT Risks", legacyPair)), 401)
    expect(await legacyState.text()).toBe("Authentication required")
    expect(expectStatus(await local.installation.handle(postCommand(4, { cookie: legacyPair, origin })), 401).status).toBe(401)
    expect(await legacy.person(new Request(`${origin}${legacyMount}/dashboard`, { headers: { cookie: native.pair } }))).toBeNull()
    const unusedLegacy = await legacy.enroll()
    expect(expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/local?code=${unusedLegacy}`)), 403).headers.getSetCookie()).toEqual([])
    const unusedNative = (await openArtifact(local.installation, local.root)).code
    expect(expectAuth(await legacy.handle(new Request(`${origin}${legacyMount}/auth/local?code=${unusedNative}`)), 403).headers.getSetCookie()).toEqual([])
    expect((await readStatus(await local.installation.handle(statusRequest(native.pair)))).authenticated).toBe(true)
    expect(await legacy.person(new Request(`${origin}${legacyMount}/dashboard`, { headers: { cookie: legacyPair } }))).toEqual({
      id: principal(local.installationId).id,
      name: ownerName,
    })
    expect(await capture(local.root)).toEqual(local.seeded)
  } finally {
    await local.installation.dispose()
    await store.dispose()
  }
})

test("authenticated status reports the OS principal and a stable per-session scope", async () => {
  const local = await localInstallation()
  try {
    const firstArtifact = await openArtifact(local.installation, local.root)
    const first = await redeem(local.installation, firstArtifact.code)
    const material = await secretMaterial(local.root, local.loaded, [firstArtifact.code, first.handle])
    const status = await readStatus(await local.installation.handle(statusRequest(first.pair)))
    expect(Object.keys(status).sort()).toEqual(["authenticated", "authentication", "configured", "enrollmentRequired", "principal", "sessionScope", "surfaces"])
    expect(status.configured).toBe(true)
    expect(status.authentication).toBe("local-operator")
    expect(status.authenticated).toBe(true)
    expect(status.enrollmentRequired).toBe(false)
    expect(status.surfaces).toEqual(["dashboard", "planner", "procurement"])
    expect(status.principal).toEqual(principal(local.installationId))
    expect(Object.keys(status.principal ?? {}).sort()).toEqual(["id", "name"])
    const scope = requireScope(status.sessionScope)
    expect(scope).not.toBe(first.handle)
    expectUnlisted(JSON.stringify(status), material)
    const repeated = await readStatus(await local.installation.handle(statusRequest(first.pair)))
    expect(repeated.sessionScope).toBe(scope)
    const secondArtifact = await openArtifact(local.installation, local.root)
    const second = await redeem(local.installation, secondArtifact.code)
    const renewed = await readStatus(await local.installation.handle(statusRequest(second.pair)))
    const nextScope = requireScope(renewed.sessionScope)
    expect(nextScope).not.toBe(scope)
    expect(nextScope).not.toBe(second.handle)
    expect((await readStatus(await local.installation.handle(statusRequest(first.pair)))).sessionScope).toBe(scope)
    expectUnlisted(JSON.stringify(renewed), [...material, secondArtifact.code, second.handle])
    const dashboard = await readPage(await local.installation.handle(stateRequest("dashboard", "IT Risks", first.pair)))
    const planner = await readPage(await local.installation.handle(stateRequest("planner", "Overview", first.pair)))
    const procurement = await readPage(await local.installation.handle(stateRequest("procurement", "Dashboard", first.pair)))
    expect(dashboard.actor).toMatchObject({ id: principal(local.installationId).id, name: ownerName, canWrite: true, roles: ["admin"] })
    expect(planner.actor).toMatchObject({ roles: ["admin"] })
    expect(procurement.actor).toMatchObject({ id: principal(local.installationId).id, name: ownerName, canWrite: true, roles: ["admin", "buyer"] })
    expect(dashboard.directory).toEqual([principal(local.installationId)])
    for (const page of [dashboard, planner, procurement]) expect(page.text).not.toContain(scope)
    expect(await capture(local.root)).toEqual(local.seeded)
  } finally {
    await local.installation.dispose()
  }
})

test("logout duplicate cookies foreign origin and Basic cannot authorize", async () => {
  const local = await localInstallation()
  try {
    const session = await redeem(local.installation, (await openArtifact(local.installation, local.root)).code)
    const scope = requireScope((await readStatus(await local.installation.handle(statusRequest(session.pair)))).sessionScope)
    const getLogout = expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/logout`, { headers: { cookie: session.pair } })), 405)
    expect(await getLogout.text()).not.toContain(scope)
    expect(requireScope((await readStatus(await local.installation.handle(statusRequest(session.pair)))).sessionScope)).toBe(scope)
    for (const headers of [
      new Headers({ cookie: session.pair }),
      new Headers({ cookie: session.pair, origin: "http://localhost:4111" }),
      new Headers({ cookie: session.pair, origin, "sec-fetch-site": "cross-site" }),
    ]) {
      const rejected = expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/logout`, { method: "POST", headers })), 403)
      expect(await rejected.text()).not.toContain(scope)
      expect(requireScope((await readStatus(await local.installation.handle(statusRequest(session.pair)))).sessionScope)).toBe(scope)
    }
    expect(await readStatus(await local.installation.handle(statusRequest(`${session.pair}; ${session.pair}`)))).toEqual(signedOut)
    expect(requireScope((await readStatus(await local.installation.handle(statusRequest(session.pair)))).sessionScope)).toBe(scope)
    const foreign = expectStatus(await local.installation.handle(statusRequest(session.pair, "http://127.0.0.1:4110")), 403)
    expect(await foreign.text()).not.toContain(scope)
    const basic = Buffer.from(`${ownerName}:${marker}`).toString("base64")
    expect(await readStatus(await local.installation.handle(new Request(`${origin}${mount}/status`, { headers: { authorization: `Basic ${basic}` } })))).toEqual(signedOut)
    const logout = expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/logout`, { method: "POST", headers: { cookie: session.pair, origin } })), 204)
    const cleared = logout.headers.getSetCookie()[0] ?? ""
    expect(cleared).toContain("Max-Age=0")
    expect(cookieAttribute(cleared, "Path")).toBe(mount)
    expect(await readStatus(await local.installation.handle(statusRequest(session.pair)))).toEqual(signedOut)
    expect(expectAuth(await local.installation.handle(new Request(`${origin}${mount}/auth/logout`, { method: "POST", headers: { cookie: session.pair, origin } })), 204).status).toBe(204)
    expect(await capture(local.root)).toEqual(local.seeded)
    expect(await privateBytes(local.root)).toEqual(local.files)
  } finally {
    await local.installation.dispose()
  }
})

test("authorized native view and save keep conflicts and rejected writes unchanged", async () => {
  const local = await localInstallation()
  try {
    const session = await redeem(local.installation, (await openArtifact(local.installation, local.root)).code)
    const viewed = await readPage(await local.installation.handle(stateRequest("dashboard", "IT Risks", session.pair)))
    expect(viewed.page).toMatchObject({ surface: "dashboard", page: "IT Risks", year: 2026, month: 1, directory: [principal(local.installationId)] })
    expect(viewed.pages).toContain("IT Risks")
    expect(viewed.text).toContain("Keep risk")
    expect(viewed.text).not.toContain(secretRaw)
    expect(viewed.text).not.toContain(`${marker}-dashboard`)
    expect(viewed.text).not.toContain("<html")
    expect(await capture(local.root)).toEqual(local.seeded)
    const recordVersion = local.seeded.dashboard.versions[riskKey]?.version
    const datasetVersion = local.seeded.dashboard.versions.dataset?.version
    expect(recordVersion).toBe(4)
    expect(datasetVersion).toBe(7)
    const savedResponse = await readJson(await local.installation.handle(postCommand(recordVersion!, { cookie: session.pair, origin }, "Saved risk")))
    expect(savedResponse).toEqual({ ok: true })
    const saved = await capture(local.root)
    expect(saved.planner).toEqual(local.seeded.planner)
    expect(saved.procurement).toEqual(local.seeded.procurement)
    expect(saved.dashboard.notices).toEqual(local.seeded.dashboard.notices)
    expect(saved.dashboard.sequences).toEqual(local.seeded.dashboard.sequences)
    expect(saved.dashboard.data.preservedMarker).toBe(`${marker}-dashboard`)
    expect(saved.dashboard.audit[0]).toEqual(local.seeded.dashboard.audit[0])
    expect(rows(saved.dashboard.data.risks)).toHaveLength(1)
    expect(rows(saved.dashboard.data.risks)[0]).toMatchObject({
      id: riskId,
      name: "Saved risk",
      impact: 3,
      probability: 2,
      status: "open",
      createdAt,
      secretRaw,
    })
    expect(typeof rows(saved.dashboard.data.risks)[0]?.updatedAt).toBe("string")
    expect(saved.dashboard.versions[riskKey]).toEqual({ version: recordVersion! + 1, by: principal(local.installationId).id })
    expect(saved.dashboard.versions.dataset).toEqual({ version: datasetVersion! + 1, by: principal(local.installationId).id })
    expect(saved.dashboard.audit).toHaveLength(local.seeded.dashboard.audit.length + 1)
    expect(saved.dashboard.audit.at(-1)).toMatchObject({
      who: principal(local.installationId).id,
      name: ownerName,
      record: riskKey,
      was: rows(local.seeded.dashboard.data.risks)[0],
    })
    const refreshed = await readPage(await local.installation.handle(stateRequest("dashboard", "IT Risks", session.pair)))
    expect(refreshed.text).toContain("Saved risk")
    expect(refreshed.text).not.toContain(secretRaw)
    expect(await capture(local.root)).toEqual(saved)
    const current = recordVersion! + 1
    const attacks = [
      postCommand(recordVersion!, { cookie: session.pair, origin }, "Stale overwrite"),
      postCommand(current, { cookie: session.pair }, "Missing origin"),
      postCommand(current, { cookie: session.pair, origin: "http://localhost:4111" }, "Wrong origin"),
      postCommand(current, { cookie: session.pair, origin, "sec-fetch-site": "cross-site" }, "Cross site"),
      new Request(`http://127.0.0.1:4110${mount}/dashboard/commands`, {
        method: "POST",
        headers: { cookie: session.pair, origin: "http://127.0.0.1:4110", "content-type": "application/json" },
        body: JSON.stringify(commandBody(current, "Foreign URL")),
      }),
      new Request(`${origin}${mount}/dashboard/commands`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${ownerName}:${marker}`).toString("base64")}`, origin, "content-type": "application/json" },
        body: JSON.stringify(commandBody(current, "Basic overwrite")),
      }),
    ]
    const expected = [409, 403, 403, 403, 403, 401]
    for (const [index, request] of attacks.entries()) {
      const response = expectStatus(await local.installation.handle(request), expected[index]!)
      if (response.status === 401) expect(await response.text()).toBe("Authentication required")
      expect(await capture(local.root)).toEqual(saved)
    }
    expect(await privateBytes(local.root)).toEqual(local.files)
  } finally {
    await local.installation.dispose()
  }
})

test("disposal is idempotent and does not reset the store", async () => {
  const local = await localInstallation()
  try {
    const opened = await openArtifact(local.installation, local.root)
    const session = await redeem(local.installation, opened.code)
    const artifact = await Bun.file(opened.result.artifact).text()
    const before = await capture(local.root)
    await local.installation.dispose()
    await local.installation.dispose()
    expectStatus(await local.installation.handle(statusRequest(session.pair)), 503)
    expectStatus(await local.installation.handle(stateRequest("dashboard", "IT Risks", session.pair)), 503)
    expectStatus(await local.installation.handle(postCommand(4, { cookie: session.pair, origin })), 503)
    await expect(local.installation.enroll()).rejects.toThrow()
    expect(await local.installation.handle(new Request(`${origin}/api/sucafina-extra`))).toBeUndefined()
    expect(await Bun.file(opened.result.artifact).text()).toBe(artifact)
    expect(await privateBytes(local.root)).toEqual(local.files)
    expect(await capture(local.root)).toEqual(before)
    await absentHostDatabases(local.root)
  } finally {
    await local.installation.dispose()
  }
})

test("an in-flight authenticated status resolves unavailable when disposal closes its store", async () => {
  const local = await localInstallation()
  try {
    const opened = await openArtifact(local.installation, local.root)
    const session = await redeem(local.installation, opened.code)
    const before = await capture(local.root)
    const pending = local.installation.handle(statusRequest(session.pair))
    const closing = local.installation.dispose()
    expectStatus(await pending, 503)
    await closing
    await expect(local.installation.enroll()).rejects.toThrow()
    expect(await capture(local.root)).toEqual(before)
    expect(await privateBytes(local.root)).toEqual(local.files)
    await absentHostDatabases(local.root)
  } finally {
    await local.installation.dispose()
  }
})

async function privateRoot() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), `${marker}-`))
  roots.push(root)
  await chmod(root, 0o700)
  return root
}

function isolated(root: string): NativeInstallationOptions["environment"] {
  return {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
    ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"),
    XDG_DATA_HOME: path.join(root, "host-data"),
    XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"),
    XDG_STATE_HOME: path.join(root, "host-state"),
  }
}

async function prepared() {
  const root = await privateRoot()
  return { root, file: await prepareLocalConfiguration(root), environment: isolated(root), installationId: randomUUID() }
}

async function operatorFixture() {
  const fixture = await prepared()
  await configure(fixture.file, {
    authentication: "local-operator",
    localOperator: { installationId: fixture.installationId, uid: ownerUid, buyer: true },
  })
  return fixture
}

async function localInstallation() {
  const fixture = await operatorFixture()
  await preseed(fixture.root)
  const seeded = await capture(fixture.root)
  const files = await privateBytes(fixture.root)
  const loaded = await loadLocalConfiguration(fixture.file)
  const installation = await createNativeInstallation({ configuration: fixture.file, origin, environment: fixture.environment })
  return { ...fixture, seeded, files, loaded, installation }
}

async function configure(file: string, patch: Record<string, unknown>) {
  const value: unknown = await Bun.file(file).json()
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Installation configuration was not an object")
  await Bun.write(file, JSON.stringify(Object.assign({}, value, patch)))
  await chmod(file, 0o600)
}

async function preseed(root: string) {
  const store = await openLocalStore(path.join(root, "business-local"))
  try {
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.preservedMarker = `${marker}-dashboard`
      snapshot.data.risks = [{ id: riskId, name: "Keep risk", impact: 2, probability: 2, status: "open", createdAt, secretRaw }]
      snapshot.versions[riskKey] = { version: 4, by: `${marker}-earlier` }
      snapshot.versions.dataset = { version: 7, by: `${marker}-earlier` }
      snapshot.sequences.risk = 11
      snapshot.audit.push({ who: `${marker}-earlier`, at: createdAt, record: riskKey, was: null, became: { name: "Keep risk" } })
      snapshot.notices.push({ kind: "pending", to: [marker], record: riskKey, at: createdAt })
      return { commit: true, value: undefined }
    })
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.preservedMarker = `${marker}-planner`
      snapshot.versions.dataset = { version: 2, by: `${marker}-earlier` }
      snapshot.sequences.planner = 3
      return { commit: true, value: undefined }
    })
    await store.transaction("procurement", async (snapshot) => {
      snapshot.data.preservedMarker = `${marker}-procurement`
      snapshot.versions.dataset = { version: 5, by: `${marker}-earlier` }
      snapshot.sequences.procurement = 8
      snapshot.notices.push({ kind: "approved", to: [marker], record: `${marker}-notice`, at: createdAt })
      return { commit: true, value: undefined }
    })
  } finally {
    await store.dispose()
  }
}

async function capture(root: string) {
  const store = await openLocalStore(path.join(root, "business-local"))
  try {
    return {
      dashboard: await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
      planner: await store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
      procurement: await store.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    }
  } finally {
    await store.dispose()
  }
}

async function expectRejected(options: NativeInstallationOptions, root: string) {
  const opened = await createNativeInstallation(options).then(
    (installation) => ({ installation, error: undefined as unknown }),
    (error: unknown) => ({ installation: undefined, error }),
  )
  await absentDatabases(root)
  if (opened.installation) await opened.installation.dispose()
  expect(opened.error).toBeInstanceOf(Error)
}

async function absentDatabases(root: string) {
  await absentHostDatabases(root)
  expect(await Bun.file(path.join(root, "business-local", "installation.sqlite")).exists()).toBe(false)
}

async function absentHostDatabases(root: string) {
  expect(await Bun.file(path.join(root, "host-data", "orchestra.db")).exists()).toBe(false)
  expect(await Bun.file(path.join(root, "business", "installation.sqlite")).exists()).toBe(false)
}

async function listing(root: string) {
  return (await readdir(root)).sort()
}

async function privateBytes(root: string) {
  const names = ["installation.json", "session.key", "bank.key", "assets.key", "host-credential.key"]
  const entries = await Promise.all(names.map(async (name) => [name, Buffer.from(await Bun.file(path.join(root, name)).arrayBuffer()).toString("base64")] as const))
  return Object.fromEntries(entries)
}

async function secretMaterial(root: string, loaded: Awaited<ReturnType<typeof loadLocalConfiguration>>, extra: string[]) {
  const host = (await Bun.file(path.join(root, "host-credential.key")).text()).trim()
  return [root, host, Buffer.from(loaded.keys.session).toString("hex"), Buffer.from(loaded.keys.bank).toString("hex"), Buffer.from(loaded.keys.assets).toString("hex"), ...extra]
}

function readOwnerUid() {
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Native installation acceptance requires the OS owner UID")
  return uid
}

function principal(installationId: string) {
  return { id: `macos:${installationId}:${ownerUid}`, name: ownerName }
}

function statusRequest(cookie?: string, base = origin) {
  const headers = new Headers()
  if (cookie) headers.set("cookie", cookie)
  return new Request(`${base}${mount}/status`, { headers })
}

function stateRequest(surface: string, page: string, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.set("cookie", cookie)
  return new Request(stateUrl(surface, page), { headers })
}

function stateUrl(surface: string, page: string, base = origin, extra = "") {
  const query = new URLSearchParams({ page, year: "2026", month: "1" })
  if (extra) query.set(extra.split("=")[0]!, extra.split("=")[1]!)
  return `${base}${mount}/${surface}/state?${query}`
}

function commandBody(version: number, name: string) {
  return { page: "IT Risks", action: "save", id: riskId, version, values: { name, impact: 3, probability: 2 } }
}

function postCommand(version: number, headers: Record<string, string>, name = "Saved risk") {
  return new Request(`${origin}${mount}/dashboard/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(commandBody(version, name)),
  })
}

function expectStatus(response: Response | undefined, status: number) {
  if (!(response instanceof Response)) throw new Error("HTTP response required")
  expect(response.status).toBe(status)
  expect(response.headers.get("cache-control")).toBe("no-store")
  return response
}

function expectAuth(response: Response | undefined, status: number) {
  const http = expectStatus(response, status)
  expect(http.headers.get("referrer-policy")).toBe("no-referrer")
  expect(http.headers.get("x-content-type-options")).toBe("nosniff")
  return http
}

async function readStatus(response: Response | undefined) {
  const http = expectStatus(response, 200)
  expect(http.headers.get("content-type")).toContain("application/json")
  const body: unknown = await http.json()
  if (!body || typeof body !== "object") throw new Error("Status JSON required")
  return body as {
    configured: boolean
    authentication: string
    authenticated: boolean
    enrollmentRequired: boolean
    surfaces: string[]
    principal?: { id: string; name: string }
    sessionScope?: string
  }
}

async function readJson(response: Response | undefined) {
  const http = expectStatus(response, 200)
  expect(http.headers.get("content-type")).toContain("application/json")
  const body: unknown = await http.json()
  if (!body || typeof body !== "object") throw new Error("JSON object required")
  return body
}

async function readPage(response: Response | undefined) {
  const http = expectStatus(response, 200)
  expect(http.headers.get("content-type")).toContain("application/json")
  const text = await http.text()
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== "object") throw new Error("Page JSON required")
  const page = parsed as Record<string, unknown>
  const pages = page.pages
  return { text, page, pages: Array.isArray(pages) ? pages : [], actor: page.actor, directory: page.directory }
}

function requireScope(scope: string | undefined) {
  if (!scope || !/^[a-f0-9]{64}$/.test(scope)) throw new Error("Authenticated session scope required")
  return scope
}

function expectUnlisted(serialized: string, values: string[]) {
  for (const value of values) {
    expect(value.length).toBeGreaterThan(0)
    expect(serialized).not.toContain(value)
  }
}

function cookieAttribute(header: string, name: string) {
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
}

async function openArtifact(installation: Awaited<ReturnType<typeof createNativeInstallation>>, root: string) {
  const result = await installation.enroll()
  expect(Object.keys(result)).toEqual(["artifact"])
  expect(result.artifact).toBe(path.join(root, "open-native.html"))
  const metadata = await lstat(result.artifact)
  expect(metadata.isSymbolicLink()).toBe(false)
  expect(metadata.isFile()).toBe(true)
  expect(metadata.mode & 0o777).toBe(0o600)
  expect(metadata.uid).toBe(ownerUid)
  const html = await Bun.file(result.artifact).text()
  expect(html).toContain('name="referrer" content="no-referrer"')
  const encoded = html.match(/location\.replace\(("[^\n]+")\)/)?.[1]
  if (!encoded) throw new Error("Enrollment artifact did not publish a replacement navigation")
  const target = new URL(JSON.parse(encoded), origin)
  expect(target.origin).toBe(origin)
  expect(target.pathname).toBe(`${mount}/auth/local`)
  const code = target.searchParams.get("code") ?? ""
  expect(target.searchParams.getAll("code")).toEqual([code])
  expect(code).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(result)).not.toContain(code)
  return { result, target, code }
}

async function redeem(installation: Awaited<ReturnType<typeof createNativeInstallation>>, code: string) {
  const response = expectAuth(await installation.handle(new Request(`${origin}${mount}/auth/local?code=${code}`)), 303)
  const location = response.headers.get("location") ?? ""
  const landed = new URL(location, origin)
  expect(landed.origin).toBe(origin)
  expect(landed.pathname).toBe(landing)
  expect(location).not.toContain(code)
  const body = await response.text()
  expect(body).not.toContain(code)
  const header = response.headers.getSetCookie()[0]
  if (!header) throw new Error("Native session cookie required")
  expect(header).toContain("HttpOnly")
  expect(header).toContain("SameSite=Lax")
  expect(header).toContain("Max-Age=28800")
  expect(cookieAttribute(header, "Path")).toBe(mount)
  const pair = header.split(";")[0]!
  const handle = pair.slice(pair.indexOf("=") + 1)
  expect(handle).toMatch(/^[a-f0-9]{64}$/)
  expect(handle).not.toBe(code)
  expect(location).not.toContain(handle)
  expect(body).not.toContain(handle)
  return { header, pair, handle }
}
