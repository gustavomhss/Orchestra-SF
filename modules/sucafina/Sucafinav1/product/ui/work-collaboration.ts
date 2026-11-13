import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

export function caseQuestionForm(projection: AuthorizedCaseProjection) {
  const sources = projection.case.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && !!ref.target.period && ref.target.period.start <= projection.case.horizon.start && ref.target.period.end >= projection.case.horizon.end)
  if (!sources.length) return "<p>A question needs an accessible record covering the decision period.</p>"
  const context = { caseRef: { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }, period: projection.case.horizon, sources }
  return `<section><h3>Ask a question</h3><form data-case-question data-context="${esc(JSON.stringify(context))}"><label>Record<select name="source">${sources.map((source, index) => `<option value="${index}">${esc(source.target.recordType)} · ${esc(source.target.surface)}</option>`).join("")}</select></label><button type="button" data-find-recipients>Find recipients</button><label>Recipient<select name="recipient" required><option value="">Choose a recipient</option></select></label><label>Question<textarea name="question" required></textarea></label><button type="submit">Create question</button><p role="status" aria-live="polite"></p></form></section>`
}

export function caseQuestionThreads(projection: AuthorizedCaseProjection) {
  if (!projection.case.questions.length) return ""
  const caseRef = { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }
  return `<section><h3>Question conversations</h3>${projection.case.questions.map((question) => `<article data-case-thread data-thread="${esc(question.id)}" data-case="${esc(JSON.stringify(caseRef))}"><h4>${esc(question.text)}</h4><p>State: ${esc(question.state)}</p><button type="button" data-open-thread>Open conversation</button><div data-thread-messages></div><p role="status" aria-live="polite"></p></article>`).join("")}</section>`
}

