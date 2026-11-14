import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"
import { decisionFormContext } from "./decision-alternatives.ts"

type ChoiceIntentionContext = { scope: string; caseRef: { id: string; incarnation: string; version: number } }
type ChoiceIntentionAction = "decision-choose" | "decision-prepare-changes" | "decision-criteria"

/** Reload may advance the case, but it must never replace the original mutation bytes or principal. */
export function readDecisionChoiceIntention(raw: string, context: ChoiceIntentionContext) {
  const saved: unknown = JSON.parse(raw)
  if (!saved || typeof saved !== "object" || Array.isArray(saved) || Object.keys(saved).some((key) => !["scope", "action", "key", "body"].includes(key))) throw new Error("invalid-choice-intention")
  const value = saved as { scope?: unknown; action?: unknown; key?: unknown; body?: unknown }
  if (value.scope !== context.scope || !["decision-choose", "decision-prepare-changes", "decision-criteria"].includes(String(value.action)) || typeof value.key !== "string" || !value.key.trim() || value.key.length > 128 || typeof value.body !== "string" || new TextEncoder().encode(value.body).byteLength > 262144) throw new Error("invalid-choice-intention")
  const payload = JSON.parse(value.body)
  const fields = value.action === "decision-choose" ? ["caseRef", "alternativeId", "alternativeVersion", "comparison", "criteria", "reason"] : value.action === "decision-prepare-changes" ? ["caseRef", "choiceId", "operations"] : ["caseRef", "criterionId", "metricRef", "operator", "value", "unit", "period", "evidenceRefs", "expectedRuleVersion"]
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length !== fields.length || Object.keys(payload).some((key) => !fields.includes(key))) throw new Error("invalid-choice-payload")
  const ref = payload.caseRef
  if (!ref || typeof ref !== "object" || Object.keys(ref).length !== 3 || Object.keys(ref).some((key) => !["id", "incarnation", "version"].includes(key)) || ref.id !== context.caseRef.id || ref.incarnation !== context.caseRef.incarnation || !Number.isSafeInteger(ref.version) || ref.version < 1 || ref.version > context.caseRef.version) throw new Error("invalid-choice-case")
  if (value.action === "decision-choose" && (typeof payload.alternativeId !== "string" || !payload.alternativeId.trim() || !Number.isSafeInteger(payload.alternativeVersion) || payload.alternativeVersion < 1 || typeof payload.reason !== "string" || !payload.reason.trim() || !Array.isArray(payload.criteria) || !payload.criteria.length || payload.criteria.some((id: unknown) => typeof id !== "string" || !id.trim()) || !payload.comparison || !Array.isArray(payload.comparison.scenarioRefs) || payload.comparison.scenarioRefs.length !== 2)) throw new Error("invalid-choice-payload")
  if (value.action === "decision-prepare-changes" && (typeof payload.choiceId !== "string" || !payload.choiceId.trim() || !Array.isArray(payload.operations) || !payload.operations.length)) throw new Error("invalid-choice-payload")
  if (value.action === "decision-criteria" && (typeof payload.criterionId !== "string" || !payload.criterionId.trim() || payload.metricRef !== "planner:known-subtotal-difference" || !["lte", "gte", "eq"].includes(payload.operator) || typeof payload.value !== "number" || !Number.isFinite(payload.value) || typeof payload.unit !== "string" || !payload.unit.trim() || !payload.period || typeof payload.period.start !== "string" || typeof payload.period.end !== "string" || !payload.period.start.trim() || !payload.period.end.trim() || !Array.isArray(payload.evidenceRefs) || !payload.evidenceRefs.length || !Number.isSafeInteger(payload.expectedRuleVersion) || payload.expectedRuleVersion < 0)) throw new Error("invalid-choice-payload")
  return Object.freeze({ scope: context.scope, action: value.action as ChoiceIntentionAction, key: value.key, body: value.body })
}

export function createDecisionChoiceIntention(action: ChoiceIntentionAction, payload: object, key: string, context: ChoiceIntentionContext) {
  return readDecisionChoiceIntention(JSON.stringify({ scope: context.scope, action, key, body: JSON.stringify(payload) }), context)
}

/** A replay receipt is compared with the frozen command revision, never the later page revision. */
export function isDecisionChoiceReceipt(receipt: unknown, expected: ChoiceIntentionContext["caseRef"]) {
  if (!receipt || typeof receipt !== "object" || !("caseRef" in receipt)) return false
  const ref = receipt.caseRef
  return !!ref && typeof ref === "object" && "id" in ref && "incarnation" in ref && "version" in ref && ref.id === expected.id && ref.incarnation === expected.incarnation && typeof ref.version === "number" && Number.isSafeInteger(ref.version) && ref.version === expected.version + 1
}

