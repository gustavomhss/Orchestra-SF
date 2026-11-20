import { describe, expect, spyOn, test } from "bun:test"
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
      const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body))
      try {
        const api = createApiForServer({ server: { url: "https://technical.example.test" } })
        const active = await api.session.active()
        expect(active).toEqual({})
        expect(Object.keys(active)).toEqual([])
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(String(fetch.mock.calls[0]![0])).toBe("https://technical.example.test/api/session/active")
      } finally { fetch.mockRestore() }
    }
  })
  test("returns only the running IDs through the real generated Client", async () => {
    const data = { ses_running: { type: "running" } }
    const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data }))
    try {
      const api = createApiForServer({ server: { url: "https://technical.example.test" } })
      const active = await api.session.active()
      expect(active).toEqual(data)
      expect(Object.keys(active)).toEqual(["ses_running"])
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally { fetch.mockRestore() }
  })
  test("refuses a corporate namespace in the technical adapter", async () => {
    const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: { ses_private: { type: "running" } }, namespace }))
    try {
      const api = createApiForServer({ server: { url: "https://technical.example.test" } })
      await expect(api.session.active()).rejects.toThrow()
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally { fetch.mockRestore() }
  })
  test("refuses malformed data or additional authority fields instead of seeding them", async () => {
    for (const body of [{ data: [] }, { data: { ses_bad: { type: "idle" } } }, { data: {}, owner: namespace.owner }]) {
      const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body))
      try {
        const api = createApiForServer({ server: { url: "https://technical.example.test" } })
        await expect(api.session.active()).rejects.toThrow()
        expect(fetch).toHaveBeenCalledTimes(1)
      } finally { fetch.mockRestore() }
    }
  })
})
