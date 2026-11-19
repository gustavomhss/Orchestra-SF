import { For, Show, createEffect, createMemo, createSignal, untrack } from "solid-js"
import type { JSX } from "solid-js"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import { SfChangeReview } from "../../shared/change-review"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey, SfDisplayValue } from "../../shared/frame/types"
import type { SfDraftRegistry } from "../../context/contracts"
import type { SfDomainPageCap02 } from "@orchestra/schema/sucafina/people"
import { SF_U38_COPY } from "@/i18n/orchestra-chapters/sf-u38"
import type { Topic } from "./reader"

type Key = keyof typeof SF_U38_COPY
const key = (text: Key): SfCopyKey => text as SfCopyKey
type TopicFields = Readonly<{
  action: string
  owner: string
  due: string
  status: "open" | "progress" | "blocked" | "done"
  priority: "critical" | "high" | "normal"
  notes: string
}>
const blank: TopicFields = { action: "", owner: "", due: "", status: "open", priority: "normal", notes: "" }
const statusOptions: readonly TopicFields["status"][] = ["open", "progress", "blocked", "done"]
const priorityOptions: readonly TopicFields["priority"][] = ["critical", "high", "normal"]
function fieldsFrom(record?: Topic): TopicFields {
  return {
    action: record?.action ?? "", owner: record?.owner ?? "", due: record?.due ?? "",
    status: record?.status && statusOptions.includes(record.status) ? record.status : "open",
    priority: record?.priority && priorityOptions.includes(record.priority) ? record.priority : "normal",
    notes: record?.notes ?? "",
  }
}
function valid(fields: TopicFields) {
  return !!fields.action.trim() && fields.action.length <= 16_384 &&
    fields.owner.length <= 16_384 && fields.notes.length <= 16_384 &&
    fields.due.length <= 16_384 && statusOptions.includes(fields.status) &&
    priorityOptions.includes(fields.priority)
}
async function digest(payload: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)))
  return [...new Uint8Array(bytes)].map((part) => part.toString(16).padStart(2, "0")).join("")
}
export type HotTopicEditProps = Readonly<{
  record?: Topic
  version: number | undefined
  transport: SfTransport
  drafts: SfDraftRegistry
  canSave: boolean
  onRefetch: () => void
  scope: string
  readInput: typeof SfDomainPageCap02.input.Type
  onBack: () => void
}>

