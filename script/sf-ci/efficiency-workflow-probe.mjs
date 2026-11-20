import assert from "node:assert/strict"
const sf = Bun.YAML.parse(await Bun.file(".github/workflows/sf-ci.yml").text())
const surgical = Bun.YAML.parse(await Bun.file(".github/workflows/test-ci.yml").text())
const writer = Bun.YAML.parse(await Bun.file(".github/workflows/sf-cache-warm.yml").text())
assert.deepEqual(writer.on.push.branches, ["dev"])
assert.deepEqual(writer.permissions, { contents: "read" })
assert.ok(writer.jobs.warm.if.includes("github.event.repository.default_branch"))
assert.equal(writer.jobs.warm["runs-on"], "ubuntu-24.04")
assert.equal(Object.hasOwn(writer.on, "pull_request"), false)
assert.equal(Object.hasOwn(writer.on, "pull_request_target"), false)
for (const input of ["bunfig.toml", ".npmrc", "packages/core/bunfig.toml",
  "script/ci-cache-inputs.ts", "packages/core/vendor/*.tgz",
  "modules/sucafina/Sucafinav1/vendor/*.tgz", ".github/sf-cache-source.json"])
  assert.ok(writer.on.push.paths.includes(input), "missing cache trigger " + input)
assert.equal(surgical.jobs.test["timeout-minutes"], 45)
const requestSteps = surgical.jobs.test.steps
assert.equal(requestSteps.filter(step => step.uses?.startsWith("actions/setup-node@")).length, 1)
assert.equal(requestSteps.find(step => step.name === "Setup Bun").with["reuse-node"], "true")
assert.equal(requestSteps.find(step => step.name === "Run tests")["timeout-minutes"], 40)
assert.ok(requestSteps.find(step => step.name === "Read request").run.includes("verifyShardRequest(raw"))
assert.ok(requestSteps.find(step => step.name === "Read request").run.indexOf("verifyShardRequest(raw") <
  requestSteps.find(step => step.name === "Read request").run.indexOf("validateRequest(raw"))
for (const id of ["unit", "unit-sf"]) {
  const job = sf.jobs[id]
  const run = job.steps.find(step => step.id === "tests")
  assert.ok(run["timeout-minutes"] < job["timeout-minutes"])
  assert.ok(run.run.includes('files[$index]="./${files[$index]}"'))
  const performanceUpload = job.steps.find(step => step.name?.includes("timings separately"))
  assert.ok(performanceUpload.if.includes("always()"))
  assert.ok(!performanceUpload.with.name.startsWith("sf-evidence-"))
  const acceptanceUpload = job.steps.find(step => step.name?.startsWith("Publish only valid"))
  assert.equal(acceptanceUpload.if, "success()")
  assert.ok(!acceptanceUpload.with.path.includes("timings"))
}
assert.equal(sf.jobs["unit-sf"]["timeout-minutes"], 30)
assert.deepEqual(sf.jobs["unit-sf"].strategy.matrix.shard, [1,2,3,4,5,6,7,8])
assert.equal(sf.jobs.ui.strategy["max-parallel"], 2)
console.log("Workflow contracts: exact file mode, distinct timing evidence, diagnostic margin, Node reuse, safe cache promotion.")
