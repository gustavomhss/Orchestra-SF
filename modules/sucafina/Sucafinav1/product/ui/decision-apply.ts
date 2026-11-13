import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** A human can apply only a reviewed, currently authorized prepared change. */
export function decisionApplyForms(projection: AuthorizedCaseProjection) {
  const item = projection.case
  if (!item.preparedChanges.length) return ""
  return `<section><h3>Review prepared changes</h3>${item.preparedChanges.map((change, index) => {
    const context = { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, choiceId: change.choiceId, changeId: change.id, surface: change.target.surface, expectedVersion: change.expectedVersion }
    return `<article data-decision-apply data-context="${esc(JSON.stringify(context))}"><h4>Prepared change ${index + 1} · ${esc(change.target.surface)}</h4><p>State: ${esc(change.state)}</p><button type="button" data-review-change>Review current changes</button><div data-change-review role="status" aria-live="polite"></div><label><input type="checkbox" data-change-confirm disabled>I reviewed these changes and want to apply them</label><button type="button" data-apply-change disabled>Apply reviewed change</button><p data-change-status role="status" aria-live="polite"></p><form data-change-guard hidden></form></article>`
  }).join("")}</section>`
}

export const decisionApplyScript = `
document.querySelectorAll('[data-decision-apply]').forEach((entry) => {
  if (entry.dataset.sfApplyReady) return; entry.dataset.sfApplyReady = 'true'
  let context = JSON.parse(entry.dataset.context)
  const review = entry.querySelector('[data-review-change]'); const output = entry.querySelector('[data-change-review]'); const confirm = entry.querySelector('[data-change-confirm]'); const apply = entry.querySelector('[data-apply-change]'); const status = entry.querySelector('[data-change-status]'); const guard = entry.querySelector('[data-change-guard]')
  let reviewed = false; let intention; let busy = false; let closed = false; let completed = false
  const active = () => !closed && entry.isConnected
  const revoke = () => {
    closed = true; reviewed = false; context = undefined
    if (intention) intention.body = ''; intention = undefined
    output.replaceChildren(); confirm.checked = false; confirm.disabled = true; review.disabled = true; apply.disabled = true
    delete guard.dataset.dirty; delete entry.dataset.context
    entry.replaceChildren(status); status.textContent = 'Your access changed. Reload before reviewing or applying this change.'
  }
  addEventListener('sf-access-revoked', () => { if (entry.isConnected) revoke() })
  const controls = () => {
    if (!active()) return
    review.disabled = busy || !!intention || completed
    confirm.disabled = busy || !!intention || !reviewed || completed
    apply.disabled = busy || completed || (!intention && (!reviewed || !confirm.checked))
    apply.textContent = intention?.uncertain ? 'Retry same application' : 'Apply reviewed change'
  }
  const send = async (action, body, key) => {
    const url = new URL(location.href); url.search = '?sf=' + action
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body })
    if (!active()) throw new Error('closed')
    if (response.status === 401 || response.status === 403) { revoke(); throw new Error('closed') }
    const value = await response.json(); if (!active()) throw new Error('closed')
    const validationStatus = { 'invalid-decision-input': 400, 'invalid-content-type': 415, 'method-not-allowed': 405, 'request-too-large': 413 }[value?.reason]
    if (!response.ok || value?.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: value?.status === 'needs-input' && validationStatus === response.status, conflict: response.status === 409 })
    return value.value
  }
  review.addEventListener('click', async () => {
    if (!active() || busy || intention || completed || review.disabled) return
    busy = true; reviewed = false; confirm.checked = false; delete guard.dataset.dirty; controls(); output.textContent = 'Checking the current change…'; status.textContent = ''
    try {
      const value = await send('decision-review', JSON.stringify({ purpose: 'review', caseRef: context.caseRef, choiceId: context.choiceId, changeId: context.changeId }), crypto.randomUUID())
      if (!active()) return
      if (!value || value.changeId !== context.changeId || value.choiceId !== context.choiceId || value.surface !== context.surface || value.expectedVersion !== context.expectedVersion || !Array.isArray(value.fields)) throw new Error('changed')
      output.replaceChildren(); const summary = document.createElement('p'); summary.textContent = 'Destination: ' + value.surface + (value.target?.label ? ' · ' + value.target.label : '') + ' · expected version ' + value.expectedVersion + ' · state ' + value.state; output.append(summary)
      const display = (item) => item === null ? 'Empty' : ['string', 'number', 'boolean'].includes(typeof item) ? String(item) : 'Unavailable'
      value.fields.forEach((field) => { const line = document.createElement('p'); line.textContent = field.field + ': ' + display(field.before) + (field.beforeCurrency ? ' ' + field.beforeCurrency : '') + ' → ' + display(field.after) + (field.afterCurrency ? ' ' + field.afterCurrency : ''); output.append(line) })
      if (value.receipt) { const receipt = document.createElement('p'); receipt.textContent = 'Recorded receipt: ' + value.receipt.surface + ' · version ' + value.receipt.version; output.append(receipt) }
      // The published apply contract binds case version, choice and prepared change.
      // The producer separately validates human confirmation and current domain state.
      if (!value.receipt && value.state === 'planned' && value.fields.length && value.fields.every((field) => (field.before === null || ['string', 'number', 'boolean'].includes(typeof field.before)) && (field.after === null || ['string', 'number', 'boolean'].includes(typeof field.after)))) { reviewed = true; guard.dataset.dirty = 'true' }
      else status.textContent = 'This change cannot be applied from this review. Check its current state and recorded receipt.'
    } catch { if (active()) output.textContent = 'Current change unavailable or stale. Refresh the decision before trying again.' }
    finally { busy = false; controls() }
  })
  confirm.addEventListener('change', () => { if (!active() || busy || intention || completed) return; controls() })
  apply.addEventListener('click', async () => {
    if (!active() || busy || completed || apply.disabled || !intention && (!reviewed || !confirm.checked)) return
    if (!intention) intention = { key: crypto.randomUUID(), body: JSON.stringify({ caseRef: context.caseRef, choiceId: context.choiceId, changeId: context.changeId }), uncertain: false }
    const attempt = intention; const reconciling = attempt.uncertain
    busy = true; guard.dataset.dirty = 'true'; controls(); status.textContent = 'Applying reviewed change…'
    try {
      const receipt = await send('decision-apply', attempt.body, attempt.key)
      if (!active() || intention !== attempt) return
      if (!receipt || typeof receipt.receiptId !== 'string' || !receipt.receiptId || receipt.surface !== context.surface || !Number.isSafeInteger(receipt.version) || receipt.version < 0) throw new Error('unconfirmed')
      intention = undefined; completed = true; delete guard.dataset.dirty; status.textContent = 'Application receipt recorded. Reloading the decision to show its outcome…'; location.reload()
    } catch (error) {
      if (!active() || intention !== attempt) return
      if (error?.rejected && !reconciling) { intention = undefined; reviewed = false; confirm.checked = false; delete guard.dataset.dirty; status.textContent = 'Application was rejected. Review the current change again before making a new attempt.' }
      else { attempt.uncertain = true; status.textContent = error?.rejected ? 'The retry was rejected, but the earlier application is still unconfirmed. Keep the same request and check the current receipt before another change.' : error?.conflict ? 'The application returned a conflict and its outcome is still unconfirmed. The reviewed request stays locked; check the current receipt or retry the same request.' : 'Could not confirm application. The reviewed request is locked; retry the same request to reconcile its receipt.' }
    } finally { busy = false; controls() }
  })
})
`
