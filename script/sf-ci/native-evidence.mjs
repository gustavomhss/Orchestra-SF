import { createHash } from "node:crypto"
import { constants, openSync, closeSync, fstatSync, readFileSync, lstatSync, realpathSync } from "node:fs"
import path from "node:path"

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
export const NATIVE_SPECS = Object.freeze({
  teams: "e2e/sucafina/native/teams-profile-linux.spec.ts",
  u15: "e2e/sucafina/native/journeys/u15.spec.ts",
  u39: "e2e/sucafina/native/journeys/u39.spec.ts",
  u40: "e2e/sucafina/native/journeys/u40.spec.ts",
  recovery: "e2e/sucafina/native/teams-profile-recovery-linux.spec.ts",
})
const NATIVE_ORIGINAL_COUNTS = Object.freeze({ u15: 6, u39: 22, u40: 22 })
const NATIVE_ACCEPTANCE_IDS = Object.freeze({
  teams: ["A01", "A16", "A17", "A18", "A20", "A33", "A35", "A36", "A37", "A40", "A41", "A42", "A44", "A45"],
  u15: [], u39: [], u40: [], recovery: ["A30", "A36", "A45", "A46"],
})
export const NATIVE_CASE_LEDGER = "sf/ci/team-profile-native-cases.json"
export const nativeFail = () => { throw new Error("SF_CI_FAIL_CLOSED: invalid private native evidence") }
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const isCommit = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
function nativeExact(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) nativeFail()
}
function nativeJson(bytes) {
  // Playwright 1.59.1's JSON reporter writes JSON.stringify(report, undefined, 2).
  // Exact serialization also rejects duplicate/escaped-duplicate object keys.
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > 16 * 1024 * 1024) nativeFail()
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = JSON.parse(text), canonical = JSON.stringify(value, null, 2)
    if (text !== canonical && text !== canonical + "\n") nativeFail()
    return value
  } catch { nativeFail() }
}
function nativeBinding(value, meta) {
  if (value.sourceSHA !== meta.sha || value.sourceTreeSHA !== meta.treeSha ||
      value.runId !== meta.runId || value.runAttempt !== meta.attempt ||
      value.role !== meta.role || value.invocationId !== meta.invocationId) nativeFail()
}
function nativeCaseDeclarations(source) {
  const pattern = /^\s*(?:test|nativeInstalledFixture)\(("(?:[^"\\]|\\.)*"),\s*async\b/gm
  return [...source.matchAll(pattern)].map((match) => ({
    title: JSON.parse(match[1]),
    line: source.slice(0, match.index + match[0].indexOf(match[0].trimStart())).split("\n").length,
  }))
}

/**
 * Validate and minimize one actual JSON-reporter invocation. This is deliberately
 * not an installed-host verdict: final qualification must independently admit the
 * F04 host/transport and the other gates against these exact observation hashes.
 */
