export * as ReviewActionlintInput from "./actionlint-input"

import { mkdtemp, mkdir, open, realpath, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Context, Effect, Scope } from "effect"
import { Probe } from "../../research-toolkit/probe/types"
import { ResearchProcess } from "../../research-toolkit/process"
import { ReviewNativeFiles } from "../native-files"
import { ReviewActionlintYaml } from "./actionlint-yaml"

export type Prepared = { status: "ok"; root: string; files: readonly string[]; paths: readonly { file: string; path: string }[]; config: string }
export const Copied = Context.Reference<(input: { root: string; index: number; file: string }) => Effect.Effect<void>>("@orchestra/ReviewActionlintInput/Copied", { defaultValue: () => () => Effect.void })

const MAX_BYTES = 4 * 1024 * 1024
const MAX_FILES = 10_000
const refusal = (reason: string) => ({ status: "not-run" as const, reason })

export const prepare = (input: { root: string; files: readonly string[]; scratch: string }): Effect.Effect<Prepared | { status: "not-run" | "unsupported"; reason: string }, unknown, Scope.Scope> =>
  Effect.gen(function* () {
    if (!input.files.length) return refusal("no-input")
    if (input.files.length > MAX_FILES) return refusal("too-many-inputs")
    const root = yield* Effect.tryPromise({ try: () => realpath(input.root), catch: () => refusal("root-missing") })
    const scratch = yield* Effect.tryPromise({ try: () => realpath(input.scratch), catch: () => refusal("scratch-missing") })
    const rel = path.relative(root, scratch)
    const back = path.relative(scratch, root)
    const overlaps = (value: string) => value === "" || value === ".." || (!path.isAbsolute(value) && !value.startsWith(`..${path.sep}`))
    if (overlaps(rel) || overlaps(back)) return refusal("scratch-overlaps-source")
    const requested = input.files.map((file) => ({ file, relative: ReviewNativeFiles.containedPath(root, file) }))
    if (requested.some((item) => !item.relative)) return refusal("path-outside")
    if (requested.some((item) => !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(item.relative!))) return refusal("invalid-workflow-path")
    const selected = yield* ReviewNativeFiles.select({ root, files: requested.map((item) => item.relative!), extensions: [".yml", ".yaml"] })
    if (selected.status !== "ok") return selected
    const originals = selected.files.map((file) => ReviewNativeFiles.containedPath(root, file)!)
    const contents: Buffer[] = []
    let total = 0
    for (const file of selected.files) {
      const remaining = MAX_BYTES - total
      const bytes = yield* Effect.tryPromise({
        try: async () => {
          const handle = await open(file, "r")
          try {
            const chunk = Buffer.alloc(remaining + 1)
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, 0)
            return chunk.subarray(0, bytesRead)
          } finally { await handle.close() }
        },
        catch: () => refusal("workflow-read-failed"),
      }).pipe(Effect.uninterruptible)
      if (bytes.length > remaining) return refusal("workflow-too-large")
      let text: string
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes) }
      catch { return refusal("workflow-not-utf8") }
      const valid = ReviewActionlintYaml.validateWorkflow(text)
      if (valid.status !== "ok") return valid
      contents.push(bytes)
      total += bytes.length
    }
    const dir = yield* Effect.acquireRelease(
      Effect.tryPromise({ try: () => mkdtemp(path.join(scratch, "actionlint-")), catch: () => refusal("projection-create-failed") }),
      (value) => Effect.tryPromise({ try: () => rm(value, { recursive: true, force: true }), catch: () => new Error("projection-cleanup-failed") }),
    )
    yield* Effect.tryPromise({ try: async () => { await mkdir(path.join(dir, ".github", "workflows"), { recursive: true }); await mkdir(path.join(dir, ".git")) }, catch: () => refusal("projection-create-failed") }).pipe(Effect.uninterruptible)
    const projected = contents.map((_, i) => path.join(dir, ".github", "workflows", `input-${i}.yaml`))
    const copied = yield* Copied
    for (let index = 0; index < projected.length; index++) {
      yield* Effect.tryPromise({ try: () => writeFile(projected[index], contents[index]), catch: () => refusal("projection-copy-failed") }).pipe(Effect.uninterruptible)
      yield* copied({ root: dir, index, file: projected[index] })
    }
    const config = path.join(dir, ".github", "actionlint.yaml")
    yield* Effect.tryPromise({ try: () => writeFile(config, "{}\n"), catch: () => refusal("projection-config-failed") }).pipe(Effect.uninterruptible)
    return { status: "ok" as const, root: dir, files: projected, paths: projected.map((file, i) => ({ file: path.relative(dir, file), path: originals[i] })), config }
  }).pipe(Effect.catch(() => Effect.succeed(refusal("filesystem-error"))))

export function argv(executable: string, prepared: Prepared) {
  const root = path.resolve(prepared.root)
  const relative = (file: string) => path.relative(root, file)
  const validInside = (file: string) => !!file && !file.includes("\0") && !path.isAbsolute(relative(file)) && relative(file) !== ".." && !relative(file).startsWith(`..${path.sep}`)
  if (!executable || !path.isAbsolute(executable) || executable.includes("\0")) return refusal("invalid-executable")
  if (!root || !path.isAbsolute(root) || !prepared.files.length || prepared.paths.length !== prepared.files.length) return refusal("invalid-projection")
  if (prepared.config !== path.join(root, ".github", "actionlint.yaml") || !validInside(prepared.config)) return refusal("invalid-projection")
  const pairs = new Set<string>()
  for (const [index, file] of prepared.files.entries()) {
    const mapping = prepared.paths[index]
    if (!path.isAbsolute(file) || !validInside(file) || file !== path.join(root, ".github", "workflows", `input-${index}.yaml`)) return refusal("invalid-projection")
    if (mapping.file !== path.relative(root, file) || !/^\.github\/workflows\/input-\d+\.yaml$/.test(mapping.file) || !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(mapping.path) || mapping.path.includes("\0")) return refusal("invalid-projection")
    if (pairs.has(mapping.file) || prepared.files.filter((candidate) => candidate === file).length !== 1) return refusal("invalid-projection")
    pairs.add(mapping.file)
  }
  const argv = [executable, "-no-color", "-shellcheck=", "-pyflakes=", "-config-file", prepared.config, "-format", "{{json .}}", "--", ...prepared.files]
  if (argv.some((arg) => arg.includes("\0")) || argv.reduce((sum, arg) => sum + Buffer.byteLength(arg) + 1, 0) > Probe.Limits.outputBytes) return refusal("argv-bound")
  return { status: "ok" as const, argv }
}

export function environment(root: string, input: NodeJS.ProcessEnv = process.env) {
  const base = ResearchProcess.environment(input)
  return { ...Object.fromEntries(Object.entries(base).filter(([key]) => !/^(ACTIONLINT|SHELLCHECK|PYFLAKES|GO)/i.test(key))), HOME: root, USERPROFILE: root, XDG_CONFIG_HOME: path.join(root, ".config"), XDG_CACHE_HOME: path.join(root, ".cache"), TMPDIR: root, TMP: root, TEMP: root, NO_COLOR: "1" }
}
