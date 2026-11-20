import test from "node:test"
import { readdir, readFile, lstat } from "node:fs/promises"
import path from "node:path"
import { inflateRawSync } from "node:zlib"

// Temporary retained-evidence reader. No product imports, browser, network, process spawn or replay.
const source = Object.freeze({
  repository: "gustavomhss/Orchestra-SF",
  repositoryId: 1455724710,
  workflow: 416464764,
  attempt: 1,
  run: 44662419134,
  artifact: 14596666417,
  snapshot: "9ea42e72f6aebed5685cd5b2b48df993a1e8f33d",
  digest: "sha256:28ca71a87e76cb8fc85cb370d0da714b5d8e8503f574b396c192c7efa4cd5cd3",
  name: "playwright-ubuntu-24.04-1",
  bytes: 68608517,
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
    [/Request content was evicted from inspector cache|No resource with given identifier found|No data found for resource with given identifier/, "response-body-unavailable"],
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
function archive(buffer, traces = false) {
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
    // Only report JSON, or the original action streams of a specifically bound trace.
    if (traces ? name !== "test.trace" && !/^(?:\d+-)?trace\.trace$/.test(name)
      : name !== "report.json" && !/^[a-f0-9]{16,64}\.json$/.test(name)) continue
    requireValue(!(flags & 1) && [0, 8].includes(method) && size < 16 * 1024 * 1024, "UNSUPPORTED_REPORT_JSON_ENTRY")
    requireValue(local + 30 <= offset && buffer.readUInt32LE(local) === 0x04034b50, "INVALID_ZIP_LOCAL_ENTRY")
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    requireValue(start + compressed <= offset, "ZIP_PAYLOAD_OUT_OF_BOUNDS")
    const raw = buffer.subarray(start, start + compressed)
    const bytes = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: 16 * 1024 * 1024 })
    expanded += bytes.length
    requireValue(bytes.length === size && expanded <= 64 * 1024 * 1024, "ZIP_EXPANSION_LIMIT")
    entries.push(traces ? { name, value: bytes.toString("utf8") }
      : { report: name === "report.json", value: parseJson(bytes.toString("utf8")) })
  }
  requireValue(traces ? entries.length <= 17 && entries.filter((entry) => entry.name === "test.trace").length === 1
    : entries.filter((entry) => entry.report).length === 1, "EXACTLY_ONE_PRIMARY_STREAM_REQUIRED")
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
    recordedCaseLocation: result.location, retry: result.retry, totalRecordedSteps: result.steps.length,
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
    location: recordedLocation, errors: [...new Set([
      ...errorClasses(result.error), ...(Array.isArray(result.errors) ? result.errors.flatMap(errorClasses) : []),
    ])], steps: flatten(result),
    traceAttachments: Array.isArray(result.attachments) ? result.attachments.map(traceAttachment).filter(Boolean) : [] }
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
      const id = /^(OP-PROC-0[123]|OP-IMPORT-01|OP-DOC-01)(?: |$)/.exec(value.title)?.[1]
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
  requireValue(completeCases(detailed), "FIVE_RETAINED_CASE_RESULTS_REQUIRED")
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
          ? /^(OP-PROC-0[123]|OP-IMPORT-01|OP-DOC-01)(?: |$)/.exec(spec.title)?.[1] : undefined
        if (!id || !cases.has(id)) continue
        const recorded = location(spec)
        requireValue(recorded?.file === "packages/app-shell/e2e/sucafina/operations.spec.ts" &&
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
  requireValue(completeCases(detailed), "FIVE_RUNTIME_CASE_RESULTS_REQUIRED")
  return detailed
}

