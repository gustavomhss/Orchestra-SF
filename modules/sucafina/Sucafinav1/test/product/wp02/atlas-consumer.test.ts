import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { NO_SCANNER_NAME } from "@orchestra/atlas-boundary/native-memory"
import { atlasDay, atlasPeriod, atlasValue, syntheticScannerControl, withAtlasConsumer } from "./atlas-consumer-fixture.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { deriveSfMemoryOwner } from "../../../product/decision-memory/atlas-projection.ts"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"

function projection(value: BusinessEvidenceResolution) {
  if (value.state !== "fresh" || !value.authorizedProjection || !("values" in value.authorizedProjection)) throw new Error("A fresh real Dashboard projection is required")
  return value.authorizedProjection
}

function movingClockProof(clock: { at: string; stepMs: number; environmentReads: number }, before: { at: string; environmentReads: number }, observedAt: readonly string[]) {
  const observations = [...new Set(observedAt)]
  const environmentReads = clock.environmentReads - before.environmentReads
  expect(clock.stepMs).toBe(1)
  expect(environmentReads).toBeGreaterThan(1)
  expect(Date.parse(clock.at) - Date.parse(before.at)).toBe(environmentReads * clock.stepMs)
  expect(observations.length).toBeGreaterThan(1)
  expect(observations.every((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.parse(before.at) && Date.parse(value) <= Date.parse(clock.at))).toBe(true)
  expect(observations.every((value, index) => index === 0 || Date.parse(value) > Date.parse(observations[index - 1]!))).toBe(true)
  return { stepMs: clock.stepMs, environmentReads, startedAt: before.at, finishedAt: clock.at,
    distinctSourceObservations: observations.length, firstObservedAt: observations[0]!, lastObservedAt: observations.at(-1)! }
}

test("C17 real Atlas preserves Dashboard source metadata and durable memory after reopen", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const observed = await f.phase("source-observations", () => f.call("sf_evidence_get", { evidenceRef: sources.budget }, async (context) => ({
      budget: await f.runtime.current.business.context.resolve(sources.budget, context),
      topic: await f.runtime.current.business.context.resolve(sources.topic, context),
    })))
    expect(observed.budget.checkedAt).toBe(f.clock.at)
    expect(observed.topic.checkedAt).toBe(f.clock.at)
    expect(projection(observed.budget).components.reduce((sum, value) => sum + (value.amount ?? 0), 0)).toBe(1300)
    expect(projection(observed.budget).values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 0, evidenceState: "confirmed" }))
    expect(projection(observed.budget).values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:actual", value: null, evidenceState: "absent" }))
    expect(projection(observed.topic).values.map((value) => value.value)).toEqual(["open"])
    expect(projection(observed.topic).context.period).toEqual(atlasDay)
    expect(JSON.stringify(observed)).not.toContain("Private action wording")
    expect(JSON.stringify(observed)).not.toContain("Private notes")

    const budget = await f.ledger([sources.budget], "The effective monthly budget remains traceable to its observed components.")
    const topic = await f.ledger([sources.topic], "The action remains open; only its status was authorized for this review.")
    const budgetReceipt = await f.phase("budget.emit", () => f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context)))
    const topicReceipt = await f.phase("topic.emit", () => f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(topic.eventRef, context)))
    expect(budgetReceipt.status).toBe("committed")
    expect(topicReceipt.status).toBe("committed")
    expect(budgetReceipt.scanner).toEqual({ name: "gitleaks", version: f.scanner.version, status: "clean" })
    expect(topicReceipt.scanner).toEqual(budgetReceipt.scanner)
    if (!budgetReceipt.eventId || !budgetReceipt.recordDigest || !topicReceipt.eventId) throw new Error("Atlas did not issue durable write receipts")

    const request = { selectionRefs: [encodeCaseRef(budget.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5 }
    const recalled = await f.phase("recall.initial", () => f.call("sf_decision_recall", request,
      (context) => f.runtime.current.business.context.recall({ caseRefs: [budget.caseRef], query: "budget" }, context)))
    expect(recalled).toHaveLength(1)
    const record = recalled[0]!
    const authorizedCase = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, async (context) => atlasValue(await f.runtime.current.business.cases.read({ caseRef: encodeCaseRef(budget.caseRef) }, context)))
    const owner = deriveSfMemoryOwner(authorizedCase.context, authorizedCase.case)
    if (!owner) throw new Error("Authorized case did not produce a memory owner")
    expect(record.envelope.owner).toBe(owner)
    expect(record.envelope.writerPrincipalRef).toBe(f.actors[0])
    expect(record.envelope.eventId).toBe(budgetReceipt.eventId)
    expect(record.envelope.scannerReceipt.digest).toBe(budgetReceipt.recordDigest)
    expect(record.envelope.sourceEventId).toBe(budget.event.id)
    expect(record.envelope.evidenceRefs).toEqual([budget.eventRef, sources.budget])
    expect(record.envelope.dependencies).toEqual([sources.budget])
    const maps = sfEvidenceSourceMaps(record.envelope.evidenceRefs)
    expect(record.envelope.sourceVersions).toEqual(maps.sourceVersions)
    expect(record.envelope.sourceIncarnations).toEqual(maps.sourceIncarnations)
    expect(record.envelope.projectionDigest).toBe(digestSfValue({ kind: "task", owner: record.envelope.owner, entry: record.entry,
      sourceEventId: record.envelope.sourceEventId, evidenceRefs: record.envelope.evidenceRefs }))
    expect(Number.isFinite(Date.parse(record.envelope.createdAt))).toBe(true)

    const beforeRetry = await f.inspect()
    expect(beforeRetry.entries).toBe(2)
    const retry = await f.phase("emit.retry", () => f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context)))
    expect(retry).toEqual({ ...budgetReceipt, status: "already-committed" })
    expect(await f.inspect()).toEqual(beforeRetry)
    f.clock.at = "2026-11-13T10:00:00Z"
    await f.reopen()
    const durable = await f.phase("recall.after-reopen", () => f.call("sf_decision_recall", request, (context) => f.runtime.current.business.context.recall({ caseRefs: [budget.caseRef], query: "budget" }, context)))
    expect(durable.map(({ envelope, entry }) => ({ envelope, entry }))).toEqual(recalled.map(({ envelope, entry }) => ({ envelope, entry })))
    const refreshed = await f.call("sf_evidence_get", { evidenceRef: sources.budget }, (context) => f.runtime.current.business.context.resolve(sources.budget, context))
    expect(refreshed.state).toBe("fresh")
    expect(refreshed.currentRef).toEqual(sources.budget)
    expect(refreshed.checkedAt).toBe(f.clock.at)
    expect(refreshed.checkedAt).not.toBe(observed.budget.checkedAt)
    expect(await f.inspect()).toEqual(beforeRetry)
    console.info("SF_ATLAS_DASHBOARD_PROOF", JSON.stringify({ scenario: "metadata-durable", boundaryModule: import.meta.resolve("@orchestra/atlas-boundary/business-memory-ports"),
      scanner: { ...f.scannerRelease, observedVersion: f.scanner.version }, write: budgetReceipt, topicWrite: topicReceipt, recalledEventId: record.envelope.eventId,
      sourceVersions: record.envelope.sourceVersions, sourceIncarnations: record.envelope.sourceIncarnations, durableReopen: true,
      sourceCheckedAt: observed.budget.checkedAt, reopenedSourceCheckedAt: refreshed.checkedAt }))
  }, "metadata-durable")
}, 180000)

