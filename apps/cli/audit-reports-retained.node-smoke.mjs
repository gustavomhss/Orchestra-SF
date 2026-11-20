import test from "node:test"
import { readdir, readFile, lstat } from "node:fs/promises"
import path from "node:path"
import { inflateRawSync } from "node:zlib"

// Temporary retained-evidence reader. No product imports, browser, network, process spawn or replay.
const source = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  run: 44660375065,
  artifact: 14596071954,
  snapshot: "4cdba6118ff547d9ed23cd5cdb284e55e218d675",
  digest: "sha256:2c1bb49b65772852b63c762a632ea6b12acfddf5bfd6c7088a9ae47d9a4eb488",
  name: "playwright-ubuntu-24.04-1",
  bytes: 365836,
})
const cases = new Map([["RPT-01", 26], ["RPT-02", 41], ["RPT-03", 107], ["RPT-04", 123]])
const phases = new Set([
  "Prepare and explicitly preserve the authorized dossier",
  "Edit the real January source once without refreshing the capture",
  "Download DOCX and assert values, periods, all identities and the long-note tail",
  "Download PPTX and inspect every content slide",
  "Open and reload the real meeting URL",
  "Follow the captured source reference to current data with the same reporting year",
  "Confirm through the installed Review controls against the exact visible preserved projection",
  "Reuse after reopening without writing a new confirmation",
  "Keep question, reply and edit drafts through repeated authorized read loss without sending",
  "Edit once through Review; reject old selector/reuse and read the exact original through history",
  "Recover a committed edit after its response is lost, using only the exact original intent",
  "Revoke, deny retained old credentials, and verify a fresh positive control",
])
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
const paths = new Set([
  "reports.spec.ts",
  "installed-shell.ts",
  "reports-support/agenda-transport.spec.ts",
  "reports-support/confirmation.ts",
  "reports-support/corpus.ts",
  "reports-support/failed-edit-request.ts",
  "reports-support/fixture.ts",
  "reports-support/human-answer-flow.ts",
  "reports-support/lost-created-thread-read.ts",
  "reports-support/lost-edit-response.ts",
  "reports-support/lost-reply-response.ts",
  "reports-support/model.ts",
  "reports-support/ooxml.ts",
  "reports-support/production-installation.ts",
  "reports-support/production-state.ts",
  "reports-support/read-reconciliation.ts",
  "reports-support/review-flow.ts",
  "reports-support/revocation.ts",
].map((file) => "packages/app-shell/e2e/sucafina/" + file))
const statuses = new Set(["passed", "failed", "timedOut", "skipped", "interrupted"])
const emit = (kind, value) => console.info("AUDIT_REPORTS_RETAINED_" + kind + " " + JSON.stringify(value))

