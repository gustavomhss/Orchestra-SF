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
const actionNames = ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"]
const op = (operationId: string) => ({ operationId, state: "ready", reason: null, operational: true })
const fresh = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: (["CAP04", "CAP05"] as const).map((cap) => ({
    capabilityId: cap, surface: "dashboard", page: cap === "CAP04" ? "OPEX Detail" : "CAPEX Projects",
    canRead: true, allowedActionIds: actionNames,
  })),
  availability: (["CAP04", "CAP05"] as const).map((cap) => ({
    family: "domain-read", resource: cap, state: "ready",
    operations: [op("domain.page." + cap), ...actionNames.map((action) => op("domain.command." + cap + "." + action))],
  })),
})
type Cap = "CAP04" | "CAP05"
function intent(cap: Cap, action: string, parent = "o1", month = 1, creating = false): SfDraftRevalidationInput {
  const ownerCollection = cap === "CAP04" ? "opexOwners" : "capexProjects"
  const entryCollection = cap === "CAP04" ? "opexEntries" : "capexEntries"
  const field = action === "save-entry" ? entryCollection : action === "save-deviation" ? "deviations" :
    action === "year-amount" ? "budgetYtd" : ownerCollection
  return {
    surfaceId: cap,
    identity: creating ? { kind: "new", newIntentRef: (cap + ":2026:" + action + ":" + parent + ":" + month) as SfIntentRef }
      : { kind: "record", recordRef: (action === "save-entry" ? "e1" : parent) as SfRef },
    originalOwner: owner,
    editScopeKey: ("2026:" + action + ":" + parent + ":" + month) as SfEditScopeKey,
    read: { operationId: cap === "CAP04" ? "domain.page.CAP04" : "domain.page.CAP05",
      input: { year: 2026 }, fieldPaths: [field], actionIds: [action] },
  }
}
function body(cap: Cap) {
  const prefix = cap === "CAP04" ? "opex" : "capex"
  const collection = cap === "CAP04" ? "opexOwners" : "capexProjects"
  const entry = cap === "CAP04" ? "opexEntries" : "capexEntries"
  const data = cap === "CAP04" ? {
    opexOwners: [{ id: "o1", name: "Owned", budget: 100 }],
    opexEntries: [{ id: "e1", ownerId: "o1", year: 2026, month: 1, budget: 10 }],
    deviations: { "opex-o1-2026-1": { flag: "dev-amber", text: "review" } }, budgetYtd: { opex: {} },
  } : {
    capexProjects: [{ id: "o1", name: "Owned", budget: 100 }],
    capexEntries: [{ id: "e1", projId: "o1", year: 2026, month: 1, budget: 10 }],
    deviations: { "capex-o1-2026-1": { flag: "dev-amber", text: "review" } }, budgetYtd: { capex: {} },
  }
  return { status: "ok", context: stamp, value: { capabilityId: cap,
    selection: { year: 2026, month: 1 }, data,
    versions: { [collection + ":o1"]: 5, [entry + ":e1"]: 7,
      ["deviations:" + prefix + "-o1-2026-1"]: 8, budgetYtd: 9 },
    allowedActionIds: actionNames } }
}
function fixture(value: unknown, calls: { operationId: string; input: unknown }[] = [], onRead?: () => void): SfTransport {
  return { async execute(operation, input) {
    calls.push({ operationId: operation.operationId, input })
    onRead?.()
    return { kind: "response", status: 200, headers: {},
      body: Schema.decodeUnknownSync(Schema.toType(operation.output))(value) }
  } }
}
const run = (input: SfDraftRevalidationInput, value: unknown, context = fresh) =>
  revalidateSfNativeDraft(input, context, fixture(value), new AbortController().signal)

