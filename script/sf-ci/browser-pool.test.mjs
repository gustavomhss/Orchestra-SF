import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  POOL_DIRECTORY, POOL_ENTRY, POOL_STARTUP, POOL_FINALIZER,
  admitPoolCommand, createPoolRegistry, expandPoolTitle, hash, loadPoolInventory,
  openPoolJournal, preparePool, readPoolAdmission, verifyPool, verifyPoolEvidence,
} from "./browser-pool.mjs"

const root = path.resolve(new URL("../..", import.meta.url).pathname)
const source = POOL_DIRECTORY + "/Sucafinav1/test/product/example.test.ts"
const scope = { cwd: path.join(root, POOL_DIRECTORY), execPath: "/usr/bin/bun", platform: "linux", repoRoot: root }
const entryArg = "./" + POOL_ENTRY.slice(POOL_DIRECTORY.length + 1)
const command = ["bun", "test", entryArg]
const env = {
  SF_CHECKOUT_SHA: "a".repeat(40), SF_CHECKOUT_TREE_SHA: "b".repeat(40), GITHUB_SHA: "a".repeat(40),
  GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", RUNNER_OS: "Linux", RUNNER_ARCH: "X64",
  ORCHESTRA_OMNI_CONTROL: "declared", ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "strict",
  ORCHESTRA_OMNI_CONTROL_NONCE: "c".repeat(32),
}

test("manifest retains forty original sources and records the entry separately with candidate blob identities", () => {
  const inventory = loadPoolInventory(root)
  assert.equal(inventory.sources.length, 40)
  assert.equal(inventory.sources[0].path, POOL_STARTUP)
  assert.equal(inventory.sources.at(-1).path, POOL_FINALIZER)
  assert.equal(inventory.entry.path, POOL_ENTRY)
  assert.equal(inventory.sources.some((item) => item.path === POOL_ENTRY), false)
  assert.equal(new Set(inventory.sources.map((item) => item.path)).size, 40)
  for (const item of [inventory.entry, ...inventory.sources, ...inventory.support]) {
    assert.match(item.blob, /^[a-f0-9]{40}$/)
    assert.match(item.sha256, /^[a-f0-9]{64}$/)
  }
  for (const item of inventory.sources) {
    const content = readFileSync(path.join(root, item.path), "utf8")
    assert.equal((content.match(/^export function registerPoolTests\(/gm) || []).length, 1, item.path)
    assert.doesNotMatch(content, /^test(?:\.|\()/m, item.path)
    assert.doesNotMatch(content, /^import \{[^}]*\btest\b[^}]*\} from "bun:test"/m, item.path)
  }
})

test("the actual Linux argv admits only the one entry with ordinary budgets and JUnit flags", () => {
  assert.deepEqual(admitPoolCommand(command, scope), { command, timeout: null, report: null })
  const selected = [...command, "--timeout", "30000", "--reporter=junit", "--reporter-outfile=/tmp/pool/report.xml"]
  assert.equal(admitPoolCommand(selected, scope).report, "/tmp/pool/report.xml")
  assert.equal(admitPoolCommand(selected, scope).timeout, 30_000)
  assert.doesNotThrow(() => admitPoolCommand(["/usr/bin/bun", "test", "--timeout=120000", entryArg], scope))
})

for (const args of [
  [], ["."], ["./Sucafinav1/test/product/wp01/browser-startup.test.ts", entryArg],
  [entryArg, entryArg], ["*browser*.test.ts"], [entryArg, "-t", "one"],
  [entryArg, "--test-name-pattern=one"], [entryArg, "--bail"], [entryArg, "--bail=1"],
  [entryArg, "--isolate"], [entryArg, "--shard=1/2"], [entryArg, "--concurrent"],
  [entryArg, "--randomize"], [entryArg, "--seed=1"], [entryArg, "--retry=1"],
  [entryArg, "--rerun-each=2"], [entryArg, "--only"], [entryArg, "--preload", "other.ts"],
  [entryArg, "--timeout=0"], [entryArg, "--timeout=5", "--timeout", "10"],
  [entryArg, "--reporter=dot", "--reporter-outfile=/tmp/report.xml"],
  [entryArg, "--reporter=junit"], [entryArg, "--reporter-outfile=/tmp/report.xml"],
]) test("partial/reordered argv is refused: " + JSON.stringify(args), () => {
  assert.throws(() => admitPoolCommand(["bun", "test", ...args], scope), /SF_BROWSER_POOL_FAIL_CLOSED/)
})
test("different platform, executable or command cannot borrow pool admission", () => {
  assert.throws(() => admitPoolCommand(command, { ...scope, platform: "darwin" }))
  assert.throws(() => admitPoolCommand(["node", "test", entryArg], scope))
  assert.throws(() => admitPoolCommand(["bun", "run", entryArg], scope))
})

