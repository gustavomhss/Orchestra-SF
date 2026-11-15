import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U05_COPY } from "@/i18n/orchestra-chapters/sf-u05"
import type { SfEditScopeKey, SfIntentRef, SfRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfPublicDraftController, SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame, type SfCopyKey, type SfLayoutMode, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable, type SfColumn, type SfSort, type SfCopyKey as SfTableCopyKey } from "../../shared/table"
import { SfListDetail, SfRecordDetail } from "../../shared/detail"
import { SfMilestoneEditor, SfProjectEditor, type SfMilestoneDraft } from "./editor"
import { sfProjectHref } from "./paths"
import { sfAdmitted, sfOwnerMatches, sfProjectCommand, sfReadProjects } from "./producer"
import { PROJECT_STATUS, sfProjectDraft, sfProjectValues, sfProjectVersion, sfSourceDate,
  type SfProjectEdit, type SfProjectPage, type SfProjectRecord } from "./model"
import "./projects.css"

const k = (key: keyof typeof SF_U05_COPY) => key as SfCopyKey
const kt = (key: keyof typeof SF_U05_COPY) => key as unknown as SfTableCopyKey
const missing = (text: string) => text ? text : "—"
type ReviewCommand =
  | Readonly<{ kind: "delete-project"; id: string }>
  | Readonly<{ kind: "save-milestone"; projectId: string; draft: SfMilestoneDraft }>
  | Readonly<{ kind: "delete-milestone"; projectId: string; milestoneId: string }>

