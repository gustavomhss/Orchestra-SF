import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
import { access, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { SfTeamContext, SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTeamContextQuery } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { createModule } from "../../../modules/sucafina/Sucafinav1/index.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createTeamProfileAccess, teamProfileInstallationId } from "../../../modules/sucafina/Sucafinav1/runtime/team-profile-access.ts"
import { emptyMap } from "../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createSfTeamNativeDomain, readSfTeamNativeDomainBindings } from "../src/sucafina-product/team-native-domain.ts"
import type { SfTeamNativeDomainBindings } from "../src/sucafina-product/team-native-domain.ts"
import { readSfApplicationContext, readSfApplicationSource } from "../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Snapshot, TransactionOptions } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { sfContextDestinationsFromPages } from "../src/sucafina-product/native-ui/live-context.ts"
import { createSfContextHandler } from "../src/sucafina-product/native-ui/context.ts"

// Real Application, Domain.view/execute, HTTP Request/Response, CAS and SQLite.
// Only the Microsoft observation boundary is controlled; no installed/tenant claim.
const origin = "https://sf-domain.example.test", mount = "/sucafina"
const tenantId = "11111111-1111-4111-8111-111111111111"
const principalId = "22222222-2222-4222-8222-222222222222"
const teams = ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"] as const
const pages = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
type Capability = keyof typeof pages

async function fixture(work: (f: Awaited<ReturnType<typeof createFixture>>) => Promise<void>) {
  const f = await createFixture()
  try { await work(f) } finally { await f.close() }
}
async function createFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-team-domain-"))
  const installationId = teamProfileInstallationId({ origin, mount, directory })
  const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
    installationId, tenantId, projectId: installationId, hostId: "host-" + randomUUID(),
    publicOrigin: origin, mount, contractRevision: "sf-team-profile/1", authMode: "microsoft",
  })
  const state: {
    authenticated: boolean; active: boolean; policyCurrent: boolean; role: "admin" | "viewer"; teams: string[];
    originals: Request[]; writerRequests: Request[]; environmentCalls: number; contextCalls: number; currentCalls: number;
    rootCalls: number; rootDepth: number; maxRootDepth: number; businessDepth: number; maxBusinessDepth: number;
    rootReads: { identity: object; readOnly: boolean; poisoned: boolean; reads: object[] }[];
    environmentHook?: () => Promise<void>; contextHook?: (request: Request) => Promise<void>;
    currentHook?: () => Promise<void>;
  } = { authenticated: true, active: true, policyCurrent: true, role: "admin", teams: [...teams],
    originals: [], writerRequests: [], environmentCalls: 0, contextCalls: 0, currentCalls: 0,
    rootCalls: 0, rootDepth: 0, maxRootDepth: 0, businessDepth: 0, maxBusinessDepth: 0, rootReads: [] }
  const valid = (request: Request) => state.authenticated && request.headers.get("cookie") === "component-session=original"
  const accessReader = createTeamProfileAccess({
    origin, mount, directory, tenantId, enabledTeamIds: teams, prepare: async () => {},
    readBusinessContext: async (request, admission) => {
      state.businessDepth++
      state.maxBusinessDepth = Math.max(state.maxBusinessDepth, state.businessDepth)
      try {
        const index = profiles.findIndex((profile) => profile.teamObjectId === admission.profile.teamObjectId)
        const handler = handlers[index]
        if (!handler) return undefined
        const source = readSfApplicationSource(handler)!
        const observe = async () => {
          const captured: { native?: SfTeamNativeDomainBindings } = {}
          const observed = await readSfApplicationContext(handler, request, admission.principalObjectId, async () => {
            if (!await admission.verifyCurrent()) return false
            const heldRoot = source.application.persistence.currentSnapshotScope?.()
            if (!heldRoot?.readOnly || heldRoot.poisoned) return false
            captured.native = await readSfTeamNativeDomainBindings({
              request, handler, binding, profile: admission.profile, principalObjectId: admission.principalObjectId,
              current: async () => await admission.verifyCurrent() && state.policyCurrent, heldRoot: heldRoot.identity,
            })
            return !!captured.native
          })
          if (!observed || !captured.native) return undefined
          const original = sfContextDestinationsFromPages(observed.pages)
          if (!original) return undefined
          const nativeIds = new Set(captured.native.destinations.map((item) => item.capabilityId))
          return {
            accessRevision: digestSfValue({ original: observed.accessRevision, native: captured.native.accessRevision }),
            destinations: [...original.filter((item) => !nativeIds.has(item.capabilityId)), ...captured.native.destinations],
            availability: captured.native.availability,
          }
        }
        const first = await observe()
        if (!first) return undefined
        return { ...first, owner: Schema.decodeUnknownSync(TeamProfile.Owner)({ profile: admission.profile,
          principal: { tenantId, principalObjectId: admission.principalObjectId } }),
          verifyCurrent: async () => {
            const current = await observe()
            return !!current && digestSfValue(current) === digestSfValue(first)
          } }
      } finally { state.businessDepth-- }
    },
    observeTeams: async (request) => {
      state.originals.push(request)
      const eligible = [...state.teams]
      return valid(request) ? {
        result: { state: "complete", tenantId, principalObjectId: principalId, source: "joinedTeams", membership: "direct",
          teams: eligible.map((teamObjectId) => ({ teamObjectId, name: "Same name", archived: false })) },
        verifyCurrent: async () => state.active && valid(request) && JSON.stringify(eligible) === JSON.stringify(state.teams),
      } : { result: { state: "unauthenticated" } }
    },
  })
  const profiles = teams.map((teamObjectId) => Schema.decodeUnknownSync(TeamProfile.Ref)({ installationId, tenantId, teamObjectId }))
  const stores = await Promise.all(profiles.map((profile) => openLocalStore(path.join(directory, "business-teams", digestSfValue(profile)))))
  const handlers = stores.map((persistence) => createModule(mount + "/teams/" + profiles[stores.indexOf(persistence)]!.teamObjectId, {
    persistence: {
      ...persistence,
      readSnapshotRoot: <T>(work: () => Promise<T>, options?: TransactionOptions) => {
        state.rootCalls++
        return persistence.readSnapshotRoot!(async () => {
          state.rootDepth++
          state.maxRootDepth = Math.max(state.maxRootDepth, state.rootDepth)
          const scope = persistence.currentSnapshotScope!()!
          state.rootReads.push({ ...scope, reads: [] })
          try { return await work() } finally { state.rootDepth-- }
        }, options)
      },
      transaction: (surface, work, options) => persistence.transaction(surface, async (snapshot: Snapshot) => {
        const scope = persistence.currentSnapshotScope?.()
        if (scope && state.rootDepth) state.rootReads.at(-1)!.reads.push(scope.identity)
        return work(snapshot)
      }, options),
    }, maxJsonBytes: 2 * 1024 * 1024,
    authenticate: async (request) => {
      state.originals.push(request)
      return valid(request) ? { id: principalId, canWrite: state.role === "admin",
        roles: emptyMap().filter((row) => row.role === state.role) } : null
    },
    environment: async () => {
      state.environmentCalls++
      await state.environmentHook?.()
      return { at: "2026-11-22T12:00:00.000Z", id: randomUUID, directory: [{ id: principalId, name: "Component actor" }] }
    },
  }))
  const originalRead = async (request: Request, query: SfTeamContextQuery): Promise<SfTeamContextResult> => {
    state.contextCalls++
    await state.contextHook?.(request)
    return accessReader.readContext(request, query, binding)
  }
  const runtime = { nativeUiProducts: { currentBinding: () => binding, teamTenantId: tenantId, readTeamContext: originalRead } }
  const f02 = createSfContextHandler({ origin, mount, runtime: () => runtime })
  const bridge = (request: Request, team = 0, handler = handlers[team]!) => createSfTeamNativeDomain({
    request, handler, binding, profile: profiles[team]!, readContext: originalRead,
    current: async () => { state.currentCalls++; await state.currentHook?.(); return state.active },
  })
  const request = (suffix: string, init: RequestInit = {}, team = 0) => new Request(origin + mount + suffix, {
    ...init, headers: { Cookie: "component-session=original", ...Object.fromEntries(new Headers(init.headers)),
      ...(suffix.startsWith("/api/ui/context") ? {} : { "X-SF-Team-Profile": JSON.stringify({
        contractRevision: "sf-team-profile/1", kind: "team", profile: profiles[team],
      }) }) },
  })
  const contextRequest = (team = 0) => request("/api/ui/context?" + new URLSearchParams({
    contractRevision: "sf-team-profile/1", installationId, tenantId, hostId: binding.hostId,
    kind: "team", teamObjectId: profiles[team]!.teamObjectId,
  }))
  const context = async (team = 0) => {
    const result = await bridge(contextRequest(team), team).readContext()
    if (result.status !== "ok") throw new Error("Component Team context unavailable: " + result.status)
    return result.value
  }
  const command = async (cap: Capability, values: Record<string, unknown>, options: { team?: number; id?: string; version?: number; action?: string } = {}) => {
    const team = options.team ?? 0, current = await context(team)
    const stamp = current.stamp
    const req = request("/teams/" + profiles[team]!.teamObjectId + "/dashboard?page=" + encodeURIComponent(pages[cap]), {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID(),
        "X-SF-Access-Revision": stamp.accessRevision, "X-SF-Native-Owner": Buffer.from(JSON.stringify({
          installationId, projectId: stamp.projectId, hostId: stamp.hostId, principalRef: stamp.principalRef,
        })).toString("base64url") },
      body: JSON.stringify({ page: pages[cap], action: options.action ?? "save", version: options.version ?? 0,
        ...(options.id ? { id: options.id } : {}), values }),
    }, team)
    // An unwrapped handler is required by the private Application provenance.
    state.writerRequests.push(req)
    return { request: req, response: (await bridge(req, team).handle())! }
  }
  const read = async (cap: Capability, team = 0, search = "?year=2026") => {
    const req = request("/api/ui/pages/" + cap + search, {}, team)
    return { request: req, response: (await bridge(req, team).handle())! }
  }
  const snapshot = (team = 0) => stores[team]!.transaction("dashboard", async (value) => ({ commit: false, value: structuredClone(value) }))
  const close = async () => {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(directory, { recursive: true, force: true })
    await expect(access(directory)).rejects.toMatchObject({ code: "ENOENT" })
  }
  return { directory, state, profiles, stores, handlers, binding, bridge, request, contextRequest, context, command, read, snapshot, close, f02 }
}

