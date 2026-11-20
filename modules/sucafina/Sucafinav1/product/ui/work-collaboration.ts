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
  return `<section><h3>Question conversations</h3>${projection.case.questions.map((question) => `<article data-case-thread data-thread="${esc(question.id)}" data-scope="${esc(JSON.stringify(projection.context))}" data-case="${esc(JSON.stringify(caseRef))}" data-case-objective="${esc(projection.case.objective)}"${question.answerRef ? ` data-answer="${esc(question.answerRef)}"` : ""}><h4>${esc(question.text)}</h4><p>State: ${esc(question.state)}</p><button type="button" data-open-thread>Open conversation</button><div data-thread-messages></div><p role="status" aria-live="polite"></p></article>`).join("")}</section>`
}

export const caseQuestionScript = `
document.querySelectorAll('[data-case-thread]').forEach((entry) => {
  if (entry.dataset.sfThreadReady) return; entry.dataset.sfThreadReady = 'true'
  const button = entry.querySelector('[data-open-thread]')
  const output = entry.querySelector('[data-thread-messages]')
  const status = entry.querySelector('[role=status]')
  let caseRef, scope
  try { caseRef = JSON.parse(entry.dataset.case); scope = JSON.parse(entry.dataset.scope) } catch { return }
  const scopeKeys = ['installationId', 'projectId', 'principalRef', 'policyVersion', 'accessRevision']
  if (!scope || scopeKeys.some((key) => typeof scope[key] !== 'string' || !scope[key])) return
  if (!button || !output || !status || !caseRef) return
  const threadId = entry.dataset.thread
  const prefix = 'sf:recipient-reply:v1:'
  const storageKey = prefix + encodeURIComponent(JSON.stringify([scope, caseRef.id, caseRef.incarnation, threadId]))
  const clearPending = () => { try { sessionStorage.removeItem(storageKey) } catch {} }
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const canonical = (value) => value === undefined ? ['absent'] : value === null ? ['null'] :
    typeof value === 'string' || typeof value === 'boolean' ? [typeof value, value] :
    typeof value === 'number' && Number.isFinite(value) ? ['number', Object.is(value, -0) ? '-0' : value] :
    Array.isArray(value) ? ['array', value.map(canonical)] :
    value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))
      ? ['object', Object.keys(value).sort().map((key) => [key, canonical(value[key])])] : (() => { throw new Error('invalid-canonical-value') })()
  const digest = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(canonical(value)))))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const guard = document.createElement('form'); guard.hidden = true; entry.append(guard)
  const controllers = new Set()
  let revoked = false, busy = false, epoch = 0, text, reply, eligible = [], selectionStale = false
  let replyKey = crypto.randomUUID(), replyRequest, replyUncertain = false, replyConflict = false
  let confirmation, prepared, confirmed = false, confirmUncertain = false, attachment, attachUncertain = false, attachConflict = false
  let reviewReply, reviewCase, attachReviewed, reviewedCase, lastThread
  const live = (generation) => !revoked && entry.isConnected && generation === epoch
  const controls = () => {
    if (revoked) return
    button.disabled = busy || !!replyRequest && !!lastThread || !!confirmation || attachConflict
    if (text) text.disabled = busy || !!replyRequest || !!confirmation || attachConflict
    if (reply) {
      reply.disabled = busy || !!confirmation || replyConflict || attachConflict
      reply.textContent = replyRequest && !replyConflict ? 'Retry same reply' : 'Send reply'
    }
    eligible.forEach(({ element, allowed }) => { element.disabled = busy || !allowed || selectionStale || !!replyRequest || attachConflict })
    if (reviewReply) reviewReply.disabled = busy
    if (reviewCase) reviewCase.disabled = busy
    if (attachReviewed) attachReviewed.disabled = busy
  }
  const revoke = () => {
    clearPending()
    if (revoked) return
    revoked = true; epoch++
    controllers.forEach((controller) => controller.abort()); controllers.clear()
    replyRequest = undefined; confirmation = undefined; attachment = undefined; prepared = undefined; reviewedCase = undefined; caseRef = undefined
    text = undefined; reply = undefined; eligible = []
    for (const name of ['case', 'thread', 'answer', 'caseObjective', 'scope', 'caseSummary', 'principal', 'accessRevision', 'installation', 'project', 'policy']) delete entry.dataset[name]
    delete guard.dataset.dirty
    entry.replaceChildren(status)
    status.textContent = 'Conversation access changed. Reopen the decision with your current access.'
  }
  const request = async (mode, payload, key = crypto.randomUUID(), method = 'POST') => {
    const generation = epoch
    const controller = new AbortController(); controllers.add(controller)
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const url = new URL(location.href)
      if (method === 'POST') url.search = '?sf=' + mode
      const response = await fetch(url, { method, credentials: 'same-origin', signal: controller.signal,
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) } : {}) })
      if (!live(generation)) throw new Error('cancelled')
      if (response.status === 401 || response.status === 403) { revoke(); throw new Error('revoked') }
      if (method === 'GET') {
        const body = await response.text()
        if (!live(generation) || !response.ok) throw new Error('unavailable')
        return body
      }
      const result = await response.json()
      if (!live(generation)) throw new Error('cancelled')
      if (!response.ok || result?.status !== 'ok') {
        const failure = new Error('unavailable'); failure.status = response.status; failure.result = result; throw failure
      }
      return result.value
    } finally { clearTimeout(timer); controllers.delete(controller) }
  }
  const persist = () => {
    if (!replyRequest) return
    sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, scope, threadId, caseId: caseRef.id,
      caseIncarnation: caseRef.incarnation, request: replyRequest }))
  }
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      if (raw.length > 200_000) throw new Error('pending-too-large')
      const saved = JSON.parse(raw), candidate = saved.request, payload = candidate && JSON.parse(candidate.body)
      if (saved.version !== 1 || !equal(saved.scope, scope) || saved.threadId !== threadId ||
          saved.caseId !== caseRef.id || saved.caseIncarnation !== caseRef.incarnation ||
          typeof candidate?.key !== 'string' || !candidate.key || typeof candidate.draft !== 'string' ||
          payload?.id !== threadId || payload.body !== candidate.draft.trim() || payload.mutation?.idempotencyKey !== candidate.key ||
          !Number.isSafeInteger(payload.mutation?.expectedStorageVersion) || payload.mutation.expectedStorageVersion < 0 ||
          typeof candidate.recipient !== 'boolean' || !Array.isArray(candidate.before) ||
          candidate.before.some((message) => typeof message?.id !== 'string' || typeof message.incarnation !== 'string' || !Number.isSafeInteger(message.version)))
        throw new Error('pending-scope-changed')
      replyRequest = candidate; replyKey = candidate.key; replyUncertain = true
    }
  } catch { clearPending(); replyRequest = undefined }
  const currentScope = async () => {
    const html = await request('', undefined, undefined, 'GET')
    const document = new DOMParser().parseFromString(html, 'text/html')
    const current = [...document.querySelectorAll('[data-case-thread]')].find((node) => node.dataset.thread === threadId)
    let observed
    try { observed = JSON.parse(current?.dataset.scope) } catch {}
    if (!current || !equal(observed, scope)) { revoke(); throw new Error('scope-changed') }
  }
  const recipientAck = async (result, pending) => {
    const receipt = result?.mutationReceipt, payload = JSON.parse(pending.body)
    if (!receipt || receipt.kind !== 'recipient-thread-action-v1' || receipt.action !== 'reply' ||
        receipt.threadId !== threadId || receipt.principalRef !== scope.principalRef || receipt.idempotencyKey !== pending.key ||
        receipt.intentDigest !== await digest(payload) ||
        receipt.commandDigest !== await digest({ id: threadId, action: { kind: 'reply', body: payload.body } }) ||
        typeof receipt.sourceIncarnation !== 'string' || !receipt.sourceIncarnation ||
        !receipt.reply || pending.before.some((message) => message.id === receipt.reply.id)) return false
    const matches = result.messages.filter((message) => message.id === receipt.reply.id &&
      message.incarnation === receipt.reply.incarnation && message.version === receipt.reply.version)
    return matches.length === 1 && validMessage(matches[0]) && matches[0].authorRef === scope.principalRef &&
      matches[0].body === payload.body && matches[0].sourceContext?.sourceIncarnation === receipt.sourceIncarnation
  }
  const validVersion = (value) => Number.isSafeInteger(value) && value >= 0
  const validMessage = (message) => typeof message?.id === 'string' && !!message.id &&
    typeof message.incarnation === 'string' && !!message.incarnation && Number.isSafeInteger(message.version) && message.version >= 1 &&
    typeof message.authorRef === 'string' && !!message.authorRef && typeof message.body === 'string'
  const validThread = (value) => value && ['open', 'resolved'].includes(value.state) && Array.isArray(value.messages)
  const answerMatches = (answer) => answer && prepared && answer.answerRef === prepared.answerRef &&
    answer.answer === prepared.answer && answer.authorRef === prepared.authorRef && answer.observedVersion === prepared.observedSourceVersion
  const readAnswer = async () => {
    const answer = await request('collaboration-answer-read', { questionId: threadId })
    if (!answerMatches(answer)) throw new Error('answer-changed')
    return answer
  }
  const attach = async () => {
    const wasUncertain = attachUncertain
    attachUncertain = true
    try {
      const result = await request('decision-answer-question', attachment.body, attachment.key)
      if (!result?.caseRef || result.caseRef.id !== attachment.caseRef.id ||
          result.caseRef.incarnation !== attachment.caseRef.incarnation ||
          !Number.isSafeInteger(result.caseRef.version) || result.caseRef.version <= attachment.caseRef.version)
        throw new Error('unverifiable-attachment')
      delete guard.dataset.dirty
      status.textContent = 'Answer recorded in the decision.'
      location.reload()
    } catch (error) {
      if (!wasUncertain && error.status === 409 && error.result?.reason === 'case-changed') {
        attachUncertain = false; attachConflict = true
        status.textContent = 'The decision changed before the answer was attached. Review the current decision.'
        if (!reviewCase) {
          reviewCase = document.createElement('button'); reviewCase.type = 'button'; reviewCase.textContent = 'Review current decision'
          reviewCase.addEventListener('click', async () => {
            if (busy || revoked) return
            busy = true; controls()
            try {
              await readAnswer()
              const document = new DOMParser().parseFromString(await request('', undefined, undefined, 'GET'), 'text/html')
              const current = [...document.querySelectorAll('[data-case-thread]')].find((item) => item.dataset.thread === threadId)
              const next = current && JSON.parse(current.dataset.case)
              if (!next || next.id !== caseRef.id || next.incarnation !== caseRef.incarnation ||
                  !Number.isSafeInteger(next.version) || next.version <= caseRef.version || !current.dataset.caseObjective) throw new Error('unavailable')
              reviewedCase = next
              status.textContent = 'Current decision version ' + next.version + ': ' + current.dataset.caseObjective + '.'
              if (!attachReviewed) {
                attachReviewed = document.createElement('button'); attachReviewed.type = 'button'; attachReviewed.textContent = 'Attach confirmed answer to this version'
                attachReviewed.addEventListener('click', async () => {
                  if (busy || revoked || !reviewedCase) return
                  busy = true; controls()
                  try {
                    await readAnswer()
                    attachment = { caseRef: reviewedCase, key: crypto.randomUUID(), body: JSON.stringify({ caseRef: reviewedCase, questionId: threadId, answerRef: prepared.answerRef }) }
                    attachConflict = false; attachUncertain = false
                    await attach()
                  } catch { if (!revoked) status.textContent = 'Could not confirm the answer. Retry this same request.' }
                  finally { busy = false; controls() }
                })
                entry.append(attachReviewed)
              }
            } catch { if (!revoked) status.textContent = 'The current decision is unavailable. Review it again before attaching the answer.' }
            finally { busy = false; controls() }
          })
          entry.append(reviewCase)
        }
        return
      }
      throw error
    }
  }
  const confirmAnswer = async (message, complete, allowed) => {
    if (busy || revoked || !allowed || selectionStale || replyRequest || attachConflict) return
    if (!confirmation && text?.value.trim() && !window.confirm('Review this answer while preserving your unsent reply?')) return
    busy = true; controls(); status.textContent = 'Confirming answer…'
    try {
      if (!confirmation) {
        let value
        try {
          value = complete
            ? await request('collaboration-answer-prepare-message', { questionId: threadId, messageId: message.id, incarnation: message.incarnation, version: message.version })
            : await request('collaboration-answer-prepare', { questionId: threadId, answerRef: entry.dataset.answer })
        } catch (error) {
          if (error.status === 409 && error.result?.reason === 'answer-selection-changed') {
            selectionStale = true
            status.textContent = 'The selected answer changed. Reopen the conversation and review the current answer before confirming.'
            return
          }
          throw error
        }
        if (!value || typeof value.answerRef !== 'string' || !value.answerRef ||
            !complete && value.answerRef !== entry.dataset.answer || value.answer !== message.body || value.authorRef !== message.authorRef ||
            typeof value.observationRef !== 'string' || !value.observationRef || !validVersion(value.observedSourceVersion) ||
            typeof value.expectedScopeFingerprint !== 'string' || !value.expectedScopeFingerprint) throw new Error('invalid-preparation')
        const version = await request('collaboration-storage-version', { namespace: 'threads' })
        if (!validVersion(version)) throw new Error('invalid-version')
        prepared = value
        const key = crypto.randomUUID()
        confirmation = { key, body: JSON.stringify({ questionId: threadId, answerRef: value.answerRef, mutation: {
          expectedStorageVersion: version, idempotencyKey: key, observationRef: value.observationRef,
          observedSourceVersion: value.observedSourceVersion, expectedScopeFingerprint: value.expectedScopeFingerprint } }) }
        guard.dataset.dirty = 'true'
      }
      if (!confirmed) {
        const wasUncertain = confirmUncertain
        confirmUncertain = true
        try {
          const result = await request('collaboration-answer-confirm', confirmation.body, confirmation.key)
          if (result?.answerRef !== prepared.answerRef || result.observedVersion !== prepared.observedSourceVersion) throw new Error('invalid-confirmation')
          confirmed = true
        } catch (error) {
          if (!wasUncertain && error.status === 409 && error.result?.reason === 'product-state-changed') {
            confirmation = undefined; prepared = undefined; confirmUncertain = false
            status.textContent = 'The answer confirmation was not saved because the conversation changed. Review this answer, then confirm again.'
            return
          }
          throw error
        }
      }
      if (!attachment) {
        await readAnswer()
        attachment = { caseRef, key: crypto.randomUUID(), body: JSON.stringify({ caseRef, questionId: threadId, answerRef: prepared.answerRef }) }
      }
      await attach()
    } catch { if (!revoked) status.textContent = 'Could not confirm the answer. Retry this same request.' }
    finally { busy = false; controls() }
  }
  const render = (result, draft = '') => {
    lastThread = result
    output.replaceChildren(); eligible = []; text = undefined; reply = undefined
    const candidates = result.messages.flatMap((message, index) => index > 0 && result.recipientRef && message.authorRef === result.recipientRef && typeof message.id === 'string' ? [index] : [])
    const latest = candidates.at(-1)
    result.messages.forEach((message, index) => {
      const item = document.createElement('div'); const paragraph = document.createElement('p')
      paragraph.textContent = typeof message.body === 'string' ? message.body : 'Message unavailable'
      item.append(paragraph); output.append(item)
      if (!candidates.includes(index)) return
      const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = 'Confirm this answer and add to decision'; item.append(confirm)
      const complete = validMessage(message)
      const allowed = index === latest && (complete || !!entry.dataset.answer)
      eligible.push({ element: confirm, allowed })
      confirm.addEventListener('click', () => confirmAnswer(message, complete, allowed))
    })
    if (result.state === 'open' || replyRequest) {
      const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reply'
      text = document.createElement('textarea'); text.required = true; text.value = replyRequest ? replyRequest.draft : draft; label.append(text)
      reply = document.createElement('button'); reply.type = 'submit'; reply.textContent = 'Send reply'; form.append(label, reply); output.append(form)
      if (draft) form.dataset.dirty = 'true'
      const currentText = text
      text.addEventListener('input', () => {
        if (replyRequest) { currentText.value = replyRequest.draft; return }
        if (busy || confirmation) return
        replyKey = crypto.randomUUID()
        if (currentText.value.trim()) form.dataset.dirty = 'true'; else delete form.dataset.dirty
      })
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        if (busy || revoked || replyConflict || confirmation || !replyRequest && !currentText.value.trim()) return
        busy = true; controls(); status.textContent = 'Sending reply…'
        const wasUncertain = replyUncertain, generation = epoch
        try {
          if (replyRequest) await currentScope()
          if (!replyRequest) {
            const draft = currentText.value
            const version = await request('collaboration-storage-version', { namespace: 'threads' })
            if (!validVersion(version)) throw new Error('invalid-version')
            replyRequest = { key: replyKey, draft, recipient: !!(lastThread?.current && lastThread?.observed), before: (lastThread?.messages ?? []).filter(validMessage).map(({ id, incarnation, version }) => ({ id, incarnation, version })), body: JSON.stringify({ id: threadId, body: draft.trim(), mutation: { expectedStorageVersion: version, idempotencyKey: replyKey } }) }
          }
          persist()
          replyUncertain = true
          const result = await request('collaboration-thread-reply', replyRequest.body, replyRequest.key)
          const message = result?.messages?.at(-1)
          if (!validThread(result) || result.id !== threadId ||
              (replyRequest.recipient ? !await recipientAck(result, replyRequest) :
                !validMessage(message) || message.body !== JSON.parse(replyRequest.body).body))
            throw new Error('invalid-reply-acknowledgement')
          if (!live(generation)) return
          clearPending()
          replyRequest = undefined; replyUncertain = false; replyKey = crypto.randomUUID(); selectionStale = false
          delete form.dataset.dirty; delete guard.dataset.dirty
          render(result); status.textContent = ''
        } catch (error) {
          if (revoked) return
          if (replyRequest && !wasUncertain && error.status === 409 && error.result?.reason === 'product-state-changed') {
            clearPending(); replyConflict = true; replyUncertain = false
            status.textContent = 'The reply was not sent because the conversation changed. Review the current conversation; your text is preserved.'
            if (!reviewReply) {
              reviewReply = document.createElement('button'); reviewReply.type = 'button'; reviewReply.textContent = 'Review changed conversation'
              reviewReply.addEventListener('click', () => refresh(true)); entry.append(reviewReply)
            }
          } else status.textContent = 'Could not confirm the reply. Your text is preserved; retry the same request.'
        } finally { busy = false; controls() }
      })
    }
    controls()
  }
  const refresh = async (review = false) => {
    if (busy || revoked || !review && (confirmation || replyRequest && lastThread)) return
    const draft = text?.value ?? ''
    if (!review && draft.trim() && !window.confirm('Refresh the conversation and discard this unsent reply if it loads?')) return
    busy = true; controls(); status.textContent = 'Opening conversation…'
    try {
      const result = await request('collaboration-thread-read', { id: threadId })
      if (!validThread(result)) throw new Error('invalid-thread')
      if (review) { clearPending(); replyRequest = undefined; replyConflict = false; replyUncertain = false; replyKey = crypto.randomUUID(); reviewReply?.remove(); reviewReply = undefined }
      selectionStale = false; render(result, review ? draft : '')
      status.textContent = review ? 'Conversation updated. Review your preserved reply before sending it.'
        : eligible.length && !eligible.some((value) => value.allowed) ? 'Answer confirmation needs an authorized current message. Reopen the conversation; you can still send a reply.'
        : result.messages.length ? '' : 'No messages are available.'
    } catch { if (!revoked) status.textContent = 'Conversation unavailable. Your unsent reply is preserved.' }
    finally { busy = false; controls() }
  }
  button.addEventListener('click', () => refresh())
  window.addEventListener('sf-access-revoked', revoke)
  window.addEventListener('pagehide', () => {
    if (revoked) return
    revoked = true; epoch++; controllers.forEach((controller) => controller.abort()); controllers.clear()
    output.replaceChildren(); entry.hidden = true
    for (const name of ['case', 'thread', 'answer', 'caseObjective', 'scope']) delete entry.dataset[name]
    entry.querySelector('h4')?.remove()
    text = undefined; reply = undefined; lastThread = undefined; scope = undefined; caseRef = undefined
    replyRequest = undefined; confirmation = undefined; attachment = undefined; prepared = undefined
  })
  window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload() })
  const observer = new MutationObserver(() => { if (!entry.isConnected) { observer.disconnect(); revoke() } })
  observer.observe(document.body, { childList: true, subtree: true })
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
      if (response.status === 401 || response.status === 403) { revoke(); throw new Error('revoked') }
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
  const observer = new MutationObserver(() => { if (!form.isConnected) { observer.disconnect(); revoke() } })
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
