import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** All case and candidate identities are supplied by the authorized portfolio catalog. */
export const portfolioWidget = `<details><summary>Explore a portfolio</summary><section data-portfolio><p>Select decisions and their alternatives. Comparisons are calculated by the portfolio service.</p><button type="button" data-portfolio-cases>Find decisions</button><fieldset data-portfolio-case-list><legend>Decisions to include</legend></fieldset><button type="button" data-portfolio-catalog>Find alternatives</button><fieldset data-portfolio-candidates><legend>Alternatives</legend></fieldset><form data-portfolio-form><label>Decision that will own this evaluation<select name="anchor" required><option value="">Choose a decision</option></select></label><label>Portfolio start<input type="date" name="start" required></label><label>Portfolio end<input type="date" name="end" required></label><label>Currency<input name="currency" required maxlength="3"></label><label>Maximum combinations<input name="limit" type="number" min="1" max="1024" required></label><label><input type="checkbox" name="unconstrained" required>Use the selected decision criteria without additional priorities</label><button>Preview portfolio</button></form><p role="status" aria-live="polite"></p><div data-portfolio-results></div><button type="button" data-portfolio-save disabled>Save this evaluation</button><form data-portfolio-promote hidden><h3>Promote a combination</h3><label>Combination<select name="combination" required><option value="">Choose a combination</option></select></label><button type="button" data-portfolio-coverage>Find coverage assessments</button><label>Coverage<select name="coverage" required><option value="">Choose coverage</option></select></label><label>Alternative title<input name="title" required></label><button type="submit">Create alternative</button><p role="status" aria-live="polite"></p></form><form data-portfolio-prepare hidden><h3>Prepare the selected combination</h3><button type="button" data-portfolio-choices>Find recorded choices</button><label>Recorded choice<select name="choice" required><option value="">Choose a recorded choice</option></select></label><button type="submit">Prepare changes from choice</button><p role="status" aria-live="polite"></p></form></section></details>`

export function portfolioHistory(projection: AuthorizedCaseProjection) {
  return `<section data-portfolio-history data-case="${esc(JSON.stringify({ id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }))}"><h3>Saved portfolio evaluations</h3><p role="status">Loading evaluations…</p><div data-results></div></section>`
}

