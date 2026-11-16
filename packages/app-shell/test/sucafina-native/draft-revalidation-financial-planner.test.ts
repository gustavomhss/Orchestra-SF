import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfRef } from "@orchestra/schema/sucafina/context"
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
  destinations: (["CAP18", "CAP19"] as const).map((cap) => ({
    capabilityId: cap, surface: "planner", page: cap === "CAP18" ? "OPEX" : "CAPEX",
    canRead: true, allowedActionIds: ["save"],
  })),
  availability: (["CAP18", "CAP19"] as const).map((cap) => ({
    family: "planner", resource: cap, state: "ready",
    operations: [op("domain.page." + cap), op("domain.command." + cap + ".save")],
  })),
})
type Cap = "CAP18" | "CAP19"
type Field = "lines" | "grid" | "projects"
function intent(cap: Cap, field: Field, id = field === "projects" ? "p1" : "l1"): SfDraftRevalidationInput {
  return { surfaceId: cap, identity: { kind: "record", recordRef: id as SfRef },
    editScopeKey: JSON.stringify([2026, "v1", field === "grid" ? "monthly" : "metadata"]) as SfEditScopeKey,
    originalOwner: owner,
    read: { operationId: cap === "CAP18" ? "domain.page.CAP18" : "domain.page.CAP19",
      input: { year: 2026, version: "v1", q: "team" }, fieldPaths: [field], actionIds: ["save"] } }
}
const version = { id: "v1", name: "Budget", year: 2026, locked: false, closed: 0, official: true }
const value = { value: 100, stored: 100, source: "explicit", editable: true }
const row = { id: "l1", label: "Team", currency: "USD", synthetic: false, revision: 7,
  cells: [{ month: 1, closed: false, manual: true, budget: value, actual: value, forecast: value }] }
function body(cap: Cap) {
  const grid = { versionId: "v1", versionName: "Budget", year: 2026,
    page: cap === "CAP18" ? "OPEX" : "CAPEX", closedThrough: 0, rows: [row] }
  const common = { versions: [version], selectedVersion: version, grid,
    lines: [{ id: "l1", name: "Team", revision: 7, owner: "actor" }] }
  const data = cap === "CAP18" ? { ...common, split: [] } :
    { ...common, projects: [{ id: "p1", name: "Capex", code: "CP", revision: 9 }] }
  return { status: "ok", context: stamp, value: {
    capabilityId: cap, selection: { year: 2026, versionId: "v1", q: "team" }, data,
    versions: { "v1:lines:l1": { version: 7 }, "v1:projects:p1": { version: 9 } },
    allowedActionIds: ["save"],
  } }
}
function fixture(value: unknown, calls: { operationId: string; input: unknown }[] = [], onRead?: () => void): SfTransport {
  return { async execute(operation, input) {
    calls.push({ operationId: operation.operationId, input }); onRead?.()
    return { kind: "response", status: 200, headers: {},
      body: Schema.decodeUnknownSync(Schema.toType(operation.output))(value) }
  } }
}
const run = (input: SfDraftRevalidationInput, value: unknown, context = fresh) =>
  revalidateSfNativeDraft(input, context, fixture(value), new AbortController().signal)

