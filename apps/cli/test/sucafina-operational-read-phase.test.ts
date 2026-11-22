import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { object, type Persistence, type Snapshot, type TransactionOptions } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { runSfOperationalReadPhase } from "../src/sucafina-product/native-ui/operational-read-phase.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-operational-read-phase-"))
  const store = await openLocalStore(directory)
  cleanups.push(async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) })
  const root = store.readSnapshotRoot
  if (!root || !store.currentSnapshotScope) throw new Error("Original SQLite readonly root required")
  await store.transaction("dashboard", async (snapshot) => {
    snapshot.data.phase = { value: 1 }
    return { commit: true, value: undefined }
  })
  const controller = new AbortController()
  const request = new Request("https://phase.example/sucafina/api/ui/context", { signal: controller.signal })
  const read = () => store.transaction("dashboard", async (snapshot) =>
    ({ commit: false, value: object(snapshot.data.phase).value }))
  return { store, root, read, request, controller }
}

test("one phase keeps every original callback and detached copy; the next phase observes fresh SQL", async () => {
  const { store, read, request } = await fixture()
  const roots: object[] = [], snapshots: Snapshot[] = []
  let callbacks = 0
  const first = await runSfOperationalReadPhase(store, request, async () => {
    const results = []
    for (let index = 0; index < 3; index++) results.push(await store.transaction("dashboard", async (snapshot) => {
      callbacks++
      const scope = store.currentSnapshotScope?.()
      if (!scope || !scope.readOnly) throw new Error("Original readonly root missing")
      roots.push(scope.identity); snapshots.push(snapshot)
      const value = object(snapshot.data.phase).value
      object(snapshot.data.phase).value = 99
      return { commit: false, value }
    }))
    return results
  })
  expect(first).toEqual([1, 1, 1])
  expect(callbacks).toBe(3)
  expect(new Set(roots).size).toBe(1)
  expect(new Set(snapshots).size).toBe(3)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
  expect(await read()).toBe(1)
  await store.transaction("dashboard", async (snapshot) => {
    object(snapshot.data.phase).value = 2
    return { commit: true, value: undefined }
  })
  const second = await runSfOperationalReadPhase(store, request, async () => {
    expect(store.currentSnapshotScope?.()?.identity).not.toBe(roots[0])
    return read()
  })
  expect(second).toBe(2)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("unsupported providers execute the original work once without a readonly root", async () => {
  const { store, read, request } = await fixture()
  const legacy: Persistence = { transaction: store.transaction }
  let calls = 0
  const result = await runSfOperationalReadPhase(legacy, request, async () => {
    calls++
    expect(store.currentSnapshotScope?.()).toBeUndefined()
    return read()
  })
  expect(result).toBe(1)
  expect(calls).toBe(1)
})

test("an existing original root keeps its owner and never opens a nested writer", async () => {
  const { store, root, read, request } = await fixture()
  let calls = 0
  const result = await root(async () => {
    const identity = store.currentSnapshotScope?.()?.identity
    return runSfOperationalReadPhase(store, request, async () => {
      calls++
      expect(store.currentSnapshotScope?.()?.identity).toBe(identity)
      return read()
    })
  }, { signal: request.signal })
  expect(result).toBe(1)
  expect(calls).toBe(1)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("a caught nested write poisons the original root and cannot publish or replay", async () => {
  const { store, read, request } = await fixture()
  let work = 0, writes = 0
  await expect(runSfOperationalReadPhase(store, request, async () => {
    work++
    await store.transaction("dashboard", async (snapshot) => {
      writes++
      object(snapshot.data.phase).value = 9
      return { commit: true, value: undefined }
    }).catch(() => undefined)
    return "must-not-publish"
  })).rejects.toThrow()
  expect(work).toBe(1)
  expect(writes).toBe(1)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
  expect(await read()).toBe(1)
})

test("abort after an original read closes the scope without replay", async () => {
  const { store, read, request, controller } = await fixture()
  let calls = 0
  await expect(runSfOperationalReadPhase(store, request, async () => {
    calls++
    await read()
    controller.abort()
    return "must-not-publish"
  })).rejects.toThrow()
  expect(calls).toBe(1)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
  expect(await read()).toBe(1)
})

test("driver replacement during a phase cannot publish its original result", async () => {
  const { store, read, request } = await fixture()
  const facade: Persistence = { ...store }
  let replacements = 0
  await expect(runSfOperationalReadPhase(facade, request, async () => {
    const value = await read()
    facade.readSnapshotRoot = async () => {
      replacements++
      throw new Error("Replacement root must not execute")
    }
    return value
  })).rejects.toThrow("SF_OPERATIONAL_READ_PHASE_CHANGED")
  expect(replacements).toBe(0)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("an adapter cannot replay the phase callback even when it swallows the second error", async () => {
  const { store, root, read, request } = await fixture()
  const facade: Persistence = { ...store,
    readSnapshotRoot: <T>(work: () => Promise<T>, options?: TransactionOptions) => root(async () => {
      const value = await work()
      try { await work() } catch { /* the phase must still reject outside this provider */ }
      return value
    }, options),
  }
  let calls = 0
  await expect(runSfOperationalReadPhase(facade, request, async () => {
    calls++
    return read()
  })).rejects.toThrow("SF_OPERATIONAL_READ_PHASE_CHANGED")
  expect(calls).toBe(1)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("the provider must return the exact original callback result", async () => {
  const { store, root, read, request } = await fixture()
  const facade: Persistence = { ...store,
    readSnapshotRoot: <T>(work: () => Promise<T>, options?: TransactionOptions) =>
      root(async () => structuredClone(await work()), options),
  }
  await expect(runSfOperationalReadPhase(facade, request, async () => ({ value: await read() })))
    .rejects.toThrow("SF_OPERATIONAL_READ_PHASE_CHANGED")
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("root failures propagate without falling back to a second execution", async () => {
  const { store, request } = await fixture()
  const facade: Persistence = { ...store,
    readSnapshotRoot: async () => { throw new Error("original-root-unavailable") },
  }
  let calls = 0
  await expect(runSfOperationalReadPhase(facade, request, async () => {
    calls++
    return 1
  })).rejects.toThrow("original-root-unavailable")
  expect(calls).toBe(0)
})

test("read work failure closes the original root and remains the original error", async () => {
  const { store, read, request } = await fixture()
  let calls = 0
  await expect(runSfOperationalReadPhase(store, request, async () => {
    calls++
    await read()
    throw new Error("original-read-unavailable")
  })).rejects.toThrow("original-read-unavailable")
  expect(calls).toBe(1)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
  expect(await read()).toBe(1)
})

test("an unjoined descendant cannot use the closed original read scope", async () => {
  const { store, read, request } = await fixture()
  let release: () => void = () => undefined
  let descendant: Promise<boolean> | undefined
  let callbacks = 0
  await runSfOperationalReadPhase(store, request, async () => {
    descendant = new Promise<void>((resolve) => { release = resolve }).then(() =>
      store.transaction("dashboard", async () => {
        callbacks++
        return { commit: false, value: undefined }
      })).then(() => true, () => false)
    return read()
  })
  release()
  if (!descendant) throw new Error("Original descendant missing")
  expect(await descendant).toBe(false)
  expect(callbacks).toBe(0)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("a retained first callback cannot start after the provider rejected the phase", async () => {
  const { store, root, read, request } = await fixture()
  const retained: { late?: () => Promise<unknown> } = {}
  const facade: Persistence = { ...store,
    readSnapshotRoot: async <T>(work: () => Promise<T>, options?: TransactionOptions): Promise<T> => {
      retained.late = () => root(work, options)
      throw new Error("original-root-rejected")
    },
  }
  let calls = 0
  await expect(runSfOperationalReadPhase(facade, request, async () => {
    calls++
    return read()
  })).rejects.toThrow("original-root-rejected")
  if (!retained.late) throw new Error("Original delayed callback missing")
  await expect(retained.late()).rejects.toThrow("SF_OPERATIONAL_READ_PHASE_CHANGED")
  expect(calls).toBe(0)
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})

test("an absent method cannot become inherited during the original phase", async () => {
  const { store, read, request } = await fixture()
  const facade: Persistence = { ...store }
  delete facade.hasCurrentSnapshots
  const prototype = {}
  Object.setPrototypeOf(facade, prototype)
  await expect(runSfOperationalReadPhase(facade, request, async () => {
    const value = await read()
    Object.defineProperty(prototype, "hasCurrentSnapshots", { value: () => true })
    return value
  })).rejects.toThrow("SF_OPERATIONAL_READ_PHASE_CHANGED")
  expect(store.currentSnapshotScope?.()).toBeUndefined()
})
