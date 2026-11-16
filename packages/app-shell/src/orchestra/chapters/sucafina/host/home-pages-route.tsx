import { Match, Switch, type JSX } from "solid-js"
import { SfWork } from "@orchestra/schema/sucafina/work"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfSearchView } from "../search"
import { SfContextPage } from "../context"
import { SfLocalAdministrationView } from "../local-administration"

const kinds = ["UI31", "UI67", "UI69"] as const
export function isHomePagesSurface(id: string): boolean { return kinds.some((item) => item === id) }
export function parseHomePagesRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-home" || !isHomePagesSurface(candidate.surfaceId) || candidate.kind !== "entry") return
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation"].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  return {}
}
export function homePagesRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-home" || !isHomePagesSurface(candidate.surfaceId) || candidate.kind !== "entry") return false
  if (!context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead)) return false
  // UI67 renders the same context already read and stamped by F01 preflight.
  if (candidate.surfaceId === "UI67") return true
  const operation = candidate.surfaceId === "UI31" ? SfWork.operations["projection.search"].operationId : SfDomain.operations["projection.local-admin"].operationId
  const resource = candidate.surfaceId === "UI31" ? "search" : "local-admin"
  return context.availability.some((entry) => entry.family === "domain-read" && entry.resource === resource &&
    entry.operations.some((item) => item.operationId === operation && item.state === "ready" && item.operational))
}
export function SfHomePages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI31"}><SfSearchView surfaceId="UI31" route={props.route as SfSurfaceProps<"UI31">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI67"}><SfContextPage surfaceId="UI67" route={props.route as SfSurfaceProps<"UI67">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI69"}><SfLocalAdministrationView surfaceId="UI69" route={props.route as SfSurfaceProps<"UI69">["route"]} /></Match>
  </Switch>
}
