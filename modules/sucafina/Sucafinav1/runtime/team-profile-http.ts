import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { createTeamProfileResolver } from "./team-profile-resolver.ts"

type Resolver = Pick<ReturnType<typeof createTeamProfileResolver>, "list" | "configure">
const maximumBodyBytes = 8192
const bodyDeadlineMs = 5000

/** This private installation route carries configuration data, never an admitted runtime handle. */
export function createTeamProfileHttp(options: {
  origin: string
  mount: string
  installationId: string
  tenantId: string
  resolver: Resolver
}) {
  if (!URL.canParse(options.origin) || new URL(options.origin).origin !== options.origin || new URL(options.origin).protocol !== "https:" ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(options.mount) ||
      !Schema.is(TeamProfile.InstallationId)(options.installationId) || !Schema.is(TeamProfile.TenantId)(options.tenantId)) throw new Error("Invalid Teams profile HTTP binding")
  const origin = options.origin
  const installationId = options.installationId
  const tenantId = options.tenantId
  const route = `${options.mount}/api/ui/team-profiles`
  const resolver = Object.freeze({ list: options.resolver.list, configure: options.resolver.configure })

  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== route) return undefined
    const respond = (value: TeamProfile.AdminListResult | TeamProfile.AdminConfigureResult, status: number, extra: Record<string, string> = {}) =>
      new Response(request.method === "HEAD" ? null : JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
      })
    if (url.origin !== origin || request.headers.get("sec-fetch-site") === "cross-site" ||
        (request.headers.has("origin") && request.headers.get("origin") !== origin) ||
        (request.method === "POST" && request.headers.get("origin") !== origin)) return respond({ status: "denied" }, 403)
    if (request.method !== "GET" && request.method !== "POST") return respond({ status: "invalid-request" }, 405, { Allow: "GET, POST" })
    if (request.signal.aborted) return respond({ status: "unauthenticated" }, 401)

    const query = [...url.searchParams]
    if (url.hash || query.length !== 3 || new Set(query.map(([key]) => key)).size !== 3 ||
        query.some(([key]) => !["contractRevision", "installationId", "tenantId"].includes(key)) ||
        url.searchParams.get("contractRevision") !== "sf-team-profile/1" ||
        !Schema.is(TeamProfile.InstallationId)(url.searchParams.get("installationId")) ||
        !Schema.is(TeamProfile.TenantId)(url.searchParams.get("tenantId"))) return respond({ status: "invalid-request" }, 400)
    if (url.searchParams.get("installationId") !== installationId || url.searchParams.get("tenantId") !== tenantId) return respond({ status: "denied" }, 403)

    if (request.method === "GET") {
      const result = await resolver.list(request).catch(() => ({ status: "unavailable" as const, reason: "invalid-response" as const }))
      if (request.signal.aborted) return respond({ status: "unauthenticated" }, 401)
      if (!Schema.is(TeamProfile.AdminListResult)(result) ||
          (result.status === "ok" && result.profiles.some((entry) => entry.profile.installationId !== installationId || entry.profile.tenantId !== tenantId))) return respond({ status: "unavailable", reason: "invalid-response" }, 503)
      return respond(result, statusCode(result))
    }
    if (!/^application\/json(?:\s*;\s*charset=(?:"utf-8"|utf-8))?$/i.test(request.headers.get("content-type") ?? "") ||
        (request.headers.has("content-encoding") && request.headers.get("content-encoding") !== "identity")) return respond({ status: "invalid-request" }, 415)
    const contentLength = request.headers.get("content-length")
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength)))) return respond({ status: "invalid-request" }, 400)
    if (contentLength !== null && Number(contentLength) > maximumBodyBytes) return respond({ status: "invalid-request" }, 413)
    const body = await readCommand(request, contentLength === null ? undefined : Number(contentLength))
    if (body.status !== "parsed") return respond({ status: "invalid-request" }, body.status)
    if (!Schema.is(TeamProfile.AdminCommand)(body.value)) return respond({ status: "invalid-request" }, 400)
    if (body.value.profile.installationId !== installationId || body.value.profile.tenantId !== tenantId) return respond({ status: "denied" }, 403)
    if (request.signal.aborted) return respond({ status: "unauthenticated" }, 401)
    const result = await resolver.configure(request, body.value).catch(() => ({ status: "unavailable" as const, reason: "invalid-response" as const }))
    if (request.signal.aborted) return respond({ status: "unauthenticated" }, 401)
    if (!Schema.is(TeamProfile.AdminConfigureResult)(result)) return respond({ status: "unavailable", reason: "invalid-response" }, 503)
    return respond(result, statusCode(result))
  }
}

