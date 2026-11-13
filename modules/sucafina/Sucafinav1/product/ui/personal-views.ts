import { esc } from "../../src/screen-shell.ts"
import { sfViewQueryAllowed, sfViewSelectionKeys } from "../interface/personal-views.ts"

/** Page identity comes from the authorized document, never from a stored URL. */
export function personalViewsWidget(context?: { surface: string; page: string }) {
  const enriched = context && (context.surface === "dashboard" || context.surface === "planner" || context.surface === "procurement") ? { ...context, allowed: sfViewSelectionKeys(context.surface, context.page), queryAllowed: sfViewQueryAllowed(context.surface, context.page) } : undefined
  return `<section data-personal-views${enriched ? ` data-context="${esc(JSON.stringify(enriched))}"` : ""}><style>html[data-sf-density="compact"] .content th,html[data-sf-density="compact"] .content td{padding-block:.25rem}html[data-sf-density="compact"] .content section{margin-block:.5rem}</style><h2>Saved views</h2><p role="status" aria-live="polite">Loading saved views…</p><ul data-view-list></ul>${enriched ? `<label>Display density<select data-view-density><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><form data-save-view><label>View name<input name="title" maxlength="120" required></label><button>Save this page and filters</button></form><button type="button" data-preferred>Use this page as my starting page</button>` : ""}</section>`
}

