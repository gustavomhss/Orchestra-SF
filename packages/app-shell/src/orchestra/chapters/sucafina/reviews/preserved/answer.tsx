import { For, Show, createEffect, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { SF_U32_COPY } from "@/i18n/orchestra-chapters/sf-u32"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { useSfContext } from "../../context"
import { bindReviewLocation, preservedRecordSources, preservedSourceBasis, reviewLocationBinding, type PreservedReview } from "./model"

const copy = SF_U32_COPY
type Message = { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string }
type Thread = { id: string; messages: Message[] }
type Recipient = { id: string; name: string }
type Prepared = Extract<Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-prepare-message"]["output"]>, { status: "ok" }>["value"]
type Confirmed = { answer: string; authorRef: string; observedVersion: number }
type CreateInput = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.thread-create"]["input"]>
type ReplyInput = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.thread-reply"]["input"]>
type EditInput = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.thread-edit"]["input"]>
type ConfirmInput = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-confirm"]["input"]>
type Intent = {
  kind: "question" | "reply" | "edit" | "confirm"
  key: string
  text: string
  threadId?: string
  reconciled: boolean
  payload: CreateInput | ReplyInput | EditInput | ConfirmInput
}

function asThread(value: unknown): Thread | undefined {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !("messages" in value) || !Array.isArray(value.messages)) return
  const messages = value.messages.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const message = entry as Partial<Message>
    if (!message.id || !message.incarnation || !message.authorRef || typeof message.body !== "string" || !message.createdAt ||
      typeof message.version !== "number" || !Number.isSafeInteger(message.version) || message.version < 1) return []
    return [{ id: message.id, incarnation: message.incarnation, version: message.version, authorRef: message.authorRef, body: message.body, createdAt: message.createdAt }]
  })
  if (messages.length !== value.messages.length || !messages.length) return
  return { id: value.id, messages }
}

