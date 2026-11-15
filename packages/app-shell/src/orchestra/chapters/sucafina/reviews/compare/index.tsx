import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { comparableReviewSections, preservedValueRows, reviewReadState, type PreservedReview } from "../preserved/model"
import "../preserved/preserved.css"

const key = (value: string) => value as SfCopyKey

/** UI49: compare independently reauthorized, preserved public material; no domain calculations. */
export function SfReviewCompareView(props: SfSurfaceProps<"UI49">) {
  const owner = useSfContext()
  const language = useLanguage()
  const uid = createUniqueId()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    ownerKey: "",
    previousRef: String(props.route.query.previousReview ?? ""),
    currentRef: String(props.route.query.currentReview ?? ""),
    previous: undefined as PreservedReview | undefined,
    current: undefined as PreservedReview | undefined,
    state: "ready" as SfUiState,
    reason: "",
    busy: false,
    changedOrder: false,
  })
  let inFlight: AbortController | undefined
  const sameOwner = (generation: number, keyValue: string) =>
    owner.generation() === generation && owner.state().status === "ready" && owner.state().ownerKey === keyValue
  const read = async () => {
    const state = owner.state(), access = owner.ready()
    const a = store.previousRef.trim(), b = store.currentRef.trim()
    if (!access || state.status !== "ready" || !a || !b || a === b ||
      a.length > 2048 || b.length > 2048 || store.busy) {
      setStore({ state: "invalid", reason: "sf.u32.choose" })
      return
    }
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller
    const generation = owner.generation(), ownerKey = state.ownerKey
    setStore({ state: "loading", busy: true, previous: undefined, current: undefined, reason: "" })
    try {
      const client = createSfReviewsClient(access.transport)
      const [previousResult, currentResult] = await Promise.all([
        client["dashboard.dashboard-review"]({ id: a }, { signal: controller.signal }),
        client["dashboard.dashboard-review"]({ id: b }, { signal: controller.signal }),
      ])
      if (controller.signal.aborted || !sameOwner(generation, ownerKey)) return
      const statusA = previousResult.kind === "response" && previousResult.body.status === "ok"
      const statusB = currentResult.kind === "response" && currentResult.body.status === "ok"
      if (!statusA || !statusB) {
        const first = statusA ? "ready" : reviewReadState(previousResult)
        const second = statusB ? "ready" : reviewReadState(currentResult)
        setStore({
          state: first === "denied" || second === "denied" ? "denied" :
            first === "stale" || second === "stale" ? "stale" : first !== "ready" ? first : second,
          reason: "sf.u32.reviewUnavailable",
          previous: undefined, current: undefined,
        })
        return
      }
      const previous = previousResult.body.value
      const current = currentResult.body.value
      if (previous.id !== a || current.id !== b) {
        setStore({ state: "invalid", reason: "sf.u32.reviewUnavailable" })
        return
      }
      setStore({
        previous, current, state: "ready", reason: "",
        changedOrder: previous.sections.map((section) => section.id).join("\0") !==
          current.sections.map((section) => section.id).join("\0"),
      })
    } catch (error) {
      if (controller.signal.aborted || !sameOwner(generation, ownerKey)) return
      console.error("Sucafina preserved review comparison failed", error instanceof Error ? error.name : "unknown")
      setStore({ state: "unavailable", reason: "sf.u32.reviewUnavailable", previous: undefined, current: undefined })
    } finally {
      if (sameOwner(generation, ownerKey)) setStore("busy", false)
    }
  }
  createEffect(() => {
    const generation = owner.generation()
    const state = owner.state()
    if (state.status !== "ready") {
      inFlight?.abort()
      setStore({
        ownerKey: "", previous: undefined, current: undefined, busy: false,
        state: state.status === "denied" ? "denied"
          : state.status === "unauthenticated" ? "session-expired"
          : state.status === "context-mismatch" ? "invalid"
          : state.status === "resolving" ? "loading" : "unavailable",
      })
    } else if (state.ownerKey !== store.ownerKey) {
      inFlight?.abort()
      setStore({
        ownerKey: state.ownerKey, previous: undefined, current: undefined, busy: false, state: "ready",
        previousRef: String(props.route.query.previousReview ?? ""),
        currentRef: String(props.route.query.currentReview ?? ""),
      })
    }
    onCleanup(() => { if (owner.generation() !== generation) inFlight?.abort() })
  })
  onCleanup(() => inFlight?.abort())
  const compatible = () => !!store.previous && !!store.current && comparableReviewSections(store.previous, store.current)
  const changed = () => compatible() && !!store.previous && !!store.current &&
    store.previous.sections.some((before) => {
      const after = store.current!.sections.find((section) => section.id === before.id)
      return !!after && (preservedValueRows(before, after).length > 0 || before.count !== after.count ||
        before.title !== after.title)
    })
  return (
    <SfPageFrame titleKey={key("sf.ui49.title")} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="comparison" onLayoutMode={() => undefined}
      primaryAction={{
        id: "compare", labelKey: key("sf.ui49.primary"), tone: "primary",
        disabled: store.busy || !owner.ready() || !store.previousRef.trim() ||
          !store.currentRef.trim() || store.previousRef === store.currentRef,
        busy: store.busy, onInvoke: () => { void read() },
      }}
    >
      <div class="sf-n28" data-sf-surface="UI49">
        <form class="sf-n28-form" onSubmit={(event) => { event.preventDefault(); void read() }}>
          <label class="sf-n28-field" for={uid + "-previous"}>{t("sf.u32.previous")}
            <input id={uid + "-previous"} required maxlength="2048" autocomplete="off"
              value={store.previousRef} onInput={(event) => setStore({ previousRef: event.currentTarget.value,
                previous: undefined, current: undefined, state: "ready" })} />
          </label>
          <label class="sf-n28-field" for={uid + "-current"}>{t("sf.u32.current")}
            <input id={uid + "-current"} required maxlength="2048" autocomplete="off"
              value={store.currentRef} onInput={(event) => setStore({ currentRef: event.currentTarget.value,
                previous: undefined, current: undefined, state: "ready" })} />
          </label>
          <button class="mx-btn" type="submit" disabled={store.busy || !owner.ready()}>{t("sf.u32.readCompare")}</button>
        </form>
        <SfStatePanel state={store.state} messageKey={key(store.reason || "sf.u32.reviewUnavailable")}
          onRetryRead={() => { void read() }}>
          <Show when={store.previous && store.current}>
            <section data-sf-comparison-compatibility={compatible() ? "compatible" : "incompatible"}>
              <h2>{t(compatible() ? "sf.u32.compatible" : "sf.u32.incompatible")}</h2>
              <dl class="sf-n28-dual">
                <div class="mx-card">
                  <dt>{t("sf.u32.previous")}</dt><dd>{store.previous?.id}</dd>
                  <dt>{t("sf.u32.version")}</dt><dd>{store.previous?.version}</dd>
                  <dt>{t("sf.u32.created")}</dt><dd>{store.previous?.createdAt}</dd>
                </div>
                <div class="mx-card">
                  <dt>{t("sf.u32.current")}</dt><dd>{store.current?.id}</dd>
                  <dt>{t("sf.u32.version")}</dt><dd>{store.current?.version}</dd>
                  <dt>{t("sf.u32.created")}</dt><dd>{store.current?.createdAt}</dd>
                </div>
              </dl>
              <Show when={compatible()}>
                <Show when={store.changedOrder}><p role="status">{t("sf.u32.orderChanged")}</p></Show>
                <h3>{t("sf.u32.diff")}</h3>
                <Show when={changed() || store.changedOrder} fallback={<p>{t("sf.u32.unchanged")}</p>}>
                  <div class="sf-n28-section">
                    <For each={store.previous?.sections}>{(before) => {
                      const after = () => store.current?.sections.find((section) => section.id === before.id)
                      const rows = () => after() ? preservedValueRows(before, after()!) : []
                      return <section class="mx-card sf-n28-section" data-section-id={before.id}>
                        <h4>{before.title}</h4>
                        <Show when={after() && (rows().length > 0 || before.count !== after()!.count || before.title !== after()!.title)}>
                          <div class="sf-n28-scroll" role="region" aria-label={before.title} tabIndex={0}>
                            <table>
                              <caption>{t("sf.u32.diff")}</caption>
                              <thead><tr><th scope="col">{t("sf.u32.value")}</th>
                                <th scope="col">{t("sf.u32.before")}</th><th scope="col">{t("sf.u32.after")}</th></tr></thead>
                              <tbody>
                                <Show when={before.count !== after()!.count}>
                                  <tr><th scope="row">{t("sf.u32.records")}</th><td>{before.count}</td><td>{after()!.count}</td></tr>
                                </Show>
                                <Show when={before.title !== after()!.title}>
                                  <tr><th scope="row">{t("sf.u32.sections")}</th><td>{before.title}</td><td>{after()!.title}</td></tr>
                                </Show>
                                <For each={rows()}>{(row) => <tr>
                                  <th scope="row">{row.id}</th>
                                  <td>{row.before ? String(row.before.value ?? t("sf.u32.missing")) : t("sf.u32.missing")}</td>
                                  <td>{row.after ? String(row.after.value ?? t("sf.u32.missing")) : t("sf.u32.missing")}</td>
                                </tr>}</For>
                              </tbody>
                            </table>
                          </div>
                        </Show>
                      </section>
                    }}</For>
                  </div>
                </Show>
              </Show>
            </section>
          </Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
