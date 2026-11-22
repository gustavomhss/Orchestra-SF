import { Option, Schema } from "effect"
import type {
  SfHref, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey,
  SfTeamContext, SfTeamInstallationDescriptor,
} from "@orchestra/schema/sucafina/context"
import { SfDomainReadSelection } from "@orchestra/schema/sucafina/domain"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { matchSfNativeRoutePath, type SfNativeRouteCandidate } from "../route-registry"

export type SfTeamDomainCapability = "CAP14" | "CAP04" | "CAP05"
export type SfTeamDomainRoute = SfResolvedRoute<SfTeamDomainCapability>
const names = ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]
const pages = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
const paths = {
  CAP14: "/orchestra/sf-procurement/contracts",
  CAP04: "/orchestra/sf-dashboard/opex",
  CAP05: "/orchestra/sf-dashboard/capex",
} as const

function candidateFor(url: URL): SfNativeRouteCandidate | undefined {
  const route = matchSfNativeRoutePath(url.pathname)
  if (!route || !(route.surfaceId in paths) || !["entry", "new", "detail", "edit"].includes(route.kind)) return
  return route
}

function sameOrigin(url: URL, binding: SfTeamInstallationDescriptor): boolean {
  return url.protocol === "https:" && url.origin === binding.publicOrigin && !url.username && !url.password &&
    !url.hash && !/%(?![\da-fA-F]{2})/.test(url.search)
}

/** Public URL syntax only. A decoded Team selector is never an access grant. */
export function readSfTeamDomainIntent(url: URL, binding: SfTeamInstallationDescriptor) {
  const candidate = candidateFor(url)
  if (!candidate || !sameOrigin(url, binding)) return
  const budget = candidate.surfaceId !== "CAP14"
  const params = url.searchParams
  const allowed = budget ? [...names, "year"] : names
  if (params.size !== allowed.length || [...params.keys()].some((key) =>
    !allowed.includes(key) || params.getAll(key).length !== 1) ||
    params.get("server") !== binding.publicOrigin) return
  const parsed = Schema.decodeUnknownOption(TeamProfile.Selector, { onExcessProperty: "error" })({
    contractRevision: params.get("contractRevision"), kind: "team",
    profile: {
      installationId: params.get("installationId"), tenantId: params.get("tenantId"),
      teamObjectId: params.get("teamObjectId"),
    },
  })
  if (Option.isNone(parsed) || parsed.value.kind !== "team" ||
      parsed.value.profile.installationId !== binding.installationId ||
      parsed.value.profile.tenantId !== binding.tenantId) return
  const rawYear = params.get("year")
  if (budget && (rawYear === null || !/^\d{4}$/.test(rawYear))) return
  const input = budget ? { year: Number(rawYear) } : {}
  const selection = Schema.decodeUnknownOption(SfDomainReadSelection, { onExcessProperty: "error" })(input)
  if (Option.isNone(selection)) return
  return { candidate, selector: parsed.value, query: input }
}

/** Technical placement comes from discovery; the full Team owner remains on the context and transport. */
export function sfTeamDomainSelection(binding: SfTeamInstallationDescriptor): SfOwnerSelection {
  const installationId: string = binding.installationId
  return Object.freeze({
    serverKey: binding.publicOrigin as SfServerKey,
    projectId: binding.projectId as SfRef,
    installationId: installationId as SfRef,
  })
}

export function sfTeamDomainCurrent(binding: SfTeamInstallationDescriptor, context: SfTeamContext): boolean {
  const team = context.stamp.team
  return !!team && context.profile.teams.status === "ready" &&
    context.contractRevision === binding.contractRevision &&
    context.stamp.installationId === binding.installationId && context.stamp.projectId === binding.projectId &&
    context.stamp.hostId === binding.hostId && context.profile.principal.tenantId === binding.tenantId &&
    team.owner.profile.installationId === binding.installationId && team.owner.profile.tenantId === binding.tenantId &&
    team.owner.profile.teamObjectId === context.profile.teams.selected.teamObjectId &&
    team.owner.principal.tenantId === context.profile.principal.tenantId &&
    team.owner.principal.principalObjectId === context.profile.principal.principalObjectId
}

/** Each original leaf must still read its page and enforce the producer's current action set. */
export function sfTeamDomainAvailable(context: SfTeamContext, capabilityId: SfTeamDomainCapability): boolean {
  const destinations = context.destinations.filter((item) => item.capabilityId === capabilityId)
  const resources = context.availability.filter((item) => item.family === "domain-read" && item.resource === capabilityId)
  if (destinations.length !== 1 || resources.length !== 1) return false
  const destination = destinations[0]!, resource = resources[0]!
  const reads = resource.operations.filter((item) => item.operationId === `domain.page.${capabilityId}`)
  return destination.surface === "dashboard" && destination.page === pages[capabilityId] && destination.canRead &&
    (resource.state === "ready" || resource.state === "partial") && reads.length === 1 &&
    reads[0]!.state === "ready" && reads[0]!.operational
}

