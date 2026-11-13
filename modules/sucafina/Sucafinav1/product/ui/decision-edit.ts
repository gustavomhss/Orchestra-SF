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
  const context = JSON.parse(form.dataset.context)
  const status = form.querySelector('[role=status]')
  const button = form.querySelector('button')
  let key = crypto.randomUUID()
  form.addEventListener('input', () => { key = crypto.randomUUID(); form.dataset.dirty = 'true' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity() || button.disabled) return
    const fields = new FormData(form)
    const payload = { caseRef: context.caseRef, objective: String(fields.get('objective') || '').trim(), horizon: { start: fields.get('start'), end: fields.get('end') }, currency: String(fields.get('currency') || '').trim(), criteria: context.criteria.map((item, index) => ({ ...item, description: String(fields.get('criterion-' + index) || '').trim() })), sourceRefs: context.sourceRefs }
    const url = new URL(location.href); url.search = '?sf=decision-edit'
    const inputs = form.querySelectorAll('input'); button.disabled = true; inputs.forEach((input) => { input.disabled = true }); status.textContent = 'Saving decision…'
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (response.status === 409) {
        status.textContent = 'The decision changed or its basis is in use. Your entries are preserved.'
        const currentResponse = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store' })
        if (!currentResponse.ok) { status.textContent += ' Current values are unavailable.'; return }
        const currentPage = new DOMParser().parseFromString(await currentResponse.text(), 'text/html')
        const current = currentPage.querySelector('[data-decision-edit]')
        if (!current) { status.textContent += ' Current values are unavailable.'; return }
        const previous = form.querySelector('[data-decision-conflict]'); if (previous) previous.remove()
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
        form.append(comparison); return
      }
      if (!response.ok || result.status !== 'ok') throw new Error('unavailable')
      delete form.dataset.dirty; status.textContent = 'Decision saved.'; location.reload()
    } catch { status.textContent = 'Could not confirm the save. Your entries are preserved; retry the same request.' }
    finally { button.disabled = false; inputs.forEach((input) => { input.disabled = false }) }
  })
})
`
