import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfDraftRevalidationInput } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"

// Source-contract fixtures exercise the typed clients, not an installed host or identity service.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const operation = (operationId: string) => ({ operationId, state: "ready", reason: null, operational: true })
const fresh = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [
    { capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: ["save", "create"] },
    { capabilityId: "CAP27", surface: "procurement", page: "Suppliers", canRead: true, allowedActionIds: ["create"] },
    { capabilityId: "CAP28", surface: "procurement", page: "Settings", canRead: true, allowedActionIds: ["save", "reset"] },
  ],
  availability: [
    { family: "procurement", resource: "CAP25", state: "ready", operations: [operation("domain.page.CAP25")] },
    { family: "procurement", resource: "CAP27", state: "ready", operations: [operation("domain.command.CAP27.create")] },
    { family: "decisions", resource: "cases", state: "ready", operations: [operation("projection.case")] },
  ],
})
const owner = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test",
  projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const requestRef = "PR-1" as SfRef
const recordInput: SfDraftRevalidationInput = {
  surfaceId: "CAP25", identity: { kind: "record", recordRef: requestRef }, editScopeKey: "pr.details" as SfEditScopeKey,
  originalOwner: owner, read: { operationId: "domain.page.CAP25", input: { request: requestRef },
    fieldPaths: ["pr.description"], actionIds: ["save"] },
}
const page = (overrides: Record<string, unknown> = {}) => ({
  status: "ok", context: stamp, value: { capabilityId: "CAP25", selection: { request: requestRef },
    data: { requests: [{ number: requestRef, status: "draft", createdBy: "actor", pr: { description: "visible" } }],
      suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
    versions: { "requests:PR-1": { version: 7, by: "actor" } }, allowedActionIds: ["save", "create"],
    ...overrides },
})
function fixture(body: unknown, calls: { id: string; input: unknown }[] = [], onRead?: () => void): SfTransport {
  return { async execute(operation, input) {
    calls.push({ id: operation.operationId, input })
    onRead?.()
    return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
  } }
}
const signal = () => new AbortController().signal
const run = (input: SfDraftRevalidationInput, body: unknown, context = fresh) =>
  revalidateSfNativeDraft(input, context, fixture(body), signal())

describe("source-bound draft revalidation", () => {
  test("reads the selected PR and returns the actual source CAS version", async () => {
    const calls: { id: string; input: unknown }[] = []
    const result = await revalidateSfNativeDraft(recordInput, fresh, fixture(page(), calls), signal())
    expect(result).toEqual({ status: "authorized", authority: "unchanged", stamp, sourceVersion: 7 })
    expect(calls).toEqual([{ id: "domain.page.CAP25", input: { request: requestRef } }])
  })
  test("PO uses its own fields, writable stage and source version", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, editScopeKey: "po.fields" as SfEditScopeKey,
      read: { ...recordInput.read, fieldPaths: ["po.currency"] } }
    const po = { number: requestRef, status: "po_draft", createdBy: "actor", po: { currency: "USD" } }
    expect(await run(input, page({ data: { requests: [po], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toMatchObject({ status: "authorized", sourceVersion: 7 })
    expect(await run(input, page({ data: { requests: [{ ...po, status: "po_issued" }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toEqual({ status: "denied" })
    expect(await run(recordInput, page({ data: { requests: [{ number: requestRef, status: "po_draft", createdBy: "actor", pr: { description: "visible" } }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toEqual({ status: "denied" })
  })
  test("field and action losses, unknown scopes and missing versions fail closed", async () => {
    expect(await run(recordInput, page({ allowedActionIds: [] }))).toEqual({ status: "denied" })
    expect(await run(recordInput, page({ data: { requests: [{ number: requestRef, status: "draft", createdBy: "actor", pr: {} }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } }))).toEqual({ status: "denied" })
    expect(await run({ ...recordInput, read: { ...recordInput.read, fieldPaths: ["pr.title"] } }, page())).toEqual({ status: "unavailable" })
    expect(await run(recordInput, page({ versions: {} }))).toEqual({ status: "unavailable" })
    expect(await run(recordInput, page({ versions: { "PR-1": { version: 9, by: "actor" } } }))).toEqual({ status: "unavailable" })
    expect(await run(recordInput, page(), { ...fresh, destinations: [] })).toEqual({ status: "denied" })
  })
  test("rejects owner changes, mismatched identities, response selections and late aborts", async () => {
    expect(await run({ ...recordInput, originalOwner: { ...owner, principalRef: "other" } }, page())).toEqual({ status: "authority-changed" })
    expect(await run({ ...recordInput, read: { ...recordInput.read, input: { request: "other" } } }, page())).toEqual({ status: "unavailable" })
    expect(await run(recordInput, page({ selection: { request: "other" } }))).toEqual({ status: "unavailable" })
    expect(await run(recordInput, page({ data: { requests: [{ number: "other", status: "draft", createdBy: "actor" }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } }))).toEqual({ status: "unavailable" })
    expect(await run(recordInput, { ...page(), context: { ...stamp, accessRevision: "changed" } })).toEqual({ status: "authority-changed" })
    const row = { number: requestRef, status: "draft", createdBy: "actor", pr: { description: "visible" } }
    expect(await run(recordInput, page({ data: { requests: [row, row], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } }))).toEqual({ status: "unavailable" })
    const abort = new AbortController()
    expect(await revalidateSfNativeDraft(recordInput, fresh, fixture(page(), [], () => abort.abort()), abort.signal)).toEqual({ status: "unavailable" })
  })
  test("new PR and supplier drafts need their genuine create grants", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, identity: { kind: "new", newIntentRef: "intent" as SfIntentRef },
      read: { operationId: "domain.page.CAP25", input: {}, fieldPaths: [], actionIds: ["create"] } }
    expect(await run(input, page({ selection: {} }))).toMatchObject({ status: "authorized", sourceVersion: null })
    expect(await run(input, page({ selection: {}, allowedActionIds: ["save"] }))).toEqual({ status: "denied" })
    const supplier: SfDraftRevalidationInput = { ...input, surfaceId: "CAP27", editScopeKey: "CAP27:general" as SfEditScopeKey,
      identity: { kind: "new", newIntentRef: "CAP27:supplier-create" as SfIntentRef },
      read: { operationId: "domain.page.CAP27", input: {}, fieldPaths: [], actionIds: ["create"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP27", selection: {},
      data: { suppliers: [], requests: [], formSettings: {}, bankVerificationAvailable: false }, versions: {}, allowedActionIds: ["create"] } }
    expect(await run(supplier, body)).toMatchObject({ status: "authorized", sourceVersion: null })
    expect(await run(supplier, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
  })
  test("settings uses the original scope, retained fieldset and settings CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP28",
      identity: { kind: "record", recordRef: "settings" as SfRef },
      editScopeKey: JSON.stringify(["CAP28", 2026, null]) as SfEditScopeKey,
      read: { operationId: "domain.page.CAP28", input: { year: 2026 }, fieldPaths: ["currency"], actionIds: ["save", "reset"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP28", selection: { year: 2026 },
      data: { settings: { currency: "USD" }, directory: [] }, versions: { settings: { version: 12, by: "actor" } }, allowedActionIds: ["save", "reset"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 12 })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: ["save"] } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { settings: {}, directory: [] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, versions: {} } })).toEqual({ status: "unavailable" })
  })
  test("preserves the opaque case selector and independently stamped version", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "UI29",
      identity: { kind: "record", recordRef: "opaque" as SfRef },
      read: { operationId: "projection.case", input: { caseRef: "opaque" }, fieldPaths: [], actionIds: [] } }
    const projection = { context: { ...stamp, kind: "ui" }, case: { id: "internal", incarnation: "inc", version: 4,
      alternatives: [], criteria: [], state: "draft", objective: "objective", horizon: { start: "2026-01-01", end: "2026-12-31" },
      currency: "USD", participants: [], sourceRefs: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], ledger: [], preparedChanges: [], receipts: [] },
      events: [], evidenceRefs: [], checkedAt: "now" }
    const body = { status: "ok", context: stamp, value: { projection } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 4 })
    expect(await run(input, { ...body, value: { projection: { ...projection, context: { ...projection.context, principalRef: "other" } } } })).toEqual({ status: "denied" })
    expect(await run({ ...input, read: { ...input.read, actionIds: ["save"] } }, body)).toEqual({ status: "unavailable" })
  })
})
