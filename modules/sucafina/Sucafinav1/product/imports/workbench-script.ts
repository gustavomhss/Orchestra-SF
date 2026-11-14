/** Human-only transport: no skill/provider result can call Apply or supply a destination. */
export const importWorkbenchScript = `
(() => {
  const root = document.querySelector('[data-import-workbench]'); if (!root) return
  const form = root.querySelector('form'); const select = form.elements.namedItem('target'); const apply = root.querySelector('[data-apply]')
  const cancel = root.querySelector('[data-cancel]'); const refresh = root.querySelector('[data-repreview]'); const find = root.querySelector('[data-find]')
  const status = root.querySelector('[role=status]'); const context = root.querySelector('[data-context]'); const impact = root.querySelector('[data-impact]')
  const receiptRetry = root.querySelector('[data-receipt-retry]')
  const changes = root.querySelector('[data-changes]'); const receipt = root.querySelector('[data-receipt]'); const surface = document.body.dataset.surface
  let targets = []; let fileRef; let manifest; let busy = false; let generation = 0; let reviewed = false
  let admitKey = crypto.randomUUID(); let previewKey = crypto.randomUUID(); let applyKey = crypto.randomUUID()
  const endpoint = (mode) => { const url = new URL(location.href); url.search = ''; url.searchParams.set('sf', mode); return url }
  const line = (parent, text, tag = 'p') => { const element = document.createElement(tag); element.textContent = text; parent.append(element); return element }
  const request = async (url, options) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options }); const result = await response.json()
    if (!response.ok || result.status !== 'ok') { const error = new Error(result.status || 'unavailable'); error.state = result.status; throw error }
    return result.value
  }
  const post = (mode, value, key) => request(endpoint(mode), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(value) })
  const lock = (value) => { busy = value; root.querySelectorAll('input, select, form button, [data-find]').forEach((entry) => { entry.disabled = value }); cancel.disabled = value || !manifest; refresh.disabled = value || !targets.length; apply.disabled = value || !reviewed || manifest?.state !== 'preview'; receiptRetry.disabled = value || !manifest }
  const clear = () => { generation++; fileRef = undefined; manifest = undefined; reviewed = false; apply.disabled = true; cancel.disabled = true; receiptRetry.disabled = true; context.replaceChildren(); impact.replaceChildren(); changes.replaceChildren(); receipt.replaceChildren(); admitKey = crypto.randomUUID(); previewKey = crypto.randomUUID(); applyKey = crypto.randomUUID() }
  const failure = (error) => {
    apply.disabled = true
    if (error.state === 'denied') { clear(); status.textContent = 'Access changed. The previous preview is no longer available.'; return }
    if (error.state === 'stale' || error.state === 'conflict') { if (manifest) manifest.state = 'stale'; status.textContent = 'The source or authority changed. Your file and options are preserved. Refresh the destination and review a new preview.'; return }
    status.textContent = manifest?.domainApplied ? 'Import confirmed, but the receipt detail is unavailable. Use Refresh receipt to read the confirmed result.' : 'The operation could not be confirmed. Your file and options are preserved. Retry the same action to reconcile its result.'
  }
  const show = (entry) => entry?.state === 'absent' ? 'Absent' : entry?.state === 'undefined' ? 'Unspecified' : entry?.state === 'present' ? entry.value === null ? 'Empty' : typeof entry.value === 'object' ? JSON.stringify(entry.value) : String(entry.value) : 'Unavailable'
  const drawDetail = (result) => {
    changes.replaceChildren(); line(changes, 'Item and field changes', 'h2')
    for (const kind of ['added', 'changed', 'removed', 'unchanged', 'ignored', 'rejected']) {
      const entries = result.detail.changes.filter((entry) => entry.kind === kind)
      const group = document.createElement('details'); line(group, kind + ' (' + entries.length + ')', 'summary')
      if (!entries.length) line(group, 'None')
      entries.forEach((entry) => {
        const item = document.createElement('details'); line(item, entry.path, 'summary')
        line(item, show(entry.before) + ' → ' + show(entry.after))
        line(item, entry.source.kind === 'file' ? entry.source.sheet + ' · row ' + entry.source.row + ', column ' + entry.source.column + ' · ' + entry.source.address : 'Domain source: ' + entry.source.reference)
        if (entry.reason) line(item, entry.reason)
        if (kind === 'ignored' || kind === 'rejected') line(item, 'This item will not be applied.')
        group.append(item)
      }); changes.append(group)
    }
    receipt.replaceChildren()
    if (result.receipt) {
      line(receipt, result.receipt.outcome === 'rejected' ? 'Rejected import receipt' : 'Confirmed receipt', 'h2'); line(receipt, 'Outcome: ' + result.receipt.outcome + ' · Changed fields: ' + result.receipt.changedFields)
      line(receipt, 'Receipt: ' + result.receipt.receiptId); line(receipt, 'Manifest: ' + result.receipt.manifestId)
      for (const entry of manifest?.receipts || []) line(receipt, 'Actor: ' + entry.principalRef + ' · Version: ' + entry.version + ' · ' + entry.at)
    }
  }
  const readDetail = async () => { const url = endpoint('import-detail'); url.searchParams.set('manifestId', manifest.id); url.searchParams.set('version', String(manifest.version)); return request(url) }
  const readReference = async () => { const url = endpoint('import-reference'); url.searchParams.set('importPreviewRef', manifest.id); return request(url) }
  const referenceMessage = (result) => result.receipt?.outcome === 'rejected'
    ? 'Import rejected. No domain changes were applied. Refresh the destination before preparing another preview.'
    : manifest.domainApplied ? 'Confirmed receipt refreshed under your current access.'
    : manifest.state === 'preview' ? 'Analysis refers to this simulation. Review the same file changes and issues before explicitly applying.'
    : 'This preview is no longer applicable. Refresh the destination and review a new preview.'
  const draw = (result) => {
    context.replaceChildren(); impact.replaceChildren()
    line(context, result.receipt?.outcome === 'rejected' ? 'Import rejected · no domain changes applied' : manifest.domainApplied ? 'Confirmed import' : 'Simulation · no domain changes applied', 'h2')
    line(context, manifest.context.period.start + ' – ' + manifest.context.period.end + ' · Currency: ' + manifest.context.currency)
    manifest.baseIdentity.forEach((base) => line(context, base.type + ' ' + base.id + ' · Version ' + base.version + ' · ' + base.period.start + ' – ' + base.period.end))
    line(impact, 'Domain impact', 'h2')
    manifest.commands.forEach((command) => {
      const projection = command.preview; line(impact, projection.engineVersion + ' · Version ' + projection.version)
      projection.components.forEach((component) => line(impact, component.id + ': ' + (component.amount === null ? 'Unavailable' : component.amount) + ' ' + component.currency + ' · ' + component.evidenceState))
      projection.values.forEach((value) => line(impact, value.id + ': ' + (value.value === null ? 'Unavailable' : value.value) + (value.unit ? ' ' + value.unit : '') + ' · ' + value.evidenceState))
      projection.missing.forEach((entry) => line(impact, entry.field + ': ' + entry.reason))
    })
    manifest.issues.forEach((issue) => line(impact, 'Not applied / review required: row ' + issue.row + ' · ' + issue.field + ' · ' + issue.reason))
    drawDetail(result)
    reviewed = manifest.state === 'preview' && result.receipt?.outcome !== 'rejected'
  }
  const syncOptions = () => { const label = root.querySelector('[data-replace-option]'); if (label) label.hidden = !['All Members', 'Projects Import', 'All Projects'].includes(select.value === '' ? undefined : targets[Number(select.value)]?.sheet) }
  form.addEventListener('change', () => { if (!busy) { clear(); syncOptions(); status.textContent = 'File or options changed. Prepare a new preview.' } })
  root.querySelectorAll('[data-period-start], [data-period-end]').forEach((entry) => entry.addEventListener('change', () => { clear(); targets = []; select.replaceChildren(); status.textContent = 'Find destinations for the selected period.' }))
  const discover = async () => {
    const start = root.querySelector('[data-period-start]').value; const end = root.querySelector('[data-period-end]').value
    if (!!start !== !!end) { status.textContent = 'Choose both period dates.'; return }
    const url = endpoint('import-targets'); url.searchParams.set('surface', surface)
    if (start) { url.searchParams.set('start', start); url.searchParams.set('end', end) }
    clear(); lock(true); status.textContent = 'Finding authorized destinations…'
    try {
      targets = await request(url); select.replaceChildren(); const empty = line(select, 'Choose a destination', 'option'); empty.value = ''
      targets.forEach((target, index) => { const option = line(select, target.label + (target.period ? ' · ' + target.period.start + ' – ' + target.period.end : ''), 'option'); option.value = String(index) }); syncOptions()
      status.textContent = targets.length ? 'Choose the destination. Your file and options are preserved.' : 'No authorized destination is available.'
    } catch (error) { targets = []; select.replaceChildren(); failure(error) } finally { lock(false) }
  }
  find.addEventListener('click', () => { if (!busy) discover() }); refresh.addEventListener('click', () => { if (!busy) discover() })
  cancel.addEventListener('click', () => { if (busy) return; clear(); status.textContent = 'Preview cancelled. Nothing was applied; your file and options are preserved.' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !form.reportValidity()) return
    const target = targets[Number(select.value)]; const file = form.elements.namedItem('file').files[0]; const format = file?.name.split('.').pop()?.toLowerCase()
    if (!target || !file || !target.formats.includes(format)) { status.textContent = 'Choose a supported file for this destination.'; return }
    const options = { newVersion: form.elements.namedItem('newVersion')?.checked === true, removeMissing: form.elements.namedItem('removeMissing')?.checked === true, preview: { ...(target.sheet ? { sheet: target.sheet } : {}), ...(['All Members', 'Projects Import', 'All Projects'].includes(target.sheet) ? { replace: form.elements.namedItem('replace')?.checked === true } : {}) } }
    const current = generation; reviewed = false; lock(true); status.textContent = 'Preparing impact preview…'
    try {
      if (!fileRef) { const body = new FormData(); body.set('file', file); body.set('surface', target.surface); body.set('selectionRef', target.selectionRef); body.set('options', JSON.stringify(options)); fileRef = await request(endpoint('import-admit'), { method: 'POST', headers: { 'Idempotency-Key': admitKey }, body }) }
      const prepared = await post('import-preview', { admittedFileRef: fileRef.ref, format, options: options.preview }, previewKey)
      if (current !== generation) return
      manifest = prepared; draw(await readDetail()); status.textContent = 'Review the simulation, including ignored and rejected items. Apply requires your explicit action.'
    } catch (error) { failure(error) } finally { lock(false) }
  })
  apply.addEventListener('click', async () => {
    if (busy || !reviewed || manifest?.state !== 'preview') return
    lock(true); status.textContent = 'Applying the reviewed import…'
    try {
      manifest = await post('import-apply', { manifestId: manifest.id, version: manifest.version }, applyKey)
      if (!manifest.domainApplied || manifest.state !== 'applied') throw new Error('unconfirmed')
      const result = await readDetail(); drawDetail(result)
      context.replaceChildren(); line(context, 'Confirmed import', 'h2'); line(context, manifest.context.period.start + ' – ' + manifest.context.period.end + ' · ' + manifest.context.currency)
      status.textContent = result.receipt?.outcome === 'unchanged' ? 'No domain changes were needed. The confirmed receipt is available.' : 'Import applied. Review the confirmed receipt.'
    } catch (error) {
      if (manifest && !manifest.domainApplied && error.state !== 'stale' && error.state !== 'conflict') {
        try {
          const result = await readReference(); manifest = result.manifest; draw(result)
          if (result.receipt) { status.textContent = referenceMessage(result); return }
        } catch (readError) { if (readError.state === 'denied') { failure(readError); return } }
      }
      failure(error)
    } finally { lock(false) }
  })
  const previewRef = new URL(location.href).searchParams.get('importPreviewRef')
  receiptRetry.addEventListener('click', async () => {
    if (busy || !manifest) return
    lock(true)
    try { const result = await readReference(); manifest = result.manifest; draw(result); status.textContent = referenceMessage(result) } catch (error) { failure(error) } finally { lock(false) }
  })
  if (previewRef) {
    lock(true); status.textContent = 'Revalidating the preview referenced by the analysis…'
    const url = endpoint('import-reference'); url.searchParams.set('importPreviewRef', previewRef)
    request(url).then((result) => {
      manifest = result.manifest; draw(result)
      status.textContent = referenceMessage(result)
    }).catch(failure).finally(() => lock(false))
  }
})()
`
