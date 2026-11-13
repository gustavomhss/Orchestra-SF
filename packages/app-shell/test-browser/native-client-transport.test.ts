import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { createNativeGateway } from "../../../modules/sucafina/src/native.ts"
import { createLocalIdentity } from "../../../modules/sucafina/Sucafinav1/runtime/local-identity.ts"
import type { EntraClient, LocalSecrets } from "../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import { empty, testPersistence } from "../../../modules/sucafina/Sucafinav1/test/fixture/persistence.ts"
import { emptyMap, plugGroup } from "../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { createNativeTransport } from "../src/orchestra/chapters/sucafina/transport"
import { SucafinaRequestError } from "../src/orchestra/chapters/sucafina/contract"
import type { Selection } from "../src/orchestra/chapters/sucafina/contract"

const origin = "http://localhost:4110"
const mount = "/api/sucafina"
const principal = "0fe3ac10-c944-4eb6-8812-c67f5202a32f"
const person = { id: principal, name: "Directory Person" }
const selection = { surface: "dashboard", query: { page: "Hot Topics & Actions" } } as const
const save = { page: "Hot Topics & Actions", action: "save", id: "topic-1", version: 4, values: { action: "Updated", status: "progress", priority: "high" } }

async function fixture(role: "admin" | "domain leader" | "viewer" = "admin") {
  const records = new Map<string, { value: Uint8Array; expires: number }>()
  const secrets: LocalSecrets = {
    async put(key, value, expires) { records.set(key, { value: new Uint8Array(value), expires }) },
    async get(key, at) { const row = records.get(key); return row && row.expires > at ? new Uint8Array(row.value) : undefined },
    async take(key, at) { const value = await secrets.get(key, at); records.delete(key); return value },
    async remove(key) { records.delete(key) },
  }
  const clock = 1800000000000
  const tokens = { accessToken: "fixture-token", expiresAt: clock + 120000 }
  const login = { state: "" }
  const client: EntraClient = {
    async authorization(input) { login.state = input.state; return `https://login.example/?state=${input.state}` },
    async exchange() { return { person, tokens } },
    async refresh() { return tokens },
    async person() { return person },
    async directory() { return [person] },
    async resolve(_token, map) { return { id: principal, canWrite: true, roles: map.filter((row) => row.entra === "fixture-group").map((row) => ({ surface: row.surface, role: row.role })) } },
  }
  const identity = createLocalIdentity({ origin, mount, client, secrets, key: randomBytes(32), now: () => new Date(clock) })
  const begin = await identity.handle(new Request(`${origin}${mount}/auth/login`))
  expect(begin?.status).toBe(303)
  const loginCookie = begin!.headers.getSetCookie()[0]!.split(";")[0]!
  const callback = await identity.handle(new Request(`${origin}${mount}/auth/callback?code=fixture&state=${login.state}`, { headers: { cookie: loginCookie } }))
  expect(callback?.status).toBe(303)
  const cookie = callback!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]!
  const snapshot = empty()
  snapshot.data.roleMap = plugGroup(emptyMap(), "dashboard", role, "fixture-group")
  snapshot.data.hotTopics = [{ id: "topic-1", action: "Original", owner: "Ada", status: "open", priority: "high" }]
  snapshot.data.members = [{ id: "member-1", name: "Visible", type: "Employee", status: "Active", cls: "Talent", outlook: "Promote", notes: "PRIVATE-NOTE" }]
  snapshot.versions["hotTopics:topic-1"] = { version: 4, by: "earlier-editor" }
  snapshot.versions["members:member-1"] = { version: 2, by: "earlier-editor" }
  const storage = testPersistence({ dashboard: snapshot })
  const gateway = createNativeGateway(mount, {
    authenticate: identity.authenticate,
    persistence: storage.persistence,
    environment: async () => ({ at: "2026-11-11T12:00:00Z", id: () => "generated-id", directory: [person] }),
    maxJsonBytes: 100000,
  })
  const calls: { url: string; init: RequestInit; request: Request; status: number }[] = []
  const controls: { cookie: boolean; origin: string; transform?: (response: Response) => Promise<Response> } = { cookie: true, origin }
  const browserFetch = Object.assign(async (input: string | URL | Request, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (controls.cookie) headers.set("cookie", cookie)
    headers.set("origin", controls.origin)
    const request = new Request(input, { ...init, headers })
    const response = await gateway(request)
    if (!response) throw new Error("Gateway did not handle request")
    calls.push({ url: request.url, init, request, status: response.status })
    return controls.transform ? controls.transform(response) : response
  }, { preconnect: fetch.preconnect })
  return { storage, calls, controls, browserFetch }
}

