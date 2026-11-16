import { Dynamic } from "solid-js/web"
import type { JSX } from "solid-js"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"
import { isPlannerPagesSurface, parsePlannerPagesRouteQuery, plannerPagesRouteAvailable, SfPlannerPages } from "./planner-pages-route"
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

// Dispatch only: each family independently checks its route and source admission.
const families = [
  { matches: isPlannerPagesSurface, parse: parsePlannerPagesRouteQuery, available: plannerPagesRouteAvailable, view: SfPlannerPages },
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
