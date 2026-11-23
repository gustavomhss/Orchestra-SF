import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { comparableReviewSections, preservedComponentRows, preservedSectionHasChanges, preservedValueRows, readPreservedProjection, reviewReadState, sameSourceMaterial, type PreservedComponent, type PreservedReview, type PreservedSourceRef, type PreservedValue, type ReviewProjection } from "../preserved/model"
import { AmountText, PeriodText, StatusText, WhenText } from "../labels"
import { preservedValuePresentation } from "../preserved/presentation"
import { SfPreservedFieldLabel, SfPreservedRecordLabel, SfPreservedValueText } from "../preserved/value"
import "../preserved/preserved.css"
import "../workflows.css"

const key = (value: string) => value as SfCopyKey

type Translate = (value: string) => string

/** Display only reauthorized source lineage, never a reconstructed or freshly fetched source. */
function SourceRefList(props: { sources: readonly PreservedSourceRef[]; t: Translate }) {
  return <Show when={props.sources.length > 0} fallback={<span>{props.t("sf.u32.notRecorded")}</span>}>
    <details class="sf-technical-details"><summary>{props.t("sf.u32.inspectSource")} ({props.sources.length})</summary>
    <ul class="sf-n28-source-list">
      <For each={props.sources}>{(source) => <li>
        <span>{source.surface} / {source.type} / {source.id}</span>
        <span> · {props.t("sf.u32.incarnation")}: {source.incarnation}</span>
        <span> · {props.t("sf.u32.sourceVersion")}: {source.version}</span>
        <span> · {props.t("sf.u32.observed")}: <WhenText iso={source.observedAt} /></span>
        <span> · {props.t("sf.u32.period")}: <PeriodText start={source.period.start} end={source.period.end} /></span>
        <Show when={source.fields.length > 0}>
          <span> · {props.t("sf.u32.fields")}: {source.fields.join(", ")}</span>
        </Show>
      </li>}</For>
    </ul>
    </details>
  </Show>
}

type EvidenceRef = PreservedValue["sourceRefs"][number]
function EvidenceList(props: { sources: readonly EvidenceRef[]; t: Translate }) {
  return <Show when={props.sources.length > 0} fallback={<span>{props.t("sf.u32.notRecorded")}</span>}>
    <details class="sf-technical-details"><summary>{props.t("sf.u32.inspectSource")} ({props.sources.length})</summary>
    <ul class="sf-n28-source-list">
      <For each={props.sources}>{(source) => <li>
        <span>{source.kind} / {source.refId}</span>
        <span> · {props.t("sf.u32.digest")}: {source.refDigest}</span>
        {source.kind === "record" ? <>
          <span> · {source.target.surface} / {source.target.recordType} / {source.target.recordId}</span>
          <span> · {props.t("sf.u32.incarnation")}: {source.target.incarnation}</span>
          <span> · {props.t("sf.u32.sourceVersion")}: {source.target.version}</span>
        </> : null}
      </li>}</For>
    </ul>
    </details>
  </Show>
}

function SourceGaps(props: { gaps: ReviewProjection["missing"]; t: Translate }) {
  return <Show when={props.gaps.length > 0} fallback={<span>{props.t("sf.u32.noDeclaredGaps")}</span>}>
    <ul class="sf-n28-source-list">
      <For each={props.gaps}>{(gap) => <li><bdi>{gap.field}</bdi>: <StatusText value={gap.reason} /></li>}</For>
    </ul>
  </Show>
}

function ChangeKinds(props: {
  numeric: boolean; value: boolean; attributes: boolean; source: boolean; t: Translate
}) {
  return <div class="sf-n28-change-tags">
    <Show when={props.numeric}><span>{props.t("sf.u32.numericChange")}</span></Show>
    <Show when={props.value && !props.numeric}><span>{props.t("sf.u32.literalChange")}</span></Show>
    <Show when={props.attributes}><span>{props.t("sf.u32.attributeChange")}</span></Show>
    <Show when={props.source}><span>{props.t("sf.u32.provenanceChange")}</span></Show>
  </div>
}

