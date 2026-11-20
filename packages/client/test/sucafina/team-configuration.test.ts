import { expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamProfileClient } from "../../src/sucafina/team-profile"
import type { SfTransportFetch } from "../../src/sucafina/transport"

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf.example.test",
  mount: "/sucafina/nested", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
})
const document = Schema.decodeUnknownSync(TeamProfile.ConfigurationDocument)({
  version: 1, settings: { model: "provider/model", agents: { analyst: { system: "Shared instructions." } } },
})
const command = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)({ profile, expectedRevision: 5, document })
const snapshot = { status: "ok", configuration: { origin: "installation-team-store", profile, configRevision: 5, document } }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
async function browser(run: () => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try { await run() }
  finally { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window") }
}
function fixture(fetch: SfTransportFetch) {
  let generation = 1
  const abort = new AbortController()
  const client = createSfTeamProfileClient({ binding, generation, currentGeneration: () => generation, fetch })
  return { client, call: { signal: abort.signal }, abort, retire: () => { generation++ } }
}

test("configuration uses the exact installed administrative endpoint and a fresh CAS command without business proof", async () => browser(async () => {
  const requests: Request[] = [], options: RequestInit[] = []
  const f = fixture(async (url, init) => {
    requests.push(new Request(url, init)); options.push(init!)
    return init?.method === "POST" ? json({ status: "ok", configRevision: 6, changed: true }) : json(snapshot)
  })
  expect(await f.client.readConfiguration(profile, f.call)).toMatchObject({ kind: "response", status: 200, body: snapshot })
  expect(await f.client.configureDocument(command, f.call)).toMatchObject({ kind: "response", body: { status: "ok", configRevision: 6 } })
  const read = new URL(requests[0]!.url), write = new URL(requests[1]!.url)
  expect(read.origin + read.pathname).toBe(binding.publicOrigin + binding.mount + "/api/ui/team-profiles/configuration")
  expect(Object.fromEntries(read.searchParams)).toEqual({
    contractRevision: "sf-team-profile/1", installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: profile.teamObjectId,
  })
  expect(Object.fromEntries(write.searchParams)).toEqual({
    contractRevision: "sf-team-profile/1", installationId: binding.installationId, tenantId: binding.tenantId,
  })
  expect(await requests[1]!.json()).toEqual(command)
  expect(requests.every((request) => !request.headers.has("authorization") && !request.headers.has("x-sf-team-profile"))).toBe(true)
  expect(options.every((value) => value.credentials === "same-origin" && value.cache === "no-store" && value.redirect === "error")).toBe(true)
}))

test("foreign installation, tenant, caller authority fields and prohibited settings fail before IO", async () => browser(async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return json(snapshot) })
  const otherInstallation = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, installationId: "other-installation" })
  const otherTenant = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, tenantId: "22222222-2222-4222-8222-222222222222" })
  for (const foreign of [otherInstallation, otherTenant]) {
    expect(await f.client.readConfiguration(foreign, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(await f.client.configureDocument({ ...command, profile: foreign }, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  }
  const authority = { ...command, principalObjectId: "11111111-1111-4111-8111-111111111111" }
  const providers = { ...command, document: { ...document, settings: { ...document.settings, providers: { private: { apiKey: "synthetic" } } } } }
  const paths = { ...command, document: { ...document, settings: { ...document.settings, directory: "/local/project" } } }
  for (const invalid of [authority, providers, paths])
    expect(await f.client.configureDocument(invalid, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(calls).toBe(0)
}))

test("configuration response identity, shape and HTTP status must all match before exposing settings", async () => browser(async () => {
  const foreign = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
  const cases: readonly [unknown, number][] = [
    [{ ...snapshot, configuration: { ...snapshot.configuration, profile: foreign } }, 200],
    [{ ...snapshot, configuration: { ...snapshot.configuration, vault: "private" } }, 200],
    [{ ...snapshot, configuration: { ...snapshot.configuration, configRevision: -1 } }, 200],
    [snapshot, 403],
  ]
  for (const [body, status] of cases) {
    const f = fixture(async () => json(body, status))
    expect(await f.client.readConfiguration(profile, f.call)).toEqual({ kind: "transport-error", reason: "invalid-response" })
  }
}))

test("post-dispatch loss, malformed replies and retirement stay outcome-unknown without retries", async () => browser(async () => {
  for (const failure of ["network", "invalid", "retired"] as const) {
    let calls = 0
    const f = fixture(async () => {
      calls++
      if (failure === "network") throw new Error("connection lost")
      if (failure === "retired") f.retire()
      return failure === "invalid" ? json({ status: "ok", changed: true, configRevision: 6, private: true }) :
        json({ status: "ok", changed: true, configRevision: 6 })
    })
    expect(await f.client.configureDocument(command, f.call)).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
    expect(calls).toBe(1)
  }
}))

test("pre-dispatch cancellation, oversized settings and retry controls cannot send a configuration change", async () => browser(async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return json(snapshot) })
  const large = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)({ ...command, document: {
    version: 1, settings: { agents: Object.fromEntries(Array.from({ length: 5 }, (_, index) => ["agent" + index, { system: "x".repeat(16384) }])) },
  } })
  expect(await f.client.configureDocument(large, f.call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(await f.client.configureDocument(command, { ...f.call, idempotencyKey: "caller-retry" })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  f.abort.abort()
  expect(await f.client.configureDocument(command, f.call)).toEqual({ kind: "transport-error", reason: "aborted" })
  expect(calls).toBe(0)
}))
