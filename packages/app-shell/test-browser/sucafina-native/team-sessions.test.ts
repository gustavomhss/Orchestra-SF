import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionEvent } from "@orchestra/schema/session-event"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import type { SfTeamSessionInfo, SfTeamSessionMessage } from "@orchestra/client/sucafina/sessions"
import { solidDom } from "../real-ui-solid"

const module: typeof import("../../src/context/team-sessions") =
  await import(solidDom("../../src/context/team-sessions.ts", import.meta.dir))
const { createTeamSessionsWorkspace } = module
const routes: typeof import("../../src/orchestra/chapters/sucafina/host/team-route") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/host/team-route.ts", import.meta.dir))

// Client/UI lifecycle only: encoded response labels here are not authority.
// Signed OIDC, actual SessionOwner, SQL and Chromium are a separate G02 gate.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "same-host", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
})
const principal = Schema.decodeUnknownSync(TeamProfile.Principal)({
  tenantId: binding.tenantId, principalObjectId: "11111111-1111-4111-8111-111111111111",
})
const context = (revision = "ui-source", team = profile) => Schema.decodeUnknownSync(SfTeamContext)({
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
  stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    principalRef: principal.principalObjectId, policyVersion: "policy", accessRevision: revision,
    team: { owner: { profile: team, principal }, revisions: { configRevision: 2, accessRevision: revision } } },
  profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: binding.installationId,
    principal, accessRevision: revision, administration: { status: "available" },
    teams: { status: "ready", selected: team, configRevision: 2, choices: [{ profile: team, displayName: "Shared Team" }] } },
  destinations: [], availability: [],
})
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
const gate = <T>() => Promise.withResolvers<T>()
async function eventually(predicate: () => boolean) {
  const until = Date.now() + 1000
  while (!predicate()) { if (Date.now() >= until) throw new Error("UI condition did not settle"); await Bun.sleep(1) }
}
function fixture(input: Readonly<{ storage?: Map<string, string>; windowId?: string }> = {}) {
  const previous = window.location.href
  window.location.href = binding.publicOrigin + "/"
  const storage = input.storage ?? new Map<string, string>(), calls: Request[] = [], notices: string[] = [], opened: string[] = []
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const rows = new Map<string, SfTeamSessionInfo>(), messages = new Map<string, SfTeamSessionMessage[]>()
  const history = new Map<string, typeof SessionEvent.Durable.Encoded[]>()
  let current = context(), generation = 1, authorityGeneration = 1, unauthenticated = 0
  let failCreate = false, failPrompt = false
  let hook: ((request: Request) => Promise<Response | undefined>) | undefined
  const namespace = () => Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({
    version: 1, owner: current.stamp.team!.owner, authorityGeneration,
  })
  const info = (id: string, title = "Private chat"): SfTeamSessionInfo => ({
    ...Schema.encodeSync(Session.Info)(Schema.decodeUnknownSync(Session.Info)({
      id, projectID: "global", title, location: { directory: "/technical-provenance" }, cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, time: { created: 1, updated: 1 },
    })), namespace: Schema.encodeSync(TeamProfile.SessionNamespace)(namespace()),
  })
  const emit = (event: unknown, label: unknown = namespace()) => {
    for (const controller of streams) controller.enqueue(new TextEncoder().encode("data: " + JSON.stringify({ namespace: label, event }) + "\n\n"))
  }
  const fetch: SfTransportFetch = async (url, init) => {
    const request = new Request(url, init), pathname = new URL(request.url).pathname
    calls.push(request.clone())
    const overridden = await hook?.(request.clone())
    if (overridden) return overridden
    if (pathname === binding.mount + "/api/event") {
      let instance: ReadableStreamDefaultController<Uint8Array> | undefined
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { instance = controller; streams.add(controller); controller.enqueue(new TextEncoder().encode("data: " +
          JSON.stringify({ namespace: namespace(), event: { id: "evt_connected", type: "server.connected", data: {} } }) + "\n\n")) },
        cancel() { if (instance) streams.delete(instance) },
      }), { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } })
    }
    if (pathname === binding.mount + "/api/session") {
      if (request.method === "GET") return json({ data: [...rows.keys()].map((id) => info(id, rows.get(id)!.title)), namespace: namespace(), cursor: {} })
      const body = await request.json(), value = info(body.id)
      rows.set(value.id, value)
      if (failCreate) { failCreate = false; throw new Error("lost create response after write") }
      return json({ data: value })
    }
    if (pathname.endsWith("/api/session/active")) return json({ data: {}, namespace: namespace() })
    const match = /\/api\/session\/([^/]+)(?:\/(message|history|prompt|interrupt))?$/.exec(pathname)
    if (!match) throw new Error("Unexpected session URL")
    const id = match[1]!, action = match[2]
    if (!rows.has(id)) return json({ error: "missing" }, 404)
    if (!action) return json({ data: info(id, rows.get(id)!.title) })
    if (action === "message") return json({ data: messages.get(id) ?? [], cursor: {}, namespace: namespace() })
    if (action === "history") return json({ data: history.get(id) ?? [], hasMore: false, namespace: namespace() })
    if (action === "interrupt") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
    const body = await request.json()
    const admitted = Schema.encodeSync(SessionEvent.PromptAdmitted)(Schema.decodeUnknownSync(SessionEvent.PromptAdmitted)({
      id: "evt_admitted_" + body.id, type: "session.next.prompt.admitted", durable: { aggregateID: id, seq: 1, version: 1 },
      data: { timestamp: 10, sessionID: id, messageID: body.id, prompt: body.prompt, delivery: "queue" },
    }))
    history.set(id, [admitted])
    if (failPrompt) { failPrompt = false; throw new Error("lost prompt response after write") }
    return json({ data: { id: body.id, sessionID: id, admittedSeq: 1, timeCreated: 10, prompt: body.prompt, delivery: "queue" } })
  }
  const workspace = createTeamSessionsWorkspace({
    binding, window: { id: input.windowId ?? "11111111-1111-4111-8111-111111111111", persistent: true, dispose() {} },
    storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) },
      removeItem: (key) => { storage.delete(key) } }, fetch,
    current: (value, epoch) => value === current && epoch === generation,
    unauthenticated: () => { unauthenticated++ }, notice: (key) => notices.push(key), opened: (id) => opened.push(id),
  })
  const activate = (value = context(), nextAuthorityGeneration = authorityGeneration) => {
    current = value; generation++; authorityGeneration = nextAuthorityGeneration
    workspace.activate(current, generation, new AbortController().signal)
  }
  activate()
  const draft = (text: string) => workspace.prompt[1]("prompt", [{ type: "text", content: text, start: 0, end: text.length }])
  return { workspace, calls, notices, opened, rows, messages, history, storage, info, namespace, emit, draft,
    setHook: (value: typeof hook) => { hook = value }, loseCreate: () => { failCreate = true }, losePrompt: () => { failPrompt = true },
    refresh(value = context(), nextAuthorityGeneration = authorityGeneration) { workspace.retire("refresh"); activate(value, nextAuthorityGeneration) },
    retire() { workspace.retire("revoked"); generation++ }, unauthenticated: () => unauthenticated,
    close() { workspace.retire("dispose"); window.location.href = previous },
  }
}