/** Values, currency, unit, evidence and declared coverage are observed, never calculated. */
function ValueCell(props: { entry: PreservedValue | undefined; projection: ReviewProjection; t: Translate }) {
  return <Show when={props.entry} fallback={<span>{props.t("sf.u32.notRecorded")}</span>}>
    {(entry) => <div class="sf-n28-compare-value">
      <strong>{entry().value === null ? props.t("sf.u32.explicitNull") : <SfPreservedValueText value={entry()} showUnits={false} />}</strong>
      <span>{props.t("sf.u32.currency")}: {entry().currency === "unspecified" ? props.t("sf.u32.currencyNotProvided") : entry().currency === "" ? props.t("sf.u32.emptyText") : entry().currency ?? props.t("sf.u32.notProvided")}</span>
      <span>{props.t("sf.u32.unit")}: {entry().unit === "" ? props.t("sf.u32.emptyText") : entry().unit ?? props.t("sf.u32.notProvided")}</span>
      <span>{props.t("sf.u32.evidence")}: <StatusText value={entry().evidenceState} /></span>
      <span>{props.t("sf.u32.completeness")}: {props.projection.missing.length > 0
        ? props.t("sf.u32.declaredGaps") : props.t("sf.u32.noDeclaredGaps")}</span>
      <Show when={entry().sourceRefs.length > 0 || entry().drilldown !== null}>
        <span>{props.t("sf.u32.sources")}:</span>
        <EvidenceList sources={entry().sourceRefs} t={props.t} />
        <Show when={entry().drilldown}>
          {(evidence) => <span>{props.t("sf.u32.drilldown")}: {evidence().refId} · {props.t("sf.u32.digest")}: {evidence().refDigest}</span>}
        </Show>
      </Show>
    </div>}
  </Show>
}

function ComponentCell(props: { entry: PreservedComponent | undefined; t: Translate }) {
  return <Show when={props.entry} fallback={<span>{props.t("sf.u32.notRecorded")}</span>}>
    {(entry) => <div class="sf-n28-compare-value">
      <strong>{entry().amount === null ? props.t("sf.u32.explicitNull") : <AmountText value={entry().amount} currency={entry().currency} />}</strong>
      <span>{props.t("sf.u32.currency")}: {entry().currency}</span>
      <span>{props.t("sf.u32.evidence")}: <StatusText value={entry().evidenceState} /></span>
      <span>{props.t("sf.u32.sources")}:</span>
      <SourceRefList sources={entry().sourceRefs} t={props.t} />
    </div>}
  </Show>
}