test("C17 Atlas capability validates its schema and denies caller-selected ownership and another principal", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    f.clock.stepMs = 1
    const beforeClock = { at: f.clock.at, environmentReads: f.clock.environmentReads }
    const sources = await f.sources()
    const altered = { ...sources.topic, target: { ...sources.topic.target, fields: ["status", "notes"] }, refDigest: "" }
    const forged = { ...altered, refDigest: digestSfEvidenceRef(altered) }
    const rejected = await f.dispatch("sf_evidence_get", { evidenceRef: forged })
    expect(rejected.status).toBe("unavailable")
    expect(JSON.stringify(rejected)).not.toContain("Private notes")

    const budget = await f.ledger([sources.budget], "The effective monthly budget remains traceable to its observed components.")
    const budgetReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context))
    expect(budgetReceipt.status).toBe("committed")
    if (!budgetReceipt.eventId) throw new Error("Committed Atlas event has no identity")
    const authorizedCase = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, async (context) => atlasValue(await f.runtime.current.business.cases.read({ caseRef: encodeCaseRef(budget.caseRef) }, context)))
    const owner = deriveSfMemoryOwner(authorizedCase.context, authorizedCase.case)
    if (!owner) throw new Error("Authorized case did not produce a memory owner")
    const request = { selectionRefs: [encodeCaseRef(budget.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5 }
    const beforeWork = { recalls: f.memoryWork.recalls, originals: f.memoryWork.originals, observations: f.memoryWork.sourceObservedAt.length }
    const ranked = await f.phase("capability.rank-and-reauthorize", () => f.dispatch("sf_decision_recall", request))
    const work = { protectedReads: f.memoryWork.recalls - beforeWork.recalls, originalReads: f.memoryWork.originals - beforeWork.originals }
    expect(ranked.status).toBe("ok")
    if (ranked.status !== "ok") throw new Error("Real Atlas capability did not consume the stored record")
    // Two independent passes, each with a protected observation and a new read at egress.
    expect(work.protectedReads).toBe(4)
    expect(work.originalReads).toBeGreaterThan(0)
    const movingClock = movingClockProof(f.clock, beforeClock, [...budget.sourceObservedAt, ...f.memoryWork.sourceObservedAt.slice(beforeWork.observations)])
    expect(movingClock.distinctSourceObservations).toBe(work.protectedReads + 1)
    const output = decodeSfOperationOutput("sf_decision_recall", ranked.result)
    if (!output.ok) throw new Error("Recall output did not match the closed production schema")
    expect(output.value.matches).toHaveLength(1)
    expect(output.value.matches[0]?.memoryRecordRef).toBe(budgetReceipt.eventId)
    expect(output.value.matches[0]?.caseRef).toEqual(budget.caseRef)
    expect(output.value.matches[0]?.explanation.sourceStates.every((state) => state === "fresh")).toBe(true)
    expect(ranked.receipt.kind).toBe("ui")
    expect((await f.dispatch("sf_decision_recall", { ...request, owner })).status).toBe("needs-input")
    expect((await f.dispatch("sf_decision_recall", { ...request, owner: f.actors[1] })).status).toBe("needs-input")
    const other = await f.phase("capability.other-principal", () => f.dispatch("sf_decision_recall", request, f.actors[1]))
    expect(other.status).toBe("unavailable")
    expect(JSON.stringify(other)).not.toContain(budget.event.rationale)
    expect(JSON.stringify(other)).not.toContain(budgetReceipt.eventId)
    console.info("SF_ATLAS_DASHBOARD_PROOF", JSON.stringify({ scenario: "capability-authority", write: budgetReceipt,
      matchedMemoryRecordRef: output.value.matches[0]!.memoryRecordRef, matchedCaseRef: output.value.matches[0]!.caseRef,
      schema: "sf_decision_recall", receiptKind: ranked.receipt.kind, referenceForgery: rejected.status,
      ownerArguments: "needs-input", otherPrincipal: other.status, work, movingClock }))
  }, "capability-authority")
}, 180000)

