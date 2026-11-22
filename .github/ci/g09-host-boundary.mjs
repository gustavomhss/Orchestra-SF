// Cross-run installed-route observation. This is not the canonical G09 qualifier or a signer.
import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:net"
import { spawn } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import { setTimeout } from "node:timers/promises"

const origin = "https://sf.example.test"
const mount = "/sucafina"
const transport = {}

const [mode, evidenceArg, sourceArg, releaseArg] = process.argv.slice(2)
const env = process.env
assert(["metadata", "archive", "probe"].includes(mode))
assert.equal(env.GITHUB_ACTIONS, "true")
assert.equal(env.GITHUB_REPOSITORY, "gustavomhss/Orchestra-SF")
assert.equal(env.GITHUB_REPOSITORY_ID, "1455724710")
assert.equal(env.GITHUB_REF, "refs/heads/g09-host-boundary")
assert.equal(env.RUNNER_OS, "Linux")
assert.equal(env.RUNNER_ARCH, "X64")
assert.match(env.CHECK_RUN_ID ?? "", /^[1-9][0-9]*$/)
const temporary = fs.realpathSync(env.RUNNER_TEMP)
const root = fs.realpathSync(process.cwd())
const source = fs.realpathSync(sourceArg)
const within = (base, file) => file === base || file.startsWith(base + path.sep)
function external(value) {
  assert(path.isAbsolute(value))
  const real = fs.realpathSync(value)
  assert(within(temporary, real) && !within(root, real) && !within(source, real))
  assert(fs.lstatSync(real).isDirectory())
  return real
}
const evidence = external(evidenceArg)
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const fileHash = (file) => sha256(fs.readFileSync(file))
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const write = (name, value) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 })
const expected = json(path.join(evidence, "expected.json"))
assert.equal(expected.schema, "sf-g09-host-boundary-input-v1")
assert.equal(expected.repository, env.GITHUB_REPOSITORY)
assert.equal(expected.repositoryId, env.GITHUB_REPOSITORY_ID)
const scannerPath = path.join(source, "script/sf-ci/team-profile-residue.mjs")
const scannerBytes = fs.readFileSync(scannerPath)
const gitBlob = (bytes) => createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex")
assert.equal(gitBlob(scannerBytes), expected.sourceFiles["script/sf-ci/team-profile-residue.mjs"])
const { readTarArchive, parseCanonicalJson, verifyGitSource } = await import(pathToFileURL(scannerPath).href)
const canonical = (file) => parseCanonicalJson(fs.readFileSync(file), path.basename(file))
const producerSource = verifyGitSource(fs.readFileSync(path.join(evidence, "producer-commit.raw")),
  fs.readFileSync(path.join(evidence, "producer-tracked.z")), expected.producer.sourceSHA)
assert.equal(producerSource.tree, expected.producer.sourceTreeSHA)
const entries = new Map(producerSource.entries.map((entry) => [entry.path, entry]))
const sourceFiles = Object.entries(expected.sourceFiles).map(([name, oid]) => {
  assert.equal(entries.get(name)?.oid, oid, "source tree entry: " + name)
  const file = path.join(source, name)
  assert.equal(fs.realpathSync(file), file)
  const bytes = fs.readFileSync(file)
  assert.equal(gitBlob(bytes), oid, "source bytes: " + name)
  return { path: name, gitBlob: oid, sha256: sha256(bytes) }
})
const examinationSource = verifyGitSource(fs.readFileSync(path.join(evidence, "examination-commit.raw")),
  fs.readFileSync(path.join(evidence, "examination-tracked.z")), env.GITHUB_SHA)
const examinedEntries = new Map(examinationSource.entries.map((entry) => [entry.path, entry]))
const examinationFiles = [".github/ci/g09-host-boundary.mjs", ".github/ci/g09-host-boundary-input.json",
  ".github/workflows/g09-host-boundary.yml"].map((name) => {
  const bytes = fs.readFileSync(path.join(root, name))
  assert.equal(gitBlob(bytes), examinedEntries.get(name)?.oid, "examination source: " + name)
  return { path: name, gitBlob: gitBlob(bytes), sha256: sha256(bytes) }
})
assert.equal(fileHash(path.join(evidence, "expected.json")), fileHash(path.join(root, ".github/ci/g09-host-boundary-input.json")))
assert.equal(fs.realpathSync(fileURLToPath(import.meta.url)), path.join(root, ".github/ci/g09-host-boundary.mjs"))
const producerBinding = { ...expected.producer, repository: expected.repository, repositoryId: expected.repositoryId,
  artifact: expected.artifact }
