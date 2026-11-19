import { createMemo, For, Show } from "solid-js"
import "./queue.css"
import type { JSX } from "solid-js"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import { SfListDetail, SfRecordDetail } from "../../shared/detail"
import type { SfU10QueueCopyKey } from "./copy"
import {
  sfQueueFilterOptions,
  sfQueueMeasuredWait,
  sfQueueVisible,
} from "./model"
import type {
  SfProcurementQueueFilters,
  SfProcurementQueueGroup,
  SfProcurementQueueReadPhase,
  SfProcurementQueueRow,
} from "./model"

type FrameProps = Parameters<typeof SfPageFrame>[0]
type StateProps = Parameters<typeof SfStatePanel>[0]
type TableProps = Parameters<typeof SfDataTable<SfProcurementQueueRow>>[0]
type CopyKey = FrameProps["titleKey"]
type SharedKey =
  | "sf.cap24.title" | "sf.cap24.primary"
  | "sf.common.loading" | "sf.common.empty" | "sf.common.filterEmpty"
  | "sf.common.partial" | "sf.common.unavailable" | "sf.common.noAccess"
  | "sf.common.loginAgain" | "sf.common.invalidLink" | "sf.common.removed"
  | "sf.common.stale" | "sf.common.conflict" | "sf.common.operationUnknown"
  | "sf.common.source" | "sf.common.returnToList" | "sf.common.unknown"

const copyKey = (value: SfU10QueueCopyKey | SharedKey): CopyKey => value as CopyKey

/** Only keys verified in this leaf dictionary or the frozen shared/manifest copy. */
const STATUS_KEYS = {
  draft: "sf.u10.queue.status.draft",
  pr_pending: "sf.u10.queue.status.pr_pending",
  pr_rejected: "sf.u10.queue.status.pr_rejected",
  sourcing: "sf.u10.queue.status.sourcing",
  src_pending: "sf.u10.queue.status.src_pending",
  src_rejected: "sf.u10.queue.status.src_rejected",
  po_draft: "sf.u10.queue.status.po_draft",
  po_pending: "sf.u10.queue.status.po_pending",
  po_rejected: "sf.u10.queue.status.po_rejected",
  po_approved: "sf.u10.queue.status.po_approved",
  po_issued: "sf.u10.queue.status.po_issued",
  cancelled: "sf.u10.queue.status.cancelled",
} as const satisfies Record<string, SfU10QueueCopyKey>

const GROUP_LABELS: Record<SfProcurementQueueGroup, SfU10QueueCopyKey> = {
  waitingForYou: "sf.u10.queue.group.waitingForYou",
  waitingForOthers: "sf.u10.queue.group.waitingForOthers",
  unassigned: "sf.u10.queue.group.unassigned",
}

const STATE_COPY: Record<SfProcurementQueueReadPhase | "empty" | "filtered-empty", SharedKey | SfU10QueueCopyKey> = {
  loading: "sf.common.loading",
  ready: "sf.u10.queue.caption",
  partial: "sf.common.partial",
  empty: "sf.common.empty",
  "filtered-empty": "sf.common.filterEmpty",
  unavailable: "sf.common.unavailable",
  denied: "sf.common.noAccess",
  "session-expired": "sf.common.loginAgain",
  invalid: "sf.common.invalidLink",
  "not-found": "sf.common.removed",
  stale: "sf.common.stale",
  conflict: "sf.common.conflict",
  "outcome-unknown": "sf.common.operationUnknown",
}

