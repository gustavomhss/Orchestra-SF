import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../../../product/contracts/decisions.ts"
import { sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { preparePlannerMutation } from "../../../product/planner/prepared.ts"
import type { createC12Fixture } from "./fixture.ts"

type Fixture = Awaited<ReturnType<typeof createC12Fixture>>

/** Real Planner preparation, deliberately left pending. No Planner receipt is invented. */
export async function appendPendingPlannerChange(fixture: Fixture) {
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "c12-forecast", year: 2026, closed: 0,
      lines: [{ id: "c12-line", sec: "opex", el: "licenses", cur: "USD", b: [100] }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: true }
  })
  const call = await fixture.ui("sf_context_read", { purpose: "c12-partial-domain" })
  try {
    const issued = await fixture.business.plannerProduct.issueSource("c12-forecast", call)
    if (issued.status !== "ok") throw new Error("real Planner source failed: " + issued.reason)
    const snapshot = await fixture.persistence.transaction("planner", async (value) => ({ commit: false, value: structuredClone(value) }))
    const actor = { id: "alice", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const environment = { at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }
    const evidence = issued.value.evidence
    const target = { surface: "planner" as const, type: "planner-version", id: "c12-forecast", incarnation: evidence.target.incarnation,
      version: evidence.target.version, fields: evidence.target.fields, period: evidence.target.period!, observedAt: environment.at }
    const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      recordType: "planner-version", recordId: "c12-forecast", selector: sfPlannerProjectionSelector(snapshot, actor) }
    const produced = preparePlannerMutation({ snapshot, actor, environment, context: call, target, scope, evidence,
      command: { page: "OPEX", action: "save", id: "c12-line", version: 0, values: { versionId: "c12-forecast", f0: 42 } },
      operationId: "c12-foreign-planner", idempotencyKey: "c12-foreign-planner" })
    if (!produced) throw new Error("real Planner producer refused partial-state fixture")
    const current = await fixture.storedCase()
    const procurement = current.value.preparedChanges[0]
    if (!procurement?.receipt) throw new Error("partial state requires the original real Procurement receipt")
    const change: PreparedChange = { id: "c12-foreign-planner", caseId: current.value.id, caseVersion: current.value.version + 1,
      choiceId: procurement.choiceId, target, expectedVersion: 0, idempotencyKey: "c12-foreign-planner", requiredAuthority: ["planner:write"], state: "planned",
      operation: { id: "c12-foreign-planner", target, expectedVersion: 0, idempotencyKey: "c12-foreign-planner", command: produced.command,
        commandDigest: produced.mutation.commandDigest, requiredAuthority: ["planner:write"], preview: {
          context: { ...procurement.operation.preview.context, surface: "planner", period: target.period, sourceRefs: [target] },
          version: target.version, engineVersion: "planner-pending-fixture", components: [], values: [], missing: [{ field: "review", reason: "unconfirmed" }],
        } },
      preview: procurement.preview }
    const next: DecisionCase = { ...current.value, version: current.value.version + 1, state: "partially-applied", preparedChanges: [...current.value.preparedChanges, change] }
    const saved = await fixture.authority.state.transaction(fixture.request(), {
      namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: next.id, targetIncarnation: next.incarnation,
      idempotencyKey: randomUUID(), commandDigest: digestSfValue(next),
    }, async (state) => { state.cases[next.id] = next; return { commit: true, value: true } })
    if (saved.status !== "ok") throw new Error("partial state persistence failed: " + saved.status)
    return { request: { caseRef: { id: next.id, incarnation: next.incarnation, version: next.version }, choiceId: change.choiceId, changeId: change.id }, change }
  } finally { fixture.authority.ui.finish(call) }
}

