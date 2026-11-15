import { expect, test } from "bun:test"
import { barrier, context, cookieHandle, noSessionCookie, retentionFixture, within } from "./fixture.ts"

test("consumed challenge remains cancellable in another instance and after reopening the store", async () => {
  const f = await retentionFixture({ sessionSeconds: 1 })
  const second = await f.open()
  const peer = f.makeIdentity(second.secrets, { sessionSeconds: 28800 })
  const begun = await f.start()
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (request.url === f.provider.metadata.token_endpoint) await gate.hold(); return undefined }
  const pending = begun.callback()
  await gate.entered
  try {
    expect(await f.store.secrets.get(f.storageKey("login", begun.state), f.provider.clock.value)).toBeUndefined()
    expect((await f.logout(begun.loginCookie, peer))?.status).toBe(204)
    await second.dispose()
    const reopened = await f.open()
    const restarted = f.makeIdentity(reopened.secrets)
    noSessionCookie(await begun.callback(restarted))
    f.provider.clock.value += 2000
    gate.release()
    noSessionCookie(await pending)
    expect(f.payloadCounts().sessions).toBe(0)
  } finally { gate.release(); await pending }
})

test("logout during a pending callback session write cannot expose a late credential", async () => {
  const f = await retentionFixture()
  const second = await f.open()
  const peer = f.makeIdentity(second.secrets)
  const gate = barrier()
  const identity = f.makeIdentity({ ...f.store.secrets, authentication: { ...f.auth, async issue(input) {
    if (input.key.includes(":session:")) await gate.hold()
    return f.auth.issue(input)
  } } })
  const begun = await f.start(identity)
  const pending = begun.callback()
  await gate.entered
  try {
    expect((await f.logout(begun.loginCookie, peer))?.status).toBe(204)
    gate.release()
    noSessionCookie(await pending)
    expect(f.payloadCounts().sessions).toBe(0)
  } finally { gate.release(); await pending }
})

test("a callback paused after committing the session still observes another instance logout", async () => {
  const f = await retentionFixture()
  const second = await f.open()
  const peer = f.makeIdentity(second.secrets)
  const gate = barrier()
  const identity = f.makeIdentity({ ...f.store.secrets, authentication: { ...f.auth, async issue(input) {
    const issued = await f.auth.issue(input)
    if (input.key.includes(":session:")) await gate.hold()
    return issued
  } } })
  const begun = await f.start(identity)
  const pending = begun.callback()
  await gate.entered
  try {
    expect(f.payloadCounts().sessions).toBe(1)
    expect((await f.logout(begun.loginCookie, peer))?.status).toBe(204)
    gate.release()
    noSessionCookie(await pending)
    expect(f.payloadCounts().sessions).toBe(0)
  } finally { gate.release(); await pending }
})

test("two instances cannot redeem the same challenge twice", async () => {
  const f = await retentionFixture()
  const peer = f.makeIdentity((await f.open()).secrets)
  const begun = await f.start()
  const responses = await Promise.all([begun.callback(), begun.callback(peer)])
  expect(responses.map((response) => response?.status).sort()).toEqual([303, 403])
  expect(f.provider.requests.filter((request) => request.url === f.provider.metadata.token_endpoint)).toHaveLength(1)
  expect(f.payloadCounts().sessions).toBe(1)
})

test("restarted identity rejects copied session and late refresh after a durable logout", async () => {
  const f = await retentionFixture({ tokenSeconds: 90 })
  const signed = await f.login()
  const peer = f.makeIdentity((await f.open()).secrets)
  const gate = barrier()
  const identity = f.makeIdentity({ ...f.store.secrets, async put(key, value, expiresAt, at) {
    if (key.includes(":session:")) await gate.hold()
    await f.store.secrets.put(key, value, expiresAt, at)
  } })
  f.provider.clock.value += 40000
  const refreshing = identity.prepare(f.request("/planner", signed.sessionCookie))
  await gate.entered
  try {
    expect((await f.logout(signed.sessionCookie, peer))?.status).toBe(204)
    const reopened = await f.open()
    const restarted = f.makeIdentity(reopened.secrets)
    expect(await restarted.person(f.request("/planner", signed.sessionCookie))).toBeNull()
    gate.release()
    await refreshing
    expect(await restarted.person(f.request("/planner", signed.sessionCookie))).toBeNull()
    expect(await restarted.authenticate(f.request("/planner", signed.sessionCookie), context)).toBeNull()
    expect(f.payloadCounts().sessions).toBe(0)
  } finally { gate.release(); await refreshing }
})

