import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import { encodeSnapshot } from "../../../runtime/local-store.ts"
import { current, read, record, seed, surfaces, warm, withStores } from "./fixture.ts"

test("retained copies do not hide commits from another real SQLite handle or survive reopen as aliases", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const other = await open()
    const before = await store.transaction("dashboard", async () => ({ commit: false, value: current(store) }))
    // Warm the same instance's decoder memo before the other handle commits.
    await store.transaction("dashboard", async () => {
      expect(current(store)).toEqual(before)
      return { commit: false, value: undefined }
    })
    await other.transaction("planner", async (snapshot) => {
      record(snapshot.data.left).count = 42
      snapshot.data.updated = "another SQL owner"
      snapshot.versions.seed = { version: 2, by: "other" }
      return { commit: true, value: undefined }
    })
    const changed = await store.transaction("dashboard", async () => ({ commit: false, value: current(store) }))
    expect(record(changed.planner.data.left).count).toBe(42)
    expect(changed.planner.versions.seed).toEqual({ version: 2, by: "other" })
    await warm(store)
    const after = await store.transaction("dashboard", async () => {
      const first = current(store)
      const second = current(store)
      expect(record(first.planner.data.left).count).toBe(42)
      expect(first.planner.versions.seed).toEqual({ version: 2, by: "other" })
      expect(first.planner.data.updated).toBe("another SQL owner")
      expect(first.planner.data.left).not.toBe(second.planner.data.left)
      record(first.planner.data.left).count = 999
      expect(record(second.planner.data.left).count).toBe(42)
      return { commit: false, value: second }
    })
    expect(record(before.planner.data.left).count).toBe(1)
    expect(before.planner.data).not.toHaveProperty("updated")
    await store.dispose()
    const reopened = await open()
    expect((await read(reopened, "planner")).snapshot).toEqual(after.planner)
    record(after.planner.data.left).count = 555
    expect(record((await read(reopened, "planner")).snapshot.data.left).count).toBe(42)
  })
})

test("a changed or deleted non-target SQL row is observed before callback and cannot reuse stale plans", async () => {
  await withStores(async (directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const original = await store.transaction("dashboard", async () => ({ commit: false, value: current(store) }))
    const db = new Database(join(directory, "installation.sqlite"), { strict: true })
    try {
      db.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run('{"invalid":"envelope"}', "procurement")
      const calls: string[] = []
      await expect(store.transaction("dashboard", async () => {
        calls.push("invalid row admitted")
        return { commit: false, value: undefined }
      })).rejects.toThrow("Unsupported local snapshot encoding")
      expect(calls).toEqual([])
      // Restore through the real codec, then ensure a fresh root is admitted.
      db.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run(encodeSnapshot(original.procurement), "procurement")
      await store.transaction("dashboard", async () => {
        calls.push("restored")
        expect(current(store).procurement).toEqual(original.procurement)
        return { commit: false, value: undefined }
      })
      db.query("DELETE FROM snapshots WHERE surface = ?").run("procurement")
      await store.transaction("dashboard", async () => {
        calls.push("deleted")
        const first = current(store)
        const second = current(store)
        expect(first.procurement).toEqual({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] })
        first.procurement.data.mutated = true
        expect(second.procurement.data).toEqual({})
        expect(current(store).procurement.data).toEqual({})
        return { commit: false, value: undefined }
      })
      expect(calls).toEqual(["restored", "deleted"])
      expect(original.procurement.data.surface).toBe("procurement")
    } finally { db.close() }
    await store.dispose()
    expect((await read(await open(), "procurement")).snapshot.data).toEqual({})
  })
})

test("one root retains captured non-target plans safely when admission evicts them from the bounded memo", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    for (const surface of surfaces) {
      await store.transaction(surface, async (snapshot) => {
        snapshot.data = { surface, text: "x".repeat(1_000_000), nested: { count: 1 } }
        return { commit: true, value: undefined }
      })
    }
    await warm(store)
    const before = await store.transaction("dashboard", async () => ({ commit: false, value: current(store) }))
    // This fixture contains only ordinary JSON values. Its encoded v1 payload,
    // JSON materialization and empty missing-path list give exact plan units.
    const units = (snapshot: Snapshot) => encodeSnapshot(snapshot).length + JSON.stringify(snapshot).length + 2
    const budget = 8 * 1024 * 1024
    expect(surfaces.reduce((total, surface) => total + units(before[surface]), 0)).toBeLessThan(budget)
    const other = await open()
    const changed = await other.transaction("procurement", async (snapshot) => {
      snapshot.data.text = "y".repeat(3_400_000)
      record(snapshot.data.nested).count = 2
      return { commit: true, value: snapshot }
    })
    expect(units(changed)).toBeLessThan(budget)
    expect(units(before.planner) + units(changed)).toBeGreaterThan(budget)
    // Do not warm the changed bytes here: dashboard/planner must be captured
    // from the old memo before procurement admission evicts both entries.
    await store.transaction("procurement", async (snapshot) => {
      const first = current(store)
      const second = current(store)
      expect(first.dashboard).toEqual(before.dashboard)
      expect(first.planner).toEqual(before.planner)
      expect(first.procurement).toEqual(changed)
      for (const surface of surfaces) {
        expect(first[surface].data.nested).not.toBe(second[surface].data.nested)
        record(first[surface].data.nested).count = 99
        first[surface].data.text = "recipient-only"
      }
      record(snapshot.data.nested).count = 3
      const third = current(store)
      expect(third.dashboard).toEqual(before.dashboard)
      expect(third.planner).toEqual(before.planner)
      expect(record(third.procurement.data.nested).count).toBe(3)
      expect(record(second.procurement.data.nested).count).toBe(2)
      expect(third.procurement.data.text).toBe(changed.data.text)
      await store.transaction("dashboard", async (nested) => {
        expect(nested).toEqual(before.dashboard)
        record(nested.data.nested).count = 55
        expect(current(store).dashboard).toEqual(before.dashboard)
        return { commit: false, value: undefined }
      })
      return { commit: false, value: undefined }
    })
    expect(record(before.procurement.data.nested).count).toBe(1)
    expect((before.procurement.data.text as string).length).toBe(1_000_000)
    await warm(store)
    expect((await read(store, "procurement")).snapshot).toEqual(changed)
    await store.dispose()
    expect((await read(await open(), "procurement")).snapshot).toEqual(changed)
  })
})
