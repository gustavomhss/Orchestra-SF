// Original installed G08 invocations and their complete source-bound aggregation.
// No input status document is accepted as a substitute for an original report or GitHub producer.
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { constants } from "node:fs"
import { open, readFile, mkdir, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import az02 from "../../sf/azure/identity/az02-proof.cjs"
import {
  cases, preservedTeams, pendingGroups, record, digest, privateText, privateRoot, writePrivate,
  validatePlan, readPlan, requireInvocation, validatePackage, validateHost, sourcePaths,
  coverageLedger, requireCompleteGate, inspectCurrentEvidence, obligationPath,
} from "./g08-private-evidence.mjs"
import {
  groups as nativeGroups, verifyNativeReport, verifyNativeObservations, verifyF04JUnit, verifyOmni,
} from "./g08-native-journeys.mjs"

export const installedKinds = Object.freeze(["TEAMS", "U15", "U39", "U40", "F04",
  ...az02.PHASES.map((phase) => "AZ02-" + phase)])
export const installedWorkflow = ".github/workflows/g08-installed-complete.yml"
export const installedSources = Object.freeze([...new Set([...sourcePaths,
  installedWorkflow, "script/sf-ci/g08-installed-run.sh", "script/sf-ci/g08-installed-evidence.mjs",
  "script/sf-ci/g08-proof-provenance.mjs", "script/sf-ci/g08-native-journeys.mjs",
  "script/sf2h/proofs/installed/execute-registration.ts", "script/sf2h/proofs/installed/host-adapter.ts",
  "script/sf2h/proofs/installed/register.ts", "script/sf2h/proofs/installed/consume.ts",
  "packages/app-shell/e2e/playwright.production.config.ts",
  ...["fixture.ts", ...["browser-transport", "case-contract", "installed-browser", "installed-host",
    "installed-manifest", "installed-operations", "original-host-adapter", "g08-manifest-contract", "g08-readiness", "manifest-contract",
    "selected-installation", "readiness", "journeys", "response-faults"].map((name) => "fixture/" + name + ".ts"),
    ...["u15", "u39", "u40"].map((name) => "journeys/" + name + ".spec.ts")]
    .map((name) => "packages/app-shell/e2e/sucafina/native/" + name),
  "packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts",
])].sort())

const same = (a, b, reason) => assert.deepEqual(a, b, reason)
const hash = (value) => assert(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), "G08_AGGREGATE_HASH_REQUIRED")
const instant = (value) => {
  assert(typeof value === "string" && Number.isFinite(Date.parse(value)), "G08_AGGREGATE_TIME_REQUIRED")
  return Date.parse(value)
}
const parse = (raw) => az02.strictJson(raw)
const exact = (value, keys) => same(Object.keys(record(value)).sort(), [...keys].sort(), "G08_AGGREGATE_CLOSED_FIELDS")
const candidateEnvironment = (plan) => ({
  ...process.env, SF_G08_CANDIDATE_SHA: plan.candidate.sha, SF_G08_CANDIDATE_TREE: plan.candidate.tree,
  SF_G08_INVOCATION_ID: plan.invocation.id, SF_G08_PRIVATE_ROOT: plan.scratchRoot,
  SF_NATIVE_CANDIDATE_SHA: plan.candidate.sha, SF_NATIVE_INVOCATION_ID: plan.invocation.id,
  SF_NATIVE_INSTALLED_MANIFEST: path.join(plan.scratchRoot, "native-installed-manifest.json"),
  SF_NATIVE_PRIVATE_REPORT: path.join(plan.scratchRoot, "native-playwright.json"),
  SF_NATIVE_BROWSER_ENDPOINT_FILE: path.join(plan.scratchRoot, "browser-endpoint.txt"),
})
export async function installedSourceInventory() {
  return Promise.all(installedSources.map(async (file) => ({ path: file, sha256: digest(await readFile(file)) })))
}

/** Both observations are produced by the original read-only Linux/installer observer.
 * A restart is accepted only for the last AZ02 phase, with its original watcher chain.
 */
