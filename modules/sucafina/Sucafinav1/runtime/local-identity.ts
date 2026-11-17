import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import type { DirectoryPerson, EntraClient, EntraTokens, LocalIdentity, LocalSecrets } from "./local-contract.ts"

type Session = { person: DirectoryPerson; tokens: EntraTokens; expiresAt: number; createdAt: number; login: string }
type Login = { nonce: string; verifier: string; returnTo: string; expiresAt: number }

type IdentityOptions = {
  origin: string
  mount: string
  client: EntraClient
  secrets: LocalSecrets
  key: Uint8Array
  now?: () => Date
  sessionSeconds?: number
  loginSeconds?: number
}

/** The local composition remains explicitly restricted to loopback. */
export function createLocalIdentity(options: IdentityOptions): LocalIdentity {
  const origin = new URL(options.origin)
  if (origin.origin !== options.origin || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || !["http:", "https:"].includes(origin.protocol))
    throw new Error("Explicit loopback origin required")
  return createIdentity(options, ["local", options.client.tenantId ?? "", options.client.clientId ?? ""])
}

/** Owner-selected HTTPS composition of the same engine, with a fixed resource tenant and confidential client. */
export function createMicrosoftIdentity(options: IdentityOptions & { tenantId: string; clientId: string }): LocalIdentity {
  const origin = new URL(options.origin)
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  if (origin.origin !== options.origin || origin.protocol !== "https:" || origin.port || isIP(origin.hostname) || origin.hostname.startsWith("[") || !origin.hostname.includes(".") || origin.hostname.endsWith(".local") || origin.hostname.endsWith(".localhost") || origin.hostname.endsWith(".") || origin.hostname.includes(".."))
    throw new Error("Explicit HTTPS origin required")
  if (!uuid.test(options.tenantId) || !uuid.test(options.clientId) || options.client.tenantId !== options.tenantId || options.client.clientId !== options.clientId || options.client.profile !== "web-confidential")
    throw new Error("Fixed Microsoft tenant and confidential client required")
  if (!options.secrets.authentication) throw new Error("Durable authentication lifecycle required")
  return createIdentity(options, ["microsoft", options.tenantId, options.clientId])
}

