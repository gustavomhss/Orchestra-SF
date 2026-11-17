import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createLocalJobs } from "../runtime/local-jobs.ts"
import { openLocalStore } from "../runtime/local-store.ts"

test("overlapping maintenance triggers coalesce into one cycle instead of creating an immediate rerun storm", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-maintenance-coalesce-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(join(root, "business"))
  let enter!: () => void
  let release!: () => void
  const entered = new Promise<void>((resolve) => { enter = resolve })
  const blocked = new Promise<void>((resolve) => { release = resolve })
  let clockReads = 0
  let recoveryRuns = 0
  const jobs = await createLocalJobs({
    store,
    backupDirectory: join(root, "backups"),
    mount: "/sucafina",
    schedule: false,
    now: () => { clockReads += 1; return new Date("2026-11-12T12:00:00.000Z") },
    recoveryDrill: async (_at, signal) => {
      recoveryRuns += 1
      enter()
      await Promise.race([
        blocked,
        new Promise<never>((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason), { once: true })),
      ])
      return { at: "2026-11-12T12:00:00.000Z", durationMs: 1 }
    },
  })
  try {
    const first = jobs.runOnce()
    await entered
    const second = jobs.runOnce()
    const third = jobs.runOnce()
    expect(second).toBe(first)
    expect(third).toBe(first)
    release()
    const status = await first
    expect(status.error).toBeNull()
    expect(clockReads).toBe(1)
    expect(recoveryRuns).toBe(1)
  } finally {
    release()
    await jobs.dispose()
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
