import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { NO_SCANNER_NAME } from "@orchestra/atlas-boundary/native-memory"
import { atlasDay, atlasPeriod, atlasValue, withAtlasConsumer } from "./atlas-consumer-fixture.ts"
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

test("C17 consumes Dashboard observations through real Atlas and reauthorizes durable recall after source and access changes", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const observed = await f.call("sf_evidence_get", { evidenceRef: sources.budget }, async (context) => ({
      budget: await f.runtime.current.business.context.resolve(sources.budget, context),
      topic: await f.runtime.current.business.context.resolve(sources.topic, context),
    }))
    expect(observed.budget.checkedAt).toBe(f.clock.at)
    expect(observed.topic.checkedAt).toBe(f.clock.at)
    expect(projection(observed.budget).components.reduce((sum, value) => sum + (value.amount ?? 0), 0)).toBe(1300)
    expect(projection(observed.budget).values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 0, evidenceState: "confirmed" }))
    expect(projection(observed.budget).values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:actual", value: null, evidenceState: "absent" }))
    expect(projection(observed.topic).values.map((value) => value.value)).toEqual(["open"])
    expect(projection(observed.topic).context.period).toEqual(atlasDay)
    expect(JSON.stringify(observed)).not.toContain("Private action wording")
    expect(JSON.stringify(observed)).not.toContain("Private notes")

    const altered = { ...sources.topic, target: { ...sources.topic.target, fields: ["status", "notes"] }, refDigest: "" }
    const forged = { ...altered, refDigest: digestSfEvidenceRef(altered) }
    const rejected = await f.dispatch("sf_evidence_get", { evidenceRef: forged })
    expect(rejected.status).toBe("unavailable")
    expect(JSON.stringify(rejected)).not.toContain("Private notes")

    const budget = await f.ledger([sources.budget], "The effective monthly budget remains traceable to its observed components.")
    const topic = await f.ledger([sources.topic], "The action remains open; only its status was authorized for this review.")
    const budgetReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context))
    const topicReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(topic.eventRef, context))
    expect(budgetReceipt.status).toBe("committed")
    expect(topicReceipt.status).toBe("committed")
    expect(budgetReceipt.scanner).toEqual({ name: "gitleaks", version: f.scanner.version, status: "clean" })
    expect(topicReceipt.scanner).toEqual(budgetReceipt.scanner)
    if (!budgetReceipt.eventId || !budgetReceipt.recordDigest || !topicReceipt.eventId) throw new Error("Atlas did not issue durable write receipts")

    const recalled = await f.call("sf_decision_recall", { selectionRefs: [encodeCaseRef(budget.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5 },
      (context) => f.runtime.current.business.context.recall({ caseRefs: [budget.caseRef], query: "budget" }, context))
    expect(recalled).toHaveLength(1)
    const record = recalled[0]!
    const authorizedCase = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, async (context) => atlasValue(await f.runtime.current.business.cases.read({ caseRef: encodeCaseRef(budget.caseRef) }, context)))
    expect(record.envelope.owner).toBe(deriveSfMemoryOwner(authorizedCase.context, authorizedCase.case))
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

    const request = { selectionRefs: [encodeCaseRef(budget.caseRef)], similarityCriteria: ["decision-type"], period: atlasPeriod, limit: 5 }
    const ranked = await f.dispatch("sf_decision_recall", request)
    expect(ranked.status).toBe("ok")
    if (ranked.status !== "ok") throw new Error("Real Atlas capability did not consume the stored record")
    const output = decodeSfOperationOutput("sf_decision_recall", ranked.result)
    if (!output.ok) throw new Error("Recall output did not match the closed production schema")
    expect(output.value.matches).toHaveLength(1)
    expect(output.value.matches[0]?.memoryRecordRef).toBe(record.envelope.eventId)
    expect(output.value.matches[0]?.caseRef).toEqual(budget.caseRef)
    expect(output.value.matches[0]?.explanation.sourceStates.every((state) => state === "fresh")).toBe(true)
    expect(ranked.receipt.kind).toBe("ui")
    expect((await f.dispatch("sf_decision_recall", { ...request, owner: record.envelope.owner })).status).toBe("needs-input")
    expect((await f.dispatch("sf_decision_recall", { ...request, owner: f.actors[1] })).status).toBe("needs-input")
    const other = await f.dispatch("sf_decision_recall", request, f.actors[1])
    expect(other.status).toBe("unavailable")
    expect(JSON.stringify(other)).not.toContain(budget.event.rationale)
    expect(JSON.stringify(other)).not.toContain(record.envelope.eventId)

    const beforeRetry = await f.inspect()
    expect(beforeRetry.entries).toBe(2)
    const retry = await f.call("sf_case_read", { caseRef: encodeCaseRef(budget.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(budget.eventRef, context))
    expect(retry).toEqual({ ...budgetReceipt, status: "already-committed" })
    expect(await f.inspect()).toEqual(beforeRetry)
    f.clock.at = "2026-11-13T10:00:00Z"
    await f.reopen()
    const durable = await f.call("sf_decision_recall", request, (context) => f.runtime.current.business.context.recall({ caseRefs: [budget.caseRef], query: "budget" }, context))
    expect(durable.map(({ envelope, entry }) => ({ envelope, entry }))).toEqual(recalled.map(({ envelope, entry }) => ({ envelope, entry })))
    const refreshed = await f.call("sf_evidence_get", { evidenceRef: sources.budget }, (context) => f.runtime.current.business.context.resolve(sources.budget, context))
    expect(refreshed.state).toBe("fresh")
    expect(refreshed.currentRef).toEqual(sources.budget)
    expect(refreshed.checkedAt).toBe(f.clock.at)
    expect(refreshed.checkedAt).not.toBe(observed.budget.checkedAt)
    expect(await f.inspect()).toEqual(beforeRetry)

    await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => { rows(snapshot.data.opexEntries)[0]!.budget = 300; return { commit: true, value: undefined } })
    expect((await f.dispatch("sf_evidence_get", { evidenceRef: sources.budget })).status).toBe("unavailable")
    await expect(f.call("sf_decision_recall", request, (context) => f.runtime.current.business.context.recall({ caseRefs: [budget.caseRef], query: "budget" }, context))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    const unaffected = await f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [topic.caseRef], query: "action" }, context))
    expect(unaffected).toHaveLength(1)
    expect(unaffected[0]?.envelope.eventId).toBe(topicReceipt.eventId)
    expect(await f.inspect()).toEqual(beforeRetry)

    await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    expect((await f.dispatch("sf_evidence_get", { evidenceRef: sources.topic })).status).toBe("unavailable")
    await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ id: "topic", action: "Replacement wording", status: "open" }]; return { commit: true, value: undefined } })
    const replaced = await f.sources()
    expect(replaced.topic.target.incarnation).not.toBe(sources.topic.target.incarnation)
    expect(replaced.topic.refId).not.toBe(sources.topic.refId)
    await expect(f.call("sf_case_read", { caseRef: encodeCaseRef(topic.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [topic.caseRef], query: "action" }, context))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    expect(await f.inspect()).toEqual(beforeRetry)

    const current = await f.ledger([replaced.topic], "The replacement action has its own current observation.")
    const currentReceipt = await f.call("sf_case_read", { caseRef: encodeCaseRef(current.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(current.eventRef, context))
    expect(currentReceipt.status).toBe("committed")
    await f.call("sf_evidence_get", { evidenceRef: replaced.topic }, async (context) => {
      await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.roleMap = [{ surface: "dashboard", role: "viewer", entra: "atlas-reviewers", version: 2, by: f.actors[0] }]
        return { commit: true, value: undefined }
      })
      expect((await f.runtime.current.business.context.resolve(replaced.topic, context)).state).toBe("unavailable")
      await expect(f.runtime.current.business.context.recall({ caseRefs: [current.caseRef], query: "action" }, context)).rejects.toThrow("SF_MEMORY_AUTHORITY_UNAVAILABLE")
    })
    expect((await f.dispatch("sf_evidence_get", { evidenceRef: replaced.topic })).status).toBe("unavailable")
    expect((await f.dispatch("sf_decision_recall", { ...request, selectionRefs: [encodeCaseRef(current.caseRef)] })).status).toBe("unavailable")
    console.info("SF_ATLAS_DASHBOARD_CONSUMER", JSON.stringify({ boundaryModule: import.meta.resolve("@orchestra/atlas-boundary/business-memory-ports"),
      scanner: { ...f.scannerRelease, observedVersion: f.scanner.version }, write: budgetReceipt, recalledEventId: record.envelope.eventId,
      sourceVersions: record.envelope.sourceVersions, sourceIncarnations: record.envelope.sourceIncarnations, durableReopen: true,
      changedSource: "unavailable", replacedIdentity: "unavailable", revokedAuthority: "unavailable" }))
  })
}, 180000)

