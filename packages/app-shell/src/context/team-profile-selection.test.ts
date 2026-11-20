import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTransport } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createTeamProfileSelection, type TeamProfileRetirement } from "./team-profile-selection"

// Deterministic UI projection contracts. These DTOs are not Microsoft login,
// membership or server-authority evidence; signed OIDC/SQLite is tested by G02.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "same-physical-project", hostId: "same-host", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = (id: string) => Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: id,
})
const a = profile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
const b = profile("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
const p1 = Schema.decodeUnknownSync(TeamProfile.Principal)({ tenantId: binding.tenantId,
  principalObjectId: "11111111-1111-4111-8111-111111111111" })
const p2 = Schema.decodeUnknownSync(TeamProfile.Principal)({ tenantId: binding.tenantId,
  principalObjectId: "22222222-2222-4222-8222-222222222222" })
const gate = <Value>() => {
  let resolve: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((done) => { resolve = done })
  return { promise, resolve }
}
function fixture(input: Readonly<{
  choices?: readonly TeamProfile.Ref[]
  admin?: boolean
  rights?: boolean
  principal?: TeamProfile.Principal
}> = {}) {
  const state = { choices: input.choices ?? [a, b], principal: input.principal ?? p1,
    admin: input.admin ?? false, rights: input.rights ?? true, reason: undefined as TeamProfile.UnavailableReason | undefined,
    denied: false, signedIn: true, revision: "effective-source-revision", label: "Same label" }
  const calls: TeamProfile.Selector[] = [], retirements: TeamProfileRetirement[] = []
  let broadcasts = 0, discards = 0, confirmations = 0, dirty = false, discardable = true
  let confirm: () => Promise<boolean> = async () => true
  let hook: ((selector: TeamProfile.Selector) => Promise<void>) | undefined
  let override: unknown
  const restores: TeamProfile.Principal[] = []
  let hint: TeamProfile.Ref | undefined
  const result = (selector: TeamProfile.Selector): SfTeamContextResult => {
    if (!state.signedIn) return { status: "unauthenticated" }
    if (state.denied) return { status: "denied" }
    const selected = selector.kind === "team" ? state.choices.find((x) => x.teamObjectId === selector.profile.teamObjectId) :
      state.choices.length === 1 ? state.choices[0] : undefined
    const teams = state.reason ? { status: "unavailable", reason: state.reason } :
      selected ? { status: "ready", choices: state.choices.map((x) => ({ profile: x, displayName: state.label })),
        selected, configRevision: 7 } :
      selector.kind === "team" ? { status: "revoked" } :
      state.choices.length === 0 ? { status: "no-teams" } :
      { status: "selection-required", choices: state.choices.map((x) => ({ profile: x, displayName: state.label })) }
    const accessRevision = state.revision + ":" + (selected?.teamObjectId ?? "unselected")
    const team = selected && state.rights && !state.reason ? { owner: { profile: selected, principal: state.principal },
      revisions: { configRevision: 7, accessRevision } } : undefined
    return Schema.decodeUnknownSync(SfTeamContextResult)({ status: "ok", value: {
      contractRevision: "sf-team-profile/1", authMode: "microsoft",
      stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        principalRef: state.principal.principalObjectId, policyVersion: "policy-v1", accessRevision, ...(team ? { team } : {}) },
      profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: binding.installationId,
        principal: state.principal, accessRevision, administration: { status: state.admin ? "available" : "denied" }, teams },
      destinations: [], availability: [],
    } })
  }
  const controller = createTeamProfileSelection({
    binding,
    read: async (selector, signal, generation, currentGeneration) => {
      calls.push(structuredClone(selector))
      const projected = override === undefined ? result(selector) : override
      await hook?.(selector)
      const transport = createSfTransport({ binding, teamSelector: selector, generation, currentGeneration,
        operations: SfNativeOperationBindings, fetch: async () => { throw new Error("No business request belongs in this UI contract fixture") } })
      return { result: projected, transport }
    },
    hasDirtyDrafts: () => dirty,
    confirmDiscard: async () => { confirmations++; return confirm() },
    discardDrafts: () => { if (!discardable) return false; discards++; dirty = false; return true },
    retire: (reason) => { retirements.push(reason) },
    accept: async (_context, _transport, _generation, signal) => !signal.aborted,
    broadcast: () => { broadcasts++ },
    restore: (principal) => { restores.push(principal); return hint },
    remember: () => true,
  })
  return { controller, state, calls, retirements, restores, result,
    broadcasts: () => broadcasts, discards: () => discards, confirmations: () => confirmations,
    setDirty: (value: boolean) => { dirty = value }, setDiscardable: (value: boolean) => { discardable = value },
    setConfirm: (value: typeof confirm) => { confirm = value }, setHook: (value: typeof hook) => { hook = value },
    setOverride: (value: unknown) => { override = value }, setHint: (value: TeamProfile.Ref) => { hint = value } }
}
const selectedId = (f: ReturnType<typeof fixture>) => {
  const value = f.controller.state()
  return value.status === "authenticated" && value.context.profile.teams.status === "ready" ?
    value.context.profile.teams.selected.teamObjectId : undefined
}

