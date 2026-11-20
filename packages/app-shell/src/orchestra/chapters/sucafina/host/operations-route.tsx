import { sfOwnerQueryKeys, sfOwnerQueryValid } from "../navigation-state/owner"
import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfOperations } from "@orchestra/schema/sucafina/operations"
import { SfDomainPageCap13, SfDomainPageCap15, SfDomainPageCap16 } from "@orchestra/schema/sucafina/domain"
import type { SfReadableContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfServiceView } from "../operations/service"
import { SfSecurityView } from "../operations/security"
import { SfRisksView } from "../operations/risks"
import { SfStakeholdersView } from "../operations/stakeholders"
import { SfPerformanceView } from "../operations/performance"

const operations = {
  CAP11: SfOperations.operations["domain.page.CAP11"], CAP12: SfOperations.operations["domain.page.CAP12"],
  CAP13: SfDomainPageCap13, CAP15: SfDomainPageCap15, CAP16: SfDomainPageCap16,
} as const
const kinds: Readonly<Record<keyof typeof operations, readonly string[]>> = {
  CAP11: ["entry", "edit-month", "import", "settings"], CAP12: ["entry", "edit-kpi", "action", "campaign", "incident"],
  CAP13: ["entry", "new", "detail", "edit"], CAP15: ["entry", "new", "detail", "edit"], CAP16: ["entry", "item", "subitem"],
}
export function isOperationsSurface(id: string): id is keyof typeof operations { return Object.hasOwn(operations, id) }
export function parseOperationsRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-operations" || !isOperationsSurface(candidate.surfaceId) || !kinds[candidate.surfaceId].includes(candidate.kind)) return
  // CAP13 retains the originating executive period for presentation/navigation.
  // Its original producer input remains the status filter, without year/month.
  const period = candidate.surfaceId === "CAP11" || candidate.surfaceId === "CAP12" || candidate.surfaceId === "CAP13"
  const statusAllowed = candidate.surfaceId === "CAP13" || candidate.surfaceId === "CAP15"
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => ![...sfOwnerQueryKeys, ...(period ? ["year", "month"] : []), ...(statusAllowed ? ["status"] : [])].includes(key))) return
  if (!sfOwnerQueryValid(params)) return
  const year = params.get("year"), month = params.get("month"), status = params.get("status")
  if (year !== null && !/^\d{4}$/.test(year) || month !== null && !/^(?:[1-9]|1[0-2])$/.test(month) || status === "") return
  if (candidate.surfaceId === "CAP13" && year !== null && (Number(year) < 2024 || Number(year) > 2027)) return
  const input = candidate.surfaceId === "CAP11" ? { ...(year === null ? {} : { opsYear: Number(year) }), ...(month === null ? {} : { operationsMonth: Number(month) }) } :
    candidate.surfaceId === "CAP12" ? { ...(year === null ? {} : { secYear: Number(year) }), ...(month === null ? {} : { securityMonth: Number(month) }) } :
    status === null ? {} : { status }
  if (Option.isNone(Schema.decodeUnknownOption(operations[candidate.surfaceId].input, { onExcessProperty: "error" })(input))) return
  return { ...(year === null ? {} : { year: Number(year) }), ...(month === null ? {} : { month: Number(month) }), ...(status === null ? {} : { status }) }
}
export function operationsRouteAvailable(context: SfReadableContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-operations" || !isOperationsSurface(candidate.surfaceId) || !kinds[candidate.surfaceId].includes(candidate.kind)) return false
  const operation = operations[candidate.surfaceId]
  return context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead) &&
    context.availability.some((resource) => resource.family === "domain-read" && resource.resource === candidate.surfaceId &&
      resource.operations.some((item) => item.operationId === operation.operationId && item.state === "ready" && item.operational))
}
export function SfOperationsPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP11"}><SfServiceView surfaceId="CAP11" route={props.route as SfSurfaceProps<"CAP11">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP12"}><SfSecurityView surfaceId="CAP12" route={props.route as SfSurfaceProps<"CAP12">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP13"}><SfRisksView surfaceId="CAP13" route={props.route as SfSurfaceProps<"CAP13">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP15"}><SfStakeholdersView surfaceId="CAP15" route={props.route as SfSurfaceProps<"CAP15">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP16"}><SfPerformanceView surfaceId="CAP16" route={props.route as SfSurfaceProps<"CAP16">["route"]} /></Match>
  </Switch>
}
