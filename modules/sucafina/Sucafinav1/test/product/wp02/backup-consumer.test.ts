import { expect, test } from "bun:test"
import { previewDashboardWorkbook, createDashboardImportMutation, verifyDashboardImportEvidence } from "../../../product/imports/dashboard.ts"
import { publicSfData } from "../../../product/integration/public-state.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }
const target: SourceRef = { surface: "dashboard", type: "dashboard-dataset", id: "all", incarnation: "dataset-inc", version: 1, fields: ["data"], period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: environment.at }
const initial = (): Snapshot => ({ data: {
  roleMap: [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }],
  access: { leader: { assigned: ["Operations"] } }, budgetLineIds: { leader: ["opexOwners:o"] },
  assets: [{ id: "file", key: "private/blob" }],
  __sfProductV1: { protectedReceipt: "private-receipt-sentinel" },
  projects: [{ id: "old", name: "Removed project" }], opexOwners: [{ id: "o", budget: 1200 }],
  contracts: [{ id: "contract", name: "Existing contract", docs: [{ id: "file", key: "private/blob" }] }],
}, versions: { dataset: { version: 1, by: "admin" } }, sequences: {}, audit: [], notices: [] })
const command = (): Command => ({ page: "Budget Overview", action: "backup-import", version: 1, values: { data: {
  projects: [{ id: "new", name: "Replacement project" }], opexOwners: [{ id: "o", budget: 2400 }],
  contracts: [{ id: "contract", name: "Updated contract" }],
  roleMap: [{ surface: "dashboard", role: "admin", entra: "untrusted" }], assets: [{ id: "untrusted-file" }],
} } })

function preview(snapshot: Snapshot, submitted = command(), principal = actor) {
  return previewDashboardWorkbook({ format: "backup", snapshot, actor: principal, command: submitted, environment, operationId: "backup-operation", idempotencyKey: "backup-intent", target })
}

test("WP06 JSON producer preview and domain apply agree while preserving trusted installation state", () => {
  const state = initial()
  const before = structuredClone(state)
  const submitted = command()
  const proposed = preview(state, submitted)
  expect(proposed.status).toBe("preview")
  expect(state).toEqual(before)
  if (proposed.status !== "preview") throw new Error("Expected backup preview")
  expect(proposed.before.projects).toEqual([{ id: "old", name: "Removed project" }])
  expect(proposed.after.projects).toEqual([{ id: "new", name: "Replacement project" }])
  expect(JSON.stringify(proposed)).not.toContain("private-receipt-sentinel")
  const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "dataset-source", installationId: "i", projectId: "p", evidenceLevel: "observed", refDigest: "", target: { surface: "dashboard", recordType: "dashboard-dataset", recordId: "all", incarnation: target.incarnation, version: 1, fields: ["data"], projectionDigest: digestSfValue({ data: publicSfData(before.data) }) } }
  evidence.refDigest = digestSfEvidenceRef(evidence)
  const mutation = createDashboardImportMutation({ format: "backup", command: submitted, actorId: actor.id, operationId: "backup-operation", idempotencyKey: "backup-intent", target, baseDigest: proposed.baseDigest, previewDigest: proposed.previewDigest, commandDigest: proposed.commandDigest, at: environment.at, verifyScope: (current, staged, principal) => verifyDashboardImportEvidence(current, staged, principal, submitted, evidence, environment.at) })
  expect(mutation).toBeDefined()
  if (!mutation) throw new Error("Expected protected import mutation")
  const stale = structuredClone(before)
  stale.versions.dataset = { version: 2, by: "other" }
  const staleBefore = structuredClone(stale)
  expect(mutation.execute(stale, actor, environment)).toMatchObject({ commit: false, value: { status: "conflict" } })
  expect(stale).toEqual(staleBefore)
  const denied = structuredClone(before)
  expect(mutation.execute(denied, { ...actor, id: "other" }, environment)).toMatchObject({ commit: false, value: { status: "denied" } })
  expect(denied).toEqual(before)
  expect(mutation.execute(state, actor, environment)).toMatchObject({ commit: true, value: { status: "applied" } })
  expect(publicSfData(state.data)).toEqual(proposed.after)
  expect(state.data.__sfProductV1).toEqual(before.data.__sfProductV1)
  expect(state.data.roleMap).toEqual(before.data.roleMap)
  expect(state.data.access).toEqual(before.data.access)
  expect(state.data.budgetLineIds).toEqual(before.data.budgetLineIds)
  expect(state.data.assets).toEqual(before.data.assets)
  expect(state.data.contracts).toEqual([{ id: "contract", name: "Updated contract", docs: [{ id: "file", key: "private/blob" }] }])
  expect(state.versions.dataset).toEqual({ version: 2, by: "admin" })
})

test("JSON preview rejects private state injection, file-reference forgery and unauthorized replacement", () => {
  const state = initial()
  const before = structuredClone(state)
  const privateState = command()
  ;(privateState.values.data as Record<string, unknown>).__sfProductV1 = { forged: true }
  expect(preview(state, privateState).status).toBe("invalid")
  const forged = command()
  ;(forged.values.data as Record<string, unknown>).contracts = [{ id: "contract", docs: [{ id: "file", key: "other/blob" }] }]
  expect(preview(state, forged).status).toBe("invalid")
  expect(preview(state, command(), { id: "leader", roles: ["domain leader"], canWrite: true }).status).toBe("denied")
  expect(preview(state, command(), { ...actor, canWrite: false }).status).not.toBe("preview")
  expect(state).toEqual(before)
})