test("C17 a changed Dashboard fingerprint invalidates its memory while an independent source stays readable", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const budget = await f.ledger([sources.budget], "The effective monthly budget remains traceable to its observed components.")
    const topic = await f.ledger([sources.topic], "The action remains open; only its status was authorized for this review.")
    const budgetReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context))
    const topicReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(topic.eventRef, context))
    expect(budgetReceipt.status).toBe("committed")
    expect(topicReceipt.status).toBe("committed")
    if (!topicReceipt.eventId) throw new Error("Committed Atlas event has no identity")
    const beforeChange = await f.inspect()
    expect(beforeChange.entries).toBe(2)
    await f.phase("source.change-budget", () => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => { rows(snapshot.data.opexEntries)[0]!.budget = 300; return { commit: true, value: undefined } }))
    expect((await f.dispatch("sf_evidence_get", { evidenceRef: sources.budget })).status).toBe("unavailable")
    const request = { selectionRefs: [encodeCaseRef(budget.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5 }
    await expect(f.phase("recall.changed-source", () => f.call("sf_decision_recall", request, (context) => f.runtime.current.business.context.recall({ caseRefs: [budget.caseRef], query: "budget" }, context)))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    const unaffected = await f.phase("recall.independent-source", () => f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [topic.caseRef], query: "action" }, context)))
    expect(unaffected).toHaveLength(1)
    expect(unaffected[0]?.envelope.eventId).toBe(topicReceipt.eventId)
    expect(await f.inspect()).toEqual(beforeChange)
    console.info("SF_ATLAS_DASHBOARD_PROOF", JSON.stringify({ scenario: "source-fingerprint", write: budgetReceipt,
      independentWrite: topicReceipt, changedSource: "unavailable", retainedMemoryEventId: unaffected[0]!.envelope.eventId,
      atlasAndOutboxUnchanged: true }))
  }, "source-fingerprint")
}, 180000)

