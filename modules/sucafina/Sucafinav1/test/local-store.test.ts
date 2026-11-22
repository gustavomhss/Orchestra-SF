import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, chown, link, mkdir, mkdtemp, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { currentLocalReadonlyAuthorityData, encodeSnapshot, observeLocalSnapshotStability, openLocalStore } from "../runtime/local-store.ts"
import { createCurrentChoiceFence, currentChoiceReadonlyAuthorityData } from "../product/decisions/current-choice-preview.ts"
import type { TrustedDomainContext } from "../product/contracts/sf-execution.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import type { BlobTransaction } from "../runtime/assets.ts"
import type { Snapshot } from "../runtime/contract.ts"

const bytes = new Uint8Array([0, 255, 17, 128])
const empty: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }

async function fixture(work: (directory: string, open: (options?: { lockTimeoutMs?: number }) => Promise<LocalStore>) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-store-test-"))
  const stores: LocalStore[] = []
  await chmod(root, 0o700)
  try {
    await work(join(root, "private"), async (options) => {
      const store = await openLocalStore(join(root, "private"), options)
      stores.push(store)
      return store
    })
  } finally {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(root, { recursive: true, force: true })
  }
}

function barrier() {
  const ready = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  return { ready, release }
}

async function read(store: LocalStore) {
  return store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => ({
    commit: false,
    value: { snapshot: structuredClone(snapshot), blob: await blobs.get("document") },
  }))
}

async function populate(snapshot: Snapshot) {
  snapshot.data.record = { name: "created", optional: undefined }
  snapshot.versions.record = { version: 1, by: "actor" }
  snapshot.sequences.record = 1
  snapshot.audit.push({ who: "actor", at: "2026-11-11", record: "record", was: undefined, became: snapshot.data.record })
  snapshot.notices.push({ kind: "pending", to: ["reviewer"], record: "record", at: "2026-11-11" })
}

test("snapshot stability attests only the live LocalStore root and its mutable target", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const other = await open()
    if (!store.readSnapshotRoot || !store.transactionAll) throw new Error("LocalStore snapshot transactions unavailable")
    expect(observeLocalSnapshotStability(store)).toBeUndefined()

    const observation = await store.transaction("planner", async (snapshot) => {
      const witness = observeLocalSnapshotStability(store)
      expect(witness?.mutable?.surface).toBe("planner")
      expect(witness?.mutable?.snapshot.data).toEqual({})
      expect(witness?.current()).toBe(true)
      expect(observeLocalSnapshotStability({ ...store })).toBeUndefined()
      expect(observeLocalSnapshotStability(other)).toBeUndefined()
      snapshot.data.changed = true

      await store.transaction("dashboard", async (dashboard) => {
        expect(witness?.current()).toBe(false)
        const nested = observeLocalSnapshotStability(store)
        expect(nested?.mutable?.surface).toBe("planner")
        expect(nested?.mutable?.snapshot.data.changed).toBe(true)
        dashboard.data.detached = true
        return { commit: false, value: undefined }
      })
      expect(witness?.current()).toBe(true)
      expect(witness?.mutable?.snapshot.data.changed).toBeUndefined()
      expect(store.currentSnapshot?.("dashboard")?.data.detached).toBeUndefined()
      return { commit: false, value: witness }
    })
    expect(observation?.current()).toBe(false)

    await store.readSnapshotRoot(async () => {
      const witness = observeLocalSnapshotStability(store)
      expect(witness?.current()).toBe(true)
      expect(witness?.mutable).toBeUndefined()
    })
    await store.transactionAll(async () => {
      expect(observeLocalSnapshotStability(store)).toBeUndefined()
      return { commit: false, value: undefined }
    })
  })
})

test("CurrentChoice rejects replacing the snapshot driver during reauthorization", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const request = new Request("https://example.invalid/current-choice")
    const identity = { installationId: "test-installation", projectId: "test-project" }
    const call = Object.freeze({ kind: "ui", binding: Object.freeze(identity), lease: Object.freeze({}) }) as TrustedDomainContext
    const alternate: LocalStore = { ...store, currentSnapshots: () => {
      const snapshots = store.currentSnapshots?.()
      if (snapshots) snapshots.dashboard.data.changed = true
      return snapshots
    } }
    const host = { requestFor: () => request, revalidate: async () => {
      input.persistence = alternate
      return true
    } }
    const input = { persistence: store, host: () => host, operationIdentity: () => "prepare", identity: () => identity }
    const fence = createCurrentChoiceFence(input)

    await expect(fence.run(call, () => fence.persistence.transaction("planner", async () => ({
      commit: false, value: "candidate",
    })))).rejects.toThrow("SF_CURRENT_CHOICE_FENCE_CHANGED")
  })
})


function readonlyChoice(store: LocalStore, signal?: AbortSignal) {
  const request = new Request("https://example.invalid/current-choice-readonly", { signal })
  const identity = { installationId: "readonly-installation", projectId: "readonly-project" }
  // The same bounded CurrentChoice context fixture as the original driver test.
  // Integration below uses the original product admission instead.
  const call = Object.freeze({ kind: "ui", binding: Object.freeze(identity), lease: Object.freeze({}) }) as TrustedDomainContext
  const control = { revalidations: 0, authorized: true }
  const host = { requestFor: () => request, revalidate: async () => {
    control.revalidations++
    return control.authorized
  } }
  const input = { persistence: store, host: () => host, operationIdentity: () => "readonly-boundary", identity: () => identity }
  return { input, fence: createCurrentChoiceFence(input), call, request, control }
}

