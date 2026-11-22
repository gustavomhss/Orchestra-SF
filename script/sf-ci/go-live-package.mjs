import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { open, readFile, unlink, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

export const repository = "gustavomhss/Orchestra-SF"
const sha40 = /^[0-9a-f]{40}$/
const sha64 = /^[0-9a-f]{64}$/
const decimal = /^[1-9][0-9]*$/
const acceptedAssociations = new Set(["OWNER", "MEMBER", "COLLABORATOR"])
const commentUrl = /^https:\/\/github\.com\/gustavomhss\/Orchestra-SF\/(?:pull|issues)\/([1-9][0-9]*)#issuecomment-([1-9][0-9]*)$/

export function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function record(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), label + ": object required")
  return value
}

function text(value, label, maximum = 256) {
  assert(typeof value === "string" && value.trim() === value && value.length > 0 &&
    value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value), label + ": text required")
  return value
}

function hex(value, expression, label) {
  assert(typeof value === "string" && expression.test(value), label + ": invalid digest")
  return value
}

function id(value, label) {
  assert(typeof value === "string" && decimal.test(value) && Number.isSafeInteger(Number(value)), label + ": invalid ID")
  return value
}

function instant(value, label) {
  assert(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value)), label + ": invalid timestamp")
  return Date.parse(value)
}

function reference(value, label) {
  record(value, label)
  assert(commentUrl.test(value.url), label + ": only repository issue-comment URLs are admitted")
  hex(value.bodySha256, sha64, label + ".bodySha256")
  text(value.authorLogin, label + ".authorLogin", 39)
  return value
}

function parsePinRequest(value, schema) {
  record(value, "request")
  assert.equal(value.schema, schema)
  assert.equal(value.productionCutover, false, "qualification must not authorize production cutover")
  record(value.candidate, "candidate")
  hex(value.candidate.sha, sha40, "candidate.sha")
  hex(value.candidate.tree, sha40, "candidate.tree")
  record(value.acknowledgements, "acknowledgements")
  for (const role of ["migration", "release"]) {
    const ack = reference(value.acknowledgements[role], role)
    text(ack.owner, role + ".owner")
    assert(["structured", "textual"].includes(ack.format), role + ": unsupported acknowledgement format")
    if (role === "release") text(ack.operator, "release.operator")
    if (ack.format === "textual") {
      assert(typeof ack.statement === "string" && ack.statement.length > 0 &&
        ack.statement.length <= 16384, role + ": exact existing statement required")
      assert(ack.statement.includes(value.candidate.sha) && ack.statement.includes(value.candidate.tree),
        role + ": textual statement must bind candidate SHA and tree")
      reference(ack.attestation, role + ".attestation")
    }
  }
  assert.notEqual(value.acknowledgements.migration.url, value.acknowledgements.release.url,
    "two role confirmations must have separate original source records")
  return value
}

export function parseBuildRequest(value) {
  parsePinRequest(value, "sf-g07-build-request-v1")
  assert.equal(value.producer, undefined, "build request must not claim a completed producer")
  return { ...value, status: "PARSED" }
}

export function parseRequest(value) {
  parsePinRequest(value, "sf-g07-request-v1")
  const producer = record(value.producer, "producer")
  for (const field of ["runId", "runAttempt", "jobId", "checkRunId", "artifactId"]) id(producer[field], "producer." + field)
  hex(producer.workflowSha, sha40, "producer.workflowSha")
  assert(/^\.github\/workflows\/[a-zA-Z0-9_-]+\.ya?ml$/.test(producer.workflowPath), "producer.workflowPath")
  text(producer.artifactName, "producer.artifactName", 255)
  hex(producer.zipSha256, sha64, "producer.zipSha256")
  for (const field of ["sourceProofFile", "buildInputsFile"]) {
    assert(typeof producer[field] === "string" && /^[A-Za-z0-9_-]+\.json$/.test(producer[field]),
      "producer." + field + ": a plain JSON filename is required")
  }
  assert.notEqual(producer.sourceProofFile, producer.buildInputsFile, "proof roles must use distinct files")
  assert(!["orchestra-sf-entra-package-receipt.json", "distribution.json"].includes(producer.sourceProofFile) &&
    !["orchestra-sf-entra-package-receipt.json", "distribution.json"].includes(producer.buildInputsFile),
    "native receipt and supplementary proof roles must remain distinct")
  return { ...value, status: "PARSED" }
}

