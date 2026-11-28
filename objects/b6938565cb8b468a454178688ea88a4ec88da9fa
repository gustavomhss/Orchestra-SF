import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { DecisionCase, CostCoverageBasis } from "../../../../product/contracts/decisions.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult } from "../../../../product/contracts/state.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfProductState, initializeAbsentSfProductState, selectSfCasesRead } from "../../../../product/host-binding/state-provider.ts"
import { createDecisionBaselineCoverage } from "../../../../product/decisions/baseline-coverage.ts"
import { createCriterionRuleRegistry } from "../../../../product/decisions/criterion-rules.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read<T> = (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>
type CaseRef = { id: string; incarnation: string; version: number }
const actor: SfStateAuthority = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }

function ok<T>(result: SfStateResult<T> | PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

async function capture<T>(work: () => T | Promise<T>) {
  try { return { value: await work() } }
  catch (error) { return { error } }
}

function errorShape(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : error
}

function context(): TrustedUiContext {
  return Object.freeze({ kind: "ui", binding: Object.freeze({
    installationId: "cases-read-set-installation", projectId: "project", principalRef: "person",
    requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2028-01-01T00:00:00Z",
  }), lease: {} }) as TrustedUiContext
}

function decision(id: string): DecisionCase {
  return { id, incarnation: id + "-inc", version: 1, state: "investigating", objective: "Original complete case",
    horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: ["person"],
    criteria: [{ id: "cost", description: "Observe the original amount", required: true }],
    sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [] }
}

async function fixture(deadline: Deadline) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-cases-read-set-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  await initializeAbsentSfProductState(store, () => "cases-read-set-state")
  await store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.cases.selected = decision("selected")
    state.cases.other = decision("other")
    state.preferences.private = { amount: 12 }
    return { commit: true, value: undefined }
  })
  const control: {
    active: boolean
    actor: SfStateAuthority
    calls: { namespace: SfStateNamespace; mode: "read" | "write" }[]
    before?: (snapshot: Snapshot, count: number) => void | Promise<void>
  } = { active: true, actor: { ...actor }, calls: [] }
  const writes = new WeakSet<object>()
  const port = createSfProductState({ persistence: store, createId: randomUUID, proposalCoverageWrites: writes,
    authorize: async (_request, snapshot, namespace, mode) => {
      deadline.check()
      control.calls.push({ namespace, mode })
      await control.before?.(snapshot, control.calls.length)
      return control.active ? { ...control.actor } : undefined
    },
    resolveTarget: async (_request, snapshot, _namespace, id) => {
      const value = (snapshot.data.__sfProductV1 as SfProductState).cases[id]
      return value ? { incarnation: value.incarnation } : undefined
    },
  })
  const request = (signal = deadline.signal) => new Request("https://cases-read-set.example.test/read", { signal })
  const reset = () => { control.active = true; control.actor = { ...actor }; control.calls = []; control.before = undefined }
  return { store, port, control, request, reset, writes, call: context() }
}

/** Capture each real consumer callback without invoking it under the consumer's
 * catch. All subsequent getter/order/error assertions run outside that catch. */
async function consumerCallback(kind: "baseline" | "criterion", call: TrustedDomainContext, ref: CaseRef, deadline: Deadline) {
  const request = new Request("https://cases-custom.example.test", { signal: deadline.signal })
  const seen: { namespace: SfStateNamespace; request: Request }[] = []
  const callbacks: Read<unknown>[] = []
  let revalidations = 0, unused = 0
  const state: SfProductStatePort = {
    read: async (incoming, namespace, read) => {
      seen.push({ namespace, request: incoming }); callbacks.push(read)
      return { status: "unavailable", reason: "callback-captured-without-invocation" }
    },
    transaction: async () => { unused++; throw new Error("No custom write belongs to callback capture") },
  }
  const host = { requestFor: () => request, revalidate: async () => { revalidations++; return true } }
  const result = kind === "baseline"
    ? await createDecisionBaselineCoverage({
      state, host, resolveCase: async () => ({ status: "ok", value: ref }),
      authorizeCase: async () => { unused++; return false },
      authorizeCoverage: async () => { unused++; return false },
      projectForecast: async () => { unused++; return { status: "unavailable", reason: "capture-only" } },
      resolveEvidence: async () => { unused++; return [] },
      supports: () => { unused++; return false }, verifySnapshot: () => { unused++; return false },
      operationIdentity: () => { unused++; return undefined }, proposalCoverageWrites: new WeakSet<object>(),
      now: () => { unused++; return "2027-02-02T00:00:00Z" },
    }).resolveForecastCoverage("source", call)
    : await createCriterionRuleRegistry({
      state, host, authorizeCase: async () => { unused++; return false },
      authorizeRule: async () => { unused++; return false }, verifyEvidence: async () => { unused++; return false },
      verifySnapshot: () => { unused++; return false },
      readMetric: async () => { unused++; return { status: "unavailable", reason: "capture-only" } },
      verifyMetric: async () => { unused++; return false }, operationIdentity: () => { unused++; return undefined },
      proposalCoverageWrites: new WeakSet<object>(), now: () => { unused++; return "2027-02-02T00:00:00Z" },
    }).resolve({ caseRef: ref, criterionId: "cost" }, call)
  expect(result).toEqual(kind === "baseline"
    ? { status: "denied", reason: "baseline-coverage-access-unavailable" }
    : { status: "unavailable", reason: "criterion-unavailable" })
  expect(seen).toEqual([{ namespace: "cases", request }])
  expect(revalidations).toBe(1)
  expect(unused).toBe(0)
  expect(callbacks).toHaveLength(1)
  const read = callbacks[0]
  if (!read) throw new Error("The actual cases callback was not delivered")
  return read
}

