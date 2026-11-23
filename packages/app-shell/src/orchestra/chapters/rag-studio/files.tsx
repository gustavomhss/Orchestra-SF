import { createEffect, For, on, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import type { ChapterPageProps } from "@/orchestra/chapter-route"
import { MxBadge } from "../kit"
import { roster, setRoster, statusKey, statusTone } from "./roster"
import { pathDir, pathName, SourceText } from "./source-text"

export function Files(props: ChapterPageProps) {
  const language = useLanguage()
  const sdk = useSDK()
  const [state, setState] = createStore({
    path: "",
    busy: false,
    refusal: "" as "" | "atlas" | "permission",
    openError: false,
    openPath: "",
    text: "",
    cuts: [] as Array<{ start: number; end: number }>,
  })
  const location = () => ({ directory: props.directory })

  let disposed = false
  let sourceRead = 0
  let detailRead = 0
  const openSource = (sourceId: string) => {
    if (disposed) return Promise.resolve()
    const directory = props.directory
    const started = ++detailRead
    return sdk()
      .orchestra.ragStudio.source({ location: { directory }, sourceId })
      .then((result) => {
        if (disposed || started !== detailRead || props.directory !== directory) return
        setRoster("openId", result.data.source.id)
        setState({
          openError: false,
          openPath: result.data.source.path,
          text: result.data.text,
          cuts: result.data.chunks.map((chunk) => ({ start: chunk.start, end: chunk.end })),
        })
      })
      .catch((error: unknown) => {
        if (disposed || started !== detailRead || props.directory !== directory) return
        console.error(error)
        setState({ openError: true })
      })
  }

  const load = (quiet: boolean) => {
    if (disposed) return Promise.resolve()
    const directory = props.directory
    const started = ++sourceRead
    if (!quiet) setRoster("status", "loading")
    return sdk()
      .orchestra.ragStudio.sources({ location: { directory } })
      .then((result) => {
        if (disposed || started !== sourceRead || props.directory !== directory) return
        setRoster({
          status: "ready",
          sources: result.data.map((row) => ({ id: row.id, path: row.path, status: row.status })),
        })
        if (quiet && roster.openId) void openSource(roster.openId)
      })
      .catch((error: unknown) => {
        if (disposed || started !== sourceRead || props.directory !== directory) return
        console.error(error)
        setRoster({ status: "error", sources: [] })
      })
  }

  createEffect(on(() => props.directory, () => {
    detailRead += 1
    setState({ path: "", refusal: "", openError: false, openPath: "", text: "", cuts: [] })
    setRoster("openId", "")
    void load(false)
  }))

  createEffect(on(() => roster.sourceRetry, () => void load(false), { defer: true }))
  createEffect(on(() => roster.revision, () => void load(true), { defer: true }))
  onCleanup(() => { disposed = true; sourceRead += 1; detailRead += 1 })

  return (
    <section>
      <h3 class="mx-section" data-rag-files-heading tabindex="-1">{language.t("orchestra.ragStudio.files")}</h3>
      <form
        class="rag-form"
        onSubmit={(event) => {
          event.preventDefault()
          const path = state.path.trim()
          if (!path || state.busy) return
          setState({ busy: true, refusal: "", openError: false })
          void sdk()
            .orchestra.ragStudio.admit({ location: location(), path })
            .then(async (result) => {
              if ("refused" in result.data) {
                setState({ busy: false, refusal: result.data.refused })
                return
              }
              await sdk().orchestra.ragStudio.parse({ location: location(), sourceId: result.data.id })
              setState({ path: "", busy: false, refusal: "" })
              await openSource(result.data.id)
              await load(true)
            })
            .catch(() => {
              setState({ busy: false, openError: true })
              return load(true)
            })
        }}
      >
        <label class="mx-field">
          <span>{language.t("orchestra.ragStudio.path")}</span>
          <input
            value={state.path}
            spellcheck={false}
            autocomplete="off"
            onInput={(event) => setState({ path: event.currentTarget.value })}
          />
        </label>
        <button class="mx-btn" type="submit" disabled={state.busy || !state.path.trim()}>
          {language.t("orchestra.ragStudio.admit")}
        </button>
      </form>
      <Show when={state.refusal === "atlas"}>
        <p class="mx-error" role="alert">
          {language.t("orchestra.ragStudio.refused.atlas")}
        </p>
      </Show>
      <Show when={state.refusal === "permission"}>
        <p class="mx-error" role="alert">
          {language.t("orchestra.ragStudio.refused.permission")}
        </p>
      </Show>
      <Show when={state.openError}>
        <p class="mx-error" role="alert">
          {language.t("orchestra.ragStudio.actionError")}
        </p>
      </Show>
      <Show when={roster.status === "loading"}>
        <div class="mx-empty" role="status">
          {language.t("orchestra.ragStudio.loading")}
        </div>
      </Show>
      <Show when={roster.status === "ready" && roster.sources.length === 0}>
        <div class="mx-empty">
          <strong>{language.t("orchestra.ragStudio.empty")}</strong>
        </div>
      </Show>
      <Show when={roster.status === "ready" && roster.sources.length > 0}>
        <div class="mx-table">
          <For each={roster.sources}>
            {(source) => (
              <div class="mx-row" data-selected={roster.openId === source.id ? "true" : undefined}>
                <div class="mx-grow">
                  <strong>
                    <bdi>{pathName(source.path)}</bdi>
                  </strong>
                  <Show when={pathDir(source.path)}>
                    {(dir) => (
                      <small dir="ltr">
                        <bdi>{dir()}</bdi>
                      </small>
                    )}
                  </Show>
                </div>
                <MxBadge tone={statusTone(source.status)}>{language.t(statusKey(source.status))}</MxBadge>
                <button
                  class="mx-btn"
                  type="button"
                  aria-pressed={roster.openId === source.id}
                  onClick={() => void openSource(source.id)}
                >
                  {language.t("orchestra.ragStudio.showCut")}
                </button>
                <button
                  class="mx-btn danger"
                  type="button"
                  onClick={() => {
                    void sdk()
                      .orchestra.ragStudio.remove({ location: location(), sourceId: source.id })
                      .then(() => {
                        if (roster.openId === source.id) {
                          setRoster("openId", "")
                          setState({ openPath: "", text: "", cuts: [] })
                        }
                        return load(true)
                      })
                      .catch(() => setState({ openError: true }))
                  }}
                >
                  {language.t("orchestra.ragStudio.remove")}
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={state.openPath}>
        <div class="rag-follow">
          <Show when={state.cuts.length > 0}>
            <p class="mx-note">{language.t("orchestra.ragStudio.cuts")}</p>
          </Show>
          <p class="mx-note rag-path" dir="ltr">
            <bdi>{state.openPath}</bdi>
          </p>
          <Show when={state.text} fallback={<div class="mx-empty" role="status">{language.t("orchestra.ragStudio.notRecorded")}</div>}>
            <SourceText text={state.text} cuts={state.cuts} />
          </Show>
        </div>
      </Show>
    </section>
  )
}
