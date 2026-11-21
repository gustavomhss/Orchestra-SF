import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import type { CorporateLocalSecrets, DirectoryPerson, EntraClient, EntraTeamsInput, EntraTeamsObservation, EntraTeamsResult, EntraTokens, LocalIdentity, LocalSecrets } from "./local-contract.ts"
import { isTeamLandingNavigation, teamBusinessRoute } from "./team-profile-selector.ts"

type Session = {
  person: DirectoryPerson
  tokens: EntraTokens
  expiresAt: number
  teamPrincipal?: EntraTeamsInput["principal"]
}
type Login = { nonce: string; verifier: string; returnTo: string }
const entraObjectId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type IdentityOptions = {
  origin: string
  mount: string
  client: EntraClient
  secrets: LocalSecrets
  key: Uint8Array
  now?: () => Date
  sessionSeconds?: number
  loginSeconds?: number
  nativeWeb?: boolean
}

/** The local profile is explicitly bound to loopback. */
export function createLocalIdentity(options: IdentityOptions): LocalIdentity {
  const origin = new URL(options.origin)
  if (origin.origin !== options.origin || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || !["http:", "https:"].includes(origin.protocol))
    throw new Error("Explicit loopback origin required")
  if (options.client.profile === "web-confidential") throw new Error("Confidential client requires Microsoft HTTPS identity")
  return createIdentity(options, origin)
}

/** Separate HTTPS identity for an owner-selected confidential Entra application. */
export function createMicrosoftIdentity(options: IdentityOptions & { tenantId: string; clientId: string; secrets: CorporateLocalSecrets }): LocalIdentity {
  const origin = new URL(options.origin)
  if (origin.origin !== options.origin || origin.protocol !== "https:" || origin.port || isIP(origin.hostname) ||
      origin.hostname.startsWith("[") || !origin.hostname.includes(".") || origin.hostname.endsWith(".local") ||
      origin.hostname.endsWith(".localhost") || origin.hostname.endsWith(".") || origin.hostname.includes(".."))
    throw new Error("Explicit Microsoft HTTPS origin required")
  if (!entraObjectId.test(options.tenantId) || !entraObjectId.test(options.clientId) ||
      options.client.tenantId !== options.tenantId || options.client.clientId !== options.clientId ||
      options.client.profile !== "web-confidential")
    throw new Error("Fixed Microsoft tenant and confidential client required")
  const namespace = createHash("sha256").update(JSON.stringify(["microsoft", options.origin, options.mount, options.tenantId, options.clientId])).digest("hex")
  return createIdentity(options, origin, { namespace, secrets: options.secrets })
}

