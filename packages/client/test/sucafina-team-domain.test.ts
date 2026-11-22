import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { createSfTeamDomainTransport } from "../src/sucafina/team-domain"
import type { SfTransportFetch } from "../src/sucafina/transport"

// Browser wire/lifecycle controls. These DTOs are deliberately NOT admission;
// the CLI companion exercises original Application/Domain/CAS and real SQLite.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf-domain.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = { installationId: binding.installationId, tenantId: binding.tenantId,
  teamObjectId: "22222222-2222-4222-8222-222222222222" }
const principal = { tenantId: binding.tenantId, principalObjectId: "33333333-3333-4333-8333-333333333333" }
const revision = "a".repeat(64)
const context = Schema.decodeUnknownSync(SfTeamContext)({
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
  stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    principalRef: principal.principalObjectId, policyVersion: "sf-team-profile/1", accessRevision: revision,
    team: { owner: { profile, principal }, revisions: { configRevision: "b".repeat(64), accessRevision: revision } } },
  profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: binding.installationId,
    principal, accessRevision: revision, administration: { status: "denied" },
    teams: { status: "ready", choices: [{ profile, displayName: "A" }], selected: profile, configRevision: "b".repeat(64) } },
  destinations: [
    { capabilityId: "CAP14", surface: "dashboard", page: "Vendor Contracts", canRead: true, allowedActionIds: ["save", "delete"] },
    { capabilityId: "CAP04", surface: "dashboard", page: "OPEX Detail", canRead: true,
      allowedActionIds: ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount", "import"] },
    { capabilityId: "CAP05", surface: "dashboard", page: "CAPEX Projects", canRead: true,
      allowedActionIds: ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"] },
  ],
  availability: ["CAP14", "CAP04", "CAP05"].map((cap) => ({ family: "domain-read", resource: cap, state: "ready",
    operations: Object.keys(SfOperationRegistry).filter((id) => id === "domain.page." + cap || id.startsWith("domain.command." + cap + "."))
      .map((operationId) => ({ operationId, state: "ready", reason: null, operational: true })) })),
})
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
const page = () => ({ status: "ok", context: context.stamp,
  value: { capabilityId: "CAP14", selection: {}, data: { contracts: [] }, versions: {}, allowedActionIds: ["save", "delete"] } })
async function browser(work: () => Promise<void>) {
  // Bun has no browser origin. This isolated Window seam is the same boundary
  // used by the existing Team Session wire tests, never a server authority.
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try { await work() }
  finally { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window") }
}
function fixture(fetch: SfTransportFetch) {
  let generation = 1
  let current: SfTeamContext | undefined = context
  const transport = createSfTeamDomainTransport({ binding, context: () => current, generation,
    currentGeneration: () => generation, fetch })
  return { transport, retire: () => { generation++ }, context: (value: SfTeamContext | undefined) => { current = value } }
}
const call = () => ({ signal: new AbortController().signal })
const save = SfDomain.operations["domain.command.CAP14.save"]
const read = SfDomain.operations["domain.page.CAP14"]
const values = { version: 0, values: { vendor: "Wire fixture", amount: 1 } }

test("canonical domain read uses original Team F02 before and after the selected page", async () => browser(async () => {
  const requests: Request[] = [], inits: RequestInit[] = []
  const f = fixture(async (url, init) => {
    const request = new Request(url, init); requests.push(request); inits.push(init!)
    return request.url.includes("/api/ui/context?") ? json({ status: "ok", value: context }) : json(page())
  })
  const result = await f.transport.execute(read, {}, call())
  expect(result).toMatchObject({ kind: "response", status: 200, body: { status: "ok" } })
  expect(requests).toHaveLength(3)
  expect(requests[0]!.url).toBe(requests[2]!.url)
  expect(new URL(requests[0]!.url).searchParams.get("teamObjectId")).toBe(profile.teamObjectId)
  expect(requests[1]!.url).toBe(binding.publicOrigin + binding.mount + "/api/ui/pages/CAP14")
  expect(JSON.parse(requests[1]!.headers.get("x-sf-team-profile")!)).toEqual({
    contractRevision: "sf-team-profile/1", kind: "team", profile,
  })
  expect(requests.every((request) => !request.headers.has("authorization"))).toBe(true)
  expect(inits.every((init) => init.credentials === "same-origin" && init.mode === "same-origin" &&
    init.redirect === "error" && init.cache === "no-store")).toBe(true)
}))

test("canonical command keeps Team route, exact CAS/body discriminators and one original idempotency key", async () => browser(async () => {
  const requests: Request[] = []
  const f = fixture(async (url, init) => {
    const request = new Request(url, init); requests.push(request)
    return request.method === "POST" ? json({ ok: true }) : json({ status: "ok", value: context })
  })
  expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "original-key-123" })).toMatchObject({
    kind: "response", status: 200, body: { ok: true },
  })
  const request = requests[1]!
  expect(request.url).toBe(binding.publicOrigin + binding.mount + "/teams/" + profile.teamObjectId + "/dashboard?page=Vendor+Contracts")
  expect(await request.json()).toEqual({ ...values, page: "Vendor Contracts", action: "save" })
  expect(request.headers.get("idempotency-key")).toBe("original-key-123")
  expect(request.headers.get("x-sf-access-revision")).toBe(context.stamp.accessRevision)
  expect(JSON.parse(atob(request.headers.get("x-sf-native-owner")!.replaceAll("-", "+").replaceAll("_", "/")))).toEqual({
    installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId, principalRef: principal.principalObjectId,
  })
  expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "original-key-123" })).toMatchObject({ kind: "transport-error" })
  expect(requests.filter((request) => request.method === "POST")).toHaveLength(1)
}))