const traceCases = new Map([
  ["OP-PROC-02", "packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--b41a7-while-the-future-PO-changes-chromium/trace.zip"],
  ["OP-PROC-03", "packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--048f9-ssion-without-a-new-version-chromium/trace.zip"],
])
const channels = new Set([
  "BrowserContext.newCDPSession", "BrowserContext.newPage", "CDPSession.send", "CDPSession.detach",
  "Page.reload", "Page.close", "Page.waitForEventInfo",
  "Frame.goto", "Frame.click", "Frame.fill", "Frame.press", "Frame.check", "Frame.uncheck",
  "Frame.selectOption", "Frame.setInputFiles", "Frame.getAttribute", "Frame.innerText", "Frame.textContent",
  "Frame.inputValue", "Frame.expect", "Frame.waitForSelector", "Frame.waitForFunction", "Frame.evaluateExpression",
  "APIRequestContext.fetch", "Response.body",
])
const cdpCommands = new Set([
  "Fetch.enable", "Fetch.getResponseBody", "Fetch.continueRequest", "Fetch.continueResponse",
  "Fetch.fulfillRequest", "Fetch.failRequest", "Fetch.disable", "Network.enable", "Network.disable",
])
function traceAttachment(value) {
  if (!value || typeof value.path !== "string" || value.name !== "trace" || value.contentType !== "application/zip") return null
  const file = value.path.replaceAll("\\", "/")
  const root = "/home/runner/work/Orchestra-SF/Orchestra-SF/"
  const relative = file.startsWith(root) ? file.slice(root.length)
    : file.startsWith("e2e/") ? "packages/app-shell/" + file : file
  return [...traceCases.values()].includes(relative) ? relative : null
}
function traceEvents(entry) {
  const lines = entry.value.split("\n")
  requireValue(lines.length <= 200_000, "TRACE_EVENT_COUNT_LIMIT")
  const events = []
  for (const [sequence, line] of lines.entries()) {
    // The pinned v1.59.1 serializer puts type first, or after version for context.
    // Ignore DOM snapshots, resources, logs and all other event kinds before JSON parsing.
    if (!/^\{(?:"version":8,)?"type":"(?:context-options|before|after|error)"/.test(line)) continue
    requireValue(line.length <= 2 * 1024 * 1024, "TRACE_ACTION_SIZE_LIMIT")
    const event = parseJson(line)
    requireValue(event && typeof event === "object" && !Array.isArray(event), "INVALID_TRACE_ACTION")
    event.auditSequence = sequence
    events.push(event)
  }
  return events
}
function clock(value) {
  requireValue(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER, "INVALID_TRACE_CLOCK")
  return value
}
function traceSummary(id, entries) {
  const primary = entries.filter((entry) => entry.name === "test.trace")
  requireValue(primary.length === 1, "EXACTLY_ONE_TEST_TRACE_REQUIRED")
  const events = traceEvents(primary[0])
  const contexts = events.filter((event) => event.type === "context-options")
  requireValue(contexts.length === 1 && contexts[0].version === 8 && contexts[0].origin === "testRunner" &&
    contexts[0].platform === "linux" && contexts[0].playwrightVersion === "1.59.1", "TRACE_VERSION_OR_ORIGIN_MISMATCH")
  const origin = clock(contexts[0].monotonicTime)
  const offset = (value) => {
    const relative = clock(value) - origin
    requireValue(number(relative) !== null, "TRACE_RELATIVE_TIME_OUT_OF_BOUNDS")
    return relative
  }
  const before = new Map(), after = new Map()
  for (const event of events) {
    if (event.type === "context-options" || event.type === "error") continue
    requireValue(typeof event.callId === "string" && event.callId.length > 0 && event.callId.length < 512, "INVALID_TRACE_CALL_ID")
    const target = event.type === "before" ? before : after
    requireValue(!target.has(event.callId), "DUPLICATE_TEST_TRACE_CALL")
    target.set(event.callId, event)
  }
  requireValue(before.size > 0 && before.size < 100_000, "TEST_TRACE_CALL_COUNT")
  for (const key of after.keys()) requireValue(before.has(key), "TRACE_AFTER_WITHOUT_BEFORE")
  const protocolByStep = new Map()
  let libraryChunks = 0
  for (const entry of entries.filter((entry) => entry.name !== "test.trace")) {
    libraryChunks++
    const actions = traceEvents(entry)
    const contexts = actions.filter((event) => event.type === "context-options")
    requireValue(contexts.length === 1 && contexts[0].version === 8 && contexts[0].origin === "library" &&
      contexts[0].platform === "linux" && contexts[0].playwrightVersion === "1.59.1", "LIBRARY_TRACE_VERSION_OR_ORIGIN_MISMATCH")
    for (const event of actions) {
      if (event.type !== "before" || typeof event.stepId !== "string" || !before.has(event.stepId)) continue
      const channel = event.class + "." + event.method
      if (!channels.has(channel)) continue
      const cdp = channel === "CDPSession.send" && cdpCommands.has(event.params?.method) ? event.params.method : null
      const values = protocolByStep.get(event.stepId) ?? []
      if (!values.some((value) => value.channel === channel && value.cdp === cdp)) values.push({ channel, cdp })
      requireValue(values.length <= 16, "TRACE_STEP_PROTOCOL_LIMIT")
      protocolByStep.set(event.stepId, values)
    }
  }
  const phaseFor = (event) => {
    let current = event
    const seen = new Set()
    for (let depth = 0; current && depth < 80; depth++) {
      requireValue(!seen.has(current.callId), "TRACE_PARENT_CYCLE")
      seen.add(current.callId)
      if (phases.has(current.title)) return current.title
      if (current.parentId === undefined) return null
      current = before.get(current.parentId)
    }
    requireValue(!current, "TRACE_PARENT_DEPTH_LIMIT")
    return null
  }
  const timeline = [...before.values()].map((event, index) => {
    const completed = after.get(event.callId)
    const startMs = offset(event.startTime)
    const endMs = completed ? offset(completed.endTime) : null
    requireValue(endMs === null || endMs >= startMs, "TRACE_NEGATIVE_DURATION")
    const frames = Array.isArray(event.stack) ? event.stack.map(location).filter(Boolean).slice(0, 6) : []
    const errors = completed ? errorClasses(completed.error) : []
    return { index, beforeEventSequence: event.auditSequence, afterEventSequence: completed?.auditSequence ?? null, phase: phaseFor(event), category: categories.has(event.method) ? event.method : null,
      apiName: apis.has(event.title) ? event.title : null, protocol: protocolByStep.get(event.callId) ?? [],
      location: frames[0] ?? null, callerFrames: frames.slice(1), startMs, endMs,
      durationMs: endMs === null ? null : endMs - startMs,
      state: !completed ? "completion-not-recorded" : errors.length ? "recorded-error" : "recorded-without-error", errors }
  }).sort((a, b) => a.startMs - b.startMs || a.index - b.index)
  const ended = timeline.filter((event) => event.endMs !== null).sort((a, b) => a.endMs - b.endMs || a.index - b.index)
  const errors = ended.filter((event) => event.errors.length)
  const firstError = errors[0] ?? null
  const successful = ended.filter((event) => !event.errors.length)
  const pending = timeline.filter((event) => event.endMs === null)
  // TestTracing.appendForError has no timestamp. Its recorded stream position
  // identifies the failure boundary without inventing a clock value.
  const testError = events.find((event) => event.type === "error")
  const boundary = testError?.auditSequence
  const prior = boundary === undefined ? [] : timeline.filter((event) => event.beforeEventSequence < boundary)
  const priorCompleted = boundary === undefined ? [] : successful.filter((event) => event.afterEventSequence < boundary)
  const openAtFailure = boundary === undefined ? [] : prior.filter((event) =>
    event.afterEventSequence === null || event.afterEventSequence > boundary)
  return {
    case: id, traceVersion: 8, playwrightVersion: "1.59.1", primaryClock: "test.trace-monotonic",
    libraryChunks, recordedCalls: timeline.length, pendingCalls: pending.length,
    phases: timeline.filter((event) => phases.has(event.phase) && event.category === "test.step"),
    firstRecordedTestError: testError ? { eventSequence: boundary, errors: errorClasses(testError.message), time: "not-recorded" } : null,
    lastStartedBeforeTestError: prior.slice(-16), lastCompletedBeforeTestError: priorCompleted.slice(-16),
    callsOpenAtTestError: openAtFailure.slice(-16),
    firstRecordedErrorByEndTime: firstError,
    lastCompletedBeforeFirstError: firstError ? successful.filter((event) => event.endMs < firstError.endMs).at(-1) ?? null : null,
    lastCompletedCalls: successful.slice(-16), lastStartedCalls: timeline.slice(-16),
    callsWithoutCompletion: pending.slice(-16), errorsByEndTime: errors.slice(0, 12),
    sourceAttribution: "original-recorded-stack-only", unrecordedPromiseAwait: "not-inferred",
  }
}
async function readProcurementTraces(root, files, results) {
  for (const [id, relative] of traceCases) {
    const result = results.get(id)
    requireValue(result?.status === "timedOut" && result.retry === 0, "EXPECTED_PROCUREMENT_TIMEOUT_REQUIRED")
    const attachments = result.traceAttachments
    requireValue(Array.isArray(attachments) && attachments.length === 1 && attachments[0] === relative, "TRACE_ATTACHMENT_IDENTITY_MISMATCH")
    const matching = files.filter((file) => artifactPath(root, file) === relative)
    requireValue(matching.length === 1, "EXACTLY_ONE_ORIGINAL_TRACE_FILE_REQUIRED")
    const size = (await lstat(matching[0])).size
    requireValue(size > 22 && size <= 64 * 1024 * 1024, "ORIGINAL_TRACE_SIZE_LIMIT")
    const entries = archive(await readFile(matching[0]), true)
    emit("TRACE", traceSummary(id, entries))
  }
}

test("inspect only retained Operations3 report and trace evidence", async () => {
  try {
    requireValue(typeof process.env.RUNNER_TEMP === "string" && path.isAbsolute(process.env.RUNNER_TEMP), "RUNNER_TEMP_REQUIRED")
    const root = path.join(process.env.RUNNER_TEMP, "audit-operations-evidence")
    requireValue(!(await lstat(root)).isSymbolicLink(), "ARTIFACT_ROOT_SYMLINK_REFUSED")
    const metadata = parseJson(await readFile(path.join(process.env.RUNNER_TEMP, "audit-operations-source.json"), "utf8"))
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
    requireValue(runtimes.length === 1 && requests.length === 1, "ORIGINAL_RUNTIME_AND_REQUEST_REQUIRED")
    const recorded = parseJson(await readBounded(requests[0], 64 * 1024))
    const request = recorded.request
    requireValue(recorded.sha === source.snapshot && recorded.platform === "linux" && recorded.arch === "x64" &&
      request?.package === "app" && request.directory === "packages/app-shell" && request.runner === "playwright" &&
      request.config === "e2e/playwright.production.config.ts" && Array.isArray(request.args) &&
      request.args.length === 1 && request.args[0] === "e2e/sucafina/operations.spec.ts", "ORIGINAL_REQUEST_IDENTITY_MISMATCH")
    const originalRuntime = runtimeResults(parseJson(await readBounded(runtimes[0], 16 * 1024 * 1024)))
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
        // A candidate without the actual five-case Playwright report is not selected; never emit its contents.
        invalid++
      }
    }
    emit("REPORT_SELECTION", { htmlCandidates: htmls.length, embeddedZipCandidates: embedded,
      invalidEmbeddedReports: invalid, validEmbeddedReports: valid.length })
    requireValue(valid.length <= 1, "MULTIPLE_VALID_RETAINED_REPORTS")
    const report = valid[0]
    let detailed = report?.detailed
    if (!report) detailed = originalRuntime
    requireValue(detailed && completeCases(detailed), "FIVE_RETAINED_CASE_RESULTS_REQUIRED")
    const format = report ? "html-embedded-report" : "original-playwright-runtime-json"
    emit("SOURCE", { ...source, binding: "github-metadata-pinned-download",
      execution: "retained-artifact-only", format })
    for (const id of cases.keys()) emit("RESULT", minimized(detailed.get(id)))
    await readProcurementTraces(root, files, originalRuntime)
    emit("SUMMARY", { originalRun: source.run, originalArtifact: source.artifact, format, cases: detailed.size,
      casesWithRecordedSteps: [...detailed.values()].filter((result) => result.steps.length > 0).length,
      reportJsonEntries: report?.jsonEntries ?? 1, qualification: "none", productReplay: false })
  } catch (error) {
    // Node's TAP reporter must never serialize untrusted parser/filesystem error messages or paths.
    throw new AuditError(error instanceof AuditError ? error.message : "RETAINED_ARTIFACT_PARSE_FAILED")
  }
})
