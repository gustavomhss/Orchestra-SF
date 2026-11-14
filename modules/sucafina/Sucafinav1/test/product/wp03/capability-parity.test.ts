import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import type { Mcp } from "@orchestra/core/mcp"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createSfBusinessMcpBridge } from "../../../product/host-binding/sf-mcp-bridge.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { selection } from "../wp10/resident-runtime/fixture.ts"
import { plannerFixture, plannerPeriod } from "./planner-fixture.ts"

// This is deterministic boundary integration: actual SDK, dispatch, private registries,
// schemas, storage, scoped sources and Planner. The synthetic skill admission is not GNATIVE.
test("C16 forecast UI and private MCP reach the same real Planner and return bound, schema-valid output", async () => {
  const fixture = await plannerFixture()
  try {
    const read = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const issued = await Promise.all(["v0", "v1"].map((id) => fixture.issueSource(id, read)))
    if (issued[0]!.status !== "ok" || issued[1]!.status !== "ok") throw new Error("sources unavailable")
    const payload = { baseRef: issued[0]!.value.evidence.refId, candidateRef: issued[1]!.value.evidence.refId, period: plannerPeriod, currency: "USD" }
    const descriptors = createPlannerCapabilities(fixture.planner, fixture.authority.receiptFor)
    const operations = ["sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare"] as const
    const dispatch = (operation: string, request: unknown, context: TrustedDomainContext) => dispatchSfCapability({ operation, payload: request, context, descriptors, authority: fixture.authority,
      validateInput: (descriptor, value) => { const selected = operations.find((id) => id === descriptor.id); return !!selected && decodeSfOperationInput(selected, value).ok },
      validateOutput: (descriptor, value) => { const selected = operations.find((id) => id === descriptor.id); return value.status !== "ok" || !!selected && decodeSfOperationOutput(selected, value.result).ok },
    })
    const before = await fixture.readSnapshot()
    const uiContext = await fixture.admit("sf_forecast_compare", payload)
    const human = await dispatch("sf_forecast_compare", payload, uiContext)
    expect(human).toMatchObject({ status: "ok", result: { knownDifference: 12000, completeDifference: null, comparison: { comparisonStatus: "conditioned" } }, receipt: { kind: "ui", handlerExport: "compareForecast", inputDigest: digestSfValue(payload), principalRef: "finance" } })
    if (human.status !== "ok") throw new Error("UI dispatch failed")
    expect(decodeSfOperationOutput("sf_forecast_compare", human.result).ok).toBe(true)
    expect(human.receipt).toMatchObject({ resultDigest: digestSfValue(human.result) })
    expect(await dispatch("sf_forecast_compare", payload, uiContext)).toMatchObject({ status: "denied", reason: "authority-unavailable" })
    expect(await dispatch("sf_forecast_compare", payload, structuredClone(uiContext))).toMatchObject({ status: "denied" })

    const sessionID = SessionSchema.ID.make("ses_wp03_c16_finance")
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance fixture", sourcePath: "profile.json", sourceDigest: "a".repeat(64), allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["FinancialAnalysis"], contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const receipt: SkillLoadReceipt = { runId: "wp03-boundary-fixture", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "msg_wp03_loaded", loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64) }
    const bound = await fixture.registry.bind({ request: new Request("https://example.test/planner", { headers: { authorization: "finance" } }), selected: selection(profile), sessionID, runId: receipt.runId, caseRef: { id: "case", incarnation: "case-incarnation", version: 1 }, profile, manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
    expect(bound.status).toBe("ok")
    if (bound.status !== "ok") throw new Error("native fixture binding failed")
    const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_wp03_assistant"), toolCallID: "call-wp03" }
    const mcp = { config: () => Effect.succeed({}) } as unknown as Mcp.Interface
    const bridge = createSfBusinessMcpBridge({ registry: fixture.registry, mcp, descriptors, dispatch })
    expect(await bridge.list({ ...context, toolCallID: "catalog" })).toMatchObject({ status: "ok", value: [{ id: "sf_forecast_compare" }] })
    const native = await bridge.call(context, "sf_forecast_compare", payload)
    expect(native).toMatchObject({ status: "ok", receipt: { kind: "native", handlerExport: "compareForecast", nativeSessionId: sessionID, runId: receipt.runId, inputDigest: digestSfValue(payload), principalRef: "finance" } })
    if (native.status !== "ok") throw new Error("private MCP dispatch failed")
    expect(native.result).toEqual(human.result)
    expect(native.receipt).toMatchObject({ resultDigest: digestSfValue(human.result) })
    expect(await fixture.readSnapshot()).toEqual(before)
    expect(await bridge.call(context, "sf_forecast_compare", payload)).toMatchObject({ status: "denied" })
    expect(await bridge.call({ ...context, toolCallID: "not-granted" }, "sf_scenario_simulate", { baseRef: payload.baseRef, operations: [], assumptions: [] })).toMatchObject({ status: "denied", reason: "operation-not-granted" })
    const namesake = createSfBusinessMcpBridge({ registry: fixture.registry, mcp: { config: () => Effect.succeed({ Sucafina_Workbench: {} }) } as unknown as Mcp.Interface, descriptors, dispatch })
    expect(await namesake.call({ ...context, toolCallID: "namesake" }, "sf_forecast_compare", payload)).toMatchObject({ status: "provider-conflict" })

    const malformed = [
      { operation: "sf_forecast_compare", value: { ...payload, actor: "admin" } },
      { operation: "sf_scenario_simulate", value: { baseRef: payload.baseRef, operations: [], assumptions: [], principalRef: "admin" } },
      { operation: "sf_scenario_compare", value: { scenarioRefs: ["a", "b"], criteria: [], grantProfiles: ["sf_finance"] } },
    ]
    for (const entry of malformed) {
      const admitted = await fixture.admit(entry.operation, entry.value)
      expect(await dispatch(entry.operation, entry.value, admitted)).toMatchObject({ status: "denied", reason: "invalid-operation-input" })
    }
    await fixture.persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { id: string; lines: { f: number[] }[] }[]
      versions.find((version) => version.id === "v1")!.lines[0]!.f[10] = 125000
      return { commit: true, value: undefined }
    })
    expect(await dispatch("sf_forecast_compare", payload, await fixture.admit("sf_forecast_compare", payload))).toMatchObject({ status: "stale", reason: "source-replaced-or-changed" })
    expect(await bridge.call({ ...context, toolCallID: "stale-source" }, "sf_forecast_compare", payload)).toMatchObject({ status: "stale", reason: "source-replaced-or-changed" })
    const revoked = await fixture.admit("sf_forecast_compare", payload)
    fixture.access.revision = "2"
    expect(await dispatch("sf_forecast_compare", payload, revoked)).toMatchObject({ status: "denied" })
    expect(await bridge.call({ ...context, toolCallID: "revoked" }, "sf_forecast_compare", payload)).toMatchObject({ status: "denied" })
  } finally { await fixture.close() }
})
