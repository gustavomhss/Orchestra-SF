import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { object } from "../../../runtime/contract.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import type { DashboardConfirmationObservation } from "../../../product/dashboard/confirmation.ts"
import { createConfirmationPort } from "../../../product/collaboration/confirmation.ts"
import { createConfirmationObservationReceipts } from "../../../product/collaboration/confirmation-observations.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

test("real Dashboard dependencies preserve an irrelevant edit and invalidate compensating input changes and a pending confirmation", async () => {
  const fixture = await createRelationsFixture()
  try {
    const issue = async (page: string, recordType: string, recordId: string, fields: readonly string[]) => available(await fixture.records.issue({ page, recordType, recordId, fields, period: fixture.period }, fixture.read))
    const source = await issue("Portfolio Dashboard", "projects", "project", ["name", "status"])
    const projectDependency = await issue("All Projects", "projects", "project", ["budget", "spent"])
    const capexDependency = await issue("CAPEX Projects", "capexProjects", "capex", ["budget", "name"])
    const projectSource = available(await fixture.records.read(projectDependency.refId, fixture.read)).context.sourceRefs[0]!
    const capexSource = available(await fixture.records.read(capexDependency.refId, fixture.read)).context.sourceRefs[0]!
    const scope: ConfirmationScope = { sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: source.target.incarnation }, fields: ["name", "status"], period: fixture.period, materialDependencies: [projectSource, capexSource], scopeDefinitionVersion: "dashboard-c06-v1" }
    const observer = createDashboardConfirmationObserver({ host: fixture.host, scopedSources: fixture.persistence, readProjection: (selection, context) => fixture.records.read(selection.reference, context) })
    const receipts = createConfirmationObservationReceipts({ host: fixture.host, observe: observer.observe, now: () => Date.parse("2026-11-13T00:00:00Z") })
    const port = createConfirmationPort<Extract<DashboardConfirmationObservation, { state: "available" }>>({ host: fixture.host, state: fixture.state, human: fixture.human, creationTarget: fixture.creationTarget, observe: observer.observe, fence: async (selected, observation, context) => await observer.fenceManifest(selected, context) && await observer.fence(selected, observation, context), verifyObserved: receipts.verifyObserved, createId: randomUUID, now: () => "2026-11-13T00:00:00Z" })
    const prepared = available(await receipts.prepare(scope, fixture.read))
    const before = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save", id: "capex", version: before.dashboard.versions["capexProjects:capex"]!.version, values: { notes: "Unselected explanatory note" } })
    const afterIrrelevant = await fixture.snapshots()
    const command = { scope, observedSourceVersion: prepared.sourceVersion, expectedScopeFingerprint: prepared.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "real-dependencies-confirm" }
    const confirmed = available(await port.confirm(command, await fixture.admit("collaboration.confirmation.confirm", command)))
    expect(confirmed.scope.materialDependencies).toEqual([projectSource, capexSource])
    expect(confirmed.observedSourceVersion).toBe(prepared.sourceVersion)
    const reordered = { ...scope, fields: [...scope.fields].reverse(), materialDependencies: [capexSource, projectSource].map((dependency) => ({ ...dependency, fields: [...dependency.fields].reverse() })) }
    expect(await port.readScope(reordered, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: confirmed.id, state: "valid", reason: "unchanged-scope" } })
    expect(await fixture.snapshots()).toEqual(afterIrrelevant)
    const pending = available(await receipts.prepare(scope, fixture.read))
    const concurrent = { ...command, observedSourceVersion: pending.sourceVersion, expectedScopeFingerprint: pending.scopeFingerprint, expectedStorageVersion: 1, idempotencyKey: "real-dependency-race" }
    const unchangedDraft = structuredClone(concurrent)
    const projectBefore = object((afterIrrelevant.dashboard.data.projects as unknown[])[0])
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: afterIrrelevant.dashboard.versions["projects:project"]!.version, values: { budget: Number(projectBefore.budget) + 10, spent: Number(projectBefore.spent) + 10 } })
    const afterMaterial = await fixture.snapshots()
    const projectAfter = object((afterMaterial.dashboard.data.projects as unknown[])[0])
    expect(Number(projectAfter.budget) - Number(projectAfter.spent)).toBe(Number(projectBefore.budget) - Number(projectBefore.spent))
    expect(await port.readScope(scope, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: confirmed.id, state: "stale", reason: "dependency-change" } })
    expect(await port.readScope(reordered, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: confirmed.id, state: "stale", reason: "dependency-change" } })
    const renewedDependency = await issue("All Projects", "projects", "project", ["budget", "spent"])
    const renewedSource = available(await fixture.records.read(renewedDependency.refId, fixture.read)).context.sourceRefs[0]!
    expect(renewedSource.version).toBeGreaterThan(projectSource.version)
    expect(renewedSource.incarnation).toBe(projectSource.incarnation)
    expect(await port.readScope({ ...scope, materialDependencies: [renewedSource, capexSource] }, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: confirmed.id, state: "stale", reason: "dependency-change" } })
    expect(await port.confirm(concurrent, await fixture.admit("collaboration.confirmation.confirm", concurrent))).toEqual({ status: "conflict", reason: "material-scope-changed" })
    expect(concurrent).toEqual(unchangedDraft)
    expect(await port.find(scope, fixture.read)).toEqual({ status: "ok", value: { confirmationIds: [confirmed.id] } })
    expect(await fixture.snapshots()).toEqual(afterMaterial)
    fixture.gate.dashboard = false
    expect(await port.readScope(scope, fixture.read)).toEqual({ status: "unavailable", reason: "confirmation-scope-unavailable" })
  } finally {
    await fixture.dispose()
  }
})

