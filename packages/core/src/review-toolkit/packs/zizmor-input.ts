export * as ReviewZizmorInput from "./zizmor-input"

import { constants } from "node:fs"
import { chmod, lstat, mkdtemp, mkdir, open, realpath, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Context, Effect, Scope } from "effect"
import { Probe } from "../../research-toolkit/probe/types"
import { ResearchProcess } from "../../research-toolkit/process"
import { ReviewNativeFiles } from "../native-files"

export type Prepared = { status: "ok"; root: string; files: readonly string[]; paths: readonly { file: string; path: string }[] }
export type Input = { root: string; files: readonly string[]; scratch: string; excluded?: readonly string[] }
export type Refused = { status: "not-run" | "unsupported"; reason: string }

export const BeforeRead = Context.Reference<(input: { root: string; file: string }) => Effect.Effect<void>>("@orchestra/ReviewZizmorInput/BeforeRead", { defaultValue: () => () => Effect.void })
export const Copied = Context.Reference<(input: { root: string; file: string }) => Effect.Effect<void>>("@orchestra/ReviewZizmorInput/Copied", { defaultValue: () => () => Effect.void })
export const NoFollow = Context.Reference<boolean>("@orchestra/ReviewZizmorInput/NoFollow", { defaultValue: () => true })

const MAX_BYTES = 4 * 1024 * 1024
const MAX_FILES = 10_000
const refusal = (reason: string): Refused => ({ status: "not-run", reason })

export const prepare = (input: Input): Effect.Effect<Prepared | Refused, unknown, Scope.Scope> =>
  Effect.gen(function* () {
    if (input.excluded?.length) return refusal("native-rule-selection-unsupported")
    if (input.files.length > MAX_FILES) return refusal("too-many-inputs")
    if (!input.files.length) return refusal("no-input")
    if (!(yield* NoFollow) || !constants.O_NOFOLLOW) return refusal("no-follow-unavailable")
    const root = yield* Effect.tryPromise({ try: () => realpath(input.root), catch: () => refusal("root-missing") })
    const scratch = yield* Effect.tryPromise({ try: () => realpath(input.scratch), catch: () => refusal("scratch-missing") })
    const api = ReviewNativeFiles.flavor(root)
    const relative = api.relative(root, scratch)
    const reverse = api.relative(scratch, root)
    const overlaps = (value: string) => value === "" || value === ".." || (!api.isAbsolute(value) && !value.startsWith(`..${api.sep}`))
    if (overlaps(relative) || overlaps(reverse)) return refusal("scratch-overlaps-source")
    const named = input.files.map((file) => ({ file, path: ReviewNativeFiles.containedPath(root, file) }))
    if (named.some((item) => !item.path)) return refusal("path-outside")
    if (named.some((item) => !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(item.path!))) return refusal("invalid-workflow-path")
    const selected = yield* ReviewNativeFiles.select({ root, files: named.map((item) => item.path!), extensions: [".yml", ".yaml"] })
    if (selected.status !== "ok") return selected
    const originals = [...new Set(selected.files.map((file) => ReviewNativeFiles.containedPath(root, file)!))].sort()
    const sources = originals.map((file) => api.join(root, ...file.split("/")))
    const bytes: Buffer[] = []
    const modes: number[] = []
    let total = 0
    for (const file of sources) {
      const remaining = MAX_BYTES - total
      const identity = yield* Effect.tryPromise({ try: () => captureIdentity(root, file), catch: () => refusal("workflow-path-replaced") }).pipe(Effect.uninterruptible)
      modes.push(identity.file.mode & 0o777)
      const beforeRead = yield* BeforeRead
      yield* beforeRead({ root, file })
      const contents = yield* Effect.tryPromise({
        try: async () => {
          const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
          try {
            const opened = await handle.stat()
            if (!sameIdentity(identity.file, opened) || !opened.isFile()) throw new Error("workflow-leaf-replaced")
            for (const parent of identity.parents) {
              const current = await lstat(parent.path)
              if (current.isSymbolicLink() || !current.isDirectory() || !sameIdentity(parent.stat, current)) throw new Error("workflow-parent-replaced")
            }
            const chunks: Buffer[] = []
            let offset = 0
            while (offset <= remaining) {
              const chunk = Buffer.alloc(Math.min(64 * 1024, remaining + 1 - offset))
              const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset)
              if (!bytesRead) break
              chunks.push(chunk.subarray(0, bytesRead)); offset += bytesRead
            }
            return Buffer.concat(chunks, offset)
          } finally { await handle.close() }
        }, catch: () => refusal("workflow-read-or-path-replaced"),
      }).pipe(Effect.uninterruptible)
      if (contents.length > remaining) return refusal("workflow-too-large")
      try { new TextDecoder("utf-8", { fatal: true }).decode(contents) } catch { return refusal("workflow-not-utf8") }
      bytes.push(contents); total += contents.length
    }
    const dir = yield* Effect.acquireRelease(
      Effect.tryPromise({ try: () => mkdtemp(path.join(scratch, "zizmor-")), catch: () => refusal("projection-create-failed") }),
      (value) => Effect.tryPromise({ try: () => rm(value, { recursive: true, force: true }), catch: () => new Error("projection-cleanup-failed") }).pipe(Effect.orDie),
    )
    yield* Effect.tryPromise({ try: async () => { await mkdir(path.join(dir, ".github", "workflows"), { recursive: true }); await mkdir(path.join(dir, ".git")) }, catch: () => refusal("projection-create-failed") }).pipe(Effect.uninterruptible)
    const files = originals.map((file) => api.join(dir, ...file.split("/")))
    const copied = yield* Copied
    for (const [index, file] of files.entries()) {
      yield* Effect.tryPromise({ try: async () => { await writeFile(file, bytes[index], { mode: modes[index] }); await chmod(file, modes[index]) }, catch: () => refusal("projection-copy-failed") }).pipe(Effect.uninterruptible)
      yield* copied({ root: dir, file })
    }
    return { status: "ok" as const, root: dir, files, paths: originals.map((file) => ({ file, path: file })) }
  }).pipe(Effect.catch((error) => Effect.succeed(isRefusal(error) ? error : refusal("filesystem-error"))))

