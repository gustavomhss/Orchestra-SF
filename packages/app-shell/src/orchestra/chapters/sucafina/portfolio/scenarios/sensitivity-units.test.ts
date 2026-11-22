import { describe, expect, test } from "bun:test"
import { sfReadSensitivityUnits } from "./producer"

const selection = {
  caseRef: { id: "case:units-test", incarnation: "case-incarnation", version: 1 },
  scenarioRef: "scenario:units-test",
  baselineRef: "baseline:units-test",
  parameterRef: "parameter:units-test",
}

// A contract specimen for decoder regression, not evidence of an issued original-source binding.
// The native design journey separately verifies issuance and readback through the installed host.
function specimen() {
  const digest = "a".repeat(64)
  return {
    caseRef: selection.caseRef,
    scenario: { baseRef: selection.baselineRef, operations: [], assumptions: [] },
    scenarioCoverageRef: "coverage:scenario", baselineCoverageRef: "coverage:baseline",
    baselineRef: selection.baselineRef, criterionId: "criterion:known-subtotal",
    metric: "alternative-minus-baseline-known-subtotal",
    parameterUnit: "USD/year", resultUnit: "USD", unit: "USD",
    unitMetadataRef: "units:metadata", unitMetadataVersion: 1, engineVersion: "engine:version",
    evidenceRefs: [{
      schema: "sf-evidence-v1", refId: "evidence:units", installationId: "installation:units",
      projectId: "project:units", refDigest: digest, evidenceLevel: "observed", kind: "record",
      target: {
        surface: "planner", recordType: "line", recordId: "line:units",
        incarnation: "line-incarnation", version: 1, fields: ["amount"], projectionDigest: digest,
      },
    }],
    metadataDigest: digest, ruleRef: "rule:units", ruleVersion: 1, ruleDigest: digest,
    sensitivityRequest: {
      scenarioRef: selection.scenarioRef,
      parameterBounds: { parameterRef: selection.parameterRef, minimum: 0, maximum: 100, steps: 5 },
      criterion: { id: "criterion:known-subtotal", operator: "lte", value: 0 },
    },
  }
}

describe("original sensitivity units projection", () => {
  test("reads the flattened closed binding without changing units or evidence references", () => {
    expect(sfReadSensitivityUnits(specimen(), selection)).toEqual({
      ...selection, parameterUnit: "USD/year", resultUnit: "USD", unit: "USD",
      engineVersion: "engine:version", sourceRefs: ["evidence:units"],
    })
  })

  test("refuses the obsolete nested units shape", () => {
    expect(sfReadSensitivityUnits({
      caseRef: selection.caseRef,
      units: { parameterUnit: "USD/year", resultUnit: "USD", engineVersion: "engine:version",
        baselineRef: selection.baselineRef, parameterRef: selection.parameterRef,
        sourceRefs: [{ refId: "evidence:units" }] },
    }, selection)).toBeNull()
  })

  test("refuses units from another case identity, incarnation, or revision", () => {
    for (const caseRef of [
      { ...selection.caseRef, id: "case:other" },
      { ...selection.caseRef, incarnation: "other-incarnation" },
      { ...selection.caseRef, version: 2 },
    ]) expect(sfReadSensitivityUnits({ ...specimen(), caseRef }, selection)).toBeNull()
  })

  test("refuses a different baseline, scenario, or parameter binding", () => {
    const value = specimen()
    expect(sfReadSensitivityUnits({ ...value, baselineRef: "baseline:other" }, selection)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, sensitivityRequest: {
      ...value.sensitivityRequest, scenarioRef: "scenario:other",
    } }, selection)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, sensitivityRequest: {
      ...value.sensitivityRequest,
      parameterBounds: { ...value.sensitivityRequest.parameterBounds, parameterRef: "parameter:other" },
    } }, selection)).toBeNull()
  })

  test("refuses incomplete metadata, malformed evidence, and excess authority fields", () => {
    const value = specimen()
    expect(sfReadSensitivityUnits({ ...value, metadataDigest: undefined }, selection)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, evidenceRefs: [{ refId: "evidence:units" }] }, selection)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, granted: true }, selection)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, caseRef: { ...value.caseRef, approved: true } }, selection)).toBeNull()
  })
})
