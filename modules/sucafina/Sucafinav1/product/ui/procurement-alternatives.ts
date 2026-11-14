import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { esc } from "../../src/screen-shell.ts"

/** The retained envelope is the original C08 intention, never a second apply operation. */
export function createProcurementPromotionIntention(payload: object, key: string) {
  if (!key.trim() || key.length > 128) throw new Error("invalid-procurement-promotion-key")
  const body = JSON.stringify(payload)
  if (!body || new TextEncoder().encode(body).byteLength > 262144) throw new Error("invalid-procurement-promotion-input")
  return Object.freeze({ action: "decision-promote", key, body })
}

export function isProcurementPromotionReceipt(value: unknown, expected: { id: string; incarnation: string; version: number }) {
  if (!value || typeof value !== "object" || !("caseRef" in value) || !("resultRef" in value) || typeof value.resultRef !== "string" || !value.resultRef.trim()) return false
  const ref = value.caseRef
  return !!ref && typeof ref === "object" && "id" in ref && "incarnation" in ref && "version" in ref && ref.id === expected.id && ref.incarnation === expected.incarnation && ref.version === expected.version + 1
}

/** Every target comes from an attached, current Procurement source, with a typed amount operation. */
export function procurementAlternativesForm(projection: AuthorizedCaseProjection) {
  const item = projection.case
  const context = { scope: JSON.stringify([projection.context.installationId, projection.context.projectId, projection.context.principalRef, item.id, item.incarnation]), authority: projection.context,
    caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, caseSelector: encodeCaseRef(item), currency: item.currency, period: item.horizon }
  return `<section aria-label="Procurement alternatives"><h3>Review a Procurement scenario</h3><p>Review the requisition's current estimate or propose a replacement amount before choosing an alternative. The preview reads current sources. Saving an alternative records this proposal in the decision.</p><p>Financial approval remains in Procurement. The selected replacement cannot be prepared for application under the current approval workflow. Choosing an alternative does not approve its amount.</p><form data-procurement-alternatives data-context="${esc(JSON.stringify(context))}"><button type="button" data-procurement-discover>Load attached requisitions</button><label>Authorized requisition<select name="source" required disabled><option value="">Load requisitions first</option></select></label><label>Operation<select name="operation" required><option value="">Choose an operation</option><option value="baseline">Review current estimate</option><option value="replace">Replace requisition estimate</option></select></label><label>Target field<select name="target" required><option value="PR.estAmount">Requisition estimated amount</option></select></label><label>Proposed amount<input name="amount" type="number" step="any" min="0" disabled></label><label>Currency<input name="currency" value="${esc(item.currency)}" readonly></label><label>Period start<input name="start" type="date" value="${esc(item.horizon.start)}" readonly></label><label>Period end<input name="end" type="date" value="${esc(item.horizon.end)}" readonly></label><label>Cost coverage scope<select name="inventory" required><option value="">Choose the scope for this proposal</option><option value="renewal-transition-v1">Renewal or transition · nine cost categories</option></select></label><p>This scope is an explicit assumption. The requisition amount does not establish which categories it covers; all categories remain pending until supported by evidence.</p><button type="button" data-procurement-preview disabled>Preview scenario</button><div data-procurement-result aria-live="polite"></div><label>Alternative title<input name="title" required maxlength="500"></label><button type="submit" disabled>Save alternative</button><button type="button" data-procurement-retry hidden>Retry the same save</button><a data-procurement-review hidden>Review current decision</a><p role="status" aria-live="polite"></p></form></section>`
}

