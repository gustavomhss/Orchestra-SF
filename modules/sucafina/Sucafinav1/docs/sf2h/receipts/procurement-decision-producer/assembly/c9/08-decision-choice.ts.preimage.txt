import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** A comparison and choice always use the saved alternatives and domain result. */
export function decisionChoiceForm(projection: AuthorizedCaseProjection) {
  const item = projection.case
  if (item.alternatives.length < 2) return "<p>Add at least two alternatives before comparing a choice.</p>"
  const context = { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, alternatives: item.alternatives.map((alternative) => ({ id: alternative.id, version: alternative.version, title: alternative.title, currency: alternative.result.currency, horizon: alternative.result.horizon })), criteria: item.criteria.map((criterion) => ({ id: criterion.id, description: criterion.description, required: criterion.required })) }
  const options = item.alternatives.map((alternative) => `<option value="${esc(alternative.id)}">${esc(alternative.title)}</option>`).join("")
  return `<section><h3>Compare and choose</h3><form data-decision-choice data-context="${esc(JSON.stringify(context))}"><label>Baseline<select name="baseline">${options}</select></label><label>Alternative<select name="alternative">${options}</select></label><fieldset><legend>Criteria</legend>${item.criteria.map((criterion) => `<label><input type="checkbox" name="criteria" value="${esc(criterion.id)}" checked${criterion.required ? " required" : ""}>${esc(criterion.description)}${criterion.required ? " (required)" : ""}</label>`).join("")}</fieldset><button type="button" data-compare>Compare</button><div data-comparison role="status" aria-live="polite"></div><button type="button" data-portfolio disabled>Use these alternatives in portfolio</button><details data-sensitivity hidden><summary>Explore sensitivity</summary><label>Criterion<select data-sensitivity-criterion><option value="">Choose a criterion</option>${item.criteria.map((criterion) => `<option value="${esc(criterion.id)}">${esc(criterion.description)}</option>`).join("")}</select></label><button type="button" data-sensitivity-rule>Load criterion and units</button><p data-sensitivity-basis></p><label>Minimum<input data-sensitivity-min type="number" step="any"></label><label>Maximum<input data-sensitivity-max type="number" step="any"></label><label>Sample steps<input data-sensitivity-steps type="number" min="1" max="1024" step="1"></label><button type="button" data-sensitivity-run>Evaluate sensitivity</button><div data-sensitivity-output role="status" aria-live="polite"></div></details><label>Reason for choosing<textarea name="reason" required></textarea></label><button type="submit" disabled>Record choice</button><p role="status" aria-live="polite"></p></form></section>`
}

