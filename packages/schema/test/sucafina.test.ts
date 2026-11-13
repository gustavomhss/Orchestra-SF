import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { Sucafina } from "../src/sucafina"

const signedOut = {
  configured: true,
  authentication: "local-operator",
  authenticated: false,
  enrollmentRequired: true,
  surfaces: [],
} as const

const signedIn = {
  ...signedOut,
  authenticated: true,
  enrollmentRequired: false,
  surfaces: ["dashboard", "planner", "procurement"],
  principal: { id: "macos:501", name: "Fixture operator" },
  sessionScope: "ab".repeat(32),
} as const

describe("native Sucafina wire contract", () => {
  test("an omitted page lets the business gateway choose the first permitted page", () => {
    expect(Schema.decodeUnknownSync(Sucafina.PageQuery)({})).toEqual({})
    expect(Schema.decodeUnknownSync(Sucafina.PageQuery)({ year: "2026" })).toEqual({ year: "2026" })
  })

  test("explicit page and selection filters survive decoding", () => {
    const query = { page: "OPEX", year: "2026", version: "approved", owner: "owner-1" }
    expect(Schema.decodeUnknownSync(Sucafina.PageQuery)(query)).toEqual(query)
  })

  test("signed-out status requires no invented principal or session binding", () => {
    expect(Schema.decodeUnknownSync(Sucafina.Status)(signedOut)).toEqual(signedOut)
  })

  test("the authenticated OS principal and nonsecret scope survive decoding", () => {
    expect(Schema.decodeUnknownSync(Sucafina.Status)(signedIn)).toEqual(signedIn)
  })

  test.each([true, false])("server host authentication proof survives decoding: %s", (hostAuthenticated) => {
    const status = { ...signedIn, hostAuthenticated }
    expect(Schema.decodeUnknownSync(Sucafina.Status)(status)).toEqual(status)
  })

  test("host authentication proof accepts only a boolean", () => {
    expect(() => Schema.decodeUnknownSync(Sucafina.Status)({ ...signedIn, hostAuthenticated: "true" })).toThrow()
  })

  test.each(["", "ab", "ab".repeat(31), "ab".repeat(33), "AB".repeat(32), "ab".repeat(32) + "\n"])(
    "rejects malformed session binding %j",
    (sessionScope) => {
      expect(() => Schema.decodeUnknownSync(Sucafina.Status)({ ...signedIn, sessionScope })).toThrow()
    },
  )
})