class AuditError extends Error {
  constructor(code) { super(code); this.name = "RetainedReportsAuditError" }
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
    [/Request content was evicted from inspector cache|No resource with given identifier found|No data found for resource with given identifier/, "response-body-unavailable"],
    [/element\(s\) not found/, "expected-element-not-found"],
    [/net::ERR_CONNECTION_RESET|ECONNRESET/, "connection-reset"],
    [/net::ERR_CONNECTION_REFUSED|ECONNREFUSED/, "connection-refused"],
    [/net::ERR_TIMED_OUT|ETIMEDOUT/, "connection-timeout"],
    [/AssertionError|expect\((?:received|locator)\)/, "assertion"],
  ]
  const found = rules.filter(([pattern]) => pattern.test(message)).map(([, code]) => code)
  return found.length ? found : ["unclassified-error"]
}
function errorLocations(error) {
  if (!error || typeof error !== "object") return []
  const found = []
  const direct = location(error.location)
  if (direct) found.push(direct)
  // A stack contributes only an already allowlisted repository path and bounded line/column.
  // Its message, source excerpts, absolute directories and URLs are never emitted.
  const stack = typeof error.stack === "string" ? error.stack : ""
  for (const line of stack.split(/\r?\n/).slice(0, 200)) {
    const match = /(?:^|[\s(])((?:\/home\/runner\/work\/Orchestra-SF\/Orchestra-SF\/)?(?:packages\/app-shell\/e2e\/sucafina\/|e2e\/sucafina\/|sucafina\/)[A-Za-z0-9_./-]+\.tsx?):([0-9]{1,6}):([0-9]{1,5})(?:\)|\s|$)/.exec(line)
    const checked = match ? location({ file: match[1], line: Number(match[2]), column: Number(match[3]) }) : null
    if (checked) found.push(checked)
  }
  return [...new Map(found.map((item) => [JSON.stringify(item), item])).values()]
}
function pageSnapshot(markdown) {
  // Only the Page snapshot fence is classified. Error details and Test source can
  // quote the expected UI, so reading their labels would fabricate a present landmark.
  const heading = /^#{1,6} Page snapshot[ \t]*\r?$/m.exec(markdown)
  if (!heading) return undefined
  const after = markdown.slice(heading.index + heading[0].length)
  const fence = /^\s*\x60{3}(?:yaml|yml|text)?[ \t]*\r?\n([\s\S]*?)\r?\n\x60{3}(?:\r?\n|$)/.exec(after)
  return fence?.[1]
}
function snapshotMarkers(snapshot) {
  const rows = snapshot.split(/\r?\n/).flatMap((line) => {
    const entry = /^\s*-\s+(generic|paragraph|status|heading|alert|toolbar|textbox|combobox|button|region)(.*)$/.exec(line)
    if (!entry) return []
    const tail = entry[2].trim()
    const named = /^"([^"]*)"(?:\s+\[[^\]]*\])?(?::|$)/.exec(tail)?.[1]
    const content = tail.startsWith(":") ? tail.slice(1).trim().replace(/^"(.*)"$/, "$1") : undefined
    return [{ role: entry[1], label: named ?? content }]
  })
  // Source-owned labels from owner-runtime231, sf-context, sf-u25, sf-u33,
  // reports/index and the shell error page. Nothing from user/source content is emitted.
  const rules = [
    ["route-not-admitted", ["status", "paragraph", "generic"], ["Sucafina route not admitted"]],
    ["installation-selection-required", ["status", "paragraph", "generic"], ["Sucafina installation selection required"]],
    ["installation-discovery-resolving", ["status", "paragraph", "generic"], ["Resolving installed Sucafina"]],
    ["installation-unavailable-or-unauthorized", ["status", "paragraph", "generic"], ["Sucafina installation unavailable or unauthorized"]],
    ["context-toolbar", ["toolbar"], ["Context and access", "Contexto e acesso"]],
    ["context-unavailable-label", ["status", "paragraph", "generic", "alert"], ["Currently unavailable", "Indisponível no momento"]],
    ["context-denied-label", ["status", "paragraph", "generic", "alert"], ["You do not have access to this content.", "Você não tem acesso a este conteúdo."]],
    ["context-sign-in-label", ["status", "paragraph", "generic", "alert"], ["Sign in again to continue.", "Entre novamente para continuar."]],
    ["context-mismatch-label", ["status", "paragraph", "generic", "alert"], ["This context no longer matches the installed host.", "Este contexto não corresponde mais ao host instalado."]],
    ["loading-label", ["status", "paragraph", "generic"], ["Loading…", "Carregando…"]],
    ["context-selection-label", ["status", "paragraph", "generic"], ["Select server, project and installation to continue.", "Selecione servidor, projeto e instalação para continuar."]],
    ["report-heading", ["heading"], ["Report", "Relatório"]],
    ["report-format-control", ["combobox"], ["Format"]],
    ["report-title-control", ["textbox"], ["Title"]],
    ["report-generate-control", ["button"], ["Generate Report", "Generate report", "Gerar relatório"]],
    ["agenda-heading", ["heading"], ["Meeting agenda", "Pauta da reunião"]],
    ["preserved-meeting-region", ["region"], ["Preserved review meeting"]],
    ["shell-render-error-heading", ["heading"], ["Something went wrong", "Algo deu errado"]],
    ["shell-render-error-details", ["textbox"], ["Error Details", "Detalhes do erro"]],
  ]
  const markers = rules.filter(([, roles, labels]) => rows.some((row) => roles.includes(row.role) && labels.includes(row.label))).map(([code]) => code)
  const renderErrors = markers.includes("shell-render-error-heading")
    ? [[/\bTypeError\b/, "type-error"], [/\bReferenceError\b/, "reference-error"],
      [/\bRangeError\b/, "range-error"], [/\bSyntaxError\b/, "syntax-error"],
      [/Maximum call stack size exceeded/, "stack-overflow"]]
      .filter(([pattern]) => pattern.test(snapshot)).map(([, code]) => code) : []
  return { markers, renderErrors }
}
async function inspectErrorContext(root, files) {
  const expected = "packages/app-shell/e2e/test-results/sucafina-reports-CI-UI-REP-13ecb-ollowing-the-current-source-chromium/error-context.md"
  const matching = files.filter((file) => artifactPath(root, file) === expected)
  requireValue(matching.length <= 1, "RPT01_ERROR_CONTEXT_AMBIGUOUS")
  if (!matching.length) {
    emit("RPT01_CONTEXT", { case: "RPT-01", contextEvidence: "not-recorded", pageSnapshotEvidence: "not-recorded",
      markers: [], renderErrors: [], qualification: "none" })
    return
  }
  const snapshot = pageSnapshot(await readBounded(matching[0], 2 * 1024 * 1024))
  emit("RPT01_CONTEXT", { case: "RPT-01", contextEvidence: "recorded",
    pageSnapshotEvidence: snapshot === undefined ? "not-recorded" : "recorded",
    ...(snapshot === undefined ? { markers: [], renderErrors: [] } : snapshotMarkers(snapshot)),
    meaning: "observed-source-owned-labels-only", absentMarkerIsNotProof: true, qualification: "none" })
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
    stepEvidence: result.steps.length ? "recorded" : "not-recorded",
    recordedCaseLocation: result.location, recordedErrorLocations: result.errorLocations,
    retry: result.retry, totalRecordedSteps: result.steps.length,
    phases: result.steps.filter((step) => step.phase),
    firstRecordedError: firstError < 0 ? null : result.steps[firstError],
    lastBeforeFirstRecordedError: firstError <= 0 ? null : result.steps.slice(0, firstError)
      .filter((step) => step.state === "recorded-without-error").at(-1) ?? null,
    steps: keep.slice(0, 100), omittedSteps: result.steps.length - Math.min(keep.length, 100) }
}

