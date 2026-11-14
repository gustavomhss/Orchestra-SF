/** Document schemas and confirmation are human actions; extraction creates candidates only. */
export const documentEvidenceWidget = `<details><summary>Extract document evidence</summary><section data-document-evidence><p>Choose an authorized document, define the fields to extract, and confirm each candidate after review.</p><p>Supported: UTF-8 text, DOCX and PDF with a text layer. Limits: 20 MiB, 500 PDF pages, 1,000,000 extracted characters, 8 MiB of expanded DOCX XML and 2,000 DOCX entries; parsing times out after 15 seconds. Installation upload limits may be lower. Scanned PDFs without text are not OCR processed.</p><button type="button" data-document-sources>Find documents</button><label>Document<select data-document-source><option value="">Choose a document</option></select></label><button type="button" data-document-admit>Open document</button><form data-document-schema><label>Field name<input name="field" required></label><label>Field type<select name="type"><option value="string">Text</option><option value="number">Number</option><option value="boolean">Yes or no</option><option value="date">Date</option></select></label><label>Unit (optional)<input name="unit"></label><button>Create extraction schema</button></form><label>Schema<select data-document-schema-list><option value="">Choose a schema</option></select></label><button type="button" data-document-extract>Extract candidates</button><p role="status" aria-live="polite"></p><div data-document-candidates></div></section></details>`

