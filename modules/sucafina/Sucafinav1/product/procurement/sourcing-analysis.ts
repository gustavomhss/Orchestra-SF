import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import { esc } from "../../src/screen-shell.ts"
import { analysisHistory } from "../ui/forecast-analysis.ts"

/** Only the authorized case supplies request selectors; the host prepares and revalidates their material. */
export async function sourcingAnalysisForm(projection: AuthorizedCaseProjection, runtime: Pick<SfHostServices, "analyses" | "sourcingInputs" | "selected" | "models">) {
  if (!runtime.analyses) return "<p>Sourcing analysis is currently unavailable.</p>"
  const history = analysisHistory(projection)
  if (!runtime.sourcingInputs) return `${history}<p>Sourcing analysis is currently unavailable.</p>`
  const sources = projection.evidenceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> =>
    ref.kind === "record" && ref.evidenceLevel === "observed" && ref.target.surface === "procurement" &&
    ref.target.recordType === "procurement-request" && ref.target.fields.includes("sourcing"))
  if (!sources.length) return `${history}<p>Sourcing analysis needs an authorized procurement request with sourcing evidence attached to this decision.</p>`
  const parent = runtime.selected.find((item) => item.profile.id === "sf_procurement" && item.skills.some((skill) => skill.id === "sf-comparar-sourcing"))
  const skill = parent?.skills.find((item) => item.id === "sf-comparar-sourcing")
  const models = await runtime.models().catch(() => [])
  if (!parent || !skill || !parent.operationIds.includes("sf_sourcing_compare") || !models.length)
    return `${history}<p>Sourcing analysis needs an available model and the procurement analysis service.</p>`
  const config = {
    caseRef: { id: projection.case.id, incarnation: projection.case.incarnation, version: projection.case.version }, objective: projection.case.objective,
    profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)),
    requestRefs: sources.map((source) => source.refId), models,
  }
  return `${history}<section><h3>Compare sourcing</h3><p>Review submitted proposals, evaluation criteria, currencies and gaps for an attached request. The result remains a contribution for your review.</p><form data-sourcing-analysis data-config="${esc(JSON.stringify(config))}"><label>Procurement request<select name="requestRef" required><option value="">Choose an attached request</option>${sources.map((source) => `<option value="${esc(source.refId)}">Request ${esc(source.target.recordId)} · version ${esc(source.target.version)}${source.target.period ? ` · ${esc(source.target.period.start)} – ${esc(source.target.period.end)}` : ""}</option>`).join("")}</select></label><label>Model<select name="model" required><option value="">Choose a model</option>${models.map((model, index) => `<option value="${index}">${esc(model.providerID)} · ${esc(model.id)}</option>`).join("")}</select></label><button type="submit">Start sourcing analysis</button><button type="button" data-sourcing-cancel hidden>Cancel analysis</button><button type="button" data-sourcing-status hidden>Check analysis status</button><button type="button" data-sourcing-history>Refresh analysis history</button><p role="status" aria-live="polite"></p></form></section>`
}

export const sourcingAnalysisScript = `
document.querySelectorAll('[data-sourcing-analysis]').forEach((form) => {
  if (form.dataset.sfSourcingReady) return; form.dataset.sfSourcingReady = 'true'
  const config = JSON.parse(form.dataset.config)
  const status = form.querySelector('[role=status]')
  const submit = form.querySelector('button[type=submit]')
  const cancel = form.querySelector('[data-sourcing-cancel]')
  const check = form.querySelector('[data-sourcing-status]')
  const history = form.querySelector('[data-sourcing-history]')
  const controls = [...form.querySelectorAll('select')]
  let runRef
  let timer
  form.addEventListener('input', () => { form.dataset.dirty = 'true' })
  const refreshHistory = () => document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh'))
  history.addEventListener('click', refreshHistory)
  const send = async (mode, payload) => {
    const url = new URL(location.href); url.search = '?sf=' + mode
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) })
    const result = await response.json()
    if (!response.ok || result.status !== 'ok') throw new Error('unavailable')
    return result.value
  }
  const refresh = async () => {
    if (!form.isConnected || !runRef) return
    clearTimeout(timer); check.disabled = true
    try {
      const run = await send('workbench-analysis', { action: 'read', runRef })
      const active = ['preparing', 'queued', 'running'].includes(run.state)
      status.textContent = 'Analysis: ' + run.state + (run.outputRef ? '. Open the result in analysis history to review it.' : '.')
      submit.disabled = active; controls.forEach((control) => { control.disabled = active })
      cancel.hidden = !active; check.hidden = !active
      if (!active) refreshHistory()
      if (active) timer = setTimeout(refresh, 2000)
    } catch {
      status.textContent = 'Analysis status unavailable. Check its status before starting another analysis.'
      check.hidden = false
    } finally { check.disabled = false }
  }
  check.addEventListener('click', refresh)
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (submit.disabled || !form.reportValidity()) return
    const fields = new FormData(form)
    const selected = fields.get('model')
    const model = typeof selected === 'string' && /^\\d+$/.test(selected) ? config.models[Number(selected)] : undefined
    const requestRef = fields.get('requestRef')
    if (!model || !config.requestRefs.includes(requestRef)) { status.textContent = 'Choose an attached request and an available model.'; return }
    let attempted = false
    submit.disabled = true; controls.forEach((control) => { control.disabled = true })
    cancel.hidden = true; check.hidden = true; status.textContent = 'Preparing sourcing analysis…'
    try {
      const skillInput = await send('workbench-sourcing-input', { caseRef: config.caseRef, requestRef })
      attempted = true
      const started = await send('workbench-analysis', { action: 'start', input: {
        request: { caseRef: config.caseRef, objective: config.objective, profileId: config.profileId, profileVersion: config.profileVersion,
          skillId: config.skillId, skillVersion: config.skillVersion, manifestDigest: config.manifestDigest,
          outputSchemaVersion: config.outputSchemaVersion, requestedOperationScope: config.requestedOperationScope }, skillInput, model,
      } })
      if (!started.runRef) throw new Error('unavailable')
      runRef = started.runRef; delete form.dataset.dirty; refreshHistory(); await refresh()
    } catch {
      status.textContent = attempted ? 'Could not confirm whether analysis started. Refresh analysis history before starting another.' : 'Sourcing analysis could not be prepared. Check the attached request and current access, then try again.'
      if (attempted) refreshHistory()
    } finally {
      if (!attempted) { submit.disabled = false; controls.forEach((control) => { control.disabled = false }) }
    }
  })
  cancel.addEventListener('click', async () => {
    if (!runRef || cancel.disabled) return
    cancel.disabled = true; clearTimeout(timer); status.textContent = 'Cancelling analysis…'
    try { await send('workbench-analysis', { action: 'cancel', runRef }); await refresh() }
    catch { status.textContent = 'Could not confirm cancellation. Check the analysis status.'; check.hidden = false }
    finally { cancel.disabled = false }
  })
})
`
