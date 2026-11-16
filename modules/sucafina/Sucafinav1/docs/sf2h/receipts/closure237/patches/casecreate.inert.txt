import { A } from "@solidjs/router"
import { createEffect, onCleanup, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { sfDecisionHref } from "./route"
import { sfOperationReady } from "./model"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext } from "../../context/contracts"
import { useSfContext } from "../../context"
import type { SfEditScopeKey, SfIntentRef } from "@orchestra/schema/sucafina/context"

export const sfUi33DraftSelection = Object.freeze({
  surfaceId: "UI33" as const,
  identity: { kind: "new" as const, newIntentRef: "sf-ui33-case-create-local-v1" as SfIntentRef },
  editScopeKey: "sf-ui33-create-form-v1" as SfEditScopeKey,
})
export const sfUi33BlankFields = Object.freeze({
  objective: "", start: "", end: "", currency: "", criteria: "",
})
export type SfUi33DraftFields = { [K in keyof typeof sfUi33BlankFields]: string }

type Phase = "editing" | "reviewing" | "submitting" | "unknown" | "confirmed" | "invalid" | "unavailable"
const PENDING_PREFIX = "sf:n24:case-create:pending:v1:"
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

async function scopedPrefix(context: SfContext): Promise<string> {
  const scope = context.stamp
  const value = JSON.stringify([scope.installationId, scope.projectId, scope.hostId,
    scope.principalRef, scope.policyVersion, scope.accessRevision])
  // Only a SHA-256 scope digest and UUID remain in browser storage; never form
  // fields, case contents, access tokens or a fabricated server receipt.
  const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return PENDING_PREFIX + Array.from(new Uint8Array(hashed), (byte) => byte.toString(16).padStart(2, "0")).join("") + ":"
}
function pendingKeys(prefix: string): string[] | null {
  try {
    const found: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i)
      if (!name?.startsWith(prefix) || localStorage.getItem(name) !== "pending") continue
      const key = name.slice(prefix.length)
      if (!KEY_PATTERN.test(key)) return null
      found.push(key)
    }
    return found.length <= 64 ? found : null
  } catch (error) {
    console.error("Sucafina case creation correlation storage unavailable", error)
    return null
  }
}

