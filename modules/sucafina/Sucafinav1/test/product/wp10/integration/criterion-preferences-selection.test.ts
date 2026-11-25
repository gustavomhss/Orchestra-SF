import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult } from "../../../../product/contracts/state.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfProductState, initializeAbsentSfProductState, selectSfPreference } from "../../../../product/host-binding/state-provider.ts"
import { createCriterionRuleRegistry, criterionRuleKey, type CriterionRule } from "../../../../product/decisions/criterion-rules.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read<T> = (state: Readonly<SfProductState>, authority: SfStateAuthority) => T | Promise<T>
type PreferenceState = Pick<SfProductState, "preferences">

function ok<T>(result: SfStateResult<T> | PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

async function capture<T>(work: () => T | Promise<T>) {
  try { return { value: await work() } }
  catch (error) { return { error } }
}

/** Original C3 criterion-rules readRule callback, retained as a differential
 * oracle for custom ports and the provider's unmarked full-state path. */
function originalPreference(key: string, context: TrustedDomainContext) {
  return (state: PreferenceState, authority: SfStateAuthority) =>
    authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.preferences[key] : undefined
}

function frozenContext(): TrustedUiContext {
  return Object.freeze({ kind: "ui", binding: Object.freeze({
    installationId: "criterion-selector-installation", projectId: "project", principalRef: "person",
    requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2028-01-01T00:00:00Z",
  }), lease: {} }) as TrustedUiContext
}

function decision(id: string): DecisionCase {
  return { id, incarnation: id + "-inc", version: 1, state: "investigating", objective: "An original criterion",
    horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: ["person"],
    criteria: [{ id: "cost", description: "Observe the original amount", required: true }],
    sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [] }
}

async function fixture(deadline: Deadline) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-criterion-preferences-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  await initializeAbsentSfProductState(store, () => "criterion-selector-state")
  await store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.cases.selected = decision("selected")
    state.cases.other = decision("other")
    state.preferences.private = { amount: 12 }
    state.preferences.unrelated = { retained: "the complete graph" }
    return { commit: true, value: undefined }
  })
  const actor: SfStateAuthority = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
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
  const request = (signal = deadline.signal) => new Request("https://criterion-selector.example.test/read", { signal })
  const reset = () => { control.active = true; control.actor = { ...actor }; control.calls = []; control.before = undefined }
  return { store, port, control, request, reset, writes, call: frozenContext() }
}

