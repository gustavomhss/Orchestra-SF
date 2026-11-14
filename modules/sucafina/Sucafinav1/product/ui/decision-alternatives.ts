import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../contracts/decisions.ts"
import { requiredSfCostCategories } from "../contracts/coverage-inventory.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { esc } from "../../src/screen-shell.ts"

type DecisionAction = "decision-edit" | "decision-coverage" | "decision-promote"

/** Freeze bytes before dispatch: an uncertain response must never create a different intention. */
export function createDecisionIntention(action: DecisionAction, payload: object, key: string) {
  if (!["decision-edit", "decision-coverage", "decision-promote"].includes(action) || !key.trim() || key.length > 128) throw new Error("invalid-decision-intention")
  const body = JSON.stringify(payload)
  if (!body || new TextEncoder().encode(body).byteLength > 262144) throw new Error("invalid-decision-payload")
  return Object.freeze({ action, key, body })
}

export function decisionFormContext(projection: AuthorizedCaseProjection) {
  const item = projection.case
  return {
    scope: JSON.stringify([projection.context.installationId, projection.context.projectId, projection.context.principalRef, item.id, item.incarnation]),
    authority: projection.context, caseRef: { id: item.id, incarnation: item.incarnation, version: item.version },
    caseSelector: encodeCaseRef(item), horizon: item.horizon, currency: item.currency, sourceRefs: item.sourceRefs,
  }
}

/** Start with human-selected, existing Planner scenarios. Coverage never supplies amounts. */
export function decisionAlternativesForm(projection: AuthorizedCaseProjection) {
  const context = { ...decisionFormContext(projection), bases: projection.case.costCoverageBases.filter((basis) => requiredSfCostCategories(basis)), categories: RENEWAL_TRANSITION_CATEGORIES }
  return `<section aria-label="Initial alternatives"><h3>Add an alternative</h3><p>Select an attached Planner version and inspect its current amounts. The scenario keeps that version's values. Creating an alternative neither changes the official plan nor approves a purchase.</p><form data-decision-alternatives data-context="${esc(JSON.stringify(context))}"><button type="button" data-alternative-discover>Load attached scenarios</button><label>Source for alternative<select name="source" required disabled><option value="">Load attached scenarios first</option></select></label><button type="button" data-alternative-inspect disabled>Inspect scenario</button><div data-alternative-preview aria-live="polite"></div><label>Alternative title<input name="title" required maxlength="500"></label><label>Cost inventory<select name="basis" required disabled><option value="">Inspect a scenario first</option></select></label><div data-alternative-inventory></div><label>Reason for pending cost review<textarea name="coverage-reason" maxlength="2000"></textarea></label><button type="button" data-alternative-coverage disabled>Save pending coverage</button><button type="submit" disabled>Create alternative</button><button type="button" data-alternative-retry hidden style="display:none">Retry same request</button><button type="button" data-alternative-review hidden style="display:none">Review current case</button><p role="status" aria-live="polite"></p><div data-alternative-current></div></form></section>`
}

