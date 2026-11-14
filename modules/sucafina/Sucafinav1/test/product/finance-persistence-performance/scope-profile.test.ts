import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { AsyncLocalStorage } from "node:async_hooks"
import { join } from "node:path"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import type { Surface } from "../../../src/identity.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createPlannerSensitivity, plannerSensitivityScenario } from "../../../product/portfolio/planner-sensitivity.ts"
import { decodeSnapshot, encodeSnapshot } from "../../../runtime/local-store.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

function operationCounts() {
  return { calls: 0, callbacks: 0, completed: 0, rejected: 0, inclusiveElapsedMs: 0 }
}

function parseCounts() {
  return { calls: 0, characters: 0, taggedCalls: 0, taggedCharacters: 0 }
}

function sample(label: string) {
  const surfaces = () => ({ dashboard: operationCounts(), planner: operationCounts(), procurement: operationCounts(), all: operationCounts() })
  return {
    label, elapsedMs: 0, outcome: "pending" as "pending" | "resolved" | "rejected", maximumDepth: 0,
    root: surfaces(), nested: surfaces(), currentSnapshots: { insideTransaction: 0, outsideTransaction: 0 },
    parse: { root: parseCounts(), nested: parseCounts(), outsideTransaction: parseCounts() },
  }
}

// Decorate the real instance and delegate every call once with its original
// arguments/results. AsyncLocalStorage follows ancestry across awaits without a
// process-global nesting counter. Only numeric aggregates are retained: neither
// JSON text nor callbacks, snapshots, authorities or operation results enter a log.
function observeStore(store: LocalStore) {
  const phases = new AsyncLocalStorage<ReturnType<typeof sample>>()
  const scopes = new AsyncLocalStorage<{ depth: number }>()
  const observations: ReturnType<typeof sample>[] = []
  const transaction = store.transaction
  const transactionAll = store.transactionAll
  const currentSnapshots = store.currentSnapshots
  const parse = JSON.parse
  const invoke = <T>(surface: Surface | "all", work: (counts?: ReturnType<typeof operationCounts>) => Promise<T>) => {
    const phase = phases.getStore()
    if (!phase) return work()
    const depth = (scopes.getStore()?.depth ?? 0) + 1
    const counts = (depth === 1 ? phase.root : phase.nested)[surface]
    counts.calls++
    phase.maximumDepth = Math.max(phase.maximumDepth, depth)
    const started = performance.now()
    return scopes.run({ depth }, async () => {
      try {
        const result = await work(counts)
        counts.completed++
        return result
      } catch (error) {
        counts.rejected++
        throw error
      } finally { counts.inclusiveElapsedMs += performance.now() - started }
    })
  }
  store.transaction = (surface, work, options) => invoke(surface, (counts) => transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
    if (counts) counts.callbacks++
    return work(snapshot, blobs)
  }, options))
  if (transactionAll) store.transactionAll = (work, options) => invoke("all", (counts) => transactionAll(async (snapshots) => {
    if (counts) counts.callbacks++
    return work(snapshots)
  }, options))
  if (currentSnapshots) store.currentSnapshots = () => {
    const phase = phases.getStore()
    if (phase) {
      if (scopes.getStore()) phase.currentSnapshots.insideTransaction++
      else phase.currentSnapshots.outsideTransaction++
    }
    return currentSnapshots()
  }
  // A pass-through wrapper avoids spyOn's argument retention for large payloads.
  // Its lifetime is this serial test only and it is restored before cleanup.
  JSON.parse = (text, reviver) => {
    const phase = phases.getStore()
    if (phase) {
      const depth = scopes.getStore()?.depth ?? 0
      const counts = depth === 0 ? phase.parse.outsideTransaction : depth === 1 ? phase.parse.root : phase.parse.nested
      counts.calls++
      if (typeof text === "string") {
        counts.characters += text.length
        if (text.startsWith('["sucafina-snapshot",')) {
          counts.taggedCalls++
          counts.taggedCharacters += text.length
        }
      }
    }
    return parse(text, reviver)
  }
  return {
    observations,
    measure: async <T>(label: string, work: () => Promise<T>) => {
      const observation = sample(label)
      observations.push(observation)
      const started = performance.now()
      try {
        const result = await phases.run(observation, work)
        observation.outcome = "resolved"
        return result
      } catch (error) {
        observation.outcome = "rejected"
        throw error
      } finally { observation.elapsedMs = performance.now() - started }
    },
    restore: () => {
      store.transaction = transaction
      if (transactionAll) store.transactionAll = transactionAll
      if (currentSnapshots) store.currentSnapshots = currentSnapshots
      JSON.parse = parse
      scopes.disable()
      phases.disable()
    },
  }
}

