import { expect, test } from "bun:test"
import type { DecisionCase, CostCoverageBasis, CostCoverageAssessment } from "../../../../product/contracts/decisions.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { Persistence, Snapshot } from "../../../../runtime/contract.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../../product/decisions/coverage-access.ts"
import { createSfProductState, initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"

const caseId = "coverage-case", incarnation = "coverage-inc", alternativeId = "alternative"
const reference = decisionCoverageRef({ id: caseId, incarnation }, alternativeId, 1)

function decision(): DecisionCase {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "selector-unit",
    categoryIds: ["training"], sourceRefs: [], additionalCategoryIds: [] }
  const assessment: CostCoverageAssessment = { basisId: basis.id, basisVersion: 1,
    alternativeId, alternativeVersion: 1, currency: "USD", horizon,
    coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "No evidence supplied" }],
    derivedMissingCategoryIds: ["training"], evaluatedSourceRefs: [], issues: ["No evidence supplied"] }
  return { id: caseId, incarnation, version: 1, state: "comparing", objective: "Exercise private coverage reads",
    horizon, currency: "USD", criteria: [], participants: ["principal"], sourceRefs: [],
    alternatives: [{ id: alternativeId, version: 1, title: "Pending unit alternative",
      scenario: { baseRef: "unit-source", operations: [], assumptions: [] },
      result: { id: "unit-result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
        unresolvedConditions: ["No evidence supplied"], restrictions: [], comparisonStatus: "conditioned",
        costCoverage: assessment, knownSubtotal: null, total: null } }],
    costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
}

/** Real C08 provider and immutable UI context over a deterministic memory driver.
 * This is selector/authority-order evidence, not installed or durability qualification. */
async function fixture(opaque: boolean) {
  const actor: SfStateAuthority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const control = { active: true, denyC08: false, beforeAuthority: (_count: number) => {},
    afterEvidence: (_count: number) => {} }
  const stats = { reads: 0, authority: 0, cases: 0, evidence: 0, wholeClones: 0, caseClones: 0 }
  const events: string[] = []
  const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const persistence: Persistence = { transaction: async (_surface, work) => (await work(snapshot)).value }
  await initializeAbsentSfProductState(persistence, () => "unit-state")
  const stored = snapshot.data.__sfProductV1 as SfProductState
  const selected = decision()
  stored.cases[caseId] = selected
  stored.cases.other = { ...structuredClone(selected), id: "other", incarnation: "other-inc" }
  stored.preferences["unrelated-marker"] = { retained: "unrelated product data" }

  const request = new Request("https://example.test/coverage", { method: "POST" })
  let serial = 0
  const ui = createSfUiAuthority({
    authorize: async () => control.active ? { ...actor, installationId: "installation", projectId: "project" } : undefined,
    createId: () => "unit-" + ++serial, now: () => Date.parse("2027-02-02T00:00:00Z"),
    commandIdentity: async () => "unit-command",
  })
  const admission = await ui.admit(request, "sf_forecast_compare", "a".repeat(64))
  if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_forecast_compare", "a".repeat(64)))
    throw new Error("Unit UI context was not admitted")
  const call = admission.value
  const provider = createSfProductState({ persistence, createId: () => "unused",
    authorize: async () => {
      events.push("authority-" + ++stats.authority)
      await Promise.resolve()
      control.beforeAuthority(stats.authority)
      return control.active && !control.denyC08 ? { ...actor } : undefined
    },
    resolveTarget: async () => undefined })
  const state: SfProductStatePort = { ...provider, read: (source, namespace, read) => {
    events.push("read-" + ++stats.reads)
    // Wrapping the callback intentionally selects the existing opaque full-clone path.
    return provider.read(source, namespace, opaque ? (value, authority) => read(value, authority) : read)
  } }
  const coverage = createDecisionCoverageAccess({
    state,
    // These deterministic host callbacks do not inspect opaque contexts before C08.
    host: { requestFor: () => request, revalidate: async () => { events.push("host"); return control.active } },
    authorizeCase: async (value, context) => {
      events.push("case-" + ++stats.cases)
      return control.active && value.participants.includes(context.binding.principalRef)
    },
    verifyEvidence: async () => {
      events.push("evidence-" + ++stats.evidence)
      control.afterEvidence(stats.evidence)
      return true
    },
  })
  const run = async (context: TrustedDomainContext = call) => {
    const root = snapshot.data.__sfProductV1
    const original = globalThis.structuredClone
    globalThis.structuredClone = (value, options) => {
      if (value === root) stats.wholeClones++
      if (value === selected) stats.caseClones++
      return original(value, options)
    }
    try { return await coverage(reference, context) }
    finally { globalThis.structuredClone = original }
  }
  return { call, control, stats, events, snapshot, stored, selected, run, finish: () => ui.finish(call) }
}

