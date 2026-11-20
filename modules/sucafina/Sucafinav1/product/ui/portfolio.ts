import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** All case and candidate identities are supplied by the authorized portfolio catalog. */
export const portfolioWidget = `<details><summary>Explore a portfolio</summary><section data-portfolio><p>Select decisions and their alternatives. Comparisons are calculated by the portfolio service.</p><button type="button" data-portfolio-cases>Find decisions</button><fieldset data-portfolio-case-list><legend>Decisions to include</legend></fieldset><button type="button" data-portfolio-catalog>Find alternatives</button><fieldset data-portfolio-candidates><legend>Alternatives</legend></fieldset><form data-portfolio-form><label>Decision that will own this evaluation<select name="anchor" aria-label="Decision that will own this evaluation" required><option value="">Choose a decision</option></select></label><label>Portfolio start<input type="date" name="start" required></label><label>Portfolio end<input type="date" name="end" required></label><label>Currency<input name="currency" required maxlength="3"></label><label>Maximum combinations<input name="limit" type="number" min="1" max="1024" required></label><label><input type="checkbox" name="unconstrained" required>Use the selected decision criteria without additional priorities</label><button>Preview portfolio</button></form><p role="status" aria-live="polite"></p><div data-portfolio-results></div><button type="button" data-portfolio-save disabled>Save this evaluation</button><form data-portfolio-promote hidden><h3>Promote a combination</h3><label>Combination<select name="combination" aria-label="Combination" required><option value="">Choose a combination</option></select></label><button type="button" data-portfolio-coverage>Find coverage assessments</button><label>Coverage<select name="coverage" aria-label="Coverage" required><option value="">Choose coverage</option></select></label><label>Alternative title<input name="title" required></label><button type="submit">Create alternative</button><p role="status" aria-live="polite"></p></form><form data-portfolio-prepare hidden><h3>Prepare the selected combination</h3><button type="button" data-portfolio-choices>Find recorded choices</button><label>Recorded choice<select name="choice" aria-label="Recorded choice" required><option value="">Choose a recorded choice</option></select></label><button type="submit">Prepare changes from choice</button><p role="status" aria-live="polite"></p></form></section></details>`

export function portfolioHistory(projection: AuthorizedCaseProjection) {
  return `<section data-portfolio-history data-case="${esc(JSON.stringify({ id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }))}"><h3>Saved portfolio evaluations</h3><p role="status">Loading evaluations…</p><div data-results></div></section>`
}