test("original Team reader publishes current CAP authority without legacy context or projected private state", async () => fixture(async (f) => {
  const ctx = await f.context()
  expect(Schema.is(SfTeamContext)(ctx)).toBe(true)
  expect(ctx.contractRevision).toBe("sf-team-profile/1")
  expect(ctx.stamp.team?.owner.profile).toEqual(f.profiles[0])
  expect(ctx.destinations.filter((item) => ["CAP14", "CAP04", "CAP05"].includes(item.capabilityId))
    .map((item) => item.capabilityId)).toEqual(["CAP14", "CAP04", "CAP05"])
  expect(ctx.destinations.filter((item) => ["CAP14", "CAP04", "CAP05"].includes(item.capabilityId))
    .every((item) => item.canRead && item.allowedActionIds.includes("save"))).toBe(true)
  expect(ctx.availability.every((item) => item.operations.every((operation) => operation.operational))).toBe(true)
  expect(JSON.stringify(ctx)).not.toMatch(/component-session|roleMap|snapshot|business-teams/)
  const request = f.contextRequest()
  f.state.originals.length = 0
  expect((await f.bridge(request).handle())!.status).toBe(200)
  expect(f.state.originals.every((value) => value === request)).toBe(true)
}))

test("real canonical commands and Domain projections keep all three CAPs isolated by Team with source CAS", async () => fixture(async (f) => {
  for (const cap of ["CAP14", "CAP04", "CAP05"] as const) {
    const values = cap === "CAP14" ? { vendor: "Vendor A", amount: 120, currency: "USD" } : { name: cap + " A", budget: 120 }
    const result = await f.command(cap, values)
    expect(result.response.status).toBe(200)
    expect(await result.response.json()).toMatchObject({ ok: true })
    const read = await f.read(cap)
    expect(read.response.status).toBe(200)
    const body = await read.response.json()
    expect(body.context.team.owner.profile).toEqual(f.profiles[0])
    expect(body.value.capabilityId).toBe(cap)
    expect(body.value.versions).toEqual(expect.objectContaining(Object.fromEntries(
      Object.keys(body.value.versions).map((key) => [key, expect.any(Number)]))))
    expect(JSON.stringify(body.value.data)).toContain(cap === "CAP14" ? "Vendor A" : cap + " A")
  }
  const other = await f.command("CAP14", { vendor: "Vendor B", amount: 90 }, { team: 1 })
  expect(other.response.status).toBe(200)
  const b = await (await f.read("CAP14", 1)).response.json()
  expect(JSON.stringify(b)).toContain("Vendor B")
  expect(JSON.stringify(b)).not.toContain("Vendor A")
  const a = await (await f.read("CAP14")).response.json()
  const row = a.value.data.contracts[0], version = a.value.versions["contracts:" + row.id]
  const before = await f.snapshot()
  expect((await f.command("CAP14", { vendor: "Stale writer", amount: 5 }, { id: row.id, version: version + 1 })).response.status).toBe(409)
  expect(await f.snapshot()).toEqual(before)
  expect((await f.command("CAP14", { vendor: "", amount: 5 }, { id: row.id, version })).response.status).toBe(422)
  expect(await f.snapshot()).toEqual(before)
}))

