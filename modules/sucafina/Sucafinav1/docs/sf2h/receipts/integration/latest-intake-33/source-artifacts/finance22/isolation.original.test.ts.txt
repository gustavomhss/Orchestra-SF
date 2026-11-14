import { expect, test } from "bun:test"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { selectSfCase } from "../../../product/host-binding/state-provider.ts"
import { createStateIsolationFixture } from "./fixture.ts"

test("C08 case selection detaches its result before the final authority callback and across requests", async () => {
  const f = await createStateIsolationFixture()
  try {
    const retained: { snapshot?: SfProductState } = {}
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 2) return
      retained.snapshot = snapshot.data.__sfProductV1 as SfProductState
      retained.snapshot.cases.case!.objective = "mutated during final authority"
    }
    const first = await f.state.read(f.request, "cases", selectSfCase("case", f.context))
    expect(f.controls.checks).toHaveLength(2)
    expect(first).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1, value: f.decision })
    if (first.status !== "ok" || !first.value || !retained.snapshot) throw new Error("Detached case missing")
    expect(Object.keys(first.value).sort()).toEqual(Object.keys(f.decision).sort())
    expect(first.value).not.toHaveProperty("preferences")
    first.value.objective = "mutated by recipient"
    retained.snapshot.cases.case!.objective = "mutated after transaction scope"
    f.controls.observe = undefined
    const secondRequest = await f.admit()
    const second = await f.state.read(secondRequest.request, "cases", selectSfCase("case", secondRequest.context))
    expect(second).toMatchObject({ status: "ok", value: f.decision })
    if (second.status !== "ok") throw new Error("Fresh request unavailable")
    expect(second.value).not.toBe(first.value)
    expect(f.controls.checks.map((entry) => entry.request)).toEqual([f.request, f.request, secondRequest.request, secondRequest.request])
  } finally { await f.close() }
})

test("C08 opaque and wrapped selectors retain detached mutable callbacks on success, throw and rejection", async () => {
  const f = await createStateIsolationFixture()
  try {
    const observed: { callback?: Readonly<SfProductState>; egress?: SfProductState } = {}
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode === "read" && index === 2) observed.egress = structuredClone(snapshot.data.__sfProductV1) as SfProductState
    }
    const selector = selectSfCase("case", f.context)
    // Copying a selector's public properties must not confer its internal identity.
    const wrapped = Object.assign((stored: Readonly<SfProductState>, authority: Parameters<typeof selector>[1]) => {
      observed.callback = stored
      stored.cases.case!.objective = "callback-private mutation"
      stored.preferences.private = "callback-private preference"
      return selector(stored, authority)
    }, selector)
    const result = await f.state.read(f.request, "cases", wrapped)
    expect(result).toMatchObject({ status: "ok", value: { objective: "callback-private mutation" } })
    expect(observed.egress?.cases.case).toEqual(f.decision)
    expect(observed.egress?.preferences.private).toEqual({ marker: "not part of a case projection", nested: { count: 1 } })
    if (!observed.callback) throw new Error("Opaque callback did not execute")
    observed.callback.cases.case!.objective = "retained callback mutation"
    f.controls.observe = undefined
    for (const asynchronous of [false, true]) {
      const failure = new Error(asynchronous ? "read rejected" : "read threw")
      await expect(f.state.read(f.request, "cases", (stored) => {
        stored.cases.case!.objective = "failed callback mutation"
        stored.preferences.private = "failed callback preference"
        if (asynchronous) return Promise.reject(failure)
        throw failure
      })).rejects.toThrow(failure.message)
      expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toMatchObject({ status: "ok", value: f.decision })
    }
    expect(await f.state.read(f.request, "preferences", (stored) => stored.preferences.private)).toMatchObject({ status: "ok", value: { marker: "not part of a case projection", nested: { count: 1 } } })
  } finally { await f.close() }
})

