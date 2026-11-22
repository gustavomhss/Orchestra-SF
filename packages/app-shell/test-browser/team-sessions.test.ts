import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionEvent } from "@orchestra/schema/session-event"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import type { SfTeamSessionInfo, SfTeamSessionMessage } from "@orchestra/client/sucafina/sessions"
import { solidDom } from "./real-ui-solid"

const module: typeof import("../src/context/team-sessions") =
  await import(solidDom("../src/context/team-sessions.ts", import.meta.dir))
const { createTeamSessionsWorkspace } = module
const routes: typeof import("../src/context/team-profile-navigation") =
  await import(solidDom("../src/context/team-profile-navigation.ts", import.meta.dir))
const storageModule: typeof import("../src/utils/team-profile-storage") =
  await import(solidDom("../src/utils/team-profile-storage.ts", import.meta.dir))

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
function fixture(input: Readonly<{ storage?: Map<string, string>; windowId?: string; persistent?: boolean; storageFails?: boolean }> = {}) {
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
    binding, window: { id: input.windowId ?? "11111111-1111-4111-8111-111111111111", persistent: input.persistent ?? true, dispose() {} },
    storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => {
      if (input.storageFails) throw new Error("storage denied")
      storage.set(key, value)
    }, removeItem: (key) => { storage.delete(key) }, key: (index) => [...storage.keys()][index] ?? null,
      get length() { return storage.size } }, fetch,
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
    dropStream() { for (const controller of streams) controller.error(new Error("stream connection lost")); streams.clear() },
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
  const id = Session.ID.create(), url = routes.teamSessionNavigationURL(binding, profile, id)
  if (!url) throw new Error("Expected valid session URL")
  expect(routes.readTeamSessionNavigation(url, binding)).toMatchObject({ kind: "session", profile, sessionID: id })
  const fresh = routes.teamSessionNavigationURL(binding, profile)
  if (!fresh) throw new Error("Expected new chat URL")
  expect(routes.readTeamSessionNavigation(fresh, binding)).toMatchObject({ kind: "session", profile })
  expect(routes.teamNavigationReturnTo(url, binding)).toBe(url.pathname + url.search)
  for (const extra of ["projectId=global", "directory=%2Ftmp", "principalObjectId=x", "accessRevision=x", "authorityGeneration=1"])
    expect(routes.readTeamSessionNavigation(new URL(url.href + "&" + extra), binding)).toBeUndefined()
  for (const href of [url.href + "#other", url.href.replace(id, "%2e%2e%2f" + id),
    url.href.replace(id, "new/extra"), url.href.replace(id, "not-a-session"),
    url.href.replace("teamObjectId=", "teamObjectId=&duplicate=")]) {
    expect(routes.readTeamSessionNavigation(new URL(href), binding)).toBeUndefined()
    expect(routes.teamNavigationReturnTo(new URL(href), binding)).toBeUndefined()
  }
  const partial = new URL(url)
  partial.searchParams.delete("teamObjectId")
  expect(routes.readTeamNavigationIntent(partial, binding)).toBeUndefined()
  expect(routes.teamSessionNavigationURL(binding, profile, "../sf-home")).toBeUndefined()
})

for (const optional of [{ persistent: false }, { persistent: true, storageFails: true }]) {
  test("uncertain results stay reconcilable after refresh when optional persistence is " + JSON.stringify(optional), async () => {
    const f = fixture(optional)
    try {
      await f.workspace.open()
      f.draft("draft before uncertain create")
      f.loseCreate()
      expect(await f.workspace.submit()).toBe(false)
      const created = f.workspace.state.pending[0]
      if (!created || created.action !== "create") throw new Error("Expected uncertain create")
      f.refresh()
      expect(f.workspace.prompt[0].prompt).toEqual([])
      expect(f.workspace.hasPendingRequests()).toBe(true)
      expect(f.workspace.discardDrafts()).toBe(false)
      await f.workspace.open()
      expect(f.workspace.state.pending[0]).toEqual(created)
      expect(f.workspace.prompt[0].prompt[0]).toMatchObject({ content: "draft before uncertain create" })
      expect(await f.workspace.confirmPending(created)).toBe(true)
      f.losePrompt()
      expect(await f.workspace.submit()).toBe(false)
      const prompted = f.workspace.state.pending[0]
      if (!prompted || prompted.action !== "prompt") throw new Error("Expected uncertain prompt")
      f.refresh()
      await f.workspace.open(prompted.sessionID)
      expect(f.workspace.state.pending[0]).toEqual(prompted)
      expect(f.workspace.prompt[0].prompt).toEqual([])
      expect(await f.workspace.confirmPending(prompted)).toBe(true)
      expect(f.workspace.state.pending).toEqual([])
      expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(2)
      expect(f.workspace.state.threads[prompted.sessionID]!.queue[0]?.text).toBe("draft before uncertain create")
      expect([...f.storage.values()].join("")).not.toContain("draft before uncertain create")
    } finally { f.close() }
  })
}

