import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { atlasValue, withAtlasConsumer } from "../../wp02/atlas-consumer-fixture.ts"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { rows } from "../../../../runtime/contract.ts"

// The existing fixture drafts a real C09 case and commits explicitly synthetic
// ledger text through authorized C08 + the production outbox. Every source,
// case/event reader, C17 resolver, continuity proof, scanner and Atlas capture is real.
test("FIN-IND-002 composed C09 event retains its identity across case advancement, revocation and authorized replay", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const accepted = await f.ledger([sources.budget], "Keep this authorized budget observation with its original event identity.")
    const original = structuredClone(accepted.eventRef)
    const request = { caseRef: encodeCaseRef(accepted.caseRef) }
    const resolve = () => f.call("sf_evidence_get", { evidenceRef: original }, (call) => f.runtime.current.business.context.resolve(original, call))
    const continuity = () => f.call("sf_evidence_get", { evidenceRef: original }, async (call) => {
      const atlas = f.runtime.current.business.atlasRecall()
      if (!atlas) throw new Error("Real Atlas continuity is not composed")
      return atlas.proveContinuity(original, original, call)
    })
    const emit = () => f.call("sf_case_read", request, (call) => f.runtime.current.business.context.emitFromLedger(original, call))

    await f.phase("c09.real-reader-and-c17", () => f.call("sf_case_read", request, async (call) => {
      const value = atlasValue(await f.runtime.current.business.cases.read(request, call))
      expect(value.case.version).toBe(accepted.caseRef.version)
      expect(value.events).toEqual([accepted.event])
      expect(value.context.principalRef).toBe(call.binding.principalRef)
      expect(value.evidenceRefs).toContainEqual(sources.budget)
      const found = await f.runtime.current.business.context.context({ refs: [original, sources.budget] }, call)
      expect(found.map((entry) => entry.state)).toEqual(["fresh", "fresh"])
      expect(found[0]!.ref).toEqual(original)
      expect(found[0]!.currentRef).toEqual(original)
      expect(found[0]!.authorizedProjection).toEqual(accepted.event)
      expect(found[0]!.accessRevision).toBe(call.binding.accessRevision)
      expect(sfEvidenceSourceMaps([found[0]!.ref])).toEqual(sfEvidenceSourceMaps([original]))
    }))

    const receipt = await f.phase("c17.capture-original", emit)
    expect(receipt.status).toBe("committed")
    expect(receipt.scanner).toEqual({ name: "gitleaks", version: f.scanner.version, status: "clean" })
    expect(receipt.eventId).toBeTruthy()
    expect(receipt.recordDigest).toBeTruthy()
    expect(await continuity()).toBe(true)
    const stored = await f.inspect()
    expect(stored.entries).toBe(1)
    expect(await emit()).toEqual({ ...receipt, status: "already-committed" })
    expect(await f.inspect()).toEqual(stored)

    // A deliberate C08 case-version transition preserves the immutable ledger.
    // It is not a claim that a full financial choice journey ran in this test.
    const advanced = await f.phase("c09.advance-case", () => f.call("sf_case_read", request, async (call) => {
      const authority = f.runtime.current.authority
      const incoming = authority.host.requestFor(call)
      if (!incoming) throw new Error("Current case request unavailable")
      const before = await authority.state.read(incoming, "cases", (state) => state.cases[accepted.caseRef.id])
      if (before.status !== "ok" || !before.value) throw new Error("Current case unavailable")
      const decision = before.value
      return atlasValue(await authority.state.transaction(incoming, {
        namespace: "cases", expectedStorageVersion: before.storageVersion,
        targetRef: decision.id, targetIncarnation: decision.incarnation,
        idempotencyKey: `continuity-advance:${accepted.event.id}`,
        commandDigest: digestSfValue({ caseRef: accepted.caseRef, nextVersion: decision.version + 1 }),
      }, async (state, actor) => {
        const current = state.cases[decision.id]
        if (!current || current.version !== decision.version || current.incarnation !== decision.incarnation ||
          actor.principalRef !== call.binding.principalRef || !current.participants.includes(actor.principalRef))
          throw new Error("Case advancement lost authority or version")
        state.cases[decision.id] = { ...current, version: current.version + 1 }
        return { commit: true, value: { id: current.id, incarnation: current.incarnation, version: current.version + 1 } }
      }))
    }))
    expect(advanced.version).toBe(accepted.caseRef.version + 1)
    const currentCase = await f.call("sf_case_read", request, async (call) => atlasValue(await f.runtime.current.business.cases.read(request, call)))
    expect(currentCase.case.version).toBe(advanced.version)
    expect(currentCase.events).toEqual([accepted.event])
    const afterAdvance = await resolve()
    expect(afterAdvance.state).toBe("fresh")
    expect(afterAdvance.ref).toEqual(original)
    expect(afterAdvance.currentRef).toEqual(original)
    expect(afterAdvance.authorizedProjection).toEqual(accepted.event)
    expect(await continuity()).toBe(true)
    expect(await emit()).toEqual({ ...receipt, status: "already-committed" })
    expect(await f.inspect()).toEqual(stored)

    await f.phase("c17.revoke-current-lease", () => f.call("sf_evidence_get", { evidenceRef: original }, async (call) => {
      f.active.delete(f.actors[0])
      try {
        const denied = await f.runtime.current.business.context.resolve(original, call)
        expect(denied.state).toBe("unavailable")
        expect(denied.authorizedProjection).toBeUndefined()
        expect(denied.currentRef).toBeUndefined()
        const atlas = f.runtime.current.business.atlasRecall()
        if (!atlas) throw new Error("Real Atlas continuity is not composed")
        expect(await atlas.proveContinuity(original, original, call)).toBe(false)
        expect((await f.runtime.current.business.context.emitFromLedger(original, call)).status).toBe("unavailable")
        expect((await f.runtime.current.business.cases.read(request, call)).status).not.toBe("ok")
      } finally { f.active.add(f.actors[0]) }
    }))

    // Each helper performs new Request admission; an old lease is never renewed.
    await f.phase("c17.authorized-replay-after-reopen", async () => {
      await f.reopen()
      const reopened = await resolve()
      expect(reopened.state).toBe("fresh")
      expect(reopened.ref).toEqual(original)
      expect(reopened.authorizedProjection).toEqual(accepted.event)
      expect(await continuity()).toBe(true)
      expect(await emit()).toEqual({ ...receipt, status: "already-committed" })
      expect(await f.inspect()).toEqual(stored)
    })
    expect(accepted.eventRef).toEqual(original)
    console.info("SF_C09_C17_PROOF", JSON.stringify({ scenario: "advance-revoke-replay", caseRef: accepted.caseRef,
      currentCaseVersion: advanced.version, eventRefDigest: original.refDigest, receipt,
      currentCaseReader: "production", continuity: true, revoked: "unavailable", reopened: true, atlasEntries: stored.entries }))
  }, "wp10-c09-advance-revoke-replay")
}, 180000)

