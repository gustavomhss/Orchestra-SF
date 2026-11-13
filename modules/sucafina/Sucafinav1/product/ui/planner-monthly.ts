/** Mounted into the real Planner document after its authorized rows have rendered. */
export const plannerMonthlyScript = `
document.querySelectorAll('table').forEach((table) => {
  if (table.dataset.sfMonthlyReady) return
  const forms = [...table.querySelectorAll('form[data-command="save"][data-record][data-version]')].filter((form) =>
    ['OPEX', 'CAPEX'].includes(form.dataset.page) && form.querySelector('[name=versionId]') && form.querySelector('[name=collection][value=lines]') && form.querySelector('[name=b0], [name=a0], [name=f0]') && !form.querySelector('button[type=submit]:disabled'))
  if (!forms.length) return
  table.dataset.sfMonthlyReady = 'true'
  const page = forms[0].dataset.page
  const versionId = forms[0].querySelector('[name=versionId]').value
  const records = new Map()
  forms.forEach((form) => {
    if (form.dataset.page !== page || form.querySelector('[name=versionId]').value !== versionId) return
    const id = form.dataset.record
    const row = form.closest('tr')
    const existing = records.get(id) || { id, revision: Number(form.dataset.version), label: [...row.querySelectorAll(':scope > td')].slice(0, 2).map((cell) => cell.textContent.trim()).join(' · '), values: {} }
    if (existing.revision !== Number(form.dataset.version)) return
    form.querySelectorAll('input[name]').forEach((input) => { if (!input.disabled && /^[baf](?:[0-9]|1[01])$/.test(input.name)) existing.values[input.name] = input.value })
    records.set(id, existing)
  })
  const rows = [...records.values()]
  if (!rows.length) return
  const section = document.createElement('section')
  const heading = document.createElement('h2'); heading.textContent = 'Edit monthly values together'
  const label = document.createElement('label'); label.textContent = 'Measure '
  const measure = document.createElement('select'); measure.setAttribute('aria-label', 'Measure')
  ;[['budget', 'Budget'], ['actual', 'Actual'], ['forecast', 'Forecast']].forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; measure.append(option) })
  label.append(measure)
  const instructions = document.createElement('p'); instructions.textContent = 'Use Tab to move between cells. Paste a range with Ctrl or Command V; a range that does not fit is refused without changing cells. Preview before saving.'
  const scroll = document.createElement('div'); scroll.className = 'table-scroll'
  const grid = document.createElement('table'); scroll.append(grid)
  const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = 'Preview changes'
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save changes'; save.disabled = true
  const status = document.createElement('div'); status.id = 'monthly-status-' + crypto.randomUUID(); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  const dirtyGuard = document.createElement('form'); dirtyGuard.hidden = true
  const changes = new Map()
  const invalidCells = new Set()
  let key = crypto.randomUUID()
  let busy = false
  let approved = false
  let pendingApply
  let monthlyUncertain = false
  let reconciliationRequired = false
  let accessRevoked = false
  const revoke = () => { accessRevoked = true; const scope = table.closest('main') || section; const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = 'Your Planner access changed. Reload this page with your current access.'; scope.replaceChildren(message); if (scope === section) table.closest('.table-scroll')?.remove(); delete dirtyGuard.dataset.dirty }
  const idFor = (row, kind, month) => JSON.stringify([row, kind, month])
  const update = (input) => {
    const id = idFor(input.dataset.row, input.dataset.measure, Number(input.dataset.month))
    if (accessRevoked || busy || monthlyUncertain) { input.value = changes.get(id)?.text ?? input.dataset.original; return }
    invalidCells.delete(id); input.removeAttribute('aria-invalid')
    if (input.value === input.dataset.original) changes.delete(id)
    else changes.set(id, { rowId: input.dataset.row, measure: input.dataset.measure, month: Number(input.dataset.month), text: input.value })
    if (changes.size) dirtyGuard.dataset.dirty = 'true'; else delete dirtyGuard.dataset.dirty
    key = crypto.randomUUID(); approved = false; save.disabled = true
    status.textContent = changes.size ? changes.size + ' changed cells. Preview before saving.' : 'No pending changes.'
  }
  const render = () => {
    grid.replaceChildren()
    const head = grid.createTHead().insertRow(); ['Record', ...Array.from({ length: 12 }, (_, i) => String(i + 1))].forEach((text) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; head.append(th) })
    const body = grid.createTBody()
    rows.forEach((row, rowIndex) => {
      const tr = body.insertRow(); const title = document.createElement('th'); title.scope = 'row'; title.textContent = row.label; tr.append(title)
      Array.from({ length: 12 }, (_, index) => {
        const td = tr.insertCell(); const input = document.createElement('input'); const kind = measure.value; const prefix = kind === 'budget' ? 'b' : kind === 'actual' ? 'a' : 'f'
        input.type = 'text'; input.inputMode = 'decimal'; input.setAttribute('aria-label', row.label + ' ' + kind + ' month ' + (index + 1)); input.setAttribute('aria-describedby', status.id)
        input.dataset.row = row.id; input.dataset.measure = kind; input.dataset.month = String(index + 1); input.dataset.rowIndex = String(rowIndex); input.dataset.original = row.values[prefix + index] ?? ''
        input.value = changes.get(idFor(row.id, kind, index + 1))?.text ?? input.dataset.original
        input.disabled = busy || monthlyUncertain || !!row.saved || !Object.hasOwn(row.values, prefix + index)
        if (invalidCells.has(idFor(row.id, kind, index + 1))) input.setAttribute('aria-invalid', 'true')
        input.addEventListener('input', () => update(input))
        input.addEventListener('paste', (event) => {
          const text = event.clipboardData?.getData('text/plain')
          if (!text || !/[\\t\\r\\n]/.test(text)) return
          event.preventDefault()
          const pasted = text.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').replace(/\\n$/, '').split('\\n').map((line) => line.split('\\t'))
          if (rowIndex + pasted.length > rows.length || pasted.some((line, down) => index + line.length > 12 || line.some((_, across) => { const target = grid.querySelector('input[data-row-index="' + (rowIndex + down) + '"][data-month="' + (index + across + 1) + '"]'); return !target || target.disabled }))) { status.textContent = 'The pasted range does not fit the available editable cells.'; return }
          pasted.forEach((line, down) => line.forEach((value, across) => {
            const target = grid.querySelector('input[data-row-index="' + (rowIndex + down) + '"][data-month="' + (index + across + 1) + '"]')
            if (target) { target.value = value; update(target) }
          }))
        })
        td.append(input)
      })
    })
  }
  const send = async (action) => {
    if (accessRevoked || reconciliationRequired || busy || !changes.size || (action === 'preview' && monthlyUncertain) || (action === 'apply' && !approved && !pendingApply)) return
    const reconciling = monthlyUncertain
    const drafts = rows.flatMap((row) => { const cells = [...changes.values()].filter((cell) => cell.rowId === row.id).map(({ measure, month, text }) => ({ measure, month, text })); return cells.length ? [{ rowId: row.id, revision: row.revision, cells }] : [] })
    if (action === 'apply' && !pendingApply) pendingApply = { key, body: JSON.stringify({ action, input: { page, versionId, drafts } }) }
    const request = pendingApply || { key, body: JSON.stringify({ action, input: { page, versionId, drafts } }) }
    const url = new URL(location.href); url.search = '?sf=workbench-planner'
    busy = true; freeze(true); status.textContent = action === 'preview' ? 'Checking changes…' : 'Saving changes…'
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.key }, body: request.body, signal: controller.signal })
      if (response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true })
      const result = await response.json()
      if (!response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'stale', 'conflict'].includes(result.status) })
      if (!Array.isArray(result.value?.rows) || result.value.rows.length !== drafts.length || new Set(result.value.rows.map((item) => item.draft?.rowId)).size !== drafts.length || result.value.rows.some((item) => { const draft = drafts.find((entry) => entry.rowId === item.draft?.rowId); return !draft || !Array.isArray(item.errors) || item.draft.revision !== draft.revision || !Array.isArray(item.draft.cells) || item.draft.cells.length !== draft.cells.length || item.draft.cells.some((cell, index) => cell.measure !== draft.cells[index].measure || cell.month !== draft.cells[index].month || cell.text !== draft.cells[index].text) })) throw new Error('unavailable')
      invalidCells.clear()
      const problems = result.value.rows.filter((row) => row.errors.length || !row.result?.ok)
      if (action === 'apply' && (!reconciling || !problems.length)) result.value.rows.filter((row) => !row.errors.length && row.result?.ok).forEach((row) => { const saved = rows.find((entry) => entry.id === row.draft.rowId); if (saved) { saved.saved = true; row.draft.cells.forEach((cell) => { const prefix = cell.measure === 'budget' ? 'b' : cell.measure === 'actual' ? 'a' : 'f'; saved.values[prefix + (cell.month - 1)] = cell.text }) } for (const [id, cell] of changes) if (cell.rowId === row.draft.rowId) changes.delete(id) })
      if (!changes.size) delete dirtyGuard.dataset.dirty
      status.replaceChildren()
      const message = document.createElement('p'); message.textContent = problems.length ? 'Some rows need attention. Your entries remain in the grid.' : action === 'preview' ? 'Preview complete. Review the entries and save when ready.' : 'Changes saved. Refresh before editing these rows again.'; status.append(message)
      problems.forEach((item) => { const row = rows.find((entry) => entry.id === item.draft.rowId); const detail = document.createElement('p'); detail.textContent = (row?.label || 'Row') + ': ' + (item.errors.some((error) => error.reason === 'row-unavailable') ? 'Row unavailable or changed.' : item.result?.status === 409 ? reconciling ? 'The stored row changed. Compare it with your original save attempt.' : 'Changed by another user. Refresh and compare before retrying.' : 'Check the values and your access.'); status.append(detail) })
      problems.forEach((item) => item.errors.forEach((error) => {
        if (!error.cell) return
        invalidCells.add(idFor(item.draft.rowId, error.cell.measure, error.cell.month))
        const row = rows.find((entry) => entry.id === item.draft.rowId); const labels = { 'invalid-number': 'Enter a valid number.', 'budget-requires-value': 'Budget requires a value.', 'invalid-month': 'Month is invalid.', 'duplicate-cell': 'The same cell appears twice.' }
        const detail = document.createElement('p'); detail.textContent = (row?.label || 'Row') + ' · ' + error.cell.measure + ' · month ' + error.cell.month + ': ' + (labels[error.reason] || 'Check this value.'); status.append(detail)
      }))
      problems.filter((item) => item.result?.status === 409).forEach((item) => item.draft.cells.forEach((cell) => {
        const stored = item.result.stored; const prefix = cell.measure === 'budget' ? 'b' : cell.measure === 'actual' ? 'a' : 'f'
        const current = stored && Array.isArray(stored[prefix]) ? stored[prefix][cell.month - 1] : undefined
        const detail = document.createElement('p'); detail.textContent = cell.measure + ' month ' + cell.month + ': current ' + (current === undefined ? 'unavailable' : current === null ? 'empty' : String(current)) + '; your entry ' + cell.text; status.append(detail)
      }))
      approved = action === 'preview' && !problems.length
      if (action === 'apply' && reconciling && problems.length) { reconciliationRequired = true; const warning = document.createElement('p'); warning.textContent = 'The retry could not reconcile the earlier save. Its outcome is still uncertain. Your original entries remain locked; reconcile the stored record before starting another change.'; status.append(warning); return }
      if (action === 'apply') { approved = false; pendingApply = undefined; monthlyUncertain = false; key = crypto.randomUUID() }
    } catch (error) { if (error?.accessDenied) { revoke(); return } if (error?.rejected) { if (reconciling) { reconciliationRequired = true; status.textContent = 'The retry was rejected but the earlier save is still unconfirmed. Your original entries remain locked; reconcile the stored record before starting another change.'; return } monthlyUncertain = false; pendingApply = undefined; approved = false; key = crypto.randomUUID(); status.textContent = 'The request was rejected. Your entries are preserved; review the values and current record before previewing again.'; return } monthlyUncertain = action === 'apply'; status.textContent = action === 'apply' ? 'Could not confirm the operation. Your entries are preserved and locked; retry the same save request.' : 'Could not confirm the preview. Your entries are preserved; retry the preview.' }
    finally { clearTimeout(timeout); busy = false; if (!accessRevoked) { freeze(monthlyUncertain); save.disabled = reconciliationRequired || !(monthlyUncertain || approved); render() } }
  }
  preview.addEventListener('click', () => send('preview'))
  save.addEventListener('click', () => send('apply'))
  measure.addEventListener('change', () => { if (!measure.disabled) render() })
  const guidance = document.createElement('p'); guidance.textContent = 'This grid saves monthly values. For annual budgets, spread and reset, use the actions available on each record below.'
  const freeze = (locked) => { measure.disabled = locked; preview.disabled = locked; save.disabled = locked || !approved; if (locked) grid.querySelectorAll('input').forEach((input) => { input.disabled = true }); else render() }
  section.append(heading, label, instructions, guidance, scroll, preview, save, status, dirtyGuard)
  table.closest('.table-scroll')?.before(section)
  render()
})
`

