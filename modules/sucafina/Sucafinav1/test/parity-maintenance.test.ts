import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { BlobTransaction } from "../runtime/assets.ts"
import type { Snapshot } from "../runtime/contract.ts"
import type { Surface } from "../src/identity.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { createLocalJobs } from "../runtime/local-jobs.ts"
import { openLocalStore } from "../runtime/local-store.ts"

const surfaces = ["dashboard", "planner", "procurement"] as const
const secret = "PRIVATE-LOCAL-SECRET-MUST-NOT-ENTER-STATUS"

async function fixture(withRecoveryDrill = false) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-maintenance-"))
  const store = await openLocalStore(join(root, "business"))
  const backups = await createLocalBackups(join(root, "archives"))
  const clock = { value: new Date("2026-01-15T12:00:00.000Z") }
  const recoveryCalls: string[] = []
  let jobs = await createLocalJobs({
    store,
    backupDirectory: join(root, "archives"),
    mount: "/sucafina",
    now: () => clock.value,
    schedule: false,
    ...(withRecoveryDrill
      ? {
          recoveryDrill: async (at: string) => {
            const month = at.slice(0, 7)
            for (const surface of surfaces) {
              const state = await localJobState(store, surface)
              expect(state.monthlyMonth).toBe(month)
              expect(typeof state.monthlyId).toBe("string")
              expect(state.drillMonth).toBe(month)
              const archive = (await backups.list(surface)).find((item) => item.id === state.monthlyId)
              expect(archive?.tier).toBe("monthly")
              await backups.verify(surface, archive!.id, at)
            }
            recoveryCalls.push(at)
            return { at, durationMs: 7 }
          },
        }
      : {}),
  })
  return {
    root,
    store,
    backups,
    clock,
    recoveryCalls,
    jobs: () => jobs,
    async restart() {
      await jobs.dispose()
      jobs = await createLocalJobs({
        store,
        backupDirectory: join(root, "archives"),
        mount: "/sucafina",
        now: () => clock.value,
        schedule: false,
        ...(withRecoveryDrill
          ? {
              recoveryDrill: async (at: string) => {
                const month = at.slice(0, 7)
                for (const surface of surfaces) {
                  const state = await localJobState(store, surface)
                  expect(state.monthlyMonth).toBe(month)
                  expect(state.drillMonth).toBe(month)
                  const archive = (await backups.list(surface)).find((item) => item.id === state.monthlyId)
                  expect(archive?.tier).toBe("monthly")
                  await backups.verify(surface, archive!.id, at)
                }
                recoveryCalls.push(at)
                return { at, durationMs: 7 }
              },
            }
          : {}),
      })
    },
    async dispose() {
      await jobs.dispose()
      await store.dispose()
      await rm(root, { recursive: true, force: true })
    },
  }
}

async function seedBusinesses(store: Awaited<ReturnType<typeof openLocalStore>>) {
  for (const surface of surfaces) {
    await store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
      const key = `asset-${surface}`
      const bytes = new TextEncoder().encode(`business-asset-${surface}`)
      snapshot.data.businessMarker = `business-${surface}`
      snapshot.data.assets = [{ id: `asset-id-${surface}`, key, bytes: bytes.byteLength, kind: "contract", record: "fixture", name: `${surface}.txt`, type: "text/plain" }]
      snapshot.data.localSecretFixture = secret
      if (surface === "procurement") snapshot.data.store = { sup: [], issued: { pr: [], po: [] } }
      await blobs.put(key, bytes, "text/plain")
      return { commit: true, value: undefined }
    })
  }
}

async function localJobState(store: Awaited<ReturnType<typeof openLocalStore>>, surface: Surface) {
  return store.transaction(surface, async (snapshot) => ({
    commit: false,
    value: snapshot.data.localJobState && typeof snapshot.data.localJobState === "object"
      ? snapshot.data.localJobState as Record<string, unknown>
      : {},
  }))
}

