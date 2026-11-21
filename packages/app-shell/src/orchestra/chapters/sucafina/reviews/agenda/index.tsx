import { A } from "@solidjs/router"
import { For, Show, createEffect, createUniqueId, onCleanup, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfReviewUpdate } from "@orchestra/schema/sucafina/reviews"
import type { Schema } from "effect"
import { operationGranted, PeriodText } from "../labels"
import "./agenda.css"

type Section = Schema.Schema.Type<typeof SfReviewUpdate>["items"][number]
type Preview = Readonly<{
  selectionRef: string
  sections: readonly Readonly<{
    id: string; title: string; period: { start: string; end: string }; recordCount: number; recordRefs: readonly string[]
  }>[]
}>
type Preserved = Readonly<{ id: string; version: number; createdAt: string }>
type Phase = "selecting" | "previewing" | "reviewing" | "submitting" | "outcome-unknown" | "confirmed"
const key = (value: string) => value as SfCopyKey

function stateOf(result: { kind: "transport-error"; reason: string } | { kind: "response"; status: number; body: { status: string } }): SfUiState {
  if (result.kind === "transport-error") return result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable"
  if (result.body.status === "denied") return "denied"
  if (result.body.status === "stale") return "stale"
  if (result.body.status === "conflict" || result.body.status === "provider-conflict") return "conflict"
  if (result.body.status === "needs-input" || result.body.status === "invalid") return "invalid"
  return "unavailable"
}

