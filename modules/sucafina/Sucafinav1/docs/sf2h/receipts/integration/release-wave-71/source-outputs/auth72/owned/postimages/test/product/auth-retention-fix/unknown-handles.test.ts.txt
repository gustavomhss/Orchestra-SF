import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { cookieHandle, retentionFixture } from "./fixture.ts"

test("same-origin logout with never-issued syntactic handles allocates no persistent authentication state", async () => {
  const f = await retentionFixture()
  const begun = await f.start()
  const loginName = begun.loginCookie.split("=")[0]
  const sessionName = loginName.replace(/_login$/, "_session")
  const before = { tables: f.authenticationRows(), payloads: f.payloadCounts() }
  for (let index = 0; index < 16; index++) {
    const cookies = `${loginName}=${randomBytes(32).toString("hex")}; ${sessionName}=${randomBytes(32).toString("hex")}`
    const result = await f.logout(cookies)
    expect(result?.status).toBe(204)
    expect(result!.headers.getSetCookie()).toHaveLength(2)
    expect(result!.headers.getSetCookie().every((cookie) => cookie.includes("Max-Age=0"))).toBe(true)
  }
  expect({ tables: f.authenticationRows(), payloads: f.payloadCounts() }).toEqual(before)
  expect((await f.auth.stats()).pendingRevocations).toBe(0)
  // Rejecting forged handles must not impair the separately issued real challenge.
  expect((await begun.callback())?.status).toBe(303)
})

test("repeated logout of a known handle is idempotent across identities", async () => {
  const f = await retentionFixture()
  const peer = f.makeIdentity((await f.open()).secrets)
  const signed = await f.login()
  const key = f.storageKey("session", cookieHandle(signed.sessionCookie))
  const original = f.auth.inspect(key, f.provider.clock.value)!
  expect((await f.logout(signed.sessionCookie))?.status).toBe(204)
  const retained = { tables: f.authenticationRows(), payloads: f.payloadCounts() }
  f.provider.clock.value += 1000
  for (let index = 0; index < 8; index++) expect((await f.logout(signed.sessionCookie, index % 2 ? peer : f.identity))?.status).toBe(204)
  expect({ tables: f.authenticationRows(), payloads: f.payloadCounts() }).toEqual(retained)
  const revoked = f.auth.inspect(key, f.provider.clock.value)!
  expect(revoked.state).toBe("revoked")
  expect(revoked.retainUntil).toBe(original.retainUntil)
  expect(revoked.expiresAt).toBe(original.expiresAt)
  expect(await peer.person(f.request("/planner", signed.sessionCookie))).toBeNull()
})