test("CurrentChoice readonly exposes only the original live root and detached ACL fields", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.readSnapshotRoot) throw new Error("Real readonly root required")
    const selected = readonlyChoice(store)
    const roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "fixture" }]
    const access = { person: { versions: ["published-v1"], nested: { active: true } } }
    await store.transaction("planner", async (snapshot) => {
      snapshot.data = { roleMap, access, sourcePayload: { privateAmount: 2000 } }
      return { commit: true, value: undefined }
    })
    expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
    await store.readSnapshotRoot(async () => {
      const raw = currentLocalReadonlyAuthorityData(store, [])
      const forwarded = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
      expect(raw?.current()).toBe(true)
      expect(forwarded?.current()).toBe(true)
      expect(forwarded?.scope?.identity).toBe(raw?.scope?.identity)
      expect(forwarded?.scope?.identity).toBe(store.currentSnapshotScope?.()?.identity)
      expect(forwarded?.scope?.bytesIdentity).toBe(raw?.scope?.bytesIdentity)
      expect(forwarded?.snapshots).toEqual({})
      const first = currentChoiceReadonlyAuthorityData(selected.fence.persistence, ["planner"])
      const second = currentChoiceReadonlyAuthorityData(selected.fence.persistence, ["planner"])
      expect(first?.snapshots.planner.data).toEqual({ roleMap, access })
      expect(first?.snapshots.planner.data).not.toHaveProperty("sourcePayload")
      expect(first?.scope).toBeUndefined()
      expect(first?.snapshots.planner.data).not.toBe(second?.snapshots.planner.data)
      if (!first || !second) throw new Error("CurrentChoice did not retain real readonly ACL authority")
      first.snapshots.planner.data.roleMap = []
      first.snapshots.planner.data.access = { changed: true }
      expect(second.snapshots.planner.data).toEqual({ roleMap, access })
      expect(store.currentSnapshot?.("planner")?.data).toEqual({ roleMap, access, sourcePayload: { privateAmount: 2000 } })
      expect(first.current()).toBe(true)
      expect(second.current()).toBe(true)
      expect(currentChoiceReadonlyAuthorityData({ ...selected.fence.persistence }, ["planner"])).toBeUndefined()
      expect(currentChoiceReadonlyAuthorityData(new Proxy(selected.fence.persistence, {
        get() { throw new Error("Unknown proxy must not be consulted") },
      }), ["planner"])).toBeUndefined()
    })
  })
})

test("CurrentChoice readonly keeps mutable roots, writer preimages and opaque drivers on their original paths", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.readSnapshotRoot || !store.transactionAll || !store.holdTargetPreimage)
      throw new Error("Real readonly and writer boundaries required")
    const selected = readonlyChoice(store)
    await store.transaction("dashboard", async () => {
      expect(currentLocalReadonlyAuthorityData(store, [])).toBeUndefined()
      expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
      return { commit: false, value: undefined }
    })
    await store.transactionAll(async () => {
      expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, ["planner"])).toBeUndefined()
      return { commit: false, value: undefined }
    })
    const preimage = store.holdTargetPreimage()
    try {
      await store.transaction("dashboard", async () => {
        expect(store.observeAuthority?.(["dashboard"])).toBeDefined()
        expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
        await selected.fence.persistence.transaction("planner", async () => {
          expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, ["planner"])).toBeUndefined()
          return { commit: false, value: undefined }
        })
        return { commit: false, value: undefined }
      }, { targetPreimageCurrent: preimage.current })
    } finally { preimage.release() }
    const opaque = readonlyChoice({ ...store })
    await store.readSnapshotRoot(async () => {
      expect(currentLocalReadonlyAuthorityData(store, ["planner"])).toBeDefined()
      expect(currentChoiceReadonlyAuthorityData(opaque.fence.persistence, ["planner"])).toBeUndefined()
      expect(await opaque.fence.persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: structuredClone(snapshot),
      }))).toEqual(store.currentSnapshot?.("planner"))
    })
  })
})

test("CurrentChoice readonly invalidates every captured provider method after await without invoking its replacement", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.readSnapshotRoot) throw new Error("Real readonly root required")
    const selected = readonlyChoice(store)
    const names = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction", "transactionAll", "readSnapshotRoot", "currentSnapshotScope"] as const
    const root = store.readSnapshotRoot
    for (const owner of [store, selected.fence.persistence]) {
      for (const name of names) {
        await root(async () => {
          const observed = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
          expect(observed?.current()).toBe(true)
          const descriptor = Object.getOwnPropertyDescriptor(owner, name)
          if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new Error("Original provider method missing: " + name)
          let replacementCalls = 0
          await Promise.resolve()
          Object.defineProperty(owner, name, { ...descriptor, value: () => { replacementCalls++; throw new Error("Replacement invoked") } })
          try {
            expect(observed?.current()).toBe(false)
            expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
            expect(replacementCalls).toBe(0)
          } finally { Object.defineProperty(owner, name, descriptor) }
          expect(observed?.current()).toBe(false)
          expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])?.current()).toBe(true)
        })
      }
    }
    await root(async () => {
      const observed = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
      await Promise.resolve()
      selected.input.persistence = { ...store }
      expect(observed?.current()).toBe(false)
      expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
      selected.input.persistence = store
      expect(observed?.current()).toBe(false)
    })
    for (const owner of [selected.input, store, selected.fence.persistence]) {
      await root(async () => {
        const observed = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
        await Promise.resolve()
        Object.setPrototypeOf(owner, null)
        try {
          expect(observed?.current()).toBe(false)
          expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
        } finally { Object.setPrototypeOf(owner, Object.prototype) }
        expect(observed?.current()).toBe(false)
      })
    }
  })
})

test("CurrentChoice readonly preserves active transaction guards and live reauthorization", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.readSnapshotRoot) throw new Error("Real readonly root required")
    const selected = readonlyChoice(store)
    let guards = 0
    const accepted = await selected.fence.run(selected.call, () => store.readSnapshotRoot!(async () => {
      selected.fence.observe(selected.call, (snapshots) => {
        guards++
        expect(snapshots.planner.data).toEqual({})
        snapshots.planner.data.guardMutation = true
        return true
      })
      return selected.fence.persistence.transaction("planner", async () => {
        expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, ["planner"])?.current()).toBe(true)
        expect(store.currentSnapshot?.("planner")?.data.guardMutation).toBeUndefined()
        return { commit: false, value: "accepted" }
      })
    }))
    expect(accepted).toBe("accepted")
    expect(guards).toBeGreaterThan(0)
    expect(selected.control.revalidations).toBeGreaterThan(0)
    let guardedWork = 0
    await expect(selected.fence.run(selected.call, () => store.readSnapshotRoot!(async () => {
      selected.fence.observe(selected.call, () => false)
      return selected.fence.persistence.transaction("planner", async () => {
        guardedWork++
        expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])?.current()).toBe(true)
        return { commit: false, value: "must not publish" }
      })
    }))).rejects.toThrow("SF_CURRENT_CHOICE_FENCE_CHANGED")
    expect(guardedWork).toBe(1)
    selected.control.authorized = false
    await expect(selected.fence.run(selected.call, () => store.readSnapshotRoot!(async () =>
      selected.fence.persistence.transaction("planner", async () => ({ commit: false, value: "must not publish" }))
    ))).rejects.toThrow("SF_CURRENT_CHOICE_FENCE_CHANGED")
  })
})

