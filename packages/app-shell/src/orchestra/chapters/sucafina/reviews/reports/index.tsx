import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { beginReportRecovery, clearReportMarker, readReportMarker, readReportRecovery,
  reportMarkerScope, runReportRecovery, writeReportMarker } from "./recovery"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { readPreservedProjection, reviewReadState, type PreservedReview } from "../preserved/model"
import { PeriodText, WhenText } from "../labels"
import { SfOpenReviewReference } from "../open-reference"
import "./reports.css"
import "../workflows.css"

type Format = "docx" | "pptx"
const key = (value: string) => value as SfCopyKey

export function SfReportsView(props: SfSurfaceProps<"UI50">) {
  const owner = useSfContext()
  const language = useLanguage()
  const platform = usePlatform()
  const uid = createUniqueId()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    readState: "loading" as SfUiState,
    review: undefined as PreservedReview | undefined,
    selected: [] as string[],
    format: "docx" as Format,
    busy: false,
    markerScope: "",
    marker: undefined as string | null | undefined,
    retry: 0,
  })
  let requestAbort: AbortController | undefined
  const ref = () => props.route.kind === "entry" ? props.route.params.reviewRef : undefined
  const sameOwner = (generation: number, ownerKey: string) => {
    const state = owner.state()
    return owner.generation() === generation && state.status === "ready" && state.ownerKey === ownerKey
  }
  const recovery = () => {
    const access = owner.ready()
    return access ? readReportRecovery(access.drafts) : undefined
  }
  const operationState = () => {
    if (store.busy) return "preparing"
    const intent = recovery()
    if (intent?.reason === "outcome-unknown") return "outcome-unknown"
    if (intent?.artifactRef) return "unavailable"
    if (intent || typeof store.marker === "string") return "outcome-unknown"
    return store.marker === undefined ? "unavailable" : "idle"
  }
  const coverageOwned = (review: PreservedReview) => {
    const stamp = owner.ready()?.context.stamp
    return !!stamp && review.sections.length > 0 && review.sections.every((section) => {
      const projection = readPreservedProjection(section.content)
      return !!projection && projection.context.installationId === stamp.installationId &&
        projection.context.projectId === stamp.projectId && projection.context.principalRef === stamp.principalRef &&
        projection.context.accessRevision === stamp.accessRevision && projection.context.policyVersion === stamp.policyVersion
    })
  }
  const exportAdmitted = () => {
    const access = owner.ready()
    return !!access?.context.availability.some((resource) =>
      resource.family === "reviews" && resource.resource === "report-export" &&
      resource.operations.some((item) => item.operationId === "reviews.report.prepare" && item.state === "ready" && item.operational)) &&
      !!access?.context.availability.some((resource) => resource.family === "files" && resource.resource === "exports" &&
        resource.operations.some((item) => item.operationId === "files.export.review" && item.state === "ready" && item.operational))
  }
  const sameRecoveryOwner = () => {
    const state = owner.state(), access = owner.ready(), intent = recovery()
    return !!intent && !!access && state.status === "ready" && !!store.markerScope &&
      intent.ownerScope === store.markerScope && intent.payload.reviewRef === ref()
  }
  const canRecover = () => sameRecoveryOwner() && !!store.markerScope && store.marker === recovery()?.idempotencyKey
  const storage = () => {
    try { return window.localStorage } catch { return undefined }
  }
  createEffect(() => {
    const state = owner.state(), access = owner.ready()
    setStore({ markerScope: "", marker: undefined })
    if (state.status !== "ready" || !access) return
    let alive = true
    onCleanup(() => { alive = false })
    void reportMarkerScope(state.owner).then((scope) => {
      if (!alive) return
      const saved = storage()
      setStore({ markerScope: scope, marker: saved ? readReportMarker(saved, scope) : undefined })
    }).catch(() => { if (alive) setStore({ markerScope: "", marker: undefined }) })
  })
  createEffect(() => {
    const generation = owner.generation()
    const state = owner.state(), access = owner.ready(), reviewRef = ref()
    store.retry
    const controller = new AbortController()
    setStore({
      review: undefined, selected: [],
      readState: state.status === "denied" ? "denied"
        : state.status === "unauthenticated" ? "session-expired"
        : state.status === "context-mismatch" ? "invalid"
        : state.status === "ready" || state.status === "resolving" ? "loading" : "unavailable",
    })
    if (state.status === "ready" && access && reviewRef) {
      const stamp = JSON.stringify(access.context.stamp)
      const currentRead = () => !controller.signal.aborted && sameOwner(generation, state.ownerKey) &&
        owner.ready()?.transport === access.transport && JSON.stringify(owner.ready()?.context.stamp) === stamp
      void (async () => {
        try {
          const result = await createSfReviewsClient(access.transport)["dashboard.dashboard-review"](
            { id: reviewRef }, { signal: controller.signal },
          )
          if (!currentRead()) return
          if (result.kind === "response" && result.body.status === "ok") {
            const value = result.body.value
            if (value.id !== reviewRef) { setStore("readState", "invalid"); return }
            const sections = value.sections.map((section) => section.id)
            const valid = sections.length <= 40 && new Set(sections).size === sections.length &&
              sections.every((id) => !!id.trim() && id.length <= 16384)
            const pending = recovery()
            setStore({ review: value, readState: "ready", selected: pending
              ? sameRecoveryOwner() ? [...pending.payload.sectionRefs] : []
              : valid ? sections : [],
              ...(pending && sameRecoveryOwner() ? { format: pending.payload.format } : {}) })
          } else setStore({ review: undefined, readState: reviewReadState(result) })
        } catch (error) {
          if (!currentRead()) return
          console.error("Sucafina report source read failed", error instanceof Error ? error.name : "unknown")
          setStore({ review: undefined, readState: "unavailable" })
        }
      })()
    } else if (state.status === "ready" && !reviewRef) setStore("readState", "unavailable")
    onCleanup(() => controller.abort())
  })
  createEffect(() => {
    owner.generation()
    owner.state()
    onCleanup(() => requestAbort?.abort())
  })
  createEffect(() => {
    const pending = recovery(), review = store.review
    if (!pending || !review || !sameRecoveryOwner() || review.id !== pending.payload.reviewRef) return
    setStore({ selected: [...pending.payload.sectionRefs], format: pending.payload.format })
  })
  const reportBlocked = () => !store.review || !exportAdmitted() || store.busy || !store.markerScope ||
    (recovery() ? !canRecover() : store.marker !== null || !validSelection())
  const validSelection = () => !!store.review && store.selected.length >= 1 &&
    store.selected.length <= 40 && new Set(store.selected).size === store.selected.length &&
    store.selected.every((id) => !!id.trim() && id.length <= 16384 &&
      store.review!.sections.some((section) => section.id === id))
  const requestReport = async () => {
    const access = owner.ready(), state = owner.state()
    if (!access || state.status !== "ready" || !exportAdmitted() || store.busy || !store.review || !store.markerScope) return
    const saved = storage(), scope = store.markerScope
    if (!saved) return
    const generation = owner.generation(), ownerKey = state.ownerKey
    const stamp = JSON.stringify(access.context.stamp)
    const existing = readReportRecovery(access.drafts)
    if (existing && (!canRecover() || readReportMarker(saved, scope) !== existing.idempotencyKey)) return
    if (!existing && !validSelection()) return
    const idempotencyKey = existing?.idempotencyKey ?? crypto.randomUUID()
    if (!existing && (store.marker !== null || !writeReportMarker(saved, scope, idempotencyKey))) return
    if (!existing) setStore("marker", idempotencyKey)
    const intent = existing ?? beginReportRecovery(access.drafts, { ownerScope: scope, idempotencyKey,
      payload: { reviewRef: store.review.id, sectionRefs: [...store.selected], format: store.format } })
    if (!intent) return
    requestAbort?.abort()
    const controller = new AbortController()
    requestAbort = controller
    const current = () => {
      const next = owner.ready()
      return !controller.signal.aborted && sameOwner(generation, ownerKey) && !!next &&
        next.transport === access.transport && next.drafts === access.drafts && ref() === intent.payload.reviewRef &&
        JSON.stringify(next.context.stamp) === stamp && store.markerScope === scope &&
        readReportMarker(saved, scope) === intent.idempotencyKey && exportAdmitted()
    }
    setStore("busy", true)
    try {
      await runReportRecovery({ drafts: access.drafts, transport: access.transport, signal: controller.signal,
        current, principalRef: access.context.stamp.principalRef, accessRevision: access.context.stamp.accessRevision,
        onDownloaded: (key) => {
          const cleared = clearReportMarker(saved, scope, key)
          if (cleared) setStore("marker", null)
          return cleared
        },
        downloadResponse: platform.downloadResponse })
    } finally {
      if (requestAbort === controller) { requestAbort = undefined; setStore("busy", false) }
    }
  }
  onCleanup(() => requestAbort?.abort())
  return (
    <SfPageFrame titleKey={key("sf.ui50.title")} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={ref() ? {
        id: "report", labelKey: key(recovery() ? "sf.common.retry" : "sf.ui50.primary"), tone: "primary",
        disabled: reportBlocked(),
        busy: store.busy, onInvoke: () => { void requestReport() },
      } : undefined}
    >
      <div data-sf-wave="polish" class="sf-n28 sf-workflow" data-sf-surface="UI50" data-export-state={operationState()}>
        <Show when={recovery()?.reason === "outcome-unknown" || (typeof store.marker === "string" && !recovery())}>
          <p role="alert">{t("sf.u33.unknown")}</p>
        </Show>
        <Show when={!ref() && owner.ready()}><SfOpenReviewReference route={props.route} destination="reports" /></Show>
        <SfStatePanel state={store.readState}
          messageKey={key(recovery() || typeof store.marker === "string" ? "sf.common.unavailable" :
            !ref() ? "sf.u33.noReview" : "sf.u33.unavailable")}
          onRetryRead={ref() ? () => setStore("retry", (count) => count + 1) : undefined}>
          <Show when={store.review}>{(review) => <section class="sf-n28-section sf-section" data-preserved-review={review().id}>
            <div class="sf-n28-summary mx-card sf-section">
              <dl class="sf-metadata">
                <div><dt>{t("sf.u33.coverage")}</dt><dd>{t(coverageOwned(review()) ? "sf.u33.available" : "sf.u33.unavailable")}</dd></div>
                <div><dt>{t("sf.u33.selected")}</dt><dd>{store.selected.length} / {review().sections.length}</dd></div>
              </dl>
              <details class="sf-technical-details">
                <summary>{t("sf.u33.review")}</summary>
                <code>{review().id}</code>
              </details>
            </div>
            <div class="sf-n28-form sf-form sf-fields">
              <label class="sf-n28-field" for={uid + "-format"}>{t("sf.u33.format")}
                <select id={uid + "-format"} value={store.format}
                  disabled={store.busy || !!recovery() || store.marker !== null}
                  onChange={(event) => {
                    if (store.busy || recovery() || store.marker !== null) return
                    setStore("format", event.currentTarget.value === "pptx" ? "pptx" : "docx")
                  }}>
                  <option value="docx">{t("sf.u33.docx")}</option>
                  <option value="pptx">{t("sf.u33.pptx")}</option>
                </select>
              </label>
            </div>
            <section class="sf-n28-section sf-section" aria-label={t("sf.u33.contents")}>
              <h2>{t("sf.u33.contents")}</h2>
              <ul class="sf-n28-items">
                <For each={review().sections}>{(section) => <li class="mx-card" data-section-id={section.id} data-source-record-count={section.count}>
                  <label>
                    <input type="checkbox" checked={store.selected.includes(section.id)}
                      disabled={store.busy || !!recovery() || store.marker !== null ||
                        section.id.length > 16384}
                      onChange={(event) => {
                        if (store.busy || recovery() || store.marker !== null) return
                        const selected = new Set(store.selected)
                        if (event.currentTarget.checked) selected.add(section.id)
                        else selected.delete(section.id)
                        setStore("selected", review().sections.map((item) => item.id).filter((id) => selected.has(id)))
                      }} />
                    <span> {t("sf.u33.include")}: <strong>{section.title}</strong></span>
                  </label>
                  <span>{t("sf.u33.records")}: {section.count}</span>
                  <span>{t("sf.u33.period")}: <PeriodText start={section.period.start} end={section.period.end} /></span>
                  <span>{t("sf.u33.sources")}: {section.sourceRefs.length}</span>
                </li>}</For>
              </ul>
              <Show when={!store.selected.length}><p>{t("sf.u33.noSections")}</p></Show>
            </section>
            <section class="sf-n28-section sf-section" aria-label={t("sf.u33.comments")}>
              <h2>{t("sf.u33.comments")}</h2>
              <p>{t("sf.u33.longNotes")}</p>
              <div class="sf-n28-notes">
                <For each={review().comments}>{(comment) => <article class="mx-card">
                  <p>{comment.content}</p>
                  <small>{comment.authorRef} · <WhenText iso={comment.createdAt} /></small>
                </article>}</For>
              </div>
            </section>
            <section class="sf-n28-section sf-section" aria-label={t("sf.u33.download")}>
              <h2>{t("sf.u33.download")}</h2>
              <Show when={recovery()?.reason !== "outcome-unknown" && (!exportAdmitted() || store.marker !== null || !!recovery() && !store.busy)}>
                <p role="status" data-sf-file-unavailable>{t("sf.common.unavailable")}</p>
              </Show>
              <For each={canRecover() ? recovery()?.gaps ?? [] : []}>{() => <p>{t("sf.u32.declaredGaps")}</p>}</For>
              <Show when={store.busy}>
                <p role="status" aria-live="polite">{t("sf.u33.preparing")}</p>
              </Show>
            </section>
          </section>}</Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
