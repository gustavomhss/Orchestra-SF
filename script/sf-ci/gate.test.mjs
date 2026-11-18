import { test } from "node:test"
import { assertWorkflowManifestSelection } from "./workflow-contract.mjs"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { SHARDED, shardFiles, countBunReport, countPlaywrightReport, minimalPlaywrightEvidence, verifyAll, REQUIRED, validateManifest, requiredSelection, requirePrerequisites, releaseOnlySelection, bunCoverageIdentity, playwrightCoverageIdentity, checkCoverageBaseline, sha256Lines, selectSuiteFiles } from "./gate.mjs"

const report = Buffer.from(JSON.stringify({ status: "PASS",
  counts: { tests: 2, product_executed: 2, failures: 0, errors: 0, skipped: 0 },
  cases: ["first real test", "second real test"].map((name) => ({
    name, classname: "", file: "test/sf-authorized-sample.test.ts",
    failures: 0, errors: 0, skipped: 0, executed: 1, product_executed: 1,
  })),
}))
const digest = createHash("sha256").update(report).digest("hex")
const sha = "a".repeat(40)
const runId = "123"
const attempt = "1"
const treeSha = "c".repeat(40)
// Keep fixture paths identical to the normative suites.json topology.
const suiteDirectories = {
  "CI-SF": "modules/sucafina",
  "CI-CLI": "apps/cli",
  "CI-APP-SRC": "packages/app-shell",
  "CI-APP-BROWSER": "packages/app-shell",
  "CI-ATLAS-BUSINESS": "modules/atlas/boundary",
}
const manifest = {
  schemaVersion: 1, product: "Orchestra-SF", target: { os: "Linux", arch: "X64" },
  suites: REQUIRED.map((id) => id.startsWith("CI-UI-")
    ? { id, kind: "playwright", directory: "packages/app-shell", specFile: "e2e/sucafina/" + id.split("-").at(-1).toLowerCase() + ".spec.ts" }
    : { id, kind: "bun", directory: suiteDirectories[id],
      ...(id === "CI-APP-BROWSER"
        ? { selection: { kind: "directory", testDirectory: "test-browser/sucafina-native",
            releaseOnlyFiles: ["test-browser/sucafina-native/transport-integration.test.ts"] } }
        : {}),
      ...(id === "CI-SF"
        ? { selection: { kind: "full-except-release-only", testDirectory: ".",
            releaseOnlyFiles: ["Sucafinav1/test/parity-pitr.test.ts"] } }
        : {}),
      ...(id === "CI-APP-SRC" ? { selection: { kind: "directory", testDirectory: "src" } } : {}),
      ...(id === "CI-CLI" || id === "CI-ATLAS-BUSINESS"
        ? { selection: { kind: "explicit", testFiles: ["test/sf-authorized-sample.test.ts"] } }
        : {}),
    }),
  separateReleaseProofs: ["AM01","AM02","AM03","AM04","AM05","AM06"],
}
function playwright(suite) {
  const data = {
    suites: [{ file: suite.specFile, specs: [{
      id: "case-source-id", title: "case source title",
      idHash: createHash("sha256").update("case-source-id").digest("hex"),
      tests: [{ expectedStatus: "passed", results: [{ status: "passed" }] }],
    }] }],
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
  }
  return Buffer.from(JSON.stringify(data))
}
const CI_SF_FILES = Array.from({ length: 8 }, (_, index) => `test/sf-shard-${index + 1}.test.ts`)
const bunReport = (files) => Buffer.from(JSON.stringify({ status: "PASS",
  counts: { tests: files.length, product_executed: files.length, failures: 0, errors: 0, skipped: 0 },
  cases: files.map((file) => ({ name: "case " + file, classname: "", file,
    failures: 0, errors: 0, skipped: 0, executed: 1, product_executed: 1 })),
}))
const fixtureSelection = (id) => id === "CI-SF" ? CI_SF_FILES
  : id.startsWith("CI-UI-") ? [manifest.suites.find((s) => s.id === id).specFile]
    : ["test/sf-authorized-sample.test.ts"]
