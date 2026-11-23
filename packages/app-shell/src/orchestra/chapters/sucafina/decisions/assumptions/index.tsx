import { A } from "@solidjs/router"
import { createMemo, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfCase } from "../cases/model"
import { sfDecisionHref } from "../cases/route"
import { sfDecisionCategoryKey } from "./presentation"
import { SfDecisionGaps } from "./gaps"
import "../cases/n24.css"
import "../intent/decision.css"
import "../../reviews/workflows.css"

const k = (value: string) => value as SfCopyKey

/** UI36: source-backed assumptions, missing categories and divergences. */
export function SfAssumptionsView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const route = () => props.surfaceId === "UI36" ? props.route as SfSurfaceProps<"UI36">["route"] : undefined
  const caseRef = () => route() ? String(route()!.params.caseRef) : ""
  const caseData = useSfCase(caseRef)
  const [ui, setUi] = createStore({ filter: "all" as "all" | "open" | "confirmed" | "rejected", selected: "" })
  const record = () => caseData.read.projection?.case
  const filtered = createMemo(() => (record()?.assumptions ?? []).filter((entry) =>
    ui.filter === "all" || entry.state === ui.filter,
  ))
  const selected = createMemo(() => record()?.assumptions.find((entry) => entry.id === ui.selected))
  const missing = createMemo(() =>
    [...new Set((record()?.alternatives ?? []).flatMap((item) =>
      item.result.costCoverage.derivedMissingCategoryIds,
    ))],
  )
  const divergences = createMemo(() =>
    [...new Set((caseData.read.projection?.events ?? []).flatMap((event) => event.factualGaps))],
  )
  const categoryText = (value: string) => {
    const label = sfDecisionCategoryKey(value)
    return label ? t(label) : value
  }
  const status = (): SfUiState => caseData.read.state === "ready" && filtered().length === 0
    ? (record()?.assumptions.length ? "filtered-empty" : "empty") : caseData.read.state

  return (
    <SfPageFrame
      titleKey={k("sf.ui36.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="split"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "review-assumption", labelKey: k("sf.ui36.primary"), tone: "primary",
        disabled: !selected(), busy: false, onInvoke: () => {
          document.getElementById("sf-n24-assumption-detail")?.focus()
        },
      }}
      secondaryActions={[{
        id: "refresh-assumptions", labelKey: k("sf.ui36.reload"), tone: "secondary",
        disabled: caseData.read.state === "loading", busy: false,
        onInvoke: () => caseData.reload(),
      }]}
    >
      <div class="sf-n24 sf-decision-page sf-decision-assumptions sf-workflow" data-sf-wave="four" data-sf-decision="UI36" data-sf-surface="UI36">
        <Show when={route()}>
          {(current) => <A class="mx-btn sf-decision-back" href={sfDecisionHref(current(), "case", caseRef())}>{t("sf.ui35.return")}</A>}
        </Show>
        <Show when={caseData.read.state === "ready" && record()} fallback={
          <SfStatePanel state={caseData.read.state}
            messageKey={k(caseData.read.state === "loading" ? "sf.ui36.reading" : "sf.ui36.unavailable")}
            onRetryRead={() => caseData.reload()} />
        }>
          <>
            <div class="sf-decision-assumptions-layout" classList={{ "has-selection": !!selected() }}>
            <section class="mx-card sf-n24-section" aria-labelledby="sf-n24-assumptions">
              <header class="sf-decision-section-heading"><h2 id="sf-n24-assumptions">{t("sf.ui36.record")}</h2>
              <div class="sf-n24-toolbar">
                <label class="sf-n24-field">
                  <span id="sf-n24-assumption-state-label">{t("sf.ui36.state")}</span>
                  <select aria-labelledby="sf-n24-assumption-state-label" value={ui.filter} onChange={(event) => setUi("filter", event.currentTarget.value as typeof ui.filter)}>
                    <option value="all">{t("sf.u14.all")}</option>
                    <option value="open">{t("sf.ui36.open")}</option>
                    <option value="confirmed">{t("sf.ui36.confirmed")}</option>
                    <option value="rejected">{t("sf.ui36.rejected")}</option>
                  </select>
                </label>
              </div></header>
              <Show when={filtered().length} fallback={
                <SfStatePanel state={status()} messageKey={k(status() === "filtered-empty" ? "sf.common.filterEmpty" : "sf.ui36.noItems")} />
              }>
                <ul class="sf-n24-record-list">
                  <For each={filtered()}>
                    {(item) => <li class="sf-n24-review">
                      <div class="sf-n24-record">
                        <span><bdi>{item.text}</bdi></span>
                        <span class="sf-n24-chip">{t(item.state === "open" ? "sf.ui36.open" : item.state === "confirmed" ? "sf.ui36.confirmed" : "sf.ui36.rejected")}</span>
                        <button type="button" class="mx-btn" aria-pressed={ui.selected === item.id}
                          onClick={() => { setUi("selected", item.id); document.getElementById("sf-n24-assumption-detail")?.focus() }}>{t("sf.ui36.primary")}</button>
                      </div>
                    </li>}
                  </For>
                </ul>
              </Show>
            </section>
            <Show when={selected()}>
              {(item) => <section id="sf-n24-assumption-detail" tabIndex={-1} class="mx-card sf-n24-section">
                <h2>{t("sf.ui36.primary")}</h2>
                <p><bdi>{item().text}</bdi></p>
                <p>{t("sf.ui36.state")}: {t(item().state === "open" ? "sf.ui36.open" : item().state === "confirmed" ? "sf.ui36.confirmed" : "sf.ui36.rejected")}</p>
                <details class="sf-decision-source-scope">
                  <summary>{t("sf.ui36.source")}</summary>
                  <ul class="sf-n24-list">
                    <For each={item().evidenceRefs}>{(source) =>
                      <li><bdi>{source.refId}</bdi> · <bdi>{source.evidenceLevel}</bdi></li>}
                    </For>
                  </ul>
                </details>
                <p role="status">{t("sf.ui36.noMutation")}</p>
              </section>}
            </Show>
            </div>
            <div class="mx-card sf-decision-gap-band">
              <section class="sf-n24-section" aria-labelledby="sf-n24-missing">
                <h2 id="sf-n24-missing">{t("sf.ui36.missing")}</h2>
                <Show when={missing().length} fallback={<p>{t("sf.ui36.noGaps")}</p>}>
                  <ul class="sf-n24-list"><For each={missing()}>{(issue) =>
                    <li><bdi>{categoryText(issue)}</bdi></li>}
                  </For></ul>
                  <Show when={missing().some((value) => sfDecisionCategoryKey(value))}>
                    <details class="sf-decision-source-scope">
                      <summary>{t("sf.ui36.sourceDetails")}</summary>
                      <ul class="sf-n24-list"><For each={missing()}>{(issue) => <li><bdi>{issue}</bdi></li>}</For></ul>
                    </details>
                  </Show>
                </Show>
              </section>
              <section class="sf-n24-section" aria-labelledby="sf-n24-divergences">
                <h2 id="sf-n24-divergences">{t("sf.ui36.divergences")}</h2>
                <Show when={divergences().length} fallback={<p>{t("sf.ui36.noDivergences")}</p>}>
                  <SfDecisionGaps values={divergences()} />
                </Show>
              </section>
            </div>
          </>
        </Show>
      </div>
    </SfPageFrame>
  )
}
