import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { Surface } from "../src/identity.ts"

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
  const intent = teamHeaderIntent(request, binding, url)
  return intent?.kind === "team" ? intent : undefined
}

/** Distinguish implicit selection from a malformed or conflicting explicit selector. */
export function readTeamProfileIntent(request: Request, binding: Binding) {
  const url = originalUrl(request, binding, true)
  return url ? teamHeaderIntent(request, binding, url) : undefined
}

function teamHeaderIntent(request: Request, binding: Binding, url: URL) {
  if (["contractRevision", "kind", "teamObjectId", "tenantId", "installationId"].some((key) => url.searchParams.has(key)))
    return undefined
  const text = request.headers.get("x-sf-team-profile")
  if (text === null) return { kind: "selection" as const }
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

export function teamBusinessRoute(pathname: string, mount: string): { mount: string; teamObjectId: string; surface: Surface } | undefined {
  const prefix = mount + "/teams/"
  if (!pathname.startsWith(prefix)) return undefined
  const [teamObjectId, surface, trailing] = pathname.slice(prefix.length).split("/")
  if (!teamObjectId || trailing !== undefined || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(teamObjectId) ||
      (surface !== "dashboard" && surface !== "planner" && surface !== "procurement")) return undefined
  return { mount: prefix + teamObjectId, teamObjectId, surface }
}

/** Entra's redirect chain may still be cross-site when the browser reaches the landing page. */
export function isTeamLandingNavigation(request: Request, url: URL, mount: string) {
  return request.method === "GET" && !url.search &&
    (url.pathname === mount || ["dashboard", "planner", "procurement"].some((surface) => url.pathname === mount + "/" + surface) || !!teamBusinessRoute(url.pathname, mount)) &&
    request.headers.get("sec-fetch-mode") === "navigate" && request.headers.get("sec-fetch-dest") === "document" &&
    !request.headers.has("x-sf-team-profile")
}

function originalUrl(request: Request, binding: Binding, landing = false): URL | undefined {
  const url = new URL(request.url)
  if (request.signal.aborted || request.headers.has("origin") && request.headers.get("origin") !== binding.origin ||
      request.headers.get("sec-fetch-site") === "cross-site" && !(landing && isTeamLandingNavigation(request, url, binding.mount)))
    return undefined
  const repeatedTopics = landing && (request.method === "GET" || request.method === "HEAD") &&
    teamBusinessRoute(url.pathname, binding.mount)?.surface === "dashboard" &&
    ["docx", "pptx"].includes(url.searchParams.get("download") ?? "")
  if (url.origin !== binding.origin || url.username || url.password || url.hash ||
    (!url.pathname.startsWith(binding.mount + "/") && !(landing && url.pathname === binding.mount)) || url.search.length > 4096 ||
    /%(?![\da-fA-F]{2})/.test(url.search) ||
    [...url.searchParams.keys()].some((key) => !(repeatedTopics && key === "topic") && url.searchParams.getAll(key).length !== 1)) return undefined
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
