import { SfTeamContext, type SfTeamContextQuery, type SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Option, Schema } from "effect"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { EntraTeamsObservation, EntraTeamsResult, EntraTeamsUnavailableReason, TeamProfileAdministratorObservation } from "./local-contract.ts"
import type { TeamProfileCatalog } from "./team-profile-policy.ts"
import type { TeamProfilePolicyStore } from "./team-profile-store.ts"
import { readTeamProfileIntent } from "./team-profile-selector.ts"

type Observed = Readonly<{
  status: "observed"
  observation: EntraTeamsObservation
  eligible: Extract<EntraTeamsResult, { state: "complete" }>["teams"]
  principal: TeamProfile.Principal
  catalog: TeamProfileCatalog
}>
type Observation =
  | Observed
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "unavailable"; reason: TeamProfile.UnavailableReason }>

export function teamProfileInstallationId(input: { origin: string; mount: string; directory: string }) {
  return digestSfValue({ origin: input.origin, mount: input.mount, directory: input.directory })
}

export function createTeamProfileAccess(input: {
  origin: string
  mount: string
  directory: string
  tenantId: string
  enabledTeamIds: readonly string[]
  prepare: (request: Request) => Promise<void>
  observeTeams: (request: Request) => Promise<EntraTeamsObservation>
  profilePolicy?: Pick<TeamProfilePolicyStore, "read">
  observeAdministrator?: (request: Request) => Promise<TeamProfileAdministratorObservation>
}) {
  const installationId = teamProfileInstallationId(input)
  const tenantId = input.tenantId
  const binding = Object.freeze({ installationId, tenantId, origin: input.origin, mount: input.mount })
  const prepare = input.prepare
  const observeTeams = input.observeTeams
  const observeAdministrator = input.observeAdministrator
  const profilePolicy = input.profilePolicy
  const profileFor = (teamObjectId: string) => Object.freeze(
    Schema.decodeUnknownSync(TeamProfile.Ref)({ installationId, tenantId, teamObjectId }),
  )
  // Existing fixed-policy compositions retain their revision; Microsoft installations supply the durable store.
  const enabled = Object.freeze([...new Set(input.enabledTeamIds)].toSorted())
  const initial = Object.freeze({
    configRevision: digestSfValue(enabled),
    profiles: Object.freeze(enabled.map((id) => Object.freeze({ profile: profileFor(id), enabled: true }))),
  })
  if (observeAdministrator && !profilePolicy) throw new Error("Team administration requires a durable profile policy")

  const readPolicy = async (): Promise<TeamProfileCatalog> => {
    if (!profilePolicy) return initial
    const catalog = await profilePolicy.read()
    const decoded = Schema.decodeUnknownOption(TeamProfile.AdminListResult)({ status: "ok", ...catalog })
    if (Option.isNone(decoded) || decoded.value.status !== "ok" ||
        decoded.value.profiles.some((entry) => entry.profile.installationId !== installationId || entry.profile.tenantId !== tenantId))
      throw new Error("Invalid Team profile catalog binding")
    return Object.freeze({ configRevision: decoded.value.configRevision,
      profiles: Object.freeze(decoded.value.profiles.map((entry) => Object.freeze({
        profile: Object.freeze({ ...entry.profile }), enabled: entry.enabled,
      }))),
    })
  }
  const policyCurrent = async (catalog: TeamProfileCatalog, selectedId?: string) => {
    const current = await readPolicy().catch(() => undefined)
    return !!current && current.configRevision === catalog.configRevision &&
      (!selectedId || current.profiles.some((entry) => entry.enabled && entry.profile.teamObjectId === selectedId))
  }
  async function observe(request: Request, refreshSession = true): Promise<Observation> {
    if (refreshSession && !await prepare(request).then(() => true).catch(() => false))
      return { status: "unavailable", reason: "identity-unavailable" }
    const observation = await observeTeams(request).catch(() => undefined)
    if (!observation) return { status: "unavailable", reason: "identity-unavailable" }
    const observed = observation.result
    if (request.signal.aborted) return { status: "denied" }
    if (observed.state === "unauthenticated") return { status: "unauthenticated" }
    if (observed.state === "unavailable") return { status: "unavailable", reason: projectionReason(observed.reason) }
    if (observed.tenantId !== tenantId || observed.source !== "joinedTeams" || observed.membership !== "direct" ||
        !observation.verifyCurrent)
      return { status: "unavailable", reason: "invalid-response" }
    const principal = Schema.decodeUnknownOption(TeamProfile.Principal)({
      tenantId: observed.tenantId, principalObjectId: observed.principalObjectId,
    })
    if (Option.isNone(principal)) return { status: "unavailable", reason: "invalid-response" }
    const catalog = await readPolicy().catch(() => undefined)
    if (!catalog) return { status: "unavailable", reason: "provider-unavailable" }
    const admitted = new Set<string>(catalog.profiles.filter((entry) => entry.enabled).map((entry) => entry.profile.teamObjectId))
    // Only the current Microsoft/direct-membership intersection creates Team eligibility.
    const eligible = Object.freeze(observed.teams.filter((team) => !team.archived && admitted.has(team.teamObjectId))
      .map((team) => Object.freeze({ ...team })))
    return Object.freeze({ status: "observed", observation, eligible, principal: Object.freeze(principal.value), catalog })
  }
  const choicesFor = (eligible: Observed["eligible"]) =>
    eligible.map((team) => ({ profile: profileFor(team.teamObjectId), displayName: team.name }))
  const verifyObservation = async (request: Request, held: Observed, selectedId?: string) => {
    if (request.signal.aborted || !await held.observation.verifyCurrent?.().catch(() => false)) return false
    // This read never refreshes credentials or writes a nested transaction.
    const current = await observeTeams(request).catch(() => undefined)
    if (!current || current.result.state !== "complete" || current.result.tenantId !== tenantId ||
        current.result.principalObjectId !== held.principal.principalObjectId ||
        current.result.source !== "joinedTeams" || current.result.membership !== "direct") return false
    const enabledIds = new Set<string>(held.catalog.profiles.filter((entry) => entry.enabled).map((entry) => entry.profile.teamObjectId))
    const eligibleIds = current.result.teams.filter((team) => !team.archived && enabledIds.has(team.teamObjectId))
      .map((team) => team.teamObjectId).toSorted()
    if (JSON.stringify(eligibleIds) !== JSON.stringify(held.eligible.map((team) => team.teamObjectId).toSorted()) ||
        selectedId && !eligibleIds.includes(selectedId)) return false
    if (!await current.verifyCurrent?.().catch(() => false) ||
        !await held.observation.verifyCurrent?.().catch(() => false) || request.signal.aborted) return false
    return await policyCurrent(held.catalog, selectedId) && !request.signal.aborted
  }

  async function authorize(request: Request, teamObjectId?: string, options?: { refreshSession?: boolean }) {
    const intent = readTeamProfileIntent(request, binding)
    if (!intent || intent.kind === "administration" ||
        teamObjectId && intent.kind === "team" && teamObjectId !== intent.profile.teamObjectId)
      return { status: "denied" } as const
    const current = await observe(request, options?.refreshSession)
    if (current.status === "unavailable") return { status: "unavailable" } as const
    if (current.status !== "observed") return current
    const selectedId = teamObjectId ?? (intent.kind === "team" ? intent.profile.teamObjectId : undefined)
    const selected = selectedId ? current.eligible.find((team) => team.teamObjectId === selectedId) :
      current.eligible.length === 1 ? current.eligible[0] : undefined
    const readMembers = current.observation.readMembers
    if (selected && current.observation.verifyCurrent) {
      if (!await current.observation.verifyCurrent() || !await policyCurrent(current.catalog, selected.teamObjectId) ||
          request.signal.aborted) return { status: "denied" } as const
      return {
        status: "allowed",
        profile: profileFor(selected.teamObjectId),
        principalObjectId: current.principal.principalObjectId,
        verifyCurrent: () => verifyObservation(request, current, selected.teamObjectId),
        ...(readMembers ? { readMembers: () => readMembers(selected.teamObjectId) } : {}),
      } as const
    }
    if (selectedId || current.eligible.length === 0) return { status: "denied" } as const
    if (current.eligible.length === 1) return { status: "unavailable" } as const
    const state = Schema.decodeUnknownOption(TeamProfile.TeamState)({ status: "selection-required", choices: choicesFor(current.eligible) })
    return Option.isSome(state) && state.value.status === "selection-required" ? state.value : { status: "unavailable" } as const
  }

  async function readContext(request: Request, query: SfTeamContextQuery,
    technical: Readonly<{ projectId: string; hostId: string }>): Promise<SfTeamContextResult> {
    const parsed = Schema.decodeUnknownOption(TeamProfile.ContextQuery)(query)
    if (Option.isNone(parsed) || parsed.value.installationId !== installationId ||
        parsed.value.tenantId !== tenantId || parsed.value.hostId !== technical.hostId)
      return { status: "unavailable", reason: "contract-mismatch" }
    const target = Object.freeze({ ...parsed.value })
    const scope = Object.freeze({ projectId: technical.projectId, hostId: technical.hostId })
    if (!await prepare(request).then(() => true).catch(() => false))
      return { status: "unavailable", reason: "identity-unavailable" }
    const administrator: TeamProfileAdministratorObservation = observeAdministrator
      ? await observeAdministrator(request).catch(() => ({ status: "unavailable", reason: "provider_unavailable" } as const))
      : { status: "denied" }
    const current = await observe(request, false)
    if (current.status === "unauthenticated" || administrator.status === "unauthenticated") return { status: "unauthenticated" }
    if (current.status === "denied") return current
    if (target.kind === "administration" && administrator.status !== "available")
      return administrator.status === "unavailable"
        ? { status: "unavailable", reason: projectionReason(administrator.reason) } : { status: "denied" }
    if (current.status !== "observed" && administrator.status !== "available") return current
    const principal = current.status === "observed" ? current.principal :
      administrator.status === "available" ? administrator.principal : undefined
    if (!principal || principal.tenantId !== tenantId ||
        administrator.status === "available" && (administrator.principal.tenantId !== principal.tenantId ||
          administrator.principal.principalObjectId !== principal.principalObjectId))
      return { status: "unavailable", reason: "identity-unavailable" }
    const catalog = current.status === "observed" ? current.catalog : await readPolicy().catch(() => undefined)
    if (!catalog) return { status: "unavailable", reason: "provider-unavailable" }
    const choices = current.status === "observed" ? choicesFor(current.eligible) : []
    const selected = target.kind === "team"
      ? choices.find((choice) => choice.profile.teamObjectId === target.teamObjectId)?.profile
      : choices.length === 1 ? choices[0]?.profile : undefined
    const teams: TeamProfile.TeamState = current.status !== "observed"
      ? { status: "unavailable", reason: current.reason }
      : target.kind === "team" && !selected ? { status: "revoked" }
      : choices.length === 0 ? { status: "no-teams" }
      : selected ? { status: "ready", choices, selected, configRevision: catalog.configRevision }
      : { status: "selection-required", choices }
    const administration: TeamProfile.Administration = administrator.status === "available" ? { status: "available" } :
      administrator.status === "unavailable" ? { status: "unavailable", reason: projectionReason(administrator.reason) } : { status: "denied" }
    // Administration may display Teams, but this route never admits a business owner.
    const admitted = target.kind !== "administration" && teams.status === "ready" ? teams.selected : undefined
    const accessRevision = digestSfValue({
      installationId, principal, configRevision: catalog.configRevision, selected: admitted,
      teams: teams.status, administration: administration.status,
      eligible: choices.map((choice) => choice.profile.teamObjectId).toSorted(),
    })
    const decoded = Schema.decodeUnknownOption(SfTeamContext, { onExcessProperty: "error" })({
      contractRevision: "sf-team-profile/1", authMode: "microsoft",
      stamp: {
        ...scope, installationId, principalRef: principal.principalObjectId,
        policyVersion: "sf-team-profile/1", accessRevision,
        ...(admitted ? { team: { owner: { profile: admitted, principal },
          revisions: { configRevision: catalog.configRevision, accessRevision } } } : {}),
      },
      profile: {
        contractRevision: "sf-team-profile/1", status: "authenticated", installationId, principal, accessRevision,
        administration, teams,
      },
      destinations: [], availability: [],
    })
    if (Option.isNone(decoded)) return { status: "unavailable", reason: "invalid-response" }
    if (administrator.status === "available" && !await administrator.verifyCurrent().catch(() => false)) return { status: "denied" }
    if (current.status === "observed" && !await verifyObservation(request, current, admitted?.teamObjectId))
      return { status: "unavailable", reason: "identity-unavailable" }
    if (!await policyCurrent(catalog) || request.signal.aborted) return { status: "unavailable", reason: "identity-unavailable" }
    return { status: "ok", value: decoded.value }
  }

  return Object.assign(authorize, { readContext })
}

function projectionReason(reason: EntraTeamsUnavailableReason): TeamProfile.UnavailableReason {
  if (reason === "consent_required") return "consent-required"
  if (reason === "forbidden") return "forbidden"
  if (reason === "throttled") return "rate-limited"
  if (reason === "timeout") return "timeout"
  if (reason === "incomplete" || reason === "limit_exceeded") return "incomplete"
  if (reason === "invalid_response" || reason === "identity_mismatch") return "invalid-response"
  if (reason === "provider_unavailable") return "provider-unavailable"
  return "identity-unavailable"
}