test("opening an explicit new-chat route performs reads only and creates no session until submission", async () => {
  const f = fixture()
  try {
    expect(f.calls).toEqual([])
    expect(await f.workspace.open()).toBe(true)
    await eventually(() => f.workspace.state.stream === "open")
    expect(f.calls.every((request) => request.method === "GET")).toBe(true)
    expect(f.rows.size).toBe(0)
    f.draft("private prompt")
    expect(await f.workspace.submit()).toBe(true)
    expect(f.rows.size).toBe(1)
    expect(f.opened).toHaveLength(1)
    const writes = f.calls.filter((request) => request.method === "POST")
    expect(writes).toHaveLength(2)
    expect(await writes[0]!.json()).toEqual({ id: f.opened[0] })
    expect(await writes[1]!.json()).toMatchObject({ prompt: { text: "private prompt" } })
    expect(f.workspace.state.threads[f.opened[0]!]!.queue[0]?.text).toBe("private prompt")
    expect([...f.storage.values()].join("")).not.toContain("private prompt")
    expect([...f.storage.values()].join("")).not.toContain("Private chat")
    expect(f.calls.every((request) => request.url.startsWith(binding.publicOrigin + binding.mount + "/api/"))).toBe(true)
    expect(f.calls.every((request) => request.headers.has("x-sf-team-profile") && !request.headers.has("authorization"))).toBe(true)
  } finally { f.close() }
})