// Shared transport/state code runs inside each mounted form. It is not an authorization port.
export const decisionScriptHelpers = `
  const freezeIntention = ${createDecisionIntention.toString()}
  const storageKey = 'sf:decision-ui:' + context.scope
  const status = form.querySelector('p[role=status]')
  const accessTarget = document.querySelector('#content') || form.closest('main') || form
  let busy = false; let denied = false; let quarantined = false; let quarantinePanel
  const live = () => !denied && !quarantined && form.isConnected
  const present = () => !denied && (form.isConnected || !!quarantinePanel?.isConnected)
  const same = (left, right) => {
    const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
  }
  const sameCase = (value) => !!value && value.id === context.caseRef.id && value.incarnation === context.caseRef.incarnation && value.version === context.caseRef.version
  const sameAuthority = (value) => !!value && ['installationId', 'projectId', 'principalRef', 'accessRevision', 'policyVersion'].every((key) => value[key] === context.authority[key])
  const endpoint = (action, parameters = {}) => {
    const url = new URL(location.href)
    if (!/\\/(dashboard|planner|procurement)$/.test(url.pathname)) throw new Error('unsupported-surface')
    url.pathname = url.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/dashboard')
    url.search = new URLSearchParams({ sf: action, ...parameters }).toString(); url.hash = ''
    return url
  }
  const shown = (element, visible) => { element.hidden = !visible; element.style.display = visible ? '' : 'none' }
  const hold = () => document.querySelectorAll('[data-decision-edit], [data-decision-alternatives]').forEach((other) => {
    if (other !== form) { other.inert = true; other.dataset.decisionHeld = 'true' }
  })
  const release = () => document.querySelectorAll('[data-decision-held]').forEach((other) => { other.inert = false; delete other.dataset.decisionHeld })
  const clearAccess = () => {
    if (!present()) return
    denied = true
    try {
      Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).forEach((key) => {
        if (key === storageKey || key?.startsWith(storageKey + ':')) sessionStorage.removeItem(key)
      })
    } catch {}
    const message = document.createElement('p'); message.setAttribute('role', 'status')
    message.textContent = form.hasAttribute('data-decision-edit') ? 'Your access changed. Reload before editing this decision.' : 'Decision access is no longer available. Protected content has been removed.'
    delete form.dataset.context; delete form.dataset.dirty
    form.replaceChildren(message)
    if (accessTarget !== form) accessTarget.replaceChildren(form)
  }
  window.addEventListener('sf-access-revoked', clearAccess, true)
  const httpError = (response, result, fallback = 'uncertain') => {
    const rejected = [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'conflict', 'stale'].includes(result?.status)
    return Object.assign(new Error(response.status === 409 || ['conflict', 'stale'].includes(result?.status) ? 'conflict' : rejected ? 'rejected' : fallback),
      { status: response.status, rejected, reason: typeof result?.reason === 'string' ? result.reason : undefined })
  }
  const read = async (action, parameters) => {
    const response = await fetch(endpoint(action, parameters), { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!live()) throw new Error('detached')
    if (response.status === 401 || response.status === 403) { clearAccess(); throw new Error('denied') }
    const result = await response.json()
    if (!live()) throw new Error('detached')
    if (result.status === 'denied') { clearAccess(); throw new Error('denied') }
    if (!response.ok || result.status && result.status !== 'ok') throw httpError(response, result, 'unavailable')
    return result.status === 'ok' ? result.value : result
  }
  const coverageCase = async (saved) => {
    const payload = JSON.parse(saved.intent.body)
    if (saved.intent.action !== 'decision-coverage' || !payload.source?.refDigest) throw new Error('unavailable')
    const response = await fetch(endpoint('decision-controls', { case: context.caseSelector, source: payload.source.refDigest, format: 'json' }),
      { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!present()) throw new Error('detached')
    if (response.status === 401 || response.status === 403) { clearAccess(); throw new Error('denied') }
    const result = await response.json()
    if (!present()) throw new Error('detached')
    if (result.status === 'denied') { clearAccess(); throw new Error('denied') }
    if (!response.ok || result.status !== 'ok') throw new Error('unavailable')
    const value = result.value; const selected = value?.selected; const forecast = selected?.forecast; const projection = forecast?.projection
    if (!selected?.caseRef || selected.caseRef.id !== payload.caseRef.id || selected.caseRef.incarnation !== payload.caseRef.incarnation ||
      !Number.isSafeInteger(selected.caseRef.version) || selected.caseRef.version <= payload.caseRef.version ||
      !same(forecast?.source, payload.source) || !sameAuthority(projection?.context) || value.accessRevision !== projection.context.accessRevision ||
      projection.context.surface !== 'planner' || projection.context.currency !== selected.decision?.currency ||
      !same(projection.context.period, selected.decision?.horizon) || !Array.isArray(projection.components) || !Array.isArray(projection.values)) throw new Error('unavailable')
    return selected
  }
  const quarantine = (saved) => {
    if (!present()) return
    saved.quarantine = true
    try { sessionStorage.setItem(storageKey, JSON.stringify(saved)) } catch {}
    quarantined = true; hold()
    const panel = document.createElement('section'); panel.setAttribute('aria-label', 'Decision request awaiting access check')
    const message = document.createElement('p'); message.setAttribute('role', 'alert')
    message.textContent = 'Current access and the earlier coverage result could not be confirmed. Protected content is hidden. The original request remains blocked until an authorized read succeeds.'
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Recheck current access'
    panel.append(message, button); quarantinePanel = panel; accessTarget.replaceChildren(panel)
    button.addEventListener('click', async () => {
      if (denied || !panel.isConnected || button.disabled) return
      button.disabled = true; message.textContent = 'Checking current access without resubmitting the request…'
      try {
        await coverageCase(saved)
        if (!present()) return
        saved.quarantine = false
        sessionStorage.setItem(storageKey, JSON.stringify(saved))
        location.assign(endpoint('workbench-case', { caseRef: context.caseSelector }))
      } catch { if (present()) message.textContent = 'Current access or the changed case could not be confirmed. The original request remains blocked; no mutation was sent.' }
      finally { if (present()) button.disabled = false }
    })
  }
  const active = () => {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return undefined
    const saved = JSON.parse(raw); const intent = saved.intent
    if (saved.scope !== context.scope || !intent || !['decision-edit', 'decision-coverage', 'decision-promote'].includes(intent.action) || typeof intent.body !== 'string' || new TextEncoder().encode(intent.body).byteLength > 262144 || typeof intent.key !== 'string' || !intent.key.trim() || intent.key.length > 128) throw new Error('invalid-retained-intention')
    const payload = JSON.parse(intent.body)
    if (!payload.caseRef || payload.caseRef.id !== context.caseRef.id || payload.caseRef.incarnation !== context.caseRef.incarnation || !Number.isSafeInteger(payload.caseRef.version) || payload.caseRef.version < 1 || payload.caseRef.version > context.caseRef.version) throw new Error('invalid-retained-intention')
    if (saved.quarantine === true) { quarantine(saved); throw new Error('quarantined') }
    return { ...saved, intent: Object.freeze({ action: intent.action, key: intent.key, body: intent.body }) }
  }
  const begin = (action, payload, draft) => {
    if (active()) throw new Error('unconfirmed-intention')
    const saved = { scope: context.scope, intent: freezeIntention(action, payload, crypto.randomUUID()), draft, uncertain: false, quarantine: false }
    sessionStorage.setItem(storageKey, JSON.stringify(saved)); hold(); return saved
  }
  const settle = () => { sessionStorage.removeItem(storageKey); release() }
  const send = async (saved) => {
    if (saved.quarantine) { quarantine(saved); throw new Error('quarantined') }
    if (!live()) throw new Error('detached')
    const retained = active()
    if (!retained || !same(retained.intent, saved.intent)) throw new Error('invalid-retained-intention')
    saved.uncertain = true; saved.quarantine = false
    sessionStorage.setItem(storageKey, JSON.stringify(saved))
    const response = await fetch(endpoint(saved.intent.action), { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': saved.intent.key }, body: saved.intent.body })
    if (!live()) throw new Error('detached')
    if (response.status === 401) { clearAccess(); throw new Error('denied') }
    let result
    try { result = await response.json() } catch (error) { if (response.status === 403) clearAccess(); throw error }
    if (!live()) throw new Error('detached')
    if (response.status === 403 && saved.intent.action === 'decision-coverage' && result?.status === 'denied' && result.reason === 'case-selection-unavailable') {
      try { await coverageCase(saved) }
      catch (error) { if (present()) quarantine(saved); throw error }
      throw Object.assign(new Error('conflict'), { status: 409, rejected: false, reason: 'coverage-case-version-changed' })
    }
    if (response.status === 403 || result.status === 'denied') { clearAccess(); throw new Error('denied') }
    if (!response.ok || result.status !== 'ok') throw httpError(response, result)
    return result.value
  }
  const project = (projection) => !!projection && sameAuthority(projection.context) && projection.context.surface === 'planner' && projection.context.currency === context.currency && same(projection.context.period, context.horizon) && Array.isArray(projection.components) && Array.isArray(projection.values)
  const showProjection = (target, projection, label) => {
    target.replaceChildren()
    const summary = document.createElement('p'); summary.textContent = label + ' · ' + context.currency + ' · ' + context.horizon.start + ' – ' + context.horizon.end; target.append(summary)
    const list = document.createElement('ul')
    projection.values.forEach((value) => {
      const line = document.createElement('li')
      line.textContent = value.id + ': ' + (value.value == null ? 'Unavailable' : String(value.value)) + ' ' + (value.currency || value.unit || '') + ' · ' + value.period.start + ' – ' + value.period.end + ' · ' + value.granularity + ' · ' + value.evidenceState
      list.append(line)
    })
    projection.components.forEach((component) => {
      const line = document.createElement('li')
      line.textContent = 'Component: ' + (component.amount == null ? 'Unavailable' : String(component.amount)) + ' ' + component.currency + ' · ' + component.period.start + ' – ' + component.period.end + ' · ' + component.evidenceState
      list.append(line)
    })
    projection.missing.forEach((missing) => { const line = document.createElement('li'); line.textContent = missing.field + ' · ' + missing.reason; list.append(line) })
    target.append(list); target.dataset.state = 'ready'
  }
  const currentCase = async (target) => {
    const value = await read('decision-controls', { case: context.caseSelector, format: 'json' })
    if (!live()) return
    if (!value.selected || value.selected.caseRef.id !== context.caseRef.id || value.selected.caseRef.incarnation !== context.caseRef.incarnation) throw new Error('case-unavailable')
    target.replaceChildren()
    const summary = document.createElement('p'); summary.textContent = 'Current decision: ' + value.selected.decision.objective + ' · version ' + value.selected.caseRef.version + '. Your unconfirmed request is unchanged.'; target.append(summary)
    value.selected.decision.alternatives.forEach((item) => { const line = document.createElement('p'); line.textContent = item.title + ' · alternative revision ' + item.version; target.append(line) })
    const link = document.createElement('a'); link.href = endpoint('workbench-case', { caseRef: context.caseSelector }).href; link.textContent = 'Reopen current decision'; target.append(link)
    return value.selected
  }

`

