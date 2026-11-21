import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { bindMicrosoftInstallation } from "../runtime/microsoft-configuration.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"

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
      groups: { dashboard: {}, planner: {}, procurement: {} },
      grants: [{ principalRef: grantPrincipal.toUpperCase(), operations: ["sf_case_read"] }],
      supremeAdminGroupId: grantPrincipal.toUpperCase(), scanner: null,
      ...(teams ? { teams } : {}),
    }))
    await writeFile(join(directory, "client-secret.txt"), secret, { mode: 0o600 })
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
    const store = await openLocalStore(join(directory, "business-microsoft"))
    try {
      const identity = prepared.createIdentity(store.secrets)
      return {
        prepared, identity,
        async close() {
          try { await store.dispose() }
          finally { await rm(root, { recursive: true, force: true }) }
        },
      }
    } catch (error) {
      await store.dispose()
      throw error
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
  const login = { nonce: "" }
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
      if (url.href === graph + "/me/joinedTeams") return Response.json({ value: [{ id: teamObjectId, tenantId, displayName: "Finance", isArchived: false }] })
    }
    throw new Error("Unexpected synthetic Microsoft request")
  })
  try {
    const normalized = (request: Request) => microsoftRequest(request, f.prepared.transport)!
    const begin = await f.identity.handle(normalized(ingress("/auth/login", { "x-forwarded-host": "foreign.example.test" })))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
    expect(authorize.searchParams.get("scope")?.split(" ")).toContain("Team.ReadBasic.All")
    expect(authorize.searchParams.has("client_secret")).toBe(false)
    login.nonce = authorize.searchParams.get("nonce")!
    const loginCookie = begin!.headers.getSetCookie().find((value) => value.includes("_login="))!
    expect(loginCookie).toContain("; Secure")
    const finish = await f.identity.handle(normalized(ingress("/auth/callback?" + new URLSearchParams({
      code: "synthetic-code", state: authorize.searchParams.get("state")!,
    }), { cookie: loginCookie.split(";")[0] })))
    expect(finish?.status).toBe(303)
    const sessionCookie = finish!.headers.getSetCookie().find((value) => value.includes("_session="))!
    expect(sessionCookie).toContain("; Secure")
    expect(sessionCookie).not.toContain(accessToken)
    expect(graphCalls).toEqual(["/v1.0/me"])
    expect(microsoftRequest(ingress("/dashboard", { host: "foreign.example.test" }), f.prepared.transport)).toBeUndefined()
    expect(microsoftRequest(new Request(listenerOrigin + mount + "/dashboard", {
      headers: { host: new URL(ingressOrigin).host },
    }), f.prepared.transport)).toBeUndefined()
    const result = await f.identity.teamDirectory!(normalized(ingress("/dashboard?principalObjectId=caller", {
      cookie: sessionCookie.split(";")[0],
    })))
    expect(result).toEqual({
      state: "complete", tenantId, principalObjectId: oid, source: "joinedTeams", membership: "direct",
      teams: [{ teamObjectId, name: "Finance", archived: false }],
    })
    expect(JSON.stringify(result)).not.toContain(accessToken)
    expect(graphCalls).toEqual(["/v1.0/me", "/v1.0/me", "/v1.0/me/joinedTeams", "/v1.0/me"])
  } finally { await f.close() }
})

test("Corporate profile without Teams opt-in keeps minimum login scopes", async () => {
  const f = await fixture(undefined, async (request) => {
    expect(request.url).toBe(authority + "/v2.0/.well-known/openid-configuration")
    return discovery()
  })
  try {
    expect(f.identity.teamDirectory).toBeUndefined()
    const request = microsoftRequest(ingress("/auth/login"), f.prepared.transport)
    if (!request) throw new Error("Configured Microsoft ingress did not bind")
    const begin = await f.identity.handle(request)
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("scope")?.split(" ")).toEqual(["openid", "profile", "offline_access", "User.Read"])
  } finally { await f.close() }
})
