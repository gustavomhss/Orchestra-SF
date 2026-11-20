import { CoreMigrationDenied, type createTeamProfileCoreMigration } from "./team-profile-core-migration.ts"

type Engine = ReturnType<typeof createTeamProfileCoreMigration>
const MAX_BYTES = 8 * 1024 * 1024
const DEADLINE_MS = 5000

/** Original Microsoft Request only. Bodies contain review metadata, never a grant or filesystem path. */
export function createTeamProfileMigrationHttp(input: { origin: string; mount: string; runtime: () => Engine | undefined }) {
  if (!URL.canParse(input.origin) || new URL(input.origin).origin !== input.origin || new URL(input.origin).protocol !== "https:" ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(input.mount)) throw new Error("SF_CORE_MIGRATION_HTTP_CONFIG")
  const route = input.mount + "/api/ui/team-profile-migration"
  const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== route) return undefined
    if (url.origin !== input.origin || request.headers.get("origin") !== input.origin ||
        request.headers.get("sec-fetch-site") === "cross-site") return response({ status: "denied" }, 403)
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } })
    if (request.signal.aborted || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return response({ status: "invalid" }, 400)
    const announced = request.headers.get("content-length")
    if (announced !== null && (!/^\d+$/.test(announced) || Number(announced) > MAX_BYTES))
      return response({ status: "invalid" }, 413)
    const reader = request.body?.getReader()
    if (!reader) return response({ status: "invalid" }, 400)
    let timer: ReturnType<typeof setTimeout> | undefined
    let expired = false, total = 0
    const chunks: Uint8Array[] = []
    const abort = () => { expired = true; void reader.cancel().catch(() => {}) }
    request.signal.addEventListener("abort", abort, { once: true })
    try {
      timer = setTimeout(abort, DEADLINE_MS)
      while (true) {
        const next = await reader.read()
        if (expired) return response({ status: "invalid" }, 408)
        if (next.done) break
        total += next.value.byteLength
        if (total > MAX_BYTES) { await reader.cancel(); return response({ status: "invalid" }, 413) }
        chunks.push(next.value)
      }
      if (announced !== null && Number(announced) !== total) return response({ status: "invalid" }, 400)
      const bytes = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      clearTimeout(timer)
      let decoded: unknown
      try { decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) }
      catch { return response({ status: "invalid" }, 400) }
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded) || !("action" in decoded))
        return response({ status: "invalid" }, 400)
      const engine = input.runtime()
      if (!engine) return response({ status: "unavailable" }, 503)
      if (decoded.action === "census" && Object.keys(decoded).length === 1)
        return response({ status: "ok", value: await engine.diagnose(request) }, 200)
      if (decoded.action === "prepare" && Object.keys(decoded).length === 2 && "intent" in decoded)
        return response({ status: "ok", value: await engine.prepare(request, decoded.intent) }, 200)
      if (decoded.action === "cut" && Object.keys(decoded).length === 2 && "planDigest" in decoded &&
          typeof decoded.planDigest === "string" && /^[a-f0-9]{64}$/.test(decoded.planDigest))
        return response({ status: "ok", value: await engine.cut(request, decoded.planDigest) }, 200)
      return response({ status: "invalid" }, 400)
    } catch (error) {
      if (error instanceof CoreMigrationDenied)
        return response({ status: error.reason === "authority" ? "denied" : "blocked", reason: error.reason },
          error.reason === "authority" ? 403 : error.reason === "schema" ? 400 : 409)
      return response({ status: "unavailable" }, 503)
    } finally {
      clearTimeout(timer)
      request.signal.removeEventListener("abort", abort)
      reader.releaseLock()
    }
  }
}
