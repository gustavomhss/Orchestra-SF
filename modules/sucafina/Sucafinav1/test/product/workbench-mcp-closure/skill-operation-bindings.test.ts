import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { PermissionV2 } from "@orchestra/core/permission"
import type { SessionV2 } from "@orchestra/core/session"
import { SessionMessage } from "@orchestra/core/session/message"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import resident from "../../../product/ai/manifests/resident.json" with { type: "json" }
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "../../../product/contracts/runtime.ts"
import type { TrustedCallContext } from "../../../product/contracts/sf-execution.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { withSkillHost } from "./skill-host-fixture.ts"

/** Real loaded-skill bindings, not business execution or native admission acceptance.
 * Request/principal/provider generation/run/call labels and input digests are component fixtures.
 * No operation receipt, provider message, Task, routine admission or domain result is manufactured.
 */
test("all 39 canonical operations bind to observed loaded skills and deny both old and new leases after revocation", async () => {
  const expected = new WeakMap<Request, { admission: SfNativeAdmission; session: SessionSchema.Info }>()
  let sessions: SessionV2.Interface | undefined
  const inspect = async (admission: SfNativeAdmission) => {
    const saved = expected.get(admission.request)
    if (!saved || !sessions || saved.admission.request !== admission.request || admission.request.signal.aborted) return undefined
    const { request: observedRequest, ...observed } = admission
    const { request: savedRequest, ...original } = saved.admission
    if (observedRequest !== savedRequest || digestSfValue(observed) !== digestSfValue(original)) return undefined
    const current = await Effect.runPromise(sessions.get(admission.sessionID))
    if (current.id !== saved.session.id || current.agent !== admission.profile.id || current.projectID !== saved.session.projectID ||
      digestSfValue(current.location) !== digestSfValue(saved.session.location)) return undefined
    const receipt = admission.skillReceipts[0]
    if (admission.skillReceipts.length !== 1 || !receipt) return undefined
    const message = await Effect.runPromise(sessions.message({ sessionID: current.id, messageID: SessionMessage.ID.make(receipt.loadedMessageId) }))
    return message?.type === "synthetic" && message.text.startsWith(`<skill_content name="${receipt.skillId}">\n`) ? saved : undefined
  }
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => {
      const saved = await inspect(admission)
      return saved ? {
        installationId: "component-installation-68", hostId: "component-host-68", projectId: saved.session.projectID,
        locationId: digestSfValue(saved.session.location), principalRef: "component-person-68",
        policyVersion: "component-policy-68", accessRevision: "component-access-68", providerGeneration: 68,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      } : undefined
    },
    revalidateAdmission: async (admission, binding) => {
      const saved = await inspect(admission)
      return !!saved && binding.installationId === "component-installation-68" && binding.hostId === "component-host-68" &&
        binding.principalRef === "component-person-68" && binding.policyVersion === "component-policy-68" &&
        binding.accessRevision === "component-access-68" && binding.providerGeneration === 68 &&
        binding.projectId === saved.session.projectID && binding.locationId === digestSfValue(saved.session.location) &&
        binding.nativeSessionId === saved.session.id && binding.profileId === saved.admission.profile.id &&
        binding.runId === saved.admission.runId && binding.caseId === saved.admission.caseRef.id &&
        binding.caseVersion === saved.admission.caseRef.version && binding.caseIncarnation === saved.admission.caseRef.incarnation &&
        binding.manifestDigest === saved.admission.manifestDigest && digestSfValue(binding.skillReceipts) === digestSfValue(saved.admission.skillReceipts)
    },
  })
  const rows = await withSkillHost((host) => Effect.gen(function* () {
    sessions = host.session
    expect(host.registry).toBe(registry)
    const routes = resident.operation_call_routes
    expect(routes).toHaveLength(39)
    expect(new Set(routes.map((route) => route.operation_id)).size).toBe(39)
    const groups = new Map<string, typeof routes>()
    for (const route of routes) {
      const key = `${route.profile_id}/${route.skill_id}`
      const group = groups.get(key) ?? []
      group.push(route)
      groups.set(key, group)
    }
    // Canonical routing uses 14 profile/skill pairs (13 unique skills). The separate
    // 25-pair loading test covers all 18 distributed skills, including other grants.
    expect(groups.size).toBe(14)
    const proven: { operation: string; profile: string; skill: string; sessionID: string; loadedMessageID: string;
      sourceDigest: string; instructionsDigest: string; manifestDigest: string; revoked: true }[] = []
    for (const [index, group] of [...groups.values()].entries()) {
      const first = group[0]!
      const registered = host.bundle.selected.find((selected) => selected.profile.id === first.profile_id)
      const skill = registered?.skills.find((skill) => skill.id === first.skill_id)
      if (!registered || !skill) throw new Error(`Canonical skill route not distributed: ${first.operation_id}`)
      const selected: SfSelectedRuntime = { ...registered, skills: [skill], operationIds: group.map((route) => route.operation_id) }
      const agent = yield* host.agents.get(AgentV2.ID.make(selected.profile.id))
      if (!agent) throw new Error("Actual registered profile unavailable")
      const created = yield* host.session.create({ location: host.location, agent: agent.id })
      const request = new Request(`https://example.test/sf68-component-binding/${index}`)
      const runId = `component-binding-68-${index}`
      const receipt = yield* loadSfSkill({ session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
        selected, sessionID: created.id, profile: selected.profile, skill, runId, manifestDigest: host.bundle.manifestDigest })
      const messages = yield* host.session.messages({ sessionID: created.id })
      expect(messages).toHaveLength(1)
      expect(receipt.loadedMessageId).toBe(messages[0]!.id)
      const admission: SfNativeAdmission = { request, selected, sessionID: created.id, runId,
        caseRef: { id: `component-case-68-${index}`, version: 1, incarnation: "component-incarnation-68" },
        profile: selected.profile, manifestDigest: host.bundle.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" }
      expected.set(request, { admission, session: created })
      const admitted = yield* Effect.promise(() => registry.bind(admission))
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") throw new Error(`Component binding refused: ${admitted.reason}`)
      expect(Object.isFrozen(admitted.value)).toBe(true)
      expect(Object.isFrozen(admitted.value.skillReceipts)).toBe(true)
      expect(admitted.value.skillReceipts).toEqual([receipt])
      const leases: { route: typeof first; context: { sessionID: SessionSchema.ID; agent: AgentV2.ID;
        assistantMessageID: SessionMessage.ID; toolCallID: string }; digest: string; granted: TrustedCallContext }[] = []
      for (const route of group) {
        expect(PermissionV2.evaluate(route.operation_id, "*", agent.permissions).effect).toBe("allow")
        const context = { sessionID: created.id, agent: agent.id,
          assistantMessageID: SessionMessage.ID.make(`msg_component_binding_68_${index}`), toolCallID: `component-call-${route.operation_id}` }
        const digest = digestSfValue({ componentBindingProbe: route.operation_id })
        const granted = yield* Effect.promise(() => registry.lease(context, route.operation_id, digest))
        expect(granted.status).toBe("ok")
        if (granted.status !== "ok") throw new Error(`Canonical operation refused: ${route.operation_id}: ${granted.reason}`)
        expect(granted.value.binding).toBe(admitted.value)
        expect(yield* Effect.promise(() => registry.revalidate(granted.value))).toBe(true)
        const wrongProfile = yield* Effect.promise(() => registry.lease({ ...context,
          agent: AgentV2.ID.make(selected.profile.id === "sf_reviewer" ? "sf_finance" : "sf_reviewer") }, route.operation_id, digest))
        expect(wrongProfile.status).toBe("denied")
        leases.push({ route, context, digest, granted: granted.value })
      }
      registry.revoke(admitted.value)
      for (const { route, context, digest, granted } of leases) {
        expect(yield* Effect.promise(() => registry.revalidate(granted))).toBe(false)
        expect(registry.consume(granted, route.operation_id, digest)).toBe(false)
        const revoked = yield* Effect.promise(() => registry.lease({ ...context, toolCallID: `after-revoke-${route.operation_id}` }, route.operation_id, digest))
        expect(revoked).toEqual({ status: "denied", reason: "native-context-unavailable" })
        registry.finish(granted)
        proven.push({ operation: route.operation_id, profile: selected.profile.id, skill: skill.id,
          sessionID: created.id, loadedMessageID: receipt.loadedMessageId, sourceDigest: receipt.sourceDigest,
          instructionsDigest: receipt.instructionsDigest, manifestDigest: receipt.manifestDigest, revoked: true })
      }
      expect((yield* host.session.messages({ sessionID: created.id })).every((message) => message.type === "synthetic")).toBe(true)
    }
    expect(yield* host.session.active).toEqual(new Set())
    return proven
  }), { registry })
  expect(rows.map((row) => row.operation).sort()).toEqual(resident.operation_call_routes.map((route) => route.operation_id).sort())
  expect(rows).toHaveLength(39)
  expect(new Set(rows.map((row) => row.sessionID)).size).toBe(14)
  expect(new Set(rows.map((row) => row.loadedMessageID)).size).toBe(14)
  console.info("SF68_SKILL_OPERATION_BINDINGS", JSON.stringify({
    scope: "real SessionV2 loads and registry bindings/revocation; synthetic admission identity and call labels; no operation execution",
    unqualified: ["handler execution", "provider execution", "Task admission", "routine readiness"], rows,
  }))
}, 30_000)
