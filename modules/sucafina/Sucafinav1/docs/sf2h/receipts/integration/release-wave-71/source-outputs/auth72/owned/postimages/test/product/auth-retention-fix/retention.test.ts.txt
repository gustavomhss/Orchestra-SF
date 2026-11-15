import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { barrier, cookieHandle, noSessionCookie, retentionFixture } from "./fixture.ts"

test("abandoned challenge is unreadable and physically collectible exactly at its expiry", async () => {
  const f = await retentionFixture({ loginSeconds: 1 })
  const begun = await f.start()
  const key = f.storageKey("login", begun.state)
  const issued = f.auth.inspect(key, f.provider.clock.value)!
  expect(issued.state).toBe("issued")
  expect(issued.retainUntil).toBe(issued.expiresAt)
  f.provider.clock.value = issued.expiresAt - 1
  expect(await f.store.secrets.get(key, f.provider.clock.value)).toBeDefined()
  expect(await f.auth.collect(f.provider.clock.value)).toEqual({ payloads: 0, handles: 0 })
  f.provider.clock.value++
  expect(await f.store.secrets.get(key, f.provider.clock.value)).toBeUndefined()
  // Expired reads remain read only; the lifecycle collector owns physical deletion.
  expect((await f.auth.stats()).payloads).toBe(1)
  expect(await f.auth.collect(f.provider.clock.value)).toEqual({ payloads: 1, handles: 1 })
  expect((await f.auth.stats()).records).toBe(0)
  noSessionCookie(await begun.callback())
})

test("refresh never moves absolute session expiry and idle collection reclaims its ciphertext", async () => {
  const f = await retentionFixture({ sessionSeconds: 120, tokenSeconds: 90 })
  const signed = await f.login()
  const key = f.storageKey("session", cookieHandle(signed.sessionCookie))
  const original = f.auth.inspect(key, f.provider.clock.value)!
  f.provider.clock.value += 40000
  await f.identity.prepare(f.request("/planner", signed.sessionCookie))
  expect(f.auth.inspect(key, f.provider.clock.value)!.expiresAt).toBe(original.expiresAt)
  expect(f.auth.inspect(key, f.provider.clock.value)!.retainUntil).toBe(original.retainUntil)
  f.provider.clock.value = original.expiresAt - 1
  expect(await f.identity.person(f.request("/planner", signed.sessionCookie))).not.toBeNull()
  f.provider.clock.value++
  expect(await f.identity.person(f.request("/planner", signed.sessionCookie))).toBeNull()
  expect(f.payloadCounts().sessions).toBe(1)
  await f.auth.collect(f.provider.clock.value)
  expect(f.payloadCounts().sessions).toBe(0)
  expect((await f.auth.stats()).records).toBe(1)
})

test("collection after challenge TTL preserves consumed correlation and cross-instance cancellation", async () => {
  const f = await retentionFixture({ loginSeconds: 1, sessionSeconds: 1 })
  const peer = f.makeIdentity((await f.open()).secrets, { sessionSeconds: 28800 })
  const begun = await f.start()
  const key = f.storageKey("login", begun.state)
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (request.url === f.provider.metadata.token_endpoint) await gate.hold(); return undefined }
  const pending = begun.callback()
  await gate.entered
  try {
    const consumed = f.auth.inspect(key, f.provider.clock.value)!
    expect(consumed.state).toBe("pending")
    expect(consumed.retainUntil).toBe(consumed.expiresAt + 28800000)
    f.provider.clock.value = consumed.expiresAt
    expect(await f.auth.collect(f.provider.clock.value)).toEqual({ payloads: 0, handles: 0 })
    expect((await f.auth.stats()).records).toBe(1)
    expect((await f.logout(begun.loginCookie, peer))?.status).toBe(204)
    expect(f.auth.inspect(key, f.provider.clock.value)!.state).toBe("revoked")
    expect(f.auth.inspect(key, f.provider.clock.value)!.retainUntil).toBe(consumed.retainUntil)
    gate.release()
    noSessionCookie(await pending)
    expect(f.payloadCounts().sessions).toBe(0)
  } finally { gate.release(); await pending }
})

test("a callback beyond the fixed retention horizon cannot resurrect a purged parent", async () => {
  const f = await retentionFixture({ loginSeconds: 1 })
  const begun = await f.start()
  const key = f.storageKey("login", begun.state)
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (request.url === f.provider.metadata.token_endpoint) await gate.hold(); return undefined }
  const pending = begun.callback()
  await gate.entered
  try {
    const consumed = f.auth.inspect(key, f.provider.clock.value)!
    f.provider.clock.value = consumed.retainUntil - 1
    expect(await f.auth.collect(f.provider.clock.value)).toEqual({ payloads: 0, handles: 0 })
    f.provider.clock.value++
    expect(await f.auth.collect(f.provider.clock.value)).toEqual({ payloads: 0, handles: 1 })
    expect((await f.auth.stats()).records).toBe(0)
    expect(await f.auth.issue({ key: f.storageKey("session", randomBytes(32).toString("hex")), value: randomBytes(32),
      expiresAt: f.provider.clock.value + 1000, at: f.provider.clock.value, parent: key })).toBe(false)
    gate.release()
    noSessionCookie(await pending)
    expect((await f.auth.stats()).records).toBe(0)
  } finally { gate.release(); await pending }
})

test("each collector pass has one total deletion budget across payloads and handles", async () => {
  const f = await retentionFixture({ loginSeconds: 1, authentication: { batchSize: 3 } })
  for (let index = 0; index < 5; index++) await f.start()
  f.provider.clock.value += 1000
  const before = await f.auth.stats()
  expect(before.handles + before.payloads).toBe(10)
  let removed = 0
  for (let pass = 0; pass < 10 && removed < 10; pass++) {
    const previous = await f.auth.stats()
    const result = await f.auth.collect(f.provider.clock.value)
    const count = result.handles + result.payloads
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(3)
    const current = await f.auth.stats()
    expect(previous.handles + previous.payloads - current.handles - current.payloads).toBe(count)
    removed += count
    if (pass === 0) expect(current.handles + current.payloads).toBeGreaterThan(0)
  }
  expect(removed).toBe(10)
  expect((await f.auth.stats()).records).toBe(0)
})
