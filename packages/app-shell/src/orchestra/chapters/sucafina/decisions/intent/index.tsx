import { A } from "@solidjs/router"
import { For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SfPageFrame, type SfCopyKey } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfCase, sfOperationReady } from "../cases/model"
import { SfCaseSourcesEditor } from "./sources"
import { sfDecisionHref } from "../cases/route"
import "../cases/n24.css"
import "./decision.css"
import "../../reviews/workflows.css"

const k = (value: string) => value as SfCopyKey

/** UI34: source-backed intent and original, case-CAS source attachment. */
export function SfIntentView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string, params?: Record<string, string | number>) => language.t(value as Parameters<typeof language.t>[0], params)
  const [ui, setUi] = createStore({ reviewing: false, editing: false, editorMounted: false })
  const valid = () => props.surfaceId === "UI34"
  const source = () => {
    if (props.surfaceId !== "UI34") return undefined
    return props.route.params.caseRef
  }
  const caseData = useSfCase(() => String(source() ?? ""))
  const data = () => caseData.read.projection?.case
  const route = () => valid() ? props.route as SfSurfaceProps<"UI34">["route"] : undefined
  const gaps = () => [...new Set(caseData.read.projection?.events.flatMap((event) => event.factualGaps) ?? [])]
  const back = () => route() ? sfDecisionHref(route()!, "list") : undefined
  return (
    <SfPageFrame
      titleKey={k("sf.ui34.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "review-intent", labelKey: k("sf.ui34.primary"), tone: "primary",
        disabled: !data(), busy: false, onInvoke: () => setUi("reviewing", !ui.reviewing),
      }}
      secondaryActions={[{
        id: "refresh-intent", labelKey: k("sf.ui34.reload"), tone: "secondary",
        disabled: caseData.read.state === "loading", busy: false, onInvoke: () => { setUi("editing", false); caseData.reload() },
      }, {
        id: "edit-case-sources", labelKey: k("sf.ui34.edit"), tone: "secondary",
        disabled: !data() || !caseData.owner.ready() || !sfOperationReady(caseData.owner.ready()!.context, "decisions.decision-edit"),
        busy: false, onInvoke: () => setUi({ editing: true, editorMounted: true }),
      }]}
    >
      <div class="sf-n24 sf-decision-page sf-decision-intent sf-workflow" data-sf-wave="four" data-sf-decision="UI34" data-sf-surface="UI34" data-sf-case-ref={source()} data-sf-case-version={data()?.version}>
        <Show when={route() && back()}>
          <A class="mx-btn sf-decision-back" href={back()!}>{t("sf.ui33.return")}</A>
        </Show>
        <Show when={caseData.read.state === "ready" && data()} fallback={
          <SfStatePanel
            state={caseData.read.state}
            messageKey={k(caseData.read.state === "not-found" ? "sf.ui34.notFound" : "sf.ui34.unavailable")}
            onRetryRead={() => caseData.reload()}
          />
        }>
          {(record) => <>
            <Show when={ui.editorMounted && caseData.read.projection}>{(projection) =>
              <div class="sf-decision-editor" hidden={!ui.editing}>
                <SfCaseSourcesEditor projection={projection()}
                  onClose={() => setUi("editing", false)}
                  onSaved={() => { setUi({ editing: false, editorMounted: false }); caseData.reload() }} />
              </div>
            }</Show>
            <div class="sf-decision-reading" hidden={ui.editing}>
              <section class="mx-card sf-decision-brief" aria-labelledby="sf-case-question">
                <div class="sf-decision-objective">
                  <h2 id="sf-case-question">{t("sf.ui34.question")}</h2>
                  <p><bdi>{record().objective}</bdi></p>
                </div>
                <dl class="sf-decision-context">
                  <div><dt>{t("sf.ui34.period")}</dt><dd><time>{record().horizon.start}</time> – <time>{record().horizon.end}</time></dd></div>
                  <div><dt>{t("sf.ui33.currency")}</dt><dd><bdi>{record().currency}</bdi></dd></div>
                  <div><dt>{t("sf.ui34.state")}</dt><dd><bdi>{record().state}</bdi></dd></div>
                  <div><dt>{t("sf.ui34.current")}</dt><dd>{record().version}</dd></div>
                </dl>
                <p class="sf-decision-note">{t("sf.ui34.readonly")}</p>
              </section>
              <section class="mx-card sf-decision-summary" aria-labelledby="sf-case-criteria">
                <div class="sf-decision-criteria">
                  <h2 id="sf-case-criteria">{t("sf.ui34.criteria")}</h2>
                  <Show when={record().criteria.length} fallback={<p class="sf-decision-note">{t("sf.ui34.noCriteria")}</p>}>
                    <ol class="sf-decision-criteria-list">
                      <For each={record().criteria}>{(item) =>
                        <li><span><bdi>{item.description}</bdi></span><span class="sf-decision-state">{t(item.required ? "sf.ui34.required" : "sf.ui34.optional")}</span></li>
                      }</For>
                    </ol>
                  </Show>
                </div>
                <aside class="sf-decision-constraints" aria-labelledby="sf-case-constraints">
                  <h2 id="sf-case-constraints">{t("sf.ui34.constraints")}</h2>
                  <Show when={gaps().length} fallback={<p class="sf-decision-note">{t("sf.ui34.noConstraints")}</p>}>
                    <ul class="sf-n24-list"><For each={gaps()}>{(gap) => <li><bdi>{gap}</bdi></li>}</For></ul>
                  </Show>
                </aside>
              </section>
              <section class="mx-card sf-n24-section sf-decision-evidence" aria-labelledby="sf-case-sources">
                <header class="sf-decision-section-heading">
                  <h2 id="sf-case-sources">{t("sf.ui34.sources")}</h2>
                  <p class="sf-decision-note">{t("sf.ui34.sourceCounts", { sources: record().sourceRefs.length, receipts: record().receipts.length })}</p>
                </header>
                <Show when={record().sourceRefs.length} fallback={<p class="sf-decision-note">{t("sf.ui34.noSources")}</p>}>
                  <details>
                    <summary>{t("sf.ui34.sources")}</summary>
                    <ul class="sf-n24-list"><For each={record().sourceRefs}>{(item) =>
                      <li><bdi>{item.refId}</bdi><span class="sf-decision-state">{item.evidenceLevel}</span></li>
                    }</For></ul>
                  </details>
                </Show>
                <details>
                  <summary>{t("sf.ui34.participants")}</summary>
                  <Show when={record().participants.length} fallback={<p class="sf-decision-note">{t("sf.ui34.noParticipants")}</p>}>
                    <ul class="sf-n24-list"><For each={record().participants}>{(person) => <li><bdi>{person}</bdi></li>}</For></ul>
                  </Show>
                </details>
                <Show when={!record().alternatives.length || !record().preparedChanges.length}>
                  <div class="sf-decision-record-state" aria-label={t("sf.ui34.records")}>
                    <Show when={!record().alternatives.length}><p>{t("sf.ui34.noAlternatives")}</p></Show>
                    <Show when={!record().preparedChanges.length}><p>{t("sf.ui34.noChanges")}</p></Show>
                  </div>
                </Show>
              </section>
              <Show when={route()}>{(current) =>
                <nav class="sf-n24-actions sf-decision-next" aria-label={t("sf.ui34.title")}>
                  <A class="mx-btn" href={sfDecisionHref(current(), "alternatives", String(source()))}>{t("sf.ui34.openAlternatives")}</A>
                  <A class="mx-btn" href={sfDecisionHref(current(), "assumptions", String(source()))}>{t("sf.ui34.openAssumptions")}</A>
                  <A class="mx-btn" href={sfDecisionHref(current(), "questions", String(source()))}>{t("sf.ui34.openQuestions")}</A>
                </nav>
              }</Show>
              <Show when={ui.reviewing}>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-events">
                  <h2 id="sf-case-events">{t("sf.ui34.event")}</h2>
                  <ol class="sf-decision-timeline">
                    <For each={caseData.read.projection?.events ?? []}>{(event) =>
                      <li><header><strong><bdi>{event.kind}</bdi></strong><time>{event.at}</time></header><p><bdi>{event.rationale}</bdi></p></li>
                    }</For>
                  </ol>
                </section>
              </Show>
            </div>
          </>}
        </Show>
      </div>
    </SfPageFrame>
  )
}
