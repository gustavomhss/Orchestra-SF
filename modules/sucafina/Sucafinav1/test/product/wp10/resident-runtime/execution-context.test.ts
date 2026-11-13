import { selection } from "./fixture.ts"
import { describe, expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { createSfExecutionBindingRegistry } from "../../../../product/host-binding/execution-context.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../../product/contracts/resident-ai.ts"

const profile: ResidentProfile = {
  id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
  allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare", "sf_context_get"], outputTypes: [],
  contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh",
}

describe("SF native execution registry", () => {
  test("pins one real request to a session and rejects replay, forged bindings and revocation", async () => {
    const sessionID = SessionSchema.ID.make("ses_native_test")
    const request = new Request("https://example.test/sf")
    const receipt: SkillLoadReceipt = {
      runId: "run-1", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
      profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1",
      sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "msg_loaded",
      loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64),
    }
    const registry = createSfExecutionBindingRegistry({
      authenticateAndResolve: async (admission) => admission.request === request ? {
        installationId: "installation", hostId: "host", projectId: "project", locationId: "location",
        principalRef: "principal", policyVersion: "policy", accessRevision: "access", providerGeneration: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      } : undefined,
      revalidateAdmission: async (admission) => admission.request === request,
    })
    const rejected = await registry.bind({ request, selected: { ...selection(profile), manifestDigest: "e".repeat(64) }, sessionID,
      runId: "run-1", caseRef: { id: "case", version: 1, incarnation: "inc" }, profile,
      manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
    expect(rejected.status).toBe("denied")
    const bound = await registry.bind({ request, selected: selection(profile), sessionID, runId: "run-1", caseRef: { id: "case", version: 1, incarnation: "inc" },
      profile, manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
    expect(bound.status).toBe("ok")
    if (bound.status !== "ok") return
    const native = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_assistant"), toolCallID: "call-1" }
    const wrongAgent = await registry.lease({ ...native, agent: AgentV2.ID.make("sf_reviewer") }, "sf_forecast_compare", "e".repeat(64))
    expect(wrongAgent.status).toBe("denied")
    const wrongSession = await registry.lease({ ...native, sessionID: SessionSchema.ID.make("ses_other") }, "sf_forecast_compare", "e".repeat(64))
    expect(wrongSession.status).toBe("denied")
    const discovery = await registry.lease(native, "sf_forecast_compare", "e".repeat(64))
    expect(discovery.status).toBe("ok")
    if (discovery.status !== "ok") return
    registry.finish(discovery.value)
    const lease = await registry.lease(native, "sf_forecast_compare", "e".repeat(64))
    const competing = await registry.lease(native, "sf_forecast_compare", "e".repeat(64))
    expect(lease.status).toBe("ok")
    expect(competing.status).toBe("ok")
    if (lease.status !== "ok" || competing.status !== "ok") return
    expect(registry.requestFor(lease.value)).toBeUndefined()
    expect(registry.receiptFor(lease.value, "sf_forecast_compare", "e".repeat(64))).toBeUndefined()
    expect(registry.consume({ ...lease.value, binding: { ...bound.value } }, "sf_forecast_compare", "e".repeat(64))).toBe(false)
    expect(registry.consume(lease.value, "sf_forecast_compare", "f".repeat(64))).toBe(false)
    expect(registry.consume(lease.value, "sf_forecast_compare", "e".repeat(64))).toBe(true)
    expect(registry.consume(competing.value, "sf_forecast_compare", "e".repeat(64))).toBe(false)
    expect(registry.requestFor(lease.value)).toBe(request)
    const first = registry.receiptFor(lease.value, "sf_forecast_compare", "e".repeat(64))
    const second = registry.receiptFor(lease.value, "sf_forecast_compare", "e".repeat(64), "f".repeat(64))
    expect(first?.kind).toBe("native")
    expect(first?.callId).toBe("call-1")
    expect(second?.callId).toBe("call-1")
    expect(second?.resultDigest).toBe("f".repeat(64))
    expect(registry.consume(lease.value, "sf_forecast_compare", "e".repeat(64))).toBe(false)
    expect((await registry.lease(native, "sf_forecast_compare", "e".repeat(64))).status).toBe("denied")
    // The canonical route table lists one witness per operation, not every valid grant.
    const additional = await registry.lease({ ...native, toolCallID: "call-2" }, "sf_context_get", "a".repeat(64))
    expect(additional.status).toBe("ok")
    if (additional.status === "ok") {
      expect(registry.consume(additional.value, "sf_context_get", "a".repeat(64))).toBe(true)
      registry.finish(additional.value)
      expect(registry.receiptFor(additional.value, "sf_context_get", "a".repeat(64))).toBeUndefined()
    }
    const forbidden = await registry.lease({ ...native, toolCallID: "call-3" }, "sf_scenario_compare", "a".repeat(64))
    expect(forbidden.status).toBe("denied")
    registry.invalidateGeneration(1)
    expect(await registry.revalidate(lease.value)).toBe(false)
    registry.revoke(bound.value)
    expect(registry.requestFor(lease.value)).toBeUndefined()
    expect(registry.receiptFor(lease.value, "sf_forecast_compare", "e".repeat(64))).toBeUndefined()
  })
})

test("concurrent sessions with the same profile retain distinct request authorities", async () => {
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => ({
      installationId: "installation", hostId: "host", projectId: "project", locationId: "location",
      principalRef: admission.request.headers.get("x-test-principal") ?? "", policyVersion: "policy", accessRevision: "access",
      providerGeneration: 1, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }),
    revalidateAdmission: async (admission, binding) => admission.request.headers.get("x-test-principal") === binding.principalRef,
  })
  const bind = async (suffix: string) => {
    const sessionID = SessionSchema.ID.make(`ses_${suffix}`)
    const abort = new AbortController()
    const request = new Request("https://example.test/", { headers: { "x-test-principal": suffix }, signal: abort.signal })
    const receipt: SkillLoadReceipt = {
      runId: `run-${suffix}`, nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
      profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1",
      sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: `msg_${suffix}`,
      loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64),
    }
    const binding = await registry.bind({ request, selected: selection(profile), sessionID, runId: receipt.runId,
      caseRef: { id: `case-${suffix}`, version: 1, incarnation: `inc-${suffix}` }, profile,
      manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
    const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make(`msg_${suffix}`), toolCallID: `call-${suffix}` }
    return { request, binding, context, abort }
  }
  const [first, second] = await Promise.all([bind("one"), bind("two")])
  expect(first.binding.status).toBe("ok")
  expect(second.binding.status).toBe("ok")
  if (first.binding.status !== "ok" || second.binding.status !== "ok") return
  const [firstLease, secondLease] = await Promise.all([
    registry.lease(first.context, "sf_forecast_compare", "a".repeat(64)),
    registry.lease(second.context, "sf_forecast_compare", "b".repeat(64)),
  ])
  expect(firstLease.status).toBe("ok")
  expect(secondLease.status).toBe("ok")
  if (firstLease.status !== "ok" || secondLease.status !== "ok") return
  expect(registry.consume({ ...firstLease.value, binding: second.binding.value }, "sf_forecast_compare", "a".repeat(64))).toBe(false)
  expect(registry.consume(firstLease.value, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  expect(registry.consume(secondLease.value, "sf_forecast_compare", "b".repeat(64))).toBe(true)
  expect(registry.requestFor(firstLease.value)).toBe(first.request)
  expect(registry.requestFor(secondLease.value)).toBe(second.request)
  first.abort.abort()
  expect(await registry.revalidate(firstLease.value)).toBe(false)
  expect(registry.requestFor(firstLease.value)).toBeUndefined()
  registry.revoke(first.binding.value)
  expect(await registry.revalidate(secondLease.value)).toBe(true)
})

test("the selected manifest limits operations even when the profile and skill allow more", async () => {
  const sessionID = SessionSchema.ID.make("ses_selected")
  const request = new Request("https://example.test/")
  const receipt: SkillLoadReceipt = {
    runId: "run-selected", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
    profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64),
    instructionsDigest: "c".repeat(64), loadedMessageId: "msg_loaded", loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64),
  }
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async () => ({ installationId: "i", hostId: "h", projectId: "p", locationId: "l", principalRef: "person",
      policyVersion: "policy", accessRevision: "revision", providerGeneration: 1, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    revalidateAdmission: async () => true,
  })
  const bound = await registry.bind({ request, selected: selection(profile, ["sf_forecast_compare"]), sessionID, runId: receipt.runId,
    caseRef: { id: "case", version: 1, incarnation: "inc" }, profile, manifestDigest: receipt.manifestDigest,
    skillReceipts: [receipt], entryMode: "interactive" })
  expect(bound.status).toBe("ok")
  const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_selected"), toolCallID: "call-selected" }
  expect((await registry.lease(context, "sf_forecast_compare", "a".repeat(64))).status).toBe("ok")
  expect((await registry.lease(context, "sf_context_get", "a".repeat(64))).status).toBe("denied")
})

test("authentication and binding retain the same admission when the caller mutates its inputs", async () => {
  const sessionID = SessionSchema.ID.make("ses_snapshot")
  const request = new Request("https://example.test/")
  const mutableProfile = structuredClone(profile)
  const operations = ["sf_forecast_compare"]
  const selected = { ...selection(mutableProfile), operationIds: operations }
  const caseRef = { id: "case-original", version: 1, incarnation: "inc" }
  const receipt: SkillLoadReceipt = { runId: "run-original", nativeSessionId: sessionID, profileId: profile.id,
    profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1",
    sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "msg_loaded",
    loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64) }
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => {
      started.resolve()
      await release.promise
      if (admission.caseRef.id !== "case-original" || admission.profile.sourceDigest !== "a".repeat(64) ||
        admission.skillReceipts[0]?.loadedMessageId !== "msg_loaded" || admission.selected.operationIds.length !== 1) return undefined
      return { installationId: "i", hostId: "h", projectId: "p", locationId: "l", principalRef: "person", policyVersion: "policy",
        accessRevision: "revision", providerGeneration: 1, expiresAt: new Date(Date.now() + 60_000).toISOString() }
    },
    revalidateAdmission: async (admission, binding) => admission.caseRef.id === binding.caseId && admission.caseRef.id === "case-original",
  })
  const pending = registry.bind({ request, selected, sessionID, runId: "run-original", caseRef, profile: mutableProfile,
    manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
  await started.promise
  caseRef.id = "case-mutated"
  mutableProfile.sourceDigest = "f".repeat(64)
  receipt.loadedMessageId = "msg_mutated"
  operations.push("sf_context_get")
  release.resolve()
  const bound = await pending
  expect(bound.status).toBe("ok")
  if (bound.status !== "ok") return
  expect(bound.value.caseId).toBe("case-original")
  expect(bound.value.skillReceipts[0]?.loadedMessageId).toBe("msg_loaded")
  const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_snapshot"), toolCallID: "call-snapshot" }
  expect((await registry.lease(context, "sf_context_get", "a".repeat(64))).status).toBe("denied")
})