test("C17 replacement record identity and current ACL withdrawal cannot inherit prior Atlas authority", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const topic = await f.ledger([sources.topic], "The action remains open; only its status was authorized for this review.")
    const topicReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(topic.eventRef, context))
    expect(topicReceipt.status).toBe("committed")
    const beforeReplacement = await f.inspect()
    expect(beforeReplacement.entries).toBe(1)
    await f.phase("source.remove-topic", () => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } }))
    expect((await f.dispatch("sf_evidence_get", { evidenceRef: sources.topic })).status).toBe("unavailable")
    await f.phase("source.reimport-topic", () => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ id: "topic", action: "Replacement wording", status: "open" }]; return { commit: true, value: undefined } }))
    const replaced = await f.sources()
    expect(replaced.topic.target.incarnation).not.toBe(sources.topic.target.incarnation)
    expect(replaced.topic.refId).not.toBe(sources.topic.refId)
    await expect(f.phase("recall.replaced-source", () => f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [topic.caseRef], query: "action" }, context)))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    expect(await f.inspect()).toEqual(beforeReplacement)

    const current = await f.ledger([replaced.topic], "The replacement action has its own current observation.")
    const currentReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(current.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(current.eventRef, context))
    expect(currentReceipt.status).toBe("committed")
    await f.phase("authority.withdraw-during-lease", () => f.call("sf_evidence_get", { evidenceRef: replaced.topic }, async (context) => {
      await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.roleMap = [{ surface: "dashboard", role: "viewer", entra: "atlas-reviewers", version: 2, by: f.actors[0] }]
        return { commit: true, value: undefined }
      })
      expect((await f.runtime.current.business.context.resolve(replaced.topic, context)).state).toBe("unavailable")
      await expect(f.runtime.current.business.context.recall({ caseRefs: [current.caseRef], query: "action" }, context)).rejects.toThrow("SF_MEMORY_AUTHORITY_UNAVAILABLE")
    }))
    expect((await f.dispatch("sf_evidence_get", { evidenceRef: replaced.topic })).status).toBe("unavailable")
    const request = { selectionRefs: [encodeCaseRef(current.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5 }
    expect((await f.dispatch("sf_decision_recall", request)).status).toBe("unavailable")
    console.info("SF_ATLAS_DASHBOARD_PROOF", JSON.stringify({ scenario: "replacement-current-acl", priorWrite: topicReceipt, replacementWrite: currentReceipt,
      originalIncarnation: sources.topic.target.incarnation, replacementIncarnation: replaced.topic.target.incarnation,
      replacedMemory: "unavailable", withdrawnLease: "unavailable", freshRequests: "unavailable", atlasAndOutboxUnchangedBeforeReplacementWrite: true }))
  }, "replacement-current-acl")
}, 180000)