test("CurrentChoice readonly keeps lexical observations strict while fresh child observations retain the same root", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.readSnapshotRoot) throw new Error("Real readonly root required")
    const selected = readonlyChoice(store)
    const closed = await store.readSnapshotRoot(async () => {
      const parent = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
      if (!parent?.scope) throw new Error("Original root identity missing")
      const rootIdentity = parent.scope.identity
      await selected.fence.persistence.transaction("dashboard", async () => {
        expect(parent.current()).toBe(false)
        const child = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
        expect(child?.scope?.identity).toBe(rootIdentity)
        expect(child?.current()).toBe(true)
        await selected.fence.persistence.transaction("planner", async () => {
          expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])?.scope?.identity).toBe(rootIdentity)
          expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, ["planner"])?.current()).toBe(true)
          return { commit: false, value: undefined }
        })
        expect(child?.current()).toBe(true)
        return { commit: false, value: undefined }
      })
      // An observation already invalidated in a different lexical continuation
      // cannot be rehabilitated merely by returning to its original callback.
      expect(parent.current()).toBe(false)
      const fresh = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
      expect(fresh?.scope?.identity).toBe(rootIdentity)
      expect(fresh?.current()).toBe(true)
      return fresh
    })
    expect(() => closed?.current()).toThrow("Local transaction scope has ended")
    expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
  })
})

test("CurrentChoice readonly propagates abort and poison without granting a writer or reviving a closed observation", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.readSnapshotRoot) throw new Error("Real readonly root required")
    const selected = readonlyChoice(store)
    const abort = new AbortController()
    const reason = new Error("readonly boundary aborted")
    await expect(store.readSnapshotRoot(async () => {
      const observed = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
      expect(observed?.current()).toBe(true)
      abort.abort(reason)
      expect(() => observed?.current()).toThrow(reason.message)
      expect(() => currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toThrow(reason.message)
    }, { signal: abort.signal })).rejects.toThrow(reason.message)
    await expect(store.readSnapshotRoot(async () => {
      const observed = currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])
      expect(observed?.current("unpoisoned")).toBe(true)
      await expect(selected.fence.persistence.transaction("planner", async () => ({
        commit: true, value: "nested write must be refused",
      }))).rejects.toThrow("Nested local writes are forbidden")
      expect(observed?.current()).toBe(true)
      expect(observed?.current("unpoisoned")).toBe(false)
      expect(observed?.current()).toBe(false)
    })).rejects.toThrow("Nested local write attempted")
    expect(currentChoiceReadonlyAuthorityData(selected.fence.persistence, [])).toBeUndefined()
  })
})

test("real SQLite persists the entire snapshot, binary blobs and undefined across reopen", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    expect(await read(store)).toEqual({ snapshot: empty, blob: undefined })
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      await populate(snapshot)
      await blobs.put("document", bytes, "application/octet-stream")
      return { commit: true, value: "saved" }
    })
    const before = await read(store)
    await store.dispose()
    const reopened = await open()
    expect(await read(reopened)).toEqual(before)
    expect(before.blob).toEqual(bytes)
    expect(Object.hasOwn(before.snapshot.audit[0]!, "was")).toBe(true)
    expect(before.snapshot.audit[0]!.was).toBeUndefined()
    expect((await stat(directory)).mode & 0o777).toBe(0o700)
    expect((await stat(join(directory, "installation.sqlite"))).mode & 0o777).toBe(0o600)
    const db = new Database(join(directory, "installation.sqlite"), { readonly: true })
    try {
      expect(db.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" })
    } finally {
      db.close()
    }
  })
})

test("a cold sealed preimage keeps independent reads detached from the writable target", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await store.transaction("dashboard", async (snapshot) => {
      await populate(snapshot)
      return { commit: true, value: undefined }
    })
    await store.dispose()

    const reopened = await open()
    if (!reopened.holdTargetPreimage) throw new Error("LocalStore must provide its preimage guard")
    const retained = reopened.holdTargetPreimage()
    await reopened.transaction("dashboard", async (snapshot) => {
      snapshot.data.record = { name: "staged" }
      const first = await reopened.transaction("dashboard", async (preimage) => ({ commit: false, value: preimage }))
      expect(first.data.record).toEqual({ name: "created", optional: undefined })
      first.data.record = { name: "modified detached copy" }
      const second = await reopened.transaction("dashboard", async (preimage) => ({ commit: false, value: preimage }))
      expect(second.data.record).toEqual({ name: "created", optional: undefined })
      expect(snapshot.data.record).toEqual({ name: "staged" })
      retained.release()
      return { commit: true, value: undefined }
    }, { targetPreimageCurrent: retained.current })
    expect((await read(reopened)).snapshot.data.record).toEqual({ name: "staged" })
  })
})

