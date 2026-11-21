import type { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfReadableContext, SfResolvedQuery } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"

type Operation = (typeof SfPlanner.operations)["domain.page.CAP18" | "domain.page.CAP19" | "domain.page.CAP20" | "domain.page.CAP21" | "domain.page.CAP22"]
type Page = Extract<Schema.Schema.Type<Operation["output"]>, { status: "ok" }>["value"]

export function plannerPagesNeedsPreflight(candidate: SfNativeRouteCandidate, query: SfResolvedQuery): boolean {
  return query.version !== undefined || query.year !== undefined && candidate.surfaceId !== "CAP21" ||
    ["line", "line-edit", "project", "position", "position-edit", "entity", "allocation"].includes(candidate.kind)
}

/** Match only records and actual selected versions returned by the original page. */
export function plannerPagesSelectionMatches(candidate: SfNativeRouteCandidate, query: SfResolvedQuery, page: Page): boolean {
  if (page.capabilityId !== candidate.surfaceId) return false
  if (page.capabilityId === "CAP21" && query.version !== undefined) return false
  if (page.capabilityId !== "CAP21") {
    const selected = page.data.selectedVersion
    if (!selected || page.selection.versionId !== selected.id ||
      page.data.versions.filter((version) => version.id === selected.id).length !== 1 ||
      !page.data.versions.some((version) => version.id === selected.id && version.year === selected.year) ||
      query.version !== undefined && selected.id !== query.version ||
      query.year !== undefined && selected.year !== query.year) return false
  }
  if (candidate.kind === "line" || candidate.kind === "line-edit") {
    return (page.capabilityId === "CAP18" || page.capabilityId === "CAP19") && !!candidate.parameters.lineRef &&
      page.data.lines.filter((row) => row.id === candidate.parameters.lineRef).length === 1
  }
  if (candidate.kind === "project") return page.capabilityId === "CAP19" && !!candidate.parameters.projectRef &&
    page.data.projects.filter((row) => row.id === candidate.parameters.projectRef).length === 1
  if (candidate.kind === "position" || candidate.kind === "position-edit") return page.capabilityId === "CAP20" && !!candidate.parameters.positionRef &&
    page.data.positions.filter((row) => row.id === candidate.parameters.positionRef).length === 1
  if (candidate.kind === "entity") return page.capabilityId === "CAP21" && !!candidate.parameters.entityRef &&
    page.data.entities.filter((row) => row.id === candidate.parameters.entityRef).length === 1
  if (candidate.kind === "allocation") return page.capabilityId === "CAP21" && !!candidate.parameters.allocationRef &&
    page.data.allocations.filter((row) => row.id === candidate.parameters.allocationRef).length === 1
  return true
}

export async function preflightPlannerPages(input: Readonly<{
  candidate: SfNativeRouteCandidate
  query: SfResolvedQuery
  transport: SfTransport
  stamp: SfReadableContext["stamp"]
  signal: AbortSignal
  current: () => boolean
}>): Promise<"authorized" | "denied" | "unavailable"> {
  if (input.signal.aborted || !input.current()) return "unavailable"
  if (input.candidate.surfaceId === "CAP21" && input.query.version !== undefined) return "denied"
  const query = { ...(input.query.year === undefined ? {} : { year: input.query.year }),
    ...(input.query.version === undefined ? {} : { version: input.query.version }) }
  const client = createSfPlannerClient(input.transport)
  const options = { signal: input.signal }
  const response = input.candidate.surfaceId === "CAP18" ? await client["domain.page.CAP18"](query, options) :
    input.candidate.surfaceId === "CAP19" ? await client["domain.page.CAP19"](query, options) :
    input.candidate.surfaceId === "CAP20" ? await client["domain.page.CAP20"](query, options) :
    input.candidate.surfaceId === "CAP21" ? await client["domain.page.CAP21"](input.query.year === undefined ? {} : { year: input.query.year }, options) :
    input.candidate.surfaceId === "CAP22" ? await client["domain.page.CAP22"](query, options) : undefined
  if (input.signal.aborted || !input.current()) return "unavailable"
  if (!response || response.kind !== "response" || response.status < 200 || response.status >= 300 || response.body.status !== "ok") return "denied"
  const actual = response.body.context
  const expected = input.stamp
  if (actual.installationId !== expected.installationId || actual.projectId !== expected.projectId ||
    actual.hostId !== expected.hostId || actual.principalRef !== expected.principalRef ||
    actual.policyVersion !== expected.policyVersion || actual.accessRevision !== expected.accessRevision) return "denied"
  return plannerPagesSelectionMatches(input.candidate, input.query, response.body.value) ? "authorized" : "denied"
}
