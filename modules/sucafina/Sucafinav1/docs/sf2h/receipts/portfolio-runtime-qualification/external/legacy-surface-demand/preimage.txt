import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import type { Surface } from "../../../src/identity.ts"
import { decodeSnapshot, encodeSnapshot, openLocalStore } from "../../../runtime/local-store.ts"

const dashboardMarker = "demand-dashboard-persisted"
const empty: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }

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

function replace(directory: string, surface: Surface, payload?: string) {
  const database = new Database(join(directory, "installation.sqlite"), { strict: true })
  try {
    if (payload === undefined) database.query("DELETE FROM snapshots WHERE surface = ?").run(surface)
    else database.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run(payload, surface)
  } finally { database.close() }
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

function decoderError(payload: string) {
  try { decodeSnapshot(payload) }
  catch (error) { if (error instanceof Error) return error.message; throw error }
  throw new Error("Invalid-payload control unexpectedly decoded")
}

test("warm root Planner skips unrequested Dashboard materialization while cold admission and transactionAll retain validation", async () => {
  await fixture(async (directory, open) => {
    await seed(await open(), true)
    const persisted = rows(directory)
    const planner = persisted.find((row) => row.surface === "planner")!.payload
    const store = await open()
    const cold = await countParses(() => read(store))
    expect(cold.counts.taggedCalls).toBe(3)
    expect(cold.counts.taggedCharacters).toBe(persisted.reduce((sum, row) => sum + row.payload.length, 0))
    expect(encodeSnapshot(cold.value)).toBe(planner)
    cold.value.data.record = { value: "retained output" }
    const warm = await countParses(() => read(store))
    expect(encodeSnapshot(warm.value)).toBe(planner)
    expect(warm.value).not.toBe(cold.value)
    expect(warm.value.data).not.toBe(cold.value.data)
    expect(warm.counts.taggedCalls).toBe(0)
    expect(warm.counts.nativeDashboard).toBe(0)
    if (!store.transactionAll) throw new Error("All-surface transactions unavailable")
    const all = store.transactionAll
    const eager = await countParses(() => all(async (snapshots) => ({ commit: false, value: snapshots.planner })))
    expect(encodeSnapshot(eager.value)).toBe(planner)
    expect(eager.counts.taggedCalls).toBe(0)
    expect(eager.counts.nativeDashboard).toBe(1)
    expect(eager.counts.characters - warm.counts.characters).toBeGreaterThan(2 * 1024 * 1024)
    expect(rows(directory)).toEqual(persisted)
    console.log("FIN_PERSISTENCE_SURFACE_DEMAND " + JSON.stringify({ cold: cold.counts, warmPlanner: warm.counts, eagerAll: eager.counts }))
  })
})

test("new invalid unrequested SQL payloads reject before root Planner callback on cold and warm stores", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await seed(store)
    const persisted = rows(directory)
    const planner = persisted.find((row) => row.surface === "planner")!.payload
    await read(store)
    for (const surface of ["dashboard", "procurement"] as const) {
      const original = persisted.find((row) => row.surface === surface)!.payload
      const invalidShape = decodeSnapshot(original)
      Reflect.set(invalidShape, "audit", null)
      const invalidContent = decodeSnapshot(original)
      invalidContent.versions.record!.version = -1
      for (const payload of ["[", '["sucafina-snapshot",2,["null"]]', encodeSnapshot(invalidShape), encodeSnapshot(invalidContent)]) {
        replace(directory, surface, payload)
        const expected = decoderError(payload)
        const calls: string[] = []
        for (const target of [store, await open()]) {
          await expect(target.transaction("planner", async () => {
            calls.push("unexpected")
            return { commit: false, value: undefined }
          })).rejects.toThrow(expected)
        }
        expect(calls).toEqual([])
        replace(directory, surface, original)
        expect(encodeSnapshot(await read(store))).toBe(planner)
      }
    }
    expect(rows(directory)).toEqual(persisted)
  })
})

test("one root materializes a demanded sibling once while nested and current snapshots remain independent staged copies", async () => {
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
    expect(observed.counts.nativeDashboard).toBe(1)
    observed.value.dashboard.data.record = { value: "after-scope output mutation" }
    expect(encodeSnapshot(await read(store, "dashboard"))).toBe(dashboard)
    expect(rows(directory)).toEqual(persisted)
  })
})

