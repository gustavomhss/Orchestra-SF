import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

export function caseQuestionForm(projection: AuthorizedCaseProjection) {
  const sources = projection.case.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && !!ref.target.period && ref.target.period.start <= projection.case.horizon.start && ref.target.period.end >= projection.case.horizon.end)
  if (!sources.length) return "<p>A question needs an accessible record covering the decision period.</p>"
  const context = { caseRef: { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }, period: projection.case.horizon, sources }
  // Option text changes with authorized results; it must not become label text.
  const formId = `case-question-${crypto.randomUUID()}`
  return `<section><h3>Ask a question</h3><form data-case-question data-context="${esc(JSON.stringify(context))}"><div><label for="${formId}-source">Record</label><select id="${formId}-source" name="source">${sources.map((source, index) => `<option value="${index}">${esc(source.target.recordType)} · ${esc(source.target.surface)}</option>`).join("")}</select></div><button type="button" data-find-recipients>Find recipients</button><div><label for="${formId}-recipient">Recipient</label><select id="${formId}-recipient" name="recipient" required><option value="">Choose a recipient</option></select></div><label>Question<textarea name="question" required></textarea></label><button type="submit">Create question</button><p role="status" aria-live="polite"></p></form></section>`
}

export function caseQuestionThreads(projection: AuthorizedCaseProjection) {
  if (!projection.case.questions.length) return ""
  const caseRef = { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }
  const summary = { objective: projection.case.objective, horizon: projection.case.horizon, currency: projection.case.currency }
  return `<section><h3>Question conversations</h3>${projection.case.questions.map((question) => `<article data-case-thread data-thread="${esc(question.id)}" data-case="${esc(JSON.stringify(caseRef))}" data-case-summary="${esc(JSON.stringify(summary))}" data-access-revision="${esc(projection.context.accessRevision)}" data-principal="${esc(projection.context.principalRef)}" data-question-state="${esc(question.state)}"${question.answerRef ? ` data-answer="${esc(question.answerRef)}"` : ""}><h4>${esc(question.text)}</h4><p>State: ${esc(question.state)}</p><button type="button" data-open-thread>Open conversation</button><div data-thread-messages></div><p role="status" aria-live="polite"></p></article>`).join("")}</section>`
}

