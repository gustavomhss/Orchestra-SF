import { A } from "@solidjs/router"
import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U32_COPY } from "@/i18n/orchestra-chapters/sf-u32"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import type { SfReviewUpdate } from "@orchestra/schema/sucafina/reviews"
import type { Schema } from "effect"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { preservedMeetingLine, readPreservedProjection, reviewReadState, type PreservedReview, type ReviewProjection } from "./model"
import { SfPreservedAnswer } from "./answer"
import { AmountText, operationGranted, PeriodText, StatusText, WhenText } from "../labels"
import { encodeSfRouteRef } from "../../navigation-state"
import "./preserved.css"

const key = (value: string) => value as SfCopyKey
const samePeriod = (a: { start: string; end: string }, b: typeof a) => a.start === b.start && a.end === b.end
type RevisionPreview = { selectionRef: string; sections: readonly { id: string; title: string; recordCount: number; projection: ReviewProjection }[] }

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
    successor: undefined as Schema.Schema.Type<typeof SfReviewUpdate> | undefined,
    revision: undefined as RevisionPreview | undefined,
    revisionRef: undefined as string | undefined,
  })
  const ref = () => props.route.kind === "entry" || props.route.kind === "present"
    ? props.route.params.reviewRef : undefined
  let successorAbort: AbortController | undefined
  let sourceAbort: AbortController | undefined
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
      review: undefined, successor: undefined, revision: undefined, revisionRef: undefined, topic: 0, sourceLinks: [], updateStatus: "ready",
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
    if (!active || state.status !== "ready" || !review) return
    const generation = owner.generation()
    const controller = new AbortController()
    sourceAbort?.abort()
    sourceAbort = controller
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
  const revisionLocked = () => store.updateStatus === "loading" || store.updateStatus === "outcome-unknown" || !!store.revisionRef
  const granted = (operationId: string) => operationGranted(owner.ready()?.context, operationId, { family: "reviews", resource: "preserved" })
  const reportHref = () => {
    const state = owner.state(), active = owner.ready(), review = store.review
    if (state.status !== "ready" || !active || store.status !== "ready" || !review || review.id !== ref() || store.presenting) return
    const { serverKey, projectId, installationId } = props.route.ownerSelection
    if (!serverKey || !projectId || !installationId || state.selection.serverKey !== serverKey ||
      state.selection.projectId !== projectId || state.selection.installationId !== installationId) return
    if (!operationGranted(active.context, "dashboard.dashboard-review", { family: "reviews" }) ||
      !operationGranted(active.context, "reviews.report.prepare", { family: "reviews", resource: "report-export" }) ||
      !operationGranted(active.context, "files.export.review", { family: "files", resource: "exports" })) return
    return `/orchestra/sf-reviews/reports/${encodeSfRouteRef(review.id)}?` +
      new URLSearchParams({ server: serverKey, project: projectId, installation: installationId }).toString()
  }
  const update = async () => {
    const active = owner.ready(), state = owner.state(), review = store.review
    if (!active || state.status !== "ready" || !review || revisionLocked()) return
    const generation = owner.generation()
    successorAbort?.abort()
    const controller = new AbortController()
    successorAbort = controller
    setStore({ updateStatus: "loading", successor: undefined, revision: undefined })
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
  const exact = () => {
    const next = store.successor, review = store.review
    if (!review || review.comments.length || !next?.available || next.confirmations.length || next.unavailableSections.length ||
        next.items.length !== review.sections.length || next.items.length === 0) return undefined
    const sections = next.items.flatMap((item, index) => {
      const prior = review.sections[index]!
      return item.id === prior.id && samePeriod(item.period, prior.period) && item.agendaNote === undefined &&
        item.recordRefs?.length === prior.count && new Set(item.recordRefs).size === prior.count
        ? [{ id: item.id, title: prior.title, topic: item.topic, period: item.period, selectionRef: item.selectionRef, recordRefs: item.recordRefs }]
        : []
    })
    return sections.length === review.sections.length ? sections : undefined
  }
  const prepareRevision = async () => {
    const active = owner.ready(), state = owner.state(), sections = exact()
    if (!active || state.status !== "ready" || !sections || revisionLocked() || !granted("dashboard.dashboard-agenda")) return
    const generation = owner.generation(), controller = new AbortController()
    successorAbort = controller
    setStore({ updateStatus: "loading", revision: undefined })
    try {
      const result = await createSfReviewsClient(active.transport)["dashboard.dashboard-agenda"]({ sections }, { signal: controller.signal })
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        const status = reviewReadState(result)
        if (status === "denied") setStore({ status: "denied", review: undefined })
        setStore({ updateStatus: status, successor: undefined })
        return
      }
      const preview = result.body.value
      if (preview.sections.length !== sections.length || preview.sections.some((section, index) => {
        const expected = sections[index]!
        return section.id !== expected.id || section.title !== expected.title || !samePeriod(section.period, expected.period) ||
          section.recordCount !== expected.recordRefs.length || section.recordRefs.length !== expected.recordRefs.length ||
          section.recordRefs.some((ref, i) => ref !== expected.recordRefs[i])
      })) {
        setStore({ updateStatus: "stale", successor: undefined })
        return
      }
      setStore({ updateStatus: "ready", revision: preview })
    } catch (error) {
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      console.error("Sucafina successor preview failed", error instanceof Error ? error.name : "unknown")
      setStore({ updateStatus: "unavailable", successor: undefined })
    }
  }
  const preserveRevision = async () => {
    const active = owner.ready(), state = owner.state(), review = store.review, preview = store.revision
    if (!active || state.status !== "ready" || !review || !preview || revisionLocked() || !granted("dashboard.dashboard-review-preserve")) return
    const generation = owner.generation(), controller = new AbortController()
    successorAbort = controller
    setStore("updateStatus", "loading")
    try {
      const result = await createSfReviewsClient(active.transport)["dashboard.dashboard-review-preserve"]({
        selectionRef: preview.selectionRef, sectionRefs: preview.sections.map((section) => section.id), previousReviewRef: review.id,
      }, { signal: controller.signal, idempotencyKey: crypto.randomUUID() })
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        const status = result.kind !== "response" || result.status >= 500 ? "outcome-unknown" : reviewReadState(result)
        if (status === "denied") setStore({ status: "denied", review: undefined })
        setStore({ updateStatus: status, revision: undefined, successor: undefined })
        return
      }
      const saved = result.body.value
      // An unexpected success response may still have committed. Do not submit again.
      if (saved.id === review.id || saved.previousReviewRef !== review.id || saved.sections.length !== preview.sections.length ||
          saved.sections.some((section, i) => section.id !== preview.sections[i]!.id || section.count !== preview.sections[i]!.recordCount)) {
        setStore({ updateStatus: "outcome-unknown", revision: undefined, successor: undefined })
        return
      }
      setStore({ updateStatus: "ready", revision: undefined, successor: undefined, revisionRef: saved.id })
    } catch (error) {
      if (controller.signal.aborted || !current(generation, state.ownerKey)) return
      console.error("Sucafina successor preservation outcome uncertain", error instanceof Error ? error.name : "unknown")
      setStore({ updateStatus: "outcome-unknown", revision: undefined, successor: undefined })
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
                <Show when={reportHref()}>{(href) => <A class="mx-btn" href={href()}>{t("sf.u32.openReport")}</A>}</Show>
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
                 updateBusy={revisionLocked()}
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
                   disabled={revisionLocked() || store.status !== "ready"}>{t("sf.u32.update")}</button>
              </div>
              <Show when={store.successor}>
                {(next) => <section class="mx-card sf-n28-section" data-sf-successor-availability={next().available}>
                   <p role="status">{t(next().available && !next().unavailableSections.length ? "sf.u32.updateReady" : "sf.u32.updateBlocked")}</p>
                  <h3>{t("sf.u32.confirmations")}</h3>
                  <ul><For each={next().confirmations}>{(item) => <li>{item.label}</li>}</For></ul>
                  <h3>{t("sf.u32.unavailableSections")}</h3>
                   <ul><For each={next().unavailableSections}>{(item) => <li><strong>{item.title}</strong>: <StatusText value={item.reason} /></li>}</For></ul>
                   <Show when={exact() && !store.revision && !store.revisionRef}>
                     <button type="button" class="mx-btn" disabled={revisionLocked() || !granted("dashboard.dashboard-agenda")}
                       onClick={() => { void prepareRevision() }}>{t("sf.u32.prepareRevision")}</button>
                   </Show>
                 </section>}
               </Show>
               <Show when={store.revision}>
                 {(preview) => <section class="mx-card sf-n28-section" aria-label={t("sf.u32.revisionPreview")}>
                   <h3>{t("sf.u32.revisionPreview")}</h3>
                   <For each={preview().sections}>{(section) => <details data-revision-section={section.id}>
                     <summary>{section.title}</summary>
                     <p>{t("sf.u32.records")}: {section.recordCount}</p>
                     <dl class="sf-n28-values"><For each={section.projection.values}>{(value) => <div>
                       <dt>{value.id}</dt><dd><AmountText value={value.value} currency={value.currency} /> <PeriodText {...value.period} /></dd>
                     </div>}</For></dl>
                   </details>}</For>
                   <button type="button" class="mx-btn" disabled={revisionLocked() || !granted("dashboard.dashboard-review-preserve")}
                     onClick={() => { void preserveRevision() }}>{t("sf.u25.confirm")}</button>
                 </section>}
               </Show>
               <Show when={store.revisionRef}>{(reference) => <section class="mx-card sf-n28-section" data-sf-revision-confirmed>
                 <p role="status">{t("sf.u25.created")}</p>
                 <a href={`/orchestra/sf-reviews/reviews/${encodeSfRouteRef(reference())}?` + new URLSearchParams({
                   server: props.route.ownerSelection.serverKey ?? "", project: props.route.ownerSelection.projectId ?? "",
                   installation: props.route.ownerSelection.installationId ?? "",
                 }).toString()}>{t("sf.u25.openPreserved")}</a>
               </section>}</Show>
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
