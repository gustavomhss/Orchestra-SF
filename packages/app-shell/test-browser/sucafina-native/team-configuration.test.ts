import { expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { solidDom } from "../real-ui-solid"

const module: typeof import("../../src/orchestra/chapters/sucafina/local-administration/team-configuration-state") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/local-administration/team-configuration-state.ts", import.meta.dir))
const { createTeamConfigurationState } = module
const strict = { onExcessProperty: "error" } as const

// UI/client contract tests. These response DTOs never mint a server admission;
// the signed OIDC/SQLite/Chromium composition exercises administrative authority.
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
const projection = (actor = principal) => Schema.decodeUnknownSync(SfTeamContext)({
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
  stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    principalRef: actor.principalObjectId, policyVersion: "policy", accessRevision: "ui-only-source" },
  profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: binding.installationId,
    principal: actor, accessRevision: "ui-only-source", administration: { status: "available" }, teams: { status: "no-teams" } },
  destinations: [], availability: [],
})
const document = Schema.decodeUnknownSync(TeamProfile.ConfigurationDocument)({
  version: 1, settings: { model: "provider/model", default_agent: "analyst", agents: {
    analyst: { name: "Analyst", description: "Shared analytical role", system: "Keep the original shared instructions.",
      model: "provider/specific", variant: "careful", mode: "primary", hidden: false, disabled: false },
    reviewer: { system: "Preserve this other agent.", mode: "subagent", hidden: true, disabled: false },
  } },
})
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
function fixture(initial: TeamProfile.ConfigurationDocument | undefined = document, options: Readonly<{
  storage?: Map<string, string>; windowId?: string; principal?: TeamProfile.Principal;
  persistent?: boolean; blockedStorage?: boolean;
}> = {}) {
  const previous = window.location.href
  window.location.href = binding.publicOrigin + "/"
  const storage = options.storage ?? new Map<string, string>()
  const windowId = options.windowId ?? "22222222-2222-4222-8222-222222222222"
  const actor = options.principal ?? principal
  let saved = initial ? structuredClone(initial) : undefined, revision = 7, generation = 1, current = projection(actor)
  let refreshes = 0, confirmations = 0, consent = true
  let hook: ((request: Request) => Promise<Response | undefined>) | undefined
  const calls: Request[] = [], notices: string[] = []
  const fetch: SfTransportFetch = async (address, init) => {
    const request = new Request(address, init), url = new URL(request.url)
    calls.push(request.clone())
    const override = await hook?.(request.clone())
    if (override) return override
    if (url.pathname === binding.mount + "/api/ui/team-profiles")
      return json({ status: "ok", configRevision: revision, profiles: [{ profile, enabled: true }] })
    if (url.pathname !== binding.mount + "/api/ui/team-profiles/configuration") throw new Error("Unexpected configuration URL")
    if (request.method === "GET") return saved ? json({ status: "ok", configuration: {
      origin: "installation-team-store", profile, configRevision: revision, document: saved,
    } }) : json({ status: "not-found" }, 404)
    const command = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand, strict)(await request.json())
    if (command.expectedRevision !== revision) return json({ status: "conflict", configRevision: revision }, 409)
    saved = structuredClone(command.document); revision++
    return json({ status: "ok", configRevision: revision, changed: true })
  }
  const editor = createTeamConfigurationState({
    binding, window: { id: windowId, persistent: options.persistent ?? true, dispose() {} },
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { if (options.blockedStorage) throw new Error("Storage unavailable"); storage.set(key, value) },
      removeItem: (key) => { storage.delete(key) },
    },
    context: () => current, generation: () => generation, fetch,
    confirmDiscard: async () => { confirmations++; return consent },
    refresh: async () => { refreshes++ }, notice: (key) => notices.push(key),
  })
  return { editor, calls, notices, storage, windowId, saved: () => saved, revision: () => revision, context: () => current,
    refreshes: () => refreshes, confirmations: () => confirmations,
    setConsent: (value: boolean) => { consent = value },
    setHook: (value: typeof hook) => { hook = value },
    setSaved: (value: TeamProfile.ConfigurationDocument | undefined, nextRevision = revision) => {
      saved = value ? structuredClone(value) : undefined; revision = nextRevision
    },
    retire() { generation++; current = projection(actor); editor.guard.retire() },
    close() { editor.dispose(); window.location.href = previous },
  }
}

