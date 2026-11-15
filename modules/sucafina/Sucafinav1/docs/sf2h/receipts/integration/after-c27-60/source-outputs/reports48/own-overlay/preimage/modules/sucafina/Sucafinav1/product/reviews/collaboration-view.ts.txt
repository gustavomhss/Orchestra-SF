import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import { createReviewDiscussionClient, discussionAnswer, discussionMessage, discussionObject, discussionPin, discussionText, discussionThread } from "./collaboration-client.ts"
import type { ReviewDiscussionBasis, ReviewDiscussionMessage, ReviewDiscussionPin, ReviewDiscussionThread, ReviewPreparedAnswer } from "./collaboration-client.ts"

/** Human actions against a preserved C05. The host owns source, recipient and
 * final access checks; no local selection or displayed principal grants access.
 */
export function createReviewCollaborationView(input: { review: PreservedReview; principalRef: string }) {
  const root = region("Review discussion")
  const status = document.createElement("p")
  status.setAttribute("role", "status")
  const form = document.createElement("div"), messages = document.createElement("div")
  const confirmation = region("Answer confirmation"), confirmed = region("Confirmed answer"), history = region("Answer history")
  root.append(heading("Discuss this preserved review"), status, form, messages, confirmation, confirmed, history)
  let closed = false, busy = false
  let thread: ReviewDiscussionThread | undefined
  let prepared: ReviewPreparedAnswer | undefined
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
  section.addEventListener("change", chooseSources)
  chooseSources()
  const ask = button("Ask about this review", async () => {
    const chosen = selected(), reference = references().find((ref) => ref.refId === source.value)
    if (!chosen || !reference || !recipient.value || !question.value.trim()) throw new Error("Choose a source, recipient and question")
    const basis: ReviewDiscussionBasis = { sourceRef: reference.refId, sourceIncarnation: reference.target.incarnation, observedVersion: reference.target.version, period: chosen.period, evidenceRefs: [reference] }
    const pin = discussionPin(await client.post("review-thread-context", { reviewRef: input.review.id, sectionId: chosen.id, basis }))
    if (pin.reviewRef !== input.review.id || pin.reviewVersion !== input.review.version || pin.sectionId !== chosen.id) throw new Error("Preserved review context changed")
    const mutation = await client.mutation()
    const created = discussionThread(await client.post("collaboration-thread-create", { draft: { kind: "clarification", ...basis, reviewContext: pin, recipientRef: recipient.value, body: question.value }, mutation }, mutation.idempotencyKey))
    checkThread(created)
    const url = new URL(location.href)
    url.searchParams.set("reviewThread", created.id)
    for (const key of ["reviewMessage", "reviewIncarnation", "reviewVersion"]) url.searchParams.delete(key)
    window.history.replaceState(null, "", url)
    thread = await client.thread(created.id)
    question.value = ""
    prepared = undefined; confirmation.replaceChildren(); history.replaceChildren()
    renderThread()
    await readConfirmed()
    status.textContent = "Question saved against the preserved review."
  })
  form.append(label("Review section", section), label("Review source", source), label("Recipient", recipient), label("Question", question), ask)

  function checkThread(value: ReviewDiscussionThread) {
    if (!value.messages.length || value.messages.some((message) => message.sourceContext.reviewContext.reviewRef !== input.review.id || message.sourceContext.reviewContext.reviewVersion !== input.review.version || !input.review.sections.some((entry) => entry.id === message.sourceContext.reviewContext.sectionId))) throw new Error("This discussion does not belong to the preserved review")
  }

  function renderThread() {
    messages.replaceChildren()
    if (!thread || closed) return
    checkThread(thread)
    const current = thread
    messages.append(heading("Question and answers"))
    current.messages.forEach((message, index) => {
      const article = document.createElement("article")
      article.setAttribute("aria-label", `Message ${message.id}`)
      article.append(paragraph(`${message.authorRef} · version ${message.version} · ${message.createdAt}`), paragraph(message.body))
      if (index > 0) article.append(button("Review this answer", async () => {
        const result = discussionAnswer(await client.post("collaboration-answer-prepare-message", { questionId: current.id, messageId: message.id, incarnation: message.incarnation, version: message.version }))
        if (!samePin(result.reviewContext, message.sourceContext.reviewContext) || result.answer !== message.body || result.authorRef !== message.authorRef || result.observedSourceVersion !== message.sourceContext.observedVersion) throw new Error("The selected answer changed; review it again")
        prepared = result
        rememberOriginal(message)
        renderConfirmation(current.id, result)
        status.textContent = "Inspect the captured source and answer before confirming."
      }))
      if (index > 0 && message.authorRef === input.principalRef) {
        const edit = document.createElement("textarea")
        edit.setAttribute("aria-label", "Edited answer"); edit.value = message.body
        article.append(label("Edited answer", edit), button("Save answer edit", async () => {
          if (!edit.value.trim()) throw new Error("Enter the edited answer")
          const mutation = await client.mutation()
          const receipt = discussionObject(await client.post("collaboration-thread-edit", { id: current.id, messageId: message.id, expectedVersion: message.version, body: edit.value, mutation }, mutation.idempotencyKey))
          if (receipt.id !== current.id || receipt.messageId !== message.id || receipt.version !== message.version + 1) throw new Error("Answer edit unavailable")
          rememberOriginal(message)
          prepared = undefined; confirmation.replaceChildren(); confirmed.replaceChildren()
          thread = await client.thread(current.id)
          renderThread(); renderHistory()
          await readConfirmed()
          status.textContent = "Answer edited. Its previous version remains protected history; review the new answer before confirming again."
        }))
      }
      messages.append(article)
    })
    const reply = document.createElement("textarea")
    reply.setAttribute("aria-label", "Reply")
    messages.append(label("Reply", reply), button("Send reply", async () => {
      if (!reply.value.trim()) throw new Error("Enter a reply")
      const mutation = await client.mutation()
      const updated = discussionThread(await client.post("collaboration-thread-reply", { id: current.id, body: reply.value, mutation }, mutation.idempotencyKey))
      if (updated.id !== current.id) throw new Error("Reply unavailable")
      thread = await client.thread(current.id)
      prepared = undefined; confirmation.replaceChildren()
      renderThread(); await readConfirmed()
      status.textContent = "Reply saved. Review and confirm the exact answer before reusing it."
    }))
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
      const receipt = discussionObject(await client.post("collaboration-answer-confirm", { questionId, answerRef: answer.answerRef, mutation }, mutation.idempotencyKey))
      if (receipt.answerRef !== answer.answerRef || receipt.observedVersion !== answer.observedSourceVersion) throw new Error("Answer confirmation unavailable")
      prepared = undefined; confirmation.replaceChildren()
      await readConfirmed()
      status.textContent = "Answer confirmed against the inspected preserved source."
    }))
  }

  async function readConfirmed() {
    confirmed.replaceChildren()
    if (!thread || closed) return
    const result = await client.post("collaboration-answer-read", { questionId: thread.id }).then(discussionObject, () => undefined)
    if (closed) return
    if (!result) { confirmed.append(paragraph("No currently reusable confirmed answer.")); return }
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
        thread = undefined; prepared = undefined
        messages.replaceChildren(); confirmation.replaceChildren(); confirmed.replaceChildren(); history.replaceChildren()
        status.textContent = error instanceof Error ? error.message : "Review discussion unavailable"
      }
    } finally { busy = false; if (!closed) root.inert = false }
  }

  function button(text: string, action: () => Promise<void>) {
    const element = document.createElement("button")
    element.type = "button"; element.textContent = text
    element.addEventListener("click", () => { void run(action) })
    return element
  }

  async function refresh() {
    await run(async () => {
      const people = await client.recipients()
      const chosen = recipient.value
      recipient.replaceChildren(...people.map((person) => new Option(person.name, person.id)))
      if (people.some((person) => person.id === chosen)) recipient.value = chosen
      ask.disabled = !people.length
      if (!people.length) status.textContent = "No authorized recipient is available."
      const id = new URL(location.href).searchParams.get("reviewThread")
      prepared = undefined; confirmation.replaceChildren()
      if (!id) return
      thread = await client.thread(id)
      renderThread(); renderHistory(); await readConfirmed()
    })
  }

  function dispose() {
    if (closed) return
    closed = true; thread = undefined; prepared = undefined
    client.dispose(); root.replaceChildren(); root.remove()
  }

  void refresh()
  return { element: root, refresh, dispose }
}

function region(name: string) { const element = document.createElement("section"); element.setAttribute("aria-label", name); return element }
function heading(text: string) { const element = document.createElement("h3"); element.textContent = text; return element }
function paragraph(text: string) { const element = document.createElement("p"); element.textContent = text; return element }
function label(text: string, control: HTMLElement) { const element = document.createElement("label"); element.append(document.createTextNode(text), control); return element }
function samePin(left: ReviewDiscussionPin, right: ReviewDiscussionPin) { return left.reviewRef === right.reviewRef && left.reviewVersion === right.reviewVersion && left.reviewDigest === right.reviewDigest && left.sectionId === right.sectionId }
