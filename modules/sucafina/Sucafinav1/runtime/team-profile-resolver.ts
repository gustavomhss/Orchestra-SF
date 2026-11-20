import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { EntraTeamsResult, MicrosoftProfileSession } from "./local-contract.ts"
import { sameTeamProfileBinding, teamProfilePolicyBinding, teamProfilePolicyCommand, teamProfilePrincipal, teamProfileRef } from "./team-profile-policy.ts"
import type { TeamProfileCatalog, TeamProfilePolicyBinding, TeamProfilePolicySource } from "./team-profile-policy.ts"
import type { TeamProfilePolicyStore } from "./team-profile-store.ts"

export type TeamProfileAdminUnavailableReason = TeamProfile.AdminUnavailableReason
type Failure =
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: TeamProfileAdminUnavailableReason }>
export type TeamProfileAdminListResult = TeamProfile.AdminListResult
export type TeamProfileAdminConfigureResult = TeamProfile.AdminConfigureResult
/** A request-bound profile eligibility handle. It grants no business/resource permissions. */
export type TeamProfileAdmission = Readonly<{
  profile: TeamProfile.Ref
  principal: TeamProfile.Principal
  configRevision: number
}>
export type TeamProfileResolution =
  | Failure
  | Readonly<{
      status: "authenticated"
      principal: TeamProfile.Principal
      administration: TeamProfile.Administration
      teams: TeamProfile.TeamState
      /** Server-only: callers must remove it from any wire projection. */
      admission?: TeamProfileAdmission
    }>
type Observation = Readonly<{ session: MicrosoftProfileSession; principal: TeamProfile.Principal; policy: TeamProfilePolicySource }>
type Captured = Readonly<{ status: "observed"; observation: Observation }> | Failure

