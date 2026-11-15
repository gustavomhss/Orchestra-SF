import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { AgentV2 } from "@orchestra/core/agent"
import type { Mcp } from "@orchestra/core/mcp"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../product/contracts/output-schemas.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedCallContext } from "../../../product/contracts/sf-execution.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfBusinessMcpBridge } from "../../../product/host-binding/sf-mcp-bridge.ts"
import type { SfVerifiedCallObserver } from "../../../product/host-binding/verified-call.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { selection } from "../wp10/resident-runtime/fixture.ts"

/** Real SDK/registry/dispatcher/decoders; synthetic authority, profile, skill receipt and domain output.
 * This fixture is a bridge integrity counterproof, not native admission or AM01/AM02 acceptance. */
export async function bridgeFixture(name: string, options: {
  pauseConfiguration?: boolean
  capture?: (payload: unknown, result: CapabilityResult) => void
} = {}) {
  const sessionID = SessionSchema.ID.make(`ses_m68_bridge_${name}`)
  const controller = new AbortController()
  const request = new Request("https://example.test/m68-bridge", { signal: controller.signal })
  const profile: ResidentProfile = {
    id: "sf_finance", version: "1", mission: "Synthetic MCP boundary fixture", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
    allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_context_get"], outputTypes: [],
    contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh",
  }
  const receipt: SkillLoadReceipt = {
    runId: `run-${name}`, nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version,
    profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64),
    instructionsDigest: "c".repeat(64), loadedMessageId: `msg_loaded_${name}`, loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64),
  }
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => admission.request === request ? {
      installationId: "installation", hostId: "host", projectId: "project", locationId: "location", principalRef: "person",
      policyVersion: "policy", accessRevision: "access", providerGeneration: 7, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } : undefined,
    revalidateAdmission: async (admission, binding) => admission.request === request && binding.principalRef === "person" &&
      binding.installationId === "installation" && binding.projectId === "project" && binding.accessRevision === "access" &&
      binding.nativeSessionId === sessionID && binding.runId === receipt.runId && binding.caseId === `case-${name}`,
  })
  const admitted = await registry.bind({ request, selected: selection(profile), sessionID, runId: receipt.runId,
    caseRef: { id: `case-${name}`, version: 1, incarnation: "inc" }, profile, manifestDigest: receipt.manifestDigest,
    skillReceipts: [receipt], entryMode: "interactive" })
  if (admitted.status !== "ok") throw new Error(`Synthetic bridge fixture denied: ${admitted.reason}`)
  const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make(`msg_${name}`), toolCallID: `call-${name}` }
  const ui = createSfUiAuthority({ authorize: async () => undefined, commandIdentity: async () => undefined, createId: () => "unused", now: Date.now })
  const authority = createSfDomainAuthority({ native: registry, ui })
  const output = { resolutions: [], accessRevision: "access" }
  const emitted: { result?: CapabilityResult } = {}
  const inputs: unknown[] = []
  const finishes: TrustedCallContext[] = []
  const finish = registry.finish
  registry.finish = (call) => { finish(call); finishes.push(call) }
  const descriptor: CapabilityDescriptor = {
    id: "sf_context_get", pack: "knowledge", mode: "read", inputSchema: sfOperationInputSchemas.sf_context_get,
    outputSchema: sfOperationOutputSchemas.sf_context_get, handlerExport: "readSfBusinessContext", producerTask: "WP10.T07",
    grantProfiles: ["sf_finance"], requiredAuthority: [],
    handler: async (payload, call) => {
      if (call.kind !== "native") throw new Error("Unexpected UI context")
      inputs.push(structuredClone(payload))
      const bound = registry.receiptFor(call, descriptor.id, digestSfValue(payload), digestSfValue(output))
      if (!bound) throw new Error("Missing component lease receipt")
      emitted.result = { status: "ok", outputRef: `synthetic-output-${name}`, result: output, receipt: bound }
      return emitted.result
    },
  }
  const configurationEntered = Promise.withResolvers<void>()
  const configurationReleased = Promise.withResolvers<void>()
  const configuration = { reads: 0 }
  // Only public configuration is supplied; the bridge creates its actual SDK transport pair.
  const mcp = { config: () => Effect.promise(async () => {
    configuration.reads++
    if (options.pauseConfiguration && configuration.reads === 1) {
      configurationEntered.resolve()
      await configurationReleased.promise
    }
    return {}
  }) } as unknown as Mcp.Interface
  const captures: Parameters<SfVerifiedCallObserver>[] = []
  const bridge = createSfBusinessMcpBridge({ registry, mcp, descriptors: [descriptor],
    dispatch: (operation, payload, call) => dispatchSfCapability({ operation, payload, context: call, descriptors: [descriptor], authority,
      validateInput: (selected, value) => selected === descriptor && decodeSfOperationInput("sf_context_get", value).ok,
      validateOutput: (selected, value) => selected === descriptor && (value.status !== "ok" || decodeSfOperationOutput("sf_context_get", value.result).ok),
    }),
    onVerifiedCall: (...args) => { captures.push(args); options.capture?.(args[1], args[2]); return true },
  })
  return { bridge, registry, binding: admitted.value, context, descriptor, output, emitted, inputs, captures, finishes, controller,
    payload: () => ({ selectionRefs: ["synthetic-selection"], purpose: "Original purpose", period: { start: "2026-01-01", end: "2026-01-31" } }),
    configuration: { entered: configurationEntered.promise, release: () => configurationReleased.resolve() },
  }
}

/** Delay one SDK close, delegating every close to the original real implementation. */
export function holdSdkClose(held: "client" | "server") {
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const completed = { client: 0, server: 0 }
  const clientOwn = Object.getOwnPropertyDescriptor(Client.prototype, "close")
  const serverOwn = Object.getOwnPropertyDescriptor(Server.prototype, "close")
  const clientClose = Client.prototype.close
  const serverClose = Server.prototype.close
  Client.prototype.close = async function (this: Client) {
    if (held === "client") { entered.resolve(); await released.promise }
    await clientClose.call(this)
    completed.client++
  }
  Server.prototype.close = async function (this: Server) {
    if (held === "server") { entered.resolve(); await released.promise }
    await serverClose.call(this)
    completed.server++
  }
  return { completed, entered: entered.promise, release: () => released.resolve(), restore: () => {
    if (clientOwn) Object.defineProperty(Client.prototype, "close", clientOwn)
    else Reflect.deleteProperty(Client.prototype, "close")
    if (serverOwn) Object.defineProperty(Server.prototype, "close", serverOwn)
    else Reflect.deleteProperty(Server.prototype, "close")
  } }
}

export function beforeSettlement(entered: Promise<void>, pending: Promise<unknown>) {
  return Promise.race([entered, pending.then(() => { throw new Error("Bridge settled before the observation gate") })])
}
