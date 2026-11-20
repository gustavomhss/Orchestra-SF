import test from "node:test"
import { readdir, readFile, lstat } from "node:fs/promises"
import path from "node:path"
import { inflateRawSync } from "node:zlib"

// Temporary retained-evidence reader. No product imports, browser, network, process spawn or replay.
const source = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  run: 44656358971,
  artifact: 14594546715,
  snapshot: "5f2867ccf7ac764e0e714cbe4914ce9300da3965",
  digest: "sha256:623d31906142b886aeb3401aed58bd2b9e5ed809a7709726366e13c17e59a2a1",
  name: "playwright-ubuntu-24.04-1",
  bytes: 2075937,
})
const cases = new Map([["OP-PROC-01", 13], ["OP-PROC-02", 18], ["OP-PROC-03", 23],
  ["OP-IMPORT-01", 28], ["OP-DOC-01", 33]])
const phases = new Set(["Operations local operator enrollment", "Operations installation discovery",
  "Operations native context admission", "Operations native profile selection",
  "Operations Requests ready for the original operator"])
const categories = new Set(["test.step", "pw:api", "expect", "hook", "fixture", "test.attach"])
const apis = new Set(["page.goto", "page.reload", "page.waitForResponse", "page.waitForURL",
  "page.waitForLoadState", "page.url", "page.evaluate", "locator.click", "locator.fill", "locator.press",
  "locator.waitFor", "locator.count", "locator.getAttribute", "locator.textContent", "locator.inputValue",
  "locator.selectOption", "locator.setInputFiles", "locator.check", "locator.uncheck",
  "apiRequestContext.get", "apiRequestContext.post", "apiRequestContext.put", "apiRequestContext.patch",
  "apiRequestContext.delete", "apiRequestContext.fetch", "apiResponse.json", "apiResponse.text",
  "apiResponse.body", "response.json", "response.text", "response.body",
  "expect.toBe", "expect.toEqual", "expect.toMatchObject", "expect.toBeVisible", "expect.toBeHidden",
  "expect.toBeEnabled", "expect.toBeDisabled", "expect.toHaveText", "expect.toHaveValue",
  "expect.toHaveCount", "expect.toHaveAttribute", "expect.toHaveURL", "expect.toBeTruthy",
  "expect.toContain", "expect.toContainText"])
const paths = new Set(["operations.spec.ts", "operations-support/runtime.ts", "operations-support/documents.ts",
  "operations-support/imports.ts", "operations-support/procurement-snapshot.ts",
  "operations-support/procurement-refusal.ts", "operations-support/procurement-comparison.ts",
  "operations-support/procurement.ts", "operations-support/installation.ts", "native/select-profile.ts",
  "wp04/procurement.spec.ts"].map((file) => "packages/app-shell/e2e/sucafina/" + file))
const statuses = new Set(["passed", "failed", "timedOut", "skipped", "interrupted"])
const emit = (kind, value) => console.info("AUDIT_OPS_RETAINED_" + kind + " " + JSON.stringify(value))

