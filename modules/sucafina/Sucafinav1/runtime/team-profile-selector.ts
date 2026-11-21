import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

type Binding = Readonly<{ installationId: string; tenantId: string; origin: string; mount: string }>

/** A query/header is intent only. The original Request still needs Microsoft admission. */
export function readTeamProfileSelector(request: Request, binding: Binding): TeamProfile.Selector | undefined {
  const url = originalUrl(request, binding)
  if (!url) return undefined
  if (url.pathname === binding.mount + "/api/ui/context") {
    const query = readTeamContextQuery(request, binding)
    if (!query) return undefined
    const input = query.kind === "team"
      ? { contractRevision: query.contractRevision, kind: query.kind, profile: {
          installationId: query.installationId, tenantId: query.tenantId, teamObjectId: query.teamObjectId,
        } }
      : { contractRevision: query.contractRevision, kind: query.kind,
          installationId: query.installationId, tenantId: query.tenantId }
    const decoded = Schema.decodeUnknownOption(TeamProfile.Selector)(input)
    return Option.isSome(decoded) ? decoded.value : undefined
  }
  // Business selectors travel only in this closed header. A conflicting URL
  // intent, an administration intent or a legacy repo selector cannot choose SF.
  if (["contractRevision", "kind", "teamObjectId", "tenantId", "installationId"].some((key) => url.searchParams.has(key)))
    return undefined
  const text = request.headers.get("x-sf-team-profile")
  if (!text || new TextEncoder().encode(text).byteLength > 2048) return undefined
  const value = originalJson(text)
  if (!value) return undefined
  const decoded = Schema.decodeUnknownOption(TeamProfile.Selector)(value)
  if (Option.isNone(decoded) || decoded.value.kind !== "team" ||
    decoded.value.profile.installationId !== binding.installationId ||
    decoded.value.profile.tenantId !== binding.tenantId) return undefined
  return decoded.value
}

/** Raw URL validation occurs before any SDK-decoded fields reach discovery or authority. */
export function readTeamContextQuery(request: Request, binding: Binding): TeamProfile.ContextQuery | undefined {
  const url = originalUrl(request, binding)
  if (!url || url.pathname !== binding.mount + "/api/ui/context" ||
    !["GET", "HEAD"].includes(request.method) || request.headers.has("x-sf-team-profile")) return undefined
  const entries = [...url.searchParams.entries()]
  const fields = ["contractRevision", "installationId", "tenantId", "hostId", "kind", "teamObjectId"]
  if (entries.length < 5 || entries.length > 6 ||
    new Set(entries.map(([key]) => key)).size !== entries.length ||
    entries.some(([key, value]) => !fields.includes(key) || !value)) return undefined
  const decoded = Schema.decodeUnknownOption(TeamProfile.ContextQuery)(Object.fromEntries(entries))
  if (Option.isNone(decoded) || decoded.value.installationId !== binding.installationId ||
    decoded.value.tenantId !== binding.tenantId) return undefined
  return decoded.value
}

function originalUrl(request: Request, binding: Binding): URL | undefined {
  if (request.signal.aborted || request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.has("origin") && request.headers.get("origin") !== binding.origin) return undefined
  const url = new URL(request.url)
  if (url.origin !== binding.origin || url.username || url.password || url.hash ||
    !url.pathname.startsWith(binding.mount + "/") || url.search.length > 4096 ||
    /%(?![\da-fA-F]{2})/.test(url.search) ||
    [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
  return url
}

/** JSON grammar first, then original key tokens so escaped duplicates remain visible. */
function originalJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text)
    const frames: { object: boolean; key: boolean; keys: Set<string> }[] = []
    for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)) {
      const token = match[0]
      if (token === "{" || token === "[") {
        if (frames.length >= 4) return undefined
        frames.push({ object: token === "{", key: token === "{", keys: new Set() })
        continue
      }
      if (token === "}" || token === "]") { frames.pop(); continue }
      const frame = frames.at(-1)
      if (!frame?.object) continue
      if (token === ",") { frame.key = true; continue }
      if (!frame.key || !token.startsWith('"')) continue
      const key: string = JSON.parse(token)
      if (["__proto__", "prototype", "constructor"].includes(key) || frame.keys.has(key)) return undefined
      frame.keys.add(key)
      frame.key = false
    }
    return value
  } catch { return undefined }
}
