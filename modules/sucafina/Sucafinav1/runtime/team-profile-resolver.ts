import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { EntraTeamsUnavailableReason, LocalIdentity, TeamProfileAdministratorObservation } from "./local-contract.ts"
import { sameTeamProfileBinding, teamProfilePolicyBinding, teamProfilePolicyCommand, teamProfilePrincipal, teamConfigurationCommand } from "./team-profile-policy.ts"
import type { TeamProfileCatalog, TeamProfilePolicySource } from "./team-profile-policy.ts"
import type { TeamProfilePolicyStore } from "./team-profile-store.ts"

type Failure =
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: TeamProfile.AdminUnavailableReason }>
type Administrator = Extract<TeamProfileAdministratorObservation, { status: "available" }>
type Observation = Readonly<{
  proof: Administrator
  principal: TeamProfile.Principal
  policy: TeamProfilePolicySource
}>
type Captured = Readonly<{ status: "observed"; observation: Observation }> | Failure

/** Administration is a private Microsoft capability, independent of business roles and Team membership. */
export function createTeamProfileResolver(input: {
  installationId: string
  tenantId: string
  store: TeamProfilePolicyStore
  policy: () => Promise<TeamProfilePolicySource>
  observeAdministrator: NonNullable<LocalIdentity["observeTeamProfileAdministrator"]>
  prepare?: LocalIdentity["prepare"]
  now?: () => number
}) {
  const binding = teamProfilePolicyBinding({ installationId: input.installationId, tenantId: input.tenantId })
  const store = Object.freeze({ ...input.store })
  const policy = input.policy
  const observeAdministrator = input.observeAdministrator
  const prepare = input.prepare
  const now = input.now ?? Date.now
  const currentPolicy = async () => {
    const value = await policy()
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some((key) => !["teams", "supremeAdminGroupId"].includes(key)) ||
        value.teams !== undefined && value.teams !== "direct" ||
        value.supremeAdminGroupId !== undefined &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.supremeAdminGroupId))
      throw new Error("Invalid current Team profile policy")
    return Object.freeze({ ...value })
  }
  const verify = async (request: Request, observation: Observation): Promise<Failure | undefined> => {
    if (request.signal.aborted) return { status: "unauthenticated" }
    const configured = await currentPolicy().catch(() => undefined)
    if (!configured) return { status: "unavailable", reason: "policy-unavailable" }
    if (!samePolicy(configured, observation.policy)) return { status: "unavailable", reason: "policy-changed" }
    if (!await observation.proof.verifyCurrent().catch(() => false)) return { status: "denied" }
    const final = await currentPolicy().catch(() => undefined)
    if (!final) return { status: "unavailable", reason: "policy-unavailable" }
    if (!samePolicy(final, observation.policy)) return { status: "unavailable", reason: "policy-changed" }
    if (request.signal.aborted) return { status: "unauthenticated" }
  }
  const capture = async (request: Request, refreshSession = true): Promise<Captured> => {
    if (request.signal.aborted) return { status: "unauthenticated" }
    if (refreshSession && prepare) {
      const prepared = await prepare(request).then(() => true).catch(() => false)
      if (!prepared) return { status: "unavailable", reason: "identity-unavailable" }
    }
    const configured = await currentPolicy().catch(() => undefined)
    if (!configured) return { status: "unavailable", reason: "policy-unavailable" }
    if (!configured.supremeAdminGroupId) return { status: "denied" }
    const observed = await observeAdministrator(request, configured.supremeAdminGroupId).catch(() => undefined)
    if (!observed) return { status: "unavailable", reason: "identity-unavailable" }
    if (observed.status === "unavailable") return { status: "unavailable", reason: graphReason(observed.reason) }
    if (observed.status !== "available") return observed
    const principal = await Promise.resolve().then(() => teamProfilePrincipal(observed.principal)).catch(() => undefined)
    if (!principal || principal.tenantId !== binding.tenantId || typeof observed.verifyCurrent !== "function")
      return { status: "denied" }
    const observation = Object.freeze({
      principal, policy: configured,
      proof: Object.freeze({
        status: "available" as const, principal, verifyCurrent: observed.verifyCurrent,
        ...(observed.readTeam ? { readTeam: observed.readTeam } : {}),
      }),
    })
    return await verify(request, observation) ?? { status: "observed", observation }
  }
  const stableCatalog = async (request: Request, observation: Observation, expected: TeamProfileCatalog): Promise<Failure | undefined> => {
    const final = await verify(request, observation)
    if (final) return final
    const current = await store.read().catch(() => undefined)
    if (!current) return { status: "unavailable", reason: "store-unavailable" }
    if (current.configRevision !== expected.configRevision) return { status: "unavailable", reason: "policy-changed" }
    if (request.signal.aborted) return { status: "unauthenticated" }
  }
  const verifyTeam = async (request: Request, observation: Observation, teamObjectId: string): Promise<Failure | undefined> => {
    if (observation.policy.teams !== "direct" || !observation.proof.readTeam)
      return { status: "unavailable", reason: "capability-disabled" }
    const team = await observation.proof.readTeam(teamObjectId).catch(() => undefined)
    if (!team) return { status: "unavailable", reason: "provider-unavailable" }
    if (team.state === "unavailable") return { status: "unavailable", reason: graphReason(team.reason) }
    if (team.tenantId !== binding.tenantId || team.principalObjectId !== observation.principal.principalObjectId ||
        team.source !== "team" || team.team.teamObjectId !== teamObjectId)
      return { status: "unavailable", reason: "invalid-response" }
    return verify(request, observation)
  }
  return Object.freeze({
    async administrator(request: Request, options?: { refreshSession?: boolean }): Promise<TeamProfileAdministratorObservation> {
      const captured = await capture(request, options?.refreshSession)
      if (captured.status === "unavailable") return { status: "unavailable", reason: "provider_unavailable" }
      if (captured.status !== "observed") return captured
      const observation = captured.observation
      return Object.freeze({
        status: "available", principal: observation.principal,
        verifyCurrent: async () => !await verify(request, observation),
        ...(observation.proof.readTeam ? { readTeam: observation.proof.readTeam } : {}),
      })
    },
    async list(request: Request): Promise<TeamProfile.AdminListResult> {
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const catalog = await store.read().catch(() => undefined)
      if (!catalog) return { status: "unavailable", reason: "store-unavailable" }
      return await stableCatalog(request, captured.observation, catalog) ??
        { status: "ok", configRevision: catalog.configRevision, profiles: catalog.profiles }
    },
    async configure(request: Request, value: unknown): Promise<TeamProfile.AdminConfigureResult> {
      const command = teamProfilePolicyCommand(value)
      if (!command || !sameTeamProfileBinding(command.profile, binding)) return { status: "invalid-request" }
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const observation = captured.observation
      const state: { failure?: Failure } = {}
      const result = await store.mutate({
        command, principal: observation.principal, at: now(), signal: request.signal,
        authorize: async () => {
          // The actual Team lookup and supreme-group proof run after queue admission, inside the writer.
          state.failure = await verify(request, observation) ??
            (command.action === "enable" ? await verifyTeam(request, observation, command.profile.teamObjectId) : undefined)
          return state.failure === undefined
        },
      }).catch(() => undefined)
      if (state.failure) return state.failure
      if (!result) return { status: "unavailable", reason: "store-unavailable" }
      // A committed edit remains durable if authority disappears before response publication.
      return await verify(request, observation) ?? result
    },
    async configuration(request: Request, value: unknown): Promise<TeamProfile.ConfigurationReadResult> {
      const parsed = Schema.decodeUnknownOption(TeamProfile.Ref)(value)
      if (Option.isNone(parsed) || !sameTeamProfileBinding(parsed.value, binding)) return { status: "invalid-request" }
      const profile = Object.freeze({ ...parsed.value })
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const catalog = await store.read().catch(() => undefined)
      if (!catalog) return { status: "unavailable", reason: "store-unavailable" }
      const read = await store.readConfiguration(profile).then((configuration) => ({ configuration })).catch(() => undefined)
      if (!read) return { status: "unavailable", reason: "store-unavailable" }
      const final = await stableCatalog(request, captured.observation, catalog)
      if (final) return final
      if (!read.configuration) return { status: "not-found" }
      if (read.configuration.configRevision !== catalog.configRevision) return { status: "unavailable", reason: "policy-changed" }
      return { status: "ok", configuration: read.configuration }
    },
    async configureConfiguration(request: Request, value: unknown): Promise<TeamProfile.AdminConfigureResult> {
      const command = teamConfigurationCommand(value)
      if (!command || !sameTeamProfileBinding(command.profile, binding)) return { status: "invalid-request" }
      const captured = await capture(request)
      if (captured.status !== "observed") return captured
      const observation = captured.observation
      const state: { failure?: Failure } = {}
      const result = await store.configureConfiguration({
        command, principal: observation.principal, at: now(), signal: request.signal,
        authorize: async () => {
          state.failure = await verify(request, observation)
          return state.failure === undefined
        },
      }).catch(() => undefined)
      if (state.failure) return state.failure
      if (!result) return { status: "unavailable", reason: "store-unavailable" }
      return await verify(request, observation) ?? result
    },
  })
}

function samePolicy(left: TeamProfilePolicySource, right: TeamProfilePolicySource) {
  return left.teams === right.teams && left.supremeAdminGroupId === right.supremeAdminGroupId
}

function graphReason(reason: EntraTeamsUnavailableReason): TeamProfile.AdminUnavailableReason {
  if (reason === "capability_disabled") return "capability-disabled"
  if (reason === "consent_required") return "consent-required"
  if (reason === "forbidden") return "forbidden"
  if (reason === "throttled") return "rate-limited"
  if (reason === "timeout") return "timeout"
  if (reason === "incomplete" || reason === "limit_exceeded") return "incomplete"
  if (reason === "invalid_response" || reason === "identity_mismatch") return "invalid-response"
  if (reason === "provider_unavailable") return "provider-unavailable"
  return "identity-unavailable"
}
