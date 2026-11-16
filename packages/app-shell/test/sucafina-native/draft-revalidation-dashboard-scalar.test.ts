import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfOwnerKey, type SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfDraftRevalidationInput } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"

// The producer envelopes go through the real typed client; this is not an installed-host test.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const owner = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test", projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const op = (operationId: string) => ({ operationId, state: "ready", reason: null, operational: true })
const fresh = Schema.decodeUnknownSync(SfContext)({ stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [
    { capabilityId: "CAP01", surface: "dashboard", page: "Executive Dashboard", canRead: true, allowedActionIds: ["save-users", "save-benchmark"] },
    { capabilityId: "CAP03", surface: "dashboard", page: "Budget Overview", canRead: true, allowedActionIds: ["save-month", "save-revenue"] },
  ], availability: [
    { family: "domain-read", resource: "CAP01", state: "ready", operations: [op("domain.page.CAP01"), op("domain.command.CAP01.save-users"), op("domain.command.CAP01.save-benchmark")] },
    { family: "domain-read", resource: "CAP03", state: "ready", operations: [op("domain.page.CAP03"), op("domain.command.CAP03.save-month"), op("domain.command.CAP03.save-revenue")] },
  ] })
const users: SfDraftRevalidationInput = { surfaceId: "CAP01", identity: { kind: "record", recordRef: "u1" as SfRef },
  editScopeKey: "CAP01:2026:4:users" as SfEditScopeKey, originalOwner: owner,
  read: { operationId: "domain.page.CAP01", input: { execYear: 2026, executiveMonth: 4 }, fieldPaths: ["data.itUsersMonthly"], actionIds: ["save-users"] } }
const benchmark: SfDraftRevalidationInput = { ...users, identity: { kind: "record", recordRef: "b1" as SfRef },
  editScopeKey: "CAP01:2026:benchmark" as SfEditScopeKey,
  read: { ...users.read, fieldPaths: ["data.costPerUserBenchmarks"], actionIds: ["save-benchmark"] } }
const month: SfDraftRevalidationInput = { ...users, surfaceId: "CAP03", identity: { kind: "new", newIntentRef: "intent" as SfIntentRef },
  editScopeKey: "CAP03:2026:month" as SfEditScopeKey,
  read: { operationId: "domain.page.CAP03", input: { year: 2026 }, fieldPaths: ["data.budgetCurrentMonth"], actionIds: ["save-month"] } }
const revenue: SfDraftRevalidationInput = { ...month, editScopeKey: "CAP03:2026:revenue" as SfEditScopeKey,
  read: { ...month.read, fieldPaths: ["data.revenueByYear"], actionIds: ["save-revenue"] } }
const userRow = { id: "u1", year: 2026, month: 4, users: 42 }
const benchRow = { id: "b1", year: 2026, value: 12 }
const executive = { status: "ok", context: stamp, value: { capabilityId: "CAP01", selection: { execYear: 2026, executiveMonth: 4, year: 2026, month: 4 },
  data: { itUsersMonthly: [userRow], costPerUserBenchmarks: [benchRow] },
  versions: { "itUsersMonthly:u1": 7, "costPerUserBenchmarks:b1": 8 }, allowedActionIds: ["save-users", "save-benchmark"] } }
const budget = { status: "ok", context: stamp, value: { capabilityId: "CAP03", selection: { year: 2026, month: 4 },
  data: { budgetCurrentMonth: { "2026": 4 }, revenueByYear: { "2026": 200 } },
  versions: { budgetCurrentMonth: 11, revenueByYear: 13 }, allowedActionIds: ["save-month", "save-revenue"] } }
function fixture(body: unknown, calls: { id: string; input: unknown }[] = [], onRead?: () => void): SfTransport {
  return { async execute(operation, input) {
    calls.push({ id: operation.operationId, input }); onRead?.()
    return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
  } }
}
const run = (input: SfDraftRevalidationInput, body: unknown, context = fresh) =>
  revalidateSfNativeDraft(input, context, fixture(body), new AbortController().signal)

