import { expect, test } from "bun:test"
import corpus from "./fixtures/corpus-v2.json"
import { requestValue } from "../../../src/procurement-screen.ts"
import { domain as operationsDomain } from "../../../runtime/dashboard-operations.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { contractVendor } from "../../../src/dashboard-role.ts"
import { syncRoster } from "../../../src/planner-accounts.ts"
import { importProjects } from "../../../src/dashboard-accounts.ts"
import { computeBudgetTotals, effectiveMonthlyBudget, riskScore, riskTier } from "../../../src/dashboard-accounts.ts"

test("the synthetic EUR procurement request is converted by the product domain view", () => {
  const request = corpus.datasets.procurement.request
  const value = requestValue({
    status: "sourcing",
    createdBy: "synthetic-requester",
    pr: { estAmount: null },
    sourcing: {
      selectedId: "synthetic-eur-bid",
      quotes: [{ id: "synthetic-eur-bid", total: request.amount, currency: request.currency }],
      fxSnapshot: { EUR: corpus.datasets.procurement.fx_snapshot.rate },
    },
  }, { currency: corpus.datasets.procurement.base_currency })

  expect(value).toBe(request.expected_base_amount)
})

test("a missing FX snapshot and rate stays unpriced instead of becoming zero", () => {
  const request = corpus.datasets.procurement.request
  const value = requestValue({
    status: "sourcing",
    createdBy: "synthetic-requester",
    pr: { estAmount: null },
    sourcing: {
      selectedId: "synthetic-eur-bid",
      quotes: [{ id: "synthetic-eur-bid", total: request.amount, currency: request.currency }],
      fxSnapshot: { EUR: corpus.datasets.procurement.fx_missing_control.rate },
    },
  }, { currency: corpus.datasets.procurement.base_currency })

  expect(value).toBeNull()
})

test("synthetic people, operations, risks, and contracts exercise domain behavior", () => {
  const people = corpus.datasets.people
  const roster = syncRoster(people.positions, people.roster, people.plan_year, people.leader_domains, false)
  expect(roster).toMatchObject({ ok: true, positions: [{ name: "synthetic person a", domain: "Finance" }, { name: "Synthetic Person B", domain: "Finance" }] })

  const operation = corpus.datasets.operations
  expect(effectiveMonthlyBudget(operation.monthly_budget.months[0]?.budget, operation.monthly_budget.annual)).toBe(operation.expected.month_1_effective_budget)
  expect(effectiveMonthlyBudget(operation.monthly_budget.months[1]?.budget, operation.monthly_budget.annual)).toBe(operation.expected.month_2_effective_budget)

  const risk = corpus.datasets.risks.items[0]
  expect(riskTier(riskScore(risk.impact, risk.probability))).toBe(corpus.datasets.risks.expected.high_tier)

  const contract = corpus.datasets.contracts
  expect(contractVendor(contract.contract.vendor)).toEqual({ vendor: contract.contract.vendor, supplierId: null })
  expect(contract.supplier.name).toBe(contract.contract.vendor)
})

test("synthetic volume proposal creates the declared deterministic row counts", () => {
  const counts = corpus.datasets.volume.datasets
  const financial = Array.from({ length: counts.financial_lines }, (_, index) => ({
    year: 2027,
    month: index % 12 + 1,
    ownerId: "synthetic-owner",
    actual: 1,
    forecast: 2,
  }))
  const financialTotals = computeBudgetTotals({ opexOwners: [{ id: "synthetic-owner", budget: 1200 }], opexEntries: financial }, 2027)
  expect(financialTotals.opexActual).toBe(counts.financial_lines)
  expect(financialTotals.opexForecast).toBe(counts.financial_lines * 2)

  const purchaseOrders = Array.from({ length: counts.purchase_orders }, (_, index) => ({
    status: "sourcing",
    createdBy: "synthetic-buyer",
    prApprovalBaseCurrency: "USD",
    pr: { estAmount: index + 1 },
  }))
  expect(purchaseOrders.reduce((sum, request) => sum + (requestValue(request, { currency: "USD" }) ?? 0), 0)).toBe(
    (counts.purchase_orders * (counts.purchase_orders + 1)) / 2,
  )

  let nextId = 0
  const projectImport = importProjects([], [], Array.from({ length: counts.projects }, (_, index) => ({ name: `Synthetic volume project ${index + 1}`, budget: index + 1 })), "replace", true, "2027-01-01", () => `synthetic-volume-${++nextId}`)
  expect(projectImport).toMatchObject({ ok: true, added: counts.projects, updated: 0 })
})

test("synthetic projects and action text use existing product boundaries", () => {
  const projectFixture = corpus.datasets.projects
  const projectImport = importProjects(
    [],
    projectFixture.capex_projects,
    projectFixture.projects.map((project) => ({ name: project.id, budget: project.budget })),
    "replace",
    true,
    "2027-01-01",
    () => "synthetic-imported-project",
  )
  expect(projectImport).toMatchObject({ ok: true, added: projectFixture.projects.length, capexProjects: projectFixture.capex_projects })

  const state: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  // This verifies action text persistence only; approval transitions need their own domain proof.
  const events = corpus.datasets.actions.events
  events.forEach((event) => {
    expect(operationsDomain.execute(
      state,
      { id: "synthetic-operator", canWrite: true, roles: ["admin"] },
      { page: "IT Security KPIs", action: "save-action", version: 0, values: { text: `${event.kind} attempt ${event.attempt}`, done: false } },
      { at: "2027-01-01T00:00:00Z", id: () => event.id, directory: [] },
    ).ok).toBe(true)
  })
  expect(state.data.secActions).toMatchObject([
    { id: "synthetic-action-1", text: "approval-returned-for-correction attempt 1" },
    { id: "synthetic-action-2", text: "approval-resubmitted attempt 2" },
  ])
})
