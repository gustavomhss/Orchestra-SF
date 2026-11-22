import { Option, Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import type { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { readSfTeamDomainIntent } from "../orchestra/chapters/sucafina/host/team-domain-route"
import { sfNativeRouteSpecs } from "../orchestra/chapters/sucafina/route-registry"

type TeamNavigationIntent = Extract<TeamProfile.Selector, { kind: "selection" | "team" }>
const paths = ["/", "/orchestra/sf-home", "/orchestra/sf-home/context"]
const names = ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]

function sessionPath(url: URL): { sessionID?: Session.ID } | undefined {
  const match = /^\/orchestra\/sf-sessions\/([A-Za-z0-9_-]{1,256})$/.exec(url.pathname)
  if (!match) return
  if (match[1] === "new") return {}
  const parsed = Schema.decodeUnknownOption(Session.ID)(match[1])
  return Option.isSome(parsed) ? { sessionID: parsed.value } : undefined
}

/** Decode navigation intent only. Discovery and the current Microsoft context remain authoritative. */
export function readTeamNavigationIntent(url: URL, binding: SfTeamInstallationDescriptor): TeamNavigationIntent | undefined {
  const domain = readSfTeamDomainIntent(url, binding)
  if (domain) return domain.selector
  const session = sessionPath(url)
  if (url.protocol !== "https:" || url.origin !== binding.publicOrigin || url.username || url.password || url.hash ||
      (!paths.includes(url.pathname) && !session) || /%(?![\da-fA-F]{2})/.test(url.search)) return
  const params = url.searchParams
  if (session && params.size !== 5) return
  if (params.size === 0) return {
    contractRevision: binding.contractRevision, kind: "selection",
    installationId: binding.installationId, tenantId: binding.tenantId,
  }
  if ((params.size !== 4 && params.size !== 5) ||
      [...params.keys()].some((key) => !names.includes(key) || params.getAll(key).length !== 1) ||
      params.get("server") !== binding.publicOrigin) return
  const parsed = Schema.decodeUnknownOption(TeamProfile.Selector, { onExcessProperty: "error" })({
    contractRevision: params.get("contractRevision"),
    ...(params.has("teamObjectId") ? {
      kind: "team",
      profile: {
        installationId: params.get("installationId"), tenantId: params.get("tenantId"),
        teamObjectId: params.get("teamObjectId"),
      },
    } : {
      kind: "selection", installationId: params.get("installationId"), tenantId: params.get("tenantId"),
    }),
  })
  if (Option.isNone(parsed) || parsed.value.kind === "administration" || (session && parsed.value.kind !== "team")) return
  const profile = parsed.value.kind === "team" ? parsed.value.profile : parsed.value
  if (profile.installationId !== binding.installationId || profile.tenantId !== binding.tenantId) return
  return parsed.value
}

/** Call only after the original context has confirmed this profile. No authority is stored in history. */
export function teamNavigationURL(url: URL, binding: SfTeamInstallationDescriptor, profile: TeamProfile.Ref) {
  if (!readTeamNavigationIntent(url, binding)) return
  const result = new URL(url.href)
  const domain = readSfTeamDomainIntent(url, binding)
  // Preserve an admitted deep link only within its Team. A picker change starts
  // the same canonical page without carrying the previous Team's record ref.
  if (domain && domain.selector.profile.teamObjectId !== profile.teamObjectId) {
    const entry = sfNativeRouteSpecs.find((route) => route.surfaceId === domain.candidate.surfaceId && route.kind === "entry")
    if (!entry) return
    result.pathname = entry.pattern
  }
  result.search = new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: profile.installationId, tenantId: profile.tenantId, teamObjectId: profile.teamObjectId,
    ...(domain?.query.year === undefined ? {} : { year: String(domain.query.year) }),
  }).toString()
  return readTeamNavigationIntent(result, binding)?.kind === "team" ? result : undefined
}

/** The identity handler independently validates this relative path and closed query on login and callback. */
export function teamNavigationReturnTo(url: URL, binding: SfTeamInstallationDescriptor) {
  if (readTeamNavigationIntent(url, binding)) return url.pathname + url.search
}

/** A session ID is navigation intent; the fresh context and Session GET still admit it independently. */
export function readTeamSessionNavigation(url: URL, binding: SfTeamInstallationDescriptor) {
  const path = sessionPath(url), intent = readTeamNavigationIntent(url, binding)
  return path && intent?.kind === "team" ? { kind: "session" as const, profile: intent.profile, ...path } : undefined
}

export function teamSessionNavigationURL(binding: SfTeamInstallationDescriptor, profile: TeamProfile.Ref, sessionID?: string) {
  if (sessionID !== undefined && (!Schema.is(Session.ID)(sessionID) || !/^[A-Za-z0-9_-]{1,256}$/.test(sessionID))) return
  const profileValue = Schema.decodeUnknownOption(TeamProfile.Ref, { onExcessProperty: "error" })(profile)
  if (Option.isNone(profileValue)) return
  const url = new URL("/orchestra/sf-sessions/" + (sessionID ?? "new"), binding.publicOrigin)
  url.search = new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: profile.installationId, tenantId: profile.tenantId, teamObjectId: profile.teamObjectId,
  }).toString()
  return readTeamSessionNavigation(url, binding) ? url : undefined
}
