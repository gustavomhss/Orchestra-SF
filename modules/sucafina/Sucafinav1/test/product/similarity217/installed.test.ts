import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfSimilarCases217 } from "../../../product/memory/similarity217.ts"
import { withMemoryIntegrityFixture } from "../wp10/memory-integrity/fixture.ts"

type Fixture = Parameters<Parameters<typeof withMemoryIntegrityFixture>[0]>[0]

/**
 * Real SQLite C08 + C12 + Atlas/Gitleaks/source issuance test fixture (not a
 * mock similarity producer). Only a synthetic second C09 case is inserted; the
 * precedent/ledger/Atlas evidence remains the fixture's actually committed
 * memory. This test is NOT a live native Session/D01 witness.
 */
async function currentCase(f: Fixture) {
  const previous = await f.authority.state.read(f.staleRequest, "cases",
    (state) => structuredClone(state.cases[f.caseRef.id]))
  if (previous.status !== "ok" || !previous.value) throw new Error("Original C09 precedent missing")
  const source = { ...previous.value, id: "similarity217-current", incarnation: "similarity217-source-incarnation",
    version: 1, objective: "Review the originally documented choice in the same period",
    ledger: [], choices: [], preparedChanges: [], receipts: [] }
  const inserted = await f.authority.state.transaction(f.staleRequest, {
    namespace: "cases", expectedStorageVersion: previous.storageVersion,
    targetRef: f.authority.creationTarget.ref,
    targetIncarnation: f.authority.creationTarget.incarnation,
    idempotencyKey: "similarity217-current-original-case", commandDigest: digestSfValue(source),
  }, async (state, actor) => {
    if (actor.principalRef !== "alice" || state.cases[source.id]) return { commit: false, value: false }
    state.cases[source.id] = source
    return { commit: true, value: true }
  })
  if (inserted.status !== "ok" || inserted.value !== true) throw new Error("Current source C09 case not committed")
  return { ref: { id: source.id, incarnation: source.incarnation, version: source.version },
    period: source.horizon }
}
const input = (source: Awaited<ReturnType<typeof currentCase>>, f: Fixture, includeHistorical = false) => ({
  caseId: source.ref.id, incarnation: source.ref.incarnation, version: source.ref.version,
  query: "Revisit documented decision features", period: source.period,
  includeHistorical, candidates: [f.caseRef],
})
const producer = (f: Fixture) => createSfSimilarCases217({
  caseRecall: f.business.caseRecall, cases: f.business.cases,
  context: f.business.context, host: f.authority.host,
})

test("217-AC01/02 — original C09 + Atlas event yields explainable, source-backed similar case and no self-match", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const source = await currentCase(f)
    const call = await f.admit()
    try {
      const result = await producer(f)(input(source, f), call)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error("Real Atlas recall not available: " + result.reason)
      expect(result.matches.length).toBeGreaterThan(0)
      for (const match of result.matches) {
        expect(match.caseRef).toEqual(f.caseRef)
        expect(match.memoryRecordRef).toBeTruthy()
        expect(match.explanation.matchedCriteria).toContain("decision-type")
        expect(match.explanation.currentDifferences).toEqual([])
        expect(match.evidenceRefs.length).toBeGreaterThan(0)
        expect(match.evidenceRefs.some((ref) => ref.refDigest === f.eventRef.refDigest)).toBe(true)
      }
      expect(new Set(result.matches.map((m) => m.memoryRecordRef)).size).toBe(result.matches.length)
      expect(result.cutoff).toEqual({ caseRef: source.ref, period: source.period, includeHistorical: false })
      expect(result.accessRevision).toBe(call.binding.accessRevision)
    } finally { f.authority.human.finish(call) }
  }, "similarity217-real-c09-atlas")
}, 120_000)

