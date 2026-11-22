import assert from "node:assert/strict"
import { test } from "node:test"
import { createHash } from "node:crypto"
import { digest, parseRequest, readPinnedRequest, readQualificationRequest, repository, requestRevision,
  sameAdmission, verifyAdmission, verifyBuildAdmission } from "./go-live-package.mjs"

function fixture() {
  const candidate = { sha: "a".repeat(40), tree: "b".repeat(40) }
  const migration = {
    schema: "sf-g07-pin-v1", role: "migration", owner: "migration-test-fixture",
    decision: "confirm-candidate-for-packaging", candidateSha: candidate.sha,
    candidateTree: candidate.tree, scope: "qualification-only"
  }
  const release = { ...migration, role: "release", owner: "release-test-fixture", operator: "qa-test-fixture" }
  const references = (pin, issue, comment) => {
    const body = JSON.stringify(pin)
    return {
      spec: { url: "https://github.com/" + repository + "/pull/" + issue + "#issuecomment-" + comment,
        bodySha256: digest(body), authorLogin: "gustavomhss", owner: pin.owner, format: "structured",
        ...(pin.operator ? { operator: pin.operator } : {}) },
      data: { id: comment, html_url: "https://github.com/" + repository + "/pull/" + issue + "#issuecomment-" + comment,
        issue_url: "https://api.github.com/repos/" + repository + "/issues/" + issue,
        body, user: { login: "gustavomhss" }, author_association: "OWNER",
        created_at: "2026-01-01T10:00:00Z", updated_at: "2026-01-01T10:00:00Z" }
    }
  }
  const m = references(migration, 628, 111)
  const r = references(release, 247, 222)
  const request = {
    schema: "sf-g07-request-v1", candidate,
    acknowledgements: { migration: m.spec, release: r.spec },
    producer: { workflowSha: "c".repeat(40), workflowPath: ".github/workflows/g09-candidate.yml",
      runId: "33", runAttempt: "2", jobId: "44", checkRunId: "55", artifactId: "66",
      artifactName: "synthetic-control-package", zipSha256: "d".repeat(64),
      sourceProofFile: "compile-provenance.json", buildInputsFile: "build-inputs.json" },
    productionCutover: false
  }
  const base = "/repos/" + repository
  const data = new Map([
    [base + "/git/commits/" + candidate.sha, { sha: candidate.sha, tree: { sha: candidate.tree } }],
    [base + "/issues/comments/111", m.data],
    [base + "/issues/comments/222", r.data],
    [base + "/actions/runs/33/attempts/2", { id: 33, run_attempt: 2, head_sha: request.producer.workflowSha,
      path: request.producer.workflowPath, repository: { full_name: repository }, status: "completed", conclusion: "success",
      actor: { login: "qa-test-fixture" }, triggering_actor: { login: "qa-test-fixture" } }],
    [base + "/actions/jobs/44", { id: 44, run_id: 33, run_attempt: 2, head_sha: request.producer.workflowSha,
      check_run_url: "https://api.github.com/repos/" + repository + "/check-runs/55",
      status: "completed", conclusion: "success", name: "teams-profile-artifact",
      started_at: "2026-01-01T11:00:00Z", completed_at: "2026-01-01T12:00:00Z" }],
    [base + "/actions/artifacts/66", { id: 66, name: request.producer.artifactName, expired: false,
      workflow_run: { id: 33, head_sha: request.producer.workflowSha }, digest: "sha256:" + request.producer.zipSha256,
      size_in_bytes: 512, created_at: "2026-01-01T11:50:00Z" }]
  ])
  const calls = []
  return {
    request, data, calls, base,
    api: async (path) => {
      calls.push(path)
      assert(data.has(path), "unexpected source read: " + path)
      return structuredClone(data.get(path))
    },
    comment: (role) => data.get(base + "/issues/comments/" + (role === "migration" ? "111" : "222")),
    changePin: (role, change) => {
      const comment = data.get(base + "/issues/comments/" + (role === "migration" ? "111" : "222"))
      const pin = JSON.parse(comment.body)
      change(pin)
      comment.body = JSON.stringify(pin)
      request.acknowledgements[role].bodySha256 = digest(comment.body)
    }
  }
}

test("parsing does not verify approvals, source identity or an installation", () => {
  const f = fixture()
  const result = parseRequest(f.request)
  assert.equal(result.status, "PARSED")
  assert.equal(f.calls.length, 0)
  assert.equal(result.installation, undefined)
})

