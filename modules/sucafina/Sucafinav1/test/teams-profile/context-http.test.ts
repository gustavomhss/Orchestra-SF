import { afterEach, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { oid, tenant } from "../microsoft-login/oidc-fixture.ts"
import { profileA, profileB } from "./installation-fixture.ts"
import { teamProductFixture } from "./product-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

async function fixture(input: Parameters<typeof teamProductFixture>[0] = {}) {
  const f = await teamProductFixture(input)
  cleanups.push(f.close)
  const calls: Request[] = []
  const hooks: { operational?: () => Promise<void> } = {}
  const current = { technical: f.technical }
  const live = createSfLiveContext({
    origin: f.binding.origin, mount: f.binding.mount, currentBinding: () => current.technical,
    admit: async (request) => {
      const admitted = await f.authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      const destinations = sfContextDestinationsFromPages(admitted.pages)
      return destinations ? { status: "ok", stamp: admitted.stamp, authMode: "microsoft", destinations }
        : { status: "unavailable", reason: "contract-mismatch" }
    },
    teams: {
      tenantId: tenant,
      admit: async (request) => {
        calls.push(request)
        const admitted = await f.authority.readTeamContextAdmission(request)
        if (admitted.status !== "ok") return admitted
        const destinations = admitted.binding ? sfContextDestinationsFromPages(admitted.pages) : []
        return destinations ? { ...admitted, destinations } : { status: "unavailable", reason: "contract-mismatch" }
      },
    },
    operational: async () => { await hooks.operational?.(); return [] },
  })
  const services = { nativeUiProducts: live }
  const runtime = { services }
  const handler = createSfContextHandler({
    origin: f.binding.origin, mount: f.binding.mount, runtime: () => runtime.services,
  })
  return { ...f, handler, live, calls, hooks, current, runtime }
}

async function context(response: Response) {
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  const result = Schema.decodeUnknownSync(SfTeamContextResult)(await response.json())
  if (result.status !== "ok") throw new Error("Current corporate context required")
  expect(response.headers.get("x-sf-contract-revision")).toBe("sf-team-profile/1")
  expect(response.headers.get("x-sf-access-revision")).toBe(result.value.stamp.accessRevision)
  return result.value
}

test("Teams context: signed session and current product authority project full owner separately from placement", async () => {
  const f = await fixture()
  const request = f.contextRequest("team")
  const value = await context(await f.handler.handle(request))
  expect(value.profile.principal.principalObjectId).toBe(oid)
  expect(value.profile.teams.status).toBe("ready")
  expect(value.stamp.team?.owner.profile).toEqual(profileA)
  expect(value.stamp.team?.owner.principal).toEqual(value.profile.principal)
  expect(value.stamp.team?.revisions.accessRevision).toBe(value.profile.accessRevision)
  expect(value.stamp.projectId).toBe(f.technical.projectId)
  expect(value.stamp.projectId).not.toBe(profileA.teamObjectId)
  expect(value.destinations.length).toBeGreaterThan(0)
  expect(f.calls.length).toBe(3)
  expect(f.calls.every((call) => call === request)).toBe(true)
  for (const field of ["admission", "epoch", "groups", "grants", "accessToken", "refreshToken"])
    expect(JSON.stringify(value)).not.toContain('"' + field + '"')
})

test("Teams context: complete zero and multiple Teams stay authenticated without business destinations", async () => {
  for (const enabled of [[], [profileA, profileB]]) {
    const f = await fixture({ enabled })
    const value = await context(await f.handler.handle(f.contextRequest()))
    expect(value.profile.teams.status).toBe(enabled.length ? "selection-required" : "no-teams")
    expect(value.profile.administration.status).toBe("available")
    expect(value.stamp.team).toBeUndefined()
    expect(value.destinations).toEqual([])
    expect(value.availability).toEqual([])
  }
})

test("Teams context: one eligible Team auto-selects only from the explicit selection intent", async () => {
  const f = await fixture()
  const value = await context(await f.handler.handle(f.contextRequest()))
  expect(value.profile.teams.status).toBe("ready")
  expect(value.stamp.team?.owner.profile).toEqual(profileA)
  const before = f.provider.requests.length
  const legacy = f.request("/api/ui/context?installationId=" + profileA.installationId +
    "&projectId=" + f.technical.projectId + "&hostId=" + f.technical.hostId, f.cookie)
  expect((await f.handler.handle(legacy)).status).toBe(400)
  expect(f.provider.requests).toHaveLength(before)
})

test("Teams context: corporate administrator with no roles, no grants and Teams capability disabled has only administration", async () => {
  const f = await fixture({ roles: false, grants: [], teams: false })
  const value = await context(await f.handler.handle(f.contextRequest("administration")))
  expect(value.profile.administration).toEqual({ status: "available" })
  expect(value.profile.teams.status).toBe("unavailable")
  expect(value.profile.accessRevision.length).toBeGreaterThan(0)
  expect(value.stamp.team).toBeUndefined()
  expect(value.destinations).toEqual([])
  expect(value.availability).toEqual([])
  expect(f.provider.requests.some((request) => request.url.includes("/joinedTeams"))).toBe(false)
})

test("Teams context: failed Teams enumeration preserves independently verified administration", async () => {
  const f = await fixture({ roles: false, grants: [] })
  f.provider.hooks.before = (request) => new URL(request.url).pathname.endsWith("/joinedTeams")
    ? Response.json({ error: "forbidden" }, { status: 403 }) : undefined
  const value = await context(await f.handler.handle(f.contextRequest("administration")))
  expect(value.profile.administration).toEqual({ status: "available" })
  expect(value.profile.teams).toEqual({ status: "unavailable", reason: "forbidden" })
  expect(value.stamp.team).toBeUndefined()
  expect(value.destinations).toEqual([])
})

test("Teams context: Basic credentials, known IDs and unsigned cookies do not authenticate a user", async () => {
  const f = await fixture()
  for (const request of [
    f.contextRequest("selection", profileA, ""),
    new Request(f.contextRequest().url, { headers: { authorization: "Basic " + btoa("operator:secret") } }),
    new Request(f.contextRequest().url, { headers: { "x-session-id": oid, "x-principal-id": oid } }),
    f.contextRequest("selection", profileA, "sf_session=unsigned"),
  ]) {
    const response = await f.handler.handle(request)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: "unauthenticated" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
})

test("Teams context: closed query rejects mixed, duplicate and cross-bound intents without Graph reads", async () => {
  const f = await fixture()
  const valid = f.contextRequest("team")
  const before = f.provider.requests.length
  for (const request of [
    new Request(valid.url + "&projectId=" + f.technical.projectId, { headers: valid.headers }),
    new Request(valid.url + "&tenantId=" + tenant, { headers: valid.headers }),
    new Request(valid.url + "&%74enantId=" + tenant, { headers: valid.headers }),
    new Request(valid.url + "&accessRevision=caller", { headers: valid.headers }),
    new Request(valid.url.replace(tenant, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), { headers: valid.headers }),
    new Request(valid.url.replace(f.technical.hostId, "foreign-host"), { headers: valid.headers }),
    new Request(valid.url, { headers: { ...Object.fromEntries(valid.headers),
      "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }) } }),
  ]) expect((await f.handler.handle(request)).status).toBe(400)
  expect(f.provider.requests).toHaveLength(before)
})

test("Teams context: HEAD validates the versioned binding without identity or Graph side effects", async () => {
  const f = await fixture()
  const before = f.provider.requests.length
  const response = await f.handler.handle(new Request(f.contextRequest().url, { method: "HEAD" }))
  expect(response.status).toBe(200)
  expect(await response.text()).toBe("")
  expect(response.headers.get("x-sf-contract-revision")).toBe("sf-team-profile/1")
  expect(f.calls).toHaveLength(0)
  expect(f.provider.requests).toHaveLength(before)
})

test("Teams context: membership revoked during operational observation publishes no stale profile", async () => {
  const f = await fixture()
  f.hooks.operational = async () => { f.provider.directTeams.set(oid, []) }
  const response = await f.handler.handle(f.contextRequest("team"))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

test("Teams context: current grant removal during an await publishes no stale business destinations", async () => {
  const f = await fixture()
  f.hooks.operational = async () => { await f.writeGrants([]) }
  const response = await f.handler.handle(f.contextRequest("team"))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

test("Teams context: logout during an await revokes the captured real session", async () => {
  const f = await fixture()
  f.hooks.operational = async () => { await f.logout(f.cookie) }
  const response = await f.handler.handle(f.contextRequest("team"))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

test("Teams context: identical technical IDs on a replacement runtime cannot release a late projection", async () => {
  const f = await fixture()
  f.hooks.operational = async () => { f.current.technical = { ...f.technical } }
  const response = await f.handler.handle(f.contextRequest("team"))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

test("Teams context: abort during an await releases neither profile nor destinations", async () => {
  const f = await fixture()
  const abort = new AbortController()
  f.hooks.operational = async () => { abort.abort() }
  const original = f.contextRequest("team")
  const request = new Request(original.url, { headers: original.headers, signal: abort.signal })
  const response = await f.handler.handle(request)
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
  expect(f.calls.every((call) => call === request)).toBe(true)
})

test("Teams context: administration intent with full roles still grants no business binding", async () => {
  const f = await fixture()
  const value = await context(await f.handler.handle(f.contextRequest("administration")))
  expect(value.profile.teams.status).toBe("ready")
  expect(value.profile.administration.status).toBe("available")
  expect(value.stamp.team).toBeUndefined()
  expect(value.destinations).toEqual([])
  expect(value.availability).toEqual([])
})

test("Teams context: loss of selected Team cannot fall through to another Team on the same physical host", async () => {
  const f = await fixture({ enabled: [profileA, profileB] })
  f.hooks.operational = async () => { f.provider.directTeams.set(oid, [{
    id: profileB.teamObjectId, tenantId: tenant, displayName: "Second eligible Team", isArchived: false,
  }]) }
  const response = await f.handler.handle(f.contextRequest("team", profileA))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})