export const procurementAlternativesScript = `
document.querySelectorAll('[data-procurement-alternatives]').forEach((form) => {
  if (form.dataset.sfProcurementReady) return; form.dataset.sfProcurementReady = 'true'
  const context = JSON.parse(form.dataset.context); delete form.dataset.context
  const freeze = ${createProcurementPromotionIntention.toString()}
  const confirmedReceipt = ${isProcurementPromotionReceipt.toString()}
  const source = form.elements.namedItem('source'), operation = form.elements.namedItem('operation'), target = form.elements.namedItem('target')
  const amount = form.elements.namedItem('amount'), inventory = form.elements.namedItem('inventory'), title = form.elements.namedItem('title')
  const discover = form.querySelector('[data-procurement-discover]'), preview = form.querySelector('[data-procurement-preview]'), save = form.querySelector('button[type=submit]')
  const retry = form.querySelector('[data-procurement-retry]'), review = form.querySelector('[data-procurement-review]'), output = form.querySelector('[data-procurement-result]'), status = form.querySelector('p[role=status]')
  const controls = [...form.querySelectorAll('input,select,button')], storageKey = 'sf:procurement-alternative:' + context.scope
  let sources = [], proposal, pending, busy = false, denied = false, complete = false
  const foreignPending = () => { try { return !!sessionStorage.getItem('sf:decision-ui:' + context.scope) || !!sessionStorage.getItem('sf:decision-ui:' + context.scope + ':choice') } catch { return true } }
  const holdPeers = () => document.querySelectorAll('[data-decision-edit], [data-decision-alternatives], [data-decision-choice], [data-decision-prepare], [data-decision-apply]').forEach((peer) => { peer.inert = true; peer.dataset.procurementHeld = 'true' })
  const same = (a, b) => {
    const ordered = (value) => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])])) : value
    return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b))
  }
  const sameAuthority = (value) => !!value && ['installationId','projectId','principalRef','accessRevision','policyVersion'].every((key) => value[key] === context.authority[key])
  const live = () => !denied && form.isConnected
  const endpoint = (action, parameters = {}) => {
    const url = new URL(location.href)
    if (!/\\/(dashboard|planner|procurement)$/.test(url.pathname)) throw new Error('unsupported-surface')
    url.pathname = url.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/dashboard'); url.search = new URLSearchParams({ sf: action, ...parameters }).toString(); url.hash = ''; return url
  }
  review.href = endpoint('workbench-case', { caseRef: context.caseSelector }).href
  const sync = () => {
    const locked = busy || !!pending || complete || foreignPending()
    controls.forEach((control) => { control.disabled = locked })
    source.disabled = locked || !sources.length; amount.disabled = locked || operation.value !== 'replace'
    amount.required = operation.value === 'replace'; target.disabled = locked || operation.value !== 'replace'
    preview.disabled = locked || !source.value || !operation.value || !inventory.value
    save.disabled = locked || !proposal; retry.hidden = !pending; retry.disabled = busy || denied || foreignPending(); review.hidden = !pending && !complete
  }
  const revoke = () => {
    if (denied) return; denied = true; sources = []; proposal = undefined; pending = undefined
    try { sessionStorage.removeItem(storageKey) } catch {}
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Access changed. Reopen the decision with your current access.'
    form.replaceChildren(message)
  }
  addEventListener('sf-access-revoked', revoke)
  const fetchResult = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000), ...options })
    if (!live()) throw new Error('closed')
    if (response.status === 401 || response.status === 403) { dispatchEvent(new Event('sf-access-revoked')); throw new Error('denied') }
    const result = await response.json()
    if (!live()) throw new Error('closed')
    if (result.status === 'denied') { dispatchEvent(new Event('sf-access-revoked')); throw new Error('denied') }
    if (!response.ok || result.status !== 'ok') throw new Error(result.reason || 'unavailable')
    return result.value
  }
  const invalidate = () => { if (!live() || busy || pending || complete) return; proposal = undefined; output.replaceChildren(); sync() }
  ;[source, operation, amount, target, inventory].forEach((control) => { control.addEventListener('input', invalidate); control.addEventListener('change', invalidate) })
  discover.addEventListener('click', async () => {
    if (!live() || busy || pending || complete || foreignPending()) return
    busy = true; proposal = undefined; sync(); status.textContent = 'Reading current requisitions…'
    try {
      const value = await fetchResult(endpoint('procurement-scenario-controls', { case: context.caseSelector, version: String(context.caseRef.version) }))
      if (!same(value.caseRef, context.caseRef) || !sameAuthority(value.authority) || !Array.isArray(value.sources)) throw new Error('scope-changed')
      sources = value.sources; source.replaceChildren(new Option('Choose a requisition', ''))
      sources.forEach((item) => source.append(new Option(item.label + ' · ' + item.currency + ' · ' + item.period.start + ' – ' + item.period.end, item.sourceDigest)))
      status.textContent = sources.length ? 'Choose a requisition, operation and cost scope.' : 'No current authorized requisition is attached for this currency and period. Attach one through the existing case controls.'
    } catch { if (live()) status.textContent = 'Requisitions or case access changed. Reopen the current decision.' }
    finally { busy = false; if (live()) sync() }
  })
  preview.addEventListener('click', async () => {
    if (!live() || busy || pending || complete || foreignPending() || preview.disabled) return
    const selected = sources.find((item) => item.sourceDigest === source.value)
    if (!selected || !same(selected.period, context.period) || selected.currency !== context.currency || inventory.value !== 'renewal-transition-v1' || !['baseline','replace'].includes(operation.value)) { status.textContent = 'Choose a current requisition, operation and cost scope.'; return }
    if (operation.value === 'replace' && (!Number.isFinite(amount.valueAsNumber) || amount.valueAsNumber < 0)) { status.textContent = 'Enter a non-negative amount in the shown currency.'; return }
    const selection = { caseRef: context.caseRef, sourceDigest: selected.sourceDigest, costInventory: inventory.value, operation: operation.value === 'baseline' ? { kind: 'baseline' } : { kind: 'replace', target: 'PR.estAmount', amount: amount.valueAsNumber, currency: context.currency, period: context.period } }
    busy = true; proposal = undefined; sync(); status.textContent = 'Calculating the read-only scenario…'
    try {
      const value = await fetchResult(endpoint('procurement-scenario-preview'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(selection) })
      if (!same(value.caseRef, context.caseRef) || !sameAuthority(value.authority) || !same(value.source, selected.source) || value.scenario?.total !== null || value.scenario?.comparisonStatus !== 'conditioned' || value.scenario.currency !== context.currency || !same(value.scenario.horizon, context.period) || value.financialApproval !== 'blocked') throw new Error('preview-changed')
      proposal = value; output.replaceChildren()
      const line = (message) => { const node = document.createElement('p'); node.textContent = message; output.append(node) }
      line(selected.label + ' · ' + (selection.operation.kind === 'baseline' ? 'Current estimate' : 'Proposed estimate: ' + selection.operation.amount + ' ' + context.currency))
      line('Known estimate: ' + (value.scenario.knownSubtotal === null ? 'unavailable' : value.scenario.knownSubtotal + ' ' + context.currency) + '. Total cost: unavailable.')
      line('Period: ' + context.period.start + ' – ' + context.period.end + '. Cost coverage remains pending; this scenario is conditioned.')
      value.assessment.entries.forEach((entry) => line(entry.categoryId.replaceAll('_', ' ') + ' · ' + entry.status))
      line(value.financialApprovalReason); status.textContent = 'Preview completed without changing the requisition. Review the estimate and save this exact proposal as an alternative.'
    } catch { if (live()) { proposal = undefined; output.replaceChildren(); status.textContent = 'Preview unavailable or source changed. Reload the requisitions and review the current amount.' } }
    finally { busy = false; if (live()) sync() }
  })
  const dispatch = async () => {
    if (!live() || !pending || busy || complete || foreignPending()) return
    busy = true; sync(); status.textContent = 'Saving the alternative…'
    try {
      const retained = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (!retained || !same(retained, pending)) throw new Error('retained-request-changed')
      const receipt = await fetchResult(endpoint(pending.intent.action), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.intent.key }, body: pending.intent.body })
      if (!confirmedReceipt(receipt, JSON.parse(pending.intent.body).caseRef)) throw new Error('unconfirmed-receipt')
      sessionStorage.removeItem(storageKey); pending = undefined; complete = true; proposal = undefined
      status.textContent = 'Alternative saved. Reopen the decision to compare it and record a choice. Financial preparation remains blocked by the current approval workflow.'
    } catch { if (live()) status.textContent = 'The save could not be confirmed. Its exact request and key are retained. Retry the same save to recover its result, or review the current decision.' }
    finally { busy = false; if (live()) sync() }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!live() || busy || pending || complete || foreignPending() || !proposal || !title.value.trim()) return
    try {
      if (sessionStorage.getItem(storageKey)) throw new Error('unconfirmed-request')
      const payload = { caseRef: context.caseRef, title: title.value.trim(), scenario: proposal.request, coverageRef: proposal.coverageRef }
      pending = { scope: context.scope, authority: { installationId: context.authority.installationId, projectId: context.authority.projectId, principalRef: context.authority.principalRef, accessRevision: context.authority.accessRevision, policyVersion: context.authority.policyVersion }, intent: freeze(payload, crypto.randomUUID()) }
      sessionStorage.setItem(storageKey, JSON.stringify(pending))
      holdPeers()
    } catch { pending = undefined; status.textContent = 'The exact save could not be retained. No request was sent.'; sync(); return }
    await dispatch()
  })
  retry.addEventListener('click', dispatch)
  try {
    const retained = sessionStorage.getItem(storageKey)
    if (retained) {
      const value = JSON.parse(retained), intent = value.intent, payload = JSON.parse(intent?.body || 'null')
      if (value.scope !== context.scope || !sameAuthority(value.authority) || intent?.action !== 'decision-promote' || typeof intent.key !== 'string' || !intent.key.trim() || intent.key.length > 128 || typeof intent.body !== 'string' || new TextEncoder().encode(intent.body).byteLength > 262144 || !payload?.caseRef || payload.caseRef.id !== context.caseRef.id || payload.caseRef.incarnation !== context.caseRef.incarnation || !Number.isSafeInteger(payload.caseRef.version) || payload.caseRef.version > context.caseRef.version || payload.caseRef.version < 1) throw new Error('retained-request-invalid')
      pending = value; title.value = payload.title; holdPeers(); status.textContent = 'A previous save is unconfirmed. Retry its original request to recover the result before creating another alternative.'
    }
  } catch { denied = true; controls.forEach((control) => { control.disabled = true }); status.textContent = 'The retained save or access changed. Reopen the decision with the original access to reconcile it.' }
  if (!denied) sync()
})
`