test("ended root scopes reject deferred sibling access before any lazy materialization", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await seed(store)
    await read(store)
    const planner = rows(directory).find((row) => row.surface === "planner")!.payload
    const release = Promise.withResolvers<void>()
    const late: Promise<unknown>[] = []
    const callbacks: string[] = []
    try {
      const parent = await countParses(() => store.transaction("planner", async (snapshot) => {
        late.push(release.promise.then(() => store.currentSnapshots?.()))
        late.push(release.promise.then(() => store.transaction("dashboard", async () => {
          callbacks.push("unexpected")
          return { commit: false, value: undefined }
        })))
        for (const pending of late) void pending.catch(() => undefined)
        return { commit: false, value: snapshot }
      }))
      expect(parent.counts.nativeDashboard).toBe(0)
      expect(encodeSnapshot(parent.value)).toBe(planner)
      const after = await countParses(async () => {
        parent.value.data.record = { value: "retained ordinary snapshot" }
        encodeSnapshot(parent.value)
        release.resolve()
        const settled = await Promise.allSettled(late)
        for (const result of settled) {
          expect(result.status).toBe("rejected")
          if (result.status !== "rejected") throw new Error("Expired scope unexpectedly succeeded")
          expect(result.reason).toBeInstanceOf(Error)
          expect(String(result.reason)).toContain("scope has ended")
        }
      })
      expect(after.counts.calls).toBe(0)
      expect(callbacks).toEqual([])
      expect(store.currentSnapshots?.()).toBeUndefined()
      expect(encodeSnapshot(await read(store))).toBe(planner)
    } finally { release.resolve(); await Promise.allSettled(late) }
  })
})

test("a captured Dashboard plan survives eviction while other surfaces are observed during the same admission", async () => {
  await fixture(async (directory, open) => {
    const writer = await open()
    await seed(writer, true)
    const reader = await open()
    await read(reader)
    const dashboard = rows(directory).find((row) => row.surface === "dashboard")!.payload
    if (!writer.transactionAll) throw new Error("All-surface transactions unavailable")
    await writer.transactionAll(async (snapshots) => {
      snapshots.planner.data.large = "p".repeat(2 * 1024 * 1024)
      snapshots.procurement.data.large = "q".repeat(2 * 1024 * 1024)
      return { commit: true, value: undefined }
    })
    // Dashboard hits its original plan first. The two new sibling plans each
    // fit, but their aggregate with Dashboard exceeds the immutable-string bound.
    // Demand occurs after admission; it must use that captured plan after eviction.
    const result = await countParses(() => read(reader, "dashboard"))
    expect(encodeSnapshot(result.value)).toBe(dashboard)
    expect(result.counts.taggedCalls).toBe(2)
    expect(result.counts.taggedDashboard).toBe(0)
    expect(result.counts.nativeDashboard).toBe(1)
    expect(Object.is((result.value.data.record as Record<string, unknown>).negativeZero, -0)).toBe(true)
    expect(Object.hasOwn(result.value.data.record as object, "optional")).toBe(true)
    console.log("FIN_PERSISTENCE_CAPTURED_PLAN " + JSON.stringify(result.counts))
  })
})

test("missing sibling rows invalidate old plans and restore only after a fresh SQL observation", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await seed(store)
    await read(store)
    const dashboard = rows(directory).find((row) => row.surface === "dashboard")!.payload
    replace(directory, "dashboard")
    await store.transaction("planner", async () => {
      const first = await read(store, "dashboard")
      expect(first).toEqual(empty)
      first.data.record = { value: "missing output mutation" }
      expect(await read(store, "dashboard")).toEqual(empty)
      expect(store.currentSnapshots?.()?.dashboard).toEqual(empty)
      return { commit: false, value: undefined }
    })
    expect(rows(directory).some((row) => row.surface === "dashboard")).toBe(false)
    const database = new Database(join(directory, "installation.sqlite"), { strict: true })
    try { database.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?)").run("dashboard", dashboard) }
    finally { database.close() }
    expect(encodeSnapshot(await read(store, "dashboard"))).toBe(dashboard)
  })
})

test("independent writers cannot replace an admitted sibling observation and the next root sees their commit", async () => {
  await fixture(async (_directory, open) => {
    const first = await open()
    await seed(first)
    const second = await open()
    await read(first)
    await read(second)
    const ready = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const calls: string[] = []
    const one = first.transaction("planner", async () => {
      calls.push("first")
      ready.resolve()
      await release.promise
      const current = first.currentSnapshots?.()
      if (!current) throw new Error("Current snapshots unavailable")
      expect((current.dashboard.data.record as Record<string, unknown>).value).toBe("persisted")
      return { commit: false, value: undefined }
    })
    await ready.promise
    const two = second.transaction("dashboard", async (snapshot) => {
      calls.push("second")
      snapshot.data.record = { marker: dashboardMarker, value: "other store commit" }
      snapshot.versions.record = { version: 8, by: "second" }
      return { commit: true, value: undefined }
    })
    const finished = Promise.allSettled([one, two])
    try {
      await Bun.sleep(10)
      expect(calls).toEqual(["first"])
      release.resolve()
      await one
      await two
    } finally { release.resolve(); await finished }
    expect(calls).toEqual(["first", "second"])
    await first.transaction("planner", async () => {
      const current = first.currentSnapshots?.()
      if (!current) throw new Error("Current snapshots unavailable")
      expect((current.dashboard.data.record as Record<string, unknown>).value).toBe("other store commit")
      expect(current.dashboard.versions.record).toEqual({ version: 8, by: "second" })
      return { commit: false, value: undefined }
    })
  })
})
