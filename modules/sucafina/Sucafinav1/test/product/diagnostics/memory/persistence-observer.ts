import { AsyncLocalStorage } from "node:async_hooks"
import type { AssetPersistence } from "../../../../runtime/assets.ts"
import type { LocalStore } from "../../../../runtime/local-contract.ts"
import type { Persistence } from "../../../../runtime/contract.ts"

export type MemoryPersistenceCounters = {
  persistenceCalls: number
  rootPersistenceCalls: number
  nestedPersistenceCalls: number
}
export type MemoryPersistenceObserverMode = "snapshots" | "callback-scope"
type CallbackScope = { open: boolean; signal?: AbortSignal; parent?: CallbackScope }

/** Diagnostic observer, never an authorization or result cache.
 * Submit-to-callback includes admission, connection and snapshot setup, not just lock wait.
 * Callback time is inclusive of children. Do not sum nested/parent totals as wall time.
 * The default reproduces the W26 classifier once per invocation. The opt-in mode
 * skips only its snapshot copies while an observed real driver callback is active.
 * Use the returned driver throughout the observed fixture; raw-driver child callbacks
 * have no observer marker. The actual driver remains responsible for scope checks.
 */
export function observeMemoryPersistence(source: LocalStore, counters: MemoryPersistenceCounters,
  mode: MemoryPersistenceObserverMode = "snapshots") {
  const callbacks = new AsyncLocalStorage<CallbackScope>()
  const totals = {
    scopeInspectionCalls: 0, scopeInspectionErrors: 0, scopeInspectionMs: 0,
    rootCallbackCalls: 0, rootCallbackErrors: 0, rootErrors: 0, rootRejectedBeforeCallback: 0,
    rootSubmitToCallbackMs: 0, rootCallbackInclusiveMs: 0, rootAfterCallbackMs: 0, rootRejectedBeforeCallbackMs: 0,
    nestedCallbackCalls: 0, nestedCallbackErrors: 0, nestedErrors: 0, nestedRejectedBeforeCallback: 0,
    nestedSubmitToCallbackMs: 0, nestedCallbackInclusiveMs: 0, nestedAfterCallbackMs: 0, nestedRejectedBeforeCallbackMs: 0,
  }
  const scopeCurrent = (scope: CallbackScope): boolean => scope.open && !scope.signal?.aborted &&
    (!scope.parent || scopeCurrent(scope.parent))
  const classify = () => {
    const scope = callbacks.getStore()
    if (mode === "callback-scope" && scope && scopeCurrent(scope)) return true
    // In particular, an expired inherited marker delegates to the real accessor:
    // its original synchronous expired-scope/abort error must not be hidden.
    const started = performance.now()
    totals.scopeInspectionCalls += 1
    try { return source.currentSnapshots?.() !== undefined }
    catch (error) { totals.scopeInspectionErrors += 1; throw error }
    finally { totals.scopeInspectionMs += performance.now() - started }
  }
  const observe = <Value>(submit: (inside: <Result>(work: () => Promise<Result>) => Promise<Result>) => Promise<Value>,
    signal?: AbortSignal): Promise<Value> => {
    counters.persistenceCalls += 1
    const kind = classify() ? "nested" : "root"
    counters[kind === "nested" ? "nestedPersistenceCalls" : "rootPersistenceCalls"] += 1
    // Classification is measured separately and excluded from submission buckets.
    const submitted = performance.now()
    let entered = false
    let callbackEnded: number | undefined
    const inside = <Result>(work: () => Promise<Result>): Promise<Result> => {
      const started = performance.now()
      entered = true
      totals[`${kind}CallbackCalls`] += 1
      totals[`${kind}SubmitToCallbackMs`] += started - submitted
      const scope: CallbackScope = { open: true, signal, parent: callbacks.getStore() }
      return callbacks.run(scope, async () => {
        try { return await work() }
        catch (error) { totals[`${kind}CallbackErrors`] += 1; throw error }
        finally {
          scope.open = false
          callbackEnded = performance.now()
          totals[`${kind}CallbackInclusiveMs`] += callbackEnded - started
        }
      })
    }
    const settle = (failed: boolean) => {
      const ended = performance.now()
      if (failed) totals[`${kind}Errors`] += 1
      if (!entered && failed) {
        totals[`${kind}RejectedBeforeCallback`] += 1
        totals[`${kind}RejectedBeforeCallbackMs`] += ended - submitted
      }
      if (callbackEnded !== undefined) totals[`${kind}AfterCallbackMs`] += ended - callbackEnded
    }
    try {
      return submit(inside).then((value) => { settle(false); return value },
        (error: unknown) => { settle(true); throw error })
    } catch (error) { settle(true); throw error }
  }
  const transaction: AssetPersistence["transaction"] = (surface, work, options) =>
    observe((inside) => source.transaction(surface, (snapshot, blobs) => inside(() => work(snapshot, blobs)), options), options?.signal)
  const transactionAll = source.transactionAll
  const all: Persistence["transactionAll"] = transactionAll ? (work, options) =>
    observe((inside) => transactionAll((snapshots) => inside(() => work(snapshots)), options), options?.signal) : undefined
  const driver: LocalStore = { ...source, transaction, ...(all ? { transactionAll: all } : {}) }
  const snapshot = () => ({
    persistenceCalls: counters.persistenceCalls, rootPersistenceCalls: counters.rootPersistenceCalls,
    nestedPersistenceCalls: counters.nestedPersistenceCalls, ...totals,
  })
  const delta = (before: ReturnType<typeof snapshot>) => {
    const after = snapshot()
    return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key as keyof typeof before]]))
  }
  return { driver, mode, snapshot, delta }
}