test("large file bytes do not evict the bounded snapshot plan or alias its copies", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const encodedFile = "QUJD".repeat(5 * 1024 * 1024 / 4)
    const escapedContent = "YWJj".repeat(16 * 1024) + '\n"preserved" \\ Ω'
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.artifact = { entries: [encodedFile, escapedContent, undefined] }
      return { commit: true, value: undefined }
    })
    await store.dispose()

    const reopened = await open()
    if (!reopened.readSnapshotRoot) throw new Error("LocalStore must provide a read snapshot root")
    const readArtifact = async () => {
      const identity = reopened.currentSnapshotScope?.()?.bytesIdentity
      if (!identity) throw new Error("The bounded plan must recognize the exact stored bytes")
      const artifact = reopened.currentSnapshot?.("dashboard")?.data.artifact
      if (!artifact || typeof artifact !== "object" || !("entries" in artifact) || !Array.isArray(artifact.entries))
        throw new Error("The SQLite root did not preserve the file and its metadata")
      return { identity, entries: artifact.entries }
    }
    const first = await reopened.readSnapshotRoot(readArtifact)
    expect(first.entries).toEqual([encodedFile, escapedContent, undefined])
    first.entries[0] = "modified detached copy"
    const second = await reopened.readSnapshotRoot(readArtifact)
    expect(second.identity).toBe(first.identity)
    expect(second.entries).toEqual([encodedFile, escapedContent, undefined])
  })
})

test("retains canonical byte identity when a valid snapshot exceeds the copy-plan node limit", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const entries = 201_000
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.records = Array.from({ length: entries }, (_, value) => value)
      return { commit: true, value: undefined }
    })
    await store.dispose()

    const reopened = await open()
    if (!reopened.readSnapshotRoot) throw new Error("LocalStore must provide a read snapshot root")
    const inspect = async () => {
      const identity = reopened.currentSnapshotScope?.()?.bytesIdentity
      const records = reopened.currentSnapshot?.("dashboard")?.data.records
      if (!identity || !Array.isArray(records)) throw new Error("Observed local snapshot unavailable")
      expect(records).toHaveLength(entries)
      expect(records.at(-1)).toBe(entries - 1)
      return identity
    }
    const first = await reopened.readSnapshotRoot(inspect)
    expect(await reopened.readSnapshotRoot(inspect)).toBe(first)
  })
})

test("fingerprints oversized SQLite rows without accepting a same-length replacement", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const body = "A".repeat(8 * 1024 * 1024)
    const write = (suffix: string) => store.transaction("dashboard", async (snapshot) => {
      snapshot.data.attachment = body + suffix
      return { commit: true, value: undefined }
    })
    if (!store.readSnapshotRoot) throw new Error("LocalStore must provide a read snapshot root")
    const inspect = async (suffix: string) => {
      const identity = store.currentSnapshotScope?.()?.bytesIdentity
      const attachment = store.currentSnapshot?.("dashboard")?.data.attachment
      if (!identity || typeof attachment !== "string") throw new Error("Oversized local snapshot unavailable")
      expect(attachment.length).toBe(body.length + suffix.length)
      expect(attachment.endsWith(suffix)).toBe(true)
      return identity
    }
    await write("1")
    const first = await store.readSnapshotRoot(() => inspect("1"))
    expect(await store.readSnapshotRoot(() => inspect("1"))).toBe(first)
    await write("2")
    const second = await store.readSnapshotRoot(() => inspect("2"))
    expect(first === second).toBe(false)
    expect(await store.readSnapshotRoot(() => inspect("2"))).toBe(second)
  })
})

test("large structured snapshots keep detached byte identities across all three surfaces", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const observed = "A".repeat(80)
    const records = Array.from({ length: 24_000 }, (_, id) => ({ id, observed, source: "original-source" }))
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.records = records
      snapshot.data.edge = { optional: undefined, negativeZero: -0, sentinel: ["undefined"] }
      const encodedUnits = encodeSnapshot(snapshot).length
      const normalizedUnits = JSON.stringify(snapshot).length
      // Exercise the measured full-year import range, with a complete copy that
      // fits alone but would evict other surfaces if the SQL envelope survived.
      expect(encodedUnits).toBeGreaterThan(4 * 1024 * 1024)
      expect(encodedUnits + normalizedUnits).toBeLessThan(8 * 1024 * 1024)
      expect(encodedUnits + normalizedUnits + 1_800_000).toBeGreaterThan(8 * 1024 * 1024)
      return { commit: true, value: undefined }
    })
    for (const surface of ["planner", "procurement"] as const) {
      await store.transaction(surface, async (snapshot) => {
        snapshot.data.material = surface.repeat(100_000)
        return { commit: true, value: undefined }
      })
    }
    await store.dispose()

    const reopened = await open()
    if (!reopened.readSnapshotRoot) throw new Error("LocalStore must provide a read snapshot root")
    const inspect = (expected: string) => reopened.readSnapshotRoot!(async () => {
      const identity = reopened.currentSnapshotScope?.()?.bytesIdentity
      const first = reopened.currentSnapshot?.("dashboard")
      if (!identity || !first || !Array.isArray(first.data.records)) throw new Error("Structured source unavailable")
      expect(first.data.records).toHaveLength(records.length)
      expect(first.data.records[0]).toEqual({ id: 0, observed: expected, source: "original-source" })
      expect(first.data.records.at(-1)).toEqual(records.at(-1))
      expect(first.data.edge).toEqual({ optional: undefined, negativeZero: -0, sentinel: ["undefined"] })
      first.data.records[0].observed = "detached"
      first.data.edge = null
      const second = reopened.currentSnapshot?.("dashboard")
      if (!second || !Array.isArray(second.data.records)) throw new Error("Independent source unavailable")
      expect(second.data.records[0].observed).toBe(expected)
      expect(second.data.edge).toEqual({ optional: undefined, negativeZero: -0, sentinel: ["undefined"] })
      for (const surface of ["planner", "procurement"] as const)
        expect(reopened.currentSnapshot?.(surface)?.data.material).toBe(surface.repeat(100_000))
      return identity
    })
    const first = await inspect(observed)
    // Reopening SQL roots must retain all three exact byte identities, rather
    // than evicting and rebuilding the large structured plan on every read.
    expect(await inspect(observed)).toBe(first)
    const replacement = "B".repeat(observed.length)
    await reopened.transaction("dashboard", async (snapshot) => {
      if (!Array.isArray(snapshot.data.records)) throw new Error("Stored records unavailable")
      snapshot.data.records[0].observed = replacement
      return { commit: true, value: undefined }
    })
    const changed = await inspect(replacement)
    expect(changed === first).toBe(false)
    expect(await inspect(replacement)).toBe(changed)
  })
})

