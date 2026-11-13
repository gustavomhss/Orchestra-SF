/** Mounted into the real Planner document after its authorized rows have rendered. */
export const plannerMonthlyScript = `
document.querySelectorAll('table').forEach((table) => {
  const forms = [...table.querySelectorAll('form[data-command="save"][data-record][data-version]')].filter((form) =>
    ['OPEX', 'CAPEX'].includes(form.dataset.page) && form.querySelector('[name=versionId]') && form.querySelector('[name=collection][value=lines]') && form.querySelector('[name=b0], [name=a0], [name=f0]') && !form.querySelector('button[type=submit]:disabled'))
  if (!forms.length) return
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
  const instructions = document.createElement('p'); instructions.textContent = 'Paste a range of values into the grid. Preview before saving.'
  const scroll = document.createElement('div'); scroll.className = 'table-scroll'
  const grid = document.createElement('table'); scroll.append(grid)
  const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = 'Preview changes'
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save changes'; save.disabled = true
  const status = document.createElement('div'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  const dirtyGuard = document.createElement('form'); dirtyGuard.hidden = true
  const changes = new Map()
  let key = crypto.randomUUID()
  let busy = false
  let approved = false
  const idFor = (row, kind, month) => JSON.stringify([row, kind, month])
  const update = (input) => {
    const id = idFor(input.dataset.row, input.dataset.measure, Number(input.dataset.month))
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
        input.type = 'text'; input.inputMode = 'decimal'; input.setAttribute('aria-label', row.label + ' ' + kind + ' month ' + (index + 1))
        input.dataset.row = row.id; input.dataset.measure = kind; input.dataset.month = String(index + 1); input.dataset.rowIndex = String(rowIndex); input.dataset.original = row.values[prefix + index] ?? ''
        input.value = changes.get(idFor(row.id, kind, index + 1))?.text ?? input.dataset.original
        input.disabled = !!row.saved || !Object.hasOwn(row.values, prefix + index)
        input.addEventListener('input', () => update(input))
        input.addEventListener('paste', (event) => {
          const text = event.clipboardData?.getData('text/plain')
          if (!text || !/[\\t\\r\\n]/.test(text)) return
          event.preventDefault()
          const pasted = text.replace(/\\r\\n/g, '\\n').replace(/\\n$/, '').split('\\n').map((line) => line.split('\\t'))
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
    if (busy || !changes.size) return
    const drafts = rows.flatMap((row) => { const cells = [...changes.values()].filter((cell) => cell.rowId === row.id).map(({ measure, month, text }) => ({ measure, month, text })); return cells.length ? [{ rowId: row.id, revision: row.revision, cells }] : [] })
    const url = new URL(location.href); url.search = '?sf=workbench-planner'
    busy = true; preview.disabled = true; save.disabled = true; measure.disabled = true; grid.querySelectorAll('input').forEach((input) => { input.disabled = true }); status.textContent = action === 'preview' ? 'Checking changes…' : 'Saving changes…'
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ action, input: { page, versionId, drafts } }) })
      const result = await response.json()
      if (!response.ok || result.status !== 'ok' || !Array.isArray(result.value?.rows)) throw new Error('unavailable')
      const problems = result.value.rows.filter((row) => row.errors.length || !row.result?.ok)
      if (action === 'apply') result.value.rows.filter((row) => !row.errors.length && row.result?.ok).forEach((row) => { const saved = rows.find((entry) => entry.id === row.draft.rowId); if (saved) saved.saved = true; for (const [id, cell] of changes) if (cell.rowId === row.draft.rowId) changes.delete(id) })
      if (!changes.size) delete dirtyGuard.dataset.dirty
      status.replaceChildren()
      const message = document.createElement('p'); message.textContent = problems.length ? 'Some rows need attention. Your entries remain in the grid.' : action === 'preview' ? 'Preview complete. Review the entries and save when ready.' : 'Changes saved. Refresh before editing these rows again.'; status.append(message)
      problems.forEach((item) => { const row = rows.find((entry) => entry.id === item.draft.rowId); const detail = document.createElement('p'); detail.textContent = (row?.label || 'Row') + ': ' + (item.errors.some((error) => error.reason === 'row-unavailable') ? 'Row unavailable or changed.' : item.result?.status === 409 ? 'Changed by another user. Refresh and compare before retrying.' : 'Check the values and your access.'); status.append(detail) })
      problems.filter((item) => item.result?.status === 409).forEach((item) => item.draft.cells.forEach((cell) => {
        const stored = item.result.stored; const prefix = cell.measure === 'budget' ? 'b' : cell.measure === 'actual' ? 'a' : 'f'
        const current = stored && Array.isArray(stored[prefix]) ? stored[prefix][cell.month - 1] : undefined
        const detail = document.createElement('p'); detail.textContent = cell.measure + ' month ' + cell.month + ': current ' + (current === undefined ? 'unavailable' : current === null ? 'empty' : String(current)) + '; your entry ' + cell.text; status.append(detail)
      }))
      approved = action === 'preview' && !problems.length
      if (action === 'apply') { approved = false; key = crypto.randomUUID() }
    } catch { status.textContent = 'Could not confirm the operation. Your entries are preserved; retry the same request.' }
    finally { busy = false; preview.disabled = false; measure.disabled = false; save.disabled = !approved; render() }
  }
  preview.addEventListener('click', () => send('preview'))
  save.addEventListener('click', () => send('apply'))
  measure.addEventListener('change', render)
  window.addEventListener('beforeunload', (event) => { if (changes.size) { event.preventDefault(); event.returnValue = '' } })
  section.append(heading, label, instructions, scroll, preview, save, status, dirtyGuard)
  table.closest('.table-scroll')?.before(section)
  render()
})
`
