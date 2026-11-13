import { expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComputed, createRoot } from "solid-js"
import { createNativeAccess } from "../src/orchestra/chapters/sucafina/access"
import type { AccessController } from "../src/orchestra/chapters/sucafina/access"

const origin = "https://installation.example"
const scope = "a".repeat(64)
const ready = {
  configured: true,
  authentication: "local-operator",
  authenticated: true,
  enrollmentRequired: false,
  hostAuthenticated: true,
  principal: { id: "operator-1", name: "Operator One" },
  sessionScope: scope,
  surfaces: ["dashboard", "planner"],
} satisfies Sucafina.Status

function fixture() {
  const calls: { url: string; init: RequestInit; response: ReturnType<typeof Promise.withResolvers<Response>> }[] = []
  const controlled = Object.assign((input: string | URL | Request, init: RequestInit = {}) => {
    const response = Promise.withResolvers<Response>()
    calls.push({ url: String(input), init, response })
    return response.promise
  }, { preconnect: fetch.preconnect })
  const options = { origin, fetch: controlled }
  const root = createRoot((dispose) => ({ dispose, controller: createNativeAccess(options) }))
  return { ...root, options, calls }
}

function reply(f: ReturnType<typeof fixture>, index: number, body: unknown = ready, status = 200) {
  f.calls[index]!.response.resolve(Response.json(body, { status }))
}

async function grant(f: ReturnType<typeof fixture>) {
  const index = f.calls.length
  const pending = f.controller.refresh()
  reply(f, index)
  await pending
  expect(f.controller.state().phase).toBe("ready")
  expect(f.controller.state().verified).toBeDefined()
  return f.controller.state().verified!
}

function expectSignedOut(controller: AccessController) {
  expect(controller.state().phase).toBe("signed-out")
  expect(controller.state().verified).toBeUndefined()
  expect(controller.state().checking).toBe(false)
}

test("constructor is inert in a Solid owner and rejects invalid origins without fetch", () => {
  const f = fixture()
  try {
    expect(f.calls).toEqual([])
    expect(f.controller.state().phase).toBe("checking")
    expect(f.controller.state().verified).toBeUndefined()
    for (const invalid of ["", "ftp://installation.example", "https://user:pass@installation.example", `${origin}/path`, `${origin}?x=1`, `${origin}#x`])
      expect(() => createRoot((dispose) => { try { return createNativeAccess({ origin: invalid, fetch: f.options.fetch }) } finally { dispose() } })).toThrow()
    expect(f.calls).toEqual([])
  } finally { f.controller.dispose(); f.dispose() }
})

test("status fetch pins origin and carries only the native request options", async () => {
  const f = fixture()
  try {
    f.options.origin = "https://foreign.example"
    const pending = f.controller.refresh()
    expect(f.calls).toHaveLength(1)
    const call = f.calls[0]!
    expect(call.url).toBe(`${origin}/api/sucafina/status`)
    expect(call.init.method ?? "GET").toBe("GET")
    expect(call.init.credentials).toBe("same-origin")
    expect(call.init.redirect).toBe("error")
    expect(call.init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(call.init.headers).get("authorization")).toBeNull()
    reply(f, 0)
    await pending
    expect(f.controller.state().verified).toEqual({ origin, principal: ready.principal, sessionScope: scope, surfaces: ready.surfaces })
    expect(f.calls.map((item) => new URL(item.url).pathname)).toEqual(["/api/sucafina/status"])
  } finally { f.controller.dispose(); f.dispose() }
})

test("ready state is reactive and contains only verified native access", async () => {
  const f = fixture()
  try {
    const phases: string[] = []
    const disposeObserver = createRoot((dispose) => {
      createComputed(() => phases.push(f.controller.state().phase))
      return dispose
    })
    const pending = f.controller.refresh()
    reply(f, 0)
    await pending
    expect(phases).toContain("ready")
    disposeObserver()
    expect(f.controller.state().verified).toEqual({ origin, principal: ready.principal, sessionScope: scope, surfaces: ready.surfaces })
    expect(f.controller.state().checking).toBe(false)
    expect(f.controller.state().error).toBeUndefined()
  } finally { f.controller.dispose(); f.dispose() }
})

test("unconfigured and signed-out status matrix never grants from principal alone", async () => {
  const f = fixture()
  try {
    const cases = [
      { body: { ...ready, configured: false }, phase: "unconfigured" },
      { body: { ...ready, authenticated: false }, phase: "signed-out" },
      { body: { ...ready, hostAuthenticated: false }, phase: "signed-out" },
      { body: { ...ready, hostAuthenticated: undefined }, phase: "signed-out" },
      { body: { ...ready, authentication: "microsoft" }, phase: "signed-out" },
      { body: { ...ready, authentication: "unconfigured" }, phase: "signed-out" },
    ]
    for (const [index, item] of cases.entries()) {
      const pending = f.controller.refresh()
      reply(f, index, item.body)
      await pending
      expect(f.controller.state().phase).toBe(item.phase)
      expect(f.controller.state().verified).toBeUndefined()
      expect(f.controller.state().checking).toBe(false)
    }
  } finally { f.controller.dispose(); f.dispose() }
})

