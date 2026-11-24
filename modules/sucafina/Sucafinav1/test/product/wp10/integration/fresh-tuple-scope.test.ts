import { expect, test } from "bun:test"
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks"
import { createSfFreshTupleDigest, runSfFreshTupleRead } from "../../../../product/host-binding/fresh-tuple-digest.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Family = "finance" | "case" | "recall"
type Lease = ReturnType<typeof createSfFreshTupleDigest>
type Outcome<Value> = { ok: true; value: Value } | { ok: false; error: unknown }

const families: readonly Family[] = ["finance", "case", "recall"]
const originalDescriptor = Object.getOwnPropertyDescriptor
const originalDefine = Object.defineProperty
const originalDelete = Reflect.deleteProperty

function observe<Value>(read: () => Value): Outcome<Value> {
  try { return { ok: true, value: read() } }
  catch (error) { return { ok: false, error } }
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((complete) => { resolve = complete })
  return { promise, resolve }
}

function tuple(version = 1) {
  return {
    state: { cases: { selected: { version, value: [0, -0, null, undefined] } }, preferences: { entries: ["service", "training"] } },
    snapshots: { dashboard: { revision: version }, planner: { amount: 120 + version }, procurement: { version: 3 } },
    sources: { planner: "source-" + version, procurement: "source-3" },
  }
}

function withDataMethod<Value>(owner: object, key: PropertyKey, value: unknown, read: () => Value): Value {
  const previous = originalDescriptor(owner, key)
  if (previous && !("value" in previous)) throw new Error("Expected an original data method")
  originalDefine(owner, key, previous ? { ...previous, value } : { configurable: true, writable: true, value })
  try { return read() }
  finally {
    if (previous) originalDefine(owner, key, previous)
    else originalDelete(owner, key)
  }
}

test("Pure read scopes invoke the original body once and preserve value, Promise and error identity", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-scope-return", 12_000)
  const counts = { sync: 0, pending: 0, syncFailure: 0, asyncFailure: 0 }
  const gate = deferred<void>()
  try {
    const value = { original: "owned result" }
    const direct = runSfFreshTupleRead((close) => {
      counts.sync++
      try { return value }
      finally { close(); close() }
    })
    expect(direct).toBe(value)
    const captured: { promise?: Promise<typeof value> } = {}
    const pending = runSfFreshTupleRead((close) => {
      counts.pending++
      const original = (async () => {
        try { await gate.promise; deadline.check(); return value }
        finally { close() }
      })()
      captured.promise = original
      return original
    })
    expect(pending).toBe(captured.promise)
    expect(counts).toEqual({ sync: 1, pending: 1, syncFailure: 0, asyncFailure: 0 })
    gate.resolve(undefined)
    expect(await pending).toBe(value)

    const failure = new Error("Original synchronous read failure")
    const failed = observe(() => runSfFreshTupleRead((close) => {
      counts.syncFailure++
      try { throw failure }
      finally { close() }
    }))
    expect(failed.ok).toBe(false)
    if (failed.ok) throw new Error("Expected the original synchronous failure")
    expect(failed.error).toBe(failure)

    const asyncFailure = new Error("Original asynchronous read failure")
    const rejected: { promise?: Promise<never> } = {}
    const returned = runSfFreshTupleRead((close) => {
      counts.asyncFailure++
      const original = (async () => {
        try { await Promise.resolve(); throw asyncFailure }
        finally { close() }
      })()
      rejected.promise = original
      return original
    })
    expect(returned).toBe(rejected.promise)
    const error = await returned.then(() => undefined, (caught: unknown) => caught)
    expect(error).toBe(asyncFailure)
    expect(counts).toEqual({ sync: 1, pending: 1, syncFailure: 1, asyncFailure: 1 })
  } finally { gate.resolve(undefined); await deadline.close() }
}, 15_000)

