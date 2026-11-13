import { expect, test } from "bun:test"
import { confirmationWorkIdentity, latestConfirmationWork } from "../../../product/collaboration/confirmation-work.ts"
import type { ConfirmationRecord } from "../../../product/contracts/context.ts"

const january: ConfirmationRecord = {
  id: "confirmation-original",
  sourceRef: { surface: "planner", type: "forecast-line", id: "line-A", incarnation: "inc-A" },
  scope: { sourceRef: { surface: "planner", type: "forecast-line", id: "line-A", incarnation: "inc-A" }, fields: ["amount", "currency"], period: { start: "2027-01-01", end: "2027-01-31" }, materialDependencies: [], scopeDefinitionVersion: "planner-v1" },
  observedSourceVersion: 7,
  observedScopeFingerprint: "january-original",
  authorId: "person-A",
  confirmedAt: "2026-11-13T00:00:00Z",
  auditRef: "audit-original",
}

test("reconfirmation with a new dependency manifest keeps one canonical obligation and original audit", () => {
  const original = structuredClone(january)
  const updated = structuredClone(january)
  updated.id = "confirmation-current"
  updated.auditRef = "audit-current"
  updated.confirmedAt = "2026-11-13T01:00:00Z"
  updated.observedSourceVersion = 8
  updated.observedScopeFingerprint = "january-with-fx"
  updated.scope = { ...updated.scope, fields: ["currency", "amount"], materialDependencies: [{ surface: "planner", type: "fx-rate", id: "EUR-USD", incarnation: "fx-A", version: 2, fields: ["rate"], period: january.scope.period, observedAt: updated.confirmedAt }], scopeDefinitionVersion: "planner-v2" }
  const before = latestConfirmationWork([january])
  const after = latestConfirmationWork([updated, january])
  expect(after).toHaveLength(1)
  expect(after[0]?.record.id).toBe(updated.id)
  expect(after[0]?.actionRef).toBe(before[0]?.actionRef)
  expect(latestConfirmationWork([january, updated])).toEqual(after)
  expect(january).toEqual(original)
  expect(after[0]?.record.auditRef).toBe("audit-current")
  expect(january.auditRef).toBe("audit-original")
})

test("periods and replaced incarnations never inherit another scope's work identity", () => {
  const february = { ...january, id: "confirmation-february", scope: { ...january.scope, period: { start: "2027-02-01", end: "2027-02-28" } } }
  const replaced = { ...january, id: "confirmation-replaced", scope: { ...january.scope, sourceRef: { ...january.scope.sourceRef, incarnation: "inc-B" } } }
  expect(confirmationWorkIdentity(february.scope)).not.toBe(confirmationWorkIdentity(january.scope))
  expect(confirmationWorkIdentity(replaced.scope)).not.toBe(confirmationWorkIdentity(january.scope))
  expect(latestConfirmationWork([january, february, replaced])).toHaveLength(3)
})
