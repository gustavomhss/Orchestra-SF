import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import type { JSX } from "solid-js"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfOwnerKey, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfDomainPageData } from "@orchestra/schema/sucafina/domain"
import { SfChangeReview } from "../../shared/change-review"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame/types"
import type { SfDraftRegistry, SfPublicDraftController } from "../../context/contracts"
import type { SfDraftState } from "../../shared/draft"
import { useSfContext } from "../../context"
import { SF_U02_COPY } from "@/i18n/orchestra-chapters/sf-u02"

type Key = keyof typeof SF_U02_COPY
const key = (value: Key): SfCopyKey => value as SfCopyKey
type Response =
  | Readonly<{ kind: "transport-error"; reason: string }>
  | Readonly<{ kind: "response"; status: number; body: Readonly<{ ok: true; warnings?: readonly string[] }> |
      Readonly<{ ok: false; status: number; errors?: readonly string[]; currentVersionCAS?: number }> }>

export type U02EditProps = Readonly<{
  surfaceId: "CAP01" | "CAP03"
  operationId: "domain.command.CAP01.save-users" | "domain.command.CAP01.save-benchmark" |
    "domain.command.CAP03.save-month" | "domain.command.CAP03.save-revenue"
  actionId: string
  labelKey: Key
  valueLabelKey: Key
  value: number | undefined
  version: number | undefined
  recordId?: string
  scope: string
  year: number
  month?: number
  integerOnly: boolean
  min?: number
  max?: number
  admitted: boolean
  drafts: SfDraftRegistry
  readInput: Readonly<Record<string, number>>
  onWrite: (value: number, version: number, idempotencyKey: string, signal: AbortSignal) => Promise<Response>
  onConfirmed: () => void
}>
type DraftValue = Readonly<{ text: string }>
export function sfU02IntentRef(surfaceId: U02EditProps["surfaceId"], scope: string): SfIntentRef {
  return (`sf-u02:${surfaceId}:${scope}`) as SfIntentRef
}
export type SfU02ReviewIntent = Readonly<{
  ownerKey: SfOwnerKey; generation: number; registry: SfDraftRegistry; transport: SfTransport
  controller: SfPublicDraftController<DraftValue>; surfaceId: U02EditProps["surfaceId"]
  operationId: U02EditProps["operationId"]; actionId: string; scope: string; recordId: string | undefined
  year: number; month: number | undefined; selector: string; sourceValue: number | undefined
  version: number; value: number; text: string; onWrite: U02EditProps["onWrite"]; onConfirmed: U02EditProps["onConfirmed"]
}>
export function sfU02SameReview(review: SfU02ReviewIntent, current: SfU02ReviewIntent | undefined): boolean {
  return !!current && review.ownerKey === current.ownerKey && review.generation === current.generation &&
    review.registry === current.registry && review.transport === current.transport && review.controller === current.controller &&
    review.surfaceId === current.surfaceId && review.operationId === current.operationId && review.actionId === current.actionId &&
    review.scope === current.scope && review.recordId === current.recordId && review.year === current.year &&
    review.month === current.month && review.selector === current.selector && Object.is(review.sourceValue, current.sourceValue) &&
    review.version === current.version && review.value === current.value && review.text === current.text &&
    review.onWrite === current.onWrite && review.onConfirmed === current.onConfirmed
}
export function sfU02ReviewReady(review: SfU02ReviewIntent, current: SfU02ReviewIntent | undefined, operationRef?: SfOperationRef): boolean {
  if (!sfU02SameReview(review, current)) return false
  const state = review.controller.snapshot()
  if (!operationRef) return sfU02DraftReady(state, review.version)
  return state.availability === "active" && state.phase === "submitting" && state.conflict === null &&
    state.baseVersion === review.version && state.pendingOperation?.operationRef === operationRef &&
    state.pendingOperation.expectedVersion === review.version
}
export async function sfU02SubmitReview(
  review: SfU02ReviewIntent, current: () => SfU02ReviewIntent | undefined,
  operationRef: SfOperationRef, idempotencyKey: string, digest: (payload: unknown) => Promise<string>,
): Promise<Readonly<{ status: "stale" | "failed" }> | Readonly<{ status: "response"; response: Response }>> {
  if (!sfU02ReviewReady(review, current())) return { status: "stale" }
  try {
    const hash = await digest({ action: review.operationId, value: review.value, version: review.version,
      recordId: review.recordId, year: review.year, month: review.month, selector: review.selector })
    if (!sfU02ReviewReady(review, current())) return { status: "stale" }
    review.controller.setPending({ operationRef, idempotencyKey, payloadDigest: hash, expectedVersion: review.version })
    review.controller.setPhase("submitting")
    if (!sfU02ReviewReady(review, current(), operationRef)) {
      review.controller.setPhase("outcome-unknown")
      return { status: "stale" }
    }
    const response = await review.onWrite(review.value, review.version, idempotencyKey, new AbortController().signal)
    if (!sfU02ReviewReady(review, current(), operationRef)) {
      review.controller.setPhase("outcome-unknown")
      return { status: "stale" }
    }
    return { status: "response", response }
  } catch {
    review.controller.setPhase("outcome-unknown")
    return { status: "failed" }
  }
}
type ExecutiveRow = NonNullable<(typeof SfDomainPageData.CAP01.Type)["itUsersMonthly"]>[number]
export function sfU02ExecutiveTarget(
  rows: readonly ExecutiveRow[] | undefined, year: number | undefined, month: number | undefined,
  collection: "itUsersMonthly" | "costPerUserBenchmarks", versions: Readonly<Record<string, number>>,
): Readonly<{ kind: "unavailable" }> | Readonly<{ kind: "new"; version: 0 }> |
    Readonly<{ kind: "record"; row: ExecutiveRow; id: string; version: number }> {
  if (!rows || year === undefined || collection === "itUsersMonthly" && month === undefined) return { kind: "unavailable" }
  const selected = rows.filter((row) => row.year === year && (collection !== "itUsersMonthly" || row.month === month))
  if (!selected.length) return { kind: "new", version: 0 }
  if (selected.length !== 1) return { kind: "unavailable" }
  const row = selected[0]!
  if (row.id === undefined || !String(row.id).trim() || typeof row.id === "number" && !Number.isFinite(row.id)) return { kind: "unavailable" }
  const id = String(row.id)
  if (rows.filter((item) => item.id !== undefined && String(item.id) === id).length !== 1) return { kind: "unavailable" }
  const version = versions[`${collection}:${id}`]
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) return { kind: "unavailable" }
  return { kind: "record", row, id, version }
}
export function sfU02DraftReady(state: SfDraftState<DraftValue> | undefined, version: number | undefined): boolean {
  return state?.availability === "active" && state.phase !== "conflict" && state.conflict === null &&
    state.pendingOperation === null && version !== undefined && state.baseVersion === version
}
export function sfU02Discard(
  draft: SfPublicDraftController<DraftValue>, source: Readonly<{ admitted: boolean; version: number | undefined; value: number | undefined; busy: boolean }>,
): boolean {
  const state = draft.snapshot()
  if (state.availability !== "active" || !source.admitted || source.busy || state.pendingOperation !== null ||
      state.phase === "submitting" || state.phase === "outcome-unknown" || source.version === undefined ||
      !Number.isSafeInteger(source.version) || source.version < 0) return false
  const remote = { baseVersion: source.version, value: { text: source.value === undefined ? "" : String(source.value) } }
  draft.receiveRemote(remote)
  draft.discard()
  // receiveRemote is a no-op for an unchanged dirty CAS; establish the current
  // source as the clean baseline only after the explicit discard has removed edits.
  draft.receiveRemote(remote)
  return true
}
function validNumber(raw: string, props: U02EditProps): number | null {
  const value = raw.trim()
  // Blank, NaN and legacy Number("") coercion are never zero.
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && (!props.integerOnly || Number.isInteger(parsed)) &&
    (props.min === undefined || parsed >= props.min) && (props.max === undefined || parsed <= props.max)
    ? parsed : null
}
async function sha256(payload: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)))
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("")
}