// Synthetic fixture is independently versioned; production baselines cite an authentic Actions artifact.
for (const suite of manifest.suites) {
  const bytes = suite.kind === "playwright" ? playwright(suite)
    : suite.id === "CI-SF" ? bunReport(CI_SF_FILES) : report
  const inventory = suite.kind === "bun"
    ? bunCoverageIdentity(bytes.toString("utf8"))
    : playwrightCoverageIdentity(bytes.toString("utf8"), suite.specFile)
  suite.coverageBaseline = {
    schemaVersion: 1, status: "HISTORIC_SUCCESSFUL_ARTIFACT",
    minimumCases: inventory.cases, minimumFiles: inventory.fileCount,
    casesSha256: inventory.casesSha256, filesSha256: inventory.filesSha256,
  }
}
function receiptFor(suite, bytes, selection, extra = {}) {
  const inventory = suite.kind === "bun"
    ? bunCoverageIdentity(bytes.toString("utf8"))
    : playwrightCoverageIdentity(bytes.toString("utf8"), suite.specFile)
  return {
    schemaVersion: 1, suiteId: suite.id, kind: suite.kind, status: "PASS",
    exitCode: 0, sourceSha: sha, checkoutSha: sha, runId, attempt,
    treeSha, manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    runnerOS: "Linux", runnerArch: "X64", executedTests: inventory.cases,
    executedFiles: inventory.fileCount, selectedFilesSha256: sha256Lines(selection),
    coverageFilesSha256: inventory.filesSha256, coverageCaseSha256: inventory.casesSha256,
    reportSha256: createHash("sha256").update(bytes).digest("hex"), ...extra,
  }
}
function fixture() {
  const reports = {}
  const receipts = {}
  const shards = {}
  for (const suite of manifest.suites) {
    const selection = fixtureSelection(suite.id)
    if (SHARDED[suite.id]) {
      const count = SHARDED[suite.id]
      shards[suite.id] = Array.from({ length: count }, (_, offset) => {
        const part = shardFiles(selection, offset + 1, count)
        const bytes = bunReport(part)
        return { report: bytes,
          receipt: receiptFor(suite, bytes, part, { shard: { index: offset + 1, count } }) }
      })
      continue
    }
    const bytes = suite.kind === "bun" ? report : playwright(suite)
    reports[suite.id] = bytes
    receipts[suite.id] = receiptFor(suite, bytes, selection)
  }
  const needs = Object.fromEntries(["preflight","static","omni","unit","unit-sf","ui"].map((name) => [name, { result: "success" }]))
  return { manifest: structuredClone(manifest), reports, receipts, shards, needs, sha, runId, attempt, treeSha,
    selectionProvider: (_manifest, id) => fixtureSelection(id) }
}
test("eight normative suites and six independent AM proofs remain explicit", () => {
  assert.equal(validateManifest(manifest).length, 8)
  assert.equal(verifyAll(fixture()).suiteCount, 8)
})
test("removed/duplicate/invalid SF host selections never pass manifest admission", () => {
  for (const files of [[], ["test/duplicate.test.ts", "test/duplicate.test.ts"], ["../escape.test.ts"], ["test/windows.exe"]]) {
    const invalid = structuredClone(manifest)
    invalid.suites.find((s) => s.id === "CI-CLI").selection.testFiles = files
    assert.throws(() => validateManifest(invalid), /SF_CI_FAIL_CLOSED/)
  }
})
test("Playwright artifact evidence retains only admission data and never raw attachments/secrets", () => {
  const suite = manifest.suites[5]
  const original = JSON.parse(playwright(suite).toString("utf8"))
  const secret = "SENSITIVE_ONLY_IN_RAW_PLAYWRIGHT_REPORT"
  original.suites[0].title = secret
  original.suites[0].specs[0].tests[0].results[0].stdout = [secret]
  original.suites[0].specs[0].tests[0].results[0].attachments = [{ name: secret, body: secret }]
  original.metadata = { token: secret }
  const sanitized = minimalPlaywrightEvidence(JSON.stringify(original), suite.specFile)
  assert.equal(countPlaywrightReport(sanitized, suite.specFile), 1)
  assert.equal(sanitized.includes(secret), false)
  assert.equal(sanitized.includes("attachments"), false)
})
test("removing or widening the installed SF browser selection fails closed", () => {
  for (const testDirectory of [undefined, "", "test-browser", "test-browser/other"]) {
    const invalid = structuredClone(manifest)
    invalid.suites.find((s) => s.id === "CI-APP-BROWSER").selection.testDirectory = testDirectory
    assert.throws(() => validateManifest(invalid), /SF_CI_FAIL_CLOSED/)
  }
})
test("CI workflow has one automatic trigger and preserves exhaustive green coverage", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/sf-ci.yml", import.meta.url), "utf8")
  assert.match(workflow, /^  pull_request:/m)
  assert.doesNotMatch(workflow, /^  push:/m)
  // CI-SF must execute the full selected inventory even after earlier failures.
  // This is stricter than the legacy bail check: keep exact selectors/reporter
  // and reject bail/skip flags that would hide late authorization regressions.
  const ciSf = workflow.match(/^  unit-sf:\n([\s\S]*?)^  ui:/m)?.[1]
  assert.ok(ciSf, "CI-SF shard job must exist")
  assert.match(ciSf, /bun test --timeout 30000\s*\\\s*--reporter=junit/)
  assert.match(ciSf, /"\$\{files\[@\]\}"/)
  assert.match(ciSf, /SF_SHARD_COUNT: "4"/)
  assert.doesNotMatch(ciSf, /--bail(?:=|\s|$)|--only-failures|--pass-with-no-tests/)
  // The unrelated app-browser fail-fast policy remains unchanged.
  assert.match(workflow, /CI-APP-BROWSER\)[\s\S]*?--bail=5/)
  const realManifest = JSON.parse(readFileSync(new URL("../../sf/ci/suites.json", import.meta.url), "utf8"))
  assertWorkflowManifestSelection(workflow, realManifest)
  assert.match(workflow, /--max-failures=2/)
  assert.doesNotMatch(workflow, /--pass-with-no-tests|continue-on-error: true|--retry\s+[1-9]/)
})
// A6 consumes this test-defined wiring contract in .github/workflows/sf-ci.yml.
// The positive fixture is intentionally independent from the live workflow:
// negative mutations must pass even while A6's YAML still needs updating.
function manifestWiredWorkflowFixture(actualManifest) {
  const buns = actualManifest.suites.filter((suite) => suite.kind === "bun")
  const single = buns.filter((suite) => !SHARDED[suite.id])
  const sharded = buns.filter((suite) => SHARDED[suite.id])
  const ui = actualManifest.suites.filter((suite) => suite.kind === "playwright")
  const arms = single.map((suite) => [
    `              ${suite.id})`,
    `                cd "$root/${suite.directory}"`,
    `                bun test ${suite.id === "CI-APP-BROWSER" ? "--conditions=browser" : "--timeout 30000"} --bail=5 "${'${files[@]}'}" --reporter=junit "--reporter-outfile=$evidence/report.xml"`,
    "                ;;",
  ].join("\n")).join("\n")
  const selected = [
    '          node script/sf-ci/gate.mjs select > "$evidence/selection.txt" || exit $?',
    '          mapfile -t files < "$evidence/selection.txt"',
  ].join("\n")
  const prefix = [
    '          root="$GITHUB_WORKSPACE"',
    '          evidence="$root/sf-ci-evidence/$SF_SUITE_ID"',
    selected,
  ].join("\n")
  return [
    "name: sf-ci", "on:", "  pull_request:", "    branches: [close-final-candidate]", "jobs:",
    "  unit:", "    strategy:", "      matrix:",
    `        id: [${single.map((suite) => suite.id).join(", ")}]`,
    "    env:", '      SF_SUITE_ID: ${{ matrix.id }}',
    "    steps:", "      - name: test", "        run: |", prefix,
    '          test "${#files[@]}" -gt 0 || exit 2',
    '          case "$SF_SUITE_ID" in', arms, '              *) exit 2 ;;', "          esac",
    ...sharded.map((suite) => {
      const count = SHARDED[suite.id]
      return [
        "  unit-sf:", "    strategy:", "      matrix:",
        `        shard: [${Array.from({ length: count }, (_, offset) => offset + 1).join(", ")}]`,
        "    env:", `      SF_SUITE_ID: ${suite.id}`,
        "      SF_SHARD_INDEX: ${{ matrix.shard }}", `      SF_SHARD_COUNT: "${count}"`,
        "    steps:", "      - name: test", "        run: |",
        '          root="$GITHUB_WORKSPACE"',
        '          evidence="$root/sf-ci-evidence/$SF_SUITE_ID-shard-$SF_SHARD_INDEX"',
        selected,
        '          test "${#files[@]}" -gt 0 || exit 2',
        `          cd "$root/${suite.directory}"`,
        `          bun test --timeout 30000 "\${files[@]}" --reporter=junit "--reporter-outfile=$evidence/report.xml"`,
      ].join("\n")
    }),
    "  ui:", "    strategy:", "      matrix:", "        include:",
    ...ui.map((suite) => `          - id: ${suite.id}`),
    "    env:", '      SF_SUITE_ID: ${{ matrix.id }}',
    "    steps:", "      - name: test", "        run: |", prefix,
    '          test "${#files[@]}" -eq 1 || exit 2',
    '          cd "$root/packages/app-shell"',
    '          bun run test:e2e:local "${files[0]}" --config e2e/playwright.production.config.ts --workers 1 --retries 0 --max-failures=2',
    "",
  ].join("\n")
}

