import { expect, test } from "bun:test"
import type { SfProductState, SfStateAuthority } from "../../../product/contracts/state.ts"
import { selectSfDecisionResult } from "../../../product/host-binding/state-provider.ts"
import { createCalculationFixture } from "../planner-p03-finish/calculation-fixture.ts"

test("C08 selected result reads detach cases/results without traversing unrelated SQLite root maps", async () => {
  const f = await createCalculationFixture()
  const transaction = f.fixture.store.transaction
  const visit = { unrelated: 0 }
  try {
    // Instrument only a detached per-read SQLite snapshot. The returning
    // transaction is commit=false, so no accessor is written to persistence.
    f.fixture.store.transaction = (surface, work, options) => transaction(surface, async (snapshot, blobs) => {
      if (surface === "dashboard") {
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (state?.preferences) Object.defineProperty(state.preferences, "__p03_unrelated__", {
          configurable: true, enumerable: true,
          get: () => { visit.unrelated++; return { rootOnly: true } },
        })
      }
      return work(snapshot, blobs)
    }, options)
    const request = f.fixture.request
    const context = f.fixture.context
    const selector = selectSfDecisionResult(f.original.resultRef, context)
    const fullClone = (state: Parameters<typeof selector>[0], authority: Parameters<typeof selector>[1]) => selector(state, authority)
    const initial = await f.settings.state.read(request, "cases", fullClone)
    const fullTraversal = visit.unrelated
    const selected = await f.settings.state.read(request, "cases", selector)
    expect(selected).toEqual(initial)
    expect(fullTraversal).toBeGreaterThan(0)
    expect(visit.unrelated).toBe(fullTraversal)
    expect(initial.status).toBe("ok")
    expect(selected.status).toBe("ok")
    if (initial.status !== "ok" || selected.status !== "ok" || !initial.value?.stored || !selected.value?.stored ||
      initial.value.stored.kind !== "scenario" || selected.value.stored.kind !== "scenario") throw new Error("C08 result observation unavailable")
    expect(selected.value.stored).not.toBe(initial.value.stored)
    expect(selected.value.current).not.toBe(initial.value.current)
    selected.value.stored.result.knownSubtotal = -928000
    const later = await f.settings.state.read(request, "cases", selectSfDecisionResult(f.original.resultRef, context))
    expect(later).toEqual(initial)
    expect(visit.unrelated).toBe(fullTraversal)
    expect(f.trace.reads).toBeGreaterThanOrEqual(3)
  } finally {
    f.fixture.store.transaction = transaction
    await f.cleanup()
  }
}, 60000)

test("C08 selected result fallback preserves accessor effects, noncloneable failure and current authority", async () => {
  const f = await createCalculationFixture()
  const transaction = f.fixture.store.transaction
  const getter = { calls: 0, unsupported: false }
  try {
    const context = f.fixture.context
    const request = f.fixture.request
    const ref = f.original.resultRef
    f.fixture.store.transaction = (surface, work, options) => transaction(surface, async (snapshot, blobs) => {
      if (surface === "dashboard") {
        const root = snapshot.data.__sfProductV1 as SfProductState
        const stored = root.decisionResults?.[ref]
        if (stored && root.decisionResults) Object.defineProperty(root.decisionResults, ref, {
          configurable: true, enumerable: true, get: () => {
            getter.calls++
            return getter.unsupported ? () => "uncloneable" : stored
          },
        })
      }
      return work(snapshot, blobs)
    }, options)
    const result = await f.settings.state.read(request, "cases", selectSfDecisionResult(ref, context))
    expect(result.status).toBe("ok")
    expect(getter.calls).toBe(1)
    if (result.status !== "ok") throw new Error("Selected result missing")
    getter.unsupported = true
    await expect(f.settings.state.read(request, "cases", selectSfDecisionResult(ref, context))).rejects.toThrow()
    expect(getter.calls).toBe(2)
    getter.unsupported = false
    const mutable = { ...context, binding: { ...context.binding } }
    const selected = selectSfDecisionResult(ref, mutable)
    mutable.binding.principalRef = "outsider"
    const denied = await f.settings.state.read(request, "cases", selected)
    expect(denied).toMatchObject({ status: "ok", value: undefined })
    expect(getter.calls).toBe(3)
    f.fixture.store.transaction = transaction
    const fresh = await f.settings.state.read(request, "cases", selectSfDecisionResult(ref, context))
    expect(fresh.status).toBe("ok")
    if (fresh.status !== "ok" || !fresh.value?.stored) throw new Error("Detached restart read missing")
    expect(fresh.value.stored).toEqual(f.original)
  } finally {
    f.fixture.store.transaction = transaction
    await f.cleanup()
  }
}, 60000)

test("C08 projection keeps null-prototype inherited-key behavior for missing results and cases", async () => {
  const f = await createCalculationFixture()
  const transaction = f.fixture.store.transaction
  try {
    f.fixture.store.transaction = (surface, work, options) => transaction(surface, async (snapshot, blobs) => {
      if (surface === "dashboard") {
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (state.decisionResults) Object.setPrototypeOf(state.decisionResults, null)
        Object.setPrototypeOf(state.cases, null)
      }
      return work(snapshot, blobs)
    }, options)
    const request = f.fixture.request
    const context = f.fixture.context
    const settle = async <T>(read: (state: Readonly<SfProductState>, authority: SfStateAuthority) => T) => {
      try { return { outcome: "returned", result: await f.settings.state.read(request, "cases", read) } }
      catch (cause) { return { outcome: "threw", name: cause instanceof Error ? cause.name : String(cause), message: cause instanceof Error ? cause.message : "" } }
    }
    const absent = selectSfDecisionResult("constructor", context)
    expect(await settle(absent)).toEqual(await settle((state, authority) => absent(state, authority)))
    const fixed = selectSfDecisionResult(f.original.resultRef, context, "constructor")
    expect(await settle(fixed)).toEqual(await settle((state, authority) => fixed(state, authority)))
  } finally {
    f.fixture.store.transaction = transaction
    await f.cleanup()
  }
}, 60000)