test("C08 selectors observe a mutable or accessor binding after admission instead of a captured authority", async () => {
  const f = await createStateIsolationFixture()
  try {
    for (const change of ["mutation", "replacement", "accessor"] as const) {
      const binding = { current: Object.freeze({ ...f.context.binding }) }
      const mutable = { ...f.context, binding: { ...f.context.binding } }
      const context = change === "accessor" ? Object.freeze({ ...f.context, get binding() { return binding.current } }) : mutable
      const selector = selectSfCase("case", context)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        if (change === "accessor") { binding.current = Object.freeze({ ...binding.current, principalRef: "outsider" }); return }
        if (change === "replacement") { mutable.binding = { ...mutable.binding, accessRevision: "replacement-access" }; return }
        mutable.binding.principalRef = "outsider"
      }
      expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
      expect(f.controls.checks).toHaveLength(2)
      binding.current = Object.freeze({ ...f.context.binding })
      mutable.binding = { ...f.context.binding }
      f.controls.observe = undefined
      expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: f.decision })
    }
  } finally { await f.close() }
})

test("C08 selectors cannot reuse access across principals, Request identity, header mutation or revocation", async () => {
  const f = await createStateIsolationFixture()
  try {
    const selector = selectSfCase("case", f.context)
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: f.decision })
    const outsider = await f.admit("outsider")
    expect(await f.state.read(outsider.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
    expect(await f.state.read(new Request(f.request), "cases", selector)).toEqual({ status: "denied", reason: "product-access-unavailable" })
    f.controls.checks.length = 0
    f.controls.observe = (_snapshot, request, mode, index) => {
      if (mode === "read" && index === 2) request.headers.set("authorization", "changed-token")
    }
    expect(await f.state.read(f.request, "cases", selector)).toEqual({ status: "denied", reason: "product-authority-changed" })
    f.controls.observe = undefined
    const fresh = await f.admit()
    f.controls.checks.length = 0
    f.controls.observe = (_snapshot, _request, mode, index) => {
      if (mode === "read" && index === 2) f.controls.enabled = false
    }
    expect(await f.state.read(fresh.request, "cases", selectSfCase("case", fresh.context))).toEqual({ status: "denied", reason: "product-authority-changed" })
    expect(f.controls.checks).toHaveLength(2)
    f.controls.observe = undefined
    expect(await f.state.read(fresh.request, "cases", selectSfCase("case", fresh.context))).toEqual({ status: "denied", reason: "product-access-unavailable" })
  } finally { await f.close() }
})

test("C08 selected reads retain cancellation and cannot commit a caught nested-write attempt", async () => {
  const f = await createStateIsolationFixture()
  try {
    const cancelled = new AbortController()
    const admitted = await f.admit("principal", cancelled.signal)
    f.controls.checks.length = 0
    f.controls.observe = (_snapshot, _request, mode, index) => {
      if (mode === "read" && index === 2) cancelled.abort(new Error("selected read cancelled"))
    }
    await expect(f.state.read(admitted.request, "cases", selectSfCase("case", admitted.context))).rejects.toThrow("selected read cancelled")
    f.controls.observe = undefined
    const poison = { caught: false, worked: false }
    await expect(f.state.read(f.request, "cases", async (stored) => {
      await f.state.transaction(f.request, { ...f.command, expectedStorageVersion: 1, idempotencyKey: "nested-write" }, async (staged) => {
        poison.worked = true
        staged.cases.case!.objective = "nested write must roll back"
        return { commit: true, value: true }
      }).catch(() => { poison.caught = true })
      return stored.cases.case
    })).rejects.toThrow("Nested local write attempted")
    expect(poison).toEqual({ caught: true, worked: true })
    expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toMatchObject({ status: "ok", storageVersion: 1, value: f.decision })
    expect(await f.state.transaction(f.request, { ...f.command, idempotencyKey: "stale-cas" }, async () => {
      throw new Error("Stale CAS must not execute")
    })).toEqual({ status: "conflict", reason: "product-state-changed" })
  } finally { await f.close() }
})