test("manifest-to-YAML contract accepts all five Bun and three UI suites when selectors drive argv", () => {
  const actual = JSON.parse(readFileSync(new URL("../../sf/ci/suites.json", import.meta.url), "utf8"))
  const workflow = manifestWiredWorkflowFixture(actual)
  const selected = assertWorkflowManifestSelection(workflow, actual)
  assert.deepEqual(selected.bun, actual.suites.filter((suite) => suite.kind === "bun").map((suite) => suite.id))
  assert.deepEqual(selected.playwright, actual.suites.filter((suite) => suite.kind === "playwright").map((suite) => suite.id))
})

test("manifest-to-YAML negative mutations refuse missing selector, missing suites and hardcoded execution", () => {
  const actual = JSON.parse(readFileSync(new URL("../../sf/ci/suites.json", import.meta.url), "utf8"))
  const good = manifestWiredWorkflowFixture(actual)
  const selector = 'node script/sf-ci/gate.mjs select > "$evidence/selection.txt" || exit $?'
  const hardcodeInBrowser = (value) => {
    const at = good.indexOf("              CI-APP-BROWSER)")
    assert.ok(at > 0, "fixture browser arm exists")
    return good.slice(0, at) + good.slice(at).replace('"${files[@]}"', value)
  }
  const failCases = [
    ["missing Bun selector", good.replace(selector, "echo omitted-bun-selector")],
    ["CI-SF early bail hides late consent tests", good.replace('bun test --timeout 30000 "${files[@]}"', 'bun test --timeout 30000 --bail=5 "${files[@]}"')],
    ["CI-SF shard count drift", good.replace('SF_SHARD_COUNT: "4"', 'SF_SHARD_COUNT: "3"')],
    ["missing UI selector", good.slice(0, good.lastIndexOf(selector)) + good.slice(good.lastIndexOf(selector)).replace(selector, "echo omitted-ui-selector")],
    ["missing CI-APP-BROWSER matrix ID", good.replace(", CI-APP-BROWSER", "")],
    ["missing CI-UI-DECISIONS manifest suite", good.replace("          - id: CI-UI-DECISIONS\n", "")],
    ["missing browser dispatch arm", good.replace(/\n {14}CI-APP-BROWSER\)[\s\S]*?\n {16};;/, "")],
    ["browser hardcoded directory", hardcodeInBrowser('"./test-browser/sucafina-native"')],
    ["browser hardcoded file", hardcodeInBrowser('"test-browser/sucafina-native/transport-contract.test.ts"')],
    ["hardcoded file appended to selected array", hardcodeInBrowser('"${files[@]}" "test-browser/sucafina-native/one.test.ts"')],
    ["hardcoded selection overrides mapfile", good.replace('mapfile -t files < "$evidence/selection.txt"', 'mapfile -t files < "$evidence/selection.txt"\n          files=("test/fake.test.ts")')],
    ["hardcoded Playwright spec", good.replace('"${files[0]}"', '"e2e/sucafina/operations.spec.ts"')],
    ["UI matrix.spec drift", good.replace("          - id: CI-UI-REPORTS", "          - id: CI-UI-REPORTS\n            spec: e2e/sucafina/reports.spec.ts")],
    ["old directory filtering", hardcodeInBrowser('"${files[@]}" --path-ignore-patterns=other')],
  ]
  assert.doesNotThrow(() => assertWorkflowManifestSelection(good, actual))
  for (const [name, broken] of failCases) {
    assert.notEqual(broken, good, "mutation must actually change the fixture: " + name)
    assert.throws(() => assertWorkflowManifestSelection(broken, actual), /SF_CI_WORKFLOW_SELECTION/, name)
  }
})