/** Registration double only: never starts a browser or represents product execution. */
function adapter() {
  const records = [], scopes = [], eachCalls = []
  const native = (title, fn, budget) => records.push({ title, fn, budget })
  native.each = (table) => (title, fn, budget) => {
    eachCalls.push({ table, title, budget })
    for (const value of table) records.push({ title, fn: () => fn(value), budget })
  }
  return { native, describe: (name, fn) => { scopes.push(name); fn() }, records, scopes, eachCalls }
}
function registration() {
  const events = [], native = adapter()
  const registry = createPoolRegistry([POOL_STARTUP, source, POOL_FINALIZER], (event) => events.push(event))
  const register = (name, callback) => registry.register(name, callback, native.native, native.describe)
  return { events, native, registry, register }
}
test("native each tables, expanded provenance, titles and per-case budgets stay intact", async () => {
  const input = registration(), bodies = []
  input.register(POOL_STARTUP, (test) => test("startup", () => { input.registry.assertStartup(); bodies.push("start") }, 35_000))
  input.register(source, (test) => {
    test.each([401, 403])("denial %i", async (value) => { bodies.push(value) }, 12_345)
    test.each(["lost", "stale"])("result %s", (value) => { bodies.push(value) }, 23_456)
  })
  input.register(POOL_FINALIZER, (test) => test("finalizer", () => { bodies.push("close") }, 25_000))
  input.registry.seal()
  assert.deepEqual(input.native.scopes, [POOL_STARTUP, source, POOL_FINALIZER])
  assert.deepEqual(input.native.eachCalls, [
    { table: [401, 403], title: "denial %i", budget: 12_345 },
    { table: ["lost", "stale"], title: "result %s", budget: 23_456 },
  ])
  assert.deepEqual(input.native.records.map((item) => item.budget), [35_000, 12_345, 12_345, 23_456, 23_456, 25_000])
  assert.deepEqual(input.events.filter((item) => item.type === "case-declared").map((item) => item.case.title),
    ["startup", "denial 401", "denial 403", "result lost", "result stale", "finalizer"])
  for (const item of input.native.records) await item.fn()
  assert.deepEqual(bodies, ["start", 401, 403, "lost", "stale", "close"])
  assert.deepEqual(input.registry.complete(), { sourceCount: 3, caseCount: 6 })
  await assert.rejects(input.native.records[0].fn, /out of order, twice/)
  assert.throws(() => input.registry.assertStartup(), /outside its named/)
})
test("duplicate titles in different sources retain separate identities", async () => {
  const input = registration()
  for (const file of [POOL_STARTUP, source, POOL_FINALIZER]) input.register(file, (test) => test("same title", () => {}))
  input.registry.seal()
  for (const record of input.native.records) await record.fn()
  assert.equal(new Set(input.events.filter((item) => item.type === "case-declared").map((item) => item.case.id)).size, 3)
  assert.equal(input.registry.complete().caseCount, 3)
})
test("a failed consumer still permits the named finalizer and cannot complete green", async () => {
  const input = registration(), visited = []
  input.register(POOL_STARTUP, (test) => test("startup", () => { visited.push("start") }))
  input.register(source, (test) => test("failure", () => { throw new Error("consumer assertion") }))
  input.register(POOL_FINALIZER, (test) => test("finalizer", () => { visited.push("close") }))
  input.registry.seal()
  await input.native.records[0].fn()
  await assert.rejects(input.native.records[1].fn, /consumer assertion/)
  await input.native.records[2].fn()
  assert.deepEqual(visited, ["start", "close"])
  assert.throws(() => input.registry.complete(), /case body failed/)
})
test("registration gaps, duplicates, automatic execution and premature completion are rejected", async () => {
  const input = registration()
  assert.throws(() => input.registry.assertStartup())
  input.register(POOL_STARTUP, (test) => test("startup", () => {}))
  await assert.rejects(input.native.records[0].fn, /before complete registration/)
  assert.throws(() => input.registry.seal(), /not every original source/)
  assert.throws(() => input.register(POOL_STARTUP, () => {}), /unknown, duplicate or missing/)
  input.register(source, (test) => test("consumer", () => {}))
  input.register(POOL_FINALIZER, (test) => test("finalizer", () => {}))
  input.registry.seal()
  assert.throws(() => input.registry.seal(), /already sealed/)
  await assert.rejects(input.native.records[1].fn, /out of order/)
  assert.throws(() => input.registry.complete(), /unexecuted cases/)
})
for (const [name, callback] of [
  ["empty source", () => {}],
  ["duplicate title", (test) => { test("same", () => {}); test("same", () => {}) }],
  ["duplicate parameter", (test) => test.each([401, 401])("denial %i", (value) => value)],
  ["empty parameter table", (test) => test.each([])("denial %i", (value) => value)],
  ["unreviewed structured parameter", (test) => test.each([{ id: 1 }])("value %p", (value) => value)],
  ["retry option", (test) => test("retry", () => {}, { retry: 1 })],
  // This is the synthetic registrar under test; the real Node test must run and reject it.
  ["skipped case", (registerCase) => registerCase.skip("skip", () => {})],
]) test("registration refuses " + name, () => {
  const input = registration()
  assert.throws(() => input.register(POOL_STARTUP, callback))
})
test("parameter title review does not silently accept additional formatting behavior", () => {
  assert.equal(expandPoolTitle("denial %i", 403), "denial 403")
  assert.equal(expandPoolTitle("result %s", "lost"), "result lost")
  assert.throws(() => expandPoolTitle("%p", { id: 1 }))
  assert.throws(() => expandPoolTitle("%i", "403"))
  assert.throws(() => expandPoolTitle("%s %s", "one"))
})

