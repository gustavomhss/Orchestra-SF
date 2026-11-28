import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

type Fault = "none" | "zero" | "partial" | "throw"
export const e16Modes = ["route-owner", "work-links", "native-chain", "persistence-tail", "capacity", "mechanism", "sink-zero", "sink-partial", "sink-throw", "forwarder"] as const
export type E16Mode = typeof e16Modes[number]
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex") }


/** Process isolation is required by the production selection latch; there is no reset API. */
export async function runSfE16Control(file: string, mode: E16Mode) {
  const [{ AppProcess }, { LayerNode }, { expectSpawn }, { Effect }, { ChildProcess }, { Omni }] = await Promise.all([
    import("@orchestra/core/process"), import("@orchestra/core/effect/layer-node"),
    import("@orchestra/core/test/fixture/omni-expect"), import("effect"), import("effect/unstable/process"),
    import("@orchestra/core/omni"),
  ])
  expectSpawn(file)
  const before = Omni.snapshot()
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(process.execPath, [import.meta.path, mode], {
      cwd: import.meta.dir, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "1 second",
    }), { timeout: 3_000, maxOutputBytes: 65_536, maxErrorBytes: 65_536 })
  }), LayerNode.compile(AppProcess.node))))
  const after = Omni.snapshot()
  const stdout = result.stdout.toString("utf8"), stderr = result.stderr.toString("utf8")
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated)
    throw new Error("E16 observer control did not complete: " + JSON.stringify({
      mode, exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!record(receipt) || receipt.schema !== "sf-preview-e16-control-child-v1" || receipt.mode !== mode ||
    typeof receipt.pid !== "number" || !Number.isSafeInteger(receipt.pid) || receipt.pid <= 0 ||
    receipt.synthetic !== true || !Array.isArray(receipt.checks) || !receipt.checks.length ||
    receipt.checks.some((item: unknown) => typeof item !== "string") || Buffer.byteLength(stdout, "utf8") > 16_384)
    throw new Error("E16 observer control returned an invalid receipt")
  return { pid: receipt.pid, report: receipt,
    omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}


async function child(mode: E16Mode) {
  const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty, remove = Reflect.deleteProperty
  const apply = Reflect.apply, parse = JSON.parse, stringify = JSON.stringify
  const savedRun = property(AsyncLocalStorage.prototype, "run"), savedGet = property(AsyncLocalStorage.prototype, "getStore")
  const savedNow = property(performance, "now")
  assert.ok(savedRun && savedGet)
  const nativeRun = savedRun.value
  assert.equal(typeof nativeRun, "function")
  const repository = realpathSync(fileURLToPath(new URL("../../../../", import.meta.url)))
  const evidenceBase = path.join(repository, "test-ci-evidence")
  mkdirSync(evidenceBase, { recursive: true })
  const directory = mkdtempSync(path.join(evidenceBase, "sf613-e16-event-"))
  const privateDirectory = mkdtempSync(path.join(os.tmpdir(), "sf613-e16-control-"))
  const directoryKey = "SF_PREVIEW_E16_EVENT_EVIDENCE_DIR", bindingKey = "SF_PREVIEW_E16_EVENT_EVIDENCE_BINDING"
  const oldDirectory = process.env[directoryKey], oldBinding = process.env[bindingKey]
  const argv = [...process.argv], cwd = process.cwd()
  const source = "ad3a4a7527baf1e092e87b5478626b2f0a3be57c", sourceTree = "11bf210f469be26630c39db586bcfcce87e0de1b"
  const launcher = { schema: "sf-preview-e16-event-launch-v1", source, sourceTree, snapshot: "f".repeat(40),
    runId: "1", attempt: "1", nonce: path.basename(directory), processRole: "native-cli", streamName: "preview-events.jsonl" }
  const launcherRaw = stringify(launcher) + "\n", launcherPath = path.join(directory, "launcher.json")
  const launcherFd = openSync(launcherPath, "wx", 0o600)
  try { writeSync(launcherFd, launcherRaw, undefined, "utf8"); fsyncSync(launcherFd) } finally { closeSync(launcherFd) }
  const binding = stringify({ ...launcher, launcherBytes: Buffer.byteLength(launcherRaw, "utf8"), launcherSha256: sha256(launcherRaw) })
  const prefix = "SF_PREVIEW_E16_EVENT ", launcherPrefix = "SF_PREVIEW_E16_LAUNCHER ", eventFile = path.join(directory, "preview-events.jsonl")
  const lines: string[] = [], fragments: string[] = [], checks: string[] = []
  const attempts = { file: 0, stdout: 0 }, faults: Record<"file" | "stdout", Fault> = { file: "none", stdout: "none" }
  let clock = 1_000, requestGets = 0, writeAction: (() => void) | undefined
  const sentinel = {}, product = {}, outputError = new Error("synthetic-output")
  const selectedRequest = new Request("https://example.invalid/selected", { method: "POST", headers: { origin: "https://example.invalid" } })
  const request = mode === "native-chain" ? selectedRequest : new Proxy(selectedRequest, { get() { requestGets++; throw outputError } })
  const foreign = new Proxy(new Request("https://example.invalid/foreign"), { get() { requestGets++; throw outputError } })
  function rows() {
    return lines.map((line) => {
      assert.ok(line.startsWith(prefix) && line.endsWith("\n"))
      assert.ok(Buffer.byteLength(line, "utf8") <= 1_024)
      const value: unknown = parse(line.slice(prefix.length))
      assert.ok(record(value))
      return value
    })
  }
  function one(kind: string) { const values = rows().filter((item) => item.kind === kind); assert.equal(values.length, 1); return values[0]! }
  function routeRows(kind?: string) { return rows().filter((row) => row.kind === "route" && (kind === undefined || row.routeKind === kind)) }
  function point(name: string, kind?: string) {
    const found = routeRows(kind).filter((row) => row.point === name)
    assert.equal(found.length, 1)
    return found[0]!
  }
  function restore(owner: object, key: string, descriptor: PropertyDescriptor | undefined) {
    if (descriptor) define(owner, key, descriptor); else remove(owner, key)
  }
  let finalReceipt: Record<string, unknown> | undefined, cleanupObservation: (() => void) | undefined
  try {
    process.chdir(privateDirectory)
    process.argv.splice(1, process.argv.length - 1, path.join(repository, "apps/cli/src/index.ts"), "serve")
    process.env[directoryKey] = directory
    process.env[bindingKey] = binding
    define(performance, "now", { configurable: true, value: () => { clock += 0.1; return clock } })
    // A detached snapshot avoids delegating through Bun's mutable module namespace.
    // Only the diagnostic sink is intercepted; real file operations and other writes remain real.
    const originalFs = { ...await import("node:fs") }
    const { mock } = await import("bun:test")
    mock.module("node:fs", () => ({ ...originalFs, writeSync(fd: number, data: unknown, ...rest: unknown[]): number {
      if (typeof data !== "string" || !data.startsWith(prefix) && !data.startsWith(launcherPrefix))
        return apply(originalFs.writeSync, undefined, [fd, data, ...rest])
      const sink = fd === 1 ? "stdout" : "file"
      attempts[sink]++
      const action = writeAction
      writeAction = undefined
      action?.()
      if (faults[sink] === "throw") throw undefined
      if (faults[sink] === "zero") return 0
      if (faults[sink] === "partial") {
        const fragment = data.slice(0, Math.floor(data.length / 2))
        if (sink === "stdout") { fragments.push(fragment); return Buffer.byteLength(fragment, "utf8") }
        return originalFs.writeSync(fd, fragment, undefined, "utf8")
      }
      if (sink === "stdout") { lines.push(data); return Buffer.byteLength(data, "utf8") }
      return apply(originalFs.writeSync, undefined, [fd, data, ...rest])
    } }))
    const observer = await import("../../../../modules/sucafina/Sucafinav1/runtime/preview-progress-e16-diagnostic.ts")
    const handle = mode === "forwarder" ? undefined : observer.startSfE16Observation(request)
    cleanupObservation = () => observer.finishSfE16Observation(handle, request, true)
    if (mode !== "forwarder") {
      assert.ok(handle)
      assert.equal(observer.startSfE16Observation(foreign), undefined)
      assert.equal(one("request-enter").maxEvents, 191)
      assert.equal(one("request-enter").maxBytes, 195_584)
      assert.equal(one("request-enter").maxLineBytes, 1_024)
    }



    function lookup(wrapped = false, gates: readonly unknown[] = [true, true, true, true, true], copyThrew = false) {
      const route = observer.enterSfE16Route("lookup")
      assert.equal(route, undefined)
      const receiver = {}, snapshot = {}, callback = () => product
      let invoked = 0
      const providerWork = function (this: unknown, value: unknown) {
        assert.equal(this, receiver); assert.equal(value, snapshot); invoked++; return product
      }
      const sourceWork = () => apply(providerWork, receiver, [snapshot])
      const forwarded = wrapped ? () => sourceWork() : sourceWork
      const before = lines.length
      let result: unknown, caught: unknown = sentinel, failed = false
      try { result = observer.runSfE16Route(route, "candidate-read", () => {
        assert.equal(observer.currentSfE16Route(), undefined)
        assert.equal(observer.linkSfE16Work(route, "provider-read", providerWork, callback), providerWork)
        for (const work of [providerWork, sourceWork, forwarded])
          for (const layer of ["source", "choice", "local"] as const)
            assert.equal(observer.enterSfE16Layer(layer, work), undefined)
        assert.equal(observer.linkSfE16Work(route, "source-work", sourceWork), sourceWork)
        assert.equal(observer.linkSfE16Work(route, "choice-wrapped", forwarded), forwarded)
        const names = ["source-root-current", "callback-equal", "store-current", "view-current", "product-condition"] as const
        for (let index = 0; index < names.length; index++)
          assert.equal(observer.tapSfE16Gate(route, names[index]!, gates[index]), gates[index])
        observer.markSfE16Route(route, "source-selection", "decisionResults")
        observer.markSfE16Route(route, "copy-enter", wrapped ? "full" : "projected")
        if (copyThrew) throw undefined
        assert.equal(forwarded(), product)
        assert.equal(observer.tapSfE16ProviderSelection(callback, "decisionResults"), "decisionResults")
        return observer.returnedSfE16Route(route, "candidate-read-returned", product)
      }) } catch (error) { failed = true; caught = error }
      finally { observer.finishSfE16Route(route, failed) }
      assert.equal(failed, copyThrew)
      if (copyThrew) assert.equal(caught, undefined); else assert.equal(result, product)
      assert.equal(invoked, copyThrew ? 0 : 1)
      assert.equal(lines.length, before)
      return route
    }
    async function persistence(reenterClose = false, pause?: { entered(): void; waiting: Promise<void> }, reserved = false) {
      const route = observer.enterSfE16Route("persistence")
      assert.ok(route)
      let calls = 0
      const receiver = {}, payload = {}, providerWork = function (this: unknown, value: unknown) {
        assert.equal(this, receiver); assert.equal(value, payload); calls++; return product
      }
      const sourceWork = () => apply(providerWork, receiver, [payload])
      const operationWork = () => product
      const result = await observer.runSfE16Route(route, "persist-body", async () => {
        const unrelated = () => product
        assert.equal(observer.enterSfE16Layer("operation", unrelated), undefined)
        assert.equal(observer.linkSfE16Work(route, "local-operation", unrelated), unrelated)
        assert.equal(observer.enterSfE16Layer("operation", unrelated), undefined)
        const write = await observer.runSfE16Route(route, "store-write", async () => {
          const value = await observer.runSfE16Route(route, "state-transaction", async () => {
            assert.equal(observer.linkSfE16Work(route, "provider-write", providerWork), providerWork)
            assert.equal(observer.enterSfE16Layer("source", unrelated), undefined)
            assert.equal(observer.enterSfE16Layer("source", providerWork), route)
            observer.markSfE16Route(route, "source-selection", undefined)
            assert.equal(observer.linkSfE16Work(route, "source-work", sourceWork), sourceWork)
            assert.equal(observer.enterSfE16Layer("choice", sourceWork), route)
            observer.markSfE16Route(route, "choice-forward", "direct")
            assert.equal(observer.enterSfE16Layer("local", sourceWork), route)
            observer.markSfE16Route(route, "local-enter", "top-level")
            assert.equal(observer.linkSfE16Work(route, "local-operation", operationWork), operationWork)
            assert.equal(observer.enterSfE16Layer("operation", unrelated), undefined)
            assert.equal(observer.enterSfE16Layer("operation", operationWork), route)
            observer.markSfE16Route(route, "queue-enter")
            if (pause) { pause.entered(); await pause.waiting }
            for (const name of ["queue-returned", "begin-enter", "begin-returned", "materialize-enter", "materialize-returned", "source-work-enter"] as const)
              observer.markSfE16Route(route, name)
            assert.equal(calls, 0)
            assert.equal(sourceWork(), product)
            assert.equal(observer.returnedSfE16Route(route, "source-work-returned", product), product)
            for (const name of ["source-finish-enter", "source-finish-returned", "source-dispose-enter", "source-dispose-returned", "local-scope-closed",
              "encode-enter", "encode-returned", "decode-returned", "sql-returned", "commit-enter", "commit-returned", "local-returning", "operation-returned"] as const)
              observer.markSfE16Route(route, name)
            return product
          })
          assert.equal(value, product)
          return observer.returnedSfE16Route(route, "state-transaction-returned", value)
        })
        assert.equal(observer.returnedSfE16Route(route, "store-write-returned", write), product)
        const recordedBeforeBinding = routeRows("persistence").map((row) => row.point)
        assert.ok(recordedBeforeBinding.includes("commit-returned"))
        assert.equal(recordedBeforeBinding.includes("persist-close"), false)
        observer.markSfE16Route(route, "binding-enter")
        if (reserved) await syntheticBindingSequence(route)
        // Binding's unrelated work cannot be attributed to the selected store-write transaction.
        assert.equal(observer.enterSfE16Layer("operation", unrelated), undefined)
        observer.markSfE16Route(route, "binding-returned")
        observer.markSfE16Route(route, "validation-enter")
        observer.markSfE16Route(route, "validation-returned")
        if (reenterClose) writeAction = () => observer.finishSfE16Observation(handle, request, false)
        assert.equal(observer.returnedSfE16Route(route, "binding-read-returned", product), product)
        return product
      })
      assert.equal(result, product); assert.equal(calls, 1)
      observer.finishSfE16Route(route, false)
      return route
    }

    async function syntheticBindingSequence(route: unknown, missingVerifier = false) {
      // This mode proves the diagnostic protocol and its independent reservations.
      // The real consumer/verifier is exercised separately in work-links.
      const owner = () => product, context = {}, binding = {}
      let validationNumber = 0, actualVerifiers = 0
      async function validate(method: unknown, site: "bind-prewrite" | "read-initial" | "read-final") {
        const validation = observer.prepareSfE16Validation(method, site, binding)
        assert.ok(validation)
        const ordinal = ++validationNumber
        const result = await observer.runSfE16Validation(validation, async () => {
          observer.enterSfE16Validation(owner, binding, context)
          assert.equal(observer.currentSfE16Validation(binding, context), validation)
          const rejected = observer.prepareSfE16Validation(method, site, binding)
          assert.equal(rejected, undefined)
          const before = lines.length
          assert.equal(observer.runSfE16Validation(rejected, () => {
            assert.equal(observer.currentSfE16Validation(binding, context), undefined)
            assert.equal(observer.prepareSfE16Verifier(binding, context), undefined)
            assert.equal(observer.returnedSfE16Validation(validation, product), product)
            return product
          }), product)
          assert.equal(lines.length, before)
          assert.equal(observer.currentSfE16Validation(binding, context), validation)
          const verifier = observer.prepareSfE16Verifier(binding, context)
          assert.ok(verifier)
          assert.equal(observer.prepareSfE16Verifier(binding, context), undefined)
          const actual = { verifyComparison: async () => {
            actualVerifiers++
            observer.enterSfE16Verifier(binding, context)
            return true
          } }
          const proof = missingVerifier && ordinal === 2 ? undefined : actual
          const fresh = !(missingVerifier && ordinal === 1)
          const accepted = fresh && observer.returnedSfE16Verifier(verifier,
            await observer.runSfE16Verifier(verifier, () => proof?.verifyComparison() ?? Promise.resolve(false)))
          if (!accepted) return false
          observer.markSfE16Validation(validation, "observer-enter")
          observer.markSfE16Validation(validation, "work-enter")
          observer.returnedSfE16ValidationPoint(validation, "criteria-await-returned", await Promise.resolve(product))
          observer.returnedSfE16ValidationPoint(validation, "observer-await-returned", await Promise.resolve(product))
          if (missingVerifier && ordinal === 5) {
            let calls = 0
            const promise = Promise.resolve(product)
            define(AsyncLocalStorage.prototype, "run", { ...savedRun, value: (_token: unknown, callback: unknown) => {
              assert.ok(typeof callback === "function")
              return apply(callback, undefined, [])
            } })
            try {
              const returned = observer.runSfE16BindingMethod(undefined, () => {
                calls++
                assert.equal(observer.currentSfE16Validation(binding, context), undefined)
                assert.equal(observer.prepareSfE16Verifier(binding, context), undefined)
                return promise
              })
              assert.equal(returned, promise)
              assert.equal(calls, 1)
            } finally { if (savedRun) define(AsyncLocalStorage.prototype, "run", savedRun) }
          }
          return true
        })
        assert.equal(observer.returnedSfE16Validation(validation, result), result)
      }
      const bind = observer.prepareSfE16Binding(route, "persist-bind", context)
      assert.ok(bind)
      const pending = observer.runSfE16Binding(bind, () => {
        const method = observer.enterSfE16BindingMethod("bind", owner, context)
        assert.ok(method)
        return observer.runSfE16BindingMethod(method, async () => {
          await validate(method, "bind-prewrite")
          return observer.runSfE16BindingRead(method, () => {
            const read = observer.enterSfE16BindingMethod("read", owner, context)
            assert.ok(read)
            return observer.runSfE16BindingMethod(read, async () => {
              await validate(read, "read-initial")
              await validate(read, "read-final")
              return product
            })
          })
        })
      })
      assert.ok(pending instanceof Promise)
      assert.equal(observer.returnedSfE16Binding(bind, await pending), product)
      const read = observer.prepareSfE16Binding(route, "persist-read", context)
      assert.ok(read)
      const value = await observer.runSfE16Binding(read, () => {
        const method = observer.enterSfE16BindingMethod("read", owner, context)
        assert.ok(method)
        return observer.runSfE16BindingMethod(method, async () => {
          await validate(method, "read-initial")
          await validate(method, "read-final")
          return product
        })
      })
      assert.equal(observer.returnedSfE16Binding(read, value), product)
      assert.equal(validationNumber, 5)
      assert.equal(actualVerifiers, missingVerifier ? 3 : 5)
      const values = rows().filter((row) => row.kind === "binding-validation")
      assert.deepEqual([...new Set(values.map((row) => row.validation))], [1, 2, 3, 4, 5])
      for (const id of [1, 2]) {
        const points = values.filter((row) => row.validation === id).map((row) => row.point)
        if (missingVerifier) assert.deepEqual(points, ["validate-enter", "validate-await-returned"])
        else assert.equal(points.length, 8)
      }
      checks.push(missingVerifier ? "fresh-false-and-absent-optional-verifier-have-no-fabricated-return" :
        "five-reserved-generations-have-eight-real-control-await-points",
        "refused-second-generation-cannot-close-first", "thirteen-scopes-independent-of-retired-lookups")
    }

    async function bindingConsumer() {
      const [{ openLocalStore }, { createSfProductState, initializeAbsentSfProductState }, { createCriterionComparisonBindings },
        { createCriterionRuleRegistry }, { createSfDecisionResultStore }, { createPortfolioProofVerifier },
        { digestSfValue }, { sfRunSourceFence }] = await Promise.all([
        import("../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/portfolio/verification.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"),
      ])
      type Context = import("../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts").TrustedDomainContext
      type UiContext = import("../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts").TrustedUiContext
      type State = import("../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts").SfProductState
      type Snapshot = import("../../../../modules/sucafina/Sucafinav1/runtime/contract.ts").Snapshot
      type Comparison = import("../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts").ScenarioComparison
      type PortResult<T> = import("../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts").PortResult<T>
      type Binding = import("../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-comparison.ts").CriterionComparisonBinding
      const at = "2027-02-02T00:00:00Z", caseRef = { id: "selected", incarnation: "selected-inc", version: 1 }
      const actor = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
      const context = Object.freeze({ kind: "ui", binding: Object.freeze({
        installationId: "e16-controlled-installation", projectId: "project", principalRef: "person",
        requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2028-01-01T00:00:00Z",
      }), lease: {} }) as UiContext
      const otherContext = Object.freeze({ ...context, binding: Object.freeze({ ...context.binding }), lease: {} }) as UiContext
      const incoming = new Request("https://e16-binding.example.invalid")
      const store = await openLocalStore(path.join(privateDirectory, "binding"))
      let unusedCalls = 0, validations = 0, evaluations = 0
      const unused = (): never => { unusedCalls++; throw new Error("This dependency is outside the controlled comparison") }
      let preparationProbe: (() => void) | undefined, activeBinding: Binding | undefined
      let releaseRead!: () => void, enteredRead!: () => void
      const waitingRead = new Promise<void>((resolve) => { releaseRead = resolve })
      const readEntered = new Promise<void>((resolve) => { enteredRead = resolve })
      let lateWork: Promise<PortResult<true>> | undefined, lateArmed = false
      let proof: ReturnType<typeof createPortfolioProofVerifier> | undefined, probeSnapshot: Snapshot | undefined
      const beforePublication: boolean[] = [], afterPublication: boolean[] = []
      const attacks: { selected: unknown; verifier: unknown; method: unknown; returned: unknown }[] = []
      const fences = { dashboard: "controlled-dashboard", planner: "", procurement: "controlled-procurement" }
      const requestValue = { scenarioRefs: ["baseline-result", "alternative-result"], criteria: ["cost"] }
      const comparison: Comparison = { baselineResultRef: "baseline-result", alternativeResultRef: "alternative-result",
        costCoverageRefs: [], criterionResults: [{ criterionId: "cost", state: "unknown", reason: "criterion-rule-unavailable" }],
        unresolvedConditions: ["criterion-rule-unavailable"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null }
      const valueOf = <T>(value: { status: "ok"; value: T } | { status: string; reason?: string }): T => {
        assert.equal(value.status, "ok")
        if (!("value" in value)) throw new Error("Original consumer refused the controlled data")
        return value.value
      }
      const published = (binding: Binding, call: Context) => {
        assert.ok(proof && probeSnapshot)
        return proof.verifySnapshot(probeSnapshot, binding, call)
      }
      let pending: Promise<unknown> | undefined
      try {
        await initializeAbsentSfProductState(store, () => "e16-comparison-state")
        await store.transaction("dashboard", async (snapshot) => {
          const state = snapshot.data.__sfProductV1 as State
          state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Controlled E16 comparison",
            horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: ["person"],
            criteria: [{ id: "cost", description: "Controlled criterion", required: true }],
            sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [],
            choices: [], preparedChanges: [], receipts: [], ledger: [] }
          return { commit: true, value: undefined }
        })
        await store.transaction("planner", async (snapshot) => {
          probeSnapshot = structuredClone(snapshot)
          fences.planner = sfRunSourceFence(snapshot)
          return { commit: false, value: undefined }
        })
        const writes = new WeakSet<object>()
        const state = createSfProductState({ persistence: store, createId: () => "e16-controlled-id",
          proposalCoverageWrites: writes, authorize: async () => ({ ...actor }),
          resolveTarget: async (_request, snapshot, _namespace, id) => {
            const current = (snapshot.data.__sfProductV1 as State).cases[id]
            return current ? { incarnation: current.incarnation } : undefined
          },
        })
        const host = { requestFor: () => incoming, revalidate: async () => {
          const callback = preparationProbe
          preparationProbe = undefined
          callback?.()
          return true
        } }
        const authorizeCase = async (value: { id: string; incarnation: string; version: number; participants: readonly string[] }, call: Context) =>
          value.id === caseRef.id && value.incarnation === caseRef.incarnation &&
          value.version === caseRef.version && value.participants.includes(call.binding.principalRef)
        const originalRules = createCriterionRuleRegistry({ state, host, authorizeCase,
          authorizeRule: unused, verifyEvidence: unused, verifySnapshot: unused, readMetric: unused, verifyMetric: unused,
          operationIdentity: unused, proposalCoverageWrites: writes, now: () => at,
        })
        const rules: typeof originalRules = { ...originalRules,
          evaluate: (...args) => { evaluations++; return originalRules.evaluate(...args) },
        }
        const results = createSfDecisionResultStore({ state, host, authorizeCase,
          verifySources: async (value, refs) => value.kind === "comparison" && refs.length === 0,
          createId: () => "e16-comparison", now: () => at,
        })
        const stored = valueOf(await results.write({ kind: "comparison", result: comparison, caseRef,
          requestDigest: digestSfValue(requestValue), sourceRefs: [], idempotencyKey: "e16-comparison-result" }, context))
        proof = createPortfolioProofVerifier({
          cases: { draft: unused, prepareIntent: unused, read: unused },
          planner: { compareForecast: unused, simulateScenario: unused, evaluateSensitivity: unused,
            compareScenarios: async () => ({ status: "ok", value: structuredClone(comparison) }) },
          sources: { resolveForecastSource: unused, resolveForecastCoverage: unused },
          get evidence(): never { return unused() },
          results, revalidate: async () => true, readSourceFences: async () => ({ ...fences }),
          lockedSourceFences: () => ({ ...fences }), caseFor: unused, idempotencyKey: unused,
          get decisions(): never { return unused() },
          createReceipt: unused, candidateCoverageRefFor: unused, revalidateAnalysis: unused,
          units: { issue: unused, resolve: unused, revalidate: unused }, sensitivityPreview: unused,
          observeComparison: async (_request, call, work) => {
            const accepted = await work()
            assert.ok(activeBinding)
            beforePublication.push(published(activeBinding, call))
            return accepted
          },
        })
        let selected: ReturnType<typeof createCriterionComparisonBindings>, foreignFactory: ReturnType<typeof createCriterionComparisonBindings>
        const build = () => createCriterionComparisonBindings({ state, host, rules, results, authorizeCase,
          verifyBinding: async (binding, result, call) => {
            const ordinal = ++validations
            activeBinding = binding
            if (ordinal === 1) {
              const ancestor = observer.currentSfE16Validation(binding, call)
              assert.ok(ancestor)
              // These real read methods are rejected diagnostically before their
              // real preparatory host callback. Same binding/context cannot steal
              // the verifier entry reserved for this ancestor.
              for (const [consumer, reentrantContext] of [[selected, call], [foreignFactory, call], [selected, otherContext]] as const) {
                preparationProbe = () => {
                  attacks.push({ selected: observer.currentSfE16Validation(binding, call),
                    verifier: observer.prepareSfE16Verifier(binding, call),
                    method: observer.enterSfE16BindingMethod("read", () => product, call),
                    returned: observer.returnedSfE16Validation(ancestor, product) })
                }
                const refused = await consumer.read({ caseRef, resultRef: stored.resultRef }, reentrantContext)
                assert.equal(refused.status, "unavailable")
              }
              assert.equal(observer.currentSfE16Validation(binding, call), ancestor)
              const noMethod = observer.enterSfE16BindingMethod("read", () => product, call)
              assert.equal(noMethod, undefined)
              const samePromise = Promise.resolve(product), receiver = {}, argument = {}
              let calls = 0
              const original = function (this: unknown, value: unknown) {
                assert.equal(this, receiver); assert.equal(value, argument); calls++; return samePromise
              }
              assert.equal(observer.runSfE16BindingMethod(noMethod, () => apply(original, receiver, [argument])), samePromise)
              assert.equal(calls, 1)
              for (const thrown of [outputError, undefined]) {
                let caught: unknown = sentinel, didThrow = false
                try { observer.runSfE16BindingMethod(noMethod, () => { calls++; throw thrown }) }
                catch (error) { didThrow = true; caught = error }
                assert.equal(didThrow, true); assert.equal(caught, thrown)
              }
              assert.equal(calls, 3)
              assert.equal(observer.currentSfE16Validation(binding, call), ancestor)
            }
            // Same short-circuit/optional-method expression as the authority
            // seam; its dependencies and context are intentionally synthetic.
            const verifier = observer.prepareSfE16Verifier(binding, call)
            const accepted = await Promise.resolve(true) && observer.returnedSfE16Verifier(verifier,
              await observer.runSfE16Verifier(verifier, () => proof?.verifyComparison(binding, result, call) ?? Promise.resolve(false)))
            afterPublication.push(published(binding, call))
            if (ordinal === 2) { enteredRead(); await waitingRead }
            return accepted
          },
          verifySnapshot: () => true, operationIdentity: () => "e16-controlled-bind", proposalCoverageWrites: writes, now: () => at,
          observeCriteria: async (_request, _call, work) => {
            const accepted = await work()
            if (!lateArmed) {
              lateArmed = true
              writeAction = () => { lateWork = work() }
            }
            return accepted
          },
        })
        selected = build()
        foreignFactory = build()
        const expectedRules = [{ criterionId: "cost", ruleRef: null, version: null, digest: null }]
        pending = observer.runSfE16Observation(handle, request, async () => {
          const unit = observer.enterSfE16Unit("analysis")
          assert.ok(unit)
          observer.returnedSfE16Await(unit, await observer.runSfE16Phase(unit, "analysis-persist", async () => {
            const route = observer.enterSfE16Route("persistence")
            assert.ok(route)
            try {
              return await observer.runSfE16Route(route, "persist-body", async () => {
                const bind = observer.prepareSfE16Binding(route, "persist-bind", context)
                assert.ok(bind)
                observer.markSfE16Route(route, "binding-enter")
                const bound = observer.returnedSfE16Binding(bind, await observer.runSfE16Binding(bind,
                  () => selected.bind({ caseRef, resultRef: stored.resultRef, request: requestValue, expectedRules }, context)))
                assert.equal(bound.status, "ok")
                observer.markSfE16Route(route, "binding-returned")
                const read = observer.prepareSfE16Binding(route, "persist-read", context)
                assert.ok(read)
                const checked = observer.returnedSfE16Binding(read, await observer.runSfE16Binding(read,
                  () => selected.read({ caseRef, resultRef: stored.resultRef }, context)))
                assert.equal(checked.status, "ok")
                observer.returnedSfE16Route(route, "binding-read-returned", checked)
                return checked
              })
            } finally { observer.finishSfE16Route(route, false) }
          }))
          // The two analysis reads execute their real consumer bodies but are
          // outside the first persistence's five validation generations.
          for (const point of ["initial", "final"] as const) {
            const read = observer.enterSfE16AnalysisBinding(unit, point)
            assert.ok(read)
            const checked = observer.returnedSfE16AnalysisBinding(read,
              await selected.read({ caseRef, resultRef: stored.resultRef }, context))
            assert.equal(checked.status, "ok")
          }
          observer.finishSfE16Unit(unit, false)
        })
        await Promise.race([readEntered, pending.then(() => { throw new Error("Internal read did not reach its controlled wait") })])
        const prefixValues = rows().filter((row) => row.kind === "binding-validation")
        assert.deepEqual(prefixValues.filter((row) => row.validation === 1).map((row) => row.point),
          ["validate-enter", "verify-comparison-enter", "verify-await-returned", "observer-enter", "work-enter",
            "criteria-await-returned", "observer-await-returned", "validate-await-returned"])
        assert.deepEqual(prefixValues.filter((row) => row.validation === 2).map((row) => row.point),
          ["validate-enter", "verify-comparison-enter", "verify-await-returned"])
        assert.equal(routeRows("persistence").some((row) => row.point === "binding-returned" || row.point === "persist-close"), false)
        assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
        releaseRead()
        await pending
        pending = undefined
        const values = rows().filter((row) => row.kind === "binding-validation")
        assert.equal(values.length, 40)
        for (const id of [1, 2, 3, 4, 5]) {
          const selected = values.filter((row) => row.validation === id)
          assert.equal(selected.length, 8)
          assert.equal(new Set(selected.map((row) => row.point)).size, 8)
          assert.ok(selected.every((row) => row.bindingPhase === (id <= 3 ? "persist-bind" : "persist-read")))
          assert.ok(selected.every((row) => row.validationSite === (id === 1 ? "bind-prewrite" : id === 2 || id === 4 ? "read-initial" : "read-final")))
        }
        assert.equal(validations, 9); assert.equal(evaluations, 9)
        assert.deepEqual(beforePublication, Array(9).fill(false))
        assert.deepEqual(afterPublication, Array(9).fill(true))
        assert.equal(attacks.length, 3)
        for (const attack of attacks) {
          assert.equal(attack.selected, undefined); assert.equal(attack.verifier, undefined)
          assert.equal(attack.method, undefined); assert.equal(attack.returned, product)
        }
        assert.ok(lateWork)
        assert.deepEqual(await lateWork, { status: "unavailable", reason: "comparison-criteria-observation-changed" })
        assert.equal(rows().filter((row) => row.kind === "analysis-binding").length, 4)
        assert.equal(unusedCalls, 0)
        const controlledNow = property(performance, "now")
        assert.ok(controlledNow)
        let clockCalls = 0
        const clockPromise = Promise.resolve(product)
        define(performance, "now", { configurable: true, value: () => { throw undefined } })
        try {
          const same = observer.runSfE16Observation(handle, request, () => observer.runSfE16BindingMethod(undefined, () => {
            clockCalls++; observer.markSfE16Http(handle, request, "body-returned"); return clockPromise
          }))
          assert.equal(same, clockPromise)
          assert.equal(await same, product)
          assert.equal(clockCalls, 1)
          assert.equal(rows().at(-1)?.elapsedTenthMs, null)
        } finally { define(performance, "now", controlledNow) }
        checks.push("clock-failure-keeps-original-Promise-once", "real-consumer-three-bind-two-read-generations",
          "real-verifier-return-follows-private-fence-publication",
          "same-binding-context-reentrant-preparation-cannot-steal-verifier",
          "foreign-factory-and-context-body-is-neutral",
          "internal-read-Promise-adoption-keeps-child-generation-live",
          "observer-open-latch-precedes-return-marker-hook",
          "analysis-two-reads-are-outside-five-validation-slots",
          "refused-method-once-Promise-receiver-Error-and-undefined",
          "controlled-host-and-planner-are-not-native-authority-proof")
      } finally {
        releaseRead()
        try { await pending } finally { await store.dispose() }
      }
    }

    async function nativeChain() {
      const [{ randomUUID }, { Location }, { AbsolutePath }, { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions },
        { createSfProductAuthority }, { createSfSourcePersistence }, { enumerateSfSources }, { createSfSourceScopeProjector },
        { selectSfScenarioCandidates }, { digestSfValue }, { roleMap }, { openLocalStore }] = await Promise.all([
        import("node:crypto"), import("@orchestra/core/location"), import("@orchestra/core/schema"),
        import("../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"),
        import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"),
        import("../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"),
        import("../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"),
      ])
      type StateInput = Parameters<typeof import("../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts").createSfProductState>[0]
      type TrustedDomainContext = import("../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts").TrustedDomainContext
      type Surface = import("../../../../modules/sucafina/Sucafinav1/src/identity.ts").Surface
      type Persistence = import("../../../../modules/sucafina/Sucafinav1/runtime/contract.ts").Persistence
      type SfStateResult<T> = import("../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts").SfStateResult<T>
      const at = "2027-02-02T00:00:00Z", origin = "https://example.invalid", period = { start: "2027-01-01", end: "2027-12-31" }
      const caseRef = { id: "c14-case", incarnation: "c14-incarnation", version: 1 }
      const preference = { selected: ["alpha", "beta"], nested: { version: 1, enabled: true }, nullable: null }
      const domain = { records: [{ id: "domain-a", amounts: [120, 110] }, { id: "domain-b", amounts: [80, 75] }] }
      function stateValue<T>(result: SfStateResult<T>): T {
        if (result.status !== "ok") throw new Error("Original C08 refused: " + result.status)
        return result.value
      }
      function stateInput(value: unknown, persistence: Persistence, createId: () => string): value is StateInput {
        if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false
        return Object.getOwnPropertyDescriptor(value, "persistence")?.value === persistence &&
          Object.getOwnPropertyDescriptor(value, "createId")?.value === createId &&
          typeof Object.getOwnPropertyDescriptor(value, "authorize")?.value === "function" &&
          typeof Object.getOwnPropertyDescriptor(value, "resolveTarget")?.value === "function"
      }
      async function createFixture(store: Awaited<ReturnType<typeof openLocalStore>>, directory: string, deadline: AbortSignal) {
        if (!store.readSnapshotRoot || !store.currentSnapshotScope || !store.transactionAll || !store.holdTargetPreimage || !store.observeAuthority)
          throw new Error("Original LocalStore snapshot capabilities required")
        let authority: ReturnType<typeof createSfProductAuthority> | undefined
        const identity = { installationId: "c14-installation", hostId: "c14-host", projectId: "c14-project",
          location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
        const choiceInput = {
          persistence: store,
          host: () => {
            if (!authority) throw new Error("Original authority is not composed")
            return authority.host
          },
          identity: () => identity,
          operationIdentity: (call: TrustedDomainContext) => call.kind === "ui" ? authority?.ui.operationIdentity(call) : undefined,
        }
        const choice = createCurrentChoiceFence(choiceInput)
        const project = createSfSourceScopeProjector(() => at)
        const sourceInput = { persistence: choice.persistence, createId: randomUUID, enumerate: enumerateSfSources,
          projectScope: project, installedDashboardProjector: project, observeAuthority: store.observeAuthority,
          holdTargetPreimage: store.holdTargetPreimage, hasSnapshotRoot: store.hasSnapshotRoot }
        const sources = createSfSourcePersistence(sourceInput)
        const persistence = { ...store, ...choice.persistence, ...sources,
          ...(sources.transactionAll ? { dashboardSourceFence: Object.freeze({
            transaction: sources.transaction, transactionAll: sources.transactionAll,
            currentSnapshots: sources.currentSnapshots, currentSnapshot: sources.currentSnapshot,
            observeAuthority: sources.observeAuthority, readSealed: sources.readSealed,
            hasSnapshotRoot: sources.hasSnapshotRoot, readDashboardAuthority: sources.readDashboardAuthority,
            holdTargetPreimage: store.holdTargetPreimage,
            current: () => currentChoiceOwnsSnapshotTransactions(choice, choiceInput.persistence),
          }) } : {}),
        }
        for (const surface of ["dashboard", "planner", "procurement"] as const) {
          deadline.throwIfAborted()
          await persistence.initializeSources(surface)
        }
        await persistence.transaction("dashboard", async (snapshot) => {
          snapshot.data.roleMap = roleMap(snapshot, "dashboard")
          snapshot.data.access = { person: { assigned: ["c14-assigned"], domains: ["c14-domain"] } }
          snapshot.data.c14DomainOnly = structuredClone(domain)
          snapshot.versions["c14-domain"] = { version: 2, by: "person" }
          snapshot.sequences.c14 = 3
          snapshot.audit.push({ who: "person", at, record: "c14-prefix", was: null, became: "present" })
          return { commit: true, value: undefined }
        }, { signal: deadline })
        const requests = new WeakSet<Request>()
        const request = (extra?: AbortSignal) => {
          const signal = extra ? AbortSignal.any([deadline, extra]) : deadline
          const incoming = new Request(origin + "/cases", { method: "POST", headers: { origin }, signal })
          requests.add(incoming)
          return incoming
        }
        const authentication: { surface: Surface; roles: unknown }[] = []
        const control: { active: boolean; afterDashboard?: () => void | Promise<void> } = { active: true }
        const receivers: StateInput[] = []
        function createId(this: unknown): string {
          if (stateInput(this, persistence, createId)) {
            receivers.push(this)
            // Public createId has always received the mutable C08 factory input.
            // Freezing that receiver would fail here before any positive assertion.
            Object.defineProperty(this, "c14ReceiverProbe", { value: "receiver preserved", configurable: true })
          }
          return randomUUID()
        }
        const composed = createSfProductAuthority({
          identity: () => identity, installationId: identity.installationId, origin, policyVersion: "c14-policy",
          persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences"],
            operations: ["sf_case_read"], humanActions: [] }],
          authenticate: async (incoming, scope) => {
            if (scope) authentication.push({ surface: scope.surface, roles: structuredClone(scope.roleMap) })
            if (scope?.surface === "dashboard") {
              const hook = control.afterDashboard
              control.afterDashboard = undefined
              await hook?.()
            }
            return requests.has(incoming) && control.active && scope ? { id: "person", canWrite: true,
              roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null
          },
          environment: async () => ({ at, id: randomUUID, directory: [] }), createId, now: Date.now,
          commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
          verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
        })
        authority = composed
        stateValue(await composed.state.transaction(request(), {
          namespace: "cases", expectedStorageVersion: 0,
          additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: 0 }],
          targetRef: composed.creationTarget.ref, targetIncarnation: composed.creationTarget.incarnation,
          idempotencyKey: "c14-initialize", commandDigest: digestSfValue({ caseRef, preference }),
        }, async (state) => {
          state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "C08 complete product graph",
            horizon: period, currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [],
            costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
          state.preferences.c14 = structuredClone(preference)
          return { commit: true, value: true }
        }))
        return { store, choice, persistence, authority: composed, register: (incoming: Request) => requests.add(incoming) }
      }
      const nativeDirectory = path.join(privateDirectory, "native"), store = await openLocalStore(nativeDirectory)
      const deadline = new AbortController()
      let releaseWriter: (() => void) | undefined, blocker: Promise<unknown> | undefined, pendingWrite: Promise<unknown> | undefined
      try {
        const fixture = await createFixture(store, privateDirectory, deadline.signal)
        fixture.register(request)
        const digest = digestSfValue({}), admitted = await fixture.authority.ui.admit(request, "sf_case_read", digest)
        assert.equal(admitted.status, "ok")
        if (admitted.status !== "ok") throw new Error("Controlled native UI admission refused")
        const call = admitted.value
        try {
          assert.equal(await fixture.authority.ui.validate(call, "sf_case_read", digest), true)
          let storageVersion = -1
          async function nativeRead() {
            const route = observer.enterSfE16Route("lookup")
            assert.equal(route, undefined)
            let failed = false
            try {
              const value = await observer.runSfE16Route(route, "candidate-read", () => fixture.authority.state.read(request, "cases",
                selectSfScenarioCandidates({ caseRef }, digest, digest, call)))
              assert.equal(value.status, "ok")
              if (value.status !== "ok") throw new Error("Controlled native C08 read refused")
              storageVersion = value.storageVersion
              assert.deepEqual(value.value, [])
              assert.equal(observer.returnedSfE16Route(route, "candidate-read-returned", value), value)
            } catch (error) { failed = true; throw error }
            finally { observer.finishSfE16Route(route, failed) }
          }
          await observer.runSfE16Observation(handle, request, async () => {
            const analysis = observer.enterSfE16Unit("analysis")
            assert.ok(analysis)
            observer.returnedSfE16Await(analysis, await observer.runSfE16Phase(analysis, "analysis-select-initial", async () => {
              const canonical = observer.enterSfE16Route("canonical")
              assert.ok(canonical)
              await observer.runSfE16Route(canonical, "preparation", async () => { await nativeRead(); await nativeRead() })
              await observer.runSfE16Route(canonical, "comparator", async () => {
                await fixture.persistence.readSnapshotRoot!(async () => {
                  await nativeRead()
                  await fixture.choice.run(call, nativeRead)
                  await nativeRead()
                }, { signal: deadline.signal })
                const held = fixture.store.holdTargetPreimage!()
                try {
                  await fixture.store.transaction("dashboard", async () => ({ commit: false, value: await nativeRead() }),
                    { signal: deadline.signal, targetPreimageCurrent: held.current, sealedRead: true })
                } finally { held.release() }
              })
              observer.finishSfE16Route(canonical, false)
              return product
            }))
            assert.equal(routeRows("lookup").length, 0)
            checks.push("real-native-read-bodies-complete-without-lookup-detail", "real-native-wrapped-and-preimage-calls-preserved")

            let enteredWriter!: () => void
            const entered = new Promise<void>((resolve) => { enteredWriter = resolve })
            const waiting = new Promise<void>((resolve) => { releaseWriter = resolve })
            blocker = fixture.store.transaction("dashboard", async () => {
              enteredWriter(); await waiting; return { commit: false, value: undefined }
            })
            await entered
            const persisted = observer.runSfE16Phase(analysis, "analysis-persist", async () => {
              const route = observer.enterSfE16Route("persistence")
              assert.ok(route)
              let failed = false
              try {
                return await observer.runSfE16Route(route, "persist-body", async () => {
                  const value = await observer.runSfE16Route(route, "store-write", async () => {
                    const result = await observer.runSfE16Route(route, "state-transaction", () => fixture.authority.state.transaction(request, {
                      namespace: "cases", expectedStorageVersion: storageVersion,
                      targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
                      idempotencyKey: "e16-tail-write", commandDigest: digestSfValue({ value: "written" }),
                    }, async (state) => {
                      const found = state.cases[caseRef.id]
                      assert.ok(found); found.objective = "E16 controlled native write"
                      return { commit: true, value: "written" }
                    }))
                    return observer.returnedSfE16Route(route, "state-transaction-returned", result)
                  })
                  assert.equal(stateValue(value), "written")
                  observer.returnedSfE16Route(route, "store-write-returned", value)
                  const names = routeRows("persistence").map((row) => row.point)
                  assert.ok(names.includes("commit-returned"))
                  assert.equal(names.includes("persist-close"), false)
                  // These post-write calls are controlled boundaries, not real binding storage.
                  observer.markSfE16Route(route, "binding-enter")
                  observer.markSfE16Route(route, "binding-returned")
                  observer.markSfE16Route(route, "validation-enter")
                  observer.markSfE16Route(route, "validation-returned")
                  return observer.returnedSfE16Route(route, "binding-read-returned", value)
                })
              } catch (error) { failed = true; throw error }
              finally { observer.finishSfE16Route(route, failed) }
            })
            pendingWrite = persisted
            const pending = routeRows("persistence").map((row) => row.point)
            assert.ok(pending.includes("queue-enter"))
            for (const absent of ["queue-returned", "begin-enter", "materialize-enter", "source-work-enter", "commit-returned", "persist-close"])
              assert.equal(pending.includes(absent), false)
            assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
            releaseWriter!(); releaseWriter = undefined
            await blocker; blocker = undefined
            observer.returnedSfE16Await(analysis, await persisted)
            pendingWrite = undefined
            const names = routeRows("persistence").map((row) => row.point)
            const ordered = ["queue-enter", "queue-returned", "begin-enter", "begin-returned", "materialize-enter", "materialize-returned",
              "source-work-enter", "source-work-returned", "source-finish-enter", "source-finish-returned", "source-dispose-enter",
              "source-dispose-returned", "local-scope-closed", "encode-enter", "encode-returned", "decode-returned", "sql-returned",
              "commit-enter", "commit-returned", "local-returning", "operation-returned", "state-transaction-returned", "store-write-returned",
              "binding-enter", "binding-returned", "validation-enter", "validation-returned", "binding-read-returned", "persist-close"]
            for (let index = 0; index < ordered.length; index++) {
              const at = names.indexOf(ordered[index]!)
              assert.ok(at >= 0)
              if (index) assert.ok(at > names.indexOf(ordered[index - 1]!))
            }
            checks.push("real-native-queue-prefix-before-release", "real-native-write-and-post-write-boundaries-distinct")
            observer.finishSfE16Unit(analysis, false)
          })
        } finally { fixture.authority.ui.finish(call) }
      } finally {
        releaseWriter?.()
        try { await blocker; await pendingWrite } finally { deadline.abort(); await store.dispose() }
      }
    }

    if (mode === "route-owner") {
      let release!: () => void, entered!: () => void
      const waiting = new Promise<void>((resolve) => { release = resolve })
      const started = new Promise<void>((resolve) => { entered = resolve })
      let finance: unknown, canonical: unknown, firstUnit: unknown, firstValue: unknown, calls = 0
      const pending = observer.runSfE16Observation(handle, request, async () => {
        firstUnit = observer.enterSfE16Unit("analysis")
        assert.ok(firstUnit)
        const value = observer.runSfE16Phase(firstUnit, "analysis-select-initial", async () => {
          canonical = observer.enterSfE16Route("canonical")
          assert.ok(canonical)
          const preparation = observer.runSfE16Route(canonical, "preparation", async () => {
            calls++
            const body = observer.enterSfE16Compare()
            assert.ok(body)
            assert.equal(observer.runSfE16Compare(body, () => waiting), waiting)
            observer.finishSfE16Compare(body, false)
            assert.deepEqual(one("compare-body-checkpoint").compareBodies, [1, 1, 0, 0, 0, 0])
            assert.equal(rows().some((row) => row.kind === "phase-close"), false)
            lookup(); lookup()
            const beforeNeutral = lines.length, waitingValue = Promise.resolve(product)
            assert.equal(observer.runSfE16Route(undefined, "candidate-read", () => waitingValue), waitingValue)
            const opaque = Object.defineProperty({}, "then", { get() { throw outputError } })
            assert.equal(observer.runSfE16Route(undefined, "candidate-read", () => opaque), opaque)
            lookup(false, [true, true, true, true, true], true)
            assert.equal(lines.length, beforeNeutral)
            finance = observer.markSfE16Finance("entered")
            assert.ok(finance)
            entered()
            await waiting
            observer.markSfE16Finance("owned-direct", finance)
            return product
          })
          assert.ok(preparation instanceof Promise)
          assert.equal(await preparation, product)
          const thenable = Object.defineProperty({}, "then", { get() { throw new Error("Observer must not assimilate thenable") } })
          const same = observer.runSfE16Route(canonical, "comparator", () => {
            calls++
            for (let index = 0; index < 4; index++) lookup()
            observer.markSfE16Finance("observation-returned", finance)
            observer.markSfE16Finance("returned", finance)
            return thenable
          })
          assert.equal(same, thenable)
          observer.finishSfE16Route(canonical, false)
          return product
        })
        firstValue = await value
        observer.returnedSfE16Await(firstUnit, firstValue)
        observer.finishSfE16Unit(firstUnit, false)
        return product
      })
      await started
      assert.equal(point("finance-enter", "canonical").route, 1)
      assert.equal(routeRows("canonical").some((row) => row.point === "finance-branch"), false)
      const firstCount = lines.length
      observer.runSfE16Observation(handle, request, () => {
        const second = observer.enterSfE16Unit("analysis")
        assert.ok(second)
        const result = observer.runSfE16Phase(second, "analysis-select-initial", () => {
          const secondCanonical = observer.enterSfE16Route("canonical")
          assert.equal(secondCanonical, undefined)
          return observer.runSfE16Route(secondCanonical, "preparation", () => {
            assert.equal(observer.currentSfE16Route(), undefined)
            assert.equal(observer.enterSfE16Route("lookup"), undefined)
            assert.equal(observer.markSfE16Finance("entered"), undefined)
            observer.markSfE16Finance("outside-root", finance)
            return product
          })
        })
        observer.returnedSfE16Await(second, result)
        observer.finishSfE16Unit(second, false)
      })
      assert.ok(lines.length > firstCount)
      assert.equal(routeRows("lookup").length, 0)
      assert.equal(routeRows("canonical").some((row) => row.point === "finance-branch"), false)
      assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
      release()
      assert.equal(await pending, product)
      assert.equal(firstValue, product); assert.equal(calls, 2)
      assert.equal(routeRows("lookup").length, 0)
      assert.equal(point("finance-branch", "canonical").detail, "owned-direct")
      assert.ok(point("finance-work-enter", "canonical"))
      assert.ok(point("finance-observation-returned", "canonical"))
      assert.ok(point("finance-body-exit", "canonical"))
      const beforeLate = lines.length
      assert.equal(observer.runSfE16Observation(handle, request, () => observer.runSfE16Route(canonical, "comparator", () => {
        assert.equal(observer.currentSfE16Route(), undefined)
        assert.equal(observer.enterSfE16Route("lookup"), undefined)
        return product
      })), product)
      assert.equal(lines.length, beforeLate)
      checks.push("first-canonical-private-owner-across-suspension", "second-canonical-and-Finance-cannot-steal",
        "retired-lookups-preserve-values-Promises-thenables-and-undefined", "undefined-and-closed-route-mask-ambient",
        "real-LF-prefix-before-completion", "exact-Promise-and-thenable-no-assimilation", "body-return-is-not-Promise-settlement-or-phase-close")
    } else if (mode === "work-links") {
      await bindingConsumer()
    } else if (mode === "native-chain") {
      await nativeChain()
    } else if (mode === "persistence-tail") {
      let release!: () => void, entered!: () => void
      const waiting = new Promise<void>((resolve) => { release = resolve })
      const started = new Promise<void>((resolve) => { entered = resolve })
      let firstUnit: unknown
      const pending = observer.runSfE16Observation(handle, request, async () => {
        firstUnit = observer.enterSfE16Unit("analysis")
        assert.ok(firstUnit)
        const result = await observer.runSfE16Phase(firstUnit, "analysis-persist", () => persistence(true, { entered, waiting }))
        observer.returnedSfE16Await(firstUnit, result)
        observer.finishSfE16Unit(firstUnit, false)
        return product
      })
      await started
      const prefixPoints = routeRows("persistence").map((row) => row.point)
      assert.ok(prefixPoints.includes("prewrite") && prefixPoints.includes("state-transaction-enter") && prefixPoints.includes("queue-enter"))
      assert.equal(prefixPoints.includes("queue-returned") || prefixPoints.includes("begin-enter") || prefixPoints.includes("commit-returned"), false)
      assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
      observer.runSfE16Observation(handle, request, () => {
        assert.equal(observer.enterSfE16Route("persistence"), undefined)
        const second = observer.enterSfE16Unit("analysis")
        observer.returnedSfE16Await(second, observer.runSfE16Phase(second, "analysis-persist", () => {
          assert.equal(observer.enterSfE16Route("persistence"), undefined)
          return product
        }))
        observer.finishSfE16Unit(second, false)
      })
      release()
      assert.equal(await pending, product)
      const values = routeRows("persistence"), names = values.map((row) => row.point)
      assert.equal(values.find((row) => row.point === "local-enter")?.detail, "top-level")
      assert.ok(names.indexOf("state-transaction-enter") < names.indexOf("queue-enter"))
      assert.ok(names.indexOf("commit-returned") < names.indexOf("state-transaction-returned"))
      assert.ok(names.indexOf("store-write-returned") < names.indexOf("binding-enter"))
      assert.ok(names.indexOf("validation-returned") < names.indexOf("binding-read-returned"))
      assert.equal(names.includes("persist-close"), false)
      assert.equal(rows().at(-1)?.kind, "request-close")
      assert.ok(Number(one("request-close").openUnits) >= 1)
      const closedCount = lines.length
      assert.equal(observer.runSfE16Observation(handle, request, () => product), product)
      observer.finishSfE16Observation(handle, request, true)
      assert.equal(lines.length, closedCount)
      checks.push("first-persistence-requires-first-analysis-phase", "operation-true-is-not-transaction-identity",
        "queue-prefix-does-not-fabricate-BEGIN-or-commit", "post-write-binding-remains-distinct",
        "reentrant-terminal-freezes-open-prefix-without-late-close")
    } else if (mode === "capacity") {
      let actualWork = 0
      await observer.runSfE16Observation(handle, request, async () => {
        const filler = observer.enterSfE16Unit("combination")
        for (let index = 0; index < 600; index++)
          observer.returnedSfE16Await(filler, observer.runSfE16Phase(filler, "combination-evaluate", () => { actualWork++; return product }))
        observer.finishSfE16Unit(filler, false)
        const analysis = observer.enterSfE16Unit("analysis")
        observer.returnedSfE16Await(analysis, observer.runSfE16Phase(analysis, "analysis-select-initial", () => {
          for (let index = 0; index < 128; index++) {
            const compare = observer.enterSfE16Compare()
            assert.ok(compare)
            assert.equal(observer.runSfE16Compare(compare, () => product), product)
            observer.finishSfE16Compare(compare, false)
          }
          const canonical = observer.enterSfE16Route("canonical")
          let finance: unknown
          observer.runSfE16Route(canonical, "preparation", () => {
            for (let index = 0; index < 600; index++) lookup()
            finance = observer.markSfE16Finance("entered")
            observer.markSfE16Finance("owned-records", finance)
            observer.markSfE16Finance("outside-root", finance)
          })
          observer.runSfE16Route(canonical, "comparator", () => {
            for (let index = 0; index < 4; index++) lookup()
            observer.markSfE16Finance("observation-returned", finance)
            observer.markSfE16Finance("returned", finance)
          })
          observer.finishSfE16Route(canonical, false)
          return product
        }))
        observer.returnedSfE16Await(analysis, observer.runSfE16Phase(analysis, "analysis-compare", () => product))
        observer.returnedSfE16Await(analysis, await observer.runSfE16Phase(analysis, "analysis-persist", () => persistence(false, undefined, true)))
        for (const point of ["initial", "final"] as const) {
          const bindingRead = observer.enterSfE16AnalysisBinding(analysis, point)
          assert.ok(bindingRead)
          assert.equal(observer.returnedSfE16AnalysisBinding(bindingRead, product), product)
          assert.equal(observer.returnedSfE16AnalysisBinding(bindingRead, product), product)
        }
        for (const phase of ["analysis-bind", "analysis-select-final", "analysis-revalidate"] as const)
          observer.returnedSfE16Await(analysis, observer.runSfE16Phase(analysis, phase, () => product))
        observer.finishSfE16Unit(analysis, false)
        const port = observer.enterSfE16Unit("port")
        for (const phase of ["port-authority-final", "evaluations-recheck", "candidates-final"] as const)
          observer.returnedSfE16Await(port, observer.runSfE16Phase(port, phase, () => product))
        observer.finishSfE16Unit(port, false)
        const revalidate = observer.enterSfE16Unit("production-revalidation")
        observer.returnedSfE16Await(revalidate, observer.runSfE16Phase(revalidate, "production-analysis-revalidate", () => product))
        observer.finishSfE16Unit(revalidate, false)
        for (let index = 4; index < 28; index++) {
          const unit = observer.enterSfE16Unit("combination")
          assert.ok(unit)
          observer.finishSfE16Unit(unit, false)
        }
      })
      assert.equal(actualWork, 600)
      observer.markSfE16Http(handle, request, "with-case-returned")
      observer.markSfE16Http(handle, request, "egress-passed")
      observer.finishSfE16Observation(handle, request, false)
      assert.equal(rows().length, 163)
      assert.equal(rows().filter((row) => row.kind === "overflow").length, 1)
      assert.equal(rows().filter((row) => row.kind === "unit-close").length, 28)
      assert.deepEqual(rows().filter((row) => row.kind === "compare-body-checkpoint").map((row) => row.bodyExits), [1, 8, 32, 128])
      const analysisRows = rows().filter((row) => row.kind === "phase-enter" && row.unit === 2)
      assert.deepEqual(analysisRows.filter((row) => Number(row.phase) <= 5).map((row) => row.phase), [1, 4, 5, 2, 3])
      assert.equal(routeRows("lookup").length, 0)
      assert.equal(rows().filter((row) => row.kind === "binding-validation").length, 40)
      assert.equal(rows().filter((row) => row.kind === "analysis-binding").length, 4)
      assert.equal(routeRows("canonical").length, 8)
      assert.equal(routeRows("persistence").length, 36)
      assert.deepEqual(one("request-close").routeCoverage, [1, 0, 0, 1, 0, 0])
      assert.equal(one("request-close").openUnits, 0)
      assert.equal(one("request-close").openPhases, 0)
      assert.deepEqual(one("request-close").compareBodies, [128, 128, 0, 0, 0, 0])
      assert.equal(one("request-close").saturated, false)
      checks.push("six-hundred-works-survive-general-detail-cap", "six-hundred-neutral-lookups-cannot-consume-thirteen-binding-scopes", "critical-sites-and-tail-survive-general-cap",
        "global-four-body-checkpoints-survive-cap", "exact-163-reserved-lines-with-forty-plus-four-late-slots", "terminal-reserved-at-full-cap")
    } else if (mode === "mechanism") {
      observer.runSfE16Observation(handle, request, () => {
        const canonical = observer.enterSfE16Route("canonical")
        observer.runSfE16Route(canonical, "preparation", () => {
          const finance = observer.markSfE16Finance("entered")
          observer.markSfE16Finance("owned-records", finance)
          observer.markSfE16Finance("observation-returned", finance)
          observer.markSfE16Finance("returned", finance)
        })
        observer.finishSfE16Route(canonical, false)
      })
      assert.ok(point("finance-observation-returned", "canonical"))
      assert.ok(point("finance-body-exit", "canonical"))
      assert.equal(routeRows("canonical").some((row) => row.point === "finance-work-enter" || row.point === "comparator-enter"), false)
      checks.push("Finance-observation-return-does-not-invent-work")
      await observer.runSfE16Observation(handle, request, async () => {
        const unit = observer.enterSfE16Unit("analysis")
        observer.returnedSfE16Await(unit, await observer.runSfE16Phase(unit, "analysis-persist", async () => {
          const route = observer.enterSfE16Route("persistence")
          assert.ok(route)
          await observer.runSfE16Route(route, "persist-body", () => syntheticBindingSequence(route, true))
          observer.finishSfE16Route(route, false)
        }))
        observer.finishSfE16Unit(unit, false)
      })
      function installRun(work: (this: unknown, token: unknown, callback: unknown) => unknown) {
        define(AsyncLocalStorage.prototype, "run", { ...savedRun, value: work })
      }
      let calls = 0, delayed: unknown
      const value = {}, mechanismValue = {}
      installRun(function (token, callback) {
        assert.ok(typeof callback === "function")
        delayed = callback
        apply(nativeRun, this, [token, callback]); apply(nativeRun, this, [token, callback])
        return mechanismValue
      })
      assert.equal(observer.runSfE16Observation(handle, request, () => { calls++; return value }), value)
      assert.ok(typeof delayed === "function")
      apply(delayed, undefined, [])
      assert.equal(calls, 1)
      for (const thrown of [outputError, undefined]) {
        let caught: unknown = value, didThrow = false
        installRun(function (token, callback) {
          try { apply(nativeRun, this, [token, callback]) } catch { /* Deliberately swallow the product throw. */ }
          return mechanismValue
        })
        try { observer.runSfE16Observation(handle, request, () => { calls++; throw thrown }) } catch (error) { didThrow = true; caught = error }
        assert.equal(didThrow, true); assert.equal(caught, thrown)
      }
      assert.equal(calls, 3)
      let entries = 0
      installRun(function () { throw outputError })
      assert.equal(observer.runSfE16Observation(handle, request, () => { calls++; if (observer.enterSfE16Compare()) entries++; return value }), value)
      assert.equal(calls, 4); assert.equal(entries, 0)
      installRun(function () { return mechanismValue })
      assert.equal(observer.runSfE16Observation(handle, request, () => { calls++; return undefined }), undefined)
      assert.equal(calls, 5)
      installRun(function (token, callback) { apply(nativeRun, this, [token, callback]); throw outputError })
      const promise = Promise.resolve(value)
      assert.equal(observer.runSfE16Observation(handle, request, () => { calls++; return promise }), promise)
      assert.equal(await promise, value); assert.equal(calls, 6)
      define(AsyncLocalStorage.prototype, "run", savedRun)
      const noStorePromise = Promise.resolve(value)
      let noStoreCalls = 0
      define(AsyncLocalStorage.prototype, "getStore", { ...savedGet, value: () => { throw undefined } })
      try {
        assert.equal(observer.runSfE16BindingMethod(undefined, () => { noStoreCalls++; return noStorePromise }), noStorePromise)
        assert.equal(noStoreCalls, 1)
      } finally { define(AsyncLocalStorage.prototype, "getStore", savedGet) }
      observer.finishSfE16Observation(handle, request, false)
      assert.deepEqual(one("request-close").faultsBefore, [0, 0, 1, 1, 0, 0])
      checks.push("duplicate-and-tardy-thunk-never-replay", "mechanism-result-and-swallowed-error-not-authoritative",
        "before-noinvoke-after-faults-preserve-work", "scope-fallback-disables-attribution",
        "refused-method-noop-ALS-and-getStore-throw-never-inherit-owner")
    } else if (mode.startsWith("sink-")) {
      const fault: Fault = mode === "sink-zero" ? "zero" : mode === "sink-partial" ? "partial" : "throw"
      const before = { ...attempts }, complete = lines.length
      faults.file = fault; faults.stdout = fault
      observer.markSfE16Http(handle, request, "body-returned")
      assert.equal(attempts.file, before.file + 1); assert.equal(attempts.stdout, before.stdout + 1)
      faults.file = "none"; faults.stdout = "none"
      let calls = 0, threw = false, caught: unknown = sentinel
      assert.equal(observer.runSfE16Observation(handle, request, () => observer.runSfE16BindingMethod(undefined, () => { calls++; return product })), product)
      try { observer.runSfE16Observation(handle, request, () => observer.runSfE16BindingMethod(undefined, () => { calls++; throw undefined })) } catch (error) { threw = true; caught = error }
      observer.markSfE16Http(handle, request, "admit-returned")
      observer.finishSfE16Observation(handle, request, true)
      assert.equal(calls, 2); assert.equal(threw, true); assert.equal(caught, undefined)
      assert.equal(attempts.file, before.file + 1); assert.equal(attempts.stdout, before.stdout + 1)
      assert.equal(lines.length, complete)
      assert.equal(rows().some((row) => row.kind === "request-close"), false)
      const raw = readFileSync(eventFile, "utf8")
      assert.ok(raw.startsWith(lines.join("")))
      if (fault === "partial") {
        assert.equal(fragments.length, 1); assert.ok(!raw.endsWith("\n"))
      } else { assert.equal(fragments.length, 0); assert.equal(raw, lines.join("")) }
      checks.push("sink-" + fault + "-latches-once", "restored-sink-is-not-retried", "product-undefined-throw-survives-sink-fault",
        "incomplete-prefix-has-no-fabricated-terminal")
    } else if (mode === "forwarder") {
      const wire = prefix + '{"kind":"controlled"}\n', disabled = launcherPrefix + '{"kind":"disabled"}\n'
      const same = (forward: (chunk: string) => string, chunk: string) => assert.equal(forward(chunk), chunk)
      let at = lines.length
      const forward = observer.createSfE16Forwarder()
      same(forward, "ordinary text\n" + wire.slice(0, 7))
      same(forward, wire.slice(7, 22))
      assert.equal(lines.length, at)
      same(forward, wire.slice(22) + wire + "ignored\n" + wire.slice(0, -1))
      assert.deepEqual(lines.slice(at), [wire, wire])
      same(forward, "\n")
      assert.deepEqual(lines.slice(at), [wire, wire, wire])
      const eof = observer.createSfE16Forwarder()
      at = lines.length
      same(eof, wire.slice(0, -1))
      assert.equal(lines.length, at)
      checks.push("forwarder-real-chunk-identity-and-multilines", "forwarder-only-real-LF-no-EOF-promotion")

      for (const bad of [prefix + "x".repeat(1_024), prefix + "\u00e9", prefix + "x".repeat(1_003) + "\u00e9"]) {
        const sink = observer.createSfE16Forwarder(), count = lines.length
        same(sink, bad.slice(0, prefix.length)); same(sink, bad.slice(prefix.length))
        assert.equal(lines.length, count)
        same(sink, "\n" + wire)
        assert.equal(lines.length, count)
      }
      const irrelevant = observer.createSfE16Forwarder()
      at = lines.length
      same(irrelevant, "outside " + "\u00e9".repeat(1_100) + "\n" + wire)
      assert.deepEqual(lines.slice(at), [wire])
      checks.push("forwarder-ASCII-byte-bound-before-LF", "forwarder-invalid-diagnostic-latches", "forwarder-unrelated-long-lines-ignored")

      for (const fault of ["zero", "partial", "throw"] as const) {
        const sink = observer.createSfE16Forwarder(), before = attempts.stdout
        faults.stdout = fault
        same(sink, wire)
        faults.stdout = "none"
        same(sink, wire)
        assert.equal(attempts.stdout, before + 1)
      }
      checks.push("forwarder-zero-partial-undefined-throw-no-retry")
      const capped = observer.createSfE16Forwarder()
      at = lines.length
      const full = prefix + "x".repeat(1_024 - prefix.length - 1) + "\n"
      assert.equal(Buffer.byteLength(full, "utf8"), 1_024)
      for (let index = 0; index < 192; index++) same(capped, full)
      assert.equal(lines.length - at, 191)
      assert.equal(lines.slice(at).reduce((sum, line) => sum + Buffer.byteLength(line, "utf8"), 0), 195_584)
      const disabledOnly = observer.createSfE16Forwarder()
      at = lines.length
      same(disabledOnly, disabled); same(disabledOnly, disabled); same(disabledOnly, wire)
      assert.deepEqual(lines.slice(at), [disabled])
      const exclusive = observer.createSfE16Forwarder()
      at = lines.length
      same(exclusive, wire); same(exclusive, disabled); same(exclusive, wire)
      assert.deepEqual(lines.slice(at), [wire])
      checks.push("forwarder-191-events-and-191KiB", "forwarder-one-disabled-and-exclusive-mode")
    } else throw new Error("Unknown E16 mode")

    if (mode !== "forwarder") {
      observer.finishSfE16Observation(handle, request, false)
      const all = rows(), raw = readFileSync(eventFile, "utf8"), faulted = mode.startsWith("sink-")
      assert.ok(all.length <= 191 && Buffer.byteLength(lines.join(""), "utf8") <= 195_584)
      assert.ok(Buffer.byteLength(raw, "utf8") <= 195_584)
      assert.equal(statSync(eventFile).mode & 0o777, 0o600)
      for (const row of all) {
        assert.equal(row.schema, "sf-preview-causal-e16-event-v1")
        assert.equal(row.source, source); assert.equal(row.sourceTree, sourceTree)
        assert.equal(row.snapshot, launcher.snapshot); assert.equal(row.runId, "1"); assert.equal(row.attempt, "1")
        assert.equal(row.nonce, launcher.nonce); assert.equal(row.pid, process.pid); assert.equal(row.parentPid, process.ppid)
        assert.equal(row.request, 1); assert.equal(row.qualification, false)
      }
      assert.deepEqual(all.map((row) => row.sequence), all.map((_row, index) => index + 1))
      if (!faulted) {
        assert.equal(raw, lines.join(""))
        assert.equal(all.at(-1)?.kind, "request-close")
        assert.equal(all.filter((row) => row.kind === "request-close").length, 1)
      }
      const count = lines.length
      observer.markSfE16Http(handle, request, "egress-passed")
      observer.finishSfE16Observation(handle, request, true)
      assert.equal(observer.startSfE16Observation(request), undefined)
      assert.equal(lines.length, count)
      const terminal = all.find((row) => row.kind === "request-close")
      finalReceipt = { schema: "sf-preview-e16-control-child-v1", mode, pid: process.pid, synthetic: true, checks,
        records: all.length, stdoutAttempts: attempts.stdout, stdoutBytes: Buffer.byteLength(lines.join(""), "utf8"),
        stdoutSha256: sha256(lines.join("")), fileAttempts: attempts.file, fileBytes: Buffer.byteLength(raw, "utf8"), fileSha256: sha256(raw),
        terminal: terminal ? { kind: terminal.kind, sequence: terminal.sequence, outcome: terminal.outcome, openUnits: terminal.openUnits,
          openPhases: terminal.openPhases, compareBodies: terminal.compareBodies, routeCoverage: terminal.routeCoverage,
          faultsBefore: terminal.faultsBefore, saturated: terminal.saturated } : null }
    } else {
      finalReceipt = { schema: "sf-preview-e16-control-child-v1", mode, pid: process.pid, synthetic: true, checks,
        framingOnly: true, stdoutAttempts: attempts.stdout, completeLines: lines.length, partialFragments: fragments.length,
        terminal: null }
    }
    assert.equal(requestGets, 0)
    finalReceipt.requestGets = requestGets
    assert.ok(Buffer.byteLength(stringify(finalReceipt), "utf8") <= 16_384)
  } finally {
    cleanupObservation?.()
    restore(AsyncLocalStorage.prototype, "run", savedRun)
    restore(AsyncLocalStorage.prototype, "getStore", savedGet)
    restore(performance, "now", savedNow)
    process.argv.splice(0, process.argv.length, ...argv)
    process.chdir(cwd)
    if (oldDirectory === undefined) delete process.env[directoryKey]; else process.env[directoryKey] = oldDirectory
    if (oldBinding === undefined) delete process.env[bindingKey]; else process.env[bindingKey] = oldBinding
    rmSync(directory, { recursive: true, force: true })
    rmSync(privateDirectory, { recursive: true, force: true })
  }
  assert.ok(finalReceipt)
  return finalReceipt
}

if (import.meta.main) {
  const mode = e16Modes.find((value) => value === process.argv[2])
  assert.ok(mode)
  const receipt = await child(mode)
  process.stdout.write(JSON.stringify(receipt) + "\n")
}
