import { expect, test } from "bun:test"
import { createEntraClient } from "../../runtime/entra-client.ts"
import type { EntraGroupMembershipInput, EntraTeamInput } from "../../runtime/local-contract.ts"
import { group, principalId, teamA, teamB, tenant } from "./admin-policy-fixture.ts"

// Controlled Graph transport; every result is produced by the actual bounded confidential client.
// This file does not claim a live tenant login or replace the integrated session-observer tests.
function fixture(options: { teams?: boolean; confidential?: boolean } = {}) {
  const requests: Request[] = []
  const state: {
    now: number
    person: string
    member: boolean
    archived: boolean
    groupReply?: unknown
    teamReply?: unknown
    refusal?: number
    before?: (request: Request) => Promise<void>
  } = { now: 1700000000000, person: principalId, member: true, archived: false }
  const token = "controlled-delegated-token"
  const client = createEntraClient({
    tenantId: tenant, clientId: "44444444-4444-4444-8444-444444444444",
    profile: options.confidential === false ? "local-public" : "web-confidential",
    ...(options.confidential === false ? {} : { clientSecret: async () => "controlled-client-secret" }),
    ...(options.teams === false ? {} : { teams: "direct" as const }),
    now: () => new Date(state.now),
    fetch: async (request) => {
      requests.push(request)
      await state.before?.(request)
      if (request.headers.get("authorization") !== "Bearer " + token) return Response.json({}, { status: 401 })
      if (state.refusal) return Response.json({ error: "controlled provider refusal" }, { status: state.refusal })
      const url = new URL(request.url)
      if (url.origin !== "https://graph.microsoft.com") throw new Error("Unexpected provider host")
      if (url.pathname === "/v1.0/me") return Response.json({ id: state.person, displayName: "Controlled principal" })
      if (url.pathname === "/v1.0/me/checkMemberGroups") {
        expect(request.method).toBe("POST")
        expect(await request.clone().json()).toEqual({ groupIds: [group] })
        return Response.json(state.groupReply ?? { value: state.member ? [group] : [] })
      }
      if (url.pathname === "/v1.0/teams/" + teamA) {
        expect(request.method).toBe("GET")
        expect(url.search).toBe("?$select=id,displayName,isArchived,tenantId")
        return Response.json(state.teamReply ?? { id: teamA, tenantId: tenant, displayName: "Controlled Team", isArchived: state.archived })
      }
      throw new Error("Unexpected Graph operation " + url.pathname)
    },
  })
  const input = {
    tokens: { accessToken: token, expiresAt: state.now + 60000, grantedScopes: ["User.Read", "Team.ReadBasic.All"] },
    principal: { tenantId: tenant, principalObjectId: principalId },
  }
  const readGroup = (value: EntraGroupMembershipInput = { ...input, groupObjectId: group }) => {
    if (!client.checkGroupMembership) throw new Error("Confidential membership reader required")
    return client.checkGroupMembership(value)
  }
  const readTeam = (value: EntraTeamInput = { ...input, teamObjectId: teamA }) => {
    if (!client.team) throw new Error("Confidential Team lookup required")
    return client.team(value)
  }
  return { client, state, input, requests, readGroup, readTeam }
}

test("admin Graph: configured group proof uses the current principal and never requests Team membership or business roles", async () => {
  const f = fixture({ teams: false })
  expect(await f.readGroup()).toEqual({
    state: "complete", tenantId: tenant, principalObjectId: principalId,
    groupObjectId: group, source: "checkMemberGroups", membership: "transitive", member: true,
  })
  expect(f.requests.map((request) => new URL(request.url).pathname)).toEqual([
    "/v1.0/me", "/v1.0/me/checkMemberGroups", "/v1.0/me",
  ])
  expect(await f.client.resolve(f.input.tokens.accessToken, [])).toEqual({ id: principalId, roles: [], canWrite: false })
  expect(f.client.team).toBeUndefined()
  expect(f.client.joinedTeams).toBeUndefined()
})

test("admin Graph: first Team lookup needs no joinedTeams result and preserves archived state without inventing membership", async () => {
  const f = fixture()
  f.state.archived = true
  expect(await f.readTeam()).toEqual({
    state: "complete", tenantId: tenant, principalObjectId: principalId, source: "team",
    team: { teamObjectId: teamA, name: "Controlled Team", archived: true },
  })
  expect(f.requests.map((request) => new URL(request.url).pathname)).toEqual([
    "/v1.0/me", "/v1.0/teams/" + teamA, "/v1.0/me",
  ])
})

