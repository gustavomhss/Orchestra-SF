import { createHash } from "node:crypto"
import { appendFileSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { controlVerdict, omniControlScope, playwrightArgs, validateRequest, validateSelection } from "../../test-ci-request.ts"
import { locateTestPackage } from "../../test-ci-location.ts"

process.chdir(process.env.GITHUB_WORKSPACE ?? process.cwd())
const evidence = "test-ci-evidence"
const action = process.argv[2] ?? "request"
const digest = (value) => createHash("sha256").update(value).digest("hex")
const read = (file) => JSON.parse(readFileSync(file, "utf8"))
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n")
const canonical = (value) => Array.isArray(value) ? "[" + value.map(canonical).join(",") + "]"
  : value !== null && typeof value === "object"
    ? "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}"
    : JSON.stringify(value)
const selections = {
  controls: {
    package: "sucafina", packageSelector: "packages/sucafina", directory: "modules/sucafina", runner: "bun",
    args: [
      "./Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts",
      "./Sucafinav1/test/product/operations-installed-finish/real-malformed.check.ts",
      "./Sucafinav1/test/product/operations-installed-finish/private-admission.check.ts",
      "--timeout", "120000",
    ],
    env: { ORCHESTRA_CHANNEL: "prod" },
  },
  journeys: {
    package: "app", packageSelector: "packages/app", directory: "packages/app-shell", runner: "playwright",
    args: ["e2e/sucafina/operations.spec.ts"],
    env: { ORCHESTRA_CHANNEL: "prod" },
    config: "e2e/playwright.production.config.ts",
  },
}

if (action === "request") {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      process.env.GITHUB_EVENT_NAME !== "push" || process.env.RUNNER_OS !== "Linux" || process.env.RUNNER_ARCH !== "X64")
    throw new Error("OPERATIONS75_HOST_SCOPE_MISMATCH")
  if (statSync(".ci-run.json").size > 16384) throw new Error("OPERATIONS75_REQUEST_TOO_LARGE")
  const input = read(".ci-run.json")
  const envelope = input.operationsScanner
  const body = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "operationsScanner"))
  if (!envelope || !Object.hasOwn(selections, envelope.selection) ||
      !isDeepStrictEqual(body, selections[envelope.selection]))
    throw new Error("OPERATIONS75_EXACT_SELECTION_REQUIRED")
  const isFile = (file) => (statSync(file, { throwIfNoEntry: false })?.isFile() ?? false) &&
    realpathSync(file).startsWith(realpathSync(".") + path.sep)
  const request = JSON.parse(JSON.stringify(validateRequest(body, isFile, (selector) => locateTestPackage(".", selector))))
  const requestSha256 = digest(canonical(request))
  if (!/^[a-f0-9]{40}$/.test(envelope.productSha) ||
      !isDeepStrictEqual(envelope, {
        campaign: "sf2h-integral-20261112", mission: 75,
        sourceBranch: envelope.selection === "controls" ? "operations-scanner-proof" : "sf2-stack",
        productSha: envelope.productSha, requestSha256, selection: envelope.selection,
      }))
    throw new Error("OPERATIONS75_ENVELOPE_OR_REQUEST_DIGEST_MISMATCH")
  const mode = envelope.selection === "controls" ? "c" : "j"
  const branch = "^sf-ops75-" + envelope.productSha.slice(0, 12) + mode + requestSha256.slice(0, 12) + "[1-9][0-9]?$"
  if (!new RegExp(branch).test(process.env.GITHUB_REF_NAME ?? "") ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "") ||
      process.env.SF_OPERATIONS_SNAPSHOT_HEAD !== process.env.GITHUB_SHA ||
      process.env.SF_OPERATIONS_SNAPSHOT_PARENT !== envelope.productSha ||
      process.env.SF_OPERATIONS_SNAPSHOT_CHANGED !== ".ci-run.json")
    throw new Error("OPERATIONS75_REQUEST_ONLY_SNAPSHOT_REQUIRED")
  const files = [
    ".ci-run.json", ".github/workflows/sf-operations-scanner.yml",
    "script/test-ci-request.ts", "script/test-ci-location.ts",
    "script/sf2h/operations-scanner/request.mjs", "script/sf2h/operations-scanner/setup.sh",
    "script/sf2h/operations-scanner/service.mjs", "script/sf2h/operations-scanner/cleanup.sh",
    "script/sf2h/operations-scanner/tools.lock.json",
    "packages/app-shell/e2e/playwright.production.config.ts",
    ...request.args.filter((file) => /\.(check|spec)\.ts$/.test(file)).map((file) => request.directory + "/" + file),
  ]
  const integrity = files.map((file) => {
    if (!isFile(file)) throw new Error("OPERATIONS75_REQUIRED_FILE_MISSING:" + file)
    return { path: file, sha256: digest(readFileSync(file)) }
  })
  mkdirSync(evidence, { recursive: true })
  save(evidence + "/request.json", {
    envelope, request, snapshotSha: process.env.GITHUB_SHA,
    run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, integrity,
    playwrightArgs: request.runner === "playwright" ? playwrightArgs(request) : undefined,
  })
  appendFileSync(process.env.GITHUB_ENV, "ORCHESTRA_CHANNEL=prod\n")
  appendFileSync(process.env.GITHUB_OUTPUT,
    "admitted=true\nkind=" + envelope.selection + "\ndirectory=" + request.directory +
    "\nrunner=" + request.runner + "\nomni_control=" + omniControlScope(request) + "\n")
} else {
  const receipt = read(evidence + "/request.json")
  for (const file of receipt.integrity) {
    if (digest(readFileSync(file.path)) !== file.sha256)
      throw new Error("OPERATIONS75_SOURCE_CHANGED_IN_JOB:" + file.path)
  }
  if (action === "selection") {
    if (receipt.envelope.selection !== "journeys") throw new Error("OPERATIONS75_JOURNEYS_REQUIRED")
    const report = read(evidence + "/playwright-selection.json")
    const hasTests = (suite) => suite.specs?.some((spec) => spec.tests?.length > 0) || (suite.suites ?? []).some(hasTests)
    validateSelection(receipt.request.args.map((file) => path.resolve(receipt.request.directory, file)),
      report.suites.filter(hasTests).map((suite) => path.resolve(report.config.rootDir, suite.file)))
    const specs = (suite) => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specs)]
    const selected = report.suites.flatMap(specs)
    const ids = ["OP-PROC-01", "OP-PROC-02", "OP-PROC-03", "OP-IMPORT-01", "OP-DOC-01"]
    if (selected.length !== ids.length || selected.some((spec, index) =>
      !spec.title.startsWith(ids[index] + " ") || spec.tests?.length !== 1))
      throw new Error("OPERATIONS75_FIVE_ORIGINAL_JOURNEYS_REQUIRED")
    save(evidence + "/selection.json", { ids, tests: selected.length, workers: 1, retries: 0, repeat: 1 })
  } else if (action === "verify-control") {
    if (receipt.envelope.selection !== "controls") throw new Error("OPERATIONS75_CONTROLS_REQUIRED")
    const nonce = readFileSync(evidence + "/omni-nonce.txt", "utf8").trim()
    if (!/^[a-f0-9]{32}$/.test(nonce)) throw new Error("OPERATIONS75_OMNI_NONCE_INVALID")
    const verdict = controlVerdict({ name: "Operations75 controls" },
      "omni control nonce: " + nonce + "\n" + readFileSync(evidence + "/bun.log", "utf8"))
    save(evidence + "/omni.json", { verdict, qualification: "component controls, no native parity claim" })
    console.info(verdict)
  } else if (action !== "integrity") throw new Error("OPERATIONS75_ACTION_INVALID")
}