test("new-chat text returns only after the same observed context and namespace revalidate", async () => {
  const f = fixture({ persistent: false })
  try {
    await f.workspace.open()
    f.draft("new draft")
    f.refresh()
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.workspace.hasDirtyDrafts()).toBe(true)
    await f.workspace.open()
    expect(f.workspace.prompt[0].prompt[0]).toMatchObject({ content: "new draft" })
    f.refresh(context("new-access"))
    await f.workspace.open()
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.notices).toContain("sf.teams.chatDraftsRemoved")
  } finally { f.close() }
})

for (const reason of ["logout", "revoked", "principal-change"] as const) {
  test(reason + " purges private data and ID hints for the principal across Teams in this window", async () => {
    const f = fixture(), id = Session.ID.create()
    const windowId = "11111111-1111-4111-8111-111111111111"
    const otherWindow = "22222222-2222-4222-8222-222222222222"
    const owner = { profile, principal }
    const otherProfile = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
    const otherTeamKey = storageModule.teamPrivateKey({ profile: otherProfile, principal }, "session-hints", windowId)
    const otherWindowKey = storageModule.teamPrivateKey(owner, "session-hints", otherWindow)
    f.rows.set(id, f.info(id))
    try {
      await f.workspace.open(id)
      f.draft("private draft")
      f.storage.set(otherTeamKey, "old IDs")
      f.storage.set(otherWindowKey, "other document IDs")
      expect(f.storage.size).toBe(3)
      f.workspace.retire(reason)
      expect(f.workspace.state.threads).toEqual({})
      expect(f.workspace.state.recent).toEqual([])
      expect(f.workspace.state.pending).toEqual([])
      expect(f.workspace.prompt[0].prompt).toEqual([])
      expect(f.storage.has(otherTeamKey)).toBe(false)
      expect([...f.storage]).toEqual([[otherWindowKey, "other document IDs"]])
    } finally { f.close() }
  })
}

test("a stream failure after POST dispatch preserves only operation IDs until fresh admission proves the receipt", async () => {
  const f = fixture({ persistent: false }), id = Session.ID.create()
  f.rows.set(id, f.info(id))
  const entered = gate<void>(), release = gate<void>()
  let messageID: string | undefined
  try {
    await f.workspace.open(id)
    await eventually(() => f.workspace.state.stream === "open")
    f.setHook(async (request) => {
      if (!new URL(request.url).pathname.endsWith("/prompt")) return undefined
      const body = Schema.decodeUnknownSync(Schema.Struct({
        id: SessionMessage.ID, prompt: Schema.Struct({ text: Schema.String }),
      }), { onExcessProperty: "error" })(await request.json())
      messageID = body.id
      const admitted = Schema.encodeSync(SessionEvent.PromptAdmitted)(Schema.decodeUnknownSync(SessionEvent.PromptAdmitted)({
        id: "evt_uncertain_" + body.id, type: "session.next.prompt.admitted",
        durable: { aggregateID: id, seq: 1, version: 1 },
        data: { timestamp: 10, sessionID: id, messageID: body.id, prompt: body.prompt, delivery: "queue" },
      }))
      f.history.set(id, [admitted])
      entered.resolve()
      await release.promise
      return json({ data: { id: body.id, sessionID: id, admittedSeq: 1, timeCreated: 10,
        prompt: body.prompt, delivery: "queue" } })
    })
    f.draft("submitted text is not a retry")
    const posting = f.workspace.submit()
    await entered.promise
    f.dropStream()
    await eventually(() => f.workspace.state.status === "unavailable")
    expect(f.workspace.state.reason).toBe("stream")
    expect(f.workspace.state.threads).toEqual({})
    expect(f.workspace.prompt[0].prompt).toEqual([])
    expect(f.workspace.hasPendingRequests()).toBe(true)
    expect(f.workspace.discardDrafts()).toBe(false)
    release.resolve()
    expect(await posting).toBe(false)
    f.setHook(undefined)
    f.refresh()
    await f.workspace.open(id)
    const operation = f.workspace.state.pending[0]
    expect(operation).toMatchObject({ action: "prompt", sessionID: id, messageID })
    if (!operation) throw new Error("Expected retained uncertain operation")
    expect(await f.workspace.confirmPending(operation)).toBe(true)
    expect(f.workspace.state.pending).toEqual([])
    expect(f.workspace.state.threads[id]?.queue[0]?.text).toBe("submitted text is not a retry")
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    expect([...f.storage.values()].join("")).not.toContain("submitted text is not a retry")
  } finally { release.resolve(); f.close() }
})

