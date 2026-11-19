import { createSignal, For, Show } from "solid-js"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"
import type { SfCopyKey } from "../../shared/frame"

const pages = ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"] as const
const key = (value: string) => value as SfCopyKey

/** The review entry the reports journey already names. Not the retired console document. */
export function SfOpexReportEntry(props: { year: number }) {
  const language = useLanguage()
  const owner = useSfContext()
  const t = (value: string) => language.t(key(value))
  const [format, setFormat] = createSignal("docx")
  const [year, setYear] = createSignal(String(props.year))
  const [title, setTitle] = createSignal("")
  const [selected, setSelected] = createSignal<string[]>([])
  const [prepared, setPrepared] = createSignal(false)
  const toggle = (page: string, checked: boolean) => {
    setSelected((current) => checked ? [...current.filter((item) => item !== page), page] : current.filter((item) => item !== page))
  }
  const load = async () => {
    const access = owner.ready()
    if (!access) return
    const client = createSfReviewsClient(access.transport)
    const period = { start: year() + "-01-01", end: year() + "-12-31" }
    const reads = await Promise.all(selected().map((page) => client["projection.review"]({ page, ...period })))
    const sections = reads.flatMap((result) => {
      if (result.kind !== "response" || result.body.status !== "ok" || !("items" in result.body.value)) return []
      return result.body.value.items.flatMap((item) => item.kind === "dashboard" ? [{
        id: item.id, title: item.topic, topic: item.topic, selectionRef: item.selectionRef,
        period: { start: item.period.start, end: item.period.end },
        ...(item.recordRefs === undefined ? {} : { recordRefs: [...item.recordRefs] }),
      }] : [])
    })
    if (!sections.length) return
    await client["dashboard.dashboard-agenda"]({ sections })
  }
  return (
    <div id="content">
      <h2>Decisions</h2>
      <form class="sf-budget-form report-form" onSubmit={(event) => { event.preventDefault(); setPrepared(true) }}>
        <label>{t("sf.u39.reportFormat")}
          <select value={format()} onChange={(event) => setFormat(event.currentTarget.value)}>
            <option value="docx">docx</option>
            <option value="pptx">pptx</option>
          </select>
        </label>
        <label>{t("sf.u39.year")}
          <select value={year()} onChange={(event) => setYear(event.currentTarget.value)}>
            <For each={[2024, 2025, 2026, 2027]}>{(item) => <option value={String(item)}>{item}</option>}</For>
          </select>
        </label>
        <label>{t("sf.u39.reportTitle")}
          <input value={title()} onInput={(event) => setTitle(event.currentTarget.value)} />
        </label>
        <For each={pages}>{(page) =>
          <label>
            <input type="checkbox" aria-label={page} checked={selected().includes(page)}
              onChange={(event) => toggle(page, event.currentTarget.checked)} />
            {page}
          </label>
        }</For>
        <button class="mx-btn primary" type="submit">{t("sf.u39.generateReport")}</button>
      </form>
      <Show when={prepared()}>
        <section aria-label={t("sf.u39.prepareReview")}>
          <button class="mx-btn" type="button" onClick={() => { void load() }}>{t("sf.u39.loadSelection")}</button>
        </section>
      </Show>
    </div>
  )
}
