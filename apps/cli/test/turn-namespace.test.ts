import { expect, test } from "bun:test"
import { Orchestra } from "@orchestra/client"
import { runTurn } from "../src/turn"

const namespace = { version: 1, authorityGeneration: 1, owner: {
  profile: { installationId: "unexpected-team", tenantId: "11111111-2222-4333-8444-555555555555",
    teamObjectId: "a1111111-2222-4333-8444-555555555555" },
  principal: { tenantId: "11111111-2222-4333-8444-555555555555",
    principalObjectId: "b1111111-2222-4333-8444-555555555555" },
} }
for (const changeAfterSubmit of [false, true]) {
  test("technical turns refuse a Team namespace " + (changeAfterSubmit ? "during history recovery" : "before submission"), async () => {
    let historyReads = 0, submissions = 0, delivered = 0
    const transport = Object.assign(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      if (url.pathname.endsWith("/history")) {
        historyReads++
        return Response.json({ data: [], hasMore: false,
          ...(!changeAfterSubmit || historyReads > 1 ? { namespace } : {}) })
      }
      if (url.pathname.endsWith("/event"))
        return new Response(": closed\n\n", { headers: { "content-type": "text/event-stream" } })
      if (url.pathname.endsWith("/wait")) return new Response(null, { status: 204 })
      return Response.json({ data: [] })
    }, { preconnect() {} })
    const client = Orchestra.make({ baseUrl: "https://technical.example.test", fetch: transport })
    await expect(runTurn(client, {
      sessionID: "ses_namespace_control",
      submit: async () => { submissions++; return { id: "msg_namespace_control" } },
      onEvent: () => { delivered++ },
      onPermission: async () => "reject",
    })).rejects.toThrow("Team sessions require a client that validates their owner and authority generation")
    expect(submissions).toBe(changeAfterSubmit ? 1 : 0)
    expect(historyReads).toBe(changeAfterSubmit ? 2 : 1)
    expect(delivered).toBe(0)
  })
}
