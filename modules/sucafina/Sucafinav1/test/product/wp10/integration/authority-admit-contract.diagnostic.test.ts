import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import type { Surface } from "../../../../src/identity.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"

const surfaces = ["dashboard", "planner", "procurement"] as const
const digest = "a".repeat(64)
type AuthorityInput = Parameters<typeof createSfProductAuthority>[0]
type Mark = { auth: number; getters: number; copies: number; receivers: number }

async function fixture(work: (value: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const value = await setup()
  try { await work(value) } finally { await value.store.dispose(); await rm(value.directory, { recursive: true, force: true }) }
}

async function setup() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-admit-contract-"))
  const store = await openLocalStore(join(directory, "store"))
  const sourceInput: Parameters<typeof createSfSourcePersistence>[0] = { persistence: store, enumerate: enumerateSfSources, createId: randomUUID }
  const persistence = { ...store, ...createSfSourcePersistence(sourceInput) }
  for (const surface of surfaces) await persistence.initializeSources(surface)
  await initializeAbsentSfProductState(persistence, randomUUID)
  const auth: Array<{ surface: Surface; roleMap: unknown; request: Request }> = []
  const getters: number[] = [], copies: number[] = [], receivers: unknown[] = []
  const boundaries: Array<Mark & { request: Request; operation: string; inputDigest: string }> = []
  const mark = (): Mark => ({ auth: auth.length, getters: getters.length, copies: copies.length, receivers: receivers.length })
  const control: { active: boolean; role: string; hook?: (surface: Surface) => Promise<void> | void } = { active: true, role: "viewer" }
  const controller = new AbortController()
  const request = new Request("https://example.test/product", { signal: controller.signal })
  const identity = { installationId: "authority-projection", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const input: AuthorityInput = { identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
    policyVersion: "projection-policy", persistence, grants: [{ principalRef: "person", namespaces: ["cases"], operations: ["sf_context_get"] }],
    now: Date.now, createId: randomUUID, authenticate: async (original, scope) => {
      if (!scope) return null
      auth.push({ surface: scope.surface, roleMap: structuredClone(scope.roleMap), request: original })
      await control.hook?.(scope.surface)
      return control.active ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: control.role }] } : null
    },
    environment: async () => ({ at: "2027-02-02T00:00:00Z", id: randomUUID, directory: [] }),
    commandIdentity: async (original, operation, inputDigest) => {
      // This is the existing command-identity callback, with the same return.
      // Its actual invocation separates the two complete authorization rounds.
      boundaries.push({ ...mark(), request: original, operation, inputDigest })
      return "projection-command"
    },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => 1, authorizeDocument: async () => undefined }
  return { directory, store, persistence, input, product: createSfProductAuthority(input), auth, getters, copies, receivers, boundaries, mark, request }
}

function rounds(f: Awaited<ReturnType<typeof setup>>, before: Mark, after: Mark) {
  expect(f.boundaries).toHaveLength(1)
  const boundary = f.boundaries[0]
  if (!boundary) throw new Error("Real commandIdentity boundary unavailable")
  expect(boundary.request).toBe(f.request)
  expect(boundary.operation).toBe("sf_context_get")
  expect(boundary.inputDigest).toBe(digest)
  const first = f.auth.slice(before.auth, boundary.auth), second = f.auth.slice(boundary.auth, after.auth)
  expect(first.map((entry) => entry.surface)).toEqual([...surfaces])
  expect(second.map((entry) => entry.surface)).toEqual([...surfaces])
  expect([...first, ...second]).toEqual(f.auth.slice(before.auth, after.auth))
  expect(first.every((entry) => entry.request === f.request)).toBe(true)
  expect(second.every((entry) => entry.request === f.request)).toBe(true)
  return { first, second, boundary }
}