/** Cookies contain opaque handles; credentials and PKCE material stay encrypted in the private store. */
function createIdentity(input: IdentityOptions, binding: string[]): LocalIdentity {
  const options = Object.freeze({ ...input, client: Object.freeze({ ...input.client }), secrets: Object.freeze({ ...input.secrets,
    ...(input.secrets.authentication ? { authentication: Object.freeze({ ...input.secrets.authentication }) } : {}),
  }) })
  const origin = new URL(options.origin)
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount) || options.key.byteLength !== 32)
    throw new Error("Invalid identity configuration")
  const now = () => (options.now?.() ?? new Date()).getTime()
  const key = Buffer.from(options.key)
  const sessionSeconds = options.sessionSeconds ?? 28800
  const loginSeconds = options.loginSeconds ?? 600
  if (![sessionSeconds, loginSeconds].every((value) => Number.isSafeInteger(value) && value > 0) || sessionSeconds > 28800 || loginSeconds > 600) throw new Error("Invalid session lifetime")
  const namespace = createHash("sha256").update(JSON.stringify([options.origin, options.mount, ...binding])).digest("hex")
  const cookiePrefix = `${origin.protocol === "https:" ? "__Secure-" : ""}sucafina_${namespace.slice(0, 12)}`
  const refreshing = new Map<string, Promise<void>>()
  const retiring = new Map<string, number>()
  const slot = (kind: string, handle: string) => `${namespace}:${kind}:${createHash("sha256").update(handle).digest("hex")}`
  const trusted = (request: Request) => {
    const url = new URL(request.url)
    return url.origin === options.origin && (url.pathname === options.mount || url.pathname.startsWith(`${options.mount}/`))
  }
  const revoked = async (kind: string, id: string) => {
    // The final synchronous lookup sees committed revocation even if an earlier
    // credential read was admitted before another instance completed logout.
    if (options.secrets.authentication) {
      const auth = options.secrets.authentication
      const storageKey = slot(kind, id)
      if (auth.inspect(storageKey, now())?.state === "revoked") return true
      const legacy = await options.secrets.get(slot(`revoked-${kind}`, id), now())
      return Boolean(legacy) || auth.inspect(storageKey, now())?.state === "revoked"
    }
    const storageKey = slot(`revoked-${kind}`, id)
    return (retiring.get(storageKey) ?? 0) > now() || Boolean(await options.secrets.get(storageKey, now())) || (retiring.get(storageKey) ?? 0) > now()
  }
  const retire = async (kind: string, id: string) => {
    if (options.secrets.authentication) {
      // revoke inspects issuance and installs its immediate fence synchronously;
      // an unknown cookie neither allocates a fence nor acquires a write slot.
      await options.secrets.authentication.revoke(slot(kind, id), now())
      return
    }
    const storageKey = slot(`revoked-${kind}`, id)
    retiring.forEach((expires, key) => { if (expires <= now()) retiring.delete(key) })
    // Fence pending work immediately, including reads inside an older business transaction.
    // Cover every allowed session lifetime, including another instance with a different shorter setting.
    // A cancelled login also covers its remaining challenge lifetime before any late session write.
    const expiresAt = now() + (28800 + (kind === "login" ? 600 : 0)) * 1000
    retiring.set(storageKey, expiresAt)
    await options.secrets.put(storageKey, new Uint8Array([1]), expiresAt)
    await options.secrets.remove(slot(kind, id))
  }
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
  const session = async (request: Request): Promise<{ handle: string; value: Session } | undefined> => {
    if (!trusted(request)) return undefined
    const id = handle(request, "session")
    if (!id || await revoked("session", id)) return undefined
    const storageKey = slot("session", id)
    const encrypted = await options.secrets.get(storageKey, now())
    if (!encrypted) return undefined
    const value = await Promise.resolve().then(() => open(storageKey, encrypted)).catch(() => undefined)
    if (!validSession(value) || value.createdAt > now() || value.expiresAt <= now() || value.expiresAt - value.createdAt > sessionSeconds * 1000) return undefined
    if (await revoked("login", value.login) || await revoked("session", id) || value.expiresAt <= now()) return undefined
    return { handle: id, value }
  }
  const ready = async (request: Request) => {
    const current = await session(request)
    if (!current || current.value.tokens.expiresAt <= now()) return undefined
    return current
  }
  const headers = () => new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" })
  const error = (status: number) => new Response("Authentication unavailable", { status, headers: headers() })
  return {
    async handle(request) {
      const url = new URL(request.url)
      const path = url.pathname.slice(options.mount.length)
      if (!url.pathname.startsWith(`${options.mount}/auth/`)) return undefined
      if (url.origin !== options.origin) return error(403)
      if (path === "/auth/logout") {
        if (request.method !== "POST") return error(405)
        if (request.headers.get("origin") !== options.origin || request.headers.get("sec-fetch-site") === "cross-site") return error(403)
        const id = handle(request, "session")
        const login = handle(request, "login")
        const retired = await Promise.all([...(login ? [retire("login", login)] : []), ...(id ? [retire("session", id)] : [])]).then(() => true, () => false)
        if (!retired) return error(503)
        const responseHeaders = headers()
        responseHeaders.append("set-cookie", cookie("session", "", 0))
        responseHeaders.append("set-cookie", cookie("login", "", 0))
        return new Response(null, { status: 204, headers: responseHeaders })
      }
      if (request.method !== "GET") return error(405)
      if (path === "/auth/login") {
        const state = randomBytes(32).toString("hex")
        const verifier = randomBytes(32).toString("base64url")
        const login: Login = { nonce: randomBytes(32).toString("hex"), verifier, returnTo: safeReturn(url.searchParams.get("returnTo"), options.mount), expiresAt: now() + loginSeconds * 1000 }
        const admitted = options.secrets.authentication
          ? await options.secrets.authentication.issue({ key: slot("login", state), value: seal(slot("login", state), login), expiresAt: login.expiresAt, at: now() }).catch(() => false)
          : await options.secrets.put(slot("login", state), seal(slot("login", state), login), login.expiresAt).then(() => true)
        if (!admitted) return error(503)
        const destination = await options.client.authorization({ state, nonce: login.nonce, challenge: createHash("sha256").update(verifier).digest("base64url"), redirectUri: `${options.origin}${options.mount}/auth/callback` }).catch(() => undefined)
        if (!destination || login.expiresAt <= now()) { await retire("login", state); return error(503) }
        const responseHeaders = headers()
        responseHeaders.set("location", destination)
        responseHeaders.append("set-cookie", cookie("login", state, loginSeconds))
        return new Response(null, { status: 303, headers: responseHeaders })
      }
      if (path !== "/auth/callback") return error(404)
      const state = url.searchParams.get("state")
      const browserState = handle(request, "login")
      if (!state || !browserState || url.searchParams.getAll("state").length !== 1 || !/^[a-f0-9]{64}$/.test(state) || !timingSafeEqual(Buffer.from(state), Buffer.from(browserState))) return error(403)
      const storageKey = slot("login", state)
      const stored = await options.secrets.take(storageKey, now())
      const login = stored ? await Promise.resolve().then(() => open(storageKey, stored)).catch(() => undefined) : undefined
      const responseHeaders = headers()
      responseHeaders.append("set-cookie", cookie("login", "", 0))
      if (!validLogin(login) || login.expiresAt <= now() || await revoked("login", state) || url.searchParams.getAll("code").length !== 1 || !url.searchParams.get("code") || url.searchParams.has("error")) return new Response("Authentication unavailable", { status: 403, headers: responseHeaders })
      const result = await options.client.exchange({ code: url.searchParams.get("code")!, verifier: login.verifier, nonce: login.nonce, redirectUri: `${options.origin}${options.mount}/auth/callback` }).catch(() => undefined)
      if (!result || !validPerson(result.person) || !validTokens(result.tokens) || result.tokens.expiresAt <= now() || login.expiresAt <= now() || await revoked("login", state)) return new Response("Authentication unavailable", { status: 403, headers: responseHeaders })
      const previous = handle(request, "session")
      if (previous) await retire("session", previous)
      const id = randomBytes(32).toString("hex")
      const createdAt = now()
      const value: Session = { ...result, createdAt, login: state, expiresAt: createdAt + sessionSeconds * 1000 }
      const admitted = options.secrets.authentication
        ? await options.secrets.authentication.issue({ key: slot("session", id), value: seal(slot("session", id), value), expiresAt: value.expiresAt, at: createdAt, parent: storageKey }).catch(() => false)
        : await options.secrets.put(slot("session", id), seal(slot("session", id), value), value.expiresAt).then(() => true)
      if (!admitted) return new Response("Authentication unavailable", { status: 403, headers: responseHeaders })
      // A logout may finish while code redemption or persistence is pending.
      if (await revoked("login", state) || value.expiresAt <= now() || login.expiresAt <= now()) {
        await retire("session", id)
        return new Response("Authentication unavailable", { status: 403, headers: responseHeaders })
      }
      responseHeaders.append("set-cookie", cookie("session", id, sessionSeconds))
      responseHeaders.set("location", safeReturn(login.returnTo, options.mount))
      return new Response(null, { status: 303, headers: responseHeaders })
    },
    async prepare(request) {
      const current = await session(request)
      if (!current || current.value.tokens.expiresAt > now() + 60000) return
      const pending = refreshing.get(current.handle)
      if (pending) return pending
      // A stalled provider may outlive expiry and collection of its session.
      // Keep those in-flight promises bounded without evicting live work.
      if (options.secrets.authentication && refreshing.size >= options.secrets.authentication.limits.maxRecords) return
      const work = (async () => {
        if (!current.value.tokens.refreshToken) return
        const refreshed = await options.client.refresh(current.value.tokens.refreshToken).catch(() => undefined)
        if (!refreshed || !validTokens(refreshed) || refreshed.expiresAt <= now()) return
        const person = await options.client.person(refreshed.accessToken).catch(() => undefined)
        if (!validPerson(person) || person.id !== current.value.person.id) return
        if (!await session(request)) return
        const value: Session = { ...current.value, person, tokens: { ...refreshed, refreshToken: refreshed.refreshToken ?? current.value.tokens.refreshToken, idToken: refreshed.idToken ?? current.value.tokens.idToken } }
        await options.secrets.put(slot("session", current.handle), seal(slot("session", current.handle), value), value.expiresAt, now())
        // Keep the durable marker authoritative even when logout wins between the check and put.
        if (!await session(request)) await options.secrets.remove(slot("session", current.handle))
      })().finally(() => refreshing.delete(current.handle))
      refreshing.set(current.handle, work)
      await work
    },
    async authenticate(request, context) {
      const current = await ready(request)
      if (!current || !context) return null
      const actor = await options.client.resolve(current.value.tokens.accessToken, context.roleMap.filter((row) => row.surface === context.surface)).catch(() => null)
      if (!actor || actor.id !== current.value.person.id || !actor.roles.length || actor.roles.some((role) => role.surface !== context.surface)) return null
      return (await ready(request))?.handle === current.handle ? actor : null
    },
    async graphDirectory(request) {
      if (options.client.profile !== "web-confidential" || !options.client.graphDirectory) throw new Error("Microsoft admin directory unavailable")
      const current = await ready(request)
      if (!current) throw new Error("Microsoft admin session unavailable")
      const result = await options.client.graphDirectory(current.value.tokens.accessToken)
      if ((await ready(request))?.handle !== current.handle) throw new Error("Microsoft admin session changed")
      return result
    },
    async directory(request) {
      const current = await ready(request)
      if (!current) return []
      const people = await options.client.directory(current.value.tokens.accessToken).catch(() => [])
      return (await ready(request))?.handle === current.handle ? people : []
    },
    async person(request) { return (await ready(request))?.value.person ?? null },
  }
}

