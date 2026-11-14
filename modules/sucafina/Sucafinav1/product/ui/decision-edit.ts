import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** The server supplied the case and its current version; the domain validates every edit. */
export function decisionEditForm(projection: AuthorizedCaseProjection) {
  const item = projection.case
  const context = { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, sourceRefs: item.sourceRefs,
    criteria: item.criteria.map((criterion) => ({ id: criterion.id, required: criterion.required })) }
  return `<details><summary>Edit decision</summary><form data-decision-edit data-context="${esc(JSON.stringify(context))}"><label>Decision objective<input name="objective" required value="${esc(item.objective)}"></label><label>Start<input name="start" type="date" required value="${esc(item.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(item.horizon.end)}"></label><label>Currency<input name="currency" required value="${esc(item.currency)}"></label><div data-decision-criteria>${item.criteria.map((criterion, index) => `<label>Criterion ${index + 1}<input name="criterion-${index}" data-criterion-id="${esc(criterion.id)}" required value="${esc(criterion.description)}"></label>`).join("")}</div><button>Save decision</button><p role="status" aria-live="polite"></p></form></details>`
}

export const decisionEditScript = `
document.querySelectorAll('[data-decision-edit]').forEach((form) => {
  if (form.dataset.sfEditReady) return; form.dataset.sfEditReady = 'true'
  let context = JSON.parse(form.dataset.context)
  const status = form.querySelector('[role=status]'); const button = form.querySelector('button'); let inputs = [...form.querySelectorAll('input')]
  const disabled = new Map(inputs.map((input) => [input, input.disabled]))
  const removedDrafts = new Map()
  context.criteria.forEach((criterion, index) => { const input = form.elements.namedItem('criterion-' + index); if (input) input.dataset.criterionId = criterion.id })
  let intention; let conflictAttempt; let comparison; let reviewed; let needsReview = false; let busy = false; let closed = false; let completed = false
  const active = () => !closed && form.isConnected
  const controls = () => {
    if (!active()) return
    button.disabled = completed || busy || needsReview; button.textContent = intention?.uncertain ? 'Retry same save' : 'Save decision'
    inputs.forEach((input) => { input.disabled = completed || !!intention || disabled.get(input) })
    form.querySelectorAll('[data-decision-conflict] button, [data-decision-structure-confirm]').forEach((input) => { input.disabled = busy || completed || !!intention })
  }
  const revoke = () => {
    closed = true; context = undefined; comparison = undefined; reviewed = undefined; removedDrafts.clear()
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
  const readCurrent = async () => {
      const response = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!active()) return
      if (response.status === 401 || response.status === 403) { revoke(); return }
      if (!response.ok) throw new Error('unavailable')
      const html = await response.text(); if (!active()) return
      const page = new DOMParser().parseFromString(html, 'text/html')
      const previousRevision = document.querySelector('meta[name="sf-access-revision"]')?.content
      const nextRevision = response.headers.get('X-SF-Access-Revision') || page.querySelector('meta[name="sf-access-revision"]')?.content
      if (page.body.dataset.surface === 'signed-out' || page.querySelector('main[data-drawn="false"]') || previousRevision && previousRevision !== nextRevision) { revoke(); return }
      const current = [...page.querySelectorAll('[data-decision-edit]')].find((candidate) => { try { const ref = JSON.parse(candidate.dataset.context).caseRef; return ref.id === context.caseRef.id && ref.incarnation === context.caseRef.incarnation } catch { return false } })
      if (!current) throw new Error('unavailable')
      const currentContext = JSON.parse(current.dataset.context)
      if (!Number.isSafeInteger(currentContext.caseRef.version) || currentContext.caseRef.version < context.caseRef.version || !Array.isArray(currentContext.sourceRefs) || !Array.isArray(currentContext.criteria) || !currentContext.criteria.length || currentContext.criteria.some((item) => !item.id || typeof item.id !== 'string' || typeof item.required !== 'boolean') || new Set(currentContext.criteria.map((item) => item.id)).size !== currentContext.criteria.length) throw new Error('unavailable')
      const fields = Object.fromEntries(['objective', 'start', 'end', 'currency'].map((name) => { const field = current.elements.namedItem(name); if (!field) throw new Error('unavailable'); return [name, { value: field.value, disabled: field.disabled }] }))
      const criteria = currentContext.criteria.map((item, index) => { const field = current.elements.namedItem('criterion-' + index); if (!field) throw new Error('unavailable'); return { ...item, description: field.value, disabled: field.disabled } })
      return { context: currentContext, fields, criteria, signature: JSON.stringify({ context: currentContext, fields, criteria }) }
  }
  const draft = () => ({ fields: Object.fromEntries(inputs.filter((input) => !input.dataset.criterionId).map((input) => [input.name, input.value])), criteria: new Map(inputs.filter((input) => input.dataset.criterionId).map((input) => [input.dataset.criterionId, { value: input.value, disabled: disabled.get(input) }])) })
  const showRemovedDrafts = (panel) => {
    panel.querySelectorAll('[data-decision-removed-entry]').forEach((node) => node.remove())
    removedDrafts.forEach((value, id) => { const detail = document.createElement('p'); detail.dataset.decisionRemovedEntry = id; detail.textContent = 'Previously removed criterion ' + id + ' — your last entry: ' + value; panel.append(detail) })
  }
  const showComparison = (current) => {
    if (!active()) return
    needsReview = true; reviewed = undefined; comparison = current
    const entries = draft()
    form.querySelector('[data-decision-conflict]')?.remove()
    const panel = document.createElement('div'); panel.dataset.decisionConflict = 'true'
    const title = document.createElement('p'); title.textContent = current ? 'Current values and your entries:' : 'Current values are unavailable; your entries remain here.'; panel.append(title)
    if (current) {
      ;[['objective', 'Objective'], ['start', 'Start'], ['end', 'End'], ['currency', 'Currency']].forEach(([name, label]) => {
        const detail = document.createElement('p'); detail.textContent = label + ': current ' + current.fields[name].value + '; yours ' + String(entries.fields[name] || ''); panel.append(detail)
      })
      context.criteria.forEach((item, index) => {
        const found = current.criteria.find((criterion) => criterion.id === item.id)
        const detail = document.createElement('p'); detail.textContent = 'Criterion ' + (index + 1) + ' (' + item.id + '): current ' + (found ? found.description : 'removed') + '; yours ' + String(entries.criteria.get(item.id)?.value || ''); panel.append(detail)
      })
      const added = current.criteria.filter((item) => !entries.criteria.has(item.id))
      const removed = context.criteria.filter((item) => !current.criteria.some((criterion) => criterion.id === item.id))
      added.forEach((item) => { const detail = document.createElement('p'); detail.textContent = 'Added criterion ' + item.id + ': ' + item.description; panel.append(detail) })
      if (added.length || removed.length) {
        const detail = document.createElement('p'); detail.textContent = 'The criteria changed. Continuing keeps your entries for matching criterion IDs, adds the current new criteria, and omits the removed criteria from the next save. Removed entries remain in this comparison until you save.'; panel.append(detail)
        const label = document.createElement('label'); const confirm = document.createElement('input'); confirm.type = 'checkbox'; confirm.dataset.decisionStructureConfirm = 'true'
        label.append(confirm, document.createTextNode('I reviewed the added and removed criteria')); panel.append(label)
      }
      const adopt = document.createElement('button'); adopt.type = 'button'; adopt.dataset.decisionAdopt = 'true'; adopt.textContent = 'Use current version and keep my edits'; panel.append(adopt)
      adopt.addEventListener('click', async () => {
        if (!active() || busy || intention || comparison !== current) return
        const confirm = panel.querySelector('[data-decision-structure-confirm]')
        if (confirm && !confirm.checked) { status.textContent = 'Review the added and removed criteria before adopting the current version.'; confirm.focus(); return }
        busy = true; controls(); status.textContent = 'Checking the current decision before keeping your edits…'
        try {
          const fresh = await readCurrent(); if (!active() || !fresh) return
          if (fresh.signature !== current.signature) { showComparison(fresh); status.textContent = 'The decision changed again. Review the new comparison before continuing.'; return }
          const retained = draft()
          // The comparison panel can be replaced by another authorized read.
          // Keep removed drafts by criterion ID until the save is confirmed.
          retained.criteria.forEach((entry, id) => { if (!fresh.criteria.some((item) => item.id === id)) removedDrafts.set(id, entry.value) })
          showRemovedDrafts(panel)
          const criteria = document.createElement('div'); criteria.dataset.decisionCriteria = 'true'
          fresh.criteria.forEach((item, index) => {
            const label = document.createElement('label'); label.textContent = 'Criterion ' + (index + 1)
            const input = document.createElement('input'); input.name = 'criterion-' + index; input.dataset.criterionId = item.id; input.required = true
            input.value = retained.criteria.get(item.id)?.value ?? item.description; input.defaultValue = item.description
            disabled.set(input, item.disabled || retained.criteria.get(item.id)?.disabled || false); label.append(input); criteria.append(label)
          })
          const previous = form.querySelector('[data-decision-criteria]')
          if (previous) previous.replaceWith(criteria)
          else { inputs.filter((input) => input.dataset.criterionId).forEach((input) => input.closest('label')?.remove()); form.insertBefore(criteria, button) }
          inputs.filter((input) => !input.isConnected).forEach((input) => disabled.delete(input))
          inputs = [...form.querySelectorAll('input')].filter((input) => !input.hasAttribute('data-decision-structure-confirm'))
          ;['objective', 'start', 'end', 'currency'].forEach((name) => { const input = form.elements.namedItem(name); disabled.set(input, disabled.get(input) || fresh.fields[name].disabled) })
          context = fresh.context; form.dataset.context = JSON.stringify(context); reviewed = fresh.signature; comparison = undefined; needsReview = false
          panel.querySelectorAll('button, label').forEach((node) => node.remove()); title.textContent = 'Reviewed current version. This comparison preserves the earlier entries; the form is ready for your review and save.'
          status.textContent = 'Current version adopted. Review your entries, then save explicitly.'
        } catch { if (active()) status.textContent = 'The current decision could not be revalidated. Your entries and original version remain here; retry the comparison.' }
        finally { busy = false; controls() }
      })
    }
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Reload current values for comparison'; panel.append(refresh)
    refresh.addEventListener('click', async () => {
      if (!active() || busy || intention) return
      busy = true; controls()
      try { const fresh = await readCurrent(); if (fresh) showComparison(fresh) }
      catch { if (active()) { showComparison(undefined); status.textContent = 'Current values are unavailable; your entries and original version remain here.' } }
      finally { busy = false; controls() }
    })
    showRemovedDrafts(panel); form.append(panel); controls()
  }
  const conflict = async (attempt) => {
    conflictAttempt = attempt; needsReview = true
    status.textContent = 'The decision changed or its basis is in use. Your entries and the version you opened are preserved.'
    try { const current = await readCurrent(); if (current) showComparison(current) }
    catch { if (active()) { showComparison(undefined); status.textContent += ' Current values are unavailable; your entries remain here.' } }
    finally { if (conflictAttempt === attempt) conflictAttempt = undefined }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || busy || completed || needsReview || button.disabled) return
    busy = true; controls()
    let attempt
    try {
      if (!intention) {
        if (!form.reportValidity()) return
        if (reviewed) {
          let current
          try { current = await readCurrent() } catch { if (active()) status.textContent = 'The current decision could not be revalidated. Nothing was sent; your entries remain here.'; return }
          if (!active() || !current) return
          if (current.signature !== reviewed) { showComparison(current); status.textContent = 'The decision changed after your review. Compare the current version before saving.'; return }
        }
        if (!form.reportValidity()) return
        const fields = new FormData(form); const entries = draft()
        const payload = { caseRef: context.caseRef, objective: String(fields.get('objective') || '').trim(), horizon: { start: fields.get('start'), end: fields.get('end') }, currency: String(fields.get('currency') || '').trim(), criteria: context.criteria.map((item) => ({ ...item, description: String(entries.criteria.get(item.id)?.value || '').trim() })), sourceRefs: context.sourceRefs }
        intention = { key: crypto.randomUUID(), body: JSON.stringify(payload), values: inputs.map((input) => [input, input.value]), uncertain: false }
      }
      attempt = intention; const reconciling = attempt.uncertain
      form.dataset.dirty = 'true'; inputs.forEach((input) => { input.disabled = true }); controls(); status.textContent = 'Saving decision…'
      const url = new URL(location.href); url.search = '?sf=decision-edit'
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
      intention = undefined; completed = true; removedDrafts.clear(); delete form.dataset.dirty; status.textContent = 'Decision saved.'; location.reload()
    } catch { if (active() && attempt && intention === attempt) { attempt.uncertain = true; status.textContent = 'Could not confirm the save. Your original entries are locked; retry the same request.' } }
    finally {
      busy = false; controls()
    }
  })
})
`
