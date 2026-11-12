// O botão mostra. Não decide. Sem rede, a escrita não ficou gravada, e o ecrã diz isso.
// Não importa superfície. Não há localStorage.

import { showPage } from "./nav.ts"

export const UNSAVED = "A escrita não ficou gravada."

export type ScreenActor = { id: string; canWrite: boolean; roles: string[]; assigned?: string[] }

export type Drawn = {
  surface: "dashboard" | "planner" | "procurement"
  nav: { key: string; index: number }[]
  active: { drawn: true; key: string; index: number } | { drawn: false }
  aside: { key: string; page: false }[]
}

type PressResult = { ok: true; value?: unknown } | { ok: false; status?: 409; stored?: unknown; by?: string } | null

const SCRIPT = `
const unsaved = ${JSON.stringify(UNSAVED)}
const pending = { html: null, loading: false, focus: null, closed: false, controller: null, generation: 0, writing: 0, again: false }
function notice(message) { (document.querySelector("dialog[open] [data-editor-status]") || document.getElementById("notice")).textContent = message }
function assignValue(target, name, value) {
  const path = name.replace(/\\[(\\d+)\\]/g, ".$1").split(".")
  if (path.some((part) => ["__proto__", "constructor", "prototype"].includes(part))) throw new Error("Invalid field")
  const parent = path.slice(0, -1).reduce((node, key, index) => {
    if (node[key] == null) node[key] = /^\\d+$/.test(path[index + 1]) ? [] : {}
    return node[key]
  }, target)
  parent[path[path.length - 1]] = value
}
async function valuesOf(form) {
  const values = {}
  for (const input of form.elements) {
    if (!input.name || input.disabled || ["submit", "button"].includes(input.type)) continue
    if (input.dataset.choice === "true") { if (input.checked) assignValue(values, input.name, input.value); continue }
    if (input.matches("[data-workbook]")) continue
    if (input.type === "file") {
      if (input.files[0]) assignValue(values, input.name, JSON.parse(await input.files[0].text()))
      continue
    }
    const value = input.dataset.json === "true" ? JSON.parse(input.value || "null") : input.type === "checkbox" ? input.checked : input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value
    assignValue(values, input.name, value)
  }
  function compact(value) { if (Array.isArray(value)) return value.filter((entry) => entry !== undefined).map(compact); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, compact(entry)])); return value }
  return compact(values)
}
function showResult(result) {
  if (result && result.status === 409) { notice(JSON.stringify({ stored: result.stored, by: result.by })); return }
  notice(result && result.errors ? result.errors.join(" · ") : unsaved)
}
function beginWrite() {
  pending.writing++
  pending.generation++
  pending.html = null
  return () => { pending.writing--; pending.generation++; pending.html = null }
}
async function send(command) {
  const finish = beginWrite()
  try {
  const response = await fetch(location.href, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(command) })
  const result = await response.json()
  if (!response.ok || !result || result.ok !== true) { showResult(result); return false }
  notice(result.warnings && result.warnings.length ? result.warnings.join(" · ") : "Saved.")
  return true
  } finally { finish() }
}
async function press(name) {
  if (name === "Import JSON" && !window.confirm("Substitui para toda a gente.")) return
  const post = window.sucafinaPost
  if (typeof post !== "function") { notice(unsaved); return }
  try { const result = await post({ action: name, confirmed: name === "Import JSON" }); if (!result || result.ok !== true) showResult(result) }
  catch { notice(unsaved) }
}
function attach() {
  const current = new URL(location.href)
  const stateKeys = ["year", "execYear", "opsYear", "secYear", "executiveMonth", "operationsMonth", "securityMonth", "opsMonth"]
  document.querySelectorAll('nav a[href*="?page="]').forEach((anchor) => {
    const target = new URL(anchor.href)
    for (const key of stateKeys) if (current.searchParams.has(key)) target.searchParams.set(key, current.searchParams.get(key))
    target.searchParams.delete("own")
    anchor.href = target.toString()
    if (target.searchParams.get("page") === document.querySelector("main")?.dataset.page) anchor.setAttribute("aria-current", "page")
  })
  document.querySelectorAll("[data-notifications]").forEach((menu) => {
    if (menu.dataset.bound) return
    menu.dataset.bound = "true"
    const endpoint = new URL(menu.dataset.notifications, location.href)
    const output = menu.querySelector("[data-notification-items]")
    const count = menu.querySelector("[data-notification-count]")
    const load = async () => {
      try {
        const response = await fetch(menu.dataset.notifications, { credentials: "same-origin", cache: "no-store" })
        if (!response.ok) throw new Error("Notifications unavailable")
        const result = await response.json()
        if (!Array.isArray(result.items)) throw new Error("Notifications unavailable")
        const unread = result.items.filter((item) => !item.read).length
        count.textContent = unread ? String(unread) : ""
        output.replaceChildren()
        if (!result.items.length) { const empty = document.createElement("p"); empty.textContent = "No notifications."; output.append(empty); return }
        const labels = { pending: "Approval requested", approved: "Approved", rejected: "Rejected", "supplier-pending": "Supplier review requested" }
        for (const item of result.items) {
          const target = new URL(item.link, location.href)
          if (target.origin !== location.origin || !target.pathname.startsWith(endpoint.pathname.slice(0, endpoint.pathname.lastIndexOf("/") + 1))) continue
          const row = document.createElement("div")
          row.className = "notification-item"
          const link = document.createElement("a")
          link.href = target.href
          link.textContent = (labels[item.kind] || "Notification") + " · " + item.record
          row.append(link)
          const date = document.createElement("small")
          date.textContent = new Date(item.at).toLocaleString()
          row.append(date)
          if (!item.read) {
            const button = document.createElement("button")
            button.type = "button"
            button.textContent = "Mark read"
            button.addEventListener("click", async () => {
              button.disabled = true
              try {
                const saved = await fetch(menu.dataset.notifications, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [item.id] }) })
                if (!saved.ok) throw new Error("Notification update failed")
                await load()
              } catch { notice("Notification update failed. Please retry.") }
              finally { button.disabled = false }
            })
            row.append(button)
          }
          output.append(row)
        }
      } catch { count.textContent = ""; output.replaceChildren(); const error = document.createElement("p"); error.textContent = "Notifications unavailable. Reopen to retry."; output.append(error) }
    }
    menu.addEventListener("toggle", () => { if (menu.open) void load() })
    void load()
    setInterval(() => { void load() }, 30000)
  })
  document.querySelectorAll("[data-logout]").forEach((button) => {
    if (button.dataset.bound) return
    button.dataset.bound = "true"
    button.addEventListener("click", async () => {
      button.disabled = true
      try {
        const response = await fetch(new URL("./auth/logout", location.href), { method: "POST", credentials: "same-origin" })
        if (!response.ok) { notice("Sign out failed. Please retry."); return }
        location.assign(new URL("./auth/login", location.href).href)
      } catch { notice("Sign out failed. Please retry.") }
      finally { button.disabled = false }
    })
  })
  document.querySelectorAll("[data-open-editor]").forEach((button) => {
    if (button.dataset.bound) return
    button.dataset.bound = "true"
    const dialog = button.closest("td").querySelector("dialog")
    const form = dialog.querySelector("form[data-command]")
    button.dataset.editorKey = form ? JSON.stringify([form.dataset.page, form.dataset.command, form.dataset.record]) : ""
    button.addEventListener("click", () => dialog.showModal())
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return
      const stops = [...dialog.querySelectorAll('button:not(:disabled), input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((node) => node.getClientRects().length)
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    })
  })
  document.querySelectorAll("[data-close-editor]").forEach((button) => {
    if (button.dataset.bound) return
    button.dataset.bound = "true"
    button.addEventListener("click", () => button.closest("dialog").close())
  })
  document.querySelectorAll(".section-tabs a").forEach((anchor, index) => {
    if (location.hash ? anchor.hash === location.hash : index === 0) anchor.setAttribute("aria-current", "location")
    anchor.addEventListener("click", () => {
  document.querySelectorAll(".section-tabs a").forEach((link) => link.removeAttribute("aria-current"))
      anchor.setAttribute("aria-current", "location")
    })
  })
  document.querySelectorAll('form[method="get"]').forEach((form) => {
    for (const key of stateKeys) {
      if (!current.searchParams.has(key) || form.elements.namedItem(key)) continue
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = key
      input.value = current.searchParams.get(key)
      form.append(input)
    }
  })
  document.querySelectorAll("input[data-workbook]").forEach((input) => {
    if (input.dataset.bound) return
    input.dataset.bound = "true"
    input.addEventListener("change", async () => {
      const form = input.closest("form")
      if (!form || !input.files[0]) return
      const box = form.querySelector("[data-import-notice]")
      try {
        const response = await fetch(location.href, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ page: form.dataset.page, action: "preview-workbook", version: 0, values: { bytes: Array.from(new Uint8Array(await input.files[0].arrayBuffer())), kind: input.dataset.workbook } }) })
        const result = await response.json()
        if (!response.ok || !result.ok) { showResult(result); return }
        const sheets = result.sheets || {}
        const output = form.querySelector("[data-workbook-rows]") || form.querySelector('input[name="sheets"]')
        if (!output) { notice(unsaved); return }
        if (input.dataset.workbook === "operations") {
          const year = form.querySelector('[name="year"]')
          const month = form.querySelector('[name="month"]')
          if (year) year.value = String(result.year)
          const sync = () => { output.value = JSON.stringify(result.months[String(month.value)] || {}); output.dataset.json = "true" }
          if (!Object.hasOwn(result.months, String(month.value))) month.value = Object.keys(result.months)[0]
          month.addEventListener("change", sync)
          sync()
          if (box) box.textContent = "Preview: ticket data available for months " + Object.keys(result.months).join(", ") + ". Choose the month before importing."
          return
        }
        const rows = sheets["All Members"] || sheets["OPEX"] || Object.values(sheets)[0] || []
        output.value = JSON.stringify(input.dataset.workbook === "planner" ? sheets : rows)
        output.dataset.json = "true"
        if (box) box.textContent = "Preview: " + Object.entries(sheets).map(([name, rows]) => name + " (" + rows.length + ")").join(" · ") + ". Review before applying."
      } catch { notice(unsaved) }
    })
  })
  document.querySelectorAll("form[data-private-upload]").forEach((form) => {
    if (form.dataset.bound) return
    form.dataset.bound = "true"
    form.addEventListener("submit", async (event) => {
      event.preventDefault()
      const file = form.querySelector('input[type="file"]').files[0]
      if (!file) return
      const url = new URL(location.href)
      url.searchParams.set("upload", form.dataset.privateUpload)
      url.searchParams.set("page", form.dataset.page)
      url.searchParams.set("record", form.dataset.record)
      url.searchParams.set("recordVersion", form.dataset.version)
      url.searchParams.set("name", file.name)
      const button = form.querySelector("button")
      button.disabled = true
      const finish = beginWrite()
      try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, credentials: "same-origin", body: file })
        const result = await response.json()
        if (!response.ok || !result.ok) { showResult(result); return }
        document.activeElement.blur()
        delete form.dataset.dirty
        notice("Document uploaded.")
        pending.again = true
      } catch { notice(unsaved) }
      finally { finish(); button.disabled = false; if (pending.again) { pending.again = false; await refresh() } }
    })
  })
  document.querySelectorAll("form[data-command]").forEach((form) => {
    if (form.dataset.bound) return
    form.dataset.bound = "true"
    form.addEventListener("submit", async (event) => {
      event.preventDefault()
      const confirmed = /import|delete|replace|restore/.test(form.dataset.command)
      if (confirmed && !window.confirm("Confirm this change?")) return
      const buttons = [...form.querySelectorAll("button")]
      buttons.forEach((button) => button.disabled = true)
      try {
        const values = await valuesOf(form)
        const saved = await send({ page: form.dataset.page, action: form.dataset.command, id: form.dataset.record || undefined, version: Number(form.dataset.version), values, confirmed: confirmed || values.confirmed === true })
        if (saved) {
          delete form.dataset.dirty
          const dialog = form.closest("dialog")
          if (dialog) {
            pending.focus = dialog.closest("td").querySelector("[data-open-editor]").dataset.editorKey
            const message = dialog.querySelector("[data-editor-status]").textContent
            dialog.close()
            notice(message)
          }
          if (!dialog) document.activeElement.blur()
          await refresh()
        }
      } catch { notice(unsaved) }
      finally { buttons.forEach((button) => button.disabled = false) }
    })
  })
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => press(button.getAttribute("data-action"))))
  document.querySelectorAll("select[data-month]").forEach((select) => { if (select.dataset.bound) return; select.dataset.bound = "true"; select.addEventListener("change", () => { const url = new URL(location.href); url.searchParams.set(select.dataset.query || "month", select.value); location.assign(url.toString()) }) })
  document.querySelectorAll("select[data-year]").forEach((select) => { if (select.dataset.bound) return; select.dataset.bound = "true"; select.addEventListener("change", () => {
    const url = new URL(location.href)
    const key = select.dataset.query || (select.getAttribute("data-year") === "own" ? "own" : "year")
    url.searchParams.set(key, select.value)
    if (key !== "own") url.searchParams.delete("own")
    location.assign(url.toString())
  }) })
  document.querySelectorAll('form[data-command] input[type="hidden"][name="budgetEdited"]').forEach((marker) => {
    const form = marker.form
    if (!form || form.dataset.budgetMonths) return
    form.dataset.budgetMonths = "true"
    form.addEventListener("input", (event) => {
      const input = event.target
      if (!input || !input.name || input === marker) return
      const match = /^b([0-9]|1[01])$/.exec(input.name)
      if (!match) return
      const index = Number(match[1])
      const parsed = (() => { try { return JSON.parse(marker.value || "[]") } catch { return [] } })()
      const marks = Array.isArray(parsed) ? parsed.filter((item) => Number.isInteger(item) && item >= 0 && item <= 11 && item !== index) : []
      marks.push(index)
      marker.value = JSON.stringify(marks)
    })
  })
}
function applyRefresh() {
  if (!pending.html || document.querySelector("form[data-dirty], dialog[open]") || document.activeElement && document.activeElement.closest("form")) return
  const next = new DOMParser().parseFromString(pending.html, "text/html")
  const main = next.querySelector("main")
  if (!main) { pending.html = null; return }
  document.querySelector("main").replaceWith(main)
  pending.html = null
  attach()
  if (pending.focus !== null) {
    const target = [...document.querySelectorAll("[data-open-editor]")].find((button) => button.dataset.editorKey === pending.focus) || document.querySelector("main h1")
    if (target) { if (!target.matches("button")) target.tabIndex = -1; target.focus() }
    pending.focus = null
  }
}
async function refresh(silent = false) {
  if (pending.closed || pending.writing) return
  if (pending.loading) { if (!silent) pending.again = true; return }
  const generation = pending.generation
  pending.loading = true
  pending.controller = new AbortController()
  const deadline = setTimeout(() => pending.controller?.abort(), 10000)
  try {
    const response = await fetch(location.href, { credentials: "same-origin", cache: "no-store", signal: pending.controller.signal })
    if (!response.ok) { if (!silent) notice(unsaved); return }
    const html = await response.text()
    if (generation !== pending.generation || pending.writing || pending.closed) return
    pending.html = html
    applyRefresh()
  } catch { if (!silent && !pending.closed) notice(unsaved) }
  finally { clearTimeout(deadline); pending.loading = false; pending.controller = null; if (pending.again) { pending.again = false; void refresh() } }
}
const markDirty = (event) => { const form = event.target.closest("form[data-command], form[data-private-upload]"); if (form) form.dataset.dirty = "true" }
document.addEventListener("input", markDirty)
document.addEventListener("change", markDirty)
const businessTimer = setInterval(() => { if (!document.hidden) void refresh(true) }, 30000)
window.addEventListener("pagehide", () => { pending.closed = true; clearInterval(businessTimer); pending.controller?.abort() })
window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload() })
window.sucafinaRefresh = refresh
document.addEventListener("focusout", () => setTimeout(applyRefresh, 0))
attach()
`

