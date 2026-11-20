import { expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContextQuery, SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { createSfTeamContextClient } from "../../src/sucafina/context"
import { createSfTeamProfileClient } from "../../src/sucafina/team-profile"
import { createSfTransport, type SfDesktopCapability } from "../../src/sucafina/transport"

// Wire/refusal boundaries only. Real signed-session authority is qualified by
// Sucafinav1/test/teams-profile/context-http.test.ts, not these synthetic DTOs.
const descriptor = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: descriptor.installationId, tenantId: descriptor.tenantId,
  teamObjectId: "a1111111-2222-4333-8444-555555555555",
})
const selector = Schema.decodeUnknownSync(TeamProfile.Selector)({ contractRevision: "sf-team-profile/1", kind: "team", profile })
const query = Schema.decodeUnknownSync(SfTeamContextQuery)({
  contractRevision: "sf-team-profile/1", installationId: descriptor.installationId,
  tenantId: descriptor.tenantId, hostId: descriptor.hostId, kind: "team", teamObjectId: profile.teamObjectId,
})
const signal = () => new AbortController().signal

test("Teams F02 codec accepts the canonical complete versioned context query", () => {
  const codec = SfNativeOperationBindings["ctx.context"]!
  expect(codec.decodeInput(query)).toEqual({ status: "ok", value: query })
  for (const fields of [{ projectId: descriptor.projectId }, { accessRevision: "caller" },
    { principalRef: "caller" }, { grant: "write" }]) {
    expect(codec.decodeInput({ ...query, ...fields })).toEqual({ status: "invalid" })
  }
})

test("Teams F02 codec rejects missing Team identity and cross-branch input", () => {
  const codec = SfNativeOperationBindings["ctx.context"]!
  const { teamObjectId, ...missing } = query
  expect(codec.decodeInput(missing)).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...query, kind: "administration" })).toEqual({ status: "invalid" })
  expect(codec.decodeInput({ ...query, contractRevision: "sf-native-ui/1" })).toEqual({ status: "invalid" })
})

test("Teams F02 codec preserves closed unavailable reasons without an optimistic profile", () => {
  const codec = SfNativeOperationBindings["ctx.context"]!
  const unavailable = { status: "unavailable", reason: "consent-required" }
  expect(codec.decodeOutput(unavailable)).toEqual({ status: "ok", value: unavailable })
  expect(Schema.is(SfTeamContextResult)(unavailable)).toBe(true)
  expect(codec.decodeOutput({ ...unavailable, profile: { status: "authenticated" } })).toEqual({ status: "invalid" })
})

test("Teams descriptor is refused by the legacy desktop broker before invoke or renderer fetch", async () => {
  let invoked = 0
  let fetched = 0
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }), bind: async () => ({ status: "denied" }),
    invoke: async () => { invoked++; throw new Error("Legacy broker must not receive a corporate Team request") },
    abort: async () => {}, login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }), release: async () => {},
  }
  const transport = createSfTransport({
    binding: descriptor, generation: 1, currentGeneration: () => 1, teamSelector: selector,
    operations: SfNativeOperationBindings, desktop,
    desktopBinding: { bindingHandle: "legacy-main-handle", generation: 1, descriptor },
    fetch: async () => { fetched++; throw new Error("Renderer fetch must not substitute for main ownership") },
  })
  expect(await createSfTeamContextClient(transport)["ctx.context"](query, { signal: signal() }))
    .toEqual({ kind: "transport-error", reason: "contract-unavailable" })
  expect(invoked).toBe(0)
  expect(fetched).toBe(0)
})

test("Teams transport without an explicit selector never infers a remembered or technical profile", async () => {
  let fetched = 0
  const transport = createSfTransport({
    binding: descriptor, generation: 1, currentGeneration: () => 1, operations: SfNativeOperationBindings,
    fetch: async () => { fetched++; throw new Error("No implicit selector may send a request") },
  })
  expect(await createSfTeamContextClient(transport)["ctx.context"](query, { signal: signal() }))
    .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(fetched).toBe(0)
})

test("retargeted installation metadata or generation is refused before any request", async () => {
  for (const cause of ["binding", "generation"] as const) {
    let fetched = 0
    let generation = 1
    const binding = { ...descriptor }
    const transport = createSfTransport({
      binding, generation, currentGeneration: () => generation, teamSelector: selector,
      operations: SfNativeOperationBindings,
      fetch: async () => { fetched++; throw new Error("Retargeted owner must be inert") },
    })
    if (cause === "binding") binding.hostId = "another-host"
    else generation++
    expect(await createSfTeamContextClient(transport)["ctx.context"](query, { signal: signal() }))
      .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(fetched).toBe(0)
  }
})

test("administration client validates descriptor origin before constructing its fixed endpoint", async () => {
  let fetched = 0
  const client = createSfTeamProfileClient({
    binding: { ...descriptor, publicOrigin: "not a URL" }, generation: 1, currentGeneration: () => 1,
    fetch: async () => { fetched++; throw new Error("Invalid origin must not be requested") },
  })
  expect(await client.list({ signal: signal() })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(fetched).toBe(0)
})