test("codec preserves sentinel-shaped objects, tagged-looking arrays and nested undefined", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const value = {
      $undefined: true, __type: "undefined", $type: "number", value: null,
      nested: [undefined, ["undefined"], ["object", [["x", ["undefined"]]]], false, 0, ""],
      object: { constructor: "data", prototype: "data", missing: undefined },
    }
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.value = value
      return { commit: true, value: null }
    })
    await store.dispose()
    expect((await read(await open())).snapshot.data.value).toEqual(value)
  })
})

for (const mode of ["false", "throw", "abort"] as const) {
  test(`${mode} rolls back state, versions, sequences, audit, notices and blob additions/removals`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open()
      await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        await blobs.put("document", bytes, "binary")
        return { commit: true, value: null }
      })
      const before = await read(store)
      const controller = new AbortController()
      const result = store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        await populate(snapshot)
        await blobs.remove("document")
        await blobs.put("orphan", bytes, "binary")
        if (mode === "throw") throw new Error("callback failed")
        if (mode === "abort") controller.abort()
        return { commit: mode !== "false", value: "declined" }
      }, { signal: controller.signal })
      if (mode === "false") expect(await result).toBe("declined")
      if (mode !== "false") await expect(result).rejects.toThrow()
      await store.dispose()
      const reopened = await open()
      expect(await read(reopened)).toEqual(before)
      await reopened.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        expect(await blobs.get("orphan")).toBeUndefined()
        return { commit: false, value: null }
      })
    })
  })
}

for (const value of [NaN, Infinity, -Infinity, () => 1, { nested: () => 2 }]) {
  test(`unsupported codec value ${String(value)} rejects without modifying persisted state`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open()
      await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        snapshot.data.invalid = value
        await blobs.put("document", bytes, "binary")
        return { commit: true, value: null }
      })).rejects.toThrow()
      expect(await read(store)).toEqual({ snapshot: empty, blob: undefined })
    })
  })
}

test("cyclic state rejects atomically", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    await expect(store.transaction("dashboard", async (snapshot) => {
      snapshot.data.cycle = cycle
      return { commit: true, value: null }
    })).rejects.toThrow()
    expect((await read(store)).snapshot).toEqual(empty)
  })
})

for (const same of [false, true]) {
  test(`independent instances serialize ${same ? "same-record CAS" : "different-record"} writes without replay`, async () => {
    await fixture(async (_directory, open) => {
      const first = await open()
      const second = await open()
      const held = barrier()
      const calls: string[] = []
      const one = first.transaction("dashboard", async (snapshot) => {
        calls.push("first")
        held.ready.resolve()
        await held.release.promise
        snapshot.data.first = "one"
        snapshot.versions.first = { version: 1, by: "one" }
        return { commit: true, value: true }
      })
      await held.ready.promise
      try {
        const two = second.transaction("dashboard", async (snapshot) => {
          calls.push("second")
          const key = same ? "first" : "second"
          if (snapshot.versions[key]) return { commit: false, value: false }
          snapshot.data[key] = "two"
          snapshot.versions[key] = { version: 1, by: "two" }
          return { commit: true, value: true }
        })
        await Bun.sleep(30)
        expect(calls).toEqual(["first"])
        held.release.resolve()
        expect(await one).toBe(true)
        expect(await two).toBe(!same)
        expect(calls).toEqual(["first", "second"])
        expect((await read(first)).snapshot.data).toEqual(same ? { first: "one" } : { first: "one", second: "two" })
      } finally {
        held.release.resolve()
        await one
      }
    })
  })
}

test("surface namespaces isolate identical blob keys and snapshots", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.data.private = true
      await blobs.put("document", bytes, "binary")
      return { commit: true, value: null }
    })
    await store.transaction("procurement", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      expect(snapshot).toEqual(empty)
      expect(await blobs.get("document")).toBeUndefined()
      await blobs.put("document", new Uint8Array([9]), "binary")
      snapshot.data.other = true
      return { commit: true, value: null }
    })
    expect(await read(store)).toEqual({
      snapshot: { ...empty, data: { private: true }, sfBlobGenerations: { document: 1 } },
      blob: bytes,
    })
  })
})

for (const abort of [true, false]) {
  test(`pending lock ${abort ? "cancellation" : "timeout"} never invokes work`, async () => {
    await fixture(async (_directory, open) => {
      const first = await open()
      const second = await open({ lockTimeoutMs: 80 })
      const held = barrier()
      const calls: string[] = []
      const one = first.transaction("dashboard", async () => {
        held.ready.resolve()
        await held.release.promise
        return { commit: true, value: null }
      })
      await held.ready.promise
      try {
        const controller = new AbortController()
        const pending = second.transaction("dashboard", async () => {
          calls.push("unexpected")
          return { commit: true, value: null }
        }, { signal: controller.signal })
        const rejected = expect(pending).rejects.toThrow()
        if (abort) controller.abort()
        await rejected
        expect(calls).toEqual([])
      } finally {
        held.release.resolve()
        await one
      }
    })
  })
}

