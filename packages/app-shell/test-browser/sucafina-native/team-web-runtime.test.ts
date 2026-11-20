import { expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContextResult, SfTeamInstallationDescriptor, type SfEditScopeKey, type SfIntentRef } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { solidDom } from "../real-ui-solid"

const runtimeModule: typeof import("../../src/context/team-profile-runtime") = await import(solidDom("../../src/context/team-profile-runtime.ts", import.meta.dir))
const { createTeamWebRuntime } = runtimeModule
const routes: typeof import("../../src/orchestra/chapters/sucafina/host/team-route") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/host/team-route.ts", import.meta.dir))
const { sfTeamContextHref, sfTeamAdministrationHref, readSfTeamWebRoute } = routes
const ownerModule: typeof import("../../src/orchestra/chapters/sucafina/navigation-state/owner") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/navigation-state/owner.ts", import.meta.dir))

// UI/transport contracts only. The production Web composition has a separate
// Chromium + signed OIDC + SQLite test and never accepts these fixture DTOs as proof.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "same-physical-project", hostId: "same-host", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = (teamObjectId: string) => Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId,
})
const a = profile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), b = profile("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
const principal = Schema.decodeUnknownSync(TeamProfile.Principal)({
  tenantId: binding.tenantId, principalObjectId: "11111111-1111-4111-8111-111111111111",
})
const href = (path: string, team = a) => path + "?" + new URLSearchParams({
  contractRevision: "sf-team-profile/1", server: binding.publicOrigin, installationId: binding.installationId,
  tenantId: binding.tenantId, teamObjectId: team.teamObjectId,
})
function fixture(options: Readonly<{ teams?: readonly TeamProfile.Ref[]; admin?: boolean; initial?: string }> = {}) {
  const previousUrl = window.location.href
  window.location.href = binding.publicOrigin + "/"
  const state = {
    teams: options.teams ?? [a, b], admin: options.admin ?? true, rights: true, signedIn: true,
    reason: undefined as TeamProfile.UnavailableReason | undefined, revision: "ui-fixture-revision",
  }
  let location = options.initial ?? "/", confirmations = 0, broadcasts = 0, closed = 0
  let consent: () => Promise<boolean> = async () => true
  let hook: ((kind: string, teamId: string | null) => Promise<void>) | undefined
  let logout: () => Promise<Response> = async () => new Response(null, { status: 204 })
  let resource: (() => Promise<Response>) | undefined
  let broadcastEffect: ((reason: "logout" | "revoked" | "principal-change") => void) | undefined
  const broadcastReasons: string[] = []
  const calls: { path: string; kind: string | null; team: string | null; init?: RequestInit }[] = []
  const notices: string[] = [], commits: string[] = [], storage = new Map<string, string>()
  const projection = (kind: string, id: string | null): SfTeamContextResult => {
    if (!state.signedIn) return { status: "unauthenticated" }
    const selected = kind === "team" ? state.teams.find((team) => team.teamObjectId === id) :
      kind === "selection" && state.teams.length === 1 ? state.teams[0] : undefined
    const teams = state.reason ? { status: "unavailable", reason: state.reason } :
      selected ? { status: "ready", selected, configRevision: 2,
        choices: state.teams.map((team) => ({ profile: team, displayName: "Same name" })) } :
      kind === "team" ? { status: "revoked" } : !state.teams.length || kind === "administration" ? { status: "no-teams" } :
      { status: "selection-required", choices: state.teams.map((team) => ({ profile: team, displayName: "Same name" })) }
    const accessRevision = state.revision + ":" + (selected?.teamObjectId ?? kind)
    const team = selected && state.rights && !state.reason ?
      { owner: { profile: selected, principal }, revisions: { configRevision: 2, accessRevision } } : undefined
    return Schema.decodeUnknownSync(SfTeamContextResult)({ status: "ok", value: {
      contractRevision: "sf-team-profile/1", authMode: "microsoft",
      stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        principalRef: principal.principalObjectId, policyVersion: "policy", accessRevision, ...(team ? { team } : {}) },
      profile: { contractRevision: "sf-team-profile/1", status: "authenticated",
        installationId: binding.installationId, principal, accessRevision,
        administration: { status: state.admin ? "available" : "denied" }, teams },
      destinations: [], availability: team ? [{ family: "domain-read", resource: "home", state: "ready",
        operations: [{ operationId: "projection.home", state: "ready", reason: null, operational: true }] }] : [],
    } })
  }
  const fetch: SfTransportFetch = async (raw, init) => {
    const url = new URL(raw), kind = url.searchParams.get("kind"), team = url.searchParams.get("teamObjectId")
    calls.push({ path: url.pathname, kind, team, init })
    if (url.pathname.endsWith("/auth/logout")) return logout()
    if (url.pathname !== binding.mount + "/api/ui/context") {
      if (resource) return resource()
      throw new Error("Unexpected UI wire request: " + url.pathname)
    }
    const body = projection(kind ?? "", team)
    await hook?.(kind ?? "", team)
    return new Response(JSON.stringify(body), { status: body.status === "unauthenticated" ? 401 : 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
  }
  const runtime = createTeamWebRuntime({
    binding, window: { id: crypto.randomUUID(), persistent: true, dispose: () => undefined }, fetch,
    storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) },
      removeItem: (key) => { storage.delete(key) } },
    currentHref: () => location, commitHref: (value) => { commits.push(value); location = value },
    confirmDiscard: async () => { confirmations++; return consent() }, closeConsent: () => { closed++ },
    notice: (key) => notices.push(key), broadcast: (reason) => { broadcasts++; broadcastReasons.push(reason); broadcastEffect?.(reason) },
  })
  const draft = () => {
    const ready = runtime.owner.ready()
    if (!ready) throw new Error("Actual native owner required before acquiring a UI draft")
    // These are local UI edit discriminators, never a server handle or authority.
    return ready.drafts.acquire({ surfaceId: "UI33", identity: { kind: "new", newIntentRef: "native-edit" as SfIntentRef },
      editScopeKey: "ui-edit" as SfEditScopeKey, baseVersion: null, base: null, value: { objective: "private A" },
      revalidation: { operationId: "projection.cases", input: {}, fieldPaths: ["objective"], actionIds: [] } })
  }
  return { runtime, state, calls, notices, commits, storage, draft, broadcastReasons,
    setResource: (value: typeof resource) => { resource = value },
    setBroadcast: (value: typeof broadcastEffect) => { broadcastEffect = value },
    selected: () => runtime.current()?.context.stamp.team?.owner.profile.teamObjectId,
    confirmations: () => confirmations, broadcasts: () => broadcasts, closed: () => closed,
    setConsent: (value: typeof consent) => { consent = value },
    setHook: (value: typeof hook) => { hook = value }, setLogout: (value: typeof logout) => { logout = value },
    close() { runtime.dispose(); window.location.href = previousUrl },
  }
}
test("a real F02 client binds a sole Team before a native business view can open", async () => {
  const f = fixture({ teams: [a] })
  try {
    await f.runtime.start()
    expect(f.selected()).toBe(a.teamObjectId)
    expect(f.calls.map((call) => call.kind)).toEqual(["selection", "team"])
    expect(f.runtime.owner.ready()).toBeDefined()
    expect(await f.runtime.navigate(href("/orchestra/sf-home"))).toBe("committed")
    expect(f.runtime.view.kind).toBe("business")
    expect(f.runtime.view.route?.ownerSelection.team).toEqual(a)
    expect(f.commits[0]).not.toContain("project=")
    expect(f.calls.every((call) => new Headers(call.init?.headers).get("Authorization") === null)).toBe(true)
  } finally { f.close() }
})
test("zero Teams and a failed Team provider retain independent native administration without business access", async () => {
  for (const reason of [undefined, "provider-unavailable"] as const) {
    const f = fixture({ teams: [] })
    try {
      f.state.reason = reason
      await f.runtime.start()
      expect(f.runtime.state().status).toBe("authenticated")
      expect(f.runtime.owner.ready()).toBeUndefined()
      expect(await f.runtime.navigate(sfTeamAdministrationHref(binding))).toBe("committed")
      expect(f.runtime.view.kind).toBe("administration")
      expect(f.runtime.current()?.context.profile.administration.status).toBe("available")
      expect(f.calls.some((call) => call.kind === "team")).toBe(false)
    } finally { f.close() }
  }
})
test("multiple equal labels remain unselected until the complete Team reference is chosen", async () => {
  const f = fixture()
  try {
    await f.runtime.start()
    expect(f.selected()).toBeUndefined()
    expect(f.runtime.owner.ready()).toBeUndefined()
    expect(await f.runtime.choose(b)).toBe("selected")
    expect(f.selected()).toBe(b.teamObjectId)
    expect(f.commits.at(-1)).toContain("teamObjectId=" + b.teamObjectId)
    expect(f.broadcasts()).toBe(0)
  } finally { f.close() }
})
test("cancelled profile switching preserves the actual private draft and owner", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") })
  try {
    await f.runtime.start()
    const draft = f.draft(), original = f.runtime.owner.ready()
    f.setConsent(async () => false)
    expect(await f.runtime.choose(b)).toBe("kept-editing")
    expect(f.runtime.owner.ready()).toBe(original)
    expect(draft.snapshot()).toMatchObject({ availability: "active", value: { objective: "private A" } })
    expect(f.confirmations()).toBe(1)
    expect(f.commits).toEqual([])
  } finally { f.close() }
})
test("confirmed profile switching retires the original registry before exposing the second Team", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") })
  try {
    await f.runtime.start()
    const draft = f.draft()
    expect(await f.runtime.choose(b)).toBe("selected")
    expect(draft.snapshot().availability).toBe("revoked")
    expect(f.selected()).toBe(b.teamObjectId)
    expect(f.runtime.owner.hasDirtyDrafts()).toBe(false)
    expect(f.broadcasts()).toBe(0)
  } finally { f.close() }
})
test("changed source authority after discard consent prevents landing and purges the old draft", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") })
  try {
    await f.runtime.start()
    const draft = f.draft()
    f.setConsent(async () => { f.state.revision = "changed"; return true })
    expect(await f.runtime.navigate(sfTeamAdministrationHref(binding))).toBe("denied")
    expect(f.runtime.owner.ready()).toBeUndefined()
    expect(draft.snapshot().availability).toBe("revoked")
    expect(f.commits).toEqual([])
    expect(f.broadcasts()).toBe(1)
  } finally { f.close() }
})
test("observing removed business rights on refresh purges retained private edits", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") })
  try {
    await f.runtime.start()
    const draft = f.draft()
    f.state.rights = false
    await f.runtime.refresh()
    expect(f.runtime.state().status).toBe("authenticated")
    expect(f.runtime.owner.ready()).toBeUndefined()
    expect(draft.snapshot().availability).toBe("revoked")
    expect(f.notices).toContain("sf.teams.revokedDrafts")
  } finally { f.close() }
})
test("logout scrubs the UI immediately while the actual one-shot remote logout is unconfirmed", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") })
  const remote = Promise.withResolvers<Response>()
  try {
    await f.runtime.start()
    const draft = f.draft()
    f.setLogout(() => remote.promise)
    const pending = f.runtime.logout()
    expect(f.runtime.current()).toBeUndefined()
    expect(f.runtime.owner.ready()).toBeUndefined()
    expect(draft.snapshot().availability).toBe("revoked")
    expect(f.broadcasts()).toBe(1)
    remote.resolve(new Response(null, { status: 503 }))
    await pending
    expect(f.runtime.state()).toEqual({ status: "unauthenticated" })
    expect(f.notices).toContain("sf.teams.actionFailed")
    const calls = f.calls.filter((call) => call.path.endsWith("/auth/logout"))
    expect(calls).toHaveLength(1)
    expect(new Headers(calls[0]!.init?.headers).has("x-sf-team-profile")).toBe(false)
  } finally { remote.resolve(new Response(null, { status: 503 })); f.close() }
})
test("a late old F02 response cannot republish a native owner after forced invalidation", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") }), wait = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>()
  try {
    await f.runtime.start()
    f.setHook(async () => { entered.resolve(); await wait.promise })
    const pending = f.runtime.refresh()
    await entered.promise
    f.runtime.invalidate()
    wait.resolve()
    await pending
    expect(f.runtime.current()).toBeUndefined()
    expect(f.runtime.owner.ready()).toBeUndefined()
    expect(f.runtime.view.kind).not.toBe("business")
  } finally { wait.resolve(); f.close() }
})
test("legacy Project URLs, mixed owners and foreign origins never become Team intents", () => {
  expect(readSfTeamWebRoute("/", binding)).toEqual({ kind: "context" })
  expect(readSfTeamWebRoute(sfTeamContextHref(binding), binding)).toEqual({ kind: "context" })
  expect(readSfTeamWebRoute(href("/orchestra/sf-home"), binding)).toMatchObject({ kind: "business", profile: a })
  for (const candidate of [
    "/orchestra/sf-home?server=" + binding.publicOrigin + "&project=same-physical-project&installation=installation-one",
    href("/orchestra/sf-home") + "&project=same-physical-project",
    href("/orchestra/sf-home") + "&tenantId=" + binding.tenantId,
    "https://foreign.test" + href("/orchestra/sf-home"),
    sfTeamAdministrationHref(binding) + "&teamObjectId=" + a.teamObjectId,
    href("/orchestra/sf-home").replace("sf-team-profile%2F1", "sf-native-ui%2F1"),
  ]) expect(readSfTeamWebRoute(candidate, binding)).toEqual({ kind: "invalid" })
})