describe("one window's Teams selection uses complete server projections", () => {
  test("zero Teams remains authenticated with independent administration and no business binding", async () => {
    const f = fixture({ choices: [], admin: true, rights: false })
    try {
      await f.controller.start()
      const state = f.controller.state()
      expect(state.status).toBe("authenticated")
      if (state.status !== "authenticated") throw new Error("authenticated state required")
      expect(state.context.profile.teams).toEqual({ status: "no-teams" })
      expect(state.context.profile.administration.status).toBe("available")
      expect(state.context.stamp.team).toBeUndefined()
      expect(f.calls.map((x) => x.kind)).toEqual(["selection"])
    } finally { f.controller.dispose() }
  })
  test("only the server-selected sole Team opens a second Team-bound context transport", async () => {
    const f = fixture({ choices: [a] })
    try {
      await f.controller.start()
      expect(selectedId(f)).toBe(a.teamObjectId)
      expect(f.calls.map((x) => x.kind)).toEqual(["selection", "team"])
      expect(f.calls[1]).toEqual({ contractRevision: "sf-team-profile/1", kind: "team", profile: a })
    } finally { f.controller.dispose() }
  })
  test("multiple Teams and duplicate names never choose the first option", async () => {
    const f = fixture()
    try {
      await f.controller.start()
      expect(selectedId(f)).toBeUndefined()
      expect(f.calls).toHaveLength(1)
      expect(await f.controller.select(b)).toBe("selected")
      expect(selectedId(f)).toBe(b.teamObjectId)
      f.state.label = "Renamed"
      await f.controller.refresh()
      expect(selectedId(f)).toBe(b.teamObjectId)
      expect(f.broadcasts()).toBe(0)
    } finally { f.controller.dispose() }
  })
  test("Graph failures and complete empty results stay distinct while administration remains available", async () => {
    for (const reason of ["consent-required", "forbidden", "incomplete", "provider-unavailable"] as const) {
      const f = fixture({ admin: true })
      try {
        f.state.reason = reason
        await f.controller.start()
        const state = f.controller.state()
        expect(state.status).toBe("authenticated")
        if (state.status !== "authenticated") throw new Error("authenticated state required")
        expect(state.context.profile.teams).toEqual({ status: "unavailable", reason })
        expect(state.context.profile.administration.status).toBe("available")
        expect(state.context.stamp.team).toBeUndefined()
        expect(f.calls).toHaveLength(1)
      } finally { f.controller.dispose() }
    }
  })
  test("a restored hint is considered only under the newly authenticated principal and must be eligible", async () => {
    const f = fixture({ principal: p2 })
    try {
      f.setHint(profile("cccccccc-cccc-4ccc-8ccc-cccccccccccc"))
      await f.controller.start()
      expect(f.restores).toEqual([p2])
      expect(selectedId(f)).toBeUndefined()
      expect(f.calls).toHaveLength(1)
      f.setHint(b)
      await f.controller.start()
      expect(selectedId(f)).toBe(b.teamObjectId)
    } finally { f.controller.dispose() }
  })
  test("malformed, partial and cross-host projections cannot reach the accepted context", async () => {
    for (const change of ["host", "tenant", "partial", "claimedGrant"] as const) {
      const f = fixture({ choices: [a] })
      try {
        const raw = f.result({ contractRevision: "sf-team-profile/1", kind: "selection",
          installationId: binding.installationId, tenantId: binding.tenantId })
        if (raw.status !== "ok") throw new Error("fixture context required")
        const value = change === "host" ? { ...raw.value, stamp: { ...raw.value.stamp, hostId: "foreign" } } :
          change === "tenant" ? { ...raw.value, profile: { ...raw.value.profile,
            principal: { ...raw.value.profile.principal, tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } } } :
          change === "partial" ? { ...raw.value, profile: { ...raw.value.profile, teams: { status: "no-teams", choices: [] } } } :
          { ...raw.value, grants: ["caller"] }
        f.setOverride({ status: "ok", value })
        await f.controller.start()
        expect(f.controller.state()).toEqual({ status: "unavailable", reason: "contract-mismatch" })
        expect(f.controller.current()).toBeUndefined()
      } finally { f.controller.dispose() }
    }
  })
  test("voluntary switch cancellation keeps the original owner and does not broadcast", async () => {
    const f = fixture()
    try {
      await f.controller.start(a)
      f.setDirty(true); f.setConfirm(async () => false)
      expect(await f.controller.select(b)).toBe("kept-editing")
      expect(selectedId(f)).toBe(a.teamObjectId)
      expect(f.discards()).toBe(0)
      expect(f.confirmations()).toBe(1)
      expect(f.broadcasts()).toBe(0)
    } finally { f.controller.dispose() }
  })
  test("confirmed switch rechecks both original and target, then retires only this window", async () => {
    const f = fixture()
    try {
      await f.controller.start(a)
      f.setDirty(true)
      expect(await f.controller.select(b)).toBe("selected")
      expect(f.calls.slice(1).map((x) => x.kind === "team" ? x.profile.teamObjectId : x.kind))
        .toEqual([b.teamObjectId, a.teamObjectId, b.teamObjectId, b.teamObjectId])
      expect(f.discards()).toBe(1)
      expect(f.retirements).toContain("profile-change")
      expect(f.broadcasts()).toBe(0)
    } finally { f.controller.dispose() }
  })
  test("an unresolved command cannot be discarded even after confirmation", async () => {
    const f = fixture()
    try {
      await f.controller.start(a)
      f.setDirty(true); f.setDiscardable(false)
      expect(await f.controller.select(b)).toBe("kept-editing")
      expect(selectedId(f)).toBe(a.teamObjectId)
      expect(f.discards()).toBe(0)
    } finally { f.controller.dispose() }
  })
  test("forced logout wins over a pending discard dialog and its late confirmation", async () => {
    const f = fixture(), consent = gate<boolean>(), entered = gate<void>()
    try {
      await f.controller.start(a)
      f.setDirty(true); f.setConfirm(async () => { entered.resolve(); return consent.promise })
      const changing = f.controller.select(b)
      await entered.promise
      f.controller.suspend("logout")
      expect(f.controller.current()).toBeUndefined()
      expect(f.controller.state()).toEqual({ status: "unauthenticated" })
      consent.resolve(true)
      expect(await changing).toBe("aborted")
      expect(f.discards()).toBe(0)
      expect(f.broadcasts()).toBe(1)
      expect(f.calls).toHaveLength(2)
    } finally { consent.resolve(false); f.controller.dispose() }
  })
  test("changed source authority during consent cannot approve the old switch", async () => {
    const f = fixture()
    try {
      await f.controller.start(a)
      f.setDirty(true)
      f.setConfirm(async () => { f.state.revision = "new-effective-revision"; return true })
      expect(await f.controller.select(b)).toBe("denied")
      expect(selectedId(f)).toBe(a.teamObjectId)
      expect(f.discards()).toBe(0)
      expect(f.broadcasts()).toBe(1)
      expect(f.retirements).toContain("revoked")
    } finally { f.controller.dispose() }
  })
  test("a late previous load cannot replace a later failed load", async () => {
    const f = fixture(), waiting = gate<void>(), entered = gate<void>()
    try {
      f.setHook(async (selector) => { if (selector.kind === "team" && selector.profile.teamObjectId === a.teamObjectId) {
        entered.resolve(); await waiting.promise
      } })
      const old = f.controller.start(a)
      await entered.promise
      f.state.signedIn = false
      await f.controller.start(b)
      waiting.resolve()
      await old
      expect(f.controller.state()).toEqual({ status: "unauthenticated" })
      expect(f.controller.current()).toBeUndefined()
    } finally { waiting.resolve(); f.controller.dispose() }
  })
  test("a replacement principal cannot inherit an explicitly selected Team", async () => {
    const f = fixture()
    try {
      await f.controller.start(a)
      f.state.principal = p2
      await f.controller.refresh()
      const state = f.controller.state()
      expect(state.status).toBe("authenticated")
      if (state.status !== "authenticated") throw new Error("authenticated state required")
      expect(state.context.profile.principal).toEqual(p2)
      expect(state.context.profile.teams.status).toBe("selection-required")
      expect(state.context.stamp.team).toBeUndefined()
      expect(f.broadcasts()).toBe(1)
    } finally { f.controller.dispose() }
  })
  test("two windows may select different Teams without changing each other's generation", async () => {
    const first = fixture(), second = fixture()
    try {
      await first.controller.start(a); await second.controller.start(b)
      const secondGeneration = second.controller.generation()
      await first.controller.select(b)
      expect(selectedId(first)).toBe(b.teamObjectId)
      expect(selectedId(second)).toBe(b.teamObjectId)
      expect(second.controller.generation()).toBe(secondGeneration)
      expect(first.broadcasts()).toBe(0)
      second.controller.suspend("revoked", false)
      expect(first.controller.current()).toBeDefined()
      expect(second.controller.current()).toBeUndefined()
    } finally { first.controller.dispose(); second.controller.dispose() }
  })
  test("the published context and Team ref cannot be retargeted by caller mutation", async () => {
    const f = fixture({ choices: [a] })
    try {
      await f.controller.start()
      const current = f.controller.current()
      expect(current).toBeDefined()
      expect(Object.isFrozen(current!.context)).toBe(true)
      expect(Object.isFrozen(current!.context.stamp.team!.owner.profile)).toBe(true)
      expect(Object.isFrozen(f.controller.binding)).toBe(true)
    } finally { f.controller.dispose() }
  })
})
