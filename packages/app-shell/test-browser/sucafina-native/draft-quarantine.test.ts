import { describe, expect, test } from "bun:test"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import type { SfEditScopeKey, SfOperationRef, SfOwnerKey, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { solidDom } from "../solid-dom"

// Bun may have loaded the plain TSX module with React's transform in an earlier
// browser-lane test. Force the same Solid JSX transform used by the app; do not
// substitute a fake provider, owner or transport admission.
const { SfContextProvider, useSfContext }: typeof import("../../src/orchestra/chapters/sucafina/context") =
  await import(solidDom("../../src/orchestra/chapters/sucafina/context", import.meta.dir))
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import type { SfContext, SfContextDependencies, SfContextHandle, SfDraftRevalidation, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"

// Contract tests with injected producer responses, not an installed identity/host proof.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const context: SfContext = { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [] }
const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
const identity: SfOwnerIdentity = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test", projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test", mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const transport: SfTransport = { async execute() { return { kind: "transport-error", reason: "network" } } }
const authorized = (sourceVersion = 1): Extract<SfDraftRevalidation, { status: "authorized" }> =>
  ({ status: "authorized", authority: "unchanged", stamp, sourceVersion })
const selected = (ref: string) => ({ surfaceId: "CAP25" as const, identity: { kind: "record" as const, recordRef: ref as SfRef }, editScopeKey: "pr.details" as SfEditScopeKey })
const read = { operationId: "domain.page.CAP25" as const, input: {}, fieldPaths: [], actionIds: [] }
const open = (registry: ReturnType<typeof createSfOwnerDrafts>["registry"], ref: string) => registry.acquire({
  ...selected(ref), baseVersion: 1, base: { text: "original" }, value: { text: "original" }, revalidation: read,
})

function dependencies(revalidateDraft: SfContextDependencies["revalidateDraft"]): SfContextDependencies {
  return {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: context }),
    createTransport: () => transport,
    resolveTransportIdentity: () => "transport",
    createDraft: createSfDraft,
    revalidateDraft,
  }
}

