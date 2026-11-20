import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { createHash } from "node:crypto"
import { inflateRawSync } from "node:zlib"

const originalRun = 44675679976, originalArtifact = 14602935208
const snapshot = "46a4d879e86077a6ab35f0fd64b3df86e8807a33"
const artifactDigest = "5c5c28592f0c20810b162112f1e1c7dce6722607e1a25ff7b471e13a825b35ea"
const artifactBytes = 1470718
const emit = (kind, value) => console.info("AUDIT_REPORTS_HTML_" + kind + " " + JSON.stringify(value))
function json(value) { try { return JSON.parse(value) } catch { throw new Error("Retained JSON is invalid") } }
function safe(value) {
  return String(value ?? "").replace(/https?:\/\/[^\s)]+/g, "[url]")
    .replace(/(["']).*?\1/g, "[quoted]").replace(/(?:cookie|authorization|password|token|secret)[^\n]*/ig, "[sensitive]")
    .slice(0, 220)
}
function codes(error) {
  const value = String(error?.message ?? error ?? "")
  return [...new Set(value.match(/Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|net::ERR_[A-Z_]+|ECONNRESET|ECONNREFUSED|ETIMEDOUT|Target page, context or browser has been closed|Actual [a-z-]+ (?:GET|POST) transport failed|expect\(received\)\.[a-zA-Z]+/g) ?? [])]
}
function archive(buffer, accepts) {
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  assert.ok(end >= 0, "HTML report ZIP directory exists")
  const count = buffer.readUInt16LE(end + 10), offset = buffer.readUInt32LE(end + 16)
  assert.ok(count > 0 && count < 5000 && offset < buffer.length, "HTML report ZIP inventory bounded")
  const entries = []
  let cursor = offset
  for (let index = 0; index < count; index++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50, "ZIP entry header")
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10)
    const compressed = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24)
    const names = buffer.readUInt16LE(cursor + 28), extras = buffer.readUInt16LE(cursor + 30), comments = buffer.readUInt16LE(cursor + 32)
    const local = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + names).toString("utf8")
    cursor += 46 + names + extras + comments
    if (!accepts(name)) continue
    assert.ok(!(flags & 1) && [0, 8].includes(method) && size < 64 * 1024 * 1024, "JSON ZIP entry supported and bounded")
    assert.equal(buffer.readUInt32LE(local), 0x04034b50, "ZIP local entry header")
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    assert.ok(start + compressed <= buffer.length, "ZIP payload is in archive")
    const raw = buffer.subarray(start, start + compressed)
    const bytes = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: 64 * 1024 * 1024 })
    assert.equal(bytes.length, size, "ZIP JSON byte count matches")
    entries.push({ name, bytes })
  }
  return entries
}
function flatten(value, depth = 0, output = [], parent = null) {
  assert.ok(depth < 80, "HTML step tree bounded")
  for (const step of value.steps ?? []) {
    const raw = String(step.title ?? "")
    const index = output.length
    output.push({ index, parent, depth, title: safe(raw), category: step.category, apiName: step.apiName,
      mode: /[?&]sf=([a-z-]+)/.exec(raw)?.[1], duration: step.duration, startTime: step.startTime,
      failed: Boolean(step.error), error: codes(step.error), location: step.location ? {
        file: path.basename(step.location.file ?? ""), line: step.location.line, column: step.location.column,
      } : undefined })
    flatten(step, depth + 1, output, index)
  }
  return output
}

function selectedTree(flat) {
  const selected = new Set()
  for (const step of flat) {
    const wait = /^Wait\b/i.test(step.title) || /(?:^|\.)waitFor/.test(step.apiName ?? "")
    if (!(step.duration >= 1000 || step.failed || step.error.length || wait || step.index >= flat.length - 45)) continue
    let index = step.index
    while (index !== null && !selected.has(index)) {
      selected.add(index)
      index = flat[index].parent
    }
  }
  const tree = flat.filter((step) => selected.has(step.index))
  return { flatCount: flat.length, selected: tree.length, omitted: flat.length - tree.length, tree }
}

