import { expect, spyOn, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionEvent } from "@orchestra/schema/session-event"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTeamSessionInfo, SfTeamSessionMessage } from "@orchestra/client/sucafina/sessions"
import { solidDom } from "./real-ui-solid"

const { SfTeamWebApp }: typeof import("../src/pages/team-profile") =
  await import(solidDom("../src/pages/team-profile", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") =
  await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") =
  await import(solidDom("../src/context/platform", import.meta.dir))
const { DialogProvider }: typeof import("@orchestra/ui/context/dialog") =
  await import(solidDom("@orchestra/ui/context/dialog", import.meta.dir))

// Real DOM, Client SDK, reader, composer and transcript. Only HTTP responses are controlled;
// these fixtures do not establish Microsoft authority, model execution or a LIVE release.
const binding = {
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "teams-host", publicOrigin: "https://teams.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
}
const a = "a1111111-2222-4333-8444-555555555555", b = "b1111111-2222-4333-8444-555555555555"
const firstPrincipal = "c1111111-2222-4333-8444-555555555555"
const secondPrincipal = "d1111111-2222-4333-8444-555555555555"
const profile = (teamObjectId: string) => ({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId,
})
const href = (team: string, id?: string, context = false) => binding.publicOrigin +
  (context ? "/" : "/orchestra/sf-sessions/" + (id ?? "new")) + "?" + new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: team,
  })
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
async function eventually(predicate: () => boolean, message = "Expected native Teams UI to settle") {
  const deadline = Date.now() + 5000
  while (!predicate()) { if (Date.now() >= deadline) throw new Error(message); await tick() }
}
function mount(target = href(a)) {
  const originalHref = window.location.href
  window.location.href = target
  let principalObjectId = firstPrincipal, accessRevision = "access-one", authorityGeneration = 1, signedIn = true
  let lostPrompt = false, serial = 0
  let hook: ((request: Request) => Promise<Response | undefined>) | undefined
  const requests: Request[] = []
  const rows = new Map<string, SfTeamSessionInfo>(), messages = new Map<string, SfTeamSessionMessage[]>()
  const histories = new Map<string, typeof SessionEvent.Durable.Encoded[]>()
  const streams = new Set<{ controller: ReadableStreamDefaultController<Uint8Array>; team: string; principal: string }>()
  const owner = (team: string) => ({
    profile: profile(team), principal: { tenantId: binding.tenantId, principalObjectId },
  })
  const namespace = (team: string) => Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({
    version: 1, owner: owner(team), authorityGeneration,
  })
  const key = (team: string, id: string) => JSON.stringify([principalObjectId, team, id])
  const info = (team: string, id: string, title = "Private chat"): SfTeamSessionInfo => ({
    ...Schema.encodeSync(Session.Info)(Schema.decodeUnknownSync(Session.Info)({
      id, projectID: "global", title, location: { directory: "/technical-provenance" },
      agent: "analyst", model: { providerID: "test", id: "model" }, cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 1, updated: 1 },
    })), namespace: Schema.encodeSync(TeamProfile.SessionNamespace)(namespace(team)),
  })
  const context = (team: string | null) => ({
    status: "ok", value: {
      contractRevision: binding.contractRevision, authMode: binding.authMode,
      stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        principalRef: principalObjectId, policyVersion: "policy-one", accessRevision,
        ...(team ? { team: { owner: owner(team), revisions: { configRevision: 0, accessRevision } } } : {}) },
      profile: { contractRevision: binding.contractRevision, status: "authenticated", installationId: binding.installationId,
        principal: owner(a).principal, accessRevision, administration: { status: "denied" },
        teams: team ? { status: "ready", selected: profile(team), configRevision: 0,
          choices: [{ profile: profile(a), displayName: "Team A" }, { profile: profile(b), displayName: "Team B" }] } :
          { status: "selection-required", choices: [
            { profile: profile(a), displayName: "Team A" }, { profile: profile(b), displayName: "Team B" },
          ] } },
      destinations: [], availability: [],
    },
  })
  const fetch = spyOn(globalThis, "fetch").mockImplementation(async (raw, init) => {
    const request = new Request(new URL(raw instanceof Request ? raw.url : raw.toString(), window.location.href), init)
    requests.push(request.clone())
    const overridden = await hook?.(request.clone())
    if (overridden) return overridden
    const url = new URL(request.url), path = url.pathname
    if (path === "/api/sucafina/installations") return json({ installations: [binding] })
    if (path === binding.mount + "/auth/logout") { signedIn = false; return new Response(null, { status: 204 }) }
    if (!signedIn) return json({ status: "unauthenticated" }, 401)
    if (path === binding.mount + "/api/ui/context") return json(context(url.searchParams.get("teamObjectId")))
    const rawSelector = request.headers.get("x-sf-team-profile")
    if (!rawSelector) throw new Error("Expected closed Team selector on Session request")
    const selector = Schema.decodeUnknownSync(TeamProfile.Selector, { onExcessProperty: "error" })(JSON.parse(rawSelector))
    if (selector.kind !== "team") throw new Error("Expected Team intent")
    const team = selector.profile.teamObjectId
    if (path === binding.mount + "/api/event") {
      let entry: { controller: ReadableStreamDefaultController<Uint8Array>; team: string; principal: string } | undefined
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          entry = { controller, team, principal: principalObjectId }; streams.add(entry)
          controller.enqueue(new TextEncoder().encode("data: " + JSON.stringify({
            namespace: namespace(team), event: { id: "evt_connected_" + ++serial, type: "server.connected", data: {} },
          }) + "\n\n"))
        },
        cancel() { if (entry) streams.delete(entry) },
      }), { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } })
    }
    if (path === binding.mount + "/api/session") {
      if (request.method === "GET") return json({ namespace: namespace(team), cursor: {},
        data: [...rows.values()].filter((row) => row.namespace.owner.profile.teamObjectId === team &&
          row.namespace.owner.principal.principalObjectId === principalObjectId).map((row) => info(team, row.id, row.title)) })
      const body = Schema.decodeUnknownSync(Schema.Struct({ id: Session.ID }), { onExcessProperty: "error" })(await request.json())
      const value = info(team, body.id)
      rows.set(key(team, body.id), value)
      return json({ data: value })
    }
    if (path === binding.mount + "/api/session/active") return json({ data: {}, namespace: namespace(team) })
    const match = /\/api\/session\/([^/]+)(?:\/(message|history|prompt|interrupt))?$/.exec(path)
    if (!match) throw new Error("Unexpected Teams request: " + path)
    const id = match[1]!, operation = match[2], rowKey = key(team, id), row = rows.get(rowKey)
    if (!row) return json({ error: "not admitted" }, 403)
    if (!operation) return json({ data: info(team, id, row.title) })
    if (operation === "message") return json({ data: messages.get(rowKey) ?? [], cursor: {}, namespace: namespace(team) })
    if (operation === "history") return json({ data: histories.get(rowKey) ?? [], hasMore: false, namespace: namespace(team) })
    if (operation === "interrupt") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
    const body = Schema.decodeUnknownSync(Schema.Struct({
      id: SessionMessage.ID, prompt: Schema.Struct({ text: Schema.String }),
    }), { onExcessProperty: "error" })(await request.json())
    const admitted = Schema.encodeSync(SessionEvent.PromptAdmitted)(Schema.decodeUnknownSync(SessionEvent.PromptAdmitted)({
      id: "evt_admitted_" + body.id, type: "session.next.prompt.admitted", durable: { aggregateID: id, seq: 1, version: 1 },
      data: { timestamp: 10, sessionID: id, messageID: body.id, prompt: body.prompt, delivery: "queue" },
    }))
    histories.set(rowKey, [admitted])
    if (lostPrompt) { lostPrompt = false; throw new Error("Response lost after admission") }
    messages.set(rowKey, [Schema.encodeSync(SessionMessage.User)(Schema.decodeUnknownSync(SessionMessage.User)({
      type: "user", id: body.id, text: body.prompt.text, time: { created: 10 },
    }))])
    return json({ data: { id: body.id, sessionID: id, admittedSeq: 1, timeCreated: 10, prompt: body.prompt, delivery: "queue" } })
  })
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
    get children() { return createComponent(LanguageProvider, {
      locale: "en", get children() { return createComponent(DialogProvider, {
        get children() { return createComponent(SfTeamWebApp, {}) },
      }) },
    }) },
  }), host)
  const editor = () => {
    const value = host.querySelector<HTMLDivElement>('[data-component="prompt-input-v2"] [data-component="prompt-input"]')
    if (!value) throw new Error("Expected actual PromptInputV2 editor")
    return value
  }
  const click = (selector: string) => {
    const value = host.querySelector<HTMLButtonElement>(selector)
    if (!value) throw new Error("Expected Teams control " + selector)
    value.click()
  }
  return {
    host, requests, rows, messages, histories, info, namespace, context, key,
    state: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state"),
    selected: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected"),
    ready: () => host.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-state") === "ready",
    editor, click,
    write(text: string) {
      const target = editor()
      target.focus(); target.replaceChildren(document.createTextNode(text))
      const range = document.createRange()
      range.selectNodeContents(target); range.collapse(false)
      window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }))
    },
    choose(team: string) {
      const target = host.querySelector<HTMLSelectElement>("[data-sf-team-picker]")
      if (!target) throw new Error("Expected Team picker")
      target.value = team; target.dispatchEvent(new Event("change", { bubbles: true }))
    },
    emit(team: string, type: string, data: Record<string, unknown>, durable?: { aggregateID: string; seq: number; version: 1 }) {
      const event = Schema.encodeSync(SessionEvent.All)(Schema.decodeUnknownSync(SessionEvent.All)({
        id: "evt_ui_" + ++serial, type, data: { timestamp: serial + 20, ...data }, ...(durable ? { durable } : {}),
      }))
      for (const stream of streams) if (stream.team === team && stream.principal === principalObjectId)
        stream.controller.enqueue(new TextEncoder().encode("data: " + JSON.stringify({ namespace: namespace(team), event }) + "\n\n"))
    },
    dropStreams() {
      for (const stream of streams) stream.controller.error(new Error("Event transport interrupted"))
      streams.clear()
    },
    losePrompt() { lostPrompt = true },
    setPrincipal(value: string) { principalObjectId = value },
    setGeneration(value: number) { authorityGeneration = value },
    setRevision(value: string) { accessRevision = value },
    setHook(value: typeof hook) { hook = value },
    refresh() { window.dispatchEvent(new Event("focus")) },
    navigate(target: string) { window.history.pushState(null, "", target); window.dispatchEvent(new Event("popstate")) },
    close() {
      dispose(); host.remove()
      for (const stream of streams) stream.controller.close()
      streams.clear(); fetch.mockRestore(); window.location.href = originalHref
    },
  }
}

