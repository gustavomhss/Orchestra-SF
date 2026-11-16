/**
 * Mission 237 — actual pure S03/F01 draft controllers and the one shell bridge.
 * Negative regression only. No installed authentication/provider/CI is emulated.
 * Apply closure237 inert postimages to a candidate BEFORE selecting this test.
 */
import { describe, expect, test } from "bun:test"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import {
  bindSfOwnerShellExit237, requestSfOwnerShellExit237,
} from "../../src/orchestra/chapters/sucafina/host/owner-runtime231"
import type {
  SfContextDependencies, SfOwnerIdentity,
} from "../../src/orchestra/chapters/sucafina/context/contracts"
import type {
  SfEditScopeKey, SfIntentRef, SfOwnerKey,
} from "@orchestra/schema/sucafina/context"

const selection = Object.freeze({
  surfaceId: "UI33" as const,
  identity: { kind: "new" as const, newIntentRef: "ui33-first-real-input" as SfIntentRef },
  editScopeKey: "ui33-create-form-v1" as SfEditScopeKey,
})
const identity: SfOwnerIdentity = {
  serverKey: "real-selection-required",
  transportIdentity: "original-transport",
  publicOrigin: "https://host.invalid",
  projectId: "project",
  installationId: "installation",
  principalRef: "original-principal",
  authEpoch: 1,
}
function owner(key: string) {
  // Only the pure draft factory is required by these negative unit cases.
  const deps = { createDraft: createSfDraft } as unknown as SfContextDependencies
  return createSfOwnerDrafts(deps, { key: key as SfOwnerKey, identity })
}
function openDraft(store: ReturnType<typeof owner>) {
  return store.registry.acquire({
    ...selection, baseVersion: null, base: null,
    value: { objective: "source-typed", start: "", end: "", currency: "", criteria: "evidence" },
    revalidation: { operationId: "projection.cases", input: undefined, fieldPaths: [], actionIds: [] },
  })
}

describe("237 — F01 owner-scoped UI33 editor regressions", () => {
  test("untouched form is not dirty; first typed value is retained in the one registry", () => {
    const drafts = owner("owner-a")
    expect(drafts.registry.peek(selection)).toBeUndefined()
    expect(drafts.dirty()).toBe(false)
    const editing = openDraft(drafts)
    expect(drafts.dirty()).toBe(true)
    editing.edit({ objective: "different", start: "2026-11-16", end: "", currency: "BRL", criteria: "new" })
    const resumed = drafts.registry.peek<{ objective: string; start: string }>(selection)?.snapshot()
    expect(resumed).toMatchObject({ availability: "active", dirty: true })
    if (resumed?.availability !== "active") throw new Error("SF_237_DRAFT_NOT_ACTIVE")
    expect(resumed.value).toMatchObject({ objective: "different", start: "2026-11-16" })
  })

  test("cancel keeps editor, original owner and values; confirmed discard erases all drafts", async () => {
    const drafts = owner("owner-a")
    const editing = openDraft(drafts)
    editing.edit({ objective: "not-sent", start: "", end: "", currency: "", criteria: "private" })
    let consent = false
    const release = bindSfOwnerShellExit237(async () => {
      if (!drafts.dirty()) return true
      if (!consent) return false
      return drafts.discardAll()
    })
    try {
      expect(await requestSfOwnerShellExit237()).toBe(false)
      expect(drafts.registry.peek(selection)?.snapshot()).toMatchObject({ availability: "active", dirty: true })
      consent = true
      expect(await requestSfOwnerShellExit237()).toBe(true)
      expect(drafts.registry.peek(selection)).toBeUndefined()
      expect(drafts.dirty()).toBe(false)
      expect(editing.snapshot()).toEqual({ availability: "revoked", reason: "owner-changed" })
    } finally { release() }
  })

  test("submitted unknown original request cannot be cleared by generic draft discard", () => {
    const drafts = owner("owner-a")
    const editing = openDraft(drafts)
    drafts.registry.markUnresolved(selection, true)
    expect(drafts.dirty()).toBe(true)
    drafts.registry.discard(selection)
    expect(drafts.registry.peek(selection)).toBeDefined()
    expect(drafts.discardAll()).toBe(false)
    expect(editing.snapshot()).toMatchObject({ availability: "active", dirty: true })
    drafts.registry.markUnresolved(selection, false) // only original producer's outcome may authorize this
    expect(drafts.discardAll()).toBe(true)
  })

  test("changing owner purges the old facade; no private value crosses to the next owner", () => {
    const before = owner("owner-a")
    const editing = openDraft(before)
    before.revoke("owner-changed")
    expect(editing.snapshot()).toEqual({ availability: "revoked", reason: "owner-changed" })
    editing.edit({ objective: "should-not-revive", start: "", end: "", currency: "", criteria: "secret" })
    expect(before.registry.peek(selection)).toBeUndefined()
    const after = owner("owner-b")
    expect(after.registry.peek(selection)).toBeUndefined()
    expect(after.dirty()).toBe(false)
  })

  test("quarantined/unauthorized fields cannot be discarded into a new owner", () => {
    const drafts = owner("owner-a")
    const editing = openDraft(drafts)
    drafts.quarantine()
    expect(editing.snapshot()).toMatchObject({ availability: "quarantined" })
    expect(drafts.discardAll()).toBe(false)
    expect(drafts.registry.peek(selection)).toBeUndefined()
  })

  test("one active owner bridge rejects another owner and releases without side effects", async () => {
    let called = 0
    const callback = async () => { called += 1; return false }
    const release = bindSfOwnerShellExit237(callback)
    try {
      expect(() => bindSfOwnerShellExit237(async () => true)).toThrow("SF_F01_MULTIPLE_EXIT_OWNERS")
      expect(await requestSfOwnerShellExit237()).toBe(false)
      expect(called).toBe(1)
    } finally { release() }
    expect(await requestSfOwnerShellExit237()).toBe(true)
  })
})