/** One resolver over current Microsoft proof and installation policy. Selection never creates a grant. */
export function createTeamProfileResolver(input: {
  installationId: string
  tenantId: string
  store: TeamProfilePolicyStore
  microsoftSession: (request: Request) => Promise<MicrosoftProfileSession | undefined>
  policy: () => Promise<TeamProfilePolicySource>
  now?: () => number
}) {
  const binding = teamProfilePolicyBinding({ installationId: input.installationId, tenantId: input.tenantId })
  const store = Object.freeze({ ...input.store })
  const microsoftSession = input.microsoftSession
  const policy = input.policy
  const now = input.now ?? Date.now
  const admissions = new WeakMap<object, Readonly<{ observation: Observation; admission: TeamProfileAdmission }>>()

  const currentPolicy = async () => {
    const value = await policy()
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["teams", "supremeAdminGroupId"].includes(key)) ||
        (value.teams !== undefined && value.teams !== "direct") ||
        (value.supremeAdminGroupId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.supremeAdminGroupId)))
      throw new Error("Invalid current Team profile policy")
    return Object.freeze({ ...value })
  }
  const capture = async (request: Request): Promise<Captured> => {
    const session = await microsoftSession(request).catch(() => undefined)
    if (!session || request.signal.aborted) return { status: "unauthenticated" }
    const principal = await Promise.resolve().then(() => teamProfilePrincipal(session.principal)).catch(() => undefined)
    if (!principal || principal.tenantId !== binding.tenantId) return { status: "denied" }
    const configured = await currentPolicy().catch(() => undefined)
    if (!configured) return { status: "unavailable", reason: "policy-unavailable" }
    if (!await session.verifyCurrent()) return { status: "unauthenticated" }
    return { status: "observed", observation: Object.freeze({ session, principal, policy: configured }) }
  }
  const verify = async (observation: Observation): Promise<Failure | undefined> => {
    const configured = await currentPolicy().catch(() => undefined)
    if (!configured) return { status: "unavailable", reason: "policy-unavailable" }
    if (!samePolicy(configured, observation.policy)) return { status: "unavailable", reason: "policy-changed" }
    if (!await observation.session.verifyCurrent()) return { status: "unauthenticated" }
  }
  const administrator = async (observation: Observation): Promise<Failure | undefined> => {
    if (!observation.policy.supremeAdminGroupId) return { status: "denied" }
    const proof = await observation.session.groupMembership(observation.policy.supremeAdminGroupId)
    if (proof.state === "unauthenticated") return { status: "unauthenticated" }
    if (proof.state === "unavailable") return { status: "unavailable", reason: graphReason(proof.reason) }
    if (proof.tenantId !== binding.tenantId || proof.principalObjectId !== observation.principal.principalObjectId ||
        proof.groupObjectId !== observation.policy.supremeAdminGroupId || proof.source !== "checkMemberGroups" ||
        proof.membership !== "transitive") return { status: "unavailable", reason: "invalid-response" }
    if (!proof.member) return { status: "denied" }
    return verify(observation)
  }
  const stableCatalog = async (observation: Observation, expected: TeamProfileCatalog): Promise<Failure | undefined> => {
    const current = await store.read().catch(() => undefined)
    if (!current) return { status: "unavailable", reason: "store-unavailable" }
    if (current.configRevision !== expected.configRevision) return { status: "unavailable", reason: "policy-changed" }
    return verify(observation)
  }

  return Object.freeze({
    async list(request: Request): Promise<TeamProfileAdminListResult> {
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const denied = await administrator(captured.observation)
      if (denied) return denied
      const catalog = await store.read().catch(() => undefined)
      if (!catalog) return { status: "unavailable", reason: "store-unavailable" }
      // Recheck membership after the store await; a prior positive proof is never a reusable admin grant.
      const final = await administrator(captured.observation) ?? await stableCatalog(captured.observation, catalog)
      return final ?? { status: "ok", configRevision: catalog.configRevision, profiles: catalog.profiles }
    },
    async configure(request: Request, value: unknown): Promise<TeamProfileAdminConfigureResult> {
      const command = teamProfilePolicyCommand(value)
      if (!command || !sameTeamProfileBinding(command.profile, binding)) return { status: "invalid-request" }
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const observation = captured.observation
      const denied = await administrator(observation)
      if (denied) return denied
      if (command.action === "enable") {
        if (observation.policy.teams !== "direct") return { status: "unavailable", reason: "capability-disabled" }
        const team = await observation.session.team(command.profile.teamObjectId)
        if (team.state === "unauthenticated") return { status: "unauthenticated" }
        if (team.state === "unavailable") return { status: "unavailable", reason: graphReason(team.reason) }
        if (team.tenantId !== binding.tenantId || team.principalObjectId !== observation.principal.principalObjectId ||
            team.source !== "team" || team.team.teamObjectId !== command.profile.teamObjectId)
          return { status: "unavailable", reason: "invalid-response" }
      }
      const observed: { failure?: Failure } = {}
      const result = await store.mutate({
        command, principal: observation.principal, at: now(), signal: request.signal,
        authorize: async () => {
          // Called under the store's write lock after every earlier lookup/queue wait.
          // This repeats the group proof, not only /me or the session-generation check.
          observed.failure = await administrator(observation)
          return observed.failure === undefined
        },
      }).catch(() => undefined)
      if (observed.failure) return observed.failure
      if (!result) return { status: "unavailable", reason: "store-unavailable" }
      // A committed edit remains in the audit even if access is withdrawn before response publication.
      // Repeating the old CAS cannot repeat that edit or manufacture a second receipt.
      return await administrator(observation) ?? result
    },
    async resolve(request: Request, value?: unknown): Promise<TeamProfileResolution> {
      const parsed = value === undefined ? undefined : Schema.decodeUnknownOption(TeamProfile.Selector)(value)
      if (parsed && Option.isNone(parsed)) return { status: "denied" }
      const selector = parsed && Option.isSome(parsed) ? parsed.value : undefined
      if (selector && !sameTeamProfileBinding(selector.kind === "team" ? selector.profile : selector, binding))
        return { status: "denied" }
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const observation = captured.observation
      const catalog = await store.read().catch(() => undefined)
      if (!catalog) return { status: "unavailable", reason: "store-unavailable" }
      const teams = observation.policy.teams === "direct"
        ? await observation.session.teams() : { state: "unavailable" as const, reason: "capability_disabled" as const }
      const admin = await administrator(observation)
      const final = await stableCatalog(observation, catalog)
      if (final) return final
      if (teams.state === "unauthenticated" || admin?.status === "unauthenticated") return { status: "unauthenticated" }
      const administration: TeamProfile.Administration = !admin ? { status: "available" } :
        admin.status === "denied" ? { status: "denied" } :
        { status: "unavailable", reason: projectionReason(admin.reason) }
      const state = eligibleTeams(binding, observation.principal, catalog, teams, selector?.kind === "team" ? selector.profile : undefined)
      if (state.status !== "ready" || selector?.kind === "administration")
        return { status: "authenticated", principal: observation.principal, administration, teams: state }
      // This is eligibility under the current catalog, never a business accessRevision.
      const holder = Object.freeze({ profile: state.selected, principal: observation.principal, configRevision: catalog.configRevision })
      admissions.set(holder, Object.freeze({ observation, admission: holder }))
      return { status: "authenticated", principal: observation.principal, administration, teams: state, admission: holder }
    },
    async revalidate(candidate: unknown): Promise<boolean> {
      if (typeof candidate !== "object" || candidate === null) return false
      const held = admissions.get(candidate)
      if (!held || await verify(held.observation)) return false
      const catalog = await store.read().catch(() => undefined)
      if (!catalog || catalog.configRevision !== held.admission.configRevision || !catalog.profiles.some((entry) =>
        entry.enabled && entry.profile.teamObjectId === held.admission.profile.teamObjectId)) return false
      if (held.observation.policy.teams !== "direct") return false
      const teams = await held.observation.session.teams()
      if (teams.state !== "complete" || teams.tenantId !== binding.tenantId ||
          teams.principalObjectId !== held.admission.principal.principalObjectId ||
          !teams.teams.some((entry) => entry.teamObjectId === held.admission.profile.teamObjectId)) return false
      return !await stableCatalog(held.observation, catalog)
    },
  })
}