test("selected files are read only from the validated Linux SF manifest", () => {
  assert.deepEqual(requiredSelection(manifest, "CI-CLI"), ["test/sf-authorized-sample.test.ts"])
  assert.deepEqual(requiredSelection(manifest, "CI-ATLAS-BUSINESS"), ["test/sf-authorized-sample.test.ts"])
  assert.throws(() => requiredSelection(manifest, "CI-SF"), /SF_CI_FAIL_CLOSED/)
  assert.throws(() => requiredSelection(manifest, "CI-APP-BROWSER"), /SF_CI_FAIL_CLOSED/)
})
test("upstream failures list every failed, skipped or missing job, not only the first", () => {
  const data = fixture()
  data.needs.static.result = "failure"
  data.needs.unit.result = "cancelled"
  delete data.needs.ui
  assert.throws(() => requirePrerequisites(data.needs), /static=failure, unit=cancelled, ui=missing/)
  assert.equal(requirePrerequisites(fixture().needs), 6)
})
test("live installed and macOS-local recovery proofs are release-owned, never silently discarded", () => {
  assert.deepEqual(releaseOnlySelection(manifest, "CI-SF"), ["Sucafinav1/test/parity-pitr.test.ts"])
  assert.deepEqual(releaseOnlySelection(manifest, "CI-APP-BROWSER"),
    ["test-browser/sucafina-native/transport-integration.test.ts"])
  for (const id of ["CI-SF", "CI-APP-BROWSER"]) {
    const tampered = structuredClone(manifest)
    delete tampered.suites.find((s) => s.id === id).selection.releaseOnlyFiles
    assert.throws(() => releaseOnlySelection(tampered, id))
    assert.throws(() => validateManifest(tampered))
  }
})
test("the two relocated proofs remain explicitly blocked by the real Azure release boundary", () => {
  const releaseWorkflow = readFileSync(new URL("../../.github/workflows/sf-release.yml", import.meta.url), "utf8")
  assert.match(releaseWorkflow, /Sucafinav1\/test\/parity-pitr\.test\.ts/)
  assert.match(releaseWorkflow, /sucafina-native\/transport-integration\.test\.ts/)
  assert.match(releaseWorkflow, /AZURE_APP_ACTIVATION_NOT_COMPOSED/)
  assert.match(releaseWorkflow, /process\.exit\(1\)/)
})
test("Q01 two pure contracts remain in the PR suite while three F04 proofs stay release-only", () => {
  const base = new URL("../../packages/app-shell/test-browser/sucafina-native/", import.meta.url)
  const portable = readFileSync(new URL("transport-contract.test.ts", base), "utf8")
  const installed = readFileSync(new URL("transport-integration.test.ts", base), "utf8")
  for (const id of ["Q01-TRANSPORT-REGISTRY", "Q01-TRANSPORT-PILOT-ROUTES"]) {
    assert.match(portable, new RegExp(id))
    assert.doesNotMatch(installed, new RegExp(id))
  }
  for (const id of ["Q01-TRANSPORT-GUEST", "Q01-TRANSPORT-INVALID-OWNER", "Q01-TRANSPORT-STALE-FENCE"]) {
    assert.match(installed, new RegExp(id))
    assert.doesNotMatch(portable, new RegExp(id))
  }
  assert.match(installed, /readNativeManifest/)
  assert.doesNotMatch(portable, /readNativeManifest/)
})
test("zero product tests fail", () => {
  assert.throws(() => countBunReport(JSON.stringify({ status: "PASS", counts: { product_executed: 0, failures: 0, errors: 0, skipped: 0 } })))
})
test("Playwright testDir-relative file binds to exact manifest-selected spec without suffix bypass", () => {
  const suite = manifest.suites.find((item) => item.id === "CI-UI-OPERATIONS")
  const actual = JSON.parse(playwright(suite).toString("utf8"))
  actual.suites[0].file = suite.specFile.slice("e2e/".length)
  const received = JSON.stringify(actual)
  assert.equal(countPlaywrightReport(received, suite.specFile), 1)
  const minimized = minimalPlaywrightEvidence(received, suite.specFile)
  assert.deepEqual(playwrightCoverageIdentity(minimized, suite.specFile).files, [suite.specFile])
  for (const changedPath of ["sucafina/decisions.spec.ts", "other/sucafina/operations.spec.ts", "../sucafina/operations.spec.ts"]) {
    actual.suites[0].file = changedPath
    assert.throws(() => countPlaywrightReport(JSON.stringify(actual), suite.specFile), /SF_CI_FAIL_CLOSED/)
  }
})
test("playwright requires the exact requested spec and one clean execution", () => {
  const suite = manifest.suites[5]
  assert.equal(countPlaywrightReport(playwright(suite).toString(), suite.specFile), 1)
  assert.throws(() => countPlaywrightReport(playwright(suite).toString(), "e2e/sucafina/other.spec.ts"))
})
const mutations = [
  ["missing suite", (a) => { delete a.receipts["CI-CLI"] }],
  ["missing artifact", (a) => { delete a.reports["CI-CLI"] }],
  ["job cancelled", (a) => { a.needs.unit.result = "cancelled" }],
  ["job skipped", (a) => { a.needs.ui.result = "skipped" }],
  ["job failed", (a) => { a.needs.static.result = "failure" }],
  ["missing job", (a) => { delete a.needs.omni }],
  ["different source SHA", (a) => { a.receipts["CI-CLI"].sourceSha = "b".repeat(40) }],
  ["different checkout SHA", (a) => { a.receipts["CI-CLI"].checkoutSha = "b".repeat(40) }],
  ["different run", (a) => { a.receipts["CI-CLI"].runId = "999" }],
  ["different attempt", (a) => { a.receipts["CI-CLI"].attempt = "2" }],
  ["wrong OS", (a) => { a.receipts["CI-CLI"].runnerOS = "Windows" }],
  ["wrong tree", (a) => { a.receipts["CI-CLI"].treeSha = "f".repeat(40) }],
  ["wrong manifest digest", (a) => { a.receipts["CI-CLI"].manifestSha256 = "0".repeat(64) }],
  ["wrong arch", (a) => { a.receipts["CI-CLI"].runnerArch = "ARM64" }],
  ["unexecuted", (a) => { a.receipts["CI-CLI"].executedTests = 0 }],
  ["forged digest", (a) => { a.receipts["CI-CLI"].reportSha256 = "0".repeat(64) }],
  ["false pass", (a) => { a.receipts["CI-CLI"].status = "BLOCKED" }],
  ["error code", (a) => { a.receipts["CI-CLI"].exitCode = 1 }],
  ["extra suite", (a) => { a.receipts.EXTRA = a.receipts["CI-CLI"]; a.reports.EXTRA = report }],
]
for (const [name, mutate] of mutations) test(name + " cannot produce green", () => {
  const data = fixture()
  mutate(data)
  assert.throws(() => verifyAll(data), { message: /SF_CI_FAIL_CLOSED|Expected values to be strictly equal/ })
})
test("manifest removed requirement cannot produce green", () => {
  const data = fixture()
  data.manifest.suites.pop()
  assert.throws(() => verifyAll(data), /SF_CI_FAIL_CLOSED/)
})
test("test reporter skips cannot produce green", () => {
  assert.throws(() => countBunReport(JSON.stringify({ status: "PASS", counts: { product_executed: 2, failures: 0, errors: 0, skipped: 1 } })))
})

