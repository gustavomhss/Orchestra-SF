// Synthetic refusal/composition controls. They never authenticate a host, execute installed cases or close a gate.
import test from "node:test"
import assert from "node:assert/strict"
import az02 from "../../sf/azure/identity/az02-proof.cjs"
import { digest, validatePlan, validatePackage } from "./g08-private-evidence.mjs"
import { installedKinds, verifyInstalledHostPair, verifyAz02Phase, verifyExecutionStatus,
  verifyInstalledChain } from "./g08-installed-evidence.mjs"
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

const clone = (value) => structuredClone(value)
function pair() {
  const before = { ...host(), phase: "before", observedAt: "2026-01-01T00:59:01Z" }
  const after = { ...host(), phase: "after", observedAt: "2026-01-01T01:00:00Z" }
  return { before, after }
}
function status() {
  return { schema: "sf-g08-execution-status-v1", kind: "U39", invocation: plan().invocation,
    startedAt: "2026-01-01T00:59:00Z", finishedAt: "2026-01-01T01:00:01Z",
    commandExit: 0, registrationExit: 0, hostBeforeExit: 0, hostAfterExit: 0,
    trackedDiffExit: 0, stagedDiffExit: 0, signal: null }
}
function restartPair() {
  const value = pair(), after = value.after
  after.phase = "after-restart"; after.process.pid = 124; after.process.startTicks = "200"
  after.binding.listenerInode = "1234"
  after.binding.descriptor.hostId = "synthetic-restarted-host"
  const sha = digest(JSON.stringify(Object.fromEntries(Object.entries(after.binding.descriptor).sort(([a], [b]) => a.localeCompare(b)))))
  after.binding.loopbackDiscoverySha256 = after.binding.httpsDiscoverySha256 = sha
  const process = (source) => ({ pid: source.pid, startTicks: source.startTicks, bootId: source.bootId,
    executable: source.exe, factorySha256: packageReceipt().factory.sha256 })
  return { ...value, private: { details: [{ role: "requester", cookieSha256: "9".repeat(64),
    before: process(value.before.process), after: process(after.process), freshHost: clone(after.binding.descriptor) }] } }
}

test("ordinary group requires unchanged original installed process and full binding", () => {
  const { before, after } = pair()
  const p = validatePlan(plan()), pkg = validatePackage(packageReceipt(), p)
  assert.equal(verifyInstalledHostPair("U39", p, pkg, before, after).after.process.pid, 123)
  verifyExecutionStatus(status(), p, "U39", before, after)
})
for (const [name, change] of [
  ["PID", (value) => { value.process.pid++ }],
  ["start ticks", (value) => { value.process.startTicks = "200" }],
  ["boot", (value) => { value.process.bootId = uuid(21) }],
  ["factory", (value) => { value.binding.factorySha256 = "9".repeat(64) }],
  ["ingress", (value) => { value.binding.ingressAddresses = ["10.0.0.5"] }],
  ["listener", (value) => { value.binding.listenerInode = "4321" }],
  ["Caddy", (value) => { value.binding.caddyProcess.pid++ }],
  ["release receipt", (value) => { value.releaseReceiptSha256 = "8".repeat(64) }],
  ["tar", (value) => { value.archiveSha256 = "8".repeat(64) }],
  ["unexpected restart phase", (value) => { value.phase = "after-restart" }],
]) test("ordinary group refuses changed " + name, () => {
  const { before, after } = pair(); change(after)
  assert.throws(() => verifyInstalledHostPair("U39", validatePlan(plan()), packageReceipt(), before, after))
})
test("AZ02 restart alone admits the original new process hostId and listener inode", () => {
  const value = restartPair()
  const output = verifyInstalledHostPair("AZ02-after-restart", validatePlan(plan()), packageReceipt(),
    value.before, value.after, value.private)
  assert.equal(output.after.binding.descriptor.hostId, "synthetic-restarted-host")
  assert.throws(() => verifyInstalledHostPair("U39", validatePlan(plan()), packageReceipt(),
    value.before, value.after, value.private))
})
for (const [name, change] of [
  ["no process change", (v) => { v.after.process = clone(v.before.process); v.private.details[0].after = clone(v.private.details[0].before) }],
  ["no host change", (v) => { v.private.details[0].freshHost.hostId = plan().target.hostId }],
  ["foreign installation", (v) => { v.private.details[0].freshHost.installationId = "synthetic-other" }],
  ["foreign tenant", (v) => { v.private.details[0].freshHost.tenantId = uuid(50) }],
  ["foreign origin", (v) => { v.private.details[0].freshHost.publicOrigin = "https://other.invalid" }],
  ["foreign mount", (v) => { v.private.details[0].freshHost.mount = "/another" }],
  ["extra Team selector", (v) => { v.private.details[0].freshHost.teamObjectId = uuid(90) }],
  ["unobserved old process", (v) => { v.private.details[0].before.pid++ }],
  ["unobserved new process", (v) => { v.private.details[0].after.pid++ }],
  ["different factory", (v) => { v.private.details[0].after.factorySha256 = "0".repeat(64) }],
  ["duplicate transition", (v) => { v.private.details.push(clone(v.private.details[0])) }],
  ["missing transition", (v) => { v.private.details = [] }],
]) test("restart refuses " + name, () => {
  const v = restartPair(); change(v)
  assert.throws(() => verifyInstalledHostPair("AZ02-after-restart", validatePlan(plan()), packageReceipt(),
    v.before, v.after, v.private))
})
for (const key of ["commandExit", "registrationExit", "hostBeforeExit", "hostAfterExit", "trackedDiffExit", "stagedDiffExit"])
  test("execution refuses failed original " + key, () => {
    const s = status(); s[key] = 1; const { before, after } = pair()
    assert.throws(() => verifyExecutionStatus(s, validatePlan(plan()), "U39", before, after))
  })
