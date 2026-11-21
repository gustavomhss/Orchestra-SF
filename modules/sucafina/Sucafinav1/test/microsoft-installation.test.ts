import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { createMicrosoftInstallation } from "../local/microsoft-entry.ts"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
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
const authority = "https://login.microsoftonline.com/" + tenantId
const graph = "https://graph.microsoft.com/v1.0"
const secret = "synthetic-private-installation-secret"
const ingressProof = "a".repeat(64)
const accessToken = "synthetic-private-installation-access"
const epoch = 1794398400

async function fixture(teams: "direct" | undefined, fetch: (request: Request) => Promise<Response>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-microsoft-installation-"))
  const directory = join(root, "installation")
  const workspaceDirectory = join(root, "workspace")
  try {
    const file = await prepareLocalConfiguration(directory)
    await mkdir(workspaceDirectory, { mode: 0o700 })
    await writeFile(file, JSON.stringify({
      version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, listenerOrigin, ingressOrigin, mount, tenantId, clientId, workspaceDirectory,
      groups: {
        dashboard: { viewer: `group:${grantPrincipal}` },
        planner: { viewer: `group:${grantPrincipal}` },
        procurement: { viewer: `group:${grantPrincipal}` },
      },
      grants: [{ principalRef: grantPrincipal.toUpperCase(), operations: ["sf_case_read"] }],
      supremeAdminGroupId: grantPrincipal.toUpperCase(), scanner: null,
      ...(teams ? { teams } : {}),
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
const ingress = (relative: string, headers?: Record<string, string>) => new Request(ingressOrigin + mount + relative, {
  headers: { host: new URL(ingressOrigin).host, ...headers },
})

test("Corporate installation opts into direct Teams on the signed HTTPS session", async () => {
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const login = { nonce: "", member: true }
  const graphCalls: string[] = []
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
      if (url.pathname === "/v1.0/me/checkMemberGroups") {
        expect(await request.json()).toEqual({ groupIds: [grantPrincipal] })
        return Response.json({ value: login.member ? [grantPrincipal] : [] })
      }
      if (url.href === graph + "/me/joinedTeams") return Response.json({ value: [{ id: teamObjectId, tenantId, displayName: "Finance", isArchived: false }] })
    }
    throw new Error("Unexpected synthetic Microsoft request")
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
    expect(anonymous?.headers.get("location")).toBe(`${mount}/auth/login?returnTo=${encodeURIComponent(`${mount}/dashboard`)}`)
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
    for (const surface of ["dashboard", "planner", "procurement"]) {
      const page = await f.installation.handler(ingress(`/${surface}`, headers))
      expect(page?.status).toBe(200)
      expect(page?.headers.get("content-type")).toContain("text/html")
    }
    login.member = false
    expect((await f.installation.handler(ingress("/dashboard", headers)))?.status).toBe(403)
    expect(await f.installation.handler(ingress("/teams", headers))).toBeUndefined()
    expect((await f.installation.handler(ingress("/auth/login", { host: "foreign.example.test" })))?.status).toBe(403)
    expect((await f.installation.handler(new Request(listenerOrigin + mount + "/auth/login", {
      headers: { host: new URL(ingressOrigin).host },
    })))?.status).toBe(403)
    graphCalls.length = 0
    const result = await f.installation.teamDirectory!(ingress("/dashboard?principalObjectId=caller", headers))
    expect(result).toEqual({
      state: "complete", tenantId, principalObjectId: oid, source: "joinedTeams", membership: "direct",
      teams: [{ teamObjectId, name: "Finance", archived: false }],
    })
    expect(JSON.stringify(result)).not.toContain(accessToken)
    expect(graphCalls).toEqual(["/v1.0/me", "/v1.0/me/joinedTeams", "/v1.0/me"])
  } finally { await f.close() }
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