/** Registering a numeric rule advances its rule version, not the decision case revision. */
export function isDecisionCriterionReceipt(receipt: unknown, expectedVersion: number) {
  return !!receipt && typeof receipt === "object" && "ruleRef" in receipt && typeof receipt.ruleRef === "string" && !!receipt.ruleRef.trim() && "version" in receipt && typeof receipt.version === "number" && Number.isSafeInteger(receipt.version) && receipt.version === expectedVersion + 1
}

function decisionPreparationForm(projection: AuthorizedCaseProjection) {
  const choices = projection.case.choices
  const preparedChoiceIds = [...new Set(projection.case.preparedChanges.map((change) => change.choiceId))]
  const context = { ...decisionFormContext(projection), choices, preparedChoiceIds }
  const first = choices[0]
  const canPrepare = !!first?.scenario.operations.length && !preparedChoiceIds.includes(first.id)
  return `<section aria-label="Recorded choices"><h3>Recorded choices</h3><p>These are the original human choices and their saved sources, assumptions and cost coverage. Recording or preparing a choice does not approve a financial change.</p>${choices.length ? `<form data-decision-prepare data-context="${esc(JSON.stringify(context))}"><label>Recorded choice<select data-choice-prepare-select>${choices.map((choice) => `<option value="${esc(choice.id)}">${esc(choice.at)} · ${esc(choice.reason)}</option>`).join("")}</select></label><p data-choice-prepare-summary></p><button type="submit"${canPrepare ? "" : " disabled"}>Prepare changes from this choice</button><p data-choice-prepare-status role="status" aria-live="polite">${first && preparedChoiceIds.includes(first.id) ? "This choice already has prepared changes. Review or recover them below." : canPrepare ? "Review the selected choice, then prepare its exact saved operations for preview." : "This recorded choice contains no executable operations. No changes were prepared."}</p></form>` : "<p>No human choice recorded.</p>"}</section>`
}

/** A comparison and choice always use the saved alternatives and domain result. */
export function decisionChoiceForm(projection: AuthorizedCaseProjection) {
  const item = projection.case
  const preparation = decisionPreparationForm(projection)
  if (item.alternatives.length < 2) return "<p>Add at least two alternatives before comparing a choice.</p>" + preparation
  const context = { ...decisionFormContext(projection), choices: item.choices, alternatives: item.alternatives.map((alternative) => ({ id: alternative.id, version: alternative.version, title: alternative.title, currency: alternative.result.currency, horizon: alternative.result.horizon })), criteria: item.criteria.map((criterion) => ({ id: criterion.id, description: criterion.description, required: criterion.required })) }
  const options = item.alternatives.map((alternative) => `<option value="${esc(alternative.id)}">${esc(alternative.title)}</option>`).join("")
  const numericRule = `<fieldset data-numeric-rule hidden><legend>Numeric comparison rule</legend><p>Define a limit only for a criterion that explicitly concerns the known subtotal difference. Missing costs remain unresolved, and saving a rule does not grant financial approval.</p><label>Criterion for numeric comparison<select data-numeric-criterion><option value="">Choose a criterion</option>${item.criteria.map((criterion) => `<option value="${esc(criterion.id)}">${esc(criterion.description)}</option>`).join("")}</select></label><button type="button" data-numeric-load>Load comparison rule</button><p data-numeric-basis></p><label>Evidence for the numeric rule<select data-numeric-evidence multiple disabled></select></label><label>Numeric comparison condition<select data-numeric-operator disabled><option value="">Choose a condition</option><option value="lte">At most</option><option value="gte">At least</option><option value="eq">Equal to</option></select></label><label>Limit for known subtotal difference in ${esc(item.currency)}<input data-numeric-value type="number" step="any" disabled></label><button type="button" data-numeric-save disabled>Save comparison rule</button><p data-numeric-status role="status" aria-live="polite"></p></fieldset>`
  return `<section><h3>Compare and choose</h3><p>A recorded choice preserves its comparison and conditions. Financial approval remains a separate explicit action.</p><form data-decision-choice data-context="${esc(JSON.stringify(context))}"><label>Baseline<select name="baseline">${options}</select></label><label>Alternative<select name="alternative">${options}</select></label><fieldset><legend>Criteria</legend>${item.criteria.map((criterion) => `<label><input type="checkbox" name="criteria" value="${esc(criterion.id)}" checked${criterion.required ? " required" : ""}>${esc(criterion.description)}${criterion.required ? " (required)" : ""}</label>`).join("")}</fieldset><button type="button" data-compare>Compare</button><div data-comparison role="status" aria-live="polite"></div>${numericRule}<button type="button" data-portfolio disabled>Use these alternatives in portfolio</button><details data-sensitivity hidden><summary>Explore sensitivity</summary><label>Criterion<select data-sensitivity-criterion><option value="">Choose a criterion</option>${item.criteria.map((criterion) => `<option value="${esc(criterion.id)}">${esc(criterion.description)}</option>`).join("")}</select></label><button type="button" data-sensitivity-rule>Load criterion and units</button><p data-sensitivity-basis></p><label>Minimum<input data-sensitivity-min type="number" step="any"></label><label>Maximum<input data-sensitivity-max type="number" step="any"></label><label>Sample steps<input data-sensitivity-steps type="number" min="1" max="1024" step="1"></label><button type="button" data-sensitivity-run>Evaluate sensitivity</button><div data-sensitivity-output role="status" aria-live="polite"></div></details><label>Reason for choosing<textarea name="reason" required></textarea></label><button type="submit" disabled>Record choice</button><p data-choice-status role="status" aria-live="polite"></p></form></section>${preparation}`
}