test("monthly archives and scratch drills cover three SQLite surfaces, survive restart, and roll over by month", async () => {
  const f = await fixture(true)
  try {
    await seedBusinesses(f.store)
    const januaryAt = f.clock.value.toISOString()
    const january = await f.jobs().runOnce()
    expect(january.error).toBeNull()
    expect(january.recoveryDrill).toEqual({ at: januaryAt, durationMs: 7 })
    expect(structuredClone(january.monthly)).toMatchObject({ dashboard: expect.any(String), planner: expect.any(String), procurement: expect.any(String) })
    expect(structuredClone(january.drills)).toMatchObject({
      dashboard: { at: januaryAt, durationMs: expect.any(Number) },
      planner: { at: januaryAt, durationMs: expect.any(Number) },
      procurement: { at: januaryAt, durationMs: expect.any(Number) },
    })
    expect(Object.keys(january.partialSurface).sort()).toEqual([...surfaces].sort())
    expect(Object.values(january.partialSurface).every((message) => message.includes("restore drill completed"))).toBe(true)
    expect(f.recoveryCalls).toEqual([januaryAt])

    for (const surface of surfaces) {
      const listed = await f.backups.list(surface)
      expect(listed.filter((item) => item.tier === "daily")).toHaveLength(1)
      expect(listed.filter((item) => item.tier === "monthly")).toHaveLength(1)
      const state = await localJobState(f.store, surface)
      if (typeof state.monthlyId !== "string") throw new Error(`Monthly ${surface} archive ID missing`)
      expect(january.monthly[surface]).toBe(state.monthlyId)
      const archive = listed.find((item) => item.id === state.monthlyId)
      expect(archive?.tier).toBe("monthly")
      expect(structuredClone(state)).toMatchObject({
        backupDay: "2026-01-15",
        backupId: expect.any(String),
        monthlyMonth: "2026-01",
        monthlyId: january.monthly[surface],
        drillMonth: "2026-01",
        drillAt: januaryAt,
        drillDurationMs: expect.any(Number),
        recoveryDrillMonth: "2026-01",
        recoveryDrillAt: januaryAt,
        recoveryDrillDurationMs: 7,
      })
      await f.backups.verify(surface, archive!.id, januaryAt)
    }
    const statusText = JSON.stringify(january)
    expect(statusText).not.toContain(f.root)
    expect(statusText).not.toContain(secret)

    await f.jobs().dispose()
    await f.restart()
    const restarted = await f.jobs().runOnce()
    expect(restarted.error).toBeNull()
    expect(restarted.monthly).toEqual(january.monthly)
    expect(restarted.drills).toEqual(january.drills)
    expect(f.recoveryCalls).toEqual([januaryAt])
    for (const surface of surfaces) {
      expect((await f.backups.list(surface)).filter((item) => item.tier === "monthly")).toHaveLength(1)
    }

    f.clock.value = new Date("2026-01-15T13:00:00.000Z")
    const nextHour = await f.jobs().runOnce()
    expect(nextHour.error).toBeNull()
    expect(nextHour.backups.dashboard).not.toBe(january.backups.dashboard)
    for (const surface of surfaces) {
      const listed = await f.backups.list(surface)
      expect(listed.filter((item) => item.tier === "daily")).toHaveLength(2)
      expect(listed.filter((item) => item.tier === "monthly")).toHaveLength(1)
      expect(await localJobState(f.store, surface)).toMatchObject({
        backupDay: "2026-01-15",
        backupHour: "2026-01-15T13",
        backupId: nextHour.backups[surface],
        monthlyMonth: "2026-01",
        monthlyId: january.monthly[surface],
        drillMonth: "2026-01",
        drillAt: januaryAt,
        recoveryDrillMonth: "2026-01",
      })
    }
    expect(f.recoveryCalls).toEqual([januaryAt])

    f.clock.value = new Date("2026-02-01T00:01:00.000Z")
    const februaryAt = f.clock.value.toISOString()
    for (const surface of surfaces) {
      await f.store.transaction(surface, async (snapshot) => {
        snapshot.data.businessMarker = `business-${surface}-february`
        return { commit: true, value: undefined }
      })
    }
    const february = await f.jobs().runOnce()
    expect(february.error).toBeNull()
    expect(february.recoveryDrill).toEqual({ at: februaryAt, durationMs: 7 })
    expect(f.recoveryCalls).toEqual([januaryAt, februaryAt])
    for (const surface of surfaces) {
      const listed = await f.backups.list(surface)
      expect(listed.filter((item) => item.tier === "monthly")).toHaveLength(2)
      expect(await localJobState(f.store, surface)).toMatchObject({
        backupDay: "2026-02-01",
        backupHour: "2026-02-01T00",
        monthlyMonth: "2026-02",
        monthlyId: february.monthly[surface],
        drillMonth: "2026-02",
        drillAt: februaryAt,
        recoveryDrillMonth: "2026-02",
        recoveryDrillAt: februaryAt,
      })
      const archive = await f.backups.source.load(surface, february.monthly[surface]!)
      expect(archive?.snapshot.data.businessMarker).toBe(`business-${surface}-february`)
    }
  } finally {
    await f.dispose()
  }
})

