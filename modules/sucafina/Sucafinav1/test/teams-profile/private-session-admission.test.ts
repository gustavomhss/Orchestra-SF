import { afterEach, expect, test } from "bun:test"
import { lstat } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { privateSessionFixture } from "./private-session-fixture.ts"
import { adminCommand, group, principal, principalId, teamA, teamB } from "./admin-policy-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture() {
  const f = await privateSessionFixture()
  cleanups.push(f.close)
  return f
}
async function admitted(f: Awaited<ReturnType<typeof fixture>>, request = f.request()) {
  const value = await f.readAdmission(request)
  if (!value) throw new Error("Controlled current Microsoft role plus explicit Team grant must admit")
  return value
}
const baseGrant = { principalRef: principalId, namespaces: [], operations: [] }
const session = Schema.decodeUnknownSync(Session.ID)("ses_private_test")
const resource: ConnectionAccess.Resource = { category: "integration", resourceId: "synthetic-provider" }
const connection = { ...resource, id: "personal" }
const command: ConnectionAccess.Write = {
  key: connection, action: "create", expectedRevision: 0, label: "Personal", encodedValue: JSON.stringify({ token: "private-unit-secret" }),
}

test("private-session-admission: missing grants and forged selectors never open a Team partition or a connection key", async () => {
  const f = await fixture()
  f.setConfiguration({ grants: [] })
  expect(await f.readAdmission(f.request())).toBeUndefined()
  const forged = f.request()
  const selection = JSON.parse(forged.headers.get("x-sf-team-profile")!)
  forged.headers.set("x-sf-team-profile", JSON.stringify({ ...selection, principal: principal }))
  expect(await f.readAdmission(forged)).toBeUndefined()
  expect(await lstat(join(f.directory, "business-teams")).then(() => true).catch(() => false)).toBe(false)
  expect(f.state.keyReads).toBe(0)
  expect(await lstat(join(f.directory, "host-data", "orchestra.db")).then(() => true).catch(() => false)).toBe(false)
})

test("private-session-admission: role membership does not supply omitted session actions and viewer cannot use an explicit write action", async () => {
  const f = await fixture()
  f.setConfiguration({ grants: [baseGrant] })
  const omitted = await admitted(f)
  expect(await Effect.runPromise(omitted.authorize("read"))).toBe(false)
  expect(await Effect.runPromise(omitted.authorize("create"))).toBe(false)
  f.setConfiguration({ grants: [{ ...baseGrant, sessionActions: ["read", "create", "write"] }],
    groups: { dashboard: { viewer: "group:" + group }, planner: {}, procurement: {} } })
  const viewer = await admitted(f)
  expect(await Effect.runPromise(viewer.authorize("read"))).toBe(true)
  expect(await Effect.runPromise(viewer.authorize("create"))).toBe(false)
  expect(await Effect.runPromise(viewer.authorize("write", session))).toBe(false)
  expect(f.state.keyReads).toBe(0)
})

test("private-session-admission: one combined inspection uses one observation for all actions and original generation cannot be recaptured", async () => {
  const f = await fixture()
  const original = f.request()
  const first = await admitted(f, original)
  if (!first.inspect) throw new Error("Combined inspection required")
  const before = f.state.roleReads
  expect((await Effect.runPromise(first.inspect([{ action: "read" }])))?.authorized).toBe(true)
  const one = f.state.roleReads - before
  const next = f.state.roleReads
  expect((await Effect.runPromise(first.inspect([{ action: "read" }, { action: "create" }])))?.authorized).toBe(true)
  expect(f.state.roleReads - next).toBe(one)
  expect(one).toBe(3)
  f.state.generation++
  expect(await Effect.runPromise(first.verifyCurrent())).toBe(false)
  expect(await f.readAdmission(original)).toBe(first)
  expect(await Effect.runPromise((await admitted(f)).authorize("read"))).toBe(true)
  original.headers.set("x-sf-team-profile", f.request(teamB).headers.get("x-sf-team-profile")!)
  expect(await Effect.runPromise(first.authorize("read"))).toBe(false)
})

