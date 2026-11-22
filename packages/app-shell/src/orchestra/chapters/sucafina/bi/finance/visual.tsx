import { For, Show, createMemo } from "solid-js"
import type { SfBiFigureProps, SfBiOwnedView } from "./model"
import { sfBiChartModel, sfBiKey, sfBiPeriodLabel, sfBiValueSource } from "./model"
import { SfChartFrame } from "../../shared/frame"
import { sfBiScalarLabel } from "./scalar"
import { useSfPresentation } from "../../shared/frame/presentation"
import "./figure.css"

/** Pure Solid renderer. F01/I00 own admission, owner fencing and read callbacks. */
export function SfBiOwnedFigure(props: SfBiFigureProps<SfBiOwnedView> & Readonly<{ copy: "sf.u20" | "sf.u21" }>) {
  const { t, locale } = useSfPresentation()
  const model = createMemo(() => sfBiChartModel(props.viewId, props.projection, props.copy, locale()))
  const fmt = (n: number | null, unit?: string) => n === null ? t(sfBiKey(props.copy + ".missing")) :
    unit !== undefined && unit !== props.projection.projection.context.currency
      ? sfBiScalarLabel(n, locale())
      : new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n)
  const assigned = () => new Map(props.projection.projection.values.map((value) => [value.id, value]))
  const waterfall = () => props.viewId === "BI02" ? props.projection.presentation.waterfall : undefined
  const timeline = () => props.viewId === "BI08" ? props.projection.presentation.timeline : undefined

  return (
    <SfChartFrame
      titleKey={sfBiKey(props.copy + ".title")}
      questionKey={sfBiKey(props.copy + ".question." + props.viewId)}
      context={model().state === "unavailable" ? [] : [
        { label: { key: sfBiKey(props.copy + ".context.period") },
          value: { kind: "data", text: sfBiPeriodLabel(props.projection.projection.context.period.start, props.projection.projection.context.period.end, locale()) } },
        { label: { key: sfBiKey(props.copy + ".context.currency") },
          value: { kind: "data", text: props.projection.projection.context.currency } },
        { label: { key: sfBiKey(props.copy + ".context.version") },
          value: { kind: "data", text: String(props.projection.projection.version) + " / " + props.projection.projection.engineVersion } },
      ]}
      coverage={model().coverage}
      series={model().series}
      table={model().table}
      selection={props.selection}
      selectionRowId={model().rows.find((row) => row.id === props.selectedValueId)?.tableRowId}
      state={model().state}
      onSelect={(reference, rowId) => {
        const source = model().rows.find((row) => row.tableRowId === rowId)?.source
        if (source?.refId === reference) props.onSelect(reference, source)
      }}
      onOpenSource={props.onOpenSource}
    >
      <div class="sf-bi-figure" data-sf-bi-view={props.viewId} data-sf-bi-state={model().state}>
        <Show when={props.viewId === "BI06" && model().rows.some((row) => row.value === null)}>
          <p class="sf-bi-unknown-aging" role="status">
            {t(sfBiKey("sf.u21.unknownAging"))}: {model().rows.filter((row) => row.value === null).length}
          </p>
        </Show>
        <For each={props.viewId === "BI08"
          ? model().series.filter((series) => series.points.some((point) => point.value.kind === "known"))
          : model().series}>
          {(series) => {
            const rows = () => model().rows.filter((row) => series.points.some((point) => point.id === row.id))
            const extent = () => Math.max(1, ...rows().flatMap((row) => row.value === null ? [] : [Math.abs(row.value)]))
            return (
              <figure class="sf-bi-series" data-sf-bi-role={series.semanticToken}>
                <figcaption>
                  <strong>{rows()[0]?.label ?? t(series.label.key)}</strong>
                  <span class="sf-bi-unit">{rows()[0]?.unit}</span>
                </figcaption>
                <div class="sf-bi-plot-region" role="region" aria-label={t(sfBiKey(props.copy + ".axis"))} tabIndex={0}>
                <svg viewBox={"0 0 700 " + Math.max(60, rows().length * 43 + 18)}
                  role="img" aria-label={t(sfBiKey(props.copy + ".axis"))}
                  class="sf-bi-svg" preserveAspectRatio="xMinYMin meet">
                  <line x1="350" y1="8" x2="350" y2={Math.max(50, rows().length * 43 + 5)}
                    stroke="currentColor" stroke-opacity="0.45" />
                  <For each={rows()}>
                    {(row, index) => {
                      const magnitude = () => row.value === null ? 0 : Math.abs(row.value) / extent() * 210
                      return (
                        <g data-sf-value-id={row.id} data-sf-evidence={row.evidence}
                          data-sf-value-kind={row.value === null ? "missing" : "known"}>
                          <title>{row.label + " · " + row.period + " · " + fmt(row.value, row.unit) + " " + row.unit}</title>
                          <text x="6" y={index() * 43 + 31} class="sf-bi-axis-label">{row.period}</text>
                          <Show when={row.value !== null} fallback={
                            <text x="360" y={index() * 43 + 31} class="sf-bi-axis-label">
                              {t(sfBiKey(props.copy + ".missing"))}
                            </text>
                          }>
                            <rect x={row.value !== null && row.value < 0 ? 350 - magnitude() : 350}
                              y={index() * 43 + 13} width={magnitude()} height="20"
                              fill="currentColor" fill-opacity={row.value !== null && row.value < 0 ? "0.45" : "0.72"} />
                            <text x={row.value !== null && row.value < 0 ? 350 - magnitude() - 6 : 358 + magnitude()}
                              y={index() * 43 + 29}
                              text-anchor={row.value !== null && row.value < 0 ? "end" : "start"}
                              class="sf-bi-axis-value">{fmt(row.value, row.unit)}</text>
                          </Show>
                        </g>
                      )
                    }}
                  </For>
                </svg>
                </div>
                <details class="sf-bi-source-actions">
                  <summary>{t(sfBiKey(props.copy + ".openSource"))}</summary>
                  <div class="sf-bi-source-action-list">
                  <For each={rows().filter((row) => row.evidenceRef)}>
                    {(row) => <button class="mx-btn" type="button" data-sf-source-value-id={row.id}
                      onClick={() => row.source && props.onOpenSource(row.source.refId, row.source)}>
                      {t(sfBiKey(props.copy + ".openSource"))}: {row.label} · {row.period}
                    </button>}
                  </For>
                  </div>
                </details>
              </figure>
            )
          }}
        </For>
        <Show when={waterfall()}>
          {(plan) => (
            <section class="sf-bi-plan" data-sf-waterfall={plan().reconciliation}>
              <h3>{t(sfBiKey(props.copy + ".waterfall"))}</h3>
              <p role={plan().reconciliation === "reconciled" ? "status" : "alert"}>
                {t(sfBiKey(props.copy + ".reconciliation." + plan().reconciliation))}
              </p>
              <div class="sf-bi-waterfall-region" role="region" aria-label={t(sfBiKey(props.copy + ".waterfall"))} tabIndex={0}>
                <table class="sf-bi-waterfall-table">
                  <caption>{t(sfBiKey(props.copy + ".waterfall"))}</caption>
                  <thead><tr>
                    <th scope="col">{t(sfBiKey(props.copy + ".column.series"))}</th>
                    <th scope="col">{t(sfBiKey(props.copy + ".waterfall.start"))}</th>
                    <th scope="col">{t(sfBiKey(props.copy + ".waterfall.delta"))}</th>
                    <th scope="col">{t(sfBiKey(props.copy + ".waterfall.end"))}</th>
                  </tr></thead>
                  <tbody><For each={plan().segments}>
                    {(segment) => {
                      const value = (id: string) => assigned().get(id)
                      const shown = (id: string) => {
                        const item = value(id)
                        return fmt(item?.evidenceState !== "absent" && typeof item?.value === "number"
                          ? item.value : null)
                      }
                      return <tr data-sf-waterfall-row={segment.componentValueId}>
                        <th scope="row">{segment.label}</th>
                        <td>{shown(segment.startValueId)}</td>
                        <td>{shown(segment.componentValueId)}</td>
                        <td>{shown(segment.endValueId)}</td>
                      </tr>
                    }}
                  </For></tbody>
                </table>
              </div>
              <ol class="sf-bi-steps">
                <For each={plan().segments}>
                  {(segment) => {
                    const start = () => assigned().get(segment.startValueId)
                    const amount = () => assigned().get(segment.componentValueId)
                    const end = () => assigned().get(segment.endValueId)
                    const ref = () => amount() ? sfBiValueSource(amount()!) : undefined
                    return (
                      <li data-sf-step={segment.componentValueId}>
                        <strong>{segment.label}</strong>
                        <span>{t(sfBiKey(props.copy + ".waterfall.start"))}: {fmt(start()?.evidenceState !== "absent" && typeof start()?.value === "number" ? start()!.value as number : null)}</span>
                        <span>{t(sfBiKey(props.copy + ".waterfall.delta"))}: {fmt(amount()?.evidenceState !== "absent" && typeof amount()?.value === "number" ? amount()!.value as number : null)}</span>
                        <span>{t(sfBiKey(props.copy + ".waterfall.end"))}: {fmt(end()?.evidenceState !== "absent" && typeof end()?.value === "number" ? end()!.value as number : null)}</span>
                        <Show when={ref()}>{(reference) =>
                          <button class="mx-btn" type="button" data-sf-source-value-id={reference().valueId}
                            onClick={() => props.onSelect(reference().refId, reference())}>
                            {t(sfBiKey(props.copy + ".selectComponent"))}
                          </button>}
                        </Show>
                      </li>
                    )
                  }}
                </For>
              </ol>
            </section>
          )}
        </Show>
        <Show when={timeline()}>
          {(plan) => (
            <section class="sf-bi-plan" data-sf-timeline>
              <h3>{t(sfBiKey(props.copy + ".timeline"))}</h3>
              <ol class="sf-bi-steps">
                <For each={plan().items}>
                  {(item) => {
                    const date = () => assigned().get(item.dateValueId)
                    const observedDate = () => date()?.evidenceState !== "absent" &&
                      typeof date()?.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date()!.value as string)
                        ? date()!.value as string : null
                    return <li data-sf-milestone={item.dateValueId}>
                      <strong>{item.label}</strong>
                      <span>{observedDate() ?? t(sfBiKey(props.copy + ".missingDate"))}</span>
                      <span>{t(sfBiKey(props.copy + ".milestone." + (observedDate() ? item.state : "unknown")))}</span>
                      <Show when={date() && sfBiValueSource(date()!)}>
                        {(source) => <button class="mx-btn" type="button" data-sf-source-value-id={source().valueId}
                          onClick={() => props.onOpenSource(source().refId, source())}>
                          {t(sfBiKey(props.copy + ".openSource"))}
                        </button>}
                      </Show>
                    </li>
                  }}
                </For>
              </ol>
            </section>
          )}
        </Show>
        <Show when={model().limitations.length > 0}>
          <section class="sf-bi-limitations">
            <h3>{t(sfBiKey(props.copy + ".limitations"))}</h3>
            <ul><For each={model().limitations}>{(note) => <li>{note}</li>}</For></ul>
          </section>
        </Show>
      </div>
    </SfChartFrame>
  )
}
