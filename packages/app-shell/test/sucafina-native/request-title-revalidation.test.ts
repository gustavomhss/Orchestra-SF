import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfOwnerKey, type SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfDraftRevalidationInput } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { readRequestTitle, revalidateRequestTitleDraft } from "../../src/orchestra/chapters/sucafina/procurement/requests/title-revalidation"

// Typed transport/controller fixtures, not an installed identity or UI proof.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const owner = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test",
  projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const ref = "PR-1" as SfRef
const context = Schema.decodeUnknownSync(SfContext)({ stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: ["save"] }],
  availability: [{ family: "procurement", resource: "CAP25", state: "ready", operations: [
    { operationId: "domain.page.CAP25", state: "ready", operational: true, reason: null },
    { operationId: "domain.command.CAP25.save", state: "ready", operational: true, reason: null },
  ] }] })
const input: SfDraftRevalidationInput = { surfaceId: "CAP25", identity: { kind: "record", recordRef: ref },
  editScopeKey: "pr.title" as SfEditScopeKey, originalOwner: owner,
  read: { operationId: "domain.page.CAP25", input: { request: ref }, fieldPaths: ["pr.title"], actionIds: ["save"] } }
const row = { number: ref, status: "draft", createdBy: "actor", allowedDraftActions: ["save-pr"], pr: { title: "original" } }
const body = (rows: unknown[] = [row], version = 7, actions = ["save"]) => ({ status: "ok", context: stamp,
  value: { capabilityId: "CAP25", selection: { request: ref },
    data: { requests: rows, suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
    versions: { "requests:PR-1": { version, by: "actor" } }, allowedActionIds: actions } })
function transport(value: unknown, calls: { id: string; input: unknown }[] = []): SfTransport {
  return { async execute(operation, request) {
    calls.push({ id: operation.operationId, input: request })
    return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(value) }
  } }
}
const signal = () => new AbortController().signal
const revalidate = (value: unknown, fresh = context, metadata = input) =>
  revalidateRequestTitleDraft(metadata, fresh, transport(value), signal())

describe("request title original source binding", () => {
  test("reads the exact request, retains the true CAS, and permits an absent optional title in a disclosed PR", async () => {
    const calls: { id: string; input: unknown }[] = []
    expect(await revalidateRequestTitleDraft(input, context, transport(body(), calls), signal()))
      .toEqual({ status: "authorized", authority: "unchanged", stamp, sourceVersion: 7 })
    expect(calls).toEqual([{ id: "domain.page.CAP25", input: { request: ref } }])
    expect(await revalidate(body([{ ...row, pr: {} }]))).toMatchObject({ status: "authorized" })
    expect(await revalidate(body([{ ...row, pr: null }]))).toEqual({ status: "unavailable" })
  })
  test("missing source grants are unavailable; actual loss and disallowed stages are denied", async () => {
    const { allowedDraftActions, ...old } = row
    expect(allowedDraftActions).toEqual(["save-pr"])
    expect(await revalidate(body([old]))).toEqual({ status: "unavailable" })
    expect(await revalidate(body([{ ...old, status: "po_draft" }]))).toEqual({ status: "unavailable" })
    expect(await revalidate(body([{ ...row, allowedDraftActions: [] }]))).toEqual({ status: "denied" })
    expect(await revalidate(body([{ ...row, status: "po_draft" }]))).toEqual({ status: "denied" })
    expect(await revalidate(body([row], 7, []))).toEqual({ status: "denied" })
    expect(await revalidate(body([{ ...row, status: "pr_rejected" }]))).toMatchObject({ status: "authorized" })
  })
  test("duplicates, wrong selector, invalid version, missing availability and mismatched stamp fail closed", async () => {
    expect(await revalidate(body([row, row]))).toEqual({ status: "unavailable" })
    expect(await revalidate(body([{ ...row, number: "PR-2" }]))).toEqual({ status: "unavailable" })
    expect(await revalidate(body([row], -1))).toEqual({ status: "unavailable" })
    expect(await revalidate({ ...body(), value: { ...body().value, selection: { request: "PR-2" } } })).toEqual({ status: "unavailable" })
    expect(await revalidate({ ...body(), context: { ...stamp, accessRevision: "changed" } })).toEqual({ status: "authority-changed" })
    expect(await revalidate(body(), { ...context, availability: [] })).toEqual({ status: "unavailable" })
    expect(await revalidate(body(), context, { ...input, read: { ...input.read, fieldPaths: ["pr.details"] } })).toEqual({ status: "unavailable" })
    expect(await revalidate(body(), context, { ...input, originalOwner: { ...owner, principalRef: "other" } })).toEqual({ status: "authority-changed" })
  })
  test("a revalidated dirty draft with advanced CAS remains conflicted until explicit discard", async () => {
    const deps = { createDraft: createSfDraft, revalidateDraft: revalidateRequestTitleDraft } as unknown as SfContextDependencies
    const drafts = createSfOwnerDrafts(deps, { key: "owner" as SfOwnerKey, identity: owner })
    const selection = { surfaceId: "CAP25" as const, identity: { kind: "record" as const, recordRef: ref }, editScopeKey: input.editScopeKey }
    const draft = drafts.registry.acquire({ ...selection, baseVersion: 7, base: { title: "original" }, value: { title: "original" }, revalidation: input.read })
    draft.edit({ title: "private local" })
    drafts.quarantine()
    expect(draft.snapshot().availability).toBe("quarantined")
    expect(await drafts.revalidate({ key: "owner" as SfOwnerKey, identity: owner }, context, transport(body([row], 8)), signal())).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", baseVersion: 7 })
    drafts.registry.discard(selection)
    expect(drafts.registry.peek(selection)).toBeUndefined()
  })
  test("an aborted typed read cannot authorize a draft", async () => {
    const abort = new AbortController()
    const wire: SfTransport = { async execute(operation) {
      abort.abort()
      return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body()) }
    } }
    expect(await readRequestTitle(context, wire, ref, abort.signal)).toEqual({ status: "unavailable" })
  })
})
