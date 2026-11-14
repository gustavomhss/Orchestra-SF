import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"
import { renderBiView } from "../../../../modules/sucafina/Sucafinav1/product/analytics/view.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BiPresentation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"

const root = document.querySelector<HTMLElement>("[data-sf-bi]")
if (root) {
  const initial = new URL(location.href)
  const form = document.createElement("form")
  const view = document.createElement("select")
  view.setAttribute("aria-label", "Visualização")
  for (const entry of biViews) { const option = document.createElement("option"); option.value = entry.id; option.textContent = entry.question; view.append(option) }
  view.value = initial.searchParams.get("viewId") ?? "BI01"
  const start = document.createElement("input"), end = document.createElement("input")
  start.type = end.type = "date"
  start.setAttribute("aria-label", "Início"); end.setAttribute("aria-label", "Fim")
  start.value = initial.searchParams.get("start") ?? `${new Date().getFullYear()}-01-01`
  end.value = initial.searchParams.get("end") ?? `${new Date().getFullYear()}-12-31`
  const button = document.createElement("button")
  button.type = "submit"; button.textContent = "Atualizar visualização"
  form.append(view, start, end, button)
  const status = document.createElement("p"), content = document.createElement("div")
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite")
  root.replaceChildren(form, status, content)
  let generation = 0
  let controller: AbortController | undefined
  const load = async () => {
    controller?.abort(); controller = new AbortController()
    const attempt = ++generation
    const endpoint = new URL(location.href)
    endpoint.search = new URLSearchParams({ sf: "bi-data", viewId: view.value, start: start.value, end: end.value }).toString()
    const selectionRef = initial.searchParams.get("selectionRef")
    if (selectionRef) endpoint.searchParams.set("selectionRef", selectionRef)
    button.disabled = true; content.replaceChildren(); status.textContent = "Carregando dados autorizados…"
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      const body: unknown = await response.json()
      if (attempt !== generation) return
      if (!response.ok || !body || typeof body !== "object" || !("request" in body) || !("projection" in body) || !("presentation" in body)) throw new Error("unavailable")
      const request = decodeSfOperationInput("sf_bi_view", body.request), projection = decodeSfOperationOutput("sf_bi_view", body.projection)
      if (!request.ok || !projection.ok || request.value.viewId !== view.value || request.value.period.start !== start.value || request.value.period.end !== end.value ||
        !body.presentation || typeof body.presentation !== "object" || !("viewId" in body.presentation) || body.presentation.viewId !== view.value ||
        !("series" in body.presentation) || !Array.isArray(body.presentation.series) || !("limitations" in body.presentation) || !Array.isArray(body.presentation.limitations)) throw new Error("invalid")
      const chart = renderBiView(request.value, projection.value, async (selection) => {
        const source = new URL(location.href)
        source.search = new URLSearchParams({ sf: "bi-source", selectionRef: selection.selectionRef }).toString()
        const opened = await fetch(source, { credentials: "same-origin", cache: "no-store" })
        const value: unknown = await opened.json()
        if (!opened.ok || !value || typeof value !== "object" || !("url" in value) || typeof value.url !== "string") { status.textContent = "A origem não está disponível para esta seleção."; return }
        const destination = new URL(value.url, location.href)
        if (destination.origin === location.origin && destination.pathname === location.pathname && !destination.hash) location.assign(destination)
      }, body.presentation as BiPresentation)
      content.replaceChildren(chart); status.textContent = "Dados atualizados."
    } catch { if (attempt === generation) status.textContent = "Seleção indisponível. Abra esta análise a partir dos dados ou versões que deseja comparar." }
    finally { if (attempt === generation) button.disabled = false }
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); void load() })
  window.addEventListener("pagehide", () => { generation++; controller?.abort(); content.replaceChildren() }, { once: true })
  void load()
}