test("Criterion preference selector preserves authority order, short-circuit and live opaque context", async () => {
  const deadline = compositionTestDeadline("criterion-preference-opaque-order", 12_000)
  try {
    const fields = ["principalRef", "policyVersion", "accessRevision"] as const
    const values = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
    const selected = { original: true }
    const sentinel = new Error("Original preferences getter")
    for (const mismatch of [...fields, "none"] as const) {
      for (const throwing of [false, true]) {
        const run = async (marked: boolean) => {
          deadline.check()
          const order: string[] = []
          const authority = Object.fromEntries(fields.map((field) => [field, values[field]])) as SfStateAuthority
          const binding = { ...frozenContext().binding }
          for (const field of fields) {
            Object.defineProperty(authority, field, { enumerable: true,
              get: () => { order.push("authority." + field); return values[field] } })
            Object.defineProperty(binding, field, { enumerable: true,
              get: () => { order.push("binding." + field); return field === mismatch ? "changed" : values[field] } })
          }
          const context = Object.freeze(Object.defineProperty({ ...frozenContext() }, "binding", {
            enumerable: true, get: () => { order.push("context.binding"); return binding },
          })) as TrustedDomainContext
          const preferences = new Proxy({ private: selected }, {
            get: (target, key, receiver) => { order.push("preferences." + String(key)); return Reflect.get(target, key, receiver) },
          })
          const state = Object.defineProperty({}, "preferences", { enumerable: true, get: () => {
            order.push("state.preferences")
            if (throwing) throw sentinel
            return preferences
          } }) as Readonly<SfProductState>
          const read = marked ? selectSfPreference("private", context) : originalPreference("private", context)
          expect(order).toEqual([])
          const port: SfProductStatePort = {
            read: async (_request, _namespace, callback) => ({ status: "ok", storageVersion: 0,
              aggregateRevision: 0, incarnation: "opaque", value: await callback(state, authority) }),
            transaction: async () => { throw new Error("No transaction belongs to this read control") },
          }
          const result = await capture(() => port.read(new Request("https://opaque.example.test", { signal: deadline.signal }),
            "preferences", read))
          const last = mismatch === "none" ? fields.length : fields.indexOf(mismatch) + 1
          const expected = fields.slice(0, last).flatMap((field) =>
            ["authority." + field, "context.binding", "binding." + field])
          if (mismatch === "none") expected.push("state.preferences", ...(throwing ? [] : ["preferences.private"]))
          expect(order).toEqual(expected)
          if (mismatch !== "none") expect(result).toMatchObject({ value: { status: "ok", value: undefined } })
          else if (throwing) { expect(result.error).toBe(sentinel); expect(result.value).toBeUndefined() }
          else expect(ok(result.value!)).toBe(selected)
          return { result, order }
        }
        expect(await run(true)).toEqual(await run(false))
      }
    }

    const mutable = { ...frozenContext(), binding: { ...frozenContext().binding } }
    const read = selectSfPreference("private", mutable)
    mutable.binding.accessRevision = "changed after construction"
    expect(read({ preferences: { private: selected } }, values)).toBeUndefined()
    mutable.binding.accessRevision = values.accessRevision
    expect(read({ preferences: { private: selected } }, values)).toBe(selected)

    let traps = 0, coercions = 0
    const proxyContext = new Proxy(frozenContext(), {
      get: (target, key, receiver) => { traps++; return Reflect.get(target, key, receiver) },
      getOwnPropertyDescriptor: (target, key) => { traps++; return Reflect.getOwnPropertyDescriptor(target, key) },
      getPrototypeOf: (target) => { traps++; return Reflect.getPrototypeOf(target) },
    })
    const proxyRead = selectSfPreference("private", proxyContext)
    expect(traps).toBe(0)
    expect(proxyRead({ preferences: { private: selected } }, values)).toBe(selected)
    expect(traps).toBe(3)
    const key = { [Symbol.toPrimitive]: () => { coercions++; return "private" } } as unknown as string
    const lazyKey = selectSfPreference(key, frozenContext())
    expect(coercions).toBe(0)
    expect(lazyKey({ preferences: { private: selected } }, { ...values, principalRef: "other" })).toBeUndefined()
    expect(coercions).toBe(0)
    expect(lazyKey({ preferences: { private: selected } }, values)).toBe(selected)
    expect(coercions).toBe(1)
  } finally { await deadline.close() }
}, 15_000)

