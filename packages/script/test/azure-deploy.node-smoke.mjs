import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
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
const crypto = require("node:crypto")
const args = process.argv.slice(2)
fs.appendFileSync(process.env.AZ_MOCK_LOG, JSON.stringify(args) + "\\n")
const at = args.indexOf("--query")
const query = at >= 0 ? args[at + 1] : ""
const ok = (text) => { process.stdout.write(text + "\\n"); process.exit(0) }
if (args[0] === "cloud" && args[1] === "show" && query === "name") ok("AzureCloud")
if (args[0] === "account" && args[1] === "show" && query === "id") ok(${JSON.stringify(subscription)})
if (args[0] === "account" && args[1] === "show" && query === "tenantId") ok(${JSON.stringify(tenant)})
if (args[0] === "group" && args[1] === "show" && query === "location") ok("eastus")
if (args[0] === "resource" && args[1] === "list" && query === "length(@)") {
  if (process.env.AZ_MOCK_RESOURCE_ERROR === "true") process.exit(3)
  ok(process.env.AZ_MOCK_RESOURCE_COUNT ?? "0")
}
if (args[0] === "deployment" && args[1] === "group" && args[2] === "show" && query === "properties.provisioningState") {
  ok(process.env.AZ_MOCK_FOUNDATION_STATE ?? "Succeeded")
}
if (args[0] === "vm" && args[1] === "show" && query === "provisioningState") {
  if (process.env.AZ_MOCK_VM_ABSENT === "true") process.exit(3)
  ok(process.env.AZ_MOCK_VM_STATE ?? "Succeeded")
}
if (args[0] === "deployment" && args[1] === "group" && (args[2] === "what-if" || args[2] === "create")) {
  const templatePath = args[args.indexOf("--template-file") + 1]
  const parametersPath = args[args.indexOf("--parameters") + 1].slice(1)
  const template = fs.readFileSync(templatePath, "utf8")
  const parameters = fs.readFileSync(parametersPath, "utf8")
  const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex")
  fs.appendFileSync(process.env.AZ_MOCK_CAPTURE, JSON.stringify({
    args, template, parameters, templateSha256: sha256(template), parametersSha256: sha256(parameters),
    templateMode: fs.statSync(templatePath).mode & 0o777, parametersMode: fs.statSync(parametersPath).mode & 0o777,
  }) + "\\n")
  process.exit(0)
}
process.exit(97)
`
}

function envFor(ctx, log, operation, confirm, capture) {
  const env = {
    PATH: [ctx.bin, path.dirname(ctx.bicep), process.env.PATH ?? ""].join(path.delimiter),
    HOME: process.env.HOME ?? "/tmp",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    LANG: "C.UTF-8",
    AZ_MOCK_LOG: log,
    AZ_MOCK_CAPTURE: capture,
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

function run(ctx, script, operation, confirm, extra = {}) {
  const log = path.join(ctx.root, `az-${logSeq += 1}.log`)
  const capture = `${log}.captured.jsonl`
  writeFileSync(log, "")
  writeFileSync(capture, "")
  let status = 0
  let stderr = ""
  try {
    execFileSync("bash", [script], { env: { ...envFor(ctx, log, operation, confirm, capture), ...extra }, encoding: "utf8", timeout: 90_000 })
  } catch (error) {
    status = typeof error.status === "number" ? error.status : 1
    stderr = String(error.stderr ?? "")
  }
  const body = readFileSync(log, "utf8")
  const captures = calls(readFileSync(capture, "utf8"))
  const evidence = process.env.AZURE_NETWORK_EVIDENCE_DIR
  if (evidence) {
    assert.equal(path.isAbsolute(evidence), true, "AZURE_NETWORK_EVIDENCE_DIR must be absolute")
    mkdirSync(evidence, { recursive: true, mode: 0o700 })
    writeFileSync(path.join(evidence, `wrapper-${logSeq}.json`), JSON.stringify({
      variant: path.basename(script) === "deploy.sh" ? "canonical" : "confirm-mutation",
      operation, status, calls: calls(body), captures,
    }, null, 2) + "\n", { mode: 0o600 })
  }
  return { status, stderr, body, captures }
}


const originalMvpParameters = "{\"$schema\": \"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#\", \"contentVersion\": \"1.0.0.0\", \"parameters\": {\"location\": {\"value\": \"eastus\"}, \"vmSize\": {\"value\": \"Standard_D2as_v5\"}, \"imageVersion\": {\"value\": \"24.04.202601010\"}, \"adminSshPublicKey\": {\"value\": \"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDummyAzureSmokeKey01 dummy\"}, \"adminUsername\": {\"value\": \"sfadmin\"}, \"dataDiskSizeGiB\": {\"value\": 64}}}"

function assertCapturedDeployment(result, expectedGroup, network = undefined) {
  assert.ok(result.captures.length >= 1)
  const first = result.captures[0]
  const expected = JSON.parse(originalMvpParameters)
  if (network) {
    Object.assign(expected.parameters, {
      networkProfile: { value: network.profile },
      qaHttpsIngressCidrs: { value: network.https },
      cloneAdminEgressCidrs: { value: network.admin },
    })
  }
  for (const capture of result.captures) {
    assert.deepEqual(capture.args.slice(0, 2), ["deployment", "group"])
    assert.ok(["what-if", "create"].includes(capture.args[2]))
    assert.equal(capture.args[capture.args.indexOf("--resource-group") + 1], expectedGroup)
    assert.equal(capture.args[capture.args.indexOf("--mode") + 1], "Incremental")
    assert.equal(capture.args[capture.args.indexOf("--name") + 1], "orchsf-foundation")
    assert.equal(capture.templateMode, 0o600)
    assert.equal(capture.parametersMode, 0o600)
    assert.equal(capture.template, first.template)
    assert.equal(capture.parameters, first.parameters)
    assert.equal(capture.templateSha256, createHash("sha256").update(capture.template).digest("hex"))
    assert.equal(capture.parametersSha256, createHash("sha256").update(capture.parameters).digest("hex"))
    assert.deepEqual(JSON.parse(capture.parameters), expected)
    assert.equal(JSON.parse(capture.template).parameters.networkProfile.defaultValue, "mvp")
  }
  if (!network) assert.equal(first.parameters, originalMvpParameters)
}

test("preview exits 0 and does not create", { timeout: 120_000 }, async () => {
  const ctx = await arm()
  const result = run(ctx, ctx.deploy, "preview", "PREVIEW")
  assert.equal(result.status, 0)
  assert.equal(countVerb(result.body, "what-if"), 1)
  assert.equal(flagsActualCreate(result.body), false)
  assertCapturedDeployment(result, group)
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
  assertCapturedDeployment(result, group)
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


// These are parser/CLI fixtures, never an operational allowlist or a real Azure call.
const qualificationProfiles = [
  {
    "profile": "g08-qa",
    "group": "orchestra-sf-g08-qa",
    "https": [
      "10.62.0.10/32",
      "198.51.100.10/32"
    ],
    "admin": []
  },
  {
    "profile": "g10-source",
    "group": "orchestra-sf-g10-source",
    "https": [
      "198.51.100.11/32"
    ],
    "admin": []
  },
  {
    "profile": "g10-clone",
    "group": "orchestra-sf-g10-clone",
    "https": [],
    "admin": [
      "1.1.1.1/32",
      "8.8.8.8/32"
    ]
  }
]

for (const network of qualificationProfiles) {
  test(`${network.profile} binds the exact target and identical ARM/parameters to what-if and create`, { timeout: 120_000 }, async () => {
    const ctx = await arm()
    const result = run(ctx, ctx.deploy, "apply", `APPLY ${network.group}`, {
      AZURE_RESOURCE_GROUP: network.group,
      NETWORK_PROFILE: network.profile,
      QA_HTTPS_INGRESS_CIDRS: JSON.stringify(network.https),
      CLONE_ADMIN_EGRESS_CIDRS: JSON.stringify(network.admin),
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(countVerb(result.body, "what-if"), 1)
    assert.equal(countVerb(result.body, "create"), 1)
    assert.equal(result.captures.length, 2)
    assertCapturedDeployment(result, network.group, network)
  })

  test(`MVP bootstrap of empty ${network.group} preserves the original parameter bytes`, { timeout: 120_000 }, async () => {
    const ctx = await arm()
    const result = run(ctx, ctx.deploy, "apply", `APPLY ${network.group}`, {
      AZURE_RESOURCE_GROUP: network.group,
      AZ_MOCK_RESOURCE_COUNT: "0",
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(countVerb(result.body, "what-if"), 1)
    assert.equal(countVerb(result.body, "create"), 1)
    assert.equal(calls(result.body).filter((args) => args[0] === "resource" && args[1] === "list").length, 1)
    assertCapturedDeployment(result, network.group)
  })
}

const qaInputs = { AZURE_RESOURCE_GROUP: "orchestra-sf-g08-qa", NETWORK_PROFILE: "g08-qa", QA_HTTPS_INGRESS_CIDRS: "[\"198.51.100.10/32\"]", CLONE_ADMIN_EGRESS_CIDRS: "[]" }
const cloneInputs = { AZURE_RESOURCE_GROUP: "orchestra-sf-g10-clone", NETWORK_PROFILE: "g10-clone", QA_HTTPS_INGRESS_CIDRS: "[]", CLONE_ADMIN_EGRESS_CIDRS: "[\"1.1.1.1/32\"]" }

const invalidNetworkInputs = [
  ["unknown profile", { ...qaInputs, NETWORK_PROFILE: "qa" }],
  ["QA profile aimed at the existing MVP group", { ...qaInputs, AZURE_RESOURCE_GROUP: "orchestra-sf-mvp" }],
  ["G08 profile aimed at the source group", { ...qaInputs, AZURE_RESOURCE_GROUP: "orchestra-sf-g10-source" }],
  ["clone profile aimed at the G08 group", { ...cloneInputs, AZURE_RESOURCE_GROUP: "orchestra-sf-g08-qa" }],
  ["MVP HTTPS override", { NETWORK_PROFILE: "mvp", QA_HTTPS_INGRESS_CIDRS: "[\"198.51.100.10/32\"]" }],
  ["MVP egress override", { NETWORK_PROFILE: "mvp", CLONE_ADMIN_EGRESS_CIDRS: "[\"1.1.1.1/32\"]" }],
  ["empty QA ingress", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[]" }],
  ["non-JSON ingress", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "not-json" }],
  ["object ingress", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "{}" }],
  ["non-string ingress", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[443]" }],
  ["all Internet", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"0.0.0.0/0\"]" }],
  ["Internet split into two prefixes", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"0.0.0.0/1\",\"128.0.0.0/1\"]" }],
  ["subnet instead of exact host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"198.51.100.0/24\"]" }],
  ["host without CIDR mask", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"198.51.100.10\"]" }],
  ["IPv6 host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"2001:db8::1/128\"]" }],
  ["duplicate ingress", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"198.51.100.10/32\",\"198.51.100.10/32\"]" }],
  ["service tag", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"AzureCloud\"]" }],
  ["URL", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"https://example.invalid/\"]" }],
  ["wildcard", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"*\"]" }],
  ["unspecified host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"0.0.0.0/32\"]" }],
  ["zero network host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"0.0.0.1/32\"]" }],
  ["loopback host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"127.0.0.1/32\"]" }],
  ["multicast host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"224.0.0.1/32\"]" }],
  ["broadcast host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"255.255.255.255/32\"]" }],
  ["reserved host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"240.0.0.1/32\"]" }],
  ["link-local host", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: "[\"169.254.1.1/32\"]" }],
  ["too many hosts", { ...qaInputs, QA_HTTPS_INGRESS_CIDRS: JSON.stringify(Array.from({ length: 33 }, (_, index) => `10.62.0.${index + 1}/32`)) }],
  ["missing clone administration endpoints", { ...cloneInputs, CLONE_ADMIN_EGRESS_CIDRS: "[]" }],
  ["private clone administration host", { ...cloneInputs, CLONE_ADMIN_EGRESS_CIDRS: "[\"10.62.0.10/32\"]" }],
  ["documentation clone administration host", { ...cloneInputs, CLONE_ADMIN_EGRESS_CIDRS: "[\"198.51.100.10/32\"]" }],
  ["shared-address clone administration host", { ...cloneInputs, CLONE_ADMIN_EGRESS_CIDRS: "[\"100.64.0.1/32\"]" }],
  ["broad clone administration network", { ...cloneInputs, CLONE_ADMIN_EGRESS_CIDRS: "[\"1.1.1.0/24\"]" }],
  ["duplicate clone administration host", { ...cloneInputs, CLONE_ADMIN_EGRESS_CIDRS: "[\"1.1.1.1/32\",\"1.1.1.1/32\"]" }],
  ["clone HTTPS ingress", { ...cloneInputs, QA_HTTPS_INGRESS_CIDRS: "[\"198.51.100.10/32\"]" }],
  ["non-clone egress override", { ...qaInputs, CLONE_ADMIN_EGRESS_CIDRS: "[\"1.1.1.1/32\"]" }],
]

for (const [name, extra] of invalidNetworkInputs) {
  test(`network preflight rejects ${name} before any Azure call`, { timeout: 120_000 }, async () => {
    const ctx = await arm()
    const result = run(ctx, ctx.deploy, "apply", `APPLY ${extra.AZURE_RESOURCE_GROUP ?? group}`, extra)
    assert.notEqual(result.status, 0, name)
    assert.match(result.stderr, /rejected|required/)
    assert.deepEqual(calls(result.body), [], name)
    assert.deepEqual(result.captures, [], name)
  })
}

const unreadyFoundationStates = [
  ["MVP bootstrap refuses a nonempty dedicated group", { AZURE_RESOURCE_GROUP: "orchestra-sf-g08-qa", AZ_MOCK_RESOURCE_COUNT: "9" }],
  ["MVP bootstrap refuses an unobservable resource list", { AZURE_RESOURCE_GROUP: "orchestra-sf-g08-qa", AZ_MOCK_RESOURCE_ERROR: "true" }],
  ["MVP bootstrap refuses an empty count response", { AZURE_RESOURCE_GROUP: "orchestra-sf-g08-qa", AZ_MOCK_RESOURCE_COUNT: "" }],
  ["QA refuses a partial foundation deployment", { ...qaInputs, AZ_MOCK_FOUNDATION_STATE: "Failed" }],
  ["QA refuses an absent foundation VM", { ...qaInputs, AZ_MOCK_VM_ABSENT: "true" }],
  ["QA refuses a VM still provisioning", { ...qaInputs, AZ_MOCK_VM_STATE: "Creating" }],
]

for (const [name, extra] of unreadyFoundationStates) {
  test(name, { timeout: 120_000 }, async () => {
    const ctx = await arm()
    const result = run(ctx, ctx.deploy, "apply", `APPLY ${extra.AZURE_RESOURCE_GROUP}`, extra)
    assert.notEqual(result.status, 0, name)
    assert.equal(countVerb(result.body, "what-if"), 0, name)
    assert.equal(countVerb(result.body, "create"), 0, name)
    assert.deepEqual(result.captures, [], name)
  })
}
