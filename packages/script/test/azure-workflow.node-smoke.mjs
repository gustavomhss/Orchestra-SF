import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import assert from "node:assert/strict"
import { test } from "node:test"
import { expectedPins, pins, requireHostedLinux, runActionlint, source, tool } from "./fixture/azure-tools.mjs"

const checkout = "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
const setupNode = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"
const azureLogin = "azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6"
const cloudGate = "github.repository == 'gustavomhss/Orchestra-SF' && github.ref == 'refs/heads/dev' && (inputs.operation == 'preview' || inputs.operation == 'apply')"
const scriptEnv = ["OPERATION", "VM_SIZE", "IMAGE_VERSION", "CONFIRM", "AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID", "AZURE_RESOURCE_GROUP", "AZURE_VM_SSH_PUBLIC_KEY"]
const inputExpr = /\$\{\{\s*inputs\./
const loginWith = { "client-id": "${{ vars.AZURE_CLIENT_ID }}", "tenant-id": "${{ vars.AZURE_TENANT_ID }}", "subscription-id": "${{ vars.AZURE_SUBSCRIPTION_ID }}" }
let parsing

test("manual workflow gates Azure and actionlint accepts it", { timeout: 120_000 }, async () => {
  requireHostedLinux()
  assert.deepEqual([pins().yaml, pins().actionlint, pins().bicep], [expectedPins.yaml, expectedPins.actionlint, expectedPins.bicep])
  const workflow = source(".github/workflows/azure-mvp.yml")
  const deploy = readFileSync(source("infra/azure/deploy.sh"), "utf8")
  const doc = await parseWorkflow(readFileSync(workflow, "utf8"))
  assertPinned(doc)
  assert.deepEqual(Object.keys(doc.on), ["workflow_dispatch"])
  const inputs = doc.on.workflow_dispatch.inputs
  assert.equal(inputs.operation.type, "choice")
  assert.equal(inputs.operation.default, "validate")
  assert.deepEqual(inputs.operation.options, ["validate", "preview", "apply"])
  assert.equal(inputs.vm_size.default, "Standard_D2as_v5")
  assert.deepEqual(inputs.vm_size.options, ["Standard_D2as_v5", "Standard_D4as_v5"])
  assert.deepEqual([inputs.image_version.type, inputs.image_version.default, inputs.confirm.type, inputs.confirm.default], ["string", "", "string", ""])
  assert.equal(doc.concurrency.group, "azure-mvp")
  assert.equal(doc.concurrency["cancel-in-progress"], false)
  assert.deepEqual(doc.permissions, { contents: "read" })
  assert.deepEqual(Object.keys(doc.jobs).sort(), ["cloud", "validate"])
  const runs = (job) => (job.steps ?? []).map((step) => String(step.run ?? "")).join("\n")
  const cloudLike = (job) => /azure\/login|infra\/azure\/deploy\.sh|\baz\s+deployment\b/.test((job.steps ?? []).map((step) => [step.uses, step.run, JSON.stringify(step.with ?? "")].join("\n")).join("\n"))
  for (const job of Object.values(doc.jobs)) {
    assert.equal(/secrets\.|AZURE_CLIENT_SECRET|client-secret/.test(JSON.stringify(job)), false)
    const steps = (job.steps ?? []).map((step) => ({ ...step, env: undefined }))
    assert.equal(inputExpr.test(JSON.stringify({ ...job, env: undefined, steps })), false)
  }
  const validate = doc.jobs.validate
  assert.equal(cloudLike(validate), false)
  assert.equal(validate["runs-on"], "ubuntu-24.04")
  assert.equal(JSON.stringify(validate).includes("24.15"), true)
  assert.equal(validate.permissions, undefined)
  assert.equal(runs(validate).includes("infra/azure/deploy.sh"), false)
  assert.doesNotMatch(runs(validate), /az\s+deployment/)
  assert.deepEqual(runs(validate).trim().split(/\s+/), ["node", "--test", "packages/script/test/azure-foundation.node-smoke.mjs", "packages/script/test/azure-workflow.node-smoke.mjs", "packages/script/test/azure-bootstrap.node-smoke.mjs", "packages/script/test/azure-deploy.node-smoke.mjs"])
  const job = doc.jobs.cloud
  assert.equal(cloudLike(job), true)
  assert.equal(Object.values(doc.jobs).filter(cloudLike).length, 1)
  assert.deepEqual(job.permissions, { contents: "read", "id-token": "write" })
  const environment = typeof job.environment === "object" ? job.environment.name : job.environment
  assert.equal(environment, "azure-mvp")
  const needs = Array.isArray(job.needs) ? job.needs : [job.needs]
  assert.deepEqual(needs, ["validate"])
  assert.equal(String(job.if ?? "").trim().replaceAll(/\s+/g, " "), cloudGate)
  const step = (job.steps ?? []).find((item) => String(item.run ?? "").includes("bash infra/azure/deploy.sh"))
  const env = { ...(job.env ?? {}), ...(step?.env ?? {}) }
  for (const name of scriptEnv) assert.ok(Object.hasOwn(env, name), name)
  assert.deepEqual([env.OPERATION, env.VM_SIZE, env.IMAGE_VERSION, env.CONFIRM], ["${{ inputs.operation }}", "${{ inputs.vm_size }}", "${{ inputs.image_version }}", "${{ inputs.confirm }}"])
  // Known what-if and create lines share the bicep outfile. This is not a proof of arbitrary shell control flow.
  assert.match(deploy, /template="\$\{work_dir\}\/main\.json"/)
  assert.match(deploy, /"\$bicep_bin" build infra\/azure\/main\.bicep --outfile "\$template"/)
  const whatIf = deploy.indexOf("az deployment group what-if")
  const confirmAt = deploy.indexOf('if [[ "$CONFIRM" != "APPLY ${AZURE_RESOURCE_GROUP}" ]]')
  const createAt = deploy.indexOf("az deployment group create")
  assert.ok(whatIf >= 0 && confirmAt > whatIf && createAt > confirmAt)
  assert.match(deploy.slice(whatIf, confirmAt), /--mode Incremental[\s\S]*--template-file "\$template"/)
  assert.match(deploy.slice(createAt), /--mode Incremental[\s\S]*--template-file "\$template"/)
  assert.match(deploy, /python/)
  assert.match(deploy, /AzureCloud/)
  assert.match(deploy, /(?:\\d|\[0-9\])\+(?:\\.|\.)(?:\\d|\[0-9\])\+(?:\\.|\.)(?:\\d|\[0-9\])\+/)
  for (const name of scriptEnv) assert.ok(deploy.includes(name), name)
  const dumped = `${JSON.stringify(doc)}\n${deploy}`
  for (const name of scriptEnv.slice(4)) assert.ok(dumped.includes(name), name)
  assert.equal(/AZURE_CLIENT_SECRET|client-secret|role assignment|roleAssignments|az\s+group\s+delete|deployment\s+group\s+delete|invitation/.test(dumped), false)
  runActionlint(await tool(pins().actionlint, "actionlint.tar.gz"), workflow)
})

function assertPinned(doc) {
  const steps = Object.values(doc.jobs).flatMap((job) => job.steps ?? [])
  const uses = steps.flatMap((step) => (step.uses ? [String(step.uses)] : []))
  for (const use of uses) if (![checkout, setupNode, azureLogin].includes(use)) assert.fail(use)
  assert.deepEqual(uses, [checkout, setupNode, checkout, azureLogin])
  for (const step of steps) if (step.uses === checkout) assert.equal(step.with?.["persist-credentials"], false)
  assert.deepEqual(steps.find((step) => step.uses === azureLogin).with, loginWith)
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
