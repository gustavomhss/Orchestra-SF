import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import type { DecisionCase, ScenarioComparison, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult } from "../../../../product/contracts/state.ts"
import { createSfProductState, initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createDecisionPortfolioSelection, selectionKey, type PortfolioSelection } from "../../../../product/decisions/portfolio-selection.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => unknown | Promise<unknown>
type SelectionInput = Parameters<typeof createDecisionPortfolioSelection>[0]
type CaseRef = { id: string; incarnation: string; version: number }

const actor: SfStateAuthority = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
const period = { start: "2027-01-01", end: "2027-12-31" }

function frozenContext(): TrustedUiContext {
  return Object.freeze({ kind: "ui", binding: Object.freeze({
    installationId: "portfolio-selection-preferences", projectId: "project", principalRef: "person",
    requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2028-01-01T00:00:00Z",
  }), lease: {} }) as TrustedUiContext
}

function scenario(id: string): ScenarioResult {
  return { id: "scenario:" + id, version: 1, components: [], currency: "USD", horizon: period,
    sourceRefs: [], unresolvedConditions: ["fixture-coverage-pending"], restrictions: [],
    comparisonStatus: "conditioned", knownSubtotal: 12, total: null,
    costCoverage: { coverageState: "pending", basisId: "basis", basisVersion: 1,
      alternativeId: id, alternativeVersion: 1, currency: "USD", horizon: period,
      entries: [{ status: "pending", categoryId: "cost", reason: "fixture-coverage-pending" }],
      issues: [], evaluatedSourceRefs: [], derivedMissingCategoryIds: ["cost"] } }
}

