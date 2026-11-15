import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import type { Surface } from "../../../src/identity.ts"
import { encodeSnapshot, openLocalStore } from "../../../runtime/local-store.ts"

const dashboardMarker = "demand-dashboard-persisted"

async function fixture(work: (directory: string, open: () => Promise<LocalStore>) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-surface-demand-"))
  const stores: LocalStore[] = []
  await chmod(directory, 0o700)
  try {
    await work(directory, async () => {
      const store = await openLocalStore(directory)
      stores.push(store)
      return store
    })
  } finally {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(directory, { recursive: true, force: true })
  }
}

async function seed(store: LocalStore, large = false) {
  if (!store.transactionAll) throw new Error("All-surface transactions unavailable")
  await store.transactionAll(async (snapshots) => {
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      snapshots[surface].data.record = { marker: surface === "dashboard" ? dashboardMarker : surface, value: "persisted", optional: undefined, negativeZero: -0 }
      snapshots[surface].versions.record = { version: 7, by: "original" }
    }
    if (large) snapshots.dashboard.data.large = "x".repeat(2 * 1024 * 1024)
    return { commit: true, value: undefined }
  })
}

function rows(directory: string) {
  const database = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
  try { return database.query<{ surface: Surface; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all() }
  finally { database.close() }
}

function read(store: LocalStore, surface: Surface = "planner") {
  return store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot }))
}

// Observe real parse work without retaining its arguments or replacing results.
// The marker distinguishes Dashboard materialization from tiny sibling surfaces.
async function countParses<T>(work: () => Promise<T>) {
  const parse = JSON.parse
  const counts = { calls: 0, characters: 0, taggedCalls: 0, taggedCharacters: 0, nativeDashboard: 0, taggedDashboard: 0 }
  JSON.parse = (text, reviver) => {
    counts.calls++
    if (typeof text === "string") {
      counts.characters += text.length
      const tagged = text.startsWith('["sucafina-snapshot",')
      if (tagged) { counts.taggedCalls++; counts.taggedCharacters += text.length }
      if (text.includes(dashboardMarker)) {
        if (tagged) counts.taggedDashboard++
        else counts.nativeDashboard++
      }
    }
    return parse(text, reviver)
  }
  try { return { value: await work(), counts } }
  finally { JSON.parse = parse }
}

test("one root emits fresh demanded sibling graphs while nested and current snapshots remain independent staged copies", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await seed(store)
    await read(store)
    const persisted = rows(directory)
    const dashboard = persisted.find((row) => row.surface === "dashboard")!.payload
    const observed = await countParses(() => store.transaction("planner", async (parent) => {
      parent.data.record = { value: "parent stage", optional: undefined, negativeZero: -0 }
      const child = await read(store, "dashboard")
      expect(encodeSnapshot(child)).toBe(dashboard)
      child.data.record = { value: "child mutation" }
      const sibling = await read(store, "dashboard")
      expect(encodeSnapshot(sibling)).toBe(dashboard)
      expect(sibling).not.toBe(child)
      expect(sibling.data).not.toBe(child.data)
      const first = store.currentSnapshots?.()
      if (!first) throw new Error("Current snapshots unavailable")
      expect(encodeSnapshot(first.dashboard)).toBe(dashboard)
      expect(first.planner.data.record).toEqual(parent.data.record)
      expect(first.planner).not.toBe(parent)
      expect(first.planner.data).not.toBe(parent.data)
      first.dashboard.data.record = { value: "current Dashboard mutation" }
      first.planner.data.record = { value: "current Planner mutation" }
      const second = store.currentSnapshots?.()
      if (!second) throw new Error("Current snapshots unavailable")
      expect(encodeSnapshot(second.dashboard)).toBe(dashboard)
      expect(second.planner.data.record).toEqual({ value: "parent stage", optional: undefined, negativeZero: -0 })
      expect(second.dashboard).not.toBe(first.dashboard)
      expect(second.planner).not.toBe(first.planner)
      expect(second.dashboard.data).not.toBe(first.dashboard.data)
      expect(second.planner.data).not.toBe(first.planner.data)
      expect(Object.is((second.planner.data.record as Record<string, unknown>).negativeZero, -0)).toBe(true)
      expect(Object.hasOwn(second.planner.data.record as object, "optional")).toBe(true)
      return { commit: false, value: first }
    }))
    expect(observed.counts.nativeDashboard).toBe(4)
    observed.value.dashboard.data.record = { value: "after-scope output mutation" }
    expect(encodeSnapshot(await read(store, "dashboard"))).toBe(dashboard)
    expect(rows(directory)).toEqual(persisted)
  })
})
