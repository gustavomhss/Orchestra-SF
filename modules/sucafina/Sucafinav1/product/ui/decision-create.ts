import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import { esc } from "../../src/screen-shell.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/** This is an opaque routing partition, never a session token or authentication proof. */
export function decisionCreationScope(binding: { installationId: string; projectId: string; principalRef: string; policyVersion: string }): string {
  return digestSfValue({ installationId: binding.installationId, projectId: binding.projectId,
    principalRef: binding.principalRef, policyVersion: binding.policyVersion })
}

/** Bind only a non-secret scope digest issued after host authorization. */
export function scopeDecisionCreateForm(html: string, scope: string): string {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw new Error("invalid-creation-scope")
  return html.replace(" data-decision-create", ' data-decision-create data-creation-scope="' + scope + '"')
}

/** Human input is submitted to the authorized domain command, never saved by the view. */
function createForm(context?: { sourceRefs: readonly BusinessEvidenceRef[]; period: Period; returnTo: string }) {
  return `<details${context ? " open" : ""}><summary>Create a decision</summary><form data-decision-create${context ? ` data-source-refs="${esc(JSON.stringify(context.sourceRefs))}" data-return-to="${esc(context.returnTo)}"` : ""}><label>Decision objective<input name="objective" required></label><label>Start<input name="start" type="date" required${context ? ` value="${esc(context.period.start)}" readonly` : ""}></label><label>End<input name="end" type="date" required${context ? ` value="${esc(context.period.end)}" readonly` : ""}></label><label>Currency<input name="currency" required maxlength="12"></label><label>Criteria, one per line<textarea name="criteria" required></textarea></label><button type="submit">Create decision</button><button type="button" data-sf-create-new hidden>Start a separate decision</button><p role="status" aria-live="polite"></p></form></details>`
}
export const decisionCreateForm = createForm()
export const decisionCreateFromContext = (context: { sourceRefs: readonly BusinessEvidenceRef[]; period: Period; returnTo: string }) => createForm(context)

