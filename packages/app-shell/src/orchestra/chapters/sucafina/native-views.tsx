import { Match, Switch } from "solid-js"
import { DashboardBudgetView } from "./dashboard-budget-view"
import { DashboardPeopleView } from "./dashboard-people-view"
import { DashboardPortfolioView } from "./dashboard-portfolio-view"
import { DashboardOperationsView } from "./dashboard-operations-view"
import { PlannerLinesView } from "./planner-lines-view"
import { PlannerHeadcountView } from "./planner-headcount-view"
import { ProcurementView } from "./procurement-ui-view"
import type { NativeViewProps } from "./view-contract"
import "./native-views.css"

export function NativeViews(props: NativeViewProps) {
  const page = () => props.page.page
  const authorized = () => props.page.pages.includes(page())
  return (
    <div data-sf-native-view>
      <Switch>
        <Match when={authorized() && props.page.surface === "dashboard" && ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects"].includes(page())}><div data-sf-view-group="dashboard-budget"><DashboardBudgetView {...props} /></div></Match>
        <Match when={authorized() && props.page.surface === "dashboard" && ["Headcount Overview", "Team Structure", "Talent Review"].includes(page())}><div data-sf-view-group="dashboard-people"><DashboardPeopleView {...props} /></div></Match>
        <Match when={authorized() && props.page.surface === "dashboard" && ["Hot Topics & Actions", "Portfolio Dashboard", "All Projects", "IT Risks", "Stakeholder Management", "IT Performance Contract"].includes(page())}><div data-sf-view-group="dashboard-portfolio"><DashboardPortfolioView {...props} /></div></Match>
        <Match when={authorized() && props.page.surface === "dashboard" && ["IT Operations", "IT Security KPIs", "Vendor Contracts"].includes(page())}><div data-sf-view-group="dashboard-operations"><DashboardOperationsView {...props} /></div></Match>
        <Match when={authorized() && props.page.surface === "planner" && ["Overview", "OPEX", "CAPEX", "Versions"].includes(page())}><div data-sf-view-group="planner-lines"><PlannerLinesView {...props} /></div></Match>
        <Match when={authorized() && props.page.surface === "planner" && ["Headcount", "Entities & allocations", "FX rates"].includes(page())}><div data-sf-view-group="planner-headcount"><PlannerHeadcountView {...props} /></div></Match>
        <Match when={authorized() && props.page.surface === "procurement" && ["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"].includes(page())}><div data-sf-view-group="procurement-ui"><ProcurementView {...props} /></div></Match>
      </Switch>
    </div>
  )
}
