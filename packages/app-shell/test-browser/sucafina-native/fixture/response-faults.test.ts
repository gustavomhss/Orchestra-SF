/** Helper controls only: no browser, Microsoft session, installed producer or LIVE proof.
 * Page/Route adapters hold the asynchronous transport edges; the helpers under test are original.
 */
import { expect, test } from "bun:test"
import type { APIResponse, Page, Request, Route } from "@playwright/test"
import { armHeldResponse, armLostResponse, requireNativeRevocationRefusal } from "../../../e2e/sucafina/native/fixture/response-faults.ts"
import type { NativeFaultTarget } from "../../../e2e/sucafina/native/fixture/response-faults.ts"

const origin = "https://native.example.test"
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
function refusal(status: number, body: string, headers: Record<string, string> = jsonHeaders) {
  const original = new globalThis.Response(body, { status, headers })
  let reads = 0
  return {
    original, reads: () => reads,
    response: { status: () => original.status, headers: () => Object.fromEntries(original.headers),
      text: () => { reads++; return original.text() } },
  }
}

for (const [status, state] of [[401, "unauthenticated"], [403, "denied"]] as const) {
  test("native revocation consumes the original closed " + status + "/" + state + " refusal once", async () => {
    const f = refusal(status, JSON.stringify({ status: state }))
    await requireNativeRevocationRefusal(f.response, origin)
    expect(f.reads()).toBe(1)
    expect(f.original.bodyUsed).toBe(true)
  })
}
const invalid: { name: string; status: number; body: string; headers?: Record<string, string> }[] = [
  { name: "gateway HTML", status: 401, body: "<html>Gateway denied</html>", headers: { ...jsonHeaders, "content-type": "text/html" } },
  { name: "empty JSON", status: 401, body: "" },
  { name: "malformed JSON", status: 401, body: "{" },
  { name: "duplicate status", status: 401, body: '{"status":"ok","status":"unauthenticated"}' },
  { name: "escaped duplicate status", status: 401, body: '{"status":"ok","sta\\u0074us":"unauthenticated"}' },
  { name: "401 with denied body", status: 401, body: '{"status":"denied"}' },
  { name: "403 with unauthenticated body", status: 403, body: '{"status":"unauthenticated"}' },
  { name: "unavailable body", status: 401, body: '{"status":"unavailable","reason":"identity-unavailable"}' },
  { name: "extra private body member", status: 401, body: '{"status":"unauthenticated","value":"private-control-sentinel"}' },
  { name: "valid body with wrong media", status: 401, body: '{"status":"unauthenticated"}', headers: { ...jsonHeaders, "content-type": "text/plain" } },
  { name: "cacheable refusal", status: 401, body: '{"status":"unauthenticated"}', headers: { ...jsonHeaders, "cache-control": "public, max-age=60" } },
  { name: "missing no-store", status: 401, body: '{"status":"unauthenticated"}', headers: { "content-type": "application/json" } },
  { name: "redirect metadata", status: 401, body: '{"status":"unauthenticated"}', headers: { ...jsonHeaders, location: origin + "/auth/login" } },
  { name: "foreign CORS origin", status: 403, body: '{"status":"denied"}', headers: { ...jsonHeaders, "access-control-allow-origin": "https://foreign.example.test" } },
  { name: "successful HTTP status", status: 200, body: '{"status":"unauthenticated"}' },
]
for (const input of invalid) test("native revocation refuses " + input.name + " as authentication proof", async () => {
  const f = refusal(input.status, input.body, input.headers)
  await expect(requireNativeRevocationRefusal(f.response, origin))
    .rejects.toThrow("F04_ORIGINAL_REVOCATION_REFUSAL_NOT_PROVEN")
  expect(f.reads()).toBeLessThanOrEqual(1)
})

