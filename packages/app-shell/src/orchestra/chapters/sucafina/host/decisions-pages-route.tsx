import { Match, Switch, type JSX } from "solid-js"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import type { SfContext, SfResolvedQuery, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfAlternativesView } from "../decisions/alternatives"
import { SfAssumptionsView } from "../decisions/assumptions"
import { SfQuestionsView } from "../decisions/questions"
import { SfChoiceView } from "../decisions/choice"
import { SfProcurementProposalPage } from "../decisions/changes/procurement-proposal"
import { SfPreparedChangesView } from "../decisions/changes"
import { SfDecisionReceiptsView } from "../decisions/receipts"
import { SfAnalysesView } from "../decisions/analyses"

const kinds: Readonly<Record<string, readonly string[]>> = {
  UI35: ["entry", "new", "detail"], UI36: ["entry"], UI37: ["entry"], UI38: ["entry"],
  UI39: ["list", "entry"], UI40: ["history", "entry"], UI41: ["list", "entry"],
}
export function isDecisionPagesSurface(id: string): boolean { return Object.hasOwn(kinds, id) }
export function parseDecisionPagesRouteQuery(params: URLSearchParams, candidate: SfNativeRouteCandidate): SfResolvedQuery | undefined {
  if (candidate.chapterId !== "sf-decisions" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return
  const keys = [...params.keys()]
  const approval = candidate.surfaceId === "UI39" && candidate.kind === "entry" &&
    (params.has("proposalChoice") || params.has("proposalVersion"))
  const permitted = approval ? ["server", "project", "installation", "proposalChoice", "proposalVersion"] : ["server", "project", "installation"]
  if (new Set(keys).size !== keys.length || keys.some((key) => !permitted.includes(key))) return
  const selected = ["server", "project", "installation"].map((key) => params.get(key))
  if (selected.some((value) => value !== null) && !selected.every((value) => !!value)) return
  if (!approval) return {}
  const choiceId = params.get("proposalChoice")
  const version = params.get("proposalVersion")
  const caseVersion = Number(version)
  if (!choiceId?.trim() || choiceId.length > 1000 || !version || !/^[1-9][0-9]*$/.test(version) || !Number.isSafeInteger(caseVersion)) return
  return { procurementProposal: { choiceId, caseVersion } }
}
export function decisionPagesRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  if (candidate.chapterId !== "sf-decisions" || !kinds[candidate.surfaceId]?.includes(candidate.kind)) return false
  const operation = candidate.surfaceId === "UI41" ? SfAnalyses.operations["intelligence.analysis.choices"].operationId :
    candidate.surfaceId === "UI38" ? SfDecisions.operations["decisions.choice.read"].operationId :
      SfDecisions.operations["projection.case"].operationId
  return context.availability.some((resource) => resource.operations.some((item) =>
    item.operationId === operation && item.state === "ready" && item.operational))
}
export function SfDecisionPages(props: Readonly<{ route: SfResolvedRoute }>): JSX.Element {
  return <Switch>
    <Match when={props.route.surfaceId === "UI35"}><SfAlternativesView surfaceId="UI35" route={props.route as SfSurfaceProps<"UI35">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI36"}><SfAssumptionsView surfaceId="UI36" route={props.route as SfSurfaceProps<"UI36">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI37"}><SfQuestionsView surfaceId="UI37" route={props.route as SfSurfaceProps<"UI37">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI38"}><SfChoiceView surfaceId="UI38" route={props.route as SfSurfaceProps<"UI38">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI39" && props.route.kind === "entry" && props.route.query.procurementProposal}>
      <SfProcurementProposalPage route={props.route as Extract<SfSurfaceProps<"UI39">["route"], { kind: "entry" }>} />
    </Match>
    <Match when={props.route.surfaceId === "UI39"}><SfPreparedChangesView surfaceId="UI39" route={props.route as SfSurfaceProps<"UI39">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI40"}><SfDecisionReceiptsView surfaceId="UI40" route={props.route as SfSurfaceProps<"UI40">["route"]} /></Match>
    <Match when={props.route.surfaceId === "UI41"}><SfAnalysesView surfaceId="UI41" route={props.route as SfSurfaceProps<"UI41">["route"]} /></Match>
  </Switch>
}
