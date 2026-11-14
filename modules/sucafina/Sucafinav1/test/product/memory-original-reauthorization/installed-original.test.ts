import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { object } from "../../../runtime/contract.ts"
import { withMemoryIntegrityFixture } from "../wp10/memory-integrity/fixture.ts"

type MemoryFixture = Parameters<Parameters<typeof withMemoryIntegrityFixture>[0]>[0]

// These are the installed business-services/initializeAtlas ports over real C08,
// C12, SQLite, source issuance, Atlas and Gitleaks. The inherited fixture's case,
// identity and lifecycle metadata are explicitly synthetic; no native witness.
function audit(fixture: MemoryFixture) {
  return fixture.persistence.transaction("dashboard", async (snapshot) => {
    const state = object(snapshot.data.__sfProductV1)
    return { commit: false, value: structuredClone({ atlas: state.atlas, outbox: state.outbox }) }
  })
}

test("Installed original accepts intact sources and the real initializeAtlas continuity callback without recursion", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      const before = await audit(f)
      expect((await f.business.context.resolve(f.original, call)).state).toBe("fresh")
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.eventRef.refDigest, call)).toEqual(f.eventRef)
      // This explicitly reaches initializeAtlas.caseForEvidence, whose installed
      // callback calls Memory's original lookup. A recursive public authorization
      // path cannot satisfy these real continuity reads and the bounded positives.
      expect(await f.atlas.proveContinuity(f.original, f.original, call)).toBe(true)
      expect(await f.atlas.proveContinuity(f.eventRef, f.eventRef, call)).toBe(true)
      expect(await audit(f)).toEqual(before)
    } finally { f.authority.human.finish(call) }
  }, "public-original-intact-installed-callback")
}, 120_000)

test("Installed original keeps legitimate C12 history and refuses a corrupted immutable capture", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      const before = await audit(f)
      const capture = await f.atlas.memory.readOriginalCapture(f.caseRef, f.original.refDigest, call)
      expect(capture?.ref).toEqual(f.original)
      await f.edit(150)
      const historical = await f.business.context.resolve(f.original, call)
      expect(historical.state).toBe("historical")
      expect(historical.ref).toEqual(f.original)
      expect(historical.currentRef?.refDigest).not.toBe(f.original.refDigest)
      expect(historical.authorizedProjection).toEqual(capture?.projection)
      expect(historical.differences).toContainEqual({ field: "originalAmount", before: 100, after: 150 })
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(await f.atlas.memory.readOriginalCapture(f.caseRef, f.original.refDigest, call)).toEqual(capture)
      expect(await audit(f)).toEqual(before)

      await f.mutateAtlas((_partition, original) => { original.projection = { damaged: true } })
      const corrupted = await audit(f)
      expect(corrupted).not.toEqual(before)
      const originalPartition = Object.values(object(before.atlas)).find((partition) => object(object(partition).originals)[f.original.refDigest])
      const corruptedPartition = Object.values(object(corrupted.atlas)).find((partition) => object(object(partition).originals)[f.original.refDigest])
      expect(object(corruptedPartition).captureDigests).toEqual(object(originalPartition).captureDigests)
      expect(object(object(object(corruptedPartition).originals)[f.original.refDigest]).ref).toEqual(f.original)
      // C12 retains its legitimate historical source. That cannot authorize a
      // damaged Atlas capture, and the read must not repair or rewrite either.
      expect((await f.business.context.resolve(f.original, call)).state).toBe("historical")
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toBeUndefined()
      expect(await f.atlas.memory.readOriginalCapture(f.caseRef, f.original.refDigest, call)).toBeUndefined()
      expect(await audit(f)).toEqual(corrupted)
      console.info("SF_MEMORY_ORIGINAL_INSTALLED_PROOF", JSON.stringify({ scenario: "historical-corrupt",
        historical: "accepted", corrupted: "refused", immutableCapture: true,
        auditDigest: digestSfValue(corrupted), nativeSessionWitness: false }))
    } finally { f.authority.human.finish(call) }
  }, "public-original-historical-corrupt")
}, 120_000)

