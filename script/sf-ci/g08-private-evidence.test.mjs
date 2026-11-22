// Synthetic parser/refusal controls only. No test here authenticates, installs, revokes or approves G08.
import test from "node:test"
import assert from "node:assert/strict"
import { chmod, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { cases, coverageLedger, digest, obligationPath, pendingGroups, preservedTeams, productContractPaths, requireCompleteGate, requireProductContracts, privateRoot, privateText, requireInvocation, target, validateHost, validatePackage, validatePlan, verifyReport, writePrivate } from "./g08-private-evidence.mjs"

const uuid = (last) => "00000000-0000-4000-8000-" + String(last).padStart(12, "0")
function scope(installationId = "synthetic-installation", teamObjectId = uuid(2)) {
  const result = { serverKey: "https://qa.example.invalid", discoveryOrigin: "https://qa.example.invalid",
    shellOrigin: "https://qa.example.invalid", publicOrigin: "https://qa.example.invalid",
    installationId, tenantId: uuid(1), teamObjectId, projectId: "synthetic-project", hostId: "synthetic-host",
    mount: "/sucafina", chapterHref: "" }
  result.chapterHref = "/orchestra/sf-home?" + new URLSearchParams({ contractRevision: "sf-team-profile/1",
    server: result.serverKey, installationId, tenantId: result.tenantId, teamObjectId })
  return result
}
function plan() {
  return { schema: "sf-g08-private-plan-v1", candidate: { sha: "a".repeat(40), tree: "b".repeat(40) },
    packageReceiptSha256: "c".repeat(64),
    reservation: { reference: "https://github.com/gustavomhss/Orchestra-SF/issues/628#issuecomment-123",
      owner: "synthetic-control-owner", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T02:00:00Z",
      vmId: uuid(10), environment: "qa-isolated", exclusive: true },
    approvals: { actorsReference: "https://github.com/gustavomhss/Orchestra-SF/issues/628#issuecomment-124",
      mutationReference: "https://github.com/gustavomhss/Orchestra-SF/issues/628#issuecomment-125", scope: "qualification-only" },
    invocation: { id: "d".repeat(32), runId: "123", runAttempt: "1", workflowSha: "e".repeat(40) },
    target: scope(), teamB: scope("synthetic-installation", uuid(3)), foreignInstallation: scope("synthetic-foreign"),
    actors: { requester: uuid(4), holder: uuid(5), denied: uuid(6), dashboardAdmin: uuid(7) },
    scratchRoot: "/tmp/synthetic-private-g08" }
}
function packageReceipt() {
  return { schema: "sf-g07-package-v1", status: "PACKAGE_VERIFIED", candidate: plan().candidate,
    archive: { file: "orchestra-sf-entra-linux-x64-baseline.tar.gz", sha256: "f".repeat(64), bytes: 100 },
    manifest: { sha256: "1".repeat(64), files: [
      { path: "bin/orchestra", sha256: "2".repeat(64), bytes: 80, executable: true },
      { path: "bin/local/entry.mjs", sha256: "8".repeat(64), bytes: 20, executable: false }] },
    factory: { path: "bin/local/entry.mjs", sha256: "8".repeat(64) },
    artifact: { id: "1234", name: "synthetic", zipSha256: "3".repeat(64) },
    producer: { runId: "100", runAttempt: "1", jobId: "200", checkRunId: "200", workflowSha: "4".repeat(40),
      workflowPath: ".github/workflows/release.yml" },
    acknowledgements: Object.fromEntries(["migration", "release"].map((role, index) => [role,
      { status: "VERIFIED_SOURCE", source: { url: "https://github.com/gustavomhss/Orchestra-SF/issues/628#issuecomment-" + (130 + index),
        bodySha256: "5".repeat(64) } }])),
    verification: { installerSha256: "6".repeat(64) }, installation: null, g07Closed: false, productionCutover: false }
}
function host() {
  const value = plan()
  const descriptor = { contractRevision: "sf-team-profile/1", authMode: "microsoft",
    installationId: value.target.installationId, tenantId: value.target.tenantId, projectId: value.target.projectId,
    hostId: value.target.hostId, publicOrigin: value.target.publicOrigin, mount: value.target.mount }
  const descriptorSha = digest(JSON.stringify(Object.fromEntries(Object.entries(descriptor).sort(([a], [b]) => a.localeCompare(b)))))
  return { schema: "sf-g08-installed-host-v1", status: "INSTALLATION_BYTES_AND_PROCESS_VERIFIED",
    candidate: plan().candidate, invocationId: plan().invocation.id, vmId: plan().reservation.vmId,
    archiveSha256: packageReceipt().archive.sha256, manifestSha256: packageReceipt().manifest.sha256,
    currentSource: plan().candidate.sha, observedAt: "2026-01-01T01:00:00Z",
    installerSha256: "6".repeat(64), releaseReceiptSha256: "7".repeat(64),
    process: { unit: "orchestra-sf.service", pid: 123, activeState: "active", subState: "running",
      exe: "/opt/orchestra-sf/releases/" + plan().candidate.sha + "/bin/orchestra", startTicks: "100", bootId: uuid(20) },
    binding: { status: "LOOPBACK_PID_AND_HTTPS_BOUND",
      factoryPath: "/opt/orchestra-sf/releases/" + value.candidate.sha + "/bin/local/entry.mjs",
      factorySha256: packageReceipt().factory.sha256, argvSha256: "a".repeat(64),
      configurationPath: "/synthetic/private/installation.json", configurationSha256: "b".repeat(64),
      listenerOrigin: "http://127.0.0.1:4096", listenerInode: "987", descriptor,
      loopbackDiscoverySha256: descriptorSha, httpsDiscoverySha256: descriptorSha, ingressAddresses: ["10.0.0.4"],
      caddyConfigSha256: "c".repeat(64), caddyProcess: { unit: "caddy.service", pid: 555, uid: 999,
        exe: "/usr/bin/caddy", startTicks: "100", listeners: { tcp: ["444"], udp: [] } } } }
}
function report() {
  return { config: { workers: 1, grep: {}, grepInvert: null, shard: null,
    projects: [{ name: "g08-installed", retries: 0, repeatEach: 1 }] },
    errors: [], suites: [{ title: "teams-installed.spec.ts", suites: [], specs: cases.map((entry) => ({
      title: entry.title, file: "teams-installed.spec.ts", ok: true,
      tests: [{ projectName: "g08-installed", expectedStatus: "passed", status: "expected",
        results: [{ status: "passed", retry: 0, errors: [] }] }],
    })) }], stats: { expected: cases.length, unexpected: 0, skipped: 0, flaky: 0 } }
}
function environment() {
  const value = plan()
  return { GITHUB_ACTIONS: "true", CI: "true", GITHUB_REPOSITORY: "gustavomhss/Orchestra-SF", GITHUB_REPOSITORY_ID: "1455724710",
    RUNNER_ENVIRONMENT: "self-hosted", RUNNER_OS: "Linux", RUNNER_ARCH: "X64",
    SF_G08_CANDIDATE_SHA: value.candidate.sha, SF_G08_CANDIDATE_TREE: value.candidate.tree,
    GITHUB_RUN_ID: value.invocation.runId, GITHUB_RUN_ATTEMPT: value.invocation.runAttempt,
    GITHUB_WORKFLOW_SHA: value.invocation.workflowSha, SF_G08_INVOCATION_ID: value.invocation.id }
}

test("synthetic complete metadata validates without treating metadata as authority", () => {
  assert.equal(validatePlan(plan()).candidate.sha, plan().candidate.sha)
  assert.equal(validatePackage(packageReceipt(), validatePlan(plan())).installation, null)
  assert.equal(validateHost(host(), validatePlan(plan()), packageReceipt()).currentSource, plan().candidate.sha)
  requireInvocation(validatePlan(plan()), environment(), Date.parse("2026-01-01T01:00:00Z"))
})
for (const [name, change] of [
  ["extra actor", (value) => { value.actors.extra = uuid(8) }],
  ["same requester and holder", (value) => { value.actors.holder = value.actors.requester }],
  ["missing administrator", (value) => { delete value.actors.dashboardAdmin }],
  ["non-exclusive slot", (value) => { value.reservation.exclusive = false }],
  ["production slot", (value) => { value.reservation.environment = "production" }],
  ["expired/reversed window", (value) => { value.reservation.endsAt = value.reservation.startsAt }],
  ["missing actor authorization", (value) => { value.approvals.actorsReference = "" }],
  ["mutation reference outside repository", (value) => { value.approvals.mutationReference = "https://example.invalid/approve" }],
  ["different boundary endpoint", (value) => { value.teamB.hostId = "different" }],
  ["same Team A and B", (value) => { value.teamB = value.target }],
  ["foreign negative same installation", (value) => { value.foreignInstallation = value.target }],
  ["relative private root", (value) => { value.scratchRoot = "relative" }],
  ["extra plan token", (value) => { value.token = "never-valid" }],
  ["candidate abbreviation", (value) => { value.candidate.sha = "abcdef" }],
]) test("refuses " + name, () => { const value = plan(); change(value); assert.throws(() => validatePlan(value)) })

for (const [name, change] of [
  ["http", (value) => { value.publicOrigin = "http://qa.example.invalid" }],
  ["foreign chapter origin", (value) => { value.chapterHref = "https://other.invalid/orchestra/sf-home" }],
  ["duplicate selector", (value) => { value.chapterHref += "&teamObjectId=" + value.teamObjectId }],
  ["unknown selector", (value) => { value.chapterHref += "&token=not-permitted" }],
  ["mismatched selector", (value) => { value.chapterHref = value.chapterHref.replace("synthetic-installation", "different") }],
]) test("refuses target " + name, () => { const value = scope(); change(value); assert.throws(() => target(value)) })

for (const key of ["GITHUB_ACTIONS", "CI", "GITHUB_REPOSITORY", "GITHUB_REPOSITORY_ID", "RUNNER_ENVIRONMENT", "RUNNER_OS",
  "RUNNER_ARCH", "SF_G08_CANDIDATE_SHA", "SF_G08_CANDIDATE_TREE", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT",
  "GITHUB_WORKFLOW_SHA", "SF_G08_INVOCATION_ID"])
  test("refuses mismatched invocation " + key, () => {
    const env = environment(); env[key] = "wrong"
    assert.throws(() => requireInvocation(validatePlan(plan()), env, Date.parse("2026-01-01T01:00:00Z")))
  })
test("refuses run outside reserved window", () => {
  assert.throws(() => requireInvocation(validatePlan(plan()), environment(), Date.parse("2026-01-01T02:00:00Z")))
})

for (const [name, change] of [
  ["unverified package", (value) => { value.status = "PREPARED" }],
  ["candidate mismatch", (value) => { value.candidate.sha = "9".repeat(40) }],
  ["ZIP instead of inner tar", (value) => { value.archive.file = "artifact.zip" }],
  ["missing manifest inventory", (value) => { value.manifest.files = [] }],
  ["missing pin ACK", (value) => { value.acknowledgements.migration.status = "DECLARED" }],
  ["factory missing from manifest", (value) => { value.manifest.files.pop() }],
  ["factory differs from manifest", (value) => { value.factory.sha256 = "9".repeat(64) }],
]) test("refuses " + name, () => { const value = packageReceipt(); change(value); assert.throws(() => validatePackage(value, validatePlan(plan()))) })

test("package receipt with installation null is never a host witness", () => {
  assert.throws(() => validateHost(packageReceipt(), validatePlan(plan()), packageReceipt()))
})
for (const [name, change] of [
  ["wrong VM", (value) => { value.vmId = uuid(11) }],
  ["wrong tar", (value) => { value.archiveSha256 = "9".repeat(64) }],
  ["wrong manifest", (value) => { value.manifestSha256 = "9".repeat(64) }],
  ["wrong invocation", (value) => { value.invocationId = "9".repeat(32) }],
  ["stale current", (value) => { value.currentSource = "9".repeat(40) }],
  ["developer executable", (value) => { value.process.exe = "/usr/bin/bun" }],
  ["stopped service", (value) => { value.process.activeState = "inactive" }],
  ["old host receipt", (value) => { value.observedAt = "2025-01-01T00:00:00Z" }],
  ["missing runtime binding", (value) => { delete value.binding }],
  ["different running factory", (value) => { value.binding.factoryPath = "/opt/other/bin/local/entry.mjs" }],
  ["factory bytes changed", (value) => { value.binding.factorySha256 = "9".repeat(64) }],
  ["another HTTPS origin", (value) => { value.binding.descriptor.publicOrigin = "https://other.invalid" }],
  ["another factory hostId", (value) => { value.binding.descriptor.hostId = "different-process" }],
  ["uncorrelated HTTPS response", (value) => { value.binding.httpsDiscoverySha256 = "9".repeat(64) }],
  ["different listener", (value) => { value.binding.listenerOrigin = "http://127.0.0.1:8090" }],
  ["missing boot identity", (value) => { delete value.process.bootId }],
  ["different installer bytes", (value) => { value.installerSha256 = "9".repeat(64) }],
  ["missing original proxy process", (value) => { delete value.binding.caddyProcess }],
  ["no assigned VM ingress address", (value) => { value.binding.ingressAddresses = [] }],
  ["unobserved HTTPS socket", (value) => { value.binding.caddyProcess.listeners.tcp = [] }],
  ["invalid ingress address", (value) => { value.binding.ingressAddresses = ["qa.example.invalid"] }],
]) test("refuses host " + name, () => { const value = host(); change(value); assert.throws(() => validateHost(value, validatePlan(plan()), packageReceipt())) })

test("synthetic exact report lists separately from actual execution", () => {
  assert(verifyReport(report(), false).every((entry) => entry.status === "LISTED_NOT_RUN"))
  assert(verifyReport(report(), true).every((entry) => entry.status === "PASS"))
})
for (const [name, change] of [
  ["missing case", (value) => { value.suites[0].specs.pop() }],
  ["duplicated case", (value) => { value.suites[0].specs[0] = value.suites[0].specs[1] }],
  ["unexpected case", (value) => { value.suites[0].specs[0].title = "unexpected" }],
  ["no execution", (value) => { value.suites[0].specs[0].tests[0].results = [] }],
  ["retry", (value) => { value.suites[0].specs[0].tests[0].results[0].retry = 1 }],
  ["two results", (value) => { value.suites[0].specs[0].tests[0].results.push(value.suites[0].specs[0].tests[0].results[0]) }],
  ["skip", (value) => { value.suites[0].specs[0].tests[0].results[0].status = "skipped" }],
  ["flaky", (value) => { value.suites[0].specs[0].tests[0].status = "flaky" }],
  ["expected failure", (value) => { value.suites[0].specs[0].tests[0].expectedStatus = "failed" }],
  ["worker filtering", (value) => { value.config.workers = 2 }],
  ["grep", (value) => { value.config.grep = { source: "partial" } }],
  ["shard", (value) => { value.config.shard = { current: 1, total: 2 } }],
  ["configured retry", (value) => { value.config.projects[0].retries = 1 }],
  ["configured repeat", (value) => { value.config.projects[0].repeatEach = 2 }],
  ["top-level error", (value) => { value.errors = [{ message: "failed" }] }],
  ["skipped stats", (value) => { value.stats.skipped = 1 }],
  ["foreign spec", (value) => { value.suites[0].specs[0].file = "different.spec.ts" }],
  ["lookalike spec", (value) => { value.suites[0].specs[0].file = "foreign-teams-installed.spec.ts" }],
]) test("refuses report " + name, () => { const value = report(); change(value); assert.throws(() => verifyReport(value, true)) })

test("a previous seven-case report cannot attest the two actual draft scenarios", () => {
  const value = report()
  value.suites[0].specs = value.suites[0].specs.filter((entry) =>
    !cases.filter((item) => ["narrow-keyboard-draft", "draft-cancel-discard"].includes(item.id))
      .some((item) => item.title === entry.title))
  value.stats.expected = 7
  assert.throws(() => verifyReport(value, false), /G08_EXACT_CURRENT_CASE_INVENTORY_REQUIRED/)
  assert.throws(() => verifyReport(value, true), /G08_EXACT_CURRENT_CASE_INVENTORY_REQUIRED/)
})

test("private files are exclusive, bounded, owner-only and reject links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g08-refusal-"))
  try {
    await chmod(root, 0o700)
    await writePrivate(root, "control.json", { synthetic: true })
    assert.equal(await privateText(root, "control.json"), '{"synthetic":true}\n')
    await assert.rejects(writePrivate(root, "control.json", {}))
    await assert.rejects(privateText(root, "control.json", 2))
    await symlink(path.join(root, "control.json"), path.join(root, "symbolic.json"))
    await assert.rejects(privateText(root, "symbolic.json"))
    await link(path.join(root, "control.json"), path.join(root, "hard.json"))
    await assert.rejects(privateText(root, "hard.json"))
    await rm(path.join(root, "hard.json"))
    await chmod(path.join(root, "control.json"), 0o644)
    await assert.rejects(privateText(root, "control.json"))
    await writeFile(path.join(root, "invalid.json"), Buffer.from([0xff]), { mode: 0o600 })
    await assert.rejects(privateText(root, "invalid.json"))
    await chmod(root, 0o755)
    await assert.rejects(privateRoot(root))
  } finally { await rm(root, { recursive: true, force: true }) }
})
test("digest preserves exact bytes including trailing newline", () => {
  assert.notEqual(digest("{}"), digest("{}\n"))
})