test("secrets get is read-only inside a business write; expiry, atomic take and removal persist", async () => {
  await fixture(async (_directory, open) => {
    const store = await open({ lockTimeoutMs: 100 })
    const other = await open({ lockTimeoutMs: 100 })
    await store.secrets.put("token", bytes, 200)
    const getActive = store.secrets.getActive
    if (!getActive) throw new Error("Atomic credential reader unavailable")
    await store.transaction("dashboard", async (snapshot) => {
      expect(await getActive("token", "revoked", 199)).toEqual(bytes)
      expect(await store.secrets.get("token", 199)).toEqual(bytes)
      expect(await store.secrets.get("token", 200)).toBeUndefined()
      expect(await store.secrets.get("token", 199)).toEqual(bytes)
      snapshot.data.saved = true
      return { commit: true, value: null }
    })
    await other.secrets.put("revoked", new Uint8Array([1]), 200)
    expect(await store.secrets.get("token", 199)).toEqual(bytes)
    expect(await getActive("token", "revoked", 199)).toBeUndefined()
    const taken = await Promise.all([store.secrets.take("token", 199), other.secrets.take("token", 199)])
    expect(taken.filter((item) => item !== undefined)).toEqual([bytes])
    expect(await store.secrets.get("token", 199)).toBeUndefined()
    await store.secrets.put("expired", bytes, 100)
    expect(await store.secrets.take("expired", 100)).toBeUndefined()
    await store.secrets.put("removed", bytes, 300)
    await store.secrets.remove("removed")
    await store.secrets.put("durable", bytes, 300)
    await store.dispose()
    const reopened = await open()
    expect(await reopened.secrets.get("removed", 0)).toBeUndefined()
    expect(await reopened.secrets.get("durable", 299)).toEqual(bytes)
    expect((await read(reopened)).snapshot.data).toEqual({ saved: true })
  })
})

test("corporate login reservations are bounded across writers and prune expired installation state", async () => {
  await fixture(async (_directory, open) => {
    const first = (await open()).secrets
    const second = (await open()).secrets
    await first.put("corporate:session:expired", bytes, 100)
    await first.put("separate:session:expired", bytes, 100)
    const issued = await Promise.all(Array.from({ length: 101 }, (_, i) =>
      (i % 2 === 0 ? first : second).issueLogin("corporate", `corporate:login:${i}`, bytes, 100, 200)))
    expect(issued.filter(Boolean)).toHaveLength(100)
    expect(await second.get("corporate:session:expired", 99)).toBeUndefined()
    expect(await second.get("separate:session:expired", 99)).toEqual(bytes)
    expect(await second.issueLogin("separate", "separate:login:new", bytes, 100, 200)).toBe(true)
    expect(await second.issueLogin("corporate", "corporate:login:full", bytes, 199, 300)).toBe(false)
    expect(await second.issueLogin("corporate", "corporate:login:available", bytes, 200, 300)).toBe(true)
    expect(await first.get("corporate:login:available", 200)).toEqual(bytes)
  })
})

test("corporate logout retires live sessions atomically and a stale refresh cannot restore them", async () => {
  await fixture(async (_directory, open) => {
    const first = (await open()).secrets
    const second = (await open()).secrets
    const refreshed = new Uint8Array([3, 0, 255, 8])
    await first.retireSession("corporate:session:unknown", "corporate:revoked:unknown", 100)
    expect(await second.get("corporate:revoked:unknown", 100)).toBeUndefined()
    await first.put("corporate:session:expired", bytes, 100)
    await first.retireSession("corporate:session:expired", "corporate:revoked:expired", 100)
    expect(await second.get("corporate:revoked:expired", 99)).toBeUndefined()

    const key = "corporate:session:live"
    const revoked = "corporate:revoked:live"
    await first.put(key, bytes, 200)
    await second.refreshSession(key, revoked, bytes, refreshed, 100)
    await first.refreshSession(key, revoked, bytes, new Uint8Array([4]), 100)
    expect(await first.getActive(key, revoked, 100)).toEqual(refreshed)
    await Promise.all([first.retireSession(key, revoked, 100), second.refreshSession(key, revoked, refreshed, bytes, 100)])
    expect(await second.get(key, 100)).toBeUndefined()
    expect(await second.get(revoked, 199)).toEqual(new Uint8Array([1]))
    expect(await second.get(revoked, 200)).toBeUndefined()
    expect(await second.getActive(key, revoked, 100)).toBeUndefined()
  })
})

test("blob capabilities expire after callback and dispose drains work while prohibiting new operations", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const leaked = await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => ({ commit: true, value: blobs }))
    await expect(leaked.get("document")).rejects.toThrow()
    await expect(leaked.put("document", bytes, "binary")).rejects.toThrow()
    await expect(leaked.remove("document")).rejects.toThrow()
    const held = barrier()
    const running = store.transaction("dashboard", async (snapshot) => {
      held.ready.resolve()
      await held.release.promise
      snapshot.data.drained = true
      return { commit: true, value: null }
    })
    await held.ready.promise
    const completed: string[] = []
    const disposing = store.dispose().then(() => { completed.push("disposed") })
    try {
      await expect(store.transaction("dashboard", async () => ({ commit: false, value: null }))).rejects.toThrow()
      await expect(store.secrets.get("x", 0)).rejects.toThrow()
      await expect(store.secrets.put("x", bytes, 1)).rejects.toThrow()
      await expect(store.secrets.take("x", 0)).rejects.toThrow()
      await expect(store.secrets.remove("x")).rejects.toThrow()
      expect(completed).toEqual([])
    } finally {
      held.release.resolve()
      await running
      await disposing
    }
    expect((await read(await open())).snapshot.data).toEqual({ drained: true })
  })
})

test("relative and memory paths are rejected before opening storage", async () => {
  await expect(openLocalStore("relative-directory")).rejects.toThrow()
  await expect(openLocalStore(":memory:")).rejects.toThrow()
})

test("an existing accessible directory is rejected without changing its permissions", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await store.dispose()
    await chmod(directory, 0o755)
    await expect(open()).rejects.toThrow()
    expect((await stat(directory)).mode & 0o777).toBe(0o755)
  })
})

test("a corrupt existing SQLite file rejects rather than returning an empty installation", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await store.dispose()
    await Bun.write(join(directory, "installation.sqlite"), "not a SQLite database")
    await expect((async () => read(await open()))()).rejects.toThrow()
  })
})

test("a store with a warm writer rolls back its staged writes if the SQLite file is replaced", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.marker = "original database"
      return { commit: true, value: undefined }
    })
    const file = join(directory, "installation.sqlite")
    const original = join(directory, "original.sqlite")
    const replacement = join(directory, "replacement.sqlite")
    const checkpoint = new Database(file)
    try { checkpoint.exec("PRAGMA wal_checkpoint(TRUNCATE)") }
    finally { checkpoint.close() }
    await link(file, original)
    await writeFile(replacement, "different database file", { mode: 0o600 })
    await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.data.marker = "staged"
      await blobs.put("document", bytes, "application/octet-stream")
      await rename(replacement, file)
      return { commit: true, value: undefined }
    })).rejects.toThrow("Local database identity changed")
    expect(await Bun.file(file).text()).toBe("different database file")
    await rename(original, file)
    await expect(read(store)).rejects.toThrow("Local database identity changed")
    await store.dispose()
    const persisted = await read(await open())
    expect(persisted.snapshot.data.marker).toBe("original database")
    expect(persisted.blob).toBeUndefined()
  })
})

