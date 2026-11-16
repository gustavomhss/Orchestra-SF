import { Option, Schema } from "effect"
import { Match, Switch, type JSX } from "solid-js"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"
import type { SfSurfaceProps } from "../context/contracts"
import { SfPeopleOverviewView } from "../people/overview"
import { SfPeopleStructureView } from "../people/structure"
import { SfPeopleTalentView } from "../people/talent"

const operations = {
  CAP06: SfPeople.operations["domain.page.CAP06"], CAP07: SfPeople.operations["domain.page.CAP07"],
  CAP08: SfPeople.operations["domain.page.CAP08"],
} as const
const kinds: Readonly<Record<keyof typeof operations, readonly string[]>> = {
  CAP06: ["entry"], CAP07: ["entry", "cio", "new-member", "leader", "member", "member-edit"],
  CAP08: ["entry", "export", "import", "member", "edit"],
}
export function isPeopleSurface(id: string): id is keyof typeof operations { return Object.hasOwn(operations, id) }

export function parsePeopleRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-people" || !isPeopleSurface(candidate.surfaceId) || !kinds[candidate.surfaceId].includes(candidate.kind)) return
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation", "year", "month", ...(candidate.surfaceId === "CAP08" ? ["status"] : [])].includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  const year = params.get("year"), month = params.get("month"), status = params.get("status")
  if (year !== null && !/^\d{4}$/.test(year) || month !== null && !/^(?:[1-9]|1[0-2])$/.test(month) || status === "") return
  const input = { ...(year === null ? {} : { year: Number(year) }), ...(month === null ? {} : { month: Number(month) }),
    ...(status === null ? {} : { memberStatus: status }) }
  if (Option.isNone(Schema.decodeUnknownOption(operations[candidate.surfaceId].input, { onExcessProperty: "error" })(input))) return
  return { ...(year === null ? {} : { year: Number(year) }), ...(month === null ? {} : { month: Number(month) }), ...(status === null ? {} : { status }) }
}
export function peopleRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-people" || !isPeopleSurface(candidate.surfaceId) || !kinds[candidate.surfaceId].includes(candidate.kind)) return false
  const operation = operations[candidate.surfaceId]
  return context.destinations.some((item) => item.capabilityId === candidate.surfaceId && item.canRead) &&
    context.availability.some((resource) => resource.family === "domain-read" && resource.resource === candidate.surfaceId &&
      resource.operations.some((item) => item.operationId === operation.operationId && item.state === "ready" && item.operational))
}
export function SfPeoplePages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "CAP06"}><SfPeopleOverviewView surfaceId="CAP06" route={props.route as SfSurfaceProps<"CAP06">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP07"}><SfPeopleStructureView surfaceId="CAP07" route={props.route as SfSurfaceProps<"CAP07">["route"]} /></Match>
    <Match when={props.route.surfaceId === "CAP08"}><SfPeopleTalentView surfaceId="CAP08" route={props.route as SfSurfaceProps<"CAP08">["route"]} /></Match>
  </Switch>
}
