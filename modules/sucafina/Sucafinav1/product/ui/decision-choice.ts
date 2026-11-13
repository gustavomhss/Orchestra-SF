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
  const context = JSON.parse(form.dataset.context)
  const compare = form.querySelector('[data-compare]'); const choose = form.querySelector('button[type=submit]'); const portfolio = form.querySelector('[data-portfolio]')
  const output = form.querySelector('[data-comparison]'); const status = form.querySelector('p[role=status]')
  const sensitivity = form.querySelector('[data-sensitivity]'); const sensitivityOutput = form.querySelector('[data-sensitivity-output]'); const basis = form.querySelector('[data-sensitivity-basis]')
  let result; let key = crypto.randomUUID(); let portfolioKey = crypto.randomUUID(); let sensitivityKey = crypto.randomUUID(); let rule
  const invalidate = () => { result = undefined; rule = undefined; sensitivity.hidden = true; choose.disabled = true; portfolio.disabled = true; key = crypto.randomUUID(); portfolioKey = crypto.randomUUID(); sensitivityKey = crypto.randomUUID(); form.dataset.dirty = 'true' }
  form.querySelectorAll('select[name=baseline], select[name=alternative], input[name=criteria]').forEach((input) => input.addEventListener('change', invalidate))
  form.querySelector('textarea').addEventListener('input', () => { key = crypto.randomUUID(); form.dataset.dirty = 'true' })
  const send = async (action, payload, id) => {
    const url = new URL(location.href); url.search = '?sf=' + action
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: JSON.stringify(payload) })
    const value = await response.json(); if (!response.ok || value.status !== 'ok') throw new Error('unavailable'); return value.value
  }
  compare.addEventListener('click', async () => {
    const fields = new FormData(form); const baseline = fields.get('baseline'); const alternative = fields.get('alternative'); const criteria = fields.getAll('criteria')
    if (baseline === alternative || context.criteria.some((criterion) => criterion.required && !criteria.includes(criterion.id))) { output.textContent = 'Select two different alternatives and all required criteria.'; return }
    const inputs = form.querySelectorAll('select, input'); inputs.forEach((input) => { input.disabled = true })
    rule = undefined; sensitivity.hidden = true; compare.disabled = true; choose.disabled = true; portfolio.disabled = true; output.textContent = 'Comparing alternatives…'
    try {
      const compared = await send('decision-compare', { caseRef: context.caseRef, baselineAlternativeId: baseline, alternativeId: alternative, criteria }, crypto.randomUUID())
      result = { request: compared.request, baselineAlternativeId: baseline, alternativeId: alternative, criteria }
      const value = compared.comparison; output.replaceChildren()
      const summary = document.createElement('p'); summary.textContent = 'Comparison: ' + value.comparisonStatus + ' · ' + (value.comparisonStatus === 'complete' ? 'Difference: ' + value.completeDifference : 'Known difference: ' + (value.knownDifference ?? 'unavailable')); output.append(summary)
      ;[baseline, alternative].forEach((id) => { const source = context.alternatives.find((item) => item.id === id); if (!source) return; const line = document.createElement('p'); line.textContent = source.title + ' · ' + source.currency + ' · ' + source.horizon.start + ' – ' + source.horizon.end; output.append(line) })
      value.unresolvedConditions.forEach((condition) => { const line = document.createElement('p'); line.textContent = condition; output.append(line) })
      value.criterionResults.forEach((criterion) => { const line = document.createElement('p'); line.textContent = (context.criteria.find((item) => item.id === criterion.criterionId)?.description || 'Criterion') + ': ' + criterion.state + ' · ' + criterion.reason; output.append(line) })
      choose.disabled = false; portfolio.disabled = false; sensitivity.hidden = false
    } catch { result = undefined; output.textContent = 'Comparison unavailable or sources changed. Check the alternatives and try again.' }
    finally { compare.disabled = false; inputs.forEach((input) => { input.disabled = false }) }
  })
  sensitivity.querySelector('[data-sensitivity-criterion]').addEventListener('change', () => { rule = undefined; basis.textContent = ''; sensitivityOutput.replaceChildren(); sensitivityKey = crypto.randomUUID() })
  sensitivity.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => { sensitivityKey = crypto.randomUUID(); form.dataset.dirty = 'true' }))
  sensitivity.querySelector('[data-sensitivity-rule]').addEventListener('click', async () => {
    const id = sensitivity.querySelector('[data-sensitivity-criterion]').value
    if (!result || !result.criteria.includes(id) || !Array.isArray(result.request.scenarioRefs) || result.request.scenarioRefs.length !== 2) { basis.textContent = 'Choose a criterion included in the comparison.'; return }
    const controls = form.querySelectorAll('select, input, textarea, button'); controls.forEach((control) => { control.disabled = true }); basis.textContent = 'Checking criterion and units…'
    try {
      const current = await send('decision-criterion-read', { purpose: 'criterion', caseRef: context.caseRef, criterionId: id }, crypto.randomUUID())
      if (current.criterionId !== id || !current.sensitivity || current.sensitivity.baselineRef !== result.request.scenarioRefs[0]) throw new Error('unavailable')
      const source = await send('decision-sensitivity-units', { purpose: 'sensitivity-units', caseRef: context.caseRef, scenarioRef: result.request.scenarioRefs[1], baselineRef: current.sensitivity.baselineRef, parameterRef: current.sensitivity.parameterRef }, crypto.randomUUID())
      if (source.caseRef?.id !== context.caseRef.id || source.caseRef?.incarnation !== context.caseRef.incarnation || source.caseRef?.version !== context.caseRef.version || source.units?.baselineRef !== current.sensitivity.baselineRef || source.units?.parameterRef !== current.sensitivity.parameterRef || source.units?.parameterUnit !== current.sensitivity.parameterUnit || source.units?.resultUnit !== current.sensitivity.resultUnit || source.units?.engineVersion !== current.sensitivity.engineVersion) throw new Error('stale')
      rule = current; sensitivityKey = crypto.randomUUID(); basis.textContent = 'Criterion: ' + ({ lte: 'at most', gte: 'at least', eq: 'equal to' }[current.operator] || current.operator) + ' ' + current.value + ' ' + current.unit + '. Parameter unit: ' + source.units.parameterUnit + '; result unit: ' + source.units.resultUnit + '. Enter your own range; domain limits are not declared.'
    } catch { rule = undefined; basis.textContent = 'Criterion, source or units unavailable or changed.' }
    finally { controls.forEach((control) => { control.disabled = false }) }
  })
  sensitivity.querySelector('[data-sensitivity-run]').addEventListener('click', async () => {
    if (!rule || !result) { sensitivityOutput.textContent = 'Load the criterion and units first.'; return }
    const minimum = sensitivity.querySelector('[data-sensitivity-min]').valueAsNumber; const maximum = sensitivity.querySelector('[data-sensitivity-max]').valueAsNumber; const steps = sensitivity.querySelector('[data-sensitivity-steps]').valueAsNumber
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum || !Number.isInteger(steps) || steps < 1 || steps > 1024) { sensitivityOutput.textContent = 'Enter a valid range and 1–1024 sample steps.'; return }
    const controls = form.querySelectorAll('select, input, textarea, button'); controls.forEach((control) => { control.disabled = true }); sensitivityOutput.textContent = 'Evaluating sensitivity…'
    try {
      const evaluated = await send('decision-sensitivity-evaluate', { caseRef: context.caseRef, request: { scenarioRef: result.request.scenarioRefs[1], parameterBounds: { parameterRef: rule.sensitivity.parameterRef, minimum, maximum, steps }, criterion: { id: rule.criterionId, operator: rule.operator, value: rule.value } } }, sensitivityKey)
      const current = await send('decision-sensitivity-read', { caseRef: context.caseRef, resultRef: evaluated.sensitivityResultRef }, crypto.randomUUID()); const value = current.sensitivity
      sensitivityOutput.replaceChildren(); const summary = document.createElement('p'); const threshold = value.thresholdEvidence
      summary.textContent = 'Sensitivity: ' + value.comparisonStatus + ' · ' + (threshold.state === 'exact' ? 'Threshold: ' + threshold.value : threshold.state === 'sampled' ? 'Sampled interval: ' + threshold.interval.minimum + ' – ' + threshold.interval.maximum : 'Threshold unavailable: ' + threshold.reason) + ' ' + value.unit; sensitivityOutput.append(summary)
      value.evaluated.forEach((point) => { const line = document.createElement('p'); line.textContent = point.parameterValue + ' ' + (value.parameterUnit || '') + ': ' + (point.value ?? 'unavailable') + ' ' + (value.resultUnit || ''); sensitivityOutput.append(line) })
      value.unresolvedConditions.forEach((condition) => { const line = document.createElement('p'); line.textContent = condition.reason; sensitivityOutput.append(line) })
    } catch { sensitivityOutput.textContent = 'Could not confirm sensitivity. Retry the same request or check the source.' }
    finally { controls.forEach((control) => { control.disabled = false }) }
  })
  portfolio.addEventListener('click', async () => {
    if (!result) return
    const inputs = form.querySelectorAll('select, input, button'); inputs.forEach((input) => { input.disabled = true }); status.textContent = 'Saving portfolio selection…'
    try {
      const current = await send('decision-portfolio-selection', { caseRef: context.caseRef }, crypto.randomUUID())
      await send('decision-select-portfolio', { caseRef: context.caseRef, baselineAlternativeId: result.baselineAlternativeId, alternativeId: result.alternativeId, criteria: result.criteria, expectedVersion: current.version }, portfolioKey)
      status.textContent = 'Portfolio selection saved.'; portfolioKey = crypto.randomUUID()
    } catch { status.textContent = 'Could not confirm the portfolio selection. Refresh its current state before retrying.' }
    finally { inputs.forEach((input) => { input.disabled = false }) }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!result || !form.reportValidity()) return
    const alternative = context.alternatives.find((item) => item.id === result.alternativeId)
    if (!alternative) return
    const fields = new FormData(form); const controls = form.querySelectorAll('select, input, textarea, button'); controls.forEach((control) => { control.disabled = true }); status.textContent = 'Recording choice…'
    try {
      await send('decision-choose', { caseRef: context.caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version, comparison: result.request, criteria: result.criteria, reason: String(fields.get('reason') || '').trim() }, key)
      delete form.dataset.dirty; location.reload()
    } catch { status.textContent = 'Could not confirm the choice. Your reason is preserved; retry the same request.' }
    finally { controls.forEach((control) => { control.disabled = false }) }
  })
})
`
