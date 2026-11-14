/** Browser recovery for the existing domain commands. No command is replayed without a domain receipt contract. */
export const shellCommandScript = String.raw`
const shellWrites = new Map()
const shellRequests = new Set()
const formContext = (form) => ["versionId", "collection", "year", "month"].map((name) => {
  const input = [...form.elements].find((element) => element.name === name)
  return input ? input.defaultValue ?? input.value : null
})
const sameCommandRecord = (left, right) => left === right || !!left.dataset.record && left.dataset.record === right.dataset.record && left.dataset.page === right.dataset.page && JSON.stringify(formContext(left)) === JSON.stringify(formContext(right))
function outstandingCommand(form) {
  return [...shellWrites].find(([source]) => sameCommandRecord(source, form))?.[1]
}
function commandBlocked(form) {
  const active = outstandingCommand(form)
  if (!active) return false
  notice(active.uncertain ? "The earlier save is still unconfirmed. Your edits remain here. Check its outcome before making another change." : "A change to this record is still being saved. Your later edits remain here.")
  return true
}
addEventListener("sf-access-revoked", () => {
  shellRequests.forEach((controller) => controller.abort())
  shellRequests.clear()
  shellWrites.forEach((entry) => { entry.body = undefined; entry.command = undefined })
  shellWrites.clear()
})
addEventListener("pagehide", () => { shellRequests.forEach((controller) => controller.abort()); shellRequests.clear(); shellWrites.clear() })
async function shellJson(command) {
  if (pending.closed) return
  const controller = new AbortController()
  shellRequests.add(controller)
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(location.href, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: typeof command === "string" ? command : JSON.stringify(command), signal: controller.signal })
    if (pending.closed) return
    if (response.status === 401 || response.status === 403) { revokeAccess(response.status); return }
    const revision = response.headers.get("X-SF-Access-Revision")
    if (revision && revision !== pending.accessRevision) { revokeAccess(403); return }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      if (response.headers.get("content-type")?.includes("text/html")) {
        const next = new DOMParser().parseFromString(await response.text(), "text/html")
        if (pending.closed) return
        if (next.body.dataset.surface === "signed-out") { revokeAccess(401); return }
      }
      throw new Error("The command response was not confirmed")
    }
    const result = await response.json()
    if (pending.closed) return
    return { response, result }
  } finally { clearTimeout(timeout); shellRequests.delete(controller) }
}
function showUnknownCommand(form, intent) {
  intent.uncertain = true
  shellWrites.set(form, intent)
  form.dataset.dirty = "true"
  form.dataset.resultUncertain = "true"
  notice("The save response was lost or could not be verified. Its outcome is unknown. Your edits remain here; this command will not be sent again without a confirmed outcome.")
  offerLatestVersion(form)
}
async function send(command, form) {
  if (pending.closed || commandBlocked(form)) return false
  const intent = { command, body: JSON.stringify(command), uncertain: false, kind: "command" }
  shellWrites.set(form, intent)
  const finish = beginWrite()
  try {
    const reply = await shellJson(intent.body)
    if (!reply) return false
    if (!reply.response.ok || !reply.result || reply.result.ok !== true) {
      if (reply.result?.ok === false && [400, 404, 409, 422].includes(reply.response.status)) {
        shellWrites.delete(form)
        showResult(reply.result, command.values, form, reply.response.status)
        return false
      }
      showUnknownCommand(form, intent)
      return false
    }
    if (reply.result.warnings !== undefined && (!Array.isArray(reply.result.warnings) || reply.result.warnings.some((warning) => typeof warning !== "string"))) { showUnknownCommand(form, intent); return false }
    shellWrites.delete(form)
    notice(reply.result.warnings?.length ? reply.result.warnings.join(" · ") : "Saved.")
    return true
  } catch {
    if (!pending.closed) showUnknownCommand(form, intent)
    return false
  } finally { finish() }
}
function offerLatestVersion(form) {
  if (!form?.isConnected || pending.closed) return
  form.querySelector("[data-reload-draft]")?.remove()
  const uncertain = outstandingCommand(form)?.uncertain === true
  const button = document.createElement("button")
  button.type = "button"
  button.dataset.reloadDraft = "true"
  button.textContent = uncertain ? "Inspect current record without resending" : "Load current version and keep my edits"
  button.addEventListener("click", async () => {
    if (button.disabled || pending.closed) return
    button.disabled = true
    const controller = new AbortController()
    shellRequests.add(controller)
    const timeout = setTimeout(() => controller.abort(), 10000)
    const generation = pending.generation
    try {
      const response = await fetch(location.href, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      if (pending.closed) return
      if (response.status === 401 || response.status === 403) { revokeAccess(response.status); return }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) { notice("The current record is unavailable. Your edits are still here."); return }
      const next = new DOMParser().parseFromString(await response.text(), "text/html")
      if (pending.closed || !form.isConnected || generation !== pending.generation) return
      if (next.body.dataset.surface === "signed-out") { revokeAccess(401); return }
      const revision = response.headers.get("X-SF-Access-Revision") || next.querySelector('meta[name="sf-access-revision"]')?.content
      if (next.body.dataset.surface !== document.body.dataset.surface || next.querySelector('main[data-drawn="false"]') || revision && revision !== pending.accessRevision) { revokeAccess(403); return }
      if (!next.querySelector('main[data-drawn="true"]')) { notice("The current record is unavailable. Your edits are still here."); return }
      const candidates = [...next.querySelectorAll("form[data-command]")].filter((candidate) =>
        candidate.dataset.page === form.dataset.page && candidate.dataset.command === form.dataset.command && candidate.dataset.record === form.dataset.record && JSON.stringify(formContext(candidate)) === JSON.stringify(formContext(form)))
      const current = candidates.length === 1 ? candidates[0] : null
      if (!current || !Number.isSafeInteger(Number(current.dataset.version)) || Number(current.dataset.version) < 0 || current.querySelector('button[type="submit"]')?.disabled) {
        notice("This record can no longer be updated in this context. Your edits are still here.")
        return
      }
      const stored = await valuesOf(current)
      if (pending.closed || !form.isConnected || generation !== pending.generation) return
      delete stored.versions
      const details = document.createElement("section")
      details.dataset.currentRevision = "true"
      const heading = document.createElement("h3")
      heading.textContent = uncertain ? "Current record — the earlier save remains unconfirmed" : "Current record — review before saving your edits"
      details.append(heading)
      const list = document.createElement("ul")
      for (const [name, value] of Object.entries(stored)) {
        const item = document.createElement("li")
        item.textContent = name + ": " + (value == null ? "Not provided" : typeof value === "object" ? JSON.stringify(value) : String(value))
        list.append(item)
      }
      details.append(list)
      if (!uncertain) {
        form.dataset.version = current.dataset.version
        const versions = form.querySelector('input[name="versions"]')
        const latestVersions = current.querySelector('input[name="versions"]')
        if (versions && latestVersions) versions.value = latestVersions.value
        form.dataset.previewRevision = String(Number(form.dataset.previewRevision || "0") + 1)
        form.querySelector("[data-preview]")?.remove()
        button.remove()
      }
      form.querySelector("[data-current-revision]")?.remove()
      form.append(details)
      notice(uncertain ? "The current record is shown for comparison. It does not confirm the earlier save. Your original version and edits are preserved; no command was resent." : "Current version loaded. Your edits are still here; review the current values, then save again.")
      heading.tabIndex = -1
      heading.focus()
    } catch { if (!pending.closed) notice("The current record could not be loaded. Your edits are still here.") }
    finally { clearTimeout(timeout); shellRequests.delete(controller); button.disabled = false }
  })
  form.append(button)
}
`