export function verifyInstalledHostPair(kind, plan, receipt, beforeInput, afterInput, azPrivate) {
  const before = validateHost(beforeInput, plan, receipt), afterValue = record(afterInput)
  assert(before.phase === "before", "G08_GROUP_BEFORE_PHASE_REQUIRED")
  let afterPlan = plan
  if (kind === "AZ02-after-restart") {
    assert(afterValue.phase === "after-restart", "G08_RESTART_OBSERVER_REQUIRED")
    const details = record(azPrivate).details
    assert(Array.isArray(details), "G08_ORIGINAL_RESTART_DETAILS_REQUIRED")
    const entries = details.filter((item) => record(item).before && record(item).after && record(item).freshHost)
    assert.equal(entries.length, 1, "G08_ONE_ORIGINAL_RESTART_REQUIRED")
    const transition = entries[0], descriptor = transition.freshHost
    const expected = { contractRevision: "sf-team-profile/1", authMode: "microsoft",
      installationId: plan.target.installationId, tenantId: plan.target.tenantId,
      projectId: plan.target.projectId, publicOrigin: plan.target.publicOrigin, mount: plan.target.mount }
    const { hostId, ...rest } = descriptor
    same(rest, expected, "G08_RESTART_CHANGED_PLACEMENT")
    assert(typeof hostId === "string" && hostId.length > 0 && hostId !== plan.target.hostId,
      "G08_RESTART_NEW_HOST_REQUIRED")
    for (const [observed, actual] of [[transition.before, before.process], [transition.after, afterValue.process]]) {
      assert(observed.pid === actual.pid && observed.startTicks === actual.startTicks &&
        observed.bootId === actual.bootId && observed.executable === actual.exe &&
        observed.factorySha256 === receipt.factory.sha256, "G08_RESTART_PROCESS_CHAIN_MISMATCH")
    }
    assert(before.process.pid !== afterValue.process.pid || before.process.startTicks !== afterValue.process.startTicks ||
      before.process.bootId !== afterValue.process.bootId, "G08_RESTART_NOT_OBSERVED")
    afterPlan = { ...plan, target: { ...plan.target, hostId } }
  } else {
    assert(afterValue.phase === "after", "G08_GROUP_AFTER_PHASE_REQUIRED")
    same(before.process, afterValue.process, "G08_UNEXPECTED_PROCESS_CHANGE")
  }
  const after = validateHost(afterValue, afterPlan, receipt)
  const binding = (value) => {
    const { descriptor, loopbackDiscoverySha256, httpsDiscoverySha256, listenerInode, ...stable } = value
    return kind === "AZ02-after-restart" ? stable : { ...stable, listenerInode }
  }
  same(binding(before.binding), binding(after.binding), "G08_GROUP_RUNTIME_PLACEMENT_CHANGED")
  if (kind !== "AZ02-after-restart") same(before.binding, after.binding, "G08_GROUP_BINDING_CHANGED")
  assert(before.installerSha256 === after.installerSha256 &&
    before.releaseReceiptSha256 === after.releaseReceiptSha256, "G08_GROUP_INSTALLED_BYTES_CHANGED")
  assert(instant(before.observedAt) <= instant(after.observedAt), "G08_GROUP_HOST_ORDER")
  return { before, after }
}


/** Bind the final observer's restart sidecar back to the unchanged original private byte chain. */
export function verifyRestartBinding(after, plan, packageReceipt, bytes) {
  const restart = record(after.restart)
  exact(restart, ["schema", "status", "candidate", "archiveSha256", "invocation", "planSha256",
    "hostBeforeSha256", "releaseReceiptSha256", "az02PhaseSha256", "az02PrivateSha256",
    "producerSourceSha256", "oldHostId", "newHostId", "before", "after", "cookieSha256",
    "requiresOriginalWorkflowChain", "liveQualified"])
  assert(restart.schema === "sf-g08-az02-restart-v1" &&
    restart.status === "AZ02_PROCESS_AND_HOST_TRANSITION_REOBSERVED" &&
    restart.requiresOriginalWorkflowChain === true && restart.liveQualified === false,
    "G08_FINAL_RESTART_OBSERVER_REQUIRED")
  same(restart.candidate, plan.candidate, "G08_RESTART_CANDIDATE_CHANGED")
  same(restart.invocation, plan.invocation, "G08_RESTART_INVOCATION_CHANGED")
  assert(restart.archiveSha256 === packageReceipt.archive.sha256 &&
    restart.releaseReceiptSha256 === after.releaseReceiptSha256, "G08_RESTART_INSTALLED_BYTES_CHANGED")
  for (const [field, name] of [["planSha256","plan.json"], ["hostBeforeSha256","host-before.json"],
    ["az02PhaseSha256","az02-phase.json"], ["az02PrivateSha256","az02-private.json"],
    ["producerSourceSha256","producer"]])
    assert.equal(restart[field], digest(bytes[name]), "G08_RESTART_ORIGINAL_BYTES_CHANGED")
  assert(restart.oldHostId === plan.target.hostId &&
    restart.newHostId === after.binding.descriptor.hostId && restart.newHostId !== restart.oldHostId,
    "G08_RESTART_DESCRIPTOR_CHANGED")
  same(after.target, { ...plan.target, hostId: restart.newHostId }, "G08_RESTART_TARGET_CHANGED")
  const detail = parse(bytes["az02-private.json"]).details[0]
  same(restart.before, detail.before, "G08_RESTART_BEFORE_CHANGED")
  same(restart.after, detail.after, "G08_RESTART_AFTER_CHANGED")
  assert.equal(restart.cookieSha256, detail.cookieSha256, "G08_RESTART_COOKIE_CHANGED")
}