test("Criterion preference selector clones its complete fresh graph under both C08 authorizations", async () => {
  const deadline = compositionTestDeadline("criterion-preference-complete-graph", 12_000)
  try {
    const f = await fixture(deadline)
    type Graph = { amount: number; self: Graph; preferences: SfProductState["preferences"]; related: DecisionCase }
    const retained: Graph[] = []
    const run = async (marked: boolean) => {
      f.reset()
      let outsideReads = 0, insideReads = 0
      let source: Graph | undefined
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        const graph = state.preferences.private as Graph
        source = graph
        graph.self = graph
        graph.preferences = state.preferences
        graph.related = state.cases.other!
        state.preferences.alias = graph
        state.preferences.reachableCase = graph.related
        Object.defineProperty(state.preferences, "insideClone", { enumerable: true,
          get: () => { insideReads++; return { observed: true } } })
        Object.defineProperty(state.cases.selected!, "outsideClone", { enumerable: true,
          get: () => { outsideReads++; return "outside this preferences graph" } })
      }
      const selector = selectSfPreference("private", f.call)
      const result = await f.port.read(f.request(), "preferences",
        marked ? selector : (state, authority) => selector(state, authority))
      expect(f.control.calls).toEqual([{ namespace: "preferences", mode: "read" }, { namespace: "preferences", mode: "read" }])
      expect(insideReads).toBe(1)
      expect(outsideReads).toBe(marked ? 0 : 1)
      expect(result).toMatchObject({ status: "ok", storageVersion: 0, aggregateRevision: 0, incarnation: "criterion-selector-state" })
      const graph = ok(result) as Graph
      expect(graph).not.toBe(source)
      expect(graph.self).toBe(graph)
      expect(graph.preferences.private).toBe(graph)
      expect(graph.preferences.alias).toBe(graph)
      expect(graph.preferences.reachableCase).toBe(graph.related)
      expect(graph.related).toEqual(decision("other"))
      expect(graph.preferences.insideClone).toEqual({ observed: true })
      expect(graph.preferences.unrelated).toEqual({ retained: "the complete graph" })
      retained.push(graph)
      return result
    }
    const original = await run(false), marked = await run(true)
    expect(marked).toEqual(original)
    expect(retained[0]).not.toBe(retained[1])
    retained[1]!.amount = 999
    retained[1]!.related.objective = "Caller-owned mutation"
    retained[1]!.preferences.callerOnly = true
    expect(retained[0]!.amount).toBe(12)
    expect(await run(true)).toEqual(original)
    await f.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.preferences.private = { amount: 24 }
      state.versions.preferences++
      state.revision++
      return { commit: true, value: undefined }
    })
    f.reset()
    const fresh = await f.port.read(f.request(), "preferences", selectSfPreference("private", f.call))
    expect(f.control.calls).toHaveLength(2)
    expect(fresh).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1,
      incarnation: "criterion-selector-state", value: { amount: 24 } })
    f.reset()
    expect(await f.port.read(f.request(), "preferences", originalPreference("private", f.call))).toEqual(fresh)
  } finally { await deadline.close() }
}, 15_000)