test("real record confirmation preserves absent versus observed zero and the source observation timestamp", async () => {
  const fixture = await createRelationsFixture()
  try {
    // Seed the domain's actual stored absence representation; the producer, observer and confirmation are real.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const project = object((snapshot.data.projects as unknown[])[0])
      project.start = null
      project.spent = 0
      return { commit: true, value: undefined }
    })
    const ref = available(await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["start", "spent"], period: fixture.period }, fixture.read))
    const before = await fixture.snapshots()
    const projection = available(await fixture.records.read(ref.refId, fixture.read))
    expect(projection.values).toMatchObject([{ id: "projects:project:spent", value: 0, evidenceState: "confirmed" }, { id: "projects:project:start", value: null, evidenceState: "absent" }])
    expect(projection.missing).toEqual([{ field: "projects:project:start", reason: "missing" }])
    expect(projection.context.sourceRefs[0]?.observedAt).toBe("2026-11-13T00:00:00.000Z")
    const scope: ConfirmationScope = { sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: ref.target.incarnation }, fields: ["start", "spent"], period: fixture.period, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
    const observer = createDashboardConfirmationObserver({ host: fixture.host, scopedSources: fixture.persistence, readProjection: (selection, context) => fixture.records.read(selection.reference, context) })
    const receipts = createConfirmationObservationReceipts({ host: fixture.host, observe: observer.observe, now: () => Date.parse("2026-11-13T00:00:00Z") })
    const prepared = available(await receipts.prepare(scope, fixture.read))
    const port = createConfirmationPort<Extract<DashboardConfirmationObservation, { state: "available" }>>({ host: fixture.host, state: fixture.state, human: fixture.human, creationTarget: fixture.creationTarget, observe: observer.observe, fence: async (selected, observation, context) => await observer.fenceManifest(selected, context) && await observer.fence(selected, observation, context), verifyObserved: receipts.verifyObserved, createId: randomUUID, now: () => "2026-11-13T00:00:00Z" })
    const command = { scope, observedSourceVersion: prepared.sourceVersion, expectedScopeFingerprint: prepared.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "absent-zero-confirm" }
    const confirmed = available(await port.confirm(command, await fixture.admit("collaboration.confirmation.confirm", command)))
    expect(await port.readScope(scope, fixture.read)).toMatchObject({ status: "ok", value: { confirmationId: confirmed.id, state: "valid" } })
    expect(available(await fixture.records.read(ref.refId, fixture.read))).toEqual(projection)
    expect(await fixture.snapshots()).toEqual(before)
  } finally {
    await fixture.dispose()
  }
})