for (const mode of ["frozen", "mutable", "binding-accessor"] as const) {
  test("coverage case selection preserves fresh copies and producer order with " + mode + " context", async () => {
    const outcomes = []
    for (const opaque of [false, true]) {
      const f = await fixture(opaque)
      try {
        let context: TrustedDomainContext = f.call
        if (mode === "mutable") context = { ...f.call, binding: { ...f.call.binding } }
        if (mode === "binding-accessor") {
          const copy = { ...f.call }
          Object.defineProperty(copy, "binding", { enumerable: true, get() {
            f.events.push("binding-get")
            return f.call.binding
          } })
          context = Object.freeze(copy)
        }
        expect(Object.isFrozen(f.call)).toBe(true)
        expect(Object.isFrozen(f.call.binding)).toBe(true)
        const before = structuredClone(f.stored)
        const result = await f.run(context)
        expect(result.status).toBe("ok")
        if (result.status !== "ok") throw new Error("Coverage selector did not return its pending fixture")
        const original = structuredClone(result)
        expect(result.value.assessment.coverageState).toBe("pending")
        expect(f.stats).toEqual({ reads: 2, authority: 4, cases: 2, evidence: 2,
          wholeClones: !opaque && mode === "frozen" ? 0 : 2,
          caseClones: !opaque && mode === "frozen" ? 2 : 0 })
        expect(f.events.filter((event) => event !== "binding-get")).toEqual([
          "host", "read-1", "authority-1", "authority-2", "case-1", "evidence-1",
          "read-2", "authority-3", "authority-4", "case-2", "evidence-2", "host",
        ])
        if (mode === "binding-accessor")
          expect(f.events.indexOf("binding-get")).toBeGreaterThan(f.events.indexOf("authority-1"))
        Object.assign(result.value.basis, { categoryIds: ["mutated return"] })
        Object.assign(result.value.assessment, { basisId: "mutated return" })
        expect(f.stored).toEqual(before)
        expect(await f.run(context)).toEqual(original)
        expect(f.stored).toEqual(before)
        outcomes.push(original)
      } finally { f.finish() }
    }
    expect(outcomes[0]).toEqual(outcomes[1])
  })
}

for (const kind of ["context-proxy", "binding-proxy", "binding-accessor"] as const) {
  test("denied C08 does not inspect opaque coverage " + kind + " before admission", async () => {
    const f = await fixture(false)
    try {
      let traps = 0
      const fail = () => { traps++; throw new Error("Opaque context inspected before C08") }
      let context: TrustedDomainContext
      if (kind === "context-proxy") context = new Proxy(f.call, {
        getOwnPropertyDescriptor: fail, isExtensible: fail, ownKeys: fail,
      })
      else if (kind === "binding-proxy") context = Object.freeze({ ...f.call,
        binding: new Proxy(f.call.binding, { getOwnPropertyDescriptor: fail, isExtensible: fail, ownKeys: fail }) })
      else {
        const copy = { ...f.call }
        Object.defineProperty(copy, "binding", { enumerable: true, get: fail })
        context = Object.freeze(copy)
      }
      f.control.denyC08 = true
      expect(await f.run(context)).toEqual({ status: "unavailable", reason: "coverage-unavailable" })
      expect(traps).toBe(0)
      expect(f.stats).toEqual({ reads: 1, authority: 1, cases: 0, evidence: 0, wholeClones: 0, caseClones: 0 })
      expect(f.events).toEqual(["host", "read-1", "authority-1"])
    } finally { f.finish() }
  })
}