test("Cases declaration preserves callback identity and both consumers' late opaque guards and IDs", async () => {
  const deadline = compositionTestDeadline("cases-original-callbacks", 12_000)
  try {
    const original = (state: Pick<SfProductState, "cases">) => state.cases
    expect(selectSfCasesRead(context(), original)).toBe(original)
    const fields = ["principalRef", "policyVersion", "accessRevision"] as const
    for (const kind of ["baseline", "criterion"] as const) {
      for (const mode of ["frozen", "mutable", "binding accessor"] as const) {
        const order: string[] = []
        const mutable = { ...context(), binding: { ...context().binding } }
        const binding = { ...mutable.binding }
        for (const field of fields) Object.defineProperty(binding, field, { enumerable: true,
          get: () => { order.push("binding." + field); return actor[field] } })
        const call = mode === "mutable" ? mutable : mode === "frozen" ? context()
          : Object.freeze(Object.defineProperty({ ...context() }, "binding",
            { enumerable: true, get: () => { order.push("context.binding"); return binding } }))
        let currentId = "selected"
        const ref = { get id() { order.push("id"); return currentId }, incarnation: "selected-inc", version: 1 }
        const read = await consumerCallback(kind, call, ref, deadline)
        expect(order).toEqual([])
        currentId = "other"
        const values = { selected: decision("selected"), other: decision("other") }
        const sentinel = new Error("Original cases namespace getter")
        for (const mismatch of [...fields, "none"] as const) {
          for (const throwing of [false, true]) {
            order.length = 0
            const authority = { ...actor }
            for (const field of fields) Object.defineProperty(authority, field, { enumerable: true,
              get: () => { order.push("authority." + field); return mismatch === field ? "changed" : actor[field] } })
            const cases = new Proxy(values, { get: (target, key, receiver) => {
              order.push("cases." + String(key)); return Reflect.get(target, key, receiver)
            } })
            // This custom port input deliberately contains only cases. The type
            // bridge changes no object, getter, callback or runtime operation.
            const state = Object.defineProperty({}, "cases", { enumerable: true, get: () => {
              order.push("state.cases"); if (throwing) throw sentinel; return cases
            } }) as unknown as Readonly<SfProductState>
            const observed = await capture(() => read(state, authority))
            const reached = mismatch === "none" ? fields.length : fields.indexOf(mismatch) + 1
            const expected = fields.slice(0, reached).flatMap((field) => mode === "binding accessor"
              ? ["authority." + field, "context.binding", "binding." + field] : ["authority." + field])
            if (mismatch === "none") expected.push("state.cases", ...(throwing ? [] : ["id", "cases.other"]))
            expect(order).toEqual(expected)
            if (mismatch !== "none") expect(observed).toEqual({ value: undefined })
            else if (throwing) { expect(observed.error).toBe(sentinel); expect(observed.value).toBeUndefined() }
            else { expect(observed.error).toBeUndefined(); expect(observed.value).toBe(values.other) }
          }
        }
        if (mode === "mutable") {
          order.length = 0
          mutable.binding.accessRevision = "changed after capture"
          expect(await capture(() => read({ cases: values } as unknown as Readonly<SfProductState>, actor)))
            .toEqual({ value: undefined })
          expect(order).toEqual([])
          mutable.binding.accessRevision = actor.accessRevision
          expect(await read({ cases: values } as unknown as Readonly<SfProductState>, actor)).toBe(values.other)
          expect(order).toEqual(["id"])
        }
      }
    }
  } finally { await deadline.close() }
}, 15_000)