// A lost response retains the exact command and identity until its outcome is reconciled.
export const decisionCreateScript = `document.querySelectorAll('[data-decision-create]').forEach((form) => {
  if (form.dataset.sfCreateReady) return; form.dataset.sfCreateReady = 'true'
  const status = form.querySelector('[role=status]')
  const button = form.querySelector('button[type=submit]')
  const newButton = form.querySelector('[data-sf-create-new]')
  const inputs = [...form.querySelectorAll('input, textarea')]
  const disabled = new Map(inputs.map((input) => [input, input.disabled]))
  const contextual = form.hasAttribute('data-source-refs')
  let sourceRefs
  try { sourceRefs = contextual ? JSON.parse(form.dataset.sourceRefs) : [] } catch { sourceRefs = undefined }
  let returnTo = form.dataset.returnTo
  let intention, completed, pendingKey
  let denied = false, submitting = false

  // The host renders this digest only after authenticating the installation,
  // project, principal and policy. No principal, business field or token is stored.
  const scope = form.dataset.creationScope
  const prefix = /^[a-f0-9]{64}$/.test(scope || '') ? 'sf:case-create:pending:v1:' + scope + ':' : undefined
  const validKey = (key) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)
  const validCaseRef = (ref) => typeof ref === 'string' && /^case:[^:]+:[^:]+$/.test(ref)
  const storedKeys = () => {
    if (!prefix) return undefined
    try {
      const keys = []
      for (let index = 0; index < localStorage.length; index++) {
        const name = localStorage.key(index)
        if (name && name.startsWith(prefix) && localStorage.getItem(name) === 'pending') {
          const key = name.slice(prefix.length)
          if (!validKey(key)) return undefined
          keys.push(key)
        }
      }
      return keys.length <= 64 ? keys.sort() : undefined
    } catch { return undefined }
  }
  const persist = (key) => {
    if (!prefix || !validKey(key)) return false
    try {
      localStorage.setItem(prefix + key, 'pending')
      return localStorage.getItem(prefix + key) === 'pending'
    } catch { return false }
  }
  const discard = (key) => {
    if (!prefix || !validKey(key)) return
    try { localStorage.removeItem(prefix + key) } catch {}
  }
  const destination = (created) => {
    const url = new URL(location.href); url.hash = ''
    url.search = new URLSearchParams({ sf: 'workbench-case', caseRef: created.ref, ...(created.returnTo ? { returnTo: created.returnTo } : {}) }).toString()
    location.assign(url)
  }
  const lockFields = () => { inputs.forEach((input) => { input.disabled = true }) }
  const restoreFields = () => { inputs.forEach((input) => { input.disabled = disabled.get(input) }) }
  const present = () => {
    if (denied || !form.isConnected) return
    button.disabled = submitting
    button.textContent = pendingKey ? 'Check original creation' : intention?.uncertain ? 'Retry same creation' : completed ? 'Open created decision' : 'Create decision'
    if (pendingKey || intention?.uncertain || submitting) lockFields()
    else restoreFields()
    if (newButton) newButton.hidden = !(pendingKey || intention?.uncertain)
  }
  const accessChanged = () => {
    // Keep only the opaque correlation identifier, for the original principal
    // to reconcile after reauthorization. It never grants access on its own.
    if (intention) { intention.body = ''; intention.returnTo = undefined }
    denied = true; intention = undefined; completed = undefined
    sourceRefs = undefined; returnTo = undefined
    inputs.forEach((input) => { input.value = ''; input.defaultValue = ''; input.removeAttribute('value'); input.disabled = true })
    disabled.clear(); button.disabled = true
    delete form.dataset.sourceRefs; delete form.dataset.returnTo
    const panel = form.closest('[data-decision-context]') || form
    panel.replaceChildren()
    const message = document.createElement('p'); message.setAttribute('role', 'status')
    message.textContent = 'Your access changed. Reopen an authorized page to reconcile this creation.'
    panel.append(message); delete form.dataset.dirty
  }
  addEventListener('sf-access-revoked', () => { if (form.isConnected) accessChanged() })
  if (!prefix || storedKeys() === undefined) {
    button.disabled = true; lockFields()
    status.textContent = 'Private creation recovery is unavailable. No request was submitted.'
    if (newButton) newButton.hidden = true
    return
  }

  const reconcile = async () => {
    const keys = storedKeys()
    if (!keys || denied || !form.isConnected || submitting) return
    if (!keys.length) {
      pendingKey = undefined
      status.textContent = 'No pending creation is recorded for this authorized workspace.'
      present(); return
    }
    pendingKey = keys[0]
    submitting = true; form.dataset.dirty = 'true'
    lockFields(); button.disabled = true
    if (newButton) newButton.hidden = true
    status.textContent = 'Checking the original creation in authorized storage…'
    try {
      for (const key of keys) {
        if (denied || !form.isConnected) return
        const url = new URL(location.href); url.search = '?sf=workbench-create-recover'
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        let response, result
        try {
          response = await fetch(url, {
            method: 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Idempotency-Key': key, 'X-SF-Creation-Scope': scope }, signal: controller.signal,
          })
          result = await response.json()
        } finally { clearTimeout(timeout) }
        if (denied || !form.isConnected) return
        if (response.status === 401 || response.status === 403) { accessChanged(); return }
        if (response.ok && result?.status === 'ok' && result.state === 'committed' &&
          validCaseRef(result.outputRef)) {
          discard(key)
          completed = { ref: result.outputRef }
          pendingKey = undefined
          delete form.dataset.dirty
          status.textContent = 'Original decision confirmed. Opening its saved case…'
          destination(completed); return
        }
        if (!response.ok || result?.status !== 'ok' || result.state !== 'not-found') throw new Error('recovery-unavailable')
        // Not-found is not proof that an in-flight POST cannot still commit.
        // Never replay the request with a new key or reconstruct its payload.
      }
      pendingKey = keys[0]
      status.textContent = 'The original creation has no confirmed receipt yet. Check again; a new submission is never automatic.'
    } catch {
      if (!denied && form.isConnected) status.textContent = 'Creation could not be reconciled. Check the original attempt again; it has not been resubmitted.'
    } finally {
      submitting = false
      present()
    }
  }
  form.addEventListener('input', () => {
    if (submitting || pendingKey || intention?.uncertain || denied) return
    intention = undefined; completed = undefined
    button.textContent = 'Create decision'; form.dataset.dirty = 'true'
  })
  if (newButton) newButton.addEventListener('click', () => {
    if ((!pendingKey && !intention?.uncertain) || submitting || denied) return
    if (!confirm('An earlier creation remains unconfirmed. Start a separate creation with a new identity? The original receipt remains recoverable.')) return
    pendingKey = undefined; intention = undefined; completed = undefined
    status.textContent = 'Separate creation selected. The previous attempt is still pending and will be checked after reload.'
    present()
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (submitting || denied || !form.isConnected) return
    if (pendingKey) { void reconcile(); return }
    if (completed) { destination(completed); return }
    if (!intention) {
      if (!form.reportValidity()) return
      const fields = new FormData(form)
      const criteria = String(fields.get('criteria') || '').split('\\n').map((line) => line.trim()).filter(Boolean)
      if (!criteria.length) { status.textContent = 'Enter at least one criterion.'; return }
      if (!Array.isArray(sourceRefs) || contextual && (!sourceRefs.length || !returnTo)) {
        status.textContent = 'Source context is unavailable. Return to the contract and open Create decision again.'; return
      }
      const key = crypto.randomUUID()
      const body = JSON.stringify({ operation: 'sf_case_draft', input: {
        objective: String(fields.get('objective') || '').trim(),
        horizon: { start: String(fields.get('start') || ''), end: String(fields.get('end') || '') },
        currency: String(fields.get('currency') || '').trim(), criteria, sourceRefs,
      } })
      // Crash-safety: persist the non-authorizing identifier before any bytes
      // are submitted. No private payload is ever written to browser storage.
      if (!persist(key)) {
        status.textContent = 'Could not preserve the private recovery reference. Creation was not sent.'
        return
      }
      intention = { key, uncertain: false, returnTo, body }
    }
    const attempt = intention
    const url = new URL(location.href); url.search = '?sf=workbench-command'
    submitting = true; form.dataset.dirty = 'true'; button.disabled = true; lockFields()
    status.textContent = 'Creating decision…'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key, 'X-SF-Creation-Scope': scope },
        body: attempt.body, signal: controller.signal })
      if (denied || !form.isConnected || intention !== attempt) return
      if (response.status === 401 || response.status === 403) { accessChanged(); return }
      const result = await response.json()
      if (denied || !form.isConnected || intention !== attempt) return
      if (!response.ok && response.status < 500 && response.status !== 408 &&
        ['invalid', 'needs-input', 'conflict'].includes(result?.status)) {
        // Even a 409 can race a prior commit. Retain correlation until the
        // original C08 transaction is authoritatively reconciled.
        attempt.uncertain = true
        status.textContent = 'Creation was rejected or is uncertain. Check the original key after reload, or explicitly start a separate intention.'
        return
      }
      if (!response.ok || result.status !== 'ok' || !validCaseRef(result.outputRef)) throw new Error('unconfirmed')
      completed = { ref: result.outputRef, returnTo: attempt.returnTo }
      discard(attempt.key)
      intention = undefined; delete form.dataset.dirty
      status.textContent = 'Decision created. Opening the saved decision…'
      destination(completed)
    } catch {
      if (denied || !form.isConnected || intention !== attempt) return
      attempt.uncertain = true
      status.textContent = 'Creation is unconfirmed. Your entries are locked to the original request; retry the same request to reconcile it.'
    } finally {
      clearTimeout(timeout); submitting = false
      present()
    }
  })
  const keys = storedKeys()
  if (keys?.length) { pendingKey = keys[0]; lockFields(); button.disabled = true; void reconcile() }
  else present()
})
`