for (const [name, change] of [
  ["signal", (s) => { s.signal = "SIGTERM" }],
  ["unknown status field", (s) => { s.manualPass = true }],
  ["wrong invocation", (s) => { s.invocation.id = "1".repeat(32) }],
  ["before reservation", (s) => { s.startedAt = "2025-12-31T23:59:59Z" }],
  ["after reservation", (s) => { s.finishedAt = "2026-01-01T02:00:00Z" }],
  ["host before command", (s) => { s.startedAt = "2026-01-01T01:00:00Z" }],
  ["host after command", (s) => { s.finishedAt = "2026-01-01T00:59:59Z" }],
]) test("execution refuses " + name, () => {
  const s = status(); change(s); const { before, after } = pair()
  assert.throws(() => verifyExecutionStatus(s, validatePlan(plan()), "U39", before, after))
})

function phaseFixture(phase = "actors") {
  const p = validatePlan(plan()), pkg = packageReceipt(), planRaw = JSON.stringify(plan()) + "\n"
  const config = { schema: "sf.az02.teams-plan.v2", origin: p.target.publicOrigin, mount: p.target.mount,
    tenantId: p.target.tenantId, clientId: uuid(60), teamObjectId: p.target.teamObjectId, foreignTeamObjectId: p.teamB.teamObjectId,
    installationId: p.target.installationId, projectId: p.target.projectId, hostId: p.target.hostId,
    candidate: p.candidate, archiveSha256: pkg.archive.sha256, invocation: p.invocation, teamDirectory: "self",
    hostPlanFile: p.scratchRoot + "/plan.json",
    actors: Object.fromEntries([["requester","requester"],["holder","holder"],["denied","denied"],
      ["noTeam","denied"],["administrator","dashboardAdmin"]].map(([role, actor]) =>
      [role, { principalObjectId: p.actors[actor], cookieFile: p.scratchRoot + "/" + role + "-cookie.txt" }])) }
  const details = { schema: "sf.az02.private-observations.v2", phase, candidate: p.candidate,
    archiveSha256: pkg.archive.sha256, invocation: p.invocation,
    details: phase === "preflight" ? [] : [{ role: "requester", cookieSha256: "9".repeat(64) }] }
  const raw = JSON.stringify(details) + "\n"
  const proof = { schema: "sf.az02.teams-proof.v2", phase, status: "PASS",
    proofClass: "OWNER_OPERATED_HTTPS_OBSERVATIONS", liveQualified: false, installedTeamsProof: false,
    g08Closed: false, finalCandidate: false, candidate: p.candidate, invocation: p.invocation,
    archiveSha256: pkg.archive.sha256, hostPlanSha256: digest(planRaw), privateEvidenceSha256: digest(raw),
    source: { legacySha: "687759276c2c9121c2cfd20a5994b277ceb7ee4d", contractRevision: "sf-team-profile/1",
      legacyCaseCount: 32, currentCaseCount: 37, legacyMap: az02.LEGACY_MAP, addedCaseIds: az02.ADDITIONS },
    cases: az02.ROSTER[phase].map((id) => ({ id, status: "PASS" })),
    counts: { total: az02.ROSTER[phase].length, passed: az02.ROSTER[phase].length, failed: 0, skipped: 0 } }
  return { p, pkg, planRaw, config, details, raw, proof }
}
function checkPhase(v) {
  return verifyAz02Phase("AZ02-" + v.proof.phase, v.p, v.pkg, v.planRaw, v.proof, v.details, v.raw, v.config)
}
test("all six original AZ02 phase shapes retain exactly37 obligations and32 historical bindings", () => {
  assert.equal(az02.PHASES.reduce((total, phase) => total + checkPhase(phaseFixture(phase)).length, 0), 37)
})
for (const [name, change] of [
  ["controlled transport", (v) => { v.proof.proofClass = "CONTROLLED_TRANSPORT" }],
  ["manual LIVE", (v) => { v.proof.liveQualified = true }],
  ["missing original case", (v) => { v.proof.cases.pop() }],
  ["extra original case", (v) => { v.proof.cases.push(clone(v.proof.cases[0])) }],
  ["failed case", (v) => { v.proof.cases[0].status = "FAIL" }],
  ["misleading counts", (v) => { v.proof.counts.passed-- }],
  ["different raw private bytes", (v) => { v.raw += " " }],
  ["different raw plan", (v) => { v.planRaw += " " }],
  ["different archive", (v) => { v.proof.archiveSha256 = "2".repeat(64) }],
  ["foreign requester", (v) => { v.config.actors.requester.principalObjectId = uuid(70) }],
  ["foreign Team boundary", (v) => { v.config.foreignTeamObjectId = uuid(70) }],
  ["missing original cookie observation", (v) => { v.details.details = []; v.raw = JSON.stringify(v.details) + "\n"; v.proof.privateEvidenceSha256 = digest(v.raw) }],
  ["historical count changed", (v) => { v.proof.source = { ...v.proof.source, legacyCaseCount: 31 } }],
]) test("AZ02 binding refuses " + name, () => {
  const v = phaseFixture(); change(v); assert.throws(() => checkPhase(v))
})
function chain() {
  return installedKinds.map((kind, index) => {
    const p = plan(); p.invocation.id = (index + 1).toString(16).padStart(32, "0")
    p.scratchRoot += "-" + index
    if (index < 5) {
      p.actors = Object.fromEntries(Object.keys(p.actors).map((role, i) => [role, uuid(100 + index * 10 + i)]))
      p.approvals.actorsReference += String(index)
    }
    const startedAt = "2026-01-01T00:" + String(index * 3).padStart(2, "0") + ":00Z"
    const finishedAt = "2026-01-01T00:" + String(index * 3 + 1).padStart(2, "0") + ":00Z"
    return { plan: p, packageReceipt: packageReceipt(), pair: pair(), privatePhase: {
      details: kind === "AZ02-preflight" || index < 5 ? [] : [{ role: "requester", cookieSha256: "9".repeat(64) }] },
      receipt: { kind, execution: { startedAt, finishedAt } } }
  })
}
test("joining all groups permits different explicitly bound actors per invocation", () => {
  const result = verifyInstalledChain(chain())
  assert.equal(result.complete, true)
  assert.deepEqual(result.groups.map((item) => item.expectedCount), [6, 22, 22, 3, 37])
  assert.equal(result.originalTeams.length, 9)
})
for (const [name, change] of [
  ["missing group", (v) => { v.pop() }],
  ["extra group", (v) => { v.push(clone(v[0])) }],
  ["group reordered", (v) => { [v[0], v[1]] = [v[1], v[0]] }],
  ["duplicate nonce", (v) => { v[1].plan.invocation.id = v[0].plan.invocation.id }],
  ["reused private root", (v) => { v[1].plan.scratchRoot = v[0].plan.scratchRoot }],
  ["another SHA", (v) => { v[1].plan.candidate.sha = "9".repeat(40) }],
  ["another tree", (v) => { v[1].plan.candidate.tree = "9".repeat(40) }],
  ["another reservation", (v) => { v[1].plan.reservation.reference += "9" }],
  ["another VM", (v) => { v[1].plan.reservation.vmId = uuid(99) }],
  ["another tar", (v) => { v[1].packageReceipt.archive.sha256 = "9".repeat(64) }],
  ["another manifest", (v) => { v[1].packageReceipt.manifest.sha256 = "9".repeat(64) }],
  ["another package receipt", (v) => { v[1].plan.packageReceiptSha256 = "9".repeat(64) }],
  ["another origin", (v) => { v[1].plan.target.publicOrigin = "https://foreign.invalid" }],
  ["another Team", (v) => { v[1].plan.target.teamObjectId = uuid(80) }],
  ["unexpected host before restart", (v) => { v[1].plan.target.hostId = "synthetic-new" }],
  ["unexpected process between groups", (v) => { v[1].pair.before.process.pid++ }],
  ["unexpected process after a group", (v) => { v[1].pair.after.process.pid++ }],
  ["AZ02 actors replaced", (v) => { v[6].plan.actors.requester = uuid(80) }],
  ["AZ02 cookie replaced", (v) => { v[7].privatePhase.details[0].cookieSha256 = "8".repeat(64) }],
  ["AZ02 phases overlap", (v) => { v[7].receipt.execution.startedAt = v[6].receipt.execution.startedAt }],
  ["UI after restart", (v) => { v[0].receipt.execution.finishedAt = "2026-01-01T01:59:00Z" }],
]) test("complete join refuses " + name, () => {
  const value = chain(); change(value); assert.throws(() => verifyInstalledChain(value))
})