/** UI49: compare independently reauthorized, preserved public material; no domain calculations. */
export function SfReviewCompareView(props: SfSurfaceProps<"UI49">) {
  const owner = useSfContext()
  const language = useLanguage()
  const uid = createUniqueId()
  const t = (value: string) => language.t(value as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    ownerKey: "",
    previousRef: String(props.route.query.previousReview ?? ""),
    currentRef: String(props.route.query.currentReview ?? ""),
    previous: undefined as PreservedReview | undefined,
    current: undefined as PreservedReview | undefined,
    state: "ready" as SfUiState,
    reason: "",
    busy: false,
    changedOrder: false,
  })
  let inFlight: AbortController | undefined
  const sameOwner = (generation: number, keyValue: string) => {
    const state = owner.state()
    return owner.generation() === generation && state.status === "ready" && state.ownerKey === keyValue
  }
  const read = async () => {
    const state = owner.state(), access = owner.ready()
    const a = store.previousRef.trim(), b = store.currentRef.trim()
    if (!access || state.status !== "ready" || !a || !b || a === b ||
      a.length > 2048 || b.length > 2048 || store.busy) {
      setStore({ state: "invalid", reason: "sf.u32.choose" })
      return
    }
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller
    const generation = owner.generation(), ownerKey = state.ownerKey
    setStore({ state: "loading", busy: true, previous: undefined, current: undefined, reason: "" })
    try {
      const client = createSfReviewsClient(access.transport)
      const [previousResult, currentResult] = await Promise.all([
        client["dashboard.dashboard-review"]({ id: a }, { signal: controller.signal }),
        client["dashboard.dashboard-review"]({ id: b }, { signal: controller.signal }),
      ])
      if (controller.signal.aborted || !sameOwner(generation, ownerKey)) return
      const statusA = previousResult.kind === "response" && previousResult.body.status === "ok"
      const statusB = currentResult.kind === "response" && currentResult.body.status === "ok"
      if (!statusA || !statusB) {
        const first = statusA ? "ready" : reviewReadState(previousResult)
        const second = statusB ? "ready" : reviewReadState(currentResult)
        setStore({
          state: first === "denied" || second === "denied" ? "denied" :
            first === "stale" || second === "stale" ? "stale" : first !== "ready" ? first : second,
          reason: "sf.u32.reviewUnavailable",
          previous: undefined, current: undefined,
        })
        return
      }
      const previous = previousResult.body.value
      const current = currentResult.body.value
      if (previous.id !== a || current.id !== b) {
        setStore({ state: "invalid", reason: "sf.u32.reviewUnavailable" })
        return
      }
      setStore({
        previous, current, state: "ready", reason: "",
        changedOrder: previous.sections.map((section) => section.id).join("\0") !==
          current.sections.map((section) => section.id).join("\0"),
      })
    } catch (error) {
      if (controller.signal.aborted || !sameOwner(generation, ownerKey)) return
      console.error("Sucafina preserved review comparison failed", error instanceof Error ? error.name : "unknown")
      setStore({ state: "unavailable", reason: "sf.u32.reviewUnavailable", previous: undefined, current: undefined })
    } finally {
      if (sameOwner(generation, ownerKey)) setStore("busy", false)
    }
  }
  createEffect(() => {
    const generation = owner.generation()
    const state = owner.state()
    if (state.status !== "ready") {
      inFlight?.abort()
      setStore({
        ownerKey: "", previous: undefined, current: undefined, busy: false,
        state: state.status === "denied" ? "denied"
          : state.status === "unauthenticated" ? "session-expired"
          : state.status === "context-mismatch" ? "invalid"
          : state.status === "resolving" ? "loading" : "unavailable",
      })
    } else if (state.ownerKey !== store.ownerKey) {
      inFlight?.abort()
      setStore({
        ownerKey: state.ownerKey, previous: undefined, current: undefined, busy: false, state: "ready",
        previousRef: String(props.route.query.previousReview ?? ""),
        currentRef: String(props.route.query.currentReview ?? ""),
      })
    }
    onCleanup(() => { if (owner.generation() !== generation) inFlight?.abort() })
  })
  onCleanup(() => inFlight?.abort())
  const compatible = () => !!store.previous && !!store.current && comparableReviewSections(store.previous, store.current)
  const reviewSourcesChanged = () => !!store.previous && !!store.current &&
    !sameSourceMaterial(store.previous.sourceRefs, store.current.sourceRefs)
  const changed = () => compatible() && (reviewSourcesChanged() || store.previous!.sections.some((before) => {
    const after = store.current!.sections.find((section) => section.id === before.id)
    return !!after && preservedSectionHasChanges(before, after)
  }))
  return (
    <SfPageFrame titleKey={key("sf.ui49.title")} context={[]} tabs={[]} activeTab={null}
      secondaryActions={[]} density="comfortable" layout="comparison" onLayoutMode={() => undefined}
      primaryAction={{
        id: "compare", labelKey: key("sf.ui49.primary"), tone: "primary",
        disabled: store.busy || !owner.ready() || !store.previousRef.trim() ||
          !store.currentRef.trim() || store.previousRef === store.currentRef,
        busy: store.busy, onInvoke: () => { void read() },
      }}
    >
      <div data-sf-wave="polish" class="sf-n28 sf-workflow" data-sf-surface="UI49" data-sf-compare-state={store.state}>
        <form class="sf-n28-form sf-form sf-fields" onSubmit={(event) => { event.preventDefault(); void read() }}>
          <label class="sf-n28-field" for={uid + "-previous"}>{t("sf.u32.previous")}
            <input id={uid + "-previous"} required maxlength="2048" autocomplete="off"
              value={store.previousRef} onInput={(event) => setStore({ previousRef: event.currentTarget.value,
                previous: undefined, current: undefined, state: "ready" })} />
          </label>
          <label class="sf-n28-field" for={uid + "-current"}>{t("sf.u32.current")}
            <input id={uid + "-current"} required maxlength="2048" autocomplete="off"
              value={store.currentRef} onInput={(event) => setStore({ currentRef: event.currentTarget.value,
                previous: undefined, current: undefined, state: "ready" })} />
          </label>
          <button class="mx-btn" type="submit" disabled={store.busy || !owner.ready()}>{t("sf.u32.readCompare")}</button>
        </form>
        <SfStatePanel state={store.state} messageKey={key(store.reason || "sf.u32.reviewUnavailable")}
          onRetryRead={() => { void read() }}>
          <Show when={store.previous && store.current}>
            <section class="sf-section" data-sf-comparison-compatibility={compatible() ? "compatible" : "incompatible"}>
              <h2>{t(compatible() ? "sf.u32.compatible" : "sf.u32.incompatible")}</h2>
              <dl class="sf-n28-dual">
                <div class="mx-card">
                  <dt>{t("sf.u32.previous")}</dt><dd>{store.previous?.id}</dd>
                  <dt>{t("sf.u32.version")}</dt><dd>{store.previous?.version}</dd>
                  <dt>{t("sf.u32.created")}</dt><dd>{store.previous?.createdAt ? <WhenText iso={store.previous.createdAt} /> : null}</dd>
                </div>
                <div class="mx-card">
                  <dt>{t("sf.u32.current")}</dt><dd>{store.current?.id}</dd>
                  <dt>{t("sf.u32.version")}</dt><dd>{store.current?.version}</dd>
                  <dt>{t("sf.u32.created")}</dt><dd>{store.current?.createdAt ? <WhenText iso={store.current.createdAt} /> : null}</dd>
                </div>
              </dl>
              <Show when={compatible()}>
                <Show when={store.changedOrder}><p role="status">{t("sf.u32.orderChanged")}</p></Show>
                <h3>{t("sf.u32.diff")}</h3>
                <Show when={changed() || store.changedOrder} fallback={<p>{t("sf.u32.unchanged")}</p>}>
                  <div class="sf-n28-section sf-section" data-sf-comparison-diff="authorized">
                    <For each={store.previous?.sections}>{(before) => {
                      const after = () => store.current?.sections.find((section) => section.id === before.id)
                      const left = () => readPreservedProjection(before.content)
                      const right = () => after() ? readPreservedProjection(after()!.content) : undefined
                      const valueRows = () => after() ? preservedValueRows(before, after()!) : []
                      const componentRows = () => after() ? preservedComponentRows(before, after()!) : []
                      return <Show when={after() && preservedSectionHasChanges(before, after()!)}>
                        <section class="mx-card sf-n28-section sf-section" data-section-id={before.id}>
                          <h4>{before.title}</h4>
                          <div class="sf-n28-scroll" role="region" aria-label={before.title} tabIndex={0}>
                            <table>
                              <caption>{t("sf.u32.diff")}</caption>
                              <thead><tr><th scope="col">{t("sf.u32.value")}</th>
                                <th scope="col">{t("sf.u32.before")}</th><th scope="col">{t("sf.u32.after")}</th></tr></thead>
                              <tbody>
                                <Show when={before.count !== after()!.count}>
                                  <tr><th scope="row">{t("sf.u32.records")}</th>
                                    <td data-label={t("sf.u32.before")}>{before.count}</td><td data-label={t("sf.u32.after")}>{after()!.count}</td></tr>
                                </Show>
                                <Show when={before.title !== after()!.title}>
                                  <tr><th scope="row">{t("sf.u32.sections")}</th>
                                    <td data-label={t("sf.u32.before")}>{before.title}</td><td data-label={t("sf.u32.after")}>{after()!.title}</td></tr>
                                </Show>
                                <For each={valueRows()}>{(row) => <tr data-sf-value-id={row.id}
                                  data-change-numeric={String(row.numericChanged)}
                                  data-change-value={String(row.valueChanged)}
                                  data-change-attributes={String(row.attributesChanged)}
                                  data-change-source={String(row.provenanceChanged)}>
                                  <th scope="row">
                                    <SfPreservedFieldLabel value={row.after ?? row.before!} values={row.after ? right()!.values : left()!.values} />
                                    <small class="sf-preserved-period"><SfPreservedRecordLabel
                                      presentation={preservedValuePresentation(row.after ?? row.before!, row.after ? right()!.values : left()!.values)} /></small>
                                    <details class="sf-technical-details"><summary>{t("sf.u32.valueReference")}</summary><bdi data-sf-diff-id>{row.id}</bdi></details>
                                    <ChangeKinds numeric={row.numericChanged}
                                    value={row.valueChanged} attributes={row.attributesChanged}
                                    source={row.provenanceChanged} t={t} /></th>
                                  <td data-label={t("sf.u32.before")}><ValueCell entry={row.before} projection={left()!} t={t} /></td>
                                  <td data-label={t("sf.u32.after")}><ValueCell entry={row.after} projection={right()!} t={t} /></td>
                                </tr>}</For>
                                <For each={componentRows()}>{(row) => <tr data-sf-component-id={row.id}
                                  data-change-numeric={String(row.numericChanged)}
                                  data-change-value={String(row.valueChanged)}
                                  data-change-attributes={String(row.attributesChanged)}
                                  data-change-source={String(row.provenanceChanged)}>
                                  <th scope="row">{t("sf.u32.projectionComponents")}: {row.id}
                                    <ChangeKinds numeric={row.numericChanged} value={row.valueChanged}
                                      attributes={row.attributesChanged} source={row.provenanceChanged} t={t} />
                                  </th>
                                  <td data-label={t("sf.u32.before")}><ComponentCell entry={row.before} t={t} /></td>
                                  <td data-label={t("sf.u32.after")}><ComponentCell entry={row.after} t={t} /></td>
                                </tr>}</For>
                                <Show when={!sameSourceMaterial(before.sourceRefs, after()!.sourceRefs)}>
                                  <tr data-change-source="true"><th scope="row">{t("sf.u32.sectionSources")}</th>
                                    <td data-label={t("sf.u32.before")}><SourceRefList sources={before.sourceRefs} t={t} /></td>
                                    <td data-label={t("sf.u32.after")}><SourceRefList sources={after()!.sourceRefs} t={t} /></td></tr>
                                </Show>
                                <Show when={left()!.version !== right()!.version}>
                                  <tr data-change-source="true"><th scope="row">{t("sf.u32.projectionVersion")}</th>
                                    <td data-label={t("sf.u32.before")}>{left()!.version}</td><td data-label={t("sf.u32.after")}>{right()!.version}</td></tr>
                                </Show>
                                <Show when={!sameSourceMaterial(left()!.context.sourceRefs, right()!.context.sourceRefs)}>
                                  <tr data-change-source="true"><th scope="row">{t("sf.u32.projectionSources")}</th>
                                    <td data-label={t("sf.u32.before")}><SourceRefList sources={left()!.context.sourceRefs} t={t} /></td>
                                    <td data-label={t("sf.u32.after")}><SourceRefList sources={right()!.context.sourceRefs} t={t} /></td></tr>
                                </Show>
                                <Show when={!sameSourceMaterial(left()!.missing, right()!.missing)}>
                                  <tr data-change-source="true"><th scope="row">{t("sf.u32.sourceGaps")}</th>
                                    <td data-label={t("sf.u32.before")}><SourceGaps gaps={left()!.missing} t={t} /></td>
                                    <td data-label={t("sf.u32.after")}><SourceGaps gaps={right()!.missing} t={t} /></td></tr>
                                </Show>
                              </tbody>
                            </table>
                          </div>
                        </section>
                      </Show>
                    }}</For>
                    <Show when={reviewSourcesChanged()}>
                      <details class="mx-card sf-n28-section sf-section sf-n28-provenance">
                        <summary>{t("sf.u32.reviewSources")}</summary>
                        <div class="sf-n28-scroll" role="region" aria-label={t("sf.u32.reviewSources")} tabIndex={0}>
                          <table>
                            <caption>{t("sf.u32.provenanceChange")}</caption>
                            <thead><tr><th scope="col">{t("sf.u32.sources")}</th>
                              <th scope="col">{t("sf.u32.before")}</th><th scope="col">{t("sf.u32.after")}</th></tr></thead>
                            <tbody><tr data-change-source="true"><th scope="row">{t("sf.u32.reviewSources")}</th>
                              <td data-label={t("sf.u32.before")}><SourceRefList sources={store.previous!.sourceRefs} t={t} /></td>
                              <td data-label={t("sf.u32.after")}><SourceRefList sources={store.current!.sourceRefs} t={t} /></td>
                            </tr></tbody>
                          </table>
                        </div>
                      </details>
                    </Show>
                  </div>
                </Show>
              </Show>
            </section>
          </Show>
        </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
