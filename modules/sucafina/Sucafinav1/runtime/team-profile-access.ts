import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Option, Schema } from "effect"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { EntraTeamsObservation } from "./local-contract.ts"
import { readTeamProfileIntent } from "./team-profile-selector.ts"

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
}) {
  const installationId = teamProfileInstallationId(input)
  const binding = { installationId, tenantId: input.tenantId, origin: input.origin, mount: input.mount }
  const enabled = new Set(input.enabledTeamIds)
  return async (request: Request, teamObjectId?: string, options?: { refreshSession?: boolean }) => {
    const intent = readTeamProfileIntent(request, binding)
    if (!intent || (teamObjectId && intent.kind === "team" && teamObjectId !== intent.profile.teamObjectId))
      return { status: "denied" } as const
    if (options?.refreshSession !== false) await input.prepare(request)
    const observation = await input.observeTeams(request)
    const observed = observation.result
    if (request.signal.aborted) return { status: "denied" } as const
    if (observed.state === "unauthenticated") return { status: "unauthenticated" } as const
    if (observed.state !== "complete" || observed.tenantId !== input.tenantId ||
        observed.source !== "joinedTeams" || observed.membership !== "direct") return { status: "unavailable" } as const

    // The intersection is the only source of eligibility. A selector expresses intent.
    const eligible = observed.teams.filter((team) => !team.archived && enabled.has(team.teamObjectId))
    const selectedId = teamObjectId ?? (intent.kind === "team" ? intent.profile.teamObjectId : undefined)
    const selected = selectedId ? eligible.find((team) => team.teamObjectId === selectedId) :
      eligible.length === 1 ? eligible[0] : undefined
    const readMembers = observation.readMembers
    if (selected && observation.verifyCurrent) return {
      status: "allowed",
      profile: { installationId, tenantId: input.tenantId, teamObjectId: selected.teamObjectId },
      principalObjectId: observed.principalObjectId,
      verifyCurrent: observation.verifyCurrent,
      ...(readMembers ? { readMembers: () => readMembers(selected.teamObjectId) } : {}),
    } as const
    if (selectedId || eligible.length === 0) return { status: "denied" } as const
    if (eligible.length === 1) return { status: "unavailable" } as const

    const choices = eligible.map((team) => ({
      profile: { installationId, tenantId: input.tenantId, teamObjectId: team.teamObjectId },
      displayName: team.name,
    }))
    const state = Schema.decodeUnknownOption(TeamProfile.TeamState)({ status: "selection-required", choices })
    return Option.isSome(state) && state.value.status === "selection-required" ? state.value : { status: "unavailable" } as const
  }
}
