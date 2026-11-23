import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U32_COPY } from "@/i18n/orchestra-chapters/sf-u32"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { preservedMeetingLine, readPreservedProjection, reviewReadState, type PreservedReview } from "./model"
import { SfPreservedAnswer } from "./answer"
import { SfOpenReviewReference } from "../open-reference"
import { PeriodText, StatusText, WhenText } from "../labels"
import { preservedValueGroups } from "./presentation"
import { SfPreservedEvidence, SfPreservedFieldLabel, SfPreservedLiteral, SfPreservedRecordLabel, SfPreservedValuePeriod } from "./value"
import "./preserved.css"
import "../workflows.css"
import "../wave-five.css"

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
    topic: 0,
    sourceLinks: [] as readonly { label: string; url: string }[],
    sourceRef: "",
    sourceStatus: "ready" as SfUiState,
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
  let sourceAbort: AbortController | undefined
  const clearSource = () => {
    sourceAbort?.abort()
    sourceAbort = undefined
    setStore({ sourceLinks: [], sourceRef: "", sourceStatus: "ready" })
  }
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
    clearSource()
    setStore({
      review: undefined, successor: undefined, topic: 0, sourceLinks: [], updateStatus: "ready",
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
    onCleanup(() => { controller.abort(); successorAbort?.abort(); sourceAbort?.abort() })
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
  const openSource = async (referenceId: string) => {
    const active = owner.ready(), state = owner.state(), review = store.review
    if (!active || state.status !== "ready" || !review || !referenceId) return
    sourceAbort?.abort()
    const generation = owner.generation(), stamp = JSON.stringify(active.context.stamp)
    const controller = new AbortController()
    sourceAbort = controller
    setStore({ sourceLinks: [], sourceRef: referenceId, sourceStatus: "loading" })
    const currentSource = () => !controller.signal.aborted && sourceAbort === controller &&
      current(generation, state.ownerKey) && owner.ready()?.transport === active.transport &&
      JSON.stringify(owner.ready()?.context.stamp) === stamp && ref() === review.id &&
      store.review?.id === review.id && store.review.version === review.version && store.sourceRef === referenceId
    const failed = (status: SfUiState) => {
      setStore({ sourceLinks: [], sourceStatus: status })
      if (status === "denied" || status === "session-expired") {
        successorAbort?.abort()
        setStore({ status, review: undefined, successor: undefined })
        clearSource()
      }
    }
    try {
      const client = createSfReviewsClient(active.transport)
      const read = await client["dashboard.dashboard-review"]({ id: review.id }, { signal: controller.signal })
      if (!currentSource()) return
      if (read.kind !== "response" || read.body.status !== "ok") {
        failed(reviewReadState(read))
        return
      }
      if (read.body.value.id !== review.id || read.body.value.version !== review.version) {
        failed("stale")
        return
      }
      const resolved = await client["reviews.review-source"]({ reviewRef: review.id, referenceId }, { signal: controller.signal })
      if (!currentSource()) return
      if (resolved.kind !== "response") {
        failed(reviewReadState(resolved))
        return
      }
      if (!("links" in resolved.body)) {
        failed(reviewReadState({ kind: "response", status: resolved.status, body: resolved.body }))
        return
      }
      const links = resolved.body.links.filter((link) => {
        try {
          const destination = new URL(link.url, location.href)
          return destination.origin === location.origin && (destination.protocol === "https:" || destination.protocol === "http:")
        } catch { return false }
      })
      setStore({ sourceLinks: links, sourceStatus: links.length ? "ready" : "empty" })
    } catch (error) {
      if (!currentSource()) return
      console.error("Sucafina preserved source read failed", error instanceof Error ? error.name : "unknown")
      failed("unavailable")
    }
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
        if (status === "denied" || status === "session-expired") {
          clearSource()
          setStore({ status, review: undefined })
        }
        setStore("updateStatus", status)
      }
    } catch (error) {
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      console.error("Sucafina preserved review successor read failed", error instanceof Error ? error.name : "unknown")
      setStore("updateStatus", "unavailable")
    }
  }
  onCleanup(() => { successorAbort?.abort(); sourceAbort?.abort() })
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
      <div class="sf-n28 sf-n28-preserved sf-workflow" data-sf-surface="UI48" data-sf-wave="five" data-sf-presentation={store.presenting}>
        <header class="sf-review-intro">
          <h2>{t(store.presenting ? "sf.u32.meeting" : "sf.u32.readHeading")}</h2>
          <p>{t(store.presenting ? "sf.u32.presentationHint" : "sf.u32.readHint")}</p>
        </header>
        <Show when={!ref() && owner.ready()}><SfOpenReviewReference route={props.route} destination="reviews" /></Show>
        <SfStatePanel
          state={store.status}
          messageKey={key(!ref() ? "sf.u32.listUnavailable" : "sf.u32.reviewUnavailable")}
          onRetryRead={ref() ? () => setStore("retry", (value) => value + 1) : undefined}
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
              <section class="sf-n28-section sf-section" data-sf-review-sequence hidden={store.presenting} aria-label={t("sf.u32.sections")}>
                <h2>{t("sf.u32.sections")}</h2>
                <ol class="sf-n28-items">
                  <For each={review().sections}>
                    {(section) => <li class="mx-card" data-section-id={section.id}>
                      <h3>{section.title}</h3>
                      <p>{t("sf.u32.period")}: <PeriodText start={section.period.start} end={section.period.end} /></p>
                      <p>{t("sf.u32.records")}: {section.count}</p>
                      <Show when={readPreservedProjection(section.content)}
                        fallback={<p role="status">{t("sf.u32.materialUnavailable")}</p>}>
                        {(projection) => <section aria-label={t("sf.u32.values")} class="sf-n28-section sf-section">
                          <h4>{t("sf.u32.values")}</h4>
                          <For each={preservedValueGroups(projection().values)}>{(group) =>
                            <section class="sf-preserved-record" data-sf-preserved-record={group.presentation.recordRef}>
                              <h5><SfPreservedRecordLabel presentation={group.presentation} /></h5>
                              <dl class="sf-n28-values">
                                <For each={group.values}>{(value) => <div data-sf-preserved-value={value.id} data-sf-preserved-value-id={value.id}>
                                  <dt><SfPreservedFieldLabel value={value} values={projection().values} />
                                    <details class="sf-technical-details"><summary>{t("sf.u32.valueReference")}</summary><bdi>{value.id}</bdi></details>
                                  </dt>
                                  <dd>
                                    <span class="sf-preserved-value"><SfPreservedLiteral value={value.value} /></span>
                                    <Show when={value.unit}><small>{t("sf.u32.unit")}: {value.unit}</small></Show>
                                    <Show when={value.currency}><small>{t("sf.u32.currency")}: {value.currency === "unspecified" ? t("sf.u32.currencyNotProvided") : value.currency}</small></Show>
                                    <SfPreservedValuePeriod value={value} />
                                    <small>{t("sf.u32.evidence")}: <SfPreservedEvidence value={value.evidenceState} /></small>
                                  </dd>
                                </div>}</For>
                              </dl>
                            </section>
                          }</For>
                        </section>}
                      </Show>
                      <Show when={section.sourceRefs.length}>
                        <section class="sf-n28-section sf-section">
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
              <div hidden={!store.presenting} class="sf-review-presentation">
              <SfPreservedMeeting
                review={review()}
                topic={store.topic}
                onTopic={(topic) => { clearSource(); setStore("topic", topic) }}
                onSource={(referenceId) => { void openSource(referenceId) }}
                onUpdate={() => { void update() }}
                updateBusy={store.updateStatus === "loading"}
              />
              <Show when={store.sourceRef}>
                <section class="sf-n28-source-result mx-card" aria-label={t("sf.u32.authorizedSources")}
                  aria-busy={store.sourceStatus === "loading"} data-sf-source-state={store.sourceStatus}>
                  <SfStatePanel state={store.sourceStatus}
                    messageKey={key(store.sourceStatus === "loading" ? "sf.common.loading" : store.sourceStatus === "empty" ? "sf.u32.sourceEmpty" : store.sourceStatus === "stale" ? "sf.u32.stale" : "sf.u32.sourceUnavailable")}
                    onRetryRead={store.sourceStatus === "stale"
                      ? () => { clearSource(); setStore("retry", (value) => value + 1) }
                      : store.sourceStatus !== "loading" ? () => { void openSource(store.sourceRef) } : undefined}>
                    <nav aria-label={t("sf.u32.authorizedSources")}>
                      <For each={store.sourceLinks}>{(link) => <a class="mx-btn" href={link.url}>{link.label}</a>}</For>
                    </nav>
                  </SfStatePanel>
                </section>
              </Show>
              </div>
              <div hidden={store.presenting} class="sf-review-discussion">
              <SfPreservedAnswer review={review()} />
              <section class="sf-n28-section sf-section" aria-label={t("sf.u32.comments")}>
                <h2>{t("sf.u32.comments")}</h2>
                <Show when={review().comments.length} fallback={<p>{t("sf.u32.none")}</p>}>
                  <ol class="sf-n28-items">
                    <For each={review().comments}>{(comment) => <li class="mx-card">
                      <p>{comment.content}</p>
                      <small><WhenText iso={comment.createdAt} /></small>
                      <details class="sf-technical-details"><summary>{t("sf.u32.authorReference")}</summary><bdi>{comment.authorRef}</bdi></details>
                    </li>}</For>
                  </ol>
                </Show>
              </section>
              <div class="sf-n28-actions sf-form-actions">
                <button type="button" class="mx-btn" onClick={() => { void update() }}
                  disabled={store.updateStatus === "loading" || store.status !== "ready"}>{t("sf.u32.update")}</button>
              </div>
              </div>
              <Show when={store.successor}>
                {(next) => <section class="mx-card sf-n28-section sf-section" data-sf-successor-availability={next().available}>
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

function SfPreservedMeeting(props: {
  review: PreservedReview
  topic: number
  onTopic: (topic: number) => void
  onSource: (referenceId: string) => void
  onUpdate: () => void
  updateBusy: boolean
}) {
  const language = useLanguage()
  const t = (value: keyof typeof SF_U32_COPY) => language.t(value as Parameters<typeof language.t>[0])
  const section = () => props.review.sections[Math.max(0, Math.min(props.topic, props.review.sections.length - 1))]
  const projection = () => {
    const current = section()
    return current ? readPreservedProjection(current.content) : undefined
  }
  const sources = () => {
    const current = projection()
    if (!current) return []
    return [...new Map(current.values.flatMap((value) => value.sourceRefs).map((ref) => [ref.refId, ref])).values()]
  }
  return (
    <section class="mx-card sf-n28-section sf-review-meeting sf-section" aria-label={t("sf.u32.meeting")}>
      <p role="status" class="sf-workflow-note">{t("sf.u32.version")}: {props.review.version} · <WhenText iso={props.review.createdAt} /></p>
      <details class="sf-technical-details"><summary>{t("sf.u32.ref")}</summary><bdi>{props.review.id}</bdi></details>
      <div class="sf-n28-actions sf-form-actions">
        <button type="button" class="mx-btn" disabled={props.topic <= 0} onClick={() => props.onTopic(props.topic - 1)}>{t("sf.u32.previousTopic")}</button>
        <button type="button" class="mx-btn" disabled={props.topic >= props.review.sections.length - 1} onClick={() => props.onTopic(props.topic + 1)}>{t("sf.u32.nextTopic")}</button>
        <button type="button" class="mx-btn" disabled={props.updateBusy} onClick={() => props.onUpdate()}>{t("sf.u32.checkUpdates")}</button>
      </div>
      <Show when={section()}>
        {(current) => <>
          <h2>{current().title}</h2>
          <p><PeriodText start={current().period.start} end={current().period.end} /> · {t("sf.u32.records")}: {current().count}</p>
          <Show when={projection()} fallback={<p>{t("sf.u32.materialUnavailable")}</p>}>
            {(shown) => <div class="sf-preserved-meeting-values">
              <For each={preservedValueGroups(shown().values)}>{(group) =>
                <section class="sf-preserved-record">
                  <h3><SfPreservedRecordLabel presentation={group.presentation} /></h3>
                  <dl class="sf-review-meeting-values sf-preserved-meeting-fields">
                    <For each={group.values}>{(value) => <div>
                      <dt><SfPreservedFieldLabel value={value} values={shown().values} /></dt>
                      <dd>
                        <strong><SfPreservedLiteral value={value.value} /></strong>
                        <Show when={value.unit}><small>{t("sf.u32.unit")}: {value.unit}</small></Show>
                        <Show when={value.currency}><small>{t("sf.u32.currency")}: {value.currency === "unspecified" ? t("sf.u32.currencyNotProvided") : value.currency}</small></Show>
                        <SfPreservedValuePeriod value={value} />
                        <small>{t("sf.u32.evidence")}: <SfPreservedEvidence value={value.evidenceState} /></small>
                        <details class="sf-technical-details">
                          <summary>{t("sf.u32.inspectSource")}</summary>
                          <div>{t("sf.u32.valueReference")}: <bdi>{value.id}</bdi></div>
                          <p>{preservedMeetingLine(value)}</p>
                          <Show when={!value.sourceRefs.length}><span>{t("sf.u32.notRecorded")}</span></Show>
                        </details>
                      </dd>
                    </div>}</For>
                  </dl>
                </section>
              }</For>
            </div>}
          </Show>
          <Show when={sources().length}>
            <ul class="sf-n28-items" aria-label={t("sf.u32.sourceNav")}>
              <For each={sources()}>{(source) => <li>
                <button type="button" class="mx-btn" onClick={() => props.onSource(source.refId)}>{t("sf.u32.openSource")}</button>
                <details class="sf-technical-details"><summary>{t("sf.u32.sources")}</summary><bdi>{source.refId}</bdi></details>
              </li>}</For>
            </ul>
          </Show>
        </>}
      </Show>
    </section>
  )
}