/** Parse only original executor results. Manual PASS, controlled transport, omitted or additional cases fail. */
export function verifyAz02Phase(kind, plan, packageReceipt, planRaw, proof, privateProof, privateRaw, configInput) {
  const phase = kind.replace(/^AZ02-/, "")
  assert(az02.PHASES.includes(phase), "G08_AZ02_PHASE_REQUIRED")
  const config = az02.validateConfig(configInput)
  assert(proof.schema === "sf.az02.teams-proof.v2" && proof.phase === phase &&
    proof.status === "PASS" && proof.proofClass === "OWNER_OPERATED_HTTPS_OBSERVATIONS",
    "G08_AZ02_ORIGINAL_PHASE_REQUIRED")
  for (const field of ["liveQualified", "installedTeamsProof", "g08Closed", "finalCandidate"])
    assert(proof[field] === false, "G08_AZ02_MANUAL_PROMOTION_REFUSED")
  same(proof.candidate, plan.candidate, "G08_AZ02_CANDIDATE_MISMATCH")
  same(proof.invocation, plan.invocation, "G08_AZ02_INVOCATION_MISMATCH")
  assert(proof.archiveSha256 === packageReceipt.archive.sha256 && proof.hostPlanSha256 === digest(planRaw) &&
    proof.privateEvidenceSha256 === digest(privateRaw), "G08_AZ02_ORIGINAL_BYTES_MISMATCH")
  assert(privateProof.schema === "sf.az02.private-observations.v2" && privateProof.phase === phase,
    "G08_AZ02_PRIVATE_PHASE_REQUIRED")
  same(privateProof.candidate, plan.candidate, "G08_AZ02_PRIVATE_CANDIDATE_MISMATCH")
  same(privateProof.invocation, plan.invocation, "G08_AZ02_PRIVATE_INVOCATION_MISMATCH")
  assert(privateProof.archiveSha256 === packageReceipt.archive.sha256, "G08_AZ02_PRIVATE_TAR_MISMATCH")
  same(proof.source, { legacySha: "687759276c2c9121c2cfd20a5994b277ceb7ee4d",
    contractRevision: "sf-team-profile/1", legacyCaseCount: 32, currentCaseCount: 37,
    legacyMap: az02.LEGACY_MAP, addedCaseIds: az02.ADDITIONS }, "G08_AZ02_HISTORICAL_OBLIGATIONS_CHANGED")
  assert(Array.isArray(proof.cases), "G08_AZ02_CASES_REQUIRED")
  same(proof.cases.map((item) => item.id), az02.ROSTER[phase], "G08_AZ02_EXACT_PHASE_ROSTER_REQUIRED")
  assert(proof.cases.every((item) => item.status === "PASS"), "G08_AZ02_NONPASS")
  same(proof.counts, { total: az02.ROSTER[phase].length, passed: az02.ROSTER[phase].length,
    failed: 0, skipped: 0 }, "G08_AZ02_COUNTS_REQUIRED")
  same(config.candidate, plan.candidate, "G08_AZ02_CONFIG_CANDIDATE_MISMATCH")
  same(config.invocation, plan.invocation, "G08_AZ02_CONFIG_INVOCATION_MISMATCH")
  assert(config.archiveSha256 === packageReceipt.archive.sha256 &&
    config.hostPlanFile === path.join(plan.scratchRoot, "plan.json"), "G08_AZ02_CONFIG_BINDING_MISMATCH")
  for (const [key, targetKey] of [["origin","publicOrigin"], ["mount","mount"], ["installationId","installationId"],
    ["tenantId","tenantId"], ["projectId","projectId"], ["hostId","hostId"], ["teamObjectId","teamObjectId"]])
    assert(config[key] === plan.target[targetKey], "G08_AZ02_CONFIG_OWNER_MISMATCH")
  assert(config.foreignTeamObjectId === plan.teamB.teamObjectId, "G08_AZ02_FOREIGN_TEAM_NOT_RESERVED")
  for (const [role, actor] of [["requester","requester"],["holder","holder"],["denied","denied"],
    ["noTeam","denied"],["administrator","dashboardAdmin"]])
    assert(config.actors[role].principalObjectId === plan.actors[actor], "G08_AZ02_UNRESERVED_PRINCIPAL")
  if (phase !== "preflight") {
    const requester = privateProof.details.filter((item) => item.role === "requester" && item.cookieSha256)
    assert.equal(requester.length, 1, "G08_AZ02_ORIGINAL_REQUESTER_COOKIE_REQUIRED")
    hash(requester[0].cookieSha256)
  }
  return proof.cases.map((item) => ({ id: item.id, state: "ORIGINAL_REPORT_PASS" }))
}

export function verifyExecutionStatus(status, plan, kind, before, after) {
  exact(status, ["schema", "kind", "invocation", "startedAt", "finishedAt", "commandExit",
    "registrationExit", "hostBeforeExit", "hostAfterExit", "trackedDiffExit", "stagedDiffExit", "signal"])
  assert(status.schema === "sf-g08-execution-status-v1" && status.kind === kind && status.signal === null,
    "G08_ORIGINAL_EXECUTION_STATUS_REQUIRED")
  same(status.invocation, plan.invocation, "G08_STATUS_INVOCATION_MISMATCH")
  for (const key of ["commandExit", "registrationExit", "hostBeforeExit", "hostAfterExit", "trackedDiffExit", "stagedDiffExit"])
    assert(status[key] === 0, "G08_ORIGINAL_COMMAND_OR_CLEANUP_FAILED")
  assert(instant(status.startedAt) >= instant(plan.reservation.startsAt) &&
    instant(status.finishedAt) < instant(plan.reservation.endsAt) &&
    instant(status.startedAt) <= instant(before.observedAt) &&
    instant(before.observedAt) <= instant(after.observedAt) &&
    instant(after.observedAt) <= instant(status.finishedAt), "G08_GROUP_EXECUTION_OUTSIDE_WINDOW")
  return status
}


/** The plan reserves the original Team home. Each suite uses the shipped route helper,
 * then registration independently observes the real anchor/F01/UI.
 */
