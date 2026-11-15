import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { join } from "node:path"
import { decodeSnapshot, encodeSnapshot } from "../../../runtime/local-store.ts"
import { current, read, record, seed, surfaces, warm, withStores } from "../runtime-fresh-copy-cost/fixture.ts"

test("each readonly root reads fresh SQL while retained observations remain detached across connections and reopen", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    const writer = await open()
    await seed(store)
    await warm(store)
    const first = await store.readSnapshotRoot!(async () => current(store))
    const pending: { write?: Promise<void> } = {}
    try {
      await store.readSnapshotRoot!(async () => {
        pending.write = writer.transaction("planner", async (snapshot) => {
          record(snapshot.data.left).count = 9
          return { commit: true, value: undefined }
        })
        void pending.write.catch(() => undefined)
        expect(current(store)).toEqual(first)
      })
      await pending.write
      const next = await store.readSnapshotRoot!(async () => current(store))
      expect(record(next.planner.data.left).count).toBe(9)
      expect(record(first.planner.data.left).count).toBe(1)
      record(next.planner.data.left).count = 80
      await store.dispose()
      const reopened = await open()
      expect(await reopened.readSnapshotRoot!(async () => record(current(reopened).planner.data.left).count)).toBe(9)
    } finally {
      await pending.write?.catch(() => undefined)
    }
  })
})

test("readonly admission observes changed equal-length payloads and deleted rows on every surface", async () => {
  await withStores(async (directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const db = new Database(join(directory, "installation.sqlite"), { strict: true })
    try {
      for (const surface of surfaces) {
        const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface)
        if (!row) throw new Error("SQL fixture row missing")
        const changed = decodeSnapshot(row.payload)
        record(changed.data.left).count = 9
        const payload = encodeSnapshot(changed)
        expect(payload.length).toBe(row.payload.length)
        db.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run(payload, surface)
        const observed = await store.readSnapshotRoot!(async () => current(store)[surface])
        expect(record(observed.data.left).count).toBe(9)
        expect(observed.versions).toEqual(changed.versions)
        db.query("DELETE FROM snapshots WHERE surface = ?").run(surface)
        expect(await store.readSnapshotRoot!(async () => current(store)[surface])).toEqual({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] })
        db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?)").run(surface, row.payload)
        expect(await store.readSnapshotRoot!(async () => record(current(store)[surface].data.left).count)).toBe(1)
        expect(record(observed.data.left).count).toBe(9)
      }
    } finally {
      db.close()
    }
  })
})

for (const temperature of ["cold", "warm"] as const) {
  test(`${temperature} readonly root rejects corrupt unrequested SQL before invoking its callback`, async () => {
    await withStores(async (directory, open) => {
      const writer = await open()
      await seed(writer)
      const db = new Database(join(directory, "installation.sqlite"), { strict: true })
      const calls = { root: 0 }
      try {
        for (const surface of surfaces) {
          const store = await open()
          if (temperature === "warm") await warm(store)
          const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface)
          if (!row) throw new Error("SQL fixture row missing")
          const invalid = decodeSnapshot(row.payload)
          invalid.versions.seed = { version: -1, by: "fixture" }
          for (const corrupt of ["not-json", encodeSnapshot(invalid)]) {
            db.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run(corrupt, surface)
            await expect(store.readSnapshotRoot!(async () => { calls.root++; return "no-reads-requested" })).rejects.toThrow()
            expect(calls.root).toBe(0)
          }
          db.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run(row.payload, surface)
        }
        const recovered = await open()
        expect(await recovered.readSnapshotRoot!(async () => current(recovered).dashboard.data.surface)).toBe("dashboard")
      } finally {
        db.close()
      }
    })
  })
}

test("readonly copies remain independent when depth and undefined counts require the original decoder fallback", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await store.transaction("planner", async (snapshot) => {
      const deep: Record<string, unknown> = {}
      let cursor = deep
      for (let index = 0; index < 140; index++) {
        const child = { next: {} }
        cursor.next = child
        cursor = child.next
      }
      cursor.leaf = "preserved"
      snapshot.data.deep = deep
      snapshot.data.missing = Object.fromEntries(Array.from({ length: 4100 }, (_, index) => [`field${index}`, undefined]))
      return { commit: true, value: undefined }
    })
    await warm(store)
    const before = (await read(store, "planner")).snapshot
    await store.readSnapshotRoot!(async () => {
      const first = current(store).planner
      record(first.data.deep).next = "discarded"
      record(first.data.missing).field0 = "discarded"
      await store.transaction("planner", async (snapshot) => {
        expect(snapshot).toEqual(before)
        snapshot.data.deep = "discarded"
        expect(Object.hasOwn(record(snapshot.data.missing), "field4099")).toBe(true)
        expect(record(snapshot.data.missing).field4099).toBeUndefined()
        return { commit: false, value: undefined }
      })
      expect(current(store).planner).toEqual(before)
    })
    expect((await read(store, "planner")).snapshot).toEqual(before)
  })
})
