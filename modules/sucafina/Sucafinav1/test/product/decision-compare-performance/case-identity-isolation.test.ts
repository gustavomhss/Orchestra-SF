import { expect, test } from "bun:test"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { selectSfCaseIdentity } from "../../../product/host-binding/state-provider.ts"
import { createStateIsolationFixture } from "../finance-state-read-performance/fixture.ts"

// This fixture has a consumed real UI lease and an empty C08 case. It proves
// selection ownership, not a financial source grant or native execution.
test("case identity clones one complete case graph and retains both C08 authority observations", async () => {
  const f = await createStateIsolationFixture()
  try {
    const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    const counts = { unrelated: 0, selected: 0, other: 0 }
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState
      const preference = state.preferences.private, selected = state.cases.case!
      const objective = selected.objective
      Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { counts.unrelated++; return preference } })
      Object.defineProperty(selected, "objective", { enumerable: true, configurable: true, get: () => { counts.selected++; return objective } })
      state.cases.alias = selected
      state.cases.other = { ...f.decision, id: "other", objective: "other case" }
      Object.defineProperty(state.cases.other, "objective", { enumerable: true, configurable: true, get: () => { counts.other++; return "other case" } })
    }
    const samples = []
    for (const opaque of [true, false]) {
      Object.assign(counts, { unrelated: 0, selected: 0, other: 0 })
      f.controls.checks.length = 0
      const selector = selectSfCaseIdentity(captured, f.context)
      const result = await f.state.read(f.request, "cases", opaque ? (state, actor) => selector(state, actor) : selector)
      expect(result).toMatchObject({ status: "ok", value: captured })
      samples.push({ ...counts, checks: f.controls.checks.length, result })
    }
    expect(samples[0]).toMatchObject({ unrelated: 1, selected: 1, other: 1, checks: 2 })
    expect(samples[1]).toMatchObject({ unrelated: 0, selected: 1, other: 1, checks: 2 })
    expect(samples[1]!.result).toEqual(samples[0]!.result)
  } finally { await f.close() }
})

test("case identity returns detached metadata before final admission and across independent requests", async () => {
  const f = await createStateIsolationFixture()
  try {
    const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    const retained: { state?: SfProductState } = {}
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 2) return
      retained.state = snapshot.data.__sfProductV1 as SfProductState
      retained.state.cases.case!.version++
    }
    const first = await f.state.read(f.request, "cases", selectSfCaseIdentity(captured, f.context))
    expect(first).toMatchObject({ status: "ok", value: captured })
    if (first.status !== "ok" || !first.value || !retained.state) throw new Error("Detached identity missing")
    first.value.version = 900
    retained.state.cases.case!.participants.length = 0
    f.controls.observe = undefined
    const next = await f.admit()
    const second = await f.state.read(next.request, "cases", selectSfCaseIdentity(captured, next.context))
    expect(second).toMatchObject({ status: "ok", value: captured })
    if (second.status !== "ok") throw new Error("Fresh identity missing")
    expect(second.value).not.toBe(first.value)
    expect(f.controls.checks.map((entry) => entry.request)).toEqual([f.request, f.request, next.request, next.request])
  } finally { await f.close() }
})

test("case identity wrappers and other namespaces keep the original full callback clone", async () => {
  const f = await createStateIsolationFixture()
  try {
    const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    const selector = selectSfCaseIdentity(captured, f.context)
    const wrapped = Object.assign((state: Readonly<SfProductState>, actor: Parameters<typeof selector>[1]) => {
      state.preferences.private = "callback-private"
      state.cases.case!.participants.length = 0
      return selector(state, actor)
    }, selector)
    expect(await f.state.read(f.request, "cases", wrapped)).toMatchObject({ status: "ok", value: undefined })
    const counts = { unrelated: 0 }
    f.controls.checks.length = 0
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState, preference = state.preferences.private
      Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { counts.unrelated++; return preference } })
    }
    expect(await f.state.read(f.request, "preferences", selector)).toMatchObject({ status: "ok", value: captured })
    expect(counts.unrelated).toBe(1)
    f.controls.observe = undefined
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: captured })
    expect(await f.state.read(f.request, "preferences", (state) => state.preferences.private))
      .toMatchObject({ status: "ok", value: { marker: "not part of a case projection", nested: { count: 1 } } })
  } finally { await f.close() }
})