export async function expectedInstalledTargets(kind, plan) {
  assert(nativeGroups.includes(kind) || kind === "F04", "G08_NATIVE_KIND_REQUIRED")
  if (kind === "F04") return { target: plan.target, wrongTeam: plan.teamB, wrongInstallation: plan.foreignInstallation }
  const { nativeJourneyEntryHref } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/journeys.ts")
  const capability = { U15: "CAP14", U39: "CAP04", U40: "CAP05" }[kind]
  const derive = (value) => {
    const href = new URL(nativeJourneyEntryHref(value, capability, kind === "U15" ? undefined : 2026))
    return { ...value, chapterHref: href.pathname + href.search }
  }
  return { target: derive(plan.target), wrongTeam: derive(plan.teamB), wrongInstallation: derive(plan.foreignInstallation) }
}
export function verifyOriginalRegistration(kind, value, manifest, plan, bytes) {
  assert(value.schema === "sf-g08-native-registration-v1" && value.status === "REGISTERED_ONLY_NOT_EXECUTED" &&
    value.kind === kind && value.manifestSchema === manifest.schema &&
    value.connectionSource === "SfTrustedInstallationSource.current", "G08_ORIGINAL_REGISTRATION_REQUIRED")
  same(value.source, plan.candidate, "G08_REGISTRATION_SOURCE_CHANGED")
  same(value.invocation, manifest.invocation, "G08_REGISTRATION_INVOCATION_CHANGED")
  assert(value.selectedCount === (kind === "F04" ? 0 : kind === "U15" ? 5 : 8), "G08_REGISTRATION_SELECTION_COUNT")
  same(value.bindings, { planSha256: digest(bytes["plan.json"]), packageReceiptSha256: plan.packageReceiptSha256,
    hostBeforeSha256: digest(bytes["host-before.json"]), actorsReferenceSha256: digest(plan.approvals.actorsReference),
    reservationSha256: digest(JSON.stringify(plan.reservation)) }, "G08_REGISTRATION_BINDING_CHANGED")
  const expected = ["native-installed-manifest.json", "native-context-observations.json", "native-registration-observations.json",
    ...(kind === "F04" ? [] : ["native-installed-" + kind.toLowerCase() + ".json"]),
    ...(kind === "U15" ? ["native-runner-environment.json"] : [])].sort()
  assert(Array.isArray(value.files), "G08_REGISTRATION_ORIGINAL_FILES_REQUIRED")
  same(value.files.map((item) => item.path).sort(), expected, "G08_REGISTRATION_EXACT_FILES_REQUIRED")
  for (const item of value.files) {
    assert(Object.hasOwn(bytes, item.path), "G08_REGISTRATION_ORIGINAL_BYTES_MISSING")
    assert.equal(digest(bytes[item.path]), item.sha256, "G08_REGISTRATION_ORIGINAL_BYTES_CHANGED")
  }
  const cleanup = record(value.cleanup)
  assert(cleanup.completed === true && cleanup.originalPagesPreserved === true && cleanup.clientDisconnected === true &&
    Number.isSafeInteger(cleanup.ownPagesClosed) && cleanup.ownPagesClosed >= (kind === "F04" ? 0 : 1),
    "G08_REGISTRATION_CLEANUP_REQUIRED")
  for (const field of ["installed", "liveQualified", "g08Closed", "finalCandidate", "productionCutover"])
    assert(value[field] === false, "G08_REGISTRATION_IS_NOT_EXECUTION")
}