const target: NativeFaultTarget = {
  origin, pathname: "/sucafina/teams/team-a/dashboard", method: "POST",
  headers: { "x-sf-team-profile": "original-team-selector" },
}
function routing() {
  const registrations: { pattern: RegExp; handler: Parameters<Page["route"]>[1] }[] = []
  let unrouted = 0
  const page = {
    route: async (pattern: Parameters<Page["route"]>[0], handler: Parameters<Page["route"]>[1]) => {
      if (!(pattern instanceof RegExp)) throw new Error("CONTROL_EXPECTS_EXACT_PATH_REGEXP")
      registrations.push({ pattern, handler })
    },
    unroute: async () => { unrouted++; registrations.length = 0 },
  } as unknown as Page
  return {
    page, registrations, unrouted: () => unrouted,
    dispatch: async (route: Route) => {
      const registration = registrations[0]
      if (!registration || !registration.pattern.test(route.request().url()))
        throw new Error("CONTROL_ROUTE_NOT_REGISTERED")
      await registration.handler(route, route.request())
    },
  }
}
function transport(selected: NativeFaultTarget = target, extra: {
  method?: string; query?: string; headers?: Record<string, string>
} = {}) {
  const fetchStarted = Promise.withResolvers<void>()
  const fetched = Promise.withResolvers<APIResponse>()
  const statusRead = Promise.withResolvers<void>()
  const terminalStarted = Promise.withResolvers<void>()
  const terminal = Promise.withResolvers<void>()
  const calls: { kind: string; value?: unknown }[] = []
  const request = {
    method: () => extra.method ?? selected.method,
    url: () => selected.origin + selected.pathname + (extra.query ?? ""),
    headers: () => ({ cookie: "controlled-not-a-real-session", ...selected.headers, ...extra.headers }),
  } as unknown as Request
  const response = Object.freeze({ status: () => { statusRead.resolve(); return 200 } }) as APIResponse
  const route = {
    request: () => request,
    fetch: (options: unknown) => { calls.push({ kind: "fetch", value: options }); fetchStarted.resolve(); return fetched.promise },
    fulfill: async (options: unknown) => { calls.push({ kind: "fulfill", value: options }); terminalStarted.resolve(); await terminal.promise },
    abort: async (code: string) => { calls.push({ kind: "abort", value: code }); terminalStarted.resolve(); await terminal.promise },
    continue: async () => { calls.push({ kind: "continue" }) },
    fallback: async () => { calls.push({ kind: "fallback" }) },
  } as unknown as Route
  return { route, request, response, calls, fetchStarted, fetched, statusRead, terminalStarted, terminal }
}
const modes = [
  { name: "held", arm: armHeldResponse },
  { name: "lost", arm: armLostResponse },
] as const

