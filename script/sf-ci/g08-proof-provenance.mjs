/** G08 source provenance only. Neither parsing, controls nor these observations close an installed gate. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { inflateRawSync } from "node:zlib"
import { digest, requireInvocation, validatePlan } from "./g08-private-evidence.mjs"
import az02 from "../../sf/azure/identity/az02-proof.cjs"

const { strictJson } = az02

export const repository = "gustavomhss/Orchestra-SF"
export const repositoryId = "1455724710"
export const workflowPath = ".github/workflows/g08-installed-complete.yml"
export const producerJob = "installed-group"
export const producerLabels = ["self-hosted", "Linux", "X64", "orchestra-sf-g08-qa"]
export const groupKinds = ["TEAMS", "U15", "U39", "U40", "F04", "AZ02-preflight", "AZ02-actors",
  "AZ02-producer", "AZ02-after-revoke", "AZ02-logout", "AZ02-after-restart"]
const prefix = "/repos/" + repository
const maximumReceipt = 1024 * 1024
const maximumArchive = 2 * 1024 * 1024
const associations = new Set(["OWNER", "MEMBER", "COLLABORATOR"])
const checkoutAction = "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
const setupNodeAction = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
const setupBunAction = "./.github/actions/setup-bun"
const guardStep = "Verify guards before using the reserved private host"
const executionStep = "Execute the one original authorized group with before and after observations"
const publicationStep = "Publish the allowlisted receipt; raw evidence stays on the isolated host"
const producerStepNames = ["Run " + checkoutAction, "Run " + setupNodeAction, "Run " + setupBunAction,
  guardStep, executionStep, publicationStep]
const originalProducerSteps = [
  { uses: checkoutAction, with: { ref: "$" + "{{ github.sha }}", "fetch-depth": 0, "persist-credentials": false } },
  { uses: setupNodeAction, with: { "node-version": "24.15" } },
  { uses: setupBunAction, with: { "reuse-node": "true" } },
  { name: guardStep, run: "bun run check:guards --base origin/dev" },
  { name: executionStep, id: "execute", run: 'bash script/sf-ci/g08-installed-run.sh "$SF_G08_KIND"' },
  { name: publicationStep, if: "success() && steps.execute.outcome == 'success'",
    uses: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    with: { name: "g08-group-$" + "{{ inputs.kind }}-$" + "{{ inputs.invocation_id }}-$" + "{{ github.run_attempt }}",
      path: "g08-group-public/receipt.json", "if-no-files-found": "error", "retention-days": 30 } },
]
const issueURL = /^https:\/\/github\.com\/gustavomhss\/Orchestra-SF\/(?:issues|pull)\/([1-9][0-9]*)#issuecomment-([1-9][0-9]*)$/
const reviewURL = /^https:\/\/github\.com\/gustavomhss\/Orchestra-SF\/pull\/([1-9][0-9]*)#pullrequestreview-([1-9][0-9]*)$/

function need(value, reason) { assert(value, "G08_PROVENANCE_" + reason) }
function record(value) { need(value && typeof value === "object" && !Array.isArray(value), "OBJECT_REQUIRED"); return value }
function exact(value, keys) {
  record(value)
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), "G08_PROVENANCE_CLOSED_FIELDS_REQUIRED")
}
function text(value, maximum = 256) {
  need(typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value), "TEXT_REQUIRED")
  return value
}
function hex(value, length = 64) {
  need(typeof value === "string" && new RegExp("^[0-9a-f]{" + length + "}$").test(value), "DIGEST_REQUIRED")
  return value
}
function id(value) {
  need(typeof value === "string" && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)), "ID_REQUIRED")
  return value
}
function instant(value) {
  need(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)), "TIMESTAMP_REQUIRED")
  return Date.parse(value)
}
function rawBytes(raw, maximum) {
  need(typeof raw === "string" || Buffer.isBuffer(raw), "ORIGINAL_BYTES_REQUIRED")
  const bytes = Buffer.isBuffer(raw) ? Buffer.from(raw) : Buffer.from(raw, "utf8")
  need(bytes.length > 0 && bytes.length <= maximum, "BYTE_LIMIT")
  new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  return bytes
}
function reference(value) {
  exact(value, ["url", "bodySha256", "authorLogin"])
  need(typeof value.url === "string" && (issueURL.test(value.url) || reviewURL.test(value.url)), "ORIGINAL_REFERENCE_REQUIRED")
  hex(value.bodySha256)
  need(typeof value.authorLogin === "string" && /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value.authorLogin),
    "AUTHOR_LOGIN_REQUIRED")
  return { url: value.url, bodySha256: value.bodySha256, authorLogin: value.authorLogin }
}
function boundPlan(input) {
  const raw = rawBytes(input.planRaw, 65_536).toString("utf8")
  const decoded = JSON.parse(raw)
  need(raw === JSON.stringify(decoded) + "\n", "CANONICAL_PLAN_BYTES_REQUIRED")
  const plan = validatePlan(input.plan)
  assert.deepEqual(decoded, input.plan, "G08_PROVENANCE_LOCAL_PLAN_BYTES_CHANGED")
  assert.deepEqual(validatePlan(decoded), plan, "G08_PROVENANCE_PLAN_READER_CHANGED")
  need(plan.invocation.workflowSha === plan.candidate.sha, "WORKFLOW_MUST_BE_CANDIDATE")
  return { plan, planSha256: digest(raw), archiveSha256: hex(input.archiveSha256),
    reservationSha256: digest(JSON.stringify(plan.reservation)), vmIdSha256: digest(plan.reservation.vmId) }
}
function sharedPins(bound) {
  return { candidate: bound.plan.candidate, archiveSha256: bound.archiveSha256,
    reservationSha256: bound.reservationSha256, vmIdSha256: bound.vmIdSha256 }
}
function invocationPin(bound) {
  return { id: bound.plan.invocation.id, planSha256: bound.planSha256,
    actorsReferenceSha256: digest(bound.plan.approvals.actorsReference),
    mutationReferenceSha256: digest(bound.plan.approvals.mutationReference) }
}
function sourceRecords(body, schema) {
  const fence = String.fromCharCode(96).repeat(3)
  const blocks = [...body.matchAll(new RegExp(fence + "json\\s*\\r?\\n([\\s\\S]*?)\\r?\\n" + fence, "g"))].map((entry) => entry[1])
  // Free prose around fenced JSON has no authority. Every declared JSON block must parse without
  // duplicate keys; an invalid/contradictory block cannot be ignored in favor of a later valid one.
  const values = (blocks.length ? blocks : [body]).map((raw) => strictJson(raw)).filter((value) => value?.schema === schema)
  need(values.length === 1, "ONE_UNAMBIGUOUS_SOURCE_DECLARATION_REQUIRED")
  return record(values[0])
}
async function readReference(ref, api) {
  reference(ref)
  const issue = ref.url.match(issueURL), review = ref.url.match(reviewURL)
  let value, createdAt, updatedAt
  if (issue) {
    value = await api.json(prefix + "/issues/comments/" + issue[2])
    need(String(value.id) === issue[2] && value.html_url === ref.url &&
      value.issue_url === "https://api.github.com" + prefix + "/issues/" + issue[1], "COMMENT_IDENTITY_MISMATCH")
    createdAt = value.created_at
    updatedAt = value.updated_at
  } else {
    value = await api.json(prefix + "/pulls/" + review[1] + "/reviews/" + review[2])
    need(String(value.id) === review[2] && value.html_url === ref.url &&
      value.pull_request_url === "https://api.github.com" + prefix + "/pulls/" + review[1] &&
      ["APPROVED", "COMMENTED"].includes(value.state), "REVIEW_IDENTITY_OR_STATE_MISMATCH")
    // REST submitted_at does not prove when a review body was edited. Observe GraphQL updatedAt as well.
    const original = await api.review(text(value.node_id, 256))
    need(original?.__typename === "PullRequestReview" && String(original.databaseId) === review[2] &&
      original.id === value.node_id && original.url === ref.url && original.body === value.body &&
      original.author?.login === value.user?.login && original.authorAssociation === value.author_association &&
      original.pullRequest?.number === Number(review[1]) &&
      original.pullRequest?.repository?.nameWithOwner === repository &&
      String(original.pullRequest?.repository?.databaseId) === repositoryId &&
      ["APPROVED", "COMMENTED"].includes(original.state), "REVIEW_EDIT_PROVENANCE_REQUIRED")
    createdAt = original.createdAt
    updatedAt = original.updatedAt
    need(instant(value.submitted_at) >= instant(createdAt) && instant(updatedAt) >= instant(value.submitted_at),
      "REVIEW_TIMESTAMP_ORDER")
  }
  need(value.user?.login === ref.authorLogin && associations.has(value.author_association), "TRUSTED_REPOSITORY_AUTHOR_REQUIRED")
  need(typeof value.body === "string" && Buffer.byteLength(value.body) <= 262_144, "REFERENCE_BODY_LIMIT")
  need(digest(value.body) === ref.bodySha256, "ORIGINAL_REFERENCE_CHANGED")
  need(instant(updatedAt) >= instant(createdAt), "REFERENCE_TIMESTAMP_ORDER")
  return { body: value.body, source: { url: ref.url, bodySha256: ref.bodySha256, authorLogin: ref.authorLogin,
    authorAssociation: value.author_association, createdAt, updatedAt,
    identityLimit: "GitHub account provenance; no distinct person or agent session is inferred." } }
}
function verifyInvocations(value) {
  need(Array.isArray(value) && value.length > 0 && value.length <= 64, "INVOCATION_INVENTORY_REQUIRED")
  const ids = new Set()
  for (const item of value) {
    exact(item, ["id", "planSha256", "actorsReferenceSha256", "mutationReferenceSha256"])
    hex(item.id, 32)
    need(!ids.has(item.id), "DUPLICATE_INVOCATION")
    ids.add(item.id)
    for (const name of ["planSha256", "actorsReferenceSha256", "mutationReferenceSha256"]) hex(item[name])
  }
}
async function originalAuthorization(bound, ref, api, noLaterThan) {
  const observed = await readReference(ref, api)
  need(instant(observed.source.updatedAt) <= noLaterThan, "AUTHORIZATION_AFTER_PRODUCER_START")
  const value = sourceRecords(observed.body, "sf-g08-authorization-v1")
  exact(value, ["schema", "scope", "decision", "candidate", "archiveSha256", "reservationSha256", "vmIdSha256",
    "invocations", "productionCutover", ...(Object.hasOwn(value, "datasetCleanup") ? ["datasetCleanup"] : [])])
  need(value.scope === "qualification-only" && value.decision === "authorize-isolated-qualification" &&
    value.productionCutover === false && (value.datasetCleanup === undefined || value.datasetCleanup === null),
    "ISOLATED_AUTHORIZATION_REQUIRED")
  const expected = sharedPins(bound)
  for (const key of Object.keys(expected)) assert.deepEqual(value[key], expected[key], "G08_PROVENANCE_AUTHORIZATION_PIN_" + key)
  verifyInvocations(value.invocations)
  const matches = value.invocations.filter((entry) => entry.id === bound.plan.invocation.id)
  need(matches.length === 1, "CURRENT_INVOCATION_NOT_AUTHORIZED")
  assert.deepEqual(matches[0], invocationPin(bound), "G08_PROVENANCE_AUTHORIZED_PLAN_OR_REFERENCES_CHANGED")
  return { source: observed.source, declarationSha256: digest(JSON.stringify(value)),
    invocation: invocationPin(bound), scope: "qualification-only", status: "ORIGINAL_SOURCE_AUTHORIZATION_OBSERVED" }
}
function workflowBytes(item, path) {
  need(item?.type === "file" && item.path === path && item.encoding === "base64" &&
    Number.isSafeInteger(item.size) && item.size > 0 && item.size <= 262_144 &&
    typeof item.content === "string" && item.content.length <= 360_448, "ORIGINAL_WORKFLOW_FILE_REQUIRED")
  const encoded = item.content.replace(/[\r\n]/g, ""), bytes = Buffer.from(encoded, "base64")
  need(bytes.length === item.size && bytes.toString("base64") === encoded, "WORKFLOW_ENCODING_CHANGED")
  const blob = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex")
  need(blob === item.sha, "WORKFLOW_GIT_BLOB_MISMATCH")
  return bytes
}
/** Parse the actual workflow, not job-environment metadata that GitHub's job API does not expose. */
export function inspectOriginalWorkflow(raw) {
  const bytes = rawBytes(raw, 262_144)
  need(typeof globalThis.Bun?.YAML?.parse === "function", "BUN_YAML_PARSER_REQUIRED")
  const document = record(globalThis.Bun.YAML.parse(bytes.toString("utf8")))
  exact(document.jobs, [producerJob, "installed-aggregate"])
  const job = record(document.jobs[producerJob])
  need(job.name === producerJob && job.uses === undefined && job.strategy === undefined &&
    job.container === undefined, "CANONICAL_PRODUCER_JOB_REQUIRED")
  assert.deepEqual([...job["runs-on"]].sort(), [...producerLabels].sort(), "G08_PROVENANCE_WORKFLOW_RUNNER_LABELS")
  need(job.environment === "g08-isolated-qa", "WORKFLOW_ISOLATED_ENVIRONMENT_REQUIRED")
  const permissions = record(job.permissions ?? document.permissions)
  exact(permissions, ["actions", "contents", "issues", "pull-requests"])
  need(Object.values(permissions).every((entry) => entry === "read"), "READ_ONLY_GITHUB_PERMISSIONS_REQUIRED")
  for (const [name, mode, output] of [[producerJob, "group", "g08-group-public/receipt.json"],
    ["installed-aggregate", "aggregate", "g08-aggregate-public/receipt.json"]]) {
    const observedJob = record(document.jobs[name])
    need(observedJob.name === name && observedJob.strategy === undefined && observedJob.uses === undefined,
      "FIXED_EXCLUSIVE_JOBS_REQUIRED")
    const condition = String(observedJob.if ?? "").replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, "").trim()
    assert.deepEqual(condition.split("&&").map((part) => part.replace(/\s/g, "")).sort(), [
      "github.repository=='" + repository + "'", "github.repository_id=='" + repositoryId + "'",
      "inputs.mode=='" + mode + "'",
    ].sort(), "G08_PROVENANCE_EXCLUSIVE_JOB_CONDITION")
    need(Array.isArray(observedJob.steps), "ORIGINAL_UPLOAD_REQUIRED")
    const uploads = observedJob.steps.filter((step) => typeof step?.uses === "string" && /^actions\/upload-artifact@/.test(step.uses))
    need(uploads.length === 1 && uploads[0].uses === "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02" &&
      uploads[0].with?.path === output, "EXCLUSIVE_ORIGINAL_UPLOAD_REQUIRED")
    const uploadCondition = String(uploads[0].if ?? "").replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, "").replace(/\s/g, "")
    need(uploadCondition === "success()&&steps." + (mode === "group" ? "execute" : "aggregate") + ".outcome=='success'", "UPLOAD_REQUIRES_ORIGINAL_SUCCESS")
    if (mode === "group") need(uploads[0].with?.name === "g08-group-$" + "{{ inputs.kind }}-$" +
      "{{ inputs.invocation_id }}-$" + "{{ github.run_attempt }}", "EXACT_GROUP_ARTIFACT_NAME_REQUIRED")
    else need(typeof uploads[0].with?.name === "string" && uploads[0].with.name.startsWith("g08-complete-installed"),
      "DISTINCT_AGGREGATE_ARTIFACT_REQUIRED")
  }
  need(Array.isArray(job.steps), "ORIGINAL_CHECKOUT_REQUIRED")
  const checkouts = job.steps.filter((step) => typeof step?.uses === "string" && /^actions\/checkout@/.test(step.uses))
  need(checkouts.length === 1 && /^actions\/checkout@[0-9a-f]{40}$/.test(checkouts[0].uses) &&
    checkouts[0].with?.ref === "$" + "{{ github.sha }}" &&
    [undefined, repository, "$" + "{{ github.repository }}"].includes(checkouts[0].with?.repository) &&
    [undefined, "."].includes(checkouts[0].with?.path) && [undefined, true, "true"].includes(checkouts[0].with?.clean),
    "EXACT_CANDIDATE_CHECKOUT_REQUIRED")
  // The canonical driver must be the only command that can create the uploaded receipt. Pin the
  // six source steps, including order and closed fields; no extra writer or continue-on-error.
  assert.deepEqual(job.steps, originalProducerSteps, "G08_PROVENANCE_ORIGINAL_DRIVER_STEP_CHAIN_REQUIRED")
  assert.deepEqual(job.defaults, { run: { shell: "bash" } }, "G08_PROVENANCE_ORIGINAL_DRIVER_SHELL_REQUIRED")
  need(job["continue-on-error"] === undefined, "ORIGINAL_DRIVER_CANNOT_IGNORE_FAILURE")
  return { path: workflowPath, sha256: digest(bytes), bytes: bytes.length, job: producerJob,
    environment: "g08-isolated-qa", environmentEvidence: "ORIGINAL_WORKFLOW_AT_CANDIDATE_NOT_JOB_API",
    execution: { command: originalProducerSteps[4].run, steps: [...producerStepNames] }, labels: [...producerLabels] }
}
async function originalSource(bound, api) {
  const [repo, commit, file] = await Promise.all([
    api.json(prefix), api.json(prefix + "/git/commits/" + bound.plan.candidate.sha),
    api.json(prefix + "/contents/" + workflowPath + "?ref=" + bound.plan.candidate.sha),
  ])
  need(repo.full_name === repository && String(repo.id) === repositoryId, "REPOSITORY_ID_MISMATCH")
  need(commit.sha === bound.plan.candidate.sha && commit.tree?.sha === bound.plan.candidate.tree, "CANDIDATE_TREE_MISMATCH")
  const workflow = inspectOriginalWorkflow(workflowBytes(file, workflowPath))
  return { repository, repositoryId, candidate: bound.plan.candidate, workflow: { ...workflow, blobSha: file.sha } }
}

