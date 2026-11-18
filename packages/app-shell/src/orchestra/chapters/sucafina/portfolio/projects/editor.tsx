import { createMemo, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U05_COPY } from "@/i18n/orchestra-chapters/sf-u05"
import type { SfPublicDraftController } from "../../context/contracts"
import type { SfProjectEdit, SfProjectMilestone } from "./model"
import { MILESTONE_STATUS, PROJECT_RISK, PROJECT_STATUS, sfProjectValues } from "./model"

type CopyKey = keyof typeof SF_U05_COPY
const editFields: readonly { id: keyof SfProjectEdit; label: CopyKey; type: "text" | "date" | "number" | "textarea" }[] = [
  { id: "name", label: "sf.u05.projects.form.name", type: "text" },
  { id: "desc", label: "sf.u05.projects.form.desc", type: "textarea" },
  { id: "priority", label: "sf.u05.projects.form.priority", type: "text" },
  { id: "pm", label: "sf.u05.projects.form.pm", type: "text" },
  { id: "start", label: "sf.u05.projects.form.start", type: "date" },
  { id: "end", label: "sf.u05.projects.form.end", type: "date" },
  { id: "budget", label: "sf.u05.projects.form.budget", type: "number" },
  { id: "spent", label: "sf.u05.projects.form.spent", type: "number" },
  { id: "pct", label: "sf.u05.projects.form.pct", type: "number" },
  { id: "notes", label: "sf.u05.projects.form.notes", type: "textarea" },
]

export function SfProjectEditor(props: Readonly<{
  draft: SfPublicDraftController<SfProjectEdit>
  allowed: boolean
  busy: boolean
  review: boolean
  isNew: boolean
  onReview: () => void
  onConfirm: () => void
  onCancelReview: () => void
  onDiscard: () => void
}>): JSX.Element {
  const language = useLanguage()
  const t = (key: CopyKey) => language.t(key as Parameters<typeof language.t>[0])
  const snapshot = () => props.draft.snapshot()
  const active = () => {
    const state = snapshot()
    return state.availability === "active" ? state : null
  }
  const edit = () => active()?.value
  const unavailable = () => !props.allowed || props.busy || !active() ||
    active()?.phase === "submitting" || active()?.phase === "outcome-unknown"
  const canReview = createMemo(() => !unavailable() && !!edit() && sfProjectValues(edit()!) !== null)
  const update = <K extends keyof SfProjectEdit>(key: K, value: SfProjectEdit[K]) => {
    const original = edit()
    if (!original || unavailable()) return
    props.draft.edit({ ...original, [key]: value })
  }
  const statusKey = (status: SfProjectEdit["status"]): CopyKey =>
    status === "Planning" ? "sf.u05.projects.status.Planning" : status === "In Progress" ?
      "sf.u05.projects.status.InProgress" : status === "On Hold" ? "sf.u05.projects.status.OnHold" :
        "sf.u05.projects.status.Completed"
  const riskKey = (risk: SfProjectEdit["risk"]): CopyKey =>
    risk === "Low" ? "sf.u05.projects.risk.Low" : risk === "Medium" ?
      "sf.u05.projects.risk.Medium" : "sf.u05.projects.risk.High"
  return (
    <Show when={edit()} fallback={<p role="status">{t("sf.u05.projects.readOnly")}</p>}>
      {(current) => (
        <form class="sf-u05-editor" data-sf-project-editor onSubmit={(event) => {
          event.preventDefault()
          if (canReview() && !props.review) props.onReview()
        }}>
          <fieldset disabled={unavailable()} aria-label={t("sf.u05.projects.general")}>
            <legend>{t("sf.u05.projects.general")}</legend>
            <div class="sf-u05-editor-grid">
              <label class="sf-u05-field">{t("sf.u05.projects.form.name")}
                <input required value={current().name} onInput={(event) => update("name", event.currentTarget.value)} />
              </label>
              <label class="sf-u05-field">{t("sf.u05.projects.form.status")}
                <select value={current().status} onChange={(event) => update("status", event.currentTarget.value as SfProjectEdit["status"])}>
                  <For each={PROJECT_STATUS}>{(status) => <option value={status}>{t(statusKey(status))}</option>}</For>
                </select>
              </label>
              <label class="sf-u05-field">{t("sf.u05.projects.form.risk")}
                <select value={current().risk} onChange={(event) => update("risk", event.currentTarget.value as SfProjectEdit["risk"])}>
                  <For each={PROJECT_RISK}>{(risk) => <option value={risk}>{t(riskKey(risk))}</option>}</For>
                </select>
              </label>
              <For each={editFields.slice(1, 4)}>{(field) => (
                <label class="sf-u05-field">{t(field.label)}
                  {field.type === "textarea" ?
                    <textarea value={String(current()[field.id])} onInput={(event) => update(field.id, event.currentTarget.value as never)} /> :
                    <input value={String(current()[field.id])} onInput={(event) => update(field.id, event.currentTarget.value as never)} />}
                </label>
              )}</For>
            </div>
          </fieldset>
          <fieldset disabled={unavailable()}>
            <legend>{t("sf.u05.projects.schedule")}</legend>
            <div class="sf-u05-editor-grid">
              <For each={editFields.slice(4, 6)}>{(field) => (
                <label class="sf-u05-field">{t(field.label)}
                  <input type="date" value={String(current()[field.id])}
                    onInput={(event) => update(field.id, event.currentTarget.value as never)} />
                </label>
              )}</For>
            </div>
          </fieldset>
          <fieldset disabled={unavailable()}>
            <legend>{t("sf.u05.projects.financial")}</legend>
            <div class="sf-u05-editor-grid">
              <For each={editFields.slice(6, 9)}>{(field) => (
                <label class="sf-u05-field">{t(field.label)}
                  <input type="number" step="any" value={String(current()[field.id])}
                    onInput={(event) => update(field.id, event.currentTarget.value as never)} />
                </label>
              )}</For>
            </div>
            <Show when={!canReview()}><p role="status">{t("sf.u05.projects.invalidAmounts")}</p></Show>
          </fieldset>
          <fieldset disabled={unavailable()}>
            <legend>{t("sf.u05.projects.watchSection")}</legend>
            <label class="sf-u05-check"><input type="checkbox" checked={current().watchList}
              onChange={(event) => update("watchList", event.currentTarget.checked)} />
              {t("sf.u05.projects.form.watchList")}</label>
          </fieldset>
          <fieldset disabled={unavailable()}>
            <legend>{t("sf.u05.projects.notes")}</legend>
            <label class="sf-u05-field">{t("sf.u05.projects.form.notes")}
              <textarea value={current().notes} rows={4} onInput={(event) => update("notes", event.currentTarget.value)} />
            </label>
          </fieldset>
          <Show when={props.review} fallback={
            <div class="sf-u05-form-actions">
              <button type="submit" class="mx-btn primary" disabled={!canReview()}>
                {t(props.isNew ? "sf.u05.projects.create" : "sf.u05.projects.save")}
              </button>
              <button type="button" class="mx-btn" disabled={unavailable()} onClick={props.onDiscard}>
                {t("sf.u05.projects.discard")}
              </button>
            </div>
          }>
            <section class="sf-u05-review" role="region" aria-label={t("sf.u05.projects.review")}>
              <h3>{t("sf.u05.projects.confirmSave")}</h3>
              <p>{t("sf.u05.projects.review")}</p>
              <div class="sf-u05-form-actions">
                <button type="button" class="mx-btn primary" disabled={!canReview()} onClick={props.onConfirm}>
                  {t("sf.u05.projects.confirmSave")}
                </button>
                <button type="button" class="mx-btn" onClick={props.onCancelReview}>
                  {t("sf.u05.projects.discard")}
                </button>
              </div>
            </section>
          </Show>
        </form>
      )}
    </Show>
  )
}