test("missing or invalid admission fields fail closed as malformed status", async () => {
  const f = fixture()
  try {
    const cases = [
      { ...ready, principal: undefined },
      { ...ready, principal: { id: " ", name: "Operator One" } },
      { ...ready, principal: { id: "operator-1", name: " " } },
      { ...ready, sessionScope: undefined },
      { ...ready, sessionScope: "x".repeat(64) },
      { ...ready, sessionScope: `${scope}\n` },
      { ...ready, surfaces: [] },
      { ...ready, surfaces: ["foreign"] },
      { ...ready, authenticated: "true" },
      { ...ready, hostAuthenticated: "true" },
    ]
    for (const [index, body] of cases.entries()) {
      const pending = f.controller.refresh()
      reply(f, index, body)
      await pending
      expect(f.controller.state().phase).toBe("error")
      expect(f.controller.state().error).toBe(502)
      expect(f.controller.state().verified).toBeUndefined()
      expect(f.controller.state().checking).toBe(false)
    }
  } finally { f.controller.dispose(); f.dispose() }
})

test("malformed or non-JSON 200 and redirects produce bounded numeric errors", async () => {
  const f = fixture()
  try {
    const responses = [
      () => new Response("{ PRIVATE", { status: 200, headers: { "content-type": "application/json" } }),
      () => new Response("PRIVATE plain", { status: 200, headers: { "content-type": "text/plain" } }),
      () => new Response(null, { status: 302, headers: { location: "https://foreign.example" } }),
    ]
    for (const [index, response] of responses.entries()) {
      const pending = f.controller.refresh()
      f.calls[index]!.response.resolve(response())
      await pending
      expect(f.controller.state().phase).toBe("error")
      expect(f.controller.state().error).toBe(502)
      expect(f.controller.state().verified).toBeUndefined()
      expect(JSON.stringify(f.controller.state())).not.toContain("PRIVATE")
    }
    expect(f.calls).toHaveLength(3)
  } finally { f.controller.dispose(); f.dispose() }
})

test("HTTP and network failures discard prior access and report numeric status only", async () => {
  const f = fixture()
  try {
    await grant(f)
    for (const [index, status] of [401, 403, 404, 500, 503].entries()) {
      const pending = f.controller.refresh()
      f.calls[index + 1]!.response.resolve(new Response("PRIVATE-BODY", { status }))
      await pending
      expect(f.controller.state().phase).toBe("error")
      expect(f.controller.state().error).toBe(status)
      expect(f.controller.state().verified).toBeUndefined()
      expect(JSON.stringify(f.controller.state())).not.toContain("PRIVATE")
    }
    const pending = f.controller.refresh()
    f.calls[6]!.response.reject(new Error("PRIVATE-NETWORK"))
    await pending
    expect(f.controller.state().phase).toBe("error")
    expect(f.controller.state().error).toBe(503)
    expect(f.controller.state().verified).toBeUndefined()
    expect(JSON.stringify(f.controller.state())).not.toContain("PRIVATE")
    expect(f.calls).toHaveLength(7)
  } finally { f.controller.dispose(); f.dispose() }
})

test("same-session refresh retains the exact verified reference while checking", async () => {
  const f = fixture()
  try {
    const verified = await grant(f)
    const pending = f.controller.refresh()
    expect(f.controller.state().checking).toBe(true)
    expect(f.controller.state().verified).toBe(verified)
    reply(f, 1, structuredClone(ready))
    await pending
    expect(f.controller.state().phase).toBe("ready")
    expect(f.controller.state().checking).toBe(false)
    expect(f.controller.state().verified).toBe(verified)
    expect(f.controller.state().verified?.surfaces).toEqual(["dashboard", "planner"])
  } finally { f.controller.dispose(); f.dispose() }
})

test("principal, session scope and allowed surface changes replace the verified reference", async () => {
  const f = fixture()
  try {
    const first = await grant(f)
    const cases = [
      { ...ready, principal: { id: "operator-2", name: "Operator Two" } },
      { ...ready, principal: { id: "operator-2", name: "Operator Two" }, sessionScope: "b".repeat(64) },
      { ...ready, principal: { id: "operator-2", name: "Operator Two" }, sessionScope: "b".repeat(64), surfaces: ["dashboard"] },
    ]
    let previous = first
    for (const [index, body] of cases.entries()) {
      const pending = f.controller.refresh()
      reply(f, index + 1, body)
      await pending
      const current = f.controller.state().verified!
      expect(current).not.toBe(previous)
      expect(current.principal).toEqual(body.principal)
      expect(current.sessionScope).toBe(body.sessionScope)
      expect(current.surfaces).toEqual(body.surfaces)
      previous = current
    }
  } finally { f.controller.dispose(); f.dispose() }
})