test("unauthenticated and read-only actors are rejected before malformed command bytes are consumed", async () => fixture(async (f) => {
  const req = f.request("/teams/" + teams[0] + "/dashboard?page=Vendor%20Contracts", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{bad json",
  })
  const before = await f.snapshot()
  f.state.authenticated = false
  expect((await f.bridge(req).handle())!.status).toBe(401)
  expect(req.bodyUsed).toBe(false)
  expect(await f.snapshot()).toEqual(before)
  f.state.authenticated = true; f.state.role = "viewer"
  expect((await f.bridge(req).handle())!.status).toBe(403)
  expect(req.bodyUsed).toBe(false)
  expect(await f.snapshot()).toEqual(before)
}))

test("a role change alters effective revision even when the original Team catalog is unchanged", async () => fixture(async (f) => {
  const before = await f.context()
  f.state.role = "viewer"
  const after = await f.context()
  expect(after.profile.teams).toEqual(before.profile.teams)
  expect(after.stamp.team?.revisions.configRevision).toBe(before.stamp.team?.revisions.configRevision)
  expect(after.stamp.accessRevision).not.toBe(before.stamp.accessRevision)
  expect(after.destinations.every((item) => item.allowedActionIds.length === 0)).toBe(true)
  expect(after.availability.some((item) => item.operations.some((op) => op.state === "denied"))).toBe(true)
}))

