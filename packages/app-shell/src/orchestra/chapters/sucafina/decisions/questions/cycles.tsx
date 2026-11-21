import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { SfContextHandle } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfFailureUiState, sfOperationReady } from "../cases/model"

type SelectionEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.selection-list"]["output"]>
type Selection = Extract<SelectionEnvelope, { status: "ok" }>["value"][number]
type CycleEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.cycle-read"]["output"]>
type Cycle = Extract<CycleEnvelope, { status: "ok" }>["value"]

/** Read-only question work cycles from A13; selections never manufacture work. */
export function SfQuestionCycles(props: Readonly<{ owner: SfContextHandle; caseRef: string }>) {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore<{
    choices: readonly Selection[]
    selected: string
    cycle?: Cycle
    choicesState: SfUiState
    cycleState: SfUiState
  }>({ choices: [], selected: "", choicesState: "loading", cycleState: "empty" })
  createEffect(() => {
    const active = props.owner.ready()
    const generation = props.owner.generation()
    const ref = props.caseRef
    setUi({ choices: [], selected: "", cycle: undefined, choicesState: active ? "loading" : "unavailable", cycleState: "empty" })
    if (!active || !ref || !sfOperationReady(active.context, "collaboration.selection-list")) return
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    void createSfCollaborationClient(active.transport)["collaboration.selection-list"](
      { caseRef: ref }, { signal: abort.signal },
    ).then((result) => {
      if (abort.signal.aborted || props.owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setUi("choicesState", "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        setUi("choicesState", sfFailureUiState(result.body.status, result.status))
        return
      }
      setUi({ choices: result.body.value, choicesState: result.body.value.length ? "ready" : "empty" })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina question selection-list failed", error)
      setUi("choicesState", "unavailable")
    })
  })
  createEffect(() => {
    const active = props.owner.ready()
    const generation = props.owner.generation()
    const ref = props.caseRef
    const selected = ui.choices.find((item) => item.selectionRef === ui.selected && item.state === "active")
    setUi({ cycle: undefined, cycleState: selected ? "loading" : "empty" })
    if (!active || !selected || !ref || !sfOperationReady(active.context, "collaboration.cycle-read")) return
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    void createSfCollaborationClient(active.transport)["collaboration.cycle-read"](
      { caseRef: ref, selection: { selectionRef: selected.selectionRef, period: selected.period } },
      { signal: abort.signal },
    ).then((result) => {
      if (abort.signal.aborted || props.owner.generation() !== generation) return
      if (result.kind === "transport-error") {
        setUi("cycleState", "unavailable")
        return
      }
      if (result.body.status !== "ok") {
        setUi("cycleState", sfFailureUiState(result.body.status, result.status))
        return
      }
      setUi({ cycle: result.body.value, cycleState: result.body.value.state === "empty" ? "empty" : "ready" })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina question-cycle read failed", error)
      setUi("cycleState", "unavailable")
    })
  })
  return (
    <section class="mx-card sf-n24-section" aria-labelledby="sf-n24-cycles">
      <h2 id="sf-n24-cycles">{t("sf.ui37.cycle")}</h2>
      <Show when={ui.choicesState === "ready"} fallback={
        <SfStatePanel state={ui.choicesState}
          messageKey={"sf.ui37.noCycles" as import("../../shared/frame").SfCopyKey} />
      }>
        <label class="sf-n24-field">
          <span>{t("sf.ui37.cycleSelect")}</span>
          <select value={ui.selected} onChange={(event) => setUi("selected", event.currentTarget.value)}>
            <option value="">{t("sf.ui37.cycleSelect")}</option>
            <For each={ui.choices}>
              {(choice) => <option value={choice.selectionRef} disabled={choice.state !== "active"}>
                {choice.period.start} – {choice.period.end} · {choice.selectionRef}
              </option>}
            </For>
          </select>
        </label>
      </Show>
      <Show when={ui.cycleState === "ready" && ui.cycle}>
        {(cycle) => <>
          <h3>{t("sf.ui37.question")}</h3>
          <ul class="sf-n24-list"><For each={cycle().questions}>{(question) =>
            <li><bdi>{question.text}</bdi> · <bdi>{question.state}</bdi></li>}</For></ul>
          <h3>{t("sf.ui37.recipient")}</h3>
          <ul class="sf-n24-list"><For each={cycle().participants}>{(recipient) => <li><bdi>{recipient}</bdi></li>}</For></ul>
          <h3>{t("sf.ui37.cycle")}</h3>
          <Show when={cycle().work.items.length} fallback={<p>{t("sf.ui37.noCycleWork")}</p>}>
            <ul class="sf-n24-list"><For each={cycle().work.items}>{(item) =>
              <li><bdi>{item.actionRef}</bdi> · <bdi>{item.state}</bdi></li>}</For></ul>
          </Show>
        </>}
      </Show>
      <Show when={ui.cycleState !== "ready" && ui.cycleState !== "empty"}>
        <SfStatePanel state={ui.cycleState}
          messageKey={"sf.ui37.unavailable" as import("../../shared/frame").SfCopyKey} />
      </Show>
    </section>
  )
}
