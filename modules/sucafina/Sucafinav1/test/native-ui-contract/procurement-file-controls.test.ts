import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfProcurement } from "../../../../../packages/schema/src/sucafina/procurement.ts"
import { createSfProcurementProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { settingsReview, settingsVersion } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/model.ts"
import type { SfOperationRef } from "../../../../../packages/schema/src/sucafina/context.ts"
import { initialProcurementSettings } from "../../src/initial-settings.ts"
import { domain } from "../../runtime/procurement.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"

// Original domain + native projection boundary tests. These in-process fixtures
// do not claim installed identity, durable storage, scanner or browser qualification.
const environment = { at: "2026-11-20T12:00:00Z", id: () => "supplier-1",
  directory: [{ id: "actor", name: "Fixture actor" }] }
const admin = { id: "actor", roles: ["admin"], canWrite: true }
const reset = { page: "Settings", action: "reset", version: 0, values: {} }
const operation = "settings-reset-review" as SfOperationRef
function fixture() {
  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const controls: {
    role: "admin" | "buyer" | "supplier admin" | "viewer" | null
    writable: boolean; sourceCurrent: boolean; endFence: "current" | "denied" | "changed"; reads: number
  } = { role: "admin", writable: true, sourceCurrent: true, endFence: "current", reads: 0 }
  const commits: boolean[] = []
  const handlers = createSfProcurementProjectionHandlers({
    origin: "https://sf.example", mount: "/sucafina", runtime: () => undefined,
    application: {
      authenticate: async () => controls.role === null ? null : {
        id: "actor", canWrite: controls.writable,
        roles: [{ surface: "procurement", role: controls.role }],
      },
      persistence: { async transaction(surface, work) {
        expect(surface).toBe("procurement")
        const result = await work(state)
        commits.push(result.commit)
        return result.value
      } },
      environment: async () => environment,
      domains: { dashboard: [], planner: [], procurement: [{ pages: ["Settings", "Suppliers"], domain, render: () => undefined }] },
      maxJsonBytes: 1024,
      productView: async () => ({ data: {}, current: () => controls.sourceCurrent, finish: () => undefined }),
    },
    readContext: async () => {
      controls.reads++
      if (controls.reads > 1 && controls.endFence === "denied") return { status: "denied" }
      return { status: "ok", value: {
        stamp: { installationId: "installation", projectId: "project", hostId: "host", principalRef: "actor",
          policyVersion: "policy", accessRevision: controls.reads > 1 && controls.endFence === "changed" ? "changed" : "current" },
        contractRevision: "sf-native-ui/1", authMode: "local-operator",
        // Deliberately keep the page visible: source actor checks must still
        // deny Settings to non-admins and close upload independently of Save.
        destinations: [
          { capabilityId: "CAP28", surface: "procurement", page: "Settings", canRead: true,
            allowedActionIds: controls.writable && controls.role === "admin" ? ["save", "reset"] : [] },
          { capabilityId: "CAP27", surface: "procurement", page: "Suppliers", canRead: true,
            allowedActionIds: controls.writable && controls.role !== "viewer" ? ["create", "save"] : [] },
        ],
        availability: [],
      } }
    },
  })
  const read = async (capability: "CAP27" | "CAP28") => {
    controls.reads = 0
    const handler = handlers.find((entry) => entry.operationId === "domain.page." + capability)
    if (!handler) throw new Error("Original Procurement handler unavailable")
    return handler.handle(new Request("https://sf.example/sucafina/api/ui/pages/" + capability))
  }
  return { state, controls, commits, read }
}
async function settings(response: Response) {
  expect(response.status).toBe(200)
  const decoded = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP28"].output)(await response.json())
  if (decoded.status !== "ok") throw new Error("Expected authorized Settings projection")
  return decoded
}
async function suppliers(response: Response) {
  expect(response.status).toBe(200)
  const decoded = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP27"].output)(await response.json())
  if (decoded.status !== "ok") throw new Error("Expected authorized Supplier projection")
  return decoded
}

test("native Settings exposes canonical defaults and first-write CAS without inventing persisted history", async () => {
  const f = fixture()
  const before = structuredClone(f.state)
  const first = await settings(await f.read("CAP28"))
  expect(first.value.data.settings).toEqual(initialProcurementSettings())
  expect(first.value.data.resetSettings).toEqual(initialProcurementSettings())
  const resetDefaults = first.value.data.resetSettings
  if (!resetDefaults) throw new Error("Original Settings reset defaults unavailable")
  expect(first.value.data.settingsInitialization).toEqual({ state: "absent", expectedVersion: 0 })
  expect(first.value.versions).toEqual({})
  expect(settingsVersion(first)).toBe(0)
  expect(f.state).toEqual(before)
  expect(f.commits).toEqual([false])
  const initialReview = settingsReview(first, resetDefaults, operation, "reset")
  expect(initialReview.base).toMatchObject({ kind: "not-provided" })
  expect(initialReview.current).toMatchObject({ kind: "not-provided" })
  expect(initialReview.coverage.state).toBe("partial")
  expect(initialReview.coverage.expectedCount).toBeNull()
  expect(initialReview.confirmation).toMatchObject({
    kind: "admitted", purpose: "reset",
    binding: { operationId: "domain.command.CAP28.reset", version: { kind: "record", expectedVersion: 0 } },
  })

  expect(domain.execute(f.state, admin, reset, environment)).toEqual({ ok: true })
  expect(f.state.versions.settings).toEqual({ version: 1, by: admin.id })
  expect(f.state.audit).toHaveLength(1)
  const stored = await settings(await f.read("CAP28"))
  expect(stored.value.data.settings).toEqual(resetDefaults)
  expect(Object.hasOwn(stored.value.data, "settingsInitialization")).toBe(false)
  expect(settingsVersion(stored)).toBe(1)
  const storedReview = settingsReview(stored, stored.value.data.resetSettings!, operation, "reset")
  expect(storedReview.base).toMatchObject({ kind: "persisted", version: 1 })
  expect(storedReview.confirmation).toMatchObject({
    kind: "admitted", binding: { version: { kind: "record", expectedVersion: 1 } },
  })
  const committed = structuredClone(f.state)
  expect(domain.execute(f.state, admin, reset, environment)).toMatchObject({ ok: false, status: 409, currentVersionCAS: 1 })
  expect(f.state).toEqual(committed)
  expect(f.commits).toEqual([false, false])

  // Supplier.create persists the shared store but does not create a Settings
  // revision. Exercise both first writes through the original domain contract.
  for (const action of ["reset", "save"] as const) {
    const withSupplier = fixture()
    const createSupplier = {
      page: "Suppliers", action: "create", version: 0,
      values: { supplier: { legalName: "Supplier before first Settings write" } },
    }
    const beforeSupplier = structuredClone(withSupplier.state)
    expect(domain.execute(withSupplier.state, admin, createSupplier, environment)).toMatchObject({ ok: false, status: 403 })
    expect(withSupplier.state).toEqual(beforeSupplier)
    // Original procurementSupplierRoleAllows requires buyer for create.
    expect(domain.execute(withSupplier.state, { ...admin, roles: ["buyer"] }, createSupplier, environment).ok).toBe(true)
    const supplierRows = structuredClone(rows(object(withSupplier.state.data.store).suppliers))
    expect(supplierRows).toHaveLength(1)
    expect(supplierRows[0]).toMatchObject({ id: "supplier-1", legalName: "Supplier before first Settings write" })
    expect(Object.hasOwn(withSupplier.state.data, "store")).toBe(true)
    expect(withSupplier.state.versions).toEqual({ "suppliers:supplier-1": { version: 1, by: admin.id } })
    const beforeSettings = structuredClone(withSupplier.state)
    const source = await settings(await withSupplier.read("CAP28"))
    expect(source.value.data.settings).toEqual(initialProcurementSettings())
    expect(source.value.data.settingsInitialization).toEqual({ state: "absent", expectedVersion: 0 })
    expect(source.value.versions).toEqual({})
    expect(settingsVersion(source)).toBe(0)
    expect(withSupplier.state).toEqual(beforeSettings)
    expect(withSupplier.commits).toEqual([false])
    const proposed = action === "reset" ? source.value.data.resetSettings! :
      { ...source.value.data.settings, uploadCap: 1048576 }
    const review = settingsReview(source, proposed, operation, action)
    expect(review.base).toMatchObject({ kind: "not-provided" })
    expect(review.current).toMatchObject({ kind: "not-provided" })
    expect(review.coverage.state).toBe("partial")
    expect(review.coverage.expectedCount).toBeNull()
    expect(review.confirmation).toMatchObject({
      kind: "admitted", purpose: action,
      binding: { operationId: "domain.command.CAP28." + action, version: { kind: "record", expectedVersion: 0 } },
    })
    const command = { page: "Settings", action, version: 0,
      values: action === "reset" ? {} : { settings: proposed } }
    expect(domain.execute(withSupplier.state, admin, command, environment)).toEqual({ ok: true })
    expect(withSupplier.state.versions.settings).toEqual({ version: 1, by: admin.id })
    expect(withSupplier.state.versions["suppliers:supplier-1"]).toEqual(beforeSettings.versions["suppliers:supplier-1"]!)
    expect(rows(object(withSupplier.state.data.store).suppliers)).toEqual(supplierRows)
    expect(withSupplier.state.audit).toHaveLength(beforeSettings.audit.length + 1)
    const saved = await settings(await withSupplier.read("CAP28"))
    expect(saved.value.data.settings).toEqual(proposed)
    expect(Object.hasOwn(saved.value.data, "settingsInitialization")).toBe(false)
    expect(settingsVersion(saved)).toBe(1)
    const afterSettings = structuredClone(withSupplier.state)
    expect(domain.execute(withSupplier.state, admin, command, environment)).toMatchObject({
      ok: false, status: 409, currentVersionCAS: 1,
    })
    expect(withSupplier.state).toEqual(afterSettings)
    expect(withSupplier.commits).toEqual([false, false])
  }
})

test("native Settings keeps missing, contradictory and unauthorized reset sources closed", async () => {
  const f = fixture()
  const initial = await settings(await f.read("CAP28"))
  const missing = { ...initial, value: { ...initial.value, data: {
    settings: initial.value.data.settings, resetSettings: initial.value.data.resetSettings, directory: initial.value.data.directory,
  } } }
  expect(settingsVersion(missing)).toBeUndefined()
  expect(settingsReview(missing, missing.value.data.resetSettings!, operation, "reset").confirmation.kind).toBe("blocked")
  const contradictory = { ...initial, value: { ...initial.value, versions: { settings: { version: 3, by: "another-actor" } } } }
  expect(settingsVersion(contradictory)).toBeUndefined()
  expect(settingsReview(contradictory, contradictory.value.data.resetSettings!, operation, "reset").confirmation.kind).toBe("blocked")
  expect(settingsReview(initial, structuredClone(initial.value.data.resetSettings!), operation, "reset").confirmation.kind).toBe("blocked")
  const noDefaults = { ...initial, value: { ...initial.value, data: { ...initial.value.data, resetSettings: undefined } } }
  expect(settingsReview(noDefaults, initial.value.data.resetSettings!, operation, "reset").confirmation.kind).toBe("blocked")

  // An own revision entry never means "absent", including explicit undefined.
  // Invalid metadata is refused by the original output codec; JSON drops an
  // undefined value, but without the marker the consumer still cannot use CAS 0.
  for (const revision of [null, undefined, {}, { version: -1, by: admin.id }, { version: 0 }, { version: "0", by: admin.id }]) {
    const invalid = fixture()
    Object.defineProperty(invalid.state.versions, "settings", { value: revision, enumerable: true, configurable: true })
    const unchanged = structuredClone(invalid.state)
    const response = await invalid.read("CAP28")
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Object.hasOwn(invalid.state.versions, "settings")).toBe(true)
    expect(Object.hasOwn(body.value.data, "settingsInitialization")).toBe(false)
    if (revision === undefined) {
      const decoded = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP28"].output)(body)
      if (decoded.status !== "ok") throw new Error("Expected unchanged Settings projection")
      expect(settingsVersion(decoded)).toBeUndefined()
      expect(settingsReview(decoded, decoded.value.data.resetSettings!, operation, "reset").confirmation.kind).toBe("blocked")
    } else {
      expect(() => Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP28"].output)(body)).toThrow()
    }
    expect(invalid.state).toEqual(unchanged)
    expect(invalid.commits).toEqual([false])
  }
  const invalidSettings = fixture()
  invalidSettings.state.data.store = { settings: { ...initialProcurementSettings(), currency: 99 } }
  const beforeInvalidRead = structuredClone(invalidSettings.state)
  const invalidSettingsResponse = await invalidSettings.read("CAP28")
  expect(invalidSettingsResponse.status).toBe(200)
  const invalidSettingsBody = await invalidSettingsResponse.json()
  expect(() => Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP28"].output)(invalidSettingsBody)).toThrow()
  expect(invalidSettings.state).toEqual(beforeInvalidRead)
  expect(invalidSettings.commits).toEqual([false])

  for (const role of ["viewer", "buyer", "supplier admin", null] as const) {
    f.controls.role = role
    const before = structuredClone(f.state)
    const denied = await f.read("CAP28")
    expect(denied.status).toBe(role === null ? 401 : 403)
    expect(await denied.json()).toEqual({ status: role === null ? "unauthenticated" : "denied" })
    expect(f.state).toEqual(before)
  }
  f.controls.role = "admin"
  f.controls.writable = false
  const readOnly = await settings(await f.read("CAP28"))
  expect(readOnly.value.allowedActionIds).toEqual([])
  const unchanged = structuredClone(f.state)
  expect(domain.execute(f.state, { ...admin, canWrite: false }, reset, environment)).toMatchObject({ ok: false, status: 403 })
  expect(f.state).toEqual(unchanged)
  f.controls.writable = true
  for (const endFence of ["denied", "changed"] as const) {
    f.controls.endFence = endFence
    const closed = await f.read("CAP28")
    expect(closed.status).toBe(endFence === "denied" ? 403 : 409)
    expect(await closed.json()).toEqual({ status: endFence === "denied" ? "denied" : "stale", reason: "procurement-context-changed" })
    expect(f.state).toEqual(unchanged)
  }
  f.controls.endFence = "current"
  f.controls.sourceCurrent = false
  const stale = await f.read("CAP28")
  expect(stale.status).toBe(409)
  expect(await stale.json()).toEqual({ status: "stale", reason: "procurement-source-changed" })
  expect(f.commits.every((commit) => commit === false)).toBe(true)
})

test("native Supplier attachment projection preserves names while fencing upload separately from Save", async () => {
  const f = fixture()
  expect(domain.execute(f.state, { ...admin, roles: ["buyer"] }, {
    page: "Suppliers", action: "create", version: 0, values: { supplier: { legalName: "Fixture supplier" } },
  }, environment).ok).toBe(true)
  const stored = rows(object(f.state.data.store).suppliers)[0]!
  // Extra source fields are deliberate privacy sentinels, not admitted bytes,
  // scanner verdicts, signed links or authorization created by this fixture.
  stored.attachments = [{ id: "private-document-ref", name: "document.txt",
    storagePath: "/private/storage/document", bearer: "private-reference-sentinel", bytes: 1234 }]
  const before = structuredClone(f.state)
  for (const [role, writable, uploadAllowed] of [
    ["admin", true, true], ["supplier admin", true, true], ["buyer", true, false],
    ["viewer", false, false], ["admin", false, false],
  ] as const) {
    f.controls.role = role
    f.controls.writable = writable
    const projected = await suppliers(await f.read("CAP27"))
    expect(projected.value.data.canUploadAttachment).toBe(uploadAllowed)
    expect(projected.value.data.suppliers).toHaveLength(1)
    expect(projected.value.data.suppliers[0]!.attachments).toEqual([{ id: "private-document-ref", name: "document.txt" }])
    expect(JSON.stringify(projected)).not.toContain("private-reference-sentinel")
    expect(JSON.stringify(projected)).not.toContain("/private/storage/document")
    if (role === "buyer") expect(projected.value.allowedActionIds).toContain("save")
    expect(f.state).toEqual(before)
  }
  f.controls.role = "admin"
  f.controls.writable = true
  f.controls.endFence = "denied"
  const revoked = await f.read("CAP27")
  expect(revoked.status).toBe(403)
  expect(await revoked.json()).toEqual({ status: "denied", reason: "procurement-context-changed" })
  expect(f.state).toEqual(before)
  expect(f.commits.every((commit) => commit === false)).toBe(true)
})
