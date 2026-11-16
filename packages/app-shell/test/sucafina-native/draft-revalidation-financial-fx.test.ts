import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfDraftRevalidationInput } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"

const stamp = { installationId: "install", projectId: "project", hostId: "host",
  principalRef: "actor", policyVersion: "p1", accessRevision: "a64" }
const owner = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test",
  projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const op = (operationId: string) => ({ operationId, state: "ready", reason: null, operational: true })
const fresh = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [{ capabilityId: "CAP22", surface: "planner", page: "FX rates", canRead: true, allowedActionIds: ["save"] }],
  availability: [{ family: "planner", resource: "CAP22", state: "ready",
    operations: [op("domain.page.CAP22"), op("domain.command.CAP22.save")] }],
})
const oldRate: SfDraftRevalidationInput = {
  surfaceId: "CAP22", identity: { kind: "record", recordRef: "r1" as SfRef },
  originalOwner: owner, editScopeKey: "v1" as SfEditScopeKey,
  read: { operationId: "domain.page.CAP22", input: { year: 2026, version: "v1" },
    fieldPaths: ["id", "cur", "rate"], actionIds: ["save"] },
}
const newRate: SfDraftRevalidationInput = {
  ...oldRate, identity: { kind: "new", newIntentRef: "intent-1" as SfIntentRef },
  read: { ...oldRate.read, fieldPaths: ["versions", "rates"] },
}
const version = { id: "v1", name: "Forecast", year: 2026, locked: false, closed: 0, official: true }
const body = { status: "ok", context: stamp, value: {
  capabilityId: "CAP22", selection: { year: 2026, versionId: "v1" },
  data: { versions: [version], selectedVersion: version,
    rates: [{ id: "r1", cur: "EUR", rate: "0.92", revision: 7 }], warnings: [] },
  versions: { "v1:fx:r1": { version: 7 } }, allowedActionIds: ["save"],
} }
function fixture(value: unknown, calls: { operationId: string; input: unknown }[] = [], onRead?: () => void): SfTransport {
  return { async execute(operation, input) {
    calls.push({ operationId: operation.operationId, input }); onRead?.()
    return { kind: "response", status: 200, headers: {},
      body: Schema.decodeUnknownSync(Schema.toType(operation.output))(value) }
  } }
}
const run = (input: SfDraftRevalidationInput, value: unknown, context = fresh) =>
  revalidateSfNativeDraft(input, context, fixture(value), new AbortController().signal)

describe("CAP22 planner FX draft revalidation", () => {
  test("authorized existing rate re-reads original year/version and numeric FX CAS", async () => {
    const calls: { operationId: string; input: unknown }[] = []
    expect(await revalidateSfNativeDraft(oldRate, fresh, fixture(body, calls), new AbortController().signal))
      .toMatchObject({ status: "authorized", sourceVersion: 7, stamp: { accessRevision: "a64" } })
    expect(calls).toEqual([{ operationId: "domain.page.CAP22", input: { year: 2026, version: "v1" } }])
    expect(await run(oldRate, { ...body, value: { ...body.value,
      versions: { "v1:fx:r1": { version: 0 } },
      data: { ...body.value.data, rates: [{ id: "r1", cur: "EUR", rate: "0.92", revision: 0 }] } } }))
      .toMatchObject({ status: "authorized", sourceVersion: 0 })
  })
  test("new FX rate is a null-base intent, not a zero revision or an existing row", async () => {
    expect(await run(newRate, body))
      .toMatchObject({ status: "authorized", sourceVersion: null })
    expect(await run(newRate, { ...body, value: { ...body.value, versions: {} } }))
      .toMatchObject({ status: "authorized", sourceVersion: null })
    expect(await run({ ...newRate, read: { ...newRate.read, fieldPaths: ["rates", "versions"] } }, body))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...newRate, editScopeKey: "v2" as SfEditScopeKey }, body))
      .toEqual({ status: "unavailable" })
  })
  test("retained fields, CAS, row and selector must match the exact authorized projection", async () => {
    expect(await run({ ...oldRate, identity: { kind: "record", recordRef: "missing" as SfRef } }, body))
      .toEqual({ status: "unavailable" })
    expect(await run(oldRate, { ...body, value: { ...body.value, versions: {} } }))
      .toEqual({ status: "unavailable" })
    expect(await run(oldRate, { ...body, value: { ...body.value,
      versions: { "v1:fx:r1": { version: 8 } } } }))
      .toEqual({ status: "unavailable" })
    expect(await run(oldRate, { ...body, value: { ...body.value,
      data: { ...body.value.data, rates: [{ id: "r1", cur: "USD", rate: "1", revision: 7 }] } } }))
      .toEqual({ status: "unavailable" })
    expect(await run(oldRate, { ...body, value: { ...body.value, selection: { year: 2026, versionId: "v2" } } }))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...oldRate, read: { ...oldRate.read, input: { year: 2026, version: "v1", mode: "forecast" } } }, body))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...oldRate, read: { ...oldRate.read, fieldPaths: ["id", "cur"] } }, body))
      .toEqual({ status: "unavailable" })
  })
  test("locked stage, missing/denied operational action or revoked page action rejects restoration", async () => {
    const locked = { ...body, value: { ...body.value,
      data: { ...body.value.data, selectedVersion: { ...version, locked: true } } } }
    expect(await run(oldRate, locked)).toEqual({ status: "denied" })
    expect(await run(oldRate, { ...body, value: { ...body.value, allowedActionIds: [] } }))
      .toEqual({ status: "denied" })
    expect(await run(oldRate, body, { ...fresh, destinations: [] })).toEqual({ status: "denied" })
    expect(await run(oldRate, body, { ...fresh, availability: [] })).toEqual({ status: "unavailable" })
    expect(await run(oldRate, body, { ...fresh, availability: [{
      family: "planner", resource: "CAP22", state: "ready", operations: [
        op("domain.page.CAP22"),
        { operationId: "domain.command.CAP22.save", state: "denied", reason: "revoked", operational: false },
      ],
    }] })).toEqual({ status: "denied" })
  })
  test("changed owner or stamp and aborted source read do not revive original drafts", async () => {
    expect(await run({ ...oldRate, originalOwner: { ...owner, principalRef: "foreign" } }, body))
      .toEqual({ status: "authority-changed" })
    expect(await run(oldRate, { ...body, context: { ...stamp, accessRevision: "a65" } }))
      .toEqual({ status: "authority-changed" })
    const abort = new AbortController()
    expect(await revalidateSfNativeDraft(oldRate, fresh, fixture(body, [], () => abort.abort()), abort.signal))
      .toEqual({ status: "unavailable" })
  })
})
