import assert from "node:assert/strict"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const e13Modes = ["flow", "mechanism", "foreign-noop", "get-store", "output", "overflow", "unavailable"] as const
export type E13Mode = typeof e13Modes[number]
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex") }

/** Process isolation is required by the production selection latch; there is no reset API. */
export async function runSfE13Control(file: string, mode: E13Mode) {
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
    throw new Error("E13 observer control did not complete: " + JSON.stringify({
      mode, exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!record(receipt) || receipt.schema !== "sf-preview-e13-control-child-v1" || receipt.mode !== mode ||
    typeof receipt.pid !== "number" || !Number.isSafeInteger(receipt.pid) || receipt.pid <= 0 ||
    receipt.synthetic !== true || !Array.isArray(receipt.checks) || !receipt.checks.length ||
    receipt.checks.some((item: unknown) => typeof item !== "string") || Buffer.byteLength(stdout, "utf8") > 16_384)
    throw new Error("E13 observer control returned an invalid receipt")
  return { pid: receipt.pid, report: receipt,
    omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}

async function child(mode: E13Mode) {
  const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty, remove = Reflect.deleteProperty
  const apply = Reflect.apply, parse = JSON.parse, stringify = JSON.stringify
  const savedRun = property(AsyncLocalStorage.prototype, "run"), savedGet = property(AsyncLocalStorage.prototype, "getStore")
  const savedNow = property(performance, "now"), savedWrite = property(process.stdout, "write"), savedStringify = property(JSON, "stringify")
  const originalWrite = process.stdout.write
  assert.ok(savedRun && savedGet && savedStringify)
  const nativeRun = savedRun.value, nativeGet = savedGet.value
  assert.equal(typeof nativeRun, "function")
  assert.equal(typeof nativeGet, "function")
  const repository = realpathSync(fileURLToPath(new URL("../../../../", import.meta.url)))
  const evidenceBase = path.join(repository, "test-ci-evidence")
  mkdirSync(evidenceBase, { recursive: true })
  const directory = mkdtempSync(path.join(evidenceBase, "sf613-e13-event-"))
  const privateDirectory = mkdtempSync(path.join(os.tmpdir(), "sf613-e13-control-"))
  const directoryKey = "SF_PREVIEW_E13_EVENT_EVIDENCE_DIR", bindingKey = "SF_PREVIEW_E13_EVENT_EVIDENCE_BINDING"
  const oldDirectory = process.env[directoryKey], oldBinding = process.env[bindingKey]
  const argv = [...process.argv], cwd = process.cwd()
  const source = "455c02a7a05a6dd3262ae15b184419897366fde4", sourceTree = "ae1c0977057e45853f3dc240140e5f221057f49d"
  const launcher = { schema: "sf-preview-e13-event-launch-v1", source, sourceTree, snapshot: "f".repeat(40),
    runId: "1", attempt: "1", nonce: path.basename(directory), processRole: "native-cli", streamName: "preview-events.jsonl" }
  const launcherRaw = stringify(launcher) + "\n", launcherPath = path.join(directory, "launcher.json")
  const launcherFd = openSync(launcherPath, "wx", 0o600)
  try { writeSync(launcherFd, launcherRaw, undefined, "utf8"); fsyncSync(launcherFd) } finally { closeSync(launcherFd) }
  const binding = stringify({ ...launcher, launcherBytes: Buffer.byteLength(launcherRaw, "utf8"), launcherSha256: sha256(launcherRaw) })
  const prefix = "SF_PREVIEW_E13_EVENT ", eventFile = path.join(directory, "preview-events.jsonl")
  const lines: string[] = [], checks: string[] = []
  let clock = 1_000, clockAction: (() => void) | undefined, invalidClock = false
  let writeFalse = false, writeThrow = false, stdoutAttempts = 0, requestGets = 0
  const outputError = new Error("synthetic-output")
  const request = new Proxy(new Request("https://example.invalid/selected"), { get() { requestGets++; throw new Error("Request member read") } })
  const foreign = new Proxy(new Request("https://example.invalid/foreign"), { get() { requestGets++; throw new Error("Foreign Request member read") } })
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
  function restore(owner: object, key: string, descriptor: PropertyDescriptor | undefined) {
    if (descriptor) define(owner, key, descriptor); else remove(owner, key)
  }
  function installRun(implementation: (this: unknown, token: unknown, callback: unknown) => unknown) {
    define(AsyncLocalStorage.prototype, "run", { ...savedRun, value: implementation })
  }
  let finalReceipt: Record<string, unknown> | undefined
  try {
    process.chdir(privateDirectory)
    process.argv.splice(1, process.argv.length - 1, path.join(repository, "apps/cli/src/index.ts"), "serve")
    process.env[directoryKey] = directory
    process.env[bindingKey] = mode === "unavailable" ? "{}" : binding
    define(performance, "now", { configurable: true, value: () => {
      const action = clockAction
      clockAction = undefined
      action?.()
      clock += 0.1
      return invalidClock ? Number.NaN : clock
    } })
    define(process.stdout, "write", { configurable: true, value: function (this: unknown, chunk: unknown, ...args: unknown[]) {
      if (typeof chunk === "string" && chunk.startsWith(prefix)) {
        stdoutAttempts++
        if (writeThrow) throw outputError
        lines.push(chunk)
        return !writeFalse
      }
      return apply(originalWrite, this, [chunk, ...args])
    } })
    const observer = await import("../../../../modules/sucafina/Sucafinav1/runtime/preview-progress-e13-diagnostic.ts")
    const handle = observer.startSfE13Observation(request)
    if (mode === "unavailable") {
      assert.equal(handle, undefined)
      process.env[bindingKey] = binding
      assert.equal(observer.startSfE13Observation(request), undefined)
      let calls = 0
      const value = {}
      assert.equal(observer.runSfE13Observation(handle, request, () => { calls++; return value }), value)
      let threw = false, caught: unknown = value
      try { observer.runSfE13Observation(handle, request, () => { calls++; throw undefined }) } catch (error) { threw = true; caught = error }
      assert.equal(threw, true); assert.equal(caught, undefined); assert.equal(calls, 2)
      assert.equal(observer.enterSfE13Unit("compare"), undefined)
      observer.markSfE13Http(handle, request, "body-returned"); observer.finishSfE13Observation(handle, request, false)
      assert.equal(lines.length, 0)
      checks.push("invalid-binding-latches-without-reselection", "unavailable-keeps-value-and-undefined")
    } else {
      assert.ok(handle)
      assert.equal(observer.startSfE13Observation(foreign), undefined)
      assert.equal(observer.enterSfE13Unit("compare"), undefined)
      assert.equal(one("request-enter").maxEvents, 511)
      assert.equal(one("request-enter").maxBytes, 261_120)
      if (mode === "flow") {
        writeFalse = true
        observer.markSfE13Http(handle, request, "body-returned")
        writeFalse = false
        const value = {}, promise = Promise.resolve(value)
        assert.equal(observer.runSfE13Observation(handle, request, () => promise), promise)
        assert.equal(await promise, value)
        let thenGets = 0
        const thenable = { get then() { thenGets++; throw outputError } }
        assert.equal(observer.runSfE13Observation(handle, request, () => thenable), thenable)
        assert.equal(thenGets, 0)
        let foreignCalls = 0
        observer.runSfE13Observation(handle, request, () => {
          const before = lines.length
          assert.equal(observer.runSfE13Observation(handle, foreign, () => { foreignCalls++; return observer.enterSfE13Unit("compare") }), undefined)
          assert.equal(observer.runSfE13Observation({}, request, () => { foreignCalls++; return observer.enterSfE13Unit("compare") }), undefined)
          assert.equal(lines.length, before)
        })
        assert.equal(foreignCalls, 2)
        checks.push("exact-promise-and-unassimilated-value", "foreign-and-wrong-handle-use-neutral-scope")

        await observer.runSfE13Observation(handle, request, async () => {
          const first = observer.enterSfE13Unit("port"), second = observer.enterSfE13Unit("port")
          assert.ok(first && second)
          let releaseFirst = () => {}, releaseSecond = () => {}
          const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
          const secondGate = new Promise<void>((resolve) => { releaseSecond = resolve })
          const firstValue = {}, secondValue = {}
          const firstPromise = observer.runSfE13Phase(first, "combination-evaluate", async () => {
            const unit = observer.enterSfE13Unit("compare"); assert.ok(unit)
            await firstGate
            observer.finishSfE13Unit(unit, false)
            return firstValue
          })
          const secondPromise = observer.runSfE13Phase(second, "evaluations-recheck", async () => {
            const unit = observer.enterSfE13Unit("compare"); assert.ok(unit)
            await secondGate
            observer.finishSfE13Unit(unit, false)
            return secondValue
          })
          const prefixRows = rows()
          const firstPhase = prefixRows.find((item) => item.kind === "phase-enter" && item.point === "combination-evaluate")
          const secondPhase = prefixRows.find((item) => item.kind === "phase-enter" && item.point === "evaluations-recheck")
          assert.ok(firstPhase && secondPhase)
          const children = prefixRows.filter((item) => item.kind === "unit-enter" && item.unitKind === "compare")
          assert.equal(children.length, 2)
          assert.deepEqual(children.map((item) => [item.parentUnit, item.parentPhase]),
            [[firstPhase.unit, firstPhase.phase], [secondPhase.unit, secondPhase.phase]])
          assert.equal(prefixRows.filter((item) => item.kind === "unit-close").length, 0)
          assert.equal(readFileSync(eventFile, "utf8"), lines.join(""))
          releaseSecond()
          assert.equal(observer.returnedSfE13Await(second, await secondPromise), secondValue)
          observer.finishSfE13Unit(second, false)
          releaseFirst()
          assert.equal(observer.returnedSfE13Await(first, await firstPromise), firstValue)
          observer.finishSfE13Unit(first, false)
        })
        checks.push("entries-persist-before-units-return", "overlapping-phases-keep-explicit-parent")

        const { compareScenarios } = await import("../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts")
        const { createPortfolioPort } = await import("../../../../modules/sucafina/Sucafinav1/product/portfolio/port.ts")
        const opaqueContext = {}, earlyInput = { host: { revalidate: () => Promise.resolve(false) } }
        await observer.runSfE13Observation(handle, request, async () => {
          const early: unknown = await apply(compareScenarios, undefined, [earlyInput, { scenarioRefs: [], criteria: [] }, opaqueContext])
          assert.deepEqual(early, { status: "needs-input", reason: "two-distinct-scenarios-required" })
          const denied: unknown = await apply(compareScenarios, undefined, [earlyInput, { scenarioRefs: ["left", "right"], criteria: [] }, opaqueContext])
          assert.deepEqual(denied, { status: "denied", reason: "invalid-binding" })
          const order: string[] = []
          const abruptHost = { get revalidate() { order.push("lookup"); return function (this: unknown, context: unknown) {
            assert.equal(this, abruptHost); assert.equal(context, opaqueContext); order.push("call"); throw undefined
          } } }
          let threw = false, caught: unknown = opaqueContext
          try { await apply(compareScenarios, undefined, [{ host: abruptHost }, { scenarioRefs: ["left", "right"], criteria: [] }, opaqueContext]) }
          catch (error) { threw = true; caught = error }
          assert.equal(threw, true); assert.equal(caught, undefined)
          assert.deepEqual(order, ["lookup", "call"])
          const rejection = {}
          threw = false; caught = undefined
          try { await apply(compareScenarios, undefined, [{ host: { revalidate: () => Promise.reject(rejection) } },
            { scenarioRefs: ["left", "right"], criteria: [] }, opaqueContext]) }
          catch (error) { threw = true; caught = error }
          assert.equal(threw, true); assert.equal(caught, rejection)
          const port = createPortfolioPort({ revalidate: () => Promise.resolve(false),
            resolveCandidate: () => { throw outputError }, evaluate: () => { throw outputError },
            sensitivity: () => { throw outputError }, revalidateEvaluation: () => { throw outputError } })
          const portDenied: unknown = await apply(port.evaluate, port, [{ scope: { horizon: { start: "2026-01-01", end: "2026-01-02" }, currency: "USD" },
            candidateRefs: [], operations: [], constraints: [], priorities: [], explorationLimit: 4 }, opaqueContext])
          assert.deepEqual(portDenied, { status: "denied", reason: "invalid-binding" })
        })
        const outcomes = rows().filter((item) => item.kind === "phase-close").map((item) => item.outcome)
        assert.ok(outcomes.includes("returned") && outcomes.includes("abrupt") && outcomes.includes("rejected"))
        checks.push("real-callers-early-return-denial-and-exact-rejection", "lookup-receiver-arguments-once")

        let releaseLate = () => {}, latePromise: Promise<void> | undefined
        await observer.runSfE13Observation(handle, request, async () => {
          const parent = observer.enterSfE13Unit("port")
          const lateGate = new Promise<void>((resolve) => { releaseLate = resolve })
          const combined = observer.runSfE13Phase(parent, "evaluations-recheck", () => {
            const rejected = (async () => {
              const unit = observer.enterSfE13Unit("compare")
              let failed = false
              try { await Promise.reject(undefined) } catch (error) { failed = true; throw error }
              finally { observer.finishSfE13Unit(unit, failed) }
            })()
            latePromise = (async () => { const unit = observer.enterSfE13Unit("compare"); await lateGate; observer.finishSfE13Unit(unit, false) })()
            return Promise.all([rejected, latePromise])
          })
          let threw = false, caught: unknown = outputError
          try { await combined } catch (error) { threw = true; caught = error }
          assert.equal(threw, true); assert.equal(caught, undefined)
          observer.finishSfE13Unit(parent, true)
        })
        assert.equal(rows().filter((item) => item.kind === "unit-enter").length -
          rows().filter((item) => item.kind === "unit-close").length, 1)
        clockAction = () => observer.finishSfE13Observation(handle, request, false)
        observer.markSfE13Http(handle, request, "egress-passed")
        const terminal = one("request-close")
        assert.equal(terminal.openUnits, 1)
        assert.equal(terminal.openPhases, 0)
        assert.equal(terminal.backpressureBefore, true)
        assert.equal(terminal.scopeDisabled, false)
        assert.equal(rows().at(-2)?.kind, "http-boundary")
        const closedLines = lines.length
        releaseLate()
        assert.ok(latePromise)
        await latePromise
        observer.markSfE13Http(handle, request, "body-returned"); observer.finishSfE13Observation(handle, request, true)
        assert.equal(observer.runSfE13Observation(handle, request, () => observer.enterSfE13Unit("compare")), undefined)
        assert.equal(lines.length, closedLines)
        checks.push("parent-rejection-does-not-close-sibling", "reentrant-close-serialized-and-late-ignored")
      } else if (mode === "mechanism") {
        let calls = 0, delayed: unknown
        const value = {}, mechanismValue = {}
        installRun(function (token, callback) {
          assert.ok(typeof callback === "function")
          delayed = callback
          apply(nativeRun, this, [token, callback])
          apply(nativeRun, this, [token, callback])
          return mechanismValue
        })
        assert.equal(observer.runSfE13Observation(handle, request, () => { calls++; return value }), value)
        assert.ok(typeof delayed === "function")
        apply(delayed, undefined, [])
        assert.equal(calls, 1)
        for (const thrown of [outputError, undefined]) {
          let caught: unknown = value, didThrow = false
          installRun(function (token, callback) {
            try { apply(nativeRun, this, [token, callback]) } catch { /* The mechanism deliberately swallows product rejection. */ }
            return mechanismValue
          })
          try { observer.runSfE13Observation(handle, request, () => { calls++; throw thrown }) } catch (error) { didThrow = true; caught = error }
          assert.equal(didThrow, true); assert.equal(caught, thrown)
        }
        assert.equal(calls, 3)
        let entries = 0
        installRun(function () { throw outputError })
        assert.equal(observer.runSfE13Observation(handle, request, () => { calls++; if (observer.enterSfE13Unit("compare")) entries++; return value }), value)
        assert.equal(calls, 4); assert.equal(entries, 0)
        installRun(function () { return mechanismValue })
        assert.equal(observer.runSfE13Observation(handle, request, () => { calls++; return undefined }), undefined)
        assert.equal(calls, 5)
        installRun(function (token, callback) { apply(nativeRun, this, [token, callback]); throw outputError })
        const promise = Promise.resolve(value)
        assert.equal(observer.runSfE13Observation(handle, request, () => { calls++; return promise }), promise)
        assert.equal(await promise, value); assert.equal(calls, 6)
        define(AsyncLocalStorage.prototype, "run", savedRun)
        observer.finishSfE13Observation(handle, request, false)
        assert.equal(one("request-close").scopeDisabled, true)
        assert.equal(one("request-close").scopeFault, true)
        assert.equal(rows().filter((item) => item.kind === "unit-enter").length, 0)
        checks.push("duplicate-and-tardy-thunk-never-replay", "mechanism-result-and-swallowed-error-not-authoritative",
          "before-noinvoke-after-faults-preserve-work", "fallback-disables-attribution")
      } else if (mode === "foreign-noop" || mode === "get-store") {
        let calls = 0
        observer.runSfE13Observation(handle, request, () => {
          const parent = observer.enterSfE13Unit("port"); assert.ok(parent)
          if (mode === "foreign-noop") installRun(function (_token, callback) {
            assert.ok(typeof callback === "function")
            return apply(callback, undefined, [])
          })
          else define(AsyncLocalStorage.prototype, "getStore", { ...savedGet, value: () => { throw undefined } })
          const value = {}
          assert.equal(observer.runSfE13Observation(handle, mode === "foreign-noop" ? foreign : request, () => {
            calls++
            assert.equal(observer.enterSfE13Unit("compare"), undefined)
            return value
          }), value)
          define(AsyncLocalStorage.prototype, "run", savedRun)
          define(AsyncLocalStorage.prototype, "getStore", savedGet)
          assert.equal(observer.enterSfE13Unit("compare"), undefined)
          observer.finishSfE13Unit(parent, false)
        })
        observer.finishSfE13Observation(handle, request, false)
        assert.equal(calls, 1)
        const terminal = one("request-close")
        assert.equal(terminal.scopeDisabled, true); assert.equal(terminal.scopeFault, true)
        assert.equal(terminal.openUnits, 1)
        assert.equal(rows().filter((item) => item.kind === "unit-enter").length, 1)
        checks.push(mode === "foreign-noop" ? "nested-foreign-noop-does-not-inherit-selected" : "getstore-fault-disables-before-work",
          "restore-cannot-reenable-attribution")
      } else if (mode === "output") {
        writeFalse = true
        observer.markSfE13Http(handle, request, "body-returned")
        writeFalse = false
        const beforeThrow = stdoutAttempts
        writeThrow = true
        const value = {}
        assert.equal(observer.runSfE13Observation(handle, request, () => { observer.markSfE13Http(handle, request, "admit-returned"); return value }), value)
        writeThrow = false
        assert.equal(stdoutAttempts, beforeThrow + 1)
        define(JSON, "stringify", { configurable: true, writable: true, value: () => { throw undefined } })
        let threw = false, caught: unknown = value
        try { observer.runSfE13Observation(handle, request, () => { observer.markSfE13Http(handle, request, "case-callback-entered"); throw undefined }) }
        catch (error) { threw = true; caught = error }
        define(JSON, "stringify", savedStringify)
        assert.equal(threw, true); assert.equal(caught, undefined)
        invalidClock = true
        observer.markSfE13Http(handle, request, "with-case-returned")
        invalidClock = false
        observer.finishSfE13Observation(handle, request, true)
        const terminal = one("request-close")
        assert.equal(terminal.outcome, "rejected")
        assert.equal(terminal.backpressureBefore, true)
        assert.equal(terminal.emissionFaultBefore, true)
        assert.equal(terminal.clockFault, true)
        assert.equal(rows().find((item) => item.point === "with-case-returned")?.elapsedTenthMs, null)
        const disk = readFileSync(eventFile, "utf8")
        assert.ok(disk.includes('"point":"admit-returned"'))
        assert.equal(lines.some((line) => line.includes('"point":"admit-returned"')), false)
        assert.equal(disk.includes('"point":"case-callback-entered"'), false)
        checks.push("write-false-consumed-once-without-replay", "writer-serializer-clock-faults-preserve-product",
          "stdout-loss-not-promoted-to-complete-stream")
      } else if (mode === "overflow") {
        const value = {}
        let phaseCalls = 0
        observer.runSfE13Observation(handle, request, () => {
          const parent = observer.enterSfE13Unit("port"); assert.ok(parent)
          for (let index = 0; index < 600; index++) {
            assert.equal(observer.runSfE13Phase(parent, "combination-evaluate", () => { phaseCalls++; return value }), value)
            assert.equal(observer.returnedSfE13Await(parent, value), value)
          }
          observer.finishSfE13Unit(parent, false)
        })
        assert.equal(phaseCalls, 600)
        observer.finishSfE13Observation(handle, request, false)
        const terminal = one("request-close")
        assert.equal(terminal.overflow, true)
        assert.ok(typeof terminal.dropped === "number" && terminal.dropped > 0 && terminal.dropped <= 65_535)
        assert.equal(rows().filter((item) => item.kind === "overflow").length, 1)
        assert.ok(lines.length <= 511)
        assert.ok(Buffer.byteLength(lines.join(""), "utf8") <= 261_120)
        assert.equal(rows().at(-1)?.kind, "request-close")
        checks.push("event-byte-reserves-survive-overflow", "work-and-tap-identities-survive-capacity")
      }
      const all = rows(), disk = readFileSync(eventFile, "utf8")
      assert.equal(all.at(-1)?.kind, "request-close")
      assert.equal(all.filter((item) => item.kind === "request-close").length, 1)
      assert.ok(lines.length <= 511 && Buffer.byteLength(lines.join(""), "utf8") <= 261_120)
      for (let index = 1; index < all.length; index++) {
        const previous = all[index - 1]!.sequence, current = all[index]!.sequence
        assert.ok(typeof previous === "number" && typeof current === "number" && current > previous)
      }
      if (mode !== "output") {
        assert.equal(disk, lines.join(""))
        assert.deepEqual(all.map((item) => item.sequence), all.map((_item, index) => index + 1))
      }
      assert.equal(statSync(eventFile).mode & 0o777, 0o600)
      assert.ok(Buffer.byteLength(disk, "utf8") <= 261_120)
      const terminal = one("request-close")
      const closedCount = lines.length
      observer.markSfE13Http(handle, request, "egress-passed"); observer.finishSfE13Observation(handle, request, false)
      assert.equal(observer.startSfE13Observation(request), undefined)
      assert.equal(lines.length, closedCount)
      finalReceipt = { schema: "sf-preview-e13-control-child-v1", mode, pid: process.pid, synthetic: true, checks,
        records: all.length, stdoutAttempts, stdoutBytes: Buffer.byteLength(lines.join(""), "utf8"), stdoutSha256: sha256(lines.join("")),
        fileBytes: Buffer.byteLength(disk, "utf8"), fileSha256: sha256(disk), terminal }
    }
    assert.equal(requestGets, 0)
    if (!finalReceipt) finalReceipt = { schema: "sf-preview-e13-control-child-v1", mode, pid: process.pid, synthetic: true, checks, records: 0, requestGets }
    else finalReceipt.requestGets = requestGets
  } finally {
    restore(AsyncLocalStorage.prototype, "run", savedRun)
    restore(AsyncLocalStorage.prototype, "getStore", savedGet)
    restore(performance, "now", savedNow)
    restore(process.stdout, "write", savedWrite)
    define(JSON, "stringify", savedStringify)
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
  const mode = e13Modes.find((value) => value === process.argv[2])
  assert.ok(mode)
  const receipt = await child(mode)
  process.stdout.write(JSON.stringify(receipt) + "\n")
}