/** Complete public intent + observed F02; no legacy context is synthesized. */
export function resolveSfTeamDomainRoute(
  url: URL, binding: SfTeamInstallationDescriptor, context: SfTeamContext,
): SfTeamDomainRoute | undefined {
  const intent = readSfTeamDomainIntent(url, binding)
  if (!intent || !sfTeamDomainCurrent(binding, context) ||
      intent.selector.profile.teamObjectId !== context.stamp.team?.owner.profile.teamObjectId) return
  const { candidate, query } = intent
  const common = { ownerSelection: sfTeamDomainSelection(binding), href: (url.pathname + url.search) as SfHref,
    pathname: url.pathname, query }
  const { kind, parameters } = candidate
  if (candidate.surfaceId === "CAP14" && sfTeamDomainAvailable(context, "CAP14")) {
    if (kind === "entry" || kind === "new") return { ...common, surfaceId: "CAP14", kind, params: {} }
    if ((kind === "detail" || kind === "edit") && parameters.contractRef)
      return { ...common, surfaceId: "CAP14", kind, params: { contractRef: parameters.contractRef } }
  }
  if (candidate.surfaceId === "CAP04" && sfTeamDomainAvailable(context, "CAP04")) {
    if (kind === "entry" || kind === "new") return { ...common, surfaceId: "CAP04", kind, params: {} }
    if ((kind === "detail" || kind === "edit") && parameters.lineRef)
      return { ...common, surfaceId: "CAP04", kind, params: { lineRef: parameters.lineRef } }
  }
  if (candidate.surfaceId === "CAP05" && sfTeamDomainAvailable(context, "CAP05")) {
    if (kind === "entry" || kind === "new") return { ...common, surfaceId: "CAP05", kind, params: {} }
    if ((kind === "detail" || kind === "edit") && parameters.projectRef)
      return { ...common, surfaceId: "CAP05", kind, params: { projectRef: parameters.projectRef } }
  }
}

function teamQuery(binding: SfTeamInstallationDescriptor, profile: TeamProfile.Ref, year?: number) {
  return new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: profile.installationId, tenantId: profile.tenantId, teamObjectId: profile.teamObjectId,
    ...(year === undefined ? {} : { year: String(year) }),
  })
}

/** Real product links, derived only from the current F02; data attributes carry no authority. */
export function sfTeamDomainHref(
  binding: SfTeamInstallationDescriptor, context: SfTeamContext, capabilityId: SfTeamDomainCapability, year = 2026,
): string | undefined {
  if (!sfTeamDomainCurrent(binding, context) || !sfTeamDomainAvailable(context, capabilityId)) return
  const url = new URL(paths[capabilityId], binding.publicOrigin)
  url.search = teamQuery(binding, context.stamp.team!.owner.profile, capabilityId === "CAP14" ? undefined : year).toString()
  return resolveSfTeamDomainRoute(url, binding, context) ? url.pathname + url.search : undefined
}

/**
 * Only the mounted original leaf's navigation callback may use its technical
 * route format. Public deep links always go through readSfTeamDomainIntent.
 * A stale callback cannot call this after its owner/generation is retired.
 */
export function normalizeSfTeamDomainNavigation(
  href: string, binding: SfTeamInstallationDescriptor, context: SfTeamContext,
): string | undefined {
  let url: URL
  try { url = new URL(href, binding.publicOrigin) } catch { return }
  if (!sameOrigin(url, binding) || !sfTeamDomainCurrent(binding, context)) return
  if (resolveSfTeamDomainRoute(url, binding, context)) return url.pathname + url.search
  const candidate = candidateFor(url)
  if (!candidate) return
  const params = url.searchParams
  const allowed = candidate.surfaceId === "CAP14" ? ["server", "project", "installation"] : ["server", "project", "installation", "year"]
  if ([...params.keys()].some((key) => !allowed.includes(key) || params.getAll(key).length !== 1) ||
      params.has("server") && params.get("server") !== binding.publicOrigin ||
      params.has("project") && params.get("project") !== binding.projectId ||
      params.has("installation") && params.get("installation") !== binding.installationId) return
  const rawYear = params.get("year")
  if (candidate.surfaceId !== "CAP14" && (rawYear === null || !/^\d{4}$/.test(rawYear))) return
  url.search = teamQuery(binding, context.stamp.team!.owner.profile,
    candidate.surfaceId === "CAP14" ? undefined : Number(rawYear)).toString()
  return resolveSfTeamDomainRoute(url, binding, context) ? url.pathname + url.search : undefined
}
