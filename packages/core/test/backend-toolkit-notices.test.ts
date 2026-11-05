import { expect } from "bun:test"
import path from "path"
import { createHash } from "crypto"
import { access, lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { Effect } from "effect"
import { BackendToolkit } from "../src/backend-toolkit"
import type { NativeEngine } from "../src/backend-toolkit/manifest"
import { PinnedArtifact } from "../src/pinned-artifact"
import { detect, type TargetId } from "../src/backend-toolkit/target"
import { it } from "./lib/effect"

const BINARY = new Uint8Array([0x00, 0x01, 0xff, 0x10])
const LICENSE = "Copyright fixture\nThird-party notices stay plaintext.\n"
const TARGETS = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"] as const

const fixture = Effect.gen(function* () {
  const root = yield* Effect.acquireRelease(
    Effect.promise(async () => realpath(await mkdtemp(path.join(tmpdir(), "native-notices-")))),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  )
  const hits: Record<string, number> = {}
  const files = new Map<string, Uint8Array>([
    ["/tool", BINARY],
    ["/license.txt", new TextEncoder().encode(LICENSE)],
  ])
  const server = yield* Effect.acquireRelease(
    Effect.sync(() => Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        const pathname = new URL(request.url).pathname
        hits[pathname] = (hits[pathname] ?? 0) + 1
        await Bun.sleep(100)
        const body = files.get(pathname)
        return body ? new Response(body) : new Response("missing", { status: 404 })
      },
    })),
    (server) => Effect.promise(() => server.stop(true)),
  )
  return { root, hits, server }
})

function host() {
  const detected = detect()
  if (!("target" in detected)) throw new Error(`BLOCKED: test host has no toolkit target: ${detected.unsupported}`)
  return detected.target
}

function engine(id: string, version: string, port: number, notices?: NativeEngine["notices"]): NativeEngine {
  const artifact = {
    url: `http://127.0.0.1:${port}/tool`,
    integrity: `sha256-${createHash("sha256").update(BINARY).digest("base64")}` as const,
    format: "raw" as const,
    entries: [{ from: "tool", to: "tool", executable: true }],
  }
  const targets = Object.fromEntries(TARGETS.map((target) => [target, { artifact, executable: "tool" }])) as NativeEngine["targets"]
  return { id, version, license: "MIT", upstream: "fixture/engine", targets, ...(notices ? { notices } : {}) }
}

function notice(port: number, filename = "license.txt", integrity?: `sha256-${string}`): NonNullable<NativeEngine["notices"]>[number] {
  return {
    url: `http://127.0.0.1:${port}/license.txt`,
    integrity: integrity ?? (`sha256-${createHash("sha256").update(LICENSE).digest("base64")}` as const),
    filename,
  }
}

const scoped = (root: string, manifest: Record<string, NativeEngine>) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    self.pipe(Effect.provideService(BackendToolkit.Root, root), Effect.provideService(BackendToolkit.Manifest, manifest))

const present = (file: string) => Effect.promise(() => access(file).then(() => true, () => false))

function installDir(root: string, id: string, version: string, target: TargetId) {
  return path.join(root, "engines", id, `${version}-${target}`)
}

it.live("a native install publishes the binary and notice together, and concurrent ensures fetch each artifact once", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const target = host()
    const manifest = { buf: engine("buf", "1", f.server.port, [notice(f.server.port)]) }
    const run = scoped(f.root, manifest)
    const directory = installDir(f.root, "buf", "1", target)
    const [first, second] = yield* Effect.all([
      BackendToolkit.ensure("buf").pipe(run),
      BackendToolkit.ensure("buf").pipe(run),
    ], { concurrency: 2 })
    expect(first).toEqual({ executable: path.join(directory, "tool") })
    expect(second).toEqual(first)
    expect(yield* PinnedArtifact.installed(directory)).toBe(true)
    expect(yield* Effect.promise(() => readFile(path.join(directory, "notices", "license.txt"), "utf8"))).toBe(LICENSE)
    expect(yield* Effect.promise(() => readFile(path.join(directory, "tool")))).toEqual(BINARY)
    expect(f.hits["/tool"]).toBe(1)
    expect(f.hits["/license.txt"]).toBe(1)
    expect(yield* BackendToolkit.status("buf").pipe(run)).toEqual([
      { engine: "buf", version: "1", target, status: "ready", directory, executable: path.join(directory, "tool") },
    ])
  }), 30_000,
)

it.live("a wrong notice hash publishes no install and no completion marker", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const target = host()
    const bad = `sha256-${createHash("sha256").update("other-license").digest("base64")}` as const
    const manifest = { buf: engine("buf", "1", f.server.port, [notice(f.server.port, "license.txt", bad)]) }
    const failed = yield* BackendToolkit.ensure("buf").pipe(scoped(f.root, manifest), Effect.flip)
    const directory = installDir(f.root, "buf", "1", target)
    expect(failed.reason).toBe("toolkit-not-ready:failed:buf:integrity-mismatch")
    expect(yield* PinnedArtifact.installed(directory)).toBe(false)
    expect(yield* present(directory)).toBe(false)
    expect(yield* present(path.join(directory, ".complete"))).toBe(false)
    expect(yield* present(path.join(directory, "notices", "license.txt"))).toBe(false)
  }), 30_000,
)

