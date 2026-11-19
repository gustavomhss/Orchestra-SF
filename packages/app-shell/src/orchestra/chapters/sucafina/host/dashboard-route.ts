import { Option, Schema } from "effect"
import { SfDomain, SfDomainPageCap01, SfDomainPageCap03, SfDomainPageCap04, SfDomainPageCap05 } from "@orchestra/schema/sucafina/domain"
import { SfDomainPageCap02 } from "@orchestra/schema/sucafina/people"
import type { SfContext, SfResolvedQuery } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"

const selectors = ["server", "project", "installation"] as const
const schemas = { CAP01: SfDomainPageCap01.input, CAP02: SfDomainPageCap02.input,
  CAP03: SfDomainPageCap03.input, CAP04: SfDomainPageCap04.input, CAP05: SfDomainPageCap05.input } as const
const surfaces = ["CAP01", "CAP02", "CAP03", "CAP04", "CAP05", "UI54"] as const
export function isDashboardSurface(id: string): boolean {
  return surfaces.some((item) => item === id)
}

/** Syntax and producer input validation only; no authority is created here. */
export function parseDashboardRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId === "sf-dashboard" && candidate.surfaceId === "UI54" && candidate.kind === "entry") {
    const keys = [...params.keys()]
    if (new Set(keys).size !== keys.length || keys.some((key) => !selectors.includes(key as typeof selectors[number]))) return
    const selected = selectors.map((key) => params.get(key))
    if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
    return {}
  }
  if (candidate.chapterId !== "sf-dashboard" || !(candidate.surfaceId in schemas)) return
  if ((candidate.surfaceId === "CAP01" || candidate.surfaceId === "CAP03") && candidate.kind !== "entry") return
  if (!["entry", "new", "detail", "edit"].includes(candidate.kind)) return
  const keys = [...params.keys()]
  const allowed = [...selectors, "year", ...(candidate.surfaceId === "CAP04" || candidate.surfaceId === "CAP05" ? [] : ["month"]),
    ...(candidate.surfaceId === "CAP02" ? ["status"] : [])]
  if (new Set(keys).size !== keys.length || keys.some((key) => !allowed.includes(key))) return
  const selected = selectors.map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  const year = params.get("year"), month = params.get("month"), status = params.get("status")
  if (year !== null && !/^\d{4}$/.test(year) || month !== null && !/^(?:[1-9]|1[0-2])$/.test(month)) return
  if (status !== null && !["open", "progress", "blocked", "done"].includes(status)) return
  const input = { ...(year === null ? {} : { year: Number(year) }), ...(month === null ? {} : { month: Number(month) }) }
  const schema = schemas[candidate.surfaceId as keyof typeof schemas]
  const sourceInput = candidate.surfaceId === "CAP02" && status !== null ? { ...input, topicStatus: status } : input
  if (Option.isNone(Schema.decodeUnknownOption(schema, { onExcessProperty: "error" })(sourceInput))) return
  return { ...input, ...(status === null ? {} : { status }) }
}

/** CAP destinations and live operation readiness are prerequisites, not write grants. */
export function dashboardRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId === "sf-dashboard" && candidate.surfaceId === "UI54" && candidate.kind === "entry") {
    return context.availability.some((resource) => resource.family === "domain-read" && resource.resource === "hot-topic-proposal" &&
        resource.operations.some((operation) => operation.operationId === SfDomain.operations["dashboard.dashboard-workbench"].operationId &&
          operation.state === "ready" && operation.operational))
  }
  if (candidate.chapterId !== "sf-dashboard" || !(candidate.surfaceId in schemas)) return false
  return context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead) &&
    context.availability.some((resource) => resource.family === "domain-read" && resource.resource === candidate.surfaceId &&
      resource.operations.some((operation) => operation.operationId === `domain.page.${candidate.surfaceId}` &&
        operation.state === "ready" && operation.operational))
}
