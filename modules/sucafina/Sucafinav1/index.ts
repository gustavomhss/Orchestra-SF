import { createApplication } from "./runtime/application.ts"
import type { Application } from "./runtime/application.ts"
import { DashboardBudget } from "./runtime/dashboard-budget.ts"
import { DashboardPeople } from "./runtime/dashboard-people.ts"
import { DashboardOperations } from "./runtime/dashboard-operations.ts"
import { DashboardPortfolio } from "./runtime/dashboard-portfolio.ts"
import { PlannerModule } from "./runtime/planner.ts"
import { ProcurementModule } from "./runtime/procurement.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "./src/nav.ts"

export type ModuleServices = Omit<Application, "domains">
export const contributions: Application["domains"] = {
  dashboard: [DashboardBudget, DashboardPeople, DashboardOperations, DashboardPortfolio],
  planner: [PlannerModule],
  procurement: [ProcurementModule],
}

export function createModule(mount: string, services: ModuleServices) {
  for (const [surface, expected] of [
    ["dashboard", DASHBOARD_PAGES],
    ["planner", PLANNER_TABS],
    ["procurement", PROCUREMENT_NAV],
  ] as const) {
    const pages = contributions[surface].flatMap((item) => item.pages)
    if (
      pages.length !== expected.length ||
      new Set(pages).size !== pages.length ||
      expected.some((page) => !pages.includes(page))
    )
      throw new Error(`Incomplete ${surface} module registry`)
  }
  return createApplication(mount, { ...services, domains: contributions })
}
