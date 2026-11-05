export * as ReviewPackSquawk from "./squawk"

import path from "node:path"
import { mkdir } from "node:fs/promises"
import { Effect } from "effect"
import pinned from "../../backend-toolkit/packs/squawk"
import { BackendToolkit } from "../../backend-toolkit"
import type { Pack } from "../../backend-toolkit/manifest"
import { Probe } from "../../research-toolkit/probe/types"
import type { Outcome } from "../../research-toolkit/process"
import type { Parsed } from "../sarif"
import { containedPath, flavor, parseReport } from "./squawk-report"

export { RULES } from "./squawk-report"

// Pinned 2.67.0 artifact. Workspace license is Apache-2.0 OR MIT; the pin field stays Apache-2.0. Empty
// included_rules adds to defaults (with_rules), then excludes, not a whitelist. pg_version is omitted;
// upstream Version::default is 15.0.0 and is not a claim about the reviewed project. Status never fetches.

export const manifest = {
  ...pinned,
  fit: { role: "check", input: "The reviewed tree in lucy's scratch copy", skills: [] },
} as const satisfies Pack

export const hostToml = "assume_in_transaction = false\nincluded_rules = []\nexcluded_rules = []\n"
export const pgVersion = "unspecified" as const
export const upstreamVersionDefault = "15.0.0" as const
export const includes = "additive" as const

export const locate = Effect.fn("ReviewPackSquawk.locate")(function* () {
  const states = yield* BackendToolkit.status(manifest.id).pipe(
    Effect.provideService(BackendToolkit.Manifest, { [manifest.id]: manifest }),
  )
  const state = states[0]
  if (state?.status === "ready") return { executable: state.executable }
  if (state?.status === "unsupported") return { absent: `squawk unsupported: ${state.reason}` }
  return { absent: "squawk absent" }
})

export const prepare = Effect.fn("ReviewPackSquawk.prepare")(function* (directory: string) {
  const config = path.join(directory, "squawk.toml")
  yield* Effect.promise(async () => {
    await mkdir(directory, { recursive: true })
    await Bun.write(config, hostToml)
  })
  return config
})

// glob 0.3.1 Pattern::escape is [?] [*] [[] []]; classes contain no separator. Verbatim/device prefixes yield nothing.
export function argv(input: { executable: string; config: string; root: string; files: readonly string[] }) {
  if (input.files.length === 0) return stop("not-run", "no-input")
  if ([input.root, input.config, input.executable, ...input.files].some(unverified)) return stop("unsupported", "glob-literal-unverified")
  if (!input.executable || input.executable.includes("\0")) return stop("not-run", "executable-missing")
  const config = hostConfig(input.config, input.root)
  if (config) return stop("not-run", config)
  const escaped: string[] = []
  for (const file of input.files) {
    const reason = sqlFile(file, input.root)
    if (reason) return stop("not-run", reason)
    escaped.push(patternEscape(file))
  }
  const args = [input.executable, "--config", input.config, "--reporter", "json", "--", ...escaped]
  if (args.reduce((sum, arg) => sum + Buffer.byteLength(arg), 0) > Probe.Limits.outputBytes) return stop("not-run", "argv-bound")
  return { status: "ok" as const, argv: args }
}

export function settle(outcome: Outcome, root: string): Parsed | { status: "not-run"; reason: string } {
  if (outcome.failure) return { status: "not-run", reason: "spawn-failure" }
  if (outcome.timedOut) return { status: "not-run", reason: "timeout" }
  if (outcome.memoryExceeded) return { status: "not-run", reason: "memory-exceeded" }
  if (outcome.overflow || outcome.stdout.truncated || outcome.stderr.truncated) return { status: "acquisition-error", reason: "truncated" }
  if (outcome.exitCode === null) return { status: "acquisition-error", reason: "missing-exit" }
  if (outcome.exitCode !== 0 && outcome.exitCode !== 1) return { status: "acquisition-error", reason: `exit-${outcome.exitCode}` }
  const stderr = decode(outcome.stderr.data)
  if (stderr === undefined) return { status: "acquisition-error", reason: "not-utf8" }
  if (stderr.includes("Configuration error:") || stderr.includes("Failed to find files"))
    return { status: "acquisition-error", reason: "configuration-error" }
  if (stderr.trim() !== "") return { status: "acquisition-error", reason: "stderr" }
  const stdout = decode(outcome.stdout.data)
  if (stdout === undefined) return { status: "acquisition-error", reason: "not-utf8" }
  if (stdout.trim() === "") return { status: "acquisition-error", reason: "missing-report" }
  const parsed = parseReport(stdout, { root })
  if (parsed.status !== "ok") return parsed
  if (outcome.exitCode === 0 && parsed.results.length === 0) return parsed
  if (outcome.exitCode === 1 && parsed.results.length > 0) return parsed
  return { status: "acquisition-error", reason: "exit-mismatch" }
}

function stop(status: "not-run" | "unsupported", reason: string) {
  return { status, reason }
}

function unverified(value: string) {
  const head = value.slice(0, 4).replaceAll("/", "\\")
  return head === "\\\\?\\" || head === "\\\\.\\"
}

function hostConfig(config: string, root: string) {
  if (config.includes("\0") || root.includes("\0")) return "nul"
  if (!spelled(root, root) || !spelled(config, root)) return "config-not-absolute"
  if (dots(config, root) || dots(root, root)) return "path-outside"
  if (flavor(root).resolve(config) === flavor(root).resolve(root) || containedPath(config, root)) return "config-inside"
  return undefined
}

function sqlFile(file: string, root: string) {
  if (file.includes("\0")) return "nul"
  if (flavor(root).sep === "\\" ? /[\\/]$/.test(file) : file.endsWith("/")) return "directory"
  if (!spelled(file, root)) return "not-absolute"
  if (dots(file, root) || !containedPath(file, root)) return "path-outside"
  if (!flavor(root).basename(file).endsWith(".sql")) return "not-sql"
  return undefined
}

function spelled(value: string, root: string) {
  if (/^[A-Za-z]:(?![\\/])/.test(value) || !flavor(root).isAbsolute(value)) return false
  if (flavor(root).sep === "/") return value.startsWith("/")
  if (/^[A-Za-z]:[\\/]/.test(root)) return /^[A-Za-z]:[\\/]/.test(value)
  return value.startsWith("\\\\") || value.startsWith("//")
}

function dots(value: string, root: string) {
  return value.split(flavor(root).sep === "\\" ? /[\\/]/ : /\//).includes("..")
}

function patternEscape(value: string) {
  let escaped = ""
  for (const char of value) escaped += char === "?" || char === "*" || char === "[" || char === "]" ? `[${char}]` : char
  return escaped
}

function decode(data: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data)
  } catch {
    return undefined
  }
}
