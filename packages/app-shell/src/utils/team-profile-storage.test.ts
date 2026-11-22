import { expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { acquireTeamWindowIdentity, teamPrivateKey } from "./team-profile-storage"

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

test("copied sessionStorage cannot acquire a window identity already held by another document", async () => {
  const held = new Set<string>()
  const releases: Promise<void>[] = []
  async function request<T>(name: string, options: LockOptions | ((lock: Lock | null) => T | PromiseLike<T>),
    callback?: (lock: Lock | null) => T | PromiseLike<T>): Promise<T> {
    const accept = typeof options === "function" ? options : callback
    if (!accept) throw new Error("Lock callback required")
    const lock = held.has(name) ? null : { name, mode: "exclusive" as const }
    if (lock) held.add(name)
    const released = Promise.withResolvers<void>()
    releases.push(released.promise)
    try { return await accept(lock) }
    finally {
      if (lock) held.delete(name)
      released.resolve()
    }
  }
  const locks: Pick<LockManager, "request"> = { request }
  const aStorage = storage(), bStorage = storage()
  aStorage.values.set("orchestra.team.window.v1", firstWindow)
  bStorage.values.set("orchestra.team.window.v1", firstWindow)
  const aLife = new AbortController(), bLife = new AbortController()
  const a = await acquireTeamWindowIdentity({ storage: aStorage, locks, signal: aLife.signal })
  const b = await acquireTeamWindowIdentity({ storage: bStorage, locks, signal: bLife.signal })
  try {
    expect(a?.persistent).toBe(true)
    expect(a?.id).toBe(firstWindow)
    expect(b?.persistent).toBe(true)
    expect(b?.id).not.toBe(firstWindow)
    expect(a?.id).not.toBe(b?.id)
    expect(held.size).toBe(2)
    expect(aStorage.values.get("orchestra.team.window.v1")).toBe(a?.id)
    expect(bStorage.values.get("orchestra.team.window.v1")).toBe(b?.id)
  } finally { a?.dispose(); b?.dispose(); aLife.abort(); bLife.abort() }
  await Promise.all(releases)
  expect(held.size).toBe(0)
})