/** Browser cookies carry opaque handles while the private store holds encrypted credentials. */
function createIdentity(
  options: IdentityOptions,
  origin: URL,
  corporate?: { namespace: string; secrets: CorporateLocalSecrets },
): LocalIdentity {
  const namespace = corporate?.namespace
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount) || options.key.byteLength !== 32)
    throw new Error("Invalid local identity configuration")
  const now = () => (options.now?.() ?? new Date()).getTime()
  const key = Buffer.from(options.key)
  const sessionSeconds = options.sessionSeconds ?? 28800
  const loginSeconds = options.loginSeconds ?? 600
  if (![sessionSeconds, loginSeconds].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Invalid session lifetime")
  const cookiePrefix = namespace ? `__Secure-sucafina_${namespace.slice(0, 12)}` :
    `sucafina_${createHash("sha256").update(options.mount).digest("hex").slice(0, 12)}`
  const refreshing = new Map<string, Promise<void>>()
  const configuredTenant = options.client.tenantId
  const teamTenant = configuredTenant && entraObjectId.test(configuredTenant) ? configuredTenant.toLowerCase() : undefined
  const readTeams = options.client.joinedTeams?.bind(options.client)
  const readActiveSession = options.secrets.getActive?.bind(options.secrets)
  const slot = (kind: string, handle: string) =>
    `${namespace ? namespace + ":" : ""}${kind}:${createHash("sha256").update(handle).digest("hex")}`
  const cookie = (kind: string, value: string, seconds: number) => `${cookiePrefix}_${kind}=${value}; Path=${options.mount}; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin.protocol === "https:" ? "; Secure" : ""}`
  const handle = (request: Request, kind: string) => {
    const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${cookiePrefix}_${kind}=`))
    if (values.length !== 1) return undefined
    const value = values[0].slice(values[0].indexOf("=") + 1)
    return /^[a-f0-9]{64}$/.test(value) ? value : undefined
  }
  const seal = (storageKey: string, value: unknown) => {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    cipher.setAAD(Buffer.from(storageKey))
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
    return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted])
  }
  const open = (storageKey: string, value: Uint8Array) => {
    if (value.length < 30 || value[0] !== 1) throw new Error("Invalid encrypted credential")
    const decipher = createDecipheriv("aes-256-gcm", key, value.slice(1, 13))
    decipher.setAAD(Buffer.from(storageKey))
    decipher.setAuthTag(value.slice(13, 29))
    return JSON.parse(Buffer.concat([decipher.update(value.slice(29)), decipher.final()]).toString("utf8")) as unknown
  }
  const readSession = async (storageKey: string, encrypted: Uint8Array | undefined) => {
    if (!encrypted) return undefined
    const value = await Promise.resolve().then(() => open(storageKey, encrypted)).catch(() => undefined)
    return validSession(value) && value.expiresAt > now() ? value : undefined
  }
  const session = async (request: Request) => {
    const id = handle(request, "session")
    if (!id) return undefined
    const storageKey = slot("session", id)
    const revokedKey = slot("revoked", id)
    if (!corporate && await options.secrets.get(revokedKey, now())) return undefined
    const encrypted = corporate
      ? await corporate.secrets.getActive(storageKey, revokedKey, now())
      : await options.secrets.get(storageKey, now())
    const value = await readSession(storageKey, encrypted)
    return encrypted && value && { handle: id, value, encrypted }
  }
  const ready = async (request: Request) => {
    const current = await session(request)
    if (!current || current.value.tokens.expiresAt <= now()) return undefined
    return current
  }
  const teamReadCurrent = async (request: Request) => {
    const url = new URL(request.url)
    if (request.signal.aborted || url.origin !== origin.origin ||
        !(url.pathname === options.mount || url.pathname.startsWith(options.mount + "/")) ||
        (request.headers.get("sec-fetch-site") === "cross-site" && !isTeamLandingNavigation(request, url, options.mount)) ||
        (request.headers.has("origin") && request.headers.get("origin") !== origin.origin)) return undefined
    const id = handle(request, "session")
    if (!id || !readActiveSession) return undefined
    const storageKey = slot("session", id)
    const encrypted = await readActiveSession(storageKey, slot("revoked", id), now())
    const value = await readSession(storageKey, encrypted)
    if (request.signal.aborted || !encrypted || !value || !value.teamPrincipal ||
        value.teamPrincipal.tenantId !== teamTenant || value.tokens.expiresAt <= now() ||
        refreshing.has(id)) return undefined
    return { handle: id, value, encrypted }
  }
  const readTeamMembers = options.client.teamMembers?.bind(options.client)
  const observeTeams = readTeams && teamTenant && readActiveSession
    ? async (request: Request): Promise<EntraTeamsObservation> => {
      const current = await teamReadCurrent(request)
      const principal = current?.value.teamPrincipal
      if (!current || !principal) return { result: { state: "unauthenticated" } }
      const verifyCurrent = async () => {
        const latest = await teamReadCurrent(request)
        // A refresh always seals fresh ciphertext, even if Entra returns identical credential fields.
        return !!latest && latest.handle === current.handle && latest.encrypted.byteLength === current.encrypted.byteLength &&
          timingSafeEqual(latest.encrypted, current.encrypted)
      }
      const tokens = current.value.tokens
      const result = await readTeams({
        principal: { ...principal },
        tokens: { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt, grantedScopes: tokens.grantedScopes },
      }).catch((): EntraTeamsResult => ({ state: "unavailable", reason: "provider_unavailable" }))
      if (!await verifyCurrent()) return { result: { state: "unauthenticated" } }
      if (result.state === "complete" &&
          (result.tenantId !== principal.tenantId || result.principalObjectId !== principal.principalObjectId))
        return { result: { state: "unavailable", reason: "identity_mismatch" } }
      return {
        result, verifyCurrent,
        ...(result.state === "complete" && readTeamMembers ? {
          async readMembers(teamObjectId: string) {
            if (!result.teams.some((team) => team.teamObjectId === teamObjectId && !team.archived) || !await verifyCurrent())
              throw new Error("Microsoft Team directory session unavailable")
            const members = await readTeamMembers({ principal: { ...principal }, tokens, teamObjectId })
            if (!await verifyCurrent()) throw new Error("Microsoft Team directory session unavailable")
            return members
          },
        } : {}),
      }
    }
    : undefined
  const observeCorporateRecoveryActor: LocalIdentity["observeCorporateRecoveryActor"] = corporate && observeTeams
    ? async (request, groupId) => {
      if (request.method !== "POST" || request.headers.get("origin") !== origin.origin ||
          request.headers.get("sec-fetch-site") === "cross-site" || !entraObjectId.test(groupId)) return undefined
      const current = await teamReadCurrent(request).catch(() => undefined)
      const principalId = current?.value.teamPrincipal?.principalObjectId
      if (!current || !principalId) return undefined
      const sameSession = async () => {
        const latest = await teamReadCurrent(request).catch(() => undefined)
        return !!latest && latest.handle === current.handle && latest.encrypted.byteLength === current.encrypted.byteLength &&
          timingSafeEqual(latest.encrypted, current.encrypted)
      }
      const verifyCurrent = async () => {
        if (request.method !== "POST" || request.headers.get("origin") !== origin.origin ||
            request.headers.get("sec-fetch-site") === "cross-site" || !await sameSession()) return false
        const actor = await options.client.resolve(current.value.tokens.accessToken, [
          { surface: "dashboard", role: "admin", entra: "group:" + groupId.toLowerCase() },
        ]).catch(() => undefined)
        return !!actor?.canWrite && actor.id === principalId &&
          actor.roles.some((row) => row.surface === "dashboard" && row.role === "admin") && await sameSession()
      }
      return await verifyCurrent() ? Object.freeze({ principalId, verifyCurrent }) : undefined
    }
    : undefined
  const retireSession = async (id: string) => {
    const storageKey = slot("session", id)
    const revokedKey = slot("revoked", id)
    if (corporate) return corporate.secrets.retireSession(storageKey, revokedKey, now())
    await options.secrets.put(revokedKey, new Uint8Array([1]), now() + sessionSeconds * 1000)
    await options.secrets.remove(storageKey)
  }
  const headers = () => new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" })
  const error = (status: number) => new Response("Authentication unavailable", { status, headers: headers() })
  return {
    ...(observeCorporateRecoveryActor ? { observeCorporateRecoveryActor } : {}),
    async handle(request) {
      const url = new URL(request.url)
      const path = url.pathname.slice(options.mount.length)
      if (!url.pathname.startsWith(`${options.mount}/auth/`)) return undefined
      if (url.origin !== options.origin) return error(403)
      if (path === "/auth/logout") {
        if (request.method !== "POST") return error(405)
        if (request.headers.get("origin") !== options.origin || request.headers.get("sec-fetch-site") === "cross-site") return error(403)
        const id = handle(request, "session")
        if (id) await retireSession(id)
        const responseHeaders = headers()
        responseHeaders.append("set-cookie", cookie("session", "", 0))
        responseHeaders.append("set-cookie", cookie("login", "", 0))
        return new Response(null, { status: 204, headers: responseHeaders })
      }
      if (request.method !== "GET") return error(405)
      if (path === "/auth/login") {
        const state = randomBytes(32).toString("hex")
        const verifier = randomBytes(32).toString("base64url")
        const returnTo = url.searchParams.get("returnTo")
        const login: Login = {
          nonce: randomBytes(32).toString("hex"), verifier,
          returnTo: safeReturn(corporate && returnTo && returnTo.length > 2048 ? null : returnTo, options.mount, !!corporate && !!observeTeams, !!corporate && options.nativeWeb === true),
        }
        const storageKey = slot("login", state)
        const issuedAt = now()
        const expiresAt = issuedAt + loginSeconds * 1000
        if (corporate && !await corporate.secrets.issueLogin(corporate.namespace, storageKey, seal(storageKey, login), issuedAt, expiresAt))
          return error(429)
        const destination = await options.client.authorization({ state, nonce: login.nonce, challenge: createHash("sha256").update(verifier).digest("base64url"), redirectUri: `${options.origin}${options.mount}/auth/callback` }).catch(() => undefined)
        if (!destination || (corporate && expiresAt <= now())) {
          if (corporate) await corporate.secrets.remove(storageKey)
          return error(503)
        }
        if (!corporate) await options.secrets.put(storageKey, seal(storageKey, login), now() + loginSeconds * 1000)
        const responseHeaders = headers()
        responseHeaders.set("location", destination)
        responseHeaders.append("set-cookie", cookie("login", state, loginSeconds))
        return new Response(null, { status: 303, headers: responseHeaders })
      }
      if (path !== "/auth/callback") return error(404)
      const state = url.searchParams.get("state")
      const browserState = handle(request, "login")
      if (!state || !browserState || !/^[a-f0-9]{64}$/.test(state) || !timingSafeEqual(Buffer.from(state), Buffer.from(browserState))) return error(403)
      const storageKey = slot("login", state)
      const stored = await options.secrets.take(storageKey, now())
      const login = stored ? await Promise.resolve().then(() => open(storageKey, stored)).catch(() => undefined) : undefined
      const responseHeaders = headers()
      responseHeaders.append("set-cookie", cookie("login", "", 0))
      if (!validLogin(login) || !url.searchParams.get("code") || url.searchParams.has("error")) return new Response("Authentication unavailable", { status: 403, headers: responseHeaders })
      const result = await options.client.exchange({ code: url.searchParams.get("code")!, verifier: login.verifier, nonce: login.nonce, redirectUri: `${options.origin}${options.mount}/auth/callback` }).catch(() => undefined)
      if (!result || !validPerson(result.person) || !validTokens(result.tokens) || result.tokens.expiresAt <= now()) return new Response("Authentication unavailable", { status: 403, headers: responseHeaders })
      const previous = handle(request, "session")
      if (previous) await retireSession(previous)
      const id = randomBytes(32).toString("hex")
      const value: Session = {
        ...result,
        expiresAt: now() + sessionSeconds * 1000,
        ...(readTeams && teamTenant && readActiveSession ? { teamPrincipal: {
          tenantId: teamTenant, principalObjectId: result.person.id.toLowerCase(),
        } } : {}),
      }
      await options.secrets.put(slot("session", id), seal(slot("session", id), value), value.expiresAt)
      responseHeaders.append("set-cookie", cookie("session", id, sessionSeconds))
      responseHeaders.set("location", safeReturn(login.returnTo, options.mount, !!corporate && !!observeTeams, !!corporate && options.nativeWeb === true))
      return new Response(null, { status: 303, headers: responseHeaders })
    },
    async prepare(request) {
      const current = await session(request)
      if (!current || current.value.tokens.expiresAt > now() + 60000) return
      const pending = refreshing.get(current.handle)
      if (pending) return pending
      const work = (async () => {
        if (!current.value.tokens.refreshToken) return
        const refreshed = await options.client.refresh(current.value.tokens.refreshToken).catch(() => undefined)
        if (!refreshed || !validTokens(refreshed) || refreshed.expiresAt <= now()) return
        const person = await options.client.person(refreshed.accessToken).catch(() => undefined)
        if (!validPerson(person) || person.id !== current.value.person.id) return
        const storageKey = slot("session", current.handle)
        const value: Session = { ...current.value, person, tokens: { ...refreshed, refreshToken: refreshed.refreshToken ?? current.value.tokens.refreshToken, idToken: refreshed.idToken ?? current.value.tokens.idToken } }
        if (corporate)
          return corporate.secrets.refreshSession(storageKey, slot("revoked", current.handle), current.encrypted, seal(storageKey, value), now())
        // A durable revocation marker also rejects a refresh that races with logout.
        if (await options.secrets.get(storageKey, now()))
          await options.secrets.put(storageKey, seal(storageKey, value), value.expiresAt)
      })().finally(() => refreshing.delete(current.handle))
      refreshing.set(current.handle, work)
      await work
    },
    ...(observeTeams ? {
      observeTeams,
      async teamDirectory(request: Request) { return (await observeTeams(request)).result },
    } : {}),
    async authenticate(request, context) {
      const current = await ready(request)
      if (!current || !context) return null
      const actor = await options.client.resolve(current.value.tokens.accessToken, context.roleMap.filter((row) => row.surface === context.surface)).catch(() => null)
      return actor?.id === current.value.person.id ? actor : null
    },
    async directory(request) {
      const current = await ready(request)
      if (!current) return []
      return options.client.directory(current.value.tokens.accessToken)
    },
    async person(request) { return (await ready(request))?.value.person ?? null },
  }
}

function validPerson(value: unknown): value is DirectoryPerson {
  return value !== null && typeof value === "object" && "id" in value && typeof value.id === "string" && entraObjectId.test(value.id) && "name" in value && typeof value.name === "string" && Boolean(value.name.trim())
}
function validTokens(value: unknown): value is EntraTokens {
  return value !== null && typeof value === "object" && "accessToken" in value && typeof value.accessToken === "string" && Boolean(value.accessToken) && "expiresAt" in value && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt) && (!("refreshToken" in value) || value.refreshToken === undefined || typeof value.refreshToken === "string") && (!("idToken" in value) || value.idToken === undefined || typeof value.idToken === "string") &&
    (!("grantedScopes" in value) || value.grantedScopes === undefined ||
      (Array.isArray(value.grantedScopes) && value.grantedScopes.length <= 100 &&
        value.grantedScopes.every((scope: unknown) => typeof scope === "string" && scope.length > 0 &&
          scope.length <= 256 && !/[\x00-\x20\x7f]/.test(scope)) &&
        new Set(value.grantedScopes).size === value.grantedScopes.length))
}
function validSession(value: unknown): value is Session {
  if (!value || typeof value !== "object" || !("person" in value) || !validPerson(value.person) ||
      !("tokens" in value) || !validTokens(value.tokens) || !("expiresAt" in value) ||
      typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt)) return false
  if (!("teamPrincipal" in value)) return true
  const principal = value.teamPrincipal
  return !!principal && typeof principal === "object" && "tenantId" in principal &&
    typeof principal.tenantId === "string" && entraObjectId.test(principal.tenantId) &&
    "principalObjectId" in principal && principal.principalObjectId === value.person.id.toLowerCase()
}
function validLogin(value: unknown): value is Login {
  return value !== null && typeof value === "object" && "nonce" in value && typeof value.nonce === "string" && /^[a-f0-9]{64}$/.test(value.nonce) && "verifier" in value && typeof value.verifier === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.verifier) && "returnTo" in value && typeof value.returnTo === "string"
}
function safeReturn(value: string | null, mount: string, teams: boolean, nativeWeb: boolean) {
  if (nativeWeb && value === "/") return "/"
  const fallback = `${mount}/dashboard`
  if (!value || !value.startsWith(`${mount}/`) || /[\\\r\n]/.test(value)) return fallback
  const parsed = new URL(value, "http://localhost")
  if (parsed.origin !== "http://localhost") return fallback
  if (teams && teamBusinessRoute(parsed.pathname, mount)) return parsed.pathname
  return ["dashboard", "planner", "procurement"].some((surface) => parsed.pathname === `${mount}/${surface}`) ? `${parsed.pathname}${parsed.search}` : fallback
}