function artifactPath(root, file) {
  const relative = path.relative(root, file).split(path.sep).join("/")
  return relative.startsWith(source.name + "/") ? relative.slice(source.name.length + 1) : relative
}
async function readBounded(file, limit) {
  const size = (await lstat(file)).size
  requireValue(size > 0 && size <= limit, "RETAINED_FILE_SIZE")
  return readFile(file, "utf8")
}
function resultRecord(id, result, recordedLocation) {
  requireValue((result.retry ?? 0) === 0 && statuses.has(result.status), "UNEXPECTED_RETAINED_RESULT")
  return { case: id, status: result.status, retry: 0, durationMs: number(result.duration),
    location: recordedLocation, errorLocations: [...new Map([result.error, ...(Array.isArray(result.errors) ? result.errors : [])]
      .flatMap(errorLocations).map((item) => [JSON.stringify(item), item])).values()], errors: [...new Set([
      ...errorClasses(result.error), ...(Array.isArray(result.errors) ? result.errors.flatMap(errorClasses) : []),
    ])], steps: flatten(result) }
}
function completeCases(detailed) {
  return detailed.size === cases.size && [...cases.keys()].every((id) => detailed.has(id))
}
function htmlResults(entries) {
  const detailed = new Map()
  let visited = 0
  const visit = (value, depth = 0) => {
    requireValue(depth < 100 && ++visited <= 100_000, "REPORT_STRUCTURE_LIMIT")
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return }
    if (Array.isArray(value.results) && typeof value.title === "string") {
      const id = /^(RPT-0[1234])(?: |$)/.exec(value.title)?.[1]
      if (!id || !cases.has(id)) return
      for (const result of value.results) {
        const retained = resultRecord(id, result, location(value.location))
        if ((detailed.get(id)?.steps.length ?? -1) >= retained.steps.length) continue
        detailed.set(id, retained)
      }
      return
    }
    // Only report hierarchy is visited. Bodies, titles, attachments, stdout/stderr and traces are not traversed.
    for (const key of ["files", "tests", "suites", "specs", "children"]) if (value[key]) visit(value[key], depth + 1)
  }
  entries.forEach((entry) => visit(entry.value))
  requireValue(completeCases(detailed), "FOUR_RETAINED_CASE_RESULTS_REQUIRED")
  return detailed
}
function runtimeResults(report) {
  const detailed = new Map()
  let visited = 0
  const visit = (suites, depth = 0) => {
    requireValue(Array.isArray(suites) && depth < 80, "INVALID_RUNTIME_SUITE_TREE")
    for (const suite of suites) {
      requireValue(++visited < 10_000 && suite && typeof suite === "object", "RUNTIME_SUITE_LIMIT")
      for (const spec of suite.specs ?? []) {
        const id = typeof spec.title === "string"
          ? /^(RPT-0[1234])(?: |$)/.exec(spec.title)?.[1] : undefined
        if (!id || !cases.has(id)) continue
        const recorded = location(spec)
        requireValue(recorded?.file === "packages/app-shell/e2e/sucafina/reports.spec.ts" &&
          recorded.line === cases.get(id), "RUNTIME_CASE_SOURCE_MISMATCH")
        requireValue(Array.isArray(spec.tests) && spec.tests.length === 1 && !detailed.has(id), "RUNTIME_CASE_AMBIGUOUS")
        const selected = spec.tests[0]
        requireValue(selected && (selected.projectName === "chromium" || selected.projectId === "chromium") &&
          Array.isArray(selected.results) && selected.results.length === 1, "RUNTIME_PROJECT_OR_RETRY_MISMATCH")
        detailed.set(id, resultRecord(id, selected.results[0], recorded))
      }
      if (suite.suites !== undefined) visit(suite.suites, depth + 1)
    }
  }
  visit(report.suites)
  requireValue(completeCases(detailed), "FOUR_RUNTIME_CASE_RESULTS_REQUIRED")
  return detailed
}