test("an administrator without a selected Team reads shared settings and preserves every untouched field on CAS save", async () => {
  const f = fixture()
  try {
    expect(f.context().stamp.team).toBeUndefined()
    expect(f.context().profile.teams.status).toBe("no-teams")
    expect(await f.editor.open(profile)).toBe(true)
    expect(f.editor.state.document).toEqual(document)
    f.editor.settings("model", "provider/new-model")
    expect(f.editor.guard.dirty()).toBe(true)
    expect(await f.editor.save()).toBe(true)
    const post = f.calls.find((request) => request.method === "POST")!
    expect(await post.json()).toEqual({ profile, expectedRevision: 7,
      document: { ...document, settings: { ...document.settings, model: "provider/new-model" } } })
    expect(f.saved()?.settings.agents).toEqual(document.settings.agents)
    expect(f.revision()).toBe(8)
    expect(f.refreshes()).toBe(1)
    expect(f.editor.guard.dirty()).toBe(false)
    expect(f.calls.every((request) => !request.headers.has("authorization") && !request.headers.has("x-sf-team-profile"))).toBe(true)
    expect([...new URL(f.calls[0]!.url).searchParams.keys()]).toEqual(["contractRevision", "installationId", "tenantId", "teamObjectId"])
    expect([...new URL(post.url).searchParams.keys()]).toEqual(["contractRevision", "installationId", "tenantId"])
  } finally { f.close() }
})

test("a missing document uses a separate current metadata read and never inherits a local default", async () => {
  const f = fixture()
  f.setSaved(undefined, 12)
  try {
    expect(await f.editor.open(profile)).toBe(true)
    expect(f.editor.state.document).toEqual({ version: 1, settings: {} })
    expect(f.editor.state.revision).toBe(12)
    expect(f.calls.map((request) => new URL(request.url).pathname)).toEqual([
      "/sucafina/api/ui/team-profiles/configuration", "/sucafina/api/ui/team-profiles",
    ])
    f.editor.settings("model", "provider/model")
    f.editor.settings("default_agent", "analyst")
    expect(f.editor.addAgent("analyst")).toBe(true)
    f.editor.agentText("analyst", "system", "Shared instructions.")
    expect(await f.editor.save()).toBe(true)
    expect(f.saved()).toEqual({ version: 1, settings: { model: "provider/model",
      default_agent: "analyst", agents: { analyst: { system: "Shared instructions." } } } })
    expect(f.revision()).toBe(13)
  } finally { f.close() }
})

test("a CAS conflict preserves the local draft, requires an explicit fresh read, and never resubmits", async () => {
  const f = fixture()
  try {
    await f.editor.open(profile)
    f.editor.settings("model", "provider/local")
    f.setSaved(document, 8)
    expect(await f.editor.save()).toBe(false)
    expect(f.editor.state.document.settings.model).toBe("provider/local")
    expect(f.editor.state.revision).toBeUndefined()
    expect(f.editor.state.message).toBe("sf.teams.adminConflict")
    expect(await f.editor.save()).toBe(false)
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    f.setConsent(false)
    expect(await f.editor.open(profile)).toBe(false)
    expect(f.editor.state.document.settings.model).toBe("provider/local")
    f.setConsent(true)
    expect(await f.editor.open(profile)).toBe(true)
    expect(f.confirmations()).toBe(2)
    expect(f.editor.state.revision).toBe(8)
    expect(f.editor.state.document).toEqual(document)
  } finally { f.close() }
})

test("a lost write response stays unknown until an explicit GET matches the full submitted configuration", async () => {
  const f = fixture()
  try {
    await f.editor.open(profile)
    f.editor.agentText("analyst", "system", "Updated instructions; retain the other fields.")
    f.setHook(async (request) => {
      if (request.method !== "POST") return
      const command = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)(await request.json())
      f.setSaved(command.document, command.expectedRevision + 1)
      throw new Error("response lost after write")
    })
    expect(await f.editor.save()).toBe(false)
    expect(f.editor.state.pending).toBe(true)
    expect(f.editor.state.message).toBe("sf.teams.configUnknown")
    expect(await f.editor.save()).toBe(false)
    expect(await f.editor.open(profile)).toBe(false)
    f.editor.settings("model", "provider/forbidden-during-unknown")
    expect(f.editor.state.document.settings.model).toBe("provider/model")
    f.setHook(undefined)
    expect(await f.editor.reconcileWrite()).toBe(true)
    expect(f.editor.state.pending).toBe(false)
    expect(f.editor.state.message).toBe("sf.teams.configObserved")
    expect(f.notices).not.toContain("sf.teams.configSaved")
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    expect(f.refreshes()).toBe(1)
    expect(f.editor.guard.dirty()).toBe(false)
  } finally { f.close() }
})

