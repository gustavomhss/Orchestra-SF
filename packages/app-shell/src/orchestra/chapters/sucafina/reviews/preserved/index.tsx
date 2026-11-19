import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { readPreservedProjection, reviewReadState, type PreservedReview } from "./model"
import { SfPreservedAnswer } from "./answer"
import { AmountText, PeriodText, StatusText, WhenText } from "../labels"
import "./preserved.css"

const key = (value: string) => value as SfCopyKey

/** UI48: an original source read under the current owner; never reconstruct from title. */
export function SfPreservedReviewView(props: SfSurfaceProps<"UI48">) {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    status: "loading" as SfUiState,
    review: undefined as PreservedReview | undefined,
    presenting: props.route.kind === "present",
    retry: 0,
    updateStatus: "ready" as SfUiState,
    successor: undefined as Readonly<{
      available: boolean
      previousReviewRef: string
      confirmations: readonly { sectionId: string; label: string }[]
      unavailableSections: readonly { sectionId: string; title: string; reason: string }[]
    }> | undefined,
  })
  const ref = () => props.route.kind === "entry" || props.route.kind === "present"
    ? props.route.params.reviewRef : undefined
  let successorAbort: AbortController | undefined
  const current = (generation: number, ownerKey: string) => {
    const state = owner.state()
    return owner.generation() === generation && state.status === "ready" && state.ownerKey === ownerKey
  }
  createEffect(() => {
    const generation = owner.generation()
    const active = owner.ready()
    const state = owner.state()
    const reviewRef = ref()
    store.retry
    setStore({
      review: undefined, successor: undefined, updateStatus: "ready",
      presenting: props.route.kind === "present",
      status: state.status === "denied" ? "denied"
        : state.status === "unauthenticated" ? "session-expired"
        : state.status === "context-mismatch" ? "invalid"
        : state.status === "ready" ? "loading"
        : state.status === "resolving" ? "loading" : "unavailable",
    })
    const controller = new AbortController()
    successorAbort?.abort()
    if (state.status === "ready" && active && reviewRef) {
      void (async () => {
        try {
          const result = await createSfReviewsClient(active.transport)["dashboard.dashboard-review"](
            { id: reviewRef }, { signal: controller.signal },
          )
          if (controller.signal.aborted || !current(generation, state.ownerKey)) return
          if (result.kind === "response" && result.body.status === "ok") {
            if (result.body.value.id !== reviewRef) {
              setStore("status", "invalid")
              return
            }
            setStore({ review: result.body.value, status: "ready" })
          } else {
            setStore({ status: reviewReadState(result), review: undefined })
          }
        } catch (error) {
          if (controller.signal.aborted || !current(generation, state.ownerKey)) return
          console.error("Sucafina preserved review read failed", error instanceof Error ? error.name : "unknown")
          setStore({ status: "unavailable", review: undefined })
        }
      })()
    } else if (state.status === "ready" && !reviewRef) {
      setStore("status", "unavailable")
    }
    onCleanup(() => { controller.abort(); successorAbort?.abort() })
  })
  const successorMessage = (status: string) => {
    if (status === "denied") return "sf.common.noAccess"
    if (status === "session-expired") return "sf.common.loginAgain"
    if (status === "stale") return "sf.u32.stale"
    if (status === "conflict") return "sf.common.conflict"
    if (status === "invalid") return "sf.common.invalidLink"
    if (status === "outcome-unknown") return "sf.common.operationUnknown"
    if (status === "not-found") return "sf.common.removed"
    if (status === "partial") return "sf.common.needsInput"
    return "sf.common.unavailable"
  }
  const update = async () => {
    const active = owner.ready(), state = owner.state(), review = store.review
    if (!active || state.status !== "ready" || !review || store.updateStatus === "loading") return
    const generation = owner.generation()
    successorAbort?.abort()
    const controller = new AbortController()
    successorAbort = controller
    setStore({ updateStatus: "loading", successor: undefined })
    try {
      const result = await createSfReviewsClient(active.transport)["reviews.review-update"](
        { reviewRef: review.id }, { signal: controller.signal },
      )
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      if (result.kind === "response" && result.body.status === "ok" &&
          result.body.value.previousReviewRef === review.id) {
        setStore({ updateStatus: "ready", successor: result.body.value })
      } else {
        const status = reviewReadState(result)
        if (status === "denied") setStore({ status: "denied", review: undefined })
        setStore("updateStatus", status)
      }
    } catch (error) {
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      console.error("Sucafina preserved review successor read failed", error instanceof Error ? error.name : "unknown")
      setStore("updateStatus", "unavailable")
    }
  }
  onCleanup(() => successorAbort?.abort())
  return (
    <SfPageFrame
      titleKey={key("sf.ui48.title")} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="reading"
      onLayoutMode={() => undefined}
      primaryAction={ref() && store.status === "ready" ? {
        id: "present-review",
        labelKey: key(store.presenting ? "sf.u32.return" : "sf.ui48.primary"),
        tone: "primary", disabled: false, busy: false,
        onInvoke: () => setStore("presenting", (value) => !value),
      } : undefined}
    >
      <div class="sf-n28 sf-n28-preserved" data-sf-surface="UI48" data-sf-presentation={store.presenting}>
        <SfStatePanel
          state={store.status}
          messageKey={key(!ref() ? "sf.u32.listUnavailable" : "sf.u32.reviewUnavailable")}
          onRetryRead={() => setStore("retry", (value) => value + 1)}
        >
          <Show when={store.review}>
            {(review) => <article data-review-ref={review().id} data-review-version={review().version}>
              <header class="mx-card sf-n28-summary">
                <dl>
                  <div><dt>{t("sf.u32.ref")}</dt><dd>{review().id}</dd></div>
                  <div><dt>{t("sf.u32.version")}</dt><dd>{review().version}</dd></div>
                  <div><dt>{t("sf.u32.created")}</dt><dd><WhenText iso={review().createdAt} /></dd></div>
                </dl>
              </header>
              <section class="sf-n28-section" aria-label={t("sf.u32.sections")}>
                <h2>{t("sf.u32.sections")}</h2>
                <ol class="sf-n28-items">
                  <For each={review().sections}>
                    {(section) => <li class="mx-card" data-section-id={section.id}>
                      <h3>{section.title}</h3>
                      <p>{t("sf.u32.period")}: <PeriodText start={section.period.start} end={section.period.end} /></p>
                      <p>{t("sf.u32.records")}: {section.count}</p>
                      <Show when={readPreservedProjection(section.content)}
                        fallback={<p role="status">{t("sf.u32.materialUnavailable")}</p>}>
                        {(projection) => <section aria-label={t("sf.u32.values")} class="sf-n28-section">
                          <h4>{t("sf.u32.values")}</h4>
                          <dl class="sf-n28-values">
                            <For each={projection().values}>
                              {(value) => <div>
                                <dt>{value.id}</dt>
                                <dd>
                                  <span>{value.value === null ? t("sf.u32.missing") : <AmountText value={value.value} currency={value.currency} />}</span>
                                  <Show when={value.unit}><span> {value.unit}</span></Show>
                                  <Show when={value.currency}><span> {value.currency}</span></Show>
                                  <small> {t("sf.u32.evidence")}: <StatusText value={value.evidenceState} /></small>
                                </dd>
                              </div>}
                            </For>
                          </dl>
                        </section>}
                      </Show>
                      <Show when={section.sourceRefs.length}>
                        <section class="sf-n28-section">
                          <h4>{t("sf.u32.sources")}</h4>
                          <ul>
                            <For each={section.sourceRefs}>{(source) => <li>
                              <span>{source.surface} / {source.type} / {source.id}</span>
                              <span> · {t("sf.u32.sourceVersion")}: {source.version}</span>
                              <span> · {t("sf.u32.observed")}: <WhenText iso={source.observedAt} /></span>
                            </li>}</For>
                          </ul>
                        </section>
                      </Show>
                    </li>}
                  </For>
                </ol>
              </section>
              <SfPreservedAnswer review={review()} />
              <section class="sf-n28-section" aria-label={t("sf.u32.comments")}>
                <h2>{t("sf.u32.comments")}</h2>
                <Show when={review().comments.length} fallback={<p>{t("sf.u32.none")}</p>}>
                  <ol class="sf-n28-items">
                    <For each={review().comments}>{(comment) => <li class="mx-card">
                      <p>{comment.content}</p>
                      <small>{comment.authorRef} · <WhenText iso={comment.createdAt} /></small>
                    </li>}</For>
                  </ol>
                </Show>
              </section>
              <div class="sf-n28-actions">
                <button type="button" class="mx-btn" onClick={() => { void update() }}
                  disabled={store.updateStatus === "loading" || store.status !== "ready"}>{t("sf.u32.update")}</button>
              </div>
              <Show when={store.successor}>
                {(next) => <section class="mx-card sf-n28-section" data-sf-successor-availability={next().available}>
                  <p role="status">{t(next().available ? "sf.u32.updateReady" : "sf.u32.updateBlocked")}</p>
                  <h3>{t("sf.u32.confirmations")}</h3>
                  <ul><For each={next().confirmations}>{(item) => <li>{item.label}</li>}</For></ul>
                  <h3>{t("sf.u32.unavailableSections")}</h3>
                  <ul><For each={next().unavailableSections}>{(item) => <li><strong>{item.title}</strong>: <StatusText value={item.reason} /></li>}</For></ul>
                </section>}
              </Show>
              <Show when={store.updateStatus !== "ready" && store.updateStatus !== "loading"}>
                <p role="alert">{t(successorMessage(store.updateStatus))}</p>
              </Show>
            </article>}
          </Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
