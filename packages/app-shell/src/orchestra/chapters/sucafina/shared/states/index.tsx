import { For, Show, createUniqueId } from "solid-js"
import type { JSX } from "solid-js"
import {
  SfActionButton,
  SfCoverageView,
  SfMessageText,
  SfTextValue,
  sfCommonKey,
  useSfPresentation,
} from "../frame/presentation"
import type {
  SfMessage,
  SfRunPhase,
  SfRunStateProps,
  SfStatePanelProps,
  SfUiState,
} from "../frame/types"
import "./states.css"

export type { SfRunStateProps, SfStatePanelProps, SfRunPhase, SfUiState } from "../frame/types"

const PRIVATE_STATES: ReadonlySet<SfUiState> = new Set(["denied", "session-expired"])
const CONTENT_STATES: ReadonlySet<SfUiState> = new Set([
  "ready", "partial", "stale", "conflict", "empty", "filtered-empty",
])
const ALERT_STATES: ReadonlySet<SfUiState> = new Set([
  "invalid", "not-found", "conflict", "unavailable", "denied", "session-expired",
])
const RETRY_STATES: ReadonlySet<SfUiState> = new Set(["unavailable", "stale", "partial", "conflict"])
const BACK_STATES: ReadonlySet<SfUiState> = new Set(["denied", "not-found", "invalid"])

export function SfStatePanel(props: SfStatePanelProps): JSX.Element {
  const id = createUniqueId()
  const { t } = useSfPresentation()
  const privacy = () => PRIVATE_STATES.has(props.state)
  const loading = () => props.state === "loading"
  const showMessage = () => props.state !== "ready"
  const showContent = () => CONTENT_STATES.has(props.state) && !privacy()
  const statusRole = () => (ALERT_STATES.has(props.state) ? "alert" : "status") as "alert" | "status"
  return (
    <section
      class="sf-state-panel"
      data-sf-state={props.state}
      aria-busy={loading()}
      aria-labelledby={showMessage() ? `sf-state-${id}` : undefined}
    >
      <Show when={showMessage()}>
        <div class="sf-state-message" role={statusRole()} aria-atomic="true">
          <p id={`sf-state-${id}`} class="sf-state-title">{t(props.messageKey)}</p>
          <Show when={props.detailsKey && !privacy()}>
            {(key) => <p class="sf-state-details">{t(key())}</p>}
          </Show>
          <Show when={loading()}>
            <div class="sf-state-skeleton" aria-hidden="true">
              <span /><span /><span />
            </div>
          </Show>
          <Show when={privacy() || loading() ? undefined : props.coverage}>
            {(coverage) => <SfCoverageView coverage={coverage()} />}
          </Show>
          <div class="sf-state-actions">
            <Show when={props.onRetryRead && RETRY_STATES.has(props.state)}>
              <button type="button" class="mx-btn" onClick={() => props.onRetryRead?.()}>
                {t(sfCommonKey(props.state === "conflict" || props.state === "stale" ? "sf.common.currentSource" : "sf.common.retry"))}
              </button>
            </Show>
            <Show when={props.onRetryRead && props.state === "outcome-unknown"}>
              <button type="button" class="mx-btn" onClick={() => props.onRetryRead?.()}>
                {t(sfCommonKey("sf.common.pending"))}
              </button>
            </Show>
            <Show when={props.onLogin && props.state === "session-expired"}>
              <button type="button" class="mx-btn primary" onClick={() => props.onLogin?.()}>
                {t(sfCommonKey("sf.common.loginAgain"))}
              </button>
            </Show>
            <Show when={props.onBack && BACK_STATES.has(props.state)}>
              <button type="button" class="mx-btn" onClick={() => props.onBack?.()}>
                {t(sfCommonKey(props.state === "not-found" ? "sf.common.returnToList" : "sf.common.back"))}
              </button>
            </Show>
          </div>
        </div>
      </Show>
      <Show when={showContent()}>
        <div class="sf-state-content">{props.children}</div>
      </Show>
    </section>
  )
}