test("baseline admit has two complete principal rounds and standalone revalidate has one", async () => {
  await fixture(async (f) => {
    const before = f.mark()
    const admitted = await f.product.ui.admit(f.request, "sf_context_get", digest)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error("Baseline admission unavailable")
    try {
      const admittedEnd = f.mark()
      const observed = rounds(f, before, admittedEnd)
      expect(observed.second).toEqual(observed.first)
      await f.store.readSnapshotRoot!(async () => {
        const revalidateStart = f.mark()
        expect(await f.product.ui.revalidate(admitted.value)).toBe(true)
        const single = f.auth.slice(revalidateStart.auth)
        expect(single.map((entry) => entry.surface)).toEqual([...surfaces])
        expect(single).toEqual(observed.first)
        expect(f.boundaries).toHaveLength(1)
        expect([...observed.first, ...observed.second, ...single]).toEqual(f.auth.slice(before.auth))
      })
    } finally { f.product.ui.finish(admitted.value) }
  })
})

test("baseline opaque admission keeps two persistence getters and one full copy in each real round", async () => {
  await fixture(async (f) => {
    const current = f.persistence.currentSnapshots!
    const wrapped = { ...f.persistence, currentSnapshots: () => { f.copies.push(f.copies.length + 1); return current() } }
    const opaque = { ...f.input, get persistence() { f.getters.push(f.getters.length + 1); return wrapped } }
    const product = createSfProductAuthority(opaque)
    await f.store.readSnapshotRoot!(async () => {
      const before = f.mark()
      const admitted = await product.ui.admit(f.request, "sf_context_get", digest)
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") throw new Error("Opaque admission unavailable")
      try {
        const after = f.mark(), observed = rounds(f, before, after)
        const firstGetters = f.getters.slice(before.getters, observed.boundary.getters)
        const secondGetters = f.getters.slice(observed.boundary.getters, after.getters)
        const firstCopies = f.copies.slice(before.copies, observed.boundary.copies)
        const secondCopies = f.copies.slice(observed.boundary.copies, after.copies)
        expect(firstGetters).toHaveLength(2)
        expect(secondGetters).toHaveLength(2)
        expect(firstCopies).toHaveLength(1)
        expect(secondCopies).toHaveLength(1)
        expect([...firstGetters, ...secondGetters]).toEqual(f.getters.slice(before.getters, after.getters))
        expect([...firstCopies, ...secondCopies]).toEqual(f.copies.slice(before.copies, after.copies))
      } finally { product.ui.finish(admitted.value) }
    })
  })
})

test("baseline poison preserves both complete rounds and is refused at its original root egress", async () => {
  await fixture(async (f) => {
    await expect(f.store.readSnapshotRoot!(async () => {
      await f.store.transaction("planner", async () => ({ commit: true, value: undefined })).catch(() => undefined)
      const before = f.mark()
      const admitted = await f.product.ui.admit(f.request, "sf_context_get", digest)
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") throw new Error("Poison observation admission unavailable")
      try {
        const observed = rounds(f, before, f.mark())
        expect(observed.second).toEqual(observed.first)
      } finally { f.product.ui.finish(admitted.value) }
      return "cannot escape poisoned root"
    })).rejects.toThrow("Nested local write attempted")
  })
})

test("baseline inherited role map observes the full receiver nine times in each real round", async () => {
  await fixture(async (f) => {
    for (const surface of surfaces) await f.persistence.transaction(surface, async (snapshot) => {
      snapshot.data.marker = surface
      return { commit: true, value: undefined }
    })
    Object.defineProperty(Object.prototype, "roleMap", { configurable: true, get() {
      f.receivers.push(Object.getOwnPropertyDescriptor(this, "marker")?.value)
      return []
    } })
    try {
      const before = f.mark()
      const admitted = await f.store.readSnapshotRoot!(() => f.product.ui.admit(f.request, "sf_context_get", digest))
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") throw new Error("Inherited-map admission unavailable")
      try {
        const after = f.mark(), observed = rounds(f, before, after)
        const first = f.receivers.slice(before.receivers, observed.boundary.receivers)
        const second = f.receivers.slice(observed.boundary.receivers, after.receivers)
        expect(first).toEqual(surfaces.flatMap((surface) => [surface, surface, surface]))
        expect(second).toEqual(surfaces.flatMap((surface) => [surface, surface, surface]))
        expect([...first, ...second]).toEqual(f.receivers.slice(before.receivers, after.receivers))
      } finally { f.product.ui.finish(admitted.value) }
    } finally { Reflect.deleteProperty(Object.prototype, "roleMap") }
  })
})
