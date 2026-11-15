import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { PermissionV2 } from "@orchestra/core/permission"
import { SessionMessage } from "@orchestra/core/session/message"
import { Effect } from "effect"
import type { Scope } from "effect"
import resident from "../../../product/ai/manifests/resident.json" with { type: "json" }
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import type { SfBindingRegistry, SfNativeAdmission, SfSelectedRuntime } from "../../../product/contracts/runtime.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { withSkillHost } from "./skill-host-fixture.ts"
import type { SkillHost } from "./skill-host-fixture.ts"

type FenceFixture = {
  host: SkillHost
  registry: SfBindingRegistry
  admission: SfNativeAdmission
  receipt: SkillLoadReceipt
  expiry: { value?: string }
  authCalls: () => number
}

/** Session/skill/message/registry are real. Request authority, case/run/call labels,
 * principal and provider generation are explicitly synthetic component inputs.
 * This fixture never executes or advertises routines and supplies no Task/C07 admission.
 */
async function withFenceHost<A>(name: string, use: (fixture: FenceFixture) => Effect.Effect<A, unknown, Scope.Scope>) {
  const request = new Request(`https://example.test/sf68-component-fence/${name}`)
  const expiry: { value?: string } = {}
  let expected: SfNativeAdmission | undefined
  let projectId = ""
  let locationId = ""
  let authCalls = 0
  const matches = (admission: SfNativeAdmission) => {
    if (!expected || admission.request !== request || expected.request !== request || request.signal.aborted) return false
    const { request: ignoredCurrentRequest, ...current } = admission
    const { request: ignoredExpectedRequest, ...original } = expected
    return ignoredCurrentRequest === ignoredExpectedRequest && digestSfValue(current) === digestSfValue(original)
  }
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => {
      authCalls++
      return matches(admission) ? {
        installationId: "component-installation-68", hostId: "component-host-68", projectId, locationId,
        principalRef: "component-person-68", policyVersion: "component-policy-68", accessRevision: "component-access-68",
        providerGeneration: 68, expiresAt: expiry.value ?? new Date(Date.now() + 300_000).toISOString(),
      } : undefined
    },
    revalidateAdmission: async (admission, binding) => matches(admission) &&
      binding.installationId === "component-installation-68" && binding.hostId === "component-host-68" &&
      binding.projectId === projectId && binding.locationId === locationId && binding.principalRef === "component-person-68" &&
      binding.policyVersion === "component-policy-68" && binding.accessRevision === "component-access-68" && binding.providerGeneration === 68 &&
      binding.nativeSessionId === admission.sessionID && binding.runId === admission.runId && binding.profileId === admission.profile.id &&
      binding.caseId === admission.caseRef.id && binding.caseVersion === admission.caseRef.version &&
      binding.caseIncarnation === admission.caseRef.incarnation && binding.entryMode === admission.entryMode &&
      binding.manifestDigest === admission.manifestDigest && digestSfValue(binding.skillReceipts) === digestSfValue(admission.skillReceipts),
  })
  return withSkillHost((host) => Effect.gen(function* () {
    const parent = host.bundle.selected.find((selected) => selected.profile.id === "sf_maestro")!
    const skill = parent.skills.find((skill) => skill.id === "sf-preparar-revisao-executiva")!
    const operationIds = resident.operation_call_routes.filter((route) => route.profile_id === parent.profile.id &&
      route.skill_id === skill.id && route.operation_id.startsWith("sf_routine_")).map((route) => route.operation_id)
    expect(operationIds).toEqual(["sf_routine_catalog", "sf_routine_prepare", "sf_routine_run", "sf_routine_status", "sf_routine_result"])
    const selected: SfSelectedRuntime = { ...parent, skills: [skill], operationIds }
    const agent = yield* host.agents.get(AgentV2.ID.make(selected.profile.id))
    if (!agent) throw new Error("Actual Maestro resident profile unavailable")
    for (const operation of operationIds)
      expect(PermissionV2.evaluate(operation, "*", agent.permissions).effect).toBe("allow")
    const created = yield* host.session.create({ location: host.location, agent: agent.id })
    projectId = created.projectID
    locationId = digestSfValue(created.location)
    const runId = `component-admission-fence-${name}`
    const receipt = yield* loadSfSkill({ session: host.session, skills: host.skills, sourceCapability: host.sourceCapability,
      selected, sessionID: created.id, profile: selected.profile, skill, runId, manifestDigest: host.bundle.manifestDigest })
    const messages = yield* host.session.messages({ sessionID: created.id })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ id: receipt.loadedMessageId, type: "synthetic" })
    expect(receipt).toMatchObject({ nativeSessionId: created.id, profileId: selected.profile.id,
      sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest, manifestDigest: host.bundle.manifestDigest })
    expect((yield* host.session.context(created.id)).map<string>((message) => message.id)).toContain(receipt.loadedMessageId)
    const admission: SfNativeAdmission = { request, selected, sessionID: created.id, runId,
      caseRef: { id: `component-case-${name}`, version: 1, incarnation: `component-incarnation-${name}` },
      profile: selected.profile, manifestDigest: selected.manifestDigest, skillReceipts: [receipt], entryMode: "routine-result" }
    expected = admission
    const result = yield* use({ host, registry, admission, receipt, expiry, authCalls: () => authCalls })
    expect(yield* host.session.messages({ sessionID: created.id })).toEqual(messages)
    expect(yield* host.session.active).toEqual(new Set())
    console.info("SF68_SKILL_ADMISSION_FENCE", JSON.stringify({
      case: name, scope: "real loaded skill and registry fence; synthetic admission authority; no routine execution",
      skillReceipt: receipt, excluded: ["routine readiness", "Task/C07 admission", "provider execution"],
    }))
    return result
  }), { registry })
}

