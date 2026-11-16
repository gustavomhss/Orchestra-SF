import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfProcurementRequest } from "../../../../../packages/schema/src/sucafina/procurement.ts"
import { createSfProcurementProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { domain, requestDraftActions } from "../../runtime/procurement.ts"
import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"

test("original draft predicate keeps visibility, ownership, roles and stage separate", () => {
  const owner = { id: "owner", roles: ["requester"], canWrite: true }
  const buyer = { id: "buyer", roles: ["buyer"], canWrite: true }
  const record = { number: "PR-1", createdBy: "owner", status: "draft" }
  expect(requestDraftActions(record, owner)).toEqual(["save-pr"])
  expect(requestDraftActions(record, buyer)).toEqual([])
  expect(requestDraftActions({ ...record, status: "sourcing" }, buyer)).toEqual(["save-sourcing"])
  expect(requestDraftActions({ ...record, status: "po_draft" }, buyer)).toEqual(["save-po"])
  expect(requestDraftActions({ ...record, status: "po_draft" }, { ...buyer, canWrite: false })).toEqual([])
  expect(requestDraftActions({ ...record, createdBy: "other" }, owner)).toEqual([])
  expect(Schema.is(SfProcurementRequest)(record)).toBe(true)
  expect(Schema.is(SfProcurementRequest)({ ...record, allowedDraftActions: ["save-pr"] })).toBe(true)
  expect(Schema.is(SfProcurementRequest)({ ...record, allowedDraftActions: ["forged"] })).toBe(false)
})

test("actual native request projection emits source-stamped draft capabilities", async () => {
  const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const environment = { at: "2026-11-15T12:00:00Z", id: () => "id", directory: [{ id: "owner", name: "Owner" }] }
  expect(domain.execute(snapshot, { id: "admin", roles: ["admin"], canWrite: true },
    { page: "Settings", action: "reset", version: 0, values: {} }, environment).ok).toBe(true)
  const created = domain.execute(snapshot, { id: "owner", roles: ["requester"], canWrite: true },
    { page: "Requests", action: "create", version: 0, values: { pr: { title: "Original", type: "product", description: "Operations",
      estAmount: 100, costCenter: "IT", needBy: "2026-12-01", justification: "Renewal", recurring: false, expenseType: "OPEX" } } }, environment)
  if (!created.ok) throw new Error("source request creation failed")
  const id = String(object(created.value).number)
  let actor = { id: "owner", role: "requester", canWrite: true }
  const deps = { origin: "http://localhost", mount: "/sucafina", runtime: () => undefined,
    application: { domains: { dashboard: [], planner: [], procurement: [{ pages: ["Requests"], domain, render: () => undefined }] },
      persistence: { transaction: async (_surface: string, work: (snapshot: Snapshot) => Promise<{ commit: boolean; value: unknown }>) => (await work(snapshot)).value },
      authenticate: async () => ({ id: actor.id, canWrite: actor.canWrite, roles: [{ surface: "procurement", role: actor.role }] }),
      environment: async () => environment },
    readContext: async () => ({ status: "ok", value: { stamp: { installationId: "installation", projectId: "project", hostId: "host",
      principalRef: actor.id, policyVersion: "policy", accessRevision: "revision" }, destinations: [{ capabilityId: "CAP25", surface: "procurement",
      page: "Requests", canRead: true, allowedActionIds: ["save"] }] } }) }
  const handler = createSfProcurementProjectionHandlers(deps as never).find((entry) => entry.operationId === "domain.page.CAP25")!
  const read = async () => (await handler.handle(new Request("http://localhost/sucafina/api/ui/pages/CAP25"))).json()
  expect((await read()).value.data.requests[0].allowedDraftActions).toEqual(["save-pr"])
  actor = { id: "buyer", role: "buyer", canWrite: true }
  expect((await read()).value.data.requests[0].allowedDraftActions).toEqual([])
  object(object(object(snapshot.data.store).requests)[id]).request = { ...object(object(object(object(snapshot.data.store).requests)[id]).request), status: "sourcing" }
  expect((await read()).value.data.requests[0].allowedDraftActions).toEqual(["save-sourcing"])
  actor = { id: "stranger", role: "requester", canWrite: true }
  expect((await read()).value.data.requests).toEqual([])
})
