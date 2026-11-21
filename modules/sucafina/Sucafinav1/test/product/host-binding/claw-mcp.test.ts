import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CapabilityResult, TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfClawMcpHandler } from "../../../product/host-binding/claw-mcp.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

const origin = "https://sf.example.test"
const mount = "/sucafina"
const operation = "sf_sourcing_compare"
const requestRef = "evidence:request"
const identity = { installationId: "installation", projectId: "project", principalRef: "buyer", policyVersion: "policy", accessRevision: "access" }

function rpc(method: string, params?: object, secret = "fixture-session") {
  return new Request(origin + mount + "/api/claw/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer " + secret },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
}

test("purchase MCP is opt-in and requires endpoint authentication", async () => {
  const handler = createSfClawMcpHandler({
    origin, mount,
    authenticate: async (request) => request.headers.get("authorization") === "Bearer fixture-session",
    read: async () => ({ status: "ok" }),
  })
  expect((await handler(rpc("tools/list", undefined, "invalid")))?.status).toBe(403)
  expect((await (await handler(rpc("tools/list")))?.json()).result.tools.map((tool: { name: string }) => tool.name))
    .toEqual(["sf_pendencias"])
})

test("purchase MCP dispatches only the admitted comparison and returns its recorded version and review link", async () => {
  let session = true
  let revokeAfterDispatch = false
  let wrongTarget = false
  let dispatched = 0
  let binding: TrustedUiContext | undefined
  const ui = createSfUiAuthority({
    authorize: async (request, action) => session && request === authorized && action === operation ? identity : undefined,
    commandIdentity: async () => "command",
    createId: () => "request-id",
    now: Date.now,
  })
  const evidence = {
    schema: "sf-evidence-v1", kind: "record", refId: requestRef, installationId: identity.installationId,
    projectId: identity.projectId, refDigest: "", evidenceLevel: "observed",
    target: {
      surface: "procurement", recordType: "procurement-request", recordId: "PR-2026-0001",
      incarnation: "incarnation", version: 2, fields: ["sourcing"], projectionDigest: "b".repeat(64),
    },
  } satisfies BusinessEvidenceRef
  const comparison = {
    requestRef, requestVersion: 2, currency: "USD", proposals: [], ranking: [], conditions: [],
    sourceRefs: [{ ...evidence, refDigest: digestSfEvidenceRef(evidence) }],
    selection: { proposalRef: "A", reason: null },
  } satisfies Extract<CapabilityResult, { status: "ok" }>["result"]
  const runtime = {
    ui,
    async dispatch(action: string, payload: unknown, context: TrustedDomainContext): Promise<CapabilityResult> {
      dispatched++
      expect(action).toBe(operation)
      expect(payload).toEqual({ requestRef, proposalRefs: [], criteria: [] })
      if (context.kind !== "ui") throw new Error("Expected UI authority")
      binding = context
      const digest = digestSfValue(payload)
      expect(await ui.validate(binding, action, digest)).toBe(true)
      expect(ui.requestFor(binding)).toBe(authorized)
      const receipt = ui.receiptFor(binding, action, digest)!
      if (revokeAfterDispatch) session = false
      const source = comparison.sourceRefs[0]!
      const result = wrongTarget
        ? { ...comparison, sourceRefs: [{ ...source, target: { ...source.target, recordId: "different-request" } }] }
        : comparison
      return { status: "ok", result, receipt }
    },
  }
  const handler = createSfClawMcpHandler({
    origin, mount, procurement: () => runtime,
    authenticate: async (request) => request.headers.get("authorization") === "Bearer fixture-session",
    read: async () => ({ status: "ok" }),
  })
  const call = (args: object, name = "sf_comparar_compra") => rpc("tools/call", { name, arguments: args })
  let authorized = call({ requestRef })
  const listed = await (await handler(rpc("tools/list")))?.json()
  expect(listed.result.tools).toContainEqual(expect.objectContaining({
    name: "sf_comparar_compra", annotations: expect.objectContaining({ readOnlyHint: true }),
  }))
  for (const invalid of [call({ requestRef, criteria: ["other"] }), call({ requestRef }, "select_quote"), call({ requestRef: " " })]) {
    const response = await (await handler(invalid))?.json()
    expect(response.result.isError).toBe(true)
    expect(JSON.parse(response.result.content[0].text)).toEqual({ status: "invalid" })
  }
  const denied = await (await handler(call({ requestRef })))?.json()
  expect(JSON.parse(denied.result.content[0].text)).toEqual({ status: "denied" })
  expect(dispatched).toBe(0)

  const result = await (await handler(authorized))?.json()
  expect(result.result.isError).toBe(false)
  expect(JSON.parse(result.result.content[0].text)).toEqual({
    status: "ok", comparison,
    reviewUrl: origin + "/orchestra/sf-procurement/requests/r_UFItMjAyNi0wMDAx/sourcing/compare?" +
      new URLSearchParams({ server: origin, project: identity.projectId, installation: identity.installationId }),
  })
  expect(dispatched).toBe(1)
  expect(ui.requestFor(binding!)).toBeUndefined()
  wrongTarget = true
  authorized = call({ requestRef })
  const tampered = await (await handler(authorized))?.json()
  expect(tampered.result.isError).toBe(true)
  expect(JSON.parse(tampered.result.content[0].text)).toEqual({ status: "unavailable" })

  wrongTarget = false
  revokeAfterDispatch = true
  authorized = call({ requestRef })
  const revoked = await (await handler(authorized))?.json()
  expect(revoked.result.isError).toBe(true)
  expect(JSON.parse(revoked.result.content[0].text)).toEqual({ status: "denied" })
  expect(ui.requestFor(binding!)).toBeUndefined()
})