for (const mode of modes) {
  test(mode.name + " dispose before capture is idempotent and leaves the Page route passive", async () => {
    const page = routing(), f = transport()
    const fault = await mode.arm(page.page, target)
    await fault.dispose()
    await fault.dispose()
    await page.dispatch(f.route)
    expect(f.calls).toEqual([{ kind: "fallback" }])
    expect(page.unrouted()).toBe(0)
    expect(page.registrations).toHaveLength(1)
    expect(() => fault.observations()).toThrow()
  })

  test(mode.name + " dispose settles its one original operation before later cleanup traffic", async () => {
    const page = routing(), f = transport()
    const fault = await mode.arm(page.page, target)
    const delivered = page.dispatch(f.route)
    await f.fetchStarted.promise
    let disposed = 0
    const first = fault.dispose().then(() => { disposed++ })
    const second = fault.dispose().then(() => { disposed++ })
    f.fetched.resolve(f.response)
    await f.terminalStarted.promise
    expect(disposed).toBe(0)
    expect(f.calls[0]).toEqual({ kind: "fetch", value: { maxRedirects: 0, maxRetries: 0 } })
    expect(f.calls[1]).toEqual(mode.name === "held"
      ? { kind: "fulfill", value: { response: f.response } } : { kind: "abort", value: "failed" })
    if (mode.name === "held") expect((f.calls[1]!.value as { response: APIResponse }).response).toBe(f.response)
    expect(f.route.request()).toBe(f.request)
    f.terminal.resolve()
    await Promise.all([delivered, first, second])
    expect(disposed).toBe(2)
    expect(fault.observations()).toMatchObject({ attempts: 1, producerStatus: 200 })
    const cleanup = transport()
    await page.dispatch(cleanup.route)
    expect(cleanup.calls).toEqual([{ kind: "fallback" }])
    expect(fault.observations().attempts).toBe(1)
    expect(page.unrouted()).toBe(0)
    expect(page.registrations).toHaveLength(1)
  })

  for (const edge of ["fetch", "delivery"] as const) {
    test(mode.name + " " + edge + " failure remains visible to both dispose calls without replay", async () => {
      const page = routing(), f = transport(), problem = new Error("CONTROLLED_ORIGINAL_" + edge.toUpperCase() + "_FAILURE")
      const fault = await mode.arm(page.page, target)
      const observed = page.dispatch(f.route).then(() => undefined, (error: unknown) => error)
      await f.fetchStarted.promise
      if (edge === "fetch") f.fetched.reject(problem)
      if (edge === "delivery") {
        f.fetched.resolve(f.response)
        if ("release" in fault) fault.release()
        await f.terminalStarted.promise
        f.terminal.reject(problem)
      }
      expect(await observed).toBe(problem)
      await expect(fault.dispose()).rejects.toBe(problem)
      await expect(fault.dispose()).rejects.toBe(problem)
      expect(f.calls.filter((entry) => entry.kind === "fetch")).toHaveLength(1)
      const cleanup = transport()
      await page.dispatch(cleanup.route)
      expect(cleanup.calls).toEqual([{ kind: "fallback" }])
      expect(page.unrouted()).toBe(0)
    })
  }

  test(mode.name + " detects a second original attempt without repeating the producer fetch", async () => {
    const page = routing(), f = transport(), duplicate = transport()
    const fault = await mode.arm(page.page, target)
    const delivered = page.dispatch(f.route)
    await f.fetchStarted.promise
    await page.dispatch(duplicate.route)
    expect(duplicate.calls).toEqual([{ kind: "continue" }])
    f.fetched.resolve(f.response)
    const disposed = fault.dispose()
    await f.terminalStarted.promise
    f.terminal.resolve()
    await Promise.all([delivered, disposed])
    expect(() => fault.observations()).toThrow()
    expect(f.calls.filter((entry) => entry.kind === "fetch")).toHaveLength(1)
    expect(page.unrouted()).toBe(0)
  })
}

test("held response keeps the original response gated until explicit release", async () => {
  const page = routing(), f = transport()
  const held = await armHeldResponse(page.page, target)
  const delivered = page.dispatch(f.route)
  await f.fetchStarted.promise
  f.fetched.resolve(f.response)
  await f.statusRead.promise
  expect(held.observations()).toMatchObject({ phase: "REAL_PRODUCER_RESPONSE_HELD", attempts: 1, producerStatus: 200 })
  expect(f.calls).toHaveLength(1)
  held.release()
  held.release()
  await f.terminalStarted.promise
  expect(f.calls[1]).toEqual({ kind: "fulfill", value: { response: f.response } })
  f.terminal.resolve()
  await delivered
  await held.dispose()
  expect(page.unrouted()).toBe(0)
})

test("held GET excludes a different method, Team, duplicate selector and observer Request", async () => {
  const selected: NativeFaultTarget = { origin, pathname: "/sucafina/api/ui/pages/CAP04",
    method: "GET", query: { year: "2026" }, headers: target.headers }
  const page = routing()
  const held = await armHeldResponse(page.page, selected)
  const unrelated: NonNullable<Parameters<typeof transport>[1]>[] = [
    { method: "POST", query: "?year=2026" },
    { query: "?year=2026", headers: { "x-sf-team-profile": "other-team" } },
    { query: "?year=2026&year=2026" },
    { query: "?year=2026", headers: { "x-sf-native-observation": "observer" } },
  ]
  for (const extra of unrelated) {
    const f = transport(selected, extra)
    await page.dispatch(f.route)
    expect(f.calls).toEqual([{ kind: "continue" }])
  }
  expect(() => held.observations()).toThrow()
  const f = transport(selected, { query: "?year=2026" })
  const delivered = page.dispatch(f.route)
  await f.fetchStarted.promise
  f.fetched.resolve(f.response)
  const disposed = held.dispose()
  await f.terminalStarted.promise
  f.terminal.resolve()
  await Promise.all([delivered, disposed])
  expect(held.observations().attempts).toBe(1)
  expect(page.unrouted()).toBe(0)
})
