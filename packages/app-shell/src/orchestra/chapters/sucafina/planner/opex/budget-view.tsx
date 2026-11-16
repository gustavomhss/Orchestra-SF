/**
 * N19/U07. OPEX and CAPEX are two closed, producer-selected sources.
 * All calculations and writes remain in the canonical planner + A02 adapter.
 * The shared SfMonthlyGrid uses 0-based months; only A02 converts to host 1..12.
 */
import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import {
  prepareSfPlannerMonthlyRange, unresolvedSfPlannerMonthlyRows,
  type SfPlannerMonthlyDraftInput,
} from "@orchestra/client/sucafina/planner/monthly"
import type {
  SfEditScopeKey, SfOperationRef, SfRef, SfIntentRef,
} from "@orchestra/schema/sucafina/context"
import { useLanguage } from "@/context/language"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState, SfMessage } from "../../shared/frame"
import { SfMonthlyGrid } from "../../shared/monthly-grid"
import type {
  SfGridCell, SfDraftCell, SfMonth, SfMonthId, SfPasteRequest, SfPasteRow,
  SfPasteState, SfCellCoordinate,
} from "../../shared/monthly-grid"
import { SfStatePanel } from "../../shared/states"
import type { SfColumn, SfMessage as SfGridMessage } from "../../shared/monthly-grid/types"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField } from "../../shared/change-review"
import type { SfPublicDraftController, SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { prepareBudgetPaste, reconcileBudgetPaste } from "./paste"
import "./budget.css"

type Page18Response = Schema.Schema.Type<(typeof SfPlanner)["operations"]["domain.page.CAP18"]["output"]>
type Page19Response = Schema.Schema.Type<(typeof SfPlanner)["operations"]["domain.page.CAP19"]["output"]>
type Page18 = Extract<Page18Response, { status: "ok" }>["value"]
type Page19 = Extract<Page19Response, { status: "ok" }>["value"]
type Page = Page18 | Page19
type BudgetGrid = NonNullable<Page18["data"]["grid"]>
type GridRow = BudgetGrid["rows"][number]
type PlanLine = Page18["data"]["lines"][number]
type PlanProject = Page19["data"]["projects"][number]
type BudgetSurface = SfSurfaceProps<"CAP18" | "CAP19">
type Edit = Readonly<{
  name: string; desc: string; owner: string; entity: string; alloc: string;
  cls: string; cur: string; el: string; proj: string; code: string;
}>
type ReviewKind = "line-save" | "project-save" | "line-delete" | "project-delete" |
  "spread" | "reset" | "closed" | "split"
type Review = Readonly<{
  kind: ReviewKind; id: string; revision: number; operationRef: SfOperationRef;
  target?: string; through?: number; nextSplit?: boolean;
}>
const key = (s: string) => s as SfCopyKey
const msg = (s: string): SfMessage => ({ key: key(s) })
const gridMsg = (s: string): SfGridMessage => ({ key: s as SfGridMessage["key"] })
const textual = (s: string) => ({ kind: "text" as const, text: { kind: "data" as const, text: s } })
const initialEdit = (row: PlanLine | PlanProject): Edit => ({
  name: row.name, desc: row.desc ?? "", owner: row.owner ?? "",
  entity: "entity" in row ? row.entity ?? "" : "",
  alloc: "alloc" in row ? row.alloc ?? "" : "",
  cls: "cls" in row ? row.cls ?? "" : "",
  cur: "cur" in row ? row.cur ?? "" : "",
  el: "el" in row ? row.el ?? "" : "",
  proj: "proj" in row ? row.proj ?? "" : "",
  code: "code" in row ? row.code ?? "" : "",
})
const cellKey = (coord: SfCellCoordinate) =>
  JSON.stringify([coord.measure, coord.month])
const fullCoverage = () => ({
  state: "complete" as const, summary: msg("sf.u07.source"), reasons: [],
  knownCount: 1, expectedCount: 1,
})
const monthlyCoverage = () => ({
  state: "complete" as const, summary: gridMsg("sf.u07.source"), reasons: [],
  knownCount: 1, expectedCount: 1,
})

export function SfBudgetView(props: BudgetSurface): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (s: string, params?: Record<string, string | number>) =>
    language.t(s as Parameters<typeof language.t>[0], params)
  const [state, setState] = createStore({
    phase: "loading" as SfUiState,
    page: null as Page | null,
    busy: false,
    uncertainty: false,
    error: "",
    refresh: 0,
    selected: "" as string,
    chosenVersion: "" as string,
    selection: null as SfCellCoordinate | null,
    selectedRange: null as Readonly<{ anchor: SfCellCoordinate; extent: SfCellCoordinate }> | null,
    paste: { phase: "idle" } as SfPasteState,
    pasteInput: null as SfPlannerMonthlyDraftInput | null,
    review: null as Review | null,
    closedChoice: 0,
    draftRevision: 0,
  })
  const editors = new Map<string, SfPublicDraftController<Edit>>()
  const monthlyDrafts = new Map<string, SfPublicDraftController<Readonly<Record<string,string>>>>()
  let lastIdentity = ""

  const isOpex = () => props.surfaceId === "CAP18"
  const projectRows = () => { const data = state.page?.data; return data && "projects" in data ? data.projects : [] }
  const splitRows = () => { const data = state.page?.data; return data && "split" in data ? data.split : [] }
  const pageName = () => isOpex() ? "OPEX" as const : "CAPEX" as const
  const currentYear = () => state.page?.selection.year ?? props.route.query.year
  const version = () => state.page?.data.selectedVersion
  const versionId = () => version()?.id ?? ""
  const grid = () => state.page?.data.grid
  const chosenId = () => state.selected || (
    "lineRef" in props.route.params ? String(props.route.params.lineRef)
      : "projectRef" in props.route.params ? String(props.route.params.projectRef) : "")
  const line = () => state.page?.data.lines.find((record) => record.id === chosenId())
  const project = () => {
    const data = state.page?.data
    return data && "projects" in data ? data.projects.find((record) => record.id === chosenId()) : undefined
  }
  const record = () => project() ?? line()
  const contextDest = () => owner.ready()?.context.destinations.find((item) =>
    item.capabilityId === props.surfaceId && item.surface === "planner" && item.page === pageName())
  const allowed = (action: "save"|"delete"|"spread"|"reset"|"import-workbook") =>
    !!owner.ready() && !!state.page && !!version() &&
    !!contextDest()?.canRead && contextDest()!.allowedActionIds.includes(action) &&
    state.page.allowedActionIds.includes(action) && !state.busy && !state.uncertainty
  const status = () => {
    const status = owner.state().status
    return status === "denied" ? "denied" as const :
      status === "unauthenticated" ? "session-expired" as const :
      status === "resolving" ? "loading" as const :
      status === "context-mismatch" ? "invalid" as const :
      status !== "ready" ? "unavailable" as const : state.phase
  }
  const pageQuery = () => ({
    ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
    ...((state.chosenVersion || props.route.query.version) ? { version: state.chosenVersion || props.route.query.version } : {}),
    ...(props.route.query.filter === undefined ? {} : { q: props.route.query.filter }),
  })
  const reload = () => setState("refresh", (n) => n + 1)

  createEffect(() => {
    const generation = owner.generation()
    const ready = owner.ready()
    const route = props.route.href
    const chosenVersion = state.chosenVersion
    state.refresh
    const identity = ready ? JSON.stringify([generation, ready.context.stamp, route]) : ""
    if (lastIdentity !== identity) {
      editors.clear()
      monthlyDrafts.clear()
      setState({ selected: "", chosenVersion: "", paste: { phase: "idle" }, pasteInput: null, review: null,
        uncertainty: false })
      lastIdentity = identity
    }
    if (!ready || !contextDest()?.canRead) {
      setState({ page: null, phase: status() })
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    setState({ page: null, phase: "loading", error: "" })
    const run = async () => {
      try {
        const client = createSfPlannerClient(ready.transport)
        const response = isOpex()
          ? await client["domain.page.CAP18"](pageQuery(), { signal: controller.signal })
          : await client["domain.page.CAP19"](pageQuery(), { signal: controller.signal })
        if (controller.signal.aborted || owner.generation() !== generation) return
        if (response.kind === "transport-error") {
          setState("phase", "unavailable")
          return
        }
        if (response.status === 403) { setState({ phase: "denied", page: null }); return }
        if (response.status === 401) { setState({ phase: "session-expired", page: null }); return }
        const body = response.body
        if (body.status !== "ok") {
          setState({ phase: body.status === "unauthenticated" ? "session-expired" :
            body.status === "needs-input" ? "invalid" : body.status,
            page: null, error: "reason" in body ? body.reason : "" })
          return
        }
        if (body.context.principalRef !== ready.context.stamp.principalRef ||
            body.context.accessRevision !== ready.context.stamp.accessRevision ||
            body.context.installationId !== ready.context.stamp.installationId) {
          setState({ phase: "stale", page: null }); return
        }
        const projection = body.value
        for (const rec of projection.data.lines) {
          const handle = editors.get(JSON.stringify([projection.selection.year, projection.data.selectedVersion?.id,rec.id]))
          handle?.receiveRemote({ baseVersion: rec.revision, value: initialEdit(rec) })
        }
        const lineRef = "lineRef" in props.route.params ? props.route.params.lineRef : undefined
        const projectRef = "projectRef" in props.route.params ? props.route.params.projectRef : undefined
        const projectRows = "projects" in projection.data ? projection.data.projects : []
        const refMissing = lineRef && !projection.data.lines.some(row => row.id === lineRef) ||
          projectRef && !projectRows.some(row => row.id === projectRef)
        setState({ page: projection, phase: refMissing ? "not-found" :
          projection.data.lines.length ? "ready" :
          (props.route.query.filter || props.route.query.element ? "filtered-empty" : "empty"),
          closedChoice: projection.data.selectedVersion?.closed ?? 0, error: "" })
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("N19 budget read failed", error instanceof Error ? error.name : "unknown")
          setState({ page: null, phase: "unavailable" })
        }
      }
    }
    void run()
  })
  createEffect(() => {
    if (owner.state().status !== "ready") {
      editors.clear()
      monthlyDrafts.clear()
      setState({ page: null, selected: "", paste: { phase: "idle" }, pasteInput: null, review: null })
    }
  })

  const getEditor = (rec: PlanLine | PlanProject) => {
    const ready = owner.ready()
    if (!ready || !state.page || !versionId()) return undefined
    const token = JSON.stringify([currentYear(), versionId(), rec.id])
    const old = editors.get(token)
    if (old) return old
    const base = initialEdit(rec)
    const acquired = ready.drafts.acquire<Edit>({
      surfaceId: props.surfaceId,
      identity: { kind: "record", recordRef: rec.id as SfRef },
      editScopeKey: JSON.stringify([currentYear(),versionId(), "metadata"]) as SfEditScopeKey,
      baseVersion: rec.revision, base, value: base,
      revalidation: {
        operationId: isOpex() ? "domain.page.CAP18" : "domain.page.CAP19",
        input: pageQuery(), fieldPaths: [project() ? "projects" : "lines"], actionIds: ["save"],
      },
    })
    editors.set(token, acquired)
    return acquired
  }
  const getCellDraft = (row: GridRow) => {
    const ready = owner.ready()
    if (!ready || !state.page || !versionId()) return undefined
    const token = JSON.stringify([currentYear(),versionId(),row.id])
    const old = monthlyDrafts.get(token)
    if (old) return old
    const initial: Readonly<Record<string,string>> = {}
    const acquired = ready.drafts.acquire({
      surfaceId: props.surfaceId,
      identity: { kind: "record", recordRef: row.id as SfRef },
      editScopeKey: JSON.stringify([currentYear(),versionId(), "monthly"]) as SfEditScopeKey,
      baseVersion: row.revision, base: initial, value: initial,
      revalidation: {
        operationId: isOpex() ? "domain.page.CAP18" : "domain.page.CAP19",
        input: pageQuery(), fieldPaths: ["grid"], actionIds: ["save"],
      },
    })
    monthlyDrafts.set(token, acquired)
    return acquired
  }
  const gridCells = createMemo<readonly SfGridCell[]>(() => {
    const source = grid()
    if (!source || !state.page) return []
    const result: SfGridCell[] = []
    const complete = monthlyCoverage()
    const writable = allowed("save")
    for (const row of source.rows) for (const month of row.cells) {
      if (!Number.isInteger(month.month) || month.month < 1 || month.month > 12) continue
      const monthIndex = (month.month - 1) as SfMonthId
      for (const measure of ["budget","actual","forecast"] as const) {
        const original = month[measure]
        const coord: SfCellCoordinate = { rowRef: row.id as SfRef, month: monthIndex, measure }
        const unit = { kind: "currency" as const, code: row.currency }
        const origin = {
          ref: row.id as SfRef, version: row.revision,
          label: { kind: "data" as const, text: row.label },
          scope: { kind: "data" as const, text: source.versionName }, coverage: complete,
        }
        const value: SfGridCell["value"] =
          original.source === "inherited-budget"
            ? { kind: "inherited", value: original.value, unit,
                sourceRef: row.id as SfRef, sourceVersion: row.revision } :
          original.value === null ? { kind: "missing", reason: gridMsg("sf.s02.missing") } :
          { kind: "known", value: original.value, unit, origin }
        result.push({
          coordinate: coord, value, fractionDigits: 2,
          permission: writable && original.editable
            ? { editable: true }
            : { editable: false, reason: gridMsg(original.editable ? "sf.u07.statusReadonly" : "sf.s02.closedMonth") },
        })
      }
    }
    return result
  })
  const sourceMonths = createMemo<readonly SfMonth[]>(() => Array.from({length:12}, (_, index) => ({
    id: index as SfMonthId, labelKey: ("sf.u07.month." + (index+1)) as SfMonth["labelKey"],
    closed: index < (grid()?.closedThrough ?? 0),
  })))
  // One keyboard tab stop owns the grid. Do not wrap at any edge or save on nav.
  const navigateCell = (event: {
    from: SfCellCoordinate
    key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End"
      | "Control+Home" | "Control+End" | "PageUp" | "PageDown"
    visibleRowCount: number
  }) => {
    const rows = grid()?.rows ?? []
    const previous = rows.findIndex((row) => row.id === event.from.rowRef)
    if (previous < 0) return
    let row = previous, month: number = event.from.month
    switch (event.key) {
      case "ArrowUp": row -= 1; break
      case "ArrowDown": row += 1; break
      case "ArrowLeft": month -= 1; break
      case "ArrowRight": month += 1; break
      case "Home": month = 0; break
      case "End": month = 11; break
      case "Control+Home": row = 0; month = 0; break
      case "Control+End": row = rows.length - 1; month = 11; break
      case "PageUp": row -= event.visibleRowCount; break
      case "PageDown": row += event.visibleRowCount; break
    }
    row = Math.max(0, Math.min(rows.length - 1, row))
    month = Math.max(0, Math.min(11, month))
    setState({ selection: { rowRef: rows[row]!.id as SfRef, month: month as SfMonthId,
      measure: event.from.measure }, selectedRange: null })
  }
  const columns: readonly SfColumn<GridRow>[] = [{
    id: "line", labelKey: "sf.u07.columns.line" as SfColumn<GridRow>["labelKey"], align: "start",
    widthPolicy: { kind: "flex", minPx: 160, weight: 1 },
    render: (row) => <span title={row.id}>{row.label}</span>,
  },{
    id: "currency", labelKey: "sf.u07.columns.currency" as SfColumn<GridRow>["labelKey"], align: "center",
    widthPolicy: { kind: "fixed", px: 64 }, render: (row) => <span>{row.currency}</span>,
  }]
  const draftCells = createMemo<readonly SfDraftCell[]>(() => {
    state.draftRevision
    if (!state.page || !grid()) return []
    const result: SfDraftCell[] = []
    for (const row of grid()!.rows) {
      const token = JSON.stringify([currentYear(),versionId(),row.id])
      const controller = monthlyDrafts.get(token)
      const snapshot = controller?.snapshot()
      if (!snapshot || snapshot.availability !== "active") continue
      for (const [encoded,text] of Object.entries(snapshot.value)) {
        const [measure,month] = JSON.parse(encoded) as ["budget"|"actual"|"forecast",SfMonthId]
        result.push({ coordinate: { rowRef: row.id as SfRef, measure, month }, text, dirty: snapshot.dirty })
      }
    }
    return result
  })
  const editCell = (event: {coordinate:SfCellCoordinate;text:string}) => {
    if (!allowed("save")) return
    const row = grid()?.rows.find((r) => r.id === event.coordinate.rowRef)
    if (!row || !gridCells().some((c) => c.coordinate.rowRef === row.id &&
      c.coordinate.month === event.coordinate.month && c.coordinate.measure === event.coordinate.measure &&
      c.permission.editable)) return
    const ctrl = getCellDraft(row)
    const snapshot = ctrl?.snapshot()
    if (snapshot?.availability === "active") {
      ctrl?.edit({ ...snapshot.value, [cellKey(event.coordinate)]: event.text })
      setState("draftRevision", (n) => n + 1)
    }
  }
  const previewRows = async (input:SfPlannerMonthlyDraftInput, original: SfPasteState) => {
    const ready = owner.ready()
    if (!ready || state.busy || state.uncertainty) return
    if (original.phase !== "review" && original.phase !== "partial" &&
        original.phase !== "conflict" && original.phase !== "failed") return
    setState({ busy: true, paste: { phase: "preparing", originalTsv: original.originalTsv, range: original.range } })
    const abort = new AbortController()
    try {
      const result = await createSfPlannerClient(ready.transport)["planner.monthly.preview"](
        { action: "preview", input }, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (result.kind === "transport-error") {
        setState({ paste: { ...original, phase: "failed" }, error: t("sf.u07.previewError") })
      } else if (result.body.status !== "ok") {
        setState({ paste: { ...original, phase: "failed" }, error: t("sf.u07.previewError") })
      } else {
        setState({ paste: reconcileBudgetPaste(original, result.body.value.rows, false),
          pasteInput: input, error: "" })
      }
    } catch (error) {
      console.error("N19 monthly preview failed", error instanceof Error ? error.name : "unknown")
      setState({ paste: { ...original, phase: "failed" }, error: t("sf.u07.previewError") })
    } finally { setState("busy", false) }
  }
  const pasteTsv = (request:SfPasteRequest) => {
    if (!allowed("save") || !grid()) return
    const plan = prepareBudgetPaste(pageName(),versionId(),grid()!.rows,gridCells(),request)
    setState({ paste: plan.state, pasteInput: null, selectedRange: request.range })
    if (plan.prepared?.status === "ready") void previewRows(plan.prepared.input, plan.state)
  }
  const previewDirtyCells = () => {
    const gridSource = grid()
    if (!gridSource || !allowed("save")) return
    const rows = gridSource.rows.flatMap((row) => {
      const snap = monthlyDrafts.get(JSON.stringify([currentYear(),versionId(),row.id]))?.snapshot()
      if (!snap || snap.availability !== "active" || !snap.dirty) return []
      const cells = Object.entries(snap.value).map(([encoded,text]) => {
        const [measure,monthIndex] = JSON.parse(encoded) as ["budget"|"actual"|"forecast",number]
        return { measure, monthIndex, text }
      })
      return cells.length ? [{rowId:row.id,revision:row.revision,cells}] : []
    })
    if (!rows.length) return
    const prepared = prepareSfPlannerMonthlyRange(pageName(),versionId(),rows)
    if (prepared.status !== "ready") { setState("error",t("sf.u07.previewError")); return }
    const origin = gridCells().find((cell) => cell.coordinate.rowRef === rows[0]?.rowId)
    if (!origin) return
    const range = { anchor: origin.coordinate, extent: origin.coordinate }
    const uiRows: SfPasteRow[] = rows.map((row) => ({
      rowRef: row.rowId as SfRef, revision: row.revision,
      cells: row.cells.map((cell) => ({
        coordinate: {rowRef:row.rowId as SfRef,month:cell.monthIndex as SfMonthId,measure:cell.measure},
        rawText: cell.text,
      })),
      result: "ready", issues: [],
    }))
    const paste: SfPasteState = { phase: "review", originalTsv: rows.flatMap((r) => r.cells.map(c => c.text)).join("\t"),
      range, rows: uiRows }
    setState({ paste, pasteInput: prepared.input })
    void previewRows(prepared.input,paste)
  }
  const applyPaste = async (rows: readonly SfPasteRow[]) => {
    const ready = owner.ready()
    const input = state.pasteInput
    const paste = state.paste
    if (!ready || !input || !allowed("save") ||
        (paste.phase !== "review" && paste.phase !== "partial" && paste.phase !== "conflict")) return
    const admitted = new Set(rows.filter((row) => row.result === "ready").map((row) => row.rowRef))
    const drafts = input.drafts.filter((row) => admitted.has(row.rowId as SfRef))
    if (!drafts.length) return
    const request = { ...input, drafts }
    setState({ busy:true, paste: { ...paste, phase: "applying" } })
    try {
      const response = await createSfPlannerClient(ready.transport)["planner.monthly.apply"](
        { action: "apply", input: request }, { signal: new AbortController().signal, idempotencyKey: crypto.randomUUID() },
      )
      const remaining = unresolvedSfPlannerMonthlyRows(request,response)
      if (remaining.status === "outcome-unknown") {
        setState({ uncertainty: true, phase: "outcome-unknown", error: t("sf.common.operationUnknown"),
          paste: { ...paste, phase: "failed" } }); return
      }
      if (remaining.status === "unavailable") {
        setState({paste: { ...paste, phase: "failed" }, error: t("sf.common.unavailable") }); return
      }
      if (response.kind !== "response" || response.body.status !== "ok") {
        setState({ paste: { ...paste, phase: "failed" }, error: t("sf.common.failed") }); return
      }
      const updated = reconcileBudgetPaste(paste,response.body.value.rows,true)
      setState({paste:updated, error: remaining.rows.length ? t("sf.u07.failedRows") : t("sf.u07.saved")})
      for (const result of response.body.value.rows) if (result.result?.ok === true) {
        const controller = monthlyDrafts.get(JSON.stringify([currentYear(),versionId(),result.draft.rowId]))
        controller?.discard()
      }
      reload() // Always read authoritative current values; never replace with simulated preview.
    } catch (error) {
      console.error("N19 monthly apply failed", error instanceof Error ? error.name : "unknown")
      setState({ uncertainty: true, phase: "outcome-unknown", error: t("sf.common.operationUnknown"),
        paste: { ...paste, phase: "failed" } })
    } finally { setState("busy", false) }
  }
  const retryFailedPaste = () => {
    // Producer CAS must first be re-read; retain text and failed rows, never replay.
    setState("error",t("sf.u07.failedRows"))
    reload()
  }

  const openReview = (kind:ReviewKind, id:string, revision:number|undefined,
    extras?:Partial<Pick<Review,"target"|"through"|"nextSplit">>) => {
    const action = kind.endsWith("delete") ? "delete" : kind === "spread" ? "spread" : kind === "reset" ? "reset" : "save"
    if (revision === undefined || !Number.isSafeInteger(revision) || !allowed(action)) return
    if (kind === "line-save" || kind === "project-save") {
      const rec = record()
      const snapshot = rec && getEditor(rec)?.snapshot()
      if (!snapshot || snapshot.availability !== "active" || snapshot.conflict ||
          snapshot.pendingOperation || snapshot.baseVersion !== revision) {
        setState({ phase: "conflict", error: t("sf.common.conflict") })
        return
      }
    }
    setState("review",{kind,id,revision,operationRef:crypto.randomUUID() as SfOperationRef,...extras})
  }
  const fields = (values: object) =>
    Object.entries(values).map(([path,value]):SfReviewField => ({
      path, label: msg("sf.u07." + path), value: textual(String(value)),
    }))
  const reviewFields = () => {
    const r=state.review
    if (!r) return [] as SfReviewField[]
    if (r.kind === "closed") return fields({period:version()?.closed ?? 0})
    if (r.kind === "split") return fields({element:r.target ?? "", split:!r.nextSplit})
    const rec = record()
    if (!rec) return []
    return fields(initialEdit(rec))
  }
  const proposedReviewFields = () => {
    const r=state.review
    if (!r) return [] as SfReviewField[]
    if (r.kind === "closed") return fields({period:r.through ?? 0})
    if (r.kind === "split") return fields({element:r.target ?? "", split:r.nextSplit ?? false})
    if (r.kind === "line-save" || r.kind === "project-save") {
      const rec=record();const snap=rec && getEditor(rec)?.snapshot()
      if (snap?.availability === "active") return fields(snap.value)
    }
    return reviewFields()
  }
  const reviewAction = () => state.review?.kind.endsWith("delete") ? "delete" as const
    : state.review?.kind === "spread" ? "spread" as const
    : state.review?.kind === "reset" ? "reset" as const : "save" as const
  const reviewOperationId = () => {
    const action=reviewAction()
    return isOpex() ?
      (action === "delete" ? "domain.command.CAP18.delete" as const :
       action === "spread" ? "domain.command.CAP18.spread" as const :
       action === "reset" ? "domain.command.CAP18.reset" as const :
       "domain.command.CAP18.save" as const) :
      (action === "delete" ? "domain.command.CAP19.delete" as const :
       action === "spread" ? "domain.command.CAP19.spread" as const :
       action === "reset" ? "domain.command.CAP19.reset" as const :
       "domain.command.CAP19.save" as const)
  }
  const submitReview = async () => {
    const r=state.review
    const ready=owner.ready()
    if (!r || !ready || !allowed(reviewAction()) || !versionId()) return
    const idem=crypto.randomUUID()
    const signal=new AbortController().signal
    const base={version:r.revision,confirmed:true as const}
    const client=createSfPlannerClient(ready.transport)
    setState({busy:true,review:null,error:""})
    try {
      const sourceRecord=record()
      let reply: {kind:string;status?:number;body?:{ok:boolean;errors?:readonly string[]}} | undefined
      if (r.kind==="line-save" && sourceRecord) {
        const snapshot=getEditor(sourceRecord)?.snapshot()
        if (snapshot?.availability!=="active") return
        const original=snapshot.base ?? initialEdit(sourceRecord)
        const values=Object.fromEntries(Object.entries(snapshot.value).filter(([field,value]) =>
          field!=="code" && value !== original[field as keyof Edit]))
        const input={...base,page:pageName(),action:"save" as const,id:r.id,
          values:{versionId:versionId(),collection:"lines" as const,...values}}
        reply=isOpex()
          ? await client["domain.command.CAP18.save"]({...input,page:"OPEX"}, {signal,idempotencyKey:idem})
          : await client["domain.command.CAP19.save"]({...input,page:"CAPEX"}, {signal,idempotencyKey:idem})
      } else if (r.kind==="project-save" && project()) {
        const snapshot=getEditor(project()!)?.snapshot()
        if (snapshot?.availability!=="active") return
        const original=snapshot.base ?? initialEdit(project()!)
        const values=Object.fromEntries(Object.entries(snapshot.value).filter(([field,value]) =>
          ["name","desc","owner","code"].includes(field) && value !== original[field as keyof Edit]))
        reply=await client["domain.command.CAP19.save"]({
          ...base,page:"CAPEX",action:"save",id:r.id,
          values:{versionId:versionId(),collection:"projects",...values},
        },{signal,idempotencyKey:idem})
      } else if (r.kind==="closed") {
        reply=await client["domain.command.CAP18.save"]({
          ...base,page:"OPEX",action:"save",
          values:{versionId:versionId(),closed:r.through ?? 0},
        },{signal,idempotencyKey:idem})
      } else if (r.kind==="split") {
        reply=await client["domain.command.CAP18.save"]({
          ...base,page:"OPEX",action:"save",
          values:{versionId:versionId(),el:r.target ?? "",split:r.nextSplit ?? false},
        },{signal,idempotencyKey:idem})
      } else {
        const values={versionId:versionId(),collection:r.kind==="project-delete" ? "projects" as const : "lines" as const}
        const action=r.kind.endsWith("delete") ? "delete" as const : r.kind==="spread" ? "spread" as const : "reset" as const
        if (isOpex()) {
          if (action==="delete") reply=await client["domain.command.CAP18.delete"]({...base,page:"OPEX",action,id:r.id,values:{...values,collection:"lines"}},{signal,idempotencyKey:idem})
          else if (action==="spread") reply=await client["domain.command.CAP18.spread"]({...base,page:"OPEX",action,id:r.id,values:{...values,collection:"lines"}},{signal,idempotencyKey:idem})
          else reply=await client["domain.command.CAP18.reset"]({...base,page:"OPEX",action,id:r.id,values:{...values,collection:"lines"}},{signal,idempotencyKey:idem})
        } else {
          if (action==="delete") reply=await client["domain.command.CAP19.delete"]({...base,page:"CAPEX",action,id:r.id,values},{signal,idempotencyKey:idem})
          else if (action==="spread") reply=await client["domain.command.CAP19.spread"]({...base,page:"CAPEX",action,id:r.id,values:{...values,collection:"lines"}},{signal,idempotencyKey:idem})
          else reply=await client["domain.command.CAP19.reset"]({...base,page:"CAPEX",action,id:r.id,values:{...values,collection:"lines"}},{signal,idempotencyKey:idem})
        }
      }
      if (!reply) return
      if (reply.kind==="transport-error") {
        setState({phase:"outcome-unknown",uncertainty:true,error:t("sf.common.operationUnknown")})
      } else if (!(reply.status!>=200 && reply.status!<300 && reply.body?.ok===true)) {
        setState({phase:reply.status===409?"conflict":reply.status===403?"denied":"invalid",
          error:reply.body?.errors?.join("; ")??t("sf.common.failed")})
      } else {
        if (sourceRecord) getEditor(sourceRecord)?.discard()
        setState({phase:"loading",error:t("sf.u07.saved")})
        reload()
      }
    } catch(error) {
      console.error("N19 budget mutation failed",error instanceof Error?error.name:"unknown")
      setState({phase:"outcome-unknown",uncertainty:true,error:t("sf.common.operationUnknown")})
    } finally { setState("busy",false) }
  }

  const activeRecord = () => {
    const rec=record()
    const snap=rec && getEditor(rec)?.snapshot()
    return snap?.availability==="active" ? snap : undefined
  }
  const documentTitle = () => isOpex() ? "sf.cap18.title" : "sf.cap19.title"
  const fieldNames = () => project()
    ? ["name","desc","owner","code"] as const :
      ["name","desc","owner","entity","alloc","cls","cur","el","proj"] as const
  const review = () => state.review
  const note = () => state.phase === "outcome-unknown" ? "sf.common.operationUnknown" :
    state.phase === "denied" ? "sf.common.noAccess" :
    state.phase === "session-expired" ? "sf.common.loginAgain" :
    state.phase === "loading" ? "sf.common.loading" :
    state.phase === "empty" ? "sf.common.empty" :
    state.phase === "conflict" ? "sf.common.conflict" :
    state.phase === "invalid" ? "sf.common.fieldErrorSummary" :
    state.phase === "not-found" ? "sf.u07.notFound" : "sf.common.unavailable"
  return (
    <SfPageFrame
      titleKey={key(documentTitle())}
      context={[
        {id:"year",label:msg("sf.u07.year"),value:{kind:"data",text:String(currentYear()??"")}},
        {id:"version",label:msg("sf.u07.version"),value:{kind:"data",text:version()?.name??""}},
      ]}
      tabs={[]} activeTab={null} secondaryActions={[]}
      primaryAction={{
        id:"review-dirty",labelKey:key(isOpex()?"sf.cap18.primary":"sf.cap19.primary"),tone:"primary",
        disabled:!allowed("save") || !draftCells().some((cell)=>cell.dirty), busy:state.busy,
        onInvoke:previewDirtyCells,
      }}
      density="comfortable" layout="work" onLayoutMode={()=>undefined}
    >
      <SfStatePanel state={status()} messageKey={key(note())} onRetryRead={reload}>
        <Show when={state.page}>
          {(page) => <div class="sf-u07" data-sf-surface={props.surfaceId}>
            <section class="sf-u07-toolbar">
              <label>{t("sf.u07.version")}
                <select value={page().data.selectedVersion?.id ?? ""} disabled={state.busy || state.uncertainty}
                  onChange={(event) => setState({ chosenVersion: event.currentTarget.value,
                    selected: "", review: null, paste: { phase: "idle" }, pasteInput: null })}>
                  <For each={page().data.versions}>{(entry) =>
                    <option value={entry.id}>{entry.name} · {entry.year}</option>}
                  </For>
                </select>
              </label>
              <Show when={allowed("import-workbook")} fallback={<span aria-disabled="true">{t("sf.u07.import")}</span>}>
                <a class="mx-btn" href="/orchestra/sf-imports/new">{t("sf.u07.import")}</a>
              </Show>
              <Show when={isOpex()}>
                <label>{t("sf.u07.period")}
                  <select disabled={!allowed("save")} value={state.closedChoice}
                    onChange={(e)=>setState("closedChoice",Number(e.currentTarget.value))}>
                    <For each={Array.from({length:13},(_,i)=>i)}>{(n)=><option value={n}>{n}</option>}</For>
                  </select>
                </label>
                <button class="mx-btn" type="button" disabled={!allowed("save") || !versionId()}
                  onClick={()=>openReview("closed","",page().versions[`versions:${versionId()}`]?.version,
                    {through:state.closedChoice})}>{t("sf.common.review")}</button>
              </Show>
            </section>
            <Show when={grid()} fallback={<p role="status">{t("sf.u07.noData")}</p>}>
              {(monthly)=><section aria-labelledby="sf-u07-months">
                <h2 id="sf-u07-months">{t("sf.u07.months")}</h2>
                <SfMonthlyGrid
                  rows={monthly().rows}
                  months={sourceMonths()} columns={columns}
                  getRowKey={(row)=>row.id as SfRef}
                  cells={gridCells()} draftCells={draftCells()}
                  activeCell={state.selection} selectedRange={state.selectedRange}
                  paste={state.paste}
                  onSelectRange={(range)=>setState({selectedRange:range,selection:range?.anchor??null})}
                  onPasteTsv={pasteTsv}
                  onApplyPastedRows={(rows)=>void applyPaste(rows)}
                  onRetryFailedPasteRows={retryFailedPaste}
                  onCancelPaste={()=>setState({paste:{phase:"idle"},pasteInput:null})}
                  onNavigate={navigateCell}
                  onEdit={editCell} onCommitCell={editCell} onCancelCell={()=>undefined}
                  onOpenRow={(rowRef)=>setState("selected",String(rowRef))}
                  readOnlyReason={allowed("save")?undefined:gridMsg("sf.u07.statusReadonly")}
                  state={status()}
                />
              </section>}
            </Show>
            <section aria-labelledby="sf-u07-lines">
              <h2 id="sf-u07-lines">{t("sf.u07.lines")}</h2>
              <div class="sf-u07-table-scroll" role="region" tabIndex={0}>
                <table><thead><tr>
                  <th>{t("sf.u07.columns.line")}</th><th>{t("sf.u07.columns.owner")}</th>
                  <th>{t(isOpex()?"sf.u07.columns.element":"sf.u07.columns.project")}</th>
                  <th>{t("sf.u07.columns.currency")}</th><th>{t("sf.u07.columns.id")}</th>
                  <th>{t("sf.common.showDetails")}</th>
                </tr></thead><tbody>
                  <For each={page().data.lines}>{(rec)=><tr>
                    <th scope="row">{rec.name}</th>
                    <td>{rec.owner??"—"}</td>
                    <td>{isOpex()?rec.el??"—":rec.proj??"—"}</td>
                    <td>{rec.cur??"—"}</td><td><code>{rec.id}</code></td>
                    <td><button type="button" class="mx-btn" onClick={()=>setState("selected",rec.id)}>
                      {t("sf.common.showDetails")}
                    </button></td>
                  </tr>}</For>
                </tbody></table>
              </div>
            </section>
            <Show when={!isOpex() && "projects" in page().data}>
              <section><h2>{t("sf.u07.projects")}</h2>
                <div class="sf-u07-project-list">
                  <For each={projectRows()}>{(p)=>
                    <button type="button" class="mx-btn" onClick={()=>setState("selected",p.id)}>
                      {p.name} · {p.code??p.id}
                    </button>}
                  </For>
                </div>
              </section>
            </Show>
            <Show when={isOpex() && "split" in page().data}>
              <section><h2>{t("sf.u07.structure")}</h2>
                <ul><For each={splitRows()}>{(element)=><li>
                  <span>{element.element} · {t("sf.u07.split")}: {String(element.split)}</span>
                  <button class="mx-btn" type="button" disabled={!allowed("save")}
                    onClick={()=>openReview("split","",element.revision,
                      {target:element.element,nextSplit:!element.split})}>{t("sf.common.review")}</button>
                </li>}</For></ul>
              </section>
            </Show>
            <Show when={record()}>
              {(rec)=><section class="sf-u07-detail">
                <h2>{rec().name}</h2>
                <p><code>{rec().id}</code> · {t("sf.u07.currentVersion")}: {rec().revision}</p>
                <Show when={activeRecord()}>
                  {(draft)=><form onSubmit={(event)=>{
                    event.preventDefault()
                    openReview(project()?"project-save":"line-save",rec().id,rec().revision)
                  }}>
                    <div class="sf-u07-form-fields">
                      <For each={fieldNames()}>{(field)=><label>
                        {t("sf.u07."+(field==="desc"?"description":field==="cur"?"currency":field==="alloc"?"allocation":field==="cls"?"classification":field==="el"?"element":field==="proj"?"project":field))}
                        <input value={draft().value[field]} disabled={!allowed("save")}
                          onInput={(event)=>{
                            const ctrl=getEditor(rec())
                            const snapshot=ctrl?.snapshot()
                            if(snapshot?.availability==="active")ctrl?.edit({...snapshot.value,[field]:event.currentTarget.value})
                          }}/>
                      </label>}</For>
                    </div>
                    <div class="sf-u07-actions">
                      <button type="submit" class="mx-btn primary" disabled={!allowed("save")||!draft().dirty}>
                        {t("sf.common.review")}
                      </button>
                      <button type="button" class="mx-btn" onClick={()=>getEditor(rec())?.discard()}>
                        {t("sf.common.discard")}
                      </button>
                      <button type="button" class="mx-btn" disabled={!allowed("delete")}
                        onClick={()=>openReview(project()?"project-delete":"line-delete",rec().id,rec().revision)}>
                        {t("sf.u07.delete")}
                      </button>
                      <Show when={!project() && !rec().id.startsWith("HR:")}>
                        <button type="button" class="mx-btn" disabled={!allowed("spread")}
                          onClick={()=>openReview("spread",rec().id,rec().revision)}>{t("sf.u07.spread")}</button>
                        <button type="button" class="mx-btn" disabled={!allowed("reset")}
                          onClick={()=>openReview("reset",rec().id,rec().revision)}>{t("sf.u07.reset")}</button>
                      </Show>
                    </div>
                  </form>}
                </Show>
              </section>}
            </Show>
          </div>}
        </Show>
      </SfStatePanel>
      <Show when={state.error}><p role="status" class="sf-u07-error">{state.error}</p></Show>
      <Show when={review()}>
        {(r)=><div class="sf-u07-review">
          <p>{t("sf.u07.reviewScope")}</p>
          <Show when={r().kind==="spread"||r().kind==="reset"}><p>{t("sf.u07.noPreview")}</p></Show>
          <SfChangeReview
            operation={{ref:r().operationRef,label:msg(isOpex()?"sf.cap18.primary":"sf.cap19.primary"),
              scope:{kind:"data",text:versionId()}}}
            base={{kind:"persisted",ref:(r().id||versionId()) as SfRef,
              version:r().revision,fields:reviewFields()}}
            current={{kind:"persisted",ref:(r().id||versionId()) as SfRef,
              version:r().revision,fields:reviewFields()}}
            proposed={{kind:"draft",intentRef:r().operationRef as unknown as SfIntentRef,
              sourceRef:(r().id||versionId()) as SfRef,sourceVersion:r().revision,
              fields:proposedReviewFields()}}
            effects={[]}
            coverage={fullCoverage()}
            blockingReasons={allowed(reviewAction())?[]:[msg("sf.u07.readDenied")]}
            confirmation={allowed(reviewAction())?{kind:"admitted",
              labelKey:key(isOpex()?"sf.cap18.primary":"sf.cap19.primary"),purpose:reviewAction(),
              binding:{kind:"catalog-command",operationId:reviewOperationId(),
                version:{kind:"record",expectedVersion:r().revision},confirmation:"presentation-only"}}:
              {kind:"blocked",labelKey:key(isOpex()?"sf.cap18.primary":"sf.cap19.primary"),
                reasons:[msg("sf.u07.readDenied")]}}
            state={state.phase}
            onConfirm={()=>void submitReview()}
            onRevise={()=>setState("review",null)}
            onCancel={()=>setState("review",null)}
          />
        </div>}
      </Show>
    </SfPageFrame>
  )
}