test("private-session-admission: private grant, all surface roles and Team catalog revisions invalidate a retained lease", async () => {
  const f = await fixture()
  const first = await admitted(f)
  f.setConfiguration({ grants: [{ ...baseGrant, sessionActions: ["read"] }] })
  expect(await Effect.runPromise(first.verifyCurrent())).toBe(false)
  const second = await admitted(f)
  expect(second.binding.revisions.accessRevision).not.toBe(first.binding.revisions.accessRevision)
  f.setConfiguration({ groups: { dashboard: {}, planner: { finance: "group:" + group }, procurement: {} } })
  expect(await Effect.runPromise(second.verifyCurrent())).toBe(false)
  const planner = await admitted(f)
  expect(await Effect.runPromise(planner.authorize("read"))).toBe(true)
  f.state.member = false
  expect(await Effect.runPromise(planner.verifyCurrent())).toBe(false)
  f.state.member = true
  const current = await f.profiles().read()
  expect((await f.profiles().mutate({ principal, at: 1700000000000, authorize: async () => true,
    command: adminCommand(f.profile(), "disable", current.configRevision) })).status).toBe("ok")
  expect(await Effect.runPromise(planner.authorize("read"))).toBe(false)
})

test("private-session-admission: access scopes come from all current surfaces in the exact Team partition", async () => {
  const f = await fixture()
  const first = await admitted(f)
  await f.write(teamB, "planner", (snapshot) => { snapshot.data.access = { [principalId]: { domains: ["unrelated"] } } })
  expect(await Effect.runPromise(first.verifyCurrent())).toBe(true)
  await f.write(teamA, "procurement", (snapshot) => { snapshot.data.access = { [principalId]: { assigned: ["request"], domains: ["finance"] } } })
  expect(await Effect.runPromise(first.verifyCurrent())).toBe(false)
  const next = await admitted(f)
  await f.write(teamA, "planner", (snapshot) => { snapshot.data.access = { [principalId]: { assigned: 1 } } })
  expect(await Effect.runPromise(next.verifyCurrent())).toBe(false)
})

test("private-session-admission: shared configuration has the exact opaque catalog revision and never falls back to a workspace", async () => {
  const f = await fixture()
  const missing = await admitted(f)
  if (!missing.configuration) throw new Error("Private configuration reader required")
  expect(await Effect.runPromise(missing.configuration())).toBeUndefined()
  const document = { version: 1, settings: { model: "synthetic-provider/synthetic-model" } } as const
  expect((await f.configure(document)).status).toBe("ok")
  expect(await Effect.runPromise(missing.configuration())).toBeUndefined()
  const current = await admitted(f)
  if (!current.configuration) throw new Error("Private configuration reader required")
  const value = await Effect.runPromise(current.configuration())
  expect(value).toEqual({ origin: "installation-team-store", profile: f.profile(),
    configRevision: current.binding.revisions.configRevision, document })
  expect(typeof value?.configRevision).toBe("string")
  expect((await f.configure({ version: 1, settings: {} })).status).toBe("ok")
  expect(await Effect.runPromise(current.configuration())).toBeUndefined()
})

test("private-session-admission: native exclusions recheck current case participation and cannot leak from Team A into B", async () => {
  const f = await fixture()
  f.setConfiguration({ grants: [{ ...baseGrant, namespaces: ["cases", "contributions"], sessionActions: ["read", "write"] }] })
  await f.write(teamA, "dashboard", (snapshot) => {
    snapshot.data.__sfProductV1 = {
      cases: { case: { id: "case", incarnation: "v1", participants: [principalId] } },
      nativeRuns: { run: { principalRef: principalId, caseRef: { id: "case", incarnation: "v1" }, native: { sessionID: session } } },
    }
  })
  const a = await admitted(f)
  const b = await admitted(f, f.request(teamB))
  expect(await Effect.runPromise(a.authorize("write", session))).toBe(true)
  await f.write(teamA, "dashboard", (snapshot) => {
    snapshot.data.__sfProductV1 = {
      cases: { case: { id: "case", incarnation: "v2", participants: [principalId] } },
      nativeRuns: { run: { principalRef: principalId, caseRef: { id: "case", incarnation: "v1" }, native: { sessionID: session } } },
    }
  })
  expect(await Effect.runPromise(a.excludedSessions())).toEqual([session])
  expect(await Effect.runPromise(a.authorize("write", session))).toBe(false)
  expect(await Effect.runPromise(b.excludedSessions())).toEqual([])
  expect(await Effect.runPromise(b.authorize("write", session))).toBe(true)
})

test("private-session-admission: malformed native records and more than 500 exclusions fail closed instead of truncating", async () => {
  const f = await fixture()
  const current = await admitted(f)
  await f.write(teamA, "dashboard", (snapshot) => { snapshot.data.__sfProductV1 = { nativeRuns: { run: { native: { sessionID: 4 } } } } })
  expect(await Effect.runPromise(current.authorize("read"))).toBe(false)
  await f.write(teamA, "dashboard", (snapshot) => {
    snapshot.data.__sfProductV1 = { nativeRuns: Object.fromEntries(Array.from({ length: 501 }, (_, index) => [
      "run-" + index, { principalRef: principalId, caseRef: { id: "missing", incarnation: "v1" },
        native: { sessionID: "ses_excluded_" + index } },
    ])) }
  })
  expect(await Effect.runPromise(current.authorize("read"))).toBe(false)
  await expect(Effect.runPromise(current.excludedSessions())).rejects.toThrow("SF_SESSION_RESOURCE_POLICY_UNAVAILABLE")
})