const examinationBinding = { sourceSHA: env.GITHUB_SHA, sourceTreeSHA: examinationSource.tree,
  workflowSHA: env.GITHUB_SHA, workflowPath: ".github/workflows/g09-host-boundary.yml",
  runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, job: "g09-host-boundary",
  checkRunId: env.CHECK_RUN_ID, event: env.GITHUB_EVENT_NAME, branch: "g09-host-boundary",
  repository: env.GITHUB_REPOSITORY, repositoryId: env.GITHUB_REPOSITORY_ID, files: examinationFiles }

if (mode === "metadata") {
  const artifact = json(path.join(evidence, "producer-artifact.json"))
  const run = json(path.join(evidence, "producer-run.json"))
  const jobs = json(path.join(evidence, "producer-jobs.json"))
  const currentRun = json(path.join(evidence, "examination-run.json"))
  const currentJobs = json(path.join(evidence, "examination-jobs.json"))
  function runIdentity(value) {
    return [String(value.id), String(value.run_attempt), value.head_sha, value.head_branch, value.path,
      value.event, String(value.repository.id), value.repository.full_name]
  }
  const p = expected.producer
  assert.deepEqual(runIdentity(run), [p.runId, p.runAttempt, p.workflowSHA, p.branch, p.workflowPath,
    p.event, expected.repositoryId, expected.repository])
  assert.deepEqual(runIdentity(currentRun), [env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT, env.GITHUB_SHA,
    "g09-host-boundary", examinationBinding.workflowPath, "push", expected.repositoryId, expected.repository])
  assert.equal(jobs.total_count, jobs.jobs.length)
  assert.equal(currentJobs.total_count, currentJobs.jobs.length)
  const producer = jobs.jobs.filter((job) => String(job.id) === p.jobId)
  assert.equal(producer.length, 1)
  assert.equal(String(producer[0].run_attempt), p.runAttempt)
  const checkURL = "https://api.github.com/repos/" + expected.repository + "/check-runs/"
  assert.deepEqual([producer[0].name, String(producer[0].run_id), producer[0].head_sha,
    producer[0].check_run_url, producer[0].status, producer[0].conclusion],
    [p.job, p.runId, p.sourceSHA, checkURL + p.checkRunId, "completed", "success"])
  const current = currentJobs.jobs.filter((job) => job.check_run_url === checkURL + env.CHECK_RUN_ID)
  assert.equal(current.length, 1)
  assert.equal(String(current[0].run_attempt), env.GITHUB_RUN_ATTEMPT)
  assert.deepEqual([current[0].name, String(current[0].run_id), current[0].head_sha, current[0].status],
    [examinationBinding.job, env.GITHUB_RUN_ID, env.GITHUB_SHA, "in_progress"])
  examinationBinding.jobId = String(current[0].id)
  assert.deepEqual([String(artifact.id), artifact.name, artifact.digest, artifact.expired,
    String(artifact.workflow_run.id), artifact.workflow_run.head_sha,
    String(artifact.workflow_run.repository_id), String(artifact.workflow_run.head_repository_id), artifact.size_in_bytes],
    [expected.artifact.id, expected.artifact.name, expected.artifact.digest, false, p.runId, p.sourceSHA,
      expected.repositoryId, expected.repositoryId, expected.artifact.bytes])
  const zip = path.join(evidence, "product.zip")
  assert.equal(fs.statSync(zip).size, expected.artifact.bytes)
  assert.equal("sha256:" + fileHash(zip), expected.artifact.digest)
  write("acquisition-binding.json", { schema: "sf-g09-cross-run-acquisition-v1", producerBinding, examinationBinding,
    sourceFiles, inputSha256: fileHash(path.join(evidence, "expected.json")),
    metadataFiles: ["producer-artifact.json", "producer-run.json", "producer-jobs.json", "examination-run.json", "examination-jobs.json"]
      .map((name) => ({ path: name, sha256: fileHash(path.join(evidence, name)) })),
    originalZipBytes: fs.statSync(zip).size, originalZipSha256: fileHash(zip),
    canonicalQualification: false, signed: false, formalG09Pass: false })
  console.log("HOST_BOUNDARY_ACQUISITION_VERIFIED", expected.artifact.id)
} else if (mode === "archive") {
  const acquisition = canonical(path.join(evidence, "acquisition-binding.json"))
  assert.equal("sha256:" + fileHash(path.join(evidence, "product.zip")), expected.artifact.digest)
  assert.deepEqual(acquisition.producerBinding, producerBinding)
  assert.equal(acquisition.examinationBinding.sourceSHA, env.GITHUB_SHA)
  const packaged = external(path.join(evidence, "package"))
  const compressed = fs.readFileSync(path.join(packaged, expected.archive.file))
  assert.equal(sha256(compressed), expected.archive.sha256)
  const files = readTarArchive(compressed)
  const byPath = new Map(files.map((file) => [file.path, file]))
  const manifest = JSON.parse(byPath.get("distribution.json")?.text ?? "null")
  assert.equal(manifest.target, expected.archive.target)
  assert.equal(files.length, manifest.files.length + 2)
  assert.equal(byPath.get(expected.archive.binaryPath)?.sha256, expected.archive.binarySha256)
  const factorySha256 = byPath.get(expected.archive.factoryPath)?.sha256
  assert.match(factorySha256 ?? "", /^[a-f0-9]{64}$/)
  const native = canonical(path.join(packaged, "orchestra-sf-entra-package-receipt.json"))
  const p = expected.producer, a = expected.archive
  assert.deepEqual([native.schema, native.proof, native.sourceSHA, native.checkoutSHA, native.expectedSourceSHA,
    native.target, native.archiveFile, native.archiveSha256, native.manifestSha256, native.bundleSha256, native.runID, native.runAttempt],
    ["sf-entra-factory-package-v1", "packaged", p.sourceSHA, p.sourceSHA, p.sourceSHA, a.target,
      a.file, a.sha256, byPath.get("distribution.json").sha256, factorySha256, p.runId, p.runAttempt])
  const receipt = canonical(path.join(packaged, "g09-artifact-receipt.json"))
  const inventoryName = a.file + ".inventory.json"
  const inventory = canonical(path.join(packaged, inventoryName))
  const listed = files.map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  assert.deepEqual(inventory, { schema: "sf-teams-archive-inventory-v1", sourceSHA: p.sourceSHA,
    sourceTreeSHA: p.sourceTreeSHA, archiveFile: a.file, archiveSha256: a.sha256, files: listed })
  assert.deepEqual([receipt.schema, receipt.proofRole, receipt.sourceSHA, receipt.sourceTreeSHA, receipt.target,
    receipt.version, receipt.archiveFile, receipt.archiveSha256, receipt.archiveBytes, receipt.manifestSha256,
    receipt.inventoryFile, receipt.inventorySha256, receipt.fileCount, receipt.archiveFileCount, receipt.webFileCount,
    receipt.brand, receipt.channel, receipt.viteEnvironmentInputs, receipt.extractedVerified],
    ["sf-teams-production-artifact-v1", "sf-production-archive", p.sourceSHA, p.sourceTreeSHA, a.target,
      manifest.version, a.file, a.sha256, compressed.length, byPath.get("distribution.json").sha256,
      inventoryName, fileHash(path.join(packaged, inventoryName)), manifest.files.length, files.length,
      manifest.files.filter((file) => file.path.startsWith("bin/web/")).length, "sucafina", "prod", 0, true])
  const compile = canonical(path.join(packaged, "compile-provenance.json"))
  const ledger = json(path.join(packaged, "compile-evidence.json"))
  assert.deepEqual([compile.schema, compile.sourceSHA, compile.sourceTreeSHA, compile.workflowSHA,
    compile.runId, compile.runAttempt, compile.job, compile.checkRunId, compile.target, compile.binary?.path,
    compile.binary?.sha256, compile.archiveSha256],
    ["sf-linux-compile-provenance-v2", p.sourceSHA, p.sourceTreeSHA, p.workflowSHA, p.runId, p.runAttempt,
      p.job, p.checkRunId, a.target, a.binaryPath, a.binarySha256, a.sha256])
  assert.deepEqual([ledger.schema, ledger.target, ledger.binary?.sha256],
    ["orchestra-compile-evidence-v2", a.target, a.binarySha256])
  assert(Array.isArray(ledger.inputs) && ledger.inputs.length > 0)
  for (const [key, name] of [["ledger", "compile-evidence.json"], ["webManifest", "web-build-manifest.json"],
    ["cliSourceMaps", "cli-source-maps.tar.gz"]]) {
    assert.equal(compile[key]?.file, name)
    assert.equal(compile[key]?.sha256, fileHash(path.join(packaged, name)))
  }
  assert.equal(compile.cliSourceMaps.index, "cli-source-map-index.json")
  assert.equal(compile.cliSourceMaps.indexSha256, fileHash(path.join(packaged, compile.cliSourceMaps.index)))
  write("archive-binding.json", { schema: "sf-g09-cross-run-archive-v1", producerBinding,
    examinationBinding: acquisition.examinationBinding, acquisitionBindingSha256: fileHash(path.join(evidence, "acquisition-binding.json")),
    sourceFiles, archiveSha256: a.sha256, binarySha256: a.binarySha256, factorySha256,
    manifestSha256: native.manifestSha256, archiveMembers: listed,
    originalReceipts: ["g09-artifact-receipt.json", inventoryName, "orchestra-sf-entra-package-receipt.json",
      "compile-provenance.json", "compile-evidence.json", "web-build-manifest.json",
      "cli-source-map-index.json", "cli-source-maps.tar.gz", "factory-source-map.json", "factory-source-map-receipt.json"]
      .map((name) => ({ path: name, sha256: fileHash(path.join(packaged, name)) })),
    canonicalQualification: false, signed: false, formalG09Pass: false })
  console.log("HOST_BOUNDARY_ARCHIVE_VERIFIED", files.length)
} else {
  await probe()
}

