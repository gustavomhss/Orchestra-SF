import { expect, test } from "bun:test"
import { Schema } from "effect"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { solidDom } from "../real-ui-solid"

const module: typeof import("../../src/context/team-personal-connections") =
  await import(solidDom("../../src/context/team-personal-connections.ts", import.meta.dir))
const { createTeamPersonalConnections } = module
const strict = { onExcessProperty: "error" } as const
// UI/client contract evidence. Signed-session, Owner, vault ACL and CAS authority
// are exercised by the installed Server tests, never manufactured by these DTOs.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-placement", hostId: "same-host", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({ installationId: binding.installationId, tenantId: binding.tenantId,
  teamObjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
const principal = Schema.decodeUnknownSync(TeamProfile.Principal)({
  tenantId: binding.tenantId, principalObjectId: "11111111-1111-4111-8111-111111111111",
})
const key = Schema.decodeUnknownSync(ConnectionAccess.PersonalKey)({ category: "integration", resourceId: "declared-provider", id: "personal" })
const provider = Schema.decodeUnknownSync(ProviderAccess.Metadata)({
  providerId: "declared", name: "Declared provider", protocol: "openai-chat-completions", connection: key,
  models: [{ id: "declared-model", name: "Declared model", limit: { context: 4096, output: 1024 }, tools: false }],
})
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
function fixture(options: Readonly<{
  storage?: Map<string, string>; windowId?: string; principal?: TeamProfile.Principal; profile?: TeamProfile.Ref;
  persistent?: boolean; blockedStorage?: boolean; providers?: readonly ProviderAccess.Metadata[];
  connection?: ConnectionAccess.Slot;
}> = {}) {
  const previous = window.location.href
  window.location.href = binding.publicOrigin + "/"
  const storage = options.storage ?? new Map<string, string>(), windowId = options.windowId ?? "22222222-2222-4222-8222-222222222222"
  const owner = Schema.decodeUnknownSync(TeamProfile.Owner)({ profile: options.profile ?? profile, principal: options.principal ?? principal })
  const namespace = Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({ version: 1, owner, authorityGeneration: 3 })
  const context = Schema.decodeUnknownSync(SfTeamContext)({
    contractRevision: "sf-team-profile/1", authMode: "microsoft",
    stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
      principalRef: owner.principal.principalObjectId, policyVersion: "ui-only-policy", accessRevision: "ui-only-revision",
      team: { owner, revisions: { configRevision: 2, accessRevision: "ui-only-revision" } } },
    profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: binding.installationId,
      principal: owner.principal, accessRevision: "ui-only-revision", administration: { status: "denied" },
      teams: { status: "ready", selected: owner.profile, configRevision: 2, choices: [{ profile: owner.profile, displayName: "Team" }] } },
    destinations: [], availability: [],
  })
  let generation = 1, consent = true, current = context
  let connection: ConnectionAccess.Slot = options.connection ?? { key, label: "", revision: 0, state: "absent" }
  let hook: ((request: Request) => Promise<Response | undefined>) | undefined
  const calls: Request[] = [], notices: string[] = []
  const fetch: SfTransportFetch = async (url, init) => {
    const request = new Request(url, init), address = new URL(request.url)
    calls.push(request.clone())
    const override = await hook?.(request.clone())
    if (override) return override
    if (address.pathname === binding.mount + "/api/provider/catalog")
      return json({ namespace, providers: options.providers ?? [provider] })
    if (address.pathname !== binding.mount + "/api/connection/personal") throw new Error("Unexpected personal endpoint")
    if (request.method === "GET") return json({ status: "available", namespace, connection })
    const command = Schema.decodeUnknownSync(ConnectionAccess.PersonalCommand, strict)(await request.json())
    if (command.expectedRevision !== connection.revision) return json({ status: "conflict" }, 409)
    connection = Schema.decodeUnknownSync(ConnectionAccess.Metadata)({
      key: command.key, label: command.action === "remove" ? connection.label : command.label,
      revision: connection.revision + 1, state: command.action === "remove" ? "removed" : "active",
    })
    return json({ status: command.action === "remove" ? "removed" : "saved", namespace, connection })
  }
  const input = {
    binding, window: { id: windowId, persistent: options.persistent ?? true, dispose() {} },
    storage: {
      getItem: (name) => storage.get(name) ?? null,
      setItem: (name, value) => { if (options.blockedStorage) throw new Error("Storage unavailable"); storage.set(name, value) },
      removeItem: (name) => { storage.delete(name) },
    },
    context: () => current, generation: () => generation, fetch, confirmDiscard: async () => consent,
    notice: (notice) => { notices.push(notice) },
  } satisfies Parameters<typeof createTeamPersonalConnections>[0]
  const editor = createTeamPersonalConnections(input)
  return { input, editor, calls, notices, storage, windowId, context, namespace, connection: () => connection,
    setConnection: (value: ConnectionAccess.Slot) => { connection = value },
    setHook: (value: typeof hook) => { hook = value }, setConsent: (value: boolean) => { consent = value },
    retire() { generation++; current = structuredClone(context); editor.guard.retire() },
    close() { editor.dispose(); window.location.href = previous },
  }
}