export const documentEvidenceScript = `
document.querySelectorAll('[data-document-evidence]').forEach((section) => {
  if (section.dataset.sfEvidenceReady) return; section.dataset.sfEvidenceReady = 'true'
  const status = section.querySelector('[role=status]'); const source = section.querySelector('[data-document-source]'); const schema = section.querySelector('[data-document-schema-list]'); const candidates = section.querySelector('[data-document-candidates]')
  let sources = []; let schemas = []; let documentRef; let admitKey = crypto.randomUUID(); let schemaKey = crypto.randomUUID(); let extractKey = crypto.randomUUID()
  let busy = false
  const lock = () => { if (busy) return false; busy = true; section.querySelectorAll('button, input, select').forEach((control) => { control.disabled = true }); return true }
  const unlock = () => { busy = false; section.querySelectorAll('button, input, select').forEach((control) => { control.disabled = false }) }
  const endpoint = (mode) => { const url = new URL(location.href); url.search = ''; url.searchParams.set('sf', mode); return url }
  const request = async (url, options) => { const response = await fetch(url, { credentials: 'same-origin', ...options }); const result = await response.json(); if (!response.ok || result.status !== 'ok') throw new Error('unavailable'); return result.value }
  const post = (mode, body, key) => request(endpoint(mode), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) })
  const getDocument = (mode) => { const url = endpoint(mode); url.searchParams.set('documentRef', documentRef); return request(url) }
  const refreshSchemas = async () => {
    schemas = await getDocument('document-schemas'); schema.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a schema'; schema.append(empty)
    schemas.forEach((item, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = item.fields.map((field) => field.id).join(', ') + ' · version ' + item.version; schema.append(option) })
  }
  const refreshCandidates = async () => {
    const found = await getDocument('document-candidates'); candidates.replaceChildren()
    if (!found.length) { const p = document.createElement('p'); p.textContent = 'No candidates yet.'; candidates.append(p); return }
    found.forEach((candidate) => {
      const entry = document.createElement('article'); const text = document.createElement('p')
      const value = candidate.value == null ? 'Unavailable' : ['string', 'number', 'boolean'].includes(typeof candidate.value) ? String(candidate.value) : 'Structured value'
      text.textContent = candidate.fieldCandidate + ': ' + value + (candidate.unit ? ' ' + candidate.unit : '') + ' · ' + candidate.status + ' · ' + candidate.location + ' · text positions ' + candidate.textRange.start + '–' + candidate.textRange.end; entry.append(text)
      const sourceButton = document.createElement('button'); sourceButton.type = 'button'; sourceButton.textContent = 'Open source'
      sourceButton.addEventListener('click', async () => {
        if (!lock()) return
        try { const url = endpoint('document-open'); url.searchParams.set('ref', JSON.stringify(candidate.ref)); const result = await request(url); const target = new URL(result.href, location.href); const mount = location.pathname.replace(/\\/(dashboard|planner|procurement)$/, ''); if (!result.href || target.origin !== location.origin || !target.pathname.startsWith(mount + '/')) throw new Error('invalid'); location.assign(target) }
        catch { status.textContent = 'Source unavailable or access changed.' }
        finally { unlock() }
      }); entry.append(sourceButton)
      if (candidate.status === 'extracted') {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Confirm this candidate'; let key = crypto.randomUUID()
        button.addEventListener('click', async () => { if (!lock()) return; status.textContent = 'Confirming candidate…'; try { await post('document-confirm', candidate, key); await refreshCandidates(); status.textContent = 'Candidate confirmed.' } catch { status.textContent = 'Could not confirm the candidate. Retry the same request.' } finally { unlock() } })
        entry.append(button)
      }
      candidates.append(entry)
    })
  }
  section.querySelector('[data-document-sources]').addEventListener('click', async (event) => {
    if (!lock()) return; documentRef = undefined; admitKey = crypto.randomUUID(); schemas = []; schema.replaceChildren(); candidates.replaceChildren(); status.textContent = 'Finding documents…'
    try { sources = await request(endpoint('document-sources')); source.replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a document'; source.append(empty); sources.forEach((item, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = item.label; source.append(option) }); status.textContent = sources.length ? 'Choose a document.' : 'No accessible documents.' }
    catch { status.textContent = 'Documents unavailable or access changed.' }
    finally { unlock() }
  })
  source.addEventListener('change', () => { documentRef = undefined; schemas = []; schema.replaceChildren(); candidates.replaceChildren(); admitKey = crypto.randomUUID(); extractKey = crypto.randomUUID(); form.dataset.dirty = 'true' })
  section.querySelector('[data-document-admit]').addEventListener('click', async (event) => {
    const selected = source.value === '' ? undefined : sources[Number(source.value)]; if (!selected) { status.textContent = 'Choose a document.'; return }
    if (!lock()) return; status.textContent = 'Opening document…'
    try { const admitted = await post('document-admit', { selectionRef: selected.selectionRef }, admitKey); documentRef = admitted.documentRef; await refreshSchemas(); await refreshCandidates(); status.textContent = 'Document ready for review.' }
    catch { documentRef = undefined; candidates.replaceChildren(); status.textContent = 'Document unavailable or access changed.' }
    finally { unlock() }
  })
  const form = section.querySelector('[data-document-schema]'); form.addEventListener('input', () => { schemaKey = crypto.randomUUID(); form.dataset.dirty = 'true' })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!documentRef || !form.reportValidity()) { status.textContent = 'Open a document and enter a field.'; return }
    const field = form.elements.namedItem('field').value.trim(); const unit = form.elements.namedItem('unit').value.trim(); const type = form.elements.namedItem('type').value
    if (!lock()) return; status.textContent = 'Saving schema…'
    try { await post('document-schema', { documentRef, fields: [{ id: field, type, ...(unit ? { unit } : {}) }] }, schemaKey); delete form.dataset.dirty; await refreshSchemas(); status.textContent = 'Schema saved. Select it to extract.'; schemaKey = crypto.randomUUID() }
    catch { status.textContent = 'Could not confirm the schema. Your fields are preserved; retry the same request.' }
    finally { unlock() }
  })
  schema.addEventListener('change', () => { extractKey = crypto.randomUUID() })
  section.querySelector('[data-document-extract]').addEventListener('click', async (event) => {
    const selected = schema.value === '' ? undefined : schemas[Number(schema.value)]; if (!documentRef || !selected) { status.textContent = 'Open a document and choose a schema.'; return }
    if (!lock()) return; status.textContent = 'Extracting candidates…'
    try { await post('document-extract', { documentRef, fieldSchemaRef: selected.ref }, extractKey); await refreshCandidates(); status.textContent = 'Candidates extracted. Review before confirming.'; extractKey = crypto.randomUUID() }
    catch { status.textContent = 'Extraction unavailable. Retry the same request.' }
    finally { unlock() }
  })
})
`
