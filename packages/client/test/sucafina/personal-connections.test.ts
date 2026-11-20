import { expect, test } from "bun:test"
import { Schema } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfPersonalConnections } from "../../src/sucafina/personal-connections"
import type { SfTransportFetch } from "../../src/sucafina/transport"

// These are Web wire/lifecycle tests. DTOs do not replace the installed
// endpoint's signed Microsoft session, SQLite, Owner or credential ACL tests.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf.example.test",
  mount: "/sucafina/nested", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const owner = Schema.decodeUnknownSync(TeamProfile.Owner)({
  profile: { installationId: binding.installationId, tenantId: binding.tenantId,
    teamObjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  principal: { tenantId: binding.tenantId, principalObjectId: "11111111-1111-4111-8111-111111111111" },
})
const namespace = Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({ version: 1, owner, authorityGeneration: 3 })
const key = Schema.decodeUnknownSync(ConnectionAccess.PersonalKey)({ category: "integration", resourceId: "declared-provider", id: "personal" })
const catalog = Schema.decodeUnknownSync(ProviderAccess.Catalog)({
  namespace, providers: [{ providerId: "declared", name: "Declared provider", protocol: "openai-chat-completions",
    connection: key, models: [{ id: "declared-model", name: "Declared model", limit: { context: 4096, output: 1024 }, tools: false }] }],
})
const absent = { status: "available", namespace, connection: { key, label: "", revision: 0, state: "absent" } }
const command = Schema.decodeUnknownSync(ConnectionAccess.PersonalCommand)({
  action: "create", key, label: "Personal label", expectedRevision: 0, secret: "synthetic-test-api-key",
})
const saved = { status: "saved", namespace, connection: { key, label: "Personal label", revision: 1, state: "active" } }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
async function browser(run: () => Promise<void>) {
  // Bun has no Window. Only the browser-origin prerequisite is installed here;
  // networking uses the explicit fetch port, never a patched global fetch.
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try { await run() }
  finally { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window") }
}
function fixture(fetch: SfTransportFetch) {
  const life = new AbortController(), abort = new AbortController()
  let active = true
  const client = createSfPersonalConnections({ binding, owner, current: () => active, signal: life.signal, fetch })
  return { client, call: { signal: abort.signal }, abort, life,
    retire: () => { active = false }, dispose: () => client.dispose() }
}
const responder: SfTransportFetch = async (url, init) => new URL(String(url)).pathname.endsWith("/catalog") ? json(catalog) :
  init?.method === "POST" ? json(saved) : json(absent)
async function ready(f: ReturnType<typeof fixture>) {
  expect(await f.client.catalog(f.call)).toMatchObject({ kind: "response", body: catalog })
  expect(await f.client.read(key, f.call)).toMatchObject({ kind: "response", body: absent })
}

test("catalog, slot and a single CAS command use exact private mount, cookie and Team intent", async () => browser(async () => {
  const requests: Request[] = [], options: RequestInit[] = []
  const f = fixture(async (url, init) => { requests.push(new Request(url, init)); options.push(init!); return responder(url, init) })
  try {
    await ready(f)
    expect(await f.client.command(command, f.call)).toMatchObject({ kind: "response", body: saved })
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      binding.mount + "/api/provider/catalog", binding.mount + "/api/connection/personal", binding.mount + "/api/connection/personal",
    ])
    expect(new URL(requests[0]!.url).search).toBe("")
    expect(Object.fromEntries(new URL(requests[1]!.url).searchParams)).toEqual(key)
    expect(new URL(requests[2]!.url).search).toBe("")
    expect(await requests[2]!.json()).toEqual(command)
    expect(requests.every((request) => !request.headers.has("authorization"))).toBe(true)
    expect(requests.every((request) => JSON.stringify(JSON.parse(request.headers.get("x-sf-team-profile")!)) === JSON.stringify({
      contractRevision: "sf-team-profile/1", kind: "team", profile: owner.profile,
    }))).toBe(true)
    expect(options.every((option) => option.credentials === "same-origin" && option.mode === "same-origin" &&
      option.cache === "no-store" && option.redirect === "error")).toBe(true)
    expect(requests.map((request) => request.url).join(" ")).not.toMatch(/secret|principal|generation|project|auth_token/)
  } finally { f.dispose() }
}))