export type SfProcurementQueuePanelProps = Readonly<{
  // Ready/partial rows MUST be an A03 authorized projection for this owner.
  // This presentation component cannot admit a record or determine "my" holder.
  phase: SfProcurementQueueReadPhase
  rows: readonly SfProcurementQueueRow[]
  filters: SfProcurementQueueFilters
  selectedRef?: SfRef
  context: FrameProps["context"]
  tabs: FrameProps["tabs"]
  activeTab: FrameProps["activeTab"]
  density: FrameProps["density"]
  layoutMode: Parameters<typeof SfListDetail>[0]["layoutMode"]
  coverage?: StateProps["coverage"]
  page: TableProps["page"]
  sort: TableProps["sort"]
  onLayoutMode: FrameProps["onLayoutMode"]
  onFilters: (next: SfProcurementQueueFilters) => void
  onSelect: (ref: SfRef) => void
  onBack: () => void
  onSort: TableProps["onSort"]
  onPage: TableProps["onPage"]
  onRetryRead?: () => void
  // F01 owns both same-owner route building and the transition/LeaveGuard.
  // W12 does not assemble href strings, read principal IDs or dispatch commands.
  canOpenSource: (row: SfProcurementQueueRow) => boolean
  onOpenSource: (row: SfProcurementQueueRow) => void
  onOpenRequests?: () => void
  translate: (key: SfU10QueueCopyKey) => string
}>