test("Pure tuple families preserve fresh values across nested reads, concurrent siblings and closed leases", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-scope-lifetime", 12_000)
  const ready = deferred<void>(), release = deferred<void>()
  const leases: Lease[] = []
  const resources: AsyncResource[] = []
  const retained: { close?: () => void; lease?: Lease; child?: Lease; resource?: AsyncResource } = {}
  let first: Promise<void> | undefined
  try {
    const base = tuple(), expected = digestSfValue(base)
    await runSfFreshTupleRead(async (close) => {
      try {
        const parent = createSfFreshTupleDigest("finance")
        leases.push(parent)
        expect(parent.digest(base)).toBe(expected)
        parent.close()
        const sibling = createSfFreshTupleDigest("finance")
        leases.push(sibling)
        expect(sibling.digest(structuredClone(base))).toBe(expected)

        await runSfFreshTupleRead(async (closeChild) => {
          try {
            for (const family of families) {
              const child = createSfFreshTupleDigest(family)
              leases.push(child)
              const fresh = tuple(2)
              expect(child.digest(fresh)).toBe(digestSfValue(fresh))
              await Promise.resolve()
              fresh.snapshots.planner.amount = 900
              fresh.state.cases.selected.version = 3
              expect(child.digest(fresh)).toBe(digestSfValue(fresh))
              expect(child.digest(tuple())).toBe(expected)
              child.close()
            }
            // The still-open parent lease is foreign to this child token.
            const foreign = tuple(5)
            expect(sibling.digest(foreign)).toBe(digestSfValue(foreign))
            foreign.sources.planner = "changed inside the foreign child"
            expect(sibling.digest(foreign)).toBe(digestSfValue(foreign))
          } finally { closeChild() }
        })

        expect(sibling.digest(tuple())).toBe(expected)
        const changed = tuple(4)
        expect(sibling.digest(changed)).toBe(digestSfValue(changed))
        expect(parent.digest(changed)).toBe(digestSfValue(changed))
        retained.lease = sibling
        retained.close = close
        retained.resource = new AsyncResource("sf-tuple-read-retained")
        resources.push(retained.resource)
      } finally { close() }
    })

    retained.close?.()
    const after = tuple(7)
    expect(retained.lease).toBeDefined()
    expect(retained.resource).toBeDefined()
    expect(retained.resource!.runInAsyncScope(() => retained.lease!.digest(after))).toBe(digestSfValue(after))

    first = runSfFreshTupleRead(async (close) => {
      try {
        const lease = createSfFreshTupleDigest("case")
        leases.push(lease)
        retained.child = lease
        expect(lease.digest(tuple(11))).toBe(digestSfValue(tuple(11)))
        ready.resolve(undefined)
        await release.promise
        deadline.check()
        const changed = tuple(12)
        expect(lease.digest(changed)).toBe(digestSfValue(changed))
        expect(lease.digest(tuple(11))).toBe(digestSfValue(tuple(11)))
      } finally { close() }
    }).finally(() => ready.resolve(undefined))
    await ready.promise

    await runSfFreshTupleRead(async (close) => {
      try {
        for (const family of families) {
          const lease = createSfFreshTupleDigest(family)
          leases.push(lease)
          const changed = tuple(20)
          expect(lease.digest(changed)).toBe(digestSfValue(changed))
          changed.sources.planner = "changed while the other read is pending"
          expect(lease.digest(changed)).toBe(digestSfValue(changed))
        }
        // The first read is still pending: its open lease cannot borrow this token.
        const foreign = tuple(23)
        expect(retained.child!.digest(foreign)).toBe(digestSfValue(foreign))
        foreign.snapshots.planner.amount = 2300
        expect(retained.child!.digest(foreign)).toBe(digestSfValue(foreign))
        await Promise.resolve()
      } finally { close() }
    })
    release.resolve(undefined)
    await first
    expect(retained.child!.digest(tuple(22))).toBe(digestSfValue(tuple(22)))

    const parentEnded = deferred<void>(), childContinue = deferred<void>()
    let detached: Promise<string> | undefined
    try {
      const parent = runSfFreshTupleRead((close) => {
        const lease = createSfFreshTupleDigest("recall")
        leases.push(lease)
        expect(lease.digest(tuple(30))).toBe(digestSfValue(tuple(30)))
        detached = (async () => {
          parentEnded.resolve(undefined)
          await childContinue.promise
          return lease.digest(tuple(31))
        })()
        close()
        return "parent-closed"
      })
      expect(parent).toBe("parent-closed")
      await parentEnded.promise
      childContinue.resolve(undefined)
      expect(await detached).toBe(digestSfValue(tuple(31)))
    } finally { parentEnded.resolve(undefined); childContinue.resolve(undefined); await detached }
  } finally {
    release.resolve(undefined)
    ready.resolve(undefined)
    try { await first }
    finally {
      for (const lease of leases) lease.close()
      for (const resource of resources) resource.emitDestroy()
      await deadline.close()
    }
  }
}, 15_000)

