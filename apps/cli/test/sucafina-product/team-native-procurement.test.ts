import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { Schema } from "effect"
import { lstat, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { createModule } from "../../../../modules/sucafina/Sucafinav1/index.ts"
import { openLocalStore } from "../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createSfTeamNativeProcurement } from "../../src/sucafina-product/team-native-procurement.ts"

// Identity/context are controlled components. HTTP, Application, Procurement,
// projection and SQLite are original. This is not Microsoft or installed LIVE.
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-team-procurement-"))
  const store = await openLocalStore(root)
  const state = {
    current: true, role: "requester", revision: 1, contextReads: 0, authReads: 0,
    loseAfterEnvironment: false, loseOnSecondAuth: false, mutateAfterFirstRead: false,
    requests: new Set<Request>(), originalRequests: true, cleanup: false,
  }
  const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
    installationId: "component-procurement-installation",
    tenantId: "11111111-1111-4111-8111-111111111111",
    teamObjectId: "44444444-4444-4444-8444-444444444444",
  })
  const principal = { tenantId: profile.tenantId, principalObjectId: "33333333-3333-4333-8333-333333333333" }
  const mount = "/sucafina"
  const teamMount = mount + "/teams/" + profile.teamObjectId
  const handler = createModule(teamMount, {
    persistence: store,
    rolePolicy: () => [],
    async authenticate(request) {
      state.originalRequests &&= state.requests.has(request)
      state.authReads++
      if (state.loseOnSecondAuth && state.authReads >= 2) state.role = "none"
      return { id: principal.principalObjectId, canWrite: true,
        roles: state.role === "none" ? [] : [{ surface: "procurement", role: state.role }] }
    },
    async environment(request) {
      state.originalRequests &&= state.requests.has(request)
      if (state.loseAfterEnvironment) state.current = false
      return { at: "2026-11-22T12:00:00Z", id: () => "component-id",
        directory: [{ id: principal.principalObjectId, name: "Controlled Procurement actor" }] }
    },
    maxJsonBytes: 2 * 1024 * 1024,
  })
  let binding: SfTeamInstallationDescriptor
  const context = () => Schema.decodeUnknownSync(SfTeamContext)({
    contractRevision: "sf-team-profile/1", authMode: "microsoft",
    stamp: { installationId: profile.installationId, projectId: profile.installationId, hostId: "component-host",
      principalRef: principal.principalObjectId, policyVersion: "sf-team-profile/1", accessRevision: "access-1",
      team: { owner: { profile, principal }, revisions: { configRevision: state.revision, accessRevision: "access-1" } } },
    profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: profile.installationId,
      principal, accessRevision: "access-1", administration: { status: "denied" },
      teams: { status: "ready", selected: profile, configRevision: state.revision,
        choices: [{ profile, displayName: "Controlled Procurement Team" }] } },
    destinations: [], availability: [],
  })
  const listener = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(request, server) {
      if (server.requestIP(request)?.address !== "127.0.0.1") throw new Error("Original loopback peer required")
      state.requests.add(request)
      const reader = createSfTeamNativeProcurement({
        request, handler, binding, profile, current: async () => state.current,
        async readContext(original, query) {
          state.contextReads++
          state.originalRequests &&= original === request && query.teamObjectId === profile.teamObjectId
          if (state.mutateAfterFirstRead && state.contextReads === 2) state.revision++
          return { status: "ok", value: context() }
        },
      })
      return await reader.handle() ?? await handler(request) ?? new Response(null, { status: 404 })
    },
  })
  binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
    installationId: profile.installationId, tenantId: profile.tenantId,
    projectId: profile.installationId, hostId: "component-host", publicOrigin: listener.url.origin,
    mount, contractRevision: "sf-team-profile/1", authMode: "microsoft",
  })
  const selector = JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile })
  const request = (suffix: string, init: RequestInit = {}) => fetch(listener.url.origin + mount + suffix, {
    ...init, headers: { "x-sf-team-profile": selector, ...Object.fromEntries(new Headers(init.headers)) },
  })
  const command = (body: unknown) => request("/teams/" + profile.teamObjectId + "/procurement", {
    method: "POST", headers: { origin: listener.url.origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const read = (query = "") => request("/api/ui/pages/CAP25" + query)
  const durable = () => {
    const database = new Database(join(root, "installation.sqlite"), { readonly: true })
    try {
      database.exec("BEGIN")
      const snapshots = database.query("SELECT surface, payload FROM snapshots ORDER BY surface").all()
      const blobs = database.query("SELECT surface, key, hex(payload) AS bytes, type FROM blobs ORDER BY surface, key").all()
      database.exec("COMMIT")
      return { snapshots, blobs }
    } finally { database.close() }
  }
  const close = async () => {
    await listener.stop(true)
    await store.dispose()
    await rm(root, { recursive: true, force: true })
    await lstat(root).then(() => { throw new Error("Owned reader fixture remains") }, (error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    })
    state.cleanup = true
  }
  return { root, store, state, profile, binding, handler, context, request, command, read, durable, close }
}

test("Team CAP25 uses original HTTP writer, projection and versionRecord; CAS409 and validation422 have no durable effect", async () => {
  const f = await fixture()
  try {
    const create = await f.command({ page: "Requests", action: "create", version: 0,
      values: { pr: { title: "Controlled negative-write request", description: "Operational proof fixture" } } })
    expect(create.status).toBe(200)
    const created = await create.json()
    expect(created.ok).toBe(true)
    const id = created.value.number
    expect(typeof id).toBe("string")
    const response = await f.read("?request=" + encodeURIComponent(id))
    expect(response.status).toBe(200)
    const before = await response.json()
    expect(before.context.team.owner.profile).toEqual(f.profile)
    expect(before.context.principalRef).toBe(f.context().stamp.principalRef)
    expect(before.value.data.requests.some((row: { number: string }) => row.number === id)).toBe(true)
    const version = before.value.versions["requests:" + id]
    expect(version).toMatchObject({ version: expect.any(Number), by: expect.any(String) })
    const durable = f.durable()
    for (const [expected, values, submittedVersion] of [
      [409, { pr: { title: "Must not persist" } }, version.version + 10],
      [422, { "pr.constructor": "invalid original form field" }, version.version],
    ] as const) {
      const denied = await f.command({ page: "Requests", action: "save", id, version: submittedVersion, values })
      expect(denied.status).toBe(expected)
      expect(await denied.json()).toMatchObject({ ok: false })
      const after = await f.read("?request=" + encodeURIComponent(id))
      expect(after.status).toBe(200)
      expect(await after.json()).toEqual(before)
      expect(f.durable()).toEqual(durable)
    }
    expect(f.state.originalRequests).toBe(true)
  } finally { await f.close() }
  expect(f.state.cleanup).toBe(true)
})

test("Team CAP25 refuses missing, foreign, duplicate and legacy selectors before original authority is read", async () => {
  const f = await fixture()
  try {
    const durable = f.durable()
    const attempts: Array<[string, Record<string, string>, number]> = [
      ["/api/ui/pages/CAP25", { "x-sf-team-profile": "" }, 403],
      ["/api/ui/pages/CAP25", { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team",
        profile: { ...f.profile, teamObjectId: "55555555-5555-4555-8555-555555555555" } }) }, 403],
      ["/api/ui/pages/CAP25?request=a&request=b", {}, 400],
      ["/api/ui/pages/CAP25?projectId=legacy", {}, 400],
      ["/api/ui/pages/CAP25", { origin: "https://foreign.example.test" }, 403],
      ["/api/ui/pages/CAP25", { "sec-fetch-site": "cross-site" }, 403],
    ]
    for (const [route, headers, status] of attempts) {
      const response = await f.request(route, { headers })
      expect(response.status).toBe(status)
      await response.body?.cancel()
    }
    expect(f.state.contextReads).toBe(0)
    expect(f.state.authReads).toBe(0)
    expect(f.durable()).toEqual(durable)
  } finally { await f.close() }
})

