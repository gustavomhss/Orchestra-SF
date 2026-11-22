// Private G08 evidence boundary. Hosted controls never constitute installed Teams QA.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { isIP } from "node:net"
import { lstat, open, readFile, realpath, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import az02 from "../../sf/azure/identity/az02-proof.cjs"

export const cases = Object.freeze([
  { id: "same-team-distinct-grants", title: "Two distinct Microsoft accounts enter the same installed Team with their own authority" },
  { id: "aba-two-windows", title: "An explicit A B A Team switch leaves the sibling window on its own Team" },
  { id: "account-without-team", title: "An authenticated account without Team access cannot open the original business chapter" },
  { id: "foreign-deep-link-reload", title: "A foreign installation deep link and reload cannot inherit the current Team selection" },
  { id: "admin-without-team", title: "Native Microsoft administration remains usable without Team business access" },
  { id: "narrow-keyboard-draft", title: "Keyboard navigation opens a new Team chat draft on narrow Web without changing owner" },
  { id: "draft-cancel-discard", title: "A Team switch keeps a canceled chat draft and discards it only on confirmation" },
  { id: "real-revoke-restore", title: "Real administration revokes a disposable Team and restores its original configuration" },
  { id: "logout-original-context", title: "Logout invalidates the original Microsoft browser context and preserves the other account" },
])
export const preservedTeams = Object.freeze([
  "same-team-distinct-grants", "aba-two-windows", "account-without-team", "foreign-deep-link-reload",
  "admin-without-team", "narrow-keyboard-draft", "draft-cancel-discard", "real-revoke-restore", "logout-original-context",
])
export const completeMappings = Object.freeze({
  "same-team-distinct-grants": "same-team-distinct-grants", "admin-without-team": "admin-without-team",
  "narrow-keyboard-draft": "narrow-keyboard-draft", "draft-cancel-discard": "draft-cancel-discard",
  "aba-two-windows": "aba-two-windows", "account-without-team": "account-without-team",
  "foreign-deep-link-reload": "foreign-deep-link-reload", "real-revoke-restore": "real-revoke-restore",
  "logout-original-context": "logout-original-context",
})
export const obligationPath = "packages/app-shell/e2e/sucafina/g08/obligations.json"
export const pendingGroups = Object.freeze(["U15", "U39", "U40", "F04", "AZ02"])
export const productContractPaths = Object.freeze([
  "packages/app-shell/src/context/team-profile-navigation.ts",
  "packages/app-shell/src/components/team-profile-administration.tsx",
  "packages/app-shell/src/pages/team-session.tsx",
  "packages/app-shell/src/context/team-sessions.ts",
  "packages/client/src/sucafina/sessions.ts",
  "packages/client/src/sucafina/team-profile.ts",
  "modules/sucafina/Sucafinav1/runtime/team-session-admission.ts",
  "apps/cli/src/sucafina-product/team-session-http.ts",
  "packages/server/src/session-http.ts",
  "modules/sucafina/Sucafinav1/runtime/team-profile-http.ts",
  "modules/sucafina/Sucafinav1/runtime/team-profile-store.ts",
])
export const sourcePaths = Object.freeze([
  ".github/workflows/g08-private-preflight.yml", "script/sf-ci/g08-private-evidence.mjs", obligationPath,
  "script/sf-ci/g08-installed-preflight.py", "script/sf-ci/g08-private-run.sh",
  "sf/azure/identity/az02-proof.cjs",
  "packages/app-shell/e2e/sucafina/g08/playwright.config.ts",
  "packages/app-shell/e2e/sucafina/g08/installed-fixture.ts",
  "packages/app-shell/e2e/sucafina/g08/teams-installed.spec.ts",
  "packages/app-shell/e2e/sucafina/g08/landing-contract.ts",
  "packages/app-shell/e2e/sucafina/g08/landing-contract.test.ts",
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
/** Canonical business projection only. The caller must first decode the original F02 response.
 * Principal, revisions and resource availability are deliberately outside this comparison.
 * @param {unknown} value
 */
export function destinationGrants(value) {
  const destinations = record(value).destinations
  assert(Array.isArray(destinations), "G08_ORIGINAL_DESTINATIONS_REQUIRED")
  const projection = destinations.map((value) => {
    const entry = record(value)
    exact(entry, ["capabilityId", "surface", "page", "canRead", "allowedActionIds"])
    const surface = text(entry.surface)
    assert(["dashboard", "planner", "procurement"].includes(surface) &&
      typeof entry.canRead === "boolean" && Array.isArray(entry.allowedActionIds), "G08_DESTINATION_GRANT_INVALID")
    const actions = entry.allowedActionIds.map(text).sort()
    assert.equal(new Set(actions).size, actions.length, "G08_DUPLICATE_ACTION_GRANT")
    return { capabilityId: text(entry.capabilityId), surface, page: text(entry.page),
      canRead: entry.canRead, allowedActionIds: actions }
  })
  assert.equal(new Set(projection.map((entry) => entry.capabilityId)).size, projection.length,
    "G08_DUPLICATE_DESTINATION_GRANT")
  return projection.map((entry) => JSON.stringify(entry)).sort()
}
/** @param {unknown} requester @param {unknown} holder */
export function requireDistinctDestinationGrants(requester, holder) {
  assert.notDeepEqual(destinationGrants(requester), destinationGrants(holder), "G08_DISTINCT_DESTINATION_GRANTS_REQUIRED")
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
/** @param {unknown} value @returns {string} */
export function canonicalAddress(value) {
  const address = text(value).replace(/^::ffff:/i, "")
  assert(isIP(address) !== 0, "G08_IP_ADDRESS_REQUIRED")
  return isIP(address) === 4 ? address : new URL("http://[" + address + "]").hostname.slice(1, -1)
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
    url.origin === result.shellOrigin && ["/", "/orchestra/sf-home", "/orchestra/sf-home/context"].includes(url.pathname) &&
    !url.hash && !url.username && !url.password, "G08_ORIGINAL_CHAPTER_REQUIRED")
  const expected = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: result.serverKey,
    installationId: result.installationId, tenantId: result.tenantId, teamObjectId: result.teamObjectId })
  assert([...url.searchParams.keys()].every((key) => url.searchParams.getAll(key).length === 1 &&
    expected.has(key)), "G08_CLOSED_OWNER_QUERY_REQUIRED")
  for (const [key, entry] of expected) assert.equal(url.searchParams.get(key), entry, "G08_CHAPTER_OWNER_MISMATCH")
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
  const manifest = record(receipt.manifest), artifact = record(receipt.artifact), producer = record(receipt.producer), factory = record(receipt.factory)
  assert(receipt.schema === "sf-g07-package-v1" && receipt.status === "PACKAGE_VERIFIED" &&
    receipt.productionCutover === false, "G08_G07_VERIFIED_RECEIPT_REQUIRED")
  assert(candidate.sha === plan.candidate.sha && candidate.tree === plan.candidate.tree, "G08_G07_CANDIDATE_MISMATCH")
  assert.equal(archive.file, "orchestra-sf-entra-linux-x64-baseline.tar.gz", "G08_ORIGINAL_INNER_TAR_REQUIRED")
  hex(archive.sha256, 64); hex(manifest.sha256, 64); hex(artifact.zipSha256, 64); hex(factory.sha256, 64)
  assert.equal(factory.path, "bin/local/entry.mjs", "G08_ORIGINAL_FACTORY_REQUIRED")
  assert(Number.isSafeInteger(archive.bytes) && Number(archive.bytes) > 0 && Array.isArray(manifest.files) && manifest.files.length > 0,
    "G08_G07_INVENTORY_REQUIRED")
  const factoryEntries = manifest.files.map(record).filter((entry) => entry.path === factory.path)
  assert(factoryEntries.length === 1 && factoryEntries[0].sha256 === factory.sha256, "G08_G07_FACTORY_INVENTORY_MISMATCH")
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
  uuid(running.bootId)
  const binding = record(host.binding), factory = record(receipt.factory)
  const descriptor = { contractRevision: "sf-team-profile/1", authMode: "microsoft",
    installationId: plan.target.installationId, tenantId: plan.target.tenantId, projectId: plan.target.projectId,
    hostId: plan.target.hostId, publicOrigin: plan.target.publicOrigin, mount: plan.target.mount }
  assert(binding.status === "LOOPBACK_PID_AND_HTTPS_BOUND" &&
    binding.factoryPath === "/opt/orchestra-sf/releases/" + plan.candidate.sha + "/bin/local/entry.mjs" &&
    binding.factorySha256 === factory.sha256 && binding.listenerOrigin === "http://127.0.0.1:4096",
    "G08_RUNTIME_FACTORY_OR_LISTENER_MISMATCH")
  id(binding.listenerInode)
  assert(Array.isArray(binding.ingressAddresses) && binding.ingressAddresses.length > 0, "G08_ASSIGNED_INGRESS_ADDRESSES_REQUIRED")
  const addresses = binding.ingressAddresses.map(canonicalAddress)
  assert.equal(new Set(addresses).size, addresses.length, "G08_DUPLICATE_INGRESS_ADDRESS")
  const proxy = record(binding.caddyProcess), listeners = record(proxy.listeners)
  assert(proxy.unit === "caddy.service" && proxy.exe === "/usr/bin/caddy" && Number(proxy.pid) > 0 &&
    Number.isSafeInteger(proxy.pid) && Number(proxy.uid) > 0 && Number.isSafeInteger(proxy.uid),
    "G08_ORIGINAL_CADDY_PROCESS_REQUIRED")
  id(proxy.startTicks)
  assert(Array.isArray(listeners.tcp) && listeners.tcp.length > 0 && Array.isArray(listeners.udp), "G08_CADDY_HTTPS_SOCKET_REQUIRED")
  for (const inode of [...listeners.tcp, ...listeners.udp]) id(inode)
  hex(binding.caddyConfigSha256, 64)
  hex(binding.argvSha256, 64); hex(binding.configurationSha256, 64)
  const configurationPath = text(binding.configurationPath)
  assert(path.isAbsolute(configurationPath) && path.resolve(configurationPath) === configurationPath, "G08_CONFIG_PATH_REQUIRED")
  assert.deepEqual(binding.descriptor, descriptor, "G08_ORIGINAL_HTTPS_DESCRIPTOR_MISMATCH")
  const descriptorSha256 = digest(JSON.stringify(Object.fromEntries(Object.entries(descriptor).sort(([a], [b]) => a.localeCompare(b)))))
  assert(binding.loopbackDiscoverySha256 === descriptorSha256 && binding.httpsDiscoverySha256 === descriptorSha256,
    "G08_LOOPBACK_HTTPS_CORRELATION_REQUIRED")
  hex(host.installerSha256, 64); hex(host.releaseReceiptSha256, 64)
  assert.equal(host.installerSha256, record(receipt.verification).installerSha256, "G08_G07_INSTALLER_SOURCE_MISMATCH")
  const observed = Date.parse(text(host.observedAt))
  assert(Number.isFinite(observed) && observed >= Date.parse(plan.reservation.startsAt) &&
    observed < Date.parse(plan.reservation.endsAt), "G08_HOST_OUTSIDE_WINDOW")
  return host
}

/** Original browser transcript reduced only after strict corporate response decoding.
 * The CLI reads this file solely after the exact installed Playwright run and cleanup pass.
 * It is not an operator-supplied grant declaration and cannot substitute for that provenance.
 * @param {unknown} value @param {ReturnType<typeof validatePlan>} plan
 */
export function validateGrantProof(value, plan) {
  const proof = record(value)
  exact(proof, ["schema", "invocationId", "profile", "fixtureIds", "requester", "holder", "cleanup"])
  assert(proof.schema === "sf-g08-session-grants-v1" && proof.invocationId === plan.invocation.id,
    "G08_GRANT_PROOF_INVOCATION_REQUIRED")
  const profile = { installationId: plan.target.installationId, tenantId: plan.target.tenantId,
    teamObjectId: plan.target.teamObjectId }
  assert.deepEqual(proof.profile, profile, "G08_GRANT_PROFILE_REQUIRED")
  const fixtures = record(proof.fixtureIds), requester = record(proof.requester), holder = record(proof.holder)
  const cleanup = record(proof.cleanup)
  exact(fixtures, ["requester", "holder"]); exact(cleanup, ["requester", "holder"])
  assert(fixtures.requester !== fixtures.holder, "G08_DISTINCT_FIXTURE_IDS_REQUIRED")
  for (const entry of Object.values(fixtures))
    assert(new RegExp("^ses_g08_" + plan.invocation.id + "_[a-f0-9]{32}$").test(text(entry)), "G08_DISPOSABLE_SESSION_ID_REQUIRED")
  exact(requester, ["namespace", "before", "created", "observed", "afterCreate", "createStatus", "readStatus"])
  exact(holder, ["namespace", "before", "afterDenial", "deniedStatus", "readStatus"])
  assert(requester.createStatus === 200 && requester.readStatus === 200 &&
    holder.readStatus === 200 && holder.deniedStatus === 401, "G08_DIFFERENT_EFFECTIVE_GRANTS_NOT_OBSERVED")
  /** @param {unknown} value @param {"requester" | "holder"} actor */
  function namespace(value, actor) {
    const item = record(value)
    exact(item, ["version", "owner", "authorityGeneration"])
    assert(item.version === 1 && Number.isSafeInteger(item.authorityGeneration) && Number(item.authorityGeneration) > 0,
      "G08_ORIGINAL_SESSION_NAMESPACE_REQUIRED")
    assert.deepEqual(item.owner, { profile, principal: {
      tenantId: plan.target.tenantId, principalObjectId: plan.actors[actor],
    } }, "G08_ORIGINAL_SESSION_OWNER_REQUIRED")
    return item
  }
  /** @param {unknown} value @param {Record<string, unknown>} owner */
  function entries(value, owner) {
    assert(Array.isArray(value) && value.length <= 10_000, "G08_COMPLETE_SESSION_INVENTORY_REQUIRED")
    const rows = value.map(record), ids = rows.map((entry) => text(entry.id))
    assert.equal(new Set(ids).size, rows.length, "G08_SESSION_INVENTORY_DUPLICATE")
    assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)), "G08_SESSION_INVENTORY_ORDER_REQUIRED")
    for (const row of rows) assert.deepEqual(row.namespace, owner, "G08_SESSION_ROW_OWNER_REQUIRED")
    return rows
  }
  const requesterOwner = namespace(requester.namespace, "requester"), holderOwner = namespace(holder.namespace, "holder")
  const before = entries(requester.before, requesterOwner), holderBefore = entries(holder.before, holderOwner)
  assert(!before.some((entry) => entry.id === fixtures.requester) &&
    !holderBefore.some((entry) => entry.id === fixtures.holder), "G08_FIXTURE_MUST_BE_NEW")
  const created = record(requester.created)
  assert(created.id === fixtures.requester, "G08_CREATED_SESSION_ID_CHANGED")
  assert.deepEqual(created.namespace, requesterOwner, "G08_CREATED_SESSION_OWNER_CHANGED")
  assert.deepEqual(requester.observed, created, "G08_SESSION_EFFECT_NOT_REREAD")
  assert.deepEqual(entries(requester.afterCreate, requesterOwner),
    [...before, created].sort((a, b) => String(a.id).localeCompare(String(b.id))), "G08_SESSION_CREATE_EFFECT_NOT_EXACT")
  assert.deepEqual(entries(holder.afterDenial, holderOwner), holderBefore, "G08_DENIED_SESSION_CHANGED_STATE")
  for (const actor of ["requester", "holder"]) {
    const item = record(cleanup[actor]), original = actor === "requester" ? before : holderBefore
    const expectedOwner = actor === "requester" ? requesterOwner : holderOwner
    exact(item, ["namespace", "entries"])
    assert.deepEqual(item.namespace, expectedOwner, "G08_SESSION_CLEANUP_OWNER_CHANGED")
    assert.deepEqual(entries(item.entries, expectedOwner), original, "G08_SESSION_FIXTURE_CLEANUP_REQUIRED")
  }
  return proof
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
  assert.deepEqual(specs.map((spec) => spec.title).sort(), cases.map((item) => item.title).sort(), "G08_EXACT_CURRENT_CASE_INVENTORY_REQUIRED")
  assert.deepEqual(report.errors ?? [], [], "G08_REPORT_ERRORS")
  assert.equal(config.workers, 1, "G08_WORKERS_ONE_REQUIRED")
  assert(Array.isArray(config.projects) && config.projects.length === 1, "G08_SINGLE_PROJECT_REQUIRED")
  const project = record(config.projects[0])
  assert(project.name === "g08-installed" && project.retries === 0 && project.repeatEach === 1, "G08_NO_RETRIES_OR_REPEATS")
  assert(!config.shard && !config.grepInvert && JSON.stringify(config.grep ?? {}) === "{}", "G08_UNFILTERED_RUN_REQUIRED")
  for (const spec of specs) {
    assert(typeof spec.file === "string" && spec.file.replaceAll("\\", "/") === "teams-installed.spec.ts", "G08_ORIGINAL_SPEC_REQUIRED")
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
/** Preserve the original 32 obligations while requiring the explicit 37-case Team contract.
 * This validates inventory only; neither registration nor a component PASS is an installed proof.
 * @param {Record<string, unknown>} group
 */
function operationalAz02Count(group) {
  const contract = record(group.operationalContract), original = record(group.originalCaseIdsByPhase)
  exact(contract, ["action", "source", "expectedCount", "phases", "remappedIds", "addedCaseIds", "caseIdsByPhase"])
  assert.equal(contract.action, "CHANGE_CONTRACT", "G08_AZ02_EXPLICIT_CONTRACT_CHANGE_REQUIRED")
  assert.deepEqual(contract.source, {
    commit: "ba521f92c5464dc9bee50223e8d3b4ea1b235c0a", path: "sf/azure/identity/az02-proof.cjs",
    blob: "6b8104170fe546e74e46c0fd374c1fe1254caf24",
  }, "G08_AZ02_CONTRACT_SOURCE_REQUIRED")
  assert.equal(contract.expectedCount, 37, "G08_AZ02_OPERATIONAL_COUNT_REQUIRED")
  assert.deepEqual(contract.remappedIds, az02.LEGACY_MAP, "G08_AZ02_EXPLICIT_ID_MAPPING_REQUIRED")
  assert.deepEqual(contract.addedCaseIds, az02.ADDITIONS, "G08_AZ02_ADDITIVE_NEGATIVES_REQUIRED")
  assert.deepEqual(contract.caseIdsByPhase, az02.ROSTER, "G08_AZ02_OPERATIONAL_CASES_REQUIRED")
  assert.deepEqual(contract.phases, az02.PHASES.map((id) => ({ id, count: az02.ROSTER[id].length })),
    "G08_AZ02_OPERATIONAL_PHASES_REQUIRED")
  assert.deepEqual(Object.keys(original), az02.PHASES, "G08_AZ02_ORIGINAL_PHASE_IDS_REQUIRED")
  const historical = Object.values(original).flat()
  assert(historical.length === 32 && new Set(historical).size === 32, "G08_AZ02_ORIGINAL_CASES_REQUIRED")
  const inverse = Object.fromEntries(Object.entries(az02.LEGACY_MAP).map(([before, after]) => [after, before]))
  for (const phase of az02.PHASES) {
    const names = original[phase]
    assert(Array.isArray(names) && names.every((name) => typeof name === "string"), "G08_AZ02_ORIGINAL_CASE_IDS_REQUIRED")
    const retained = az02.ROSTER[phase].filter((name) => !az02.ADDITIONS.includes(name))
    assert.deepEqual(names, retained.map((name) => inverse[name] ?? name), "G08_AZ02_ORIGINAL_CASE_REMOVED_OR_REPLACED")
  }
  const all = Object.values(az02.ROSTER).flat()
  assert(all.length === 37 && new Set(all).size === 37, "G08_AZ02_PRODUCER_INVENTORY_CHANGED")
  return 37
}

/** Keep the original obligations separate from the narrower executable selection.
 * @param {unknown} value @param {boolean} executed
 */
export function coverageLedger(value, executed = false) {
  const ledger = record(value), original = record(ledger.originalTeams)
  assert(ledger.schema === "sf-g08-obligations-v1" && ledger.gateClosed === false &&
    ledger.productionCutover === false, "G08_PRESERVED_OBLIGATIONS_REQUIRED")
  assert(Array.isArray(original.obligations) && original.expectedCount === 9, "G08_ORIGINAL_NINE_OBLIGATIONS_REQUIRED")
  const obligations = original.obligations.map(record)
  assert.deepEqual(obligations.map((entry) => entry.id), preservedTeams, "G08_ORIGINAL_OBLIGATION_REMOVED_OR_RENAMED")
  assert(Array.isArray(ledger.groups), "G08_REQUIRED_GROUPS_MISSING")
  const groups = ledger.groups.map(record)
  assert.deepEqual(groups.map((entry) => entry.id), pendingGroups, "G08_REQUIRED_GROUP_REMOVED_OR_RENAMED")
  assert.deepEqual(groups.map((entry) => entry.expectedCount), [6, 22, 22, 3, 32], "G08_ORIGINAL_GROUP_INVENTORY_CHANGED")
  for (const group of groups) {
    assert(group.required === true && group.separateInvocation === true && group.state === "NOT_RUN" &&
      typeof group.blocker === "string" && group.blocker.startsWith("BLOCKED_"), "G08_GROUP_NOT_EXECUTED")
    if (group.id !== "AZ02") {
      assert(Array.isArray(group.originalTitles) && group.originalTitles.length === group.expectedCount &&
        new Set(group.originalTitles).size === group.originalTitles.length, "G08_ORIGINAL_GROUP_CASES_REQUIRED")
    } else {
      assert.deepEqual(group.phases, [
        { id: "preflight", count: 14 }, { id: "actors", count: 11 }, { id: "producer", count: 2 },
        { id: "after-revoke", count: 2 }, { id: "logout", count: 2 }, { id: "after-restart", count: 1 },
      ], "G08_AZ02_PHASES_REQUIRED")
      operationalAz02Count(group)
    }
  }
  const teamCoverage = obligations.map((entry) => {
    assert(entry.required === true && entry.state === "NOT_RUN" && Array.isArray(entry.implementedCases) &&
      entry.implementedCases.every((id) => cases.some((item) => item.id === id)), "G08_INVALID_OBLIGATION_MAPPING")
    assert(["none", "partial", "complete"].includes(text(entry.coverage)), "G08_COVERAGE_KIND_INVALID")
    // Full mappings are versioned here. The list of passing cases cannot promote unmapped obligations.
    const complete = Object.entries(completeMappings).find(([id]) => id === entry.id)
    assert(!!complete === (entry.coverage === "complete"), "G08_UNSUPPORTED_OBLIGATION_CLAIM")
    if (entry.coverage !== "complete") assert(text(entry.blocker).startsWith("BLOCKED_BY_PRODUCT_"), "G08_PRODUCT_BLOCKER_REQUIRED")
    else assert(entry.blocker === null && complete && JSON.stringify(entry.implementedCases) === JSON.stringify([complete[1]]), "G08_COMPLETE_MAPPING_INVALID")
    return { id: entry.id, status: executed && entry.coverage === "complete" ? "PASS" :
      executed && entry.coverage === "partial" ? "PARTIAL" : "NOT_RUN", blocker: entry.blocker,
      implementedCases: entry.implementedCases }
  })
  return { schema: "sf-g08-coverage-v1", originalTeams: teamCoverage,
    groups: groups.map((entry) => ({ id: entry.id, status: "NOT_RUN",
      expectedCount: entry.id === "AZ02" ? operationalAz02Count(entry) : entry.expectedCount, blocker: entry.blocker })),
    complete: false }
}
/** Shape/completeness guard only; callers must already have verified original proof provenance.
 * This CLI derives coverage from its verified report and never accepts a manual completion document.
 * @param {unknown} value
 */
export function requireCompleteGate(value) {
  const coverage = record(value)
  exact(coverage, ["schema", "originalTeams", "groups", "complete"])
  assert(coverage.schema === "sf-g08-coverage-v1" && coverage.complete === true &&
    Array.isArray(coverage.originalTeams) && Array.isArray(coverage.groups), "G08_REQUIRED_OBLIGATIONS_NOT_PROVEN")
  const original = coverage.originalTeams.map(record), groups = coverage.groups.map(record)
  assert.deepEqual(original.map((entry) => entry.id), preservedTeams, "G08_EXACT_CLOSING_TEAMS_INVENTORY_REQUIRED")
  assert.deepEqual(groups.map((entry) => entry.id), pendingGroups, "G08_EXACT_CLOSING_GROUP_INVENTORY_REQUIRED")
  assert.deepEqual(groups.map((entry) => entry.expectedCount), [6, 22, 22, 3, 37], "G08_EXACT_CLOSING_GROUP_COUNTS_REQUIRED")
  assert(original.every((entry) => entry.status === "PASS") && groups.every((entry) => entry.status === "PASS"),
    "G08_REQUIRED_OBLIGATIONS_NOT_PROVEN")
}
/** @param {boolean} executed */
async function readCoverage(executed) {
  return coverageLedger(JSON.parse(await readFile(obligationPath, "utf8")), executed)
}


/** Source presence is an early prerequisite only; authority/composition are still observed live.
 * @param {string} root
 */
export async function requireProductContracts(root = process.cwd()) {
  for (const file of productContractPaths)
    await readFile(path.join(root, file)).catch(() => { throw new Error("G08_PRODUCT_CONTRACT_NOT_INTEGRATED") })
}

/** @param {string} root */
export async function sourceInventory(root = process.cwd()) {
  return Promise.all(sourcePaths.map(async (file) => ({ path: file, sha256: digest(await readFile(path.join(root, file))) })))
}

/** Re-read the original private nine-case evidence; this pure inspection does not establish workflow provenance. */
export async function inspectCurrentEvidence(root, plan, receipt) {
  assert.equal(await privateText(root, "exit-code.txt", 64), "0\n", "G08_PLAYWRIGHT_EXIT_NOT_ZERO")
  const reportText = await privateText(root, "playwright.json", 25_000_000), report = JSON.parse(reportText)
  const inventory = verifyReport(report, true)
  assert.deepEqual(record(record(report).config).metadata,
    { candidateSha: plan.candidate.sha, candidateTree: plan.candidate.tree, invocationId: plan.invocation.id,
      runId: plan.invocation.runId, runAttempt: plan.invocation.runAttempt }, "G08_REPORT_INVOCATION_MISMATCH")
  const beforeText = await privateText(root, "host-before.json"), afterText = await privateText(root, "host-after.json")
  const before = validateHost(JSON.parse(beforeText), plan, receipt), after = validateHost(JSON.parse(afterText), plan, receipt)
  assert.deepEqual(before.process, after.process, "G08_INSTALLED_PROCESS_CHANGED_DURING_QA")
  assert.deepEqual(before.binding, after.binding, "G08_RUNTIME_BINDING_CHANGED_DURING_QA")
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
      value.openedPages === value.closedPages && value.disconnected === true &&
      value.boundDocuments === value.openedPages && value.cacheBypassPages === value.openedPages &&
      value.ingressErrors === 0 && Number(value.ingressResources) >= Number(value.openedPages),
      "G08_CLEANUP_OR_BROWSER_INGRESS_NOT_OBSERVED")
    if (item.id === "same-team-distinct-grants")
      assert(value.grantMutationAttempted === true && value.grantFixturesCleaned === true, "G08_SESSION_FIXTURE_CLEANUP_REQUIRED")
    if (item.id === "admin-without-team" || item.id === "real-revoke-restore")
      assert(value.nativeAdministrationObserved === true, "G08_NATIVE_ADMINISTRATION_REQUIRED")
    if (item.id === "real-revoke-restore")
      assert(value.revocationAttempted === true && value.revocationRestored === true, "G08_REVOCATION_RESTORATION_REQUIRED")
    cleanup.push({ caseId: item.id, sha256: digest(raw) })
  }
  const grantsText = await privateText(root, "session-grants.json", 25_000_000)
  validateGrantProof(JSON.parse(grantsText), plan)
  const archive = record(receipt.archive)
  const publicReceipt = {
    schema: "sf-g08-current-installed-v3", status: "CURRENT_TEAMS_SUBSET_INSTALLED_VERIFIED", proofScope: "current-teams-subset",
    candidate: plan.candidate, archive: { file: archive.file, sha256: archive.sha256, bytes: archive.bytes },
    packageReceiptSha256: plan.packageReceiptSha256, invocation: plan.invocation, cases: inventory, coverage: await readCoverage(true), sources,
    evidence: { reportSha256: digest(reportText), hostBeforeSha256: digest(beforeText), hostAfterSha256: digest(afterText), grantProofSha256: digest(grantsText), cleanup },
    installed: true, g08Closed: false, pendingGroups, productionCutover: false,
    limits: ["Nine current-contract Teams controls, including native administration, effective Session grants and native drafts; U15/U39/U40/F04/AZ02 remain mandatory.",
      "Logout proves original context invalidation, not raw token replay or Entra global sign-out.",
      "Reservation and actor references are operator-supplied authorization metadata, never inferred role grants."],
  }
  return publicReceipt
}

