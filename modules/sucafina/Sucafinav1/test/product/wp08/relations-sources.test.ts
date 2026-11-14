import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

test("canonical homonymous suppliers never link a textual vendor without the selected source ID", async () => {
  const fixture = await createRelationsFixture()
  try {
    const contract = available(await fixture.records.issue({ page: "Vendor Contracts", recordType: "contracts", recordId: "contract", fields: ["vendor", "amount"], period: fixture.period }, fixture.read))
    const supplierA = available(await fixture.suppliers.resolve(available(await fixture.suppliers.issue("procurement-supplier", "supplier-A", fixture.read)), fixture.read)).evidence
    const supplierB = available(await fixture.suppliers.resolve(available(await fixture.suppliers.issue("procurement-supplier", "supplier-B", fixture.read)), fixture.read)).evidence
    expect(fixture.secondSupplier.warnings).toEqual(["Duplicate legalName recognized"])
    expect(supplierA.target.recordId).toBe("supplier-A")
    expect(supplierB.target.recordId).toBe("supplier-B")
    expect(supplierA.refId).not.toBe(supplierB.refId)
    const before = await fixture.snapshots()
    expect(rows(before.dashboard.data.contracts).map((record) => record.vendor)).toEqual(["Same Vendor"])
    expect(rows(object(before.procurement.data.store).suppliers).map((record) => ({ id: record.id, legalName: record.legalName }))).toEqual([{ id: "supplier-A", legalName: "Same Vendor" }, { id: "supplier-B", legalName: "Same Vendor" }])
    expect(await fixture.relations.storageVersion(fixture.read)).toEqual({ status: "ok", value: 0 })
    expect(await fixture.state.read(fixture.request(), "relations", (state) => state.relations)).toEqual({ status: "unavailable", reason: "product-state-uninitialized" })
    const pair = { fromRef: contract.refId, toRef: supplierB.refId, kind: "contract-supplier", evidenceRefs: [contract, supplierB] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "select-supplier-B" }
    const invalid = { ...pair, kind: "inferred-by-vendor" }
    const invalidContext = await fixture.admit("collaboration.relation.confirm", { operation: "create", pair: invalid, mutation })
    expect(await fixture.relations.create(invalid, mutation, invalidContext)).toMatchObject({ status: "unavailable", reason: "relation-source-fence-unavailable" })
    expect(await fixture.relations.storageVersion(fixture.read)).toEqual({ status: "ok", value: 0 })
    const context = await fixture.admit("collaboration.relation.confirm", { operation: "create", pair, mutation })
    const relation = available(await fixture.relations.create(pair, mutation, context))
    expect(await fixture.relations.read([contract.refId], fixture.read)).toMatchObject({ status: "ok", value: { relations: [{ id: relation.id, kind: "contract-supplier", fromRef: contract.refId, toRef: supplierB.refId }] } })
    expect(await fixture.relations.read([supplierA.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    expect(await fixture.snapshots()).toEqual(before)
    fixture.gate.procurement = false
    expect(await fixture.relations.read([contract.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    fixture.gate.procurement = true
    const removal = { expectedStorageVersion: 1, idempotencyKey: "unlink-supplier-B" }
    const removeContext = await fixture.admit("collaboration.relation.confirm", { operation: "remove", id: relation.id, pair, mutation: removal })
    expect((await fixture.relations.remove(relation.id, pair, removal, removeContext)).status).toBe("ok")
    expect(await fixture.relations.read([contract.refId, supplierA.refId, supplierB.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    expect(await fixture.snapshots()).toEqual(before)
    const relink = { expectedStorageVersion: 2, idempotencyKey: "relink-for-removal-check" }
    available(await fixture.relations.create(pair, relink, await fixture.admit("collaboration.relation.confirm", { operation: "create", pair, mutation: relink })))
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "Vendor Contracts", action: "delete", id: "contract", version: before.dashboard.versions["contracts:contract"]!.version, values: {} })
    const deleted = await fixture.snapshots()
    expect(rows(deleted.dashboard.data.contracts)).toEqual([])
    expect(await fixture.relations.read([contract.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    expect(await fixture.snapshots()).toEqual(deleted)
    expect(deleted.procurement).toEqual(before.procurement)
  } finally {
    await fixture.dispose()
  }
})

test("canonical PMO and CAPEX records preserve identities, money and every domain snapshot through link and unlink", async () => {
  const fixture = await createRelationsFixture()
  try {
    const project = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "budget", "spent", "status"], period: fixture.period }, fixture.read))
    const capex = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: "capex", fields: ["name", "budget", "status"], period: fixture.period }, fixture.read))
    const before = await fixture.snapshots()
    expect(rows(before.dashboard.data.projects)).toMatchObject([{ id: "project", name: "Shared project", budget: 100, spent: 20 }])
    expect(rows(before.dashboard.data.capexProjects)).toMatchObject([{ id: "capex", name: "Shared project", budget: 250 }])
    const pair = { fromRef: project.refId, toRef: capex.refId, kind: "pmo-capex", evidenceRefs: [project, capex] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "pmo-capex" }
    const context = await fixture.admit("collaboration.relation.confirm", { operation: "create", pair, mutation })
    const relation = available(await fixture.relations.create(pair, mutation, context))
    const reversed = { ...pair, fromRef: capex.refId, toRef: project.refId, evidenceRefs: [capex, project] }
    const duplicate = { expectedStorageVersion: 1, idempotencyKey: "same-edge-reversed" }
    expect(await fixture.relations.create(reversed, duplicate, await fixture.admit("collaboration.relation.confirm", { operation: "create", pair: reversed, mutation: duplicate }))).toEqual({ status: "ok", value: relation })
    expect(await fixture.relations.storageVersion(fixture.read)).toEqual({ status: "ok", value: 1 })
    expect(await fixture.relations.read([project.refId], fixture.read)).toMatchObject({ status: "ok", value: { relations: [{ id: relation.id, fromRef: project.refId, toRef: capex.refId }] } })
    expect(await fixture.snapshots()).toEqual(before)
    const removal = { expectedStorageVersion: 1, idempotencyKey: "remove-pmo-capex" }
    const removeContext = await fixture.admit("collaboration.relation.confirm", { operation: "remove", id: relation.id, pair, mutation: removal })
    expect((await fixture.relations.remove(relation.id, pair, removal, removeContext)).status).toBe("ok")
    expect(await fixture.relations.read([project.refId, capex.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    expect(await fixture.snapshots()).toEqual(before)
  } finally {
    await fixture.dispose()
  }
})