export async function inspectInstalledGroup(root, kind) {
  assert(installedKinds.includes(kind), "G08_EXACT_GROUP_REQUIRED")
  await privateRoot(root)
  const files = new Map()
  const text = async (name, maximum = 8_388_608) => {
    const raw = await privateText(root, name, maximum)
    if (files.has(name)) assert.equal(raw, files.get(name), "G08_PRIVATE_INPUT_CHANGED")
    files.set(name, raw)
    return raw
  }
  const json = async (name, maximum) => parse(await text(name, maximum))
  const planRaw = await text("plan.json", 65536), plan = validatePlan(parse(planRaw))
  assert(plan.scratchRoot === root && planRaw === JSON.stringify(parse(planRaw)) + "\n", "G08_GROUP_PLAN_BYTES_REQUIRED")
  const packageRaw = await text("package-receipt.json")
  assert.equal(digest(packageRaw), plan.packageReceiptSha256, "G08_GROUP_PACKAGE_BYTES_REQUIRED")
  const packageReceipt = validatePackage(parse(packageRaw), plan)
  const sourceBefore = await json("group-source-before.json")
  const sources = await installedSourceInventory()
  same(sourceBefore, sources, "G08_GROUP_SOURCE_CHANGED")
  const before = await json("host-before.json"), after = await json("host-after.json")
  const status = await json("execution-status.json")
  let inventory, privatePhase
  if (kind === "TEAMS") {
    const current = await inspectCurrentEvidence(root, plan, packageReceipt)
    same(await json("current-receipt.json"), current, "G08_ORIGINAL_NINE_RECEIPT_CHANGED")
    inventory = current.cases.map((item) => ({ id: item.id, state: "ORIGINAL_REPORT_PASS" }))
    await text("playwright.json", 25_000_000)
    await text("exit-code.txt", 64)
    await text("session-grants.json", 25_000_000)
    await text("source-before.json")
    for (const item of cases) await text("cleanup-" + item.id + ".json")
  } else if (nativeGroups.includes(kind) || kind === "F04") {
    const { validateG08NativeManifest } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/g08-manifest-contract.ts")
    const manifestRaw = await text("native-installed-manifest.json")
    const manifest = validateG08NativeManifest(parse(manifestRaw))
    assert(manifest.candidateSha === plan.candidate.sha && manifest.scratchRoot === root,
      "G08_NATIVE_MANIFEST_SOURCE_MISMATCH")
    same(manifest.actors, plan.actors, "G08_NATIVE_PLAN_ACTORS_MISMATCH")
    const expectedTargets = await expectedInstalledTargets(kind, plan)
    for (const field of ["target", "wrongTeam", "wrongInstallation"])
      same(manifest[field], expectedTargets[field], "G08_NATIVE_PLAN_TARGET_MISMATCH")
    for (const [key, expected] of Object.entries({ treeSha: plan.candidate.tree, runId: plan.invocation.runId,
      runAttempt: plan.invocation.runAttempt, invocationId: plan.invocation.id, archiveSha256: packageReceipt.archive.sha256 }))
      assert(manifest.invocation[key] === expected, "G08_NATIVE_MANIFEST_INVOCATION_MISMATCH")
    await text("native-context-observations.json")
    await text("native-registration-observations.json")
    const registration = await json("native-registration.json")
    if (kind !== "F04") await text("native-installed-" + kind.toLowerCase() + ".json")
    if (kind === "U15") {
      const { validateNativeSelectedInstallation } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts")
      const { validateU15RegisteredEnvironment } = await import("../sf2h/proofs/installed/execute-registration.ts")
      const selected = validateNativeSelectedInstallation(manifest, await json("native-installed-u15.json"))
      validateU15RegisteredEnvironment(await json("native-runner-environment.json"), selected)
    }
    verifyOriginalRegistration(kind, registration, manifest, plan, Object.fromEntries(files))
    if (kind === "F04") {
      assert(manifest.invocation.role === "teams", "G08_F04_ORIGINAL_ROLE_REQUIRED")
      const junit = await text("f04.junit.xml", 2_000_000), log = await text("f04.log", 4_000_000)
      assert.equal(await text("f04-exit-code.txt", 16), "0\n", "G08_F04_PROCESS_FAILED")
      const omni = await json("f04-omni.json")
      same(omni.invocation, plan.invocation, "G08_F04_NONCE_INVOCATION_MISMATCH")
      verifyOmni(log, omni.nonce)
      inventory = verifyF04JUnit(junit, { sha: plan.candidate.sha, runId: plan.invocation.runId })
    } else {
      const { validateNativeSelectedInstallation } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts")
      const selected = validateNativeSelectedInstallation(manifest, await json("native-installed-" + kind.toLowerCase() + ".json"))
      assert.equal(selected.suite, kind, "G08_NATIVE_WRONG_SUITE")
      inventory = verifyNativeReport(await json("native-playwright.json"), kind, true)
      const observations = []
      for (const item of inventory)
        observations.push(await json("native-case-" + kind.toLowerCase() + "-" + String(item.number).padStart(2, "0") + ".json"))
      verifyNativeObservations(manifest, selected, inventory, observations, await json("native-browser-detached.json"))
    }
  } else {
    const proof = await json("az02-phase.json")
    const privateRaw = await text("az02-private.json")
    privatePhase = parse(privateRaw)
    inventory = verifyAz02Phase(kind, plan, packageReceipt, planRaw, proof, privatePhase, privateRaw, await json("az02-config.json"))
  }
  const pair = verifyInstalledHostPair(kind, plan, packageReceipt, before, after, privatePhase)
  if (kind === "AZ02-after-restart")
    verifyRestartBinding(after, plan, packageReceipt, { ...Object.fromEntries(files),
      producer: await readFile("sf/azure/identity/az02-proof.cjs") })
  verifyExecutionStatus(status, plan, kind, before, after)
  const authorization = await json("authorization.json")
  await text("execution-authorization.json")
  const receipt = {
    schema: "sf-g08-installed-group-v1", status: "ORIGINAL_GROUP_OBSERVATIONS_VERIFIED",
    kind, candidate: plan.candidate, archive: { file: packageReceipt.archive.file,
      sha256: packageReceipt.archive.sha256, bytes: packageReceipt.archive.bytes },
    invocation: plan.invocation, packageReceiptSha256: plan.packageReceiptSha256,
    bindings: { planSha256: digest(planRaw), reservationSha256: digest(JSON.stringify(plan.reservation)),
      vmIdSha256: digest(plan.reservation.vmId), actorsReferenceSha256: digest(plan.approvals.actorsReference),
      mutationReferenceSha256: digest(plan.approvals.mutationReference) },
    inventory: inventory.map((item) => ({ id: item.id, state: "ORIGINAL_REPORT_PASS" })),
    execution: { startedAt: status.startedAt, finishedAt: status.finishedAt, exitCode: 0 },
    evidence: [...files].map(([name, raw]) => ({ name, sha256: digest(raw) })).sort((a, b) => a.name.localeCompare(b.name)),
    sources, installed: false, liveQualified: false, g08Closed: false, finalCandidate: false, productionCutover: false,
    limits: ["Original GitHub producer/artifact provenance and the complete isolated reservation chain must still be verified.",
      "Raw actor, cookie, business and browser evidence remains private on the authorized host."],
  }
  return { receipt, plan, planRaw, packageReceipt, authorization, pair, privatePhase, files }
}