test("C17 Atlas storage reconciles rollback and a lost committed reply while rejecting a corrupted capture", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const normal = await f.ledger([sources.budget], "The reviewer retained only the observed budget components.")
    const payload = { caseRef: encodeCaseRef(normal.caseRef) }
    const initial = await f.inspect()
    f.fault.stage = "before-commit"
    const interrupted = await f.phase("storage.interrupt-before-commit", () => f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context)))
    expect(interrupted).toMatchObject({ status: "unavailable", reason: "commit-unavailable" })
    expect(f.fault.trips).toBe(1)
    expect(await f.inspect()).toEqual(initial)
    const committed = await f.phase("storage.retry-rolled-back", () => f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context)))
    expect(committed.status).toBe("committed")
    if (!committed.eventId) throw new Error("Committed Atlas event has no identity")
    expect((await f.inspect()).entries).toBe(1)

    const second = await f.ledger([sources.budget], "A later accepted observation remains independent of the first record.")
    f.fault.stage = "after-commit"
    const lost = await f.phase("storage.lose-committed-reply", () => f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(second.eventRef, context)))
    expect(lost).toMatchObject({ status: "unavailable", reason: "commit-unavailable" })
    expect(f.fault.trips).toBe(2)
    const settled = await f.inspect(), item = settled.outbox[second.key]
    expect(settled.entries).toBe(2)
    if (!item || item.state !== "settled" || !item.receipt.eventId) throw new Error("Real commit did not settle its outbox with an event identity")
    expect(item.receipt.status).toBe("committed")
    await f.reopen()
    const retry = await f.phase("storage.reconcile-after-reopen", () => f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(second.eventRef, context)))
    expect(retry).toEqual({ ...item.receipt, status: "already-committed" })
    expect(await f.inspect()).toEqual(settled)
    const read = await f.phase("recall.shared-source", () => f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [second.caseRef], query: "review" }, context)))
    expect(read).toHaveLength(1)
    expect(read[0]?.envelope.eventId).toBe(item.receipt.eventId)

    // A valid capture in another case cannot rescue this case's corrupted protected original.
    await f.phase("storage.corrupt-one-capture", () => f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
      const atlas = object(object(snapshot.data.__sfProductV1).atlas)
      const originals = object(object(atlas[read[0]!.envelope.owner]).originals)
      const capture = object(originals[sources.budget.refDigest])
      if (digestSfValue(capture.ref) !== digestSfValue(sources.budget)) throw new Error("Protected original was not the real Dashboard reference")
      originals[sources.budget.refDigest] = { ...capture, ref: { ...object(capture.ref), refId: `${sources.budget.refId}:altered` } }
      return { commit: true, value: undefined }
    }))
    await expect(f.phase("recall.corrupted-capture", () => f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [second.caseRef], query: "review" }, context)))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    const healthy = await f.phase("recall.healthy-shared-source", () => f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.recall({ caseRefs: [normal.caseRef], query: "review" }, context)))
    expect(healthy).toHaveLength(1)
    expect(healthy[0]?.envelope.eventId).toBe(committed.eventId)
    console.info("SF_ATLAS_DASHBOARD_PROOF", JSON.stringify({ scenario: "storage-reconciliation", beforeCommit: interrupted.status, afterCommit: lost.status,
      reconciled: retry, storageFaults: f.fault.trips, sharedSource: "readable", corruptedCapture: "unavailable", healthyCapture: "readable" }))
  }, "storage-reconciliation")
}, 180000)

