import { createHash } from "node:crypto"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { createEntraClient } from "../../runtime/entra-client.ts"
import type { EntraOptions } from "../../runtime/local-contract.ts"

// All identifiers and credentials in this provider are synthetic. Keys exist only in test memory.
export const tenant = "11111111-1111-4111-8111-111111111111"
export const clientId = "22222222-2222-4222-8222-222222222222"
export const oid = "33333333-3333-4333-8333-333333333333"
export const group = "44444444-4444-4444-8444-444444444444"
export const other = "55555555-5555-4555-8555-555555555555"
export const syntheticSecret = "synthetic-test-only-web-client-secret"
export const authority = `https://login.microsoftonline.com/${tenant}`

type Account = { id: string; name: string; groups: string[] }
type Code = { user: string; nonce: string; challenge: string; redirect: string }
type ProviderHook = (request: Request) => Response | undefined | Promise<Response | undefined>

/** A bounded OIDC/JWKS and Graph transport; it never invokes network fetch. */
export async function microsoftFixture(input: {
  profile?: "local-public" | "web-confidential"
  claims?: Record<string, unknown>
  route?: ProviderHook
  tokenSeconds?: number
} = {}) {
  const pair = await generateKeyPair("RS256", { extractable: true })
  const publicKey = await exportJWK(pair.publicKey)
  const clock = { value: Date.UTC(2026, 10, 14, 20, 0, 0) }
  const claims = { ...input.claims }
  const hooks: { before?: ProviderHook } = { before: input.route }
  const account: Account = { id: oid, name: "Synthetic resource-tenant guest", groups: [group] }
  const second: Account = { id: other, name: "Synthetic other user", groups: [group] }
  const accounts = new Map([[oid, account], [other, second]])
  const codes = new Map<string, Code>()
  const access = new Map<string, string>()
  const refresh = new Map<string, string>()
  const count = { value: 0 }
  const requests: { method: string; url: string }[] = []
  const profile = input.profile ?? "web-confidential"
  const metadata = {
    issuer: `${authority}/v2.0`,
    authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
    token_endpoint: `${authority}/oauth2/v2.0/token`,
    jwks_uri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
  }

  async function issueCode(location: string, user = oid) {
    const url = new URL(location)
    if (`${url.origin}${url.pathname}` !== metadata.authorization_endpoint || url.searchParams.get("client_id") !== clientId || url.searchParams.get("response_type") !== "code" || url.searchParams.get("code_challenge_method") !== "S256" || !url.searchParams.get("state") || !url.searchParams.get("nonce") || !url.searchParams.get("code_challenge") || !url.searchParams.get("redirect_uri") || !accounts.has(user)) throw new Error("Invalid synthetic authorization request")
    const code = `synthetic-code-${++count.value}`
    codes.set(code, { user, nonce: url.searchParams.get("nonce")!, challenge: url.searchParams.get("code_challenge")!, redirect: url.searchParams.get("redirect_uri")! })
    return code
  }

  async function tokens(user: string, nonce?: string) {
    const next = ++count.value
    const accessToken = `synthetic-access-${next}`
    const refreshToken = `synthetic-refresh-${next}`
    access.set(accessToken, user)
    refresh.set(refreshToken, user)
    const epoch = Math.floor(clock.value / 1000)
    const idToken = nonce === undefined ? undefined : await new SignJWT({
      iss: metadata.issuer, aud: clientId, tid: tenant, oid: user, sub: `synthetic-subject-${user}`,
      nonce, iat: epoch, exp: epoch + (input.tokenSeconds ?? 3600), ver: "2.0",
      idp: "https://sts.windows.net/66666666-6666-4666-8666-666666666666/", ...claims,
    }).setProtectedHeader({ alg: "RS256", kid: "synthetic-rsa-key" }).sign(pair.privateKey)
    return Response.json({ access_token: accessToken, refresh_token: refreshToken, expires_in: input.tokenSeconds ?? 3600, token_type: "Bearer", ...(idToken ? { id_token: idToken } : {}) })
  }

  const transport = async (request: Request) => {
    requests.push({ method: request.method, url: request.url })
    const overridden = await hooks.before?.(request)
    if (overridden) return overridden
    const url = new URL(request.url)
    if (request.redirect !== "error") throw new Error("Synthetic provider requires redirect rejection")
    if (request.url === `${authority}/v2.0/.well-known/openid-configuration`) return Response.json(metadata)
    if (request.url === metadata.jwks_uri) return Response.json({ keys: [{ ...publicKey, kid: "synthetic-rsa-key", alg: "RS256", use: "sig" }] })
    if (request.url === metadata.token_endpoint) {
      const fields = new URLSearchParams(await request.text())
      if (request.method !== "POST" || fields.get("client_id") !== clientId || (profile === "web-confidential" && fields.get("client_secret") !== syntheticSecret)) return Response.json({ error: "invalid_client" }, { status: 400 })
      if (fields.get("grant_type") === "authorization_code") {
        const value = codes.get(fields.get("code") ?? "")
        codes.delete(fields.get("code") ?? "")
        if (!value || fields.get("redirect_uri") !== value.redirect || createHash("sha256").update(fields.get("code_verifier") ?? "").digest("base64url") !== value.challenge) return Response.json({ error: "invalid_grant" }, { status: 400 })
        return tokens(value.user, value.nonce)
      }
      if (fields.get("grant_type") === "refresh_token") {
        const value = refresh.get(fields.get("refresh_token") ?? "")
        refresh.delete(fields.get("refresh_token") ?? "")
        return value ? tokens(value) : Response.json({ error: "invalid_grant" }, { status: 400 })
      }
      return Response.json({ error: "unsupported_grant_type" }, { status: 400 })
    }
    if (url.origin === "https://graph.microsoft.com") {
      const user = access.get((request.headers.get("authorization") ?? "").replace(/^Bearer /, ""))
      const person = user ? accounts.get(user) : undefined
      if (!person) return Response.json({ error: "InvalidAuthenticationToken" }, { status: 401 })
      if (url.pathname === "/v1.0/me") return Response.json({ id: person.id, displayName: person.name })
      if (url.pathname === "/v1.0/me/checkMemberGroups") {
        const body = await request.json() as { groupIds: string[] }
        if (request.method !== "POST" || !Array.isArray(body.groupIds) || body.groupIds.length > 20) return Response.json({ error: "bad_request" }, { status: 400 })
        return Response.json({ value: body.groupIds.filter((id) => person.groups.includes(id)) })
      }
      if (url.pathname === "/v1.0/users" && profile === "local-public") return Response.json({ value: [...accounts.values()].map((person) => ({ id: person.id, displayName: person.name })) })
      if (url.pathname === "/v1.0/groups" && profile === "local-public") return Response.json({ value: [{ id: group, displayName: "Synthetic product group" }] })
      return Response.json({ error: "Authorization_RequestDenied" }, { status: 403 })
    }
    throw new Error("Unexpected synthetic provider endpoint")
  }
  const options: EntraOptions = { tenantId: tenant, clientId, profile, fetch: transport, now: () => new Date(clock.value), ...(profile === "web-confidential" ? { clientSecret: async () => syntheticSecret } : {}) }
  return { client: createEntraClient(options), options, fetch: transport, clock, claims, hooks, account, second, accounts, requests, issueCode, metadata }
}