const obligations = JSON.parse(await readFile(new URL("../../" + obligationPath, import.meta.url), "utf8"))
test("nine current scenarios preserve eight complete mappings, partial distinct grants and all separate G08 groups", () => {
  const list = coverageLedger(obligations, false), executed = coverageLedger(obligations, true)
  assert.equal(cases.length, 9)
  assert.equal(preservedTeams.length, 9)
  assert.deepEqual(list.originalTeams.map((entry) => entry.id), preservedTeams)
  assert(list.originalTeams.every((entry) => entry.status === "NOT_RUN"))
  assert.equal(executed.originalTeams.filter((entry) => entry.status === "PASS").length, 8)
  assert.equal(executed.originalTeams.find((entry) => entry.id === "narrow-keyboard-draft").status, "PASS")
  assert.equal(executed.originalTeams.find((entry) => entry.id === "draft-cancel-discard").status, "PASS")
  assert.equal(executed.originalTeams.find((entry) => entry.id === "same-team-distinct-grants").status, "PARTIAL")
  assert.equal(executed.originalTeams.find((entry) => entry.id === "admin-without-team").status, "PASS")
  assert(executed.groups.every((entry) => entry.status === "NOT_RUN"))
  assert.equal(executed.complete, false)
  assert.deepEqual(executed.groups.map((entry) => entry.id), pendingGroups)
  assert.deepEqual(executed.groups.map((entry) => entry.expectedCount), [6, 22, 22, 3, 32])
  assert.throws(() => requireCompleteGate(list), /G08_REQUIRED_OBLIGATIONS_NOT_PROVEN/)
  assert.throws(() => requireCompleteGate(executed), /G08_REQUIRED_OBLIGATIONS_NOT_PROVEN/)
})
for (const [name, change] of [
  ["deleted original Teams case", (value) => { value.originalTeams.obligations.pop() }],
  ["renamed original Teams case", (value) => { value.originalTeams.obligations[0].id = "principal-only" }],
  ["landing keyboard substituted for Chat", (value) => { value.originalTeams.obligations[5].implementedCases = ["aba-two-windows"] }],
  ["different grants claimed from principals", (value) => { value.originalTeams.obligations[0].coverage = "complete" }],
  ["principal-only control substituted for native admin UI", (value) => { value.originalTeams.obligations[4].implementedCases = ["same-team-principal-binding"] }],
  ["draft discard omitted", (value) => { value.originalTeams.obligations[6].implementedCases = [] }],
  ["fake manual revoke PASS", (value) => { value.originalTeams.obligations[7].state = "PASS" }],
  ["missing distinct-grants blocker", (value) => { value.originalTeams.obligations[0].blocker = null }],
  ["principal case removed from partial mapping", (value) => { value.originalTeams.obligations[0].implementedCases = [] }],
  ["wrong complete mapping", (value) => { value.originalTeams.obligations[7].implementedCases = ["aba-two-windows"] }],
  ["missing required group", (value) => { value.groups.pop() }],
  ["renamed required group", (value) => { value.groups[0].id = "legacy-U15" }],
  ["U39 collapsed inventory", (value) => { value.groups[1].expectedCount = 1 }],
  ["U40 collapsed title list", (value) => { value.groups[2].originalTitles = value.groups[2].originalTitles.slice(0, 1) }],
  ["U15 receipt assumed from old source", (value) => { value.groups[0].state = "PASS" }],
  ["AZ02 restart omitted", (value) => { value.groups[4].phases.pop() }],
  ["gate closed by metadata", (value) => { value.gateClosed = true }],
]) test("preserved coverage refuses " + name, () => {
  const value = structuredClone(obligations)
  change(value)
  assert.throws(() => coverageLedger(value, true))
})
test("source prerequisite refuses missing integrated files without using file presence as live authority", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g08-source-control-"))
  try {
    await assert.rejects(requireProductContracts(root), /G08_PRODUCT_CONTRACT_NOT_INTEGRATED/)
    for (const file of productContractPaths) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), "// synthetic file presence; no installed capability\n")
    }
    await requireProductContracts(root)
    assert.throws(() => requireCompleteGate(coverageLedger(obligations, true)), /G08_REQUIRED_OBLIGATIONS_NOT_PROVEN/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

for (const [name, change] of [
  ["empty all", (value) => { value.originalTeams = []; value.groups = [] }],
  ["empty Teams", (value) => { value.originalTeams = [] }],
  ["empty groups", (value) => { value.groups = [] }],
  ["subset Teams", (value) => { value.originalTeams.pop() }],
  ["duplicate Teams", (value) => { value.originalTeams[0] = value.originalTeams[1] }],
  ["unknown Teams", (value) => { value.originalTeams[0].id = "unregistered" }],
  ["subset groups", (value) => { value.groups.pop() }],
  ["duplicate groups", (value) => { value.groups[0] = value.groups[1] }],
  ["unknown groups", (value) => { value.groups[0].id = "unregistered" }],
  ["incorrect group count", (value) => { value.groups[0].expectedCount = 1 }],
]) test("closing coverage rejects vacuous or forged PASS inventory: " + name, () => {
  // Synthetic metadata only. Even a fully passing shape could never replace verified original receipts.
  const value = coverageLedger(obligations, true)
  value.complete = true
  value.originalTeams.forEach((entry) => { entry.status = "PASS" })
  value.groups.forEach((entry) => { entry.status = "PASS" })
  change(value)
  assert.throws(() => requireCompleteGate(value))
})
