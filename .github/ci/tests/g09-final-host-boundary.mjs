// Installed Microsoft host regression against the verified same-run candidate.
// This test preserves the HTTP and database assertions of the historical probe.
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
const [evidenceArg, sourceArg, releaseArg] = process.argv.slice(2)
assert.equal(process.argv.length, 5)
const env = process.env
assert.equal(env.GITHUB_ACTIONS, "true")
assert.equal(env.GITHUB_REPOSITORY, "gustavomhss/Orchestra-SF")
assert.equal(env.GITHUB_REPOSITORY_ID, "1455724710")
assert.equal(env.GITHUB_REF, "refs/heads/g09-final-review")
assert.equal(env.RUNNER_OS, "Linux")
assert.equal(env.RUNNER_ARCH, "X64")
assert.equal(env.GITHUB_JOB, "candidate-host-boundary")
assert.match(env.CHECK_RUN_ID ?? "", /^[1-9][0-9]*$/)
const temporary = fs.realpathSync(env.RUNNER_TEMP)
const root = fs.realpathSync(process.cwd())
const source = fs.realpathSync(sourceArg)
assert.equal(source, root)
const within = (base, file) => file === base || file.startsWith(base + path.sep)
function external(value) {
  assert(path.isAbsolute(value))
  const real = fs.realpathSync(value)
  assert(within(temporary, real) && !within(root, real))
  assert(fs.lstatSync(real).isDirectory())
  return real
}
const evidence = external(evidenceArg)
assert.equal(evidence, path.join(temporary, "g09-candidate"))
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const fileHash = (file) => sha256(fs.readFileSync(file))
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const write = (name, value) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 })
const scannerPath = path.join(source, "script/sf-ci/team-profile-residue.mjs")
const gitBlob = (bytes) => createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex")
const { readTarArchive, parseCanonicalJson, verifyGitSource } = await import(pathToFileURL(scannerPath).href)
const canonical = (file) => parseCanonicalJson(fs.readFileSync(file), path.basename(file))
const currentSource = verifyGitSource(fs.readFileSync(path.join(evidence, "commit.raw")),
  fs.readFileSync(path.join(evidence, "tracked.z")), env.GITHUB_SHA)
const entries = new Map(currentSource.entries.map((entry) => [entry.path, entry]))
const sourceFiles = [
  "script/sf-ci/team-profile-residue.mjs",
  ".github/ci/entra-native-provider.mjs",
  ".github/ci/entra-native-http.mjs",
  ".github/ci/g09-installation-modes.py",
  "sf/azure/vm/install-factory-distribution.py",
  "modules/sucafina/Sucafinav1/runtime/local-configuration.ts",
  "modules/sucafina/Sucafinav1/src/identity.ts",
  "modules/sucafina/Sucafinav1/src/records.ts",
  "apps/cli/src/sucafina-product/installation.ts",
  "packages/schema/src/permission-saved.ts",
  "packages/core/src/config.ts"
].map((name) => {
  const file = path.join(source, name)
  assert.equal(fs.realpathSync(file), file)
  const bytes = fs.readFileSync(file)
  assert.equal(gitBlob(bytes), entries.get(name)?.oid, "source bytes: " + name)
  return { path: name, gitBlob: gitBlob(bytes), sha256: sha256(bytes) }
})
const examinationFiles = [".github/ci/tests/g09-final-host-boundary.mjs", "script/sf-ci/g09-candidate-evidence.mjs",
  ".github/workflows/g09-final.yml"].map((name) => {
  const bytes = fs.readFileSync(path.join(root, name))
  assert.equal(gitBlob(bytes), entries.get(name)?.oid, "test source: " + name)
  return { path: name, gitBlob: gitBlob(bytes), sha256: sha256(bytes) }
})
assert.equal(fs.realpathSync(fileURLToPath(import.meta.url)), path.join(root, ".github/ci/tests/g09-final-host-boundary.mjs"))
const candidate = canonical(path.join(evidence, "candidate-binding.json"))
assert.equal(candidate.schema, "sf-g09-candidate-binding-v1")
assert.deepEqual([candidate.sourceSHA, candidate.sourceTreeSHA, candidate.workflowSHA, candidate.runId, candidate.runAttempt],
  [env.GITHUB_SHA, currentSource.tree, env.GITHUB_SHA, env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT])
