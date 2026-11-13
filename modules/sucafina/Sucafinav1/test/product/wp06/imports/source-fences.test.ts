import { expect, test } from "bun:test"
import { roleMap } from "../../../../runtime/admin.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { projectSfSourceScope } from "../../../../product/integration/source-projections.ts"
import { verifyDashboardImportTarget } from "../../../../product/imports/source-fences.ts"

const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", accessRevision: "a", policyVersion: "p", requestId: "r", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"

test("Dashboard import fence checks the authenticated scoped incarnation and projection", () => {
  const snapshot: Snapshot = { data: { members: [{ id: "m1", name: "Ana" }], leaders: [] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const scope = { principalRef: "admin", accessRevision: "a", policyVersion: "p", recordType: "dashboard-page", recordId: "Talent Review", selector: { page: "Talent Review", fields: ["members"], period, actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")) } }
  const projection = projectSfSourceScope("dashboard", snapshot, scope, at)
  expect(projection).toBeDefined()
  const digest = digestSfValue(projection)
  snapshot.sfSources = { schemaVersion: 1, records: { [JSON.stringify([scope.recordType, scope.recordId])]: { incarnation: "raw", version: 1, alive: true, inputDigest: digest } }, scopes: { [digestSfValue(scope)]: { scope, sourceIncarnation: "raw", incarnation: "scoped", version: 1, alive: true, inputDigest: digest } } }
  const target = { surface: "dashboard" as const, selectionRef: "sf-source:scoped:1", incarnation: "scoped", version: 1, options: { newVersion: false, removeMissing: false, preview: {} } }
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: target.selectionRef, refDigest: "ref", installationId: "i", projectId: "p", evidenceLevel: "observed" as const, target: { surface: "dashboard" as const, recordType: scope.recordType, recordId: scope.recordId, incarnation: target.incarnation, version: 1, fields: ["members"], period, projectionDigest: digest } }
  const command = { page: scope.recordId, action: "import", version: 0, values: {} }
  expect(verifyDashboardImportTarget(snapshot, snapshot, target, actor, command, evidence, context, at)).toBe(true)
  expect(verifyDashboardImportTarget(snapshot, snapshot, { ...target, version: 2 }, actor, command, evidence, context, at)).toBe(false)
  const stale = structuredClone(snapshot)
  ;(stale.data.members as { name: string }[])[0]!.name = "Changed"
  expect(verifyDashboardImportTarget(stale, stale, target, actor, command, evidence, context, at)).toBe(false)
  expect(verifyDashboardImportTarget(snapshot, snapshot, target, { ...actor, roles: ["viewer"], canWrite: false }, command, evidence, context, at)).toBe(false)
})

test("dataset restoration requires the current administrator-scoped source", async () => {
  const { verifyDashboardImportEvidence } = await import("../../../../product/imports/dashboard.ts")
  const snapshot: Snapshot = { data: { risks: [{ id: "r1", name: "Before" }], __sfProductV1: { private: true } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const scope = { principalRef: "admin", accessRevision: "a", policyVersion: "p", recordType: "dashboard-dataset", recordId: "all", selector: { kind: "dashboard-dataset-v1", actor, roleMapDigest: digestSfValue(roleMap(snapshot, "dashboard")), fields: ["data"] } }
  const projection = projectSfSourceScope("dashboard", snapshot, scope, at)
  expect(projection).toEqual({ data: { risks: [{ id: "r1", name: "Before" }] } })
  const digest = digestSfValue(projection)
  snapshot.sfSources = { schemaVersion: 1, records: { [JSON.stringify([scope.recordType, scope.recordId])]: { incarnation: "raw-dataset", version: 1, alive: true, inputDigest: digest } }, scopes: { [digestSfValue(scope)]: { scope, sourceIncarnation: "raw-dataset", incarnation: "scoped-dataset", version: 1, alive: true, inputDigest: digest } } }
  const target = { surface: "dashboard" as const, selectionRef: "sf-dataset:scoped-dataset:1", incarnation: "scoped-dataset", version: 1, options: { newVersion: false, removeMissing: false, preview: {} } }
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: target.selectionRef, refDigest: "ref", installationId: "i", projectId: "p", evidenceLevel: "observed" as const, target: { surface: "dashboard" as const, recordType: "dashboard-dataset", recordId: "all", incarnation: target.incarnation, version: 1, fields: ["data"], projectionDigest: digest } }
  const command = { page: "IT Risks", action: "backup-import", version: 0, values: { data: { risks: [] } } }
  const staged = structuredClone(snapshot)
  staged.data.risks = []
  expect(verifyDashboardImportTarget(snapshot, staged, target, actor, command, evidence, context, at)).toBe(true)
  expect(verifyDashboardImportEvidence(snapshot, staged, actor, command, evidence, at)).toBe(true)
  expect(verifyDashboardImportTarget(snapshot, staged, target, { ...actor, roles: ["viewer"], canWrite: false }, command, evidence, context, at)).toBe(false)
  expect(verifyDashboardImportEvidence(snapshot, staged, { ...actor, roles: ["viewer"], canWrite: false }, command, evidence, at)).toBe(false)
  expect(verifyDashboardImportTarget(snapshot, staged, target, { ...actor, roles: ["finance"], canWrite: true }, command, evidence, context, at)).toBe(false)
  expect(verifyDashboardImportEvidence(snapshot, staged, { ...actor, roles: ["finance"], canWrite: true }, command, evidence, at)).toBe(false)
  expect(verifyDashboardImportTarget(snapshot, staged, target, actor, command, { ...evidence, target: { ...evidence.target, fields: ["risks"] } }, context, at)).toBe(false)
  const changed = structuredClone(snapshot)
  changed.data.risks = [{ id: "r1", name: "Changed" }]
  expect(verifyDashboardImportTarget(changed, staged, target, actor, command, evidence, context, at)).toBe(false)
})