/** UI47: the producer is the sole source for section identity, count and period. */
export function SfAgendaView(props: SfSurfaceProps<"UI47">) {
  const owner = useSfContext()
  const language = useLanguage()
  const uid = createUniqueId()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    ownerKey: "",
    sourcePage: "",
    filter: "",
    available: [] as Section[],
    selected: [] as Section[],
    status: "loading" as SfUiState,
    phase: "selecting" as Phase,
    preview: undefined as Preview | undefined,
    preserved: undefined as Preserved | undefined,
    message: "" as string,
  })
  let sourceAbort: AbortController | undefined
  let commandAbort: AbortController | undefined
  let previewHeading: HTMLHeadingElement | undefined
  const ready = () => owner.ready()
  const authorized = (operationId: string) => operationGranted(ready()?.context, operationId, { family: "reviews", resource: "agenda" })
  const mayPreview = () => authorized("dashboard.dashboard-agenda")
  const mayPreserve = () => authorized("dashboard.dashboard-review-preserve")
  const current = (generation: number, ownerKey: string) => {
    const state = owner.state()
    return owner.generation() === generation && state.status === "ready" && state.ownerKey === ownerKey
  }
  const issue = (status: SfUiState, message: string) => {
    if (status === "denied") setStore({ selected: [], available: [], preview: undefined, preserved: undefined, phase: "selecting" })
    setStore({ status, message })
  }
  const displayState = (): SfUiState => store.status === "ready" && !!store.filter &&
    !store.available.some((item) => item.topic.toLocaleLowerCase().includes(store.filter.toLocaleLowerCase()))
    ? "filtered-empty" : store.status
  const invalidatePreview = () => {
    if (store.phase === "outcome-unknown" || store.phase === "submitting") return
    commandAbort?.abort()
    setStore({ preview: undefined, preserved: undefined, phase: "selecting" })
  }
  const discover = async (page: string) => {
    sourceAbort?.abort()
    const access = ready()
    const state = owner.state()
    if (!access || state.status !== "ready" || !page.trim()) {
      issue("invalid", "sf.u25.sourceNeeded")
      return
    }
    const controller = new AbortController()
    sourceAbort = controller
    const generation = owner.generation(), ownerKey = state.ownerKey
    setStore("status", "loading")
    try {
      const year = props.route.query.year
      const period = year ? { start: String(year) + "-01-01", end: String(year) + "-12-31" } : {}
      const result = await createSfReviewsClient(access.transport)["projection.review"](
        { page: page.trim(), ...period }, { signal: controller.signal },
      )
      if (controller.signal.aborted || !current(generation, ownerKey)) return
      if (result.kind === "response" && result.body.status === "ok") {
        if (!("items" in result.body.value)) {
          issue("unavailable", "sf.u25.error")
          return
        }
        const sections = result.body.value.items.filter((item) => item.kind === "dashboard")
        // Refresh never strips already-selected sections merely because this read
        // is unavailable. Only an authoritative owner revocation clears them.
        setStore({ available: sections, status: sections.length ? "ready" : "empty", message: "", sourcePage: page })
        return
      }
      issue(stateOf(result), "sf.u25.error")
    } catch (error) {
      if (controller.signal.aborted || !current(generation, ownerKey)) return
      console.error("Sucafina agenda source read failed", error instanceof Error ? error.name : "unknown")
      issue("unavailable", "sf.u25.error")
    }
  }
  createEffect(() => {
    const generation = owner.generation()
    const state = owner.state()
    const access = ready()
    if (state.status !== "ready" || !access) {
      sourceAbort?.abort()
      commandAbort?.abort()
      setStore({
        ownerKey: "", sourcePage: "", available: [], selected: [], preview: undefined, preserved: undefined,
        phase: "selecting", status: state.status === "denied" ? "denied"
          : state.status === "unauthenticated" ? "session-expired"
          : state.status === "context-mismatch" ? "invalid"
          : state.status === "resolving" ? "loading" : "unavailable",
      })
      return
    }
    if (store.ownerKey !== state.ownerKey) {
      setStore({ ownerKey: state.ownerKey, sourcePage: "", selected: [], available: [], preview: undefined, preserved: undefined, phase: "selecting" })
      return
    }
    const source = untrack(() => store.sourcePage)
    if (source.trim()) void discover(source)
    onCleanup(() => {
      if (owner.generation() !== generation) {
        sourceAbort?.abort()
        commandAbort?.abort()
      }
    })
  })
  onCleanup(() => { sourceAbort?.abort(); commandAbort?.abort() })

  const add = (item: Section) => {
    if (store.phase === "outcome-unknown" || store.phase === "submitting" || !ready()) return
    if (store.selected.length < 30 && !store.selected.some((section) => section.id === item.id)) {
      setStore("selected", (items) => [...items, item])
      invalidatePreview()
    }
  }
  const reorder = (id: string, delta: number) => {
    if (store.phase === "outcome-unknown" || store.phase === "submitting") return
    const index = store.selected.findIndex((section) => section.id === id)
    const next = index + delta
    if (index < 0 || next < 0 || next >= store.selected.length) return
    const items = [...store.selected]
    const currentItem = items[index]!
    items[index] = items[next]!
    items[next] = currentItem
    setStore("selected", items)
    invalidatePreview()
  }
  const preview = async (recordRemoved = false) => {
    const access = ready(), state = owner.state()
    if (!access || state.status !== "ready" || !mayPreview() || store.selected.length === 0 || store.selected.length > 30 ||
      store.phase === "submitting" || store.phase === "outcome-unknown") return
    const sections = store.selected.map((item) => ({
      id: item.id, title: item.topic, topic: item.topic, selectionRef: item.selectionRef,
      period: { start: item.period.start, end: item.period.end },
      ...(item.recordRefs === undefined ? {} : { recordRefs: [...item.recordRefs] }),
    }))
    const generation = owner.generation(), ownerKey = state.ownerKey
    commandAbort?.abort()
    const controller = new AbortController()
    commandAbort = controller
    setStore({ phase: "previewing", preview: undefined, message: "" })
    try {
      const result = await createSfReviewsClient(access.transport)["dashboard.dashboard-agenda"](
        { sections }, { signal: controller.signal },
      )
      if (!current(generation, ownerKey) || controller.signal.aborted) return
      if (result.kind === "response" && result.body.status === "ok") {
        const returned = result.body.value.sections
        if (sections.length !== returned.length || returned.some((section, index) => {
          const expected = sections[index]!
          return section.id !== expected.id || section.recordCount !== section.recordRefs.length ||
            new Set(section.recordRefs).size !== section.recordCount ||
            (expected.recordRefs !== undefined && (expected.recordRefs.length !== section.recordRefs.length ||
              expected.recordRefs.some((ref, recordIndex) => ref !== section.recordRefs[recordIndex])))
        })) {
          setStore({ phase: "selecting", status: "stale", message: "sf.u25.changed" })
          return
        }
        setStore({
          phase: "reviewing", status: "ready", message: recordRemoved ? "sf.u25.recordsRefreshed" : "",
          preview: {
            selectionRef: result.body.value.selectionRef,
            sections: returned.map((section) => ({
              id: section.id, title: section.title, period: section.period, recordCount: section.recordCount, recordRefs: section.recordRefs,
            })),
          },
        })
        if (recordRemoved) previewHeading?.focus()
        return
      }
      setStore("phase", "selecting")
      issue(stateOf(result), "sf.u25.error")
    } catch (error) {
      if (!current(generation, ownerKey) || controller.signal.aborted) return
      console.error("Sucafina agenda preview failed", error instanceof Error ? error.name : "unknown")
      setStore("phase", "selecting")
      issue("unavailable", "sf.u25.error")
    }
  }
  const removeRecord = (sectionId: string, recordRef: string) => {
    if (store.phase !== "reviewing" || store.status !== "ready" || !mayPreview()) return
    const section = store.preview?.sections.find((entry) => entry.id === sectionId)
    if (!section?.recordRefs.includes(recordRef)) return
    const remaining = section.recordRefs.filter((ref) => ref !== recordRef)
    if (remaining.length > 512) return // Same explicit-selector bound as the typed client.
    setStore("selected", (items) => items.map((item) => item.id === sectionId ? { ...item, recordRefs: remaining } : item))
    void preview(true)
  }
  const confirm = async () => {
    const access = ready(), state = owner.state(), prepared = store.preview
    if (!access || state.status !== "ready" || !prepared || !mayPreserve() || store.phase !== "reviewing") return
    const generation = owner.generation(), ownerKey = state.ownerKey
    const controller = new AbortController()
    commandAbort = controller
    // One user gesture, one unique idempotency identity; never re-send after an uncertain outcome.
    const idempotencyKey = crypto.randomUUID()
    setStore({ phase: "submitting", message: "" })
    try {
      const result = await createSfReviewsClient(access.transport)["dashboard.dashboard-review-preserve"](
        { selectionRef: prepared.selectionRef, sectionRefs: prepared.sections.map((section) => section.id) },
        { signal: controller.signal, idempotencyKey },
      )
      if (!current(generation, ownerKey)) return
      if (result.kind === "response" && result.body.status === "ok") {
        const requested = prepared.sections.map((section) => section.id)
        const returned = result.body.value.sections.map((section) => section.id)
        if (!result.body.value.id || returned.length !== requested.length || returned.some((id, index) => id !== requested[index])) {
          setStore({ phase: "selecting", status: "stale", message: "sf.u25.changed", preserved: undefined })
          return
        }
        setStore({
          status: "ready", phase: "confirmed", message: "sf.u25.created",
          preserved: { id: result.body.value.id, version: result.body.value.version, createdAt: result.body.value.createdAt },
        })
        return
      }
      const status = stateOf(result)
      setStore("phase", status === "outcome-unknown" ? "outcome-unknown" : "selecting")
      issue(status, status === "outcome-unknown" ? "sf.u25.pending" : "sf.u25.error")
    } catch (error) {
      if (!current(generation, ownerKey)) return
      console.error("Sucafina agenda preservation outcome uncertain", error instanceof Error ? error.name : "unknown")
      setStore({ phase: "outcome-unknown", status: "outcome-unknown", message: "sf.u25.pending" })
    }
  }
  const preservedHref = () => {
    const state = owner.state()
    if (store.phase !== "confirmed" || !store.preserved || !ready() ||
      state.status !== "ready" || state.ownerKey !== store.ownerKey) return
    const { serverKey, projectId, installationId } = props.route.ownerSelection
    if (!serverKey || !projectId || !installationId || state.selection.serverKey !== serverKey ||
      state.selection.projectId !== projectId || state.selection.installationId !== installationId) return
    // A same-installation continuation still goes through F01 route admission.
    return `/orchestra/sf-reviews/reviews/${encodeSfRouteRef(store.preserved.id)}?` +
      new URLSearchParams({ server: serverKey, project: projectId, installation: installationId }).toString()
  }
  return (
    <SfPageFrame
      titleKey={key("sf.ui47.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="work"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "preview", labelKey: key("sf.u25.preview"), tone: "primary",
        disabled: !mayPreview() || !store.selected.length || store.phase === "submitting" ||
          store.phase === "outcome-unknown" || store.phase === "previewing" || store.phase === "confirmed",
        busy: store.phase === "previewing", onInvoke: () => { void preview() },
      }}
    >
      <div class="sf-n28" data-sf-surface="UI47" data-phase={store.phase}>
        <form class="sf-n28-form" onSubmit={(event) => { event.preventDefault(); void discover(store.sourcePage) }}>
          <label for={uid + "-page"}>{t("sf.u25.source")}</label>
          <input id={uid + "-page"} class="mx-input" value={store.sourcePage}
            onInput={(event) => setStore("sourcePage", event.currentTarget.value)}
            required maxlength="200" autocomplete="off" />
          <button class="mx-btn" type="submit">{t("sf.u25.find")}</button>
        </form>
        <SfStatePanel
          state={displayState()}
          messageKey={key(displayState() === "filtered-empty" ? "sf.u25.noMatching"
            : store.message || (store.status === "empty" ? "sf.u25.noSections" : "sf.common.unavailable"))}
          onRetryRead={store.phase !== "outcome-unknown" ? () => { void discover(store.sourcePage) } : undefined}
        >
          <label class="sf-n28-field" for={uid + "-filter"}>{t("sf.u25.filter")}
            <input id={uid + "-filter"} type="search" value={store.filter}
              onInput={(event) => setStore("filter", event.currentTarget.value)} />
          </label>
          <section aria-label={t("sf.u25.available")} class="sf-n28-section">
            <h2>{t("sf.u25.available")}</h2>
            <ul class="sf-n28-items">
              <For each={store.available.filter((item) => item.topic.toLocaleLowerCase().includes(store.filter.toLocaleLowerCase()))}>
                {(item) => <li class="mx-card">
                  <strong>{item.topic}</strong>
                  <span>{t("sf.u25.period")}: <PeriodText start={item.period.start} end={item.period.end} /></span>
                  <button class="mx-btn" type="button" onClick={() => add(item)}
                    disabled={store.selected.length >= 30 || store.selected.some((selected) => selected.id === item.id) ||
                      store.phase === "submitting" || store.phase === "outcome-unknown"}>{t("sf.u25.add")}</button>
                </li>}
              </For>
            </ul>
            <Show when={store.filter && !store.available.some((item) => item.topic.toLocaleLowerCase().includes(store.filter.toLocaleLowerCase()))}>
              <p role="status">{t("sf.u25.noMatching")}</p>
            </Show>
          </section>
        </SfStatePanel>
        <Show when={store.selected.length > 0 && store.status !== "denied" && store.status !== "session-expired"}>
          <section class="sf-n28-section" aria-label={t("sf.u25.selected")}>
            <h2>{t("sf.u25.selected")}</h2>
            <p>{t("sf.u25.limit")}</p>
            <ol class="sf-n28-items" data-sf-agenda-order>
              <For each={store.selected}>{(item, index) => <li class="mx-card" data-section-id={item.id}>
                <strong>{item.topic}</strong>
                <p>{t("sf.u25.period")}: <PeriodText start={item.period.start} end={item.period.end} /></p>
                <div class="sf-n28-actions">
                  <button type="button" class="mx-btn" disabled={index() === 0 || store.phase === "submitting" || store.phase === "outcome-unknown"}
                    onClick={() => reorder(item.id, -1)} aria-label={t("sf.u25.up") + ": " + item.topic}>{t("sf.u25.up")}</button>
                  <button type="button" class="mx-btn" disabled={index() === store.selected.length - 1 || store.phase === "submitting" || store.phase === "outcome-unknown"}
                    onClick={() => reorder(item.id, 1)} aria-label={t("sf.u25.down") + ": " + item.topic}>{t("sf.u25.down")}</button>
                  <button type="button" class="mx-btn" disabled={store.phase === "submitting" || store.phase === "outcome-unknown"}
                    onClick={() => { setStore("selected", (items) => items.filter((selected) => selected.id !== item.id)); invalidatePreview() }}>
                    {t("sf.u25.remove")}</button>
                </div>
              </li>}</For>
            </ol>
          </section>
        </Show>
        <Show when={store.phase === "reviewing" && store.preview && store.status === "ready"}>
          <section class="sf-n28-section" data-sf-agenda-preview>
            <h2 ref={previewHeading} tabIndex={-1}>{t("sf.u25.previewTitle")}</h2>
            <p>{t("sf.u25.selection")}: {store.preview?.selectionRef}</p>
            <ol>
              <For each={store.preview?.sections}>{(section) => <li data-section-id={section.id}>
                <strong>{section.title}</strong>
                <span> {t("sf.u25.count")}: {section.recordCount}</span>
                <span> {t("sf.u25.period")}: <PeriodText start={section.period.start} end={section.period.end} /></span>
                <Show when={mayPreview() && section.recordRefs.length > 0 && section.recordRefs.length <= 513}>
                  <details>
                    <summary>{t("sf.u25.recordSelection")}: {section.title}</summary>
                    <ul class="sf-n28-items">
                      <For each={section.recordRefs}>{(ref) => <li>
                        <code>{ref}</code>
                        <div class="sf-n28-actions">
                          <button class="mx-btn" type="button" onClick={() => removeRecord(section.id, ref)}
                            aria-label={`${t("sf.u25.removeRecord")} ${ref}`}>{t("sf.u25.removeRecord")}</button>
                        </div>
                      </li>}</For>
                    </ul>
                  </details>
                </Show>
              </li>}</For>
            </ol>
            <p>{t("sf.u25.coverage")}</p>
            <div class="sf-n28-actions">
              <button class="mx-btn primary" disabled={!mayPreserve()} type="button" onClick={() => { void confirm() }}>
                {t("sf.u25.confirm")}</button>
              <button class="mx-btn" type="button" onClick={invalidatePreview}>{t("sf.u25.revise")}</button>
            </div>
          </section>
        </Show>
        <Show when={store.phase === "confirmed" && store.preserved}>
          <section role="status" class="mx-card" data-sf-preserved-confirmed>
            <p>{t("sf.u25.created")}</p>
            <dl>
              <dt>{t("sf.u25.result")}</dt><dd>{store.preserved?.id}</dd>
              <dt>{t("sf.u25.version")}</dt><dd>{store.preserved?.version}</dd>
            </dl>
            <Show when={preservedHref()}>
              {(href) => <A class="mx-btn" href={href()}>{t("sf.u25.openPreserved")}</A>}
            </Show>
          </section>
        </Show>
        <Show when={store.phase === "outcome-unknown"}>
          <p role="alert">{t("sf.u25.pending")}</p>
        </Show>
        <Show when={store.message && store.status === "ready" && store.phase !== "confirmed"}>
          <p role="status">{t(store.message)}</p>
        </Show>
        <Show when={!mayPreserve() && store.status !== "denied" && store.status !== "session-expired"}>
          <p role="status">{t("sf.u25.readOnly")}</p>
        </Show>
      </div>
    </SfPageFrame>
  )
}
