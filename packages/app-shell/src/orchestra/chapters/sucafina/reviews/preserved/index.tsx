import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import type { SfReviewUpdate, SfDashboardDashboardAgenda } from "@orchestra/schema/sucafina/reviews"
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
import { AmountText, PeriodText, StatusText, WhenText, operationGranted } from "../labels"
import { SfAgendaRecordSelection } from "../agenda/record-selection"
import { encodeSfRouteRef } from "../../navigation-state"
import "./preserved.css"

const key = (value: string) => value as SfCopyKey
type Successor = Schema.Schema.Type<typeof SfReviewUpdate>
type RevisionPreview = Extract<Schema.Schema.Type<typeof SfDashboardDashboardAgenda.output>, { status: "ok" }>["value"]
type RevisionPhase = "selecting" | "previewing" | "reviewing" | "submitting" | "outcome-unknown" | "confirmed"

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
    updateStatus: "ready" as SfUiState,
    successor: undefined as Successor | undefined,
    revisionPhase: "selecting" as RevisionPhase,
    revisionPreview: undefined as RevisionPreview | undefined,
    revisionResult: undefined as PreservedReview | undefined,
  })
  const ref = () => props.route.kind === "entry" || props.route.kind === "present"
    ? props.route.params.reviewRef : undefined
  let successorAbort: AbortController | undefined
  const revisionLocked = () => store.revisionPhase === "submitting" || store.revisionPhase === "outcome-unknown" || store.revisionPhase === "confirmed"
  const mayRevise = () => operationGranted(owner.ready()?.context, "dashboard.dashboard-agenda", { family: "reviews" })
  const canPrepareSuccessor = () => !!store.successor?.available && store.successor.unavailableSections.length === 0 &&
    store.successor.items.every((item) => item.agendaNote === undefined)
  const mayPreserveRevision = () => operationGranted(owner.ready()?.context, "dashboard.dashboard-review-preserve", { family: "reviews" })
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
      review: undefined, successor: undefined, topic: 0, sourceLinks: [], updateStatus: "ready",
      revisionPhase: "selecting", revisionPreview: undefined, revisionResult: undefined,
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
  const openSource = async (referenceId: string) => {
    const active = owner.ready(), state = owner.state(), review = store.review
    if (!active || state.status !== "ready" || !review) return
    const generation = owner.generation()
    const controller = new AbortController()
    successorAbort = controller
    const client = createSfReviewsClient(active.transport)
    const read = await client["dashboard.dashboard-review"]({ id: review.id }, { signal: controller.signal })
    if (controller.signal.aborted || !current(generation, state.ownerKey)) return
    if (read.kind !== "response" || read.body.status !== "ok" || read.body.value.id !== review.id) return
    const resolved = await client["reviews.review-source"]({ reviewRef: review.id, referenceId }, { signal: controller.signal })
    if (controller.signal.aborted || !current(generation, state.ownerKey)) return
    if (resolved.kind === "response" && "links" in resolved.body && typeof location !== "undefined")
      setStore("sourceLinks", resolved.body.links.filter((link) => {
        try {
          const destination = new URL(link.url, location.href)
          return destination.origin === location.origin
        } catch { return false }
      }))
  }
  const update = async () => {
    const active = owner.ready(), state = owner.state(), review = store.review
    if (!active || state.status !== "ready" || !review || store.updateStatus === "loading" || revisionLocked()) return
    const generation = owner.generation()
    successorAbort?.abort()
    const controller = new AbortController()
    successorAbort = controller
    setStore({ updateStatus: "loading", successor: undefined, revisionPhase: "selecting", revisionPreview: undefined, revisionResult: undefined })
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
  const prepareRevision = async () => {
    const active = owner.ready(), state = owner.state(), review = store.review, successor = store.successor
    if (!active || state.status !== "ready" || !review || !successor || !canPrepareSuccessor() ||
        successor.previousReviewRef !== review.id || successor.unavailableSections.length ||
        !successor.items.length || !mayRevise() || revisionLocked() || store.revisionPhase === "previewing") return
    const generation = owner.generation(), ownerKey = state.ownerKey
    const controller = new AbortController()
    successorAbort?.abort()
    successorAbort = controller
    const sections = successor.items.map((item) => ({
      id: item.id, title: item.title ?? item.topic, topic: item.topic, selectionRef: item.selectionRef,
      period: { start: item.period.start, end: item.period.end },
      ...(item.recordRefs === undefined ? {} : { recordRefs: [...item.recordRefs] }),
    }))
    setStore({ revisionPhase: "previewing", revisionPreview: undefined, updateStatus: "loading" })
    try {
      const result = await createSfReviewsClient(active.transport)["dashboard.dashboard-agenda"](
        { sections }, { signal: controller.signal },
      )
      if (controller.signal.aborted || !current(generation, ownerKey)) return
      if (result.kind === "response" && result.body.status === "ok") {
        const expected = sections.map((section) => section.id)
        if (result.body.value.sections.length !== expected.length ||
            result.body.value.sections.some((section, index) => section.id !== expected[index])) {
          setStore({ revisionPhase: "selecting", updateStatus: "stale" })
          return
        }
        setStore({ revisionPhase: "reviewing", revisionPreview: result.body.value, updateStatus: "ready" })
        return
      }
      setStore({ revisionPhase: "selecting", updateStatus: reviewReadState(result) })
    } catch (error) {
      if (controller.signal.aborted || !current(generation, ownerKey)) return
      console.error("Sucafina revision preparation failed", error instanceof Error ? error.name : "unknown")
      setStore({ revisionPhase: "selecting", updateStatus: "unavailable" })
    }
  }
  const preserveRevision = async () => {
    const active = owner.ready(), state = owner.state(), review = store.review, prepared = store.revisionPreview
    if (!active || state.status !== "ready" || !review || !prepared ||
        !mayPreserveRevision() || store.revisionPhase !== "reviewing") return
    const generation = owner.generation(), ownerKey = state.ownerKey
    const controller = new AbortController()
    successorAbort = controller
    setStore({ revisionPhase: "submitting", updateStatus: "loading" })
    try {
      const result = await createSfReviewsClient(active.transport)["dashboard.dashboard-review-preserve"](
        { previousReviewRef: review.id, selectionRef: prepared.selectionRef, sectionRefs: prepared.sections.map((section) => section.id) },
        { signal: controller.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (controller.signal.aborted || !current(generation, ownerKey)) return
      if (result.kind === "response" && result.body.status === "ok") {
        const next = result.body.value
        if (next.id === review.id || next.previousReviewRef !== review.id ||
            next.sections.length !== prepared.sections.length ||
            next.sections.some((section, index) => section.id !== prepared.sections[index]?.id)) {
          setStore({ revisionPhase: "outcome-unknown", updateStatus: "outcome-unknown" })
          return
        }
        setStore({ revisionPhase: "confirmed", revisionResult: next, updateStatus: "ready" })
        return
      }
      const status = reviewReadState(result)
      setStore({ revisionPhase: "outcome-unknown", updateStatus: status === "unavailable" ? "outcome-unknown" : status })
    } catch (error) {
      if (controller.signal.aborted || !current(generation, ownerKey)) return
      console.error("Sucafina revision preservation did not settle", error instanceof Error ? error.name : "unknown")
      setStore({ revisionPhase: "outcome-unknown", updateStatus: "outcome-unknown" })
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
              <SfPreservedMeeting
                review={review()}
                topic={store.topic}
                onTopic={(topic) => setStore("topic", topic)}
                onSource={(referenceId) => { void openSource(referenceId) }}
                onUpdate={() => { void update() }}
                updateBusy={store.updateStatus === "loading" || revisionLocked()}
              />
              <Show when={store.sourceLinks.length}>
                <nav aria-label={SF_U32_COPY["sf.u32.authorizedSources"]}>
                  <For each={store.sourceLinks}>{(link) => <a href={link.url}>{link.label}</a>}</For>
                </nav>
              </Show>
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
                  disabled={store.updateStatus === "loading" || store.status !== "ready" || revisionLocked()}>{t("sf.u32.update")}</button>
              </div>
              <Show when={store.successor}>
                {(next) => <section class="mx-card sf-n28-section" data-sf-successor-availability={next().available}>
                  <p role="status">{t(next().available ? "sf.u32.updateReady" : "sf.u32.updateBlocked")}</p>
                  <h3>{t("sf.u32.confirmations")}</h3>
                  <ul><For each={next().confirmations}>{(item) => <li>{item.label}</li>}</For></ul>
                  <h3>{t("sf.u32.unavailableSections")}</h3>
                  <ul><For each={next().unavailableSections}>{(item) => <li><strong>{item.title}</strong>: <StatusText value={item.reason} /></li>}</For></ul>
                  <Show when={canPrepareSuccessor()} fallback={<p role="status">{t("sf.u32.updateBlocked")}</p>}>
                    <For each={next().items}>{(item) => <SfAgendaRecordSelection section={item}
                      disabled={revisionLocked() || store.revisionPhase === "previewing"}
                      onSelection={(recordRefs) => {
                        setStore("successor", (successor) => successor ? { ...successor, items: successor.items.map((section) => section.id === item.id ? { ...section, recordRefs } : section) } : successor)
                        setStore({ revisionPreview: undefined, revisionPhase: "selecting" })
                      }} />}</For>
                    <button class="mx-btn" type="button" disabled={!mayRevise() || revisionLocked() || store.revisionPhase === "previewing"}
                      onClick={() => { void prepareRevision() }}>{t("sf.u32.prepareRevision")}</button>
                  </Show>
                </section>}
              </Show>
              <Show when={store.revisionPhase === "reviewing" ? store.revisionPreview : undefined}>
                {(preview) => <section class="mx-card sf-n28-section" data-sf-revision-preview>
                  <h3>{t("sf.u32.revisionPreview")}</h3>
                  <ol>
                    <For each={preview().sections}>{(section) => <li data-section-id={section.id}>
                      <h4>{section.title}</h4>
                      <p>{t("sf.u32.records")}: {section.recordCount}</p>
                      <ul><For each={section.projection.values}>{(value) => <li>{preservedMeetingLine(value)}</li>}</For></ul>
                    </li>}</For>
                  </ol>
                  <button class="mx-btn primary" type="button" disabled={!mayPreserveRevision()}
                    onClick={() => { void preserveRevision() }}>{t("sf.u32.preserveRevision")}</button>
                </section>}
              </Show>
              <Show when={store.revisionResult}>
                {(result) => <section class="mx-card sf-n28-section" data-sf-preserved-revision={result().id}>
                  <p role="status">{t("sf.u32.revisionPreserved")}</p>
                  <a href={"/orchestra/sf-reviews/reviews/" + encodeSfRouteRef(result().id)}>{t("sf.u32.openRevision")}</a>
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
    <section class="sf-n28-section" aria-label={SF_U32_COPY["sf.u32.meeting"]}>
      <p role="status">{`Preserved review ${props.review.id} v${props.review.version} · ${props.review.createdAt}`}</p>
      <Show when={section()}>
        {(current) => <>
          <h2>{current().title}</h2>
          <p>{current().period.start} – {current().period.end} · {current().count} records</p>
          <Show when={projection()} fallback={<p>{SF_U32_COPY["sf.u32.materialUnavailable"]}</p>}>
            {(shown) => <ul>
              <For each={shown().values}>{(value) => <li>{preservedMeetingLine(value)}</li>}</For>
            </ul>}
          </Show>
          <Show when={sources().length}>
            <ul aria-label={SF_U32_COPY["sf.u32.sourceNav"]}>
              <For each={sources()}>{(source) => <li>
                <button type="button" onClick={() => props.onSource(source.refId)}>{`Open source ${source.refId}`}</button>
              </li>}</For>
            </ul>
          </Show>
        </>}
      </Show>
      <button type="button" disabled={props.topic <= 0} onClick={() => props.onTopic(props.topic - 1)}>{SF_U32_COPY["sf.u32.previousTopic"]}</button>
      <button type="button" disabled={props.topic >= props.review.sections.length - 1} onClick={() => props.onTopic(props.topic + 1)}>{SF_U32_COPY["sf.u32.nextTopic"]}</button>
      <button type="button" disabled={props.updateBusy} onClick={() => props.onUpdate()}>{SF_U32_COPY["sf.u32.checkUpdates"]}</button>
    </section>
  )
}
