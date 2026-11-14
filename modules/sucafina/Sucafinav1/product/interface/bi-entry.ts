import { biViews } from "../analytics/catalog.ts"
import type { BiSelection } from "../analytics/catalog.ts"
import type { BiPresentation } from "../analytics/semantics.ts"
import { renderBiView, restoreBiFocus } from "../analytics/view.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { isSfPeriod } from "../contracts/validation.ts"

/** The server authenticates every data request and resolves the selection itself. */
export function initializeSfBi(root: HTMLElement) {
  if (root.dataset.biInitialized) return
  root.dataset.biInitialized = "true"
  const url = new URL(document.location.href)
  const restored = history.state && typeof history.state === "object" && history.state.sfBiFilter && typeof history.state.sfBiFilter === "object" ? history.state.sfBiFilter : undefined
  const year = new Date().getFullYear()
  const controls = document.createElement("form")
  const view = document.createElement("select")
  view.setAttribute("aria-label", "Visualização")
  for (const entry of biViews) {
    const option = document.createElement("option")
    option.value = entry.id
    option.textContent = entry.question
    view.append(option)
  }
  const requestedView = typeof restored?.viewId === "string" ? restored.viewId : url.searchParams.get("viewId")
  view.value = biViews.some((entry) => entry.id === requestedView) ? requestedView! : "BI01"
  const start = document.createElement("input")
  start.type = "date"
  start.setAttribute("aria-label", "Início")
  start.value = (typeof restored?.start === "string" ? restored.start : url.searchParams.get("start")) || `${year}-01-01`
  const end = document.createElement("input")
  end.type = "date"
  end.setAttribute("aria-label", "Fim")
  end.value = (typeof restored?.end === "string" ? restored.end : url.searchParams.get("end")) || `${year}-12-31`
  const submit = document.createElement("button")
  submit.type = "submit"
  submit.textContent = "Atualizar visualização"
  controls.append(view, start, end, submit)
  const status = document.createElement("p")
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")
  const content = document.createElement("div")
  root.replaceChildren(controls, status, content)
  const savedFocus = history.state && typeof history.state === "object" && typeof history.state.sfBiFocus === "string" ? history.state.sfBiFocus : undefined
  const state: { generation: number; controller?: AbortController; focus?: BiSelection | string } = { generation: 0, focus: savedFocus }

  async function openSource(selection: BiSelection) {
    const generation = state.generation
    state.focus = selection
    status.textContent = "Verificando acesso à fonte…"
    root.dispatchEvent(new CustomEvent("sf-bi-source", { bubbles: true, detail: selection }))
    try {
      const endpoint = new URL(document.location.href)
      endpoint.search = ""
      endpoint.hash = ""
      endpoint.searchParams.set("sf", "bi-source")
      endpoint.searchParams.set("selectionRef", selection.selectionRef)
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" })
      if (!response.ok) throw new Error("source-unavailable")
      const body: unknown = await response.json()
      if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string" || !("source" in body) || !body.source || typeof body.source !== "object" || !("id" in body.source) || typeof body.source.id !== "string" || !("version" in body.source) || typeof body.source.version !== "number") throw new Error("invalid-source")
      const target = new URL(body.url, document.location.href)
      if (generation !== state.generation || target.origin !== document.location.origin || target.pathname !== document.location.pathname || target.hash || [...target.searchParams.keys()].some((key) => !["page", "year"].includes(key)) || target.searchParams.getAll("page").length !== 1 || target.searchParams.getAll("year").length !== 1 || !target.searchParams.get("page") || !/^\d{4}$/.test(target.searchParams.get("year") ?? "")) throw new Error("invalid-target")
      history.replaceState({ ...(history.state && typeof history.state === "object" ? history.state : {}), sfBiFocus: selection.valueId }, "")
      document.location.assign(target.href)
    } catch {
      if (generation === state.generation) status.textContent = "Fonte indisponível ou alterada. Atualize a visualização e tente novamente."
    }
  }

  async function load() {
    state.controller?.abort()
    const generation = ++state.generation
    content.replaceChildren()
    if (!isSfPeriod({ start: start.value, end: end.value }) || !biViews.some((entry) => entry.id === view.value)) {
      submit.disabled = false
      state.controller = undefined
      status.textContent = "Escolha uma visualização e um período válido."
      return
    }
    if (["BI01", "BI07"].includes(view.value)) {
      if (start.value.slice(0, 4) !== end.value.slice(0, 4)) {
        submit.disabled = false
        state.controller = undefined
        status.textContent = "Escolha meses completos dentro do mesmo ano."
        return
      }
      start.value = `${start.value.slice(0, 7)}-01`
      const lastDay = new Date(Date.UTC(Number(end.value.slice(0, 4)), Number(end.value.slice(5, 7)), 0)).getUTCDate()
      end.value = `${end.value.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`
    }
    const controller = new AbortController()
    state.controller = controller
    const endpoint = new URL(document.location.href)
    endpoint.search = ""
    endpoint.hash = ""
    endpoint.searchParams.set("sf", "bi-data")
    endpoint.searchParams.set("viewId", view.value)
    endpoint.searchParams.set("start", start.value)
    endpoint.searchParams.set("end", end.value)
    status.textContent = "Carregando visualização…"
    submit.disabled = true
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      if (!response.ok) throw new Error("unavailable")
      const body: unknown = await response.json()
      if (!body || typeof body !== "object" || !("request" in body) || !("projection" in body) || !("presentation" in body)) throw new Error("invalid")
      const request = decodeSfOperationInput("sf_bi_view", body.request)
      const projection = decodeSfOperationOutput("sf_bi_view", body.projection)
      if (!request.ok || !projection.ok || request.value.viewId !== view.value || request.value.period.start !== start.value || request.value.period.end !== end.value) throw new Error("invalid")
      if (!body.presentation || typeof body.presentation !== "object" || !("viewId" in body.presentation) || body.presentation.viewId !== view.value || !("series" in body.presentation) || !Array.isArray(body.presentation.series) || !("limitations" in body.presentation) || !Array.isArray(body.presentation.limitations)) throw new Error("invalid")
      if (generation !== state.generation) return
      const chart = renderBiView(request.value, projection.value, (selection) => { void openSource(selection) }, body.presentation as BiPresentation)
      chart.addEventListener("click", (event) => {
        if (!(event.target instanceof Element) || !event.target.closest("[data-bi-focus-fallback]")) return
        const first = chart.querySelector<HTMLInputElement>('[aria-label="Início do período"]')
        const last = chart.querySelector<HTMLInputElement>('[aria-label="Fim do período"]')
        if (!first || !last) return
        event.preventDefault()
        event.stopImmediatePropagation()
        start.value = first.value
        end.value = last.value
        void load()
      }, true)
      content.replaceChildren(chart)
      history.replaceState({ ...(history.state && typeof history.state === "object" ? history.state : {}), sfBiFilter: { viewId: view.value, start: start.value, end: end.value } }, "")
      status.textContent = `Visualização atualizada para ${start.value} – ${end.value}${["BI01", "BI07"].includes(view.value) ? " (meses completos)" : ""}.`
      if (state.focus) restoreBiFocus(content, state.focus)
    } catch {
      if (generation !== state.generation || controller.signal.aborted) return
      content.replaceChildren()
      status.textContent = "Visualização indisponível. Verifique o período e tente novamente."
    } finally {
      if (generation === state.generation) { submit.disabled = false; state.controller = undefined }
    }
  }
  controls.addEventListener("submit", (event) => { event.preventDefault(); void load() })
  root.addEventListener("sf-bi-restore-focus", () => { if (state.focus) restoreBiFocus(content, state.focus) })
  window.addEventListener("pageshow", (event) => { if (event.persisted) void load() })
  void load()
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLElement>("[data-sf-bi]").forEach(initializeSfBi)
})
