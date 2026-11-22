import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Schema } from "effect"
import { SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTeamContext } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { object } from "../runtime/contract.ts"
import { microsoftHttpFixture } from "./fixture/microsoft-http.ts"

const pages = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
const operations = {
  CAP14: SfDomain.operations["domain.page.CAP14"],
  CAP04: SfDomain.operations["domain.page.CAP04"],
  CAP05: SfDomain.operations["domain.page.CAP05"],
  CAP03: SfDomain.operations["domain.page.CAP03"],
} as const
type Capability = keyof typeof pages

// Only the existing fixture's Microsoft/JWKS/Graph transport is controlled.
// These requests cross real loopback HTTP, signed-session issuance and the
// original factory, F02, Application, Domain, CAS and Team SQLite partitions.
async function fixture(id: string, work: (f: Awaited<ReturnType<typeof openFixture>>) => Promise<void>, nativeWeb = true) {
  const f = await openFixture(nativeWeb)
  try { await work(f) }
  finally {
    const transport = f.transport()
    await f.close()
    expect(f.state.cleanupComplete).toBe(true)
    expect(transport.requests).toBeGreaterThan(0)
    expect(transport.loopbackPeers).toBe(transport.requests)
    expect(transport.ingressRequests).toBe(transport.requests)
    console.log("G08_NATIVE_FACTORY_CLEANUP " + JSON.stringify({
      id, cleanup: true, requests: transport.requests, loopbackPeers: transport.loopbackPeers,
      ingressRequests: transport.ingressRequests, nativeWeb,
    }))
  }
}

async function openFixture(nativeWeb: boolean) {
  const f = await microsoftHttpFixture({ label: "g08", nativeWeb })
  try {
    const cookie = await f.login()
    const discovered = await f.state.installation?.discovery?.current(new AbortController().signal)
    const identity = discovered?.identity()
    const binding = identity && discovered ? Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
      contractRevision: "sf-team-profile/1", authMode: "microsoft", publicOrigin: discovered.publicOrigin,
      mount: discovered.mount, tenantId: discovered.tenantId, installationId: identity.installationId,
      projectId: identity.projectId, hostId: identity.hostId,
    }) : undefined
    expect(!!binding).toBe(nativeWeb)
    const contextResponse = (team = f.teamA, extra: Record<string, string> = {}, init: Pick<RequestInit, "method" | "body"> = {}) => {
      if (!binding) throw new Error("Native factory discovery required")
      return f.request("/api/ui/context?" + new URLSearchParams({
        contractRevision: "sf-team-profile/1", installationId: binding.installationId, tenantId: binding.tenantId,
        hostId: binding.hostId, kind: "team", teamObjectId: team,
      }), { cookie, ...extra }, init)
    }
    const context = async (team = f.teamA) => {
      const response = await contextResponse(team)
      expect(response.status).toBe(200)
      const result = Schema.decodeUnknownSync(SfTeamContextResult)(await response.json())
      if (result.status !== "ok") throw new Error("Current original F02 unavailable: " + result.status)
      expect<unknown>(result.value.stamp.team?.owner.profile).toEqual(f.profile(team))
      expect(result.value.stamp.principalRef).toBe(f.principalId)
      return result.value
    }
    const headers = (team = f.teamA) => ({ cookie, "x-sf-team-profile": f.selector(f.profile(team)) })
    const page = (capability: Capability | "CAP03" | "CAP25", team = f.teamA, extra: Record<string, string> = {}) =>
      f.request("/api/ui/pages/" + capability + (capability === "CAP04" || capability === "CAP05" ? "?year=2026" : ""),
        { ...headers(team), ...extra })
    const command = async (capability: Capability, values: Record<string, unknown>, options: {
      team?: string; id?: string; version?: number; action?: string; held?: SfTeamContext;
      extra?: Record<string, string>; body?: string
    } = {}) => {
      const team = options.team ?? f.teamA
      const stamp = (options.held ?? await context(team)).stamp
      return f.request("/teams/" + team + "/dashboard?" + new URLSearchParams({ page: pages[capability] }), {
        ...headers(team), origin: f.origin, "content-type": "application/json", "idempotency-key": randomUUID(),
        "x-sf-access-revision": stamp.accessRevision,
        "x-sf-native-owner": Buffer.from(JSON.stringify({
          installationId: stamp.installationId, projectId: stamp.projectId,
          hostId: stamp.hostId, principalRef: stamp.principalRef,
        })).toString("base64url"),
        ...options.extra,
      }, { method: "POST", body: options.body ?? JSON.stringify({
        page: pages[capability], action: options.action ?? "save", version: options.version ?? 0,
        ...(options.id ? { id: options.id } : {}), values,
      }) })
    }
    for (const team of [f.teamA, f.teamB]) {
      if (nativeWeb) await context(team)
      else {
        const response = await f.request("/teams/" + team + "/dashboard", { cookie })
        expect(response.status).toBe(200)
        await response.body?.cancel()
      }
    }
    return { ...f, cookie, binding, contextResponse, context, headers, page, command }
  } catch (error) { await f.close(); throw error }
}

