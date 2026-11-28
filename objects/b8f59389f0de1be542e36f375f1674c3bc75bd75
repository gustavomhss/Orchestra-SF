import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { DecisionCase, ScenarioComparison } from "../../../../product/contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateResult } from "../../../../product/contracts/state.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfProductState, initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createCriterionComparisonBindings, type CriterionComparisonBinding } from "../../../../product/decisions/criterion-comparison.ts"
import { createCriterionRuleRegistry } from "../../../../product/decisions/criterion-rules.ts"
import { createSfDecisionResultStore } from "../../../../product/decisions/result-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { AsyncLocalStorage } from "node:async_hooks"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { currentSfPlannerReadonlySnapshotScope, currentSfReadonlySnapshotScope } from "../../../../product/integration/source-lifecycle.ts"
import { plannerValueRef } from "../../../../product/planner/scenario-inputs.ts"
import { sensitivityObservationFixture } from "./sensitivity-observation-fixture.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => unknown | Promise<unknown>
type Mode = "marked" | "opaque" | "mutable"

const actor: SfStateAuthority = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
const caseRef = { id: "selected", incarnation: "selected-inc", version: 1 }
const at = "2027-02-02T00:00:00Z"

function context(): TrustedUiContext {
  return Object.freeze({ kind: "ui", binding: Object.freeze({
    installationId: "comparison-read-set-installation", projectId: "project", principalRef: "person",
    requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2028-01-01T00:00:00Z",
  }), lease: {} }) as TrustedUiContext
}

function decision(): DecisionCase {
  return { ...caseRef, state: "investigating", objective: "Original comparison read",
    horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: ["person"],
    criteria: [{ id: "cost", description: "Original cost criterion", required: true }],
    sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [],
    choices: [], preparedChanges: [], receipts: [], ledger: [] }
}

function ok<T>(result: SfStateResult<T> | PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

async function capture<T>(work: () => T | Promise<T>) {
  try { return { value: await work() } }
  catch (error) { return { error } }
}

function key(resultRef: string) {
  return "sf:criterion-rule:result:" + digestSfValue({ kind: "comparison", resultRef })
}

function bindingDigest(value: CriterionComparisonBinding) {
  return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "bindingDigest")))
}

/** Stop the real consumer at its first port call. The callback is invoked only
 * afterwards, outside the consumer's catch, with no invented binding accepted. */
async function capturedBinding(call: TrustedDomainContext, deadline: Deadline) {
  const source = new Request("https://comparison-custom.example.test", { signal: deadline.signal })
  const events: string[] = [], callbacks: Read[] = []
  const seen: { request: Request; namespace: string }[] = []
  let resultRef = "initial-result", keyFailure: Error | undefined, revalidations = 0, unused = 0
  const request = { caseRef, get resultRef() {
    events.push("request.resultRef")
    if (keyFailure) throw keyFailure
    return resultRef
  } }
  const never = (): never => { unused++; throw new Error("No comparison dependency belongs to callback capture") }
  const state: SfProductStatePort = {
    read: async (incoming, namespace, read) => {
      seen.push({ request: incoming, namespace })
      callbacks.push(read)
      return { status: "unavailable", reason: "captured-without-invocation" }
    },
    transaction: never,
  }
  const bindings = createCriterionComparisonBindings({
    state, host: { requestFor: () => source, revalidate: async () => { revalidations++; return true } },
    rules: { resolve: never, register: never, evaluate: never },
    results: { read: never, write: never, readForCalculation: never, readHistoricalCalculation: never,
      readHistoricalScenario: never, readByRequest: never },
    authorizeCase: never, verifyBinding: never, verifySnapshot: never, operationIdentity: never,
    proposalCoverageWrites: new WeakSet<object>(), now: never,
  })
  expect(await bindings.read(request, call)).toEqual({ status: "unavailable", reason: "comparison-binding-unavailable" })
  expect(seen).toEqual([{ request: source, namespace: "preferences" }])
  expect(events).toEqual(["request.resultRef"])
  expect(revalidations).toBe(1)
  expect(unused).toBe(0)
  expect(callbacks).toHaveLength(1)
  const read = callbacks[0]
  if (!read) throw new Error("The actual comparison callback was not captured")
  return { read, events, setRef: (value: string) => { resultRef = value },
    failKey: (error?: Error) => { keyFailure = error } }
}