describe("CAP18/CAP19 planner budget source revalidation", () => {
  test("re-reads the exact pageQuery selector, metadata and monthly rows with actual CAS", async () => {
    for (const cap of ["CAP18", "CAP19"] as const) {
      const calls: { operationId: string; input: unknown }[] = []
      for (const field of ["lines", "grid"] as const)
        expect(await revalidateSfNativeDraft(intent(cap, field), fresh,
          fixture(body(cap), calls), new AbortController().signal))
          .toMatchObject({ status: "authorized", sourceVersion: 7, stamp: { accessRevision: "a64" } })
      expect(calls).toEqual([0, 1].map(() => ({
        operationId: "domain.page." + cap, input: { year: 2026, version: "v1", q: "team" },
      })))
    }
    expect(await run(intent("CAP19", "projects"), body("CAP19")))
      .toMatchObject({ status: "authorized", sourceVersion: 9 })
  })
  test("HR grid keys use hrAF, never a fabricated lines key", async () => {
    const original = body("CAP18")
    const hr = { ...row, id: "HR:salary", revision: 6 }
    const changed = { ...original, value: { ...original.value,
      data: { ...original.value.data, grid: { ...original.value.data.grid, rows: [hr] } },
      versions: { "v1:hrAF:HR:salary": { version: 6 } } } }
    expect(await run(intent("CAP18", "grid", "HR:salary"), changed))
      .toMatchObject({ status: "authorized", sourceVersion: 6 })
    expect(await run(intent("CAP18", "grid", "HR:salary"), { ...changed,
      value: { ...changed.value, versions: { "v1:lines:HR:salary": { version: 6 } } } }))
      .toEqual({ status: "unavailable" })
  })
  test("requires matching field, record, filters and selected version, not another row's CAS", async () => {
    const metadata = intent("CAP18", "lines")
    const original = body("CAP18")
    expect(await run({ ...metadata, read: { ...metadata.read, fieldPaths: ["projects"] } }, original))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...metadata, editScopeKey: JSON.stringify([2026, "v2", "metadata"]) as SfEditScopeKey }, original))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...metadata, identity: { kind: "record", recordRef: "other" as SfRef } }, original))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...metadata, read: { ...metadata.read, input: { year: 2026, version: "v1", q: "different" } } }, original))
      .toEqual({ status: "unavailable" })
    expect(await run(metadata, { ...original, value: { ...original.value, selection: { year: 2026, versionId: "v2", q: "team" } } }))
      .toEqual({ status: "unavailable" })
    expect(await run(metadata, { ...original, value: { ...original.value, versions: {} } }))
      .toEqual({ status: "unavailable" })
    expect(await run(metadata, { ...original, value: { ...original.value, versions: { "v1:lines:l1": { version: 8 } } } }))
      .toEqual({ status: "unavailable" })
    expect(await run(metadata, { ...original, value: { ...original.value,
      versions: { "v1:lines:l1": { version: 0 } },
      data: { ...original.value.data, lines: [{ id: "l1", name: "Team", revision: 0 }] } } }))
      .toMatchObject({ status: "authorized", sourceVersion: 0 })
  })
  test("closed/locked stage, lost action, denied evidence and unavailable read fail closed", async () => {
    const metadata = intent("CAP19", "projects")
    const original = body("CAP19")
    const locked = { ...original, value: { ...original.value, data: { ...original.value.data,
      selectedVersion: { ...version, locked: true } } } }
    expect(await run(metadata, locked)).toEqual({ status: "denied" })
    expect(await run(metadata, { ...original, value: { ...original.value, allowedActionIds: [] } }))
      .toEqual({ status: "denied" })
    expect(await run(metadata, original, { ...fresh, destinations: [] })).toEqual({ status: "denied" })
    expect(await run(metadata, original, { ...fresh, availability: [] })).toEqual({ status: "unavailable" })
    expect(await run(metadata, original, { ...fresh, availability: [
      { family: "planner", resource: "CAP19", state: "ready", operations: [
        op("domain.page.CAP19"),
        { operationId: "domain.command.CAP19.save", state: "denied", reason: "revoked", operational: false },
      ] },
    ] })).toEqual({ status: "denied" })
    const inactive = { ...original, value: { ...original.value, data: { ...original.value.data,
      grid: { ...original.value.data.grid, rows: [{ ...row,
        cells: [{ ...row.cells[0], budget: { ...value, editable: false },
          actual: { ...value, editable: false }, forecast: { ...value, editable: false } }] }] } } } }
    expect(await run(intent("CAP19", "grid"), inactive)).toEqual({ status: "denied" })
  })
  test("owner, stamp and abortion protect the original authority even when CAS is unchanged", async () => {
    const metadata = intent("CAP18", "lines")
    const original = body("CAP18")
    expect(await run({ ...metadata, originalOwner: { ...owner, installationId: "foreign" } }, original))
      .toEqual({ status: "authority-changed" })
    expect(await run(metadata, { ...original, context: { ...stamp, policyVersion: "p2" } }))
      .toEqual({ status: "authority-changed" })
    const abort = new AbortController()
    expect(await revalidateSfNativeDraft(metadata, fresh, fixture(original, [], () => abort.abort()), abort.signal))
      .toEqual({ status: "unavailable" })
  })
})
