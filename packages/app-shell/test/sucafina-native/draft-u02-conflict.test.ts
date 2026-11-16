import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfOperationRef, type SfOwnerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { sfU02Discard, sfU02DraftReady } from "../../src/orchestra/chapters/sucafina/dashboard/executive/edit"

const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const identity = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test", projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const context = Schema.decodeUnknownSync(SfContext)({ stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [] })
const transport: SfTransport = { async execute() { throw new Error("unexpected transport") } }
const deps = { createDraft: createSfDraft, revalidateDraft: async () => ({ status: "authorized", authority: "unchanged", stamp, sourceVersion: 11 }) } as unknown as SfContextDependencies
const source = { admitted: true, version: 11, value: 6, busy: false }

function makeDraft() {
  const drafts = createSfOwnerDrafts(deps, { key: "old" as SfOwnerKey, identity })
  const draft = drafts.registry.acquire({ surfaceId: "CAP03", identity: { kind: "new", newIntentRef: "new" as SfIntentRef },
    editScopeKey: "CAP03:2026:month" as SfEditScopeKey, baseVersion: 10, base: null, value: { text: "4" },
    revalidation: { operationId: "domain.page.CAP03", input: { year: 2026 }, fieldPaths: ["data.budgetCurrentMonth"], actionIds: ["save-month"] } })
  return { drafts, draft }
}

describe("U02 scalar editor conflict controls", () => {
  test("a restored phase-only conflict blocks review until explicit discard adopts the fresh source", async () => {
    const { drafts, draft } = makeDraft()
    draft.edit({ text: "9" }); drafts.quarantine()
    expect(await drafts.revalidate({ key: "new" as SfOwnerKey, identity }, context, transport, new AbortController().signal)).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", conflict: null, baseVersion: 10, value: { text: "9" } })
    expect(sfU02DraftReady(draft.snapshot(), 10)).toBe(false)
    expect(sfU02DraftReady(draft.snapshot(), 11)).toBe(false)
    expect(sfU02Discard(draft, source)).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "clean", conflict: null, dirty: false,
      baseVersion: 11, base: { text: "6" }, value: { text: "6" } })
    expect(sfU02DraftReady(draft.snapshot(), 11)).toBe(true)
    expect(sfU02DraftReady(draft.snapshot(), 12)).toBe(false)
  })
  test("discard uses the actual current value even when the version is unchanged", () => {
    const { draft } = makeDraft()
    draft.edit({ text: "9" })
    expect(sfU02Discard(draft, { ...source, version: 10, value: 8 })).toBe(true)
    expect(draft.snapshot()).toMatchObject({ phase: "clean", dirty: false, baseVersion: 10, base: { text: "8" }, value: { text: "8" } })
  })
  test("pending and unknown operations cannot be discarded even by directly invoking the handler", () => {
    const { draft } = makeDraft()
    draft.setPending({ operationRef: "op" as SfOperationRef, idempotencyKey: "id", payloadDigest: "digest", expectedVersion: 10 })
    for (const phase of ["submitting", "outcome-unknown"] as const) {
      draft.setPhase(phase)
      const before = draft.snapshot()
      expect(sfU02Discard(draft, source)).toBe(false)
      expect(draft.snapshot()).toEqual(before)
    }
  })
  test("discard requires admitted current numeric source and no active request", () => {
    const { draft } = makeDraft()
    draft.edit({ text: "9" })
    for (const unavailable of [{ ...source, admitted: false }, { ...source, version: undefined },
      { ...source, version: -1 }, { ...source, version: NaN }, { ...source, busy: true }]) {
      const before = draft.snapshot()
      expect(sfU02Discard(draft, unavailable)).toBe(false)
      expect(draft.snapshot()).toEqual(before)
    }
  })
})