function pinRecords(body) {
  const blocks = [...body.matchAll(new RegExp("\\x60{3}json\\s*\\r?\\n([\\s\\S]*?)\\r?\\n\\x60{3}", "g"))]
    .map((match) => match[1])
  const candidates = [body, ...blocks].flatMap((block) => {
    try {
      const value = JSON.parse(block)
      return value && typeof value === "object" && !Array.isArray(value) ? [value] : []
    } catch {
      return []
    }
  })
  return candidates.filter((value) => ["sf-g07-pin-v1", "sf-g07-pin-attestation-v1"].includes(value.schema))
}

async function readReference(ref, api) {
  const [, issueNumber, commentId] = ref.url.match(commentUrl)
  const value = await api("/repos/" + repository + "/issues/comments/" + commentId)
  assert.equal(String(value.id), commentId, "comment ID mismatch")
  assert.equal(value.html_url, ref.url, "comment canonical URL mismatch")
  assert.equal(value.issue_url, "https://api.github.com/repos/" + repository + "/issues/" + issueNumber,
    "comment belongs to another issue")
  assert.equal(value.user?.login, ref.authorLogin, "acknowledgement author changed")
  assert(acceptedAssociations.has(value.author_association), "acknowledgement author is not associated with repository")
  assert(typeof value.body === "string" && value.body.length <= 262144, "comment body missing or excessive")
  assert.equal(digest(value.body), ref.bodySha256, "acknowledgement source changed")
  instant(value.created_at, "comment.created_at")
  instant(value.updated_at, "comment.updated_at")
  assert(Date.parse(value.updated_at) >= Date.parse(value.created_at), "comment timestamp order")
  return value
}

function confirmPin(pin, expectedSchema, role, request, ack) {
  record(pin, role + ".pin")
  assert.equal(pin.schema, expectedSchema)
  assert.equal(pin.role, role, "role declaration mismatch")
  assert.equal(pin.owner, ack.owner, "role owner declaration mismatch")
  assert.equal(pin.decision, "confirm-candidate-for-packaging", "not a packaging pin confirmation")
  assert.equal(pin.candidateSha, request.candidate.sha, "acknowledgement candidate mismatch")
  assert.equal(pin.candidateTree, request.candidate.tree, "acknowledgement tree mismatch")
  assert.equal(pin.scope, "qualification-only", "pin does not authorize this qualification scope")
  if (role === "release") assert.equal(pin.operator, ack.operator, "Release operator declaration mismatch")
}

async function verifyAcknowledgement(role, request, api) {
  const ack = request.acknowledgements[role]
  const source = await readReference(ack, api)
  const evidence = {
    status: "VERIFIED_SOURCE",
    source: { url: ack.url, bodySha256: ack.bodySha256, authorLogin: source.user.login,
      authorAssociation: source.author_association, createdAt: source.created_at, updatedAt: source.updated_at },
    roleConfirmation: {
      status: "DECLARED_IN_TRUSTED_SOURCE", role, owner: ack.owner,
      ...(role === "release" ? { operator: ack.operator } : {}),
      identityLimit: "GitHub account provenance; distinct agent-session identities are not inferred."
    }
  }
  if (ack.format === "structured") {
    const matches = pinRecords(source.body).filter((pin) => pin.schema === "sf-g07-pin-v1" && pin.role === role)
    assert.equal(matches.length, 1, "one unambiguous pin declaration is required for " + role)
    confirmPin(matches[0], "sf-g07-pin-v1", role, request, ack)
    return evidence
  }
  assert(source.body.includes(ack.statement), "existing textual acknowledgement quote changed")
  const attested = await readReference(ack.attestation, api)
  const matches = pinRecords(attested.body).filter((pin) => pin.schema === "sf-g07-pin-attestation-v1" && pin.role === role)
  assert.equal(matches.length, 1, "textual acknowledgement needs one observed source attestation")
  const pin = matches[0]
  confirmPin(pin, "sf-g07-pin-attestation-v1", role, request, ack)
  assert.deepEqual(pin.source, {
    url: ack.url, bodySha256: ack.bodySha256, authorLogin: ack.authorLogin, statementSha256: digest(ack.statement)
  }, "textual attestation must bind the exact existing original confirmation")
  evidence.roleConfirmation.status = "TEXTUAL_CONFIRMATION_ATTESTED"
  evidence.roleConfirmation.attestation = {
    url: ack.attestation.url, bodySha256: ack.attestation.bodySha256,
    authorLogin: attested.user.login, updatedAt: attested.updated_at
  }
  evidence.source.statementSha256 = digest(ack.statement)
  return evidence
}