function transport(f: Awaited<ReturnType<typeof fixture>>) {
  return createNativeTransport({ server: { url: origin }, principal, fetch: f.browserFetch })
}

async function errorOf(promise: Promise<unknown>, status: number) {
  const error = await promise.then(() => undefined, (cause: unknown) => cause)
  expect(error).toBeInstanceOf(SucafinaRequestError)
  expect((error as SucafinaRequestError).status).toBe(status)
  return error as SucafinaRequestError
}

const signal = () => new AbortController().signal

test("constructor rejects invalid origin and principal without network or host probes", async () => {
  const f = await fixture()
  for (const url of ["ftp://installation.example", "https://user:password@installation.example", `${origin}/path`, `${origin}?x=1`, `${origin}#x`])
    expect(() => createNativeTransport({ server: { url }, principal, fetch: f.browserFetch })).toThrow()
  expect(() => createNativeTransport({ server: { url: origin }, principal: "  ", fetch: f.browserFetch })).toThrow()
  transport(f)
  expect(f.calls).toEqual([])
})

test("real cookie gateway returns the raw page envelope and forwards every query with pinned surface", async () => {
  const f = await fixture()
  const query = { page: "Hot Topics & Actions", year: "2025", own: "2025", month: "3", version: "v", owner: "Ada", class: "A", q: "text", filter: "x", status: "open", priority: "high", request: "r", supplier: "s", mode: "m", risk: "low", topicStatus: "open", memberStatus: "Active", projectStatus: "Planning", projectRisk: "Low", stakeholderPriority: "action", opsMonth: "3", tab: "one", execYear: "2025", opsYear: "2025", secYear: "2025", executiveMonth: "3", operationsMonth: "3", securityMonth: "3", surface: "planner" }
  const page = await transport(f).read({ surface: "dashboard", query }, signal())
  expect(page.surface).toBe("dashboard")
  expect(page.page).toBe("Hot Topics & Actions")
  expect(page.actor).toMatchObject(person)
  expect(page.data.hotTopics).toBeDefined()
  expect(f.calls).toHaveLength(1)
  const url = new URL(f.calls[0]!.url)
  expect(url.pathname).toBe(`${mount}/dashboard/state`)
  expect(Object.fromEntries(url.searchParams)).toEqual(Object.fromEntries(Object.entries(query).filter(([key]) => key !== "surface")))
  expect(f.calls[0]!.request.headers.get("cookie")).toBeTruthy()
  expect(f.calls[0]!.request.headers.get("authorization")).toBeNull()
  expect(f.calls[0]!.init.credentials).toBe("same-origin")
  expect(f.calls[0]!.init.redirect).toBe("error")
})

test("server password fields never become host Basic credentials and mutation cannot retarget", async () => {
  const f = await fixture()
  const server = { url: origin, username: "host-user", password: "host-secret" }
  const options = { server, principal, fetch: f.browserFetch }
  const api = createNativeTransport(options)
  server.url = "https://foreign.example"
  server.password = "new-secret"
  options.principal = "different-principal"
  const page = await api.read(selection, signal())
  expect(page.actor.id).toBe(principal)
  expect(new URL(f.calls[0]!.url).origin).toBe(origin)
  expect(f.calls[0]!.request.headers.get("authorization")).toBeNull()
})