test("217-AC03/04 — explicit cutoff and duplicate selection cannot launder a precedent", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const source = await currentCase(f)
    const call = await f.admit()
    try {
      const run = producer(f)
      const wanted = input(source, f)
      expect((await run({ ...wanted, period: { start: "2024-01-01", end: "2024-12-31" } }, call)).status).not.toBe("ok")
      expect(await run({ ...wanted, candidates: [f.caseRef, f.caseRef] }, call)).toEqual({
        status: "needs-input", reason: "invalid-similar-cases-selection",
      })
      expect(await run({ ...wanted, candidates: [source.ref] }, call)).toEqual({
        status: "needs-input", reason: "invalid-similar-cases-selection",
      })
      expect((await run({ ...wanted, candidates: [] }, call)).status).toBe("ok")
    } finally { f.authority.human.finish(call) }
  }, "similarity217-cutoff-dedup")
}, 120_000)

test("217-AC05 — source revision cannot silently masquerade as current historical evidence", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const source = await currentCase(f)
    const call = await f.admit()
    try {
      const run = producer(f)
      const before = await run(input(source, f), call)
      expect(before.status).toBe("ok")
      await f.edit(150)
      const deniedHistorical = await run(input(source, f, false), call)
      if (deniedHistorical.status === "ok") {
        expect(deniedHistorical.matches.every((m) => !m.explanation.sourceStates.includes("historical"))).toBe(true)
      } else expect(["unavailable", "denied"]).toContain(deniedHistorical.status)
      const allowedHistorical = await run(input(source, f, true), call)
      if (allowedHistorical.status === "ok") {
        expect(allowedHistorical.matches.every((m) =>
          m.explanation.sourceStates.every((state) => state === "fresh" || state === "historical"))).toBe(true)
        expect(allowedHistorical.matches.some((m) => m.explanation.sourceStates.includes("historical"))).toBe(true)
        expect(allowedHistorical.matches.flatMap((m) => m.explanation.currentDifferences).some((d) => d.includes("originalAmount"))).toBe(true)
      } else {
        // If the original case read itself lost current authorization, the
        // adapter must fail closed rather than synthesizing a historical match.
        expect(["unavailable", "denied"]).toContain(allowedHistorical.status)
      }
    } finally { f.authority.human.finish(call) }
  }, "similarity217-original-history")
}, 120_000)

test("217-AC06/07 — two actors, revocation at egress and revoked lease never disclose match/count", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const source = await currentCase(f)
    const foreign = new Request("https://memory-integrity.test/sf/procurement", {
      method: "POST", headers: { authorization: "bob", origin: "https://memory-integrity.test" },
    })
    const deniedActor = await f.authority.human.admit(foreign, "analysis.start", f.start)
    expect(deniedActor.status).not.toBe("ok")
    if (deniedActor.status === "ok") {
      f.authority.human.finish(deniedActor.value)
      throw new Error("Original authority granted nonparticipant")
    }
    const call = await f.admit()
    try {
      const selected = input(source, f)
      const first = await producer(f)(selected, call)
      expect(first.status).toBe("ok")
      const egress = createSfSimilarCases217({
        caseRecall: f.business.caseRecall, cases: f.business.cases,
        context: {
          context: async (args, trusted) => {
            const actual = await f.business.context.context(args, trusted)
            f.access.allowed = false
            return actual
          },
        },
        host: f.authority.host,
      })
      const revoked = await egress(selected, call)
      expect(revoked.status).not.toBe("ok")
      expect("matches" in revoked).toBe(false)
      expect("accessRevision" in revoked).toBe(false)
      f.access.allowed = true
      const old = await producer(f)(selected, call)
      expect(old.status).not.toBe("ok")
      expect("matches" in old).toBe(false)
      // New genuine admission is required; no resurrection of original lease.
      const fresh = await f.admit()
      try {
        expect((await producer(f)(selected, fresh)).status).toBe("ok")
      } finally { f.authority.human.finish(fresh) }
    } finally { f.authority.human.finish(call) }
  }, "similarity217-two-actor-revoke")
}, 120_000)