test("tabs keep separate memory drafts and recently closed IDs reopen through a fresh admitted GET", async () => {
  const f = fixture(), a = Session.ID.create(), b = Session.ID.create()
  f.rows.set(a, f.info(a, "A title")); f.rows.set(b, f.info(b, "B title"))
  try {
    await f.workspace.open(a); f.draft("draft A")
    await f.workspace.open(b); f.draft("draft B")
    await f.workspace.open(a)
    expect(f.workspace.prompt[0].prompt[0]).toMatchObject({ content: "draft A" })
    expect(await f.workspace.closeTab(a)).toBe(false)
    expect(await f.workspace.closeTab(a, true)).toBe(true)
    expect(f.workspace.state.closed).toEqual([a])
    const before = f.calls.length
    expect(await f.workspace.open(a)).toBe(true)
    expect(f.calls.slice(before).some((request) => new URL(request.url).pathname.endsWith("/" + a))).toBe(true)
    expect(f.workspace.state.closed).toEqual([])
    expect(f.workspace.prompt[0].prompt).toEqual([])
    await f.workspace.open(b)
    expect(f.workspace.prompt[0].prompt[0]).toMatchObject({ content: "draft B" })
    expect([...f.storage.values()].join("")).not.toMatch(/draft A|draft B|A title|B title/)
  } finally { f.close() }
})

test("refresh quarantines text until the same full owner, F02 stamp and durable generation are revalidated", async () => {
  const f = fixture(), id = Session.ID.create()
  f.rows.set(id, f.info(id))
  try {
    await f.workspace.open(id); f.draft("same-owner draft")
    f.refresh()
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.workspace.state.threads).toEqual({})
    await f.workspace.open(id)
    expect(f.workspace.prompt[0].prompt[0]).toMatchObject({ content: "same-owner draft" })
    f.refresh(context(), 2)
    await f.workspace.open(id)
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.notices).toContain("sf.teams.chatDraftsRemoved")
    f.draft("revision draft")
    f.refresh(context("changed-effective-revision"), 2)
    await f.workspace.open(id)
    expect(f.workspace.prompt[0].prompt).toEqual([])
  } finally { f.close() }
})

test("late HTTP data and stream frames cannot repopulate a retired workspace", async () => {
  const f = fixture(), id = Session.ID.create(), entered = gate<void>(), release = gate<void>()
  f.rows.set(id, f.info(id))
  try {
    await f.workspace.open()
    f.setHook(async (request) => {
      if (new URL(request.url).pathname.endsWith("/" + id)) { entered.resolve(); await release.promise }
      return undefined
    })
    const reading = f.workspace.open(id)
    await entered.promise
    f.retire(); release.resolve()
    expect(await reading).toBe(false)
    expect(f.workspace.state.threads).toEqual({})
    expect(f.workspace.state.recent).toEqual([])
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.workspace.state.stream).toBe("idle")
  } finally { release.resolve(); f.close() }
})

test("a foreign response namespace clears chat data while leaving corporate authentication to the runtime", async () => {
  const f = fixture(), id = Session.ID.create()
  f.rows.set(id, f.info(id))
  try {
    await f.workspace.open(id); f.draft("must scrub")
    const wrong = { ...f.namespace(), owner: { ...f.namespace().owner, principal: {
      ...principal, principalObjectId: "22222222-2222-4222-8222-222222222222",
    } } }
    f.emit({ id: "evt_foreign", type: "server.connected", data: {} }, wrong)
    await eventually(() => f.workspace.state.status === "unavailable")
    expect(f.workspace.state.threads).toEqual({})
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.unauthenticated()).toBe(0)
  } finally { f.close() }
})

