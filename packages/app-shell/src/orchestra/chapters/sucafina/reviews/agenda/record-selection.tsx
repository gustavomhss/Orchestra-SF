import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { Schema } from "effect"
import type { SfReviewUpdate } from "@orchestra/schema/sucafina/reviews"

type Section = Schema.Schema.Type<typeof SfReviewUpdate>["items"][number]

/** The producer supplies every selectable record identity and human label. */
export function SfAgendaRecordSelection(props: {
  section: Section
  disabled: boolean
  onSelection: (recordRefs: string[]) => void
}) {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const selected = () => props.section.recordRefs ?? props.section.recordOptions?.map((option) => option.recordRef) ?? []
  const choose = (recordRef: string, checked: boolean) => {
    if (props.disabled) return
    const refs = new Set(selected())
    if (checked) refs.add(recordRef)
    else refs.delete(recordRef)
    props.onSelection((props.section.recordOptions ?? []).filter((option) => refs.has(option.recordRef)).map((option) => option.recordRef))
  }
  return <Show when={props.section.recordOptions?.length}>
    <fieldset disabled={props.disabled} data-sf-record-selection={props.section.id}>
      <legend>{t("sf.u25.records")}: {props.section.title ?? props.section.topic}</legend>
      <p>{t("sf.u25.recordsHint")}</p>
      <ul>
        <For each={props.section.recordOptions}>{(option) => <li data-record-id={option.recordId}>
          <label>
            <input type="checkbox" value={option.recordRef} checked={selected().includes(option.recordRef)}
              onChange={(event) => choose(option.recordRef, event.currentTarget.checked)} />
            {option.label}
          </label>
        </li>}</For>
      </ul>
    </fieldset>
  </Show>
}