test("corrupt stored snapshot payload rejects before callback instead of synthesizing empty state", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    const db = new Database(join(directory, "installation.sqlite"))
    try {
      db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?)").run("dashboard", '{"data":{}}')
    } finally {
      db.close()
    }
    const calls: string[] = []
    await expect(store.transaction("dashboard", async () => {
      calls.push("unexpected")
      return { commit: true, value: null }
    })).rejects.toThrow()
    expect(calls).toEqual([])
  })
})

test("already aborted transactions never invoke callback", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const controller = new AbortController()
    controller.abort()
    const calls: string[] = []
    await expect(store.transaction("dashboard", async () => {
      calls.push("unexpected")
      return { commit: true, value: null }
    }, { signal: controller.signal })).rejects.toThrow()
    expect(calls).toEqual([])
    expect((await read(store)).snapshot).toEqual(empty)
  })
})

for (const target of ["directory", "ancestor", "database"] as const) {
  test(`rejects ${target} symlinks without creating storage through an alias`, async () => {
    await fixture(async (directory, open) => {
      const parent = join(directory, "..")
      const actual = join(parent, "actual")
      await mkdir(actual, { mode: 0o700 })
      if (target === "database") {
        const store = await open()
        await store.dispose()
        await rm(join(directory, "installation.sqlite"))
        await Bun.write(join(actual, "other.sqlite"), "untouched")
        await chmod(join(actual, "other.sqlite"), 0o600)
        await symlink(join(actual, "other.sqlite"), join(directory, "installation.sqlite"))
        await expect(open()).rejects.toThrow()
        expect(await Bun.file(join(actual, "other.sqlite")).text()).toBe("untouched")
        return
      }
      await symlink(actual, directory, "dir")
      await expect(openLocalStore(target === "ancestor" ? join(directory, "child") : directory)).rejects.toThrow()
      expect(await Bun.file(join(actual, "installation.sqlite")).exists()).toBe(false)
      await expect(stat(join(actual, "child"))).rejects.toThrow()
    })
  })
}

test("creating nested private directories preserves existing parent permissions", async () => {
  await fixture(async (directory) => {
    await mkdir(directory, { mode: 0o755 })
    await chmod(directory, 0o755)
    const store = await openLocalStore(join(directory, "new", "private"))
    try {
      expect((await stat(directory)).mode & 0o777).toBe(0o755)
      expect((await stat(join(directory, "new"))).mode & 0o777).toBe(0o700)
      expect((await stat(join(directory, "new", "private"))).mode & 0o777).toBe(0o700)
    } finally {
      await store.dispose()
    }
  })
})

for (const target of ["directory", "database"] as const) {
  test.skipIf(process.getuid?.() !== 0)(`rejects foreign UID ${target} (requires root fixture privileges)`, async () => {
    await fixture(async (directory, open) => {
      const store = await open()
      await store.dispose()
      const path = target === "directory" ? directory : join(directory, "installation.sqlite")
      await chown(path, 65534, 65534)
      try {
        await expect(open()).rejects.toThrow()
      } finally {
        await chown(path, 0, 0)
      }
    })
  })
}

test("malformed but encodable snapshot rejects before commit and rolls back staged bytes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.versions.invalid = { version: -1, by: "actor" }
      await blobs.put("document", bytes, "binary")
      return { commit: true, value: "must not return" }
    })).rejects.toThrow()
    expect(await read(store)).toEqual({ snapshot: empty, blob: undefined })
  })
})

test("one SQLite store survives a mixed concurrent burst across surfaces, secrets and binary assets without lost or replayed writes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const surfaces = ["dashboard", "planner", "procurement"] as const
    const indices = Array.from({ length: 12 }, (_, index) => index)
    await store.secrets.put("session", bytes, 1000)
    await Promise.all(indices.flatMap((index) => [
      store.secrets.put(`take:${index}`, new Uint8Array([index, 255]), 1000),
      store.secrets.put(`remove:${index}`, bytes, 1000),
    ]))
    const held = barrier()
    const running = store.transaction("dashboard", async () => {
      held.ready.resolve()
      await held.release.promise
      return { commit: false, value: null }
    })
    await held.ready.promise
    const calls: string[] = []
    const operations = indices.flatMap((index) => [
      ...surfaces.map((surface, position) => store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        const key = `asset:${index}`
        calls.push(`${surface}:${index}`)
        // Authentication reads use the same store while the business writer owns its connection.
        expect(await store.secrets.get("session", 999)).toEqual(bytes)
        expect(await store.secrets.get("session", 1000)).toBeUndefined()
        // Await actual BLOB work while holding the transaction, as business asset writes do.
        await blobs.put(key, new Uint8Array([index, position, 255, 0]), "application/octet-stream")
        expect(await blobs.get(key)).toEqual(new Uint8Array([index, position, 255, 0]))
        snapshot.sequences.accepted = (snapshot.sequences.accepted ?? 0) + 1
        snapshot.data[key] = index
        snapshot.versions[key] = { version: 1, by: "local-operator" }
        snapshot.audit.push({ who: "local-operator", at: "2026-11-12", record: key, was: null, became: index })
        return { commit: true, value: key }
      })),
      store.secrets.put(`durable:${index}`, new Uint8Array([index, 128]), 1000),
      store.secrets.get("session", 999).then((value) => { expect(value).toEqual(bytes) }),
      store.secrets.take(`take:${index}`, 999).then((value) => { expect(value).toEqual(new Uint8Array([index, 255])) }),
      store.secrets.remove(`remove:${index}`),
    ])
    const completed = Promise.allSettled(operations)
    try {
      held.release.resolve()
      await running
      const results = await completed
      expect(results.filter((result) => result.status === "rejected")).toEqual([])
      expect(results).toHaveLength(84)
      expect(calls.toSorted()).toEqual(surfaces.flatMap((surface) => indices.map((index) => `${surface}:${index}`)).toSorted())
      await store.dispose()
      const reopened = await open()
      for (const [position, surface] of surfaces.entries()) {
        await reopened.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
          expect(snapshot.sequences.accepted).toBe(12)
          expect(snapshot.audit).toHaveLength(12)
          expect(Object.keys(snapshot.versions)).toHaveLength(12)
          expect(Object.keys(snapshot.data)).toHaveLength(12)
          for (const index of indices) {
            expect(snapshot.data[`asset:${index}`]).toBe(index)
            expect(snapshot.versions[`asset:${index}`]).toEqual({ version: 1, by: "local-operator" })
            expect(await blobs.get(`asset:${index}`)).toEqual(new Uint8Array([index, position, 255, 0]))
          }
          return { commit: false, value: null }
        })
      }
      await Promise.all(indices.map(async (index) => {
        expect(await reopened.secrets.get(`durable:${index}`, 999)).toEqual(new Uint8Array([index, 128]))
        expect(await reopened.secrets.get(`take:${index}`, 999)).toBeUndefined()
        expect(await reopened.secrets.get(`remove:${index}`, 999)).toBeUndefined()
      }))
    } finally {
      held.release.resolve()
      await running
      await completed
    }
  })
}, 15000)