test("C17 real scanner and Atlas transactions reject unsafe content and reconcile precommit failure and a lost committed reply", async () => {
  expectSpawn(import.meta.path)
  await withAtlasConsumer(async (f) => {
    const sources = await f.sources()
    const normal = await f.ledger([sources.budget], "The reviewer retained only the observed budget components.")
    const payload = { caseRef: encodeCaseRef(normal.caseRef) }
    const initial = await f.inspect()
    f.runtime.current.configureScanner(undefined)
    const absent = await f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context))
    expect(absent).toMatchObject({ status: "unavailable", scanner: { name: NO_SCANNER_NAME, status: "unavailable" } })
    expect(await f.inspect()).toEqual(initial)
    expect(initial.outbox[normal.key]?.state).toBe("pending")
    f.runtime.current.configureScanner(f.scanner)
    f.fault.stage = "before-commit"
    const interrupted = await f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context))
    expect(interrupted).toMatchObject({ status: "unavailable", reason: "commit-unavailable" })
    expect(f.fault.trips).toBe(1)
    expect(await f.inspect()).toEqual(initial)
    const committed = await f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.emitFromLedger(normal.eventRef, context))
    expect(committed.status).toBe("committed")
    expect((await f.inspect()).entries).toBe(1)

    const second = await f.ledger([sources.budget], "A later accepted observation remains independent of the first record.")
    f.fault.stage = "after-commit"
    const lost = await f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(second.eventRef, context))
    expect(lost).toMatchObject({ status: "unavailable", reason: "commit-unavailable" })
    expect(f.fault.trips).toBe(2)
    const settled = await f.inspect(), item = settled.outbox[second.key]
    expect(settled.entries).toBe(2)
    if (!item || item.state !== "settled") throw new Error("Real commit did not settle its outbox")
    expect(item.receipt.status).toBe("committed")
    await f.reopen()
    const retry = await f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(second.eventRef, context))
    expect(retry).toEqual({ ...item.receipt, status: "already-committed" })
    expect(await f.inspect()).toEqual(settled)
    const read = await f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [second.caseRef], query: "review" }, context))
    expect(read).toHaveLength(1)
    expect(read[0]?.envelope.eventId).toBe(item.receipt.eventId)

    // Deliberately synthetic token-shaped text, checked against the pinned release's github-pat rule.
    const unsafe = await f.ledger([sources.budget], "The proposed note contains a synthetic scanner control: " + "ghp_" + "0123456789abcdefghijklmnopqrstuvwxyz")
    const beforeHit = await f.inspect()
    const hit = await f.call("sf_case_read", { caseRef: encodeCaseRef(unsafe.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(unsafe.eventRef, context))
    expect(hit).toMatchObject({ status: "refused", sourceEventId: unsafe.event.id, reason: "scanner-blocked", scanner: { name: "gitleaks", version: f.scanner.version, status: "hit" } })
    const afterHit = await f.inspect()
    expect(afterHit.entries).toBe(beforeHit.entries)
    expect(afterHit.atlasDigest).toBe(beforeHit.atlasDigest)
    expect(afterHit.outbox[unsafe.key]).toMatchObject({ state: "settled", receipt: hit })
    expect(await f.call("sf_case_read", { caseRef: encodeCaseRef(unsafe.caseRef) }, (context) => f.runtime.current.business.context.emitFromLedger(unsafe.eventRef, context))).toEqual(hit)
    expect(await f.inspect()).toEqual(afterHit)

    const clean = { owner: "atlas-timeout-control", kind: "task" as const, entry: { taskId: "timeout", attempted: [], failedWith: [], stoppedAt: "review", lesson: "Review current observations. ".repeat(50000) } }
    expect(createSfAtlasScanner({ scanners: [f.scanner.spec], timeoutMs: 20000 }).scan(clean)).toBe(false)
    expect(() => createSfAtlasScanner({ scanners: [f.scanner.spec], timeoutMs: 1 }).scan(clean)).toThrow("scanner unavailable")

    // A valid capture in another case cannot rescue this case's corrupted protected original.
    await f.runtime.current.persistence.transaction("dashboard", async (snapshot) => {
      const atlas = object(object(snapshot.data.__sfProductV1).atlas)
      const originals = object(object(atlas[read[0]!.envelope.owner]).originals)
      const capture = object(originals[sources.budget.refDigest])
      if (digestSfValue(capture.ref) !== digestSfValue(sources.budget)) throw new Error("Protected original was not the real Dashboard reference")
      originals[sources.budget.refDigest] = { ...capture, ref: { ...object(capture.ref), refId: `${sources.budget.refId}:altered` } }
      return { commit: true, value: undefined }
    })
    await expect(f.call("sf_case_read", { caseRef: encodeCaseRef(second.caseRef) }, (context) => f.runtime.current.business.context.recall({ caseRefs: [second.caseRef], query: "review" }, context))).rejects.toThrow("SF_MEMORY_READ_UNAVAILABLE")
    const healthy = await f.call("sf_case_read", payload, (context) => f.runtime.current.business.context.recall({ caseRefs: [normal.caseRef], query: "review" }, context))
    expect(healthy).toHaveLength(1)
    expect(healthy[0]?.envelope.eventId).toBe(committed.eventId)
    console.info("SF_ATLAS_DASHBOARD_FAILURES", JSON.stringify({ observedScannerVersion: f.scanner.version, archiveSha256: f.scannerRelease.sha256,
      beforeCommit: interrupted.status, afterCommit: lost.status, reconciled: retry, scannerAbsent: absent.status, scannerHit: hit.status, scannerTimeout: "unavailable", storageFaults: f.fault.trips }))
  })
}, 180000)
