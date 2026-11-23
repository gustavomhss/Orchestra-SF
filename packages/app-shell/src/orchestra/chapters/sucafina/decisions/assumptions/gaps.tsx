import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { sfDecisionGap, sfDecisionGapGroups } from "./presentation"

/** A repeated source reason is read once with every affected category visible. */
export function SfDecisionGaps(props: { values: readonly string[] }) {
  const language = useLanguage()
  const groups = createMemo(() => sfDecisionGapGroups(props.values))
  const hasCodes = createMemo(() => props.values.some((value) => {
    const gap = sfDecisionGap(value)
    return !!gap.label || !!gap.category
  }))
  return <>
    <ul class="sf-n24-list" data-sf-gap-summary>
      <For each={groups()}>{(group) =>
        <li>
          <Show when={group.kind === "coverage" ? group : undefined} fallback={
            group.kind === "literal" ? <bdi>{group.label ? language.t(group.label) : group.code}</bdi> : undefined
          }>{(coverage) =>
            <div class="sf-decision-coverage-gap">
              <p class="sf-decision-note">{language.t("sf.ui35.coverage")}</p>
              <p><bdi>{coverage().reasonKey ? language.t(coverage().reasonKey!) : coverage().reason}</bdi></p>
              <p class="sf-decision-note"><For each={coverage().categories}>{(category, index) =>
                <>{index() > 0 ? ", " : ""}<bdi>{language.t(category)}</bdi></>
              }</For></p>
            </div>
          }</Show>
        </li>
      }</For>
    </ul>
    <Show when={hasCodes()}>
      <details class="sf-decision-source-scope">
        <summary>{language.t("sf.ui36.sourceDetails")}</summary>
        <ul class="sf-n24-list"><For each={props.values}>{(value) => <li><bdi>{value}</bdi></li>}</For></ul>
      </details>
    </Show>
  </>
}
