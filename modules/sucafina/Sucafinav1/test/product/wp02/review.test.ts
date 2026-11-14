import { expect, test } from "bun:test"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"

const context = { actor: { id: "admin", roles: ["admin"], canWrite: true }, year: 2026, month: 11, at: "2026-11-13T00:00:00Z", versions: {} }

test("portfolio project links retain the current selection filters", () => {
  const projects = [{ id: "p1", name: "Kept", status: "In Progress", risk: "Low", watchList: true, budget: 10, spent: 0 }, { id: "p2", name: "Other", status: "In Progress", risk: "Low", watchList: false, budget: 10, spent: 0 }]
  const result = DashboardPortfolio.render("Portfolio Dashboard", { projects, filter: "watch", status: "In Progress" }, context)
  expect(result).toContain("filter=watch")
  expect(result).toContain("status=In+Progress")
  expect(result).toContain("#record-p1")
  expect(result).not.toContain('id="record-p2"')
})

test("executive operations link carries its selected year and month", () => {
  const result = DashboardBudget.render("Executive Dashboard", { executive: {}, executiveMonths: {}, opsMonth: 3, opsDefaultMonth: {}, sidebarYear: 2025 }, context)
  expect(result).toContain("page=IT%20Operations&amp;opsYear=2026&amp;operationsMonth=3")
})

test("budget month edits are contextual and broad operations describe their scope", () => {
  const result = DashboardBudget.render("OPEX Detail", { opexOwners: [{ id: "o", name: "Owner", budget: 1200 }], opexEntries: [], budgetYtd: {}, budgetCurrentMonth: { 2026: 3 } }, context)
  expect(result).toContain('data-open-editor')
  expect(result).toContain("Annual Entry writes the selected field in all 12 months of 2026")
  expect(result).toContain("Year amount writes actual through month 3")
})
