import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U05_COPY } from "@/i18n/orchestra-chapters/sf-u05"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfCopyKey as SfTableCopyKey } from "../../shared/table"
import { sfReadProjects, sfAdmitted, sfOwnerMatches } from "../projects/producer"
import { sfProjectHref } from "../projects/paths"
import { sfSourceDate, type SfProjectRecord, type SfProjectPage } from "../projects/model"
import "./overview.css"

const k = (value: keyof typeof SF_U05_COPY) => value as SfCopyKey
const kt = (value: keyof typeof SF_U05_COPY) => value as unknown as SfTableCopyKey

/** CAP09: read-only review of live source, never a stored historical snapshot. */
export function SfPortfolioOverviewView(props: SfSurfaceProps<"CAP09">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const navigate = useNavigate()
  const t = (key: keyof typeof SF_U05_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [refresh, setRefresh] = createSignal(0)
  const [view, setView] = createStore<{ state: SfUiState; page: SfProjectPage | null }>({
    state: "loading", page: null,
  })
  const ready = () => owner.state().status === "ready" ? owner.ready() : undefined
  const matching = () => {
    const active = ready()
    return !!active && sfOwnerMatches(active.context, props.route.ownerSelection)
  }
  const canOpenProjects = () => {
    const active = ready()
    return !!active && active.context.destinations.some((destination) =>
      destination.capabilityId === "CAP10" && destination.surface === "dashboard" &&
      destination.page === "All Projects" && destination.canRead)
  }
  const goProjects = () => {
    if (!canOpenProjects()) return
    const href = sfProjectHref(props.route, "projects")
    if (href) navigate(href)
  }

  createEffect(() => {
    refresh()
    const generation = owner.generation()
    const status = owner.state().status
    const active = owner.ready()
    const sourceQuery = props.route.query
    setView({ state: status === "denied" ? "denied" : status === "unauthenticated" ? "session-expired" :
      status === "context-mismatch" ? "invalid" : status === "ready" ? "loading" :
      status === "resolving" ? "loading" : "unavailable", page: null })
    if (status !== "ready" || !active) return
    if (!matching() || !sfAdmitted(active.context, "CAP09", "domain.page.CAP09")) {
      setView({ state: "denied", page: null })
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void sfReadProjects(active.transport, "CAP09", {
      year: sourceQuery.year, status: sourceQuery.status, filter: sourceQuery.filter,
    }, controller.signal).then((result) => {
      if (controller.signal.aborted || generation !== owner.generation()) return
      if (result.status === "failed") {
        setView({ state: result.state, page: null })
        return
      }
      setView({ state: result.page.sourceState === "partial" ? "partial" :
        result.page.records.length === 0 ? "empty" : "ready", page: result.page })
    }).catch(() => {
      if (!controller.signal.aborted && generation === owner.generation())
        setView({ state: "unavailable", page: null })
    })
  })

  const projects = createMemo(() => {
    const current = view.page
    if (!current) return [] as SfProjectRecord[]
    const status = props.route.query.status
    const filter = props.route.query.filter
    return [...current.records].filter((row) =>
      (!status || row.status === status) &&
      (filter !== "watch" || row.watchList === true) &&
      (filter !== "at-risk" || row.risk === "Medium" || row.risk === "High"),
    ).sort((a, b) => Number(b.watchList === true) - Number(a.watchList === true) ||
      (sfSourceDate(a.end) ?? "9999-12-31").localeCompare(sfSourceDate(b.end) ?? "9999-12-31") ||
      a.id.localeCompare(b.id))
  })
  const milestoneRows = createMemo(() => projects().flatMap((project) =>
    (project.milestones ?? []).map((milestone) => ({ project, milestone })),
  ).sort((a, b) =>
    (sfSourceDate(a.milestone.date) ?? "9999-12-31").localeCompare(sfSourceDate(b.milestone.date) ?? "9999-12-31") ||
    a.project.id.localeCompare(b.project.id)))
  const milestoneCoverage = createMemo(() => projects().every((project) => project.milestones !== null))
  const columns: readonly SfColumn<SfProjectRecord>[] = [
    { id: "name", labelKey: kt("sf.u05.projects.project"), align: "start", widthPolicy: { kind: "flex", weight: 2, minPx: 170 },
      render: (row) => <bdi>{row.name}</bdi> },
    { id: "status", labelKey: kt("sf.u05.projects.status"), align: "start", widthPolicy: { kind: "content", minPx: 100, maxPx: 180 },
      render: (row) => <span>{row.status ?? t("sf.u05.projects.notRecorded")}</span> },
    { id: "risk", labelKey: kt("sf.u05.projects.risk"), align: "start", widthPolicy: { kind: "content", minPx: 90, maxPx: 140 },
      render: (row) => <span>{row.risk ?? t("sf.u05.projects.notRecorded")}</span> },
    { id: "end", labelKey: kt("sf.u05.projects.target"), align: "start", widthPolicy: { kind: "content", minPx: 130, maxPx: 180 },
      render: (row) => <span>{sfSourceDate(row.end) ?? t("sf.u05.projects.notRecorded")}</span> },
    { id: "watchList", labelKey: kt("sf.u05.projects.watch"), align: "center", widthPolicy: { kind: "content", minPx: 90, maxPx: 150 },
      render: (row) => <span>{row.watchList === null || row.watchList === undefined ?
        t("sf.u05.projects.notRecorded") : row.watchList ? "✓" : "—"}</span> },
    { id: "pm", labelKey: kt("sf.u05.projects.owner"), align: "start", widthPolicy: { kind: "flex", weight: 1, minPx: 140 },
      render: (row) => <bdi>{row.pm ?? t("sf.u05.projects.notRecorded")}</bdi> },
  ]
  return (
    <SfPageFrame
      titleKey={k("sf.cap09.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
      primaryAction={{
        id: "open-projects", labelKey: k("sf.cap09.primary"), tone: "primary", busy: false,
        disabled: !canOpenProjects(), onInvoke: goProjects,
      }}
      secondaryActions={[]}
    >
      <section class="sf-u05-overview" data-sf-portfolio-overview data-sf-source="CAP09">
        <SfStatePanel
          state={view.state}
          messageKey={k("sf.u05.projects.notAvailable")}
          onRetryRead={() => setRefresh((value) => value + 1)}
        >
          <Show when={view.page}>
            <div class="sf-u05-overview-intro">
              <h2>{t("sf.u05.overview.summary")}</h2>
              <p>{t("sf.u05.overview.context")}</p>
              <p>{t("sf.u05.overview.order")}</p>
              <Show when={view.page?.capturedAt}><time>{view.page!.capturedAt}</time></Show>
            </div>
            <dl class="sf-u05-overview-metrics">
              <div><dt>{t("sf.u05.overview.selected")}</dt><dd>{projects().length}</dd></div>
              <div><dt>{t("sf.u05.overview.watch")}</dt><dd>{projects().filter((project) => project.watchList === true).length}</dd></div>
              <div><dt>{t("sf.u05.overview.risk")}</dt><dd>{projects().filter((project) => project.risk === "Medium" || project.risk === "High").length}</dd></div>
            </dl>
            <section aria-label={t("sf.u05.overview.projects")}>
              <h2>{t("sf.u05.overview.projects")}</h2>
              <SfDataTable
                rows={projects()}
                getRowKey={(row) => row.id as SfRef}
                columns={columns}
                sort={{ kind: "none" }}
                page={{ kind: "none", total: projects().length }}
                onSort={() => undefined}
                onPage={() => undefined}
                onSelect={(ref) => {
                  if (!canOpenProjects()) return
                  const href = sfProjectHref(props.route, "detail", ref)
                  if (href) navigate(href)
                }}
                rowActions={() => []}
                onRowAction={() => undefined}
                captionKey={kt("sf.u05.overview.projects")}
                density="comfortable"
                state={projects().length === 0 ? "filtered-empty" : "ready"}
              />
            </section>
            <section aria-label={t("sf.u05.overview.milestones")}>
              <h2>{t("sf.u05.overview.milestones")}</h2>
              <Show when={milestoneCoverage()} fallback={<p role="status">{t("sf.u05.projects.milestonesUnavailable")}</p>}>
                <div class="sf-u05-overview-scroll">
                  <table>
                    <thead><tr>
                      <th scope="col">{t("sf.u05.projects.project")}</th>
                      <th scope="col">{t("sf.u05.projects.milestone")}</th>
                      <th scope="col">{t("sf.u05.projects.date")}</th>
                      <th scope="col">{t("sf.u05.projects.milestoneStatus")}</th>
                    </tr></thead>
                    <tbody>
                      <For each={milestoneRows()}>{(row) => (
                        <tr><th scope="row"><bdi>{row.project.name}</bdi></th><td><bdi>{row.milestone.name}</bdi></td>
                          <td>{sfSourceDate(row.milestone.date) ?? t("sf.u05.projects.notRecorded")}</td>
                          <td>{row.milestone.status ?? t("sf.u05.projects.notRecorded")}</td></tr>
                      )}</For>
                    </tbody>
                  </table>
                  <Show when={milestoneRows().length === 0}><p>{t("sf.u05.projects.noMilestones")}</p></Show>
                </div>
              </Show>
            </section>
            <Show when={canOpenProjects()}>
              <button class="mx-btn" type="button" onClick={goProjects}>{t("sf.u05.overview.maintain")}</button>
            </Show>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
