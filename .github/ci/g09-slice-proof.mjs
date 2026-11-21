import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const [candidate, bytes, output] = process.argv.slice(2)
const require = createRequire(process.env.G09_PARSER_RESOLVER)
const ts = require("typescript")
assert.equal(ts.version, "5.9.3")
const fixture = JSON.parse(readFileSync(new URL("./g09-slice-cases.json", import.meta.url)))
const sha = (input) => createHash("sha256").update(input).digest("hex")
const digest = (value) => sha(JSON.stringify(value))
const read = (name) => readFileSync(path.join(bytes, name))
const git = (...args) => execFileSync("git", ["-C", candidate, ...args], { maxBuffer: 8 * 1024 * 1024 })
const source = (file) => git("show", fixture.sourceSHA + ":" + file)
const jsonc = (file, raw) => {
  const result = ts.parseConfigFileTextToJson(file, raw.toString())
  assert(!result.error, file + " must parse")
  return result.config
}
assert.equal(git("rev-parse", "HEAD").toString().trim(), fixture.sourceSHA)
assert.equal(git("rev-parse", "HEAD^{tree}").toString().trim(), fixture.sourceTreeSHA)
const provenance = JSON.parse(read("compile-provenance.json"))
assert.deepEqual([provenance.sourceSHA, provenance.sourceTreeSHA, provenance.runId, provenance.checkRunId, provenance.workflowSHA,
  provenance.archiveSha256, provenance.binary.sha256, provenance.cliSourceMaps.indexSha256],
[fixture.sourceSHA, fixture.sourceTreeSHA, fixture.producerRun, fixture.producerJob, fixture.producerWorkflow,
  fixture.archiveSha256, fixture.elfSha256, fixture.indexSha256])
const producerJob = JSON.parse(read("producer-job.json"))
assert.deepEqual([String(producerJob.id), String(producerJob.run_id), producerJob.run_attempt, producerJob.head_sha, producerJob.conclusion],
  [fixture.producerJob, fixture.producerRun, 1, fixture.producerWorkflow, "success"])
assert(producerJob.steps.some((step) => step.name === "Build Linux CLI at the selected candidate SHA" && step.conclusion === "success"))
const producerLog = read("producer-job.log")
assert.equal(sha(producerLog), fixture.producerLogSha256)
assert(producerLog.includes(Buffer.from("bun script/build.ts --single --skip-install --target linux-x64-baseline --external-compile-maps")))
assert(source("apps/cli/script/build.ts").includes(Buffer.from('tsconfig: "./tsconfig.json"')))
const indexBytes = read("cli-source-map-index.json")
assert.equal(sha(indexBytes), fixture.indexSha256)
const index = JSON.parse(indexBytes)
assert.equal(index.binarySha256, fixture.elfSha256)
const elf = read("orchestra")
assert.equal(sha(elf), fixture.elfSha256)
const lockBytes = source("bun.lock")
assert.equal(sha(lockBytes), fixture.lockfileSha256)
const lock = jsonc("bun.lock", lockBytes)
const packageConfig = new Map()

async function targetBytes(row) {
  const target = row.target
  if (target.kind === "git-tree-blob") {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(row.sourcePath), row.extends))
    assert.equal(resolved, target.path)
    const contents = source(resolved)
    assert.equal(git("rev-parse", fixture.sourceSHA + ":" + resolved).toString().trim(), target.gitBlob)
    return contents
  }
  assert.equal(target.kind, "lock-sri-tar-member")
  const dependency = row.extends.match(/^@tsconfig\/(bun|node22)\/tsconfig\.json$/)?.[1]
  assert(dependency)
  const name = "@tsconfig/" + dependency
  assert.deepEqual(lock.packages[name].filter((field) => typeof field === "string").filter(Boolean),
    [name + "@" + target.version, target.packageIntegrity])
  const expectedUrl = `https://registry.npmjs.org/${name}/-/${dependency}-${target.version}.tgz`
  assert.equal(target.source, expectedUrl)
  assert.equal(target.member, "package/tsconfig.json")
  if (!packageConfig.has(expectedUrl)) {
    const response = await fetch(expectedUrl, { redirect: "error", signal: AbortSignal.timeout(12_000) })
    assert(response.ok)
    const tar = Buffer.from(await response.arrayBuffer())
    assert(tar.length < 250_000)
    assert.equal("sha512-" + createHash("sha512").update(tar).digest("base64"), target.packageIntegrity)
    const member = execFileSync("tar", ["-xzOf", "-", target.member], { input: tar, maxBuffer: 250_000 })
    packageConfig.set(expectedUrl, member)
  }
  return packageConfig.get(expectedUrl)
}