test("Criterion preference selector distinguishes its explicit read-set from opaque fallback and reachable errors", async () => {
  const deadline = compositionTestDeadline("criterion-preference-fallback-errors", 12_000)
  try {
    const f = await fixture(deadline)
    type Mode = "marked" | "unmarked" | "wrapped" | "mutable" | "proxy context" | "binding accessor" | "nonplain map" | "wrong namespace"
    const outside = async (mode: Mode, fault: "getter" | "function") => {
      deadline.check()
      f.reset()
      let outsideReads = 0, contextReads = 0
      const sentinel = new Error("Original outside-read-set failure")
      const context = mode === "mutable" ? { ...f.call, binding: { ...f.call.binding } }
        : mode === "proxy context" ? new Proxy(f.call, {
          get: (target, key, receiver) => { contextReads++; return Reflect.get(target, key, receiver) },
          getOwnPropertyDescriptor: (target, key) => { contextReads++; return Reflect.getOwnPropertyDescriptor(target, key) },
        })
        : mode === "binding accessor" ? Object.freeze(Object.defineProperty({ ...f.call }, "binding", {
          enumerable: true, get: () => { contextReads++; return f.call.binding },
        })) : f.call
      const selector = selectSfPreference("private", context)
      expect(contextReads).toBe(0)
      const read = mode === "unmarked" ? originalPreference("private", context)
        : mode === "wrapped" ? (state: Readonly<SfProductState>, authority: SfStateAuthority) => selector(state, authority)
        : selector
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (mode === "nonplain map") Object.setPrototypeOf(state.preferences, { inherited: true })
        if (fault === "getter") Object.defineProperty(state.cases.other!, "outsideReadSet", {
          enumerable: true, get: () => { outsideReads++; throw sentinel },
        })
        else Reflect.set(state.cases.other!, "outsideReadSet", () => undefined)
      }
      const result = await capture(() => f.port.read(f.request(), mode === "wrong namespace" ? "cases" : "preferences", read))
      // Assertions live outside C08/LocalStore, so a caught producer exception
      // cannot satisfy the test before these counters and identities are checked.
      if (mode === "marked") {
        expect(result.error).toBeUndefined()
        expect(ok(result.value!)).toEqual({ amount: 12 })
        expect(f.control.calls).toHaveLength(2)
        expect(outsideReads).toBe(0)
      } else {
        expect(result.value).toBeUndefined()
        expect(result.error).not.toBeUndefined()
        expect(f.control.calls).toHaveLength(1)
        expect(outsideReads).toBe(fault === "getter" ? 1 : 0)
        if (fault === "getter") expect(result.error).toBe(sentinel)
        expect(contextReads).toBe(0)
      }
      return { error: result.error instanceof Error ? { name: result.error.name, message: result.error.message } : result.error,
        outsideReads, authorizations: f.control.calls.length }
    }
    for (const fault of ["getter", "function"] as const) {
      const original = await outside("unmarked", fault)
      await outside("marked", fault)
      for (const mode of ["wrapped", "mutable", "proxy context", "binding accessor", "nonplain map", "wrong namespace"] as const)
        expect(await outside(mode, fault)).toEqual(original)
    }

    const reachable = async (marked: boolean, fault: "other preference getter" | "other preference function" | "aliased case getter") => {
      f.reset()
      let reached = 0
      const sentinel = new Error("Original reachable preference graph failed")
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (fault === "other preference function") state.preferences.unrelatedFailure = () => undefined
        else {
          const owner = fault === "aliased case getter" ? state.cases.other! : state.preferences
          if (fault === "aliased case getter") state.preferences.reachableCase = owner
          Object.defineProperty(owner, "reachableFailure", { enumerable: true, get: () => { reached++; throw sentinel } })
        }
      }
      const selector = selectSfPreference("private", f.call)
      const result = await capture(() => f.port.read(f.request(), "preferences",
        marked ? selector : (state, authority) => selector(state, authority)))
      expect(result.value).toBeUndefined()
      expect(result.error).not.toBeUndefined()
      expect(f.control.calls).toHaveLength(1)
      expect(reached).toBe(fault === "other preference function" ? 0 : 1)
      if (fault !== "other preference function") expect(result.error).toBe(sentinel)
      return { reached, authorizations: f.control.calls.length,
        error: result.error instanceof Error ? { name: result.error.name, message: result.error.message } : result.error }
    }
    for (const fault of ["other preference getter", "other preference function", "aliased case getter"] as const)
      expect(await reachable(true, fault)).toEqual(await reachable(false, fault))
    f.reset()
    expect(ok(await f.port.read(f.request(), "preferences", selectSfPreference("private", f.call)))).toEqual({ amount: 12 })
    expect(f.control.calls).toHaveLength(2)
  } finally { await deadline.close() }
}, 15_000)

/** LocalStore/C08 and register/resolve are real producers. These deterministic
 * source and authority ports delimit this protocol control; no browser/native
 * installation or runtime performance result is inferred from it. */
