import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { settleSfImportReceipt } from "../../../../product/imports/store.ts"

test("settlement binds the confirmed domain receipt to the exact private preview", () => {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const source = { surface: "planner" as const, type: "planner-version", id: "v1", incarnation: "inc", version: 1, fields: ["forecast"], period, observedAt: "2026-11-13T00:00:00Z" }
  const context = { installationId: "i", projectId: "p", principalRef: "user", accessRevision: "a", policyVersion: "policy", surface: "planner" as const, period, currency: "USD", sourceRefs: [source], capabilities: [] }
  const projection = { context, version: 1, engineVersion: "planner", components: [], values: [], missing: [] }
  const command = { id: "command", target: source, command: { page: "OPEX", action: "import-workbook", version: 1, values: {} }, idempotencyKey: "key", commandDigest: "a".repeat(64), expectedVersion: 1, requiredAuthority: [], preview: projection }
  const manifest = { id: "preview", version: 1, sourceDigest: "b".repeat(64), format: "xlsx", context, baseIdentity: [source], commands: [command], issues: [], state: "preview" as const, domainApplied: false, receipts: [] }
  const detail = { manifestId: "preview", version: 1, sourceDigest: manifest.sourceDigest, changes: [] }
  const target = { surface: "planner" as const, selectionRef: "v1", incarnation: "inc", version: 1, options: { newVersion: false, removeMissing: false, preview: {} } }
  const payload = { schema: "sf-import-preview-v1" as const, fileRef: "file", target, manifest, detail }
  const entry = { ...payload, digest: digestSfValue(payload) }
  const state = { documents: { "import-preview:preview": entry }, receipts: {} } as unknown as SfProductState
  const receipt = { id: "receipt", idempotencyKey: "key", commandDigest: command.commandDigest, targetIncarnation: "inc", principalRef: "user", surface: "planner" as const, version: 2, result: { ok: true as const }, at: "2026-11-13T00:00:00Z" }
  expect(settleSfImportReceipt(state, { manifestId: "preview", expectedDigest: entry.digest, receipt: { ...receipt, commandDigest: "c".repeat(64) } })).toBe(false)
  expect(state.documents["import-preview:preview"]).toEqual(entry)
  expect(settleSfImportReceipt(state, { manifestId: "preview", expectedDigest: entry.digest, receipt })).toBe(true)
  expect(state.receipts.receipt).toEqual(receipt)
  expect(state.documents["import-preview:preview"]).toMatchObject({ manifest: { state: "applied", domainApplied: true, receipts: [receipt] }, detail })
})
