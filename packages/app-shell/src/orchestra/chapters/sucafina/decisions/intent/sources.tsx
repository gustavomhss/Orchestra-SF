import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { useLanguage } from "@/context/language"
import { createSfBiClient } from "@orchestra/client/sucafina/bi"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfBiBiDataOutput, SfBiBiOptionsOutput } from "@orchestra/schema/sucafina/bi"
import { useSfContext } from "../../context"
import { sfOperationReady, type SfCaseProjection, type SfCaseRecord } from "../cases/model"

type EditInput = typeof SfDecisions.operations["decisions.decision-edit"]["input"]["Type"]
type Sources = EditInput["sourceRefs"]
type Options = Extract<SfBiBiOptionsOutput, { status: "ok" }>["value"]["versions"]
type Inspected = Readonly<{
  source: Sources[number]
  label: string
  projection: Extract<SfBiBiDataOutput, { projection: unknown }>["projection"]
}>
type Phase = "editing" | "reviewing" | "submitting" | "unknown" | "conflict" | "failed"
type Controls = Extract<typeof SfDecisions.operations["decisions.controls.read"]["output"]["Type"], { status: "ok" }>["value"]
type ProcurementSource = NonNullable<NonNullable<Controls["selected"]>["procurementEvidence"]>["sources"][number]
const unresolvedEdits = new WeakMap<ReturnType<typeof useSfContext>, Set<string>>()
const procurementCopy = {
  find: ["Find Procurement sources", "Buscar fontes de Compras"],
  source: ["Procurement source", "Fonte de Compras"],
  inspect: ["Inspect selected procurement source", "Inspecionar fonte de Compras selecionada"],
  preview: ["Procurement source preview", "Prévia da fonte de Compras"],
  attach: ["Attach procurement source to draft", "Anexar fonte de Compras ao rascunho"],
  empty: ["No authorized Procurement sources were provided for this period.", "Nenhuma fonte autorizada de Compras foi fornecida para este período."],
} as const

