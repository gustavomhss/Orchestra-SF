import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Effect } from "effect"
import type { Mcp } from "@orchestra/core/mcp"
import { digestSfValue } from "../contracts/canonical.ts"
import type { CreateSfBusinessMcpBridge } from "../contracts/runtime.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedCallContext } from "../contracts/sf-execution.ts"

/** Inspect configuration without connecting; the host uses this before starting a provider turn. */
export async function hasSfProviderConflict(mcp: Mcp.Interface) {
  return Object.keys(await Effect.runPromise(mcp.config())).some((name) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "") === "sucafinaworkbench")
}

/** Each operation owns its client, server, transport pair and native lease. */
export const createSfBusinessMcpBridge: CreateSfBusinessMcpBridge = (input) => {
  const conflict = () => hasSfProviderConflict(input.mcp).catch(() => undefined)
  return {
    list: async (context) => {
      const configured = await conflict()
      if (configured === undefined) return { status: "unavailable", reason: "provider-configuration-unavailable" }
      if (configured) return { status: "unavailable", reason: "provider-conflict" }
      const grants: TrustedCallContext[] = []
      const allowed: CapabilityDescriptor[] = []
      for (const descriptor of input.descriptors) {
        const lease = await input.registry.lease(context, descriptor.id, digestSfValue({}))
        if (lease.status !== "ok") continue
        grants.push(lease.value)
        if (descriptor.grantProfiles.includes(lease.value.binding.profileId) && await input.registry.revalidate(lease.value)) allowed.push(descriptor)
      }
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      const server = new Server({ name: "sucafina-workbench", version: "1" }, { capabilities: { tools: {} } })
      const client = new Client({ name: "sucafina-private-client", version: "1" })
      try {
        server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allowed.map((descriptor) => ({
          name: descriptor.id,
          inputSchema: descriptor.inputSchema as { type: "object"; properties?: Record<string, object> },
        })) }))
        await server.connect(serverTransport)
        await client.connect(clientTransport)
        const result = await client.listTools()
        const currentConfig = await conflict()
        if (currentConfig === undefined) return { status: "unavailable", reason: "provider-configuration-unavailable" }
        if (currentConfig) return { status: "unavailable", reason: "provider-conflict" }
        if ((await Promise.all(grants.map((grant) => input.registry.revalidate(grant)))).some((valid) => !valid))
          return { status: "denied", reason: "authority-changed" }
        if (result.tools.length !== allowed.length || result.tools.some((tool, index) => tool.name !== allowed[index]?.id))
          return { status: "unavailable", reason: "private-mcp-catalog-mismatch" }
        return { status: "ok", value: allowed }
      } catch {
        return { status: "unavailable", reason: "private-mcp-unavailable" }
      } finally {
        grants.forEach((grant) => input.registry.finish(grant))
        await client.close()
        await server.close()
      }
    },
    call: async (context, operation, payload) => {
      const reject = (status: "denied" | "unavailable" | "provider-conflict", reason: string): CapabilityResult => ({
        status, reason, receipt: { kind: "unbound", operation, code: status === "provider-conflict" ? "provider-conflict" : status === "denied" ? "invalid-binding" : "unavailable", callId: context.toolCallID, at: new Date().toISOString() },
      })
      const configured = await conflict()
      if (configured === undefined) return reject("unavailable", "provider-configuration-unavailable")
      if (configured) return reject("provider-conflict", "provider-conflict")
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reject("denied", "invalid-operation-input")
      const descriptor = input.descriptors.filter((item) => item.id === operation)
      if (descriptor.length !== 1) return reject("unavailable", "operation-unavailable")
      const lease = await input.registry.lease(context, operation, digestSfValue(payload))
      if (lease.status !== "ok") return reject("denied", lease.reason)
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      const server = new Server({ name: "sucafina-workbench", version: "1" }, { capabilities: { tools: {} } })
      const client = new Client({ name: "sucafina-private-client", version: "1" })
      const observed: { result?: CapabilityResult; encoded?: string; providerConflict?: boolean } = {}
      try {
        server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{
          name: operation, inputSchema: descriptor[0]!.inputSchema as { type: "object"; properties?: Record<string, object> },
        }] }))
        server.setRequestHandler(CallToolRequestSchema, async (call) => {
          if (call.params.name !== operation || digestSfValue(call.params.arguments ?? {}) !== digestSfValue(payload) ||
            !(await input.registry.revalidate(lease.value))) throw new Error("private-call-denied")
          const handlerConfig = await conflict()
          if (handlerConfig === undefined) throw new Error("provider-configuration-unavailable")
          if (handlerConfig) {
            observed.providerConflict = true
            throw new Error("provider-conflict")
          }
          observed.result = await input.dispatch(operation, call.params.arguments ?? {}, lease.value)
          if (observed.result.status === "ok") {
            const expected = input.registry.receiptFor(lease.value, operation, digestSfValue(call.params.arguments ?? {}), digestSfValue(observed.result.result))
            const receipt = observed.result.receipt
            if (!expected || expected.kind !== "native" || receipt.kind !== "native" || receipt.operation !== expected.operation ||
              receipt.handlerExport !== expected.handlerExport || receipt.inputDigest !== expected.inputDigest ||
              receipt.resultDigest !== expected.resultDigest || receipt.principalRef !== expected.principalRef ||
              receipt.callId !== expected.callId || receipt.accessRevision !== expected.accessRevision ||
              receipt.runId !== expected.runId || receipt.nativeSessionId !== expected.nativeSessionId ||
              receipt.providerGeneration !== expected.providerGeneration) throw new Error("private-receipt-mismatch")
          }
          observed.encoded = JSON.stringify(observed.result)
          return { content: [{ type: "text", text: observed.encoded }] }
        })
        await server.connect(serverTransport)
        await client.connect(clientTransport)
        const catalog = await client.listTools()
        if (catalog.tools.length !== 1 || catalog.tools[0]?.name !== operation || !(await input.registry.revalidate(lease.value)))
          return reject("denied", "authority-changed")
        const result = await client.callTool({ name: operation, arguments: payload as Record<string, unknown> })
        const currentConfig = await conflict()
        if (currentConfig === undefined) return reject("unavailable", "provider-configuration-unavailable")
        if (currentConfig) return reject("provider-conflict", "provider-conflict")
        if (!(await input.registry.revalidate(lease.value))) return reject("denied", "authority-changed")
        if (!observed.result || result.content.length !== 1 || result.content[0]?.type !== "text" || result.content[0].text !== observed.encoded)
          return reject("unavailable", "private-mcp-response-mismatch")
        if (observed.result.receipt.kind === "native" && observed.result.receipt.callId !== context.toolCallID)
          return reject("unavailable", "private-mcp-receipt-mismatch")
        return observed.result
      } catch {
        if (observed.providerConflict) return reject("provider-conflict", "provider-conflict")
        return reject("unavailable", "private-mcp-unavailable")
      } finally {
        input.registry.finish(lease.value)
        await client.close()
        await server.close()
      }
    },
  }
}
