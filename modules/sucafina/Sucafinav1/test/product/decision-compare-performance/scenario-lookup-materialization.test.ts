import { expect, test } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { selectSfCaseIdentity, selectSfScenarioCandidates } from "../../../product/host-binding/state-provider.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

// Real C08/SQLite and Planner corpus; the unchanged renewal fixture declares
// synthetic source grants. These measurements do not qualify the installed UI.
test("scenario candidates keep the complete result graph while omitting unrelated state clones", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    await history.choose()
    const phase = await history.resolveTraining()
    expect(phase.selectedResult).toMatchObject({ total: 250000, comparisonStatus: "complete" })
    expect(phase.advantageComparison.completeDifference).toBe(-10000)
    const decision = await history.readCase()
    const originalDigest = digestSfValue(decision)
    const sizes = await history.fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      return { commit: false, value: {
        stateBytes: new TextEncoder().encode(JSON.stringify(state)).length,
        resultMapBytes: new TextEncoder().encode(JSON.stringify(state.decisionResults)).length,
        caseBytes: new TextEncoder().encode(JSON.stringify(state.cases)).length,
        transactionBytes: new TextEncoder().encode(JSON.stringify(state.transactions)).length,
        cases: Object.keys(state.cases).length, results: Object.keys(state.decisionResults ?? {}).length,
        transactions: Object.keys(state.transactions).length,
      } }
    })
    expect(sizes.stateBytes).toBeGreaterThan(800000)
    expect(sizes.results).toBeGreaterThanOrEqual(10)
    const selector = selectSfScenarioCandidates({ caseRef: phase.caseRef }, digestSfValue(phase.scenario), digestSfValue(phase.selectedResult), history.fixture.context)
    const counts = { instrument: false, transactions: 0, unrelatedClones: 0, caseClones: 0, resultClones: 0 }
    const transaction = history.fixture.store.transaction
    history.fixture.store.transaction = (surface, work, options) => transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
      if (surface !== "dashboard") return work(snapshot, blobs)
      counts.transactions++
      if (!counts.instrument) return work(snapshot, blobs)
      const state = snapshot.data.__sfProductV1 as SfProductState
      const key = Object.keys(state.preferences)[0], selected = state.cases[decision.id]
      if (!key || !selected || !state.decisionResults) throw new Error("Representative candidate corpus missing")
      const preference = state.preferences[key], objective = selected.objective
      Object.defineProperty(state.preferences, key, { enumerable: true, configurable: true, get: () => { counts.unrelatedClones++; return preference } })
      Object.defineProperty(selected, "objective", { enumerable: true, configurable: true, get: () => { counts.caseClones++; return objective } })
      for (const result of Object.values(state.decisionResults)) {
        const createdAt = result.createdAt
        Object.defineProperty(result, "createdAt", { enumerable: true, configurable: true, get: () => { counts.resultClones++; return createdAt } })
      }
      const result = await work(snapshot, blobs)
      if (result.commit) throw new Error("Candidate read observation must not persist")
      return result
    }, options)
    const observe = async (mode: "canonical" | "opaque", instrument: boolean) => {
      Object.assign(counts, { instrument, transactions: 0, unrelatedClones: 0, caseClones: 0, resultClones: 0 })
      const start = performance.now()
      const result = await history.state.read(history.fixture.request, "cases", mode === "opaque"
        ? (state, authority) => selector(state, authority) : selector)
      const elapsedMs = performance.now() - start
      expect(result.status).toBe("ok")
      if (result.status !== "ok" || !result.value?.length) throw new Error("Persisted scenario candidates missing")
      expect(result.value.some((value) => value.resultRef === phase.selectedRef)).toBe(true)
      return { mode, elapsedMs, transactions: counts.transactions, unrelatedClones: counts.unrelatedClones, caseClones: counts.caseClones,
        resultClones: counts.resultClones, resultDigest: digestSfValue(result.value),
        candidateBytes: new TextEncoder().encode(JSON.stringify(result.value)).length,
        metadata: { storageVersion: result.storageVersion, aggregateRevision: result.aggregateRevision, incarnation: result.incarnation } }
    }
    const opaque = await observe("opaque", true)
    const canonical = await observe("canonical", true)
    expect(canonical.resultDigest).toBe(opaque.resultDigest)
    expect(canonical.metadata).toEqual(opaque.metadata)
    expect(opaque).toMatchObject({ transactions: 1, unrelatedClones: 1, caseClones: 1, resultClones: sizes.results })
    expect(canonical).toMatchObject({ transactions: 1, unrelatedClones: 0, caseClones: 0, resultClones: sizes.results })
    const timings: { mode: "canonical" | "opaque"; elapsedMs: number }[] = []
    for (let pair = 0; pair < 6; pair++) {
      for (const mode of pair % 2 ? ["opaque", "canonical"] as const : ["canonical", "opaque"] as const) {
        const sample = await observe(mode, false)
        expect(sample.transactions).toBe(1)
        expect(sample.resultDigest).toBe(opaque.resultDigest)
        expect(sample.metadata).toEqual(opaque.metadata)
        timings.push({ mode, elapsedMs: sample.elapsedMs })
      }
    }
    // The same real corpus supplies the business.selectedCase predicate. This
    // adds no writes, grants, calculation or synthetic padding between arms.
    const identitySelector = selectSfCaseIdentity(phase.caseRef, history.fixture.context)
    const observeIdentity = async (mode: "canonical" | "opaque", instrument: boolean) => {
      Object.assign(counts, { instrument, transactions: 0, unrelatedClones: 0, caseClones: 0, resultClones: 0 })
      const start = performance.now()
      const result = await history.state.read(history.fixture.request, "cases", mode === "opaque"
        ? (state, actor) => identitySelector(state, actor) : identitySelector)
      const elapsedMs = performance.now() - start
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error("Current case identity missing")
      expect(result.value).toEqual(phase.caseRef)
      return { mode, elapsedMs, transactions: counts.transactions, unrelatedClones: counts.unrelatedClones,
        caseClones: counts.caseClones, resultClones: counts.resultClones, identityDigest: digestSfValue(result.value),
        metadata: { storageVersion: result.storageVersion, aggregateRevision: result.aggregateRevision, incarnation: result.incarnation } }
    }
    const identityOpaque = await observeIdentity("opaque", true)
    const identityCanonical = await observeIdentity("canonical", true)
    expect(identityCanonical.identityDigest).toBe(identityOpaque.identityDigest)
    expect(identityCanonical.metadata).toEqual(identityOpaque.metadata)
    expect(identityCanonical.metadata).toEqual(opaque.metadata)
    expect(identityOpaque).toMatchObject({ transactions: 1, unrelatedClones: 1, caseClones: 1, resultClones: sizes.results })
    expect(identityCanonical).toMatchObject({ transactions: 1, unrelatedClones: 0, caseClones: 1, resultClones: 0 })
    const identityTimings: { mode: "canonical" | "opaque"; elapsedMs: number }[] = []
    for (let pair = 0; pair < 6; pair++) {
      for (const mode of pair % 2 ? ["opaque", "canonical"] as const : ["canonical", "opaque"] as const) {
        const sample = await observeIdentity(mode, false)
        expect(sample.transactions).toBe(1)
        expect(sample.identityDigest).toBe(identityOpaque.identityDigest)
        expect(sample.metadata).toEqual(identityOpaque.metadata)
        identityTimings.push({ mode, elapsedMs: sample.elapsedMs })
      }
    }
    counts.instrument = false
    expect(digestSfValue(await history.readCase())).toBe(originalDigest)
    const summarize = (mode: "canonical" | "opaque") => {
      const values = timings.filter((value) => value.mode === mode).map((value) => value.elapsedMs).sort((a, b) => a - b)
      return { samples: values.length, medianMs: (values[2]! + values[3]!) / 2, minimumMs: values[0], maximumMs: values.at(-1) }
    }
    const summarizeIdentity = (mode: "canonical" | "opaque") => {
      const values = identityTimings.filter((value) => value.mode === mode).map((value) => value.elapsedMs).sort((a, b) => a - b)
      return { samples: values.length, medianMs: (values[2]! + values[3]!) / 2, minimumMs: values[0], maximumMs: values.at(-1) }
    }
    console.log("DECISION_CASE_IDENTITY_MEASUREMENT " + JSON.stringify({
      sizes, opaque: identityOpaque, canonical: identityCanonical, timings: identityTimings,
      summary: { opaque: summarizeIdentity("opaque"), canonical: summarizeIdentity("canonical") },
      boundary: "one fresh C08/SQLite transaction per selector; full case map, original participant/actor predicate and authority boundaries",
      disclosure: "same real Planner corpus and unchanged fixture source grants; not installed Decisions or native acceptance",
    }))
    console.log("DECISION_SCENARIO_CANDIDATE_MEASUREMENT " + JSON.stringify({
      sizes, opaque, canonical, timings, summary: { opaque: summarize("opaque"), canonical: summarize("canonical") },
      boundary: "one fresh C08/SQLite transaction per selector; full result map, original predicate and authority boundaries",
      disclosure: "real Planner financial corpus with unchanged fixture source grants; not installed Decisions acceptance",
    }))
  } finally { await history.cleanup() }
}, 120000)
