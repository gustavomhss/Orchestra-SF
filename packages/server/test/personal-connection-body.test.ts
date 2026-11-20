import { expect, test } from "bun:test"
import { readPersonalConnectionCommand } from "../src/personal-connection-body"

const request = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://synthetic.invalid/sucafina/api/connection/personal", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  })

test("personal-body-01: complete UTF-8 JSON is preserved and exact byte length is checked", async () => {
  const value = '{"label":"café","key":{"id":"one"}}'
  expect(await readPersonalConnectionCommand(request(value))).toEqual({ status: "parsed", value: JSON.parse(value) })
  expect(await readPersonalConnectionCommand(request(value, { "content-length": String(new TextEncoder().encode(value).byteLength) })))
    .toEqual({ status: "parsed", value: JSON.parse(value) })
  expect(await readPersonalConnectionCommand(request(value, { "content-length": String(value.length) }))).toEqual({ status: 400 })
})

test("personal-body-02: duplicate, escaped duplicate, prototype, trailing and malformed UTF-8 inputs are refused", async () => {
  for (const value of [
    '{"action":"create","action":"remove"}', '{"id":"one","\\u0069d":"two"}',
    '{"key":{"id":"one","id":"two"}}', '{"__proto__":{}}', '{"constructor":{}}',
    '{"prototype":{}}', '{} trailing', '{',
  ]) expect(await readPersonalConnectionCommand(request(value))).toEqual({ status: 400 })
  expect(await readPersonalConnectionCommand(request(new Uint8Array([0xc3, 0x28])))).toEqual({ status: 400 })
})

test("personal-body-03: declared and streamed limits, encoding and media type are enforced", async () => {
  expect(await readPersonalConnectionCommand(request("{}", { "content-length": "32769" }))).toEqual({ status: 413 })
  expect(await readPersonalConnectionCommand(request("x".repeat(32769)))).toEqual({ status: 413 })
  expect(await readPersonalConnectionCommand(request("{}", { "content-length": "-1" }))).toEqual({ status: 400 })
  expect(await readPersonalConnectionCommand(request("{}", { "content-type": "text/plain" }))).toEqual({ status: 415 })
  expect(await readPersonalConnectionCommand(request("{}", { "content-encoding": "gzip" }))).toEqual({ status: 415 })
})

test("personal-body-04: valid JSON is not accepted without EOF and the body is cancelled at the actual deadline", async () => {
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode("{}")) },
    cancel() { cancelled = true },
  })
  expect(await readPersonalConnectionCommand(request(stream))).toEqual({ status: 408 })
  expect(cancelled).toBe(true)
}, 10000)

test("personal-body-05: abort during a partial body prevents acceptance and cancels its reader", async () => {
  const controller = new AbortController()
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
  const body = new Request("https://synthetic.invalid/sucafina/api/connection/personal", {
    method: "POST", headers: { "content-type": "application/json" }, body: stream, signal: controller.signal,
  })
  const result = readPersonalConnectionCommand(body)
  controller.abort()
  expect(await result).toEqual({ status: 400 })
  expect(cancelled).toBe(true)
})