export function requestRevision(kind, context) {
  record(context, "Actions context")
  assert.equal(context.repository, repository, "Actions repository mismatch")
  if (kind === "qualify" && context.eventName === "workflow_dispatch") {
    assert.equal(context.ref, "refs/heads/dev", "manual qualification requires dev")
    return hex(context.requestRevision, sha40, "request revision")
  }
  assert(["build", "qualify"].includes(kind), "unknown request kind")
  assert.equal(context.eventName, "push", "request branch requires a push event")
  const prefix = kind === "build" ? "release-build-" : "g07-qualify-"
  const match = new RegExp("^refs/heads/" + prefix + "([0-9a-f]{40})$").exec(context.ref)
  assert(match, "exact immutable request branch required")
  return match[1]
}

export async function readPinnedRequest(revision, kind, api = github) {
  hex(revision, sha40, "request revision")
  assert(["build", "qualify"].includes(kind), "unknown request kind")
  const path = "docs/qa/sucafina/go-live/" + (kind === "build" ? "g07-build-request.json" : "g07-request.json")
  const commit = await api("/repos/" + repository + "/git/commits/" + revision)
  assert.equal(commit.sha, revision, "request commit mismatch")
  hex(commit.tree?.sha, sha40, "request tree")
  const item = await api("/repos/" + repository + "/contents/" + path + "?ref=" + revision)
  assert(item.type === "file" && item.path === path && item.encoding === "base64",
    "invalid pinned request file identity")
  assert(Number.isSafeInteger(item.size) && item.size > 0 && item.size <= 131072, "request byte limit")
  assert(typeof item.content === "string" && item.content.length <= 180224, "encoded request byte limit")
  const encoded = item.content.replace(/[\r\n]/g, "")
  const bytes = Buffer.from(encoded, "base64")
  assert.equal(bytes.toString("base64"), encoded, "noncanonical request encoding")
  assert.equal(bytes.length, item.size, "request byte count mismatch")
  const blob = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex")
  assert.equal(blob, item.sha, "request Git blob mismatch")
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  const request = kind === "build" ? parseBuildRequest(JSON.parse(raw)) : parseRequest(JSON.parse(raw))
  return {
    raw, request,
    source: { repository, revision, tree: commit.tree.sha, path, blobSha: item.sha,
      sha256: digest(bytes), bytes: bytes.length }
  }
}

export async function readQualificationRequest(context, api = github) {
  const loaded = await readPinnedRequest(requestRevision("qualify", context), "qualify", api)
  if (context.eventName === "push") {
    assert.equal(hex(context.sha, sha40, "qualifier source"), loaded.request.candidate.sha,
      "qualification branch must point to the exact candidate")
  }
  return loaded
}

async function verifyPin(request, api) {
  const candidate = await api("/repos/" + repository + "/git/commits/" + request.candidate.sha)
  assert.equal(candidate.sha, request.candidate.sha, "source commit mismatch")
  assert.equal(candidate.tree?.sha, request.candidate.tree, "source tree mismatch")
  const migration = await verifyAcknowledgement("migration", request, api)
  const release = await verifyAcknowledgement("release", request, api)
  return { migration, release }
}

