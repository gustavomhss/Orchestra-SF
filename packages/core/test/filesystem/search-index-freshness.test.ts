import { describe, expect } from "bun:test"
import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect"
import { TestClock } from "effect/testing"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import "@orchestra/core/filesystem"
import { FileSystemSearch } from "@orchestra/core/filesystem/search"
import { FSUtil } from "@orchestra/core/fs-util"
import { Location } from "@orchestra/core/location"
import { Ripgrep } from "@orchestra/core/ripgrep"
import { AbsolutePath, RelativePath } from "@orchestra/core/schema"
import { FileSystem } from "@orchestra/core/filesystem"
import { location } from "../fixture/location"
import { it } from "../lib/effect"

const setup = (find: Ripgrep.Interface["find"]) =>
  FileSystemSearch.ripgrepLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(Ripgrep.Service, Ripgrep.Service.of({ find, glob: () => Effect.die("unused"), grep: () => Effect.die("unused") })),
        LayerNode.compile(FSUtil.node),
        Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make("/project") }))),
      ),
    ),
  )

describe("ripgrep fallback index freshness", () => {
  it.effect("reuses a fresh index and replaces files and directories at the threshold", () =>
    Effect.gen(function* () {
      const scans = { count: 0, paths: ["old/needle.ts"] }
      const layer = setup((input) => Effect.gen(function* () {
        scans.count++
        yield* Effect.forEach(scans.paths, (path) => input.onEntry!(FileSystem.Entry.make({ path: RelativePath.make(path), type: "file" })))
        return []
      }))
      const service = Context.get(yield* Layer.build(layer), FileSystemSearch.Service)
      expect((yield* service.find({ query: "needle" })).map((entry) => entry.path)).toEqual([RelativePath.make("old/needle.ts")])
      scans.paths = ["new/needle.ts"]
      yield* TestClock.adjust("1999 millis")
      expect((yield* service.find({ query: "needle" })).map((entry) => entry.path)).toEqual([RelativePath.make("old/needle.ts")])
      expect(scans.count).toBe(1)
      yield* TestClock.adjust("1 millis")
      expect((yield* service.find({ query: "needle" })).map((entry) => entry.path)).toEqual([RelativePath.make("new/needle.ts")])
      expect((yield* service.find({ query: "old", type: "directory" }))).toEqual([])
      expect((yield* service.find({ query: "new", type: "directory" })).map((entry) => entry.path)).toEqual([RelativePath.make("new/")])
      expect(scans.count).toBe(2)
    }),
  )

  it.effect("concurrent stale searches share a held refresh", () =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const scans = { count: 0 }
      const layer = setup((input) => Effect.gen(function* () {
        scans.count++
        if (scans.count === 2) {
          yield* Deferred.succeed(entered, undefined)
          yield* Deferred.await(release)
        }
        yield* input.onEntry!(FileSystem.Entry.make({ path: RelativePath.make(scans.count === 1 ? "old.ts" : "new.ts"), type: "file" }))
        return []
      }))
      const service = Context.get(yield* Layer.build(layer), FileSystemSearch.Service)
      yield* service.find({ query: "old" })
      yield* TestClock.adjust("2 seconds")
      yield* Effect.gen(function* () {
        const first = yield* service.find({ query: ".ts" }).pipe(Effect.forkScoped)
        yield* Deferred.await(entered)
        const second = yield* service.find({ query: ".ts" }).pipe(Effect.forkScoped)
        yield* Effect.yieldNow
        expect(first.pollUnsafe()).toBeUndefined()
        expect(second.pollUnsafe()).toBeUndefined()
        expect(scans.count).toBe(2)
        yield* Deferred.succeed(release, undefined)
        expect((yield* Fiber.join(first)).map((entry) => entry.path)).toEqual([RelativePath.make("new.ts")])
        expect((yield* Fiber.join(second)).map((entry) => entry.path)).toEqual([RelativePath.make("new.ts")])
        expect(scans.count).toBe(2)
      }).pipe(Effect.ensuring(Deferred.succeed(release, undefined)))
    }),
  )

  it.effect("refreshes a successful empty index", () =>
    Effect.gen(function* () {
      const scans = { count: 0 }
      const service = Context.get(yield* Layer.build(setup(() => Effect.sync(() => { scans.count++; return [] }))), FileSystemSearch.Service)
      expect(yield* service.find({ query: "anything" })).toEqual([])
      yield* TestClock.adjust("1999 millis")
      expect(yield* service.find({ query: "anything" })).toEqual([])
      expect(scans.count).toBe(1)
      yield* TestClock.adjust("1 millis")
      expect(yield* service.find({ query: "anything" })).toEqual([])
      expect(scans.count).toBe(2)
    }),
  )

  it.effect("reports a failed refresh and retries on the next search", () =>
    Effect.gen(function* () {
      const scans = { count: 0 }
      const service = Context.get(yield* Layer.build(setup((input) => Effect.gen(function* () {
        scans.count++
        if (scans.count === 2) return yield* Effect.fail(new Ripgrep.Error({ message: "scan failed" }))
        yield* input.onEntry!(FileSystem.Entry.make({ path: RelativePath.make(scans.count === 1 ? "old.ts" : "new.ts"), type: "file" }))
        return []
      }))), FileSystemSearch.Service)
      yield* service.find({ query: "old" })
      yield* TestClock.adjust("2 seconds")
      const result = yield* Effect.flip(service.find({ query: ".ts" }))
      expect(result._tag).toBe("FileSystem.SearchError")
      expect(result.message).toBe("scan failed")
      expect((yield* service.find({ query: ".ts" })).map((entry) => entry.path)).toEqual([RelativePath.make("new.ts")])
      expect(scans.count).toBe(3)
    }),
  )

  it.effect("acquires without waiting and interrupts the initial scan when its owner closes", () =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const interrupted = yield* Deferred.make<void>()
      const scope = yield* Effect.acquireRelease(Scope.make(), (scope, exit) => Scope.close(scope, exit))
      yield* Effect.gen(function* () {
        const layer = setup(() => Deferred.succeed(entered, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
          Effect.as([]),
        ))
        yield* Layer.build(layer).pipe(Effect.provideService(Scope.Scope, scope))
        yield* Deferred.await(entered)
        yield* Scope.close(scope, Exit.void)
        yield* Deferred.await(interrupted)
      }).pipe(Effect.ensuring(Deferred.succeed(release, undefined)))
    }),
  )
})
