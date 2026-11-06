import { expect, test } from "bun:test"
import { constants } from "node:fs"
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { ReviewZizmorInput as Z } from "../../src/review-toolkit/packs/zizmor-input"

test("projects selected workflow bytes/name, denies config and cleans its owned scope", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "zizmor-input-")), root = path.join(base, "source"), scratch = path.join(base, "scratch")
  await mkdir(path.join(root, ".github/workflows"), { recursive: true }); await mkdir(scratch)
  const file = ".github/workflows/original.yaml", bytes = "name: sample\n"
  await writeFile(path.join(root, file), bytes); await writeFile(path.join(root, "zizmor.yaml"), "invalid")
  await chmod(path.join(root, file), 0o640)
  let projection = ""
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const result = yield* Z.prepare({ root, scratch, files: [file, file] })
      if (!constants.O_NOFOLLOW) { expect(result).toEqual({ status: "not-run", reason: "no-follow-unavailable" }); return }
      expect(result.status).toBe("ok"); if (result.status !== "ok") return
      projection = result.root
      expect(result.paths).toEqual([{ file, path: file }]); expect(path.basename(result.files[0])).toBe("original.yaml")
      expect(yield* Effect.promise(() => readFile(result.files[0], "utf8"))).toBe(bytes)
      expect((yield* Effect.promise(() => lstat(result.files[0]))).mode & 0o777).toBe(0o640)
      expect(yield* Effect.promise(() => readdir(result.root))).toEqual([".git", ".github"])
      expect(Z.argv("/bin/zizmor", result)).toMatchObject({ status: "ok", argv: ["/bin/zizmor", "--offline", "--no-config", "--no-ignores", "--collect", "workflows", "--persona", "auditor", "--min-severity", "informational", "--min-confidence", "low", "--format", "sarif", "--", result.files[0]] })
    })))
    expect(await Z.prepare({ root, scratch, files: [file], excluded: ["zizmor/artipacked"] }).pipe(Effect.scoped, Effect.runPromise)).toEqual({ status: "not-run", reason: "native-rule-selection-unsupported" })
    expect(Z.environment(root, { GH_TOKEN: "secret", ZIZMOR_CONFIG: "outside", NODE_OPTIONS: "evil", PATH: "/bin" })).toMatchObject({ HOME: root, NO_COLOR: "1", PATH: "/bin" })
    expect(Z.environment(root, { GH_TOKEN: "secret", ZIZMOR_CONFIG: "outside", NODE_OPTIONS: "evil" })).not.toHaveProperty("GH_TOKEN")
  } finally {
    if (projection) expect(await Bun.file(projection).exists()).toBe(false)
    expect(await readFile(path.join(root, file), "utf8")).toBe(bytes)
    await rm(base, { recursive: true, force: true })
  }
})

test("rejects empty, oversized, escaped, excluded, and forged inputs", async () => {
  expect(await Effect.runPromise(Effect.scoped(Z.prepare({ root: "/missing", scratch: "/missing", files: [] })))).toEqual({ status: "not-run", reason: "no-input" })
  expect(await Effect.runPromise(Effect.scoped(Z.prepare({ root: "/missing", scratch: "/missing", files: Array.from({ length: 10001 }, () => "x") })))).toEqual({ status: "not-run", reason: "too-many-inputs" })
  const prepared = { status: "ok" as const, root: "/tmp/project", files: ["/tmp/project/.github/workflows/x.yml"], paths: [{ file: ".github/workflows/x.yml", path: ".github/workflows/x.yml" }] }
  expect(Z.argv("/bin/zizmor", { ...prepared, paths: [{ ...prepared.paths[0], path: "../outside.yml" }] })).toEqual({ status: "not-run", reason: "invalid-projection" })
})