export const decisionChoiceScript = `
;(() => {
const readChoiceIntention = ${readDecisionChoiceIntention.toString()}
const createChoiceIntention = (action, payload, key, context) => readChoiceIntention(JSON.stringify({ scope: context.scope, action, key, body: JSON.stringify(payload) }), context)
const confirmedChoiceReceipt = ${isDecisionChoiceReceipt.toString()}
const confirmedCriterionReceipt = ${isDecisionCriterionReceipt.toString()}
const choiceStorageKey = (context) => 'sf:decision-ui:' + context.scope + ':choice'
const holdChoicePeers = (form) => document.querySelectorAll('[data-decision-edit], [data-decision-alternatives], [data-decision-choice], [data-decision-prepare], [data-decision-apply]').forEach((other) => {
  if (other !== form) { other.inert = true; other.dataset.choiceHeld = 'true' }
})
const releaseChoicePeers = () => document.querySelectorAll('[data-choice-held]').forEach((other) => { other.inert = false; delete other.dataset.choiceHeld })
const choiceEndpoint = (action) => {
  const url = new URL(location.href)
  if (!/\\/(dashboard|planner|procurement)$/.test(url.pathname)) throw new Error('unsupported-surface')
  url.pathname = url.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/dashboard')
  url.search = new URLSearchParams({ sf: action }).toString(); url.hash = ''
  return url
}
document.querySelectorAll('[data-decision-choice]').forEach((form) => {
  if (form.dataset.sfChoiceReady) return; form.dataset.sfChoiceReady = 'true'
  let context = JSON.parse(form.dataset.context)
  const storageKey = choiceStorageKey(context)
  const compare = form.querySelector('[data-compare]'); const choose = form.querySelector('button[type=submit]'); const portfolio = form.querySelector('[data-portfolio]')
  const output = form.querySelector('[data-comparison]'); const status = form.querySelector('[data-choice-status]')
  const sensitivity = form.querySelector('[data-sensitivity]'); const sensitivityOutput = form.querySelector('[data-sensitivity-output]'); const basis = form.querySelector('[data-sensitivity-basis]')
  const loadRule = sensitivity.querySelector('[data-sensitivity-rule]'); const evaluate = sensitivity.querySelector('[data-sensitivity-run]')
  const numeric = form.querySelector('[data-numeric-rule]'); const numericCriterion = form.querySelector('[data-numeric-criterion]')
  const numericLoad = form.querySelector('[data-numeric-load]'); const numericSave = form.querySelector('[data-numeric-save]')
  const numericEvidence = form.querySelector('[data-numeric-evidence]'); const numericOperator = form.querySelector('[data-numeric-operator]'); const numericValue = form.querySelector('[data-numeric-value]')
  const numericStatus = form.querySelector('[data-numeric-status]'); const numericDescription = form.querySelector('[data-numeric-basis]')
  let numericBasis
  let controls = [...form.querySelectorAll('select, input, textarea, button')]; const initial = new Map(controls.map((control) => [control, control.disabled]))
  let result; let rule; let key = crypto.randomUUID(); let portfolioKey = crypto.randomUUID(); let sensitivityKey = crypto.randomUUID()
  let pending; let snapshot; let busy = false; let accessRevoked = false; let reconciliationRequired = false; let completed = false
  const active = () => !accessRevoked && form.isConnected
  const foreignIntention = () => { try { return !!sessionStorage.getItem('sf:decision-ui:' + context.scope) || !!sessionStorage.getItem(storageKey) && !pending?.intent } catch { return true } }
  const locked = () => busy || !!pending || completed || reconciliationRequired || foreignIntention()
  const capture = () => controls.filter((control) => control.tagName !== 'BUTTON').map((control) => ({ control, value: control.value, checked: control.checked }))
  const restore = () => snapshot?.forEach(({ control, value, checked }) => { control.value = value; if (typeof checked === 'boolean') control.checked = checked })
  const sync = () => {
    if (!active()) return
    controls.forEach((control) => { control.disabled = locked() || initial.get(control) })
    compare.disabled = locked(); choose.disabled = busy || reconciliationRequired || foreignIntention() || (!completed && (((!result || result.rulesReady === false) && pending?.kind !== 'choice') || (!!pending && pending.kind !== 'choice')))
    portfolio.disabled = busy || completed || reconciliationRequired || foreignIntention() || !result || (!!pending && pending.kind !== 'portfolio')
    loadRule.disabled = locked() || !result; evaluate.disabled = busy || completed || reconciliationRequired || foreignIntention() || !result || !rule || (!!pending && pending.kind !== 'sensitivity')
    numericLoad.disabled = locked() || !result
    ;[numericEvidence, numericOperator, numericValue].forEach((control) => { control.disabled = locked() || !numericBasis })
    numericSave.disabled = busy || completed || reconciliationRequired || foreignIntention() || (pending ? pending.kind !== 'criterion' : !result || !numericBasis)
    numericSave.textContent = pending?.kind === 'criterion' ? 'Retry the same comparison rule' : 'Save comparison rule'
    choose.textContent = completed ? 'Reload decision' : pending?.kind === 'choice' ? 'Retry the same choice' : 'Record choice'
    portfolio.textContent = pending?.kind === 'portfolio' ? 'Retry the same portfolio selection' : 'Use these alternatives in portfolio'
    evaluate.textContent = pending?.kind === 'sensitivity' ? 'Retry the same sensitivity request' : 'Evaluate sensitivity'
  }
  const begin = () => { if (!pending) snapshot = capture(); busy = true; sync() }
  const finish = () => { busy = false; if (!pending && !completed) snapshot = undefined; sync() }
  const revoke = () => {
    if (accessRevoked) return; accessRevoked = true
    try { sessionStorage.removeItem(storageKey) } catch { /* The protected DOM is still removed when browser storage cannot be cleared. */ }
    context = undefined; result = undefined; rule = undefined; numericBasis = undefined; pending = undefined; snapshot = undefined
    controls.forEach((control) => { if (control.tagName === 'SELECT') control.replaceChildren(); else if (control.tagName !== 'BUTTON') { control.value = ''; if ('checked' in control) control.checked = false }; control.disabled = true })
    controls = []; initial.clear(); output.replaceChildren(); sensitivityOutput.replaceChildren(); basis.textContent = ''; delete form.dataset.context; delete form.dataset.dirty
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Decision access changed. Reopen it with your current access.'; form.replaceChildren(message)
  }
  addEventListener('sf-access-revoked', revoke)
  const invalidate = () => {
    if (!active()) return; if (locked()) { restore(); return }
    result = undefined; rule = undefined; numericBasis = undefined; numeric.hidden = true; numericEvidence.replaceChildren(); numericDescription.textContent = ''; numericStatus.textContent = ''; sensitivity.hidden = true; output.textContent = 'Compare the current selection before recording a choice.'; basis.textContent = ''; sensitivityOutput.replaceChildren()
    key = crypto.randomUUID(); portfolioKey = crypto.randomUUID(); sensitivityKey = crypto.randomUUID(); form.dataset.dirty = 'true'; sync()
  }
  form.querySelectorAll('select[name=baseline], select[name=alternative], input[name=criteria]').forEach((input) => input.addEventListener('change', invalidate))
  form.querySelector('textarea').addEventListener('input', () => { if (!active()) return; if (locked()) { restore(); return }; key = crypto.randomUUID(); form.dataset.dirty = 'true' })
  const send = async (action, payload, id) => {
    const url = choiceEndpoint(action)
    const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) })
      if (accessRevoked || response.status === 401 || response.status === 403) { dispatchEvent(new Event('sf-access-revoked')); throw Object.assign(new Error('access-changed'), { accessDenied: true }) }
      const value = await response.json()
      if (accessRevoked) throw Object.assign(new Error('access-changed'), { accessDenied: true })
      if (!response.ok || value.status !== 'ok') throw Object.assign(new Error('unavailable'), { httpStatus: response.status, inputRejected: response.status === 400 && value.reason === 'invalid-decision-input', rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'conflict'].includes(value.status) })
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
      if (wasUncertain || pending.intent && !error.inputRejected) { reconciliationRequired = true; message.textContent = 'The request was rejected but the earlier ' + kind + ' is still unconfirmed. Reopen the decision to reconcile its current state.' }
      else { if (pending.intent) { sessionStorage.removeItem(storageKey); releaseChoicePeers() }; pending = undefined; key = crypto.randomUUID(); portfolioKey = crypto.randomUUID(); sensitivityKey = crypto.randomUUID(); message.textContent = 'The ' + kind + ' was rejected. Your entries are preserved; review the current decision before retrying.' }
      return true
    }
    return false
  }
  compare.addEventListener('click', async () => {
    if (!active() || locked() || compare.disabled) return
    const fields = new FormData(form); const baseline = fields.get('baseline'); const alternative = fields.get('alternative'); const criteria = fields.getAll('criteria')
    if (baseline === alternative || context.criteria.some((criterion) => criterion.required && !criteria.includes(criterion.id))) { output.textContent = 'Select two different alternatives and all required criteria.'; return }
    begin(); rule = undefined; numericBasis = undefined; numeric.hidden = true; numericEvidence.replaceChildren(); numericDescription.textContent = ''; sensitivity.hidden = true; output.textContent = 'Comparing alternatives…'
    try {
      const compared = await send('decision-compare', { caseRef: context.caseRef, baselineAlternativeId: baseline, alternativeId: alternative, criteria }, crypto.randomUUID())
      result = { request: compared.request, baselineAlternativeId: baseline, alternativeId: alternative, criteria, rulesReady: !compared.comparison.criterionResults.some((criterion) => criterion.reason === 'criterion-rule-unavailable') }; key = crypto.randomUUID(); portfolioKey = crypto.randomUUID()
      const value = compared.comparison; output.replaceChildren()
      const summary = document.createElement('p'); summary.textContent = 'Comparison: ' + value.comparisonStatus + ' · ' + (value.comparisonStatus === 'complete' ? 'Difference: ' + value.completeDifference : 'Known difference: ' + (value.knownDifference ?? 'unavailable')); output.append(summary)
      ;[baseline, alternative].forEach((id) => { const source = context.alternatives.find((item) => item.id === id); if (!source) return; const line = document.createElement('p'); line.textContent = source.title + ' · ' + source.currency + ' · ' + source.horizon.start + ' – ' + source.horizon.end; output.append(line) })
      value.unresolvedConditions.forEach((condition) => { const line = document.createElement('p'); line.textContent = condition; output.append(line) })
      value.criterionResults.forEach((criterion) => { const line = document.createElement('p'); line.textContent = (context.criteria.find((item) => item.id === criterion.criterionId)?.description || 'Criterion') + ': ' + criterion.state + ' · ' + criterion.reason; output.append(line) })
      sensitivity.hidden = false; numeric.hidden = false
      numericStatus.textContent = result.rulesReady ? 'Current numeric rules were read with this comparison.' : 'A selected criterion has no numeric rule. Define its rule before recording a choice.'
    } catch (error) { if (error?.accessDenied) revoke(); else if (active()) { result = undefined; output.textContent = 'Comparison unavailable or sources changed. Check the alternatives and try again.' } }
    finally { finish() }
  })
  numericCriterion.addEventListener('change', () => {
    if (!active()) return; if (locked()) { restore(); return }
    numericBasis = undefined; numericEvidence.replaceChildren(); numericOperator.value = ''; numericValue.value = ''; numericDescription.textContent = ''; numericStatus.textContent = ''; form.dataset.dirty = 'true'; sync()
  })
  ;[numericEvidence, numericOperator, numericValue].forEach((control) => control.addEventListener('input', () => { if (!active()) return; if (locked()) { restore(); return }; form.dataset.dirty = 'true' }))
  numericLoad.addEventListener('click', async () => {
    if (!active() || locked() || numericLoad.disabled) return
    const criterionId = numericCriterion.value
    if (!result || !result.criteria.includes(criterionId)) { numericStatus.textContent = 'Choose a criterion included in the current comparison.'; return }
    begin(); numericBasis = undefined; numericEvidence.replaceChildren(); numericDescription.textContent = ''; numericStatus.textContent = 'Reading the current rule revision and authorized comparison evidence…'
    try {
      const url = choiceEndpoint('decision-controls'); url.searchParams.set('case', context.caseSelector); url.searchParams.set('format', 'json')
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (response.status === 401 || response.status === 403) { dispatchEvent(new Event('sf-access-revoked')); return }
      const read = await response.json()
      if (!active()) return
      if (!response.ok || read.status !== 'ok') throw new Error('rule-basis-unavailable')
      const current = read.value; const selected = current.selected
      if (current.accessRevision !== context.authority.accessRevision || !current.actions.includes('decisions.criteria') || !selected || selected.caseRef.id !== context.caseRef.id || selected.caseRef.incarnation !== context.caseRef.incarnation || selected.caseRef.version !== context.caseRef.version || selected.decision.currency !== context.currency || selected.decision.horizon.start !== context.horizon.start || selected.decision.horizon.end !== context.horizon.end) throw new Error('rule-scope-changed')
      const revisions = selected.rules.filter((entry) => entry.id === criterionId)
      if (revisions.length !== 1 || !Number.isSafeInteger(revisions[0].expectedVersion) || revisions[0].expectedVersion < 0) throw new Error('rule-revision-unavailable')
      const ids = [result.baselineAlternativeId, result.alternativeId]
      if (!Array.isArray(result.request.scenarioRefs) || result.request.scenarioRefs.length !== 2 || !ids.every((id, index) => selected.scenarios.some((entry) => entry.alternativeId === id && entry.ref === result.request.scenarioRefs[index]))) throw new Error('comparison-source-changed')
      const alternatives = ids.map((id) => selected.decision.alternatives.filter((alternative) => alternative.id === id))
      if (alternatives.some((matches) => matches.length !== 1)) throw new Error('comparison-source-changed')
      const comparedRefs = alternatives.flatMap(([alternative]) => [...alternative.result.sourceRefs, ...alternative.result.costCoverage.evaluatedSourceRefs, ...alternative.result.costCoverage.entries.flatMap((entry) => entry.status === 'pending' ? [] : entry.evidenceRefs)])
      const evidence = selected.evidence.filter((entry) => comparedRefs.some((ref) => ref.refDigest === entry.evidence.refDigest))
      if (!evidence.length) throw new Error('current-comparison-evidence-unavailable')
      numericBasis = { criterionId, expectedVersion: revisions[0].expectedVersion, evidence }
      evidence.forEach((entry) => numericEvidence.add(new Option(entry.label, entry.evidence.refDigest)))
      numericDescription.textContent = 'Known subtotal difference in ' + context.currency + ' · ' + context.horizon.start + ' – ' + context.horizon.end + ' · current rule revision ' + numericBasis.expectedVersion + '. Choose the supporting evidence and enter your own numeric condition.'
      numericStatus.textContent = 'Only current authorized evidence from the compared alternatives is available. Pending costs remain unresolved.'
    } catch (error) { if (error?.accessDenied) revoke(); else if (active()) numericStatus.textContent = 'The current rule revision or authorized comparison evidence is unavailable. Reopen the decision before defining this rule.' }
    finally { finish() }
  })
  numericSave.addEventListener('click', async () => {
    if (!active() || busy || completed || reconciliationRequired || foreignIntention() || numericSave.disabled || (pending && pending.kind !== 'criterion')) return
    if (!pending) {
      if (!result || !numericBasis || numericBasis.criterionId !== numericCriterion.value || !result.criteria.includes(numericBasis.criterionId)) return
      const value = numericValue.valueAsNumber; const operator = numericOperator.value
      const evidenceRefs = Array.from(numericEvidence.selectedOptions, (option) => numericBasis.evidence.find((entry) => entry.evidence.refDigest === option.value)?.evidence)
      if (!['lte', 'gte', 'eq'].includes(operator) || !Number.isFinite(value) || !evidenceRefs.length || evidenceRefs.some((ref) => !ref)) { numericStatus.textContent = 'Choose supporting evidence, a numeric condition and an explicit finite limit.'; return }
      try {
        const intent = createChoiceIntention('decision-criteria', { caseRef: context.caseRef, criterionId: numericBasis.criterionId, metricRef: 'planner:known-subtotal-difference', operator, value, unit: context.currency, period: context.horizon, evidenceRefs, expectedRuleVersion: numericBasis.expectedVersion }, crypto.randomUUID(), context)
        sessionStorage.setItem(storageKey, JSON.stringify(intent)); snapshot = capture(); pending = { kind: 'criterion', key: intent.key, body: intent.body, intent, uncertain: false }; holdChoicePeers(form)
      } catch { numericStatus.textContent = 'The rule could not be retained safely. No request was sent.'; return }
    }
    const wasUncertain = pending.uncertain; begin(); pending.uncertain = true; form.dataset.dirty = 'true'; numericStatus.textContent = 'Saving the explicit numeric comparison rule…'
    try {
      const retained = readChoiceIntention(sessionStorage.getItem(storageKey), context)
      if (retained.action !== 'decision-criteria' || retained.body !== pending.body || retained.key !== pending.key) throw new Error('invalid-retained-rule')
      const receipt = await send('decision-criteria', retained.body, retained.key)
      if (!confirmedCriterionReceipt(receipt, JSON.parse(retained.body).expectedRuleVersion)) throw new Error('unconfirmed-rule')
      sessionStorage.removeItem(storageKey); releaseChoicePeers(); pending = undefined; result = undefined; rule = undefined; numericBasis = undefined; sensitivity.hidden = true; delete form.dataset.dirty
      output.textContent = 'Compare the selected alternatives again using the registered rule before recording a choice.'
      numericStatus.textContent = 'Comparison rule saved at revision ' + receipt.version + '. Compare again before choosing. Financial approval remains separate.'
    } catch (error) { if (!rejected(error, wasUncertain, numericStatus, 'comparison rule')) numericStatus.textContent = 'Could not confirm the comparison rule. Its exact values, evidence, revision and key are retained; retry only the same rule.' }
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
    event.preventDefault(); if (!active() || busy || reconciliationRequired || foreignIntention() || choose.disabled || (pending && pending.kind !== 'choice')) return
    if (completed) { location.reload(); return }
    if (!pending) {
      if (!result || !form.reportValidity()) return
      const alternative = context.alternatives.find((item) => item.id === result.alternativeId)
      if (!alternative) return
      const reason = form.querySelector('textarea[name=reason]').value.trim()
      if (!reason) { status.textContent = 'Enter a reason for this choice.'; return }
      try {
        const intent = createChoiceIntention('decision-choose', { caseRef: context.caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version, comparison: result.request, criteria: result.criteria, reason }, key, context)
        sessionStorage.setItem(storageKey, JSON.stringify(intent)); snapshot = capture(); pending = { kind: 'choice', key: intent.key, body: intent.body, intent, uncertain: false }; holdChoicePeers(form)
      } catch { status.textContent = 'The choice could not be retained safely. No request was sent; keep this page open and try again.'; return }

    }
    const wasUncertain = pending.uncertain; begin(); pending.uncertain = true; form.dataset.dirty = 'true'; status.textContent = 'Recording choice…'
    try {
      const retained = readChoiceIntention(sessionStorage.getItem(storageKey), context)
      if (retained.action !== 'decision-choose' || retained.body !== pending.body || retained.key !== pending.key) throw new Error('invalid-retained-intention')
      const expected = JSON.parse(retained.body).caseRef
      const receipt = await send('decision-choose', retained.body, retained.key)
      if (!confirmedChoiceReceipt(receipt, expected)) throw new Error('unconfirmed-choice')
      sessionStorage.removeItem(storageKey); releaseChoicePeers(); pending = undefined; completed = true; delete form.dataset.dirty; status.textContent = 'Choice recorded. Reload the decision to view it.'; location.reload()
    } catch (error) { if (!rejected(error, wasUncertain, status, 'choice')) status.textContent = 'Could not confirm the choice. Your reason and comparison are locked; retry the same request.' }
    finally { finish() }
  })
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      const intent = readChoiceIntention(raw, context)
      if (intent.action === 'decision-choose') {
        const payload = JSON.parse(intent.body)
        form.querySelector('textarea[name=reason]').value = payload.reason
        form.querySelector('select[name=alternative]').value = payload.alternativeId
        form.querySelectorAll('input[name=criteria]').forEach((input) => { input.checked = payload.criteria.includes(input.value) })
        pending = { kind: 'choice', key: intent.key, body: intent.body, intent, uncertain: true }; snapshot = capture(); form.dataset.dirty = 'true'; holdChoicePeers(form)
        status.textContent = 'An earlier choice is unconfirmed. Its original reason, comparison and version are retained. Retry the same choice to retrieve its canonical receipt.'
      } else if (intent.action === 'decision-criteria') {
        const payload = JSON.parse(intent.body)
        numeric.hidden = false; numericCriterion.value = payload.criterionId; numericOperator.value = payload.operator; numericValue.value = String(payload.value)
        numericEvidence.replaceChildren(); payload.evidenceRefs.forEach((ref) => numericEvidence.add(new Option('Retained comparison evidence ' + ref.refId, ref.refDigest, true, true)))
        pending = { kind: 'criterion', key: intent.key, body: intent.body, intent, uncertain: true }; snapshot = capture(); form.dataset.dirty = 'true'; holdChoicePeers(form)
        numericStatus.textContent = 'An earlier comparison rule is unconfirmed. Its original values, evidence, case revision and rule revision are retained. Retry the same comparison rule.'
      }
    }
  } catch { reconciliationRequired = true; status.textContent = 'The retained choice could not be verified. No mutation will be sent. Reopen with the original identity to reconcile it.' }
  sync()
})
document.querySelectorAll('[data-decision-prepare]').forEach((form) => {
  if (form.dataset.sfPrepareReady) return; form.dataset.sfPrepareReady = 'true'
  let context = JSON.parse(form.dataset.context)
  const storageKey = choiceStorageKey(context)
  const select = form.querySelector('[data-choice-prepare-select]'); const button = form.querySelector('button[type=submit]')
  const summary = form.querySelector('[data-choice-prepare-summary]'); const status = form.querySelector('[data-choice-prepare-status]')
  let retained; let busy = false; let denied = false; let blocked = false; let completed = false
  const active = () => !denied && form.isConnected
  const current = () => context.choices.find((choice) => choice.id === select.value)
  const sync = () => {
    if (!active()) return
    const choice = current()
    summary.textContent = choice ? 'Choice ' + choice.id + ' · alternative ' + choice.alternativeId + ' version ' + choice.alternativeVersion + ' · coverage basis version ' + choice.basisVersion + ' · ' + choice.comparisonStatus + ' · ' + choice.scenario.operations.length + ' saved operations.' : 'Recorded choice unavailable.'
    const foreign = !!sessionStorage.getItem('sf:decision-ui:' + context.scope) || !!sessionStorage.getItem(storageKey) && !retained
    select.disabled = busy || blocked || completed || !!retained || foreign
    button.disabled = busy || blocked || foreign || !completed && !retained && (!choice?.scenario.operations.length || context.preparedChoiceIds.includes(choice.id))
    button.textContent = completed ? 'Reload decision' : retained ? 'Retry the same preparation' : 'Prepare changes from this choice'
  }
  const revoke = () => {
    if (denied) return; denied = true
    try { sessionStorage.removeItem(storageKey) } catch { /* Denied state and protected DOM removal do not depend on storage availability. */ }
    retained = undefined; context = undefined; delete form.dataset.context; delete form.dataset.dirty
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Decision access changed. Reopen it with your current access.'
    form.replaceChildren(message)
  }
  addEventListener('sf-access-revoked', revoke)
  select.addEventListener('change', () => {
    if (!active() || busy || retained || blocked) return
    status.textContent = context.preparedChoiceIds.includes(select.value) ? 'This choice already has prepared changes. Review or recover them below.' : current()?.scenario.operations.length ? 'Review the selected choice, then prepare its exact saved operations for preview.' : 'This recorded choice contains no executable operations. No changes were prepared.'
    sync()
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!active() || busy || blocked || button.disabled) return
    if (completed) { location.reload(); return }
    const wasUncertain = !!retained
    if (!retained) {
      try {
        if (sessionStorage.getItem(storageKey) || sessionStorage.getItem('sf:decision-ui:' + context.scope)) throw new Error('earlier-intention')
        const choice = current()
        if (choice && context.preparedChoiceIds.includes(choice.id)) { status.textContent = 'This choice already has prepared changes. Review or recover them below.'; return }
        if (!choice?.scenario.operations.length) { status.textContent = 'This recorded choice contains no executable operations. No changes were prepared.'; return }
        retained = createChoiceIntention('decision-prepare-changes', { caseRef: context.caseRef, choiceId: choice.id, operations: choice.scenario.operations }, crypto.randomUUID(), context)
        sessionStorage.setItem(storageKey, JSON.stringify(retained)); holdChoicePeers(form)
      } catch { retained = undefined; status.textContent = 'The preparation could not be retained safely. No request was sent.'; return }
    }
    busy = true; form.dataset.dirty = 'true'; sync(); status.textContent = 'Preparing the exact saved operations for review…'
    try {
      const intent = readChoiceIntention(sessionStorage.getItem(storageKey), context)
      if (intent.action !== 'decision-prepare-changes' || intent.body !== retained.body || intent.key !== retained.key) throw new Error('changed-intention')
      const response = await fetch(choiceEndpoint(intent.action), { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.key }, body: intent.body })
      if (response.status === 401 || response.status === 403) { dispatchEvent(new Event('sf-access-revoked')); return }
      const result = await response.json()
      if (!active()) return
      if (!response.ok && !wasUncertain && response.status === 400 && result.reason === 'invalid-decision-input') {
        sessionStorage.removeItem(storageKey); releaseChoicePeers(); retained = undefined; delete form.dataset.dirty
        status.textContent = 'Preparation was rejected. Your recorded choice is unchanged; reopen the decision and review its current sources.'; return
      }
      const expected = JSON.parse(intent.body).caseRef; const receipt = result.value
      if (!response.ok || result.status !== 'ok' || !confirmedChoiceReceipt(receipt, expected)) throw new Error('unconfirmed-preparation')
      sessionStorage.removeItem(storageKey); releaseChoicePeers(); retained = undefined; completed = true; delete form.dataset.dirty
      status.textContent = 'Changes prepared for preview. No financial approval or Apply was performed.'; location.reload()
    } catch { if (active()) status.textContent = 'Preparation is unconfirmed. The original choice, operations, case version and key are retained; retry only the same preparation.' }
    finally { busy = false; if (active()) sync() }
  })
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      const intent = readChoiceIntention(raw, context)
      if (intent.action === 'decision-prepare-changes') { retained = intent; select.value = JSON.parse(intent.body).choiceId; form.dataset.dirty = 'true'; holdChoicePeers(form); status.textContent = 'An earlier preparation is unconfirmed. Retry the same preparation to retrieve its canonical receipt.' }
    }
    sync()
  } catch { blocked = true; button.disabled = true; select.disabled = true; status.textContent = 'The retained preparation could not be verified. No mutation will be sent.' }
})
})()
`