export const portfolioScript = `
;(() => {
  const fresh = [...document.querySelectorAll('[data-portfolio], [data-portfolio-history]')].filter((node) => !node.dataset.sfPortfolioReady)
  if (!fresh.length) return
  const access = { closed: false, generation: 0, cleanups: new Set(), requests: new Set() }
  const live = (node, generation = access.generation) => !access.closed && node.isConnected && generation === access.generation
  const close = (message) => {
    if (access.closed) return
    access.closed = true; access.generation++
    access.cleanups.forEach((cleanup) => cleanup(message))
    access.cleanups.clear()
    removeEventListener('sf-access-revoked', denied)
    removeEventListener('pagehide', leave)
  }
  const denied = () => close('Access changed. Portfolio content cleared; reload to continue.')
  const leave = () => {
    close('This portfolio view is closed. Reload to read the current decision before continuing.')
    access.requests.forEach((controller) => controller.abort())
  }
  addEventListener('sf-access-revoked', denied)
  addEventListener('pagehide', leave, { once: true })
  const scrub = (section, message) => {
    section.querySelectorAll('input,select,textarea').forEach((field) => {
      field.value = ''; field.removeAttribute('value'); field.disabled = true
      if ('defaultValue' in field) field.defaultValue = ''
      if ('checked' in field) field.checked = false
      if (field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') field.replaceChildren()
    })
    section.querySelectorAll('[data-dirty]').forEach((form) => { delete form.dataset.dirty })
    section.removeAttribute('data-case'); section.removeAttribute('data-context')
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = message
    const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'Reload portfolio'; reload.addEventListener('click', () => location.reload())
    section.replaceChildren(status, reload)
  }
  const request = async (section, mode, payload, key = crypto.randomUUID(), method = 'POST') => {
    const generation = access.generation
    if (!live(section, generation)) throw new Error('inactive')
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000)
    access.requests.add(controller)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) } : {}) })
      if (!live(section, generation)) throw new Error('inactive')
      if (response.status === 401 || response.status === 403) { denied(); throw new Error('denied') }
      const result = await response.json()
      if (!live(section, generation)) throw new Error('inactive')
      if (result?.status === 'denied') { denied(); throw new Error('denied') }
      if (!response.ok || result?.status !== 'ok') {
        const rejected = [400, 422].includes(response.status) && result?.status === 'needs-input' && result.reason === 'invalid-decision-input'
        throw new Error(rejected ? 'rejected' : 'unavailable')
      }
      return result.value
    } finally { clearTimeout(timer); access.requests.delete(controller) }
  }
  fresh.filter((node) => node.matches('[data-portfolio-history]')).forEach(async (section) => {
    section.dataset.sfPortfolioReady = 'true'
    const status = section.querySelector('[role=status]'), results = section.querySelector('[data-results]')
    let caseRef
    try { caseRef = JSON.parse(section.dataset.case) } catch { status.textContent = 'Portfolio history unavailable.'; return }
    access.cleanups.add((message) => { caseRef = undefined; scrub(section, message) })
    try {
      const entries = await request(section, 'decision-portfolio-results', { purpose: 'results', caseRef })
      if (!live(section)) return
      if (!Array.isArray(entries)) throw new Error('unavailable')
      status.textContent = entries.length ? '' : 'No saved evaluations for this decision version.'
      for (const item of entries) {
        if (!live(section)) return
        const entry = document.createElement('article'), heading = document.createElement('h4'); heading.textContent = 'Evaluation · ' + item.createdAt; entry.append(heading); results.append(entry)
        try {
          const saved = await request(section, 'decision-portfolio-read', { caseRef, resultRef: item.resultRef })
          if (!live(section)) return
          saved.portfolio.combinations.forEach((combination, index) => {
            const line = document.createElement('p'); line.textContent = 'Combination ' + (index + 1) + ': ' + combination.eligibility + ' · ' + combination.comparisonStatus; entry.append(line)
            combination.restrictions.forEach((restriction) => { const detail = document.createElement('p'); detail.textContent = restriction; entry.append(detail) })
          })
          saved.portfolio.limitations.forEach((limitation) => { const line = document.createElement('p'); line.textContent = limitation; entry.append(line) })
        } catch { if (!live(section)) return; const line = document.createElement('p'); line.textContent = 'Evaluation unavailable or access changed.'; entry.append(line) }
      }
    } catch { if (!live(section)) return; results.replaceChildren(); status.textContent = 'Portfolio history unavailable or access changed.' }
  })
  fresh.filter((node) => node.matches('[data-portfolio]')).forEach((section) => {
    section.dataset.sfPortfolioReady = 'true'
    const status = section.querySelector('[role=status]'), casesNode = section.querySelector('[data-portfolio-case-list]')
    const candidatesNode = section.querySelector('[data-portfolio-candidates]'), output = section.querySelector('[data-portfolio-results]')
    const save = section.querySelector('[data-portfolio-save]'), form = section.querySelector('[data-portfolio-form]')
    const promotion = section.querySelector('[data-portfolio-promote]'), promotionStatus = promotion.querySelector('[role=status]')
    const preparation = section.querySelector('[data-portfolio-prepare]'), preparationStatus = preparation.querySelector('[role=status]')
    const initialDisabled = new Map(), labels = new Map()
    const controls = () => [...section.querySelectorAll('button,input,select,textarea')]
    const remember = () => {
      initialDisabled.forEach((_, control) => { if (!section.contains(control)) initialDisabled.delete(control) })
      labels.forEach((_, control) => { if (!section.contains(control)) labels.delete(control) })
      controls().forEach((control) => { if (!initialDisabled.has(control)) initialDisabled.set(control, control.disabled); if (control.tagName === 'BUTTON' && !labels.has(control)) labels.set(control, control.textContent) })
    }
    remember()
    let cases = [], catalog, prepared, pending, frozen, busy = false, saved = false, complete = false
    const current = () => live(section)
    const present = () => {
      if (!current()) return
      remember()
      controls().forEach((control) => { control.disabled = busy || complete || !!pending || initialDisabled.get(control) })
      labels.forEach((label, button) => { button.textContent = label })
      save.disabled = busy || complete || !!pending || !prepared || saved
      if (pending && !busy && !complete) { pending.button.disabled = false; pending.button.textContent = 'Retry same ' + pending.kind }
    }
    const lock = () => {
      if (!current() || busy || complete || pending) return false
      busy = true; present(); return true
    }
    const unlock = () => { busy = false; present() }
    const restoreFrozen = () => frozen?.forEach((value, field) => {
      field.value = value.value
      if ('checked' in field) field.checked = value.checked
    })
    const reset = () => {
      if (!current() || pending || busy || complete) { restoreFrozen(); return false }
      prepared = undefined; saved = false; save.disabled = true
      promotion.hidden = true; preparation.hidden = true; output.replaceChildren()
      return true
    }
    access.cleanups.add((message) => {
      if (pending) { pending.body = ''; pending.caseRef = undefined }
      cases = []; catalog = undefined; prepared = undefined; pending = undefined; frozen = undefined
      initialDisabled.clear(); labels.clear(); scrub(section, message)
    })
    const mutate = async (kind, mode, payload, button, targetStatus) => {
      if (!current() || busy || complete || pending && pending.kind !== kind) return
      const retrying = !!pending
      if (!pending) {
        if (!prepared) return
        // The serialized command is written once and reused verbatim; only a
        // closed page may erase it during private-data cleanup.
        pending = { kind, mode, body: JSON.stringify(payload), key: crypto.randomUUID(), button,
          caseRef: structuredClone(prepared.caseRef) }
        frozen = new Map([...section.querySelectorAll('input,select,textarea')].map((field) => [field, { value: field.value, checked: field.checked }]))
      }
      const intent = pending
      busy = true; present(); targetStatus.textContent = retrying ? 'Recovering the same ' + kind + '…' : kind === 'evaluation' ? 'Saving evaluation…' : kind === 'promotion' ? 'Creating alternative…' : 'Preparing changes…'
      try {
        const value = await request(section, intent.mode, intent.body, intent.key)
        if (!current() || pending !== intent) return
        const valid = kind === 'evaluation' ? typeof value?.portfolioResultRef === 'string' && !!value.portfolioResultRef.trim()
          : value?.caseRef?.id === intent.caseRef.id && value.caseRef.incarnation === intent.caseRef.incarnation &&
            value.caseRef.version === intent.caseRef.version + 1
        if (!valid) throw new Error('unavailable')
        pending = undefined; frozen = undefined
        if (kind === 'evaluation') { saved = true; delete form.dataset.dirty; targetStatus.textContent = 'Portfolio evaluation saved.'; return }
        complete = true; delete form.dataset.dirty; delete promotion.dataset.dirty; delete preparation.dataset.dirty
        location.reload()
      } catch (error) {
        if (!current() || pending !== intent) return
        if (!retrying && error instanceof Error && error.message === 'rejected') {
          pending = undefined; frozen = undefined
          targetStatus.textContent = 'The ' + kind + ' was rejected. Review the current inputs and try again.'
        } else targetStatus.textContent = 'Could not confirm the ' + kind + '. The original request is locked; retry the same request.'
      } finally { busy = false; present() }
    }
    section.querySelector('[data-portfolio-cases]').addEventListener('click', async () => {
      if (!reset() || !lock()) return
      status.textContent = 'Finding decisions…'
      try {
        const values = await request(section, 'decision-list', undefined, undefined, 'GET')
        if (!current()) return
        if (!Array.isArray(values)) throw new Error('unavailable')
        cases = values; casesNode.replaceChildren()
        const legend = document.createElement('legend'); legend.textContent = 'Decisions to include'; casesNode.append(legend)
        cases.forEach((item, index) => {
          const label = document.createElement('label'), input = document.createElement('input')
          input.type = 'checkbox'; input.value = String(index)
          input.addEventListener('change', () => { if (!reset()) return; catalog = undefined; candidatesNode.replaceChildren(); form.dataset.dirty = 'true' })
          label.append(input, item.objective); casesNode.append(label)
        })
        status.textContent = cases.length ? 'Choose decisions, then find alternatives.' : 'No accessible decisions.'
      } catch { if (current()) status.textContent = 'Decisions unavailable or access changed.' }
      finally { unlock() }
    })
    section.querySelector('[data-portfolio-catalog]').addEventListener('click', async () => {
      if (!current() || pending || busy) return
      const selected = [...casesNode.querySelectorAll('input:checked')].map((input) => cases[Number(input.value)]).filter(Boolean)
      if (!selected.length) { status.textContent = 'Choose at least one decision.'; return }
      if (!reset() || !lock()) return
      status.textContent = 'Finding alternatives…'
      try {
        const found = await request(section, 'decision-portfolio-catalog', { purpose: 'catalog', caseRefs: selected.map((item) => item.caseRef) })
        if (!current()) return
        catalog = found; candidatesNode.replaceChildren()
        const legend = document.createElement('legend'); legend.textContent = 'Alternatives'; candidatesNode.append(legend)
        catalog.cases.forEach((item) => item.alternatives.forEach((alternative) => {
          const label = document.createElement('label'), input = document.createElement('input')
          input.type = 'checkbox'; input.value = alternative.candidateRef
          input.addEventListener('change', () => { if (reset()) form.dataset.dirty = 'true' })
          label.append(input, item.objective + ' · ' + alternative.title + ' · ' + alternative.comparisonStatus); candidatesNode.append(label)
        }))
        const anchor = form.elements.namedItem('anchor'); anchor.replaceChildren()
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a decision'; anchor.append(empty)
        selected.forEach((item) => { const option = document.createElement('option'); option.value = String(cases.indexOf(item)); option.textContent = item.objective; anchor.append(option) })
        form.elements.namedItem('limit').min = String(catalog.explorationLimit.minimum); form.elements.namedItem('limit').max = String(catalog.explorationLimit.maximum)
        status.textContent = 'Choose alternatives and enter the portfolio scope.'
      } catch { if (current()) { catalog = undefined; candidatesNode.replaceChildren(); status.textContent = 'Alternatives unavailable or access changed.' } }
      finally { unlock() }
    })
    form.addEventListener('input', () => { if (reset()) form.dataset.dirty = 'true' })
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (!current() || busy || pending || complete || !form.reportValidity() || !catalog) return
      const candidateRefs = [...candidatesNode.querySelectorAll('input:checked')].map((input) => input.value)
      if (!candidateRefs.length) { status.textContent = 'Choose at least one alternative.'; return }
      const fields = new FormData(form), anchor = cases[Number(fields.get('anchor'))]
      if (!anchor || ![...casesNode.querySelectorAll('input:checked')].some((input) => cases[Number(input.value)] === anchor)) { status.textContent = 'Choose a decision to own this evaluation.'; return }
      if (!lock()) return
      prepared = undefined; status.textContent = 'Calculating portfolio…'; output.replaceChildren()
      try {
        const selected = await request(section, 'decision-portfolio-selection', { caseRef: anchor.caseRef })
        if (!current()) return
        if (!selected.selection || !Array.isArray(selected.selection.criteria)) { status.textContent = 'Open the decision and select its baseline, alternative and criteria first.'; return }
        const matching = catalog.cases.filter((item) => item.caseRef && typeof item.caseRef === 'object' && item.caseRef.id === anchor.caseRef.id && item.caseRef.incarnation === anchor.caseRef.incarnation && item.caseRef.version === anchor.caseRef.version)
        const anchorCatalog = matching[0]
        if (matching.length !== 1 || !anchorCatalog || anchorCatalog.caseVersion !== anchor.caseRef.version || selected.selection.criteria.some((id) => !anchorCatalog.criteria.some((criterion) => criterion.id === id))) throw new Error('stale')
        const portfolioRequest = { scope: { horizon: { start: fields.get('start'), end: fields.get('end') }, currency: fields.get('currency') }, candidateRefs, operations: [], constraints: selected.selection.criteria, priorities: [], explorationLimit: Number(fields.get('limit')) }
        const value = await request(section, 'decision-portfolio-preview', { purpose: 'preview', caseRef: anchor.caseRef, request: portfolioRequest })
        if (!current()) return
        prepared = { caseRef: structuredClone(anchor.caseRef), request: portfolioRequest, evaluationDigest: value.evaluationDigest, selections: value.selections }
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
      } catch { if (current()) { prepared = undefined; status.textContent = 'Portfolio unavailable or its sources changed.' } }
      finally { unlock() }
    })
    save.addEventListener('click', () => {
      if (!prepared) return
      return mutate('evaluation', 'decision-portfolio-evaluate', { caseRef: prepared.caseRef, request: prepared.request }, save, status)
    })
    promotion.addEventListener('input', () => { if (pending || busy || complete) { restoreFrozen(); return } promotion.dataset.dirty = 'true' })
    promotion.querySelector('[data-portfolio-coverage]').addEventListener('click', async () => {
      if (!prepared || !lock()) return
      promotionStatus.textContent = 'Finding coverage…'
      try {
        const values = await request(section, 'decision-coverage-catalog', { purpose: 'coverage-catalog', caseRef: prepared.caseRef })
        if (!current()) return
        const select = promotion.elements.namedItem('coverage'); select.replaceChildren()
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose coverage'; select.append(empty)
        values.forEach((item) => { const option = document.createElement('option'); option.value = item.coverageRef; option.textContent = item.label + ' · ' + item.state; select.append(option) })
        promotionStatus.textContent = values.length ? 'Choose the coverage to review.' : 'No current coverage is available.'
      } catch { if (current()) promotionStatus.textContent = 'Coverage unavailable or access changed.' }
      finally { unlock() }
    })
    promotion.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = promotion.querySelector('button[type=submit]')
      if (pending?.kind === 'promotion') return mutate('promotion', pending.mode, undefined, button, promotionStatus)
      if (!current() || !prepared || busy || pending || complete || !promotion.reportValidity()) return
      const fields = new FormData(promotion), selected = prepared.selections.filter((item) => item.combinationId === fields.get('combination'))
      if (selected.length !== 1) return
      return mutate('promotion', 'decision-promote-portfolio', { caseRef: prepared.caseRef, request: prepared.request,
        selectedCandidateRefs: selected[0].selectedCandidateRefs, combinationId: fields.get('combination'),
        expectedEvaluationDigest: prepared.evaluationDigest, title: String(fields.get('title') || '').trim(), coverageRef: fields.get('coverage') }, button, promotionStatus)
    })
    preparation.addEventListener('input', () => { if (pending || busy || complete) { restoreFrozen(); return } preparation.dataset.dirty = 'true' })
    preparation.querySelector('[data-portfolio-choices]').addEventListener('click', async () => {
      if (!prepared || !lock()) return
      preparationStatus.textContent = 'Finding recorded choices…'
      try {
        const values = await request(section, 'decision-choice-catalog', { purpose: 'choice-catalog', caseRef: prepared.caseRef })
        if (!current()) return
        const select = preparation.elements.namedItem('choice'); select.replaceChildren()
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a recorded choice'; select.append(empty)
        values.forEach((item) => { const option = document.createElement('option'); option.value = item.choiceId; option.textContent = item.label + ' · ' + item.at; select.append(option) })
        preparationStatus.textContent = values.length ? 'Choose a recorded choice and a combination above.' : 'No recorded choice is available.'
      } catch { if (current()) preparationStatus.textContent = 'Choices unavailable or access changed.' }
      finally { unlock() }
    })
    preparation.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = preparation.querySelector('button[type=submit]')
      if (pending?.kind === 'preparation') return mutate('preparation', pending.mode, undefined, button, preparationStatus)
      if (!current() || !prepared || busy || pending || complete || !preparation.reportValidity()) return
      const combination = promotion.elements.namedItem('combination').value
      const selected = prepared.selections.filter((item) => item.combinationId === combination), choiceId = preparation.elements.namedItem('choice').value
      if (selected.length !== 1 || !choiceId) { preparationStatus.textContent = 'Choose a combination and a recorded choice.'; return }
      return mutate('preparation', 'decision-prepare-portfolio', { caseRef: prepared.caseRef, request: prepared.request,
        selectedCandidateRefs: selected[0].selectedCandidateRefs, combinationId: combination,
        expectedEvaluationDigest: prepared.evaluationDigest, choiceId }, button, preparationStatus)
    })
    present()
  })
})()
`