/** Synthetic verifier input exercises the gate algorithm only, never a browser/LIVE proof. */
async function evidence() {
  const output = mkdtempSync(path.join(tmpdir(), "sf-pool-verifier-unit-"))
  const admission = preparePool({ repoRoot: root, output, env })
  const inventory = admission.inventory
  const journal = []
  const emit = (event) => journal.push({ seq: journal.length + 1, ...event })
  const execution = { ...scope, command: [...command, "--reporter=junit", "--reporter-outfile=" + path.join(output, "report.xml")],
    pid: 200, bunVersion: "1.3.14" }
  delete execution.repoRoot
  emit({ type: "run-start", inventorySha256: inventory.sha256, execution })
  const native = adapter()
  const registry = createPoolRegistry(inventory.sources.map((item) => item.path), emit)
  for (const item of inventory.sources) registry.register(item.path, (test) => test("same title", () => {}), native.native, native.describe)
  registry.seal()
  for (const item of native.records) await item.fn()
  emit({ type: "lifecycle", evidence: { launches: 1, acquisitions: 38, releases: 38,
    pid: 202, activeLease: false, contexts: 0, disconnected: true, driverClosed: true,
    processExited: true, sealed: true, verified: true, failed: false } })
  emit({ type: "run-complete", observationsComplete: true, ...registry.complete() })
  const declared = journal.filter((item) => item.type === "case-declared").map((item) => item.case)
  const cases = declared.map((item) => ({ name: item.title, classname: item.source,
    file: POOL_ENTRY.slice(POOL_DIRECTORY.length + 1), failures: 0, errors: 0, skipped: 0,
    executed: 1, product_executed: 1 }))
  const report = Buffer.from('<testsuites tests="40">' + cases.map((item) =>
    '<testsuite file="' + item.file + '"><testcase name="' + item.name + '" classname="' + item.classname + '" /></testsuite>').join("") + "</testsuites>")
  const summary = { status: "PASS", report_sha256: hash(report),
    counts: { tests: 40, product_executed: 40, failures: 0, errors: 0, skipped: 0 }, cases }
  const driver = { consumer: "wp01-shared-pool", clientRuntime: { name: "bun", version: "1.3.14", pid: 200 },
    driverRuntime: { name: "node", version: "24.0.0", pid: 201 },
    browserPid: 202, browserVersion: "140.0.1.2", browserPipeOwner: "node", browserUsesPipe: true,
    browserStdioCount: 5, spawnBoundary: "AppProcess", bridge: { acceptedClients: 1 },
    lifecycle: { nodeExitCode: 0, browserExitCode: 0, browserSignal: null, connected: false, remainingContexts: 0,
      bridgeClosed: true, listenerClosed: true, socketClosed: true, pipeEnded: true, webSocketOpened: true,
      webSocketClosed: true, webSocketCloseWasClean: true, socketRemoved: true, directoryRemoved: true,
      webSocketCloseCode: 1000, pendingFrameBytes: 0, queuedWriteBytes: 0 } }
  const log = "omni positive control [" + env.ORCHESTRA_OMNI_CONTROL_NONCE + "]: pass (declared: 1 test(s) in " +
    POOL_STARTUP.slice(POOL_DIRECTORY.length + 1) + "); 1 omni spawn(s), 0 delegated.\nSF_WP02_BROWSER_DRIVER_PROOF " + JSON.stringify(driver) + "\n"
  return { admission, inventory, journal, summary, report, log, exitCode: 0, chromeVersion: "Google Chrome 140.0.1.2\n",
    env: { ...env }, repoRoot: root, output }
}
test("supplemental receipt preserves entry provenance separately from actual original-source case attribution", async () => {
  const data = await evidence()
  try {
    const receipt = verifyPoolEvidence(data)
    assert.equal(receipt.status, "PASS")
    assert.equal(receipt.installedTeamsProof, false)
    assert.equal(receipt.originalSourceCount, 40)
    assert.equal(receipt.executedCases, 40)
    assert.equal(receipt.selectedEntry.path, POOL_ENTRY)
    assert.equal(receipt.originalSources.some((item) => item.path === POOL_ENTRY), false)
    assert.equal(new Set(receipt.cases.map((item) => item.source)).size, 40)
    assert.equal(receipt.lifecycle.processExited, true)
  } finally { rmSync(data.output, { recursive: true, force: true }) }
})

