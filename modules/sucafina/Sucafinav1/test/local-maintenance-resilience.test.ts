import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createLocalJobs } from "../runtime/local-jobs.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import type { Surface } from "../src/identity.ts"

const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
const at = "2026-11-12T12:00:00.000Z"
const day = at.slice(0, 10)
const hour = at.slice(0, 13)
const month = at.slice(0, 7)
type Archive = { id: string; at: string; assets: number; bytes: number; tier: "daily" | "monthly" }

async function waitFor(predicate: () => boolean, message: string) {
  const deadline = performance.now() + 3_000
  while (!predicate() && performance.now() < deadline) await Bun.sleep(5)
  expect(predicate(), message).toBe(true)
}

async function seedCurrentProgress(store: LocalStore, archives: Record<Surface, Archive[]>) {
  for (const surface of surfaces) {
    const daily = archives[surface].find((archive) => archive.tier === "daily" && archive.at.slice(0, 13) === hour)
    const monthly = archives[surface].find((archive) => archive.tier === "monthly" && archive.at.slice(0, 7) === month)
    if (!daily || !monthly) throw new Error("maintenance-test-current-archives-missing")
    await store.transaction(surface, async (snapshot) => {
      snapshot.data.localJobState = {
        backupDay: day,
        backupHour: hour,
        backupId: daily.id,
        backupAt: daily.at,
        monthlyMonth: month,
        monthlyId: monthly.id,
        drillMonth: month,
        drillAt: at,
        drillDurationMs: 1,
      }
      return { commit: true, value: undefined }
    })
  }
}

function archiveInventory(monthlyCount: number): Record<Surface, Archive[]> {
  return Object.fromEntries(surfaces.map((surface) => {
    const monthly = Array.from({ length: monthlyCount }, (_, index): Archive => ({
      id: `${surface}-monthly-${String(index).padStart(3, "0")}`,
      at: index === monthlyCount - 1 ? "2026-11-01T00:00:00.000Z" : new Date(Date.UTC(2019, index % 12, 1)).toISOString(),
      assets: 0,
      bytes: 0,
      tier: "monthly",
    }))
    return [surface, [
      { id: `${surface}-daily-current`, at, assets: 0, bytes: 0, tier: "daily" as const },
      ...monthly,
    ]]
  })) as Record<Surface, Archive[]>
}

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
    now: () => { clockReads += 1; return new Date(at) },
    recoveryDrill: async (_at, signal) => {
      recoveryRuns += 1
      enter()
      await Promise.race([
        blocked,
        new Promise<never>((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason), { once: true })),
      ])
      return { at, durationMs: 1 }
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

test("scheduled maintenance rearms only after the active cycle completes", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-maintenance-schedule-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(join(root, "business"))
  const archives = archiveInventory(2)
  await seedCurrentProgress(store, archives)
  const scheduled: Array<{ delayMs: number; task: () => void }> = []
  const entered: Array<() => void> = []
  const released: Array<Promise<void>> = []
  const release: Array<() => void> = []
  for (let index = 0; index < 2; index++) {
    let markEntered!: () => void
    let unblock!: () => void
    released.push(new Promise<void>((resolve) => { unblock = resolve }))
    release.push(unblock)
    entered.push(markEntered = () => {})
    const observed = new Promise<void>((resolve) => { markEntered = resolve })
    entered[index] = () => { void observed }
    Object.assign(entered[index], { observed })
  }
  let verifyIndex = 0
  const observedAt = (index: number) => (entered[index] as (() => void) & { observed: Promise<void> }).observed
  const jobs = await createLocalJobs({
    store,
    backupDirectory: join(root, "unused-backups"),
    mount: "/sucafina",
    intervalMs: 1000,
    schedule: true,
    now: () => new Date(at),
    scheduler: {
      schedule(delayMs, task) {
        const scheduledTask = { delayMs, task }
        scheduled.push(scheduledTask)
        return () => {
          const index = scheduled.indexOf(scheduledTask)
          if (index >= 0) scheduled.splice(index, 1)
        }
      },
    },
    backups: {
      list: async (surface, options) => { options?.signal?.throwIfAborted(); return structuredClone(archives[surface]) },
      capture: async () => { throw new Error("scheduled-maintenance-unexpected-capture") },
      verify: async (_surface, _id, valueAt, options) => {
        const index = verifyIndex++
        if (index >= 2) throw new Error("scheduled-maintenance-unexpected-verification")
        ;(entered[index] as (() => void) & { observed: Promise<void> })()
        await Promise.race([
          released[index]!,
          new Promise<never>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true })),
        ])
        return { at: valueAt, durationMs: 1 }
      },
    },
  })
  try {
    await observedAt(0)
    expect(scheduled).toHaveLength(0)
    release[0]!()
    await waitFor(() => scheduled.length === 1, "first cycle did not arm exactly one completion-relative timer")
    expect(scheduled[0]!.delayMs).toBe(1000)
    scheduled.shift()!.task()
    await observedAt(1)
    expect(scheduled).toHaveLength(0)
    release[1]!()
    await waitFor(() => scheduled.length === 1, "second cycle did not rearm after completion")
    expect(scheduled[0]!.delayMs).toBe(1000)
  } finally {
    release.forEach((unblock) => unblock())
    await jobs.dispose()
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test("84 monthly archives per surface use one inventory read and one rotating deep verification per cycle", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-maintenance-budget-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(join(root, "business"))
  const archives = archiveInventory(84)
  await seedCurrentProgress(store, archives)
  const listCalls = new Map<Surface, number>()
  const verifyCalls: Array<{ surface: Surface; id: string }> = []
  const jobs = await createLocalJobs({
    store,
    backupDirectory: join(root, "unused-backups"),
    mount: "/sucafina",
    schedule: false,
    now: () => new Date(at),
    backups: {
      list: async (surface, options) => {
        options?.signal?.throwIfAborted()
        listCalls.set(surface, (listCalls.get(surface) ?? 0) + 1)
        return structuredClone(archives[surface])
      },
      capture: async () => { throw new Error("maintenance-budget-unexpected-capture") },
      verify: async (surface, id, valueAt, options) => {
        options?.signal?.throwIfAborted()
        verifyCalls.push({ surface, id })
        return { at: valueAt, durationMs: 1 }
      },
    },
  })
  try {
    const first = await jobs.runOnce()
    expect(first.error).toBeNull()
    expect(first.archiveInspection).toMatchObject(verifyCalls[0]!)
    expect([...listCalls.entries()]).toEqual(surfaces.map((surface) => [surface, 1]))
    expect(verifyCalls).toHaveLength(1)

    const second = await jobs.runOnce()
    expect(second.error).toBeNull()
    expect([...listCalls.entries()]).toEqual(surfaces.map((surface) => [surface, 2]))
    expect(verifyCalls).toHaveLength(2)
    expect(verifyCalls[1]).not.toEqual(verifyCalls[0])
    expect(second.archiveInspection).toMatchObject(verifyCalls[1]!)
  } finally {
    await jobs.dispose()
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