test("live-source contract binds both role statements, exact commit tree, attempt, job and ZIP", async () => {
  const f = fixture()
  const result = await verifyAdmission(f.request, f.api)
  assert.equal(result.status, "VERIFIED_SOURCE")
  assert.deepEqual(result.candidate, f.request.candidate)
  assert.equal(result.acknowledgements.migration.roleConfirmation.status, "DECLARED_IN_TRUSTED_SOURCE")
  assert.equal(result.acknowledgements.release.roleConfirmation.operator, "qa-test-fixture")
  assert.equal(result.producer.operatorLogin, "qa-test-fixture")
  assert.match(result.acknowledgements.release.roleConfirmation.identityLimit, /agent-session identities are not inferred/)
  assert.equal(result.installation, null)
  assert.equal(result.productionCutover, false)
  assert.equal(f.calls.length, 6)
})

for (const [name, change, message] of [
  ["missing role", (f) => delete f.request.acknowledgements.migration, /object required/],
  ["wrong source tree", (f) => { f.data.get(f.base + "/git/commits/" + f.request.candidate.sha).tree.sha = "e".repeat(40) }, /source tree mismatch/],
  ["edited comment", (f) => { f.comment("migration").body += "\nchanged" }, /source changed/],
  ["wrong author", (f) => { f.comment("release").user.login = "unrelated" }, /author changed/],
  ["unassociated author", (f) => { f.comment("release").author_association = "NONE" }, /not associated/],
  ["wrong source issue", (f) => { f.comment("release").issue_url = "https://api.github.com/repos/" + repository + "/issues/1" }, /another issue/],
  ["wrong role", (f) => f.changePin("release", (pin) => { pin.role = "migration" }), /one unambiguous pin/],
  ["nonconfirmation", (f) => f.changePin("migration", (pin) => { pin.decision = "pending" }), /not a packaging pin/],
  ["wrong candidate", (f) => f.changePin("migration", (pin) => { pin.candidateSha = "e".repeat(40) }), /candidate mismatch/],
  ["wrong owner", (f) => f.changePin("migration", (pin) => { pin.owner = "another-role" }), /owner declaration mismatch/],
  ["unknown operator", (f) => f.changePin("release", (pin) => { delete pin.operator }), /operator declaration mismatch/],
  ["production cutover", (f) => { f.request.productionCutover = true }, /must not authorize production/],
  ["foreign URL", (f) => { f.request.acknowledgements.release.url = "https://attacker.invalid/comment" }, /only repository/],
  ["shared confirmation", (f) => { f.request.acknowledgements.release.url = f.request.acknowledgements.migration.url }, /separate original/],
  ["producer predates final ACK", (f) => { f.comment("release").updated_at = "2026-01-01T11:30:00Z" }, /started before/],
  ["wrong producing attempt", (f) => { f.data.get(f.base + "/actions/jobs/44").run_attempt = 1 }, /another attempt/],
  ["wrong producer workflow", (f) => { f.data.get(f.base + "/actions/runs/33/attempts/2").path = ".github/workflows/other.yml" }, /workflow path mismatch/],
  ["different triggering operator", (f) => { f.data.get(f.base + "/actions/runs/33/attempts/2").triggering_actor.login = "unconfirmed-operator" }, /confirmed Release operator/],
  ["missing operator metadata", (f) => { const run = f.data.get(f.base + "/actions/runs/33/attempts/2"); delete run.triggering_actor; delete run.actor }, /confirmed Release operator/],
  ["failed job", (f) => { f.data.get(f.base + "/actions/jobs/44").conclusion = "failure" }, /did not succeed/],
  ["wrong check run", (f) => { f.data.get(f.base + "/actions/jobs/44").check_run_url += "0" }, /check-run mismatch/],
  ["artifact from another run", (f) => { f.data.get(f.base + "/actions/artifacts/66").workflow_run.id = 34 }, /another run/],
  ["expired artifact", (f) => { f.data.get(f.base + "/actions/artifacts/66").expired = true }, /expired/],
  ["wrong ZIP digest", (f) => { f.data.get(f.base + "/actions/artifacts/66").digest = "sha256:" + "e".repeat(64) }, /ZIP digest mismatch/],
  ["artifact outside job", (f) => { f.data.get(f.base + "/actions/artifacts/66").created_at = "2026-01-01T12:10:00Z" }, /not produced during/],
  ["oversized artifact", (f) => { f.data.get(f.base + "/actions/artifacts/66").size_in_bytes = 4 * 1024 ** 3 }, /exceeds limit/]
]) {
  test("refuses " + name, async () => {
    const f = fixture()
    change(f)
    await assert.rejects(verifyAdmission(f.request, f.api), message)
  })
}

