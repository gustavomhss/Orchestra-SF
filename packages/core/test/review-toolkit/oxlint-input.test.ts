import { expect, test } from "bun:test"
import { constants } from "node:fs"
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { ReviewOxlintInput } from "../../src/review-toolkit/packs/oxlint-input"

test("projects original source names and prepares only the curated rules", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "oxlint-input-"))
  const root = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(path.join(root, "nested"), { recursive: true })
  await mkdir(scratch)
  await writeFile(path.join(root, "nested/a.js"), "debugger;\n")
  await writeFile(path.join(root, "nested/b.ts"), "const value: any = 1;\n")
  await writeFile(path.join(root, ".gitignore"), "*\n")
  await writeFile(path.join(root, ".oxlintrc.json"), "{")
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const prepared = yield* ReviewOxlintInput.prepare({ root, scratch, files: ["nested/b.ts", "nested/a.js", "nested/a.js"] })
      if (!constants.O_NOFOLLOW) {
        expect(prepared).toEqual({ status: "not-run", reason: "no-follow-unavailable" })
        return
      }
      expect(prepared.status).toBe("ok")
      if (prepared.status !== "ok") throw new Error(prepared.reason)
      expect(prepared.paths).toEqual([{ file: "nested/a.js", path: "nested/a.js" }, { file: "nested/b.ts", path: "nested/b.ts" }])
      expect(prepared.rules).toEqual(["eslint(no-debugger)", "typescript(no-explicit-any)"])
      expect(JSON.parse(yield* Effect.promise(() => readFile(prepared.config, "utf8")))).toEqual({ plugins: ["eslint", "typescript"], rules: { "eslint/no-debugger": "error", "typescript/no-explicit-any": "error" } })
      expect(ReviewOxlintInput.argv(path.resolve("bin/oxlint"), prepared)).toMatchObject({ status: "ok", argv: expect.arrayContaining(["--allow", "all", "--deny", "eslint/no-debugger", "--deny", "typescript/no-explicit-any"]) })
      expect(yield* Effect.promise(() => readFile(prepared.files[0], "utf8"))).toBe("debugger;\n")
    })))
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})

test("refuses source suppression markers without rewriting source", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "oxlint-input-"))
  const root = path.join(base, "source")
  const scratch = path.join(base, "scratch")
  await mkdir(root)
  await mkdir(scratch)
  const original = '// eslint-disable-next-line\ndebugger;\n'
  await writeFile(path.join(root, "a.js"), original)
  try {
    expect(await Effect.runPromise(Effect.scoped(ReviewOxlintInput.prepare({ root, scratch, files: ["a.js"] })))).toEqual({ status: "not-run", reason: constants.O_NOFOLLOW ? "inline-directive-marker-unsupported" : "no-follow-unavailable" })
    expect(await readFile(path.join(root, "a.js"), "utf8")).toBe(original)
    expect(await readdir(scratch)).toEqual([])
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})