export function press(
  action: () => PressResult,
):
  | { saved: true; value?: unknown }
  | { saved: false; notice: string }
  | { saved: false; status?: 409; stored?: unknown; by?: string } {
  let result: PressResult
  try {
    result = action()
  } catch {
    return { saved: false, notice: UNSAVED }
  }
  if (!result) return { saved: false, notice: UNSAVED }
  if (!result.ok && result.status === 409) return { saved: false, status: 409, stored: result.stored, by: result.by }
  if (!result.ok) return { saved: false }
  return { saved: true, value: result.value }
}

export function openKey(
  keys: string[],
  requested: string | undefined,
  open: (key: string) => { drawn: boolean; index?: number },
): Drawn["active"] {
  if (!requested) return { drawn: false }
  const found = open(requested)
  if (!found.drawn || found.index == null) return { drawn: false }
  if (!keys.includes(requested)) return { drawn: false }
  return { drawn: true, key: requested, index: found.index }
}

export function listed(keys: readonly string[], surface: Drawn["surface"]): { key: string; index: number }[] {
  return keys.flatMap((key) => {
    const page = showPage(key)
    if (!page.drawn || page.surface !== surface) return []
    return [{ key, index: page.index }]
  })
}

export function links(nav: { key: string; index: number }[]): string {
  return nav
    .map((item) => `<a data-index="${item.index}" href="?page=${encodeURIComponent(item.key)}">${esc(item.key)}</a>`)
    .join("")
}

