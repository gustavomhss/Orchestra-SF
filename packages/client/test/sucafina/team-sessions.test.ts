import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamSessions } from "../../src/sucafina/sessions"
import type { SfTransportFetch } from "../../src/sucafina/transport"

// Wire/lifecycle tests only. These DTOs are deliberately not server admission.
// The installed OIDC/Core/SQLite/Chromium composition proves authority separately.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf.example.test",
  mount: "/sucafina/nested", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const owner = Schema.decodeUnknownSync(TeamProfile.Owner)({
  profile: { installationId: binding.installationId, tenantId: binding.tenantId,
    teamObjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  principal: { tenantId: binding.tenantId, principalObjectId: "11111111-1111-4111-8111-111111111111" },
})
const namespace = Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({ version: 1, owner, authorityGeneration: 3 })
const id = Session.ID.create(), messageID = SessionMessage.ID.create()
const info = {
  id, namespace, projectID: "global", cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 1 }, title: "Current Team session", location: { directory: "/private/technical" },
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
const list = (value: unknown = namespace) => json({ data: [], cursor: {}, namespace: value })
const connected = { id: "evt_connected", type: "server.connected", data: {} }
async function browser(run: () => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try { await run() }
  finally { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window") }
}
function fixture(fetch: SfTransportFetch) {
  const life = new AbortController(), failures: string[] = []
  let current = true
  const client = createSfTeamSessions({ binding, owner, current: () => current, signal: life.signal,
    fetch, invalidated: (reason) => failures.push(reason) })
  return { client, life, failures, retire: () => { current = false }, close: () => client.dispose() }
}

test("official Session SDK reaches the installed mount before its first request and learns an empty response namespace", async () => browser(async () => {
  const requests: Request[] = [], options: RequestInit[] = []
  const f = fixture(async (url, init) => { requests.push(new Request(url, init)); options.push(init!); return list() })
  try {
    expect(f.client.namespace()).toBeUndefined()
    expect(await f.client.list()).toEqual({ data: [], cursor: {}, namespace })
    expect(f.client.namespace()).toEqual(namespace)
    expect(requests[0]!.url).toBe(binding.publicOrigin + binding.mount + "/api/session")
    expect([...requests[0]!.headers.keys()]).toEqual(["x-sf-team-profile"])
    expect(JSON.parse(requests[0]!.headers.get("x-sf-team-profile")!)).toEqual({
      contractRevision: "sf-team-profile/1", kind: "team", profile: owner.profile,
    })
    expect(options[0]).toMatchObject({ credentials: "same-origin", cache: "no-store", redirect: "error", mode: "same-origin" })
    expect(requests[0]!.url).not.toMatch(/principal|project|directory|location|generation|auth_token/)
    expect(f.failures).toEqual([])
  } finally { f.close() }
}))

test("create and prompt use the generated endpoints, stable identifiers and actual encoded responses", async () => browser(async () => {
  const requests: Request[] = []
  const f = fixture(async (url, init) => {
    const request = new Request(url, init); requests.push(request.clone())
    if (request.method === "GET") return list()
    if (new URL(request.url).pathname.endsWith("/prompt")) return json({ data: {
      id: messageID, sessionID: id, admittedSeq: 1, timeCreated: 10,
      prompt: { text: "Private Team text" }, delivery: "queue",
    } })
    return json({ data: info })
  })
  try {
    await f.client.list()
    expect(await f.client.create({ id })).toEqual(info)
    expect(await f.client.prompt({ sessionID: id, id: messageID, text: "Private Team text" })).toMatchObject({
      id: messageID, sessionID: id, admittedSeq: 1,
    })
    expect(await requests[1]!.json()).toEqual({ id })
    expect(await requests[2]!.json()).toEqual({ id: messageID, prompt: { text: "Private Team text" } })
    expect(requests[2]!.url).toBe(binding.publicOrigin + binding.mount + "/api/session/" + id + "/prompt")
    expect(requests.every((request) => !request.headers.has("authorization"))).toBe(true)
  } finally { f.close() }
}))

test("uninitialized mutation and foreign cursor fail before IO", async () => browser(async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return list() })
  try {
    await expect(f.client.create({ id })).rejects.toThrow("NAMESPACE")
    await expect(f.client.list({ cursor: "other-window-cursor" })).rejects.toThrow("PROTOCOL")
    expect(calls).toBe(0)
    await f.client.list()
    await expect(f.client.messages({ sessionID: id, cursor: "other-owner-cursor" })).rejects.toThrow("PROTOCOL")
    expect(calls).toBe(1)
  } finally { f.close() }
}))

test("all parts of the full owner and durable generation are checked before any session is exposed", async () => browser(async () => {
  for (const wrong of [
    undefined,
    { ...namespace, owner: { ...owner, profile: { ...owner.profile, installationId: "other-installation" } } },
    { ...namespace, owner: { ...owner, profile: { ...owner.profile, teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } } },
    { ...namespace, owner: { ...owner, principal: { ...owner.principal, principalObjectId: "22222222-2222-4222-8222-222222222222" } } },
    { ...namespace, owner: { ...owner, principal: { ...owner.principal, tenantId: "22222222-2222-4222-8222-222222222222" } } },
    { ...namespace, authorityGeneration: 0 },
    { ...namespace, epoch: 3 },
  ]) {
    const f = fixture(async () => json({ data: [], cursor: {}, namespace: wrong }))
    try {
      await expect(f.client.list()).rejects.toThrow()
      expect(f.client.namespace()).toBeUndefined()
      expect(f.failures).toHaveLength(1)
    } finally { f.close() }
  }
  let reads = 0
  const f = fixture(async () => list(++reads === 1 ? namespace : { ...namespace, authorityGeneration: 4 }))
  try {
    await f.client.list()
    await expect(f.client.list()).rejects.toThrow("NAMESPACE")
    expect(f.failures).toEqual(["namespace"])
    expect(f.client.namespace()).toBeUndefined()
  } finally { f.close() }
}))

