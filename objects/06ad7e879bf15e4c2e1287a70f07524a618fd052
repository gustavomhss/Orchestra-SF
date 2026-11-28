import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

type Fault = "none" | "zero" | "partial" | "throw"
export const e15Modes = ["route-owner", "work-links", "native-chain", "persistence-tail", "capacity", "mechanism", "sink-zero", "sink-partial", "sink-throw", "forwarder"] as const
export type E15Mode = typeof e15Modes[number]
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex") }


/** Process isolation is required by the production selection latch; there is no reset API. */
export async function runSfE15Control(file: string, mode: E15Mode) {
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
    throw new Error("E15 observer control did not complete: " + JSON.stringify({
      mode, exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!record(receipt) || receipt.schema !== "sf-preview-e15-control-child-v1" || receipt.mode !== mode ||
    typeof receipt.pid !== "number" || !Number.isSafeInteger(receipt.pid) || receipt.pid <= 0 ||
    receipt.synthetic !== true || !Array.isArray(receipt.checks) || !receipt.checks.length ||
    receipt.checks.some((item: unknown) => typeof item !== "string") || Buffer.byteLength(stdout, "utf8") > 16_384)
    throw new Error("E15 observer control returned an invalid receipt")
  return { pid: receipt.pid, report: receipt,
    omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}


async function child(mode: E15Mode) {
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
  const directory = mkdtempSync(path.join(evidenceBase, "sf613-e15-event-"))
  const privateDirectory = mkdtempSync(path.join(os.tmpdir(), "sf613-e15-control-"))
  const directoryKey = "SF_PREVIEW_E15_EVENT_EVIDENCE_DIR", bindingKey = "SF_PREVIEW_E15_EVENT_EVIDENCE_BINDING"
  const oldDirectory = process.env[directoryKey], oldBinding = process.env[bindingKey]
  const argv = [...process.argv], cwd = process.cwd()
  const source = "29374ab6a0f38dd9ff8848a083c61ea35dcecdfb", sourceTree = "fe8221e56daf5fd7de8a79b29d2d485055b8c45a"
  const launcher = { schema: "sf-preview-e15-event-launch-v1", source, sourceTree, snapshot: "f".repeat(40),
    runId: "1", attempt: "1", nonce: path.basename(directory), processRole: "native-cli", streamName: "preview-events.jsonl" }
  const launcherRaw = stringify(launcher) + "\n", launcherPath = path.join(directory, "launcher.json")
  const launcherFd = openSync(launcherPath, "wx", 0o600)
  try { writeSync(launcherFd, launcherRaw, undefined, "utf8"); fsyncSync(launcherFd) } finally { closeSync(launcherFd) }
  const binding = stringify({ ...launcher, launcherBytes: Buffer.byteLength(launcherRaw, "utf8"), launcherSha256: sha256(launcherRaw) })
  const prefix = "SF_PREVIEW_E15_EVENT ", launcherPrefix = "SF_PREVIEW_E15_LAUNCHER ", eventFile = path.join(directory, "preview-events.jsonl")
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
    const observer = await import("../../../../modules/sucafina/Sucafinav1/runtime/preview-progress-e15-diagnostic.ts")
    const handle = mode === "forwarder" ? undefined : observer.startSfE15Observation(request)
    cleanupObservation = () => observer.finishSfE15Observation(handle, request, true)
    if (mode !== "forwarder") {
      assert.ok(handle)
      assert.equal(observer.startSfE15Observation(foreign), undefined)
      assert.equal(one("request-enter").maxEvents, 191)
      assert.equal(one("request-enter").maxBytes, 195_584)
      assert.equal(one("request-enter").maxLineBytes, 1_024)
    }



    function lookup(wrapped = false, gates: readonly unknown[] = [true, true, true, true, true], copyThrew = false) {
      const route = observer.enterSfE15Route("lookup")
      assert.ok(route)
      const receiver = {}, snapshot = {}, callback = () => product
      let invoked = 0
      const providerWork = function (this: unknown, value: unknown) {
        assert.equal(this, receiver); assert.equal(value, snapshot); invoked++; return product
      }
      const sourceWork = () => apply(providerWork, receiver, [snapshot])
      const wrappedWork = () => sourceWork()
      const forwarded = wrapped ? wrappedWork : sourceWork
      let result: unknown, caught: unknown = sentinel, failed = false
      try { result = observer.runSfE15Route(route, "candidate-read", () => {
        assert.equal(observer.currentSfE15Route(), route)
        const beforeMissing = lines.length
        for (const missing of [undefined, null, {}, "not-a-callback"]) {
          assert.equal(observer.tapSfE15ProviderSelection(missing, product), product)
          assert.equal(lines.length, beforeMissing)
        }
        assert.equal(observer.linkSfE15Work(route, "provider-read", providerWork, callback), providerWork)
        assert.equal(observer.enterSfE15Layer("source", () => product), undefined)
        assert.equal(observer.enterSfE15Layer("source", providerWork), route)
        assert.equal(observer.enterSfE15Layer("source", providerWork), undefined)
        if (gates[0] !== "not-evaluated") assert.equal(observer.tapSfE15Gate(route, "source-root-current", gates[0]), gates[0])
        observer.markSfE15Route(route, "source-selection", "decisionResults")
        assert.equal(observer.linkSfE15Work(route, "source-work", sourceWork), sourceWork)
        assert.equal(observer.enterSfE15Layer("choice", providerWork), undefined)
        assert.equal(observer.enterSfE15Layer("choice", sourceWork), route)
        if (wrapped) assert.equal(observer.linkSfE15Work(route, "choice-wrapped", wrappedWork), wrappedWork)
        observer.markSfE15Route(route, "choice-forward", wrapped ? "wrapped" : "direct")
        assert.equal(observer.enterSfE15Layer("local", () => product), undefined)
        assert.equal(observer.enterSfE15Layer("local", forwarded), route)
        observer.markSfE15Route(route, "local-enter", "child")
        const names = ["callback-equal", "store-current", "view-current", "product-condition"] as const
        for (let index = 0; index < names.length; index++) {
          const value = gates[index + 1]
          if (value !== "not-evaluated") assert.equal(observer.tapSfE15Gate(route, names[index]!, value), value)
        }
        observer.markSfE15Route(route, "native-gates", wrapped ? "full" : "projected")
        observer.markSfE15Route(route, "copy-enter", wrapped ? "full" : "projected")
        assert.equal(invoked, 0)
        let copyFailed = false
        try {
          if (copyThrew) throw undefined
          assert.equal(forwarded(), product)
        } catch (error) { copyFailed = true; throw error }
        finally { observer.markSfE15Route(route, "copy-close", copyFailed ? "threw" : "returned") }
        const before = lines.length
        assert.equal(observer.tapSfE15ProviderSelection(() => product, "full"), "full")
        assert.equal(lines.length, before)
        assert.equal(observer.tapSfE15ProviderSelection(callback, wrapped ? undefined : "decisionResults"), wrapped ? undefined : "decisionResults")
        assert.equal(observer.returnedSfE15Route(route, "candidate-read-returned", product), product)
        return product
      }) } catch (error) { failed = true; caught = error }
      finally { observer.finishSfE15Route(route, failed) }
      assert.equal(failed, copyThrew)
      if (copyThrew) assert.equal(caught, undefined); else assert.equal(result, product)
      assert.equal(invoked, copyThrew ? 0 : 1)
      const count = lines.length
      observer.markSfE15Route(route, "copy-enter", "full")
      observer.finishSfE15Route(route, false)
      assert.equal(lines.length, count)
      return route
    }
    async function persistence(reenterClose = false, pause?: { entered(): void; waiting: Promise<void> }) {
      const route = observer.enterSfE15Route("persistence")
      assert.ok(route)
      let calls = 0
      const receiver = {}, payload = {}, providerWork = function (this: unknown, value: unknown) {
        assert.equal(this, receiver); assert.equal(value, payload); calls++; return product
      }
      const sourceWork = () => apply(providerWork, receiver, [payload])
      const operationWork = () => product
      const result = await observer.runSfE15Route(route, "persist-body", async () => {
        const unrelated = () => product
        assert.equal(observer.enterSfE15Layer("operation", unrelated), undefined)
        assert.equal(observer.linkSfE15Work(route, "local-operation", unrelated), unrelated)
        assert.equal(observer.enterSfE15Layer("operation", unrelated), undefined)
        const write = await observer.runSfE15Route(route, "store-write", async () => {
          const value = await observer.runSfE15Route(route, "state-transaction", async () => {
            assert.equal(observer.linkSfE15Work(route, "provider-write", providerWork), providerWork)
            assert.equal(observer.enterSfE15Layer("source", unrelated), undefined)
            assert.equal(observer.enterSfE15Layer("source", providerWork), route)
            observer.markSfE15Route(route, "source-selection", undefined)
            assert.equal(observer.linkSfE15Work(route, "source-work", sourceWork), sourceWork)
            assert.equal(observer.enterSfE15Layer("choice", sourceWork), route)
            observer.markSfE15Route(route, "choice-forward", "direct")
            assert.equal(observer.enterSfE15Layer("local", sourceWork), route)
            observer.markSfE15Route(route, "local-enter", "top-level")
            assert.equal(observer.linkSfE15Work(route, "local-operation", operationWork), operationWork)
            assert.equal(observer.enterSfE15Layer("operation", unrelated), undefined)
            assert.equal(observer.enterSfE15Layer("operation", operationWork), route)
            observer.markSfE15Route(route, "queue-enter")
            if (pause) { pause.entered(); await pause.waiting }
            for (const name of ["queue-returned", "begin-enter", "begin-returned", "materialize-enter", "materialize-returned", "source-work-enter"] as const)
              observer.markSfE15Route(route, name)
            assert.equal(calls, 0)
            assert.equal(sourceWork(), product)
            assert.equal(observer.returnedSfE15Route(route, "source-work-returned", product), product)
            for (const name of ["source-finish-enter", "source-finish-returned", "source-dispose-enter", "source-dispose-returned", "local-scope-closed",
              "encode-enter", "encode-returned", "decode-returned", "sql-returned", "commit-enter", "commit-returned", "local-returning", "operation-returned"] as const)
              observer.markSfE15Route(route, name)
            return product
          })
          assert.equal(value, product)
          return observer.returnedSfE15Route(route, "state-transaction-returned", value)
        })
        assert.equal(observer.returnedSfE15Route(route, "store-write-returned", write), product)
        const recordedBeforeBinding = routeRows("persistence").map((row) => row.point)
        assert.ok(recordedBeforeBinding.includes("commit-returned"))
        assert.equal(recordedBeforeBinding.includes("persist-close"), false)
        observer.markSfE15Route(route, "binding-enter")
        // Binding's unrelated work cannot be attributed to the selected store-write transaction.
        assert.equal(observer.enterSfE15Layer("operation", unrelated), undefined)
        observer.markSfE15Route(route, "binding-returned")
        observer.markSfE15Route(route, "validation-enter")
        observer.markSfE15Route(route, "validation-returned")
        if (reenterClose) writeAction = () => observer.finishSfE15Observation(handle, request, false)
        assert.equal(observer.returnedSfE15Route(route, "binding-read-returned", product), product)
        return product
      })
      assert.equal(result, product); assert.equal(calls, 1)
      observer.finishSfE15Route(route, false)
      return route
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
            const route = observer.enterSfE15Route("lookup")
            assert.ok(route)
            let failed = false
            try {
              const value = await observer.runSfE15Route(route, "candidate-read", () => fixture.authority.state.read(request, "cases",
                selectSfScenarioCandidates({ caseRef }, digest, digest, call)))
              assert.equal(value.status, "ok")
              if (value.status !== "ok") throw new Error("Controlled native C08 read refused")
              storageVersion = value.storageVersion
              assert.deepEqual(value.value, [])
              assert.equal(observer.returnedSfE15Route(route, "candidate-read-returned", value), value)
            } catch (error) { failed = true; throw error }
            finally { observer.finishSfE15Route(route, failed) }
          }
          await observer.runSfE15Observation(handle, request, async () => {
            const analysis = observer.enterSfE15Unit("analysis")
            assert.ok(analysis)
            observer.returnedSfE15Await(analysis, await observer.runSfE15Phase(analysis, "analysis-select-initial", async () => {
              const canonical = observer.enterSfE15Route("canonical")
              assert.ok(canonical)
              await observer.runSfE15Route(canonical, "preparation", async () => { await nativeRead(); await nativeRead() })
              await observer.runSfE15Route(canonical, "comparator", async () => {
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
              observer.finishSfE15Route(canonical, false)
              return product
            }))
            for (const id of [1, 2]) {
              const values = routeRows("lookup").filter((row) => row.route === id)
              assert.equal(values.find((row) => row.point === "source-selection")?.detail, "root-absent")
              assert.equal(values.find((row) => row.point === "local-enter")?.detail, "top-level")
              assert.equal(values.find((row) => row.point === "copy-close")?.detail, "full")
              assert.equal(values.some((row) => row.point === "native-gates" || row.point === "provider-view"), false)
            }
            for (const id of [3, 5, 6]) {
              const values = routeRows("lookup").filter((row) => row.route === id)
              assert.equal(values.find((row) => row.point === "source-selection")?.detail, "decisionResults")
              assert.equal(values.find((row) => row.point === "choice-forward")?.detail, "direct")
              assert.deepEqual(values.find((row) => row.point === "native-gates")?.gates, [1, 1, 1, 1, 1])
              assert.equal(values.find((row) => row.point === "copy-close")?.detail, "decisionResults")
              assert.equal(values.find((row) => row.point === "provider-view")?.detail, "decisionResults")
            }
            const wrapped = routeRows("lookup").filter((row) => row.route === 4)
            assert.equal(wrapped.find((row) => row.point === "choice-forward")?.detail, "wrapped")
            assert.deepEqual(wrapped.find((row) => row.point === "native-gates")?.gates, [1, 0, -1, -1, 0])
            assert.equal(wrapped.find((row) => row.point === "copy-close")?.detail, "full")
            assert.equal(wrapped.some((row) => row.point === "provider-view"), false)
            checks.push("real-native-top-level-versus-held-root", "real-native-direct-and-wrapped-C08-identities", "real-native-preimage-keeps-selection")

            let enteredWriter!: () => void
            const entered = new Promise<void>((resolve) => { enteredWriter = resolve })
            const waiting = new Promise<void>((resolve) => { releaseWriter = resolve })
            blocker = fixture.store.transaction("dashboard", async () => {
              enteredWriter(); await waiting; return { commit: false, value: undefined }
            })
            await entered
            const persisted = observer.runSfE15Phase(analysis, "analysis-persist", async () => {
              const route = observer.enterSfE15Route("persistence")
              assert.ok(route)
              let failed = false
              try {
                return await observer.runSfE15Route(route, "persist-body", async () => {
                  const value = await observer.runSfE15Route(route, "store-write", async () => {
                    const result = await observer.runSfE15Route(route, "state-transaction", () => fixture.authority.state.transaction(request, {
                      namespace: "cases", expectedStorageVersion: storageVersion,
                      targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
                      idempotencyKey: "e15-tail-write", commandDigest: digestSfValue({ value: "written" }),
                    }, async (state) => {
                      const found = state.cases[caseRef.id]
                      assert.ok(found); found.objective = "E15 controlled native write"
                      return { commit: true, value: "written" }
                    }))
                    return observer.returnedSfE15Route(route, "state-transaction-returned", result)
                  })
                  assert.equal(stateValue(value), "written")
                  observer.returnedSfE15Route(route, "store-write-returned", value)
                  const names = routeRows("persistence").map((row) => row.point)
                  assert.ok(names.includes("commit-returned"))
                  assert.equal(names.includes("persist-close"), false)
                  // These post-write calls are controlled boundaries, not real binding storage.
                  observer.markSfE15Route(route, "binding-enter")
                  observer.markSfE15Route(route, "binding-returned")
                  observer.markSfE15Route(route, "validation-enter")
                  observer.markSfE15Route(route, "validation-returned")
                  return observer.returnedSfE15Route(route, "binding-read-returned", value)
                })
              } catch (error) { failed = true; throw error }
              finally { observer.finishSfE15Route(route, failed) }
            })
            pendingWrite = persisted
            const pending = routeRows("persistence").map((row) => row.point)
            assert.ok(pending.includes("queue-enter"))
            for (const absent of ["queue-returned", "begin-enter", "materialize-enter", "source-work-enter", "commit-returned", "persist-close"])
              assert.equal(pending.includes(absent), false)
            assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
            releaseWriter!(); releaseWriter = undefined
            await blocker; blocker = undefined
            observer.returnedSfE15Await(analysis, await persisted)
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
            observer.finishSfE15Unit(analysis, false)
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
      const pending = observer.runSfE15Observation(handle, request, async () => {
        firstUnit = observer.enterSfE15Unit("analysis")
        assert.ok(firstUnit)
        const value = observer.runSfE15Phase(firstUnit, "analysis-select-initial", async () => {
          canonical = observer.enterSfE15Route("canonical")
          assert.ok(canonical)
          const preparation = observer.runSfE15Route(canonical, "preparation", async () => {
            calls++
            const body = observer.enterSfE15Compare()
            assert.ok(body)
            assert.equal(observer.runSfE15Compare(body, () => waiting), waiting)
            observer.finishSfE15Compare(body, false)
            assert.deepEqual(one("compare-body-checkpoint").compareBodies, [1, 1, 0, 0, 0, 0])
            assert.equal(rows().some((row) => row.kind === "phase-close"), false)
            lookup(); lookup()
            finance = observer.markSfE15Finance("entered")
            assert.ok(finance)
            entered()
            await waiting
            observer.markSfE15Finance("owned-direct", finance)
            return product
          })
          assert.ok(preparation instanceof Promise)
          assert.equal(await preparation, product)
          const thenable = Object.defineProperty({}, "then", { get() { throw new Error("Observer must not assimilate thenable") } })
          const same = observer.runSfE15Route(canonical, "comparator", () => {
            calls++
            for (let index = 0; index < 4; index++) lookup()
            observer.markSfE15Finance("observation-returned", finance)
            observer.markSfE15Finance("returned", finance)
            return thenable
          })
          assert.equal(same, thenable)
          observer.finishSfE15Route(canonical, false)
          return product
        })
        firstValue = await value
        observer.returnedSfE15Await(firstUnit, firstValue)
        observer.finishSfE15Unit(firstUnit, false)
        return product
      })
      await started
      assert.equal(point("finance-enter", "canonical").route, 1)
      assert.equal(routeRows("canonical").some((row) => row.point === "finance-branch"), false)
      const firstCount = lines.length
      observer.runSfE15Observation(handle, request, () => {
        const second = observer.enterSfE15Unit("analysis")
        assert.ok(second)
        const result = observer.runSfE15Phase(second, "analysis-select-initial", () => {
          const secondCanonical = observer.enterSfE15Route("canonical")
          assert.equal(secondCanonical, undefined)
          return observer.runSfE15Route(secondCanonical, "preparation", () => {
            assert.equal(observer.currentSfE15Route(), undefined)
            assert.equal(observer.enterSfE15Route("lookup"), undefined)
            assert.equal(observer.markSfE15Finance("entered"), undefined)
            observer.markSfE15Finance("outside-root", finance)
            return product
          })
        })
        observer.returnedSfE15Await(second, result)
        observer.finishSfE15Unit(second, false)
      })
      assert.ok(lines.length > firstCount)
      assert.equal(routeRows("lookup").filter((row) => row.point === "lookup-enter").length, 2)
      assert.equal(routeRows("canonical").some((row) => row.point === "finance-branch"), false)
      assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
      release()
      assert.equal(await pending, product)
      assert.equal(firstValue, product); assert.equal(calls, 2)
      const lookups = routeRows("lookup").filter((row) => row.point === "lookup-enter")
      assert.deepEqual(lookups.map((row) => [row.route, row.routePhase]), [[1, "preparation"], [2, "preparation"],
        [3, "comparator"], [4, "comparator"], [5, "comparator"], [6, "comparator"]])
      assert.equal(new Set(lookups.map((row) => row.parentPhase)).size, 1)
      assert.equal(point("finance-branch", "canonical").detail, "owned-direct")
      assert.ok(point("finance-work-enter", "canonical"))
      assert.ok(point("finance-observation-returned", "canonical"))
      assert.ok(point("finance-body-exit", "canonical"))
      const beforeLate = lines.length
      assert.equal(observer.runSfE15Observation(handle, request, () => observer.runSfE15Route(canonical, "comparator", () => {
        assert.equal(observer.currentSfE15Route(), undefined)
        assert.equal(observer.enterSfE15Route("lookup"), undefined)
        return product
      })), product)
      assert.equal(lines.length, beforeLate)
      checks.push("first-canonical-private-owner-across-suspension", "second-canonical-and-Finance-cannot-steal",
        "two-preparation-four-comparator-lookups", "undefined-and-closed-route-mask-ambient",
        "real-LF-prefix-before-completion", "exact-Promise-and-thenable-no-assimilation", "body-return-is-not-Promise-settlement-or-phase-close")
    } else if (mode === "work-links") {
      let coerced = 0
      const nonboolean = new Proxy({}, { get() { coerced++; throw outputError } })
      observer.runSfE15Observation(handle, request, () => {
        const unit = observer.enterSfE15Unit("analysis")
        observer.returnedSfE15Await(unit, observer.runSfE15Phase(unit, "analysis-select-initial", () => {
          const canonical = observer.enterSfE15Route("canonical")
          observer.runSfE15Route(canonical, "preparation", () => {
            lookup()
            lookup(true, [true, false, "not-evaluated", "not-evaluated", false])
          })
          observer.runSfE15Route(canonical, "comparator", () => {
            const beforeFinance = lines.length
            assert.equal(observer.markSfE15Finance("entered"), undefined)
            observer.markSfE15Finance("work-enter")
            assert.equal(lines.length, beforeFinance)
            lookup(false, ["not-evaluated", "not-evaluated", "not-evaluated", "not-evaluated", "not-evaluated"])
            lookup(false, [nonboolean, true, false, "not-evaluated", false])
            lookup(false, [true, true, true, true, true], true)
            lookup(false, [true, true, true, true, true])
          })
          observer.finishSfE15Route(canonical, false)
          return product
        }))
        observer.finishSfE15Unit(unit, false)
      })
      const gate = (id: number) => routeRows("lookup").find((row) => row.route === id && row.point === "native-gates")?.gates
      assert.deepEqual(gate(1), [1, 1, 1, 1, 1])
      assert.deepEqual(gate(2), [1, 0, -1, -1, 0])
      assert.deepEqual(gate(3), [-1, -1, -1, -1, -1])
      assert.deepEqual(gate(4), [2, 1, 0, -1, 0])
      assert.equal(coerced, 0)
      const failed = routeRows("lookup").filter((row) => row.route === 5)
      assert.equal(failed.find((row) => row.point === "copy-close")?.detail, "threw")
      assert.equal(failed.find((row) => row.point === "lookup-close")?.detail, "threw")
      assert.equal(failed.some((row) => row.point === "provider-view" || row.point === "candidate-read-returned"), false)
      checks.push("exact-work-links-no-callback-invocation", "wrapped-work-requires-explicit-link",
        "provider-missing-and-foreign-callback-no-view", "comparator-Finance-cannot-claim-preparation-owner",
        "not-evaluated-false-true-nonboolean-gates",
        "throw-undefined-copy-has-no-returned-view")
    } else if (mode === "native-chain") {
      await nativeChain()
    } else if (mode === "persistence-tail") {
      let release!: () => void, entered!: () => void
      const waiting = new Promise<void>((resolve) => { release = resolve })
      const started = new Promise<void>((resolve) => { entered = resolve })
      let firstUnit: unknown
      const pending = observer.runSfE15Observation(handle, request, async () => {
        firstUnit = observer.enterSfE15Unit("analysis")
        assert.ok(firstUnit)
        const result = await observer.runSfE15Phase(firstUnit, "analysis-persist", () => persistence(true, { entered, waiting }))
        observer.returnedSfE15Await(firstUnit, result)
        observer.finishSfE15Unit(firstUnit, false)
        return product
      })
      await started
      const prefixPoints = routeRows("persistence").map((row) => row.point)
      assert.ok(prefixPoints.includes("prewrite") && prefixPoints.includes("state-transaction-enter") && prefixPoints.includes("queue-enter"))
      assert.equal(prefixPoints.includes("queue-returned") || prefixPoints.includes("begin-enter") || prefixPoints.includes("commit-returned"), false)
      assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
      observer.runSfE15Observation(handle, request, () => {
        assert.equal(observer.enterSfE15Route("persistence"), undefined)
        const second = observer.enterSfE15Unit("analysis")
        observer.returnedSfE15Await(second, observer.runSfE15Phase(second, "analysis-persist", () => {
          assert.equal(observer.enterSfE15Route("persistence"), undefined)
          return product
        }))
        observer.finishSfE15Unit(second, false)
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
      assert.equal(observer.runSfE15Observation(handle, request, () => product), product)
      observer.finishSfE15Observation(handle, request, true)
      assert.equal(lines.length, closedCount)
      checks.push("first-persistence-requires-first-analysis-phase", "operation-true-is-not-transaction-identity",
        "queue-prefix-does-not-fabricate-BEGIN-or-commit", "post-write-binding-remains-distinct",
        "reentrant-terminal-freezes-open-prefix-without-late-close")
    } else if (mode === "capacity") {
      let actualWork = 0
      await observer.runSfE15Observation(handle, request, async () => {
        const filler = observer.enterSfE15Unit("combination")
        for (let index = 0; index < 600; index++)
          observer.returnedSfE15Await(filler, observer.runSfE15Phase(filler, "combination-evaluate", () => { actualWork++; return product }))
        observer.finishSfE15Unit(filler, false)
        const analysis = observer.enterSfE15Unit("analysis")
        observer.returnedSfE15Await(analysis, observer.runSfE15Phase(analysis, "analysis-select-initial", () => {
          for (let index = 0; index < 128; index++) {
            const compare = observer.enterSfE15Compare()
            assert.ok(compare)
            assert.equal(observer.runSfE15Compare(compare, () => product), product)
            observer.finishSfE15Compare(compare, false)
          }
          const canonical = observer.enterSfE15Route("canonical")
          let finance: unknown
          observer.runSfE15Route(canonical, "preparation", () => {
            lookup(); lookup(); finance = observer.markSfE15Finance("entered")
            observer.markSfE15Finance("owned-records", finance)
            observer.markSfE15Finance("outside-root", finance)
          })
          observer.runSfE15Route(canonical, "comparator", () => {
            for (let index = 0; index < 4; index++) lookup()
            observer.markSfE15Finance("observation-returned", finance)
            observer.markSfE15Finance("returned", finance)
          })
          observer.finishSfE15Route(canonical, false)
          return product
        }))
        observer.returnedSfE15Await(analysis, observer.runSfE15Phase(analysis, "analysis-compare", () => product))
        observer.returnedSfE15Await(analysis, await observer.runSfE15Phase(analysis, "analysis-persist", () => persistence()))
        for (const phase of ["analysis-bind", "analysis-select-final", "analysis-revalidate"] as const)
          observer.returnedSfE15Await(analysis, observer.runSfE15Phase(analysis, phase, () => product))
        observer.finishSfE15Unit(analysis, false)
        const port = observer.enterSfE15Unit("port")
        for (const phase of ["port-authority-final", "evaluations-recheck", "candidates-final"] as const)
          observer.returnedSfE15Await(port, observer.runSfE15Phase(port, phase, () => product))
        observer.finishSfE15Unit(port, false)
        const revalidate = observer.enterSfE15Unit("production-revalidation")
        observer.returnedSfE15Await(revalidate, observer.runSfE15Phase(revalidate, "production-analysis-revalidate", () => product))
        observer.finishSfE15Unit(revalidate, false)
        for (let index = 4; index < 28; index++) {
          const unit = observer.enterSfE15Unit("combination")
          assert.ok(unit)
          observer.finishSfE15Unit(unit, false)
        }
      })
      assert.equal(actualWork, 600)
      observer.markSfE15Http(handle, request, "with-case-returned")
      observer.markSfE15Http(handle, request, "egress-passed")
      observer.finishSfE15Observation(handle, request, false)
      assert.equal(rows().length, 191)
      assert.equal(rows().filter((row) => row.kind === "overflow").length, 1)
      assert.equal(rows().filter((row) => row.kind === "unit-close").length, 28)
      assert.deepEqual(rows().filter((row) => row.kind === "compare-body-checkpoint").map((row) => row.bodyExits), [1, 8, 32, 128])
      const analysisRows = rows().filter((row) => row.kind === "phase-enter" && row.unit === 2)
      assert.deepEqual(analysisRows.filter((row) => Number(row.phase) <= 5).map((row) => row.phase), [1, 4, 5, 2, 3])
      assert.equal(routeRows("lookup").length, 72)
      assert.equal(routeRows("canonical").length, 8)
      assert.equal(routeRows("persistence").length, 36)
      assert.deepEqual(one("request-close").routeCoverage, [1, 2, 4, 1, 0, 0])
      assert.equal(one("request-close").openUnits, 0)
      assert.equal(one("request-close").openPhases, 0)
      assert.deepEqual(one("request-close").compareBodies, [128, 128, 0, 0, 0, 0])
      assert.equal(one("request-close").saturated, false)
      checks.push("six-hundred-works-survive-general-detail-cap", "critical-sites-and-tail-survive-general-cap",
        "global-four-body-checkpoints-survive-cap", "exact-191-line-reservation-model", "terminal-reserved-at-full-cap")
    } else if (mode === "mechanism") {
      observer.runSfE15Observation(handle, request, () => {
        const canonical = observer.enterSfE15Route("canonical")
        observer.runSfE15Route(canonical, "preparation", () => {
          const finance = observer.markSfE15Finance("entered")
          observer.markSfE15Finance("owned-records", finance)
          observer.markSfE15Finance("observation-returned", finance)
          observer.markSfE15Finance("returned", finance)
        })
        observer.finishSfE15Route(canonical, false)
      })
      assert.ok(point("finance-observation-returned", "canonical"))
      assert.ok(point("finance-body-exit", "canonical"))
      assert.equal(routeRows("canonical").some((row) => row.point === "finance-work-enter" || row.point === "comparator-enter"), false)
      checks.push("Finance-observation-return-does-not-invent-work")
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
      assert.equal(observer.runSfE15Observation(handle, request, () => { calls++; return value }), value)
      assert.ok(typeof delayed === "function")
      apply(delayed, undefined, [])
      assert.equal(calls, 1)
      for (const thrown of [outputError, undefined]) {
        let caught: unknown = value, didThrow = false
        installRun(function (token, callback) {
          try { apply(nativeRun, this, [token, callback]) } catch { /* Deliberately swallow the product throw. */ }
          return mechanismValue
        })
        try { observer.runSfE15Observation(handle, request, () => { calls++; throw thrown }) } catch (error) { didThrow = true; caught = error }
        assert.equal(didThrow, true); assert.equal(caught, thrown)
      }
      assert.equal(calls, 3)
      let entries = 0
      installRun(function () { throw outputError })
      assert.equal(observer.runSfE15Observation(handle, request, () => { calls++; if (observer.enterSfE15Compare()) entries++; return value }), value)
      assert.equal(calls, 4); assert.equal(entries, 0)
      installRun(function () { return mechanismValue })
      assert.equal(observer.runSfE15Observation(handle, request, () => { calls++; return undefined }), undefined)
      assert.equal(calls, 5)
      installRun(function (token, callback) { apply(nativeRun, this, [token, callback]); throw outputError })
      const promise = Promise.resolve(value)
      assert.equal(observer.runSfE15Observation(handle, request, () => { calls++; return promise }), promise)
      assert.equal(await promise, value); assert.equal(calls, 6)
      define(AsyncLocalStorage.prototype, "run", savedRun)
      observer.finishSfE15Observation(handle, request, false)
      assert.deepEqual(one("request-close").faultsBefore, [0, 0, 1, 1, 0, 0])
      checks.push("duplicate-and-tardy-thunk-never-replay", "mechanism-result-and-swallowed-error-not-authoritative",
        "before-noinvoke-after-faults-preserve-work", "scope-fallback-disables-attribution")
    } else if (mode.startsWith("sink-")) {
      const fault: Fault = mode === "sink-zero" ? "zero" : mode === "sink-partial" ? "partial" : "throw"
      const before = { ...attempts }, complete = lines.length
      faults.file = fault; faults.stdout = fault
      observer.markSfE15Http(handle, request, "body-returned")
      assert.equal(attempts.file, before.file + 1); assert.equal(attempts.stdout, before.stdout + 1)
      faults.file = "none"; faults.stdout = "none"
      let calls = 0, threw = false, caught: unknown = sentinel
      assert.equal(observer.runSfE15Observation(handle, request, () => { calls++; return product }), product)
      try { observer.runSfE15Observation(handle, request, () => { calls++; throw undefined }) } catch (error) { threw = true; caught = error }
      observer.markSfE15Http(handle, request, "admit-returned")
      observer.finishSfE15Observation(handle, request, true)
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
      const forward = observer.createSfE15Forwarder()
      same(forward, "ordinary text\n" + wire.slice(0, 7))
      same(forward, wire.slice(7, 22))
      assert.equal(lines.length, at)
      same(forward, wire.slice(22) + wire + "ignored\n" + wire.slice(0, -1))
      assert.deepEqual(lines.slice(at), [wire, wire])
      same(forward, "\n")
      assert.deepEqual(lines.slice(at), [wire, wire, wire])
      const eof = observer.createSfE15Forwarder()
      at = lines.length
      same(eof, wire.slice(0, -1))
      assert.equal(lines.length, at)
      checks.push("forwarder-real-chunk-identity-and-multilines", "forwarder-only-real-LF-no-EOF-promotion")

      for (const bad of [prefix + "x".repeat(1_024), prefix + "\u00e9", prefix + "x".repeat(1_003) + "\u00e9"]) {
        const sink = observer.createSfE15Forwarder(), count = lines.length
        same(sink, bad.slice(0, prefix.length)); same(sink, bad.slice(prefix.length))
        assert.equal(lines.length, count)
        same(sink, "\n" + wire)
        assert.equal(lines.length, count)
      }
      const irrelevant = observer.createSfE15Forwarder()
      at = lines.length
      same(irrelevant, "outside " + "\u00e9".repeat(1_100) + "\n" + wire)
      assert.deepEqual(lines.slice(at), [wire])
      checks.push("forwarder-ASCII-byte-bound-before-LF", "forwarder-invalid-diagnostic-latches", "forwarder-unrelated-long-lines-ignored")

      for (const fault of ["zero", "partial", "throw"] as const) {
        const sink = observer.createSfE15Forwarder(), before = attempts.stdout
        faults.stdout = fault
        same(sink, wire)
        faults.stdout = "none"
        same(sink, wire)
        assert.equal(attempts.stdout, before + 1)
      }
      checks.push("forwarder-zero-partial-undefined-throw-no-retry")
      const capped = observer.createSfE15Forwarder()
      at = lines.length
      const full = prefix + "x".repeat(1_024 - prefix.length - 1) + "\n"
      assert.equal(Buffer.byteLength(full, "utf8"), 1_024)
      for (let index = 0; index < 192; index++) same(capped, full)
      assert.equal(lines.length - at, 191)
      assert.equal(lines.slice(at).reduce((sum, line) => sum + Buffer.byteLength(line, "utf8"), 0), 195_584)
      const disabledOnly = observer.createSfE15Forwarder()
      at = lines.length
      same(disabledOnly, disabled); same(disabledOnly, disabled); same(disabledOnly, wire)
      assert.deepEqual(lines.slice(at), [disabled])
      const exclusive = observer.createSfE15Forwarder()
      at = lines.length
      same(exclusive, wire); same(exclusive, disabled); same(exclusive, wire)
      assert.deepEqual(lines.slice(at), [wire])
      checks.push("forwarder-191-events-and-191KiB", "forwarder-one-disabled-and-exclusive-mode")
    } else throw new Error("Unknown E15 mode")

    if (mode !== "forwarder") {
      observer.finishSfE15Observation(handle, request, false)
      const all = rows(), raw = readFileSync(eventFile, "utf8"), faulted = mode.startsWith("sink-")
      assert.ok(all.length <= 191 && Buffer.byteLength(lines.join(""), "utf8") <= 195_584)
      assert.ok(Buffer.byteLength(raw, "utf8") <= 195_584)
      assert.equal(statSync(eventFile).mode & 0o777, 0o600)
      for (const row of all) {
        assert.equal(row.schema, "sf-preview-causal-e15-event-v1")
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
      observer.markSfE15Http(handle, request, "egress-passed")
      observer.finishSfE15Observation(handle, request, true)
      assert.equal(observer.startSfE15Observation(request), undefined)
      assert.equal(lines.length, count)
      const terminal = all.find((row) => row.kind === "request-close")
      finalReceipt = { schema: "sf-preview-e15-control-child-v1", mode, pid: process.pid, synthetic: true, checks,
        records: all.length, stdoutAttempts: attempts.stdout, stdoutBytes: Buffer.byteLength(lines.join(""), "utf8"),
        stdoutSha256: sha256(lines.join("")), fileAttempts: attempts.file, fileBytes: Buffer.byteLength(raw, "utf8"), fileSha256: sha256(raw),
        terminal: terminal ? { kind: terminal.kind, sequence: terminal.sequence, outcome: terminal.outcome, openUnits: terminal.openUnits,
          openPhases: terminal.openPhases, compareBodies: terminal.compareBodies, routeCoverage: terminal.routeCoverage,
          faultsBefore: terminal.faultsBefore, saturated: terminal.saturated } : null }
    } else {
      finalReceipt = { schema: "sf-preview-e15-control-child-v1", mode, pid: process.pid, synthetic: true, checks,
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
  const mode = e15Modes.find((value) => value === process.argv[2])
  assert.ok(mode)
  const receipt = await child(mode)
  process.stdout.write(JSON.stringify(receipt) + "\n")
}
