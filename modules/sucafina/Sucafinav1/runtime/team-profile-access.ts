import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Option, Schema } from "effect"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { EntraTeamsSessionResult } from "./local-contract.ts"
import { readTeamProfileIntent } from "./team-profile-selector.ts"

export function createTeamProfileAccess(input: {
  origin: string
  mount: string
  directory: string
  tenantId: string
  enabledTeamIds: readonly string[]
  prepare: (request: Request) => Promise<void>
  readTeams: (request: Request) => Promise<EntraTeamsSessionResult>
}) {
  const installationId = digestSfValue({ origin: input.origin, mount: input.mount, directory: input.directory })
  const binding = { installationId, tenantId: input.tenantId, origin: input.origin, mount: input.mount }
  const enabled = new Set(input.enabledTeamIds)
  return async (request: Request) => {
    const intent = readTeamProfileIntent(request, binding)
    if (!intent) return { status: "denied" } as const
    await input.prepare(request)
    const observed = await input.readTeams(request)
    if (request.signal.aborted) return { status: "denied" } as const
    if (observed.state === "unauthenticated") return { status: "unauthenticated" } as const
    if (observed.state !== "complete" || observed.tenantId !== input.tenantId ||
        observed.source !== "joinedTeams" || observed.membership !== "direct") return { status: "unavailable" } as const

    // The intersection is the only source of eligibility. A selector expresses intent.
    const eligible = observed.teams.filter((team) => !team.archived && enabled.has(team.teamObjectId))
    if (intent.kind === "team") return eligible.some((team) => team.teamObjectId === intent.profile.teamObjectId)
      ? { status: "allowed" } as const : { status: "denied" } as const
    if (eligible.length <= 1) return { status: eligible.length === 1 ? "allowed" : "denied" } as const

    const choices = eligible.map((team) => ({
      profile: { installationId, tenantId: input.tenantId, teamObjectId: team.teamObjectId },
      displayName: team.name,
    }))
    const state = Schema.decodeUnknownOption(TeamProfile.TeamState)({ status: "selection-required", choices })
    return Option.isSome(state) && state.value.status === "selection-required" ? state.value : { status: "unavailable" } as const
  }
}
