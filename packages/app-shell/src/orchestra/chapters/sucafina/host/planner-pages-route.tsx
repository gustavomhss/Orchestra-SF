import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfPlannerOpexView } from "../planner/opex"
import { SfPlannerCapexView } from "../planner/capex"
import { SfPlannerHeadcountView } from "../planner/headcount"
import { SfAllocationsView } from "../planner/allocations"
import { SfFxView } from "../planner/fx"

const operations = {
  CAP18: SfPlanner.operations["domain.page.CAP18"],
  CAP19: SfPlanner.operations["domain.page.CAP19"],
  CAP20: SfPlanner.operations["domain.page.CAP20"],
  CAP21: SfPlanner.operations["domain.page.CAP21"],
  CAP22: SfPlanner.operations["domain.page.CAP22"],
} as const
const kinds: Readonly<Record<keyof typeof operations, readonly string[]>> = {
  CAP18: ["entry", "review", "line", "line-edit"],
  CAP19: ["entry", "review", "line", "line-edit", "project"],
  CAP20: ["entry", "rates", "roster-review", "settings", "position", "position-edit"],
  CAP21: ["entry", "entity", "allocation"],
  CAP22: ["entry"],
}

export function isPlannerPagesSurface(surfaceId: string): surfaceId is keyof typeof operations {
  return Object.hasOwn(operations, surfaceId)
}

/** Only producer-validated period selectors; text searches remain in memory. */
export function parsePlannerPagesRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-planner" || !isPlannerPagesSurface(candidate.surfaceId) ||
    !kinds[candidate.surfaceId].includes(candidate.kind)) return
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation", "year"].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  const year = params.get("year")
  if (year !== null && !/^\d{4}$/.test(year)) return
  const input = year === null ? {} : { year: Number(year) }
  if (Option.isNone(Schema.decodeUnknownOption(operations[candidate.surfaceId].input, { onExcessProperty: "error" })(input))) return
  return input
}

export function plannerPagesRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-planner" || !isPlannerPagesSurface(candidate.surfaceId) ||
    !kinds[candidate.surfaceId].includes(candidate.kind)) return false
  const operation = operations[candidate.surfaceId]
  return context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead) &&
    context.availability.some((resource) => resource.family === "planner" && resource.resource === candidate.surfaceId &&
      resource.operations.some((item) => item.operationId === operation.operationId && item.state === "ready" && item.operational))
}

export function SfPlannerPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP18"}><SfPlannerOpexView surfaceId="CAP18" route={props.route as SfSurfaceProps<"CAP18">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP19"}><SfPlannerCapexView surfaceId="CAP19" route={props.route as SfSurfaceProps<"CAP19">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP20"}><SfPlannerHeadcountView surfaceId="CAP20" route={props.route as SfSurfaceProps<"CAP20">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP21"}><SfAllocationsView surfaceId="CAP21" route={props.route as SfSurfaceProps<"CAP21">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP22"}><SfFxView surfaceId="CAP22" route={props.route as SfSurfaceProps<"CAP22">["route"]} /></Match>
  </Switch>
}
