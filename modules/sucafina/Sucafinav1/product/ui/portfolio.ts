import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** All case and candidate identities are supplied by the authorized portfolio catalog. */
export const portfolioWidget = `<details><summary>Explore a portfolio</summary><section data-portfolio><p>Select decisions and their alternatives. Comparisons are calculated by the portfolio service.</p><button type="button" data-portfolio-cases>Find decisions</button><fieldset data-portfolio-case-list><legend>Decisions to include</legend></fieldset><button type="button" data-portfolio-catalog>Find alternatives</button><fieldset data-portfolio-candidates><legend>Alternatives</legend></fieldset><form data-portfolio-form><label>Decision that will own this evaluation<select name="anchor" required><option value="">Choose a decision</option></select></label><label>Portfolio start<input type="date" name="start" required></label><label>Portfolio end<input type="date" name="end" required></label><label>Currency<input name="currency" required maxlength="3"></label><label>Maximum combinations<input name="limit" type="number" min="1" max="1024" required></label><label><input type="checkbox" name="unconstrained" required>Use the selected decision criteria without additional priorities</label><button>Preview portfolio</button></form><p role="status" aria-live="polite"></p><div data-portfolio-results></div><button type="button" data-portfolio-save disabled>Save this evaluation</button></section></details>`

export function portfolioHistory(projection: AuthorizedCaseProjection) {
  return `<section data-portfolio-history data-case="${esc(JSON.stringify({ id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }))}"><h3>Saved portfolio evaluations</h3><p role="status">Loading evaluations…</p><div data-results></div></section>`
}