test("caller mutation cannot change the stored verified grant", async () => {
  const f = fixture()
  try {
    const verified = await grant(f)
    // A frozen object may throw, while a defensive runtime copy may accept the attempted write.
    for (const mutate of [
      () => Reflect.set(verified, "origin", "https://foreign.example"),
      () => Reflect.set(verified.principal, "id", "attacker"),
      () => Reflect.set(verified.surfaces, "0", "procurement"),
    ]) {
      try { mutate() } catch {
        // Frozen grants may reject writes; the assertion below checks the grant remains intact.
      }
    }
    expect(f.controller.state().verified).toEqual({ origin, principal: ready.principal, sessionScope: scope, surfaces: ready.surfaces })
  } finally { f.controller.dispose(); f.dispose() }
})

test("latest refresh wins even when an aborted fetch resolves last", async () => {
  const f = fixture()
  try {
    const first = f.controller.refresh()
    const firstSignal = f.calls[0]!.init.signal!
    const second = f.controller.refresh()
    expect(firstSignal.aborted).toBe(true)
    reply(f, 1, { ...ready, principal: { id: "operator-2", name: "Operator Two" } })
    await second
    const current = f.controller.state().verified
    reply(f, 0)
    await first
    expect(f.controller.state().phase).toBe("ready")
    expect(f.controller.state().verified).toBe(current)
    expect(current?.principal.id).toBe("operator-2")
    expect(f.controller.state().checking).toBe(false)
    const staleFailure = f.controller.refresh()
    const latest = f.controller.refresh()
    expect(f.calls[2]!.init.signal?.aborted).toBe(true)
    reply(f, 3, { ...ready, principal: { id: "operator-2", name: "Operator Two" } })
    await latest
    f.calls[2]!.response.reject(new Error("stale network failure"))
    await staleFailure
    expect(f.controller.state().phase).toBe("ready")
    expect(f.controller.state().verified).toBe(current)
    expect(f.controller.state().error).toBeUndefined()
  } finally { f.controller.dispose(); f.dispose() }
})

test("invalidate synchronously clears and aborts access without fetching or accepting late status", async () => {
  const f = fixture()
  try {
    await grant(f)
    const pending = f.controller.refresh()
    f.controller.invalidate()
    expect(f.calls[1]!.init.signal?.aborted).toBe(true)
    expectSignedOut(f.controller)
    expect(f.calls).toHaveLength(2)
    reply(f, 1)
    await pending
    expectSignedOut(f.controller)
    expect(f.calls).toHaveLength(2)
  } finally { f.controller.dispose(); f.dispose() }
})

test("sign-out clears immediately, sends the exact logout request and ignores old status", async () => {
  const f = fixture()
  try {
    await grant(f)
    const old = f.controller.refresh()
    const logout = f.controller.signOut()
    expectSignedOut(f.controller)
    expect(f.calls[1]!.init.signal?.aborted).toBe(true)
    expect(f.calls).toHaveLength(3)
    const request = f.calls[2]!
    expect(request.url).toBe(`${origin}/api/sucafina/auth/logout`)
    expect(request.init.method).toBe("POST")
    expect(request.init.credentials).toBe("same-origin")
    expect(request.init.redirect).toBe("error")
    expect(request.init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(request.init.headers).get("origin")).toBe(origin)
    expect(new Headers(request.init.headers).get("authorization")).toBeNull()
    reply(f, 1)
    await old
    expectSignedOut(f.controller)
    request.response.resolve(new Response(null, { status: 204 }))
    await logout
    expectSignedOut(f.controller)
    expect(f.controller.state().error).toBeUndefined()
  } finally { f.controller.dispose(); f.dispose() }
})

test("failed logout stays unverified and exposes only numeric errors", async () => {
  const f = fixture()
  try {
    await grant(f)
    const logout = f.controller.signOut()
    expectSignedOut(f.controller)
    f.calls[1]!.response.resolve(new Response("PRIVATE-LOGOUT", { status: 500 }))
    await logout
    expect(f.controller.state().verified).toBeUndefined()
    expect(f.controller.state().error).toBe(500)
    expect(f.controller.state().checking).toBe(false)
    expect(JSON.stringify(f.controller.state())).not.toContain("PRIVATE")
    const again = f.controller.signOut()
    f.calls[2]!.response.reject(new Error("PRIVATE-NETWORK"))
    await again
    expect(f.controller.state().verified).toBeUndefined()
    expect(f.controller.state().error).toBe(503)
    expect(JSON.stringify(f.controller.state())).not.toContain("PRIVATE")
    expect(f.calls).toHaveLength(3)
  } finally { f.controller.dispose(); f.dispose() }
})

test("dispose aborts and clears synchronously, ignores late responses and prevents future requests", async () => {
  const f = fixture()
  try {
    await grant(f)
    const pending = f.controller.refresh()
    f.controller.dispose()
    expect(f.calls[1]!.init.signal?.aborted).toBe(true)
    expect(f.controller.state().verified).toBeUndefined()
    expect(f.controller.state().checking).toBe(false)
    reply(f, 1)
    await pending
    expect(f.controller.state().verified).toBeUndefined()
    await f.controller.refresh()
    await f.controller.signOut()
    f.controller.invalidate()
    f.controller.dispose()
    expect(f.calls).toHaveLength(2)
    expect(f.controller.state().verified).toBeUndefined()
  } finally { f.controller.dispose(); f.dispose() }
})
