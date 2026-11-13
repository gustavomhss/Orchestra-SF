/** Human input is submitted to the authorized domain command, never saved by the view. */
export const decisionCreateForm = `<details><summary>Create a decision</summary><form data-decision-create><label>Decision objective<input name="objective" required></label><label>Start<input name="start" type="date" required></label><label>End<input name="end" type="date" required></label><label>Currency<input name="currency" required maxlength="12"></label><label>Criteria, one per line<textarea name="criteria" required></textarea></label><button type="submit">Create decision</button><p role="status" aria-live="polite"></p></form></details>`

// A lost response retains the exact command and identity until its outcome is reconciled.
export const decisionCreateScript = `
document.querySelectorAll('[data-decision-create]').forEach((form) => {
  if (form.dataset.sfCreateReady) return; form.dataset.sfCreateReady = 'true'
  let intention
  let completed
  let denied = false
  let submitting = false
  const status = form.querySelector('[role=status]')
  const button = form.querySelector('button[type=submit]')
  const inputs = [...form.querySelectorAll('input, textarea')]
  const disabled = new Map(inputs.map((input) => [input, input.disabled]))
  const destination = (ref) => { const url = new URL(location.href); url.search = new URLSearchParams({ sf: 'workbench-case', caseRef: ref }).toString(); location.assign(url) }
  const accessChanged = () => {
    denied = true; intention = undefined; completed = undefined
    form.replaceChildren()
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Your access changed. Reload before creating a decision.'; form.append(message)
    delete form.dataset.dirty
  }
  form.addEventListener('input', () => { if (!submitting && !intention?.uncertain && !denied) { intention = undefined; completed = undefined; button.textContent = 'Create decision'; form.dataset.dirty = 'true' } })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting || denied || !form.isConnected) return
    if (completed) { destination(completed); return }
    if (!intention) {
      if (!form.reportValidity()) return
      const fields = new FormData(form)
      const criteria = String(fields.get('criteria') || '').split('\\n').map((line) => line.trim()).filter(Boolean)
      if (!criteria.length) { status.textContent = 'Enter at least one criterion.'; return }
      intention = { key: crypto.randomUUID(), uncertain: false, body: JSON.stringify({ operation: 'sf_case_draft', input: { objective: String(fields.get('objective') || '').trim(), horizon: { start: String(fields.get('start') || ''), end: String(fields.get('end') || '') }, currency: String(fields.get('currency') || '').trim(), criteria, sourceRefs: [] } }) }
    }
    const attempt = intention
    const url = new URL(location.href)
    url.search = '?sf=workbench-command'
    submitting = true
    form.dataset.dirty = 'true'
    button.disabled = true
    inputs.forEach((input) => { input.disabled = true })
    status.textContent = 'Creating decision…'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key }, body: attempt.body, signal: controller.signal })
      if (denied || !form.isConnected || intention !== attempt) return
      if (response.status === 401 || response.status === 403) { accessChanged(); return }
      const result = await response.json()
      if (denied || !form.isConnected || intention !== attempt) return
      if (!response.ok && response.status < 500 && response.status !== 408 && ['invalid', 'needs-input', 'conflict'].includes(result?.status) && !attempt.uncertain) {
        intention = undefined
        status.textContent = response.status === 409 ? 'Creation was rejected because the context changed. Review your entries and try again.' : 'Creation was rejected. Review the required fields and try again.'
        return
      }
      if (!response.ok || result.status !== 'ok' || typeof result.outputRef !== 'string' || !result.outputRef) throw new Error('unconfirmed')
      completed = result.outputRef
      intention = undefined
      delete form.dataset.dirty
      status.textContent = 'Decision created. Opening the saved decision…'
      destination(completed)
    } catch {
      if (denied || !form.isConnected || intention !== attempt) return
      attempt.uncertain = true
      status.textContent = 'Creation is unconfirmed. Your entries are locked to the original request; retry the same request to reconcile it.'
    } finally {
      clearTimeout(timeout)
      submitting = false
      if (!denied && form.isConnected) {
        button.disabled = false
        button.textContent = intention?.uncertain ? 'Retry same creation' : completed ? 'Open created decision' : 'Create decision'
        inputs.forEach((input) => { input.disabled = intention?.uncertain ? true : disabled.get(input) })
      }
    }
  })
})
`

