import { expect, test } from "bun:test"
import { DashboardBudget, budgetData } from "../../../runtime/dashboard-budget.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { rows } from "../../../runtime/contract.ts"
import { computeBudgetTotals } from "../../../src/dashboard-accounts.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

test("equal money and simultaneous record timestamps do not create relations or override the selected physical IDs", async () => {
  const fixture = await createRelationsFixture()
  try {
    const initial = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save", id: "capex", version: initial.dashboard.versions["capexProjects:capex"]!.version, values: { name: "Different CAPEX A", budget: 100 } })
    await fixture.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save", version: 0, values: { name: "Different CAPEX B", budget: 100 } }, "capex-B")
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", version: 0, values: { name: "Unrelated project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "Same amount and timestamp, distinct identity" } }, "project-B")
    const before = await fixture.snapshots()
    const projectRows = rows(before.dashboard.data.projects)
    expect(projectRows.map((row) => row.budget)).toEqual([100, 100])
    expect(projectRows.map((row) => row.createdAt)).toEqual(["2026-11-13T00:00:00Z", "2026-11-13T00:00:00Z"])
    expect(new Set(projectRows.map((row) => row.createdAt)).size).toBe(1)
    expect(rows(before.dashboard.data.capexProjects).map((row) => row.budget)).toEqual([100, 100])
    const project = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "budget", "spent"], period: fixture.period }, fixture.read))
    const unrelated = available(await fixture.records.issue({ page: "All Projects", recordType: "projects", recordId: "project-B", fields: ["name", "budget", "spent"], period: fixture.period }, fixture.read))
    const capexA = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: "capex", fields: ["name", "budget"], period: fixture.period }, fixture.read))
    const capexB = available(await fixture.records.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: "capex-B", fields: ["name", "budget"], period: fixture.period }, fixture.read))
    expect(await fixture.relations.storageVersion(fixture.read)).toEqual({ status: "ok", value: 0 })
    const totals = computeBudgetTotals(budgetData(before.dashboard.data), 2026)
    const pair = { fromRef: project.refId, toRef: capexB.refId, kind: "pmo-capex", evidenceRefs: [project, capexB] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "explicit-not-value-time" }
    const linked = available(await fixture.relations.create(pair, mutation, await fixture.admit("collaboration.relation.confirm", { operation: "create", pair, mutation })))
    expect(await fixture.relations.read([project.refId], fixture.read)).toMatchObject({ status: "ok", value: { relations: [{ id: linked.id, fromRef: project.refId, toRef: capexB.refId }] } })
    expect(await fixture.relations.read([unrelated.refId, capexA.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    expect(computeBudgetTotals(budgetData((await fixture.snapshots()).dashboard.data), 2026)).toEqual(totals)
    expect(await fixture.snapshots()).toEqual(before)
    const removal = { expectedStorageVersion: 1, idempotencyKey: "remove-explicit-value-time" }
    available(await fixture.relations.remove(linked.id, pair, removal, await fixture.admit("collaboration.relation.confirm", { operation: "remove", id: linked.id, pair, mutation: removal })))
    expect(await fixture.relations.read([project.refId, unrelated.refId, capexA.refId, capexB.refId], fixture.read)).toEqual({ status: "ok", value: { relations: [] } })
    expect(computeBudgetTotals(budgetData((await fixture.snapshots()).dashboard.data), 2026)).toEqual(totals)
    expect(await fixture.snapshots()).toEqual(before)
  } finally {
    await fixture.dispose()
  }
})