async function main() {
  const command = process.argv[2]
  if (command === "verify-list") {
    const inventory = verifyReport(JSON.parse(await readFile(process.argv[3], "utf8")), false)
    const receipt = { schema: "sf-g08-executor-inventory-v3", status: "CURRENT_CONTRACT_INVENTORY_VERIFIED", proofScope: "current-teams-subset",
      candidate: { sha: process.env.SF_G08_CANDIDATE_SHA, tree: process.env.SF_G08_CANDIDATE_TREE },
      cases: inventory, coverage: await readCoverage(false), sources: await sourceInventory(), installed: false, g08Closed: false, pendingGroups, productionCutover: false }
    const output = text(process.env.SF_G08_TOOLING_EVIDENCE), workspace = process.env.GITHUB_WORKSPACE
    assert(path.isAbsolute(output) && path.resolve(output) === output &&
      (!workspace || !(output === workspace || output.startsWith(path.resolve(workspace) + path.sep))),
      "G08_TOOLING_OUTPUT_OUTSIDE_CHECKOUT_REQUIRED")
    await mkdir(output, { recursive: true })
    await writeFile(path.join(output, "inventory.json"), JSON.stringify(receipt, null, 2) + "\n")
    console.log(JSON.stringify(receipt))
    return
  }
  if (command === "require-closed-gate") { requireCompleteGate(await readCoverage(true)); return }
  const root = text(process.env.SF_G08_PRIVATE_ROOT), plan = await readPlan(root)
  const packageText = await privateText(root, "package-receipt.json")
  assert.equal(digest(packageText), plan.packageReceiptSha256, "G08_G07_RECEIPT_BYTES_MISMATCH")
  const receipt = validatePackage(JSON.parse(packageText), plan)
  if (command === "admit") {
    await requireProductContracts()
    await readCoverage(false)
    await writePrivate(root, "source-before.json", await sourceInventory())
    return
  }
  assert.equal(command, "verify", "G08_COMMAND_INVALID")
  const publicReceipt = await inspectCurrentEvidence(root, plan, receipt)
  await writePrivate(root, "current-receipt.json", publicReceipt)
  await mkdir("g08-public", { recursive: true, mode: 0o700 })
  await writeFile("g08-public/receipt.json", JSON.stringify(publicReceipt, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  console.log("G08_CURRENT_TEAMS_SUBSET_INSTALLED_VERIFIED_G08_REMAINS_OPEN")
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    const code = error instanceof Error ? error.message.match(/G08_[A-Z0-9_]+/)?.[0] : undefined
    console.error(code ?? "G08_EVIDENCE_REFUSED_PRIVATE_DETAILS_RETAINED_ON_HOST")
    process.exitCode = 1
  })