test("admin Graph: local-public adapters do not gain administrative readers", () => {
  const f = fixture({ confidential: false })
  expect(f.client.checkGroupMembership).toBeUndefined()
  expect(f.client.team).toBeUndefined()
  expect(f.requests).toEqual([])
})

test("admin Graph: absent effective scopes, expired tokens and malformed selectors do not reach the provider", async () => {
  const f = fixture()
  expect(await f.readGroup({ ...f.input, groupObjectId: group,
    tokens: { ...f.input.tokens, grantedScopes: ["User.ReadBasic.All"] } })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(await f.readTeam({ ...f.input, teamObjectId: teamA,
    tokens: { ...f.input.tokens, grantedScopes: ["User.Read"] } })).toEqual({ state: "unavailable", reason: "consent_required" })
  expect(await f.readTeam({ ...f.input, teamObjectId: teamA,
    tokens: { ...f.input.tokens, expiresAt: f.state.now } })).toEqual({ state: "unavailable", reason: "token_expired" })
  expect(await f.readGroup({ ...f.input, groupObjectId: "group:" + group })).toEqual({ state: "unavailable", reason: "invalid_response" })
  expect(await f.readTeam({ ...f.input, teamObjectId: teamA + "/members" })).toEqual({ state: "unavailable", reason: "invalid_response" })
  expect(f.requests).toEqual([])
})

test("admin Graph: negative membership and provider refusal are never an administrative positive", async () => {
  const f = fixture()
  f.state.member = false
  expect(await f.readGroup()).toMatchObject({ state: "complete", member: false })
  f.state.refusal = 403
  expect(await f.readGroup()).toEqual({ state: "unavailable", reason: "forbidden" })
  expect(await f.readTeam()).toEqual({ state: "unavailable", reason: "forbidden" })
})

test("admin Graph: a principal change after a positive group response invalidates that proof", async () => {
  const f = fixture()
  f.state.before = async (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") f.state.person = teamB
  }
  expect(await f.readGroup()).toEqual({ state: "unavailable", reason: "identity_mismatch" })
})

test("admin Graph: token expiration during Team lookup invalidates the result", async () => {
  const f = fixture()
  f.state.before = async (request) => {
    if (new URL(request.url).pathname.startsWith("/v1.0/teams/")) f.state.now = f.input.tokens.expiresAt
  }
  expect(await f.readTeam()).toEqual({ state: "unavailable", reason: "token_expired" })
})

test("admin Graph: malformed membership or foreign Team data cannot become a complete proof", async () => {
  const f = fixture()
  f.state.groupReply = { value: [group, group] }
  expect(await f.readGroup()).toEqual({ state: "unavailable", reason: "invalid_response" })
  f.state.groupReply = { value: [group], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/checkMemberGroups" }
  expect(await f.readGroup()).toEqual({ state: "unavailable", reason: "invalid_response" })
  f.state.teamReply = { id: teamA, tenantId: teamB, displayName: "Same name", isArchived: false }
  expect(await f.readTeam()).toEqual({ state: "unavailable", reason: "invalid_response" })
})

test("admin Graph: suspended calls retain their captured token, principal and Team intent", async () => {
  const f = fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const first = { value: true }
  f.state.before = async () => {
    if (!first.value) return
    first.value = false
    entered.resolve()
    await release.promise
  }
  const value = { tokens: { ...f.input.tokens, grantedScopes: [...f.input.tokens.grantedScopes] },
    principal: { ...f.input.principal }, teamObjectId: teamA }
  const pending = f.readTeam(value)
  await entered.promise
  value.tokens.accessToken = "another-token"
  value.tokens.grantedScopes.splice(0)
  value.principal.principalObjectId = teamB
  value.teamObjectId = teamB
  release.resolve()
  expect(await pending).toMatchObject({ state: "complete", principalObjectId: principalId, team: { teamObjectId: teamA } })
  expect(f.requests.every((request) => request.headers.get("authorization") === "Bearer " + f.input.tokens.accessToken)).toBe(true)
})
