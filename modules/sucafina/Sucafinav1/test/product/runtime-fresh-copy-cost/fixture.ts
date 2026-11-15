import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

export const surfaces = ["dashboard", "planner", "procurement"] as const
export const bytes = new Uint8Array([0, 255, 17, 128])

export async function withStores(work: (directory: string, open: () => Promise<LocalStore>) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-fresh-copies-"))
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

export function current(store: LocalStore) {
  const snapshots = store.currentSnapshots?.()
  if (!snapshots) throw new Error("Fresh snapshot observation unavailable")
  return snapshots
}

/** Prime the decoder memo without changing durable bytes or measured callbacks. */
export async function warm(store: LocalStore) {
  await store.transaction("dashboard", async () => {
    current(store)
    return { commit: false, value: undefined }
  })
}

export async function seed(store: LocalStore) {
  for (const surface of surfaces) {
    await store.transaction(surface, async (snapshot) => {
      const shared = { count: 1 }
      const sparse: unknown[] = new Array(3)
      sparse[1] = undefined
      sparse[2] = shared
      Object.defineProperty(sparse, "extra", { value: "ignored", enumerable: true })
      const own: Record<string, unknown> = Object.create(null)
      Object.defineProperty(own, "__proto__", { value: { count: 2 }, enumerable: true })
      Object.defineProperty(own, "hidden", { value: undefined, enumerable: false })
      snapshot.data = { surface, left: shared, right: shared, sparse, own, minusZero: -0, optional: undefined, text: "\ud800", toJSON: "ordinary data" }
      snapshot.versions.seed = { version: 1, by: "fixture" }
      snapshot.sequences.seed = 1
      snapshot.audit.push({ who: "fixture", at: "2026-11-14", record: surface, was: undefined, became: shared })
      snapshot.notices.push({ kind: "pending", to: ["fixture"], record: surface, at: "2026-11-14" })
      return { commit: true, value: undefined }
    })
  }
}

export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object fixture")
  return value as Record<string, unknown>
}

export async function read(store: LocalStore, surface: typeof surfaces[number] = "dashboard") {
  return store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => ({
    commit: false, value: { snapshot, blob: await blobs.get("document") },
  }))
}
