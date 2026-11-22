import { describe, expect, test } from "bun:test"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { sfReadSensitivityUnits, sfSensitivityUnitsForSelection } from "./producer"

const selection = {
  ref: "case:units-test:case-incarnation",
  caseRef: { id: "units-test", incarnation: "case-incarnation", version: 1 },
  scenarioRef: "scenario:units-test",
  baselineRef: "baseline:units-test",
  parameterRef: "parameter:units-test",
}
const stamp = {
  installationId: "installation:units", projectId: "project:units", hostId: "host:units",
  principalRef: "principal:units", policyVersion: "policy:units", accessRevision: "access:units",
}

// Structural A04 contract specimens only: these are not issued sources, grants,
// calculation results or receipts. The installed journey proves original issuance.
function specimen() {
  const digest = "a".repeat(64)
  const evidence = {
    schema: "sf-evidence-v1", refId: "evidence:units", installationId: stamp.installationId,
    projectId: stamp.projectId, refDigest: digest, evidenceLevel: "observed", kind: "record",
    target: {
      surface: "planner", recordType: "line", recordId: "line:units",
      incarnation: "line-incarnation", version: 1, fields: ["amount"],
      period: { start: "2026-02-01", end: "2026-02-28" }, projectionDigest: digest,
    },
  }
  return {
    cases: [{ ref: selection.ref, title: "Structural units specimen", version: selection.caseRef.version }],
    actions: [], accessRevision: stamp.accessRevision, fingerprint: digest, selectionFingerprint: digest,
    selected: {
      ref: selection.ref, caseRef: selection.caseRef,
      decision: {
        ...selection.caseRef, objective: "Structural units specimen", state: "comparing",
        horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD",
        alternatives: [], criteria: [], participants: [stamp.principalRef], sourceRefs: [evidence],
        costCoverageBases: [], assumptions: [], questions: [], choices: [], ledger: [],
        preparedChanges: [], receipts: [],
      },
      forecasts: [],
      scenarios: [
        { ref: selection.scenarioRef, title: "Selected", alternativeId: "alternative:selected",
          parameters: [{ ref: selection.parameterRef, label: "Amount" }] },
        { ref: selection.baselineRef, title: "Baseline", alternativeId: "alternative:baseline", parameters: [] },
      ],
      rules: [],
      units: {
        baselineRef: selection.baselineRef, parameterRef: selection.parameterRef,
        parameterUnit: "USD/month", resultUnit: "USD", engineVersion: "engine:version", sourceRefs: [evidence],
      },
      unitSelection: { scenarioRef: selection.scenarioRef, baselineRef: selection.baselineRef, parameterRef: selection.parameterRef },
      evidence: [], recipients: [], conditions: [],
    },
  }
}
function context(
  operations: SfContext["availability"][number]["operations"],
  family: "decisions" | "portfolio" = "decisions",
): Pick<SfContext, "availability" | "stamp"> {
  return { stamp, availability: [{ family, resource: family === "decisions" ? "assumptions" : "sensitivity",
    state: "partial", operations }] }
}
const ready = { operationId: "decisions.controls.read", state: "ready", reason: null, operational: true } as const

