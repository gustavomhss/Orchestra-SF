import { createLocalJWKSet, jwtVerify } from "jose"
import { emptyMap } from "../src/identity.ts"
import type { EntraClient, EntraOptions, EntraTokens } from "./local-contract.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const graph = "https://graph.microsoft.com/v1.0"
const bodyLimit = 2 * 1024 * 1024
const requestTimeout = 10000

export function createEntraClient(options: EntraOptions): EntraClient {
  if (!uuid.test(options.tenantId) || !uuid.test(options.clientId)) throw new Error("Invalid Entra configuration")
  const tenant = options.tenantId.toLowerCase()
  const clientId = options.clientId.toLowerCase()
  const profile = options.profile === undefined ? "local-public" : options.profile
  const clientSecret = options.clientSecret
  if (!["local-public", "web-confidential"].includes(profile) || (profile === "web-confidential" ? typeof clientSecret !== "function" : clientSecret !== undefined)) throw new Error("Invalid Entra client profile")
  const scopes = profile === "web-confidential" ? "openid profile offline_access User.Read" : "openid profile offline_access User.Read User.ReadBasic.All GroupMember.Read.All"
  const authority = `https://login.microsoftonline.com/${tenant}`
  const issuer = `${authority}/v2.0`
  const now = options.now ?? (() => new Date())
  const send = options.fetch ?? ((request: Request) => fetch(request))
  const limit = options.directoryLimit ?? 10000
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw new Error("Invalid directory limit")

  async function request(url: string, init?: RequestInit) {
    const signal = AbortSignal.timeout(requestTimeout)
    const aborted = Promise.withResolvers<never>()
    const abort = () => aborted.reject(new Error("Entra provider request timed out"))
    signal.addEventListener("abort", abort, { once: true })
    try {
      // An injected transport may ignore abort; the race still bounds its caller.
      return await Promise.race([readResponse(url, signal, init), aborted.promise])
    } finally {
      signal.removeEventListener("abort", abort)
    }
  }

  async function readResponse(url: string, signal: AbortSignal, init?: RequestInit) {
    const response = await Promise.resolve().then(() => send(new Request(url, { ...init, redirect: "error", signal }))).catch(() => {
      throw new Error("Entra provider request failed")
    })
    if (signal.aborted || !response.ok || response.redirected) {
      void response.body?.cancel().catch(() => undefined)
      throw new Error("Entra provider request rejected")
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error("Empty Entra response")
    const cancel = () => { void reader.cancel().catch(() => undefined) }
    signal.addEventListener("abort", cancel, { once: true })
    const chunks: Uint8Array[] = []
    const size = { value: 0 }
    try {
      while (true) {
        const chunk = await reader.read()
        if (signal.aborted) throw new Error("Entra provider request timed out")
        if (chunk.done) break
        size.value += chunk.value.byteLength
        if (size.value > bodyLimit) throw new Error("Response exceeds limit")
        chunks.push(chunk.value)
      }
      const bytes = new Uint8Array(size.value)
      const offset = { value: 0 }
      chunks.forEach((chunk) => { bytes.set(chunk, offset.value); offset.value += chunk.byteLength })
      return record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
    } catch {
      throw new Error("Invalid Entra provider response")
    } finally {
      signal.removeEventListener("abort", cancel)
      cancel()
    }
  }

  async function discovery() {
    const data = await request(`${authority}/v2.0/.well-known/openid-configuration`)
    if (data.issuer !== issuer) throw new Error("Invalid Entra issuer")
    const authorize = endpoint(data.authorization_endpoint, [`/${tenant}/oauth2/v2.0/authorize`])
    const token = endpoint(data.token_endpoint, [`/${tenant}/oauth2/v2.0/token`])
    const jwks = endpoint(data.jwks_uri, [`/${tenant}/discovery/v2.0/keys`, "/common/discovery/v2.0/keys"])
    return { authorize, token, jwks }
  }

  async function graphRequest(accessToken: string, url: string, body?: { groupIds: string[] }) {
    if (!accessToken || /[\x00-\x20\x7f]/.test(accessToken)) throw new Error("Invalid access token")
    if (!URL.canParse(url)) throw new Error("Invalid Graph endpoint")
    const target = new URL(url)
    if (target.origin !== "https://graph.microsoft.com" || !["/v1.0/me", "/v1.0/users", "/v1.0/groups", "/v1.0/me/checkMemberGroups"].includes(target.pathname) || target.username || target.password || target.hash) throw new Error("Invalid Graph endpoint")
    return request(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }

  async function person(accessToken: string) {
    return directoryPerson(await graphRequest(accessToken, `${graph}/me?$select=id,displayName`))
  }

  async function redeem(url: string, fields: Record<string, string>) {
    // Read only inside the server-side redemption boundary. Provider errors never escape.
    const secret = clientSecret ? await Promise.resolve().then(clientSecret).catch(() => undefined) : undefined
    if (profile === "web-confidential" && (typeof secret !== "string" || !secret.trim() || secret.length > 4096 || /[\x00-\x1f\x7f]/.test(secret))) throw new Error("Entra client credential unavailable")
    const data = await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, scope: scopes, ...fields, ...(secret === undefined ? {} : { client_secret: secret }) }),
    })
    if (data.error !== undefined || typeof data.access_token !== "string" || !data.access_token.trim() || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("Invalid Entra token response")
    if (data.refresh_token !== undefined && (typeof data.refresh_token !== "string" || !data.refresh_token.trim())) throw new Error("Invalid refresh token response")
    if (data.id_token !== undefined && (typeof data.id_token !== "string" || !data.id_token.trim())) throw new Error("Invalid identity token response")
    if ((profile === "web-confidential" || data.token_type !== undefined) && data.token_type !== "Bearer") throw new Error("Invalid Entra token type")
    const tokens: EntraTokens = {
      accessToken: data.access_token,
      expiresAt: now().getTime() + data.expires_in * 1000,
      ...(typeof data.refresh_token === "string" ? { refreshToken: data.refresh_token } : {}),
      ...(typeof data.id_token === "string" ? { idToken: data.id_token } : {}),
    }
    if (!Number.isSafeInteger(tokens.expiresAt)) throw new Error("Invalid token expiration")
    return tokens
  }

  const client: EntraClient = {
    tenantId: tenant,
    clientId,
    profile,
    async authorization(input) {
      const metadata = await discovery()
      const url = new URL(metadata.authorize)
      url.search = new URLSearchParams({ client_id: clientId, response_type: "code", response_mode: "query", redirect_uri: input.redirectUri, scope: scopes, state: input.state, nonce: input.nonce, code_challenge: input.challenge, code_challenge_method: "S256" }).toString()
      return url.href
    },
    async exchange(input) {
      const metadata = await discovery()
      const tokens = await redeem(metadata.token, { grant_type: "authorization_code", code: input.code, code_verifier: input.verifier, redirect_uri: input.redirectUri })
      if (!tokens.idToken || !input.nonce) throw new Error("Missing Entra identity token or nonce")
      const keyset = await request(metadata.jwks)
      if (!Array.isArray(keyset.keys) || keyset.keys.length === 0 || keyset.keys.length > 100) throw new Error("Invalid Entra signing keys")
      const signingKeys = keyset.keys.map((key) => record(key))
      // Local JWKS resolution keeps all network I/O behind the bounded injected transport.
      const verified = await Promise.resolve().then(() => jwtVerify(tokens.idToken!, createLocalJWKSet({ keys: signingKeys }), { algorithms: ["RS256"], issuer, audience: clientId, currentDate: now(), requiredClaims: ["exp", "iat", "sub", "tid", "oid", "nonce"] })).catch(() => {
        throw new Error("Entra identity verification failed")
      })
      const claims = verified.payload
      if (typeof claims.tid !== "string" || claims.tid.toLowerCase() !== tenant || typeof claims.oid !== "string" || !uuid.test(claims.oid) || claims.aud !== clientId || typeof claims.sub !== "string" || !claims.sub.trim() || claims.nonce !== input.nonce || typeof claims.iat !== "number" || !Number.isSafeInteger(claims.iat) || claims.iat <= 0 || claims.iat > Math.floor(now().getTime() / 1000) || typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp) || claims.exp <= claims.iat || (claims.ver !== undefined && claims.ver !== "2.0")) throw new Error("Invalid Entra identity claims")
      const identity = await person(tokens.accessToken)
      if (identity.id !== claims.oid.toLowerCase()) throw new Error("Entra identity mismatch")
      return { tokens, person: identity }
    },
    async refresh(refreshToken) {
      if (!refreshToken) throw new Error("Missing refresh token")
      return redeem((await discovery()).token, { grant_type: "refresh_token", refresh_token: refreshToken })
    },
    person,
    async directory(accessToken) {
      // B2B guests cannot enumerate /users. The web login requires only delegated User.Read.
      if (profile === "web-confidential") return [await person(accessToken)]
      const people: { id: string; name: string }[] = []
      const visited = new Set<string>()
      const identities = new Set<string>()
      const expected: { count?: number } = {}
      const page = { url: `${graph}/users?$select=id,displayName` }
      while (true) {
        if (!URL.canParse(page.url)) throw new Error("Invalid directory pagination")
        const url = new URL(page.url)
        if (url.origin !== "https://graph.microsoft.com" || url.pathname !== "/v1.0/users" || url.username || url.password || url.hash || visited.has(url.href) || visited.size >= 10000) throw new Error("Invalid directory pagination")
        visited.add(url.href)
        const data = await graphRequest(accessToken, url.href)
        if (!Array.isArray(data.value)) throw new Error("Invalid directory response")
        if (people.length + data.value.length > limit) throw new Error("Directory exceeds configured limit")
        const pagePeople = data.value.map(directoryPerson)
        pagePeople.forEach((person) => {
          if (identities.has(person.id)) throw new Error("Duplicate directory identity")
          identities.add(person.id)
        })
        people.push(...pagePeople)
        if (data["@odata.count"] !== undefined) {
          const count = data["@odata.count"]
          if (typeof count !== "number" || !Number.isSafeInteger(count) || count < people.length || count > limit || (expected.count !== undefined && count !== expected.count)) throw new Error("Invalid directory count")
          expected.count = count
        }
        if (data["@odata.nextLink"] === undefined) {
          if (expected.count !== undefined && expected.count !== people.length) throw new Error("Incomplete directory pagination")
          return people
        }
        if (people.length >= limit) throw new Error("Incomplete directory pagination within configured limit")
        if (typeof data["@odata.nextLink"] !== "string" || !data["@odata.nextLink"]) throw new Error("Invalid directory pagination")
        page.url = data["@odata.nextLink"]
      }
    },
    async resolve(accessToken, rows) {
      const map = rows.map((row) => ({ ...row }))
      if (profile === "web-confidential" && map.some((row) => !emptyMap().some((canonical) => canonical.surface === row.surface && canonical.role === row.role))) throw new Error("Invalid product role mapping")
      const identity = await person(accessToken)
      const names = [...new Set(map.flatMap((row) => row.entra?.trim() ? [row.entra] : []))]
      const groups = await Promise.all(names.map(async (name) => {
        if (profile === "web-confidential") {
          if (!name.startsWith("group:") || !uuid.test(name.slice(6))) throw new Error("Immutable Entra group ID required")
          return { name, id: name.slice(6).toLowerCase() }
        }
        const url = new URL(`${graph}/groups`)
        url.search = new URLSearchParams({ "$filter": `displayName eq '${name.replaceAll("'", "''")}'`, "$select": "id,displayName", "$top": "2" }).toString()
        const data = await graphRequest(accessToken, url.href)
        if (!Array.isArray(data.value) || data.value.length > 1 || data["@odata.nextLink"] !== undefined) throw new Error("Ambiguous Entra group")
        if (data.value.length === 0) return { name, id: undefined }
        const value = record(data.value[0])
        if (value.displayName !== name || typeof value.id !== "string" || !uuid.test(value.id)) throw new Error("Invalid Entra group")
        return { name, id: value.id.toLowerCase() }
      }))
      const ids = [...new Set(groups.flatMap((group) => group.id ? [group.id] : []))]
      const members = new Set<string>()
      for (const offset of Array.from({ length: Math.ceil(ids.length / 20) }, (_, index) => index * 20)) {
        const requested = ids.slice(offset, offset + 20)
        const data = await graphRequest(accessToken, `${graph}/me/checkMemberGroups`, { groupIds: requested })
        if (!Array.isArray(data.value) || data.value.some((id) => typeof id !== "string" || (!uuid.test(id) || !requested.includes(id.toLowerCase())))) throw new Error("Invalid Entra membership response")
        data.value.forEach((id: string) => members.add(id.toLowerCase()))
      }
      const roles = map.flatMap((row) => groups.some((group) => group.name === row.entra && group.id && members.has(group.id)) ? [{ surface: row.surface, role: row.role }] : [])
      return { id: identity.id, roles, canWrite: roles.some((role) => role.role !== "viewer") }
    },
  }
  return Object.freeze(client)
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid Entra response shape")
  return value as Record<string, unknown>
}

function directoryPerson(value: unknown) {
  const person = record(value)
  if (typeof person.id !== "string" || !uuid.test(person.id) || typeof person.displayName !== "string" || !person.displayName.trim()) throw new Error("Invalid directory person")
  return { id: person.id.toLowerCase(), name: person.displayName }
}

function endpoint(value: unknown, paths: string[]) {
  if (typeof value !== "string" || !URL.canParse(value)) throw new Error("Invalid Entra endpoint")
  const url = new URL(value)
  if (url.origin !== "https://login.microsoftonline.com" || url.username || url.password || url.search || url.hash || !paths.includes(url.pathname)) throw new Error("Invalid Entra endpoint")
  return url.href
}