function decision(id = "selected"): DecisionCase {
  return { id, incarnation: id + "-inc", version: 1, state: "investigating",
    objective: "Observe the original portfolio selection", horizon: period, currency: "USD", participants: ["person"],
    criteria: [{ id: "cost", description: "Original selected constraint", required: true }],
    sourceRefs: [], alternatives: ["baseline", "candidate"].map((alternative) => ({
      id: alternative, version: 1, title: alternative,
      scenario: { baseRef: "planner:fixture", operations: [], assumptions: [] }, result: scenario(alternative),
    })), costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
}

function ok<T>(result: SfStateResult<T> | PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

async function capture<T>(work: () => T | Promise<T>) {
  try { return { value: await work() } }
  catch (error) { return { error } }
}

/** As in the existing baseline consumer control, capture the actual callback
 * without invoking it. Getter and error assertions then run outside the
 * production method's catch; an absorbed assertion cannot make this test pass. */
async function captureSelectionCallback(call: TrustedDomainContext, deadline: Deadline) {
  const value = decision()
  const source = new Request("https://selection-custom.example.test", { signal: deadline.signal })
  let selectedRef: CaseRef = { id: value.id, incarnation: value.incarnation, version: value.version }
  const order: string[] = [], callbacks: Read[] = []
  const seen: { request: Request; namespace: SfStateNamespace }[] = []
  let unused = 0, caseChecks = 0, revalidations = 0
  const request = { get caseRef() { order.push("request.caseRef"); return selectedRef } }
  const readPort: SfProductStatePort["read"] = async (incoming, namespace, read) => {
    order.push("call:" + namespace)
    seen.push({ request: incoming, namespace })
    if (namespace === "preferences") {
      callbacks.push(read)
      return { status: "unavailable", reason: "callback-captured-without-invocation" }
    }
    // The custom port supplies only its declared cases input in this capture.
    return { status: "ok", storageVersion: 0, aggregateRevision: 0, incarnation: "custom-state",
      value: await read({ cases: { selected: value } } as unknown as Readonly<SfProductState>, actor) }
  }
  const state: SfProductStatePort = {
    get read() { order.push("lookup:read"); return readPort },
    transaction: async () => { unused++; throw new Error("No write belongs to callback capture") },
  }
  const registry = createDecisionPortfolioSelection({
    state, host: { requestFor: () => source, revalidate: async () => { revalidations++; return true } },
    compare: async () => { unused++; return { status: "unavailable", reason: "capture-only" } },
    authorizeCase: async (current) => { caseChecks++; return current.id === value.id },
    authorizeSelection: async () => { unused++; return false },
    verifySnapshot: () => { unused++; return false },
    operationIdentity: () => { unused++; return undefined }, proposalCoverageWrites: new WeakSet<object>(),
    now: () => { unused++; return "2027-02-02T00:00:00Z" },
  })
  const result = await registry.read(request, call)
  expect(result).toEqual({ status: "unavailable", reason: "selection-unavailable" })
  expect(seen).toEqual([{ request: source, namespace: "cases" }, { request: source, namespace: "preferences" }])
  expect(order.slice(-2)).toEqual(["lookup:read", "call:preferences"])
  expect(caseChecks).toBe(1)
  expect(revalidations).toBe(1)
  expect(unused).toBe(0)
  expect(callbacks).toHaveLength(1)
  const read = callbacks[0]
  if (!read) throw new Error("The actual selection preference callback was not delivered")
  return { read, order, move: (ref: CaseRef) => { selectedRef = ref } }
}

test("Portfolio selection callback preserves its authority gate, port lookup and late selection key on custom ports", async () => {
  const deadline = compositionTestDeadline("portfolio-selection-original-callback", 12_000)
  try {
    const fields = ["principalRef", "policyVersion", "accessRevision"] as const
    for (const mode of ["frozen", "mutable", "binding accessor"] as const) {
      deadline.check()
      const base = frozenContext(), binding = { ...base.binding }
      const contextOrder: string[] = []
      const call = mode === "frozen" ? base : mode === "mutable" ? { ...base, binding }
        : Object.freeze(Object.defineProperty({ ...base }, "binding", {
          enumerable: true, get: () => { contextOrder.push("context.binding"); return binding },
        }))
      const captured = await captureSelectionCallback(call, deadline)
      const later = { id: "later", incarnation: "later-inc", version: 2 }
      const key = selectionKey(later)
      captured.move(later)
      const selected = { retained: "late-key-value" }
      for (const mismatch of [...fields, "none"] as const) {
        captured.order.length = 0
        contextOrder.length = 0
        const authorityOrder: string[] = []
        const authority = { ...actor }
        for (const field of fields) Object.defineProperty(authority, field, { enumerable: true,
          get: () => { authorityOrder.push(field); return field === mismatch ? "different" : actor[field] } })
        let namespaceReads = 0, valueReads = 0
        const preferences = Object.defineProperty({}, key, { enumerable: true,
          get: () => { valueReads++; captured.order.push("selection.value"); return selected } })
        const state = Object.defineProperty({}, "preferences", { enumerable: true,
          get: () => { namespaceReads++; captured.order.push("state.preferences"); return preferences } }) as Readonly<SfProductState>
        const result = await capture(() => captured.read(state, authority))
        const reached = mismatch === "none" ? fields.length : fields.indexOf(mismatch) + 1
        expect(authorityOrder).toEqual(fields.slice(0, reached))
        expect(contextOrder).toEqual(mode === "binding accessor" ? Array(reached).fill("context.binding") : [])
        expect(result.error).toBeUndefined()
        if (mismatch === "none") {
          expect(result.value).toBe(selected)
          expect(captured.order).toEqual(["state.preferences", "request.caseRef", "selection.value"])
          expect(namespaceReads).toBe(1)
          expect(valueReads).toBe(1)
        } else {
          expect(result.value).toBeUndefined()
          expect(captured.order).toEqual([])
          expect(namespaceReads).toBe(0)
          expect(valueReads).toBe(0)
        }
      }
      const sentinel = new Error("Original selection preference getter")
      let throwingReads = 0
      const throwingState = Object.defineProperty({}, "preferences", { enumerable: true,
        get: () => { throwingReads++; throw sentinel } }) as Readonly<SfProductState>
      captured.order.length = 0
      const failure = await capture(() => captured.read(throwingState, actor))
      expect(failure.error).toBe(sentinel)
      expect(failure.value).toBeUndefined()
      expect(throwingReads).toBe(1)
      expect(captured.order).toEqual([])
      if (mode !== "frozen") {
        binding.accessRevision = "changed-after-callback-capture"
        throwingReads = 0
        const refused = await capture(() => captured.read(throwingState, actor))
        expect(refused).toEqual({ value: undefined })
        expect(throwingReads).toBe(0)
      }
    }
  } finally { await deadline.close() }
}, 15_000)

/** Reuse the native LocalStore/C08 setup and proposal-write authority pattern
 * already exercised by criterion-preferences-selection. Only the foreign
 * comparison port is deterministic; the selection registry, its register/read,
 * stored digests, persistence and C08 admission are the real implementations. */
async function selectionFixture(deadline: Deadline) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-portfolio-selection-preferences-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  await initializeAbsentSfProductState(store, () => "portfolio-selection-state")
  await store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.cases.selected = decision()
    state.cases.other = decision("other")
    state.preferences.unrelated = { amount: 12 }
    return { commit: true, value: undefined }
  })
  const control: {
    active: boolean
    calls: { namespace: SfStateNamespace; mode: "read" | "write" }[]
    before?: (snapshot: Snapshot, count: number, namespace: SfStateNamespace) => void | Promise<void>
  } = { active: true, calls: [] }
  const writes = new WeakSet<object>()
  const port = createSfProductState({ persistence: store, createId: randomUUID, proposalCoverageWrites: writes,
    authorize: async (_request, snapshot, namespace, mode) => {
      deadline.check()
      control.calls.push({ namespace, mode })
      await control.before?.(snapshot, control.calls.length, namespace)
      return control.active ? { ...actor } : undefined
    },
    resolveTarget: async (_request, snapshot, _namespace, id) => {
      const value = (snapshot.data.__sfProductV1 as SfProductState).cases[id]
      return value ? { incarnation: value.incarnation } : undefined
    },
  })
  const ref: CaseRef = { id: "selected", incarnation: "selected-inc", version: 1 }
  const call = frozenContext()
  const audit: {
    steps: string[]
    callbacks: Read[]
    preferences: SfStateResult<unknown>[]
    errors: unknown[]
    comparisonCalls: number
    comparisonRequests: Parameters<SelectionInput["compare"]>[0][]
    between?: () => void | Promise<void>
  } = { steps: [], callbacks: [], preferences: [], errors: [], comparisonCalls: 0, comparisonRequests: [] }
  let request = new Request("https://selection-native.example.test", { signal: deadline.signal })
  let operation = "selection-registration-one"
  const comparison: ScenarioComparison = { comparisonStatus: "conditioned",
    baselineResultRef: "scenario:baseline", alternativeResultRef: "scenario:candidate",
    knownDifference: 0, completeDifference: null, costCoverageRefs: [],
    criterionResults: [{ criterionId: "cost", state: "unknown", reason: "fixture-coverage-pending" }],
    unresolvedConditions: ["fixture-coverage-pending"] }
  const compare: SelectionInput["compare"] = async (incoming, context) => {
    audit.comparisonCalls++
    audit.steps.push("compare:" + audit.comparisonCalls)
    audit.comparisonRequests.push(structuredClone(incoming))
    const result: Awaited<ReturnType<SelectionInput["compare"]>> =
      control.active && incoming.caseRef.id === ref.id && context.binding.principalRef === actor.principalRef
        ? { status: "ok", value: { request: {
          scenarioRefs: [comparison.baselineResultRef, comparison.alternativeResultRef], criteria: [...incoming.criteria],
        }, comparison: structuredClone(comparison) } }
        : { status: "denied", reason: "fixture-comparison-authority-revoked" }
    if (audit.comparisonCalls === 1) await audit.between?.()
    return result
  }
  const build = (opaque: boolean) => {
    const state: SfProductStatePort = {
      read: async (incoming, namespace, read) => {
        audit.steps.push("read:" + namespace)
        if (namespace === "preferences") audit.callbacks.push(read)
        try {
          const result = await port.read(incoming, namespace, opaque ? (value, authority) => read(value, authority) : read)
          if (namespace === "preferences") audit.preferences.push(result)
          audit.steps.push("done:" + namespace + ":" + result.status)
          return result
        } catch (error) {
          audit.errors.push(error)
          throw error
        }
      },
      transaction: port.transaction,
    }
    return createDecisionPortfolioSelection({
      state, host: { requestFor: () => request, revalidate: async () => {
        audit.steps.push("revalidate")
        return control.active
      } },
      compare,
      authorizeCase: async (value, context) => {
        audit.steps.push("authorizeCase")
        return control.active && value.id === ref.id && value.incarnation === ref.incarnation &&
          value.version === ref.version && value.participants.includes(context.binding.principalRef)
      },
      authorizeSelection: async (value, context) => control.active && context.kind === "ui" &&
        value.caseRef.id === ref.id && value.baselineAlternativeId === "baseline" &&
        value.alternativeId === "candidate" && value.criteria.length === 1 && value.criteria[0] === "cost",
      verifySnapshot: (_snapshot, value, selection, context) =>
        control.active && context.binding.principalRef === actor.principalRef &&
        value.caseRef.id === ref.id && value.caseRef.incarnation === ref.incarnation &&
        value.caseRef.id === selection.caseRef.id && selection.baselineRef === comparison.baselineResultRef &&
        selection.alternativeRef === comparison.alternativeResultRef,
      operationIdentity: () => operation, proposalCoverageWrites: writes, now: () => "2027-02-02T00:00:00Z",
    })
  }
  const selected = build(false), opaque = build(true)
  const registration = { caseRef: ref, baselineAlternativeId: "baseline", alternativeId: "candidate",
    criteria: ["cost"], expectedVersion: 0 }
  const first = ok(await selected.register(registration, call))
  operation = "selection-registration-two"
  const second = ok(await selected.register({ ...registration, expectedVersion: 1 }, call))
  expect(first.version).toBe(1)
  expect(second.version).toBe(2)
  expect(first.selectionDigest).not.toBe(second.selectionDigest)
  const key = selectionKey(ref)
  const restore = async (value: PortfolioSelection) => store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.preferences[key] = structuredClone(value)
    return { commit: true, value: undefined }
  })
  const reset = async () => {
    control.active = true
    control.before = undefined
    await restore(second)
    control.calls = []
    audit.steps = []; audit.callbacks = []; audit.preferences = []; audit.errors = []
    audit.comparisonCalls = 0; audit.comparisonRequests = []; audit.between = undefined
    request = new Request("https://selection-native.example.test", { signal: deadline.signal })
  }
  return { store, selected, opaque, call, ref, key, first, second, control, audit, restore, reset }
}