export function argv(executable: string, prepared: Prepared): { status: "ok"; argv: string[] } | Refused {
  const api = ReviewNativeFiles.flavor(prepared.root)
  if (!executable || !api.isAbsolute(executable) || executable.includes("\0")) return refusal("invalid-executable")
  if (!prepared.root || !api.isAbsolute(prepared.root) || prepared.root.includes("\0") || unverified(prepared.root)) return refusal("invalid-projection")
  const root = api.resolve(prepared.root)
  if (!prepared.files.length || prepared.files.length > MAX_FILES || prepared.paths.length !== prepared.files.length) return refusal("invalid-projection")
  const seen = new Set<string>()
  for (const [index, file] of prepared.files.entries()) {
    const mapping = prepared.paths[index]
    const relative = ReviewNativeFiles.containedPath(root, file)
    const canonical = api === path.win32 ? relative?.replaceAll("\\", "/") : relative
    if (!relative || !/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(canonical!) || file !== api.join(root, ...mapping.file.split("/")) || canonical !== mapping.file || mapping.file !== mapping.path || seen.has(mapping.file)) return refusal("invalid-projection")
    seen.add(mapping.file)
  }
  const args = [executable, "--offline", "--no-config", "--no-ignores", "--collect", "workflows", "--persona", "auditor", "--min-severity", "informational", "--min-confidence", "low", "--format", "sarif", "--", ...prepared.files]
  if (args.some((arg) => arg.includes("\0")) || args.reduce((sum, arg) => sum + Buffer.byteLength(arg) + 1, 0) > Probe.Limits.outputBytes) return refusal("argv-bound")
  return { status: "ok", argv: args }
}

export function environment(root: string, input: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const base = ResearchProcess.environment(input)
  return { ...Object.fromEntries(Object.entries(base).filter(([key]) => !/^(ZIZMOR|GH_|GITHUB_|RUST_|OXLINT|ESLINT|NODE_|FORCE_COLOR$|CLICOLOR_FORCE$)/i.test(key))), HOME: root, USERPROFILE: root, TMPDIR: root, TMP: root, TEMP: root, XDG_CONFIG_HOME: path.join(root, ".config"), XDG_CACHE_HOME: path.join(root, ".cache"), NO_COLOR: "1" }
}

async function captureIdentity(root: string, file: string) {
  const api = ReviewNativeFiles.flavor(root), parents: { path: string; stat: { dev: number; ino: number } }[] = []
  let cursor = api.parse(root).root
  for (const segment of [...api.relative(cursor, root).split(api.sep), ...api.relative(root, file).split(api.sep).slice(0, -1)].filter(Boolean)) {
    cursor = api.join(cursor, segment)
    const stat = await lstat(cursor)
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("workflow-parent-replaced")
    parents.push({ path: cursor, stat })
  }
  const leaf = await lstat(file)
  if (leaf.isSymbolicLink() || !leaf.isFile()) throw new Error("not-file")
  return { file: leaf, parents }
}

function sameIdentity(left: { dev: number; ino: number }, right: { dev: number; ino: number }) { return left.dev === right.dev && left.ino === right.ino }
function unverified(value: string) { const head = value.slice(0, 4).replaceAll("/", "\\"); return head === "\\\\?\\" || head === "\\\\.\\" }
function isRefusal(error: unknown): error is Refused { return !!error && typeof error === "object" && "reason" in error && typeof error.reason === "string" && "status" in error && (error.status === "not-run" || error.status === "unsupported") }