export function pageMain(active: Drawn["active"], body = ""): string {
  if (!active.drawn) return `<main data-drawn="false"></main>`
  return `<main data-drawn="true" data-page="${esc(active.key)}"><h1>${esc(active.key)}</h1>${body}</main>`
}

export function documentHtml(
  title: string,
  surface: string,
  nav: string,
  main: string,
  aside: string,
  sidebarControls = "",
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style></head><body data-surface="${surface}"><a class="skip" href="#content">Skip to content</a><aside class="sidebar"><header><strong>Sucafina</strong><span>${esc(title)}</span></header><nav aria-label="${esc(title)}">${nav}</nav>${sidebarControls}</aside><div id="content" class="content"><header class="workspace-bar"><span>Sucafina workspace</span><div role="navigation" aria-label="Applications">${[["dashboard", "Dashboard"], ["planner", "Budget Planner"], ["procurement", "Procurement"]].map(([key, label]) => `<a href="./${key}"${surface === key ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</div>${surface === "signed-out" ? "" : '<div class="workspace-tools"><!--local-tools--><button type="button" data-logout>Sign out</button></div>'}</header>${main}${aside}<p id="notice" role="status" aria-live="polite"></p></div><script>${SCRIPT}</script></body></html>`
}

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const STYLE = `
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#20372e;background:#f4f6f4;font-size:14px;line-height:1.5;color-scheme:light;--border:#dce5df;--muted:#65796d;--green:#1e6246}
*{box-sizing:border-box}body{margin:0;display:grid;grid-template-columns:224px minmax(0,1fr);min-height:100vh}a{color:var(--green)}
.sidebar{background:#143c2f;color:#edf4ef;padding:28px 14px;position:sticky;top:0;height:100dvh;overflow-y:auto}.sidebar header{padding:0 12px 24px;display:grid;gap:4px}.sidebar header strong{font-size:25px;letter-spacing:-.8px}.sidebar header span{font-size:12px;color:#b9cfc3}.sidebar label{color:#d4e4d8;margin:24px 12px 0;min-width:0}.sidebar select{width:100%;margin-top:4px}
nav{display:grid;gap:3px}nav a{color:inherit;text-decoration:none;padding:9px 12px;border-radius:6px;font-size:12px;line-height:1.45}nav a:hover{background:#24513f}nav a[aria-current=page]{background:#32634c;color:white;box-shadow:inset 3px 0 #b6d59d}nav a:focus-visible{outline:2px solid #b6d59d;outline-offset:1px}.nav-section{color:#9fbeab;font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin:20px 12px 5px}
.content{padding:24px 28px 40px;min-width:0;width:100%;max-width:1680px;margin-inline:auto}main{min-width:0;container-type:inline-size}h1{font-size:26px;line-height:1.25;letter-spacing:-.7px;margin:0 0 24px;color:#173c2d}h2{font-size:17px;line-height:1.4;letter-spacing:-.2px;margin:28px 0 12px}h3{font-size:14px;margin:20px 0 10px}p{overflow-wrap:anywhere}section{margin-bottom:24px;min-width:0}.environment-banner{font-size:12px;line-height:1.4;margin:0 0 20px;padding:8px 12px;background:#f8f3e4;color:#776128;border:1px solid #e6ddc4;border-radius:6px}
body[data-surface=planner] main>h1+h2{display:none}figure{margin:24px 0;padding:16px;background:#fff;border:1px solid var(--border);border-radius:8px;min-width:0}figcaption{font-size:12px;font-weight:600;color:#4b6357;margin-bottom:12px}figure svg{display:block;width:100%;height:auto;max-height:240px}figure svg:empty{display:none}figure .table-scroll{margin-bottom:0}.period-selector{display:flex;flex-wrap:wrap;gap:12px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin:16px 0}.period-selector label{flex:0 1 180px;min-width:120px}
.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0 24px;align-items:stretch}.metric-grid--1{grid-template-columns:minmax(0,1fr)}.metric-grid--2{grid-template-columns:repeat(2,minmax(0,1fr))}.metric-grid--3{grid-template-columns:repeat(3,minmax(0,1fr))}.metric{display:inline-grid;align-content:space-between;gap:12px;min-width:160px;min-height:112px;background:white;border:1px solid var(--border);border-radius:8px;padding:18px 20px;margin:0 12px 16px 0;vertical-align:top}.metric span{color:var(--muted);font-size:12px;line-height:1.45;overflow-wrap:anywhere}.metric strong{font-size:28px;font-weight:650;letter-spacing:-.7px;line-height:1.15;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.metric-grid>.metric,.metric-grid>section>.metric{display:grid;min-width:0;width:100%;height:100%;margin:0}.metric-grid>section{margin:0;min-width:0}.metric-tile{background:#fff;border:1px solid var(--border);border-radius:8px;padding:18px 20px;min-width:0}.metric-tile .metric{display:grid;margin:0;padding:0;border:0;min-width:0;min-height:72px}.metric-tile p{margin:12px 0 0;font-size:12px;color:var(--muted)}[data-tone=red]>.metric,[data-tone=red].metric-tile{border-top:3px solid #b55e55}[data-tone=amber]>.metric,[data-tone=amber].metric-tile{border-top:3px solid #b9933d}[data-tone=green]>.metric,[data-tone=green].metric-tile{border-top:3px solid #478564}
form{background:#fff;border:1px solid var(--border);border-radius:8px;padding:18px;margin:16px 0;display:flex;gap:14px;align-items:end;flex-wrap:wrap;min-width:0}label{font-size:12px;color:#4b6357;display:grid;gap:6px;min-width:140px;flex:1;max-width:100%}input,select,textarea{font:inherit;font-size:13px;line-height:20px;border:1px solid #bccdc0;border-radius:5px;padding:8px 10px;background:#fff;max-width:100%;min-width:0;min-height:38px}textarea{min-height:88px;resize:vertical}input:focus,select:focus,textarea:focus{outline:2px solid #478564;outline-offset:1px}input[type=checkbox],input[type=radio]{width:16px;height:16px;min-height:16px;padding:0;flex:none;accent-color:var(--green)}input[type=file]{width:100%;line-height:20px}button,.button{font:inherit;font-size:12px;line-height:20px;font-weight:600;background:var(--green);border:1px solid var(--green);color:#fff;border-radius:5px;padding:8px 14px;min-height:38px;max-width:100%;cursor:pointer;text-decoration:none;display:inline-flex;justify-content:center;align-items:center;text-align:center;overflow-wrap:anywhere}button:disabled{opacity:.45;cursor:not-allowed}button:hover:not(:disabled){background:#174e37}button:focus-visible,.button:focus-visible{outline:2px solid #478564;outline-offset:2px}.filter-bar{padding:14px 16px;gap:12px}.filter-bar label{flex:0 1 180px;min-width:120px}.filter-bar button{margin-left:auto}.report-form{align-items:start}.report-form fieldset{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px 16px;flex-basis:100%;border:1px solid var(--border);border-radius:6px;min-width:0;padding:16px}.report-form fieldset label{display:flex;align-items:center;gap:8px;min-width:0;line-height:1.4}.report-form button{margin-left:auto}
.table-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;background:#fff;border:1px solid var(--border);border-radius:8px;margin:16px 0 24px}table{border-collapse:collapse;width:100%;font-size:12px;line-height:1.5}th,td{text-align:left;padding:11px 12px;border-bottom:1px solid #e8eee9;white-space:nowrap}th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:#eaf0eb;color:#4f6858}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#f9fbf9}td form{padding:0;margin:0;border:0;background:none;gap:8px}td input{max-width:130px}td button{min-height:32px;padding:5px 10px}td label{min-width:0}.empty{padding:20px;color:var(--muted)}.notice,#notice{color:#724c12;background:#fcf4de;border-radius:5px;padding:12px 16px}#notice:empty{display:none}.skip{position:absolute;left:-9999px}.skip:focus{left:10px;top:10px;background:white;padding:10px;z-index:10}details{padding:14px 16px;background:white;border:1px solid var(--border);border-radius:8px;margin:12px 0}summary{cursor:pointer;font-weight:600}
@container(max-width:850px){.metric-grid--4{grid-template-columns:repeat(2,minmax(0,1fr))}.metric{padding:16px}.metric strong{font-size:26px}}@container(max-width:540px){.metric-grid--3{grid-template-columns:repeat(2,minmax(0,1fr))}.metric-grid{gap:10px}.metric-grid .metric{padding:14px;min-height:112px}.metric strong{font-size:24px}.filter-bar label{flex:1 1 120px}.filter-bar button{margin-left:0}}
@media(max-width:800px){body{display:block}.sidebar{position:relative;height:auto;padding:16px}.sidebar header{padding:0 0 12px;display:flex;align-items:baseline;gap:12px}.sidebar header strong{font-size:22px}.sidebar label{margin:12px 0 0;display:flex;align-items:center;gap:12px}.sidebar select{width:120px;margin:0}nav{display:flex;overflow-x:auto;gap:4px;padding:3px 0 6px;white-space:nowrap}nav a{flex:none}.nav-section{display:none}.content{padding:20px 16px 32px}h1{font-size:24px;margin-bottom:20px}.environment-banner{font-size:11px;padding:8px 10px}form{padding:14px;gap:12px}label{min-width:120px}button,.button{white-space:normal}.metric{min-width:0;max-width:100%}.report-form fieldset{padding:12px}}
/* Editors use aligned rows; headings and nested collections never become accidental columns. */
.workspace-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 0 20px;margin-bottom:24px;border-bottom:1px solid var(--border)}.workspace-bar>span{font-size:12px;color:var(--muted)}.workspace-bar [role=navigation]{display:flex;gap:4px;flex-wrap:wrap}.workspace-bar a{font-size:12px;text-decoration:none;padding:7px 12px;border-radius:5px;color:#546c5d}.workspace-bar a[aria-current=page]{background:#e3eee6;color:#174e37;font-weight:600}.workspace-bar a:hover{background:#e8eeea}.content{max-width:1536px;container-type:inline-size}
form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:18px 16px;padding:24px}form label{min-width:0;max-width:100%;flex:none}form input,form select,form textarea{width:100%}form>h2,form>h3,form>fieldset,form>section,form>.table-scroll,form>p,form>details,form>div{grid-column:1/-1}form>h2,form>h3{margin:8px 0 0;padding-top:16px;border-top:1px solid var(--border)}form>h2:first-child,form>h3:first-child{margin:0;padding-top:0;border:0}form>button{grid-column:1/-1;justify-self:end;margin:4px 0 0}form>label:has(>textarea),fieldset>label:has(>textarea){grid-column:1/-1}form textarea{min-height:104px}form label:has(>input[type=checkbox]),form label:has(>input[type=radio]){display:flex;align-items:center;gap:9px;min-height:38px;align-self:end;line-height:1.4}form label>input[type=checkbox],form label>input[type=radio]{width:16px;order:-1;flex:none}form fieldset{min-width:0;border:1px solid var(--border);border-radius:7px;padding:18px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0}form fieldset>fieldset{grid-column:1/-1}form legend{font-size:13px;font-weight:600;padding:0 8px;color:#294a37}form fieldset>h2,form fieldset>h3,form fieldset>.table-scroll{grid-column:1/-1}form .table-scroll{margin:0}form>p{margin:0;color:var(--muted);font-size:12px}
form.filter-bar{display:flex;align-items:end;padding:16px;gap:12px}form.filter-bar label{flex:0 1 200px;min-width:120px}form.filter-bar button{margin:0 0 0 auto;justify-self:auto;grid-column:auto}form.report-form{grid-template-columns:repeat(3,minmax(0,1fr))}.report-form fieldset{grid-template-columns:repeat(3,minmax(0,1fr))}.report-form fieldset label{min-height:32px}.report-form button{margin-left:0}.editor-panel{padding:0;margin:20px 0;background:white;border:1px solid var(--border);border-radius:8px}.editor-panel>summary{padding:16px 20px;font-size:13px;font-weight:600;color:#2c503b}.editor-panel[open]>summary{border-bottom:1px solid var(--border)}.editor-panel>form{border:0;margin:0}.editor-panel>div{padding:20px}.compact-forms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.compact-forms form{display:flex;flex-wrap:wrap;align-items:end;padding:14px;margin:0;gap:10px}.compact-forms form label{flex:1;min-width:120px}.compact-forms form button{margin:0;flex:none}.editor-panel>.report-form{padding:20px}.editor-panel>a{display:inline-block;margin:16px 20px}.editor-panel .editor-panel{margin:0 20px 20px}td form,td form.filter-bar{display:flex;flex-wrap:wrap;padding:0;gap:8px;align-items:end}td form label{min-width:100px;flex:1}td form button{grid-column:auto;margin:0;justify-self:auto}td form input,td form select{min-height:32px}td form label:has(>input[type=checkbox]){min-width:0}td form textarea{min-height:72px}
@container(max-width:900px){form,form fieldset{grid-template-columns:repeat(2,minmax(0,1fr))}.compact-forms{grid-template-columns:minmax(0,1fr)}}@container(max-width:540px){form,form fieldset,form.report-form,.report-form fieldset{grid-template-columns:minmax(0,1fr)}form{padding:18px;gap:16px}form fieldset{padding:14px}.workspace-bar{align-items:start;flex-direction:column;gap:8px}.workspace-bar [role=navigation]{gap:2px}.workspace-bar a{padding:7px 8px}.editor-panel>summary{padding:14px 16px}.editor-panel>div{padding:14px}form>button{width:100%}form.filter-bar button{width:auto}.compact-forms form label{min-width:100px}.period-selector label{flex:1}}
th{white-space:normal;min-width:96px;max-width:220px;line-height:1.5}th:first-child,td:first-child{min-width:140px}td:first-child{max-width:360px;white-space:normal;overflow-wrap:anywhere}th.table-action,td.table-action{width:1%;min-width:80px;max-width:120px;white-space:nowrap}.section-tabs{display:flex;gap:4px;padding:0 0 12px;border-bottom:1px solid var(--border);margin-bottom:20px;overflow-x:auto}.section-tabs a{color:#496655;background:transparent;border-radius:5px;white-space:nowrap}.section-tabs a[aria-current=location]{background:#e3eee6;color:#174e37;font-weight:600}.section-tabs a:hover{background:#e8eeea}
form[method=get]:not(.report-form){display:flex;align-items:end;padding:16px;gap:12px}form[method=get]:not(.report-form)>label{flex:0 1 200px;min-width:120px}form[method=get]:not(.report-form)>button{margin:0 0 0 auto;width:auto;grid-column:auto}.row-dialog{width:min(800px,calc(100vw - 32px));max-height:85dvh;border:1px solid var(--border);border-radius:10px;padding:24px;color:#20372e;background:#fff;box-shadow:0 20px 80px #12352833;white-space:normal}.row-dialog::backdrop{background:#122b2266}.row-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.row-dialog h2{margin:0}.row-dialog [data-close-editor]{padding:4px 10px;min-height:32px;background:#f0f4f1;border-color:var(--border);color:#34523f;font-size:20px}.row-dialog form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 16px;padding:0;margin:0 0 16px;white-space:normal}.row-dialog form label{min-width:0}.row-dialog form input,.row-dialog form select{max-width:100%;min-height:38px}.row-dialog form>button{grid-column:1/-1;justify-self:end}.row-dialog form textarea{min-height:104px}form[data-command^=delete]>button{background:#fff;color:#9b4136;border-color:#dfbbb5}@media(max-width:800px){.row-dialog{padding:20px}.row-dialog form{grid-template-columns:minmax(0,1fr)}}
[data-editor-status]{padding:12px;border-radius:5px;background:#fcf4de;color:#724c12;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}[data-editor-status]:empty{display:none}
.chart-legend{display:flex;flex-wrap:wrap;gap:10px 20px;list-style:none;margin:12px 0 0;padding:0;font-size:12px;color:#4b6357}.chart-legend li{display:flex;align-items:center;gap:6px}.chart-legend span{display:inline-block;width:10px;height:10px;border-radius:2px}.chart-empty{padding:24px 12px;color:var(--muted);text-align:center;font-size:13px}.chart-axis{font-size:10px;fill:#62756c}.workspace-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.workspace-tools>button{background:#fff;color:#34583f;border-color:var(--border);min-height:32px;padding:5px 10px}.workspace-bar{flex-wrap:wrap}.workspace-tools details{position:relative;margin:0;padding:0;border:0;background:transparent}.workspace-tools summary{font-size:12px;font-weight:500;padding:7px 10px}.notification-popover{position:absolute;right:0;top:100%;z-index:20;width:min(360px,calc(100vw - 48px));background:#fff;border:1px solid var(--border);box-shadow:0 10px 32px #12352822;border-radius:8px;padding:12px;max-height:400px;overflow:auto}.notification-item{padding:12px 0;border-bottom:1px solid var(--border);font-size:12px}.notification-item:last-child{border:0}.notification-item a{padding:0;display:block}.notification-item small{color:var(--muted)}.notification-item button{background:#fff;color:var(--green);border-color:var(--border);font-size:11px;min-height:28px;padding:3px 8px;margin-top:8px}.notification-count{font-variant-numeric:tabular-nums;color:var(--green);font-weight:600}.utility-empty{background:#fff;border:1px solid var(--border);padding:24px;border-radius:8px;color:var(--muted)}
@media(prefers-reduced-motion:no-preference){button,nav a{transition:background-color .15s}}
`
