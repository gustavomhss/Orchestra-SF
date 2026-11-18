import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { pins, requireHostedLinux, source, tool } from "./fixture/azure-tools.mjs"

const client = "11111111-1111-4111-8111-111111111111"
const tenant = "22222222-2222-4222-8222-222222222222"
const subscription = "33333333-3333-4333-8333-333333333333"
const group = "orchsf-audit"
const vmSize = "Standard_D2as_v5"
const image = "24.04.202601010"
const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDummyAzureSmokeKey01 dummy"
const loginPin = "azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6"
const confirmExit = "  printf '%s\\n' \"confirmation rejected\" >&2\n  exit 1\n"

const owned = []
let ready
let logSeq = 0

after(() => {
  for (const dir of owned) rmSync(dir, { recursive: true, force: true })
})

function arm() {
  requireHostedLinux()
  ready ??= build().then(
    (value) => value,
    (error) => {
      throw error
    },
  )
  return ready
}

async function build() {
  const bicep = await tool(pins().bicep, "bicep")
  const root = mkdtempSync(path.join(tmpdir(), "azure-deploy-"))
  owned.push(root)
  const azure = path.join(root, "infra/azure")
  mkdirSync(azure, { recursive: true })
  for (const name of ["main.bicep", "bootstrap.sh", "tools.json", "deploy.sh"]) {
    cpSync(source(path.join("infra/azure", name)), path.join(azure, name))
  }
  const bin = mkdtempSync(path.join(tmpdir(), "azure-az-"))
  owned.push(bin)
  const az = path.join(bin, "az")
  writeFileSync(az, mockAz())
  chmodSync(az, 0o755)
  return { root, bicep, bin, deploy: path.join(azure, "deploy.sh") }
}

function mockAz() {
  return `#!${process.execPath}
const fs = require("node:fs")
const args = process.argv.slice(2)
fs.appendFileSync(process.env.AZ_MOCK_LOG, JSON.stringify(args) + "\\n")
const at = args.indexOf("--query")
const query = at >= 0 ? args[at + 1] : ""
const ok = (text) => { process.stdout.write(text + "\\n"); process.exit(0) }
if (args[0] === "cloud" && args[1] === "show" && query === "name") ok("AzureCloud")
if (args[0] === "account" && args[1] === "show" && query === "id") ok(${JSON.stringify(subscription)})
if (args[0] === "account" && args[1] === "show" && query === "tenantId") ok(${JSON.stringify(tenant)})
if (args[0] === "group" && args[1] === "show" && query === "location") ok("eastus")
if (args[0] === "deployment" && args[1] === "group" && (args[2] === "what-if" || args[2] === "create")) process.exit(0)
process.exit(97)
`
}

function envFor(ctx, log, operation, confirm) {
  const env = {
    PATH: [ctx.bin, path.dirname(ctx.bicep), process.env.PATH ?? ""].join(path.delimiter),
    HOME: process.env.HOME ?? "/tmp",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    LANG: "C.UTF-8",
    AZ_MOCK_LOG: log,
    OPERATION: operation,
    CONFIRM: confirm,
    AZURE_CLIENT_ID: client,
    AZURE_TENANT_ID: tenant,
    AZURE_SUBSCRIPTION_ID: subscription,
    AZURE_RESOURCE_GROUP: group,
    VM_SIZE: vmSize,
    IMAGE_VERSION: image,
    AZURE_VM_SSH_PUBLIC_KEY: publicKey,
  }
  for (const key of Object.keys(env)) assert.equal(/SECRET|PASSWORD|TOKEN|CREDENTIAL/.test(key), false, key)
  return env
}

function calls(log) {
  return log.split("\n").filter(Boolean).map((line) => JSON.parse(line))
}

function countVerb(log, verb) {
  return calls(log).filter((args) => args[0] === "deployment" && args[1] === "group" && args[2] === verb).length
}

function flagsActualCreate(log) {
  return countVerb(log, "create") > 0
}

function run(ctx, script, operation, confirm) {
  const log = path.join(ctx.root, `az-${logSeq += 1}.log`)
  writeFileSync(log, "")
  let status = 0
  let stderr = ""
  try {
    execFileSync("bash", [script], { env: envFor(ctx, log, operation, confirm), encoding: "utf8", timeout: 90_000 })
  } catch (error) {
    status = typeof error.status === "number" ? error.status : 1
    stderr = String(error.stderr ?? "")
  }
  return { status, stderr, body: readFileSync(log, "utf8") }
}

