import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

export async function scenarioAnalysisForm(projection: AuthorizedCaseProjection, runtime: SfHostServices) {
  if (!runtime.analyses) return "<p>Specialist scenario analysis is currently unavailable.</p>"
  const parent = runtime.selected.find((item) => item.skills.some((skill) => skill.id === "sf-comparar-cenarios"))
  const skill = parent?.skills.find((item) => item.id === "sf-comparar-cenarios")
  const models = await runtime.models().catch(() => [])
  if (!parent || !skill || !models.length || projection.case.alternatives.length < 2) return "<p>Specialist scenario analysis needs two saved alternatives and an available model.</p>"
  const item = projection.case
  const config = { request: { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, objective: item.objective, profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)) }, alternatives: item.alternatives.map((alternative) => ({ id: alternative.id, version: alternative.version })), model: models[0] }
  const options = item.alternatives.map((alternative, index) => `<option value="${index}">${esc(alternative.title)}</option>`).join("")
  return `<section><h3>Analyze alternatives</h3><form data-scenario-analysis data-config="${esc(JSON.stringify(config))}"><label>First alternative<select name="first">${options}</select></label><label>Second alternative<select name="second">${options}</select></label><button type="submit">Start specialist analysis</button><p role="status" aria-live="polite"></p></form></section>`
}

export async function intentAnalysisForm(projection: AuthorizedCaseProjection, runtime: SfHostServices) {
  if (!runtime.analyses) return "<p>Decision framing is currently unavailable.</p>"
  const parent = runtime.selected.find((item) => item.skills.some((skill) => skill.id === "sf-enquadrar-decisao"))
  const skill = parent?.skills.find((item) => item.id === "sf-enquadrar-decisao")
  const models = await runtime.models().catch(() => [])
  if (!parent || !skill || !models.length) return "<p>Decision framing needs an available analysis service.</p>"
  const item = projection.case
  const config = { request: { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, objective: item.objective, profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)) }, model: models[0] }
  return `<section><h3>Frame this decision</h3><p>Use the current objective and attached sources to clarify the decision. Review the resulting contribution before accepting it.</p><form data-intent-analysis data-config="${esc(JSON.stringify(config))}"><button type="submit">Prepare decision framing</button><p role="status" aria-live="polite"></p></form></section>`
}

/** The selections and source references are restricted to the authorized case. */
export async function forecastAnalysisForm(projection: AuthorizedCaseProjection, runtime: SfHostServices) {
  if (!runtime.analyses) return "<p>Forecast analysis is currently unavailable.</p>"
  const history = `<section data-analysis-history data-case="${esc(JSON.stringify({ id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }))}"><h3>Analysis history</h3><p role="status">Loading analysis history…</p><div data-results></div></section>`
  if (!runtime.forecastInputs) return `${history}<p>Forecast analysis is currently unavailable.</p>`
  const parent = runtime.selected.find((item) => item.skills.some((skill) => skill.id === "sf-explicar-forecast"))
  const skill = parent?.skills.find((item) => item.id === "sf-explicar-forecast")
  const models = await runtime.models().catch(() => [])
  const sources = projection.case.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
  if (!parent || !skill || !models.length || sources.length < 2) return `${history}<p>Forecast analysis needs an available model and two forecast sources attached to this decision.</p>`
  const config = { caseRef: { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }, objective: projection.case.objective,
    profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)), models }
  const options = sources.map((source, index) => `<option value="${esc(source.refId)}">Forecast source ${index + 1}${source.target.period ? ` · ${esc(source.target.period.start)} – ${esc(source.target.period.end)}` : ""}</option>`).join("")
  return `${history}<section><h3>Explain a forecast</h3><form data-forecast-analysis data-config="${esc(JSON.stringify(config))}"><label>Baseline<select name="baseRef">${options}</select></label><label>Comparison<select name="candidateRef">${options}</select></label><label>Start<input name="start" type="date" required value="${esc(projection.case.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(projection.case.horizon.end)}"></label><label>Currency<input name="currency" value="${esc(projection.case.currency)}" required></label><details><summary>Analysis settings</summary><label>Model<select name="model">${models.map((model, index) => `<option value="${index}">${esc(model.providerID)} · ${esc(model.id)}</option>`).join("")}</select></label></details><button>Start analysis</button><button type="button" data-analysis-cancel hidden>Cancel analysis</button><p role="status" aria-live="polite"></p></form></section>`
}

