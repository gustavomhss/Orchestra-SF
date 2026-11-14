import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"
import { decisionFormContext, decisionScriptHelpers } from "./decision-alternatives.ts"

/** Discovery yields authorized evidence; the existing case command validates every saved reference. */
export function decisionEditForm(projection: AuthorizedCaseProjection) {
  const item = projection.case
  const context = { ...decisionFormContext(projection), criteria: item.criteria.map((criterion) => ({ id: criterion.id, required: criterion.required })) }
  const sources = item.sourceRefs.map((ref) => `<li>${esc(ref.kind === "record" ? ref.target.recordType + " · " + ref.target.recordId + " · revision " + ref.target.version : ref.kind + " · " + ref.evidenceLevel)}</li>`).join("")
  return `<details><summary>Edit decision</summary><form data-decision-edit data-context="${esc(JSON.stringify(context))}"><label>Decision objective<input name="objective" required value="${esc(item.objective)}"></label><label>Start<input name="start" type="date" required value="${esc(item.horizon.start)}"></label><label>End<input name="end" type="date" required value="${esc(item.horizon.end)}"></label><label>Currency<input name="currency" required value="${esc(item.currency)}"></label><div data-decision-criteria>${item.criteria.map((criterion, index) => `<label>Criterion ${index + 1}<input name="criterion-${index}" data-criterion-id="${esc(criterion.id)}" required value="${esc(criterion.description)}"></label>`).join("")}</div><fieldset><legend>Evidence attached to this decision</legend><ul data-decision-sources>${sources}</ul><p>Inspect an authorized source, attach it to this draft, then save the decision. Source values and financial approvals are unchanged.</p><button type="button" data-source-discover>Find Planner sources</button><label>Planner source<select name="source-option" disabled><option value="">Find sources first</option></select></label><button type="button" data-source-inspect disabled>Inspect selected source</button><div data-source-preview aria-live="polite"></div><button type="button" data-source-attach disabled>Attach source to draft</button></fieldset><button type="submit">Save decision</button><button type="button" data-decision-retry hidden style="display:none">Retry same request</button><button type="button" data-decision-review hidden style="display:none">Review current decision</button><p role="status" aria-live="polite"></p><div data-decision-conflict></div></form></details>`
}