test("a current catalog selects the sole provider and a confirmed personal write clears secret and journal", async () => {
  const f = fixture()
  try {
    expect(await f.editor.open()).toBe(true)
    expect(f.editor.state.providers).toEqual([provider])
    expect(f.editor.state.connection?.state).toBe("absent")
    expect(f.context.profile.administration.status).toBe("denied")
    expect(f.editor.edit("label", "Personal label")).toBe(true)
    expect(f.editor.edit("secret", "synthetic-private-key")).toBe(true)
    expect(await f.editor.submit()).toBe(true)
    expect(f.editor.state.secret).toBe("")
    expect(f.editor.state.message).toBe("sf.teams.personalSaved")
    expect(f.editor.state.canWrite).toBe(false)
    expect(f.storage.size).toBe(0)
    const post = f.calls.find((request) => request.method === "POST")!
    expect(await post.json()).toEqual({ action: "create", key, expectedRevision: 0, label: "Personal label", secret: "synthetic-private-key" })
    expect(f.calls.map((request) => request.url).join(" ")).not.toContain("synthetic-private-key")
    expect(f.editor.edit("secret", "must-read-again")).toBe(false)
    expect(await f.editor.refresh()).toBe(true)
    expect(f.editor.state.canWrite).toBe(true)
  } finally { f.close() }
})

test("provider choice comes only from the observed catalog and an empty catalog does not become unavailable", async () => {
  const second = Schema.decodeUnknownSync(ProviderAccess.Metadata)({ ...provider, providerId: "second", name: "Second",
    connection: { ...key, id: "second-slot" } })
  const f = fixture({ providers: [provider, second] })
  try {
    expect(await f.editor.open()).toBe(true)
    expect(f.editor.state.selected).toBeUndefined()
    expect(await f.editor.choose("manual-provider")).toBe(false)
    expect(f.calls).toHaveLength(1)
    expect(await f.editor.choose(provider.providerId)).toBe(true)
    expect(f.calls).toHaveLength(2)
  } finally { f.close() }
  const empty = fixture({ providers: [] })
  try {
    expect(await empty.editor.open()).toBe(true)
    expect(empty.editor.state.status).toBe("ready")
    expect(empty.editor.state.providers).toEqual([])
    expect(empty.editor.state.connection).toBeUndefined()
    expect(await empty.editor.submit()).toBe(false)
    expect(empty.calls).toHaveLength(1)
  } finally { empty.close() }
})

test("a lost applied POST is not retried or called successful when a later GET matches the new record", async () => {
  const f = fixture()
  try {
    await f.editor.open()
    f.editor.edit("label", "Never journal this label")
    f.editor.edit("secret", "never-journal-this-key")
    f.setHook(async (request) => {
      if (request.method !== "POST") return
      f.setConnection(Schema.decodeUnknownSync(ConnectionAccess.Metadata)({ key, label: "Never journal this label", revision: 1, state: "active" }))
      throw new Error("Synthetic response loss after commit")
    })
    expect(await f.editor.submit()).toBe(false)
    expect(f.editor.state.secret).toBe("")
    expect(f.editor.state.pending).toBe(true)
    expect(f.editor.state.observed).toBe(false)
    const [name, raw] = [...f.storage][0]!
    expect(name).toContain("personal-connection-pending")
    expect(raw).not.toMatch(/never-journal-this-key|Never journal this label|hash|secret|commandId/)
    expect(JSON.parse(raw)).toEqual({ version: 1, owner: f.namespace.owner, windowId: f.windowId,
      key, action: "create", expectedRevision: 0 })
    expect(await f.editor.submit()).toBe(false)
    expect(f.editor.acceptObserved()).toBe(false)
    f.setHook(undefined)
    expect(await f.editor.refresh()).toBe(true)
    expect(f.editor.state.connection?.revision).toBe(1)
    expect(f.editor.state.pending).toBe(true)
    expect(f.editor.state.message).toBe("sf.teams.personalObserved")
    expect(f.notices).not.toContain("sf.teams.personalSaved")
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    expect(f.editor.acceptObserved()).toBe(true)
    expect(f.storage.size).toBe(0)
    f.editor.edit("secret", "new-explicit-key")
    expect(await f.editor.submit()).toBe(true)
    expect(await f.calls.filter((request) => request.method === "POST")[1]!.json()).toMatchObject({ action: "update", expectedRevision: 1, secret: "new-explicit-key" })
  } finally { f.close() }
})