export async function verifyBuildAdmission(context, api = github) {
  const loaded = await readPinnedRequest(requestRevision("build", context), "build", api)
  const request = loaded.request
  assert.notEqual(loaded.source.revision, request.candidate.sha, "request must be separate from candidate")
  assert.equal(hex(context.sha, sha40, "checkout SHA"), request.candidate.sha, "build branch candidate mismatch")
  assert.equal(hex(context.tree, sha40, "checkout tree"), request.candidate.tree, "checkout tree mismatch")
  const acknowledgements = await verifyPin(request, api)
  for (const field of ["runId", "runAttempt", "jobId", "checkRunId"]) id(context[field], "Actions." + field)
  const run = await api("/repos/" + repository + "/actions/runs/" + context.runId + "/attempts/" + context.runAttempt)
  const job = await api("/repos/" + repository + "/actions/jobs/" + context.jobId)
  assert.equal(String(run.id), context.runId, "producer run mismatch")
  assert.equal(String(run.run_attempt), context.runAttempt, "producer attempt mismatch")
  assert.equal(run.repository?.full_name, repository, "producer repository mismatch")
  assert.equal(run.head_sha, request.candidate.sha, "producer source mismatch")
  assert.equal(run.head_branch, context.ref.slice("refs/heads/".length), "producer request branch mismatch")
  assert.equal(run.event, "push", "producer event mismatch")
  assert.equal(run.path, ".github/workflows/g09-final.yml", "producer workflow path mismatch")
  assert.equal(run.status, "in_progress", "producer run is not active")
  const operatorLogin = run.triggering_actor?.login || run.actor?.login
  assert.equal(operatorLogin, request.acknowledgements.release.operator,
    "producer was not invoked by the confirmed Release operator account")
  assert.equal(String(job.id), context.jobId, "producer job mismatch")
  assert.equal(String(job.run_id), context.runId, "job belongs to another run")
  assert.equal(String(job.run_attempt), context.runAttempt, "job belongs to another attempt")
  assert.equal(job.head_sha, request.candidate.sha, "job source mismatch")
  assert.equal(job.name, "teams-profile-artifact", "unexpected producer job")
  assert.equal(job.check_run_url, "https://api.github.com/repos/" + repository + "/check-runs/" + context.checkRunId,
    "job check-run mismatch")
  assert.equal(job.status, "in_progress", "producer job is not active")
  assert.equal(job.conclusion, null, "producer job already concluded")
  const started = instant(job.started_at, "job.started_at")
  for (const role of ["migration", "release"]) {
    assert(started >= instant(acknowledgements[role].source.updatedAt, role + ".updatedAt"),
      "producer started before both final candidate confirmations")
  }
  return {
    schema: "sf-g07-build-admission-v1", status: "VERIFIED_SOURCE", repository,
    candidate: request.candidate, requestSource: loaded.source, acknowledgements,
    producer: { workflowSha: run.head_sha, workflowPath: run.path, ref: context.ref,
      runId: context.runId, runAttempt: context.runAttempt, jobId: context.jobId,
      checkRunId: context.checkRunId, jobName: job.name, operatorLogin, startedAt: job.started_at },
    productionCutover: false, installation: null
  }
}

export function sameAdmission(first, final) {
  const before = structuredClone(first)
  const after = structuredClone(final)
  if (before.verifier) delete before.verifier.observedAt
  if (after.verifier) delete after.verifier.observedAt
  assert.deepEqual(before, after, "live source changed during package verification")
}