test("Portfolio selection uses fresh whole-preferences C08 reads and detects changes and revocation between comparisons", async () => {
  const deadline = compositionTestDeadline("portfolio-selection-native-preferences", 12_000)
  try {
    const f = await selectionFixture(deadline)
    const expectedSteps = ["revalidate", "read:cases", "done:cases:ok", "authorizeCase",
      "read:preferences", "done:preferences:ok", "compare:1", "read:preferences",
      "done:preferences:ok", "compare:2", "authorizeCase", "revalidate"]
    const expectedCalls = (["cases", "cases", "preferences", "preferences", "preferences", "preferences"] as const)
      .map((namespace) => ({ namespace, mode: "read" as const }))
    let markedObservation: { result: PortResult<PortfolioSelection>; preferences: SfStateResult<unknown>[] } | undefined
    for (const mode of ["marked", "opaque", "mutable"] as const) {
      await f.reset()
      let outsideReads = 0
      f.control.before = (snapshot, count, namespace) => {
        if (namespace !== "preferences" || count !== 3 && count !== 5) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        Object.defineProperty(state.cases.other!, "outsideReadSet", { enumerable: true,
          get: () => { outsideReads++; return "outside preferences" } })
      }
      const call = mode === "mutable" ? { ...f.call, binding: { ...f.call.binding } } : f.call
      const result = await (mode === "opaque" ? f.opaque : f.selected).read({ caseRef: f.ref }, call)
      expect(result).toEqual({ status: "ok", value: f.second })
      expect(f.audit.steps).toEqual(expectedSteps)
      expect(f.control.calls).toEqual(expectedCalls)
      expect(f.audit.errors).toEqual([])
      expect(f.audit.callbacks).toHaveLength(2)
      expect(f.audit.callbacks[0]).not.toBe(f.audit.callbacks[1])
      expect(f.audit.preferences).toHaveLength(2)
      expect(f.audit.preferences.map((entry) => ok(entry))).toEqual([f.second, f.second])
      expect(outsideReads).toBe(mode === "marked" ? 0 : 2)
      expect(f.audit.comparisonRequests).toEqual(Array.from({ length: 2 }, () => ({
        caseRef: f.ref, baselineAlternativeId: "baseline", alternativeId: "candidate", criteria: ["cost"],
      })))
      const observation = structuredClone({ result, preferences: f.audit.preferences })
      if (mode === "marked") markedObservation = observation
      else expect(observation).toEqual(markedObservation!)
      const value = ok(result)
      expect(value).not.toBe(ok(f.audit.preferences[0]!))
      expect(value).not.toBe(ok(f.audit.preferences[1]!))
      expect(ok(f.audit.preferences[0]!)).not.toBe(ok(f.audit.preferences[1]!))
      Object.defineProperty(value, "version", { value: 999, enumerable: true, writable: true, configurable: true })
      expect(f.audit.preferences.map((entry) => ok(entry))).toEqual([f.second, f.second])
      const persisted = await f.store.transaction("dashboard", async (snapshot) => ({
        commit: false, value: (snapshot.data.__sfProductV1 as SfProductState).preferences[f.key],
      }))
      expect(persisted).toEqual(f.second)
    }

    for (const opaque of [false, true]) {
      await f.reset()
      f.audit.between = () => f.restore(f.first)
      const changed = await (opaque ? f.opaque : f.selected).read({ caseRef: f.ref }, f.call)
      expect(changed).toEqual({ status: "stale", reason: "selection-changed" })
      expect(f.audit.preferences.map((entry) => ok(entry))).toEqual([f.second, f.first])
      expect(f.control.calls).toEqual(expectedCalls)
      expect(f.audit.comparisonCalls).toBe(2)
      expect(f.audit.steps).toEqual(expectedSteps.slice(0, -2))
      expect(f.audit.errors).toEqual([])

      await f.reset()
      f.audit.between = () => { f.control.active = false }
      const revoked = await (opaque ? f.opaque : f.selected).read({ caseRef: f.ref }, f.call)
      expect(revoked).toEqual({ status: "stale", reason: "selection-changed" })
      expect(f.control.calls).toEqual(expectedCalls.slice(0, -1))
      expect(f.audit.preferences.map((entry) => entry.status)).toEqual(["ok", "denied"])
      expect(f.audit.comparisonCalls).toBe(2)
      expect(f.audit.steps).toEqual(["revalidate", "read:cases", "done:cases:ok", "authorizeCase",
        "read:preferences", "done:preferences:ok", "compare:1", "read:preferences",
        "done:preferences:denied", "compare:2"])
      expect(f.audit.errors).toEqual([])
    }

    // Whole-preferences means an unrelated key, and an alias reachable through
    // that key, still participate in cloning. Neither error may trigger replay.
    for (const opaque of [false, true]) {
      for (const reachableAlias of [false, true]) {
        await f.reset()
        const sentinel = new Error("Reachable preferences graph failure")
        let reads = 0
        f.control.before = (snapshot, count) => {
          if (count !== 3) return
          const state = snapshot.data.__sfProductV1 as SfProductState
          const graph = reachableAlias ? state.cases.other! : {}
          Object.defineProperty(graph, "unselectedKey", { enumerable: true,
            get: () => { reads++; throw sentinel } })
          state.preferences.unrelated = graph
        }
        const result = await (opaque ? f.opaque : f.selected).read({ caseRef: f.ref }, f.call)
        expect(result).toEqual({ status: "unavailable", reason: "selection-unavailable" })
        expect(f.audit.errors).toEqual([sentinel])
        expect(f.audit.errors[0]).toBe(sentinel)
        expect(reads).toBe(1)
        expect(f.control.calls).toEqual(expectedCalls.slice(0, 3))
        expect(f.audit.callbacks).toHaveLength(1)
        expect(f.audit.preferences).toEqual([])
        expect(f.audit.comparisonCalls).toBe(0)
      }
    }
  } finally { await deadline.close() }
}, 15_000)