describe("owner draft quarantine", () => {
  test("only an exact first-attempt 409 permits discard; unknown and quarantined operations stay fenced", async () => {
    const pending = { operationRef: "op" as SfOperationRef, idempotencyKey: "key", payloadDigest: "digest", expectedVersion: 1 }
    const registry = createSfOwnerDrafts(dependencies(async () => authorized()), { key: "one" as SfOwnerKey, identity })
    const draft = open(registry.registry, "r1")
    draft.edit({ text: "private" }); draft.setPending(pending)
    draft.rejectSave({ status: 409, operation: pending }) // not yet submitting
    expect(draft.snapshot()).toMatchObject({ pendingOperation: pending })
    draft.setPhase("submitting")
    draft.rejectSave({ status: 503 as 409, operation: pending })
    expect(draft.snapshot()).toMatchObject({ phase: "submitting", pendingOperation: pending })
    for (const wrong of [{ ...pending, operationRef: "other" as SfOperationRef }, { ...pending, idempotencyKey: "other" },
      { ...pending, payloadDigest: "other" }, { ...pending, expectedVersion: 2 }]) {
      draft.rejectSave({ status: 409, operation: wrong })
      expect(draft.snapshot()).toMatchObject({ phase: "submitting", pendingOperation: pending })
    }
    draft.rejectSave({ status: 409, operation: pending })
    expect(draft.snapshot()).toMatchObject({ phase: "conflict", pendingOperation: null, baseVersion: 1, value: { text: "private" } })
    registry.registry.discard(selected("r1"))
    expect(registry.registry.peek(selected("r1"))).toBeUndefined()

    const unknown = open(registry.registry, "r2")
    unknown.edit({ text: "unknown" }); unknown.setPending(pending); unknown.setPhase("submitting"); unknown.setPhase("outcome-unknown")
    unknown.setPhase("submitting"); unknown.rejectSave({ status: 409, operation: pending })
    registry.registry.discard(selected("r2"))
    expect(unknown.snapshot()).toMatchObject({ pendingOperation: pending, value: { text: "unknown" } })
    registry.quarantine(); unknown.rejectSave({ status: 409, operation: pending })
    expect(await registry.revalidate({ key: "two" as SfOwnerKey, identity }, context, transport, new AbortController().signal)).toBe(true)
    unknown.setPhase("submitting"); unknown.rejectSave({ status: 409, operation: pending })
    expect(unknown.snapshot()).toMatchObject({ pendingOperation: pending })
    registry.revoke("logout"); unknown.rejectSave({ status: 409, operation: pending })
    expect(unknown.snapshot()).toEqual({ availability: "revoked", reason: "logout" })
  })
  test("typed 422 settles only the exact first submission and permits editing without changing CAS", () => {
    const pending = { operationRef: "op" as SfOperationRef, idempotencyKey: "key", payloadDigest: "digest", expectedVersion: 1 }
    const registry = createSfOwnerDrafts(dependencies(async () => authorized()), { key: "one" as SfOwnerKey, identity })
    const draft = open(registry.registry, "r1")
    draft.edit({ text: "invalid" }); draft.setPending(pending); draft.setPhase("submitting")
    draft.rejectSave({ status: 422, operation: { ...pending, idempotencyKey: "wrong" } })
    expect(draft.snapshot()).toMatchObject({ phase: "submitting", pendingOperation: pending })
    draft.rejectSave({ status: 422, operation: pending })
    expect(draft.snapshot()).toMatchObject({ phase: "validation-error", pendingOperation: null, baseVersion: 1, value: { text: "invalid" }, dirty: true })
    draft.edit({ text: "corrected" }); draft.setPhase("reviewing")
    expect(draft.snapshot()).toMatchObject({ phase: "reviewing", baseVersion: 1, value: { text: "corrected" } })
    const unknown = open(registry.registry, "r2")
    unknown.setPending(pending); unknown.setPhase("outcome-unknown"); unknown.setPhase("submitting")
    unknown.rejectSave({ status: 422, operation: pending })
    expect(unknown.snapshot()).toMatchObject({ pendingOperation: pending })
  })
  test("unavailable retry keeps values hidden, then restores the same drafts", async () => {
    let proof: SfDraftRevalidation = { status: "unavailable" }
    const registry = createSfOwnerDrafts(dependencies(async () => proof), { key: "one" as SfOwnerKey, identity })
    const draft = open(registry.registry, "r1")
    draft.edit({ text: "private edit" })
    registry.quarantine()
    expect(registry.dirty()).toBe(true)
    expect(await registry.revalidate({ key: "two" as SfOwnerKey, identity }, context, transport, new AbortController().signal)).toBe(false)
    expect(registry.state()).toBe("quarantined")
    expect(draft.snapshot()).toEqual({ availability: "quarantined", reason: "session-expired", dirty: true })
    proof = authorized()
    expect(await registry.revalidate({ key: "two" as SfOwnerKey, identity }, context, transport, new AbortController().signal)).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", value: { text: "private edit" } })
  })

  test("all proofs settle before any facade becomes active; changed version conflicts", async () => {
    const entered = Promise.withResolvers<void>()
    const second = Promise.withResolvers<SfDraftRevalidation>()
    const deps = dependencies(async (input) => {
      if (input.identity.kind === "record" && input.identity.recordRef === "r2") { entered.resolve(); return second.promise }
      return authorized()
    })
    const registry = createSfOwnerDrafts(deps, { key: "one" as SfOwnerKey, identity })
    const first = open(registry.registry, "r1"), later = open(registry.registry, "r2")
    first.edit({ text: "first" }); later.edit({ text: "second" })
    registry.quarantine()
    const result = registry.revalidate({ key: "two" as SfOwnerKey, identity }, context, transport, new AbortController().signal)
    await entered.promise
    expect(first.snapshot().availability).toBe("quarantined")
    expect(later.snapshot().availability).toBe("quarantined")
    second.resolve(authorized(2))
    expect(await result).toBe(true)
    expect(first.snapshot()).toMatchObject({ availability: "active", value: { text: "first" } })
    expect(later.snapshot()).toMatchObject({ availability: "active", phase: "conflict", value: { text: "second" } })
  })

  test("a later explicit denial still purges after another source is unavailable", async () => {
    const deps = dependencies(async (input) => input.identity.kind === "record" && input.identity.recordRef === "r1"
      ? { status: "unavailable" } : { status: "denied" })
    const registry = createSfOwnerDrafts(deps, { key: "one" as SfOwnerKey, identity })
    const first = open(registry.registry, "r1"), second = open(registry.registry, "r2")
    first.edit({ text: "first" }); second.edit({ text: "second" }); registry.quarantine()
    expect(await registry.revalidate({ key: "two" as SfOwnerKey, identity }, context, transport, new AbortController().signal)).toBe(false)
    expect(first.snapshot().availability).toBe("revoked")
    expect(second.snapshot().availability).toBe("revoked")
  })

  test("empty quarantine is clean; explicit discard purges unsent but not pending or unresolved drafts", () => {
    const empty = createSfOwnerDrafts(dependencies(async () => authorized()), { key: "one" as SfOwnerKey, identity })
    empty.quarantine()
    expect(empty.dirty()).toBe(false)
    expect(empty.discardAll()).toBe(true)
    const drafts = createSfOwnerDrafts(dependencies(async () => authorized()), { key: "one" as SfOwnerKey, identity })
    const editing = open(drafts.registry, "r1")
    editing.edit({ text: "unsent" }); drafts.quarantine()
    expect(drafts.discardAll()).toBe(true)
    expect(editing.snapshot()).toEqual({ availability: "revoked", reason: "owner-changed" })
    const pending = createSfOwnerDrafts(dependencies(async () => authorized()), { key: "one" as SfOwnerKey, identity })
    const submitted = open(pending.registry, "r2")
    submitted.setPending({ operationRef: "op" as SfOperationRef, idempotencyKey: "intent", payloadDigest: "digest", expectedVersion: 1 })
    submitted.setPhase("outcome-unknown"); pending.quarantine()
    expect(pending.dirty()).toBe(true)
    expect(pending.discardAll()).toBe(false)
    const unresolved = createSfOwnerDrafts(dependencies(async () => authorized()), { key: "one" as SfOwnerKey, identity })
    open(unresolved.registry, "r3"); unresolved.registry.markUnresolved(selected("r3"), true); unresolved.quarantine()
    expect(unresolved.discardAll()).toBe(false)
  })

  test("foreign authority, denial and invalid stamp revoke; abort does not", async () => {
    const run = async (proof: SfDraftRevalidation, incoming = identity, signal = new AbortController().signal) => {
      const registry = createSfOwnerDrafts(dependencies(async () => proof), { key: "one" as SfOwnerKey, identity })
      const draft = open(registry.registry, "r1"); draft.edit({ text: "private" }); registry.quarantine()
      expect(await registry.revalidate({ key: "two" as SfOwnerKey, identity: incoming }, context, transport, signal)).toBe(false)
      return { registry, draft }
    }
    expect((await run({ status: "denied" })).draft.snapshot()).toMatchObject({ availability: "revoked" })
    expect((await run({ ...authorized(), stamp: { ...stamp, accessRevision: "wrong" } })).draft.snapshot()).toMatchObject({ availability: "revoked" })
    for (const changed of [{ ...identity, serverKey: "other" }, { ...identity, transportIdentity: "other" },
      { ...identity, publicOrigin: "https://other.test" }, { ...identity, projectId: "other" },
      { ...identity, installationId: "other" }, { ...identity, principalRef: "other" }])
      expect((await run(authorized(), changed)).draft.snapshot()).toMatchObject({ availability: "revoked" })
    const abort = new AbortController(); abort.abort()
    expect((await run(authorized(), identity, abort.signal)).draft.snapshot()).toMatchObject({ availability: "quarantined" })
  })
})

