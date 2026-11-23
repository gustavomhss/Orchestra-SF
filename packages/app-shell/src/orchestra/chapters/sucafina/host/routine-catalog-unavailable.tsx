import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfContextState } from "../context/contracts"
import type { SfNativeRouteCandidate } from "../route-registry"
import { SfPageFrame, type SfCopyKey } from "../shared/frame"
import { parseRoutinesRouteQuery } from "./routines-route"
import { sfCaptureReadyOwner, sfNativeOwnerChapterRequest, type SfReadyOwnerSnapshot } from "./native-chapter-entry"
import "./routine-catalog-unavailable.css"

/** Explains the original F01 denial; it never admits or mounts UI64.
 * A publication reader cannot prove the native planning prerequisites. Only an
 * explicit unavailable catalog under a verified owner can use this explanation.
 */
export function sfUnavailableRoutineCatalogOwner(state: SfContextState, candidate: SfNativeRouteCandidate | undefined,
  query: URLSearchParams): SfReadyOwnerSnapshot | undefined {
  if (state.status !== "ready" || candidate?.surfaceId !== "UI64" ||
    parseRoutinesRouteQuery(query, candidate) === undefined) return
  const owner = sfCaptureReadyOwner(state)
  if (!owner) return
  const supplied = [query.get("server"), query.get("project"), query.get("installation")]
  if (supplied.some((value) => value !== null) &&
    (supplied[0] !== owner.selection.serverKey || supplied[1] !== owner.selection.projectId ||
      supplied[2] !== owner.selection.installationId)) return
  const readers = state.context.availability.filter((entry) => entry.family === "intelligence")
    .flatMap((entry) => entry.operations).filter((entry) => entry.operationId === "routines.catalog")
  return readers.length > 0 && readers.every((entry) => entry.state === "unavailable" && !entry.operational)
    ? owner : undefined
}

export function SfUnavailableRoutineCatalogView(props: Readonly<{ owner: SfReadyOwnerSnapshot }>): JSX.Element {
  const language = useLanguage()
  const key = (value: string) => value as SfCopyKey
  // These links request navigation only. Each destination is admitted again by F01.
  const contextHref = () => {
    const selection = props.owner.selection
    if (!selection.serverKey || !selection.projectId || !selection.installationId) return
    return "/orchestra/sf-home/context?" + new URLSearchParams({
      server: selection.serverKey, project: selection.projectId, installation: selection.installationId,
    }).toString()
  }
  return <SfPageFrame titleKey={key("sf.ui64.title")} subtitleKey={key("sf.ui64.unavailableDescription")}
    context={[]} tabs={[]} activeTab={null} secondaryActions={[]} density="comfortable" layout="reading" onLayoutMode={() => undefined}>
    <section class="sf-routine-catalog-unavailable mx-card" data-sf-wave="six"
      data-sf-f01="not-admitted" data-sf-route-unavailable="UI64" aria-labelledby="sf-routine-catalog-unavailable-title">
      <h2 id="sf-routine-catalog-unavailable-title">{language.t("sf.ui64.unavailableTitle")}</h2>
      <p role="status">{language.t("sf.ui64.unavailableMessage")}</p>
      <div class="sf-routine-unavailable-actions">
        <A class="mx-btn" href={sfNativeOwnerChapterRequest("sf-decisions", props.owner.selection)!}>
          {language.t("sf.ui64.returnToDecisions")}
        </A>
        <A class="sf-routine-unavailable-link" href={contextHref()!}>
          {language.t("sf.ui64.reviewContext")}
        </A>
      </div>
    </section>
  </SfPageFrame>
}
