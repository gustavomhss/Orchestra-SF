import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { downloadReviewReport } from "./download"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { reviewReadState, type PreservedReview } from "../preserved/model"
import "./reports.css"

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
    operationState: "idle" as "idle" | "preparing" | "unavailable" | "outcome-unknown",
    operationReason: "",
    gaps: [] as string[],
    retry: 0,
  })
  let requestAbort: AbortController | undefined
  const ref = () => props.route.kind === "entry" ? props.route.params.reviewRef : undefined
  const sameOwner = (generation: number, ownerKey: string) =>
    owner.generation() === generation && owner.state().status === "ready" && owner.state().ownerKey === ownerKey
  const exportAdmitted = () => {
    const access = owner.ready()
    return !!access?.context.availability.some((resource) =>
      resource.family === "reviews" && resource.resource === "report-export" &&
      resource.operations.some((item) => item.operationId === "reviews.report.prepare" && item.state === "ready" && item.operational)) &&
      !!access?.context.availability.some((resource) => resource.family === "files" && resource.resource === "exports" &&
        resource.operations.some((item) => item.operationId === "files.export.review" && item.state === "ready" && item.operational))
  }
  createEffect(() => {
    const generation = owner.generation()
    const state = owner.state(), access = owner.ready(), reviewRef = ref()
    store.retry
    const controller = new AbortController()
    requestAbort?.abort()
    setStore({
      review: undefined, selected: [], operationState: "idle", operationReason: "", gaps: [],
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
            setStore({ review: value, readState: "ready", selected: valid ? sections : [] })
          } else setStore({ review: undefined, readState: reviewReadState(result) })
        } catch (error) {
          if (!currentRead()) return
          console.error("Sucafina report source read failed", error instanceof Error ? error.name : "unknown")
          setStore({ review: undefined, readState: "unavailable" })
        }
      })()
    } else if (state.status === "ready" && !reviewRef) setStore("readState", "unavailable")
    onCleanup(() => { controller.abort(); requestAbort?.abort() })
  })
  const validSelection = () => !!store.review && store.selected.length >= 1 &&
    store.selected.length <= 40 && new Set(store.selected).size === store.selected.length &&
    store.selected.every((id) => !!id.trim() && id.length <= 16384 &&
      store.review!.sections.some((section) => section.id === id))
  const requestReport = async () => {
    const access = owner.ready(), state = owner.state()
    if (!access || state.status !== "ready" || !exportAdmitted() || !validSelection() ||
        store.operationState === "preparing" || store.operationState === "outcome-unknown") return
    const generation = owner.generation(), ownerKey = state.ownerKey
    const stamp = JSON.stringify(access.context.stamp)
    const format = store.format, reviewRef = store.review!.id, sectionRefs = [...store.selected]
    requestAbort?.abort()
    const controller = new AbortController()
    requestAbort = controller
    const current = () => {
      const next = owner.ready()
      return !controller.signal.aborted && sameOwner(generation, ownerKey) && !!next &&
        next.transport === access.transport && JSON.stringify(next.context.stamp) === stamp && exportAdmitted()
    }
    setStore({ operationState: "preparing", operationReason: "", gaps: [] })
    try {
      const client = createSfReviewsClient(access.transport)
      const result = await client["reviews.report.prepare"]({ reviewRef, sectionRefs, format },
        { signal: controller.signal, idempotencyKey: crypto.randomUUID() })
      if (!current()) return
      if (result.kind !== "response") {
        setStore({ operationState: result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable", operationReason: result.reason })
        return
      }
      if (result.body.status !== "ok") {
        setStore({ operationState: "unavailable", operationReason: result.body.status + ": " + result.body.reason })
        return
      }
      const prepared = result.body
      if (result.status !== 200 || prepared.result.reviewSelectionRef !== reviewRef ||
          prepared.result.orderedResultRefs.length !== 1 || prepared.result.orderedResultRefs[0] !== prepared.outputRef ||
          !/^report:[a-f0-9]{64}$/.test(prepared.outputRef) ||
          prepared.receipt.operation !== "sf_report_prepare" ||
          prepared.receipt.accessRevision !== access.context.stamp.accessRevision ||
          prepared.receipt.principalRef !== access.context.stamp.principalRef ||
          prepared.result.coverage.length !== sectionRefs.length ||
          prepared.result.coverage.some((item, index) => item.sectionRef !== sectionRefs[index])) {
        setStore({ operationState: "unavailable", operationReason: "contract-mismatch" })
        return
      }
      setStore("gaps", prepared.result.gaps.map((gap) => gap.reason))
      await downloadReviewReport({ transport: access.transport, artifactRef: prepared.outputRef, format,
        signal: controller.signal, current, downloadResponse: platform.downloadResponse })
      if (current()) setStore("operationState", "idle")
    } catch (error) {
      if (!current()) return
      console.error("Sucafina Office report preparation failed", error instanceof Error ? error.name : "unknown")
      setStore({ operationState: "unavailable", operationReason: "" })
    }
  }
  onCleanup(() => requestAbort?.abort())
  return (
    <SfPageFrame titleKey={key("sf.ui50.title")} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={{
        id: "report", labelKey: key("sf.ui50.primary"), tone: "primary",
        disabled: !validSelection() || !exportAdmitted() || store.operationState === "preparing" ||
          store.operationState === "outcome-unknown",
        busy: store.operationState === "preparing", onInvoke: () => { void requestReport() },
      }}
    >
      <div class="sf-n28" data-sf-surface="UI50" data-export-state={store.operationState}>
        <SfStatePanel state={store.readState}
          messageKey={key(!ref() ? "sf.u33.noReview" : "sf.u33.unavailable")}
          onRetryRead={() => setStore("retry", (count) => count + 1)}>
          <Show when={store.review}>{(review) => <section class="sf-n28-section" data-preserved-review={review().id}>
            <dl class="sf-n28-summary mx-card">
              <div><dt>{t("sf.u33.review")}</dt><dd>{review().id}</dd></div>
              <div><dt>{t("sf.u33.coverage")}</dt><dd>{t("sf.u33.available")}</dd></div>
              <div><dt>{t("sf.u33.selected")}</dt><dd>{store.selected.length} / {review().sections.length}</dd></div>
            </dl>
            <div class="sf-n28-form">
              <label class="sf-n28-field" for={uid + "-format"}>{t("sf.u33.format")}
                <select id={uid + "-format"} value={store.format}
                  disabled={store.operationState === "preparing" || store.operationState === "outcome-unknown"}
                  onChange={(event) => {
                    setStore("format", event.currentTarget.value === "pptx" ? "pptx" : "docx")
                    setStore("operationState", "idle")
                  }}>
                  <option value="docx">{t("sf.u33.docx")}</option>
                  <option value="pptx">{t("sf.u33.pptx")}</option>
                </select>
              </label>
              <label class="sf-n28-field" for={uid + "-title"}>{t("sf.u33.title")}
                <input id={uid + "-title"} value={`Review ${review().id}`} readOnly />
              </label>
            </div>
            <section class="sf-n28-section" aria-label={t("sf.u33.contents")}>
              <h2>{t("sf.u33.contents")}</h2>
              <p>{t("sf.u33.limit")}</p>
              <ul class="sf-n28-items">
                <For each={review().sections}>{(section) => <li class="mx-card" data-section-id={section.id} data-source-record-count={section.count}>
                  <label>
                    <input type="checkbox" checked={store.selected.includes(section.id)}
                      disabled={store.operationState === "preparing" || store.operationState === "outcome-unknown" ||
                        section.id.length > 16384}
                      onChange={(event) => {
                        const selected = new Set(store.selected)
                        if (event.currentTarget.checked) selected.add(section.id)
                        else selected.delete(section.id)
                        setStore("selected", review().sections.map((item) => item.id).filter((id) => selected.has(id)))
                        setStore("operationState", "idle")
                      }} />
                    <span> {t("sf.u33.include")}: <strong>{section.title}</strong></span>
                  </label>
                  <span>{t("sf.u33.records")}: {section.count}</span>
                  <span>{t("sf.u33.period")}: {section.period.start} – {section.period.end}</span>
                  <span>{t("sf.u33.sources")}: {section.sourceRefs.length}</span>
                </li>}</For>
              </ul>
              <Show when={!store.selected.length}><p>{t("sf.u33.noSections")}</p></Show>
            </section>
            <section class="sf-n28-section" aria-label={t("sf.u33.comments")}>
              <h2>{t("sf.u33.comments")}</h2>
              <p>{t("sf.u33.longNotes")}</p>
              <div class="sf-n28-notes">
                <For each={review().comments}>{(comment) => <article class="mx-card">
                  <p>{comment.content}</p>
                  <small>{comment.authorRef} · <time dateTime={comment.createdAt}>{comment.createdAt}</time></small>
                </article>}</For>
              </div>
            </section>
            <section class="sf-n28-section" aria-label={t("sf.u33.download")}>
              <h2>{t("sf.u33.download")}</h2>
              <Show when={!exportAdmitted() || store.operationState === "unavailable"}>
                <p role="status" data-sf-file-unavailable>{t("sf.u33.notAvailable")}</p>
                <Show when={store.operationReason}><p>{store.operationReason}</p></Show>
              </Show>
              <For each={store.gaps}>{(gap) => <p>{gap}</p>}</For>
              <Show when={store.operationState === "preparing"}>
                <p role="status" aria-live="polite">{t("sf.u33.preparing")}</p>
              </Show>
              <Show when={store.operationState === "outcome-unknown"}>
                <p role="alert">{t("sf.u33.unknown")}</p>
              </Show>
            </section>
          </section>}</Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
