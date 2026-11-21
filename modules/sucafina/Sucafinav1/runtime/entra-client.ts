import { createLocalJWKSet, jwtVerify } from "jose"
import type { EntraClient, EntraOptions, EntraTeamsInput, EntraTeamsResult, EntraTokens } from "./local-contract.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const graph = "https://graph.microsoft.com/v1.0"
const localScopes = "openid profile offline_access User.Read User.ReadBasic.All GroupMember.Read.All"
const bodyLimit = 2 * 1024 * 1024
const requestTimeout = 10000

export function createEntraClient(options: EntraOptions): EntraClient {
  if (!uuid.test(options.tenantId) || !uuid.test(options.clientId)) throw new Error("Invalid Entra configuration")
  const tenant = options.tenantId.toLowerCase()
  const teams = options.teams
  if (teams !== undefined && teams !== "direct") throw new Error("Invalid Teams capability")
  const scopes = teams === "direct" ? `${localScopes} Team.ReadBasic.All` : localScopes
  const authority = `https://login.microsoftonline.com/${tenant}`
  const issuer = `${authority}/v2.0`
  const now = options.now ?? (() => new Date())
  const send = options.fetch ?? ((request: Request) => fetch(request))
  const limit = options.directoryLimit ?? 10000
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw new Error("Invalid directory limit")

  async function request(url: string, init?: RequestInit, deadline?: AbortSignal, budget?: { bytes: number }) {
    const signal = deadline ?? AbortSignal.timeout(requestTimeout)
    if (signal.aborted) throw new EntraProviderFailure("timeout", "Entra provider request timed out")
    const aborted = Promise.withResolvers<never>()
    const abort = () => aborted.reject(new EntraProviderFailure("timeout", "Entra provider request timed out"))
    signal.addEventListener("abort", abort, { once: true })
    try {
      // An injected transport may ignore abort; the race still bounds its caller.
      return await Promise.race([readResponse(url, signal, init, budget), aborted.promise])
    } finally {
      signal.removeEventListener("abort", abort)
    }
  }

  async function readResponse(url: string, signal: AbortSignal, init?: RequestInit, budget?: { bytes: number }) {
    const response = await Promise.resolve().then(() => send(new Request(url, { ...init, redirect: "error", signal }))).catch(() => {
      throw new EntraProviderFailure(signal.aborted ? "timeout" : "provider_unavailable", "Entra provider request failed")
    })
    if (signal.aborted || !response.ok || response.redirected) {
      void response.body?.cancel().catch(() => undefined)
      const reason = signal.aborted ? "timeout" : response.redirected ? "invalid_response" : response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : response.status === 429 ? "throttled" : "provider_unavailable"
      throw new EntraProviderFailure(reason, "Entra provider request rejected", response.status === 429 ? retryAfter(response.headers.get("retry-after"), now().getTime()) : undefined)
    }
    const reader = response.body?.getReader()
    if (!reader) throw new EntraProviderFailure("invalid_response", "Empty Entra response")
    const cancel = () => { void reader.cancel().catch(() => undefined) }
    signal.addEventListener("abort", cancel, { once: true })
    const chunks: Uint8Array[] = []
    const size = { value: 0 }
    try {
      while (true) {
        const chunk = await reader.read()
        if (signal.aborted) throw new EntraProviderFailure("timeout", "Entra provider request timed out")
        if (chunk.done) break
        size.value += chunk.value.byteLength
        if (budget) budget.bytes += chunk.value.byteLength
        if (size.value > bodyLimit || (budget && budget.bytes > bodyLimit)) throw new EntraProviderFailure("limit_exceeded", "Response exceeds limit")
        chunks.push(chunk.value)
      }
      const bytes = new Uint8Array(size.value)
      const offset = { value: 0 }
      chunks.forEach((chunk) => { bytes.set(chunk, offset.value); offset.value += chunk.byteLength })
      return record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
    } catch (error) {
      if (budget && error instanceof EntraProviderFailure) throw error
      throw new EntraProviderFailure(signal.aborted ? "timeout" : "invalid_response", "Invalid Entra provider response")
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

  async function graphRequest(accessToken: string, url: string, body?: { groupIds: string[] }, deadline?: AbortSignal, budget?: { bytes: number }) {
    if (!accessToken || /[\x00-\x20\x7f]/.test(accessToken)) throw new Error("Invalid access token")
    if (!URL.canParse(url)) throw new Error("Invalid Graph endpoint")
    const target = new URL(url)
    if (target.origin !== "https://graph.microsoft.com" || !["/v1.0/me", "/v1.0/users", "/v1.0/groups", "/v1.0/me/checkMemberGroups", ...(teams === "direct" ? ["/v1.0/me/joinedTeams"] : [])].includes(target.pathname) || target.username || target.password || target.hash) throw new Error("Invalid Graph endpoint")
    if (body && target.pathname !== "/v1.0/me/checkMemberGroups") throw new Error("Invalid Graph method")
    return request(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, deadline, budget)
  }

  async function person(accessToken: string, deadline?: AbortSignal, budget?: { bytes: number }) {
    return directoryPerson(await graphRequest(accessToken, `${graph}/me?$select=id,displayName`, undefined, deadline, budget))
  }

  async function joinedTeams(input: EntraTeamsInput): Promise<EntraTeamsResult> {
    if (teams !== "direct") return Object.freeze({ state: "unavailable", reason: "capability_disabled" })
    // The caller supplies the verified session principal, never a selector/header identity.
    const tenantId = input.principal.tenantId.toLowerCase()
    const principalObjectId = input.principal.principalObjectId.toLowerCase()
    const tokens = { accessToken: input.tokens.accessToken, expiresAt: input.tokens.expiresAt, grantedScopes: [...(input.tokens.grantedScopes ?? [])] }
    if (!uuid.test(tenantId) || tenantId !== tenant || !uuid.test(principalObjectId)) return Object.freeze({ state: "unavailable", reason: "identity_mismatch" })
    if (!Number.isSafeInteger(tokens.expiresAt) || tokens.expiresAt <= now().getTime()) return Object.freeze({ state: "unavailable", reason: "token_expired" })
    if (!hasGraphScope(tokens.grantedScopes, "Team.ReadBasic.All")) return Object.freeze({ state: "unavailable", reason: "consent_required" })
    if (!tokens.accessToken || /[\x00-\x20\x7f]/.test(tokens.accessToken)) return Object.freeze({ state: "unavailable", reason: "unauthenticated" })
    // One operation owns the timer across all pages and completed request listeners.
    const controller = new AbortController()
    const deadline = controller.signal
    const timeout = setTimeout(() => controller.abort(), requestTimeout)
    const budget = { bytes: 0 }
    const found: { teamObjectId: string; name: string; archived: boolean }[] = []
    const visited = new Set<string>()
    const identities = new Set<string>()
    const expected: { count?: number } = {}
    const page = { url: `${graph}/me/joinedTeams` }
    try {
      if ((await person(tokens.accessToken, deadline, budget)).id !== principalObjectId) return Object.freeze({ state: "unavailable", reason: "identity_mismatch" })
      while (true) {
        if (tokens.expiresAt <= now().getTime()) return Object.freeze({ state: "unavailable", reason: "token_expired" })
        if (!URL.canParse(page.url) || /[\\\x00-\x20\x7f]/.test(page.url) || page.url.length > 16384) throw new EntraProviderFailure("invalid_response", "Invalid Teams pagination")
        const url = new URL(page.url)
        const parameters = [...url.searchParams]
        if (url.origin !== "https://graph.microsoft.com" || url.pathname !== "/v1.0/me/joinedTeams" || url.username || url.password || url.hash || parameters.some(([key, value]) => !["$skiptoken", "$skip"].includes(key) || !value) || new Set(parameters.map(([key]) => key)).size !== parameters.length || visited.has(url.href)) throw new EntraProviderFailure("invalid_response", "Invalid Teams pagination")
        if (visited.size >= 100) throw new EntraProviderFailure("limit_exceeded", "Teams page limit exceeded")
        visited.add(url.href)
        const data = await graphRequest(tokens.accessToken, url.href, undefined, deadline, budget)
        if (!Array.isArray(data.value)) throw new EntraProviderFailure("invalid_response", "Invalid Teams response")
        if (found.length + data.value.length > limit) throw new EntraProviderFailure("limit_exceeded", "Teams count limit exceeded")
        for (const entry of data.value) {
          const team = record(entry)
          if (typeof team.id !== "string" || !uuid.test(team.id) || typeof team.tenantId !== "string" || !uuid.test(team.tenantId) || team.tenantId.toLowerCase() !== tenant || typeof team.displayName !== "string" || !team.displayName.trim() || typeof team.isArchived !== "boolean" || (team["@odata.type"] !== undefined && team["@odata.type"] !== "#microsoft.graph.team") || team.membershipType !== undefined) throw new EntraProviderFailure("invalid_response", "Invalid Teams identity")
          const teamObjectId = team.id.toLowerCase()
          if (identities.has(teamObjectId)) throw new EntraProviderFailure("invalid_response", "Duplicate Teams identity")
          identities.add(teamObjectId)
          found.push({ teamObjectId, name: team.displayName, archived: team.isArchived })
        }
        if (data["@odata.count"] !== undefined) {
          const count = data["@odata.count"]
          if (typeof count !== "number" || !Number.isSafeInteger(count) || count < found.length || count > limit || (expected.count !== undefined && expected.count !== count)) throw new EntraProviderFailure("invalid_response", "Invalid Teams count")
          expected.count = count
        }
        if (data["@odata.nextLink"] === undefined) {
          // joinedTeams does not support a requested $count; absent count is legal.
          // If Graph supplied a total, exhausting nextLink must account for every row.
          if (expected.count !== undefined && expected.count !== found.length) throw new EntraProviderFailure("incomplete", "Incomplete Teams pagination")
          if ((await person(tokens.accessToken, deadline, budget)).id !== principalObjectId) return Object.freeze({ state: "unavailable", reason: "identity_mismatch" })
          if (tokens.expiresAt <= now().getTime()) return Object.freeze({ state: "unavailable", reason: "token_expired" })
          return Object.freeze({ state: "complete", tenantId, principalObjectId, source: "joinedTeams", membership: "direct", teams: Object.freeze(found.map((team) => Object.freeze(team))) })
        }
        if (found.length >= limit) throw new EntraProviderFailure("limit_exceeded", "Incomplete Teams pagination within configured limit")
        if (typeof data["@odata.nextLink"] !== "string" || !data["@odata.nextLink"]) throw new EntraProviderFailure("invalid_response", "Invalid Teams pagination")
        page.url = data["@odata.nextLink"]
      }
    } catch (error) {
      if (error instanceof EntraProviderFailure) return Object.freeze({ state: "unavailable", reason: error.reason, ...(error.retryAfterMs === undefined ? {} : { retryAfterMs: error.retryAfterMs }) })
      return Object.freeze({ state: "unavailable", reason: "invalid_response" })
    } finally {
      clearTimeout(timeout)
    }
  }

  async function redeem(url: string, fields: Record<string, string>) {
    const form = new URLSearchParams({ client_id: options.clientId, ...fields })
    // Keep the original delegated grant on refresh. A fresh login requests Teams consent.
    if (teams !== "direct" || fields.grant_type !== "refresh_token") form.set("scope", scopes)
    const data = await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    })
    if (data.error !== undefined || typeof data.access_token !== "string" || !data.access_token.trim() || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("Invalid Entra token response")
    if (data.refresh_token !== undefined && (typeof data.refresh_token !== "string" || !data.refresh_token.trim())) throw new Error("Invalid refresh token response")
    if (data.id_token !== undefined && (typeof data.id_token !== "string" || !data.id_token.trim())) throw new Error("Invalid identity token response")
    const grantedScopes = teams === "direct" && data.scope !== undefined ? parseGrantedScopes(data.scope) : undefined
    const tokens: EntraTokens = {
      accessToken: data.access_token,
      ...(grantedScopes === undefined ? {} : { grantedScopes }),
      expiresAt: now().getTime() + data.expires_in * 1000,
      ...(typeof data.refresh_token === "string" ? { refreshToken: data.refresh_token } : {}),
      ...(typeof data.id_token === "string" ? { idToken: data.id_token } : {}),
    }
    if (!Number.isSafeInteger(tokens.expiresAt)) throw new Error("Invalid token expiration")
    return tokens
  }

  return {
    ...(teams === "direct" ? { tenantId: tenant, joinedTeams } : {}),
    async authorization(input) {
      const metadata = await discovery()
      const url = new URL(metadata.authorize)
      url.search = new URLSearchParams({ client_id: options.clientId, response_type: "code", response_mode: "query", redirect_uri: input.redirectUri, scope: scopes, state: input.state, nonce: input.nonce, code_challenge: input.challenge, code_challenge_method: "S256" }).toString()
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
      const verified = await Promise.resolve().then(() => jwtVerify(tokens.idToken!, createLocalJWKSet({ keys: signingKeys }), { algorithms: ["RS256"], issuer, audience: options.clientId, currentDate: now(), requiredClaims: ["exp", "iat", "tid", "oid", "nonce"] })).catch(() => {
        throw new Error("Entra identity verification failed")
      })
      if ((typeof verified.payload.tid !== "string" || verified.payload.tid.toLowerCase() !== tenant) || typeof verified.payload.oid !== "string" || !uuid.test(verified.payload.oid) || verified.payload.nonce !== input.nonce || typeof verified.payload.iat !== "number" || verified.payload.iat > Math.floor(now().getTime() / 1000)) throw new Error("Invalid Entra identity claims")
      const identity = await person(tokens.accessToken)
      if (identity.id !== verified.payload.oid.toLowerCase()) throw new Error("Entra identity mismatch")
      return { tokens, person: identity }
    },
    async refresh(refreshToken) {
      if (!refreshToken) throw new Error("Missing refresh token")
      return redeem((await discovery()).token, { grant_type: "refresh_token", refresh_token: refreshToken })
    },
    person,
    async directory(accessToken) {
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
    async resolve(accessToken, map) {
      const identity = await person(accessToken)
      const names = [...new Set(map.flatMap((row) => row.entra?.trim() ? [row.entra] : []))]
      const groups = await Promise.all(names.map(async (name) => {
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

class EntraProviderFailure extends Error {
  constructor(readonly reason: Extract<EntraTeamsResult, { state: "unavailable" }>["reason"], message: string, readonly retryAfterMs?: number) {
    super(message)
  }
}

function hasGraphScope(scopes: readonly string[], scope: string) {
  return scopes.some((granted) => [scope, `https://graph.microsoft.com/${scope}`, `https%3A%2F%2Fgraph.microsoft.com%2F${scope}`].includes(granted))
}

function retryAfter(value: string | null, at: number) {
  if (!value) return undefined
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - at
  return Number.isSafeInteger(delay) && delay >= 0 && delay <= 86400000 ? delay : undefined
}

function parseGrantedScopes(value: unknown): readonly string[] {
  if (typeof value !== "string" || !value.trim() || /[\x00-\x1f\x7f]/.test(value))
    throw new Error("Invalid Entra token scope")
  const scopes = value.split(" ").filter(Boolean)
  if (scopes.length > 100 || scopes.some((scope) => scope.length > 256) || new Set(scopes).size !== scopes.length)
    throw new Error("Invalid Entra token scope")
  return Object.freeze(scopes)
}