test("a matching list envelope does not authorize a foreign nested Info namespace or mismatched get ID", async () => browser(async () => {
  for (const body of [
    { data: [{ ...info, namespace: { ...namespace, authorityGeneration: 4 } }], namespace, cursor: {} },
    { data: [{ ...info, namespace: undefined }], namespace, cursor: {} },
  ]) {
    const f = fixture(async () => json(body))
    try { await expect(f.client.list()).rejects.toThrow(); expect(f.client.namespace()).toBeUndefined() }
    finally { f.close() }
  }
  const f = fixture(async () => json({ data: { ...info, id: "ses_someone_else" } }))
  try { await expect(f.client.get({ sessionID: id })).rejects.toThrow("PROTOCOL"); expect(f.failures).toEqual(["protocol"]) }
  finally { f.close() }
}))

test("late headers and body after a profile switch never publish private data", async () => browser(async () => {
  const entered = Promise.withResolvers<void>(), released = Promise.withResolvers<Response>()
  const f = fixture(async () => { entered.resolve(); return released.promise })
  try {
    const pending = f.client.list()
    await entered.promise
    f.retire()
    released.resolve(list())
    await expect(pending).rejects.toThrow()
    expect(f.client.namespace()).toBeUndefined()
  } finally { released.resolve(list()); f.close() }
  let stream!: ReadableStreamDefaultController<Uint8Array>, cancelled = false
  const g = fixture(async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) { stream = controller }, cancel() { cancelled = true },
  }), { headers: { "content-type": "application/json", "cache-control": "no-store" } }))
  try {
    const pending = g.client.list()
    await Promise.resolve(); await Promise.resolve()
    g.life.abort()
    await expect(pending).rejects.toThrow()
    expect(g.client.namespace()).toBeUndefined()
    expect(cancelled).toBe(true)
  } finally { try { stream.close() } catch {} g.close() }
}))

test("only namespace-checked corporate event envelopes leave the official SDK iterator", async () => browser(async () => {
  const frames = [JSON.stringify({ namespace, event: connected }), JSON.stringify(connected)]
  const f = fixture(async (url) => new URL(url).pathname.endsWith("/api/event")
    ? new Response(frames.map((frame) => "data: " + frame + "\n\n").join(""), {
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
    }) : list())
  try {
    await f.client.list()
    const stream = f.client.events()[Symbol.asyncIterator]()
    expect(await stream.next()).toEqual({ done: false, value: connected })
    await expect(stream.next()).rejects.toThrow("PROTOCOL")
    expect(f.failures).toEqual(["protocol"])
  } finally { f.close() }
}))

test("generation change in a stream retires it before yielding the second frame", async () => browser(async () => {
  const f = fixture(async (url) => new URL(url).pathname.endsWith("/api/event")
    ? new Response([namespace, { ...namespace, authorityGeneration: 4 }]
      .map((value) => "data: " + JSON.stringify({ namespace: value, event: connected }) + "\n\n").join(""), {
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
    }) : list())
  try {
    await f.client.list()
    const stream = f.client.events()[Symbol.asyncIterator]()
    expect((await stream.next()).value).toEqual(connected)
    await expect(stream.next()).rejects.toThrow("NAMESPACE")
    expect(f.failures).toEqual(["namespace"])
  } finally { f.close() }
}))

test("typed input rejects hidden technical location, owner claims and invalid body before fetch", async () => browser(async () => {
  for (const value of [{ directory: "/wrong" }, { project: "global" }, { location: { directory: "/wrong" } }, { limit: 0 }, { owner }]) {
    let calls = 0
    const f = fixture(async () => { calls++; return list() })
    try {
      const request = { limit: 20, ...value }
      await expect(f.client.list(request)).rejects.toThrow("PROTOCOL")
      expect(calls).toBe(0)
    } finally { f.close() }
  }
}))

test("server denial scrubs the namespace and never retries a mutation", async () => browser(async () => {
  for (const status of [401, 403, 503]) {
    let calls = 0
    const f = fixture(async (_url, init) => {
      calls++
      return init?.method === "POST" ? json({ _tag: "Unavailable" }, status) : list()
    })
    try {
      await f.client.list()
      await expect(f.client.create({ id })).rejects.toThrow()
      expect(calls).toBe(2)
      expect(f.failures).toEqual(status === 503 ? [] : [status === 401 ? "unauthenticated" : "denied"])
      if (status !== 503) expect(f.client.namespace()).toBeUndefined()
    } finally { f.close() }
  }
}))

test("messages, history and active reads require response namespaces even when empty", async () => browser(async () => {
  for (const route of ["message", "history", "active"] as const) {
    let first = true
    const f = fixture(async () => {
      if (first) { first = false; return list() }
      return json(route === "history" ? { data: [], hasMore: false } :
        route === "message" ? { data: [], cursor: {} } : { data: {} })
    })
    try {
      await f.client.list()
      const request = route === "history" ? f.client.history({ sessionID: id }) :
        route === "message" ? f.client.messages({ sessionID: id }) : f.client.active()
      await expect(request).rejects.toThrow("PROTOCOL")
      expect(f.failures).toEqual(["protocol"])
    } finally { f.close() }
  }
}))