async function registeredRules(f: Awaited<ReturnType<typeof fixture>>) {
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const ref = { id: "selected", incarnation: "selected-inc", version: 1 }
  const incoming: Extract<BusinessEvidenceRef, { kind: "record" }> = {
    schema: "sf-evidence-v1", kind: "record", refId: "planner:forecast",
    installationId: f.call.binding.installationId, projectId: f.call.binding.projectId,
    evidenceLevel: "observed", refDigest: "", target: { surface: "planner", recordType: "version",
      recordId: "forecast", incarnation: "forecast-inc", version: 1, fields: ["forecast"], period,
      projectionDigest: digestSfValue({ originalForecast: 120, period }) },
  }
  const source = { ...incoming, refDigest: digestSfEvidenceRef(incoming) }
  const evidenceIsCurrent = (rule: CriterionRule, context: TrustedDomainContext) =>
    f.control.active && context.binding.principalRef === f.call.binding.principalRef &&
    rule.evidenceRefs.length === 1 && rule.evidenceRefs[0]!.refDigest === source.refDigest &&
    digestSfEvidenceRef(rule.evidenceRefs[0]!) === source.refDigest
  const audit = {
    callbacks: [] as Read<unknown>[], preferences: [] as SfStateResult<unknown>[],
    caseChecks: 0, evidenceChecks: 0, ruleChecks: 0, revalidations: 0, metricReads: 0,
  }
  let request = f.request(), operation = "criterion-registration-one"
  const build = (opaque: boolean) => {
    const state: SfProductStatePort = {
      read: async (incomingRequest, namespace, read) => {
        if (namespace === "preferences") audit.callbacks.push(read)
        const result = await f.port.read(incomingRequest, namespace,
          opaque ? (value, authority) => read(value, authority) : read)
        if (namespace === "preferences") audit.preferences.push(result)
        return result
      },
      transaction: f.port.transaction,
    }
    return createCriterionRuleRegistry({
      state, host: { requestFor: () => request, revalidate: async () => {
        audit.revalidations++
        return f.control.active
      } },
      authorizeCase: async (value, context) => {
        audit.caseChecks++
        return f.control.active && value.id === ref.id && value.incarnation === ref.incarnation &&
          value.version === ref.version && value.participants.includes(context.binding.principalRef)
      },
      authorizeRule: async (value, context) => {
        audit.ruleChecks++
        return f.control.active && value.caseRef.id === ref.id && value.criterionId === "cost" &&
          context.binding.principalRef === f.call.binding.principalRef
      },
      verifyEvidence: async (rule, context) => {
        audit.evidenceChecks++
        return evidenceIsCurrent(rule, context)
      },
      verifySnapshot: (_snapshot, value, rule, context) =>
        value.caseRef.id === rule.caseRef.id && value.criterionId === rule.criterionId && evidenceIsCurrent(rule, context),
      readMetric: async () => { audit.metricReads++; return { status: "unavailable", reason: "metric-not-part-of-rule-resolution" } },
      verifyMetric: async () => false, operationIdentity: () => operation, proposalCoverageWrites: f.writes, now: () => at,
    })
  }
  const selected = build(false), opaque = build(true)
  const registration = { caseRef: ref, criterionId: "cost", metricRef: "forecast.cost", operator: "lte" as const,
    value: 100, unit: "USD", period, evidenceRefs: [source], expectedRuleVersion: 0 }
  const first = ok(await selected.register(registration, f.call))
  expect(first.version).toBe(1)
  const firstRule = ok(await selected.resolve({ caseRef: ref, criterionId: "cost" }, f.call))
  operation = "criterion-registration-two"
  const second = ok(await selected.register({ ...registration, value: 75, expectedRuleVersion: 1 }, f.call))
  expect(second.version).toBe(2)
  const secondRule = ok(await selected.resolve({ caseRef: ref, criterionId: "cost" }, f.call))
  expect(firstRule).toMatchObject({ ruleRef: first.ruleRef, version: 1, value: 100 })
  expect(secondRule).toMatchObject({ ruleRef: second.ruleRef, version: 2, value: 75 })
  expect(secondRule.recordDigest).not.toBe(firstRule.recordDigest)
  const key = criterionRuleKey(ref, "cost")
  const reset = (signal?: AbortSignal) => {
    f.reset()
    request = f.request(signal)
    audit.callbacks = []; audit.preferences = []
    audit.caseChecks = 0; audit.evidenceChecks = 0; audit.ruleChecks = 0; audit.revalidations = 0; audit.metricReads = 0
  }
  const snapshot = () => f.port.read(f.request(), "preferences", (state) => structuredClone(state))
  reset()
  return { selected, opaque, ref, key, firstRule, secondRule, audit, reset, snapshot }
}

