import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfContextState } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfPageFrame, type SfCopyKey } from "../shared/frame"
import { parseRoutinesRouteQuery } from "./routines-route"
import { sfCaptureReadyOwner, sfNativeOwnerChapterRequest, type SfReadyOwnerSnapshot } from "./native-chapter-entry"
import "./schedule-unavailable.css"

/** Presentation of the existing denied route, never admission of the UI66 leaf.
 * Only a verified same-owner context with an explicit unavailable Schedule reader
 * can explain this state; denied, ambiguous and invalid owners retain the F01 gate.
 */
export function sfUnavailableScheduleOwner(state: SfContextState, candidate: SfNativeRouteCandidate | undefined,
  query: URLSearchParams): SfReadyOwnerSnapshot | undefined {
  if (state.status !== "ready" || candidate?.surfaceId !== "UI66" ||
    parseRoutinesRouteQuery(query, candidate) === undefined) return
  const owner = sfCaptureReadyOwner(state)
  if (!owner) return
  const supplied = [query.get("server"), query.get("project"), query.get("installation")]
  if (supplied.some((value) => value !== null) &&
    (supplied[0] !== owner.selection.serverKey || supplied[1] !== owner.selection.projectId ||
      supplied[2] !== owner.selection.installationId)) return
  const readers = state.context.availability.filter((entry) => entry.family === "intelligence")
    .flatMap((entry) => entry.operations).filter((entry) => entry.operationId === "schedules.list")
  return readers.length > 0 && readers.every((entry) => entry.state === "unavailable" && !entry.operational)
    ? owner : undefined
}

export function SfUnavailableScheduleView(props: Readonly<{ owner: SfReadyOwnerSnapshot }>): JSX.Element {
  const language = useLanguage()
  const key = (value: string) => value as SfCopyKey
  return <SfPageFrame titleKey={key("sf.ui66.title")} subtitleKey={key("sf.ui66.unavailableDescription")}
    context={[]} tabs={[]} activeTab={null} secondaryActions={[]} density="comfortable" layout="reading" onLayoutMode={() => undefined}>
    <section class="sf-schedule-unavailable mx-card" data-sf-wave="six"
      data-sf-f01="not-admitted" data-sf-route-unavailable="UI66" aria-labelledby="sf-schedule-unavailable-title">
      <h2 id="sf-schedule-unavailable-title">{language.t("sf.ui66.unavailableTitle")}</h2>
      <p role="status">{language.t("sf.ui66.unavailableMessage")}</p>
      <A class="mx-btn" href={sfNativeOwnerChapterRequest("sf-routines", props.owner.selection)!}>
        {language.t("sf.ui66.returnToRoutines")}
      </A>
    </section>
  </SfPageFrame>
}
