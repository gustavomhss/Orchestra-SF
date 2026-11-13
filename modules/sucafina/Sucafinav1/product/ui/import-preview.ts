/** Import selections, previews and application remain owned by the authorized host. */
export const importPreviewWidget = `<details><summary>Import with preview</summary><section data-import-preview><p>Choose an authorized destination and review the changes before applying them.</p><label>Period start<input data-import-start type="date"></label><label>Period end<input data-import-end type="date"></label><button type="button" data-import-targets>Find destinations</button><form data-import-form><label>Destination<select name="target" required><option value="">Choose a destination</option></select></label><label>File<input name="file" type="file" accept=".xlsx,.xls,.json" required></label><label><input type="checkbox" name="newVersion">Create a new version</label><label><input type="checkbox" name="removeMissing">Remove records missing from the file</label><button type="submit">Preview import</button></form><p role="status" aria-live="polite"></p><div data-import-detail></div><button type="button" data-import-apply disabled>Apply reviewed import</button></section></details>`

export const importPreviewScript = `
document.querySelectorAll('[data-import-preview]').forEach((section) => {
  if (section.dataset.sfImportReady) return; section.dataset.sfImportReady = 'true'
  const surface = document.body.dataset.surface; if (!['dashboard', 'planner'].includes(surface)) return
  const status = section.querySelector('[role=status]'); const form = section.querySelector('[data-import-form]'); const select = form.elements.namedItem('target')
  const detail = section.querySelector('[data-import-detail]'); const apply = section.querySelector('[data-import-apply]'); const targetsButton = section.querySelector('[data-import-targets]')
  let targets = []; let admitted; let manifest; let admitKey = crypto.randomUUID(); let previewKey = crypto.randomUUID(); let applyKey = crypto.randomUUID()
  const endpoint = (mode) => { const url = new URL(location.href); url.search = ''; url.searchParams.set('sf', mode); return url }
  const json = async (url, options) => { const response = await fetch(url, { credentials: 'same-origin', ...options }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
  const post = (mode, value, key) => json(endpoint(mode), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(value) })
  const reset = () => { admitted = undefined; manifest = undefined; apply.disabled = true; detail.replaceChildren(); admitKey = crypto.randomUUID(); previewKey = crypto.randomUUID(); applyKey = crypto.randomUUID(); form.dataset.dirty = 'true' }
  form.addEventListener('change', reset)
  section.querySelectorAll('[data-import-start], [data-import-end]').forEach((input) => input.addEventListener('change', () => { targets = []; select.replaceChildren(); reset(); status.textContent = 'Find destinations for the selected period.' }))
  targetsButton.addEventListener('click', async () => {
    const url = endpoint('import-targets'); url.searchParams.set('surface', surface)
    const start = section.querySelector('[data-import-start]').value; const end = section.querySelector('[data-import-end]').value
    if (!!start !== !!end) { status.textContent = 'Choose both period dates.'; return }
    if (start) { url.searchParams.set('start', start); url.searchParams.set('end', end) }
    targetsButton.disabled = true; status.textContent = 'Finding destinations…'
    try {
      targets = await json(url); select.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a destination'; select.append(empty)
      targets.forEach((target, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = target.label + (target.period ? ' · ' + target.period.start + ' – ' + target.period.end : ''); select.append(option) })
      reset(); status.textContent = targets.length ? 'Choose a destination and file.' : 'No authorized destination is available.'
    } catch { targets = []; select.replaceChildren(); status.textContent = 'Destinations are unavailable or your access changed.' }
    finally { targetsButton.disabled = false }
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return
    const target = targets[Number(select.value)]; const file = form.elements.namedItem('file').files[0]; const format = file?.name.split('.').pop()?.toLowerCase()
    if (!target || !file || !['xlsx', 'xls', 'json'].includes(format) || !target.formats.includes(format)) { status.textContent = 'Choose a supported file for this destination.'; return }
    const options = { newVersion: form.elements.namedItem('newVersion').checked, removeMissing: form.elements.namedItem('removeMissing').checked, preview: { ...(target.sheet ? { sheet: target.sheet } : {}) } }
    const controls = section.querySelectorAll('[data-import-start], [data-import-end], form input, form select, form button'); controls.forEach((control) => { control.disabled = true }); targetsButton.disabled = true; status.textContent = 'Preparing import preview…'
    try {
      if (!admitted) { const body = new FormData(); body.set('file', file); body.set('surface', target.surface); body.set('selectionRef', target.selectionRef); body.set('options', JSON.stringify(options)); admitted = await json(endpoint('import-admit'), { method: 'POST', headers: { 'Idempotency-Key': admitKey }, body }) }
      manifest = await post('import-preview', { admittedFileRef: admitted.ref, format, options: options.preview }, previewKey)
      if (!manifest?.id || !Number.isSafeInteger(manifest.version)) throw new Error('invalid')
      const url = endpoint('import-detail'); url.searchParams.set('manifestId', manifest.id); url.searchParams.set('version', String(manifest.version))
      const result = await json(url); detail.replaceChildren()
      const heading = document.createElement('h3'); heading.textContent = 'Changes to review'; detail.append(heading)
      const display = (value) => value?.state === 'absent' ? 'Absent' : value?.state === 'undefined' ? 'Unspecified' : value?.state === 'present' ? value.value == null ? 'Empty' : ['string', 'number', 'boolean'].includes(typeof value.value) ? String(value.value) : 'Structured value' : 'Unavailable'
      result.detail.changes.forEach((change) => { const line = document.createElement('p'); const source = change.source?.sheet ? ' · ' + change.source.sheet + (change.source.address ? ' ' + change.source.address : '') : ' · Authorized source'; line.textContent = change.path + ' · ' + change.kind + ': ' + display(change.before) + ' → ' + display(change.after) + source + (change.reason ? ' · ' + change.reason : ''); detail.append(line) })
      ;(manifest.issues || []).forEach((issue) => { const line = document.createElement('p'); line.textContent = 'Row ' + issue.row + ', ' + issue.field + ': ' + issue.reason; detail.append(line) })
      status.textContent = 'Preview ' + manifest.state + '. No changes have been applied.'
      apply.disabled = manifest.state !== 'preview'
    } catch { status.textContent = 'Could not prepare or verify the preview. Your file selection is preserved; retry the same request.' }
    finally { controls.forEach((control) => { control.disabled = false }); targetsButton.disabled = false }
  })
  apply.addEventListener('click', async () => {
    if (!manifest) return
    const controls = section.querySelectorAll('[data-import-start], [data-import-end], [data-import-targets], form input, form select, form button'); controls.forEach((control) => { control.disabled = true }); apply.disabled = true; status.textContent = 'Applying reviewed import…'
    try { const result = await post('import-apply', { manifestId: manifest.id, version: manifest.version }, applyKey); if (!result.domainApplied) { status.textContent = 'Import is not fully applied. Current state: ' + result.state + '.'; return } delete form.dataset.dirty; status.textContent = 'Import applied.' }
    catch { status.textContent = 'Could not confirm application. The preview is preserved; retry the same request.'; apply.disabled = false }
    finally { controls.forEach((control) => { control.disabled = false }) }
  })
})
`
