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