assert.equal(env.SF_PRODUCT_SOURCE_SHA, env.GITHUB_SHA)
assert.equal(candidate.artifactId, env.CANDIDATE_ARTIFACT_ID)
assert.equal(candidate.producerCheckRunId, env.CANDIDATE_PRODUCER_CHECK_RUN_ID)
assert.equal(candidate.artifactDigest, "sha256:" + env.CANDIDATE_ARTIFACT_DIGEST.replace(/^sha256:/, ""))
assert.equal("sha256:" + fileHash(path.join(evidence, "artifact.zip")), candidate.artifactDigest)
const run = json(path.join(evidence, "run.json"))
assert.deepEqual([String(run.id), String(run.run_attempt), run.head_sha, run.head_branch, run.path, run.event],
  [env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT, env.GITHUB_SHA, "g09-final-review", ".github/workflows/g09-final.yml", "push"])
const jobs = json(path.join(evidence, "jobs.json"))
assert.equal(jobs.total_count, jobs.jobs.length)
const checkURL = "https://api.github.com/repos/" + env.GITHUB_REPOSITORY + "/check-runs/"
const current = jobs.jobs.filter((job) => job.check_run_url === checkURL + env.CHECK_RUN_ID)
assert.equal(current.length, 1)
assert.deepEqual([current[0].name, String(current[0].run_id), current[0].head_sha, current[0].status],
  ["candidate-host-boundary", env.GITHUB_RUN_ID, env.GITHUB_SHA, "in_progress"])
assert.equal(String(current[0].run_attempt), env.GITHUB_RUN_ATTEMPT)
const producer = jobs.jobs.filter((job) => String(job.id) === candidate.producerJobId)
assert.equal(producer.length, 1)
assert.deepEqual([producer[0].name, producer[0].head_sha, producer[0].check_run_url, producer[0].status, producer[0].conclusion],
  ["teams-profile-artifact", env.GITHUB_SHA, checkURL + candidate.producerCheckRunId, "completed", "success"])
const artifact = json(path.join(evidence, "artifact.json"))
assert.deepEqual([String(artifact.id), artifact.digest, artifact.expired, String(artifact.workflow_run.id), artifact.workflow_run.head_sha],
  [candidate.artifactId, candidate.artifactDigest, false, env.GITHUB_RUN_ID, env.GITHUB_SHA])
assert.equal(fs.statSync(path.join(evidence, "artifact.zip")).size, artifact.size_in_bytes)
const archive = path.join(evidence, "package", "orchestra-sf-entra-linux-x64-baseline.tar.gz")
assert.equal(candidate.paths.archive, archive)
assert.equal(fileHash(archive), candidate.archiveSha256)
const files = readTarArchive(fs.readFileSync(archive))
const byPath = new Map(files.map((file) => [file.path, file]))
const manifest = JSON.parse(byPath.get("distribution.json").text)
assert.equal(manifest.target, "linux-x64-baseline")
assert.equal(files.length, manifest.files.length + 2)
assert.equal(byPath.get("bin/orchestra")?.sha256, candidate.binarySha256)
assert.equal(fileHash(candidate.paths.compileProvenance), candidate.compileProvenanceSha256)
assert.equal(fileHash(candidate.paths.compileEvidence), candidate.compileEvidenceSha256)
assert.equal(fileHash(candidate.paths.cliSourceMapIndex), candidate.cliSourceMapIndexSha256)
assert.equal(fileHash(candidate.paths.cliSourceMaps), candidate.cliSourceMapsSha256)
const expected = {
  fixture: {
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "clientId": "22222222-2222-4222-8222-222222222222",
  "allowedPrincipal": "33333333-3333-4333-8333-333333333333",
  "deniedPrincipal": "33333333-3333-4333-8333-333333333334",
  "teamObjectId": "44444444-4444-4444-8444-444444444444",
  "groupId": "55555555-5555-4555-8555-555555555555",
  "suppliedSavedPermissionId": "psv_g09_host_boundary_supplied_identifier"
},
  sourceFiles: Object.fromEntries(sourceFiles.map((file) => [file.path, file.gitBlob])),
  archive: { file: path.basename(archive), sha256: candidate.archiveSha256, target: manifest.target,
    binaryPath: "bin/orchestra", binarySha256: candidate.binarySha256, factoryPath: "bin/local/entry.mjs" },
}
const producerBinding = { sourceSHA: env.GITHUB_SHA, sourceTreeSHA: currentSource.tree, workflowSHA: env.GITHUB_SHA,
  workflowPath: ".github/workflows/g09-final.yml", branch: "g09-final-review", event: "push",
  runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, job: "teams-profile-artifact",
  jobId: candidate.producerJobId, checkRunId: candidate.producerCheckRunId,
  repository: env.GITHUB_REPOSITORY, repositoryId: env.GITHUB_REPOSITORY_ID,
  artifact: { id: candidate.artifactId, name: artifact.name, digest: artifact.digest, bytes: artifact.size_in_bytes } }
