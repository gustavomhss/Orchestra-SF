import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { limitRequestBody } from "../../../runtime/request-body.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { draftBody, streamedBody, workbenchFixture } from "./workbench-fixture.ts"

test("Workbench accepts exactly 65536 UTF-8 bytes once and retains the original authenticated Request and command", async () => {
  const f = await workbenchFixture()
  try {
    for (const [index, objective] of ["Review renewal", "Revisão ☕ café 😀"].entries()) {
      const key = `body-limit-exact-${index}`
      const payload = draftBody(objective)
      const json = JSON.stringify(payload)
      const bytes = new TextEncoder().encode(json + " ".repeat(65536 - new TextEncoder().encode(json).byteLength))
      expect(bytes.byteLength).toBe(65536)
      const input = streamedBody(bytes, 7) // UTF-8 characters cross chunk boundaries.
      const request = f.request(input.stream, { headers: { "idempotency-key": key } })
      const response = await f.product(request, "dashboard")
      expect(response?.status).toBe(200)
      expect(response?.headers.get("cache-control")).toBe("no-store")
      expect(response?.headers.get("x-content-type-options")).toBe("nosniff")
      const result = await response!.json()
      expect(result.status).toBe("ok")
      expect(result.value.objective).toBe(objective)
      expect(result.outputRef).toStartWith("case:")
      expect(input.observed.bytes).toBe(65536)
      expect(input.observed.ended).toBe(true)
      expect(input.observed.cancelled).toBe(0)
      expect(request.bodyUsed).toBe(true)
      expect(request.body?.locked).toBe(false)
      expect(f.observed.admissions.at(-1)).toBe(request)
      expect(f.observed.commands.at(-1)).toEqual({ request, operation: "sf_case_draft", inputDigest: digestSfValue(payload.input), commandId: digestSfValue({ operation: "sf_case_draft", key }) })
      expect(f.observed.dispatches.at(-1)?.request).toBe(request)
      expect(f.observed.dispatches.at(-1)?.input).toEqual(payload.input)
      expect(f.observed.authentication.filter((value) => value === request).length).toBeGreaterThan(0)
      const retried = await f.product(f.request(JSON.stringify(payload), { headers: { "idempotency-key": key } }), "dashboard")
      expect(retried?.status).toBe(200)
      expect((await retried!.json()).outputRef).toBe(result.outputRef)
    }
    const stored = await f.snapshot()
    const cases = Object.values(object(object(stored.data.__sfProductV1).cases)).map(object)
    expect(cases).toHaveLength(2)
    expect(cases.map((entry) => entry.objective).sort()).toEqual(["Review renewal", "Revisão ☕ café 😀"].sort())
  } finally { await f.close() }
})

test("Workbench cuts off oversized multibyte streams without Content-Length or with an understated budget before admission", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const payload = JSON.stringify(draftBody("☕".repeat(24000)))
    expect(payload.length).toBeLessThan(65536)
    const bytes = new TextEncoder().encode(payload)
    expect(bytes.byteLength).toBeGreaterThan(65536)
    for (const headers of [new Headers(), new Headers({ "content-length": "65536" })]) {
      const input = streamedBody(bytes)
      const request = f.request(input.stream, { headers })
      const response = await f.product(request, "dashboard")
      expect(response?.status).toBe(413)
      expect(await response!.json()).toEqual({ status: "invalid" })
      expect(response?.headers.get("cache-control")).toBe("no-store")
      expect(input.observed.bytes).toBeLessThan(bytes.byteLength)
      expect(input.observed.bytes).toBeLessThanOrEqual(65536 + 4096)
      expect(input.observed.cancelled).toBe(1)
      expect(input.observed.ended).toBe(false)
      expect(request.body?.locked).toBe(false)
      expect(await f.snapshot()).toEqual(before)
    }
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.commands).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
  } finally { await f.close() }
})

test("Workbench rejects an excessive declared length without pulling the body and leaves SQLite unchanged", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const input = streamedBody(new TextEncoder().encode(JSON.stringify(draftBody())))
    const request = f.request(input.stream, { headers: { "content-length": "65537" } })
    const response = await f.product(request, "dashboard")
    expect(response?.status).toBe(413)
    expect(await response!.json()).toEqual({ status: "invalid" })
    expect(input.observed.pulls).toBe(0)
    expect(input.observed.cancelled).toBe(1)
    expect(request.body?.locked).toBe(false)
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.close() }
})

test("Workbench refuses invalid, empty, truncated and length-mismatched bodies without dispatching writes", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const valid = JSON.stringify(draftBody())
    const samples: { body: BodyInit | null; length?: string }[] = [
      { body: "{" }, { body: null }, { body: valid.slice(0, -1) },
      { body: valid, length: String(new TextEncoder().encode(valid).byteLength + 10) },
      { body: valid, length: "2" }, { body: valid, length: "invalid" },
    ]
    for (const sample of samples) {
      const request = f.request(sample.body, { headers: sample.length === undefined ? {} : { "content-length": sample.length } })
      const response = await f.product(request, "dashboard")
      expect(response?.status).toBe(400)
      expect(await response!.json()).toEqual({ status: "invalid" })
      expect(request.body?.locked ?? false).toBe(false)
      expect(await f.snapshot()).toEqual(before)
    }
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.commands).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
  } finally { await f.close() }
})