/** Shape validation performs no API read and never returns a proof status. */
export function parseProducerRequest(input) {
  exact(input, ["kind", "plan", "planRaw", "archiveSha256", "receiptRaw", "producer", "authorization"])
  const bound = boundPlan(input), producer = record(input.producer)
  need(groupKinds.includes(input.kind), "GROUP_KIND_REQUIRED")
  const authorization = reference(input.authorization)
  exact(producer, ["runId", "runAttempt", "jobId", "checkRunId", "artifactId", "zipSha256", "zipBytes"])
  for (const key of ["runId", "runAttempt", "jobId", "checkRunId", "artifactId"]) id(producer[key])
  hex(producer.zipSha256)
  need(Number.isSafeInteger(producer.zipBytes) && producer.zipBytes > 0 && producer.zipBytes <= maximumArchive, "ZIP_BYTE_LIMIT")
  need(producer.runId === bound.plan.invocation.runId && producer.runAttempt === bound.plan.invocation.runAttempt,
    "PLAN_PRODUCER_INVOCATION_MISMATCH")
  const receipt = rawBytes(input.receiptRaw, maximumReceipt)
  return { status: "PARSED_INPUT_NOT_EVIDENCE", bound, producer: { ...producer }, receipt,
    kind: input.kind, authorization,
    artifactName: "g08-group-" + input.kind + "-" + bound.plan.invocation.id + "-" + producer.runAttempt }
}
function observedProducerSteps(job, active, observedAt) {
  need(Array.isArray(job.steps) && job.steps.length > 0, "ORIGINAL_JOB_STEPS_REQUIRED")
  const platform = new Set(["Set up job", "Complete job", ...producerStepNames.slice(0, 3).map((name) => "Post " + name)])
  need(job.steps.every((step) => producerStepNames.includes(step?.name) || platform.has(step?.name)),
    "UNEXPECTED_PRODUCER_JOB_STEP")
  need(new Set(job.steps.map((step) => step.number)).size === job.steps.length &&
    job.steps.every((step) => Number.isSafeInteger(step.number) && step.number > 0), "UNIQUE_ORIGINAL_STEP_NUMBERS_REQUIRED")
  const expected = active ? producerStepNames.slice(0, 5) : producerStepNames
  let previousNumber = 0, previousPosition = -1, previousEnd = instant(job.started_at)
  const observed = expected.map((name, index) => {
    const matches = job.steps.filter((step) => step.name === name)
    need(matches.length === 1, "ONE_ORIGINAL_DRIVER_STEP_REQUIRED")
    const step = matches[0], position = job.steps.indexOf(step), started = instant(step.started_at)
    need(step.number > previousNumber && position > previousPosition && started >= previousEnd && started <= observedAt,
      "ORIGINAL_DRIVER_STEP_ORDER_REQUIRED")
    const executing = active && index === 4
    if (executing) need(step.status === "in_progress" && step.conclusion === null && step.completed_at === null,
      "ORIGINAL_DRIVER_NOT_CURRENTLY_EXECUTING")
    else need(step.status === "completed" && step.conclusion === "success" &&
      instant(step.completed_at) >= started && instant(step.completed_at) <= observedAt,
      "ORIGINAL_DRIVER_STEP_SUCCESS_REQUIRED")
    previousNumber = step.number; previousPosition = position
    previousEnd = executing ? started : instant(step.completed_at)
    return { name, number: step.number, status: step.status, conclusion: step.conclusion,
      startedAt: step.started_at, completedAt: step.completed_at }
  })
  if (active) {
    const publications = job.steps.filter((step) => step.name === publicationStep)
    need(publications.length <= 1 && publications.every((step) => step.number > previousNumber &&
      job.steps.indexOf(step) > previousPosition && ["pending", "queued"].includes(step.status) &&
      step.conclusion === null && step.started_at === null && step.completed_at === null),
      "PUBLICATION_BEFORE_ORIGINAL_DRIVER_COMPLETION")
  }
  return observed
}
async function activeProducer(bound, api, now) {
  const runId = bound.plan.invocation.runId, attempt = bound.plan.invocation.runAttempt, candidate = bound.plan.candidate.sha
  const [source, run, jobs] = await Promise.all([
    originalSource(bound, api), api.json(prefix + "/actions/runs/" + runId + "/attempts/" + attempt),
    api.json(prefix + "/actions/runs/" + runId + "/attempts/" + attempt + "/jobs?per_page=100"),
  ])
  need(String(run.id) === runId && String(run.run_attempt) === attempt &&
    run.repository?.full_name === repository && String(run.repository?.id) === repositoryId &&
    run.head_repository?.full_name === repository && String(run.head_repository?.id) === repositoryId &&
    run.head_sha === candidate && run.path === workflowPath && run.status === "in_progress" && run.conclusion === null,
    "ORIGINAL_ACTIVE_RUN_REQUIRED")
  need(jobs.total_count === 2 && Array.isArray(jobs.jobs) && jobs.jobs.length === 2, "EXACT_ACTIVE_JOB_INVENTORY_REQUIRED")
  assert.deepEqual(jobs.jobs.map((entry) => entry.name).sort(), ["installed-aggregate", producerJob].sort(),
    "G08_PROVENANCE_EXCLUSIVE_ACTIVE_JOB_INVENTORY")
  for (const entry of jobs.jobs) {
    need(String(entry.run_id) === runId && String(entry.run_attempt) === attempt && entry.head_sha === candidate,
      "ACTIVE_JOB_SOURCE_MISMATCH")
    if (entry.name === producerJob) need(entry.status === "in_progress" && entry.conclusion === null,
      "ORIGINAL_ACTIVE_PRODUCER_REQUIRED")
    else need(entry.status === "completed" && entry.conclusion === "skipped", "AGGREGATOR_RUN_IS_NOT_A_PRODUCER")
  }
  const listed = jobs.jobs.find((entry) => entry.name === producerJob), jobId = id(String(listed.id))
  const job = await api.json(prefix + "/actions/jobs/" + jobId)
  need(String(job.id) === jobId && String(job.run_id) === runId && String(job.run_attempt) === attempt &&
    job.name === producerJob && job.head_sha === candidate && job.status === "in_progress" && job.conclusion === null &&
    job.started_at === listed.started_at && job.check_run_url === listed.check_run_url &&
    typeof job.check_run_url === "string" &&
    job.check_run_url.startsWith("https://api.github.com" + prefix + "/check-runs/"), "ORIGINAL_ACTIVE_JOB_REQUIRED")
  const checkRunId = id(job.check_run_url.slice(("https://api.github.com" + prefix + "/check-runs/").length))
  assert.deepEqual(job.labels, listed.labels, "G08_PROVENANCE_ACTIVE_RUNNER_OBSERVATION_CHANGED")
  assert.deepEqual([...job.labels].sort(), [...producerLabels].sort(), "G08_PROVENANCE_ACTIVE_RUNNER_LABELS")
  need(Number.isSafeInteger(job.runner_id) && job.runner_id > 0 && typeof job.runner_name === "string" &&
    job.runner_name.length > 0, "OBSERVED_SELF_HOSTED_RUNNER_REQUIRED")
  const started = instant(job.started_at)
  need(started >= instant(run.created_at) && started >= instant(bound.plan.reservation.startsAt) &&
    started <= now && now < instant(bound.plan.reservation.endsAt), "ACTIVE_PRODUCER_OUTSIDE_RESERVED_WINDOW")
  const steps = observedProducerSteps(job, true, now)
  return { source, started, metadata: { runId, runAttempt: attempt, jobId, checkRunId,
    workflowPath, workflowSha: candidate, jobName: producerJob, startedAt: job.started_at,
    runStatus: run.status, jobStatus: job.status, aggregateJobConclusion: "skipped", steps,
    runnerId: String(job.runner_id), runnerNameSha256: digest(job.runner_name), labels: [...producerLabels] } }
}
async function completedProducer(parsed, api) {
  const { bound, producer: p } = parsed
  const [source, run, job, artifact, jobs] = await Promise.all([
    originalSource(bound, api),
    api.json(prefix + "/actions/runs/" + p.runId + "/attempts/" + p.runAttempt),
    api.json(prefix + "/actions/jobs/" + p.jobId),
    api.json(prefix + "/actions/artifacts/" + p.artifactId),
    api.json(prefix + "/actions/runs/" + p.runId + "/attempts/" + p.runAttempt + "/jobs?per_page=100"),
  ])
  const candidate = bound.plan.candidate.sha
  need(String(run.id) === p.runId && String(run.run_attempt) === p.runAttempt &&
    run.repository?.full_name === repository && String(run.repository?.id) === repositoryId &&
    run.head_repository?.full_name === repository && String(run.head_repository?.id) === repositoryId &&
    run.head_sha === candidate && run.path === workflowPath &&
    run.status === "completed" && run.conclusion === "success", "ORIGINAL_COMPLETED_RUN_REQUIRED")
  need(String(job.id) === p.jobId && String(job.run_id) === p.runId && String(job.run_attempt) === p.runAttempt &&
    job.head_sha === candidate && job.name === producerJob && job.status === "completed" && job.conclusion === "success" &&
    job.check_run_url === "https://api.github.com" + prefix + "/check-runs/" + p.checkRunId,
    "ORIGINAL_SUCCESSFUL_JOB_REQUIRED")
  need(Array.isArray(job.labels), "OBSERVED_RUNNER_LABELS_REQUIRED")
  assert.deepEqual([...job.labels].sort(), [...producerLabels].sort(), "G08_PROVENANCE_OBSERVED_RUNNER_LABELS")
  need(Number.isSafeInteger(job.runner_id) && job.runner_id > 0 && typeof job.runner_name === "string" &&
    job.runner_name.length > 0, "OBSERVED_SELF_HOSTED_RUNNER_REQUIRED")
  need(jobs.total_count === 2 && Array.isArray(jobs.jobs) && jobs.jobs.length === 2, "EXACT_PRODUCER_JOB_INVENTORY_REQUIRED")
  assert.deepEqual(jobs.jobs.map((entry) => entry.name).sort(), ["installed-aggregate", producerJob].sort(),
    "G08_PROVENANCE_EXCLUSIVE_JOB_INVENTORY")
  for (const observed of jobs.jobs) {
    need(String(observed.run_id) === p.runId && String(observed.run_attempt) === p.runAttempt &&
      observed.head_sha === candidate && observed.status === "completed", "JOB_INVENTORY_SOURCE_MISMATCH")
    if (observed.name === producerJob) need(String(observed.id) === p.jobId && observed.conclusion === "success" &&
      observed.check_run_url === job.check_run_url, "JOB_INVENTORY_PRODUCER_MISMATCH")
    else need(observed.conclusion === "skipped", "AGGREGATOR_RUN_IS_NOT_A_PRODUCER")
  }
  const started = instant(job.started_at), completed = instant(job.completed_at)
  need(started <= completed && started >= instant(run.created_at) && completed <= instant(run.updated_at) &&
    started >= instant(bound.plan.reservation.startsAt) && completed < instant(bound.plan.reservation.endsAt),
    "PRODUCER_OUTSIDE_RESERVED_WINDOW")
  const steps = observedProducerSteps(job, false, completed)
  need(String(artifact.id) === p.artifactId && artifact.name === parsed.artifactName && artifact.expired === false &&
    String(artifact.workflow_run?.id) === p.runId && String(artifact.workflow_run?.repository_id) === repositoryId &&
    String(artifact.workflow_run?.head_repository_id) === repositoryId && artifact.workflow_run?.head_sha === candidate &&
    artifact.digest === "sha256:" + p.zipSha256 && artifact.size_in_bytes === p.zipBytes, "ORIGINAL_ARTIFACT_METADATA_REQUIRED")
  need(instant(artifact.created_at) >= started && instant(artifact.created_at) <= completed, "ARTIFACT_OUTSIDE_PRODUCER_JOB")
  return { source, started, completed, metadata: { runId: p.runId, runAttempt: p.runAttempt,
    jobId: p.jobId, checkRunId: p.checkRunId, checkRunEvidence: "ORIGINAL_JOB_CHECK_RUN_URL", artifactId: p.artifactId, artifactName: parsed.artifactName,
    workflowPath, workflowSha: candidate, jobName: producerJob, startedAt: job.started_at, completedAt: job.completed_at,
    runCreatedAt: run.created_at, runUpdatedAt: run.updated_at, artifactCreatedAt: artifact.created_at,
    runConclusion: "success", jobConclusion: "success", aggregateJobConclusion: "skipped", steps,
    runnerId: String(job.runner_id), runnerNameSha256: digest(job.runner_name), labels: [...producerLabels],
    zipSha256: p.zipSha256, zipBytes: p.zipBytes } }
}
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
/** Closed one-file ZIP. No extraction, path resolution, symlinks, ZIP64, encryption or archive-supplied code. */
export function verifyReceiptArchive(value, receiptRaw, expected) {
  need(Buffer.isBuffer(value) && value.length > 0 && value.length <= maximumArchive, "ZIP_BUFFER_REQUIRED")
  const receipt = rawBytes(receiptRaw, maximumReceipt)
  exact(expected, ["zipBytes", "zipSha256"])
  need(value.length === expected.zipBytes && digest(value) === hex(expected.zipSha256), "ORIGINAL_ZIP_BYTES_CHANGED")
  const zip = value, end = zip.length - 22
  need(end >= 0 && zip.readUInt32LE(end) === 0x06054b50 && zip.readUInt16LE(end + 20) === 0 &&
    zip.readUInt16LE(end + 4) === 0 && zip.readUInt16LE(end + 6) === 0 &&
    zip.readUInt16LE(end + 8) === 1 && zip.readUInt16LE(end + 10) === 1, "ONE_FILE_ZIP_REQUIRED")
  const centralSize = zip.readUInt32LE(end + 12), central = zip.readUInt32LE(end + 16)
  need(central > 0 && central + centralSize === end && centralSize >= 46 &&
    zip.readUInt32LE(central) === 0x02014b50, "ZIP_CENTRAL_DIRECTORY_INVALID")
  const flags = zip.readUInt16LE(central + 8), method = zip.readUInt16LE(central + 10)
  const crc = zip.readUInt32LE(central + 16), packed = zip.readUInt32LE(central + 20), unpacked = zip.readUInt32LE(central + 24)
  const nameLength = zip.readUInt16LE(central + 28), extra = zip.readUInt16LE(central + 30), comment = zip.readUInt16LE(central + 32)
  const attributes = zip.readUInt32LE(central + 38), offset = zip.readUInt32LE(central + 42)
  need((flags & ~0x0808) === 0 && [0, 8].includes(method) && unpacked > 0 && unpacked <= maximumReceipt &&
    packed > 0 && packed <= maximumArchive && offset === 0 && zip.readUInt16LE(central + 34) === 0 &&
    extra === 0 && comment === 0 && centralSize === 46 + nameLength &&
    zip.subarray(central + 46, central + 46 + nameLength).equals(Buffer.from("receipt.json")) &&
    (attributes & 0x10) === 0 && [0, 0x8000].includes((attributes >>> 16) & 0xf000),
    "CLOSED_REGULAR_RECEIPT_ZIP_REQUIRED")
  need(zip.readUInt32LE(0) === 0x04034b50 && zip.readUInt16LE(6) === flags && zip.readUInt16LE(8) === method &&
    zip.readUInt16LE(26) === nameLength && zip.readUInt16LE(28) === 0 &&
    zip.subarray(30, 30 + nameLength).equals(Buffer.from("receipt.json")), "ZIP_LOCAL_HEADER_MISMATCH")
  const dataStart = 30 + nameLength, dataEnd = dataStart + packed
  need(dataEnd <= central, "ZIP_DATA_BOUNDARY_MISMATCH")
  if (flags & 8) {
    need([0, crc].includes(zip.readUInt32LE(14)) && [0, packed].includes(zip.readUInt32LE(18)) &&
      [0, unpacked].includes(zip.readUInt32LE(22)), "ZIP_STREAM_HEADER_MISMATCH")
    const descriptorSize = central - dataEnd, signature = descriptorSize === 16
    need([12, 16].includes(descriptorSize) && (!signature || zip.readUInt32LE(dataEnd) === 0x08074b50),
      "ZIP_DESCRIPTOR_REQUIRED")
    const descriptor = dataEnd + (signature ? 4 : 0)
    need(zip.readUInt32LE(descriptor) === crc && zip.readUInt32LE(descriptor + 4) === packed &&
      zip.readUInt32LE(descriptor + 8) === unpacked, "ZIP_DESCRIPTOR_MISMATCH")
  } else need(dataEnd === central && zip.readUInt32LE(14) === crc && zip.readUInt32LE(18) === packed &&
    zip.readUInt32LE(22) === unpacked, "ZIP_LOCAL_SIZES_MISMATCH")
  let payload = zip.subarray(dataStart, dataEnd)
  if (method === 8) {
    const inflated = inflateRawSync(payload, { maxOutputLength: maximumReceipt, info: true })
    need(inflated.engine.bytesWritten === packed, "ZIP_COMPRESSED_TRAILING_BYTES")
    payload = inflated.buffer
  }
  need(payload.length === unpacked && crc32(payload) === crc, "ZIP_CRC_OR_SIZE_MISMATCH")
  need(payload.equals(receipt), "ORIGINAL_ARTIFACT_RECEIPT_BYTES_DIFFER")
  return { zipBytes: zip.length, zipSha256: digest(zip), receiptBytes: payload.length,
    receiptSha256: digest(payload), crc32: crc.toString(16).padStart(8, "0"), entries: ["receipt.json"] }
}
async function producerProof(input, api) {
  const parsed = parseProducerRequest(input), observed = await completedProducer(parsed, api)
  await originalAuthorization(parsed.bound, parsed.authorization, api, observed.started)
  const archive = verifyReceiptArchive(await api.archive(parsed.producer.artifactId, parsed.producer.zipBytes),
    parsed.receipt, { zipBytes: parsed.producer.zipBytes, zipSha256: parsed.producer.zipSha256 })
  // Re-read the original permission after archive I/O. Edited/deleted/revoked declarations cannot be reused.
  const authorization = await originalAuthorization(parsed.bound, parsed.authorization, api, observed.started)
  return { schema: "sf-g08-original-provenance-v1", status: "ORIGINAL_PRODUCER_PROVENANCE_VERIFIED",
    ...sharedPins(parsed.bound), kind: parsed.kind, invocation: invocationPin(parsed.bound),
    source: observed.source, producer: observed.metadata, artifact: archive, authorization,
    observedAt: new Date().toISOString(), installed: false, liveQualified: false, g08Closed: false, productionCutover: false }
}
async function executionAuthorization(input, api, env, now) {
  exact(input, ["plan", "planRaw", "archiveSha256", "authorization"])
  const bound = boundPlan(input)
  const ref = reference(input.authorization)
  requireInvocation(bound.plan, env, now)
  need(env.GITHUB_SHA === bound.plan.candidate.sha && env.GITHUB_JOB === producerJob, "CURRENT_CANDIDATE_JOB_REQUIRED")
  const observed = await activeProducer(bound, api, now)
  const authorization = await originalAuthorization(bound, ref, api, observed.started)
  return { schema: "sf-g08-execution-authorization-v1", status: "ORIGINAL_EXECUTION_AUTHORIZATION_OBSERVED",
    ...sharedPins(bound), invocation: invocationPin(bound), source: observed.source, producer: observed.metadata, authorization,
    observedAt: new Date(now).toISOString(), installed: false, liveQualified: false, g08Closed: false, productionCutover: false }
}
async function cleanupAuthority(input, api, now) {
  exact(input, ["plans", "archiveSha256", "receiptSha256", "completedAt", "reference"])
  need(Array.isArray(input.plans) && input.plans.length > 0 && input.plans.length <= 64, "CLEANUP_INVOCATION_INVENTORY_REQUIRED")
  const bounds = input.plans.map((item) => {
    exact(item, ["plan", "planRaw"])
    return boundPlan({ ...item, archiveSha256: input.archiveSha256 })
  })
  const pins = sharedPins(bounds[0]), invocations = bounds.map((bound) => ({ id: bound.plan.invocation.id, planSha256: bound.planSha256 }))
  need(new Set(invocations.map((entry) => entry.id)).size === invocations.length, "CLEANUP_DUPLICATE_INVOCATION")
  for (const bound of bounds) assert.deepEqual(sharedPins(bound), pins, "G08_PROVENANCE_CLEANUP_RESERVATION_OR_CANDIDATE_MISMATCH")
  const ref = reference(input.reference)
  const source = await originalSource(bounds[0], api)
  const observed = await readReference(ref, api), completed = instant(input.completedAt)
  need(completed <= now && instant(observed.source.createdAt) >= completed &&
    instant(observed.source.updatedAt) <= now, "CLEANUP_MUST_BE_ATTESTED_AFTER_EXECUTION")
  const value = sourceRecords(observed.body, "sf-g08-dataset-cleanup-v1")
  exact(value, ["schema", "scope", "decision", "observer", "candidate", "archiveSha256", "reservationSha256",
    "vmIdSha256", "invocations", "receiptSha256", "productionCutover"])
  need(value.scope === "qualification-only" && value.decision === "attest-isolated-dataset-cleanup" &&
    value.productionCutover === false, "CLEANUP_SOURCE_ATTESTATION_REQUIRED")
  text(value.observer)
  for (const key of Object.keys(pins)) assert.deepEqual(value[key], pins[key], "G08_PROVENANCE_CLEANUP_PIN_" + key)
  need(value.receiptSha256 === hex(input.receiptSha256), "CLEANUP_RECEIPT_HASH_MISMATCH")
  need(Array.isArray(value.invocations) && value.invocations.length === invocations.length, "EXACT_CLEANUP_INVOCATIONS_REQUIRED")
  for (const entry of value.invocations) { exact(entry, ["id", "planSha256"]); hex(entry.id, 32); hex(entry.planSha256) }
  const order = (items) => [...items].sort((a, b) => a.id.localeCompare(b.id))
  assert.deepEqual(order(value.invocations), order(invocations), "G08_PROVENANCE_CLEANUP_INVOCATIONS_MISMATCH")
  return { schema: "sf-g08-cleanup-authority-v1", status: "ORIGINAL_SOURCE_ATTESTATION_ONLY",
    ...pins, invocations, source, attestationSource: observed.source, declaredObserver: value.observer,
    declarationSha256: digest(JSON.stringify(value)), receiptSha256: input.receiptSha256,
    completedAt: input.completedAt, processObservation: false, cleanupExecutionVerified: false,
    installed: false, liveQualified: false, g08Closed: false, productionCutover: false }
}