it.live("a missing or modified notice stays not ready and the completed install is not rewritten", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const target = host()
    const noticed = (id: string) => engine(id, "1", f.server.port, [notice(f.server.port)])
    const run = scoped(f.root, { buf: noticed("buf"), sqlc: noticed("sqlc") })
    yield* BackendToolkit.ensure("buf").pipe(run)
    yield* BackendToolkit.ensure("sqlc").pipe(run)
    const missingDir = installDir(f.root, "buf", "1", target)
    const modifiedDir = installDir(f.root, "sqlc", "1", target)
    const fetches = f.hits["/license.txt"]
    yield* Effect.promise(() => rm(path.join(missingDir, "notices", "license.txt")))
    expect((yield* BackendToolkit.status("buf").pipe(run))[0]?.status).toBe("absent")
    const missing = yield* BackendToolkit.ensure("buf").pipe(run, Effect.flip)
    expect(missing.reason).toBe("toolkit-not-ready:failed:buf:notice-missing")
    expect(yield* PinnedArtifact.installed(missingDir)).toBe(true)
    yield* Effect.promise(() => writeFile(path.join(modifiedDir, "notices", "license.txt"), "changed license\n"))
    expect((yield* BackendToolkit.status("sqlc").pipe(run))[0]?.status).toBe("absent")
    const modified = yield* BackendToolkit.ensure("sqlc").pipe(run, Effect.flip)
    expect(modified.reason).toBe("toolkit-not-ready:failed:sqlc:notice-modified")
    expect(yield* PinnedArtifact.installed(modifiedDir)).toBe(true)
    expect(f.hits["/license.txt"]).toBe(fetches)
  }), 30_000,
)

it.live.skipIf(process.platform === "win32")("a symlinked notice is not ready", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const target = host()
    const run = scoped(f.root, { buf: engine("buf", "1", f.server.port, [notice(f.server.port)]) })
    yield* BackendToolkit.ensure("buf").pipe(run)
    const directory = installDir(f.root, "buf", "1", target)
    const noticeFile = path.join(directory, "notices", "license.txt")
    const outside = path.join(f.root, "other-license.txt")
    yield* Effect.promise(async () => {
      await writeFile(outside, LICENSE)
      await rm(noticeFile)
      await symlink(outside, noticeFile)
    })
    expect((yield* Effect.promise(() => lstat(noticeFile))).isSymbolicLink()).toBe(true)
    expect((yield* BackendToolkit.status("buf").pipe(run))[0]?.status).toBe("absent")
    const failed = yield* BackendToolkit.ensure("buf").pipe(run, Effect.flip)
    expect(failed.reason).toBe("toolkit-not-ready:failed:buf:notice-symlink")
    expect(yield* PinnedArtifact.installed(directory)).toBe(true)
  }), 30_000,
)

it.live("malformed notice metadata fails before any fetch and leaves the cache untouched", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const cases = [
      [notice(f.server.port, "License.txt")],
      [notice(f.server.port, "../license.txt")],
      [notice(f.server.port, "notices/license.txt")],
      [notice(f.server.port), notice(f.server.port)],
      [notice(f.server.port, "license.txt", "sha256-not-a-digest")],
      [{ url: `http://127.0.0.1:${f.server.port}/license.txt`, integrity: "sha512-aa" as `sha256-${string}`, filename: "license.txt" }],
    ]
    for (const [index, notices] of cases.entries()) {
      const id = `bad${index}`
      const before = { ...f.hits }
      const failed = yield* BackendToolkit.ensure<string>(id).pipe(
        scoped(f.root, { [id]: engine(id, "1", f.server.port, notices) }),
        Effect.flip,
      )
      expect(failed.reason).toBe(`toolkit-not-ready:failed:${id}:notice-invalid`)
      expect(f.hits).toEqual(before)
      expect(yield* present(path.join(f.root, "engines"))).toBe(false)
    }
  }), 30_000,
)

it.live("an engine with no declared notices still becomes ready without a notice directory", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const target = host()
    const run = scoped(f.root, { sqlc: engine("sqlc", "1", f.server.port) })
    const directory = installDir(f.root, "sqlc", "1", target)
    expect(yield* BackendToolkit.ensure("sqlc").pipe(run)).toEqual({ executable: path.join(directory, "tool") })
    expect(yield* PinnedArtifact.installed(directory)).toBe(true)
    expect(yield* present(path.join(directory, "notices"))).toBe(false)
    expect(f.hits).toEqual({ "/tool": 1 })
    expect((yield* BackendToolkit.status("sqlc").pipe(run))[0]?.status).toBe("ready")
  }), 30_000,
)
