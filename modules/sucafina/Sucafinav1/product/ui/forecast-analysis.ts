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

/** Uses the registered specialist and the current saved case; no browser source is promoted to authority. */
export async function intentAnalysisForm(projection: AuthorizedCaseProjection, runtime: SfHostServices) {
  if (!runtime.analyses || !runtime.analysisInputs) return "<p>Decision framing is currently unavailable.</p>"
  const parent = runtime.selected.find((item) => item.skills.some((skill) => skill.id === "sf-enquadrar-decisao"))
  const skill = parent?.skills.find((item) => item.id === "sf-enquadrar-decisao")
  const model = (await runtime.models().catch(() => []))[0]
  if (!parent || !skill || !model) return "<p>Decision framing needs an available specialist model.</p>"
  const item = projection.case
  const config = { request: { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, objective: item.objective,
    profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version,
    manifestDigest: parent.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
    requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)) }, model }
  return `<section><h3>Frame the decision</h3><form data-intent-analysis data-config="${esc(JSON.stringify(config))}"><button type="submit">Prepare decision framing</button><p role="status" aria-live="polite"></p></form></section>`
}

export const forecastAnalysisScript = `
;(() => {
  const fresh = [...document.querySelectorAll('[data-scenario-analysis], [data-intent-analysis], [data-analysis-history], [data-forecast-analysis]')]
    .filter((element) => !element.dataset.sfAnalysisController)
  if (!fresh.length) return
  const access = { closed: false, generation: 0, requests: new Set(), cleanups: new Set() }
  const live = (element, generation = access.generation) => !access.closed && generation === access.generation && element.isConnected
  const revoke = () => {
    if (access.closed) return
    access.closed = true; access.generation++
    // Fence and erase immediately. Already dispatched reads may finish within
    // their original deadline; neither their body nor the next write can escape.
    access.cleanups.forEach((cleanup) => cleanup())
  }
  const leave = () => { revoke(); access.requests.forEach((controller) => controller.abort()) }
  addEventListener('sf-access-revoked', revoke)
  addEventListener('pagehide', leave, { once: true })
  const send = async (element, mode, payload, key = crypto.randomUUID()) => {
    const generation = access.generation
    if (!live(element, generation)) throw new Error('inactive')
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 10000)
    access.requests.add(controller)
    try {
      const url = new URL(location.href); url.search = '?sf=' + mode
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload), signal: controller.signal })
      if (!live(element, generation)) throw new Error('inactive')
      // A denied analysis closes these controllers; only the shell's own signal removes the whole view.
      if (response.status === 401 || response.status === 403) { revoke(); throw new Error('denied') }
      const result = await response.json()
      if (!live(element, generation)) throw new Error('inactive')
      if (result?.status === 'denied') { revoke(); throw new Error('denied') }
      if (!response.ok || result?.status !== 'ok') {
        const rejected = [400, 422].includes(response.status) || ['stale', 'needs-input'].includes(result?.status)
        throw new Error(rejected ? 'rejected' : response.status === 409 || result?.status === 'conflict' ? 'conflict' : 'unavailable')
      }
      return result.value
    } finally { clearTimeout(deadline); access.requests.delete(controller) }
  }
  const activeStates = ['preparing', 'queued', 'running']
  const terminalStates = ['ready', 'needs-input', 'unavailable', 'failed', 'cancelled', 'stale']
  const validRun = (run) => run && typeof run.runRef === 'string' && !!run.runRef.trim() && [...activeStates, ...terminalStates].includes(run.state)
  const sameRun = (left, right) => left.runRef === right.runRef && left.state === right.state && left.version === right.version && left.outputRef === right.outputRef
  const scrub = (fields) => fields.forEach((field) => {
    field.value = ''; field.removeAttribute('value'); field.disabled = true
    if ('defaultValue' in field) field.defaultValue = ''
    if (field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') field.replaceChildren()
  })
  const refreshHistory = () => document.querySelectorAll('[data-analysis-history]').forEach((section) => section.dispatchEvent(new Event('sf-analysis-refresh')))
  const preparedController = (form, settings) => {
    form.dataset.sfAnalysisController = 'true'
    let config = settings.config
    const status = form.querySelector('[role=status]'), button = form.querySelector('button[type=submit]')
    const fields = [...form.querySelectorAll('input, select, textarea')]
    const originalDisabled = new Map(fields.map((field) => [field, field.disabled]))
    const initialLabel = button.textContent
    let busy = false, complete = false, blocked = false, invalid = false, pending, frozen
    const current = () => !invalid && live(form)
    const present = () => {
      if (!current()) return
      button.disabled = busy || complete || blocked
      button.textContent = complete && settings.review ? 'Review requested' : pending ? settings.retry : initialLabel
      fields.forEach((field) => { field.disabled = busy || complete || !!pending || originalDisabled.get(field) })
    }
    const stop = () => {
      invalid = true; access.cleanups.delete(stop); config = undefined; pending = undefined; frozen = undefined
      form.removeAttribute('data-config'); delete form.dataset.dirty
      scrub(fields); originalDisabled.clear(); button.disabled = true
      status.textContent = settings.revoked
    }
    access.cleanups.add(stop)
    const changed = () => {
      if (!current()) return
      if (busy || complete || pending) { frozen?.forEach((value, field) => { field.value = value }); return }
      form.dataset.dirty = 'true'
    }
    form.addEventListener('input', changed); form.addEventListener('change', changed)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (!current() || busy || complete || blocked || !form.reportValidity()) return
      const retrying = !!pending
      const selection = retrying ? undefined : settings.selection(config, new FormData(form))
      if (!retrying && !selection) { status.textContent = settings.selectionError; return }
      const wanted = retrying ? undefined : structuredClone(config)
      if (!retrying) frozen = new Map(fields.map((field) => [field, field.value]))
      busy = true; form.dataset.dirty = 'true'; present(); status.textContent = retrying ? 'Recovering the same request…' : 'Preparing analysis…'
      try {
        if (!pending) {
          const skillInput = await send(form, 'workbench-analysis', { action: 'prepare', input: { request: wanted.request, selection } })
          if (!current()) return
          if (!skillInput || typeof skillInput !== 'object') throw new Error('unavailable')
          pending = Object.freeze({ body: JSON.stringify({ action: 'start', input: { request: wanted.request, skillInput, model: wanted.model } }), key: crypto.randomUUID() })
        }
        const run = await send(form, 'workbench-analysis', pending.body, pending.key)
        if (!current()) return
        if (!run || typeof run.runRef !== 'string' || !run.runRef.trim()) throw new Error('unavailable')
        complete = true; pending = undefined; delete form.dataset.dirty
        status.textContent = settings.started; refreshHistory()
      } catch (error) {
        if (!current()) return
        const rejected = error instanceof Error && error.message === 'rejected'
        const conflict = error instanceof Error && error.message === 'conflict'
        if (retrying && (rejected || conflict)) { blocked = true; status.textContent = settings.reconcile }
        else if (rejected && !retrying) { pending = undefined; frozen = undefined; status.textContent = settings.rejected }
        else status.textContent = pending ? settings.uncertain : settings.prepareFailed
      } finally { busy = false; present() }
    })
    present()
    return { stop }
  }
  const analysisSettings = {
    retry: 'Retry the same analysis request',
    started: 'Analysis started. Follow progress in analysis history.',
    uncertain: 'Could not confirm whether analysis started. Retry the same request to recover its result.',
    reconcile: 'The retry was rejected but the earlier analysis request is still unconfirmed. Reconcile analysis history before requesting another analysis.',
    rejected: 'The analysis request was rejected. Review the alternatives and current decision before retrying.',
    prepareFailed: 'Analysis could not be prepared. Check the alternatives and access, then retry.',
    revoked: 'Analysis access changed. Reopen this decision with your current access.',
  }
  for (const form of fresh.filter((element) => element.matches('[data-scenario-analysis], [data-intent-analysis]'))) {
    preparedController(form, { ...analysisSettings, config: JSON.parse(form.dataset.config),
      selectionError: 'Choose two different alternatives.',
      selection: (config, values) => {
        if (form.matches('[data-intent-analysis]')) return {}
        const first = config.alternatives[Number(values.get('first'))], second = config.alternatives[Number(values.get('second'))]
        return first && second && first.id !== second.id ? { caseRef: config.request.caseRef, alternatives: [first, second] } : undefined
      },
    })
  }
  const reviewAvailable = (offer, runRef, caseRef) => offer && offer.request && offer.model && offer.authorAnalysis &&
    offer.request.profileId === 'sf_reviewer' && offer.request.skillId === 'sf-contestar-decisao' &&
    ['profileVersion', 'skillVersion', 'manifestDigest', 'outputSchemaVersion', 'objective'].every((key) => typeof offer.request[key] === 'string' && !!offer.request[key].trim()) &&
    Array.isArray(offer.request.requestedOperationScope) && offer.request.requestedOperationScope.every((value) => typeof value === 'string') &&
    offer.request.caseRef?.id === caseRef.id && offer.request.caseRef?.incarnation === caseRef.incarnation && offer.request.caseRef?.version === caseRef.version &&
    typeof offer.model.id === 'string' && !!offer.model.id.trim() && typeof offer.model.providerID === 'string' && !!offer.model.providerID.trim() &&
    offer.authorAnalysis.runRef === runRef && typeof offer.authorAnalysis.outputDigest === 'string' && /^[a-f0-9]{64}$/.test(offer.authorAnalysis.outputDigest)

  for (const section of fresh.filter((element) => element.matches('[data-analysis-history]'))) {
    section.dataset.sfAnalysisController = 'true'
    const status = section.querySelector('[role=status]'), output = section.querySelector('[data-results]')
    const entries = new Map()
    let caseRef = JSON.parse(section.dataset.case), timer, loading = false, again = false
    access.cleanups.add(() => {
      clearTimeout(timer); again = false; caseRef = undefined
      section.removeAttribute('data-case'); entries.clear(); output.replaceChildren()
      status.textContent = 'Analysis access changed. Reopen the decision with your current access.'
    })
    const makeEntry = (run) => {
      const node = document.createElement('article'); node.dataset.runRef = run.runRef
      const state = document.createElement('p'), cancel = document.createElement('button'), open = document.createElement('button')
      cancel.type = 'button'; cancel.textContent = 'Cancel analysis'
      open.type = 'button'; open.textContent = 'Open result'
      state.textContent = 'Analysis: ' + run.state
      node.append(state, cancel, open); output.append(node)
      const entry = { node, run, revision: 0, fresh: true, opened: false, invalid: false, opening: false, cancelling: false, cancelKey: crypto.randomUUID() }
      const present = () => {
        if (!live(node)) return
        cancel.hidden = !activeStates.includes(entry.run.state)
        cancel.disabled = entry.cancelling || !entry.fresh
        open.hidden = entry.run.state !== 'ready' || entry.opened
        open.disabled = entry.opening || entry.invalid || !entry.fresh
        entry.accept?.present()
      }
      const invalidate = () => {
        entry.revision++; entry.invalid = entry.opened
        entry.body?.remove(); entry.body = undefined
        entry.review?.controller.stop(); entry.review?.form.remove(); entry.review = undefined
        if (entry.accept) {
          entry.accept.blocked = true
          entry.accept.message.textContent = 'This result changed. Refresh the decision before accepting it; your reason is preserved.'
        }
      }
      const update = (next) => {
        if (!sameRun(entry.run, next)) invalidate()
        entry.run = structuredClone(next); entry.fresh = true
        state.textContent = 'Analysis: ' + entry.run.state; present()
      }
      entry.update = update; entry.invalidate = invalidate; entry.present = present
      cancel.addEventListener('click', async () => {
        if (!live(node) || cancel.disabled || !activeStates.includes(entry.run.state)) return
        entry.cancelling = true; present()
        try { await send(node, 'workbench-analysis', { action: 'cancel', runRef: run.runRef }, entry.cancelKey); if (live(node)) await load() }
        catch { if (live(node)) state.textContent = 'Could not confirm cancellation.' }
        finally { entry.cancelling = false; present() }
      })
      open.addEventListener('click', async () => {
        if (!live(node) || open.disabled || entry.opened) return
        const revision = entry.revision
        entry.opening = true; present()
        try {
          const result = await send(node, 'workbench-analysis', { action: 'output', runRef: run.runRef })
          if (!live(node) || revision !== entry.revision) return
          if (!result || typeof result.html !== 'string' || entry.run.outputRef && result.outputRef !== entry.run.outputRef) throw new Error('unavailable')
          const body = document.createElement('div'); body.dataset.analysisBody = ''; body.innerHTML = result.html
          entry.opened = true; entry.body = body; node.append(body)
          if (!result.outputRef) return
          const form = document.createElement('form'), label = document.createElement('label')
          label.textContent = 'Reason for accepting this contribution'
          const rationale = document.createElement('textarea'); rationale.required = true; label.append(rationale)
          const button = document.createElement('button'); button.type = 'submit'; button.textContent = 'Accept contribution'
          const message = document.createElement('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite')
          const acceptance = { busy: false, blocked: false, pending: undefined, message, present: () => {
            button.disabled = acceptance.busy || acceptance.blocked || !entry.fresh
            rationale.disabled = acceptance.busy || !!acceptance.pending
          } }
          entry.accept = acceptance
          rationale.addEventListener('input', () => {
            if (!live(form)) return
            if (acceptance.pending) { rationale.value = acceptance.pending.rationale; return }
            form.dataset.dirty = 'true'
          })
          form.addEventListener('submit', async (event) => {
            event.preventDefault()
            if (!live(form) || button.disabled || !form.reportValidity()) return
            const revision = entry.revision
            const intention = acceptance.pending ?? Object.freeze({ key: crypto.randomUUID(), rationale: rationale.value.trim(),
              body: JSON.stringify({ caseRef, outputRef: result.outputRef, runRef: run.runRef, rationale: rationale.value.trim() }) })
            acceptance.busy = true; acceptance.present(); message.textContent = 'Recording your decision…'
            try {
              const current = await send(form, 'workbench-analysis', { action: 'read', runRef: run.runRef })
              if (!live(form) || revision !== entry.revision) return
              if (!validRun(current) || !sameRun(entry.run, current)) { entry.invalidate(); return }
              acceptance.pending = intention
              await send(form, 'decision-accept-analysis', intention.body, intention.key)
              if (live(form) && revision === entry.revision) { delete form.dataset.dirty; location.reload() }
            } catch { if (live(form)) message.textContent = 'Could not confirm acceptance. Your reason is preserved; retry the same request.' }
            finally { acceptance.busy = false; if (live(form)) acceptance.present() }
          })
          form.append(label, button, message); node.append(form)
          if (reviewAvailable(result.review, run.runRef, caseRef)) {
            const review = document.createElement('form'); review.dataset.reviewAnalysis = ''
            const action = document.createElement('button'); action.type = 'submit'; action.textContent = 'Request independent review'
            const notice = document.createElement('p'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite')
            review.append(action, notice); node.append(review)
            const controller = preparedController(review, { ...analysisSettings, review: true, config: structuredClone(result.review),
              selection: (config) => ({ authorAnalysis: config.authorAnalysis }),
              retry: 'Retry the same review request',
              started: 'Independent review started. Follow its progress in analysis history.',
              uncertain: 'Could not confirm whether the review started. Retry the same request to recover its result.',
              reconcile: 'The retry was rejected but the earlier review request is still unconfirmed. Reconcile analysis history before requesting another review.',
              rejected: 'The review request was rejected. Review the current decision and author result before retrying.',
              prepareFailed: 'Independent review could not be prepared. Check current decision access and the author result, then retry.',
              revoked: 'Analysis access changed. Reopen the decision with your current access.',
            })
            entry.review = { form: review, controller }
          } else {
            const unavailable = document.createElement('p')
            unavailable.textContent = 'Independent review is currently unavailable for this result. It requires current decision access, a ready comparison and an available reviewer model.'
            node.append(unavailable)
          }
        } catch { if (live(node) && revision === entry.revision) state.textContent = 'Result unavailable. Refresh the analysis and current access, then retry.' }
        finally { entry.opening = false; present() }
      })
      present()
      return entry
    }
    const load = async () => {
      if (!live(section)) return
      if (loading) { again = true; return }
      loading = true; clearTimeout(timer)
      try {
        const runs = await send(section, 'workbench-analysis', { action: 'list', caseRef })
        if (!live(section)) return
        if (!Array.isArray(runs) || runs.some((run) => !validRun(run)) || new Set(runs.map((run) => run.runRef)).size !== runs.length) throw new Error('unavailable')
        const visible = new Set(runs.map((run) => run.runRef))
        for (const [runRef, entry] of entries) {
          if (visible.has(runRef)) continue
          entry.fresh = false; entry.invalidate()
          if (entry.accept) entry.present()
          else { entry.node.remove(); entries.delete(runRef) }
        }
        for (const run of runs) {
          const found = entries.get(run.runRef)
          if (found) found.update(run)
          else entries.set(run.runRef, makeEntry(structuredClone(run)))
        }
        status.textContent = runs.length ? '' : 'No analyses yet.'
        if (runs.some((run) => activeStates.includes(run.state))) timer = setTimeout(load, 3000)
      } catch {
        if (live(section)) {
          entries.forEach((entry) => { entry.fresh = false; entry.present() })
          status.textContent = 'Analysis history unavailable. Your open result and reason are preserved.'
        }
      } finally {
        loading = false
        if (again && live(section)) { again = false; void load() }
      }
    }
    section.addEventListener('sf-analysis-refresh', load); void load()
  }
  for (const form of fresh.filter((element) => element.matches('[data-forecast-analysis]'))) {
    form.dataset.sfAnalysisController = 'true'
    let config = JSON.parse(form.dataset.config)
    const status = form.querySelector('[role=status]'), cancel = form.querySelector('[data-analysis-cancel]')
    const retry = form.querySelector('[data-analysis-retry]'), button = form.querySelector('button:not([type]), button[type=submit]')
    const fields = [...form.querySelectorAll('input, select, textarea')]
    const originalDisabled = new Map(fields.map((field) => [field, field.disabled]))
    let runRef, lastState, cancelKey, timer, pending, frozen
    let starting = false, reading = false, cancelling = false, uncertain = false, blocked = false
    const present = () => {
      if (!live(form)) return
      const active = activeStates.includes(lastState), busy = starting || reading || cancelling
      const locked = busy || uncertain || active || !!pending
      button.disabled = locked
      fields.forEach((field) => { field.disabled = locked || originalDisabled.get(field) })
      cancel.hidden = !active; cancel.disabled = busy
      retry.textContent = pending ? 'Retry the same analysis request' : 'Refresh analysis status'
      retry.hidden = !pending && (!runRef || !active && !uncertain)
      retry.disabled = busy || blocked
    }
    access.cleanups.add(() => {
      clearTimeout(timer)
      config = undefined; runRef = undefined; lastState = undefined; cancelKey = undefined; pending = undefined; frozen = undefined
      form.removeAttribute('data-config'); delete form.dataset.dirty
      scrub(fields); originalDisabled.clear(); button.disabled = true; cancel.remove(); retry.remove()
      status.textContent = 'Analysis access changed. Reopen the decision with your current access.'
    })
    const changed = () => {
      if (!live(form)) return
      if (button.disabled) { frozen?.forEach((value, field) => { field.value = value }); return }
      form.dataset.dirty = 'true'
    }
    form.addEventListener('input', changed); form.addEventListener('change', changed)
    const refresh = async () => {
      if (!live(form) || !runRef || reading) return
      const current = runRef
      reading = true; clearTimeout(timer); present()
      try {
        const run = await send(form, 'workbench-analysis', { action: 'read', runRef: current })
        if (!live(form) || runRef !== current) return
        if (!validRun(run) || run.runRef !== current) throw new Error('unavailable')
        lastState = run.state; uncertain = false
        status.textContent = 'Analysis: ' + run.state + (run.outputRef ? '. The result is being prepared for display.' : '.')
        if (activeStates.includes(run.state)) timer = setTimeout(refresh, 2000)
        else { frozen = undefined; refreshHistory() }
      } catch {
        if (live(form) && runRef === current) {
          uncertain = true
          status.textContent = 'Analysis status unavailable. Refresh its status before starting another analysis.'
        }
      } finally { reading = false; present() }
    }
    const start = async (selection, request, model) => {
      if (!live(form) || starting || blocked) return
      const retrying = !!pending
      starting = true; clearTimeout(timer); present(); status.textContent = retrying ? 'Recovering the same request…' : 'Preparing analysis…'
      try {
        if (!pending) {
          const skillInput = await send(form, 'workbench-forecast', selection)
          if (!live(form)) return
          if (!skillInput || typeof skillInput !== 'object') throw new Error('unavailable')
          pending = Object.freeze({ key: crypto.randomUUID(), body: JSON.stringify({ action: 'start', input: { request, skillInput, model } }) })
        }
        const started = await send(form, 'workbench-analysis', pending.body, pending.key)
        if (!live(form)) return
        if (!started || typeof started.runRef !== 'string' || !started.runRef.trim()) throw new Error('unavailable')
        runRef = started.runRef; cancelKey = crypto.randomUUID(); pending = undefined
        delete form.dataset.dirty; starting = false; uncertain = true
        await refresh()
      } catch (error) {
        if (!live(form)) return
        const rejected = error instanceof Error && error.message === 'rejected'
        const conflict = error instanceof Error && error.message === 'conflict'
        if (retrying && (rejected || conflict)) {
          blocked = true; uncertain = true
          status.textContent = 'The retry was rejected but the earlier analysis request is still unconfirmed. Reconcile analysis history before requesting another analysis.'
        } else if (rejected && !retrying) {
          pending = undefined; frozen = undefined; uncertain = false
          status.textContent = 'The analysis request was rejected. Review the sources and current decision before retrying.'
        } else {
          uncertain = !!pending
          status.textContent = pending ? 'Could not confirm whether analysis started. Retry the same request to recover its result.'
            : 'Analysis could not be prepared. Check the sources and period, then try again.'
        }
        if (uncertain) refreshHistory()
      } finally { starting = false; present() }
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (!live(form) || button.disabled || !form.reportValidity()) return
      const values = new FormData(form), wanted = structuredClone(config), model = wanted.models[Number(values.get('model'))]
      if (!model || values.get('baseRef') === values.get('candidateRef')) { status.textContent = 'Choose a model and two different forecast sources.'; return }
      const selection = { caseRef: wanted.caseRef, baseRef: values.get('baseRef'), candidateRef: values.get('candidateRef'),
        period: { start: values.get('start'), end: values.get('end') }, currency: values.get('currency') }
      const request = { caseRef: wanted.caseRef, objective: wanted.objective, profileId: wanted.profileId, profileVersion: wanted.profileVersion,
        skillId: wanted.skillId, skillVersion: wanted.skillVersion, manifestDigest: wanted.manifestDigest,
        outputSchemaVersion: wanted.outputSchemaVersion, requestedOperationScope: wanted.requestedOperationScope }
      frozen = new Map(fields.map((field) => [field, field.value]))
      runRef = undefined; lastState = undefined; cancelKey = undefined; uncertain = false; blocked = false; form.dataset.dirty = 'true'
      void start(selection, request, model)
    })
    retry.addEventListener('click', () => {
      if (!live(form) || retry.disabled) return
      if (pending) void start()
      else void refresh()
    })
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
    form.dataset.sfForecastReady = 'true'
  }
})()
`