/** Installed review discussion. Every mutation is an admitted collaboration producer call. */
export function SfPreservedAnswer(props: { review: PreservedReview }) {
  const owner = useSfContext()
  const [ui, setUi] = createStore({
    sectionId: "",
    sourceRef: "",
    recipientRef: "",
    recipients: [] as readonly Recipient[],
    question: "",
    reply: "",
    edits: {} as Record<string, string>,
    status: "",
    suspended: false,
    busy: false,
    hasIntent: false,
    reconciled: false,
    thread: undefined as Thread | undefined,
    prepared: undefined as Prepared | undefined,
    confirmed: undefined as Confirmed | undefined,
    historyText: "",
    history: reviewLocationBinding(),
  })
  let discussion: HTMLElement | undefined
  let intent: Intent | undefined
  let operation: AbortController | undefined
  const actor = () => owner.ready()?.context.stamp.principalRef ?? ""
  const sections = () => props.review.sections
  const selected = () => sections().find((section) => section.id === ui.sectionId) ?? sections()[0]
  const sources = () => {
    const section = selected()
    return section ? preservedRecordSources(section) : []
  }
  const sourceRef = () => sources().some((ref) => ref.refId === ui.sourceRef) ? ui.sourceRef : sources()[0]?.refId ?? ""
  const recipientRef = () => ui.recipients.some((person) => person.id === ui.recipientRef) ? ui.recipientRef
    : ui.recipients.some((person) => person.id === actor()) ? actor() : ""
  const locked = () => ui.busy || ui.suspended || ui.hasIntent
  const editKey = (threadId: string, message: Message) => `${threadId}:${message.id}:${message.incarnation}`
  const hold = (value: boolean) => { if (discussion) discussion.inert = value }
  const markIntent = (next: Intent | undefined) => {
    intent = next
    setUi({ hasIntent: !!next, reconciled: next?.reconciled ?? false })
  }
  onCleanup(() => operation?.abort())

  const readConfirmed = async (client: ReturnType<typeof createSfCollaborationClient>, questionId: string, signal: AbortSignal) => {
    const result = await client["collaboration.answer-read"]({ questionId }, { signal })
    if (signal.aborted) return
    if (result.kind !== "response" || result.body.status !== "ok") {
      setUi("confirmed", undefined)
      return
    }
    setUi("confirmed", {
      answer: result.body.value.answer,
      authorRef: result.body.value.authorRef,
      observedVersion: result.body.value.observedVersion,
    })
  }

  const remember = (message: Message, threadId: string) => {
    const history = {
      reviewThread: threadId,
      reviewMessage: message.id,
      reviewIncarnation: message.incarnation,
      reviewVersion: String(message.version),
    }
    bindReviewLocation(history)
    setUi("history", history)
  }

  createEffect(on(() => props.review.id, () => {
    operation?.abort()
    markIntent(undefined)
    setUi({
      sectionId: "", sourceRef: "", question: "", reply: "", edits: {}, status: "", suspended: false,
      thread: undefined, prepared: undefined, confirmed: undefined, historyText: "", history: reviewLocationBinding(),
    })
  }))

  createEffect(() => {
    const reviewId = props.review.id
    const generation = owner.generation()
    const active = owner.ready()
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    if (!active) return
    void (async () => {
      const client = createSfCollaborationClient(active.transport)
      const people = await client["collaboration.recipients"]({}, { signal: controller.signal })
      if (controller.signal.aborted || owner.generation() !== generation || props.review.id !== reviewId) return
      if (people.kind === "response" && people.body.status === "ok") {
        const installed = active.context.stamp.principalRef
        setUi({
          recipients: people.body.value,
          recipientRef: people.body.value.some((person) => person.id === installed) ? installed : "",
        })
      }
      const bound = reviewLocationBinding().reviewThread
      if (!bound) return
      const read = await client["collaboration.thread-read"]({ id: bound }, { signal: controller.signal })
      if (controller.signal.aborted || owner.generation() !== generation || read.kind !== "response" || read.body.status !== "ok") return
      const thread = asThread(read.body.value)
      if (!thread || thread.id !== bound) return
      setUi("thread", thread)
      await readConfirmed(client, bound, controller.signal)
    })().catch(() => undefined)
  })

  const probe = async () => {
    if (typeof location === "undefined") return
    const response = await fetch(location.href, { credentials: "same-origin", cache: "no-store" })
    await response.body?.cancel().catch(() => undefined)
  }

  const refreshBound = async () => {
    const active = owner.ready()
    const id = reviewLocationBinding().reviewThread ?? ui.thread?.id ?? intent?.threadId
    if (!active || !id) return
    const client = createSfCollaborationClient(active.transport)
    const abort = new AbortController()
    operation = abort
    const read = await client["collaboration.thread-read"]({ id }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (read.kind === "response" && read.body.status === "ok") {
      const thread = asThread(read.body.value)
      if (thread?.id === id) setUi("thread", thread)
    }
    await readConfirmed(client, id, abort.signal)
  }

  const onFocus = () => { void refreshBound().catch(() => undefined); void probe().catch(() => undefined) }
  if (typeof window !== "undefined") window.addEventListener("focus", onFocus)
  onCleanup(() => { if (typeof window !== "undefined") window.removeEventListener("focus", onFocus) })

  const call = async (current: Intent, signal: AbortSignal) => {
    const active = owner.ready()
    if (!active) return
    const client = createSfCollaborationClient(active.transport)
    const options = { signal, idempotencyKey: current.key }
    if (current.kind === "question") return client["collaboration.thread-create"](current.payload as CreateInput, options)
    if (current.kind === "reply") return client["collaboration.thread-reply"](current.payload as ReplyInput, options)
    if (current.kind === "edit") return client["collaboration.thread-edit"](current.payload as EditInput, options)
    return client["collaboration.answer-confirm"](current.payload as ConfirmInput, options)
  }

  const finish = async (current: Intent, value: unknown, signal: AbortSignal) => {
    const active = owner.ready()
    if (!active) throw new Error("Review discussion unavailable")
    const client = createSfCollaborationClient(active.transport)
    if (current.kind === "question") {
      const created = asThread(value)
      if (!created) throw new Error("Question was not saved against the issued pin.")
      current.threadId = created.id
      const read = await client["collaboration.thread-read"]({ id: created.id }, { signal })
      if (read.kind !== "response" || read.body.status !== "ok") throw new Error("Review discussion unavailable")
      const thread = asThread(read.body.value)
      if (!thread || thread.id !== created.id) throw new Error("Review discussion unavailable")
      bindReviewLocation({ reviewThread: thread.id })
      setUi({ thread, question: "", prepared: undefined })
      await readConfirmed(client, thread.id, signal)
      setUi("status", copy["sf.u32.questionSaved"])
      return
    }
    if (current.kind === "reply") {
      const receipt = asThread(value)
      if (!receipt || receipt.id !== current.threadId) throw new Error("Reply unavailable")
      const read = await client["collaboration.thread-read"]({ id: receipt.id }, { signal })
      if (read.kind !== "response" || read.body.status !== "ok") throw new Error("Review discussion unavailable")
      const thread = asThread(read.body.value)
      if (!thread) throw new Error("Review discussion unavailable")
      setUi({ thread, reply: "", prepared: undefined })
      await readConfirmed(client, thread.id, signal)
      setUi("status", copy["sf.u32.replySaved"])
      return
    }
    if (current.kind === "edit") {
      const payload = current.payload as EditInput
      const receipt = value as { id?: string; messageId?: string; version?: number }
      if (receipt.id !== payload.id || receipt.messageId !== payload.messageId || receipt.version !== payload.expectedVersion + 1)
        throw new Error("Answer edit unavailable")
      const read = await client["collaboration.thread-read"]({ id: payload.id }, { signal })
      if (read.kind !== "response" || read.body.status !== "ok") throw new Error("Review discussion unavailable")
      const thread = asThread(read.body.value)
      if (!thread) throw new Error("Review discussion unavailable")
      const original = thread.messages.find((message) => message.id === payload.messageId)
      const nextEdits = { ...ui.edits }
      if (original) delete nextEdits[editKey(payload.id, original)]
      setUi({ thread, prepared: undefined, confirmed: undefined, edits: nextEdits })
      remember({
        id: payload.messageId,
        incarnation: original?.incarnation ?? ui.history.reviewIncarnation ?? "",
        version: payload.expectedVersion,
        authorRef: original?.authorRef ?? "",
        body: "",
        createdAt: original?.createdAt ?? "",
      }, thread.id)
      await readConfirmed(client, thread.id, signal)
      setUi("status", copy["sf.u32.answerEdited"])
      return
    }
    const prepared = ui.prepared
    const receipt = value as { answerRef?: string; observedVersion?: number }
    if (!prepared || receipt.answerRef !== prepared.answerRef || receipt.observedVersion !== prepared.observedSourceVersion)
      throw new Error("Answer confirmation unavailable")
    setUi("prepared", undefined)
    await readConfirmed(client, current.threadId ?? "", signal)
    setUi("status", copy["sf.u32.answerConfirmed"])
  }

  const submitIntent = async () => {
    const current = intent
    const active = owner.ready()
    if (!current || !active) return
    current.reconciled = false
    setUi({ reconciled: false, prepared: undefined })
    const abort = new AbortController()
    operation = abort
    const result = await call(current, abort.signal)
    if (abort.signal.aborted || !result) return
    if (result.kind !== "response" || result.status !== 200 || result.body.status !== "ok")
      throw new Error("Review discussion unavailable")
    await finish(current, result.body.value, abort.signal)
    if (intent === current) markIntent(undefined)
    setUi("suspended", false)
  }

  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Review discussion unavailable"
    setUi({
      suspended: true,
      status: `${message}${intent ? ` ${copy["sf.u32.retainedAction"]}` : ` ${copy["sf.u32.draftRetained"]}`}`,
    })
  }

  const run = async (recovery: boolean, action: () => Promise<void>) => {
    if (ui.busy) return
    if (ui.suspended && !recovery) return fail(new Error("Reconcile the discussion before starting another action"))
    if (intent && !recovery) return fail(new Error("Resolve the retained action before starting another"))
    setUi("busy", true)
    hold(true)
    try { await action() } catch (error) { fail(error) } finally {
      setUi("busy", false)
      hold(false)
      if (operation) operation = undefined
    }
  }

  const ask = async () => {
    const active = owner.ready()
    const section = selected()
    const basis = section ? preservedSourceBasis(section, sourceRef()) : undefined
    const body = ui.question
    const recipient = recipientRef()
    if (!active || !section || !basis || !recipient || !body.trim()) throw new Error("Choose a source, recipient and question")
    const reviews = createSfReviewsClient(active.transport)
    const abort = new AbortController()
    operation = abort
    const issued = await reviews["reviews.review-thread-context"]({ reviewRef: props.review.id, sectionId: section.id, basis }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (issued.kind !== "response" || issued.body.status !== "ok") throw new Error("The producer did not issue a review pin.")
    const pin = issued.body.value
    if (pin.reviewRef !== props.review.id || pin.reviewVersion !== props.review.version || pin.sectionId !== section.id) throw new Error("Issued pin does not match this preserved review.")
    const client = createSfCollaborationClient(active.transport)
    const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (version.kind !== "response" || version.body.status !== "ok") throw new Error("Collaboration version unavailable.")
    const key = crypto.randomUUID()
    const payload = {
      draft: { kind: "clarification" as const, ...basis, reviewContext: pin, recipientRef: recipient, body },
      mutation: { expectedStorageVersion: version.body.value, idempotencyKey: key },
    }
    const decoded = Schema.decodeUnknownOption(Schema.toType(SfCollaboration.operations["collaboration.thread-create"].input), { onExcessProperty: "error" })(payload)
    if (Option.isNone(decoded)) throw new Error("Preserved source is not an admissible review question.")
    markIntent({ kind: "question", key, text: body, reconciled: false, payload: decoded.value })
    await submitIntent()
  }

  const reply = async () => {
    const active = owner.ready()
    const thread = ui.thread
    const body = ui.reply
    if (!active || !thread || !body.trim()) throw new Error("Enter a reply")
    const client = createSfCollaborationClient(active.transport)
    const abort = new AbortController()
    operation = abort
    const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (version.kind !== "response" || version.body.status !== "ok") throw new Error("Collaboration version unavailable.")
    const key = crypto.randomUUID()
    const payload = { id: thread.id, body, mutation: { expectedStorageVersion: version.body.value, idempotencyKey: key } }
    markIntent({ kind: "reply", key, text: body, threadId: thread.id, reconciled: false, payload })
    await submitIntent()
  }

  const saveEdit = async (message: Message) => {
    const active = owner.ready()
    const thread = ui.thread
    const body = ui.edits[editKey(thread?.id ?? "", message)] ?? message.body
    if (!active || !thread || !body.trim()) throw new Error("Enter the edited answer")
    const client = createSfCollaborationClient(active.transport)
    const abort = new AbortController()
    operation = abort
    const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (version.kind !== "response" || version.body.status !== "ok") throw new Error("Collaboration version unavailable.")
    const key = crypto.randomUUID()
    const payload = {
      id: thread.id, messageId: message.id, expectedVersion: message.version, body,
      mutation: { expectedStorageVersion: version.body.value, idempotencyKey: key },
    }
    markIntent({ kind: "edit", key, text: body, threadId: thread.id, reconciled: false, payload })
    await submitIntent()
  }

  const prepare = async (message: Message) => {
    const active = owner.ready()
    const thread = ui.thread
    if (!active || !thread) return
    const abort = new AbortController()
    operation = abort
    const result = await createSfCollaborationClient(active.transport)["collaboration.answer-prepare-message"]({
      questionId: thread.id, messageId: message.id, incarnation: message.incarnation, version: message.version,
    }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (result.kind !== "response" || result.body.status !== "ok" || !result.body.value.reviewContext || result.body.value.answer !== message.body)
      throw new Error("Preparation did not return this answer's issued pin.")
    setUi({ prepared: result.body.value, status: "Inspect the captured source and answer before confirming." })
    remember(message, thread.id)
  }

  const confirm = async () => {
    const active = owner.ready()
    const prepared = ui.prepared
    const thread = ui.thread
    if (!active || !prepared || !thread || !prepared.reviewContext) throw new Error("Review the answer again before confirming")
    const client = createSfCollaborationClient(active.transport)
    const abort = new AbortController()
    operation = abort
    const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (version.kind !== "response" || version.body.status !== "ok") throw new Error("Collaboration version unavailable for confirmation.")
    const key = crypto.randomUUID()
    const payload = {
      questionId: thread.id, answerRef: prepared.answerRef,
      mutation: {
        expectedStorageVersion: version.body.value, idempotencyKey: key,
        observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion,
        expectedScopeFingerprint: prepared.expectedScopeFingerprint,
      },
    }
    markIntent({ kind: "confirm", key, text: prepared.answer, threadId: thread.id, reconciled: false, payload })
    await submitIntent()
  }

  const recheckDeniedOwner = async (active: NonNullable<ReturnType<typeof owner.ready>>, signal: AbortSignal) => {
    const generation = owner.generation()
    const { installationId, projectId, hostId } = active.context.stamp
    const context = await createSfContextClient(active.transport)["ctx.context"]({ installationId, projectId, hostId }, { signal })
    if (signal.aborted || owner.generation() !== generation || owner.ready()?.transport !== active.transport) return false
    if (context.kind !== "response") return false
    const reason = context.status === 401 && context.body.status === "unauthenticated" ? "session-expired"
      : context.status === 403 && context.body.status === "denied" ? "revoked"
      : undefined
    if (!reason) return false
    bindReviewLocation({})
    owner.invalidate(reason)
    return true
  }

  const reconcileAction = async () => {
    const current = intent
    const active = owner.ready()
    if (!current || !active) return
    const client = createSfCollaborationClient(active.transport)
    const abort = new AbortController()
    operation = abort
    if (current.threadId) {
      const read = await client["collaboration.thread-read"]({ id: current.threadId }, { signal: abort.signal })
      if (abort.signal.aborted) return
      if (read.kind === "response" && (read.status === 401 || read.status === 403) &&
        await recheckDeniedOwner(active, abort.signal)) return
      if (read.kind !== "response" || read.body.status !== "ok") throw new Error("Review discussion unavailable")
      const thread = asThread(read.body.value)
      if (!thread || thread.id !== current.threadId) throw new Error("Review discussion unavailable")
      if (current.kind === "question") bindReviewLocation({ reviewThread: thread.id })
      setUi("thread", thread)
    }
    current.reconciled = true
    setUi({ suspended: false, reconciled: true, status: copy["sf.u32.actionReconciled"] })
  }

  const reconcileDiscussion = async () => {
    const active = owner.ready()
    const id = ui.thread?.id ?? reviewLocationBinding().reviewThread
    if (!active || !id) throw new Error("Review discussion unavailable")
    const abort = new AbortController()
    operation = abort
    const read = await createSfCollaborationClient(active.transport)["collaboration.thread-read"]({ id }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (read.kind === "response" && (read.status === 401 || read.status === 403) &&
      await recheckDeniedOwner(active, abort.signal)) return
    if (read.kind !== "response" || read.body.status !== "ok") throw new Error("Review discussion unavailable")
    const thread = asThread(read.body.value)
    if (!thread || thread.id !== id) throw new Error("Review discussion unavailable")
    setUi({ thread, suspended: false, status: copy["sf.u32.discussionReconciled"] })
  }

  const readHistory = async () => {
    const active = owner.ready()
    const thread = ui.thread
    const binding = ui.history.reviewMessage ? ui.history : reviewLocationBinding()
    const version = Number(binding.reviewVersion)
    if (!active || !thread || !binding.reviewMessage || !binding.reviewIncarnation || !Number.isSafeInteger(version) || version < 1)
      throw new Error("Original answer unavailable")
    const abort = new AbortController()
    operation = abort
    const result = await createSfCollaborationClient(active.transport)["collaboration.thread-history"]({
      id: thread.id, messageId: binding.reviewMessage, incarnation: binding.reviewIncarnation, version,
    }, { signal: abort.signal })
    if (abort.signal.aborted) return
    if (result.kind !== "response" || result.body.status !== "ok") throw new Error("Original answer unavailable")
    setUi({ historyText: result.body.value.message.body, status: copy["sf.u32.originalOpened"] })
  }

  return (
    <section class="sf-n28-section" aria-label={copy["sf.u32.discussion"]} ref={(element) => { discussion = element }}>
      <h2>{copy["sf.u32.discussion"]}</h2>
      <p role="status">{ui.status}</p>
      <label>{copy["sf.u32.reviewSection"]}
        <select aria-label={copy["sf.u32.reviewSection"]} value={selected()?.id ?? ""} disabled={locked()}
          onChange={(event) => { if (!intent) setUi({ sectionId: event.currentTarget.value, sourceRef: "", question: "" }) }}>
          <For each={sections()}>{(section) => <option value={section.id}>{section.title}</option>}</For>
        </select>
      </label>
      <label>{copy["sf.u32.reviewSource"]}
        <select aria-label={copy["sf.u32.reviewSource"]} value={sourceRef()} disabled={locked()}
          onChange={(event) => { if (!intent) setUi({ sourceRef: event.currentTarget.value, question: "" }) }}>
          <For each={sources()}>{(source) => <option value={source.refId}>{source.target.surface} · {source.target.recordId} · version {source.target.version}</option>}</For>
        </select>
      </label>
      <label>{copy["sf.u32.recipient"]}
        <select aria-label={copy["sf.u32.recipient"]} value={recipientRef()} disabled={locked()}
          onChange={(event) => { if (!intent) setUi({ recipientRef: event.currentTarget.value, question: "" }) }}>
          <For each={ui.recipients}>{(person) => <option value={person.id}>{person.name}</option>}</For>
        </select>
      </label>
      <label>{copy["sf.u32.question"]}
        <textarea aria-label={copy["sf.u32.question"]} rows={3} readOnly={ui.hasIntent} value={ui.question}
          onInput={(event) => setUi("question", event.currentTarget.value)} />
      </label>
      <button type="button" class="mx-btn" disabled={locked() || !recipientRef()} onClick={() => void run(false, ask)}>{copy["sf.u32.ask"]}</button>
      <Show when={ui.hasIntent}>
        <button type="button" data-review-recovery="true" disabled={ui.busy} onClick={() => void run(true, reconcileAction)}>{copy["sf.u32.reconcileAction"]}</button>
      </Show>
      <Show when={ui.reconciled}>
        <button type="button" data-review-recovery="true" disabled={ui.busy} onClick={() => void run(true, submitIntent)}>{copy["sf.u32.retryAction"]}</button>
      </Show>
      <Show when={ui.suspended && !ui.hasIntent}>
        <button type="button" data-review-recovery="true" disabled={ui.busy} onClick={() => void run(true, reconcileDiscussion)}>{copy["sf.u32.reconcileDiscussion"]}</button>
      </Show>
      <Show when={ui.thread}>
        {(thread) => <>
          <For each={thread().messages}>{(message, index) => <article aria-label={`Message ${message.id}`}>
            <p>{message.authorRef} · version {message.version} · {message.createdAt}</p>
            <p>{message.body}</p>
            <Show when={index() > 0}>
              <button type="button" class="mx-btn" disabled={locked()} onClick={() => void run(false, () => prepare(message))}>{copy["sf.u32.reviewAnswer"]}</button>
            </Show>
            <Show when={index() > 0 && message.authorRef === actor()}>
              <label>{copy["sf.u32.editedAnswer"]}
                <textarea aria-label={copy["sf.u32.editedAnswer"]} rows={3} readOnly={ui.hasIntent}
                  value={ui.edits[editKey(thread().id, message)] ?? message.body}
                  onInput={(event) => setUi("edits", editKey(thread().id, message), event.currentTarget.value)} />
              </label>
              <button type="button" class="mx-btn" disabled={locked()} onClick={() => void run(false, () => saveEdit(message))}>{copy["sf.u32.saveEdit"]}</button>
            </Show>
          </article>}</For>
          <label>{copy["sf.u32.reply"]}
            <textarea aria-label={copy["sf.u32.reply"]} rows={3} readOnly={ui.hasIntent} value={ui.reply}
              onInput={(event) => setUi("reply", event.currentTarget.value)} />
          </label>
          <button type="button" class="mx-btn" disabled={locked() || !ui.reply.trim()} onClick={() => void run(false, reply)}>{copy["sf.u32.sendReply"]}</button>
        </>}
      </Show>
      <Show when={ui.prepared}>
        {(prepared) => <section aria-label={copy["sf.u32.confirmation"]}>
          <h3>{copy["sf.u32.confirmation"]}</h3>
          <p>{prepared().answer}</p>
          <details>
            <summary>{copy["sf.u32.inspectSource"]}</summary>
            <pre aria-label={copy["sf.u32.observedProjection"]}>{JSON.stringify(prepared().projection, null, 2)}</pre>
            <pre aria-label={copy["sf.u32.reviewContext"]}>{JSON.stringify(prepared().reviewContext, null, 2)}</pre>
          </details>
          <button type="button" class="mx-btn primary" disabled={locked()} onClick={() => void run(false, confirm)}>{copy["sf.u32.confirmAnswer"]}</button>
        </section>}
      </Show>
      <section aria-label={copy["sf.u32.confirmed"]}>
        <Show when={ui.confirmed} fallback={<p>{copy["sf.u32.noConfirmed"]}</p>}>
          {(confirmed) => <>
            <h3>{copy["sf.u32.confirmed"]}</h3>
            <p>{confirmed().answer}</p>
            <p>{`Author ${confirmed().authorRef} · preserved source version ${confirmed().observedVersion}`}</p>
          </>}
        </Show>
      </section>
      <section aria-label={copy["sf.u32.history"]}>
        <Show when={ui.history.reviewMessage}>
          <button type="button" disabled={locked()} onClick={() => void run(false, readHistory)}>{copy["sf.u32.readOriginal"]}</button>
        </Show>
        <Show when={ui.historyText}><p>{ui.historyText}</p></Show>
      </section>
    </section>
  )
}
