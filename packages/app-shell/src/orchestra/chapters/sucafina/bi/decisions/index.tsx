/**
 * N25/U22 — BI09/BI10/BI11. Pure renderer over A08's closed C16 producer DTO.
 *
 * Every metric, unit, negative, zero, missing value and source token is carried
 * verbatim from the admitted BI projection. Charts may scale for pixels in F03;
 * neither this renderer nor F03 performs financial math, FX, or interpolation.
 * U21 owns the BI page's authorized load/reload and shared route composition.
 */
import { createEffect, createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfBiBiDataOutput } from "@orchestra/schema/sucafina/bi"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import {
  SfChartFrame, type SfChartFrameProps, type SfCopyKey, type SfCoverage,
  type SfDisplayValue, type SfMessage, type SfPlotSeries, type SfText, type SfUiState,
} from "../../shared/frame"
import type { SF_U22_COPY } from "@/i18n/orchestra-chapters/sf-u22"
import { sfBiPeriodLabel } from "../finance/model"
import "./u22.css"

type DecisionViewId = "BI09" | "BI10" | "BI11"
export type SfDecisionBiProjection = Extract<SfBiBiDataOutput, { projection: object }>
export type SfDecisionFigureProps = Readonly<{
  viewId: DecisionViewId
  projection: SfDecisionBiProjection
  selection: SfRef | null
  onSelect: (selectionRef: SfRef) => void
  onOpenSource: (sourceRef: SfRef) => void
  onOpenValueSource?: (valueId: string, referenceDigest: string) => void
}>

const key = (name: string) => name as SfCopyKey
const msg = (name: string, params?: Record<string, string | number>): SfMessage => ({
  key: key(name), ...(params ? { params } : {}),
})
const data = (text: string): SfText => ({ kind: "data", text })
const ref = (value: string): SfRef => value as SfRef
const missing = (): SfDisplayValue => ({ kind: "missing", reason: msg("sf.u22.chart.missing") })
const display = (value: string | number | boolean | null): SfDisplayValue =>
  value === null ? missing() :
  { kind: "text", text: data(String(value)) } // 0, signs, precision and booleans survive

function valueUnit(unit: string, currency?: string): SfPlotSeries["unit"] {
  return currency === unit && /^[A-Z]{3}$/.test(unit) ? { kind: "currency", code: unit } :
    { kind: "quantity", label: msg("sf.u22.chart.unitNamed", { name: unit }) }
}