test("C17 the qualified real scanner refuses unsafe memory and fails closed when absent or timed out", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const normal = await f.ledger([sources.budget], "The reviewer retained only the observed budget components.")
    const payload = { caseRef: encodeCaseRef(normal.caseRef) }
    const initial = await f.inspect()
    f.runtime.current.configureScanner(undefined)
    const absent = await f.phase("scanner.absent", () => f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context)))
    expect(absent).toMatchObject({ status: "unavailable", scanner: { name: NO_SCANNER_NAME, status: "unavailable" } })
    expect(await f.inspect()).toEqual(initial)
    expect(initial.outbox[normal.key]?.state).toBe("pending")
    f.runtime.current.configureScanner(f.scanner)
    const restored = await f.phase("scanner.restored", () => f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context)))
    expect(restored.status).toBe("committed")
    expect(restored.scanner).toEqual({ name: "gitleaks", version: f.scanner.version, status: "clean" })

    const unsafe = await f.ledger([sources.budget], "The proposed note contains a synthetic scanner control: " + syntheticScannerControl)
    const beforeHit = await f.inspect()
    const hit = await f.phase("scanner.hit", () => f.call("sf_case_read", { caseRef: encodeCaseRef(unsafe.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(unsafe.eventRef, context)))
    expect(hit).toMatchObject({ status: "refused", sourceEventId: unsafe.event.id, reason: "scanner-blocked", scanner: { name: "gitleaks", version: f.scanner.version, status: "hit" } })
    const afterHit = await f.inspect()
    expect(afterHit.entries).toBe(beforeHit.entries)
    expect(afterHit.atlasDigest).toBe(beforeHit.atlasDigest)
    expect(afterHit.outbox[unsafe.key]).toMatchObject({ state: "settled", receipt: hit })
    expect(await f.call("sf_case_read", { caseRef: encodeCaseRef(unsafe.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(unsafe.eventRef, context))).toEqual(hit)
    expect(await f.inspect()).toEqual(afterHit)

    const clean = { owner: "atlas-timeout-control", kind: "task" as const, entry: { taskId: "timeout", attempted: [], failedWith: [], stoppedAt: "review", lesson: "Review current observations. ".repeat(50000) } }
    await f.phase("scanner.large-clean-control", () => expect(createSfAtlasScanner({ scanners: [f.scanner.spec], timeoutMs: 20000 }).scan(clean)).toBe(false))
    await f.phase("scanner.timeout", () => expect(() => createSfAtlasScanner({ scanners: [f.scanner.spec], timeoutMs: 1 }).scan(clean)).toThrow("scanner unavailable"))
    console.info("SF_ATLAS_DASHBOARD_PROOF", JSON.stringify({ scenario: "scanner-failure-paths", observedScannerVersion: f.scanner.version, archiveSha256: f.scannerRelease.sha256,
      scannerAbsent: absent.status, scannerRestored: restored.status, scannerHit: hit.status, scannerTimeout: "unavailable", refusal: hit }))
  }, "scanner-failure-paths")
}, 180000)

