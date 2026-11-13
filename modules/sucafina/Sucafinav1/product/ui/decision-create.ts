/** Human input is submitted to the authorized domain command, never saved by the view. */
export const decisionCreateForm = `<details><summary>Create a decision</summary><form data-decision-create><label>Decision objective<input name="objective" required></label><label>Start<input name="start" type="date" required></label><label>End<input name="end" type="date" required></label><label>Currency<input name="currency" required maxlength="12"></label><label>Criteria, one per line<textarea name="criteria" required></textarea></label><button type="submit">Create decision</button><p role="status" aria-live="polite"></p></form></details>`

// Keep one intention key for identical retries, including after an uncertain network outcome.
export const decisionCreateScript = `
document.querySelectorAll('[data-decision-create]').forEach((form) => {
  let key = crypto.randomUUID()
  let submitting = false
  form.addEventListener('input', () => { if (!submitting) key = crypto.randomUUID() })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting || !form.reportValidity()) return
    const fields = new FormData(form)
    const criteria = String(fields.get('criteria') || '').split('\\n').map((line) => line.trim()).filter(Boolean)
    const status = form.querySelector('[role=status]')
    if (!criteria.length) { status.textContent = 'Enter at least one criterion.'; return }
    const command = { operation: 'sf_case_draft', input: { objective: String(fields.get('objective') || '').trim(), horizon: { start: String(fields.get('start') || ''), end: String(fields.get('end') || '') }, currency: String(fields.get('currency') || '').trim(), criteria, sourceRefs: [] } }
    const url = new URL(location.href)
    url.search = '?sf=workbench-command'
    submitting = true
    const button = form.querySelector('button[type=submit]')
    button.disabled = true
    const inputs = form.querySelectorAll('input, textarea')
    inputs.forEach((input) => { input.disabled = true })
    status.textContent = 'Creating decision…'
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(command) })
      const result = await response.json()
      if (!response.ok || result.status !== 'ok' || typeof result.outputRef !== 'string' || !result.outputRef) throw new Error('not-created')
      url.search = new URLSearchParams({ sf: 'workbench-case', caseRef: result.outputRef }).toString()
      location.assign(url)
    } catch { status.textContent = 'Could not confirm creation. Your entries are preserved; retry to check the same request.' }
    finally { submitting = false; button.disabled = false; inputs.forEach((input) => { input.disabled = false }) }
  })
})
`
