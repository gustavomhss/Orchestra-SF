import { For, Show, createEffect, createUniqueId, onCleanup, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfReviewsReviewAgenda, SfReviewsReviewAgendaOptions, SfReviewPreserved } from "@orchestra/schema/sucafina/reviews"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"
import { SfPageFrame, type SfCopyKey } from "../../shared/frame"
import { operationGranted } from "../labels"

type Option = Extract<Schema.Schema.Type<typeof SfReviewsReviewAgendaOptions.output>, { status: "ok" }>["value"]["options"][number]
type Preview = Extract<Schema.Schema.Type<typeof SfReviewsReviewAgenda.output>, { status: "ok" }>["value"]
type Preserved = Schema.Schema.Type<typeof SfReviewPreserved>
type Phase = "selecting" | "loading" | "reviewing" | "submitting" | "confirmed" | "outcome-unknown"
const key = (value: string) => value as SfCopyKey

/** UI47 multi-domain selection. Only the original producer prepares section contents. */
export function SfMultiDomainAgenda(props: { year?: number; onDashboard: () => void }) {
  const owner = useSfContext(), language = useLanguage(), uid = createUniqueId()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const year = props.year ?? new Date().getUTCFullYear()
  const [store, setStore] = createStore({
    domain: "dashboard" as Option["domain"], start: String(year) + "-01-01", end: String(year) + "-12-31",
    available: [] as Option[], selected: [] as Option[], preview: undefined as Preview | undefined,
    sectionRefs: [] as string[], preserved: undefined as Preserved | undefined,
    phase: "selecting" as Phase, message: "",
  })
  let readAbort: AbortController | undefined, commandAbort: AbortController | undefined
  const allowed = (operation: string) => operationGranted(owner.ready()?.context, operation, { family: "reviews", resource: "agenda" })
  const current = (generation: number, ownerKey: string) => {
    const state = owner.state()
    return owner.generation() === generation && state.status === "ready" && state.ownerKey === ownerKey
  }
  const busy = () => ["loading", "submitting", "outcome-unknown", "confirmed"].includes(store.phase)
  const resetPreview = () => setStore({ preview: undefined, sectionRefs: [], preserved: undefined, phase: "selecting", message: "" })
  createEffect(() => {
    owner.generation()
    const state = owner.state()
    untrack(() => {
      readAbort?.abort(); commandAbort?.abort()
      setStore({ available: [], selected: [], preview: undefined, sectionRefs: [], preserved: undefined,
        phase: "selecting", message: state.status === "ready" ? "" : "sf.common.unavailable" })
    })
  })
  onCleanup(() => { readAbort?.abort(); commandAbort?.abort() })
  const deny = (status: string) => {
    if (status === "denied" || status === "unauthenticated")
      setStore({ available: [], selected: [], preview: undefined, sectionRefs: [], preserved: undefined })
    setStore({ phase: "selecting", message: "sf.u25.error" })
  }
  const discover = async () => {
    const access = owner.ready(), state = owner.state()
    if (!access || state.status !== "ready" || busy() || !allowed("reviews.review-agenda-options")) return
    readAbort?.abort()
    const abort = new AbortController(); readAbort = abort
    const generation = owner.generation(), ownerKey = state.ownerKey
    setStore({ phase: "loading", message: "" })
    try {
      const result = await createSfReviewsClient(access.transport)["reviews.review-agenda-options"](
        { start: store.start, end: store.end, domain: store.domain }, { signal: abort.signal },
      )
      if (abort.signal.aborted || !current(generation, ownerKey)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        deny(result.kind === "response" ? result.body.status : result.reason)
        return
      }
      setStore({ available: [...result.body.value.options], phase: store.preview ? "reviewing" : "selecting",
        message: result.body.value.options.length ? "" : "sf.u25.noSections" })
    } catch {
      if (current(generation, ownerKey) && !abort.signal.aborted) deny("unavailable")
    }
  }
  const choose = (option: Option) => {
    if (busy()) return
    const existing = store.selected.findIndex((item) => item.key === option.key)
    if (existing < 0 && store.selected.length >= 30) return
    setStore("selected", (items) => existing < 0 ? [...items, option] : items.map((item, index) => index === existing ? option : item))
    resetPreview()
  }
  const prepare = async () => {
    const access = owner.ready(), state = owner.state()
    if (!access || state.status !== "ready" || busy() || !store.selected.length || !allowed("reviews.review-agenda")) return
    commandAbort?.abort()
    const abort = new AbortController(); commandAbort = abort
    const generation = owner.generation(), ownerKey = state.ownerKey
    const items = store.selected.map((option) => option.item)
    setStore({ phase: "loading", preview: undefined, sectionRefs: [], message: "" })
    try {
      const result = await createSfReviewsClient(access.transport)["reviews.review-agenda"]({ items }, { signal: abort.signal })
      if (abort.signal.aborted || !current(generation, ownerKey)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        deny(result.kind === "response" ? result.body.status : result.reason)
        return
      }
      const preview = result.body.value
      if (!preview.sectionRefs.length || preview.sectionRefs.length !== preview.sections.length ||
        new Set(preview.sectionRefs).size !== preview.sectionRefs.length ||
        preview.sectionRefs.some((id, index) => id !== preview.sections[index]?.id)) {
        deny("stale")
        return
      }
      setStore({ preview, sectionRefs: [...preview.sectionRefs], phase: "reviewing", message: "" })
    } catch {
      if (current(generation, ownerKey) && !abort.signal.aborted) deny("unavailable")
    }
  }
  const sections = () => store.sectionRefs.flatMap((id) => {
    const section = store.preview?.sections.find((value) => value.id === id)
    return section ? [section] : []
  })
  const removeSection = (id: string) => {
    if (store.phase !== "reviewing") return
    setStore("sectionRefs", (refs) => refs.filter((value) => value !== id))
    setStore("selected", (items) => items.filter((value) => value.item.id !== id))
  }
  const moveSection = (id: string, delta: number) => {
    if (store.phase !== "reviewing") return
    const refs = [...store.sectionRefs], at = refs.indexOf(id), next = at + delta
    if (at < 0 || next < 0 || next >= refs.length) return
    const value = refs[at]!; refs[at] = refs[next]!; refs[next] = value
    setStore("sectionRefs", refs)
  }
  const preserve = async () => {
    const access = owner.ready(), state = owner.state(), preview = store.preview
    if (!access || state.status !== "ready" || !preview || store.phase !== "reviewing" ||
      !store.sectionRefs.length || !allowed("reviews.review-preserve")) return
    const abort = new AbortController(); commandAbort = abort
    const generation = owner.generation(), ownerKey = state.ownerKey, sectionRefs = [...store.sectionRefs]
    setStore({ phase: "submitting", message: "" })
    try {
      const result = await createSfReviewsClient(access.transport)["reviews.review-preserve"](
        { selectionRef: preview.selectionRef, sectionRefs }, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (!current(generation, ownerKey)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        if (result.kind === "transport-error" && result.reason === "outcome-unknown")
          setStore({ phase: "outcome-unknown", message: "sf.u25.pending" })
        else deny(result.kind === "response" ? result.body.status : result.reason)
        return
      }
      if (result.body.value.sections.length !== sectionRefs.length ||
        result.body.value.sections.some((section, index) => section.id !== sectionRefs[index])) {
        setStore({ phase: "outcome-unknown", message: "sf.u25.pending" })
        return
      }
      setStore({ preserved: result.body.value, phase: "confirmed", message: "" })
    } catch {
      if (current(generation, ownerKey)) setStore({ phase: "outcome-unknown", message: "sf.u25.pending" })
    }
  }
  return <SfPageFrame titleKey={key("sf.ui47.title")} context={[]} tabs={[]} activeTab={null}
    density="comfortable" layout="work" onLayoutMode={() => undefined}
    secondaryActions={[{ id: "dashboard", labelKey: key("sf.u25.dashboardAgenda"), disabled: busy(), onInvoke: props.onDashboard }]}
    primaryAction={{ id: "preview", labelKey: key("sf.u25.preview"), tone: "primary", busy: store.phase === "loading",
      disabled: busy() || !store.selected.length || !allowed("reviews.review-agenda"), onInvoke: () => { void prepare() } }}>
    <div class="sf-n28" data-sf-surface="UI47" data-sf-multi-agenda data-phase={store.phase}>
      <section aria-label={t("sf.u25.agendaTopics")}>
        <h2>{t("sf.u25.agendaTopics")}</h2>
        <form class="sf-n28-form" onSubmit={(event) => { event.preventDefault(); void discover() }}>
          <label for={uid + "-start"}>{t("sf.u25.periodStart")}</label>
          <input id={uid + "-start"} type="date" value={store.start} disabled={busy()}
            onInput={(event) => setStore("start", event.currentTarget.value)} required />
          <label for={uid + "-end"}>{t("sf.u25.periodEnd")}</label>
          <input id={uid + "-end"} type="date" value={store.end} disabled={busy()}
            onInput={(event) => setStore("end", event.currentTarget.value)} required />
          <label for={uid + "-domain"}>{t("sf.u25.domain")}</label>
          <select id={uid + "-domain"} value={store.domain} disabled={busy()}
            onChange={(event) => setStore("domain", event.currentTarget.value as Option["domain"])}>
            <option value="dashboard">Dashboard</option><option value="planner">Planner</option><option value="procurement">Procurement</option>
          </select>
          <button class="mx-btn" disabled={busy() || !allowed("reviews.review-agenda-options")} type="submit">{t("sf.u25.discoverTopics")}</button>
        </form>
        <ul aria-label={t("sf.u25.available")}>
          <For each={store.available}>{(option) => <li class="mx-card">
            <span>{option.label} · {option.domain} · {option.item.period.start} – {option.item.period.end}</span>
            <button type="button" class="mx-btn" disabled={busy()} onClick={() => choose(option)}>
              {(store.selected.some((value) => value.key === option.key) ? t("sf.u25.refreshTopic") : t("sf.u25.addTopic")) + " " + option.label}
            </button>
          </li>}</For>
        </ul>
      </section>
      <ol class="sf-n28-items" aria-label={t("sf.u25.selected")} data-sf-multi-order>
        <For each={store.selected}>{(option) => <li class="mx-card">
          <span>{option.label} · {option.domain} · {option.item.period.start} – {option.item.period.end}</span>
          <button type="button" class="mx-btn" disabled={busy()}
            aria-label={t("sf.u25.removeSelected") + " " + option.label}
            onClick={() => { setStore("selected", (items) => items.filter((value) => value.key !== option.key)); resetPreview() }}>
            {t("sf.u25.remove")}
          </button>
        </li>}</For>
      </ol>
      <Show when={store.phase === "reviewing" && store.preview}>
        <section data-sf-agenda-preview>
          <h2>{t("sf.u25.previewTitle")}</h2>
          <p role="status">{t("sf.u25.reviewInstruction")}</p>
          <ol class="sf-n28-items">
            <For each={sections()}>{(section, index) => <li class="mx-card">
              <h3>{section.title}</h3>
              <p>{t("sf.u25.sectionRef")}: {section.id}</p>
              <p>{section.period.start} – {section.period.end} · {section.recordCount} {t("sf.u25.selectedRecords")}</p>
              <For each={section.projection.context.sourceRefs}>{(source) =>
                <p>{t("sf.u25.sourceRef")}: {source.surface} · {source.type} · {source.id} · {t("sf.u25.sourceVersion")} {source.version} · {t("sf.u25.incarnation")} {source.incarnation}</p>
              }</For>
              <Show when={section.recordCount === 0}><p>{t("sf.u25.noRecords")}</p></Show>
              <table aria-label={section.title + " · " + t("sf.u25.values")}>
                <thead><tr><th>{t("sf.u25.field")}</th><th>{t("sf.u25.value")}</th><th>{t("sf.u25.period")}</th></tr></thead>
                <tbody><For each={section.projection.values}>{(value) => <tr>
                  <td>{value.id}</td><td>{((value.value === null ? t("sf.u25.unavailableValue") : String(value.value)) + " " + (value.currency ?? value.unit ?? "")).trim()}</td>
                  <td>{value.period.start} – {value.period.end}</td>
                </tr>}</For></tbody>
              </table>
              <button type="button" class="mx-btn" disabled={index() === 0} aria-label={t("sf.u25.up") + ": " + section.title}
                onClick={() => moveSection(section.id, -1)}>{t("sf.u25.up")}</button>
              <button type="button" class="mx-btn" disabled={index() === store.sectionRefs.length - 1} aria-label={t("sf.u25.down") + ": " + section.title}
                onClick={() => moveSection(section.id, 1)}>{t("sf.u25.down")}</button>
              <button type="button" class="mx-btn" aria-label={t("sf.u25.removeSection") + " " + section.title}
                onClick={() => removeSection(section.id)}>{t("sf.u25.remove")}</button>
            </li>}</For>
          </ol>
          <button type="button" class="mx-btn primary" disabled={!store.sectionRefs.length || !allowed("reviews.review-preserve")}
            onClick={() => { void preserve() }}>{t("sf.u25.confirm")}</button>
        </section>
      </Show>
      <Show when={store.message}><p role="alert">{t(store.message)}</p></Show>
      <Show when={store.phase === "confirmed" && store.preserved}>
        <section role="status" data-sf-preserved-confirmed class="mx-card">
          <p>{t("sf.u25.created")}</p>
          <dl><dt>{t("sf.u25.result")}</dt><dd>{store.preserved?.id}</dd>
            <dt>{t("sf.u25.version")}</dt><dd>{store.preserved?.version}</dd></dl>
        </section>
      </Show>
    </div>
  </SfPageFrame>
}