test("C08 cases read-set clones the complete reachable graph and detaches every admission", async () => {
  const deadline = compositionTestDeadline("cases-complete-graph", 12_000)
  try {
    const f = await fixture(deadline)
    const run = async (opaque: boolean) => {
      f.reset()
      let outside = 0, inside = 0, callbackCalls = 0
      let sourceCases: SfProductState["cases"] | undefined, sourceShared: object | undefined
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        sourceCases = state.cases
        const shared = { amount: 12 }
        sourceShared = shared
        state.preferences.shared = shared
        state.cases.alias = state.cases.selected!
        Reflect.set(state.cases.selected!, "self", state.cases.selected)
        Reflect.set(state.cases.selected!, "cases", state.cases)
        Reflect.set(state.cases.selected!, "shared", shared)
        Reflect.set(state.cases.other!, "shared", shared)
        Object.defineProperty(state.cases, "fromGetter", { enumerable: true,
          get: () => { inside++; return decision("from-getter") } })
        Object.defineProperty(state.preferences, "outside", { enumerable: true,
          get: () => { outside++; return "exclusively outside cases" } })
      }
      const original = (state: Pick<SfProductState, "cases">, authority: SfStateAuthority) => {
        callbackCalls++
        return { cases: state.cases, authority }
      }
      const read = selectSfCasesRead(f.call, original)
      expect(read).toBe(original)
      const result = await f.port.read(f.request(), "cases", opaque ? (state, authority) => read(state, authority) : read)
      expect(callbackCalls).toBe(1)
      expect(f.control.calls).toEqual([{ namespace: "cases", mode: "read" }, { namespace: "cases", mode: "read" }])
      expect(inside).toBe(1)
      expect(outside).toBe(opaque ? 1 : 0)
      expect(result).toMatchObject({ status: "ok", storageVersion: 0, aggregateRevision: 0, incarnation: "cases-read-set-state" })
      const value = ok(result)
      expect(value.authority).toEqual(actor)
      expect(Object.keys(value.cases).sort()).toEqual(["alias", "fromGetter", "other", "selected"])
      expect(value.cases).not.toBe(sourceCases)
      expect(value.cases.selected).not.toBe(sourceCases?.selected)
      expect(value.cases.other).not.toBe(sourceCases?.other)
      expect(value.cases.alias).toBe(value.cases.selected)
      expect(Reflect.get(value.cases.selected!, "self")).toBe(value.cases.selected)
      expect(Reflect.get(value.cases.selected!, "cases")).toBe(value.cases)
      const shared: unknown = Reflect.get(value.cases.selected!, "shared")
      expect(shared).toEqual({ amount: 12 })
      expect(shared).toBe(Reflect.get(value.cases.other!, "shared"))
      expect(shared).not.toBe(sourceShared)
      expect(value.cases.fromGetter).toEqual(decision("from-getter"))
      return result
    }
    const opaque = await run(true), selected = await run(false)
    expect(selected).toEqual(opaque)
    const first = ok(opaque), second = ok(selected)
    expect(first.cases).not.toBe(second.cases)
    second.cases.selected!.objective = "Caller mutation"
    const shared: unknown = Reflect.get(second.cases.selected!, "shared")
    if (!shared || typeof shared !== "object") throw new Error("The cloned shared object is missing")
    Reflect.set(shared, "amount", 999)
    second.cases.callerOnly = decision("caller-only")
    expect(first.cases.selected!.objective).toBe("Original complete case")
    expect(Reflect.get(first.cases.selected!, "shared")).toEqual({ amount: 12 })
    expect(await run(false)).toEqual(opaque)
    await f.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases.selected!.objective = "Persisted fresh value"
      state.cases.added = decision("added")
      state.versions.cases++; state.revision++
      return { commit: true, value: undefined }
    })
    f.reset()
    const fresh = await f.port.read(f.request(), "cases", selectSfCasesRead(f.call, (state) => state.cases))
    expect(fresh).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1, incarnation: "cases-read-set-state" })
    expect(ok(fresh).selected!.objective).toBe("Persisted fresh value")
    expect(ok(fresh).added).toEqual(decision("added"))
    expect(Reflect.has(ok(fresh), "callerOnly")).toBe(false)
    f.reset()
    expect(await f.port.read(f.request(), "cases", (state) => state.cases)).toEqual(fresh)
  } finally { await deadline.close() }
}, 15_000)