test("M4 authentic baseline cannot silently shrink into one test", () => {
  const data = fixture()
  data.manifest = structuredClone(manifest)
  const suite = data.manifest.suites.find((item) => item.id === "CI-APP-SRC")
  suite.coverageBaseline.minimumCases += 1
  const digest = createHash("sha256").update(JSON.stringify(data.manifest)).digest("hex")
  for (const receipt of Object.values(data.receipts)) receipt.manifestSha256 = digest
  assert.throws(() => verifyAll(data), /missing\/changed baseline case or file/)
})
test("M4 missing baseline remains BLOCKED rather than passing with one test", () => {
  const data = fixture()
  data.manifest = structuredClone(manifest)
  data.manifest.suites.find((item) => item.id === "CI-SF").coverageBaseline.status = "PENDING_REAL_COMPLETE_RUN"
  const digest = createHash("sha256").update(JSON.stringify(data.manifest)).digest("hex")
  for (const receipt of [...Object.values(data.receipts),
    ...Object.values(data.shards).flat().map((part) => part.receipt)]) receipt.manifestSha256 = digest
  assert.throws(() => verifyAll(data), /coverage baseline requires authentic successful run/)
})
test("B2 changing a selected file without the executed file evidence is RED", () => {
  const data = fixture()
  data.selectionProvider = (_manifest, id) => id === "CI-CLI" ? ["test/another-file.test.ts"]
    : id.startsWith("CI-UI-") ? [manifest.suites.find((s) => s.id === id).specFile]
      : ["test/sf-authorized-sample.test.ts"]
  assert.throws(() => verifyAll(data), /selected files were not all executed/)
})
test("CI-06 receipt binds exact test identity, not just nonzero count", () => {
  const data = fixture()
  data.receipts["CI-ATLAS-BUSINESS"].coverageCaseSha256 = "0".repeat(64)
  assert.throws(() => verifyAll(data), /case\/file\/selection receipt identity mismatch/)
})
test("forged summary cases with unchanged product count cannot masquerade as coverage", () => {
  const tampered = JSON.parse(report.toString("utf8"))
  tampered.cases.splice(0, 1)
  assert.throws(() => bunCoverageIdentity(tampered), /casecase inventory|testcase inventory\/count disagreement/)
})
test("opaque Playwright evidence retains stable case fingerprint but removes source title", () => {
  const suite = manifest.suites.find((s) => s.id === "CI-UI-OPERATIONS")
  const minimized = minimalPlaywrightEvidence(playwright(suite).toString("utf8"), suite.specFile)
  const cases = playwrightCoverageIdentity(minimized, suite.specFile)
  assert.equal(cases.cases, 1)
  assert.match(minimized, /idHash/)
  assert.doesNotMatch(minimized, /case source title/)
})
test("all suite families have a manifest declaration; no hidden Windows or macOS target", () => {
  assert.equal(validateManifest(manifest).length, 8)
  const broken = structuredClone(manifest)
  delete broken.suites.find((s) => s.id === "CI-APP-SRC").selection
  assert.throws(() => validateManifest(broken), /app unit suite must be manifest-driven/)
  assert.deepEqual([manifest.target.os, manifest.target.arch], ["Linux", "X64"])
})

