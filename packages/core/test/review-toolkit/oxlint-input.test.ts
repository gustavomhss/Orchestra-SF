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
  let projection = ""
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const prepared = yield* ReviewOxlintInput.prepare({ root, scratch, files: ["nested/b.ts", "nested/a.js", "nested/a.js"] })
      if (!constants.O_NOFOLLOW) {
        expect(prepared).toEqual({ status: "not-run", reason: "no-follow-unavailable" })
        return
      }
      expect(prepared.status).toBe("ok")
      if (prepared.status !== "ok") throw new Error(prepared.reason)
      projection = prepared.root
      expect(prepared.paths).toEqual([{ file: "nested/a.js", path: "nested/a.js" }, { file: "nested/b.ts", path: "nested/b.ts" }])
      expect(prepared.rules).toEqual(["eslint(no-debugger)", "typescript(no-explicit-any)"])
      expect(JSON.parse(yield* Effect.promise(() => readFile(prepared.config, "utf8")))).toEqual({ plugins: ["eslint", "typescript"], rules: { "eslint/no-debugger": "error", "typescript/no-explicit-any": "error" } })
      expect(ReviewOxlintInput.argv(path.resolve("bin/oxlint"), prepared)).toMatchObject({ status: "ok", argv: expect.arrayContaining(["--allow", "all", "--deny", "eslint/no-debugger", "--deny", "typescript/no-explicit-any"]) })
      expect(yield* Effect.promise(() => readFile(prepared.files[0], "utf8"))).toBe("debugger;\n")
    })))
    if (projection) expect(await Bun.file(projection).exists()).toBe(false)
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
    expect(await Effect.runPromise(Effect.scoped(ReviewOxlintInput.prepare({ root: `${root}/../source`, scratch, files: ["a.js"] })))).toEqual({ status: "not-run", reason: "unsafe-root-or-scratch" })
    expect(await Effect.runPromise(Effect.scoped(ReviewOxlintInput.prepare({ root, scratch: `${scratch}/../scratch`, files: ["a.js"] })))).toEqual({ status: "not-run", reason: "unsafe-root-or-scratch" })
    expect(await Effect.runPromise(Effect.scoped(ReviewOxlintInput.prepare({ root, scratch, files: ["a.js"] })))).toEqual({ status: "not-run", reason: constants.O_NOFOLLOW ? "inline-directive-marker-unsupported" : "no-follow-unavailable" })
    expect(await readFile(path.join(root, "a.js"), "utf8")).toBe(original)
    expect(await readdir(scratch)).toEqual([])
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})

test("argv validates native paths without restricting literal names and strips color toggles case-insensitively", () => {
  const root = path.resolve("projection")
  const relative = "nested/space %é\\name.js"
  const posix = {
    status: "ok" as const, root, config: path.join(root, ".host/oxlint.json"), rules: ["eslint(no-debugger)"],
    files: [path.join(root, relative)], paths: [{ file: relative, path: relative }],
  }
  if (process.platform !== "win32") expect(ReviewOxlintInput.argv(path.resolve("bin/oxlint"), posix).status).toBe("ok")
  const windowsRoot = "C:\\projection"
  const windowsRelative = "nested/space %é/name.js"
  const windows = {
    status: "ok" as const, root: windowsRoot, config: "C:\\projection\\.host\\oxlint.json", rules: ["eslint(no-debugger)"],
    files: ["C:\\projection\\nested\\space %é\\name.js"], paths: [{ file: windowsRelative, path: windowsRelative }],
  }
  expect(ReviewOxlintInput.argv("C:\\bin\\oxlint.exe", windows).status).toBe("ok")
  expect(ReviewOxlintInput.argv("C:\\bin\\oxlint.exe", { ...windows, root: "\\\\?\\C:\\projection" }).status).not.toBe("ok")
  expect(ReviewOxlintInput.argv("\\\\?\\C:\\bin\\oxlint.exe", windows).status).not.toBe("ok")
  expect(ReviewOxlintInput.argv("C:\\bin\\oxlint.exe", { ...windows, files: [...windows.files, "C:\\projection\\nested\\SPACE %é\\NAME.js"], paths: [...windows.paths, { file: "nested/SPACE %é/NAME.js", path: "nested/SPACE %é/NAME.js" }] }).status).not.toBe("ok")
  const env = ReviewOxlintInput.environment(root, { Force_Color: "1", cLiCoR_fOrCe: "1", PATH: "/bin" })
  expect(env.Force_Color).toBeUndefined()
  expect(env.cLiCoR_fOrCe).toBeUndefined()
})
