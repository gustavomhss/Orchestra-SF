import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfRoutines, SfRoutineCaseRef } from "@orchestra/schema/sucafina/routines"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import type { SfContext, SfRef, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfRoutineCatalogView } from "../routines/catalog"
import { SfRoutineRunView } from "../routines/runs"
import { SfSchedulesView } from "../routines/schedules"
import { SfResidentsView } from "../routines/residents"

const kinds: Readonly<Record<string, readonly string[]>> = { UI64: ["entry", "admission", "recipe"], UI65: ["list", "entry"], UI66: ["list", "new", "entry"], UI70: ["entry"] }
export function isRoutinesSurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parseRoutinesRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-routines" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  const keys = [...params.keys()]
  const caseAllowed = candidate.surfaceId === "UI64" || candidate.surfaceId === "UI65" && candidate.kind === "entry"
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation", ...(caseAllowed ? ["case"] : [])].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  const value = params.get("case")
  if (value !== null && Option.isNone(Schema.decodeUnknownOption(SfRoutineCaseRef.fields.id)(value))) return
  return value === null ? {} : { case: value as SfRef }
}
export function routinesRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-routines" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  if (!context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead)) return false
  const operations = candidate.surfaceId === "UI64" ? [SfAnalyses.operations["intelligence.analysis.choices"].operationId,
    candidate.kind === "admission" ? SfRoutines.operations["routines.read-admission"].operationId : SfRoutines.operations["routines.catalog"].operationId] :
    candidate.surfaceId === "UI65" ? [SfRoutines.operations["projection.routine"].operationId] :
    candidate.surfaceId === "UI66" ? [SfRoutines.operations["schedules.list"].operationId, ...(candidate.kind === "entry" ? [SfRoutines.operations["schedules.read"].operationId] : [])] :
      [SfAnalyses.operations["projection.residents"].operationId]
  return operations.every((id) => context.availability.some((resource) => resource.family === "intelligence" &&
    resource.operations.some((item) => item.operationId === id && item.state === "ready" && item.operational)))
}
export function SfRoutinePages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI64"}><SfRoutineCatalogView surfaceId="UI64" route={props.route as SfSurfaceProps<"UI64">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI65"}><SfRoutineRunView surfaceId="UI65" route={props.route as SfSurfaceProps<"UI65">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI66"}><SfSchedulesView surfaceId="UI66" route={props.route as SfSurfaceProps<"UI66">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI70"}><SfResidentsView surfaceId="UI70" route={props.route as SfSurfaceProps<"UI70">["route"]} /></Match>
  </Switch>
}