function validPerson(value: unknown): value is DirectoryPerson {
  return value !== null && typeof value === "object" && "id" in value && typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) && "name" in value && typeof value.name === "string" && Boolean(value.name.trim())
}
function validTokens(value: unknown): value is EntraTokens {
  return value !== null && typeof value === "object" && "accessToken" in value && typeof value.accessToken === "string" && Boolean(value.accessToken) && "expiresAt" in value && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt) && (!("refreshToken" in value) || value.refreshToken === undefined || typeof value.refreshToken === "string") && (!("idToken" in value) || value.idToken === undefined || typeof value.idToken === "string")
}
function validSession(value: unknown): value is Session {
  return value !== null && typeof value === "object" && "person" in value && validPerson(value.person) && "tokens" in value && validTokens(value.tokens) && "expiresAt" in value && typeof value.expiresAt === "number" && Number.isSafeInteger(value.expiresAt) && "createdAt" in value && typeof value.createdAt === "number" && Number.isSafeInteger(value.createdAt) && value.expiresAt > value.createdAt && "login" in value && typeof value.login === "string" && /^[a-f0-9]{64}$/.test(value.login)
}
function validLogin(value: unknown): value is Login {
  return value !== null && typeof value === "object" && "nonce" in value && typeof value.nonce === "string" && /^[a-f0-9]{64}$/.test(value.nonce) && "verifier" in value && typeof value.verifier === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.verifier) && "returnTo" in value && typeof value.returnTo === "string" && "expiresAt" in value && typeof value.expiresAt === "number" && Number.isSafeInteger(value.expiresAt)
}
function safeReturn(value: string | null, mount: string) {
  const fallback = `${mount}/dashboard`
  if (!value || !value.startsWith(`${mount}/`) || /[\\\r\n]/.test(value)) return fallback
  const parsed = new URL(value, "http://localhost")
  return ["dashboard", "planner", "procurement"].some((surface) => parsed.pathname === `${mount}/${surface}`) && parsed.origin === "http://localhost" ? `${parsed.pathname}${parsed.search}` : fallback
}

