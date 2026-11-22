import { describe, expect, test } from "bun:test"
import { isRedactable, redactLog } from "./log-redact"

describe("redactLog", () => {
  test("hides auth_token query values and keeps the rest of the URL", () => {
    expect(redactLog("GET /event?auth_token=abc123&directory=%2Ftmp 200")).toBe(
      "GET /event?auth_token=[redacted]&directory=%2Ftmp 200",
    )
  })

  test("hides Authorization header values in text and netlog JSON", () => {
    expect(redactLog("Authorization: Basic b3JjaGVzdHJhOnNlY3JldA==")).toBe("Authorization: [redacted]")
    expect(redactLog('{"params":{"headers":["authorization: Bearer abcdefghijkl","host: localhost"]}}')).toBe(
      '{"params":{"headers":["authorization: [redacted]","host: localhost"]}}',
    )
  })

  test("hides a bare Basic credential", () => {
    expect(redactLog("sent Basic b3JjaGVzdHJhOnNlY3JldA== upstream")).toBe("sent Basic [redacted] upstream")
  })

  test("keeps structured text valid and makes subsequent export redaction idempotent", () => {
    const formatted = JSON.stringify({
      authorization: 'Bearer fixture "quoted" value',
      password: "fixture password",
      url: "https://user:fixture-secret@example.invalid/path?access_token=fixture-token&keep=1#anchor",
    })
    const clean = redactLog(formatted)
    expect(JSON.parse(clean)).toEqual({
      authorization: "[redacted]",
      password: "[redacted]",
      url: "https://[redacted]@example.invalid/path?access_token=[redacted]&keep=1#anchor",
    })
    expect(redactLog(clean)).toBe(clean)
  })

  test("selects log text and not crash dumps", () => {
    expect(isRedactable("server-1/orchestra.log")).toBe(true)
    expect(isRedactable("network.netlog")).toBe(true)
    expect(isRedactable("crashpad/abc.dmp")).toBe(false)
  })
})