const mutations = [
  ["nonzero real Bun exit despite green body observations", (a) => { a.exitCode = 1 }],
  ["candidate SHA drift", (a) => { a.env.GITHUB_SHA = "d".repeat(40) }],
  ["checkout tree drift", (a) => { a.env.SF_CHECKOUT_TREE_SHA = "d".repeat(40) }],
  ["run attempt drift", (a) => { a.env.GITHUB_RUN_ATTEMPT = "2" }],
  ["Omni disabled", (a) => { a.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER = "0" }],
  ["different Omni nonce", (a) => { a.env.ORCHESTRA_OMNI_CONTROL_NONCE = "d".repeat(32) }],
  ["entry blob drift", (a) => { a.inventory.entry.blob = "d".repeat(40) }],
  ["source blob drift", (a) => { a.inventory.sources[1].blob = "d".repeat(40) }],
  ["empty runtime journal", (a) => { a.journal = [] }],
  ["journal order drift", (a) => { a.journal[1].seq = 99 }],
  ["missing source registration", (a) => { a.journal = a.journal.filter((item) => item.type !== "source-registered" || item.source !== POOL_STARTUP) }],
  ["empty source registration", (a) => { a.journal.find((item) => item.type === "source-registered").cases = 0 }],
  ["missing named finalizer execution", (a) => { a.journal.splice(a.journal.findLastIndex((item) => item.type === "case-finish"), 1) }],
  ["case callback failure", (a) => { a.journal.find((item) => item.type === "case-finish").bodyStatus = "threw" }],
  ["missing final cleanup", (a) => { a.journal = a.journal.filter((item) => item.type !== "lifecycle") }],
  ["unobserved process exit", (a) => { a.journal.find((item) => item.type === "lifecycle").evidence.processExited = false }],
  ["unreleased browser lease", (a) => { a.journal.find((item) => item.type === "lifecycle").evidence.releases-- }],
  ["post-finalizer extra execution", (a) => { a.journal.push({ type: "case-start", id: "extra" }) }],
  ["missing completion", (a) => { a.journal.pop() }],
  ["a filter in actual argv", (a) => { a.journal[0].execution.command.push("-t", "same title") }],
  ["a different JUnit output", (a) => { a.journal[0].execution.command[a.journal[0].execution.command.length - 1] = "--reporter-outfile=/tmp/other.xml" }],
  ["hook failure in actual Bun report", (a) => { a.summary.status = "FAIL"; a.summary.counts.errors = 1 }],
  ["skipped Bun case", (a) => { a.summary.counts.skipped = 1; a.summary.cases[0].skipped = 1 }],
  ["missing real Bun case", (a) => { a.summary.cases.pop() }],
  ["duplicate real Bun case", (a) => { a.summary.cases[1] = a.summary.cases[0] }],
  ["false original-file execution attribution", (a) => { a.summary.cases[0].file = POOL_STARTUP.slice(POOL_DIRECTORY.length + 1) }],
  ["entry counted as an original source", (a) => { a.summary.cases[0].classname = POOL_ENTRY }],
  ["XML summary detached from raw reporter", (a) => { a.report = Buffer.from("<other/>") }],
  ["missing driver shutdown proof", (a) => { a.log = a.log.split("SF_WP02_BROWSER_DRIVER_PROOF")[0] }],
  ["duplicate Omni verdict", (a) => { a.log += a.log.split("\n")[0] + "\n" }],
  ["Omni not applicable", (a) => { a.log = a.log.replace(": pass (", ": not applicable (") }],
  ["legacy process delegation", (a) => { a.log = a.log.replace("0 delegated.", "1 delegated.") }],
  ["replacement browser spawn", (a) => { a.log = a.log.replace("1 omni spawn(s)", "2 omni spawn(s)") }],
  ["Chromium substituted for Chrome", (a) => { a.chromeVersion = "Chromium 140.0.1.2" }],
  ["different actual Chrome version", (a) => { a.chromeVersion = "Google Chrome 141.0.1.2" }],
]
test("mutations cannot turn partial, failed, misattributed or stale evidence into PASS", async (context) => {
  const good = await evidence()
  try {
    for (const [name, mutate] of mutations) await context.test(name, () => {
      const changed = structuredClone(good)
      mutate(changed)
      if (name !== "journal order drift") changed.journal.forEach((item, index) => { item.seq = index + 1 })
      assert.throws(() => verifyPoolEvidence(changed), /SF_BROWSER_POOL_FAIL_CLOSED/, name)
    })
  } finally { rmSync(good.output, { recursive: true, force: true }) }
})
test("prepare refuses stale evidence and does not persist the Omni nonce", () => {
  const output = mkdtempSync(path.join(tmpdir(), "sf-pool-prepare-unit-"))
  try {
    const admitted = preparePool({ repoRoot: root, output, env })
    assert.equal(readFileSync(path.join(output, "admission.json"), "utf8").includes(env.ORCHESTRA_OMNI_CONTROL_NONCE), false)
    assert.equal(admitted.metadata.omniNonceSha256, hash(env.ORCHESTRA_OMNI_CONTROL_NONCE))
    assert.throws(() => preparePool({ repoRoot: root, output, env }), /fresh and empty/)
    assert.throws(() => readPoolAdmission(output, { ...admitted.inventory, sha256: "0".repeat(64) }), /changed after admission/)
  } finally { rmSync(output, { recursive: true, force: true }) }
})
test("write-once journal records incomplete execution; verifier never emits a receipt for missing artifacts", () => {
  const output = mkdtempSync(path.join(tmpdir(), "sf-pool-partial-unit-"))
  try {
    const admitted = preparePool({ repoRoot: root, output, env })
    const emit = openPoolJournal(output, admitted.inventory, { command })
    emit({ type: "run-incomplete", observationsComplete: false })
    assert.equal(readFileSync(path.join(output, "journal.jsonl"), "utf8").trim().split("\n").length, 2)
    assert.throws(() => openPoolJournal(output, admitted.inventory, { command }), /EEXIST/)
    assert.throws(() => verifyPool({ repoRoot: root, output, env }), /missing or unsafe evidence/)
    assert.equal(existsSync(path.join(output, "receipt.json")), false)
  } finally { rmSync(output, { recursive: true, force: true }) }
})
test("verify writes a separate receipt only after all supplied artifacts agree and refuses reuse", async () => {
  const data = await evidence()
  try {
    for (const [name, value] of Object.entries({
      "exit-code.txt": "0\n", "journal.jsonl": data.journal.map((item) => JSON.stringify(item)).join("\n") + "\n",
      "summary.json": JSON.stringify(data.summary), "report.xml": data.report, "run.log": data.log,
      "chrome-version.txt": data.chromeVersion,
    })) writeFileSync(path.join(data.output, name), value)
    const receipt = verifyPool({ repoRoot: root, output: data.output, env: data.env })
    assert.equal(JSON.parse(readFileSync(path.join(data.output, "receipt.json"), "utf8")).caseIdentitySha256, receipt.caseIdentitySha256)
    assert.throws(() => verifyPool({ repoRoot: root, output: data.output, env: data.env }), /EEXIST/)
  } finally { rmSync(data.output, { recursive: true, force: true }) }
})

