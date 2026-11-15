import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { reviewReadState, type PreservedReview } from "../preserved/model"
import "./reports.css"

type Format = "docx" | "pptx"
type Year = "2024" | "2025" | "2026" | "2027"
const YEARS: readonly Year[] = ["2024", "2025", "2026", "2027"]
const key = (value: string) => value as SfCopyKey

/**
 * UI50: the installed source only prepares an HTML Generate Report workspace.
 * The frozen A07 Office codecs are Schema.Never and return contract-unavailable.
 * Never convert that response to a download or fabricate a success receipt.
 */
export function SfReportsView(props: SfSurfaceProps<"UI50">) {
  const owner = useSfContext()
  const language = useLanguage()
  const uid = createUniqueId()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    readState: "loading" as SfUiState,
    review: undefined as PreservedReview | undefined,
    selected: [] as string[],
    year: "2026" as Year,
    format: "docx" as Format,
    title: "",
    operationState: "idle" as "idle" | "preparing" | "unavailable" | "outcome-unknown",
    retry: 0,
  })
  const ref = () => props.route.kind === "entry" ? props.route.params.reviewRef : undefined
  const sameOwner = (generation: number, ownerKey: string) =>
    owner.generation() === generation && owner.state().status === "ready" && owner.state().ownerKey === ownerKey
  const exportAdmitted = () => {
    const access = owner.ready()
    const id = store.format === "docx" ? "reviews.export.docx" : "reviews.export.pptx"
    return access?.context.availability.some((resource) =>
      resource.family === "reviews" && resource.resource === "report-export" &&
      resource.operations.some((item) => item.operationId === id && item.state === "ready")) ?? false
  }
  createEffect(() => {
    const generation = owner.generation()
    const state = owner.state(), access = owner.ready(), reviewRef = ref()
    store.retry
    const controller = new AbortController()
    setStore({
      review: undefined, selected: [], operationState: "idle",
      readState: state.status === "denied" ? "denied"
        : state.status === "unauthenticated" ? "session-expired"
        : state.status === "context-mismatch" ? "invalid"
        : state.status === "ready" || state.status === "resolving" ? "loading" : "unavailable",
    })
    if (state.status === "ready" && access && reviewRef) {
      void (async () => {
        try {
          const result = await createSfReviewsClient(access.transport)["dashboard.dashboard-review"](
            { id: reviewRef }, { signal: controller.signal },
          )
          if (controller.signal.aborted || !sameOwner(generation, state.ownerKey)) return
          if (result.kind === "response" && result.body.status === "ok") {
            const value = result.body.value
            if (value.id !== reviewRef) { setStore("readState", "invalid"); return }
            const topics = value.sections.map((section) => section.title)
            const valid = topics.length <= 40 && new Set(topics).size === topics.length &&
              topics.every((topic) => !!topic.trim() && topic.length <= 120)
            const year = YEARS.find((candidate) => candidate === value.sections[0]?.period.start.slice(0, 4)) ?? store.year
            setStore({ review: value, readState: "ready", selected: valid ? topics : [], year })
          } else setStore({ review: undefined, readState: reviewReadState(result) })
        } catch (error) {
          if (controller.signal.aborted || !sameOwner(generation, state.ownerKey)) return
          console.error("Sucafina report source read failed", error instanceof Error ? error.name : "unknown")
          setStore({ review: undefined, readState: "unavailable" })
        }
      })()
    } else if (state.status === "ready" && !reviewRef) setStore("readState", "unavailable")
    onCleanup(() => controller.abort())
  })
  const validSelection = () => !!store.review && store.selected.length >= 1 &&
    store.selected.length <= 40 && new Set(store.selected).size === store.selected.length &&
    store.selected.every((topic) => !!topic.trim() && topic.length <= 120 &&
      store.review!.sections.some((section) => section.title === topic)) &&
    store.title.length <= 200
  const requestReport = async () => {
    const access = owner.ready(), state = owner.state()
    if (!access || state.status !== "ready" || !exportAdmitted() || !validSelection() ||
        store.operationState === "preparing" || store.operationState === "outcome-unknown") return
    const generation = owner.generation(), ownerKey = state.ownerKey
    const controller = new AbortController()
    const input = { year: store.year, topic: [...store.selected], ...(store.title ? { title: store.title } : {}) }
    setStore("operationState", "preparing")
    try {
      const client = createSfReviewsClient(access.transport)
      const result = store.format === "docx"
        ? await client["reviews.export.docx"](input, { signal: controller.signal })
        : await client["reviews.export.pptx"](input, { signal: controller.signal })
      if (!sameOwner(generation, ownerKey)) return
      // Even a JSON success is not Office bytes; output schemas currently forbid
      // reporting success. Only an integrated F01/download-handler can do so.
      setStore("operationState", result.kind === "transport-error" && result.reason === "outcome-unknown"
        ? "outcome-unknown" : "unavailable")
    } catch (error) {
      if (!sameOwner(generation, ownerKey)) return
      console.error("Sucafina Office report preparation failed", error instanceof Error ? error.name : "unknown")
      setStore("operationState", "unavailable")
    }
  }
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
                  onChange={(event) => {
                    setStore("format", event.currentTarget.value === "pptx" ? "pptx" : "docx")
                    setStore("operationState", "idle")
                  }}>
                  <option value="docx">{t("sf.u33.docx")}</option>
                  <option value="pptx">{t("sf.u33.pptx")}</option>
                </select>
              </label>
              <label class="sf-n28-field" for={uid + "-year"}>{t("sf.u33.year")}
                <select id={uid + "-year"} value={store.year} onChange={(event) => {
                  const next = YEARS.find((year) => year === event.currentTarget.value)
                  if (next) { setStore("year", next); setStore("operationState", "idle") }
                }}><For each={YEARS}>{(year) => <option value={year}>{year}</option>}</For></select>
              </label>
              <label class="sf-n28-field" for={uid + "-title"}>{t("sf.u33.title")}
                <input id={uid + "-title"} maxlength="200" value={store.title}
                  onInput={(event) => {
                    setStore("title", event.currentTarget.value)
                    setStore("operationState", "idle")
                  }} />
              </label>
            </div>
            <section class="sf-n28-section" aria-label={t("sf.u33.contents")}>
              <h2>{t("sf.u33.contents")}</h2>
              <p>{t("sf.u33.limit")}</p>
              <ul class="sf-n28-items">
                <For each={review().sections}>{(section) => <li class="mx-card" data-section-id={section.id}>
                  <label>
                    <input type="checkbox" checked={store.selected.includes(section.title)}
                      disabled={store.operationState === "preparing" || store.operationState === "outcome-unknown" ||
                        section.title.length > 120}
                      onChange={(event) => {
                        const title = section.title, checked = event.currentTarget.checked
                        setStore("selected", (items) => checked
                          ? items.includes(title) ? items : [...items, title]
                          : items.filter((item) => item !== title))
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
                <p>{t("sf.u33.noReceipt")}</p>
              </Show>
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
