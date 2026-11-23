import { expect, test } from "bun:test"
import { forwardError } from "../e2e/sucafina/operations-support/forward-error"

test("forwarded failures remain rejected without Playwright headers, request secrets or nested error data", async () => {
  const secrets = ["fixture-cookie-value", "fixture-bearer-value", "fixture-basic-value", "fixture-ticket-value", "fixture-password-value"]
  const original = new Error([
    "route.fetch: Test ended.",
    "Call log:",
    "  - → GET http://127.0.0.1:4174/sucafina/dashboard?ticket=" + secrets[3],
    "  - Cookie: session=" + secrets[0],
    "  - Authorization: Bearer " + secrets[1],
    "  - Proxy-Authorization: Basic " + secrets[2],
  ].join("\n"), { cause: new Error("password=" + secrets[4]) })
  original.name = "TimeoutError"
  original.stack = "raw stack containing " + secrets.join(" ")
  const failure = forwardError(original, "GET",
    "http://operator:" + secrets[4] + "@127.0.0.1:4174/sucafina/dashboard?ticket=" + secrets[3])
  await expect(Promise.reject(failure)).rejects.toBe(failure)
  expect(failure).not.toBe(original)
  expect(failure.name).toBe("TimeoutError")
  expect(failure.message).toBe("GET /sucafina/dashboard: route.fetch: Test ended.")
  expect(Object.hasOwn(failure, "cause")).toBe(false)
  for (const secret of secrets) {
    expect(failure.message).not.toContain(secret)
    expect(failure.stack).not.toContain(secret)
  }
  expect(failure.stack).not.toContain("raw stack")
})

test("status assertion diagnostics survive while credentials outside a Playwright call log are removed", () => {
  const original = new Error([
    "Expected: 200",
    "Received: 409",
    "cookie: session=outside-cookie",
    '"Authorization": "Bearer outside-bearer"',
    "Set-Cookie: session=outside-response-cookie",
    "Proxy-Authorization: Basic outside-basic",
    "token=outside-token",
    "request https://operator:outside-password@example.test/sucafina/dashboard?secret=outside-query",
  ].join("\n"))
  original.name = "AssertionError"
  const failure = forwardError(original, "POST", "http://127.0.0.1:4174/sucafina/procurement")
  expect(failure.name).toBe("AssertionError")
  expect(failure.message).toContain("POST /sucafina/procurement: Expected: 200\nReceived: 409")
  expect(failure.message).not.toContain("outside-")
  expect(failure.stack).not.toContain("outside-")
  expect(Object.hasOwn(failure, "cause")).toBe(false)
})