test("FIN-IND-002 composed C17 distinguishes authorized source history from forged or replaced C09 evidence", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const accepted = await f.ledger([sources.topic], "Preserve the original authorized action status while comparing its current source.")
    const original = structuredClone(accepted.eventRef)
    if (original.kind !== "case-event") throw new Error("Canonical outbox did not produce a case-event reference")
    const request = { caseRef: encodeCaseRef(accepted.caseRef) }
    const before = await f.call("sf_evidence_get", { evidenceRef: sources.topic }, (call) => f.runtime.current.business.context.resolve(sources.topic, call))
    expect(before.state).toBe("fresh")
    expect(before.authorizedProjection).toBeDefined()
    const receipt = await f.call("sf_case_read", request, (call) => f.runtime.current.business.context.emitFromLedger(original, call))
    expect(receipt.status).toBe("committed")
    const stored = await f.inspect()
    expect(stored.entries).toBe(1)

    await f.phase("c09.reject-forged-identities", () => f.call("sf_evidence_get", { evidenceRef: original }, async (call) => {
      for (const target of [
        { ...original.target, eventId: original.target.eventId + "-other" },
        { ...original.target, caseIncarnation: original.target.caseIncarnation + "-other" },
        { ...original.target, caseVersion: original.target.caseVersion + 1 },
        { ...original.target, outputDigest: "0".repeat(64) },
        { ...original.target, evidenceRefs: [] },
      ]) {
        const forged = { ...original, target, refDigest: "" }
        forged.refDigest = digestSfEvidenceRef(forged)
        const result = await f.runtime.current.business.context.resolve(forged, call)
        expect(result.state).toBe("unavailable")
        expect(result.authorizedProjection).toBeUndefined()
        expect(result.currentRef).toBeUndefined()
      }
    }))

    await f.phase("source.change-real-status", () => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
      rows(snapshot.data.hotTopics)[0]!.status = "closed"
      return { commit: true, value: undefined }
    }))
    const current = (await f.sources()).topic
    expect(current.refDigest).not.toBe(sources.topic.refDigest)
    expect(current.target.incarnation).toBe(sources.topic.target.incarnation)
    expect(current.target.version).toBeGreaterThan(sources.topic.target.version)
    const historical = await f.call("sf_evidence_get", { evidenceRef: sources.topic }, (call) => f.runtime.current.business.context.resolve(sources.topic, call))
    expect(historical.state).toBe("historical")
    expect(historical.ref).toEqual(sources.topic)
    expect(historical.currentRef).toEqual(current)
    expect(historical.authorizedProjection).toEqual(before.authorizedProjection)
    expect(historical.differences).toContainEqual({ field: "hotTopics:topic:status", before: "open", after: "closed" })
    await f.phase("c17.preserve-event-over-authorized-history", () => f.call("sf_case_read", request, async (call) => {
      const value = atlasValue(await f.runtime.current.business.cases.read(request, call))
      expect(value.events).toEqual([accepted.event])
      const resolved = await f.runtime.current.business.context.resolve(original, call)
      expect(resolved.state).toBe("fresh")
      expect(resolved.ref).toEqual(original)
      expect(resolved.currentRef).toEqual(original)
      expect(resolved.authorizedProjection).toEqual(accepted.event)
      const atlas = f.runtime.current.business.atlasRecall()
      if (!atlas) throw new Error("Real Atlas continuity is not composed")
      expect(await atlas.proveContinuity(original, original, call)).toBe(true)
    }))

    await f.phase("source.replace-physical-identity", async () => {
      await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.hotTopics = []
        return { commit: true, value: undefined }
      })
      await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.hotTopics = [{ id: "topic", action: "Replacement action", status: "open", owner: "Operations" }]
        return { commit: true, value: undefined }
      })
    })
    const replacement = (await f.sources()).topic
    expect(replacement.target.incarnation).not.toBe(sources.topic.target.incarnation)
    await f.call("sf_case_read", request, async (call) => {
      const resolved = await f.runtime.current.business.context.resolve(original, call)
      expect(resolved.state).toBe("unavailable")
      expect(resolved.authorizedProjection).toBeUndefined()
      const atlas = f.runtime.current.business.atlasRecall()
      if (!atlas) throw new Error("Real Atlas continuity is not composed")
      expect(await atlas.proveContinuity(original, original, call)).toBe(false)
      expect((await f.runtime.current.business.cases.read(request, call)).status).not.toBe("ok")
    })
    expect(await f.inspect()).toEqual(stored)
    expect(accepted.eventRef).toEqual(original)
    console.info("SF_C09_C17_PROOF", JSON.stringify({ scenario: "source-history-and-replacement", eventRefDigest: original.refDigest,
      originalSourceDigest: sources.topic.refDigest, currentSourceDigest: current.refDigest,
      replacementSourceDigest: replacement.refDigest, history: "historical", eventIdentityPreserved: true,
      forgedReferences: 5, replacedSource: "unavailable", atlasEntries: stored.entries }))
  }, "wp10-c09-source-history-and-replacement")
}, 180000)