class AuditError extends Error {
  constructor(code) { super(code); this.name = "RetainedOperationsAuditError" }
}
function requireValue(condition, code) { if (!condition) throw new AuditError(code) }
function parseJson(bytes) {
  try { return JSON.parse(bytes) } catch { throw new AuditError("INVALID_RETAINED_JSON") }
}
function number(value, minimum = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= 86_400_000
    ? value : null
}
function location(value) {
  if (!value || typeof value.file !== "string") return null
  const file = value.file.replaceAll("\\", "/")
  const canonical = file.startsWith("/home/runner/work/Orchestra-SF/Orchestra-SF/")
    ? file.slice("/home/runner/work/Orchestra-SF/Orchestra-SF/".length)
    : file.startsWith("e2e/sucafina/") ? "packages/app-shell/" + file
      : file.startsWith("sucafina/") ? "packages/app-shell/e2e/" + file : file
  if (!paths.has(canonical) || !Number.isSafeInteger(value.line) || value.line < 1 || value.line > 1_000_000) return null
  return { file: canonical, line: value.line,
    column: Number.isSafeInteger(value.column) && value.column > 0 && value.column < 100_000 ? value.column : null }
}
function errorClasses(error) {
  if (!error) return []
  const message = typeof error === "string" ? error : typeof error.message === "string" ? error.message : ""
  const rules = [
    [/Test timeout of \d+ms exceeded/, "test-timeout"],
    [/Timeout \d+ms exceeded|TimeoutError/, "action-timeout"],
    [/Object with guid response@.* was not bound in the connection/, "response-connection-binding"],
    [/Target page, context or browser has been closed/, "page-or-context-closed"],
    [/Request content was evicted from inspector cache|No resource with given identifier found/, "response-body-unavailable"],
    [/net::ERR_CONNECTION_RESET|ECONNRESET/, "connection-reset"],
    [/net::ERR_CONNECTION_REFUSED|ECONNREFUSED/, "connection-refused"],
    [/net::ERR_TIMED_OUT|ETIMEDOUT/, "connection-timeout"],
    [/AssertionError|expect\((?:received|locator)\)/, "assertion"],
  ]
  const found = rules.filter(([pattern]) => pattern.test(message)).map(([, code]) => code)
  return found.length ? found : ["unclassified-error"]
}
async function inventory(root, depth = 0, output = []) {
  requireValue(depth < 20 && output.length < 5000, "ARTIFACT_INVENTORY_LIMIT")
  for (const entry of await readdir(root, { withFileTypes: true })) {
    requireValue(!entry.isSymbolicLink(), "ARTIFACT_SYMLINK_REFUSED")
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) await inventory(file, depth + 1, output)
    if (entry.isFile()) output.push(file)
    requireValue(output.length < 5000, "ARTIFACT_INVENTORY_LIMIT")
  }
  return output
}
function archive(buffer) {
  requireValue(buffer.length > 22 && buffer.length <= 64 * 1024 * 1024, "EMBEDDED_ARCHIVE_SIZE")
  let end = -1
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index--) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { end = index; break }
  }
  requireValue(end >= 0, "EMBEDDED_ARCHIVE_DIRECTORY_MISSING")
  const count = buffer.readUInt16LE(end + 10), offset = buffer.readUInt32LE(end + 16)
  requireValue(count > 0 && count < 5000 && offset < end, "EMBEDDED_ARCHIVE_DIRECTORY_LIMIT")
  const entries = []
  let cursor = offset
  let expanded = 0
  for (let index = 0; index < count; index++) {
    requireValue(cursor + 46 <= end && buffer.readUInt32LE(cursor) === 0x02014b50, "INVALID_ZIP_DIRECTORY_ENTRY")
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10)
    const compressed = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24)
    const names = buffer.readUInt16LE(cursor + 28), extras = buffer.readUInt16LE(cursor + 30), comments = buffer.readUInt16LE(cursor + 32)
    const local = buffer.readUInt32LE(cursor + 42)
    requireValue(cursor + 46 + names + extras + comments <= end, "ZIP_ENTRY_OUT_OF_BOUNDS")
    const name = buffer.subarray(cursor + 46, cursor + 46 + names).toString("utf8")
    cursor += 46 + names + extras + comments
    // Detailed Playwright file JSONs are hash-named; attachments and arbitrary ZIP paths are never read.
    if (name !== "report.json" && !/^[a-f0-9]{16,64}\.json$/.test(name)) continue
    requireValue(!(flags & 1) && [0, 8].includes(method) && size < 16 * 1024 * 1024, "UNSUPPORTED_REPORT_JSON_ENTRY")
    requireValue(local + 30 <= offset && buffer.readUInt32LE(local) === 0x04034b50, "INVALID_ZIP_LOCAL_ENTRY")
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    requireValue(start + compressed <= offset, "ZIP_PAYLOAD_OUT_OF_BOUNDS")
    const raw = buffer.subarray(start, start + compressed)
    const bytes = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: 16 * 1024 * 1024 })
    expanded += bytes.length
    requireValue(bytes.length === size && expanded <= 64 * 1024 * 1024, "ZIP_EXPANSION_LIMIT")
    entries.push({ report: name === "report.json", value: parseJson(bytes.toString("utf8")) })
  }
  requireValue(entries.filter((entry) => entry.report).length === 1, "EXACTLY_ONE_REPORT_JSON_REQUIRED")
  return entries
}
function flatten(value, depth = 0, output = []) {
  requireValue(depth < 80 && output.length < 10_000, "STEP_TREE_LIMIT")
  if (!Array.isArray(value.steps)) return output
  for (const step of value.steps) {
    requireValue(step && typeof step === "object" && !Array.isArray(step), "INVALID_STEP_NODE")
    const duration = number(step.duration, -1)
    const errors = errorClasses(step.error)
    output.push({ index: output.length, depth, phase: phases.has(step.title) ? step.title : null,
      category: categories.has(step.category) ? step.category : null,
      apiName: apis.has(step.apiName) ? step.apiName : null, location: location(step.location),
      durationMs: duration, state: errors.length ? "recorded-error"
        : duration === null || duration < 0 ? "completion-not-recorded" : "recorded-without-error", errors })
    flatten(step, depth + 1, output)
  }
  return output
}
function minimized(result) {
  const firstError = result.steps.findIndex((step) => step.errors.length)
  const keep = result.steps.filter((step, index) => step.phase || step.errors.length ||
    step.durationMs >= 1000 || index < 12 || index >= result.steps.length - 12 ||
    (firstError >= 0 && index >= Math.max(0, firstError - 8) && index <= firstError + 12))
  return { case: result.case, status: result.status, durationMs: result.durationMs, errors: result.errors,
    recordedCaseLocation: result.location, retry: result.retry, totalRecordedSteps: result.steps.length,
    phases: result.steps.filter((step) => step.phase),
    firstRecordedError: firstError < 0 ? null : result.steps[firstError],
    lastBeforeFirstRecordedError: firstError <= 0 ? null : result.steps.slice(0, firstError)
      .filter((step) => step.state === "recorded-without-error").at(-1) ?? null,
    steps: keep.slice(0, 100), omittedSteps: result.steps.length - Math.min(keep.length, 100) }
}

