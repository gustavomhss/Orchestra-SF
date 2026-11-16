import { Match, Switch, type JSX } from "solid-js"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfImportsView } from "../imports"
import { SfDocumentsView } from "../documents"

const kinds: Readonly<Record<string, readonly string[]>> = {
  UI55: ["entry"], UI56: ["entry"], UI57: ["history", "entry", "review"], UI68: ["entry"],
  UI58: ["entry", "new", "detail"], UI59: ["entry"], UI60: ["entry"],
}
export function isFilesSurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parseFilesRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (!(candidate.chapterId === "sf-imports" || candidate.chapterId === "sf-documents") || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  if ((["UI55", "UI56", "UI57", "UI68"].includes(candidate.surfaceId)) !== (candidate.chapterId === "sf-imports")) return
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation"].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  return {}
}
export function filesRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (!(candidate.chapterId === "sf-imports" || candidate.chapterId === "sf-documents") || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  if ((["UI55", "UI56", "UI57", "UI68"].includes(candidate.surfaceId)) !== (candidate.chapterId === "sf-imports")) return false
  if (!context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead)) return false
  const ready = (id: string) => context.availability.some((resource) => resource.family === "files" && resource.operations.some((item) => item.operationId === id && item.state === "ready" && item.operational))
  if (candidate.surfaceId === "UI68") return [SfFiles.operations["files.export.xlsx"].operationId, SfFiles.operations["files.export.suppliers"].operationId,
    SfFiles.operations["files.export.register"].operationId, SfFiles.operations["files.export.json"].operationId].some(ready)
  const operations = candidate.surfaceId === "UI55" ? [SfFiles.operations["files.import-targets"].operationId] :
    candidate.surfaceId === "UI56" || candidate.surfaceId === "UI57" ? [SfFiles.operations["files.import-reference"].operationId] :
      candidate.surfaceId === "UI58" && candidate.kind !== "detail" ? [SfFiles.operations["files.document-requests"].operationId, SfFiles.operations["files.document-sources"].operationId] :
        [SfFiles.operations["files.document-candidates"].operationId]
  return operations.every(ready)
}
export function SfFilesPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI55"}><SfImportsView surfaceId="UI55" route={props.route as SfSurfaceProps<"UI55">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI56"}><SfImportsView surfaceId="UI56" route={props.route as SfSurfaceProps<"UI56">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI57"}><SfImportsView surfaceId="UI57" route={props.route as SfSurfaceProps<"UI57">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI68"}><SfImportsView surfaceId="UI68" route={props.route as SfSurfaceProps<"UI68">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI58"}><SfDocumentsView surfaceId="UI58" route={props.route as SfSurfaceProps<"UI58">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI59"}><SfDocumentsView surfaceId="UI59" route={props.route as SfSurfaceProps<"UI59">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI60"}><SfDocumentsView surfaceId="UI60" route={props.route as SfSurfaceProps<"UI60">["route"]} /></Match>
  </Switch>
}
