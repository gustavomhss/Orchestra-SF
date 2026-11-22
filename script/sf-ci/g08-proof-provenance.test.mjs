// Controlled API/ZIP/parser boundaries only. These tests grant no identity, reserve no host and emit no installed proof.
import { test, expect } from "bun:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { digest, validatePlan } from "./g08-private-evidence.mjs"
import { aggregateJob, exerciseAggregateControl, exerciseAuthorizationControl, exerciseCleanupControl, exerciseProvenanceControl,
  inspectOriginalWorkflow, parseProducerRequest, producerJob, producerLabels, repository, repositoryId,
  verifyAggregateExecution, verifyDatasetCleanupAuthority, verifyExecutionAuthorization, verifyOriginalProducer, verifyReceiptArchive,
  workflowPath } from "./g08-proof-provenance.mjs"

const base = "/repos/" + repository, uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0")
const candidate = { sha: "a".repeat(40), tree: "b".repeat(40) }, now = Date.parse("2026-01-01T01:05:00Z")
function target(installationId = "control-installation", teamObjectId = uuid(2)) {
  const item = { serverKey: "https://qa.example.invalid", discoveryOrigin: "https://qa.example.invalid",
    shellOrigin: "https://qa.example.invalid", publicOrigin: "https://qa.example.invalid",
    installationId, tenantId: uuid(1), teamObjectId, projectId: "control-project", hostId: "control-host",
    mount: "/sucafina", chapterHref: "" }
  item.chapterHref = "/orchestra/sf-home?" + new URLSearchParams({ contractRevision: "sf-team-profile/1",
    server: item.serverKey, installationId, tenantId: item.tenantId, teamObjectId })
  return item
}
function plan() {
  return validatePlan({ schema: "sf-g08-private-plan-v1", candidate, packageReceiptSha256: "c".repeat(64),
    reservation: { reference: "https://github.com/" + repository + "/issues/628#issuecomment-101",
      owner: "controlled-owner", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T02:00:00Z",
      vmId: uuid(10), environment: "qa-isolated", exclusive: true },
    approvals: { actorsReference: "https://github.com/" + repository + "/issues/628#issuecomment-102",
      mutationReference: "https://github.com/" + repository + "/issues/628#issuecomment-103", scope: "qualification-only" },
    invocation: { id: "d".repeat(32), runId: "100", runAttempt: "1", workflowSha: candidate.sha },
    target: target(), teamB: target("control-installation", uuid(3)), foreignInstallation: target("control-foreign"),
    actors: { requester: uuid(4), holder: uuid(5), denied: uuid(6), dashboardAdmin: uuid(7) },
    scratchRoot: "/tmp/control-private-g08" })
}
// Exact original root workflow #698 @76741cfc, blob 6035b60476c4fce49b83ce7503ef03367ffc2d28.
const canonicalWorkflow = "name: g08-installed-complete\n\non:\n  workflow_dispatch:\n    inputs:\n      mode:\n        description: \"One original installed group, or verify completed original producers\"\n        type: choice\n        options: [\"group\", \"aggregate\"]\n        required: true\n        default: \"group\"\n      kind:\n        description: \"Exactly one original group; ignored only for aggregate\"\n        type: choice\n        options: [\"TEAMS\", \"U15\", \"U39\", \"U40\", \"F04\", \"AZ02-preflight\", \"AZ02-actors\", \"AZ02-producer\", \"AZ02-after-revoke\", \"AZ02-logout\", \"AZ02-after-restart\"]\n        required: true\n        default: \"TEAMS\"\n      private_root:\n        description: \"Existing runner-owned private0700 root outside checkout, with the original approved plan\"\n        type: string\n        required: true\n      invocation_id:\n        description: \"Original32hex invocation nonce; group mode only\"\n        type: string\n        required: false\n\npermissions:\n  contents: read\n  actions: read\n  issues: read\n  pull-requests: read\n\nconcurrency:\n  group: g08-installed-isolated-qualification\n  cancel-in-progress: false\n\njobs:\n  installed-group:\n    name: installed-group\n    if: github.repository == 'gustavomhss/Orchestra-SF' && github.repository_id == '1455724710' && inputs.mode == 'group'\n    runs-on: [self-hosted, Linux, X64, orchestra-sf-g08-qa]\n    environment: g08-isolated-qa\n    timeout-minutes: 60\n    env:\n      CI: \"true\"\n      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: \"true\"\n      GH_TOKEN: ${{ github.token }}\n      SF_G08_PRIVATE_ROOT: ${{ inputs.private_root }}\n      SF_G08_INVOCATION_ID: ${{ inputs.invocation_id }}\n      SF_G08_KIND: ${{ inputs.kind }}\n    defaults:\n      run:\n        shell: bash\n    steps:\n      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5\n        with:\n          ref: ${{ github.sha }}\n          fetch-depth: 0\n          persist-credentials: false\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n        with:\n          node-version: \"24.15\"\n      - uses: ./.github/actions/setup-bun\n        with:\n          reuse-node: \"true\"\n      - name: Verify guards before using the reserved private host\n        run: bun run check:guards --base origin/dev\n      - name: Execute the one original authorized group with before and after observations\n        id: execute\n        run: bash script/sf-ci/g08-installed-run.sh \"$SF_G08_KIND\"\n      - name: Publish the allowlisted receipt; raw evidence stays on the isolated host\n        if: success() && steps.execute.outcome == 'success'\n        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n        with:\n          name: g08-group-${{ inputs.kind }}-${{ inputs.invocation_id }}-${{ github.run_attempt }}\n          path: g08-group-public/receipt.json\n          if-no-files-found: error\n          retention-days: 30\n\n  installed-aggregate:\n    name: installed-aggregate\n    if: github.repository == 'gustavomhss/Orchestra-SF' && github.repository_id == '1455724710' && inputs.mode == 'aggregate'\n    runs-on: [self-hosted, Linux, X64, orchestra-sf-g08-qa]\n    environment: g08-isolated-qa\n    timeout-minutes: 40\n    env:\n      CI: \"true\"\n      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: \"true\"\n      GH_TOKEN: ${{ github.token }}\n      SF_G08_PRIVATE_ROOT: ${{ inputs.private_root }}\n    defaults:\n      run:\n        shell: bash\n    steps:\n      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5\n        with:\n          ref: ${{ github.sha }}\n          fetch-depth: 0\n          persist-credentials: false\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n        with:\n          node-version: \"24.15\"\n      - uses: ./.github/actions/setup-bun\n        with:\n          reuse-node: \"true\"\n      - name: Verify all guards and the original source\n        run: bun run check:guards --base origin/dev\n      - name: Re-read every raw private report and verify its completed GitHub producer\n        id: aggregate\n        run: |\n          set -euo pipefail\n          umask 077\n          bun script/sf-ci/g08-installed-evidence.mjs aggregate \"$SF_G08_PRIVATE_ROOT\"\n      - name: Publish the isolated qualification receipt only\n        if: success() && steps.aggregate.outcome == 'success'\n        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n        with:\n          name: g08-complete-installed-${{ github.sha }}-${{ github.run_attempt }}\n          path: g08-aggregate-public/receipt.json\n          if-no-files-found: error\n          retention-days: 30\n"
function workflow() { return Bun.YAML.parse(canonicalWorkflow) }

