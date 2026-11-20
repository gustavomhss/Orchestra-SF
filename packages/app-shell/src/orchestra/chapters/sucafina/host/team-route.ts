import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfHref, SfOwnerSelection, SfResolvedRoute, SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { sfParseOwnerQuery, sfSameTeamRef, sfOwnerMatchesContext } from "../navigation-state/owner"
import { matchSfNativeRoutePath } from "../route-registry"
import { extendedRouteAvailable, parseExtendedRouteQuery } from "./extended-routes"

export type SfTeamWebRoute =
  | Readonly<{ kind: "context"; profile?: TeamProfile.Ref }>
  | Readonly<{ kind: "administration" }>
  | Readonly<{ kind: "business"; profile: TeamProfile.Ref; href: string }>
  | Readonly<{ kind: "invalid" }>
const contextPath = "/orchestra/sf-home/context", adminPath = "/orchestra/sf-home/administration"

export function sfTeamContextHref(binding: SfTeamInstallationDescriptor): string {
  return contextPath + "?" + new URLSearchParams({ contractRevision: "sf-team-profile/1",
    server: binding.publicOrigin, installationId: binding.installationId, tenantId: binding.tenantId })
}
export function sfTeamAdministrationHref(binding: SfTeamInstallationDescriptor): string {
  return adminPath + "?" + new URLSearchParams({ contractRevision: "sf-team-profile/1",
    server: binding.publicOrigin, installationId: binding.installationId, tenantId: binding.tenantId })
}
function installationQuery(params: URLSearchParams, binding: SfTeamInstallationDescriptor) {
  if (params.size === 0) return true
  const names = ["contractRevision", "server", "installationId", "tenantId"]
  return params.size === names.length && [...params.keys()].every((key) => names.includes(key) && params.getAll(key).length === 1) &&
    params.get("contractRevision") === "sf-team-profile/1" && params.get("server") === binding.publicOrigin &&
    params.get("installationId") === binding.installationId && params.get("tenantId") === binding.tenantId
}

/** A URL carries intent only; this syntax reader never supplies membership or business authority. */
export function readSfTeamWebRoute(href: string, binding: SfTeamInstallationDescriptor): SfTeamWebRoute {
  let url: URL
  try { url = new URL(href, binding.publicOrigin) } catch { return { kind: "invalid" } }
  if (url.origin !== binding.publicOrigin || url.username || url.password || /%(?![\da-fA-F]{2})/.test(url.search))
    return { kind: "invalid" }
  const context = url.pathname === "/" || url.pathname === contextPath
  const admin = url.pathname === adminPath
  if (url.hash && (context || admin)) return { kind: "invalid" }
  if (context || admin) {
    if (installationQuery(url.searchParams, binding)) return { kind: context ? "context" : "administration" }
    if (admin || url.searchParams.size !== 5) return { kind: "invalid" }
    const parsed = sfParseOwnerQuery(url.searchParams)
    if (parsed.kind !== "team" || parsed.serverKey !== binding.publicOrigin ||
        parsed.profile.installationId !== binding.installationId || parsed.profile.tenantId !== binding.tenantId)
      return { kind: "invalid" }
    return { kind: "context", profile: parsed.profile }
  }
  const candidate = matchSfNativeRoutePath(url.pathname)
  if (!candidate) return { kind: "invalid" }
  const parsed = sfParseOwnerQuery(url.searchParams)
  if (parsed.kind !== "team" || parsed.serverKey !== binding.publicOrigin ||
      parsed.profile.installationId !== binding.installationId || parsed.profile.tenantId !== binding.tenantId)
    return { kind: "invalid" }
  if (url.hash) {
    try {
      if (url.searchParams.getAll("request").length !== 1 ||
          decodeURIComponent(url.hash.slice(1)) !== url.searchParams.get("request")) return { kind: "invalid" }
    } catch { return { kind: "invalid" } }
  }
  return { kind: "business", profile: parsed.profile, href: url.pathname + url.search }
}

/** Closed route grammar + freshly reread F02 authority; each original leaf rechecks its resource. */
export function resolveSfTeamNativeRoute(
  href: string, binding: SfTeamInstallationDescriptor, selected: SfOwnerSelection, context: SfTeamContext,
): SfResolvedRoute | undefined {
  const intent = readSfTeamWebRoute(href, binding)
  if (intent.kind !== "business" || !sfSameTeamRef(intent.profile, selected.team) ||
      !sfOwnerMatchesContext(context, selected) || context.stamp.hostId !== binding.hostId ||
      context.stamp.installationId !== binding.installationId || context.profile.principal.tenantId !== binding.tenantId) return
  const url = new URL(intent.href, binding.publicOrigin), candidate = matchSfNativeRoutePath(url.pathname)!
  const core = candidate.surfaceId === "UI29" && candidate.kind === "entry" ||
    candidate.surfaceId === "UI33" && ["entry", "new"].includes(candidate.kind) ||
    candidate.surfaceId === "UI34" && candidate.kind === "entry"
  const query = core ? url.searchParams.size === 5 ? {} : undefined : parseExtendedRouteQuery(url.searchParams, candidate)
  if (!query) return
  if (core) {
    const operation = candidate.surfaceId === "UI29" ? "projection.home" :
      candidate.surfaceId === "UI33" ? "projection.cases" : "projection.case"
    const ready = (id: string) => context.availability.some((resource) => resource.operations.some((item) =>
      item.operationId === id && item.state === "ready" && item.operational))
    if (!ready(operation) || candidate.surfaceId === "UI33" && candidate.kind === "new" &&
        !ready("decisions.command.sf_case_draft")) return
  } else if (!extendedRouteAvailable(context, candidate)) return
  // Recognition and the original context source precede this public route projection.
  return { surfaceId: candidate.surfaceId, kind: candidate.kind, params: candidate.parameters,
    ownerSelection: selected, pathname: url.pathname, href: intent.href as SfHref, query } as SfResolvedRoute
}