describe("CAP04/CAP05 budget source revalidation", () => {
  test("re-reads authorized CAP04/CAP05 with original selectors, action-specific CAS and A64", async () => {
    for (const cap of ["CAP04", "CAP05"] as const) {
      const calls: { operationId: string; input: unknown }[] = []
      for (const [action, version] of [
        ["save", 5], ["delete", 5], ["annual-entry", 5],
        ["save-entry", 7], ["save-deviation", 8], ["year-amount", 9],
      ] as const) {
        expect(await revalidateSfNativeDraft(intent(cap, action), fresh,
          fixture(body(cap), calls), new AbortController().signal))
          .toMatchObject({ status: "authorized", sourceVersion: version, stamp: { accessRevision: "a64" } })
      }
      expect(calls).toEqual(actionNames.map(() => ({ operationId: "domain.page." + cap, input: { year: 2026 } })))
    }
  })
  test("new owner, month entry, and deviation retain the original absence-version semantics", async () => {
    for (const cap of ["CAP04", "CAP05"] as const) {
      const original = body(cap)
      const newOwner = intent(cap, "save", "new", 1, true)
      const newEntry = intent(cap, "save-entry", "o1", 4, true)
      const newDeviation = intent(cap, "save-deviation", "o1", 4, true)
      expect(await run(newOwner, original)).toMatchObject({ status: "authorized", sourceVersion: 0 })
      expect(await run(newEntry, original)).toMatchObject({ status: "authorized", sourceVersion: 0 })
      expect(await run(newDeviation, original)).toMatchObject({ status: "authorized", sourceVersion: 0 })
      const collection = cap === "CAP04" ? "opexEntries" : "capexEntries"
      const added = { id: "e4", year: 2026, month: 4, [cap === "CAP04" ? "ownerId" : "projId"]: "o1" }
      expect(await run(newEntry, { ...original, value: { ...original.value,
        data: { ...original.value.data, [collection]: [added, ...("opexEntries" in original.value.data ? original.value.data.opexEntries : original.value.data.capexEntries)] } } }))
        .toEqual({ status: "unavailable" })
      const deviationKey = (cap === "CAP04" ? "opex" : "capex") + "-o1-2026-4"
      expect(await run(newDeviation, { ...original, value: { ...original.value,
        data: { ...original.value.data, deviations: { ...original.value.data.deviations, [deviationKey]: { flag: "dev-red" } } } } }))
        .toEqual({ status: "unavailable" })
      expect(await run(newDeviation, { ...original, value: { ...original.value,
        versions: { ...original.value.versions, ["deviations:" + deviationKey]: 12 } } }))
        .toMatchObject({ status: "authorized", sourceVersion: 12 })
    }
  })
  test("rejects edited fields, scopes, identity, stale rows, missing/invalid CAS and wrong selection", async () => {
    const original = body("CAP04")
    const save = intent("CAP04", "save")
    const entry = intent("CAP04", "save-entry")
    expect(await run({ ...save, read: { ...save.read, fieldPaths: ["opexEntries"] } }, original))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...save, editScopeKey: "2025:save:o1:1" as SfEditScopeKey }, original))
      .toEqual({ status: "unavailable" })
    expect(await run({ ...entry, identity: { kind: "record", recordRef: "e2" as SfRef } }, original))
      .toEqual({ status: "unavailable" })
    expect(await run(entry, { ...original, value: { ...original.value,
      data: { ...original.value.data, opexEntries: [{ id: "e1", ownerId: "other", year: 2026, month: 1 }] } } }))
      .toEqual({ status: "unavailable" })
    expect(await run(entry, { ...original, value: { ...original.value, versions: { "opexOwners:o1": 5 } } }))
      .toEqual({ status: "unavailable" })
    expect(await run(entry, { ...original, value: { ...original.value,
      versions: { ...original.value.versions, "opexEntries:e1": 0 } } }))
      .toMatchObject({ status: "authorized", sourceVersion: 0 })
    expect(await run(save, { ...original, value: { ...original.value, selection: { year: 2025, month: 1 } } }))
      .toEqual({ status: "unavailable" })
  })
  test("missing/denied operational evidence and lost source action reject independently", async () => {
    const save = intent("CAP05", "save")
    const original = body("CAP05")
    expect(await run(save, original, { ...fresh, destinations: [] })).toEqual({ status: "denied" })
    expect(await run(save, { ...original, value: { ...original.value, allowedActionIds: [] } }))
      .toEqual({ status: "denied" })
    expect(await run(save, original, { ...fresh,
      availability: fresh.availability.filter((row) => row.resource !== "CAP05") })).toEqual({ status: "unavailable" })
    expect(await run(save, original, { ...fresh, availability: [
      { family: "domain-read", resource: "CAP05", state: "ready", operations: [
        op("domain.page.CAP05"),
        { operationId: "domain.command.CAP05.save", state: "denied", reason: "policy", operational: false },
      ] },
    ] })).toEqual({ status: "denied" })
  })
  test("owner change, full stamp revision loss and late read abort cannot revive drafts", async () => {
    const save = intent("CAP04", "save")
    const original = body("CAP04")
    expect(await run({ ...save, originalOwner: { ...owner, principalRef: "foreign" } }, original))
      .toEqual({ status: "authority-changed" })
    expect(await run(save, { ...original, context: { ...stamp, accessRevision: "a65" } }))
      .toEqual({ status: "authority-changed" })
    const abort = new AbortController()
    expect(await revalidateSfNativeDraft(save, fresh, fixture(original, [], () => abort.abort()), abort.signal))
      .toEqual({ status: "unavailable" })
  })
})
