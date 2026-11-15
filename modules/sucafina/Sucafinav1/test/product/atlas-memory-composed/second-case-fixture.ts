import { randomUUID } from "node:crypto"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { enqueueSfLedgerEvent } from "../../../product/integration/ledger-outbox.ts"
import type { CaseLedgerEvent } from "../../../product/contracts/decisions.ts"
import type { DocumentFixture } from "./fixture-assertions.ts"

/** Extend the real fixture40 store with another real draft/publication. Only
 * acceptance of its ledger event is a declared synthetic premise, as in40. */
export async function publishSecondDocumentCase(fixture: DocumentFixture) {
  const host = fixture.authority.host
  const cases = createDecisionCasePort({
    state: fixture.authority.state, host, creationTarget: fixture.authority.creationTarget,
    operationIdentity: (call) => call.kind === "ui" ? fixture.authority.ui.operationIdentity(call) : undefined,
    authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call),
    // This private helper uses only draft. It grants no scenario-reader access;
    // every later recall uses the actual assembled services of fixture40.
    verifyScenarioOperations: async () => false,
    evidence: fixture.atlas.context, createId: randomUUID, now: () => fixture.app.at,
  })
  const sourceRefs = fixture.sources.map((source) => source.ref)
  const draft = { objective: "Review the same confirmed prices in an independent case",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD",
    criteria: ["Use the confirmed supplier documents"], sourceRefs }
  const drafted = await fixture.ui("sf_case_draft", draft, (call) => cases.draft(draft, call))
  if (drafted.status !== "ok") throw new Error(`Second actual case draft failed: ${drafted.reason}`)
  const caseRef = { id: drafted.value.id, incarnation: drafted.value.incarnation }
  const event: CaseLedgerEvent = {
    id: randomUUID(), caseRef: { ...caseRef, version: drafted.value.version + 1 }, kind: "analysis-accepted",
    principalRef: fixture.app.principal.id, at: fixture.app.at,
    consideredActions: ["Review the same confirmed supplier prices independently"], factualGaps: [],
    lifecycleState: "investigating", rationale: "Second accepted case uses the actual confirmed supplier documents.",
    evidenceRefs: sourceRefs, outputDigest: digestSfValue({ premise: "M69 second accepted document review", caseRef, sourceRefs }),
  }
  const eventRef = await fixture.ui("sf_case_read", { caseRef: encodeCaseRef(caseRef) }, async (call) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call)) throw new Error("Second actual ledger authority unavailable")
    const current = await fixture.authority.state.read(request, "cases", (state) => state.cases[caseRef.id])
    const outbox = await fixture.authority.state.read(request, "outbox", (state) => state.versions.outbox)
    if (current.status !== "ok" || !current.value || outbox.status !== "ok") throw new Error("Second actual ledger storage unavailable")
    const saved = await fixture.authority.state.transaction(request, {
      namespace: "cases", expectedStorageVersion: current.storageVersion,
      additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox.storageVersion }],
      targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation,
      idempotencyKey: `m69-accepted-document:${event.id}`, commandDigest: digestSfValue(event),
    }, async (state, actor) => {
      const value = state.cases[caseRef.id]
      if (!value || value.incarnation !== caseRef.incarnation || value.version !== drafted.value.version ||
        !value.participants.includes(actor.principalRef) || actor.principalRef !== call.binding.principalRef ||
        actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion)
        throw new Error("Second actual ledger premise changed")
      state.cases[value.id] = { ...value, version: event.caseRef.version, state: "investigating", ledger: [...value.ledger, event] }
      const queued = enqueueSfLedgerEvent(state, event, {
        installationId: call.binding.installationId, projectId: call.binding.projectId, authority: actor,
      })
      if (queued.status !== "ok") throw new Error(queued.reason)
      return { commit: true, value: queued.value.eventRef }
    })
    if (saved.status !== "ok") throw new Error("Second actual ledger/outbox commit failed")
    return saved.value
  })
  const replayKey = `m69-second-replay:${event.id}`
  const replay = () => fixture.ui("sf_evidence_get", { evidenceRef: eventRef },
    (call) => fixture.memory.emitFromLedger(eventRef, call), new Request(`${fixture.app.origin}/sucafina/dashboard`, {
      method: "POST", headers: { cookie: fixture.app.cookie, origin: fixture.app.origin, "Idempotency-Key": replayKey },
    }))
  const receipt = await replay()
  if (receipt.status !== "committed" || !receipt.eventId || !receipt.recordDigest || receipt.scanner.status !== "clean")
    throw new Error(`Second actual Atlas publication failed: ${receipt.reason ?? receipt.status}`)
  return { caseRef, eventRef, receipt, replay }
}
