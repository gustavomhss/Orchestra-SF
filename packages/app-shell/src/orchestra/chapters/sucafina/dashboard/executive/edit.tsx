import { Show, createEffect, createMemo, createSignal } from "solid-js"
import type { JSX } from "solid-js"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import { SfChangeReview } from "../../shared/change-review"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame/types"
import type { SfDraftRegistry } from "../../context/contracts"
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
  const intentRef = crypto.randomUUID() as SfIntentRef
  const editScope = (props.surfaceId + ":" + props.scope) as SfEditScopeKey
  const draft = createMemo(() => props.drafts.acquire<DraftValue>({
    surfaceId: props.surfaceId,
    editScopeKey: editScope,
    identity: props.recordId ? { kind: "record", recordRef: props.recordId as SfRef } :
      { kind: "new", newIntentRef: intentRef },
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
  const [review, setReview] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [feedback, setFeedback] = createSignal<"none" | "invalid" | "conflict" | "denied" | "failed" | "outcome-unknown" | "saved">("none")
  const active = () => {
    const state = draft().snapshot()
    return state.availability === "active" ? state : undefined
  }
  const parsed = () => active() ? validNumber(active()!.value.text, props) : null
  const allowed = () => props.admitted && props.version !== undefined && parsed() !== null && props.year >= 2024 &&
    props.year <= 2027 && !busy() && active()?.pendingOperation === null && active()?.conflict === null
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
    const value = parsed()
    const state = active()
    const expectedVersion = props.version
    if (!allowed() || value === null || expectedVersion === undefined || !state || state.baseVersion !== expectedVersion) {
      setReview(false); setFeedback("conflict"); return
    }
    setReview(false);setBusy(true)
    const operationRef = (props.operationId + ":" + crypto.randomUUID()) as SfOperationRef
    const idempotencyKey = crypto.randomUUID()
    try {
      const digest = await sha256({ action: props.operationId, value, version: expectedVersion,
        recordId: props.recordId, year: props.year, month: props.month })
      if (!allowed() || active()?.baseVersion !== expectedVersion) {
        setFeedback("conflict");return
      }
      draft().setPending({ operationRef, idempotencyKey, payloadDigest: digest,
        expectedVersion })
      if (!active()?.pendingOperation) { setFeedback("conflict");return }
      draft().setPhase("submitting")
      const response = await props.onWrite(value, expectedVersion, idempotencyKey, new AbortController().signal)
      if (response.kind === "transport-error") {
        draft().setPhase("outcome-unknown");setFeedback("outcome-unknown")
      } else if (!response.body.ok) {
        draft().setPhase("outcome-unknown")
        setFeedback(response.body.status === 409 ? "conflict" :
          response.body.status === 403 ? "denied" : "failed")
        props.onConfirmed()
      } else {
        // Legacy success returns no record/version, never promote submitted fields.
        draft().confirmSave({ kind: "confirmed-without-projection", operationRef, resultVersion: null })
        setFeedback("saved")
        props.onConfirmed()
      }
    } catch {
      draft().setPhase("outcome-unknown");setFeedback("outcome-unknown")
    } finally {
      setBusy(false)
    }
  }

  return <div data-sf-u02-edit={props.actionId}>
    <Show when={active()} fallback={<p role="status">{t(key("sf.u02.unknownOutcome"))}</p>}>
      <label>{t(key(props.valueLabelKey))}
        <input type="text" inputMode={props.integerOnly ? "numeric" : "decimal"}
          value={active()?.value.text ?? ""} disabled={!props.admitted || !!active()?.pendingOperation || busy()}
          aria-invalid={feedback() === "invalid"}
          onInput={(event) => { draft().edit({ text: event.currentTarget.value });setFeedback("none") }} />
      </label>
      <p>{t(key("sf.u02.sourceVersion"))}: {props.version}</p>
      <Show when={active()?.conflict}><p role="alert">{t(sfCommonKey("sf.common.conflict"))}</p></Show>
      <button class="mx-btn primary" type="button" disabled={!allowed()}
        onClick={() => { draft().setPhase("reviewing");setReview(true);setFeedback("none") }}>
        {t(key("sf.u02.reviewChange"))}
      </button>
      <button class="mx-btn" type="button" disabled={!!active()?.pendingOperation}
        onClick={() => { draft().discard();setFeedback("none") }}>{t(sfCommonKey("sf.common.discard"))}</button>
    </Show>
    <Show when={feedback() !== "none"}><p role="alert" data-edit-result={feedback()}>
      {t(key(feedback() === "invalid" ? "sf.u02.invalidValue" :
        feedback() === "conflict" ? "sf.u02.sourcePending" :
        feedback() === "denied" ? "sf.u02.editNotAllowed" :
        feedback() === "saved" ? "sf.u02.savedRefetch" :
        feedback() === "failed" ? "sf.u02.failed" : "sf.u02.pendingWrite"))}
    </p></Show>
    <Show when={review() && allowed()}>
      <SfChangeReview
        operation={{ ref: (props.operationId + ":" + props.scope) as SfOperationRef,
          label: { key: key(props.labelKey) }, scope: { kind: "data", text: props.scope } }}
        base={base()} current={base()}
        proposed={{ kind: "draft", intentRef, sourceRef: props.recordId ? props.recordId as SfRef : null,
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
        onRevise={() => setReview(false)} onCancel={() => setReview(false)}
      />
    </Show>
  </div>
}
