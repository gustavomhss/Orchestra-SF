/**
 * S02 / SfMonthlyGrid — pure, owner-controlled Solid presentation.
 * Product target: packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/index.tsx
 *
 * Does not fetch, parse financial numbers, map month IDs, claim grants, retry
 * network mutations, or persist drafts. The A02 producer adapter alone maps
 * 0-based grid months to 1-based MonthlyDraft months and owns preview/apply.
 */
import { createEffect, createMemo, createUniqueId, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfCopyKey } from "../frame/types"
import { SfStatePanel } from "../states"
import type {
  SfCellCoordinate, SfDraftCell, SfGridCell, SfGridNavigation,
  SfGridRange, SfMessage, SfMonthlyGridProps, SfUnit,
} from "./types"
import "./monthly-grid.css"

export type {
  SfMonthId, SfMonth, SfCellCoordinate, SfCellValue, SfGridCell, SfDraftCell,
  SfGridNavigation, SfGridRange, SfMessage, SfPasteMeasure, SfPasteCell, SfPasteRow,
  SfPasteState, SfPasteRequest, SfMonthlyGridProps,
} from "./types"

const SAME_CELL = (left: SfCellCoordinate, right: SfCellCoordinate) =>
  left.rowRef === right.rowRef && left.month === right.month && left.measure === right.measure

const COPY_MEASURE = {
  budget: "sf.s02.measure.budget",
  actual: "sf.s02.measure.actual",
  forecast: "sf.s02.measure.forecast",
  fte: "sf.s02.measure.fte",
  cost: "sf.s02.measure.cost",
} as const

