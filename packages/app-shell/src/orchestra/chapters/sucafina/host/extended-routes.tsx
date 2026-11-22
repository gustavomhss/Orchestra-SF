import { Match, Switch } from "solid-js"
import { Dynamic } from "solid-js/web"
import type { JSX } from "solid-js"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { isPlannerPagesSurface, parsePlannerPagesRouteQuery, plannerPagesRouteAvailable, SfPlannerPages } from "./planner-pages-route"
import { isPlannerRouteSurface, parsePlannerRouteQuery, plannerRouteAvailable } from "./planner-route"
import { isPeopleSurface, parsePeopleRouteQuery, peopleRouteAvailable, SfPeoplePages } from "./people-route"
import { isOperationsSurface, parseOperationsRouteQuery, operationsRouteAvailable, SfOperationsPages } from "./operations-route"
import { isPortfolioSurface, parsePortfolioRouteQuery, portfolioRouteAvailable, SfPortfolioPages } from "./portfolio-route"
import { isDecisionPagesSurface, parseDecisionPagesRouteQuery, decisionPagesRouteAvailable, SfDecisionPages } from "./decisions-pages-route"
import { isWorkSurface, parseWorkRouteQuery, workRouteAvailable, SfWorkPages } from "./work-route"
import { isHomePagesSurface, parseHomePagesRouteQuery, homePagesRouteAvailable, SfHomePages } from "./home-pages-route"
import { isMemorySurface, parseMemoryRouteQuery, memoryRouteAvailable, SfMemoryPages } from "./memory-route"
import { isReviewsSurface, parseReviewsRouteQuery, reviewsRouteAvailable, SfReviewPages } from "./reviews-route"
import { isFilesSurface, parseFilesRouteQuery, filesRouteAvailable, SfFilesPages } from "./files-route"
import { isRoutinesSurface, parseRoutinesRouteQuery, routinesRouteAvailable, SfRoutinePages } from "./routines-route"
import { dashboardRouteAvailable, isDashboardSurface, parseDashboardRouteQuery } from "./dashboard-route"
import { biRouteAvailable, isBiSurface, validBiRoute } from "./bi-route"
import { isProcurementSurface, parseProcurementRouteQuery, procurementRouteAvailable } from "./procurement-route"
import { SfExecutiveDashboard } from "../dashboard/executive"
import { SfHotTopicsPage } from "../dashboard/hot-topics"
import { SfHotTopicProposalView } from "../dashboard/hot-topics/proposals"
import { SfBudgetOverview } from "../dashboard/budget"
import { SfDashboardOpexView } from "../dashboard/opex"
import { SfDashboardCapexView } from "../dashboard/capex"
import { SfBiCatalog } from "../bi/catalog"
import { SfPlannerOverviewView } from "../planner/overview"
import { SfPlannerVersionsView } from "../planner/versions"
import { SfPlannerCompareView } from "../planner/compare"
import { SfVendorContractsPage } from "../procurement/contracts"
import { SfProcurementOverviewView } from "../procurement/overview"
import { SfRequestsPage } from "../procurement/requests/page"
import { SfSourcingView } from "../procurement/sourcing"
import { SfPrApprovalView } from "../procurement/approvals/pr"
import { SfRemainingApprovalsView } from "../procurement/approvals/remaining"
import { SfSuppliersView } from "../procurement/suppliers"
import { SfProcurementSettingsView } from "../procurement/settings"

function parseBiRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  return validBiRoute(candidate, params) ? {} : undefined
}

function SfDashboardPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP01"}><SfExecutiveDashboard surfaceId="CAP01" route={props.route as SfSurfaceProps<"CAP01">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP02"}><SfHotTopicsPage surfaceId="CAP02" route={props.route as SfSurfaceProps<"CAP02">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP03"}><SfBudgetOverview surfaceId="CAP03" route={props.route as SfSurfaceProps<"CAP03">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP04"}><SfDashboardOpexView surfaceId="CAP04" route={props.route as SfSurfaceProps<"CAP04">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP05"}><SfDashboardCapexView surfaceId="CAP05" route={props.route as SfSurfaceProps<"CAP05">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI54"}><SfHotTopicProposalView surfaceId="UI54" route={props.route as SfSurfaceProps<"UI54">["route"]} /></Match>
  </Switch>
}

function SfBiPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  if (props.route.surfaceId === "UI46")
    return <SfBiCatalog surfaceId="UI46" route={props.route as SfSurfaceProps<"UI46">["route"]} />
  return <SfBiCatalog surfaceId="UI45" route={props.route as SfSurfaceProps<"UI45">["route"]} />
}