test("C08 cases read-set keeps opaque context, callback, namespace and map fallback", async () => {
  const deadline = compositionTestDeadline("cases-opaque-fallback", 12_000)
  try {
    const f = await fixture(deadline)
    for (const mode of ["marked", "unmarked", "wrapped", "mutable", "binding accessor", "proxy context", "proxy callback", "wrong namespace"] as const) {
      f.reset()
      let callbackCalls = 0, outsideReads = 0, contextTraps = 0, callbackTraps = 0
      const sentinel = new Error("Original unselected namespace failure")
      const call = mode === "mutable" ? { ...f.call, binding: { ...f.call.binding } }
        : mode === "binding accessor" ? Object.freeze(Object.defineProperty({ ...f.call }, "binding",
          { enumerable: true, get: () => { contextTraps++; return f.call.binding } }))
        : mode === "proxy context" ? new Proxy(f.call, {
          get: (target, key, receiver) => { contextTraps++; return Reflect.get(target, key, receiver) },
          getOwnPropertyDescriptor: (target, key) => { contextTraps++; return Reflect.getOwnPropertyDescriptor(target, key) },
        }) : f.call
      const original = (state: Pick<SfProductState, "cases">) => { callbackCalls++; return state.cases.selected }
      const callback = mode === "proxy callback" ? new Proxy(original, {
        apply: (target, receiver, args) => { callbackTraps++; return Reflect.apply(target, receiver, args) },
        get: (target, key, receiver) => { callbackTraps++; return Reflect.get(target, key, receiver) },
      }) : original
      const declared = mode === "unmarked" ? callback : selectSfCasesRead(call, callback)
      expect(declared).toBe(callback)
      expect({ callbackCalls, contextTraps, callbackTraps }).toEqual({ callbackCalls: 0, contextTraps: 0, callbackTraps: 0 })
      f.control.before = (snapshot, count) => {
        if (count === 1) Object.defineProperty((snapshot.data.__sfProductV1 as SfProductState).preferences, "outside",
          { enumerable: true, get: () => { outsideReads++; throw sentinel } })
      }
      const observed = await capture(() => f.port.read(f.request(), mode === "wrong namespace" ? "preferences" : "cases",
        mode === "wrapped" ? (state, authority) => declared(state, authority) : declared))
      // A caught product error cannot satisfy these external reachability checks.
      if (mode === "marked") {
        expect(observed.error).toBeUndefined()
        expect(ok(observed.value!)).toEqual(decision("selected"))
        expect(callbackCalls).toBe(1)
        expect(f.control.calls).toHaveLength(2)
        expect(outsideReads).toBe(0)
      } else {
        expect(observed.value).toBeUndefined()
        expect(observed.error).toBe(sentinel)
        expect(callbackCalls).toBe(0)
        expect(f.control.calls).toHaveLength(1)
        expect(outsideReads).toBe(1)
      }
      expect(contextTraps).toBe(0)
      expect(callbackTraps).toBe(0)
    }
    for (const shape of ["missing", "inherited", "nonenumerable", "accessor", "nonplain map", "proxy map", "nonplain state", "invalid state"] as const) {
      const run = async (opaque: boolean) => {
        f.reset()
        const counts = { outside: 0, getters: 0, traps: 0, callbacks: 0 }
        f.control.before = (snapshot, count) => {
          if (count !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState, cases = state.cases
          Object.defineProperty(state.preferences, "outside", { enumerable: true, get: () => { counts.outside++; return "full clone" } })
          if (shape === "missing") Reflect.deleteProperty(state, "cases")
          if (shape === "inherited") { Reflect.deleteProperty(state, "cases"); Object.setPrototypeOf(state, { cases }) }
          if (shape === "nonenumerable") Object.defineProperty(state, "cases", { value: cases, enumerable: false })
          if (shape === "accessor") Object.defineProperty(state, "cases", { enumerable: true, get: () => { counts.getters++; return cases } })
          if (shape === "nonplain map") Object.setPrototypeOf(cases, { inherited: true })
          if (shape === "proxy map") state.cases = new Proxy(cases, {
            get: (target, key, receiver) => { counts.traps++; return Reflect.get(target, key, receiver) },
            getOwnPropertyDescriptor: (target, key) => { counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key) },
          })
          if (shape === "nonplain state") Object.setPrototypeOf(state, { inherited: true })
          if (shape === "invalid state") Reflect.set(state, "documents", [])
        }
        const read = selectSfCasesRead(f.call, (state) => { counts.callbacks++; return state.cases })
        const observed = await capture(() => f.port.read(f.request(), "cases", opaque ? (state, authority) => read(state, authority) : read))
        return { value: observed.value, error: errorShape(observed.error), counts, authorizations: [...f.control.calls] }
      }
      const opaque = await run(true), selected = await run(false)
      expect({ shape, ...selected }).toEqual({ shape, ...opaque })
      if (shape === "missing" || shape === "invalid state") {
        expect(selected.value).toMatchObject({ status: "unavailable", reason: "invalid-product-state" })
        expect(selected.counts.callbacks).toBe(0)
      } else if (shape === "proxy map") {
        expect(selected.error).not.toBeUndefined()
        expect(selected.counts.callbacks).toBe(0)
      } else {
        expect(selected.error).toBeUndefined()
        expect(selected.counts.outside).toBe(1)
        expect(selected.counts.callbacks).toBe(1)
      }
    }
  } finally { await deadline.close() }
}, 15_000)