test("Installed original and exact replay retain committed event A while later event B remains pending", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      const before = await audit(f)
      const key = JSON.stringify([f.caseRef.id, f.caseRef.incarnation, f.eventRef.target.eventId])
      const committed = object(object(before.outbox)[key]).receipt
      expect(object(committed).status).toBe("committed")
      const ready = await f.atlas.memory.recall(f.caseRef, call)
      if (ready.status !== "ok") throw new Error("Whole-case recall must be available before pending B")
      expect(ready.records.some((record) => record.envelope.sourceEventId === f.eventRef.target.eventId)).toBe(true)
      const stored = await f.authority.state.read(f.staleRequest, "cases", (state) => ({
        versions: state.versions, decision: state.cases[f.caseRef.id],
      }))
      if (stored.status !== "ok" || !stored.value.decision) throw new Error("Real committed case unavailable")
      const decision = stored.value.decision
      const previous = decision.ledger.find((event) => event.id === f.eventRef.target.eventId)
      if (!previous) throw new Error("Committed event A missing from real C08 ledger")
      // Add only a declared synthetic later ledger event to the real C08 case and
      // outbox. Do not emit B, seed an Atlas record or manufacture a receipt for it.
      const pending = { ...structuredClone(previous), id: "later-pending-event",
        caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version + 1 },
        rationale: "Explicit later event waiting for Memory projection" }
      const reference = { ...f.eventRef, refId: `${f.eventRef.refId}-later`, refDigest: "",
        target: { ...f.eventRef.target, caseVersion: pending.caseRef.version, eventId: pending.id,
          outputDigest: pending.outputDigest, evidenceRefs: pending.evidenceRefs } }
      const pendingRef = { ...reference, refDigest: digestSfEvidenceRef(reference) }
      const pendingKey = JSON.stringify([decision.id, decision.incarnation, pending.id])
      const added = await f.authority.state.transaction(f.staleRequest, {
        namespace: "cases", expectedStorageVersion: stored.value.versions.cases,
        additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: stored.value.versions.outbox }],
        targetRef: `case:${encodeURIComponent(decision.id)}:${encodeURIComponent(decision.incarnation)}`,
        targetIncarnation: decision.incarnation, idempotencyKey: "memory-original-later-pending",
        commandDigest: digestSfValue(pendingRef),
      }, async (state, actor) => {
        state.cases[decision.id] = { ...decision, version: pending.caseRef.version, ledger: [...decision.ledger, pending] }
        state.outbox[pendingKey] = { eventRef: pendingRef, writerPrincipalRef: actor.principalRef,
          accessRevision: actor.accessRevision, createdAt: f.at, attempts: 0, state: "pending" }
        return { commit: true, value: true }
      })
      expect(added.status).toBe("ok")
      const withPending = await audit(f)
      expect(withPending.atlas).toEqual(before.atlas)
      expect(Object.keys(object(withPending.outbox))).toHaveLength(Object.keys(object(before.outbox)).length + 1)
      expect(object(withPending.outbox)[key]).toEqual(object(before.outbox)[key])
      expect(object(object(withPending.outbox)[pendingKey]).state).toBe("pending")
      expect(object(object(withPending.outbox)[pendingKey]).receipt).toBeUndefined()
      // Whole-case recall preserves its pending-outbox gate. The settled A
      // capture and its exact receipt have their own current authorization gate.
      expect((await f.atlas.memory.recall(f.caseRef, call)).status).toBe("unavailable")
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(await f.business.context.emitFromLedger(f.eventRef, call)).toEqual({ ...object(committed), status: "already-committed" })
      expect(await f.atlas.memory.readOriginal(f.caseRef, pendingRef.refDigest, call)).toBeUndefined()
      expect(await audit(f)).toEqual(withPending)
      console.info("SF_MEMORY_ORIGINAL_INSTALLED_PROOF", JSON.stringify({ scenario: "committed-A-pending-B",
        originalA: "accepted", replayA: "already-committed", recall: "unavailable", eventB: "pending",
        atlasUnchanged: true, outboxUnchanged: true, auditDigest: digestSfValue(withPending), nativeSessionWitness: false }))
    } finally { f.authority.human.finish(call) }
  }, "public-original-committed-before-pending")
}, 120_000)

test("Installed original reauthorizes the same admitted call after principal revocation", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      const before = await audit(f)
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(f.authority.host.requestFor(call)).toBe(f.staleRequest)
      f.access.allowed = false
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toBeUndefined()
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.eventRef.refDigest, call)).toBeUndefined()
      expect(f.staleRequest.signal.aborted).toBe(false)
      expect(await audit(f)).toEqual(before)
      // Restoration needs a new real admission; the revoked lease cannot revive.
      f.access.allowed = true
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toBeUndefined()
      const restored = await f.admit()
      try {
        expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, restored)).toEqual(f.original)
      } finally { f.authority.human.finish(restored) }
      expect(await audit(f)).toEqual(before)
    } finally { f.authority.human.finish(call) }
  }, "public-original-principal-revocation")
}, 120_000)

