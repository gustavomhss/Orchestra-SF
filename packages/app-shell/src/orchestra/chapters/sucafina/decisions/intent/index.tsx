import { A } from "@solidjs/router"
import { For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SfPageFrame, type SfCopyKey } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfCase } from "../cases/model"
import { sfDecisionHref } from "../cases/route"
import "../cases/n24.css"

const k = (value: string) => value as SfCopyKey

/** UI34: source-backed intent. No invented update endpoint for case basics. */
export function SfIntentView(props: SfSurfaceProps): JSX.Element {
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore({ reviewing: false })
  const valid = () => props.surfaceId === "UI34"
  const source = () => valid() ? props.route.params.caseRef : undefined
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
        disabled: caseData.read.state === "loading", busy: false, onInvoke: () => caseData.reload(),
      }]}
    >
      <div class="sf-n24">
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
              <div class="sf-n24-metadata">
                <span>{t("sf.ui34.current")}: {record().version}</span>
                <span>{t("sf.ui34.state")}: <bdi>{record().state}</bdi></span>
                <span>{t("sf.ui34.period")}: <time>{record().horizon.start}</time> – <time>{record().horizon.end}</time></span>
                <span><bdi>{record().currency}</bdi></span>
              </div>
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
                  <A class="mx-btn" href={sfDecisionHref(current(), "assumptions", String(source()))}>{t("sf.ui34.openAssumptions")}</A>
                  <A class="mx-btn" href={sfDecisionHref(current(), "questions", String(source()))}>{t("sf.ui34.openQuestions")}</A>
                </nav>}
              </Show>
              <Show when={ui.reviewing}>
                <section class="mx-card sf-n24-section" aria-labelledby="sf-case-events">
                  <h2 id="sf-case-events">{t("sf.ui34.event")}</h2>
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
