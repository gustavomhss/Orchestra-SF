import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import type { SfNativeHostDependencies } from "../src/sucafina-product/native-ui/router"
import { createSfProcurementProjectionHandlers } from "../src/sucafina-product/native-ui/procurement"
import { domain, pages, render } from "../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { object, rows } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Command } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { testPersistence } from "../../../modules/sucafina/Sucafinav1/test/fixture/persistence.ts"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
type Capability = "CAP25" | "CAP26"

async function fixture() {
  const storage = testPersistence()
  const admin: Actor = { id: "projection-admin", roles: ["admin"], canWrite: true }
  const requester: Actor = { id: "requester", roles: ["requester"], canWrite: true }
  const buyer: Actor = { id: "buyer", roles: ["buyer"], canWrite: true }
  const holder: Actor = { id: "holder", roles: ["approver"], canWrite: true }
  const environment = {
    at: "2026-11-22T12:00:00Z", id: () => "projection-supplier", directory: [],
  }
  const execute = (actor: Actor, command: Command) =>
    storage.persistence.transaction("procurement", async (snapshot) => {
      const result = domain.execute(snapshot, actor, command, environment)
      return { commit: result.ok, value: result }
    })
  const run = async (actor: Actor, action: string, values: Record<string, unknown>, id?: string, page = "Requests") => {
    const key = page === "Settings" ? "settings" : "requests:" + (id ?? "")
    const result = await execute(actor, {
      page, action, ...(id === undefined ? {} : { id }),
      version: storage.state.procurement.versions[key]?.version ?? 0, values,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("Original Procurement producer rejected " + action)
    return result
  }
  await run(admin, "reset", {}, undefined, "Settings")
  await run(admin, "save", {
    levels: [{ id: "L1", name: "Level one", threshold: 0, holderId: holder.id }],
  }, undefined, "Settings")
  const pr = {
    title: "Projected sourcing quantities", type: "service", description: "Regional support",
    estAmount: 36.875, costCenter: "IT", needBy: "2026-12-01",
    justification: "Operating review", recurring: false, expenseType: "OPEX",
  }
  const created = await run(requester, "create", { pr })
  const requestRef = object(created.value).number
  if (typeof requestRef !== "string" || !requestRef) throw new Error("Original request reference missing")
  await run(requester, "submit_pr", { pr }, requestRef)
  await run(holder, "approve", {}, requestRef)
  await run(buyer, "save", { sourcing: {
    quotes: [
      { id: "decimal", supplier: "Regional supplier", supplierId: null, currency: "USD",
        total: 36.875, qty: 2.5, unitPrice: 14.75, techPass: true, scores: [5], cscores: [] },
      { id: "zero", supplier: "Incomplete quotation", supplierId: null, currency: "USD",
        total: 0, qty: 0, unitPrice: 0, techPass: false, scores: [], cscores: [] },
      { id: "missing", supplier: "Unpriced quotation", supplierId: null, currency: "EUR",
        total: null, techPass: false, scores: [], cscores: [] },
    ],
    evaluator: "Original evaluator", selectedId: "decimal", fewQuotesJustification: "",
    selectionJustification: "", contractStrategy: "",
  } }, requestRef)

  const admission = { denied: false }
  const dependencies: SfNativeHostDependencies = {
    origin, mount, runtime: () => undefined,
    application: {
      authenticate: async () => ({
        id: buyer.id, canWrite: buyer.canWrite,
        roles: buyer.roles.map((role) => ({ surface: "procurement" as const, role })),
      }),
      persistence: storage.persistence,
      environment: async () => environment,
      domains: { dashboard: [], planner: [], procurement: [{ domain, pages, render }] },
      maxJsonBytes: 100000,
    },
    readContext: async () => admission.denied ? { status: "denied" } : {
      status: "ok", value: {
        stamp: { installationId: "projection-installation", projectId: "projection-project",
          hostId: "projection-host", principalRef: buyer.id, policyVersion: "policy-1", accessRevision: "access-1" },
        contractRevision: "sf-native-ui/1", authMode: "local-operator",
        destinations: [
          { capabilityId: "CAP25", surface: "procurement", page: "Requests",
            canRead: true, allowedActionIds: ["save", "submit_sourcing"] },
          { capabilityId: "CAP26", surface: "procurement", page: "My approvals",
            canRead: true, allowedActionIds: ["approve", "reject"] },
        ],
        availability: [],
      },
    },
  }
  const handlers = createSfProcurementProjectionHandlers(dependencies)
  const request = async (capability: Capability) => {
    const handler = handlers.find((entry) => entry.operationId === "domain.page." + capability)
    if (!handler) throw new Error("Original native projection handler missing")
    return handler.handle(new Request(origin + mount + "/api/ui/pages/" + capability))
  }
  const read = async (capability: Capability) => {
    const response = await request(capability)
    expect(response.status).toBe(200)
    const body: unknown = await response.json()
    const decoded = capability === "CAP25"
      ? Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(body)
      : Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP26"].output)(body)
    if (decoded.status !== "ok") throw new Error("Native projection did not return a source")
    const row = decoded.value.data.requests.find((entry) => entry.number === requestRef)
    if (!row?.sourcing) throw new Error("Authorized sourcing record missing")
    return { page: decoded.value, row, sourcing: row.sourcing }
  }
  const storedQuotes = () => {
    const row = object(object(object(storage.state.procurement.data.store).requests)[requestRef])
    return rows(object(object(row.request).sourcing).quotes)
  }
  return { storage, buyer, execute, requestRef, admission, request, read, storedQuotes }
}

for (const capability of ["CAP25", "CAP26"] as const) {
  test(capability + " preserves quote numbers through a fresh native read, edit, save and reread", async () => {
    const source = await fixture()
    const beforeRead = structuredClone(source.storage.state.procurement)
    const first = await source.read(capability)
    expect(source.storage.state.procurement).toEqual(beforeRead)
    expect(first.sourcing.quotes?.map(({ id, qty, unitPrice }) => ({ id, qty, unitPrice }))).toEqual([
      { id: "decimal", qty: 2.5, unitPrice: 14.75 },
      { id: "zero", qty: 0, unitPrice: 0 },
      { id: "missing", qty: undefined, unitPrice: undefined },
    ])
    const unpriced = first.sourcing.quotes?.find((quote) => quote.id === "missing")
    expect(unpriced).not.toHaveProperty("qty")
    expect(unpriced).not.toHaveProperty("unitPrice")

    const version = first.page.versions["requests:" + source.requestRef]?.version
    if (version === undefined) throw new Error("Original CAS version missing")
    // The human edits the evaluator while carrying the actual source quotations,
    // just as the native editor does. A projection omission must not erase them.
    const command = Schema.decodeUnknownSync(SfProcurement.operations["domain.command.CAP25.save"].input)({
      page: "Requests", action: "save", id: source.requestRef, version,
      values: { sourcing: { quotes: first.sourcing.quotes, evaluator: "Reviewed evaluator" } },
    })
    expect(await source.execute(source.buyer, command)).toMatchObject({ ok: true })
    expect(source.storedQuotes().map(({ id, qty, unitPrice }) => ({ id, qty, unitPrice }))).toEqual([
      { id: "decimal", qty: 2.5, unitPrice: 14.75 },
      { id: "zero", qty: 0, unitPrice: 0 },
      { id: "missing", qty: undefined, unitPrice: undefined },
    ])
    const afterSave = structuredClone(source.storage.state.procurement)
    for (const freshCapability of ["CAP25", "CAP26"] as const) {
      const fresh = await source.read(freshCapability)
      expect(fresh.page.versions["requests:" + source.requestRef]?.version).toBe(version + 1)
      expect(fresh.sourcing.evaluator).toBe("Reviewed evaluator")
      expect(fresh.sourcing.quotes).toEqual(first.sourcing.quotes)
    }
    expect(source.storage.state.procurement).toEqual(afterSave)
  })
}

test("native quote projections still refuse current admission loss without exposing stored values", async () => {
  const source = await fixture()
  await source.read("CAP25")
  source.admission.denied = true
  const before = structuredClone(source.storage.state.procurement)
  for (const capability of ["CAP25", "CAP26"] as const) {
    const response = await source.request(capability)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ status: "denied" })
  }
  expect(source.storage.state.procurement).toEqual(before)
})
