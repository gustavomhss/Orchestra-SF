import { selection } from "./fixture.ts"
import { expect, test } from "bun:test"
import { AgentV2 } from "@orchestra/core/agent"
import type { Mcp } from "@orchestra/core/mcp"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../../product/contracts/resident-ai.ts"
import type { CapabilityDescriptor, CapabilityResult } from "../../../../product/contracts/sf-execution.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { dispatchSfCapability } from "../../../../product/host-binding/capability-dispatch.ts"
import { createSfExecutionBindingRegistry } from "../../../../product/host-binding/execution-context.ts"
import { createSfBusinessMcpBridge } from "../../../../product/host-binding/sf-mcp-bridge.ts"

test("private MCP traverses native lease and refuses a normalized configured namesake", async () => {
  const sessionID = SessionSchema.ID.make("ses_private_mcp")
  const request = new Request("https://example.test/")
  const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64), allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [], contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
  const receipt: SkillLoadReceipt = { runId: "run-1", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "msg_loaded", loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64) }
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => admission.request === request ? { installationId: "installation", hostId: "host", projectId: "project", locationId: "location", principalRef: "person", policyVersion: "policy", accessRevision: "access", providerGeneration: 1, expiresAt: new Date(Date.now() + 60_000).toISOString() } : undefined,
    revalidateAdmission: async (admission) => admission.request === request,
  })
  const binding = await registry.bind({ request, selected: selection(profile), sessionID, runId: receipt.runId, caseRef: { id: "case", version: 1, incarnation: "inc" }, profile, manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
  expect(binding.status).toBe("ok")
  if (binding.status !== "ok") return
  const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_assistant"), toolCallID: "call-private" }
  const ui = createSfUiAuthority({ authorize: async () => undefined, commandIdentity: async () => undefined, createId: () => "unused", now: Date.now })
  const authority = createSfDomainAuthority({ native: registry, ui })
  const calls = { count: 0 }
  const descriptor: CapabilityDescriptor = {
    id: "sf_forecast_compare", pack: "planning", mode: "simulate", inputSchema: { type: "object", properties: {}, additionalProperties: false }, outputSchema: {}, handlerExport: "compareForecast", producerTask: "WP03.T01", grantProfiles: ["sf_finance"], requiredAuthority: [],
    handler: async (value, trusted) => {
      calls.count++
      if (trusted.kind !== "native") throw new Error("unexpected UI context")
      const result = { fixture: "synthetic" }
      const made = registry.receiptFor(trusted, "sf_forecast_compare", digestSfValue(value), digestSfValue(result))
      if (!made) throw new Error("missing receipt")
      return { status: "ok", result, receipt: made } as unknown as CapabilityResult
    },
  }
  // The actual SDK client/server and registry execute; the minimal configuration seam has no connect method.
  const config = { config: () => Effect.succeed({}) } as unknown as Mcp.Interface
  const dispatch = (operation: string, payload: unknown, trusted: Parameters<CapabilityDescriptor["handler"]>[1]) => dispatchSfCapability({ operation, payload, context: trusted, descriptors: [descriptor], authority, validateInput: () => true, validateOutput: () => true })
  const bridge = createSfBusinessMcpBridge({ registry, mcp: config, descriptors: [descriptor], dispatch })
  const answer = await bridge.call(context, descriptor.id, {})
  expect(answer.status).toBe("ok")
  expect(answer.receipt.kind).toBe("native")
  expect((await bridge.call(context, descriptor.id, {})).status).toBe("denied")
  const collision = { config: () => Effect.succeed({ "Sucafina_Workbench": {} }) } as unknown as Mcp.Interface
  const conflicted = createSfBusinessMcpBridge({ registry, mcp: collision, descriptors: [descriptor], dispatch })
  expect((await conflicted.call({ ...context, toolCallID: "call-collision" }, descriptor.id, {})).status).toBe("provider-conflict")
  const changes = { count: 0 }
  const changed = { config: () => Effect.sync(() => ++changes.count === 1 ? {} : { "sucafina-workbench": {} }) } as unknown as Mcp.Interface
  const changing = createSfBusinessMcpBridge({ registry, mcp: changed, descriptors: [descriptor], dispatch })
  expect((await changing.call({ ...context, toolCallID: "call-config-change" }, descriptor.id, {})).status).toBe("provider-conflict")
  expect(calls.count).toBe(1)
  const broken = { config: () => Effect.die("configuration-unavailable") } as unknown as Mcp.Interface
  const unavailable = createSfBusinessMcpBridge({ registry, mcp: broken, descriptors: [descriptor], dispatch })
  expect((await unavailable.call({ ...context, toolCallID: "call-config-error" }, descriptor.id, {})).status).toBe("unavailable")
})
