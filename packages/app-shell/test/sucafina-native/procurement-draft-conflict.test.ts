import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfOwnerKey, type SfRef } from "@orchestra/schema/sucafina/context"
import { SfProcurementRequest } from "@orchestra/schema/sucafina/procurement"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { sfDraftConflicted, sfDraftForEdit, sfRetainDraft } from "../../src/orchestra/chapters/sucafina/procurement/draft-conflict"
import { isPrWritable, poFromRecord } from "../../src/orchestra/chapters/sucafina/procurement/requests/model"
import { editableStages } from "../../src/orchestra/chapters/sucafina/procurement/sourcing/model"
import { generalDraftFields, supplierEdit } from "../../src/orchestra/chapters/sucafina/procurement/suppliers/model"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"

// Source-contract fixtures, not an installed identity or UI journey.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const identity: SfOwnerIdentity = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test", projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const fresh = Schema.decodeUnknownSync(SfContext)({ stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [{ capabilityId: "CAP27", surface: "procurement", page: "Suppliers", canRead: true, allowedActionIds: ["save"] }],
  availability: [{ family: "procurement", resource: "CAP27", state: "ready", operations: [
    { operationId: "domain.page.CAP27", state: "ready", operational: true, reason: null },
    { operationId: "domain.command.CAP27.save", state: "ready", operational: true, reason: null },
  ] }] })
const selection = { surfaceId: "CAP27" as const, identity: { kind: "record" as const, recordRef: "s1" as SfRef }, editScopeKey: "CAP27:general" as SfEditScopeKey }
const read = { operationId: "domain.page.CAP27" as const, input: { supplier: "s1" }, fieldPaths: generalDraftFields, actionIds: ["save"] }
const owner = { key: "owner" as SfOwnerKey, identity }

test("supplier optional fields stay in one stable edit contract across source changes", async () => {
  const before = { id: "s1", legalName: "Supplier" }
  const after = { ...before, taxId: "source added" }
  let projected: { id: string; legalName: string; taxId?: string } = before
  let version = 5
  const transport: SfTransport = { async execute(operation) {
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP27", selection: { supplier: "s1" },
      data: { suppliers: [projected], requests: [], formSettings: {}, bankVerificationAvailable: false },
      versions: { "suppliers:s1": { version, by: "actor" } }, allowedActionIds: ["save"] } }
    return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
  } }
  const deps = { createDraft: createSfDraft, revalidateDraft: revalidateSfNativeDraft } as unknown as SfContextDependencies
  const drafts = createSfOwnerDrafts(deps, owner)
  const initial = supplierEdit(before)
  const draft = drafts.registry.acquire({ ...selection, baseVersion: 5, base: initial, value: initial, revalidation: read })
  draft.edit({ ...initial, taxId: "local edit" })
  drafts.quarantine()
  expect(await drafts.revalidate(owner, fresh, transport, new AbortController().signal)).toBe(true)
  expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "dirty", value: { taxId: "local edit" } })
  projected = after; version = 6; drafts.quarantine()
  expect(await drafts.revalidate(owner, fresh, transport, new AbortController().signal)).toBe(true)
  const updated = supplierEdit(after)
  expect(Object.keys(updated)).toEqual(Object.keys(initial))
  expect(drafts.registry.acquire({ ...selection, baseVersion: 6, base: updated, value: updated, revalidation: read })).toBe(draft)
  expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", value: { taxId: "local edit" } })
})

test("editable stage changes retain drafts but block review and deleted PO lines", async () => {
  const transport: SfTransport = { async execute() { return { kind: "transport-error", reason: "network" } } }
  const deps = { createDraft: createSfDraft, revalidateDraft: async () => ({ status: "authorized", authority: "unchanged", stamp, sourceVersion: 2 }) } as unknown as SfContextDependencies
  const drafts = createSfOwnerDrafts(deps, owner)
  const current = Schema.decodeUnknownSync(SfProcurementRequest)({ number: "PR-1", status: "pr_rejected", createdBy: "actor", allowedDraftActions: ["save-pr"] })
  expect(isPrWritable(current)).toBe(true)
  expect(editableStages.includes("src_rejected")).toBe(true)
  const request = { surfaceId: "CAP25" as const, identity: { kind: "record" as const, recordRef: "PR-1" as SfRef }, editScopeKey: "po.fields" as SfEditScopeKey }
  const draft = drafts.registry.acquire({ ...request, baseVersion: 1,
    base: { lines: [{ id: "removed", description: "old" }] }, value: { lines: [{ id: "removed", description: "old" }] },
    revalidation: { operationId: "domain.page.CAP25", input: { request: "PR-1" }, fieldPaths: ["po.lines"], actionIds: ["save"] } })
  draft.edit({ lines: [{ id: "removed", description: "local edit" }] })
  expect(sfDraftForEdit(draft.snapshot(), 2)).toBeUndefined()
  drafts.quarantine()
  expect(await drafts.revalidate(owner, fresh, transport, new AbortController().signal)).toBe(true)
  const state = draft.snapshot()
  expect(sfDraftConflicted(state, 2)).toBe(true)
  expect(sfDraftForEdit(state, 2)).toBeUndefined()
  expect(state).toMatchObject({ availability: "active", phase: "conflict", value: { lines: [{ id: "removed" }] } })
  const refreshed = sfRetainDraft(drafts.registry, { ...request, baseVersion: 2,
    base: { lines: [], currency: "USD" }, value: { lines: [], currency: "USD" },
    revalidation: { operationId: "domain.page.CAP25", input: { request: "PR-1" }, fieldPaths: ["po.lines", "po.currency"], actionIds: ["save"] } })
  expect(refreshed).toBe(draft)
  expect(sfDraftForEdit(refreshed.snapshot(), 2)).toBeUndefined()
  const remote = Schema.decodeUnknownSync(SfProcurementRequest)({ number: "PR-1", status: "po_draft", createdBy: "actor", po: { lines: [] } })
  expect(poFromRecord(remote).lines).toEqual([])
  drafts.registry.discard(request)
  expect(drafts.registry.peek(request)).toBeUndefined()
})

