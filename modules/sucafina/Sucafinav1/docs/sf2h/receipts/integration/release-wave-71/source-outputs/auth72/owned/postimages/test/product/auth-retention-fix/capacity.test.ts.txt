import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { cookieHandle, noSessionCookie, retentionFixture } from "./fixture.ts"

test("two stores share the record cap and never evict an issued challenge or revocation fence", async () => {
  const f = await retentionFixture({ loginSeconds: 1, authentication: { maxRecords: 3, maxChallenges: 3 } })
  const peer = f.makeIdentity((await f.open()).secrets)
  const responses = await Promise.all(Array.from({ length: 4 }, (_, index) =>
    (index % 2 ? peer : f.identity).handle(f.request("/auth/login"))))
  expect(responses.map((response) => response?.status).sort()).toEqual([303, 303, 303, 503])
  const admitted = responses.filter((response) => response?.status === 303)
  for (const response of admitted) {
    const state = new URL(response!.headers.get("location")!).searchParams.get("state")!
    expect(f.auth.inspect(f.storageKey("login", state), f.provider.clock.value)!.state).toBe("issued")
    expect(await f.store.secrets.get(f.storageKey("login", state), f.provider.clock.value)).toBeDefined()
  }
  const cookie = admitted[0]!.headers.getSetCookie()[0].split(";")[0]
  expect((await f.logout(cookie, peer))?.status).toBe(204)
  expect((await f.auth.stats()).records).toBe(3)
  expect((await f.identity.handle(f.request("/auth/login")))?.status).toBe(503)
  f.provider.clock.value += 1000
  await f.auth.collect(f.provider.clock.value)
  expect((await f.auth.stats()).records).toBe(0)
  expect((await peer.handle(f.request("/auth/login")))?.status).toBe(303)
})

test("challenge admission has its own shared cap before the total record cap is reached", async () => {
  const f = await retentionFixture({ authentication: { maxRecords: 8, maxChallenges: 2 } })
  const second = await f.open()
  const peer = f.makeIdentity(second.secrets)
  await f.start()
  await f.start(peer)
  expect((await second.secrets.authentication!.stats()).records).toBe(2)
  expect((await peer.handle(f.request("/auth/login")))?.status).toBe(503)
  expect((await f.auth.stats()).records).toBe(2)
})

test("a consumed challenge cannot mint a session past the global record cap", async () => {
  const f = await retentionFixture({ authentication: { maxRecords: 2, maxChallenges: 2 } })
  const begun = await f.start()
  const unconsumed = await f.start()
  noSessionCookie(await begun.callback())
  expect(f.auth.inspect(f.storageKey("login", begun.state), f.provider.clock.value)!.state).toBe("pending")
  expect(await f.store.secrets.get(f.storageKey("login", unconsumed.state), f.provider.clock.value)).toBeDefined()
  expect(f.payloadCounts().sessions).toBe(0)
  expect((await f.auth.stats()).records).toBe(2)
})

test("total ciphertext and individual payload limits reject admission without losing prior records", async () => {
  const f = await retentionFixture({ authentication: { maxRecords: 8, maxChallenges: 8, maxBytes: 64, maxPayloadBytes: 32 } })
  const at = f.provider.clock.value
  const first = f.storageKey("login", randomBytes(32).toString("hex"))
  const second = f.storageKey("login", randomBytes(32).toString("hex"))
  const third = f.storageKey("login", randomBytes(32).toString("hex"))
  const value = randomBytes(32)
  expect(await f.auth.issue({ key: first, value, expiresAt: at + 1000, at })).toBe(true)
  expect(await f.auth.issue({ key: second, value, expiresAt: at + 1000, at })).toBe(true)
  expect(await f.auth.issue({ key: third, value: randomBytes(1), expiresAt: at + 1000, at })).toBe(false)
  expect((await f.auth.stats()).bytes).toBe(64)
  expect(await f.store.secrets.get(first, at)).toEqual(value)
  expect(await f.store.secrets.get(second, at)).toEqual(value)
  await f.store.secrets.take(first, at)
  expect(await f.auth.issue({ key: third, value: randomBytes(33), expiresAt: at + 1000, at })).toBe(false)
  expect((await f.auth.stats()).records).toBe(2)
  expect((await f.auth.stats()).bytes).toBe(32)
  expect(await f.auth.issue({ key: third, value, expiresAt: at + 1000, at })).toBe(true)
  expect((await f.auth.stats()).bytes).toBe(64)
  expect((await f.auth.stats()).records).toBe(3)
  expect(f.auth.inspect(first, at)!.state).toBe("pending")
})