test("a delayed denial from the former Team never invalidates the successor native owner", async () => {
  const f = fixture({ initial: href("/orchestra/sf-home/context") })
  const reply = Promise.withResolvers<Response>()
  try {
    await f.runtime.start()
    f.setResource(() => reply.promise)
    const request = f.runtime.fetch(binding.publicOrigin + binding.mount + "/api/ui/pages/UI29", {
      headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: a }) },
    })
    expect(await f.runtime.choose(b)).toBe("selected")
    const current = f.runtime.owner.ready()
    reply.resolve(new Response(null, { status: 403 }))
    await request
    expect(f.selected()).toBe(b.teamObjectId)
    expect(f.runtime.owner.ready()).toBe(current)
    expect(f.broadcastReasons).toEqual([])
    f.setResource(async () => new Response(null, { status: 403 }))
    await f.runtime.fetch(binding.publicOrigin + binding.mount + "/api/ui/pages/UI29", {
      headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: b }) },
    })
    expect(f.runtime.owner.ready()).toBeUndefined()
    expect(f.broadcastReasons).toEqual(["revoked"])
  } finally { reply.resolve(new Response(null, { status: 403 })); f.close() }
})
test("a peer logout fences automatic refresh while the original cookie logout is still pending", async () => {
  const first = fixture({ initial: href("/orchestra/sf-home/context") })
  const peer = fixture({ initial: href("/orchestra/sf-home/context", b) })
  const reply = Promise.withResolvers<Response>()
  let pending: Promise<void> | undefined
  try {
    await first.runtime.start(); await peer.runtime.start()
    const draft = peer.draft()
    first.setLogout(() => reply.promise)
    first.setBroadcast((reason) => peer.runtime.invalidate(reason))
    const reads = peer.calls.length
    pending = first.runtime.logout()
    expect(first.broadcastReasons).toEqual(["logout"])
    expect(peer.runtime.state().status).toBe("unauthenticated")
    expect(peer.runtime.owner.ready()).toBeUndefined()
    expect(draft.snapshot()).toEqual({ availability: "revoked", reason: "logout" })
    await peer.runtime.refresh()
    await peer.runtime.start()
    expect(await peer.runtime.resetSelection()).toBe(false)
    peer.runtime.invalidate("revoked")
    expect(peer.calls.length).toBe(reads)
    expect(peer.runtime.state().status).toBe("unauthenticated")
    reply.resolve(new Response(null, { status: 204 }))
    await pending
    expect(peer.runtime.state().status).toBe("unauthenticated")
    expect(peer.storage.size).toBe(0)
  } finally {
    reply.resolve(new Response(null, { status: 204 }))
    await pending
    peer.close(); first.close()
  }
})

