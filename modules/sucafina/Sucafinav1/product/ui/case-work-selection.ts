import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../contracts/business-context.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { esc } from "../../src/screen-shell.ts"

/** Select only references supplied by the authorized case projection. Selection
 * membership is personal; assigning a question remains a separate explicit act. */
export function caseWorkSelectionForm(projection: AuthorizedCaseProjection) {
  const sources = projection.case.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && !!ref.target.period)
  const context = { caseRef: encodeCaseRef(projection.case), caseVersion: projection.case.version, principalRef: projection.context.principalRef,
    accessRevision: projection.context.accessRevision, horizon: projection.case.horizon, sources }
  return `<section><h3>Choose work for this decision</h3><form data-case-work-selection data-context="${esc(JSON.stringify(context))}"><p>Select records and a period for your work list. To ask another person, use Ask a question and choose a recipient from the authorized directory.</p><fieldset><legend>Records in this decision</legend>${sources.length ? sources.map((source) => `<label><input type="checkbox" name="source" value="${esc(source.refDigest)}">${esc(source.target.recordId)} · ${esc(source.target.recordType)} · ${esc(source.target.surface)}</label>`).join("") : "<p>No accessible record with a period is attached to this decision.</p>"}</fieldset><label>Work start<input type="date" name="start" value="${esc(projection.case.horizon.start)}" min="${esc(projection.case.horizon.start)}" max="${esc(projection.case.horizon.end)}" required></label><label>Work end<input type="date" name="end" value="${esc(projection.case.horizon.end)}" min="${esc(projection.case.horizon.start)}" max="${esc(projection.case.horizon.end)}" required></label><button type="submit"${sources.length ? "" : " disabled"}>Save work selection</button><button type="button" data-load-work-selections>Load saved selections</button><button type="button" data-review-rejected-selection hidden>Review rejected selection</button><button type="button" data-review-work-sources hidden>Reload decision to review sources</button><p role="status" aria-live="polite">Choose records and a period, or load a selection already saved for this decision.</p><div data-work-selections></div></form></section>`
}