export function SfProcurementQueuePanel(props: SfProcurementQueuePanelProps): JSX.Element {
  const visible = createMemo(() =>
    sfQueueVisible(props.phase, props.rows, props.filters, props.selectedRef),
  )
  const countedPage = createMemo((): TableProps["page"] => {
    const count = visible().rows.length
    const page = props.page
    if (page.kind === "cursor")
      return { ...page, total: count, from: count === 0 ? null : 1, to: count === 0 ? null : count }
    return { ...page, total: count }
  })
  const authorized = createMemo(() =>
    visible().state === "ready" || visible().state === "empty" ||
    visible().state === "filtered-empty" || visible().state === "partial",
  )
  const options = createMemo(() =>
    sfQueueFilterOptions(authorized() ? props.rows : []),
  )
  const missing = () => props.translate("sf.u10.queue.noTitle")
  const display = (value: string | null): string => value === null ? missing() : value
  const statusLabel = (status: string | null): string => {
    if (status === null) return missing()
    if (Object.hasOwn(STATUS_KEYS, status))
      return props.translate(STATUS_KEYS[status as keyof typeof STATUS_KEYS])
    return status // literal unrecognized source status; never collapse or invent a stage
  }
  const holderLabel = (row: SfProcurementQueueRow): string =>
    row.holder === null ? props.translate("sf.u10.queue.unassigned") : row.holder
  const submittedLabel = (row: SfProcurementQueueRow): string =>
    row.submittedAmount === null
      ? missing()
      : [String(row.submittedAmount), row.submittedCurrency ?? missing()].join(" ")
  const waitLabel = (row: SfProcurementQueueRow): string => {
    const measured = sfQueueMeasuredWait(row)
    return measured.kind === "unavailable"
      ? missing()
      : [measured.at, "·", String(measured.days), props.translate("sf.u10.queue.days")].join(" ")
  }

  const columns: TableProps["columns"] = [
    {
      id: "request", labelKey: copyKey("sf.u10.queue.request"), align: "start",
      widthPolicy: { kind: "content", minPx: 100, maxPx: 240 },
      render: (row) => <a
        href={"?request=" + encodeURIComponent(row.id) + "#" + encodeURIComponent(row.id)}
        data-source-ref={row.sourceRef ?? undefined}
        data-source-digest={row.sourceDigest ?? undefined}
        data-source-version={row.sourceVersion === null ? undefined : String(row.sourceVersion)}
      >{row.id}</a>,
    },
    {
      id: "value-basis", labelKey: copyKey("sf.u10.queue.valueBasis"), align: "start",
      widthPolicy: { kind: "content", minPx: 140, maxPx: 240 },
      render: (row) => <span>{display(row.monetaryState)}</span>,
    },
    {
      id: "amount", labelKey: copyKey("sf.u10.queue.amount"), align: "end",
      widthPolicy: { kind: "content", minPx: 100, maxPx: 200 },
      render: (row) => <span>{row.baseAmount === null
        ? missing() : String(row.baseAmount) + " " + (row.baseCurrency ?? missing())}</span>,
    },
    {
      id: "subject", labelKey: copyKey("sf.u10.queue.subject"), align: "start",
      widthPolicy: { kind: "flex", minPx: 160, weight: 2 },
      render: (row) => <span>{display(row.subject)}</span>,
    },
    {
      id: "status", labelKey: copyKey("sf.u10.queue.status"), align: "start",
      widthPolicy: { kind: "content", minPx: 130, maxPx: 220 },
      render: (row) => <span>{statusLabel(row.status)}</span>,
    },
    {
      id: "stage", labelKey: copyKey("sf.u10.queue.stage"), align: "start",
      widthPolicy: { kind: "content", minPx: 110, maxPx: 200 },
      render: (row) => <span>{display(row.approvalStage)}</span>,
    },
    {
      id: "holder", labelKey: copyKey("sf.u10.queue.holder"), align: "start",
      widthPolicy: { kind: "content", minPx: 120, maxPx: 220 },
      render: (row) => <span>{holderLabel(row)}</span>,
    },
    {
      id: "waiting", labelKey: copyKey("sf.u10.queue.waiting"), align: "start",
      widthPolicy: { kind: "content", minPx: 145, maxPx: 230 },
      render: (row) => <span>{waitLabel(row)}</span>,
    },
    {
      id: "next", labelKey: copyKey("sf.u10.queue.next"), align: "start",
      widthPolicy: { kind: "flex", minPx: 150, weight: 1 },
      render: (row) => <span>{display(row.nextStep)}</span>,
    },
  ]

  const canOpen = (row: SfProcurementQueueRow) =>
    authorized() && props.canOpenSource(row)

  const table = (
    <SfDataTable<SfProcurementQueueRow>
      rows={visible().rows}
      getRowKey={(row) => row.id}
      columns={columns}
      selectedKey={visible().selected?.id}
      sort={props.sort}
      page={countedPage()}
      onSort={props.onSort}
      onPage={props.onPage}
      onSelect={(ref) => { if (authorized() && props.rows.some((row) => row.id === ref)) props.onSelect(ref) }}
      rowActions={(row) => canOpen(row) ? [{
        id: "open-source",
        labelKey: copyKey("sf.common.source"),
        tone: "secondary",
        disabled: false,
        busy: false,
      }] : []}
      onRowAction={({ recordRef, actionId }) => {
        if (actionId !== "open-source") return
        const row = visible().rows.find((entry) => entry.id === recordRef)
        if (row && canOpen(row)) props.onOpenSource(row)
      }}
      captionKey={copyKey("sf.u10.queue.caption")}
      density={props.density}
      state={visible().state}
    />
  )

  const metadataFor = (row: SfProcurementQueueRow): Parameters<typeof SfRecordDetail>[0]["metadata"] => [
    { id: "request", label: { key: copyKey("sf.u10.queue.request") },
      value: { kind: "text", text: { kind: "data", text: row.id } } },
    { id: "version", label: { key: copyKey("sf.u10.queue.version") },
      value: { kind: "text", text: { kind: "data", text: row.version === null ? missing() : String(row.version) } } },
    { id: "money", label: { key: copyKey("sf.u10.queue.moneySentence") },
      value: { kind: "text", text: { kind: "data", text: display(row.moneySentence) } } },
    { id: "holder", label: { key: copyKey("sf.u10.queue.holder") },
      value: { kind: "text", text: { kind: "data", text: holderLabel(row) } } },
    { id: "stage", label: { key: copyKey("sf.u10.queue.stage") },
      value: { kind: "text", text: { kind: "data", text: display(row.approvalStage) } } },
    { id: "amount", label: { key: copyKey("sf.u10.queue.amount") },
      value: { kind: "text", text: { kind: "data", text: submittedLabel(row) } } },
    { id: "reason", label: { key: copyKey("sf.u10.queue.reason") },
      value: { kind: "text", text: { kind: "data", text: display(row.reason) } } },
    { id: "waiting", label: { key: copyKey("sf.u10.queue.waiting") },
      value: { kind: "text", text: { kind: "data", text: waitLabel(row) } } },
    { id: "next", label: { key: copyKey("sf.u10.queue.next") },
      value: { kind: "text", text: { kind: "data", text: display(row.nextStep) } } },
  ]

  const detail = (row: SfProcurementQueueRow) => (
    <SfRecordDetail
      title={row.subject === null
        ? { kind: "message", message: { key: copyKey("sf.common.unknown") } }
        : { kind: "data", text: row.subject }}
      secondaryId={{ kind: "data", text: row.id }}
      status={{
        code: row.status ?? "unavailable",
        text: { kind: "data", text: statusLabel(row.status) },
        tone: "neutral",
      }}
      metadata={metadataFor(row)}
      sections={[]}
      secondaryActions={[]}
      sourceActions={canOpen(row) ? [{
        id: "open-source", labelKey: copyKey("sf.common.source"),
        tone: "secondary", disabled: false, busy: false,
        onInvoke: () => { if (canOpen(row)) props.onOpenSource(row) },
      }] : []}
      onBack={props.onBack}
      onOpenPage={() => { if (canOpen(row)) props.onOpenSource(row) }}
    />
  )

  return (
    <SfPageFrame
      titleKey={copyKey("sf.cap24.title")}
      context={authorized() ? props.context : []}
      tabs={authorized() ? props.tabs : []}
      activeTab={props.activeTab}
      primaryAction={authorized() && props.onOpenRequests ? {
        id: "open-requests",
        labelKey: copyKey("sf.cap24.primary"),
        tone: "primary",
        disabled: false,
        busy: false,
        onInvoke: props.onOpenRequests,
      } : undefined}
      secondaryActions={[]}
      density={props.density}
      layout="work"
      onLayoutMode={props.onLayoutMode}
    >
      <Show when={authorized()}>
        <fieldset class="sf-procurement-queue-filters" aria-label={props.translate("sf.u10.queue.filters")}>
          <legend>{props.translate("sf.u10.queue.filters")}</legend>
          <label>
            {props.translate("sf.u10.queue.group")}
            <select
              value={props.filters.group ?? ""}
              onChange={(event) => props.onFilters({
                ...props.filters,
                group: options().groups.find((value) => value === event.currentTarget.value) ?? null,
              })}
            >
              <option value="">{props.translate("sf.u10.queue.all")}</option>
              <For each={options().groups}>{(group) =>
                <option value={group}>{props.translate(GROUP_LABELS[group])}</option>
              }</For>
            </select>
          </label>
          <label>
            {props.translate("sf.u10.queue.status")}
            <select
              value={props.filters.status ?? ""}
              onChange={(event) =>
                props.onFilters({ ...props.filters, status: event.currentTarget.value || null })}
            >
              <option value="">{props.translate("sf.u10.queue.all")}</option>
              <For each={options().statuses}>{(status) =>
                <option value={status}>{statusLabel(status)}</option>
              }</For>
            </select>
          </label>
          <label>
            {props.translate("sf.u10.queue.stage")}
            <select
              value={props.filters.stage ?? ""}
              onChange={(event) =>
                props.onFilters({ ...props.filters, stage: event.currentTarget.value || null })}
            >
              <option value="">{props.translate("sf.u10.queue.all")}</option>
              <For each={options().stages}>{(stage) =>
                <option value={stage}>{stage}</option>
              }</For>
            </select>
          </label>
          <label>
            {props.translate("sf.u10.queue.search")}
            <input
              type="search"
              value={props.filters.query}
              onInput={(event) =>
                props.onFilters({ ...props.filters, query: event.currentTarget.value })}
            />
          </label>
        </fieldset>
      </Show>
      <SfStatePanel
        state={visible().state}
        messageKey={copyKey(STATE_COPY[visible().state])}
        coverage={props.coverage}
        onRetryRead={props.onRetryRead}
        onBack={props.onBack}
      >
        <Show when={visible().selected} fallback={table}>
          {(selection) =>
            <SfListDetail
              list={table}
              detail={detail(selection())}
              selectedRef={selection().id}
              layoutMode={props.layoutMode}
              onBack={props.onBack}
              onOpenPage={() => {
                if (canOpen(selection())) props.onOpenSource(selection())
              }}
            />
          }
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
