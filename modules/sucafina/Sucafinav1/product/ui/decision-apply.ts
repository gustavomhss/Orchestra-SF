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
  const context = JSON.parse(entry.dataset.context); const review = entry.querySelector('[data-review-change]'); const output = entry.querySelector('[data-change-review]'); const confirm = entry.querySelector('[data-change-confirm]'); const apply = entry.querySelector('[data-apply-change]'); const status = entry.querySelector('[data-change-status]'); const guard = entry.querySelector('[data-change-guard]')
  let reviewed = false; let key = crypto.randomUUID()
  const send = async (action, payload, id) => { const url = new URL(location.href); url.search = '?sf=' + action; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: JSON.stringify(payload) }); const value = await response.json(); if (!response.ok || value.status !== 'ok') throw new Error('unavailable'); return value.value }
  review.addEventListener('click', async () => {
    review.disabled = true; confirm.disabled = true; confirm.checked = false; apply.disabled = true; reviewed = false; delete guard.dataset.dirty; output.textContent = 'Checking the current change…'
    try {
      const value = await send('decision-review', { purpose: 'review', caseRef: context.caseRef, choiceId: context.choiceId, changeId: context.changeId }, crypto.randomUUID())
      if (value.changeId !== context.changeId || value.choiceId !== context.choiceId || value.surface !== context.surface || value.expectedVersion !== context.expectedVersion || !Array.isArray(value.fields)) throw new Error('changed')
      output.replaceChildren(); const summary = document.createElement('p'); summary.textContent = 'Destination: ' + value.surface + (value.target?.label ? ' · ' + value.target.label : '') + ' · expected version ' + value.expectedVersion + ' · state ' + value.state; output.append(summary)
      const display = (item) => item === null ? 'Empty' : ['string', 'number', 'boolean'].includes(typeof item) ? String(item) : 'Unavailable'
      value.fields.forEach((field) => { const line = document.createElement('p'); line.textContent = field.field + ': ' + display(field.before) + (field.beforeCurrency ? ' ' + field.beforeCurrency : '') + ' → ' + display(field.after) + (field.afterCurrency ? ' ' + field.afterCurrency : ''); output.append(line) })
      if (value.receipt) { const receipt = document.createElement('p'); receipt.textContent = 'Recorded receipt: ' + value.receipt.surface + ' · version ' + value.receipt.version; output.append(receipt) }
      if (value.state === 'planned' && value.fields.length && value.fields.every((field) => (field.before === null || ['string', 'number', 'boolean'].includes(typeof field.before)) && (field.after === null || ['string', 'number', 'boolean'].includes(typeof field.after)))) { reviewed = true; confirm.disabled = false; key = crypto.randomUUID(); guard.dataset.dirty = 'true' }
    } catch { output.textContent = 'Current change unavailable or stale. Refresh the decision before trying again.' }
    finally { review.disabled = false }
  })
  confirm.addEventListener('change', () => { apply.disabled = !reviewed || !confirm.checked })
  apply.addEventListener('click', async () => {
    if (!reviewed || !confirm.checked) return
    review.disabled = true; confirm.disabled = true; apply.disabled = true; status.textContent = 'Applying reviewed change…'
    try { const receipt = await send('decision-apply', { caseRef: context.caseRef, choiceId: context.choiceId, changeId: context.changeId }, key); if (!receipt.receiptId) throw new Error('unavailable'); delete guard.dataset.dirty; status.textContent = 'Application recorded. Reloading the decision…'; location.reload() }
    catch { status.textContent = 'Could not confirm application. Check the decision and retry the same request.'; confirm.disabled = false; apply.disabled = false }
  })
})
`
