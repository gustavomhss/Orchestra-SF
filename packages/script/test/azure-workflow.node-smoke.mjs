import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import assert from "node:assert/strict"
import { test } from "node:test"
import { expectedPins, pins, requireHostedLinux, runActionlint, source, tool } from "./fixture/azure-tools.mjs"

const cloudGate = "github.repository == 'gustavomhss/Orchestra-SF' && github.ref == 'refs/heads/dev' && (inputs.operation == 'preview' || inputs.operation == 'apply')"
const scriptEnv = ["OPERATION", "VM_SIZE", "IMAGE_VERSION", "CONFIRM", "AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID", "AZURE_RESOURCE_GROUP", "AZURE_VM_SSH_PUBLIC_KEY"]

test("manual workflow gates Azure and actionlint accepts it", { timeout: 120_000 }, async () => {
  requireHostedLinux()
  assert.deepEqual(pins().yaml, expectedPins.yaml)
  assert.deepEqual(pins().actionlint, expectedPins.actionlint)
  const workflow = source(".github/workflows/azure-mvp.yml")
  const deploy = readFileSync(source("infra/azure/deploy.sh"), "utf8")
  const archive = await tool(pins().yaml, "yaml.tgz")
  const dir = path.dirname(archive)
  execFileSync("tar", ["-xzf", archive, "-C", dir])
  const doc = createRequire(import.meta.url)(path.join(dir, "package/dist/index.js")).parse(readFileSync(workflow, "utf8"))
  assert.deepEqual(Object.keys(doc.on), ["workflow_dispatch"])
  const inputs = doc.on.workflow_dispatch.inputs
  assert.equal(inputs.operation.type, "choice")
  assert.equal(inputs.operation.default, "validate")
  assert.deepEqual(inputs.operation.options, ["validate", "preview", "apply"])
  assert.equal(inputs.vm_size.default, "Standard_D2as_v5")
  assert.deepEqual(inputs.vm_size.options, ["Standard_D2as_v5", "Standard_D4as_v5"])
  assert.equal(inputs.image_version.type, "string")
  assert.equal(inputs.image_version.default, "")
  assert.equal(inputs.confirm.type, "string")
  assert.equal(inputs.confirm.default, "")
  assert.equal(doc.concurrency.group, "azure-mvp")
  assert.equal(doc.concurrency["cancel-in-progress"], false)
  assert.notEqual(doc.permissions, "write-all")
  assert.notEqual(doc.permissions?.["id-token"], "write")
  assert.deepEqual(Object.keys(doc.jobs).sort(), ["cloud", "validate"])
  const runs = (job) => (job.steps ?? []).map((step) => String(step.run ?? "")).join("\n")
  const uses = (job) => (job.steps ?? []).map((step) => String(step.uses ?? ""))
  const stepBlob = (step) => [step.uses, step.run, JSON.stringify(step.with ?? "")].join("\n")
  const cloudLike = (job) => (job.steps ?? []).some((step) => /azure\/login|infra\/azure\/deploy\.sh|\baz\s+deployment\b/.test(stepBlob(step)))
  for (const job of Object.values(doc.jobs)) assert.equal(/secrets\.|AZURE_CLIENT_SECRET|client-secret/.test(JSON.stringify(job)), false)
  const validate = doc.jobs.validate
  assert.equal(cloudLike(validate), false)
  assert.equal(validate["runs-on"], "ubuntu-24.04")
  assert.equal(JSON.stringify(validate).includes("24.15"), true)
  assert.equal(validate.permissions?.["id-token"], undefined)
  assert.equal(uses(validate).some((use) => use.includes("azure/login")), false)
  assert.equal(runs(validate).includes("infra/azure/deploy.sh"), false)
  assert.doesNotMatch(runs(validate), /az\s+deployment/)
  assert.match(runs(validate), /azure-foundation\.node-smoke\.mjs/)
  assert.match(runs(validate), /azure-workflow\.node-smoke\.mjs/)
  assert.match(runs(validate), /--test/)
  const cloud = Object.values(doc.jobs).filter(cloudLike)
  assert.equal(cloud.length, 1)
  assert.equal(cloud[0], doc.jobs.cloud)
  const job = cloud[0]
  assert.equal(job.permissions["id-token"], "write")
  assert.notEqual(job.permissions, "write-all")
  assert.equal(uses(job).some((use) => use.includes("azure/login")), true)
  const environment = typeof job.environment === "object" ? job.environment.name : job.environment
  assert.equal(environment, "azure-mvp")
  const needs = Array.isArray(job.needs) ? job.needs : [job.needs]
  assert.deepEqual(needs, ["validate"])
  assert.equal(String(job.if ?? "").trim().replaceAll(/\s+/g, " "), cloudGate)
  const step = (job.steps ?? []).find((item) => String(item.run ?? "").includes("bash infra/azure/deploy.sh"))
  const env = { ...(job.env ?? {}), ...(step?.env ?? {}) }
  for (const name of scriptEnv) assert.ok(Object.hasOwn(env, name), name)
  assert.match(String(env.OPERATION), /inputs\.operation/)
  assert.match(String(env.VM_SIZE), /inputs\.vm_size/)
  assert.match(String(env.IMAGE_VERSION), /inputs\.image_version/)
  assert.match(String(env.CONFIRM), /inputs\.confirm/)
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
