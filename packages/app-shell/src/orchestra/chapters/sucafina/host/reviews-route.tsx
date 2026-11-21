import { sfOwnerQueryKeys, sfOwnerQueryValid } from "../navigation-state/owner"
import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfReviews } from "@orchestra/schema/sucafina/reviews"
import { SfOperationId } from "@orchestra/schema/sucafina/common"
import type { SfReadableContext, SfRef, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfAgendaView } from "../reviews/agenda"
import { SfPreservedReviewView } from "../reviews/preserved"
import { SfReviewCompareView } from "../reviews/compare"
import { SfReportsView } from "../reviews/reports"

const kinds: Readonly<Record<string, readonly string[]>> = { UI47: ["entry"], UI48: ["list", "entry", "present"], UI49: ["entry"], UI50: ["list", "entry"] }
export function isReviewsSurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parseReviewsRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-reviews" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  const keys = [...params.keys()]
  const allowed = [...sfOwnerQueryKeys,
    ...(candidate.surfaceId === "UI47" ? ["year"] : []),
    ...(candidate.surfaceId === "UI48" ? ["reviewThread", "reviewMessage", "reviewIncarnation", "reviewVersion"] : []),
    ...(candidate.surfaceId === "UI49" ? ["previousReview", "currentReview"] : []),
  ]
  if (new Set(keys).size !== keys.length || keys.some((key) => !allowed.includes(key))) return
  if (!sfOwnerQueryValid(params)) return
  const year = params.get("year"), previous = params.get("previousReview"), current = params.get("currentReview")
  if (year !== null && (!/^\d{4}$/.test(year) || Number(year) === 0)) return
  if ([previous, current].some((ref) => ref !== null && (!ref.trim() || ref.length > 2048)) || previous !== null && previous === current) return
  if (candidate.surfaceId === "UI48" && !admittedReviewBinding(params)) return
  if (year !== null && Option.isNone(Schema.decodeUnknownOption(SfReviews["projection.review"].input, { onExcessProperty: "error" })({ start: `${year}-01-01`, end: `${year}-12-31` }))) return
  if ([previous, current].some((ref) => ref !== null && Option.isNone(Schema.decodeUnknownOption(SfReviews["dashboard.dashboard-review"].input, { onExcessProperty: "error" })({ id: ref })))) return
  return { ...(year === null ? {} : { year: Number(year) }), ...(previous === null ? {} : { previousReview: previous as SfRef }), ...(current === null ? {} : { currentReview: current as SfRef }) }
}

function admittedReviewBinding(params: URLSearchParams) {
  const thread = params.get("reviewThread")
  const message = params.get("reviewMessage")
  const incarnation = params.get("reviewIncarnation")
  const version = params.get("reviewVersion")
  if (thread !== null && (!thread.trim() || thread.length > 2048)) return false
  const parts = [message, incarnation, version]
  if (parts.every((value) => value === null)) return true
  return !!thread && parts.every((value) => !!value && value.trim().length > 0 && value.length <= 2048) &&
    /^[1-9]\d*$/.test(version ?? "") && Number.isSafeInteger(Number(version))
}
export function reviewsRouteAvailable(context: SfReadableContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-reviews" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  const id = candidate.surfaceId === "UI47" ? SfReviews["projection.review"].operationId : SfReviews["dashboard.dashboard-review"].operationId
  if (!context.availability.some((resource) => resource.family === "reviews" && resource.operations.some((item) => item.operationId === id && item.state === "ready" && item.operational))) return false
  if (candidate.surfaceId !== "UI50") return true
  const prepare = "reviews.report.prepare"
  const download = "files.export.review"
  if (!Schema.is(SfOperationId)(prepare) || !Schema.is(SfOperationId)(download)) return false
  return context.availability.some((resource) => resource.family === "reviews" && resource.resource === "report-export" &&
    resource.operations.some((item) => item.operationId === prepare && item.state === "ready" && item.operational)) &&
    context.availability.some((resource) => resource.family === "files" && resource.resource === "exports" &&
      resource.operations.some((item) => item.operationId === download && item.state === "ready" && item.operational))
}
export function SfReviewPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI47"}><SfAgendaView surfaceId="UI47" route={props.route as SfSurfaceProps<"UI47">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI48"}><SfPreservedReviewView surfaceId="UI48" route={props.route as SfSurfaceProps<"UI48">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI49"}><SfReviewCompareView surfaceId="UI49" route={props.route as SfSurfaceProps<"UI49">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI50"}><SfReportsView surfaceId="UI50" route={props.route as SfSurfaceProps<"UI50">["route"]} /></Match>
  </Switch>
}
