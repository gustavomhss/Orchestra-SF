import { esc } from "../../src/screen-shell.ts"
import { sfViewQueryAllowed, sfViewSelectionKeys } from "../interface/personal-views.ts"

/** Page identity comes from the authorized document, never from a stored URL. */
export function personalViewsWidget(context?: { surface: string; page: string }) {
  const enriched = context && (context.surface === "dashboard" || context.surface === "planner" || context.surface === "procurement") ? { ...context, allowed: sfViewSelectionKeys(context.surface, context.page), queryAllowed: sfViewQueryAllowed(context.surface, context.page) } : undefined
  return `<section data-personal-views${enriched ? ` data-context="${esc(JSON.stringify(enriched))}"` : ""}><style>[data-view-recovery][hidden]{display:none}html[data-sf-density="compact"] .content th,html[data-sf-density="compact"] .content td{padding-block:.25rem}html[data-sf-density="compact"] .content section{margin-block:.5rem}</style><h2>Saved views</h2><p role="status" aria-live="polite">Loading saved views…</p><ul data-view-list></ul><button type="button" data-refresh-views>Refresh saved views</button><form data-view-recovery hidden><p>The previous request is unconfirmed. Retry it before changing these settings.</p><button type="submit">Retry same request</button></form>${enriched ? `<label>Display density<select data-view-density><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><form data-save-view><label>View name<input name="title" maxlength="120" required></label><button>Save this page and filters</button></form><button type="button" data-preferred>Use this page as my starting page</button>` : ""}</section>`
}