test("a role revoked during page IO hides the already admitted projection", async () => fixture(async (f) => {
  expect((await f.command("CAP14", { vendor: "Never leak after revocation", amount: 1 })).response.status).toBe(200)
  f.state.currentCalls = 0
  f.state.currentHook = async () => { if (f.state.currentCalls === 6) f.state.role = "viewer" }
  const result = await f.read("CAP14")
  expect([403, 409]).toContain(result.response.status)
  expect(await result.response.text()).not.toContain("Never leak after revocation")
}))

test("a competing original writer after projection creates a real stale-source response", async () => fixture(async (f) => {
  expect((await f.command("CAP14", { vendor: "Before", amount: 10 })).response.status).toBe(200)
  const initial = await (await f.read("CAP14")).response.json()
  const row = initial.value.data.contracts[0], version = initial.value.versions["contracts:" + row.id]
  f.state.contextCalls = 0
  f.state.contextHook = async () => {
    if (f.state.contextCalls !== 3) return
    const req = f.request("/teams/" + teams[0] + "/dashboard?page=Vendor%20Contracts", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ page: "Vendor Contracts", action: "save", id: row.id, version, values: { vendor: "After", amount: 20 } }),
    })
    expect((await f.handlers[0]!(req))!.status).toBe(200)
  }
  const result = await f.read("CAP14")
  expect(result.response.status).toBe(409)
  expect(await result.response.json()).toMatchObject({ status: "stale", reason: "domain-source-changed" })
  f.state.contextHook = undefined
  expect(JSON.stringify(await (await f.read("CAP14")).response.json())).toContain("After")
}))

