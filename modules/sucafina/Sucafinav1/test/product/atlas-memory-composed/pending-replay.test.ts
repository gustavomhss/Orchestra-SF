import { randomUUID } from "node:crypto"
import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { CaseLedgerEvent } from "../../../product/contracts/decisions.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { enqueueSfLedgerEvent } from "../../../product/integration/ledger-outbox.ts"
import { object } from "../../../runtime/contract.ts"
import { withDocumentReplayFixture } from "../memory-original-reauthorization/document-fixture.ts"
import { requireOriginalRecord } from "./fixture-assertions.ts"

// The unchanged40 fixture creates and confirms real C17 document sources, then
// publishes A through C08/Atlas/Gitleaks. The accepted ledger event is an explicit
// synthetic premise. This independent document case does not exercise the
// blocked financial C12 preparation or its installed initializeAtlas callback.
test("M69 settled documentary A remains authorized while B is pending without another publication effect", async () => {
  expectSpawn(import.meta.path)
  const completed: unknown[] = []
  await withDocumentReplayFixture(async (f) => {
    await f.ui("sf_evidence_get", { evidenceRef: f.eventRef }, async (call) => {
      const request = f.authority.host.requestFor(call)
      if (!request || !await f.authority.host.revalidate(call)) throw new Error("Actual document replay authority unavailable")
      const source = f.sources[0]!
      const before = await f.audit()
      const keyA = JSON.stringify([f.caseRef.id, f.caseRef.incarnation, f.eventRef.target.eventId])
      const itemA = object(object(before.outbox)[keyA])
      const receiptA = object(itemA.receipt)
      expect(itemA.state).toBe("settled")
      expect(receiptA).toEqual(f.receipt)
      expect(receiptA.status).toBe("committed")
      expect(receiptA.sourceEventId).toBe(f.eventRef.target.eventId)
      expect(object(receiptA.scanner).status).toBe("clean")
      expect(before.counts.scans).toBe(1)
      const partitionA = Object.values(object(before.atlas)).map(object)
        .find((partition) => object(partition.originals)[source.ref.refDigest])
      if (!partitionA) throw new Error("Real committed document capture A unavailable")
      const captureA = object(object(partitionA.originals)[source.ref.refDigest])
      expect(captureA.ref).toEqual(source.ref)
      expect(object(object(partitionA.captureDigests)[f.receipt.eventId!])[source.ref.refDigest]).toBe(digestSfValue(captureA))

      const ready = await f.memory.recall(f.caseRef, call)
      expect(ready.status).toBe("ok")
      if (ready.status !== "ok") throw new Error("Whole-case recall must succeed before pending B")
      requireOriginalRecord(f, ready.records)
      const stored = await f.authority.state.read(request, "cases", (state) => ({
        versions: state.versions, decision: state.cases[f.caseRef.id],
      }))
      if (stored.status !== "ok" || !stored.value.decision) throw new Error("Real committed case A unavailable")
      const decision = stored.value.decision
      const eventA = decision.ledger.find((event) => event.id === f.eventRef.target.eventId)
      if (!eventA) throw new Error("Committed event A missing from the real C08 ledger")
      expect(eventA.evidenceRefs).toEqual([source.ref])
      const pending: CaseLedgerEvent = { ...structuredClone(eventA), id: randomUUID(),
        caseRef: { ...f.caseRef, version: decision.version + 1 },
        rationale: "Explicit later accepted document review awaiting Memory publication",
        outputDigest: digestSfValue({ premise: "M69 accepted pending documentary review",
          previousEvent: eventA.id, evidenceRefs: eventA.evidenceRefs }),
      }
      // Queue B through the real producer in one C08 case/outbox transaction.
      // Do not emit B, seed an Atlas capture, or manufacture a settled receipt.
      const added = await f.authority.state.transaction(request, {
        namespace: "cases", expectedStorageVersion: stored.storageVersion,
        additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: stored.value.versions.outbox }],
        targetRef: encodeCaseRef(f.caseRef), targetIncarnation: f.caseRef.incarnation,
        idempotencyKey: `m69-document-pending:${pending.id}`, commandDigest: digestSfValue(pending),
      }, async (state, actor) => {
        const current = state.cases[f.caseRef.id]
        if (!current || current.incarnation !== f.caseRef.incarnation || digestSfValue(current) !== digestSfValue(decision) ||
          !current.participants.includes(actor.principalRef) || actor.principalRef !== call.binding.principalRef ||
          actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion)
          throw new Error("Actual pending document premise changed before commit")
        state.cases[current.id] = { ...current, version: pending.caseRef.version, ledger: [...current.ledger, pending] }
        const queued = enqueueSfLedgerEvent(state, pending, {
          installationId: call.binding.installationId, projectId: call.binding.projectId, authority: actor,
        })
        if (queued.status !== "ok") throw new Error(queued.reason)
        return { commit: true, value: queued.value.eventRef }
      })
      expect(added.status).toBe("ok")
      if (added.status !== "ok") throw new Error("Real C08 pending document event was not committed")
      const pendingRef = added.value
      const keyB = JSON.stringify([f.caseRef.id, f.caseRef.incarnation, pendingRef.target.eventId])
      const withPending = await f.audit()
      expect(withPending.atlas).toEqual(before.atlas)
      expect(object(withPending.outbox)[keyA]).toEqual(itemA)
      expect(Object.keys(object(withPending.outbox))).toHaveLength(Object.keys(object(before.outbox)).length + 1)
      expect(object(object(withPending.outbox)[keyB]).state).toBe("pending")
      expect(object(object(withPending.outbox)[keyB]).receipt).toBeUndefined()
      expect(object(object(withPending.outbox)[keyB]).eventRef).toEqual(pendingRef)
      expect(withPending.counts.events).toBe(before.counts.events)
      expect(withPending.counts.envelopes).toBe(before.counts.envelopes)
      expect(withPending.counts.settled).toBe(before.counts.settled)
      expect(withPending.counts.scans).toBe(before.counts.scans)

      expect((await f.memory.recall(f.caseRef, call)).status).toBe("unavailable")
      expect(await f.atlas.memory.readOriginal(f.caseRef, source.ref.refDigest, call)).toEqual(source.ref)
      // Real continuity uses the original40 caseForEvidence composition and the
      // private capture lookup. Success must not depend on publishing pending B.
      expect(await f.atlas.proveContinuity(source.ref, source.ref, call)).toBe(true)
      const replay = await f.memory.emitFromLedger(f.eventRef, call)
      expect(digestSfValue(replay)).toBe(digestSfValue({ ...receiptA, status: "already-committed" }))
      expect(await f.atlas.memory.readOriginal(f.caseRef, pendingRef.refDigest, call)).toBeUndefined()
      expect(await f.audit()).toEqual(withPending)

      // A settled receipt is not authority. Remove the live Request credential;
      // the same admitted call must lose both original access and exact replay.
      expect(request.headers.get("cookie")).toBeTruthy()
      request.headers.delete("cookie")
      expect(await f.authority.host.revalidate(call)).toBe(false)
      expect(await f.atlas.memory.readOriginal(f.caseRef, source.ref.refDigest, call)).toBeUndefined()
      const denied = await f.memory.emitFromLedger(f.eventRef, call)
      expect(denied.status).toBe("unavailable")
      expect(denied.eventId).toBeUndefined()
      expect(denied.recordDigest).toBeUndefined()
      expect(await f.audit()).toEqual(withPending)
      completed.push({ scenario: "documentary-A-settled-B-pending", originalA: "accepted",
        replayA: "already-committed-same-receipt", pendingB: "no-publication-no-receipt-no-original",
        wholeCaseRecall: "unavailable", currentCredentialRemoval: "original-and-replay-refused",
        auditDigest: digestSfValue(withPending), originalDigest: source.ref.refDigest,
        recordDigest: f.receipt.recordDigest, scanner: f.receipt.scanner, scans: f.counts.scans,
        atlasUnchanged: true, outboxUnchangedAfterB: true, nativeSessionWitness: false,
        financialC12Executed: false, installedInitializeAtlasCallbackExecuted: false })
    }, f.replayRequest())
  })
  // Emit the witness only after the real fixture has completed its teardown.
  expect(completed).toHaveLength(1)
  console.info("SF_MEMORY_PENDING_REPLAY_M69", JSON.stringify(completed[0]))
}, 180_000)
