import { expect, test } from "bun:test"
import { createReviewDiscussionClient, ReviewDiscussionError } from "../../../product/reviews/collaboration-client.ts"

// These are transport fault regressions of the production client. Responses do
// not establish an identity, grant, real provider or native execution witness.
const binding = "a".repeat(64)
const address = "https://reports.example.invalid/sucafina/dashboard?reviewRef=transport-review#meeting"
const payload = {
  id: "transport-thread",
  body: "  Exact unsent draft\nwith the user's final line.  ",
  mutation: { expectedStorageVersion: 7, idempotencyKey: "transport-intent-01" },
}

test("a lost reply response remains unknown and sends again only on an explicit exact retry", async () => {
  const state = { loseResponse: true }
  const transport = fixture(() => {
    if (state.loseResponse) throw new TypeError("transport response lost")
    return ok({ transportReceipt: "same-intent" })
  })
  try {
    await failure(transport.client.post("collaboration-thread-reply", payload, payload.mutation.idempotencyKey), "recoverable", "unknown")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(0)
    const first = transport.requests[0]!
    expect(first.url).toBe("https://reports.example.invalid/sucafina/dashboard?sf=collaboration-thread-reply")
    expect(first.method).toBe("POST")
    expect(first.credentials).toBe("same-origin")
    expect(first.cache).toBe("no-store")
    expect(first.headers.get("X-SF-Review-Binding")).toBe(binding)
    expect(first.headers.get("Idempotency-Key")).toBe(payload.mutation.idempotencyKey)
    const body = await first.clone().text()
    expect(JSON.parse(body)).toEqual(payload)
    state.loseResponse = false
    expect(await transport.client.post("collaboration-thread-reply", payload, payload.mutation.idempotencyKey)).toEqual({ transportReceipt: "same-intent" })
    expect(transport.requests).toHaveLength(2)
    expect(await transport.requests[1]!.text()).toBe(body)
    expect(transport.requests[1]!.headers.get("Idempotency-Key")).toBe(first.headers.get("Idempotency-Key"))
    expect(transport.state.accessLost).toBe(0)
  } finally { transport.client.dispose() }
})

test("a 503 is recoverable with unknown outcome and never retries the edit", async () => {
  const transport = fixture(() => Response.json({ status: "unavailable", reason: "temporarily-unavailable" }, { status: 503 }))
  try {
    await failure(transport.client.post("collaboration-thread-edit", payload, payload.mutation.idempotencyKey), "recoverable", "unknown")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(0)
  } finally { transport.client.dispose() }
})

test("a stale CAS is a rejected conflict, preserving the supplied version and avoiding another mutation", async () => {
  const transport = fixture(() => Response.json({ status: "conflict", reason: "product-state-changed" }, { status: 409, headers: { "X-SF-Review-Binding": binding } }))
  try {
    await failure(transport.client.post("collaboration-thread-edit", payload, payload.mutation.idempotencyKey), "conflict", "rejected")
    expect(transport.requests).toHaveLength(1)
    expect(await transport.requests[0]!.json()).toEqual(payload)
    expect(transport.state.accessLost).toBe(0)
  } finally { transport.client.dispose() }
})

test.each(["idempotency-content-changed", "target-replaced"])("conflict %s cannot discard an earlier durable intent", async (reason) => {
  const transport = fixture(() => Response.json({ status: "conflict", reason }, { status: 409, headers: { "X-SF-Review-Binding": binding } }))
  try {
    await failure(transport.client.post("collaboration-thread-edit", payload, payload.mutation.idempotencyKey), "conflict", "unknown")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(0)
  } finally { transport.client.dispose() }
})

test.each([401, 403, 200])("denial status %s closes the client and invokes access loss once", async (status) => {
  const transport = fixture(() => Response.json({ status: "denied", reason: "access-unavailable" }, { status, headers: { "X-SF-Review-Binding": binding } }))
  try {
    await failure(transport.client.post("collaboration-thread-read", { id: payload.id }), "access", "rejected")
    expect(transport.state.accessLost).toBe(1)
    await failure(transport.client.post("collaboration-thread-reply", payload, payload.mutation.idempotencyKey), "access", "rejected")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(1)
  } finally { transport.client.dispose() }
})

test("the C6 masked thread-access denial also closes the client", async () => {
  const transport = fixture(() => Response.json({ status: "unavailable", reason: "thread-access-unavailable" }, { headers: { "X-SF-Review-Binding": binding } }))
  try {
    await failure(transport.client.thread(payload.id), "access", "rejected")
    expect(transport.state.accessLost).toBe(1)
    expect(transport.requests).toHaveLength(1)
  } finally { transport.client.dispose() }
})

test("a followed login redirect purges access even when its HTML response is 200", async () => {
  class LoginResponse extends Response {
    override get url() { return "https://reports.example.invalid/auth/login" }
    override get redirected() { return true }
  }
  const transport = fixture(() => new LoginResponse("<!doctype html><title>Sign in</title>", { headers: { "Content-Type": "text/html" } }))
  try {
    await failure(transport.client.post("collaboration-thread-read", { id: payload.id }), "access", "rejected")
    expect(transport.state.accessLost).toBe(1)
    expect(transport.requests).toHaveLength(1)
  } finally { transport.client.dispose() }
})

