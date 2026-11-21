import { Show } from "solid-js"
import type { JSX } from "solid-js"
import { A } from "@solidjs/router"
import type { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import type { SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import { useLanguage } from "@/context/language"
import { sfAnalysisImportPreviewDestination } from "./import-preview"

type Output = Extract<typeof SfAnalyses.operations["intelligence.analysis.output"]["output"]["Type"], { status: "ok" }>["value"]

/** The analysis chapter displays the producer's HTML as untrusted text.
 * Only the separate, typed original import reference becomes a native link.
 * Opening it still passes through F01 and the import producer's reference read.
 */
export function SfAnalysisOutput(props: Readonly<{ output: Output; owner: SfOwnerSelection }>): JSX.Element {
  const language = useLanguage()
  return (
    <section class="sf-analyses-section" data-sf-analysis-output>
      <h2>{language.t("sf.u37.output")}</h2>
      <p>{language.t("sf.u37.untrustedHTML")}</p>
      <pre class="sf-analyses-original">{props.output.html}</pre>
      <Show when={sfAnalysisImportPreviewDestination(props.output, props.owner)}>{(href) => (
        <A class="mx-btn" href={href()}>{language.t("sf.u37.openImportPreview")}</A>
      )}</Show>
      <Show when={props.output.review}><p>{language.t("sf.u37.reviewAvailable")}</p></Show>
      <Show when={props.output.reviewUnavailable}><p>{language.t("sf.u37.reviewUnavailable")}</p></Show>
    </section>
  )
}
