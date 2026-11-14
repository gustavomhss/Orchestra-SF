import { expect, test } from "bun:test"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { isAllowedRelationPair } from "../../../product/collaboration/relation-catalog.ts"

function record(surface: "dashboard" | "planner" | "procurement", recordType: string, id: string): Extract<BusinessEvidenceRef, { kind: "record" }> {
  const value: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: `${surface}:${recordType}:${id}`, installationId: "installation", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface, recordType, recordId: id, incarnation: `inc-${id}`, version: 1, fields: ["status"], projectionDigest: "a".repeat(64) } }
  return { ...value, refDigest: digestSfEvidenceRef(value) }
}

test("C06 relation kinds require the allowed source types and never infer identity from names", () => {
  const project = record("dashboard", "projects", "same-name")
  const capex = record("dashboard", "capexProjects", "same-name")
  const contract = record("dashboard", "contracts", "contract")
  const supplier = record("procurement", "procurement-supplier", "supplier")
  const request = record("procurement", "procurement-request", "request")
  const topic = record("dashboard", "hotTopics", "topic")
  expect(isAllowedRelationPair("pmo-capex", project, capex)).toBe(true)
  expect(isAllowedRelationPair("pmo-capex", capex, project)).toBe(true)
  expect(isAllowedRelationPair("contract-supplier", contract, supplier)).toBe(true)
  expect(isAllowedRelationPair("contract-request", request, contract)).toBe(true)
  expect(isAllowedRelationPair("financial-line-request", record("dashboard", "opexEntries", "line"), request)).toBe(true)
  expect(isAllowedRelationPair("financial-line-request", record("dashboard", "capexEntries", "line"), request)).toBe(true)
  expect(isAllowedRelationPair("financial-line-request", record("planner", "planner-version", "whole-version"), request)).toBe(false)
  expect(isAllowedRelationPair("handoff", project, topic)).toBe(true)
  expect(isAllowedRelationPair("handoff", topic, project)).toBe(false)
  expect(isAllowedRelationPair("pmo-capex", project, project)).toBe(false)
  expect(isAllowedRelationPair("contract-supplier", contract, request)).toBe(false)
  expect(isAllowedRelationPair("unknown", contract, supplier)).toBe(false)
  expect(isAllowedRelationPair("pmo-capex", project, { ...capex, refDigest: "forged" })).toBe(false)
})