test("pending metadata restores only for the original account, Team and window after admitted GET; drafts never restore", async () => {
  const first = fixture(), storage = first.storage
  try {
    await first.editor.open(); first.editor.edit("secret", "private-draft-never-restored")
    first.setHook(async (request) => request.method === "POST" ? json({ status: "unavailable" }, 503) : undefined)
    expect(await first.editor.submit()).toBe(false)
    first.close()
    const otherPrincipal = Schema.decodeUnknownSync(TeamProfile.Principal)({ ...principal, principalObjectId: "33333333-3333-4333-8333-333333333333" })
    const otherTeam = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, teamObjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
    for (const options of [{ principal: otherPrincipal }, { profile: otherTeam }, { windowId: "44444444-4444-4444-8444-444444444444" }]) {
      const other = fixture({ storage, ...options })
      try {
        await other.editor.open()
        expect(other.editor.state.pending).toBe(false)
        expect(other.editor.state.secret).toBe("")
        expect(other.calls.every((request) => request.method === "GET")).toBe(true)
      } finally { other.close() }
    }
    const restored = fixture({ storage, windowId: first.windowId })
    try {
      expect(await restored.editor.open()).toBe(true)
      expect(restored.editor.state.pending).toBe(true)
      expect(restored.editor.state.message).toBe("sf.teams.personalObserved")
      expect(restored.editor.state.secret).toBe("")
      expect(restored.calls.every((request) => request.method === "GET")).toBe(true)
      expect(storage.size).toBe(1)
    } finally { restored.close() }
  } finally { first.close() }
})

test("denial removes personal state while preserving the current business context", async () => {
  const f = fixture()
  try {
    await f.editor.open(); f.editor.edit("secret", "private-denied-key")
    f.setHook(async (request) => request.method === "POST" ? json({ status: "denied" }, 403) : undefined)
    expect(await f.editor.submit()).toBe(false)
    expect(f.editor.state.status).toBe("denied")
    expect(f.editor.state.secret).toBe("")
    expect(f.editor.state.providers).toEqual([])
    expect(f.editor.state.connection).toBeUndefined()
    expect(f.context.stamp.team?.owner.profile).toEqual(profile)
    expect(f.storage.size).toBe(0)
  } finally { f.close() }
})

test("retirement clears RAM immediately and a late confirmed response cannot repopulate the next owner", async () => {
  const f = fixture(), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<Response>()
  try {
    expect(await f.editor.open()).toBe(true)
    f.editor.edit("label", "Private label"); f.editor.edit("secret", "private-in-flight-key")
    f.setHook(async (request) => { if (request.method === "POST") { entered.resolve(); return release.promise } })
    const write = f.editor.submit()
    await entered.promise
    expect(f.editor.state.secret).toBe("")
    expect(f.editor.guard.pending()).toBe(true)
    expect([...f.storage.values()].join(" ")).not.toMatch(/Private label|private-in-flight-key/)
    f.retire()
    expect(f.editor.state).toMatchObject({ status: "idle", providers: [], label: "", secret: "", pending: false })
    release.resolve(json({ status: "saved", namespace: f.namespace,
      connection: { key, label: "Private label", revision: 1, state: "active" } }))
    expect(await write).toBe(false)
    expect(f.editor.state.connection).toBeUndefined()
    expect(f.storage.size).toBe(1)
    expect(f.notices).not.toContain("sf.teams.personalSaved")
  } finally { f.close() }
})

test("CAS conflict clears the submitted key and requires an explicit fresh read before another change", async () => {
  const f = fixture()
  try {
    await f.editor.open(); f.editor.edit("secret", "stale-key")
    f.setConnection(Schema.decodeUnknownSync(ConnectionAccess.Metadata)({ key, label: "Other writer", revision: 4, state: "active" }))
    expect(await f.editor.submit()).toBe(false)
    expect(f.editor.state.message).toBe("sf.teams.personalConflict")
    expect(f.editor.state.secret).toBe("")
    expect(f.editor.state.canWrite).toBe(false)
    expect(f.storage.size).toBe(0)
    expect(await f.editor.refresh()).toBe(true)
    expect(f.editor.state.connection?.revision).toBe(4)
    expect(f.editor.state.secret).toBe("")
    expect(f.editor.edit("secret", "new-explicit-key")).toBe(true)
    expect(await f.editor.submit()).toBe(true)
  } finally { f.close() }
})

