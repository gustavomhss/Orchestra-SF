import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** The server supplied the case and its current version; the domain validates every edit. */
export function decisionEditForm(projection: AuthorizedCaseProjection) {
  const item = projection.case
  const context = { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, sourceRefs: item.sourceRefs,
    criteria: item.criteria.map((criterion) => ({ id: criterion.id, required: criterion.required })) }
  return `<details><summary>Edit decision</summary><form data-decision-edit data-context="${esc(JSON.stringify(context))}"><label>Decision objective<input name="objective" required value="${esc(item.objective)}"></label><label>Start<input name="start" type="date" required value="${esc(item.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(item.horizon.end)}"></label><label>Currency<input name="currency" required value="${esc(item.currency)}"></label>${item.criteria.map((criterion, index) => `<label>Criterion ${index + 1}<input name="criterion-${index}" required value="${esc(criterion.description)}"></label>`).join("")}<button>Save decision</button><p role="status" aria-live="polite"></p></form></details>`
}

export const decisionEditScript = `
document.querySelectorAll('[data-decision-edit]').forEach((form) => {
  if (form.dataset.sfEditReady) return; form.dataset.sfEditReady = 'true'
  let context = JSON.parse(form.dataset.context)
  const status = form.querySelector('[role=status]'); const button = form.querySelector('button'); const inputs = [...form.querySelectorAll('input')]
  const disabled = new Map(inputs.map((input) => [input, input.disabled]))
  let intention; let conflictAttempt; let busy = false; let closed = false; let completed = false
  const active = () => !closed && form.isConnected
  const revoke = () => {
    closed = true; context = undefined
    if (intention) { intention.body = ''; intention.values = [] }; intention = undefined
    if (conflictAttempt) { conflictAttempt.body = ''; conflictAttempt.values = [] }; conflictAttempt = undefined
    inputs.forEach((input) => { input.value = ''; input.defaultValue = ''; input.removeAttribute('value'); input.disabled = true }); disabled.clear()
    button.disabled = true; delete form.dataset.context; delete form.dataset.dirty
    form.replaceChildren(status); status.textContent = 'Your access changed. Reload before editing this decision.'
  }
  addEventListener('sf-access-revoked', () => { if (form.isConnected) revoke() })
  form.addEventListener('input', () => {
    if (!active()) return
    if (intention) { intention.values.forEach(([input, value]) => { input.value = value }); return }
    form.dataset.dirty = 'true'
  })
  const conflict = async (attempt) => {
    conflictAttempt = attempt
    status.textContent = 'The decision changed or its basis is in use. Your entries and the version you opened are preserved.'
    try {
      const response = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!active()) return
      if (response.status === 401 || response.status === 403) { revoke(); return }
      if (!response.ok) throw new Error('unavailable')
      const html = await response.text(); if (!active()) return
      const page = new DOMParser().parseFromString(html, 'text/html')
      const previousRevision = document.querySelector('meta[name="sf-access-revision"]')?.content
      const nextRevision = response.headers.get('X-SF-Access-Revision') || page.querySelector('meta[name="sf-access-revision"]')?.content
      if (page.body.dataset.surface === 'signed-out' || page.querySelector('main[data-drawn="false"]') || previousRevision && nextRevision && previousRevision !== nextRevision) { revoke(); return }
      const current = [...page.querySelectorAll('[data-decision-edit]')].find((candidate) => { try { const ref = JSON.parse(candidate.dataset.context).caseRef; return ref.id === context.caseRef.id && ref.incarnation === context.caseRef.incarnation } catch { return false } })
      if (!current) throw new Error('unavailable')
      const fields = new Map(attempt.values.map(([input, value]) => [input.name, value]))
      form.querySelector('[data-decision-conflict]')?.remove()
      const comparison = document.createElement('div'); comparison.dataset.decisionConflict = 'true'
      const title = document.createElement('p'); title.textContent = 'Current values and your entries:'; comparison.append(title)
      ;[['objective', 'Objective'], ['start', 'Start'], ['end', 'End'], ['currency', 'Currency']].forEach(([name, label]) => {
        const detail = document.createElement('p'); detail.textContent = label + ': current ' + (current.elements.namedItem(name)?.value ?? 'unavailable') + '; yours ' + String(fields.get(name) || ''); comparison.append(detail)
      })
      const currentContext = JSON.parse(current.dataset.context)
      context.criteria.forEach((item, index) => {
        const currentIndex = currentContext.criteria.findIndex((criterion) => criterion.id === item.id)
        const detail = document.createElement('p'); detail.textContent = 'Criterion ' + (index + 1) + ': current ' + (currentIndex < 0 ? 'unavailable' : current.elements.namedItem('criterion-' + currentIndex)?.value ?? 'unavailable') + '; yours ' + String(fields.get('criterion-' + index) || ''); comparison.append(detail)
      })
      if (active()) form.append(comparison)
    } catch { if (active()) status.textContent += ' Current values are unavailable; your entries remain here.' }
    finally { if (conflictAttempt === attempt) conflictAttempt = undefined }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || busy || completed || button.disabled) return
    if (!intention) {
      if (!form.reportValidity()) return
      const fields = new FormData(form)
      const payload = { caseRef: context.caseRef, objective: String(fields.get('objective') || '').trim(), horizon: { start: fields.get('start'), end: fields.get('end') }, currency: String(fields.get('currency') || '').trim(), criteria: context.criteria.map((item, index) => ({ ...item, description: String(fields.get('criterion-' + index) || '').trim() })), sourceRefs: context.sourceRefs }
      intention = { key: crypto.randomUUID(), body: JSON.stringify(payload), values: inputs.map((input) => [input, input.value]), uncertain: false }
    }
    const attempt = intention; const reconciling = attempt.uncertain
    busy = true; form.dataset.dirty = 'true'; button.disabled = true; inputs.forEach((input) => { input.disabled = true }); status.textContent = 'Saving decision…'
    const url = new URL(location.href); url.search = '?sf=decision-edit'
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key }, body: attempt.body })
      if (!active() || intention !== attempt) return
      if (response.status === 401 || response.status === 403) { revoke(); return }
      const result = await response.json(); if (!active() || intention !== attempt) return
      if ([400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'conflict', 'stale'].includes(result?.status)) {
        if (reconciling) { attempt.uncertain = true; status.textContent = 'The retry was rejected, but the earlier save is still unconfirmed. Your original entries are locked; check the saved decision before making another change.'; return }
        intention = undefined
        if (response.status === 409) await conflict(attempt)
        else status.textContent = 'The save was rejected. Review the required fields and try again; your entries are preserved.'
        return
      }
      const saved = result?.value?.caseRef
      if (!response.ok || result?.status !== 'ok' || !saved || saved.id !== context.caseRef.id || saved.incarnation !== context.caseRef.incarnation || !Number.isSafeInteger(saved.version) || saved.version <= context.caseRef.version) throw new Error('unconfirmed')
      intention = undefined; completed = true; delete form.dataset.dirty; status.textContent = 'Decision saved.'; location.reload()
    } catch { if (active() && intention === attempt) { attempt.uncertain = true; status.textContent = 'Could not confirm the save. Your original entries are locked; retry the same request.' } }
    finally {
      busy = false
      if (active()) { button.disabled = completed; button.textContent = intention?.uncertain ? 'Retry same save' : 'Save decision'; inputs.forEach((input) => { input.disabled = completed || !!intention || disabled.get(input) }) }
    }
  })
})
`
