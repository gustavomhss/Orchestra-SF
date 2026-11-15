import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import {
  SfAnalyses,
  SfIntelligenceAnalysisCancel,
  SfIntelligenceAnalysisList,
  SfIntelligenceAnalysisPrepareInput,
  SfIntelligenceAnalysisStartInput,
  SfProjectionResidents,
} from "../../../../../packages/schema/src/sucafina/analyses"

const stamp = {
  installationId: "installed", projectId: "project", hostId: "current-host",
  principalRef: "current-principal", policyVersion: "policy", accessRevision: "access",
}

describe("A15 / native analysis wire contracts", () => {
  test("prepare selection accepts an installed-skill JSON map with Effect 4 positional Record", () => {
    const request = {
      caseRef: { id: "case-1", incarnation: "inc-1", version: 1 },
      objective: "Explain the current forecast",
      profileId: "sf_finance", profileVersion: "v1",
      skillId: "sf-explicar-forecast", skillVersion: "v1",
      manifestDigest: "digest", outputSchemaVersion: "sf-contribution-v1",
      requestedOperationScope: ["sf_dashboard_read"],
    }
    const selection = {
      forecast: { amount: 0, confirmed: false, note: null, periods: [0, null, "current"] },
      context: { filters: { years: [2025, 2026] } },
    }
    const input = { input: { request, selection } }
    expect(Schema.decodeUnknownSync(SfIntelligenceAnalysisPrepareInput)(
      input, { onExcessProperty: "error" },
    )).toEqual(input)

    // Skill-specific keys are intentionally dynamic JSON, not an opaque grant
    // and not a reason to accept extra fields on the enclosing request.
    expect(() => Schema.decodeUnknownSync(SfIntelligenceAnalysisPrepareInput)({
      input: { request, selection: { forecast: undefined } },
    }, { onExcessProperty: "error" })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfIntelligenceAnalysisPrepareInput)({
      input: { request: { ...request, forgedOwner: "admin" }, selection },
    }, { onExcessProperty: "error" })).toThrow()
  })

  test("binds exactly seven producer analysis actions and the residents projection", () => {
    expect(Object.keys(SfAnalyses.operations).sort()).toEqual([
      "intelligence.analysis.cancel",
      "intelligence.analysis.choices",
      "intelligence.analysis.list",
      "intelligence.analysis.output",
      "intelligence.analysis.prepare",
      "intelligence.analysis.read",
      "intelligence.analysis.start",
      "projection.residents",
    ])
    for (const [operationId, operation] of Object.entries(SfAnalyses.operations)) {
      expect(operation.operationId).toBe(operationId)
    }
  })

  test("retains zero versions, false cancellation, and absent optional outputRef", () => {
    const list = { status: "ok", value: [{ runRef: "r1", state: "queued", version: 0 }] }
    expect(Schema.decodeUnknownSync(SfIntelligenceAnalysisList)(list)).toEqual(list)
    expect(Schema.decodeUnknownSync(SfIntelligenceAnalysisCancel)({
      status: "ok", value: { cancelled: false },
    })).toEqual({ status: "ok", value: { cancelled: false } })
  })

  test("rejects unexpected action and request additions before transport", () => {
    const base = {
      input: {
        request: {
          caseRef: { id: "c", incarnation: "i", version: 1 },
          objective: "Evaluate the current decision",
          profileId: "sf_finance", profileVersion: "v1",
          skillId: "sf-explicar-forecast", skillVersion: "v1",
          manifestDigest: "digest", outputSchemaVersion: "sf-contribution-v1",
          requestedOperationScope: ["sf_dashboard_read"],
        },
        skillInput: {},
        model: { providerID: "provider", id: "model" },
      },
    }
    expect(Schema.decodeUnknownSync(SfIntelligenceAnalysisStartInput)(base, {
      onExcessProperty: "error",
    })).toEqual(base)
    expect(() => Schema.decodeUnknownSync(SfIntelligenceAnalysisStartInput)({
      ...base, action: "arbitrary",
    }, { onExcessProperty: "error" })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfIntelligenceAnalysisStartInput)({
      input: { ...base.input, extraPrivilege: true },
    }, { onExcessProperty: "error" })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfIntelligenceAnalysisStartInput)({
      input: { ...base.input, request: { ...base.input.request, accessRevision: "forged" } },
    }, { onExcessProperty: "error" })).toThrow()
  })

  test("residents accept only the sanitized actual installed/granted field projection", () => {
    const publicValue = {
      status: "ok", context: stamp, value: {
        profiles: [{
          id: "sf_finance", version: "1", mission: "Analyze cases",
          skills: [{
            id: "sf-explicar-forecast", version: "1",
            allowedOperations: ["sf_dashboard_read"],
            outputSchemaRefs: ["FinancialAnalysis"],
          }],
        }],
      },
    }
    expect(Schema.decodeUnknownSync(SfProjectionResidents)(
      publicValue, { onExcessProperty: "error" },
    )).toEqual(publicValue)

    expect(() => Schema.decodeUnknownSync(SfProjectionResidents)({
      ...publicValue, value: {
        profiles: [{ ...publicValue.value.profiles[0], sourcePath: "/private/profile.md" }],
      },
    }, { onExcessProperty: "error" })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfProjectionResidents)({
      ...publicValue, value: {
        profiles: [{
          ...publicValue.value.profiles[0],
          skills: [{ ...publicValue.value.profiles[0]!.skills[0], instructionsDigest: "private" }],
        }],
      },
    }, { onExcessProperty: "error" })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfProjectionResidents)({
      ...publicValue, context: { ...stamp, token: "must-not-leak" },
    }, { onExcessProperty: "error" })).toThrow()
  })

  test("never decodes a privileged run snapshot as the public read output", () => {
    expect(() => Schema.decodeUnknownSync(SfAnalyses.operations["intelligence.analysis.read"].output)({
      status: "ok", value: {
        runRef: "r1", state: "ready", version: 2,
        selection: { profile: { sourcePath: "/private" } },
      },
    }, { onExcessProperty: "error" })).toThrow()
  })
})