test("Bun's deferred describe collection finishes before the root beforeAll seals the registry", async () => {
  const queue = [], events = [], native = adapter()
  const sources = [POOL_STARTUP, source, POOL_FINALIZER]
  const registry = createPoolRegistry(sources, (event) => events.push(event))
  for (const file of sources) registry.register(file, (test) => test("native case", () => {}),
    native.native, (name, callback) => { queue.push({ name, callback }) })
  assert.equal(native.records.length, 0, "describe callbacks have only been queued")
  assert.throws(() => registry.seal(), /not every original source registered/)
  for (const item of queue) item.callback()
  registry.seal()
  assert.deepEqual(events.filter((item) => item.type === "source-registered").map((item) => item.source), sources)
  for (const item of native.records) await item.fn()
  assert.deepEqual(registry.complete(), { sourceCount: 3, caseCount: 3 })
})
test("a deferred source callback cannot collect out of order", () => {
  const queue = [], native = adapter()
  const registry = createPoolRegistry([POOL_STARTUP, source, POOL_FINALIZER], () => {})
  for (const file of [POOL_STARTUP, source, POOL_FINALIZER]) registry.register(file, (test) => test("case", () => {}),
    native.native, (_name, callback) => { queue.push(callback) })
  assert.throws(queue[1], /source collection order changed/)
})

