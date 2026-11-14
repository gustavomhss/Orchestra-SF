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
  let generation = 0, optionsGeneration = 0, activeReads = 0
  let stopped = false, accessChanged = false
  let controller: AbortController | undefined, optionsController: AbortController | undefined
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const pendingReads = new Set<AbortController>()
  const stopRefresh = () => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = undefined }
  const scheduleRefresh = () => {
    stopRefresh()
    if (stopped || accessChanged || activeReads || document.hidden) return
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined
      if (selection.value) void load()
      else void loadOptions(true)
    }, 30_000)
  }
  const boundedRead = async <T>(parent: AbortController, work: (signal: AbortSignal) => Promise<T>) => {
    const current = new AbortController()
    const abort = () => current.abort(parent.signal.reason)
    parent.signal.addEventListener("abort", abort, { once: true })
    if (parent.signal.aborted) abort()
    pendingReads.add(current); activeReads++; stopRefresh()
    // Bound headers and body together. A stalled read cannot suspend access
    // checks forever; this is separate from the host's authorization decision.
    const timer = setTimeout(() => current.abort(new Error("A leitura demorou demais. Recarregue os dados autorizados.")), 30_000)
    const cancelTimer = () => clearTimeout(timer)
    current.signal.addEventListener("abort", cancelTimer, { once: true })
    if (current.signal.aborted) cancelTimer()
    try { return await work(current.signal) }
    finally { clearTimeout(timer); current.signal.removeEventListener("abort", cancelTimer); parent.signal.removeEventListener("abort", abort); pendingReads.delete(current); activeReads--; scheduleRefresh() }
  }
  const option = (value: string, label: string) => { const node = document.createElement("option"); node.value = value; node.textContent = label; return node }
  const choiceState = () => {
    planner.hidden = selection.value !== "planner"
    button.disabled = !selection.value || selection.value === "planner" && (!baseline.value || !candidate.value || !/^[A-Z]{3}$/.test(currency.value))
  }
  const safeDestination = (value: string) => {
    const url = new URL(value, location.href), prefix = location.pathname.replace(/\/dashboard\/?$/, "")
    return url.origin === location.origin && ["dashboard", "planner", "procurement"].some((surface) => url.pathname === `${prefix}/${surface}`) ? url : undefined
  }
  const clearPrivate = () => {
    accessChanged = true; stopRefresh()
    generation++; optionsGeneration++; controller?.abort(); optionsController?.abort()
    for (const pending of pendingReads) pending.abort()
    selection.replaceChildren(option("", "Escolha os dados autorizados")); baseline.replaceChildren(option("", "Escolha a versão base")); candidate.replaceChildren(option("", "Escolha a versão candidata"))
    links.replaceChildren(); content.replaceChildren(); choiceState()
    status.textContent = "O acesso mudou. Abra novamente os dados autorizados."
  }
  const readJson = (url: URL, parent: AbortController) => boundedRead(parent, async (signal) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal })
    if (response.status === 401 || response.status === 403) { clearPrivate(); await response.body?.cancel(); return undefined }
    return { response, body: await response.json() }
  })
  const loadOptions = async (preserveSelection = false) => {
    if (stopped) return false
    const held = preserveSelection ? { selection: selection.value, baseline: baseline.value, candidate: candidate.value } : undefined
    optionsController?.abort(); optionsController = new AbortController(); controller?.abort(); generation++
    const attempt = ++optionsGeneration
    selection.replaceChildren(option("", "Escolha os dados autorizados")); baseline.replaceChildren(option("", "Escolha a versão base")); candidate.replaceChildren(option("", "Escolha a versão candidata"))
    links.replaceChildren(); content.replaceChildren(); choiceState(); status.textContent = "Carregando escolhas autorizadas…"
    const endpoint = new URL(location.href)
    endpoint.search = new URLSearchParams({ sf: "bi-options", viewId: view.value, start: start.value, end: end.value }).toString()
    try {
      const found = await readJson(endpoint, optionsController)
      if (!found) return false
      const { response, body } = found
      if (attempt !== optionsGeneration) return false
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
      const previous = held?.selection ?? initial.searchParams.get("selectionRef")
      if (previous && data.choices.some((entry) => entry.selectionRef === previous)) selection.value = previous
      else if (previous === "planner" && data.versions.some((entry) => entry.ref === held?.baseline) && data.versions.some((entry) => entry.ref === held?.candidate)) { selection.value = "planner"; baseline.value = held!.baseline; candidate.value = held!.candidate }
      else if (!previous && ["BI01", "BI07", "BI08"].includes(view.value) && data.choices.length === 1) selection.value = data.choices[0]!.selectionRef
      status.textContent = ["Escolha os dados e atualize a visualização.", ...data.limitations].join(" ")
      accessChanged = false
      choiceState()
      return true
    } catch (error) { if (attempt === optionsGeneration) status.textContent = `Não foi possível obter as escolhas: ${error instanceof Error ? error.message : "indisponível"}. Recarregue após verificar o acesso e o período.`; return false }
    finally { scheduleRefresh() }
  }
  const load = async (explicitSelection = true) => {
    if (stopped) return
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
      const active = controller
      const found = await readJson(endpoint, active)
      if (!found) return
      const { response, body } = found
      if (attempt !== generation) return
      if (!response.ok || !body || typeof body !== "object" || !("request" in body) || !("projection" in body) || !("presentation" in body)) throw new Error(typeof body?.reason === "string" ? body.reason : "Seleção indisponível")
      const request = decodeSfOperationInput("sf_bi_view", body.request), projection = decodeSfOperationOutput("sf_bi_view", body.projection)
      if (!request.ok || !projection.ok || request.value.viewId !== view.value || request.value.period.start !== start.value || request.value.period.end !== end.value || body.presentation?.viewId !== view.value || !Array.isArray(body.presentation.series) || !Array.isArray(body.presentation.limitations)) throw new Error("Resposta fora da seleção")
      const chart = renderBiView(request.value, projection.value, async (selected) => {
        if (attempt !== generation || active.signal.aborted) return
        try {
        const source = new URL(location.href)
        source.search = new URLSearchParams({ sf: "bi-source", selectionRef: selected.selectionRef, viewId: request.value.viewId, start: request.value.period.start, end: request.value.period.end, valueId: selected.valueId }).toString()
        if (selected.reference) source.searchParams.set("referenceDigest", selected.reference.refDigest)
        const found = await readJson(source, active)
        if (!found) return
        const opened = found.response, value = found.body
        if (attempt !== generation || active.signal.aborted) return
        if (!opened.ok || !Array.isArray(value?.links) || !value.links.length) { status.textContent = "A origem não está disponível para esta seleção. Recarregue as escolhas e confira seu acesso."; return }
        const sources = document.createElement("nav"); sources.setAttribute("aria-label", "Origens autorizadas do valor")
        for (const link of value.links) { const destination = typeof link.url === "string" ? safeDestination(link.url) : undefined; if (!destination) continue; const anchor = document.createElement("a"); anchor.href = destination.toString(); anchor.textContent = link.label; sources.append(anchor, document.createTextNode(" ")) }
        content.append(sources)
        } catch { if (attempt === generation && !active.signal.aborted) status.textContent = "A origem não está disponível. Recarregue as escolhas autorizadas." }
      }, body.presentation as BiPresentation)
      content.replaceChildren(chart); status.textContent = "Dados atualizados."; accessChanged = false
    } catch (error) { if (attempt === generation) status.textContent = `Seleção indisponível: ${error instanceof Error ? error.message : "erro de leitura"}. Recarregue as escolhas; nenhum resultado alternativo foi selecionado.` }
    finally { if (attempt === generation) choiceState(); scheduleRefresh() }
  }
  selection.addEventListener("change", choiceState); baseline.addEventListener("change", choiceState); candidate.addEventListener("change", choiceState); currency.addEventListener("input", choiceState)
  view.addEventListener("change", () => { void loadOptions() }); start.addEventListener("change", () => { void loadOptions() }); end.addEventListener("change", () => { void loadOptions() })
  reload.addEventListener("click", () => { void loadOptions() }); form.addEventListener("submit", (event) => { event.preventDefault(); void load() })
  let checkingAccess = false
  const refreshAuthorized = async () => {
    if (stopped || checkingAccess) return
    checkingAccess = true
    const selected = !!selection.value
    try { if (await loadOptions(true) && selected && selection.value && !button.disabled) await load() }
    finally { checkingAccess = false; scheduleRefresh() }
  }
  window.addEventListener("focus", () => { void refreshAuthorized() })
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopRefresh(); else void refreshAuthorized() })
  for (const refresh of document.querySelectorAll<HTMLButtonElement>("[data-refresh-view]"))
    refresh.addEventListener("click", () => { void refreshAuthorized() })
  for (const logout of document.querySelectorAll<HTMLButtonElement>("[data-logout]")) logout.addEventListener("click", async () => {
    // The canonical shell binds its sign-out handler before this bundle.
    // Standalone mounting still has a fallback, without issuing a second POST.
    if (logout.dataset.bound === "true") return
    if (stopped) return
    logout.disabled = true
    try {
      // Preserve the mounted shell's actual sign-out protocol and destination.
      const response = await boundedRead(new AbortController(), (signal) => fetch(new URL("./auth/logout", location.href), { method: "POST", credentials: "same-origin", signal }))
      void response.body?.cancel().catch(() => undefined)
      if (!response.ok) { status.textContent = "Sign out failed. Please retry."; return }
      stopped = true; clearPrivate()
      location.assign(new URL("./auth/login", location.href).href)
    } catch { if (!stopped) status.textContent = "Sign out failed. Please retry." }
    finally { logout.disabled = false }
  })
  const stop = () => { stopped = true; clearPrivate() }
  window.addEventListener("sf-access-revoked", stop, { once: true })
  window.addEventListener("pagehide", stop, { once: true })
  window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload() })
  void loadOptions().then((loaded) => { if (loaded && ["BI01", "BI07", "BI08"].includes(view.value) && !initial.searchParams.has("selectionRef")) void load(false) })
}
