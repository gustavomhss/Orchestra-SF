import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../index.ts"
import type { Application } from "../runtime/application.ts"
import { object } from "../runtime/contract.ts"
import type { Surface } from "../src/identity.ts"
import { emptyMap } from "../src/identity.ts"
import { initialProcurementSettings } from "../src/initial-settings.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import { microsoftPolicy } from "../runtime/microsoft-policy.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { createSfProductAuthority, type SfProductGrant } from "../product/integration/product-authority.ts"
import { microsoftFixture, oid, other } from "./microsoft-login/oidc-fixture.ts"
import { privateFixture, listenerOrigin, ingressOrigin, publicOrigin } from "./microsoft-login/private-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

/** Actual private store + signed OIDC + module HTTP routes; no substituted authenticator or domain. */
async function fixture() {
  const disk = await privateFixture()
  cleanups.push(disk.close)
  const provider = await microsoftFixture({ claims: { name: "Same synthetic display name", email: "same-synthetic@example.test", preferred_username: "same-synthetic@example.test", roles: ["admin"] } })
  provider.account.name = "Same synthetic display name"
  provider.second.name = provider.account.name
  const profile = await prepareMicrosoftInstallation({ origin: listenerOrigin }, disk.file, disk.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })
  const store = await openLocalStore(path.join(disk.directory, "business-microsoft"))
  cleanups.pop()
  cleanups.push(async () => { await store.dispose(); await disk.close() })
  const identity = profile.createIdentity(store.secrets)
  // Test setup represents an existing operator-configured product map, never a callback-derived grant.
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await store.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = emptyMap().filter((row) => row.surface === surface).map((row) => ({ ...row, entra: profile.loaded.config.groups[surface][row.role] ?? null, version: 1, by: "synthetic-server-configuration" }))
      if (surface === "procurement") snapshot.data.store = { settings: initialProcurementSettings(), issued: { pr: [], po: [] }, sup: [], suppliers: [], requests: {}, actCalls: 0, lastIssued: null }
      return { commit: true, value: undefined }
    })
  }
  const environment: Application["environment"] = async (request) => ({ at: new Date(provider.clock.value).toISOString(), id: randomUUID, directory: await identity.directory(request), bankKey: profile.loaded.keys.bank })
  const business = createModule("/sucafina", {
    persistence: store,
    authenticate: identity.authenticate,
    environment,
    maxJsonBytes: 2 * 1024 * 1024,
  })
  const dispatch = async (incoming: Request) => {
    const request = microsoftRequest(incoming, profile.transport)
    if (!request) return new Response("Access denied", { status: 403 })
    const authentication = await identity.handle(request)
    if (authentication) return authentication
    await identity.prepare(request)
    return await business(request) ?? new Response("Not found", { status: 404 })
  }
  const request = (suffix: string, cookie?: string, body?: Record<string, unknown>) => dispatch(new Request(`${ingressOrigin}/sucafina${suffix}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { host: new URL(ingressOrigin).host, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { origin: publicOrigin, "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }))
  const login = async (user = oid) => {
    const started = await request("/auth/login")
    expect(started.status).toBe(303)
    const location = started.headers.get("location")!
    const state = new URL(location).searchParams.get("state")!
    const code = await provider.issueCode(location, user)
    const loginCookie = started.headers.getSetCookie().find((cookie) => cookie.includes("_login="))!.split(";")[0]
    const callback = await request(`/auth/callback?state=${state}&code=${encodeURIComponent(code)}`, loginCookie)
    expect(callback.status).toBe(303)
    return callback.headers.getSetCookie().find((cookie) => cookie.includes("_session="))!.split(";")[0]
  }
  const snapshot = (surface: Surface) => store.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const post = (cookie: string, action: string, values: Record<string, unknown>, id?: string, version = 0) => request("/procurement", cookie, { page: "Requests", action, values, version, ...(id ? { id } : {}) })
  return { provider, store, identity, profile, environment, request, login, snapshot, post }
}

test("real Microsoft-authenticated dashboard route grants only its assigned viewer role", async () => {
  const f = await fixture()
  const cookie = await f.login()
  const dashboard = await f.request("/dashboard?page=Executive%20Dashboard", cookie)
  expect(dashboard.status).toBe(200)
  const html = await dashboard.text()
  expect(html).toContain('data-page="Executive Dashboard"')
  expect(html).not.toContain("synthetic-access-")
  expect(html).not.toContain("synthetic-refresh-")
  expect(html).not.toContain("same-synthetic@example.test")
  expect((await f.request("/dashboard?page=Talent%20Review", cookie)).status).toBe(403)
  expect((await f.request("/planner", cookie)).status).toBe(401)
  const before = await f.snapshot("dashboard")
  const write = await f.request("/dashboard", cookie, { page: "Executive Dashboard", action: "configure-summaries", version: 0, values: { pages: ["Talent Review"] } })
  expect(write.status).toBe(403)
  expect(await f.snapshot("dashboard")).toEqual(before)
  expect((await f.request("/dashboard?page=Executive%20Dashboard")).status).toBe(401)
})

test("actual routes deny a signed-in guest with no group role and revalidate role removal", async () => {
  const f = await fixture()
  const cookie = await f.login()
  expect((await f.request("/dashboard", cookie)).status).toBe(200)
  expect((await f.request("/procurement?page=Requests", cookie)).status).toBe(200)
  const before = await f.snapshot("procurement")
  f.provider.account.groups.splice(0)
  const unassignedCookie = await f.login()
  for (const current of [cookie, unassignedCookie]) {
    expect((await f.request("/dashboard", current)).status).toBe(401)
    expect((await f.request("/procurement?page=Requests", current)).status).toBe(401)
    expect((await f.post(current, "create", { pr: { title: "Must not exist" } })).status).toBe(401)
  }
  expect(await f.snapshot("procurement")).toEqual(before)
  // A different, still-assigned immutable object retains its own access despite identical name/email claims.
  expect((await f.request("/procurement?page=Requests", await f.login(other))).status).toBe(200)
})

test("actual Procurement HTTP ownership uses resource-tenant oid despite matching names and email claims", async () => {
  const f = await fixture()
  const first = await f.login()
  const second = await f.login(other)
  const firstTitle = "PRIVATE-SYNTHETIC-REQUEST-A"
  const secondTitle = "PRIVATE-SYNTHETIC-REQUEST-B"
  const pr = (title: string) => ({ title, type: "product", description: `${title}-DETAIL`, estAmount: 100, costCenter: "IT", needBy: "2026-12-01", justification: `${title}-JUSTIFICATION`, recurring: false, expenseType: "CAPEX" })
  expect((await f.post(first, "create", { pr: pr(firstTitle), createdBy: other, requesterName: "Forged actor" })).status).toBe(200)
  expect((await f.post(second, "create", { pr: pr(secondTitle) })).status).toBe(200)
  const created = await f.snapshot("procurement")
  const requests = object(object(created.data.store).requests)
  const ids = Object.keys(requests)
  expect(ids).toHaveLength(2)
  const firstId = ids.find((id) => object(object(requests[id]).request).createdBy === oid)!
  const secondId = ids.find((id) => object(object(requests[id]).request).createdBy === other)!
  expect(firstId).toBeTruthy()
  expect(secondId).toBeTruthy()
  expect(firstId).not.toBe(secondId)
  expect(object(object(requests[firstId]).request)).toMatchObject({ createdBy: oid, requesterName: f.provider.account.name, pr: { title: firstTitle } })
  expect(object(object(requests[secondId]).request)).toMatchObject({ createdBy: other, requesterName: f.provider.second.name, pr: { title: secondTitle } })
  expect(created.audit.map((entry) => entry.who)).toEqual([oid, other])
  expect(created.audit.every((entry) => entry.name === f.provider.account.name)).toBe(true)
  expect(JSON.stringify(created)).not.toContain("same-synthetic@example.test")
  expect(JSON.stringify(created)).not.toContain("synthetic-access-")
  expect(JSON.stringify(created)).not.toContain("synthetic-refresh-")

  for (const [cookie, visibleId, visibleTitle, hiddenId, hiddenTitle] of [
    [first, firstId, firstTitle, secondId, secondTitle],
    [second, secondId, secondTitle, firstId, firstTitle],
  ] as const) {
    for (const suffix of ["/procurement?page=Requests", "/procurement?download=register"]) {
      const response = await f.request(suffix, cookie)
      expect(response.status).toBe(200)
      const body = await response.text()
      expect(body).toContain(visibleTitle)
      expect(body).toContain(visibleId)
      expect(body).not.toContain(hiddenTitle)
      expect(body).not.toContain(hiddenId)
    }
    const deepLink = await f.request(`/procurement?page=Requests&request=${encodeURIComponent(hiddenId)}`, cookie)
    expect(deepLink.status).toBe(200)
    expect(await deepLink.text()).not.toContain(hiddenTitle)
  }

  const before = await f.snapshot("procurement")
  const denied = await f.post(first, "save", { pr: { title: "ATTACKER-REPLACEMENT" } }, secondId, 1)
  // Inaccessible records must be indistinguishable from absent records, regardless of version.
  expect(denied.status).toBe(404)
  expect(await denied.text()).not.toContain(secondTitle)
  const stale = await f.post(first, "save", { pr: { title: "ATTACKER-STALE" } }, secondId, 0)
  expect(stale.status).toBe(404)
  const conflict = await stale.text()
  expect(conflict).not.toContain(secondTitle)
  expect(conflict).not.toContain("stored")
  const spoofed = await f.request("/procurement", first, { page: "Requests", action: "save", id: secondId, version: 1, values: { pr: { title: "FORGED-ADMIN" } }, actor: { id: other, roles: ["admin"] } })
  expect(spoofed.status).toBe(400)
  expect(await f.snapshot("procurement")).toEqual(before)
  // Positive control: this exact record/version remains editable by its actual authenticated owner.
  expect((await f.post(second, "save", { pr: { title: "OWNER-B-EDIT" } }, secondId, 1)).status).toBe(200)
  const after = await f.snapshot("procurement")
  expect(after.versions[`requests:${secondId}`]).toEqual({ version: 2, by: other })
  expect(object(object(object(object(after.data.store).requests)[secondId]).request).createdBy).toBe(other)
  expect(after.audit.at(-1)?.who).toBe(other)
})

test("logout revokes a retained session at the actual business routes without affecting another user", async () => {
  const f = await fixture()
  const first = await f.login()
  const second = await f.login(other)
  expect((await f.request("/auth/logout", first, {})).status).toBe(204)
  expect((await f.request("/dashboard", first)).status).toBe(401)
  expect((await f.post(first, "create", { pr: { title: "Revoked write" } })).status).toBe(401)
  expect((await f.request("/procurement?page=Requests", second)).status).toBe(200)
})

test("real Microsoft group membership requires a separate product grant bound to the resource-tenant oid", async () => {
  const f = await fixture()
  const first = await f.login()
  const second = await f.login(other)
  const hostIdentity = { installationId: "synthetic-microsoft-installation", hostId: "synthetic-host", projectId: "synthetic-project",
    location: Location.Ref.make({ directory: AbsolutePath.make(f.profile.workspaceDirectory) }) }
  const product = (grants: readonly SfProductGrant[]) => createSfProductAuthority({
    identity: () => hostIdentity, installationId: hostIdentity.installationId, origin: f.profile.loaded.config.origin,
    policyVersion: "synthetic-explicit-grants", persistence: f.store, authenticate: f.identity.authenticate, environment: f.environment,
    grants, createId: randomUUID, now: () => f.provider.clock.value,
    // Native execution is unavailable in this test; all admission uses the real Microsoft authenticator.
    commandIdentity: async () => undefined, inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const request = async (cookie: string) => {
    const incoming = new Request(`${ingressOrigin}/sucafina/product`, { headers: { host: new URL(ingressOrigin).host, cookie } })
    const resolved = microsoftRequest(incoming, f.profile.transport)!
    await f.identity.prepare(resolved)
    return resolved
  }
  const firstRequest = await request(first)
  const secondRequest = await request(second)
  for (const cookie of [first, second]) expect((await f.request("/dashboard", cookie)).status).toBe(200)
  const ungranted = product(f.profile.grants)
  for (const current of [firstRequest, secondRequest]) {
    expect(await ungranted.humanActions(current)).toEqual([])
    expect(await ungranted.state.read(current, "preferences", () => "private-data")).toMatchObject({ status: "denied" })
  }
  const policy = microsoftPolicy({ ...f.profile.loaded.config, grants: [{ principalRef: oid, namespaces: ["preferences"], operations: [], humanActions: ["views.read"] }] })
  const granted = product(policy.grants)
  expect(await granted.humanActions(firstRequest)).toEqual(["views.read"])
  expect(await granted.humanActions(secondRequest)).toEqual([])
  const command = { namespace: "preferences" as const, expectedStorageVersion: 0, targetRef: granted.creationTarget.ref,
    targetIncarnation: granted.creationTarget.incarnation, idempotencyKey: "synthetic-grant-preview", commandDigest: digestSfValue({ action: "synthetic-grant-preview" }) }
  const admitted = await granted.state.transaction(firstRequest, command, async (_state, authority) => ({ commit: false, value: authority.principalRef }))
  expect(admitted).toMatchObject({ status: "preview", value: oid })
  let foreignRead = false
  expect(await granted.state.read(secondRequest, "preferences", () => { foreignRead = true; return "private-data" })).toMatchObject({ status: "denied" })
  expect(foreignRead).toBe(false)
  expect(await granted.state.transaction(secondRequest, command, async () => ({ commit: true, value: "forbidden" }))).toMatchObject({ status: "denied" })
  expect(await granted.state.read(firstRequest, "documents", () => "ungranted-namespace")).toMatchObject({ status: "denied" })
  f.provider.account.groups.splice(0)
  const removedRole = await request(first)
  expect(await granted.humanActions(removedRole)).toEqual([])
  expect(await granted.state.read(removedRole, "preferences", () => "revoked-data")).toMatchObject({ status: "denied" })
  expect((await f.request("/dashboard", second)).status).toBe(200)
})