test("dispose drains already admitted mixed operations and cancelled work without admitting late writes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await store.secrets.put("take-before-close", bytes, 1000)
    await store.secrets.put("remove-before-close", bytes, 1000)
    const held = barrier()
    const running = store.transaction("dashboard", async (snapshot) => {
      held.ready.resolve()
      await held.release.promise
      snapshot.data.running = true
      return { commit: true, value: null }
    })
    await held.ready.promise
    const controller = new AbortController()
    const calls: string[] = []
    const cancelled = store.transaction("dashboard", async () => {
      calls.push("cancelled")
      return { commit: true, value: null }
    }, { signal: controller.signal })
    const cancellation = expect(cancelled).rejects.toThrow()
    controller.abort()
    const admitted = Promise.allSettled([
      ...(["dashboard", "planner", "procurement"] as const).map((surface) => store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        calls.push(surface)
        snapshot.data.admitted = true
        await blobs.put("admitted", bytes, "application/octet-stream")
        return { commit: true, value: surface }
      })),
      store.secrets.put("put-before-close", bytes, 1000),
      store.secrets.take("take-before-close", 999),
      store.secrets.remove("remove-before-close"),
    ])
    const drained: string[] = []
    const disposing = store.dispose().then(() => { drained.push("disposed") })
    try {
      await expect(store.transaction("dashboard", async () => {
        calls.push("late")
        return { commit: true, value: null }
      })).rejects.toThrow()
      await expect(store.secrets.put("late-secret", bytes, 1000)).rejects.toThrow()
      expect(drained).toEqual([])
    } finally {
      held.release.resolve()
      await running
      await cancellation
      await admitted
      await disposing
    }
    expect(drained).toEqual(["disposed"])
    expect(calls.toSorted()).toEqual(["dashboard", "planner", "procurement"])
    const results = await admitted
    expect(results.filter((result) => result.status === "rejected")).toEqual([])
    expect(results[4]).toMatchObject({ status: "fulfilled", value: bytes })
    const reopened = await open()
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await reopened.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        expect(snapshot.data).toEqual(surface === "dashboard" ? { running: true, admitted: true } : { admitted: true })
        expect(await blobs.get("admitted")).toEqual(bytes)
        return { commit: false, value: null }
      })
    }
    expect(await reopened.secrets.get("put-before-close", 999)).toEqual(bytes)
    expect(await reopened.secrets.get("take-before-close", 999)).toBeUndefined()
    expect(await reopened.secrets.get("remove-before-close", 999)).toBeUndefined()
    expect(await reopened.secrets.get("late-secret", 999)).toBeUndefined()
  })
}, 15000)

for (const mode of ["abort", "timeout"] as const) {
  test(`same-instance ${mode} before admission never invokes work or lets a later operation overtake its active predecessor`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open({ lockTimeoutMs: 100 })
      const held = barrier()
      const calls: string[] = []
      const running = store.transaction("dashboard", async (snapshot) => {
        calls.push("first")
        held.ready.resolve()
        await held.release.promise
        snapshot.data.first = "committed"
        return { commit: true, value: null }
      })
      await held.ready.promise
      const controller = new AbortController()
      const pending = store.transaction("dashboard", async (snapshot) => {
        calls.push("must not run")
        snapshot.data.cancelled = true
        return { commit: true, value: null }
      }, { signal: controller.signal })
      const rejected = mode === "timeout"
        ? expect(pending).rejects.toThrow("Local storage lock timeout")
        : expect(pending).rejects.toThrow()
      const completions: Promise<unknown>[] = [running, pending]
      try {
        if (mode === "abort") controller.abort()
        await rejected
        expect(calls).toEqual(["first"])
        const third = store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
          calls.push("third")
          expect(snapshot.data).toEqual({ first: "committed" })
          snapshot.data.third = "committed"
          await blobs.put("third", bytes, "application/octet-stream")
          return { commit: true, value: null }
        })
        completions.push(third)
        // Give an incorrectly released waiter a turn while the predecessor is still held.
        await Bun.sleep(10)
        expect(calls).toEqual(["first"])
        held.release.resolve()
        await running
        await third
        expect(calls).toEqual(["first", "third"])
        await store.dispose()
        const reopened = await open()
        await reopened.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
          expect(snapshot.data).toEqual({ first: "committed", third: "committed" })
          expect(await blobs.get("third")).toEqual(bytes)
          return { commit: false, value: null }
        })
      } finally {
        held.release.resolve()
        await Promise.allSettled(completions)
        await rejected
      }
    })
  }, 10000)
}
