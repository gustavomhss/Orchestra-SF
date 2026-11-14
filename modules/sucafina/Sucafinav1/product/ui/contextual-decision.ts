import { sfViewSelectionKeys } from "../interface/personal-views.ts"

/** Buttons select already rendered records; the server issues and revalidates evidence. */
export const contextualDecisionScript = `
;(() => {
  if (document.body.dataset.surface !== 'dashboard') return
  const main = document.querySelector('main[data-page="Vendor Contracts"]')
  if (!main) return
  main.querySelectorAll('tbody [id^="record-"]').forEach((anchor) => {
    if (anchor.dataset.sfDecisionReady) return; anchor.dataset.sfDecisionReady = 'true'
    const recordId = anchor.id.slice(7); if (!recordId) return
    const button = document.createElement('button'); button.type = 'button'; button.dataset.contextualDecision = recordId
    const status = document.createElement('span'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
    button.textContent = 'Create decision'; button.setAttribute('aria-label', 'Create decision for ' + (anchor.textContent.trim() || 'contract'))
    button.addEventListener('click', () => {
      if (!anchor.isConnected) return
      const current = new URL(location.href); const returnTo = new URL(current)
      const year = document.querySelector('select[data-year="sidebar"]')?.value || current.searchParams.get('year')
      if (!year || !/^202[4-7]$/.test(year)) { status.textContent = 'Choose an available year before creating a contextual decision.'; return }
      const allowed = ${JSON.stringify(["page", "q", "view", ...sfViewSelectionKeys("dashboard", "Vendor Contracts")])}
      returnTo.search = new URLSearchParams([...current.searchParams].filter(([key]) => allowed.includes(key))).toString()
      returnTo.searchParams.set('page', 'Vendor Contracts'); returnTo.searchParams.set('year', year); returnTo.hash = 'record-' + encodeURIComponent(recordId)
      const target = new URL(current); target.hash = ''; target.search = new URLSearchParams({ sf: 'workbench-context', recordId, start: year + '-01-01', end: year + '-12-31', returnTo: returnTo.pathname + returnTo.search + returnTo.hash }).toString()
      if (document.querySelector('form[data-dirty="true"]')) {
        if (!confirm('Discard unsaved changes?')) return
        document.querySelectorAll('form[data-dirty="true"]').forEach((form) => delete form.dataset.dirty)
      }
      location.assign(target)
    })
    anchor.after(document.createTextNode(' '), button, status)
  })
})();
`