test("a request containing SHAs and a copied status is not a role confirmation", async () => {
  const f = fixture()
  const comment = f.comment("migration")
  comment.body = "Ainda não confirmo C " + f.request.candidate.sha + " árvore " + f.request.candidate.tree
  f.request.acknowledgements.migration.bodySha256 = digest(comment.body)
  f.request.status = "VERIFIED_SOURCE"
  await assert.rejects(verifyAdmission(f.request, f.api), /one unambiguous pin/)
  assert.equal(f.calls.some((path) => path.includes("/actions/")), false)
})

test("existing textual ACK can be bound without asking its author to approve again", async () => {
  const f = fixture()
  const ack = f.request.acknowledgements.migration
  const source = f.comment("migration")
  source.body = "Migração: confirmo o candidato " + f.request.candidate.sha + " e árvore " + f.request.candidate.tree + " para empacotamento."
  ack.format = "textual"
  ack.statement = source.body
  ack.bodySha256 = digest(source.body)
  const original = JSON.parse(f.comment("release").body)
  const attestation = {
    ...original, schema: "sf-g07-pin-attestation-v1", role: "migration", owner: ack.owner,
    source: { url: ack.url, bodySha256: ack.bodySha256, authorLogin: ack.authorLogin,
      statementSha256: digest(ack.statement) }
  }
  delete attestation.operator
  const body = JSON.stringify(attestation)
  ack.attestation = { url: "https://github.com/" + repository + "/pull/628#issuecomment-333",
    bodySha256: digest(body), authorLogin: "gustavomhss" }
  f.data.set(f.base + "/issues/comments/333", {
    id: 333, html_url: ack.attestation.url, issue_url: "https://api.github.com/repos/" + repository + "/issues/628",
    body, user: { login: "gustavomhss" }, author_association: "OWNER",
    created_at: "2026-01-01T10:20:00Z", updated_at: "2026-01-01T10:20:00Z"
  })
  const result = await verifyAdmission(f.request, f.api)
  assert.equal(result.acknowledgements.migration.roleConfirmation.status, "TEXTUAL_CONFIRMATION_ATTESTED")
  assert.equal(result.acknowledgements.migration.source.statementSha256, digest(source.body))
  f.data.get(f.base + "/issues/comments/333").body = body.replace(ack.bodySha256, "f".repeat(64))
  ack.attestation.bodySha256 = digest(f.data.get(f.base + "/issues/comments/333").body)
  await assert.rejects(verifyAdmission(f.request, f.api), /exact existing original confirmation/)
})

test("API failure stops qualification instead of creating a source receipt", async () => {
  const f = fixture()
  await assert.rejects(verifyAdmission(f.request, async () => { throw new Error("source unavailable") }), /source unavailable/)
})


// Synthetic GitHub source controls. These fixtures do not produce a tar or an installed receipt.
function pinRequest(f, value, kind, revision = "f".repeat(40)) {
  const path = "docs/qa/sucafina/go-live/" + (kind === "build" ? "g07-build-request.json" : "g07-request.json")
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n")
  const content = {
    type: "file", path, encoding: "base64", size: bytes.length, content: bytes.toString("base64"),
    sha: createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex")
  }
  const contentPath = f.base + "/contents/" + path + "?ref=" + revision
  f.data.set(f.base + "/git/commits/" + revision, { sha: revision, tree: { sha: "e".repeat(40) } })
  f.data.set(contentPath, content)
  return { revision, content, contentPath }
}

function buildFixture() {
  const f = fixture()
  const build = {
    schema: "sf-g07-build-request-v1", candidate: f.request.candidate,
    acknowledgements: f.request.acknowledgements, productionCutover: false
  }
  const pinned = pinRequest(f, build, "build")
  const context = {
    repository, eventName: "push", ref: "refs/heads/release-build-" + pinned.revision,
    sha: build.candidate.sha, tree: build.candidate.tree,
    runId: "33", runAttempt: "2", jobId: "44", checkRunId: "55"
  }
  Object.assign(f.data.get(f.base + "/actions/runs/33/attempts/2"), {
    head_sha: context.sha, head_branch: context.ref.slice("refs/heads/".length),
    path: ".github/workflows/g09-final.yml", event: "push", status: "in_progress", conclusion: null
  })
  Object.assign(f.data.get(f.base + "/actions/jobs/44"), {
    head_sha: context.sha, status: "in_progress", conclusion: null
  })
  return { ...f, build, context, pinned,
    repin: () => pinRequest(f, build, "build"),
    run: () => f.data.get(f.base + "/actions/runs/33/attempts/2"),
    job: () => f.data.get(f.base + "/actions/jobs/44") }
}