const examinationBinding = { sourceSHA: env.GITHUB_SHA, sourceTreeSHA: currentSource.tree, workflowSHA: env.GITHUB_SHA,
  workflowPath: ".github/workflows/g09-final.yml", branch: "g09-final-review", event: "push",
  runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, job: "candidate-host-boundary",
  jobId: String(current[0].id), checkRunId: env.CHECK_RUN_ID,
  repository: env.GITHUB_REPOSITORY, repositoryId: env.GITHUB_REPOSITORY_ID, files: examinationFiles }
write("archive-binding.json", { schema: "sf-g09-same-run-host-archive-v1", producerBinding, examinationBinding,
  candidateBindingSha256: fileHash(path.join(evidence, "candidate-binding.json")),
  archiveSha256: candidate.archiveSha256, binarySha256: candidate.binarySha256,
  factorySha256: byPath.get("bin/local/entry.mjs").sha256, manifestSha256: byPath.get("distribution.json").sha256,
  archiveMembers: files.map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 })),
  canonicalQualification: false, signed: false, formalG09Pass: false })
await probe()

// Node v24.15.0's deps/undici/src/lib/web/fetch/index.js deletes Host before dispatch.
// The installed ingress requires the configured virtual Host, including its port.
function request(route, { cookie, basic, withProof = true, accept = "text/html", method = "GET", json, timeout = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    const operation = http.request(transport.local + route, {
      method, agent: false, signal: AbortSignal.timeout(timeout), maxHeaderSize: 16 * 1024,
      headers: { accept, host: transport.host, ...(withProof ? { "x-sf-ingress-proof": transport.proof } : {}),
        ...(cookie ? { cookie } : {}), ...(basic ? { authorization: basic } : {}),
        ...(method === "GET" ? {} : { origin }), ...(json === undefined ? {} : { "content-type": "application/json" }) },
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
    operation.end(json === undefined ? undefined : JSON.stringify(json))
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
    fs.mkdirSync(path.join(workspace, ".orchestra"), { mode: 0o700 })
    const trap = Buffer.from("{ invalid repository configuration must never select the Microsoft Team profile\n")
    result.repositoryConfigTrap = {
      loader: sourceFiles.find((file) => file.path === "packages/core/src/config.ts"),
      files: ["orchestra.json", "orchestra.jsonc", ".orchestra/orchestra.json", ".orchestra/orchestra.jsonc"].map((name) => {
        const file = path.join(workspace, name)
        fs.writeFileSync(file, trap, { flag: "wx", mode: 0o400 })
        assert.equal(fileHash(file), sha256(trap))
        return { path: name, byteLength: trap.length, sha256: sha256(trap) }
      }),
      gitMarkers: [],
      scope: "Malformed repository configuration is present while actual Microsoft Team requests succeed; no syscall-absence claim",
    }
    for (let directory = workspace; ; directory = path.dirname(directory)) {
      const marker = path.join(directory, ".git")
      assert(!fs.existsSync(marker), "unexpected Git marker in installed fixture ancestry")
      result.repositoryConfigTrap.gitMarkers.push({ path: marker, present: false })
      if (directory === path.dirname(directory)) break
    }
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
    stage = "reject-daemon-registration"
    const registration = spawn(binary, ["serve", "--register", "--hostname", "127.0.0.1", "--port", String(port), "--installation", factory],
      { cwd: workspace, env: childEnv, detached: true, stdio: ["ignore", "pipe", "pipe"] })
    const registrationExit = new Promise((resolve) => registration.once("close", (code, signal) => resolve({ code, signal })))
    const registrationChunks = []
    let registrationBytes = 0
    const registrationState = () => {
      const fields = fs.readFileSync("/proc/" + registration.pid + "/stat", "utf8").split(") ")[1].split(" ")
      return { startTime: fields[19], groupId: Number(fields[2]), sessionId: Number(fields[3]) }
    }
    for (const channel of ["stdout", "stderr"]) registration[channel].on("data", (bytes) => {
      registrationBytes += bytes.length
      if (registrationBytes <= 2 * 1024 * 1024) registrationChunks.push(bytes)
    })
    let registrationIdentity
    try {
      await new Promise((resolve, reject) => { registration.once("spawn", resolve); registration.once("error", reject) })
      registrationIdentity = registrationState()
      assert.equal(registrationIdentity.groupId, registration.pid)
      assert.equal(registrationIdentity.sessionId, registration.pid)
      assert.equal(fs.readlinkSync("/proc/" + registration.pid + "/exe"), binary)
      assert.equal(fileHash("/proc/" + registration.pid + "/exe"), expected.archive.binarySha256)
      assert.equal(fs.realpathSync("/proc/" + registration.pid + "/cwd"), workspace)
      const rejected = await Promise.race([registrationExit, setTimeout(15_000, null, { ref: false })])
      assert(rejected, "--register did not reject within 15 seconds")
      assert.equal(rejected.signal, null, "--register must reject by itself")
      assert.notEqual(rejected.code, 0, "--register unexpectedly succeeded")
      assert(registrationBytes <= 2 * 1024 * 1024, "--register output exceeded the bounded capture")
      const registrationOutput = Buffer.concat(registrationChunks)
      const reason = "Trusted ingress listeners cannot register as the daemon"
      assert(registrationOutput.toString("utf8").includes(reason), "missing installed --register refusal")
      result.daemonRegistration = { status: "rejected", arguments: ["serve", "--register"],
        timeoutMs: 15_000, exitCode: rejected.code, observedReason: reason,
        executable: binary, executableSha256: expected.archive.binarySha256,
        factory, factorySha256: binding.factorySha256, cwd: workspace, pid: registration.pid,
        ...registrationIdentity, outputBytes: registrationBytes, outputSha256: sha256(registrationOutput) }
    } finally {
      if (registration.pid && registration.exitCode === null && registration.signalCode === null) {
        const state = registrationState()
        assert.equal(state.groupId, registration.pid)
        if (registrationIdentity) assert.equal(state.startTime, registrationIdentity.startTime)
        process.kill(-registration.pid, "SIGTERM")
        if (!await Promise.race([registrationExit, setTimeout(5000, null, { ref: false })])) {
          const current = registrationState()
          assert.equal(current.groupId, registration.pid)
          assert.equal(current.startTime, state.startTime)
          process.kill(-registration.pid, "SIGKILL")
          assert(await Promise.race([registrationExit, setTimeout(5000, null, { ref: false })]), "--register fixture survived SIGKILL")
        }
      }
      if (registration.pid) {
        assert(!fs.existsSync("/proc/" + registration.pid), "--register process remains")
        let groupGone = false
        try { process.kill(-registration.pid, 0) } catch (error) { if (error.code !== "ESRCH") throw error; groupGone = true }
        assert(groupGone, "--register process group remains")
      }
    }
    await databaseAbsent("after-register-refusal")
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
    stage = "generic-core-route-exclusion"
    for (const credentials of [{ name: "anonymous" }, { name: "supplied-basic", basic },
      { name: "allowed-microsoft", cookie: allowed }, { name: "denied-microsoft", cookie: denied }]) {
      for (const endpoint of [
        { method: "GET", path: "/api/session" },
        { method: "POST", path: "/api/session", json: {} },
        { method: "GET", path: "/api/session/session_g09_boundary" },
        { method: "GET", path: "/api/config" },
        { method: "PATCH", path: "/api/config", json: {} },
        { method: "GET", path: "/api/event" },
        { method: "DELETE", path: "/api/credential/g09-boundary-credential" },
        { method: "GET", path: "/openapi.json" },
        { method: "GET", path: "/api/health" },
      ]) {
        const response = await request(endpoint.path, { ...credentials, method: endpoint.method,
          json: endpoint.json, accept: "application/json" })
        const body = Buffer.from(await response.arrayBuffer())
        result.checks.push({ case: "generic-core-route-absent", ...endpoint, credentials: credentials.name,
          ingressProof: true, status: response.status, bodyBytes: body.length, bodySha256: sha256(body),
          contentType: response.headers.get("content-type") })
        assert.equal(response.status, 404, credentials.name + " " + endpoint.method + " " + endpoint.path)
        assert.equal(body.length, 0, "dedicated empty 404")
        assert.equal(response.headers.get("content-type"), null, "no generic Core representation")
      }
    }
    result.suppliedCoreIdentifiers = { session: "session_g09_boundary", credential: "g09-boundary-credential",
      existingSessionOrCredentialClaimed: false }
    result.completedCoreCases = result.checks.filter((entry) => entry.case === "generic-core-route-absent").length
    assert.equal(result.completedCoreCases, 36)
    await databaseAbsent("after-generic-core-negatives")
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
    assert.equal(result.checks.length, 53)
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
      assert.equal(result.repositoryConfigTrap.files.length, 4)
      for (const entry of result.repositoryConfigTrap.files) {
        const file = path.join(workspace, entry.path)
        assert(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink())
        assert.equal(fs.statSync(file).size, entry.byteLength)
        assert.equal(fileHash(file), entry.sha256, "repository configuration trap changed")
      }
      result.repositoryConfigTrap.unchangedAfterRequestsAndShutdown = true
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
