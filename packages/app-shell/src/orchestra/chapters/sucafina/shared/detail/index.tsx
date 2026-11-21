import { createEffect, createUniqueId, For, on, Show, type JSX } from "solid-js"
import { SfStatePanel } from "../states"
import { sfS01Key, sfS01StateKey, useSfS01Copy } from "../table/copy"
import type {
  SfAction, SfDisplayValue, SfListDetailProps, SfRecordDetailProps, SfUiState,
} from "../table/contracts"
import "./detail.css"

export type { SfDetailSection, SfListDetailProps, SfRecordDetailProps } from "../table/contracts"

function SfDisplay(props: { value: SfDisplayValue }): JSX.Element {
  const copy = useSfS01Copy()
  const render = (value: SfDisplayValue): JSX.Element => {
    switch (value.kind) {
      case "text":
        return <span>{copy.text(value.text)}</span>
      case "boolean":
        return <span>{copy.message(value.value ? value.trueLabel : value.falseLabel)}</span>
      case "missing":
      case "unavailable":
        return <span class="sf-s01-absent">{copy.message(value.reason)}</span>
      case "date":
        return <time dateTime={value.isoDate}>{value.isoDate}</time>
      case "timestamp":
        return <time dateTime={value.isoTimestamp}>{value.isoTimestamp} ({value.timezone})</time>
      case "number": {
        // The source value is already computed; only its display precision and unit are rendered.
        const digits = Number.isFinite(value.fractionDigits)
          ? Math.min(Math.max(0, Math.trunc(value.fractionDigits)), 20) : 0
        const formatted = new Intl.NumberFormat(copy.intl(), {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value.value)
        const unit = value.unit.kind === "currency" ? value.unit.code
          : value.unit.kind === "percent" ? "%"
          : copy.message(value.unit.label)
        return <span class="sf-s01-number"><bdi>{formatted}</bdi> <span>{unit}</span></span>
      }
      case "list":
        return (
          <Show
            when={value.items.length > 0}
            fallback={<span class="sf-s01-absent">{copy.t(sfS01Key("sf.common.empty"))}</span>}
          >
            <ul class="sf-s01-value-list">
              <For each={value.items}>{(item) => <li>{render(item)}</li>}</For>
            </ul>
          </Show>
        )
    }
  }
  return <>{render(props.value)}</>
}

function SfActionButton(props: { action: SfAction }): JSX.Element {
  const copy = useSfS01Copy()
  return (
    <button
      type="button"
      class={"mx-btn" + (props.action.tone === "primary" ? " primary" : props.action.tone === "danger" ? " danger" : "")}
      disabled={props.action.disabled || props.action.busy}
      aria-busy={props.action.busy}
      title={props.action.reasonKey ? copy.t(props.action.reasonKey) : undefined}
      onClick={() => {
        if (!props.action.disabled && !props.action.busy) props.action.onInvoke()
      }}
    >
      {copy.t(props.action.labelKey, props.action.labelParams)}
    </button>
  )
}

export function SfRecordDetail(props: SfRecordDetailProps): JSX.Element {
  const copy = useSfS01Copy()
  const titleID = createUniqueId()
  const statusID = createUniqueId()

  return (
    <article class="sf-s01-record-detail" data-sf-record-detail aria-labelledby={titleID}>
      <header class="sf-s01-detail-header">
        <div class="sf-s01-detail-heading">
          <button type="button" class="mx-link" onClick={() => props.onBack()}>
            {copy.t(sfS01Key("sf.common.back"))}
          </button>
          <div>
            <h2 id={titleID} tabindex="-1" data-sf-detail-heading>{copy.text(props.title)}</h2>
            <Show when={props.secondaryId}>
              {(value) => (
                <p class="sf-s01-secondary">
                  <span class="sf-s01-sr">{copy.t(sfS01Key("sf.s01.recordIdentity"))}: </span>
                  <bdi>{copy.text(value())}</bdi>
                </p>
              )}
            </Show>
          </div>
          <div id={statusID} class="sf-s01-status" data-sf-tone={props.status.tone} data-sf-status={props.status.code}>
            <span class="sf-s01-sr">{copy.t(sfS01Key("sf.s01.recordStatus"))}: </span>
            {copy.text(props.status.text)}
          </div>
        </div>
        <div class="sf-s01-detail-actions">
          <Show when={props.primaryAction}>{(action) => <SfActionButton action={action()} />}</Show>
          <For each={props.secondaryActions}>{(action) => <SfActionButton action={action} />}</For>
          <button type="button" class="mx-btn" onClick={() => props.onOpenPage()}>
            {copy.t(sfS01Key("sf.common.openPage"))}
          </button>
        </div>
      </header>

      <Show when={props.metadata.length > 0}>
        <dl class="sf-s01-metadata">
          <For each={props.metadata}>
            {(entry) => (
              <div class="sf-s01-metadata-item" data-sf-field={entry.id}>
                <dt>{copy.message(entry.label)}</dt>
                <dd><SfDisplay value={entry.value} /></dd>
              </div>
            )}
          </For>
        </dl>
      </Show>

      <div class="sf-s01-detail-sections">
        <For each={props.sections}>
          {(section) => (
            <section class="sf-s01-detail-section" data-sf-section={section.id} aria-labelledby={titleID + "-" + encodeURIComponent(section.id)}>
              <h3 id={titleID + "-" + encodeURIComponent(section.id)}>{copy.t(section.titleKey)}</h3>
              <SfStatePanel state={section.state} messageKey={sfS01StateKey(section.state)}>
                {section.content}
              </SfStatePanel>
            </section>
          )}
        </For>
      </div>

      <Show when={props.sourceActions.length > 0}>
        <footer class="sf-s01-source-actions">
          <For each={props.sourceActions}>{(action) => <SfActionButton action={action} />}</For>
        </footer>
      </Show>
    </article>
  )
}

export function SfListDetail(props: SfListDetailProps): JSX.Element {
  const copy = useSfS01Copy()
  const id = createUniqueId()
  let listHost: HTMLDivElement | undefined
  let detailHost: HTMLDivElement | undefined
  let listScroll: { top: number; left: number } | null = null
  const single = () => props.layoutMode === "single"
  const hasDetail = () => props.selectedRef !== undefined
  const listHidden = () => single() && hasDetail()

  // Leave the authorized list mounted while a single-column detail is visible:
  // its filter controls, scroll and stable row buttons retain their state in the owner.
  // Only navigation back from a real selection changes focus; refetch alone does not.
  createEffect(on(
    () => [props.selectedRef, props.layoutMode] as const,
    (next, previous) => {
      if (!previous || next[1] !== "single") return
      queueMicrotask(() => {
        if (!listHost?.isConnected || !detailHost?.isConnected) return
        if (previous[0] && !next[0]) {
          const scroll = listHost.querySelector<HTMLElement>(".sf-s01-table-scroll")
          if (scroll && listScroll) {
            scroll.scrollTop = listScroll.top
            scroll.scrollLeft = listScroll.left
          }
          const row = Array.from(listHost.querySelectorAll<HTMLTableRowElement>("tr[data-sf-row]"))
            .find((element) => element.dataset.sfRow === previous[0])
          const target = row?.querySelector<HTMLButtonElement>('button[data-sf-action="select"]')
            ?? listHost.querySelector<HTMLElement>("[data-sf-table-fallback]")
          target?.focus({ preventScroll: true })
          return
        }
        if (next[0] && (!previous[0] || next[0] !== previous[0]))
          detailHost.querySelector<HTMLElement>("[data-sf-detail-heading]")?.focus({ preventScroll: true })
      })
    },
    { defer: true },
  ))

  return (
    <section
      class="sf-s01-list-detail"
      data-sf-layout={props.layoutMode}
      aria-label={copy.t(sfS01Key("sf.s01.listLabel"))}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !hasDetail() || event.defaultPrevented) return
        if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[role=dialog]")) return
        event.preventDefault()
        props.onBack()
      }}
    >
      <div
        ref={listHost}
        class="sf-s01-list-pane"
        id={id + "-list"}
        hidden={listHidden()}
        on:click={{ capture: true, handleEvent: (event: MouseEvent) => {
          if (!single() || !(event.target instanceof Element) || !event.target.closest('[data-sf-action="select"]')) return
          const scroll = listHost?.querySelector<HTMLElement>(".sf-s01-table-scroll")
          if (scroll) listScroll = { top: scroll.scrollTop, left: scroll.scrollLeft }
        } }}
      >
        {props.list}
      </div>
      <div
        ref={detailHost}
        class="sf-s01-detail-pane"
        id={id + "-detail"}
        role="region"
        aria-label={copy.t(sfS01Key("sf.s01.detailLabel"))}
        hidden={single() && !hasDetail()}
      >
        <Show
          when={hasDetail()}
          fallback={
            <p class="sf-s01-select-note" role="status">
              {copy.t(sfS01Key("sf.s01.selectRecord"))}
            </p>
          }
        >
          <nav class="sf-s01-detail-navigation" aria-label={copy.t(sfS01Key("sf.s01.detailLabel"))}>
            <button type="button" class="mx-link" onClick={() => props.onBack()}>
              {copy.t(sfS01Key("sf.common.returnToList"))}
            </button>
            <button type="button" class="mx-link" onClick={() => props.onOpenPage()}>
              {copy.t(sfS01Key("sf.common.openPage"))}
            </button>
          </nav>
          {props.detail}
        </Show>
      </div>
    </section>
  )
}
