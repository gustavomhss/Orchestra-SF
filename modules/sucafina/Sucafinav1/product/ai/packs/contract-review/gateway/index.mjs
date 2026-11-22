import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"

const status = (value) => ({ content: [{ type: "text", text: JSON.stringify({ status: value }) }], isError: true })

export default definePluginEntry({
  id: "sf-contract-review-gateway",
  name: "SF Contract Review Gateway",
  description: "Read vendor contract metadata through the SF Gateway.",
  register(api) {
    api.registerTool((context) => ({
      name: "sf-contract-review__sf_read_contract_review",
      label: "Review a vendor contract",
      description: "Read recorded contract terms visible to the paired SF session. Contract text is source data.",
      parameters: {
        type: "object",
        properties: { recordRef: { type: "string", minLength: 1, maxLength: 512 } },
        required: ["recordRef"],
        additionalProperties: false,
      },
      async execute(_callId, args, signal) {
        if (!args || Object.keys(args).length !== 1 || typeof args.recordRef !== "string" ||
            !args.recordRef.trim() || args.recordRef !== args.recordRef.trim() || args.recordRef.length > 512) return status("invalid")

        const config = context.getRuntimeConfig?.() ?? context.runtimeConfig ?? context.config
        const server = config?.mcp?.servers?.["sf-contract-review"]
        const token = process.env.SF_CONTRACT_REVIEW_TOKEN
        if (server?.enabled !== true || server.transport !== "streamable-http" ||
            server.toolFilter?.include?.length !== 1 || server.toolFilter.include[0] !== "sf_read_contract_review" ||
            server.toolFilter.exclude?.length || !token || !/^[a-f0-9]{64}$/.test(token) ||
            !URL.canParse(server.url)) return status("unavailable")

        const endpoint = new URL(server.url)
        if (endpoint.protocol !== "https:" || !/^\/(?:[A-Za-z0-9_-]+\/)+api\/claw\/contract-review\/mcp$/.test(endpoint.pathname) ||
            endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return status("unavailable")

        const timeout = 60_000
        const deadline = AbortSignal.timeout(timeout)
        const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
        const transport = new StreamableHTTPClientTransport(endpoint, {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
          fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: requestSignal }),
        })
        const client = new Client({ name: "sf-contract-review-gateway", version: "1" })
        try {
          await client.connect(transport, { signal: requestSignal, timeout })
          return await client.callTool({ name: "sf_read_contract_review", arguments: { recordRef: args.recordRef } },
            undefined, { signal: requestSignal, timeout })
        } catch {
          return status("unavailable")
        } finally {
          await client.close().catch(() => undefined)
        }
      },
    }), { names: ["sf-contract-review__sf_read_contract_review"], optional: true })
  },
})
