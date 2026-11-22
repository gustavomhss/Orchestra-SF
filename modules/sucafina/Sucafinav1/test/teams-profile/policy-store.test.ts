import { afterEach, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { openLocalStore } from "../../runtime/local-store.ts"
import { adminCommand, policyFixture, principal, principalId, teamA, teamB } from "./admin-policy-fixture.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture(seeds: readonly string[] = []) {
  const f = await policyFixture(seeds)
  cleanups.push(f.close)
  return f
}
const authority = { principal, at: 1700000000000, authorize: async () => true }

test("policy-store: private descriptor seeds once; restart preserves revocation without a fabricated audit principal", async () => {
  const f = await fixture([teamA, teamB])
  const before = await f.profiles().read()
  expect(typeof before.configRevision).toBe("string")
  expect(before.profiles.map((entry) => [entry.profile.teamObjectId, entry.enabled])).toEqual([[teamA, true], [teamB, true]])
  expect(f.readRows("SELECT * FROM sf_team_profile_audit")).toEqual([])
  const disabled = await f.profiles().mutate({ ...authority, command: adminCommand(f.profile(), "disable", before.configRevision) })
  expect(disabled.status).toBe("ok")
  const after = await (await f.reopen()).read()
  expect(after.configRevision).not.toBe(before.configRevision)
  expect(after.profiles.map((entry) => [entry.profile.teamObjectId, entry.enabled])).toEqual([[teamA, false], [teamB, true]])
  expect(f.readRows("SELECT action, principal_object_id FROM sf_team_profile_audit")).toEqual([
    { action: "disable", principal_object_id: principalId },
  ])
  expect(f.readRows("SELECT * FROM snapshots")).toEqual([])
  expect(f.readRows("SELECT * FROM authentication_payloads")).toEqual([])
})

test("policy-store: competing real SQLite writers have one CAS winner, and an old token cannot survive disable-enable ABA", async () => {
  const f = await fixture([teamA])
  const before = await f.profiles().read()
  const command = adminCommand(f.profile(), "disable", before.configRevision)
  const secondStore = await openLocalStore(f.directory, {
    teamProfilePolicy: { binding: { installationId: f.installationId, tenantId: principal.tenantId }, bootstrapEnabledTeamIds: [teamA] },
  })
  cleanups.unshift(() => secondStore.dispose())
  if (!secondStore.teamProfiles) throw new Error("Independent SQLite writer required")
  const outcomes = await Promise.all([
    f.profiles().mutate({ ...authority, command }),
    secondStore.teamProfiles.mutate({ ...authority, command }),
  ])
  expect(outcomes.map((entry) => entry.status).toSorted()).toEqual(["conflict", "ok"])
  const disabled = await f.profiles().read()
  const enabled = await f.profiles().mutate({
    ...authority, command: adminCommand(f.profile(), "enable", disabled.configRevision),
  })
  expect(enabled.status).toBe("ok")
  const after = await f.profiles().read()
  expect(after.profiles).toEqual(before.profiles)
  expect(after.configRevision).not.toBe(before.configRevision)
  expect(await f.profiles().mutate({ ...authority, command })).toEqual({ status: "conflict", configRevision: after.configRevision })
  expect(f.readRows<{ config_revision: number }>("SELECT config_revision FROM sf_team_profile_audit ORDER BY config_revision")
    .map((entry) => entry.config_revision)).toEqual([1, 2])
})

test("policy-store: authorization is repeated inside the lock and a rejected or aborted proof leaves no write", async () => {
  const f = await fixture([teamA])
  const before = await f.profiles().read()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<boolean>()
  const first = f.profiles().mutate({
    ...authority, command: adminCommand(f.profile(), "disable", before.configRevision),
    authorize: async () => { entered.resolve(); return release.promise },
  })
  await entered.promise
  const state = { current: true, secondCalled: false }
  const second = f.profiles().mutate({
    ...authority, command: adminCommand(f.profile(), "disable", before.configRevision),
    authorize: async () => { state.secondCalled = true; return state.current },
  })
  state.current = false
  expect(state.secondCalled).toBe(false)
  release.resolve(false)
  expect(await first).toEqual({ status: "denied" })
  expect(await second).toEqual({ status: "denied" })
  const controller = new AbortController()
  await expect(f.profiles().mutate({
    ...authority, command: adminCommand(f.profile(), "disable", before.configRevision), signal: controller.signal,
    authorize: async () => { controller.abort(); return true },
  })).rejects.toThrow()
  expect(await f.profiles().read()).toEqual(before)
  expect(f.readRows("SELECT * FROM sf_team_profile_audit")).toEqual([])
})