async function retainedArtifact() {
  const token = process.env.REPORTS_ARTIFACT_TOKEN
  delete process.env.REPORTS_ARTIFACT_TOKEN
  assert.ok(token, "Read-only Actions token is available")
  const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  const api = "https://api.github.com/repos/gustavomhss/Orchestra-SF/actions/"
  const get = async (url, options) => {
    try { return await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) }) } catch { throw new Error("Pinned artifact transport unavailable") }
  }
  const runResponse = await get(api + "runs/" + originalRun, { headers, redirect: "error" })
  assert.equal(runResponse.status, 200, "Original run metadata is readable")
  const run = json(await runResponse.text())
  assert.ok(run.id === originalRun && run.head_sha === snapshot && run.run_attempt === 1 && run.status === "completed" && run.conclusion === "failure", "Original completed nominal is pinned")
  const metadataResponse = await get(api + "artifacts/" + originalArtifact, { headers, redirect: "error" })
  assert.equal(metadataResponse.status, 200, "Original artifact metadata is readable")
  const metadata = json(await metadataResponse.text())
  assert.ok(metadata.id === originalArtifact && metadata.workflow_run?.id === originalRun && metadata.workflow_run?.head_sha === snapshot && metadata.expired === false, "Artifact belongs to the exact original nominal")
  assert.ok(metadata.name === "playwright-ubuntu-24.04-1" && metadata.digest === "sha256:" + artifactDigest && metadata.size_in_bytes === artifactBytes, "Artifact digest, name and size are pinned")
  const redirect = await get(api + "artifacts/" + originalArtifact + "/zip", { headers, redirect: "manual" })
  assert.equal(redirect.status, 302, "Artifact download has an explicit redirect")
  let destination
  try { destination = new URL(redirect.headers.get("location") ?? "") } catch { throw new Error("Pinned artifact redirect unavailable") }
  assert.ok(destination.protocol === "https:" && !destination.username && !destination.password, "Artifact redirect is HTTPS")
  // The GitHub token is never sent to the signed download origin or emitted.
  const response = await get(destination, { redirect: "error" })
  assert.equal(response.status, 200, "Pinned ZIP download succeeds")
  assert.ok(response.body, "Pinned ZIP has a stream")
  const chunks = []
  let length = 0
  try {
    for await (const chunk of response.body) {
      length += chunk.byteLength
      assert.ok(length <= artifactBytes, "Pinned ZIP download stays bounded")
      chunks.push(Buffer.from(chunk))
    }
  } catch { throw new Error("Pinned ZIP stream is unavailable or oversized") }
  const bytes = Buffer.concat(chunks)
  assert.equal(bytes.length, artifactBytes, "Pinned ZIP byte count matches")
  assert.equal(createHash("sha256").update(bytes).digest("hex"), artifactDigest, "Pinned ZIP SHA256 matches before parsing")
  emit("PIN", { originalRun, originalArtifact, snapshot, artifactDigest, bytes: bytes.length })
  return bytes
}
function safeTransport(value) {
  const destination = (item) => item && typeof item === "object" ? {
    sameOrigin: item.sameOrigin, samePath: item.samePath, route: item.route, mode: item.mode,
  } : undefined
  return { before: destination(value.before), after: destination(value.after), expected: value.expected && {
    method: value.expected.method, mode: value.expected.mode,
  }, elapsedMs: value.elapsedMs, dropped: value.dropped,
  entries: (value.entries ?? []).map((entry) => ({ ...destination(entry), kind: entry.kind, elapsedMs: entry.elapsedMs,
    method: entry.method, resource: entry.resource, status: entry.status,
    codes: entry.codes, categories: entry.categories })) }
}
function retainedUi(bytes, scenario, result, source) {
  if (!/^RPT-0[24]\b/.test(scenario.title)) return
  const attachments = result.attachments ?? []
  const direct = attachments.filter((item) => item.contentType === "text/markdown" &&
    (item.name === "error-context" || (typeof item.path === "string" && path.basename(item.path) === "error-context.md")))
  const contexts = direct.length
    ? direct.map((attachment) => ({ attachment, reference: attachment.path, body: attachment.body, folderReference: false }))
    : attachments.filter((item) => item.name === "trace" && item.contentType === "application/zip" &&
      typeof item.path === "string" && path.basename(item.path) === "trace.zip")
      .map((attachment) => ({ attachment,
        reference: path.posix.dirname(attachment.path.replaceAll("\\", "/")) + "/error-context.md",
        body: undefined, folderReference: true }))
  const missing = (reason) => emit("UI_MISSING", { title: safe(scenario.title), source, reason,
    attachments: attachments.map((item) => ({ name: safe(item.name), contentType: safe(item.contentType) })) })
  if (!contexts.length) { missing("no-error-context-or-test-result-folder-reference"); return }
  for (const candidate of contexts) {
    const attachment = candidate.attachment
    let content, folder, association
    if (candidate.body) {
      content = Buffer.from(candidate.body, "base64")
      assert.ok(content.length < 64 * 1024 * 1024, "Retained UI attachment bounded")
      association = "inline-attachment"
    } else {
      if (typeof candidate.reference !== "string") { missing("error-context-has-no-reference"); continue }
      const reference = candidate.reference.replaceAll("\\", "/").replace(/^\.\//, "")
      const found = archive(bytes, (entry) => {
        const name = entry.replaceAll("\\", "/").replace(/^\.\//, "")
        return name === reference || (name.includes("/") && reference.endsWith("/" + name)) ||
          (reference.includes("/") && name.endsWith("/" + reference))
      })
      if (!found.length) { missing("error-context-reference-unresolved"); continue }
      assert.ok(found.every((entry) => entry.bytes.equals(found[0].bytes)), "Referenced UI copies are byte-identical")
      content = found[0].bytes
      folder = safe(path.basename(path.dirname(found[0].name)))
      association = candidate.folderReference ? "retained-test-result-folder" : "retained-attachment-reference"
    }
    const context = content.toString("utf8")
    const controls = ["Ask about this review", "Reconcile discussion", "Reconcile action", "Retry same action", "Send reply", "Review this answer"]
    emit("UI", { title: safe(scenario.title), source, association, folder,
      attachment: { name: safe(attachment.name), contentType: safe(attachment.contentType) },
      location: scenario.location ? { file: path.basename(scenario.location.file ?? ""),
        line: scenario.location.line, column: scenario.location.column } : undefined,
      statuses: context.split("\n").filter((line) => /^\s*-\s*status\b/.test(line)).map(safe),
      controls: controls.map((name) => ({ name, nodes: context.split("\n")
        .filter((line) => line.includes('button "' + name + '"')).map((line) => ({ disabled: line.includes("[disabled]") })) })) })
  }
}

test("read the exact retained Reports nominal without executing product tests", async () => {
  const bytes = await retainedArtifact()
  const primary = archive(bytes, (name) => path.basename(name) === "playwright-runtime.json")
  assert.equal(primary.length, 1, "One original runtime JSON report exists")
  const report = json(primary[0].bytes.toString("utf8"))
  const scenarios = []
  const walk = (suite, depth = 0) => {
    assert.ok(depth < 100, "Runtime report tree bounded")
    for (const spec of suite.specs ?? []) for (const item of spec.tests ?? []) for (const result of item.results ?? [])
      scenarios.push({ title: spec.title, location: { file: path.basename(spec.file ?? ""), line: spec.line, column: spec.column }, result })
    for (const child of suite.suites ?? []) walk(child, depth + 1)
  }
  for (const suite of report.suites ?? []) walk(suite)
  assert.equal(scenarios.length, 4, "Four original scenario results exist")
  const detailed = new Map()
  let installations = 0
  const select = (value, result) => {
    assert.ok(/^RPT-0[1-4]\b/.test(value.title), "Only original Reports scenarios are inspected")
    assert.equal(result.retry ?? 0, 0, "No retry is included")
    const flat = flatten(result)
    const key = value.title
    if ((detailed.get(key)?.stepCount ?? -1) >= flat.length) return
    detailed.set(key, { title: safe(value.title), location: value.location ? {
      file: path.basename(value.location.file ?? ""), line: value.location.line, column: value.location.column,
    } : undefined, status: result.status, duration: result.duration, errors: (result.errors ?? []).map(codes), stepCount: flat.length, tree: flat })
  }
  const body = (attachment) => {
    if (attachment.body) {
      const value = Buffer.from(attachment.body, "base64")
      assert.ok(value.length < 64 * 1024 * 1024, "Metadata attachment bounded")
      return value
    }
    assert.ok(attachment.path, "Metadata attachment has a retained path")
    const found = archive(bytes, (name) => path.basename(name) === path.basename(attachment.path))
    assert.ok(found.length > 0, "Selected metadata attachment exists")
    assert.ok(found.every((entry) => entry.bytes.equals(found[0].bytes)), "Duplicate retained metadata is byte-identical")
    return found[0].bytes
  }
  for (const scenario of scenarios) {
    select(scenario, scenario.result)
    emit("SCENARIO", { title: safe(scenario.title), location: scenario.location, status: scenario.result.status,
      duration: scenario.result.duration, retry: scenario.result.retry ?? 0, errors: (scenario.result.errors ?? []).map(codes) })
    retainedUi(bytes, scenario, scenario.result, "runtime-json")
    for (const attachment of scenario.result.attachments ?? []) {
      if (attachment.contentType !== "application/json") continue
      const transport = typeof attachment.name === "string" && attachment.name.startsWith("reports-") && attachment.name.endsWith("-transport")
      const timing = typeof attachment.name === "string" && /timing|performance|export-duration/.test(attachment.name)
      if (attachment.name !== "reports-installation" && !transport && !timing) continue
      const value = json(body(attachment).toString("utf8"))
      if (attachment.name === "reports-installation") {
        assert.equal(value.candidateSnapshot, snapshot, "Original installed candidate is pinned")
        installations++
      }
      if (transport) emit("TRANSPORT", { line: scenario.location.line, name: safe(attachment.name), ...safeTransport(value) })
      if (timing) emit("TIMING", { line: scenario.location.line, name: safe(attachment.name),
        values: Object.fromEntries(Object.entries(value).filter(([, value]) => typeof value === "number" || typeof value === "boolean")) })
    }
  }
  assert.equal(installations, 4, "Four original installation manifests were verified")
  const located = (step) => typeof step.location?.file === "string" && step.location.file.length > 0 && Number.isInteger(step.location.line)
  const primaryComplete = () => detailed.size === 4 && [...detailed.values()].every((value) =>
    value.tree.some((step) => (step.category === "pw:api" || typeof step.apiName === "string") && located(step)))
  let htmlReports = 0
  if (!primaryComplete()) {
    detailed.clear()
    const htmls = archive(bytes, (name) => path.basename(name) === "index.html")
    for (const entry of htmls) {
      const html = entry.bytes.toString("utf8")
      const assigned = /playwrightReportBase64\s*=\s*["'](?:data:application\/zip;base64,)?([A-Za-z0-9+/=]+)["']/.exec(html)?.[1]
      const dataUrl = /data:application\/zip;base64,([A-Za-z0-9+/=\r\n]+)/.exec(html)?.[1]
      const inlineZip = /(?:^|[^A-Za-z0-9+/])((?:UEsDB)[A-Za-z0-9+/=\r\n]{100,})/.exec(html)?.[1]
      const payload = (assigned ?? dataUrl ?? inlineZip)?.replace(/\s/g, "")
      if (!payload) continue
      htmlReports++
      const visit = (value, depth = 0) => {
        assert.ok(depth < 100, "HTML result JSON tree bounded")
        if (!value || typeof value !== "object") return
        if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return }
        if (Array.isArray(value.results) && typeof value.title === "string" && /^RPT-0[1-4]\b/.test(value.title)) {
          for (const result of value.results) if (Array.isArray(result.steps) && result.steps.length) {
            select(value, result)
            retainedUi(bytes, value, result, "retained-html")
          }
          return
        }
        for (const [key, item] of Object.entries(value)) if (!["attachments", "body", "errors", "error", "steps"].includes(key)) visit(item, depth + 1)
      }
      for (const item of archive(Buffer.from(payload, "base64"), (name) => name.endsWith(".json"))) visit(json(item.bytes.toString("utf8")))
    }
    assert.equal(htmlReports, 1, "One retained HTML fallback report was inspected")
  }
  const complete = htmlReports
    ? detailed.size === 4 && [...detailed.values()].every((value) => value.tree.length > 0 && value.tree.some(located))
    : primaryComplete()
  assert.ok(complete, "Four detailed scenario step trees with source locations were inspected")
  for (const result of detailed.values()) emit("RESULT", { ...result, ...selectedTree(result.tree) })
  emit("SUMMARY", { originalRun, originalArtifact, snapshot, artifactDigest, inspected: detailed.size, installations,
    source: htmlReports ? "retained-html" : "runtime-json", tracesRead: 0, productTestsRun: 0 })
})
