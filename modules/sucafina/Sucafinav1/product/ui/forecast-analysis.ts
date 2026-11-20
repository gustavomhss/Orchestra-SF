import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { SfHostServices } from "../contracts/host-context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

export async function scenarioAnalysisForm(projection: AuthorizedCaseProjection, runtime: SfHostServices) {
  if (!runtime.analyses || !runtime.analysisInputs) return "<p>Specialist scenario analysis is currently unavailable.</p>"
  const parent = runtime.selected.find((item) => item.skills.some((skill) => skill.id === "sf-comparar-cenarios"))
  const skill = parent?.skills.find((item) => item.id === "sf-comparar-cenarios")
  const models = await runtime.models().catch(() => [])
  if (!parent || !skill || !models.length || projection.case.alternatives.length < 2) return "<p>Specialist scenario analysis needs two saved alternatives and an available model.</p>"
  const item = projection.case
  const config = { request: { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, objective: item.objective, profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)) }, alternatives: item.alternatives.map((alternative) => ({ id: alternative.id, version: alternative.version })), model: models[0] }
  const options = item.alternatives.map((alternative, index) => `<option value="${index}">${esc(alternative.title)}</option>`).join("")
  return `<section><h3>Analyze alternatives</h3><form data-scenario-analysis data-config="${esc(JSON.stringify(config))}"><label>First alternative<select name="first">${options}</select></label><label>Second alternative<select name="second">${options}</select></label><button type="submit">Start specialist analysis</button><p role="status" aria-live="polite"></p></form></section>`
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
  return `${history}<section><h3>Explain a forecast</h3><form data-forecast-analysis data-config="${esc(JSON.stringify(config))}"><label>Baseline<select name="baseRef">${options}</select></label><label>Comparison<select name="candidateRef">${options}</select></label><label>Start<input name="start" type="date" required value="${esc(projection.case.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(projection.case.horizon.end)}"></label><label>Currency<input name="currency" value="${esc(projection.case.currency)}" required></label><details><summary>Analysis settings</summary><label>Model<select name="model">${models.map((model, index) => `<option value="${index}">${esc(model.providerID)} · ${esc(model.id)}</option>`).join("")}</select></label></details><button>Start analysis</button><button type="button" data-analysis-cancel hidden>Cancel analysis</button><button type="button" data-analysis-retry hidden>Refresh analysis status</button><p role="status" aria-live="polite"></p></form></section>`
}

