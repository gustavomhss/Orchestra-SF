import { SfTeamContext, type SfTeamContextQuery, type SfTeamContextResult } from "@orchestra/schema/sucafina/context"
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
  const configRevision = digestSfValue([...enabled].sort())
  async function observe(request: Request) {
    await input.prepare(request)
    const observation = await input.observeTeams(request)
    const observed = observation.result
    if (request.signal.aborted) return { status: "denied" } as const
    if (observed.state === "unauthenticated") return { status: "unauthenticated" } as const
    if (observed.state === "unavailable") return {
      status: "unavailable",
      reason: observed.reason === "consent_required" ? "consent-required" : "identity-unavailable",
    } as const
    if (observed.tenantId !== input.tenantId ||
        observed.source !== "joinedTeams" || observed.membership !== "direct") return { status: "unavailable" } as const

    // The intersection is the only source of eligibility. A selector expresses intent.
    const eligible = observed.teams.filter((team) => !team.archived && enabled.has(team.teamObjectId))
    return { status: "observed", observation, eligible, principalObjectId: observed.principalObjectId } as const
  }
  const profileFor = (teamObjectId: string) => ({ installationId, tenantId: input.tenantId, teamObjectId })
  const choicesFor = (eligible: Extract<Awaited<ReturnType<typeof observe>>, { status: "observed" }>["eligible"]) =>
    eligible.map((team) => ({ profile: profileFor(team.teamObjectId), displayName: team.name }))

  async function authorize(request: Request, teamObjectId?: string) {
    const intent = readTeamProfileIntent(request, binding)
    if (!intent || (teamObjectId && intent.kind === "team" && teamObjectId !== intent.profile.teamObjectId))
      return { status: "denied" } as const
    const current = await observe(request)
    if (current.status === "unavailable") return { status: "unavailable" } as const
    if (current.status !== "observed") return current
    const { observation, eligible } = current
    const selectedId = teamObjectId ?? (intent.kind === "team" ? intent.profile.teamObjectId : undefined)
    const selected = selectedId ? eligible.find((team) => team.teamObjectId === selectedId) :
      eligible.length === 1 ? eligible[0] : undefined
    const readMembers = observation.readMembers
    if (selected && observation.verifyCurrent) return {
      status: "allowed",
      profile: profileFor(selected.teamObjectId),
      principalObjectId: current.principalObjectId,
      verifyCurrent: observation.verifyCurrent,
      ...(readMembers ? { readMembers: () => readMembers(selected.teamObjectId) } : {}),
    } as const
    if (selectedId || eligible.length === 0) return { status: "denied" } as const
    if (eligible.length === 1) return { status: "unavailable" } as const

    const state = Schema.decodeUnknownOption(TeamProfile.TeamState)({ status: "selection-required", choices: choicesFor(eligible) })
    return Option.isSome(state) && state.value.status === "selection-required" ? state.value : { status: "unavailable" } as const
  }

  async function readContext(request: Request, query: SfTeamContextQuery,
    technical: Readonly<{ projectId: string; hostId: string }>): Promise<SfTeamContextResult> {
    if (query.installationId !== installationId || query.tenantId !== input.tenantId || query.hostId !== technical.hostId)
      return { status: "unavailable", reason: "contract-mismatch" }
    const current = await observe(request)
    if (current.status === "unavailable") return { status: "unavailable", reason: current.reason ?? "invalid-response" }
    if (current.status !== "observed") return current
    if (query.kind === "administration") return { status: "denied" }
    const choices = choicesFor(current.eligible)
    const selected = query.kind === "team"
      ? choices.find((choice) => choice.profile.teamObjectId === query.teamObjectId)?.profile
      : choices.length === 1 ? choices[0]?.profile : undefined
    if ((!selected && query.kind === "team") || !choices.length) return { status: "denied" }

    const principal = { tenantId: input.tenantId, principalObjectId: current.principalObjectId }
    const accessRevision = digestSfValue({
      installationId, principal, configRevision, selected,
      eligible: choices.map((choice) => choice.profile.teamObjectId).sort(),
    })
    const decoded = Schema.decodeUnknownOption(SfTeamContext, { onExcessProperty: "error" })({
      contractRevision: "sf-team-profile/1",
      authMode: "microsoft",
      stamp: {
        ...technical, installationId, principalRef: principal.principalObjectId,
        policyVersion: "sf-team-profile/1", accessRevision,
        ...(selected ? { team: { owner: { profile: selected, principal }, revisions: { configRevision, accessRevision } } } : {}),
      },
      profile: {
        contractRevision: "sf-team-profile/1", status: "authenticated", installationId, principal, accessRevision,
        administration: { status: "denied" },
        teams: selected ? { status: "ready", choices, selected, configRevision } : { status: "selection-required", choices },
      },
      destinations: [], availability: [],
    })
    if (Option.isNone(decoded)) return { status: "unavailable", reason: "invalid-response" }
    if (!await current.observation.verifyCurrent?.() || request.signal.aborted) return { status: "unauthenticated" }
    return { status: "ok", value: decoded.value }
  }

  return Object.assign(authorize, { readContext })
}
