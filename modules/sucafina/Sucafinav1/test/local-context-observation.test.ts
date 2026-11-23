import { afterEach, expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import path from "node:path"
import { createLocalInstallation } from "../local/entry.ts"
import { loadLocalConfiguration, prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { currentLocalReadonlyAuthorityData, hasLocalSnapshotScope } from "../runtime/local-store.ts"
import { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions } from "../product/decisions/current-choice-preview.ts"
import type { CreateSfHostRuntime } from "../product/contracts/host-context.ts"
import type { Persistence } from "../runtime/contract.ts"
import { createSfLiveContext, type SfLiveOperationalObservation } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

type NativeInput = Parameters<CreateSfHostRuntime>[0]
async function withNative(work: (input: NativeInput, driver: Persistence) => Promise<void>) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-context-observation-"))
  directories.push(root)
  const file = await prepareLocalConfiguration(root)
  const loaded = await loadLocalConfiguration(file)
  await Bun.write(file, JSON.stringify({
    ...loaded.config, authentication: "local-operator",
    localOperator: { installationId: "12ec06d9-4201-4370-a3e9-e9a72f213dc9", uid: userInfo().uid },
  }))
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  let driver: Persistence | undefined
  let entered = 0
  const finished = new Error("Native context observation control completed")
  await expect(createLocalInstallation({
    origin: loaded.config.origin,
    createCurrentChoiceFence: (input) => {
      driver = input.persistence
      return createCurrentChoiceFence(input)
    },
    currentChoiceOwnsSnapshotTransactions,
    createHostRuntime: async (input) => {
      entered++
      if (!driver) throw new Error("Native driver was not captured")
      expect(typeof input.contextObservation).toBe("function")
      await work(input, driver)
      throw finished
    },
  }, file, environment)).rejects.toBe(finished)
  expect(entered).toBe(1)
}

function context(input: NativeInput) {
  const binding = Object.freeze({ installationId: input.installationId, projectId: "context-project", hostId: "context-host" })
  const stamp = Object.freeze({ ...binding, principalRef: "person", policyVersion: "policy", accessRevision: "revision" })
  const query = new URLSearchParams(binding)
  const request = new Request(input.origin + input.mount + "/api/ui/context?" + query)
  const admitted = {
    status: "ok", stamp, authMode: "local-operator", destinations: [{
      capabilityId: "CAP27", surface: "procurement", page: "Suppliers", canRead: true, allowedActionIds: ["save"],
    }],
  } as const
  return { binding, stamp, request, admitted }
}

const observations = [
  { operationId: "files.asset.link", state: "ready", reason: null, operational: true },
  { operationId: "files.asset.download", state: "ready", reason: null, operational: true },
] as const satisfies readonly SfLiveOperationalObservation[]

function barrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test("the installed context owner preserves payload and uses two fresh native roots with all admissions outside", async () => {
  await withNative(async (input, driver) => {
    const f = context(input)
    const roots: object[] = []
    const bytes: object[] = []
    const values: unknown[] = []
    const retained: (() => boolean)[] = []
    let scoped = false
    let admits = 0
    let reads = 0
    const source = {
      origin: input.origin, mount: input.mount, currentBinding: () => f.binding,
      admit: async (request: Request) => {
        expect(request).toBe(f.request)
        expect(hasLocalSnapshotScope(driver)).toBe(false)
        admits++
        if (scoped && admits === 2) await input.persistence.transaction("dashboard", async (snapshot) => {
          snapshot.data.contextObservationProbe = "fresh second pass"
          return { commit: true, value: undefined }
        })
        return f.admitted
      },
      operational: async (request: Request) => {
        expect(request).toBe(f.request)
        reads++
        const metadata = driver.currentSnapshotScope?.()
        const native = currentLocalReadonlyAuthorityData(driver, [])
        if (scoped) {
          expect(metadata?.readOnly).toBe(true)
          expect(metadata?.poisoned).toBe(false)
          expect(metadata?.bytesIdentity).toBeDefined()
          expect(native?.scope?.identity).toBe(metadata?.identity)
          expect(native?.current("unpoisoned")).toBe(true)
          roots.push(metadata!.identity)
          bytes.push(metadata!.bytesIdentity!)
          retained.push(() => native!.current("unpoisoned"))
          const detached = driver.currentSnapshot?.("dashboard")
          expect(detached).toBeDefined()
          detached!.data.contextObservationProbe = "discarded copy"
        } else {
          expect(metadata).toBeUndefined()
          expect(native).toBeUndefined()
        }
        values.push(await input.persistence.transaction("dashboard", async (snapshot) => {
          if (scoped) {
            const child = driver.currentSnapshotScope?.()
            expect(child?.identity).toBe(metadata?.identity)
            expect(child?.bytesIdentity).toBe(metadata?.bytesIdentity)
            expect(child?.readOnly).toBe(true)
            expect(child?.poisoned).toBe(false)
          }
          return { commit: false, value: snapshot.data.contextObservationProbe }
        }))
        if (scoped) expect(native!.current("unpoisoned")).toBe(true)
        return structuredClone(observations)
      },
    }
    const canonical = await createSfLiveContext(source).readContext(f.request, f.binding)
    expect(canonical.status).toBe("ok")
    expect({ admits, reads }).toEqual({ admits: 3, reads: 2 })
    expect(values).toEqual([undefined, undefined])
    admits = 0
    reads = 0
    values.splice(0)
    scoped = true
    const observed = await createSfLiveContext({ ...source, contextObservation: input.contextObservation }).readContext(f.request, f.binding)
    expect(observed).toEqual(canonical)
    expect({ admits, reads }).toEqual({ admits: 3, reads: 2 })
    expect(values).toEqual([undefined, "fresh second pass"])
    expect(roots).toHaveLength(2)
    expect(new Set(roots).size).toBe(2)
    expect(bytes).toHaveLength(2)
    expect(bytes[0]).not.toBe(bytes[1])
    expect(hasLocalSnapshotScope(driver)).toBe(false)
    expect(driver.currentSnapshotScope?.()).toBeUndefined()
    for (const current of retained) expect(current).toThrow()
  })
}, 15000)

test("a live inherited native read or writable owner keeps its canonical context path and identity", async () => {
  await withNative(async (input, driver) => {
    const f = context(input)
    const check = async (readOnly: boolean) => {
      const parent = driver.currentSnapshotScope?.()
      expect(parent?.readOnly).toBe(readOnly)
      expect(parent?.poisoned).toBe(false)
      let admits = 0
      let reads = 0
      const source = {
        origin: input.origin, mount: input.mount, currentBinding: () => f.binding,
        admit: async () => { admits++; expect(driver.currentSnapshotScope?.()?.identity).toBe(parent?.identity); return f.admitted },
        operational: async () => {
          reads++
          const before = driver.currentSnapshotScope?.()
          expect(before?.identity).toBe(parent?.identity)
          expect(before?.bytesIdentity).toBe(parent?.bytesIdentity)
          expect(before?.readOnly).toBe(readOnly)
          await input.persistence.transaction("dashboard", async () => {
            expect(driver.currentSnapshotScope?.()?.identity).toBe(parent?.identity)
            return { commit: false, value: undefined }
          })
          expect(driver.currentSnapshotScope?.()?.identity).toBe(parent?.identity)
          return structuredClone(observations)
        },
      }
      const canonical = await createSfLiveContext(source).readContext(f.request, f.binding)
      expect(canonical.status).toBe("ok")
      const observed = await createSfLiveContext({ ...source, contextObservation: input.contextObservation }).readContext(f.request, f.binding)
      expect(observed).toEqual(canonical)
      expect({ admits, reads }).toEqual({ admits: 6, reads: 4 })
      expect(driver.currentSnapshotScope?.()?.identity).toBe(parent?.identity)
    }
    await driver.readSnapshotRoot!(async () => check(true))
    await driver.transaction("dashboard", async () => { await check(false); return { commit: false, value: undefined } })
    expect(hasLocalSnapshotScope(driver)).toBe(false)
  })
}, 15000)

test("native context observations preserve poison, abort and original Request identity without replay", async () => {
  await withNative(async (input, driver) => {
    const observe = input.contextObservation!
    const f = context(input)
    let reads = 0
    expect(await observe(f.request, async () => {
      reads++
      await driver.transaction("dashboard", async (snapshot) => {
        snapshot.data.contextObservationPoison = true
        return { commit: true, value: undefined }
      }).catch(() => undefined)
    })).toBe(false)
    expect(reads).toBe(1)
    expect(await driver.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.contextObservationPoison }))).toBeUndefined()

    let refused = 0
    await expect(driver.readSnapshotRoot!(async () => {
      await driver.transaction("dashboard", async () => ({ commit: true, value: undefined })).catch(() => undefined)
      expect(await observe(f.request, async () => { refused++ })).toBe(false)
      expect(refused).toBe(0)
    })).rejects.toThrow("Nested local write attempted")

    const controller = new AbortController()
    const aborted = new Request(f.request, { signal: controller.signal })
    reads = 0
    expect(await observe(aborted, async () => { reads++; controller.abort() })).toBe(false)
    expect(reads).toBe(1)
    reads = 0
    expect(await observe(aborted, async () => { reads++ })).toBe(false)
    expect(reads).toBe(0)

    const changed = new Request(f.request)
    expect(await observe(changed, async () => { reads++; changed.headers.set("x-context-probe", "changed") })).toBe(false)
    expect(reads).toBe(1)
    expect(hasLocalSnapshotScope(driver)).toBe(false)
  })
}, 15000)

