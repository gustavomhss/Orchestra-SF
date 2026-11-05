import { expect, test } from "bun:test"
import { constants } from "node:fs"
import { chmod, lstat, mkdir, realpath, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { Effect } from "effect"
import { Probe } from "../../src/research-toolkit/probe/types"
import { ReviewNativeFiles } from "../../src/review-toolkit/native-files"
import { tmpdir } from "../fixture/tmpdir"

const run = (root: string, files: ReadonlyArray<string>, extensions: ReadonlyArray<string> = [".py"]) =>
  Effect.runPromise(ReviewNativeFiles.select({ root, files, extensions }))

test("lexical refusals do not touch the filesystem", async () => {
  const missing = path.join("/no-such-native-files", `${Date.now()}`)
  expect(await run(missing, [])).toEqual({ status: "not-run", reason: "no-input" })
  expect(await run(missing, ["a.py\0"])).toEqual({ status: "not-run", reason: "nul" })
  expect(await run(missing, ["../outside.py"])).toEqual({ status: "not-run", reason: "path-outside" })
  expect(await run(missing, ["note.ts"])).toEqual({ status: "not-run", reason: "wrong-extension" })
  expect(await run(missing, [`${"a".repeat(Probe.Limits.outputBytes)}.py`])).toEqual({ status: "not-run", reason: "argv-bound" })
  expect(await lstat(missing).then(() => true, () => false)).toBe(false)
})

test("a foreign root flavor is unsupported before filesystem access", async () => {
  const root = process.platform === "win32" ? "/tmp/native-files-posix-root" : "C:\\native-files-win-root"
  expect(await run(root, ["a.py"])).toEqual({ status: "unsupported", reason: "nonnative-root" })
})

test("a regular file is returned at its canonical path, deduplicated and ordered", async () => {
  await using dir = await tmpdir()
  await writeFile(path.join(dir.path, "b.py"), "b\n")
  await writeFile(path.join(dir.path, "a.py"), "a\n")
  const selected = await run(dir.path, ["b.py", path.join(dir.path, "a.py"), "b.py"])
  expect(selected).toEqual({
    status: "ok",
    files: [await realpath(path.join(dir.path, "a.py")), await realpath(path.join(dir.path, "b.py"))],
  })
})

test("literal spaces, brackets and a posix backslash do not select a sibling", async () => {
  await using dir = await tmpdir()
  await writeFile(path.join(dir.path, "a.py"), "plain\n")
  await writeFile(path.join(dir.path, "a b.py"), "space\n")
  await writeFile(path.join(dir.path, "a[b].py"), "brackets\n")
  await mkdir(path.join(dir.path, "foo"))
  await writeFile(path.join(dir.path, "foo", "bar.py"), "nested\n")
  await writeFile(path.join(dir.path, "foo\\bar.py"), "literal\n")
  const selected = await run(dir.path, ["a b.py", "a[b].py", "foo\\bar.py", "*.py"])
  expect(selected.status).toBe("not-run")
  if (selected.status !== "ok") expect(selected.reason).toBe("missing")
  const literal = await run(dir.path, ["a b.py", "a[b].py", "foo\\bar.py"])
  expect(literal).toEqual({
    status: "ok",
    files: [
      await realpath(path.join(dir.path, "a b.py")),
      await realpath(path.join(dir.path, "a[b].py")),
      await realpath(path.join(dir.path, "foo\\bar.py")),
    ].sort(),
  })
})

test("a parent symlink inside or outside the root is refused", async () => {
  await using dir = await tmpdir()
  await using outside = await tmpdir()
  await mkdir(path.join(dir.path, "real"))
  await writeFile(path.join(dir.path, "real", "a.py"), "in\n")
  await symlink(path.join(dir.path, "real"), path.join(dir.path, "link"))
  expect(await run(dir.path, ["link/a.py"])).toEqual({ status: "unsupported", reason: "symlink" })
  await mkdir(path.join(outside.path, "real"))
  await writeFile(path.join(outside.path, "real", "a.py"), "out\n")
  await symlink(path.join(outside.path, "real"), path.join(dir.path, "out"))
  expect(await run(dir.path, ["out/a.py"])).toEqual({ status: "unsupported", reason: "symlink" })
})

test("a directory, a missing file and a leaf symlink are refused", async () => {
  await using dir = await tmpdir()
  await mkdir(path.join(dir.path, "pkg.py"))
  await writeFile(path.join(dir.path, "real.py"), "x\n")
  await symlink(path.join(dir.path, "real.py"), path.join(dir.path, "leaf.py"))
  expect(await run(dir.path, ["pkg.py"])).toEqual({ status: "not-run", reason: "directory" })
  expect(await run(dir.path, ["missing.py"])).toEqual({ status: "not-run", reason: "missing" })
  expect(await run(dir.path, ["leaf.py"])).toEqual({ status: "unsupported", reason: "symlink" })
})

test("an unreadable root fails named", async () => {
  if (process.getuid?.() === 0) throw new Error("native-files-unreadable-root-unproven")
  await using dir = await tmpdir()
  await writeFile(path.join(dir.path, "a.py"), "a\n")
  await chmod(dir.path, 0)
  try {
    expect(await run(dir.path, ["a.py"])).toEqual({ status: "not-run", reason: "unreadable" })
  } finally {
    await chmod(dir.path, constants.S_IRWXU)
  }
})