test("another instance logout denies a Graph result already in flight", async () => {
  const f = await retentionFixture()
  const signed = await f.login()
  const peer = f.makeIdentity((await f.open()).secrets)
  const gate = barrier()
  f.provider.hooks.before = async (request) => { if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") await gate.hold(); return undefined }
  const authorizing = f.identity.authenticate(f.request("/planner", signed.sessionCookie), context)
  await gate.entered
  try {
    expect((await f.logout(signed.sessionCookie, peer))?.status).toBe(204)
    gate.release()
    expect(await authorizing).toBeNull()
  } finally { gate.release(); await authorizing }
})

test("hung refresh admissions remain bounded across expired and collected session generations", async () => {
  const f = await retentionFixture({ tokenSeconds: 90, authentication: { maxRecords: 3, maxChallenges: 3 } })
  const gates = Array.from({ length: 3 }, () => barrier())
  const pending: Promise<void>[] = []
  let refreshRequests = 0
  f.provider.hooks.before = async (request) => {
    if (request.url === f.provider.metadata.token_endpoint &&
      new URLSearchParams(await request.clone().text()).get("grant_type") === "refresh_token") {
      const gate = gates[refreshRequests++]
      if (gate) await gate.hold()
    }
    return undefined
  }
  try {
    for (const gate of gates) {
      const signed = await f.login()
      f.provider.clock.value += 40000
      pending.push(f.identity.prepare(f.request("/planner", signed.sessionCookie)))
      await within(gate.entered)
      expect(refreshRequests).toBe(pending.length)
      const parent = f.auth.inspect(f.storageKey("login", signed.state), f.provider.clock.value)!
      f.provider.clock.value = parent.retainUntil + 1
      await f.auth.collect(f.provider.clock.value)
      expect((await f.auth.stats()).records).toBe(0)
    }
    const fourth = await f.login()
    f.provider.clock.value += 40000
    await within(f.identity.prepare(f.request("/planner", fourth.sessionCookie)))
    expect(refreshRequests).toBe(3)
    expect(await f.identity.person(f.request("/planner", fourth.sessionCookie))).not.toBeNull()
  } finally {
    for (const gate of gates) gate.release()
    await within(Promise.allSettled(pending))
  }
})

test("CR72-01 failed durable logout keeps its fence until a successful retry", async () => {
  const f = await retentionFixture({ lockTimeoutMs: 40 })
  const signed = await f.login()
  const key = f.storageKey("session", cookieHandle(signed.sessionCookie))
  const gate = barrier()
  f.provider.hooks.before = async (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") await gate.hold()
    return undefined
  }
  const authorizing = f.store.transaction("planner", async () => ({
    commit: false,
    value: await f.identity.authenticate(f.request("/planner", signed.sessionCookie), context),
  }))
  try {
    await within(gate.entered)
    // The real business writer remains held until Graph completes, forcing the
    // queued logout to exhaust admission without committing its durable marker.
    expect((await within(f.logout(signed.sessionCookie)))?.status).toBe(503)
    expect(f.auth.inspect(key, f.provider.clock.value)!.state).toBe("revoked")
    gate.release()
    expect(await within(authorizing)).toBeNull()
    expect((await f.logout(signed.sessionCookie))?.status).toBe(204)
    expect((await f.auth.stats()).pendingRevocations).toBe(0)
    const reopened = await f.open()
    const restarted = f.makeIdentity(reopened.secrets)
    expect(await restarted.person(f.request("/planner", signed.sessionCookie))).toBeNull()
  } finally { gate.release(); await authorizing.catch(() => undefined) }
})
