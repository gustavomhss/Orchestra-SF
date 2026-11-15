import { expect, test } from "bun:test"
import { barrier, context, retentionFixture, within } from "./fixture.ts"

// Installed only in the hosted composition of readonly59 plus mission72.
// The source72 snapshot deliberately does not invent or replace readonly59's API.
test("readonly59 Graph completion observes logout before its queued durable write", async () => {
  const f = await retentionFixture()
  expect(f.store.readSnapshotRoot).toBeDefined()
  const signed = await f.login()
  const gate = barrier()
  f.provider.hooks.before = async (request) => {
    if (new URL(request.url).pathname === "/v1.0/me/checkMemberGroups") await gate.hold()
    return undefined
  }
  let logout: Promise<Response | undefined> | undefined
  const reading = f.store.readSnapshotRoot!(() =>
    f.identity.authenticate(f.request("/planner", signed.sessionCookie), context))
  try {
    await within(gate.entered)
    // Logout installs its local fence before waiting behind the root writer.
    // Start it outside the root callback so it does not inherit that scope;
    // awaiting its durable result before releasing Graph would block the queue.
    logout = f.logout(signed.sessionCookie)
    gate.release()
    expect(await within(reading)).toBeNull()
    expect(logout).toBeDefined()
    expect((await within(logout!))?.status).toBe(204)
  } finally { gate.release(); await reading.catch(() => undefined); await logout }
})

test("catching nested maintenance rejection cannot rescue a poisoned readonly59 root", async () => {
  const f = await retentionFixture()
  expect(f.store.readSnapshotRoot).toBeDefined()
  const begun = await f.start()
  const before = await f.auth.stats()
  let rejected = false
  await expect(f.store.readSnapshotRoot!(async () => {
    try { await f.auth.collect(f.provider.clock.value) } catch { rejected = true }
    return "caller caught attempted auth write"
  })).rejects.toThrow()
  expect(rejected).toBe(true)
  expect(await f.auth.stats()).toEqual(before)
  expect((await begun.callback())?.status).toBe(303)
})
