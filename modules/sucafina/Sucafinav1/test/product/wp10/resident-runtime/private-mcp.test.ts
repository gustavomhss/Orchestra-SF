import { selection } from "./fixture.ts"
import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { AgentV2 } from "@orchestra/core/agent"
import type { Mcp } from "@orchestra/core/mcp"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../../product/contracts/resident-ai.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedCallContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { dispatchSfCapability } from "../../../../product/host-binding/capability-dispatch.ts"
import { createSfExecutionBindingRegistry } from "../../../../product/host-binding/execution-context.ts"
import { createSfBusinessMcpBridge } from "../../../../product/host-binding/sf-mcp-bridge.ts"
import type { SfVerifiedCallObserver } from "../../../../product/host-binding/verified-call.ts"

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

// Boundary/lifecycle counterproofs for R3-C10-MCP-EGRESS. The SDK client, server,
// linked InMemoryTransport, dispatcher and binding registry are real. Only the
// domain payload/profile/skill receipt are synthetic fixtures; this is not a
// model execution or AM acceptance. The only delayed methods are SDK close().
const closeKinds = ["client", "server"] as const
const bridgePaths = ["list", "call"] as const
const authorityChanges = ["revoke", "generation", "abort", "configuration"] as const
type BridgePath = typeof bridgePaths[number]
type AuthorityChange = typeof authorityChanges[number]

for (const path of bridgePaths) {
  for (const held of closeKinds) {
    for (const change of authorityChanges) {
      test(`private MCP ${path} refuses ${change} during real ${held}.close without egress or capture`, async () => {
        const fixture = await egressFixture(`${path}-${held}-${change}`)
        const lifecycle = gateSdkClose(fixture.events)
        let settled = false
        const pending = fixture.invoke(path).finally(() => { settled = true })
        try {
          await reachedClose(lifecycle.client.entered, pending)
          const beforeClient = fixture.observation(settled)
          if (held === "client") fixture.change(change)
          lifecycle.client.release()
          await reachedClose(lifecycle.server.entered, pending)
          const beforeServer = fixture.observation(settled)
          if (held === "server") fixture.change(change)
          lifecycle.server.release()
          const answer = await pending

          expect(answer.status).toBe(change === "configuration" ? path === "call" ? "provider-conflict" : "unavailable" : "denied")
          if (answer.status === "ok") throw new Error("protected MCP egress after authority changed")
          expect(answer.reason).toBe(change === "configuration" ? "provider-conflict" : "authority-changed")
          expect(Object.hasOwn(answer, "result")).toBe(false)
          expect(Object.hasOwn(answer, "value")).toBe(false)
          expect(Object.hasOwn(answer, "tools")).toBe(false)
          expect(JSON.stringify(answer)).not.toContain(fixture.privateMarker)
          if (path === "list") expect(JSON.stringify(answer)).not.toContain(fixture.descriptor.id)
          if ("receipt" in answer) expect(answer.receipt.kind).toBe("unbound")
          expect(fixture.captures).toHaveLength(0)
          expect(beforeClient).toEqual({ settled: false, captures: 0, finishes: 0, calls: path === "call" ? 1 : 0 })
          expect(beforeServer).toEqual(beforeClient)
          expect(lifecycle.completed).toEqual({ client: 1, server: 1 })
          expect(fixture.finishes).toHaveLength(1)
          const finished = fixture.finishes[0]!
          expect(await fixture.registry.revalidate(finished)).toBe(false)
          expect(fixture.registry.requestFor(finished)).toBeUndefined()
          expect(fixture.events.indexOf("server:closed")).toBeLessThan(fixture.events.indexOf("finish"))
          if (path === "call") expect(fixture.events.indexOf("domain-result")).toBeLessThan(fixture.events.indexOf(`${held}:entered`))
        } finally {
          lifecycle.client.release()
          lifecycle.server.release()
          await pending.catch(() => undefined)
          lifecycle.restore()
        }
      })
    }
  }
}