test("preview exits 0 and does not create", { timeout: 120_000 }, async () => {
  const ctx = await arm()
  const result = run(ctx, ctx.deploy, "preview", "PREVIEW")
  assert.equal(result.status, 0)
  assert.equal(countVerb(result.body, "what-if"), 1)
  assert.equal(flagsActualCreate(result.body), false)
})

test("invalid CONFIRM is nonzero and does not create", { timeout: 120_000 }, async () => {
  const ctx = await arm()
  const result = run(ctx, ctx.deploy, "apply", "NO")
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /confirmation rejected/)
  assert.equal(countVerb(result.body, "what-if"), 1)
  assert.equal(flagsActualCreate(result.body), false)
})

test("exact apply exits 0 and creates once", { timeout: 120_000 }, async () => {
  const ctx = await arm()
  const result = run(ctx, ctx.deploy, "apply", `APPLY ${group}`)
  assert.equal(result.status, 0)
  assert.equal(countVerb(result.body, "what-if"), 1)
  assert.equal(countVerb(result.body, "create"), 1)
  assert.equal(flagsActualCreate(result.body), true)
})

test("removing only the confirm exit flags actual create", { timeout: 120_000 }, async () => {
  const ctx = await arm()
  const original = readFileSync(ctx.deploy, "utf8")
  const mutated = original.replace(confirmExit, "  printf '%s\\n' \"confirmation rejected\" >&2\n")
  assert.equal(original.split("exit 1").length - mutated.split("exit 1").length, 1)
  assert.equal(mutated.includes('if [[ "$CONFIRM" != "APPLY ${AZURE_RESOURCE_GROUP}" ]]'), true)
  assert.equal(mutated.includes("bicep pin rejected"), true)
  assert.match(mutated, /"\$bicep_bin" build infra\/azure\/main\.bicep --outfile "\$template"/)
  const script = path.join(ctx.root, "infra/azure/deploy-unlatched.sh")
  writeFileSync(script, mutated, { mode: 0o700 })
  const result = run(ctx, script, "apply", "NO")
  assert.equal(countVerb(result.body, "create"), 1)
  assert.equal(flagsActualCreate(result.body), true)
})

test("workflow smoke rejects azure/login@main", { timeout: 120_000 }, async () => {
  requireHostedLinux()
  const tree = mkdtempSync(path.join(tmpdir(), "azure-workflow-oracle-"))
  owned.push(tree)
  try {
    const testDir = path.join(tree, "packages/script/test")
    mkdirSync(path.join(testDir, "fixture"), { recursive: true })
    mkdirSync(path.join(tree, ".github/workflows"), { recursive: true })
    mkdirSync(path.join(tree, "infra/azure"), { recursive: true })
    cpSync(source("packages/script/test/azure-workflow.node-smoke.mjs"), path.join(testDir, "azure-workflow.node-smoke.mjs"))
    cpSync(source("packages/script/test/fixture/azure-tools.mjs"), path.join(testDir, "fixture/azure-tools.mjs"))
    cpSync(source("infra/azure/deploy.sh"), path.join(tree, "infra/azure/deploy.sh"))
    cpSync(source("infra/azure/tools.json"), path.join(tree, "infra/azure/tools.json"))
    const workflow = readFileSync(source(".github/workflows/azure-mvp.yml"), "utf8")
    assert.equal(workflow.includes(loginPin), true)
    const floating = workflow.replaceAll(loginPin, "azure/login@main")
    assert.equal(floating.includes(loginPin), false)
    writeFileSync(path.join(tree, ".github/workflows/azure-mvp.yml"), floating)
    let status = 0
    let output = ""
    try {
      execFileSync(process.execPath, ["--test", path.join(testDir, "azure-workflow.node-smoke.mjs")], {
        cwd: tree,
        timeout: 90_000,
        encoding: "utf8",
        env: {
          GITHUB_ACTIONS: "true",
          PATH: process.env.PATH ?? "",
          HOME: process.env.HOME ?? "/tmp",
          TMPDIR: process.env.TMPDIR ?? "/tmp",
          LANG: "C.UTF-8",
        },
      })
    } catch (error) {
      status = typeof error.status === "number" ? error.status : 1
      output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`
    }
    // Baseline child exits 0, so this fails red. A later pin assertion names azure/login@main.
    assert.notEqual(status, 0)
    assert.match(output, /ERR_ASSERTION/)
    assert.match(output, /azure\/login@main/)
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
})