test("build admission observes immutable request bytes, actual C/T and the active producer before any artifact exists", async () => {
  const f = buildFixture()
  const result = await verifyBuildAdmission(f.context, f.api)
  assert.equal(result.schema, "sf-g07-build-admission-v1")
  assert.equal(result.status, "VERIFIED_SOURCE")
  assert.deepEqual(result.candidate, f.build.candidate)
  assert.equal(result.requestSource.revision, f.pinned.revision)
  assert.equal(result.requestSource.blobSha, f.pinned.content.sha)
  assert.equal(result.requestSource.sha256, digest(Buffer.from(f.pinned.content.content, "base64")))
  assert.equal(result.producer.workflowSha, f.context.sha)
  assert.equal(result.producer.operatorLogin, "qa-test-fixture")
  assert.equal(result.acknowledgements.migration.source.authorLogin, result.acknowledgements.release.source.authorLogin)
  assert.match(result.acknowledgements.release.roleConfirmation.identityLimit, /identities are not inferred/)
  assert.equal(result.productionCutover, false)
  assert.equal(result.installation, null)
  assert.equal(f.calls.some((path) => path.includes("/actions/artifacts/")), false)
})

for (const [name, change, message] of [
  ["floating request ref", (f) => { f.context.ref = "refs/heads/release-build-dev" }, /exact immutable request branch/],
  ["foreign Actions repository", (f) => { f.context.repository = "other/repo" }, /Actions repository/],
  ["non-push request", (f) => { f.context.eventName = "workflow_dispatch" }, /push event/],
  ["request commit replacement", (f) => { f.data.get(f.base + "/git/commits/" + f.pinned.revision).sha = "d".repeat(40) }, /request commit mismatch/],
  ["wrong request file", (f) => { f.pinned.content.path = "other.json" }, /file identity/],
  ["request byte truncation", (f) => { f.pinned.content.size += 1 }, /byte count mismatch/],
  ["noncanonical base64", (f) => { f.pinned.content.content += "!" }, /noncanonical request encoding/],
  ["request blob substitution", (f) => { f.pinned.content.sha = "0".repeat(40) }, /Git blob mismatch/],
  ["oversized request", (f) => { f.pinned.content.size = 131073 }, /request byte limit/],
  ["missing migration ACK", (f) => { delete f.build.acknowledgements.migration; f.repin() }, /object required/],
  ["shared original ACK", (f) => { f.build.acknowledgements.release.url = f.build.acknowledgements.migration.url; f.repin() }, /separate original/],
  ["missing role declaration", (f) => { f.changePin("release", (pin) => { delete pin.role }); f.repin() }, /one unambiguous pin/],
  ["requested production cutover", (f) => { f.build.productionCutover = true; f.repin() }, /must not authorize production/],
  ["premature producer claim", (f) => { f.build.producer = f.request.producer; f.repin() }, /must not claim a completed producer/],
  ["branch outside C", (f) => { f.context.sha = "c".repeat(40) }, /build branch candidate mismatch/],
  ["checkout outside T", (f) => { f.context.tree = "c".repeat(40) }, /checkout tree mismatch/],
  ["source tree changed", (f) => { f.data.get(f.base + "/git/commits/" + f.context.sha).tree.sha = "c".repeat(40) }, /source tree mismatch/],
  ["producer from another C", (f) => { f.run().head_sha = "c".repeat(40) }, /producer source mismatch/],
  ["producer from another B", (f) => { f.run().head_branch = "release-build-" + "d".repeat(40) }, /request branch mismatch/],
  ["producer from another repository", (f) => { f.run().repository.full_name = "other/repo" }, /producer repository mismatch/],
  ["producer event mismatch", (f) => { f.run().event = "pull_request" }, /producer event mismatch/],
  ["producer workflow replacement", (f) => { f.run().path = ".github/workflows/other.yml" }, /workflow path mismatch/],
  ["different actual operator", (f) => { f.run().triggering_actor.login = "unconfirmed" }, /confirmed Release operator/],
  ["producer completed already", (f) => { f.run().status = "completed" }, /run is not active/],
  ["job from another attempt", (f) => { f.job().run_attempt = 1 }, /another attempt/],
  ["job from another C", (f) => { f.job().head_sha = "c".repeat(40) }, /job source mismatch/],
  ["another producer job", (f) => { f.job().name = "other-job" }, /unexpected producer job/],
  ["job check-run replacement", (f) => { f.job().check_run_url += "0" }, /check-run mismatch/],
  ["job no longer active", (f) => { f.job().status = "completed" }, /job is not active/],
  ["job already concluded", (f) => { f.job().conclusion = "success" }, /already concluded/],
  ["ACK later than producer start", (f) => { f.comment("release").updated_at = "2026-01-01T11:01:00Z" }, /started before both/]
]) {
  test("pre-build admission refuses " + name, async () => {
    const f = buildFixture()
    change(f)
    await assert.rejects(verifyBuildAdmission(f.context, f.api), message)
  })
}