for (const path of bridgePaths) {
  test(`private MCP ${path} delivers unchanged authority only after both real SDK closes and finishes its lease`, async () => {
    const fixture = await egressFixture(`${path}-unchanged`)
    const lifecycle = gateSdkClose(fixture.events)
    let settled = false
    const pending = fixture.invoke(path).finally(() => { settled = true })
    try {
      await reachedClose(lifecycle.client.entered, pending)
      expect(fixture.observation(settled)).toEqual({ settled: false, captures: 0, finishes: 0, calls: path === "call" ? 1 : 0 })
      expect(lifecycle.completed).toEqual({ client: 0, server: 0 })
      if (fixture.domainContext()) expect(await fixture.registry.revalidate(fixture.domainContext()!)).toBe(true)
      lifecycle.client.release()
      await reachedClose(lifecycle.server.entered, pending)
      expect(fixture.observation(settled)).toEqual({ settled: false, captures: 0, finishes: 0, calls: path === "call" ? 1 : 0 })
      expect(lifecycle.completed).toEqual({ client: 1, server: 0 })
      if (fixture.domainContext()) expect(await fixture.registry.revalidate(fixture.domainContext()!)).toBe(true)
      lifecycle.server.release()
      const answer = await pending

      expect(answer.status).toBe("ok")
      if (answer.status !== "ok") throw new Error(`private MCP positive refused: ${answer.reason}`)
      expect(lifecycle.completed).toEqual({ client: 1, server: 1 })
      expect(fixture.finishes).toHaveLength(1)
      const finished = fixture.finishes[0]!
      expect(await fixture.registry.revalidate(finished)).toBe(false)
      expect(fixture.registry.requestFor(finished)).toBeUndefined()
      expect(fixture.events.indexOf("server:closed")).toBeLessThan(fixture.events.indexOf("finish"))
      if ("result" in answer) {
        // This lifecycle fixture intentionally carries an opaque synthetic domain payload.
        const transported: unknown = answer.result
        expect(transported).toEqual({ fixture: "synthetic-domain-payload", privateMarker: fixture.privateMarker })
        expect(answer.receipt.kind).toBe("native")
        expect(fixture.captures).toHaveLength(1)
        expect(fixture.captures[0]![2]).toEqual(answer)
        expect(fixture.captures[0]![3]).toBe(finished)
        expect(fixture.events.indexOf("server:closed")).toBeLessThan(fixture.events.indexOf("capture"))
        expect(fixture.events.indexOf("capture")).toBeLessThan(fixture.events.indexOf("finish"))
      } else {
        expect(answer.value.map((descriptor) => descriptor.id)).toEqual([fixture.descriptor.id])
        expect(fixture.captures).toHaveLength(0)
      }
    } finally {
      lifecycle.client.release()
      lifecycle.server.release()
      await pending.catch(() => undefined)
      lifecycle.restore()
    }
  })
}