/** The 0..11 month identity is unchanged across this entire component. */
export function SfMonthlyGrid<Row>(props: SfMonthlyGridProps<Row>): JSX.Element {
  const language = useLanguage()
  // 114 registers SF_S02_COPY and F03 common keys into the typed dictionary.
  const t = (key: string, params?: Record<string, string | number>) =>
    language.t(key as Parameters<typeof language.t>[0], params)
  const message = (value: SfMessage) => t(value.key, value.params)
  const id = createUniqueId()
  const [local, setLocal] = createStore({
    editing: null as SfCellCoordinate | null,
    text: "",
    mobileTsv: "",
    rejectedTsv: "",
    pasteError: null as "overflow" | "noAnchor" | "unsupported" | "irregular" | null,
  })
  let focusTarget: HTMLDivElement | undefined
  let scroller: HTMLDivElement | undefined

  const protectedState = () => props.state === "denied" || props.state === "session-expired"
  // Do not retain local clipboard/editor text across an access boundary.
  createEffect(() => {
    if (protectedState()) setLocal({ editing: null, text: "", mobileTsv: "", rejectedTsv: "", pasteError: null })
  })
  const readable = () => props.state === "ready" || props.state === "partial"
    || props.state === "stale" || props.state === "conflict" || props.state === "outcome-unknown"
  const monthShapeValid = () => props.months.length === 12 && props.months.every((month, index) => month.id === index)
  const writable = () => (props.state === "ready" || props.state === "partial") && !props.readOnlyReason && monthShapeValid() && props.paste.phase !== "applying"

  // Identity is the source's opaque row ref and canonical month ID, never array index.
  const rowIndex = (ref: SfCellCoordinate["rowRef"]) =>
    props.rows.findIndex((row) => props.getRowKey(row) === ref)
  const monthIndex = (month: SfCellCoordinate["month"]) =>
    props.months.findIndex((item) => item.id === month)
  // Index once per owner projection: a full 12-month grid must not scan every
  // cell for each rendered row/month or on every authorized clipboard copy.
  const cellIndex = createMemo(() => {
    const byRow = new Map<SfCellCoordinate["rowRef"], Map<SfCellCoordinate["month"], SfGridCell[]>>()
    props.cells.forEach((cell) => {
      const months = byRow.get(cell.coordinate.rowRef) ?? new Map<SfCellCoordinate["month"], SfGridCell[]>()
      const cells = months.get(cell.coordinate.month) ?? []
      cells.push(cell)
      months.set(cell.coordinate.month, cells)
      byRow.set(cell.coordinate.rowRef, months)
    })
    return byRow
  })
  const cellVariants = (ref: SfCellCoordinate["rowRef"], month: SfCellCoordinate["month"]) =>
    cellIndex().get(ref)?.get(month) ?? []
  const draftIndex = createMemo(() => new Map(props.draftCells.map((draft) =>
    [JSON.stringify([draft.coordinate.rowRef, draft.coordinate.month, draft.coordinate.measure]), draft] as const)))
  const draftFor = (coordinate: SfCellCoordinate): SfDraftCell | undefined =>
    draftIndex().get(JSON.stringify([coordinate.rowRef, coordinate.month, coordinate.measure]))
  const activeId = createMemo(() => {
    const coordinate = props.activeCell
    if (!coordinate || rowIndex(coordinate.rowRef) < 0 || monthIndex(coordinate.month) < 0) return undefined
    return id + "-r" + rowIndex(coordinate.rowRef) + "-m" + monthIndex(coordinate.month)
  })
  const selected = (coordinate: SfCellCoordinate) => {
    const range = props.selectedRange
    if (!range) return props.activeCell ? SAME_CELL(props.activeCell, coordinate) : false
    const row = rowIndex(coordinate.rowRef)
    const month = monthIndex(coordinate.month)
    const a = rowIndex(range.anchor.rowRef)
    const b = rowIndex(range.extent.rowRef)
    const left = monthIndex(range.anchor.month)
    const right = monthIndex(range.extent.month)
    if (Math.min(a, b, left, right) < 0) return false
    return row >= Math.min(a, b) && row <= Math.max(a, b)
      && month >= Math.min(left, right) && month <= Math.max(left, right)
  }

  const canEdit = (cell: SfGridCell) => writable()
    && cell.permission.editable
    && props.months.some((month) => month.id === cell.coordinate.month && !month.closed)
    && cell.coordinate.measure !== "actual" // actuals never become budget draft commands

  const startEdit = (cell: SfGridCell) => {
    if (!canEdit(cell)) return
    const source = draftFor(cell.coordinate)
    setLocal({
      editing: cell.coordinate,
      text: source ? source.text : cell.value.kind === "known" ? String(cell.value.value) : "",
    })
  }
  const cancelEdit = () => {
    const coordinate = local.editing
    if (!coordinate) return
    props.onCancelCell(coordinate)
    setLocal({ editing: null, text: "" })
    focusTarget?.focus()
  }
  const commitEdit = (exit: "Enter" | "Tab" | "Shift+Tab") => {
    const coordinate = local.editing
    if (!coordinate) return
    // Send original characters. The domain parser/precision belongs to A02.
    props.onCommitCell({ coordinate, text: local.text, exit })
    setLocal({ editing: null, text: "" })
    if (exit === "Enter") focusTarget?.focus()
  }
  const handleEditKeys: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      cancelEdit()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      commitEdit("Enter")
      return
    }
    if (event.key === "Tab") {
      event.stopPropagation()
      commitEdit(event.shiftKey ? "Shift+Tab" : "Tab")
    }
    // All other keys, particularly arrows, stay in the text editor.
    event.stopPropagation()
  }
  const focusCell = (coordinate: SfCellCoordinate) => {
    if (local.editing && !SAME_CELL(local.editing, coordinate)) cancelEdit()
    props.onSelectRange({ anchor: coordinate, extent: coordinate })
    focusTarget?.focus()
  }

  const nextCell = (coordinate: SfCellCoordinate, key: SfGridNavigation["key"], pageSize: number) => {
    const row = rowIndex(coordinate.rowRef)
    const month = monthIndex(coordinate.month)
    if (row < 0 || month < 0 || !props.rows.length || !props.months.length) return coordinate
    const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value))
    const lastRow = props.rows.length - 1
    const lastMonth = props.months.length - 1
    const nextRow = key === "Control+Home" ? 0 : key === "Control+End" ? lastRow
      : key === "ArrowUp" ? clamp(row - 1, lastRow)
      : key === "ArrowDown" ? clamp(row + 1, lastRow)
      : key === "PageUp" ? clamp(row - pageSize, lastRow)
      : key === "PageDown" ? clamp(row + pageSize, lastRow) : row
    const nextMonth = key === "Control+Home" || key === "Home" ? 0
      : key === "Control+End" || key === "End" ? lastMonth
      : key === "ArrowLeft" ? clamp(month - 1, lastMonth)
      : key === "ArrowRight" ? clamp(month + 1, lastMonth) : month
    return {
      rowRef: props.getRowKey(props.rows[nextRow]!),
      month: props.months[nextMonth]!.id,
      measure: coordinate.measure,
    }
  }
  const handleGridKeys: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (event) => {
    if (local.editing || !readable()) return
    const projected = props.activeCell ?? props.selectedRange?.extent
      ?? props.cells.find((cell) => rowIndex(cell.coordinate.rowRef) >= 0)?.coordinate
    if (!projected) return
    // Owner coordinates may be Solid store proxies. Both callbacks can synchronously
    // update activeCell, so retain the pre-event navigation origin by value.
    const current: SfCellCoordinate = {
      rowRef: projected.rowRef,
      month: projected.month,
      measure: projected.measure,
    }
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault()
      const cell = props.cells.find((item) => SAME_CELL(item.coordinate, current))
      if (cell) startEdit(cell)
      return
    }
    const key: SfGridNavigation["key"] | null =
      (event.ctrlKey || event.metaKey) && event.key === "Home" ? "Control+Home"
      : (event.ctrlKey || event.metaKey) && event.key === "End" ? "Control+End"
      : event.key === "ArrowUp" || event.key === "ArrowDown"
        || event.key === "ArrowLeft" || event.key === "ArrowRight"
        || event.key === "Home" || event.key === "End"
        || event.key === "PageUp" || event.key === "PageDown" ? event.key : null
    if (!key) return
    event.preventDefault()
    const visibleRowCount = Math.max(1, Math.floor((scroller?.clientHeight || 352) / 44))
    const target = nextCell(current, key, visibleRowCount)
    if (event.shiftKey) {
      const range = props.selectedRange
      // Continue a range only while its extent is the active coordinate.
      // Copy both endpoints: never borrow the owner's reactive activeCell or
      // range anchor into a store that may merge objects in place.
      const anchor = range && SAME_CELL(range.extent, current)
        && range.anchor.measure === current.measure
        && rowIndex(range.anchor.rowRef) >= 0 && monthIndex(range.anchor.month) >= 0
        ? { ...range.anchor } : { ...current }
      props.onSelectRange({ anchor, extent: { ...target } })
    } else props.onSelectRange(null)
    props.onNavigate({ from: current, key, visibleRowCount })
    // Keep the owner-selected cell visible without moving the grid's focus.
    // This runs only after keyboard navigation, never when the view mounts.
    queueMicrotask(() => {
      const active = activeId()
      const cell = active && focusTarget?.ownerDocument.getElementById(active)
      if (!cell || !focusTarget?.contains(cell) || !scroller) return
      // Reserve the real sticky boundaries, including any per-column offsets,
      // so a visible month cannot land underneath its row or column headers.
      const metadata = cell.parentElement?.querySelectorAll<HTMLElement>(".sf-s02-meta") ?? []
      const header = focusTarget.querySelector<HTMLElement>(".sf-s02-header")
      const bounds = scroller.getBoundingClientRect()
      const rtl = focusTarget.ownerDocument.defaultView?.getComputedStyle(scroller).direction === "rtl"
      scroller.style.scrollPaddingInlineStart = Math.max(0, ...Array.from(metadata, (item) => {
        const edge = item.getBoundingClientRect()
        return rtl ? bounds.right - edge.left : edge.right - bounds.left
      })) + "px"
      scroller.style.scrollPaddingBlockStart = (header?.getBoundingClientRect().height ?? 0) + "px"
      cell.scrollIntoView({ block: "nearest", inline: "nearest" })
    })
  }

  const pasteAnchor = () => props.selectedRange?.anchor ?? props.activeCell
  const hasSupportedMeasure = (coordinate: SfCellCoordinate) =>
    coordinate.measure === "budget" || coordinate.measure === "actual" || coordinate.measure === "forecast"

  /**
   * Parse only TSV shape. Preserve every original byte and empty trailing cell;
   * producer A02 validates numbers, precision, permission, revisions and effects.
   * Shape invalidation is a UI preflight, not a substitute for producer preview.
   */
  const preparePaste = (originalTsv: string) => {
    setLocal({ rejectedTsv: originalTsv, pasteError: null })
    const anchor = pasteAnchor()
    if (!anchor) {
      setLocal("pasteError", "noAnchor")
      return
    }
    if (!hasSupportedMeasure(anchor)) {
      setLocal("pasteError", "unsupported")
      return
    }
    const startRow = rowIndex(anchor.rowRef)
    const startMonth = monthIndex(anchor.month)
    if (startRow < 0 || startMonth < 0) {
      setLocal("pasteError", "noAnchor")
      return
    }
    const matrix = originalTsv.split(/\r\n|\n|\r/).map((line) => line.split("\t"))
    const width = Math.max(...matrix.map((line) => line.length))
    if (matrix.length > props.rows.length - startRow || width > props.months.length - startMonth) {
      setLocal("pasteError", "overflow")
      return
    }
    if (matrix.some((line) => line.length !== width)) {
      setLocal("pasteError", "irregular")
      return
    }
    const range: SfGridRange = {
      anchor,
      extent: {
        rowRef: props.getRowKey(props.rows[startRow + matrix.length - 1]!),
        month: props.months[startMonth + width - 1]!.id,
        measure: anchor.measure,
      },
    }
    setLocal({ rejectedTsv: "", pasteError: null })
    props.onPasteTsv({ range, originalTsv })
  }
  const handlePaste: JSX.EventHandler<HTMLDivElement, ClipboardEvent> = (event) => {
    if (!writable()) return
    const text = event.clipboardData?.getData("text/plain")
    if (text === undefined) return
    event.preventDefault()
    preparePaste(text)
  }

  const readCellForCopy = (ref: SfCellCoordinate["rowRef"], month: SfCellCoordinate["month"], measure: SfCellCoordinate["measure"]) => {
    const cell = cellVariants(ref, month).find((entry) => entry.coordinate.measure === measure)
    if (!cell) return ""
    if (cell.value.kind === "known") return String(cell.value.value)
    if (cell.value.kind === "inherited" && cell.value.value !== null) return String(cell.value.value)
    return "" // Missing/denied/unavailable are never reconstructed.
  }
  const handleCopy: JSX.EventHandler<HTMLDivElement, ClipboardEvent> = (event) => {
    // While editing, allow the input to copy its own selected raw characters.
    if (!readable() || local.editing) return
    const range = props.selectedRange ?? (props.activeCell
      ? { anchor: props.activeCell, extent: props.activeCell } : null)
    if (!range || !event.clipboardData) return
    const a = rowIndex(range.anchor.rowRef)
    const b = rowIndex(range.extent.rowRef)
    const left = monthIndex(range.anchor.month)
    const right = monthIndex(range.extent.month)
    if (Math.min(a, b, left, right) < 0) return
    // This is a representation of the visible authorized cells, not a domain read.
    const raw = props.rows.slice(Math.min(a, b), Math.max(a, b) + 1).map((row) =>
      props.months.slice(Math.min(left, right), Math.max(left, right) + 1)
        .map((month) => readCellForCopy(props.getRowKey(row), month.id, range.anchor.measure)).join("\t")
    ).join("\r\n")
    event.clipboardData.setData("text/plain", raw)
    event.preventDefault()
  }

  const pasteRows = () => "rows" in props.paste ? props.paste.rows : []
  const readyRows = createMemo(() => writable() && props.paste.phase !== "applying"
    ? pasteRows().filter((row) => row.result === "ready"
      && row.issues.length === 0 && row.cells.every((cell) => !cell.issue))
    : [])
  const retryableRows = createMemo(() => writable() && props.paste.phase !== "applying"
    ? pasteRows().filter((row) => row.result === "failed" || row.result === "conflict")
    : [])
  const canApply = () => (props.paste.phase === "review" || props.paste.phase === "partial")
    && readyRows().length > 0 && writable()

  const monthLabel = (monthId: SfCellCoordinate["month"]) => {
    const month = props.months.find((item) => item.id === monthId)
    return month ? t(month.labelKey) : t("sf.s02.month")
  }
  const formatValue = (value: number, fractionDigits: number) =>
    Number.isInteger(fractionDigits) && fractionDigits >= 0 && fractionDigits <= 20
      ? new Intl.NumberFormat(language.intl(), {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        }).format(value)
      : String(value)
  const unitLabel = (unit: SfUnit) => {
    if (unit.kind === "currency") return unit.code
    if (unit.kind === "percent") return "%"
    return message(unit.label)
  }
  const renderValue = (cell: SfGridCell): JSX.Element => {
    const value = cell.value
    if (value.kind === "missing" || value.kind === "unavailable")
      return <span class="sf-s02-cell-absence">{message(value.reason)}</span>
    if (value.kind === "inherited" && value.value === null)
      return <span class="sf-s02-cell-absence">{t("sf.s02.missing")}</span>
    const amount = value.kind === "known" ? value.value : (value as Readonly<{ kind: "inherited"; value: number }>).value
    return <>
      <span class="sf-s02-quantity">
        <span class="sf-s02-cell-amount">{formatValue(amount, cell.fractionDigits)}</span>
        {" "}
        <span class="sf-s02-cell-unit">{unitLabel(value.unit)}</span>
      </span>
      <Show when={value.kind === "inherited"}>
        <span class="sf-s02-cell-source">{t("sf.s02.inherited")}</span>
      </Show>
    </>
  }
  const wellState = (): "loading" | "denied" | "unavailable" | undefined =>
    props.state === "loading" || props.state === "denied" || props.state === "unavailable" ? props.state : undefined
  const wellKey = (state: "loading" | "denied" | "unavailable"): SfCopyKey =>
    (state === "loading" ? "sf.common.loading" : state === "denied" ? "sf.common.noAccess" : "sf.common.unavailable") as SfCopyKey
  const stateMessage = () => props.state === "session-expired" ? "sf.common.noAccess"
    : props.state === "outcome-unknown" ? "sf.common.pending"
    : props.state === "conflict" || props.state === "stale" ? "sf.common.conflict"
    : props.state === "partial" ? "sf.common.partial"
    : props.state === "empty" ? "sf.common.empty"
    : props.state === "filtered-empty" ? "sf.common.filterEmpty"
    : props.state === "invalid" || props.state === "not-found" ? "sf.common.unavailable" : null
  const firstIssue = (cell: SfGridCell) => {
    const draft = draftFor(cell.coordinate)
    if (draft?.error) return message(draft.error)
    if (props.months.some((month) => month.id === cell.coordinate.month && month.closed))
      return t("sf.s02.closedMonth")
    return cell.permission.editable ? undefined : message(cell.permission.reason)
  }

  return (
    <section class="sf-s02" aria-label={t("sf.s02.grid")}>
      <Show when={wellState()}>
        {(state) => <SfStatePanel state={state()} messageKey={wellKey(state())} />}
      </Show>
      <Show when={stateMessage()}>
        {(key) => <div class="sf-s02-status" role={protectedState() ? "alert" : "status"}>{t(key())}</div>}
      </Show>
      <Show when={!monthShapeValid() && !protectedState()}>
        <p class="sf-s02-readonly" role="alert">{t("sf.s02.invalidMonths")}</p>
      </Show>
      <Show when={props.readOnlyReason && !protectedState()}>
        <p class="sf-s02-readonly">{message(props.readOnlyReason!)}</p>
      </Show>
      <Show when={!protectedState() && (readable() || props.state === "empty" || props.state === "filtered-empty")}>
        <p class="sf-s02-help" id={id + "-help"}>{t("sf.s02.help")}</p>
        <div class="sf-s02-scroll" ref={scroller}>
          <div
            ref={focusTarget}
            role="grid"
            class="sf-s02-grid"
            tabIndex={0}
            aria-label={t("sf.s02.grid")}
            aria-describedby={id + "-help"}
            aria-rowcount={props.rows.length + 1}
            aria-colcount={props.columns.length + props.months.length}
            aria-activedescendant={activeId()}
            onKeyDown={handleGridKeys}
            onPaste={handlePaste}
            onCopy={handleCopy}
          >
            <div role="row" class="sf-s02-header">
              <For each={props.columns}>{(column) =>
                <div role="columnheader" class="sf-s02-header-cell">{t(column.labelKey)}</div>
              }</For>
              <For each={props.months}>{(month) =>
                <div role="columnheader" class="sf-s02-header-cell" data-closed={month.closed}>
                  {t(month.labelKey)}
                </div>
              }</For>
            </div>
            <For each={props.rows}>{(row, ri) =>
              <div role="row" class="sf-s02-row" aria-rowindex={ri() + 2}>
                <For each={props.columns}>{(column) =>
                  <div role="rowheader" class="sf-s02-meta">{column.render(row)}</div>
                }</For>
                <For each={props.months}>{(month, mi) =>
                  <div
                    id={id + "-r" + ri() + "-m" + mi()}
                    role="gridcell"
                    class="sf-s02-month-cell"
                    aria-colindex={props.columns.length + mi() + 1}
                    data-closed={month.closed}
                    aria-selected={cellVariants(props.getRowKey(row), month.id).some((cell) => selected(cell.coordinate))}
                    onClick={() => {
                      const matches = cellVariants(props.getRowKey(row), month.id)
                      if (matches.length) focusCell(matches[0]!.coordinate)
                    }}
                  >
                    <For each={cellVariants(props.getRowKey(row), month.id)}>{(cell) =>
                      <div
                        class="sf-s02-measure"
                        data-active={props.activeCell ? SAME_CELL(props.activeCell, cell.coordinate) : false}
                        data-invalid={!!firstIssue(cell)}
                        onClick={(event) => {
                          event.stopPropagation()
                          focusCell(cell.coordinate)
                        }}
                      >
                        <span class="sf-s02-measure-name">{t(COPY_MEASURE[cell.coordinate.measure])}</span>
                        <Show when={local.editing && SAME_CELL(local.editing, cell.coordinate)} fallback={
                          <>
                            <div class="sf-s02-value">{renderValue(cell)}</div>
                            <Show when={draftFor(cell.coordinate)}>{(draft) =>
                              <div class="sf-s02-draft">
                                {draft().text === "" ? t("sf.s02.paste.blank") : draft().text}
                              </div>
                            }</Show>
                            <Show when={firstIssue(cell)}>{(reason) =>
                              <small class="sf-s02-reason">{reason()}</small>
                            }</Show>
                          </>
                        }>
                          <input
                            type="text"
                            inputMode="decimal"
                            class="sf-s02-editor"
                            ref={(element) => {
                              queueMicrotask(() => { if (element.isConnected) element.focus() })
                            }}
                            aria-label={t("sf.s02.edit")}
                            value={local.text}
                            onInput={(event) => {
                              const text = event.currentTarget.value
                              setLocal("text", text)
                              props.onEdit({ coordinate: cell.coordinate, text })
                            }}
                            onKeyDown={handleEditKeys}
                          />
                        </Show>
                        <Show when={canEdit(cell) && !(local.editing && SAME_CELL(local.editing, cell.coordinate))}>
                          <button type="button" tabIndex={-1} class="sf-s02-inline-edit"
                            aria-label={t("sf.s02.edit")} onClick={(event) => {
                              event.stopPropagation()
                              startEdit(cell)
                            }}>
                            {t("sf.common.edit")}
                          </button>
                        </Show>
                      </div>
                    }</For>
                    <Show when={cellVariants(props.getRowKey(row), month.id).length === 0}>
                      <span class="sf-s02-cell-absence">{t("sf.common.unavailable")}</span>
                    </Show>
                  </div>
                }</For>
              </div>
            }</For>
          </div>
        </div>

        <div class="sf-s02-mobile" aria-label={t("sf.s02.rowMonths")}>
          <For each={props.rows}>{(row) =>
            <details class="sf-s02-mobile-row">
              <summary>
                <span class="sf-s02-mobile-summary">
                  <For each={props.columns}>{(column, index) =>
                    <span class="sf-s02-mobile-meta" data-primary={index() === 0}>
                      <Show when={index() > 0}><small>{t(column.labelKey)}</small></Show>
                      <span>{column.render(row)}</span>
                    </span>
                  }</For>
                </span>
              </summary>
              <ul>
                <For each={props.months}>{(month) =>
                  <li>
                    <strong>{t(month.labelKey)}</strong>
                    <For each={cellVariants(props.getRowKey(row), month.id)}>{(cell) =>
                      <div class="sf-s02-mobile-measure">
                        <span class="sf-s02-measure-name">{t(COPY_MEASURE[cell.coordinate.measure])}</span>
                        <div class="sf-s02-value">{renderValue(cell)}</div>
                        <button type="button" class="sf-s02-mobile-select"
                          aria-pressed={selected(cell.coordinate)}
                          onClick={() => props.onSelectRange({ anchor: cell.coordinate, extent: cell.coordinate })}>
                          {t("sf.s02.paste.selectStart")}
                        </button>
                        <Show when={firstIssue(cell)}>{(reason) => <small class="sf-s02-reason">{reason()}</small>}</Show>
                      </div>
                    }</For>
                    <Show when={cellVariants(props.getRowKey(row), month.id).length === 0}>
                      <span>{t("sf.common.unavailable")}</span>
                    </Show>
                  </li>
                }</For>
              </ul>
              <button type="button" disabled={!writable()} onClick={() => props.onOpenRow(props.getRowKey(row))}>
                {t("sf.s02.openRow")}
              </button>
            </details>
          }</For>
        </div>

        <section class="sf-s02-paste" aria-label={t("sf.s02.paste.title")}>
          <h3>{t("sf.s02.paste.title")}</h3>
          <label for={id + "-paste"}>{t("sf.s02.paste.input")}</label>
          <p>{t("sf.s02.paste.inputHint")}</p>
          <textarea id={id + "-paste"} rows={3} value={local.mobileTsv}
            disabled={!writable() || props.paste.phase === "applying"}
            onInput={(event) => setLocal("mobileTsv", event.currentTarget.value)} />
          <button type="button" disabled={!writable() || props.paste.phase === "applying"}
            onClick={() => preparePaste(local.mobileTsv)}>{t("sf.s02.paste.review")}</button>
          <Show when={local.pasteError}>
            {(reason) => <div role="alert" class="sf-s02-paste-error">
              {t("sf.s02.paste." + (reason() === "noAnchor" ? "noAnchor"
                : reason() === "unsupported" ? "unsupported"
                : reason() === "irregular" ? "irregular" : "overflow"))}
              <h4>{t("sf.s02.paste.original")}</h4>
              <pre>{local.rejectedTsv}</pre>
            </div>}
          </Show>
          <Show when={props.paste.phase === "preparing"}>
            <p role="status">{t("sf.s02.paste.preparing")}</p>
          </Show>
          <Show when={props.paste.phase === "review" || props.paste.phase === "applying"
            || props.paste.phase === "partial" || props.paste.phase === "conflict"
            || props.paste.phase === "failed"}>
            <section class="sf-s02-preview" aria-label={t("sf.s02.paste.summary")}>
              <h4>{t("sf.s02.paste.original")}</h4>
              <pre>{!("originalTsv" in props.paste) ? "" : props.paste.originalTsv}</pre>
              <h4>{t("sf.s02.paste.summary")}</h4>
              <ol>
                <For each={pasteRows()}>{(row, rowOrdinal) =>
                  <li class="sf-s02-preview-row" data-result={row.result}>
                    <strong>{t("sf.s02.paste.row", { row: rowOrdinal() + 1, revision: row.revision })}</strong>
                    <span>{t("sf.s02.paste.status." + row.result)}</span>
                    <ul>
                      <For each={row.cells}>{(cell) =>
                        <li>
                          <span>{t(COPY_MEASURE[cell.coordinate.measure])} — {monthLabel(cell.coordinate.month)}</span>
                          <code>{cell.rawText === "" ? t("sf.s02.paste.blank") : cell.rawText}</code>
                          <Show when={cell.issue}>{(issue) => <span role="status">{message(issue())}</span>}</Show>
                        </li>
                      }</For>
                    </ul>
                    <For each={row.issues}>{(issue) => <p class="sf-s02-paste-issue">{message(issue)}</p>}</For>
                  </li>
                }</For>
              </ol>
              <Show when={readyRows().length === 0 && props.paste.phase !== "applying"}>
                <p>{t("sf.s02.paste.noReady")}</p>
              </Show>
              <div class="sf-s02-paste-actions">
                <button type="button" disabled={!canApply()}
                  onClick={() => props.onApplyPastedRows(readyRows())}>{t("sf.s02.paste.apply")}</button>
                <button type="button" disabled={!retryableRows().length
                  || !writable() || props.paste.phase === "applying"}
                  onClick={() => props.onRetryFailedPasteRows(retryableRows())}>
                  {t("sf.s02.paste.retry")}
                </button>
                <button type="button" disabled={props.paste.phase === "applying"}
                  onClick={props.onCancelPaste}>{t("sf.s02.paste.cancel")}</button>
              </div>
            </section>
          </Show>
          <Show when={props.paste.phase === "complete"}>
            <p role="status">{t("sf.s02.paste.complete")}</p>
            <button type="button" onClick={props.onCancelPaste}>{t("sf.s02.paste.cancel")}</button>
          </Show>
        </section>
      </Show>
    </section>
  )
}
