import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { SfReviewsReviewThreadContext } from "@orchestra/schema/sucafina/reviews"
import { useSfContext } from "../../context"
import { preservedAnswerBasis, type PreservedReview } from "./model"

type Pin = Extract<Schema.Schema.Type<typeof SfReviewsReviewThreadContext.output>, { status: "ok" }>["value"]
type Thread = Extract<Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.thread-create"]["output"]>, { status: "ok" }>["value"]
type Prepared = Extract<Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-prepare-message"]["output"]>, { status: "ok" }>["value"]
type Receipt = Extract<Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-confirm"]["output"]>, { status: "ok" }>["value"]
type Phase = "pinning" | "ready" | "asking" | "open" | "replying" | "answered" | "preparing" | "prepared" | "confirming" | "confirmed" | "failed" | "unknown"

const samePin = (left: Pin, right: Pin) =>
  left.reviewRef === right.reviewRef && left.reviewVersion === right.reviewVersion &&
  left.reviewDigest === right.reviewDigest && left.sectionId === right.sectionId

/** Obtains the producer pin, then prepares and confirms one human answer against that receipt. */
export function SfPreservedAnswer(props: { review: PreservedReview }) {
  const owner = useSfContext()
  const [ui, setUi] = createStore<{
    sectionId: string
    question: string
    reply: string
    phase: Phase
    error: string
    pin?: Pin
    thread?: Thread
    prepared?: Prepared
    receipt?: Receipt
  }>({ sectionId: "", question: "", reply: "", phase: "pinning", error: "" })
  let operation: AbortController | undefined
  onCleanup(() => operation?.abort())
  const sections = () => props.review.sections.flatMap((section) => preservedAnswerBasis(section) ? [section] : [])
  const selected = () => sections().find((section) => section.id === ui.sectionId) ?? sections()[0]
  const sectionId = () => selected()?.id ?? ""
  const basis = () => {
    const section = selected()
    return section ? preservedAnswerBasis(section) : undefined
  }
  const replyMessage = () => ui.thread?.messages.find((message, index) => index > 0 && message.authorRef === owner.ready()?.context.stamp.principalRef)
  const live = (generation: number) => {
    const state = owner.state()
    return owner.generation() === generation && state.status === "ready" && props.review.id === ui.pin?.reviewRef
  }
  createEffect(() => {
    const reviewId = props.review.id
    const section = selected()
    const active = owner.ready()
    const generation = owner.generation()
    operation?.abort()
    setUi({ question: "", reply: "", pin: undefined, thread: undefined,
      prepared: undefined, receipt: undefined, phase: "pinning", error: "" })
    const next = section ? preservedAnswerBasis(section) : undefined
    if (!active || !section || !next) {
      setUi({ phase: "failed", error: "This preserved section has no record the producer can pin." })
      return
    }
    const abort = new AbortController()
    operation = abort
    void (async () => {
      const result = await createSfReviewsClient(active.transport)["reviews.review-thread-context"]({
        reviewRef: reviewId, sectionId: section.id, basis: next,
      }, { signal: abort.signal })
      if (abort.signal.aborted || owner.generation() !== generation || props.review.id !== reviewId) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setUi({ phase: "failed", error: "The producer did not issue a review pin." })
        return
      }
      const pin = result.body.value
      if (pin.reviewRef !== reviewId || pin.reviewVersion !== props.review.version || pin.sectionId !== section.id ||
        !/^[a-f0-9]{64}$/.test(pin.reviewDigest)) {
        setUi({ phase: "unknown", error: "Issued pin does not match this preserved review." })
        return
      }
      setUi({ pin, phase: "ready", error: "" })
    })().catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina review thread context failed", error instanceof Error ? error.name : "unknown")
      setUi({ phase: "failed", error: "Review pin unavailable." })
    }).finally(() => {
      if (operation === abort) operation = undefined
    })
  })
  const ask = async () => {
    const active = owner.ready(), pin = ui.pin, selectedBasis = basis(), section = selected()
    if (!active || !pin || !selectedBasis || !section || ui.phase !== "ready" || !ui.question.trim() || operation) return
    if (pin.sectionId !== section.id || pin.reviewRef !== props.review.id) return
    const generation = owner.generation()
    const key = crypto.randomUUID()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "asking", error: "" })
    try {
      const client = createSfCollaborationClient(active.transport)
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (abort.signal.aborted || !live(generation)) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setUi({ phase: "failed", error: "Collaboration version unavailable." })
        return
      }
      const payload = {
        draft: {
          kind: "clarification" as const, ...selectedBasis, recipientRef: active.context.stamp.principalRef,
          body: ui.question.trim(), reviewContext: pin,
        },
        mutation: { expectedStorageVersion: version.body.value, idempotencyKey: key },
      }
      const decoded = Schema.decodeUnknownOption(Schema.toType(SfCollaboration.operations["collaboration.thread-create"].input), { onExcessProperty: "error" })(payload)
      if (Option.isNone(decoded)) {
        setUi({ phase: "failed", error: "Preserved source is not an admissible review question." })
        return
      }
      const created = await client["collaboration.thread-create"](decoded.value, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || !live(generation)) return
      if (created.kind !== "response" || created.status !== 200 || created.body.status !== "ok" ||
        created.body.value.messages[0]?.sourceContext?.reviewContext === undefined ||
        !samePin(created.body.value.messages[0].sourceContext.reviewContext, pin)) {
        setUi({ phase: created.kind === "response" && created.status >= 500 ? "unknown" : "failed",
          error: created.kind === "response" && created.status >= 500 ? `Question outcome unknown. Do not retry. Key ${key}.` : "Question was not saved against the issued pin." })
        return
      }
      setUi({ phase: "open", thread: created.body.value, error: "" })
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina preserved question outcome uncertain", error instanceof Error ? error.name : "unknown")
        setUi({ phase: "unknown", error: `Question outcome unknown. Do not retry. Key ${key}.` })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const reply = async () => {
    const active = owner.ready(), thread = ui.thread, pin = ui.pin
    if (!active || !thread || !pin || ui.phase !== "open" || !ui.reply.trim() || operation) return
    const generation = owner.generation()
    const key = crypto.randomUUID()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "replying", error: "" })
    try {
      const client = createSfCollaborationClient(active.transport)
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (abort.signal.aborted || !live(generation)) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setUi({ phase: "failed", error: "Collaboration version unavailable." })
        return
      }
      const result = await client["collaboration.thread-reply"]({
        id: thread.id, body: ui.reply.trim(),
        mutation: { expectedStorageVersion: version.body.value, idempotencyKey: key },
      }, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || !live(generation)) return
      if (result.kind !== "response" || result.status !== 200 || result.body.status !== "ok") {
        setUi({ phase: result.kind === "response" && result.status >= 500 ? "unknown" : "failed",
          error: result.kind === "response" && result.status >= 500 ? `Reply outcome unknown. Do not retry. Key ${key}.` : "Reply was not saved." })
        return
      }
      const message = result.body.value.messages.find((entry) => entry.body === ui.reply.trim() && entry.authorRef === active.context.stamp.principalRef)
      if (!message?.sourceContext?.reviewContext || !samePin(message.sourceContext.reviewContext, pin)) {
        setUi({ phase: "unknown", error: `Reply was not bound to the issued pin. Do not retry. Key ${key}.` })
        return
      }
      setUi({ phase: "answered", thread: { ...thread, messages: result.body.value.messages }, error: "" })
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina preserved reply outcome uncertain", error instanceof Error ? error.name : "unknown")
        setUi({ phase: "unknown", error: `Reply outcome unknown. Do not retry. Key ${key}.` })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const prepare = async () => {
    const active = owner.ready(), thread = ui.thread, pin = ui.pin, message = replyMessage()
    if (!active || !thread || !pin || !message || ui.phase !== "answered" || operation) return
    const generation = owner.generation()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "preparing", error: "" })
    try {
      const result = await createSfCollaborationClient(active.transport)["collaboration.answer-prepare-message"]({
        questionId: thread.id, messageId: message.id, incarnation: message.incarnation, version: message.version,
      }, { signal: abort.signal })
      if (abort.signal.aborted || !live(generation)) return
      if (result.kind !== "response" || result.body.status !== "ok" || !result.body.value.reviewContext ||
        !samePin(result.body.value.reviewContext, pin) || result.body.value.answer !== message.body ||
        result.body.value.authorRef !== message.authorRef) {
        setUi({ phase: "failed", error: "Preparation did not return this answer's issued pin." })
        return
      }
      setUi({ phase: "prepared", prepared: result.body.value, error: "" })
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina preserved answer preparation failed", error instanceof Error ? error.name : "unknown")
        setUi({ phase: "failed", error: "Answer preparation unavailable." })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const confirm = async () => {
    const active = owner.ready(), prepared = ui.prepared, pin = ui.pin, thread = ui.thread
    if (!active || !prepared || !pin || !thread || ui.phase !== "prepared" || !prepared.reviewContext ||
      !samePin(prepared.reviewContext, pin) || operation) return
    const generation = owner.generation()
    const key = crypto.randomUUID()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "confirming", error: "" })
    try {
      const client = createSfCollaborationClient(active.transport)
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (abort.signal.aborted || !live(generation)) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setUi({ phase: "failed", error: "Collaboration version unavailable for confirmation." })
        return
      }
      const result = await client["collaboration.answer-confirm"]({
        questionId: thread.id, answerRef: prepared.answerRef,
        mutation: {
          expectedStorageVersion: version.body.value, idempotencyKey: key,
          observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion,
          expectedScopeFingerprint: prepared.expectedScopeFingerprint,
        },
      }, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || !live(generation)) return
      if (result.kind !== "response" || result.status !== 200 || result.body.status !== "ok" ||
        result.body.value.answerRef !== prepared.answerRef || result.body.value.observedVersion !== prepared.observedSourceVersion) {
        setUi({ phase: result.kind === "response" && result.status >= 500 ? "unknown" : "failed",
          error: result.kind === "response" && result.status >= 500 ? `Confirmation outcome unknown. Do not retry. Key ${key}.` : "Confirmation receipt did not match the inspected answer." })
        return
      }
      setUi({ phase: "confirmed", receipt: result.body.value, error: "" })
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina preserved answer confirmation uncertain", error instanceof Error ? error.name : "unknown")
        setUi({ phase: "unknown", error: `Confirmation outcome unknown. Do not retry. Key ${key}.` })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const busy = () => ui.phase === "asking" || ui.phase === "replying" || ui.phase === "preparing" || ui.phase === "confirming"
  return (
    <section class="sf-n28-section" aria-label="Review discussion">
      <h2>Review discussion</h2>
      <Show when={ui.pin}>
        {(pin) => <p>Issued review digest <bdi>{pin().reviewDigest}</bdi></p>}
      </Show>
      <Show when={sections().length > 1}>
        <label>Review section
          <select aria-label="Review section" value={sectionId()} disabled={ui.phase !== "ready"}
            onChange={(event) => setUi("sectionId", event.currentTarget.value)}>
            <For each={sections()}>{(section) => <option value={section.id}>{section.title}</option>}</For>
          </select>
        </label>
      </Show>
      <Show when={ui.phase === "ready"}>
        <label>Question
          <textarea aria-label="Question" rows={3} value={ui.question} disabled={busy()}
            onInput={(event) => setUi("question", event.currentTarget.value)} />
        </label>
        <button type="button" class="mx-btn" disabled={!ui.question.trim() || busy()} onClick={() => void ask()}>Ask about this review</button>
      </Show>
      <Show when={ui.phase === "open"}>
        <label>Reply
          <textarea aria-label="Reply" rows={3} value={ui.reply} disabled={busy()}
            onInput={(event) => setUi("reply", event.currentTarget.value)} />
        </label>
        <button type="button" class="mx-btn" disabled={!ui.reply.trim() || busy()} onClick={() => void reply()}>Send reply</button>
      </Show>
      <Show when={replyMessage()}>
        {(message) => <article aria-label={`Message ${message().id}`}>
          <p>{message().body}</p>
          <Show when={ui.phase === "answered"}>
            <button type="button" class="mx-btn" disabled={busy()} onClick={() => void prepare()}>Review this answer</button>
          </Show>
        </article>}
      </Show>
      <Show when={ui.phase === "prepared" && ui.prepared && ui.pin}>
        <section aria-label="Answer confirmation">
          <h3>Answer confirmation</h3>
          <p>{ui.prepared!.answer}</p>
          <pre aria-label="Review context">{JSON.stringify(ui.pin, null, 2)}</pre>
          <button type="button" class="mx-btn primary" disabled={busy()} onClick={() => void confirm()}>Confirm this answer</button>
        </section>
      </Show>
      <Show when={ui.receipt}>
        {(receipt) => <p role="status">Answer confirmed. Receipt <bdi>{receipt().answerRef}</bdi> · preserved source version {receipt().observedVersion}</p>}
      </Show>
      <Show when={ui.error}><p role="alert">{ui.error}</p></Show>
    </section>
  )
}