export const portfolioScript = `
document.querySelectorAll('[data-portfolio-history]').forEach(async (section) => {
  if (section.dataset.sfPortfolioHistoryReady) return; section.dataset.sfPortfolioHistoryReady = 'true'
  const caseRef = JSON.parse(section.dataset.case); const status = section.querySelector('[role=status]'); const results = section.querySelector('[data-results]')
  const request = async (mode, payload) => { const url = new URL(location.href); url.search = '?sf=' + mode; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) }); const value = await response.json(); if (!response.ok || value.status !== 'ok') throw new Error('unavailable'); return value.value }
  try {
    const entries = await request('decision-portfolio-results', { purpose: 'results', caseRef }); status.textContent = entries.length ? '' : 'No saved evaluations for this decision version.'
    for (const item of entries) {
      const entry = document.createElement('article'); const heading = document.createElement('h4'); heading.textContent = 'Evaluation · ' + item.createdAt; entry.append(heading); results.append(entry)
      try {
        const saved = await request('decision-portfolio-read', { caseRef, resultRef: item.resultRef })
        saved.portfolio.combinations.forEach((combination, index) => { const line = document.createElement('p'); line.textContent = 'Combination ' + (index + 1) + ': ' + combination.eligibility + ' · ' + combination.comparisonStatus; entry.append(line); combination.restrictions.forEach((restriction) => { const detail = document.createElement('p'); detail.textContent = restriction; entry.append(detail) }) })
        saved.portfolio.limitations.forEach((limitation) => { const line = document.createElement('p'); line.textContent = limitation; entry.append(line) })
      } catch { const line = document.createElement('p'); line.textContent = 'Evaluation unavailable or access changed.'; entry.append(line) }
    }
  } catch { results.replaceChildren(); status.textContent = 'Portfolio history unavailable or access changed.' }
})
document.querySelectorAll('[data-portfolio]').forEach((section) => {
  if (section.dataset.sfPortfolioReady) return; section.dataset.sfPortfolioReady = 'true'
  const status = section.querySelector('[role=status]'); const casesNode = section.querySelector('[data-portfolio-case-list]'); const candidatesNode = section.querySelector('[data-portfolio-candidates]'); const output = section.querySelector('[data-portfolio-results]'); const save = section.querySelector('[data-portfolio-save]'); const form = section.querySelector('[data-portfolio-form]')
  let cases = []; let catalog; let prepared; let evaluationKey = crypto.randomUUID(); let busy = false
  const lock = () => { if (busy) return false; busy = true; section.querySelectorAll('button,input,select').forEach((control) => { control.disabled = true }); return true }
  const unlock = () => { busy = false; section.querySelectorAll('button,input,select').forEach((control) => { control.disabled = false }); save.disabled = !prepared }
  const url = (mode) => { const value = new URL(location.href); value.search = '?sf=' + mode; return value }
  const request = async (mode, payload, key = crypto.randomUUID()) => { const response = await fetch(url(mode), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
  const reset = () => { prepared = undefined; save.disabled = true; evaluationKey = crypto.randomUUID(); output.replaceChildren() }
  section.querySelector('[data-portfolio-cases]').addEventListener('click', async () => {
    if (!lock()) return; status.textContent = 'Finding decisions…'; reset()
    try { const response = await fetch(url('decision-list'), { credentials: 'same-origin', cache: 'no-store' }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); cases = result.value; casesNode.replaceChildren(); const legend = document.createElement('legend'); legend.textContent = 'Decisions to include'; casesNode.append(legend); cases.forEach((item, index) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = String(index); input.addEventListener('change', () => { catalog = undefined; candidatesNode.replaceChildren(); reset(); form.dataset.dirty = 'true' }); label.append(input, item.objective); casesNode.append(label) }); status.textContent = cases.length ? 'Choose decisions, then find alternatives.' : 'No accessible decisions.' }
    catch { status.textContent = 'Decisions unavailable or access changed.' }
    finally { unlock() }
  })
  section.querySelector('[data-portfolio-catalog]').addEventListener('click', async () => {
    const selected = [...casesNode.querySelectorAll('input:checked')].map((input) => cases[Number(input.value)]).filter(Boolean)
    if (!selected.length || !lock()) { status.textContent = 'Choose at least one decision.'; return }
    status.textContent = 'Finding alternatives…'; reset()
    try {
      catalog = await request('decision-portfolio-catalog', { purpose: 'catalog', caseRefs: selected.map((item) => item.caseRef) }); candidatesNode.replaceChildren(); const legend = document.createElement('legend'); legend.textContent = 'Alternatives'; candidatesNode.append(legend)
      catalog.cases.forEach((item) => item.alternatives.forEach((alternative) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = alternative.candidateRef; input.addEventListener('change', () => { reset(); form.dataset.dirty = 'true' }); label.append(input, item.objective + ' · ' + alternative.title + ' · ' + alternative.comparisonStatus); candidatesNode.append(label) }))
      const anchor = form.elements.namedItem('anchor'); anchor.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a decision'; anchor.append(empty)
      selected.forEach((item) => { const option = document.createElement('option'); option.value = String(cases.indexOf(item)); option.textContent = item.objective; anchor.append(option) })
      form.elements.namedItem('limit').min = String(catalog.explorationLimit.minimum); form.elements.namedItem('limit').max = String(catalog.explorationLimit.maximum)
      status.textContent = 'Choose alternatives and enter the portfolio scope.'
    } catch { catalog = undefined; candidatesNode.replaceChildren(); status.textContent = 'Alternatives unavailable or access changed.' }
    finally { unlock() }
  })
  form.addEventListener('input', () => { reset(); form.dataset.dirty = 'true' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity() || !catalog) return
    const candidateRefs = [...candidatesNode.querySelectorAll('input:checked')].map((input) => input.value); if (!candidateRefs.length) { status.textContent = 'Choose at least one alternative.'; return }
    const fields = new FormData(form); const anchor = cases[Number(fields.get('anchor'))]
    if (!anchor || ![...casesNode.querySelectorAll('input:checked')].some((input) => cases[Number(input.value)] === anchor)) { status.textContent = 'Choose a decision to own this evaluation.'; return }
    if (!lock()) return; prepared = undefined; status.textContent = 'Calculating portfolio…'; output.replaceChildren()
    try {
      const selected = await request('decision-portfolio-selection', { caseRef: anchor.caseRef })
      if (!selected.selection || !Array.isArray(selected.selection.criteria)) { status.textContent = 'Open the decision and select its baseline, alternative and criteria first.'; return }
      const matching = catalog.cases.filter((item) => item.caseRef && typeof item.caseRef === 'object' && item.caseRef.id === anchor.caseRef.id && item.caseRef.incarnation === anchor.caseRef.incarnation && item.caseRef.version === anchor.caseRef.version)
      const anchorCatalog = matching[0]
      if (matching.length !== 1 || !anchorCatalog || anchorCatalog.caseVersion !== anchor.caseRef.version || selected.selection.criteria.some((id) => !anchorCatalog.criteria.some((criterion) => criterion.id === id))) throw new Error('stale')
      const portfolioRequest = { scope: { horizon: { start: fields.get('start'), end: fields.get('end') }, currency: fields.get('currency') }, candidateRefs, operations: [], constraints: selected.selection.criteria, priorities: [], explorationLimit: Number(fields.get('limit')) }
      const value = await request('decision-portfolio-preview', { purpose: 'preview', caseRef: anchor.caseRef, request: portfolioRequest }); prepared = { caseRef: anchor.caseRef, request: portfolioRequest }
      const criteria = document.createElement('p'); criteria.textContent = selected.selection.criteria.length ? 'Selected criteria: ' + selected.selection.criteria.map((id) => anchorCatalog.criteria.find((criterion) => criterion.id === id).description).join(', ') : 'No criteria selected.'; output.append(criteria)
      value.portfolio.combinations.forEach((combination, index) => {
        const entry = document.createElement('article'); const heading = document.createElement('h3'); heading.textContent = 'Combination ' + (index + 1) + ' · ' + combination.eligibility + ' · ' + combination.comparisonStatus; entry.append(heading)
        if (combination.analysis) {
          const scenario = combination.analysis.scenario; const comparison = combination.analysis.comparison; const line = document.createElement('p')
          line.textContent = (scenario.comparisonStatus === 'complete' ? 'Total: ' + scenario.total : 'Known subtotal: ' + (scenario.knownSubtotal ?? 'unavailable')) + ' ' + scenario.currency + ' · ' + scenario.horizon.start + ' – ' + scenario.horizon.end + ' · ' + (comparison.comparisonStatus === 'complete' ? 'Difference: ' + comparison.completeDifference : 'Known difference: ' + (comparison.knownDifference ?? 'unavailable')); entry.append(line)
          scenario.costCoverage.entries.filter((item) => item.status === 'pending').forEach((item) => { const condition = document.createElement('p'); condition.textContent = item.categoryId + ': ' + item.reason; entry.append(condition) })
        }
        ;[...combination.conflicts, ...combination.restrictions].forEach((condition) => { const line = document.createElement('p'); line.textContent = condition; entry.append(line) }); output.append(entry)
      })
      value.portfolio.limitations.forEach((limitation) => { const line = document.createElement('p'); line.textContent = limitation; output.append(line) }); status.textContent = 'Preview complete. No portfolio result has been saved.'
    } catch { prepared = undefined; status.textContent = 'Portfolio unavailable or its sources changed.' }
    finally { unlock() }
  })
  save.addEventListener('click', async () => {
    if (!prepared || !lock()) return; status.textContent = 'Saving evaluation…'
    try { const value = await request('decision-portfolio-evaluate', prepared, evaluationKey); if (!value.portfolioResultRef) throw new Error('unavailable'); status.textContent = 'Portfolio evaluation saved.'; prepared = undefined; delete form.dataset.dirty }
    catch { status.textContent = 'Could not confirm the evaluation. Retry the same request.' }
    finally { unlock() }
  })
})
`
