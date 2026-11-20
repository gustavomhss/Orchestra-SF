import { expect, test } from "bun:test"
import { object } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfSignalSelection } from "../../../../product/decision-memory/signal-registry.ts"
import { SF_SIGNAL_REGISTRY_PREFIX } from "../../../../product/decision-memory/signal-registry.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfMemoryServices } from "../../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfMemoryHttp } from "../../../../../../../apps/cli/src/sucafina-product/memory-http.ts"
import { plannerObservationFixture } from "./planner-observation-batch-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<Value>(result: PortResult<Value>, label: string): Value {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

async function conditionFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await plannerObservationFixture(deadline, false, {
    sourceOnly: true, humanActions: ["decisions.condition.record"],
  })
  const choiceInput = { caseRef: fixture.caseRef, alternativeId: "candidate", alternativeVersion: 1,
    comparison: { scenarioRefs: [fixture.request.baselineRef, fixture.request.scenarioRef], criteria: ["cost"] },
    criteria: ["cost"], reason: "Preserve the actual compared alternatives for a memory condition." }
  const admitted = ok(await fixture.authority.human.admit(fixture.stateRequest(), "decisions.choose", choiceInput), "Human choice")
  const chosen = ok(await fixture.business.withCase(admitted, fixture.caseRef, {}, () =>
    fixture.portfolio.mutations.recordChoice(choiceInput, admitted)).finally(() => fixture.authority.human.finish(admitted)), "Recorded choice")
  const current = ok(await fixture.business.cases.read({ caseRef: encodeCaseRef(chosen.caseRef) }, fixture.call), "Current chosen case")
  const choice = current.case.choices.find((entry) => entry.alternativeId === "candidate")
  const candidate = current.case.alternatives.find((entry) => entry.id === "candidate")
  if (!choice || !candidate) throw new Error("The actual choice and candidate are required")
  // Re-persist the same current alternative through C09. The selected siblings
  // now have different producer versions; each version keeps both case phases.
  const newer = ok(await fixture.business.withCase(fixture.call, chosen.caseRef, {}, () => fixture.business.results.write({
    kind: "scenario", caseRef: chosen.caseRef, result: candidate.result, requestDigest: digestSfValue(candidate.scenario),
    sourceRefs: candidate.result.sourceRefs, idempotencyKey: "memory-current-alternative",
  }, fixture.call)), "Current-version stored alternative")
  const evidence = fixture.sources[0]!
  if (evidence.kind !== "record") throw new Error("The real Planner source must be a record")
  const baseline = current.case.alternatives.find((entry) => entry.id === "baseline")
  const source = baseline?.result.components.flatMap((component) => component.sourceRefs).find((ref) =>
    ref.surface === evidence.target.surface && ref.type === evidence.target.recordType && ref.id === evidence.target.recordId &&
    ref.incarnation === evidence.target.incarnation && ref.version === evidence.target.version)
  if (!source) throw new Error("The original Planner component must identify the selected source")
  const signal: SfSignalSelection = { caseRef: chosen.caseRef, choiceId: choice.id,
    scenarioRefs: [fixture.request.baselineRef, newer.resultRef], source, evidence,
    fields: source.fields.filter((field) => evidence.target.fields.includes(field)), period: fixture.period,
    criterionId: "cost", recipientRef: fixture.call.binding.principalRef, destination: "/sucafina/planner",
    label: "Observe the preserved Planner commitment" }
  if (!signal.fields.length) throw new Error("The selected source has no shared fields")
  const memory = createSfMemoryServices({ authority: fixture.authority, business: fixture.business,
    signalRegistryWrites: fixture.guards.signalRegistryWrites })
  const http = createSfMemoryHttp({ origin: "https://example.test", mount: "/sucafina", authority: fixture.authority,
    memory, withCase: fixture.business.withCase,
    similarCases: async () => ({ status: "unavailable", reason: "similarity-not-used-by-condition" }),
  })
  const register = async () => {
    const response = await http(new Request("https://example.test/sucafina/dashboard?sf=memory-condition", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json",
        "x-operation": "memory-batch-register" }, body: JSON.stringify(signal),
    }), "dashboard")
    if (!response) throw new Error("The real memory-condition route did not handle the request")
    return { status: response.status, body: await response.json() }
  }
  const capture = async () => ({
    state: await fixture.authority.state.read(fixture.stateRequest(), "cases", (state, actor) => ({ state, actor })),
    snapshots: await fixture.store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) })),
  })
  return { ...fixture, signal, choice, current, register, capture }
}

