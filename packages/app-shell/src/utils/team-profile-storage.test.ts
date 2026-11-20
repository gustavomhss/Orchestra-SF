import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { acquireTeamWindowIdentity, clearTeamSelection, createTeamPrivateLifetime,
  readTeamSelection, teamPersonalKey, teamPrivateKey, writeTeamSelection } from "./team-profile-storage"

const owner = (team = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  principal = "11111111-1111-4111-8111-111111111111",
  installationId = "installed:one", tenantId = "11111111-2222-4333-8444-555555555555") =>
  Schema.decodeUnknownSync(TeamProfile.Owner)({
    profile: { installationId, tenantId, teamObjectId: team }, principal: { tenantId, principalObjectId: principal },
  })
const first = owner(), second = owner("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
const firstWindow = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const secondWindow = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const storage = () => {
  const values = new Map<string, string>(), reads: string[] = []
  return { values, reads, getItem(key: string) { reads.push(key); return values.get(key) ?? null },
    setItem(key: string, value: string) { values.set(key, value) }, removeItem(key: string) { values.delete(key) } }
}
const scope = (value = first, windowId = firstWindow) => ({
  installationId: value.profile.installationId, principal: value.principal, windowId,
})

describe("Teams personal storage never reads legacy or foreign owners", () => {
  test("full installation, resource tenant, Team and principal all separate private categories", () => {
    const keys = [
      teamPrivateKey(first, "drafts"), teamPrivateKey(second, "drafts"),
      teamPrivateKey(owner(undefined, "22222222-2222-4222-8222-222222222222"), "drafts"),
      teamPrivateKey(owner(undefined, undefined, "installed:two"), "drafts"),
      teamPrivateKey(owner(undefined, undefined, undefined, "22222222-2222-4333-8444-555555555555"), "drafts"),
      teamPrivateKey(first, "notifications"), teamPrivateKey(first, "drafts", firstWindow),
      teamPrivateKey(first, "drafts", secondWindow),
    ]
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((key) => !key.includes("physical-project"))).toBe(true)
    expect(() => teamPrivateKey(first, "drafts", "browser")).toThrow("TEAM_PRIVATE_SCOPE_INVALID")
  })
  test("window selection keys are personal even when the two accounts share one Team", () => {
    const other = owner(undefined, "22222222-2222-4222-8222-222222222222")
    expect(teamPersonalKey(scope(), "selection")).not.toBe(teamPersonalKey(scope(other), "selection"))
    expect(teamPersonalKey(scope(), "selection")).not.toBe(teamPersonalKey(scope(first, secondWindow), "selection"))
    expect(teamPersonalKey(scope(), "selection")).not.toBe(teamPersonalKey(scope(), "tabs"))
  })
  test("persisted hints are exact IDs, and restore never touches old layout/tabs/prompt keys", () => {
    const local = storage()
    local.values.set("orchestra.window.browser.dat:tabs", '{"title":"private legacy"}')
    local.values.set("layout.v6", '{"directory":"/old"}')
    expect(writeTeamSelection(local, scope(), first.profile)).toBe(true)
    expect(readTeamSelection(local, scope())).toEqual(first.profile)
    expect(local.reads.every((key) => key.startsWith("orchestra.team.personal.v1:"))).toBe(true)
    expect(readTeamSelection(local, scope(first, secondWindow))).toBeUndefined()
    expect(local.values.get("layout.v6")).toBe('{"directory":"/old"}')
  })
  test("foreign installation or tenant cannot be written as a selection hint", () => {
    const local = storage()
    expect(writeTeamSelection(local, scope(), owner(undefined, undefined, "other").profile)).toBe(false)
    expect(writeTeamSelection(local, scope(),
      owner(undefined, undefined, undefined, "22222222-2222-4333-8444-555555555555").profile)).toBe(false)
    expect(local.values.size).toBe(0)
  })
  test("corrupt, duplicate-key, prototype and old-repository values stay quarantined", () => {
    const local = storage(), key = teamPersonalKey(scope(), "selection")
    for (const value of ["{", "[]", '{"directory":"/repo"}',
      JSON.stringify({ ...first.profile, displayName: "Same team" }),
      JSON.stringify(first.profile).replace('"tenantId":', '"tenantId":"22222222-2222-4333-8444-555555555555","tenantId":'),
      JSON.stringify(first.profile).replace("{", '{"__proto__":{},'),
      "x".repeat(2049)]) {
      local.values.set(key, value)
      expect(readTeamSelection(local, scope())).toBeUndefined()
      expect(local.values.get(key)).toBe(value)
    }
  })
  test("quota and unavailable storage report failure without changing the owner", () => {
    const failing = { getItem: (_key: string): string | null => { throw new Error("storage") },
      setItem: (_key: string, _value: string) => { throw new Error("quota") },
      removeItem: (_key: string) => { throw new Error("storage") } }
    expect(writeTeamSelection(failing, scope(), first.profile)).toBe(false)
    expect(readTeamSelection(failing, scope())).toBeUndefined()
    expect(clearTeamSelection(failing, scope())).toBe(false)
  })
  test("clearing one window cannot remove another window's selection", () => {
    const local = storage()
    writeTeamSelection(local, scope(), first.profile)
    writeTeamSelection(local, scope(first, secondWindow), second.profile)
    expect(clearTeamSelection(local, scope())).toBe(true)
    expect(readTeamSelection(local, scope())).toBeUndefined()
    expect(readTeamSelection(local, scope(first, secondWindow))).toEqual(second.profile)
  })
  test("a revoked lifetime suppresses late hydration and async encoding commits", async () => {
    const lifetime = createTeamPrivateLifetime(first, firstWindow)
    let release: (value: string) => void = () => undefined
    const deferred = new Promise<string>((resolve) => { release = resolve })
    const writes: string[] = []
    const reading = lifetime.read(() => deferred)
    const writing = lifetime.write(() => deferred, (value) => { writes.push(value) })
    const request = lifetime.capture()
    expect(request?.current()).toBe(true)
    lifetime.revoke()
    release("private A")
    expect(await reading).toBeUndefined()
    expect(await writing).toBe(false)
    expect(writes).toEqual([])
    expect(request?.signal.aborted).toBe(true)
    expect(lifetime.capture()).toBeUndefined()
    expect(lifetime.key("tabs")).toBeUndefined()
  })
  test("a different Team's lifetime and object URLs remain independent", () => {
    const firstLife = createTeamPrivateLifetime(first, firstWindow)
    const secondLife = createTeamPrivateLifetime(second, firstWindow)
    const a = firstLife.capture(), b = secondLife.capture()
    const url = firstLife.objectUrl(new Blob(["private A"]))
    expect(url).toMatch(/^blob:/)
    firstLife.revoke()
    expect(a?.signal.aborted).toBe(true)
    expect(b?.signal.aborted).toBe(false)
    expect(firstLife.objectUrl(new Blob(["late"]))).toBeUndefined()
    expect(secondLife.key("drafts")).toBeDefined()
    secondLife.revoke()
  })
  test("unsupported Web Locks creates distinct ephemeral windows without using copied storage identity", async () => {
    const local = storage(), abort = new AbortController()
    local.values.set("orchestra.team.window.v1", firstWindow)
    const a = await acquireTeamWindowIdentity({ storage: local, signal: abort.signal })
    const b = await acquireTeamWindowIdentity({ storage: local, signal: abort.signal })
    expect(a?.persistent).toBe(false)
    expect(b?.persistent).toBe(false)
    expect(a?.id).not.toBe(firstWindow)
    expect(a?.id).not.toBe(b?.id)
    a?.dispose(); b?.dispose()
    abort.abort()
    expect(await acquireTeamWindowIdentity({ storage: local, signal: abort.signal })).toBeUndefined()
  })
})