test("Workbench refuses malformed UTF-8 inside otherwise valid JSON without admission or durable effects", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const json = JSON.stringify(draftBody("x"))
    const bytes = new TextEncoder().encode(json)
    const objectiveOffset = json.indexOf('"objective":"x"') + '"objective":"'.length
    expect(objectiveOffset).toBeGreaterThan(0)
    bytes[objectiveOffset] = 0xff // A replacing decoder would accept this as a different objective.
    const input = streamedBody(bytes, 3)
    const request = f.request(input.stream)
    const response = await f.product(request, "dashboard")
    expect(response?.status).toBe(400)
    expect(await response!.json()).toEqual({ status: "invalid" })
    expect(input.observed.bytes).toBe(bytes.byteLength)
    expect(request.body?.locked).toBe(false)
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.commands).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.close() }
})

test("The byte bounder filters empty chunks before buffering and Workbench still accepts the interleaved body", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(draftBody("Empty chunks remain harmless")))
  const half = Math.floor(bytes.byteLength / 2)
  const interleaved = () => {
    const observed = { pulls: 0, cancelled: 0 }
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const step = observed.pulls++
        if (step === 386) controller.close()
        else if (step === 128) controller.enqueue(bytes.slice(0, half))
        else if (step === 257) controller.enqueue(bytes.slice(half))
        else controller.enqueue(new Uint8Array())
      },
      cancel() { observed.cancelled++ },
    }, { highWaterMark: 0 })
    return { stream, observed }
  }
  const input = interleaved()
  const bounded = limitRequestBody(input.stream, { limit: bytes.byteLength, signal: new AbortController().signal })
  const reader = bounded.body!.getReader()
  try {
    expect(await reader.read()).toEqual({ done: false, value: bytes.slice(0, half) })
    expect(await reader.read()).toEqual({ done: false, value: bytes.slice(half) })
    expect((await reader.read()).done).toBe(true)
    expect(input.observed.pulls).toBe(387)
    expect(input.observed.cancelled).toBe(0)
    expect(bounded.complete()).toBe(true)
    expect(bounded.failure()).toBeUndefined()
    expect(input.stream.locked).toBe(false)
  } finally { reader.releaseLock(); bounded.dispose() }

  const f = await workbenchFixture()
  try {
    const actual = interleaved()
    const request = f.request(actual.stream)
    const response = await f.product(request, "dashboard")
    expect(response?.status).toBe(200)
    expect((await response!.json()).value.objective).toBe("Empty chunks remain harmless")
    expect(actual.observed.pulls).toBe(387)
    expect(actual.observed.cancelled).toBe(0)
    expect(request.body?.locked).toBe(false)
    expect(f.observed.dispatches).toHaveLength(1)
    expect(f.observed.dispatches[0]?.request).toBe(request)
    expect(Object.values(object(object((await f.snapshot()).data.__sfProductV1).cases))).toHaveLength(1)
  } finally { await f.close() }
}, 10000)

test("Workbench read failure is private and releases the body without admitting a command", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("synthetic-token-74-must-not-escape")) } }, { highWaterMark: 0 })
    const request = f.request(stream)
    const response = await f.product(request, "dashboard")
    expect(response?.status).toBe(400)
    expect(await response!.text()).toBe('{"status":"invalid"}')
    expect(request.body?.locked).toBe(false)
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.close() }
})

test("Workbench abort cancels a stalled reader, unlocks it and leaves no durable effect", async () => {
  const f = await workbenchFixture()
  const abort = new AbortController()
  const waiting = Promise.withResolvers<void>()
  const observation = { pulls: 0, cancelled: 0 }
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      observation.pulls++
      if (observation.pulls === 1) { controller.enqueue(new TextEncoder().encode('{"operation":')); return }
      waiting.resolve()
    },
    cancel() { observation.cancelled++ },
  }, { highWaterMark: 0 })
  try {
    const before = await f.snapshot()
    const request = f.request(stream, { signal: abort.signal })
    const pending = f.product(request, "dashboard")
    await waiting.promise
    abort.abort()
    const response = await pending
    expect(response?.status).toBe(400)
    expect(await response!.json()).toEqual({ status: "invalid" })
    expect(observation.cancelled).toBe(1)
    expect(request.signal.aborted).toBe(true)
    expect(request.body?.locked).toBe(false)
    expect(f.observed.admissions).toHaveLength(0)
    expect(f.observed.dispatches).toHaveLength(0)
    expect(await f.snapshot()).toEqual(before)
  } finally { abort.abort(); if (!stream.locked) await stream.cancel().catch(() => {}); await f.close() }
}, 10000)

test("Body protection preserves CSRF and current authentication refusals without creating cases", async () => {
  const f = await workbenchFixture()
  try {
    const before = await f.snapshot()
    const payload = JSON.stringify(draftBody())
    const wrongOrigin = await f.product(f.request(payload, { headers: { origin: "https://other.example" } }), "dashboard")
    expect(wrongOrigin?.status).toBe(403)
    const crossSite = await f.product(f.request(payload, { headers: { "sec-fetch-site": "cross-site" } }), "dashboard")
    expect(crossSite?.status).toBe(403)
    expect((await f.logout())?.status).toBe(204)
    const loggedOut = await f.product(f.request(payload), "dashboard")
    expect(loggedOut?.status).toBe(403)
    expect(f.observed.dispatches).toHaveLength(0)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.close() }
})
