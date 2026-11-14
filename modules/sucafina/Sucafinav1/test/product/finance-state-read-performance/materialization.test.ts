import { expect, test } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

// The original renewal helpers supply the real financial state. This test stops
// before sensitivity: it is a short C08/SQLite work comparison, not FIN-IND-005.
test("FIN-IND-005 case materialization keeps two fresh reads while skipping unrelated state clones", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    const chosen = await history.choose()
    const phase = await history.resolveTraining()
    expect(phase.selectedResult).toMatchObject({ total: 250000, comparisonStatus: "complete" })
    expect(phase.advantageComparison.completeDifference).toBe(-10000)
    const decision = await history.readCase()
    expect(digestSfValue(decision.choices[0])).toBe(digestSfValue(chosen.choice))
    const originalDigest = digestSfValue(decision)
    const sizes = await history.fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      return { commit: false, value: {
        stateBytes: new TextEncoder().encode(JSON.stringify(state)).length,
        caseBytes: new TextEncoder().encode(JSON.stringify(state.cases[decision.id])).length,
        cases: Object.keys(state.cases).length, results: Object.keys(state.decisionResults ?? {}).length,
        transactions: Object.keys(state.transactions).length,
      } }
    })
    expect(sizes.stateBytes).toBeGreaterThan(800000)
    expect(sizes.caseBytes).toBeGreaterThan(100000)
    const observation = { mode: "canonical" as "canonical" | "opaque", instrument: false,
      caseReads: 0, unrelatedClones: 0, caseClones: 0, hostChecks: 0 }
    const read = history.state.read
    history.state.read = (request, namespace, callback) => {
      if (namespace === "cases") observation.caseReads++
      // The opaque control reaches exactly the existing full-clone fallback,
      // without replacing the persistence driver, callback or authority.
      return read(request, namespace, observation.mode === "opaque"
        ? (state, authority) => callback(state, authority) : callback)
    }
    const revalidate = history.fixture.host.revalidate
    history.fixture.host.revalidate = (context) => { observation.hostChecks++; return revalidate(context) }
    const transaction = history.fixture.store.transaction
    history.fixture.store.transaction = (surface, work, options) => transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
      if (!observation.instrument || surface !== "dashboard") return work(snapshot, blobs)
      const state = snapshot.data.__sfProductV1 as SfProductState
      const key = Object.keys(state.preferences)[0]
      const selected = state.cases[decision.id]
      if (!key || !selected) throw new Error("Representative read observation missing")
      const unrelated = state.preferences[key]
      const objective = selected.objective
      // Observe clone traversal on the detached SQLite snapshot only. Both
      // getters return the original value; no global function is replaced.
      Object.defineProperty(state.preferences, key, { enumerable: true, configurable: true,
        get: () => { observation.unrelatedClones++; return unrelated } })
      Object.defineProperty(selected, "objective", { enumerable: true, configurable: true,
        get: () => { observation.caseClones++; return objective } })
      const result = await work(snapshot, blobs)
      if (result.commit) throw new Error("Read measurement must not write an instrumented snapshot")
      return result
    }, options)
    const request = { caseRef: encodeCaseRef(phase.caseRef) }
    const observe = async (mode: "canonical" | "opaque", instrument: boolean) => {
      Object.assign(observation, { mode, instrument, caseReads: 0, unrelatedClones: 0, caseClones: 0, hostChecks: 0 })
      const start = performance.now()
      const result = await phase.cases.read(request, history.fixture.context)
      const elapsedMs = performance.now() - start
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(result.reason)
      expect(digestSfValue(result.value.case)).toBe(originalDigest)
      expect(result.value.case).not.toHaveProperty("preferences")
      return { elapsedMs, caseReads: observation.caseReads, unrelatedClones: observation.unrelatedClones,
        caseClones: observation.caseClones, hostChecks: observation.hostChecks }
    }
    const opaque = await observe("opaque", true)
    const canonical = await observe("canonical", true)
    const timings: { mode: "canonical" | "opaque"; elapsedMs: number; caseReads: number; hostChecks: number }[] = []
    // Alternate order to keep initialization and runner drift out of one arm.
    for (let pair = 0; pair < 6; pair++) {
      for (const mode of pair % 2 ? ["opaque", "canonical"] as const : ["canonical", "opaque"] as const) {
        const sample = await observe(mode, false)
        timings.push({ mode, elapsedMs: sample.elapsedMs, caseReads: sample.caseReads, hostChecks: sample.hostChecks })
      }
    }
    observation.instrument = false
    const current = await history.readCase()
    expect(digestSfValue(current)).toBe(originalDigest)
    const summarize = (mode: "canonical" | "opaque") => {
      const values = timings.filter((item) => item.mode === mode).map((item) => item.elapsedMs).sort((a, b) => a - b)
      return { samples: values.length, medianMs: (values[2]! + values[3]!) / 2,
        totalMs: values.reduce((sum, value) => sum + value, 0), minimumMs: values[0], maximumMs: values.at(-1) }
    }
    console.log("FIN_STATE_READ_MEASUREMENT " + JSON.stringify({
      sizes, opaque, canonical, timings, summary: { opaque: summarize("opaque"), canonical: summarize("canonical") },
      serializedReadPath: "unchanged real C08/SQLite; inclusive case-read timings are not additive",
      disclosure: "synthetic source grants from unchanged renewal fixture; no native or integrated acceptance",
    }))
    expect(opaque.caseReads).toBe(2)
    expect(canonical.caseReads).toBe(2)
    expect(opaque.caseClones).toBe(2)
    expect(canonical.caseClones).toBe(2)
    expect(canonical.hostChecks).toBe(opaque.hostChecks)
    expect(timings.every((item) => item.caseReads === 2 && item.hostChecks === opaque.hostChecks)).toBe(true)
    expect(opaque.unrelatedClones).toBe(2)
    // This fails on the preimage, after recording its real work and timings.
    // Wall-clock ratios are evidence, never the pass/fail oracle.
    expect(canonical.unrelatedClones).toBe(0)
  } finally { await history.cleanup() }
}, 120000)
