/** Recovery uses the existing read-preview/apply-preview receipt in the same domain snapshot. */
export const shellPreviewScript = String.raw`
let dashboardPreviewMemory
function savedDashboardPreviews() {
  if (dashboardPreviewMemory === undefined) {
    try { dashboardPreviewMemory = history.state?.sfCommandPreviews } catch { dashboardPreviewMemory = [] }
  }
  return Array.isArray(dashboardPreviewMemory) ? dashboardPreviewMemory.filter((entry) => entry && entry.url === location.href && typeof entry.ref === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(entry.ref) && ["OPEX Detail", "CAPEX Projects"].includes(entry.page) && ["year-amount", "annual-entry", "save-entry"].includes(entry.action) && typeof entry.record === "string" && Array.isArray(entry.context) && entry.context.length === 4 && entry.context.every((value) => value === null || typeof value === "string") && typeof entry.uncertain === "boolean").map(({ url, ref, page, action, record, context, uncertain }) => ({ url, ref, page, action, record, context, uncertain })) : []
}
function writeDashboardPreviewReferences(entries) {
  dashboardPreviewMemory = entries
  try {
    const state = history.state && typeof history.state === "object" && !Array.isArray(history.state) ? history.state : {}
    history.replaceState({ ...state, sfCommandPreviews: entries }, "", location.href)
    return true
  } catch { return false }
}
function rememberDashboardPreview(form, ref, uncertain) {
  const entry = { url: location.href, ref, page: form.dataset.page, action: form.dataset.command, record: form.dataset.record || "", context: formContext(form), uncertain }
  const entries = savedDashboardPreviews().filter((saved) => saved.ref !== ref && !(saved.page === entry.page && saved.action === entry.action && saved.record === entry.record && JSON.stringify(saved.context) === JSON.stringify(entry.context)))
  if (!writeDashboardPreviewReferences([...entries, entry])) notice("The reviewed change remains available in this tab, but recovery after reload could not be stored. Keep this page open until its outcome is confirmed.")
}
function forgetDashboardPreview(ref) {
  writeDashboardPreviewReferences(savedDashboardPreviews().filter((entry) => entry.ref !== ref))
}
addEventListener("sf-access-revoked", () => writeDashboardPreviewReferences([]))
function discardDashboardPreview(form) {
  const panel = form.querySelector("[data-preview]")
  if (panel?.dataset.previewRef) forgetDashboardPreview(panel.dataset.previewRef)
  panel?.remove()
}
async function reviewDashboardCommand(form, command, revision) {
  const finish = beginWrite()
  try {
    const reply = await shellJson({ page: command.page, action: "preview-change", version: 0, values: { command: { ...command, confirmed: false } } })
    if (!reply) return
    if (!reply.response.ok || reply.result?.ok !== true || reply.result.value?.status !== "preview" || typeof reply.result.value.previewRef !== "string" || !reply.result.value.previewRef.trim()) { showResult(reply.result, command.values, form, reply.response.status); return }
    if ((form.dataset.previewRevision || "0") !== revision) { notice("The draft changed. Review a new preview."); return }
    mountDashboardPreview(form, command, revision, reply.result.value, false)
  } catch { if (!pending.closed) notice("Could not confirm the preview. Your edits are preserved; review the preview again.") }
  finally { finish() }
}
function mountDashboardPreview(form, command, revision, preview, recovered) {
    rememberDashboardPreview(form, preview.previewRef, recovered)
    form.dataset.dirty = "true"
    const panel = document.createElement("section")
    panel.dataset.preview = "true"
    panel.dataset.previewRef = preview.previewRef
    panel.setAttribute("aria-label", "Review changes")
    const heading = document.createElement("h3")
    heading.textContent = "Review changes before applying"
    panel.append(heading)
    const format = (item) => item?.state === "absent" ? "Absent" : item?.state === "undefined" ? "Undefined" : item?.state === "value" ? (item.value == null ? "Not provided" : typeof item.value === "object" ? JSON.stringify(item.value) : String(item.value)) : "Unavailable"
    const list = document.createElement("ul")
    for (const change of preview.changes || []) { const row = document.createElement("li"); row.textContent = change.path + ": " + format(change.before) + " → " + format(change.after); list.append(row) }
    if (!list.children.length) { const row = document.createElement("li"); row.textContent = "No changes."; list.append(row) }
    panel.append(list)
    for (const warning of preview.warnings || []) { const message = document.createElement("p"); message.textContent = warning; panel.append(message) }
    if (preview.summary) { const summary = document.createElement("p"); summary.textContent = "Added: " + preview.summary.added + " · Updated: " + preview.summary.updated + " · Ignored: " + preview.summary.ignored; panel.append(summary) }
    const status = document.createElement("p")
    status.setAttribute("role", "status")
    status.setAttribute("aria-live", "polite")
    if (recovered) status.textContent = "The original reviewed change was recovered. Its outcome was checked without sending a new change. Retry the original application to reconcile it; current form entries are not included."
    const apply = document.createElement("button")
    apply.type = "button"
    apply.textContent = recovered ? "Retry reviewed application" : "Confirm and apply"
    const intent = { body: JSON.stringify({ page: command.page, action: "apply-preview", version: 0, values: { previewRef: preview.previewRef } }), command, uncertain: recovered, kind: "preview", busy: false, retry: recovered }
    if (recovered) { shellWrites.set(form, intent); form.dataset.resultUncertain = "true" }
    const unconfirmed = (message) => {
      intent.uncertain = true
      intent.retry = false
      rememberDashboardPreview(form, preview.previewRef, true)
      form.dataset.dirty = "true"
      form.dataset.resultUncertain = "true"
      status.textContent = message
      apply.textContent = "Check saved outcome"
      notice("The reviewed change has no confirmed outcome yet. Your edits are preserved. Check the saved outcome before making another change.")
    }
    apply.addEventListener("click", async () => {
      if (pending.closed || intent.busy) return
      if (!intent.uncertain && (form.dataset.previewRevision || "0") !== revision) { panel.remove(); notice("The draft changed. Review a new preview."); return }
      if (outstandingCommand(form) && outstandingCommand(form) !== intent) { commandBlocked(form); return }
      const checking = intent.uncertain && !intent.retry
      const wasUncertain = intent.uncertain
      intent.busy = true
      shellWrites.set(form, intent)
      rememberDashboardPreview(form, preview.previewRef, true)
      apply.disabled = true
      status.textContent = checking ? "Checking the saved outcome…" : wasUncertain ? "Reconciling the original reviewed change…" : "Saving the reviewed change…"
      const done = beginWrite()
      try {
        const reply = await shellJson(checking ? { page: command.page, action: "read-preview", version: 0, values: { previewRef: preview.previewRef } } : intent.body)
        if (!reply) return
        if (reply.response.ok && reply.result?.ok === true && reply.result.value?.applied === true && reply.result.value.previewRef === preview.previewRef) {
          shellWrites.delete(form)
          forgetDashboardPreview(preview.previewRef)
          delete form.dataset.resultUncertain
          panel.remove()
          if ((form.dataset.previewRevision || "0") !== revision) { notice("The reviewed changes were saved. New edits remain unsaved; review them before applying."); return }
          delete form.dataset.dirty
          const dialog = form.closest("dialog")
          if (dialog) { pending.focus = dialog.closest("td").querySelector("[data-open-editor]").dataset.editorKey; dialog.close() }
          notice("Saved.")
          pending.again = true
          return
        }
        if (checking && reply.response.ok && reply.result?.ok === true && reply.result.value?.status === "preview" && reply.result.value.previewRef === preview.previewRef) {
          intent.retry = true
          status.textContent = "No saved result is available yet. You can retry the original reviewed change. Newer edits stay pending and are not included."
          apply.textContent = "Retry reviewed application"
          return
        }
        if (!wasUncertain && reply.result?.ok === false && [400, 409, 422].includes(reply.response.status)) {
          shellWrites.delete(form)
          forgetDashboardPreview(preview.previewRef)
          panel.remove()
          showResult(reply.result, command.values, form, reply.response.status)
          return
        }
        unconfirmed("The saved outcome could not be confirmed. The original reviewed change remains pending; check again before starting a new change.")
      } catch {
        if (!pending.closed) unconfirmed("The response was interrupted. Check the saved outcome; no new change has been sent.")
      } finally {
        done()
        intent.busy = false
        apply.disabled = false
        if (pending.again && !pending.closed) { pending.again = false; void refresh() }
      }
    })
    panel.append(status, apply)
    form.querySelector("[data-preview]")?.remove()
    form.append(panel)
    heading.tabIndex = -1
    heading.focus()
}
async function restoreDashboardPreviews() {
  if (pending.closed || document.body.dataset.surface !== "dashboard") return
  for (const saved of savedDashboardPreviews()) {
    if (pending.closed) return
    const forms = [...document.querySelectorAll("form[data-command]")].filter((form) => form.dataset.page === saved.page && form.dataset.command === saved.action && (form.dataset.record || "") === saved.record && JSON.stringify(formContext(form)) === JSON.stringify(saved.context))
    if (forms.length !== 1 || forms[0].querySelector('button[type="submit"]')?.disabled) { forgetDashboardPreview(saved.ref); continue }
    const form = forms[0]
    const revision = form.dataset.previewRevision || "0"
    if (saved.uncertain) {
      shellWrites.set(form, { uncertain: true, kind: "preview" })
      form.dataset.resultUncertain = "true"
    }
    const finish = beginWrite()
    try {
      const reply = await shellJson({ page: saved.page, action: "read-preview", version: 0, values: { previewRef: saved.ref } })
      if (!reply || pending.closed || !form.isConnected) return
      if (reply.response.ok && reply.result?.ok === true && reply.result.value?.applied === true && reply.result.value.previewRef === saved.ref) {
        shellWrites.delete(form)
        delete form.dataset.resultUncertain
        forgetDashboardPreview(saved.ref)
        notice("The earlier reviewed change was saved. Its original result has been recovered.")
        pending.again = true
        continue
      }
      if (reply.response.ok && reply.result?.ok === true && reply.result.value?.status === "preview" && reply.result.value.previewRef === saved.ref) {
        if ((form.dataset.previewRevision || "0") !== revision || form.dataset.dirty) { notice("A reviewed change is available from the previous visit. Your new entries are preserved; finish reviewing them before reloading the saved preview."); continue }
        mountDashboardPreview(form, { page: saved.page, action: saved.action, id: saved.record, values: {} }, revision, reply.result.value, saved.uncertain)
        if (!saved.uncertain) form.querySelector('[data-preview] [role="status"]').textContent = "A saved preview was recovered. Review its changes before applying; the current form values may differ."
        for (let parent = form.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true
        const dialog = form.closest("dialog")
        if (dialog && !dialog.open) dialog.closest("td").querySelector("[data-open-editor]")?.click()
        form.querySelector("[data-preview] h3")?.focus()
        continue
      }
      notice("The saved preview is unavailable or no longer current. No change was applied during recovery. Review the current record before continuing.")
    } catch { if (!pending.closed) notice("The saved preview could not be checked. No change was resent. Reload to check its outcome again.") }
    finally { finish() }
  }
  if (pending.again && !pending.closed) { pending.again = false; void refresh() }
}
`