test("expired component admission is denied despite an observed real skill receipt", async () => {
  await withFenceHost("expired", (fixture) => Effect.gen(function* () {
    fixture.expiry.value = new Date(Date.now() - 60_000).toISOString()
    const admitted = yield* Effect.promise(() => fixture.registry.bind(fixture.admission))
    expect(admitted).toEqual({ status: "denied", reason: "native-authority-unavailable" })
    expect(fixture.authCalls()).toBe(1)
    const lease = yield* Effect.promise(() => fixture.registry.lease({ sessionID: fixture.admission.sessionID,
      agent: AgentV2.ID.make(fixture.admission.profile.id), assistantMessageID: SessionMessage.ID.make("msg_component_expired_fence"),
      toolCallID: "component-expired-catalog" }, "sf_routine_catalog", digestSfValue({ componentFence: "expired" })))
    expect(lease).toEqual({ status: "denied", reason: "native-context-unavailable" })
  }))
}, 30_000)

test("an admission without the observed skill receipt is denied before authority resolution", async () => {
  await withFenceHost("missing-receipt", (fixture) => Effect.gen(function* () {
    const admitted = yield* Effect.promise(() => fixture.registry.bind({ ...fixture.admission, skillReceipts: [] }))
    expect(admitted).toEqual({ status: "denied", reason: "invalid-native-admission" })
    expect(fixture.authCalls()).toBe(0)
    expect(fixture.admission.skillReceipts).toEqual([fixture.receipt])
  }))
}, 30_000)

test("routine-result binding denies prepare and run while preserving granted catalog status and result leases", async () => {
  await withFenceHost("routine-result", (fixture) => Effect.gen(function* () {
    const admitted = yield* Effect.promise(() => fixture.registry.bind(fixture.admission))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error(`Component read-only binding refused: ${admitted.reason}`)
    expect(admitted.value.entryMode).toBe("routine-result")
    expect(admitted.value.skillReceipts).toEqual([fixture.receipt])
    const context = { sessionID: fixture.admission.sessionID, agent: AgentV2.ID.make(fixture.admission.profile.id),
      assistantMessageID: SessionMessage.ID.make("msg_component_routine_result_fence") }
    for (const operation of ["sf_routine_prepare", "sf_routine_run"]) {
      const denied = yield* Effect.promise(() => fixture.registry.lease({ ...context, toolCallID: `component-denied-${operation}` },
        operation, digestSfValue({ componentFence: operation })))
      expect(denied).toEqual({ status: "denied", reason: "operation-not-granted" })
    }
    for (const operation of ["sf_routine_catalog", "sf_routine_status", "sf_routine_result"]) {
      const allowed = yield* Effect.promise(() => fixture.registry.lease({ ...context, toolCallID: `component-readable-${operation}` },
        operation, digestSfValue({ componentFence: operation })))
      expect(allowed.status).toBe("ok")
      if (allowed.status !== "ok") throw new Error(`Canonical read lease refused: ${operation}: ${allowed.reason}`)
      expect(allowed.value.binding).toBe(admitted.value)
      expect(yield* Effect.promise(() => fixture.registry.revalidate(allowed.value))).toBe(true)
      fixture.registry.finish(allowed.value)
    }
    fixture.registry.revoke(admitted.value)
  }))
}, 30_000)
