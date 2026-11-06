export * as ReviewNativeSarif from "./native-sarif"

import type { ReviewSarif } from "./sarif"
import { posix, win32 } from "node:path"
import { ReviewSarif as Sarif } from "./sarif"

/** Host-owned source mapping and native rule inventory, never supplied by the reviewed tree. */
export type Options = {
  readonly pack: string
  readonly version: string
  readonly root: string
  readonly paths: readonly { readonly file: string; readonly path: string }[]
  readonly rules: readonly string[]
}

/** Native error levels settle a tool's exit protocol; they do not confirm a finding or set review severity. */
export type Parsed =
  | { status: "ok"; results: ReviewSarif.Raw[]; excluded: ReviewSarif.Excluded[]; nativeErrors: number }
  | { status: "acquisition-error"; reason: string }

export function parse(text: string, options: Options): Parsed {
  const fail = (reason: string): Parsed => ({ status: "acquisition-error", reason })
  const path = /^[A-Za-z]:[\\/]/.test(options.root) || options.root.startsWith("\\\\") || options.root.startsWith("//") ? win32 : posix
  if (!options.pack.trim() || !options.version.trim() || !path.isAbsolute(options.root) || options.root.includes("\0") || options.root.split(path === win32 ? /[\\/]/ : /\//).includes("..")) return fail("host-context-invalid")
  if (!options.paths.length || !options.rules.length || options.rules.some((rule) => !rule || rule === "*") || new Set(options.rules).size !== options.rules.length) return fail("host-inventory-invalid")
  const normalize = (value: string) => {
    if (!value || value.includes("\0") || value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.split("/").some((part) => !part || part === "." || part === "..")) return undefined
    return value
  }
  const keys = (value: string) => path === win32 ? value.toLowerCase() : value
  const mappings = new Map<string, string>()
  const sources = new Set<string>()
  for (const entry of options.paths) {
    const file = normalize(entry.file), source = normalize(entry.path)
    if (!file || !source || mappings.has(keys(file)) || sources.has(keys(source))) return fail("host-path-map-invalid")
    mappings.set(keys(file), source); sources.add(keys(source))
  }
  if (Buffer.byteLength(text, "utf8") > 4 * 1024 * 1024) return fail("report-too-large")
  const parsed = Sarif.parseSarif(text, { pack: options.pack, root: options.root })
  if (parsed.status !== "ok") return fail(parsed.reason)
  let data: unknown
  try { data = JSON.parse(text) } catch { return fail("malformed-json") }
  if (!record(data) || data.version !== "2.1.0" || !Array.isArray(data.runs) || data.runs.length !== 1) return fail("native-envelope-invalid")
  const run = data.runs[0]
  if (!record(run) || !record(run.tool) || !record(run.tool.driver) || run.tool.driver.name !== options.pack || run.tool.driver.version !== options.version || !Array.isArray(run.results)) return fail("native-driver-mismatch")
  if (run.tool.driver.semanticVersion !== undefined && run.tool.driver.semanticVersion !== options.version) return fail("native-version-mismatch")
  if (Array.isArray(run.invocations) && run.invocations.some((i) => record(i) && (i.executionSuccessful === false || [i.toolExecutionNotifications, i.toolConfigurationNotifications].some((ns) => Array.isArray(ns) && ns.some((n) => record(n) && n.level === "error"))))) return fail("native-invocation-failed")
  const results: ReviewSarif.Raw[] = []
  let nativeErrors = 0
  for (const row of run.results) {
    if (!record(row) || (row.kind !== undefined && row.kind !== "fail") || typeof row.ruleId !== "string" || !options.rules.includes(row.ruleId) || !record(row.message) || typeof row.message.text !== "string" || !Array.isArray(row.locations) || row.locations.length !== 1) return fail("native-row-invalid")
    if (row.level !== undefined && !["error", "warning", "note"].includes(String(row.level))) return fail("native-level-invalid")
    const physical = record(row.locations[0]) && record(row.locations[0].physicalLocation) ? row.locations[0].physicalLocation : undefined
    const uri = physical && record(physical.artifactLocation) ? physical.artifactLocation.uri : undefined
    const region = physical && record(physical.region) ? physical.region : undefined
    if (typeof uri !== "string" || !region || typeof region.startLine !== "number" || !Number.isSafeInteger(region.startLine) || region.startLine < 1 || (region.endLine !== undefined && (typeof region.endLine !== "number" || !Number.isSafeInteger(region.endLine) || region.endLine < region.startLine)) || [region.startColumn, region.endColumn].some((n) => n !== undefined && (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1)) || (typeof region.startColumn === "number" && typeof region.endColumn === "number" && (region.endLine ?? region.startLine) === region.startLine && region.endColumn < region.startColumn)) return fail("native-location-invalid")
    const file = normalize(uri)
    const source = file && mappings.get(keys(file))
    if (!source) return fail("native-path-unmapped")
    const normalized = results.length < parsed.results.length ? parsed.results[results.length] : undefined
    if (!normalized || normalized.rule !== row.ruleId || normalized.line !== region.startLine) return fail("native-normalization-mismatch")
    results.push({ ...normalized, path: source })
    if ((row.level ?? "warning") === "error") nativeErrors++
  }
  if (results.length !== parsed.results.length) return fail("native-result-count-mismatch")
  return { status: "ok", results, excluded: [], nativeErrors }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