export const caseQuestionScript = `
document.querySelectorAll('[data-case-thread]').forEach((entry) => {
  if (entry.dataset.sfThreadReady) return; entry.dataset.sfThreadReady = 'true'
  const button = entry.querySelector('[data-open-thread]'); const output = entry.querySelector('[data-thread-messages]'); const status = entry.querySelector('[role=status]')
  let caseRef = JSON.parse(entry.dataset.case); let threadRef = entry.dataset.thread; let answerRef = entry.dataset.answer; let questionState = entry.dataset.questionState; let principalRef = entry.dataset.principal
  const guard = document.createElement('form'); guard.hidden = true; entry.append(guard)
  let pending; let attachment; let replyRequest; let confirmed = false; let replyPending = false; let replyReview = false; let busy = false; let accessRevoked = false; let epoch = 0; let confirmKey = crypto.randomUUID(); let attachKey = crypto.randomUUID()
  const controllers = new Set()
  const active = () => !accessRevoked && entry.isConnected
  const revoke = () => {
    if (!active()) return
    accessRevoked = true; epoch++; controllers.forEach((controller) => controller.abort()); controllers.clear()
    pending = attachment = replyRequest = caseRef = threadRef = answerRef = questionState = principalRef = confirmKey = attachKey = undefined
    confirmed = false; replyPending = false; replyReview = false; delete guard.dataset.dirty; delete entry.dataset.case; delete entry.dataset.caseSummary; delete entry.dataset.accessRevision; delete entry.dataset.thread; delete entry.dataset.answer; delete entry.dataset.questionState; delete entry.dataset.principal
    output.replaceChildren(); button.disabled = true; entry.replaceChildren(status)
    status.textContent = 'Conversation access changed. Reopen the decision with your current access.'
  }
  addEventListener('sf-access-revoked', revoke)
  const send = async (mode, payload, key = crypto.randomUUID(), body = JSON.stringify(payload)) => {
    if (!active()) throw Object.assign(new Error('closed'), { ignored: true })
    const ticket = epoch; const controller = new AbortController(); controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body, signal: controller.signal })
      if (!active() || ticket !== epoch) throw Object.assign(new Error('closed'), { ignored: true })
      if (response.status === 401 || response.status === 403) { revoke(); throw Object.assign(new Error('access-changed'), { ignored: true }) }
      // Keep the deadline active through body consumption, not only until headers arrive.
      const result = await response.json()
      if (!active() || ticket !== epoch) throw Object.assign(new Error('closed'), { ignored: true })
      if (controller.signal.aborted || !response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { beforeCommitConflict: !controller.signal.aborted && response.status === 409 && ['conflict', 'stale'].includes(result.status) && result.reason === 'product-state-changed', selectionChanged: !controller.signal.aborted && response.status === 409 && result.status === 'stale' && result.reason === 'answer-selection-changed', beforeAttachmentCommit: !controller.signal.aborted && mode === 'decision-answer-question' && response.status === 409 && result.status === 'stale' && result.reason === 'case-changed' })
      return result.value
    } finally { clearTimeout(timeout); controllers.delete(controller) }
  }
  const readAttachmentCase = async () => {
    if (!active() || !confirmed || !pending || !attachment?.rejected || attachment.uncertain) throw new Error('unavailable')
    const ticket = epoch; const controller = new AbortController(); controllers.add(controller); const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      if (!active() || ticket !== epoch) throw Object.assign(new Error('closed'), { ignored: true })
      if (response.status === 401 || response.status === 403) { revoke(); throw Object.assign(new Error('access-changed'), { ignored: true }) }
      if (!response.ok) throw new Error('unavailable')
      const html = await response.text()
      if (!active() || ticket !== epoch) throw Object.assign(new Error('closed'), { ignored: true })
      if (controller.signal.aborted) throw new Error('unavailable')
      const page = new DOMParser().parseFromString(html, 'text/html')
      const previousRevision = document.querySelector('meta[name="sf-access-revision"]')?.content
      const nextRevision = response.headers.get('X-SF-Access-Revision') || page.querySelector('meta[name="sf-access-revision"]')?.content
      if (page.body.dataset.surface === 'signed-out' || page.querySelector('main[data-drawn="false"]') || previousRevision && previousRevision !== nextRevision) { revoke(); throw Object.assign(new Error('access-changed'), { ignored: true }) }
      const candidates = [...page.querySelectorAll('[data-case-thread]')].filter((item) => { try { const ref = JSON.parse(item.dataset.case); return item.dataset.thread === threadRef && ref.id === caseRef.id && ref.incarnation === caseRef.incarnation } catch { return false } })
      if (candidates.length !== 1) throw new Error('unavailable')
      const candidate = candidates[0]
      if (candidate.dataset.principal !== principalRef || candidate.dataset.accessRevision !== entry.dataset.accessRevision) { revoke(); throw Object.assign(new Error('access-changed'), { ignored: true }) }
      const currentRef = JSON.parse(candidate.dataset.case), summary = JSON.parse(candidate.dataset.caseSummary), question = candidate.querySelector('h4')?.textContent
      if (candidate.dataset.questionState !== 'open' || !Number.isSafeInteger(currentRef.version) || currentRef.version <= caseRef.version || typeof summary.objective !== 'string' || !summary.objective.trim() || typeof summary.currency !== 'string' || typeof summary.horizon?.start !== 'string' || typeof summary.horizon?.end !== 'string' || typeof question !== 'string' || !question.trim()) throw new Error('unavailable')
      const answer = await send('collaboration-answer-read', { questionId: threadRef })
      if (!active() || ticket !== epoch) throw Object.assign(new Error('closed'), { ignored: true })
      if (controller.signal.aborted || answer?.answerRef !== pending.answerRef || answer.answer !== pending.answer || answer.authorRef !== pending.authorRef || answer.observedVersion !== pending.observedSourceVersion) throw new Error('unavailable')
      return { caseRef: currentRef, summary, question, signature: JSON.stringify({ caseRef: currentRef, summary, question }) }
    } finally { clearTimeout(timeout); controllers.delete(controller) }
  }
  button.addEventListener('click', async () => {
    if (!active() || button.disabled || busy) return
    if (pending || replyPending) { status.textContent = 'Resolve the pending request before reopening this conversation.'; return }
    const reviewingReply = replyReview; const preservedReply = reviewingReply ? output.querySelector('textarea')?.value : undefined
    if (!reviewingReply && output.querySelector('form[data-dirty]') && !confirm('Discard your unsent reply and reload this conversation?')) return
    const controls = [...output.querySelectorAll('input,select,textarea,button')].map((control) => ({ control, disabled: control.disabled }))
    busy = true; controls.forEach(({ control }) => { control.disabled = true }); button.disabled = true; status.textContent = 'Opening conversation…'
    try {
      const result = await send('collaboration-thread-read', { id: threadRef })
      if (!Array.isArray(result?.messages)) throw new Error('unavailable')
      if (reviewingReply && result.state !== 'open') throw new Error('unavailable')
      const latestAnswer = result.messages.findLast((message, index) => index > 0 && result.recipientRef && message.authorRef === result.recipientRef && typeof message.id === 'string')
      replyReview = false; button.textContent = 'Open conversation'
      output.replaceChildren()
      result.messages.forEach((message, index) => {
        const item = document.createElement('div'); const paragraph = document.createElement('p'); paragraph.textContent = typeof message.body === 'string' ? message.body : 'Message unavailable'; item.append(paragraph); output.append(item)
        if (index === 0 || !result.recipientRef || message.authorRef !== result.recipientRef || typeof message.id !== 'string') return
        const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = 'Confirm this answer and add to decision'; item.append(confirm)
        // The server issues the opaque answer selector from the exact message
        // selected in this authorized read. Existing selectors remain opaque.
        const publishedAnswer = typeof answerRef === 'string' && !!answerRef.trim()
        const selection = typeof message.incarnation === 'string' && message.incarnation.trim() && Number.isSafeInteger(message.version) && message.version > 0 ? { questionId: threadRef, messageId: message.id, incarnation: message.incarnation, version: message.version } : undefined
        const unavailable = questionState === 'answered' ? 'This answer is already recorded in the decision.' : message !== latestAnswer ? 'Only the most recent recipient answer can be confirmed.' : questionState !== 'open' || (!publishedAnswer && !selection) ? 'Answer confirmation needs an authorized current message. Reopen the conversation; you can still send a reply.' : undefined
        if (unavailable) { confirm.disabled = true; const reason = document.createElement('p'); reason.textContent = unavailable; item.append(reason) }
        const showAttachmentReview = (current) => {
          item.querySelector('[data-answer-attachment-review]')?.remove()
          const panel = document.createElement('div'); panel.dataset.answerAttachmentReview = 'true'; item.append(panel)
          const text = document.createElement('p'); text.textContent = current ? 'Current decision version ' + current.caseRef.version + ': ' + current.summary.objective + '. ' + current.summary.horizon.start + ' – ' + current.summary.horizon.end + ', ' + current.summary.currency + '. Question: ' + current.question + '. Confirmed answer: ' + pending.answer : 'The answer is confirmed, but the decision changed before it was attached. Review the current decision before trying a new attachment.'; panel.append(text)
          const review = document.createElement('button'); review.type = 'button'; review.textContent = current ? 'Attach confirmed answer to this version' : 'Review current decision'; panel.append(review)
          review.addEventListener('click', async () => {
            if (!active() || busy || !attachment?.rejected || attachment.uncertain) return
            busy = true; review.disabled = true; status.textContent = 'Checking the current decision and confirmed answer…'
            let submit = false
            try {
              const fresh = await readAttachmentCase()
              if (!current || fresh.signature !== current.signature) { showAttachmentReview(fresh); status.textContent = 'Review the current decision before attaching this confirmed answer.'; return }
              caseRef = fresh.caseRef; entry.dataset.case = JSON.stringify(caseRef); entry.dataset.caseSummary = JSON.stringify(fresh.summary)
              attachKey = crypto.randomUUID(); attachment = { key: attachKey, body: JSON.stringify({ caseRef, questionId: threadRef, answerRef: pending.answerRef }) }
              panel.remove(); confirm.disabled = false; submit = true
            } catch (error) { if (active() && !error?.ignored) status.textContent = 'The current decision or confirmed answer could not be verified. No new attachment was sent; retry the review.' }
            finally { busy = false; if (active() && review.isConnected) review.disabled = false; if (submit && active()) confirm.click() }
          })
        }
        confirm.addEventListener('click', async () => {
          if (!active() || confirm.disabled || unavailable || busy || replyPending) return
          if (output.querySelector('form[data-dirty]') && !window.confirm('Discard your unsent reply and confirm this answer?')) return
          const previous = [...output.querySelectorAll('button,textarea')].map((control) => ({ control, disabled: control.disabled }))
          busy = true; confirm.disabled = true; button.disabled = true; output.querySelectorAll('button,textarea').forEach((other) => { other.disabled = true }); status.textContent = 'Confirming answer…'
          try {
            if (!pending) {
              const prepared = publishedAnswer ? await send('collaboration-answer-prepare', { questionId: threadRef, answerRef }) : await send('collaboration-answer-prepare-message', selection)
              if (typeof prepared?.answerRef !== 'string' || !prepared.answerRef.trim() || (publishedAnswer && prepared.answerRef !== answerRef) || prepared.answer !== message.body || prepared.authorRef !== message.authorRef || typeof prepared.observationRef !== 'string' || !prepared.observationRef.trim() || !Number.isSafeInteger(prepared.observedSourceVersion) || prepared.observedSourceVersion < 1 || typeof prepared.expectedScopeFingerprint !== 'string' || !prepared.expectedScopeFingerprint.trim()) throw new Error('unavailable')
              const version = await send('collaboration-storage-version', { namespace: 'threads' })
              if (!Number.isSafeInteger(version) || version < 0) throw new Error('unavailable')
              pending = { key: confirmKey, answerRef: prepared.answerRef, answer: prepared.answer, authorRef: prepared.authorRef, observedSourceVersion: prepared.observedSourceVersion, body: JSON.stringify({ questionId: threadRef, answerRef: prepared.answerRef, mutation: { expectedStorageVersion: version, idempotencyKey: confirmKey, observationRef: prepared.observationRef, observedSourceVersion: prepared.observedSourceVersion, expectedScopeFingerprint: prepared.expectedScopeFingerprint } }) }; guard.dataset.dirty = 'true'
            }
            if (!confirmed) { const receipt = await send('collaboration-answer-confirm', undefined, pending.key, pending.body); if (receipt?.answerRef !== pending.answerRef || receipt.observedVersion !== pending.observedSourceVersion) throw new Error('unavailable'); confirmed = true }
            if (!attachment) { const answer = await send('collaboration-answer-read', { questionId: threadRef }); if (answer?.answerRef !== pending.answerRef || answer.answer !== pending.answer || answer.authorRef !== pending.authorRef || answer.observedVersion !== pending.observedSourceVersion) throw new Error('unavailable'); attachment = { key: attachKey, body: JSON.stringify({ caseRef, questionId: threadRef, answerRef: answer.answerRef }) } }
            const recorded = await send('decision-answer-question', undefined, attachment.key, attachment.body)
            if (recorded?.caseRef?.id !== caseRef.id || recorded.caseRef.incarnation !== caseRef.incarnation || !Number.isSafeInteger(recorded.caseRef.version) || recorded.caseRef.version <= caseRef.version) throw new Error('unavailable')
            delete guard.dataset.dirty; status.textContent = 'Answer recorded in the decision.'; location.reload()
          } catch (error) {
            if (!active() || error?.ignored) return
            if (confirmed && attachment && !attachment.uncertain && error?.beforeAttachmentCommit) { attachment.rejected = true; showAttachmentReview(); status.textContent = 'The decision changed before the answer was attached. Review the current decision.' }
            else if (!pending && error?.selectionChanged) status.textContent = 'The selected answer changed. Reopen the conversation and review the current answer before confirming.'
            else if (pending && !pending.uncertain && !confirmed && error?.beforeCommitConflict) { pending = undefined; confirmKey = crypto.randomUUID(); delete guard.dataset.dirty; status.textContent = 'The answer confirmation was not saved because the conversation changed. Review this answer, then confirm again.' }
            else { if (pending && !confirmed) pending.uncertain = true; if (confirmed && attachment) attachment.uncertain = true; status.textContent = 'Could not confirm the answer. Retry this same request.' }
            if (!pending) { previous.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled }); button.disabled = false }
            confirm.disabled = !!attachment?.rejected || !pending && !!error?.selectionChanged
          }
          finally { busy = false }
        })
      })
      if (result.state === 'open') {
        const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reply'; const text = document.createElement('textarea'); text.required = true; label.append(text); const reply = document.createElement('button'); reply.type = 'submit'; reply.textContent = 'Send reply'; form.append(label, reply); output.append(form)
        let replyKey = crypto.randomUUID(); replyRequest = undefined
        if (reviewingReply && typeof preservedReply === 'string') { text.value = preservedReply; form.dataset.dirty = 'true' }
        text.addEventListener('input', () => { if (!replyRequest) { replyKey = crypto.randomUUID(); form.dataset.dirty = 'true' } })
        form.addEventListener('submit', async (event) => {
          event.preventDefault(); if (!active() || reply.disabled || busy || pending || replyReview || (!replyRequest && !text.value.trim())) return
          let reopen = false
          const previous = [...output.querySelectorAll('button,textarea')].map((control) => ({ control, disabled: control.disabled }))
          busy = true; replyPending = true; reply.disabled = true; text.disabled = true; button.disabled = true; output.querySelectorAll('button').forEach((other) => { other.disabled = true }); status.textContent = 'Sending reply…'
          try {
            if (!replyRequest) { const version = await send('collaboration-storage-version', { namespace: 'threads' }); if (!Number.isSafeInteger(version) || version < 0) throw new Error('unavailable'); replyRequest = { key: replyKey, text: text.value.trim(), messageIds: result.messages.map((message) => message.id), messageIncarnations: result.messages.map((message) => message.incarnation), body: JSON.stringify({ id: threadRef, body: text.value.trim(), mutation: { expectedStorageVersion: version, idempotencyKey: replyKey } }) }; replyPending = true }
            const sent = await send('collaboration-thread-reply', undefined, replyRequest.key, replyRequest.body)
            if (sent?.id !== threadRef || !Array.isArray(sent.messages) || sent.messages.length <= replyRequest.messageIds.length || replyRequest.messageIds.some((id, index) => sent.messages[index]?.id !== id)) throw new Error('unavailable')
            // Recipient replies may return a newer thread after this write. Select
            // one matching new message; ordering or identical wording is not identity.
            const matches = sent.messages.slice(replyRequest.messageIds.length).filter((message) => typeof message?.id === 'string' && message.id.trim() && !replyRequest.messageIds.includes(message.id) && typeof message.incarnation === 'string' && message.incarnation.trim() && !replyRequest.messageIncarnations.includes(message.incarnation) && Number.isSafeInteger(message.version) && message.version >= 1 && typeof message.authorRef === 'string' && message.authorRef.trim() && (!principalRef || message.authorRef === principalRef) && message.body === replyRequest.text)
            if (matches.length !== 1) throw new Error('unavailable')
            replyPending = false; replyRequest = undefined; delete form.dataset.dirty; reopen = true
          } catch (error) {
            if (!active() || error?.ignored) return
            if (replyRequest && !replyRequest.uncertain && error?.beforeCommitConflict) { replyRequest = undefined; replyPending = false; replyReview = true; button.textContent = 'Review changed conversation'; button.disabled = false; status.textContent = 'The reply was not sent because the conversation changed. Review the current conversation; your text is preserved.'; return }
            if (replyRequest) replyRequest.uncertain = true
            replyPending = !!replyRequest; status.textContent = 'Could not confirm the reply. Your text is preserved; retry the same request.'
            if (!replyRequest) previous.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled })
            reply.disabled = false; text.disabled = !!replyRequest; button.disabled = !!replyRequest
          }
          finally { busy = false; if (reopen && active()) { button.disabled = false; button.click() } }
        })
      }
      status.textContent = reviewingReply ? 'Conversation updated. Review your preserved reply before sending it.' : result.messages.length ? '' : 'No messages are available.'
    } catch (error) { if (!active() || error?.ignored) return; status.textContent = 'Conversation unavailable. Your unsent reply is preserved.'; controls.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled }) }
    finally { busy = false; if (active()) button.disabled = !!pending || replyPending }
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
      const items = await send('collaboration-recipients', {}, crypto.randomUUID())
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
document.querySelectorAll('[data-work-list]').forEach((list) => {
  if (list.dataset.sfWorkReady) return; list.dataset.sfWorkReady = 'true'
  let closed = false; let epoch = 0
  const controllers = new Set(); const active = () => !closed && list.isConnected
  const close = (message) => {
    if (closed) return
    closed = true; epoch++; controllers.forEach((controller) => controller.abort()); controllers.clear()
    list.querySelectorAll('[data-work-destination]').forEach((button) => { button.disabled = true; delete button.dataset.selection; delete button.dataset.actionRef; delete button.dataset.mount })
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = message; list.replaceChildren(status)
    removeEventListener('sf-access-revoked', revoke); observer.disconnect()
  }
  const revoke = () => close('Work access changed. Reopen the application with your current access.')
  const observer = new MutationObserver(() => { if (!list.isConnected) close('') }); observer.observe(document.body, { childList: true, subtree: true })
  addEventListener('sf-access-revoked', revoke)
  list.querySelectorAll('[data-work-destination]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!active() || button.disabled) return
      const ticket = epoch, status = button.parentElement.querySelector('[role=status]'), controller = new AbortController()
      controllers.add(controller); const timeout = setTimeout(() => controller.abort(), 10000)
      button.disabled = true; status.textContent = 'Opening work…'
      try {
        const url = new URL(location.href); url.search = '?sf=collaboration-work-destination'
        const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ selection: JSON.parse(button.dataset.selection), actionRef: button.dataset.actionRef }), signal: controller.signal })
        if (!active()) return
        if (response.status === 401 || response.status === 403) { revoke(); dispatchEvent(new CustomEvent('sf-access-revoked')); return }
        const result = await response.json()
        if (!active() || ticket !== epoch) return
        if (!response.ok || result.status !== 'ok' || typeof result.value?.href !== 'string') throw new Error('unavailable')
        const destination = new URL(result.value.href, location.href)
        if (destination.origin !== location.origin || (destination.pathname !== button.dataset.mount && !destination.pathname.startsWith(button.dataset.mount + '/'))) throw new Error('unavailable')
        location.assign(destination.href)
      } catch { if (active() && ticket === epoch) { status.textContent = 'This work is temporarily unavailable. Your current list is preserved; try again.'; button.disabled = false } }
      finally { clearTimeout(timeout); controllers.delete(controller) }
    })
  })
})
`