test("native reader substitution is rejected before invocation, including inherited egress getters", async () => {
  await withNative(async (input, driver) => {
    const f = context(input)
    const observe = input.contextObservation!
    const methods = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction", "transactionAll", "readSnapshotRoot", "currentSnapshotScope"] as const
    for (const name of methods) {
      const descriptor = Object.getOwnPropertyDescriptor(driver, name)
      expect(descriptor).toBeDefined()
      let replacement = 0
      let reads = 0
      Object.defineProperty(driver, name, { ...descriptor, value: () => { replacement++; throw new Error("Replacement must not run") } })
      try {
        expect(await observe(f.request, async () => { reads++ })).toBe(false)
        expect(reads).toBe(0)
        expect(replacement).toBe(0)
      } finally { Object.defineProperty(driver, name, descriptor!) }
    }
    const descriptor = Object.getOwnPropertyDescriptor(driver, "currentSnapshotScope")!
    let getterCalls = 0
    let reads = 0
    await driver.readSnapshotRoot!(async () => {
      try {
        expect(await observe(f.request, async () => {
          reads++
          Object.defineProperty(driver, "currentSnapshotScope", {
            configurable: true, get() { getterCalls++; throw new Error("Changed metadata getter must not run") },
          })
        })).toBe(false)
        expect(reads).toBe(1)
        expect(getterCalls).toBe(0)
      } finally { Object.defineProperty(driver, "currentSnapshotScope", descriptor) }
    })
    expect(hasLocalSnapshotScope(driver)).toBe(false)
  })
}, 15000)

