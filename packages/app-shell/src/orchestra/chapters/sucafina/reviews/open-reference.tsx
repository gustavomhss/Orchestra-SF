import { createUniqueId } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../context"
import { encodeSfRouteRef } from "../navigation-state"
import type { SfSurfaceProps } from "../context/contracts"

/** Navigation carries the selected owner; the destination performs the source read. */
export function SfOpenReviewReference(props: {
  route: SfSurfaceProps<"UI48">["route"] | SfSurfaceProps<"UI50">["route"]
  destination: "reviews" | "reports"
}) {
  const uid = createUniqueId()
  const language = useLanguage()
  const owner = useSfContext()
  const navigate = useNavigate()
  const [draft, setDraft] = createStore({ reference: "" })
  const open = () => {
    const reference = draft.reference.trim()
    if (!owner.ready() || !reference || reference.length > 2048) return
    const query = new URLSearchParams({
      server: props.route.ownerSelection.serverKey,
      project: props.route.ownerSelection.projectId,
    })
    if (props.route.ownerSelection.installationId)
      query.set("installation", props.route.ownerSelection.installationId)
    navigate("/orchestra/sf-reviews/" + props.destination + "/" + encodeSfRouteRef(reference) + "?" + query)
  }
  return <form class="mx-card sf-n28-form sf-review-reference" onSubmit={(event) => { event.preventDefault(); open() }}>
    <label class="sf-n28-field" for={uid}>{language.t("sf.u32.ref")}
      <input id={uid} required maxlength="2048" autocomplete="off" value={draft.reference}
        onInput={(event) => setDraft("reference", event.currentTarget.value)} />
    </label>
    <button class="mx-btn" type="submit" disabled={!owner.ready() || !draft.reference.trim()}>
      {language.t(props.destination === "reviews" ? "sf.u32.openReview" : "sf.u33.openReview")}
    </button>
  </form>
}
