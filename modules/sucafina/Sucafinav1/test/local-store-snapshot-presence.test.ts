import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { openLocalStore } from "../runtime/local-store.ts"
import type { LocalStore } from "../runtime/local-contract.ts"

type Observation = { status: "value"; value: boolean } | { status: "error"; error: unknown }

function capture(work: () => boolean): Observation {
  try { return { status: "value", value: work() } }
  catch (error) { return { status: "error", error } }
}

/** Compare lexical presence/lifetime only. Full captures still validate data. */
function parity(store: LocalStore): Observation {
  if (!store.hasCurrentSnapshots || !store.currentSnapshots) throw new Error("Actual snapshot capabilities unavailable")
  const probe = capture(store.hasCurrentSnapshots)
  const complete = capture(() => store.currentSnapshots!() !== undefined)
  expect(probe.status).toBe(complete.status)
  if (probe.status === "value" && complete.status === "value") expect(probe.value).toBe(complete.value)
  if (probe.status === "error" && complete.status === "error") {
    if (probe.error instanceof Error && complete.error instanceof Error) {
      expect(probe.error.name).toBe(complete.error.name)
      expect(probe.error.message).toBe(complete.error.message)
    } else expect(probe.error).toBe(complete.error)
  }
  return probe
}

function present(store: LocalStore, expected: boolean) {
  expect(parity(store)).toEqual({ status: "value", value: expected })
}

async function snapshots(store: LocalStore) {
  if (!store.transactionAll) throw new Error("Actual multi-surface storage unavailable")
  return store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) }))
}

test("snapshot presence matches full capture outside, inside every real root and in every nested surface", async () => {
  await fixture(async (open) => {
    const store = await open("primary")
    if (!store.readSnapshotRoot || !store.transactionAll) throw new Error("Actual root capabilities unavailable")
    present(store, false)
    await store.transactionAll(async (value) => {
      for (const surface of ["dashboard", "planner", "procurement"] as const) value[surface].data.selected = surface
      return { commit: true, value: undefined }
    })
    const before = await snapshots(store)
    const callbacks: string[] = []
    for (const kind of ["readonly", "single", "all"] as const) {
      const work = async () => {
        callbacks.push(kind + ":root")
        present(store, true)
        await Promise.resolve()
        present(store, true)
        const values: string[] = []
        for (const surface of ["dashboard", "planner", "procurement"] as const) {
          const value = await store.transaction(surface, async (current) => {
            callbacks.push(kind + ":" + surface)
            present(store, true)
            await Promise.resolve()
            present(store, true)
            return { commit: false, value: current.data.selected }
          })
          values.push(String(value))
          present(store, true)
        }
        return values
      }
      const result = kind === "readonly" ? await store.readSnapshotRoot(work)
        : kind === "single" ? await store.transaction("planner", async () => ({ commit: false, value: await work() }))
        : await store.transactionAll(async () => ({ commit: false, value: await work() }))
      expect(result).toEqual(["dashboard", "planner", "procurement"])
      present(store, false)
    }
    expect(callbacks).toEqual(["readonly", "single", "all"].flatMap((kind) =>
      [kind + ":root", kind + ":dashboard", kind + ":planner", kind + ":procurement"]))
    expect(await snapshots(store)).toEqual(before)
  })
}, 10000)

test("snapshot presence belongs to the lexical chain and the exact store, not an active external reader", async () => {
  await fixture(async (open) => {
    const store = await open("primary"), other = await open("other")
    if (!store.readSnapshotRoot) throw new Error("Actual readonly root unavailable")
    const ready = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    let calls = 0
    const running = store.readSnapshotRoot(async () => {
      calls++
      present(store, true)
      present(other, false)
      ready.resolve()
      await release.promise
      present(store, true)
      return "same owner"
    })
    try {
      await ready.promise
      present(store, false)
      present(other, false)
      expect(calls).toBe(1)
    } finally {
      release.resolve()
      expect(await running).toBe("same owner")
    }
    present(store, false)
  })
}, 10000)

test("snapshot presence rejects detached descendants of a closed child and a closed root", async () => {
  await fixture(async (open) => {
    const store = await open("primary")
    if (!store.readSnapshotRoot) throw new Error("Actual readonly root unavailable")
    const childRelease = Promise.withResolvers<void>(), rootRelease = Promise.withResolvers<void>()
    let lateChild: Promise<Observation> | undefined, lateRoot: Promise<Observation> | undefined
    await store.readSnapshotRoot(async () => {
      await store.transaction("planner", async () => {
        present(store, true)
        lateChild = childRelease.promise.then(() => parity(store))
        return { commit: false, value: undefined }
      })
      childRelease.resolve()
      const child = await lateChild!
      expect(child.status).toBe("error")
      if (child.status !== "error") throw new Error("Closed child unexpectedly observed a scope")
      expect(child.error).toBeInstanceOf(Error)
      expect((child.error as Error).message).toBe("Local transaction scope has ended")
      present(store, true)
      lateRoot = rootRelease.promise.then(() => parity(store))
    })
    rootRelease.resolve()
    const root = await lateRoot!
    expect(root.status).toBe("error")
    if (root.status !== "error") throw new Error("Closed root unexpectedly observed a scope")
    expect(root.error).toBeInstanceOf(Error)
    expect((root.error as Error).message).toBe("Local transaction scope has ended")
    present(store, false)
  })
}, 10000)

