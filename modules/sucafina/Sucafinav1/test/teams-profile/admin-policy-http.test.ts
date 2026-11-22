import { afterEach, expect, test } from "bun:test"
import { createTeamProfileHttp } from "../../runtime/team-profile-http.ts"
import { createTeamProfileResolver } from "../../runtime/team-profile-resolver.ts"
import type { TeamProfileAdministratorObservation } from "../../runtime/local-contract.ts"
import { group, mount, origin, policyFixture, principal, principalId, teamA, tenant } from "./admin-policy-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

// This exercises the real HTTP/resolver/SQLite boundary with a controlled identity capability.
// The integrated Microsoft observer is verified by microsoft-installation tests, not fabricated here.
async function fixture(seeds: readonly string[] = []) {
  const f = await policyFixture(seeds)
  cleanups.push(f.close)
  const state: {
    current: boolean
    member: boolean
    groupId: string
    observations: number
    lookedUp: string[]
    beforeTeam?: () => Promise<void>
  } = { current: true, member: true, groupId: group, observations: 0, lookedUp: [] }
  const resolver = createTeamProfileResolver({
    installationId: f.installationId, tenantId: tenant, store: f.profiles(),
    policy: async () => ({ teams: "direct", supremeAdminGroupId: state.groupId }),
    observeAdministrator: async (_request, groupId): Promise<TeamProfileAdministratorObservation> => {
      state.observations++
      if (!state.current) return { status: "unauthenticated" }
      if (!state.member || groupId !== group) return { status: "denied" }
      return {
        status: "available", principal,
        verifyCurrent: async () => state.current && state.member,
        readTeam: async (teamObjectId) => {
          state.lookedUp.push(teamObjectId)
          await state.beforeTeam?.()
          return { state: "complete", tenantId: tenant, principalObjectId: principalId,
            source: "team", team: { teamObjectId, name: "A verified Team", archived: false } }
        },
      }
    },
  })
  const handle = createTeamProfileHttp({ origin, mount, installationId: f.installationId, tenantId: tenant, resolver })
  const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: f.installationId, tenantId: tenant })
  const url = origin + mount + "/api/ui/team-profiles?" + query
  const post = (value: unknown) => new Request(url, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value),
  })
  const response = async (request: Request) => {
    const result = await handle(request)
    if (!result) throw new Error("Actual private admin route required")
    return result
  }
  return { ...f, state, resolver, handle, url, post, response }
}

test("admin HTTP: first Team registration uses the independent capability and audits the actual principal", async () => {
  const f = await fixture()
  const listing = await f.response(new Request(f.url))
  expect(listing.status).toBe(200)
  const initial = await f.profiles().read()
  expect(await listing.json()).toEqual({ status: "ok", ...initial })
  const result = await f.response(f.post({ action: "enable", profile: f.profile(), expectedRevision: initial.configRevision }))
  expect(result.status).toBe(200)
  expect(await result.json()).toMatchObject({ status: "ok", changed: true })
  expect(f.state.lookedUp).toEqual([teamA])
  expect((await f.profiles().read()).profiles).toEqual([{ profile: f.profile(), enabled: true }])
  expect(f.readRows("SELECT action, principal_object_id FROM sf_team_profile_audit")).toEqual([
    { action: "enable", principal_object_id: principalId },
  ])
  expect(f.readRows("SELECT * FROM snapshots")).toEqual([])
  expect(f.readRows("SELECT * FROM authentication_payloads")).toEqual([])
})

test("admin HTTP: group revocation during Team lookup prevents a policy write", async () => {
  const f = await fixture()
  const before = await f.profiles().read()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  f.state.beforeTeam = async () => { entered.resolve(); await release.promise }
  const pending = f.response(f.post({ action: "enable", profile: f.profile(), expectedRevision: before.configRevision }))
  await entered.promise
  f.state.member = false
  release.resolve()
  expect((await pending).status).toBe(403)
  expect(await f.profiles().read()).toEqual(before)
  expect(f.readRows("SELECT * FROM sf_team_profile_audit")).toEqual([])
})

test("admin HTTP: owner policy changes during lookup and missing current membership fail closed", async () => {
  const f = await fixture()
  const before = await f.profiles().read()
  f.state.beforeTeam = async () => { f.state.groupId = teamA }
  const response = await f.response(f.post({ action: "enable", profile: f.profile(), expectedRevision: before.configRevision }))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "policy-changed" })
  expect(await f.profiles().read()).toEqual(before)
  expect((await f.response(new Request(f.url))).status).toBe(403)
})

test("admin HTTP: duplicate writers get one opaque revision winner and a stale retry is conflict", async () => {
  const f = await fixture()
  const initial = await f.profiles().read()
  const command = { action: "enable", profile: f.profile(), expectedRevision: initial.configRevision }
  const outcomes = await Promise.all([f.response(f.post(command)), f.response(f.post(command))])
  expect(outcomes.map((response) => response.status).toSorted()).toEqual([200, 409])
  expect((await f.response(f.post(command))).status).toBe(409)
  expect(f.readRows("SELECT config_revision FROM sf_team_profile_audit")).toEqual([{ config_revision: 1 }])
})

test("admin HTTP: forged authority, ambiguous JSON, hostile bindings and cross-origin writes are rejected before identity", async () => {
  const f = await fixture()
  const initial = await f.profiles().read()
  const command = { action: "enable", profile: f.profile(), expectedRevision: initial.configRevision }
  expect((await f.response(f.post({ ...command, principal, grants: ["admin"] }))).status).toBe(400)
  expect((await f.response(new Request(f.url + "&tenantId=" + tenant))).status).toBe(400)
  expect((await f.response(new Request(f.url, {
    method: "POST", headers: { origin: "https://foreign.example.test", "content-type": "application/json" }, body: JSON.stringify(command),
  }))).status).toBe(403)
  expect((await f.response(new Request(f.url, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(command).replace('"action":"enable"', '"action":"disable","action":"enable"'),
  }))).status).toBe(400)
  expect((await f.response(f.post({ ...command, profile: { ...f.profile(), tenantId: teamA } }))).status).toBe(403)
  expect(f.state.observations).toBe(0)
  expect(await f.profiles().read()).toEqual(initial)
})

test("admin HTTP: configuration is shared closed data, has CAS, and never becomes a grant", async () => {
  const f = await fixture([teamA])
  const initial = await f.profiles().read()
  const configurationUrl = f.url.replace("/team-profiles?", "/team-profiles/configuration?")
  const document = { version: 1, settings: { model: "provider/model" } }
  const configure = (value: unknown) => f.response(new Request(configurationUrl, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value),
  }))
  expect((await configure({ profile: f.profile(), expectedRevision: initial.configRevision, document })).status).toBe(200)
  expect((await configure({ profile: f.profile(), expectedRevision: initial.configRevision, document })).status).toBe(409)
  const read = await f.response(new Request(configurationUrl + "&teamObjectId=" + teamA))
  expect(read.status).toBe(200)
  expect(await read.json()).toMatchObject({
    status: "ok", configuration: { origin: "installation-team-store", profile: f.profile(), document },
  })
  expect(f.readRows("SELECT * FROM snapshots")).toEqual([])
})
