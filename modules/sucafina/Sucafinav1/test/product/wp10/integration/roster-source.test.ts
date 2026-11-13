import { expect, test } from "bun:test"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { projectSfSourceScope, sfPlannerRosterProjectionSelector } from "../../../../product/integration/source-projections.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"

test("roster evidence follows the authorized Planner scope and physical roster revision", () => {
  const snapshot: Snapshot = { data: { roster: [{ name: "Ana", title: "Analyst", type: "employee", leader: "Lead", location: "BR", start: "2026-01-01", end: "", status: "active", salary: 42 }] }, versions: { "roster:file": { version: 1, by: "admin" } }, sequences: {}, audit: [], notices: [] }
  snapshot.sfSources = { schemaVersion: 1, records: { [JSON.stringify(["planner-roster", "file"])]: { incarnation: "physical", version: 1, alive: true, inputDigest: "a".repeat(64) } } }
  const actor = { id: "person", roles: ["hr"], canWrite: true, assigned: [], domains: [] }
  const scope = { principalRef: actor.id, accessRevision: "access", policyVersion: "policy", recordType: "planner-roster", recordId: "file", selector: sfPlannerRosterProjectionSelector(snapshot, actor, ["title", "name"]) }
  expect(projectSfSourceScope("planner", snapshot, scope)).toEqual({ roster: [{ name: "Ana", title: "Analyst" }], sourceVersion: 1 })
  const original = enumerateSfSources("planner", snapshot).find((item) => item.recordType === "planner-roster")
  expect(original?.recordId).toBe("file")
  snapshot.versions["roster:file"] = { version: 2, by: "admin" }
  expect(enumerateSfSources("planner", snapshot).find((item) => item.recordType === "planner-roster")?.inputDigest).not.toBe(original?.inputDigest)
  snapshot.sfSources.records[JSON.stringify(["planner-roster", "file"]) ]!.version = 2
  expect(projectSfSourceScope("planner", snapshot, scope)).toMatchObject({ sourceVersion: 2 })
  const viewer = { ...actor, roles: ["viewer"], canWrite: false }
  expect(projectSfSourceScope("planner", snapshot, { ...scope, selector: sfPlannerRosterProjectionSelector(snapshot, viewer, ["name"]) })).toBeUndefined()
  expect(projectSfSourceScope("planner", snapshot, { ...scope, selector: sfPlannerRosterProjectionSelector(snapshot, actor, ["salary"]) })).toBeUndefined()
})