export const personalViewsScript = `
document.querySelectorAll('[data-personal-views]').forEach((section) => {
  if (section.dataset.sfViewsReady) return; section.dataset.sfViewsReady = 'true'
  const status = section.querySelector('[role=status]'); const list = section.querySelector('[data-view-list]')
  const context = section.dataset.context ? JSON.parse(section.dataset.context) : undefined
  let entries = []
  const capture = () => {
    const params = new URL(location.href).searchParams
    if ([...params.keys()].some((key) => key !== 'page' && key !== 'view' && !context.allowed.includes(key) && !(key === 'q' && context.queryAllowed)) || [...params.keys()].some((key) => params.getAll(key).length !== 1)) throw new Error('unsupported-context')
    const selections = Object.fromEntries(context.allowed.filter((key) => params.has(key)).map((key) => [key, params.get(key)]))
    return { ...(Object.keys(selections).length ? { selections } : {}), ...(params.has('q') ? { query: params.get('q') } : {}) }
  }
  const send = async (action, input, key = crypto.randomUUID()) => {
    const url = new URL(location.href); url.search = '?sf=workbench-views'
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ action, input }) })
    const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value
  }
  const open = async (id) => {
    try {
      const record = await send('open', { id }); const view = record.view
      if (view.currency) { status.textContent = 'This view has a currency context that cannot be restored here. Save a new view to update it.'; return }
      if (!['dashboard', 'planner', 'procurement'].includes(view.surface) || typeof view.page !== 'string') throw new Error('invalid')
      const url = new URL(location.href); url.pathname = url.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/' + view.surface); url.search = ''; url.searchParams.set('page', view.page); url.hash = ''
      if (view.filters?.selections) Object.entries(view.filters.selections).forEach(([key, value]) => url.searchParams.set(key, value))
      if (typeof view.filters?.query === 'string') url.searchParams.set('q', view.filters.query)
      if (view.period) {
        const start = /^(\\d{4})-(\\d{2})-01$/.exec(view.period.start); const end = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(view.period.end)
        const monthly = view.surface === 'dashboard' ? { 'Executive Dashboard': ['execYear', 'executiveMonth'], 'IT Operations': ['opsYear', 'operationsMonth'], 'IT Security KPIs': ['secYear', 'securityMonth'] }[view.page] : undefined
        const wholeMonth = start && end && start[1] === end[1] && start[2] === end[2] && Number(end[3]) === new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()
        const wholeYear = start && end && start[1] === end[1] && start[2] === '01' && end[2] === '12' && end[3] === '31'
        if (!start || !end || monthly && !wholeMonth || !monthly && !wholeYear) { status.textContent = 'This view has a period that cannot be restored on this page.'; return }
        const values = monthly ? [[monthly[0], start[1]], [monthly[1], String(Number(start[2]))]] : [['year', start[1]]]
        if (values.some(([key, value]) => url.searchParams.has(key) && url.searchParams.get(key) !== value)) { status.textContent = 'This view has conflicting period settings.'; return }
        values.forEach(([key, value]) => url.searchParams.set(key, value))
      }
      url.searchParams.set('view', view.id)
      location.assign(url)
    } catch { status.textContent = 'This view is unavailable or your access changed.' }
  }
  const load = async () => {
    try {
      entries = await send('list', {}); list.replaceChildren(); const visible = entries.filter((entry) => !entry.view.id.startsWith('preferred-')); status.textContent = visible.length ? '' : 'No saved views yet.'
      visible.forEach((entry) => {
        const row = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.view.title; button.addEventListener('click', () => open(entry.view.id))
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + entry.view.title)
        remove.addEventListener('click', async () => { remove.disabled = true; try { await send('remove', { id: entry.view.id, expectedVersion: entry.version }); await load() } catch { status.textContent = 'Could not remove the view. Refresh and try again.'; remove.disabled = false } })
        row.append(button, ' · ' + entry.view.surface + ' ', remove); list.append(row)
      })
      const currentId = new URL(location.href).searchParams.get('view')
      if (context && currentId) {
        try { const current = await send('open', { id: currentId }); if (current.view.surface !== context.surface || current.view.page !== context.page) throw new Error('invalid'); const density = current.view.density ?? 'comfortable'; section.querySelector('[data-view-density]').value = density; document.documentElement.dataset.sfDensity = density }
        catch { delete document.documentElement.dataset.sfDensity; status.textContent = 'Saved view unavailable or access changed.' }
      }
      if (context && !location.search && !location.hash) { const preferred = entries.find((entry) => entry.view.id === 'preferred-' + context.surface); if (preferred && (preferred.view.page !== context.page || preferred.view.filters || preferred.view.period || preferred.view.currency || preferred.view.density)) await open(preferred.view.id) }
    } catch { list.replaceChildren(); status.textContent = 'Saved views are unavailable.' }
  }
  const form = section.querySelector('[data-save-view]')
  if (form && context) {
    const density = section.querySelector('[data-view-density]'); density.addEventListener('change', () => { document.documentElement.dataset.sfDensity = density.value })
    let key = crypto.randomUUID(); let id = crypto.randomUUID()
    form.addEventListener('input', () => { key = crypto.randomUUID(); id = crypto.randomUUID(); form.dataset.dirty = 'true' })
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!form.reportValidity()) return
      let filters; try { filters = capture() } catch { status.textContent = 'This page contains a filter that cannot yet be saved. Your view name is preserved.'; return }
      const button = form.querySelector('button'); const title = form.querySelector('[name=title]'); button.disabled = true; title.disabled = true
      try { await send('save', { view: { id, title: title.value.trim(), surface: context.surface, page: context.page, density: density.value, ...(Object.keys(filters).length ? { filters } : {}) }, expectedVersion: null }, key); title.value = ''; delete form.dataset.dirty; key = crypto.randomUUID(); id = crypto.randomUUID(); await load() }
      catch { status.textContent = 'Could not confirm the save. Your view name is preserved; retry the same request.' }
      finally { button.disabled = false; title.disabled = false }
    })
    section.querySelector('[data-preferred]').addEventListener('click', async (event) => {
      let filters; try { filters = capture() } catch { status.textContent = 'This page contains a filter that cannot yet be saved.'; return }
      const button = event.currentTarget; button.disabled = true; const id = 'preferred-' + context.surface; const existing = entries.find((entry) => entry.view.id === id)
      try { await send('save', { view: { id, title: 'Starting page', surface: context.surface, page: context.page, density: density.value, ...(Object.keys(filters).length ? { filters } : {}) }, expectedVersion: existing?.version ?? null }); status.textContent = 'Starting page saved.'; await load() }
      catch { status.textContent = 'Could not save the starting page. Refresh and try again.' }
      finally { button.disabled = false }
    })
  }
  load()
})
`