test("C08 case selectors preserve missing, inherited, legacy and malformed state outcomes", async () => {
  const f = await createStateIsolationFixture()
  try {
    const original = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) }))
    const legacy = original as SfProductState
    expect(legacy.nativeRuns).toBeUndefined()
    expect(legacy.decisionResults).toBeUndefined()
    expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toMatchObject({ status: "ok", value: f.decision })
    for (const id of ["missing", "constructor", "__proto__", "toString"]) {
      const baseline = await f.state.read(f.request, "cases", (stored, authority) => authority.principalRef === f.context.binding.principalRef && authority.policyVersion === f.context.binding.policyVersion && authority.accessRevision === f.context.binding.accessRevision ? stored.cases[id] : undefined)
      const selected = await f.state.read(f.request, "cases", selectSfCase(id, f.context))
      expect(selected.status).toBe(baseline.status)
      if (selected.status !== "ok" || baseline.status !== "ok") throw new Error("Malformed reference comparison unavailable")
      expect(selected.value).toBe(baseline.value)
    }
    const malformed: { name: string; value: unknown; reason: string }[] = [
      { name: "missing", value: undefined, reason: "product-state-uninitialized" },
      { name: "schema", value: { ...legacy, schemaVersion: 2 }, reason: "invalid-product-state" },
      { name: "cases", value: { ...legacy, cases: [] }, reason: "invalid-product-state" },
      { name: "version", value: { ...legacy, versions: { ...legacy.versions, cases: -1 } }, reason: "invalid-product-state" },
    ]
    for (const entry of malformed) {
      await f.store.transaction("dashboard", async (snapshot) => {
        snapshot.data.__sfProductV1 = structuredClone(entry.value)
        return { commit: true, value: null }
      })
      const before = digestSfValue(entry.value)
      expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toEqual({ status: "unavailable", reason: entry.reason })
      const after = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.__sfProductV1) }))
      expect(after).toBe(before)
    }
  } finally { await f.close() }
})

test("C08 case selectors preserve accessor counts and omitted parent cases without an extra observation", async () => {
  const f = await createStateIsolationFixture()
  try {
    const selected = selectSfCase("case", f.context)
    const original = (stored: Parameters<typeof selected>[0], authority: Parameters<typeof selected>[1]) => authority.principalRef === f.context.binding.principalRef && authority.policyVersion === f.context.binding.policyVersion && authority.accessRevision === f.context.binding.accessRevision ? stored.cases.case : undefined
    for (const shape of ["accessor", "nonenumerable", "inherited"] as const) {
      const observations: { getterCalls: number; authorityCalls: number; outcome: unknown }[] = []
      for (const reader of [original, selected]) {
        const observed = { getterCalls: 0 }
        f.controls.checks.length = 0
        f.controls.observe = (snapshot, _request, mode, index) => {
          if (mode !== "read" || index !== 1) return
          const stored = snapshot.data.__sfProductV1 as SfProductState
          const cases = stored.cases
          // The descriptor exists only on this real SQLite read snapshot.
          // commit=false must never serialize it or change the durable shape.
          if (shape === "accessor") {
            Object.defineProperty(stored, "cases", { configurable: true, enumerable: true, get: () => { observed.getterCalls += 1; return cases } })
            return
          }
          if (shape === "nonenumerable") {
            Object.defineProperty(stored, "cases", { configurable: true, enumerable: false, writable: true, value: cases })
            return
          }
          Object.setPrototypeOf(stored, { cases })
          Reflect.deleteProperty(stored, "cases")
        }
        const outcome = await f.state.read(f.request, "cases", reader).then(
          (result) => ({ kind: "return", result }),
          (error: unknown) => ({ kind: "throw", typeError: error instanceof TypeError }),
        )
        observations.push({ ...observed, authorityCalls: f.controls.checks.length, outcome })
      }
      expect(observations[1]).toEqual(observations[0])
      if (shape === "accessor") {
        expect(observations[0]?.getterCalls).toBeGreaterThan(0)
        expect(observations[0]).toMatchObject({ authorityCalls: 2, outcome: { kind: "return", result: { status: "ok", value: f.decision } } })
        continue
      }
      expect(observations[0]).toMatchObject({ authorityCalls: 1, outcome: { kind: "throw", typeError: true } })
    }
    f.controls.observe = undefined
    expect(await f.state.read(f.request, "cases", selected)).toMatchObject({ status: "ok", value: f.decision })
  } finally { await f.close() }
})
