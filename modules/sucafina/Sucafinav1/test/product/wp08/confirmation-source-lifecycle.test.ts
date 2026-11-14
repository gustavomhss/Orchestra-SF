import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { rows } from "../../../runtime/contract.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import type { DashboardConfirmationObservation } from "../../../product/dashboard/confirmation.ts"
import { createConfirmationObservationReceipts } from "../../../product/collaboration/confirmation-observations.ts"
import { createConfirmationPort } from "../../../product/collaboration/confirmation.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

function confirmation(fixture: Awaited<ReturnType<typeof createRelationsFixture>>) {
  const observer = createDashboardConfirmationObserver({ host: fixture.host, scopedSources: fixture.persistence, readProjection: (selection, context) => fixture.records.read(selection.reference, context) })
  const receipts = createConfirmationObservationReceipts({ host: fixture.host, observe: observer.observe, now: () => Date.parse("2026-11-13T00:00:00Z") })
  const port = createConfirmationPort<Extract<DashboardConfirmationObservation, { state: "available" }>>({ host: fixture.host, state: fixture.state, human: fixture.human, creationTarget: fixture.creationTarget, observe: observer.observe, fence: async (scope, observation, context) => await observer.fenceManifest(scope, context) && await observer.fence(scope, observation, context), verifyObserved: receipts.verifyObserved, createId: randomUUID, now: () => "2026-11-13T00:00:00Z" })
  return { receipts, port }
}

test("real monthly producer keeps an independent January confirmation valid and invalidates its declared February dependency", async () => {
  const fixture = await createRelationsFixture()
  try {
    await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save-entry", version: 0, values: { projId: "capex", year: 2026, month: 1, budget: 10, actual: 0, forecast: 0 } }, "capex-jan")
    await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save-entry", version: 0, values: { projId: "capex", year: 2026, month: 2, budget: 20, actual: 20, forecast: 0 } }, "capex-feb")
    const january = { start: "2026-01-01", end: "2026-01-31" }
    const february = { start: "2026-02-01", end: "2026-02-28" }
    const jan = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexEntries", recordId: "capex-jan", fields: ["actual"], period: january }, fixture.read))
    const feb = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexEntries", recordId: "capex-feb", fields: ["actual"], period: february }, fixture.read))
    const dependency = available(await fixture.records.read(feb.refId, fixture.read)).context.sourceRefs[0]!
    const scope: ConfirmationScope = { sourceRef: { surface: "dashboard", type: "capexEntries", id: "capex-jan", incarnation: jan.target.incarnation }, fields: ["actual"], period: january, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
    const dependent = { ...scope, materialDependencies: [dependency] }
    const { port, receipts } = confirmation(fixture)
    const displayed = available(await receipts.prepare(scope, fixture.read))
    const command = { scope, observedSourceVersion: displayed.sourceVersion, expectedScopeFingerprint: displayed.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "confirm-independent-month" }
    const first = available(await port.confirm(command, await fixture.admit("collaboration.confirmation.confirm", command)))
    const dependentDisplayed = available(await receipts.prepare(dependent, fixture.read))
    const dependentCommand = { scope: dependent, observedSourceVersion: dependentDisplayed.sourceVersion, expectedScopeFingerprint: dependentDisplayed.scopeFingerprint, expectedStorageVersion: 1, idempotencyKey: "confirm-dependent-month" }
    const second = available(await port.confirm(dependentCommand, await fixture.admit("collaboration.confirmation.confirm", dependentCommand)))
    expect(first.id).not.toBe(second.id)
    expect(second.scope.materialDependencies).toEqual([dependency])
    const before = await fixture.snapshots()
    const januaryProjection = available(await fixture.records.read(jan.refId, fixture.read))
    await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save-entry", id: "capex-feb", version: before.dashboard.versions["capexEntries:capex-feb"]!.version, values: { year: 2026, month: 2, actual: 30 } })
    const after = await fixture.snapshots()
    expect(available(await fixture.records.read(jan.refId, fixture.read))).toEqual(januaryProjection)
    expect(await port.readScope(scope, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: first.id, state: "valid", reason: "unchanged-scope" } })
    expect(await port.readScope(dependent, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: second.id, state: "stale", reason: "dependency-change" } })
    expect(await port.readScope(dependent, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: second.id, state: "stale", reason: "dependency-change" } })
    expect(available(await port.confirm(command, await fixture.admit("collaboration.confirmation.confirm", command)))).toEqual(first)
    expect(await port.find(scope, fixture.read)).toEqual({ status: "ok", value: { confirmationIds: [first.id] } })
    expect(await port.find(dependent, fixture.read)).toEqual({ status: "ok", value: { confirmationIds: [second.id] } })
    expect(await fixture.snapshots()).toEqual(after)
    const records = await fixture.state.read(fixture.request(), "confirmations", (state) => state.confirmations)
    if (records.status !== "ok") throw new Error("confirmation audit unavailable")
    expect(Object.values(records.value)).toHaveLength(2)
    expect(records.value[first.id]).toMatchObject(first)
    expect(records.value[second.id]).toMatchObject(second)
  } finally {
    await fixture.dispose()
  }
})