test("Portfolio selection declares cases at read, inspect and register while preserving guards and mixed reads", async () => {
  const deadline = compositionTestDeadline("portfolio-selection-cases-read-set", 18_000)
  try {
    const sites = ["read", "inspect", "register"] as const
    const fields = ["principalRef", "policyVersion", "accessRevision"] as const
    const observed = { customCaptures: 0, nativeReads: 0, reachableFailures: 0, revocations: 0, mixedReads: 0 }
    for (const site of sites) {
      for (const mode of ["frozen", "mutable"] as const) {
        deadline.check()
        const base = frozenContext()
        const call = mode === "frozen" ? base : { ...base, binding: { ...base.binding } }
        const source = new Request("https://portfolio-cases-custom.example.test", { signal: deadline.signal })
        const order: string[] = [], callbacks: Read[] = []
        const seen: { request: Request; namespace: SfStateNamespace }[] = []
        let id = "selected", unused = 0, selectionCalls = 0, revalidations = 0, copiedRequest = false
        const ref = { get id() { order.push("request.id"); return id }, incarnation: "selected-inc", version: 1 }
        const request = { caseRef: { id: "selected", incarnation: "selected-inc", version: 1 },
          baselineAlternativeId: "baseline", alternativeId: "candidate", criteria: ["cost"], expectedVersion: 0 }
        const arm = (value: { caseRef: CaseRef }) => Object.defineProperty(value, "caseRef", {
          configurable: true, enumerable: true, get: () => { order.push("request.caseRef"); return ref },
        })
        // register first clones its incoming request. Install the late getters
        // on that real clone at authorizeSelection, never before its clone.
        if (site !== "register") arm(request)
        const readPort: SfProductStatePort["read"] = async (incoming, namespace, read) => {
          order.push("call:" + namespace)
          seen.push({ request: incoming, namespace })
          if (namespace === "cases") callbacks.push(read)
          return { status: "unavailable", reason: "callback-captured-without-invocation" }
        }
        const state: SfProductStatePort = {
          get read() { order.push("lookup:read"); return readPort },
          transaction: async () => { unused++; throw new Error("No write belongs to callback capture") },
        }
        const registry = createDecisionPortfolioSelection({
          state, host: { requestFor: () => source, revalidate: async () => { revalidations++; return true } },
          compare: async () => { unused++; return { status: "unavailable", reason: "capture-only" } },
          authorizeCase: async () => { unused++; return false },
          authorizeSelection: async (incoming) => {
            selectionCalls++; copiedRequest = incoming !== request; arm(incoming); return true
          },
          verifySnapshot: () => { unused++; return false },
          operationIdentity: () => "capture-selection", proposalCoverageWrites: new WeakSet<object>(),
          now: () => { unused++; return "2027-02-02T00:00:00Z" },
        })
        const result = site === "register" ? await registry.register(request, call)
          : site === "inspect" ? await registry.inspect(request, call) : await registry.read(request, call)
        expect(result).toEqual({ status: "denied", reason: "selection-access-unavailable" })
        expect(seen).toEqual((site === "register" ? ["cases", "preferences"] as const : ["cases"] as const)
          .map((namespace) => ({ request: source, namespace })))
        expect(order).toEqual(site === "register"
          ? ["lookup:read", "call:cases", "lookup:read", "call:preferences"] : ["lookup:read", "call:cases"])
        expect(revalidations).toBe(1)
        expect(selectionCalls).toBe(site === "register" ? 1 : 0)
        expect(copiedRequest).toBe(site === "register")
        expect(unused).toBe(0)
        expect(callbacks).toHaveLength(1)
        const read = callbacks[0]
        if (!read) throw new Error("The actual portfolio cases callback was not delivered")
        id = "later"
        const selected = { marker: site }
        for (const mismatch of [...fields, "none"] as const) {
          order.length = 0
          const authorityOrder: string[] = []
          const authority = { ...actor }
          for (const field of fields) Object.defineProperty(authority, field, { enumerable: true,
            get: () => { authorityOrder.push(field); return field === mismatch ? "different" : actor[field] } })
          const cases = Object.defineProperty({}, "later", { enumerable: true,
            get: () => { order.push("case.value"); return selected } })
          const state = Object.defineProperty({}, "cases", { enumerable: true,
            get: () => { order.push("state.cases"); return cases } }) as Readonly<SfProductState>
          // Run outside the service catch so a swallowed assertion cannot pass.
          const observedRead = await capture(() => read(state, authority))
          const reached = mismatch === "none" ? fields.length : fields.indexOf(mismatch) + 1
          expect(authorityOrder).toEqual(fields.slice(0, reached))
          expect(observedRead.error).toBeUndefined()
          expect(observedRead.value).toBe(mismatch === "none" ? selected : undefined)
          expect(order).toEqual(mismatch === "none"
            ? ["state.cases", "request.caseRef", "request.id", "case.value"] : [])
        }
        observed.customCaptures++
      }
    }

    const f = await selectionFixture(deadline)
    for (const site of sites) {
      const invoke = (registry = f.selected, call = f.call) => site === "register"
        ? registry.register({ caseRef: f.ref, baselineAlternativeId: "baseline", alternativeId: "candidate",
          criteria: ["cost"], expectedVersion: 1 }, call)
        : site === "inspect" ? registry.inspect({ caseRef: f.ref }, call) : registry.read({ caseRef: f.ref }, call)
      const expected = site === "inspect" ? { status: "ok" as const, value: { version: 2, selection: f.second } }
        : { status: "ok" as const, value: f.second }
      for (const mode of ["marked", "opaque", "mutable"] as const) {
        await f.reset()
        let outsideReads = 0
        f.control.before = (snapshot, count, namespace) => {
          if (count !== 1 || namespace !== "cases") return
          const state = snapshot.data.__sfProductV1 as SfProductState
          Object.defineProperty(state.documents, "outsideCases", { enumerable: true,
            get: () => { outsideReads++; return "exclusively outside cases" } })
        }
        const call = mode === "mutable" ? { ...f.call, binding: { ...f.call.binding } } : f.call
        const result = await invoke(mode === "opaque" ? f.opaque : f.selected, call)
        expect(result).toEqual(expected)
        expect(outsideReads).toBe(mode === "marked" ? 0 : 1)
        expect(f.control.calls.slice(0, 2)).toEqual([
          { namespace: "cases", mode: "read" }, { namespace: "cases", mode: "read" },
        ])
        expect(f.control.calls).toHaveLength(site === "read" ? 6 : 10)
        expect(f.control.calls.every((entry) => entry.mode === "read")).toBe(true)
        expect(f.audit.comparisonCalls).toBe(2)
        expect(f.audit.errors).toEqual([])
        observed.nativeReads++
      }
      // A sibling is inside the complete cases graph, even when the callback
      // returns another case. Preserve its failure and never replay the read.
      for (const opaque of [false, true]) {
        await f.reset()
        const sentinel = new Error("Reachable portfolio cases failure")
        let reads = 0
        f.control.before = (snapshot, count) => {
          if (count !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState
          Object.defineProperty(state.cases.other!, "reachableFailure", { enumerable: true,
            get: () => { reads++; throw sentinel } })
        }
        const result = await invoke(opaque ? f.opaque : f.selected)
        expect(result).toEqual({ status: "unavailable", reason: "selection-unavailable" })
        expect(f.audit.errors).toEqual([sentinel])
        expect(f.audit.errors[0]).toBe(sentinel)
        expect(reads).toBe(1)
        expect(f.control.calls).toEqual([{ namespace: "cases", mode: "read" }])
        expect(f.audit.preferences).toEqual([])
        expect(f.audit.comparisonCalls).toBe(0)
        observed.reachableFailures++
      }
      await f.reset()
      f.control.before = (_snapshot, count) => { if (count === 2) f.control.active = false }
      const revoked = await invoke()
      expect(revoked).toEqual({ status: "denied", reason: "selection-access-unavailable" })
      expect(f.control.calls).toEqual((site === "register" ? ["cases", "cases", "preferences"] as const : ["cases", "cases"] as const)
        .map((namespace) => ({ namespace, mode: "read" as const })))
      expect(f.audit.comparisonCalls).toBe(0)
      expect(f.audit.errors).toEqual([])
      expect(f.audit.steps.some((step) => step.startsWith("compare:"))).toBe(false)
      observed.revocations++
    }

    // register's separate preferences + transactions read remains opaque.
    // Its real idempotency branch needs the transaction and still observes
    // unrelated namespaces; the preceding cases declaration cannot mark it.
    await f.reset()
    let outsideMixedReads = 0, priorReads = 0, priorFound = false
    f.control.before = (snapshot, count, namespace) => {
      if (count !== 3 || namespace !== "preferences") return
      const state = snapshot.data.__sfProductV1 as SfProductState
      const key = JSON.stringify([actor.principalRef, "preferences", f.ref.id, "portfolio-selection:selection-registration-two"])
      const prior = state.transactions[key]
      priorFound = prior !== undefined
      Object.defineProperty(state.transactions, key, { enumerable: true,
        get: () => { priorReads++; return prior } })
      Object.defineProperty(state.documents, "outsideMixed", { enumerable: true,
        get: () => { outsideMixedReads++; return "outside preferences and transactions" } })
    }
    const registered = await f.selected.register({ caseRef: f.ref, baselineAlternativeId: "baseline",
      alternativeId: "candidate", criteria: ["cost"], expectedVersion: 1 }, f.call)
    expect(registered).toEqual({ status: "ok", value: f.second })
    expect(priorFound).toBe(true)
    expect(priorReads).toBe(1)
    expect(outsideMixedReads).toBe(1)
    expect(f.control.calls).toHaveLength(10)
    expect(f.control.calls.every((entry) => entry.mode === "read")).toBe(true)
    expect(f.audit.comparisonCalls).toBe(2)
    expect(f.audit.errors).toEqual([])
    observed.mixedReads++
    expect(observed).toEqual({ customCaptures: 6, nativeReads: 9, reachableFailures: 6, revocations: 3, mixedReads: 1 })
    console.log("SF_C19_PORTFOLIO_CASES " + JSON.stringify({ schema: "sf-c19-portfolio-cases-v1", ...observed }))
  } finally { await deadline.close() }
}, 20_000)