test("policy-store: shared configuration uses the same opaque CAS and exact audited document without business roles", async () => {
  const f = await fixture([teamA])
  const before = await f.profiles().read()
  expect(await f.profiles().readConfiguration(f.profile())).toBeUndefined()
  const command = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)({
    profile: f.profile(), expectedRevision: before.configRevision,
    document: { version: 1, settings: { model: "provider/model", agents: { analyst: { description: "Shared instructions", hidden: false } } } },
  })
  const result = await f.profiles().configureConfiguration({ ...authority, command })
  expect(result.status).toBe("ok")
  const current = await f.profiles().read()
  expect(await f.profiles().readConfiguration(f.profile())).toEqual({
    origin: "installation-team-store", profile: f.profile(), configRevision: current.configRevision, document: command.document,
  })
  const retry = await f.profiles().configureConfiguration({
    ...authority, command: { ...command, expectedRevision: current.configRevision },
  })
  expect(retry).toEqual({ status: "ok", configRevision: current.configRevision, changed: false })
  expect(f.readRows("SELECT action, principal_object_id FROM sf_team_profile_audit")).toEqual([
    { action: "configuration", principal_object_id: principalId },
  ])
  expect(await f.profiles().mutate({
    ...authority, command: adminCommand(f.profile(), "remove", current.configRevision),
  })).toMatchObject({ status: "ok", changed: true })
  const removed = await f.profiles().read()
  expect(await f.profiles().mutate({
    ...authority, command: adminCommand(f.profile(), "enable", removed.configRevision),
  })).toMatchObject({ status: "ok", changed: true })
  expect(await f.profiles().readConfiguration(f.profile())).toBeUndefined()
  expect(f.readRows("SELECT * FROM snapshots")).toEqual([])
})

test("policy-store: another installation or changed bootstrap descriptor cannot adopt persisted policy", async () => {
  const f = await fixture([teamA])
  await f.state.store.dispose()
  await expect(openLocalStore(f.directory, {
    teamProfilePolicy: { binding: { installationId: "another-installation", tenantId: principal.tenantId }, bootstrapEnabledTeamIds: [teamA] },
  })).rejects.toThrow()
  await expect(openLocalStore(f.directory, {
    teamProfilePolicy: { binding: { installationId: f.installationId, tenantId: principal.tenantId }, bootstrapEnabledTeamIds: [teamA, teamB] },
  })).rejects.toThrow("bootstrap descriptor changed")
  expect((await (await f.reopen()).read()).profiles).toEqual([{ profile: f.profile(), enabled: true }])
})

test("policy contracts: closed shared configuration excludes grants and secrets; omitted options and revision types are preserved", () => {
  const document = Schema.decodeUnknownSync(TeamProfile.ConfigurationDocument)({ version: 1, settings: {} })
  expect(Schema.encodeSync(TeamProfile.ConfigurationDocument)(document)).toEqual({ version: 1, settings: {} })
  expect(Schema.is(TeamProfile.ConfigurationDocument)({ version: 1, settings: { roles: ["admin"] } })).toBe(false)
  expect(Schema.is(TeamProfile.ConfigurationDocument)({ version: 1, settings: { secrets: { apiKey: "not-allowed" } } })).toBe(false)
  expect(Schema.is(TeamProfile.ConfigurationDocument)({ version: 1, settings: { agents: { constructor: {} } } })).toBe(false)
  expect(Schema.decodeUnknownSync(TeamProfile.ConfigRevision)("1")).toBe("1")
  expect(Schema.decodeUnknownSync(TeamProfile.ConfigRevision)(1)).toBe(1)
})
