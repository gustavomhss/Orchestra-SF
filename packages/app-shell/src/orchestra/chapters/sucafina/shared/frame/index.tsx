import { getFilename } from "@orchestra/core/util/path"
import { A, useLocation } from "@solidjs/router"
import { createEffect, createMemo, createUniqueId, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { chapterPageTitleKey } from "@/context/layout-route"
import { useGlobal } from "@/context/global"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { ServerConnection, serverName, useServer } from "@/context/server"
import { MxPage } from "@/orchestra/chapters/kit"
import { navigation } from "@/orchestra/navigation"
import { displayName } from "@/pages/layout/helpers"
import { pathKey } from "@/utils/path-key"
import {
  SfActionButton,
  SfCoverageView,
  SfDisplayValueText,
  SfMessageText,
  SfTextValue,
  sfCommonKey,
  SF_STATE_FALLBACK_KEY,
  useSfPresentation,
} from "./presentation"
import type {
  SfChartFrameProps,
  SfContextBarProps,
  SfContextControl,
  SfContextOption,
  SfLayoutMode,
  SfPageFrameProps,
} from "./types"
import { SfStatePanel } from "../states"
import "./frame.css"
import "../wave-one.css"

export type {
  SfAction, SfChartFrameProps, SfChartTable, SfContextBarProps, SfCopyKey, SfCoverage,
  SfDensity, SfDisplayValue, SfLayoutMode, SfMessage, SfPageFrameProps,
  SfPlotSeries, SfRunStateProps, SfSource, SfStatePanelProps, SfText, SfUiState, SfUnit,
} from "./types"
export { SfDisplayValueText } from "./presentation"

// W is the observed *usable content width* after the shell sidebar and page insets.
// Do not decide from window.innerWidth, device type, or CSS viewport alone.
function routeLocation() {
  try {
    return useLocation()
  } catch {
    return undefined
  }
}

function shellContext<T>(read: () => T) {
  try {
    return read()
  } catch {
    return undefined
  }
}

export function resolveSfLayoutMode(
  width: number,
  layout: SfPageFrameProps["layout"],
): SfLayoutMode {
  if (!Number.isFinite(width) || width < 801 || (layout !== "split" && layout !== "comparison")) return "single"
  if (layout === "comparison" && width >= 1122) return "split-context"
  return "split"
}

export function SfPageFrame(props: SfPageFrameProps): JSX.Element {
  const id = createUniqueId()
  const { t } = useSfPresentation()
  const language = useLanguage()
  const location = routeLocation()
  const layout = shellContext(useLayout)
  const global = shellContext(useGlobal)
  const server = shellContext(useServer)
  const profileName = () => {
    if (!layout || !global) return ""
    const selection = layout.home.selection()
    const conn = global.servers.list().find((item) => ServerConnection.key(item) === selection.server)
    const directory = selection.directory
    if (conn && directory) {
      const key = pathKey(directory)
      const project = global.ensureServerCtx(conn).projects.list().find((item) =>
        pathKey(item.worktree) === key || item.sandboxes?.some((sandbox) => pathKey(sandbox) === key))
      if (project) return displayName(project)
      return getFilename(directory) || directory
    }
    return server ? serverName(conn ?? server.current) : ""
  }
  const area = () => {
    const page = location ? chapterPageTitleKey(location.pathname) : undefined
    if (page) {
      const text = language.t(page as Parameters<typeof language.t>[0])
      if (text !== page) return text
    }
    if (!layout) return t(props.titleKey)
    const route = layout.route()
    if (route.type === "chapter") {
      const label = navigation.find((item) => item.id === route.chapter)?.label
      if (label) return language.t(label)
    }
    return t(props.titleKey)
  }
  const eyebrow = () => {
    if (props.eyebrow) {
      return props.eyebrow.kind === "data" ? props.eyebrow.text : t(props.eyebrow.message.key, props.eyebrow.message.params)
    }
    return `\u2068${profileName()}\u2069 · ${area()}`
  }
  let root: HTMLDivElement | undefined
  const [state, setState] = createStore({ width: 0, mode: "single" as SfLayoutMode })
  let lastNotified: SfLayoutMode | undefined
  const applyWidth = (width: number) => {
    if (!Number.isFinite(width) || width <= 0) return
    const next = resolveSfLayoutMode(width, props.layout)
    if (state.width !== width || state.mode !== next) setState({ width, mode: next })
    if (next !== lastNotified) {
      lastNotified = next
      props.onLayoutMode(next)
    }
  }

  onMount(() => {
    const content = root?.querySelector<HTMLElement>(".mx-inner")
    if (!content) return
    const measure = () => applyWidth(content.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) applyWidth(entry.contentRect.width)
      })
      observer.observe(content)
      onCleanup(() => observer.disconnect())
    } else {
      window.addEventListener("resize", measure, { passive: true })
      onCleanup(() => window.removeEventListener("resize", measure))
    }
  })
  // React to parent layout changes even when no resize event occurs.
  createEffect(() => {
    const width = state.width
    const layout = props.layout
    if (width > 0) {
      const next = resolveSfLayoutMode(width, layout)
      if (next !== state.mode) setState("mode", next)
      if (next !== lastNotified) {
        lastNotified = next
        props.onLayoutMode(next)
      }
    }
  })

  const currentTab = createMemo(() => props.tabs.find((tab) => tab.id === props.activeTab))
  const navItem = (tab: SfPageFrameProps["tabs"][number]): JSX.Element => (
    <Show
      when={tab.available}
      fallback={
        <span class="sf-tab sf-tab-disabled" aria-disabled="true">
          {t(tab.labelKey)}
        </span>
      }
    >
      <A
        href={tab.href}
        class="sf-tab"
        classList={{ "sf-tab-active": props.activeTab === tab.id }}
        aria-current={props.activeTab === tab.id ? "page" : undefined}
      >
        {t(tab.labelKey)}
      </A>
    </Show>
  )

  const secondary = (): JSX.Element => (
    <For each={props.secondaryActions}>
      {(action) => <SfActionButton action={action} variant="secondary" />}
    </For>
  )
  return (
    <div
      ref={(element) => (root = element)}
      class="sf-page-frame"
      data-sf-frame="page"
      data-sf-layout={props.layout}
      data-sf-mode={state.mode}
      data-sf-density={props.density}
    >
      <MxPage
        id={`sf-page-${id}`}
        title={t(props.titleKey)}
        description={props.subtitleKey ? t(props.subtitleKey) : ""}
        eyebrow={eyebrow()}
        action={
          <Show when={props.primaryAction || props.secondaryActions.length > 0}>
            <div class="sf-page-actions">
              {secondary()}
              <Show when={props.primaryAction}>
                {(action) => <SfActionButton action={action()} variant="primary" />}
              </Show>
            </div>
          </Show>
        }
      >
        <div class="sf-frame-workarea" data-sf-usable-width={state.width}>
          <Show when={props.context.length > 0}>
            <dl class="sf-page-context">
              <For each={props.context}>
                {(entry) => (
                  <div class="sf-page-context-item" data-sf-context={entry.id}>
                    <dt><SfMessageText message={entry.label} /></dt>
                    <dd><SfTextValue value={entry.value} /></dd>
                  </div>
                )}
              </For>
            </dl>
          </Show>
          <Show when={props.tabs.length > 0}>
            <nav class="sf-page-tabs" aria-label={t(sfCommonKey("sf.common.moreViews"))}>
              <div class="sf-tabs-inline">
                <For each={props.tabs}>{navItem}</For>
              </div>
              <div class="sf-tabs-compact">
                <Show when={currentTab()}>
                  {(tab) => <strong class="sf-tabs-current">{t(tab().labelKey)}</strong>}
                </Show>
                <details class="sf-tabs-menu">
                  <summary>{t(sfCommonKey("sf.common.moreViews"))}</summary>
                  <div class="sf-tabs-menu-content">
                    <For each={props.tabs}>{navItem}</For>
                  </div>
                </details>
              </div>
            </nav>
          </Show>
          <div class="sf-frame-body" data-sf-content={props.layout}>
            {props.children}
          </div>
        </div>
      </MxPage>
    </div>
  )
}