test("snapshot presence preserves the original ancestor abort reason and never invokes later work", async () => {
  await fixture(async (open) => {
    const store = await open("primary")
    if (!store.readSnapshotRoot) throw new Error("Actual readonly root unavailable")
    const before = await snapshots(store), controller = new AbortController()
    const reason = new Error("probe ancestor cancelled")
    const calls = { root: 0, child: 0, afterAbort: 0 }
    const pending = store.readSnapshotRoot(async () => {
      calls.root++
      present(store, true)
      await store.transaction("dashboard", async () => {
        calls.child++
        controller.abort(reason)
        const observed = parity(store)
        expect(observed.status).toBe("error")
        if (observed.status !== "error") throw new Error("Aborted ancestor unexpectedly admitted a scope")
        expect(observed.error).toBe(reason)
        await expect(store.transaction("planner", async () => {
          calls.afterAbort++
          return { commit: false, value: undefined }
        })).rejects.toBe(reason)
        return { commit: false, value: undefined }
      })
    }, { signal: controller.signal })
    await expect(pending).rejects.toBe(reason)
    expect(calls).toEqual({ root: 1, child: 1, afterAbort: 0 })
    present(store, false)
    expect(await snapshots(store)).toEqual(before)
  })
}, 10000)

test("an aborted nested reader does not borrow its live parent's scope presence", async () => {
  await fixture(async (open) => {
    const store = await open("primary")
    if (!store.readSnapshotRoot) throw new Error("Actual readonly root unavailable")
    const controller = new AbortController(), reason = new Error("probe child cancelled")
    await store.readSnapshotRoot(async () => {
      present(store, true)
      await expect(store.transaction("dashboard", async () => {
        controller.abort(reason)
        const child = parity(store)
        expect(child.status).toBe("error")
        if (child.status !== "error") throw new Error("Aborted child unexpectedly admitted a scope")
        expect(child.error).toBe(reason)
        return { commit: false, value: undefined }
      }, { signal: controller.signal })).rejects.toBe(reason)
      present(store, true)
      const value = await store.transaction("planner", async () => {
        present(store, true)
        return { commit: false, value: "independent live child" }
      })
      expect(value).toBe("independent live child")
    })
    present(store, false)
  })
}, 10000)

test("presence is never a successful-read proof after a caught nested write poisons the root", async () => {
  await fixture(async (open) => {
    const store = await open("primary")
    if (!store.readSnapshotRoot) throw new Error("Actual readonly root unavailable")
    const before = await snapshots(store)
    let writes = 0, returns = 0
    await expect(store.readSnapshotRoot(async () => {
      await expect(store.transaction("planner", async (snapshot) => {
        writes++
        snapshot.data.forbidden = true
        return { commit: true, value: undefined }
      })).rejects.toThrow("Nested local writes are forbidden")
      // currentSnapshots retains lexical presence; the real root still refuses
      // to publish. A caller must never turn this boolean into authority.
      present(store, true)
      returns++
      return "must not publish"
    })).rejects.toThrow("Nested local write attempted")
    expect(writes).toBe(1)
    expect(returns).toBe(1)
    present(store, false)
    expect(await snapshots(store)).toEqual(before)
  })
}, 10000)

test("snapshot presence preserves an admitted root while external disposal drains", async () => {
  await fixture(async (open) => {
    const store = await open("primary")
    if (!store.readSnapshotRoot) throw new Error("Actual readonly root unavailable")
    const ready = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const running = store.readSnapshotRoot(async () => {
      present(store, true)
      ready.resolve()
      await release.promise
      present(store, true)
      await Promise.resolve()
      present(store, true)
      return "admitted read completed"
    })
    let disposing: Promise<void> | undefined
    try {
      await ready.promise
      disposing = store.dispose()
      present(store, false)
      release.resolve()
      expect(await running).toBe("admitted read completed")
      await disposing
    } finally {
      release.resolve()
      await running
      await disposing
    }
    present(store, false)
    let calls = 0
    await expect(store.transaction("planner", async () => {
      calls++
      return { commit: false, value: undefined }
    })).rejects.toThrow("Local store is disposed")
    expect(calls).toBe(0)
  })
}, 10000)

async function fixture(work: (open: (name: string) => Promise<LocalStore>) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-snapshot-presence-"))
  await chmod(root, 0o700)
  const stores: LocalStore[] = []
  try {
    await work(async (name) => {
      const store = await openLocalStore(join(root, name))
      stores.push(store)
      return store
    })
  } finally {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(root, { recursive: true, force: true })
  }
}