test("a different observed document cannot confirm an unknown write or clear its pending guard", async () => {
  const f = fixture()
  try {
    await f.editor.open(profile)
    f.editor.agentText("analyst", "system", "Local unconfirmed instructions.")
    f.setHook(async (request) => { if (request.method === "POST") throw new Error("connection lost") })
    expect(await f.editor.save()).toBe(false)
    f.setHook(undefined)
    expect(await f.editor.reconcileWrite()).toBe(false)
    expect(f.editor.state.pending).toBe(true)
    expect(f.editor.state.message).toBe("sf.teams.configDifferent")
    expect(f.editor.guard.pending()).toBe(true)
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(1)
    expect(f.refreshes()).toBe(0)
    f.retire()
    expect(f.editor.state.profile).toBeUndefined()
    expect(f.editor.state.document).toEqual({ version: 1, settings: {} })
    expect(f.editor.state.pending).toBe(false)
  } finally { f.close() }
})

test("late read and write responses cannot restore an administratively retired draft", async () => {
  for (const method of ["GET", "POST"] as const) {
    const f = fixture(), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    try {
      if (method === "POST") await f.editor.open(profile)
      f.setHook(async (request) => {
        if (request.method !== method) return
        entered.resolve(); await release.promise
        return method === "GET" ? json({ status: "ok", configuration: {
          origin: "installation-team-store", profile, configRevision: 7, document,
        } }) : json({ status: "ok", configRevision: 8, changed: true })
      })
      const work = method === "GET" ? f.editor.open(profile) : f.editor.save()
      await entered.promise
      f.retire()
      release.resolve()
      expect(await work).toBe(false)
      expect(f.editor.state.status).toBe("idle")
      expect(f.editor.state.document).toEqual({ version: 1, settings: {} })
      expect(f.editor.state.profile).toBeUndefined()
      expect(f.refreshes()).toBe(0)
    } finally { release.resolve(); f.close() }
  }
})

test("revoked administrative authority scrubs the draft before refreshing corporate context", async () => {
  const f = fixture()
  try {
    await f.editor.open(profile)
    f.editor.agentText("analyst", "system", "Private unsaved text.")
    f.setHook(async (request) => request.method === "POST" ? json({ status: "denied" }, 403) : undefined)
    expect(await f.editor.save()).toBe(false)
    expect(f.editor.state.status).toBe("denied")
    expect(f.editor.state.document).toEqual({ version: 1, settings: {} })
    expect(f.editor.state.profile).toBeUndefined()
    expect(f.editor.guard.dirty()).toBe(false)
    expect(f.refreshes()).toBe(1)
  } finally { f.close() }
})

test("invalid agent keys and an over-budget document fail before any configuration mutation", async () => {
  const f = fixture()
  try {
    await f.editor.open(profile)
    for (const id of ["__proto__", "prototype", "constructor", "../shared", "Agent"]) expect(f.editor.addAgent(id)).toBe(false)
    expect(f.editor.state.document).toEqual(document)
    for (let index = 0; index < 5; index++) {
      const id = "large" + index
      expect(f.editor.addAgent(id)).toBe(true)
      f.editor.agentText(id, "system", "x".repeat(16384))
    }
    expect(await f.editor.save()).toBe(false)
    expect(f.editor.state.message).toBe("sf.teams.configInvalid")
    expect(f.calls.filter((request) => request.method === "POST")).toHaveLength(0)
    expect(f.revision()).toBe(7)
  } finally { f.close() }
})

test("reload restores only a pending reference after current admission and GET, never the submitted draft", async () => {
  const first = fixture(), storage = first.storage
  let recorded: TeamProfile.ConfigurationDocument | undefined
  try {
    await first.editor.open(profile)
    first.editor.agentText("analyst", "system", "Do not persist this unsent or uncertain body.")
    first.setHook(async (request) => {
      if (request.method !== "POST") return
      recorded = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)(await request.json()).document
      first.setSaved(recorded, 8)
      throw new Error("response lost after commit")
    })
    expect(await first.editor.save()).toBe(false)
    expect(storage.size).toBe(1)
    const retained = [...storage.values()].join("")
    expect(retained).not.toMatch(/Do not persist|provider\/model|Shared analytical|document"|"settings"|grant|cookie|token/)
    expect(retained).toContain('"documentHash"')
    expect(retained).toContain('"expectedRevision":7')
    first.close()
    const restored = fixture(recorded, { storage, windowId: first.windowId })
    restored.setSaved(recorded, 8)
    try {
      expect(restored.editor.state.document).toEqual({ version: 1, settings: {} })
      expect(restored.editor.state.pending).toBe(false)
      expect(await restored.editor.open(profile)).toBe(true)
      expect(restored.calls.map((request) => request.method)).toEqual(["GET"])
      expect(restored.editor.state.document).toEqual(recorded)
      expect(restored.editor.state.message).toBe("sf.teams.configObserved")
      expect(restored.notices).not.toContain("sf.teams.configSaved")
      expect(restored.editor.state.pending).toBe(false)
      expect(restored.refreshes()).toBe(1)
      expect(storage.size).toBe(0)
    } finally { restored.close() }
  } finally { first.close() }
})