test("noncanonical operation object, unsupported CAP, missing key and stale generation perform no IO", async () => browser(async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return json(page()) })
  expect((await f.transport.execute({ ...read }, {}, call())).kind).toBe("transport-error")
  expect((await f.transport.execute(SfDomain.operations["domain.page.CAP01"], {}, call())).kind).toBe("transport-error")
  expect((await f.transport.execute(save, values, call())).kind).toBe("transport-error")
  f.retire()
  expect((await f.transport.execute(read, {}, call())).kind).toBe("transport-error")
  expect(calls).toBe(0)
}))

test("legacy context cannot masquerade as Team admission", async () => browser(async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return json(page()) })
  const legacy: unknown = { ...context, contractRevision: "sf-native-ui/1" }
  f.context(legacy as SfTeamContext)
  expect(await f.transport.execute(read, {}, call())).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
  expect(calls).toBe(0)
}))

test("foreign full owner in the actual page response is rejected before exposure", async () => browser(async () => {
  const foreign = { ...page(), context: { ...context.stamp, team: { ...context.stamp.team!,
    owner: { ...context.stamp.team!.owner, profile: { ...profile, teamObjectId: "44444444-4444-4444-8444-444444444444" } } } } }
  const f = fixture(async (url) => String(url).includes("/api/ui/context?")
    ? json({ status: "ok", value: context }) : json(foreign))
  expect(await f.transport.execute(read, {}, call())).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
}))

test("current original F02 must prove the requested operation, not only the principal", async () => browser(async () => {
  let calls = 0
  const denied = { ...context,
    destinations: context.destinations.map((entry) => ({ ...entry, allowedActionIds: [] })),
    availability: context.availability.map((resource) => ({ ...resource, state: "denied",
      operations: resource.operations.map((entry) => ({ operationId: entry.operationId, state: "denied",
        reason: "current-business-authority-denied", operational: false })) })) }
  const f = fixture(async () => { calls++; return json({ status: "ok", value: denied }) })
  expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "denied-key-123" })).toEqual({
    kind: "transport-error", reason: "contract-unavailable",
  })
  expect(calls).toBe(1)
}))

test("an access revision change during the original reread hides page data", async () => browser(async () => {
  let reads = 0
  const fresh = { ...context, profile: { ...context.profile, accessRevision: "c".repeat(64) },
    stamp: { ...context.stamp, accessRevision: "c".repeat(64),
      team: { ...context.stamp.team!, revisions: { ...context.stamp.team!.revisions, accessRevision: "c".repeat(64) } } } }
  const f = fixture(async (url) => {
    if (!String(url).includes("/api/ui/context?")) return json(page())
    return json({ status: "ok", value: ++reads === 1 ? context : fresh })
  })
  expect(await f.transport.execute(read, {}, call())).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
  expect(reads).toBe(2)
}))

test("ambiguous POST is not replayed with the same key, a new key or a retry flag", async () => browser(async () => {
  let posts = 0
  const f = fixture(async (_url, init) => {
    if (init?.method !== "POST") return json({ status: "ok", value: context })
    posts++
    throw new Error("Connection lost after producer submission")
  })
  expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "lost-key-123" })).toEqual({
    kind: "transport-error", reason: "outcome-unknown",
  })
  expect((await f.transport.execute(save, values, { ...call(), idempotencyKey: "lost-key-123" })).kind).toBe("transport-error")
  expect((await f.transport.execute(save, values, { ...call(), idempotencyKey: "new-key-123" })).kind).toBe("transport-error")
  expect((await f.transport.execute(save, values, { ...call(), idempotencyKey: "lost-key-123", retry: "same-intent" })).kind).toBe("transport-error")
  expect(posts).toBe(1)
}))

test("two concurrent callers cannot dispatch the same intent twice after asynchronous admission", async () => browser(async () => {
  const submitted = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let posts = 0
  const f = fixture(async (_url, init) => {
    if (init?.method !== "POST") return json({ status: "ok", value: context })
    posts++; submitted.resolve(); await release.promise
    return json({ ok: true })
  })
  const first = f.transport.execute(save, values, { ...call(), idempotencyKey: "concurrent-key" })
  await submitted.promise
  const second = await f.transport.execute(save, values, { ...call(), idempotencyKey: "concurrent-key" })
  expect(second.kind).toBe("transport-error")
  release.resolve()
  expect((await first).kind).toBe("response")
  expect(posts).toBe(1)
}))

test("generation retirement after submission preserves ambiguous outcome and blocks further writes", async () => browser(async () => {
  let posts = 0
  const f = fixture(async (_url, init) => {
    if (init?.method !== "POST") return json({ status: "ok", value: context })
    posts++; f.retire()
    return json({ ok: true })
  })
  expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "retired-key" })).toEqual({
    kind: "transport-error", reason: "outcome-unknown",
  })
  expect(posts).toBe(1)
}))

test("invalid JSON/status and post-response authorization failure cannot create a success", async () => browser(async () => {
  for (const response of [json({ ok: false, status: 409 }, 200), new Response("{", { headers: { "Content-Type": "application/json" } })]) {
    const f = fixture(async (_url, init) => init?.method === "POST" ? response : json({ status: "ok", value: context }))
    expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "invalid-response" })).toEqual({
      kind: "transport-error", reason: "outcome-unknown",
    })
  }
  let contexts = 0
  const f = fixture(async (_url, init) => init?.method === "POST" ? json({ ok: true })
    : ++contexts === 1 ? json({ status: "ok", value: context }) : json({ status: "unauthenticated" }, 401))
  expect(await f.transport.execute(save, values, { ...call(), idempotencyKey: "revoked-after" })).toEqual({
    kind: "transport-error", reason: "outcome-unknown",
  })
}))
