import { createEffect, For, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import type { ChapterPageProps } from "@/orchestra/chapter-route"
import { MxBadge } from "../kit"
import { roster, setRoster, statusKey, statusTone, type SourceStatus } from "./roster"

import { SourceText } from "./source-text"

const lights = ["not_in_corpus", "search_miss", "dropped_before_model", "sent"] as const

function fileStatus(status: "" | SourceStatus) {
  if (!status) return undefined
  return status
}

function lightKey(light: (typeof lights)[number]) {
  if (light === "not_in_corpus") return "orchestra.ragStudio.light.not_in_corpus" as const
  if (light === "search_miss") return "orchestra.ragStudio.light.search_miss" as const
  if (light === "dropped_before_model") return "orchestra.ragStudio.light.dropped_before_model" as const
  return "orchestra.ragStudio.light.sent" as const
}

export function Question(props: ChapterPageProps) {
  const language = useLanguage()
  const sdk = useSDK()
  const [state, setState] = createStore({
    text: "",
    askedText: "",
    revisionId: "",
    busy: false,
    asked: false,
    light: null as (typeof lights)[number] | null,
    status: "" as "" | SourceStatus,
    optional: false,
    span: null as { sourceId: string; start: number; end: number } | null,
    sourcePath: "",
    source: "",
    dropped: [] as string[],
    prompt: "",
    sense: "off" as "off" | "missing" | "fused",
    saved: false,
    error: false,
  })
  const location = () => ({ directory: props.directory })

  createEffect(() => {
    props.directory
    setRoster("embeddingModel", "")
    void sdk()
      .orchestra.ragStudio.pipeline({ location: location() })
      .then((result) => setRoster("embeddingModel", result.data.embeddingModel))
      .catch(() => undefined)
  })

  return (
    <section>
      <div class="rag-section-head">
        <h3 class="mx-section">{language.t("orchestra.ragStudio.question")}</h3>
        <Show
          when={roster.embeddingModel}
          fallback={<MxBadge>{language.t("orchestra.ragStudio.embeddingOff")}</MxBadge>}
        >
          {(model) => <MxBadge>{language.t("orchestra.ragStudio.embeddingNamed", { model: model() })}</MxBadge>}
        </Show>
      </div>
      <ol class="rag-lights">
        <For each={lights}>
          {(light) => (
            <li
              data-on={state.light === light ? "true" : "false"}
              aria-current={state.light === light ? "true" : undefined}
            >
              <span class="rag-light-mark" aria-hidden="true" />
              <span class="rag-light-name">{language.t(lightKey(light))}</span>
            </li>
          )}
        </For>
      </ol>
      <form
        class="rag-form"
        onSubmit={(event) => {
          event.preventDefault()
          const text = state.text.trim()
          if (!text || state.busy) return
          setState({ busy: true, saved: false, error: false })
          void sdk()
            .orchestra.ragStudio.revision({ location: location() })
            .then((opened) => sdk().orchestra.ragStudio.ask({ location: location(), revisionId: opened.data.id, text }))
            .then(async (result) => {
              const span = result.data.span
              const opened = span
                ? await sdk()
                    .orchestra.ragStudio.source({ location: location(), sourceId: span.sourceId })
                    .catch(() => undefined)
                : undefined
              const chunks = opened?.data.chunks ?? []
              setState({
                busy: false,
                asked: true,
                askedText: text,
                revisionId: result.data.revisionId,
                light: result.data.light,
                status: result.data.fileStatus ?? "",
                optional: result.data.retrievalOptional,
                span,
                sourcePath: opened?.data.source.path ?? "",
                source: opened?.data.text ?? "",
                dropped: result.data.dropped.map((id) => chunks.find((chunk) => chunk.id === id)?.text ?? ""),
                prompt: result.data.promptText,
                sense: result.data.sense,
                error: false,
              })
            })
            .catch(() => setState({ busy: false, error: true }))
        }}
      >
        <label class="mx-field">
          <span>{language.t("orchestra.ragStudio.questionText")}</span>
          <input
            value={state.text}
            autocomplete="off"
            onInput={(event) => setState({ text: event.currentTarget.value })}
          />
        </label>
        <button class="mx-btn primary" type="submit" disabled={state.busy || !state.text.trim()}>
          {language.t("orchestra.ragStudio.ask")}
        </button>
      </form>
      <Show when={state.asked && state.sense === "missing"}>
        <p class="mx-note">{language.t("orchestra.ragStudio.sense.missing")}</p>
      </Show>
      <Show when={state.sense === "fused"}>
        <p class="mx-note">{language.t("orchestra.ragStudio.sense.fused")}</p>
      </Show>
      <Show when={state.light === "sent"}>
        <p class="mx-note">{language.t("orchestra.ragStudio.sentNote")}</p>
      </Show>
      <Show when={state.optional}>
        <p class="mx-note">{language.t("orchestra.ragStudio.retrieval")}</p>
      </Show>
      <Show when={state.asked}>
        <div class="rag-follow">
          <Switch>
            <Match when={state.sourcePath && state.source}>
              <div class="rag-open-head">
                <p class="mx-note rag-path" dir="ltr">
                  <bdi>{state.sourcePath}</bdi>
                </p>
                <Show when={fileStatus(state.status)}>
                  {(status) => <MxBadge tone={statusTone(status())}>{language.t(statusKey(status()))}</MxBadge>}
                </Show>
              </div>
              <SourceText text={state.source} cuts={state.span ? [state.span] : []} />
            </Match>
            <Match when={true}>
              <Show when={fileStatus(state.status)}>
                {(status) => (
                  <div class="rag-open-head">
                    <MxBadge tone={statusTone(status())}>{language.t(statusKey(status()))}</MxBadge>
                  </div>
                )}
              </Show>
              <div class="mx-empty" role="status">
                {language.t("orchestra.ragStudio.notRecorded")}
              </div>
            </Match>
          </Switch>
        </div>
      </Show>
      <Show when={state.span}>
        <div class="rag-actions">
          <button
            class="mx-btn"
            type="button"
            disabled={state.busy}
            onClick={() => {
              const span = state.span
              if (!span || state.busy) return
              setState({ busy: true, error: false })
              void sdk()
                .orchestra.ragStudio.question({
                  location: location(),
                  revisionId: state.revisionId,
                  text: state.askedText,
                  span,
                })
                .then(() => {
                  setState({ busy: false, saved: true, error: false })
                })
                .catch(() => setState({ busy: false, error: true }))
            }}
          >
            {language.t("orchestra.ragStudio.save")}
          </button>
        </div>
      </Show>
      <Show when={state.saved}>
        <p class="mx-note" role="status">
          {language.t("orchestra.ragStudio.saved")}
        </p>
      </Show>
      <Show when={state.error}>
        <p class="mx-error" role="alert">
          {language.t("orchestra.ragStudio.actionError")}
        </p>
      </Show>
      <Show when={state.dropped.length > 0}>
        <div class="rag-follow">
          <p class="mx-note">{language.t("orchestra.ragStudio.leftOut")}</p>
          <div class="mx-table">
            <For each={state.dropped}>
              {(text) => (
                <div class="mx-row">
                  <div class="mx-grow">
                    <span class="rag-passage">{text || language.t("orchestra.ragStudio.notRecorded")}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={state.prompt}>
        <div class="rag-follow">
          <p class="mx-note">{language.t("orchestra.ragStudio.prompt")}</p>
          <pre class="mx-log rag-source" dir="ltr" tabindex="0">
            {state.prompt}
          </pre>
        </div>
      </Show>
    </section>
  )
}