test("C08 cases read-set preserves every reachable clone error and callback exception without replay", async () => {
  const deadline = compositionTestDeadline("cases-reachable-errors", 12_000)
  try {
    const f = await fixture(deadline)
    for (const fault of ["other case getter", "other case function", "aliased preference getter", "aliased preference function"] as const) {
      const sentinel = new Error("Original reachable cases graph failed")
      const run = async (opaque: boolean) => {
        f.reset()
        let reached = 0, callbacks = 0
        f.control.before = (snapshot, count) => {
          if (count !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState
          const owner = fault.startsWith("aliased") ? state.preferences.private : state.cases.other!
          if (!owner || typeof owner !== "object") throw new Error("Fixture graph was not prepared")
          if (fault.startsWith("aliased")) Reflect.set(state.cases.selected!, "reachablePreference", owner)
          if (fault.endsWith("function")) Reflect.set(owner, "failure", () => undefined)
          else Object.defineProperty(owner, "failure", { enumerable: true, get: () => { reached++; throw sentinel } })
        }
        const read = selectSfCasesRead(f.call, (state) => { callbacks++; return state.cases.selected })
        const observed = await capture(() => f.port.read(f.request(), "cases", opaque ? (state, authority) => read(state, authority) : read))
        expect(observed.value).toBeUndefined()
        expect(observed.error).not.toBeUndefined()
        expect(callbacks).toBe(0)
        expect(f.control.calls).toHaveLength(1)
        expect(reached).toBe(fault.endsWith("getter") ? 1 : 0)
        if (fault.endsWith("getter")) expect(observed.error).toBe(sentinel)
        return { error: errorShape(observed.error), reached, callbacks, authorizations: [...f.control.calls] }
      }
      expect(await run(false)).toEqual(await run(true))
    }
    for (const opaque of [false, true]) {
      f.reset()
      let callbacks = 0
      const sentinel = new Error("Original callback failed")
      const read = selectSfCasesRead(f.call, () => { callbacks++; throw sentinel })
      const observed = await capture(() => f.port.read(f.request(), "cases", opaque ? (state, authority) => read(state, authority) : read))
      expect(observed.error).toBe(sentinel)
      expect(callbacks).toBe(1)
      expect(f.control.calls).toHaveLength(1)
    }
    f.reset()
    expect(ok(await f.port.read(f.request(), "cases", selectSfCasesRead(f.call, (state) => state.cases.selected))))
      .toEqual(decision("selected"))
    expect(f.control.calls).toHaveLength(2)
  } finally { await deadline.close() }
}, 15_000)

test("C08 cases read-set retains admission and egress authority around asynchronous callbacks", async () => {
  const deadline = compositionTestDeadline("cases-authority-cancellation", 12_000)
  try {
    const f = await fixture(deadline)
    for (const attack of ["admission", "revocation", "principal", "policy", "revision", "abort"] as const) {
      const run = async (opaque: boolean) => {
        f.reset()
        let callbacks = 0, atCallback = 0
        const cancellation = new AbortController()
        if (attack === "admission") f.control.active = false
        const read = selectSfCasesRead(f.call, async (state) => {
          callbacks++; atCallback = f.control.calls.length
          await Promise.resolve()
          if (attack === "revocation") f.control.active = false
          if (attack === "principal") f.control.actor.principalRef = "changed"
          if (attack === "policy") f.control.actor.policyVersion = "changed"
          if (attack === "revision") f.control.actor.accessRevision = "changed"
          if (attack === "abort") cancellation.abort(new Error("Original cases read cancelled"))
          return state.cases.selected
        })
        const observed = await capture(() => f.port.read(f.request(attack === "abort" ? cancellation.signal : undefined),
          "cases", opaque ? (state, authority) => read(state, authority) : read))
        expect(callbacks).toBe(attack === "admission" ? 0 : 1)
        expect(atCallback).toBe(attack === "admission" ? 0 : 1)
        expect(observed.value?.status).not.toBe("ok")
        expect(f.control.calls).toHaveLength(attack === "admission" || attack === "abort" ? 1 : 2)
        if (attack === "admission") expect(observed).toEqual({ value: { status: "denied", reason: "product-access-unavailable" } })
        else if (attack !== "abort") expect(observed).toEqual({ value: { status: "denied", reason: "product-authority-changed" } })
        else expect(cancellation.signal.aborted).toBe(true)
        return { value: observed.value, error: errorShape(observed.error), callbacks, atCallback, calls: [...f.control.calls] }
      }
      expect(await run(false)).toEqual(await run(true))
    }
    for (const opaque of [false, true]) {
      f.reset()
      const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      let callbacks = 0
      const read = selectSfCasesRead(f.call, async (state) => {
        callbacks++; entered.resolve()
        await release.promise
        return state.cases.selected
      })
      const pending = capture(() => f.port.read(f.request(), "cases",
        opaque ? (state, authority) => read(state, authority) : read)).finally(() => entered.resolve())
      try {
        await entered.promise
        expect(callbacks).toBe(1)
        expect(f.control.calls).toHaveLength(1)
        f.control.active = false
        release.resolve()
        expect(await pending).toEqual({ value: { status: "denied", reason: "product-authority-changed" } })
        expect(callbacks).toBe(1)
        expect(f.control.calls).toHaveLength(2)
      } finally { release.resolve(); await pending }
    }
  } finally { await deadline.close() }
}, 15_000)

/** LocalStore/C08 and both register/resolve consumers are real. Deterministic
 * evidence/authority ports delimit this protocol control; this is not a native
 * installation or browser qualification and produces no performance claim. */
async function registeredConsumer(f: Awaited<ReturnType<typeof fixture>>, kind: "baseline" | "criterion") {
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const projection: DomainProjection = {
    context: { installationId: f.call.binding.installationId, projectId: f.call.binding.projectId,
      principalRef: f.call.binding.principalRef, accessRevision: f.call.binding.accessRevision,
      policyVersion: f.call.binding.policyVersion, surface: "planner", period, currency: "USD",
      capabilities: [], sourceRefs: [{ surface: "planner", type: "version", id: "forecast", incarnation: "forecast-inc",
        version: 1, fields: ["forecast"], period, observedAt: at }] },
    version: 1, engineVersion: "deterministic-source-port", components: [], values: [],
    missing: [{ field: "training", reason: "missing" }],
  }
  const incoming: Extract<BusinessEvidenceRef, { kind: "record" }> = {
    schema: "sf-evidence-v1", kind: "record", refId: "planner:forecast",
    installationId: f.call.binding.installationId, projectId: f.call.binding.projectId,
    evidenceLevel: "observed", refDigest: "", target: { surface: "planner", recordType: "version",
      recordId: "forecast", incarnation: "forecast-inc", version: 1, fields: ["forecast"], period,
      projectionDigest: digestSfValue(projection) },
  }
  const source = { ...incoming, refDigest: digestSfEvidenceRef(incoming) }
  const audit = {
    callbacks: [] as Read<unknown>[], cases: [] as SfStateResult<unknown>[],
    ids: [] as { read: number; id: string }[], caseChecks: 0, evidenceChecks: 0, revalidations: 0,
  }
  let selectedId = "selected", request = f.request()
  const ref: CaseRef = {
    get id() { audit.ids.push({ read: f.control.calls.length, id: selectedId }); return selectedId },
    get incarnation() { return selectedId + "-inc" }, version: 1,
  }
  const state = (opaque: boolean): SfProductStatePort => ({
    read: async (incomingRequest, namespace, read) => {
      if (namespace === "cases") audit.callbacks.push(read)
      const result = await f.port.read(incomingRequest, namespace,
        opaque && namespace === "cases" ? (value, authority) => read(value, authority) : read)
      if (namespace === "cases") audit.cases.push(result)
      return result
    },
    transaction: f.port.transaction,
  })
  const host = { requestFor: () => request, revalidate: async () => { audit.revalidations++; return f.control.active } }
  const authorizeCase = async (value: DecisionCase, call: TrustedDomainContext) => {
    audit.caseChecks++
    return f.control.active && value.id === ref.id && value.incarnation === ref.incarnation &&
      value.version === ref.version && value.participants.includes(call.binding.principalRef)
  }
  const registrationRef = { id: "selected", incarnation: "selected-inc", version: 1 }
  let resolve: (opaque: boolean, classified?: boolean) => Promise<PortResult<unknown>>
  if (kind === "baseline") {
    const build = (opaque: boolean) => createDecisionBaselineCoverage({
      state: state(opaque), host, resolveCase: async () => ({ status: "ok", value: ref }), authorizeCase,
      authorizeCoverage: async (value, call) => f.control.active && value.caseRef.id === ref.id &&
        value.caseRef.incarnation === ref.incarnation && value.source.refDigest === source.refDigest &&
        call.binding.principalRef === f.call.binding.principalRef,
      projectForecast: async (sourceRef) => sourceRef === source.refId ? { status: "ok", value: structuredClone(projection) }
        : { status: "unavailable", reason: "fixture-source-unavailable" },
      resolveEvidence: async (refs, call): Promise<readonly BusinessEvidenceResolution[]> => {
        audit.evidenceChecks++
        return refs.map((value) => ({
          state: value.refDigest === source.refDigest && digestSfEvidenceRef(value) === source.refDigest ? "fresh" : "invalid",
          ref: structuredClone(value), currentRef: structuredClone(value), authorizedProjection: structuredClone(projection),
          accessRevision: call.binding.accessRevision, checkedAt: at,
        }))
      },
      supports: () => false, verifySnapshot: () => true, operationIdentity: () => "cases-coverage-registration",
      proposalCoverageWrites: f.writes, now: () => at,
    })
    const selected = build(false), opaque = build(true)
    const basis: CostCoverageBasis = { id: "basis-selected", version: 1, decisionType: "renewal-transition-v1",
      categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [source] }
    const registered = ok(await selected.register({ caseRef: registrationRef, source, basis, expectedVersion: 0,
      entries: [{ status: "pending", categoryId: "training", reason: "The source supplies no training evidence" }] }, f.call))
    expect(registered.version).toBe(1)
    resolve = (full, classified = false) => classified
      ? (full ? opaque : selected).resolveClassifiedCoverage(source.refId, f.call)
      : (full ? opaque : selected).resolveForecastCoverage(source.refId, f.call)
    expect(ok(await resolve(false))).toMatchObject({ coverageRef: registered.coverageRef, basis,
      assessment: { coverageState: "pending" } })
  } else {
    const build = (opaque: boolean) => createCriterionRuleRegistry({
      state: state(opaque), host, authorizeCase,
      authorizeRule: async (value, call) => f.control.active && value.caseRef.id === ref.id &&
        value.criterionId === "cost" && call.binding.principalRef === f.call.binding.principalRef,
      verifyEvidence: async (rule, call) => {
        audit.evidenceChecks++
        return f.control.active && call.binding.principalRef === f.call.binding.principalRef &&
          rule.evidenceRefs.length === 1 && rule.evidenceRefs[0]!.refDigest === source.refDigest &&
          digestSfEvidenceRef(rule.evidenceRefs[0]!) === source.refDigest
      },
      verifySnapshot: (_snapshot, value, rule, call) => f.control.active && value.caseRef.id === rule.caseRef.id &&
        value.criterionId === rule.criterionId && call.binding.principalRef === f.call.binding.principalRef &&
        rule.evidenceRefs.length === 1 && digestSfEvidenceRef(rule.evidenceRefs[0]!) === source.refDigest,
      readMetric: async () => ({ status: "unavailable", reason: "metric-not-part-of-rule-resolution" }),
      verifyMetric: async () => false, operationIdentity: () => "cases-criterion-registration",
      proposalCoverageWrites: f.writes, now: () => at,
    })
    const selected = build(false), opaque = build(true)
    const registered = ok(await selected.register({ caseRef: registrationRef, criterionId: "cost", metricRef: "forecast.cost",
      operator: "lte", value: 100, unit: "USD", period, evidenceRefs: [source], expectedRuleVersion: 0 }, f.call))
    expect(registered.version).toBe(1)
    resolve = (full) => (full ? opaque : selected).resolve({ caseRef: ref, criterionId: "cost" }, f.call)
    expect(ok(await resolve(false))).toMatchObject({ ruleRef: registered.ruleRef, version: 1, value: 100 })
  }
  const reset = (signal?: AbortSignal, id = "selected") => {
    f.reset(); selectedId = id; request = f.request(signal)
    audit.callbacks = []; audit.cases = []; audit.ids = []
    audit.caseChecks = 0; audit.evidenceChecks = 0; audit.revalidations = 0
  }
  const snapshot = async () => ok(await f.port.read(f.request(), "cases", (value) => value))
  reset()
  return { resolve, reset, select: (id: string) => { selectedId = id }, audit, snapshot }
}

async function exerciseConsumer(kind: "baseline" | "criterion", deadline: Deadline) {
  const f = await fixture(deadline), c = await registeredConsumer(f, kind)
  const persisted = await c.snapshot()
  c.reset()
  const expected = await c.resolve(false)
  expect(expected.status).toBe("ok")
  type Attack = "normal" | "first ID" | "second ID" | "first missing" | "first revoked" | "second changed" | "second revoked" | "second aborted"
  const run = async (opaque: boolean, attack: Attack, classified = false) => {
    const cancellation = new AbortController()
    c.reset(attack === "second aborted" ? cancellation.signal : undefined, attack === "first ID" ? "other" : "selected")
    let outsideReads = 0
    const reached: number[] = []
    f.control.before = (snapshot, count) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      if (count === 1 || count === 5) Object.defineProperty(state.preferences, "outsideCases", {
        enumerable: true, get: () => { outsideReads++; return "outside the cases read-set" },
      })
      const target = attack === "first ID" || attack === "first missing" ? 1
        : attack === "first revoked" ? 2 : attack === "second revoked" ? 6 : attack === "normal" ? -1 : 5
      if (count !== target) return
      reached.push(count)
      if (attack === "first ID") c.select("selected")
      if (attack === "second ID") c.select("other")
      if (attack === "first missing") delete state.cases.selected
      if (attack === "second changed") state.cases.selected!.objective = "Fresh second admission"
      if (attack === "first revoked" || attack === "second revoked") f.control.active = false
      if (attack === "second aborted") cancellation.abort(new Error("Original second cases read cancelled"))
    }
    const result = await c.resolve(opaque, classified)
    expect(reached).toEqual(attack === "normal" ? [] : [attack === "first revoked" ? 2
      : attack === "second revoked" ? 6 : attack === "first ID" || attack === "first missing" ? 1 : 5])
    const firstOnly = attack === "first missing" || attack === "first revoked"
    expect(c.audit.callbacks).toHaveLength(firstOnly ? 1 : 2)
    if (!firstOnly) expect(c.audit.callbacks[0]).not.toBe(c.audit.callbacks[1])
    expect(c.audit.ids.filter((entry) => entry.read === 1)).toEqual([{ read: 1, id: "selected" }])
    if (!firstOnly && attack !== "second aborted")
      expect(c.audit.ids.filter((entry) => entry.read === 5)).toEqual([{ read: 5, id: attack === "second ID" ? "other" : "selected" }])
    if (attack === "normal" || attack === "first ID") {
      expect(result.status).toBe("ok")
      if (!classified) expect(result).toEqual(expected)
      expect(f.control.calls).toEqual((["cases", "cases", "preferences", "preferences",
        "cases", "cases", "preferences", "preferences"] as const).map((namespace) => ({ namespace, mode: "read" })))
      expect(c.audit.cases).toHaveLength(2)
      expect(ok(c.audit.cases[0]!)).toEqual(ok(c.audit.cases[1]!))
      expect(ok(c.audit.cases[0]!)).not.toBe(ok(c.audit.cases[1]!))
      expect(outsideReads).toBe(opaque ? 2 : 0)
      expect(c.audit.caseChecks).toBe(2)
      expect(c.audit.evidenceChecks).toBe(2)
      expect(c.audit.revalidations).toBe(2)
      expect(c.audit.ids.some((entry) => entry.read === 0)).toBe(false)
    } else {
      expect(result.status).not.toBe("ok")
      if (attack === "first missing") {
        expect(result).toEqual({ status: "denied", reason: kind === "baseline" ? "baseline-coverage-access-unavailable" : "criterion-access-unavailable" })
        expect(c.audit.cases[0]).toMatchObject({ status: "ok", value: undefined })
        expect(f.control.calls).toHaveLength(2)
        expect(c.audit.caseChecks).toBe(0)
      } else if (attack === "first revoked") {
        expect(result).toEqual(kind === "baseline"
          ? { status: "denied", reason: "baseline-coverage-access-unavailable" }
          : { status: "unavailable", reason: "criterion-unavailable" })
        expect(c.audit.cases).toEqual([{ status: "denied", reason: "product-authority-changed" }])
        expect(f.control.calls).toHaveLength(2)
      } else if (attack === "second aborted") {
        expect(cancellation.signal.aborted).toBe(true)
        expect(f.control.calls.length).toBeGreaterThanOrEqual(5)
      } else {
        expect(result).toEqual({ status: "stale", reason: kind === "baseline" ? "baseline-coverage-changed" : "criterion-changed" })
        expect(c.audit.caseChecks).toBe(1)
        if (attack === "second revoked") {
          expect(c.audit.cases[1]).toEqual({ status: "denied", reason: "product-authority-changed" })
          expect(f.control.calls).toHaveLength(7)
        } else {
          expect(f.control.calls).toHaveLength(8)
          expect(ok(c.audit.cases[1]!)).not.toEqual(ok(c.audit.cases[0]!))
        }
      }
    }
    return { result, calls: [...f.control.calls], cases: [...c.audit.cases], ids: [...c.audit.ids],
      callbacks: c.audit.callbacks.length, caseChecks: c.audit.caseChecks, evidenceChecks: c.audit.evidenceChecks,
      revalidations: c.audit.revalidations, reached, aborted: cancellation.signal.aborted }
  }
  for (const attack of ["normal", "first ID", "second ID", "first missing", "first revoked", "second changed", "second revoked", "second aborted"] as const)
    expect(await run(false, attack)).toEqual(await run(true, attack))
  if (kind === "baseline") expect(await run(false, "normal", true)).toEqual(await run(true, "normal", true))
  c.reset()
  expect(await c.snapshot()).toEqual(persisted)
  c.reset()
  expect(await c.resolve(false)).toEqual(expected)
}

test("Baseline cases reads preserve late IDs, two fresh admissions, revocation and cancellation", async () => {
  const deadline = compositionTestDeadline("baseline-cases-real-resolve", 12_000)
  try { await exerciseConsumer("baseline", deadline) }
  finally { await deadline.close() }
}, 15_000)

test("Criterion cases reads preserve late IDs, two fresh admissions, revocation and cancellation", async () => {
  const deadline = compositionTestDeadline("criterion-cases-real-resolve", 12_000)
  try { await exerciseConsumer("criterion", deadline) }
  finally { await deadline.close() }
}, 15_000)
