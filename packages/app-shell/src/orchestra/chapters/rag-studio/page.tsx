import { batch, createEffect, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import type { ChapterPageProps } from "@/orchestra/chapter-route"
import { MxPage } from "../kit"
import "./studio.css"
import { Files } from "./files"
import { Maintain } from "./maintain"
import { Question } from "./question"
import { retryReads, roster } from "./roster"

export default function RagStudioPage(props: ChapterPageProps) {
  const language = useLanguage()
  const [state, setState] = createStore({ retrying: false })
  let recovery: HTMLDivElement | undefined
  let studio: HTMLDivElement | undefined
  const failed = () => roster.status === "error" || roster.pipelineFailed
  const loading = () => roster.status === "loading" || (!roster.pipelineKnown && !roster.pipelineFailed)

  createEffect(() => {
    if (!state.retrying || loading()) return
    const restoreFocus = document.activeElement === document.body || recovery?.contains(document.activeElement)
    setState("retrying", false)
    if (!restoreFocus) return
    if (failed()) {
      recovery?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true })
      return
    }
    studio?.querySelector<HTMLElement>("[data-rag-files-heading]")?.focus({ preventScroll: true })
  })

  return (
    <MxPage
      id="rag-studio"
      eyebrow={language.t("orchestra.nav.ragStudio")}
      title={language.t("orchestra.ragStudio.title")}
      description={language.t("orchestra.ragStudio.description")}
    >
      <Show when={failed() || state.retrying}>
        <div ref={recovery} class="mx-empty rag-recovery" role={failed() ? "alert" : "status"} aria-busy={loading()}>
          <div class="rag-recovery-copy">
            <strong>{language.t(failed() ? "orchestra.ragStudio.error" : "orchestra.ragStudio.retrying")}</strong>
            <Show when={failed()}>
              <ul>
                <Show when={roster.status === "error"}><li>{language.t("orchestra.ragStudio.files")}</li></Show>
                <Show when={roster.pipelineFailed}><li>{language.t("orchestra.ragStudio.pipeline")}</li></Show>
              </ul>
            </Show>
          </div>
          <button
            class="mx-btn"
            type="button"
            disabled={loading()}
            onClick={() => batch(() => {
              retryReads()
              setState("retrying", true)
            })}
          >
            {language.t("orchestra.ragStudio.retry")}
          </button>
        </div>
      </Show>
      <div ref={studio} class="rag-studio">
        <Files server={props.server} directory={props.directory} />
        <Question server={props.server} directory={props.directory} />
        <Maintain server={props.server} directory={props.directory} />
      </div>
    </MxPage>
  )
}