test("Comparison binding callback preserves authority order, late result key and original return identity", async () => {
  const deadline = compositionTestDeadline("comparison-preferences-original-callback", 12_000)
  try {
    const fields = ["principalRef", "policyVersion", "accessRevision"] as const
    for (const frozen of [true, false]) {
      deadline.check()
      const immutable = context(), mutable = { ...immutable, binding: { ...immutable.binding } }
      const call = frozen ? immutable : mutable
      const c = await capturedBinding(call, deadline)
      const selected = { witness: "original value" }
      let value: unknown = selected
      const preferences = Object.defineProperty({}, key("late-result"), { enumerable: true,
        get: () => { c.events.push("lookup"); return value } })
      // A custom port deliberately supplies only the declared namespace.
      const state = { get preferences() { c.events.push("preferences"); return preferences } } as Readonly<SfProductState>
      c.setRef("late-result")
      for (const mismatch of [...fields, "none"] as const) {
        c.events.length = 0
        const authority = { ...actor }
        for (const field of fields) Object.defineProperty(authority, field, { enumerable: true,
          get: () => { c.events.push(field); return field === mismatch ? "different" : actor[field] } })
        const observed = c.read(state, authority)
        const reached = mismatch === "none" ? fields.length : fields.indexOf(mismatch) + 1
        expect(c.events).toEqual(mismatch === "none"
          ? [...fields, "preferences", "request.resultRef", "lookup"] : fields.slice(0, reached))
        if (mismatch === "none") expect(observed).toBe(selected)
        else expect(observed).toBeUndefined()
      }
      const deferred = Promise.resolve(selected)
      value = deferred
      c.events.length = 0
      expect(c.read(state, actor)).toBe(deferred)
      expect(c.events).toEqual(["preferences", "request.resultRef", "lookup"])
      expect(await deferred).toBe(selected)
      value = selected

      const sentinel = new Error("Original comparison preferences getter")
      const throwing = { get preferences(): SfProductState["preferences"] {
        c.events.push("preferences"); throw sentinel
      } } as Readonly<SfProductState>
      c.events.length = 0
      expect((await capture(() => c.read(throwing, actor))).error).toBe(sentinel)
      expect(c.events).toEqual(["preferences"])
      c.failKey(sentinel)
      c.events.length = 0
      expect((await capture(() => c.read(state, actor))).error).toBe(sentinel)
      expect(c.events).toEqual(["preferences", "request.resultRef"])
      c.failKey()

      if (!frozen) {
        mutable.binding.accessRevision = "changed after capture"
        c.events.length = 0
        expect(c.read(state, actor)).toBeUndefined()
        expect(c.events).toEqual([])
        expect(c.read(state, { ...actor, accessRevision: mutable.binding.accessRevision })).toBe(selected)
        expect(c.events).toEqual(["preferences", "request.resultRef", "lookup"])
      }
    }
  } finally { await deadline.close() }
}, 15_000)