test("a retained uncertain change is invisible to another person or window and remains private after a denial", async () => {
  const first = fixture(), storage = first.storage
  try {
    await first.editor.open(profile)
    first.editor.agentText("analyst", "system", "Original owner only, not a persisted body.")
    first.setHook(async (request) => { if (request.method === "POST") throw new Error("response lost") })
    expect(await first.editor.save()).toBe(false)
    first.close()
    const otherPrincipal = Schema.decodeUnknownSync(TeamProfile.Principal)({
      tenantId: binding.tenantId, principalObjectId: "33333333-3333-4333-8333-333333333333",
    })
    for (const options of [
      { storage, windowId: "44444444-4444-4444-8444-444444444444" },
      { storage, windowId: first.windowId, principal: otherPrincipal },
    ]) {
      const other = fixture(document, options)
      try {
        expect(await other.editor.open(profile)).toBe(true)
        expect(other.editor.state.pending).toBe(false)
        expect(other.editor.state.message).toBeUndefined()
        expect(storage.size).toBe(1)
      } finally { other.close() }
    }
    const denied = fixture(document, { storage, windowId: first.windowId })
    denied.setHook(async () => json({ status: "denied" }, 403))
    try {
      expect(await denied.editor.open(profile)).toBe(false)
      expect(denied.editor.state.document).toEqual({ version: 1, settings: {} })
      expect(denied.editor.state.pending).toBe(false)
      expect(denied.editor.state.profile).toBeUndefined()
      expect(storage.size).toBe(1)
    } finally { denied.close() }
    const original = fixture(document, { storage, windowId: first.windowId })
    try {
      expect(await original.editor.open(profile)).toBe(true)
      expect(original.editor.state.pending).toBe(true)
      expect(original.editor.state.message).toBe("sf.teams.configDifferent")
      expect(original.editor.state.document).toEqual(document)
      expect(JSON.stringify(original.editor.state.document)).not.toContain("Original owner only")
      expect(original.calls.map((request) => request.method)).toEqual(["GET"])
    } finally { original.close() }
  } finally { first.close() }
})

test("the whole original command identity must match, and unavailable window storage prevents dispatch", async () => {
  const first = fixture(), storage = first.storage
  try {
    await first.editor.open(profile)
    first.editor.settings("model", "provider/new")
    first.setHook(async (request) => {
      if (request.method !== "POST") return
      first.setSaved(Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)(await request.json()).document, 8)
      throw new Error("response lost")
    })
    expect(await first.editor.save()).toBe(false)
    const [key, raw] = [...storage][0]!
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") throw new Error("Pending metadata required")
    storage.set(key, JSON.stringify({ ...value, identity: "0".repeat(64) }))
    first.close()
    const restored = fixture(first.saved(), { storage, windowId: first.windowId })
    restored.setSaved(first.saved(), 8)
    try {
      expect(await restored.editor.open(profile)).toBe(true)
      expect(restored.editor.state.pending).toBe(true)
      expect(restored.editor.state.message).toBe("sf.teams.configDifferent")
      expect(await restored.editor.reconcileWrite()).toBe(false)
      expect(restored.calls.every((request) => request.method === "GET")).toBe(true)
      expect(storage.size).toBe(1)
    } finally { restored.close() }
  } finally { first.close() }
  for (const options of [{ blockedStorage: true }, { persistent: false }]) {
    const blocked = fixture(document, options)
    try {
      await blocked.editor.open(profile)
      blocked.editor.settings("model", "provider/new")
      expect(await blocked.editor.save()).toBe(false)
      expect(blocked.editor.state.pending).toBe(false)
      expect(blocked.editor.state.message).toBe("sf.teams.configJournalUnavailable")
      expect(blocked.calls.every((request) => request.method === "GET")).toBe(true)
      expect(blocked.saved()).toEqual(document)
    } finally { blocked.close() }
  }
})