// Node v24.15.0's deps/undici/src/lib/web/fetch/index.js deletes Host before dispatch.
// The installed ingress requires the configured virtual Host, including its port.
function request(route, { cookie, basic, withProof = true, accept = "text/html", method = "GET", timeout = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    const operation = http.request(transport.local + route, {
      method, agent: false, signal: AbortSignal.timeout(timeout), maxHeaderSize: 16 * 1024,
      headers: { accept, host: transport.host, ...(withProof ? { "x-sf-ingress-proof": transport.proof } : {}),
        ...(cookie ? { cookie } : {}), ...(basic ? { authorization: basic } : {}),
        ...(method === "GET" ? {} : { origin }) },
    }, (incoming) => {
      const chunks = []
      let bytes = 0
      incoming.on("data", (chunk) => {
        bytes += chunk.length
        if (bytes > 2 * 1024 * 1024) {
          incoming.destroy(new Error("Boundary HTTP response exceeded 2 MiB"))
          return
        }
        chunks.push(chunk)
      })
      incoming.once("error", reject)
      incoming.once("end", () => {
        const headers = new Headers()
        for (let offset = 0; offset < incoming.rawHeaders.length; offset += 2)
          headers.append(incoming.rawHeaders[offset], incoming.rawHeaders[offset + 1])
        // Native http never follows redirects; preserve each Set-Cookie separately.
        resolve(new Response(bytes ? Buffer.concat(chunks) : null, {
          status: incoming.statusCode, statusText: incoming.statusMessage, headers,
        }))
      })
    })
    operation.once("error", reject)
    operation.end()
  })
}

