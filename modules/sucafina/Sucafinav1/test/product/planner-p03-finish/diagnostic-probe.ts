import { spyOn } from "bun:test"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import type { Persistence } from "../../../runtime/contract.ts"
import type { AssetPersistence } from "../../../runtime/assets.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"

type Counter = { calls: number; completed: number; errors: number; inclusiveMs: number; maximumMs: number }
type PrimitiveCounter = Counter & { exclusiveMeasuredMs: number }

/** Transparent observers only: native primitive arguments, return values and errors are unchanged. */
export async function installCanonicalReadDiagnostic() {
  const canonical = await import("../../../product/contracts/canonical.ts")
  const originalDigest = canonical.digestSfValue
  const originalClone = globalThis.structuredClone
  const scopes = new AsyncLocalStorage<{ phase: string; path: string[] }>()
  const calls: Record<string, Counter> = {}
  const primitives: Record<string, PrimitiveCounter> = {}
  const stack: { childMs: number }[] = []
  const order = createHash("sha256")
  const examples: string[] = []
  const memory: Record<string, { before: NodeJS.MemoryUsage; after: NodeJS.MemoryUsage }> = {}
  const spyHistory = {
    entryInvocations: 0, entryCallsHighWater: 0, entryResultsHighWater: 0,
    phaseClears: 0, reportClears: 0, checkpointCallsHighWater: 0, checkpointResultsHighWater: 0,
    residualCallsHighWater: 0, residualResultsHighWater: 0, residualCalls: 0, residualResults: 0,
    pendingAtClearHighWater: 0,
  }
  const restores: (() => void)[] = []
  let events = 0
  let stackCaptureMs = 0
  let pending = 0
  let restored = false
  const counter = (): Counter => ({ calls: 0, completed: 0, errors: 0, inclusiveMs: 0, maximumMs: 0 })
  const event = (name: string) => {
    events++
    order.update(name).update("\n")
    if (examples.length < 80) examples.push(name)
  }
  const call = <T>(name: string, work: () => T): T => {
    const scope = scopes.getStore()
    if (!scope) return work()
    const key = `${scope.phase}|${scope.path.at(-1) ?? "root"}>${name}`
    const row = calls[key] ??= counter()
    row.calls++
    event(`enter:${key}`)
    const started = performance.now()
    const complete = (failed: boolean) => {
      const elapsed = performance.now() - started
      row.completed++
      row.errors += Number(failed)
      row.inclusiveMs += elapsed
      row.maximumMs = Math.max(row.maximumMs, elapsed)
      event(`${failed ? "reject" : "exit"}:${key}`)
    }
    return scopes.run({ phase: scope.phase, path: [...scope.path, name] }, () => {
      try {
        const value = work()
        if (value instanceof Promise) {
          pending++
          // Observe settlement without returning a substituted production Promise.
          void value.then(() => { pending--; complete(false) }, () => { pending--; complete(true) })
          return value
        }
        complete(false)
        return value
      } catch (error) { complete(true); throw error }
    })
  }
  const primitive = <T>(name: string, work: () => T): T => {
    const scope = scopes.getStore()
    if (!scope) return work()
    const capture = performance.now()
    const location = (new Error().stack ?? "").split("\n").map((line) =>
      line.match(/((?:product|runtime|src|test)\/[^():\n]+\.ts:\d+:\d+)/)?.[1])
      .find((line) => line && !line.includes("planner-p03-finish/diagnostic-")) ?? "unattributed"
    stackCaptureMs += performance.now() - capture
    const key = `${scope.phase}|${scope.path.at(-1) ?? "root"}|${name}|${location}`
    const row = primitives[key] ??= { ...counter(), exclusiveMeasuredMs: 0 }
    row.calls++
    const frame = { childMs: 0 }
    stack.push(frame)
    const started = performance.now()
    try { return work() }
    catch (error) { row.errors++; throw error }
    finally {
      const elapsed = performance.now() - started
      stack.pop()
      if (stack.length) stack[stack.length - 1]!.childMs += elapsed
      row.completed++
      row.inclusiveMs += elapsed
      row.exclusiveMeasuredMs += elapsed - frame.childMs
      row.maximumMs = Math.max(row.maximumMs, elapsed)
    }
  }
  const clone: typeof structuredClone = function (this: unknown, ...args: Parameters<typeof structuredClone>) {
    return primitive("structuredClone", () => Reflect.apply(originalClone, this, args))
  } as typeof structuredClone
  // ESM live-import spying observes the entire canonicalization plus SHA256 call.
  // Every invocation calls the saved implementation exactly once, including throws.
  const digest = spyOn(canonical, "digestSfValue").mockImplementation((value) => {
    // Bun records spy arguments/results even when this observer does not. Drop
    // prior call history before timing, preserving the installed implementation.
    spyHistory.entryInvocations++
    spyHistory.entryCallsHighWater = Math.max(spyHistory.entryCallsHighWater, digest.mock.calls.length)
    spyHistory.entryResultsHighWater = Math.max(spyHistory.entryResultsHighWater, digest.mock.results.length)
    digest.mockClear()
    return primitive("digestSfValue", () => originalDigest(value))
  })
  globalThis.structuredClone = clone
  const clearHistory = (checkpoint: "phase" | "report") => {
    spyHistory.checkpointCallsHighWater = Math.max(spyHistory.checkpointCallsHighWater, digest.mock.calls.length)
    spyHistory.checkpointResultsHighWater = Math.max(spyHistory.checkpointResultsHighWater, digest.mock.results.length)
    spyHistory.pendingAtClearHighWater = Math.max(spyHistory.pendingAtClearHighWater, pending)
    digest.mockClear()
    spyHistory.residualCalls = digest.mock.calls.length
    spyHistory.residualResults = digest.mock.results.length
    spyHistory.residualCallsHighWater = Math.max(spyHistory.residualCallsHighWater, spyHistory.residualCalls)
    spyHistory.residualResultsHighWater = Math.max(spyHistory.residualResultsHighWater, spyHistory.residualResults)
    if (checkpoint === "phase") spyHistory.phaseClears++
    if (checkpoint === "report") spyHistory.reportClears++
  }

  return {
    call,
    onRestore(restore: () => void) { restores.push(restore) },
    async phase<T>(name: string, work: () => Promise<T>): Promise<T> {
      if (restored || scopes.getStore()) throw new Error("Diagnostic phases must be awaited and non-overlapping")
      const before = process.memoryUsage()
      try { return await scopes.run({ phase: name, path: [] }, () => call(`phase.${name}`, work)) }
      finally {
        clearHistory("phase")
        memory[name] = { before, after: process.memoryUsage() }
      }
    },
    state(port: SfProductStatePort, label: string) {
      const read = port.read
      const transaction = port.transaction
      const invokeRead = read.bind(port)
      const invokeTransaction = transaction.bind(port)
      const observedRead: SfProductStatePort["read"] = (request, namespace, reader) =>
        call(`${label}.read.${namespace}`, () => invokeRead(request, namespace, reader))
      const observedTransaction: SfProductStatePort["transaction"] = (request, command, work) =>
        call(`${label}.transaction.${command.namespace}`, () => invokeTransaction(request, command, work))
      // Keep reader/work identities: C08 selector and write provenance use WeakMaps/Sets.
      port.read = observedRead
      port.transaction = observedTransaction
      restores.push(() => {
        if (port.read === observedRead) port.read = read
        if (port.transaction === observedTransaction) port.transaction = transaction
      })
    },
    persistence(port: AssetPersistence & Pick<Persistence, "currentSnapshots" | "readSnapshotRoot">) {
      const transaction = port.transaction
      const invoke = transaction.bind(port)
      const observed: AssetPersistence["transaction"] = (surface, work, options) =>
        call(`persistence.transaction.${surface}`, () => invoke(surface, (snapshot, blobs) =>
          call(`persistence.callback.${surface}`, () => work(snapshot, blobs)), options))
      port.transaction = observed
      restores.push(() => { if (port.transaction === observed) port.transaction = transaction })
      const snapshots = port.currentSnapshots
      if (snapshots) {
        const observe = () => call("persistence.currentSnapshots", () => snapshots.call(port))
        port.currentSnapshots = observe
        restores.push(() => { if (port.currentSnapshots === observe) port.currentSnapshots = snapshots })
      }
      const root = port.readSnapshotRoot
      if (root) {
        const invokeRoot = root.bind(port)
        const observe: NonNullable<Persistence["readSnapshotRoot"]> = (work, options) =>
          call("persistence.readSnapshotRoot", () => invokeRoot(work, options))
        port.readSnapshotRoot = observe
        restores.push(() => { if (port.readSnapshotRoot === observe) port.readSnapshotRoot = root })
      }
    },
    snapshot() {
      clearHistory("report")
      return {
        calls, primitives, callbackOrder: { events, sha256: order.copy().digest("hex"), firstEvents: [...examples] },
        memory, stackCaptureMs, pending, spyHistory: { ...spyHistory },
        limits: [
          "Public call durations overlap; do not sum them as exclusive CPU.",
          "Method counters observe public boundary calls; closure-internal calls are represented by primitive source callsites, not wrapped function counts.",
          "Primitive timing surrounds exactly the saved synchronous implementation. Stack capture is outside that timing.",
          "exclusiveMeasuredMs subtracts nested measured primitive time; nested probe bookkeeping remains overhead.",
          "The observer does not inspect, serialize or additionally clone payloads. Bun spy history is cleared before each digest; its framework may retain the current invocation until the next clear.",
          "Spy-history high-water and residual counts inspect array lengths only; clear runs before native primitive timing, after each awaited phase before its memory snapshot, and before the report snapshot. Zero residuals do not establish zero in-flight retention.",
          "Memory snapshots describe the whole observed process, including instrumentation and GC effects; they do not establish product heap, peak allocation or retained-heap bounds. No forced GC.",
          "This is bounded producer diagnosis, not P03 or a speed-ratio assertion.",
        ],
      }
    },
    restore() {
      if (restored) return
      restores.reverse().forEach((restore) => restore())
      digest.mockRestore()
      if (globalThis.structuredClone === clone) globalThis.structuredClone = originalClone
      restored = true
    },
  }
}