export async function verifyAdmission(value, api) {
  const request = parseRequest(value)
  const { migration, release } = await verifyPin(request, api)
  const p = request.producer
  const run = await api("/repos/" + repository + "/actions/runs/" + p.runId + "/attempts/" + p.runAttempt)
  const job = await api("/repos/" + repository + "/actions/jobs/" + p.jobId)
  const artifact = await api("/repos/" + repository + "/actions/artifacts/" + p.artifactId)
  assert.equal(String(run.id), p.runId, "producer run mismatch")
  assert.equal(String(run.run_attempt), p.runAttempt, "producer attempt mismatch")
  assert.equal(run.head_sha, p.workflowSha, "producer workflow source mismatch")
  assert.equal(run.path, p.workflowPath, "producer workflow path mismatch")
  assert.equal(run.repository?.full_name, repository, "producer repository mismatch")
  assert.equal(run.status, "completed", "producer run is not complete")
  const operatorLogin = run.triggering_actor?.login || run.actor?.login
  assert.equal(operatorLogin, request.acknowledgements.release.operator,
    "producer was not invoked by the confirmed Release operator account")
  assert.equal(String(job.id), p.jobId, "producer job mismatch")
  assert.equal(String(job.run_id), p.runId, "job belongs to another run")
  assert.equal(String(job.run_attempt), p.runAttempt, "job belongs to another attempt")
  assert.equal(job.head_sha, p.workflowSha, "job source mismatch")
  assert.equal(job.check_run_url, "https://api.github.com/repos/" + repository + "/check-runs/" + p.checkRunId,
    "job check-run mismatch")
  assert.equal(job.status, "completed", "producer job incomplete")
  assert.equal(job.conclusion, "success", "producer job did not succeed")
  const started = instant(job.started_at, "job.started_at")
  assert(started >= instant(migration.source.updatedAt, "migration.updatedAt") &&
    started >= instant(release.source.updatedAt, "release.updatedAt"),
    "producer started before both final candidate confirmations")
  assert.equal(String(artifact.id), p.artifactId, "artifact ID mismatch")
  assert.equal(artifact.name, p.artifactName, "artifact name mismatch")
  assert.equal(artifact.expired, false, "artifact expired")
  assert.equal(String(artifact.workflow_run?.id), p.runId, "artifact belongs to another run")
  assert.equal(artifact.workflow_run?.head_sha, p.workflowSha, "artifact workflow source mismatch")
  assert.equal(artifact.digest, "sha256:" + p.zipSha256, "GitHub artifact ZIP digest mismatch")
  assert(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 &&
    artifact.size_in_bytes <= 3 * 1024 ** 3, "artifact size exceeds limit")
  assert(instant(artifact.created_at, "artifact.created_at") >= started &&
    instant(artifact.created_at, "artifact.created_at") <= instant(job.completed_at, "job.completed_at"),
    "artifact was not produced during the selected job")
  return {
    schema: "sf-g07-admission-v1",
    status: "VERIFIED_SOURCE",
    repository,
    candidate: request.candidate,
    acknowledgements: { migration, release },
    producer: { ...p, operatorLogin, jobName: job.name, startedAt: job.started_at, completedAt: job.completed_at,
      runConclusion: run.conclusion, artifactCreatedAt: artifact.created_at, zipBytes: artifact.size_in_bytes },
    productionCutover: false,
    installation: null
  }
}