export const forecastAnalysisScript = `
document.querySelectorAll('[data-scenario-analysis], [data-intent-analysis]').forEach((form) => {
  if (form.dataset.sfScenarioAnalysisReady) return; form.dataset.sfScenarioAnalysisReady = 'true'
  let config = JSON.parse(form.dataset.config); const status = form.querySelector('[role=status]'); const button = form.querySelector('button[type=submit]')
  const scenario = form.hasAttribute('data-scenario-analysis'); const startLabel = scenario ? 'Start specialist analysis' : 'Prepare decision framing'
  let prepareKey = crypto.randomUUID(); let startKey = crypto.randomUUID(); let pending; let busy = false; let uncertain = false; let reconciliationRequired = false; let started = false; let accessRevoked = false
  const freeze = (locked) => form.querySelectorAll('select,input,textarea').forEach((control) => { control.disabled = locked })
  const revoke = () => { if (accessRevoked) return; accessRevoked = true; pending = undefined; config = undefined; delete form.dataset.config; delete form.dataset.dirty; form.querySelectorAll('select,input,textarea').forEach((control) => { if (control.tagName === 'SELECT') control.replaceChildren(); else control.value = ''; control.disabled = true }); button.disabled = true; status.textContent = 'Analysis access changed. Reopen this decision with your current access.' }
  addEventListener('sf-access-revoked', () => { if (form.isConnected) revoke() })
  form.addEventListener('change', () => { if (busy || uncertain || started || accessRevoked) return; pending = undefined; prepareKey = crypto.randomUUID(); startKey = crypto.randomUUID(); form.dataset.dirty = 'true' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (button.disabled || busy || started || accessRevoked || reconciliationRequired) return
    const reconciling = uncertain
    const fields = new FormData(form); const first = scenario && config.alternatives[Number(fields.get('first'))]; const second = scenario && config.alternatives[Number(fields.get('second'))]
    if (scenario && !pending && (!first || !second || first.id === second.id)) { status.textContent = 'Choose two different alternatives.'; return }
    const send = async (payload, key) => { const url = new URL(location.href); url.search = '?sf=workbench-analysis'; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) }); if (accessRevoked || response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true }); const result = await response.json(); if (accessRevoked) throw Object.assign(new Error('access-changed'), { accessDenied: true }); if (!response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'stale', 'conflict'].includes(result.status) }); return result.value }
    busy = true; button.disabled = true; freeze(true); status.textContent = pending ? 'Confirming the same analysis request…' : 'Preparing analysis…'
    try {
      if (!pending) { const skillInput = await send({ action: 'prepare', input: { request: config.request, selection: scenario ? { caseRef: config.request.caseRef, alternatives: [first, second] } : {} } }, prepareKey); pending = { action: 'start', input: { request: config.request, skillInput, model: config.model } } }
      uncertain = true
      const run = await send(pending, startKey)
      if (!run.runRef) throw new Error('unavailable')
      started = true; uncertain = false
      delete form.dataset.dirty; status.textContent = 'Analysis started. Follow progress in analysis history.'; document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh'))
    } catch (error) { if (error?.accessDenied) revoke(); if (accessRevoked) return; if (error?.rejected) { if (reconciling) reconciliationRequired = true; else { uncertain = false; pending = undefined; prepareKey = crypto.randomUUID(); startKey = crypto.randomUUID() } } status.textContent = reconciliationRequired ? 'The retry was rejected but the earlier start is still unconfirmed. Reconcile analysis history before starting another run.' : error?.rejected ? scenario ? 'The analysis request was rejected. Review the alternatives and current decision before retrying.' : 'The analysis request was rejected. Review the objective and current decision before retrying.' : uncertain ? 'Could not confirm whether analysis started. Retry the same request to recover its result.' : scenario ? 'Analysis could not be prepared. Check the alternatives and access, then retry.' : 'Analysis could not be prepared. Check the decision sources and access, then retry.' }
    finally { busy = false; freeze(uncertain || started || accessRevoked); button.disabled = started || accessRevoked || reconciliationRequired; button.textContent = uncertain ? 'Retry the same analysis request' : startLabel }
  })
})
document.querySelectorAll('[data-analysis-history]').forEach((section) => {
  if (section.dataset.sfAnalysisHistoryReady) return; section.dataset.sfAnalysisHistoryReady = 'true'
  const status = section.querySelector('[role=status]')
  const output = section.querySelector('[data-results]')
  let timer; let signature; let loading = false; let again = false; let unavailable = false; let accessRevoked = false
  const revoke = () => { accessRevoked = true; clearTimeout(timer); output.replaceChildren(); delete section.dataset.case; status.textContent = 'Analysis access changed. Reopen the decision with your current access.' }
  addEventListener('sf-access-revoked', () => { if (section.isConnected) revoke() })
  const send = async (payload) => {
    const url = new URL(location.href); url.search = '?sf=workbench-analysis'
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) })
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true })
    const result = await response.json(); if (!response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'stale', 'conflict'].includes(result.status) }); return result.value
  }
  const load = async () => {
    if (!section.isConnected || accessRevoked) return
    if (loading) { again = true; return }
    loading = true; again = false; clearTimeout(timer)
    try {
      const runs = await send({ action: 'list', caseRef: JSON.parse(section.dataset.case) })
      if (accessRevoked || !section.isConnected) return
      if (!Array.isArray(runs)) throw new Error('unavailable')
      const nextSignature = JSON.stringify(runs.map((run) => [run.runRef, run.state, run.version, run.outputRef]))
      if (signature === nextSignature) { status.textContent = unavailable ? 'An analysis is no longer available. Its previous details have been removed.' : runs.length ? '' : 'No analyses yet.'; if (runs.length) timer = setTimeout(load, 3000); return }
      output.querySelectorAll('[data-run-ref]').forEach((entry) => {
        const current = runs.find((run) => run.runRef === entry.dataset.runRef)
        if (!current) { unavailable = true; entry.remove(); return }
        if (entry.querySelector('form[data-dirty]') && (current.state !== 'ready' || (current.outputRef && current.outputRef !== entry.dataset.outputRef))) {
          entry.dataset.analysisStale = 'true'; entry.querySelector('[data-analysis-body]')?.remove(); entry.querySelectorAll('button').forEach((button) => { button.disabled = true }); entry.querySelector('[data-analysis-state]').textContent = 'Analysis: ' + current.state + '. This result changed. Your reason is preserved; review the current result before accepting.'
        }
      })
      if (section.querySelector('form[data-dirty]')) { status.textContent = unavailable ? 'An analysis is no longer available. Its previous details have been removed; your other drafts remain.' : 'Analysis history changed. Your reason is preserved.'; timer = setTimeout(load, 3000); return }
      signature = nextSignature; output.replaceChildren(); status.textContent = unavailable ? 'An analysis is no longer available. Its previous details have been removed.' : runs.length ? '' : 'No analyses yet.'
      for (const run of runs) {
        const entry = document.createElement('article'); entry.dataset.runRef = run.runRef; entry.dataset.outputRef = run.outputRef || ''; const state = document.createElement('p'); state.dataset.analysisState = 'true'; state.textContent = 'Analysis: ' + run.state; entry.append(state); output.append(entry)
        if (['preparing', 'queued', 'running'].includes(run.state)) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Cancel analysis'
          button.addEventListener('click', async () => { button.disabled = true; try { await send({ action: 'cancel', runRef: run.runRef }); await load() } catch (error) { if (error?.accessDenied) { revoke(); return } state.textContent = 'Could not confirm cancellation.'; button.disabled = false } })
          entry.append(button)
        }
        if (run.state !== 'ready') continue
        const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open result'; entry.append(open)
        open.addEventListener('click', async () => {
        open.disabled = true
        try {
          const result = await send({ action: 'output', runRef: run.runRef }); if (accessRevoked || !entry.isConnected || entry.dataset.analysisStale) return; const body = document.createElement('div'); body.dataset.analysisBody = 'true'; body.innerHTML = result.html; entry.append(body)
          if (!result.outputRef) { open.remove(); return }
          const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reason for accepting this contribution'
          const rationale = document.createElement('textarea'); rationale.required = true; label.append(rationale)
          const button = document.createElement('button'); button.textContent = 'Accept contribution'
          const message = document.createElement('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite')
          let key = crypto.randomUUID(); let pending; rationale.addEventListener('input', () => { if (pending) { rationale.value = pending.rationale; return } key = crypto.randomUUID(); form.dataset.dirty = 'true' })
          form.addEventListener('submit', async (event) => {
            event.preventDefault(); if (!form.reportValidity() || button.disabled || entry.dataset.analysisStale || !entry.isConnected) return
            button.disabled = true; rationale.disabled = true; message.textContent = 'Recording your decision…'
            try {
              const url = new URL(location.href); url.search = '?sf=decision-accept-analysis'
              if (!pending) pending = { caseRef: JSON.parse(section.dataset.case), outputRef: result.outputRef, runRef: run.runRef, rationale: rationale.value.trim() }
              const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(pending) })
              if (response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true })
              const accepted = await response.json(); if (!response.ok || accepted.status !== 'ok') throw new Error('unavailable')
              delete form.dataset.dirty; location.reload()
            } catch (error) { if (error?.accessDenied) { revoke(); return } message.textContent = 'Could not confirm acceptance. Your reason is preserved; retry the same request.' }
            finally { button.disabled = accessRevoked || !!entry.dataset.analysisStale; rationale.disabled = !!pending }
          })
          form.append(label, button, message); entry.append(form); open.remove()
        }
        catch (error) { if (error?.accessDenied) { revoke(); return } state.textContent += ' · Result unavailable. Try again.'; open.disabled = false }
        })
      }
      if (runs.length) timer = setTimeout(load, 3000)
    } catch (error) { if (error?.accessDenied) revoke(); else if (!accessRevoked && section.isConnected) { status.textContent = 'Analysis history unavailable. Your open result and reason are preserved.'; timer = setTimeout(load, 3000) } }
    finally { loading = false; if (again && !accessRevoked && section.isConnected) { again = false; clearTimeout(timer); queueMicrotask(load) } }
  }
  section.addEventListener('sf-analysis-refresh', load); load()
})
document.querySelectorAll('[data-forecast-analysis]').forEach((form) => {
  if (form.dataset.sfForecastReady) return; form.dataset.sfForecastReady = 'true'
  let config = JSON.parse(form.dataset.config)
  const status = form.querySelector('[role=status]')
  const cancel = form.querySelector('[data-analysis-cancel]')
  const button = form.querySelector('button:not([type]), button[type=submit]')
  const retryStatus = document.createElement('button'); retryStatus.type = 'button'; retryStatus.textContent = 'Refresh analysis status'; retryStatus.hidden = true; cancel.after(retryStatus)
  let runRef
  let timer
  let pending; let startKey = crypto.randomUUID(); let busy = false; let uncertain = false; let reconciliationRequired = false; let accessRevoked = false; let refreshEpoch = 0
  const freeze = (locked) => form.querySelectorAll('input,select,textarea').forEach((control) => { control.disabled = locked })
  const revoke = () => { if (accessRevoked) return; accessRevoked = true; refreshEpoch++; clearTimeout(timer); pending = undefined; runRef = undefined; config = undefined; delete form.dataset.config; form.querySelectorAll('input,select,textarea').forEach((control) => { if (control.tagName === 'SELECT') control.replaceChildren(); else control.value = ''; control.disabled = true }); button.disabled = true; cancel.hidden = true; retryStatus.hidden = true; delete form.dataset.dirty; status.textContent = 'Analysis access changed. Reopen the decision with your current access.' }
  addEventListener('sf-access-revoked', () => { if (form.isConnected) revoke() })
  const changed = () => { if (busy || uncertain || runRef || accessRevoked) return; pending = undefined; startKey = crypto.randomUUID(); form.dataset.dirty = 'true' }
  form.addEventListener('input', changed); form.addEventListener('change', changed)
  const send = async (mode, payload, key = crypto.randomUUID()) => {
    const url = new URL(location.href); url.search = '?sf=' + mode
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) })
    if (accessRevoked || response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true })
    const result = await response.json()
    if (accessRevoked) throw Object.assign(new Error('access-changed'), { accessDenied: true })
    if (!response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'stale', 'conflict'].includes(result.status) })
    return result.value
  }
  const refresh = async () => {
    if (!form.isConnected || !runRef || accessRevoked) return
    const epoch = ++refreshEpoch
    clearTimeout(timer); retryStatus.disabled = true; retryStatus.hidden = false
    try {
      const run = await send('workbench-analysis', { action: 'read', runRef })
      if (accessRevoked || epoch !== refreshEpoch) return
      status.textContent = 'Analysis: ' + run.state + (run.outputRef ? '. The result is being prepared for display.' : '.')
      const active = ['preparing', 'queued', 'running'].includes(run.state)
      cancel.hidden = !active
      button.disabled = active; freeze(active)
      if (!active) { runRef = undefined; pending = undefined; startKey = crypto.randomUUID(); retryStatus.hidden = true; document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh')) }
      if (active) timer = setTimeout(refresh, 2000)
    } catch (error) { if (error?.accessDenied) { revoke(); return } if (accessRevoked || epoch !== refreshEpoch) return; status.textContent = 'Analysis status unavailable. Refresh its status before starting another analysis.'; button.disabled = true; freeze(true) }
    finally { if (epoch === refreshEpoch) retryStatus.disabled = false }
  }
  retryStatus.addEventListener('click', refresh)
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || runRef || accessRevoked || button.disabled || reconciliationRequired || (!pending && !form.reportValidity())) return
    const reconciling = uncertain
    const fields = new FormData(form); const model = config.models[Number(fields.get('model'))]
    if (!pending && (!model || fields.get('baseRef') === fields.get('candidateRef'))) { status.textContent = 'Choose a model and two different forecast sources.'; return }
    busy = true; button.disabled = true; freeze(true); status.textContent = pending ? 'Confirming the same analysis request…' : 'Preparing analysis…'
    try {
      if (!pending) { const skillInput = await send('workbench-forecast', { caseRef: config.caseRef, baseRef: fields.get('baseRef'), candidateRef: fields.get('candidateRef'), period: { start: fields.get('start'), end: fields.get('end') }, currency: fields.get('currency') }); pending = { action: 'start', input: { request: { caseRef: config.caseRef, objective: config.objective, profileId: config.profileId, profileVersion: config.profileVersion, skillId: config.skillId, skillVersion: config.skillVersion, manifestDigest: config.manifestDigest, outputSchemaVersion: config.outputSchemaVersion, requestedOperationScope: config.requestedOperationScope }, skillInput, model } } }
      uncertain = true
      const started = await send('workbench-analysis', pending, startKey)
      if (!started.runRef) throw new Error('unavailable')
      uncertain = false; runRef = started.runRef; delete form.dataset.dirty; await refresh()
    } catch (error) { if (error?.rejected) { if (reconciling) reconciliationRequired = true; else { uncertain = false; pending = undefined; startKey = crypto.randomUUID() } } if (error?.accessDenied) revoke(); else status.textContent = reconciliationRequired ? 'The retry was rejected but the earlier start is still unconfirmed. Reconcile analysis history before starting another run.' : error?.rejected ? 'The analysis request was rejected. Review the sources and current decision before retrying.' : uncertain ? 'Could not confirm whether analysis started. Retry the same request to recover its result.' : 'Analysis could not be prepared. Check the sources and period, then try again.' }
    finally { busy = false; if (!runRef && !accessRevoked) { freeze(uncertain); button.disabled = reconciliationRequired } button.textContent = uncertain ? 'Retry the same analysis request' : 'Start analysis' }
  })
  cancel.addEventListener('click', async () => {
    if (!runRef || accessRevoked) return
    refreshEpoch++; cancel.disabled = true; clearTimeout(timer); status.textContent = 'Cancelling analysis…'
    try { await send('workbench-analysis', { action: 'cancel', runRef }); await refresh() }
    catch (error) { if (error?.accessDenied) revoke(); else status.textContent = 'Could not confirm cancellation. Refresh the analysis status.' }
    finally { cancel.disabled = false }
  })
})
`