type ConditionFixture = Awaited<ReturnType<typeof conditionFixture>>
type Fault = "reader" | "source" | "lease"

function observeCondition(fixture: ConditionFixture, deadline: ReturnType<typeof compositionTestDeadline>, fault?: Fault) {
  const reads = { cases: [] as string[], concurrent: 0, maximum: 0, roots: 0,
    resultFrames: [] as { resultRef: unknown; caseRef: unknown; resultDigest: unknown }[][],
    selectionFrames: [] as unknown[][], changed: false, replacementCalls: 0 }
  const cases = fixture.business.cases.read, stateRead = fixture.authority.state.read
  const root = fixture.store.readSnapshotRoot, scalar = fixture.scenarios.resolve
  let currentCall: TrustedDomainContext | undefined
  fixture.business.cases.read = async (request, call) => {
    currentCall = call
    reads.concurrent++
    reads.maximum = Math.max(reads.maximum, reads.concurrent)
    try {
      const result = await cases(request, call)
      reads.cases.push(result.status)
      return result
    } finally { reads.concurrent-- }
  }
  fixture.store.readSnapshotRoot = (...args) => { reads.roots++; return root(...args) }
  fixture.authority.state.read = async (request, namespace, select) => {
    const result = await stateRead(request, namespace, select)
    if (namespace !== "cases" || result.status !== "ok" || !Array.isArray(result.value)) return result
    const values = result.value.map(object)
    if (values.length === 2 && values.every((value, index) => value.schema === "sf-decision-result-v1" &&
      value.resultRef === fixture.signal.scenarioRefs[index])) reads.selectionFrames.push(structuredClone(values))
    if (values.length !== 2 || !values.every((value, index) =>
      object(value.stored).resultRef === fixture.signal.scenarioRefs[index])) return result
    reads.resultFrames.push(values.map((value) => ({ resultRef: object(value.stored).resultRef,
      caseRef: structuredClone(object(value.stored).caseRef), resultDigest: object(value.stored).resultDigest })))
    // The sixth envelope is the independent final C08 result observation of
    // the first complete resolveMany. The final case phase still follows it.
    if (reads.resultFrames.length === 6 && fault) {
      reads.changed = true
      if (fault === "reader") fixture.scenarios.resolve = (...args) => { reads.replacementCalls++; return scalar(...args) }
      if (fault === "lease") {
        if (!currentCall) throw new Error("A real admitted condition call is required")
        fixture.authority.ui.finish(currentCall)
      }
      if (fault === "source") await fixture.persistence.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
        const actual = versions.find((version) => version.id === "v0")
        if (!actual) throw new Error("The recorded baseline source is missing")
        actual.lines[0]!.f[0] = 101
        return { commit: true, value: undefined }
      })
    }
    return result
  }
  deadline.own(() => {
    fixture.business.cases.read = cases
    fixture.authority.state.read = stateRead
    fixture.store.readSnapshotRoot = root
    fixture.scenarios.resolve = scalar
  })
  return reads
}