export function SfCreateCase(props: Readonly<{
  route: SfResolvedRoute<"UI33">
  context: () => SfContext | undefined
  transport: () => SfTransport | undefined
  onCreated: () => void
}>) {
  const language = useLanguage()
  const owner = useSfContext()
  const t = (key: string) => language.t(key as Parameters<typeof language.t>[0])
  const [form, setForm] = createStore({
    objective: "", start: "", end: "", currency: "", criteria: "",
    phase: "editing" as Phase,
    message: "" as string,
    createdRef: "" as string,
    readyPrefix: "" as string,
    hasPending: false,
  })
  const draftFields = (): SfUi33DraftFields => ({
    objective: form.objective, start: form.start, end: form.end,
    currency: form.currency, criteria: form.criteria,
  })
  const editField = (field: keyof SfUi33DraftFields, value: string) => {
    const drafts = owner.ready()?.drafts
    // No registry entry exists while the editor remains untouched.
    if (!drafts) return
    const existing = drafts.peek<SfUi33DraftFields>(sfUi33DraftSelection)
    const controller = existing ?? drafts.acquire<SfUi33DraftFields>({
      ...sfUi33DraftSelection,
      base: null,
      baseVersion: null,
      value: draftFields(),
      // This is only a local new-intent draft. The original 231 revalidator
      // rejects such intents on access changes; no read/grant is manufactured.
      revalidation: {
        operationId: "projection.cases",
        input: undefined,
        fieldPaths: [],
        actionIds: [],
      },
    })
    controller.edit({ ...draftFields(), [field]: value })
  }
  let generation = 0
  let commandAbort: AbortController | undefined
  onCleanup(() => commandAbort?.abort())
  createEffect(() => {
    const context = props.context()
    const ticket = ++generation
    const restored = untrack(() => owner.ready()?.drafts.peek<SfUi33DraftFields>(sfUi33DraftSelection)?.snapshot())
    const values = restored?.availability === "active" ? restored.value : sfUi33BlankFields
    setForm({ ...values, readyPrefix: "", hasPending: false, createdRef: "", phase: "editing", message: "" })
    if (!context) return
    let alive = true
    onCleanup(() => { alive = false; commandAbort?.abort() })
    void scopedPrefix(context).then((prefix) => {
      if (!alive || ticket !== generation) return
      const keys = pendingKeys(prefix)
      if (!keys) {
        setForm({ phase: "unavailable", message: "sf.ui33.recoveryUnavailable" })
        return
      }
      setForm({
        readyPrefix: prefix,
        hasPending: keys.length > 0,
        phase: keys.length ? "unknown" : "editing",
        message: keys.length ? "sf.ui33.createPending" : "",
      })
    }).catch((error: unknown) => {
      if (!alive || ticket !== generation) return
      console.error("Sucafina pending creation scope failed", error)
      setForm({ phase: "unavailable", message: "sf.ui33.recoveryUnavailable" })
    })
  })
  const canSubmit = () => !!props.context() && !!props.transport()
    && sfOperationReady(props.context()!, "decisions.command.sf_case_draft")
    && !!form.readyPrefix && !form.hasPending
    && form.phase !== "submitting" && form.phase !== "unknown" && form.phase !== "confirmed"
  const review = () => {
    if (!canSubmit()) return
    const conditions = form.criteria.split("\n").map((line) => line.trim()).filter(Boolean)
    const dates = /^\d{4}-\d{2}-\d{2}$/
    if (!form.objective.trim() || !conditions.length) {
      setForm({ phase: "invalid", message: "sf.ui33.criteriaRequired" })
      return
    }
    if (!dates.test(form.start) || !dates.test(form.end) || form.end < form.start) {
      setForm({ phase: "invalid", message: "sf.ui33.periodRequired" })
      return
    }
    if (!/^[A-Z]{3}$/.test(form.currency.trim())) {
      setForm({ phase: "invalid", message: "sf.ui33.currencyRequired" })
      return
    }
    setForm({ phase: "reviewing", message: "" })
  }
  const submit = async () => {
    if (form.phase !== "reviewing" || !canSubmit()) return
    const transport = props.transport()
    const context = props.context()
    if (!transport || !context || !form.readyPrefix) return
    const prefix = form.readyPrefix
    const keys = pendingKeys(prefix)
    if (!keys || keys.length) {
      setForm({ phase: "unknown", hasPending: true, message: "sf.ui33.createPending" })
      return
    }
    const idempotencyKey = crypto.randomUUID()
    const slot = prefix + idempotencyKey
    // Local marker is written BEFORE the POST. A lost response must never
    // be replayed under a new key or reported as a committed case.
    try {
      localStorage.setItem(slot, "pending")
      if (localStorage.getItem(slot) !== "pending") throw new Error("marker write failed")
    } catch (error) {
      console.error("Sucafina creation correlation could not be saved", error)
      setForm({ phase: "unavailable", message: "sf.ui33.recoveryUnavailable" })
      return
    }
    owner.ready()?.drafts.markUnresolved(sfUi33DraftSelection, true)
    const actor = context.stamp
    const ticket = generation
    const request = {
      operation: "sf_case_draft" as const,
      input: {
        objective: form.objective.trim(),
        horizon: { start: form.start, end: form.end },
        currency: form.currency.trim(),
        criteria: form.criteria.split("\n").map((line) => line.trim()).filter(Boolean),
        sourceRefs: [],
      },
    }
    setForm({ phase: "submitting", hasPending: true, message: "" })
    const abort = new AbortController()
    commandAbort = abort
    try {
      const result = await createSfDecisionsClient(transport)["decisions.command.sf_case_draft"](
        request, { signal: abort.signal, idempotencyKey },
      )
      if (ticket !== generation) return
      const sameOwner = props.context()?.stamp
      if (!sameOwner || sameOwner.installationId !== actor.installationId ||
        sameOwner.projectId !== actor.projectId || sameOwner.principalRef !== actor.principalRef ||
        sameOwner.hostId !== actor.hostId || sameOwner.policyVersion !== actor.policyVersion ||
        sameOwner.accessRevision !== actor.accessRevision) {
        setForm({ phase: "unknown", message: "sf.ui33.createDenied" })
        return
      }
      if (result.kind === "response" && result.body.status === "ok"
        && result.body.outputRef && /^case:[^:]+:[^:]+$/.test(result.body.outputRef)) {
        // Only source returned outputRef is authoritative for a new case.
        try { localStorage.removeItem(slot) } catch (error) {
          console.error("Sucafina confirmed creation marker cleanup failed", error)
        }
        owner.ready()?.drafts.markUnresolved(sfUi33DraftSelection, false)
        owner.ready()?.drafts.discard(sfUi33DraftSelection)
        setForm({ ...sfUi33BlankFields, phase: "confirmed", hasPending: false, createdRef: result.body.outputRef, message: "sf.ui33.createReady" })
        props.onCreated()
        return
      }
      if (result.kind === "response" && result.body.status !== "ok") {
        // A 409/400 is not authoritative proof that an earlier creation
        // could not commit. Retain the same original correlation for review.
        setForm({
          phase: "unknown", hasPending: true,
          message: result.body.status === "denied" ? "sf.ui33.createDenied" : "sf.ui33.createConflict",
        })
        return
      }
      setForm({ phase: "unknown", message: result.kind === "response" ? "sf.ui33.createNoRef" : "sf.ui33.createUnknown" })
    } catch (error) {
      if (ticket !== generation) return
      console.error("Sucafina decision creation result uncertain", error)
      setForm({ phase: "unknown", message: "sf.ui33.createUnknown" })
    } finally {
      if (commandAbort === abort) commandAbort = undefined
    }
  }
  const busy = () => form.phase === "submitting"
  const field = (label: string, value: () => string, onInput: (value: string) => void, type = "text") => (
    <label class="sf-n24-field">
      <span>{t(label)}</span>
      <input type={type} value={value()} disabled={busy() || form.hasPending}
        onInput={(event) => {
          const next = event.currentTarget.value
          // Controller receives the exact same normalized value as this field.
          const normalized = label === "sf.ui33.currency" ? next.toUpperCase() : next
          const fieldKey = label === "sf.ui33.objective" ? "objective"
            : label === "sf.ui33.start" ? "start"
            : label === "sf.ui33.end" ? "end" : "currency"
          editField(fieldKey, normalized)
          onInput(next)
          setForm({ phase: "editing", message: "" })
        }} required />
    </label>
  )
  return (
    <section class="mx-card sf-n24-create" aria-labelledby="sf-create-case-title">
      <h2 id="sf-create-case-title">{t("sf.ui33.new")}</h2>
      <form onSubmit={(event) => { event.preventDefault(); if (form.phase === "reviewing") void submit(); else review() }}>
        <div class="sf-n24-form-grid">
          {field("sf.ui33.objective", () => form.objective, (value) => setForm("objective", value))}
          {field("sf.ui33.start", () => form.start, (value) => setForm("start", value), "date")}
          {field("sf.ui33.end", () => form.end, (value) => setForm("end", value), "date")}
          {field("sf.ui33.currency", () => form.currency, (value) => setForm("currency", value.toUpperCase()))}
          <label class="sf-n24-field sf-n24-span">
            <span>{t("sf.ui33.criteria")}</span>
            <textarea value={form.criteria} disabled={busy() || form.hasPending}
              onInput={(event) => {
                editField("criteria", event.currentTarget.value)
                setForm({ criteria: event.currentTarget.value, phase: "editing", message: "" })
              }} required rows={5} />
          </label>
        </div>
        <Show when={form.phase === "reviewing"}>
          <div class="sf-n24-review" role="group" aria-label={t("sf.ui33.createReview")}>
            <p><strong>{t("sf.ui33.objective")}:</strong> <bdi>{form.objective}</bdi></p>
            <p>{form.start} – {form.end} · <bdi>{form.currency}</bdi></p>
            <ol>{form.criteria.split("\n").map((part) => part.trim()).filter(Boolean).map((criterion) => <li><bdi>{criterion}</bdi></li>)}</ol>
          </div>
        </Show>
        <Show when={form.message}><p role="status" aria-live="polite">{t(form.message)}</p></Show>
        <div class="sf-n24-actions">
          <button class="mx-btn primary" type="submit" disabled={!canSubmit() || busy()}>
            {t(form.phase === "reviewing" ? "sf.ui33.createConfirm" : "sf.ui33.createReview")}
          </button>
          <Show when={form.phase === "reviewing"}>
            <button class="mx-btn" type="button" onClick={() => setForm("phase", "editing")}>{t("sf.ui33.cancel")}</button>
          </Show>
          <Show when={form.phase === "confirmed" && form.createdRef}>
            <A class="mx-btn" href={sfDecisionHref(props.route, "case", form.createdRef)}>{t("sf.ui33.caseOpen")}</A>
          </Show>
        </div>
      </form>
    </section>
  )
}
