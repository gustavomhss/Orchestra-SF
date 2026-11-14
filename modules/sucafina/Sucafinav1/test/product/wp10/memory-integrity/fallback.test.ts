import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { enqueueSfLedgerEvent } from "../../../../product/integration/ledger-outbox.ts"
import { object } from "../../../../runtime/contract.ts"
import { withMemoryIntegrityFixture } from "./fixture.ts"

// Both ledger observations are explicitly synthetic case fixture data. Their
// outbox entries, scanner verdicts, Atlas events/envelopes/captures and reads are real.
test("Memory integrity uses the real full recall for multiple envelopes and refuses damage outside the referenced capture", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const incoming = f.request()
    const prior = await f.authority.state.read(incoming, "cases", (state) => ({ decision: state.cases[f.caseRef.id], versions: state.versions }))
    if (prior.status !== "ok" || !prior.value.decision) throw new Error("Current fixture case unavailable")
    const previous = prior.value.decision
    const next = { id: previous.id, incarnation: previous.incarnation, version: previous.version + 1 }
    const event: CaseLedgerEvent = {
      id: "integrity-second-observation", caseRef: next, kind: "reconsideration-accepted", principalRef: "alice", at: f.at,
      consideredActions: ["Recheck the same recorded source"], factualGaps: ["Synthetic observation, no new financial decision"],
      lifecycleState: previous.state, rationale: "Preserve a second authorized observation for the capture integrity proof",
      evidenceRefs: [f.original], outputDigest: digestSfValue({ event: "integrity-second-observation", original: f.original }),
    }
    const queued = await f.authority.state.transaction(incoming, {
      namespace: "cases", expectedStorageVersion: prior.value.versions.cases,
      additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: prior.value.versions.outbox }],
      targetRef: encodeCaseRef(previous), targetIncarnation: previous.incarnation,
      idempotencyKey: "integrity-second-observation", commandDigest: digestSfValue(event),
    }, async (state, actor) => {
      const current = state.cases[previous.id]
      if (!current || current.version !== previous.version || current.incarnation !== previous.incarnation ||
        !current.participants.includes(actor.principalRef)) throw new Error("Second fixture observation lost its case authority")
      state.cases[current.id] = { ...current, version: next.version, ledger: [...current.ledger, event] }
      const result = enqueueSfLedgerEvent(state, event, {
        installationId: f.original.installationId, projectId: f.original.projectId, authority: actor,
      })
      if (result.status !== "ok") throw new Error(result.reason)
      return { commit: true, value: result.value.eventRef }
    })
    if (queued.status !== "ok") throw new Error("Second fixture outbox entry unavailable")
    const selection = { caseRef: encodeCaseRef(next) }
    const admitted = await f.authority.ui.admit(f.request(), "sf_case_read", digestSfValue(selection))
    if (admitted.status !== "ok") throw new Error("Second Atlas emission admission unavailable")
    try {
      if (!await f.authority.ui.validate(admitted.value, "sf_case_read", digestSfValue(selection))) throw new Error("Second Atlas emission lost its UI admission")
      const emitted = await f.business.context.emitFromLedger(queued.value, admitted.value)
      expect(emitted.status).toBe("committed")
      expect(emitted.scanner).toMatchObject({ name: "gitleaks", version: f.scanner.version, status: "clean" })
    } finally { f.authority.ui.finish(admitted.value) }

    const call = await f.admit()
    const recall = f.atlas.memory.recall
    let fullReads = 0
    try {
      const intact = await recall(f.caseRef, call)
      if (intact.status !== "ok") throw new Error("Real two-envelope recall unavailable")
      expect(intact.records).toHaveLength(2)
      expect(new Set(intact.records.map((record) => record.envelope.eventId)).size).toBe(2)
      const before = await f.readAtlas()
      f.atlas.memory.recall = async (caseRef, trusted) => {
        fullReads += 1
        return recall(caseRef, trusted)
      }
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      expect(fullReads).toBeGreaterThan(0)
      expect(await f.readAtlas()).toEqual(before)

      await f.mutateAtlas((partition) => {
        const capture = object(object(partition.originals)[queued.value.refDigest])
        if (!capture.ref) throw new Error("Second real event capture missing")
        capture.projection = { damaged: true }
      })
      const corrupted = await f.readAtlas()
      // A per-ref lookup still finds the undamaged first envelope. The topology
      // fallback must reopen the full reader and inspect the second event too.
      expect((await f.atlas.memory.readOriginalCapture(f.caseRef, f.original.refDigest, call))?.ref).toEqual(f.original)
      const previousFullReads = fullReads
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(fullReads).toBeGreaterThan(previousFullReads)
      expect(await f.readAtlas()).toEqual(corrupted)
    } finally { f.atlas.memory.recall = recall; f.authority.human.finish(call) }
  }, "multiple-envelope-fallback")
}, 120_000)

