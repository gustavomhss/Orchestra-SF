import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

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
  return `${history}<section><h3>Explain a forecast</h3><form data-forecast-analysis data-config="${esc(JSON.stringify(config))}"><label>Baseline<select name="baseRef">${options}</select></label><label>Comparison<select name="candidateRef">${options}</select></label><label>Start<input name="start" type="date" required value="${esc(projection.case.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(projection.case.horizon.end)}"></label><label>Currency<input name="currency" value="${esc(projection.case.currency)}" required></label><label>Model<select name="model" required><option value="">Choose a model</option>${models.map((model, index) => `<option value="${index}">${esc(model.providerID)} · ${esc(model.id)}</option>`).join("")}</select></label><button>Start analysis</button><button type="button" data-analysis-cancel hidden>Cancel analysis</button><p role="status" aria-live="polite"></p></form></section>`
}

export const forecastAnalysisScript = `
document.querySelectorAll('[data-analysis-history]').forEach((section) => {
  const status = section.querySelector('[role=status]')
  const output = section.querySelector('[data-results]')
  let timer
  const send = async (payload) => {
    const url = new URL(location.href); url.search = '?sf=workbench-analysis'
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) })
    const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value
  }
  const load = async () => {
    try {
      const runs = await send({ action: 'list', caseRef: JSON.parse(section.dataset.case) })
      if (section.querySelector('form[data-dirty]')) { clearTimeout(timer); timer = setTimeout(load, 3000); return }
      clearTimeout(timer); output.replaceChildren(); status.textContent = runs.length ? '' : 'No analyses yet.'
      for (const run of runs) {
        const entry = document.createElement('article'); const state = document.createElement('p'); state.textContent = 'Analysis: ' + run.state; entry.append(state); output.append(entry)
        if (['preparing', 'queued', 'running'].includes(run.state)) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Cancel analysis'
          button.addEventListener('click', async () => { button.disabled = true; try { await send({ action: 'cancel', runRef: run.runRef }); await load() } catch { state.textContent = 'Could not confirm cancellation.'; button.disabled = false } })
          entry.append(button)
        }
        if (!run.outputRef) continue
        try {
          const result = await send({ action: 'output', runRef: run.runRef }); const body = document.createElement('div'); body.innerHTML = result.html; entry.append(body)
          const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reason for accepting this contribution'
          const rationale = document.createElement('textarea'); rationale.required = true; label.append(rationale)
          const button = document.createElement('button'); button.textContent = 'Accept contribution'
          const message = document.createElement('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite')
          let key = crypto.randomUUID(); rationale.addEventListener('input', () => { key = crypto.randomUUID(); form.dataset.dirty = 'true' })
          form.addEventListener('submit', async (event) => {
            event.preventDefault(); if (!form.reportValidity() || button.disabled) return
            button.disabled = true; rationale.disabled = true; message.textContent = 'Recording your decision…'
            try {
              const url = new URL(location.href); url.search = '?sf=decision-accept-analysis'
              const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ caseRef: JSON.parse(section.dataset.case), outputRef: run.outputRef, runRef: run.runRef, rationale: rationale.value.trim() }) })
              const accepted = await response.json(); if (!response.ok || accepted.status !== 'ok') throw new Error('unavailable')
              delete form.dataset.dirty; location.reload()
            } catch { message.textContent = 'Could not confirm acceptance. Your reason is preserved; retry the same request.' }
            finally { button.disabled = false; rationale.disabled = false }
          })
          form.append(label, button, message); entry.append(form)
        }
        catch { state.textContent += ' · Result unavailable or access changed.' }
      }
      if (runs.some((run) => ['preparing', 'queued', 'running'].includes(run.state))) timer = setTimeout(load, 3000)
    } catch { output.replaceChildren(); status.textContent = 'Analysis history unavailable or access changed.' }
  }
  section.addEventListener('sf-analysis-refresh', load); load()
})
document.querySelectorAll('[data-forecast-analysis]').forEach((form) => {
  const config = JSON.parse(form.dataset.config)
  const status = form.querySelector('[role=status]')
  const cancel = form.querySelector('[data-analysis-cancel]')
  const button = form.querySelector('button[type=submit]')
  let runRef
  let timer
  const send = async (mode, payload) => {
    const url = new URL(location.href); url.search = '?sf=' + mode
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) })
    const result = await response.json()
    if (!response.ok || result.status !== 'ok') throw new Error('unavailable')
    return result.value
  }
  const refresh = async () => {
    if (!runRef) return
    try {
      const run = await send('workbench-analysis', { action: 'read', runRef })
      status.textContent = 'Analysis: ' + run.state + (run.outputRef ? '. The result is being prepared for display.' : '.')
      const active = ['preparing', 'queued', 'running'].includes(run.state)
      cancel.hidden = !active
      button.disabled = active
      if (!active) document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh'))
      if (active) timer = setTimeout(refresh, 2000)
    } catch { status.textContent = 'Analysis status unavailable. Try again from the decision.'; cancel.hidden = true }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return
    const fields = new FormData(form); const model = config.models[Number(fields.get('model'))]
    if (!model || fields.get('baseRef') === fields.get('candidateRef')) { status.textContent = 'Choose a model and two different forecast sources.'; return }
    let attempted = false
    button.disabled = true; status.textContent = 'Preparing analysis…'
    try {
      const skillInput = await send('workbench-forecast', { caseRef: config.caseRef, baseRef: fields.get('baseRef'), candidateRef: fields.get('candidateRef'), period: { start: fields.get('start'), end: fields.get('end') }, currency: fields.get('currency') })
      attempted = true
      const started = await send('workbench-analysis', { action: 'start', input: { request: { caseRef: config.caseRef, objective: config.objective, profileId: config.profileId, profileVersion: config.profileVersion, skillId: config.skillId, skillVersion: config.skillVersion, manifestDigest: config.manifestDigest, outputSchemaVersion: config.outputSchemaVersion, requestedOperationScope: config.requestedOperationScope }, skillInput, model } })
      if (!started.runRef) throw new Error('unavailable')
      runRef = started.runRef; await refresh()
    } catch { status.textContent = attempted ? 'Could not confirm whether analysis started. Check the decision before starting another.' : 'Analysis could not be prepared. Check the sources and period, then try again.' }
    finally { if (!attempted) button.disabled = false }
  })
  cancel.addEventListener('click', async () => {
    if (!runRef) return
    cancel.disabled = true; clearTimeout(timer); status.textContent = 'Cancelling analysis…'
    try { await send('workbench-analysis', { action: 'cancel', runRef }); await refresh() }
    catch { status.textContent = 'Could not confirm cancellation. Check the analysis status.' }
    finally { cancel.disabled = false }
  })
})
`