/** Exact cross-invocation joins; actors may differ between suites, never between AZ02 phases. */
export function verifyInstalledChain(items) {
  same(items.map((item) => item.receipt.kind), installedKinds, "G08_EXACT_ALL_GROUPS_REQUIRED")
  const first = items[0], candidate = first.plan.candidate, reservation = first.plan.reservation
  assert(new Set(items.map((item) => item.plan.invocation.id)).size === items.length &&
    new Set(items.map((item) => item.plan.scratchRoot)).size === items.length, "G08_DISTINCT_INVOCATIONS_REQUIRED")
  const placement = (target) => {
    const { hostId, chapterHref, ...stable } = target
    return stable
  }
  for (const item of items) {
    same(item.plan.candidate, candidate, "G08_MIXED_CANDIDATES")
    same(item.plan.reservation, reservation, "G08_MIXED_RESERVATIONS")
    assert(item.plan.packageReceiptSha256 === first.plan.packageReceiptSha256 &&
      item.packageReceipt.archive.sha256 === first.packageReceipt.archive.sha256 &&
      item.packageReceipt.manifest.sha256 === first.packageReceipt.manifest.sha256, "G08_MIXED_TAR_OR_MANIFEST")
    for (const key of ["target", "teamB", "foreignInstallation"])
      same(placement(item.plan[key]), placement(first.plan[key]), "G08_MIXED_INSTALLATION_PLACEMENT")
    assert(item.plan.target.hostId === first.plan.target.hostId, "G08_UNEXPECTED_PRE_RESTART_HOST")
    same(item.pair.before.process, first.pair.before.process, "G08_PROCESS_CHANGED_BETWEEN_GROUPS")
    if (item.receipt.kind !== "AZ02-after-restart")
      same(item.pair.after.process, first.pair.before.process, "G08_PROCESS_CHANGED_BEFORE_RESTART_PHASE")
  }
  const phases = items.filter((item) => item.receipt.kind.startsWith("AZ02-"))
  const cookie = (item) => item.privatePhase.details.find((entry) => entry.role === "requester" && entry.cookieSha256)?.cookieSha256
  for (let at = 0; at < phases.length; at++) {
    same(phases[at].plan.actors, phases[0].plan.actors, "G08_AZ02_PRINCIPALS_CHANGED")
    if (at > 0) {
      assert(instant(phases[at - 1].receipt.execution.finishedAt) <= instant(phases[at].receipt.execution.startedAt),
        "G08_AZ02_PHASE_ORDER")
      hash(cookie(phases[at]))
      if (at > 1) assert.equal(cookie(phases[at]), cookie(phases[1]), "G08_AZ02_COOKIE_REPLACED")
    }
  }
  assert(items.slice(0, 5).every((item) => instant(item.receipt.execution.finishedAt) <=
    instant(phases.at(-1).receipt.execution.startedAt)), "G08_RESTART_MUST_FOLLOW_ALL_UI_GROUPS")
  const coverage = { schema: "sf-g08-coverage-v1",
    originalTeams: preservedTeams.map((id) => ({ id, status: "PASS" })),
    groups: pendingGroups.map((id, index) => ({ id, status: "PASS", expectedCount: [6, 22, 22, 3, 37][index] })),
    complete: true }
  requireCompleteGate(coverage)
  return coverage
}

