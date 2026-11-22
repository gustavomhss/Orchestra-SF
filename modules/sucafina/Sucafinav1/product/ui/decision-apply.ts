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
;(() => {
document.querySelectorAll('[data-decision-apply]').forEach((entry) => {
  if (entry.dataset.sfApplyReady) return; entry.dataset.sfApplyReady = 'true'
  let context = JSON.parse(entry.dataset.context)
  const review = entry.querySelector('[data-review-change]'), output = entry.querySelector('[data-change-review]')
  const confirm = entry.querySelector('[data-change-confirm]'), apply = entry.querySelector('[data-apply-change]')
  const status = entry.querySelector('[data-change-status]'), guard = entry.querySelector('[data-change-guard]')
  const requests = new Set()
  let reviewed = false, reviewDigest, pending, busy = false, completed = false, closed = false, generation = 0
  const active = (captured = generation) => !closed && captured === generation && entry.isConnected
  const sync = () => {
    if (!active()) return
    review.disabled = busy || !!pending || completed
    confirm.disabled = busy || !!pending || completed || !reviewed
    apply.disabled = busy || completed || (!pending && (!reviewed || !confirm.checked))
    apply.textContent = pending ? 'Retry same application' : 'Apply reviewed change'
  }
  const revoke = () => {
    if (closed) return
    closed = true; generation++
    context = undefined; reviewed = false; reviewDigest = undefined; pending = undefined
    entry.removeAttribute('data-context'); delete guard.dataset.dirty
    const message = document.createElement('p'); message.setAttribute('role', 'status')
    message.textContent = 'Your access changed. Reload before reviewing or applying this change.'
    entry.replaceChildren(message)
  }
  addEventListener('sf-access-revoked', revoke)
  addEventListener('pagehide', () => {
    revoke(); requests.forEach((controller) => controller.abort()); requests.clear()
  }, { once: true })
  const send = async (action, body, key) => {
    const captured = generation
    if (!active(captured)) throw new Error('inactive')
    const url = new URL(location.href); url.search = '?sf=' + action; url.hash = ''
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 10000)
    requests.add(controller)
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body })
      if (!active(captured)) throw new Error('inactive')
      if (response.status === 401 || response.status === 403) { dispatchEvent(new Event('sf-access-revoked')); throw new Error('denied') }
      const result = await response.json()
      if (!active(captured)) throw new Error('inactive')
      if (result?.status === 'denied') { dispatchEvent(new Event('sf-access-revoked')); throw new Error('denied') }
      if (!response.ok || result?.status !== 'ok') throw new Error(response.status === 503 ? 'receipt-unavailable' : 'unavailable')
      return result.value
    } finally { clearTimeout(deadline); requests.delete(controller) }
  }
  const primitive = (value) => value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)
  review.addEventListener('click', async () => {
    if (!active() || busy || pending || completed) return
    busy = true; reviewed = false; reviewDigest = undefined; confirm.checked = false
    delete guard.dataset.dirty; sync(); output.textContent = 'Checking the current change…'
    try {
      const value = await send('decision-review', JSON.stringify({ caseRef: context.caseRef, choiceId: context.choiceId, changeId: context.changeId }), crypto.randomUUID())
      if (!active()) return
      if (!value || value.changeId !== context.changeId || value.choiceId !== context.choiceId || value.surface !== context.surface ||
        value.expectedVersion !== context.expectedVersion || typeof value.reviewDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.reviewDigest) ||
        !Array.isArray(value.fields) || !value.fields.every((field) => field && typeof field.field === 'string' && !!field.field &&
          primitive(field.before) && primitive(field.after)) ||
        !['planned', 'applied', 'awaiting-approval', 'conflict', 'failed', 'cancelled'].includes(value.state)) throw new Error('changed')
      output.replaceChildren()
      const summary = document.createElement('p'); summary.textContent = 'Destination: ' + value.surface +
        (typeof value.target?.label === 'string' ? ' · ' + value.target.label : '') + ' · expected version ' + value.expectedVersion + ' · state ' + value.state
      output.append(summary)
      const display = (value) => value === null ? 'Empty' : String(value)
      value.fields.forEach((field) => {
        const line = document.createElement('p')
        line.textContent = field.field + ': ' + display(field.before) + (typeof field.beforeCurrency === 'string' ? ' ' + field.beforeCurrency : '') +
          ' → ' + display(field.after) + (typeof field.afterCurrency === 'string' ? ' ' + field.afterCurrency : '')
        output.append(line)
      })
      if (value.receipt) {
        const receipt = document.createElement('p'); receipt.textContent = 'Recorded receipt: ' + value.receipt.surface + ' · version ' + value.receipt.version
        output.append(receipt)
      } else if (value.state === 'planned' && value.fields.length) {
        reviewDigest = value.reviewDigest; reviewed = true; guard.dataset.dirty = 'true'
      }
    } catch {
      if (active()) output.textContent = 'Current change unavailable or stale. Refresh the decision before trying again.'
    } finally { busy = false; sync() }
  })
  confirm.addEventListener('change', () => {
    if (!active()) return
    if (pending) confirm.checked = true
    sync()
  })
  apply.addEventListener('click', async () => {
    if (!active() || busy || completed || (!pending && (!reviewed || !reviewDigest || !confirm.checked))) return
    if (!pending) pending = Object.freeze({
      key: crypto.randomUUID(),
      body: JSON.stringify({ caseRef: context.caseRef, choiceId: context.choiceId, changeId: context.changeId, reviewDigest }),
      surface: context.surface, expectedVersion: context.expectedVersion,
    })
    const attempt = pending
    busy = true; guard.dataset.dirty = 'true'; sync(); status.textContent = 'Applying reviewed change…'
    try {
      const receipt = await send('decision-apply', attempt.body, attempt.key)
      if (!active() || pending !== attempt) return
      // This is the HTTP acknowledgement shape. The domain validates the durable
      // receipt; the browser requires the exact reviewed destination/revision.
      if (!receipt || typeof receipt.receiptId !== 'string' || !receipt.receiptId.trim() || receipt.outcome !== 'applied' ||
        receipt.surface !== attempt.surface || !Number.isSafeInteger(receipt.version) || receipt.version !== attempt.expectedVersion + 1) throw new Error('unavailable')
      completed = true; delete guard.dataset.dirty
      status.textContent = 'Application recorded. Reloading the decision…'; location.reload()
    } catch (error) {
      if (active() && pending === attempt) status.textContent = error.message === 'receipt-unavailable'
        ? 'Could not confirm application. The reviewed request is locked; retry the same request to reconcile its receipt.'
        : 'Could not confirm application. Check the decision; its outcome is still unconfirmed. Retry the same request.'
    } finally { busy = false; sync() }
  })
  sync()
})
})()
`
