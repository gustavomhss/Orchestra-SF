import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfWork } from "@orchestra/schema/sucafina/work"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfContext, SfRef, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"
import type { SfSurfaceProps } from "../context/contracts"
import { SfWorkView } from "../work"
import { SfSavedViewsView } from "../views"
import { SfRelationsView } from "../collaboration-pages/relations"
import { SfThreadView } from "../collaboration-pages/threads"
import { SfConfirmationView } from "../collaboration-pages/confirmations"

const kinds: Readonly<Record<string, readonly string[]>> = {
  UI30: ["entry"], UI32: ["list", "new", "entry"], UI51: ["new", "case-alias", "entry"], UI52: ["entry"], UI53: ["entry"],
}
export function isWorkSurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parseWorkRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-work" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  const keys = [...params.keys()]
  const allowSource = candidate.surfaceId === "UI51" && candidate.kind === "new"
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation", ...(allowSource ? ["source"] : [])].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  const source = params.get("source")
  if (source !== null && Option.isNone(Schema.decodeUnknownOption(SfCollaboration.operations["collaboration.relation-read"].input, { onExcessProperty: "error" })({ recordRefs: [source] }))) return
  return source === null ? {} : { source: source as SfRef }
}
export function workRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-work" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  const operations = candidate.surfaceId === "UI30" ? [SfWork.operations["projection.work-selection"].operationId, SfCollaboration.operations["collaboration.work-list"].operationId] :
    candidate.surfaceId === "UI32" ? [candidate.kind === "entry" ? SfWork.operations["views.open"].operationId : SfWork.operations["views.list"].operationId] :
    candidate.surfaceId === "UI51" ? [SfCollaboration.operations["collaboration.relation-read"].operationId] :
    candidate.surfaceId === "UI52" ? [SfCollaboration.operations["collaboration.thread-read"].operationId] :
    candidate.surfaceId === "UI53" ? [SfCollaboration.operations["collaboration.confirmation-project"].operationId] : []
  return operations.length > 0 && operations.every((id) => context.availability.some((resource) =>
    resource.operations.some((item) => item.operationId === id && item.state === "ready" && item.operational)))
}
export function SfWorkPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI30"}><SfWorkView surfaceId="UI30" route={props.route as SfSurfaceProps<"UI30">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI32"}><SfSavedViewsView surfaceId="UI32" route={props.route as SfSurfaceProps<"UI32">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI51"}><SfRelationsView surfaceId="UI51" route={props.route as SfSurfaceProps<"UI51">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI52"}><SfThreadView surfaceId="UI52" route={props.route as SfSurfaceProps<"UI52">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI53"}><SfConfirmationView surfaceId="UI53" route={props.route as SfSurfaceProps<"UI53">["route"]} /></Match>
  </Switch>
}
