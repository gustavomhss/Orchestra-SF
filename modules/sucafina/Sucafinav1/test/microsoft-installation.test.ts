import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { expect, test } from "bun:test"
import { Schema } from "effect"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { createMicrosoftInstallation } from "../local/microsoft-entry.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import type { LocalConfiguration } from "../runtime/local-configuration.ts"
import { bindMicrosoftInstallation } from "../runtime/microsoft-configuration.ts"
import { prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"

const listenerOrigin = "http://127.0.0.1:4110"
const ingressOrigin = "http://sf-ingress.example.test:4110"
const origin = "https://sf.example.test"
const mount = "/sucafina"
const tenantId = "11111111-1111-4111-8111-111111111111"
const clientId = "22222222-2222-4222-8222-222222222222"
const oid = "33333333-3333-4333-8333-333333333333"
const grantPrincipal = "a3333333-3333-4333-8333-333333333333"
const teamObjectId = "44444444-4444-4444-8444-444444444444"
const secondTeamId = "55555555-5555-4555-8555-555555555555"
const disabledTeamId = "66666666-6666-4666-8666-666666666666"
const authority = "https://login.microsoftonline.com/" + tenantId
const graph = "https://graph.microsoft.com/v1.0"
const secret = "synthetic-private-installation-secret"
const ingressProof = "a".repeat(64)
const accessToken = "synthetic-private-installation-access"
const epoch = 1794398400

async function fixture(
  teams: "direct" | undefined,
  fetch: (request: Request) => Promise<Response>,
  enabledTeamIds?: unknown,
  groups: LocalConfiguration["groups"] = { dashboard: {}, planner: {}, procurement: {} },
) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-microsoft-installation-"))
  const directory = join(root, "installation")
  const workspaceDirectory = join(root, "workspace")
  try {
    const file = await prepareLocalConfiguration(directory)
    await mkdir(workspaceDirectory, { mode: 0o700 })
    await writeFile(file, JSON.stringify({
      version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, listenerOrigin, ingressOrigin, mount, tenantId, clientId, workspaceDirectory,
      groups,
      grants: [{ principalRef: grantPrincipal.toUpperCase(), operations: ["sf_case_read"] }],
      supremeAdminGroupId: grantPrincipal.toUpperCase(), scanner: null,
      ...(teams ? { teams } : {}),
      enabledTeamIds,
    }))
    await writeFile(join(directory, "client-secret.txt"), secret, { mode: 0o600 })
    await writeFile(join(directory, "ingress-secret.txt"), ingressProof, { mode: 0o600 })
    const environment = {
      ORCHESTRA_DB: join(directory, "host-data", "orchestra.db"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: join(directory, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: join(directory, "host-credential.key"),
      TMPDIR: join(directory, "host-tmp"),
      XDG_DATA_HOME: join(directory, "host-data"),
      XDG_CONFIG_HOME: join(directory, "host-config"),
      XDG_CACHE_HOME: join(directory, "host-cache"),
      XDG_STATE_HOME: join(directory, "host-state"),
    }
    const prepare = () => prepareMicrosoftInstallation({ origin: listenerOrigin }, file, environment,
      { fetch, now: () => new Date(epoch * 1000) })
    const [prepared, concurrent] = await Promise.all([prepare(), prepare()])
    expect(concurrent.loaded.config).toEqual(prepared.loaded.config)
    expect(prepared.loaded.config.grants).toEqual([{ principalRef: grantPrincipal, operations: ["sf_case_read"] }])
    expect(Object.isFrozen(prepared.loaded.config.grants[0]?.operations)).toBe(true)
    expect(prepared.loaded.config.supremeAdminGroupId).toBe(grantPrincipal)
    await expect(bindMicrosoftInstallation(directory, { ...prepared.loaded.config, tenantId: oid })).rejects
      .toThrow("Microsoft installation identity cannot change")
    const installation = await createMicrosoftInstallation({ origin: listenerOrigin }, file, environment,
      { fetch, now: () => new Date(epoch * 1000) })
    return {
      installation,
      directory,
      async close() {
        try { await installation.dispose() }
        finally { await rm(root, { recursive: true, force: true }) }
      },
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

const discovery = () => Response.json({
  issuer: authority + "/v2.0",
  authorization_endpoint: authority + "/oauth2/v2.0/authorize",
  token_endpoint: authority + "/oauth2/v2.0/token",
  jwks_uri: authority + "/discovery/v2.0/keys",
})
const ingress = (relative: string, headers?: Record<string, string>, init?: Pick<RequestInit, "method" | "body">) => new Request(ingressOrigin + mount + relative, {
  ...init,
  headers: { host: new URL(ingressOrigin).host, ...headers },
})

test("Corporate dashboard authorizes only current, enabled direct Teams from the signed HTTPS session", async () => {
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const login = { nonce: "" }
  const graphCalls: string[] = []
  const finance = { id: teamObjectId, tenantId, displayName: "Finance", isArchived: false }
  const planning = { ...finance, id: secondTeamId, displayName: "Planning" }
  const disabled = { ...finance, id: disabledTeamId, displayName: "Disabled" }
  const membership = { teams: [finance, disabled], incomplete: false, down: false, group: true, revokeAfterRoleCheck: false }
  const f = await fixture("direct", async (request) => {
    const url = new URL(request.url)
    if (url.href === authority + "/v2.0/.well-known/openid-configuration") return discovery()
    if (url.href === authority + "/discovery/v2.0/keys") return Response.json({ keys: [{ ...jwk, kid: "installation-test" }] })
    if (url.href === authority + "/oauth2/v2.0/token") {
      const form = new URLSearchParams(await request.text())
      expect(form.get("client_secret")).toBe(secret)
      expect(form.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
      const idToken = await new SignJWT({ tid: tenantId, oid, nonce: login.nonce })
        .setSubject("synthetic-subject").setIssuer(authority + "/v2.0").setAudience(clientId)
        .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
        .setProtectedHeader({ alg: "RS256", kid: "installation-test" }).sign(keys.privateKey)
      return Response.json({ access_token: accessToken, id_token: idToken, token_type: "Bearer", expires_in: 3600, scope: "User.Read Team.ReadBasic.All" })
    }
    if (url.origin === "https://graph.microsoft.com") {
      graphCalls.push(url.pathname)
      expect(request.headers.get("authorization")).toBe("Bearer " + accessToken)
      if (url.pathname === "/v1.0/me") return Response.json({ id: oid, displayName: "Verified person" })
      if (url.href === graph + "/me/checkMemberGroups") {
        expect(request.method).toBe("POST")
        expect(await request.json()).toEqual({ groupIds: [grantPrincipal] })
        if (membership.revokeAfterRoleCheck) membership.teams = [planning, disabled]
        return Response.json({ value: membership.group ? [grantPrincipal] : [] })
      }
      if (url.href === graph + "/me/joinedTeams") {
        if (membership.down) return new Response(null, { status: 503 })
        return Response.json({
          value: membership.teams,
          ...(membership.incomplete ? { "@odata.count": membership.teams.length + 1 } : {}),
        })
      }
    }
    throw new Error("Unexpected synthetic Microsoft request")
  }, [teamObjectId.toUpperCase(), secondTeamId], {
    dashboard: { admin: "group:" + grantPrincipal },
    planner: { viewer: "group:" + grantPrincipal },
    procurement: { buyer: "group:" + grantPrincipal },
  })
  try {
    expect(f.installation.mount).toBe(mount)
    expect(f.installation.trustedIngress.origin).toBe(ingressOrigin)
    expect(f.installation.trustedIngress.authorize(ingressProof)).toBe(true)
    expect(f.installation.trustedIngress.authorize(undefined)).toBe(false)
    expect(f.installation.trustedIngress.authorize("b".repeat(64))).toBe(false)
    expect(f.installation.trustedIngress.authorize(ingressProof + ", " + ingressProof)).toBe(false)
    const anonymous = await f.installation.handler(ingress("/dashboard"))
    expect(anonymous?.status).toBe(303)
    expect(anonymous?.headers.get("location")).toBe(mount + "/auth/login")
    const begin = await f.installation.handler(ingress("/auth/login", { "x-forwarded-host": "foreign.example.test" }))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
    expect(authorize.searchParams.get("scope")?.split(" ")).toContain("Team.ReadBasic.All")
    expect(authorize.searchParams.has("client_secret")).toBe(false)
    login.nonce = authorize.searchParams.get("nonce")!
    const loginCookie = begin!.headers.getSetCookie().find((value) => value.includes("_login="))!
    expect(loginCookie).toContain("; Secure")
    const finish = await f.installation.handler(ingress("/auth/callback?" + new URLSearchParams({
      code: "synthetic-code", state: authorize.searchParams.get("state")!,
    }), { cookie: loginCookie.split(";")[0] }))
    expect(finish?.status).toBe(303)
    const sessionCookie = finish!.headers.getSetCookie().find((value) => value.includes("_session="))!
    expect(sessionCookie).toContain("; Secure")
    expect(sessionCookie).not.toContain(accessToken)
    expect(graphCalls).toEqual(["/v1.0/me"])
    const headers = { cookie: sessionCookie.split(";")[0] }
    const callbackTarget = new URL(finish!.headers.get("location")!, origin)
    expect(callbackTarget.href).toBe(origin + mount + "/dashboard")
    const callbackHeaders = { ...headers, "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }
    const landing = await f.installation.handler(ingress(callbackTarget.pathname.slice(mount.length), callbackHeaders))
    expect(landing?.status).toBe(303)
    const teamPath = (id: string, surface: string) => "/teams/" + id + "/" + surface
    expect(landing?.headers.get("location")).toBe(mount + teamPath(teamObjectId, "dashboard"))
    expect(await f.installation.handler(ingress("/teams", headers))).toBeUndefined()
    expect((await f.installation.handler(ingress("/auth/login", { host: "foreign.example.test" })))?.status).toBe(403)
    expect((await f.installation.handler(new Request(listenerOrigin + mount + "/auth/login", {
      headers: { host: new URL(ingressOrigin).host },
    })))?.status).toBe(403)
    const result = await f.installation.teamDirectory!(ingress("/dashboard?principalObjectId=caller", headers))
    expect(result).toEqual({
      state: "complete", tenantId, principalObjectId: oid, source: "joinedTeams", membership: "direct",
      teams: [
        { teamObjectId, name: "Finance", archived: false },
        { teamObjectId: disabledTeamId, name: "Disabled", archived: false },
      ],
    })
    expect(JSON.stringify(result)).not.toContain(accessToken)
    const read = ["/v1.0/me", "/v1.0/me/joinedTeams", "/v1.0/me"]
    expect(graphCalls).toEqual(["/v1.0/me", ...read, ...read])

    const dashboard = (fields?: Record<string, string>) =>
      f.installation.handler(ingress("/dashboard", { ...headers, ...fields }))
    expect((await dashboard({ "x-sf-team-profile": "" }))?.status).toBe(403)
    expect((await dashboard({ "sec-fetch-site": "cross-site" }))?.status).toBe(403)
    expect((await f.installation.handler(ingress("/dashboard?teamObjectId=" + teamObjectId, headers)))?.status).toBe(403)
    expect(graphCalls).toEqual(["/v1.0/me", ...read, ...read])

    expect((await f.installation.handler(ingress(teamPath(teamObjectId, "dashboard"), callbackHeaders)))?.status).toBe(200)
    for (const surface of ["planner", "procurement"]) {
      const redirect = await f.installation.handler(ingress("/" + surface, headers))
      expect(redirect?.status).toBe(303)
      expect(redirect?.headers.get("location")).toBe(mount + teamPath(teamObjectId, surface))
    }
    const head = await f.installation.handler(ingress(teamPath(teamObjectId, "planner"), headers, { method: "HEAD" }))
    expect(head?.status).toBe(200)
    expect(await head?.text()).toBe("")

    membership.teams = [finance, planning, disabled]
    const selection = await dashboard()
    expect(selection?.status).toBe(409)
    expect(selection?.headers.get("Cache-Control")).toBe("no-store")
    const selected = Schema.decodeUnknownSync(TeamProfile.TeamState)(await selection?.json())
    if (selected.status !== "selection-required") throw new Error("Expected Team selection")
    expect(selected.choices.map((choice) => choice.displayName)).toEqual(["Finance", "Planning"])
    const profile = selected.choices[1]!.profile
    const selector = (target: unknown) => ({
      "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: target }),
    })
    const selectedDashboard = await dashboard(selector(profile))
    expect(selectedDashboard?.status).toBe(303)
    expect(selectedDashboard?.headers.get("location")).toBe(mount + teamPath(secondTeamId, "dashboard"))
    expect((await dashboard({
      ...selector(profile), "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
    }))?.status).toBe(403)
    const selectedRoot = await f.installation.handler(ingress("", { ...headers, ...selector(profile) }))
    expect(selectedRoot?.status).toBe(303)
    expect(selectedRoot?.headers.get("location")).toBe(mount + teamPath(secondTeamId, "dashboard"))
    expect((await dashboard(selector({ ...profile, teamObjectId: disabledTeamId })))?.status).toBe(403)
    expect((await dashboard(selector({ ...profile, installationId: "other-installation" })))?.status).toBe(403)
    expect((await dashboard(selector({ ...profile, tenantId: clientId })))?.status).toBe(403)

    const suppliers = (id: string, fields?: Record<string, string>) => f.installation.handler(
      ingress(teamPath(id, "procurement") + "?page=Suppliers", { ...headers, ...fields }),
    )
    const createSupplier = (id: string, legalName: string, fields?: Record<string, string>) => f.installation.handler(
      ingress(teamPath(id, "procurement"), { ...headers, "content-type": "application/json", ...fields }, {
        method: "POST", body: JSON.stringify({ page: "Suppliers", action: "create", version: 0, values: { legalName } }),
      }),
    )
    expect((await suppliers(teamObjectId, selector(profile)))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Missing origin"))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Wrong origin", { origin: ingressOrigin }))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Cross Team", { origin, ...selector(profile) }))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Finance supplier", { origin }))?.status).toBe(200)
    expect((await createSupplier(secondTeamId, "Planning supplier", { origin }))?.status).toBe(200)
    for (const [id, own, other] of [
      [teamObjectId, "Finance supplier", "Planning supplier"],
      [secondTeamId, "Planning supplier", "Finance supplier"],
    ] as const) {
      const read = await suppliers(id)
      expect(read?.status).toBe(200)
      const html = await read!.text()
      expect(html).toContain(`data-logout="${mount}/auth"`)
      expect(html).toContain(own)
      expect(html).not.toContain(other)
      const partition = digestSfValue({ installationId: profile.installationId, tenantId, teamObjectId: id })
      expect(await Bun.file(join(f.directory, "business-teams", partition, "installation.sqlite")).exists()).toBe(true)
    }

    membership.group = false
    expect((await suppliers(teamObjectId))?.status).toBe(403)
    membership.group = true
    membership.revokeAfterRoleCheck = true
    expect((await createSupplier(teamObjectId, "Revoked before commit", { origin }))?.status).toBe(403)
    membership.revokeAfterRoleCheck = false
    expect((await suppliers(teamObjectId))?.status).toBe(403)
    membership.teams = [finance, planning, disabled]
    membership.revokeAfterRoleCheck = true
    const revokedRead = await suppliers(teamObjectId)
    expect(revokedRead?.status).toBe(403)
    expect(await revokedRead?.text()).not.toContain("Finance supplier")
    membership.revokeAfterRoleCheck = false
    membership.teams = [finance, planning, disabled]
    const staleImport = () => f.installation.handler(ingress(teamPath(teamObjectId, "dashboard"), {
      ...headers, origin, "content-type": "application/json",
    }, {
      method: "POST", body: JSON.stringify({
        page: "Executive Dashboard", action: "backup-import", version: 999, confirmed: true, values: { data: {} },
      }),
    }))
    expect((await staleImport())?.status).toBe(409)
    membership.revokeAfterRoleCheck = true
    const revokedConflict = await staleImport()
    expect(revokedConflict?.status).toBe(403)
    expect(await revokedConflict?.text()).toBe("")
    membership.revokeAfterRoleCheck = false
    membership.teams = [finance, planning, disabled]
    const restored = await suppliers(teamObjectId)
    expect(restored?.status).toBe(200)
    const restoredHtml = await restored!.text()
    expect(restoredHtml).toContain("Finance supplier")
    expect(restoredHtml).not.toContain("Revoked before commit")

    membership.teams = [finance, disabled, { ...planning, isArchived: true }]
    expect((await dashboard(selector(profile)))?.status).toBe(403)
    membership.teams = [finance, disabled]
    expect((await dashboard(selector(profile)))?.status).toBe(403)
    membership.incomplete = true
    expect((await dashboard())?.status).toBe(503)
    membership.incomplete = false
    membership.down = true
    expect((await dashboard())?.status).toBe(503)
    membership.down = false
    membership.teams = [disabled]
    expect((await f.installation.handler(ingress("", headers)))?.status).toBe(403)

    const logout = await f.installation.handler(ingress("/auth/logout", { ...headers, origin }, { method: "POST" }))
    expect(logout?.status).toBe(204)
    const signedOut = await f.installation.handler(ingress("/auth/signed-out"))
    expect(signedOut?.status).toBe(200)
    expect(await signedOut?.text()).toContain(`href="${mount}/auth/login"`)
    expect((await suppliers(teamObjectId))?.status).toBe(303)
  } finally { await f.close() }
})

test("Corporate enabled Team config rejects malformed and duplicate IDs and requires direct Teams mode", async () => {
  const unexpectedProvider = async () => { throw new Error("Unexpected Microsoft request") }
  await expect(fixture("direct", unexpectedProvider, [teamObjectId, teamObjectId.toUpperCase()])).rejects.toThrow("Duplicate enabled Team ID")
  await expect(fixture("direct", unexpectedProvider, ["Finance"])).rejects.toThrow("Invalid enabled Team ID")
  await expect(fixture(undefined, unexpectedProvider, [teamObjectId])).rejects.toThrow("Enabled Team IDs require direct Teams membership")
})

test("Corporate profile without Teams opt-in keeps minimum login scopes", async () => {
  const f = await fixture(undefined, async (request) => {
    expect(request.url).toBe(authority + "/v2.0/.well-known/openid-configuration")
    return discovery()
  })
  try {
    expect(f.installation.teamDirectory).toBeUndefined()
    const begin = await f.installation.handler(ingress("/auth/login"))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("scope")?.split(" ")).toEqual(["openid", "profile", "offline_access", "User.Read"])
  } finally { await f.close() }
})

test("Corporate login reserves capacity before discovery and releases its slot on provider failure", async () => {
  const provider = { calls: 0 }
  const f = await fixture(undefined, async (request) => {
    expect(request.url).toBe(authority + "/v2.0/.well-known/openid-configuration")
    provider.calls++
    if (provider.calls === 1) return new Response(null, { status: 503 })
    return discovery()
  })
  try {
    expect((await f.installation.handler(ingress("/auth/login")))?.status).toBe(503)
    for (let i = 0; i < 100; i++) {
      expect((await f.installation.handler(ingress("/auth/login")))?.status).toBe(303)
    }
    const blocked = await f.installation.handler(ingress("/auth/login"))
    expect(blocked?.status).toBe(429)
    expect(blocked?.headers.get("set-cookie")).toBeNull()
    expect(provider.calls).toBe(101)
  } finally { await f.close() }
})
