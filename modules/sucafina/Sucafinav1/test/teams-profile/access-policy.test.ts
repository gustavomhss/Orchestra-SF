import { afterEach, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { createTeamProfileAccess } from "../../runtime/team-profile-access.ts"
import type { EntraTeamsObservation, TeamProfileAdministratorObservation } from "../../runtime/local-contract.ts"
import { adminCommand, mount, origin, policyFixture, principal, principalId, teamA, teamB, tenant } from "./admin-policy-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

async function fixture(seeds: readonly string[] = []) {
  const f = await policyFixture(seeds)
  cleanups.push(f.close)
  const state: {
    teams: { teamObjectId: string; name: string; archived: boolean }[]
    generation: number
    administrator: boolean
    prepareCalls: number
    unavailable: boolean
    beforeTeams?: () => Promise<void>
  } = { teams: [], generation: 1, administrator: false, prepareCalls: 0, unavailable: false }
  const access = createTeamProfileAccess({
    origin, mount, directory: f.directory, tenantId: tenant, enabledTeamIds: seeds, profilePolicy: f.profiles(),
    prepare: async () => { state.prepareCalls++ },
    observeTeams: async (): Promise<EntraTeamsObservation> => {
      const generation = state.generation
      await state.beforeTeams?.()
      if (state.unavailable) return { result: { state: "unavailable", reason: "forbidden" } }
      return {
        result: { state: "complete", tenantId: tenant, principalObjectId: principalId,
          source: "joinedTeams", membership: "direct", teams: state.teams.map((team) => ({ ...team })) },
        verifyCurrent: async () => state.generation === generation,
      }
    },
    observeAdministrator: async (): Promise<TeamProfileAdministratorObservation> => {
      if (!state.administrator) return { status: "denied" }
      const generation = state.generation
      return { status: "available", principal,
        verifyCurrent: async () => state.administrator && generation === state.generation }
    },
  })
  const business = (teamObjectId = teamA) => new Request(origin + mount + "/teams/" + teamObjectId + "/dashboard", {
    headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: f.profile(teamObjectId) }) },
  })
  const readContext = (kind: "selection" | "team" | "administration", teamObjectId?: string) => {
    const query = Schema.decodeUnknownSync(TeamProfile.ContextQuery)({
      contractRevision: "sf-team-profile/1", installationId: f.installationId, tenantId: tenant,
      hostId: "controlled-host", kind, ...(teamObjectId ? { teamObjectId } : {}),
    })
    const request = new Request(origin + mount + "/api/ui/context?" + new URLSearchParams({
      contractRevision: query.contractRevision, installationId: query.installationId, tenantId: query.tenantId,
      hostId: query.hostId, kind: query.kind, ...(query.teamObjectId ? { teamObjectId: query.teamObjectId } : {}),
    }))
    return access.readContext(request, query, { projectId: f.installationId, hostId: "controlled-host" })
  }
  return { ...f, state, access, business, readContext }
}

test("Team context: authenticated zero Teams is represented without admitting business or inventing destinations", async () => {
  const f = await fixture([teamA])
  const context = await f.readContext("selection")
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Authenticated projection required")
  expect(context.value.profile.teams).toEqual({ status: "no-teams" })
  expect(context.value.stamp.team).toBeUndefined()
  expect(context.value.destinations).toEqual([])
  expect(context.value.availability).toEqual([])
  expect(await f.access(f.business())).toEqual({ status: "denied" })
})

test("Team administration: zero memberships retains current administrator but supplies no Team owner or business admission", async () => {
  const f = await fixture([teamA])
  f.state.administrator = true
  const context = await f.readContext("administration")
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Administrative projection required")
  expect(context.value.profile).toMatchObject({ principal, administration: { status: "available" }, teams: { status: "no-teams" } })
  expect(context.value.stamp.team).toBeUndefined()
  expect(context.value.destinations).toEqual([])
  expect(context.value.availability).toEqual([])
  expect(await f.access(f.business())).toEqual({ status: "denied" })
  const forged = new Request(origin + mount + "/dashboard", {
    headers: { "x-sf-team-profile": JSON.stringify({
      contractRevision: "sf-team-profile/1", kind: "administration", installationId: f.installationId, tenantId: tenant,
    }) },
  })
  expect(await f.access(forged)).toEqual({ status: "denied" })
})