export const portfolioScript = `
;(() => {
const sessionFor = (section, clear) => {
  let denied = false
  const controllers = new Set()
  const active = () => !denied && section.isConnected
  const closeView = (text) => {
    if (denied) return false
    denied = true; controllers.forEach((controller) => controller.abort()); controllers.clear(); clear()
    section.querySelectorAll('input,textarea,select,button').forEach((control) => {
      control.disabled = true
      if ('value' in control) control.value = ''
      if ('defaultValue' in control) control.defaultValue = ''
      if ('checked' in control) { control.checked = false; control.defaultChecked = false; control.removeAttribute('checked') }
      control.removeAttribute('value')
      if (control.tagName === 'SELECT') control.replaceChildren()
    })
    section.querySelectorAll('form').forEach((form) => delete form.dataset.dirty)
    section.querySelectorAll('[role=status], [data-results], [data-portfolio-results], [data-portfolio-case-list], [data-portfolio-candidates]').forEach((node) => node.replaceChildren())
    delete section.dataset.case; section.replaceChildren()
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = text
    const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'Reload portfolio'; reload.addEventListener('click', () => location.reload())
    section.append(message, reload)
    return true
  }
  const revoke = () => {
    if (closeView('Access changed. Portfolio content cleared; reload to continue.')) dispatchEvent(new Event('sf-access-revoked'))
  }
  addEventListener('sf-access-revoked', () => { if (section.isConnected) revoke() })
  addEventListener('pagehide', () => { if (section.isConnected) closeView('This portfolio view is closed. Reload to read the current decision before continuing.') })
  const request = async (mode, payload, attempt) => {
    if (!active()) throw new Error('revoked')
    const controller = new AbortController(); controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, payload === undefined && !attempt ? { credentials: 'same-origin', cache: 'no-store', signal: controller.signal } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt?.key || crypto.randomUUID() }, body: attempt ? attempt.body : JSON.stringify(payload), signal: controller.signal })
      if (response.status === 401 || response.status === 403) { if (active()) revoke(); throw new Error('revoked') }
      if (!active()) throw new Error('revoked')
      const result = await response.json()
      if (!active()) throw new Error('revoked')
      // Portfolio persistence/readback can return stale or conflict after a write.
      // Only the HTTP boundary's published pre-dispatch validation is definitive.
      const rejected = { 'invalid-decision-input': 400, 'method-not-allowed': 405, 'request-too-large': 413, 'invalid-content-type': 415 }
      if (!response.ok || result?.status !== 'ok') throw Object.assign(new Error('unavailable'), { definite: result?.status === 'needs-input' && Object.hasOwn(rejected, result.reason) && rejected[result.reason] === response.status })
      return result.value
    } finally { clearTimeout(timeout); controllers.delete(controller) }
  }
  return { active, request }
}
document.querySelectorAll('[data-portfolio-history]').forEach(async (section) => {
  if (section.dataset.sfPortfolioHistoryReady) return; section.dataset.sfPortfolioHistoryReady = 'true'
  let caseRef = JSON.parse(section.dataset.case)
  const status = section.querySelector('[role=status]'); const results = section.querySelector('[data-results]')
  const session = sessionFor(section, () => { caseRef = undefined })
  const request = session.request
  try {
    const entries = await request('decision-portfolio-results', { purpose: 'results', caseRef }); if (!session.active()) return; status.textContent = entries.length ? '' : 'No saved evaluations for this decision version.'
    for (const item of entries) {
      const entry = document.createElement('article'); const heading = document.createElement('h4'); heading.textContent = 'Evaluation · ' + item.createdAt; entry.append(heading); results.append(entry)
      try {
        const saved = await request('decision-portfolio-read', { caseRef, resultRef: item.resultRef })
        if (!session.active()) return
        saved.portfolio.combinations.forEach((combination, index) => { const line = document.createElement('p'); line.textContent = 'Combination ' + (index + 1) + ': ' + combination.eligibility + ' · ' + combination.comparisonStatus; entry.append(line); combination.restrictions.forEach((restriction) => { const detail = document.createElement('p'); detail.textContent = restriction; entry.append(detail) }) })
        saved.portfolio.limitations.forEach((limitation) => { const line = document.createElement('p'); line.textContent = limitation; entry.append(line) })
      } catch { if (!session.active()) return; const line = document.createElement('p'); line.textContent = 'Evaluation unavailable or access changed.'; entry.append(line) }
    }
  } catch { if (!session.active()) return; results.replaceChildren(); status.textContent = 'Portfolio history temporarily unavailable. Reload to retry.' }
})
document.querySelectorAll('[data-portfolio]').forEach((section) => {
  if (section.dataset.sfPortfolioReady) return; section.dataset.sfPortfolioReady = 'true'
  const status = section.querySelector('[role=status]'); const casesNode = section.querySelector('[data-portfolio-case-list]'); const candidatesNode = section.querySelector('[data-portfolio-candidates]'); const output = section.querySelector('[data-portfolio-results]'); const save = section.querySelector('[data-portfolio-save]'); const form = section.querySelector('[data-portfolio-form]')
  const promotion = section.querySelector('[data-portfolio-promote]'); const promotionStatus = promotion.querySelector('[role=status]'); const preparation = section.querySelector('[data-portfolio-prepare]'); const preparationStatus = preparation.querySelector('[role=status]')
  let cases = []; let catalog; let prepared; let saved = false; let busy = false; let intention; let completed = false
  const session = sessionFor(section, () => { cases = []; catalog = undefined; prepared = undefined; if (intention) { intention.body = ''; intention.key = '' }; intention = undefined })
  const request = session.request
  const lock = (attempt) => { if (busy || completed || !session.active() || intention && intention !== attempt) return false; busy = true; section.querySelectorAll('button,input,select').forEach((control) => { control.disabled = true }); return true }
  const unlock = () => {
    busy = false; if (!session.active()) return
    section.querySelectorAll('button,input,select').forEach((control) => { control.disabled = completed || !!intention })
    save.disabled = completed || !!intention || !prepared || saved
    if (intention?.uncertain) intention.button.disabled = false
  }
  const reset = () => { if (intention || completed || !session.active()) return; prepared = undefined; saved = false; save.disabled = true; save.textContent = 'Save this evaluation'; promotion.hidden = true; preparation.hidden = true; output.replaceChildren() }
  const mutate = async (kind, mode, payload, button, target, success) => {
    if (!session.active() || busy || completed || intention && intention.kind !== kind) return
    if (!intention) intention = { kind, key: crypto.randomUUID(), body: JSON.stringify(payload), uncertain: false, button }
    const attempt = intention
    if (!lock(attempt)) return
    target.textContent = kind === 'evaluation' ? 'Saving evaluation…' : kind === 'promotion' ? 'Creating alternative…' : 'Preparing changes…'
    try {
      const value = await request(mode, payload, attempt)
      if (!session.active() || intention !== attempt) return
      if (kind === 'evaluation' && (typeof value?.portfolioResultRef !== 'string' || !value.portfolioResultRef)) throw new Error('unconfirmed')
      if (kind !== 'evaluation') {
        const expected = JSON.parse(attempt.body).caseRef
        const acknowledged = value?.caseRef
        if (!acknowledged || acknowledged.id !== expected.id || acknowledged.incarnation !== expected.incarnation || !Number.isSafeInteger(acknowledged.version) || acknowledged.version <= expected.version) throw new Error('unconfirmed')
      }
      intention = undefined; success(value)
    } catch (error) {
      if (!session.active() || intention !== attempt) return
      if (error.definite && !attempt.uncertain) {
        intention = undefined; target.textContent = 'The ' + kind + ' was rejected. Review the current inputs and try again.'
      } else {
        attempt.uncertain = true; button.textContent = 'Retry same ' + kind
        target.textContent = 'Could not confirm the ' + kind + '. Your inputs are preserved and locked; retry the same request to reconcile it. If it remains unconfirmed, reopen the decision to review recorded changes before starting another action.'
      }
    } finally { unlock() }
  }
  section.querySelector('[data-portfolio-cases]').addEventListener('click', async () => {
    if (!lock()) return; status.textContent = 'Finding decisions…'; reset()
    try { const value = await request('decision-list'); if (!session.active()) return; cases = value; catalog = undefined; candidatesNode.replaceChildren(); casesNode.replaceChildren(); const legend = document.createElement('legend'); legend.textContent = 'Decisions to include'; casesNode.append(legend); cases.forEach((item, index) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = String(index); input.addEventListener('change', () => { if (busy || intention || !session.active()) return; catalog = undefined; candidatesNode.replaceChildren(); reset(); form.dataset.dirty = 'true' }); label.append(input, item.objective); casesNode.append(label) }); status.textContent = cases.length ? 'Choose decisions, then find alternatives.' : 'No accessible decisions.' }
    catch { if (session.active()) status.textContent = 'Decisions temporarily unavailable. Retry finding decisions.' }
    finally { unlock() }
  })
  section.querySelector('[data-portfolio-catalog]').addEventListener('click', async () => {
    if (busy || intention || !session.active()) return
    const selected = [...casesNode.querySelectorAll('input:checked')].map((input) => cases[Number(input.value)]).filter(Boolean)
    if (!selected.length || !lock()) { status.textContent = 'Choose at least one decision.'; return }
    status.textContent = 'Finding alternatives…'; reset()
    try {
      const value = await request('decision-portfolio-catalog', { purpose: 'catalog', caseRefs: selected.map((item) => item.caseRef) }); if (!session.active()) return; catalog = value; candidatesNode.replaceChildren(); const legend = document.createElement('legend'); legend.textContent = 'Alternatives'; candidatesNode.append(legend)
      catalog.cases.forEach((item) => item.alternatives.forEach((alternative) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = alternative.candidateRef; input.addEventListener('change', () => { if (busy || intention || !session.active()) return; reset(); form.dataset.dirty = 'true' }); label.append(input, item.objective + ' · ' + alternative.title + ' · ' + alternative.comparisonStatus); candidatesNode.append(label) }))
      const anchor = form.elements.namedItem('anchor'); anchor.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a decision'; anchor.append(empty)
      selected.forEach((item) => { const option = document.createElement('option'); option.value = String(cases.indexOf(item)); option.textContent = item.objective; anchor.append(option) })
      form.elements.namedItem('limit').min = String(catalog.explorationLimit.minimum); form.elements.namedItem('limit').max = String(catalog.explorationLimit.maximum)
      status.textContent = 'Choose alternatives and enter the portfolio scope.'
    } catch { if (!session.active()) return; catalog = undefined; candidatesNode.replaceChildren(); status.textContent = 'Alternatives temporarily unavailable. Retry finding alternatives.' }
    finally { unlock() }
  })
  form.addEventListener('input', () => { if (busy || intention || !session.active()) return; reset(); form.dataset.dirty = 'true' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || intention || !session.active() || !form.reportValidity() || !catalog) return
    const candidateRefs = [...candidatesNode.querySelectorAll('input:checked')].map((input) => input.value); if (!candidateRefs.length) { status.textContent = 'Choose at least one alternative.'; return }
    const fields = new FormData(form); const anchor = cases[Number(fields.get('anchor'))]
    if (!anchor || ![...casesNode.querySelectorAll('input:checked')].some((input) => cases[Number(input.value)] === anchor)) { status.textContent = 'Choose a decision to own this evaluation.'; return }
    if (!lock()) return; prepared = undefined; status.textContent = 'Calculating portfolio…'; output.replaceChildren()
    try {
      const selected = await request('decision-portfolio-selection', { caseRef: anchor.caseRef })
      if (!session.active()) return
      if (!selected.selection || !Array.isArray(selected.selection.criteria)) { status.textContent = 'Open the decision and select its baseline, alternative and criteria first.'; return }
      const matching = catalog.cases.filter((item) => item.caseRef && typeof item.caseRef === 'object' && item.caseRef.id === anchor.caseRef.id && item.caseRef.incarnation === anchor.caseRef.incarnation && item.caseRef.version === anchor.caseRef.version)
      const anchorCatalog = matching[0]
      if (matching.length !== 1 || !anchorCatalog || anchorCatalog.caseVersion !== anchor.caseRef.version || selected.selection.criteria.some((id) => !anchorCatalog.criteria.some((criterion) => criterion.id === id))) throw new Error('stale')
      const portfolioRequest = { scope: { horizon: { start: fields.get('start'), end: fields.get('end') }, currency: fields.get('currency') }, candidateRefs, operations: [], constraints: selected.selection.criteria, priorities: [], explorationLimit: Number(fields.get('limit')) }
      const value = await request('decision-portfolio-preview', { purpose: 'preview', caseRef: anchor.caseRef, request: portfolioRequest }); if (!session.active()) return; prepared = { caseRef: anchor.caseRef, request: portfolioRequest, evaluationDigest: value.evaluationDigest, selections: value.selections }
      const criteria = document.createElement('p'); criteria.textContent = selected.selection.criteria.length ? 'Selected criteria: ' + selected.selection.criteria.map((id) => anchorCatalog.criteria.find((criterion) => criterion.id === id).description).join(', ') : 'No criteria selected.'; output.append(criteria)
      value.portfolio.combinations.forEach((combination, index) => {
        const entry = document.createElement('article'); const heading = document.createElement('h3'); heading.textContent = 'Combination ' + (index + 1) + ' · ' + combination.eligibility + ' · ' + combination.comparisonStatus; entry.append(heading)
        const bindings = Array.isArray(value.selections) ? value.selections.filter((item) => item.combinationId === combination.id) : []
        if (bindings.length === 1 && Array.isArray(bindings[0].selectedCandidateRefs) && bindings[0].selectedCandidateRefs.length && new Set(bindings[0].selectedCandidateRefs).size === bindings[0].selectedCandidateRefs.length && bindings[0].selectedCandidateRefs.every((ref) => candidateRefs.includes(ref))) {
          const labels = bindings[0].selectedCandidateRefs.map((ref) => catalog.cases.flatMap((item) => item.alternatives.filter((alternative) => alternative.candidateRef === ref).map((alternative) => item.objective + ' · ' + alternative.title)))
          if (labels.every((matches) => matches.length === 1)) { const line = document.createElement('p'); line.textContent = 'Alternatives: ' + labels.map((matches) => matches[0]).join(' + '); entry.append(line) }
        }
        if (combination.analysis) {
          const scenario = combination.analysis.scenario; const comparison = combination.analysis.comparison; const line = document.createElement('p')
          line.textContent = (scenario.comparisonStatus === 'complete' ? 'Total: ' + scenario.total : 'Known subtotal: ' + (scenario.knownSubtotal ?? 'unavailable')) + ' ' + scenario.currency + ' · ' + scenario.horizon.start + ' – ' + scenario.horizon.end + ' · ' + (comparison.comparisonStatus === 'complete' ? 'Difference: ' + comparison.completeDifference : 'Known difference: ' + (comparison.knownDifference ?? 'unavailable')); entry.append(line)
          const coverage = document.createElement('p'); coverage.textContent = 'Coverage: ' + scenario.costCoverage.coverageState; entry.append(coverage)
          scenario.costCoverage.entries.forEach((item) => { const condition = document.createElement('p'); condition.textContent = item.categoryId + ': ' + (item.status === 'pending' ? 'pending · ' + item.reason : item.status === 'not-applicable' ? 'not applicable · ' + item.justification : 'included · ' + item.scopeNote); entry.append(condition) })
          scenario.costCoverage.derivedMissingCategoryIds.forEach((id) => { const condition = document.createElement('p'); condition.textContent = 'Missing category: ' + id; entry.append(condition) })
        }
        if (!combination.analysis) { const line = document.createElement('p'); line.textContent = 'Analysis unavailable for this combination.'; entry.append(line) }
        ;[...combination.conflicts, ...combination.restrictions].forEach((condition) => { const line = document.createElement('p'); line.textContent = condition; entry.append(line) }); output.append(entry)
      })
      value.portfolio.limitations.forEach((limitation) => { const line = document.createElement('p'); line.textContent = limitation; output.append(line) })
      const combinationSelect = promotion.elements.namedItem('combination'); combinationSelect.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a combination'; combinationSelect.append(empty)
      value.portfolio.combinations.forEach((combination, index) => {
        const bindings = Array.isArray(value.selections) ? value.selections.filter((entry) => entry.combinationId === combination.id) : []
        if (bindings.length !== 1 || !Array.isArray(bindings[0].selectedCandidateRefs) || !bindings[0].selectedCandidateRefs.length || new Set(bindings[0].selectedCandidateRefs).size !== bindings[0].selectedCandidateRefs.length || bindings[0].selectedCandidateRefs.some((ref) => !candidateRefs.includes(ref)) || ['ineligible', 'unavailable'].includes(combination.eligibility)) return
        const names = bindings[0].selectedCandidateRefs.map((ref) => catalog.cases.flatMap((item) => item.alternatives.map((alternative) => ({ ref: alternative.candidateRef, label: item.objective + ' · ' + alternative.title }))).find((item) => item.ref === ref)?.label)
        if (names.some((name) => !name)) return
        const option = document.createElement('option'); option.value = combination.id; option.textContent = 'Combination ' + (index + 1) + ' · ' + names.join(' + '); combinationSelect.append(option)
      })
      promotion.hidden = combinationSelect.options.length < 2 || !/^[a-f0-9]{64}$/.test(value.evaluationDigest || ''); preparation.hidden = promotion.hidden; status.textContent = 'Preview complete. No portfolio result has been saved.'
    } catch { if (!session.active()) return; prepared = undefined; status.textContent = 'Portfolio unavailable or its sources changed. Review the selection and retry the preview.' }
    finally { unlock() }
  })
  save.addEventListener('click', async () => {
    if (!prepared || saved) return
    await mutate('evaluation', 'decision-portfolio-evaluate', { caseRef: prepared.caseRef, request: prepared.request }, save, status, () => { status.textContent = 'Portfolio evaluation saved.'; saved = true; delete form.dataset.dirty })
  })
  promotion.addEventListener('input', () => { if (!busy && !intention && session.active()) promotion.dataset.dirty = 'true' })
  promotion.querySelector('[data-portfolio-coverage]').addEventListener('click', async () => {
    if (!prepared || !lock()) return; promotionStatus.textContent = 'Finding coverage…'
    try {
      const values = await request('decision-coverage-catalog', { purpose: 'coverage-catalog', caseRef: prepared.caseRef }); if (!session.active()) return; const select = promotion.elements.namedItem('coverage'); select.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose coverage'; select.append(empty)
      values.forEach((item) => { const option = document.createElement('option'); option.value = item.coverageRef; option.textContent = item.label + ' · ' + item.state; select.append(option) }); promotionStatus.textContent = values.length ? 'Choose the coverage to review.' : 'No current coverage is available.'
    } catch { if (session.active()) promotionStatus.textContent = 'Coverage temporarily unavailable. Retry finding coverage.' }
    finally { unlock() }
  })
  const promoted = () => { completed = true; delete promotion.dataset.dirty; delete form.dataset.dirty; promotionStatus.textContent = 'Alternative created. Reloading the decision…'; location.reload() }
  promotion.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !session.active()) return
    const button = promotion.querySelector('button[type=submit]')
    if (intention) { if (intention.kind === 'promotion') await mutate('promotion', 'decision-promote-portfolio', undefined, button, promotionStatus, promoted); return }
    if (!prepared || !promotion.reportValidity()) return
    const fields = new FormData(promotion); const selected = prepared.selections.filter((item) => item.combinationId === fields.get('combination'))
    if (selected.length !== 1) return
    await mutate('promotion', 'decision-promote-portfolio', { caseRef: prepared.caseRef, request: prepared.request, selectedCandidateRefs: selected[0].selectedCandidateRefs, combinationId: fields.get('combination'), expectedEvaluationDigest: prepared.evaluationDigest, title: String(fields.get('title') || '').trim(), coverageRef: fields.get('coverage') }, button, promotionStatus, promoted)
  })
  preparation.addEventListener('input', () => { if (!busy && !intention && session.active()) preparation.dataset.dirty = 'true' })
  preparation.querySelector('[data-portfolio-choices]').addEventListener('click', async () => {
    if (!prepared || !lock()) return; preparationStatus.textContent = 'Finding recorded choices…'
    try { const values = await request('decision-choice-catalog', { purpose: 'choice-catalog', caseRef: prepared.caseRef }); if (!session.active()) return; const select = preparation.elements.namedItem('choice'); select.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a recorded choice'; select.append(empty); values.forEach((item) => { const option = document.createElement('option'); option.value = item.choiceId; option.textContent = item.label + ' · ' + item.at; select.append(option) }); preparationStatus.textContent = values.length ? 'Choose a recorded choice and a combination above.' : 'No recorded choice is available.' }
    catch { if (session.active()) preparationStatus.textContent = 'Choices temporarily unavailable. Retry finding recorded choices.' }
    finally { unlock() }
  })
  const preparedChanges = () => { completed = true; delete preparation.dataset.dirty; delete promotion.dataset.dirty; delete form.dataset.dirty; preparationStatus.textContent = 'Changes prepared. Reloading the decision…'; location.reload() }
  preparation.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !session.active()) return
    const button = preparation.querySelector('button[type=submit]')
    if (intention) { if (intention.kind === 'preparation') await mutate('preparation', 'decision-prepare-portfolio', undefined, button, preparationStatus, preparedChanges); return }
    if (!prepared || !preparation.reportValidity()) return
    const combination = promotion.elements.namedItem('combination').value; const selected = prepared.selections.filter((item) => item.combinationId === combination); const choiceId = preparation.elements.namedItem('choice').value
    if (selected.length !== 1 || !choiceId) { preparationStatus.textContent = 'Choose a combination and a recorded choice.'; return }
    await mutate('preparation', 'decision-prepare-portfolio', { caseRef: prepared.caseRef, request: prepared.request, selectedCandidateRefs: selected[0].selectedCandidateRefs, combinationId: combination, expectedEvaluationDigest: prepared.evaluationDigest, choiceId }, button, preparationStatus, preparedChanges)
  })
})
})();
`
