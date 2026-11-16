import { describe, expect, test } from "bun:test"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import type { SfEditScopeKey, SfOperationRef, SfOwnerKey, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfContextProvider, useSfContext } from "../../src/orchestra/chapters/sucafina/context"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import type { SfContext, SfContextDependencies, SfContextHandle, SfDraftRevalidation, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"

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