export type SfMilestoneDraft = Readonly<{ milestoneId: string; name: string; date: string; status: SfProjectMilestone["status"]; notes: string }>
export function SfMilestoneEditor(props: Readonly<{
  projectId: string
  source: SfProjectMilestone | null
  allowed: boolean
  busy: boolean
  onSave: (draft: SfMilestoneDraft) => void
  onDelete: (milestoneId: string) => void
}>): JSX.Element {
  const language = useLanguage()
  const t = (key: CopyKey) => language.t(key as Parameters<typeof language.t>[0])
  const [draft, setDraft] = createStore<SfMilestoneDraft>({
    milestoneId: props.source?.id ?? "", name: props.source?.name ?? "",
    date: props.source?.date ?? "", status: props.source?.status ?? "upcoming",
    notes: props.source?.notes ?? "",
  })
  const usable = () => props.allowed && !props.busy
  return (
    <form class="sf-u05-milestone-editor" data-sf-milestone-editor onSubmit={(event) => {
      event.preventDefault()
      if (usable() && draft.name.trim() && MILESTONE_STATUS.includes(draft.status ?? "upcoming"))
        props.onSave({ ...draft })
    }}>
      <fieldset disabled={!usable()}>
        <legend>{t("sf.u05.projects.milestone")}</legend>
        <label class="sf-u05-field">{t("sf.u05.projects.milestoneName")}
          <input required value={draft.name} onInput={(event) => setDraft("name", event.currentTarget.value)} />
        </label>
        <label class="sf-u05-field">{t("sf.u05.projects.date")}
          <input type="date" value={draft.date} onInput={(event) => setDraft("date", event.currentTarget.value)} />
        </label>
        <label class="sf-u05-field">{t("sf.u05.projects.milestoneStatus")}
          <select value={draft.status ?? "upcoming"} onChange={(event) => setDraft("status", event.currentTarget.value as SfMilestoneDraft["status"])}>
            <For each={MILESTONE_STATUS}>{(status) => <option value={status}>{status}</option>}</For>
          </select>
        </label>
        <label class="sf-u05-field">{t("sf.u05.projects.milestoneNotes")}
          <textarea value={draft.notes} onInput={(event) => setDraft("notes", event.currentTarget.value)} />
        </label>
      </fieldset>
      <div class="sf-u05-form-actions">
        <button type="submit" class="mx-btn" disabled={!usable() || !draft.name.trim()}>
          {t(draft.milestoneId ? "sf.u05.projects.milestoneSave" : "sf.u05.projects.milestoneAdd")}
        </button>
        <Show when={draft.milestoneId}>
          <button type="button" class="mx-btn" disabled={!usable()} onClick={() => props.onDelete(draft.milestoneId)}>
            {t("sf.u05.projects.milestoneDelete")}
          </button>
        </Show>
      </div>
    </form>
  )
}
