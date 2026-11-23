import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { SF_U19_COPY } from "@/i18n/orchestra-chapters/sf-u19"
import type { SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfDecisionHref, sfCaseIsListed } from "../scenarios/paths"
import { sfDecisionControls, sfPortfolioReady, sfSensitivityEvaluate,
  sfSensitivityRecorded, sfSensitivityUnitsForSelection,
  type SfSensitivityRequest, type SfSensitivityUnits } from "../scenarios/producer"
import type { SfCaseControls, SfSensitivityResultView } from "../scenarios/model"
import "./sensitivity.css"
import "../../reviews/workflows.css"

const k = (key: keyof typeof SF_U19_COPY) => key as SfCopyKey
const horizonLabel = (start: string, end: string, locale: string) => {
  const day = (value: string) => {
    const iso = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
    const date = new Date(iso + "T00:00:00Z")
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date)
  }
  return day(start) + " — " + day(end)
}
type View = {
  status: SfUiState; caseState: SfUiState
  controls: SfCaseControls | null
  cases: SfCaseControls["cases"]
  result: Readonly<{ resultRef: string; value: SfSensitivityResultView }> | null
  scenarioRef: string; baselineRef: string; parameterRef: string
  ruleId: string; operator: "lte" | "gte" | "eq"; criterionValue: string
  minimum: string; maximum: string; steps: string
  units: SfSensitivityUnits | null
  unitsState: SfUiState
  review: boolean; busy: boolean; outcomeUnknown: boolean
  message: keyof typeof SF_U19_COPY | null
}
/** UI44: source-issued sensitivity units, registered rule, sampled values, no interpolation. */
export function SfSensitivityView(props: SfSurfaceProps<"UI44">): JSX.Element {
  const owner = useSfContext()
  const navigate = useNavigate()
  const language = useLanguage()
  const t = (key: keyof typeof SF_U19_COPY) => language.t(key as Parameters<typeof language.t>[0])
  const [selectedRef, setSelectedRef] = createSignal<string | null>(null)
  const [refresh, setRefresh] = createSignal(0)
  const [store, set] = createStore<View>({
    status: "loading", caseState: "loading", controls: null, cases: [], result: null,
    scenarioRef: "", baselineRef: "", parameterRef: "",
    ruleId: "", operator: "lte", criterionValue: "",
    minimum: "", maximum: "", steps: "16", units: null, unitsState: "empty",
    review: false, busy: false, outcomeUnknown: false, message: null,
  })
  const active = () => owner.state().status === "ready" ? owner.ready() : undefined
  const routeCase = () => "caseRef" in props.route.params ? props.route.params.caseRef as string : undefined
  const routeResult = () => "resultRef" in props.route.params ? props.route.params.resultRef as string : undefined
  const wanted = () => routeCase() ?? selectedRef() ?? undefined
  const admitted = (id: string) => {
    const current = active()
    return !!current && sfPortfolioReady(current.context, id,
      id.startsWith("decisions.") ? "decisions" : "portfolio")
  }
  const selection = () => store.controls?.selected ?? null
  const scenarios = () => selection()?.scenarios ?? []
  const parameters = () => scenarios().find((entry) => entry.ref === store.scenarioRef)?.parameters ?? []
  const unitsCurrent = () => !!store.units && !!selection() && store.units.caseRef.version === selection()!.caseRef.version &&
    store.units.scenarioRef === store.scenarioRef && store.units.baselineRef === store.baselineRef &&
    store.units.parameterRef === store.parameterRef && store.scenarioRef !== store.baselineRef
  const invalidateUnits = () => set({ units: null, unitsState: "empty", review: false })
  const routeTo = (target: "sensitivity-selection" | "sensitivity-result", caseRef?: string, resultRef?: string) => {
    const href = sfDecisionHref(props.route, target, { caseRef, resultRef })
    if (href) navigate(href)
  }
  createEffect(() => {
    refresh()
    const status = owner.state().status
    const current = active()
    const epoch = owner.generation()
    const caseRef = wanted()
    const resultRef = routeResult()
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    set({ status: status === "ready" ? "loading" : status === "denied" ? "denied" :
      status === "unauthenticated" ? "session-expired" : "unavailable", caseState: "loading",
      cases: [], controls: null, result: null, units: null, unitsState: "empty",
      scenarioRef: "", baselineRef: "", parameterRef: "", ruleId: "", review: false,
      message: null, busy: false, outcomeUnknown: false })
    if (!current || status !== "ready") return
    if (current.context.stamp.projectId !== props.route.ownerSelection.projectId ||
      (props.route.ownerSelection.installationId &&
       current.context.stamp.installationId !== props.route.ownerSelection.installationId)) {
      set("status", "denied"); return
    }
    const live = () => !controller.signal.aborted && owner.generation() === epoch
    void (async () => {
      const listing = await sfDecisionControls(current.transport, current.context, undefined, controller.signal)
      if (!live()) return
      if (listing.status !== "ok") { set("status", listing.state); return }
      set({ cases: listing.value.cases, status: listing.value.cases.length ? "ready" : "empty" })
      if (!caseRef) return
      if (!sfCaseIsListed(listing.value.cases, caseRef)) {
        set({ status: "denied", caseState: "denied" }); return
      }
      const details = await sfDecisionControls(current.transport, current.context, caseRef, controller.signal)
      if (!live()) return
      if (details.status !== "ok" || !details.value.selected) {
        set("caseState", details.status === "ok" ? "unavailable" : details.state); return
      }
      set({ controls: details.value, caseState: "ready" })
      if (resultRef) {
        const result = await sfSensitivityRecorded(current.transport, current.context,
          details.value.selected.caseRef, resultRef, controller.signal)
        if (!live()) return
        if (result.status !== "ok") { set("caseState", result.state); return }
        set("result", { resultRef, value: result.value.result })
      } else if (details.value.selected.unitSelection) {
        const chosen = details.value.selected.unitSelection
        set({ scenarioRef: chosen.scenarioRef, baselineRef: chosen.baselineRef, parameterRef: chosen.parameterRef })
      }
    })().catch(() => { if (live()) set("status", "unavailable") })
  })

  const request = createMemo<SfSensitivityRequest | null>(() => {
    const bounds = [store.minimum, store.maximum, store.criterionValue].map((item) =>
      item.trim() !== "" && /^-?(?:\d+|\d*\.\d+)$/.test(item.trim()) ? Number(item) : NaN)
    const steps = Number(store.steps)
    if (!unitsCurrent() || !admitted("portfolio.decision-sensitivity-evaluate") ||
      !store.ruleId || !selection()?.rules.some((rule) => rule.id === store.ruleId &&
        Number.isSafeInteger(rule.expectedVersion) && rule.expectedVersion! > 0) ||
      bounds.some((n) => !Number.isFinite(n)) || bounds[0]! > bounds[1]! ||
      !Number.isSafeInteger(steps) || steps < 1 || steps > 1024) return null
    return {
      scenarioRef: store.scenarioRef,
      parameterBounds: { parameterRef: store.parameterRef, minimum: bounds[0]!, maximum: bounds[1]!, steps },
      criterion: { id: store.ruleId, operator: store.operator, value: bounds[2]! },
    }
  })
  const issue = () => {
    const current = active(), selected = selection()
    if (!current || !selected || !admitted("portfolio.decision-sensitivity-units") ||
      !scenarios().some((item) => item.ref === store.scenarioRef) ||
      !scenarios().some((item) => item.ref === store.baselineRef) ||
      store.scenarioRef === store.baselineRef ||
      !parameters().some((item) => item.ref === store.parameterRef) ||
      store.busy) return
    const epoch = owner.generation(), caseRef = selected.caseRef
    const scenario = store.scenarioRef, baseline = store.baselineRef, parameter = store.parameterRef
    const controller = new AbortController()
    set({ busy: true, units: null, unitsState: "loading", review: false, message: null })
    void sfSensitivityUnitsForSelection(current.transport, current.context, caseRef,
      scenario, baseline, parameter, controller.signal).then((result) => {
      if (owner.generation() !== epoch || selection()?.caseRef.version !== caseRef.version ||
        store.scenarioRef !== scenario || store.baselineRef !== baseline || store.parameterRef !== parameter) return
      if (result.status !== "ok") { set("unitsState", result.state); return }
      set({ units: result.value, unitsState: "ready" })
    }).catch(() => {
      if (owner.generation() === epoch) set("unitsState", "unavailable")
    }).finally(() => {
      controller.abort()
      if (owner.generation() === epoch) set("busy", false)
    })
  }
  const evaluate = () => {
    const current = active(), selected = selection(), sourceRequest = request()
    if (!current || !selected || !sourceRequest || !store.review || store.busy ||
      store.outcomeUnknown || !unitsCurrent()) return
    const epoch = owner.generation(), caseRef = selected.caseRef, originalCaseRef = selected.ref
    const controller = new AbortController()
    const commandKey = crypto.randomUUID()
    set({ busy: true, message: null })
    void sfSensitivityEvaluate(current.transport, current.context, caseRef, sourceRequest,
      commandKey, controller.signal).then((result) => {
      if (owner.generation() !== epoch || selection()?.caseRef.version !== caseRef.version) return
      if (result.status !== "ok") {
        set({ review: false, caseState: result.state, outcomeUnknown: result.state === "outcome-unknown",
          message: result.state === "outcome-unknown" ? "sf.u19.action.unknown" : "sf.u19.action.stale" })
        return
      }
      set({ review: false, result: { resultRef: result.value.resultRef, value: result.value.result },
        message: "sf.u19.action.saveAccepted" })
      routeTo("sensitivity-result", originalCaseRef, result.value.resultRef)
    }).catch(() => {
      if (owner.generation() === epoch) set({
        review: false, outcomeUnknown: true, caseState: "outcome-unknown", message: "sf.u19.action.unknown",
      })
    }).finally(() => {
      controller.abort()
      if (owner.generation() === epoch) set("busy", false)
    })
  }
  const render = (result: SfSensitivityResultView): JSX.Element =>
    <section class="sf-u19-sensitivity-results">
      <dl class="sf-u19-sensitivity-facts">
        <div><dt>{t("sf.u19.sensitivity.scenario")}</dt><dd><bdi>{result.scenarioRef}</bdi></dd></div>
        <div><dt>{t("sf.u19.sensitivity.parameter")}</dt><dd><bdi>{result.parameterRef}</bdi></dd></div>
        <div><dt>{t("sf.u19.results.comparison")}</dt><dd>{result.comparisonStatus}</dd></div>
        <div><dt>{t("sf.u19.sensitivity.unit")}</dt><dd>{result.parameterUnit ?? t("sf.u19.results.sourceUnknown")} / {result.resultUnit ?? result.unit}</dd></div>
        <div><dt>{t("sf.u19.results.coverage")}</dt><dd>{result.costCoverageRefs.length} {t("sf.u19.results.sources")}</dd></div>
      </dl>
      <h3>{t("sf.u19.sensitivity.table")}</h3>
      <div class="sf-u19-table-scroll"><table>
        <thead><tr><th scope="col">{t("sf.u19.sensitivity.parameterValue")}</th>
          <th scope="col">{t("sf.u19.sensitivity.resultValue")}</th>
          <th scope="col">{t("sf.u19.results.resultRef")}</th></tr></thead>
        <tbody><For each={result.evaluated}>{(sample) =>
          <tr><td class="sf-u19-num">{sample.parameterValue} {result.parameterUnit ?? ""}</td>
            <td class="sf-u19-num">{sample.value === null ? t("sf.u19.sensitivity.unknown") : String(sample.value) + " " + result.unit}</td>
            <td><bdi>{sample.resultRef}</bdi></td></tr>
        }</For></tbody>
      </table></div>
      <section class="sf-u19-threshold">
        <h3>{t("sf.u19.sensitivity.threshold")}</h3>
        <Show when={result.thresholdEvidence.state === "exact" && result.thresholdEvidence}>
          {(proof) => <p>{t("sf.u19.sensitivity.exact")}: {proof().state === "exact" ? proof().value : ""}</p>}
        </Show>
        <Show when={result.thresholdEvidence.state === "sampled" && result.thresholdEvidence}>
          {(proof) => <p>{t("sf.u19.sensitivity.sampled")}: {proof().state === "sampled" ?
            proof().interval.minimum + " — " + proof().interval.maximum : ""}</p>}
        </Show>
        <Show when={result.thresholdEvidence.state === "unavailable"}>
          <p role="status">{t("sf.u19.sensitivity.unavailable")}: {result.thresholdEvidence.state === "unavailable" &&
            result.thresholdEvidence.reason}</p>
        </Show>
      </section>
      <Show when={result.unresolvedConditions.length || result.comparisonStatus !== "complete"}>
        <section><h3>{t("sf.u19.results.conditions")}</h3><p>{t("sf.u19.sensitivity.unknownCoverage")}</p>
          <ul><For each={result.unresolvedConditions}>{(item) =>
            <li><bdi>{item.id}: {item.reason}</bdi></li>
          }</For></ul></section>
      </Show>
      <section><h3>{t("sf.u19.results.sources")}</h3><ul>
        <For each={result.evidenceRefs}>{(id) => <li><bdi>{id}</bdi></li>}</For>
      </ul></section>
      <p>{t("sf.u19.action.nullKnown")}</p>
    </section>
  return (
    <SfPageFrame titleKey={k("sf.ui44.title")} context={[]} tabs={[]} activeTab={null}
      density="comfortable" layout="split" onLayoutMode={() => undefined}
      primaryAction={!routeResult() && store.units && admitted("portfolio.decision-sensitivity-evaluate") ? {
        id: "sensitivity-evaluate", labelKey: k("sf.ui44.primary"), tone: "primary",
        disabled: !request() || store.busy || store.outcomeUnknown,
        busy: store.busy, onInvoke: () => set("review", true),
      } : undefined}
      secondaryActions={[]}
    >
      <section data-sf-wave="polish" class="sf-u19-sensitivity sf-workflow" data-sf-sensitivity data-sf-surface="UI44">
        <SfStatePanel state={store.status} messageKey={k("sf.u19.case.missing")}
          onRetryRead={() => setRefresh((n) => n + 1)}>
          <Show when={store.message}><p role="status" class="sf-u19-message">{t(store.message!)}</p></Show>
          <Show when={!routeResult()}>
            <section>
              <h2>{t("sf.u19.case.choose")}</h2>
              <label class="sf-u19-sensitivity-field">{t("sf.u19.case.list")}
                <select value={wanted() ?? ""} disabled={store.busy || !!routeCase()}
                  onChange={(event) => setSelectedRef(event.currentTarget.value || null)}>
                  <option value="">{t("sf.u19.case.choose")}</option>
                  <For each={store.cases}>{(option) =>
                    <option value={option.ref}>{option.title} · {t("sf.u19.case.version")} {option.version}</option>
                  }</For>
                </select>
              </label>
            </section>
          </Show>
          <Show when={wanted()}>
            <SfStatePanel state={store.caseState} messageKey={k("sf.u19.case.missing")}
              onRetryRead={() => setRefresh((n) => n + 1)}>
              <Show when={selection()}>
                {(current) => <>
                  <header class="sf-u19-sensitivity-header sf-section-header"><h2>{current().objective}</h2>
                    <p>{current().currency} · {horizonLabel(current().horizon.start, current().horizon.end, language.intl())}</p></header>
                  <Show when={routeResult()} fallback={
                    <section class="sf-u19-sensitivity-form sf-section sf-form">
                      <p>{t("sf.u19.sensitivity.choose")}</p>
                      <fieldset disabled={store.busy || store.outcomeUnknown}>
                        <legend>{t("sf.u19.sensitivity.choose")}</legend>
                        <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.scenario")}
                          <select value={store.scenarioRef} onChange={(event) => {
                            set({ scenarioRef: event.currentTarget.value, parameterRef: "" }); invalidateUnits()
                          }}>
                            <option value="">{t("sf.u19.case.choose")}</option>
                            <For each={scenarios()}>{(item) => <option value={item.ref}>{item.title}</option>}</For>
                          </select>
                        </label>
                        <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.baseline")}
                          <select value={store.baselineRef} onChange={(event) => {
                            set("baselineRef", event.currentTarget.value); invalidateUnits()
                          }}>
                            <option value="">{t("sf.u19.case.choose")}</option>
                            <For each={scenarios()}>{(item) => <option value={item.ref} disabled={item.ref === store.scenarioRef}>{item.title}</option>}</For>
                          </select>
                        </label>
                        <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.parameter")}
                          <select value={store.parameterRef} onChange={(event) => {
                            set("parameterRef", event.currentTarget.value); invalidateUnits()
                          }}>
                            <option value="">{t("sf.u19.case.choose")}</option>
                            <For each={parameters()}>{(item) => <option value={item.ref}>{item.label}</option>}</For>
                          </select>
                        </label>
                        <button class="mx-btn" type="button" disabled={!admitted("portfolio.decision-sensitivity-units") ||
                          !store.scenarioRef || !store.baselineRef || store.scenarioRef === store.baselineRef ||
                          !store.parameterRef || store.busy} onClick={issue}>{t("sf.u19.sensitivity.unit")}</button>
                      </fieldset>
                      <Show when={store.unitsState !== "empty"}>
                        <SfStatePanel state={store.unitsState} messageKey={k("sf.u19.sensitivity.noUnits")}>
                          <Show when={unitsCurrent()}>
                            <p>{t("sf.u19.sensitivity.unit")}: {store.units!.parameterUnit} / {store.units!.resultUnit}</p>
                            <p>{t("sf.u19.results.sources")}: {store.units!.sourceRefs.length}</p>
                            <fieldset class="sf-u19-criterion" disabled={store.busy || store.outcomeUnknown}>
                              <legend>{t("sf.u19.sensitivity.criterion")}</legend>
                              <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.criterion")}
                                <select value={store.ruleId} onChange={(event) => { set("ruleId", event.currentTarget.value); set("review", false) }}>
                                  <option value="">{t("sf.u19.case.choose")}</option>
                                  <For each={current().rules}>{(rule) =>
                                    <option value={rule.id} disabled={!rule.expectedVersion}>{rule.id} · v{rule.expectedVersion ?? "?"}</option>
                                  }</For>
                                </select>
                              </label>
                              <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.operator")}
                                <select value={store.operator} onChange={(event) => { set("operator", event.currentTarget.value as View["operator"]); set("review", false) }}>
                                  <option value="lte">{t("sf.u19.operator.lte")} (≤)</option>
                                  <option value="gte">{t("sf.u19.operator.gte")} (≥)</option>
                                  <option value="eq">{t("sf.u19.operator.eq")} (=)</option>
                                </select>
                              </label>
                              <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.thresholdValue")}
                                <input type="number" step="any" value={store.criterionValue} onInput={(event) => { set("criterionValue", event.currentTarget.value); set("review", false) }} />
                              </label>
                              <div class="sf-u19-sensitivity-bounds">
                                <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.minimum")}
                                  <input type="number" step="any" value={store.minimum} onInput={(event) => { set("minimum", event.currentTarget.value); set("review", false) }} />
                                </label>
                                <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.maximum")}
                                  <input type="number" step="any" value={store.maximum} onInput={(event) => { set("maximum", event.currentTarget.value); set("review", false) }} />
                                </label>
                                <label class="sf-u19-sensitivity-field">{t("sf.u19.sensitivity.steps")}
                                  <input type="number" step="1" min="1" max="1024" value={store.steps} onInput={(event) => { set("steps", event.currentTarget.value); set("review", false) }} />
                                </label>
                              </div>
                            </fieldset>
                            <Show when={store.review && request()}>
                              <section class="sf-u19-review" role="region" aria-label={t("sf.u19.sensitivity.preview")}>
                                <h3>{t("sf.u19.sensitivity.preview")}</h3>
                                <dl><div><dt>{t("sf.u19.sensitivity.scenario")}</dt><dd>{scenarios().find((item) => item.ref === store.scenarioRef)?.title ?? t("sf.u19.results.sourceUnknown")}</dd></div>
                                  <div><dt>{t("sf.u19.sensitivity.baseline")}</dt><dd>{scenarios().find((item) => item.ref === store.baselineRef)?.title ?? t("sf.u19.results.sourceUnknown")}</dd></div>
                                  <div><dt>{t("sf.u19.sensitivity.parameter")}</dt><dd>{parameters().find((item) => item.ref === store.parameterRef)?.label ?? t("sf.u19.results.sourceUnknown")}</dd></div>
                                  <div><dt>{t("sf.u19.sensitivity.thresholdValue")}</dt><dd>{language.t("sf.u19.sensitivity.reviewCriterion" as Parameters<typeof language.t>[0], {
                                    operator: t(`sf.u19.operator.${store.operator}`), value: store.criterionValue, unit: store.units?.resultUnit ?? "",
                                  })}</dd></div>
                                  <div><dt>{t("sf.u19.sensitivity.basis")}</dt><dd>{store.minimum} — {store.maximum} ({store.steps}) {store.units?.parameterUnit}</dd></div></dl>
                                <details class="sf-technical-details">
                                  <summary>{t("sf.u19.sourceDetails")}</summary>
                                  <dl>
                                    <div><dt>{t("sf.u19.sensitivity.scenario")}</dt><dd><bdi>{store.scenarioRef}</bdi></dd></div>
                                    <div><dt>{t("sf.u19.sensitivity.baseline")}</dt><dd><bdi>{store.baselineRef}</bdi></dd></div>
                                    <div><dt>{t("sf.u19.sensitivity.parameter")}</dt><dd><bdi>{store.parameterRef}</bdi></dd></div>
                                    <div><dt>{t("sf.u19.sensitivity.criterion")}</dt><dd><bdi>{store.ruleId}</bdi></dd></div>
                                  </dl>
                                </details>
                                <p>{t("sf.u19.scenarios.notCalculated")}</p>
                                <div class="sf-u19-buttons sf-form-actions">
                                  <button type="button" class="mx-btn primary" disabled={store.busy || store.outcomeUnknown || !request()}
                                    onClick={evaluate}>{t("sf.u19.sensitivity.confirm")}</button>
                                  <button type="button" class="mx-btn" onClick={() => set("review", false)}>{t("sf.u19.action.cancel")}</button>
                                </div>
                              </section>
                            </Show>
                          </Show>
                        </SfStatePanel>
                      </Show>
                    </section>
                  }>
                    <Show when={store.result}>{(record) => <>
                      <p>{t("sf.u19.results.resultRef")}: <bdi>{record().resultRef}</bdi></p>
                      {render(record().value)}
                      <button class="mx-btn" type="button" onClick={() => routeTo("sensitivity-selection")}>
                        {t("sf.u19.action.clear")}
                      </button>
                    </>}</Show>
                  </Show>
                </>}</Show>
            </SfStatePanel>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
