import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { available } from "./relations-fixture.ts"
import { createThreadHistoryFixture } from "./thread-history-fixture.ts"

test("record history and replies retain an independently authorized immutable document supplement", async () => {
  const document: Extract<BusinessEvidenceRef, { kind: "document" }> = { schema: "sf-evidence-v1", refId: "historical-document", installationId: "installation", projectId: "project", refDigest: "", kind: "document", evidenceLevel: "observed", target: { documentId: "doc", incarnation: "doc-inc", revision: 1, blobDigest: { algorithm: "sha256", value: "a".repeat(64) }, segment: { start: 0, end: 12, unit: "utf16", textDigest: { algorithm: "sha256", value: "b".repeat(64) } } } }
  document.refDigest = digestSfEvidenceRef(document)
  const access = { allowed: true }
  // The document authority is an explicit injected boundary; Dashboard, BCS, state and thread consumers are actual implementations.
  const fixture = await createThreadHistoryFixture({ supplement: { reference: document, authorized: () => access.allowed } })
  try {
    const source = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
    await fixture.capture(source)
    const port = fixture.collaboration
    if (!port.recipientThread || !port.recipientActions || !port.threadHistory) throw new Error("thread consumers unavailable")
    const version = async () => available(await port.storageVersion("threads", fixture.read))
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: fixture.period, recipientRef: fixture.person.id, body: "Read the original document with this project.", evidenceRefs: [source, document] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "supplement-thread" }
    const created = available(await port.threads.create(draft, mutation, await fixture.admit("collaboration.thread.create", { draft, mutation })))
    const current = available(await port.recipientThread(created.id, fixture.read))
    expect(current.current.evidenceRefs[0]).toMatchObject({ kind: "record", target: { recordType: "projects", recordId: "project", fields: source.target.fields, period: source.target.period, projectionDigest: source.target.projectionDigest } })
    expect(current.current.evidenceRefs[1]).toEqual(document)
    expect(current.historical?.evidenceRefs).toEqual([source, document])
    const before = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    expect((await port.threadReads.readHistorical(created.id, fixture.read)).status).not.toBe("ok")
    fixture.historical.allowed = true
    const historical = available(await port.threadReads.readHistorical(created.id, fixture.read))
    expect(historical.evidenceRefs).toEqual([source, document])
    const body = "The attached original remains the basis of this answer."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "supplement-reply" }
    const reply = available(await port.recipientActions.reply(created.id, body, replyMutation, await fixture.admit("collaboration.thread.reply", { id: created.id, body, mutation: replyMutation })))
    expect(reply.messages[1]!.sourceContext?.evidenceRefs[1]).toEqual(document)
    expect(reply.current.evidenceRefs[1]).toEqual(document)
    expect(reply.current.sourceRef.target.version).toBeGreaterThan(source.target.version)
    const message = reply.messages[1]!
    expect(available(await port.threadHistory.readVersion(created.id, message.id, message.incarnation, 1, fixture.read)).evidenceRefs[1]).toEqual(document)
    access.allowed = false
    const revoked = await port.threadReads.readHistorical(created.id, fixture.read)
    expect(revoked.status).not.toBe("ok")
    expect(JSON.stringify(revoked)).not.toContain(body)
    expect((await port.threadHistory.readVersion(created.id, message.id, message.incarnation, 1, fixture.read)).status).not.toBe("ok")
    access.allowed = true
    expect(available(await port.threadReads.readHistorical(created.id, fixture.read)).evidenceRefs[1]).toEqual(document)
    const original = structuredClone(document)
    document.target.revision = 2
    document.refDigest = digestSfEvidenceRef(document)
    expect((await port.threadReads.readHistorical(created.id, fixture.read)).status).not.toBe("ok")
    expect(historical.evidenceRefs[1]).toEqual(original)
  } finally {
    await fixture.dispose()
  }
})