describe("dashboard scalar source revalidation", () => {
  test("binds each typed read to the selected record and its original numeric CAS", async () => {
    const calls: { id: string; input: unknown }[] = []
    expect(await revalidateSfNativeDraft(users, fresh, fixture(executive, calls), new AbortController().signal))
      .toMatchObject({ status: "authorized", sourceVersion: 7 })
    expect(calls).toEqual([{ id: "domain.page.CAP01", input: { execYear: 2026, executiveMonth: 4 } }])
    expect(await run(benchmark, executive)).toMatchObject({ status: "authorized", sourceVersion: 8 })
    // The group's grant does not require every optional scalar on an existing row.
    expect(await run(users, { ...executive, value: { ...executive.value, data: { itUsersMonthly: [{ id: "u1", year: 2026, month: 4, value: 2 }] } } }))
      .toMatchObject({ status: "authorized", sourceVersion: 7 })
    expect(await run(users, { ...executive, value: { ...executive.value, data: { itUsersMonthly: [{ ...userRow, futureOptionalSourceField: "new" }] } } }))
      .toMatchObject({ status: "authorized", sourceVersion: 7 })
  })
  test("new CAP01 rows prove exact absence, never fallback, duplicates or missing collections", async () => {
    const created: SfDraftRevalidationInput = { ...users, identity: { kind: "new", newIntentRef: "new" as SfIntentRef } }
    const absent = { ...executive, value: { ...executive.value, data: { itUsersMonthly: [{ id: "old", year: 2026, month: 3, users: 10 }] } } }
    expect(await run(created, absent)).toMatchObject({ status: "authorized", sourceVersion: 0 })
    expect(await run(created, executive)).toEqual({ status: "unavailable" })
    expect(await run(created, { ...executive, value: { ...executive.value, data: {} } })).toEqual({ status: "unavailable" })
    expect(await run(users, { ...executive, value: { ...executive.value, data: { itUsersMonthly: [userRow, { ...userRow, id: "u2" }] } } })).toEqual({ status: "unavailable" })
    expect(await run(users, { ...executive, value: { ...executive.value, data: { itUsersMonthly: [userRow, { ...userRow, month: 3 }] } } })).toEqual({ status: "unavailable" })
    expect(await run({ ...benchmark, identity: { kind: "new", newIntentRef: "new" as SfIntentRef } },
      { ...executive, value: { ...executive.value, data: { costPerUserBenchmarks: [] } } })).toMatchObject({ status: "authorized", sourceVersion: 0 })
  })
  test("singleton intents return whole-map revisions, including when the selected year is absent", async () => {
    expect(await run(month, budget)).toMatchObject({ status: "authorized", sourceVersion: 11 })
    expect(await run(revenue, budget)).toMatchObject({ status: "authorized", sourceVersion: 13 })
    expect(await run(month, { ...budget, value: { ...budget.value, data: { budgetCurrentMonth: { "2025": 3 } } } }))
      .toMatchObject({ status: "authorized", sourceVersion: 11 })
    expect(await run(month, { ...budget, value: { ...budget.value, versions: {} } })).toEqual({ status: "unavailable" })
    expect(await run(month, { ...budget, value: { ...budget.value, versions: { budgetCurrentMonth: 0 } } })).toMatchObject({ status: "authorized", sourceVersion: 0 })
    expect(await run(month, { ...budget, value: { ...budget.value, data: {} } })).toEqual({ status: "unavailable" })
    expect(await run({ ...month, identity: { kind: "record", recordRef: "2026" as SfRef } }, budget)).toEqual({ status: "unavailable" })
  })
  test("rejects mismatched scope, selector, row, field and source version", async () => {
    expect(await run({ ...users, editScopeKey: "CAP01:2025:4:users" as SfEditScopeKey }, executive)).toEqual({ status: "unavailable" })
    expect(await run({ ...users, read: { ...users.read, input: { execYear: 2026, executiveMonth: 4, opsMonth: 4 } } }, executive)).toEqual({ status: "unavailable" })
    expect(await run({ ...users, read: { ...users.read, fieldPaths: ["data.revenueByYear"] } }, executive)).toEqual({ status: "unavailable" })
    expect(await run({ ...users, read: { ...users.read, actionIds: ["delete"] } }, executive)).toEqual({ status: "unavailable" })
    expect(await run(users, { ...executive, value: { ...executive.value, selection: { ...executive.value.selection, year: 2025 } } })).toEqual({ status: "unavailable" })
    expect(await run(month, { ...budget, value: { ...budget.value, selection: { year: 2025, month: 4 } } })).toEqual({ status: "unavailable" })
    expect(await run(users, { ...executive, value: { ...executive.value, data: { itUsersMonthly: [{ ...userRow, id: "other" }] } } })).toEqual({ status: "unavailable" })
    expect(await run(users, { ...executive, value: { ...executive.value, versions: {} } })).toEqual({ status: "unavailable" })
    expect(await run(users, { ...executive, value: { ...executive.value, versions: { "itUsersMonthly:u1": -1 } } })).toEqual({ status: "unavailable" })
  })
  test("requires both operational observations and both real action grants", async () => {
    const missing = Schema.decodeUnknownSync(SfContext)({ ...fresh, availability: [{ family: "domain-read", resource: "CAP01", state: "ready", operations: [op("domain.page.CAP01")] }] })
    expect(await run(users, executive, missing)).toEqual({ status: "unavailable" })
    const offline = Schema.decodeUnknownSync(SfContext)({ ...fresh, availability: [{ family: "domain-read", resource: "CAP01", state: "ready", operations: [op("domain.page.CAP01"), { operationId: "domain.command.CAP01.save-users", state: "unavailable", reason: "offline", operational: false }] }] })
    expect(await run(users, executive, offline)).toEqual({ status: "unavailable" })
    const denied = Schema.decodeUnknownSync(SfContext)({ ...fresh, availability: [{ family: "domain-read", resource: "CAP01", state: "ready", operations: [op("domain.page.CAP01"), { operationId: "domain.command.CAP01.save-users", state: "denied", reason: "denied", operational: false }] }] })
    expect(await run(users, executive, denied)).toEqual({ status: "denied" })
    expect(await run(users, executive, { ...fresh, destinations: [] })).toEqual({ status: "denied" })
    expect(await run(users, { ...executive, value: { ...executive.value, allowedActionIds: [] } })).toEqual({ status: "denied" })
  })
  test("foreign authority and abort cannot restore", async () => {
    expect(await run({ ...users, originalOwner: { ...owner, principalRef: "other" } }, executive)).toEqual({ status: "authority-changed" })
    expect(await run(users, { ...executive, context: { ...stamp, hostId: "other" } })).toEqual({ status: "authority-changed" })
    const abort = new AbortController()
    expect(await revalidateSfNativeDraft(users, fresh, fixture(executive, [], () => abort.abort()), abort.signal)).toEqual({ status: "unavailable" })
  })
  test("a changed singleton CAS preserves the dirty value and marks conflict", async () => {
    const deps = { createDraft: createSfDraft, revalidateDraft: revalidateSfNativeDraft } as unknown as SfContextDependencies
    const drafts = createSfOwnerDrafts(deps, { key: "old" as SfOwnerKey, identity: owner })
    const draft = drafts.registry.acquire({ surfaceId: "CAP03", identity: month.identity, editScopeKey: month.editScopeKey,
      baseVersion: 10, base: null, value: { text: "4" }, revalidation: month.read })
    draft.edit({ text: "9" }); drafts.quarantine()
    expect(await drafts.revalidate({ key: "new" as SfOwnerKey, identity: owner }, fresh, fixture(budget), new AbortController().signal)).toBe(true)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", baseVersion: 10, value: { text: "9" } })
  })
})