test("Installed original rejects substituted binding, principal, lease, case and incarnation while retaining the authentic positive", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      const before = await audit(f)
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(Object.isFrozen(call)).toBe(true)
      expect(Object.isFrozen(call.binding)).toBe(true)
      expect(Object.isFrozen(call.lease)).toBe(true)
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest,
        { ...call, binding: { ...call.binding, principalRef: "replacement-principal" } })).toBeUndefined()
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest,
        { ...call, binding: { ...call.binding, accessRevision: "replacement-revision" } })).toBeUndefined()
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest,
        { ...call, lease: structuredClone(call.lease) })).toBeUndefined()
      expect(await f.atlas.memory.readOriginal({ ...f.caseRef, id: "other-case" }, f.original.refDigest, call)).toBeUndefined()
      expect(await f.atlas.memory.readOriginal({ ...f.caseRef, incarnation: "other-incarnation" }, f.original.refDigest, call)).toBeUndefined()
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(await audit(f)).toEqual(before)
    } finally { f.authority.human.finish(call) }
  }, "public-original-binding-and-case")
}, 120_000)

for (const mutation of ["headers", "request", "abort", "finished-lease"] as const) {
  test(`Installed original fences ${mutation} after the final real revalidation`, async () => {
    expectSpawn(import.meta.path)
    await withMemoryIntegrityFixture(async (f) => {
      const controller = new AbortController()
      const request = new Request(f.staleRequest, { signal: AbortSignal.any([f.deadline.signal, controller.signal]) })
      const call = await f.admit(request)
      const replacement = new Request(request)
      const revalidate = f.authority.host.revalidate
      const requestFor = f.authority.host.requestFor
      const observation = { calls: 0, target: 0, changed: false }
      try {
        const before = await audit(f)
        // Warm issuance before calibrating this exact operation. The hook always
        // awaits the real authority; it never grants access or replaces a reader.
        expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
        f.authority.host.requestFor = (trusted) =>
          observation.changed && mutation === "request" && trusted === call ? replacement : requestFor(trusted)
        f.authority.host.revalidate = async (trusted) => {
          const permitted = await revalidate(trusted)
          if (trusted !== call) return permitted
          observation.calls += 1
          if (permitted && observation.target > 0 && observation.calls === observation.target) {
            expect(requestFor(trusted)).toBe(request)
            if (mutation === "headers") request.headers.set("x-memory-original-fence", "changed-after-revalidation")
            if (mutation === "abort") controller.abort()
            if (mutation === "finished-lease") f.authority.human.finish(call)
            observation.changed = true
          }
          return permitted
        }
        expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
        expect(observation.calls).toBeGreaterThan(0)
        observation.target = observation.calls
        observation.calls = 0
        expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toBeUndefined()
        expect(observation.changed).toBe(true)
        expect(observation.calls).toBe(observation.target)
        expect(request.signal.aborted).toBe(mutation === "abort")
        if (mutation === "headers") expect(request.headers.get("x-memory-original-fence")).toBe("changed-after-revalidation")
        if (mutation === "request") {
          expect(f.authority.host.requestFor(call)).toBe(replacement)
          expect([...replacement.headers.entries()]).toEqual([...request.headers.entries()])
        }
        if (mutation === "finished-lease") expect(requestFor(call)).toBeUndefined()
        expect(await audit(f)).toEqual(before)
      } finally {
        f.authority.host.revalidate = revalidate
        f.authority.host.requestFor = requestFor
        f.authority.human.finish(call)
      }
    }, `public-original-final-${mutation}`)
  }, 120_000)
}

test("Installed original refuses revocation after the last real source resolution before egress", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    const resolve = f.atlas.context.resolve
    const observation = { reads: 0, target: 0, revoked: false }
    try {
      const before = await audit(f)
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      f.atlas.context.resolve = async (reference, trusted) => {
        const resolved = await resolve(reference, trusted)
        if (trusted !== call || reference.refDigest !== f.original.refDigest) return resolved
        observation.reads += 1
        if (observation.target > 0 && observation.reads === observation.target) {
          expect(resolved.state === "fresh" || resolved.state === "historical").toBe(true)
          expect(resolved.authorizedProjection).toBeDefined()
          expect(f.authority.host.requestFor(trusted)).toBe(f.staleRequest)
          observation.revoked = true
          f.access.allowed = false
        }
        return resolved
      }
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toEqual(f.original)
      expect(observation.reads).toBeGreaterThan(0)
      observation.target = observation.reads
      observation.reads = 0
      expect(await f.atlas.memory.readOriginal(f.caseRef, f.original.refDigest, call)).toBeUndefined()
      expect(observation.revoked).toBe(true)
      expect(observation.reads).toBe(observation.target)
      expect(f.staleRequest.signal.aborted).toBe(false)
      expect(await audit(f)).toEqual(before)
    } finally { f.atlas.context.resolve = resolve; f.authority.human.finish(call) }
  }, "public-original-late-revocation")
}, 120_000)