test("foreign Team intent, host revision, cross-site and duplicate selection cannot read another source", async () => fixture(async (f) => {
  expect((await f.command("CAP14", { vendor: "Private A", amount: 1 })).response.status).toBe(200)
  const forged = f.request("/api/ui/pages/CAP14", {}, 1)
  expect((await f.bridge(forged, 0).handle())!.status).toBe(403)
  // The original Team selector rejects duplicate raw topics before page parsing.
  expect((await f.read("CAP14", 0, "?year=2026&year=2027")).response.status).toBe(403)
  const foreign = f.request("/api/ui/pages/CAP14", { headers: { Origin: "https://other.invalid" } })
  expect((await f.bridge(foreign).handle())!.status).toBe(403)
  const context = f.contextRequest()
  const duplicate = new Request(context.url + "&hostId=" + f.binding.hostId, context)
  expect((await f.bridge(duplicate).handle())!.status).toBe(400)
  const wrongHost = new Request(context.url.replace(f.binding.hostId, "foreign-host"), context)
  expect((await f.bridge(wrongHost).handle())!.status).toBe(409)
}))

test("a DTO or wrapper cannot substitute original Application provenance", async () => fixture(async (f) => {
  const request = f.contextRequest()
  const wrapper = async (request: Request) => f.handlers[0]!(request)
  expect((await f.bridge(request, 0, wrapper).readContext())).toEqual({ status: "unavailable", reason: "host-unavailable" })
  expect(f.state.originals).toHaveLength(0)
}))

test("command response uses the exact original Request and never authorizes a mismatched page discriminator", async () => fixture(async (f) => {
  const result = await f.command("CAP14", { vendor: "Original", amount: 1 })
  expect(result.response.status).toBe(200)
  expect(result.request.bodyUsed).toBe(true)
  const ctx = await f.context()
  const req = f.request("/teams/" + teams[0] + "/dashboard?page=Vendor%20Contracts", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID(),
      "X-SF-Access-Revision": ctx.stamp.accessRevision,
      "X-SF-Native-Owner": Buffer.from(JSON.stringify({ installationId: f.binding.installationId,
        projectId: ctx.stamp.projectId, hostId: ctx.stamp.hostId, principalRef: ctx.stamp.principalRef })).toString("base64url") },
    body: JSON.stringify({ page: "OPEX Detail", action: "save", version: 0, values: { name: "Wrong command", budget: 1 } }),
  })
  f.state.originals.length = 0
  const before = await f.snapshot()
  expect((await f.bridge(req).handle())!.status).toBe(403)
  expect(f.state.originals.every((value) => value === req)).toBe(true)
  expect(await f.snapshot()).toEqual(before)
}))

test("business authority revoked during the last private fence cannot publish an already projected page", async () => fixture(async (f) => {
  expect((await f.command("CAP14", { vendor: "Final fence private vendor", amount: 45 })).response.status).toBe(200)
  const before = await f.context(), snapshot = await f.snapshot()
  f.state.currentCalls = 0
  let revoked = 0
  // The bridge invokes eleven private checkpoints for its two F02 observations
  // and projection; the twelfth is its final source fence. The private fence
  // deliberately remains true while independent business authority changes.
  f.state.currentHook = async () => {
    if (f.state.currentCalls !== 12 || revoked) return
    revoked++
    f.state.role = "viewer"
  }
  const result = await f.read("CAP14")
  expect(revoked).toBe(1)
  expect(result.response.status).toBe(409)
  const body = await result.response.text()
  expect(body).not.toContain("Final fence private vendor")
  expect(JSON.parse(body)).toEqual({ status: "stale", reason: "domain-source-changed" })
  expect(await f.snapshot()).toEqual(snapshot)
  f.state.currentHook = undefined
  expect((await f.context()).stamp.accessRevision).not.toBe(before.stamp.accessRevision)
}))