/** CAP10: current-source collection, route-specific record, CAS and human review. */
export function SfProjectsView(props: SfSurfaceProps<"CAP10">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const navigate = useNavigate()
  const t = (key: keyof typeof SF_U05_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [refresh, setRefresh] = createSignal(0)
  const [layout, setLayout] = createSignal<SfLayoutMode>("single")
  const [sort, setSort] = createSignal<SfSort>({ kind: "none" })
  const [draft, setDraft] = createSignal<SfPublicDraftController<SfProjectEdit> | null>(null)
  const newIntent = createUniqueId() as SfIntentRef
  const [view, setView] = createStore<{
    state: SfUiState
    page: SfProjectPage | null
    selectedId: string | null
    search: string
    status: string
    filter: string
    review: ReviewCommand | null
    reviewSave: boolean
    busy: boolean
    uncertain: boolean
    notice: keyof typeof SF_U05_COPY | null
  }>({ state: "loading", page: null, selectedId: null, search: "", status: "", filter: "",
    review: null, reviewSave: false, busy: false, uncertain: false, notice: null })
  const ready = () => owner.state().status === "ready" ? owner.ready() : undefined
  const permitted = (operation: string, action?: "save" | "delete" | "save-milestone" | "delete-milestone" | "import") => {
    const current = ready()
    return !!current && sfOwnerMatches(current.context, props.route.ownerSelection) &&
      sfAdmitted(current.context, "CAP10", operation, action)
  }
  const canRead = () => permitted("domain.page.CAP10")
  const canSave = () => permitted("domain.command.CAP10.save", "save")
  const canDelete = () => permitted("domain.command.CAP10.delete", "delete")
  const canSaveMilestone = () => permitted("domain.command.CAP10.save-milestone", "save-milestone")
  const canDeleteMilestone = () => permitted("domain.command.CAP10.delete-milestone", "delete-milestone")
  const canImport = () => permitted("domain.command.CAP10.import", "import")
  const selection = () => props.route.kind === "detail" || props.route.kind === "edit" || props.route.kind === "milestones"
    ? props.route.params.projectRef : view.selectedId
  const selected = createMemo(() => view.page?.records.find((row) => row.id === selection()) ?? null)
  const sourceVersion = () => selected() && view.page ? sfProjectVersion(view.page, selected()!.id) : null
  const hasDirty = () => {
    const current = draft()?.snapshot()
    return !!current && current.availability === "active" && current.dirty
  }
  const go = (kind: "overview" | "projects" | "new" | "detail" | "edit" | "milestones", ref?: string) => {
    if (!canRead() && kind !== "overview") return
    const href = sfProjectHref(props.route, kind, ref)
    if (!href) return
    if (hasDirty() && !window.confirm(language.t("sf.common.navigationDiscard"))) return
    if (hasDirty()) draft()?.discard()
    navigate(href)
  }

  createEffect(() => {
    refresh()
    const generation = owner.generation()
    const status = owner.state().status
    const active = owner.ready()
    const sourceQuery = props.route.query
    setView("state", status === "denied" ? "denied" : status === "unauthenticated" ? "session-expired" :
      status === "context-mismatch" ? "invalid" : status === "ready" ? "loading" :
        status === "resolving" ? "loading" : "unavailable")
    setView("page", null)
    if (status !== "ready" || !active) { setDraft(null); return }
    if (!sfOwnerMatches(active.context, props.route.ownerSelection) ||
        !sfAdmitted(active.context, "CAP10", "domain.page.CAP10")) {
      setView("state", "denied")
      setDraft(null)
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void sfReadProjects(active.transport, "CAP10", { year: sourceQuery.year }, controller.signal).then((result) => {
      if (controller.signal.aborted || generation !== owner.generation()) return
      if (result.status === "failed") {
        setView({ state: result.state, page: null })
        return
      }
      setView({ page: result.page, state: result.page.records.length === 0 ? "empty" : result.page.sourceState })
    }).catch(() => {
      if (!controller.signal.aborted && generation === owner.generation())
        setView({ state: "unavailable", page: null })
    })
  })

  // Acquire the S03 owner registry, never a page-local persistence layer.
  // Same-owner source refresh uses receiveRemote, which preserves dirty changes
  // and exposes conflict instead of resetting the draft.
  let acquired: string | null = null
  createEffect(() => {
    const active = ready()
    const page = view.page
    const route = props.route
    const record = selected()
    if (!active || !page || (route.kind !== "new" && route.kind !== "edit")) {
      acquired = null
      setDraft(null)
      return
    }
    if (route.kind === "edit" && (!record || sourceVersion() === null)) {
      acquired = null
      setDraft(null)
      return
    }
    const identity = route.kind === "new"
      ? { kind: "new" as const, newIntentRef: newIntent }
      : { kind: "record" as const, recordRef: record!.id as SfRef }
    const key = JSON.stringify([active.context.stamp.installationId, active.context.stamp.principalRef,
      route.kind, route.kind === "new" ? newIntent : record!.id])
    const value = sfProjectDraft(record ?? undefined)
    const version = record ? sfProjectVersion(page, record.id) : null
    if (acquired === key && draft()) {
      if (version !== null) draft()!.receiveRemote({ baseVersion: version, value })
      return
    }
    acquired = key
    const holder = active.drafts.acquire<SfProjectEdit>({
      surfaceId: "CAP10",
      editScopeKey: ("CAP10:All Projects:" + key) as SfEditScopeKey,
      identity, baseVersion: version, base: record ? value : null, value,
      revalidation: {
        operationId: "domain.page.CAP10", input: { year: route.query.year },
        fieldPaths: ["data.projects", "versions"],
        actionIds: ["save", "delete", "save-milestone", "delete-milestone"],
      },
    })
    setDraft(holder)
  })

  const rows = createMemo(() => {
    const needle = view.search.toLocaleLowerCase().trim()
    const records = view.page?.records.filter((row) =>
      (!needle || [row.name, row.desc, row.pm].some((text) => typeof text === "string" &&
        text.toLocaleLowerCase().includes(needle))) &&
      (!view.status || row.status === view.status) &&
      (view.filter !== "watch" || row.watchList === true) &&
      (view.filter !== "at-risk" || row.risk === "Medium" || row.risk === "High")) ?? []
    const current = sort()
    if (current.kind === "none") return records
    const sign = current.direction === "asc" ? 1 : -1
    return [...records].sort((a, b) => {
      const key = current.key as keyof SfProjectRecord
      const aa = a[key], bb = b[key]
      const av = typeof aa === "string" || typeof aa === "number" ? String(aa) : ""
      const bv = typeof bb === "string" || typeof bb === "number" ? String(bb) : ""
      return sign * av.localeCompare(bv, undefined, { numeric: true }) || a.id.localeCompare(b.id)
    })
  })
  const columns: readonly SfColumn<SfProjectRecord>[] = [
    { id: "name", labelKey: kt("sf.u05.projects.project"), align: "start",
      widthPolicy: { kind: "flex", weight: 2, minPx: 165 }, sortKey: "name",
      render: (row) => <bdi>{row.name}</bdi> },
    { id: "status", labelKey: kt("sf.u05.projects.status"), align: "start",
      widthPolicy: { kind: "content", minPx: 105, maxPx: 190 }, sortKey: "status",
      render: (row) => <span>{row.status ?? t("sf.u05.projects.notRecorded")}</span> },
    { id: "risk", labelKey: kt("sf.u05.projects.risk"), align: "start",
      widthPolicy: { kind: "content", minPx: 75, maxPx: 130 }, sortKey: "risk",
      render: (row) => <span>{row.risk ?? t("sf.u05.projects.notRecorded")}</span> },
    { id: "budget", labelKey: kt("sf.u05.projects.budget"), align: "end",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 180 }, sortKey: "budget",
      render: (row) => <span class="sf-u05-num">{row.budget === null || row.budget === undefined ?
        t("sf.u05.projects.notRecorded") : new Intl.NumberFormat(language.intl()).format(row.budget)}</span> },
    { id: "spent", labelKey: kt("sf.u05.projects.spent"), align: "end",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 180 }, sortKey: "spent",
      render: (row) => <span class="sf-u05-num">{row.spent === null || row.spent === undefined ?
        t("sf.u05.projects.notRecorded") : new Intl.NumberFormat(language.intl()).format(row.spent)}</span> },
    { id: "pct", labelKey: kt("sf.u05.projects.progress"), align: "end",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 170 }, sortKey: "pct",
      render: (row) => <span class="sf-u05-num">{row.pct === null || row.pct === undefined ?
        t("sf.u05.projects.notRecorded") : new Intl.NumberFormat(language.intl()).format(row.pct) + "%"}</span> },
    { id: "watchList", labelKey: kt("sf.u05.projects.watch"), align: "center",
      widthPolicy: { kind: "content", minPx: 90, maxPx: 145 },
      render: (row) => <span>{row.watchList === undefined || row.watchList === null ?
        t("sf.u05.projects.notRecorded") : row.watchList ? "✓" : "—"}</span> },
  ]
  const begin = (action: ReviewCommand) => {
    if (view.busy || view.uncertain) return
    setView("review", action)
  }
  const submit = async (action: "save" | "delete" | "save-milestone" | "delete-milestone",
    id: string | undefined, version: number, values: object) => {
    const active = ready()
    const operation = "domain.command.CAP10." + action
    if (!active || !permitted(operation, action) || view.busy || view.uncertain || !view.page) return
    const generation = owner.generation()
    const commandKey = crypto.randomUUID()
    setView({ busy: true, notice: null })
    const controller = new AbortController()
    try {
      const result = await sfProjectCommand(active.transport, action,
        { id, version, values, confirmed: true }, commandKey, controller.signal)
      if (generation !== owner.generation() || !sfOwnerMatches(active.context, props.route.ownerSelection)) return
      if (result.status === "failed") {
        if (result.state === "outcome-unknown") setView("uncertain", true)
        setView({ state: result.state, notice: result.state === "outcome-unknown" ?
          "sf.u05.projects.uncertain" : result.state === "conflict" ?
            "sf.u05.projects.stale" : "sf.u05.projects.operationUnavailable" })
        return
      }
      setView({ review: null, reviewSave: false, notice: "sf.u05.projects.saveSuccess" })
      setRefresh((value) => value + 1)
    } catch {
      if (generation === owner.generation()) {
        setView({ uncertain: true, state: "outcome-unknown", notice: "sf.u05.projects.uncertain" })
      }
    } finally {
      controller.abort()
      if (generation === owner.generation()) setView("busy", false)
    }
  }
  const save = () => {
    const original = draft()?.snapshot()
    const value = original?.availability === "active" ? sfProjectValues(original.value) : null
    const current = selected()
    const version = current && view.page ? sfProjectVersion(view.page, current.id) : 0
    if (!value || version === null || !canSave()) return
    void submit("save", current?.id, version, value)
  }
  const confirmReview = () => {
    const review = view.review, record = selected()
    const page = view.page
    if (!review || !page || !record || record.id !==
      (review.kind === "delete-project" ? review.id : review.projectId)) return
    const version = sfProjectVersion(page, record.id)
    if (version === null) return
    if (review.kind === "delete-project") void submit("delete", record.id, version, {})
    else if (review.kind === "save-milestone") {
      const milestone = review.draft
      const values = { milestoneId: milestone.milestoneId, name: milestone.name,
        date: milestone.date, status: milestone.status, notes: milestone.notes }
      void submit("save-milestone", record.id, version, values)
    } else void submit("delete-milestone", record.id, version, { milestoneId: review.milestoneId })
  }

  const details = (): JSX.Element => {
    const row = selected()
    if (!row) return <p role="status">{t("sf.u05.projects.noSelection")}</p>
    const textValue = (value: string | number | null | undefined) => ({
      kind: "text" as const, text: { kind: "data" as const, text: value === null || value === undefined ?
        t("sf.u05.projects.notRecorded") : String(value) },
    })
    const sections = [
      { id: "general", titleKey: kt("sf.u05.projects.general"), state: "ready" as const,
        content: <dl class="sf-u05-detail-fields">
          <div><dt>{t("sf.u05.projects.form.desc")}</dt><dd><bdi>{row.desc ?? t("sf.u05.projects.notRecorded")}</bdi></dd></div>
          <div><dt>{t("sf.u05.projects.form.priority")}</dt><dd>{row.priority ?? t("sf.u05.projects.notRecorded")}</dd></div>
          <div><dt>{t("sf.u05.projects.form.pm")}</dt><dd><bdi>{row.pm ?? t("sf.u05.projects.notRecorded")}</bdi></dd></div>
        </dl> },
      { id: "schedule", titleKey: kt("sf.u05.projects.schedule"), state: "ready" as const,
        content: <dl class="sf-u05-detail-fields">
          <div><dt>{t("sf.u05.projects.form.start")}</dt><dd>{sfSourceDate(row.start) ?? t("sf.u05.projects.notRecorded")}</dd></div>
          <div><dt>{t("sf.u05.projects.form.end")}</dt><dd>{sfSourceDate(row.end) ?? t("sf.u05.projects.notRecorded")}</dd></div>
        </dl> },
      { id: "budget-spent", titleKey: kt("sf.u05.projects.financial"), state: "ready" as const,
        content: <dl class="sf-u05-detail-fields">
          <div><dt>{t("sf.u05.projects.budget")}</dt><dd>{row.budget ?? t("sf.u05.projects.notRecorded")}</dd></div>
          <div><dt>{t("sf.u05.projects.spent")}</dt><dd>{row.spent ?? t("sf.u05.projects.notRecorded")}</dd></div>
          <div><dt>{t("sf.u05.projects.progress")}</dt><dd>{row.pct ?? t("sf.u05.projects.notRecorded")}</dd></div>
        </dl> },
      { id: "watch", titleKey: kt("sf.u05.projects.watchSection"), state: "ready" as const,
        content: <p>{row.watchList === undefined || row.watchList === null ?
          t("sf.u05.projects.notRecorded") : row.watchList ? "✓" : "—"}</p> },
      { id: "milestones", titleKey: kt("sf.u05.overview.milestones"), state: "ready" as const,
        content: <Show when={row.milestones !== null} fallback={<p>{t("sf.u05.projects.milestonesUnavailable")}</p>}>
          <ul class="sf-u05-milestones">
            <For each={row.milestones ?? []}>{(milestone) => <li>
              <strong><bdi>{milestone.name}</bdi></strong>
              <small>{sfSourceDate(milestone.date) ?? t("sf.u05.projects.notRecorded")} · {milestone.status ?? t("sf.u05.projects.notRecorded")}</small>
              <Show when={props.route.kind === "milestones" && sourceVersion() !== null}>
                <SfMilestoneEditor projectId={row.id} source={milestone}
                  allowed={canSaveMilestone() && !view.uncertain}
                  busy={view.busy} onSave={(draft) => begin({ kind: "save-milestone", projectId: row.id, draft })}
                  onDelete={(milestoneId) => begin({ kind: "delete-milestone", projectId: row.id, milestoneId })} />
              </Show>
            </li>}</For>
          </ul>
          <Show when={props.route.kind === "milestones" && sourceVersion() !== null}>
            <SfMilestoneEditor projectId={row.id} source={null}
              allowed={canSaveMilestone() && !view.uncertain} busy={view.busy}
              onSave={(current) => begin({ kind: "save-milestone", projectId: row.id, draft: current })}
              onDelete={() => undefined} />
          </Show>
        </Show> },
      { id: "notes", titleKey: kt("sf.u05.projects.notes"), state: "ready" as const,
        content: <p><bdi>{row.notes ?? t("sf.u05.projects.notRecorded")}</bdi></p> },
    ]
    return (
      <SfRecordDetail
        title={{ kind: "data", text: row.name }}
        secondaryId={{ kind: "data", text: row.id }}
        status={{ code: row.status ?? "unknown", text: { kind: "data", text: row.status ?? t("sf.u05.projects.notRecorded") }, tone: "neutral" }}
        metadata={[
          { id: "risk", label: { key: kt("sf.u05.projects.risk") }, value: textValue(row.risk) },
          { id: "owner", label: { key: kt("sf.u05.projects.owner") }, value: textValue(row.pm) },
        ]}
        sections={sections}
        primaryAction={canSave() && sourceVersion() !== null ? {
          id: "edit", labelKey: kt("sf.u05.projects.edit"), tone: "primary", disabled: view.busy || view.uncertain,
          busy: false, onInvoke: () => go("edit", row.id),
        } : undefined}
        secondaryActions={canDelete() && sourceVersion() !== null ? [{
          id: "delete", labelKey: kt("sf.u05.projects.delete"), tone: "danger", busy: false,
          disabled: view.busy || view.uncertain, onInvoke: () => begin({ kind: "delete-project", id: row.id }),
        }] : []}
        sourceActions={props.route.kind === "milestones" ? [] : [{
          id: "milestones", labelKey: kt("sf.u05.overview.milestones"), tone: "secondary",
          disabled: false, busy: false, onInvoke: () => go("milestones", row.id),
        }]}
        onBack={() => go("projects")}
        onOpenPage={() => go("detail", row.id)}
      />
    )
  }
  return (
    <SfPageFrame titleKey={k("sf.cap10.title")} context={[]} tabs={[]} activeTab={null}
      density="comfortable" layout="split" onLayoutMode={setLayout}
      primaryAction={canSave() ? {
        id: "create-project", labelKey: k("sf.cap10.primary"), tone: "primary", busy: false,
        disabled: view.busy || view.uncertain, onInvoke: () => go("new"),
      } : undefined}
      secondaryActions={canImport() ? [{
        id: "import", labelKey: k("sf.u05.projects.import"), tone: "secondary", busy: false,
        disabled: view.busy || view.uncertain,
        onInvoke: () => {
          const href = sfProjectHref(props.route, "imports")
          if (href && !hasDirty()) navigate(href)
        },
      }] : []}
    >
      <section class="sf-u05-projects" data-sf-projects data-sf-source="CAP10">
        <SfStatePanel state={view.state} messageKey={k("sf.u05.projects.notAvailable")}
          onRetryRead={() => setRefresh((value) => value + 1)}
        >
          <Show when={view.notice}><p role="status" class="sf-u05-notice">{t(view.notice!)}</p></Show>
          <div class="sf-u05-collection">
            <section class="sf-u05-list" aria-label={t("sf.u05.projects.filters")}>
              <form class="sf-u05-filters" onSubmit={(event) => event.preventDefault()}>
                <label>{t("sf.u05.projects.search")}
                  <input type="search" value={view.search} onInput={(event) => setView("search", event.currentTarget.value)} />
                </label>
                <label>{t("sf.u05.projects.status")}
                  <select value={view.status} onChange={(event) => setView("status", event.currentTarget.value)}>
                    <option value="">{t("sf.u05.projects.all")}</option>
                    <For each={PROJECT_STATUS}>{(status) => <option value={status}>{status}</option>}</For>
                  </select>
                </label>
                <label>{t("sf.u05.projects.show")}
                  <select value={view.filter} onChange={(event) => setView("filter", event.currentTarget.value)}>
                    <option value="">{t("sf.u05.projects.all")}</option>
                    <option value="watch">{t("sf.u05.projects.watch")}</option>
                    <option value="at-risk">{t("sf.u05.projects.atRisk")}</option>
                  </select>
                </label>
                <button class="mx-btn" type="button" onClick={() => setView({ search: "", status: "", filter: "" })}>
                  {t("sf.u05.projects.reset")}
                </button>
              </form>
              <SfDataTable rows={rows()} getRowKey={(row) => row.id as SfRef} columns={columns}
                selectedKey={selection() ? selection() as SfRef : undefined}
                sort={sort()} page={{ kind: "none", total: rows().length }}
                onSort={setSort} onPage={() => undefined}
                onSelect={(ref) => setView("selectedId", ref)}
                rowActions={(row) => canSave() && sfProjectVersion(view.page!, row.id) !== null ? [{
                  id: "edit", labelKey: kt("sf.u05.projects.edit"), tone: "secondary",
                  busy: false, disabled: view.busy || view.uncertain,
                }] : []}
                onRowAction={({ recordRef, actionId }) => {
                  if (actionId === "edit") go("edit", recordRef)
                }}
                captionKey={kt("sf.cap10.title")} density="comfortable"
                state={rows().length ? "ready" : view.page?.records.length ? "filtered-empty" : "empty"} />
            </section>
            <Show when={props.route.kind === "new"} fallback={
              <SfListDetail
                list={<div class="sf-u05-list-detail-placeholder" />}
                detail={details()}
                selectedRef={selection() ? selection() as SfRef : undefined}
                onBack={() => { setView("selectedId", null); if (props.route.kind !== "entry") go("projects") }}
                onOpenPage={() => { const row = selected(); if (row) go("detail", row.id) }}
                layoutMode={layout()}
              />
            }>
              <section class="sf-u05-new">
                <h2>{t("sf.cap10.primary")}</h2>
                <Show when={draft()}>{(controller) => <SfProjectEditor draft={controller()}
                  allowed={canSave() && !view.uncertain} busy={view.busy} review={view.reviewSave} isNew={true}
                  onReview={() => setView("reviewSave", true)} onCancelReview={() => setView("reviewSave", false)}
                  onConfirm={save} onDiscard={() => controller().discard()} />}</Show>
              </section>
            </Show>
          </div>
          <Show when={props.route.kind === "edit" && draft()}>
            {(controller) => <section class="sf-u05-edit">
              <h2>{t("sf.u05.projects.edit")}</h2>
              <SfProjectEditor draft={controller()} allowed={canSave() && sourceVersion() !== null && !view.uncertain}
                busy={view.busy} review={view.reviewSave} isNew={false}
                onReview={() => setView("reviewSave", true)} onConfirm={save}
                onCancelReview={() => setView("reviewSave", false)}
                onDiscard={() => controller().discard()} />
            </section>}
          </Show>
          <Show when={view.review}>
            <section class="sf-u05-review" role="region" aria-label={t("sf.u05.projects.review")}>
              <h3>{t(view.review?.kind === "delete-project" || view.review?.kind === "delete-milestone" ?
                "sf.u05.projects.confirmDelete" : "sf.u05.projects.confirmSave")}</h3>
              <p>{t("sf.u05.projects.review")}</p>
              <button class="mx-btn primary" type="button" disabled={view.busy || view.uncertain}
                onClick={confirmReview}>{t(view.review?.kind === "delete-project" || view.review?.kind === "delete-milestone" ?
                  "sf.u05.projects.confirmDelete" : "sf.u05.projects.confirmSave")}</button>
              <button class="mx-btn" type="button" onClick={() => setView("review", null)}>
                {t("sf.u05.projects.discard")}
              </button>
            </section>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
