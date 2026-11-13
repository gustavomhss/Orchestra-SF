import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import { esc } from "../../src/screen-shell.ts"

/** The selections and source references are restricted to the authorized case. */
export async function forecastAnalysisForm(projection: AuthorizedCaseProjection, runtime: SfHostServices) {
  if (!runtime.analyses || !runtime.forecastInputs) return "<p>Forecast analysis is currently unavailable.</p>"
  const parent = runtime.selected.find((item) => item.skills.some((skill) => skill.id === "sf-explicar-forecast"))
  const skill = parent?.skills.find((item) => item.id === "sf-explicar-forecast")
  const models = await runtime.models().catch(() => [])
  const sources = projection.case.sourceRefs.filter((ref) => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
  if (!parent || !skill || !models.length || sources.length < 2) return "<p>Forecast analysis needs an available model and two forecast sources attached to this decision.</p>"
  const config = { caseRef: { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }, objective: projection.case.objective,
    profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)), models }
  const options = sources.map((source, index) => `<option value="${esc(source.refId)}">Forecast source ${index + 1}${source.target.period ? ` · ${esc(source.target.period.start)} – ${esc(source.target.period.end)}` : ""}</option>`).join("")
  return `<section><h3>Explain a forecast</h3><form data-forecast-analysis data-config="${esc(JSON.stringify(config))}"><label>Baseline<select name="baseRef">${options}</select></label><label>Comparison<select name="candidateRef">${options}</select></label><label>Start<input name="start" type="date" required value="${esc(projection.case.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(projection.case.horizon.end)}"></label><label>Currency<input name="currency" value="${esc(projection.case.currency)}" required></label><label>Model<select name="model" required><option value="">Choose a model</option>${models.map((model, index) => `<option value="${index}">${esc(model.providerID)} · ${esc(model.id)}</option>`).join("")}</select></label><button>Start analysis</button><button type="button" data-analysis-cancel hidden>Cancel analysis</button><p role="status" aria-live="polite"></p></form></section>`
}

export const forecastAnalysisScript = `
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