export function recordTeamsProfileNative({ rawReport, inventoryBytes, hostBytes, artifactBytes,
  ledgerBytes, sourceBytes, sourceProvenance, meta, exitCode }) {
  nativeExact(meta, ["sha", "treeSha", "runId", "attempt", "role", "invocationId"])
  if (!isCommit(meta.sha) || !isCommit(meta.treeSha) || !/^[1-9][0-9]*$/.test(meta.runId) ||
      !/^[1-9][0-9]*$/.test(meta.attempt) || !Object.hasOwn(NATIVE_SPECS, meta.role) ||
      !/^[a-f0-9]{32}$/.test(meta.invocationId) || exitCode !== 0) nativeFail()
  nativeExact(sourceProvenance, ["commitSha256", "inventorySha256"])
  if (!Object.values(sourceProvenance).every(isDigest) || !Buffer.isBuffer(sourceBytes)) nativeFail()
  const ledger = nativeJson(ledgerBytes)
  nativeExact(ledger, ["schema", "scope", "roles"])
  if (ledger.schema !== "teams-profile-native-case-ledger.v1") nativeFail()
  nativeExact(ledger.roles, Object.keys(NATIVE_SPECS))
  const role = ledger.roles[meta.role], specFile = NATIVE_SPECS[meta.role]
  nativeExact(role, ["specFile", "status", "requiredAcceptanceIds", "cases"])
  if (role.specFile !== specFile ||
      !["PRESERVED_SOURCE_OBLIGATIONS", "IMPLEMENTED_SOURCE_OBLIGATIONS"].includes(role.status) ||
      !Array.isArray(role.cases) || role.cases.length < 1 || role.cases.length > 256 ||
      (NATIVE_ORIGINAL_COUNTS[meta.role] && role.cases.length !== NATIVE_ORIGINAL_COUNTS[meta.role])) nativeFail()
  if (JSON.stringify(role.requiredAcceptanceIds) !== JSON.stringify(NATIVE_ACCEPTANCE_IDS[meta.role]) ||
      !Array.isArray(role.requiredAcceptanceIds) ||
      role.requiredAcceptanceIds.some((id) => typeof id !== "string" || !/^A(?:0[1-9]|[1-3][0-9]|4[0-6])$/.test(id)) ||
      new Set(role.requiredAcceptanceIds).size !== role.requiredAcceptanceIds.length) nativeFail()
  const declarations = nativeCaseDeclarations(new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes))
  if (declarations.length !== role.cases.length) nativeFail()
  const names = new Set(), identifiers = new Set(), acceptance = new Set()
  role.cases.forEach((item, index) => {
    nativeExact(item, ["id", "title", "fixtureCase", "acceptanceIds"])
    if (item.id !== meta.role + "-" + String(index + 1).padStart(2, "0") ||
        typeof item.title !== "string" || !item.title || item.title !== declarations[index].title ||
        names.has(item.title) || identifiers.has(item.id) ||
        !["entry", "list", "edit", "empty", "source", "readonly", "denied", "revoked", "stale", "lost", "late", "teams", "recovery"].includes(item.fixtureCase) ||
        !Array.isArray(item.acceptanceIds) || item.acceptanceIds.some((id) => !role.requiredAcceptanceIds.includes(id)) ||
        new Set(item.acceptanceIds).size !== item.acceptanceIds.length) nativeFail()
    names.add(item.title); identifiers.add(item.id)
    item.acceptanceIds.forEach((id) => acceptance.add(id))
  })
  if (role.requiredAcceptanceIds.some((id) => !acceptance.has(id))) nativeFail()
  const inventory = nativeJson(inventoryBytes)
  nativeExact(inventory, ["schema", "sourceSHA", "sourceTreeSHA", "runId", "runAttempt", "role",
    "invocationId", "specFile", "specSha256", "caseLedgerSha256", "cases"])
  nativeBinding(inventory, meta)
  if (inventory.schema !== "teams-profile-native-inventory.v1" || inventory.specFile !== specFile ||
      inventory.specSha256 !== digest(sourceBytes) || inventory.caseLedgerSha256 !== digest(ledgerBytes) ||
      !Array.isArray(inventory.cases) || inventory.cases.length !== role.cases.length) nativeFail()
  const expected = new Map()
  inventory.cases.forEach((item, index) => {
    nativeExact(item, ["id", "title", "line", "column", "fixtureCase", "acceptanceIds"])
    const planned = role.cases[index]
    if (item.id !== planned.id || item.title !== planned.title || item.fixtureCase !== planned.fixtureCase ||
        JSON.stringify(item.acceptanceIds) !== JSON.stringify(planned.acceptanceIds) ||
        item.line !== declarations[index].line || !Number.isSafeInteger(item.column) || item.column < 1) nativeFail()
    expected.set(item.title, item)
  })
  const artifact = nativeJson(artifactBytes)
  nativeExact(artifact, ["schema", "sourceSHA", "sourceTreeSHA", "runId", "runAttempt", "archiveSha256",
    "archiveBytes", "manifestSha256", "inventorySha256", "artifactId", "artifactDigest", "producerReceiptSha256"])
  if (artifact.schema !== "teams-profile-native-artifact-binding.v1" ||
      artifact.sourceSHA !== meta.sha || artifact.sourceTreeSHA !== meta.treeSha ||
      artifact.runId !== meta.runId || artifact.runAttempt !== meta.attempt ||
      !/^[1-9][0-9]*$/.test(artifact.artifactId) || !Number.isSafeInteger(artifact.archiveBytes) || artifact.archiveBytes < 1 ||
      ![artifact.archiveSha256, artifact.manifestSha256, artifact.inventorySha256, artifact.producerReceiptSha256].every(isDigest) ||
      !/^sha256:[a-f0-9]{64}$/.test(artifact.artifactDigest)) nativeFail()
  const host = nativeJson(hostBytes)
  nativeExact(host, ["schema", "proofClass", "sourceSHA", "sourceTreeSHA", "runId", "runAttempt", "role",
    "invocationId", "archiveSha256", "rawReportSha256", "expectedInventorySha256", "manifestSha256",
    "selectionSha256", "registryObservationSha256", "installedClosureSha256", "actors", "cases"])
  nativeBinding(host, meta)
  if (host.schema !== "teams-profile-native-host-observation.v1" ||
      host.proofClass !== "REVALIDATED_PREREQUISITES_NOT_UI_PASS" ||
      host.archiveSha256 !== artifact.archiveSha256 || host.rawReportSha256 !== digest(rawReport) ||
      host.expectedInventorySha256 !== digest(inventoryBytes) ||
      ![host.manifestSha256, host.selectionSha256, host.registryObservationSha256, host.installedClosureSha256].every(isDigest) ||
      !Array.isArray(host.actors) || ![3, 4].includes(host.actors.length) ||
      !Array.isArray(host.cases) || host.cases.length !== role.cases.length) nativeFail()
  const actorRoles = new Set(), principals = new Set(), contexts = new Set()
  host.actors.forEach((actor) => {
    nativeExact(actor, ["role", "principalSha256", "contextSha256"])
    if (!["requester", "holder", "denied", "dashboardAdmin"].includes(actor.role) || actorRoles.has(actor.role) ||
        !isDigest(actor.principalSha256) || !isDigest(actor.contextSha256) ||
        principals.has(actor.principalSha256) || contexts.has(actor.contextSha256)) nativeFail()
    actorRoles.add(actor.role); principals.add(actor.principalSha256); contexts.add(actor.contextSha256)
  })
  if (["requester", "holder", "denied"].some((role) => !actorRoles.has(role))) nativeFail()
  const hostCases = new Set()
  host.cases.forEach((item, index) => {
    nativeExact(item, ["id", "fixtureCase", "beforeAuthoritySha256", "afterAuthoritySha256", "producerObservationSha256"])
    if (item.id !== role.cases[index].id || item.fixtureCase !== role.cases[index].fixtureCase ||
        hostCases.has(item.id) || ![item.beforeAuthoritySha256, item.afterAuthoritySha256, item.producerObservationSha256].every(isDigest)) nativeFail()
    hostCases.add(item.id)
  })
  const report = nativeJson(rawReport), config = report.config
  if (!config || typeof config.configFile !== "string" ||
      !config.configFile.endsWith("/packages/app-shell/e2e/playwright.production.config.ts") ||
      config.version !== "1.59.1" || config.webServer !== null || config.shard !== null || config.maxFailures !== 0 ||
      config.workers !== 1 || config.forbidOnly !== true || config.fullyParallel !== false ||
      config.metadata?.bundle !== "production" || !Array.isArray(config.projects) || config.projects.length !== 1 ||
      config.projects[0]?.name !== "chromium" || config.projects[0]?.retries !== 0 || config.projects[0]?.repeatEach !== 1 ||
      !Array.isArray(config.reporter) || config.reporter.length !== 1 || config.reporter[0]?.[0] !== "json" ||
      !Array.isArray(report.errors) || report.errors.length || !Array.isArray(report.suites) ||
      report.suites.length !== 1 || report.stats?.expected !== role.cases.length ||
      report.stats?.unexpected !== 0 || report.stats?.flaky !== 0 || report.stats?.skipped !== 0) nativeFail()
  const specRelative = specFile.slice("e2e/".length), found = new Set(), ids = new Set(), safeCases = []
  const visit = (suite, inheritedFile = "", depth = 0) => {
    if (!suite || typeof suite !== "object" || depth > 32) nativeFail()
    const file = suite.file || inheritedFile
    if (file !== specRelative || !Array.isArray(suite.specs) ||
        (suite.suites !== undefined && !Array.isArray(suite.suites))) nativeFail()
    for (const spec of suite.specs) {
      const item = expected.get(spec.title)
      if (!item || found.has(item.id) || spec.file !== specRelative || spec.line !== item.line ||
          spec.column !== item.column || typeof spec.id !== "string" || !spec.id || ids.has(spec.id) ||
          spec.ok !== true || !Array.isArray(spec.tests) || spec.tests.length !== 1) nativeFail()
      const test = spec.tests[0], result = test.results?.[0]
      if (test.expectedStatus !== "passed" || test.status !== "expected" || test.projectName !== "chromium" ||
          !Array.isArray(test.results) || test.results.length !== 1 ||
          !result || result.status !== "passed" || result.retry !== 0 ||
          result.parallelIndex !== 0 || !Number.isSafeInteger(result.workerIndex) || result.workerIndex < 0 ||
          result.error !== undefined || !Array.isArray(result.errors) || result.errors.length ||
          !Array.isArray(result.attachments) || result.attachments.length ||
          (test.annotations ?? []).some((annotation) => ["skip", "fixme", "fail"].includes(annotation?.type)) ||
          (result.annotations ?? []).some((annotation) => ["skip", "fixme", "fail"].includes(annotation?.type))) nativeFail()
      found.add(item.id); ids.add(spec.id)
      safeCases.push({ id: item.id, sourceCaseSha256: digest(spec.id), status: "passed", attempts: 1 })
    }
    for (const child of suite.suites || []) visit(child, file, depth + 1)
  }
  report.suites.forEach((suite) => visit(suite))
  if (found.size !== role.cases.length) nativeFail()
  safeCases.sort((a, b) => a.id.localeCompare(b.id))
  return {
    schema: "teams-profile-native-receipt.v1", status: "REPORT_VALIDATED",
    liveQualification: "REQUIRES_INDEPENDENT_F04_AND_FINAL_GATE_VERIFICATION",
    sourceSHA: meta.sha, sourceTreeSHA: meta.treeSha, runId: meta.runId, runAttempt: meta.attempt,
    role: meta.role, invocationId: meta.invocationId, specFile,
    archiveSha256: artifact.archiveSha256, artifactId: artifact.artifactId, artifactDigest: artifact.artifactDigest,
    rawReportSha256: digest(rawReport), expectedInventorySha256: digest(inventoryBytes),
    hostReceiptSha256: digest(hostBytes), artifactReceiptSha256: digest(artifactBytes),
    caseLedgerSha256: digest(ledgerBytes), specSha256: digest(sourceBytes), sourceProvenance,
    counts: { expected: safeCases.length, executed: safeCases.length, failed: 0, skipped: 0, retried: 0 },
    cases: safeCases,
  }
}


