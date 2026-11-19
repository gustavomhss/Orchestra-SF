import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { pins, requireHostedLinux, runActionlint, source, tool } from "./fixture/azure-tools.mjs"

const checkout = "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
const setupNode = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
const setupBun = "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6"
const upload = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
const bunUrl = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64-baseline.zip"
const guard = "github.repository == 'gustavomhss/Orchestra-SF' && github.ref == 'refs/heads/dev'"
const ids = ["source", "checkout", "node", "bun", "install", "native", "qualify", "receipt", "upload"]
const requested = "${{ inputs.revision || github.sha }}"
const inputExpr = /\$\{\{\s*inputs\./
const banned = /secrets\.|github\.token|id-token|AZURE|azure\/login|actions\/cache|contents":"write"|workflow_call|pull_request|openai|anthropic|gcloud|docker login/
let parsing

test("manual app-build is dispatch-only and actionlint accepts it", { timeout: 120_000 }, async () => {
  requireHostedLinux()
  const workflow = source(".github/workflows/app-build.yml")
  const doc = await parseWorkflow(readFileSync(workflow, "utf8"))
  assertWorkflow(doc)
  const run = step(doc, "source").run
  const hex = "0123456789abcdef".repeat(2) + "01234567"
  assert.equal(hex.length, 40)
  const ok = invoke(run, hex)
  assert.equal(ok.status, 0)
  assert.equal(ok.body, `sha=${hex}\n`)
  for (const bad of ["dev", "a".repeat(39), "A".repeat(40), "$(printf)", "`printf`", `${hex};printf`, "refs/heads/dev", `${hex}\n`]) {
    const rejected = invoke(run, bad)
    assert.notEqual(rejected.status, 0)
    assert.equal(rejected.body, "")
  }
  for (const mutate of mutations()) {
    const copy = structuredClone(doc)
    mutate(copy)
    assert.throws(() => assertWorkflow(copy), { code: "ERR_ASSERTION" })
  }
  const script = nodeHeredoc(step(doc, "receipt").run)
  const digest = createHash("sha256").update(archiveBytes).digest("hex")
  assert.notEqual(selected, workflowSha)
  assert.equal(digest.length, 64)
  assert.notEqual(digest, "0".repeat(64))
  assert.equal(runReceipt(script, digest), 0)
  for (const mutate of [
    (body) => { body.sourceSHA = "a".repeat(40) },
    (body) => { body.workflowSHA = "b".repeat(40) },
    (body) => { body.archive.sha256 = "0".repeat(64) },
    (body) => { body.schema = "not-a-proof" },
    (body) => { body.manifest.schema = "not-a-manifest" },
    (body) => { body.web.assetSha256 = "0".repeat(64) },
    (body) => { body.manifest.files = body.manifest.files.filter((file) => file.path !== "bin/web/index.html") },
    (body) => { body.modelsSha256 = "A".repeat(64) },
    (body) => { body.manifest.files = body.manifest.files.map((file) => file.path) },
  ]) assert.notEqual(runReceipt(script, digest, mutate), 0)
  runActionlint(await tool(pins().actionlint, "actionlint.tar.gz"), workflow)
})

function mutations() {
  return [
    (doc) => { doc.on.push = { branches: ["dev"] } },
    (doc) => { doc.jobs.build.if = "true" },
    (doc) => { step(doc, "checkout").uses = "actions/checkout@v4" },
    (doc) => { step(doc, "checkout").with["persist-credentials"] = true },
    (doc) => { step(doc, "bun").with["no-cache"] = false },
    (doc) => { doc.permissions["id-token"] = "write" },
    (doc) => { step(doc, "source").env.REQUESTED_REVISION = "${{ github.sha }}" },
    (doc) => { doc.jobs.build.steps = doc.jobs.build.steps.filter((item) => item.id !== "receipt") },
    (doc) => {
      const steps = doc.jobs.build.steps
      steps.splice(steps.findIndex((item) => item.id === "receipt"), 0, steps.pop())
    },
  ]
}

function step(doc, id) {
  return doc.jobs.build.steps.find((item) => item.id === id)
}

function assertWorkflow(doc) {
  assert.equal(doc.name, "app-build")
  assert.deepEqual(Object.keys(doc.on), ["workflow_dispatch"])
  const revision = doc.on.workflow_dispatch.inputs.revision
  assert.deepEqual([revision.type, revision.required, revision.default, Object.keys(doc.on.workflow_dispatch.inputs).length], ["string", false, "", 1])
  assert.deepEqual(doc.permissions, { contents: "read" })
  assert.equal(doc.concurrency.group, "app-build")
  assert.equal(doc.concurrency["cancel-in-progress"], false)
  assert.deepEqual(Object.keys(doc.jobs), ["build"])
  const job = doc.jobs.build
  assert.equal(String(job.if ?? "").trim().replaceAll(/\s+/g, " "), guard)
  assert.equal(job["runs-on"], "ubuntu-24.04")
  assert.equal(job["timeout-minutes"], 45)
  assert.equal(job.permissions, undefined)
  assert.equal(job.environment, undefined)
  assert.equal(job.steps.some((item) => item["continue-on-error"]), false)
  assert.deepEqual(job.steps.map((item) => item.id), ids)
  const stripped = { ...doc, jobs: { build: { ...job, steps: job.steps.map((item) => ({ ...item, env: undefined, with: undefined })) } } }
  assert.equal(inputExpr.test(JSON.stringify(stripped)), false)
  assert.equal(/\$\{\{/.test(job.steps.map((item) => item.run ?? "").join("\n")), false)
  assert.equal(banned.test(JSON.stringify(doc)), false)
  assert.equal(step(doc, "source").env.REQUESTED_REVISION, requested)
  assert.equal(step(doc, "source").run.includes("^[0-9a-f]{40}$"), true)
  const checkoutStep = step(doc, "checkout")
  assert.equal(checkoutStep.uses, checkout)
  assert.equal(checkoutStep.with.ref, "${{ steps.source.outputs.sha }}")
  assert.equal(checkoutStep.with["persist-credentials"], false)
  assert.equal(step(doc, "node").uses, setupNode)
  assert.equal(step(doc, "node").with["node-version"], "24.15")
  assert.equal(step(doc, "bun").uses, setupBun)
  assert.equal(step(doc, "bun").with["bun-download-url"], bunUrl)
  assert.equal(step(doc, "bun").with["no-cache"], true)
  assert.equal(Object.keys(step(doc, "bun").with).length, 2)
  assert.equal(step(doc, "install").run.includes("bun install --frozen-lockfile"), true)
  const native = step(doc, "native")
  assert.equal(native["working-directory"], "native/omni")
  assert.equal(native.run.includes("x86_64"), true)
  assert.equal(native.run.includes("rustup show active-toolchain || rustup toolchain install"), true)
  assert.equal(native.run.includes("cargo build --locked --release -p hugr-omni-node -p omni-supervisor"), true)
  assert.equal(/cargo update|Cargo\.lock/.test(native.run), false)
  const qualify = step(doc, "qualify")
  assert.equal(qualify["working-directory"], "apps/cli")
  assert.deepEqual(qualify.env, {
    SOURCE_REVISION: "${{ steps.source.outputs.sha }}",
    ORCHESTRA_OMNI_CONTROL: "suite",
    ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "strict",
  })
  for (const needle of ["git rev-parse HEAD", "./test/distribution-web-native.test.ts", "export ORCHESTRA_OMNI_CONTROL_NONCE=", "bun test ./test/distribution-web-native.test.ts --timeout 1800000"])
    assert.equal(qualify.run.includes(needle), true, needle)
  assert.equal(qualify.run.includes("--preload"), false)
  assert.equal(/bun run build|script\/build|cargo build/.test(qualify.run), false)
  const receipt = step(doc, "receipt")
  assert.deepEqual(receipt.env, {
    SOURCE_REVISION: "${{ steps.source.outputs.sha }}",
    WORKFLOW_SHA: "${{ github.sha }}",
  })
  assert.equal(receipt.run.includes("<<'NODE'"), true)
  assert.equal(receipt.run.includes("tar -tzf"), false)
  assert.equal(receipt.run.includes("execFileSync"), false)
  assert.equal(/\breceipt\.source\b/.test(receipt.run), false)
  for (const needle of ["distribution-logs/build-receipt.json", "distribution-logs/orchestra-sf-linux-x64-baseline.tar.gz", "orchestra-web-build-proof-v1", "gustavomhss/Orchestra-SF", "linux-x64-baseline", "apps/cli/package.json", "inspected", "providerProof", "sourceSHA", "workflowSHA", "modelsSha256", "createHash", "file.path", "file.sha256", "file.executable", "bin/orchestra", "bin/web/index.html", "web.asset"])
    assert.equal(receipt.run.includes(needle), true, needle)
  const up = step(doc, "upload")
  assert.equal(up.if, "success()")
  assert.equal(up.uses, upload)
  assert.deepEqual([up.with.name, up.with.path, up.with["if-no-files-found"], up.with["retention-days"]], ["orchestra-sf-linux-${{ steps.source.outputs.sha }}", "distribution-logs", "error", 7])
  assert.deepEqual(job.steps.flatMap((item) => (item.uses ? [item.uses] : [])), [checkout, setupNode, setupBun, upload])
}

function invoke(run, revision) {
  const dir = mkdtempSync(path.join(tmpdir(), "app-build-source-"))
  const output = path.join(dir, "github-output")
  const script = path.join(dir, "source.sh")
  writeFileSync(script, run)
  writeFileSync(output, "")
  try {
    execFileSync("bash", [script], { env: { PATH: "/usr/bin:/bin", REQUESTED_REVISION: revision, GITHUB_OUTPUT: output }, encoding: "utf8", timeout: 10_000 })
    return { status: 0, body: readFileSync(output, "utf8") }
  } catch (error) {
    return { status: error.status ?? 1, body: readFileSync(output, "utf8") }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const selected = "0123456789abcdef".repeat(2) + "01234567"
const workflowSha = "fedcba9876543210".repeat(2) + "fedcba98"
const archiveBytes = Buffer.from("checker-calibration")
const fileHash = "ab".repeat(32)

function nodeHeredoc(run) {
  const marker = "<<'NODE'\n"
  const start = run.indexOf(marker)
  const end = run.indexOf("\nNODE", start + marker.length)
  assert.equal(start >= 0 && end > start, true)
  return run.slice(start + marker.length, end)
}

function runReceipt(script, digest, mutate) {
  const dir = mkdtempSync(path.join(tmpdir(), "app-build-receipt-"))
  try {
    const logs = path.join(dir, "distribution-logs")
    mkdirSync(path.join(dir, "apps/cli"), { recursive: true })
    mkdirSync(logs)
    writeFileSync(path.join(logs, "orchestra-sf-linux-x64-baseline.tar.gz"), archiveBytes)
    writeFileSync(path.join(dir, "apps/cli/package.json"), JSON.stringify({ version: "9.9.9-fixture" }))
    const body = {
      schema: "orchestra-web-build-proof-v1",
      repository: "gustavomhss/Orchestra-SF",
      sourceSHA: selected,
      workflowSHA: workflowSha,
      target: "linux-x64-baseline",
      version: "9.9.9-fixture",
      modelsSha256: "1234abcd".repeat(8),
      inspected: true,
      providerProof: false,
      archive: { file: "orchestra-sf-linux-x64-baseline.tar.gz", sha256: digest },
      manifest: {
        schema: "orchestra-distribution-v1",
        target: "linux-x64-baseline",
        version: "9.9.9-fixture",
        files: [
          { path: "bin/orchestra", sha256: fileHash, executable: true },
          { path: "bin/web/index.html", sha256: fileHash, executable: false },
          { path: "bin/web/assets/app.js", sha256: fileHash, executable: false },
        ],
      },
      web: { indexSha256: fileHash, asset: "assets/app.js", assetSha256: fileHash },
    }
    if (mutate) mutate(body)
    writeFileSync(path.join(logs, "build-receipt.json"), JSON.stringify(body))
    try {
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        cwd: dir,
        env: { PATH: process.env.PATH ?? "", SOURCE_REVISION: selected, WORKFLOW_SHA: workflowSha },
        encoding: "utf8",
        timeout: 10_000,
      })
      return 0
    } catch (error) {
      return error.status ?? 1
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function parseWorkflow(text) {
  requireHostedLinux()
  parsing ??= tool(pins().yaml, "yaml.tgz").then((archive) => {
    const dir = path.dirname(archive)
    execFileSync("tar", ["-xzf", archive, "-C", dir], { timeout: 15_000 })
    return createRequire(import.meta.url)(path.join(dir, "package/dist/index.js")).parse
  })
  return (await parsing)(text)
}
