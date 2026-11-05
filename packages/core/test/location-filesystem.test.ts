import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Layer, Stream } from "effect"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { FileSystem } from "@orchestra/core/filesystem"
import { FSUtil } from "@orchestra/core/fs-util"
import { Location } from "@orchestra/core/location"
import { AbsolutePath, RelativePath } from "@orchestra/core/schema"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const provide = (directory: string) =>
  Effect.provide(
    LayerNode.compile(FileSystem.node, [
      [
        Location.node,
        Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make(directory) }))),
      ],
    ]),
  )

const withTmp = <A, E, R>(f: (directory: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(Effect.flatMap((tmp) => f(tmp.path)))

const provideBoundary = (directory: string, decorate: (actual: FSUtil.Interface) => FSUtil.Interface) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const actual = yield* FSUtil.Service
      return yield* effect.pipe(
        Effect.provide(
          LayerNode.compile(FileSystem.node, [
            [FSUtil.node, Layer.succeed(FSUtil.Service, FSUtil.Service.of(decorate(actual)))],
            [
              Location.node,
              Layer.succeed(Location.Service, Location.Service.of(location({ directory: AbsolutePath.make(directory) }))),
            ],
          ]),
        ),
      )
    }).pipe(Effect.provide(LayerNode.compile(FSUtil.node)))