async function signIn(identity) {
  const start = await request(mount + "/auth/login?returnTo=%2F")
  assert.equal(start.status, 303, "login start")
  const authority = new URL(start.headers.get("location"))
  assert.equal(authority.origin, "https://login.microsoftonline.com")
  assert.equal(authority.searchParams.get("redirect_uri"), origin + mount + "/auth/callback")
  const nonce = authority.searchParams.get("nonce")
  const challenge = authority.searchParams.get("code_challenge")
  const state = authority.searchParams.get("state")
  assert(nonce && challenge && state)
  const login = start.headers.getSetCookie().find((value) => value.includes("_login="))
  assert(login?.includes("; Secure"))
  const params = new URLSearchParams({ code: [identity, nonce, challenge].join("."), state })
  const finish = await request(mount + "/auth/callback?" + params, { cookie: login.split(";")[0] })
  assert.equal(finish.status, 303, "signed callback")
  assert.equal(new URL(finish.headers.get("location"), origin).href, origin + "/", "callback returns to native Web root")
  const session = finish.headers.getSetCookie().find((value) => value.includes("_session="))
  assert(session?.includes("; Secure") && session.includes("; HttpOnly"))
  return session.split(";")[0]
}

async function probe() {
  const binding = canonical(path.join(evidence, "archive-binding.json"))
  assert.deepEqual(binding.producerBinding, producerBinding)
  assert.equal(binding.examinationBinding.sourceSHA, env.GITHUB_SHA)
  assert.equal(binding.examinationBinding.runId, env.GITHUB_RUN_ID)
  assert.equal(binding.examinationBinding.checkRunId, env.CHECK_RUN_ID)
  const release = external(releaseArg)
  assert.equal(path.basename(release), "g09-host-boundary-release")
  const binary = path.join(release, expected.archive.binaryPath)
  const factory = path.join(release, expected.archive.factoryPath)
  const modes = json(path.join(evidence, "installation-modes.json"))
  assert.equal(modes.status, "APPLIED_AND_BYTES_VERIFIED")
  assert.equal(modes.installerGitBlob, expected.sourceFiles["sf/azure/vm/install-factory-distribution.py"])
  assert.equal(modes.manifestSha256, binding.manifestSha256)
  for (const member of binding.archiveMembers) {
    const installed = path.join(release, member.path)
    assert.equal(fs.realpathSync(installed), installed)
    assert(fs.lstatSync(installed).isFile())
    assert.equal(fs.statSync(installed).size, member.byteLength)
    assert.equal(fileHash(installed), member.sha256)
  }
  assert.equal(fileHash(binary), expected.archive.binarySha256)
  assert.equal(fileHash(factory), binding.factorySha256)
  assert.equal(fs.statSync(binary).mode & 0o777, 0o555)
  const httpSource = fs.readFileSync(path.join(source, ".github/ci/entra-native-http.mjs"), "utf8")
  assert(httpSource.includes(signIn.toString()), "signIn must remain byte-identical to the fixed source function")
  const runtime = fs.mkdtempSync(path.join(temporary, "g09-host-boundary-runtime-"))
  fs.chmodSync(runtime, 0o700)
  const config = path.join(runtime, "installation")
  const workspace = path.join(runtime, "workspace")
  const database = path.join(config, "host-data", "orchestra.db")
  const databaseNames = ["orchestra.db", "orchestra.db-wal", "orchestra.db-shm", "orchestra.db-journal"]
  const result = { schema: "sf-g09-installed-host-boundary-observation-v1", status: "FAIL_CLOSED",
    producerBinding: binding.producerBinding, examinationBinding: binding.examinationBinding,
    archiveBindingSha256: fileHash(path.join(evidence, "archive-binding.json")),
    installationModesSha256: fileHash(path.join(evidence, "installation-modes.json")),
    archiveSha256: binding.archiveSha256, binarySha256: binding.binarySha256, factorySha256: binding.factorySha256,
    scope: "Installed Microsoft dedicated host, controlled Entra/Graph transport, temporary isolated data",
    suppliedIdentifier: { value: expected.fixture.suppliedSavedPermissionId, existingSavedRowClaimed: false },
    sourceFiles, signInFunctionSha256: sha256(signIn.toString()), checks: [], databaseCheckpoints: [],
    databaseEvents: [], ignoredDatabaseDirectoryEvents: 0, processIdentity: [],
    canonicalQualification: false, signed: false, formalG09Pass: false, azureDeployment: false,
    browserInteraction: false, liveMicrosoftTenant: false,
    requestTransport: { implementation: "node:http.request", redirectsFollowed: false,
      timeoutMs: 20_000, maximumResponseBytes: 2 * 1024 * 1024, maximumHeaderBytes: 16 * 1024,
      reason: "Node v24.15.0 bundled fetch removes the virtual Host required by trusted ingress",
      upstreamSource: "https://github.com/nodejs/node/blob/v24.15.0/deps/undici/src/lib/web/fetch/index.js" } }
  let child, watcher, exit, stage = "prepare", failure, ownedStartTime
  const output = { stdout: createHash("sha256"), stderr: createHash("sha256"), stdoutBytes: 0, stderrBytes: 0 }
  function procState() {
    const text = fs.readFileSync("/proc/" + child.pid + "/stat", "utf8")
    const fields = text.slice(text.lastIndexOf(")") + 2).split(" ")
    return { startTime: fields[19], groupId: Number(fields[2]), sessionId: Number(fields[3]) }
  }
  function identity(label) {
    const state = procState()
    assert.equal(state.groupId, child.pid)
    assert.equal(state.sessionId, child.pid)
    if (ownedStartTime) assert.equal(state.startTime, ownedStartTime)
    ownedStartTime = state.startTime
    const executable = fs.readlinkSync("/proc/" + child.pid + "/exe")
    assert.equal(executable, binary)
    assert.equal(fileHash("/proc/" + child.pid + "/exe"), expected.archive.binarySha256)
    assert.equal(fs.realpathSync("/proc/" + child.pid + "/cwd"), workspace)
    assert.equal(fileHash(factory), binding.factorySha256)
    const actualEnvironment = Object.fromEntries(fs.readFileSync("/proc/" + child.pid + "/environ", "utf8")
      .split("\0").filter(Boolean).map((entry) => { const separator = entry.indexOf("="); return [entry.slice(0, separator), entry.slice(separator + 1)] }))
    assert.equal(actualEnvironment.SF_PROOF_FACTORY, factory)
    assert.equal(actualEnvironment.ORCHESTRA_DB, database)
    assert.deepEqual(Object.keys(actualEnvironment).sort(), result.childEnvironmentKeys)
    result.processIdentity.push({ checkpoint: label, pid: child.pid, ...state,
      executable, executableSha256: expected.archive.binarySha256, factory, factorySha256: binding.factorySha256,
      cwd: workspace, factoryEnvironmentObserved: true, coreDatabaseEnvironmentObserved: database,
      environmentKeys: Object.keys(actualEnvironment).sort(), cmdlineSha256: fileHash("/proc/" + child.pid + "/cmdline") })
  }
  async function databaseAbsent(label) {
    await new Promise((resolve) => setImmediate(resolve))
    const present = databaseNames.filter((name) => fs.existsSync(path.join(config, "host-data", name)))
    const descriptors = child && child.exitCode === null && child.signalCode === null
      ? fs.readdirSync("/proc/" + child.pid + "/fd").flatMap((name) => {
        try {
          const target = fs.readlinkSync("/proc/" + child.pid + "/fd/" + name)
          return databaseNames.some((file) => target === path.join(config, "host-data", file) ||
            target === path.join(config, "host-data", file) + " (deleted)") ? [target] : []
        } catch (error) { if (error.code === "ENOENT") return []; throw error }
      }) : []
    result.databaseCheckpoints.push({ checkpoint: label, expectedPath: database, checkedNames: databaseNames,
      present, openCoreDatabaseDescriptors: descriptors })
    assert.deepEqual(present, [], "Core database appeared at " + label)
    assert.deepEqual(descriptors, [], "Core database opened at " + label)
    assert.deepEqual(result.databaseEvents, [], "Core database event observed")
  }
  try {
    const { prepareLocalConfiguration } = await import(pathToFileURL(path.join(source,
      "modules/sucafina/Sucafinav1/runtime/local-configuration.ts")).href)
    const configuration = await prepareLocalConfiguration(config)
    fs.mkdirSync(workspace, { mode: 0o700 })
    const reserved = createServer()
    await new Promise((resolve, reject) => { reserved.once("error", reject); reserved.listen(0, "127.0.0.1", resolve) })
    const port = reserved.address().port
    await new Promise((resolve, reject) => reserved.close((error) => error ? reject(error) : resolve()))
    transport.local = "http://127.0.0.1:" + port
    transport.host = "sf-ingress.example.test:" + port
    transport.proof = randomBytes(32).toString("hex")
    const fixture = expected.fixture
    fs.writeFileSync(configuration, JSON.stringify({ version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, listenerOrigin: transport.local, ingressOrigin: "http://" + transport.host, mount,
      tenantId: fixture.tenantId, clientId: fixture.clientId, workspaceDirectory: workspace,
      teams: "direct", enabledTeamIds: [fixture.teamObjectId],
      groups: { dashboard: { admin: "group:" + fixture.groupId }, planner: { admin: "group:" + fixture.groupId }, procurement: {} },
      grants: [], scanner: null }, null, 2) + "\n")
    fs.writeFileSync(path.join(config, "client-secret.txt"), "hosted-ci-only", { mode: 0o600 })
    fs.writeFileSync(path.join(config, "ingress-secret.txt"), transport.proof, { mode: 0o600 })
    const provider = path.join(runtime, "entra-native-provider.mjs")
    fs.copyFileSync(path.join(source, ".github/ci/entra-native-provider.mjs"), provider, fs.constants.COPYFILE_EXCL)
    assert.equal(gitBlob(fs.readFileSync(provider)), expected.sourceFiles[".github/ci/entra-native-provider.mjs"])
    fs.chmodSync(provider, 0o400)
    watcher = fs.watch(path.join(config, "host-data"), (event, filename) => {
      const name = filename?.toString()
      if (name === undefined || databaseNames.includes(name))
        result.databaseEvents.push({ event, filename: name ?? null })
      else result.ignoredDatabaseDirectoryEvents++
    })
    watcher.on("error", (error) => result.databaseEvents.push({ watcherError: error.code ?? error.name }))
    await databaseAbsent("before-startup")
    const childEnv = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: runtime, LANG: "C.UTF-8", TZ: "UTC",
      XDG_DATA_HOME: path.join(config, "host-data"), XDG_CONFIG_HOME: path.join(config, "host-config"),
      XDG_CACHE_HOME: path.join(config, "host-cache"), XDG_STATE_HOME: path.join(config, "host-state"),
      TMPDIR: path.join(config, "host-tmp"), ORCHESTRA_CONFIG_DIR: path.join(config, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(config, "host-credential.key"), ORCHESTRA_DB: database,
      ORCHESTRA_INHERIT_CREDENTIALS: "0", ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "strict",
      ORCHESTRA_SERVER_USERNAME: "orchestra", ORCHESTRA_SERVER_PASSWORD: "hosted-boundary-basic",
      SUCAFINA_NATIVE_TEAM_DECISIONS: "1", SUCAFINA_NATIVE_TEAM_WEB: "1",
      SUCAFINA_MICROSOFT_CONFIG: configuration, SF_PROOF_FACTORY: factory }
    result.childEnvironmentKeys = Object.keys(childEnv).sort()
    stage = "start-installed-process"
    child = spawn(binary, ["serve", "--hostname", "127.0.0.1", "--port", String(port), "--installation", provider],
      { cwd: workspace, env: childEnv, detached: true, stdio: ["ignore", "pipe", "pipe"] })
    exit = new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })))
    for (const channel of ["stdout", "stderr"]) child[channel].on("data", (bytes) => {
      output[channel].update(bytes); output[channel + "Bytes"] += bytes.length
    })
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject) })
    identity("before-first-http-request")
    stage = "trusted-ingress-control"
    const deadline = Date.now() + 45_000
    let ready
    while (Date.now() < deadline) {
      assert(child.exitCode === null && child.signalCode === null, "installed process exited before readiness")
      try { ready = await request("/api/permission/saved", { withProof: false, timeout: 1000 }); break }
      catch (error) { if (Date.now() >= deadline) throw error; await setTimeout(100) }
    }
    assert(ready, "bounded readiness deadline")
    assert.equal(ready.status, 403)
    assert.equal((await ready.arrayBuffer()).byteLength, 0)
    result.checks.push({ case: "trusted-ingress-required", method: "GET", path: "/api/permission/saved",
      credentials: "anonymous", ingressProof: false, status: 403, bodyBytes: 0 })
    identity("after-startup")
    await databaseAbsent("after-startup")
    stage = "discovery-and-authentication"
    const offered = await request("/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1",
      { accept: "application/json" })
    assert.equal(offered.status, 200)
    assert.equal(offered.headers.get("cache-control"), "no-store")
    const { installations } = await offered.json()
    assert.equal(installations.length, 1)
    const installed = installations[0]
    assert.deepEqual([installed.publicOrigin, installed.mount, installed.contractRevision, installed.authMode, installed.tenantId],
      [origin, mount, "sf-team-profile/1", "microsoft", fixture.tenantId])
    assert(installed.installationId && installed.projectId && installed.hostId)
    assert.equal(installed.projectId, installed.installationId)
    result.installationBinding = installed
    const allowed = await signIn("allowed"), denied = await signIn("denied")
    assert(allowed !== denied, "separate synthetic Microsoft sessions")
    const basic = "Basic " + Buffer.from("orchestra:hosted-boundary-basic").toString("base64")
    stage = "generic-saved-permission-route-exclusion"
    for (const credentials of [{ name: "anonymous" }, { name: "supplied-basic", basic },
      { name: "allowed-microsoft", cookie: allowed }, { name: "denied-microsoft", cookie: denied }]) {
      for (const endpoint of [
        { method: "GET", path: "/api/permission/saved" },
        { method: "GET", path: "/api/permission/saved?" + new URLSearchParams({ projectID: installed.projectId }) },
        { method: "DELETE", path: "/api/permission/saved/" + encodeURIComponent(fixture.suppliedSavedPermissionId) },
      ]) {
        const response = await request(endpoint.path, { ...credentials, method: endpoint.method, accept: "application/json" })
        const body = Buffer.from(await response.arrayBuffer())
        const observed = { case: "saved-permission-route-absent", ...endpoint, credentials: credentials.name,
          ingressProof: true, status: response.status, bodyBytes: body.length, bodySha256: sha256(body),
          contentType: response.headers.get("content-type") }
        result.checks.push(observed)
        assert.equal(response.status, 404, credentials.name + " " + endpoint.method)
        assert.equal(body.length, 0, "dedicated empty 404")
        assert.equal(response.headers.get("content-type"), null, "no generic API error representation")
      }
    }
    await databaseAbsent("after-permission-negatives")
    stage = "native-team-context-controls"
    const context = mount + "/api/ui/context?" + new URLSearchParams({
      contractRevision: installed.contractRevision, installationId: installed.installationId,
      tenantId: installed.tenantId, hostId: installed.hostId, kind: "team", teamObjectId: fixture.teamObjectId })
    for (const credentials of [{ name: "anonymous", expected: 401 },
      { name: "supplied-basic", basic, expected: 401 }, { name: "allowed-microsoft", cookie: allowed, expected: 200 },
      { name: "denied-microsoft", cookie: denied, expected: 403 }]) {
      const response = await request(context, { ...credentials, accept: "application/json" })
      assert.equal(response.status, credentials.expected, "Team context " + credentials.name)
      const body = await response.json()
      if (credentials.name === "allowed-microsoft") {
        assert.equal(body.status, "ok")
        assert.equal(body.value.profile.teams.selected.teamObjectId, fixture.teamObjectId)
      }
      if (credentials.name === "denied-microsoft") assert.deepEqual(body, { status: "denied" })
      result.checks.push({ case: "native-team-context", credentials: credentials.name, status: response.status,
        selectedTeam: credentials.name === "allowed-microsoft" ? fixture.teamObjectId : null })
    }
    await databaseAbsent("after-positive-and-negative-team-controls")
    identity("after-all-http-actions")
    result.completedPermissionCases = result.checks.filter((entry) => entry.case === "saved-permission-route-absent").length
    assert.equal(result.completedPermissionCases, 12)
  } catch (error) {
    failure = { stage, name: error.name, message: String(error.message).slice(0,2000) }
  } finally {
    try {
      stage = "cleanup"
      if (child?.pid) {
        if (child.exitCode === null && child.signalCode === null) {
          const stopping = procState()
          assert.equal(stopping.groupId, child.pid)
          if (ownedStartTime !== undefined) assert.equal(stopping.startTime, ownedStartTime)
          ownedStartTime = stopping.startTime
          process.kill(-child.pid, "SIGTERM")
          const stopped = await Promise.race([exit, setTimeout(10_000, null, { ref: false })])
          if (!stopped) {
            assert.equal(procState().startTime, ownedStartTime)
            process.kill(-child.pid, "SIGKILL")
            await Promise.race([exit, setTimeout(5000, null, { ref: false }).then(() => { throw new Error("process did not terminate") })])
            failure ??= { stage, name: "ForcedTermination", message: "Installed process required SIGKILL" }
          }
        }
        result.processExit = await exit
        assert(!fs.existsSync("/proc/" + child.pid), "owned process remains")
        let groupGone = false
        try { process.kill(-child.pid, 0) } catch (error) { if (error.code !== "ESRCH") throw error; groupGone = true }
        assert(groupGone, "owned process group remains")
        await databaseAbsent("after-shutdown")
        let listenerGone = false
        try { await fetch(transport.local + "/", { signal: AbortSignal.timeout(1000) }) }
        catch (error) { assert.equal(error.cause?.code, "ECONNREFUSED"); listenerGone = true }
        assert(listenerGone, "listener remains after shutdown")
        result.processAndListenerGone = true
      }
      watcher?.close()
      result.output = { stdoutBytes: output.stdoutBytes, stdoutSha256: output.stdout.digest("hex"),
        stderrBytes: output.stderrBytes, stderrSha256: output.stderr.digest("hex"), rawLogsPublished: false }
      assert.equal(fileHash(binary), expected.archive.binarySha256)
      assert.equal(fileHash(factory), binding.factorySha256)
      result.installedBytesUnchangedAfterShutdown = true
    } catch (error) {
      failure ??= { stage, name: error.name, message: String(error.message).slice(0,2000) }
    } finally {
      watcher?.close()
      function writableDirectories(directory) {
        fs.chmodSync(directory, 0o700)
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          assert(!entry.isSymbolicLink())
          if (entry.isDirectory()) writableDirectories(path.join(directory, entry.name))
        }
      }
      const cleanupErrors = []
      try { fs.rmSync(runtime, { recursive: true, force: true }) }
      catch (error) { cleanupErrors.push({ path: runtime, code: error.code ?? error.name }) }
      try { writableDirectories(release); fs.rmSync(release, { recursive: true }) }
      catch (error) { cleanupErrors.push({ path: release, code: error.code ?? error.name }) }
      result.privateRuntimeRemoved = !fs.existsSync(runtime)
      result.temporaryReleaseRemoved = !fs.existsSync(release)
      result.cleanupErrors = cleanupErrors
      if (!result.privateRuntimeRemoved || !result.temporaryReleaseRemoved || cleanupErrors.length)
        failure ??= { stage: "cleanup", name: "CleanupFailure", message: "Temporary installation was not fully removed" }
      result.status = failure ? "FAIL_CLOSED" : "INSTALLED_HOST_BOUNDARY_OBSERVED"
      if (failure) result.failure = failure
      write("receipt.json", result)
    }
  }
  console.log("HOST_BOUNDARY_RECEIPT_BEGIN")
  console.log(JSON.stringify(result, null, 2))
  console.log("HOST_BOUNDARY_RECEIPT_END")
  console.log(JSON.stringify({ status: result.status, permissionCases: result.completedPermissionCases ?? 0,
    databaseEvents: result.databaseEvents.length, cleanupVerified: result.processAndListenerGone === true && result.privateRuntimeRemoved && result.temporaryReleaseRemoved,
    formalG09Pass: false }))
  if (failure) throw new Error("Host boundary observation failed at " + failure.stage + ": " + failure.message)
}