test("real command saves with warning and fixes the surface after the draft", async () => {
  const f = await fixture()
  const command = { page: "Stakeholder Management", action: "save", version: 0, values: { name: "Partner", priority: "action", owner: "" }, surface: "planner" }
  const before = structuredClone(command)
  const result = await transport(f).command("dashboard", command, signal())
  expect(result).toEqual({ ok: true, warnings: ["Action plan requires an owner."] })
  expect(command).toEqual(before)
  expect(f.calls[0]!.status).toBe(200)
  expect(new URL(f.calls[0]!.url).pathname).toBe(`${mount}/dashboard/commands`)
  expect(f.storage.state.dashboard.data.stakeholders).toEqual([expect.objectContaining({ name: "Partner" })])
})

test("401 and 403 actual HTTP errors retain status without disclosing body or mutating storage", async () => {
  const f = await fixture()
  const api = transport(f)
  const before = structuredClone(f.storage.state)
  f.controls.cookie = false
  const unauthorized = await errorOf(api.command("dashboard", save, signal()), 401)
  f.controls.cookie = true
  f.controls.origin = "https://foreign.example"
  const forbidden = await errorOf(api.command("dashboard", save, signal()), 403)
  expect(f.calls.map((call) => call.status)).toEqual([401, 403])
  expect(unauthorized.detail).toBeUndefined()
  expect(forbidden.detail).toBeUndefined()
  expect(JSON.stringify([unauthorized, forbidden])).not.toContain("PRIVATE-NOTE")
  expect(f.storage.state).toEqual(before)
  for (const status of [401, 403]) {
    f.controls.cookie = status !== 401
    f.controls.origin = status === 403 ? "https://foreign.example" : origin
    f.controls.transform = async (response) => {
      expect(response.status).toBe(status)
      return Response.json({ message: "PRIVATE-MESSAGE", stored: "PRIVATE-STORED", by: "PRIVATE-BY", errors: ["PRIVATE-ERROR"] }, { status })
    }
    const error = await errorOf(api.command("dashboard", save, signal()), status)
    expect(error.message).not.toContain("PRIVATE-")
    expect(error.detail).toBeUndefined()
    expect(JSON.stringify(Object.getOwnPropertyNames(error).map((key) => Reflect.get(error, key)))).not.toContain("PRIVATE-")
  }
  expect(f.storage.state).toEqual(before)
})

test("stale real 409 preserves the gateway's masked stored record and editor", async () => {
  const f = await fixture("domain leader")
  const before = structuredClone(f.storage.state)
  const error = await errorOf(transport(f).command("dashboard", { page: "Team Structure", action: "saveMember", id: "member-1", version: 1, values: { name: "Changed" } }, signal()), 409)
  expect(f.calls[0]!.status).toBe(409)
  expect(error.detail?.by).toBe("earlier-editor")
  expect(error.detail?.stored).toMatchObject({ id: "member-1", name: "Visible" })
  expect(JSON.stringify(error.detail)).not.toContain("PRIVATE-NOTE")
  expect(JSON.stringify(error.detail)).not.toContain("Promote")
  expect(f.storage.state).toEqual(before)
})

test("malformed 409 bodies cannot expose conflict details or trigger retry", async () => {
  const f = await fixture("domain leader")
  const api = transport(f)
  const before = structuredClone(f.storage.state)
  const stale = { page: "Team Structure", action: "saveMember", id: "member-1", version: 1, values: { name: "Changed" } }
  for (const body of ["json", "plain"] as const) {
    f.controls.transform = async (response) => {
      expect(response.status).toBe(409)
      if (body === "json") return Response.json({ ok: true, stored: "PRIVATE", by: "PRIVATE" }, { status: 409 })
      return new Response("PRIVATE unrelated conflict body", { status: 409, headers: { "content-type": "text/plain" } })
    }
    const count = f.calls.length
    const error = await errorOf(api.command("dashboard", stale, signal()), 409)
    expect(error.detail).toBeUndefined()
    expect(error.message.length).toBeGreaterThan(0)
    expect(error.message.length).toBeLessThanOrEqual(1024)
    expect(error.message).not.toContain("PRIVATE")
    expect(f.calls).toHaveLength(count + 1)
    expect(f.calls[count]!.status).toBe(409)
    expect(f.storage.state).toEqual(before)
  }
})