test("native menu snapshots the reactive Team owner without accepting extra wire fields", async () => {
  const f = fixture()
  try {
    await f.runtime.start()
    expect(await f.runtime.choose(a)).toBe("selected")
    const state = f.runtime.owner.state()
    if (state.status !== "ready") throw new Error("Reactive owner must be ready")
    expect(ownerModule.sfOwnerQuery(state.selection)).toEqual({
      contractRevision: "sf-team-profile/1", server: binding.publicOrigin,
      installationId: a.installationId, tenantId: a.tenantId, teamObjectId: a.teamObjectId,
    })
    for (const team of [{ ...a, principal: principal.principalObjectId },
      Schema.decodeUnknownSync(TeamProfile.Ref)({ ...a, installationId: "foreign" })]) {
      expect(() => ownerModule.sfOwnerQuery({ ...state.selection, team })).toThrow("SF_OWNER_SELECTOR_MISMATCH")
    }
  } finally { f.close() }
})

test("Session 403 scrubs chat without retiring still-admitted business context", async () => {
  const f = fixture({ teams: [a] })
  try {
    await f.runtime.start()
    const original = f.runtime.current()
    expect(original?.context.stamp.team).toBeDefined()
    expect(f.calls.filter((call) => call.path.endsWith("/api/session"))).toEqual([])
    f.setResource(async () => Response.json({ error: "denied" }, { status: 403, headers: { "cache-control": "no-store" } }))
    const target = routes.sfTeamSessionHref(binding, a)
    expect(await f.runtime.navigate(target)).toBe("unavailable")
    expect(f.runtime.view.kind).toBe("session")
    expect(f.runtime.sessions.state.status).toBe("unavailable")
    expect(f.runtime.sessions.state.threads).toEqual({})
    expect(f.runtime.current()).toBe(original)
    expect(f.runtime.owner.ready()).toBeDefined()
    expect(f.broadcasts()).toBe(0)
    expect(f.calls.filter((call) => call.path.endsWith("/api/session"))).toHaveLength(1)
    expect(f.calls.every((call) => (call.init?.method ?? "GET") === "GET")).toBe(true)
    expect(await f.runtime.navigate(href("/orchestra/sf-home"))).toBe("committed")
    expect(f.runtime.view.kind).toBe("business")
  } finally { f.close() }
})