export function requireNativePrivateRoot(root, meta, runnerTemp) {
  if (!path.isAbsolute(root) || !path.isAbsolute(runnerTemp) ||
      !/^[1-9][0-9]*$/.test(meta.runId) || !/^[1-9][0-9]*$/.test(meta.attempt) ||
      !Object.hasOwn(NATIVE_SPECS, meta.role) || !/^[a-f0-9]{32}$/.test(meta.invocationId) ||
      typeof process.getuid !== "function") nativeFail()
  const temp = path.resolve(runnerTemp)
  if (realpathSync(temp) !== temp) nativeFail()
  const relative = ["teams-profile-private", meta.runId + "-" + meta.attempt, meta.role, meta.invocationId]
  const expected = path.join(temp, ...relative)
  if (root !== expected || path.resolve(root) !== root) nativeFail()
  let current = temp
  for (const component of relative) {
    current = path.join(current, component)
    const info = lstatSync(current)
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
        (info.mode & 0o777) !== 0o700 || realpathSync(current) !== current) nativeFail()
  }
  return root
}

export function readNativePrivateFile(root, filename, maximum = 16 * 1024 * 1024) {
  if (!path.isAbsolute(filename) || path.dirname(filename) !== root ||
      path.resolve(filename) !== filename) nativeFail()
  const descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = fstatSync(descriptor), entry = lstatSync(filename)
    if (!before.isFile() || entry.isSymbolicLink() || entry.ino !== before.ino || entry.dev !== before.dev ||
        before.uid !== process.getuid() || (before.mode & 0o777) !== 0o600 || before.nlink !== 1 ||
        before.size < 1 || before.size > maximum) nativeFail()
    const bytes = readFileSync(descriptor), after = fstatSync(descriptor), current = lstatSync(filename)
    if (before.ino !== after.ino || before.size !== after.size || before.mode !== after.mode ||
        before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
        current.ino !== before.ino || current.dev !== before.dev || current.isSymbolicLink() ||
        bytes.length !== before.size) nativeFail()
    return bytes
  } finally { closeSync(descriptor) }
}