test("private-session-admission: provider bindings require the exact Team and explicit credential read resource; key use remains lazy", async () => {
  const f = await fixture()
  const selected = f.provider()
  f.setConfiguration({ grants: [{ ...baseGrant, sessionActions: ["read"], connectionActions: ["read"],
    connectionResources: [resource], providerBindings: [selected, f.provider(teamB)] }] })
  const admission = await admitted(f)
  if (!admission.providers || !admission.connections) throw new Error("Private factories required")
  const provider = await Effect.runPromise(admission.providers(() => Effect.succeed(true)))
  const vault = await Effect.runPromise(admission.connections(() => Effect.succeed(true)))
  if (!provider || !vault) throw new Error("Current provider and connection capabilities required")
  expect(await Effect.runPromise(provider.list())).toEqual([selected])
  await Effect.runPromise(provider.verify(selected))
  expect(f.state.keyReads).toBe(0)
  expect(await Effect.runPromise(vault.list("integration"))).toEqual([])
  expect(f.state.keyReads).toBe(1)
  f.setConfiguration({ grants: [{ ...baseGrant, sessionActions: ["read"], providerBindings: [selected] }] })
  await expect(Effect.runPromise(provider.list())).rejects.toThrow()
  const empty = await admitted(f)
  if (!empty.providers) throw new Error("Private provider factory required")
  const denied = await Effect.runPromise(empty.providers(() => Effect.succeed(true)))
  if (!denied) throw new Error("Current empty catalog capability required")
  expect(await Effect.runPromise(denied.list())).toEqual([])
})

test("private-session-admission: encrypted credential CAS reuses the Team read scope and revocation during key read cannot commit", async () => {
  const f = await fixture()
  const grant = { ...baseGrant, sessionActions: ["read"], connectionActions: ["read", "create", "update", "remove"], connectionResources: [resource] }
  f.setConfiguration({ grants: [grant] })
  const admission = await admitted(f)
  if (!admission.connections) throw new Error("Private connection factory required")
  const vault = await Effect.runPromise(admission.connections(() => Effect.succeed(true)))
  if (!vault) throw new Error("Private connection capability required")
  const created = await Effect.runPromise(vault.write(command))
  expect(created.metadata.revision).toBe(1)
  expect((await Effect.runPromise(vault.read(connection)))?.encodedValue).toBe(command.encodedValue)
  const before = f.readRows("SELECT * FROM sf_team_connection_audit")
  f.state.beforeKey = async () => { f.setConfiguration({ grants: [{ ...grant, connectionActions: ["read"] }] }) }
  await expect(Effect.runPromise(vault.write({ ...command, action: "update", expectedRevision: 1 }))).rejects.toThrow()
  expect(f.readRows("SELECT * FROM sf_team_connection_audit")).toEqual(before)
  expect(f.readRows("SELECT revision FROM sf_team_connection_header")).toEqual([{ revision: 1 }])
})

test("private-session-admission: a grant changed during the final Microsoft wait is reread before credential commit", async () => {
  const f = await fixture()
  const grant = { ...baseGrant, sessionActions: ["read"], connectionActions: ["read", "create"], connectionResources: [resource] }
  f.setConfiguration({ grants: [grant] })
  const admission = await admitted(f)
  if (!admission.connections) throw new Error("Private connection factory required")
  const vault = await Effect.runPromise(admission.connections(() => Effect.succeed(true)))
  if (!vault) throw new Error("Private connection capability required")
  let observations = 0
  f.state.afterTeams = async () => {
    observations++
    // effective observes the held Team before roles, after roles, and at final egress.
    if (observations === 3) f.setConfiguration({ grants: [{ ...grant, connectionActions: ["read"] }] })
  }
  await expect(Effect.runPromise(vault.write(command))).rejects.toThrow()
  expect(observations).toBe(3)
  expect(f.readRows("SELECT * FROM sf_team_connection_audit")).toEqual([])
  expect(f.readRows("SELECT revision, key_fingerprint FROM sf_team_connection_header"))
    .toEqual([{ revision: 0, key_fingerprint: null }])
})
