import { expect, test } from "bun:test"
import corpus from "./fixtures/corpus-v2.json"
import inputs from "./fixtures/consumer-inputs.json"
import { createVolumeCorpus } from "./fixtures/volume.ts"
import { requestValue } from "../../../src/procurement-screen.ts"
import { domain } from "../../../runtime/dashboard-operations.ts"
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

  // The existing FX domain uses IEEE-754 multiplication; this tolerance is far below one cent.
  expect(value).toBeCloseTo(request.expected_base_amount, 8)
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
  expect<string>(riskTier(riskScore(risk.impact, risk.probability))).toBe(corpus.datasets.risks.expected.high_tier)

  const contract = corpus.datasets.contracts
  expect(contractVendor(contract.contract.vendor)).toEqual({ vendor: contract.contract.vendor, supplierId: null })
  expect(contract.supplier.name).toBe(contract.contract.vendor)
})

test("synthetic volume proposal creates the declared deterministic row counts", () => {
  const volume = createVolumeCorpus()
  expect(volume.financial).toHaveLength(inputs.volume.expected.financialRows)
  expect(volume.purchaseOrders).toHaveLength(inputs.volume.expected.purchaseOrders)
  expect(volume.projects).toHaveLength(inputs.volume.expected.projects)
  const financialTotals = computeBudgetTotals({ opexOwners: [{ id: "synthetic-owner", budget: 1200 }], opexEntries: volume.financial }, 2027)
  expect(financialTotals.opexActual).toBe(inputs.volume.expected.financialActual)
  expect(financialTotals.opexForecast).toBe(inputs.volume.expected.financialForecast)
  expect(volume.purchaseOrders.reduce((sum, request) => sum + (requestValue(request, { currency: "USD" }) ?? 0), 0)).toBe(inputs.volume.expected.purchaseOrderTotal)

  let nextId = 0
  const projectImport = importProjects([], [], volume.projects, "replace", true, "2027-01-01", () => `synthetic-volume-${++nextId}`)
  expect(projectImport).toMatchObject({ ok: true, added: inputs.volume.expected.projects, updated: 0 })
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
    expect(domain.execute(
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
