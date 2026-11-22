import { Option, Schema } from "effect"
import type {
  SfHref, SfOwnerSelection, SfRef, SfResolvedQuery, SfResolvedRoute, SfServerKey,
  SfTeamContext, SfTeamInstallationDescriptor,
} from "@orchestra/schema/sucafina/context"
import { SfDomainReadSelection } from "@orchestra/schema/sucafina/domain"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { matchSfNativeRoutePath, type SfNativeRouteCandidate } from "../route-registry"
import { parseDashboardRouteQuery } from "./dashboard-route"
type SfBudgetPeriod = Readonly<Pick<typeof SfDomainReadSelection.Type, "year" | "month">>

export type SfTeamDomainCapability = "CAP14" | "CAP04" | "CAP05" | "CAP03"
export type SfTeamDomainRoute = SfResolvedRoute<SfTeamDomainCapability>
const names = ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]
const pages = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects", CAP03: "Budget Overview" } as const
const paths = {
  CAP14: "/orchestra/sf-procurement/contracts",
  CAP04: "/orchestra/sf-dashboard/opex",
  CAP05: "/orchestra/sf-dashboard/capex",
  CAP03: "/orchestra/sf-dashboard/budget",
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
  const allowed = candidate.surfaceId === "CAP03" ? [...names, "year", "month"] : budget ? [...names, "year"] : names
  if (names.some((key) => params.getAll(key).length !== 1) ||
    candidate.surfaceId !== "CAP03" && params.size !== allowed.length || [...params.keys()].some((key) =>
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
  if (candidate.surfaceId === "CAP03") {
    const period = new URLSearchParams()
    for (const key of ["year", "month"]) if (params.has(key)) period.set(key, params.get(key)!)
    // The original CAP03 parser owns optional periods and their canonical numeric syntax.
    const query = parseDashboardRouteQuery(period, candidate)
    if (!query) return
    return { candidate, selector: parsed.value, query }
  }
  const rawYear = params.get("year")
  if (budget && (rawYear === null || !/^\d{4}$/.test(rawYear))) return
  const input: SfResolvedQuery = budget ? { year: Number(rawYear) } : {}
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
  if (candidate.surfaceId === "CAP03" && kind === "entry" && sfTeamDomainAvailable(context, "CAP03"))
    return { ...common, surfaceId: "CAP03", kind, params: {} }
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

function teamQuery(binding: SfTeamInstallationDescriptor, profile: TeamProfile.Ref, year?: number, month?: number) {
  return new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: profile.installationId, tenantId: profile.tenantId, teamObjectId: profile.teamObjectId,
    ...(year === undefined ? {} : { year: String(year) }),
    ...(month === undefined ? {} : { month: String(month) }),
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
  const allowed = candidate.surfaceId === "CAP14" ? ["server", "project", "installation"] :
    ["server", "project", "installation", "year", ...(candidate.surfaceId === "CAP03" ? ["month"] : [])]
  if ([...params.keys()].some((key) => !allowed.includes(key) || params.getAll(key).length !== 1) ||
      params.has("server") && params.get("server") !== binding.publicOrigin ||
      params.has("project") && params.get("project") !== binding.projectId ||
      params.has("installation") && params.get("installation") !== binding.installationId) return
  const rawYear = params.get("year"), rawMonth = params.get("month")
  if ((candidate.surfaceId === "CAP04" || candidate.surfaceId === "CAP05") && rawYear === null ||
    rawYear !== null && !/^\d{4}$/.test(rawYear) ||
    rawMonth !== null && !/^(?:[1-9]|1[0-2])$/.test(rawMonth)) return
  url.search = teamQuery(binding, context.stamp.team!.owner.profile,
    rawYear === null ? undefined : Number(rawYear), rawMonth === null ? undefined : Number(rawMonth)).toString()
  return resolveSfTeamDomainRoute(url, binding, context) ? url.pathname + url.search : undefined
}

/** Preserve a committed Team CAP03 owner while changing only the original period selection. */
export function sfTeamBudgetPeriodHref(
  from: SfResolvedRoute<"CAP03">, period: SfBudgetPeriod,
  binding: SfTeamInstallationDescriptor, context: SfTeamContext,
): string | undefined {
  if (from.surfaceId !== "CAP03" || from.kind !== "entry" || from.pathname !== paths.CAP03 ||
    Object.keys(from.params).length || Object.keys(from.query).some((key) => key !== "year" && key !== "month") ||
    Object.keys(period).some((key) => key !== "year" && key !== "month") ||
    period.year !== undefined && typeof period.year !== "number" ||
    period.month !== undefined && typeof period.month !== "number") return
  let url: URL
  try { url = new URL(from.href, binding.publicOrigin) } catch { return }
  const current = resolveSfTeamDomainRoute(url, binding, context)
  if (!current || current.surfaceId !== "CAP03" || current.href !== from.href ||
    current.ownerSelection.serverKey !== from.ownerSelection.serverKey ||
    current.ownerSelection.projectId !== from.ownerSelection.projectId ||
    current.ownerSelection.installationId !== from.ownerSelection.installationId ||
    current.query.year !== from.query.year || current.query.month !== from.query.month) return
  url.searchParams.delete("year")
  url.searchParams.delete("month")
  if (period.year !== undefined) url.searchParams.set("year", String(period.year))
  if (period.month !== undefined) url.searchParams.set("month", String(period.month))
  return resolveSfTeamDomainRoute(url, binding, context) ? url.pathname + url.search : undefined
}
