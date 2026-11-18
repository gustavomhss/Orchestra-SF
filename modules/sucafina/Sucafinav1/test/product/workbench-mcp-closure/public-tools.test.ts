import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionMessage } from "@orchestra/core/session/message"
import type { ToolRegistry } from "@orchestra/core/tool/registry"
import { Effect } from "effect"
import { createSfProductDispatch } from "../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import type { SfVerifiedCallObserver } from "../../../product/host-binding/verified-call.ts"
import { createPlannerCapabilities } from "../../../product/planner/capabilities.ts"
import { plannerFixture, plannerPeriod } from "../wp03/planner-fixture.ts"
import { withSkillHost } from "./skill-host-fixture.ts"

// Component-public-runtime proof: public Host.Contribution/Tools registration,
// real SessionV2.skill receipts, SDK bridge and actual SQLite-backed Planner.
// Planner Request authority and run/case/tool-context labels are synthetic.
// Existing fixture grants: finance -> Planner finance, admin -> Planner admin;
// both distinct actors bind the same resident sf_finance profile.
// No Task admission, provider turn, Relay or AM01/AM02 completion is implied.
test("public SF tool registration executes the real loaded forecast skill route with UI parity and session isolation", async () => {
  const fixture = await plannerFixture()
  const captures: Parameters<SfVerifiedCallObserver>[] = []
  try {
    const forecast = createPlannerCapabilities(fixture.planner, fixture.authority.receiptFor).find((descriptor) => descriptor.id === "sf_forecast_compare")!
    const descriptors = [forecast]
    const dispatch = createSfProductDispatch({ descriptors, authority: fixture.authority })
    const principals = ["finance", "admin"] as const
    const payloads = await Promise.all(principals.map(async (principal, index) => {
      const read = await fixture.admit("sf-human:planner.read", {}, principal, true)
      try {
        const issued = await Promise.all(["v0", `v${index + 1}`].map((id) => fixture.issueSource(id, read)))
        const refs = issued.map((source) => {
          if (source.status !== "ok") throw new Error(`Real Planner source unavailable: ${source.reason}`)
          return source.value.evidence.refId
        })
        return { baseRef: refs[0]!, candidateRef: refs[1]!, period: plannerPeriod, currency: "USD" }
      } finally { fixture.ui.finish(read) }
    }))
    const before = await fixture.readSnapshot()
    const human = await Promise.all(payloads.map(async (payload, index) => {
      const context = await fixture.admit(forecast.id, payload, principals[index]!)
      try {
        const result = await dispatch(forecast.id, payload, context)
        if (result.status !== "ok") throw new Error(`Real UI Planner dispatch refused: ${result.reason}`)
        return result
      } finally { fixture.ui.finish(context) }
    }))
    expect(human[0]!.result).toMatchObject({ knownDifference: 12000, completeDifference: null, comparison: { comparisonStatus: "conditioned" } })
    expect(human[1]!.result).toMatchObject({ knownDifference: 6000, completeDifference: null, comparison: { comparisonStatus: "conditioned" } })

    const evidence = await withSkillHost((host) => Effect.gen(function* () {
      const parent = host.bundle.selected.find((item) => item.profile.id === "sf_finance")!
      const skill = parent.skills.find((item) => item.id === "sf-explicar-forecast")!
      const selected = { ...parent, skills: [skill], operationIds: [forecast.id] }
      const agent = yield* host.agents.get(AgentV2.ID.make(parent.profile.id))
      if (!agent) throw new Error("SF finance profile was not registered by the public contribution")
      const materialized = yield* host.tools.materialize(agent.permissions)
      expect(materialized.definitions.filter((definition) => definition.name.startsWith("sf_")).map((definition) => definition.name)).toEqual([forecast.id])
      for (const unavailable of ["sf_approve", "sf_apply", "sf_routine_run", "sf_watch_prepare"])
        expect(materialized.definition(unavailable)).toBeUndefined()
      expect(materialized.registrationIdentity(forecast.id)).toBe(host.tools.currentRegistrationIdentity(forecast.id))
      const settle = (input: ToolRegistry.ExecuteInput) => materialized.settle(input).pipe(Effect.provide(host.locations.get(host.location)))
      const prepared = []
      for (const index of [0, 1]) {
        const created = yield* host.session.create({ location: host.location, agent: agent.id })
        const receipt = yield* loadSfSkill({ session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
          selected, sessionID: created.id, profile: selected.profile, skill, runId: `component-public-forecast-${index}`,
          manifestDigest: selected.manifestDigest })
        const loaded = yield* host.session.messages({ sessionID: created.id })
        expect(loaded).toHaveLength(1)
        expect(loaded[0]).toMatchObject({ id: receipt.loadedMessageId, type: "synthetic" })
        expect(receipt).toMatchObject({ nativeSessionId: created.id, profileId: selected.profile.id,
          sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest, manifestDigest: host.bundle.manifestDigest })
        expect((yield* host.session.context(created.id)).map((message) => message.id)).toContain(receipt.loadedMessageId)
        const binding = yield* Effect.promise(() => fixture.registry.bind({
          request: new Request("https://example.test/component-public-forecast", { headers: { authorization: principals[index]! } }),
          selected, sessionID: created.id, runId: receipt.runId, caseRef: { id: `component-case-${index}`, incarnation: `component-inc-${index}`, version: 1 },
          profile: selected.profile, manifestDigest: selected.manifestDigest, skillReceipts: [receipt], entryMode: "interactive",
        }))
        if (binding.status !== "ok") throw new Error(`Component authority refused actual loading receipt: ${binding.reason}`)
        const input: ToolRegistry.ExecuteInput = { sessionID: created.id, agent: agent.id, assistantMessageID: SessionMessage.ID.create(),
          call: { type: "tool-call", id: `component-call-${index}`, name: forecast.id, input: payloads[index]! } }
        prepared.push({ created, receipt, binding: binding.value, input })
      }
      const settlements = yield* Effect.all(prepared.map((item) => settle(item.input)), { concurrency: 2 })
      const admitted = prepared.map((item, index) => {
        const { created, receipt } = item
        const settlement = settlements[index]!
        const result = settlement.output?.structured
        if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("result" in result) || !("receipt" in result))
          throw new Error("The public tool did not return a successful capability result")
        expect(result).toMatchObject({ status: "ok", receipt: { kind: "native", nativeSessionId: created.id, runId: receipt.runId,
          principalRef: principals[index], operation: forecast.id, handlerExport: "compareForecast", inputDigest: digestSfValue(payloads[index]!), resultDigest: digestSfValue(human[index]!.result) } })
        const decoded = decodeSfOperationOutput("sf_forecast_compare", result.result)
        if (!decoded.ok) throw new Error("The public tool did not return a schema-valid FinancialAnalysis")
        expect(decoded.value).toEqual(human[index]!.result)
        expect(decoded.value.knownDifference).toBe(index === 0 ? 12000 : 6000)
        expect(decoded.value).toMatchObject({ baseline: { context: { principalRef: principals[index] } }, candidate: { context: { principalRef: principals[index] } } })
        expect(decoded.value.sourceRefs.map((ref) => ref.refId)).toEqual([payloads[index]!.baseRef, payloads[index]!.candidateRef])
        expect(result.receipt).not.toEqual(human[index]!.receipt)
        return { ...item, result }
      })
      expect(admitted[0]!.created.id).not.toBe(admitted[1]!.created.id)
      expect(admitted[0]!.receipt.loadedMessageId).not.toBe(admitted[1]!.receipt.loadedMessageId)
      expect(admitted[0]!.binding.principalRef).not.toBe(admitted[1]!.binding.principalRef)
      expect(captures).toHaveLength(2)
      for (const [index, item] of admitted.entries()) {
        const matching = captures.filter((capture) => capture[3].binding.nativeSessionId === item.created.id)
        expect(matching).toHaveLength(1)
        expect(matching[0]![3].binding).toMatchObject({ runId: item.receipt.runId, principalRef: principals[index] })
        expect(matching[0]![1]).toEqual(payloads[index])
      }
      for (const capture of captures) {
        expect(yield* Effect.promise(() => fixture.registry.revalidate(capture[3]))).toBe(false)
        expect(fixture.registry.requestFor(capture[3])).toBeUndefined()
      }

      const first = admitted[0]!
      const second = admitted[1]!
      const replay = yield* settle(first.input)
      expect(replay.output?.structured).toMatchObject({ status: "denied", reason: "native-call-already-issued", receipt: { kind: "unbound" } })
      expect(Object.hasOwn(replay.output?.structured ?? {}, "result")).toBe(false)
      const rawToken = "SYNTHETIC_PUBLIC_TOOL_TOKEN_CANARY"
      const malformed = yield* settle({ ...first.input, call: { ...first.input.call, id: "component-malformed",
        input: { ...payloads[0]!, principalRef: "other-principal", projectId: "other-project", token: rawToken } } })
      expect(malformed.output?.structured).toMatchObject({ status: "denied", reason: "invalid-operation-input", receipt: { kind: "unbound" } })
      expect(JSON.stringify(malformed)).not.toContain(rawToken)
      expect(Object.hasOwn(malformed.output?.structured ?? {}, "result")).toBe(false)
      const unbound = yield* host.session.create({ location: host.location, agent: agent.id })
      const noBinding = yield* settle({ ...first.input, sessionID: unbound.id, call: { ...first.input.call, id: "component-unbound" } })
      expect(noBinding.output?.structured).toMatchObject({ status: "denied", reason: "native-context-unavailable", receipt: { kind: "unbound" } })
      expect(captures).toHaveLength(2)

      fixture.registry.revoke(first.binding)
      const revoked = yield* settle({ ...first.input, call: { ...first.input.call, id: "component-revoked" } })
      expect(revoked.output?.structured).toMatchObject({ status: "denied", reason: "native-context-unavailable", receipt: { kind: "unbound" } })
      const survivor = yield* settle({ ...second.input, call: { ...second.input.call, id: "component-other-session" } })
      expect(survivor.output?.structured).toMatchObject({ status: "ok", result: { knownDifference: 6000 }, receipt: {
        nativeSessionId: second.created.id, runId: second.receipt.runId, principalRef: principals[1], inputDigest: digestSfValue(payloads[1]!), resultDigest: digestSfValue(human[1]!.result) } })
      const survived = survivor.output?.structured
      if (!survived || typeof survived !== "object" || !("result" in survived)) throw new Error("The other session did not preserve its independent result")
      expect(survived.result).toEqual(human[1]!.result)
      expect(captures).toHaveLength(3)
      fixture.access.allowed = false
      const revokedAuthority = yield* settle({ ...second.input, call: { ...second.input.call, id: "component-authority-revoked" } })
      expect(revokedAuthority.output?.structured).toMatchObject({ status: "denied", receipt: { kind: "unbound" } })
      expect(Object.hasOwn(revokedAuthority.output?.structured ?? {}, "result")).toBe(false)
      expect(captures).toHaveLength(3)
      expect(yield* host.session.active).toEqual(new Set())
      for (const item of admitted)
        expect((yield* host.session.messages({ sessionID: item.created.id })).every((message) => message.type === "synthetic")).toBe(true)
      return admitted.map((item, index) => ({ principal: principals[index], skillReceipt: item.receipt, toolReceipt: item.result.receipt,
        inputDigest: digestSfValue(payloads[index]!), resultDigest: digestSfValue(human[index]!.result),
        knownDifference: index === 0 ? 12000 : 6000, sourceRefs: [payloads[index]!.baseRef, payloads[index]!.candidateRef] }))
    }), { registry: fixture.registry, authority: fixture.authority, descriptors,
      onVerifiedCall: (...args) => { captures.push(args); return true } })
    expect(await fixture.readSnapshot()).toEqual(before)
    console.info("SF68_PUBLIC_TOOL_RUNTIME", JSON.stringify({
      scope: "component-public-runtime", actual: ["SessionV2.skill loading", "Tools.Service registration", "ToolRegistry materialize/settle", "private MCP SDK", "Planner domain", "SQLite persistence", "UI dispatch parity"],
      synthetic: ["Request authority for finance/admin", "case/run labels", "assistantMessageID/tool-call context"],
      isolation: { scheduling: "Effect.all concurrency 2", actors: [...principals], residentProfile: "sf_finance" },
      excluded: ["Task admission", "provider model execution", "Relay", "Schedule", "AM01/AM02 completion"], evidence,
    }))
  } finally { await fixture.close() }
}, 30_000)