async function fixture(deadline: Deadline) {
  // Reuse the LocalStore/C08 setup from criterion-preferences-selection. No
  // Planner algorithm is replaced: the admitted missing rule yields unknown.
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-comparison-preferences-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  await initializeAbsentSfProductState(store, () => "comparison-read-set-state")
  await store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.cases.selected = decision()
    state.preferences.unrelated = { retained: "complete preferences graph" }
    return { commit: true, value: undefined }
  })
  const control: {
    active: boolean
    incoming: Request
    phase?: { read: number; admissions: number }
    before?: (snapshot: Snapshot, read: number, admission: number) => void
    afterVerify?: (count: number) => Promise<void>
  } = { active: true, incoming: new Request("https://comparison-read-set.example.test", { signal: deadline.signal }) }
  const audit = {
    callbacks: [] as Read[], preferences: [] as SfStateResult<unknown>[], errors: [] as unknown[],
    admissions: [] as { read: number; admission: number }[], retained: [] as CriterionComparisonBinding[],
    validations: 0, resultReads: 0, resolves: 0, evaluates: 0, revalidations: 0, unused: 0,
  }
  const writes = new WeakSet<object>()
  const port = createSfProductState({ persistence: store, createId: randomUUID, proposalCoverageWrites: writes,
    authorize: async (_request, snapshot) => {
      deadline.check()
      const phase = control.phase
      if (phase) {
        phase.admissions++
        audit.admissions.push({ read: phase.read, admission: phase.admissions })
        control.before?.(snapshot, phase.read, phase.admissions)
      }
      return control.active ? { ...actor } : undefined
    },
    resolveTarget: async (_request, snapshot, _namespace, id) => {
      const current = (snapshot.data.__sfProductV1 as SfProductState).cases[id]
      return current ? { incarnation: current.incarnation } : undefined
    },
  })
  const host = { requestFor: () => control.incoming, revalidate: async () => {
    deadline.check(); audit.revalidations++; return control.active
  } }
  const authorizeCase = async (value: DecisionCase, call: TrustedDomainContext) =>
    control.active && value.id === caseRef.id && value.incarnation === caseRef.incarnation &&
    value.version === caseRef.version && value.participants.includes(call.binding.principalRef)
  const never = (): never => { audit.unused++; throw new Error("No rule registration or metric belongs to this read contract") }
  const originalRules = createCriterionRuleRegistry({ state: port, host, authorizeCase,
    authorizeRule: never, verifyEvidence: never, verifySnapshot: never, readMetric: never, verifyMetric: never,
    operationIdentity: never, proposalCoverageWrites: writes, now: () => at,
  })
  const rules: typeof originalRules = { ...originalRules,
    resolve: (...args) => { audit.resolves++; return originalRules.resolve(...args) },
    evaluate: (...args) => { audit.evaluates++; return originalRules.evaluate(...args) },
  }
  const originalResults = createSfDecisionResultStore({ state: port, host, authorizeCase,
    verifySources: async (value, refs) => control.active && value.kind === "comparison" && refs.length === 0,
    createId: () => "comparison", now: () => at,
  })
  const results: typeof originalResults = { ...originalResults,
    read: (...args) => { audit.resultReads++; return originalResults.read(...args) },
  }
  const build = (mode: Mode) => {
    const state: SfProductStatePort = {
      read: async (incoming, namespace, read) => {
        audit.callbacks.push(read)
        control.phase = { read: audit.callbacks.length, admissions: 0 }
        try {
          const result = await port.read(incoming, namespace,
            mode === "opaque" ? (value, authority) => read(value, authority) : read)
          audit.preferences.push(result)
          return result
        } catch (error) { audit.errors.push(error); throw error }
        finally { control.phase = undefined }
      },
      transaction: port.transaction,
    }
    return createCriterionComparisonBindings({ state, host, rules, results, authorizeCase,
      verifyBinding: async (binding, stored, call) => {
        audit.validations++; audit.retained.push(binding)
        await control.afterVerify?.(audit.validations)
        return control.active && stored.kind === "comparison" &&
          binding.resultRef === stored.resultRef && binding.resultDigest === stored.resultDigest &&
          call.binding.principalRef === actor.principalRef
      },
      // The foreign verifier receives the Planner snapshot. C08 itself checks
      // the real dashboard target, case and protected comparison preference.
      verifySnapshot: () => control.active, operationIdentity: () => "comparison-binding",
      proposalCoverageWrites: writes, now: () => at,
    })
  }
  const immutable = context()
  const request: ScenarioCompareRequest = { scenarioRefs: ["baseline-result", "alternative-result"], criteria: ["cost"] }
  const comparison: ScenarioComparison = { baselineResultRef: "baseline-result", alternativeResultRef: "alternative-result",
    costCoverageRefs: [], criterionResults: [{ criterionId: "cost", state: "unknown", reason: "criterion-rule-unavailable" }],
    unresolvedConditions: ["criterion-rule-unavailable"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null }
  const stored = ok(await results.write({ kind: "comparison", result: comparison, caseRef,
    requestDigest: digestSfValue(request), sourceRefs: [], idempotencyKey: "comparison-result" }, immutable))
  const selected = build("marked"), opaque = build("opaque")
  const proof = [{ criterionId: "cost", ruleRef: null, version: null, digest: null }]
  const binding = ok(await selected.bind({ caseRef, resultRef: stored.resultRef, request, expectedRules: proof }, immutable))
  expect(binding.resultRef).toBe(stored.resultRef)
  expect(binding.rules).toEqual(proof)
  expect(binding.bindingDigest).toBe(bindingDigest(binding))
  expect(audit.unused).toBe(0)
  const bindingKey = key(binding.resultRef)
  const reset = () => {
    control.active = true; control.phase = undefined; control.before = undefined; control.afterVerify = undefined
    audit.callbacks = []; audit.preferences = []; audit.errors = []; audit.admissions = []; audit.retained = []
    audit.validations = 0; audit.resultReads = 0; audit.resolves = 0; audit.evaluates = 0; audit.revalidations = 0; audit.unused = 0
  }
  const replace = (value: CriterionComparisonBinding) => store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.preferences[bindingKey] = structuredClone(value)
    state.versions.preferences++
    state.revision++
    return { commit: true, value: undefined }
  })
  const read = (mode: Mode) => (mode === "opaque" ? opaque : selected).read({ caseRef, resultRef: binding.resultRef },
    mode === "mutable" ? { ...immutable, binding: { ...immutable.binding } } : immutable)
  reset()
  return { store, port, control, audit, binding, bindingKey, reset, replace, read }
}

