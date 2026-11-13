import { expect, test } from "bun:test"
import { previewDashboardWorkbook, createDashboardImportMutation } from "../../../../product/imports/dashboard.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "id", directory: [] }
const target = { surface: "dashboard" as const, type: "dashboard-page", id: "Talent Review", incarnation: "inc", version: 1, fields: ["members"], period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: environment.at }

test("member replacement previews internally and applies only the approved command on a staged copy", () => {
  const snapshot: Snapshot = { data: { members: [{ id: "m1", name: "Ana", title: "Old" }], leaders: [] }, versions: { "members:m1": { version: 0, by: "admin" } }, sequences: {}, audit: [], notices: [] }
  const original = structuredClone(snapshot)
  const command = { page: "Talent Review", action: "import", version: 0, values: { rows: [{ Name: "Ana", Title: "New" }], replace: true, versions: { "members:m1": 0 } } }
  const request = { format: "all-members" as const, snapshot, actor, command, environment, operationId: "operation", idempotencyKey: "key", target }
  const preview = previewDashboardWorkbook(request)
  expect(preview.status).toBe("preview")
  expect(snapshot).toEqual(original)
  if (preview.status !== "preview") return
  const denied = createDashboardImportMutation({ format: request.format, command, actorId: actor.id, operationId: request.operationId, idempotencyKey: request.idempotencyKey, target, baseDigest: preview.baseDigest, previewDigest: preview.previewDigest, commandDigest: preview.commandDigest, at: environment.at, verifyScope: (before, after) => {
    expect((before.data.members as { title: string }[])[0]!.title).toBe("Old")
    expect((after.data.members as { title: string }[])[0]!.title).toBe("New")
    return false
  } })
  if (!denied) throw new Error("missing mutation")
  expect(denied.execute(snapshot, actor, environment).commit).toBe(false)
  expect(snapshot).toEqual(original)
  const mutation = createDashboardImportMutation({ format: request.format, command, actorId: actor.id, operationId: request.operationId, idempotencyKey: request.idempotencyKey, target, baseDigest: preview.baseDigest, previewDigest: preview.previewDigest, commandDigest: preview.commandDigest, at: environment.at, verifyScope: () => true })
  if (!mutation) throw new Error("missing mutation")
  expect(mutation.execute(snapshot, actor, environment).commit).toBe(true)
  expect((snapshot.data.members as { title: string }[])[0]!.title).toBe("New")
  expect(mutation.execute(snapshot, actor, environment).commit).toBe(false)
  expect(previewDashboardWorkbook({ ...request, command: { ...command, confirmed: true } }).status).toBe("invalid")
  expect(previewDashboardWorkbook({ ...request, command: { ...command, values: { ...command.values, confirmed: true } } }).status).toBe("invalid")
})

test("backup preview and apply use the legacy producer and preserve private state", async () => {
  const snapshot: Snapshot = { data: { risks: [], __sfProductV1: { receipt: "private" } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const original = structuredClone(snapshot)
  const command = { page: "IT Risks", action: "backup-import", version: 0, values: { data: { risks: [{ id: "r1", name: "Imported" }] } } }
  const request = { format: "backup" as const, snapshot, actor, command, environment, operationId: "backup", idempotencyKey: "backup-key", target }
  const preview = previewDashboardWorkbook(request)
  expect(preview.status).toBe("preview")
  expect(snapshot).toEqual(original)
  if (preview.status !== "preview") return
  const mutation = createDashboardImportMutation({ format: request.format, command, actorId: actor.id, operationId: request.operationId, idempotencyKey: request.idempotencyKey, target, baseDigest: preview.baseDigest, previewDigest: preview.previewDigest, commandDigest: preview.commandDigest, at: environment.at, verifyScope: () => true })
  if (!mutation) throw new Error("missing mutation")
  expect(mutation.execute(snapshot, actor, environment).commit).toBe(true)
  const { executeDashboardBackupImport } = await import("../../../../runtime/dashboard-backup.ts")
  const legacy = structuredClone(original)
  expect(executeDashboardBackupImport(legacy, actor, { ...command, confirmed: true }, environment).commit).toBe(true)
  expect(snapshot).toEqual(legacy)
  expect(snapshot.data.__sfProductV1).toEqual({ receipt: "private" })
  expect(snapshot.audit.at(-1)?.record).toBe("dataset")
  expect(mutation.execute(snapshot, actor, environment).commit).toBe(false)
  expect(previewDashboardWorkbook({ ...request, snapshot: original, command: { ...command, values: { data: { __sfProductV1: {} } } } }).status).toBe("invalid")
})

test("Dashboard import evidence fences changed collections and stale projections", async () => {
  const { verifyDashboardImportEvidence } = await import("../../../../product/imports/dashboard.ts")
  const { projectDashboardScope } = await import("../../../../product/dashboard/scope.ts")
  const { digestSfValue } = await import("../../../../product/contracts/canonical.ts")
  const snapshot: Snapshot = { data: { members: [{ id: "m1", name: "Ana", title: "Old" }], leaders: [], risks: [{ id: "r1", name: "Risk" }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const period = target.period
  const command = { page: "Talent Review", action: "import", version: 0, values: {} }
  const scoped = projectDashboardScope(snapshot, actor, { page: command.page, fields: ["members"], period }, environment.at)
  expect(scoped).toBeDefined()
  const evidence = { schema: "sf-evidence-v1" as const, refId: "page", installationId: "i", projectId: "p", refDigest: "ref", evidenceLevel: "observed" as const, kind: "record" as const, target: { surface: "dashboard" as const, recordType: "dashboard-page", recordId: command.page, incarnation: "inc", version: 1, fields: ["members"], period, projectionDigest: digestSfValue(scoped) } }
  const staged = structuredClone(snapshot)
  ;(staged.data.members as { title: string }[])[0]!.title = "New"
  expect(verifyDashboardImportEvidence(snapshot, staged, actor, command, evidence, environment.at)).toBe(true)
  expect(verifyDashboardImportEvidence(snapshot, snapshot, actor, command, evidence, environment.at)).toBe(true)
  ;(staged.data.risks as { name: string }[])[0]!.name = "Other"
  expect(verifyDashboardImportEvidence(snapshot, staged, actor, command, evidence, environment.at)).toBe(false)
  const stale = structuredClone(snapshot)
  ;(stale.data.members as { title: string }[])[0]!.title = "Changed"
  expect(verifyDashboardImportEvidence(stale, staged, actor, command, evidence, environment.at)).toBe(false)
})