/** One producer-bound source mutation; never an inferred side effect of render. */
export function SfU02Edit(props: U02EditProps): JSX.Element {
  const { t } = useSfPresentation()
  const context = useSfContext()
  let disposed = false
  onCleanup(() => { disposed = true })
  const intentRef = () => sfU02IntentRef(props.surfaceId, props.scope)
  const editScope = () => (props.surfaceId + ":" + props.scope) as SfEditScopeKey
  const draft = createMemo(() => props.drafts.acquire<DraftValue>({
    surfaceId: props.surfaceId,
    editScopeKey: editScope(),
    identity: props.recordId ? { kind: "record", recordRef: props.recordId as SfRef } :
      { kind: "new", newIntentRef: intentRef() },
    baseVersion: props.version ?? null,
    base: props.recordId ? { text: props.value === undefined ? "" : String(props.value) } : null,
    value: { text: props.value === undefined ? "" : String(props.value) },
    revalidation: {
      operationId: props.surfaceId === "CAP01" ? "domain.page.CAP01" : "domain.page.CAP03",
      input: props.readInput,
      fieldPaths: [props.actionId === "save-users" ? "data.itUsersMonthly" :
        props.actionId === "save-benchmark" ? "data.costPerUserBenchmarks" :
        props.actionId === "save-month" ? "data.budgetCurrentMonth" : "data.revenueByYear"],
      actionIds: [props.actionId],
    },
  }))
  createEffect(() => {
    const version = props.version
    const value = props.value
    if (version !== undefined) {
      draft().receiveRemote({ baseVersion: version, value: { text: value === undefined ? "" : String(value) } })
    }
  })
  const [review, setReview] = createSignal<SfU02ReviewIntent>()
  const [busy, setBusy] = createSignal(false)
  const [feedback, setFeedback] = createSignal<"none" | "invalid" | "conflict" | "denied" | "failed" | "outcome-unknown" | "saved">("none")
  const active = () => {
    const state = draft().snapshot()
    return state.availability === "active" ? state : undefined
  }
  const parsed = () => active() ? validNumber(active()!.value.text, props) : null
  const conflicted = () => active()?.phase === "conflict" || !!active()?.conflict
  const allowed = () => props.admitted && sfU02DraftReady(active(), props.version) && parsed() !== null && props.year >= 2024 &&
    props.year <= 2027 && !busy()
  const current = (): SfU02ReviewIntent | undefined => {
    if (disposed || !props.admitted) return
    const owner = context.state()
    const ready = context.ready()
    if (owner.status !== "ready" || !ready || ready.drafts !== props.drafts) return
    const controller = draft()
    const state = controller.snapshot()
    if (state.availability !== "active" || props.version === undefined) return
    const value = validNumber(state.value.text, props)
    if (value === null) return
    return { ownerKey: owner.ownerKey, generation: context.generation(), registry: ready.drafts, transport: ready.transport,
      controller, surfaceId: props.surfaceId, operationId: props.operationId, actionId: props.actionId, scope: props.scope,
      recordId: props.recordId, year: props.year, month: props.month,
      selector: JSON.stringify(Object.entries(props.readInput).sort(([a], [b]) => a.localeCompare(b))),
      sourceValue: props.value, version: props.version, value, text: state.value.text,
      onWrite: props.onWrite, onConfirmed: props.onConfirmed }
  }
  createEffect(() => {
    const saved = review()
    if (saved && (!allowed() || !sfU02ReviewReady(saved, current()))) setReview(undefined)
  })
  const reviewFields = () => [{
    path: props.actionId === "save-month" ? "month" : props.actionId === "save-revenue" ? "revenue" : "value",
    label: { key: key(props.valueLabelKey) },
    value: { kind: "text" as const, text: { kind: "data" as const, text: active()?.value.text ?? "" } },
  }]
  const base = () => props.recordId
    ? { kind: "persisted" as const, ref: props.recordId as SfRef, version: props.version,
      fields: [{ path: reviewFields()[0].path, label: { key: key(props.valueLabelKey) },
        value: props.value === undefined ?
          { kind: "missing" as const, reason: { key: key("sf.u02.noValue") } } :
          { kind: "number" as const, value: props.value,
            unit: { kind: "unspecified" as const, label: { key: key("sf.u02.noCurrency") } },
            fractionDigits: 2 } }] }
    : { kind: "not-provided" as const, reason: { key: key("sf.u02.noValue") } }

  async function confirm() {
    const saved = review()
    if (!saved || !allowed() || !sfU02ReviewReady(saved, current())) {
      setReview(undefined); setFeedback("conflict"); return
    }
    setReview(undefined);setBusy(true)
    const operationRef = (saved.operationId + ":" + crypto.randomUUID()) as SfOperationRef
    const idempotencyKey = crypto.randomUUID()
    try {
      const result = await sfU02SubmitReview(saved, current, operationRef, idempotencyKey, sha256)
      if (result.status !== "response" || !sfU02ReviewReady(saved, current(), operationRef)) {
        saved.controller.setPhase("outcome-unknown")
        if (!disposed && sfU02SameReview(saved, current())) setFeedback(result.status === "failed" ? "outcome-unknown" : "conflict")
        return
      }
      const response = result.response
      if (response.kind === "transport-error") {
        saved.controller.setPhase("outcome-unknown");setFeedback("outcome-unknown")
      } else if (!response.body.ok) {
        saved.controller.setPhase("outcome-unknown")
        setFeedback(response.body.status === 409 ? "conflict" :
          response.body.status === 403 ? "denied" : "failed")
        saved.onConfirmed()
      } else {
        // Legacy success returns no record/version, never promote submitted fields.
        saved.controller.confirmSave({ kind: "confirmed-without-projection", operationRef, resultVersion: null })
        setFeedback("saved")
        saved.onConfirmed()
      }
    } catch {
      saved.controller.setPhase("outcome-unknown")
      if (!disposed && sfU02SameReview(saved, current())) setFeedback("outcome-unknown")
    } finally {
      setBusy(false)
    }
  }

  return <div data-sf-u02-edit={props.actionId}>
    <Show when={active()} fallback={<p role="status">{t(key("sf.u02.unknownOutcome"))}</p>}>
      <label>{t(key(props.valueLabelKey))}
        <input type="text" inputMode={props.integerOnly ? "numeric" : "decimal"}
          value={active()?.value.text ?? ""} disabled={!props.admitted || !!active()?.pendingOperation || busy() || conflicted()}
          aria-invalid={feedback() === "invalid"}
          onInput={(event) => { if (conflicted()) return;draft().edit({ text: event.currentTarget.value });setFeedback("none") }} />
      </label>
      <p>{t(key("sf.u02.sourceVersion"))}: {props.version}</p>
      <Show when={conflicted()}><p role="alert">{t(sfCommonKey("sf.common.conflict"))}</p></Show>
      <button class="mx-btn primary" type="button" disabled={!allowed()}
        onClick={() => {
          const saved = current()
          if (!allowed() || !saved || !sfU02ReviewReady(saved, saved)) return
          saved.controller.setPhase("reviewing");setReview(saved);setFeedback("none")
        }}>
        {t(key("sf.u02.reviewChange"))}
      </button>
      <button class="mx-btn" type="button" disabled={!props.admitted || props.version === undefined ||
          !Number.isSafeInteger(props.version) || props.version < 0 || !!active()?.pendingOperation || busy() ||
          active()?.phase === "submitting" || active()?.phase === "outcome-unknown"}
        onClick={() => {
          if (!sfU02Discard(draft(), { admitted: props.admitted, version: props.version, value: props.value, busy: busy() })) return
          setReview(undefined);setFeedback("none")
        }}>{t(sfCommonKey("sf.common.discard"))}</button>
    </Show>
    <Show when={feedback() !== "none"}><p role="alert" data-edit-result={feedback()}>
      {t(key(feedback() === "invalid" ? "sf.u02.invalidValue" :
        feedback() === "conflict" ? "sf.u02.sourcePending" :
        feedback() === "denied" ? "sf.u02.editNotAllowed" :
        feedback() === "saved" ? "sf.u02.savedRefetch" :
        feedback() === "failed" ? "sf.u02.failed" : "sf.u02.pendingWrite"))}
    </p></Show>
    <Show when={review() && allowed() && sfU02ReviewReady(review()!, current())}>
      <SfChangeReview
        operation={{ ref: (props.operationId + ":" + props.scope) as SfOperationRef,
          label: { key: key(props.labelKey) }, scope: { kind: "data", text: props.scope } }}
        base={base()} current={base()}
        proposed={{ kind: "draft", intentRef: intentRef(), sourceRef: props.recordId ? props.recordId as SfRef : null,
          sourceVersion: props.version ?? null, fields: reviewFields() }}
        effects={[]}
        coverage={{ state: "complete", summary: { key: key("sf.u02.currentData") },
          reasons: [], knownCount: 1, expectedCount: 1 }}
        blockingReasons={[]}
        confirmation={{ kind: "admitted", labelKey: key("sf.u02.confirmSave"),
          purpose: "save", binding: { kind: "catalog-command", operationId: props.operationId,
            version: { kind: "record", expectedVersion: props.version },
            confirmation: "presentation-only" } }}
        state="ready" onConfirm={() => { void confirm() }}
        onRevise={() => setReview(undefined)} onCancel={() => setReview(undefined)}
      />
    </Show>
  </div>
}