export const personalViewsScript = `
document.querySelectorAll('[data-personal-views]').forEach((section) => {
  if (section.dataset.sfViewsReady) return; section.dataset.sfViewsReady = 'true'
  const status = section.querySelector('[role=status]'); const list = section.querySelector('[data-view-list]')
  const context = section.dataset.context ? JSON.parse(section.dataset.context) : undefined
  const form = section.querySelector('[data-save-view]'); const recovery = section.querySelector('[data-view-recovery]')
  const frozen = new Map()
  let entries = []
  let pending
  let closed = false
  let epoch = 0
  let readGeneration = 0
  const active = () => !closed && section.isConnected
  const syncControls = () => {
    if (!active()) return
    if (!pending) { frozen.forEach((disabled, control) => { control.disabled = disabled }); frozen.clear(); recovery.hidden = true; delete recovery.dataset.dirty; return }
    section.querySelectorAll('input,select,button').forEach((control) => { if (recovery.contains(control)) return; if (!frozen.has(control)) frozen.set(control, control.disabled); control.disabled = true })
    recovery.hidden = !pending.uncertain
    recovery.dataset.dirty = 'true'
    recovery.querySelector('button').disabled = pending.running
  }
  const deny = () => {
    closed = true; epoch++; pending = undefined; entries = []; frozen.clear(); delete document.documentElement.dataset.sfDensity
    const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Your access changed. Reload before opening or changing saved views.'
    section.replaceChildren(message)
  }
  const capture = () => {
    const params = new URL(location.href).searchParams
    if ([...params.keys()].some((key) => key !== 'page' && key !== 'view' && !context.allowed.includes(key) && !(key === 'q' && context.queryAllowed)) || [...params.keys()].some((key) => params.getAll(key).length !== 1)) throw new Error('unsupported-context')
    const selections = Object.fromEntries(context.allowed.filter((key) => params.has(key)).map((key) => [key, params.get(key)]))
    return { ...(Object.keys(selections).length ? { selections } : {}), ...(params.has('q') ? { query: params.get('q') } : {}) }
  }
  const send = async (action, input, key = crypto.randomUUID(), body = JSON.stringify({ action, input })) => {
    const ticket = epoch
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const url = new URL(location.href); url.search = '?sf=workbench-views'
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body, signal: controller.signal })
      if (!active()) return { kind: 'ignored' }
      if (response.status === 401 || response.status === 403) { deny(); return { kind: 'denied' } }
      if (ticket !== epoch) return { kind: 'ignored' }
      const result = await response.json()
      if (!active() || ticket !== epoch) return { kind: 'ignored' }
      if (!response.ok) return { kind: response.status < 500 && response.status !== 408 && ['invalid', 'needs-input', 'conflict'].includes(result?.status) ? 'rejected' : 'uncertain', status: response.status }
      return result?.status === 'ok' ? { kind: 'ok', value: result.value } : { kind: 'uncertain' }
    } catch { return { kind: active() && ticket === epoch ? 'uncertain' : 'ignored' } }
    finally { clearTimeout(timeout) }
  }
  const open = async (id, automatic = false) => {
    if (!active() || pending) return
    const generation = ++readGeneration
    const result = await send('open', { id })
    if (!active() || pending || generation !== readGeneration || result.kind === 'ignored') return
    if (result.kind !== 'ok' || !result.value?.view) { status.textContent = 'This view is unavailable or your access changed. Refresh saved views to choose another.'; return }
    const view = result.value.view
    if (view.currency) { status.textContent = 'This view has a currency context that cannot be restored here. Save a new view to update it.'; return }
    if (!['dashboard', 'planner', 'procurement'].includes(view.surface) || typeof view.page !== 'string' || typeof view.id !== 'string') { status.textContent = 'This view has an invalid destination. Refresh saved views.'; return }
    const url = new URL(location.href); url.pathname = url.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/' + view.surface); url.search = ''; url.searchParams.set('page', view.page); url.hash = ''
    if (view.filters?.selections) Object.entries(view.filters.selections).forEach(([key, value]) => url.searchParams.set(key, value))
    if (typeof view.filters?.query === 'string') url.searchParams.set('q', view.filters.query)
    if (view.period) {
      const start = /^(\\d{4})-(\\d{2})-01$/.exec(view.period.start); const end = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(view.period.end)
      const monthly = view.surface === 'dashboard' ? { 'Executive Dashboard': ['execYear', 'executiveMonth'], 'IT Operations': ['opsYear', 'operationsMonth'], 'IT Security KPIs': ['secYear', 'securityMonth'] }[view.page] : undefined
      const wholeMonth = start && end && start[1] === end[1] && start[2] === end[2] && Number(end[3]) === new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()
      const wholeYear = start && end && start[1] === end[1] && start[2] === '01' && end[2] === '12' && end[3] === '31'
      if (!start || !end || !/^202[4-7]$/.test(start[1]) || monthly && !wholeMonth || !monthly && !wholeYear) { status.textContent = 'This view has a period that cannot be restored on this page.'; return }
      const values = monthly ? [[monthly[0], start[1]], [monthly[1], String(Number(start[2]))]] : [['year', start[1]]]
      if (values.some(([key, value]) => url.searchParams.has(key) && url.searchParams.get(key) !== value)) { status.textContent = 'This view has conflicting period settings.'; return }
      values.forEach(([key, value]) => url.searchParams.set(key, value))
    }
    if (document.querySelector('form[data-dirty]')) {
      if (automatic || !window.confirm('Discard unsaved changes and open this saved view?')) return
      document.querySelectorAll('form[data-dirty]').forEach((draft) => delete draft.dataset.dirty)
    }
    url.searchParams.set('view', view.id)
    location.assign(url)
  }
  const load = async (preserveStatus = false) => {
    if (!active() || pending) return
    const generation = ++readGeneration
    const result = await send('list', {})
    if (!active() || pending || generation !== readGeneration || result.kind === 'ignored') return
    if (result.kind !== 'ok' || !Array.isArray(result.value) || result.value.some((entry) => !entry?.view || typeof entry.view.id !== 'string' || typeof entry.view.title !== 'string' || typeof entry.version !== 'number')) { list.replaceChildren(); status.textContent = 'Saved views are unavailable. Refresh saved views to try again.'; return }
    entries = result.value; list.replaceChildren(); const visible = entries.filter((entry) => !entry.view.id.startsWith('preferred-'))
    if (!preserveStatus) status.textContent = visible.length ? '' : 'No saved views yet.'
    visible.forEach((entry) => {
      const row = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.view.title; button.addEventListener('click', () => void open(entry.view.id))
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + entry.view.title)
      remove.addEventListener('click', () => void write('remove', 'remove', { id: entry.view.id, expectedVersion: entry.version }))
      row.append(button, ' · ' + entry.view.surface + ' ', remove); list.append(row)
    })
    const currentId = new URL(location.href).searchParams.get('view')
    if (context && currentId && !preserveStatus && !form?.dataset.dirty) {
      const current = await send('open', { id: currentId })
      if (!active() || pending || generation !== readGeneration || current.kind === 'ignored' || form?.dataset.dirty) return
      if (current.kind !== 'ok' || current.value?.view?.surface !== context.surface || current.value?.view?.page !== context.page) { delete document.documentElement.dataset.sfDensity; status.textContent = 'Saved view unavailable or access changed.'; return }
      const density = current.value.view.density ?? 'comfortable'
      section.querySelector('[data-view-density]').value = density; document.documentElement.dataset.sfDensity = density
    }
    if (context && !location.search && !location.hash) { const preferred = entries.find((entry) => entry.view.id === 'preferred-' + context.surface); if (preferred && (preferred.view.page !== context.page || preferred.view.filters || preferred.view.period || preferred.view.currency || preferred.view.density)) await open(preferred.view.id, true) }
  }
  const perform = async () => {
    if (!active() || !pending || pending.running) return
    const attempt = pending; attempt.running = true; syncControls(); status.textContent = attempt.uncertain ? 'Checking the same request…' : 'Saving view settings…'
    const result = await send(attempt.action, undefined, attempt.key, attempt.body)
    if (!active() || pending !== attempt) return
    attempt.running = false
    if (result.kind === 'ok' && (attempt.action === 'remove' ? result.value?.removed === true : result.value?.view?.id === attempt.viewId && Number.isSafeInteger(result.value?.version) && result.value.version > 0)) {
      pending = undefined; epoch++; syncControls()
      if (attempt.kind === 'save') { form.querySelector('[name=title]').value = ''; delete form.dataset.dirty }
      status.textContent = attempt.kind === 'remove' ? 'Saved view removed.' : attempt.kind === 'preferred' ? 'Starting page saved.' : 'View saved.'
      await load(true)
      return
    }
    if (result.kind === 'rejected' && !attempt.uncertain) {
      pending = undefined; epoch++; syncControls()
      status.textContent = result.status === 409 ? 'The saved view changed. Refresh saved views, review your entries and try again.' : 'The view change was rejected. Review the page and fields before trying again.'
      return
    }
    if (result.kind === 'ignored') return
    attempt.uncertain = true; syncControls()
    status.textContent = 'The previous change is unconfirmed. Settings are locked to that request; retry the same request before making another change.'
  }
  const write = async (kind, action, input) => {
    if (!active() || pending) return
    epoch++
    pending = { kind, action, viewId: input.view?.id, key: crypto.randomUUID(), body: JSON.stringify({ action, input }), uncertain: false, running: false }
    await perform()
  }
  recovery.addEventListener('submit', (event) => { event.preventDefault(); void perform() })
  section.querySelector('[data-refresh-views]').addEventListener('click', () => void load())
  if (form && context) {
    const density = section.querySelector('[data-view-density]')
    density.addEventListener('change', () => { if (!pending && active()) { document.documentElement.dataset.sfDensity = density.value; form.dataset.dirty = 'true' } })
    form.addEventListener('input', () => { if (!pending && active()) form.dataset.dirty = 'true' })
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!active() || pending || !form.reportValidity()) return
      let filters; try { filters = capture() } catch { status.textContent = 'This page contains a filter that cannot yet be saved. Your view name is preserved.'; return }
      await write('save', 'save', { view: { id: crypto.randomUUID(), title: form.querySelector('[name=title]').value.trim(), surface: context.surface, page: context.page, density: density.value, ...(Object.keys(filters).length ? { filters } : {}) }, expectedVersion: null })
    })
    section.querySelector('[data-preferred]').addEventListener('click', async () => {
      if (!active() || pending) return
      let filters; try { filters = capture() } catch { status.textContent = 'This page contains a filter that cannot yet be saved.'; return }
      const id = 'preferred-' + context.surface; const existing = entries.find((entry) => entry.view.id === id)
      await write('preferred', 'save', { view: { id, title: 'Starting page', surface: context.surface, page: context.page, density: density.value, ...(Object.keys(filters).length ? { filters } : {}) }, expectedVersion: existing?.version ?? null })
    })
  }
  void load()
})
`
