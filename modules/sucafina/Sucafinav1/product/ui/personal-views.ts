import { esc } from "../../src/screen-shell.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "../../src/nav.ts"
import { sfViewQueryAllowed, sfViewSelectionKeys } from "../interface/personal-views.ts"

/** Page identity comes from the authorized document, never from a stored URL. */
export function personalViewsWidget(context?: { surface: string; page: string }) {
  const enriched = context && (context.surface === "dashboard" || context.surface === "planner" || context.surface === "procurement") ? { ...context, allowed: sfViewSelectionKeys(context.surface, context.page), queryAllowed: sfViewQueryAllowed(context.surface, context.page) } : undefined
  return `<section data-personal-views${enriched ? ` data-context="${esc(JSON.stringify(enriched))}"` : ""}><style>html[data-sf-density="compact"] .content th,html[data-sf-density="compact"] .content td{padding-block:.25rem}html[data-sf-density="compact"] .content section{margin-block:.5rem}</style><h2>Saved views</h2><p role="status" aria-live="polite">Loading saved views…</p><ul data-view-list></ul><button type="button" data-view-refresh>Refresh saved views</button><button type="button" data-view-retry hidden>Retry same request</button>${enriched ? `<label>Display density<select data-view-density aria-label="Display density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><form data-save-view><label>View name<input name="title" maxlength="120" required></label><button>Save this page and filters</button></form><button type="button" data-preferred>Use this page as my starting page</button>` : ""}</section>`
}

const personalViewDestinations = {
  dashboard: Object.fromEntries(DASHBOARD_PAGES.map((page) => [page, { allowed: sfViewSelectionKeys("dashboard", page), queryAllowed: sfViewQueryAllowed("dashboard", page) }])),
  planner: Object.fromEntries(PLANNER_TABS.map((page) => [page, { allowed: sfViewSelectionKeys("planner", page), queryAllowed: sfViewQueryAllowed("planner", page) }])),
  procurement: Object.fromEntries(PROCUREMENT_NAV.map((page) => [page, { allowed: sfViewSelectionKeys("procurement", page), queryAllowed: sfViewQueryAllowed("procurement", page) }])),
}