test("deleted monthly archive is recaptured and reverified without erasing daily or recovery progress", async () => {
  const f = await fixture(true)
  try {
    await seedBusinesses(f.store)
    const at = f.clock.value.toISOString()
    const first = await f.jobs().runOnce()
    expect(first.error).toBeNull()
    const oldId = first.monthly.dashboard
    if (!oldId) throw new Error("Monthly dashboard archive missing")
    await rm(join(f.root, "archives", "dashboard", oldId), { recursive: true })

    const recovered = await f.jobs().runOnce()
    expect(recovered.error).toBeNull()
    expect(recovered.monthly.dashboard).not.toBe(oldId)
    expect(f.recoveryCalls).toEqual([at])
    const dashboard = await f.backups.list("dashboard")
    expect(dashboard.filter((item) => item.tier === "monthly")).toHaveLength(1)
    expect(dashboard.find((item) => item.id === recovered.monthly.dashboard)?.tier).toBe("monthly")
    expect(await localJobState(f.store, "dashboard")).toMatchObject({
      backupDay: "2026-01-15",
      monthlyMonth: "2026-01",
      monthlyId: recovered.monthly.dashboard,
      drillMonth: "2026-01",
      drillAt: at,
      recoveryDrillMonth: "2026-01",
      recoveryDrillAt: at,
    })
  } finally {
    await f.dispose()
  }
})

test("legacy daily progress without an hour marker recaptures once to establish hourly fallback", async () => {
  const f = await fixture()
  try {
    await seedBusinesses(f.store)
    const first = await f.jobs().runOnce()
    expect(first.error).toBeNull()
    const before = await f.backups.list("dashboard")
    await f.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.localJobState as Record<string, unknown>
      delete state.backupHour
      return { commit: true, value: undefined }
    })

    const migrated = await f.jobs().runOnce()
    expect(migrated.error).toBeNull()
    const after = await f.backups.list("dashboard")
    expect(after.filter((item) => item.tier === "daily")).toHaveLength(2)
    expect(migrated.backups.dashboard).not.toBe(first.backups.dashboard)
    expect(await localJobState(f.store, "dashboard")).toMatchObject({
      backupDay: "2026-01-15",
      backupHour: "2026-01-15T12",
      monthlyMonth: "2026-01",
      monthlyId: first.monthly.dashboard,
      drillMonth: "2026-01",
    })
    expect(after.filter((item) => item.tier === "monthly")).toHaveLength(1)
    expect(before.filter((item) => item.tier === "monthly")).toHaveLength(1)
  } finally {
    await f.dispose()
  }
})

test("failed recovery drill leaves its progress unset and retries on the next maintenance cycle", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-maintenance-retry-"))
  const store = await openLocalStore(join(root, "business"))
  const backupDirectory = join(root, "archives")
  const clock = { value: new Date("2026-01-15T12:00:00.000Z") }
  const calls: string[] = []
  let fail = true
  const jobs = await createLocalJobs({
    store,
    backupDirectory,
    mount: "/sucafina",
    now: () => clock.value,
    schedule: false,
    recoveryDrill: async (at) => {
      calls.push(at)
      if (fail) {
        fail = false
        throw new Error("Injected recovery drill failure")
      }
      return { at, durationMs: 11 }
    },
  })
  try {
    await seedBusinesses(store)
    const failed = await jobs.runOnce()
    expect(failed.error).toContain("Injected recovery drill failure")
    expect(failed.recoveryDrill).toBeUndefined()
    expect(Object.keys(failed.partialSurface).sort()).toEqual([...surfaces].sort())
    for (const surface of surfaces) {
      expect(await localJobState(store, surface)).toMatchObject({
        monthlyMonth: "2026-01",
        monthlyId: expect.any(String),
        drillMonth: "2026-01",
      })
      expect(await localJobState(store, surface)).not.toHaveProperty("recoveryDrillMonth")
    }

    const retried = await jobs.runOnce()
    expect(retried.error).toBeNull()
    expect(retried.recoveryDrill).toEqual({ at: clock.value.toISOString(), durationMs: 11 })
    expect(calls).toEqual([clock.value.toISOString(), clock.value.toISOString()])
    for (const surface of surfaces) {
      expect(await localJobState(store, surface)).toMatchObject({
        recoveryDrillMonth: "2026-01",
        recoveryDrillAt: clock.value.toISOString(),
        recoveryDrillDurationMs: 11,
      })
    }
  } finally {
    await jobs.dispose()
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test("without the recovery callback monthly archives and scratch verifications do not claim replica recovery", async () => {
  const f = await fixture()
  try {
    await seedBusinesses(f.store)
    const status = await f.jobs().runOnce()
    expect(status.error).toBeNull()
    expect(status.recoveryDrill).toBeUndefined()
    expect(f.recoveryCalls).toEqual([])
    expect(status.drills).toMatchObject({
      dashboard: { at: f.clock.value.toISOString(), durationMs: expect.any(Number) },
      planner: { at: f.clock.value.toISOString(), durationMs: expect.any(Number) },
      procurement: { at: f.clock.value.toISOString(), durationMs: expect.any(Number) },
    })
    expect(JSON.stringify(status)).not.toContain(f.root)
  } finally {
    await f.dispose()
  }
})
