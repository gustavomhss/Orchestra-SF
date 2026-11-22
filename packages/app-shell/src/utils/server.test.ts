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

describe("technical active-session adapter", () => {
  // Controlled HTTP replies exercise the actual generated client and the app's adapter together.
  const read = async (body: unknown) => {
    const requests: string[] = []
    const listener = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (request) => {
        const url = new URL(request.url)
        requests.push(request.method + " " + url.pathname + url.search)
        return Response.json(body)
      },
    })
    try {
      return await createApiForServer({ server: { url: listener.url.origin } }).session.active()
    } finally {
      listener.stop(true)
      expect(requests).toEqual(["GET /api/session/active"])
    }
  }

  test("unwraps an empty current envelope without a phantom data session", async () => {
    const active = await read({ data: {} })
    expect(active).toEqual({})
    expect(Object.keys(active)).toEqual([])
  })

  test("returns only real active session IDs from the current envelope", async () => {
    const data = { ses_active_first: { type: "running" }, ses_active_second: { type: "running" } }
    const active = await read({ data })
    expect(active).toEqual(data)
    expect(Object.keys(active)).toEqual(["ses_active_first", "ses_active_second"])
    expect(active).not.toHaveProperty("data")
    expect(active).not.toHaveProperty("namespace")
  })

  test("rejects corporate data instead of discarding its owner namespace", async () => {
    const tenantId = "10000000-0000-4000-8000-000000000001"
    const namespace = {
      version: 1,
      owner: {
        profile: { installationId: "test-installation", tenantId,
          teamObjectId: "20000000-0000-4000-8000-000000000002" },
        principal: { tenantId, principalObjectId: "30000000-0000-4000-8000-000000000003" },
      },
      authorityGeneration: 1,
    }
    await expect(read({ data: { ses_owned: { type: "running" } }, namespace }))
      .rejects.toMatchObject({ name: "ClientError", reason: "MalformedResponse" })
  })

  test("rejects a present null namespace instead of treating it as technical", async () => {
    await expect(read({ data: {}, namespace: null }))
      .rejects.toMatchObject({ name: "ClientError", reason: "MalformedResponse" })
  })

  test("requires the current envelope and an object data map", async () => {
    for (const body of [null, { ses_bare: { type: "running" } }, { data: null }, { data: [] }]) {
      await expect(read(body)).rejects.toMatchObject({ name: "ClientError", reason: "MalformedResponse" })
    }
  })
})
