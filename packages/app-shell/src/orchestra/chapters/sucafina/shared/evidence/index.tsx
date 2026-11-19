// S04 evidence presentation only: producer owns authorization and source reopening.
import { createMemo, createUniqueId, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type {
  SfDisplayValue, SfEvidence, SfEvidencePanelProps, SfMessage, SfText,
} from "./types"
import { canInspectEvidence, canPresentEvidence } from "./guards"
import { SfStatePanel } from "../states"
import type { SfCopyKey, SfUiState } from "../frame/types"
import "./s04.css"

export type { SfEvidence, SfEvidencePanelProps } from "./types"

const labels = {
  candidate: "orchestra.sf.s04.evidence.candidate",
  confirmed: "orchestra.sf.s04.evidence.confirmed",
  stale: "orchestra.sf.s04.evidence.stale",
  unavailable: "orchestra.sf.s04.evidence.unavailable",
  revoked: "orchestra.sf.s04.evidence.revoked",
} as const

function evidenceWellKey(state: SfUiState): SfCopyKey {
  if (state === "loading") return "sf.common.loading" as SfCopyKey
  if (state === "empty") return "orchestra.sf.s04.evidence.empty" as SfCopyKey
  if (state === "filtered-empty") return "sf.common.filterEmpty" as SfCopyKey
  if (state === "denied") return "sf.common.noAccess" as SfCopyKey
  if (state === "session-expired") return "sf.common.loginAgain" as SfCopyKey
  if (state === "unavailable") return "sf.common.unavailable" as SfCopyKey
  if (state === "outcome-unknown") return "sf.common.operationUnknown" as SfCopyKey
  if (state === "invalid") return "sf.common.invalidLink" as SfCopyKey
  if (state === "not-found") return "sf.common.removed" as SfCopyKey
  if (state === "stale" || state === "conflict") return "sf.common.stale" as SfCopyKey
  return "orchestra.sf.s04.evidence.hidden" as SfCopyKey
}

// Source-provided SfMessage keys remain data from the frozen typed dictionary.
// Register the S04 leaf centrally through the integrator; never display a raw key.
export function SfEvidencePanel(props: SfEvidencePanelProps): JSX.Element {
  const language = useLanguage()
  const id = createUniqueId()
  const selected = createMemo(() =>
    props.selectedRef === undefined
      ? undefined
      : props.items.find((item) => item.ref === props.selectedRef),
  )
  const canInspect = (item: SfEvidence) => canInspectEvidence(props.state, item)
  const msg = (value: SfMessage) =>
    language.t(value.key as Parameters<typeof language.t>[0], value.params)
  const txt = (value: SfText): string =>
    value.kind === "data" ? value.text : msg(value.message)
  const displayNumber = (current: Extract<SfDisplayValue, { kind: "number" }>) => {
    const digits = Number.isInteger(current.fractionDigits)
      ? Math.max(0, Math.min(20, current.fractionDigits))
      : 0
    return new Intl.NumberFormat(language.intl(), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(current.value)
  }
  const value = (current: SfDisplayValue): JSX.Element => {
    switch (current.kind) {
      case "text": return txt(current.text)
      case "number":
        return <span>{displayNumber(current)}
          <Show when={current.unit.kind === "currency"}> <bdi>{current.unit.kind === "currency" ? current.unit.code : ""}</bdi></Show>
          <Show when={current.unit.kind === "percent"}> %</Show>
          <Show when={current.unit.kind === "quantity" || current.unit.kind === "unspecified"}>
            {" "}{current.unit.kind === "quantity" || current.unit.kind === "unspecified" ? msg(current.unit.label) : ""}
          </Show>
        </span>
      case "boolean": return msg(current.value ? current.trueLabel : current.falseLabel)
      case "date": return <time dateTime={current.isoDate}>{current.isoDate}</time>
      case "timestamp": return <time dateTime={current.isoTimestamp}>{current.isoTimestamp}</time>
      case "missing": return msg(current.reason)
      case "unavailable": return msg(current.reason)
      case "list":
        return <ul>{current.items.map((entry, index) =>
          <li data-index={index}>{value(entry)}</li>,
        )}</ul>
    }
  }
  const canOpen = canInspect

  return (
    <section class="sf-s04 mx-card" aria-labelledby={id + "-title"} aria-busy={props.state === "loading"}>
      <header class="sf-s04-head">
        <h2 id={id + "-title"}>{language.t("orchestra.sf.s04.evidence.title")}</h2>
        <button type="button" class="mx-btn" onClick={props.onClose}>
          {language.t("orchestra.sf.s04.evidence.close")}
        </button>
      </header>

      <Show when={!canPresentEvidence(props.state)}>
        <SfStatePanel state={props.state} messageKey={evidenceWellKey(props.state)} />
      </Show>

      <Show when={canPresentEvidence(props.state)}>
        <Show when={props.state === "partial"}>
          <p role="status">{language.t("sf.common.partial")}</p>
        </Show>

        <Show when={props.items.length === 0}>
          <SfStatePanel
            state={props.state === "filtered-empty" ? "filtered-empty" : "empty"}
            messageKey={props.state === "filtered-empty"
              ? "sf.common.filterEmpty" as SfCopyKey
              : "orchestra.sf.s04.evidence.empty" as SfCopyKey}
          />
        </Show>

        <Show when={props.items.length > 0}>
          <div class="sf-s04-layout">
            <ul class="sf-s04-list" aria-label={language.t("orchestra.sf.s04.evidence.title")}>
              <For each={props.items}>{(item) => (
                <li class="sf-s04-row">
                  <button type="button" class="mx-btn"
                    aria-pressed={props.selectedRef === item.ref}
                    disabled={!canInspect(item)}
                    onClick={() => { if (canInspect(item)) props.onSelect(item.ref) }}>
                    <span class="sf-s04-file-name">
                      {canInspect(item) ? txt(item.title) : language.t(labels[item.state])}
                    </span>
                    <span class="sf-s04-muted sf-s04-status">
                      {" — "}{language.t(labels[item.state])}
                    </span>
                  </button>
                </li>
              )}</For>
            </ul>

            <div class="sf-s04-detail">
              <Show when={selected()} fallback={
                <p role="status" class="mx-note">{language.t("orchestra.sf.s04.evidence.noSelection")}</p>
              }>
                {(entry) => (
                  <Show when={canInspect(entry())} fallback={
                    <p role="status" class="mx-note">
                      {language.t(labels[entry().state])}
                    </p>
                  }>
                    <article aria-label={txt(entry().title)} class="sf-s04-row">
                      <h3>{txt(entry().title)}</h3>
                      <p class="sf-s04-muted" role="status">
                        {language.t(labels[entry().state])}
                      </p>
                      <p>{txt(entry().source.label)}</p>
                      <p>
                        <strong>{language.t("orchestra.sf.s04.evidence.scope")}: </strong>
                        {txt(entry().source.scope)}
                      </p>
                      <p>
                        <strong>{language.t("orchestra.sf.s04.evidence.version")}: </strong>
                        <bdi>{String(entry().source.version)}</bdi>
                      </p>
                      <p role="status">
                        {msg(entry().source.coverage.summary)}
                      </p>
                      <Show when={entry().source.coverage.reasons.length > 0}>
                        <ul>
                          <For each={entry().source.coverage.reasons}>
                            {(reason) => <li>{msg(reason)}</li>}
                          </For>
                        </ul>
                      </Show>

                      <Show when={entry().excerpt !== null} fallback={
                        <p class="mx-note">{language.t("orchestra.sf.s04.evidence.noExcerpt")}</p>
                      }>
                        <blockquote class="sf-s04-excerpt">{entry().excerpt}</blockquote>
                      </Show>

                      <h3>{language.t("orchestra.sf.s04.evidence.fields")}</h3>
                      <Show when={entry().fields.length === 0}>
                        <p class="mx-note">{language.t("orchestra.sf.s04.evidence.noFields")}</p>
                      </Show>
                      <dl>
                        <For each={entry().fields}>{(field) => (
                          <>
                            <dt>{msg(field.label)}</dt>
                            <dd>{value(field.value)}</dd>
                          </>
                        )}</For>
                      </dl>
                      <Show when={entry().reason}>
                        {(reason) => <p role="status" class="mx-note">{msg(reason())}</p>}
                      </Show>
                      <button type="button" class="mx-btn"
                        disabled={!canOpen(entry())}
                        onClick={() => {
                          if (canOpen(entry())) props.onOpenAuthorizedSource(entry().source.ref)
                        }}>
                        {language.t("orchestra.sf.s04.evidence.source")}
                      </button>
                    </article>
                  </Show>
                )}
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </section>
  )
}