describe("source-issued sensitivity units through original A04 controls", () => {
  test("retains the exact selected case, tuple, units and complete source metadata", () => {
    const value = specimen()
    expect(sfReadSensitivityUnits(value, selection, stamp)).toEqual({
      ...value.selected.units, ref: selection.ref, caseRef: selection.caseRef, scenarioRef: selection.scenarioRef,
    })
  })

  test("requires the selected controls envelope, units and unit selection", () => {
    const value = specimen()
    expect(sfReadSensitivityUnits({ ...value, selected: undefined }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, units: undefined } }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, unitSelection: undefined } }, selection, stamp)).toBeNull()
    // An evaluation/resolve binding is a different producer result, never an issue projection.
    expect(sfReadSensitivityUnits({ ...value.selected.units, caseRef: selection.caseRef,
      sensitivityRequest: { scenarioRef: selection.scenarioRef,
        parameterBounds: { parameterRef: selection.parameterRef, minimum: 0, maximum: 100, steps: 5 },
        criterion: { id: "criterion:known-subtotal", operator: "lte", value: 0 } } }, selection, stamp)).toBeNull()
  })

  test("refuses another public case, identity, incarnation or revision", () => {
    const value = specimen()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, ref: "case:other" } }, selection, stamp)).toBeNull()
    for (const caseRef of [
      { ...selection.caseRef, id: "case:other" },
      { ...selection.caseRef, incarnation: "other-incarnation" },
      { ...selection.caseRef, version: 2 },
    ]) {
      expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, caseRef } }, selection, stamp)).toBeNull()
      expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected,
        decision: { ...value.selected.decision, ...caseRef } } }, selection, stamp)).toBeNull()
    }
    expect(sfReadSensitivityUnits({ ...value, cases: [] }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, cases: [{ ...value.cases[0]!, version: 2 }] }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, cases: [...value.cases, ...value.cases] }, selection, stamp)).toBeNull()
  })

  test("refuses a different or unlisted scenario, baseline or parameter tuple", () => {
    const value = specimen()
    for (const unitSelection of [
      { ...value.selected.unitSelection, scenarioRef: "scenario:other" },
      { ...value.selected.unitSelection, baselineRef: "baseline:other" },
      { ...value.selected.unitSelection, parameterRef: "parameter:other" },
    ]) expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, unitSelection } }, selection, stamp)).toBeNull()
    for (const units of [
      { ...value.selected.units, baselineRef: "baseline:other" },
      { ...value.selected.units, parameterRef: "parameter:other" },
    ]) expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, units } }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, scenarios: [] } }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected,
      scenarios: value.selected.scenarios.map((scenario) => ({ ...scenario, parameters: [] })) } }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected,
      scenarios: [...value.selected.scenarios, value.selected.scenarios[0]!] } }, selection, stamp)).toBeNull()
  })

  test("refuses missing units metadata, malformed evidence and excess authority fields", () => {
    const value = specimen()
    for (const units of [
      { ...value.selected.units, parameterUnit: "" },
      { ...value.selected.units, resultUnit: "" },
      { ...value.selected.units, engineVersion: undefined },
      { ...value.selected.units, sourceRefs: [] },
      { ...value.selected.units, sourceRefs: [{ refId: "evidence:units" }] },
      { ...value.selected.units, sourceRefs: [{ ...value.selected.units.sourceRefs[0]!, refDigest: "invalid" }] },
      { ...value.selected.units, granted: true },
      { ...value.selected.units, sourceRefs: [{ ...value.selected.units.sourceRefs[0]!, granted: true }] },
    ]) expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected, units } }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, granted: true }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected,
      caseRef: { ...selection.caseRef, approved: true } } }, selection, stamp)).toBeNull()
    expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected,
      unitSelection: { ...value.selected.unitSelection, authorized: true } } }, selection, stamp)).toBeNull()
  })

  test("refuses a changed access revision or source outside the current installation and project", () => {
    const value = specimen()
    expect(sfReadSensitivityUnits({ ...value, accessRevision: "access:other" }, selection, stamp)).toBeNull()
    for (const source of [
      { ...value.selected.units.sourceRefs[0]!, installationId: "installation:other" },
      { ...value.selected.units.sourceRefs[0]!, projectId: "project:other" },
    ]) expect(sfReadSensitivityUnits({ ...value, selected: { ...value.selected,
      units: { ...value.selected.units, sourceRefs: [source] } } }, selection, stamp)).toBeNull()
  })

  test("dispatches only the original GET controls descriptor and exact selection through the client", async () => {
    const signal = new AbortController().signal
    const stopped = new Error("Structural dispatch probe: no response or source is issued")
    const calls: { id: string; input: unknown }[] = []
    const transport: SfTransport = { execute: async (operation, input, options) => {
      expect(operation).toBe(SfDecisions.operations["decisions.controls.read"])
      expect(operation.method).toBe("GET")
      expect(options.signal).toBe(signal)
      expect(options.idempotencyKey).toBeUndefined()
      calls.push({ id: operation.operationId, input })
      throw stopped
    } }
    await expect(sfSensitivityUnitsForSelection(transport, context([ready]), selection.ref, selection.caseRef,
      selection.scenarioRef, selection.baselineRef, selection.parameterRef, signal)).rejects.toBe(stopped)
    expect(calls).toEqual([{ id: "decisions.controls.read", input: {
      case: selection.ref, scenario: selection.scenarioRef, baseline: selection.baselineRef, parameter: selection.parameterRef,
    } }])
  })

  test("refuses absent, sibling, nonoperational or wrong-family availability before transport", async () => {
    const transport: SfTransport = { execute: async () => { throw new Error("A denied read must not dispatch") } }
    const signal = new AbortController().signal
    for (const source of [
      context([]),
      context([{ ...ready, operationId: "portfolio.decision-sensitivity-units" }], "portfolio"),
      context([{ ...ready, operationId: "decisions.decision-criteria" }]),
      context([{ ...ready, operational: false }]),
      context([{ ...ready, state: "unavailable" }]),
      context([ready], "portfolio"),
    ]) expect(await sfSensitivityUnitsForSelection(transport, source, selection.ref, selection.caseRef,
      selection.scenarioRef, selection.baselineRef, selection.parameterRef, signal))
      .toEqual({ status: "failed", state: "denied", reason: "sensitivity-units-not-admitted" })
  })

  test("refuses incomplete or same-scenario selections before transport", async () => {
    const transport: SfTransport = { execute: async () => { throw new Error("An invalid selection must not dispatch") } }
    const signal = new AbortController().signal
    for (const [reference, scenario, baseline, parameter] of [
      ["", selection.scenarioRef, selection.baselineRef, selection.parameterRef],
      [selection.ref, "", selection.baselineRef, selection.parameterRef],
      [selection.ref, selection.scenarioRef, selection.baselineRef, ""],
      [selection.ref, selection.scenarioRef, selection.scenarioRef, selection.parameterRef],
    ]) expect(await sfSensitivityUnitsForSelection(transport, context([ready]), reference!, selection.caseRef,
      scenario!, baseline!, parameter!, signal))
      .toEqual({ status: "failed", state: "invalid", reason: "sensitivity-units-input-mismatch" })
  })
})
