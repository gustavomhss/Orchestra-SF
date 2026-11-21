/** Browser state shared by the real shell; follows host access revisions without granting authority. */
export const shellStateScript = `
const pending = { html: null, loading: false, focus: null, closed: false, denied: false, controller: null, generation: 0, writing: 0, again: false, accessRevision: document.querySelector('meta[name="sf-access-revision"]')?.content || null }
function notice(message) { if (pending.denied) return; const output = document.querySelector("dialog[open] [data-editor-status]") || document.getElementById("notice"); if (output) output.textContent = message }
function revokeAccess(status, notify = true) {
  if (pending.denied) return
  pending.denied = true
  pending.closed = true
  pending.generation++
  pending.html = null
  pending.focus = null
  pending.again = false
  pending.controller?.abort()
  if (notify) dispatchEvent(new CustomEvent("sf-access-revoked", { detail: { status } }))
  clearInterval(businessTimer)
  // Close admission immediately, but let every listener clear its connected controls,
  // captured requests and private state before the shell detaches the previous view.
  queueMicrotask(() => {
    document.title = "Sucafina · Access unavailable"
    const main = document.createElement("main")
    main.className = "content"
    main.dataset.accessUnavailable = "true"
    const heading = document.createElement("h1")
    heading.tabIndex = -1
    heading.textContent = status === 401 ? "Your session has expired" : "Your access has changed"
    const message = document.createElement("p")
    message.setAttribute("role", "status")
    message.textContent = "The previous view was removed. Reload to continue with your current permissions."
    const retry = document.createElement("button")
    retry.type = "button"
    retry.textContent = "Reload access"
    retry.addEventListener("click", () => location.reload())
    main.append(heading, message, retry)
    document.body.replaceChildren(main)
    history.replaceState(null, "", location.href)
    heading.focus()
  })
}
addEventListener("sf-access-revoked", (event) => {
  if (!pending.denied) revokeAccess(event instanceof CustomEvent && event.detail?.status === 401 ? 401 : 403, false)
})
function rememberView() {
  if (pending.denied) return
  const previous = history.state && typeof history.state === "object" && !Array.isArray(history.state) ? history.state : {}
  const focus = document.activeElement?.dataset?.editorKey || null
  history.replaceState({ ...previous, sucafina: { url: location.href, x: scrollX, y: scrollY, focus, tables: [...document.querySelectorAll(".table-scroll")].map((table) => ({ x: table.scrollLeft, y: table.scrollTop })) } }, "", location.href)
}
function restoreView() {
  const position = history.state?.sucafina
  if (!position || position.url !== location.href || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return
  requestAnimationFrame(() => {
    if (pending.denied) return
    const target = [...document.querySelectorAll("[data-open-editor]")].find((button) => button.dataset.editorKey === position.focus)
    target?.focus({ preventScroll: true })
    window.scrollTo(Math.max(0, position.x), Math.max(0, position.y))
    document.querySelectorAll(".table-scroll").forEach((table, index) => { const saved = position.tables?.[index]; if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) { table.scrollLeft = Math.max(0, saved.x); table.scrollTop = Math.max(0, saved.y) } })
  })
}
`