export const decisionAlternativesScript = `
document.querySelectorAll('[data-decision-alternatives]').forEach((form) => {
  if (form.dataset.sfAlternativesReady) return; form.dataset.sfAlternativesReady = 'true'
  const context = JSON.parse(form.dataset.context); delete form.dataset.context
  ${decisionScriptHelpers}
  const source = form.elements.namedItem('source'); const title = form.elements.namedItem('title'); const basis = form.elements.namedItem('basis')
  const reason = form.elements.namedItem('coverage-reason'); const discover = form.querySelector('[data-alternative-discover]'); const inspect = form.querySelector('[data-alternative-inspect]')
  const coverage = form.querySelector('[data-alternative-coverage]'); const submit = form.querySelector('button[type=submit]'); const retry = form.querySelector('[data-alternative-retry]'); const review = form.querySelector('[data-alternative-review]')
  const preview = form.querySelector('[data-alternative-preview]'); const inventory = form.querySelector('[data-alternative-inventory]'); const current = form.querySelector('[data-alternative-current]')
  let choices = []; let loaded; let prepared; let newBasis; let pending
  const lock = (value) => { form.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = value }) }
  const ready = () => {
    lock(false); source.disabled = !choices.length || !!prepared; discover.disabled = !!prepared; inspect.disabled = !source.value || !!prepared; basis.disabled = !loaded || !!prepared
    coverage.disabled = !loaded || !!prepared || loaded.expectedVersion !== 0 || !basis.value
    reason.disabled = !!prepared; submit.disabled = !prepared
    shown(retry, false); shown(review, false)
  }
  const unresolved = (error) => {
    if (!live()) return
    lock(true); retry.disabled = false; review.disabled = false; shown(retry, true); shown(review, true)
    status.textContent = error.message === 'conflict' ? 'The case or coverage changed. Your entries and exact request are preserved. Review the current case before retrying.' : 'Could not confirm the save. Your entries are preserved. Retry same request to recover its result.'
  }
  const renderInventory = () => {
    inventory.replaceChildren()
    const selected = basis.value === 'new' ? newBasis : context.bases.find((item) => item.id + ':' + item.version === basis.value)
    if (!selected) return
    const note = document.createElement('p'); note.textContent = prepared ? 'Saved coverage is reused without replacing its classification.' : 'These costs remain pending. No absent amount becomes zero; the comparison stays conditioned until its evidence is reviewed.'; inventory.append(note)
    const list = document.createElement('ul')
    ;[...selected.categoryIds, ...selected.additionalCategoryIds].forEach((category) => { const item = document.createElement('li'); item.textContent = category.replaceAll('_', ' ') + (prepared ? '' : ' · pending'); list.append(item) })
    inventory.append(list)
  }
  const rememberCoverage = (value, saved) => {
    const payload = JSON.parse(saved.intent.body)
    if (!value || typeof value.coverageRef !== 'string' || !value.coverageRef || !Number.isSafeInteger(value.version) || value.version !== payload.expectedVersion + 1) throw new Error('uncertain')
    prepared = { scope: context.scope, caseRef: payload.caseRef, source: payload.source, basis: payload.basis, coverageRef: value.coverageRef, version: value.version, title: saved.draft?.title || '' }
    sessionStorage.setItem(storageKey + ':coverage', JSON.stringify(prepared))
    if (!context.bases.some((item) => same(item, prepared.basis))) context.bases.push(prepared.basis)
  }
  const execute = async (saved) => {
    if (busy) return
    const reconciling = saved.uncertain === true
    busy = true; lock(true); hold(); status.textContent = saved.intent.action === 'decision-coverage' ? 'Saving pending coverage…' : 'Creating alternative…'
    try {
      const result = await send(saved)
      if (saved.intent.action === 'decision-coverage') {
        rememberCoverage(result, saved); settle(); pending = undefined
        status.textContent = 'Pending coverage saved. Create the alternative when ready.'
        if (!loaded) { status.textContent += ' Inspect the same scenario to verify its current source.'; prepared = undefined }
        ready(); renderInventory()
      } else {
        const payload = JSON.parse(saved.intent.body)
        if (!result?.caseRef || result.caseRef.id !== context.caseRef.id || result.caseRef.incarnation !== context.caseRef.incarnation || result.caseRef.version !== payload.caseRef.version + 1 || typeof result.resultRef !== 'string' || !result.resultRef.startsWith('decision-result:')) throw new Error('uncertain')
        settle(); sessionStorage.removeItem(storageKey + ':coverage'); delete form.dataset.dirty
        status.textContent = 'Alternative saved.'; location.assign(endpoint('workbench-case', { caseRef: context.caseSelector }))
      }
    } catch (error) {
      if (live() && error.rejected && !reconciling && [400, 422].includes(error.status)) {
        settle(); pending = undefined; ready(); status.textContent = 'The request was rejected. Review your entries and save explicitly when ready.'
      } else unresolved(error)
    }
    finally { busy = false }
  }
  discover.addEventListener('click', async () => {
    if (busy || pending) return
    busy = true; lock(true); preview.replaceChildren(); delete preview.dataset.state; loaded = undefined; prepared = undefined
    status.textContent = 'Loading attached scenarios…'
    try {
      const result = await read('decision-controls', { case: context.caseSelector, format: 'json' })
      if (!sameCase(result.selected?.caseRef)) throw new Error('conflict')
      const options = await read('bi-options', { viewId: 'BI01', start: context.horizon.start, end: context.horizon.end })
      if (!live()) return
      choices = result.selected.forecasts.filter((item) => item.source.kind === 'record' && item.source.target.surface === 'planner' && item.source.target.recordType === 'planner-version' && context.sourceRefs.some((ref) => ref.refDigest === item.source.refDigest && same(ref, item.source)))
      source.replaceChildren(new Option('Select an attached scenario', ''))
      choices.forEach((item) => { const labels = options.versions.filter((entry) => entry.ref === item.source.refId); source.append(new Option(labels.length === 1 ? labels[0].label : item.label, item.source.refDigest)) })
      status.textContent = choices.length ? 'Choose an attached scenario to inspect.' : 'No attached Planner scenarios are currently available. Attach sources in Edit decision and save first.'
    } catch (error) { if (live()) { choices = []; source.replaceChildren(); status.textContent = error.message === 'conflict' ? 'The case changed. Reopen it; your title is preserved.' : 'Attached scenarios are unavailable. Recheck current access and sources.' } }
    finally { busy = false; if (live()) ready() }
  })
  source.addEventListener('change', () => { loaded = undefined; prepared = undefined; preview.replaceChildren(); delete preview.dataset.state; inventory.replaceChildren(); basis.replaceChildren(); ready() })
  basis.addEventListener('change', () => { prepared = undefined; renderInventory(); ready() })
  title.addEventListener('input', () => { form.dataset.dirty = 'true' })
  inspect.addEventListener('click', async () => {
    if (busy || pending) return
    const selected = choices.find((item) => item.source.refDigest === source.value)
    if (!selected) return
    busy = true; lock(true); loaded = undefined; prepared = undefined; preview.replaceChildren(); delete preview.dataset.state; status.textContent = 'Inspecting current scenario…'
    try {
      const result = await read('decision-controls', { case: context.caseSelector, source: selected.source.refDigest, format: 'json' })
      const forecast = result.selected?.forecast
      if (!sameCase(result.selected?.caseRef) || result.accessRevision !== context.authority.accessRevision || !forecast || !same(forecast.source, selected.source) || !project(forecast.projection) || !Number.isSafeInteger(forecast.expectedVersion) || forecast.expectedVersion < 0) throw new Error('conflict')
      loaded = forecast
      const retainedText = sessionStorage.getItem(storageKey + ':coverage')
      const retained = retainedText ? JSON.parse(retainedText) : undefined
      // A confirmed inventory can precede the first promotion; keep its exact identity across reload/source changes.
      if (!context.bases.length && retained?.scope === context.scope && retained.caseRef?.id === context.caseRef.id && retained.caseRef?.incarnation === context.caseRef.incarnation && retained.basis?.decisionType === 'renewal-transition-v1' && Number.isSafeInteger(retained.basis.version) && retained.basis.version > 0 && typeof retained.basis.id === 'string' && same(retained.basis.categoryIds, context.categories) && same(retained.basis.additionalCategoryIds, []) && Array.isArray(retained.basis.sourceRefs) && retained.basis.sourceRefs.every((ref) => context.sourceRefs.some((current) => same(ref, current)))) context.bases.push(retained.basis)
      basis.replaceChildren(new Option('Choose the cost inventory', ''))
      context.bases.forEach((item) => basis.append(new Option(item.decisionType + ' · revision ' + item.version, item.id + ':' + item.version)))
      newBasis = { id: 'human-cost-inventory:' + crypto.randomUUID(), version: 1, decisionType: 'renewal-transition-v1', categoryIds: context.categories, additionalCategoryIds: [], sourceRefs: context.sourceRefs.filter((ref) => ref.kind === 'record' && ref.target.surface === 'planner' && ref.target.recordType === 'planner-version') }
      if (!context.bases.length) basis.append(new Option('Renewal / transition cost inventory · revision 1', 'new'))
      if (context.bases.length === 1) basis.value = context.bases[0].id + ':' + context.bases[0].version
      const existing = forecast.coverage
      if (existing && typeof existing.coverageRef === 'string' && existing.coverageRef && same(existing.basis, forecast.classification?.basis) && existing.assessment?.basisId === existing.basis.id && existing.assessment?.basisVersion === existing.basis.version) {
        prepared = { scope: context.scope, caseRef: context.caseRef, source: forecast.source, basis: existing.basis, coverageRef: existing.coverageRef, version: forecast.expectedVersion }
      } else if (retained?.scope === context.scope && same(retained.source, forecast.source) && retained.version === forecast.expectedVersion && same(retained.basis, forecast.classification?.basis)) prepared = retained
      if (prepared) {
        if (context.bases.some((item) => item.id === prepared.basis.id && item.version === prepared.basis.version && !same(item, prepared.basis))) throw new Error('conflict')
        const value = prepared.basis.id + ':' + prepared.basis.version
        if (!Array.from(basis.options).some((option) => option.value === value)) basis.append(new Option(prepared.basis.decisionType + ' · revision ' + prepared.basis.version, value))
        basis.value = value
        if (!context.bases.some((item) => item.id === prepared.basis.id && item.version === prepared.basis.version)) context.bases.push(prepared.basis)
      }
      showProjection(preview, forecast.projection, source.selectedOptions[0].textContent)
      status.textContent = prepared ? 'Current coverage loaded. Create the alternative when ready.' : forecast.expectedVersion === 0 ? 'Inspect the amounts and select the cost inventory. Unreviewed categories will remain pending.' : 'Saved coverage could not be reopened. Return to the tab that saved it, or review the current case before continuing.'
      renderInventory()
    } catch { if (live()) { loaded = undefined; prepared = undefined; status.textContent = 'The scenario, case or coverage is unavailable or changed. Your title is preserved; recheck the current source.' } }
    finally { busy = false; if (live()) ready() }
  })
  coverage.addEventListener('click', () => {
    if (busy || pending || !loaded || loaded.expectedVersion !== 0) return
    const selectedBasis = basis.value === 'new' ? newBasis : context.bases.find((item) => item.id + ':' + item.version === basis.value)
    if (!selectedBasis || !reason.value.trim()) { status.textContent = 'Select the inventory and explain why its cost categories remain pending.'; reason.focus(); return }
    try {
      pending = begin('decision-coverage', { caseRef: context.caseRef, source: loaded.source, basis: selectedBasis, entries: [...selectedBasis.categoryIds, ...selectedBasis.additionalCategoryIds].map((categoryId) => ({ categoryId, status: 'pending', reason: reason.value.trim() })), expectedVersion: loaded.expectedVersion }, { title: title.value, source: loaded.source.refDigest })
      execute(pending)
    } catch { if (live()) { status.textContent = 'Could not retain the intention safely. Reopen any unconfirmed request before starting another save.'; lock(true) } }
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault(); if (busy || pending || !prepared || !loaded || !form.reportValidity()) return
    if (!title.value.trim()) { status.textContent = 'Enter an alternative title before creating it.'; title.focus(); return }
    try {
      pending = begin('decision-promote', { caseRef: context.caseRef, title: title.value.trim(), scenario: { baseRef: loaded.source.refId, operations: [], assumptions: [] }, coverageRef: prepared.coverageRef }, { title: title.value, source: loaded.source.refDigest })
      execute(pending)
    } catch { if (live()) { status.textContent = 'Could not retain the intention safely. No new alternative was submitted.'; lock(true) } }
  })
  retry.addEventListener('click', () => { if (!busy && pending) execute(pending) })
  review.addEventListener('click', async () => {
    if (busy) return
    busy = true; review.disabled = true
    try { await currentCase(current) } catch { if (live()) current.textContent = 'Current decision is unavailable. The unconfirmed request remains unchanged.' }
    finally { busy = false; if (live()) review.disabled = false }
  })
  try {
    const saved = active()
    if (saved && saved.intent.action !== 'decision-edit') {
      pending = saved; title.value = typeof saved.draft?.title === 'string' ? saved.draft.title : ''; hold(); unresolved(new Error('uncertain'))
    } else if (saved) { form.inert = true; form.dataset.decisionHeld = 'true'; status.textContent = 'Resolve the unconfirmed decision edit before adding an alternative.' }
    else ready()
  } catch { lock(true); status.textContent = 'The retained request cannot be verified. Do not start another mutation; reopen the current decision to reconcile it.' }
})
`

