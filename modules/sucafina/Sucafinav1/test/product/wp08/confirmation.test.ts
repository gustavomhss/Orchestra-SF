import { expect, test } from "bun:test"
import { projectConfirmation } from "../../../product/collaboration/confirmation.ts"
import type { ConfirmationRecord } from "../../../product/contracts/context.ts"

const record: ConfirmationRecord & { physicalIncarnation: string; sourceFingerprint: string; dependencyFingerprint: string } = {
  physicalIncarnation: "physical-A",
  sourceFingerprint: "source-v1",
  dependencyFingerprint: "dependencies-v1",
  id: "confirmation-1",
  sourceRef: { surface: "planner", type: "forecast-line", id: "line-A", incarnation: "A" },
  observedSourceVersion: 7,
  observedScopeFingerprint: "january-v1",
  scope: { sourceRef: { surface: "planner", type: "forecast-line", id: "line-A", incarnation: "A" }, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, materialDependencies: [], scopeDefinitionVersion: "1" },
  authorId: "author-A",
  confirmedAt: "2026-11-13T10:00:00Z",
  auditRef: "audit-A",
}

test("confirmation follows material scope and never treats access loss or replacement as valid", () => {
  const original = structuredClone(record)
  const evaluatedAt = "2026-11-14T10:00:00Z"
  const available = { state: "available", sourceVersion: 8, incarnation: "A", physicalIncarnation: "physical-A", scopeFingerprint: "january-v1", sourceFingerprint: "source-v1", dependencyFingerprint: "dependencies-v1" } as const
  expect(projectConfirmation(record, available, evaluatedAt)).toMatchObject({ state: "valid", evaluatedSourceVersion: 8 })
  expect(projectConfirmation(record, { ...available, incarnation: "B-scoped" }, evaluatedAt)).toMatchObject({ state: "valid", reason: "unchanged-scope" })
  expect(projectConfirmation(record, { ...available, scopeFingerprint: "january-v2", sourceFingerprint: "source-v2" }, evaluatedAt)).toMatchObject({ state: "stale", reason: "material-change" })
  expect(projectConfirmation(record, { ...available, scopeFingerprint: "dependency-v2", dependencyFingerprint: "dependencies-v2" }, evaluatedAt)).toMatchObject({ state: "stale", reason: "dependency-change" })
  expect(projectConfirmation(record, { ...available, physicalIncarnation: "physical-B" }, evaluatedAt)).toMatchObject({ state: "stale", reason: "source-replaced" })
  const revoked = projectConfirmation(record, { state: "access-unavailable", sourceVersion: 8 }, evaluatedAt)
  expect(revoked).toMatchObject({ state: "unavailable", reason: "access-unavailable" })
  expect("scopeFingerprint" in revoked).toBe(false)
  const { physicalIncarnation, sourceFingerprint, dependencyFingerprint, ...legacy } = record
  expect(projectConfirmation(legacy, available, evaluatedAt)).toMatchObject({ state: "unavailable" })
  expect(record).toEqual(original)
})
