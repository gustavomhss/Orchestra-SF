import { Match, Switch, type JSX } from "solid-js"
import { SfMemory } from "@orchestra/schema/sucafina/memory"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfMemoryView } from "../memory"

const kinds: Readonly<Record<string, readonly string[]>> = { UI61: ["chapter-root", "entry"], UI62: ["entry"], UI63: ["selection", "entry"] }
export function isMemorySurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parseMemoryRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-memory" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation"].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  return {}
}
export function memoryRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-memory" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  if (!context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead)) return false
  const operations = candidate.surfaceId === "UI62" ? [SfDecisions.operations["projection.cases"].operationId, SfMemory.operations["intelligence.memory-similar-cases"].operationId] :
    candidate.surfaceId === "UI63" && candidate.kind === "entry" ? [SfMemory.operations["intelligence.memory-catalog"].operationId, SfMemory.operations["intelligence.memory-outcome"].operationId] :
      [SfMemory.operations["intelligence.memory-catalog"].operationId]
  return operations.every((id) => context.availability.some((resource) => resource.operations.some((item) =>
    item.operationId === id && item.state === "ready" && item.operational)))
}
export function SfMemoryPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI61"}><SfMemoryView surfaceId="UI61" route={props.route as SfSurfaceProps<"UI61">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI62"}><SfMemoryView surfaceId="UI62" route={props.route as SfSurfaceProps<"UI62">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI63"}><SfMemoryView surfaceId="UI63" route={props.route as SfSurfaceProps<"UI63">["route"]} /></Match>
  </Switch>
}