export const decisionEditScript = `
document.querySelectorAll('[data-decision-edit]').forEach((form) => {
  if (form.dataset.sfEditReady) return; form.dataset.sfEditReady = 'true'
  let context = JSON.parse(form.dataset.context)
  ${decisionScriptHelpers}
  const submit = form.querySelector('button[type=submit]'); const retry = form.querySelector('[data-decision-retry]'); const review = form.querySelector('[data-decision-review]')
  const discover = form.querySelector('[data-source-discover]'); const inspect = form.querySelector('[data-source-inspect]'); const attach = form.querySelector('[data-source-attach]')
  const source = form.elements.namedItem('source-option'); const preview = form.querySelector('[data-source-preview]'); const list = form.querySelector('[data-decision-sources]'); const conflict = form.querySelector('[data-decision-conflict]')
  const names = ['objective', 'start', 'end', 'currency']
  const editable = () => [...form.querySelectorAll('input')].filter((input) => names.includes(input.name) || input.dataset.criterionId)
  const disabled = new Map(editable().map((input) => [input, input.disabled])); const removedDrafts = new Map()
  let refs = [...context.sourceRefs]; let options = []; let inspected; let pending; let comparison; let reviewed; let needsReview = false; let completed = false
  const draft = () => ({ fields: Object.fromEntries(names.map((name) => [name, form.elements.namedItem(name).value])), criteria: new Map(editable().filter((input) => input.dataset.criterionId).map((input) => [input.dataset.criterionId, { value: input.value, disabled: disabled.get(input) }])) })
  const scopeMatches = () => form.elements.namedItem('start').value === context.horizon.start && form.elements.namedItem('end').value === context.horizon.end && form.elements.namedItem('currency').value.trim() === context.currency
  const additions = () => refs.filter((ref) => !context.sourceRefs.some((current) => same(current, ref)))
  const sourceLabel = (ref) => ref.kind === 'record' ? ref.target.recordType + ' · ' + ref.target.recordId + ' · revision ' + ref.target.version : ref.kind + ' · ' + ref.evidenceLevel
  const renderRefs = () => {
    list.replaceChildren()
    refs.forEach((ref) => { const item = document.createElement('li'); item.textContent = sourceLabel(ref) + (pending ? ' · retained in unconfirmed request' : context.sourceRefs.some((current) => same(current, ref)) ? '' : ' · not saved yet'); list.append(item) })
  }
  const controls = () => {
    if (!live()) return
    const locked = busy || !!pending || completed
    form.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = locked })
    if (!locked) {
      editable().forEach((input) => { input.disabled = disabled.get(input) || false })
      source.disabled = !options.length || !scopeMatches(); inspect.disabled = !source.value || !scopeMatches(); attach.disabled = !inspected || !scopeMatches(); submit.disabled = needsReview
    }
    shown(retry, !!pending); retry.disabled = busy || !pending || completed
    shown(review, !!pending || needsReview); review.disabled = busy || completed
  }
  const eraseDraft = () => {
    editable().forEach((input) => { input.value = ''; input.defaultValue = ''; input.removeAttribute('value') })
    refs = []; options = []; inspected = undefined; pending = undefined; comparison = undefined; reviewed = undefined; context = undefined; removedDrafts.clear(); disabled.clear(); delete form.dataset.context
  }
  addEventListener('sf-access-revoked', eraseDraft)
  const invalidateDiscovery = () => {
    options = []; inspected = undefined; source.replaceChildren(new Option('Find sources first', '')); preview.replaceChildren(); delete preview.dataset.state
  }
  const inspectPlanner = async (refId, scope) => {
    const result = await read('bi-data', { viewId: 'BI01', baseRef: refId, candidateRef: refId, currency: scope.currency, start: scope.horizon.start, end: scope.horizon.end })
    const projection = result.projection
    if (!projection || !sameAuthority(projection.context) || projection.context.surface !== 'planner' || projection.context.currency !== scope.currency || !same(projection.context.period, scope.horizon) || !Array.isArray(projection.values) || !Array.isArray(projection.components)) throw new Error('source-unavailable')
    const supplied = projection.values.flatMap((value) => [...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])])
    const matches = supplied.filter((ref, index, all) => ref?.kind === 'record' && ref.refId === refId && ref.installationId === scope.authority.installationId && ref.projectId === scope.authority.projectId && ref.target.surface === 'planner' && ref.target.recordType === 'planner-version' && ref.target.period?.start <= scope.horizon.start && ref.target.period?.end >= scope.horizon.end && all.findIndex((other) => other.refDigest === ref.refDigest) === index)
    if (matches.length !== 1) throw new Error('source-unavailable')
    return { ref: matches[0], projection }
  }
  const revalidateSources = async (selected, scope) => {
    for (const ref of selected) {
      if (ref.kind !== 'record' || ref.target.surface !== 'planner' || ref.target.recordType !== 'planner-version') throw new Error('source-unavailable')
      const current = await inspectPlanner(ref.refId, scope)
      if (!same(current.ref, ref)) throw new Error('source-unavailable')
    }
  }
  const readCurrent = async () => {
    const response = await fetch(endpoint('workbench-case', { caseRef: context.caseSelector }), { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!live()) throw new Error('detached')
    if (response.status === 401 || response.status === 403) { clearAccess(); throw new Error('denied') }
    if (!response.ok) throw new Error('unavailable')
    const html = await response.text(); if (!live()) throw new Error('detached')
    const page = new DOMParser().parseFromString(html, 'text/html')
    const previousRevision = document.querySelector('meta[name="sf-access-revision"]')?.content
    const revision = response.headers.get('X-SF-Access-Revision') || page.querySelector('meta[name="sf-access-revision"]')?.content
    if (page.body.dataset.surface === 'signed-out' || page.querySelector('main[data-drawn="false"]') || previousRevision && previousRevision !== context.authority.accessRevision || revision && revision !== context.authority.accessRevision) { clearAccess(); throw new Error('denied') }
    const current = [...page.querySelectorAll('[data-decision-edit]')].find((candidate) => { try { const ref = JSON.parse(candidate.dataset.context).caseRef; return ref.id === context.caseRef.id && ref.incarnation === context.caseRef.incarnation } catch { return false } })
    if (!current) throw new Error('unavailable')
    const currentContext = JSON.parse(current.dataset.context)
    if (!sameAuthority(currentContext.authority) || currentContext.scope !== context.scope) { clearAccess(); throw new Error('denied') }
    if (currentContext.caseSelector !== context.caseSelector || !Number.isSafeInteger(currentContext.caseRef.version) || currentContext.caseRef.version < context.caseRef.version || !Array.isArray(currentContext.sourceRefs) || !Array.isArray(currentContext.criteria) || !currentContext.criteria.length || currentContext.criteria.some((item) => !item.id || typeof item.id !== 'string' || typeof item.required !== 'boolean') || new Set(currentContext.criteria.map((item) => item.id)).size !== currentContext.criteria.length) throw new Error('unavailable')
    const fields = Object.fromEntries(names.map((name) => { const field = current.elements.namedItem(name); if (!field) throw new Error('unavailable'); return [name, { value: field.value, disabled: field.disabled }] }))
    if (!same(currentContext.horizon, { start: fields.start.value, end: fields.end.value }) || currentContext.currency !== fields.currency.value) throw new Error('unavailable')
    const criteria = currentContext.criteria.map((item, index) => { const field = current.elements.namedItem('criterion-' + index); if (!field || field.dataset.criterionId !== item.id) throw new Error('unavailable'); return { ...item, description: field.value, disabled: field.disabled } })
    return { context: currentContext, fields, criteria, signature: JSON.stringify({ context: currentContext, fields, criteria }) }
  }
  const showRemovedDrafts = () => {
    conflict.querySelectorAll('[data-decision-removed-entry]').forEach((node) => node.remove())
    removedDrafts.forEach((value, id) => { const detail = document.createElement('p'); detail.dataset.decisionRemovedEntry = id; detail.textContent = 'Previously removed criterion ' + id + ' — your last entry: ' + value; conflict.append(detail) })
  }
  const rebuildCriteria = (criteria, retained) => {
    const group = document.createElement('div'); group.dataset.decisionCriteria = 'true'
    criteria.forEach((item, index) => {
      const label = document.createElement('label'); label.textContent = 'Criterion ' + (index + 1)
      const input = document.createElement('input'); input.name = 'criterion-' + index; input.dataset.criterionId = item.id; input.required = true
      input.value = retained?.get(item.id)?.value ?? removedDrafts.get(item.id) ?? item.description; input.defaultValue = item.description
      disabled.set(input, item.disabled || retained?.get(item.id)?.disabled || false); label.append(input); group.append(label)
    })
    form.querySelector('[data-decision-criteria]').replaceWith(group)
    for (const input of disabled.keys()) if (!input.isConnected) disabled.delete(input)
  }
  const showComparison = (current) => {
    if (!live()) return
    needsReview = true; reviewed = undefined; comparison = current; conflict.replaceChildren()
    const entries = draft(); const title = document.createElement('p'); title.textContent = current ? 'Current values and your entries:' : 'Current values are unavailable; your entries remain here.'; conflict.append(title)
    if (current) {
      names.forEach((name) => { const line = document.createElement('p'); line.textContent = name[0].toUpperCase() + name.slice(1) + ': current ' + current.fields[name].value + '; yours ' + entries.fields[name]; conflict.append(line) })
      entries.criteria.forEach((entry, id) => { const found = current.criteria.find((item) => item.id === id); const line = document.createElement('p'); line.textContent = 'Criterion ' + id + ': current ' + (found ? found.description : 'removed') + '; yours ' + entry.value; conflict.append(line) })
      const added = current.criteria.filter((item) => !entries.criteria.has(item.id)); const removed = [...entries.criteria.keys()].filter((id) => !current.criteria.some((item) => item.id === id))
      const changed = current.criteria.filter((item) => context.criteria.some((before) => before.id === item.id && before.required !== item.required))
      added.forEach((item) => { const line = document.createElement('p'); line.textContent = 'Added criterion ' + item.id + ': ' + item.description; conflict.append(line) })
      changed.forEach((item) => { const line = document.createElement('p'); line.textContent = 'Criterion ' + item.id + ': required is now ' + item.required; conflict.append(line) })
      const evidence = document.createElement('p'); evidence.textContent = current.context.sourceRefs.length + ' current source(s) will be preserved together with the sources you added to this draft, after revalidation.'; conflict.append(evidence)
      if (pending) {
        const locked = document.createElement('p'); locked.textContent = 'The previous save is still unconfirmed. These values are for review only; the original request, key and entries stay locked.'; conflict.append(locked)
      } else {
        if (added.length || removed.length || changed.length) {
          const detail = document.createElement('p'); detail.textContent = 'Continuing keeps your edits for matching criterion IDs, adds current new criteria and omits removed criteria from the next save. Removed entries remain visible until the save is confirmed.'; conflict.append(detail)
          const label = document.createElement('label'); const confirm = document.createElement('input'); confirm.type = 'checkbox'; confirm.dataset.decisionStructureConfirm = 'true'; label.append(confirm, document.createTextNode('I reviewed the added and removed criteria')); conflict.append(label)
        }
        const adopt = document.createElement('button'); adopt.type = 'button'; adopt.dataset.decisionAdopt = 'true'; adopt.textContent = 'Use current version and keep my edits'; conflict.append(adopt)
        adopt.addEventListener('click', async () => {
          if (!live() || busy || pending || comparison !== current) return
          const confirm = conflict.querySelector('[data-decision-structure-confirm]')
          if (confirm && !confirm.checked) { status.textContent = 'Review the added and removed criteria before adopting the current version.'; confirm.focus(); return }
          busy = true; controls(); status.textContent = 'Revalidating the current decision and the sources you added…'
          try {
            const fresh = await readCurrent()
            if (fresh.signature !== current.signature) { showComparison(fresh); status.textContent = 'The decision changed again. Review the new comparison before continuing.'; return }
            const extra = additions(); await revalidateSources(extra, fresh.context)
            const fence = await readCurrent()
            if (fence.signature !== fresh.signature) { showComparison(fence); status.textContent = 'The decision changed while its sources were checked. Review the new comparison.'; return }
            const retained = draft()
            retained.criteria.forEach((entry, id) => { if (!fresh.criteria.some((item) => item.id === id)) removedDrafts.set(id, entry.value) })
            rebuildCriteria(fresh.criteria, retained.criteria)
            names.forEach((name) => { const input = form.elements.namedItem(name); input.defaultValue = fresh.fields[name].value; disabled.set(input, disabled.get(input) || fresh.fields[name].disabled) })
            refs = [...fresh.context.sourceRefs]
            extra.forEach((ref) => { if (!refs.some((currentRef) => same(currentRef, ref))) refs.push(ref) })
            context = fresh.context; form.dataset.context = JSON.stringify(context); reviewed = fresh.signature; comparison = undefined; needsReview = false
            invalidateDiscovery(); renderRefs(); conflict.querySelectorAll('button, label').forEach((node) => node.remove()); showRemovedDrafts()
            title.textContent = 'Current version reviewed. Your entries and the earlier comparison remain here for an explicit save.'; status.textContent = 'Current version adopted. Review your entries, then save explicitly.'
          } catch { if (live()) status.textContent = 'The current decision or an added source could not be revalidated. Nothing was adopted; your entries and original version remain here.' }
          finally { busy = false; if (!live()) eraseDraft(); else controls() }
        })
      }
    }
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Reload current values for comparison'; conflict.append(refresh)
    refresh.addEventListener('click', async () => {
      if (!live() || busy) return
      busy = true; controls()
      try { showComparison(await readCurrent()) }
      catch { if (live()) { showComparison(undefined); status.textContent = 'Current values are unavailable; your entries and original request remain here.' } }
      finally { busy = false; if (!live()) eraseDraft(); else controls() }
    })
    showRemovedDrafts(); controls()
  }
  const unconfirmed = (error) => {
    if (!live()) return
    status.textContent = error.rejected ? 'The retry was rejected, but the earlier save is still unconfirmed. Your entries, key and request stay locked.' : error.message === 'conflict' ? 'The outcome is still unconfirmed. Your entries and exact request are preserved; review current values or retry the same request.' : 'Could not confirm the save. Your entries are preserved; retry the same request.'
    controls()
  }
  const execute = async (saved) => {
    if (busy || !live() || pending !== saved) return
    const reconciling = saved.uncertain === true
    busy = true; controls(); hold(); status.textContent = 'Saving decision…'
    try {
      const result = await send(saved); const payload = JSON.parse(saved.intent.body)
      if (!result?.caseRef || result.caseRef.id !== payload.caseRef.id || result.caseRef.incarnation !== payload.caseRef.incarnation || result.caseRef.version !== payload.caseRef.version + 1) throw new Error('uncertain')
      settle(); pending = undefined; completed = true; removedDrafts.clear(); delete form.dataset.dirty; status.textContent = 'Decision saved.'; location.assign(endpoint('workbench-case', { caseRef: context.caseSelector }))
    } catch (error) {
      if (!live()) return
      if (error.rejected && !reconciling) {
        try { settle() } catch { unconfirmed(error); return }
        pending = undefined
        if (error.status === 409 || error.message === 'conflict') {
          try { showComparison(await readCurrent()) } catch { if (live()) showComparison(undefined) }
          if (live()) status.textContent = 'The save was rejected because the decision changed or its basis is in use. Review the current version; your entries are preserved.'
        } else status.textContent = 'The save was rejected. Review the required fields before making a new attempt; your entries are preserved.'
      } else {
        unconfirmed(error)
        if (error.message === 'conflict') { try { showComparison(await readCurrent()) } catch { if (live()) showComparison(undefined) } }
      }
    } finally { busy = false; if (!live()) eraseDraft(); else controls() }
  }
  const restorePending = (saved) => {
    const payload = JSON.parse(saved.intent.body)
    if (!Array.isArray(payload.criteria) || !payload.criteria.length || payload.criteria.some((item) => typeof item.id !== 'string' || !item.id || typeof item.description !== 'string' || typeof item.required !== 'boolean') || !Array.isArray(payload.sourceRefs) || !payload.horizon || names.some((name) => typeof (name === 'start' || name === 'end' ? payload.horizon[name] : payload[name]) !== 'string')) throw new Error('invalid-retained-edit')
    names.forEach((name) => { form.elements.namedItem(name).value = name === 'start' || name === 'end' ? payload.horizon[name] : payload[name] })
    rebuildCriteria(payload.criteria, new Map(payload.criteria.map((item) => [item.id, { value: item.description }]))); refs = [...payload.sourceRefs]; renderRefs()
  }
  form.addEventListener('input', (event) => {
    if (!live()) return
    if (pending) { restorePending(pending); controls(); return }
    if (busy) return
    form.dataset.dirty = 'true'
    if (['start', 'end', 'currency'].includes(event.target.name)) {
      invalidateDiscovery(); controls()
      if (!scopeMatches()) status.textContent = 'Save the new period or currency before discovering sources for that scope.'
    }
  })
  discover.addEventListener('click', async () => {
    if (!live() || busy || pending || completed) return
    if (!scopeMatches()) { status.textContent = 'Save the new period or currency before discovering sources.'; return }
    busy = true; controls(); inspected = undefined; preview.replaceChildren(); delete preview.dataset.state; status.textContent = 'Finding authorized Planner sources…'
    try {
      const value = await read('bi-options', { viewId: 'BI01', start: context.horizon.start, end: context.horizon.end })
      if (!Array.isArray(value.versions)) throw new Error('unavailable')
      options = value.versions; source.replaceChildren(new Option('Choose a Planner source', ''))
      options.forEach((item) => { if (typeof item.ref === 'string' && typeof item.label === 'string') source.append(new Option(item.label, item.ref)) })
      status.textContent = options.length ? 'Choose a source to inspect its current values.' : 'No authorized Planner versions cover this period.'
    } catch { if (live()) { options = []; source.replaceChildren(); status.textContent = 'Planner sources are unavailable. Your decision draft is preserved.' } }
    finally { busy = false; if (!live()) eraseDraft(); else controls() }
  })
  source.addEventListener('change', () => { if (!live() || pending || busy) return; inspected = undefined; preview.replaceChildren(); delete preview.dataset.state; controls() })
  inspect.addEventListener('click', async () => {
    if (!live() || busy || pending || !scopeMatches()) return
    const selected = options.filter((item) => item.ref === source.value)
    if (selected.length !== 1) return
    busy = true; controls(); inspected = undefined; preview.replaceChildren(); delete preview.dataset.state; status.textContent = 'Inspecting authorized source…'
    try {
      const result = await inspectPlanner(selected[0].ref, context)
      inspected = { ref: result.ref, label: selected[0].label }; showProjection(preview, result.projection, inspected.label); status.textContent = 'Source inspected. Attach it to the draft, then save the decision.'
    } catch { if (live()) status.textContent = 'The source is unavailable, changed or outside this decision scope. No reference was attached.' }
    finally { busy = false; if (!live()) eraseDraft(); else controls() }
  })
  attach.addEventListener('click', () => {
    if (!live() || busy || pending || !inspected || !scopeMatches()) return
    if (refs.some((ref) => ref.refDigest === inspected.ref.refDigest)) { status.textContent = 'This exact source is already attached to the draft.'; return }
    refs = [...refs, inspected.ref]; renderRefs(); form.dataset.dirty = 'true'; status.textContent = 'Source attached to the draft. Save decision to persist it.'
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!live() || busy || pending || completed || needsReview || !form.reportValidity()) return
    busy = true; controls(); let dispatch
    try {
      const before = reviewed ? await readCurrent() : undefined
      if (before && before.signature !== reviewed) { showComparison(before); status.textContent = 'The decision changed after your review. Compare the current version before saving.'; return }
      const entries = draft()
      const payload = { caseRef: context.caseRef, objective: entries.fields.objective.trim(), horizon: { start: entries.fields.start, end: entries.fields.end }, currency: entries.fields.currency.trim(), criteria: context.criteria.map((item) => ({ ...item, description: String(entries.criteria.get(item.id)?.value || '').trim() })), sourceRefs: refs }
      if (!payload.objective || !payload.currency || payload.criteria.some((item) => !item.description) || payload.horizon.start > payload.horizon.end) { status.textContent = 'Enter an objective, currency and every criterion, with the end date on or after the start date.'; return }
      await revalidateSources(additions(), { ...context, horizon: payload.horizon, currency: payload.currency })
      if (before) {
        const after = await readCurrent()
        if (after.signature !== before.signature) { showComparison(after); status.textContent = 'The decision changed during source validation. Compare current values before saving.'; return }
      }
      pending = begin('decision-edit', payload, { removedCriteria: [...removedDrafts] }); dispatch = pending; form.dataset.dirty = 'true'
    } catch { if (live()) status.textContent = 'The current decision or added source could not be revalidated. No new save was sent; your entries remain here.' }
    finally { busy = false; if (!live()) eraseDraft(); else controls() }
    if (dispatch && live()) await execute(dispatch)
  })
  retry.addEventListener('click', async () => { if (!busy && pending) await execute(pending) })
  review.addEventListener('click', async () => {
    if (!live() || busy) return
    busy = true; controls()
    try { showComparison(await readCurrent()) }
    catch { if (live()) { showComparison(undefined); status.textContent = 'Current values are unavailable. Your entries and original request remain unchanged.' } }
    finally { busy = false; if (!live()) eraseDraft(); else controls() }
  })
  try {
    const saved = active()
    if (saved?.intent.action === 'decision-edit') {
      saved.uncertain = true; pending = saved
      if (Array.isArray(saved.draft?.removedCriteria)) saved.draft.removedCriteria.forEach(([id, value]) => { if (typeof id === 'string' && typeof value === 'string') removedDrafts.set(id, value) })
      restorePending(saved); showRemovedDrafts(); hold(); unconfirmed(new Error('uncertain'))
    } else if (saved) { form.inert = true; form.dataset.decisionHeld = 'true'; status.textContent = 'Resolve the unconfirmed alternative request before editing the decision.' }
    else controls()
  } catch { form.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = true }); status.textContent = 'The retained edit cannot be verified. Reopen the current decision to reconcile it before another mutation.' }
})
`