async function egressFixture(name: string) {
  const controller = new AbortController()
  const request = new Request("https://example.test/private-mcp-egress", { signal: controller.signal })
  const sessionID = SessionSchema.ID.make(`ses_mcp_egress_${name}`)
  const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Synthetic lifecycle fixture", sourcePath: "profile.json", sourceDigest: "a".repeat(64), allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: [], contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
  const receipt: SkillLoadReceipt = { runId: `run-${name}`, nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "msg_loaded", loadedAt: new Date().toISOString(), manifestDigest: "d".repeat(64) }
  const events: string[] = []
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (admission) => admission.request === request ? { installationId: "installation", hostId: "host", projectId: "project", locationId: "location", principalRef: "person", policyVersion: "policy", accessRevision: "access", providerGeneration: 7, expiresAt: new Date(Date.now() + 60_000).toISOString() } : undefined,
    revalidateAdmission: async (admission) => admission.request === request,
  })
  const admitted = await registry.bind({ request, selected: selection(profile), sessionID, runId: receipt.runId, caseRef: { id: "case", version: 1, incarnation: "inc" }, profile, manifestDigest: receipt.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
  if (admitted.status !== "ok") throw new Error(`fixture admission failed: ${admitted.reason}`)
  const finishes: TrustedCallContext[] = []
  // Observation only: preserve the registry's actual finish decision and return.
  // This exposes list cleanup to the test without exposing leases in the product.
  const finish = registry.finish
  registry.finish = (context) => {
    const result = finish.call(registry, context)
    finishes.push(context)
    events.push("finish")
    return result
  }
  const context = { sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make(`msg_${name}`), toolCallID: `call-${name}` }
  const ui = createSfUiAuthority({ authorize: async () => undefined, commandIdentity: async () => undefined, createId: () => "unused", now: Date.now })
  const authority = createSfDomainAuthority({ native: registry, ui })
  const privateMarker = `protected-fixture-${name}`
  const protectedResult = { fixture: "synthetic-domain-payload", privateMarker }
  const state: { configured: Record<string, unknown>; calls: number; trusted?: TrustedCallContext } = { configured: {}, calls: 0 }
  const descriptor: CapabilityDescriptor = {
    id: "sf_forecast_compare", pack: "planning", mode: "simulate", inputSchema: { type: "object", properties: {}, additionalProperties: false }, outputSchema: {}, handlerExport: "compareForecast", producerTask: "WP03.T01", grantProfiles: ["sf_finance"], requiredAuthority: [],
    handler: async (value, trusted) => {
      if (trusted.kind !== "native") throw new Error("unexpected UI context")
      state.calls++
      state.trusted = trusted
      const made = registry.receiptFor(trusted, descriptor.id, digestSfValue(value), digestSfValue(protectedResult))
      if (!made) throw new Error("missing real native lease receipt")
      events.push("domain-result")
      return { status: "ok", result: protectedResult, receipt: made } as unknown as CapabilityResult
    },
  }
  // Configuration-only input; the bridge itself instantiates and connects the
  // real SDK Client/Server/InMemoryTransport, with no response/registry doubles.
  const mcp = { config: () => Effect.sync(() => state.configured) } as unknown as Mcp.Interface
  const captures: Parameters<SfVerifiedCallObserver>[] = []
  const onVerifiedCall: SfVerifiedCallObserver = (...args) => {
    captures.push(args)
    events.push("capture")
    return true
  }
  const dispatch = (operation: string, payload: unknown, trusted: Parameters<CapabilityDescriptor["handler"]>[1]) => dispatchSfCapability({
    operation, payload, context: trusted, descriptors: [descriptor], authority,
    validateInput: (selected, value) => selected === descriptor && !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
    validateOutput: (selected, value) => selected === descriptor && value.status === "ok" && digestSfValue(value.result) === digestSfValue(protectedResult) && value.receipt.kind === "native",
  })
  const bridge = createSfBusinessMcpBridge({ registry, mcp, descriptors: [descriptor], dispatch, onVerifiedCall })
  return {
    descriptor, registry, captures, finishes, events, privateMarker,
    domainContext: () => state.trusted,
    observation: (settled: boolean) => ({ settled, captures: captures.length, finishes: finishes.length, calls: state.calls }),
    invoke: (path: BridgePath) => path === "call" ? bridge.call(context, descriptor.id, {}) : bridge.list(context),
    change: (change: AuthorityChange) => {
      if (change === "revoke") registry.revoke(admitted.value)
      else if (change === "generation") registry.invalidateGeneration(admitted.value.providerGeneration)
      else if (change === "abort") controller.abort("authority-revoked-during-sdk-close")
      else state.configured = { "SucaFina__WorkBench": {} }
      events.push(`change:${change}`)
    },
  }
}

function gateSdkClose(events: string[]) {
  const client = closeGate()
  const server = closeGate()
  const completed = { client: 0, server: 0 }
  const originalClient = Object.getOwnPropertyDescriptor(Client.prototype, "close")
  const originalServer = Object.getOwnPropertyDescriptor(Server.prototype, "close")
  const clientClose = Client.prototype.close
  const serverClose = Server.prototype.close
  // Every delayed call delegates to its original SDK implementation. No
  // transport, server response, registry authorization or protocol is replaced.
  Client.prototype.close = async function (this: Client) {
    events.push("client:entered")
    client.enter()
    await client.released
    await clientClose.call(this)
    completed.client++
    events.push("client:closed")
  }
  Server.prototype.close = async function (this: Server) {
    events.push("server:entered")
    server.enter()
    await server.released
    await serverClose.call(this)
    completed.server++
    events.push("server:closed")
  }
  return {
    client, server, completed,
    restore: () => {
      if (originalClient) Object.defineProperty(Client.prototype, "close", originalClient)
      else Reflect.deleteProperty(Client.prototype, "close")
      if (originalServer) Object.defineProperty(Server.prototype, "close", originalServer)
      else Reflect.deleteProperty(Server.prototype, "close")
    },
  }
}

function closeGate() {
  let enter!: () => void
  let release!: () => void
  const entered = new Promise<void>((resolve) => { enter = resolve })
  const released = new Promise<void>((resolve) => { release = resolve })
  return { entered, released, enter, release }
}

function reachedClose(entered: Promise<void>, pending: Promise<unknown>) {
  return Promise.race([entered, pending.then(() => { throw new Error("private MCP settled without the expected SDK close gate") })])
}
