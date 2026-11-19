// S04 attachment presentation. Host owns selection, admission, ACL and download bytes.
import { createUniqueId, For, Match, Show, Switch, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { SfAttachment, SfAttachmentFieldProps, SfMessage } from "../evidence/types"
import type { SfFileSelectionRef, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import {
  canAdmitSelected,
  canRequestDownload,
  canRequestReferenceRemoval,
} from "./guards"
import { SfStatePanel } from "../states"
import type { SfCopyKey } from "../frame/types"
import "../evidence/s04.css"

export type { SfAttachment, SfFileAdmission, SfAttachmentFieldProps } from "../evidence/types"

const statusKeys = {
  admitted: "orchestra.sf.s04.attachments.admitted",
  blocked: "orchestra.sf.s04.attachments.blocked",
  "scanner-unavailable": "orchestra.sf.s04.attachments.scanner-unavailable",
  replaced: "orchestra.sf.s04.attachments.replaced",
  revoked: "orchestra.sf.s04.attachments.revoked",
} as const

type RemovalAttempt = Readonly<{
  attachmentRef: SfRef
  attachmentVersion: SfVersion
  recordRef: SfRef
  recordVersion: SfVersion
}>

export function SfAttachmentField(props: SfAttachmentFieldProps): JSX.Element {
  const language = useLanguage()
  const id = createUniqueId()
  const [requests, setRequests] = createStore<{
    admissionSelectionRef: SfFileSelectionRef | null
    removals: readonly RemovalAttempt[]
  }>({ admissionSelectionRef: null, removals: [] })
  const msg = (value: SfMessage) =>
    language.t(value.key as Parameters<typeof language.t>[0], value.params)
  const admittedCount = () => props.attachments.filter((item) => item.status === "admitted").length
  const canSelect = () =>
    props.admissionState.kind !== "admitting" &&
    Number.isSafeInteger(props.limit.maxFiles) &&
    props.limit.maxFiles > admittedCount() &&
    Number.isSafeInteger(props.limit.maxBytes) &&
    props.limit.maxBytes > 0 &&
    props.acceptedFormats.length > 0
  const admissionRequested = () => {
    const state = props.admissionState
    return state.kind === "selected" && requests.admissionSelectionRef === state.selectionRef
  }
  const canAdmit = () =>
    !admissionRequested() &&
    canAdmitSelected(props.admissionState, props.acceptedFormats, props.limit, props.attachments)
  const removalRequested = (item: SfAttachment) =>
    requests.removals.some((attempt) =>
      attempt.attachmentRef === item.ref &&
      attempt.attachmentVersion === item.version &&
      attempt.recordRef === props.recordRef &&
      attempt.recordVersion === props.recordVersion,
    )

  // A dispatched opaque selection stays locked through response loss or phase changes.
  // Only the producer can provide a new selection handle or a confirmed outcome.
  const admit = () => {
    if (!canAdmit()) return
    const current = props.admissionState
    if (current.kind !== "selected") return
    setRequests("admissionSelectionRef", current.selectionRef)
    props.onAdmit({
      selectionRef: current.selectionRef,
      recordRef: props.recordRef,
      recordVersion: props.recordVersion,
    })
  }
  const admittedStatus = (item: SfAttachmentFieldProps["attachments"][number]) =>
    language.t(statusKeys[item.status])

  return (
    <section class="sf-s04 mx-card" aria-labelledby={id + "-title"}
      aria-busy={props.admissionState.kind === "admitting"}>
      <header class="sf-s04-head">
        <h2 id={id + "-title"}>{language.t("orchestra.sf.s04.attachments.title")}</h2>
        <button type="button" class="mx-btn" disabled={!canSelect()}
          onClick={() => { if (canSelect()) props.onSelectFile() }}>
          {language.t("orchestra.sf.s04.attachments.select")}
        </button>
      </header>

      <p class="sf-s04-muted">
        {language.t("orchestra.sf.s04.attachments.maxBytes")}: {props.limit.maxBytes}
        {" · "}
        {language.t("orchestra.sf.s04.attachments.maxFiles")}: {props.limit.maxFiles}
      </p>

      <section aria-label={language.t("orchestra.sf.s04.attachments.formats")}>
        <h3>{language.t("orchestra.sf.s04.attachments.formats")}</h3>
        <ul>
          <For each={props.acceptedFormats}>{(format) => (
            <li>
              {msg(format.label)} — <bdi>{format.mediaType}</bdi>
              {" ("}<bdi>{format.extensions.join(", ")}</bdi>{")"}
            </li>
          )}</For>
        </ul>
      </section>

      <Switch>
        <Match when={props.admissionState.kind === "selected"}>
          <Show when={props.admissionState.kind === "selected" ? props.admissionState : undefined}>
            {(phase) => (
              <div class="sf-s04-row" role="group" aria-label={language.t("orchestra.sf.s04.attachments.selected")}>
                <p role="status">{language.t("orchestra.sf.s04.attachments.selected")}</p>
                <p class="sf-s04-file-name">
                  <bdi>{phase().fileName}</bdi>
                </p>
                <p class="sf-s04-muted">
                  {language.t("orchestra.sf.s04.attachments.fileCount")}: {phase().bytes}
                  {" · "}
                  {language.t("orchestra.sf.s04.attachments.mediaType")}: <bdi>{phase().mediaType}</bdi>
                </p>
                <Show when={!canAdmit() && !admissionRequested()}>
                  <p class="mx-note" role="status">{language.t("orchestra.sf.s04.attachments.notEligible")}</p>
                </Show>
                <Show when={admissionRequested()}>
                  <p role="status">{language.t("orchestra.sf.s04.attachments.admissionPending")}</p>
                </Show>
                <button type="button" class="mx-btn primary" disabled={!canAdmit()} onClick={admit}>
                  {language.t("orchestra.sf.s04.attachments.admit")}
                </button>
              </div>
            )}
          </Show>
        </Match>
        <Match when={props.admissionState.kind === "admitting"}>
          <p role="status" aria-live="polite">{language.t("orchestra.sf.s04.attachments.admitting")}</p>
        </Match>
        <Match when={props.admissionState.kind === "admitted"}>
          <p role="status" aria-live="polite">{language.t("orchestra.sf.s04.attachments.admitted")}</p>
        </Match>
        <Match when={props.admissionState.kind === "blocked" || props.admissionState.kind === "scanner-unavailable" || props.admissionState.kind === "failed"}>
          <Show when={props.admissionState.kind === "blocked" || props.admissionState.kind === "scanner-unavailable" || props.admissionState.kind === "failed" ? props.admissionState : undefined}>
            {(phase) => (
              <div role="alert">
                <p>{phase().kind === "scanner-unavailable"
                  ? language.t("orchestra.sf.s04.attachments.scanner-unavailable")
                  : phase().kind === "blocked"
                    ? language.t("orchestra.sf.s04.attachments.blocked")
                    : language.t("orchestra.sf.s04.attachments.failed")}</p>
                <p>{msg(phase().reason)}</p>
              </div>
            )}
          </Show>
        </Match>
      </Switch>

      <Show when={props.attachments.length === 0}>
        <SfStatePanel state="empty" messageKey={"orchestra.sf.s04.attachments.empty" as SfCopyKey} />
      </Show>
      <ul class="sf-s04-list" aria-label={language.t("orchestra.sf.s04.attachments.title")}>
        <For each={props.attachments}>{(item) => (
          <li class="sf-s04-row sf-s04-file">
            <div class="sf-s04-file-name">
              <strong>
                <Show when={item.status !== "revoked"} fallback={language.t("orchestra.sf.s04.attachments.revoked")}>
                  <bdi>{item.fileName}</bdi>
                </Show>
              </strong>
              <p class="sf-s04-muted sf-s04-status" role="status">{admittedStatus(item)}</p>
              <Show when={item.status === "admitted"}>
                <p class="sf-s04-muted">
                  {language.t("orchestra.sf.s04.attachments.fileCount")}: {item.bytes}
                  {" · "}<bdi>{item.mediaType}</bdi>
                  {" · "}<bdi>{String(item.version)}</bdi>
                </p>
              </Show>
              <Show when={item.status === "revoked" ? undefined : item.reason}>
                {(reason) => <p class="mx-note" role="status">{msg(reason())}</p>}
              </Show>
            </div>
            <div class="sf-s04-actions">
              <Show when={canRequestDownload(item)}>
                <button type="button" class="mx-btn" onClick={() => {
                  if (!canRequestDownload(item)) return
                  props.onDownload({
                    attachmentRef: item.ref,
                    recordRef: props.recordRef,
                    recordVersion: props.recordVersion,
                  })
                }}>
                  {language.t("orchestra.sf.s04.attachments.download")}
                </button>
              </Show>
              <Show when={canRequestReferenceRemoval(item)}>
                <button type="button" class="mx-btn" disabled={removalRequested(item)} onClick={() => {
                  if (!canRequestReferenceRemoval(item) || removalRequested(item)) return
                  setRequests("removals", (current) => [...current, {
                    attachmentRef: item.ref,
                    attachmentVersion: item.version,
                    recordRef: props.recordRef,
                    recordVersion: props.recordVersion,
                  }])
                  props.onRemoveReference({
                    attachmentRef: item.ref,
                    recordRef: props.recordRef,
                    recordVersion: props.recordVersion,
                  })
                }}>
                  {language.t("orchestra.sf.s04.attachments.remove")}
                </button>
              </Show>
              <Show when={removalRequested(item)}>
                <p role="status" class="sf-s04-muted">
                  {language.t("orchestra.sf.s04.attachments.referenceRemovalPending")}
                </p>
              </Show>
            </div>
          </li>
        )}</For>
      </ul>
    </section>
  )
}