test("Team revocation: persisted disable invalidates held authorization and projects revoked without selecting a sibling", async () => {
  const f = await fixture([teamA, teamB])
  f.state.teams = [
    { teamObjectId: teamA, name: "A", archived: false },
    { teamObjectId: teamB, name: "B", archived: false },
  ]
  const before = await f.readContext("team", teamA)
  const admission = await f.access(f.business())
  expect(admission.status).toBe("allowed")
  if (admission.status !== "allowed") throw new Error("Initial Team admission required")
  expect(await admission.verifyCurrent()).toBe(true)
  const beforePrepare = f.state.prepareCalls
  const catalog = await f.profiles().read()
  expect(await f.profiles().mutate({
    principal, at: 1700000000000, authorize: async () => true,
    command: adminCommand(f.profile(), "disable", catalog.configRevision),
  })).toMatchObject({ status: "ok", changed: true })
  expect(await admission.verifyCurrent()).toBe(false)
  expect(f.state.prepareCalls).toBe(beforePrepare)
  expect(await f.access(f.business())).toEqual({ status: "denied" })
  const revoked = await f.readContext("team", teamA)
  expect(revoked.status).toBe("ok")
  if (revoked.status !== "ok" || before.status !== "ok") throw new Error("Typed corporate contexts required")
  expect(revoked.value.profile.teams).toEqual({ status: "revoked" })
  expect(revoked.value.stamp.team).toBeUndefined()
  expect(revoked.value.stamp.accessRevision).not.toBe(before.value.stamp.accessRevision)
  const sibling = await f.readContext("team", teamB)
  expect(sibling.status).toBe("ok")
  if (sibling.status !== "ok") throw new Error("Sibling remains eligible")
  expect(sibling.value.stamp.team?.owner).toEqual({ profile: f.profile(teamB), principal })
})

test("Team authority: membership and encrypted-session generations are reread before a captured request can commit", async () => {
  const f = await fixture([teamA, teamB])
  f.state.teams = [{ teamObjectId: teamA, name: "A", archived: false }]
  const membership = await f.access(f.business())
  if (membership.status !== "allowed") throw new Error("Initial Team admission required")
  f.state.teams = [{ teamObjectId: teamB, name: "B", archived: false }]
  expect(await membership.verifyCurrent()).toBe(false)
  expect(await f.access(f.business())).toEqual({ status: "denied" })
  f.state.teams = [{ teamObjectId: teamA, name: "A", archived: false }]
  const session = await f.access(f.business())
  if (session.status !== "allowed") throw new Error("Initial session admission required")
  f.state.generation++
  expect(await session.verifyCurrent()).toBe(false)
})

test("Team administration: a configured archived Team never becomes eligible, and provider failure is not an empty list", async () => {
  const f = await fixture([teamA])
  f.state.administrator = true
  f.state.teams = [{ teamObjectId: teamA, name: "Archived A", archived: true }]
  expect(await f.access(f.business())).toEqual({ status: "denied" })
  const archived = await f.readContext("administration")
  expect(archived.status).toBe("ok")
  if (archived.status !== "ok") throw new Error("Administrative projection required")
  expect(archived.value.profile.teams).toEqual({ status: "no-teams" })
  expect(archived.value.stamp.team).toBeUndefined()
  f.state.unavailable = true
  const failed = await f.readContext("administration")
  expect(failed.status).toBe("ok")
  if (failed.status !== "ok") throw new Error("Independent administration required")
  expect(failed.value.profile.teams).toEqual({ status: "unavailable", reason: "forbidden" })
  expect(failed.value.profile.administration).toEqual({ status: "available" })
  expect(failed.value.stamp.team).toBeUndefined()
})

test("Team context: administrative proof revoked during enumeration cannot escape at egress", async () => {
  const f = await fixture()
  f.state.administrator = true
  f.state.beforeTeams = async () => { f.state.administrator = false }
  expect(await f.readContext("administration")).toEqual({ status: "denied" })
})

test("Team context: group removal during the final membership reread suppresses the administrative projection", async () => {
  const f = await fixture()
  f.state.administrator = true
  const enumerations = { count: 0 }
  f.state.beforeTeams = async () => {
    enumerations.count++
    if (enumerations.count === 2) f.state.administrator = false
  }
  expect(await f.readContext("administration")).toEqual({ status: "denied" })
})
