import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { enqueueSfLedgerEvent } from "../../../product/integration/ledger-outbox.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent, CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import type { DocumentFixture } from "./fixture-assertions.ts"

/** Classification of this documentary case is an explicit synthetic premise,
 * as in the original WP14 ranking fixture. It declares no scenario, calculation,
 * result or financial capture. All references are the actual confirmed documents.
 * Optional event B has the same accepted-ledger premise as fixture40; C08/outbox,
 * publication, capture, scanner and every later authorization remain real. */
export async function prepareDocumentRankCase(fixture: DocumentFixture, publishSecond: boolean) {
  const sourceRefs = fixture.sources.map((source) => source.ref)
  const basis: CostCoverageBasis = { id: `m69-document-classification:${randomUUID()}`, version: 1,
    decisionType: "supplier-document-review", categoryIds: [], additionalCategoryIds: [], sourceRefs }
  const eventRef = await fixture.ui("sf_case_read", { caseRef: encodeCaseRef(fixture.caseRef) }, async (call) => {
    const request = fixture.authority.host.requestFor(call)
    if (!request || !await fixture.authority.host.revalidate(call)) throw new Error("Actual rank premise authority unavailable")
    const cases = await fixture.authority.state.read(request, "cases", (state) => state.cases[fixture.caseRef.id])
    const outbox = await fixture.authority.state.read(request, "outbox", (state) => state.versions.outbox)
    if (cases.status !== "ok" || !cases.value || outbox.status !== "ok" || cases.value.costCoverageBases.length)
      throw new Error("Actual rank premise storage changed")
    const before = cases.value
    const version = before.version + 1
    const event: CaseLedgerEvent | undefined = publishSecond ? {
      id: randomUUID(), caseRef: { ...fixture.caseRef, version }, kind: "analysis-accepted",
      principalRef: call.binding.principalRef, at: fixture.app.at,
      consideredActions: ["Review the same confirmed supplier documents again"], factualGaps: [],
      lifecycleState: "investigating", rationale: "The second accepted documentary review retains the confirmed supplier prices.",
      evidenceRefs: sourceRefs, outputDigest: digestSfValue({ premise: "M69 accepted second documentary review", basis, sourceRefs }),
    } : undefined
    const saved = await fixture.authority.state.transaction<Extract<BusinessEvidenceRef, { kind: "case-event" }> | undefined>(request, {
      namespace: "cases", expectedStorageVersion: cases.storageVersion,
      additionalNamespaces: publishSecond ? [{ namespace: "outbox", expectedStorageVersion: outbox.storageVersion }] : [],
      targetRef: encodeCaseRef(fixture.caseRef), targetIncarnation: fixture.caseRef.incarnation,
      idempotencyKey: `m69-document-rank:${basis.id}`, commandDigest: digestSfValue({ basis, event }),
    }, async (state, actor) => {
      const value = state.cases[fixture.caseRef.id]
      if (!value || value.incarnation !== fixture.caseRef.incarnation || digestSfValue(value) !== digestSfValue(before) ||
        !value.participants.includes(actor.principalRef) || actor.principalRef !== call.binding.principalRef ||
        actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion)
        throw new Error("Actual rank premise changed before commit")
      state.cases[value.id] = { ...value, version, costCoverageBases: [basis],
        ledger: event ? [...value.ledger, event] : value.ledger }
      if (!event) return { commit: true, value: undefined }
      const queued = enqueueSfLedgerEvent(state, event, {
        installationId: call.binding.installationId, projectId: call.binding.projectId, authority: actor,
      })
      if (queued.status !== "ok") throw new Error(queued.reason)
      return { commit: true, value: queued.value.eventRef }
    })
    if (saved.status !== "ok") throw new Error("Actual documentary rank premise commit failed")
    return saved.value
  })
  if (!publishSecond) {
    if (eventRef) throw new Error("Classification unexpectedly enqueued another event")
    return undefined
  }
  if (!eventRef) throw new Error("Actual second documentary event was not enqueued")
  const receipt = await fixture.ui("sf_evidence_get", { evidenceRef: eventRef },
    (call) => fixture.memory.emitFromLedger(eventRef, call), new Request(`${fixture.app.origin}/sucafina/dashboard`, {
      method: "POST", headers: { cookie: fixture.app.cookie, origin: fixture.app.origin,
        "Idempotency-Key": `m69-rank-publish:${eventRef.target.eventId}` },
    }))
  if (receipt.status !== "committed" || !receipt.eventId || !receipt.recordDigest || receipt.scanner.status !== "clean")
    throw new Error(`Actual second documentary publication failed: ${receipt.reason ?? receipt.status}`)
  return { eventRef, receipt }
}
