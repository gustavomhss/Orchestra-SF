import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfContextHandle } from "../../context/contracts"
import { sfOperationReady, type SfCaseRecord } from "../cases/model"

type Controls = Extract<Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.controls.read"]["output"]>, { status: "ok" }>["value"]
type Coverage = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-coverage"]["input"]>
type Promote = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-promote"]["input"]>
type Phase = "editing" | "loading" | "classifying" | "promoting" | "unknown" | "failed" | "confirmed"
type Intent = { transport: SfTransport; generation: number; owner: string; body: Promote; key: string }

/** Initial alternatives use attached, inspected producer sources and original coverage CAS. */
export function SfInitialAlternative(props: {
  owner: SfContextHandle
  record: SfCaseRecord
  caseRef: string
  onReload: () => void
}) {
  const language = useLanguage()
  const t = (key: string) => language.t(("sf.ui35.author." + key) as Parameters<typeof language.t>[0])
  const [ui, setUi] = createStore<{
    phase: Phase; controls?: Controls; source: string; basis: string; title: string; reason: string
    message: string; coverage?: { ref: string; version: number; source: string; caseVersion: number; basis: string }
  }>({ phase: "editing", source: "", basis: "", title: "", reason: "", message: "" })
  let pending: AbortController | undefined
  // Keep the exact transport outside a reactive proxy; its admitted owner is ephemeral.
  let intention: Intent | undefined
  onCleanup(() => pending?.abort())
  createEffect(() => {
    props.owner.generation()
    props.record.id
    props.record.incarnation
    props.record.version
    pending?.abort()
    intention = undefined
    setUi({ phase: "editing", controls: undefined, coverage: undefined,
      source: "", basis: "", title: "", reason: "", message: "" })
  })
  const selected = () => ui.controls?.selected
  const forecast = () => selected()?.forecast
  const basis = () => ui.basis === "" ? undefined : selected()?.decision.costCoverageBases[Number(ui.basis)]
  const locked = () => ["loading", "classifying", "promoting", "unknown", "confirmed"].includes(ui.phase)
  const readyFor = (operation: string) => {
    const active = props.owner.ready()
    return !!active && sfOperationReady(active.context, operation)
  }
  const sameCase = (ref: { id: string; incarnation: string; version: number }) =>
    ref.id === props.record.id && ref.incarnation === props.record.incarnation && ref.version === props.record.version
  const ownerKey = () => {
    const state = props.owner.state()
    return state.status === "ready" ? state.ownerKey : undefined
  }
  const load = async (source?: string) => {
    const active = props.owner.ready(), generation = props.owner.generation(), owner = ownerKey()
    if (!active || !owner || locked() || !readyFor("decisions.controls.read")) return
    pending?.abort()
    const abort = new AbortController()
    pending = abort
    const version = props.record.version
    setUi({ phase: "loading", coverage: undefined, message: "" })
    try {
      const result = await createSfDecisionsClient(active.transport)["decisions.controls.read"](
        { case: props.caseRef, ...(source ? { source } : {}) }, { signal: abort.signal },
      )
      if (abort.signal.aborted || generation !== props.owner.generation() || owner !== ownerKey() || version !== props.record.version) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setUi({ controls: undefined, phase: "failed", message: "unavailable" })
        return
      }
      const value = result.body.value
      if (!value.selected || value.selected.ref !== props.caseRef || !sameCase(value.selected.caseRef) ||
          source && value.selected.forecast?.source.refDigest !== source) {
        setUi({ controls: undefined, phase: "failed", message: "changed" })
        return
      }
      setUi({ controls: value, phase: "editing", source: source ?? "", basis: "", message: "" })
    } catch {
      if (!abort.signal.aborted && generation === props.owner.generation() && owner === ownerKey())
        setUi({ controls: undefined, phase: "failed", message: "unavailable" })
    }
  }
  const saveCoverage = async () => {
    const active = props.owner.ready(), current = selected(), inspected = forecast(), inventory = basis()
    const owner = ownerKey(), generation = props.owner.generation(), fingerprint = ui.controls?.fingerprint
    if (!active || !owner || !current || !inspected || !inventory || locked() ||
        !sameCase(current.caseRef) || inspected.source.refDigest !== ui.source ||
        inspected.expectedVersion === undefined || !ui.reason.trim() ||
        !readyFor("decisions.decision-coverage")) return
    const input: Coverage = {
      caseRef: current.caseRef, source: inspected.source, basis: inventory,
      entries: [...inventory.categoryIds, ...inventory.additionalCategoryIds].map((categoryId) =>
        ({ categoryId, status: "pending" as const, reason: ui.reason.trim() })),
      expectedVersion: inspected.expectedVersion,
    }
    const selectedBasis = ui.basis
    const abort = new AbortController()
    pending = abort
    setUi({ phase: "classifying", coverage: undefined, message: "" })
    try {
      const result = await createSfDecisionsClient(active.transport)["decisions.decision-coverage"](
        input, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (abort.signal.aborted || generation !== props.owner.generation() || owner !== ownerKey() ||
          fingerprint !== ui.controls?.fingerprint || !sameCase(input.caseRef)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setUi({ phase: result.kind === "transport-error" && result.reason === "outcome-unknown" ? "unknown" : "failed", message: "coverageUnconfirmed" })
        return
      }
      if (result.body.value.version !== input.expectedVersion + 1) {
        setUi({ phase: "failed", message: "changed" })
        return
      }
      setUi({ phase: "editing", message: "coverageReady",
        coverage: { ref: result.body.value.coverageRef, version: result.body.value.version,
          source: input.source.refDigest, caseVersion: input.caseRef.version, basis: selectedBasis } })
    } catch {
      if (!abort.signal.aborted && generation === props.owner.generation() && owner === ownerKey())
        setUi({ phase: "unknown", message: "coverageUnconfirmed" })
    }
  }
  const canPromote = () => {
    const current = selected(), inspected = forecast(), coverage = ui.coverage
    return !locked() && !!ui.title.trim() && !!current && !!inspected && !!coverage &&
      sameCase(current.caseRef) && coverage.source === inspected.source.refDigest &&
      coverage.source === ui.source && coverage.caseVersion === current.caseRef.version &&
      coverage.basis === ui.basis && readyFor("decisions.decision-promote")
  }
  const promote = async (retry = false) => {
    const active = props.owner.ready(), owner = ownerKey()
    if (!active || !owner || !readyFor("decisions.decision-promote")) return
    if (!retry) {
      if (!canPromote()) return
      const current = selected()!, inspected = forecast()!
      intention = { transport: active.transport, generation: props.owner.generation(), owner,
        key: crypto.randomUUID(), body: { caseRef: current.caseRef, title: ui.title.trim(),
          scenario: { baseRef: inspected.source.refId, operations: [], assumptions: [] },
          coverageRef: ui.coverage!.ref } }
    }
    const original = intention
    if (!original || original.transport !== active.transport || original.owner !== owner ||
        original.generation !== props.owner.generation() || !sameCase(original.body.caseRef) ||
        retry && ui.phase !== "unknown") return
    const abort = new AbortController()
    pending = abort
    setUi({ phase: "promoting", message: "" })
    try {
      const result = await createSfDecisionsClient(original.transport)["decisions.decision-promote"](
        original.body, { signal: abort.signal, idempotencyKey: original.key, ...(retry ? { retry: "same-intent" as const } : {}) },
      )
      if (abort.signal.aborted || original.generation !== props.owner.generation() || original.owner !== ownerKey()) return
      if (result.kind !== "response") {
        setUi({ phase: result.reason === "outcome-unknown" ? "unknown" : "failed", message: "unconfirmed" })
        return
      }
      if (result.body.status !== "ok") {
        intention = undefined
        setUi({ phase: "failed", message: "changed" })
        return
      }
      const committed = result.body.value.caseRef
      if (committed.id !== original.body.caseRef.id || committed.incarnation !== original.body.caseRef.incarnation ||
          committed.version !== original.body.caseRef.version + 1) {
        setUi({ phase: "unknown", message: "unconfirmed" })
        return
      }
      intention = undefined
      setUi({ phase: "confirmed", message: "confirmed" })
      props.onReload()
    } catch {
      if (!abort.signal.aborted && original.generation === props.owner.generation() && original.owner === ownerKey())
        setUi({ phase: "unknown", message: "unconfirmed" })
    }
  }
  return <section class="mx-card sf-n24-section" aria-label={t("heading")} data-sf-alternative-create>
    <h2>{t("heading")}</h2>
    <p>{t("scope")}</p>
    <form onSubmit={(event) => event.preventDefault()}>
      <fieldset disabled={locked()}>
        <button type="button" class="mx-btn" disabled={!readyFor("decisions.controls.read")} onClick={() => void load()}>{t("load")}</button>
        <label>{t("source")}
          <select name="source" value={ui.source} onChange={(event) => setUi({ source: event.currentTarget.value, coverage: undefined, basis: "", message: "" })}>
            <option value="">{t("select")}</option>
            <For each={selected()?.forecasts ?? []}>{(item) => <option value={item.source.refDigest}>{item.label}</option>}</For>
          </select>
        </label>
        <button type="button" class="mx-btn" disabled={!ui.source || !readyFor("decisions.controls.read")} onClick={() => void load(ui.source)}>{t("inspect")}</button>
        <Show when={forecast()?.source.refDigest === ui.source ? forecast() : undefined}>
          {(item) => <section data-sf-alternative-preview data-state="ready" aria-label={t("preview")}>
            <p><bdi>{item().source.refId}</bdi></p>
            <p>{item().projection.context.currency} · {item().projection.context.period.start} – {item().projection.context.period.end}</p>
            <ul><For each={item().projection.components}>{(component) =>
              <li>{t("component")}: {component.amount === null ? t("unavailableValue") : component.amount} {component.currency} · {component.period.start} – {component.period.end}</li>
            }</For></ul>
          </section>}
        </Show>
        <label>{t("title")}<input name="title" value={ui.title} onInput={(event) => setUi("title", event.currentTarget.value)} /></label>
        <label>{t("basis")}
          <select name="basis" value={ui.basis} onChange={(event) => setUi({ basis: event.currentTarget.value, coverage: undefined, message: "" })}>
            <option value="">{t("select")}</option>
            <For each={selected()?.decision.costCoverageBases ?? []}>{(item, index) =>
              <option value={String(index())}>{item.decisionType} · {item.version}</option>
            }</For>
          </select>
        </label>
        <label>{t("reason")}<textarea name="reason" value={ui.reason} onInput={(event) =>
          setUi({ reason: event.currentTarget.value, coverage: undefined, message: "" })} /></label>
        <button type="button" class="mx-btn" disabled={!basis() || forecast()?.source.refDigest !== ui.source ||
          forecast()?.expectedVersion === undefined || !ui.reason.trim() || !readyFor("decisions.decision-coverage")}
          onClick={() => void saveCoverage()}>{t("saveCoverage")}</button>
        <Show when={ui.coverage}>{(coverage) =>
          <p data-sf-coverage-ref={coverage().ref} data-sf-coverage-version={coverage().version}>{t("coverageReady")} · {coverage().version}</p>
        }</Show>
        <button type="button" class="mx-btn" disabled={!canPromote()} onClick={() => void promote()}>{t("create")}</button>
      </fieldset>
    </form>
    <Show when={ui.message}><p role="status">{t(ui.message)}</p></Show>
    <Show when={ui.phase === "unknown" && intention}>
      <button type="button" class="mx-btn" onClick={() => void promote(true)}>{t("retry")}</button>
    </Show>
  </section>
}