const RUN_LABELS: Readonly<Record<SfRunPhase, keyof typeof import("@/i18n/orchestra-chapters/sf-common").SF_COMMON_COPY>> = {
  unavailable: "sf.common.unavailable",
  ready: "sf.common.currentSource",
  queued: "sf.common.queued",
  running: "sf.common.running",
  "needs-input": "sf.common.needsInput",
  cancelling: "sf.common.cancelRequested",
  cancelled: "sf.common.cancelled",
  failed: "sf.common.failed",
  partial: "sf.common.partial",
  complete: "sf.common.completed",
  stale: "sf.common.stale",
}

function validPercent(value: { kind: "percent"; value: number; label: SfMessage } | { kind: "indeterminate"; label: SfMessage }): number | undefined {
  if (value.kind !== "percent" || !Number.isFinite(value.value) || value.value < 0 || value.value > 100) return undefined
  return value.value
}

export function SfRunState(props: SfRunStateProps): JSX.Element {
  const id = createUniqueId()
  const { t } = useSfPresentation()
  const active = () => props.state === "queued" || props.state === "running" || props.state === "cancelling"
  const allowResult = () => props.state === "complete" || props.state === "partial" || props.state === "stale"
  const progress = () => props.identity.kind === "run" ? props.progress : undefined
  const result = () => props.identity.kind === "run" && allowResult() ? props.result : undefined
  const task = () => props.identity.task

  return (
    <section class="sf-run-state" data-sf-run-state={props.state} data-sf-run-identity={props.identity.kind} aria-labelledby={`sf-run-${id}`}>
      <header class="sf-run-header">
        <Show when={task()}>{(current) => <h3 id={`sf-run-${id}`}><SfTextValue value={current().title} /></h3>}</Show>
        <Show when={!task()}><h3 id={`sf-run-${id}`}>{t(sfCommonKey(RUN_LABELS[props.state]))}</h3></Show>
        <span
          class="sf-run-phase"
          role={props.state === "failed" || props.state === "unavailable" ? "alert" : "status"}
          aria-live={active() ? "off" : "polite"}
        >{t(sfCommonKey(RUN_LABELS[props.state]))}</span>
      </header>
      <Show when={props.identity.kind === "run" ? props.modelSession : undefined}>
        {(session) => (
          <p class="sf-run-model">
            <SfTextValue value={session().modelLabel} />
          </p>
        )}
      </Show>
      <Show when={props.coverage}>
        {(coverage) => <SfCoverageView coverage={coverage()} />}
      </Show>
      <Show when={progress()}>
        {(current) => (
          <div class="sf-run-progress">
            <p><SfMessageText message={current().label} /></p>
            <Show when={current().kind === "indeterminate"}>
              <progress aria-label={t(sfCommonKey("sf.common.running"))} />
            </Show>
            <Show when={current().kind === "percent" && validPercent(current()) !== undefined}>
              <progress
                value={validPercent(current())}
                max={100}
                aria-label={t(sfCommonKey("sf.common.running"))}
              />
            </Show>
          </div>
        )}
      </Show>
      <Show when={result()}>
        {(current) => (
          <div class="sf-run-result">
            <p><SfTextValue value={current().summary} /></p>
            <dl class="sf-run-source">
              <div>
                <dt>{t(sfCommonKey("sf.common.source"))}</dt>
                <dd><SfTextValue value={current().source.label} /></dd>
              </div>
              <div>
                <dt>{t(sfCommonKey("sf.common.currentSource"))}</dt>
                <dd><SfTextValue value={current().source.scope} /></dd>
              </div>
            </dl>
            <SfCoverageView coverage={current().source.coverage} />
            <button
              type="button"
              class="mx-btn"
              onClick={() => props.onOpen(current().ref)}
            >
              {t(sfCommonKey("sf.common.openPage"))}
            </button>
          </div>
        )}
      </Show>
      <Show when={props.actions.length > 0}>
        <div class="sf-run-actions">
          <For each={props.actions}>
            {(action) => <SfActionButton action={action} variant={action.tone === "primary" ? "primary" : "secondary"} />}
          </For>
        </div>
      </Show>
    </section>
  )
}