test("unknown key, unobserved revision, extra authority and retries cannot dispatch", async () => browser(async () => {
  let calls = 0
  const f = fixture(async (url, init) => { calls++; return responder(url, init) })
  try {
    expect(await f.client.command(command, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    await f.client.catalog(f.call)
    expect(await f.client.read({ ...key, id: "manual-id" }, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(await f.client.command(command, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    await f.client.read(key, f.call)
    const extra = { ...command, owner }
    for (const value of [extra, { ...command, expectedRevision: 1 }])
      expect(await f.client.command(value, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(await f.client.command(command, { ...f.call, retry: "same-intent" })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(calls).toBe(2)
  } finally { f.dispose() }
}))

test("an observed empty catalog differs from denied and unavailable and never permits a manually supplied key", async () => browser(async () => {
  for (const [body, status] of [[{ ...catalog, providers: [] }, 200], [{ status: "denied" }, 403], [{ status: "unavailable" }, 503]] as const) {
    let calls = 0
    const f = fixture(async () => { calls++; return json(body, status) })
    try {
      expect(await f.client.catalog(f.call)).toMatchObject({ kind: "response", status, body })
      expect(await f.client.read(key, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
      expect(calls).toBe(1)
    } finally { f.dispose() }
  }
}))

test("catalog secrets, wrong owner and status mismatches are rejected before metadata is exposed", async () => browser(async () => {
  const foreign = { ...namespace, owner: { ...owner, profile: { ...owner.profile, teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } } }
  const cases: readonly [unknown, number][] = [
    [{ ...catalog, namespace: foreign }, 200],
    [{ ...catalog, providers: [{ ...catalog.providers[0]!, endpoint: "https://hidden.example.test" }] }, 200],
    [{ ...catalog, secret: "never-public" }, 200], [catalog, 403],
  ]
  for (const [body, status] of cases) {
    const f = fixture(async () => json(body, status))
    try { expect(await f.client.catalog(f.call)).toEqual({ kind: "transport-error", reason: "invalid-response" }) }
    finally { f.dispose() }
  }
}))

test("slot response must match key, owner, generation and closed metadata schema", async () => browser(async () => {
  const cases = [
    { ...absent, connection: { ...absent.connection, key: { ...key, id: "other" } } },
    { ...absent, namespace: { ...namespace, authorityGeneration: 4 } },
    { ...absent, namespace: { ...namespace, owner: { ...owner, principal: { ...owner.principal, principalObjectId: "22222222-2222-4222-8222-222222222222" } } } },
    { ...absent, connection: { ...absent.connection, secret: "not-metadata" } },
  ]
  for (const body of cases) {
    const f = fixture(async (url) => new URL(String(url)).pathname.endsWith("/catalog") ? json(catalog) : json(body))
    try {
      await f.client.catalog(f.call)
      expect(await f.client.read(key, f.call)).toEqual({ kind: "transport-error", reason: "invalid-response" })
    } finally { f.dispose() }
  }
}))

test("lost, unavailable, foreign and malformed command responses stay unknown without retry", async () => browser(async () => {
  for (const failure of ["network", "unavailable", "key", "generation", "revision", "secret", "retired"] as const) {
    let writes = 0
    const f = fixture(async (url, init) => {
      if (init?.method !== "POST") return responder(url, init)
      writes++
      if (failure === "network") throw new Error("Synthetic lost response")
      if (failure === "unavailable") return json({ status: "unavailable" }, 503)
      if (failure === "retired") f.retire()
      return json(failure === "key" ? { ...saved, connection: { ...saved.connection, key: { ...key, id: "other" } } } :
        failure === "generation" ? { ...saved, namespace: { ...namespace, authorityGeneration: 4 } } :
        failure === "revision" ? { ...saved, connection: { ...saved.connection, revision: 3 } } :
        failure === "secret" ? { ...saved, secret: "never-public" } : saved)
    })
    try {
      await ready(f)
      expect(await f.client.command(command, f.call)).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
      expect(await f.client.command(command, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
      expect(writes).toBe(1)
    } finally { f.dispose() }
  }
}))

test("conflict and pre-effect denial are preserved; they still require a new explicit metadata read", async () => browser(async () => {
  for (const [status, code] of [["conflict", 409], ["denied", 403]] as const) {
    let writes = 0
    const f = fixture(async (url, init) => {
      if (init?.method === "POST") { writes++; return json({ status }, code) }
      return responder(url, init)
    })
    try {
      await ready(f)
      expect(await f.client.command(command, f.call)).toMatchObject({ kind: "response", status: code, body: { status } })
      expect(await f.client.command(command, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
      expect(writes).toBe(1)
    } finally { f.dispose() }
  }
}))

test("removed slot has its retained revision and create uses that CAS; update cannot consume an absent slot", async () => browser(async () => {
  const removed = { ...absent, connection: { key, label: "Old label", revision: 7, state: "removed" } }
  const f = fixture(async (url, init) => {
    if (new URL(String(url)).pathname.endsWith("/catalog")) return json(catalog)
    if (init?.method !== "POST") return json(removed)
    return json({ ...saved, connection: { ...saved.connection, revision: 8 } })
  })
  try {
    await f.client.catalog(f.call); await f.client.read(key, f.call)
    expect(await f.client.command({ ...command, expectedRevision: 7 }, f.call)).toMatchObject({
      kind: "response", body: { status: "saved", connection: { revision: 8 } },
    })
  } finally { f.dispose() }
  const other = fixture(responder)
  try {
    await ready(other)
    const update = Schema.decodeUnknownSync(ConnectionAccess.PersonalCommand)({ ...command, action: "update", expectedRevision: 1 })
    expect(await other.client.command(update, other.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  } finally { other.dispose() }
}))

test("remove sends no secret and returns only observed tombstone metadata", async () => browser(async () => {
  let sent: unknown
  const f = fixture(async (url, init) => {
    if (new URL(String(url)).pathname.endsWith("/catalog")) return json(catalog)
    if (init?.method !== "POST") return json({ status: "available", namespace, connection: saved.connection })
    sent = JSON.parse(String(init.body))
    return json({ status: "removed", namespace, connection: { ...saved.connection, revision: 2, state: "removed" } })
  })
  try {
    await f.client.catalog(f.call); await f.client.read(key, f.call)
    const remove = Schema.decodeUnknownSync(ConnectionAccess.PersonalCommand)({ action: "remove", key, expectedRevision: 1 })
    expect(await f.client.command(remove, f.call)).toMatchObject({ kind: "response", body: { status: "removed" } })
    expect(sent).toEqual(remove)
  } finally { f.dispose() }
}))

test("retirement cancels an unfinished body without awaiting a hostile cancel hook or exposing late metadata", async () => browser(async () => {
  const entered = Promise.withResolvers<void>(), cancelled = Promise.withResolvers<void>()
  const f = fixture(async () => {
    entered.resolve()
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"namespace":')) },
      cancel() { cancelled.resolve(); return new Promise<void>(() => undefined) },
    }), { headers: { "content-type": "application/json", "cache-control": "no-store" } })
  })
  try {
    const pending = f.client.catalog(f.call)
    await entered.promise
    f.life.abort()
    expect(await pending).toEqual({ kind: "transport-error", reason: "network" })
    await cancelled.promise
  } finally { f.dispose() }
}))

test("invalid content length, invalid UTF-8 and missing no-store cannot become available metadata", async () => browser(async () => {
  const cases = [
    () => new Response("{}", { headers: { "content-type": "application/json", "cache-control": "no-store", "content-length": "9999999" } }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { "content-type": "application/json", "cache-control": "no-store" } }),
    () => Response.json(catalog),
  ]
  for (const response of cases) {
    const f = fixture(async () => response())
    try { expect(await f.client.catalog(f.call)).toMatchObject({ kind: "transport-error" }) }
    finally { f.dispose() }
  }
}))