function statusCode(result: TeamProfile.AdminListResult | TeamProfile.AdminConfigureResult) {
  if (result.status === "ok") return 200
  if (result.status === "unauthenticated") return 401
  if (result.status === "denied") return 403
  if (result.status === "invalid-request") return 400
  if (result.status === "conflict") return 409
  if (result.status === "not-found") return 404
  return 503
}

async function readCommand(request: Request, contentLength: number | undefined): Promise<{ status: "parsed"; value: unknown } | { status: 400 | 408 | 413 }> {
  if (!request.body || request.bodyUsed || request.body.locked || request.signal.aborted) return { status: 400 }
  const reader = request.body.getReader()
  const stopped = Promise.withResolvers<never>()
  const failure: { status: 400 | 408 | 413; stopped: boolean } = { status: 400, stopped: false }
  const stop = (status: 400 | 408 | 413) => {
    failure.status = status
    failure.stopped = true
    stopped.reject(new Error("Teams profile command body unavailable"))
    void reader.cancel().catch(() => undefined)
  }
  const aborted = () => stop(400)
  request.signal.addEventListener("abort", aborted, { once: true })
  const timeout = setTimeout(() => stop(408), bodyDeadlineMs)
  const chunks: Uint8Array[] = []
  const size = { bytes: 0 }
  try {
    while (true) {
      const next = await Promise.race([reader.read(), stopped.promise])
      if (failure.stopped) return { status: failure.status }
      if (request.signal.aborted) return { status: 400 }
      if (next.done) break
      size.bytes += next.value.byteLength
      if (size.bytes > maximumBodyBytes) {
        stop(413)
        return { status: 413 }
      }
      chunks.push(next.value)
    }
    if (contentLength !== undefined && contentLength !== size.bytes) return { status: 400 }
    const bytes = new Uint8Array(size.bytes)
    const offset = { bytes: 0 }
    for (const chunk of chunks) { bytes.set(chunk, offset.bytes); offset.bytes += chunk.byteLength }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    // JSON.parse verifies the grammar; scanning its original tokens preserves duplicate-key evidence.
    const value: unknown = JSON.parse(text)
    const frames: { object: boolean; key: boolean; keys: Set<string> }[] = []
    for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)) {
      const token = match[0]
      if (token === "{" || token === "[") {
        if (frames.length >= 8) return { status: 400 }
        frames.push({ object: token === "{", key: token === "{", keys: new Set() })
        continue
      }
      if (token === "}" || token === "]") { frames.pop(); continue }
      const frame = frames.at(-1)
      if (!frame?.object) continue
      if (token === ",") { frame.key = true; continue }
      if (!frame.key || !token.startsWith('"')) continue
      const key: string = JSON.parse(token)
      if (["__proto__", "prototype", "constructor"].includes(key) || frame.keys.has(key)) return { status: 400 }
      frame.keys.add(key)
      frame.key = false
    }
    if (failure.stopped || request.signal.aborted) return { status: failure.stopped ? failure.status : 400 }
    return { status: "parsed", value }
  } catch {
    return { status: failure.status }
  } finally {
    clearTimeout(timeout)
    request.signal.removeEventListener("abort", aborted)
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