for (const reason of ["protocol", "namespace"] as const) {
  test(reason + " failure after a retained POST keeps opaque operation IDs for the original owner until read-only reconciliation", async () => {
    const f = fixture({ persistent: reason === "protocol" }), id = Session.ID.create()
    f.rows.set(id, f.info(id, "Private session title"))
    const entered = gate<void>(), release = gate<void>()
    let messageID: string | undefined
    try {
      await f.workspace.open(id)
      await eventually(() => f.workspace.state.stream === "open")
      f.setHook(async (request) => {
        if (!new URL(request.url).pathname.endsWith("/prompt")) return undefined
        const body = Schema.decodeUnknownSync(Schema.Struct({
          id: SessionMessage.ID, prompt: Schema.Struct({ text: Schema.String }),
        }), { onExcessProperty: "error" })(await request.json())
        messageID = body.id
        f.history.set(id, [Schema.encodeSync(SessionEvent.PromptAdmitted)(Schema.decodeUnknownSync(SessionEvent.PromptAdmitted)({
          id: "evt_uncertain_" + body.id, type: "session.next.prompt.admitted",
          durable: { aggregateID: id, seq: 1, version: 1 },
          data: { timestamp: 10, sessionID: id, messageID: body.id, prompt: body.prompt, delivery: "queue" },
        }))])
        entered.resolve()
        await release.promise
        const receipt = { data: { id: body.id, sessionID: id, admittedSeq: 1, timeCreated: 10,
          prompt: body.prompt, delivery: "queue" } }
        // The write already exists, but a response without no-store cannot be admitted by the Client.
        return reason === "protocol" ? Response.json(receipt) : json(receipt)
      })
      f.draft("private admitted text")
      const posting = f.workspace.submit()
      await entered.promise
      if (reason === "protocol") release.resolve()
      else f.emit({ id: "evt_foreign_pending", type: "server.connected", data: {} }, {
        ...f.namespace(), owner: { profile, principal: { ...principal,
          principalObjectId: "22222222-2222-4222-8222-222222222222" } },
      })
      await eventually(() => f.workspace.state.status === "unavailable")
      expect(f.workspace.state.reason).toBe(reason)
      expect(f.workspace.state.threads).toEqual({})
      expect(f.workspace.state.recent).toEqual([])
      expect(f.workspace.state.pending).toEqual([])
      expect(f.workspace.prompt[0].prompt).toEqual([])
      expect(f.workspace.hasPendingRequests()).toBe(true)
      expect(f.workspace.discardDrafts()).toBe(false)
      expect(f.unauthenticated()).toBe(0)
      expect([...f.storage.values()].join("")).not.toMatch(/private admitted text|Private session title/)
      release.resolve()
      expect(await posting).toBe(false)
      f.setHook(undefined)
      f.refresh(context(), 2)
      await f.workspace.open(id)
      const operation = f.workspace.state.pending[0]
      expect(operation).toMatchObject({ action: "prompt", sessionID: id, messageID })
      if (!operation) throw new Error("Expected retained uncertain operation")
      expect(f.workspace.prompt[0].prompt).toEqual([])
      f.draft("new operation must wait")
      expect(await f.workspace.submit()).toBe(false)
      expect(f.workspace.discardDrafts()).toBe(false)
      const before = f.calls.length
      expect(await f.workspace.confirmPending(operation)).toBe(true)
      expect(f.calls.slice(before).every((request) => request.method === "GET")).toBe(true)
      expect(f.workspace.state.pending).toEqual([])
      expect(f.workspace.state.threads[id]?.queue[0]?.text).toBe("private admitted text")
      expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
      expect([...f.storage.values()].join("")).not.toMatch(/private admitted text|new operation must wait|Private session title/)
    } finally { release.resolve(); f.close() }
  })
}