export const decisionChoiceScript = `
document.querySelectorAll('[data-decision-choice]').forEach((form) => {
  if (form.dataset.sfChoiceReady) return; form.dataset.sfChoiceReady = 'true'
  let context = JSON.parse(form.dataset.context)
  const compare = form.querySelector('[data-compare]'); const choose = form.querySelector('button[type=submit]'); const portfolio = form.querySelector('[data-portfolio]')
  const output = form.querySelector('[data-comparison]'); const status = form.querySelector('p[role=status]')
  const sensitivity = form.querySelector('[data-sensitivity]'); const sensitivityOutput = form.querySelector('[data-sensitivity-output]'); const basis = form.querySelector('[data-sensitivity-basis]')
  const loadRule = sensitivity.querySelector('[data-sensitivity-rule]'); const evaluate = sensitivity.querySelector('[data-sensitivity-run]')
  let controls = [...form.querySelectorAll('select, input, textarea, button')]; const initial = new Map(controls.map((control) => [control, control.disabled]))
  let result; let rule; let key = crypto.randomUUID(); let portfolioKey = crypto.randomUUID(); let sensitivityKey = crypto.randomUUID()
  let pending; let snapshot; let busy = false; let accessRevoked = false; let reconciliationRequired = false; let completed = false
  const active = () => !accessRevoked && form.isConnected
  const locked = () => busy || !!pending || completed || reconciliationRequired
  const capture = () => controls.filter((control) => control.tagName !== 'BUTTON').map((control) => ({ control, value: control.value, checked: control.checked }))
  const restore = () => snapshot?.forEach(({ control, value, checked }) => { control.value = value; if (typeof checked === 'boolean') control.checked = checked })
  const sync = () => {
    if (!active()) return
    controls.forEach((control) => { control.disabled = locked() || initial.get(control) })
    compare.disabled = locked(); choose.disabled = busy || reconciliationRequired || (!completed && (!result || (!!pending && pending.kind !== 'choice')))
    portfolio.disabled = busy || completed || reconciliationRequired || !result || (!!pending && pending.kind !== 'portfolio')
    loadRule.disabled = locked() || !result; evaluate.disabled = busy || completed || reconciliationRequired || !result || !rule || (!!pending && pending.kind !== 'sensitivity')
    choose.textContent = completed ? 'Reload decision' : pending?.kind === 'choice' ? 'Retry the same choice' : 'Record choice'
    portfolio.textContent = pending?.kind === 'portfolio' ? 'Retry the same portfolio selection' : 'Use these alternatives in portfolio'
    evaluate.textContent = pending?.kind === 'sensitivity' ? 'Retry the same sensitivity request' : 'Evaluate sensitivity'
  }
  const begin = () => { if (!pending) snapshot = capture(); busy = true; sync() }
  const finish = () => { busy = false; if (!pending && !completed) snapshot = undefined; sync() }
  const revoke = () => {
    if (accessRevoked) return; accessRevoked = true; context = undefined; result = undefined; rule = undefined; pending = undefined; snapshot = undefined
    controls.forEach((control) => { if (control.tagName === 'SELECT') control.replaceChildren(); else if (control.tagName !== 'BUTTON') { control.value = ''; if ('checked' in control) control.checked = false }; control.disabled = true })
    controls = []; initial.clear(); output.replaceChildren(); sensitivityOutput.replaceChildren(); basis.textContent = ''; delete form.dataset.context; delete form.dataset.dirty
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Decision access changed. Reopen it with your current access.'; form.replaceChildren(message)
  }
  addEventListener('sf-access-revoked', () => { if (form.isConnected) revoke() })
  const invalidate = () => {
    if (!active()) return; if (locked()) { restore(); return }
    result = undefined; rule = undefined; sensitivity.hidden = true; output.textContent = 'Compare the current selection before recording a choice.'; basis.textContent = ''; sensitivityOutput.replaceChildren()
    key = crypto.randomUUID(); portfolioKey = crypto.randomUUID(); sensitivityKey = crypto.randomUUID(); form.dataset.dirty = 'true'; sync()
  }
  form.querySelectorAll('select[name=baseline], select[name=alternative], input[name=criteria]').forEach((input) => input.addEventListener('change', invalidate))
  form.querySelector('textarea').addEventListener('input', () => { if (!active()) return; if (locked()) { restore(); return }; key = crypto.randomUUID(); form.dataset.dirty = 'true' })
  const send = async (action, payload, id) => {
    const url = new URL(location.href); url.search = '?sf=' + action
    const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) })
      if (accessRevoked || response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true })
      const value = await response.json()
      if (accessRevoked) throw Object.assign(new Error('access-changed'), { accessDenied: true })
      if (!response.ok || value.status !== 'ok') throw Object.assign(new Error('unavailable'), { httpStatus: response.status, rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'conflict'].includes(value.status) })
      if (!active()) throw new Error('closed')
      return value.value
    } finally { clearTimeout(deadline) }
  }
  const rejected = (error, wasUncertain, message, kind) => {
    if (error?.accessDenied) { revoke(); return true }
    if (!active()) return true
    // Sensitivity may persist its result before a binding conflict is returned.
    // An initial 409 therefore cannot release that request's body or key.
    if (error?.rejected && pending && !pending.resultRef && !(pending.kind === 'sensitivity' && error.httpStatus === 409 && !wasUncertain)) {
      if (wasUncertain) { reconciliationRequired = true; message.textContent = 'The retry was rejected but the earlier ' + kind + ' is still unconfirmed. Reopen the decision to reconcile its current state.' }
      else { pending = undefined; key = crypto.randomUUID(); portfolioKey = crypto.randomUUID(); sensitivityKey = crypto.randomUUID(); message.textContent = 'The ' + kind + ' was rejected. Your entries are preserved; review the current decision before retrying.' }
      return true
    }
    return false
  }
  compare.addEventListener('click', async () => {
    if (!active() || locked() || compare.disabled) return
    const fields = new FormData(form); const baseline = fields.get('baseline'); const alternative = fields.get('alternative'); const criteria = fields.getAll('criteria')
    if (baseline === alternative || context.criteria.some((criterion) => criterion.required && !criteria.includes(criterion.id))) { output.textContent = 'Select two different alternatives and all required criteria.'; return }
    begin(); rule = undefined; sensitivity.hidden = true; output.textContent = 'Comparing alternatives…'
    try {
      const compared = await send('decision-compare', { caseRef: context.caseRef, baselineAlternativeId: baseline, alternativeId: alternative, criteria }, crypto.randomUUID())
      result = { request: compared.request, baselineAlternativeId: baseline, alternativeId: alternative, criteria }; key = crypto.randomUUID(); portfolioKey = crypto.randomUUID()
      const value = compared.comparison; output.replaceChildren()
      const summary = document.createElement('p'); summary.textContent = 'Comparison: ' + value.comparisonStatus + ' · ' + (value.comparisonStatus === 'complete' ? 'Difference: ' + value.completeDifference : 'Known difference: ' + (value.knownDifference ?? 'unavailable')); output.append(summary)
      ;[baseline, alternative].forEach((id) => { const source = context.alternatives.find((item) => item.id === id); if (!source) return; const line = document.createElement('p'); line.textContent = source.title + ' · ' + source.currency + ' · ' + source.horizon.start + ' – ' + source.horizon.end; output.append(line) })
      value.unresolvedConditions.forEach((condition) => { const line = document.createElement('p'); line.textContent = condition; output.append(line) })
      value.criterionResults.forEach((criterion) => { const line = document.createElement('p'); line.textContent = (context.criteria.find((item) => item.id === criterion.criterionId)?.description || 'Criterion') + ': ' + criterion.state + ' · ' + criterion.reason; output.append(line) })
      sensitivity.hidden = false
    } catch (error) { if (error?.accessDenied) revoke(); else if (active()) { result = undefined; output.textContent = 'Comparison unavailable or sources changed. Check the alternatives and try again.' } }
    finally { finish() }
  })
  sensitivity.querySelector('[data-sensitivity-criterion]').addEventListener('change', () => { if (!active()) return; if (locked()) { restore(); return }; rule = undefined; basis.textContent = ''; sensitivityOutput.replaceChildren(); sensitivityKey = crypto.randomUUID(); form.dataset.dirty = 'true'; sync() })
  sensitivity.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => { if (!active()) return; if (locked()) { restore(); return }; sensitivityKey = crypto.randomUUID(); form.dataset.dirty = 'true' }))
  loadRule.addEventListener('click', async () => {
    if (!active() || locked() || loadRule.disabled) return
    const id = sensitivity.querySelector('[data-sensitivity-criterion]').value
    if (!result || !result.criteria.includes(id) || !Array.isArray(result.request.scenarioRefs) || result.request.scenarioRefs.length !== 2) { basis.textContent = 'Choose a criterion included in the comparison.'; return }
    begin(); basis.textContent = 'Checking criterion and units…'
    try {
      const current = await send('decision-criterion-read', { purpose: 'criterion', caseRef: context.caseRef, criterionId: id }, crypto.randomUUID())
      if (current.criterionId !== id || !current.sensitivity || current.sensitivity.baselineRef !== result.request.scenarioRefs[0]) throw new Error('unavailable')
      const source = await send('decision-sensitivity-units', { purpose: 'sensitivity-units', caseRef: context.caseRef, scenarioRef: result.request.scenarioRefs[1], baselineRef: current.sensitivity.baselineRef, parameterRef: current.sensitivity.parameterRef }, crypto.randomUUID())
      if (source.caseRef?.id !== context.caseRef.id || source.caseRef?.incarnation !== context.caseRef.incarnation || source.caseRef?.version !== context.caseRef.version || source.units?.baselineRef !== current.sensitivity.baselineRef || source.units?.parameterRef !== current.sensitivity.parameterRef || source.units?.parameterUnit !== current.sensitivity.parameterUnit || source.units?.resultUnit !== current.sensitivity.resultUnit || source.units?.engineVersion !== current.sensitivity.engineVersion) throw new Error('stale')
      rule = current; sensitivityKey = crypto.randomUUID(); basis.textContent = 'Criterion: ' + ({ lte: 'at most', gte: 'at least', eq: 'equal to' }[current.operator] || current.operator) + ' ' + current.value + ' ' + current.unit + '. Parameter unit: ' + source.units.parameterUnit + '; result unit: ' + source.units.resultUnit + '. Enter your own range; domain limits are not declared.'
    } catch (error) { if (error?.accessDenied) revoke(); else if (active()) { rule = undefined; basis.textContent = 'Criterion, source or units unavailable or changed.' } }
    finally { finish() }
  })
  evaluate.addEventListener('click', async () => {
    if (!active() || busy || completed || reconciliationRequired || evaluate.disabled || (pending && pending.kind !== 'sensitivity')) return
    if (!rule || !result) { sensitivityOutput.textContent = 'Load the criterion and units first.'; return }
    if (!pending) {
      const minimum = sensitivity.querySelector('[data-sensitivity-min]').valueAsNumber; const maximum = sensitivity.querySelector('[data-sensitivity-max]').valueAsNumber; const steps = sensitivity.querySelector('[data-sensitivity-steps]').valueAsNumber
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum || !Number.isInteger(steps) || steps < 1 || steps > 1024) { sensitivityOutput.textContent = 'Enter a valid range and 1–1024 sample steps.'; return }
      snapshot = capture(); pending = { kind: 'sensitivity', key: sensitivityKey, body: JSON.stringify({ caseRef: context.caseRef, request: { scenarioRef: result.request.scenarioRefs[1], parameterBounds: { parameterRef: rule.sensitivity.parameterRef, minimum, maximum, steps }, criterion: { id: rule.criterionId, operator: rule.operator, value: rule.value } } }), uncertain: false }
    }
    const wasUncertain = pending.uncertain; begin(); sensitivityOutput.textContent = 'Evaluating sensitivity…'
    try {
      if (!pending.resultRef) { pending.uncertain = true; const evaluated = await send('decision-sensitivity-evaluate', pending.body, pending.key); if (!evaluated.sensitivityResultRef) throw new Error('unavailable'); pending.resultRef = evaluated.sensitivityResultRef }
      const current = await send('decision-sensitivity-read', { caseRef: context.caseRef, resultRef: pending.resultRef }, crypto.randomUUID()); const value = current.sensitivity
      sensitivityOutput.replaceChildren(); const summary = document.createElement('p'); const threshold = value.thresholdEvidence
      summary.textContent = 'Sensitivity: ' + value.comparisonStatus + ' · ' + (threshold.state === 'exact' ? 'Threshold: ' + threshold.value : threshold.state === 'sampled' ? 'Sampled interval: ' + threshold.interval.minimum + ' – ' + threshold.interval.maximum : 'Threshold unavailable: ' + threshold.reason) + ' ' + value.unit; sensitivityOutput.append(summary)
      value.evaluated.forEach((point) => { const line = document.createElement('p'); line.textContent = point.parameterValue + ' ' + (value.parameterUnit || '') + ': ' + (point.value ?? 'unavailable') + ' ' + (value.resultUnit || ''); sensitivityOutput.append(line) })
      value.unresolvedConditions.forEach((condition) => { const line = document.createElement('p'); line.textContent = condition.reason; sensitivityOutput.append(line) })
      pending = undefined; sensitivityKey = crypto.randomUUID()
    } catch (error) { if (!rejected(error, wasUncertain, sensitivityOutput, 'sensitivity request')) sensitivityOutput.textContent = 'Could not confirm sensitivity. Your entries are locked; retry the same request.' }
    finally { finish() }
  })
  portfolio.addEventListener('click', async () => {
    if (!active() || busy || completed || reconciliationRequired || portfolio.disabled || !result || (pending && pending.kind !== 'portfolio')) return
    const wasUncertain = !!pending?.uncertain; begin(); status.textContent = 'Saving portfolio selection…'
    try {
      if (!pending) { const current = await send('decision-portfolio-selection', { caseRef: context.caseRef }, crypto.randomUUID()); pending = { kind: 'portfolio', key: portfolioKey, body: JSON.stringify({ caseRef: context.caseRef, baselineAlternativeId: result.baselineAlternativeId, alternativeId: result.alternativeId, criteria: result.criteria, expectedVersion: current.version }), uncertain: false } }
      pending.uncertain = true
      await send('decision-select-portfolio', pending.body, pending.key)
      pending = undefined; status.textContent = 'Portfolio selection saved.'; portfolioKey = crypto.randomUUID()
    } catch (error) { if (!rejected(error, wasUncertain, status, 'portfolio selection')) status.textContent = pending ? 'Could not confirm the portfolio selection. Your entries are locked; retry the same request.' : 'The current portfolio selection is unavailable. Your entries are preserved; try again.' }
    finally { finish() }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || busy || reconciliationRequired || choose.disabled || (pending && pending.kind !== 'choice')) return
    if (completed) { location.reload(); return }
    if (!pending) {
      if (!result || !form.reportValidity()) return
      const alternative = context.alternatives.find((item) => item.id === result.alternativeId)
      if (!alternative) return
      const reason = form.querySelector('textarea[name=reason]').value.trim()
      if (!reason) { status.textContent = 'Enter a reason for this choice.'; return }
      snapshot = capture(); pending = { kind: 'choice', key, body: JSON.stringify({ caseRef: context.caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version, comparison: result.request, criteria: result.criteria, reason }), uncertain: false }
    }
    const wasUncertain = pending.uncertain; begin(); pending.uncertain = true; form.dataset.dirty = 'true'; status.textContent = 'Recording choice…'
    try {
      const receipt = await send('decision-choose', pending.body, pending.key)
      if (receipt?.caseRef?.id !== context.caseRef.id || receipt.caseRef.incarnation !== context.caseRef.incarnation ||
        !Number.isSafeInteger(receipt.caseRef.version) || receipt.caseRef.version <= context.caseRef.version) throw new Error('unconfirmed-choice')
      pending = undefined; completed = true; delete form.dataset.dirty; status.textContent = 'Choice recorded. Reload the decision to view it.'; location.reload()
    } catch (error) { if (!rejected(error, wasUncertain, status, 'choice')) status.textContent = 'Could not confirm the choice. Your reason and comparison are locked; retry the same request.' }
    finally { finish() }
  })
  sync()
})
`
