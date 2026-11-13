import { expect, test } from "bun:test"
import { prepareDashboardImport } from "../../../runtime/dashboard-import.ts"

test("business backup cannot provide protected product state and preserves trusted state", () => {
  const current = { __sfProductV1: { receipts: [{ id: "trusted" }] }, members: [{ id: "old" }] }
  const result = prepareDashboardImport(current, { members: [{ id: "new" }] })
  expect(result).toEqual({ ok: true, data: { __sfProductV1: current.__sfProductV1, members: [{ id: "new" }] } })
  if (result.ok) expect(result.data.__sfProductV1).not.toBe(current.__sfProductV1)
  expect(prepareDashboardImport(current, { __sfProductV1: { receipts: [] } }).ok).toBe(false)
  expect(prepareDashboardImport({}, { __sfProductV1: null }).ok).toBe(false)
})