test("invalid real command returns 422 string errors without writing", async () => {
  const f = await fixture()
  const before = structuredClone(f.storage.state)
  const error = await errorOf(transport(f).command("dashboard", { ...save, values: { action: "", status: "open", priority: "high" } }, signal()), 422)
  expect(f.calls[0]!.status).toBe(422)
  expect(error.detail?.errors).toEqual(["Action, valid status and priority required."])
  expect(f.storage.state).toEqual(before)
})

test("non-JSON HTTP statuses survive and stored details stay exclusive to 409", async () => {
  const f = await fixture()
  const api = transport(f)
  for (const status of [404, 500, 503]) {
    f.controls.transform = async (response) => {
      expect(response.status).toBe(200)
      return new Response("PRIVATE-PLAIN-BODY", { status, headers: { "content-type": "text/plain" } })
    }
    const error = await errorOf(api.read(selection, signal()), status)
    expect(error.message).not.toContain("PRIVATE-PLAIN-BODY")
    expect(error.detail?.stored).toBeUndefined()
    expect(error.detail?.by).toBeUndefined()
    expect(error.detail?.errors).toBeUndefined()
  }
  for (const status of [400, 404, 500, 503]) {
    f.controls.transform = async (response) => {
      expect(response.status).toBe(200)
      return Response.json({ message: "Failure", stored: "PRIVATE-STORED", by: "PRIVATE-BY", errors: ["PRIVATE-ERROR"] }, { status })
    }
    const error = await errorOf(api.read(selection, signal()), status)
    expect(error.detail?.stored).toBeUndefined()
    expect(error.detail?.by).toBeUndefined()
    expect(error.detail?.errors).toBeUndefined()
    expect(error.message).not.toContain("PRIVATE-")
    expect(JSON.stringify(error.detail ?? {})).not.toContain("PRIVATE-")
  }
  expect(f.calls).toHaveLength(7)
})

test("422 accepts only string errors and never exposes stored or by", async () => {
  const f = await fixture()
  f.controls.transform = async (response) => {
    expect(response.status).toBe(422)
    return Response.json({ ok: false, status: 422, stored: "PRIVATE-STORED", by: "PRIVATE-BY", errors: ["Valid error", 42, null, { secret: "PRIVATE-OBJECT" }] }, { status: 422 })
  }
  const error = await errorOf(transport(f).command("dashboard", { ...save, values: { action: "", status: "open", priority: "high" } }, signal()), 422)
  expect(error.detail?.stored).toBeUndefined()
  expect(error.detail?.by).toBeUndefined()
  expect(error.detail?.errors?.every((value) => typeof value === "string") ?? true).toBe(true)
  expect(JSON.stringify(error.detail ?? {})).not.toContain("PRIVATE-")
  expect(error.message).not.toContain("PRIVATE-")
})

test("implicit page must still belong to authorized pages", async () => {
  const f = await fixture()
  const api = transport(f)
  const implicit = { surface: "dashboard", query: {} } as const
  const page = await api.read(implicit, signal())
  expect(page.page).toBe("Executive Dashboard")
  expect(page.pages).toContain(page.page)
  expect(new URL(f.calls[0]!.url).searchParams.has("page")).toBe(false)
  f.controls.transform = async (response) => {
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    return Response.json({ ...body, pages: ["Hot Topics & Actions"] })
  }
  await errorOf(api.read(implicit, signal()), 502)
  expect(f.calls.map((call) => call.status)).toEqual([200, 200])
})

test("malformed and non-JSON 200 bodies fail read and command with bounded 502", async () => {
  for (const contentType of ["application/json", "text/plain"]) {
    const f = await fixture()
    const api = transport(f)
    f.controls.transform = async (response) => {
      expect(response.status).toBe(200)
      return new Response("{ PRIVATE-MALFORMED", { status: 200, headers: { "content-type": contentType } })
    }
    for (const result of [() => api.read(selection, signal()), () => api.command("dashboard", save, signal())]) {
      const error = await errorOf(result(), 502)
      expect(error.message).not.toContain("PRIVATE-MALFORMED")
      expect(error.message.length).toBeLessThanOrEqual(1024)
    }
    expect(f.calls.map((call) => call.status)).toEqual([200, 200])
  }
})

