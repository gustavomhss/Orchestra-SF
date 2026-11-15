import { createEffect, createUniqueId, For, on, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { SfStatePanel } from "../states"
import { sfS01Key, sfS01StateKey, useSfS01Copy } from "./copy"
import type {
  SfColumnWidth,
  SfDataTableProps,
  SfRowAction,
  SfSort,
} from "./contracts"
import "./table.css"

export type {
  SfAction, SfColumn, SfColumnWidth, SfCopyKey, SfCoverage, SfDataTableProps,
  SfDensity, SfDetailSection, SfDisplayValue, SfLayoutMode, SfMessage,
  SfPage, SfPageRequest, SfRecordDetailProps, SfRowAction, SfSort, SfSource,
  SfStatus, SfText, SfUiState, SfUnit, SfListDetailProps,
} from "./contracts"

function columnWidth(width: SfColumnWidth, flexSum: number): JSX.CSSProperties {
  if (width.kind === "fixed") return { width: String(width.px) + "px", "min-width": String(width.px) + "px" }
  if (width.kind === "content") {
    return { "min-width": String(width.minPx) + "px", "max-width": String(width.maxPx) + "px" }
  }
  return {
    "min-width": String(width.minPx) + "px",
    width: String((width.weight / Math.max(flexSum, width.weight)) * 100) + "%",
  }
}

function allowsRead(state: SfDataTableProps<unknown>["state"]) {
  return state === "ready" || state === "partial" || state === "loading"
    || state === "stale" || state === "conflict" || state === "outcome-unknown"
}

export function SfDataTable<Row>(props: SfDataTableProps<Row>): JSX.Element {
  const copy = useSfS01Copy()
  const captionID = createUniqueId()
  const [view, setView] = createStore({ scrollTop: 0, scrollLeft: 0 })
  let viewport: HTMLDivElement | undefined
  let table: HTMLTableElement | undefined
  let lastFocused: { recordRef: string; actionId: string } | null = null

  const visible = () => allowsRead(props.state)
  const flexSum = () => props.columns.reduce(
    (sum, column) => sum + (column.widthPolicy.kind === "flex" ? column.widthPolicy.weight : 0), 0,
  )
  const sortOf = (key?: string) =>
    key && props.sort.kind === "field" && props.sort.key === key
      ? props.sort.direction === "asc" ? "ascending" : "descending"
      : "none"
  const nextSort = (key: string): SfSort => {
    if (props.sort.kind === "field" && props.sort.key === key) {
      if (props.sort.direction === "asc") return { kind: "field", key, direction: "desc" }
      return { kind: "none" }
    }
    return { kind: "field", key, direction: "asc" }
  }
  const total = () => props.page.total
  const from = () => {
    if (props.page.kind === "cursor") return props.page.from
    if (props.page.kind === "offset") return props.rows.length ? props.page.index * props.page.size + 1 : null
    return props.rows.length ? 1 : null
  }
  const to = () => {
    if (props.page.kind === "cursor") return props.page.to
    if (props.page.kind === "offset") return props.page.index * props.page.size + props.rows.length
    return props.rows.length || null
  }
  const range = () => {
    if (from() === null || to() === null)
      return total() === null ? copy.t(sfS01Key("sf.s01.unknownTotal")) : copy.t(sfS01Key("sf.s01.knownTotal"), { total: total()! })
    if (total() === null) return copy.t(sfS01Key("sf.s01.unknownRange"), { from: from()!, to: to()! })
    return copy.t(sfS01Key("sf.s01.knownRange"), { from: from()!, to: to()!, total: total()! })
  }
  const previous = () => {
    const page = props.page
    if (page.kind === "cursor") {
      if (page.previous !== null) props.onPage({ kind: "cursor", direction: "previous", cursor: page.previous })
      return
    }
    if (page.kind === "offset" && page.index > 0) props.onPage({ kind: "offset", index: page.index - 1 })
  }
  const next = () => {
    const page = props.page
    if (page.kind === "cursor") {
      if (page.next !== null) props.onPage({ kind: "cursor", direction: "next", cursor: page.next })
      return
    }
    if (page.kind === "offset" && (page.total === null || (page.index + 1) * page.size < page.total))
      props.onPage({ kind: "offset", index: page.index + 1 })
  }
  const canPrevious = () =>
    props.page.kind === "cursor" ? props.page.previous !== null
      : props.page.kind === "offset" && props.page.index > 0
  const canNext = () =>
    props.page.kind === "cursor" ? props.page.next !== null
      : props.page.kind === "offset"
        && (props.page.total === null ? props.rows.length === props.page.size : (props.page.index + 1) * props.page.size < props.page.total)
  const actions = (row: Readonly<Row>): readonly SfRowAction[] => props.rowActions(row)

  // A refetch may replace row objects without changing their stable producer identity.
  // Restore only an already-focused control; neither mounting nor receiving data initiates navigation.
  createEffect(on(
    () => props.rows.map((row) => props.getRowKey(row)).join("\u0000"),
    () => {
      const prior = lastFocused
      if (!prior) return
      queueMicrotask(() => {
        if (!table?.isConnected || document.activeElement !== document.body) return
        const row = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr[data-sf-row]"))
          .find((item) => item.dataset.sfRow === prior.recordRef)
        const control = Array.from(row?.querySelectorAll<HTMLButtonElement>("button[data-sf-action]") ?? [])
          .find((item) => item.dataset.sfAction === prior.actionId)
        const fallback = table.querySelector<HTMLElement>("[data-sf-table-fallback]")
        ;(control ?? fallback)?.focus({ preventScroll: true })
      })
    },
    { defer: true },
  ))
  createEffect(on(
    () => props.state,
    () => {
      queueMicrotask(() => {
        if (!viewport?.isConnected) return
        viewport.scrollTop = view.scrollTop
        viewport.scrollLeft = view.scrollLeft
      })
    },
    { defer: true },
  ))

  return (
    <section class="sf-s01-table" data-sf-table-state={props.state} data-sf-density={props.density}>
      <Show when={visible()}>
        <div
          class="sf-s01-table-scroll"
          ref={viewport}
          onScroll={(event) => {
            setView("scrollTop", event.currentTarget.scrollTop)
            setView("scrollLeft", event.currentTarget.scrollLeft)
          }}
        >
          <table ref={table} aria-describedby={captionID} aria-busy={props.state === "loading"}>
            <caption id={captionID} tabindex="-1" data-sf-table-fallback>
              {copy.t(props.captionKey)}
            </caption>
            <colgroup>
              <For each={props.columns}>
                {(column) => <col style={columnWidth(column.widthPolicy, flexSum())} />}
              </For>
              <col />
            </colgroup>
            <thead>
              <tr>
                <For each={props.columns}>
                  {(column) => (
                    <th scope="col" aria-sort={sortOf(column.sortKey)} class={"sf-s01-align-" + column.align}>
                      <Show
                        when={column.sortKey}
                        fallback={<span>{copy.t(column.labelKey)}</span>}
                      >
                        {(key) => (
                          <button
                            type="button"
                            class="sf-s01-sort"
                            onClick={() => props.onSort(nextSort(key()))}
                            aria-label={copy.t(sfS01Key("sf.s01.sortColumn"), { column: copy.t(column.labelKey) })}
                          >
                            <span>{copy.t(column.labelKey)}</span>
                            <span aria-hidden="true">{sortOf(column.sortKey) === "ascending" ? "↑" : sortOf(column.sortKey) === "descending" ? "↓" : "↕"}</span>
                          </button>
                        )}
                      </Show>
                    </th>
                  )}
                </For>
                <th scope="col" class="sf-s01-actions-head">
                  {copy.t(sfS01Key("sf.s01.tableActions"))}
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={props.rows}>
                {(row) => {
                  const recordRef = () => props.getRowKey(row)
                  return (
                    <tr
                      data-sf-row={recordRef()}
                      aria-selected={recordRef() === props.selectedKey}
                      classList={{ "sf-s01-selected": recordRef() === props.selectedKey }}
                      onFocusIn={(event) => {
                        const control = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("button[data-sf-action]") : null
                        lastFocused = control ? { recordRef: recordRef(), actionId: control.dataset.sfAction ?? "select" } : null
                      }}
                      onFocusOut={(event) => {
                        if (event.relatedTarget instanceof Node && !event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                          lastFocused = null
                        }
                      }}
                    >
                      <For each={props.columns}>
                        {(column, index) => (
                          <td class={"sf-s01-align-" + column.align}>
                            <Show when={index() === 0} fallback={column.render(row)}>
                              <div class="sf-s01-primary-cell">
                                <div class="sf-s01-cell-value">{column.render(row)}</div>
                                <button
                                  type="button"
                                  class="sf-s01-row-open"
                                  data-sf-action="select"
                                  aria-current={recordRef() === props.selectedKey ? "true" : undefined}
                                  onClick={() => props.onSelect(recordRef())}
                                >
                                  {copy.t(sfS01Key("sf.s01.openRecord"))}
                                </button>
                              </div>
                            </Show>
                          </td>
                        )}
                      </For>
                      <td class="sf-s01-actions-cell">
                        <div class="sf-s01-row-actions" role="group" aria-label={copy.t(sfS01Key("sf.s01.rowActions"))}>
                          <For each={actions(row)}>
                            {(action) => (
                              <button
                                type="button"
                                class={"mx-btn" + (action.tone === "danger" ? " danger" : "")}
                                data-sf-action={action.id}
                                disabled={action.disabled || action.busy || (props.state !== "ready" && props.state !== "partial")}
                                aria-busy={action.busy}
                                title={action.reason ? copy.message(action.reason) : undefined}
                                onClick={() => {
                                  if (!action.disabled && !action.busy && (props.state === "ready" || props.state === "partial"))
                                    props.onRowAction({ recordRef: recordRef(), actionId: action.id })
                                }}
                              >
                                {copy.t(action.labelKey)}
                              </button>
                              <Show when={action.reason}>
                                {(reason) => <span class="sf-s01-action-reason">{copy.message(reason())}</span>}
                              </Show>
                            )}
                          </For>
                        </div>
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={props.state !== "ready"}>
        <SfStatePanel state={props.state} messageKey={sfS01StateKey(props.state)}>
          <Show when={visible() && props.rows.length > 0}>
            <span class="sf-s01-sr">{range()}</span>
          </Show>
        </SfStatePanel>
      </Show>

      <Show when={visible() && props.page.kind !== "none"}>
        <nav class="sf-s01-pagination" aria-label={copy.t(sfS01Key("sf.s01.listLabel"))}>
          <button
            type="button"
            class="mx-btn"
            disabled={!canPrevious() || props.state === "loading"}
            onClick={previous}
          >
            {copy.t(sfS01Key("sf.s01.previousPage"))}
          </button>
          <output aria-live="polite" class="sf-s01-range">{range()}</output>
          <button
            type="button"
            class="mx-btn"
            disabled={!canNext() || props.state === "loading"}
            onClick={next}
          >
            {copy.t(sfS01Key("sf.s01.nextPage"))}
          </button>
        </nav>
      </Show>
    </section>
  )
}
