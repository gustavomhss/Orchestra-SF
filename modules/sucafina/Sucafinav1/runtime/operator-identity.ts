import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import type { OperatorIdentity, OperatorOptions } from "./operator-contract.ts"

/** Local homology uses the owner's OS account, never an Entra identity or group membership. */
export function createOperatorIdentity(options: OperatorOptions): OperatorIdentity {
  const origin = new URL(options.origin)
  if (origin.origin !== options.origin || origin.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
    throw new Error("Explicit HTTP loopback origin required")
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount) || options.key.byteLength !== 32)
    throw new Error("Invalid local operator configuration")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.operator.installationId) || !Number.isSafeInteger(options.operator.uid) || options.operator.uid < 0 || typeof options.operator.name !== "string" || !options.operator.name.trim())
    throw new Error("Actual local operator identity required")
  if (options.operator.buyer !== undefined && typeof options.operator.buyer !== "boolean") throw new Error("Explicit boolean local buyer policy required")
  const person = { id: `macos:${options.operator.installationId}:${options.operator.uid}`, name: options.operator.name }
  const mount = options.mount
  const fixedOrigin = options.origin
  const key = Buffer.from(options.key)
  const secrets = options.secrets
  const now = () => (options.now?.() ?? new Date()).getTime()
  const cookieName = `sucafina_operator_${createHash("sha256").update(JSON.stringify([mount, person.id])).digest("hex").slice(0, 24)}`
  const slot = (kind: string, value: string) => `operator-${kind}:${createHash("sha256").update(value).digest("hex")}`
  const cookie = (value: string, seconds: number) => `${cookieName}=${value}; Path=${mount}; HttpOnly; SameSite=Lax; Max-Age=${seconds}`
  const handle = (request: Request) => {
    const values = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName}=`))
    if (values.length !== 1) return undefined
    const value = values[0]!.slice(cookieName.length + 1)
    return /^[a-f0-9]{64}$/.test(value) ? value : undefined
  }
  const seal = (storageKey: string, expiresAt: number) => {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    cipher.setAAD(Buffer.from(storageKey))
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ operator: person, origin: fixedOrigin, mount, expiresAt }), "utf8"), cipher.final()])
    return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted])
  }
  const open = (storageKey: string, bytes: Uint8Array): unknown => {
    if (bytes.length < 30 || bytes[0] !== 1) throw new Error("Invalid encrypted operator credential")
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.slice(1, 13))
    decipher.setAAD(Buffer.from(storageKey))
    decipher.setAuthTag(bytes.slice(13, 29))
    return JSON.parse(Buffer.concat([decipher.update(bytes.slice(29)), decipher.final()]).toString("utf8"))
  }
  const valid = (value: unknown) => {
    if (!value || typeof value !== "object" || !("operator" in value) || !("expiresAt" in value) || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= now()) return false
    if (!("origin" in value) || value.origin !== fixedOrigin || !("mount" in value) || value.mount !== mount) return false
    return value.operator !== null && typeof value.operator === "object" && "id" in value.operator && value.operator.id === person.id && "name" in value.operator && value.operator.name === person.name
  }
  const session = async (request: Request) => {
    if (new URL(request.url).origin !== fixedOrigin) return false
    const id = handle(request)
    if (!id || await secrets.get(slot("revoked", id), now())) return false
    const storageKey = slot("session", id)
    const bytes = await secrets.get(storageKey, now())
    if (!bytes) return false
    const value = await Promise.resolve().then(() => open(storageKey, bytes)).catch(() => undefined)
    if (!valid(value)) return false
    // Recheck after the session read: logout may have revoked a handle while that read was pending.
    return !await secrets.get(slot("revoked", id), now())
  }
  const headers = () => new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" })
  const error = (status: number) => new Response("Local authentication unavailable", { status, headers: headers() })
  return {
    async scope(request) {
      if (!await session(request)) return undefined
      const id = handle(request)
      if (!id) return undefined
      // Hash of the mount, person, and opaque handle. Never the handle itself, and stable until that session ends.
      return createHash("sha256").update(JSON.stringify([mount, person.id, id])).digest("hex")
    },
    async enroll() {
      const code = randomBytes(32).toString("hex")
      const storageKey = slot("enroll", code)
      const expiresAt = now() + 600000
      await secrets.put(storageKey, seal(storageKey, expiresAt), expiresAt)
      return code
    },
    async handle(request) {
      const url = new URL(request.url)
      if (!url.pathname.startsWith(`${mount}/auth/`)) return undefined
      if (url.origin !== fixedOrigin) return error(403)
      const path = url.pathname.slice(mount.length)
      if (path === "/auth/logout") {
        if (request.method !== "POST") return error(405)
        if (request.headers.get("origin") !== fixedOrigin || request.headers.get("sec-fetch-site") === "cross-site") return error(403)
        const id = handle(request)
        if (id) {
          // Durable revocation precedes deletion so an old credential cannot be restored by a racing reader.
          await secrets.put(slot("revoked", id), new Uint8Array([1]), now() + 28800000)
          await secrets.remove(slot("session", id))
        }
        const responseHeaders = headers()
        responseHeaders.append("set-cookie", cookie("", 0))
        return new Response(null, { status: 204, headers: responseHeaders })
      }
      if (path !== "/auth/login" && path !== "/auth/local") return error(404)
      if (request.method !== "GET") return error(405)
      if (path === "/auth/login") return new Response("Local operator access: use the local enrollment helper on this Mac to open an authenticated browser session.", { headers: headers() })
      const codes = url.searchParams.getAll("code")
      if (codes.length !== 1 || !/^[a-f0-9]{64}$/.test(codes[0]!)) return error(403)
      const storageKey = slot("enroll", codes[0]!)
      const bytes = await secrets.take(storageKey, now())
      if (!bytes) return error(403)
      const value = await Promise.resolve().then(() => open(storageKey, bytes)).catch(() => undefined)
      if (!valid(value)) return error(403)
      const previous = handle(request)
      if (previous) {
        await secrets.put(slot("revoked", previous), new Uint8Array([1]), now() + 28800000)
        await secrets.remove(slot("session", previous))
      }
      const id = randomBytes(32).toString("hex")
      const sessionKey = slot("session", id)
      const expiresAt = now() + 28800000
      await secrets.put(sessionKey, seal(sessionKey, expiresAt), expiresAt)
      const responseHeaders = headers()
      responseHeaders.append("set-cookie", cookie(id, 28800))
      responseHeaders.set("location", `${mount}/dashboard`)
      return new Response(null, { status: 303, headers: responseHeaders })
    },
    async prepare() {},
    async authenticate(request, context) {
      if (!context || !["dashboard", "planner", "procurement"].includes(context.surface) || !await session(request)) return null
      return { id: person.id, canWrite: true, roles: [{ surface: context.surface, role: "admin" }, ...(context.surface === "procurement" && options.operator.buyer === true ? [{ surface: context.surface, role: "buyer" }] : [])] }
    },
    async person(request) { return await session(request) ? { ...person } : null },
    async directory(request) { return await session(request) ? [{ ...person }] : [] },
  }
}