for (const kind of ["state-proxy", "cases-proxy", "cases-prototype"] as const) {
  test("coverage selection retains the original opaque-container path for " + kind, async () => {
    const outcomes = []
    for (const opaque of [false, true]) {
      const f = await fixture(opaque)
      try {
        if (kind === "state-proxy") f.snapshot.data.__sfProductV1 = new Proxy(f.stored, {})
        else if (kind === "cases-proxy") f.stored.cases = new Proxy(f.stored.cases, {})
        else f.stored.cases = Object.assign(Object.create({ inherited: true }), f.stored.cases)
        const result = await f.run()
        expect(f.stats.caseClones).toBe(0)
        if (kind === "cases-prototype") {
          expect(result.status).toBe("ok")
          expect(f.stats.wholeClones).toBe(2)
          expect(f.stats.reads).toBe(2)
        } else {
          expect(result).toEqual({ status: "unavailable", reason: "coverage-unavailable" })
          expect(f.stats.wholeClones).toBe(1)
          expect(f.stats.reads).toBe(1)
          expect(f.stats.cases).toBe(0)
          expect(f.stats.evidence).toBe(0)
        }
        outcomes.push(result)
      } finally { f.finish() }
    }
    expect(outcomes[0]).toEqual(outcomes[1])
  })
}

for (const boundary of [2, 4] as const) {
  test("coverage selection cannot disclose after C08 reauthorization " + boundary + " is revoked", async () => {
    const outcomes = []
    for (const opaque of [false, true]) {
      const f = await fixture(opaque)
      try {
        f.control.beforeAuthority = (count) => { if (count === boundary) f.control.active = false }
        const result = await f.run()
        expect(result.status).not.toBe("ok")
        expect("value" in result).toBe(false)
        expect(f.stats.reads).toBe(boundary / 2)
        expect(f.stats.authority).toBe(boundary)
        outcomes.push({ result, events: f.events })
      } finally { f.finish() }
    }
    expect(outcomes[0]).toEqual(outcomes[1])
  })
}

test("coverage selection observes a case change between its two real reads", async () => {
  const outcomes = []
  for (const opaque of [false, true]) {
    const f = await fixture(opaque)
    try {
      f.control.afterEvidence = (count) => { if (count === 1) f.selected.version++ }
      const result = await f.run()
      expect(result).toEqual({ status: "stale", reason: "coverage-changed" })
      expect(f.stats.reads).toBe(2)
      expect(f.stats.authority).toBe(4)
      expect(f.stats.cases).toBe(1)
      expect(f.stats.evidence).toBe(1)
      expect(f.selected.version).toBe(2)
      outcomes.push({ result, events: f.events })
    } finally { f.finish() }
  }
  expect(outcomes[0]).toEqual(outcomes[1])
})

test("a mutable coverage binding is read after the current C08 admission", async () => {
  const outcomes = []
  for (const opaque of [false, true]) {
    const f = await fixture(opaque)
    try {
      const context = { ...f.call, binding: { ...f.call.binding } }
      f.control.beforeAuthority = (count) => { if (count === 1) context.binding.accessRevision = "changed" }
      expect(await f.run(context)).toEqual({ status: "unavailable", reason: "coverage-unavailable" })
      expect(f.stats.reads).toBe(1)
      expect(f.stats.authority).toBe(2)
      expect(f.stats.wholeClones).toBe(1)
      expect(f.stats.caseClones).toBe(0)
      outcomes.push(f.events)
    } finally { f.finish() }
  }
  expect(outcomes[0]).toEqual(outcomes[1])
})