function samePolicy(left: TeamProfilePolicySource, right: TeamProfilePolicySource) {
  return left.teams === right.teams && left.supremeAdminGroupId === right.supremeAdminGroupId
}

function graphReason(reason: Extract<EntraTeamsResult, { state: "unavailable" }>["reason"]): TeamProfileAdminUnavailableReason {
  const reasons: Record<typeof reason, TeamProfileAdminUnavailableReason> = {
    capability_disabled: "capability-disabled", consent_required: "consent-required", token_expired: "identity-unavailable",
    identity_mismatch: "identity-unavailable", unauthenticated: "identity-unavailable", forbidden: "forbidden", throttled: "rate-limited",
    timeout: "timeout", provider_unavailable: "provider-unavailable", invalid_response: "invalid-response", incomplete: "incomplete", limit_exceeded: "incomplete",
  }
  return reasons[reason]
}

function projectionReason(reason: TeamProfileAdminUnavailableReason): TeamProfile.UnavailableReason {
  if (reason === "capability-disabled") return "identity-unavailable"
  if (reason === "policy-unavailable" || reason === "policy-changed" || reason === "store-unavailable") return "provider-unavailable"
  return reason
}

function eligibleTeams(
  binding: TeamProfilePolicyBinding,
  principal: TeamProfile.Principal,
  catalog: TeamProfileCatalog,
  observed: EntraTeamsResult,
  selected?: TeamProfile.Ref,
): TeamProfile.TeamState {
  if (observed.state === "unavailable") return { status: "unavailable", reason: projectionReason(graphReason(observed.reason)) }
  if (observed.tenantId !== binding.tenantId || observed.principalObjectId !== principal.principalObjectId ||
      observed.source !== "joinedTeams" || observed.membership !== "direct") return { status: "unavailable", reason: "invalid-response" }
  const choices = observed.teams.filter((team) => catalog.profiles.some((entry) => entry.enabled && entry.profile.teamObjectId === team.teamObjectId))
    .map((team) => Schema.decodeUnknownOption(TeamProfile.Choice)({ profile: teamProfileRef(binding, team.teamObjectId), displayName: team.name }))
  if (choices.some(Option.isNone)) return { status: "unavailable", reason: "invalid-response" }
  const valid = Object.freeze(choices.flatMap((choice) => Option.isSome(choice) ? [Object.freeze(choice.value)] : []))
  if (new Set(valid.map((choice) => choice.profile.teamObjectId)).size !== valid.length) return { status: "unavailable", reason: "invalid-response" }
  if (selected && !valid.some((choice) => choice.profile.teamObjectId === selected.teamObjectId)) return { status: "revoked" }
  if (valid.length === 0) return { status: "no-teams" }
  if (!selected && valid.length > 1) return { status: "selection-required", choices: valid }
  return { status: "ready", choices: valid, selected: selected ?? valid[0].profile, configRevision: catalog.configRevision }
}
