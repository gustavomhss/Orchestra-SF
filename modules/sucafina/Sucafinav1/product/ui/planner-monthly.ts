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
  let operationBusy = false; let operationUncertain = false
  const revoke = () => { accessRevoked = true; const scope = table.closest('main') || section; const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = 'Your Planner access changed. Reload this page with your current access.'; scope.replaceChildren(message); if (scope === section) table.closest('.table-scroll')?.remove(); delete dirtyGuard.dataset.dirty }
  const idFor = (row, kind, month) => JSON.stringify([row, kind, month])
  const update = (input) => {
    const id = idFor(input.dataset.row, input.dataset.measure, Number(input.dataset.month))
    if (accessRevoked || busy || monthlyUncertain || operationBusy || operationUncertain) { input.value = changes.get(id)?.text ?? input.dataset.original; return }
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
        input.disabled = busy || monthlyUncertain || operationBusy || operationUncertain || !!row.saved || !Object.hasOwn(row.values, prefix + index)
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
    if (accessRevoked || reconciliationRequired || busy || operationBusy || operationUncertain || !changes.size || (action === 'preview' && monthlyUncertain) || (action === 'apply' && !approved && !pendingApply)) return
    const reconciling = monthlyUncertain
    const drafts = rows.flatMap((row) => { const cells = [...changes.values()].filter((cell) => cell.rowId === row.id).map(({ measure, month, text }) => ({ measure, month, text })); return cells.length ? [{ rowId: row.id, revision: row.revision, cells }] : [] })
    if (action === 'apply' && !pendingApply) pendingApply = { key, body: JSON.stringify({ action, input: { page, versionId, drafts } }) }
    const request = pendingApply || { key, body: JSON.stringify({ action, input: { page, versionId, drafts } }) }
    const url = new URL(location.href); url.search = '?sf=workbench-planner'
    busy = true; freeze(true); status.textContent = action === 'preview' ? 'Checking changes…' : 'Saving changes…'
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.key }, body: request.body })
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
    finally { busy = false; if (!accessRevoked) { freeze(monthlyUncertain); save.disabled = reconciliationRequired || !(monthlyUncertain || approved); render() } }
  }
  preview.addEventListener('click', () => send('preview'))
  save.addEventListener('click', () => send('apply'))
  measure.addEventListener('change', () => { if (!measure.disabled) render() })
  const recordLabel = document.createElement('label'); recordLabel.textContent = 'Budget record '; const recordSelect = document.createElement('select'); recordSelect.setAttribute('aria-label', 'Budget record'); rows.forEach((row, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = row.label; recordSelect.append(option) }); recordLabel.append(recordSelect)
  const annualInput = document.createElement('input'); annualInput.type = 'text'; annualInput.inputMode = 'decimal'; annualInput.setAttribute('aria-label', 'Annual budget')
  const applyBudget = document.createElement('button'); applyBudget.type = 'button'; applyBudget.textContent = 'Apply budget change'; applyBudget.disabled = true
  const budgetStatus = document.createElement('div'); budgetStatus.setAttribute('role', 'status'); budgetStatus.setAttribute('aria-live', 'polite')
  const budgetButtons = []; let operationKey = crypto.randomUUID(); let operationApproved = false; let pending = null
  const phrases = { 'row-unavailable': 'This row changed or is unavailable.', 'invalid-revision': 'This row cannot be saved as shown.', 'invalid-annual': 'Enter a valid annual amount.', 'operation-rejected': 'The change was not accepted.', 'operation-unavailable': 'The change could not be checked.' }
  const amount = (cell) => !cell || cell.value === null ? 'empty' : typeof cell.value === 'number' && Number.isFinite(cell.value) ? String(cell.value) : 'unavailable'
  const annualValue = () => { const text = annualInput.value.trim(); return text !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined }
  const freeze = (locked) => { recordSelect.disabled = locked; annualInput.disabled = locked; measure.disabled = locked; budgetButtons.forEach((button) => { button.disabled = locked }); preview.disabled = locked; save.disabled = locked || !approved; if (locked) { applyBudget.disabled = true; grid.querySelectorAll('input').forEach((input) => { input.disabled = true }) } else render() }
  const invalidate = () => { if (operationBusy || operationUncertain || busy || monthlyUncertain) return; pending = null; operationApproved = false; applyBudget.disabled = true; operationKey = crypto.randomUUID() }
  recordSelect.addEventListener('change', invalidate); annualInput.addEventListener('input', () => { invalidate(); dirtyGuard.dataset.dirty = 'true' })
  const runBudget = async (action, request) => {
    if (accessRevoked || operationBusy || busy || monthlyUncertain || request !== pending || (action === 'apply' && !operationApproved)) return
    const reconciling = operationUncertain
    operationBusy = true; freeze(true); budgetStatus.textContent = action === 'preview' ? 'Checking the budget change…' : 'Saving the budget change…'
    try {
      const url = new URL(location.href); url.search = '?sf=workbench-planner'
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey }, body: JSON.stringify({ action, input: request }) })
      if (response.status === 401 || response.status === 403) throw Object.assign(new Error('access-changed'), { accessDenied: true })
      const result = await response.json()
      if (!response.ok || result.status !== 'ok') throw Object.assign(new Error('unavailable'), { rejected: [400, 409, 422].includes(response.status) && ['invalid', 'needs-input', 'stale', 'conflict'].includes(result.status) })
      const operation = result?.value?.operation
      if (request !== pending) return
      if (!response.ok || result.status !== 'ok' || !operation || !Array.isArray(operation.errors) || !Array.isArray(operation.before) || !Array.isArray(operation.after) || !Array.isArray(operation.changedMonths)) throw new Error('unavailable')
      budgetStatus.replaceChildren()
      operation.errors.forEach((reason) => { const line = document.createElement('p'); line.textContent = phrases[reason] || 'Check this budget change.'; budgetStatus.append(line) })
      operation.changedMonths.forEach((month) => { const line = document.createElement('p'); line.textContent = (rows.find((entry) => entry.id === request.operation.rowId)?.label || 'This row') + ', month ' + month + ': current ' + amount(operation.before.find((cell) => cell.month === month)) + ', proposed ' + amount(operation.after.find((cell) => cell.month === month)); budgetStatus.append(line) })
      if (action === 'apply' && reconciling && operation.errors.length) { operationApproved = false; const warning = document.createElement('p'); warning.textContent = 'The retry could not reconcile the earlier budget change. Its outcome is still uncertain. Reconcile the stored record before starting another change.'; budgetStatus.append(warning); return }
      operationUncertain = false
      const applied = action === 'apply' && operation.errors.length === 0
      operationApproved = action === 'preview' && request === pending && operation.errors.length === 0
      if (applied) { const line = document.createElement('p'); line.textContent = 'Budget change saved. Refresh before editing these months again.'; budgetStatus.append(line); pending = null; if (!changes.size) delete dirtyGuard.dataset.dirty }
      else if (action === 'apply') { const line = document.createElement('p'); line.textContent = 'The budget change was not saved. Your monthly entries remain.'; budgetStatus.append(line) }
      else if (!operation.changedMonths.length && !operation.errors.length) { const line = document.createElement('p'); line.textContent = 'Preview complete. No monthly budget change was returned.'; budgetStatus.append(line) }
      if (action === 'apply') { operationApproved = false; operationKey = crypto.randomUUID() }
    } catch (error) { if (error?.accessDenied) { revoke(); return } if (error?.rejected) { if (reconciling) { operationApproved = false; budgetStatus.textContent = 'The retry was rejected but the earlier budget change is still unconfirmed. Reconcile the stored record before starting another change.'; return } operationUncertain = false; operationApproved = false; pending = null; operationKey = crypto.randomUUID(); budgetStatus.textContent = 'The budget request was rejected. Your entries are preserved; review the current record before previewing again.'; return } if (request === pending) { operationUncertain = action === 'apply'; operationApproved = action === 'apply'; budgetStatus.textContent = action === 'apply' ? 'Could not confirm the budget change. Your monthly entries are preserved; retry the same request.' : 'Could not confirm the preview. Your monthly entries are preserved.' } }
    finally { operationBusy = false; if (!accessRevoked) { freeze(operationUncertain); applyBudget.disabled = !(operationApproved && request === pending) } }
  }
  ;[['annual', 'Preview annual budget'], ['spread', 'Preview spread'], ['reset', 'Preview reset']].forEach(([kind, text]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; budgetButtons.push(button); button.addEventListener('click', () => { if (operationBusy || operationUncertain || busy || monthlyUncertain) return; const row = rows[Number(recordSelect.value)]; const annual = annualValue(); if (!row || (kind === 'annual' && annual === undefined)) { operationApproved = false; applyBudget.disabled = true; budgetStatus.textContent = 'Choose a record and enter an annual amount.'; return } operationKey = crypto.randomUUID(); operationApproved = false; applyBudget.disabled = true; pending = { page, versionId, operation: { rowId: row.id, revision: row.revision, kind, ...(kind === 'annual' ? { annual } : {}) } }; runBudget('preview', pending) }); section.append(button) })
  applyBudget.addEventListener('click', () => { if (operationBusy || !operationApproved || !pending) return; runBudget('apply', pending) })
  section.append(heading, label, instructions, scroll, preview, save, recordLabel, annualInput, applyBudget, budgetStatus, status, dirtyGuard)
  table.closest('.table-scroll')?.before(section)
  render()
})
`