test("FIN-IND-005 real confirmed witness classifies SQLite root and nested materialization work", async () => {
  const started = performance.now()
  const history = await createRenewalChoiceHistory()
  const fixtureCreateMs = performance.now() - started
  const observation = observeStore(history.fixture.store)
  try {
    const before = history.before
    expect(before.baselineResult.knownSubtotal).toBe(240000)
    expect(before.selectedResult).toMatchObject({ knownSubtotal: 210000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
    expect(before.selectedResult.components.some((component) => component.id.startsWith("training:"))).toBe(false)
    const priorEvaluate = createPlannerSensitivity({
      results: before.results, resolve: before.issuer.resolve, revalidate: before.issuer.revalidate,
      preview: before.preview, exactThreshold: (request, binding, context) => before.exact(request, binding.baselineRef, context),
      idempotencyKey: async () => "wp13-before-training",
    })
    const priorRequest = { ...before.sensitivityRequest, parameterBounds: { ...before.sensitivityRequest.parameterBounds, steps: 1 } }
    const prior = await observation.measure("omitted.evaluate", () => priorEvaluate(priorRequest, history.fixture.context))
    if (prior.status !== "ok") throw new Error(`Omitted training analysis unavailable: ${JSON.stringify(prior)}`)
    expect(prior.value.threshold).toBeCloseTo(55000, 8)
    expect(prior.value.thresholdEvidence.state).toBe("exact")
    expect(prior.value.comparisonStatus).toBe("conditioned")
    expect(prior.value.unresolvedConditions.some((condition) => condition.id === "known-components-threshold" && condition.reason.includes("known components"))).toBe(true)
    expect(prior.value.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(before.selectedResult.costCoverage.derivedMissingCategoryIds).toContain("training")
    const chosen = await observation.measure("choice.record", history.choose)
    const originalChoice = digestSfValue(chosen.choice)
    expect(chosen.choice).toMatchObject({ alternativeId: "selected", alternativeVersion: before.selectedResult.costCoverage.alternativeVersion, basisVersion: before.basis.version, comparisonStatus: "conditioned", result: { knownSubtotal: 210000, total: null }, costCoverage: { coverageState: "pending", derivedMissingCategoryIds: ["training"] } })
    const after = await observation.measure("training.confirm", history.resolveTraining)
    expect(after.caseRef.id).toBe(before.caseRef.id)
    expect(after.caseRef.incarnation).toBe(before.caseRef.incarnation)
    expect(after.caseRef.version).toBeGreaterThan(chosen.caseRef.version)
    expect(after.scenario.operations).toEqual([])
    expect(after.selectedResult).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete", costCoverage: { coverageState: "complete", derivedMissingCategoryIds: [] } })
    expect(after.selectedResult.components.find((component) => component.id === "training:11")).toMatchObject({ amount: 40000, currency: "USD", evidenceState: "confirmed" })
    expect(after.advantageComparison.completeDifference).toBe(-10000)
    expect(after.comparison.criterionResults).toMatchObject([{ criterionId: "renewal-difference", state: "failed" }])
    const database = new Database(join(history.fixture.directory, "installation.sqlite"), { readonly: true, strict: true })
    try {
      const persisted = database.query<{ surface: string; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all()
      const payload = persisted.find((row) => row.surface === "dashboard")?.payload
      if (!payload) throw new Error("Confirmed SQLite dashboard snapshot unavailable")
      const state = decodeSnapshot(payload).data.__sfProductV1 as SfProductState
      const sizes = {
        stateBytes: new TextEncoder().encode(JSON.stringify(state)).length,
        payloadCharacters: payload.length,
        caseBytes: new TextEncoder().encode(JSON.stringify(state.cases[after.caseRef.id])).length,
        cases: Object.keys(state.cases).length, results: Object.keys(state.decisionResults ?? {}).length,
        transactions: Object.keys(state.transactions).length,
        surfaces: persisted.map((row) => ({ surface: row.surface, payloadCharacters: row.payload.length })),
      }
      expect(sizes.stateBytes).toBeGreaterThan(800000)
      expect(sizes.caseBytes).toBeGreaterThan(100000)
      console.log("FIN_PERSISTENCE_SCOPE_STATE " + JSON.stringify(sizes))
      const request = { ...after.sensitivityRequest, parameterBounds: { ...after.sensitivityRequest.parameterBounds, steps: 1 } }
      const binding = await observation.measure("confirmed.issuer.resolve", () => after.issuer.resolve(request, history.fixture.context))
      if (binding.status !== "ok") throw new Error("Current source parameter unavailable")
      expect(binding.value.parameterOperation).toMatchObject({ targetRef: "implementation:11", amount: 45000, currency: "USD" })
      const preview = await observation.measure("confirmed.witness.15000", () => after.preview({
        baselineRef: after.baselineRef, scenario: plannerSensitivityScenario(binding.value, "implementation:11", 15000),
      }, history.fixture.context))
      if (preview.status !== "ok") throw new Error(`Source-only threshold witness unavailable: ${JSON.stringify(preview)}`)
      expect(preview.value.metric.value).toBe(-20000)
      expect(preview.value.sample.total).toBeNull()
      if (preview.value.metric.value === null) throw new Error("Threshold witness has no metric")
      expect(preview.value.metric.value <= request.criterion.value).toBe(true)
      const decision = await observation.measure("history.read", history.readCase)
      expect(decision.choices).toHaveLength(1)
      expect(digestSfValue(decision.choices[0])).toBe(originalChoice)
      expect(decision.state).toBe("reconsidering")
      expect(decision.preparedChanges).toEqual([])
      expect(decision.receipts).toEqual([])
      const originalDecision = digestSfValue(decision)
      expect(Reflect.set(decision.choices, "length", 0)).toBe(true)
      const freshDecision = await observation.measure("isolation.history.read", history.readCase)
      expect(digestSfValue(freshDecision)).toBe(originalDecision)
      expect(freshDecision).not.toBe(decision)
      expect(freshDecision.choices).not.toBe(decision.choices)
      const readSnapshot = () => history.fixture.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))
      const retained = await observation.measure("isolation.snapshot.first", readSnapshot)
      expect(encodeSnapshot(retained)).toBe(payload)
      retained.data.__sfProductV1 = { corrupted: true }
      retained.versions["scope-profile-private"] = { version: 99, by: "uncommitted" }
      const fresh = await observation.measure("isolation.snapshot.fresh", readSnapshot)
      expect(encodeSnapshot(fresh)).toBe(payload)
      expect(fresh).not.toBe(retained)
      expect(fresh.data).not.toBe(retained.data)
      expect(database.query<{ surface: string; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all()).toEqual(persisted)
    } finally { database.close() }
  } finally {
    observation.restore()
    console.log("FIN_PERSISTENCE_SCOPE_PROFILE " + JSON.stringify({
      fixtureCreateMs, observations: observation.observations,
      interpretation: "Ancestry follows real store calls across awaits. Surface labels name requested transaction surfaces; all means transactionAll. Timings are inclusive and may overlap. JSON sizes count UTF-16 code units; payloads are never retained by the observer. Counts classify observed work, not expected product behavior.",
      disclosure: "Unchanged real Finance/C08/SQLite fixture and original omitted.evaluate preparation, with synthetic grants. The confirmed operation is issuer.resolve plus witness 15000 only. This does not rerun confirmed sensitivity, witness 15001, replay, restart or access and cannot close FIN-IND-005.",
    }))
    await history.cleanup()
  }
}, 120000)