test("Scoped families retain original opaque reads, failures and reentrancy without post-hash admission", async () => {
  const deadline = compositionTestDeadline("fresh-tuple-scope-opaque", 12_000)
  const leases: Lease[] = []
  try {
    runSfFreshTupleRead((close) => {
      try {
        const first = createSfFreshTupleDigest("finance"), second = createSfFreshTupleDigest("finance")
        leases.push(first, second)
        const original = tuple()
        expect(first.digest(original)).toBe(digestSfValue(original))
        expect(second.digest(structuredClone(original))).toBe(digestSfValue(original))

        const counts = { get: 0, keys: 0, descriptor: 0, prototype: 0 }
        const proxy = new Proxy({ first: 1, nested: { amount: 2 } }, {
          get: (target, key, receiver) => { counts.get++; return Reflect.get(target, key, receiver) },
          ownKeys: (target) => { counts.keys++; return Reflect.ownKeys(target) },
          getOwnPropertyDescriptor: (target, key) => { counts.descriptor++; return originalDescriptor(target, key) },
          getPrototypeOf: (target) => { counts.prototype++; return Object.getPrototypeOf(target) },
        })
        const canonical = digestSfValue(proxy), expectedCounts = { ...counts }
        counts.get = 0; counts.keys = 0; counts.descriptor = 0; counts.prototype = 0
        expect(second.digest(proxy)).toBe(canonical)
        expect(counts).toEqual(expectedCounts)

        const getterCounts = { alias: 0, error: 0, outer: 0, inner: 0, removal: 0 }
        const shared = { get amount() { getterCounts.alias++; return 19 } }
        expect(first.digest({ a: shared, b: shared })).toBe(digestSfValue({ a: { amount: 19 }, b: { amount: 19 } }))
        expect(getterCounts.alias).toBe(2)
        const failure = new Error("Original scoped getter failure")
        const failed = observe(() => second.digest({ get value() { getterCounts.error++; throw failure } }))
        expect(failed.ok).toBe(false)
        if (failed.ok) throw new Error("Expected original scoped getter failure")
        expect(failed.error).toBe(failure)
        expect(getterCounts.error).toBe(1)

        const inner = { get value() { getterCounts.inner++; return 21 } }
        const outer = { get value() { getterCounts.outer++; return second.digest(inner) } }
        expect(first.digest(outer)).toBe(digestSfValue({ value: digestSfValue({ value: 21 }) }))
        expect(getterCounts.outer).toBe(1)
        expect(getterCounts.inner).toBe(1)

        const changing: Record<string, unknown> = { stable: 1 }
        originalDefine(changing, "ephemeral", { enumerable: true, configurable: true, get: () => {
          getterCounts.removal++
          originalDelete(changing, "ephemeral")
          changing.stable = 2
          return "observed once"
        } })
        const before = digestSfValue({ ephemeral: "observed once", stable: 2 }), after = digestSfValue({ stable: 2 })
        expect(first.digest(changing)).toBe(before)
        expect(getterCounts.removal).toBe(1)
        expect(second.digest(changing)).toBe(after)
        expect(after).not.toBe(before)

        const cycle: { current?: unknown } = {}
        cycle.current = cycle
        const canonicalCycle = observe(() => digestSfValue(cycle))
        const scopedCycle = observe(() => second.digest(cycle))
        expect(canonicalCycle.ok).toBe(false)
        expect(scopedCycle.ok).toBe(false)
        if (canonicalCycle.ok || scopedCycle.ok) throw new Error("Expected original cycle refusal")
        expect(scopedCycle.error instanceof Error && scopedCycle.error.name)
          .toBe(canonicalCycle.error instanceof Error && canonicalCycle.error.name)
        expect(scopedCycle.error instanceof Error && scopedCycle.error.message)
          .toBe(canonicalCycle.error instanceof Error && canonicalCycle.error.message)

        const different = tuple(40)
        expect(first.digest(different)).toBe(digestSfValue(different))
        const closer = { get value() { close(); return second.digest(tuple(41)) } }
        expect(first.digest(closer)).toBe(digestSfValue({ value: digestSfValue(tuple(41)) }))
        expect(first.digest(tuple(42))).toBe(digestSfValue(tuple(42)))
        expect(second.digest(tuple(43))).toBe(digestSfValue(tuple(43)))
      } finally { close() }
    })
    await Promise.resolve()
    deadline.check()
    runSfFreshTupleRead((close) => {
      const recovered = createSfFreshTupleDigest("finance")
      leases.push(recovered)
      try {
        expect(recovered.digest(tuple())).toBe(digestSfValue(tuple()))
        expect(recovered.digest(tuple(44))).toBe(digestSfValue(tuple(44)))
      } finally { close() }
    })
  } finally { for (const lease of leases) lease.close(); await deadline.close() }
}, 15_000)
