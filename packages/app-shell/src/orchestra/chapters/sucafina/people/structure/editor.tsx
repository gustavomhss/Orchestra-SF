import { For, Show, createMemo, createUniqueId, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type {
  SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef, SfVersion, SurfaceId,
} from "@orchestra/schema/sucafina/context"
import type { SfDraftRegistry } from "../../context/contracts"
import { SfChangeReview } from "../../shared/change-review"
import { SfStatePanel } from "../../shared/states"
import { SfActionButton, sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfAction, SfCopyKey, SfMessage } from "../../shared/frame"

export type PeopleField = Readonly<{
  name: string
  labelKey: SfCopyKey
  input: "text" | "date" | "textarea" | "select"
  required?: boolean
  options?: readonly Readonly<{ value: string; labelKey: SfCopyKey }>[]
}>
export type PeopleFormValues = Readonly<Record<string, string>>
export type PeopleSaveOutcome =
  | Readonly<{ kind: "projected"; value: PeopleFormValues; version: number }>
  | Readonly<{ kind: "confirmed-without-projection" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "conflict" | "denied" | "unavailable" | "outcome-unknown" }>

export type PeopleEditorProps = Readonly<{
  surfaceId: "CAP07" | "CAP08"
  scopeKey: string
  entity: "cio" | "leader" | "member" | "talent"
  recordRef?: SfRef
  version: number
  original: PeopleFormValues | null
  fields: readonly PeopleField[]
  action: Readonly<{ id: string; operationId: "domain.command.CAP07.saveCio" |
    "domain.command.CAP07.saveLeader" | "domain.command.CAP07.saveMember" |
    "domain.command.CAP08.save"; labelKey: SfCopyKey }>
  admitted: boolean
  drafts: SfDraftRegistry
  onCommit: (values: PeopleFormValues, version: number, idempotencyKey: string,
    signal: AbortSignal) => Promise<PeopleSaveOutcome>
  onClose: () => void
}>

const detail = (value: PeopleFormValues, fields: readonly PeopleField[]) =>
  fields.map((field) => ({
    path: field.name,
    label: { key: field.labelKey },
    value: Object.hasOwn(value, field.name)
      ? { kind: "text" as const, text: { kind: "data" as const, text: value[field.name] ?? "" } }
      : { kind: "missing" as const, reason: { key: sfCommonKey("sf.common.unknown") } },
  }))

function initialValues(props: PeopleEditorProps): PeopleFormValues {
  if (props.original) return props.original
  if (props.entity === "member") return { name: "", type: "Employee", status: "Active" }
  if (props.entity === "talent") return { name: "", type: "Employee", status: "Active", cls: "", outlook: "" }
  return { name: "" }
}

/**
 * F01-owned draft; navigation never discards it, and a late producer response
 * cannot confirm a different owner or operation. No field hidden by producer
 * redaction is invented by the editor.
 */
export function SfPeopleEditor(props: PeopleEditorProps): JSX.Element {
  const id = createUniqueId()
  const { t } = useSfPresentation()
  const [local, setLocal] = createStore({
    message: "" as string,
    busy: false,
    reviewRef: undefined as SfOperationRef | undefined,
  })
  const intentRef = ("sf-people-" + props.surfaceId + "-" + props.entity + "-new") as SfIntentRef
  const draft = createMemo(() => props.drafts.acquire<PeopleFormValues>({
    surfaceId: props.surfaceId as SurfaceId,
    identity: props.recordRef ? { kind: "record", recordRef: props.recordRef } :
      { kind: "new", newIntentRef: intentRef },
    editScopeKey: (props.scopeKey + ":" + props.entity) as SfEditScopeKey,
    baseVersion: props.version,
    base: props.original,
    value: initialValues(props),
    revalidation: {
      operationId: props.surfaceId === "CAP07" ? "domain.page.CAP07" : "domain.page.CAP08",
      input: {},
      fieldPaths: props.original
        ? props.fields.filter((field) => Object.hasOwn(props.original!, field.name)).map((field) => field.name)
        : [],
      actionIds: [props.action.id],
    },
  }))
  const state = () => draft().snapshot()
  const active = () => state().availability === "active" ? state() as Extract<ReturnType<typeof state>, { availability: "active" }> : undefined
  const busy = () => local.busy || active()?.phase === "submitting" || active()?.phase === "outcome-unknown"
  const update = (name: string, value: string) => {
    const current = active()
    if (!current || busy() || !props.admitted) return
    draft().edit({ ...current.value, [name]: value })
    setLocal("message", "")
  }
  const validate = (): string | undefined => {
    const current = active()
    if (!current) return "Draft unavailable."
    for (const field of props.fields) {
      if (field.required && !String(current.value[field.name] ?? "").trim()) return t(field.labelKey)
      if (field.input === "select" && field.options &&
          !field.options.some((opt) => opt.value === current.value[field.name])) return t(field.labelKey)
    }
    return
  }
  const review = () => {
    if (!props.admitted || busy()) return
    const error = validate()
    if (error) {
      setLocal("message", error)
      draft().setPhase("validation-error")
      return
    }
    setLocal("reviewRef", crypto.randomUUID() as SfOperationRef)
    draft().setPhase("reviewing")
  }
  const digest = async (value: string): Promise<string> => {
    const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("")
  }
  const confirm = async () => {
    const current = active()
    const operationRef = local.reviewRef
    if (!current || !operationRef || current.phase !== "reviewing" ||
        current.pendingOperation || current.conflict || !props.admitted || busy()) return
    if (typeof current.baseVersion !== "number" || !Number.isSafeInteger(current.baseVersion)) return
    const version = current.baseVersion
    const value = { ...current.value }
    const key = crypto.randomUUID()
    setLocal("busy", true)
    try {
      const payloadDigest = await digest(JSON.stringify({
        operationId: props.action.operationId, id: props.recordRef ?? null, version, values: value,
      }))
      // The draft fences the exact source version, intent, digest and key.
      draft().setPending({ operationRef, idempotencyKey: key, payloadDigest, expectedVersion: version })
      draft().setPhase("submitting")
      const controller = new AbortController()
      const result = await props.onCommit(value, version, key, controller.signal)
      if (result.kind === "projected") {
        draft().confirmSave({ kind: "projected", operationRef,
          baseVersion: result.version, value: result.value })
      } else if (result.kind === "confirmed-without-projection") {
        draft().confirmSave({ kind: "confirmed-without-projection",
          operationRef, resultVersion: null })
      } else if (result.kind === "outcome-unknown") {
        draft().setPhase("outcome-unknown")
      } else {
        // A submitted command is never silently cleared or replayed. Explicit
        // reconciliation/version review is required before a new attempt.
        draft().setPhase("outcome-unknown")
        setLocal("message", result.kind === "invalid" ? result.message : result.kind)
      }
    } catch (error) {
      console.error("Sucafina people command uncertain", error instanceof Error ? error.name : "unknown")
      draft().setPhase("outcome-unknown")
    } finally {
      setLocal("busy", false)
    }
  }
  const canReview = () => props.admitted && !busy() && !!active() && !active()!.conflict
  const reviewAction = (): SfAction => ({
    id: "review-" + props.entity,
    labelKey: sfCommonKey("sf.common.review"),
    tone: "primary", disabled: !canReview(), busy: busy(),
    onInvoke: review,
  })
  const phase = () => active()?.phase
  const proposal = () => ({ kind: "draft" as const,
    intentRef, sourceRef: props.recordRef ?? null,
    sourceVersion: props.version as SfVersion, fields: detail(active()?.value ?? {}, props.fields),
  })
  const base = () => props.original && props.recordRef
    ? { kind: "persisted" as const, ref: props.recordRef,
      version: props.version as SfVersion, fields: detail(props.original, props.fields) }
    : null
  const confirmation = () => canReview() && phase() === "reviewing"
    ? { kind: "admitted" as const, labelKey: props.action.labelKey,
      purpose: "save" as const, binding: {
        kind: "catalog-command" as const, operationId: props.action.operationId,
        version: { kind: "record" as const, expectedVersion: props.version as SfVersion },
        confirmation: "presentation-only" as const,
      } }
    : { kind: "blocked" as const, labelKey: props.action.labelKey,
      reasons: [{ key: sfCommonKey("sf.common.readOnly") }] as SfMessage[] }

  return (
    <section class="mx-card sf-people-editor" aria-labelledby={id} data-sf-editor={props.entity}>
      <h2 id={id}>{t(props.action.labelKey)}</h2>
      <Show when={state().availability === "active"} fallback={
        <SfStatePanel
          state={state().availability === "quarantined" ? "session-expired" : "denied"}
          messageKey={sfCommonKey("sf.common.noAccess")}
        />
      }>
        <Show when={phase() === "reviewing"} fallback={
          <form onSubmit={(event) => { event.preventDefault(); review() }}>
            <div class="sf-people-form-grid">
              <For each={props.fields}>
                {(field) => (
                  <div class="sf-people-input">
                    <label for={id + "-" + field.name}>{t(field.labelKey)}</label>
                    <Show when={field.input === "select" && field.options} fallback={
                      <Show when={field.input === "textarea"} fallback={
                        <input id={id + "-" + field.name}
                          type={field.input === "date" ? "date" : "text"}
                          required={field.required}
                          value={active()?.value[field.name] ?? ""}
                          disabled={!props.admitted || busy()}
                          onInput={(event) => update(field.name, event.currentTarget.value)} />
                      }>
                        <textarea id={id + "-" + field.name}
                          value={active()?.value[field.name] ?? ""}
                          disabled={!props.admitted || busy()}
                          onInput={(event) => update(field.name, event.currentTarget.value)} />
                      </Show>
                    }>
                      <select id={id + "-" + field.name}
                        value={active()?.value[field.name] ?? ""}
                        disabled={!props.admitted || busy()}
                        onChange={(event) => update(field.name, event.currentTarget.value)}>
                        <For each={field.options}>
                          {(option) => <option value={option.value}>{t(option.labelKey)}</option>}
                        </For>
                      </select>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <Show when={local.message}>
              <p role="alert" class="sf-people-error">{local.message}</p>
            </Show>
            <Show when={phase() === "outcome-unknown"}>
              <SfStatePanel state="outcome-unknown" messageKey={sfCommonKey("sf.common.operationUnknown")} />
            </Show>
            <div class="sf-people-actions">
              <SfActionButton action={reviewAction()} variant="primary" />
              <button type="button" class="mx-btn" onClick={props.onClose}>{t(sfCommonKey("sf.common.back"))}</button>
              <button type="button" class="mx-btn" disabled={busy() || !active()?.dirty}
                onClick={() => draft().discard()}>{t(sfCommonKey("sf.common.discard"))}</button>
            </div>
          </form>
        }>
          <SfChangeReview
            operation={{
              ref: local.reviewRef ?? (id as SfOperationRef),
              label: { key: props.action.labelKey },
              scope: { kind: "data", text: props.recordRef ?? props.entity },
            }}
            base={base()} current={null} proposed={proposal()} effects={[]}
            coverage={{ state: "complete", summary: { key: sfCommonKey("sf.common.currentSource") },
              reasons: [], knownCount: null, expectedCount: null }}
            blockingReasons={[]}
            confirmation={confirmation()} state={canReview() ? "ready" : "conflict"}
            onConfirm={() => { void confirm() }}
            onRevise={() => draft().setPhase("dirty")}
            onCancel={() => draft().setPhase("dirty")}
          />
        </Show>
      </Show>
    </section>
  )
}
