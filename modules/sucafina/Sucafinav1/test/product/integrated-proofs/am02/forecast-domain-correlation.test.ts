import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionMessage } from "@orchestra/core/session/message"
import type { ToolRegistry } from "@orchestra/core/tool/registry"
import { Effect } from "effect"
import { createSfProductDispatch } from "../../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PlannerPort } from "../../../../product/contracts/ports.ts"
import { loadSfSkill } from "../../../../product/host-binding/skill-loader.ts"
import { createPlannerCapabilities } from "../../../../product/planner/capabilities.ts"
import { plannerFixture, plannerPeriod } from "../../wp03/planner-fixture.ts"
import { withSkillHost } from "../../workbench-mcp-closure/skill-host-fixture.ts"

// AM02 gap: trace a verified public tool through the entered real domain port,
// host-private operation identity and C16 receipt, then compare its UI result.
// Real SQLite Planner, SkillV2/SessionV2, ToolRegistry and private MCP SDK.
// The fixture identity, run/case and assistant messages are synthetic; this is
// NOT provider inference, native Task admission or an integrated AM02 PASS.
test("AM02 Planner correlates UI and agent/MCP domain calls, receipt and forbidden inputs", async () => {
  const fixture = await plannerFixture()
  const entered: { surface: "ui" | "native"; domainCallID: string | undefined;
    principal: string; accessRevision: string; caseVersion?: number; caseIncarnation?: string;
    inputDigest: string }[] = []
  const observed: { callID: string; domainCallID: string | undefined; runID: string;
    principal: string; resultDigest: string; inputDigest: string; handlerExport: string;
    nativeSessionID: string }[] = []
  try {
    const port: PlannerPort = {
      ...fixture.planner,
      compareForecast: async (payload, context) => {
        entered.push({
          surface: context.kind,
          domainCallID: context.kind === "native"
            ? fixture.registry.operationIdentity?.(context)
            : fixture.ui.operationIdentity(context),
          principal: context.binding.principalRef,
          accessRevision: context.binding.accessRevision,
          ...(context.kind === "native"
            ? { caseVersion: context.binding.caseVersion, caseIncarnation: context.binding.caseIncarnation } : {}),
          inputDigest: digestSfValue(payload),
        })
        return fixture.planner.compareForecast(payload, context)
      },
    }
    const forecast = createPlannerCapabilities(port, fixture.authority.receiptFor)
      .find((item) => item.id === "sf_forecast_compare")
    if (!forecast) throw new Error("Installed Planner operation missing")
    const dispatch = createSfProductDispatch({ descriptors: [forecast], authority: fixture.authority })
    const sourceCall = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const references: string[] = []
    try {
      for (const version of ["v0", "v1"]) {
        const issued = await fixture.issueSource(version, sourceCall)
        if (issued.status !== "ok") throw new Error("Real Planner source missing")
        references.push(issued.value.evidence.refId)
      }
    } finally {
      fixture.ui.finish(sourceCall)
    }
    const payload = { baseRef: references[0]!, candidateRef: references[1]!,
      period: plannerPeriod, currency: "USD" }
    const before = await fixture.readSnapshot()
    const uiCall = await fixture.admit(forecast.id, payload, "finance")
    const human = await dispatch(forecast.id, payload, uiCall)
    const uiCommandID = fixture.ui.operationIdentity(uiCall)
    fixture.ui.finish(uiCall)
    expect(human.status).toBe("ok")
    if (human.status !== "ok") throw new Error("UI Planner dispatch failed")
    expect(human.receipt).toMatchObject({ kind: "ui", operation: forecast.id,
      handlerExport: "compareForecast", principalRef: "finance", inputDigest: digestSfValue(payload),
      resultDigest: digestSfValue(human.result), callId: uiCall.binding.requestId,
      requestId: uiCall.binding.requestId })
    expect(entered).toHaveLength(1)
    expect(entered[0]).toMatchObject({ surface: "ui", principal: "finance", domainCallID: uiCommandID,
      inputDigest: digestSfValue(payload), accessRevision: "1" })
    expect(uiCommandID).toBe(forecast.id + ":" + digestSfValue(payload))

    const answer = await withSkillHost((host) => Effect.gen(function* () {
      const registered = host.bundle.selected.find((item) => item.profile.id === "sf_finance")
      const skill = registered?.skills.find((item) => item.id === "sf-explicar-forecast")
      if (!registered || !skill) throw new Error("Canonical forecast skill unavailable")
      const selected = { ...registered, skills: [skill], operationIds: [forecast.id] }
      const agent = yield* host.agents.get(AgentV2.ID.make(registered.profile.id))
      if (!agent) throw new Error("Registered profile unavailable")
      const session = yield* host.session.create({ location: host.location, agent: agent.id })
      const receipt = yield* loadSfSkill({
        session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
        selected, sessionID: session.id, profile: selected.profile, skill,
        runId: "am02-component-correlation", manifestDigest: selected.manifestDigest,
      })
      const messages = yield* host.session.messages({ sessionID: session.id })
      expect(messages.find((message) => message.id === receipt.loadedMessageId))
        .toMatchObject({ type: "synthetic" })
      const binding = yield* Effect.promise(() => fixture.registry.bind({
        request: new Request("https://example.test/am02-correlation", {
          headers: { authorization: "finance" },
        }),
        selected, sessionID: session.id, runId: receipt.runId,
        caseRef: { id: "am02-component-case", version: 7, incarnation: "am02-component-incarnation" },
        profile: selected.profile, manifestDigest: selected.manifestDigest,
        skillReceipts: [receipt], entryMode: "interactive",
      }))
      if (binding.status !== "ok") throw new Error("Loaded skill not bound: " + binding.reason)
      const materialized = yield* host.tools.materialize(agent.permissions)
      expect(materialized.registrationIdentity(forecast.id))
        .toBe(host.tools.currentRegistrationIdentity(forecast.id))
      const settle = (input: ToolRegistry.ExecuteInput) =>
        materialized.settle(input).pipe(Effect.provide(host.locations.get(host.location)))
      const call: ToolRegistry.ExecuteInput = {
        sessionID: session.id, agent: agent.id, assistantMessageID: SessionMessage.ID.create(),
        call: { type: "tool-call", id: "am02-bridge-call-forecast", name: forecast.id, input: payload },
      }
      const settlement = yield* settle(call)
      const native = settlement.output?.structured
      if (!native || typeof native !== "object" || !("status" in native) ||
        native.status !== "ok" || !("result" in native) || !("receipt" in native))
        throw new Error("Public ToolRegistry/private MCP did not return the domain result")
      expect(native.result).toEqual(human.result)
      expect(native.receipt).toMatchObject({ kind: "native", operation: forecast.id,
        callId: call.call.id, handlerExport: forecast.handlerExport, inputDigest: digestSfValue(payload),
        resultDigest: digestSfValue(human.result), principalRef: "finance", accessRevision: "1",
        nativeSessionId: session.id, runId: receipt.runId, providerGeneration: 1 })
      const callCount = entered.length
      const forged = yield* settle({ ...call, call: { ...call.call,
        id: "am02-forged-authority", input: {
          ...payload, actor: "other", role: "admin", projectId: "forged-project",
        } } })
      expect(forged.output?.structured).toMatchObject({ status: "denied",
        reason: "invalid-operation-input", receipt: { kind: "unbound" } })
      expect(entered).toHaveLength(callCount)
      expect(JSON.stringify(forged)).not.toContain("forged-project")
      fixture.registry.revoke(binding.value)
      const afterRevoke = yield* settle({ ...call, call: {
        ...call.call, id: "am02-revoked", input: payload,
      } })
      expect(afterRevoke.output?.structured).toMatchObject({ status: "denied",
        reason: "native-context-unavailable", receipt: { kind: "unbound" } })
      expect(entered).toHaveLength(callCount)
      return { receipt, native, caseVersion: binding.value.caseVersion,
        caseIncarnation: binding.value.caseIncarnation }
    }), {
      registry: fixture.registry, authority: fixture.authority, descriptors: [forecast],
      onVerifiedCall: (operation, input, result, context) => {
        if (operation !== forecast.id || result.receipt.kind !== "native") return false
        observed.push({
          callID: result.receipt.callId,
          domainCallID: fixture.registry.operationIdentity?.(context),
          runID: context.binding.runId,
          principal: context.binding.principalRef,
          inputDigest: digestSfValue(input), resultDigest: digestSfValue(result.result),
          handlerExport: result.receipt.handlerExport,
          nativeSessionID: context.binding.nativeSessionId,
        })
        return true
      },
    })
    expect(entered).toHaveLength(2)
    expect(entered[1]).toMatchObject({ surface: "native", principal: "finance",
      caseVersion: 7, caseIncarnation: "am02-component-incarnation",
      inputDigest: digestSfValue(payload), accessRevision: "1" })
    expect(observed).toHaveLength(1)
    expect(observed[0]).toMatchObject({
      callID: "am02-bridge-call-forecast", runID: answer.receipt.runId,
      nativeSessionID: answer.receipt.nativeSessionId, handlerExport: "compareForecast",
      principal: "finance", inputDigest: digestSfValue(payload),
      resultDigest: digestSfValue(human.result), domainCallID: entered[1]!.domainCallID,
    })
    expect(observed[0]!.domainCallID).toMatch(/^[a-f0-9]{64}$/)
    expect(observed[0]!.domainCallID).not.toBe(observed[0]!.callID)
    expect(human.result).toMatchObject({ knownDifference: 12000, completeDifference: null })
    expect(await fixture.readSnapshot()).toEqual(before)
    console.info("AM02_PLANNER_COMPONENT_CORRELATION", JSON.stringify({
      classification: "component executable; integrated AM02 NOT_RUN",
      domain: "real SQLite Planner",
      surfaces: ["UI dispatch", "public ToolRegistry", "private MCP SDK"],
      synthetic: ["fixture principal", "run/case/assistant labels"],
      excluded: ["provider inference", "native Task admission", "other seven packs"],
      bridgeCallID: observed[0]!.callID, domainCallID: observed[0]!.domainCallID,
      outputDigest: observed[0]!.resultDigest, caseVersion: answer.caseVersion,
    }))
  } finally {
    await fixture.close()
  }
}, 30_000)