test("inspect only retained Operations2 HTML step evidence", async () => {
  try {
    requireValue(typeof process.env.RUNNER_TEMP === "string" && path.isAbsolute(process.env.RUNNER_TEMP), "RUNNER_TEMP_REQUIRED")
    const root = path.join(process.env.RUNNER_TEMP, "audit-operations-evidence")
    requireValue(!(await lstat(root)).isSymbolicLink(), "ARTIFACT_ROOT_SYMLINK_REFUSED")
    const metadata = parseJson(await readFile(path.join(process.env.RUNNER_TEMP, "audit-operations-source.json"), "utf8"))
    requireValue(Object.keys(source).every((key) => metadata[key] === source[key]), "PINNED_ARTIFACT_METADATA_MISMATCH")
    const htmls = (await inventory(root)).filter((file) => path.basename(file) === "index.html")
    requireValue(htmls.length === 1, "EXACTLY_ONE_RETAINED_HTML_REQUIRED")
    requireValue((await lstat(htmls[0])).size <= 96 * 1024 * 1024, "RETAINED_HTML_SIZE")
    const html = await readFile(htmls[0], "utf8")
    const assigned = /playwrightReportBase64\s*=\s*["'](?:data:application\/zip;base64,)?([A-Za-z0-9+/=]+)["']/.exec(html)?.[1]
    const dataUrl = /data:application\/zip;base64,([A-Za-z0-9+/=\r\n]+)/.exec(html)?.[1]
    const inlineZip = /(?:^|[^A-Za-z0-9+/])((?:UEsDB)[A-Za-z0-9+/=\r\n]{100,})/.exec(html)?.[1]
    const payload = (assigned ?? dataUrl ?? inlineZip)?.replace(/\s/g, "")
    requireValue(payload && payload.length <= 90 * 1024 * 1024, "RETAINED_REPORT_ZIP_MISSING_OR_LARGE")
    const entries = archive(Buffer.from(payload, "base64"))
    const detailed = new Map()
    let visited = 0
    const visit = (value, depth = 0) => {
      requireValue(depth < 100 && ++visited <= 100_000, "REPORT_STRUCTURE_LIMIT")
      if (!value || typeof value !== "object") return
      if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return }
      if (Array.isArray(value.results) && typeof value.title === "string") {
        const id = /^(OP-PROC-0[123]|OP-IMPORT-01|OP-DOC-01)(?: |$)/.exec(value.title)?.[1]
        if (!id || !cases.has(id)) return
        for (const result of value.results) {
          if (!Array.isArray(result.steps) || !result.steps.length) continue
          requireValue((result.retry ?? 0) === 0 && statuses.has(result.status), "UNEXPECTED_RETAINED_RESULT")
          const steps = flatten(result)
          if ((detailed.get(id)?.steps.length ?? -1) >= steps.length) continue
          detailed.set(id, { case: id, status: result.status, retry: 0, durationMs: number(result.duration),
            location: location(value.location), errors: [...new Set([
              ...errorClasses(result.error), ...(Array.isArray(result.errors) ? result.errors.flatMap(errorClasses) : []),
            ])], steps })
        }
        return
      }
      // Only report hierarchy is visited. Bodies, titles, attachments, stdout/stderr and traces are not traversed.
      for (const key of ["files", "tests", "suites", "specs", "children"]) if (value[key]) visit(value[key], depth + 1)
    }
    entries.forEach((entry) => visit(entry.value))
    requireValue(detailed.size === cases.size && [...cases.keys()].every((id) => detailed.has(id)), "FIVE_RETAINED_CASE_TREES_REQUIRED")
    emit("SOURCE", { ...source, binding: "github-metadata-pinned-download", execution: "retained-artifact-only" })
    for (const id of cases.keys()) emit("RESULT", minimized(detailed.get(id)))
    emit("SUMMARY", { originalRun: source.run, originalArtifact: source.artifact, cases: detailed.size,
      reportJsonEntries: entries.length, qualification: "none", productReplay: false })
  } catch (error) {
    // Node's TAP reporter must never serialize untrusted parser/filesystem error messages or paths.
    throw new AuditError(error instanceof AuditError ? error.message : "RETAINED_ARTIFACT_PARSE_FAILED")
  }
})
