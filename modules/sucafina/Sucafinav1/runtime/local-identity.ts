import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { DirectoryPerson, EntraClient, EntraTokens, LocalIdentity, LocalSecrets } from "./local-contract.ts"

type Session = { person: DirectoryPerson; tokens: EntraTokens; expiresAt: number }
type Login = { nonce: string; verifier: string; returnTo: string }

/** Browser cookies contain opaque handles. Tokens and PKCE material are encrypted only in the private store. */
export function createLocalIdentity(options: {
  origin: string
  mount: string
  client: EntraClient
  secrets: LocalSecrets
  key: Uint8Array
  now?: () => Date
  sessionSeconds?: number
  loginSeconds?: number
}): LocalIdentity {
  const origin = new URL(options.origin)
  if (origin.origin !== options.origin || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || !["http:", "https:"].includes(origin.protocol))
    throw new Error("Explicit loopback origin required")
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount) || options.key.byteLength !== 32)
    throw new Error("Invalid local identity configuration")
  const now = () => (options.now?.() ?? new Date()).getTime()
  const key = Buffer.from(options.key)
  const sessionSeconds = options.sessionSeconds ?? 28800
  const loginSeconds = options.loginSeconds ?? 600
  if (![sessionSeconds, loginSeconds].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Invalid session lifetime")
  const cookiePrefix = `sucafina_${createHash("sha256").update(options.mount).digest("hex").slice(0, 12)}`
  const refreshing = new Map<string, Promise<void>>()
  const slot = (kind: string, handle: string) => `${kind}:${createHash("sha256").update(handle).digest("hex")}`
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
    const id = handle(request, "session")
    if (!id || await options.secrets.get(slot("revoked", id), now())) return undefined
    const storageKey = slot("session", id)
    const encrypted = await options.secrets.get(storageKey, now())
    if (!encrypted) return undefined
    const value = await Promise.resolve().then(() => open(storageKey, encrypted)).catch(() => undefined)
    if (!validSession(value) || value.expiresAt <= now()) return undefined
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
        if (id) {
          await options.secrets.put(slot("revoked", id), new Uint8Array([1]), now() + sessionSeconds * 1000)
          await options.secrets.remove(slot("session", id))
        }
        const responseHeaders = headers()
        responseHeaders.append("set-cookie", cookie("session", "", 0))
        responseHeaders.append("set-cookie", cookie("login", "", 0))
        return new Response(null, { status: 204, headers: responseHeaders })
      }
      if (request.method !== "GET") return error(405)
      if (path === "/auth/login") {
        const state = randomBytes(32).toString("hex")
        const verifier = randomBytes(32).toString("base64url")
        const login: Login = { nonce: randomBytes(32).toString("hex"), verifier, returnTo: safeReturn(url.searchParams.get("returnTo"), options.mount) }
        const destination = await options.client.authorization({ state, nonce: login.nonce, challenge: createHash("sha256").update(verifier).digest("base64url"), redirectUri: `${options.origin}${options.mount}/auth/callback` }).catch(() => undefined)
        if (!destination) return error(503)
        await options.secrets.put(slot("login", state), seal(slot("login", state), login), now() + loginSeconds * 1000)
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
      if (previous) {
        await options.secrets.put(slot("revoked", previous), new Uint8Array([1]), now() + sessionSeconds * 1000)
        await options.secrets.remove(slot("session", previous))
      }
      const id = randomBytes(32).toString("hex")
      const value: Session = { ...result, expiresAt: now() + sessionSeconds * 1000 }
      await options.secrets.put(slot("session", id), seal(slot("session", id), value), value.expiresAt)
      responseHeaders.append("set-cookie", cookie("session", id, sessionSeconds))
      responseHeaders.set("location", safeReturn(login.returnTo, options.mount))
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
        // A durable revocation marker also rejects a refresh that races with logout.
        if (!await options.secrets.get(slot("session", current.handle), now())) return
        const value: Session = { ...current.value, person, tokens: { ...refreshed, refreshToken: refreshed.refreshToken ?? current.value.tokens.refreshToken, idToken: refreshed.idToken ?? current.value.tokens.idToken } }
        await options.secrets.put(slot("session", current.handle), seal(slot("session", current.handle), value), value.expiresAt)
      })().finally(() => refreshing.delete(current.handle))
      refreshing.set(current.handle, work)
      await work
    },
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
  return value !== null && typeof value === "object" && "id" in value && typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) && "name" in value && typeof value.name === "string" && Boolean(value.name.trim())
}
function validTokens(value: unknown): value is EntraTokens {
  return value !== null && typeof value === "object" && "accessToken" in value && typeof value.accessToken === "string" && Boolean(value.accessToken) && "expiresAt" in value && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt) && (!("refreshToken" in value) || value.refreshToken === undefined || typeof value.refreshToken === "string") && (!("idToken" in value) || value.idToken === undefined || typeof value.idToken === "string")
}
function validSession(value: unknown): value is Session {
  return value !== null && typeof value === "object" && "person" in value && validPerson(value.person) && "tokens" in value && validTokens(value.tokens) && "expiresAt" in value && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
}
function validLogin(value: unknown): value is Login {
  return value !== null && typeof value === "object" && "nonce" in value && typeof value.nonce === "string" && /^[a-f0-9]{64}$/.test(value.nonce) && "verifier" in value && typeof value.verifier === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.verifier) && "returnTo" in value && typeof value.returnTo === "string"
}
function safeReturn(value: string | null, mount: string) {
  const fallback = `${mount}/dashboard`
  if (!value || !value.startsWith(`${mount}/`) || /[\\\r\n]/.test(value)) return fallback
  const parsed = new URL(value, "http://localhost")
  return ["dashboard", "planner", "procurement"].some((surface) => parsed.pathname === `${mount}/${surface}`) && parsed.origin === "http://localhost" ? `${parsed.pathname}${parsed.search}` : fallback
}
