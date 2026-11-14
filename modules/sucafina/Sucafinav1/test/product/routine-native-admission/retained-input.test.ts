import { expect, test } from "bun:test"
import { Project } from "@orchestra/core/project"
import { readSfRoutineNativeInput, sameSfRoutineNativeOwner, SF_ROUTINE_INPUT_PARAMETER } from "../../../../../../apps/cli/src/sucafina-product/routine-native-input.ts"
import { routineInputDigest } from "../../../product/routines/result-access.ts"
import { fixturePlan } from "./fixture.ts"

const parentID = "ses_sf_retained_input_fixture"
const retained = {
  schema: "sf-routine-native-input-v1", purpose: "Prepare selected review",
  owner: { installationId: "installation-fixture", hostId: "host-fixture", projectId: Project.ID.global,
    locationId: "/fixture/native-location", authoritySessionId: parentID, principalRef: "principal-fixture",
    policyVersion: "policy-1", accessRevision: "access-1", providerGeneration: 2 },
  caseRef: { id: "case-fixture", incarnation: "case-incarnation-fixture", version: 2 },
  publishedRecipeRef: "sf-review-fixture", inputRefs: ["selected-source-fixture"],
  parameters: { period: { start: "2027-01-01", end: "2027-01-31" } },
  sourceRefs: [{ surface: "dashboard", type: "project", id: "source-fixture", incarnation: "source-incarnation-fixture",
    version: 3, fields: ["status"], period: { start: "2027-01-01", end: "2027-01-31" }, observedAt: "2026-11-14T00:00:00Z" }],
} as const

function fromParameters(parameters: Record<string, string>) {
  const plan = fixturePlan(parentID, true, parameters)
  if (!plan.workflowBinding) throw new Error("Fixture has no native workflow binding")
  return { ...plan, workflowBinding: plan.workflowBinding }
}

test("retained SF input derives its native plan ID and digest without putting either in the hashed plan body", () => {
  const encoded = JSON.stringify(retained)
  const plan = fromParameters({ [SF_ROUTINE_INPUT_PARAMETER]: encoded })
  const decoded = readSfRoutineNativeInput(plan)
  expect(decoded?.owner).toEqual(retained.owner)
  expect(decoded?.sourceRefs).toEqual(retained.sourceRefs)
  expect(decoded?.input).toEqual({
    publishedRecipeRef: retained.publishedRecipeRef, inputRefs: retained.inputRefs, parameters: retained.parameters,
    planRevisionId: plan.id, writeScope: ["review-output"], publishedVersion: "published-fixture-v1",
    principalRef: retained.owner.principalRef, projectId: retained.owner.projectId, caseRef: retained.caseRef,
  })
  expect(encoded).not.toContain(plan.id)
  expect(encoded).not.toContain("inputDigest")
  if (!decoded) throw new Error("Retained native input was not decoded")
  expect(decoded.inputDigest).toBe(routineInputDigest(decoded.input))
  expect(decoded.inputDigest).toMatch(/^[a-f0-9]{64}$/)
})

test("retained native metadata refuses other owners, publication, invalid case/source and extra authority fields", () => {
  const invalid = [
    { ...retained, owner: { ...retained.owner, projectId: "another-project" } },
    { ...retained, owner: { ...retained.owner, authoritySessionId: "ses_another_authority" } },
    { ...retained, owner: { ...retained.owner, role: "admin" } },
    { ...retained, owner: { ...retained.owner, providerGeneration: -1 } },
    { ...retained, publishedRecipeRef: "another-recipe" },
    { ...retained, caseRef: { ...retained.caseRef, incarnation: "" } },
    { ...retained, caseRef: { ...retained.caseRef, version: 0 } },
    { ...retained, sourceRefs: [{ ...retained.sourceRefs[0], version: -1 }] },
    { ...retained, planRevisionId: "evt_forged_plan" },
    { ...retained, inputDigest: "0".repeat(64) },
    { ...retained, parameters: { selectedPeriod: "2027-01" } },
  ]
  for (const value of invalid) {
    expect(readSfRoutineNativeInput(fromParameters({ [SF_ROUTINE_INPUT_PARAMETER]: JSON.stringify(value) }))).toBeUndefined()
  }
  expect(readSfRoutineNativeInput(fromParameters({}))).toBeUndefined()
  expect(readSfRoutineNativeInput(fromParameters({ [SF_ROUTINE_INPUT_PARAMETER]: "{malformed" }))).toBeUndefined()
  expect(readSfRoutineNativeInput(fromParameters({ [SF_ROUTINE_INPUT_PARAMETER]: " ".repeat(256 * 1024 + 1) }))).toBeUndefined()
})

test("current owner comparison retains generation, policy, access revision, principal and placement", () => {
  expect(sameSfRoutineNativeOwner(retained.owner, { ...retained.owner })).toBe(true)
  expect(sameSfRoutineNativeOwner(retained.owner, { ...retained.owner, providerGeneration: 3 })).toBe(false)
  expect(sameSfRoutineNativeOwner(retained.owner, { ...retained.owner, accessRevision: "access-2" })).toBe(false)
  expect(sameSfRoutineNativeOwner(retained.owner, { ...retained.owner, policyVersion: "policy-2" })).toBe(false)
  expect(sameSfRoutineNativeOwner(retained.owner, { ...retained.owner, principalRef: "another-principal" })).toBe(false)
  expect(sameSfRoutineNativeOwner(retained.owner, { ...retained.owner, locationId: "/another-location" })).toBe(false)
})
