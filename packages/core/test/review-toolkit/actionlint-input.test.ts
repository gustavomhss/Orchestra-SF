import { expect, test } from "bun:test"
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Deferred, Effect, Fiber } from "effect"
import { ReviewActionlintInput } from "../../src/review-toolkit/packs/actionlint-input"

test("projects only selected workflow bytes into a host-owned isolated project", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "actionlint-input-test-"))
  const source = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(source, ".github", "workflows"), { recursive: true })
  await mkdir(scratch)
  await writeFile(path.join(source, ".github", "workflows", "ci.yml"), "name: CI\n")
  await writeFile(path.join(source, ".github", "actionlint.yaml"), "self-hosted: true\n")
  let projection = ""
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const result = yield* ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/ci.yml"], scratch })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("projection refused")
    projection = result.root
    expect(result.paths[0].file).toBe(".github/workflows/input-0.yaml")
    expect(yield* Effect.promise(() => readFile(path.join(result.root, result.paths[0].file), "utf8"))).toBe("name: CI\n")
    expect(yield* Effect.promise(() => readFile(result.config, "utf8"))).toBe("{}\n")
    expect(result.paths[0].path).toBe(".github/workflows/ci.yml")
    expect(ReviewActionlintInput.argv("/usr/bin/actionlint", result).status).toBe("ok")
    const env = ReviewActionlintInput.environment(result.root, { PATH: "/bin", ACTIONLINT_CONFIG: "bad", GOFLAGS: "bad" })
    expect(env).toMatchObject({ PATH: "/bin", NO_COLOR: "1", HOME: result.root })
    expect(env.ACTIONLINT_CONFIG).toBeUndefined()
    expect(env.GOFLAGS).toBeUndefined()
  })))
  expect(await Bun.file(projection).exists()).toBe(false)
  await rm(base, { recursive: true, force: true })
})

test("keeps sorted/deduplicated projection bytes paired with their source names", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "actionlint-map-test-"))
  const source = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(source, ".github", "workflows"), { recursive: true })
  await mkdir(scratch)
  await writeFile(path.join(source, ".github", "workflows", "a.yml"), "name: A\n")
  await writeFile(path.join(source, ".github", "workflows", "z.yaml"), "name: Z\n")
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const result = yield* ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/z.yaml", ".github/workflows/a.yml", ".github/workflows/z.yaml"], scratch })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("projection refused")
    expect(result.paths.map((entry) => entry.path)).toEqual([".github/workflows/a.yml", ".github/workflows/z.yaml"])
    expect(yield* Effect.promise(() => readFile(path.join(result.root, result.paths[1].file), "utf8"))).toBe("name: Z\n")
  })))
  await rm(base, { recursive: true, force: true })
})

