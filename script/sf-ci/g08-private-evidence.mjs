// Private G08 evidence boundary. Hosted controls never constitute installed Teams QA.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { lstat, open, readFile, realpath, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const cases = Object.freeze([
  { id: "same-team-distinct-grants", title: "Two distinct Microsoft accounts enter the same installed Team with their own authority" },
  { id: "aba-two-windows", title: "An explicit A B A Team switch leaves the sibling window on its own Team" },
  { id: "account-without-team", title: "An authenticated account without Team access cannot open the original business chapter" },
  { id: "foreign-deep-link-reload", title: "A foreign installation deep link and reload cannot inherit the current Team selection" },
  { id: "admin-without-team", title: "A Microsoft configuration administrator without Teams cannot acquire business access" },
  { id: "narrow-keyboard-draft", title: "Keyboard navigation opens a new Team chat draft on narrow Web without changing owner" },
  { id: "draft-cancel-discard", title: "A Team switch keeps a canceled chat draft and discards it only on confirmation" },
  { id: "real-revoke-restore", title: "Real administration revokes a disposable Team and restores its original configuration" },
  { id: "logout-original-context", title: "Logout invalidates the original Microsoft browser context and preserves the other account" },
])
export const pendingGroups = Object.freeze(["U15", "U39", "U40", "F04", "AZ02"])
export const sourcePaths = Object.freeze([
  ".github/workflows/g08-private-preflight.yml", "script/sf-ci/g08-private-evidence.mjs",
  "script/sf-ci/g08-installed-preflight.py", "script/sf-ci/g08-private-run.sh",
  "packages/app-shell/e2e/sucafina/g08/playwright.config.ts",
  "packages/app-shell/e2e/sucafina/g08/installed-fixture.ts",
  "packages/app-shell/e2e/sucafina/g08/teams-installed.spec.ts",
])
/** @param {unknown} value @returns {Record<string, unknown>} */
export function record(value) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), "G08_OBJECT_REQUIRED")
  return value
}
/** @param {Record<string, unknown>} value @param {readonly string[]} keys */
function exact(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), "G08_CLOSED_FIELDS_REQUIRED")
}
/** @param {unknown} value @returns {string} */
function text(value) {
  assert(typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 2048 &&
    !/[\u0000-\u001f\u007f]/.test(value), "G08_TEXT_REQUIRED")
  return value
}
/** @param {unknown} value @param {number} length @returns {string} */
function hex(value, length) {
  const result = text(value)
  assert(new RegExp("^[a-f0-9]{" + length + "}$").test(result), "G08_HEX_REQUIRED")
  return result
}
/** @param {unknown} value @returns {string} */
function id(value) {
  const result = text(value)
  assert(/^[1-9][0-9]*$/.test(result), "G08_RUN_ID_REQUIRED")
  return result
}
/** @param {unknown} value @returns {string} */
function uuid(value) {
  const result = text(value)
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result), "G08_REAL_OBJECT_ID_REQUIRED")
  return result
}
/** @param {unknown} value @returns {string} */
function reference(value) {
  const result = text(value)
  assert(/^https:\/\/github\.com\/gustavomhss\/Orchestra-SF\/(?:issues|pull)\/[1-9][0-9]*#(?:issuecomment|discussion_r|pullrequestreview)-[1-9][0-9]*$/.test(result), "G08_SOURCE_REFERENCE_REQUIRED")
  return result
}
/** @param {unknown} value @returns {string} */
function origin(value) {
  const result = text(value), url = new URL(result)
  assert(url.protocol === "https:" && url.origin === result && !url.username && !url.password, "G08_HTTPS_ORIGIN_REQUIRED")
  return result
}
/** @param {unknown} value */
export function target(value) {
  const item = record(value)
  exact(item, ["serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin", "installationId", "tenantId",
    "teamObjectId", "projectId", "hostId", "mount", "chapterHref"])
  const result = {
    serverKey: origin(item.serverKey), discoveryOrigin: origin(item.discoveryOrigin),
    shellOrigin: origin(item.shellOrigin), publicOrigin: origin(item.publicOrigin),
    installationId: text(item.installationId), tenantId: uuid(item.tenantId), teamObjectId: uuid(item.teamObjectId),
    projectId: text(item.projectId), hostId: text(item.hostId), mount: text(item.mount), chapterHref: text(item.chapterHref),
  }
  assert(result.serverKey === result.publicOrigin && result.publicOrigin === result.shellOrigin &&
    result.discoveryOrigin === result.publicOrigin, "G08_SAME_INSTALLED_ORIGIN_REQUIRED")
  assert(/^\/[A-Za-z0-9_/-]+$/.test(result.mount) && !result.mount.includes("//") &&
    !result.mount.endsWith("/"), "G08_MOUNT_INVALID")
  const url = new URL(result.chapterHref, result.shellOrigin)
  assert(result.chapterHref.startsWith("/") && !result.chapterHref.startsWith("//") &&
    url.origin === result.shellOrigin && url.pathname.startsWith("/orchestra/sf-") &&
    !url.hash && !url.username && !url.password, "G08_ORIGINAL_CHAPTER_REQUIRED")
  const expected = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: result.serverKey,
    installationId: result.installationId, tenantId: result.tenantId, teamObjectId: result.teamObjectId })
  assert([...url.searchParams.keys()].every((key) => url.searchParams.getAll(key).length === 1 &&
    (expected.has(key) || key === "year")), "G08_CLOSED_OWNER_QUERY_REQUIRED")
  for (const [key, entry] of expected) assert.equal(url.searchParams.get(key), entry, "G08_CHAPTER_OWNER_MISMATCH")
  if (url.searchParams.has("year")) assert(/^(?:202[4-9]|20[3-9][0-9]|2100)$/.test(url.searchParams.get("year") ?? ""), "G08_YEAR_INVALID")
  return result
}
/** @param {unknown} value */
export function validatePlan(value) {
  const item = record(value)
  exact(item, ["schema", "candidate", "packageReceiptSha256", "reservation", "approvals", "invocation",
    "target", "teamB", "foreignInstallation", "actors", "scratchRoot"])
  assert.equal(item.schema, "sf-g08-private-plan-v1", "G08_PLAN_SCHEMA_INVALID")
  const candidate = record(item.candidate), reservation = record(item.reservation)
  const approvals = record(item.approvals), invocation = record(item.invocation), actors = record(item.actors)
  exact(candidate, ["sha", "tree"])
  exact(reservation, ["reference", "owner", "startsAt", "endsAt", "vmId", "environment", "exclusive"])
  exact(approvals, ["actorsReference", "mutationReference", "scope"])
  exact(invocation, ["id", "runId", "runAttempt", "workflowSha"])
  exact(actors, ["requester", "holder", "denied", "dashboardAdmin"])
  assert(reservation.environment === "qa-isolated" && reservation.exclusive === true &&
    approvals.scope === "qualification-only", "G08_ISOLATED_QA_APPROVAL_REQUIRED")
  const startsAt = text(reservation.startsAt), endsAt = text(reservation.endsAt)
  assert(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(startsAt) &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(endsAt) &&
    Number.isFinite(Date.parse(startsAt)) && Date.parse(endsAt) > Date.parse(startsAt), "G08_WINDOW_INVALID")
  const a = target(item.target), b = target(item.teamB), foreign = target(item.foreignInstallation)
  for (const key of ["serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin", "projectId", "hostId", "mount", "tenantId"])
    assert(b[key] === a[key] && foreign[key] === a[key], "G08_BOUNDARY_ENDPOINT_CHANGED")
  assert(b.teamObjectId !== a.teamObjectId && b.installationId === a.installationId &&
    foreign.teamObjectId === a.teamObjectId && foreign.installationId !== a.installationId, "G08_BOUNDARIES_NOT_DISTINCT")
  const principals = { requester: uuid(actors.requester), holder: uuid(actors.holder),
    denied: uuid(actors.denied), dashboardAdmin: uuid(actors.dashboardAdmin) }
  assert.equal(new Set(Object.values(principals)).size, 4, "G08_DISTINCT_REAL_ACTORS_REQUIRED")
  const scratchRoot = text(item.scratchRoot)
  assert(path.isAbsolute(scratchRoot) && path.resolve(scratchRoot) === scratchRoot, "G08_PRIVATE_ROOT_ABSOLUTE")
  return { schema: "sf-g08-private-plan-v1", candidate: { sha: hex(candidate.sha, 40), tree: hex(candidate.tree, 40) },
    packageReceiptSha256: hex(item.packageReceiptSha256, 64),
    reservation: { reference: reference(reservation.reference), owner: text(reservation.owner), startsAt, endsAt,
      vmId: uuid(reservation.vmId), environment: "qa-isolated", exclusive: true },
    approvals: { actorsReference: reference(approvals.actorsReference), mutationReference: reference(approvals.mutationReference),
      scope: "qualification-only" },
    invocation: { id: hex(invocation.id, 32), runId: id(invocation.runId), runAttempt: id(invocation.runAttempt),
      workflowSha: hex(invocation.workflowSha, 40) },
    target: a, teamB: b, foreignInstallation: foreign, actors: principals, scratchRoot }
}
/** @param {ReturnType<typeof validatePlan>} plan @param {NodeJS.ProcessEnv} env @param {number} now */
export function requireInvocation(plan, env = process.env, now = Date.now()) {
  assert(env.GITHUB_ACTIONS === "true" && env.CI === "true" &&
    env.GITHUB_REPOSITORY === "gustavomhss/Orchestra-SF" && env.GITHUB_REPOSITORY_ID === "1455724710" &&
    env.RUNNER_ENVIRONMENT === "self-hosted" && env.RUNNER_OS === "Linux" && env.RUNNER_ARCH === "X64",
    "G08_PRIVATE_LINUX_ACTIONS_RUNNER_REQUIRED")
  assert(env.SF_G08_CANDIDATE_SHA === plan.candidate.sha && env.SF_G08_CANDIDATE_TREE === plan.candidate.tree &&
    env.GITHUB_RUN_ID === plan.invocation.runId && env.GITHUB_RUN_ATTEMPT === plan.invocation.runAttempt &&
    env.GITHUB_WORKFLOW_SHA === plan.invocation.workflowSha && env.SF_G08_INVOCATION_ID === plan.invocation.id,
    "G08_INVOCATION_MISMATCH")
  assert(now >= Date.parse(plan.reservation.startsAt) && now < Date.parse(plan.reservation.endsAt), "G08_OUTSIDE_RESERVED_WINDOW")
}
/** @param {string} root */
export async function privateRoot(root) {
  assert(path.isAbsolute(root) && path.resolve(root) === root, "G08_PRIVATE_ROOT_ABSOLUTE")
  const info = await lstat(root)
  assert(info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o777) === 0o700 &&
    info.uid === process.getuid?.() && await realpath(root) === root, "G08_PRIVATE_ROOT_REQUIRED")
  const workspace = process.env.GITHUB_WORKSPACE
  assert(!workspace || !(root === workspace || root.startsWith(path.resolve(workspace) + path.sep)), "G08_PRIVATE_ROOT_OUTSIDE_CHECKOUT")
  return root
}
/** @param {string} root @param {string} name @param {number} maximum */
export async function privateText(root, name, maximum = 5_000_000) {
  await privateRoot(root)
  assert(/^[a-z0-9][a-z0-9.-]*$/.test(name), "G08_PRIVATE_FILE_NAME")
  const file = path.join(root, name), before = await lstat(file)
  assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.uid === process.getuid?.() &&
    (before.mode & 0o777) === 0o600 && before.size > 0 && before.size <= maximum, "G08_PRIVATE_FILE_REQUIRED")
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const after = await handle.stat()
    assert(after.dev === before.dev && after.ino === before.ino && after.size === before.size &&
      after.mode === before.mode && after.uid === before.uid && after.nlink === 1, "G08_PRIVATE_FILE_CHANGED")
    const bytes = await handle.readFile()
    assert(bytes.byteLength === after.size, "G08_PRIVATE_READ_CHANGED")
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } finally { await handle.close() }
}
/** @param {string} root @param {string} name @param {unknown} value */
export async function writePrivate(root, name, value) {
  await privateRoot(root)
  assert(/^[a-z0-9][a-z0-9.-]*$/.test(name), "G08_PRIVATE_FILE_NAME")
  const handle = await open(path.join(root, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try { await handle.writeFile(JSON.stringify(value) + "\n", "utf8"); await handle.sync() } finally { await handle.close() }
}
/** @param {string | Uint8Array} value */
export function digest(value) { return createHash("sha256").update(value).digest("hex") }
/** @param {string} root */
export async function readPlan(root) {
  const raw = await privateText(root, "plan.json", 65_536), input = JSON.parse(raw)
  assert.equal(raw, JSON.stringify(input) + "\n", "G08_CANONICAL_JSON_REQUIRED")
  const plan = validatePlan(input)
  assert.equal(plan.scratchRoot, root, "G08_ROOT_BINDING_MISMATCH")
  requireInvocation(plan)
  return plan
}
/** @param {unknown} value @param {ReturnType<typeof validatePlan>} plan */
export function validatePackage(value, plan) {
  const receipt = record(value), candidate = record(receipt.candidate), archive = record(receipt.archive)
  const manifest = record(receipt.manifest), artifact = record(receipt.artifact), producer = record(receipt.producer)
  assert(receipt.schema === "sf-g07-package-v1" && receipt.status === "PACKAGE_VERIFIED" &&
    receipt.productionCutover === false, "G08_G07_VERIFIED_RECEIPT_REQUIRED")
  assert(candidate.sha === plan.candidate.sha && candidate.tree === plan.candidate.tree, "G08_G07_CANDIDATE_MISMATCH")
  assert.equal(archive.file, "orchestra-sf-entra-linux-x64-baseline.tar.gz", "G08_ORIGINAL_INNER_TAR_REQUIRED")
  hex(archive.sha256, 64); hex(manifest.sha256, 64); hex(artifact.zipSha256, 64)
  assert(Number.isSafeInteger(archive.bytes) && Number(archive.bytes) > 0 && Array.isArray(manifest.files) && manifest.files.length > 0,
    "G08_G07_INVENTORY_REQUIRED")
  for (const key of ["id", "name"]) assert(artifact[key] !== undefined, "G08_G07_ARTIFACT_REQUIRED")
  for (const key of ["runId", "runAttempt", "jobId", "checkRunId", "workflowSha", "workflowPath"])
    assert(producer[key] !== undefined, "G08_G07_PRODUCER_REQUIRED")
  const acknowledgements = record(receipt.acknowledgements)
  for (const role of ["migration", "release"]) {
    const acknowledgement = record(acknowledgements[role]), source = record(acknowledgement.source)
    assert(acknowledgement.status === "VERIFIED_SOURCE", "G08_FINAL_PIN_ACK_REQUIRED")
    reference(source.url); hex(source.bodySha256, 64)
  }
  return receipt
}
/** @param {unknown} value @param {ReturnType<typeof validatePlan>} plan @param {Record<string, unknown>} receipt */
export function validateHost(value, plan, receipt) {
  const host = record(value), candidate = record(host.candidate), archive = record(receipt.archive), manifest = record(receipt.manifest)
  assert(host.schema === "sf-g08-installed-host-v1" && host.status === "INSTALLATION_BYTES_AND_PROCESS_VERIFIED" &&
    host.invocationId === plan.invocation.id && host.vmId === plan.reservation.vmId &&
    candidate.sha === plan.candidate.sha && candidate.tree === plan.candidate.tree &&
    host.archiveSha256 === archive.sha256 && host.manifestSha256 === manifest.sha256 &&
    host.currentSource === plan.candidate.sha, "G08_INSTALLED_HOST_MISMATCH")
  const running = record(host.process)
  assert(running.unit === "orchestra-sf.service" && Number.isSafeInteger(running.pid) && Number(running.pid) > 0 &&
    running.activeState === "active" && running.subState === "running" &&
    running.exe === "/opt/orchestra-sf/releases/" + plan.candidate.sha + "/bin/orchestra" &&
    /^[1-9][0-9]*$/.test(String(running.startTicks)), "G08_RUNNING_INSTALLED_PROCESS_REQUIRED")
  hex(host.installerSha256, 64); hex(host.releaseReceiptSha256, 64)
  const observed = Date.parse(text(host.observedAt))
  assert(Number.isFinite(observed) && observed >= Date.parse(plan.reservation.startsAt) &&
    observed < Date.parse(plan.reservation.endsAt), "G08_HOST_OUTSIDE_WINDOW")
  return host
}
/** @param {unknown} value */
export function reportSpecs(value) {
  const report = record(value)
  /** @type {Record<string, unknown>[]} */
  const found = []
  /** @param {unknown} input */
  function walk(input) {
    const suite = record(input)
    assert(Array.isArray(suite.specs) && Array.isArray(suite.suites ?? []), "G08_REPORT_SUITE_INVALID")
    for (const spec of suite.specs) found.push(record(spec))
    for (const child of suite.suites ?? []) walk(child)
  }
  assert(Array.isArray(report.suites), "G08_REPORT_SUITES_REQUIRED")
  for (const suite of report.suites) walk(suite)
  return found
}
/** @param {unknown} value @param {boolean} executed */
export function verifyReport(value, executed) {
  const report = record(value), specs = reportSpecs(report), config = record(report.config)
  assert.deepEqual(specs.map((spec) => spec.title).sort(), cases.map((item) => item.title).sort(), "G08_EXACT_NINE_CASE_INVENTORY_REQUIRED")
  assert.deepEqual(report.errors ?? [], [], "G08_REPORT_ERRORS")
  assert.equal(config.workers, 1, "G08_WORKERS_ONE_REQUIRED")
  assert(Array.isArray(config.projects) && config.projects.length === 1, "G08_SINGLE_PROJECT_REQUIRED")
  const project = record(config.projects[0])
  assert(project.name === "g08-installed" && project.retries === 0 && project.repeatEach === 1, "G08_NO_RETRIES_OR_REPEATS")
  assert(!config.shard && !config.grepInvert && JSON.stringify(config.grep ?? {}) === "{}", "G08_UNFILTERED_RUN_REQUIRED")
  for (const spec of specs) {
    assert(typeof spec.file === "string" && spec.file.replaceAll("\\", "/").endsWith("teams-installed.spec.ts"), "G08_ORIGINAL_SPEC_REQUIRED")
    assert(Array.isArray(spec.tests) && spec.tests.length === 1, "G08_SINGLE_RESULT_REQUIRED")
    const entry = record(spec.tests[0])
    assert(entry.projectName === "g08-installed" && entry.expectedStatus === "passed", "G08_EXPECTED_PASS_REQUIRED")
    if (!executed) continue
    assert(entry.status === "expected" && spec.ok === true && Array.isArray(entry.results) &&
      entry.results.length === 1, "G08_NO_FLAKE_SKIP_OR_RETRY")
    const result = record(entry.results[0])
    assert(result.status === "passed" && result.retry === 0 && (result.errors ?? []).length === 0,
      "G08_ACTUAL_SINGLE_PASS_REQUIRED")
  }
  if (executed) {
    const stats = record(report.stats)
    assert(stats.expected === cases.length && stats.unexpected === 0 && stats.skipped === 0 && stats.flaky === 0,
      "G08_NON_PASS_STATISTICS")
  }
  return cases.map(({ id }) => ({ id, status: executed ? "PASS" : "LISTED_NOT_RUN" }))
}
/** @param {string} root */
export async function sourceInventory(root = process.cwd()) {
  return Promise.all(sourcePaths.map(async (file) => ({ path: file, sha256: digest(await readFile(path.join(root, file))) })))
}
async function main() {
  const command = process.argv[2]
  if (command === "verify-list") {
    const inventory = verifyReport(JSON.parse(await readFile(process.argv[3], "utf8")), false)
    const receipt = { schema: "sf-g08-executor-inventory-v1", status: "EXECUTOR_INVENTORY_VERIFIED",
      candidate: { sha: process.env.SF_G08_CANDIDATE_SHA, tree: process.env.SF_G08_CANDIDATE_TREE },
      cases: inventory, sources: await sourceInventory(), installed: false, g08Closed: false, pendingGroups, productionCutover: false }
    await mkdir("g08-tooling-evidence", { recursive: true })
    await writeFile("g08-tooling-evidence/inventory.json", JSON.stringify(receipt, null, 2) + "\n")
    console.log(JSON.stringify(receipt))
    return
  }
  const root = text(process.env.SF_G08_PRIVATE_ROOT), plan = await readPlan(root)
  const packageText = await privateText(root, "package-receipt.json")
  assert.equal(digest(packageText), plan.packageReceiptSha256, "G08_G07_RECEIPT_BYTES_MISMATCH")
  const receipt = validatePackage(JSON.parse(packageText), plan)
  if (command === "admit") { await writePrivate(root, "source-before.json", await sourceInventory()); return }
  assert.equal(command, "verify", "G08_COMMAND_INVALID")
  assert.equal(await privateText(root, "exit-code.txt", 64), "0\n", "G08_PLAYWRIGHT_EXIT_NOT_ZERO")
  const reportText = await privateText(root, "playwright.json", 25_000_000), report = JSON.parse(reportText)
  const inventory = verifyReport(report, true)
  assert.deepEqual(record(record(report).config).metadata,
    { candidateSha: plan.candidate.sha, candidateTree: plan.candidate.tree, invocationId: plan.invocation.id,
      runId: plan.invocation.runId, runAttempt: plan.invocation.runAttempt }, "G08_REPORT_INVOCATION_MISMATCH")
  const beforeText = await privateText(root, "host-before.json"), afterText = await privateText(root, "host-after.json")
  const before = validateHost(JSON.parse(beforeText), plan, receipt), after = validateHost(JSON.parse(afterText), plan, receipt)
  assert.deepEqual(before.process, after.process, "G08_INSTALLED_PROCESS_CHANGED_DURING_QA")
  assert.equal(before.installerSha256, after.installerSha256, "G08_INSTALLER_CHANGED")
  assert.equal(before.releaseReceiptSha256, after.releaseReceiptSha256, "G08_RELEASE_RECEIPT_CHANGED")
  assert(Date.parse(text(before.observedAt)) <= Date.parse(text(after.observedAt)), "G08_HOST_OBSERVATION_ORDER")
  const sources = await sourceInventory()
  assert.deepEqual(JSON.parse(await privateText(root, "source-before.json")), sources, "G08_SOURCE_CHANGED")
  const cleanup = []
  for (const item of cases) {
    const raw = await privateText(root, "cleanup-" + item.id + ".json"), value = record(JSON.parse(raw))
    assert(value.schema === "sf-g08-cleanup-v1" && value.caseId === item.id && value.invocationId === plan.invocation.id &&
      value.originalContexts === 4 && value.createdContexts === 0 && Number(value.openedPages) > 0 &&
      value.openedPages === value.closedPages && value.disconnected === true, "G08_CLEANUP_NOT_OBSERVED")
    if (item.id === "real-revoke-restore")
      assert(value.revocationAttempted === true && value.revocationRestored === true, "G08_REVOCATION_RESTORATION_REQUIRED")
    cleanup.push({ caseId: item.id, sha256: digest(raw) })
  }
  const archive = record(receipt.archive)
  const publicReceipt = {
    schema: "sf-g08-core-installed-v1", status: "CORE_TEAMS_INSTALLED_VERIFIED",
    candidate: plan.candidate, archive: { file: archive.file, sha256: archive.sha256, bytes: archive.bytes },
    packageReceiptSha256: plan.packageReceiptSha256, invocation: plan.invocation, cases: inventory, sources,
    evidence: { reportSha256: digest(reportText), hostBeforeSha256: digest(beforeText), hostAfterSha256: digest(afterText), cleanup },
    installed: true, g08Closed: false, pendingGroups, productionCutover: false,
    limits: ["Core Teams cases only; U15/U39/U40/F04/AZ02 require separate original producers and installed receipts.",
      "Logout proves original context invalidation, not raw token replay or Entra global sign-out.",
      "Reservation and actor references are operator-supplied authorization metadata, never inferred role grants."],
  }
  await writePrivate(root, "core-receipt.json", publicReceipt)
  await mkdir("g08-public", { recursive: true, mode: 0o700 })
  await writeFile("g08-public/receipt.json", JSON.stringify(publicReceipt, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  console.log("G08_CORE_TEAMS_INSTALLED_VERIFIED_G08_REMAINS_OPEN")
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => { console.error("G08_EVIDENCE_REFUSED_PRIVATE_DETAILS_RETAINED_ON_HOST"); process.exitCode = 1 })
