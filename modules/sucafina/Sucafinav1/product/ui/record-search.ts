import { esc } from "../../src/screen-shell.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "../../src/nav.ts"

/** Search consumes the same authorized HTML as the pages; it has no snapshot/state access. */
export function recordSearchWidget(surface: string) {
  return `<section data-record-search><h2>Find a record</h2><p>Search the records available in an application. Results keep the page, period and version used for the search.</p><form data-record-search-form><label>Application<select name="surface">${([["dashboard", "Dashboard"], ["planner", "Budget Planner"], ["procurement", "Procurement"]] as const).map(([value, label]) => `<option value="${value}"${value === surface ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label>Record name or value<input name="query" type="search" required maxlength="120"></label><button type="submit">Find records</button></form><p role="status" aria-live="polite"></p><ul data-record-results></ul></section>`
}

export const recordSearchScript = `
;(() => {
  const focusRecord = (force = false) => {
    if (!location.hash) return
    const canonical = location.hash.startsWith('#record-')
    let id; try { id = decodeURIComponent(location.hash.slice(canonical ? 8 : 1)) } catch { return }
    const form = [...document.querySelectorAll('form[data-record]')].find((node) => node.dataset.record === id)
    const anchor = document.getElementById(canonical ? 'record-' + id : id)
    if (!canonical && (document.body.dataset.surface !== 'procurement' || anchor?.tagName !== 'DETAILS' || !anchor.querySelector('form[data-record]'))) return
    const row = canonical ? [...document.querySelectorAll('[data-sf-record]')].find((node) => node.dataset.sfRecord === id) || anchor?.closest('tr, article, details') || form?.closest('tr, article, details') || anchor || form : anchor
    if (!row) return
    if (!force && row.dataset.sfRecordFocused === location.hash) return
    row.dataset.sfRecordFocused = location.hash
    if (row.tagName === 'DETAILS') row.open = true
    for (let parent = row.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true
    row.tabIndex = -1; row.focus({ preventScroll: true }); row.scrollIntoView({ block: 'center' })
  }
  focusRecord()
  const pages = ${JSON.stringify({ dashboard: DASHBOARD_PAGES, planner: PLANNER_TABS, procurement: PROCUREMENT_NAV })}
  document.querySelectorAll('[data-record-search]').forEach((section) => {
    if (section.dataset.ready) return; section.dataset.ready = 'true'
    addEventListener('hashchange', () => { if (section.isConnected) focusRecord(true) })
    const form = section.querySelector('form'); const status = section.querySelector('[role=status]'); const list = section.querySelector('[data-record-results]')
    let generation = 0; let controller
    const clear = () => { generation++; controller?.abort(); list.replaceChildren(); status.textContent = '' }
    form.addEventListener('input', clear)
    addEventListener('pagehide', clear)
    addEventListener('sf-access-revoked', clear)
    const search = async () => {
      clear(); const token = generation; controller = new AbortController(); const signal = controller.signal
      const query = form.elements.query.value.trim(); const surface = form.elements.surface.value
      if (!query || !pages[surface]) return
      history.replaceState({ ...history.state, sfRecordSearch: { query, surface } }, '')
      const base = new URL(location.href); const sameSurface = base.pathname.endsWith('/' + surface)
      base.pathname = base.pathname.replace(/\\/(dashboard|planner|procurement)$/, '/' + surface); base.hash = ''
      const selected = new URLSearchParams()
      if (sameSurface) ['year', 'version', 'own', 'execYear', 'opsYear', 'secYear', 'month', 'executiveMonth', 'operationsMonth', 'securityMonth', 'opsMonth'].forEach((key) => { if (base.searchParams.has(key)) selected.set(key, base.searchParams.get(key)) })
      base.search = selected.toString()
      const current = () => token === generation && section.isConnected && !signal.aborted
      let revision; let incomplete = false
      const read = async (url) => {
        const reader = new AbortController(); const abort = () => reader.abort(); signal.addEventListener('abort', abort, { once: true })
        const timeout = setTimeout(abort, 12000)
        try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: reader.signal })
        if (!current()) throw new Error('superseded')
        if (response.status === 401 || response.status === 403) throw new Error('access-changed')
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('unavailable')
        const html = new DOMParser().parseFromString(await response.text(), 'text/html')
        if (!current()) throw new Error('superseded')
        if (!html.querySelector('main[data-drawn="true"]') || html.body.dataset.surface !== surface) throw new Error('access-changed')
        const nextRevision = response.headers.get('X-SF-Access-Revision') || html.querySelector('meta[name="sf-access-revision"]')?.content
        if (revision && nextRevision && revision !== nextRevision) throw new Error('access-changed')
        if (nextRevision) revision = nextRevision
        return html
        } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
      }
      const withContext = (html, url) => {
        const resolved = new URL(url)
        const keys = ['year', 'version', 'execYear', 'opsYear', 'secYear', 'executiveMonth', 'operationsMonth', 'securityMonth', 'opsMonth']
        html.querySelectorAll('select[data-query], form[method="get"] input[name], form[method="get"] select[name]').forEach((control) => {
          const key = control.dataset.query || control.name
          if (keys.includes(key) && control.value) resolved.searchParams.set(key, control.value)
        })
        return resolved
      }
      const pageNames = (html) => [...new Set([...html.querySelectorAll('.sidebar nav a[data-index]')].map((link) => new URL(link.getAttribute('href'), base).searchParams.get('page')).filter((page) => pages[surface].includes(page)))]
      status.textContent = 'Searching available records…'
      try {
        const first = await read(base)
        base.search = withContext(first, base).search
        const available = pageNames(first)
        const results = new Map(); let index = 0
        const consume = (html, url) => {
          html.querySelectorAll('main tbody tr').forEach((row) => {
            const record = row.dataset.sfRecord || row.querySelector('[id^="record-"]')?.id.slice(7) || [...row.querySelectorAll('form[data-record]')].map((node) => node.dataset.record).find(Boolean)
            const cells = [...row.children].filter((cell) => !cell.classList.contains('table-action')).map((cell) => { const copy = cell.cloneNode(true); copy.querySelectorAll('form, dialog, button, script, style').forEach((node) => node.remove()); return copy.textContent.trim() }).filter(Boolean)
            const label = cells.join(' · ')
            if (!label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return
            const destination = withContext(html, url)
            if (record) destination.hash = 'record-' + encodeURIComponent(record)
            else {
              const links = [...row.querySelectorAll('a[href]')].map((link) => new URL(link.getAttribute('href'), url)).filter((link) => link.origin === url.origin && link.pathname === url.pathname && !link.searchParams.has('download'))
              const direct = links.find((link) => (link.searchParams.has('request') || link.searchParams.has('supplier')) && pages[surface].includes(link.searchParams.get('page')))
              if (direct) { for (const key of ['page', 'request', 'supplier']) if (direct.searchParams.has(key)) destination.searchParams.set(key, direct.searchParams.get(key)) }
              else {
                const page = url.searchParams.get('page')
                const parameter = surface === 'procurement' && (page === 'Suppliers' ? 'supplier' : ['Requests', 'My approvals'].includes(page) ? 'request' : undefined)
                if (!parameter) return
                const bound = links.flatMap((link) => {
                  let id; try { id = decodeURIComponent(link.hash.slice(1)) } catch { return [] }
                  const target = id && html.getElementById(id)
                  if (!target || target.tagName !== 'DETAILS') return []
                  const ids = [...new Set([...target.querySelectorAll('form[data-record]')].map((form) => form.dataset.record).filter(Boolean))]
                  return ids.length === 1 ? [{ id: ids[0], hash: link.hash }] : []
                })[0]
                if (!bound) return
                destination.searchParams.set(parameter, bound.id); destination.hash = bound.hash
              }
            }
            const plan = html.querySelector('select[name="version"]')?.selectedOptions[0]?.textContent
            const yearKey = { 'Executive Dashboard': 'execYear', 'IT Operations': 'opsYear', 'IT Security KPIs': 'secYear' }[url.searchParams.get('page')] || 'year'
            const context = [destination.searchParams.has(yearKey) ? 'Year ' + destination.searchParams.get(yearKey) : '', plan ? 'Plan ' + plan : ''].filter(Boolean).join(' · ')
            results.set(destination.href, { href: destination.href, label: label.slice(0, 260), page: url.searchParams.get('page'), pageUrl: url.href, context })
          })
        }
        const worker = async () => {
          while (index < available.length && current()) {
            const page = available[index++]; const url = new URL(base); url.searchParams.set('page', page)
            try { const html = first.querySelector('main')?.dataset.page === page ? first : await read(url); if (current()) consume(html, url) }
            catch (error) { if (error.message === 'access-changed' || error.message === 'superseded') throw error; incomplete = true }
          }
        }
        await Promise.all([worker(), worker(), worker()])
        // Entry access alone does not authorize records read from other pages. Replace each
        // contributing page with a fresh authorized projection before exposing any result.
        const contributing = [...new Set([...results.values()].map((result) => result.pageUrl))]
        for (const pageUrl of contributing) {
          const url = new URL(pageUrl); const html = await read(url)
          results.forEach((result, key) => { if (result.pageUrl === pageUrl) results.delete(key) })
          consume(html, url)
        }
        const fresh = await read(base)
        if (JSON.stringify(pageNames(fresh)) !== JSON.stringify(available)) throw new Error('access-changed')
        if (!current()) return
        results.forEach((result) => { if (list.children.length >= 100) return; const item = document.createElement('li'); const link = document.createElement('a'); link.href = result.href; link.textContent = result.label; item.append(link, ' · ' + result.page + (result.context ? ' · ' + result.context : '')); list.append(item) })
        status.textContent = incomplete ? 'Some pages are temporarily unavailable. Showing confirmed results; retry to complete the search.' : list.children.length ? (results.size > 100 ? 'Showing the first 100 results. Refine your search.' : 'Open a result to review its current record.') : 'No matching records were found in the available pages.'
      } catch (error) {
        if (!current()) return
        controller.abort(); list.replaceChildren()
        status.textContent = error.message === 'access-changed' ? 'Access changed. Results cleared; reopen the application to continue.' : 'Search is temporarily unavailable. Your search is preserved; try again.'
      }
    }
    form.addEventListener('submit', (event) => { event.preventDefault(); if (form.reportValidity()) search() })
    const previous = history.state?.sfRecordSearch
    if (previous && typeof previous.query === 'string' && pages[previous.surface]) { form.elements.query.value = previous.query; form.elements.surface.value = previous.surface; search() }
    addEventListener('pageshow', (event) => {
      // Native fragment navigation can replace the focus set while parsing. Apply
      // record focus after it settles, once per navigation rather than per mutation.
      requestAnimationFrame(() => { if (section.isConnected) focusRecord(true) })
      if (event.persisted && section.isConnected && form.elements.query.value.trim()) search()
    })
  })
})();
`
