import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"

const purchaseTool = "sf_comparar_compra"
const gatewayTool = "sfcompras__sf_comparar_compra"
const timeout = 60_000

function purchaseStatus(status) {
  return { content: [{ type: "text", text: JSON.stringify({ status }) }], isError: true }
}

export default definePluginEntry({
  id: "sf-purchase-gateway",
  name: "SF Purchase Gateway",
  description: "Makes the SF purchase comparison MCP tool available through the Gateway.",
  register(api) {
    api.registerTool({
      name: gatewayTool,
      label: "Compare SF purchase quotations",
      description: "Compare quotations on an SF purchase visible to this profile. This read-only tool does not select or approve a quotation.",
      parameters: {
        type: "object",
        properties: { requestRef: { type: "string", minLength: 1, maxLength: 512 } },
        required: ["requestRef"],
        additionalProperties: false,
      },
      async execute(_callId, args, signal) {
        if (!args || Object.keys(args).length !== 1 || typeof args.requestRef !== "string" ||
          !args.requestRef.trim() || args.requestRef.length > 512) return purchaseStatus("invalid")

        const server = api.config.mcp?.servers?.sfcompras
        const token = process.env.SF_CLAW_PURCHASE_TOKEN
        if (server?.enabled !== true || server.transport !== "streamable-http" ||
          server.toolFilter?.include?.length !== 1 || server.toolFilter.include[0] !== purchaseTool ||
          !token || !/^[a-f0-9]{64}$/.test(token) || !URL.canParse(server.url)) return purchaseStatus("unavailable")

        const endpoint = new URL(server.url)
        if (endpoint.protocol !== "https:" || endpoint.pathname !== "/sucafina/api/claw/mcp" ||
          endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return purchaseStatus("unavailable")

        const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)
        const transport = new StreamableHTTPClientTransport(endpoint, {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
          fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: requestSignal }),
        })
        const client = new Client({ name: "sf-purchase-gateway", version: "1" })
        try {
          await client.connect(transport, { signal: requestSignal, timeout })
          return await client.callTool({ name: purchaseTool, arguments: { requestRef: args.requestRef } },
            undefined, { signal: requestSignal, timeout })
        } catch {
          return purchaseStatus("unavailable")
        } finally {
          await client.close().catch(() => undefined)
        }
      },
    }, { optional: true })
  },
})