/** HTTP is reauthorized by the host; this page retains only its own immutable pending intention. */
export const personalViewsScript = `
document.querySelectorAll('[data-personal-views]').forEach((section) => {
  if (section.dataset.sfViewsReady) return
  section.dataset.sfViewsReady = 'true'
  const destinations = ${JSON.stringify(personalViewDestinations)}
  const status = section.querySelector('[role=status]')
  const list = section.querySelector('[data-view-list]')
  const form = section.querySelector('[data-save-view]')
  const density = section.querySelector('[data-view-density]')
  const title = section.querySelector('[name=title]')
  const retry = section.querySelector('[data-view-retry]')
  const refresh = section.querySelector('[data-view-refresh]')
  const preferred = section.querySelector('[data-preferred]')
  let context
  try { context = section.dataset.context ? JSON.parse(section.dataset.context) : undefined } catch {}
  let entries = [], pending, busy = false, closed = false
  let generation = 0, listSequence = 0, openSequence = 0, editRevision = 0
  const requests = new Set()
  const disabled = new Map()
  const frozen = new Map()
  const current = (epoch) => !closed && section.isConnected && generation === epoch
  const controls = () => [...section.querySelectorAll('button, input, select, textarea')]
  const remember = () => {
    disabled.forEach((_, control) => { if (!section.contains(control)) disabled.delete(control) })
    controls().forEach((control) => { if (!disabled.has(control)) disabled.set(control, control.disabled) })
  }
  const present = () => {
    if (closed || !section.isConnected) return
    remember()
    controls().forEach((control) => { control.disabled = !!pending || busy || disabled.get(control) === true })
    retry.hidden = !pending
    retry.disabled = !pending || busy
  }
  const restoreFrozen = () => frozen.forEach((value, control) => {
    control.value = value
    if (control === density) document.documentElement.dataset.sfDensity = value
  })
  const close = (abort) => {
    if (closed) return
    closed = true; generation++; listSequence++; openSequence++
    if (pending) { pending.body = ''; pending.input = undefined }
    pending = undefined; entries = []; context = undefined
    controls().forEach((control) => {
      if ('value' in control) { control.value = ''; control.removeAttribute('value') }
      if ('defaultValue' in control) control.defaultValue = ''
      control.disabled = true
    })
    frozen.clear(); disabled.clear()
    delete section.dataset.context
    if (form) delete form.dataset.dirty
    delete document.documentElement.dataset.sfDensity
    const message = document.createElement('p'); message.setAttribute('role', 'status')
    message.textContent = 'Your access changed. Reload before opening or changing saved views.'
    section.replaceChildren(message)
    removeEventListener('sf-access-revoked', revoked)
    removeEventListener('pagehide', leave)
    if (abort) requests.forEach((controller) => controller.abort())
  }
  const revoked = () => close(false)
  const leave = () => close(true)
  addEventListener('sf-access-revoked', revoked)
  addEventListener('pagehide', leave)
  const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
  const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value)
  const validView = (view) => {
    if (!object(view) || Object.keys(view).some((key) => !['id', 'title', 'surface', 'page', 'period', 'currency', 'density', 'filters'].includes(key))) return false
    if (!validId(view.id) || typeof view.title !== 'string' || !view.title.trim() || view.title.length > 120) return false
    if (typeof view.surface !== 'string' || typeof view.page !== 'string' || !Object.hasOwn(destinations, view.surface) || !Object.hasOwn(destinations[view.surface], view.page)) return false
    const destination = destinations[view.surface][view.page]
    if (view.currency !== undefined && (typeof view.currency !== 'string' || !/^[A-Z]{3}$/.test(view.currency))) return false
    if (view.density !== undefined && !['comfortable', 'compact'].includes(view.density)) return false
    if (view.period !== undefined && (!object(view.period) || Object.keys(view.period).some((key) => !['start', 'end'].includes(key)) || typeof view.period.start !== 'string' || typeof view.period.end !== 'string')) return false
    if (view.filters !== undefined) {
      if (!object(view.filters) || Object.keys(view.filters).some((key) => !['query', 'selections'].includes(key))) return false
      if (view.filters.query !== undefined && (!destination.queryAllowed || typeof view.filters.query !== 'string' || view.filters.query.length > 500)) return false
      if (view.filters.selections !== undefined && (!object(view.filters.selections) || Object.entries(view.filters.selections).some(([key, value]) => !destination.allowed.includes(key) || typeof value !== 'string' || value.length > 500))) return false
    }
    return true
  }
  const validRecord = (value) => object(value) && Object.keys(value).every((key) => key === 'view' || key === 'version') && validView(value.view) && Number.isSafeInteger(value.version) && value.version > 0
  const unavailable = (value) => object(value) && Object.keys(value).every((key) => ['id', 'version', 'availability'].includes(key)) && validId(value.id) && Number.isSafeInteger(value.version) && value.version > 0 && value.availability === 'unavailable'
  const canonical = (value) => JSON.stringify(value, (_, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
  const send = async (action, input, key = crypto.randomUUID(), body = JSON.stringify({ action, input })) => {
    const epoch = generation
    if (!current(epoch)) throw new Error('closed')
    const controller = new AbortController(); requests.add(controller)
    let timer
    try {
      const result = await Promise.race([
        (async () => {
          const url = new URL(location.href); url.search = '?sf=workbench-views'
          const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body, signal: controller.signal })
          if (!current(epoch)) throw new Error('closed')
          if (response.status === 401 || response.status === 403) { close(false); throw new Error('closed') }
          const value = await response.json()
          if (!current(epoch)) throw new Error('closed')
          if (value?.status === 'denied') { close(false); throw new Error('closed') }
          if (!response.ok || value?.status !== 'ok') throw new Error([400, 422].includes(response.status) && ['invalid', 'needs-input'].includes(value?.status) ? 'rejected' : 'unconfirmed')
          return value.value
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('unconfirmed')) }, 10000) }),
      ])
      if (!current(epoch)) throw new Error('closed')
      return result
    } finally { clearTimeout(timer); requests.delete(controller) }
  }
  const capture = () => {
    if (!context || !destinations[context.surface]?.[context.page]) throw new Error('unsupported-context')
    const params = new URL(location.href).searchParams
    const destination = destinations[context.surface][context.page]
    if ([...params.keys()].some((key) => key !== 'page' && key !== 'view' && !destination.allowed.includes(key) && !(key === 'q' && destination.queryAllowed)) || [...params.keys()].some((key) => params.getAll(key).length !== 1)) throw new Error('unsupported-context')
    const selections = Object.fromEntries(destination.allowed.filter((key) => params.has(key)).map((key) => [key, params.get(key)]))
    return { ...(Object.keys(selections).length ? { selections } : {}), ...(params.has('q') ? { query: params.get('q') } : {}) }
  }
  const open = async (id) => {
    if (closed || pending || busy) return
    const epoch = generation, sequence = ++openSequence
    try {
      const record = await send('open', { id })
      if (!current(epoch) || sequence !== openSequence || pending) return
      if (!validRecord(record) || record.view.id !== id) throw new Error('invalid')
      const view = record.view
      if (view.currency) { status.textContent = 'This view has a currency context that cannot be restored here. Save a new view to update it.'; return }
      const url = new URL(location.href); url.pathname = url.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/' + view.surface); url.search = ''; url.hash = ''
      url.searchParams.set('page', view.page)
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
      url.searchParams.set('view', view.id)
      const dirty = [...document.querySelectorAll('form[data-dirty]')]
      if (dirty.length && !confirm('Discard unsaved changes before opening this saved view?')) return
      if (!current(epoch) || sequence !== openSequence || pending) return
      dirty.forEach((item) => { delete item.dataset.dirty })
      try { location.assign(url) } catch (error) { dirty.forEach((item) => { item.dataset.dirty = 'true' }); throw error }
    } catch { if (current(epoch) && sequence === openSequence) status.textContent = 'This view is unavailable or your access changed.' }
  }
  const render = () => {
    list.replaceChildren()
    const visible = entries.filter((entry) => !(entry.view?.id || entry.id).startsWith('preferred-'))
    visible.forEach((entry) => {
      const row = document.createElement('li')
      if (unavailable(entry)) { row.textContent = 'A saved view is unavailable.'; list.append(row); return }
      const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.view.title
      button.addEventListener('click', () => { void open(entry.view.id) })
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + entry.view.title)
      remove.addEventListener('click', () => {
        if (closed || pending || busy) return
        begin('remove', 'remove', { id: entry.view.id, expectedVersion: entry.version })
      })
      row.append(button, ' · ' + entry.view.surface + ' ', remove); list.append(row)
    })
    present()
    return visible.length
  }
  const load = async () => {
    if (closed || pending || busy) return
    const epoch = generation, sequence = ++listSequence, opening = openSequence, editing = editRevision
    try {
      const value = await send('list', {})
      if (!current(epoch) || sequence !== listSequence || pending) return
      if (!Array.isArray(value) || value.some((entry) => !validRecord(entry) && !unavailable(entry))) throw new Error('invalid')
      entries = value
      status.textContent = render() ? '' : 'No saved views yet.'
      const currentId = new URL(location.href).searchParams.get('view')
      if (context && currentId && density) {
        try {
          const selected = await send('open', { id: currentId })
          if (!current(epoch) || sequence !== listSequence || opening !== openSequence || editing !== editRevision || pending || form?.dataset.dirty) return
          if (!validRecord(selected) || selected.view.id !== currentId || selected.view.surface !== context.surface || selected.view.page !== context.page) throw new Error('invalid')
          density.value = selected.view.density ?? 'comfortable'
          document.documentElement.dataset.sfDensity = density.value
        } catch {
          if (current(epoch) && sequence === listSequence && opening === openSequence && editing === editRevision && !pending && !form?.dataset.dirty) {
            delete document.documentElement.dataset.sfDensity; status.textContent = 'Saved view unavailable or access changed.'
          }
        }
      }
      if (current(epoch) && sequence === listSequence && opening === openSequence && editing === editRevision && context && !location.search && !location.hash) {
        const starting = entries.find((entry) => validRecord(entry) && entry.view.id === 'preferred-' + context.surface)
        if (starting && (starting.view.page !== context.page || starting.view.filters || starting.view.period || starting.view.currency || starting.view.density)) await open(starting.view.id)
      }
    } catch {
      if (current(epoch) && sequence === listSequence && !pending) { entries = []; list.replaceChildren(); status.textContent = 'Saved views are unavailable.' }
    }
  }
  const mutate = async () => {
    if (!pending || busy || closed) return
    const attempt = pending, epoch = generation
    busy = true; restoreFrozen(); present()
    status.textContent = 'Saving the view change…'
    try {
      const value = await send(attempt.action, attempt.input, attempt.key, attempt.body)
      if (!current(epoch) || pending !== attempt) return
      const acknowledged = attempt.action === 'remove'
        ? object(value) && Object.keys(value).length === 1 && value.removed === true
        : validRecord(value) && value.version === (attempt.input.expectedVersion ?? 0) + 1 && canonical(value.view) === canonical(attempt.input.view)
      if (!acknowledged) throw new Error('unconfirmed')
      const id = attempt.action === 'remove' ? attempt.input.id : attempt.input.view.id
      entries = entries.filter((entry) => (entry.view?.id || entry.id) !== id)
      if (attempt.action === 'save') entries.push(value)
      listSequence++; openSequence++
      if (attempt.kind === 'save' && form && title) { title.value = ''; delete form.dataset.dirty }
      attempt.body = ''; attempt.input = undefined
      pending = undefined; frozen.clear()
      render()
      status.textContent = attempt.kind === 'remove' ? 'Saved view removed.' : attempt.kind === 'preferred' ? 'Starting page saved.' : 'View saved.'
    } catch (error) {
      if (!current(epoch) || pending !== attempt) return
      if (error.message === 'rejected' && !attempt.uncertain) {
        attempt.body = ''; attempt.input = undefined; pending = undefined; frozen.clear()
        status.textContent = 'The view change was rejected. Correct it and try again.'
      } else {
        attempt.uncertain = true
        status.textContent = 'The previous change is unconfirmed. Retry the same request to reconcile it before editing.'
      }
    } finally {
      if (current(epoch)) { busy = false; present() }
    }
  }
  const begin = (kind, action, input) => {
    if (closed || pending || busy) return
    listSequence++; openSequence++
    pending = { kind, action, input, body: JSON.stringify({ action, input }), key: crypto.randomUUID(), uncertain: false }
    frozen.clear()
    controls().filter((control) => 'value' in control).forEach((control) => frozen.set(control, control.value))
    void mutate()
  }
  retry.addEventListener('click', () => { void mutate() })
  refresh.addEventListener('click', () => { void load() })
  if (form && context && density && title && preferred) {
    const edited = () => {
      if (closed) return
      if (pending || busy) { restoreFrozen(); return }
      editRevision++; form.dataset.dirty = 'true'
      document.documentElement.dataset.sfDensity = density.value
    }
    form.addEventListener('input', edited)
    density.addEventListener('change', edited)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (closed || pending || busy || !form.reportValidity()) return
      let filters
      try { filters = capture() } catch { status.textContent = 'This page contains a filter that cannot yet be saved. Your view name is preserved.'; return }
      begin('save', 'save', { view: { id: crypto.randomUUID(), title: title.value.trim(), surface: context.surface, page: context.page, density: density.value, ...(Object.keys(filters).length ? { filters } : {}) }, expectedVersion: null })
    })
    preferred.addEventListener('click', () => {
      if (closed || pending || busy) return
      let filters
      try { filters = capture() } catch { status.textContent = 'This page contains a filter that cannot yet be saved.'; return }
      const id = 'preferred-' + context.surface
      const existing = entries.find((entry) => (entry.view?.id || entry.id) === id)
      begin('preferred', 'save', { view: { id, title: 'Starting page', surface: context.surface, page: context.page, density: density.value, ...(Object.keys(filters).length ? { filters } : {}) }, expectedVersion: existing?.version ?? null })
    })
  }
  present()
  void load()
})
`