test("Team CAP25 revalidates Procurement roles after source IO without trusting an unchanged Dashboard revision", async () => {
  const f = await fixture()
  try {
    f.state.loseOnSecondAuth = true
    const before = f.durable()
    const response = await f.read()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ status: "stale", reason: "procurement-source-changed" })
    expect(f.state.authReads).toBe(2)
    expect(f.context().stamp.accessRevision).toBe("access-1")
    expect(f.durable()).toEqual(before)
  } finally { await f.close() }
})

test("Team CAP25 refuses revocation during environment IO and a changed Team configuration at publication", async () => {
  const f = await fixture()
  try {
    const before = f.durable()
    f.state.loseAfterEnvironment = true
    const denied = await f.read()
    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({ status: "denied" })
    f.state.current = true
    f.state.loseAfterEnvironment = false
    f.state.contextReads = 0
    f.state.mutateAfterFirstRead = true
    const stale = await f.read()
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ status: "stale", reason: "procurement-source-changed" })
    expect(f.durable()).toEqual(before)
  } finally { await f.close() }
})

test("Team CAP25 rejects an invented Application source and leaves unrelated routes with their original owner", async () => {
  const f = await fixture()
  try {
    const request = new Request(f.binding.publicOrigin + "/sucafina/api/ui/pages/CAP25")
    expect(() => createSfTeamNativeProcurement({
      request, handler: async () => new Response(), binding: f.binding, profile: f.profile,
      current: async () => true, readContext: async () => ({ status: "ok", value: f.context() }),
    })).toThrow("SF_TEAM_PROCUREMENT_ORIGINAL_SOURCE_REQUIRED")
    const response = await f.request("/api/ui/pages/CAP14")
    expect(response.status).toBe(404)
    await response.body?.cancel()
    expect(f.state.authReads).toBe(0)
  } finally { await f.close() }
})