test("refuses empty, traversing, outside, wrong-location and oversized selections", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "actionlint-refuse-test-"))
  const source = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(source, ".github", "workflows"), { recursive: true })
  await mkdir(scratch)
  await writeFile(path.join(source, ".github", "workflows", "large.yml"), "#".repeat(4 * 1024 * 1024 + 1))
  for (const files of [[], ["../outside.yml"], [".github/workflows/../workflows/large.yml"], [".github/workflows/large\0.yml"], [path.join(base, "outside.yml")], [".github/other.yml"], [".github/workflows/no.txt"], [".github/workflows/large.yml"]]) {
    const result = await Effect.runPromise(Effect.scoped(ReviewActionlintInput.prepare({ root: source, files, scratch })))
    expect(result.status).not.toBe("ok")
  }
  const overlap = await Effect.runPromise(Effect.scoped(ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/large.yml"], scratch: source })))
  expect(overlap.status).not.toBe("ok")
  expect((await Effect.runPromise(Effect.scoped(ReviewActionlintInput.prepare({ root: source, files: Array.from({ length: 10_001 }, () => ".github/workflows/large.yml"), scratch })))).status).not.toBe("ok")
  expect((await Effect.runPromise(Effect.scoped(ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/large.yml"], scratch: base })))).status).not.toBe("ok")
  await rm(base, { recursive: true, force: true })
})

test("refuses selected symlinks and preserves source content, mode, and config", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "actionlint-symlink-test-"))
  const source = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(source, ".github", "workflows"), { recursive: true })
  await mkdir(scratch)
  const original = path.join(source, ".github", "workflows", "real.yml")
  await writeFile(original, "name: Original\n")
  await chmod(original, 0o640)
  await writeFile(path.join(source, ".github", "actionlint.yaml"), "owner: repo\n")
  await symlink(original, path.join(source, ".github", "workflows", "link.yml"))
  const result = await Effect.runPromise(Effect.scoped(ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/link.yml"], scratch })))
  expect(result.status).not.toBe("ok")
  expect(await readFile(original, "utf8")).toBe("name: Original\n")
  expect((await Bun.file(original).stat()).mode & 0o777).toBe(0o640)
  expect(await readFile(path.join(source, ".github", "actionlint.yaml"), "utf8")).toBe("owner: repo\n")
  await rm(base, { recursive: true, force: true })
})

test("rejects empty or forged argv projections and strips case-insensitive tool variables", () => {
  const root = path.resolve("actionlint-project")
  const prepared = { status: "ok" as const, root, files: [path.join(root, ".github/workflows/input-0.yaml")], paths: [{ file: ".github/workflows/input-0.yaml", path: ".github/workflows/source.yml" }], config: path.join(root, ".github/actionlint.yaml") }
  expect(ReviewActionlintInput.argv("/bin/actionlint", { ...prepared, files: [] }).status).not.toBe("ok")
  expect(ReviewActionlintInput.argv("/bin/actionlint", { ...prepared, paths: [] }).status).not.toBe("ok")
  expect(ReviewActionlintInput.argv("/bin/actionlint", { ...prepared, config: "/tmp/actionlint.yaml" }).status).not.toBe("ok")
  expect(ReviewActionlintInput.argv("relative/actionlint", prepared).status).not.toBe("ok")
  expect(ReviewActionlintInput.argv("/bin/actionlint\0evil", prepared).status).not.toBe("ok")
  expect(ReviewActionlintInput.argv("/bin/actionlint", { ...prepared, paths: [{ file: "..", path: ".github/workflows/source.yml" }] }).status).not.toBe("ok")
  const env = ReviewActionlintInput.environment(root, { ACTIONLINT: "x", actionlint_MORE: "x", SHELLCHECK: "x", SHELLCHECK_OPTS: "x", Pyflakes: "x", PYFLAKES_ARGS: "x", GO: "x", GOFLAGS: "x", SystemRoot: "keep" })
  for (const key of ["ACTIONLINT", "actionlint_MORE", "SHELLCHECK", "SHELLCHECK_OPTS", "Pyflakes", "PYFLAKES_ARGS", "GO", "GOFLAGS"]) expect(env[key]).toBeUndefined()
  expect(env.SystemRoot).toBe("keep")
  expect(env.NO_COLOR).toBe("1")
})

test("removes partial projection after a settled copy failure", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "actionlint-copy-fail-"))
  const source = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(source, ".github", "workflows"), { recursive: true })
  await mkdir(scratch)
  await writeFile(path.join(source, ".github", "workflows", "a.yml"), "name: A\n")
  await writeFile(path.join(source, ".github", "workflows", "b.yml"), "name: B\n")
  let projection = ""
  const effect = Effect.scoped(ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/a.yml", ".github/workflows/b.yml"], scratch }).pipe(Effect.provideService(ReviewActionlintInput.Copied, (input) => Effect.suspend(() => {
    projection = input.root
    return input.index === 0 ? Effect.tryPromise(() => mkdir(path.join(input.root, ".github/workflows/input-1.yaml"))) : Effect.void
  }))))
  const result = await Effect.runPromise(effect)
  expect(result.status).not.toBe("ok")
  expect(projection).not.toBe("")
  await expect(readFile(projection)).rejects.toThrow()
  await rm(base, { recursive: true, force: true })
})

test("cleans the acquired projection when interrupted after the first settled copy", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "actionlint-interrupt-"))
  const source = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(source, ".github", "workflows"), { recursive: true })
  await mkdir(scratch)
  await writeFile(path.join(source, ".github", "workflows", "a.yml"), "name: A\n")
  await writeFile(path.join(source, ".github", "workflows", "b.yml"), "name: B\n")
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const copied = yield* Deferred.make<void>()
    const hold = yield* Deferred.make<void>()
    let projection = ""
    const fiber = yield* Effect.scoped(ReviewActionlintInput.prepare({ root: source, files: [".github/workflows/a.yml", ".github/workflows/b.yml"], scratch }).pipe(
      Effect.provideService(ReviewActionlintInput.Copied, (input) => Effect.gen(function* () {
        projection = input.root
        if (input.index === 0) { yield* Deferred.succeed(copied, undefined); yield* Deferred.await(hold) }
      })),
    )).pipe(Effect.forkChild)
    yield* Deferred.await(copied)
    yield* Fiber.interrupt(fiber)
    expect(projection).not.toBe("")
    expect(yield* Effect.promise(() => readFile(projection).then(() => false, () => true))).toBe(true)
  })))
  await rm(base, { recursive: true, force: true })
})
