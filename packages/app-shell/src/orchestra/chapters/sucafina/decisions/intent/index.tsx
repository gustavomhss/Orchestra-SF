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

const k = (value: string) => value as SfCopyKey

/** UI34: source-backed intent and original, case-CAS source attachment. */
export function SfIntentView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string, params?: Record<string, string | number>) => language.t(value as Parameters<typeof language.t>[0], params)
  const [ui, setUi] = createStore({ reviewing: false, editing: false })
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
        busy: false, onInvoke: () => setUi("editing", true),
      }]}
    >
      <div class="sf-n24" data-sf-surface="UI34" data-sf-case-ref={source()} data-sf-case-version={data()?.version}>
        <Show when={route() && back()}>
          <A class="mx-btn" href={back()!}>{t("sf.ui33.return")}</A>
        </Show>
        <Show when={caseData.read.state === "ready" && data()} fallback={
          <SfStatePanel
            state={caseData.read.state}
            messageKey={k(caseData.read.state === "not-found" ? "sf.ui34.notFound" : "sf.ui34.unavailable")}
            onRetryRead={() => caseData.reload()}
          />
        }>
          {(record) =>
            <>
              <Show when={ui.editing && caseData.read.projection}>{(projection) =>
                <SfCaseSourcesEditor projection={projection()} onSaved={() => { setUi("editing", false); caseData.reload() }} />
              }</Show>
              <div class="sf-n24-metadata">
                <span>{t("sf.ui34.current")}: {record().version}</span>
                <span>{t("sf.ui34.state")}: <bdi>{record().state}</bdi></span>
                <span>{t("sf.ui34.period")}: <time>{record().horizon.start}</time> – <time>{record().horizon.end}</time></span>
                <span><bdi>{record().currency}</bdi></span>
              </div>
              <section class="mx-card sf-n24-section" aria-label={t("sf.ui34.records")}>
                <Show when={!record().alternatives.length}><p>{t("sf.ui34.noAlternatives")}</p></Show>
                <Show when={!record().preparedChanges.length}><p>{t("sf.ui34.noChanges")}</p></Show>
              </section>
              <div class="sf-n24-grid">
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-question">
                  <h2 id="sf-case-question">{t("sf.ui34.question")}</h2>
                  <p><bdi>{record().objective}</bdi></p>
                </section>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-objectives">
                  <h2 id="sf-case-objectives">{t("sf.ui34.objectives")}</h2>
                  <p><bdi>{record().objective}</bdi></p>
                  <p><small>{t("sf.ui34.readonly")}</small></p>
                </section>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-constraints">
                  <h2 id="sf-case-constraints">{t("sf.ui34.constraints")}</h2>
                  <Show when={gaps().length} fallback={<p>{t("sf.ui34.noConstraints")}</p>}>
                    <ul class="sf-n24-list"><For each={gaps()}>{(gap) => <li><bdi>{gap}</bdi></li>}</For></ul>
                  </Show>
                </section>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-criteria">
                  <h2 id="sf-case-criteria">{t("sf.ui34.criteria")}</h2>
                  <Show when={record().criteria.length} fallback={<p>{t("sf.ui34.noCriteria")}</p>}>
                    <ol class="sf-n24-list">
                      <For each={record().criteria}>
                        {(item) => <li><bdi>{item.description}</bdi> · {t(item.required ? "sf.ui34.required" : "sf.ui34.optional")}</li>}
                      </For>
                    </ol>
                  </Show>
                </section>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-participants">
                  <h2 id="sf-case-participants">{t("sf.ui34.participants")}</h2>
                  <Show when={record().participants.length} fallback={<p>{t("sf.ui34.noParticipants")}</p>}>
                    <ul class="sf-n24-list"><For each={record().participants}>{(person) => <li><bdi>{person}</bdi></li>}</For></ul>
                  </Show>
                </section>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-sources">
                  <h2 id="sf-case-sources">{t("sf.ui34.sources")}</h2>
                  <Show when={record().sourceRefs.length} fallback={<p>{t("sf.ui34.noSources")}</p>}>
                    <ul class="sf-n24-list">
                      <For each={record().sourceRefs}>
                        {(source) => <li><bdi>{source.refId}</bdi> · <bdi>{source.evidenceLevel}</bdi></li>}
                      </For>
                    </ul>
                  </Show>
                </section>
              </div>
              <Show when={route()}>
                {(current) => <nav class="sf-n24-actions" aria-label={t("sf.ui34.title")}>
                  <A class="mx-btn" href={sfDecisionHref(current(), "alternatives", String(source()))}>{t("sf.ui34.openAlternatives")}</A>
                  <Show when={record().alternatives.length >= 2}><A class="mx-btn" href={sfDecisionHref(current(), "choice", String(source()))}>{t("sf.ui38.author.title")}</A></Show>
                  <A class="mx-btn" href={sfDecisionHref(current(), "assumptions", String(source()))}>{t("sf.ui34.openAssumptions")}</A>
                  <A class="mx-btn" href={sfDecisionHref(current(), "questions", String(source()))}>{t("sf.ui34.openQuestions")}</A>
                </nav>}
              </Show>
              <Show when={ui.reviewing}>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-events">
                  <h2 id="sf-case-events">{t("sf.ui34.event")}</h2>
                  <p>{t("sf.ui34.sourceCounts", { sources: record().sourceRefs.length, receipts: record().receipts.length })}</p>
                  <ol class="sf-n24-list">
                    <For each={caseData.read.projection?.events ?? []}>
                      {(event) => <li><strong><bdi>{event.kind}</bdi></strong> · <time>{event.at}</time><p><bdi>{event.rationale}</bdi></p></li>}
                    </For>
                  </ol>
                </section>
              </Show>
            </>}
        </Show>
      </div>
    </SfPageFrame>
  )
}
