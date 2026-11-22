import { A } from "@solidjs/router"
import { Icon } from "@orchestra/ui/icon"
import { createMemo, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfCreateCase } from "./create"
import { useSfCases, sfOperationReady } from "./model"
import { sfDecisionHref } from "./route"
import "./n24.css"
import "./cases.css"
import "../../shared/wave-one.css"
import "../../reviews/workflows.css"

const key = (value: string) => value as SfCopyKey

/** UI33: authorized, owner-fenced case list, explicit filter and creation. */
export function SfCasesView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const cases = useSfCases()
  const initiallyCreating = props.surfaceId === "UI33" && props.route.kind === "new"
  const [ui, setUi] = createStore({ filter: "", create: initiallyCreating, createMounted: initiallyCreating })
  let listHeading: HTMLHeadingElement | undefined
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
      eyebrow={{ kind: "message", message: { key: key("sf.design.eyebrow") } }}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
      primaryAction={ui.create ? undefined : {
        id: "new-case", labelKey: key(ui.createMounted ? "sf.ui33.resumeDraft" : "sf.ui33.primary"), tone: "primary",
        disabled: !isPage() || !canCreate(), busy: false,
        onInvoke: () => setUi({ create: true, createMounted: true }),
      }}
      secondaryActions={[]}
    >
      <div class="sf-n24 sf-cases sf-workflow" data-sf-wave="cases" data-sf-creating={ui.create ? "true" : "false"}>
        <Show when={isPage()} fallback={<SfStatePanel state="invalid" messageKey={key("sf.ui33.unavailable")} />}>
          <Show when={ui.createMounted && route()}>
            {(activeRoute) =>
              <div class="sf-cases-create-slot" hidden={!ui.create}>
                <SfCreateCase
                  route={activeRoute()}
                  open={ui.create}
                  context={() => cases.owner.ready()?.context}
                  transport={() => cases.owner.ready()?.transport}
                  onCreated={() => cases.reload()}
                  onClose={(confirmed) => {
                    setUi("create", false)
                    if (confirmed) setUi("createMounted", false)
                    queueMicrotask(() => listHeading?.focus())
                  }}
                />
              </div>}
          </Show>
          <section class="sf-cases-list" hidden={ui.create} aria-label={t("sf.ui33.caseList")}>
            <div class="sf-cases-list-head">
              <div class="sf-cases-list-title">
                <h2 ref={listHeading} tabindex="-1">{t("sf.ui33.workspaceTitle")}</h2>
                <Show when={cases.read.state === "ready"}>
                  <span class="sf-cases-count">{visible().length}</span>
                </Show>
              </div>
              <div class="sf-cases-tools">
                <label class="sf-cases-search">
                  <span class="sf-cases-sr-only">{t("sf.ui33.filter")}</span>
                  <span class="sf-cases-search-control">
                    <Icon name="magnifying-glass" size="small" />
                    <input type="search" value={ui.filter}
                      placeholder={t("sf.ui33.filterPlaceholder")}
                      onInput={(event) => setUi("filter", event.currentTarget.value)} />
                  </span>
                </label>
                <Show when={ui.filter}>
                  <button class="mx-btn sf-cases-icon-button" type="button"
                    aria-label={t("sf.ui33.clear")} title={t("sf.ui33.clear")}
                    onClick={() => setUi("filter", "")}>
                    <Icon name="close-small" size="small" />
                  </button>
                </Show>
                <button class="mx-btn sf-cases-refresh" type="button"
                  data-sf-action="refresh-case-list"
                  aria-label={t("sf.ui33.check")} title={t("sf.ui33.check")}
                  disabled={cases.read.state === "loading"} onClick={() => cases.reload()}>
                  {t("sf.ui33.check")}
                </button>
              </div>
            </div>
            <Show when={state() === "ready"}>
              <ul class="sf-n24-record-list sf-cases-records">
                <For each={visible()}>
                  {(entry) =>
                    <li class="sf-cases-row">
                      <span class="sf-cases-record-mark" aria-hidden="true"><Icon name="checklist" /></span>
                      <div class="sf-cases-record-main">
                        <strong><bdi>{entry.title}</bdi></strong>
                        <div class="sf-cases-record-meta">
                          <span class="sf-cases-version">{t("sf.ui33.caseVersion")}: <bdi>{entry.version}</bdi></span>
                          <details class="sf-cases-reference">
                            <summary>
                              {t("sf.ui33.reference")}
                              <Icon name="chevron-down" size="small" />
                            </summary>
                            <code><bdi>{entry.caseRef}</bdi></code>
                          </details>
                        </div>
                      </div>
                      <Show when={route()}>
                        {(activeRoute) =>
                          <A class="mx-btn sf-cases-open" href={sfDecisionHref(activeRoute(), "case", entry.caseRef)}>
                            {t("sf.ui33.caseOpen")}
                            <Icon name="arrow-right" size="small" />
                          </A>}
                      </Show>
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