test("Comparison binding read-set keeps both native observations, complete graph, fallback and fresh revocation", async () => {
  const deadline = compositionTestDeadline("comparison-preferences-native-readback", 12_000)
  try {
    const f = await fixture(deadline)
    const expectedAdmissions = [{ read: 1, admission: 1 }, { read: 1, admission: 2 },
      { read: 2, admission: 1 }, { read: 2, admission: 2 }]
    for (const mode of ["marked", "opaque", "mutable"] as const) {
      f.reset()
      let unrelatedReads = 0, outsideReads = 0
      const originals: CriterionComparisonBinding[] = []
      f.control.before = (snapshot, _read, admission) => {
        if (admission !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        originals.push(state.preferences[f.bindingKey] as CriterionComparisonBinding)
        const node: { amount: number; self?: unknown } = { amount: 12 }
        node.self = node
        Object.defineProperty(state.preferences, "unrelated", { enumerable: true,
          get: () => { unrelatedReads++; return { left: node, right: node } } })
        Object.defineProperty(state.cases.selected!, "outsideReadSet", { enumerable: true,
          get: () => { outsideReads++; return "outside preferences" } })
      }
      const result = await f.read(mode)
      expect(result).toEqual({ status: "ok", value: f.binding })
      expect(f.audit.callbacks).toHaveLength(2)
      expect(f.audit.callbacks[0]).not.toBe(f.audit.callbacks[1])
      expect(f.audit.admissions).toEqual(expectedAdmissions)
      expect(f.audit.preferences.map((entry) => ok(entry))).toEqual([f.binding, f.binding])
      expect({ validations: f.audit.validations, resultReads: f.audit.resultReads, resolves: f.audit.resolves,
        evaluates: f.audit.evaluates, unused: f.audit.unused }).toEqual({
        validations: 2, resultReads: 2, resolves: 2, evaluates: 2, unused: 0,
      })
      expect(unrelatedReads).toBe(2)
      expect(outsideReads).toBe(mode === "marked" ? 0 : 2)
      expect(f.audit.errors).toEqual([])
      const first = ok(f.audit.preferences[0]!) as CriterionComparisonBinding
      const second = ok(f.audit.preferences[1]!) as CriterionComparisonBinding
      const returned = ok(result)
      expect(first).not.toBe(originals[0])
      expect(second).not.toBe(originals[1])
      expect(first).not.toBe(second)
      expect(first.caseRef).not.toBe(second.caseRef)
      expect(returned).not.toBe(first)
      expect(returned).not.toBe(second)
      expect(f.audit.retained).toEqual([first, first])
      expect(f.audit.retained[0]).toBe(first)
      expect(f.audit.retained[1]).toBe(first)
      first.caseRef.version = 999
      expect(second.caseRef.version).toBe(caseRef.version)
      expect(returned.caseRef.version).toBe(caseRef.version)
      expect(originals.map((value) => value.caseRef.version)).toEqual([caseRef.version, caseRef.version])
    }

    for (const mode of ["marked", "opaque"] as const) {
      f.reset()
      const changed = { ...structuredClone(f.binding), createdAt: "2027-02-03T00:00:00Z" }
      changed.bindingDigest = bindingDigest(changed)
      f.control.afterVerify = async (count) => { if (count === 1) await f.replace(changed) }
      try {
        expect(await f.read(mode)).toEqual({ status: "stale", reason: "comparison-rule-or-source-changed" })
        expect(f.audit.callbacks).toHaveLength(2)
        expect(f.audit.admissions).toEqual(expectedAdmissions)
        expect(f.audit.preferences.map((entry) => ok(entry))).toEqual([f.binding, changed])
        expect(f.audit.validations).toBe(2)
        expect(f.audit.resultReads).toBe(2)
        expect(f.audit.evaluates).toBe(2)
        expect(f.audit.errors).toEqual([])
      } finally { f.reset(); await f.replace(f.binding) }

      f.reset()
      const reached: number[] = []
      f.control.before = (_snapshot, read, admission) => {
        if (read === 2 && admission === 2) { reached.push(read); f.control.active = false }
      }
      expect(await f.read(mode)).toEqual({ status: "stale", reason: "comparison-rule-or-source-changed" })
      expect(reached).toEqual([2])
      expect(f.audit.callbacks).toHaveLength(2)
      expect(f.audit.admissions).toEqual(expectedAdmissions)
      expect(f.audit.preferences[0]).toMatchObject({ status: "ok", value: f.binding })
      expect(f.audit.preferences[1]).toEqual({ status: "denied", reason: "product-authority-changed" })
      expect(f.audit.resultReads).toBe(2)
      expect(f.audit.validations).toBe(1)
      expect(f.audit.errors).toEqual([])

      f.reset()
      const sentinel = new Error("Reachable unrelated preference fails its complete clone")
      let reachedClone = 0
      f.control.before = (snapshot, read, admission) => {
        if (read !== 1 || admission !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        Object.defineProperty(state.preferences, "unrelated", { enumerable: true,
          get: () => { reachedClone++; throw sentinel } })
      }
      expect(await f.read(mode)).toEqual({ status: "unavailable", reason: "comparison-binding-unavailable" })
      expect(f.audit.errors).toEqual([sentinel])
      expect(reachedClone).toBe(1)
      expect(f.audit.callbacks).toHaveLength(1)
      expect(f.audit.admissions).toEqual([{ read: 1, admission: 1 }])
      expect(f.audit.preferences).toEqual([])
      expect(f.audit.resultReads).toBe(0)
      expect(f.audit.validations).toBe(0)
    }
    f.reset()
    expect(await f.read("marked")).toEqual({ status: "ok", value: f.binding })
    expect(f.audit.admissions).toEqual(expectedAdmissions)
    expect(f.audit.validations).toBe(2)
    expect(f.audit.unused).toBe(0)
  } finally { await deadline.close() }
}, 15_000)

async function nativeComparisonObservationFixture(deadline: Deadline) {
  // Native C08/Source/Finance/Planner composition. Only fixture data and the
  // factory seam are supplied; no LocalStore method or evaluator is replaced.
  const native = await deadline.phase("native-setup", () =>
    sensitivityObservationFixture(deadline, "all", "lte", { plannerRecordProof: true }))
  const proofPhase = new AsyncLocalStorage<boolean>()
  type Batch = { owned: boolean; planner: boolean; same: boolean; currentAfter: boolean; booleanOnly: boolean }
  const measurement: { active: boolean; batches: Batch[]; proofs: number; afterBatch?: () => void } = {
    active: false, batches: [], proofs: 0,
  }
  const makeObservation = native.business.createPlannerCriteriaObservation
  native.business.createPlannerCriteriaObservation = (criteria) => {
    const original = makeObservation.call(native.business, criteria)
    return <Value>(request: ScenarioCompareRequest, incoming: TrustedDomainContext,
      work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => original(request, incoming, async () => {
      if (!measurement.active || proofPhase.getStore()) return work()
      const before = currentSfReadonlySnapshotScope(native.persistence)
      const planner = currentSfPlannerReadonlySnapshotScope(native.persistence)
      const batch: Batch = { owned: !!before && before.current(),
        planner: !!before && !!planner && planner.identity === before.identity &&
          planner.bytesIdentity === before.bytesIdentity && planner.current(),
        same: false, currentAfter: false, booleanOnly: false }
      measurement.batches.push(batch)
      const result = await work()
      const after = currentSfReadonlySnapshotScope(native.persistence)
      batch.same = !!before && !!after && before.identity === after.identity && before.bytesIdentity === after.bytesIdentity
      batch.currentAfter = !!after && after.current()
      batch.booleanOnly = result.status === "ok" && Object.is(result.value, true)
      const afterBatch = measurement.afterBatch
      measurement.afterBatch = undefined
      afterBatch?.()
      return result
    })
  }
  const portfolio = (() => {
    try { return createSfPortfolioServices({ authority: native.authority, business: native.business, proposalCoverageWrites: native.writes }) }
    finally { native.business.createPlannerCriteriaObservation = makeObservation }
  })()
  deadline.own(() => portfolio.dispose())
  const proof = portfolio.proof
  if (!proof) throw new Error("The real Portfolio verifier was not composed")
  const verify = proof.verifyComparison
  proof.verifyComparison = (...args) => {
    if (measurement.active) measurement.proofs++
    return proofPhase.run(true, () => verify.call(proof, ...args))
  }
  deadline.own(() => { proof.verifyComparison = verify })
  const request = () => new Request(native.transport.url, { method: "POST", signal: deadline.signal,
    headers: { origin: new URL(native.transport.url).origin } })
  const admitComparison = async (pair: ScenarioCompareRequest) => {
    const admitted = ok(await native.authority.ui.admit(request(), "sf_scenario_compare", digestSfValue(pair)))
    deadline.own(() => native.authority.ui.finish(admitted))
    expect(await native.authority.ui.validate(admitted, "sf_scenario_compare", digestSfValue(pair))).toBe(true)
    return admitted
  }
  const prepare = async (selected: typeof native.caseRef, references: string[], criteria: string[]) => {
    const pair: ScenarioCompareRequest = { scenarioRefs: references, criteria }
    const admitted = await admitComparison(pair)
    const stored = ok(await native.business.withCase(admitted, selected, {}, async () => {
      const comparison = ok(await portfolio.planner.compareScenarios(pair, admitted))
      return native.business.results.write({ kind: "comparison", result: comparison, caseRef: selected,
        requestDigest: digestSfValue(pair), sourceRefs: native.sources, idempotencyKey: randomUUID() }, admitted)
    }))
    if (stored.kind !== "comparison") throw new Error("The real comparison was not stored")
    const proofs = ok(await native.business.withCase(admitted, selected, {}, () =>
      portfolio.comparisonBindings.proofs(selected, criteria, admitted)))
    return { selected, pair, admitted, stored, proofs }
  }
  type Prepared = Awaited<ReturnType<typeof prepare>>
  const bindNative = (data: Prepared) => native.business.withCase(data.admitted, data.selected, {}, () =>
    portfolio.comparisonBindings.bind({ caseRef: data.selected, resultRef: data.stored.resultRef,
      request: data.pair, expectedRules: data.proofs }, data.admitted))
  const readNative = (data: Prepared) => native.business.withCase(data.admitted, data.selected, {}, () =>
    portfolio.comparisonBindings.read({ caseRef: data.selected, resultRef: data.stored.resultRef }, data.admitted))
  const begin = (afterBatch?: () => void) => {
    deadline.check(); measurement.batches = []; measurement.proofs = 0
    measurement.afterBatch = afterBatch; measurement.active = true
  }
  const outside = () => {
    measurement.active = false; measurement.afterBatch = undefined
    expect(currentSfReadonlySnapshotScope(native.persistence)).toBeUndefined()
  }
  const owned = (count: number) => {
    expect(measurement.batches).toHaveLength(count)
    expect(measurement.proofs).toBe(count)
    for (const batch of measurement.batches) expect(batch).toEqual({
      owned: true, planner: true, same: true, currentAfter: true, booleanOnly: true,
    })
    outside()
  }
  return { native, portfolio, measurement, request, admitComparison, prepare, bindNative, readNative, begin, outside, owned }
}

test("Comparison criteria observation owns the post-proof single-criterion batch and retains protocol, method and authority fences", async () => {
  const deadline = compositionTestDeadline("comparison-criteria-single", 50_000)
  const outcomes: string[] = []
  try {
    // This first part exercises the actual consumer on C08 with a controlled
    // observer protocol. It does not claim a native Planner root.
    const local = await deadline.phase("controlled-setup", () => fixture(deadline))
    const call = context(), writes = new WeakSet<object>()
    const events: string[] = []
    type Input = Parameters<typeof createCriterionComparisonBindings>[0]
    type Observe = NonNullable<Input["observeCriteria"]>
    type Rules = Input["rules"]
    let evaluations = 0, receiverMatches = 0, retained: CriterionComparisonBinding | undefined
    let evaluation: "normal" | "throw-undefined" | "denied" = "normal"
    const host = { requestFor: () => local.control.incoming, revalidate: async () => local.control.active }
    const authorizeCase = async (value: DecisionCase) => local.control.active &&
      value.id === caseRef.id && value.incarnation === caseRef.incarnation && value.version === caseRef.version
    const never = (): never => { throw new Error("No metric or rule write belongs to the controlled missing-rule fixture") }
    const originalRules = createCriterionRuleRegistry({ state: local.port, host, authorizeCase,
      authorizeRule: never, verifyEvidence: never, verifySnapshot: never, readMetric: never, verifyMetric: never,
      operationIdentity: never, proposalCoverageWrites: writes, now: () => at })
    const evaluate = function(this: Rules, ...args: Parameters<Rules["evaluate"]>): ReturnType<Rules["evaluate"]> {
      evaluations++; events.push("evaluate")
      if (this === rules) receiverMatches++
      if (evaluation === "throw-undefined") throw undefined
      if (evaluation === "denied") return Promise.resolve({ status: "denied", reason: "control-denied" })
      return originalRules.evaluate(...args)
    }
    const rules: Rules = { ...originalRules, evaluate,
      resolve: (...args) => { events.push("proofs"); return originalRules.resolve(...args) } }
    const originalResults = createSfDecisionResultStore({ state: local.port, host, authorizeCase,
      verifySources: async (value, refs) => local.control.active && value.kind === "comparison" && refs.length === 0,
      createId: () => "comparison", now: () => at })
    const input: Input = { state: local.port, host, rules, results: { ...originalResults,
      read: (...args) => { events.push("results"); return originalResults.read(...args) } },
      authorizeCase, verifyBinding: async (binding, stored) => {
        retained = binding; events.push("verify")
        return local.control.active && stored.kind === "comparison" && stored.resultRef === binding.resultRef
      }, verifySnapshot: () => local.control.active, operationIdentity: () => "comparison-observation-control",
      proposalCoverageWrites: writes, now: () => at }
    const bindings = createCriterionComparisonBindings(input)
    const read = () => deadline.phase("controlled-read", () =>
      bindings.read({ caseRef, resultRef: local.binding.resultRef }, call))
    const reset = (observe?: Observe) => {
      deadline.check(); events.length = 0; evaluations = 0; receiverMatches = 0; retained = undefined
      evaluation = "normal"; input.rules = rules; rules.evaluate = evaluate; input.observeCriteria = observe
    }
    reset()
    expect(await read()).toEqual({ status: "ok", value: local.binding })
    expect(events).toEqual(["results", "proofs", "verify", "evaluate", "results", "proofs", "verify", "evaluate"])
    expect({ evaluations, receiverMatches }).toEqual({ evaluations: 2, receiverMatches: 2 })
    outcomes.push("absent-opt-in-order-and-receiver")

    let observed = 0
    reset(async (_request, _context, work) => {
      observed++
      const result = await work()
      expect(result).toEqual({ status: "ok", value: true })
      return result
    })
    expect(await read()).toEqual({ status: "ok", value: local.binding })
    expect({ observed, evaluations, receiverMatches }).toEqual({ observed: 2, evaluations: 2, receiverMatches: 2 })
    expect(events).toEqual(["results", "proofs", "verify", "evaluate", "results", "proofs", "verify", "evaluate"])
    outcomes.push("single-work-private-checks")

    const stale = { status: "stale", reason: "comparison-rule-or-source-changed" } as const
    for (const mode of ["no-work", "refused-after-work", "double-work", "late-work"] as const) {
      let late: (() => Promise<PortResult<true>>) | undefined
      let attempts = 0
      reset(async (_request, _context, work) => {
        attempts++
        if (mode === "no-work") return { status: "ok", value: true }
        if (mode === "late-work") { late = work; return { status: "ok", value: true } }
        const result = await work()
        if (mode === "double-work") expect(await work()).toEqual({ status: "unavailable", reason: "comparison-criteria-observation-changed" })
        if (mode === "refused-after-work") return { status: "unavailable", reason: "control-observer-refused" }
        return result
      })
      expect(await read()).toEqual(stale)
      expect(attempts).toBe(1)
      expect(evaluations).toBe(mode === "no-work" || mode === "late-work" ? 0 : 1)
      if (late) {
        expect(await late()).toEqual({ status: "unavailable", reason: "comparison-criteria-observation-changed" })
        expect(evaluations).toBe(0)
      }
      outcomes.push(mode)
    }
    for (const mode of ["hook", "registry", "method", "binding"] as const) {
      reset(async (_request, _context, work) => {
        const result = await work()
        if (mode === "hook") input.observeCriteria = async () => ({ status: "ok", value: true })
        if (mode === "registry") input.rules = { ...rules }
        if (mode === "method") rules.evaluate = (...args) => originalRules.evaluate(...args)
        if (mode === "binding") {
          if (!retained) throw new Error("The actual binding was not retained")
          retained.createdAt = "2027-02-03T00:00:00Z"
        }
        return result
      })
      expect(await read()).toEqual(stale)
      expect({ evaluations, receiverMatches }).toEqual({ evaluations: 1, receiverMatches: 1 })
      outcomes.push(mode + "-drift")
    }
    reset()
    evaluation = "throw-undefined"
    const thrownWithoutObserver = await read()
    expect(thrownWithoutObserver).toEqual({ status: "unavailable", reason: "comparison-binding-unavailable" })
    let caught = false, caughtError: unknown
    reset(async (_request, _context, work) => {
      try { await work() } catch (error) { caught = true; caughtError = error }
      return { status: "ok", value: true }
    })
    evaluation = "throw-undefined"
    expect(await read()).toEqual(thrownWithoutObserver)
    expect(caught).toBe(true)
    expect(caughtError).toBeUndefined()
    expect(evaluations).toBe(1)
    outcomes.push("throw-undefined-not-converted-or-replayed")
    reset(async (_request, _context, work) => work())
    evaluation = "denied"
    expect(await read()).toEqual(stale)
    expect(evaluations).toBe(1)
    outcomes.push("original-check-status")

    const { native, portfolio, measurement, prepare, bindNative, readNative, begin, outside, owned } =
      await nativeComparisonObservationFixture(deadline)
    const single = await deadline.phase("single-criterion-data", () => prepare(native.caseRef, [...native.references], ["cost"]))
    begin()
    const bound = ok(await deadline.phase("native-bind", () => bindNative(single)))
    expect(bound.resultRef).toBe(single.stored.resultRef)
    owned(3)
    // A real durable bind cannot commit inside a readonly owner. Its subsequent
    // two readbacks still run, each with a fresh, closed criterion-batch scope.
    begin()
    expect(await deadline.phase("native-read", () => readNative(single))).toEqual({ status: "ok", value: bound })
    owned(2)
    outcomes.push("native-single-criterion-post-proof-and-durable-bind")

    const nativeEvaluate = portfolio.rules.evaluate
    begin(() => { portfolio.rules.evaluate = (...args) => nativeEvaluate(...args) })
    try {
      expect((await deadline.phase("native-method-drift-read", () => readNative(single))).status).not.toBe("ok")
      expect(measurement.batches).toHaveLength(1)
      expect(measurement.batches[0]?.owned).toBe(true)
      expect(measurement.proofs).toBe(1)
    } finally { portfolio.rules.evaluate = nativeEvaluate; outside() }
    outcomes.push("native-evaluator-identity-drift")

    // Reuse the valid durable binding before any case mutation. The preceding
    // method-drift read restored its method and did not change this binding.
    begin(() => { native.control.active = false })
    try {
      expect((await deadline.phase("native-authority-revocation-read", () => readNative(single))).status).not.toBe("ok")
      expect(measurement.batches).toHaveLength(1)
      expect(measurement.batches[0]?.owned).toBe(true)
      expect(measurement.proofs).toBe(1)
    } finally { native.control.active = true; outside() }
    outcomes.push("native-authority-revoked-after-batch")

    console.info("SF_C22_COMPARISON_CRITERIA_OBSERVATION", JSON.stringify({
      schema: "sf-c22-comparison-criteria-observation-v2", scenario: "single-criterion-and-protocol", qualification: false,
      singleCriterion: { bindingBatches: 3, readBatches: 2, nativeScope: true },
      outcomes,
    }))
  } finally { await deadline.close() }
}, 60_000)

test("Comparison criteria observation retains original parallel evaluation for multiple Planner criteria with a shared source", async () => {
  const deadline = compositionTestDeadline("comparison-criteria-multiple", 50_000)
  const outcomes: string[] = []
  try {
    const { native, portfolio, measurement, request, admitComparison, prepare, bindNative, readNative, begin, outside } =
      await nativeComparisonObservationFixture(deadline)
    // Two independently registered Planner criteria share the same evidence.
    // They keep the original Promise.all route, rather than sharing one new
    // record-proof frame and colliding on concurrent terminal reads.
    const ruleCall = await deadline.phase("multiple-rule-admission", () =>
      admitComparison({ scenarioRefs: [...native.references], criteria: ["cost"] }))
    const originalRule = ok(await deadline.phase("multiple-rule-read", () =>
      native.business.withCase(ruleCall, native.caseRef, {}, () =>
        portfolio.rules.resolve({ caseRef: native.caseRef, criterionId: "cost" }, ruleCall))))
    const multipleRef = await deadline.phase("multiple-case-append", () => native.persistence.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      const selected = state.cases[native.caseRef.id]
      if (!selected) throw new Error("The native fixture case disappeared")
      selected.criteria = [...selected.criteria, { id: "cost-peer", description: "The same Planner subtotal source", required: true }]
      selected.version++; state.versions.cases++; state.revision++
      return { commit: true, value: { id: selected.id, incarnation: selected.incarnation, version: selected.version } }
    }))
    const registration = { caseRef: multipleRef, criterionId: "cost-peer", metricRef: originalRule.metricRef,
      operator: originalRule.operator, value: originalRule.value, unit: originalRule.unit, period: originalRule.period,
      evidenceRefs: originalRule.evidenceRefs, expectedRuleVersion: 0, sensitivity: originalRule.sensitivity }
    await deadline.phase("multiple-rule-registration", async () => {
      const human = ok(await native.authority.human.admit(request(), "decisions.criteria", registration))
      try {
        ok(await native.business.withCase(human, multipleRef, {}, () => portfolio.rules.register(registration, human)))
      } finally { native.authority.human.finish(human) }
    })
    const multiple = await deadline.phase("multiple-criterion-data", () =>
      prepare(multipleRef, [...native.references], ["cost", "cost-peer"]))
    expect(multiple.proofs.map((item) => item.criterionId)).toEqual(["cost", "cost-peer"])
    expect(multiple.proofs.every((item) => item.ruleRef !== null)).toBe(true)
    begin()
    const multipleBinding = ok(await deadline.phase("multiple-native-bind", () => bindNative(multiple)))
    expect(measurement.proofs).toBe(3)
    expect(measurement.batches).toEqual([])
    outside()
    begin()
    expect(await deadline.phase("multiple-native-read", () => readNative(multiple))).toEqual({ status: "ok", value: multipleBinding })
    expect(measurement.proofs).toBe(2)
    expect(measurement.batches).toEqual([])
    outside()
    outcomes.push("multiple-planner-criteria-original-parallel-fallback")

    console.info("SF_C22_COMPARISON_CRITERIA_OBSERVATION", JSON.stringify({
      schema: "sf-c22-comparison-criteria-observation-v2", scenario: "multiple-criteria-shared-source", qualification: false,
      multipleCriteria: { criteria: 2, sharedPlannerSources: true, newBatchObservations: 0 },
      outcomes,
    }))
  } finally { await deadline.close() }
}, 60_000)

test("Comparison criteria observation preserves the complete fallback for unsupported Planner replacements", async () => {
  const deadline = compositionTestDeadline("comparison-criteria-unsupported", 240_000)
  const outcomes: string[] = []
  try {
    const { native, portfolio, measurement, request, prepare, bindNative, readNative, begin, outside } =
      await nativeComparisonObservationFixture(deadline)
    // An actual promoted replacement is outside Finance's closed Planner pair.
    // The observer must retain the complete producer, not invent eligibility.
    const coverageRef = native.proofCoverageRefs?.[1]
    if (!coverageRef) throw new Error("The fixture's real candidate coverage was not retained")
    const promotion = { caseRef: native.caseRef, title: "Unsupported replacement closure",
      coverageRef, scenario: { baseRef: native.sources[1]!.refId, operations: [{
        kind: "replace" as const, targetRef: "line:1",
        replacementRef: plannerValueRef(native.sources[0]!.refId, "line:1:forecast"),
      }], assumptions: [] } }
    const promoted = await deadline.phase("unsupported-promotion", async () => {
      const promotionCall = ok(await native.authority.human.admit(request(), "decisions.promote-alternative", promotion))
      try { return ok(await native.business.withCase(promotionCall, native.caseRef, {}, () =>
        portfolio.mutations.addAlternative(promotion, promotionCall))) }
      finally { native.authority.human.finish(promotionCall) }
    })
    if (!promoted.resultRef) throw new Error("The canonical replacement promotion did not persist its scenario")
    const unsupported = await deadline.phase("unsupported-criterion-data", () =>
      prepare(promoted.caseRef, [native.references[0]!, promoted.resultRef!], ["cost"]))
    begin()
    const unsupportedBinding = ok(await deadline.phase("unsupported-native-bind", () => bindNative(unsupported)))
    expect(measurement.proofs).toBe(3)
    expect(measurement.batches).toHaveLength(3)
    for (const batch of measurement.batches) expect(batch).toEqual({
      owned: false, planner: false, same: false, currentAfter: false, booleanOnly: true,
    })
    outside()
    begin()
    expect(await deadline.phase("unsupported-native-read", () => readNative(unsupported))).toEqual({ status: "ok", value: unsupportedBinding })
    expect(measurement.proofs).toBe(2)
    expect(measurement.batches).toHaveLength(2)
    for (const batch of measurement.batches) expect(batch).toEqual({
      owned: false, planner: false, same: false, currentAfter: false, booleanOnly: true,
    })
    outside()
    outcomes.push("unsupported-planner-closure-complete-fallback")
    console.info("SF_C22_COMPARISON_CRITERIA_OBSERVATION", JSON.stringify({
      schema: "sf-c22-comparison-criteria-observation-v2", scenario: "unsupported-planner-closure", qualification: false,
      unsupportedClosure: { bindingBatches: 3, readBatches: 2, nativeScope: false },
      outcomes,
    }))
  } finally { await deadline.close() }
}, 270_000)