test("Criterion resolve admits two distinct preference callbacks and preserves its captured key and original producers", async () => {
  const deadline = compositionTestDeadline("criterion-preference-real-resolve", 12_000)
  try {
    const f = await fixture(deadline), c = await registeredRules(f)
    const persisted = await c.snapshot()
    const run = async (opaque: boolean, replaceAtBothAdmissions: boolean) => {
      c.reset()
      let outsideReads = 0
      const keyObservations: { field: string; authorizations: number }[] = []
      const trackedRef = {
        get id() { keyObservations.push({ field: "id", authorizations: f.control.calls.length }); return c.ref.id },
        get incarnation() { keyObservations.push({ field: "incarnation", authorizations: f.control.calls.length }); return c.ref.incarnation },
        get version() { keyObservations.push({ field: "version", authorizations: f.control.calls.length }); return c.ref.version },
      }
      const request = { caseRef: trackedRef,
        get criterionId() { keyObservations.push({ field: "criterionId", authorizations: f.control.calls.length }); return "cost" },
      }
      f.control.before = (snapshot, count) => {
        if (count !== 3 && count !== 7) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (replaceAtBothAdmissions) state.preferences[c.key] = structuredClone(c.firstRule)
        Object.defineProperty(state.cases.other!, "cloneProbe", { enumerable: true,
          get: () => { outsideReads++; return "outside preferences" } })
      }
      const result = await (opaque ? c.opaque : c.selected).resolve(request, f.call)
      const expected = replaceAtBothAdmissions ? c.firstRule : c.secondRule
      expect(result).toEqual({ status: "ok", value: expected })
      expect(c.audit.callbacks).toHaveLength(2)
      expect(c.audit.callbacks[0]).not.toBe(c.audit.callbacks[1])
      expect(c.audit.preferences).toHaveLength(2)
      expect(c.audit.preferences.map((entry) => ok(entry))).toEqual([expected, expected])
      expect(f.control.calls).toEqual(["cases", "cases", "preferences", "preferences",
        "cases", "cases", "preferences", "preferences"].map((namespace) => ({ namespace, mode: "read" })))
      expect(outsideReads).toBe(opaque ? 2 : 0)
      expect({ caseChecks: c.audit.caseChecks, evidenceChecks: c.audit.evidenceChecks, ruleChecks: c.audit.ruleChecks,
        revalidations: c.audit.revalidations, metricReads: c.audit.metricReads }).toEqual({
        caseChecks: 2, evidenceChecks: 2, ruleChecks: 0, revalidations: 2, metricReads: 0,
      })
      // No request key input is reread after the second case admission and
      // before the second preferences admission. Both callbacks use key42.
      expect(keyObservations.filter((entry) => entry.authorizations === 6)).toEqual([])
      expect(keyObservations.filter((entry) => entry.authorizations === 2 && entry.field === "criterionId")).toHaveLength(2)
      const value = ok(result)
      expect(value).not.toBe(ok(c.audit.preferences[0]!))
      expect(value).not.toBe(ok(c.audit.preferences[1]!))
      expect(value.recordDigest).toBe(expected.recordDigest)
      return { result, calls: [...f.control.calls], preferences: [...c.audit.preferences], keyObservations }
    }
    for (const replace of [false, true]) {
      const original = await run(true, replace), selected = await run(false, replace)
      expect(selected).toEqual(original)
      const detached = ok(selected.result)
      detached.value = 999
      detached.evidenceRefs = []
      expect(ok(original.result)).toEqual(replace ? c.firstRule : c.secondRule)
      expect(await run(false, replace)).toEqual(original)
    }
    c.reset()
    expect(await c.snapshot()).toEqual(persisted)
  } finally { await deadline.close() }
}, 15_000)

