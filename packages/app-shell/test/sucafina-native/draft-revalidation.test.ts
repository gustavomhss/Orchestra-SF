import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfDraftRevalidationInput } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"
import { bankFields, generalDraftFields } from "../../src/orchestra/chapters/sucafina/procurement/suppliers/model"

// Source-contract fixtures exercise the typed clients, not an installed host or identity service.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const operation = (operationId: string) => ({ operationId, state: "ready", reason: null, operational: true })
const fresh = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [
    { capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: ["save", "create"] },
    { capabilityId: "CAP27", surface: "procurement", page: "Suppliers", canRead: true, allowedActionIds: ["create", "save", "change-bank"] },
    { capabilityId: "CAP28", surface: "procurement", page: "Settings", canRead: true, allowedActionIds: ["save", "reset"] },
    { capabilityId: "CAP23", surface: "planner", page: "Versions", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP14", surface: "dashboard", page: "Vendor Contracts", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP13", surface: "dashboard", page: "IT Risks", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP15", surface: "dashboard", page: "Stakeholder Management", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP07", surface: "dashboard", page: "Team Structure", canRead: true, allowedActionIds: ["saveCio", "saveLeader", "saveMember"] },
    { capabilityId: "CAP08", surface: "dashboard", page: "Talent Review", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP21", surface: "planner", page: "Entities & allocations", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP02", surface: "dashboard", page: "Hot Topics & Actions", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP10", surface: "dashboard", page: "All Projects", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP16", surface: "dashboard", page: "IT Performance Contract", canRead: true, allowedActionIds: ["save", "save-item", "save-sub"] },
    { capabilityId: "CAP12", surface: "dashboard", page: "IT Security KPIs", canRead: true, allowedActionIds: ["save-action"] },
    { capabilityId: "CAP11", surface: "dashboard", page: "IT Operations", canRead: true, allowedActionIds: ["save-sla", "save-categories"] },
  ],
  availability: [
    { family: "procurement", resource: "CAP25", state: "ready", operations: [operation("domain.page.CAP25"), operation("domain.command.CAP25.save"), operation("domain.command.CAP25.create")] },
    { family: "procurement", resource: "CAP27", state: "ready", operations: [operation("domain.page.CAP27"), operation("domain.command.CAP27.create"), operation("domain.command.CAP27.save"), operation("domain.command.CAP27.change-bank")] },
    { family: "procurement", resource: "CAP28", state: "ready", operations: [operation("domain.page.CAP28"), operation("domain.command.CAP28.save"), operation("domain.command.CAP28.reset")] },
    { family: "decisions", resource: "cases", state: "ready", operations: [operation("projection.case")] },
    { family: "planner", resource: "CAP23", state: "ready", operations: [operation("domain.page.CAP23"), operation("domain.command.CAP23.save")] },
    { family: "domain-read", resource: "CAP14", state: "ready", operations: [operation("domain.page.CAP14"), operation("domain.command.CAP14.save")] },
    { family: "domain-read", resource: "CAP13", state: "ready", operations: [operation("domain.page.CAP13"), operation("domain.command.CAP13.save")] },
    { family: "domain-read", resource: "CAP15", state: "ready", operations: [operation("domain.page.CAP15"), operation("domain.command.CAP15.save")] },
    { family: "domain-read", resource: "CAP07", state: "ready", operations: [operation("domain.page.CAP07"), operation("domain.command.CAP07.saveCio"), operation("domain.command.CAP07.saveLeader"), operation("domain.command.CAP07.saveMember")] },
    { family: "domain-read", resource: "CAP08", state: "ready", operations: [operation("domain.page.CAP08"), operation("domain.command.CAP08.save")] },
    { family: "planner", resource: "CAP21", state: "ready", operations: [operation("domain.page.CAP21"), operation("domain.command.CAP21.save")] },
    { family: "domain-read", resource: "CAP02", state: "ready", operations: [operation("domain.page.CAP02"), operation("domain.command.CAP02.save")] },
    { family: "domain-read", resource: "CAP10", state: "ready", operations: [operation("domain.page.CAP10"), operation("domain.command.CAP10.save")] },
    { family: "domain-read", resource: "CAP16", state: "ready", operations: [operation("domain.page.CAP16"), operation("domain.command.CAP16.save"), operation("domain.command.CAP16.save-item"), operation("domain.command.CAP16.save-sub")] },
    { family: "domain-read", resource: "CAP12", state: "ready", operations: [operation("domain.page.CAP12"), operation("domain.command.CAP12.save-action")] },
    { family: "domain-read", resource: "CAP11", state: "ready", operations: [operation("domain.page.CAP11"), operation("domain.command.CAP11.save-sla"), operation("domain.command.CAP11.save-categories")] },
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
    data: { requests: [{ number: requestRef, status: "draft", createdBy: "actor", allowedDraftActions: ["save-pr"], pr: { description: "visible" } }],
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
  test("PO validates the producer's stage-specific save grant and source CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, editScopeKey: "po.fields" as SfEditScopeKey,
      read: { ...recordInput.read, fieldPaths: ["po.currency"] } }
    const po = { number: requestRef, status: "po_draft", createdBy: "actor", allowedDraftActions: ["save-po"], po: { currency: "USD" } }
    expect(await run(input, page({ data: { requests: [po], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toMatchObject({ status: "authorized", sourceVersion: 7 })
    expect(await run(input, page({ data: { requests: [{ ...po, allowedDraftActions: [] }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toEqual({ status: "denied" })
    const { allowedDraftActions, ...oldPo } = po
    expect(allowedDraftActions).toEqual(["save-po"])
    expect(await run(input, page({ data: { requests: [oldPo], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toEqual({ status: "unavailable" })
    expect(await run(input, page({ data: { requests: [{ ...po, status: "po_issued" }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toEqual({ status: "denied" })
    expect(await run(recordInput, page({ data: { requests: [{ number: requestRef, status: "po_draft", createdBy: "actor", pr: { description: "visible" } }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } })))
      .toEqual({ status: "denied" })
  })
  test("field and action losses, unknown scopes and missing versions fail closed", async () => {
    expect(await run(recordInput, page({ allowedActionIds: [] }))).toEqual({ status: "denied" })
    expect(await run(recordInput, page({ data: { requests: [{ number: requestRef, status: "draft", createdBy: "actor", allowedDraftActions: ["save-pr"], pr: {} }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } }))).toEqual({ status: "denied" })
    expect(await run(recordInput, page({ data: { requests: [{ number: requestRef, status: "draft", createdBy: "actor", pr: { description: "visible" } }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } }))).toEqual({ status: "unavailable" })
    expect(await run(recordInput, page({ data: { requests: [{ number: requestRef, status: "draft", createdBy: "another", allowedDraftActions: ["save-pr"], pr: { description: "visible" } }], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false } }))).toMatchObject({ status: "authorized", sourceVersion: 7 })
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
      read: { operationId: "domain.page.CAP27", input: {}, fieldPaths: generalDraftFields, actionIds: ["create"] } }
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
    const unavailable = Schema.decodeUnknownSync(SfContext)({ ...fresh, destinations: [], availability: [{ family: "procurement", resource: "CAP28", state: "unavailable", operations: [] }] })
    expect(await run(input, body, unavailable)).toEqual({ status: "unavailable" })
    const commandOffline = Schema.decodeUnknownSync(SfContext)({ ...fresh, availability: [{ family: "procurement", resource: "CAP28", state: "ready", operations: [operation("domain.page.CAP28"), operation("domain.command.CAP28.save"), { operationId: "domain.command.CAP28.reset", state: "unavailable", operational: false, reason: "network" }] }] })
    expect(await run(input, body, commandOffline)).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: ["save"] } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { settings: {}, directory: [] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, versions: {} } })).toEqual({ status: "unavailable" })
  })
  test("supplier edits recheck the selected record, canonical group and exact action", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP27",
      identity: { kind: "record", recordRef: "supplier-1" as SfRef }, editScopeKey: "CAP27:general" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP27", input: { supplier: "supplier-1" }, fieldPaths: generalDraftFields, actionIds: ["save"] } }
    const supplier = { id: "supplier-1", legalName: "Supplier", commercial: { notes: "visible" }, iban: "secret" }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP27", selection: { supplier: "supplier-1" },
      data: { suppliers: [supplier], requests: [], formSettings: {}, bankVerificationAvailable: true },
      versions: { "suppliers:supplier-1": { version: 5, by: "actor" } }, allowedActionIds: ["save", "change-bank"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 5 })
    const unavailable = Schema.decodeUnknownSync(SfContext)({ ...fresh, destinations: [], availability: [{ family: "procurement", resource: "CAP27", state: "unavailable", operations: [] }] })
    expect(await run(input, body, unavailable)).toEqual({ status: "unavailable" })
    const readOffline = Schema.decodeUnknownSync(SfContext)({ ...fresh, availability: [{ family: "procurement", resource: "CAP27", state: "ready", operations: [{ operationId: "domain.page.CAP27", state: "unavailable", operational: false, reason: "network" }, operation("domain.command.CAP27.save")] }] })
    expect(await run(input, body, readOffline)).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, data: { ...body.value.data, suppliers: [{ ...supplier, commercial: {} }] } } })).toMatchObject({ status: "authorized", sourceVersion: 5 })
    expect(await run({ ...input, read: { ...input.read, fieldPaths: ["legalName"] } }, body)).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: ["change-bank"] } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { ...body.value.data, suppliers: [{ ...supplier, id: "other" }] } } })).toEqual({ status: "unavailable" })
    const bank: SfDraftRevalidationInput = { ...input, editScopeKey: "CAP27:bank" as SfEditScopeKey,
      read: { ...input.read, fieldPaths: bankFields, actionIds: ["change-bank"] } }
    expect(await run(bank, body)).toMatchObject({ status: "authorized", sourceVersion: 5 })
    expect(await run(bank, { ...body, value: { ...body.value, data: { ...body.value.data, suppliers: [{ id: "supplier-1", legalName: "Supplier" }] } } })).toMatchObject({ status: "authorized", sourceVersion: 5 })
    expect(await run(bank, { ...body, value: { ...body.value, data: { ...body.value.data, bankVerificationAvailable: false } } })).toEqual({ status: "denied" })
    expect(await run(bank, { ...body, value: { ...body.value, allowedActionIds: ["save"] } })).toEqual({ status: "denied" })
  })
  test("sourcing binds each retained field to the same quote and editable request", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, editScopeKey: "CAP25:sourcing" as SfEditScopeKey,
      read: { ...recordInput.read, fieldPaths: ["sourcing.evaluator", "sourcing.quotes", 'sourcing.quote:["q1","supplier"]'] } }
    const row = { number: requestRef, status: "sourcing", createdBy: "actor", allowedDraftActions: ["save-sourcing"], sourcing: { evaluator: "actor", quotes: [{ id: "q1", supplier: "visible" }] } }
    const data = { requests: [row], suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false }
    expect(await run(input, page({ data }))).toMatchObject({ status: "authorized", sourceVersion: 7 })
    expect(await run(input, page({ data: { ...data, requests: [{ ...row, allowedDraftActions: [] }] } }))).toEqual({ status: "denied" })
    const { allowedDraftActions, ...oldRow } = row
    expect(allowedDraftActions).toEqual(["save-sourcing"])
    expect(await run(input, page({ data: { ...data, requests: [oldRow] } }))).toEqual({ status: "unavailable" })
    expect(await run(input, page({ data: { ...data, requests: [{ ...row, status: "po_draft" }] } }))).toEqual({ status: "denied" })
    expect(await run(input, page({ data: { ...data, requests: [{ ...row, sourcing: { ...row.sourcing, quotes: [{ id: "q2", supplier: "visible" }] } }] } }))).toEqual({ status: "denied" })
    expect(await run(input, page({ data, allowedActionIds: [] }))).toEqual({ status: "denied" })
    expect(await run(input, page({ data: { ...data, requests: [{ ...row, sourcing: { quotes: [{ supplier: "no-id" }] } }] } }))).toEqual({ status: "unavailable" })
    expect(await run({ ...input, read: { ...input.read, fieldPaths: ["sourcing"] } }, page({ data }))).toEqual({ status: "unavailable" })
  })
  test("planner version uses its actual read selector and version CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP23",
      identity: { kind: "record", recordRef: "v1" as SfRef }, editScopeKey: "planner:2026:v1" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP23", input: {}, fieldPaths: ["name", "year"], actionIds: ["save"] } }
    const version = { id: "v1", name: "Plan", year: 2026, locked: false, closed: 0, official: false }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP23", selection: { year: 2026 },
      data: { versions: [version] }, versions: { "versions:v1": { version: 8, by: "actor" } }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 8 })
    expect(await run(input, { ...body, value: { ...body.value, versions: {} } })).toMatchObject({ status: "authorized", sourceVersion: 0 })
    expect(await run(input, { ...body, value: { ...body.value, data: { versions: [{ ...version, id: "v2" }] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    expect(await run({ ...input, editScopeKey: "planner:2025:v1" as SfEditScopeKey }, body)).toEqual({ status: "unavailable" })
  })
  test("vendor contract save reauthorizes existing and genuine new records", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP14",
      identity: { kind: "record", recordRef: "c1" as SfRef }, editScopeKey: "vendor-contract-fields" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP14", input: {}, fieldPaths: ["vendor", "amount"], actionIds: ["save"] } }
    const row = { id: "c1", vendor: "Visible", amount: 4 }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP14", selection: {},
      data: { contracts: [row] }, versions: { "contracts:c1": 6 }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 6 })
    expect(await run(input, { ...body, value: { ...body.value, data: { contracts: [{ id: "c1", vendor: "Visible" }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { contracts: [{ ...row, id: "c2" }] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    const created: SfDraftRevalidationInput = { ...input, identity: { kind: "new", newIntentRef: "new-contract" as SfIntentRef },
      read: { ...input.read, fieldPaths: [] } }
    expect(await run(created, body)).toMatchObject({ status: "authorized", sourceVersion: null })
  })
  test("risk and stakeholder drafts retain their original filter and collection CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP13", identity: { kind: "record", recordRef: "r1" as SfRef },
      editScopeKey: "native-record:CAP13" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP13", input: { status: "open" }, fieldPaths: ["name", "status"], actionIds: ["save"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP13", selection: { status: "open", year: 2026, month: 1 },
      data: { risks: [{ id: "r1", name: "Risk", status: "open" }] }, versions: { "risks:r1": 2 }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 2 })
    expect(await run(input, { ...body, value: { ...body.value, data: { risks: [{ id: "r1", name: "Risk" }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, versions: {} } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    const stakeholder: SfDraftRevalidationInput = { ...input, surfaceId: "CAP15", identity: { kind: "record", recordRef: "s1" as SfRef },
      editScopeKey: "native-record:CAP15" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP15", input: {}, fieldPaths: ["email"], actionIds: ["save"] } }
    const other = { status: "ok", context: stamp, value: { capabilityId: "CAP15", selection: { year: 2026, month: 1 },
      data: { stakeholders: [{ id: "s1", email: "source" }] }, versions: { "stakeholders:s1": 3 }, allowedActionIds: ["save"] } }
    expect(await run(stakeholder, other)).toMatchObject({ status: "authorized", sourceVersion: 3 })
    expect(await run({ ...stakeholder, identity: { kind: "new", newIntentRef: "n16-new:CAP15" as SfIntentRef },
      read: { ...stakeholder.read, fieldPaths: [] } }, other)).toMatchObject({ status: "authorized", sourceVersion: null })
  })
  test("people drafts recheck source selection, private fields, exact action and CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP08", identity: { kind: "record", recordRef: "m1" as SfRef },
      editScopeKey: "people:talent:2026:talent" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP08", input: { year: 2026, memberStatus: "Active" }, fieldPaths: ["name", "notes"], actionIds: ["save"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP08", selection: { year: 2026, month: 1, memberStatus: "Active" },
      data: { members: [{ id: "m1", name: "Person", notes: "private" }] }, versions: { "members:m1": 4 }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 4 })
    expect(await run(input, { ...body, value: { ...body.value, data: { members: [{ id: "m1", name: "Person" }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { members: [{ id: "m2", name: "Person", notes: "private" }] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    const leader: SfDraftRevalidationInput = { ...input, surfaceId: "CAP07", identity: { kind: "record", recordRef: "l1" as SfRef },
      editScopeKey: "people:structure:current:leader" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP07", input: {}, fieldPaths: ["name"], actionIds: ["saveLeader"] } }
    const structure = { status: "ok", context: stamp, value: { capabilityId: "CAP07", selection: { year: 2026, month: 1 },
      data: { cio: {}, leaders: [{ id: "l1", name: "Leader" }], members: [] }, versions: { "leaders:l1": 6 }, allowedActionIds: ["saveLeader"] } }
    expect(await run(leader, structure)).toMatchObject({ status: "authorized", sourceVersion: 6 })
    expect(await run({ ...leader, identity: { kind: "new", newIntentRef: "sf-people-CAP07-leader-new" as SfIntentRef },
      read: { ...leader.read, fieldPaths: [] } }, structure)).toMatchObject({ status: "authorized", sourceVersion: 0 })
    expect(await run(leader, { ...structure, value: { ...structure.value, versions: {} } })).toEqual({ status: "unavailable" })
    expect(await run(leader, { ...structure, value: { ...structure.value, versions: { "leaders:l1": 0 } } })).toMatchObject({ status: "authorized", sourceVersion: 0 })
    expect(await run({ ...leader, read: { ...leader.read, actionIds: ["deleteLeader"] } }, structure)).toEqual({ status: "unavailable" })
    expect(await run({ ...leader, read: { ...leader.read, fieldPaths: ["private"] } }, structure)).toEqual({ status: "unavailable" })
    expect(await run({ ...leader, identity: { kind: "new", newIntentRef: "sf-people-CAP07-leader-new" as SfIntentRef },
      read: { ...leader.read, fieldPaths: [] } }, { ...structure, value: { ...structure.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    const cio: SfDraftRevalidationInput = { ...leader, identity: { kind: "record", recordRef: "cio" as SfRef },
      editScopeKey: "people:structure:current:cio" as SfEditScopeKey,
      read: { ...leader.read, fieldPaths: [], actionIds: ["saveCio"] } }
    expect(await run(cio, { ...structure, value: { ...structure.value, versions: { cio: 0 }, allowedActionIds: ["saveCio"] } })).toMatchObject({ status: "authorized", sourceVersion: 0 })
    const member: SfDraftRevalidationInput = { ...leader, identity: { kind: "record", recordRef: "m1" as SfRef },
      editScopeKey: "people:structure:current:member" as SfEditScopeKey,
      read: { ...leader.read, fieldPaths: ["name"], actionIds: ["saveMember"] } }
    expect(await run(member, { ...structure, value: { ...structure.value, data: { ...structure.value.data, members: [{ id: "m1", name: "Member" }] },
      versions: { "members:m1": 9 }, allowedActionIds: ["saveMember"] } })).toMatchObject({ status: "authorized", sourceVersion: 9 })
    expect(await run(leader, { ...structure, context: { ...stamp, accessRevision: "changed" } })).toEqual({ status: "authority-changed" })
    const abort = new AbortController()
    expect(await revalidateSfNativeDraft(leader, fresh, fixture(structure, [], () => abort.abort()), abort.signal)).toEqual({ status: "unavailable" })
  })
  test("planner catalog scopes the record to its actual collection and source fields", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP21", identity: { kind: "record", recordRef: "item" as SfRef },
      editScopeKey: "shared-catalog:entities" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP21", input: { year: 2026 }, fieldPaths: ["id", "name", "code"], actionIds: ["save"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP21", selection: { year: 2026 },
      data: { entities: [{ id: "item", name: "Entity", code: "E", revision: 2 }], allocations: [] },
      versions: { "entities:item": { version: 2 } }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 2 })
    expect(await run(input, { ...body, value: { ...body.value, data: { entities: [], allocations: [{ id: "item", name: "Entity", revision: 2 }] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, data: { ...body.value.data, entities: [{ id: "item", name: "Entity", revision: 2 }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    expect(await run({ ...input, identity: { kind: "new", newIntentRef: "new" as SfIntentRef },
      read: { ...input.read, fieldPaths: [] } }, body)).toMatchObject({ status: "authorized", sourceVersion: null })
  })
  test("hot topics bind the actual filtered read and source record", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP02", identity: { kind: "record", recordRef: "t1" as SfRef },
      editScopeKey: "hotTopics:t1" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP02", input: { topicStatus: "open" }, fieldPaths: ["action", "notes"], actionIds: ["save"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP02", selection: { year: 2026, month: 1, topicStatus: "open" },
      data: { hotTopics: [{ id: "t1", action: "Act", notes: "visible" }] }, versions: { "hotTopics:t1": 5 }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 5 })
    expect(await run(input, { ...body, value: { ...body.value, data: { hotTopics: [{ id: "t1", action: "Act" }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { hotTopics: [] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    expect(await run({ ...input, identity: { kind: "new", newIntentRef: "new" as SfIntentRef }, editScopeKey: "hotTopics:new" as SfEditScopeKey,
      read: { ...input.read, fieldPaths: [] } }, body)).toMatchObject({ status: "authorized", sourceVersion: null })
  })
  test("project drafts use the A01 numeric source version and exact projected fields", async () => {
    const ref = "p1" as SfRef
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP10", identity: { kind: "record", recordRef: ref },
      editScopeKey: ("CAP10:All Projects:" + JSON.stringify(["install", "actor", "edit", ref])) as SfEditScopeKey,
      read: { operationId: "domain.page.CAP10", input: { year: 2026 }, fieldPaths: ["name", "budget"], actionIds: ["save"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP10", selection: { year: 2026, month: 1 },
      data: { projects: [{ id: ref, name: "Project", budget: 12 }] }, versions: { "projects:p1": 9 }, allowedActionIds: ["save"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 9 })
    expect(await run(input, { ...body, value: { ...body.value, data: { projects: [{ id: ref, name: "Project" }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, versions: {} } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    const newRef = "new-project" as SfIntentRef
    expect(await run({ ...input, identity: { kind: "new", newIntentRef: newRef },
      editScopeKey: ("CAP10:All Projects:" + JSON.stringify(["install", "actor", "new", newRef])) as SfEditScopeKey,
      read: { ...input.read, fieldPaths: [] } }, body)).toMatchObject({ status: "authorized", sourceVersion: null })
  })
  test("performance subitem validates parent, source fields and shared itperf CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP16", identity: { kind: "record", recordRef: "s1" as SfRef },
      editScopeKey: "cap16:sub:i1" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP16", input: {}, fieldPaths: ["label", "notes"], actionIds: ["save-sub"] } }
    const item = { id: "i1", subs: [{ id: "s1", label: "Sub", notes: "Visible" }] }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP16", selection: { year: 2026, month: 1 },
      data: { itperf: { name: "Contract", items: [item] } }, versions: { itperf: 10 }, allowedActionIds: ["save-sub"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 10 })
    expect(await run(input, { ...body, value: { ...body.value, data: { itperf: { items: [{ id: "i2", subs: item.subs }] } } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, data: { itperf: { items: [{ id: "i1", subs: [{ id: "s1", label: "Sub" }] }] } } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, versions: {} } })).toEqual({ status: "unavailable" })
    expect(await run({ ...input, identity: { kind: "new", newIntentRef: "n16-new:sub:i1" as SfIntentRef },
      read: { ...input.read, fieldPaths: [] } }, body)).toEqual({ status: "unavailable" })
  })
  test("security draft binds the original period, entity, disclosed fields and source CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP12", identity: { kind: "record", recordRef: "a1" as SfRef },
      editScopeKey: "CAP12:save-action:2026:1:a1" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP12", input: { secYear: 2026, securityMonth: 1 }, fieldPaths: ["text", "done"], actionIds: ["save-action"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP12", selection: { year: 2026, month: 1 },
      data: { secActions: [{ id: "a1", text: "Action", done: false }] }, versions: { "secActions:a1": 3 }, allowedActionIds: ["save-action"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 3 })
    expect(await run(input, { ...body, value: { ...body.value, data: { secActions: [{ id: "a1", text: "Action" }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { secActions: [{ id: "other", text: "Action", done: false }] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    const scope = "CAP12:save-action:2026:1:new"
    expect(await run({ ...input, identity: { kind: "new", newIntentRef: ("u29:" + scope) as SfIntentRef },
      editScopeKey: scope as SfEditScopeKey, read: { ...input.read, fieldPaths: [] } }, body)).toMatchObject({ status: "authorized", sourceVersion: null })
  })
  test("service draft binds the source month record and shared CAS", async () => {
    const input: SfDraftRevalidationInput = { ...recordInput, surfaceId: "CAP11", identity: { kind: "record", recordRef: "sla1" as SfRef },
      editScopeKey: "CAP11:save-sla:2026-1" as SfEditScopeKey,
      read: { operationId: "domain.page.CAP11", input: { opsYear: 2026, operationsMonth: 1 }, fieldPaths: ["incSLA"], actionIds: ["save-sla"] } }
    const body = { status: "ok", context: stamp, value: { capabilityId: "CAP11", selection: { year: 2026, month: 1 },
      data: { opsSLA: [{ id: "sla1", year: 2026, month: 1, incSLA: 93 }] }, versions: { "ops:2026-1": 7 }, allowedActionIds: ["save-sla"] } }
    expect(await run(input, body)).toMatchObject({ status: "authorized", sourceVersion: 7 })
    expect(await run(input, { ...body, value: { ...body.value, data: { opsSLA: [{ id: "sla1", year: 2026, month: 1 }] } } })).toEqual({ status: "denied" })
    expect(await run(input, { ...body, value: { ...body.value, data: { opsSLA: [{ id: "other", year: 2026, month: 1, incSLA: 93 }] } } })).toEqual({ status: "unavailable" })
    expect(await run(input, { ...body, value: { ...body.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
    expect(await run({ ...input, identity: { kind: "new", newIntentRef: "new" as SfIntentRef }, read: { ...input.read, fieldPaths: [] } }, body)).toEqual({ status: "unavailable" })
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
    expect(await run(input, { ...body, value: { projection: { ...projection, context: { ...projection.context, principalRef: "other" } } } })).toEqual({ status: "authority-changed" })
    expect(await run({ ...input, read: { ...input.read, actionIds: ["save"] } }, body)).toEqual({ status: "unavailable" })
  })
})