const CONTROL_ORDER: readonly SfContextControl[] = ["year", "period", "version", "currency", "view"]

export function SfContextBar(props: SfContextBarProps): JSX.Element {
  const { t } = useSfPresentation()
  const id = createUniqueId()
  const privateState = () => props.state === "denied" || props.state === "session-expired"
  const loading = () => props.state === "loading"
  const interactive = () => [
    "ready", "partial", "stale", "conflict", "empty", "filtered-empty", "invalid",
  ].includes(props.state)
  const groups = createMemo(() =>
    CONTROL_ORDER.flatMap((control) => {
      const options = props.catalog.filter((option) => option.control === control)
      if (!options.length) return []
      const selection = props.selection.find((entry) => entry.control === control)
      const reason = props.lockedReasons.find((entry) => entry.control === control)?.reason
      const picked = options.find((option) => option.id === selection?.optionId)
      return [{ control, options, selection, reason, picked }]
    }),
  )

  return (
    <div class="sf-context-bar" data-sf-context-state={props.state} aria-busy={loading()}>
      <Show
        when={!privateState() && !loading() && interactive()}
        fallback={
          <p role={privateState() || !interactive() ? "alert" : "status"}>
            {t(sfCommonKey(SF_STATE_FALLBACK_KEY[props.state]))}
          </p>
        }
      >
        <For each={groups()}>
          {(group) => (
            <div class="sf-context-control">
              <label for={`sf-context-${id}-${group.control}`}>
                {/* The frozen signature supplies option labels but no separate field labelKey.
                    Use the producer's authorized presentation text, never invent a property-name label. */}
                <Show when={group.picked} fallback={<span>{t(sfCommonKey("sf.common.unknown"))}</span>}>
                  {(option) => <SfTextValue value={option().label} />}
                </Show>
              </label>
              <select
                id={`sf-context-${id}-${group.control}`}
                value={group.picked?.id ?? ""}
                disabled={!!group.reason || group.options.every((option) => !option.available)}
                aria-describedby={group.reason ? `sf-locked-${id}-${group.control}` : undefined}
                onChange={(event) => {
                  const optionId = event.currentTarget.value
                  if (!group.reason && optionId !== group.selection?.optionId &&
                      group.options.some((option) => option.id === optionId && option.available)) {
                    props.onRequestChange({ control: group.control, optionId })
                  }
                  // The owner must admit the request before a selection changes.
                  // Never leave an optimistic native <select> showing another context.
                  event.currentTarget.value = group.picked?.id ?? ""
                }}
              >
                <Show when={!group.picked}>
                  <option value="" disabled>{t(sfCommonKey("sf.common.unknown"))}</option>
                </Show>
                <For each={group.options}>
                  {(option: SfContextOption) => (
                    <option value={option.id} disabled={!option.available}>
                      {option.label.kind === "data"
                        ? option.label.text
                        : t(option.label.message.key, option.label.message.params)}
                    </option>
                  )}
                </For>
              </select>
              <Show when={group.reason}>
                {(reason) => (
                  <small id={`sf-locked-${id}-${group.control}`}>
                    <SfMessageText message={reason()} />
                  </small>
                )}
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}

export function SfChartFrame(props: SfChartFrameProps): JSX.Element {
  const { t } = useSfPresentation()
  const id = createUniqueId()
  const privateState = () => props.state === "denied" || props.state === "session-expired"
  return (
    <section class="sf-chart-frame" data-sf-chart-state={props.state} aria-labelledby={privateState() ? undefined : `sf-chart-${id}`}>
      <Show when={!privateState()}>
        <header class="sf-chart-header">
          <h2 id={`sf-chart-${id}`}>{t(props.titleKey)}</h2>
          <p>{t(props.questionKey)}</p>
          <Show when={!privateState() && props.context.length > 0}>
            <dl class="sf-chart-context">
              <For each={props.context}>
                {(entry) => (
                  <div>
                    <dt><SfMessageText message={entry.label} /></dt>
                    <dd><SfTextValue value={entry.value} /></dd>
                  </div>
                )}
              </For>
            </dl>
          </Show>
        </header>
      </Show>
      <SfStatePanel
        state={props.state}
        messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[props.state])}
        coverage={props.coverage}
      >
        <Show when={props.state === "ready"}><SfCoverageView coverage={props.coverage} /></Show>
        <div class="sf-chart-visual" aria-describedby={`sf-chart-caption-${id}`}>
          {/* BI consumers supply their original native SVG, not arbitrary HTML. */}
          {props.children}
        </div>
        <div class="sf-chart-table-region">
          <table class="sf-chart-table">
            <caption id={`sf-chart-caption-${id}`}>
              <SfMessageText message={props.table.caption} />
            </caption>
            <thead>
              <tr>
                <For each={props.table.columns}>
                  {(column) => <th scope="col"><SfMessageText message={column.label} /></th>}
                </For>
                <Show when={props.table.rows.some((row) => row.selectionRef !== undefined)}>
                  <th scope="col">{t(sfCommonKey("sf.common.showDetails"))}</th>
                </Show>
              </tr>
            </thead>
            <tbody>
              <For each={props.table.rows}>
                {(row) => (
                  <tr data-sf-row={row.id} data-sf-selected={row.selectionRef && props.selection === row.selectionRef ? "true" : undefined}>
                    <For each={props.table.columns}>
                      {(column) => (
                        <td>
                          <Show
                            when={row.cells[column.id]}
                            fallback={<span class="sf-missing">{t(sfCommonKey("sf.common.unknown"))}</span>}
                          >
                            {(value) => <SfDisplayValueText value={value()} />}
                          </Show>
                        </td>
                      )}
                    </For>
                    <Show when={props.table.rows.some((entry) => entry.selectionRef !== undefined)}>
                      <td>
                        <Show when={row.selectionRef}>
                          {(ref) => (
                            <button
                              type="button"
                              class="mx-btn sf-table-action"
                              aria-pressed={props.selection === ref()}
                              onClick={() => props.onSelect(ref())}
                            >
                              {t(sfCommonKey("sf.common.showDetails"))}
                            </button>
                          )}
                        </Show>
                      </td>
                    </Show>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </SfStatePanel>
    </section>
  )
}
