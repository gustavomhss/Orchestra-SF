import { describe, expect, test } from "bun:test"
import { isRedactable, redactLog, redactLogFile } from "./log-redact"

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

  test("an unmatched quote cannot consume the next log record", () => {
    expect(redactLog('Authorization: "Bearer fixture missing end\r\nnext: "retained"')).toBe(
      'Authorization: "[redacted]\r\nnext: "retained"',
    )
  })

  test("preserves JSON scalars, record boundaries and non-sensitive numeric tokens on export", () => {
    const first = '{"authorization": null, "password": -123.5e+2, "counter": 9007199254740993}'
    const second = JSON.stringify({ message: 'Authorization: "Bearer fixture escaped value"', ok: true })
    const clean = redactLogFile("desktop/events.jsonl.1", first + "\r\n" + second + "\r\n")
    expect(clean).toBe(
      '{"authorization": "[redacted]", "password": "[redacted]", "counter": 9007199254740993}\r\n' +
      JSON.stringify({ message: 'Authorization: "[redacted]"', ok: true }) + "\r\n",
    )
    expect(redactLogFile("network.netlog", '{"\\u0070assword":\n42, "x-api-key": false}')).toBe(
      '{"\\u0070assword":\n"[redacted]", "x-api-key": "[redacted]"}',
    )
    expect(redactLogFile("desktop/events.jsonl.1", clean)).toBe(clean)
  })

  test("replaces malformed records without preserving fragments of truncated strings", () => {
    const truncated = '{"message":"url /events?auth_token=fixture-secret'
    const marker = '{"redacted":"malformed log record"}'
    expect(redactLogFile("events.jsonl.1", '{"ok":1}\r\n' + truncated + '\r\n{"ok":2}\n\n' + truncated))
      .toBe('{"ok":1}\r\n' + marker + '\r\n{"ok":2}\n\n' + marker)
    expect(redactLogFile("network.netlog", '{"events":[\n' + truncated)).toBe(marker)
    expect(redactLogFile("legacy.json", '{"password":"fixture-secret\\')).toBe(marker)
  })

  test("selects log text and not crash dumps", () => {
    expect(isRedactable("server-1/orchestra.log")).toBe(true)
    expect(isRedactable("network.netlog")).toBe(true)
    expect(isRedactable("crashpad/abc.dmp")).toBe(false)
  })
})
