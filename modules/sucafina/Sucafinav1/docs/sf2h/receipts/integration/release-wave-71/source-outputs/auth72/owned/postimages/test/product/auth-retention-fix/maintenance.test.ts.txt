import { expect, test } from "bun:test"
import { startAuthMaintenance } from "../../../runtime/auth-maintenance.ts"
import { barrier, retentionFixture, within } from "./fixture.ts"

test("idle lifecycle reclaims expired rows in bounded passes without an authentication request", async () => {
  const f = await retentionFixture({ loginSeconds: 1, authentication: { batchSize: 1 } })
  await f.start()
  await f.start()
  f.provider.clock.value += 1000
  const requests = f.provider.requests.length
  const drained = Promise.withResolvers<void>()
  let passes = 0
  const lifecycle = startAuthMaintenance({
    secrets: { ...f.store.secrets, authentication: { ...f.auth, async collect(at) {
      const result = await f.auth.collect(at)
      expect(result.handles + result.payloads).toBeLessThanOrEqual(1)
      passes++
      if ((await f.auth.stats()).records === 0) drained.resolve()
      return result
    } } },
    now: () => f.provider.clock.value,
    intervalMs: 5,
  })
  try {
    await within(drained.promise)
    expect(passes).toBeGreaterThanOrEqual(4)
    expect((await f.auth.stats()).payloads).toBe(0)
    expect((await f.auth.stats()).handles).toBe(0)
    expect(f.provider.requests).toHaveLength(requests)
    await lifecycle.dispose()
    const stoppedAt = passes
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(passes).toBe(stoppedAt)
  } finally { await lifecycle.dispose() }
})

test("maintenance is single flight and disposal waits for its admitted batch", async () => {
  const f = await retentionFixture({ loginSeconds: 1 })
  await f.start()
  f.provider.clock.value += 1000
  const gate = barrier()
  let calls = 0
  const lifecycle = startAuthMaintenance({
    secrets: { ...f.store.secrets, authentication: { ...f.auth, async collect(at) {
      calls++
      await gate.hold()
      return f.auth.collect(at)
    } } },
    now: () => f.provider.clock.value,
    intervalMs: 60000,
  })
  const first = lifecycle.runOnce()
  const second = lifecycle.runOnce()
  await gate.entered
  try {
    expect(calls).toBe(1)
    let disposed = false
    const closing = lifecycle.dispose().then(() => { disposed = true })
    await Promise.resolve()
    expect(disposed).toBe(false)
    gate.release()
    await within(Promise.all([first, second, closing]))
    expect(disposed).toBe(true)
    expect(calls).toBe(1)
    expect((await f.auth.stats()).records).toBe(0)
  } finally { gate.release(); await lifecycle.dispose() }
})
