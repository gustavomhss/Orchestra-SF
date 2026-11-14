/** Compose the published BI form with the shell's refresh and revocation lifecycle.
 * The form remains the sole data producer/renderer; this adapter never supplies data.
 */
export const sfBiBrowserLifecycle = String.raw`(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector("[data-sf-bi]")
    const form = root?.querySelector("form")
    if (!root || !form) return
    let closed = false
    const refresh = () => {
      if (!closed && root.isConnected && !document.hidden) form.requestSubmit()
    }
    const timer = setInterval(refresh, 30000)
    const stop = () => {
      if (closed) return
      closed = true
      clearInterval(timer)
      // The producer's invalid-period path aborts its pending read and advances
      // its generation before clearing. That also invalidates a late source link.
      const start = form.querySelector('input[aria-label="Início"]')
      if (start) {
        start.value = ""
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      }
      root.replaceChildren()
    }
    for (const button of document.querySelectorAll("[data-refresh-view]")) button.addEventListener("click", refresh)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("sf-access-revoked", stop, { once: true })
    window.addEventListener("pagehide", stop, { once: true })
  }, { once: true })
})()`