/** Try flushing and closing independently, preserving evidence failure instead of emitting success. */
export async function finishCommandOutput(handle) {
  const failures = []
  try { await handle.sync() } catch (error) { failures.push(error) }
  try { await handle.close() } catch (error) { failures.push(error) }
  if (failures.length) throw new AggregateError(failures, "G08_PRIVATE_COMMAND_OUTPUT_FAILED")
}
/** Every finalizer and the failure status are attempted even after an observer/logging error. */
export async function finalizeExecution(status, operations) {
  const failures = []
  for (const [field, operation] of [
    ["hostAfterExit", operations.hostAfter],
    ["trackedDiffExit", operations.trackedDiff],
    ["stagedDiffExit", operations.stagedDiff],
  ]) {
    if (!operation) continue
    try { status[field] = await operation() }
    catch (error) { status[field] = 125; status.signal ??= "FINALIZER_ERROR"; failures.push(error) }
  }
  status.finishedAt = new Date().toISOString()
  try { await operations.persist(status) } catch (error) { failures.push(error) }
  if (failures.length) throw new AggregateError(failures, "G08_ORIGINAL_FINALIZATION_FAILED")
}
async function command(root, name, executable, args, env, cwd = process.cwd()) {
  const handle = await open(path.join(root, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    const result = spawnSync(executable, args, { env, cwd, stdio: ["ignore", handle.fd, handle.fd] })
    return { exit: result.status ?? 125, signal: result.signal ?? (result.error ? "SPAWN_ERROR" : null) }
  } finally { await finishCommandOutput(handle) }
}
async function runInstalled(kind) {
  assert(installedKinds.includes(kind), "G08_EXACT_GROUP_REQUIRED")
  const root = process.env.SF_G08_PRIVATE_ROOT
  await privateRoot(root)
  const git = (args) => {
    const result = spawnSync("git", args, { encoding: "utf8" })
    assert(result.status === 0 && !result.signal, "G08_CHECKOUT_OBSERVATION_FAILED")
    return result.stdout.trim()
  }
  process.env.SF_G08_CANDIDATE_SHA = git(["rev-parse", "HEAD"])
  process.env.SF_G08_CANDIDATE_TREE = git(["rev-parse", "HEAD^{tree}"])
  assert(process.env.SF_G08_CANDIDATE_SHA === process.env.GITHUB_SHA &&
    git(["status", "--porcelain", "--untracked-files=no"]) === "", "G08_EXACT_CLEAN_CHECKOUT_REQUIRED")
  const plan = await readPlan(root), env = candidateEnvironment(plan)
  const planRaw = await privateText(root, "plan.json", 65536)
  const packageRaw = await privateText(root, "package-receipt.json")
  assert.equal(digest(packageRaw), plan.packageReceiptSha256, "G08_PACKAGE_BYTES_REQUIRED")
  const packageReceipt = validatePackage(parse(packageRaw), plan)
  const { verifyExecutionAuthorization } = await import("./g08-proof-provenance.mjs")
  const admitted = await verifyExecutionAuthorization({ plan, planRaw, archiveSha256: packageReceipt.archive.sha256,
    authorization: parse(await privateText(root, "authorization.json", 65536)) })
  await writePrivate(root, "execution-authorization.json", admitted)
  coverageLedger(parse(await readFile(obligationPath, "utf8")), false)
  await writePrivate(root, "group-source-before.json", await installedSourceInventory())
  const status = { schema: "sf-g08-execution-status-v1", kind, invocation: plan.invocation,
    startedAt: new Date().toISOString(), finishedAt: "", commandExit: 125, registrationExit: 0,
    hostBeforeExit: 125, hostAfterExit: 125, trackedDiffExit: 125, stagedDiffExit: 125, signal: null }
  const capture = async (name, executable, args, cwd) => {
    const result = await command(root, name, executable, args, env, cwd)
    if (result.signal) status.signal = result.signal
    return result.exit
  }
  try {
    if (kind === "TEAMS") {
      status.commandExit = await capture("teams-command.log", "bash", ["script/sf-ci/g08-private-run.sh"])
      // The original nine-case driver is a conjunction of its real command, observer and cleanup statuses.
      status.hostBeforeExit = status.hostAfterExit = status.commandExit
    } else {
      status.hostBeforeExit = await capture("host-before.log", "python3", ["script/sf-ci/g08-installed-preflight.py", "before"])
      if (status.hostBeforeExit === 0) {
        if (nativeGroups.includes(kind) || kind === "F04") {
          status.registrationExit = await capture("registration.log", "bun",
            ["script/sf2h/proofs/installed/execute-registration.ts", kind])
          if (status.registrationExit === 0) {
            if (kind === "F04") {
              const nonce = randomBytes(16).toString("hex")
              env.ORCHESTRA_OMNI_CONTROL = "declared"; env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER = "strict"
              env.ORCHESTRA_OMNI_CONTROL_NONCE = nonce; env.ORCHESTRA_CHANNEL = "prod"
              await writePrivate(root, "f04-omni.json", { invocation: plan.invocation, nonce })
              status.commandExit = await capture("f04.log", "bun", ["test", "--conditions=browser",
                "--preload", "../../script/test-omni-control.ts", "--preload", "./happydom.ts",
                "--reporter=junit", "--reporter-outfile", path.join(root, "f04.junit.xml"),
                "./test-browser/sucafina-native/transport-integration.test.ts"], path.resolve("packages/app-shell"))
              await writeFile(path.join(root, "f04-exit-code.txt"), String(status.commandExit) + "\n", { flag: "wx", mode: 0o600 })
            } else {
              // The five U15 URLs are derived again from the validated original selection, never sourced/eval'd.
              const { validateG08NativeManifest } = await import("../../packages/app-shell/e2e/sucafina/native/fixture/g08-manifest-contract.ts")
              const { validateNativeSelectedInstallation, u15RegisteredEnvironment } =
                await import("../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts")
              const manifest = validateG08NativeManifest(parse(await privateText(root, "native-installed-manifest.json")))
              const selected = validateNativeSelectedInstallation(manifest,
                parse(await privateText(root, "native-installed-" + kind.toLowerCase() + ".json")))
              if (kind === "U15") Object.assign(env, u15RegisteredEnvironment(selected))
              status.commandExit = await capture("native-command.log", "bunx", ["--no-install", "playwright", "test",
                "--config", "e2e/playwright.production.config.ts", "e2e/sucafina/native/journeys/" + kind.toLowerCase() + ".spec.ts",
                "--workers=1", "--retries=0", "--repeat-each=1", "--reporter=json"], path.resolve("packages/app-shell"))
            }
          }
        } else {
          const phase = kind.slice(5)
          const args = ["sf/azure/identity/az02-proof.cjs", "--phase", phase, "--config", path.join(root, "az02-config.json"),
            "--out", path.join(root, "az02-phase.json"), "--private-out", path.join(root, "az02-private.json")]
          if (phase === "producer") args.push("--confirm-producer-writes")
          if (phase === "logout") args.push("--confirm-logout")
          if (phase === "after-restart") args.push("--observe-restart")
          console.log("G08_RESERVED_PHASE_STARTED_" + kind)
          status.commandExit = await capture("az02-command.log", "node", args)
        }
      }
    }
  } catch (error) {
    status.signal ??= "EXECUTION_EXCEPTION"
    throw error
  } finally {
    await finalizeExecution(status, {
      hostAfter: kind === "TEAMS" ? undefined : () => capture("host-after.log", "python3",
        ["script/sf-ci/g08-installed-preflight.py", kind === "AZ02-after-restart" ? "after-restart" : "after"]),
      trackedDiff: () => capture("tracked-group-diff.log", "git", ["diff", "--exit-code"]),
      stagedDiff: () => capture("staged-group-diff.log", "git", ["diff", "--cached", "--exit-code"]),
      persist: (observed) => writePrivate(root, "execution-status.json", observed),
    })
  }
  const observed = await inspectInstalledGroup(root, kind)
  await writePrivate(root, "group-receipt.json", observed.receipt)
  await mkdir("g08-group-public", { mode: 0o700 })
  await writeFile("g08-group-public/receipt.json", JSON.stringify(observed.receipt) + "\n", { flag: "wx", mode: 0o600 })
  console.log("G08_ORIGINAL_GROUP_OBSERVATIONS_VERIFIED_" + kind + "_AGGREGATE_STILL_REQUIRED")
}

async function aggregateInstalled(root) {
  await privateRoot(root)
  const input = parse(await privateText(root, "aggregate.json"))
  exact(input, ["schema", "candidate", "proofs", "cleanup"])
  assert(input.schema === "sf-g08-aggregate-input-v1" && Array.isArray(input.proofs), "G08_AGGREGATE_INPUT_REQUIRED")
  same(input.proofs.map((item) => item.kind), installedKinds, "G08_EXACT_ALL_GROUPS_REQUIRED")
  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })
  assert(git.status === 0 && git.stdout.trim() === input.candidate.sha &&
    input.candidate.sha === process.env.GITHUB_SHA, "G08_AGGREGATE_ORIGINAL_CHECKOUT_REQUIRED")
  const items = []
  const { verifyOriginalProducer, verifyDatasetCleanupAuthority } = await import("./g08-proof-provenance.mjs")
  for (const proof of input.proofs) {
    exact(proof, ["kind", "root", "producer"])
    const item = await inspectInstalledGroup(proof.root, proof.kind)
    same(item.plan.candidate, input.candidate, "G08_AGGREGATE_SOURCE_MISMATCH")
    const receiptRaw = await privateText(proof.root, "group-receipt.json")
    assert.equal(receiptRaw, JSON.stringify(item.receipt) + "\n", "G08_GROUP_RECEIPT_NOT_DERIVED_FROM_ORIGINALS")
    const provenance = await verifyOriginalProducer({ kind: proof.kind, plan: item.plan, planRaw: item.planRaw,
      receiptRaw, archiveSha256: item.packageReceipt.archive.sha256, producer: proof.producer, authorization: item.authorization })
    items.push({ ...item, provenance, receiptSha256: digest(receiptRaw) })
  }
  const coverage = verifyInstalledChain(items)
  const cleanupRaw = await privateText(root, "dataset-cleanup-receipt.json")
  const cleanupSha256 = digest(cleanupRaw)
  assert(input.cleanup && input.cleanup.receiptSha256 === cleanupSha256, "G08_ORIGINAL_DATASET_CLEANUP_RECEIPT_REQUIRED")
  const completedAt = items.map((item) => item.receipt.execution.finishedAt).sort((a, b) => instant(a) - instant(b)).at(-1)
  const cleanupAuthority = await verifyDatasetCleanupAuthority({ plans: items.map(({ plan, planRaw }) => ({ plan, planRaw })),
    archiveSha256: items[0].packageReceipt.archive.sha256, receiptSha256: cleanupSha256,
    completedAt, reference: input.cleanup.reference })
  const receipt = { schema: "sf-g08-installed-complete-v1", status: "INSTALLED_OBLIGATIONS_AND_PROVENANCE_VERIFIED",
    candidate: input.candidate, archive: items[0].receipt.archive, packageReceiptSha256: items[0].plan.packageReceiptSha256,
    reservationSha256: items[0].receipt.bindings.reservationSha256, vmIdSha256: items[0].receipt.bindings.vmIdSha256,
    coverage, groups: items.map((item) => ({ kind: item.receipt.kind, receiptSha256: item.receiptSha256,
      invocation: item.plan.invocation, bindings: item.receipt.bindings, provenance: item.provenance })),
    cleanup: { receiptSha256: cleanupSha256, authority: cleanupAuthority,
      evidenceClass: "ORIGINAL_OPERATOR_ATTESTATION_BOUND_TO_PRIVATE_RECEIPT" },
    installed: true, g08Closed: true, finalCandidate: true, productionCutover: false,
    limits: ["Qualification of the verified tar in the approved isolated QA reservation only.",
      "Dataset cleanup is attributed to its original operator attestation and private receipt, not inferred from report parsing.",
      "G05/G06/G07/G10 and the specific production window/go-no-go retain their independent approval requirements."] }
  await writePrivate(root, "aggregate-receipt.json", receipt)
  await mkdir("g08-aggregate-public", { mode: 0o700 })
  await writeFile("g08-aggregate-public/receipt.json", JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 })
  console.log("G08_INSTALLED_OBLIGATIONS_AND_PROVENANCE_VERIFIED_NO_PRODUCTION_AUTHORIZATION")
}

async function main() {
  const [mode, value] = process.argv.slice(2)
  assert(process.argv.length === 4, "G08_CLOSED_EXECUTION_ARGUMENTS_REQUIRED")
  if (mode === "run") return runInstalled(value)
  assert.equal(mode, "aggregate", "G08_EXECUTION_MODE_INVALID")
  return aggregateInstalled(value)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message.match(/(?:G08|F04)_[A-Z0-9_]+/)?.[0] ??
      "G08_INSTALLED_EXECUTION_REFUSED_PRIVATE_DETAILS_RETAINED" : "G08_INSTALLED_EXECUTION_REFUSED_PRIVATE_DETAILS_RETAINED")
    process.exitCode = 1
  })