test.each([undefined, "b".repeat(64)])("a missing or changed response binding never releases a protected response (%s)", async (echo) => {
  const transport = fixture(() => Response.json({ status: "ok", value: { body: "must not be released" } }, { headers: echo ? { "X-SF-Review-Binding": echo } : {} }))
  try {
    await failure(transport.client.post("collaboration-thread-read", { id: payload.id }), "access", "rejected")
    // A missing capability closes this client without asserting global revocation.
    expect(transport.state.accessLost).toBe(echo === undefined ? 0 : 1)
    await failure(transport.client.post("collaboration-thread-read", { id: payload.id }), "access", "rejected")
    expect(transport.requests).toHaveLength(1)
  } finally { transport.client.dispose() }
})

test.each([undefined, "not-an-access-digest"])("an absent or malformed initial binding fails closed without a global revocation claim (%s)", async (initialBinding) => {
  const transport = fixture(() => ok({ body: "must not be requested" }), { binding: initialBinding })
  try {
    await failure(transport.client.post("collaboration-thread-read", { id: payload.id }), "access", "rejected")
    expect(transport.requests).toHaveLength(0)
    expect(transport.state.accessLost).toBe(0)
  } finally { transport.client.dispose() }
})

test("changing the local access binding refuses a request before transport", async () => {
  const transport = fixture(() => ok({ body: "must not be requested" }))
  try {
    transport.state.binding = "b".repeat(64)
    await failure(transport.client.post("collaboration-thread-reply", payload, payload.mutation.idempotencyKey), "access", "rejected")
    expect(transport.requests).toHaveLength(0)
    expect(transport.state.accessLost).toBe(1)
  } finally { transport.client.dispose() }
})

test("a response from an earlier access binding cannot resolve after the binding changes", async () => {
  const entered = Promise.withResolvers<void>()
  const held = Promise.withResolvers<Response>()
  const transport = fixture(() => { entered.resolve(); return held.promise })
  try {
    const pending = transport.client.post("collaboration-thread-read", { id: payload.id })
    await entered.promise
    transport.state.binding = "b".repeat(64)
    held.resolve(ok({ body: "stale protected response" }))
    await failure(pending, "access", "rejected")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(1)
  } finally { held.resolve(ok(undefined)); transport.client.dispose() }
})

test("dispose aborts transport and rejects even a late successful response", async () => {
  const entered = Promise.withResolvers<void>()
  const held = Promise.withResolvers<Response>()
  const transport = fixture(() => { entered.resolve(); return held.promise })
  try {
    const pending = transport.client.post("collaboration-thread-read", { id: payload.id })
    await entered.promise
    transport.client.dispose()
    expect(transport.requests[0]!.signal.aborted).toBe(true)
    held.resolve(ok({ body: "stale protected response" }))
    await failure(pending, "access", "rejected")
    await failure(transport.client.post("collaboration-thread-read", { id: payload.id }), "access", "rejected")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(0)
  } finally { held.resolve(ok(undefined)); transport.client.dispose() }
})

test("binding changes during response body consumption still suppress its protected value", async () => {
  const entered = Promise.withResolvers<void>()
  const held = Promise.withResolvers<unknown>()
  class HeldBodyResponse extends Response {
    override async json() { entered.resolve(); return await held.promise }
  }
  const transport = fixture(() => new HeldBodyResponse(null, { headers: { "X-SF-Review-Binding": binding } }))
  try {
    const pending = transport.client.post("collaboration-thread-read", { id: payload.id })
    await entered.promise
    transport.state.binding = "b".repeat(64)
    held.resolve({ status: "ok", value: { body: "stale protected body" } })
    await failure(pending, "access", "rejected")
    expect(transport.state.accessLost).toBe(1)
    expect(transport.requests).toHaveLength(1)
  } finally { held.resolve(undefined); transport.client.dispose() }
})

test("malformed JSON is an unknown outcome and does not trigger an automatic resend", async () => {
  const transport = fixture(() => new Response("{broken-json", { headers: { "Content-Type": "application/json", "X-SF-Review-Binding": binding } }))
  try {
    await failure(transport.client.post("collaboration-thread-reply", payload, payload.mutation.idempotencyKey), "invalid", "unknown")
    expect(transport.requests).toHaveLength(1)
    expect(transport.state.accessLost).toBe(0)
  } finally { transport.client.dispose() }
})

function ok(value: unknown) {
  return Response.json({ status: "ok", value }, { headers: { "X-SF-Review-Binding": binding } })
}

function fixture(respond: (request: Request) => Response | Promise<Response>, initial: { binding: string | undefined } = { binding }) {
  const state: { binding: string | undefined; accessLost: number } = { binding: initial.binding, accessLost: 0 }
  const requests: Request[] = []
  const send = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    return await respond(request)
  }
  const client = createReviewDiscussionClient(() => { state.accessLost += 1 }, {
    // Only the injected transport is simulated; the production client runs intact.
    fetch: send as typeof fetch,
    url: () => address,
    binding: () => state.binding,
  })
  return { state, requests, client }
}

async function failure(pending: Promise<unknown>, kind: ReviewDiscussionError["kind"], outcome: ReviewDiscussionError["outcome"]) {
  const result = await pending.then((value) => ({ resolved: true, value }), (error: unknown) => ({ resolved: false, error }))
  expect(result.resolved).toBe(false)
  if (!("error" in result)) throw new Error("Expected a rejected discussion operation")
  expect(result.error).toBeInstanceOf(ReviewDiscussionError)
  if (!(result.error instanceof ReviewDiscussionError)) throw new Error("Unexpected discussion error type")
  expect(result.error.kind).toBe(kind)
  expect(result.error.outcome).toBe(outcome)
}
