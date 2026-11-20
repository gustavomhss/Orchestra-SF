import { afterAll, beforeAll, expect, test } from "bun:test"
import { historicalPairAnchor, historicalPairProbe } from "./historical-verification-fixture.ts"
import type { HistoricalPairAnchor, PairSite } from "./historical-verification-fixture.ts"

let shared: HistoricalPairAnchor | undefined
beforeAll(async () => { shared = await historicalPairAnchor() }, 120000)
afterAll(async () => { await shared?.fixture.cleanup() })
const anchor = () => {
  if (!shared) throw new Error("Real persistent Finance setup did not complete")
  return shared
}
const pairReferences = (count: number) => Array.from({ length: count },
  () => [anchor().request.scenarioRef, anchor().fixture.baselineRef]).flat()
const callbacksPerFourReads = { authorizeCase: 8, verifySources: 8, revalidate: 16 }
type ProbeStats = ReturnType<ReturnType<typeof historicalPairProbe>["stats"]>

test("real Finance verification groups both historical pairs and preserves every result callback", async () => {
  const observed: ProbeStats[] = []
  for (const mode of ["canonical", "wrapper"] as const) {
    const probe = historicalPairProbe(anchor(), mode)
    try {
      expect(await probe.verify()).toBe(true)
      const stats = probe.stats()
      expect(await probe.fence()).toBe(true)
      expect(stats.callbacks).toEqual(callbacksPerFourReads)
      observed.push(stats)
    } finally { probe.close() }
  }
  expect(observed[0]).toMatchObject({ batchSnapshots: 6, scalarSnapshots: 0, scalarCalls: [] })
  expect(observed[0]!.snapshots.map((snapshot) => snapshot.references)).toEqual(
    Array.from({ length: 6 }, () => pairReferences(1)))
  expect(observed[1]).toMatchObject({ batchSnapshots: 0, scalarSnapshots: 12, scalarCalls: pairReferences(2) })
  expect(observed[1]!.scalarSnapshots - observed[0]!.batchSnapshots).toBe(6)
  expect(observed[1]!.callbacks).toEqual(observed[0]!.callbacks)
}, 120000)

test("real sensitivity keeps its initial scalar reads and groups only the final historical pair", async () => {
  const observed: ProbeStats[] = []
  for (const mode of ["canonical", "wrapper"] as const) {
    const probe = historicalPairProbe(anchor(), mode)
    try {
      const result = await probe.evaluate()
      // Same producer, persisted historical numbers, sample identities, evidence
      // and disclosure. No expected financial answer is synthesized by this test.
      expect(result).toEqual({ status: "ok", value: anchor().stored.result })
      const stats = probe.stats()
      expect(stats.callbacks).toEqual(callbacksPerFourReads)
      observed.push(stats)
    } finally { probe.close() }
  }
  expect(observed[0]).toMatchObject({ batchSnapshots: 3, scalarSnapshots: 6, scalarCalls: [] })
  expect(observed[0]!.snapshots.map((snapshot) => snapshot.kind)).toEqual([
    "scalar", "scalar", "scalar", "scalar", "scalar", "scalar", "batch", "batch", "batch",
  ])
  expect(observed[1]).toMatchObject({ batchSnapshots: 0, scalarSnapshots: 12, scalarCalls: pairReferences(2) })
  expect(observed[1]!.scalarSnapshots - observed[0]!.scalarSnapshots - observed[0]!.batchSnapshots).toBe(3)
  expect(observed[1]!.callbacks).toEqual(observed[0]!.callbacks)
}, 120000)

test("the initial sensitivity source failure still returns before reading its baseline", async () => {
  const probe = historicalPairProbe(anchor(), "wrapper")
  let failed = false
  try {
    probe.hooks.afterScalar = (reference, ordinal, found) => {
      if (ordinal !== 1) return undefined
      expect(reference).toBe(anchor().request.scenarioRef)
      expect(found.status).toBe("ok")
      failed = true
      // A deliberate read failure after the real producer, never a fabricated
      // successful result or grant.
      return { status: "denied", reason: "test-historical-source-denied" }
    }
    expect(await probe.evaluate()).toMatchObject({ status: "denied", reason: "test-historical-source-denied" })
    expect(failed).toBe(true)
    expect(probe.stats()).toMatchObject({
      batchSnapshots: 0, scalarSnapshots: 3, scalarCalls: [anchor().request.scenarioRef],
      callbacks: { authorizeCase: 2, verifySources: 2, revalidate: 4 },
    })
  } finally { probe.close() }
}, 120000)

for (const site of ["verifier-initial", "verifier-final", "sensitivity-final"] as const satisfies readonly PairSite[]) {
  test("the opaque " + site + " pair still reads its baseline after a source failure", async () => {
    const probe = historicalPairProbe(anchor(), "wrapper")
    const failAt = site === "verifier-initial" ? 1 : 3
    let failed = false
    try {
      probe.hooks.afterScalar = (reference, ordinal, found) => {
        if (ordinal !== failAt) return undefined
        expect(reference).toBe(anchor().request.scenarioRef)
        expect(found.status).toBe("ok")
        failed = true
        return { status: "denied", reason: "test-historical-pair-source-denied" }
      }
      expect(await probe.run(site)).toBe(false)
      expect(failed).toBe(true)
      const stats = probe.stats()
      expect(stats.batchSnapshots).toBe(0)
      expect(stats.scalarCalls).toEqual(pairReferences(site === "verifier-initial" ? 1 : 2))
      expect(stats.scalarSnapshots).toBe(site === "verifier-initial" ? 6 : 12)
      if (site !== "sensitivity-final") expect(await probe.fence()).toBe(false)
    } finally { probe.close() }
  }, 120000)
}

for (const site of ["verifier-initial", "verifier-final", "sensitivity-final"] as const satisfies readonly PairSite[]) {
  test("the " + site + " pair refuses a result-store owner replaced during its final C08 await", async () => {
    const probe = historicalPairProbe(anchor(), "canonical")
    const changeAt = site === "verifier-final" ? 6 : 3
    let changed = false
    try {
      probe.hooks.afterSnapshot = (observation) => {
        if (changed || observation.kind !== "batch" || observation.ordinal !== changeAt) return
        changed = true
        // Both objects expose the same real methods. Only owner identity changes,
        // so this specifically exercises the caller's post-await owner fence.
        probe.swapOwner(site)
      }
      expect(await probe.run(site)).toBe(false)
      expect(changed).toBe(true)
      expect(probe.stats().batchSnapshots).toBe(changeAt)
      if (site !== "sensitivity-final") expect(await probe.fence()).toBe(false)
    } finally { probe.close() }
  }, 120000)
}