export const caseQuestionScript = `
document.querySelectorAll('[data-case-thread]').forEach((entry) => {
  if (entry.dataset.sfThreadReady) return; entry.dataset.sfThreadReady = 'true'
  const button = entry.querySelector('[data-open-thread]'); const output = entry.querySelector('[data-thread-messages]'); const status = entry.querySelector('[role=status]'); const caseRef = JSON.parse(entry.dataset.case)
  const guard = document.createElement('form'); guard.hidden = true; entry.append(guard)
  let pending; let confirmed = false; let replyPending = false; let accessRevoked = false; let confirmKey = crypto.randomUUID(); let attachKey = crypto.randomUUID()
  const revoke = () => { accessRevoked = true; output.replaceChildren(); entry.querySelector('h4')?.replaceChildren(); delete guard.dataset.dirty; button.disabled = true; status.textContent = 'Conversation access changed. Reopen the decision with your current access.' }
  const send = async (mode, body, key = crypto.randomUUID()) => { const url = new URL(location.href); url.search = '?sf=' + mode; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) }); if (response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
  button.addEventListener('click', async () => {
    if (button.disabled || accessRevoked) return
    if (pending || replyPending) { status.textContent = 'Resolve the pending request before reopening this conversation.'; return }
    if (output.querySelector('form[data-dirty]') && !confirm('Discard your unsent reply and reload this conversation?')) return
    const controls = [...output.querySelectorAll('input,select,textarea,button')].map((control) => ({ control, disabled: control.disabled }))
    controls.forEach(({ control }) => { control.disabled = true }); button.disabled = true; status.textContent = 'Opening conversation…'
    try {
      const result = await send('collaboration-thread-read', { id: entry.dataset.thread })
      if (!Array.isArray(result?.messages)) throw new Error('unavailable')
      output.replaceChildren()
      result.messages.forEach((message, index) => {
        const item = document.createElement('div'); const paragraph = document.createElement('p'); paragraph.textContent = typeof message.body === 'string' ? message.body : 'Message unavailable'; item.append(paragraph); output.append(item)
        if (index === 0 || !result.recipientRef || message.authorRef !== result.recipientRef || typeof message.id !== 'string') return
        const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = 'Confirm this answer and add to decision'; item.append(confirm)
        confirm.addEventListener('click', async () => {
          if (confirm.disabled || accessRevoked || replyPending) return
          if (output.querySelector('form[data-dirty]') && !window.confirm('Discard your unsent reply and confirm this answer?')) return
          const previous = [...output.querySelectorAll('button,textarea')].map((control) => ({ control, disabled: control.disabled }))
          confirm.disabled = true; button.disabled = true; output.querySelectorAll('button,textarea').forEach((other) => { other.disabled = true }); status.textContent = 'Confirming answer…'
          try {
            if (!pending) { const evidence = await send('collaboration-answer-evidence', { questionId: entry.dataset.thread, messageId: message.id }); const version = await send('collaboration-storage-version', { namespace: 'confirmations' }); if (!evidence?.answerRef) throw new Error('unavailable'); pending = { questionId: entry.dataset.thread, answerRef: evidence.answerRef, mutation: { expectedStorageVersion: version, idempotencyKey: confirmKey } }; guard.dataset.dirty = 'true' }
            if (!confirmed) { await send('collaboration-answer-confirm', pending, confirmKey); confirmed = true }
            const answer = await send('collaboration-answer-reuse', { questionId: entry.dataset.thread }); if (!answer?.answerRef) throw new Error('unavailable')
            await send('decision-answer-question', { caseRef, questionId: entry.dataset.thread, answerRef: answer.answerRef }, attachKey); delete guard.dataset.dirty; status.textContent = 'Answer recorded in the decision.'; location.reload()
          } catch (error) { if (error?.accessDenied) { revoke(); return } status.textContent = 'Could not confirm the answer. Retry this same request.'; if (!pending) { previous.forEach(({ control, disabled }) => { control.disabled = disabled }); button.disabled = false } confirm.disabled = false }
        })
      })
      if (result.state === 'open') {
        const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reply'; const text = document.createElement('textarea'); text.required = true; label.append(text); const reply = document.createElement('button'); reply.type = 'submit'; reply.textContent = 'Send reply'; form.append(label, reply); output.append(form)
        let replyKey = crypto.randomUUID(); let replyRequest
        text.addEventListener('input', () => { if (!replyRequest) { replyKey = crypto.randomUUID(); form.dataset.dirty = 'true' } })
        form.addEventListener('submit', async (event) => {
          event.preventDefault(); if (reply.disabled || accessRevoked || pending || (!replyRequest && !text.value.trim())) return
          replyPending = true; reply.disabled = true; text.disabled = true; button.disabled = true; output.querySelectorAll('button').forEach((other) => { other.disabled = true }); status.textContent = 'Sending reply…'
          try {
            if (!replyRequest) { const version = await send('collaboration-storage-version', { namespace: 'threads' }); replyRequest = { id: entry.dataset.thread, body: text.value.trim(), mutation: { expectedStorageVersion: version, idempotencyKey: replyKey } }; replyPending = true }
            await send('collaboration-thread-reply', replyRequest, replyKey); replyPending = false; delete form.dataset.dirty; button.disabled = false; button.click()
          } catch (error) { if (error?.accessDenied) { revoke(); return } replyPending = !!replyRequest; status.textContent = 'Could not confirm the reply. Your text is preserved; retry the same request.'; if (!replyRequest) output.querySelectorAll('button').forEach((other) => { other.disabled = false }); reply.disabled = false; text.disabled = !!replyRequest; button.disabled = !!replyRequest }
        })
      }
      status.textContent = result.messages.length ? '' : 'No messages are available.'
    } catch (error) { if (error?.accessDenied) revoke(); else { status.textContent = 'Conversation unavailable. Your unsent reply is preserved.'; controls.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled }) } }
    finally { button.disabled = accessRevoked || !!pending || replyPending }
  })
})
document.querySelectorAll('[data-case-question]').forEach((form) => {
  if (form.dataset.sfCaseQuestionReady) return; form.dataset.sfCaseQuestionReady = 'true'
  const context = JSON.parse(form.dataset.context); const status = form.querySelector('[role=status]'); const recipientsButton = form.querySelector('[data-find-recipients]'); const select = form.elements.namedItem('recipient'); const submit = form.querySelector('button[type=submit]')
  let thread; let pending; let createKey = crypto.randomUUID(); let attachKey = crypto.randomUUID()
  const send = async (mode, payload, key) => { const url = new URL(location.href); url.search = '?sf=' + mode; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
  recipientsButton.addEventListener('click', async () => {
    if (thread) return; recipientsButton.disabled = true; status.textContent = 'Finding recipients…'
    try { const items = await send('collaboration-recipient-list', {}, crypto.randomUUID()); select.replaceChildren(); const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a recipient'; select.append(placeholder); items.forEach((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option) }); status.textContent = items.length ? 'Choose a recipient.' : 'No recipients are available.' }
    catch { status.textContent = 'Recipients are unavailable or access changed.' }
    finally { recipientsButton.disabled = false }
  })
  form.addEventListener('input', () => { if (!thread) { createKey = crypto.randomUUID(); attachKey = crypto.randomUUID(); form.dataset.dirty = 'true' } })
  form.addEventListener('change', () => { if (!thread) { createKey = crypto.randomUUID(); attachKey = crypto.randomUUID(); form.dataset.dirty = 'true' } })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (submit.disabled || !form.reportValidity()) return
    const fields = new FormData(form); const source = context.sources[Number(fields.get('source'))]; if (!thread && !pending && (!source || !fields.get('recipient') || !String(fields.get('question') || '').trim())) { status.textContent = 'Choose a record and recipient and enter a question.'; return }
    const controls = [...form.querySelectorAll('input,select,textarea,button')]; controls.forEach((control) => { control.disabled = true }); status.textContent = thread ? 'Adding question to the decision…' : 'Creating question…'
    try {
      if (!thread) { if (!pending) { const version = await send('collaboration-storage-version', { namespace: 'threads' }, crypto.randomUUID()); pending = { draft: { kind: 'clarification', sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: context.period, recipientRef: fields.get('recipient'), evidenceRefs: [source], body: String(fields.get('question')).trim() }, mutation: { expectedStorageVersion: version, idempotencyKey: createKey } } } const created = await send('collaboration-thread-create', pending, createKey); if (!created.id) throw new Error('unavailable'); thread = created.id }
      await send('decision-add-question', { caseRef: context.caseRef, questionRef: thread }, attachKey); delete form.dataset.dirty; status.textContent = 'Question added to the decision.'; location.reload()
    } catch { status.textContent = thread ? 'The question exists but could not be added to this decision. Retry the same request.' : 'Could not confirm the question. Your text is preserved; retry the same request.' }
    finally { controls.forEach((control) => { control.disabled = !!(thread || pending) && control !== submit }); submit.disabled = false }
  })
})
`

/** Resolve a work destination again when it is opened, with the current user's access. */
export const workDestinationScript = `
document.querySelectorAll('[data-work-destination]').forEach((button) => {
  if (button.dataset.sfWorkReady) return; button.dataset.sfWorkReady = 'true'
  button.addEventListener('click', async () => {
    const status = button.parentElement.querySelector('[role=status]'); button.disabled = true; status.textContent = 'Opening work…'
    try {
      const url = new URL(location.href); url.search = '?sf=collaboration-work-destination'
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selection: JSON.parse(button.dataset.selection), actionRef: button.dataset.actionRef }) })
      const result = await response.json(); if (!response.ok || result.status !== 'ok' || typeof result.value?.href !== 'string') throw new Error('unavailable')
      const destination = new URL(result.value.href, location.href)
      if (destination.origin !== location.origin || (destination.pathname !== button.dataset.mount && !destination.pathname.startsWith(button.dataset.mount + '/'))) throw new Error('unavailable')
      location.assign(destination.href)
    } catch { status.textContent = 'This work is unavailable or your access changed.'; button.disabled = false }
  })
})
`