test("two actually declared roles can share the owner and GitHub account without inventing separate identities", async () => {
  const f = buildFixture()
  for (const role of ["migration", "release"]) {
    f.build.acknowledgements[role].owner = "jointly-delegated-test-fixture"
    f.changePin(role, (pin) => { pin.owner = "jointly-delegated-test-fixture" })
  }
  f.repin()
  const result = await verifyBuildAdmission(f.context, f.api)
  assert.equal(result.acknowledgements.migration.roleConfirmation.owner,
    result.acknowledgements.release.roleConfirmation.owner)
  assert.notEqual(result.acknowledgements.migration.source.url, result.acknowledgements.release.source.url)
})

test("pre-tar recheck reads original ACKs again and refuses an edit after initial admission", async () => {
  const f = buildFixture()
  const first = await verifyBuildAdmission(f.context, f.api)
  const final = await verifyBuildAdmission(f.context, f.api)
  first.verifier = { workflowSha: f.context.sha, observedAt: "2026-01-01T11:01:00Z" }
  final.verifier = { workflowSha: f.context.sha, observedAt: "2026-01-01T11:02:00Z" }
  sameAdmission(first, final)
  f.comment("migration").body += "\nEdited while compiling."
  await assert.rejects(verifyBuildAdmission(f.context, f.api), /source changed/)
  final.requestSource.sha256 = "0".repeat(64)
  assert.throws(() => sameAdmission(first, final), /live source changed/)
})

test("qualifier request branch must point to C while request B remains independently pinned", async () => {
  const f = fixture()
  const pinned = pinRequest(f, f.request, "qualify")
  const context = {
    repository, eventName: "push", ref: "refs/heads/g07-qualify-" + pinned.revision,
    sha: f.request.candidate.sha
  }
  const loaded = await readQualificationRequest(context, f.api)
  assert.equal(loaded.request.candidate.sha, context.sha)
  assert.equal(loaded.source.revision, pinned.revision)
  assert.equal(loaded.source.blobSha, pinned.content.sha)
  await assert.rejects(readQualificationRequest({ ...context, sha: "e".repeat(40) }, f.api),
    /branch must point to the exact candidate/)
  assert.throws(() => requestRevision("qualify", { ...context, ref: "refs/heads/g07-qualify-dev" }),
    /exact immutable request branch/)
})

test("existing manual qualification remains constrained to dev and a full immutable request SHA", async () => {
  const f = fixture()
  const pinned = pinRequest(f, f.request, "qualify")
  const context = {
    repository, eventName: "workflow_dispatch", ref: "refs/heads/dev", requestRevision: pinned.revision
  }
  const loaded = await readQualificationRequest(context, f.api)
  assert.equal(loaded.source.revision, pinned.revision)
  assert.throws(() => requestRevision("qualify", { ...context, ref: "refs/heads/other" }), /requires dev/)
  assert.throws(() => requestRevision("qualify", { ...context, requestRevision: "dev" }), /invalid digest/)
})

test("request loading rejects invalid UTF-8 even if byte count and Git blob match", async () => {
  const f = fixture()
  const pinned = pinRequest(f, f.request, "qualify")
  const bytes = Buffer.from([0xff])
  Object.assign(pinned.content, {
    size: bytes.length, content: bytes.toString("base64"),
    sha: createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex")
  })
  await assert.rejects(readPinnedRequest(pinned.revision, "qualify", f.api), /encoded data was not valid/)
})