test("original F02 composes one held root per observation and preserves other native families without recursion", async () => fixture(async (f) => {
  const request = f.contextRequest()
  const result = await f.f02.handle(request)
  expect(result.status).toBe(200)
  const live = Schema.decodeUnknownSync(SfTeamContextResult)(await result.json())
  if (live.status !== "ok") throw new Error("Original F02 unavailable")
  expect(live.value.destinations.some((item) => item.capabilityId === "CAP25" && item.canRead)).toBe(true)
  expect(new Set(live.value.destinations.map((item) => item.capabilityId)).size).toBe(live.value.destinations.length)
  expect(live.value.availability.map((item) => item.resource)).toEqual(["CAP14", "CAP04", "CAP05"])
  expect(f.state.rootCalls).toBe(2)
  expect(f.state.maxRootDepth).toBe(1)
  expect(f.state.maxBusinessDepth).toBe(1)
  expect(f.state.rootReads).toHaveLength(2)
  for (const held of f.state.rootReads) {
    expect(held.readOnly).toBe(true)
    expect(held.poisoned).toBe(false)
    expect(held.reads).toHaveLength(4)
    expect(held.reads.every((identity) => identity === held.identity)).toBe(true)
  }
  expect(f.state.originals.every((original) => original === request)).toBe(true)
  const bridged = await f.bridge(request).readContext()
  expect(bridged).toEqual(live)
  const malformed = new Request(request.url + "&hostId=" + f.binding.hostId, request)
  expect((await f.f02.handle(malformed)).status).toBe(400)
}))

test("native binding hook requires the original held root and F02 rejects its current-policy fence lost during observation", async () => fixture(async (f) => {
  const request = f.contextRequest()
  expect(await readSfTeamNativeDomainBindings({
    request, handler: f.handlers[0]!, binding: f.binding, profile: f.profiles[0]!,
    principalObjectId: principalId, current: async () => true, heldRoot: {},
  })).toBeUndefined()
  f.state.environmentHook = async () => { f.state.policyCurrent = false }
  const result = await f.f02.handle(request)
  expect(result.status).toBe(503)
  const value = await result.json()
  expect(value.status).toBe("unavailable")
  expect(value).not.toHaveProperty("value")
  expect(f.state.maxRootDepth).toBe(1)
  expect(f.state.maxBusinessDepth).toBe(1)
}))

test("internal POST authority observation retains Request/body and HTTP F02 remains a read-only route", async () => fixture(async (f) => {
  const request = f.request("/teams/" + teams[0] + "/dashboard?page=Vendor%20Contracts", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{unconsumed bytes",
  })
  const before = await f.snapshot()
  f.state.originals.length = 0
  const observed = await readSfApplicationContext(f.handlers[0]!, request, principalId, async () => f.state.active)
  expect(observed?.principalRef).toBe(principalId)
  expect(f.state.originals.length).toBeGreaterThan(0)
  expect(f.state.originals.every((original) => original === request)).toBe(true)
  expect(request.bodyUsed).toBe(false)
  expect(await f.snapshot()).toEqual(before)
  expect(await readSfApplicationContext(f.handlers[0]!, request, principalId)).toBeUndefined()
  expect(await readSfApplicationContext(f.handlers[0]!, request, principalId, async () => false)).toBeUndefined()
  const wrongMethod = new Request(request.url, { method: "DELETE", headers: request.headers })
  expect(await readSfApplicationContext(f.handlers[0]!, wrongMethod, principalId, async () => true)).toBeUndefined()
  const controller = new AbortController()
  const aborted = new Request(request, { signal: controller.signal })
  controller.abort()
  expect(await readSfApplicationContext(f.handlers[0]!, aborted, principalId, async () => true)).toBeUndefined()
  expect(request.bodyUsed).toBe(false)
  const f02 = new Request(f.contextRequest(), { method: "POST", body: "{unconsumed F02 bytes" })
  expect((await f.f02.handle(f02)).status).toBe(400)
  expect(f02.bodyUsed).toBe(false)
  expect(await f.snapshot()).toEqual(before)
}))
