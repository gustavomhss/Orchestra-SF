/**
 * N25/U22 — BI09/BI10/BI11. Pure renderer over A08's closed C16 producer DTO.
 *
 * Every metric, unit, negative, zero, missing value and source token is carried
 * verbatim from the admitted BI projection. Charts may scale for pixels in F03;
 * neither this renderer nor F03 performs financial math, FX, or interpolation.
 * U21 owns the BI page's authorized load/reload and shared route composition.
 */
import { createMemo, For, Show, type JSX } from "solid-js"
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
          <Show when={props.viewId === "BI09"}>
            <section class="sf-u22-detail" aria-label={t("sf.u22.chart.components")}>
              <h3>{t("sf.u22.chart.components")}</h3>
              <Show when={presentation().waterfall}>
                {(waterfall) => <>
                  <p>{t("sf.u22.chart.reconciliation")}: {waterfall().reconciliation}</p>
                  <div class="sf-u22-table-scroll">
                    <table>
                      <caption>{t("sf.u22.bi09.question")}</caption>
                      <thead><tr>
                        <th scope="col">{t("sf.u22.chart.measure")}</th>
                        <th scope="col">{t("sf.u22.chart.parameter")}</th>
                        <th scope="col">{t("sf.u22.chart.result")}</th>
                        <th scope="col">{t("sf.u22.chart.components")}</th>
                      </tr></thead>
                      <tbody>
                        <For each={waterfall().segments}>
                          {(segment) => <tr>
                            <th scope="row">{segment.label}</th>
                            <td>{readValue(segment.startValueId)}</td>
                            <td>{readValue(segment.endValueId)}</td>
                            <td>{readValue(segment.componentValueId)}</td>
                          </tr>}
                        </For>
                      </tbody>
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
