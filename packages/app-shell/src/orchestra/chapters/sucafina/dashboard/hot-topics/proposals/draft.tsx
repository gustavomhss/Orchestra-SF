import { For, Show, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { Schema } from "effect"
import type { JSX } from "solid-js"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { useSfContext } from "../../../context"
import { useSfPresentation } from "../../../shared/frame/presentation"
import type { SfCopyKey } from "../../../shared/frame/types"
import { SF_U38_COPY } from "@/i18n/orchestra-chapters/sf-u38"

type Key = keyof typeof SF_U38_COPY
const key = (value: Key): SfCopyKey => value as SfCopyKey
const draftInput = SfDomain.operations["dashboard.dashboard-hot-topic-draft"].input
type Draft = typeof draftInput.Type
type Fields = Draft["fields"]
type EditableFields = { -readonly [Field in keyof Fields]: Fields[Field] }
type CaseRef = Draft["caseRef"]
const names = ["action", "owner", "due", "priority", "notes"] as const
const empty: Fields = { action: "", owner: "", due: "", priority: "normal", notes: "" }
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const rows = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const validCase = Schema.is(draftInput.fields.caseRef)
const validDraft = Schema.is(draftInput)

function draftFor(value: unknown, selected?: CaseRef): Draft | undefined {
  const row = object(value)
  if (!row) return
  const candidate = {
    caseRef: selected ?? row.caseRef, target: row.target, targetEvidence: row.targetEvidence,
    fields: row.fields, sourceRefs: row.sourceRefs ?? [row.targetEvidence],
    expectedVersion: row.version ?? 0, ...(typeof row.draftRef === "string" ? { draftRef: row.draftRef } : {}),
  }
  return validDraft(candidate) ? candidate : undefined
}

/** Private C08 proposal editing. Domain records remain untouched until UI54's separate C12 apply. */
export function SfHotTopicPrivateDraft(props: {
  discovery: unknown
  reference: string
  denied: boolean
  onSaved: (reference: string) => void
  onDenied: () => void
}): JSX.Element {
  const { t } = useSfPresentation()
  const context = useSfContext()
  const ready = () => context.state().status === "ready" ? context.ready() : undefined
  const admitted = (operationId: string) => ready()?.context.availability.some((resource) =>
    resource.family === "domain-read" && resource.resource === "hot-topic-proposal" &&
    resource.operations.some((operation) => operation.operationId === operationId && operation.state === "ready" && operation.operational)) === true
  const [discovery, setDiscovery] = createSignal<unknown>(props.discovery)
  const [selectedCase, setSelectedCase] = createSignal("")
  const [selectedRecord, setSelectedRecord] = createSignal("")
  const [selection, setSelection] = createSignal<Draft>()
  const [base, setBase] = createSignal<Fields>()
  const [currentDraft, setCurrentDraft] = createSignal<Draft>()
  const [sourceFields, setSourceFields] = createSignal<Fields>()
  const [values, setValues] = createStore<EditableFields>({ ...empty })
  const [dirty, setDirty] = createSignal(false)
  const [reviewed, setReviewed] = createSignal(false)
  const [needsCurrent, setNeedsCurrent] = createSignal(false)
  const [canWrite, setCanWrite] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [state, setState] = createSignal<"editing" | "current" | "unavailable" | "denied" | "write-denied" | "conflict" | "unknown" | "saved">("editing")
  let controller: AbortController | undefined
  let sequence = 0
  let owner: string | undefined
  let authorityStamp: string | undefined
  let opened: string | undefined
  let routeReference: string | undefined
  let firstSave: { key: string; input: Draft } | undefined
  const cases = createMemo(() => rows(object(object(discovery())?.decisions)?.cases).flatMap((value) => {
    const item = object(value)
    return item && validCase(item.caseRef) && typeof item.label === "string" ? [{ caseRef: item.caseRef, label: item.label }] : []
  }))
  const sources = createMemo(() => rows(object(discovery())?.records).flatMap((value) => {
    const item = object(value)
    return item && typeof item.label === "string" && typeof item.sourceRef === "string" && item.draft
      ? [{ label: item.label, sourceRef: item.sourceRef, draft: item.draft }] : []
  }))
  function reset(denied = false) {
    controller?.abort(); sequence++
    setSelection(undefined); setBase(undefined); setCurrentDraft(undefined); setSourceFields(undefined)
    setValues({ ...empty }); setDirty(false); setReviewed(false); setNeedsCurrent(false); setCanWrite(false)
    setSelectedCase(""); setSelectedRecord(""); setBusy(false); firstSave = undefined; opened = undefined
    setState(denied ? "denied" : "editing")
  }
  const deny = () => { reset(true); setDiscovery(undefined); props.onDenied() }
  createEffect(() => {
    const value = props.discovery
    if (value !== null && value !== undefined) setDiscovery(value)
  })
  createEffect(() => {
    const current = ready(), status = context.state().status, generation = context.generation()
    if (props.denied) { reset(true); setDiscovery(undefined); return }
    if (!current) {
      setCanWrite(false)
      if (status === "denied" || status === "unauthenticated" || status === "context-mismatch") {
        reset(true); setDiscovery(undefined); owner = undefined
      }
      return
    }
    const stamp = current.context.stamp
    const nextOwner = JSON.stringify([stamp.installationId, stamp.hostId, stamp.projectId, stamp.principalRef])
    if (owner !== undefined && owner !== nextOwner) { reset(); setDiscovery(undefined) }
    owner = nextOwner
    if (!current.context.destinations.some((destination) => destination.capabilityId === "CAP02" && destination.canRead)) {
      reset(true); setDiscovery(undefined); return
    }
    const nextStamp = JSON.stringify([generation, stamp])
    const changed = authorityStamp !== undefined && authorityStamp !== nextStamp
    authorityStamp = nextStamp
    // An authority generation can withdraw writing while the exact private read remains available.
    if (changed && untrack(selection)) { setCanWrite(false); setNeedsCurrent(true); setState("unavailable") }
  })
  createEffect(() => {
    const reference = props.reference, discovered = discovery(), current = ready()
    if (routeReference !== undefined && routeReference !== reference && untrack(selection)?.draftRef !== reference) reset()
    routeReference = reference
    if (!current || reference === "new" || opened === reference || untrack(selection)) return
    const item = rows(object(object(discovered)?.decisions)?.drafts).find((value) => {
      const draft = object(value)
      return draft?.id === reference || draft?.draftRef === reference
    })
    const input = draftFor(item)
    if (!input) return
    opened = reference; setSelection(input); setBase(input.fields); setValues({ ...input.fields })
    setCanWrite(object(object(discovered)?.decisions)?.permissions !== undefined &&
      object(object(object(discovered)?.decisions)?.permissions)?.draft === true)
  })
  onCleanup(() => { controller?.abort(); sequence++; firstSave = undefined })

  function chooseSource() {
    if (dirty()) return
    const chosen = cases().find((item) => item.caseRef.id === selectedCase())
    const source = sources().find((item) => item.sourceRef === selectedRecord())
    const input = source && chosen ? draftFor(source.draft, chosen.caseRef) : undefined
    if (!input) return
    setSelection(input); setBase(input.fields); setValues({ ...input.fields })
    setCurrentDraft(undefined); setSourceFields(undefined); setReviewed(false); setNeedsCurrent(false)
    setState("editing"); setCanWrite(object(object(object(discovery())?.decisions)?.permissions)?.draft === true)
  }
  async function refresh() {
    const retained = selection(), current = ready()
    if (!retained || !current || busy() || state() === "unknown" && !!firstSave ||
      !admitted("dashboard.dashboard-workbench") || !admitted("dashboard.dashboard-draft-read")) return
    controller?.abort(); controller = new AbortController()
    const signal = controller.signal, ticket = ++sequence, generation = context.generation()
    const live = () => !signal.aborted && sequence === ticket && context.generation() === generation && ready()?.transport === current.transport
    setBusy(true); setReviewed(false); setNeedsCurrent(true); setCanWrite(false)
    try {
      const client = createSfDomainClient(current.transport)
      const discovered = await client["dashboard.dashboard-workbench"]({ page: "Hot Topics & Actions" }, { signal })
      if (!live()) return
      if (discovered.kind === "response" && discovered.body.status === "denied") { deny(); return }
      if (discovered.kind === "response" && discovered.body.status === "ok") setDiscovery(discovered.body.value)
      const read = await client["dashboard.dashboard-draft-read"]({
        caseRef: retained.caseRef, targetEvidence: retained.targetEvidence,
        ...(retained.draftRef ? { draftRef: retained.draftRef } : {}),
      }, { signal })
      if (!live()) return
      if (read.kind !== "response") { setState("unavailable"); return }
      if (read.body.status === "denied") { deny(); return }
      if (read.body.status !== "ok") { setState("unavailable"); return }
      const value = object(read.body.value), source = object(object(value?.source)?.draft), active = object(value?.draft)
      const original = object(value?.originalSource)
      if (!value || !validCase(value.caseRef) || value.caseRef.id !== retained.caseRef.id ||
        value.caseRef.incarnation !== retained.caseRef.incarnation || !source ||
        original?.refId !== retained.targetEvidence.refId || original?.refDigest !== retained.targetEvidence.refDigest ||
        !same(value.currentSource, source.targetEvidence)) { setState("unavailable"); return }
      const activeTarget = object(active?.targetEvidence)
      const refs = active ? rows(active.sourceRefs).map((ref) => object(ref)?.refId === activeTarget?.refId ? source.targetEvidence : ref) : [source.targetEvidence]
      const candidate = draftFor({ ...source, fields: active?.fields ?? source.fields,
        sourceRefs: refs, ...(active ? { draftRef: active.draftRef, version: active.version } : {}) }, value.caseRef)
      const sourceOnly = draftFor({ ...source, sourceRefs: [source.targetEvidence] }, value.caseRef)
      if (!candidate || !sourceOnly || candidate.target.id !== retained.target.id ||
        retained.draftRef && (!active || typeof active.draftRef !== "string" || candidate.expectedVersion < retained.expectedVersion)) {
        setState("unavailable"); return
      }
      setCurrentDraft(candidate); setSourceFields(sourceOnly.fields)
      setNeedsCurrent(!same(candidate, retained))
      setCanWrite(object(value.permissions)?.draft === true); setState("current")
    } catch { if (live()) setState("unavailable") }
    finally { if (sequence === ticket) setBusy(false) }
  }
  function candidate() {
    const value = needsCurrent() ? reviewed() ? currentDraft() : undefined : selection()
    return value ? { ...value, fields: { ...values } } : undefined
  }
  const saveAllowed = () => !!candidate() && canWrite() && admitted("dashboard.dashboard-hot-topic-draft") &&
    !busy() && state() !== "unknown" && state() !== "denied" && state() !== "unavailable" &&
    !!values.action.trim() && !!values.owner.trim() && !!values.due.trim() && values.notes.length <= 16384
  async function save() {
    const input = candidate(), current = ready()
    if (!input || !current || !saveAllowed() || !validDraft(input)) return
    controller?.abort(); controller = new AbortController()
    const signal = controller.signal, ticket = ++sequence, generation = context.generation()
    const live = () => !signal.aborted && sequence === ticket && context.generation() === generation && ready()?.transport === current.transport
    const key = crypto.randomUUID()
    if (!input.draftRef) firstSave = { key, input }
    setBusy(true)
    try {
      const result = await createSfDomainClient(current.transport)["dashboard.dashboard-hot-topic-draft"](input, { signal, idempotencyKey: key })
      if (!live()) return
      if (result.kind !== "response") { setState("unknown"); setCanWrite(false); return }
      if (result.body.status === "denied") {
        firstSave = undefined; setCanWrite(false); setNeedsCurrent(true); setReviewed(false); setState("write-denied"); return
      }
      if (result.body.status !== "ok") {
        firstSave = undefined; setNeedsCurrent(true); setReviewed(false); setState("conflict"); return
      }
      const saved = object(result.body.value)
      if (typeof saved?.draftRef !== "string" || saved.version !== input.expectedVersion + 1) { setState("unknown"); setCanWrite(false); return }
      firstSave = undefined
      setSelection({ ...input, draftRef: saved.draftRef, expectedVersion: Number(saved.version) })
      setBase({ ...values }); setCurrentDraft(undefined); setSourceFields(undefined)
      setDirty(false); setNeedsCurrent(false); setReviewed(false); setState("saved")
      props.onSaved(saved.draftRef)
    } catch { if (live()) { setState("unknown"); setCanWrite(false) } }
    finally { if (sequence === ticket) setBusy(false) }
  }
  async function recoverFirstSave() {
    const retained = firstSave, current = ready()
    if (!retained || !current || busy() || !admitted("dashboard.dashboard-hot-topic-draft-outcome")) return
    controller?.abort(); controller = new AbortController()
    const signal = controller.signal, ticket = ++sequence, generation = context.generation()
    setBusy(true)
    try {
      const outcome = await createSfDomainClient(current.transport)["dashboard.dashboard-hot-topic-draft-outcome"](
        { caseRef: retained.input.caseRef }, { signal, idempotencyKey: retained.key })
      if (signal.aborted || sequence !== ticket || context.generation() !== generation || ready()?.transport !== current.transport) return
      if (outcome.kind === "response" && outcome.body.status === "denied") return
      if (outcome.kind !== "response" || outcome.body.status !== "ok") return
      const saved = object(outcome.body.value)
      if (typeof saved?.draftRef !== "string" || saved.version !== 1) return
      firstSave = undefined; setSelection({ ...retained.input, draftRef: saved.draftRef, expectedVersion: 1 })
      setBase(retained.input.fields); setDirty(false); setNeedsCurrent(false); setState("saved")
      props.onSaved(saved.draftRef)
    } catch { /* The original outcome remains unknown; no command is repeated. */ }
    finally { if (sequence === ticket) setBusy(false) }
  }
  const edit = (field: typeof names[number], value: string) => {
    if (field === "priority") {
      if (value !== "normal" && value !== "high" && value !== "critical") return
      setValues("priority", value)
    } else setValues(field, value)
    setDirty(true)
  }
  return <section class="sf-u38-section" data-sf-private-proposal data-dirty={dirty()} aria-label={t(key("sf.u38.privateProposal"))}>
    <h2>{t(key("sf.u38.privateProposal"))}</h2>
    <Show when={state() !== "denied"} fallback={<p role="alert">{t(key("sf.u38.privateReadDenied"))}</p>}>
      <Show when={props.reference === "new" && !selection()}>
        <label>{t(key("sf.u38.selectCase"))}<select value={selectedCase()} onChange={(event) => { setSelectedCase(event.currentTarget.value); chooseSource() }}>
          <option value="">{t(key("sf.u38.selectCase"))}</option>
          <For each={cases()}>{(item) => <option value={item.caseRef.id}>{item.label}</option>}</For>
        </select></label>
        <label>{t(key("sf.u38.selectSource"))}<select value={selectedRecord()} onChange={(event) => { setSelectedRecord(event.currentTarget.value); chooseSource() }}>
          <option value="">{t(key("sf.u38.selectSource"))}</option>
          <For each={sources()}>{(item) => <option value={item.sourceRef}>{item.label}</option>}</For>
        </select></label>
      </Show>
      <Show when={selection()}>
        <div class="sf-u38-fields">
          <For each={names}>{(field) => <label>{t(key(("sf.u38." + field) as Key))}
            <Show when={field !== "priority"} fallback={<select value={values.priority} disabled={busy() || state() === "unknown" || !canWrite()} onChange={(event) => edit(field, event.currentTarget.value)}>
              <For each={["normal", "high", "critical"] as const}>{(value) => <option value={value}>{t(key(("sf.u38." + value) as Key))}</option>}</For>
            </select>}>
              <Show when={field !== "notes"} fallback={<textarea value={values.notes} disabled={busy() || state() === "unknown" || !canWrite()} onInput={(event) => edit(field, event.currentTarget.value)} />}>
                <input type={field === "due" ? "date" : "text"} value={values[field]} disabled={busy() || state() === "unknown" || !canWrite()} onInput={(event) => edit(field, event.currentTarget.value)} />
              </Show>
            </Show>
          </label>}</For>
        </div>
        <div class="sf-u38-actions">
          <button type="button" class="mx-btn" disabled={!saveAllowed()} onClick={() => { void save() }}>{t(key("sf.u38.saveProposal"))}</button>
          <button type="button" class="mx-btn" disabled={busy() || state() === "unknown" && !!firstSave} onClick={() => { void refresh() }}>{t(key("sf.u38.keepEdits"))}</button>
          <Show when={state() === "unknown"}><button type="button" class="mx-btn" disabled={busy() || !firstSave || !admitted("dashboard.dashboard-hot-topic-draft-outcome")} onClick={() => { void recoverFirstSave() }}>{t(key("sf.u38.reconcile"))}</button></Show>
        </div>
        <Show when={currentDraft() && sourceFields()}>
          <div data-sf-proposal-comparison>
            <table aria-label={t(key("sf.u38.proposalComparison"))}>
              <thead><tr><th>{t(key("sf.u38.field"))}</th><th>{t(key("sf.u38.previousValues"))}</th><th>{t(key("sf.u38.activeProposal"))}</th><th>{t(key("sf.u38.retainedProposal"))}</th></tr></thead>
              <tbody><For each={names}>{(field) => <tr><td>{t(key(("sf.u38." + field) as Key))}</td><td>{base()?.[field]}</td><td>{currentDraft()?.fields[field]}</td><td>{values[field]}</td></tr>}</For></tbody>
            </table>
            <table aria-label={t(key("sf.u38.currentSource"))}>
              <thead><tr><th>{t(key("sf.u38.field"))}</th><th>{t(key("sf.u38.currentSource"))}</th></tr></thead>
              <tbody><For each={names}>{(field) => <tr><td>{t(key(("sf.u38." + field) as Key))}</td><td>{sourceFields()?.[field]}</td></tr>}</For></tbody>
            </table>
            <label><input type="checkbox" checked={reviewed()} disabled={busy() || state() !== "current" || !needsCurrent()} onChange={(event) => setReviewed(event.currentTarget.checked)} />{t(key("sf.u38.acceptProposalBase"))}</label>
          </div>
        </Show>
        <Show when={state() === "current"}><p role="status">{t(key(needsCurrent() ? "sf.u38.proposalCurrentLoaded" : "sf.u38.proposalEditsRetained"))}</p></Show>
        <Show when={state() === "write-denied" || !canWrite() && state() === "current"}><p role="status">{t(key("sf.u38.privateWriteUnavailable"))}</p></Show>
        <Show when={state() === "unavailable"}><p role="status">{t(key("sf.u38.privateReadUnavailable"))}</p></Show>
        <Show when={state() === "conflict"}><p role="alert">{t(key("sf.u38.sourceChanged"))}</p></Show>
        <Show when={state() === "unknown"}><p role="alert">{t(key("sf.u38.savePending"))}</p></Show>
        <Show when={state() === "saved"}><p role="status">{t(key("sf.u38.proposalSaved"))}</p></Show>
      </Show>
    </Show>
  </section>
}