assert.equal(fixture.tsconfig.length, 50)
const originalPaths = git("ls-tree", "-r", "-z", "--name-only", fixture.sourceSHA).toString().split("\0")
const configPattern = /(^|\/)tsconfig(?:\.[^/]+)?\.json$/
const actual = new Map(originalPaths.filter((file) => configPattern.test(file)).flatMap((file) => {
  const raw = source(file)
  const { extends: inherited } = jsonc(file, raw)
  return inherited === undefined ? [] : [[file, { inherited, hash: sha(raw) }]]
}))
assert.equal(actual.size, fixture.tsconfig.length)
const rowsByPath = new Map(fixture.tsconfig.map((row) => [row.sourcePath, row]))
assert.equal(rowsByPath.size, actual.size)
const configResults = []
for (const [name, observed] of actual) {
  const row = rowsByPath.get(name)
  assert.deepEqual(observed, { inherited: row.extends, hash: row.sourceSha256 }, name)
  const id = digest({ kind: "tsconfig-extends-requires-review", domain: "source", path: name,
    fileSha256: observed.hash, extends: observed.inherited })
  assert.equal(id, row.findingId)
  const seen = new Set()
  for (let link = row; link; link = rowsByPath.get(link.target.path)) {
    assert(!seen.has(link.findingId), "inheritance cycle")
    seen.add(link.findingId)
  }
  const parent = await targetBytes(row)
  assert.equal(sha(parent), row.target.sha256, name)
  const parentConfig = jsonc(row.target.member ?? row.target.path, parent)
  if (parentConfig.extends !== undefined)
    assert.equal(rowsByPath.get(row.target.path)?.extends, parentConfig.extends, "unverified parent inheritance")
  configResults.push({ id, sourcePath: name, targetSha256: row.target.sha256, resolution: "verified",
    buildSelection: name === "apps/cli/tsconfig.json" ? "observed-in-original-cli-build" : "not-observed" })
}
assert(!read("tar-members.txt").toString().split("\n").some((file) => configPattern.test(file)))