async function ready(view: ReturnType<typeof mount>) {
  await eventually(() => view.ready() && !!view.host.querySelector('[data-component="prompt-input-v2"]'))
}
const sessionRequests = (view: ReturnType<typeof mount>) =>
  view.requests.filter((request) => new URL(request.url).pathname.startsWith(binding.mount + "/api/session"))

test("the real native composer creates once and renders admitted messages plus namespace-checked stream text", async () => {
  const view = mount(href(a, undefined, true))
  try {
    await eventually(() => view.selected() === a)
    expect(sessionRequests(view)).toHaveLength(0)
    view.click("[data-sf-new-chat]")
    await ready(view)
    expect(view.rows.size).toBe(0)
    expect(sessionRequests(view).every((request) => request.method === "GET")).toBe(true)
    view.write("Please review this Team")
    view.click('[data-action="prompt-submit"]')
    await eventually(() => view.rows.size === 1 && !!view.host.querySelector("[data-sf-message-id]"))
    const row = [...view.rows.values()][0]!
    expect(new URL(window.location.href).pathname).toBe("/orchestra/sf-sessions/" + row.id)
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(a)
    expect(view.host.querySelector("[data-sf-session-transcript]")?.textContent).toContain("Please review this Team")
    const writes = sessionRequests(view).filter((request) => request.method === "POST")
    expect(writes).toHaveLength(2)
    expect(await writes[0]!.json()).toEqual({ id: row.id })
    expect(await writes[1]!.json()).toMatchObject({ prompt: { text: "Please review this Team" } })
    const assistantMessageID = SessionMessage.ID.create()
    view.emit(a, "session.next.step.started", { sessionID: row.id, assistantMessageID, agent: "analyst", model: { providerID: "test", id: "model" } })
    view.emit(a, "session.next.text.started", { sessionID: row.id, assistantMessageID, textID: "team-answer" })
    view.emit(a, "session.next.text.delta", { sessionID: row.id, assistantMessageID, textID: "team-answer", delta: "Team stream answer" })
    await eventually(() => !!view.host.querySelector('[data-sf-message-id="' + assistantMessageID + '"]')?.textContent?.includes("Team stream answer"))
    expect(sessionRequests(view).every((request) => !request.headers.has("authorization"))).toBe(true)
  } finally { view.close() }
}, 15000)