function githubHeaders() {
  const token = process.env.GH_TOKEN
  need(typeof token === "string" && token.length > 0, "READ_ONLY_GITHUB_CREDENTIAL_REQUIRED")
  return { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28" }
}
async function boundedResponse(response, limit) {
  need(response.body, "HTTP_BODY_REQUIRED")
  const chunks = []
  let count = 0
  for await (const chunk of response.body) {
    count += chunk.length
    need(count <= limit, "HTTP_BYTE_LIMIT")
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
const realGitHub = Object.freeze({
  async json(path) {
    need(path === prefix || path.startsWith(prefix + "/"), "UNTRUSTED_API_PATH")
    const response = await fetch("https://api.github.com" + path, {
      headers: githubHeaders(), redirect: "error", signal: AbortSignal.timeout(30000),
    })
    need(response.status === 200, "GITHUB_HTTP_" + response.status)
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await boundedResponse(response, 4 * 1024 * 1024)))
  },
  async review(nodeId) {
    const query = "query OriginalReview($id:ID!){node(id:$id){__typename ... on PullRequestReview{" +
      "id databaseId url body state createdAt updatedAt author{login} authorAssociation " +
      "pullRequest{number repository{nameWithOwner databaseId}}}}}"
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST", headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id: nodeId } }), redirect: "error", signal: AbortSignal.timeout(30000),
    })
    need(response.status === 200, "GITHUB_REVIEW_HTTP_" + response.status)
    const result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await boundedResponse(response, 1024 * 1024)))
    need(!result.errors && result.data?.node, "GITHUB_REVIEW_EDIT_PROVENANCE_UNAVAILABLE")
    return result.data.node
  },
  async archive(artifactId, size) {
    id(artifactId)
    need(Number.isSafeInteger(size) && size > 0 && size <= maximumArchive, "ZIP_BYTE_LIMIT")
    const redirect = await fetch("https://api.github.com" + prefix + "/actions/artifacts/" + artifactId + "/zip", {
      headers: githubHeaders(), redirect: "manual", signal: AbortSignal.timeout(30000),
    })
    need(redirect.status === 302, "ORIGINAL_ARTIFACT_REDIRECT_REQUIRED")
    const destination = new URL(redirect.headers.get("location"))
    need(destination.protocol === "https:" && !destination.username && !destination.password && !destination.hash && (!destination.port || destination.port === "443") &&
      (destination.hostname.endsWith(".blob.core.windows.net") || destination.hostname.endsWith(".actions.githubusercontent.com") ||
        destination.hostname.endsWith(".githubusercontent.com") || destination.hostname.endsWith(".s3.amazonaws.com") ||
        /^[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(destination.hostname)), "UNTRUSTED_ARTIFACT_STORAGE")
    // Never forward the GitHub bearer to the signed storage URL, nor follow a second redirect.
    const response = await fetch(destination, { redirect: "error", signal: AbortSignal.timeout(60000) })
    need(response.status === 200, "ARTIFACT_STORAGE_HTTP_" + response.status)
    const bytes = await boundedResponse(response, size)
    need(bytes.length === size, "ORIGINAL_ARCHIVE_SIZE_CHANGED")
    return bytes
  },
})