test("inspect only retained Reports2 report evidence", async () => {
  try {
    requireValue(typeof process.env.RUNNER_TEMP === "string" && path.isAbsolute(process.env.RUNNER_TEMP), "RUNNER_TEMP_REQUIRED")
    const root = path.join(process.env.RUNNER_TEMP, "audit-reports-evidence")
    requireValue(!(await lstat(root)).isSymbolicLink(), "ARTIFACT_ROOT_SYMLINK_REFUSED")
    const metadata = parseJson(await readFile(path.join(process.env.RUNNER_TEMP, "audit-reports-source.json"), "utf8"))
    requireValue(Object.keys(source).every((key) => metadata[key] === source[key]), "PINNED_ARTIFACT_METADATA_MISMATCH")
    const files = await inventory(root)
    const htmls = files.filter((file) => {
      const relative = artifactPath(root, file)
      return relative.startsWith("packages/app-shell/e2e/playwright-report/") &&
        relative.endsWith(".html") && !relative.includes("/data/")
    })
    const runtimes = files.filter((file) => artifactPath(root, file) === "test-ci-evidence/playwright-runtime.json")
    const requests = files.filter((file) => artifactPath(root, file) === "test-ci-evidence/request.json")
    emit("INVENTORY", { files: files.length, htmlCandidates: htmls.length,
      originalRuntimeJsonCandidates: runtimes.length, originalRequestJsonCandidates: requests.length })
    requireValue(htmls.length <= 32, "HTML_CANDIDATE_LIMIT")
    const valid = []
    let totalHtmlBytes = 0
    let embedded = 0
    let invalid = 0
    for (const file of htmls) {
      totalHtmlBytes += (await lstat(file)).size
      requireValue(totalHtmlBytes <= 128 * 1024 * 1024, "HTML_TOTAL_SIZE_LIMIT")
      const html = await readBounded(file, 96 * 1024 * 1024)
      const assigned = /playwrightReportBase64\s*=\s*["'](?:data:application\/zip;base64,)?([A-Za-z0-9+/=]+)["']/.exec(html)?.[1]
      const dataUrl = /data:application\/zip;base64,([A-Za-z0-9+/=\r\n]+)/.exec(html)?.[1]
      const inlineZip = /(?:^|[^A-Za-z0-9+/])((?:UEsDB)[A-Za-z0-9+/=\r\n]{100,})/.exec(html)?.[1]
      const payload = (assigned ?? dataUrl ?? inlineZip)?.replace(/\s/g, "")
      if (!payload) continue
      embedded++
      requireValue(payload.length <= 90 * 1024 * 1024, "RETAINED_REPORT_ZIP_TOO_LARGE")
      try {
        const entries = archive(Buffer.from(payload, "base64"))
        valid.push({ detailed: htmlResults(entries), jsonEntries: entries.length })
      } catch {
        // A candidate without the actual four-case Playwright report is not selected; never emit its contents.
        invalid++
      }
    }
    emit("REPORT_SELECTION", { htmlCandidates: htmls.length, embeddedZipCandidates: embedded,
      invalidEmbeddedReports: invalid, validEmbeddedReports: valid.length })
    requireValue(valid.length <= 1, "MULTIPLE_VALID_RETAINED_REPORTS")
    const report = valid[0]
    let detailed = report?.detailed
    if (!report) {
      // The original snapshot's test-ci.yml:229-232 writes this JSON and :349-352 uploads it.
      // Its sibling request proves the snapshot and exact Playwright selection before any result is consumed.
      requireValue(runtimes.length === 1 && requests.length === 1, "ORIGINAL_RUNTIME_AND_REQUEST_REQUIRED")
      const recorded = parseJson(await readBounded(requests[0], 64 * 1024))
      const request = recorded.request
      requireValue(recorded.sha === source.snapshot && recorded.platform === "linux" && recorded.arch === "x64" &&
        request?.package === "app" && request.directory === "packages/app-shell" && request.runner === "playwright" &&
        request.config === "e2e/playwright.production.config.ts" && Array.isArray(request.args) &&
        request.args.length === 1 && request.args[0] === "e2e/sucafina/reports.spec.ts", "ORIGINAL_REQUEST_IDENTITY_MISMATCH")
      detailed = runtimeResults(parseJson(await readBounded(runtimes[0], 16 * 1024 * 1024)))
    }
    requireValue(detailed && completeCases(detailed), "FOUR_RETAINED_CASE_RESULTS_REQUIRED")
    const format = report ? "html-embedded-report" : "original-playwright-runtime-json"
    emit("SOURCE", { ...source, binding: "github-metadata-pinned-download",
      execution: "retained-artifact-only", format })
    for (const id of cases.keys()) emit("RESULT", minimized(detailed.get(id)))
    await inspectErrorContext(root, files)
    emit("SUMMARY", { originalRun: source.run, originalArtifact: source.artifact, format, cases: detailed.size,
      casesWithRecordedSteps: [...detailed.values()].filter((result) => result.steps.length > 0).length,
      reportJsonEntries: report?.jsonEntries ?? 1, qualification: "none", productReplay: false })
  } catch (error) {
    // Node's TAP reporter must never serialize untrusted parser/filesystem error messages or paths.
    throw new AuditError(error instanceof AuditError ? error.message : "RETAINED_ARTIFACT_PARSE_FAILED")
  }
})