test("native context owners reject pending children and callbacks inherited from a closed child", async () => {
  await withNative(async (input, driver) => {
    const f = context(input)
    const observe = input.contextObservation!
    const entered = barrier()
    const release = barrier()
    let pending: Promise<unknown> | undefined
    let reads = 0
    try {
      expect(await observe(f.request, async () => {
        reads++
        pending = driver.transaction("dashboard", async () => {
          entered.release()
          await release.promise
          return { commit: false, value: undefined }
        })
        void pending.catch(() => undefined)
        await entered.promise
      })).toBe(false)
      expect(reads).toBe(1)
    } finally {
      release.release()
      if (pending) await expect(pending).rejects.toThrow()
    }
    expect(hasLocalSnapshotScope(driver)).toBe(false)

    const closed = barrier()
    let inherited: Promise<boolean> | undefined
    reads = 0
    await driver.readSnapshotRoot!(async () => {
      const parent = driver.currentSnapshotScope?.()
      try {
        await driver.transaction("dashboard", async () => {
          inherited = closed.promise.then(() => observe(f.request, async () => { reads++ }))
          return { commit: false, value: undefined }
        })
        closed.release()
        expect(await inherited).toBe(false)
        expect(reads).toBe(0)
        expect(driver.currentSnapshotScope?.()?.identity).toBe(parent?.identity)
      } finally { closed.release() }
    })
    expect(hasLocalSnapshotScope(driver)).toBe(false)
  })
}, 15000)
