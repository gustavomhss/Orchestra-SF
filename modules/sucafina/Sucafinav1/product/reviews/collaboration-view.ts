import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import { createReviewDiscussionClient, ReviewDiscussionError, discussionAnswer, discussionMessage, discussionObject, discussionPin, discussionText, discussionThread } from "./collaboration-client.ts"
import type { ReviewDiscussionBasis, ReviewDiscussionMessage, ReviewDiscussionPin, ReviewDiscussionThread, ReviewPreparedAnswer } from "./collaboration-client.ts"

/** Human actions against a preserved C05. All access and replay decisions remain
 * in the installed host. A displayed principal, draft or URL grants no access.
 */
export function createReviewCollaborationView(input: { review: PreservedReview; principalRef: string }) {
  const root = region("Review discussion")
  const status = document.createElement("p")
  status.setAttribute("role", "status")
  const form = document.createElement("div"), messages = document.createElement("div")
  const recovery = region("Action recovery")
  const confirmation = region("Answer confirmation"), confirmed = region("Confirmed answer"), history = region("Answer history")
  root.append(heading("Discuss this preserved review"), status, form, recovery, messages, confirmation, confirmed, history)
  let closed = false, busy = false
  let thread: ReviewDiscussionThread | undefined
  let prepared: ReviewPreparedAnswer | undefined
  const replies = new Map<string, string>()
  const edits = new Map<string, { text: string; message: ReviewDiscussionMessage; dirty: boolean }>()
  type Intent = {
    kind: "question" | "reply" | "edit" | "confirm"
    mode: string
    payload: string
    key: string
    text: string
    threadId?: string
    original?: ReviewDiscussionMessage
    reconcileQuestion?: () => Promise<void>
    complete: (value: unknown) => Promise<void>
    reconciled: boolean
    rejected: boolean
  }
  let intent: Intent | undefined
  const client = createReviewDiscussionClient(() => {
    dispose()
    window.dispatchEvent(new Event("sf-access-revoked"))
  })
  const section = document.createElement("select"), source = document.createElement("select"), recipient = document.createElement("select")
  section.setAttribute("aria-label", "Review section"); source.setAttribute("aria-label", "Review source"); recipient.setAttribute("aria-label", "Recipient")
  input.review.sections.forEach((entry) => section.append(new Option(entry.title, entry.id)))
  const question = document.createElement("textarea")
  question.setAttribute("aria-label", "Question")
  const selected = () => input.review.sections.find((entry) => entry.id === section.value)
  const references = () => {
    const projection = selected()?.content as DomainProjection | undefined
    const refs = projection?.values.flatMap((value) => [...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])]) ?? []
    return [...new Map(refs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record").map((ref) => [ref.refId, ref])).values()]
  }
  const chooseSources = () => {
    source.replaceChildren(...references().map((ref) => new Option(`${ref.target.surface} · ${ref.target.recordId} · version ${ref.target.version}`, ref.refId)))
  }
  section.addEventListener("change", () => { question.value = ""; chooseSources() })
  source.addEventListener("change", () => { question.value = "" })
  recipient.addEventListener("change", () => { question.value = "" })
  chooseSources()
  const ask = button("Ask about this review", async () => {
    const chosen = selected(), reference = references().find((ref) => ref.refId === source.value)
    const body = question.value, recipientRef = recipient.value
    if (!chosen || !reference || !recipientRef || !body.trim()) throw new Error("Choose a source, recipient and question")
    const basis: ReviewDiscussionBasis = { sourceRef: reference.refId, sourceIncarnation: reference.target.incarnation, observedVersion: reference.target.version, period: chosen.period, evidenceRefs: [reference] }
    const context = { reviewRef: input.review.id, sectionId: chosen.id, basis }
    const pin = discussionPin(await client.post("review-thread-context", context))
    live()
    if (pin.reviewRef !== input.review.id || pin.reviewVersion !== input.review.version || pin.sectionId !== chosen.id) return changedScope()
    const mutation = await client.mutation()
    live()
    intent = {
      kind: "question", mode: "collaboration-thread-create", key: mutation.idempotencyKey,
      payload: JSON.stringify({ draft: { kind: "clarification", ...basis, reviewContext: pin, recipientRef, body }, mutation }),
      text: body, reconciled: false, rejected: false,
      reconcileQuestion: async () => {
        const people = await client.recipients()
        if (!people.some((person) => person.id === recipientRef)) return changedScope()
        const current = discussionPin(await client.post("review-thread-context", context))
        if (!samePin(current, pin)) return changedScope()
      },
      complete: async (value) => {
        const created = discussionThread(value)
        checkThread(created, true)
        if (intent) intent.threadId = created.id
        const current = await client.thread(created.id)
        live(); checkThread(current, true)
        const url = new URL(location.href)
        url.searchParams.set("reviewThread", created.id)
        for (const key of ["reviewMessage", "reviewIncarnation", "reviewVersion"]) url.searchParams.delete(key)
        window.history.replaceState(null, "", url)
        replies.clear(); edits.clear()
        thread = current
        question.value = ""
        prepared = undefined; confirmation.replaceChildren(); history.replaceChildren()
        renderThread(); await readConfirmed()
        live(); status.textContent = "Question saved against the preserved review."
      },
    }
    await submitIntent()
  })
  ask.disabled = true
  form.append(label("Review section", section), label("Review source", source), label("Recipient", recipient), label("Question", question), ask)

  function live() { if (closed) throw new ReviewDiscussionError("Review discussion closed", "access", "rejected") }
  function changedScope(): never {
    dispose()
    window.dispatchEvent(new Event("sf-access-revoked"))
    throw new ReviewDiscussionError("Review discussion context changed", "access", "rejected")
  }
  function checkThread(value: ReviewDiscussionThread, newQuestion = false) {
    live()
    if (!value.messages.length || value.messages.some((message) => message.sourceContext.reviewContext.reviewRef !== input.review.id || message.sourceContext.reviewContext.reviewVersion !== input.review.version || !input.review.sections.some((entry) => entry.id === message.sourceContext.reviewContext.sectionId))) return changedScope()
    if (!newQuestion && thread && (value.id !== thread.id || value.recipientRef !== thread.recipientRef || !samePin(value.messages[0]!.sourceContext.reviewContext, thread.messages[0]!.sourceContext.reviewContext))) return changedScope()
    if (!newQuestion && thread) {
      const next = value.messages[0]!, previous = thread.messages[0]!
      const left = next.sourceContext, right = previous.sourceContext
      if (next.id !== previous.id || next.incarnation !== previous.incarnation || left.sourceRef !== right.sourceRef || left.sourceIncarnation !== right.sourceIncarnation || left.observedVersion !== right.observedVersion || left.period.start !== right.period.start || left.period.end !== right.period.end) return changedScope()
    }
  }
  const editKey = (id: string, message: ReviewDiscussionMessage) => JSON.stringify([id, message.id, message.incarnation])

  function renderThread() {
    if (closed) return
    messages.replaceChildren()
    if (!thread) return
    checkThread(thread)
    const current = thread
    messages.append(heading("Question and answers"))
    current.messages.forEach((message, index) => {
      const article = document.createElement("article")
      article.setAttribute("aria-label", `Message ${message.id}`)
      article.append(paragraph(`${message.authorRef} · version ${message.version} · ${message.createdAt}`), paragraph(message.body))
      if (index > 0) article.append(button("Review this answer", async () => {
        const result = discussionAnswer(await client.post("collaboration-answer-prepare-message", { questionId: current.id, messageId: message.id, incarnation: message.incarnation, version: message.version }))
        live()
        if (!samePin(result.reviewContext, message.sourceContext.reviewContext) || result.answer !== message.body || result.authorRef !== message.authorRef || result.observedSourceVersion !== message.sourceContext.observedVersion) throw new Error("The selected answer changed; review it again")
        prepared = result
        rememberOriginal(message)
        renderConfirmation(current.id, result)
        status.textContent = "Inspect the captured source and answer before confirming."
      }))
      if (index > 0 && message.authorRef === input.principalRef) {
        const key = editKey(current.id, message), saved = edits.get(key)
        const draft = saved?.dirty ? saved : { text: message.body, message, dirty: false }
        edits.set(key, draft)
        const edit = document.createElement("textarea")
        edit.setAttribute("aria-label", "Edited answer"); edit.value = draft.text
        edit.addEventListener("input", () => { draft.text = edit.value; draft.dirty = true })
        article.append(label("Edited answer", edit), button("Save answer edit", async () => {
          const body = edit.value, original = draft.message
          if (!body.trim()) throw new Error("Enter the edited answer")
          draft.text = body; draft.dirty = true
          const mutation = await client.mutation()
          live()
          intent = {
            kind: "edit", mode: "collaboration-thread-edit", key: mutation.idempotencyKey,
            payload: JSON.stringify({ id: current.id, messageId: original.id, expectedVersion: original.version, body, mutation }),
            text: body, threadId: current.id, original, reconciled: false, rejected: false,
            complete: async (value) => {
              const receipt = discussionObject(value)
              if (receipt.id !== current.id || receipt.messageId !== original.id || receipt.version !== original.version + 1) throw new Error("Answer edit unavailable")
              const updated = await client.thread(current.id)
              live(); checkThread(updated)
              rememberOriginal(original)
              thread = updated; edits.delete(key)
              prepared = undefined; confirmation.replaceChildren(); confirmed.replaceChildren()
              renderThread(); renderHistory(); await readConfirmed()
              live(); status.textContent = "Answer edited. Its previous version remains protected history; review the new answer before confirming again."
            },
          }
          await submitIntent()
        }))
      }
      messages.append(article)
    })
    const reply = document.createElement("textarea")
    reply.setAttribute("aria-label", "Reply"); reply.value = replies.get(current.id) ?? ""
    reply.addEventListener("input", () => { replies.set(current.id, reply.value) })
    messages.append(label("Reply", reply), button("Send reply", async () => {
      const body = reply.value
      if (!body.trim()) throw new Error("Enter a reply")
      replies.set(current.id, body)
      const mutation = await client.mutation()
      live()
      intent = {
        kind: "reply", mode: "collaboration-thread-reply", key: mutation.idempotencyKey,
        payload: JSON.stringify({ id: current.id, body, mutation }), text: body, threadId: current.id, reconciled: false, rejected: false,
        complete: async (value) => {
          const receipt = discussionThread(value)
          if (receipt.id !== current.id) throw new Error("Reply unavailable")
          const updated = await client.thread(current.id)
          live(); checkThread(updated)
          thread = updated; replies.delete(current.id)
          prepared = undefined; confirmation.replaceChildren()
          renderThread(); await readConfirmed()
          live(); status.textContent = "Reply saved in this preserved review."
        },
      }
      await submitIntent()
    }))
    lockDrafts()
  }

  function lockDrafts() {
    root.querySelectorAll("textarea").forEach((element) => { element.readOnly = !!intent })
    for (const element of [section, source, recipient]) element.disabled = !!intent
    ask.disabled = !!intent || !recipient.options.length
  }

  async function submitIntent() {
    const current = intent
    if (!current) return
    live()
    current.reconciled = false; current.rejected = false
    prepared = undefined; confirmation.replaceChildren(); confirmed.replaceChildren()
    lockDrafts()
    // Parsing the stored JSON preserves the original serialized bytes, including
    // source/storage versions and key. Never acquire a fresh CAS for this retry.
    const value = await client.post(current.mode, JSON.parse(current.payload), current.key).catch((error: unknown) => {
      // Only this mutation's definite rejection permits a new decision. A
      // failed read after a committed command cannot release its replay key.
      if (error instanceof ReviewDiscussionError && error.outcome === "rejected" && error.kind === "conflict") current.rejected = true
      throw error
    })
    live()
    await current.complete(value)
    live()
    if (intent === current) intent = undefined
    recovery.replaceChildren(); lockDrafts()
  }

  function renderRecovery() {
    recovery.replaceChildren()
    if (!intent || closed) return
    const current = intent
    recovery.append(heading("Your action is retained"), paragraph(current.text), paragraph("No action is sent by refreshing or reconciling. Resolve this attempt before starting another."))
    recovery.append(button("Reconcile action", async () => {
      if (intent !== current) return
      current.reconciled = false
      if (current.threadId) {
        const updated = await client.thread(current.threadId)
        live(); checkThread(updated, current.kind === "question")
        if (current.kind === "question") { replies.clear(); edits.clear() }
        if (current.original && !updated.messages.some((message) => message.id === current.original!.id && message.incarnation === current.original!.incarnation)) return changedScope()
        thread = updated; renderThread(); renderHistory()
      } else {
        await current.reconcileQuestion?.()
        live()
      }
      current.reconciled = true
      renderRecovery()
      status.textContent = "Action reconciled. Retry the same action explicitly to recover its receipt."
    }, true))
    if (!current.reconciled) return
    recovery.append(button("Retry same action", async () => {
      if (intent === current && current.reconciled) await submitIntent()
    }, true))
    // Only a definite rejected conflict may become a NEW human decision. An
    // unknown outcome cannot discard its key and thereby duplicate a commit.
    if (!current.rejected) return
    const latest = current.original && thread?.messages.find((message) => message.id === current.original!.id && message.incarnation === current.original!.incarnation)
    if (current.kind === "edit" && latest && current.threadId) {
      recovery.append(paragraph(`Current answer version ${latest.version}: ${latest.body}`), button("Apply preserved draft to this version", async () => {
        if (intent !== current) return
        edits.set(editKey(current.threadId!, latest), { text: current.text, message: latest, dirty: true })
        intent = undefined; recovery.replaceChildren(); renderThread(); lockDrafts()
        status.textContent = "Draft retained against the displayed version. Inspect it, then save the edit explicitly."
      }, true))
    } else if (current.kind === "confirm") {
      recovery.append(button("Review the answer again", async () => {
        if (intent !== current) return
        intent = undefined; prepared = undefined; confirmation.replaceChildren(); recovery.replaceChildren(); lockDrafts()
        status.textContent = "Rejected confirmation closed. Select and inspect the answer again before a new confirmation."
      }, true))
    } else {
      recovery.append(button("Keep draft for a new attempt", async () => {
        if (intent !== current) return
        intent = undefined; recovery.replaceChildren(); lockDrafts()
        status.textContent = "Rejected attempt closed. Inspect the retained draft before submitting a new action."
      }, true))
    }
  }
  function renderConfirmation(questionId: string, answer: ReviewPreparedAnswer) {
    confirmation.replaceChildren(heading("Confirm the preserved answer"), paragraph(answer.answer), paragraph(`Preserved review ${answer.reviewContext.reviewRef}, version ${answer.reviewContext.reviewVersion}. This confirmation concerns the displayed answer and source.`))
    const table = document.createElement("table"), header = document.createElement("tr")
    for (const text of ["Captured value", "Amount or text", "Period", "Source"]) { const cell = document.createElement("th"); cell.textContent = text; header.append(cell) }
    table.append(header)
    answer.projection.values.forEach((value) => {
      const row = document.createElement("tr")
      for (const text of [value.id, value.value === null ? "Unavailable" : String(value.value), `${value.period.start} – ${value.period.end}`, value.sourceRefs.map((ref) => ref.refId).join(", ")]) { const cell = document.createElement("td"); cell.textContent = text; row.append(cell) }
      table.append(row)
    })
    const details = document.createElement("details"), summary = document.createElement("summary")
    summary.textContent = "Inspect captured source details"
    const projection = document.createElement("pre"), pin = document.createElement("pre")
    projection.setAttribute("aria-label", "Observed source projection"); projection.textContent = JSON.stringify(answer.projection, null, 2)
    pin.setAttribute("aria-label", "Review context"); pin.textContent = JSON.stringify(answer.reviewContext, null, 2)
    details.append(summary, projection, pin)
    confirmation.append(table, details, button("Confirm this answer", async () => {
      if (prepared !== answer || thread?.id !== questionId) throw new Error("Review the answer again before confirming")
      // Use the exact inspected observation. A new preparation would silently
      // change the human decision and is deliberately not performed here.
      const mutation = { ...await client.mutation(), observationRef: answer.observationRef, observedSourceVersion: answer.observedSourceVersion, expectedScopeFingerprint: answer.expectedScopeFingerprint }
      live()
      intent = {
        kind: "confirm", mode: "collaboration-answer-confirm", key: mutation.idempotencyKey,
        payload: JSON.stringify({ questionId, answerRef: answer.answerRef, mutation }), text: answer.answer, threadId: questionId, reconciled: false, rejected: false,
        complete: async (value) => {
          const receipt = discussionObject(value)
          if (receipt.answerRef !== answer.answerRef || receipt.observedVersion !== answer.observedSourceVersion) throw new Error("Answer confirmation unavailable")
          prepared = undefined; confirmation.replaceChildren()
          await readConfirmed()
          live(); status.textContent = "Answer confirmed against the inspected preserved source."
        },
      }
      await submitIntent()
    }))
  }

  async function readConfirmed() {
    confirmed.replaceChildren()
    if (!thread || closed) return
    const result = await client.post("collaboration-answer-read", { questionId: thread.id }).then(discussionObject, (error: unknown) => {
      if (error instanceof ReviewDiscussionError && error.kind === "access") throw error
      return undefined
    })
    if (closed) return
    if (!result) { confirmed.append(paragraph("No confirmed answer is currently available to read or reuse.")); return }
    const pin = discussionPin(result.reviewContext)
    if (!samePin(pin, thread.messages[0]!.sourceContext.reviewContext)) throw new Error("Confirmed answer context unavailable")
    confirmed.append(heading("Confirmed answer"), paragraph(discussionText(result.answer)), paragraph(`Author ${discussionText(result.authorRef)} · preserved source version ${result.observedVersion}`))
  }

  function rememberOriginal(message: ReviewDiscussionMessage) {
    const url = new URL(location.href)
    url.searchParams.set("reviewMessage", message.id); url.searchParams.set("reviewIncarnation", message.incarnation); url.searchParams.set("reviewVersion", String(message.version))
    window.history.replaceState(null, "", url)
    renderHistory()
  }

  function renderHistory() {
    history.replaceChildren()
    const url = new URL(location.href), messageId = url.searchParams.get("reviewMessage"), incarnation = url.searchParams.get("reviewIncarnation"), version = Number(url.searchParams.get("reviewVersion"))
    if (!thread || !messageId || !incarnation || !Number.isSafeInteger(version) || version < 1) return
    const questionId = thread.id
    history.append(button("Read original answer", async () => {
      const historical = discussionObject(await client.post("collaboration-thread-history", { id: questionId, messageId, incarnation, version }))
      live()
      const message = discussionMessage(historical.message)
      const pin = discussionPin(historical.reviewContext)
      if (!thread || thread.id !== questionId || message.id !== messageId || message.incarnation !== incarnation || message.version !== version || !samePin(pin, message.sourceContext.reviewContext) || !samePin(pin, thread.messages[0]!.sourceContext.reviewContext)) throw new Error("Original answer unavailable")
      history.replaceChildren(heading("Original answer"), paragraph(message.body), paragraph(`Version ${message.version} · ${message.createdAt} · ${message.authorRef}`))
      status.textContent = "Original answer opened under current access."
    }))
  }

  async function run(action: () => Promise<void>) {
    if (closed || busy) return
    busy = true; root.inert = true
    try { await action() } catch (error) {
      if (!closed) {
        if (error instanceof ReviewDiscussionError && error.kind === "access") {
          dispose(error.message)
          return
        }
        // Keep drafts and the immutable attempt. A transport failure is neither
        // an authorization decision nor permission to send a new command.
        prepared = undefined; confirmation.replaceChildren(); confirmed.replaceChildren()
        if (intent) {
          intent.reconciled = false
        }
        renderRecovery(); lockDrafts()
        status.textContent = `${error instanceof Error ? error.message : "Review discussion unavailable"}${intent ? " Draft and original action retained. Reconcile before an explicit retry." : " Your draft is retained."}`
      }
    } finally { busy = false; if (!closed) root.inert = false }
  }

  function button(text: string, action: () => Promise<void>, recoveryAction = false) {
    const element = document.createElement("button")
    element.type = "button"; element.textContent = text
    element.addEventListener("click", () => { void run(async () => {
      if (intent && !recoveryAction) throw new Error("Resolve the retained action before starting another")
      await action()
    }) })
    return element
  }

  async function refresh() {
    await run(async () => {
      const people = await client.recipients()
      live()
      const chosen = recipient.value
      if (chosen && !people.some((person) => person.id === chosen)) return changedScope()
      recipient.replaceChildren(...people.map((person) => new Option(person.name, person.id)))
      if (people.some((person) => person.id === chosen)) recipient.value = chosen
      lockDrafts()
      if (!people.length) status.textContent = "No authorized recipient is available."
      const id = new URL(location.href).searchParams.get("reviewThread")
      if (thread && thread.id !== id) return changedScope()
      prepared = undefined; confirmation.replaceChildren()
      if (!id) return
      const updated = await client.thread(id)
      live(); checkThread(updated)
      thread = updated
      renderThread(); renderHistory(); await readConfirmed()
      live(); renderRecovery()
      // Refresh can update the displayed record but never resolves or sends the
      // pending intent. Its explicit reconciliation control remains necessary.
    })
  }

  function accessRevoked() { dispose() }
  function dispose(message?: string) {
    if (closed) return
    closed = true; thread = undefined; prepared = undefined; intent = undefined
    replies.clear(); edits.clear()
    question.value = ""
    root.querySelectorAll("textarea").forEach((element) => { element.value = "" })
    window.removeEventListener("sf-access-revoked", accessRevoked)
    window.removeEventListener("pagehide", accessRevoked)
    client.dispose(); root.replaceChildren(); root.inert = false
    if (message) root.append(heading("Review discussion unavailable"), paragraph(message))
    else root.remove()
  }

  window.addEventListener("sf-access-revoked", accessRevoked)
  window.addEventListener("pagehide", accessRevoked)
  void refresh()
  return { element: root, refresh, dispose }
}

function region(name: string) { const element = document.createElement("section"); element.setAttribute("aria-label", name); return element }
function heading(text: string) { const element = document.createElement("h3"); element.textContent = text; return element }
function paragraph(text: string) { const element = document.createElement("p"); element.textContent = text; return element }
function label(text: string, control: HTMLElement) { const element = document.createElement("label"); element.append(document.createTextNode(text), control); return element }
function samePin(left: ReviewDiscussionPin, right: ReviewDiscussionPin) { return left.reviewRef === right.reviewRef && left.reviewVersion === right.reviewVersion && left.reviewDigest === right.reviewDigest && left.sectionId === right.sectionId }

