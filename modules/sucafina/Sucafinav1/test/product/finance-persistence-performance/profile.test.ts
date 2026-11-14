import { expect, spyOn, test } from "bun:test"
import { Database } from "bun:sqlite"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSnapshot, encodeSnapshot } from "../../../runtime/local-store.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

type Mode = "decode" | "transaction" | "currentSnapshots" | "nestedRead"
type Work = () => Snapshot | Promise<Snapshot>

// Pass-through spies count real codec work only. Keep these out of timing samples
// and restore before assertions; no persistence, identity or result is mocked.
async function countWork(work: Work) {
  const parse = spyOn(JSON, "parse")
  const entries = spyOn(Object, "fromEntries")
  const descriptors = spyOn(Object, "getOwnPropertyDescriptors")
  try {
    const value = await work()
    const tagged = parse.mock.calls.filter((call) => typeof call[0] === "string" && call[0].startsWith('["sucafina-snapshot",'))
    return { value, counts: {
      parseCalls: parse.mock.calls.length,
      parsedCharacters: parse.mock.calls.reduce((sum, call) => sum + (typeof call[0] === "string" ? call[0].length : 0), 0),
      taggedParseCalls: tagged.length,
      taggedCharacters: tagged.reduce((sum, call) => sum + call[0].length, 0),
      objectAssemblies: entries.mock.calls.length,
      entryTuples: entries.mock.calls.reduce((sum, call) => sum + (Array.isArray(call[0]) ? call[0].length : 0), 0),
      encodedObjectDescriptorReads: descriptors.mock.calls.length,
    } }
  } finally {
    descriptors.mockRestore()
    entries.mockRestore()
    parse.mockRestore()
  }
}

async function timeWork(work: Work) {
  const start = performance.now()
  const value = await work()
  return { value, elapsedMs: performance.now() - start }
}

test("FIN-IND-005 persistence profile isolates real SQLite decode and staged snapshot work", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    const chosen = await history.choose()
    const phase = await history.resolveTraining()
    expect(phase.selectedResult).toMatchObject({ total: 250000, comparisonStatus: "complete" })
    expect(phase.advantageComparison.completeDifference).toBe(-10000)
    const decision = await history.readCase()
    expect(digestSfValue(decision.choices[0])).toBe(digestSfValue(chosen.choice))
    const database = new Database(join(history.fixture.directory, "installation.sqlite"), { readonly: true, strict: true })
    try {
      const persisted = database.query<{ surface: string; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all()
      const payload = persisted.find((row) => row.surface === "dashboard")?.payload
      if (!payload) throw new Error("Representative SQLite dashboard snapshot unavailable")
      const original = decodeSnapshot(payload)
      const state = original.data.__sfProductV1 as SfProductState
      const sizes = {
        stateBytes: new TextEncoder().encode(JSON.stringify(state)).length,
        payloadBytes: new TextEncoder().encode(payload).length,
        payloadCharacters: payload.length,
        caseBytes: new TextEncoder().encode(JSON.stringify(state.cases[decision.id])).length,
        cases: Object.keys(state.cases).length,
        results: Object.keys(state.decisionResults ?? {}).length,
        transactions: Object.keys(state.transactions).length,
        surfaces: persisted.map((row) => ({ surface: row.surface, payloadBytes: new TextEncoder().encode(row.payload).length })),
      }
      expect(sizes.stateBytes).toBeGreaterThan(800000)
      expect(sizes.caseBytes).toBeGreaterThan(100000)
      expect(encodeSnapshot(original)).toBe(payload)
      const store = history.fixture.store
      const read = () => store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))
      const current = () => {
        const snapshots = store.currentSnapshots?.()
        if (!snapshots) throw new Error("Active SQLite snapshots unavailable")
        return snapshots.dashboard
      }
      const observe = <T>(mode: Mode, measure: (work: Work) => Promise<T>) => {
        if (mode === "decode") return measure(() => decodeSnapshot(payload))
        if (mode === "transaction") return measure(read)
        // The enclosing transaction is outside this measurement. These two modes
        // isolate only the staged clone path; they are not end-to-end timings.
        return store.transaction("dashboard", async () => ({ commit: false, value: await measure(mode === "currentSnapshots" ? current : read) }))
      }
      const modes: readonly Mode[] = ["decode", "transaction", "currentSnapshots", "nestedRead"]
      const counts: { mode: Mode; counts: Awaited<ReturnType<typeof countWork>>["counts"] }[] = []
      for (const mode of modes) {
        const observed = await observe(mode, countWork)
        expect(encodeSnapshot(observed.value)).toBe(payload)
        expect(observed.value).not.toBe(original)
        expect(observed.value.data).not.toBe(original.data)
        counts.push({ mode, counts: observed.counts })
      }
      const timings: { mode: Mode; elapsedMs: number }[] = []
      for (let round = 0; round < 6; round++) {
        for (const mode of round % 2 ? [...modes].reverse() : modes) {
          const sample = await observe(mode, timeWork)
          expect(encodeSnapshot(sample.value)).toBe(payload)
          timings.push({ mode, elapsedMs: sample.elapsedMs })
        }
      }
      const retained = await read()
      retained.data.__sfProductV1 = { corrupted: true }
      retained.versions["profile-private"] = { version: 99, by: "uncommitted" }
      const afterMutation = await read()
      expect(encodeSnapshot(afterMutation)).toBe(payload)
      expect(afterMutation).not.toBe(retained)
      expect(afterMutation.data).not.toBe(retained.data)
      expect(database.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get("dashboard")?.payload).toBe(payload)
      const summary = modes.map((mode) => {
        const values = timings.filter((sample) => sample.mode === mode).map((sample) => sample.elapsedMs).sort((a, b) => a - b)
        return { mode, samples: values.length, medianMs: (values[2]! + values[3]!) / 2, minimumMs: values[0], maximumMs: values.at(-1) }
      })
      console.log("FIN_PERSISTENCE_PROFILE " + JSON.stringify({
        sizes, counts, timings, summary,
        interpretation: "Direct codec and transaction timings overlap; scoped modes exclude outer admission/load. Do not add these categories or extrapolate a whole-journey speedup.",
        disclosure: "Existing real Finance/C08/SQLite fixture with synthetic source grants. No short result closes FIN-IND-005; original journey budgets and assertions remain unchanged.",
      }))
      expect(counts.find((item) => item.mode === "decode")?.counts.taggedParseCalls).toBe(1)
      expect(counts.find((item) => item.mode === "decode")?.counts.taggedCharacters).toBe(payload.length)
    } finally { database.close() }
  } finally { await history.cleanup() }
}, 120000)