test("oversized refresh writes preserve the signed session bytes, deadline and person", async () => {
  const f = await retentionFixture({ authentication: { maxBytes: 8192, maxPayloadBytes: 4096 } })
  const signed = await f.login()
  const at = f.provider.clock.value
  const key = f.storageKey("session", cookieHandle(signed.sessionCookie))
  const prior = (await f.store.secrets.get(key, at))!
  const handle = f.auth.inspect(key, at)!
  const person = await f.identity.person(f.request("/planner", signed.sessionCookie))
  expect(person).not.toBeNull()
  expect(prior.byteLength).toBeLessThan(f.auth.limits.maxPayloadBytes)
  await f.store.secrets.put(key, randomBytes(f.auth.limits.maxPayloadBytes + 1), handle.expiresAt, at)
  expect(await f.store.secrets.get(key, at)).toEqual(prior)
  expect(f.auth.inspect(key, at)).toEqual(handle)

  // Fill the remaining byte budget with other admitted ciphertext, leaving the
  // live session's replacement within the individual limit but above the total.
  let remaining = f.auth.limits.maxBytes - (await f.auth.stats()).bytes
  while (remaining > 0) {
    const size = Math.min(remaining, f.auth.limits.maxPayloadBytes)
    expect(await f.auth.issue({ key: f.storageKey("login", randomBytes(32).toString("hex")),
      value: randomBytes(size), expiresAt: at + 1000, at })).toBe(true)
    remaining -= size
  }
  expect((await f.auth.stats()).bytes).toBe(f.auth.limits.maxBytes)
  const larger = new Uint8Array(prior.byteLength + 1)
  larger.set(prior)
  await f.store.secrets.put(key, larger, handle.expiresAt, at)
  expect(await f.store.secrets.get(key, at)).toEqual(prior)
  expect(f.auth.inspect(key, at)).toEqual(handle)
  expect((await f.auth.stats()).bytes).toBe(f.auth.limits.maxBytes)
  expect(await f.identity.person(f.request("/planner", signed.sessionCookie))).toEqual(person)
})

test("lower capacity persists across reopen and a peer cannot silently raise it", async () => {
  const f = await retentionFixture({ authentication: { maxRecords: 3, maxChallenges: 2, batchSize: 1 } })
  const saved = f.auth.limits
  await f.store.dispose()
  const restarted = await f.open()
  expect(restarted.secrets.authentication!.limits).toEqual(saved)
  await expect(f.open({ maxRecords: 4 })).rejects.toThrow()
  expect(restarted.secrets.authentication!.limits.maxRecords).toBe(3)
})

test("an over-cap legacy backlog is counted at reopen and retires only in bounded batches", async () => {
  const f = await retentionFixture({ authentication: { maxRecords: 3, maxChallenges: 2, batchSize: 2 } })
  await f.store.dispose()
  const db = new Database(join(f.directory, "installation.sqlite"), { strict: true })
  const value = randomBytes(32)
  try {
    const insert = db.query("INSERT INTO authentication_payloads (key, payload, expires_at) VALUES (?, ?, ?)")
    insert.run("legacy-live", value, f.provider.clock.value + 1000)
    for (let index = 0; index < 4; index++) insert.run(`legacy-expired-${index}`, value, f.provider.clock.value)
  } finally { db.close() }
  const restarted = await f.open()
  const auth = restarted.secrets.authentication!
  const identity = f.makeIdentity(restarted.secrets)
  expect((await auth.stats()).records).toBe(5)
  expect((await identity.handle(f.request("/auth/login")))?.status).toBe(503)
  expect(await auth.collect(f.provider.clock.value)).toEqual({ payloads: 2, handles: 0 })
  expect((await auth.stats()).records).toBe(3)
  expect((await identity.handle(f.request("/auth/login")))?.status).toBe(503)
  expect(await auth.collect(f.provider.clock.value)).toEqual({ payloads: 2, handles: 0 })
  expect(await restarted.secrets.get("legacy-live", f.provider.clock.value)).toEqual(value)
  expect((await identity.handle(f.request("/auth/login")))?.status).toBe(303)
  expect((await auth.stats()).records).toBe(2)
})
