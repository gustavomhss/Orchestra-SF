import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfOperationRef, type SfOwnerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { sfU02Discard, sfU02DraftReady, sfU02ExecutiveTarget, sfU02IntentRef, sfU02SubmitReview } from "../../src/orchestra/chapters/sucafina/dashboard/executive/edit"
import type { SfU02ReviewIntent } from "../../src/orchestra/chapters/sucafina/dashboard/executive/edit"

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
  test("remount reacquires the same restored unsent controller and conflict for the same owner and scope", async () => {
    for (const selected of [
      { surfaceId: "CAP03" as const, scope: "2026:month", operationId: "domain.page.CAP03" as const,
        input: { year: 2026 }, field: "data.budgetCurrentMonth", action: "save-month" },
      { surfaceId: "CAP01" as const, scope: "2026:4:users", operationId: "domain.page.CAP01" as const,
        input: { execYear: 2026, executiveMonth: 4 }, field: "data.itUsersMonthly", action: "save-users" },
    ]) {
      const drafts = createSfOwnerDrafts(deps, { key: "old" as SfOwnerKey, identity })
      const registration = () => ({ surfaceId: selected.surfaceId,
        identity: { kind: "new" as const, newIntentRef: sfU02IntentRef(selected.surfaceId, selected.scope) },
        editScopeKey: (selected.surfaceId + ":" + selected.scope) as SfEditScopeKey, baseVersion: 10,
        base: null, value: { text: "4" }, revalidation: { operationId: selected.operationId, input: selected.input,
          fieldPaths: [selected.field], actionIds: [selected.action] } })
      const first = drafts.registry.acquire(registration())
      first.edit({ text: "9" }); drafts.quarantine()
      expect(await drafts.revalidate({ key: "new" as SfOwnerKey, identity }, context, transport, new AbortController().signal)).toBe(true)
      const remounted = drafts.registry.acquire(registration())
      expect(remounted).toBe(first)
      expect(remounted.snapshot()).toMatchObject({ phase: "conflict", value: { text: "9" }, baseVersion: 10 })
    }
  })
  test("executive admission rejects ambiguity and missing IDs or CAS, but accepts genuine absence", () => {
    const row = { id: "u", year: 2026, month: 4, users: 12 }
    const versions = { "itUsersMonthly:u": 0, "costPerUserBenchmarks:u": 4 }
    const select = (rows: Parameters<typeof sfU02ExecutiveTarget>[0]) => sfU02ExecutiveTarget(rows, 2026, 4, "itUsersMonthly", versions)
    expect(select(undefined)).toEqual({ kind: "unavailable" })
    expect(select([])).toEqual({ kind: "new", version: 0 })
    expect(select([row])).toMatchObject({ kind: "record", id: "u", version: 0 })
    expect(select([row, { ...row, id: "other" }])).toEqual({ kind: "unavailable" })
    expect(select([row, { ...row, year: 2025 }])).toEqual({ kind: "unavailable" })
    expect(select([{ year: 2026, month: 4 }])).toEqual({ kind: "unavailable" })
    expect(select([{ ...row, id: " " }])).toEqual({ kind: "unavailable" })
    expect(sfU02ExecutiveTarget([row], 2026, 4, "itUsersMonthly", {})).toEqual({ kind: "unavailable" })
    expect(sfU02ExecutiveTarget([row, { ...row, month: 5, id: "other" }], 2026, 4, "costPerUserBenchmarks", versions)).toEqual({ kind: "unavailable" })
    expect(sfU02ExecutiveTarget([row, { ...row, year: 2025 }], 2026, 4, "costPerUserBenchmarks", versions)).toEqual({ kind: "unavailable" })
  })
  test("review changes during the actual digest gate cannot post, even with the same CAS", async () => {
    for (const changed of ["record", "selector", "year", "month", "owner", "generation", "remount"] as const) {
      const { draft, drafts } = makeDraft()
      const calls: number[] = []
      const review: SfU02ReviewIntent = { ownerKey: "old" as SfOwnerKey, generation: 1, registry: drafts.registry, transport,
        controller: draft, surfaceId: "CAP03", operationId: "domain.command.CAP03.save-month", actionId: "save-month",
        scope: "2026:month", recordId: undefined, year: 2026, month: undefined, selector: '[["year",2026]]',
        sourceValue: 4, version: 10, value: 4, text: "4", onConfirmed: () => {},
        onWrite: async (value) => { calls.push(value);return { kind: "response", status: 200, body: { ok: true } } } }
      let live: SfU02ReviewIntent | undefined = review
      let release: ((value: string) => void) | undefined
      const digest = () => new Promise<string>((resolve) => { release = resolve })
      const pending = sfU02SubmitReview(review, () => live, "op" as SfOperationRef, "key", digest)
      if (changed === "record") live = { ...review, recordId: "other" }
      if (changed === "selector") live = { ...review, selector: '[["year",2025]]' }
      if (changed === "year") live = { ...review, year: 2025 }
      if (changed === "month") live = { ...review, month: 5 }
      if (changed === "owner") live = { ...review, ownerKey: "other" as SfOwnerKey }
      if (changed === "generation") live = { ...review, generation: 2 }
      if (changed === "remount") live = undefined
      release!("hash")
      expect(await pending).toEqual({ status: "stale" })
      expect(calls).toEqual([])
      expect(draft.snapshot()).toMatchObject({ pendingOperation: null })
    }
  })
  test("unchanged reviewed intent reaches its original callback with the reviewed value and CAS", async () => {
    const { draft, drafts } = makeDraft()
    const calls: unknown[] = []
    const review: SfU02ReviewIntent = { ownerKey: "old" as SfOwnerKey, generation: 1, registry: drafts.registry, transport,
      controller: draft, surfaceId: "CAP03", operationId: "domain.command.CAP03.save-month", actionId: "save-month",
      scope: "2026:month", recordId: undefined, year: 2026, month: undefined, selector: '[["year",2026]]',
      sourceValue: 4, version: 10, value: 4, text: "4", onConfirmed: () => {},
      onWrite: async (value, version, key) => { calls.push({ value, version, key });return { kind: "response", status: 200, body: { ok: true } } } }
    expect(await sfU02SubmitReview(review, () => review, "op" as SfOperationRef, "key", async () => "hash"))
      .toMatchObject({ status: "response" })
    expect(calls).toEqual([{ value: 4, version: 10, key: "key" }])
  })
})