for (const fault of ["inherited-map", "accessor-map", "nonplain-map", "proxy-map", "proxy-state", "proxy-context", "proxy-binding"] as const) {
  test("case identity unsafe " + fault + " retains the opaque path and its failures", async () => {
    const f = await createStateIsolationFixture()
    try {
      const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
      const samples = []
      for (const opaque of [true, false]) {
        const counts = { unrelated: 0, traps: 0 }
        const handler = { getOwnPropertyDescriptor(target: object, key: PropertyKey) {
          counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key)
        }, getPrototypeOf(target: object) { counts.traps++; return Reflect.getPrototypeOf(target) } }
        const call = fault === "proxy-context" ? new Proxy<typeof f.context>(f.context, handler)
          : fault === "proxy-binding" ? Object.freeze({ ...f.context, binding: new Proxy<typeof f.context.binding>(f.context.binding, handler) }) : f.context
        const selector = selectSfCaseIdentity(captured, call)
        if (fault === "proxy-context" || fault === "proxy-binding") expect(counts.traps).toBe(0)
        f.controls.checks.length = 0
        f.controls.observe = (snapshot, _request, mode, index) => {
          if (mode !== "read" || index !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState
          const preference = state.preferences.private, map = state.cases
          Object.defineProperty(state.preferences, "private", { enumerable: true, configurable: true, get: () => { counts.unrelated++; return preference } })
          if (fault === "inherited-map") { Reflect.deleteProperty(state, "cases"); Object.setPrototypeOf(state, { cases: map }) }
          if (fault === "accessor-map") Object.defineProperty(state, "cases", { enumerable: true, configurable: true, get: () => map })
          if (fault === "nonplain-map") Object.setPrototypeOf(map, { marker: "inherited" })
          if (fault === "proxy-map") state.cases = new Proxy<typeof map>(map, handler)
          if (fault === "proxy-state") snapshot.data.__sfProductV1 = new Proxy<typeof state>(state, handler)
        }
        const outcome = await f.state.read(f.request, "cases", opaque ? (state, actor) => selector(state, actor) : selector)
          .then((value) => ({ value }), (error: unknown) => ({ error: error instanceof Error ? error.name : String(error) }))
        samples.push({ outcome, ...counts, checks: f.controls.checks.length })
      }
      expect(samples[1]).toEqual(samples[0])
      if (fault === "proxy-map" || fault === "proxy-state" || fault === "inherited-map") expect(samples[1]!.outcome).toHaveProperty("error")
      else expect(samples[1]).toMatchObject({ unrelated: 1, checks: 2, outcome: { value: { status: "ok", value: captured } } })
    } finally { await f.close() }
  })
}

test("case identity observes captured identity, participants and bindings at the original C08 callback", async () => {
  const f = await createStateIsolationFixture()
  try {
    const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    for (const change of ["id", "incarnation", "version", "participants", "stored-incarnation", "stored-version"] as const) {
      Object.assign(captured, { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version })
      f.controls.checks.length = 0
      const selector = selectSfCaseIdentity(captured, f.context)
      f.controls.observe = (snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (change === "participants") { state.cases.case!.participants.length = 0; return }
        if (change === "stored-incarnation") { state.cases.case!.incarnation = "replaced"; return }
        if (change === "stored-version") { state.cases.case!.version++; return }
        if (change === "version") { captured.version++; return }
        captured[change] = "changed"
      }
      expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
      expect(f.controls.checks).toHaveLength(2)
    }
    Object.assign(captured, { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version })
    for (const change of ["mutation", "replacement", "accessor"] as const) {
      const binding = { current: Object.freeze({ ...f.context.binding }) }
      const mutable = { ...f.context, binding: { ...f.context.binding } }
      const call = change === "accessor" ? Object.freeze({ ...f.context, get binding() { return binding.current } }) : mutable
      const selector = selectSfCaseIdentity(captured, call)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        if (change === "accessor") { binding.current = Object.freeze({ ...binding.current, principalRef: "outsider" }); return }
        if (change === "replacement") { mutable.binding = { ...mutable.binding, policyVersion: "changed" }; return }
        mutable.binding.accessRevision = "changed"
      }
      expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
      expect(f.controls.checks).toHaveLength(2)
    }
  } finally { await f.close() }
})

test("case identity retains clone failures in an unselected case", async () => {
  const f = await createStateIsolationFixture()
  try {
    const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    for (const opaque of [true, false]) {
      f.controls.checks.length = 0
      f.controls.observe = (snapshot, _request, mode, index) => {
        if (mode !== "read" || index !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        state.cases.other = { ...f.decision, id: "other" }
        Object.defineProperty(state.cases.other, "objective", { enumerable: true, configurable: true,
          get: () => { throw new Error("unselected case getter") } })
      }
      const selector = selectSfCaseIdentity(captured, f.context)
      await expect(f.state.read(f.request, "cases", opaque ? (state, actor) => selector(state, actor) : selector)).rejects.toThrow("unselected case getter")
      expect(f.controls.checks).toHaveLength(1)
    }
  } finally { await f.close() }
})

test("case identity cannot borrow another principal, participants or a copied Request", async () => {
  const f = await createStateIsolationFixture()
  try {
    const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    const selector = selectSfCaseIdentity(captured, f.context)
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: captured })
    const outsider = await f.admit("outsider")
    expect(await f.state.read(outsider.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
    expect(await f.state.read(outsider.request, "cases", selectSfCaseIdentity(captured, outsider.context))).toMatchObject({ status: "ok", value: undefined })
    expect(await f.state.read(new Request(f.request), "cases", selector)).toEqual({ status: "denied", reason: "product-access-unavailable" })
  } finally { await f.close() }
})

for (const fault of ["headers", "revocation", "abort"] as const) {
  test("case identity keeps its final authority and cancellation fence for " + fault, async () => {
    const f = await createStateIsolationFixture()
    try {
      const captured = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
      const controller = new AbortController()
      const admitted = await f.admit("principal", controller.signal)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, request, mode, index) => {
        if (mode !== "read" || index !== 2) return
        if (fault === "headers") request.headers.set("authorization", "changed")
        if (fault === "revocation") f.controls.enabled = false
        if (fault === "abort") controller.abort(new Error("case identity cancelled"))
      }
      const pending = f.state.read(admitted.request, "cases", selectSfCaseIdentity(captured, admitted.context))
      if (fault === "abort") await expect(pending).rejects.toThrow("case identity cancelled")
      else expect(await pending).toEqual({ status: "denied", reason: "product-authority-changed" })
      expect(f.controls.checks).toHaveLength(2)
      f.controls.observe = undefined
      if (fault === "revocation") expect(await f.state.read(admitted.request, "cases", selectSfCaseIdentity(captured, admitted.context)))
        .toEqual({ status: "denied", reason: "product-access-unavailable" })
    } finally { await f.close() }
  })
}
