import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"
import { renderBiView } from "../../../../modules/sucafina/Sucafinav1/product/analytics/view.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BiPresentation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { SfBiOptions } from "./extended-bi-options.ts"

const root = document.querySelector<HTMLElement>("[data-sf-bi]")
if (root) {
  const initial = new URL(location.href)
  const form = document.createElement("form"), view = document.createElement("select")
  view.setAttribute("aria-label", "Visualização")
  for (const entry of biViews) { const option = document.createElement("option"); option.value = entry.id; option.textContent = `${entry.id} · ${entry.question}`; view.append(option) }
  view.value = initial.searchParams.get("viewId") ?? "BI01"
  const start = document.createElement("input"), end = document.createElement("input")
  start.type = end.type = "date"; start.required = end.required = true
  start.setAttribute("aria-label", "Início"); end.setAttribute("aria-label", "Fim")
  start.value = initial.searchParams.get("start") ?? `${new Date().getFullYear()}-01-01`
  end.value = initial.searchParams.get("end") ?? `${new Date().getFullYear()}-12-31`
  const selection = document.createElement("select"), baseline = document.createElement("select"), candidate = document.createElement("select"), currency = document.createElement("input")
  selection.setAttribute("aria-label", "Dados para visualizar"); baseline.setAttribute("aria-label", "Versão base"); candidate.setAttribute("aria-label", "Versão candidata")
  currency.setAttribute("aria-label", "Moeda da comparação"); currency.value = "USD"; currency.pattern = "[A-Z]{3}"; currency.maxLength = 3
  const planner = document.createElement("fieldset"), legend = document.createElement("legend")
  legend.textContent = "Compare duas versões escolhidas"; planner.append(legend, baseline, candidate, currency); planner.hidden = true
  const button = document.createElement("button"); button.type = "submit"; button.textContent = "Atualizar visualização"
  const reload = document.createElement("button"); reload.type = "button"; reload.textContent = "Recarregar escolhas autorizadas"
  const links = document.createElement("nav"); links.setAttribute("aria-label", "Fontes e preparação de dados")
  form.append(view, start, end, selection, planner, button, reload)
  const status = document.createElement("p"), content = document.createElement("div")
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite")
  root.replaceChildren(form, links, status, content)
  let generation = 0, optionsGeneration = 0
  let controller: AbortController | undefined, optionsController: AbortController | undefined
  const option = (value: string, label: string) => { const node = document.createElement("option"); node.value = value; node.textContent = label; return node }
  const choiceState = () => {
    planner.hidden = selection.value !== "planner"
    button.disabled = !selection.value || selection.value === "planner" && (!baseline.value || !candidate.value || !/^[A-Z]{3}$/.test(currency.value))
  }
  const safeDestination = (value: string) => {
    const url = new URL(value, location.href), prefix = location.pathname.replace(/\/dashboard\/?$/, "")
    return url.origin === location.origin && ["dashboard", "planner", "procurement"].some((surface) => url.pathname === `${prefix}/${surface}`) ? url : undefined
  }
  const loadOptions = async () => {
    optionsController?.abort(); optionsController = new AbortController(); controller?.abort(); generation++
    const attempt = ++optionsGeneration
    selection.replaceChildren(option("", "Escolha os dados autorizados")); baseline.replaceChildren(option("", "Escolha a versão base")); candidate.replaceChildren(option("", "Escolha a versão candidata"))
    links.replaceChildren(); content.replaceChildren(); choiceState(); status.textContent = "Carregando escolhas autorizadas…"
    const endpoint = new URL(location.href)
    endpoint.search = new URLSearchParams({ sf: "bi-options", viewId: view.value, start: start.value, end: end.value }).toString()
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: optionsController.signal })
      const body = await response.json()
      if (attempt !== optionsGeneration) return
      if (!response.ok || body?.status !== "ok" || !Array.isArray(body.value?.choices) || !Array.isArray(body.value?.versions) || !Array.isArray(body.value?.links) || !Array.isArray(body.value?.limitations)) throw new Error(typeof body?.reason === "string" ? body.reason : "Escolhas indisponíveis")
      const data: SfBiOptions = body.value
      for (const entry of data.choices) selection.append(option(entry.selectionRef, entry.label))
      if (data.versions.length) {
        selection.append(option("planner", "Planner · escolher versões base e candidata"))
        for (const entry of data.versions) { baseline.append(option(entry.ref, entry.label)); candidate.append(option(entry.ref, entry.label)) }
      }
      for (const link of data.links) {
        const target = new URL(location.href); target.pathname = target.pathname.replace(/\/dashboard\/?$/, `/${link.surface}`)
        target.search = new URLSearchParams(link.page === "Workbench" ? { sf: "workbench", start: start.value, end: end.value } : { page: link.page, year: start.value.slice(0, 4) }).toString()
        const anchor = document.createElement("a"); anchor.href = target.toString(); anchor.textContent = link.label; links.append(anchor, document.createTextNode(" "))
      }
      const previous = initial.searchParams.get("selectionRef")
      if (previous && data.choices.some((entry) => entry.selectionRef === previous)) selection.value = previous
      else if (!previous && ["BI01", "BI07", "BI08"].includes(view.value) && data.choices.length === 1) selection.value = data.choices[0]!.selectionRef
      status.textContent = ["Escolha os dados e atualize a visualização.", ...data.limitations].join(" ")
      choiceState()
    } catch (error) { if (attempt === optionsGeneration) status.textContent = `Não foi possível obter as escolhas: ${error instanceof Error ? error.message : "indisponível"}. Recarregue após verificar o acesso e o período.` }
  }
  const load = async (explicitSelection = true) => {
    controller?.abort(); controller = new AbortController(); const attempt = ++generation
    const endpoint = new URL(location.href)
    endpoint.search = new URLSearchParams({ sf: "bi-data", viewId: view.value, start: start.value, end: end.value }).toString()
    if (explicitSelection) {
      if (selection.value === "planner") { endpoint.searchParams.set("baseRef", baseline.value); endpoint.searchParams.set("candidateRef", candidate.value); endpoint.searchParams.set("currency", currency.value) }
      else if (selection.value) endpoint.searchParams.set("selectionRef", selection.value)
      else { status.textContent = "Escolha os dados antes de abrir a análise."; return }
    }
    button.disabled = true; content.replaceChildren(); status.textContent = "Carregando dados autorizados…"
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: controller.signal }), body = await response.json()
      if (attempt !== generation) return
      if (!response.ok || !body || typeof body !== "object" || !("request" in body) || !("projection" in body) || !("presentation" in body)) throw new Error(typeof body?.reason === "string" ? body.reason : "Seleção indisponível")
      const request = decodeSfOperationInput("sf_bi_view", body.request), projection = decodeSfOperationOutput("sf_bi_view", body.projection)
      if (!request.ok || !projection.ok || request.value.viewId !== view.value || request.value.period.start !== start.value || request.value.period.end !== end.value || body.presentation?.viewId !== view.value || !Array.isArray(body.presentation.series) || !Array.isArray(body.presentation.limitations)) throw new Error("Resposta fora da seleção")
      const chart = renderBiView(request.value, projection.value, async (selected) => {
        const source = new URL(location.href)
        source.search = new URLSearchParams({ sf: "bi-source", selectionRef: selected.selectionRef, viewId: request.value.viewId, start: request.value.period.start, end: request.value.period.end, valueId: selected.valueId }).toString()
        const opened = await fetch(source, { credentials: "same-origin", cache: "no-store" }), value = await opened.json()
        if (!opened.ok || !Array.isArray(value?.links) || !value.links.length) { status.textContent = "A origem não está disponível para esta seleção. Recarregue as escolhas e confira seu acesso."; return }
        const sources = document.createElement("nav"); sources.setAttribute("aria-label", "Origens autorizadas do valor")
        for (const link of value.links) { const destination = typeof link.url === "string" ? safeDestination(link.url) : undefined; if (!destination) continue; const anchor = document.createElement("a"); anchor.href = destination.toString(); anchor.textContent = link.label; sources.append(anchor, document.createTextNode(" ")) }
        content.append(sources)
      }, body.presentation as BiPresentation)
      content.replaceChildren(chart); status.textContent = "Dados atualizados."
    } catch (error) { if (attempt === generation) status.textContent = `Seleção indisponível: ${error instanceof Error ? error.message : "erro de leitura"}. Recarregue as escolhas; nenhum resultado alternativo foi selecionado.` }
    finally { if (attempt === generation) choiceState() }
  }
  selection.addEventListener("change", choiceState); baseline.addEventListener("change", choiceState); candidate.addEventListener("change", choiceState); currency.addEventListener("input", choiceState)
  view.addEventListener("change", () => { void loadOptions() }); start.addEventListener("change", () => { void loadOptions() }); end.addEventListener("change", () => { void loadOptions() })
  reload.addEventListener("click", () => { void loadOptions() }); form.addEventListener("submit", (event) => { event.preventDefault(); void load() })
  window.addEventListener("pagehide", () => { generation++; optionsGeneration++; controller?.abort(); optionsController?.abort(); content.replaceChildren() }, { once: true })
  void loadOptions().then(() => { if (["BI01", "BI07", "BI08"].includes(view.value) && !initial.searchParams.has("selectionRef")) void load(false) })
}
