import { describe, expect, test } from "bun:test"
import { authFromToken, authTokenFromCredentials, createApiForServer } from "./server"

describe("authFromToken", () => {
  test("decodes basic auth credentials from auth_token", () => {
    expect(authFromToken(btoa("kit:secret"))).toEqual({ username: "kit", password: "secret" })
  })

  test("defaults blank username to orchestra", () => {
    expect(authFromToken(btoa(":secret"))).toEqual({ username: "orchestra", password: "secret" })
  })

  test("ignores malformed tokens", () => {
    expect(authFromToken("not base64")).toBeUndefined()
    expect(authFromToken(btoa("missing-separator"))).toBeUndefined()
  })
})

describe("authTokenFromCredentials", () => {
  test("encodes credentials with the default username", () => {
    expect(authTokenFromCredentials({ password: "secret" })).toBe(btoa("orchestra:secret"))
  })
})

async function withActiveResponse(
  body: unknown,
  run: (api: ReturnType<typeof createApiForServer>, requests: readonly { method: string; url: string }[], origin: string) => Promise<void>,
) {
  const requests: { method: string; url: string }[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    fetch(request) {
      requests.push({ method: request.method, url: request.url })
      const url = new URL(request.url)
      if (request.method !== "GET" || url.pathname !== "/api/session/active" || url.search)
        return new Response(null, { status: 404 })
      return Response.json(body)
    },
  })
  try {
    const origin = server.url.origin
    await run(createApiForServer({ server: { url: origin } }), requests, origin)
  } finally { await server.stop(true) }
}

describe("technical active-session adapter", () => {
  const namespace = {
    version: 1,
    owner: {
      profile: { installationId: "sf-test-installation", tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      principal: { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", principalObjectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    },
    authorityGeneration: 1,
  }
  test("unwraps the canonical empty envelope without making its metadata a session ID", async () => {
    for (const body of [{ data: {} }, { data: {}, namespace: null }]) {
      await withActiveResponse(body, async (api, requests, origin) => {
        const active = await api.session.active()
        expect(active).toEqual({})
        expect(Object.keys(active)).toEqual([])
        expect(requests).toHaveLength(1)
        expect(requests[0]!.url).toBe(origin + "/api/session/active")
      })
    }
  })
  test("returns only the running IDs through the real generated Client", async () => {
    const data = { ses_running: { type: "running" } }
    await withActiveResponse({ data }, async (api, requests) => {
      const active = await api.session.active()
      expect(active).toEqual(data)
      expect(Object.keys(active)).toEqual(["ses_running"])
      expect(requests).toHaveLength(1)
    })
  })
  test("refuses a corporate namespace in the technical adapter", async () => {
    await withActiveResponse({ data: { ses_private: { type: "running" } }, namespace }, async (api, requests) => {
      await expect(api.session.active()).rejects.toThrow()
      expect(requests).toHaveLength(1)
    })
  })
  test("refuses malformed data or additional authority fields instead of seeding them", async () => {
    for (const body of [{ data: [] }, { data: { ses_bad: { type: "idle" } } }, { data: {}, owner: namespace.owner }]) {
      await withActiveResponse(body, async (api, requests) => {
        await expect(api.session.active()).rejects.toThrow()
        expect(requests).toHaveLength(1)
      })
    }
  })
})