test("CI-05 discovers newly added source/Bun tests without changing YAML or allowing undeclared skips", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sf-ci-select-"))
  const write = (filename) => {
    const location = path.join(root, filename)
    mkdirSync(path.dirname(location), { recursive: true })
    writeFileSync(location, "test('covered', () => {})")
  }
  const app = (name) => "packages/app-shell/" + name
  const sf = (name) => "modules/sucafina/" + name
  try {
    // The APP-SRC unit lane admits tests under packages/app-shell/src,
    // not the modules/sucafina tree used by the independent SF lane.
    write(app("src/first.test.ts"))
    write(app("src/nested/new-test.test.ts"))
    assert.deepEqual(selectSuiteFiles(manifest, "CI-APP-SRC", root),
      ["src/first.test.ts", "src/nested/new-test.test.ts"])
    write(app("src/nested/new-third.test.ts"))
    assert.deepEqual(selectSuiteFiles(manifest, "CI-APP-SRC", root),
      ["src/first.test.ts", "src/nested/new-test.test.ts", "src/nested/new-third.test.ts"])

    // SF's full module must discover new tests in test/, src/ and porta/,
    // excluding only the exact reviewable release-only manifest entry.
    write(sf("Sucafinav1/test/real.test.ts"))
    write(sf("Sucafinav1/test/nested/new.test.ts"))
    write(sf("Sucafinav1/src/contract.spec.ts"))
    write(sf("Sucafinav1/test/parity-pitr.test.ts"))
    write(sf("porta/mandatory.test.ts"))
    assert.deepEqual(selectSuiteFiles(manifest, "CI-SF", root), [
      "Sucafinav1/src/contract.spec.ts",
      "Sucafinav1/test/nested/new.test.ts",
      "Sucafinav1/test/real.test.ts",
      "porta/mandatory.test.ts",
    ])
    write(sf("porta/late-added.test.ts"))
    assert.deepEqual(selectSuiteFiles(manifest, "CI-SF", root), [
      "Sucafinav1/src/contract.spec.ts",
      "Sucafinav1/test/nested/new.test.ts",
      "Sucafinav1/test/real.test.ts",
      "porta/late-added.test.ts",
      "porta/mandatory.test.ts",
    ])

    write(app("test-browser/sucafina-native/transport-contract.test.ts"))
    write(app("test-browser/sucafina-native/nested/new-browser.test.ts"))
    write(app("test-browser/sucafina-native/transport-integration.test.ts"))
    write(app("test/other.test.ts"))
    assert.deepEqual(selectSuiteFiles(manifest, "CI-APP-BROWSER", root), [
      "test-browser/sucafina-native/nested/new-browser.test.ts",
      "test-browser/sucafina-native/transport-contract.test.ts",
    ])
    assert.deepEqual(selectSuiteFiles(manifest, "CI-APP-SRC", root),
      ["src/first.test.ts", "src/nested/new-test.test.ts", "src/nested/new-third.test.ts"])

    rmSync(path.join(root, sf("Sucafinav1/test/parity-pitr.test.ts")))
    assert.throws(() => selectSuiteFiles(manifest, "CI-SF", root),
      /missing\/unsafe file in selected candidate/)
    rmSync(path.join(root, app("test-browser/sucafina-native/transport-integration.test.ts")))
    assert.throws(() => selectSuiteFiles(manifest, "CI-APP-BROWSER", root),
      /missing\/unsafe file in selected candidate/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
test("CI-05 admission roots cannot be narrowed by a manifest edit", () => {
  for (const [id, narrowed] of [
    ["CI-SF", "modules/sucafina/Sucafinav1/test"],
    ["CI-CLI", "apps/cli/test"],
    ["CI-APP-SRC", "packages/app-shell/src"],
    ["CI-APP-BROWSER", "packages/app-shell/test-browser/sucafina-native"],
    ["CI-ATLAS-BUSINESS", "modules/atlas/boundary/test"],
    ["CI-UI-OPERATIONS", "packages/app-shell/e2e"],
  ]) {
    const tampered = structuredClone(manifest)
    tampered.suites.find((suite) => suite.id === id).directory = narrowed
    assert.throws(() => validateManifest(tampered), /suite directory drift/)
  }
})
test("CI-05 newly admitted files force RED when a hardcoded runner omits them", () => {
  const data = fixture()
  const defaultSelection = data.selectionProvider
  const files = ["test/sf-authorized-sample.test.ts"]
  data.selectionProvider = (m, id) => id === "CI-CLI" ? files : defaultSelection(m, id)
  assert.equal(verifyAll(data).suiteCount, 8)
  files.push("test/newly-admitted.test.ts")
  assert.throws(() => verifyAll(data), /selected files were not all executed|case\/file\/selection/)
})
test("CI-05 source selection denies symlink escapes and paths without a test extension", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sf-ci-symlink-"))
  try {
    const dir = path.join(root, "packages/app-shell/src")
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, "good.test.ts"), "test('yes',()=>{})")
    symlinkSync(tmpdir(), path.join(dir, "escape"))
    assert.throws(() => selectSuiteFiles(manifest, "CI-APP-SRC", root), /unsafe test tree symlink/)
    rmSync(path.join(dir, "escape"))
    writeFileSync(path.join(dir, "README.md"), "not a test")
    assert.deepEqual(selectSuiteFiles(manifest, "CI-APP-SRC", root), ["src/good.test.ts"])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
test("CI-05 explicit selections reject symlinked parent paths inside the checkout", () => {
  const root = mkdtempSync(path.join(tmpdir(), "sf-ci-parent-link-"))
  try {
    const cliRoot = path.join(root, "apps/cli")
    const realTestDir = path.join(cliRoot, "real-tests")
    mkdirSync(realTestDir, { recursive: true })
    writeFileSync(path.join(realTestDir, "sf-authorized-sample.test.ts"), "test('yes',()=>{})")
    symlinkSync("real-tests", path.join(cliRoot, "test"), "dir")
    assert.throws(() => selectSuiteFiles(manifest, "CI-CLI", root),
      /missing\/unsafe file in selected candidate/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