/** S03 owner-owned draft + source CAS + explicit confirmation, no implicit POST. */
export function SfHotTopicEditor(props: HotTopicEditProps): JSX.Element {
  const { t } = useSfPresentation()
  const newIntent = crypto.randomUUID() as SfIntentRef
  const scope = ("hotTopics:" + props.scope) as SfEditScopeKey
  const source = () => props.record && props.version !== undefined
    ? fieldsFrom(props.record) : blank
  const draft = createMemo(() => props.drafts.acquire<TopicFields>({
    surfaceId: "CAP02",
    editScopeKey: scope,
    identity: props.record ? { kind: "record", recordRef: props.record.id as SfRef } :
      { kind: "new", newIntentRef: newIntent },
    baseVersion: props.record ? props.version ?? 0 : null,
    base: props.record ? source() : null,
    value: source(),
    revalidation: { operationId: "domain.page.CAP02", input: props.readInput,
      fieldPaths: props.record ? (["action", "owner", "due", "status", "priority", "notes"] as const)
        .filter((field) => props.record?.[field] !== undefined) : [],
      actionIds: ["save"] },
  }))
  const [stage, setStage] = createSignal<"edit" | "review">("edit")
  const [busy, setBusy] = createSignal(false)
  const [discardRequested, setDiscardRequested] = createSignal(false)
  const [feedback, setFeedback] = createSignal<"none" | "invalid" | "saved" | "rejected" | "conflict" | "unknown">("none")
  const active = () => {
    const snapshot = draft().snapshot()
    return snapshot.availability === "active" ? snapshot : undefined
  }
  const value = () => active()?.value ?? blank
  createEffect(() => {
    const current = props.record, version = props.version
    if (!current || version === undefined) return
    const controller = draft(), fields = fieldsFrom(current)
    untrack(() => controller.receiveRemote({ baseVersion: version, value: fields }))
  })
  const keepEditsAtCurrentVersion = () => {
    const current = active()
    if (!props.canSave || busy() || !current?.conflict || current.pendingOperation ||
        current.conflict.currentVersion !== props.version) return
    // This explicit choice adopts the freshly read source version. The user's
    // unsent values remain a draft and must pass a new review before any POST.
    const proposed = current.value
    draft().discard()
    draft().edit(proposed)
    setStage("edit")
    setFeedback("none")
  }
  const back = () => {
    if (active()?.pendingOperation) return
    if (active()?.dirty) setDiscardRequested(true)
    else props.onBack()
  }
  const discardAndBack = () => {
    if (active()?.pendingOperation) return
    draft().discard()
    setDiscardRequested(false)
    props.onBack()
  }
  const admitted = () => props.canSave && (props.record === undefined || props.version !== undefined) &&
    valid(value()) && !busy() && !!active() && !active()?.pendingOperation && !active()?.conflict
  const edit = <K extends keyof TopicFields>(field: K, next: TopicFields[K]) => {
    draft().edit({ ...value(), [field]: next })
    setFeedback("none")
  }
  const field = (path: keyof TopicFields, label: Key, value: string | undefined): Readonly<{
    path: string; label: { key: SfCopyKey }; value: SfDisplayValue
  }> => ({
    path, label: { key: key(label) }, value: value === undefined
      ? { kind: "missing", reason: { key: key("sf.u38.unknown") } }
      : { kind: "text", text: { kind: "data", text: value } },
  })
  const snapshotFields = (data: TopicFields) => ([
    field("action", "sf.u38.action", data.action), field("owner", "sf.u38.owner", data.owner),
    field("due", "sf.u38.due", data.due), field("status", "sf.u38.status", data.status),
    field("priority", "sf.u38.priority", data.priority), field("notes", "sf.u38.notes", data.notes),
  ])
  const original = () => props.record && props.version !== undefined
    ? { kind: "persisted" as const, ref: props.record.id as SfRef,
      version: props.version, fields: snapshotFields(fieldsFrom(props.record)) }
    : { kind: "not-provided" as const, reason: { key: key("sf.u38.newTopic") } }

  async function save() {
    const current = active(), proposed = value()
    if (!admitted() || !current || current.baseVersion !== (props.record ? props.version ?? 0 : null)) {
      setFeedback("conflict");setStage("edit");return
    }
    setBusy(true);setStage("edit")
    const operationRef = ("domain.command.CAP02.save:" + crypto.randomUUID()) as SfOperationRef
    const idempotencyKey = crypto.randomUUID()
    try {
      const payloadDigest = await digest({ id: props.record?.id, version: props.version ?? 0, fields: proposed })
      if (!props.canSave || !valid(value()) || active()?.baseVersion !== (props.record ? props.version ?? 0 : null) ||
        active()?.pendingOperation || active()?.conflict) {
        setFeedback("conflict");return
      }
      draft().setPending({ operationRef, idempotencyKey, payloadDigest, expectedVersion: props.record ? props.version ?? 0 : null })
      if (!active()?.pendingOperation) {setFeedback("conflict");return}
      draft().setPhase("submitting")
      const result = await createSfPeopleClient(props.transport)["domain.command.CAP02.save"]({
        ...(props.record ? { id: props.record.id } : {}), version: props.version ?? 0,
        values: { action: proposed.action, owner: proposed.owner, due: proposed.due,
          status: proposed.status, priority: proposed.priority, notes: proposed.notes },
      }, { signal: new AbortController().signal, idempotencyKey })
      if (result.kind !== "response") {
        draft().setPhase("outcome-unknown");setFeedback("unknown");return
      }
      if (!result.body.ok) {
        if (result.body.status === 409 || result.body.status === 422) {
          draft().rejectSave({ status: result.body.status, operation: {
            operationRef, idempotencyKey, payloadDigest, expectedVersion: props.record ? props.version ?? 0 : null,
          } })
        } else draft().setPhase("outcome-unknown")
        setFeedback(result.body.status === 409 ? "conflict" : "rejected")
        props.onRefetch()
        return
      }
      const persistedId = props.record?.id
      // New commands do not return an ID in this catalog. The authorized list
      // must supply it; a label match is never treated as a mutation receipt.
      if (!persistedId) {
        draft().confirmSave({ kind: "confirmed-without-projection", operationRef, resultVersion: null })
        setFeedback("saved");props.onRefetch();props.onBack();return
      }
      const currentPage = await createSfPeopleClient(props.transport)["domain.page.CAP02"](
        props.readInput, { signal: new AbortController().signal })
      if (currentPage.kind !== "response" || currentPage.body.status !== "ok") {
        draft().confirmSave({ kind: "confirmed-without-projection", operationRef, resultVersion: null })
        setFeedback("saved");props.onRefetch();props.onBack();return
      }
      const persisted = currentPage.body.value.data.hotTopics.find((topic) => topic.id === persistedId)
      const persistedVersion = currentPage.body.value.versions["hotTopics:" + persistedId]
      if (!persisted || persistedVersion === undefined) {
        draft().confirmSave({ kind: "confirmed-without-projection", operationRef, resultVersion: null })
        setFeedback("saved");props.onRefetch();props.onBack();return
      }
      draft().confirmSave({ kind: "projected", operationRef, baseVersion: persistedVersion, value: fieldsFrom(persisted) })
      setFeedback("saved")
      props.onRefetch()
      props.onBack()
    } catch {
      draft().setPhase("outcome-unknown");setFeedback("unknown")
    } finally { setBusy(false) }
  }
  return <section class="sf-u38-editor" data-sf-topic-editor>
    <h2>{t(key(props.record ? "sf.u38.editTopic" : "sf.u38.newTopic"))}</h2>
    <Show when={active()} fallback={<p role="status">{t(key("sf.u38.savePending"))}</p>}>
      <Show when={stage() === "edit"}>
        <form onSubmit={(event) => { event.preventDefault(); if (admitted()) {
          draft().setPhase("reviewing");setStage("review")
        } else setFeedback("invalid") }}>
          <div class="sf-u38-form">
            <label>{t(key("sf.u38.action"))}
              <input required maxLength={16384} value={value().action}
                disabled={busy() || !!active()?.pendingOperation}
                onInput={(event) => edit("action", event.currentTarget.value)} /></label>
            <label>{t(key("sf.u38.owner"))}
              <input value={value().owner} disabled={busy() || !!active()?.pendingOperation}
                onInput={(event) => edit("owner", event.currentTarget.value)} /></label>
            <label>{t(key("sf.u38.due"))}
              <input value={value().due} disabled={busy() || !!active()?.pendingOperation}
                onInput={(event) => edit("due", event.currentTarget.value)} /></label>
            <label>{t(key("sf.u38.status"))}
              <select value={value().status} disabled={busy() || !!active()?.pendingOperation}
                onChange={(event) => edit("status", event.currentTarget.value as TopicFields["status"])}>
                <For each={statusOptions}>{(status) =>
                  <option value={status}>{t(key(("sf.u38." + status) as Key))}</option>}</For>
              </select></label>
            <label>{t(key("sf.u38.priority"))}
              <select value={value().priority} disabled={busy() || !!active()?.pendingOperation}
                onChange={(event) => edit("priority", event.currentTarget.value as TopicFields["priority"])}>
                <For each={priorityOptions}>{(priority) =>
                  <option value={priority}>{t(key(("sf.u38." + priority) as Key))}</option>}</For>
              </select></label>
            <label class="sf-u38-notes">{t(key("sf.u38.notes"))}
              <textarea rows={4} value={value().notes} disabled={busy() || !!active()?.pendingOperation}
                onInput={(event) => edit("notes", event.currentTarget.value)} /></label>
          </div>
          <p>{t(key("sf.u38.version"))}: {props.version ?? (props.record ? t(key("sf.u38.unknown")) : 0)}</p>
          <div class="sf-u38-actions">
            <button type="submit" class="mx-btn primary" disabled={!admitted()}>{t(key("sf.u38.reviewSave"))}</button>
            <button type="button" class="mx-btn" disabled={!!active()?.pendingOperation}
              onClick={() => setDiscardRequested(true)}>{t(key("sf.u38.discard"))}</button>
            <button type="button" class="mx-btn" onClick={back}>{t(key("sf.u38.back"))}</button>
          </div>
        </form>
      </Show>
      <Show when={stage() === "review" && admitted()}>
        <SfChangeReview operation={{ ref: ("topic-save:" + (props.record?.id ?? newIntent)) as SfOperationRef,
            label: { key: key("sf.u38.reviewSave") }, scope: { kind: "data", text: props.scope } }}
          base={original()} current={original()}
          proposed={{ kind: "draft", intentRef: newIntent,
            sourceRef: props.record?.id ? props.record.id as SfRef : null, sourceVersion: props.version ?? 0,
            fields: snapshotFields(value()) }}
          effects={[]}
          coverage={{ state: "complete", summary: { key: key("sf.u38.source") },
            reasons: [], knownCount: 1, expectedCount: 1 }}
          blockingReasons={[]}
          confirmation={{ kind: "admitted", labelKey: key("sf.u38.confirmSave"),
            purpose: props.record ? "save" : "create",
            binding: { kind: "catalog-command", operationId: "domain.command.CAP02.save",
              version: { kind: "record", expectedVersion: props.version ?? 0 },
              confirmation: "presentation-only" } }}
          state="ready" onConfirm={() => { void save() }}
          onRevise={() => setStage("edit")} onCancel={() => setStage("edit")} />
      </Show>
      <Show when={props.record}>
        <section data-current-revision>
          <h3>{t(key("sf.u38.currentVersion"))}</h3>
          <Show when={active()?.conflict}><p role="alert">{t(key("sf.u38.sourceChanged"))}</p></Show>
          <dl>
            <For each={snapshotFields(fieldsFrom(props.record))}>{(item) => <div>
              <dt>{t(item.label.key)}</dt>
              <dd>{item.value.kind === "text" && item.value.text.kind === "data" ? item.value.text.text : t(key("sf.u38.unknown"))}</dd>
            </div>}</For>
          </dl>
          <Show when={active()?.conflict}>
            <button type="button" class="mx-btn" disabled={!props.canSave || busy() || !!active()?.pendingOperation}
              onClick={keepEditsAtCurrentVersion}>{t(key("sf.u38.keepEdits"))}</button>
          </Show>
        </section>
      </Show>
      <Show when={discardRequested()}>
        <div role="group" aria-label={t(key("sf.u38.confirmDiscard"))}>
          <p>{t(key("sf.u38.confirmDiscard"))}</p>
          <button type="button" class="mx-btn" onClick={discardAndBack}>{t(key("sf.u38.discard"))}</button>
          <button type="button" class="mx-btn" onClick={() => setDiscardRequested(false)}>{t(key("sf.u38.cancel"))}</button>
        </div>
      </Show>
    </Show>
    <Show when={feedback() !== "none"}>
      <p role="alert" data-topic-feedback={feedback()}>{t(key(feedback() === "invalid" ? "sf.u38.validation" :
        feedback() === "saved" ? "sf.u38.savedRefetch" :
        feedback() === "conflict" ? "sf.u38.sourceChanged" :
        feedback() === "unknown" ? "sf.u38.savePending" : "sf.u38.applyError"))}</p>
    </Show>
  </section>
}
