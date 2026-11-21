import { sfOwnerQueryKeys, sfOwnerQueryValid } from "../navigation-state/owner"
import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfDomainPageCap09, SfDomainPageCap10 } from "@orchestra/schema/sucafina/domain"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfPortfolio } from "@orchestra/schema/sucafina/portfolio"
import type { SfReadableContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"
import type { SfSurfaceProps } from "../context/contracts"
import { SfPortfolioOverviewView } from "../portfolio/overview"
import { SfProjectsView } from "../portfolio/projects"
import { SfPortfolioScenariosView } from "../portfolio/scenarios"
import { SfSensitivityView } from "../portfolio/sensitivity"

const kinds: Readonly<Record<string, readonly string[]>> = {
  CAP09: ["entry"], CAP10: ["entry", "new", "detail", "edit", "milestones"],
  UI42: ["list", "entry"], UI43: ["entry"], UI44: ["selection", "entry"],
}
export function isPortfolioSurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parsePortfolioRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-portfolio" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  const cap = candidate.surfaceId === "CAP09" || candidate.surfaceId === "CAP10"
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => ![...sfOwnerQueryKeys, ...(cap ? ["year"] : []), ...(candidate.surfaceId === "CAP09" ? ["status", "filter"] : [])].includes(key))) return
  if (!sfOwnerQueryValid(params)) return
  const year = params.get("year"), status = params.get("status"), filter = params.get("filter")
  if (year !== null && !/^\d{4}$/.test(year) || status === "" || filter !== null && !["watch", "at-risk"].includes(filter)) return
  const input = { ...(year === null ? {} : { year: Number(year) }), ...(status === null ? {} : { status }), ...(filter === null ? {} : { filter }) }
  if (cap && Option.isNone(Schema.decodeUnknownOption(candidate.surfaceId === "CAP09" ? SfDomainPageCap09.input : SfDomainPageCap10.input, { onExcessProperty: "error" })(input))) return
  return input
}
export function portfolioRouteAvailable(context: SfReadableContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-portfolio" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  if (candidate.surfaceId === "CAP09" || candidate.surfaceId === "CAP10") {
    if (!context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead)) return false
    const operation = candidate.surfaceId === "CAP09" ? SfDomainPageCap09 : SfDomainPageCap10
    return context.availability.some((resource) => resource.family === "domain-read" && resource.resource === candidate.surfaceId &&
      resource.operations.some((item) => item.operationId === operation.operationId && item.state === "ready" && item.operational))
  }
  const ready = (family: "decisions" | "portfolio", operationId: string) => context.availability.some((resource) => resource.family === family &&
    resource.operations.some((item) => item.operationId === operationId && item.state === "ready" && item.operational))
  if (!ready("decisions", SfDecisions.operations["decisions.controls.read"].operationId)) return false
  if (candidate.surfaceId === "UI43") return ready("portfolio", SfPortfolio["portfolio.decision-portfolio-read"].operationId)
  if (candidate.surfaceId === "UI44" && candidate.kind === "entry") return ready("portfolio", SfPortfolio["portfolio.decision-sensitivity-read"].operationId)
  return true
}
export function SfPortfolioPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP09"}><SfPortfolioOverviewView surfaceId="CAP09" route={props.route as SfSurfaceProps<"CAP09">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP10"}><SfProjectsView surfaceId="CAP10" route={props.route as SfSurfaceProps<"CAP10">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI42"}><SfPortfolioScenariosView surfaceId="UI42" route={props.route as SfSurfaceProps<"UI42">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI43"}><SfPortfolioScenariosView surfaceId="UI43" route={props.route as SfSurfaceProps<"UI43">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI44"}><SfSensitivityView surfaceId="UI44" route={props.route as SfSurfaceProps<"UI44">["route"]} /></Match>
  </Switch>
}