describe("FileSystem", () => {
  it.live("reads text and binary files", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "text.txt"), "hello"))
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "data.bin"), Buffer.from([0, 1, 2])))
        const service = yield* FileSystem.Service
        const text = yield* service.read({ path: RelativePath.make("text.txt") })
        const binary = yield* service.read({ path: RelativePath.make("data.bin") })
        expect(new TextDecoder().decode(text.content)).toBe("hello")
        expect(text.mime).toBe("text/plain")
        expect(binary.content).toEqual(new Uint8Array([0, 1, 2]))
        expect(binary.mime).toBe("application/octet-stream")
      }).pipe(provide(directory)),
    ),
  )

  it.live("bounds consumed bytes when a file grows after stat and finalizes on rejection", () =>
    withTmp((directory) => {
      const observed = { grew: false, requested: 0, consumed: 0, finalized: 0 }
      return Effect.gen(function* () {
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "growing.bin"), "small"))
        const service = yield* FileSystem.Service
        const error = yield* service.read({ path: RelativePath.make("growing.bin") }).pipe(Effect.flip)
        expect(error).toBeInstanceOf(FileSystem.PathError)
        expect(error.reason).toBe("too-large")
        expect(error.path).toBe("growing.bin")
        expect(observed.grew).toBe(true)
        expect(observed.requested).toBe(FileSystem.READ_LIMIT + 1)
        expect(observed.consumed).toBe(FileSystem.READ_LIMIT + 1)
        expect(observed.finalized).toBe(1)
      }).pipe(
        provideBoundary(directory, (actual) => ({
          ...actual,
          stat: (target) =>
            actual.stat(target).pipe(
              Effect.tap((info) =>
                Effect.promise(async () => {
                  expect(target).toBe(await fs.realpath(path.join(directory, "growing.bin")))
                  expect(Number(info.size)).toBe(5)
                  await fs.truncate(target, FileSystem.READ_LIMIT + 10_000)
                  observed.grew = true
                }),
              ),
            ),
          stream: (target, options) => {
            observed.requested = Number(options?.bytesToRead ?? 0)
            return actual.stream(target, options).pipe(
              Stream.tap((chunk) =>
                Effect.sync(() => {
                  observed.consumed += chunk.byteLength
                }),
              ),
              Stream.ensuring(Effect.sync(() => {
                observed.finalized += 1
              })),
            )
          },
        })),
      )
    }),
  )

  it.live("reads the exact limit and empty files, finalizes success, and rejects known oversize before streaming", () =>
    withTmp((directory) => {
      const observed = { streams: 0, finalized: 0 }
      return Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await fs.writeFile(path.join(directory, "boundary.bin"), new Uint8Array([17]))
          await fs.truncate(path.join(directory, "boundary.bin"), FileSystem.READ_LIMIT)
          const handle = await fs.open(path.join(directory, "boundary.bin"), "r+")
          try {
            await handle.write(new Uint8Array([239]), 0, 1, FileSystem.READ_LIMIT - 1)
          } finally {
            await handle.close()
          }
          await fs.writeFile(path.join(directory, "empty.txt"), "")
          await fs.writeFile(path.join(directory, "oversize.bin"), "")
          await fs.truncate(path.join(directory, "oversize.bin"), FileSystem.READ_LIMIT + 1)
        })
        const service = yield* FileSystem.Service
        const boundary = yield* service.read({ path: RelativePath.make("boundary.bin") })
        expect(boundary.content.byteLength).toBe(FileSystem.READ_LIMIT)
        expect(boundary.content[0]).toBe(17)
        expect(boundary.content[FileSystem.READ_LIMIT - 1]).toBe(239)
        expect(boundary.mime).toBe("application/octet-stream")
        expect(observed.finalized).toBe(1)
        const empty = yield* service.read({ path: RelativePath.make("empty.txt") })
        expect(empty.content).toEqual(new Uint8Array(0))
        expect(empty.mime).toBe("text/plain")
        expect(observed.finalized).toBe(2)
        const error = yield* service.read({ path: RelativePath.make("oversize.bin") }).pipe(Effect.flip)
        expect(error).toBeInstanceOf(FileSystem.PathError)
        expect(error.reason).toBe("too-large")
        expect(error.path).toBe("oversize.bin")
        expect(observed.streams).toBe(2)
        expect(observed.finalized).toBe(2)
      }).pipe(
        provideBoundary(directory, (actual) => ({
          ...actual,
          stream: (target, options) => {
            observed.streams += 1
            return actual.stream(target, options).pipe(
              Stream.ensuring(Effect.sync(() => {
                observed.finalized += 1
              })),
            )
          },
        })),
      )
    }),
  )

  it.live("joins stream finalization when a read is cancelled after its first chunk", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const firstChunk = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const observed = { consumed: 0, finalized: 0, returned: false }
        yield* Effect.promise(async () => {
          await fs.writeFile(path.join(directory, "cancel.bin"), "")
          await fs.truncate(path.join(directory, "cancel.bin"), FileSystem.READ_LIMIT)
        })
        yield* Effect.gen(function* () {
          const service = yield* FileSystem.Service
          const fiber = yield* service.read({ path: RelativePath.make("cancel.bin") }).pipe(
            Effect.tap(() => Effect.sync(() => {
              observed.returned = true
            })),
            Effect.forkScoped,
          )
          yield* Deferred.await(firstChunk)
          expect(observed.consumed).toBeGreaterThan(0)
          expect(observed.finalized).toBe(0)
          yield* Fiber.interrupt(fiber)
          const exit = yield* Fiber.await(fiber)
          expect(Exit.hasInterrupts(exit)).toBe(true)
          expect(observed.finalized).toBe(1)
          expect(observed.returned).toBe(false)
        }).pipe(
          provideBoundary(directory, (actual) => ({
            ...actual,
            stream: (target, options) =>
              actual.stream(target, options).pipe(
                Stream.tap((chunk) => Effect.gen(function* () {
                  observed.consumed += chunk.byteLength
                  yield* Deferred.succeed(firstChunk, undefined)
                  yield* Deferred.await(release)
                })),
                // This observes stream lifetime, not an OS descriptor count.
                Stream.ensuring(Effect.sync(() => {
                  observed.finalized += 1
                })),
              ),
          })),
        )
      }),
    ),
  )

  it.live("lists direct children", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(directory, "src")))
        yield* Effect.promise(() => fs.writeFile(path.join(directory, "README.md"), "# Test"))
        const entries = yield* (yield* FileSystem.Service).list()
        expect(entries.map((entry) => ({ path: entry.path, type: entry.type }))).toEqual([
          { path: RelativePath.make("src" + path.sep), type: "directory" },
          { path: RelativePath.make("README.md"), type: "file" },
        ])
      }).pipe(provide(directory)),
    ),
  )

  it.live("rejects lexical escapes", () =>
    withTmp((directory) =>
      Effect.gen(function* () {
        const result = yield* (yield* FileSystem.Service)
          .read({ path: RelativePath.make("../outside.txt") })
          .pipe(Effect.exit)
        expect(Exit.isFailure(result)).toBe(true)
      }).pipe(provide(directory)),
    ),
  )
})