export const caseWorkSelectionScript = `
document.querySelectorAll('[data-case-work-selection]').forEach((form) => {
  if (form.dataset.sfCaseWorkReady) return; form.dataset.sfCaseWorkReady = 'true'
  let context = JSON.parse(form.dataset.context)
  const status = form.querySelector('[role=status]'); const output = form.querySelector('[data-work-selections]'); const submit = form.querySelector('button[type=submit]')
  const load = form.querySelector('[data-load-work-selections]'); const review = form.querySelector('[data-review-work-sources]'); const reviewRejected = form.querySelector('[data-review-rejected-selection]')
  const fields = [...form.querySelectorAll('input')]; const initialDisabled = submit.disabled
  let closed = false; let busy = false; let reading = false; let epoch = 0; let readGeneration = 0; let pending; let rejected; let key = crypto.randomUUID()
  const controllers = new Set()
  const active = () => !closed && form.isConnected
  const sync = () => {
    if (!active()) return
    fields.forEach((field) => { field.disabled = busy || !!pending || !!rejected })
    submit.disabled = initialDisabled || busy || reading || !!rejected; submit.textContent = pending ? 'Retry same selection' : 'Save work selection'
    load.disabled = busy || reading; review.disabled = busy || reading || !!pending
    reviewRejected.disabled = busy || reading || !!pending
    output.querySelectorAll('button').forEach((button) => { button.disabled = busy || reading })
  }
  const close = (message) => {
    if (closed) return
    closed = true; epoch++; readGeneration++; controllers.forEach((controller) => controller.abort()); controllers.clear(); pending = rejected = context = key = undefined
    fields.forEach((field) => { field.value = ''; field.checked = false; field.disabled = true }); delete form.dataset.context; delete form.dataset.dirty
    output.replaceChildren(); form.replaceChildren(status); status.textContent = message
    removeEventListener('sf-access-revoked', revoke); observer.disconnect()
  }
  const revoke = () => close('Work selection access changed. Reopen the decision with your current access.')
  const observer = new MutationObserver(() => { if (!form.isConnected) close('') }); observer.observe(document.body, { childList: true, subtree: true })
  addEventListener('sf-access-revoked', revoke)
  const timed = async (request) => {
    if (!active()) throw Object.assign(new Error('closed'), { ignored: true })
    const ticket = epoch, controller = new AbortController(); controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(request.url, { ...request.init, credentials: 'same-origin', signal: controller.signal })
      if (!active()) throw Object.assign(new Error('closed'), { ignored: true })
      if (response.status === 401 || response.status === 403) { revoke(); dispatchEvent(new CustomEvent('sf-access-revoked')); throw Object.assign(new Error('access-changed'), { ignored: true }) }
      const body = await response.text()
      if (!active() || ticket !== epoch) throw Object.assign(new Error('superseded'), { ignored: true })
      return { response, body }
    } finally { clearTimeout(timeout); controllers.delete(controller) }
  }
  const send = async (mode, payload, identity = crypto.randomUUID(), body = JSON.stringify(payload)) => {
    const url = new URL(location.href); url.search = '?sf=' + mode
    const result = await timed({ url, init: { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': identity }, body } })
    const value = JSON.parse(result.body)
    if (!result.response.ok || value?.status !== 'ok') throw Object.assign(new Error('unavailable'), { beforeCommitInvalid: result.response.status === 400 && value?.status === 'needs-input', beforeCommitConflict: result.response.status === 409 && value?.status === 'conflict' && value?.reason === 'selection-not-committed' })
    return value.value
  }
  const validPeriod = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(value.start) && /^\\d{4}-\\d{2}-\\d{2}$/.test(value.end) && value.start <= value.end && [value.start, value.end].every((date) => Number.isFinite(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date)
  const currentCase = async () => {
    const url = new URL(location.href); url.search = new URLSearchParams({ sf: 'workbench-case', caseRef: context.caseRef }).toString()
    const result = await timed({ url, init: { method: 'GET' } })
    if (!result.response.ok) throw new Error('case-unavailable')
    const document = new DOMParser().parseFromString(result.body, 'text/html')
    const element = document.querySelector('[data-case-work-selection]')
    if (!element?.dataset.context) throw new Error('case-unavailable')
    const next = JSON.parse(element.dataset.context)
    if (next?.principalRef !== context.principalRef || next?.accessRevision !== context.accessRevision) { revoke(); dispatchEvent(new CustomEvent('sf-access-revoked')); throw Object.assign(new Error('access-changed'), { ignored: true }) }
    if (JSON.stringify(next) !== JSON.stringify(context)) throw Object.assign(new Error('case-changed'), { caseChanged: true })
  }
  const render = (items) => {
    if (!Array.isArray(items) || items.some((item) => typeof item?.selectionRef !== 'string' || !item.selectionRef.trim() || !validPeriod(item.period) || !['active', 'unavailable'].includes(item.state)) || new Set(items.map((item) => item.selectionRef)).size !== items.length) throw new Error('selection-list-unavailable')
    output.replaceChildren()
    items.forEach((item) => {
      const row = document.createElement('p'); row.dataset.workSelection = item.selectionRef
      if (item.state === 'unavailable') { row.textContent = 'Unavailable work selection. Review the current records and save a new selection.'; output.append(row); return }
      const link = document.createElement('a'); const url = new URL(location.href)
      url.search = new URLSearchParams({ sf: 'workbench-work', selectionRef: item.selectionRef, start: item.period.start, end: item.period.end }).toString()
      link.href = url.href; link.textContent = 'Open my work · ' + item.period.start + ' – ' + item.period.end
      link.addEventListener('click', (event) => { if (!active() || busy || (form.dataset.dirty && !confirm('Leave this unsaved or unconfirmed work selection?'))) event.preventDefault() })
      const inspect = document.createElement('button'); inspect.type = 'button'; inspect.textContent = 'Check pending work'
      const result = document.createElement('span'); result.setAttribute('role', 'status')
      inspect.addEventListener('click', async () => {
        if (!active() || busy || reading) return
        reading = true; const generation = ++readGeneration; sync(); result.textContent = 'Checking current work…'
        try {
          const cycle = await send('collaboration-cycle-read', { caseRef: context.caseRef, selection: { selectionRef: item.selectionRef, period: item.period } })
          if (!active() || generation !== readGeneration || !row.isConnected) return
          if (cycle?.caseRef !== context.caseRef || JSON.stringify(cycle.period) !== JSON.stringify(item.period) || !Array.isArray(cycle.questions) || !Array.isArray(cycle.work?.items) || !['empty', 'active'].includes(cycle.state) || cycle.state === 'empty' && (cycle.questions.length || cycle.work.items.length)) throw new Error('cycle-unavailable')
          result.textContent = cycle.state === 'empty' ? 'This selection is configured; there are no pending work items or questions.' : cycle.work.items.length + ' work items and ' + cycle.questions.length + ' questions are currently available.'
        } catch (error) { if (active() && generation === readGeneration && !error?.ignored) result.textContent = 'Current work is unavailable. This does not mean there are no pending items.' }
        finally { if (generation === readGeneration) { reading = false; sync() } }
      })
      row.append(link, ' ', inspect, ' ', result); output.append(row)
    })
  }
  load.addEventListener('click', async () => {
    if (!active() || busy || reading) return
    reading = true; const generation = ++readGeneration; sync(); status.textContent = 'Loading saved selections…'
    try {
      const items = await send('collaboration-selection-list', { caseRef: context.caseRef })
      if (!active() || generation !== readGeneration) return
      render(items)
      status.textContent = pending ? 'Saved selections loaded. Your original save is still unconfirmed; retry that same selection to reconcile it.' : rejected ? 'Saved selections loaded. Review your rejected request before starting a new selection.' : items.length ? 'Choose a saved selection or check its current work.' : 'No work selection is configured for this decision. Choose records and a period, then save.'
    } catch (error) { if (active() && generation === readGeneration && !error?.ignored) status.textContent = 'Saved selections are unavailable. Your current record and period choices are preserved.' }
    finally { if (generation === readGeneration) { reading = false; sync() } }
  })
  const changed = () => {
    if (!active()) return
    if (busy || pending || rejected) {
      const original = pending || rejected
      if (original) fields.forEach((field) => { if (field.name === 'source') field.checked = original.sources.includes(field.value); if (field.name === 'start') field.value = original.period.start; if (field.name === 'end') field.value = original.period.end })
      return
    }
    key = crypto.randomUUID(); form.dataset.dirty = 'true'
  }
  form.addEventListener('input', changed); form.addEventListener('change', changed)
  reviewRejected.addEventListener('click', async () => {
    if (!active() || busy || reading || pending || !rejected) return
    busy = true; sync(); status.textContent = 'Reviewing the current decision and selection state…'
    try {
      await currentCase()
      const version = await send('collaboration-selection-version', {})
      if (!Number.isSafeInteger(version) || version < 0) throw new Error('selection-version-unavailable')
      rejected = undefined; key = crypto.randomUUID(); reviewRejected.hidden = true; status.textContent = 'The rejected request was not saved. Review your preserved records and period before saving a new selection.'
    } catch (error) {
      if (!active() || error?.ignored) return
      if (error?.caseChanged) { review.hidden = false; status.textContent = 'This decision changed. Your rejected selection is preserved; reload the decision to review its current sources.' }
      else status.textContent = 'The current selection could not be reviewed. Your rejected request remains preserved.'
    } finally { busy = false; sync() }
  })
  review.addEventListener('click', () => { if (active() && !busy && !pending && confirm('Reload the decision and discard this unsaved work selection?')) location.reload() })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || busy || reading || submit.disabled) return
    if (!pending && !form.reportValidity()) return
    const values = new FormData(form), selected = values.getAll('source').map(String), period = { start: String(values.get('start') || ''), end: String(values.get('end') || '') }
    const refs = context.sources.filter((source) => selected.includes(source.refDigest))
    if (!pending && (!selected.length || new Set(selected).size !== selected.length || refs.length !== selected.length || !validPeriod(period) || period.start < context.horizon.start || period.end > context.horizon.end || refs.some((source) => !source.target.period || source.target.period.start > period.start || source.target.period.end < period.end))) { status.textContent = 'Choose at least one record and a period covered by every selected record and this decision.'; return }
    busy = true; epoch++; readGeneration++; reading = false; form.dataset.dirty = 'true'; sync(); status.textContent = pending ? 'Checking the same saved selection…' : 'Checking the decision and saving your selection…'
    try {
      if (!pending) {
        await currentCase()
        const version = await send('collaboration-selection-version', {})
        if (!Number.isSafeInteger(version) || version < 0) throw new Error('selection-version-unavailable')
        pending = { key, sources: selected, period, uncertain: false, body: JSON.stringify({ draft: { caseRef: context.caseRef, period, sourceRefs: refs }, mutation: { expectedStorageVersion: version, idempotencyKey: key } }) }
      }
      const saved = await send('collaboration-selection-create', undefined, pending.key, pending.body)
      if (typeof saved?.selectionRef !== 'string' || !saved.selectionRef.trim() || Object.keys(saved).some((name) => name !== 'selectionRef')) throw new Error('selection-receipt-unavailable')
      const confirmed = { selectionRef: saved.selectionRef, period: pending.period, state: 'active' }
      pending = undefined; key = crypto.randomUUID(); delete form.dataset.dirty; review.hidden = true
      // The private create contract binds the current case, not a caller-supplied
      // expected case version. Re-read before presenting this acknowledgement as
      // active in the case the user reviewed. A received acknowledgement remains
      // saved even if that subsequent read fails; it must never become a retry.
      try { await currentCase(); render([confirmed]); status.textContent = 'Work selection saved. Open your work or check its current pending items.' }
      catch (error) {
        if (!active() || error?.ignored) return
        output.replaceChildren()
        if (error?.caseChanged) { review.hidden = false; status.textContent = 'The selection was saved, but this decision changed. Reload the decision to review its current sources before opening work.' }
        else status.textContent = 'The selection was saved, but the current decision could not be rechecked. Load saved selections to confirm what is currently available.'
      }
    } catch (error) {
      if (!active() || error?.ignored) return
      if (error?.caseChanged) { review.hidden = false; status.textContent = 'This decision changed. Your choices are preserved; reload the decision to review its current sources before saving.' }
      else if (pending && !pending.uncertain && error?.beforeCommitConflict) { rejected = pending; pending = undefined; reviewRejected.hidden = false; status.textContent = 'The selection was not saved because its protected state changed. Review the rejected selection before starting a new request.' }
      else if (pending && !pending.uncertain && error?.beforeCommitInvalid) { pending = undefined; key = crypto.randomUUID(); status.textContent = 'The selection request was rejected before saving. Review your preserved records and period.' }
      else if (pending) { pending.uncertain = true; status.textContent = 'Could not confirm the selection. Your records and period are locked; retry the same selection.' }
      else status.textContent = 'The current decision or selection version could not be confirmed. Your choices are preserved; try again.'
    } finally { busy = false; sync() }
  })
})
`