function content(value) {
  const bytes = Buffer.from(typeof value === "string" ? value : JSON.stringify(value) + "\n")
  return { type: "file", path: workflowPath, encoding: "base64", size: bytes.length, content: bytes.toString("base64"),
    sha: createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex") }
}
function originalComment(body, number = 111, timestamp = "2026-01-01T00:30:00Z") {
  return { id: number, html_url: "https://github.com/" + repository + "/issues/628#issuecomment-" + number,
    issue_url: "https://api.github.com" + base + "/issues/628", body, user: { login: "gustavomhss" },
    author_association: "OWNER", created_at: timestamp, updated_at: timestamp }
}
function authority(value, raw, archive) {
  return { schema: "sf-g08-authorization-v1", scope: "qualification-only", decision: "authorize-isolated-qualification",
    candidate, archiveSha256: archive, reservationSha256: digest(JSON.stringify(value.reservation)),
    vmIdSha256: digest(value.reservation.vmId), invocations: [{ id: value.invocation.id, planSha256: digest(raw),
      actorsReferenceSha256: digest(value.approvals.actorsReference), mutationReferenceSha256: digest(value.approvals.mutationReference) }],
    productionCutover: false, datasetCleanup: null }
}
// Original job API names and chronology: source commands are separately checked against the literal YAML.
function observedSteps() {
  const names = ["Run actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "Run ./.github/actions/setup-bun",
    "Verify guards before using the reserved private host",
    "Execute the one original authorized group with before and after observations",
    "Publish the allowlisted receipt; raw evidence stays on the isolated host"]
  const times = ["01:00:01", "01:00:10", "01:00:20", "01:00:40", "01:01:00", "01:08:55", "01:09:05"]
  const step = (name, number, start, end) => ({ name, number, status: "completed", conclusion: "success",
    started_at: "2026-01-01T" + start + "Z", completed_at: "2026-01-01T" + end + "Z" })
  return [step("Set up job", 1, "01:00:00", times[0]),
    ...names.map((name, index) => step(name, index + 2, times[index], times[index + 1])),
    ...names.slice(0, 3).reverse().map((name, index) => step("Post " + name, index + 16, "01:09:10", "01:09:20")),
    step("Complete job", 19, "01:09:20", "01:10:00")]
}
const fixturesRoot = process.env.SF_G08_PROVENANCE_ZIPS
if (!fixturesRoot) throw new Error("ACTIONS_STANDARD_LIBRARY_ZIP_FIXTURES_REQUIRED")
const readFixture = (name) => readFile(path.join(fixturesRoot, name))
async function fixture(zipName = "deflated.zip") {
  const original = plan(), raw = JSON.stringify(original) + "\n", archive = "f".repeat(64)
  const receipt = await readFixture("receipt.raw"), zip = await readFixture(zipName)
  const comment = originalComment(JSON.stringify(authority(original, raw, archive)))
  const input = { kind: "U39", plan: original, planRaw: raw, archiveSha256: archive, receiptRaw: receipt,
    producer: { runId: "100", runAttempt: "1", jobId: "200", checkRunId: "201", artifactId: "300",
      zipSha256: digest(zip), zipBytes: zip.length },
    authorization: { url: comment.html_url, bodySha256: digest(comment.body), authorLogin: "gustavomhss" } }
  const run = { id: 100, run_attempt: 1, head_sha: candidate.sha, path: workflowPath,
    repository: { id: Number(repositoryId), full_name: repository }, head_repository: { id: Number(repositoryId), full_name: repository },
    status: "completed", conclusion: "success", check_suite_id: 400, created_at: "2026-01-01T00:50:00Z", updated_at: "2026-01-01T01:11:00Z" }
  const job = { id: 200, run_id: 100, run_attempt: 1, name: producerJob, head_sha: candidate.sha,
    status: "completed", conclusion: "success", check_run_url: "https://api.github.com" + base + "/check-runs/201",
    labels: [...producerLabels], runner_id: 12, runner_name: "controlled-runner-name-not-a-reservation",
    started_at: "2026-01-01T01:00:00Z", completed_at: "2026-01-01T01:10:00Z", steps: observedSteps() }
  const artifact = { id: 300, name: "g08-group-U39-" + original.invocation.id + "-1",
    expired: false, workflow_run: { id: 100, repository_id: Number(repositoryId), head_repository_id: Number(repositoryId), head_sha: candidate.sha },
    digest: "sha256:" + digest(zip), size_in_bytes: zip.length, created_at: "2026-01-01T01:09:00Z" }
  const data = new Map([
    [base, { id: Number(repositoryId), full_name: repository }],
    [base + "/git/commits/" + candidate.sha, { sha: candidate.sha, tree: { sha: candidate.tree } }],
    [base + "/contents/" + workflowPath + "?ref=" + candidate.sha, content(canonicalWorkflow)],
    [base + "/issues/comments/111", comment],
    [base + "/actions/runs/100/attempts/1", run], [base + "/actions/jobs/200", job],
    [base + "/actions/artifacts/300", artifact],
    [base + "/actions/runs/100/attempts/1/jobs?per_page=100", { total_count: 2, jobs: [
      structuredClone(job), { id: 202, run_id: 100, run_attempt: 1, head_sha: candidate.sha,
        name: "installed-aggregate", status: "completed", conclusion: "skipped" },
    ] }],
  ])
  const calls = [], downloads = []
  const api = { json: async (name) => {
    calls.push(name)
    assert(data.has(name), "Unexpected API source: " + name)
    return structuredClone(data.get(name))
  }, archive: async (artifactId, size) => { downloads.push({ artifactId, size }); return Buffer.from(zip) },
    review: async () => { throw new Error("UNEXPECTED_REVIEW_QUERY") } }
  const env = { GITHUB_ACTIONS: "true", CI: "true", GITHUB_REPOSITORY: repository, GITHUB_REPOSITORY_ID: repositoryId,
    RUNNER_ENVIRONMENT: "self-hosted", RUNNER_OS: "Linux", RUNNER_ARCH: "X64", SF_G08_CANDIDATE_SHA: candidate.sha,
    SF_G08_CANDIDATE_TREE: candidate.tree, GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "1",
    GITHUB_WORKFLOW_SHA: candidate.sha, SF_G08_INVOCATION_ID: original.invocation.id, GITHUB_SHA: candidate.sha, GITHUB_JOB: producerJob }
  const authInput = { plan: original, planRaw: raw, archiveSha256: archive, authorization: input.authorization }
  return { input, data, calls, downloads, api, env, authInput, zip, receipt, comment, run, job, artifact,
    activate() {
      run.status = "in_progress"; run.conclusion = null; run.updated_at = "2026-01-01T01:05:00Z"
      job.status = "in_progress"; job.conclusion = null; job.completed_at = null
      job.steps = job.steps.slice(0, 7)
      Object.assign(job.steps[5], { status: "in_progress", conclusion: null, completed_at: null })
      // GitHub original job137308970818/run45055263348 exposes future steps as pending with null timestamps.
      Object.assign(job.steps[6], { status: "pending", conclusion: null, started_at: null, completed_at: null })
      data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[0] = structuredClone(job)
    },
    changeAuthorization(change) {
      const value = JSON.parse(comment.body); change(value); comment.body = JSON.stringify(value)
      input.authorization.bodySha256 = digest(comment.body)
    },
    changeAuthorizationRaw(change) { comment.body = change(comment.body); input.authorization.bodySha256 = digest(comment.body) },
    changeWorkflow(change) { const value = workflow(); change(value); data.set(base + "/contents/" + workflowPath + "?ref=" + candidate.sha, content(value)) },
  }
}
const isControl = (value) => {
  assert.equal(value.schema, "sf-g08-provenance-control-v1")
  assert.equal(value.status, "CONTROL_ONLY_INJECTED_API")
  assert.equal(value.proofClass, "CONTROL_ONLY_NOT_ORIGINAL_GITHUB_OBSERVATION")
  for (const field of ["installed", "liveQualified", "g08Closed", "productionCutover"]) assert.equal(value[field], false)
}
test("parser has no API authority and retains immutable original receipt bytes", async () => {
  const f = await fixture(), parsed = parseProducerRequest(f.input)
  assert.equal(parsed.status, "PARSED_INPUT_NOT_EVIDENCE")
  assert.equal(f.calls.length, 0); assert.equal(f.downloads.length, 0)
  f.input.receiptRaw.fill(0)
  assert.notEqual(digest(parsed.receipt), digest(f.input.receiptRaw))
})
for (const filename of ["stored.zip", "deflated.zip", "streamed.zip"]) test("original one-file " + filename + " verifies CRC and all API sources only as an injected control", async () => {
  const f = await fixture(filename), result = await exerciseProvenanceControl(f.input, f.api)
  isControl(result)
  assert.equal(result.producer.startedAt, "2026-01-01T01:00:00Z")
  assert.equal(result.producer.completedAt, "2026-01-01T01:10:00Z")
  assert.equal(result.source.workflow.environmentEvidence, "ORIGINAL_WORKFLOW_AT_CANDIDATE_NOT_JOB_API")
  assert.equal(result.artifact.receiptSha256, digest(f.receipt))
  const standard = JSON.parse(await readFixture("fixture-manifest.json"))
  assert.equal(result.artifact.crc32, standard.receiptCrc32)
  assert.deepEqual(f.downloads, [{ artifactId: "300", size: f.zip.length }])
  assert.equal(f.calls.filter((name) => name.endsWith("/issues/comments/111")).length, 2)
  assert(!JSON.stringify(result).includes(f.input.plan.reservation.vmId))
  assert(!JSON.stringify(result).includes(f.input.plan.actors.requester))
  assert(!JSON.stringify(result).includes(f.input.plan.target.publicOrigin))
})
test("literal canonical workflow parser observes the two exclusive jobs and actual upload contracts", () => {
  const original = inspectOriginalWorkflow(canonicalWorkflow)
  assert.equal(original.path, workflowPath)
  assert.equal(original.job, producerJob)
  assert.equal(original.environment, "g08-isolated-qa")
  assert.equal(content(canonicalWorkflow).sha, "6035b60476c4fce49b83ce7503ef03367ffc2d28")
})
test("execution authorization observes original permission and current runner window before archive or CDP", async () => {
  const f = await fixture(); f.activate()
  const result = await exerciseAuthorizationControl(f.authInput, f.api, f.env, now)
  isControl(result)
  assert.equal(result.authorization.scope, "qualification-only")
  assert.equal(result.producer.startedAt, "2026-01-01T01:00:00Z")
  assert.equal(result.producer.jobStatus, "in_progress")
  assert.equal(result.producer.steps.at(-1).status, "in_progress")
  assert(f.calls.includes(base + "/actions/jobs/200"))
  assert.equal(f.downloads.length, 0)
  assert(!f.calls.some((name) => name.includes("/actions/artifacts/")))
})
test("pre-execution also accepts a queued publication only while every timestamp remains null", async () => {
  const f = await fixture(); f.activate(); f.job.steps[6].status = "queued"
  isControl(await exerciseAuthorizationControl(f.authInput, f.api, f.env, now))
  assert.equal(f.downloads.length, 0)
})
test("real exports do not accept an injected API or produce source proof from hosted controls", async () => {
  const f = await fixture()
  assert.equal(process.env.GH_TOKEN ?? "", "")
  await expect(verifyOriginalProducer(f.input, f.api)).rejects.toThrow()
  await expect(verifyExecutionAuthorization(f.authInput, f.api)).rejects.toThrow()
  assert.equal(f.calls.length, 0)
  assert.equal(f.downloads.length, 0)
})
test("authorization is read again after the original archive download", async () => {
  const f = await fixture(), download = f.api.archive
  f.api.archive = async (...args) => { const bytes = await download(...args); f.comment.body += "\nrevoked"; return bytes }
  await expect(exerciseProvenanceControl(f.input, f.api)).rejects.toThrow("ORIGINAL_REFERENCE_CHANGED")
})
test("review authorization observes edit timestamps through the original GraphQL record", async () => {
  const f = await fixture()
  const url = "https://github.com/" + repository + "/pull/628#pullrequestreview-112"
  const review = { id: 112, node_id: "PRR_control", html_url: url, pull_request_url: "https://api.github.com" + base + "/pulls/628",
    body: f.comment.body, user: { login: "gustavomhss" }, author_association: "OWNER", state: "COMMENTED",
    submitted_at: "2026-01-01T00:30:00Z" }
  const edited = { __typename: "PullRequestReview", id: review.node_id, databaseId: 112, url, body: review.body,
    author: { login: "gustavomhss" }, authorAssociation: "OWNER", state: "COMMENTED",
    createdAt: "2026-01-01T00:29:00Z", updatedAt: "2026-01-01T00:30:00Z",
    pullRequest: { number: 628, repository: { nameWithOwner: repository, databaseId: Number(repositoryId) } } }
  f.input.authorization.url = url
  f.data.set(base + "/pulls/628/reviews/112", review)
  f.api.review = async (nodeId) => { assert.equal(nodeId, review.node_id); return structuredClone(edited) }
  isControl(await exerciseProvenanceControl(f.input, f.api))
  edited.updatedAt = "2026-01-01T01:01:00Z"
  await expect(exerciseProvenanceControl(f.input, f.api)).rejects.toThrow("AUTHORIZATION_AFTER_PRODUCER_START")
})

const producerRefusals = [
  ["missing canonical execution step", (f) => { f.job.steps.splice(5, 1) }],
  ["skipped canonical execution step", (f) => { f.job.steps[5].conclusion = "skipped" }],
  ["failed canonical execution step", (f) => { f.job.steps[5].conclusion = "failure" }],
  ["reordered original job steps", (f) => { [f.job.steps[4], f.job.steps[5]] = [f.job.steps[5], f.job.steps[4]] }],
  ["duplicate canonical execution step", (f) => { f.job.steps.push({ ...f.job.steps[5], number: 99 }) }],
  ["additional receipt writer step", (f) => { f.job.steps.push({ ...f.job.steps[5], number: 99, name: "Create manual receipt" }) }],
  ["repository id", (f) => { f.data.get(base).id = 99 }],
  ["commit tree", (f) => { f.data.get(base + "/git/commits/" + candidate.sha).tree.sha = "9".repeat(40) }],
  ["workflow blob bytes", (f) => { f.data.get(base + "/contents/" + workflowPath + "?ref=" + candidate.sha).sha = "9".repeat(40) }],
  ["fork source", (f) => { f.run.head_repository.id = 99 }],
  ["incomplete run", (f) => { f.run.status = "in_progress"; f.run.conclusion = null }],
  ["failed run", (f) => { f.run.conclusion = "failure" }],
  ["wrong run attempt", (f) => { f.run.run_attempt = 2 }],
  ["wrong workflow source", (f) => { f.run.head_sha = "9".repeat(40) }],
  ["different workflow path", (f) => { f.run.path = ".github/workflows/other.yml" }],
  ["failed producer job", (f) => { f.job.conclusion = "failure" }],
  ["wrong job run", (f) => { f.job.run_id = 99 }],
  ["wrong job source", (f) => { f.job.head_sha = "9".repeat(40) }],
  ["foreign check URL", (f) => { f.job.check_run_url = "https://api.github.com" + base + "/check-runs/999" }],
  ["inconsistent job check URL", (f) => { f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[0].check_run_url = "https://api.github.com" + base + "/check-runs/999" }],
  ["hosted runner labels", (f) => { f.job.labels = ["ubuntu-latest"] }],
  ["missing runner observation", (f) => { f.job.runner_id = 0 }],
  ["missing aggregate job", (f) => { const jobs = f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100"); jobs.jobs.pop(); jobs.total_count = 1 }],
  ["aggregate ran in producer run", (f) => { f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[1].conclusion = "success" }],
  ["third concurrent artifact job", (f) => { const jobs = f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100"); jobs.jobs.push({ name: "other" }); jobs.total_count = 3 }],
  ["wrong artifact kind", (f) => { f.artifact.name = f.artifact.name.replace("U39", "TEAMS") }],
  ["artifact from another run", (f) => { f.artifact.workflow_run.id = 99 }],
  ["artifact from another repository", (f) => { f.artifact.workflow_run.repository_id = 99 }],
  ["expired artifact", (f) => { f.artifact.expired = true }],
  ["changed GitHub digest", (f) => { f.artifact.digest = "sha256:" + "9".repeat(64) }],
  ["wrong artifact size", (f) => { f.artifact.size_in_bytes++ }],
  ["artifact before producer start", (f) => { f.artifact.created_at = "2026-01-01T00:59:59Z" }],
  ["job beyond reserved window", (f) => { f.job.completed_at = "2026-01-01T02:00:00Z"; f.run.updated_at = f.job.completed_at }],
  ["local receipt differs from original", (f) => { f.input.receiptRaw = Buffer.from('{"manual":"PASS"}\n') }],
  ["download differs from API digest", (f) => { f.api.archive = async () => { const bytes = Buffer.from(f.zip); bytes[5] ^= 1; return bytes } }],
]
for (const [name, change] of producerRefusals) test("original producer refuses " + name, async () => {
  const f = await fixture(); change(f)
  await expect(exerciseProvenanceControl(f.input, f.api)).rejects.toThrow()
})
const authorizationRefusals = [
  ["duplicate decision key", (f) => f.changeAuthorizationRaw((raw) => raw.replace('"decision":', '"decision":"deny","decision":'))],
  ["duplicate nested candidate key", (f) => f.changeAuthorizationRaw((raw) => raw.replace('"candidate":{', '"candidate":{"sha":"' + "9".repeat(40) + '",'))],
  ["duplicate nested invocation key", (f) => f.changeAuthorizationRaw((raw) => raw.replace('"planSha256":', '"planSha256":"' + "9".repeat(64) + '","planSha256":'))],
  ["escaped duplicate decision key", (f) => f.changeAuthorizationRaw((raw) => raw.replace('"decision":', '"decisi\\u006fn":"deny","decision":'))],
  ["contradictory JSON block before a valid declaration", (f) => f.changeAuthorizationRaw((raw) => {
    const fence = String.fromCharCode(96).repeat(3), bad = raw.replace('"decision":', '"decision":"deny","decision":')
    return "Original authorization follows.\n" + fence + "json\n" + bad + "\n" + fence + "\n" + fence + "json\n" + raw + "\n" + fence
  })],
  ["manual PASS statement", (f) => { f.comment.body = "PASS"; f.input.authorization.bodySha256 = digest(f.comment.body) }],
  ["ambiguous declarations", (f) => { const fence = String.fromCharCode(96).repeat(3); f.comment.body = fence + "json\n" + f.comment.body + "\n" + fence + "\n" + fence + "json\n" + f.comment.body + "\n" + fence; f.input.authorization.bodySha256 = digest(f.comment.body) }],
  ["different author", (f) => { f.comment.user.login = "another-user" }],
  ["untrusted association", (f) => { f.comment.author_association = "NONE" }],
  ["wrong comment issue", (f) => { f.comment.issue_url = "https://api.github.com" + base + "/issues/1" }],
  ["changed source body", (f) => { f.comment.body += " altered" }],
  ["late edited authorization", (f) => { f.comment.updated_at = "2026-01-01T01:00:01Z" }],
  ["candidate mismatch", (f) => f.changeAuthorization((v) => { v.candidate.sha = "9".repeat(40) })],
  ["tree mismatch", (f) => f.changeAuthorization((v) => { v.candidate.tree = "9".repeat(40) })],
  ["tar mismatch", (f) => f.changeAuthorization((v) => { v.archiveSha256 = "9".repeat(64) })],
  ["reservation mismatch", (f) => f.changeAuthorization((v) => { v.reservationSha256 = "9".repeat(64) })],
  ["private VM hash mismatch", (f) => f.changeAuthorization((v) => { v.vmIdSha256 = "9".repeat(64) })],
  ["empty inventory", (f) => f.changeAuthorization((v) => { v.invocations = [] })],
  ["duplicate invocation", (f) => f.changeAuthorization((v) => { v.invocations.push({ ...v.invocations[0] }) })],
  ["different invocation", (f) => f.changeAuthorization((v) => { v.invocations[0].id = "9".repeat(32) })],
  ["different plan bytes", (f) => f.changeAuthorization((v) => { v.invocations[0].planSha256 = "9".repeat(64) })],
  ["unapproved actor reference", (f) => f.changeAuthorization((v) => { v.invocations[0].actorsReferenceSha256 = "9".repeat(64) })],
  ["unapproved mutation reference", (f) => f.changeAuthorization((v) => { v.invocations[0].mutationReferenceSha256 = "9".repeat(64) })],
  ["production authorization", (f) => f.changeAuthorization((v) => { v.productionCutover = true })],
  ["future cleanup claimed initially", (f) => f.changeAuthorization((v) => { v.datasetCleanup = { receiptSha256: "9".repeat(64) } })],
]
for (const [name, change] of authorizationRefusals) test("original authorization refuses " + name, async () => {
  const f = await fixture(); change(f)
  await expect(exerciseProvenanceControl(f.input, f.api)).rejects.toThrow()
  assert.equal(f.downloads.length, 0)
})
const workflowRefusals = [
  ["missing canonical execution", (v) => { v.jobs["installed-group"].steps.splice(4, 1) }],
  ["manual receipt command", (v) => { v.jobs["installed-group"].steps[4].run = "printf manual-pass > g08-group-public/receipt.json" }],
  ["execution after upload", (v) => { const steps = v.jobs["installed-group"].steps; [steps[4], steps[5]] = [steps[5], steps[4]] }],
  ["additional output rewrite", (v) => { v.jobs["installed-group"].steps.splice(5, 0, { run: "touch g08-group-public/receipt.json" }) }],
  ["ignored execution failure", (v) => { v.jobs["installed-group"].steps[4]["continue-on-error"] = true }],
  ["guards replaced by success text", (v) => { v.jobs["installed-group"].steps[3].run = "echo PASS" }],
  ["different execution id", (v) => { v.jobs["installed-group"].steps[4].id = "manual" }],
  ["wrong environment", (v) => { v.jobs["installed-group"].environment = "production" }],
  ["hosted workflow runner", (v) => { v.jobs["installed-group"]["runs-on"] = ["ubuntu-latest"] }],
  ["branch checkout", (v) => { v.jobs["installed-group"].steps[0].with.ref = "dev" }],
  ["mutable checkout action", (v) => { v.jobs["installed-group"].steps[0].uses = "actions/checkout@main" }],
  ["unclean checkout", (v) => { v.jobs["installed-group"].steps[0].with.clean = "false" }],
  ["write token", (v) => { v.permissions.contents = "write" }],
  ["OIDC token", (v) => { v.permissions["id-token"] = "write" }],
  ["aggregate not exclusive", (v) => { v.jobs["installed-aggregate"].if = v.jobs["installed-group"].if }],
  ["third workflow job", (v) => { v.jobs.extra = { name: "extra" } }],
  ["raw report upload", (v) => { v.jobs["installed-group"].steps.at(-1).with.path = "g08-group-public/" }],
  ["upload on failure", (v) => { v.jobs["installed-group"].steps.at(-1).if = "always()" }],
  ["artifact namespace crossover", (v) => { v.jobs["installed-aggregate"].steps.at(-1).with.name = "g08-group-U39-forged" }],
]
for (const [name, change] of workflowRefusals) test("original workflow refuses " + name, async () => {
  const f = await fixture(); f.changeWorkflow(change)
  await expect(exerciseProvenanceControl(f.input, f.api)).rejects.toThrow()
})
for (const filename of ["two-files.zip", "wrong-path.zip", "symlink.zip", "zip64.zip"]) test("closed archive refuses " + filename, async () => {
  const f = await fixture(filename)
  assert.throws(() => verifyReceiptArchive(f.zip, f.receipt, { zipBytes: f.zip.length, zipSha256: digest(f.zip) }))
})
test("closed archive rejects forged CRC even after digest and both headers agree", async () => {
  const f = await fixture("stored.zip"), bytes = Buffer.from(f.zip)
  const central = bytes.readUInt32LE(bytes.length - 6)
  const changedCrc = (bytes.readUInt32LE(14) ^ 1) >>> 0
  bytes.writeUInt32LE(changedCrc, 14); bytes.writeUInt32LE(changedCrc, central + 16)
  assert.throws(() => verifyReceiptArchive(bytes, f.receipt, { zipBytes: bytes.length, zipSha256: digest(bytes) }),
    /ZIP_CRC_OR_SIZE_MISMATCH/)
})
test("closed archive rejects trailing bytes and a corrupt streaming descriptor", async () => {
  const f = await fixture("streamed.zip"), changed = Buffer.from(f.zip), end = changed.length - 22
  const central = changed.readUInt32LE(end + 16)
  changed.writeUInt32LE((changed.readUInt32LE(central - 12) ^ 1) >>> 0, central - 12)
  assert.throws(() => verifyReceiptArchive(changed, f.receipt, { zipBytes: changed.length, zipSha256: digest(changed) }))
  const trailing = Buffer.concat([f.zip, Buffer.from("junk")])
  assert.throws(() => verifyReceiptArchive(trailing, f.receipt, { zipBytes: trailing.length, zipSha256: digest(trailing) }))
})
test("closed archive refuses deflate trailing input even when payload CRC is correct", async () => {
  const f = await fixture("deflated.zip"), old = f.zip
  const central = old.readUInt32LE(old.length - 6), extra = Buffer.from("not-deflate")
  const bytes = Buffer.concat([old.subarray(0, central), extra, old.subarray(central)])
  const newCentral = central + extra.length, packed = old.readUInt32LE(18) + extra.length
  bytes.writeUInt32LE(packed, 18); bytes.writeUInt32LE(packed, newCentral + 20)
  bytes.writeUInt32LE(newCentral, bytes.length - 6)
  assert.throws(() => verifyReceiptArchive(bytes, f.receipt, { zipBytes: bytes.length, zipSha256: digest(bytes) }),
    /ZIP_COMPRESSED_TRAILING_BYTES/)
})
for (const [name, modify, time] of [
  ["outside window", () => {}, Date.parse("2026-01-01T02:00:00Z")],
  ["hosted runner", (env) => { env.RUNNER_ENVIRONMENT = "github-hosted" }, now],
  ["different current SHA", (env) => { env.GITHUB_SHA = "9".repeat(40) }, now],
  ["aggregate job", (env) => { env.GITHUB_JOB = "installed-aggregate" }, now],
]) test("before-I/O authorization refuses " + name, async () => {
  const f = await fixture(); modify(f.env)
  await expect(exerciseAuthorizationControl(f.authInput, f.api, f.env, time)).rejects.toThrow()
  assert.equal(f.calls.length, 0); assert.equal(f.downloads.length, 0)
})
const activeRefusals = [
  ["publication has already started", (f) => { f.job.steps[6].started_at = "2026-01-01T01:04:00Z" }, "PUBLICATION_BEFORE_ORIGINAL_DRIVER_COMPLETION"],
  ["publication has already completed", (f) => { Object.assign(f.job.steps[6], { status: "completed", conclusion: "success", started_at: "2026-01-01T01:03:00Z", completed_at: "2026-01-01T01:04:00Z" }) }, "PUBLICATION_BEFORE_ORIGINAL_DRIVER_COMPLETION"],
  ["authorization created after job start", (f) => { f.comment.created_at = f.comment.updated_at = "2026-01-01T01:02:00Z" }, "AUTHORIZATION_AFTER_PRODUCER_START"],
  ["authorization edited between job start and admission", (f) => { f.comment.updated_at = "2026-01-01T01:02:00Z" }, "AUTHORIZATION_AFTER_PRODUCER_START"],
  ["completed run replayed before execution", (f) => { f.run.status = "completed"; f.run.conclusion = "success" }, "ORIGINAL_ACTIVE_RUN_REQUIRED"],
  ["different active run attempt", (f) => { f.run.run_attempt = 2 }, "ORIGINAL_ACTIVE_RUN_REQUIRED"],
  ["different active source SHA", (f) => { f.run.head_sha = "9".repeat(40) }, "ORIGINAL_ACTIVE_RUN_REQUIRED"],
  ["two active producer names", (f) => { f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[1].name = producerJob }, "EXCLUSIVE_ACTIVE_JOB_INVENTORY"],
  ["missing active job", (f) => { const jobs = f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100"); jobs.jobs.shift(); jobs.total_count = 1 }, "EXACT_ACTIVE_JOB_INVENTORY_REQUIRED"],
  ["aggregate executing in the same run", (f) => { const job = f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[1]; job.status = "in_progress"; job.conclusion = null }, "AGGREGATOR_RUN_IS_NOT_A_PRODUCER"],
  ["hosted active runner", (f) => { f.job.labels = ["ubuntu-latest"]; f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[0].labels = ["ubuntu-latest"] }, "ACTIVE_RUNNER_LABELS"],
  ["driver not yet executing", (f) => { f.job.steps[5].status = "queued" }, "ORIGINAL_DRIVER_NOT_CURRENTLY_EXECUTING"],
  ["guards skipped before admission", (f) => { f.job.steps[4].conclusion = "skipped" }, "ORIGINAL_DRIVER_STEP_SUCCESS_REQUIRED"],
  ["job starts after admission time", (f) => { f.job.started_at = "2026-01-01T01:06:00Z"; f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[0].started_at = f.job.started_at }, "ACTIVE_PRODUCER_OUTSIDE_RESERVED_WINDOW"],
  ["job starts before reservation", (f) => { f.run.created_at = "2025-12-31T23:58:00Z"; f.job.started_at = "2025-12-31T23:59:00Z"; f.data.get(base + "/actions/runs/100/attempts/1/jobs?per_page=100").jobs[0].started_at = f.job.started_at }, "ACTIVE_PRODUCER_OUTSIDE_RESERVED_WINDOW"],
  ["job start changed between original API reads", (f) => { f.job.started_at = "2026-01-01T01:00:01Z" }, "ORIGINAL_ACTIVE_JOB_REQUIRED"],
]
for (const [name, change, reason] of activeRefusals) test("pre-execution original job refuses " + name, async () => {
  const f = await fixture(); f.activate(); change(f)
  await expect(exerciseAuthorizationControl(f.authInput, f.api, f.env, now)).rejects.toThrow(reason)
  assert.equal(f.downloads.length, 0)
})
async function cleanupFixture() {
  const f = await fixture(), declaration = authority(f.input.plan, f.input.planRaw, f.input.archiveSha256)
  const value = { schema: "sf-g08-dataset-cleanup-v1", scope: "qualification-only", decision: "attest-isolated-dataset-cleanup",
    observer: "declared-controlled-observer", candidate, archiveSha256: declaration.archiveSha256,
    reservationSha256: declaration.reservationSha256, vmIdSha256: declaration.vmIdSha256,
    invocations: declaration.invocations.map(({ id, planSha256 }) => ({ id, planSha256 })),
    receiptSha256: "7".repeat(64), productionCutover: false }
  const comment = originalComment(JSON.stringify(value), 113, "2026-01-01T01:20:00Z")
  f.data.set(base + "/issues/comments/113", comment)
  const input = { plans: [{ plan: f.input.plan, planRaw: f.input.planRaw }], archiveSha256: f.input.archiveSha256,
    receiptSha256: value.receiptSha256, completedAt: "2026-01-01T01:10:00Z",
    reference: { url: comment.html_url, bodySha256: digest(comment.body), authorLogin: "gustavomhss" } }
  return { ...f, cleanup: input, cleanupComment: comment,
    changeCleanup(change) { const v = JSON.parse(comment.body); change(v); comment.body = JSON.stringify(v); input.reference.bodySha256 = digest(comment.body) },
    changeCleanupRaw(change) { comment.body = change(comment.body); input.reference.bodySha256 = digest(comment.body) } }
}
test("cleanup source is a posterior attestation and never an observation of a cleanup process", async () => {
  const f = await cleanupFixture(), result = await exerciseCleanupControl(f.cleanup, f.api, Date.parse("2026-01-01T01:30:00Z"))
  isControl(result)
  assert.equal(result.cleanupExecutionVerified, false); assert.equal(result.processObservation, false)
  assert.equal(result.receiptSha256, f.cleanup.receiptSha256)
  assert.equal(f.downloads.length, 0)
  await expect(verifyDatasetCleanupAuthority(f.cleanup, f.api)).rejects.toThrow()
})
test("free prose around one strict JSON declaration carries no independent authority", async () => {
  const f = await cleanupFixture(), fence = String.fromCharCode(96).repeat(3)
  const wrap = (raw) => "Review context is free prose, not another authorization.\n" + fence + "json\n" + raw + "\n" + fence + "\nEnd of context."
  f.changeAuthorizationRaw(wrap); f.changeCleanupRaw(wrap)
  isControl(await exerciseProvenanceControl(f.input, f.api))
  isControl(await exerciseCleanupControl(f.cleanup, f.api, Date.parse("2026-01-01T01:30:00Z")))
})
for (const [name, change] of [
  ["duplicate cleanup decision", (f) => f.changeCleanupRaw((raw) => raw.replace('"decision":', '"decision":"deny","decision":'))],
  ["duplicate cleanup candidate", (f) => f.changeCleanupRaw((raw) => raw.replace('"candidate":{', '"candidate":{"sha":"' + "9".repeat(40) + '",'))],
  ["duplicate cleanup invocation pin", (f) => f.changeCleanupRaw((raw) => raw.replace('"planSha256":', '"planSha256":"' + "9".repeat(64) + '","planSha256":'))],
  ["pre-test statement", (f) => { f.cleanupComment.created_at = "2026-01-01T00:20:00Z" }],
  ["wrong receipt", (f) => f.changeCleanup((v) => { v.receiptSha256 = "8".repeat(64) })],
  ["missing invocation", (f) => f.changeCleanup((v) => { v.invocations = [] })],
  ["extra invocation", (f) => f.changeCleanup((v) => { v.invocations.push({ id: "8".repeat(32), planSha256: "8".repeat(64) }) })],
  ["wrong plan", (f) => f.changeCleanup((v) => { v.invocations[0].planSha256 = "8".repeat(64) })],
  ["wrong VM", (f) => f.changeCleanup((v) => { v.vmIdSha256 = "8".repeat(64) })],
  ["invented process proof", (f) => f.changeCleanup((v) => { v.processObservation = true })],
]) test("posterior cleanup attestation refuses " + name, async () => {
  const f = await cleanupFixture(); change(f)
  await expect(exerciseCleanupControl(f.cleanup, f.api, Date.parse("2026-01-01T01:30:00Z"))).rejects.toThrow()
})

const aggregateNow = Date.parse("2026-01-01T03:05:00Z")
async function aggregateFixture() {
  const f = await fixture(), runId = 901, attempt = 2
  const run = { ...structuredClone(f.run), id: runId, run_attempt: attempt, event: "workflow_dispatch",
    status: "in_progress", conclusion: null, created_at: "2026-01-01T02:50:00Z", updated_at: "2026-01-01T03:05:00Z" }
  const names = ["Verify all guards and the original source",
    "Re-read every raw private report and verify its completed GitHub producer",
    "Publish the isolated qualification receipt only"]
  const steps = observedSteps().slice(0, 7).map((step, index) => ({ ...step,
    ...(index >= 4 ? { name: names[index - 4] } : {}),
    started_at: step.started_at.replace("T01:", "T03:"), completed_at: step.completed_at.replace("T01:", "T03:") }))
  Object.assign(steps[5], { status: "in_progress", conclusion: null, completed_at: null })
  Object.assign(steps[6], { status: "pending", conclusion: null, started_at: null, completed_at: null })
  const job = { ...structuredClone(f.job), id: 902, run_id: runId, run_attempt: attempt, name: aggregateJob,
    status: "in_progress", conclusion: null, check_run_url: "https://api.github.com" + base + "/check-runs/903",
    started_at: "2026-01-01T03:00:00Z", completed_at: null, steps }
  const jobs = { total_count: 2, jobs: [
    { id: 904, run_id: runId, run_attempt: attempt, head_sha: candidate.sha,
      name: producerJob, status: "completed", conclusion: "skipped" }, structuredClone(job),
  ] }
  f.data.set(base + "/actions/runs/901/attempts/2", run)
  f.data.set(base + "/actions/runs/901/attempts/2/jobs?per_page=100", jobs)
  f.data.set(base + "/actions/jobs/902", job)
  const env = { ...f.env, GITHUB_RUN_ID: "901", GITHUB_RUN_ATTEMPT: "2", GITHUB_JOB: aggregateJob,
    GITHUB_EVENT_NAME: "workflow_dispatch", RUNNER_NAME: job.runner_name }
  for (const key of ["SF_G08_CANDIDATE_SHA", "SF_G08_CANDIDATE_TREE", "SF_G08_INVOCATION_ID"]) delete env[key]
  const input = { plan: f.input.plan, planRaw: f.input.planRaw, archiveSha256: f.input.archiveSha256 }
  return { ...f, aggregateInput: input, aggregateEnv: env, aggregateRun: run, aggregateRecord: job, aggregateJobs: jobs }
}
test("aggregate admission reads its own six-step workflow and current job after the producer reservation has ended", async () => {
  const f = await aggregateFixture()
  assert(aggregateNow > Date.parse(f.input.plan.reservation.endsAt))
  const result = await exerciseAggregateControl(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)
  isControl(result)
  assert.equal(result.finalCandidate, false)
  assert.equal(result.controlledSchema, "sf-g08-aggregate-admission-v1")
  assert.equal(result.mode, "RETROSPECTIVE_READ_ONLY")
  assert.equal(result.requiresNewActiveReservation, false)
  assert.equal(result.currentJobIsInstalledProducer, false)
  assert(!Object.hasOwn(result, "authorization"))
  assert(!Object.hasOwn(result, "producer"))
  assert.equal(result.aggregator.runId, "901")
  assert.equal(result.aggregator.runAttempt, "2")
  assert.equal(result.aggregator.jobId, "902")
  assert.equal(result.aggregator.checkRunId, "903")
  assert.equal(result.aggregator.producerJobConclusion, "skipped")
  assert.equal(result.aggregator.event, "workflow_dispatch")
  assert.equal(result.aggregator.steps.length, 5)
  assert.equal(result.aggregator.steps.at(-1).status, "in_progress")
  assert.equal(result.source.workflow.execution.steps.length, 6)
  assert.equal(result.source.workflow.job, aggregateJob)
  assert.equal(result.source.workflow.blobSha, "6035b60476c4fce49b83ce7503ef03367ffc2d28")
  assert.equal(result.aggregator.runnerNameSha256, digest(f.aggregateEnv.RUNNER_NAME))
  assert(f.calls.includes(base + "/actions/jobs/902"))
  assert(!f.calls.some((name) => /comments|reviews|artifacts/.test(name)))
  assert.equal(f.downloads.length, 0)
  assert(!JSON.stringify(result).includes(f.aggregateEnv.RUNNER_NAME))
  // Re-reading does not weaken the original producer's reservation or permission checks.
  isControl(await exerciseProvenanceControl(f.input, f.api))
  await expect(exerciseAuthorizationControl(f.authInput, f.api, f.env, aggregateNow)).rejects.toThrow("G08_OUTSIDE_RESERVED_WINDOW")
})
test("aggregate parser keeps roles closed and the original publication contract distinct", () => {
  const observed = inspectOriginalWorkflow(canonicalWorkflow, aggregateJob)
  assert.equal(observed.execution.command, 'set -euo pipefail\numask 077\nbun script/sf-ci/g08-installed-evidence.mjs aggregate "$SF_G08_PRIVATE_ROOT"\n')
  assert.equal(observed.execution.steps.at(-1), "Publish the isolated qualification receipt only")
  assert.throws(() => inspectOriginalWorkflow(canonicalWorkflow, "manual-job"), /CLOSED_EXECUTION_ROLE_REQUIRED/)
})
test("real aggregate export cannot turn an injected hosted control into current Actions provenance", async () => {
  const f = await aggregateFixture()
  assert.equal(process.env.GH_TOKEN ?? "", "")
  await expect(verifyAggregateExecution(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)).rejects.toThrow()
  assert.equal(f.calls.length, 0)
  assert.equal(f.downloads.length, 0)
})
test("aggregate admission accepts a queued unpublished receipt without executing or authorizing a producer", async () => {
  const f = await aggregateFixture(); f.aggregateRecord.steps[6].status = "queued"
  const value = await exerciseAggregateControl(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)
  isControl(value)
  assert.equal(value.currentJobIsInstalledProducer, false)
})

const aggregateContextRefusals = [
  ["not Actions", (env) => { env.GITHUB_ACTIONS = "false" }],
  ["not CI", (env) => { env.CI = "false" }],
  ["another repository", (env) => { env.GITHUB_REPOSITORY = "another/repo" }],
  ["another repository id", (env) => { env.GITHUB_REPOSITORY_ID = "99" }],
  ["hosted runner", (env) => { env.RUNNER_ENVIRONMENT = "github-hosted" }],
  ["non-Linux runner", (env) => { env.RUNNER_OS = "Windows" }],
  ["another architecture", (env) => { env.RUNNER_ARCH = "ARM64" }],
  ["another checkout SHA", (env) => { env.GITHUB_SHA = "9".repeat(40) }],
  ["another workflow SHA", (env) => { env.GITHUB_WORKFLOW_SHA = "9".repeat(40) }],
  ["producer job context", (env) => { env.GITHUB_JOB = producerJob }],
  ["push event", (env) => { env.GITHUB_EVENT_NAME = "push" }],
  ["missing run id", (env) => { delete env.GITHUB_RUN_ID }],
  ["invalid attempt", (env) => { env.GITHUB_RUN_ATTEMPT = "0" }],
  ["missing runner name", (env) => { env.RUNNER_NAME = "" }],
]
for (const [name, change] of aggregateContextRefusals) test("aggregate before-I/O admission refuses " + name, async () => {
  const f = await aggregateFixture(); change(f.aggregateEnv)
  await expect(exerciseAggregateControl(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)).rejects.toThrow()
  assert.equal(f.calls.length, 0); assert.equal(f.downloads.length, 0)
})

const aggregateJobRefusals = [
  ["repository id", (f) => { f.data.get(base).id = 99 }],
  ["candidate tree", (f) => { f.data.get(base + "/git/commits/" + candidate.sha).tree.sha = "9".repeat(40) }],
  ["workflow bytes", (f) => { f.data.get(base + "/contents/" + workflowPath + "?ref=" + candidate.sha).sha = "9".repeat(40) }],
  ["run id", (f) => { f.aggregateRun.id = 100 }],
  ["run attempt", (f) => { f.aggregateRun.run_attempt = 1 }],
  ["run event", (f) => { f.aggregateRun.event = "push" }],
  ["fork run source", (f) => { f.aggregateRun.head_repository.id = 99 }],
  ["run source SHA", (f) => { f.aggregateRun.head_sha = "9".repeat(40) }],
  ["another workflow path", (f) => { f.aggregateRun.path = ".github/workflows/other.yml" }],
  ["completed run replay", (f) => { f.aggregateRun.status = "completed"; f.aggregateRun.conclusion = "success" }],
  ["missing producer job", (f) => { f.aggregateJobs.jobs.shift(); f.aggregateJobs.total_count = 1 }],
  ["extra concurrent job", (f) => { f.aggregateJobs.jobs.push({ name: "manual" }); f.aggregateJobs.total_count = 3 }],
  ["producer ran in aggregate run", (f) => { f.aggregateJobs.jobs[0].conclusion = "success" }],
  ["producer active in aggregate run", (f) => { f.aggregateJobs.jobs[0].status = "in_progress"; f.aggregateJobs.jobs[0].conclusion = null }],
  ["aggregate job skipped", (f) => { f.aggregateJobs.jobs[1].status = "completed"; f.aggregateJobs.jobs[1].conclusion = "skipped" }],
  ["listed job source mismatch", (f) => { f.aggregateJobs.jobs[1].head_sha = "9".repeat(40) }],
  ["actual job run mismatch", (f) => { f.aggregateRecord.run_id = 100 }],
  ["actual job attempt mismatch", (f) => { f.aggregateRecord.run_attempt = 1 }],
  ["actual job role mismatch", (f) => { f.aggregateRecord.name = producerJob }],
  ["actual job source mismatch", (f) => { f.aggregateRecord.head_sha = "9".repeat(40) }],
  ["actual job check URL changed", (f) => { f.aggregateRecord.check_run_url = "https://api.github.com" + base + "/check-runs/999" }],
  ["foreign check URL", (f) => { f.aggregateRecord.check_run_url = f.aggregateJobs.jobs[1].check_run_url = "https://example.invalid/check-runs/903" }],
  ["hosted labels in both observations", (f) => { f.aggregateRecord.labels = f.aggregateJobs.jobs[1].labels = ["ubuntu-latest"] }],
  ["missing actual runner", (f) => { f.aggregateRecord.runner_id = 0 }],
  ["different actual runner name", (f) => { f.aggregateRecord.runner_name = "another-runner" }],
  ["job before run creation", (f) => { f.aggregateRun.created_at = "2026-01-01T03:00:01Z" }],
  ["job after observation time", (f) => { f.aggregateRecord.started_at = f.aggregateJobs.jobs[1].started_at = "2026-01-01T03:06:00Z" }],
  ["completed active job", (f) => { f.aggregateRecord.completed_at = "2026-01-01T03:04:00Z" }],
  ["skipped guards", (f) => { f.aggregateRecord.steps[4].conclusion = "skipped" }],
  ["missing current driver", (f) => { f.aggregateRecord.steps.splice(5, 1) }],
  ["duplicate current driver", (f) => { f.aggregateRecord.steps.push({ ...f.aggregateRecord.steps[5], number: 99 }) }],
  ["additional receipt writer", (f) => { f.aggregateRecord.steps.push({ ...f.aggregateRecord.steps[5], number: 99, name: "Write manual receipt" }) }],
  ["reordered observed steps", (f) => { [f.aggregateRecord.steps[4], f.aggregateRecord.steps[5]] = [f.aggregateRecord.steps[5], f.aggregateRecord.steps[4]] }],
  ["driver still queued", (f) => { f.aggregateRecord.steps[5].status = "queued" }],
  ["publication already started", (f) => { f.aggregateRecord.steps[6].started_at = "2026-01-01T03:04:00Z" }],
  ["publication already completed", (f) => { Object.assign(f.aggregateRecord.steps[6], { status: "completed", conclusion: "success", started_at: "2026-01-01T03:03:00Z", completed_at: "2026-01-01T03:04:00Z" }) }],
  ["duplicate publication", (f) => { f.aggregateRecord.steps.push({ ...f.aggregateRecord.steps[6], number: 99 }) }],
]
for (const [name, change] of aggregateJobRefusals) test("current original aggregate job refuses " + name, async () => {
  const f = await aggregateFixture(); change(f)
  await expect(exerciseAggregateControl(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)).rejects.toThrow()
  assert.equal(f.downloads.length, 0)
})

const aggregateWorkflowRefusals = [
  ["changed guard command", (job, v) => { job.steps[3].run = "echo PASS" }],
  ["manual receipt command", (job, v) => { job.steps[4].run = "printf PASS > g08-aggregate-public/receipt.json" }],
  ["another driver id", (job, v) => { job.steps[4].id = "manual" }],
  ["missing driver", (job, v) => { job.steps.splice(4, 1) }],
  ["extra writer", (job, v) => { job.steps.splice(5, 0, { run: "touch g08-aggregate-public/receipt.json" }) }],
  ["upload before driver", (job, v) => { [job.steps[4], job.steps[5]] = [job.steps[5], job.steps[4]] }],
  ["ignored driver failure", (job, v) => { job.steps[4]["continue-on-error"] = true }],
  ["ignored job failure", (job, v) => { job["continue-on-error"] = true }],
  ["branch checkout", (job, v) => { job.steps[0].with.ref = "dev" }],
  ["mutable checkout", (job, v) => { job.steps[0].uses = "actions/checkout@main" }],
  ["unclean checkout", (job, v) => { job.steps[0].with.clean = false }],
  ["foreign environment", (job, v) => { job.environment = "production" }],
  ["hosted runner", (job, v) => { job["runs-on"] = ["ubuntu-latest"] }],
  ["container substitution", (job, v) => { job.container = "unbound-image" }],
  ["write permissions", (job, v) => { job.permissions = { ...v.permissions, contents: "write" } }],
  ["foreign shell", (job, v) => { job.defaults.run.shell = "sh" }],
  ["inexact aggregate artifact name", (job, v) => { job.steps[5].with.name = "g08-complete-installed-forged" }],
  ["upload directory", (job, v) => { job.steps[5].with.path = "g08-aggregate-public/" }],
  ["publication on failure", (job, v) => { job.steps[5].if = "always()" }],
]
for (const [name, change] of aggregateWorkflowRefusals) test("original aggregate workflow refuses " + name, async () => {
  const f = await aggregateFixture(); f.changeWorkflow((v) => change(v.jobs[aggregateJob], v))
  await expect(exerciseAggregateControl(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)).rejects.toThrow()
})

for (const [name, change] of [
  ["run identity", (f) => { f.aggregateEnv.GITHUB_RUN_ID = "999" }],
  ["runner identity", (f) => { f.aggregateEnv.RUNNER_NAME = "changed-runner" }],
  ["event", (f) => { f.aggregateEnv.GITHUB_EVENT_NAME = "push" }],
]) test("aggregate admission rechecks current " + name + " after original API reads", async () => {
  const f = await aggregateFixture(), json = f.api.json
  f.api.json = async (path) => {
    const value = await json(path)
    if (path === base + "/actions/jobs/902") change(f)
    return value
  }
  await expect(exerciseAggregateControl(f.aggregateInput, f.api, f.aggregateEnv, aggregateNow)).rejects.toThrow()
})
