import { createHash } from "node:crypto"
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { candidateSource } from "./workflow-source.mjs"

export const POOL_DIRECTORY = "modules/sucafina"
export const POOL_ENTRY = POOL_DIRECTORY + "/Sucafinav1/test/product/wp01/browser-selection.test.ts"
export const POOL_STARTUP = POOL_DIRECTORY + "/Sucafinav1/test/product/wp01/browser-startup.test.ts"
export const POOL_FINALIZER = POOL_DIRECTORY + "/Sucafinav1/test/product/wp01/browser-lifecycle.test.ts"
const SOURCE_PLAN = "docs/architecture/teams-profile-test-plan.json"
const fail = (message) => { throw new Error("SF_BROWSER_POOL_FAIL_CLOSED: " + message) }
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
const json = (value) => JSON.stringify(value)
const same = (actual, expected, message) => {
  if (json(actual) !== json(expected)) fail(message)
}
const unique = (values, message) => {
  if (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length) fail(message)
  return values
}

function candidateFile(root, relative) {
  if (typeof relative !== "string" || !/^[\w./-]+$/.test(relative) ||
      relative.startsWith("/") || relative.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("unsafe candidate path")
  }
  let location = root
  for (const [index, part] of relative.split("/").entries()) {
    location = path.join(location, part)
    const state = lstatSync(location, { throwIfNoEntry: false })
    if (!state || state.isSymbolicLink() || (index === relative.split("/").length - 1 ? !state.isFile() : !state.isDirectory())) {
      fail("missing or unsafe candidate file: " + relative)
    }
  }
  const bytes = readFileSync(location)
  return { path: relative, blob: createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex"), sha256: hash(bytes) }
}

/** The entry is separate evidence. The original forty paths remain the source inventory. */
export function loadPoolInventory(repoRoot, manifestPath = "sf/ci/suites.json") {
  const root = realpathSync(repoRoot)
  const manifest = candidateFile(root, manifestPath)
  const data = JSON.parse(readFileSync(path.join(root, manifestPath), "utf8"))
  const suite = data.suites?.find((item) => item.id === "CI-SF")
  if (suite?.directory !== POOL_DIRECTORY || suite.kind !== "bun") fail("CI-SF suite identity changed")
  const selection = suite.selection
  const entry = POOL_ENTRY.slice(POOL_DIRECTORY.length + 1)
  same(selection?.harnessEntryFiles, [entry], "the one owned entry must be declared separately")
  const sources = unique(selection.harnessOwnedFiles, "empty or duplicate source inventory")
  const plan = JSON.parse(readFileSync(path.join(root, SOURCE_PLAN), "utf8"))
  const original = unique(plan.exactOriginalBrowserPoolFiles, "missing original pool inventory")
  if (original.length !== 40 || sources.length !== 40) fail("the original pool has exactly forty source files")
  const paths = sources.map((name) => POOL_DIRECTORY + "/" + name)
  same([...paths].sort(), [...original].sort(), "source inventory differs from the original forty")
  if (paths.includes(POOL_ENTRY) || selection.releaseOnlyFiles?.includes(entry) ||
      sources.some((name) => selection.releaseOnlyFiles?.includes(name))) fail("entry/source/release inventories overlap")
  const order = [POOL_STARTUP, ...paths.filter((name) => name !== POOL_STARTUP && name !== POOL_FINALIZER), POOL_FINALIZER]
  unique(order, "startup/finalizer missing or duplicated")
  if (order.length !== 40) fail("startup/finalizer source membership changed")
  const inventory = {
    schemaVersion: 1, manifest, entry: candidateFile(root, POOL_ENTRY),
    sources: order.map((name) => candidateFile(root, name)),
    support: [
      SOURCE_PLAN, "script/sf-ci/browser-pool.mjs",
      POOL_DIRECTORY + "/bunfig.toml",
      POOL_DIRECTORY + "/Sucafinav1/test/product/wp01/browser-pool-registration.ts",
      POOL_DIRECTORY + "/Sucafinav1/test/product/wp01/browser-fixture.ts",
      POOL_DIRECTORY + "/Sucafinav1/test/product/wp02/browser-driver-fixture.ts",
      "script/test-guard.ts", "script/test-omni-control.ts", "packages/core/test/fixture/omni-expect.ts",
    ].map((name) => candidateFile(root, name)),
  }
  return { ...inventory, sha256: hash(json(inventory)) }
}

/** Read the actual Linux command line, never infer execution from request JSON. */
export function admitPoolCommand(command, { cwd, execPath, platform, repoRoot }) {
  if (platform !== "linux" || command[1] !== "test" ||
      (command[0] !== "bun" && path.resolve(command[0] || "") !== path.resolve(execPath))) {
    fail("requires one Linux Bun test process")
  }
  const files = [], flags = new Set()
  let timeout = null, report = null
  for (let index = 2; index < command.length; index++) {
    const arg = command[index]
    const take = (name) => {
      if (flags.has(name)) fail("duplicate runner flag: " + name)
      flags.add(name)
      const value = arg === name ? command[++index] : arg.slice(name.length + 1)
      if (!value) fail("missing runner flag value: " + name)
      return value
    }
    if (arg === "--timeout" || arg.startsWith("--timeout=")) {
      const value = take("--timeout")
      if (!/^[1-9]\d*$/.test(value)) fail("invalid timeout")
      timeout = Number(value)
      continue
    }
    if (arg === "--reporter" || arg.startsWith("--reporter=")) {
      if (take("--reporter") !== "junit") fail("only the real JUnit reporter is admitted")
      continue
    }
    if (arg === "--reporter-outfile" || arg.startsWith("--reporter-outfile=")) {
      report = path.resolve(cwd, take("--reporter-outfile"))
      continue
    }
    if (typeof arg !== "string" || arg.startsWith("-") || !arg.endsWith(".test.ts") || /[*?\[\]{}]/.test(arg)) {
      fail("filters, bail, isolation, sharding, concurrency and unknown flags are forbidden")
    }
    files.push(path.resolve(cwd, arg))
  }
  same(files, [path.resolve(repoRoot, POOL_ENTRY)], "only the owned entry may be selected, exactly once")
  if (flags.has("--reporter") !== flags.has("--reporter-outfile")) fail("incomplete JUnit reporter selection")
  return { command: [...command], timeout, report }
}

/** Native Bun still expands and executes test.each. Only existing scalar %s/%i tables are admitted. */
export function expandPoolTitle(template, value) {
  if (typeof template !== "string" || !template.trim()) fail("empty case title")
  const tokens = [...template.matchAll(/%./g)].map((match) => match[0])
  if (tokens.filter((token) => token !== "%%").length !== 1 ||
      tokens.some((token) => !["%%", "%s", "%i"].includes(token))) fail("unreviewed parameterized title")
  if (tokens.includes("%i") && !Number.isSafeInteger(value) ||
      tokens.includes("%s") && typeof value !== "string") fail("unreviewed parameterized value")
  return template.replace(/%[si%]/g, (token) => token === "%%" ? "%" : String(value))
}

function caseRecord(source, ordinal, title, template, parameter, options) {
  if (typeof title !== "string" || !title.trim()) fail("empty case title")
  if (options !== undefined && (typeof options !== "number" || !Number.isSafeInteger(options) || options < 1)) {
    fail("only original per-case numeric budgets are admitted; retries and repeats are forbidden")
  }
  const value = { source, ordinal, title, template, parameter, timeout: options ?? null }
  return { ...value, id: hash(json(value)) }
}

/**
 * A registration adapter, not a replacement test runner. Hooks and test.each stay
 * native. Body return/throw is journaled; the real JUnit report decides test PASS.
 */
export function createPoolRegistry(sources, emit) {
  unique(sources, "duplicate registry sources")
  if (sources[0] !== POOL_STARTUP || sources.at(-1) !== POOL_FINALIZER) fail("lifecycle registration order changed")
  const cases = [], queued = [], registered = [], seen = new Set(), outcomes = []
  const startedIds = new Set()
  let sealed = false, current = null, cursor = 0, incomplete = false
  const invoke = async (record, fn, args) => {
    if (!sealed || startedIds.has(record.id)) fail("case started out of order, twice, or before complete registration")
    // A failed beforeAll can omit consumer bodies; a Bun timeout can leave a
    // promise pending. The original finalizer must still attempt shutdown.
    // Record that breach explicitly: it can never produce a complete receipt.
    if (record.source === POOL_FINALIZER && record.id === cases.at(-1)?.id &&
        (current || cases[cursor]?.id !== record.id)) {
      incomplete = true
      emit({ type: "case-incomplete", activeCase: current?.id ?? null,
        missingCases: cases.slice(cursor, -1).map((item) => item.id) })
      current = null
      cursor = cases.length - 1
    }
    if (current || cases[cursor]?.id !== record.id) fail("case started out of order, twice, or before complete registration")
    startedIds.add(record.id)
    current = record
    cursor++
    emit({ type: "case-start", id: record.id })
    try {
      const result = await fn(...args)
      outcomes.push({ id: record.id, bodyStatus: "returned" })
      emit({ type: "case-finish", id: record.id, bodyStatus: "returned" })
      return result
    } catch (error) {
      outcomes.push({ id: record.id, bodyStatus: "threw" })
      emit({ type: "case-finish", id: record.id, bodyStatus: "threw" })
      throw error
    } finally { if (current?.id === record.id) current = null }
  }
  return {
    register(source, register, nativeTest, describe) {
      if (sealed || source !== sources[queued.length] || typeof register !== "function") fail("unknown, duplicate or missing source registration")
      queued.push(source)
      const own = []
      const add = (title, template, parameter, options) => {
        if (sealed || source !== sources[registered.length]) fail("late or out-of-scope case registration")
        const record = caseRecord(source, own.length, title, template, parameter, options)
        const key = source + "\0" + title
        if (seen.has(key)) fail("duplicate expanded case identity within a source")
        seen.add(key); own.push(record); cases.push(record)
        emit({ type: "case-declared", case: record })
        return record
      }
      const test = (title, fn, options) => {
        if (typeof fn !== "function" || fn.length !== 0) fail("pool cases must retain their existing promise/synchronous callback form")
        const record = add(title, title, null, options)
        nativeTest(title, () => invoke(record, fn, []), options)
      }
      test.each = (table) => {
        if (!Array.isArray(table) || table.length === 0) fail("empty or unsupported each table")
        return (template, fn, options) => {
          if (typeof fn !== "function" || fn.length !== 1) fail("pool parameterized cases require their original one-value callback")
          const records = table.map((value, index) => add(expandPoolTitle(template, value), template, { index, value }, options))
          let next = 0
          nativeTest.each(table)(template, (value) => {
            const record = records[next++]
            if (!record || record.parameter.value !== value) fail("native parameter expansion/order changed")
            return invoke(record, fn, [value])
          }, options)
        }
      }
      // Bun 1.3.14 queues describe callbacks during collection. Registration
      // completes inside that callback; the entry's root beforeAll seals only
      // after Bun has collected every scope, before any named case can start.
      describe(source, () => {
        if (source !== sources[registered.length]) fail("source collection order changed")
        register(test)
        if (own.length === 0) fail("source registered no cases: " + source)
        registered.push(source)
        emit({ type: "source-registered", source, cases: own.length })
      })
    },
    seal() {
      if (sealed) fail("registry already sealed")
      same(queued, sources, "not every original source was queued exactly once")
      same(registered, sources, "not every original source registered exactly once")
      if (cases[0]?.source !== POOL_STARTUP || cases.at(-1)?.source !== POOL_FINALIZER ||
          cases.filter((item) => item.source === POOL_STARTUP).length !== 1 ||
          cases.filter((item) => item.source === POOL_FINALIZER).length !== 1) fail("named lifecycle case inventory changed")
      sealed = true
      emit({ type: "registration-complete", sourceCount: registered.length, caseCount: cases.length })
    },
    assertStartup() {
      if (!sealed || current?.source !== POOL_STARTUP || cursor !== 1) fail("browser startup is outside its named fully registered case")
    },
    observations() {
      return { sourceCount: registered.length, declaredCases: cases.length,
        bodiesStarted: startedIds.size, bodiesFinished: outcomes.length,
        bodiesReturned: outcomes.filter((item) => item.bodyStatus === "returned").length,
        bodiesThrew: outcomes.filter((item) => item.bodyStatus === "threw").length,
        activeCase: current?.id ?? null, forcedFinalization: incomplete }
    },
    complete() {
      if (incomplete) fail("incomplete execution required forced finalization")
      if (!sealed || current || cursor !== cases.length || outcomes.length !== cases.length) fail("missing, active or unexecuted cases")
      same(outcomes.map((item) => item.id), cases.map((item) => item.id), "case completion order changed")
      if (outcomes.some((item) => item.bodyStatus !== "returned")) fail("a case body failed")
      return { sourceCount: registered.length, caseCount: cases.length }
    },
  }
}

export function openPoolJournal(output, inventory, execution) {
  const location = path.join(output, "journal.jsonl")
  writeFileSync(location, "", { flag: "wx", mode: 0o600 })
  let seq = 0
  const emit = (event) => appendFileSync(location, json({ seq: ++seq, ...event }) + "\n")
  emit({ type: "run-start", inventorySha256: inventory.sha256, execution })
  return emit
}

function metadata(env) {
  let source
  try { source = candidateSource(env) } catch { fail("invalid actual product source identity") }
  const result = { checkoutSha: env.SF_CHECKOUT_SHA, treeSha: env.SF_CHECKOUT_TREE_SHA,
    runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, runnerOS: env.RUNNER_OS, runnerArch: env.RUNNER_ARCH }
  if (!/^[a-f0-9]{40}$/.test(result.checkoutSha || "") || result.checkoutSha !== source ||
      !/^[a-f0-9]{40}$/.test(result.treeSha || "") || !/^[1-9]\d*$/.test(result.runId || "") ||
      !/^[1-9]\d*$/.test(result.attempt || "") || result.runnerOS !== "Linux" || result.runnerArch !== "X64") {
    fail("missing or mismatched actual Actions checkout/run identity")
  }
  if (env.ORCHESTRA_OMNI_CONTROL !== "declared" || !["1", "strict"].includes(env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER) ||
      !/^[a-f0-9]{32}$/.test(env.ORCHESTRA_OMNI_CONTROL_NONCE || "")) fail("missing explicit Omni mode/scope/nonce")
  return { ...result, omniNonceSha256: hash(env.ORCHESTRA_OMNI_CONTROL_NONCE) }
}

/** No process spawning here: the workflow executes Bun explicitly between prepare and verify. */
export function preparePool({ repoRoot, manifestPath, output, env = process.env }) {
  const inventory = loadPoolInventory(repoRoot, manifestPath)
  const admission = { schemaVersion: 1, gate: "G04-ORDERED-BROWSER-POOL", metadata: metadata(env), inventory }
  mkdirSync(output, { recursive: true })
  if (lstatSync(output).isSymbolicLink() || readdirSync(output).length) fail("evidence directory must be fresh and empty")
  writeFileSync(path.join(output, "admission.json"), json(admission) + "\n", { flag: "wx", mode: 0o600 })
  return admission
}

function artifact(output, name) {
  const location = path.join(output, name)
  const state = lstatSync(location, { throwIfNoEntry: false })
  if (!state?.isFile() || state.isSymbolicLink()) fail("missing or unsafe evidence: " + name)
  return readFileSync(location)
}

export function readPoolAdmission(output, inventory) {
  const admission = JSON.parse(artifact(output, "admission.json").toString("utf8"))
  if (admission.schemaVersion !== 1 || admission.gate !== "G04-ORDERED-BROWSER-POOL") fail("invalid pool admission")
  same(admission.inventory, inventory, "source, entry or support changed after admission")
  return admission
}

function lifecycleProof(value) {
  if (!value || value.launches !== 1 || !Number.isSafeInteger(value.acquisitions) || value.acquisitions < 1 ||
      value.releases !== value.acquisitions || value.activeLease !== false || value.contexts !== 0 ||
      !Number.isSafeInteger(value.pid) || value.pid < 1 || value.disconnected !== true ||
      value.driverClosed !== true || value.processExited !== true || value.verified !== true ||
      value.sealed !== true || value.failed !== false) fail("incomplete real browser lifecycle")
  return value
}

/** Reconcile runtime declarations/executions with real JUnit, not a source count relabelled as execution. */
export function verifyPoolEvidence({ admission, inventory, journal, summary, report, log, exitCode, chromeVersion, env, repoRoot, output }) {
  const { sha256, ...inventoryBody } = inventory
  if (sha256 !== hash(json(inventoryBody))) fail("inventory digest does not match its entry/source/support blobs")
  same(admission.metadata, metadata(env), "candidate/run/Omni identity changed")
  same(admission.inventory, inventory, "candidate inventory changed")
  if (exitCode !== 0) fail("Bun exited unsuccessfully")
  if (!Array.isArray(journal) || journal.length === 0 || journal.some((item, index) => item.seq !== index + 1)) fail("missing or reordered journal events")
  const first = journal[0]
  if (first.type !== "run-start" || first.inventorySha256 !== inventory.sha256) fail("journal belongs to a different inventory")
  const execution = first.execution
  if (!execution || !Number.isSafeInteger(execution.pid) || execution.pid < 1 || typeof execution.bunVersion !== "string") fail("missing actual Bun process")
  const command = admitPoolCommand(execution.command, { cwd: execution.cwd, execPath: execution.execPath, platform: execution.platform, repoRoot })
  if (command.report !== path.resolve(output, "report.xml")) fail("JUnit was not selected for this exact evidence directory")
  if (path.resolve(execution.cwd) !== path.resolve(repoRoot, POOL_DIRECTORY)) fail("wrong Bun working directory")
  const declared = [], sourceCounts = [], started = [], finished = []
  let phase = "registration", lifecycle = null, completion = null
  for (const event of journal.slice(1)) {
    if (event.type === "case-declared" && phase === "registration") {
      const value = event.case
      if (value?.source !== inventory.sources[sourceCounts.length]?.path) fail("unknown or out-of-order declared source")
      same(value, caseRecord(value.source, value.ordinal, value.title, value.template, value.parameter, value.timeout ?? undefined), "invalid declared case identity")
      if (value.parameter !== null && expandPoolTitle(value.template, value.parameter.value) !== value.title) fail("expanded case title changed")
      declared.push(value)
      continue
    }
    if (event.type === "source-registered" && phase === "registration") {
      if (event.source !== inventory.sources[sourceCounts.length]?.path) fail("unknown or out-of-order registered source")
      sourceCounts.push({ source: event.source, cases: event.cases })
      continue
    }
    if (event.type === "registration-complete" && phase === "registration") {
      same(sourceCounts.map((item) => item.source), inventory.sources.map((item) => item.path), "missing/duplicate original source")
      for (const item of sourceCounts) {
        const own = declared.filter((record) => record.source === item.source)
        if (!own.length || own.length !== item.cases || own.some((record, index) => record.ordinal !== index)) fail("empty or incomplete source registration")
      }
      if (event.sourceCount !== 40 || event.caseCount !== declared.length || declared.length === 0) fail("empty or false registration counts")
      unique(declared.map((item) => item.id), "duplicate declared case")
      unique(declared.map((item) => item.source + "\0" + item.title), "duplicate expanded source/title")
      if (declared[0]?.source !== POOL_STARTUP || declared.at(-1)?.source !== POOL_FINALIZER ||
          declared.filter((item) => item.source === POOL_STARTUP).length !== 1 ||
          declared.filter((item) => item.source === POOL_FINALIZER).length !== 1) fail("named startup/finalizer case mismatch")
      phase = "execution"
      continue
    }
    if (event.type === "case-start" && phase === "execution") {
      if (started.length !== finished.length || declared[started.length]?.id !== event.id) fail("out-of-order, duplicate or overlapping case start")
      started.push(event.id)
      continue
    }
    if (event.type === "case-finish" && phase === "execution") {
      if (started.length !== finished.length + 1 || started.at(-1) !== event.id || event.bodyStatus !== "returned") fail("failed or mismatched case completion")
      finished.push(event.id)
      continue
    }
    if (event.type === "lifecycle" && phase === "execution") {
      if (finished.length !== declared.length) fail("lifecycle preceded complete execution")
      lifecycle = lifecycleProof(event.evidence)
      phase = "cleanup"
      continue
    }
    if (event.type === "run-complete" && phase === "cleanup") {
      if (event.sourceCount !== 40 || event.caseCount !== declared.length || event.observationsComplete !== true) fail("incomplete run completion")
      completion = event
      phase = "complete"
      continue
    }
    fail("unexpected, incomplete or post-completion journal event")
  }
  if (phase !== "complete" || !completion || finished.length !== declared.length) fail("missing final cleanup or executed cases")
  if (summary?.status !== "PASS" || summary.report_sha256 !== hash(report) ||
      summary.counts?.product_executed !== declared.length || summary.counts?.tests !== declared.length ||
      summary.counts?.failures !== 0 || summary.counts?.errors !== 0 || summary.counts?.skipped !== 0 ||
      !Array.isArray(summary.cases) || summary.cases.length !== declared.length) fail("real JUnit is failed, skipped, empty, partial or detached from XML")
  const reported = new Map()
  for (const item of summary.cases) {
    if (item.executed !== 1 || item.product_executed !== 1 || item.failures !== 0 || item.errors !== 0 || item.skipped !== 0) fail("nonpassing real JUnit case")
    if (typeof item.file !== "string" || path.resolve(execution.cwd, item.file) !== path.resolve(repoRoot, POOL_ENTRY)) fail("JUnit executed a different file than the entry")
    const key = item.classname + "\0" + item.name
    if (reported.has(key)) fail("duplicate real JUnit case")
    reported.set(key, item)
  }
  for (const item of declared) if (!reported.has(item.source + "\0" + item.title)) fail("declared original case was not reported by Bun")
  const cleanLog = log.replace(/\x1b\[[0-9;]*m/g, "")
  const tag = "omni positive control [" + env.ORCHESTRA_OMNI_CONTROL_NONCE + "]: "
  const verdicts = cleanLog.split(/\r?\n/).filter((line) => line.includes(tag)).map((line) => line.slice(line.indexOf(tag) + tag.length).trim())
  const expectedVerdict = "pass (declared: 1 test(s) in " + POOL_STARTUP.slice(POOL_DIRECTORY.length + 1) + "); 1 omni spawn(s), 0 delegated."
  same(verdicts, [expectedVerdict], "startup Omni positive control did not pass exactly once")
  const proofs = cleanLog.split(/\r?\n/).filter((line) => line.includes("SF_WP02_BROWSER_DRIVER_PROOF "))
    .map((line) => JSON.parse(line.slice(line.indexOf("SF_WP02_BROWSER_DRIVER_PROOF ") + "SF_WP02_BROWSER_DRIVER_PROOF ".length)))
  if (proofs.length !== 1) fail("missing or duplicated real Node driver proof")
  const driver = proofs[0], closed = driver.lifecycle
  if (driver.consumer !== "wp01-shared-pool" || driver.clientRuntime?.name !== "bun" || driver.clientRuntime.pid !== execution.pid ||
      driver.clientRuntime.version !== execution.bunVersion || driver.driverRuntime?.name !== "node" ||
      !Number.isSafeInteger(driver.driverRuntime.pid) || driver.driverRuntime.pid < 1 || driver.driverRuntime.pid === execution.pid ||
      driver.browserPid !== lifecycle.pid || driver.browserPipeOwner !== "node" || driver.browserUsesPipe !== true ||
      driver.browserStdioCount !== 5 || driver.spawnBoundary !== "AppProcess" ||
      closed?.nodeExitCode !== 0 || closed.browserExitCode !== 0 || closed.browserSignal !== null ||
      closed.connected !== false || closed.remainingContexts !== 0) fail("driver/runtime/process shutdown mismatch")
  for (const name of ["bridgeClosed", "listenerClosed", "socketClosed", "pipeEnded", "webSocketOpened", "webSocketClosed", "webSocketCloseWasClean", "socketRemoved", "directoryRemoved"]) {
    if (closed[name] !== true) fail("incomplete driver cleanup: " + name)
  }
  if (closed.webSocketCloseCode !== 1000 || closed.pendingFrameBytes !== 0 || closed.queuedWriteBytes !== 0 ||
      driver.bridge?.acceptedClients !== 1) fail("unclosed or duplicated browser transport")
  if (!/^Google Chrome(?: for Testing)? \d+\.\d+\.\d+\.\d+/.test(chromeVersion.trim()) ||
      !chromeVersion.includes(driver.browserVersion)) fail("declared Google Chrome channel/version was not observed")
  return {
    schemaVersion: 1, gate: "G04-ORDERED-BROWSER-POOL", status: "PASS",
    proofClass: "COMPONENT_BROWSER_REGRESSION", installedTeamsProof: false,
    ...admission.metadata, selectedEntry: inventory.entry, originalSources: inventory.sources,
    originalSourceCount: 40, executedCases: declared.length, caseIdentitySha256: hash(json(declared)),
    cases: declared, execution, lifecycle, driver, omniVerdict: verdicts[0],
    manifest: inventory.manifest, inventorySha256: inventory.sha256,
    evidenceSha256: { report: hash(report), summary: hash(json(summary)), journal: hash(json(journal)), log: hash(log), chromeVersion: hash(chromeVersion) },
  }
}

export function verifyPool({ repoRoot, manifestPath, output, env = process.env }) {
  const inventory = loadPoolInventory(repoRoot, manifestPath)
  const admission = readPoolAdmission(output, inventory)
  const exitText = artifact(output, "exit-code.txt").toString("utf8").trim()
  if (!/^\d+$/.test(exitText)) fail("missing actual Bun exit status")
  const receipt = verifyPoolEvidence({
    admission, inventory, env, repoRoot, output, exitCode: Number(exitText),
    journal: artifact(output, "journal.jsonl").toString("utf8").trim().split("\n").map((line) => JSON.parse(line)),
    summary: JSON.parse(artifact(output, "summary.json").toString("utf8")),
    report: artifact(output, "report.xml"), log: artifact(output, "run.log").toString("utf8"),
    chromeVersion: artifact(output, "chrome-version.txt").toString("utf8"),
  })
  writeFileSync(path.join(output, "receipt.json"), json(receipt) + "\n", { flag: "wx", mode: 0o600 })
  return receipt
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, ...args] = process.argv.slice(2)
    if (!["prepare", "verify"].includes(mode) || args.length !== 4 || args[0] !== "--manifest" || args[2] !== "--output") {
      fail("usage: node script/sf-ci/browser-pool.mjs prepare|verify --manifest sf/ci/suites.json --output <fresh-evidence-directory>")
    }
    const input = { repoRoot: process.cwd(), manifestPath: args[1], output: path.resolve(args[3]) }
    const result = mode === "prepare" ? preparePool(input) : verifyPool(input)
    console.info("SF_BROWSER_POOL_" + (mode === "prepare" ? "PREPARED" : "VERIFIED"), json(mode === "prepare"
      ? { checkoutSha: result.metadata.checkoutSha, entry: result.inventory.entry, sourceCount: result.inventory.sources.length }
      : { status: result.status, checkoutSha: result.checkoutSha, treeSha: result.treeSha, originalSourceCount: result.originalSourceCount, executedCases: result.executedCases }))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
