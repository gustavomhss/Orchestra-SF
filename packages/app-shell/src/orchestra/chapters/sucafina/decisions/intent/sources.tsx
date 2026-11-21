import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
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

/** Attach only the original BI-issued evidence. The source owns case CAS and
 * revalidates each digest; this editor never constructs a Planner reference. */
export function SfCaseSourcesEditor(props: Readonly<{
  projection: SfCaseProjection
  onSaved: () => void
  onClose?: () => void
}>) {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (key: string) => language.t(key as Parameters<typeof language.t>[0])
  const [draft, setDraft] = createStore({
    objective: "", start: "", end: "", currency: "",
    criteria: [] as EditInput["criteria"],
    sources: [] as Sources,
    options: [] as Options,
    selected: "",
    inspected: undefined as Inspected | undefined,
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
    setDraft({ objective: record.objective, start: record.horizon.start, end: record.horizon.end,
      currency: record.currency, criteria: record.criteria.map(({ id, description, required }) => ({ id, description, required })),
      sources: record.sourceRefs, options: [], selected: "", inspected: undefined,
      busy: false, phase: "editing", message: "" })
  })
  const permitted = (operation: string) => {
    const ready = owner.ready()
    return !!ready && sfOperationReady(ready.context, operation)
  }
  const editing = () => !draft.busy && (draft.phase === "editing" || draft.phase === "failed")
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
  const changed = () => {
    const record = props.projection.case
    return draft.objective.trim() !== record.objective || draft.start !== record.horizon.start ||
      draft.end !== record.horizon.end || draft.currency !== record.currency ||
      draft.criteria.some((criterion, index) => criterion.description.trim() !== record.criteria[index]?.description) ||
      draft.sources.length !== record.sourceRefs.length
  }
  const review = () => {
    if (!editing() || !permitted("decisions.decision-edit") || !changed()) return
    const input = payload(props.projection.case, draft.sources)
    if (Option.isNone(input)) { setDraft("message", "sf.ui34.sourcesUnavailable"); return }
    setDraft({ phase: "reviewing", message: "" })
  }
  const save = async () => {
    const ready = owner.ready(), record = props.projection.case
    if (!ready || draft.busy || draft.phase !== "reviewing" || !permitted("decisions.decision-edit")) return
    const input = payload(record, draft.sources)
    if (Option.isNone(input)) { setDraft({ phase: "failed", message: "sf.ui34.sourcesUnavailable" }); return }
    const generation = owner.generation(), abort = new AbortController()
    pending = abort
    setDraft({ busy: true, phase: "submitting", message: "" })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-edit"](
        input.value, { signal: abort.signal, idempotencyKey: crypto.randomUUID() },
      )
      if (abort.signal.aborted || !current(generation, record)) return
      if (result.kind !== "response") { setDraft({ phase: "unknown", message: "sf.ui34.editUnknown" }); return }
      if (result.status === 401 || result.status === 403) { await owner.reload(); return }
      if (result.body.status !== "ok") {
        setDraft({ phase: result.status === 409 ? "conflict" : "failed", message: "sf.ui34.editChanged" })
        return
      }
      const confirmed = result.body.value.caseRef
      if (confirmed.id !== record.id || confirmed.incarnation !== record.incarnation || confirmed.version <= record.version) {
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
    <header class="sf-decision-section-heading">
      <h2 id="sf-case-edit-sources">{t("sf.ui34.edit")}</h2>
      <Show when={props.onClose}>
        <button class="mx-btn" type="button" disabled={draft.busy || draft.phase === "unknown"}
          onClick={() => props.onClose?.()}>{t("sf.ui35.return")}</button>
      </Show>
    </header>
    <div class="sf-decision-edit-fields" hidden={draft.phase === "reviewing" || draft.phase === "submitting"}>
    <div class="sf-n24-form-grid">
      <label class="sf-n24-field sf-n24-span"><span>{t("sf.ui33.objective")}</span>
        <textarea rows={3} value={draft.objective} disabled={!editing()} onInput={(event) => setDraft("objective", event.currentTarget.value)} />
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
      <For each={draft.criteria}>{(criterion, index) => <label class="sf-n24-field sf-n24-span">
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
    </div>
    <Show when={draft.phase === "reviewing" || draft.phase === "submitting"}>
      <section class="sf-decision-review-stage" role="group" aria-label={t("sf.ui34.reviewEdit")}>
        <p>{t("sf.ui34.attachScope")}</p>
        <p>{t("sf.ui34.current")}: {props.projection.case.version}</p>
        <p>{draft.objective.trim()}</p>
        <p>{draft.start} – {draft.end} · {draft.currency}</p>
        <ol><For each={draft.criteria}>{(criterion) => <li>{criterion.description.trim()}</li>}</For></ol>
        <ul><For each={draft.sources}>{(source) => <li>{source.refId}</li>}</For></ul>
        <button class="mx-btn primary" type="button" disabled={draft.busy} onClick={() => void save()}>{t("sf.ui34.confirmEdit")}</button>
        <button class="mx-btn" type="button" disabled={draft.busy} onClick={() => setDraft("phase", "editing")}>{t("sf.ui33.cancel")}</button>
      </section>
    </Show>
    <Show when={draft.phase !== "reviewing" && draft.phase !== "submitting"}>
      <button class="mx-btn primary" type="button"
        disabled={!editing() || !permitted("decisions.decision-edit") || !changed()}
        onClick={review}>{t("sf.ui34.reviewEdit")}</button>
    </Show>
    <Show when={draft.message}><p role="status">{t(draft.message)}</p></Show>
  </section>
}