async function rejectConcurrentAtlasMutation(mutation: "source" | "access" | "capture") {
  await withAtlasConsumer(async (f) => {
    f.clock.stepMs = 1
    const beforeClock = { at: f.clock.at, environmentReads: f.clock.environmentReads }
    const sources = await f.sources()
    const budget = await f.ledger([sources.budget], "Only the unchanged authorized observation may leave the recall boundary.")
    const receipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context))
    expect(receipt.status).toBe("committed")
    if (!receipt.eventId) throw new Error("Committed Atlas event has no identity")
    const before = await f.inspect()
    expect(before.owners).toHaveLength(1)
    const owner = before.owners[0]!
    const start = f.memoryWork.recalls
    const boundary = mutation === "capture" ? 2 : 1
    const changed = { count: 0, durableDigest: "" }
    f.memoryWork.afterRecall = async (index) => {
      if (index - start !== boundary) return
      f.memoryWork.afterRecall = undefined
      changed.durableDigest = await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
        if (mutation === "source") rows(snapshot.data.opexEntries)[0]!.budget = 300
        if (mutation === "access") snapshot.data.roleMap = [{ surface: "dashboard", role: "viewer", entra: "atlas-reviewers", version: 2, by: f.actors[0] }]
        if (mutation === "capture") {
          const atlas = object(object(snapshot.data.__sfProductV1).atlas)
          const originals = object(object(atlas[owner]).originals)
          const capture = object(originals[sources.budget.refDigest])
          if (digestSfValue(capture.ref) !== digestSfValue(sources.budget)) throw new Error("Protected original did not match the observed source")
          originals[sources.budget.refDigest] = { ...capture, ref: { ...object(capture.ref), refId: `${sources.budget.refId}:concurrent-change` } }
        }
        changed.count++
        const state = object(snapshot.data.__sfProductV1)
        return { commit: true, value: digestSfValue({ atlas: state.atlas, outbox: state.outbox }) }
      })
    }
    const result = await f.phase(`recall.concurrent-${mutation}`, () => f.dispatch("sf_decision_recall", {
      selectionRefs: [encodeCaseRef(budget.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5,
    }))
    expect(changed.count).toBe(1)
    expect(result.status).toBe("unavailable")
    expect(JSON.stringify(result)).not.toContain(receipt.eventId)
    expect(JSON.stringify(result)).not.toContain(budget.event.rationale)
    expect(f.memoryWork.recalls - start).toBe(boundary)
    const movingClock = movingClockProof(f.clock, beforeClock, [...budget.sourceObservedAt, ...f.memoryWork.sourceObservedAt])
    expect(movingClock.distinctSourceObservations).toBe(boundary + 1)
    const persisted = await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1)
      const capture = object(object(object(object(state.atlas)[owner]).originals)[sources.budget.refDigest])
      return { commit: false, value: { digest: digestSfValue({ atlas: state.atlas, outbox: state.outbox }),
        budget: rows(snapshot.data.opexEntries)[0]!.budget, role: rows(snapshot.data.roleMap)[0]!.role, captureRefId: object(capture.ref).refId } }
    })
    expect(persisted.digest).toBe(changed.durableDigest)
    if (mutation === "source") expect(persisted.budget).toBe(300)
    if (mutation === "access") expect(persisted.role).toBe("viewer")
    if (mutation === "capture") expect(persisted.captureRefId).toBe(`${sources.budget.refId}:concurrent-change`)
    console.info("SF_ATLAS_RECALL_REGRESSION", JSON.stringify({ mutation, changedAfterProtectedRead: boundary,
      protectedReads: f.memoryWork.recalls - start, mutationCount: changed.count, result: result.status, persistedMutationPreserved: true, movingClock }))
  }, `recall-concurrent-${mutation}`)
}

test("C17 bounded recall rejects a persisted source change after its protected observation", async () => {
  expectSpawn(import.meta.path)
  await rejectConcurrentAtlasMutation("source")
}, 180000)

test("C17 bounded recall rejects withdrawn access after its protected observation", async () => {
  expectSpawn(import.meta.path)
  await rejectConcurrentAtlasMutation("access")
}, 180000)

test("C17 bounded recall rejects a corrupted capture after its protected egress read", async () => {
  expectSpawn(import.meta.path)
  await rejectConcurrentAtlasMutation("capture")
}, 180000)
