import { A } from "@solidjs/router"
import { Icon } from "@orchestra/ui/icon"
import { createEffect, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { sfDecisionHref } from "./route"
import { sfOperationReady } from "./model"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext } from "../../context/contracts"

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
  open: boolean
  context: () => SfContext | undefined
  transport: () => SfTransport | undefined
  onCreated: () => void
  onClose: (confirmed: boolean) => void
}>) {
  const language = useLanguage()
  const t = (key: string) => language.t(key as Parameters<typeof language.t>[0])
  const [form, setForm] = createStore({
    objective: "", start: "", end: "", currency: "", criteria: "",
    phase: "editing" as Phase,
    message: "" as string,
    createdRef: "" as string,
    readyPrefix: "" as string,
    hasPending: false,
  })
  let generation = 0
  let commandAbort: AbortController | undefined
  onCleanup(() => commandAbort?.abort())
  createEffect(() => {
    const context = props.context()
    const ticket = ++generation
    setForm({ objective: "", start: "", end: "", currency: "", criteria: "", readyPrefix: "", hasPending: false, createdRef: "", phase: "editing", message: "" })
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
      if (result.kind === "response" && (result.status === 401 || result.status === 403 ||
        result.body.status === "denied" || result.body.status === "unauthenticated")) {
        setForm({ phase: "unknown", hasPending: true, message: "sf.ui33.createDenied" })
        return
      }
      if (result.kind === "response" && result.status === 200 && result.body.status === "ok"
        && result.body.outputRef && /^case:[^:]+:[^:]+$/.test(result.body.outputRef)) {
        // Only source returned outputRef is authoritative for a new case.
        try { localStorage.removeItem(slot) } catch (error) {
          console.error("Sucafina confirmed creation marker cleanup failed", error)
        }
        setForm({ phase: "confirmed", hasPending: false, createdRef: result.body.outputRef, message: "sf.ui33.createReady" })
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
  let objectiveInput: HTMLTextAreaElement | undefined
  let reviewHeading: HTMLHeadingElement | undefined
  let createHeading: HTMLHeadingElement | undefined
  let createdLink: HTMLAnchorElement | undefined
  const reviewing = () => form.phase === "reviewing" || form.phase === "submitting"
    || form.phase === "confirmed" || (form.hasPending && !!form.objective.trim())
  // Hiding an unfinished editor keeps its store and recovery fences alive.
  // Focus runs after the visible stage mounts, including draft re-opening.
  createEffect(() => {
    if (!props.open) return
    queueMicrotask(() => {
      if (!props.open) return
      if (reviewing()) reviewHeading?.focus()
      else if (form.hasPending) createHeading?.focus()
      else objectiveInput?.focus()
    })
  })
  createEffect(() => {
    const phase = form.phase
    if (phase !== "reviewing" && phase !== "confirmed") return
    queueMicrotask(() => {
      if (!props.open || form.phase !== phase) return
      if (phase === "reviewing") reviewHeading?.focus()
      else createdLink?.focus()
    })
  })
  const busy = () => form.phase === "submitting"
  const field = (label: string, value: string, onInput: (value: string) => void, type = "text") => (
    <label class="sf-n24-field">
      <span>{t(label)}</span>
      <input type={type} value={value} disabled={busy() || form.hasPending}
        onInput={(event) => { onInput(event.currentTarget.value); setForm({ phase: "editing", message: "" }) }} required />
    </label>
  )
  return (
    <section class="mx-card sf-n24-create" aria-labelledby="sf-create-case-title">
      <header class="sf-cases-create-head">
        <div class="sf-cases-create-intro">
          <h2 id="sf-create-case-title" ref={createHeading} tabindex="-1">{t("sf.ui33.new")}</h2>
          <Show when={form.phase !== "confirmed" && form.phase !== "unknown"}>
            <p>{t(reviewing() ? "sf.ui33.reviewHint" : "sf.ui33.createHint")}</p>
          </Show>
        </div>
        <ol class="sf-cases-steps" aria-label={t("sf.ui33.new")}>
          <li aria-current={!reviewing() ? "step" : undefined} data-complete={reviewing() ? "true" : undefined}>
            <span class="sf-cases-step-number" aria-hidden="true">
              <Show when={reviewing()} fallback="1"><Icon name="check-small" size="small" /></Show>
            </span>
            <span>{t("sf.ui33.detailsStep")}</span>
          </li>
          <li aria-current={reviewing() && form.phase !== "confirmed" ? "step" : undefined}
            data-complete={form.phase === "confirmed" ? "true" : undefined}>
            <span class="sf-cases-step-number" aria-hidden="true">
              <Show when={form.phase === "confirmed"} fallback="2"><Icon name="check-small" size="small" /></Show>
            </span>
            <span>{t("sf.ui33.reviewStep")}</span>
          </li>
        </ol>
      </header>
      <form class="sf-cases-form" onSubmit={(event) => { event.preventDefault(); if (form.phase === "reviewing") void submit(); else review() }}>
        <Show when={!reviewing()}>
          <div class="sf-n24-form-grid">
            <label class="sf-n24-field sf-cases-objective">
              <span>{t("sf.ui33.objective")}</span>
              <textarea ref={objectiveInput} value={form.objective} disabled={busy() || form.hasPending}
                onInput={(event) => { setForm({ objective: event.currentTarget.value, phase: "editing", message: "" }) }} required rows={2} />
            </label>
            {field("sf.ui33.start", form.start, (value) => setForm("start", value), "date")}
            {field("sf.ui33.end", form.end, (value) => setForm("end", value), "date")}
            {field("sf.ui33.currency", form.currency, (value) => setForm("currency", value.toUpperCase()))}
            <label class="sf-n24-field sf-n24-span">
              <span>{t("sf.ui33.criteria")}</span>
              <textarea value={form.criteria} disabled={busy() || form.hasPending}
                onInput={(event) => { setForm({ criteria: event.currentTarget.value, phase: "editing", message: "" }) }} required rows={5} />
            </label>
          </div>
        </Show>
        <Show when={reviewing()}>
          <div class="sf-cases-review" role="group" aria-labelledby="sf-create-case-review-title">
            <h3 id="sf-create-case-review-title" ref={reviewHeading} tabindex="-1">{t("sf.ui33.createReview")}</h3>
            <dl class="sf-cases-review-details">
              <div class="sf-cases-objective">
                <dt>{t("sf.ui33.objective")}</dt>
                <dd><bdi>{form.objective.trim()}</bdi></dd>
              </div>
              <div>
                <dt>{t("sf.ui33.start")}</dt>
                <dd><bdi>{form.start}</bdi></dd>
              </div>
              <div>
                <dt>{t("sf.ui33.end")}</dt>
                <dd><bdi>{form.end}</bdi></dd>
              </div>
              <div>
                <dt>{t("sf.ui33.currency")}</dt>
                <dd><bdi>{form.currency.trim()}</bdi></dd>
              </div>
            </dl>
            <div class="sf-cases-review-criteria">
              <h4>{t("sf.ui34.criteria")}</h4>
              <ol>{form.criteria.split("\n").map((part) => part.trim()).filter(Boolean).map((criterion) => <li><bdi>{criterion}</bdi></li>)}</ol>
            </div>
            <div class="sf-cases-source-note"><Icon name="link" size="small" /><span>{t("sf.ui34.noSources")}</span></div>
          </div>
        </Show>
        <Show when={form.message}>
          <div class="sf-cases-status" data-state={form.phase} role="status" aria-live="polite">
            <Icon name={form.phase === "confirmed" ? "circle-check" : "warning"} />
            <span>{t(form.message)}</span>
          </div>
        </Show>
        <div class="sf-n24-actions">
          <Show when={form.phase !== "reviewing" && !busy() && !form.hasPending}>
            <button class="mx-btn sf-cases-cancel" type="button"
              onClick={() => { if (!busy() && !form.hasPending) props.onClose(form.phase === "confirmed") }}>
              <Icon name="arrow-left" size="small" />
              {t("sf.ui33.return")}
            </button>
          </Show>
          <Show when={form.phase === "reviewing"}>
            <button class="mx-btn sf-cases-cancel" type="button"
              onClick={() => { setForm("phase", "editing"); queueMicrotask(() => objectiveInput?.focus()) }}>
              <Icon name="arrow-left" size="small" />
              {t("sf.ui33.cancel")}
            </button>
          </Show>
          <Show when={form.phase !== "confirmed"}>
            <button class="mx-btn primary" type="submit" disabled={!canSubmit() || busy()} aria-busy={busy()}>
              <Show when={form.phase === "reviewing" || busy()} fallback={<>{t("sf.ui33.createReview")}<Icon name="arrow-right" size="small" /></>}>
                <Icon name="check" size="small" />
                {t("sf.ui33.createConfirm")}
              </Show>
            </button>
          </Show>
          <Show when={form.phase === "confirmed" && form.createdRef}>
            <A ref={createdLink} class="mx-btn primary" href={sfDecisionHref(props.route, "case", form.createdRef)}>
              {t("sf.ui33.caseOpen")}<Icon name="arrow-right" size="small" />
            </A>
          </Show>
        </div>
      </form>
    </section>
  )
}