async function github(path) {
  assert(/^\/repos\/gustavomhss\/Orchestra-SF\//.test(path), "untrusted API path")
  const token = process.env.GH_TOKEN
  assert(typeof token === "string" && token.length > 0, "read-only GitHub credential required")
  const response = await fetch("https://api.github.com" + path, {
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28" },
    redirect: "error", signal: AbortSignal.timeout(30000)
  })
  assert(response.ok, "GitHub source verification failed: HTTP " + response.status)
  const body = await response.text()
  assert(body.length <= 4 * 1024 ** 2, "GitHub response exceeds limit")
  return JSON.parse(body)
}


export async function downloadArchive(admission, output) {
  assert.equal(admission.schema, "sf-g07-admission-v1")
  assert.equal(admission.status, "VERIFIED_SOURCE")
  const p = admission.producer
  id(p.artifactId, "artifactId")
  hex(p.zipSha256, sha64, "zipSha256")
  assert(Number.isSafeInteger(p.zipBytes) && p.zipBytes > 0 && p.zipBytes <= 3 * 1024 ** 3, "ZIP byte limit")
  const token = process.env.GH_TOKEN
  assert(typeof token === "string" && token.length > 0, "GitHub credential required")
  const redirect = await fetch("https://api.github.com/repos/" + repository + "/actions/artifacts/" + p.artifactId + "/zip", {
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28" },
    redirect: "manual", signal: AbortSignal.timeout(30000)
  })
  assert.equal(redirect.status, 302, "GitHub artifact redirect required")
  const url = new URL(redirect.headers.get("location"))
  assert(url.protocol === "https:" && !url.username && !url.password &&
    (url.hostname.endsWith(".blob.core.windows.net") || url.hostname.endsWith(".actions.githubusercontent.com") ||
      url.hostname.endsWith(".githubusercontent.com") || url.hostname.endsWith(".s3.amazonaws.com") ||
      /^[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname)), "untrusted artifact storage redirect")
  // The GitHub bearer is deliberately not forwarded to the signed storage URL.
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(600000) })
  assert.equal(response.status, 200, "artifact storage download failed")
  assert(response.body, "artifact response body missing")
  const outputFile = await open(output, "wx", 0o600)
  const hash = createHash("sha256")
  const observed = { bytes: 0, complete: false }
  try {
    for await (const chunk of response.body) {
      observed.bytes += chunk.length
      assert(observed.bytes <= p.zipBytes, "artifact download exceeds verified byte count")
      hash.update(chunk)
      await outputFile.writeFile(chunk)
    }
    assert.equal(observed.bytes, p.zipBytes, "artifact download byte count mismatch")
    assert.equal(hash.digest("hex"), p.zipSha256, "artifact ZIP SHA-256 mismatch")
    await outputFile.sync()
    observed.complete = true
  } finally {
    await outputFile.close()
    if (!observed.complete) await unlink(output).catch(() => undefined)
  }
  return { artifactId: p.artifactId, zipBytes: observed.bytes, zipSha256: p.zipSha256 }
}

function observation() {
  return {
    workflowSha: hex(process.env.GITHUB_SHA, sha40, "verifier.workflowSha"),
    runId: id(process.env.GITHUB_RUN_ID, "verifier.runId"),
    runAttempt: id(process.env.GITHUB_RUN_ATTEMPT, "verifier.runAttempt"),
    observedAt: new Date().toISOString()
  }
}

async function readJson(path) {
  const raw = await readFile(path, "utf8")
  assert(Buffer.byteLength(raw) <= 131072, "request exceeds limit")
  return { raw, value: JSON.parse(raw) }
}

async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "qualification must execute in GitHub Actions")
  const [command, input, output] = process.argv.slice(2)
  if (command === "build-admit" || command === "build-recheck") {
    const destination = command === "build-admit" ? input : output
    assert(destination && process.argv.length === (command === "build-admit" ? 4 : 5),
      "build-admit output.json | build-recheck prior.json output.json")
    const result = await verifyBuildAdmission({
      repository: process.env.GITHUB_REPOSITORY, eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA, tree: process.env.SOURCE_TREE,
      runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      jobId: process.env.PRODUCER_JOB_ID, checkRunId: process.env.CHECK_RUN_ID
    })
    result.verifier = observation()
    if (command === "build-recheck") sameAdmission((await readJson(input)).value, result)
    await writeFile(destination, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    process.stdout.write(JSON.stringify({ status: result.status, candidate: result.candidate,
      requestRevision: result.requestSource.revision, productionCutover: false, installed: false }) + "\n")
    return
  }
  assert(input && output && process.argv.length === 5, "input and new output path required")
  if (command === "download") {
    const result = await downloadArchive((await readJson(input)).value, output)
    process.stdout.write(JSON.stringify(result) + "\n")
    return
  }
  assert.equal(command, "admit", "usage: go-live-package.mjs admit request.json admission.json")
  const { raw, value } = await readJson(input)
  const result = await verifyAdmission(value, github)
  result.requestSha256 = digest(raw)
  result.verifier = observation()
  await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  process.stdout.write(JSON.stringify({ status: result.status, candidate: result.candidate,
    artifactId: result.producer.artifactId, productionCutover: false, installed: false }) + "\n")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((error) => {
    process.stderr.write("G07_ADMISSION_REFUSED: " + error.message + "\n")
    process.exitCode = 1
  })
}