test("success identity, surface, page, membership, name and schema failures fail closed", async () => {
  const f = await fixture()
  const api = transport(f)
  for (const [change, status] of [
    [(body: Record<string, unknown>) => ({ ...body, actor: { ...(body.actor as object), id: "other" } }), 401],
    [(body: Record<string, unknown>) => ({ ...body, actor: { ...(body.actor as object), name: "  " } }), 502],
    [(body: Record<string, unknown>) => ({ ...body, surface: "planner" }), 502],
    [(body: Record<string, unknown>) => ({ ...body, page: "Team Structure" }), 502],
    [(body: Record<string, unknown>) => ({ ...body, pages: [] }), 502],
    [(body: Record<string, unknown>) => ({ ...body, year: "invalid" }), 502],
  ] as const) {
    f.controls.transform = async (response) => Response.json(change(await response.json() as Record<string, unknown>))
    await errorOf(api.read(selection, signal()), status)
  }
  expect(f.calls.map((call) => call.status)).toEqual([200, 200, 200, 200, 200, 200])
})

test("malformed 200 command fails 502 while approved extra JSON fields survive", async () => {
  const f = await fixture()
  const api = transport(f)
  f.controls.transform = async (response) => { expect(response.status).toBe(200); return Response.json({ ok: true, warnings: [17] }) }
  await errorOf(api.command("dashboard", save, signal()), 502)
  f.controls.transform = async (response) => { expect(response.status).toBe(200); return Response.json({ ok: true, warnings: ["review"], preview: { count: 3 }, value: "result" }) }
  const result = await api.command("dashboard", { ...save, version: 5 }, signal())
  expect(result).toEqual({ ok: true, warnings: ["review"], preview: { count: 3 }, value: "result" })
})

test("caller signal is passed exactly, pre-abort prevents fetch, and in-flight abort propagates", async () => {
  const f = await fixture()
  const caller = new AbortController()
  await transport(f).read(selection, caller.signal)
  expect(f.calls[0]!.init.signal).toBe(caller.signal)
  caller.abort()
  const before = f.calls.length
  await expect(transport(f).read(selection, caller.signal)).rejects.toMatchObject({ name: "AbortError" })
  expect(f.calls).toHaveLength(before)
  const started = Promise.withResolvers<void>()
  const held = Object.assign(async (_input: string | URL | Request, init?: RequestInit) => {
    expect(init?.signal).toBe(active.signal)
    started.resolve()
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true }))
  }, { preconnect: fetch.preconnect })
  const active = new AbortController()
  const pending = createNativeTransport({ server: { url: origin }, principal, fetch: held }).read(selection, active.signal)
  await started.promise
  active.abort()
  await expect(pending).rejects.toMatchObject({ name: "AbortError" })
})

test("foreign redirect fails closed without another fetch and without retry", async () => {
  const f = await fixture()
  f.controls.transform = async (response) => { expect(response.status).toBe(200); return new Response(null, { status: 302, headers: { location: "https://foreign.example/steal" } }) }
  await errorOf(transport(f).read(selection, signal()), 502)
  expect(f.calls).toHaveLength(1)
  expect(f.calls[0]!.init.redirect).toBe("error")
})

test("network errors unwrap SDK transport causes and never retry", async () => {
  const calls: string[] = []
  const failed = Object.assign(async (input: string | URL | Request) => { calls.push(String(input)); throw new Error("PRIVATE-NETWORK-DETAIL") }, { preconnect: fetch.preconnect })
  const api = createNativeTransport({ server: { url: origin }, principal, fetch: failed })
  const error = await errorOf(api.read(selection as Selection, signal()), 503)
  expect(error.message).not.toContain("PRIVATE-NETWORK-DETAIL")
  expect(calls).toHaveLength(1)
})
