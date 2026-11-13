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
  let context = JSON.parse(form.dataset.context)
  const status = form.querySelector('[role=status]'); const recipientsButton = form.querySelector('[data-find-recipients]'); const select = form.elements.namedItem('recipient'); const submit = form.querySelector('button[type=submit]')
  const controls = [...form.querySelectorAll('input,select,textarea,button')]; const disabled = new Map(controls.map((control) => [control, control.disabled]))
  let thread; let pending; let attachment; let snapshot; let createKey = crypto.randomUUID(); let attachKey = crypto.randomUUID()
  let busy = false; let reading = false; let closed = false; let completed = false; let epoch = 0; let readGeneration = 0
  const active = () => !closed && form.isConnected
  const sync = () => {
    if (!active()) return
    controls.forEach((control) => { control.disabled = disabled.get(control) || busy || (!!(pending || thread || completed) && control !== submit) || (reading && control === recipientsButton) })
    submit.textContent = completed ? 'Reload decision' : thread ? 'Retry adding question' : pending ? 'Retry same question' : 'Create question'
  }
  const revoke = () => {
    if (!active()) return
    closed = true; epoch++; readGeneration++; context = undefined; pending = undefined; attachment = undefined; snapshot = undefined; thread = undefined
    delete form.dataset.context; delete form.dataset.dirty
    controls.forEach((control) => { control.disabled = true; if ('value' in control) control.value = ''; if (control.tagName === 'SELECT' || control.tagName === 'TEXTAREA') control.replaceChildren() }); disabled.clear()
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Question access changed. Reopen the decision with your current access.'
    form.replaceChildren(message)
  }
  addEventListener('sf-access-revoked', revoke)
  const send = async (mode, payload, key, body = JSON.stringify(payload)) => {
    const ticket = epoch; const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body, signal: controller.signal })
      if (!active()) throw Object.assign(new Error('superseded'), { ignored: true })
      if (response.status === 401 || response.status === 403) { revoke(); throw Object.assign(new Error('access-changed'), { accessDenied: true }) }
      if (ticket !== epoch) throw Object.assign(new Error('superseded'), { ignored: true })
      const result = await response.json()
      if (!active() || ticket !== epoch) throw Object.assign(new Error('superseded'), { ignored: true })
      if (!response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'conflict'].includes(result.status) })
      return result.value
    } finally { clearTimeout(timeout) }
  }
  recipientsButton.addEventListener('click', async () => {
    if (!active() || busy || reading || thread || pending || completed) return
    const generation = ++readGeneration; reading = true; sync(); status.textContent = 'Finding recipients…'
    try {
      const items = await send('collaboration-recipient-list', {}, crypto.randomUUID())
      if (!active() || generation !== readGeneration || busy || pending || thread) return
      if (!Array.isArray(items) || items.some((item) => typeof item?.id !== 'string' || typeof item?.name !== 'string')) throw new Error('unavailable')
      const selected = select.value
      select.replaceChildren(); const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a recipient'; select.append(placeholder)
      items.forEach((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option) })
      if (items.some((item) => item.id === selected)) select.value = selected
      status.textContent = selected && select.value !== selected ? 'Your selected recipient is no longer available. Choose another recipient; your question is preserved.' : items.length ? 'Choose a recipient.' : 'No recipients are available.'
    } catch (error) { if (active() && generation === readGeneration && !error?.ignored) status.textContent = 'Recipients are temporarily unavailable. Your question and current selection are preserved; try again.' }
    finally { if (generation === readGeneration) { reading = false; sync() } }
  })
  const changed = () => {
    if (!active()) return
    if (busy || thread || pending || completed) { if (snapshot) Object.entries(snapshot).forEach(([name, value]) => { form.elements.namedItem(name).value = value }); return }
    createKey = crypto.randomUUID(); attachKey = crypto.randomUUID(); form.dataset.dirty = 'true'
  }
  form.addEventListener('input', changed)
  form.addEventListener('change', changed)
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || busy || submit.disabled) return
    if (completed) { location.reload(); return }
    if (!pending && !thread && !form.reportValidity()) return
    const fields = new FormData(form); const source = context.sources[Number(fields.get('source'))]
    if (!thread && !pending && (!source || !fields.get('recipient') || !String(fields.get('question') || '').trim())) { status.textContent = 'Choose a record and recipient and enter a question.'; return }
    if (!snapshot) snapshot = { source: String(fields.get('source')), recipient: String(fields.get('recipient')), question: String(fields.get('question')) }
    busy = true; epoch++; readGeneration++; reading = false; form.dataset.dirty = 'true'; sync(); status.textContent = thread ? 'Adding question to the decision…' : 'Creating question…'
    try {
      if (!thread) {
        if (!pending) { const version = await send('collaboration-storage-version', { namespace: 'threads' }, crypto.randomUUID()); pending = { key: createKey, uncertain: false, body: JSON.stringify({ draft: { kind: 'clarification', sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: context.period, recipientRef: snapshot.recipient, evidenceRefs: [source], body: snapshot.question.trim() }, mutation: { expectedStorageVersion: version, idempotencyKey: createKey } }) } }
        const created = await send('collaboration-thread-create', undefined, pending.key, pending.body)
        if (typeof created?.id !== 'string' || !created.id) throw new Error('unavailable')
        thread = created.id
      }
      if (!attachment) attachment = { key: attachKey, body: JSON.stringify({ caseRef: context.caseRef, questionRef: thread }) }
      await send('decision-add-question', undefined, attachment.key, attachment.body)
      completed = true; delete form.dataset.dirty; status.textContent = 'Question added to the decision.'; location.reload()
    } catch (error) {
      if (!active() || error?.ignored) return
      if (!thread && pending && error?.rejected && !pending.uncertain) { pending = undefined; snapshot = undefined; createKey = crypto.randomUUID(); attachKey = crypto.randomUUID(); status.textContent = 'The question request was rejected. Your entries are preserved; review the record and recipient before trying again.' }
      else { if (pending) pending.uncertain = true; if (!pending && !thread) snapshot = undefined; status.textContent = thread ? 'The question exists but could not be added to this decision. Retry the same request.' : pending ? 'Could not confirm the question. Your text is preserved and locked; retry the same request.' : 'Could not prepare the question. Your entries are preserved; try again.' }
    } finally { busy = false; sync() }
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