test("real confirmation reevaluates restored access and cannot inherit validity after physical source replacement", async () => {
  const fixture = await createRelationsFixture()
  try {
    const original = available(await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
    const scope: ConfirmationScope = { sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: original.target.incarnation }, fields: ["name", "status"], period: fixture.period, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
    const { port, receipts } = confirmation(fixture)
    const displayed = available(await receipts.prepare(scope, fixture.read))
    const command = { scope, observedSourceVersion: displayed.sourceVersion, expectedScopeFingerprint: displayed.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "confirm-physical-source" }
    const confirmed = available(await port.confirm(command, await fixture.admit("collaboration.confirmation.confirm", command)))
    fixture.gate.dashboard = false
    const revoked = available(await port.project(confirmed.id, fixture.read))
    expect(revoked).toMatchObject({ state: "unavailable", reason: "access-unavailable" })
    expect(revoked).not.toHaveProperty("scopeFingerprint")
    expect(JSON.stringify(revoked)).not.toContain("Shared project")
    expect(await port.readScope(scope, fixture.read)).toEqual({ status: "unavailable", reason: "confirmation-scope-unavailable" })
    fixture.gate.dashboard = true
    expect(await port.readScope(scope, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: confirmed.id, state: "valid" } })
    const before = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: {} })
    expect((available(await port.project(confirmed.id, fixture.read))).state).not.toBe("valid")
    const deleted = await fixture.snapshots()
    // Deliberately injected identity-reuse attack; valid domain commands refuse tombstoned IDs.
    // The real source lifecycle must assign a new physical incarnation even when all values match.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [...rows(snapshot.data.projects), structuredClone(rows(before.dashboard.data.projects).find((row) => row.id === "project")!)]
      return { commit: true, value: undefined }
    })
    const replacement = available(await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
    expect(replacement.target.projectionDigest).toBe(original.target.projectionDigest)
    expect(replacement.target.incarnation).not.toBe(original.target.incarnation)
    // The source lifecycle rotates the existing scope entry on replacement; it does not
    // retain the old incarnation. Without that continuity witness the observer must
    // remain unavailable, not label the old reference fresh or infer a replacement.
    const replacementState = await fixture.snapshots()
    expect(Object.values(replacementState.dashboard.sfSources?.scopes ?? {}).some((entry) => entry.incarnation === original.target.incarnation)).toBe(false)
    expect(await port.project(confirmed.id, fixture.read)).toMatchObject({ status: "ok", value: { state: "unavailable", reason: "access-unavailable" } })
    fixture.gate.dashboard = false
    expect(await port.project(confirmed.id, fixture.read)).toMatchObject({ status: "ok", value: { state: "unavailable" } })
    fixture.gate.dashboard = true
    expect(await port.project(confirmed.id, fixture.read)).toMatchObject({ status: "ok", value: { state: "unavailable", reason: "access-unavailable" } })
    const replacementScope = { ...scope, sourceRef: { ...scope.sourceRef, incarnation: replacement.target.incarnation } }
    expect(await port.readScope(replacementScope, fixture.read)).toEqual({ status: "ok", value: null })
    const newDisplay = available(await receipts.prepare(replacementScope, fixture.read))
    const newCommand = { scope: replacementScope, observedSourceVersion: newDisplay.sourceVersion, expectedScopeFingerprint: newDisplay.scopeFingerprint, expectedStorageVersion: 1, idempotencyKey: "explicit-confirmation-of-new-physical-source" }
    const renewed = available(await port.confirm(newCommand, await fixture.admit("collaboration.confirmation.confirm", newCommand)))
    expect(renewed.id).not.toBe(confirmed.id)
    expect(renewed.auditRef).not.toBe(confirmed.auditRef)
    expect(await port.readScope(replacementScope, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: renewed.id, state: "valid" } })
    const old = available(await port.project(confirmed.id, fixture.read))
    expect(old).toMatchObject({ state: "unavailable", reason: "access-unavailable" })
    expect(old).not.toHaveProperty("scopeFingerprint")
    expect(JSON.stringify(old)).not.toContain(replacement.refId)
    const preserved = await fixture.state.read(fixture.request(), "confirmations", (state) => state.confirmations[confirmed.id])
    if (preserved.status !== "ok") throw new Error("confirmation audit unavailable")
    expect(preserved.value).toMatchObject(confirmed)
    const after = await fixture.snapshots()
    expect(after.procurement).toEqual(deleted.procurement)
    expect(after.planner).toEqual(deleted.planner)
  } finally {
    await fixture.dispose()
  }
})
