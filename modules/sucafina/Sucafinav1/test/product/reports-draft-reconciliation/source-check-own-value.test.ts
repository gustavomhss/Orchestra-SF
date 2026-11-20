import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence, withSfScopedSourceChecks } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"

for (const stage of ["initial", "admitted"] as const) {
  for (const target of ["input", "driver"] as const) {
    test(`source checks reject inherited descriptor value for ${stage} ${target} accessors`, async () => {
      const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-source-own-value-"))
      await chmod(directory, 0o700)
      const store = await openLocalStore(join(directory, "store"))
      try {
        const input = { persistence: store, enumerate: enumerateSfSources, createId: randomUUID,
          projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }
        const source = createSfSourcePersistence(input)
        for (const surface of ["dashboard", "planner", "procurement"] as const) await source.initializeSources(surface)
        if (!store.readSnapshotRoot || !store.currentSnapshots || !source.currentSnapshots)
          throw new Error("Actual local snapshot root and source forwarding unavailable")
        // This is only the lexical source-check identity pin, not UI or source authorization.
        const request = new Request("https://example.test/source-check")
        const binding = { owner: source, request, current: () => !request.signal.aborted }
        const owner = target === "input" ? input : store
        const key = target === "input" ? "persistence" : "currentSnapshots"
        const original = Object.getOwnPropertyDescriptor(owner, key)
        if (!original || !Object.hasOwn(original, "value")) throw new Error("Actual own data dependency unavailable")
        const previous = Object.getOwnPropertyDescriptor(Object.prototype, "value")
        let getterCalls = 0
        const accessor = { configurable: true, enumerable: original.enumerable,
          get: () => { getterCalls++; return original.value } }
        Object.setPrototypeOf(accessor, null)
        const inherited = { value: original.value, configurable: true, writable: true }
        Object.setPrototypeOf(inherited, null)
        type SnapshotSet = ReturnType<NonNullable<typeof store.currentSnapshots>>
        const observed: {
          before?: SnapshotSet
          admitted?: SnapshotSet
          changed?: SnapshotSet
          changedError?: unknown
          restored?: SnapshotSet
          restoredError?: unknown
          scopeError?: unknown
          current?: () => boolean
        } = {}
        // Enter through the raw driver so the source factory is not admitted early.
        await store.readSnapshotRoot(async () => {
          observed.before = store.currentSnapshots!()
          try {
            const checked = await withSfScopedSourceChecks(binding, async () => {
              if (stage === "admitted") observed.admitted = source.currentSnapshots!()
              try {
                // Install the accessor first; descriptor conversion under inherited
                // value would itself be invalid and would not exercise the factory.
                Object.defineProperty(owner, key, accessor)
                Object.defineProperty(Object.prototype, "value", inherited)
                try { observed.changed = source.currentSnapshots!() }
                catch (error) { observed.changedError = error }
              } finally {
                // No await or assertion while the prototype is modified.
                Reflect.deleteProperty(Object.prototype, "value")
                if (previous) Object.defineProperty(Object.prototype, "value", previous)
                Object.defineProperty(owner, key, original)
              }
              if (stage === "admitted") {
                try { observed.restored = source.currentSnapshots!() }
                catch (error) { observed.restoredError = error }
              }
            })
            observed.current = checked.current
          } catch (error) { observed.scopeError = error }
        })
        expect(Object.getOwnPropertyDescriptor(Object.prototype, "value")).toEqual(previous)
        expect(Object.getOwnPropertyDescriptor(owner, key)).toEqual(original)
        if (!observed.before) throw new Error("Actual full snapshot baseline unavailable")
        if (stage === "initial") {
          // Initial opacity keeps the real forwarding path, with no eager getter
          // or stale admission pin left over after the synchronous restoration.
          expect(getterCalls).toBe(1)
          expect(observed.changedError).toBeUndefined()
          expect(observed.changed).toEqual(observed.before)
          expect(observed.changed).not.toBe(observed.before)
          expect(observed.scopeError).toBeUndefined()
          expect(observed.current?.()).toBe(true)
        } else {
          expect(observed.admitted).toEqual(observed.before)
          expect(observed.admitted).not.toBe(observed.before)
          expect(getterCalls).toBe(0)
          expect(observed.changed).toBeUndefined()
          expect(observed.restored).toBeUndefined()
          for (const error of [observed.changedError, observed.restoredError, observed.scopeError]) {
            expect(error).toBeInstanceOf(Error)
            if (!(error instanceof Error)) throw new Error("Expected actual source-check refusal")
            expect(error.message).toBe("SF_SOURCE_CHECK_SCOPE_CLOSED")
          }
          expect(observed.current).toBeUndefined()
        }
        // Cleanup permits a genuinely new root and source scope to read afresh.
        const fresh = await store.readSnapshotRoot(async () =>
          withSfScopedSourceChecks(binding, async () => source.currentSnapshots!()))
        expect(fresh.value).toEqual(observed.before)
        expect(fresh.value).not.toBe(observed.before)
        expect(fresh.current()).toBe(true)
      } finally {
        await store.dispose()
        await rm(directory, { recursive: true, force: true })
      }
    })
  }
}