test("Team A B A uses the native discard dialog, keeps a cancelled draft and never displays another Team's draft", async () => {
  const view = mount()
  try {
    await ready(view)
    view.write("private A draft")
    const before = view.requests.length
    view.choose(b)
    await eventually(() => !!view.host.querySelector("dialog[data-sf-draft-guard][open]"))
    expect(view.requests.slice(before).some((request) => new URL(request.url).searchParams.get("teamObjectId") === b)).toBe(false)
    expect(view.host.querySelector<HTMLSelectElement>("[data-sf-team-picker]")?.value).toBe(a)
    view.click("[data-sf-keep-editing]")
    await tick()
    expect(view.selected()).toBe(a)
    expect(view.editor().textContent).toBe("private A draft")
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(a)
    view.choose(b)
    await eventually(() => !!view.host.querySelector("dialog[open]"))
    view.click("[data-sf-confirm-discard]")
    await eventually(() => view.selected() === b && view.ready())
    await ready(view)
    expect(view.editor().textContent).toBe("")
    expect(new URL(window.location.href).pathname).toBe("/orchestra/sf-sessions/new")
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(b)
    view.write("private B draft")
    view.choose(a)
    await eventually(() => !!view.host.querySelector("dialog[open]"))
    view.click("[data-sf-confirm-discard]")
    await eventually(() => view.selected() === a && view.ready())
    await ready(view)
    expect(view.editor().textContent).toBe("")
    expect(view.host.textContent).not.toContain("private B draft")
    expect(sessionRequests(view).filter((request) => request.method === "POST")).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("focus quarantines a new draft until fresh context and namespace reads, then a changed generation removes it", async () => {
  const view = mount(), release = Promise.withResolvers<void>()
  let held = false
  try {
    await ready(view)
    view.write("same-owner draft")
    view.setHook(async (request) => {
      if (!held && new URL(request.url).pathname === binding.mount + "/api/ui/context") {
        held = true; await release.promise
      }
      return undefined
    })
    view.refresh()
    await eventually(() => held && view.state() === "loading")
    expect(view.host.querySelector('[data-component="prompt-input-v2"]')).toBeNull()
    expect(view.host.textContent).not.toContain("same-owner draft")
    release.resolve()
    await ready(view)
    expect(view.editor().textContent).toBe("same-owner draft")
    view.setHook(undefined)
    view.setGeneration(2)
    view.refresh()
    await ready(view)
    expect(view.editor().textContent).toBe("")
    expect(view.host.querySelector("[data-sf-chat-notice]")?.textContent).toBe("Chat access changed and the previous drafts were removed.")
  } finally { release.resolve(); view.close() }
}, 15000)

test("history traversal rereads a session and keeps different same-Team in-memory drafts apart", async () => {
  const id = Session.ID.create(), view = mount()
  view.rows.set(view.key(a, id), view.info(a, id, "Existing server chat"))
  try {
    await ready(view)
    view.write("new chat draft")
    const before = view.requests.length
    view.navigate(href(a, id))
    await eventually(() => view.ready() && view.host.querySelector(".sf-team-session-heading h1")?.textContent === "Existing server chat")
    expect(view.requests.slice(before).some((request) => new URL(request.url).pathname === binding.mount + "/api/ui/context")).toBe(true)
    expect(view.requests.slice(before).some((request) => new URL(request.url).pathname === binding.mount + "/api/session/" + id)).toBe(true)
    expect(view.editor().textContent).toBe("")
    view.write("existing chat draft")
    view.navigate(href(a))
    await ready(view)
    expect(view.editor().textContent).toBe("new chat draft")
    view.navigate(href(a, id))
    await eventually(() => view.ready() && view.host.querySelector(".sf-team-session-heading h1")?.textContent === "Existing server chat")
    expect(view.editor().textContent).toBe("existing chat draft")
    expect(sessionRequests(view).every((request) => request.method === "GET")).toBe(true)
  } finally { view.close() }
}, 15000)

test("an uncertain prompt survives ephemeral refresh, blocks leaving and reconciles only by reads before logout clears personal URL intent", async () => {
  const view = mount()
  try {
    await ready(view)
    view.write("admitted once")
    view.losePrompt()
    view.click('[data-action="prompt-submit"]')
    await eventually(() => !!view.host.querySelector(".sf-team-session-pending button") &&
      !view.host.querySelector<HTMLButtonElement>(".sf-team-session-pending button")?.disabled)
    expect(view.editor().textContent).toBe("")
    expect(view.host.querySelector<HTMLButtonElement>('[data-action="prompt-submit"]')?.disabled).toBe(true)
    const id = [...view.rows.values()][0]!.id
    expect(new URL(window.location.href).pathname).toBe("/orchestra/sf-sessions/" + id)
    view.choose(b)
    await tick()
    expect(view.selected()).toBe(a)
    expect(view.host.querySelector("dialog[open]")).toBeNull()
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(a)
    view.refresh()
    await ready(view)
    await eventually(() => !!view.host.querySelector(".sf-team-session-pending button") &&
      !view.host.querySelector<HTMLButtonElement>(".sf-team-session-pending button")?.disabled)
    view.click(".sf-team-session-pending button")
    await eventually(() => !view.host.querySelector(".sf-team-session-pending") &&
      !!view.host.querySelector("[data-sf-prompt-admitted]")?.textContent?.includes("admitted once"))
    expect(sessionRequests(view).filter((request) => request.method === "POST")).toHaveLength(2)
    expect(view.requests.some((request) => new URL(request.url).pathname.endsWith("/history") && request.method === "GET")).toBe(true)
    view.click("[data-sf-sign-out]")
    await eventually(() => view.state() === "unauthenticated")
    expect(window.location.pathname).toBe("/")
    expect(window.location.search).toBe("")
    expect(window.location.hash).toBe("")
    expect(view.host.querySelector("[data-sf-session-workspace]")).toBeNull()
    expect(view.host.textContent).not.toContain("admitted once")
    const login = view.host.querySelector<HTMLAnchorElement>("main a")
    expect(login).not.toBeNull()
    expect(new URL(login!.href).searchParams.get("returnTo")).toBe("/")
  } finally { view.close() }
}, 15000)

test("revocation scrubs the real transcript and draft while retaining the explicit refused Team and session URL", async () => {
  const id = Session.ID.create(), view = mount(href(a, id))
  view.rows.set(view.key(a, id), view.info(a, id, "Private server title"))
  view.messages.set(view.key(a, id), [Schema.encodeSync(SessionMessage.User)(Schema.decodeUnknownSync(SessionMessage.User)({
    type: "user", id: SessionMessage.ID.create(), text: "Private server transcript", time: { created: 1 },
  }))])
  try {
    await eventually(() => view.ready() && !!view.host.querySelector("[data-sf-message-id]"))
    view.write("private unsent draft")
    const original = view.context(a)
    const { team: removed, ...stamp } = original.value.stamp
    expect(removed).toBeDefined()
    view.setHook(async (request) => new URL(request.url).pathname === binding.mount + "/api/ui/context"
      ? json({ ...original, value: { ...original.value, stamp, profile: { ...original.value.profile, teams: { status: "revoked" } } } })
      : undefined)
    view.refresh()
    await eventually(() => view.state() === "authenticated" && view.selected() === null)
    expect(view.host.querySelector("[data-sf-session-workspace]")).toBeNull()
    expect(view.host.textContent).not.toContain("Private server transcript")
    expect(view.host.textContent).not.toContain("private unsent draft")
    expect(view.host.textContent).not.toContain("Private server title")
    expect(window.location.href).toBe(href(a, id))
    view.refresh()
    await eventually(() => view.state() === "authenticated" && view.selected() === null)
    expect(window.location.href).toBe(href(a, id))
  } finally { view.close() }
}, 15000)

test("late private HTTP data cannot reappear after the current principal changes", async () => {
  const id = Session.ID.create(), view = mount(href(a, id))
  view.rows.set(view.key(a, id), view.info(a, id, "Old principal title"))
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let held = false
  view.setHook(async (request) => {
    if (held || !new URL(request.url).pathname.endsWith("/message")) return undefined
    held = true
    const namespace = view.namespace(a)
    entered.resolve()
    await release.promise
    return json({ namespace, cursor: {}, data: [Schema.encodeSync(SessionMessage.User)(Schema.decodeUnknownSync(SessionMessage.User)({
      type: "user", id: SessionMessage.ID.create(), text: "Late old principal transcript", time: { created: 1 },
    }))] })
  })
  try {
    await entered.promise
    view.setPrincipal(secondPrincipal)
    view.refresh()
    await eventually(() => view.host.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-state") === "unavailable")
    release.resolve()
    await tick(); await tick()
    expect(view.host.textContent).not.toContain("Late old principal transcript")
    expect(view.host.textContent).not.toContain("Old principal title")
    expect(view.host.querySelector("[data-sf-message-id]")).toBeNull()
    expect(view.host.querySelector('[data-component="prompt-input-v2"]')).toBeNull()
  } finally { release.resolve(); view.close() }
}, 15000)


test("a recovered current stream removes the resolved interruption notice and keeps the never-submitted draft", async () => {
  const view = mount()
  const stream = () => view.host.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-stream")
  try {
    await ready(view)
    await eventually(() => stream() === "open")
    view.write("Never submitted during transport recovery")
    view.dropStreams()
    await eventually(() => view.host.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-state") === "unavailable")
    expect(view.host.textContent).toContain("Chat updates stopped. Refresh access before continuing.")
    view.refresh()
    await ready(view)
    await eventually(() => stream() === "open")
    expect(view.editor().textContent).toBe("Never submitted during transport recovery")
    expect(view.host.querySelector("[data-sf-chat-notice]")).toBeNull()
    expect(view.host.textContent).not.toContain("Chat updates stopped. Refresh access before continuing.")
    expect(sessionRequests(view).every((request) => request.method === "GET")).toBe(true)
  } finally { view.close() }
}, 15000)

test("an unavailable transcript keeps its update warning while the event stream is open", async () => {
  const id = Session.ID.create(), view = mount(href(a, id))
  view.rows.set(view.key(a, id), view.info(a, id, "Current chat"))
  const stream = () => view.host.querySelector("[data-sf-session-workspace]")?.getAttribute("data-sf-session-stream")
  try {
    await ready(view)
    await eventually(() => stream() === "open")
    view.setHook(async (request) => new URL(request.url).pathname.endsWith("/message")
      ? json({ error: "Transcript temporarily unavailable" }, 503) : undefined)
    view.emit(a, "session.next.renamed", { sessionID: id, title: "Current chat" }, { aggregateID: id, seq: 1, version: 1 })
    await eventually(() => !!view.host.querySelector("[data-sf-chat-notice]")?.textContent?.includes("Chat updates stopped."))
    expect(view.ready()).toBe(true)
    expect(stream()).toBe("open")
    await tick()
    expect(view.host.querySelector("[data-sf-chat-notice]")?.textContent).toBe("Chat updates stopped. Refresh access before continuing.")
    expect(view.host.querySelector<HTMLButtonElement>('[data-action="prompt-submit"]')?.disabled).toBe(true)
    view.setHook(undefined)
    view.refresh()
    await ready(view)
    await eventually(() => stream() === "open")
    expect(view.host.querySelector("[data-sf-chat-notice]")).toBeNull()
    expect(sessionRequests(view).every((request) => request.method === "GET")).toBe(true)
  } finally { view.close() }
}, 15000)