/** Display and attach only issued evidence; the decision producer revalidates each digest and the case CAS. */
export function SfCaseSourcesEditor(props: Readonly<{
  projection: SfCaseProjection
  onSaved: () => void
}>) {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (key: string) => language.t(key as Parameters<typeof language.t>[0])
  const copy = (key: keyof typeof procurementCopy) => procurementCopy[key][language.locale().startsWith("pt") ? 1 : 0]
  const [reviewed, setReviewed] = createSignal<EditInput>()
  const [draft, setDraft] = createStore({
    objective: "", start: "", end: "", currency: "",
    criteria: [] as EditInput["criteria"],
    sources: [] as Sources,
    options: [] as Options,
    selected: "",
    inspected: undefined as Inspected | undefined,
    procurement: [] as readonly ProcurementSource[],
    procurementSelected: "",
    procurementInspected: undefined as ProcurementSource | undefined,
    busy: false,
    phase: "editing" as Phase,
    message: "",
  })
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())
  createEffect(() => {
    const record = props.projection.case
    owner.generation()
    pending?.abort()
    setReviewed(undefined)
    setDraft({ objective: record.objective, start: record.horizon.start, end: record.horizon.end,
      currency: record.currency, criteria: record.criteria.map(({ id, description, required }) => ({ id, description, required })),
      sources: record.sourceRefs, options: [], selected: "", inspected: undefined,
      procurement: [], procurementSelected: "", procurementInspected: undefined,
      busy: false, phase: "editing", message: "" })
  })
  const permitted = (operation: string) => {
    const ready = owner.ready()
    return !!ready && sfOperationReady(ready.context, operation)
  }
  const lockKey = () => {
    const stamp = owner.ready()?.context.stamp
    const record = props.projection.case
    if (stamp) return JSON.stringify([stamp.installationId, stamp.projectId, stamp.hostId, stamp.principalRef, record.id, record.incarnation, record.version])
  }
  const locked = () => {
    const key = lockKey()
    return !!key && unresolvedEdits.get(owner)?.has(key) === true
  }
  const editing = () => !draft.busy && (draft.phase === "editing" || draft.phase === "failed") && !locked()
  const current = (generation: number, record: SfCaseRecord) =>
    owner.generation() === generation && !!owner.ready() &&
    props.projection.case.id === record.id && props.projection.case.incarnation === record.incarnation &&
    props.projection.case.version === record.version
  const payload = (record: SfCaseRecord, sources: Sources | readonly unknown[]) =>
    Schema.decodeUnknownOption(Schema.toType(SfDecisions.operations["decisions.decision-edit"].input), { onExcessProperty: "error" })({
      caseRef: { id: record.id, incarnation: record.incarnation, version: record.version },
      objective: draft.objective.trim(),
      criteria: draft.criteria.map(({ id, description, required }) => ({ id, description: description.trim(), required })),
      horizon: { start: draft.start, end: draft.end }, currency: draft.currency, sourceRefs: sources,
    })
  const discover = async () => {
    const ready = owner.ready(), record = props.projection.case
    if (!ready || !editing() || !permitted("bi.bi-options")) return
    const generation = owner.generation()
    const abort = new AbortController()
    pending = abort
    setDraft({ busy: true, options: [], selected: "", inspected: undefined, message: "" })
    try {
      const result = await createSfBiClient(ready.transport)["bi.bi-options"]({
        viewId: "BI01", start: record.horizon.start, end: record.horizon.end,
      }, { signal: abort.signal })
      if (abort.signal.aborted || !current(generation, record)) return
      if (result.kind !== "response" || result.status !== 200 || result.body.status !== "ok")
        throw new Error("source-unavailable")
      setDraft({ options: result.body.value.versions, message: result.body.value.versions.length ? "" : "sf.ui34.sourcesEmpty" })
    } catch (error) {
      if (!abort.signal.aborted && current(generation, record))
        setDraft("message", "sf.ui34.sourcesUnavailable")
    } finally {
      if (!abort.signal.aborted && current(generation, record)) setDraft("busy", false)
    }
  }
  const inspect = async () => {
    const ready = owner.ready(), record = props.projection.case
    const choices = draft.options.filter((option) => option.ref === draft.selected)
    if (!ready || !editing() || !permitted("bi.bi-data") || choices.length !== 1) return
    const selected = choices[0]!, generation = owner.generation()
    const abort = new AbortController()
    pending = abort
    setDraft({ busy: true, inspected: undefined, message: "" })
    try {
      const result = await createSfBiClient(ready.transport)["bi.bi-data"]({
        viewId: "BI01", baseRef: selected.ref, candidateRef: selected.ref,
        currency: record.currency, start: record.horizon.start, end: record.horizon.end,
      }, { signal: abort.signal })
      if (abort.signal.aborted || !current(generation, record)) return
      if (result.kind !== "response" || result.status !== 200 || !("projection" in result.body))
        throw new Error("source-unavailable")
      const projection = result.body.projection, stamp = ready.context.stamp
      const context = projection.context
      if (context.installationId !== stamp.installationId || context.projectId !== stamp.projectId ||
        context.principalRef !== stamp.principalRef || context.policyVersion !== stamp.policyVersion ||
        context.accessRevision !== stamp.accessRevision || context.surface !== "planner" ||
        context.currency !== record.currency || context.period.start !== record.horizon.start ||
        context.period.end !== record.horizon.end) throw new Error("source-unavailable")
      const supplied = projection.values.flatMap((value) => [...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])])
      const matches = supplied.filter((ref, index, all) => ref.kind === "record" && ref.refId === selected.ref &&
        ref.installationId === stamp.installationId && ref.projectId === stamp.projectId &&
        ref.target.surface === "planner" && ref.target.recordType === "planner-version" &&
        !!ref.target.period && ref.target.period.start <= record.horizon.start && ref.target.period.end >= record.horizon.end &&
        all.findIndex((candidate) => candidate.refDigest === ref.refDigest) === index)
      if (matches.length !== 1) throw new Error("source-unavailable")
      const admitted = payload(record, [matches[0]])
      if (Option.isNone(admitted) || admitted.value.sourceRefs.length !== 1) throw new Error("source-unavailable")
      setDraft("inspected", { source: admitted.value.sourceRefs[0]!, label: selected.label, projection })
    } catch (error) {
      if (!abort.signal.aborted && current(generation, record))
        setDraft("message", "sf.ui34.sourcesUnavailable")
    } finally {
      if (!abort.signal.aborted && current(generation, record)) setDraft("busy", false)
    }
  }
  const attach = () => {
    const source = draft.inspected?.source
    if (!source || !editing() || draft.sources.some((current) => current.refDigest === source.refDigest)) return
    setDraft({ sources: [...draft.sources, source], inspected: undefined, message: "" })
  }
  const readProcurement = async (selected?: ProcurementSource) => {
    const ready = owner.ready(), record = props.projection.case
    if (!ready || !editing() || !permitted("decisions.controls.read")) return
    const generation = owner.generation(), abort = new AbortController()
    pending = abort
    setDraft({ busy: true, procurementInspected: undefined, message: "",
      ...(selected ? {} : { procurement: [], procurementSelected: "" }) })
    try {
      const caseRef = `case:${encodeURIComponent(record.id)}:${encodeURIComponent(record.incarnation)}`
      const reply = await createSfDecisionsClient(ready.transport)["decisions.controls.read"]({ case: caseRef }, { signal: abort.signal })
      if (abort.signal.aborted || !current(generation, record)) return
      if (reply.kind !== "response" || reply.status !== 200 || reply.body.status !== "ok") throw new Error("source-unavailable")
      const value = reply.body.value, observed = value.selected, stamp = ready.context.stamp
      if (value.accessRevision !== stamp.accessRevision || !value.actions.includes("decisions.edit") || !observed || observed.ref !== caseRef ||
        ![observed.caseRef, observed.decision].every((identity) => identity.id === record.id &&
          identity.incarnation === record.incarnation && identity.version === record.version) || !observed.procurementEvidence)
        throw new Error("source-unavailable")
      const sources = observed.procurementEvidence.sources.filter(({ source, projection }, _, all) => {
        const { target } = source, context = projection.context
        return source.evidenceLevel === "observed" && source.installationId === stamp.installationId && source.projectId === stamp.projectId &&
          target.surface === "procurement" && target.recordType === "procurement-request" && target.fields.includes("originalAmount") &&
          Number.isSafeInteger(target.version) && target.version > 0 &&
          source.refId === `sf-procurement:${encodeURIComponent(target.incarnation)}:${target.version}` &&
          target.period?.start === record.horizon.start && target.period.end === record.horizon.end &&
          context.surface === "procurement" && context.installationId === stamp.installationId && context.projectId === stamp.projectId &&
          context.principalRef === stamp.principalRef && context.policyVersion === stamp.policyVersion && context.accessRevision === stamp.accessRevision &&
          context.currency === record.currency && context.period.start === record.horizon.start && context.period.end === record.horizon.end &&
          projection.version === target.version && all.filter(({ source: other }) =>
            other.refDigest === source.refDigest || other.target.recordId === target.recordId).length === 1
      })
      if (!selected) { setDraft({ procurement: sources, message: sources.length ? "" : "procurement-empty" }); return }
      const found = sources.find(({ source }) => source.refDigest === selected.source.refDigest &&
        source.refId === selected.source.refId && source.target.recordId === selected.source.target.recordId)
      if (!found) throw new Error("source-unavailable")
      setDraft("procurementInspected", found)
    } catch {
      if (!abort.signal.aborted && current(generation, record)) setDraft("message", "sf.ui34.sourcesUnavailable")
    } finally {
      if (!abort.signal.aborted && current(generation, record)) setDraft("busy", false)
    }
  }
  const selectedProcurement = () => draft.procurement.find(({ source }) => source.refDigest === draft.procurementSelected)
  const procurementToAttach = () => {
    const inspected = draft.procurementInspected
    return inspected && draft.procurementSelected === inspected.source.refDigest &&
      !draft.sources.some((source) => source.kind === "record" && source.target.surface === "procurement" &&
        source.target.recordType === "procurement-request" && source.target.recordId === inspected.source.target.recordId) ? inspected.source : undefined
  }
  const changed = () => {
    const record = props.projection.case
    return draft.objective.trim() !== record.objective || draft.start !== record.horizon.start ||
      draft.end !== record.horizon.end || draft.currency !== record.currency ||
      draft.criteria.some((criterion, index) => criterion.description.trim() !== record.criteria[index]?.description) ||
      draft.sources.length !== record.sourceRefs.length
  }
  const review = () => {
    if (!editing() || !permitted("decisions.decision-edit") || !changed()) return
    const input = payload(props.projection.case, structuredClone(unwrap(draft.sources)))
    if (Option.isNone(input)) { setDraft("message", "sf.ui34.sourcesUnavailable"); return }
    setReviewed(input.value)
    setDraft({ phase: "reviewing", message: "" })
  }
  const save = async () => {
    const ready = owner.ready(), record = props.projection.case, input = reviewed(), key = lockKey()
    if (!ready || !input || !key || locked() || draft.busy || draft.phase !== "reviewing" || !permitted("decisions.decision-edit") ||
      input.caseRef.id !== record.id || input.caseRef.incarnation !== record.incarnation || input.caseRef.version !== record.version) return
    const generation = owner.generation(), abort = new AbortController()
    pending = abort
    const locks = unresolvedEdits.get(owner) ?? new Set<string>()
    locks.add(key)
    unresolvedEdits.set(owner, locks)
    setDraft({ busy: true, phase: "submitting", message: "" })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-edit"](
        input, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (abort.signal.aborted || !current(generation, record)) return
      if (result.kind !== "response") { setDraft({ phase: "unknown", message: "sf.ui34.editUnknown" }); return }
      if (result.status === 401 || result.status === 403) { await owner.reload(); return }
      if (result.body.status !== "ok" && (result.status === 400 || result.status === 409)) {
        locks.delete(key)
        setDraft({ phase: result.status === 409 ? "conflict" : "failed", message: "sf.ui34.editChanged" })
        return
      }
      if (result.status !== 200 || result.body.status !== "ok") { setDraft({ phase: "unknown", message: "sf.ui34.editUnknown" }); return }
      const confirmed = result.body.value.caseRef
      if (confirmed.id !== record.id || confirmed.incarnation !== record.incarnation || confirmed.version !== record.version + 1) {
        setDraft({ phase: "unknown", message: "sf.ui34.editUnknown" })
        return
      }
      if (pending === abort) pending = undefined
      props.onSaved()
    } catch (error) {
      if (!abort.signal.aborted && current(generation, record))
        setDraft({ phase: "unknown", message: "sf.ui34.editUnknown" })
    } finally {
      if (!abort.signal.aborted && current(generation, record)) setDraft("busy", false)
    }
  }
  return <section class="mx-card sf-n24-section" data-sf-decision-editor aria-labelledby="sf-case-edit-sources">
    <h2 id="sf-case-edit-sources">{t("sf.ui34.edit")}</h2>
    <div class="sf-n24-form-grid">
      <label class="sf-n24-field"><span>{t("sf.ui33.objective")}</span>
        <input value={draft.objective} disabled={!editing()} onInput={(event) => setDraft("objective", event.currentTarget.value)} />
      </label>
      <label class="sf-n24-field"><span>{t("sf.ui33.start")}</span>
        <input type="date" value={draft.start} disabled={!editing()} onInput={(event) => setDraft("start", event.currentTarget.value)} />
      </label>
      <label class="sf-n24-field"><span>{t("sf.ui33.end")}</span>
        <input type="date" value={draft.end} disabled={!editing()} onInput={(event) => setDraft("end", event.currentTarget.value)} />
      </label>
      <label class="sf-n24-field"><span>{t("sf.ui33.currency")}</span>
        <input value={draft.currency} disabled={!editing()} maxLength={3}
          onInput={(event) => setDraft("currency", event.currentTarget.value.toUpperCase())} />
      </label>
      <For each={draft.criteria}>{(criterion, index) => <label class="sf-n24-field">
        <span>{t("sf.ui34.criteria")} {index() + 1}</span>
        <input value={criterion.description} disabled={!editing()}
          onInput={(event) => {
            const description = event.currentTarget.value
            setDraft("criteria", draft.criteria.map((current, currentIndex) =>
              currentIndex === index() ? { ...current, description } : current))
          }} />
      </label>}</For>
    </div>
    <p>{t("sf.ui34.attachScope")}</p>
    <ul data-sf-decision-sources><For each={draft.sources}>{(source) =>
      <li>{source.kind === "record" ? source.target.recordType + " · " + source.target.recordId : source.kind} · {source.refId}</li>
    }</For></ul>
    <div class="sf-n24-actions">
      <button class="mx-btn" type="button" disabled={!editing() || !permitted("bi.bi-options")} onClick={() => void discover()}>
        {t("sf.ui34.findPlanner")}
      </button>
      <label class="sf-n24-field"><span>{t("sf.ui34.plannerSource")}</span>
        <select value={draft.selected} disabled={!editing() || !draft.options.length}
          onChange={(event) => setDraft({ selected: event.currentTarget.value, inspected: undefined })}>
          <option value="">{t("sf.ui34.selectSource")}</option>
          <For each={draft.options}>{(option) => <option value={option.ref}>{option.label}</option>}</For>
        </select>
      </label>
      <button class="mx-btn" type="button" disabled={!editing() || !draft.selected || !permitted("bi.bi-data")}
        onClick={() => void inspect()}>{t("sf.ui34.inspectSource")}</button>
    </div>
    <Show when={draft.inspected}>{(source) => <section data-sf-source-preview data-state="ready" aria-label={t("sf.ui34.sourcePreview")}>
      <h3>{source().label}</h3>
      <p>{source().projection.context.currency} · {source().projection.context.period.start} – {source().projection.context.period.end}</p>
      <ul><For each={source().projection.values}>{(value) => <li>{value.id}: {value.value === null ? t("sf.common.unavailable") : String(value.value)} {value.currency ?? value.unit ?? ""}</li>}</For></ul>
    </section>}</Show>
    <button class="mx-btn" type="button" disabled={!editing() || !draft.inspected}
      onClick={attach}>{t("sf.ui34.attachSource")}</button>
    <div class="sf-n24-actions">
      <button class="mx-btn" type="button" disabled={!editing() || !permitted("decisions.controls.read")}
        onClick={() => void readProcurement()}>{copy("find")}</button>
      <label class="sf-n24-field"><span>{copy("source")}</span>
        <select value={draft.procurementSelected} disabled={!editing() || !draft.procurement.length}
          onChange={(event) => setDraft({ procurementSelected: event.currentTarget.value, procurementInspected: undefined })}>
          <option value="">{t("sf.ui34.selectSource")}</option>
          <For each={draft.procurement}>{(entry) => <option value={entry.source.refDigest}>{entry.label}</option>}</For>
        </select>
      </label>
      <button class="mx-btn" type="button" disabled={!editing() || !selectedProcurement()}
        onClick={() => { const selected = selectedProcurement(); if (selected) void readProcurement(selected) }}>{copy("inspect")}</button>
    </div>
    <Show when={draft.procurementInspected}>{(entry) => <section data-procurement-preview data-state="ready" aria-label={copy("preview")}>
      <h3>{entry().label}</h3>
      <p><bdi>{entry().source.refId}</bdi> · {entry().projection.context.currency} · {entry().projection.context.period.start} – {entry().projection.context.period.end}</p>
      <ul><For each={entry().projection.values}>{(value) => <li>{value.id}: {value.value === null ? t("sf.common.unavailable") : String(value.value)} {value.currency ?? value.unit ?? ""}</li>}</For></ul>
      <button class="mx-btn" type="button" disabled={!editing() || !procurementToAttach()} onClick={() => {
        const source = procurementToAttach()
        if (source && editing()) setDraft({ sources: [...draft.sources, source], procurementInspected: undefined, message: "" })
      }}>{copy("attach")}</button>
    </section>}</Show>
    <Show when={draft.phase === "reviewing" && reviewed()}>{(input) =>
      <section role="group" aria-label={t("sf.ui34.reviewEdit")}>
        <p>{t("sf.ui34.attachScope")}</p>
        <p>{t("sf.ui34.current")}: {input().caseRef.version}</p>
        <p>{input().objective}</p>
        <p>{input().horizon?.start} – {input().horizon?.end} · {input().currency}</p>
        <ol><For each={input().criteria}>{(criterion) => <li>{criterion.description}</li>}</For></ol>
        <ul><For each={input().sourceRefs}>{(source) => <li>{source.refId}</li>}</For></ul>
        <button class="mx-btn primary" type="button" disabled={draft.busy} onClick={() => void save()}>{t("sf.ui34.confirmEdit")}</button>
        <button class="mx-btn" type="button" onClick={() => setDraft("phase", "editing")}>{t("sf.ui33.cancel")}</button>
      </section>
    }</Show>
    <Show when={draft.phase !== "reviewing"}>
      <button class="mx-btn primary" type="button"
        disabled={!editing() || !permitted("decisions.decision-edit") || !changed()}
        onClick={review}>{t("sf.ui34.reviewEdit")}</button>
    </Show>
    <Show when={draft.message || (locked() && draft.phase === "editing" ? "sf.ui34.editUnknown" : "")}>
      {(message) => <p role="status">{message() === "procurement-empty" ? copy("empty") : t(message())}</p>}
    </Show>
  </section>
}