test("memory condition resolves both real producer versions in one ordered batch without overlapping case authority", async () => {
  const deadline = compositionTestDeadline("memory-condition-registered-batch")
  try {
    const fixture = await conditionFixture(deadline)
    const before = await fixture.capture()
    if (before.state.status !== "ok") throw new Error("The initial protected envelope is unavailable")
    const stored = fixture.signal.scenarioRefs.map((ref) => before.state.value.state.decisionResults?.[ref])
    expect(stored.every((value) => value?.kind === "scenario")).toBe(true)
    expect(stored.map((value) => value?.caseRef.version)).toEqual([fixture.caseRef.version, fixture.signal.caseRef.version])
    expect(fixture.signal.caseRef.version).toBe(fixture.caseRef.version + 1)
    const observed = observeCondition(fixture, deadline)
    const response = await fixture.register()
    expect(response).toEqual({ status: 200, body: { status: "ok" } })
    expect(observed.maximum).toBe(1)
    expect(observed.cases).toEqual(Array(10).fill("ok"))
    expect(observed.roots).toBe(10)
    expect(observed.resultFrames).toHaveLength(12)
    const frame = stored.map((value) => ({ resultRef: value!.resultRef, caseRef: value!.caseRef, resultDigest: value!.resultDigest }))
    expect(observed.resultFrames).toEqual(Array.from({ length: 12 }, () => frame))
    expect(observed.selectionFrames).toEqual(Array.from({ length: 4 }, () => stored))
    const after = await fixture.capture()
    if (after.state.status !== "ok") throw new Error("The final protected envelope is unavailable")
    const keys = Object.keys(after.state.value.state.preferences).filter((key) => key.startsWith(SF_SIGNAL_REGISTRY_PREFIX))
    expect(keys).toHaveLength(1)
    const key = keys[0]!, id = key.slice(SF_SIGNAL_REGISTRY_PREFIX.length)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const expected = structuredClone(before.state)
    expected.aggregateRevision++
    expected.value.state.revision++
    expected.value.state.versions.preferences++
    expected.value.state.preferences[key] = { schema: "sf-memory-condition-v1", id, selection: fixture.signal,
      principalRef: fixture.call.binding.principalRef, choiceDigest: digestSfValue(fixture.choice), revision: 1 }
    expected.value.state.transactions[JSON.stringify([fixture.call.binding.principalRef, "preferences",
      encodeCaseRef(fixture.signal.caseRef), "signal-condition:memory-batch-register"])] = {
      namespace: "preferences", scopeDigest: digestSfValue({ namespaces: ["preferences"], domainSurface: "planner" }),
      principalRef: fixture.call.binding.principalRef, targetRef: encodeCaseRef(fixture.signal.caseRef),
      targetIncarnation: fixture.signal.caseRef.incarnation, commandDigest: digestSfValue(fixture.signal),
      storageVersion: expected.value.state.versions.preferences, aggregateRevision: expected.aggregateRevision,
      incarnation: expected.incarnation, value: true,
    }
    // Compare the complete C08 envelope, every namespace and the exact new
    // transaction; no aggregate metadata or unrelated state is omitted.
    expect(after.state).toEqual(expected)
    expect(after.snapshots.planner).toEqual(before.snapshots.planner)
    expect(after.snapshots.procurement).toEqual(before.snapshots.procurement)
  } finally { await deadline.close() }
}, 120_000)

for (const fault of ["reader", "source", "lease"] as const) {
  test("memory condition refuses " + fault + " change after the final result envelope without persisting a binding", async () => {
    const deadline = compositionTestDeadline("memory-condition-final-" + fault)
    try {
      const fixture = await conditionFixture(deadline)
      const before = await fixture.capture()
      if (before.state.status !== "ok") throw new Error("The initial protected envelope is unavailable")
      const observed = observeCondition(fixture, deadline, fault)
      const response = await fixture.register()
      expect(observed.changed).toBe(true)
      expect(observed.resultFrames).toHaveLength(6)
      expect(observed.maximum).toBe(1)
      expect(observed.replacementCalls).toBe(0)
      expect(response.status).toBe(fault === "lease" ? 403 : 503)
      expect(response.body).toEqual(fault === "lease"
        ? { status: "denied", reason: "case-selection-authority-changed" }
        : { status: "unavailable", reason: "memory-selection-source-unavailable" })
      const after = await fixture.capture()
      expect(after.state).toEqual(before.state)
      expect(after.snapshots.dashboard).toEqual(before.snapshots.dashboard)
      expect(after.snapshots.procurement).toEqual(before.snapshots.procurement)
      if (fault === "source") {
        expect(after.snapshots.planner).not.toEqual(before.snapshots.planner)
        const versions = after.snapshots.planner.data.versions as { id: string; lines: { f: number[] }[] }[]
        expect(versions.find((version) => version.id === "v0")!.lines[0]!.f[0]).toBe(101)
      } else expect(after.snapshots.planner).toEqual(before.snapshots.planner)
    } finally { await deadline.close() }
  }, 120_000)
}