test("a hook-shaped missing consumer still reaches named finalization and remains incomplete", async () => {
  const input = registration(), visited = []
  for (const [file, title] of [[POOL_STARTUP, "start"], [source, "consumer"], [POOL_FINALIZER, "close"]]) {
    input.register(file, (test) => test(title, () => { visited.push(title) }))
  }
  input.registry.seal()
  await input.native.records[0].fn()
  // Bun omits this scope's consumer when its beforeAll fails.
  await input.native.records[2].fn()
  assert.deepEqual(visited, ["start", "close"])
  assert.deepEqual(input.registry.observations(), { sourceCount: 3, declaredCases: 3,
    bodiesStarted: 2, bodiesFinished: 2, bodiesReturned: 2, bodiesThrew: 0, activeCase: null, forcedFinalization: true })
  assert.equal(input.events.some((item) => item.type === "case-incomplete"), true)
  assert.throws(() => input.registry.complete(), /incomplete execution/)
})
test("a timed-out pending body cannot prevent named cleanup or yield a complete receipt", async () => {
  const input = registration(), visited = []
  let resume
  input.register(POOL_STARTUP, (test) => test("startup", () => {}))
  input.register(source, (test) => test("pending", async () => { await new Promise((resolve) => { resume = resolve }); visited.push("late") }))
  input.register(POOL_FINALIZER, (test) => test("finalizer", () => { visited.push("close") }))
  input.registry.seal()
  await input.native.records[0].fn()
  const pending = input.native.records[1].fn()
  await input.native.records[2].fn()
  assert.deepEqual(visited, ["close"])
  assert.throws(() => input.registry.complete(), /incomplete execution/)
  resume()
  await pending
  assert.deepEqual(visited, ["close", "late"])
  assert.throws(() => input.registry.complete(), /incomplete execution/)
})