const moduleByName = new Map(index.modules.map((module) => [module.name, module]))
const tokens = new Map()
const mapPoints = new Map()
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
function pointsFor(lineData, lineLimit) {
  let sourceIndex = 0
  let sourceLine = 0
  let sourceColumn = 0
  const lines = lineData.split(";", lineLimit + 1)
  return lines.map((line) => {
    let column = 0
    const points = new Map()
    for (const segment of line ? line.split(",") : []) {
      const decoded = []
      let value = 0
      let shift = 0
      for (const ch of segment) {
        const digit = alphabet.indexOf(ch)
        assert(digit >= 0 && shift <= 30)
        value += (digit & 31) * 2 ** shift
        if (digit & 32) shift += 5
        else {
          decoded.push(value % 2 ? -Math.floor(value / 2) : value / 2)
          value = shift = 0
        }
      }
      assert(shift === 0 && [1, 4, 5].includes(decoded.length))
      column += decoded[0]
      const values = points.get(column) ?? []
      if (decoded.length > 1) {
        sourceIndex += decoded[1]
        sourceLine += decoded[2]
        sourceColumn += decoded[3]
        values.push([sourceIndex, sourceLine, sourceColumn])
      } else values.push(null)
      points.set(column, values)
    }
    return points
  })
}
function identifierAt(key, text, index, language) {
  if (!tokens.has(key)) {
    const tree = ts.createSourceFile(key, text, ts.ScriptTarget.Latest, false, language)
    const rows = new Map()
    function visit(node) {
      if (ts.isIdentifier(node)) rows.set(node.getStart(tree), node.getText(tree))
      ts.forEachChild(node, visit)
    }
    visit(tree)
    tokens.set(key, rows)
  }
  return tokens.get(key).get(index)
}
assert.equal(fixture.solid.length, 33)
assert.equal(new Set(fixture.solid.map((row) => row.id)).size, 33)
const solidResults = []
for (const row of fixture.solid) {
  const module = moduleByName.get(row.module)
  assert.equal(module.mapSha256, row.mapSha256)
  assert.equal(module.sha256, row.moduleSha256)
  const chunk = elf.subarray(module.offset, module.offset + module.byteLength)
  assert.equal(sha(chunk), row.moduleSha256)
  assert.equal(module.encoding, 1)
  const offset = row.elfOffset - module.offset
  assert(offset >= 0 && offset + row.length <= chunk.length)
  assert.equal(chunk.subarray(offset, offset + row.length).toString(), row.seed)
  assert.equal(digest({ domain: "archive", path: "bin/orchestra", fileSha256: fixture.elfSha256, byteOffset: row.elfOffset,
    byteLength: row.length, seed: row.seed, encoding: "utf8" }), row.id)
  const text = chunk.toString("latin1")
  assert.equal(identifierAt(row.module, text, offset, ts.ScriptKind.JS), row.seed)
  const prior = text.slice(0, offset)
  const line = prior.split("\n").length - 1
  const column = prior.length - prior.lastIndexOf("\n") - 1
  assert.deepEqual([line, column], [row.start.generatedLine, row.start.generatedStartColumn])
  if (!mapPoints.has(row.module)) {
    const map = execFileSync("tar", ["-xzOf", path.join(bytes, "cli-source-maps.tar.gz"), "./" + module.map], { maxBuffer: 32 * 1024 * 1024 })
    assert.equal(sha(map), row.mapSha256)
    const parsed = JSON.parse(map)
    assert.deepEqual(parsed.sources, module.sources.map((item) => item.source))
    const maxLine = Math.max(...fixture.solid.filter((other) => other.module === row.module).map((other) => other.start.generatedLine))
    mapPoints.set(row.module, pointsFor(parsed.mappings, maxLine))
  }
  const anchors = mapPoints.get(row.module)[line].get(column)
  assert(anchors?.length)
  for (const anchor of anchors)
    assert.deepEqual(anchor, [row.start.sourceIndex, row.start.sourceLine, row.start.sourceStartColumn])
  assert.deepEqual(module.sources[row.start.sourceIndex], { source: row.start.sourceName, sha256: row.intermediateSha256 })
  const raw = source(row.repositoryPath)
  assert.equal(sha(raw), row.sha256)
  assert.equal(git("rev-parse", fixture.sourceSHA + ":" + row.repositoryPath).toString().trim(), row.gitBlob)
  assert.equal(raw.subarray(row.gitOffset, row.gitOffset + row.length).toString(), row.seed)
  assert.equal(identifierAt(row.repositoryPath, raw.toString(), raw.subarray(0, row.gitOffset).toString().length, ts.ScriptKind.TSX), row.seed)
  solidResults.push({ id: row.id, repoPath: row.repositoryPath, elfOffset: row.elfOffset,
    matched: ["packaged-identifier", "exact-bun-start", "declared-intermediate-hash", "git-identifier"],
    endOfBunSpan: "not-proven", tuiExecution: "not-observed" })
}
const evidence = {
  schema: "sf-g09-existing-tar-slice-v1", artifactId: fixture.artifactId, sourceSHA: fixture.sourceSHA, sourceTreeSHA: fixture.sourceTreeSHA,
  archiveSha256: fixture.archiveSha256, elfSha256: fixture.elfSha256, cliSourceMapIndexSha256: fixture.indexSha256,
  producerRunId: fixture.producerRun, producerJobId: fixture.producerJob, producerWorkflowSHA: fixture.producerWorkflow,
  workflowSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  jobId: process.env.CHECK_RUN_ID, harnessSha256: sha(readFileSync(new URL(import.meta.url))),
  cases: [
    { name: "resolve all 50 reviewed tsconfig inheritance edges at the exact source and exclude the configs from the packaged tar", status: "pass", findings: configResults },
    { name: "verify 33 Solid identifier offsets and declared origin anchors in the published ELF", status: "pass", occurrences: solidResults },
  ],
}
writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 })
console.log(JSON.stringify({ tsconfigResolved: configResults.length, solidAnchorsReadBack: solidResults.length, tuiCasesExecuted: 0 }))
