/**
 * SF native UI plan preflight through the EXISTING test-ci GitHub Actions workflow.
 * Submit only via the authorized test:ci path; do not run this on developer machines.
 * This is documentary validation, NOT installed product qualification and never grants GO.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const nativeUi = path.resolve(here, "../..");
const execution = path.resolve(nativeUi, "execution");
const campaign = path.resolve(nativeUi, "../../sf2h-plan/campaign.json");
const expectedCanonicalBlob = "71b56906f8bb190c4d568f60c7511ce1ff63d5f3";
const canonicalCommit = "dbf9547211d9b0fade619790de7c19c0869b7c7d";
const canonicalRepoPath = "modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json";
let resolvedCanonicalPath;
function gitBlobSha(bytes) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function preparePinnedCampaign() {
  requireActions();
  if (resolvedCanonicalPath) return resolvedCanonicalPath;
  if (existsSync(campaign)) {
    const bytes = readFileSync(campaign);
    assert.equal(gitBlobSha(bytes), expectedCanonicalBlob, "checked-out canonical content differs from pinned Git blob");
    resolvedCanonicalPath = campaign;
    return resolvedCanonicalPath;
  }
  const root = process.env.GITHUB_WORKSPACE;
  assert.ok(root && existsSync(path.join(root, ".git")), "GitHub Actions checkout with authenticated origin is required");
  const opts = { cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024 };
  console.log(`::group::Fetch immutable canonical ${canonicalCommit}`);
  const fetch = spawnSync("git", ["fetch", "--no-tags", "--depth=1", "origin", canonicalCommit], opts);
  if (fetch.stderr) process.stderr.write(fetch.stderr);
  assert.ifError(fetch.error);
  assert.equal(fetch.status, 0, "Actions git fetch of the exact immutable canonical commit failed");
  const show = spawnSync("git", ["show", `${canonicalCommit}:${canonicalRepoPath}`], {
    cwd: root, encoding: null, timeout: 120_000, maxBuffer: 128 * 1024 * 1024,
  });
  assert.ifError(show.error);
  assert.equal(show.status, 0, "canonical blob not found in pinned commit");
  assert.ok(Buffer.isBuffer(show.stdout) && show.stdout.length > 0, "canonical blob is empty");
  assert.equal(gitBlobSha(show.stdout), expectedCanonicalBlob, "canonical Git blob mismatch: fail closed");
  const dir = mkdtempSync(path.join(tmpdir(), "sf-native-pinned-campaign-"));
  resolvedCanonicalPath = path.join(dir, "campaign.json");
  writeFileSync(resolvedCanonicalPath, show.stdout, { mode: 0o600 });
  console.log(`Pinned blob ${expectedCanonicalBlob} verified; ${show.stdout.length} bytes`);
  console.log("::endgroup::");
  return resolvedCanonicalPath;
}

function requireActions() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "This preflight may run ONLY inside GitHub Actions");
  assert.match(process.env.GITHUB_SHA ?? "", /^[0-9a-f]{40}$/, "real Actions snapshot SHA required");
  assert.ok((process.env.GITHUB_REF_NAME ?? "").startsWith("ci-run-linux-"), "use the canonical Linux CI lane");
  const source = JSON.parse(readFileSync(path.join(here, "dispatch.json"), "utf8")).source;
  assert.equal(source.repository, "gustavomhss/Orchestra-SF");
  assert.equal(source.branch, "ux-20-dispatch");
  assert.equal(source.pull_request, 99);
}

function invokePython(label, args) {
  requireActions();
  console.log(`::group::UX20 ${label} / source ${process.env.GITHUB_SHA}`);
  const outcome = spawnSync("python3", args, {
    cwd: nativeUi,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 24 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUNBUFFERED: "1" },
  });
  if (outcome.stdout) process.stdout.write(outcome.stdout);
  if (outcome.stderr) process.stderr.write(outcome.stderr);
  console.log("::endgroup::");
  assert.ifError(outcome.error);
  assert.equal(outcome.signal, null, `${label} signal: ${outcome.signal}`);
  assert.equal(outcome.status, 0, `${label} FAILED, exit ${outcome.status}; do not relax validators or criteria`);
  return outcome;
}

test("UX20 dispatch: 20 exact bounded cards and no launch authorization", { timeout: 200_000 }, () => {
  const result = invokePython("dispatch", [
    path.join(execution, "parallel-20", "validate_dispatch.py"),
    "--root", execution,
  ]);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "DOCUMENTARY_DISPATCH_STRUCTURE_PASS");
  assert.deepEqual(report.errors, []);
  assert.equal(report.first_wave_lanes, 20);
  assert.equal(report.work_orders, 78);
  assert.equal(report.operations, 305);
  assert.equal(report.surfaces, 70);
  assert.equal(report.authorized_to_write_product, false);
  assert.equal(report.product_test_status, "NOT_RUN");
});

test("UX20 strict: original 1610 canonical criteria and both graphs", { timeout: 200_000 }, () => {
  const result = invokePython("strict canonical", [
    path.join(execution, "validate_plan.py"),
    "--root", execution, "--strict", "--canonical", preparePinnedCampaign(),
  ]);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "PASS_DOCUMENT_STRUCTURE");
  assert.equal(report.strict, true);
  assert.deepEqual(report.errors, []);
  assert.equal(report.work_orders, 78);
  assert.equal(report.contract_operations, 305);
  assert.equal(report.canonical.indexed, 1610);
  assert.equal(report.canonical.resolved, 1610);
  assert.equal(report.canonical.matching, 1610);
  assert.equal(report.canonical.referenced_tasks, 74);
  assert.equal(report.canonical.git_blob, expectedCanonicalBlob);
  assert.equal(report.product_tests_executed, false);
});

test("UX20 adversarial: all 12 launch-input regressions", { timeout: 200_000 }, () => {
  const result = invokePython("12 adversarial cases", [
    "-m", "unittest", "discover",
    "-s", path.join(execution, "parallel-20"),
    "-p", "test_*.py", "-v",
  ]);
  assert.match(result.stderr, /Ran 12 tests\b/);
  assert.match(result.stderr, /\bOK\b/);
});
