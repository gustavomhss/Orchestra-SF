import { A } from "@solidjs/router"
import { createEffect, createMemo, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfCreateCase, sfUi33DraftSelection, type SfUi33DraftFields } from "./create"
import { useSfContext } from "../../context"
import { useSfCases, sfOperationReady } from "./model"
import { sfDecisionHref } from "./route"
import "./n24.css"

const key = (value: string) => value as SfCopyKey

/** UI33: authorized, owner-fenced case list, explicit filter and creation. */
export function SfCasesView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const cases = useSfCases()
  const owner = useSfContext()
  const [ui, setUi] = createStore({ filter: "", create: props.surfaceId === "UI33" && props.route.kind === "new" })
  createEffect(() => {
    const active = owner.ready()?.drafts.peek<SfUi33DraftFields>(sfUi33DraftSelection)?.snapshot()
    if (active?.availability === "active" && active.dirty) setUi("create", true)
  })
  const isPage = () => props.surfaceId === "UI33"
  const route = () => isPage() ? props.route as SfSurfaceProps<"UI33">["route"] : undefined
  const visible = createMemo(() => {
    const text = ui.filter.trim().toLocaleLowerCase()
    return cases.read.cases.filter((entry) =>
      !text || entry.title.toLocaleLowerCase().includes(text) || entry.caseRef.toLocaleLowerCase().includes(text),
    )
  })
  const state = (): SfUiState =>
    cases.read.state === "ready" && visible().length === 0 ? "filtered-empty" : cases.read.state
  const canCreate = () => {
    const context = cases.owner.ready()?.context
    return !!context && sfOperationReady(context, "decisions.command.sf_case_draft")
  }

  return (
    <SfPageFrame
      titleKey={key("sf.ui33.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "new-case", labelKey: key("sf.ui33.primary"), tone: "primary",
        disabled: !isPage() || !canCreate(), busy: false,
        onInvoke: () => setUi("create", true),
      }}
      secondaryActions={[{
        id: "refresh-case-list", labelKey: key("sf.ui33.check"), tone: "secondary",
        disabled: cases.read.state === "loading", busy: false,
        onInvoke: () => cases.reload(),
      }]}
    >
      <div class="sf-n24">
        <Show when={isPage()} fallback={<SfStatePanel state="invalid" messageKey={key("sf.ui33.unavailable")} />}>
          <Show when={ui.create && route()}>
            {(activeRoute) =>
              <SfCreateCase
                route={activeRoute()}
                context={() => cases.owner.ready()?.context}
                transport={() => cases.owner.ready()?.transport}
                onCreated={() => cases.reload()}
              />}
          </Show>
          <section aria-label={t("sf.ui33.caseList")}>
            <div class="sf-n24-toolbar">
              <label class="sf-n24-field">
                <span>{t("sf.ui33.filter")}</span>
                <input type="search" value={ui.filter}
                  placeholder={t("sf.ui33.filterPlaceholder")}
                  onInput={(event) => setUi("filter", event.currentTarget.value)} />
              </label>
              <Show when={ui.filter}>
                <button class="mx-btn" type="button" onClick={() => setUi("filter", "")}>{t("sf.ui33.clear")}</button>
              </Show>
            </div>
            <Show when={state() === "ready"}>
              <ul class="sf-n24-record-list">
                <For each={visible()}>
                  {(entry) =>
                    <li class="mx-card">
                      <div class="sf-n24-record">
                        <div class="sf-n24-record-main">
                          <strong><bdi>{entry.title}</bdi></strong>
                          <small><bdi>{entry.caseRef}</bdi></small>
                        </div>
                        <span>{t("sf.ui33.caseVersion")}: {entry.version}</span>
                        <Show when={route()}>
                          {(activeRoute) =>
                            <A class="mx-btn" href={sfDecisionHref(activeRoute(), "case", entry.caseRef)}>
                              {t("sf.ui33.caseOpen")}
                            </A>}
                        </Show>
                      </div>
                    </li>}
                </For>
              </ul>
            </Show>
            <Show when={state() !== "ready"}>
              <SfStatePanel
                state={state()}
                messageKey={key(state() === "empty" ? "sf.ui33.missing" :
                  state() === "filtered-empty" ? "sf.ui33.filtered" :
                  state() === "loading" ? "sf.ui33.reading" : "sf.ui33.unavailable")}
                onRetryRead={() => cases.reload()}
              />
            </Show>
          </section>
        </Show>
      </div>
    </SfPageFrame>
  )
}