test("Criterion resolve preserves fresh first and second read failures, revocation and cancellation", async () => {
  const deadline = compositionTestDeadline("criterion-preference-resolve-refusals", 12_000)
  try {
    const f = await fixture(deadline), c = await registeredRules(f)
    const persisted = await c.snapshot()
    type Attack = "first changed" | "second changed" | "first missing" | "first revoked" | "second revoked" | "second aborted"
    const run = async (opaque: boolean, attack: Attack) => {
      const cancellation = new AbortController()
      c.reset(attack === "second aborted" ? cancellation.signal : undefined)
      const reached: number[] = []
      f.control.before = (snapshot, count) => {
        const selected = attack === "first changed" || attack === "first missing" ? 3
          : attack === "first revoked" ? 4 : attack === "second revoked" ? 8 : 7
        if (count !== selected) return
        reached.push(count)
        const state = snapshot.data.__sfProductV1 as SfProductState
        if (attack === "first changed" || attack === "second changed") state.preferences[c.key] = structuredClone(c.firstRule)
        else if (attack === "first missing") delete state.preferences[c.key]
        else if (attack === "second aborted") cancellation.abort(new Error("Original second rule read cancelled"))
        else f.control.active = false
      }
      const result = await (opaque ? c.opaque : c.selected).resolve({ caseRef: c.ref, criterionId: "cost" }, f.call)
      expect(result.status).not.toBe("ok")
      expect(reached).toHaveLength(1)
      expect(c.audit.metricReads).toBe(0)
      expect(c.audit.ruleChecks).toBe(0)
      if (attack === "first missing") {
        expect(result).toEqual({ status: "needs-input", reason: "criterion-rule-unavailable" })
        expect(f.control.calls).toHaveLength(4)
        expect(c.audit.callbacks).toHaveLength(1)
        expect(c.audit.evidenceChecks).toBe(0)
      } else if (attack === "first revoked") {
        expect(result).toEqual({ status: "unavailable", reason: "criterion-state-unavailable" })
        expect(c.audit.preferences).toEqual([{ status: "denied", reason: "product-authority-changed" }])
        expect(f.control.calls).toHaveLength(4)
        expect(c.audit.callbacks).toHaveLength(1)
      } else {
        expect(c.audit.callbacks).toHaveLength(2)
        expect(c.audit.callbacks[0]).not.toBe(c.audit.callbacks[1])
        expect(c.audit.evidenceChecks).toBe(1)
        if (attack !== "second aborted") {
          expect(result).toEqual({ status: "stale", reason: "criterion-changed" })
          expect(f.control.calls).toHaveLength(8)
          if (attack === "second revoked")
            expect(c.audit.preferences[1]).toEqual({ status: "denied", reason: "product-authority-changed" })
          else {
            expect(c.audit.preferences.map((entry) => ok(entry))).toEqual(attack === "first changed"
              ? [c.firstRule, c.secondRule] : [c.secondRule, c.firstRule])
          }
        } else {
          expect(cancellation.signal.aborted).toBe(true)
          expect(f.control.calls.length).toBeGreaterThanOrEqual(7)
        }
      }
      return { result, calls: [...f.control.calls], preferences: [...c.audit.preferences], reached,
        callbackCount: c.audit.callbacks.length, caseChecks: c.audit.caseChecks, evidenceChecks: c.audit.evidenceChecks,
        revalidations: c.audit.revalidations, aborted: cancellation.signal.aborted }
    }
    for (const attack of ["first changed", "second changed", "first missing", "first revoked", "second revoked", "second aborted"] as const)
      expect(await run(false, attack)).toEqual(await run(true, attack))
    c.reset()
    expect(await c.snapshot()).toEqual(persisted)
    c.reset()
    expect(await c.selected.resolve({ caseRef: c.ref, criterionId: "cost" }, f.call)).toEqual({ status: "ok", value: c.secondRule })
    expect(f.control.calls).toHaveLength(8)
    expect(c.audit.callbacks).toHaveLength(2)
  } finally { await deadline.close() }
}, 15_000)