test("PR and sourcing editable-stage transitions require conflict resolution at the new CAS", async () => {
  const context = Schema.decodeUnknownSync(SfContext)({ ...fresh,
    destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: ["save"] }],
    availability: [{ family: "procurement", resource: "CAP25", state: "ready", operations: [
      { operationId: "domain.page.CAP25", state: "ready", operational: true, reason: null },
      { operationId: "domain.command.CAP25.save", state: "ready", operational: true, reason: null },
    ] }] })
  for (const item of [
    { scope: "pr.details", status: "pr_rejected", allowed: "save-pr", fields: ["pr.description"], pr: { description: "current" } },
    { scope: "CAP25:sourcing", status: "src_rejected", allowed: "save-sourcing", fields: ["sourcing.evaluator"], sourcing: { evaluator: "current" } },
  ]) {
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP25", selection: { request: "PR-1" },
      data: { requests: [{ number: "PR-1", status: item.status, createdBy: "actor", allowedDraftActions: [item.allowed], pr: item.pr, sourcing: item.sourcing }],
        suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
      versions: { "requests:PR-1": { version: 2, by: "actor" } }, allowedActionIds: ["save"] } }
    const transport: SfTransport = { async execute(operation) {
      return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
    } }
    const deps = { createDraft: createSfDraft, revalidateDraft: revalidateSfNativeDraft } as unknown as SfContextDependencies
    const drafts = createSfOwnerDrafts(deps, owner)
    const draft = drafts.registry.acquire({ surfaceId: "CAP25", identity: { kind: "record", recordRef: "PR-1" as SfRef },
      editScopeKey: item.scope as SfEditScopeKey, baseVersion: 1, base: { text: "base" }, value: { text: "base" },
      revalidation: { operationId: "domain.page.CAP25", input: { request: "PR-1" }, fieldPaths: item.fields, actionIds: ["save"] } })
    draft.edit({ text: "local" }); drafts.quarantine()
    expect(await drafts.revalidate(owner, context, transport, new AbortController().signal)).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", value: { text: "local" } })
    expect(sfDraftForEdit(draft.snapshot(), 2)).toBeUndefined()
  }
})

test("deleted optional values and nested rows conflict without revoking or reusing the old CAS", async () => {
  const context = Schema.decodeUnknownSync(SfContext)({ ...fresh,
    destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: ["save"] }],
    availability: [{ family: "procurement", resource: "CAP25", state: "partial", operations: [
      { operationId: "domain.page.CAP25", state: "ready", operational: true, reason: null },
      { operationId: "domain.command.CAP25.save", state: "ready", operational: true, reason: null },
      { operationId: "domain.command.CAP25.create", state: "unavailable", operational: false, reason: "network" },
    ] }] })
  for (const item of [
    { scope: "pr.details", status: "pr_rejected", grant: "save-pr", fields: ["pr.description"], projection: { pr: {} } },
    { scope: "po.fields", status: "po_rejected", grant: "save-po", fields: ["po.lines", "po.notes"], projection: { po: { lines: [] } } },
    { scope: "CAP25:sourcing", status: "src_rejected", grant: "save-sourcing", fields: ['sourcing.quote:["q1","supplier"]'], projection: { sourcing: { quotes: [] } } },
  ]) {
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP25", selection: { request: "PR-1" },
      data: { requests: [{ number: "PR-1", status: item.status, createdBy: "actor", allowedDraftActions: [item.grant], ...item.projection }],
        suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
      versions: { "requests:PR-1": { version: 2, by: "actor" } }, allowedActionIds: ["save"] } }
    const transport: SfTransport = { async execute(operation) {
      return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
    } }
    const drafts = createSfOwnerDrafts({ createDraft: createSfDraft, revalidateDraft: revalidateSfNativeDraft } as unknown as SfContextDependencies, owner)
    const selection = { surfaceId: "CAP25" as const, identity: { kind: "record" as const, recordRef: "PR-1" as SfRef }, editScopeKey: item.scope as SfEditScopeKey }
    const draft = drafts.registry.acquire({ ...selection, baseVersion: 1, base: { text: "old" }, value: { text: "old" },
      revalidation: { operationId: "domain.page.CAP25", input: { request: "PR-1" }, fieldPaths: item.fields, actionIds: ["save"] } })
    draft.edit({ text: "private deleted row" }); drafts.quarantine()
    expect(await drafts.revalidate(owner, context, transport, new AbortController().signal)).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", baseVersion: 1, value: { text: "private deleted row" } })
    expect(sfDraftForEdit(draft.snapshot(), 2)).toBeUndefined()
    drafts.registry.discard(selection)
    expect(drafts.registry.peek(selection)).toBeUndefined()
  }
})