test("storage failure or an ephemeral window prevents dispatch; remove carries no secret", async () => {
  for (const options of [{ blockedStorage: true }, { persistent: false }]) {
    const f = fixture(options)
    try {
      await f.editor.open(); f.editor.edit("secret", "no-dispatch-key")
      expect(await f.editor.submit()).toBe(false)
      expect(f.editor.state.message).toBe("sf.teams.personalJournalUnavailable")
      expect(f.calls.every((request) => request.method === "GET")).toBe(true)
    } finally { f.close() }
  }
  const f = fixture({ connection: Schema.decodeUnknownSync(ConnectionAccess.Metadata)({ key, label: "Saved", revision: 2, state: "active" }) })
  try {
    await f.editor.open()
    expect(await f.editor.submit(true)).toBe(true)
    expect(await f.calls.find((request) => request.method === "POST")!.json()).toEqual({ action: "remove", key, expectedRevision: 2 })
    expect(f.editor.state.message).toBe("sf.teams.personalRemoved")
    expect(f.editor.state.connection?.state).toBe("removed")
  } finally { f.close() }
})

test("unavailable catalog and declined draft discard never erase the distinction between failure and no providers", async () => {
  const f = fixture()
  try {
    f.setHook(async () => json({ status: "unavailable" }, 503))
    expect(await f.editor.open()).toBe(false)
    expect(f.editor.state.status).toBe("unavailable")
    f.setHook(undefined)
    expect(await f.editor.open()).toBe(true)
    f.editor.edit("secret", "keep-this-draft")
    f.setConsent(false)
    const before = f.calls.length
    expect(await f.editor.open()).toBe(false)
    expect(f.editor.state.secret).toBe("keep-this-draft")
    expect(f.calls.length).toBe(before)
  } finally { f.close() }
})

test("the rendered native form uses password input and scrubs its DOM value before the single POST settles", async () => {
  const [page, language, platform] = await Promise.all([
    import(solidDom("../../src/pages/team-personal-connections.tsx", import.meta.dir)),
    import(solidDom("../../src/context/language.tsx", import.meta.dir)),
    import(solidDom("../../src/context/platform.tsx", import.meta.dir)),
  ])
  const { SfTeamPersonalConnections }: typeof import("../../src/pages/team-personal-connections") = page
  const { LanguageProvider }: typeof import("../../src/context/language") = language
  const { PlatformProvider }: typeof import("../../src/context/platform") = platform
  const f = fixture(), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<Response>()
  const mount = document.createElement("div")
  document.body.append(mount)
  let guard: Parameters<Parameters<typeof SfTeamPersonalConnections>[0]["registerDraft"]>[0] | undefined
  f.setHook(async (request) => { if (request.method === "POST") { entered.resolve(); return release.promise } })
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {} },
    get children() { return createComponent(LanguageProvider, { locale: "en",
      get children() { return createComponent(SfTeamPersonalConnections, { ...f.input,
        registerDraft(value) { guard = value; return () => value.retire() },
      }) },
    }) },
  }), mount)
  const wait = async (ready: () => boolean) => {
    const deadline = performance.now() + 2000
    while (!ready()) {
      if (performance.now() >= deadline) throw new Error("Personal native form did not settle")
      await Bun.sleep(1)
    }
  }
  try {
    await wait(() => !!mount.querySelector("[data-sf-personal-secret]"))
    const secret = mount.querySelector<HTMLInputElement>("[data-sf-personal-secret]")!
    const label = mount.querySelector<HTMLInputElement>("[data-sf-personal-label]")!
    expect(secret.type).toBe("password")
    expect(mount.querySelectorAll("select option")).toHaveLength(2)
    expect(mount.textContent).toContain("Declared provider")
    label.value = "Rendered personal label"; label.dispatchEvent(new Event("input", { bubbles: true }))
    secret.value = "synthetic-render-only-key"; secret.dispatchEvent(new Event("input", { bubbles: true }))
    mount.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    await entered.promise
    expect(secret.value).toBe("")
    expect([...f.storage.values()].join(" ")).not.toContain("synthetic-render-only-key")
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    release.resolve(json({ status: "saved", namespace: f.namespace,
      connection: { key, label: "Rendered personal label", revision: 1, state: "active" } }))
    await wait(() => !!mount.querySelector("[data-sf-personal-notice]")?.textContent?.includes("Personal key saved"))
    expect(mount.textContent).toContain("Provider access has not been tested.")
    guard?.retire()
    expect(mount.querySelector("[data-sf-personal-secret]")).toBeNull()
    expect(mount.textContent).not.toContain("Rendered personal label")
  } finally { dispose(); mount.remove(); f.close() }
})