function SfPlannerRoutePages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP17"}><SfPlannerOverviewView surfaceId="CAP17" route={props.route as SfSurfaceProps<"CAP17">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP23" && props.route.kind === "compare"}><SfPlannerCompareView surfaceId="CAP23" route={props.route as SfSurfaceProps<"CAP23">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP23"}><SfPlannerVersionsView surfaceId="CAP23" route={props.route as SfSurfaceProps<"CAP23">["route"]} /></Match>
  </Switch>
}

function SfProcurementPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP14"}><SfVendorContractsPage surfaceId="CAP14" route={props.route as SfSurfaceProps<"CAP14">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP24"}><SfProcurementOverviewView surfaceId="CAP24" route={props.route as SfSurfaceProps<"CAP24">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP25" && (props.route.kind === "sourcing" || props.route.kind === "quotes")}><SfSourcingView surfaceId="CAP25" route={props.route as SfSurfaceProps<"CAP25">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP25"}>
      <SfRequestsPage surfaceId="CAP25" route={props.route as SfSurfaceProps<"CAP25">["route"]} />
    </Match>
    <Match when={props.route.surfaceId === "CAP26" && props.route.kind === "review"}><SfRemainingApprovalsView surfaceId="CAP26" route={props.route as SfSurfaceProps<"CAP26">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP26"}><SfPrApprovalView surfaceId="CAP26" route={props.route as SfSurfaceProps<"CAP26">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP27"}><SfSuppliersView surfaceId="CAP27" route={props.route as SfSurfaceProps<"CAP27">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP28"}><SfProcurementSettingsView surfaceId="CAP28" route={props.route as SfSurfaceProps<"CAP28">["route"]} /></Match>
  </Switch>
}

// Dispatch only: each family independently checks its route and source admission.
const families = [
  { matches: isDashboardSurface, parse: parseDashboardRouteQuery, available: dashboardRouteAvailable, view: SfDashboardPages },
  { matches: isBiSurface, parse: parseBiRouteQuery, available: biRouteAvailable, view: SfBiPages },
  { matches: isPlannerRouteSurface, parse: parsePlannerRouteQuery, available: plannerRouteAvailable, view: SfPlannerRoutePages },
  { matches: isPlannerPagesSurface, parse: parsePlannerPagesRouteQuery, available: plannerPagesRouteAvailable, view: SfPlannerPages },
  { matches: isProcurementSurface, parse: parseProcurementRouteQuery, available: procurementRouteAvailable, view: SfProcurementPages },
  { matches: isPeopleSurface, parse: parsePeopleRouteQuery, available: peopleRouteAvailable, view: SfPeoplePages },
  { matches: isOperationsSurface, parse: parseOperationsRouteQuery, available: operationsRouteAvailable, view: SfOperationsPages },
  { matches: isPortfolioSurface, parse: parsePortfolioRouteQuery, available: portfolioRouteAvailable, view: SfPortfolioPages },
  { matches: isDecisionPagesSurface, parse: parseDecisionPagesRouteQuery, available: decisionPagesRouteAvailable, view: SfDecisionPages },
  { matches: isWorkSurface, parse: parseWorkRouteQuery, available: workRouteAvailable, view: SfWorkPages },
  { matches: isHomePagesSurface, parse: parseHomePagesRouteQuery, available: homePagesRouteAvailable, view: SfHomePages },
  { matches: isMemorySurface, parse: parseMemoryRouteQuery, available: memoryRouteAvailable, view: SfMemoryPages },
  { matches: isReviewsSurface, parse: parseReviewsRouteQuery, available: reviewsRouteAvailable, view: SfReviewPages },
  { matches: isFilesSurface, parse: parseFilesRouteQuery, available: filesRouteAvailable, view: SfFilesPages },
  { matches: isRoutinesSurface, parse: parseRoutinesRouteQuery, available: routinesRouteAvailable, view: SfRoutinePages },
] as const
export function isExtendedSurface(id: string): boolean { return families.some((family) => family.matches(id)) }
export function parseExtendedRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  return families.find((family) => family.matches(candidate.surfaceId))?.parse(params, candidate)
}
export function extendedRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  return families.find((family) => family.matches(candidate.surfaceId))?.available(context, candidate) === true
}
export function SfExtendedPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Dynamic component={families.find((family) => family.matches(props.route.surfaceId))?.view} route={props.route} />
}