export const forecastAnalysisScript = `
document.querySelectorAll('[data-scenario-analysis]').forEach((form) => {
  if (form.dataset.sfScenarioAnalysisReady) return; form.dataset.sfScenarioAnalysisReady = 'true'
  const config = JSON.parse(form.dataset.config); const status = form.querySelector('[role=status]'); const button = form.querySelector('button[type=submit]')
  let prepareKey = crypto.randomUUID(); let startKey = crypto.randomUUID()
  form.addEventListener('change', () => { prepareKey = crypto.randomUUID(); startKey = crypto.randomUUID(); form.dataset.dirty = 'true' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (button.disabled) return
    const fields = new FormData(form); const first = config.alternatives[Number(fields.get('first'))]; const second = config.alternatives[Number(fields.get('second'))]
    if (!first || !second || first.id === second.id) { status.textContent = 'Choose two different alternatives.'; return }
    const send = async (payload, key) => { const url = new URL(location.href); url.search = '?sf=workbench-analysis'; const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
    button.disabled = true; status.textContent = 'Preparing analysis…'; let starting = false
    try {
      const skillInput = await send({ action: 'prepare', input: { request: config.request, selection: { caseRef: config.request.caseRef, alternatives: [first, second] } } }, prepareKey)
      starting = true
      const run = await send({ action: 'start', input: { request: config.request, skillInput, model: config.model } }, startKey)
      if (!run.runRef) throw new Error('unavailable')
      delete form.dataset.dirty; status.textContent = 'Analysis started. Follow progress in analysis history.'; document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh'))
    } catch { status.textContent = starting ? 'Could not confirm whether analysis started. Check analysis history before retrying.' : 'Analysis could not be prepared. Check the alternatives and access, then retry.' }
    finally { button.disabled = false }
  })
})
;(() => {
  // Every controller shares the page's revocation boundary. A late response may
  // not recreate detached/private content or issue the next write in a chain.
  const access = { closed: false, generation: 0, requests: new Set(), cleanups: new Set() }
  const live = (element, generation = access.generation) => !access.closed && generation === access.generation && element.isConnected
  const revoke = () => {
    if (access.closed) return
    access.closed = true; access.generation++
    access.requests.forEach((controller) => controller.abort())
    access.cleanups.forEach((cleanup) => cleanup())
  }
  addEventListener('sf-access-revoked', revoke)
  addEventListener('pagehide', revoke, { once: true })
  const send = async (element, mode, payload, key = crypto.randomUUID()) => {
    const generation = access.generation
    if (!live(element, generation)) throw new Error('inactive')
    const controller = new AbortController()
    access.requests.add(controller)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(payload), signal: controller.signal })
      if (!live(element, generation)) throw new Error('inactive')
      if (response.status === 401 || response.status === 403) { revoke(); throw new Error('denied') }
      const result = await response.json()
      if (!live(element, generation)) throw new Error('inactive')
      if (result?.status === 'denied') { revoke(); throw new Error('denied') }
      if (!response.ok || result?.status !== 'ok')
        throw new Error([400, 409, 422].includes(response.status) || ['stale', 'conflict', 'needs-input'].includes(result?.status) ? 'rejected' : 'unavailable')
      return result.value
    } finally { access.requests.delete(controller) }
  }
  const activeStates = ['preparing', 'queued', 'running']
  const terminalStates = ['ready', 'needs-input', 'unavailable', 'failed', 'cancelled', 'stale']

  document.querySelectorAll('[data-analysis-history]').forEach((section) => {
    if (section.dataset.sfAnalysisHistoryReady) return; section.dataset.sfAnalysisHistoryReady = 'true'
    const status = section.querySelector('[role=status]')
    const output = section.querySelector('[data-results]')
    let timer, loading = false, again = false
    access.cleanups.add(() => {
      clearTimeout(timer); again = false
      section.removeAttribute('data-case')
      output.replaceChildren(); status.textContent = ''
    })
    const load = async () => {
      if (!live(section)) return
      if (loading) { again = true; return }
      loading = true; clearTimeout(timer)
      try {
        const runs = await send(section, 'workbench-analysis', { action: 'list', caseRef: JSON.parse(section.dataset.case) })
        if (!live(section)) return
        if (!Array.isArray(runs) || runs.some((run) => !run || typeof run.runRef !== 'string' || !run.runRef ||
          ![...activeStates, ...terminalStates].includes(run.state))) throw new Error('unavailable')
        if (section.querySelector('form[data-dirty]')) { timer = setTimeout(load, 3000); return }
        output.replaceChildren(); status.textContent = runs.length ? '' : 'No analyses yet.'
        for (const run of runs) {
          const entry = document.createElement('article'); entry.dataset.runRef = run.runRef
          const state = document.createElement('p'); state.textContent = 'Analysis: ' + run.state
          entry.append(state); output.append(entry)
          if (activeStates.includes(run.state)) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Cancel analysis'
            const key = crypto.randomUUID()
            button.addEventListener('click', async () => {
              if (!live(entry) || button.disabled) return
              button.disabled = true
              try { await send(entry, 'workbench-analysis', { action: 'cancel', runRef: run.runRef }, key); if (live(entry)) await load() }
              catch { if (live(entry)) { state.textContent = 'Could not confirm cancellation.'; button.disabled = false } }
            })
            entry.append(button)
          }
          if (run.state !== 'ready') continue
          const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open result'; entry.append(open)
          open.addEventListener('click', async () => {
            if (!live(entry) || open.disabled) return
            open.disabled = true
            try {
              const result = await send(entry, 'workbench-analysis', { action: 'output', runRef: run.runRef })
              if (!live(entry)) return
              if (!result || typeof result.html !== 'string') throw new Error('unavailable')
              const body = document.createElement('div'); body.dataset.analysisBody = ''; body.innerHTML = result.html; entry.append(body)
              if (!result.outputRef) { open.remove(); return }
              const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Reason for accepting this contribution'
              const rationale = document.createElement('textarea'); rationale.required = true; label.append(rationale)
              const button = document.createElement('button'); button.textContent = 'Accept contribution'
              const message = document.createElement('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite')
              let key = crypto.randomUUID()
              rationale.addEventListener('input', () => { key = crypto.randomUUID(); form.dataset.dirty = 'true' })
              form.addEventListener('submit', async (event) => {
                event.preventDefault(); if (!live(form) || !form.reportValidity() || button.disabled) return
                button.disabled = true; rationale.disabled = true; message.textContent = 'Recording your decision…'
                try {
                  await send(form, 'decision-accept-analysis', { caseRef: JSON.parse(section.dataset.case), outputRef: result.outputRef, runRef: run.runRef, rationale: rationale.value.trim() }, key)
                  if (live(form)) { delete form.dataset.dirty; location.reload() }
                } catch { if (live(form)) message.textContent = 'Could not confirm acceptance. Your reason is preserved; retry the same request.' }
                finally { if (live(form)) { button.disabled = false; rationale.disabled = false } }
              })
              form.append(label, button, message); entry.append(form); open.remove()
            } catch { if (live(entry)) { state.textContent += ' · Result unavailable or access changed.'; open.disabled = false } }
          })
        }
        if (runs.some((run) => activeStates.includes(run.state))) timer = setTimeout(load, 3000)
      } catch { if (live(section)) { output.replaceChildren(); status.textContent = 'Analysis history unavailable or access changed.' } }
      finally {
        loading = false
        if (again && live(section)) { again = false; void load() }
      }
    }
    section.addEventListener('sf-analysis-refresh', load); void load()
  })

  document.querySelectorAll('[data-forecast-analysis]').forEach((form) => {
    if (form.dataset.sfForecastReady) return; form.dataset.sfForecastReady = 'true'
    let config = JSON.parse(form.dataset.config)
    const status = form.querySelector('[role=status]')
    const cancel = form.querySelector('[data-analysis-cancel]')
    const retry = form.querySelector('[data-analysis-retry]')
    const button = form.querySelector('button:not([type]), button[type=submit]')
    const fields = [...form.querySelectorAll('input,select,textarea')]
    const originalDisabled = new Map(fields.map((field) => [field, field.disabled]))
    let runRef, lastState, cancelKey, timer
    let starting = false, reading = false, cancelling = false, uncertain = false
    const present = () => {
      if (!live(form)) return
      const active = activeStates.includes(lastState)
      const locked = starting || reading || cancelling || uncertain || active
      button.disabled = locked
      fields.forEach((field) => { field.disabled = locked || originalDisabled.get(field) })
      cancel.hidden = !active
      cancel.disabled = starting || reading || cancelling
      retry.hidden = !runRef || !active && !uncertain
      retry.disabled = starting || reading || cancelling
    }
    access.cleanups.add(() => {
      clearTimeout(timer)
      config = undefined; runRef = undefined; lastState = undefined; cancelKey = undefined
      form.removeAttribute('data-config'); delete form.dataset.dirty
      fields.forEach((field) => {
        field.value = ''; field.removeAttribute('value'); field.disabled = true
        if ('defaultValue' in field) field.defaultValue = ''
        if (field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') field.replaceChildren()
      })
      originalDisabled.clear(); button.disabled = true
      cancel.remove(); retry.remove()
      status.textContent = 'Analysis access changed. Reopen the decision with your current access.'
    })
    form.addEventListener('input', () => { if (live(form)) form.dataset.dirty = 'true' })
    const refresh = async () => {
      if (!live(form) || !runRef || reading) return
      const current = runRef
      reading = true; clearTimeout(timer); present()
      try {
        const run = await send(form, 'workbench-analysis', { action: 'read', runRef: current })
        if (!live(form) || runRef !== current) return
        if (!run || run.runRef !== current || ![...activeStates, ...terminalStates].includes(run.state)) throw new Error('unavailable')
        lastState = run.state; uncertain = false
        status.textContent = 'Analysis: ' + run.state + (run.outputRef ? '. The result is being prepared for display.' : '.')
        if (activeStates.includes(run.state)) timer = setTimeout(refresh, 2000)
        else document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh'))
      } catch {
        if (live(form) && runRef === current) {
          uncertain = true
          status.textContent = 'Analysis status unavailable. Refresh its status before starting another analysis.'
        }
      } finally { reading = false; present() }
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!live(form) || button.disabled || !form.reportValidity()) return
      const values = new FormData(form); const model = config.models[Number(values.get('model'))]
      if (!model || values.get('baseRef') === values.get('candidateRef')) { status.textContent = 'Choose a model and two different forecast sources.'; return }
      const selection = { caseRef: config.caseRef, baseRef: values.get('baseRef'), candidateRef: values.get('candidateRef'),
        period: { start: values.get('start'), end: values.get('end') }, currency: values.get('currency') }
      const request = { caseRef: config.caseRef, objective: config.objective, profileId: config.profileId,
        profileVersion: config.profileVersion, skillId: config.skillId, skillVersion: config.skillVersion,
        manifestDigest: config.manifestDigest, outputSchemaVersion: config.outputSchemaVersion, requestedOperationScope: config.requestedOperationScope }
      const prepareKey = crypto.randomUUID(), startKey = crypto.randomUUID()
      let attempted = false
      starting = true; uncertain = false; runRef = undefined; lastState = undefined; clearTimeout(timer)
      present(); status.textContent = 'Preparing analysis…'
      try {
        const skillInput = await send(form, 'workbench-forecast', selection, prepareKey)
        if (!live(form)) return
        attempted = true
        const started = await send(form, 'workbench-analysis', { action: 'start', input: { request, skillInput, model } }, startKey)
        if (!live(form)) return
        if (!started || typeof started.runRef !== 'string' || !started.runRef) throw new Error('unavailable')
        runRef = started.runRef; cancelKey = crypto.randomUUID()
        delete form.dataset.dirty
        starting = false; uncertain = true
        await refresh()
      } catch (error) {
        if (!live(form)) return
        const rejected = error instanceof Error && error.message === 'rejected'
        uncertain = attempted && !rejected
        status.textContent = rejected
          ? 'The analysis request was rejected. Review the sources and current decision before retrying.'
          : attempted ? 'Could not confirm whether analysis started. Check analysis history before starting another.'
          : 'Analysis could not be prepared. Check the sources and period, then try again.'
        if (uncertain) document.querySelector('[data-analysis-history]')?.dispatchEvent(new Event('sf-analysis-refresh'))
      } finally { starting = false; present() }
    })
    retry.addEventListener('click', () => { if (!retry.disabled && !cancelling) void refresh() })
    cancel.addEventListener('click', async () => {
      if (!live(form) || !runRef || cancel.disabled || !activeStates.includes(lastState)) return
      cancelling = true; clearTimeout(timer); present(); status.textContent = 'Cancelling analysis…'
      try {
        await send(form, 'workbench-analysis', { action: 'cancel', runRef }, cancelKey)
        if (live(form)) await refresh()
      } catch {
        if (live(form)) { uncertain = true; status.textContent = 'Could not confirm cancellation. Refresh the analysis status.' }
      } finally { cancelling = false; present() }
    })
    present()
  })
})()
`