test("uncertain create and prompt responses retain stable IDs and reconcile by reads without automatic resubmission", async () => {
  const f = fixture()
  try {
    await f.workspace.open(); f.draft("keep this unsent draft"); f.loseCreate()
    expect(await f.workspace.submit()).toBe(false)
    expect(f.rows.size).toBe(1)
    expect(f.workspace.state.pending[0]?.action).toBe("create")
    const pendingCreate = f.workspace.state.pending[0]!
    expect(await f.workspace.confirmPending(pendingCreate)).toBe(true)
    expect(f.workspace.prompt[0].prompt[0]).toMatchObject({ content: "keep this unsent draft" })
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    f.losePrompt()
    expect(await f.workspace.submit()).toBe(false)
    const pendingPrompt = f.workspace.state.pending[0]!
    expect(pendingPrompt.action).toBe("prompt")
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.workspace.discardDrafts()).toBe(false)
    expect(await f.workspace.confirmPending(pendingPrompt)).toBe(true)
    expect(f.workspace.state.pending).toEqual([])
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(2)
    expect(f.workspace.state.threads[pendingPrompt.sessionID]!.queue[0]?.text).toBe("keep this unsent draft")
  } finally { f.close() }
})

test("persisted IDs are window and owner scoped and never restore private text before current reads", async () => {
  const storage = new Map<string, string>(), id = Session.ID.create()
  const first = fixture({ storage, windowId: "11111111-1111-4111-8111-111111111111" })
  first.rows.set(id, first.info(id, "hidden persisted title"))
  await first.workspace.open(id); first.draft("private unsaved"); first.close()
  expect([...storage.values()].join("")).not.toMatch(/hidden persisted title|private unsaved/)
  const other = fixture({ storage, windowId: "22222222-2222-4222-8222-222222222222" })
  try { await other.workspace.open(); expect(other.workspace.state.tabs).toEqual([]) } finally { other.close() }
  const foreign = fixture({ storage, windowId: "11111111-1111-4111-8111-111111111111" })
  try {
    const otherTeam = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
    foreign.refresh(context("other-owner", otherTeam))
    await foreign.workspace.open()
    expect(foreign.workspace.state.tabs).toEqual([])
    expect(foreign.workspace.prompt[0].prompt).toEqual([])
  } finally { foreign.close() }
  const reopened = fixture({ storage, windowId: "11111111-1111-4111-8111-111111111111" })
  reopened.rows.set(id, reopened.info(id, "fresh server title"))
  try {
    expect(reopened.workspace.state.tabs).toEqual([])
    expect(reopened.workspace.prompt[0].prompt).toEqual([])
    await reopened.workspace.open(id)
    expect(reopened.workspace.state.tabs.map((item) => item.title)).toEqual(["fresh server title"])
    expect(reopened.workspace.prompt[0].prompt).toEqual([])
  } finally { reopened.close() }
})

test("session URLs contain only installation, tenant and Team intent and reject technical or authority fields", () => {
  const id = Session.ID.create(), href = routes.sfTeamSessionHref(binding, profile, id)
  expect(routes.readSfTeamWebRoute(href, binding)).toMatchObject({ kind: "session", profile, sessionID: id })
  expect(routes.readSfTeamWebRoute(routes.sfTeamSessionHref(binding, profile), binding)).toMatchObject({ kind: "session" })
  for (const extra of ["projectId=global", "directory=%2Ftmp", "principalObjectId=x", "accessRevision=x", "authorityGeneration=1"])
    expect(routes.readSfTeamWebRoute(href + "&" + extra, binding)).toEqual({ kind: "invalid" })
  expect(routes.readSfTeamWebRoute(href + "#other", binding)).toEqual({ kind: "invalid" })
  expect(routes.readSfTeamWebRoute(href.replace(id, "%2e%2e%2f" + id), binding)).toEqual({ kind: "invalid" })
})
