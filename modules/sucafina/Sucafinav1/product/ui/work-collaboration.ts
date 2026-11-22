import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

export function caseQuestionForm(projection: AuthorizedCaseProjection) {
  const sources = projection.case.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && !!ref.target.period && ref.target.period.start <= projection.case.horizon.start && ref.target.period.end >= projection.case.horizon.end)
  if (!sources.length) return "<p>A question needs an accessible record covering the decision period.</p>"
  const context = { caseRef: { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }, period: projection.case.horizon, sources }
  return `<section><h3>Ask a question</h3><form data-case-question data-context="${esc(JSON.stringify(context))}"><label for="case-question-record">Record</label><select id="case-question-record" name="source">${sources.map((source, index) => `<option value="${index}">${esc(source.target.recordType)} · ${esc(source.target.surface)}</option>`).join("")}</select><button type="button" data-find-recipients>Find recipients</button><label for="case-question-recipient">Recipient</label><select id="case-question-recipient" name="recipient" required><option value="">Choose a recipient</option></select><label>Question<textarea name="question" required></textarea></label><button type="submit">Create question</button><p role="status" aria-live="polite"></p></form></section>`
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
  let pending; let confirmed = false; let confirmKey = crypto.randomUUID(); let attachKey = crypto.randomUUID()
  const send = async (mode, body, key = crypto.randomUUID()) => { const url = new URL(location.href); url.search = '?sf=' + mode; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = 'Opening conversation…'; output.replaceChildren()
    try {
      const result = await send('collaboration-thread-read', { id: entry.dataset.thread })
      if (!Array.isArray(result?.messages)) throw new Error('unavailable')
      result.messages.forEach((message, index) => {
        const item = document.createElement('div'); const paragraph = document.createElement('p'); paragraph.textContent = typeof message.body === 'string' ? message.body : 'Message unavailable'; item.append(paragraph); output.append(item)
        if (index === 0 || !result.recipientRef || message.authorRef !== result.recipientRef || typeof message.id !== 'string') return
        const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = 'Confirm this answer and add to decision'; item.append(confirm)
        confirm.addEventListener('click', async () => {
          confirm.disabled = true; button.disabled = true; output.querySelectorAll('button').forEach((other) => { other.disabled = true }); status.textContent = 'Confirming answer…'
          try {
            if (!pending) { const evidence = await send('collaboration-answer-evidence', { questionId: entry.dataset.thread, messageId: message.id }); const version = await send('collaboration-storage-version', { namespace: 'confirmations' }); if (!evidence?.answerRef) throw new Error('unavailable'); pending = { questionId: entry.dataset.thread, answerRef: evidence.answerRef, mutation: { expectedStorageVersion: version, idempotencyKey: confirmKey } }; guard.dataset.dirty = 'true' }
            if (!confirmed) { await send('collaboration-answer-confirm', pending, confirmKey); confirmed = true }
            const answer = await send('collaboration-answer-reuse', { questionId: entry.dataset.thread }); if (!answer?.answerRef) throw new Error('unavailable')
            await send('decision-answer-question', { caseRef, questionId: entry.dataset.thread, answerRef: answer.answerRef }, attachKey); delete guard.dataset.dirty; status.textContent = 'Answer recorded in the decision.'; location.reload()
          } catch { status.textContent = 'Could not confirm the answer. Retry this same request.'; confirm.disabled = false }
        })
      })
      if (result.state === 'open') {
        const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reply'; const text = document.createElement('textarea'); text.required = true; label.append(text); const reply = document.createElement('button'); reply.type = 'submit'; reply.textContent = 'Send reply'; form.append(label, reply); output.append(form)
        let replyKey = crypto.randomUUID(); let replyRequest
        text.addEventListener('input', () => { if (!replyRequest) { replyKey = crypto.randomUUID(); form.dataset.dirty = 'true' } })
        form.addEventListener('submit', async (event) => {
          event.preventDefault(); if (reply.disabled || (!replyRequest && !text.value.trim())) return
          reply.disabled = true; text.disabled = true; button.disabled = true; status.textContent = 'Sending reply…'
          try {
            if (!replyRequest) { const version = await send('collaboration-storage-version', { namespace: 'threads' }); replyRequest = { id: entry.dataset.thread, body: text.value.trim(), mutation: { expectedStorageVersion: version, idempotencyKey: replyKey } } }
            await send('collaboration-thread-reply', replyRequest, replyKey); delete form.dataset.dirty; button.disabled = false; button.click()
          } catch { status.textContent = 'Could not confirm the reply. Your text is preserved; retry the same request.'; reply.disabled = false; text.disabled = !!replyRequest; button.disabled = !!replyRequest }
        })
      }
      status.textContent = result.messages.length ? '' : 'No messages are available.'
    } catch { status.textContent = 'Conversation unavailable or access changed.' }
    finally { button.disabled = false }
  })
})
document.querySelectorAll('[data-case-question]').forEach((form) => {
  if (form.dataset.sfCaseQuestionReady) return; form.dataset.sfCaseQuestionReady = 'true'
  let context
  try { context = JSON.parse(form.dataset.context) } catch { return }
  const status = form.querySelector('[role=status]'), recipientsButton = form.querySelector('[data-find-recipients]')
  const select = form.elements.namedItem('recipient'), submit = form.querySelector('button[type=submit]')
  const names = ['source', 'recipient', 'question']
  let revoked = false, epoch = 0, busy = false, thread, pending, frozen, uncertain = false
  let createKey = crypto.randomUUID(), attachKey = crypto.randomUUID(), attachment
  const revoke = () => {
    if (revoked) return
    revoked = true; epoch++; context = undefined; pending = undefined; frozen = undefined; attachment = undefined; thread = undefined
    names.forEach((name) => {
      const input = form.elements.namedItem(name)
      if (!input) return
      input.value = ''
      if (input instanceof HTMLSelectElement) input.replaceChildren()
    })
    window.removeEventListener('sf-access-revoked', revoke)
    window.removeEventListener('pagehide', revoke)
    observer.disconnect()
    delete form.dataset.context; delete form.dataset.dirty
    form.replaceChildren(status); status.textContent = 'Question access changed. Reopen the decision with your current access.'
  }
  const restore = () => { if (frozen) names.forEach((name) => { const input = form.elements.namedItem(name); if (input) input.value = frozen[name] }) }
  const controls = () => {
    if (revoked) return
    form.querySelectorAll('input,select,textarea,button').forEach((control) => { control.disabled = busy || !!(thread || pending) && control !== submit })
    submit.textContent = thread ? 'Retry adding question' : pending ? 'Retry same question' : 'Create question'
  }
  const send = async (mode, payload, key = crypto.randomUUID()) => {
    const generation = epoch, controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) })
      if (revoked || generation !== epoch || !form.isConnected) throw new Error('cancelled')
      if (response.status === 401 || response.status === 403) {
        revoke()
        dispatchEvent(new CustomEvent('sf-access-revoked', { detail: { status: response.status } }))
        throw new Error('revoked')
      }
      const result = await response.json()
      if (revoked || generation !== epoch || !form.isConnected) throw new Error('cancelled')
      if (!response.ok || result?.status !== 'ok') { const error = new Error('unavailable'); error.status = response.status; error.result = result; throw error }
      return result.value
    } finally { clearTimeout(timer) }
  }
  recipientsButton.addEventListener('click', async () => {
    if (revoked || busy || pending || thread || recipientsButton.disabled) return
    recipientsButton.disabled = true; status.textContent = 'Finding recipients…'
    try {
      const items = await send('collaboration-recipients', {})
      if (!Array.isArray(items) || items.some((item) => typeof item?.id !== 'string' || typeof item?.name !== 'string')) throw new Error('invalid-recipients')
      if (revoked || pending || thread) return
      const selected = select.value
      select.replaceChildren()
      const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a recipient'; select.append(placeholder)
      items.forEach((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option) })
      if (items.some((item) => item.id === selected)) select.value = selected
      status.textContent = items.length ? 'Choose a recipient.' : 'No recipients are available.'
    } catch { if (!revoked) status.textContent = 'Recipients are temporarily unavailable. Your question and current selection are preserved; try again.' }
    finally { if (!revoked) recipientsButton.disabled = busy || !!(pending || thread) }
  })
  const edit = () => {
    if (revoked) return
    if (frozen) { restore(); return }
    createKey = crypto.randomUUID(); attachKey = crypto.randomUUID(); form.dataset.dirty = 'true'
  }
  form.addEventListener('input', edit); form.addEventListener('change', edit)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (revoked || busy || !pending && !thread && !form.reportValidity()) return
    if (!frozen) frozen = Object.fromEntries(names.map((name) => [name, form.elements.namedItem(name)?.value ?? '']))
    const source = context.sources[Number(frozen.source)]
    if (!pending && !thread && (!source || !frozen.recipient || !frozen.question.trim())) { frozen = undefined; status.textContent = 'Choose a record and recipient and enter a question.'; return }
    busy = true; controls(); status.textContent = thread ? 'Adding question to the decision…' : 'Creating question…'
    const wasUncertain = uncertain
    try {
      if (!thread) {
        if (!pending) {
          let version
          try { version = await send('collaboration-storage-version', { namespace: 'threads' }) }
          catch { if (!revoked) status.textContent = 'Could not prepare the question. Your entries are preserved; try again.'; frozen = undefined; return }
          if (!Number.isSafeInteger(version) || version < 0) { frozen = undefined; status.textContent = 'Could not prepare the question. Your entries are preserved; try again.'; return }
          pending = { key: createKey, body: JSON.stringify({ draft: { kind: 'clarification', sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
            observedVersion: source.target.version, period: context.period, recipientRef: frozen.recipient, evidenceRefs: [source], body: frozen.question.trim() },
            mutation: { expectedStorageVersion: version, idempotencyKey: createKey } }) }
        }
        uncertain = true
        const created = await send('collaboration-thread-create', pending.body, pending.key)
        if (typeof created?.id !== 'string' || !created.id) throw new Error('invalid-created-thread')
        thread = created.id
      }
      if (!attachment) attachment = JSON.stringify({ caseRef: context.caseRef, questionRef: thread })
      const attached = await send('decision-add-question', attachment, attachKey)
      if (!attached || typeof attached !== 'object') throw new Error('invalid-attachment')
      delete form.dataset.dirty; status.textContent = 'Question added to the decision.'; location.reload()
    } catch (error) {
      if (revoked) return
      if (!thread && !wasUncertain && [400, 422].includes(error.status) && ['needs-input', 'rejected'].includes(error.result?.status)) {
        pending = undefined; frozen = undefined; uncertain = false; createKey = crypto.randomUUID(); attachKey = crypto.randomUUID()
        status.textContent = 'The question request was rejected. Your entries are preserved; review the record and recipient before trying again.'
      } else status.textContent = thread ? 'The question exists but could not be added to this decision. Retry the same request.'
        : 'Could not confirm the question. Your text is preserved and locked; retry the same request.'
    } finally { busy = false; if (!revoked) { restore(); controls() } }
  })
  window.addEventListener('sf-access-revoked', revoke)
  window.addEventListener('pagehide', revoke)
  const observer = new MutationObserver(() => { if (!form.isConnected) revoke() })
  observer.observe(document.body, { childList: true, subtree: true })
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