/** Real API only. The receipt's group semantics and installed host remain the aggregator's separate obligation. */
export async function verifyOriginalProducer(input) { return producerProof(input, realGitHub) }
/** Real API and actual self-hosted Actions context, before any CDP or mutation. */
export async function verifyExecutionAuthorization(input) {
  const result = await executionAuthorization(input, realGitHub, process.env, Date.now())
  requireInvocation(validatePlan(input.plan), process.env, Date.now())
  return result
}
/** This attests only the original repository statement. It does not observe or perform cleanup. */
export async function verifyDatasetCleanupAuthority(input) { return cleanupAuthority(input, realGitHub, Date.now()) }

function controlsOnly(result) {
  return { ...result, schema: "sf-g08-provenance-control-v1", controlledSchema: result.schema,
    ...(result.authorization ? { authorization: { ...result.authorization, status: "CONTROL_ONLY_INJECTED_API" } } : {}),
    status: "CONTROL_ONLY_INJECTED_API", proofClass: "CONTROL_ONLY_NOT_ORIGINAL_GITHUB_OBSERVATION",
    installed: false, liveQualified: false, g08Closed: false, productionCutover: false }
}
/** Deliberately separate exports for controlled unit inputs; the real exports accept no adapter. */
export async function exerciseProvenanceControl(input, api) { return controlsOnly(await producerProof(input, api)) }
export async function exerciseAuthorizationControl(input, api, env, now) {
  return controlsOnly(await executionAuthorization(input, api, env, now))
}
export async function exerciseCleanupControl(input, api, now) { return controlsOnly(await cleanupAuthority(input, api, now)) }