export function SfDecisionFigure(props: SfDecisionFigureProps): JSX.Element {
  const language = useLanguage()
  const t = (name: keyof typeof SF_U22_COPY, params?: Record<string, string | number>) =>
    language.t(name as Parameters<typeof language.t>[0], params)
  const packet = () => props.projection
  const projection = () => packet().projection
  const presentation = () => packet().presentation
  const decision = () => projection().decision
  const portfolio = () => { const current = decision(); return current?.kind === "portfolio" ? current.portfolio : undefined }
  const scenario = () => { const current = decision(); return current?.kind === "scenario" ? current : undefined }
  const isView = () => packet().request.viewId === props.viewId && presentation().viewId === props.viewId
  const exactValue = (valueId: string) => projection().values.find((value) => value.id === valueId)

  type RecordedValue = SfDecisionBiProjection["projection"]["values"][number]
  const numeric = (value: RecordedValue | undefined) => value?.evidenceState !== "absent" &&
    typeof value?.value === "number" ? value.value : null
  const literal = (value: RecordedValue | undefined) => !value || value.value === null ||
    value.evidenceState === "absent" ? t("sf.u22.chart.missing") : String(value.value)
  const origins = (value: RecordedValue) => {
    const sources = value.drilldown ? [value.drilldown] : value.sourceRefs
    return sources.filter((source, index) => sources.findIndex((other) => other.refDigest === source.refDigest) === index)
  }
  const [sourceChoice, setSourceChoice] = createSignal<{ value: RecordedValue; label: string }>()
  createEffect(() => { props.projection; setSourceChoice(undefined) })
  const openValueSource = (value: RecordedValue, referenceDigest: string) => {
    const source = origins(value).find((entry) => entry.refDigest === referenceDigest)
    if (!source) return
    setSourceChoice(undefined)
    if (props.onOpenValueSource) props.onOpenValueSource(value.id, source.refDigest)
    else { const token = tokenFor(source.refDigest); if (token) props.onOpenSource(token) }
  }
  const chooseValueSource = (value: RecordedValue, label: string) => {
    const choices = origins(value)
    if (choices.length === 1) openValueSource(value, choices[0]!.refDigest)
    else if (choices.length > 1) setSourceChoice({ value, label })
  }
  const sourceButtons = (value: RecordedValue | undefined) => <Show when={value}>
    {(recorded) => <Show when={origins(recorded()).length} fallback={<span>{t("sf.u22.chart.noSource")}</span>}>
      <For each={origins(recorded())}>{(source) =>
        <button class="mx-btn" type="button" data-bi-origin={source.refDigest}
          onClick={() => openValueSource(recorded(), source.refDigest)}>{source.refId}</button>
      }</For>
    </Show>}
  </Show>
  const waterfallRows = createMemo(() => {
    const plan = presentation().waterfall
    if (!plan) return []
    const first = exactValue(plan.segments[0]?.startValueId ?? "")
    const last = exactValue(plan.finalValueId)
    return [
      { label: t("sf.u22.waterfall.initial"), id: first?.id ?? "", source: first, total: true,
        start: 0, end: numeric(first), amount: numeric(first) },
      ...plan.segments.map((segment) => {
        const source = exactValue(segment.componentValueId)
        return { label: segment.label, id: segment.componentValueId, source, total: false,
          start: numeric(exactValue(segment.startValueId)), end: numeric(exactValue(segment.endValueId)),
          amount: numeric(source) }
      }),
      { label: t("sf.u22.waterfall.final"), id: plan.finalValueId, source: last, total: true,
        start: 0, end: numeric(last), amount: numeric(last) },
    ]
  })
  // Coordinates only. Every endpoint and contribution above is a producer value.
  const waterfallAxis = createMemo(() => {
    const numbers = waterfallRows().flatMap((row) => [row.start, row.end].filter((value): value is number => value !== null))
    const low = Math.min(0, ...numbers), high = Math.max(0, ...numbers)
    const span = high - low || 1
    return (value: number) => 155 - (value - low) / span * 140
  })
  const advantage = createMemo(() => {
    const comparison = projection().comparison
    const decision = scenario()
    if (!comparison || !decision || comparison.metricRef !== "planner:known-subtotal-difference" ||
        comparison.comparisonRef === decision.comparisonRef || comparison.version !== projection().version ||
        comparison.engineVersion !== projection().engineVersion ||
        JSON.stringify(comparison.context) !== JSON.stringify(projection().context) ||
        new Set(comparison.values.map((value) => value.id)).size !== comparison.values.length) return
    const amount = comparison.values.find((value) => value.id === "scenario:advantage-known-difference")
    const state = comparison.values.find((value) => value.id === "scenario:advantage-comparison-status")
    if (!amount || !state || (amount.value !== null && typeof amount.value !== "number") ||
        amount.currency !== decision.scenario.currency ||
        amount.period.start !== decision.scenario.horizon.start || amount.period.end !== decision.scenario.horizon.end ||
        state.period.start !== decision.scenario.horizon.start || state.period.end !== decision.scenario.horizon.end ||
        (state.value !== "complete" && state.value !== "conditioned" && state.value !== "incompatible" && state.value !== "unavailable")) return
    return { comparison, amount, state: state.value }
  })
  const navigation = () => packet().navigation
  const tokenFor = (origin: string) => {
    const entry = navigation()?.entries.find((item) => item.key === origin)
    return entry ? ref(entry.token) : undefined
  }
  const tokenForResult = (resultRef: string) => navigation()?.entries.find(
    (entry) => entry.kind === "result" && entry.key === resultRef,
  )?.token

  const coverage = createMemo((): SfCoverage => {
    const result = decision()
    if (!isView()) return {
      state: "unavailable", summary: msg("sf.u22.chart.coverageUnknown"),
      reasons: [], knownCount: null, expectedCount: null,
    }
    if (result?.kind === "scenario") {
      const current = result.scenario.costCoverage
      const state = current.coverageState === "complete" ? "complete" :
        current.coverageState === "pending" ? "partial" : "unavailable"
      return {
        state,
        summary: msg(state === "complete" ? "sf.u22.chart.coverageComplete" :
          state === "partial" ? "sf.u22.chart.coveragePartial" : "sf.u22.chart.coverageUnknown"),
        reasons: current.issues.map((name) => msg("sf.u22.chart.limitNamed", { name })),
        knownCount: null, expectedCount: null,
      }
    }
    // Portfolio results have no global coverage bool. Do not imply completeness.
    return {
      state: "unavailable", summary: msg("sf.u22.chart.coverageUnknown"),
      reasons: [
        ...projection().missing.map((item) => msg("sf.u22.chart.limitNamed", { name: item.field + ": " + item.reason })),
        ...(result?.kind === "portfolio" ? result.portfolio.limitations.map((name) =>
          msg("sf.u22.chart.limitNamed", { name })) : []),
      ],
      knownCount: null, expectedCount: null,
    }
  })

  const series = createMemo((): readonly SfPlotSeries[] => {
    if (!isView()) return []
    return presentation().series.map((item) => ({
      id: item.id,
      label: msg("sf.u22.chart.seriesNamed", { name: item.label }),
      unit: valueUnit(item.unit, projection().context.currency),
      semanticToken: item.role,
      points: item.valueIds.map((valueId) => {
        const recorded = exactValue(valueId)
        const sourceToken = recorded?.drilldown ? tokenFor(recorded.drilldown.refDigest) :
          recorded?.sourceRefs.map((entry) => tokenFor(entry.refDigest)).find(Boolean)
        return {
          id: valueId, x: recorded?.period.start ?? valueId,
          xLabel: data(recorded
            ? sfBiPeriodLabel(recorded.period.start, recorded.period.end, language.intl())
            : valueId),
          value: recorded && typeof recorded.value === "number" && recorded.evidenceState !== "absent"
            ? { kind: "known" as const, value: recorded.value }
            : { kind: "missing" as const, reason: msg("sf.u22.chart.missing") },
          ...(sourceToken ? { selectionRef: sourceToken } : {}),
        }
      }),
    }))
  })

  const table = createMemo((): SfChartFrameProps["table"] => {
    const columns = [
      { id: "label", label: msg("sf.u22.chart.measure") },
      { id: "value", label: msg("sf.u22.chart.value") },
      { id: "unit", label: msg("sf.u22.chart.unit") },
      { id: "evidence", label: msg("sf.u22.chart.evidenceState") },
      { id: "period", label: msg("sf.u22.chart.period") },
      { id: "source", label: msg("sf.u22.chart.source") },
    ] as const
    return {
      caption: msg("sf.u22.chart.caption"), columns,
      rows: presentation().series.flatMap((item) => item.valueIds.map((valueId) => {
        const measured = exactValue(valueId)
        const source = measured?.drilldown ?? measured?.sourceRefs[0]
        const sourceToken = source ? tokenFor(source.refDigest) : undefined
        return {
          id: item.id + ":" + valueId,
          ...(sourceToken ? { selectionRef: sourceToken } : {}),
          cells: {
            label: display(item.label),
            value: measured ? display(measured.value) : missing(),
            unit: display(measured?.unit ?? measured?.currency ?? item.unit),
            evidence: display(measured?.evidenceState ?? "absent"),
            period: measured ? display(sfBiPeriodLabel(measured.period.start, measured.period.end, language.intl())) : missing(),
            source: source ? display(source.refId) : missing(),
          },
        }
      })),
    }
  })

  const title = () => key(props.viewId === "BI09" ? "sf.u22.bi09.title" :
    props.viewId === "BI10" ? "sf.u22.bi10.title" : "sf.u22.bi11.title")
  const question = () => key(props.viewId === "BI09" ? "sf.u22.bi09.question" :
    props.viewId === "BI10" ? "sf.u22.bi10.question" : "sf.u22.bi11.question")
  const state = (): SfUiState => {
    if (!isView()) return "invalid"
    if (!decision()) return "unavailable"
    if (projection().missing.length || presentation().limitations.length || coverage().state !== "complete") return "partial"
    if (!presentation().series.length) return "empty"
    return "ready"
  }
  const chartContext = createMemo((): SfChartFrameProps["context"] => [
    { label: msg("sf.u22.chart.period"), value: data(sfBiPeriodLabel(packet().request.period.start, packet().request.period.end, language.intl())) },
    { label: msg("sf.u22.chart.unit"), value: data(projection().context.currency) },
    { label: msg("sf.u22.chart.engine"), value: data(projection().engineVersion) },
    { label: msg("sf.u22.chart.selection"), value: data(packet().request.selectionRef) },
  ])

  return (
    <div class="sf-u22-decision-figure" data-sf-bi-view={props.viewId}>
      <SfChartFrame
        titleKey={title()} questionKey={question()}
        context={chartContext()} coverage={coverage()} series={series()}
        table={table()} selection={props.selection} state={state()}
        onSelect={props.onSelect} onOpenSource={props.onOpenSource}
      >
        <Show when={isView()} fallback={<p role="alert">{t("sf.u22.chart.noResult")}</p>}>
          <Show when={advantage()}>{(recorded) => {
            const amount = () => literal(recorded().amount)
            const state = () => t(("sf.u22.advantage." + recorded().state) as keyof typeof SF_U22_COPY)
            const description = () => t("sf.u22.advantage.chart", {
              amount: amount(), currency: projection().context.currency, state: state(),
            })
            return <section class="sf-u22-detail">
              <h3>{t("sf.u22.advantage.title")}</h3>
              <p>{t("sf.u22.advantage.orientation")}</p>
              <svg viewBox="0 0 320 160" width="100%" style={{ "max-width": "24rem" }} role="img" aria-label={description()}>
                <title>{description()}</title>
                <line x1="25" x2="295" y1="80" y2="80" stroke="currentColor" />
                <Show when={numeric(recorded().amount) !== null}>
                  <rect x="135" y={numeric(recorded().amount)! >= 0 ? 20 : 80} width="50"
                    height={numeric(recorded().amount) === 0 ? 2 : 60} fill="currentColor" />
                </Show>
              </svg>
              <div class="sf-u22-table-scroll"><table>
                <caption>{t("sf.u22.advantage.caption")}</caption>
                <thead><tr>
                  <th scope="col">{t("sf.u22.chart.measure")}</th><th scope="col">{t("sf.u22.chart.value")}</th>
                  <th scope="col">{t("sf.u22.chart.unit")}</th><th scope="col">{t("sf.u22.chart.period")}</th>
                  <th scope="col">{t("sf.u22.chart.evidenceState")}</th><th scope="col">{t("sf.u22.chart.source")}</th>
                </tr></thead>
                <tbody><tr><td>{t("sf.u22.advantage.title")}</td><td>{amount()}</td>
                  <td>{projection().context.currency}</td>
                  <td>{recorded().amount.period.start} – {recorded().amount.period.end}</td>
                  <td>{state()}</td><td>{recorded().comparison.comparisonRef}</td>
                </tr></tbody>
              </table></div>
            </section>
          }}</Show>
          <section class="sf-u22-detail">
            <div class="sf-u22-table-scroll"><table>
              <caption>{t("sf.u22.values.caption")}</caption>
              <thead><tr>
                <th scope="col">{t("sf.u22.values.id")}</th><th scope="col">{t("sf.u22.chart.value")}</th>
                <th scope="col">{t("sf.u22.chart.unit")}</th><th scope="col">{t("sf.u22.chart.period")}</th>
                <th scope="col">{t("sf.u22.chart.evidenceState")}</th><th scope="col">{t("sf.u22.chart.source")}</th>
                <th scope="col">{t("sf.u22.chart.drilldown")}</th>
              </tr></thead>
              <tbody><For each={projection().values}>{(value) => <tr data-sf-bi-value={value.id}>
                <td>{value.id}</td><td>{literal(value)}</td><td>{value.currency ?? value.unit ?? t("sf.u22.chart.missing")}</td>
                <td>{value.period.start} – {value.period.end}</td><td>{value.evidenceState}</td>
                <td>{origins(value).map((source) => source.refId).join(", ") || t("sf.u22.chart.noSource")}</td>
                <td>{sourceButtons(value)}</td>
              </tr>}</For></tbody>
            </table></div>
          </section>
          <Show when={sourceChoice()}>{(choice) => <section class="sf-u22-detail" data-bi-source-chooser>
            <h3>{t("sf.u22.values.chooseSource")}: {choice().label}</h3>
            {sourceButtons(choice().value)}
          </section>}</Show>
          <Show when={props.viewId === "BI09"}>
            <section class="sf-u22-detail" aria-label={t("sf.u22.chart.components")}>
              <h3>{t("sf.u22.chart.components")}</h3>
              <Show when={presentation().waterfall}>
                {(waterfall) => <>
                  <p>{t("sf.u22.chart.reconciliation")}: {waterfall().reconciliation}</p>
                  <svg viewBox="0 0 620 180" width="100%" role="group" aria-label={t("sf.u22.waterfall.chart")}>
                    <For each={waterfallRows()}>{(row, index) => <Show when={row.start !== null && row.end !== null && row.amount !== null}>
                      <g data-bi-value={row.id} data-bi-kind={row.total ? "total" : "contribution"}
                        role={row.source && origins(row.source).length ? "button" : undefined}
                        tabindex={row.source && origins(row.source).length ? 0 : undefined}
                        aria-label={row.label + ": " + (row.amount! > 0 && !row.total ? "+" : "") + row.amount + " " + projection().context.currency}
                        onClick={() => { if (row.source) chooseValueSource(row.source, row.label) }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault(); if (row.source) chooseValueSource(row.source, row.label)
                        } }}>
                        <title>{row.label}: {row.amount! > 0 && !row.total ? "+" : ""}{row.amount} {projection().context.currency}</title>
                        <line x1={30 + index() * 560 / Math.max(1, waterfallRows().length - 1)}
                          x2={30 + index() * 560 / Math.max(1, waterfallRows().length - 1)}
                          y1={waterfallAxis()(row.start!)} y2={waterfallAxis()(row.end!)}
                          stroke="currentColor" stroke-width={row.total ? 14 : 8} />
                        <circle cx={30 + index() * 560 / Math.max(1, waterfallRows().length - 1)}
                          cy={waterfallAxis()(row.end!)} r="4" fill="currentColor" />
                      </g>
                    </Show>}</For>
                  </svg>
                  <div class="sf-u22-table-scroll">
                    <table>
                      <caption>{t("sf.u22.waterfall.caption")}</caption>
                      <thead><tr>
                        <th scope="col">{t("sf.u22.waterfall.component")}</th>
                        <th scope="col">{t("sf.u22.waterfall.start")}</th>
                        <th scope="col">{t("sf.u22.waterfall.contribution")}</th>
                        <th scope="col">{t("sf.u22.waterfall.end")}</th>
                        <th scope="col">{t("sf.u22.chart.source")}</th>
                      </tr></thead>
                      <tbody><For each={waterfallRows()}>{(row) => <tr>
                        <td>{row.label}</td>
                        <td>{row.total ? "—" : row.start === null ? t("sf.u22.chart.missing") : String(row.start)}</td>
                        <td>{row.total ? "—" : row.amount === null ? t("sf.u22.chart.missing") :
                          (row.amount > 0 ? "+" : "") + String(row.amount)}</td>
                        <td>{row.end === null ? t("sf.u22.chart.missing") : String(row.end)}</td>
                        <td>{sourceButtons(row.source)}</td>
                      </tr>}</For></tbody>
                    </table>
                  </div>
                  <Show when={waterfall().reconciliation !== "reconciled"}>
                    <p role="status">{t("sf.u22.chart.notRecommendation")}</p>
                  </Show>
                </>}
              </Show>
              <Show when={portfolio()}>
                <ul>
                  <For each={portfolio()?.combinations ?? []}>
                    {(combination) => <li>
                      {combination.id} — {combination.eligibility} / {combination.comparisonStatus}
                      <Show when={combination.conflicts.length}>
                        <ul><For each={combination.conflicts}>{(conflict) => <li>{conflict}</li>}</For></ul>
                      </Show>
                    </li>}
                  </For>
                </ul>
              </Show>
            </section>
          </Show>
          <Show when={props.viewId === "BI10"}>
            <section class="sf-u22-detail" aria-label={t("sf.u22.chart.timeline")}>
              <h3>{t("sf.u22.chart.timeline")}</h3>
              <Show when={presentation().timeline} fallback={<p>{t("sf.u22.chart.noData")}</p>}>
                {(timeline) => <ol class="sf-u22-timeline">
                  <For each={timeline().items}>
                    {(entry) => <li>
                      <span class="sf-u22-status">{entry.state === "planned" ? t("sf.u22.chart.planned") :
                        entry.state === "completed" ? t("sf.u22.chart.completed") : t("sf.u22.chart.unknown")}</span>
                      <strong>{entry.label}</strong>
                      <span>{readValue(entry.dateValueId)}</span>
                    </li>}
                  </For>
                </ol>}
              </Show>
            </section>
          </Show>
          <Show when={props.viewId === "BI11"}>
            <section class="sf-u22-detail" aria-label={t("sf.u22.chart.sensitivity")}>
              <h3>{t("sf.u22.chart.sensitivity")}</h3>
              <Show when={scenario()?.sensitivity}>
                {(sensitivity) => {
                  const current = sensitivity()
                  return <>
                    <dl>
                      <dt>{t("sf.u22.chart.comparison")}</dt><dd>{current.comparisonStatus}</dd>
                      <dt>{t("sf.u22.chart.threshold")}</dt>
                      <dd>{current.threshold === null ? t("sf.u22.chart.missing") : String(current.threshold)}</dd>
                      <dt>{t("sf.u22.chart.thresholdEvidence")}</dt>
                      <dd>{thresholdEvidence(current.thresholdEvidence)}</dd>
                    </dl>
                    <div class="sf-u22-table-scroll">
                      <table>
                        <caption>{t("sf.u22.bi11.question")}</caption>
                        <thead><tr>
                          <th scope="col">{t("sf.u22.chart.parameter")} ({current.parameterUnit ?? current.unit})</th>
                          <th scope="col">{t("sf.u22.chart.result")} ({current.resultUnit ?? current.unit})</th>
                          <th scope="col">{t("sf.u22.chart.source")}</th>
                        </tr></thead>
                        <tbody><For each={current.evaluated}>
                          {(point) => {
                            const targetToken = tokenForResult(point.resultRef)
                            return <tr>
                              <td>{String(point.parameterValue)}</td>
                              <td>{point.value === null ? t("sf.u22.chart.missing") : String(point.value)}</td>
                              <td><Show when={targetToken} fallback={<span>{point.resultRef}</span>}>
                                {(token) => <button class="mx-btn" type="button"
                                  aria-current={props.selection === ref(token()) ? "true" : undefined}
                                  onClick={() => props.onSelect(ref(token()))}>{point.resultRef}</button>}
                              </Show></td>
                            </tr>
                          }}
                        </For></tbody>
                      </table>
                    </div>
                    <Show when={current.unresolvedConditions.length}>
                      <h4>{t("sf.u22.chart.conditions")}</h4>
                      <ul><For each={current.unresolvedConditions}>
                        {(item) => <li>{item.category}: {item.reason}</li>}
                      </For></ul>
                    </Show>
                  </>
                }}
              </Show>
            </section>
          </Show>
          <Show when={navigation()?.entries.length}>
            <section class="sf-u22-detail" aria-label={t("sf.u22.chart.drilldown")}>
              <h3>{t("sf.u22.chart.drilldown")}</h3>
              <ul class="sf-u22-drilldown">
                <For each={navigation()?.entries ?? []}>
                  {(entry) => <li>
                    <button type="button" class="mx-btn"
                      aria-pressed={props.selection === ref(entry.token)}
                      onClick={() => entry.kind === "evidence" || entry.kind === "source"
                        ? props.onOpenSource(ref(entry.token)) : props.onSelect(ref(entry.token))}>
                      {entry.kind}: {entry.key}
                    </button>
                  </li>}
                </For>
              </ul>
            </section>
          </Show>
          <Show when={presentation().limitations.length || projection().missing.length}>
            <section class="sf-u22-detail" aria-label={t("sf.u22.chart.limits")}>
              <h3>{t("sf.u22.chart.limits")}</h3>
              <ul>
                <For each={presentation().limitations}>{(item) => <li>{item}</li>}</For>
                <For each={projection().missing}>{(item) => <li>{item.field}: {item.reason}</li>}</For>
              </ul>
            </section>
          </Show>
        </Show>
      </SfChartFrame>
    </div>
  )

  function readValue(id: string) {
    const value = exactValue(id)
    if (!value || value.value === null || value.evidenceState === "absent")
      return t("sf.u22.chart.missing")
    const unit = value.unit ?? value.currency
    return String(value.value) + (unit ? " " + unit : "")
  }

  function thresholdEvidence(evidence: NonNullable<NonNullable<ReturnType<typeof scenario>>["sensitivity"]>["thresholdEvidence"]): string {
    if (evidence.state === "exact") return evidence.state + ": " + evidence.value
    if (evidence.state === "sampled") return evidence.state + ": [" +
      evidence.interval.minimum + ", " + evidence.interval.maximum + "]"
    return evidence.state + ": " + evidence.reason
  }
}