test("Microsoft factory F02 binds all four native capabilities and preserves original Procurement authority", async () => fixture("native-readers", async (f) => {
  const current = await f.context()
  const capabilities = ["CAP14", "CAP04", "CAP05", "CAP03"]
  const native = current.destinations.filter((item) => capabilities.includes(item.capabilityId))
  expect<unknown>(native.map((item) => item.capabilityId)).toEqual(capabilities)
  expect(native.map((item) => [item.canRead, item.allowedActionIds])).toEqual([
    [true, ["save", "delete"]],
    [true, ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount", "import"]],
    [true, ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"]],
    [true, []],
  ])
  expect(current.destinations.some((item) => item.capabilityId === "CAP25" && item.canRead)).toBe(true)
  expect(new Set(current.destinations.map((item) => item.capabilityId)).size).toBe(current.destinations.length)
  expect<unknown>(current.availability.map((item) => item.resource)).toEqual(capabilities)
  for (const available of current.availability) {
    expect(available.family).toBe("domain-read")
    expect(available.state).toBe(available.resource === "CAP03" ? "partial" : "ready")
    const operations = Object.keys(SfOperationRegistry).filter((id) =>
      id === "domain.page." + available.resource || id.startsWith("domain.command." + available.resource + "."))
    expect<unknown>(available.operations.map((item) => item.operationId)).toEqual(operations)
    for (const item of available.operations) {
      const ready = available.resource !== "CAP03" || item.operationId === "domain.page.CAP03"
      expect(item.state).toBe(ready ? "ready" : "denied")
      expect(item.operational).toBe(ready)
      expect(item.reason).toBe(ready ? null : "current-business-authority-denied")
    }
  }
  for (const cap of ["CAP14", "CAP04", "CAP05", "CAP03"] as const) {
    const response = await f.page(cap)
    expect(response.status).toBe(200)
    const output: Schema.Top = operations[cap].output
    const result = object(Schema.decodeUnknownSync(Schema.toType(output))(await response.json()))
    expect(result.status).toBe("ok")
    expect(result.context).toEqual(current.stamp)
    expect(object(result.value).capabilityId).toBe(cap)
  }
  const created = await f.request("/teams/" + f.teamA + "/procurement", {
    ...f.headers(), origin: f.origin, "content-type": "application/json",
  }, { method: "POST", body: JSON.stringify({
    page: "Requests", action: "create", version: 0, values: { pr: { title: "G08 original private Requests A" } },
  }) })
  expect(created.status).toBe(200)
  expect(await created.json()).toMatchObject({ ok: true })
  const procurement = await f.page("CAP25")
  expect(procurement.status).toBe(200)
  const result = object(await procurement.json())
  expect(result.status).toBe("ok")
  expect(object(result.context).team).toEqual(current.stamp.team)
  expect(object(result.value).capabilityId).toBe("CAP25")
  expect(object(result.value).allowedActionIds).toEqual([])
  expect(JSON.stringify(object(result.value).data)).toContain("G08 original private Requests A")
  const other = await f.page("CAP25", f.teamB)
  expect(other.status).toBe(200)
  expect(await other.text()).not.toContain("G08 original private Requests A")
}))

test("Microsoft HTTP native commands use original CAS and keep CAP14 CAP04 CAP05 data in the selected Team", async () => fixture("native-writers", async (f) => {
  for (const cap of ["CAP14", "CAP04", "CAP05"] as const) {
    const values = cap === "CAP14" ? { vendor: "G08 Private A vendor", amount: 120, currency: "USD" } :
      { name: "G08 Private A " + cap, budget: 120 }
    const response = await f.command(cap, values)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    const a = await f.page(cap)
    expect(a.status).toBe(200)
    expect(await a.text()).toContain(cap === "CAP14" ? "G08 Private A vendor" : "G08 Private A " + cap)
    const b = await f.page(cap, f.teamB)
    expect(b.status).toBe(200)
    expect(await b.text()).not.toContain("G08 Private A")
  }
  const b = await f.command("CAP14", { vendor: "G08 Private B vendor", amount: 90 }, { team: f.teamB })
  expect(b.status).toBe(200)
  await b.body?.cancel()
  expect(await (await f.page("CAP14")).text()).not.toContain("G08 Private B")
  expect(await (await f.page("CAP14", f.teamB)).text()).toContain("G08 Private B vendor")
  const snapshots = f.durable()
  expect(JSON.stringify(snapshots[0])).toContain("G08 Private A vendor")
  expect(JSON.stringify(snapshots[0])).not.toContain("G08 Private B vendor")
  expect(JSON.stringify(snapshots[1])).toContain("G08 Private B vendor")
  expect(JSON.stringify(snapshots[1])).not.toContain("G08 Private A vendor")
}))

test("Microsoft native ingress rejects anonymous foreign owner and cross-site commands before malformed bytes can act", async () => fixture("native-negatives", async (f) => {
  const held = await f.context(), before = f.durable()
  for (const [extra, status] of [
    [{ cookie: "" }, 401],
    [{ "x-sf-team-profile": f.selector({ ...f.profile(f.teamA), installationId: "foreign-installation" }) }, 403],
    [{ "x-sf-team-profile": f.selector({ ...f.profile(f.teamA), tenantId: f.clientId }) }, 403],
    [{ "x-sf-team-profile": f.selector(f.profile(f.teamB)) }, 403],
    [{ origin: "https://foreign.example.test" }, 403],
    [{ "sec-fetch-site": "cross-site" }, 403],
    [{ "x-sf-native-owner": Buffer.from(JSON.stringify({
      installationId: held.stamp.installationId, projectId: held.stamp.projectId,
      hostId: "foreign-host", principalRef: held.stamp.principalRef,
    })).toString("base64url") }, 403],
  ] as const) {
    const response = await f.command("CAP14", {}, { held, extra, body: "{malformed-untrusted-body" })
    expect(response.status).toBe(status)
    await response.body?.cancel()
  }
  const disabled = await f.page("CAP14", f.disabledTeam)
  expect(disabled.status).toBe(403)
  await disabled.body?.cancel()
  const anonymous = await f.page("CAP14", f.teamA, { cookie: "" })
  expect(anonymous.status).toBe(401)
  await anonymous.body?.cancel()
  expect(f.durable()).toEqual(before)
}))

test("Microsoft native F02 and writers reread current private grants and remove all domain authority after role loss", async () => fixture("current-policy", async (f) => {
  const file = join(f.directory, "installation.json")
  const original = await Bun.file(file).text()
  const configuration = object(JSON.parse(original))
  const initial = await f.context(), before = f.durable()
  try {
    await writeFile(file, JSON.stringify({ ...configuration, grants: [] }), { mode: 0o600 })
    const grantsChanged = await f.context()
    expect(grantsChanged.stamp.accessRevision).not.toBe(initial.stamp.accessRevision)
    expect(grantsChanged.destinations).toEqual(initial.destinations)
    expect(grantsChanged.availability).toEqual(initial.availability)
    const stale = await f.command("CAP14", { vendor: "Stale private grant", amount: 1 }, { held: initial })
    expect(stale.status).toBe(403)
    await stale.body?.cancel()
    const admitted = await f.page("CAP14")
    expect(admitted.status).toBe(200)
    await admitted.body?.cancel()

    await writeFile(file, JSON.stringify({ ...configuration, groups: { dashboard: {}, planner: {}, procurement: {} } }), { mode: 0o600 })
    const revoked = await f.context()
    expect(revoked.profile.administration.status).toBe("available")
    expect(revoked.destinations.map((item) => [item.capabilityId, item.canRead, item.allowedActionIds])).toEqual([
      ["CAP14", false, []], ["CAP04", false, []], ["CAP05", false, []], ["CAP03", false, []],
    ])
    expect(revoked.availability).toHaveLength(4)
    expect(revoked.availability.every((item) => item.state === "denied" &&
      item.operations.every((op) => op.state === "denied" && !op.operational))).toBe(true)
    for (const cap of ["CAP14", "CAP04", "CAP05", "CAP03", "CAP25"] as const) {
      const read = await f.page(cap)
      expect(read.status).toBe(403)
      await read.body?.cancel()
    }
    const write = await f.command("CAP14", {}, { held: initial, body: "{malformed-without-current-role" })
    expect(write.status).toBe(403)
    await write.body?.cancel()
    expect(f.durable()).toEqual(before)
  } finally { await writeFile(file, original, { mode: 0o600 }) }
  expect(await f.context()).toEqual(initial)
}))

test("Microsoft native readers suppress private data when policy or Team membership changes during actual role IO", async () => fixture("inflight-authority", async (f) => {
  const created = await f.command("CAP14", { vendor: "G08 Inflight private vendor", amount: 10 })
  expect(created.status).toBe(200)
  await created.body?.cancel()
  const file = join(f.directory, "installation.json"), original = await Bun.file(file).text()
  const configuration = object(JSON.parse(original))
  const before = f.durable()
  for (const boundary of ["policy", "membership"] as const) {
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    let observed = false
    f.state.beforeGraphRequest = async (url) => {
      if (observed || url.pathname !== "/v1.0/me/checkMemberGroups") return
      observed = true
      entered.resolve()
      await release.promise
    }
    try {
      const pending = f.page("CAP14")
      await entered.promise
      if (boundary === "policy")
        await writeFile(file, JSON.stringify({ ...configuration, groups: { dashboard: {}, planner: {}, procurement: {} } }), { mode: 0o600 })
      else f.state.teams = [f.teamB, f.disabledTeam]
      release.resolve()
      const response = await pending
      expect(observed).toBe(true)
      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain("G08 Inflight private vendor")
      expect(f.durable()).toEqual(before)
    } finally {
      release.resolve()
      f.state.beforeGraphRequest = undefined
      f.state.teams = [f.teamA, f.teamB, f.disabledTeam]
      await writeFile(file, original, { mode: 0o600 })
    }
  }
  expect(await (await f.page("CAP14")).text()).toContain("G08 Inflight private vendor")
}))

test("Microsoft native source CAS and validation errors preserve every snapshot and blob of both Teams", async () => fixture("source-cas", async (f) => {
  const created = await f.command("CAP14", { vendor: "G08 CAS vendor", amount: 70 })
  expect(created.status).toBe(200)
  await created.body?.cancel()
  const first = object(await (await f.page("CAP14")).json()), value = object(first.value), data = object(value.data)
  if (!Array.isArray(data.contracts)) throw new Error("Original contract projection required")
  const row = object(data.contracts[0])
  if (typeof row.id !== "string") throw new Error("Original contract id required")
  const version = object(value.versions)["contracts:" + row.id]
  if (typeof version !== "number") throw new Error("Original numeric CAS version required")
  const before = f.durable()
  const stale = await f.command("CAP14", { vendor: "Must not commit", amount: 4 }, { id: row.id, version: version + 1 })
  expect(stale.status).toBe(409)
  expect(await stale.json()).toMatchObject({ ok: false, status: 409 })
  const invalid = await f.command("CAP14", { vendor: "", amount: 4 }, { id: row.id, version })
  expect(invalid.status).toBe(422)
  expect(await invalid.json()).toMatchObject({ ok: false, status: 422 })
  expect(f.durable()).toEqual(before)
  const updated = await f.command("CAP14", { vendor: "G08 CAS updated", amount: 99 }, { id: row.id, version })
  expect(updated.status).toBe(200)
  await updated.body?.cancel()
  expect(await (await f.page("CAP14")).text()).toContain("G08 CAS updated")
  expect(await (await f.page("CAP14", f.teamB)).text()).not.toContain("G08 CAS updated")
}))

test("Microsoft native routing preserves original F02 method and raw-query guards without a command alias", async () => fixture("route-guards", async (f) => {
  const before = f.durable()
  const post = await f.contextResponse(f.teamA, { origin: f.origin, "content-type": "application/json" },
    { method: "POST", body: "{not-a-context-command" })
  expect(post.status).toBe(400)
  await post.body?.cancel()
  if (!f.binding) throw new Error("Native binding required")
  const query = new URLSearchParams({
    contractRevision: "sf-team-profile/1", installationId: f.binding.installationId, tenantId: f.binding.tenantId,
    hostId: f.binding.hostId, kind: "team", teamObjectId: f.teamA,
  })
  for (const suffix of ["&hostId=foreign", "&principalRef=forged", "&accessRevision=forged"]) {
    const response = await f.request("/api/ui/context?" + query + suffix, { cookie: f.cookie })
    expect(response.status).toBe(400)
    await response.body?.cancel()
  }
  const head = await f.request("/api/ui/pages/CAP14", f.headers(), { method: "HEAD" })
  expect(head.status).toBe(405)
  expect(head.headers.get("allow")).toBe("GET")
  const alias = await f.request("/api/ui/commands", { ...f.headers(), origin: f.origin, "content-type": "application/json" },
    { method: "POST", body: "{}" })
  expect(alias.status).toBe(404)
  await alias.body?.cancel()
  const unknown = await f.request("/api/ui/pages/CAP99", f.headers())
  expect(unknown.status).toBe(404)
  await unknown.body?.cancel()
  expect(f.durable()).toEqual(before)
}))

test("Microsoft native page routes and discovery remain disabled in the original default fixture", async () => fixture("native-opt-in", async (f) => {
  expect(f.binding).toBeUndefined()
  for (const cap of ["CAP14", "CAP04", "CAP05", "CAP03", "CAP25"] as const) {
    const response = await f.page(cap)
    expect(response.status).toBe(404)
    await response.body?.cancel()
  }
  const legacy = await f.request("/teams/" + f.teamA + "/dashboard", { cookie: f.cookie })
  expect(legacy.status).toBe(200)
  expect(await legacy.text()).toContain('name="person" value="' + f.principalId + '"')
}, false))

test("Microsoft HTTP Budget source reads original period totals and denies native overview writes with no Team effects", async () => fixture("budget-source", async (f) => {
  for (const [cap, name, budget, team] of [
    ["CAP04", "Budget source OPEX A", 120, f.teamA],
    ["CAP05", "Budget source CAPEX A", 80, f.teamA],
    ["CAP04", "Budget source OPEX B", 37, f.teamB],
    ["CAP05", "Budget source CAPEX B", 24, f.teamB],
  ] as const) {
    const created = await f.command(cap, { name, budget }, { team })
    expect(created.status).toBe(200)
    expect(await created.json()).toMatchObject({ ok: true })
  }
  const incompleteResponse = await f.page("CAP03")
  const incomplete = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP03"].output)(await incompleteResponse.json())
  if (incomplete.status !== "ok") throw new Error("Original incomplete Microsoft source unavailable")
  expect(incomplete.value.data.totals).toBeUndefined()
  for (const team of [f.teamA, f.teamB]) {
    for (const cap of ["CAP04", "CAP05"] as const) {
      const response = await f.page(cap, team)
      const page = object(object(await response.json()).value)
      const owners = object(page.data)[cap === "CAP04" ? "opexOwners" : "capexProjects"]
      if (!Array.isArray(owners) || owners.length !== 1) throw new Error("Original single budget owner required")
      const entry = await f.command(cap, {
        year: 2026, month: 1, [cap === "CAP04" ? "ownerId" : "projId"]: object(owners[0]).id,
        budget: 0, actual: team === f.teamA ? cap === "CAP04" ? 10 : 20 : 0, forecast: 0,
      }, { team, action: "save-entry" })
      expect(entry.status).toBe(200)
      expect(await entry.json()).toEqual({ ok: true })
    }
  }
  const before = f.durable()
  const held = await f.context()
  expect<unknown>(held.destinations.find((item) => item.capabilityId === "CAP03")).toEqual({
    capabilityId: "CAP03", surface: "dashboard", page: "Budget Overview", canRead: true, allowedActionIds: [],
  })
  for (const [search, period] of [
    ["", { year: 2026, month: 11 }],
    ["?year=2025", { year: 2025, month: 11 }],
    ["?month=2", { year: 2026, month: 2 }],
    ["?year=2027&month=12", { year: 2027, month: 12 }],
  ] as const) {
    const response = await f.request("/api/ui/pages/CAP03" + search, f.headers())
    expect(response.status).toBe(200)
    const result = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP03"].output)(await response.json())
    if (result.status !== "ok") throw new Error("Original Microsoft budget source unavailable")
    expect<unknown>(result.context).toEqual(held.stamp)
    expect<unknown>(result.value.selection).toEqual(period)
    expect<unknown>(result.value.allowedActionIds).toEqual([])
    expect(result.value.data.totals).toMatchObject({
      opexBudget: 120, opexActual: period.year === 2026 ? 10 : 0, opexForecast: 0,
      capexActual: period.year === 2026 ? 20 : 0, capexForecast: 0,
      totalActual: period.year === 2026 ? 30 : 0, totalForecast: 0,
    })
    expect(result.value.data.totals?.capexBudget).toBeCloseTo(80, 10)
    expect(result.value.data.totals?.totalBudget).toBeCloseTo(200, 10)
    expect(result.value.versions.budgetCurrentMonth).toBe(0)
    expect(result.value.versions.revenueByYear).toBe(0)
  }
  const other = await f.page("CAP03", f.teamB)
  const result = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP03"].output)(await other.json())
  if (result.status !== "ok") throw new Error("Original second Team budget source unavailable")
  expect<unknown>(result.context.team?.owner.profile).toEqual(f.profile(f.teamB))
  expect(result.value.data.totals?.totalBudget).toBeCloseTo(61, 10)
  expect(result.value.data.totals?.totalActual).toBe(0)
  for (const action of ["save-month", "save-revenue"] as const) {
    const response = await f.request("/teams/" + f.teamA + "/dashboard?page=Budget%20Overview", {
      ...f.headers(), origin: f.origin, "content-type": "application/json", "idempotency-key": randomUUID(),
      "x-sf-access-revision": held.stamp.accessRevision,
      "x-sf-native-owner": Buffer.from(JSON.stringify({
        installationId: held.stamp.installationId, projectId: held.stamp.projectId,
        hostId: held.stamp.hostId, principalRef: held.stamp.principalRef,
      })).toString("base64url"),
    }, { method: "POST", body: JSON.stringify({ page: "Budget Overview", action, version: 0,
      values: action === "save-month" ? { year: 2026, month: 2 } : { year: 2026, revenue: 100 } }) })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ ok: false, status: 403 })
  }
  for (const query of ["year=2023", "month=0", "month=13"]) {
    const response = await f.request("/api/ui/pages/CAP03?" + query, f.headers())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: "needs-input", reason: "invalid-page-selection" })
  }
  const duplicate = await f.request("/api/ui/pages/CAP03?month=1&month=2", f.headers())
  expect(duplicate.status).toBe(403)
  await duplicate.body?.cancel()
  const unauthenticated = await f.request("/api/ui/pages/CAP03?year=invalid", { ...f.headers(), cookie: "" })
  expect(unauthenticated.status).toBe(401)
  await unauthenticated.body?.cancel()
  expect(f.durable()).toEqual(before)
}))