describe("provider quarantine publication", () => {
  test("People source outage takes precedence over missing action; explicit action loss purges and notifies", async () => {
    const source: SfContext = { ...context,
      destinations: [{ capabilityId: "CAP08", surface: "dashboard", page: "Talent Review", canRead: true, allowedActionIds: ["save"] }],
      availability: [{ family: "domain-read", resource: "CAP08", state: "ready", operations: [
        { operationId: "domain.page.CAP08", state: "ready", operational: true, reason: null },
        { operationId: "domain.command.CAP08.save", state: "ready", operational: true, reason: null },
      ] }],
    }
    let fresh = source
    let notices = 0
    const deps: SfContextDependencies = { ...dependencies(revalidateSfNativeDraft),
      loadContext: async () => ({ status: "ok", value: fresh }), onDraftAccessRevoked: () => { notices++ } }
    const node = document.createElement("div")
    document.body.append(node)
    const captured: { handle?: SfContextHandle } = {}
    const child = () => { captured.handle = useSfContext(); return null }
    const dispose = render(() => createComponent(SfContextProvider, {
      selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) },
    }), node)
    try {
      const handle = captured.handle
      if (!handle) throw new Error("provider handle unavailable")
      await handle.reload()
      const draft = handle.ready()!.drafts.acquire({ surfaceId: "CAP08",
        identity: { kind: "record", recordRef: "m1" as SfRef }, editScopeKey: "people:talent:current:talent" as SfEditScopeKey,
        baseVersion: 1, base: { text: "base" }, value: { text: "base" },
        revalidation: { operationId: "domain.page.CAP08", input: {}, fieldPaths: ["name"], actionIds: ["save"] } })
      draft.edit({ text: "private" }); handle.invalidate("session-expired")
      fresh = { ...source, destinations: [], availability: [{ family: "domain-read", resource: "CAP08", state: "unavailable", operations: [] }] }
      await handle.reload()
      expect(handle.state()).toMatchObject({ status: "unavailable", reason: "host-unavailable" })
      expect(draft.snapshot().availability).toBe("quarantined")
      expect(notices).toBe(0)
      // Explicit source-side action denial (read remains admitted) is a
      // revocation. Removing an entire destination can also mean temporary
      // discovery loss; that cannot be used as proof to destroy a private draft.
      fresh = {
        ...source,
        destinations: source.destinations.map((entry) => ({ ...entry, allowedActionIds: [] })),
        availability: source.availability.map((resource) => ({
          ...resource,
          operations: resource.operations.map((operation) => operation.operationId === "domain.command.CAP08.save"
            ? { ...operation, state: "denied" as const, operational: false, reason: "action-revoked" }
            : operation),
        })),
      }
      await handle.reload()
      expect(handle.state().status).toBe("ready")
      expect(draft.snapshot().availability).toBe("revoked")
      expect(notices).toBe(1)
    } finally { dispose(); node.remove() }
  })

  test("session expiry fences the transport and hides pending edits until same-owner proof", async () => {
    const entered = Promise.withResolvers<void>()
    const proof = Promise.withResolvers<SfDraftRevalidation>()
    let notices = 0
    const deps: SfContextDependencies = { ...dependencies(async () => { entered.resolve(); return proof.promise }),
      createTransport: () => ({ execute: transport.execute }), onDraftAccessRevoked: () => { notices++ } }
    const node = document.createElement("div")
    document.body.append(node)
    const captured: { handle?: SfContextHandle } = {}
    const child = () => { captured.handle = useSfContext(); return null }
    const dispose = render(() => createComponent(SfContextProvider, {
      selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) },
    }), node)
    try {
      const handle = captured.handle
      if (!handle) throw new Error("provider handle unavailable")
      await handle.reload()
      const firstTransport = handle.ready()!.transport
      const draft = open(handle.ready()!.drafts, "r1")
      draft.edit({ text: "private" })
      draft.setPending({ operationRef: "op" as SfOperationRef, idempotencyKey: "intent", payloadDigest: "digest", expectedVersion: 1 })
      draft.setPhase("outcome-unknown")
      const generation = handle.generation()
      handle.invalidate("session-expired")
      expect(handle.generation()).toBeGreaterThan(generation)
      expect(handle.state()).toMatchObject({ status: "unavailable", reason: "connection-auth-unavailable" })
      expect(handle.ready()).toBeUndefined()
      expect(handle.discardDrafts()).toBe(false)
      expect(draft.snapshot()).toEqual({ availability: "quarantined", reason: "session-expired", dirty: true })
      const loading = handle.reload()
      await entered.promise
      expect(draft.snapshot().availability).toBe("quarantined")
      expect(handle.ready()).toBeUndefined()
      proof.resolve(authorized())
      await loading
      expect(handle.ready()?.transport).not.toBe(firstTransport)
      expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "outcome-unknown", value: { text: "private" }, pendingOperation: { operationRef: "op" } })
      expect(notices).toBe(0)
    } finally { dispose(); node.remove() }
  })

  test("logout and a different principal purge expired drafts without a false revocation notice", async () => {
    let fresh = context
    let proofs = 0, notices = 0
    const deps: SfContextDependencies = { ...dependencies(async () => { proofs++; return authorized() }),
      loadContext: async () => ({ status: "ok", value: fresh }), onDraftAccessRevoked: () => { notices++ } }
    const node = document.createElement("div")
    document.body.append(node)
    const captured: { handle?: SfContextHandle } = {}
    const child = () => { captured.handle = useSfContext(); return null }
    const dispose = render(() => createComponent(SfContextProvider, {
      selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) },
    }), node)
    try {
      const handle = captured.handle
      if (!handle) throw new Error("provider handle unavailable")
      await handle.reload()
      const logoutDraft = open(handle.ready()!.drafts, "r1")
      logoutDraft.edit({ text: "private" }); handle.invalidate("session-expired"); handle.invalidate("logout")
      expect(logoutDraft.snapshot()).toEqual({ availability: "revoked", reason: "logout" })
      await handle.reload()
      const priorOwner = open(handle.ready()!.drafts, "r2")
      priorOwner.edit({ text: "other private" }); handle.invalidate("session-expired")
      fresh = { ...context, stamp: { ...stamp, principalRef: "other" } }
      await handle.reload()
      expect(priorOwner.snapshot()).toMatchObject({ availability: "revoked" })
      expect(handle.ready()?.drafts.peek(selected("r2"))).toBeUndefined()
      expect(proofs).toBe(0)
      expect(notices).toBe(0)
    } finally { dispose(); node.remove() }
  })

  test("explicit non-ready discard replaces the revoked registry on the next successful load", async () => {
    let available = true
    const deps: SfContextDependencies = { ...dependencies(async () => authorized()),
      loadContext: async () => available ? { status: "ok", value: context } : { status: "unavailable", reason: "host-unavailable" },
    }
    const node = document.createElement("div")
    document.body.append(node)
    const captured: { handle?: SfContextHandle } = {}
    const child = () => { captured.handle = useSfContext(); return null }
    const dispose = render(() => createComponent(SfContextProvider, {
      selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) },
    }), node)
    try {
      const handle = captured.handle
      if (!handle) throw new Error("provider handle unavailable")
      await handle.reload()
      const old = handle.ready()!.drafts
      const draft = open(old, "r1")
      draft.edit({ text: "discard me" })
      available = false; await handle.reload()
      expect(handle.hasDirtyDrafts()).toBe(true)
      expect(handle.discardDrafts()).toBe(true)
      expect(draft.snapshot()).toMatchObject({ availability: "revoked" })
      available = true; await handle.reload()
      const fresh = handle.ready()?.drafts
      expect(fresh).toBeDefined()
      expect(fresh).not.toBe(old)
      expect(fresh?.peek(selected("r1"))).toBeUndefined()
      expect(open(fresh!, "r2").snapshot()).toMatchObject({ availability: "active" })
      available = false; await handle.reload()
      expect(handle.hasDirtyDrafts()).toBe(false)
    } finally { dispose(); node.remove() }
  })

  test("unavailable retry stays non-ready; denial purges and emits a generic notice", async () => {
    let mode: "ok" | "expired" = "ok"
    let proof: SfDraftRevalidation = { status: "unavailable" }
    let notices = 0
    const deps: SfContextDependencies = { ...dependencies(async () => proof),
      loadContext: async () => mode === "ok" ? { status: "ok", value: context } : { status: "unauthenticated" },
      onDraftAccessRevoked: () => { notices++ },
    }
    const node = document.createElement("div")
    document.body.append(node)
    const captured: { handle?: SfContextHandle } = {}
    const child = () => { captured.handle = useSfContext(); return null }
    const dispose = render(() => createComponent(SfContextProvider, {
      selection: () => selection, dependencies: deps, get children() { return createComponent(child, {}) },
    }), node)
    try {
      const handle = captured.handle
      if (!handle) throw new Error("provider handle unavailable")
      await handle.reload()
      const draft = open(handle.ready()!.drafts, "r1")
      draft.edit({ text: "secret" })
      mode = "expired"; await handle.reload()
      mode = "ok"; await handle.reload()
      expect(handle.state()).toMatchObject({ status: "unavailable", reason: "host-unavailable" })
      expect(handle.ready()).toBeUndefined()
      expect(draft.snapshot().availability).toBe("quarantined")
      proof = authorized(); await handle.reload()
      expect(handle.state().status).toBe("ready")
      expect(draft.snapshot()).toMatchObject({ availability: "active", value: { text: "secret" } })
      mode = "expired"; await handle.reload()
      mode = "ok"; proof = { status: "denied" }; await handle.reload()
      expect(handle.state().status).toBe("ready")
      expect(draft.snapshot().availability).toBe("revoked")
      expect(handle.ready()?.drafts.peek(selected("r1"))).toBeUndefined()
      expect(notices).toBe(1)
    } finally { dispose(); node.remove() }
  })
})
