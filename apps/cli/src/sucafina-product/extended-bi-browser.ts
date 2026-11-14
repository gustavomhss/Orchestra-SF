import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"
import { renderBiView, restoreBiFocus } from "../../../../modules/sucafina/Sucafinav1/product/analytics/view.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BiPresentation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { SfBiOptions } from "./extended-bi-options.ts"
import { renderSfBiNavigationDetail, sfBiSourceNavigationKey } from "./extended-bi-navigation-view.ts"
import type { SfBiNavigation, SfBiNavigationDetail, SfBiNavigationKind } from "./extended-bi-navigation-view.ts"

const root = document.querySelector<HTMLElement>("[data-sf-bi]")
if (root) {
  const initial = new URL(location.href)
  // Navigation history carries identifiers and human choices only. Every
  // restoration still reopens the options and data through current authority.
  const historyValue = history.state?.sfExtendedBi
  const restored = historyValue && typeof historyValue === "object" && historyValue.path === initial.pathname ? historyValue : undefined
  const remembered = (key: string) => typeof restored?.[key] === "string" && restored[key].length <= 16_384 ? restored[key] as string : undefined
  const initialChoice = restored ? remembered("selection") ?? "" : initial.searchParams.get("selectionRef") ?? (initial.searchParams.has("baseRef") && initial.searchParams.has("candidateRef") ? "planner" : undefined)
  let restoreChoice: { selection: string | undefined; baseline: string; candidate: string } | undefined = { selection: initialChoice, baseline: remembered("baseline") ?? (restored ? "" : initial.searchParams.get("baseRef") ?? ""), candidate: remembered("candidate") ?? (restored ? "" : initial.searchParams.get("candidateRef") ?? "") }
  let returnFocus = remembered("focus"), restoreData = restored?.ready === true
  const form = document.createElement("form"), view = document.createElement("select")
  view.setAttribute("aria-label", "Visualização")
  for (const entry of biViews) { const option = document.createElement("option"); option.value = entry.id; option.textContent = `${entry.id} · ${entry.question}`; view.append(option) }
  const requestedView = remembered("viewId") ?? initial.searchParams.get("viewId")
  view.value = biViews.some((entry) => entry.id === requestedView) ? requestedView! : "BI01"
  const start = document.createElement("input"), end = document.createElement("input")
  start.type = end.type = "date"; start.required = end.required = true
  start.setAttribute("aria-label", "Início"); end.setAttribute("aria-label", "Fim")
  start.value = remembered("start") ?? initial.searchParams.get("start") ?? `${new Date().getFullYear()}-01-01`
  end.value = remembered("end") ?? initial.searchParams.get("end") ?? `${new Date().getFullYear()}-12-31`
  const selection = document.createElement("select"), baseline = document.createElement("select"), candidate = document.createElement("select"), currency = document.createElement("input")
  selection.setAttribute("aria-label", "Dados para visualizar"); baseline.setAttribute("aria-label", "Versão base"); candidate.setAttribute("aria-label", "Versão candidata")
  currency.setAttribute("aria-label", "Moeda da comparação"); currency.value = remembered("currency") ?? initial.searchParams.get("currency") ?? "USD"; currency.pattern = "[A-Z]{3}"; currency.maxLength = 3
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
  let displayed = false
  // Retain only destination identity and reading position. Every refresh must
  // obtain a new projection token and reopen the protected destination.
  type DetailSelection = { kind: SfBiNavigationKind; key: string; focus: string; selectionRef: string; viewId: string; start: string; end: string }
  let selectedDetail: DetailSelection | undefined
  let detailPosition: { x: number; y: number; focusIndex: number; regionOffsets: number[] } | undefined
  const captureDetailPosition = () => {
    const section = content.querySelector<HTMLElement>("[data-sf-bi-detail]")
    if (!section || !selectedDetail) return
    detailPosition = { x: window.scrollX, y: window.scrollY,
      focusIndex: [...section.querySelectorAll<HTMLElement>("button,a,[tabindex]")].indexOf(document.activeElement as HTMLElement),
      regionOffsets: [...section.querySelectorAll<HTMLElement>('[role="region"]')].map((region) => region.scrollLeft) }
  }
  const forgetDetail = () => { selectedDetail = undefined; detailPosition = undefined }
  const remember = () => {
    const state = history.state && typeof history.state === "object" ? history.state : {}
    history.replaceState({ ...state, sfExtendedBi: { path: location.pathname, viewId: view.value, start: start.value, end: end.value,
      selection: selection.value, baseline: baseline.value, candidate: candidate.value, currency: currency.value,
      ...(returnFocus ? { focus: returnFocus } : {}), ready: displayed } }, "")
  }
  const forget = () => {
    const state = history.state && typeof history.state === "object" ? { ...history.state } : {}
    delete state.sfExtendedBi
    history.replaceState(state, "")
  }
  const stopRefresh = () => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = undefined }
  const scheduleRefresh = () => {
    stopRefresh()
    if (stopped || accessChanged || activeReads || document.hidden || !root.isConnected) return
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
    try { const result = await work(current.signal); current.signal.throwIfAborted(); return result }
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
  const clearPrivate = (preserveNavigation = false) => {
    accessChanged = true; stopRefresh()
    generation++; optionsGeneration++; controller?.abort(); optionsController?.abort()
    for (const pending of pendingReads) pending.abort()
    selection.replaceChildren(option("", "Escolha os dados autorizados")); baseline.replaceChildren(option("", "Escolha a versão base")); candidate.replaceChildren(option("", "Escolha a versão candidata"))
    links.replaceChildren(); content.replaceChildren(); choiceState()
    forgetDetail()
    if (!preserveNavigation) { displayed = false; returnFocus = undefined; restoreChoice = undefined; restoreData = false; forget() }
    status.textContent = "O acesso mudou. Abra novamente os dados autorizados."
  }
  const readJson = (url: URL, parent: AbortController) => boundedRead(parent, async (signal) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal })
    if (response.status === 401 || response.status === 403) { clearPrivate(); await response.body?.cancel(); return undefined }
    return { response, body: await response.json() }
  })
  const loadOptions = async (preserveSelection = false) => {
    if (stopped) return false
    if (preserveSelection) captureDetailPosition()
    else forgetDetail()
    const held = preserveSelection ? { selection: selection.value, baseline: baseline.value, candidate: candidate.value } : restoreChoice
    restoreChoice = undefined
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
      const previous = held?.selection
      if (previous && data.choices.some((entry) => entry.selectionRef === previous)) selection.value = previous
      else if (previous === "planner" && data.versions.some((entry) => entry.ref === held?.baseline) && data.versions.some((entry) => entry.ref === held?.candidate)) { selection.value = "planner"; baseline.value = held!.baseline; candidate.value = held!.candidate }
      else if (previous === undefined && ["BI01", "BI07", "BI08"].includes(view.value) && data.choices.length === 1) selection.value = data.choices[0]!.selectionRef
      status.textContent = ["Escolha os dados e atualize a visualização.", ...data.limitations].join(" ")
      if (selectedDetail && !selection.value) { forgetDetail(); status.textContent = "O detalhe deixou de pertencer às escolhas autorizadas. Escolha os dados atuais para continuar." }
      accessChanged = false
      choiceState()
      remember()
      return true
    } catch (error) { if (attempt === optionsGeneration) status.textContent = `Não foi possível obter as escolhas: ${error instanceof Error ? error.message : "indisponível"}. Recarregue após verificar o acesso e o período.`; return false }
    finally { scheduleRefresh() }
  }
  const load = async (explicitSelection = true) => {
    if (stopped) return
    captureDetailPosition()
    const heldDetail = selectedDetail
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
      const navigation = body.navigation as SfBiNavigation | undefined
      let navigationAttempt = 0, navigationRead: AbortController | undefined
      const openDecision = async (kind: SfBiNavigationKind, key: string, focus: string, restoring = false) => {
        if (attempt !== generation || active.signal.aborted) return
        navigationRead?.abort(); const currentNavigation = ++navigationAttempt
        const entries = Array.isArray(navigation?.entries) ? navigation.entries.filter((entry) => entry?.kind === kind && entry.key === key && /^[a-f0-9]{64}$/.test(entry.token)) : []
        if (!navigation || !/^[a-f0-9]{64}$/.test(navigation.snapshot) || entries.length !== 1) { forgetDetail(); status.textContent = "O detalhe deixou de pertencer à análise atual. Escolha um destino autorizado para continuar."; if (returnFocus) restoreBiFocus(content, returnFocus); return }
        const position = restoring ? detailPosition : undefined
        forgetDetail()
        navigationRead = new AbortController()
        const currentRead = navigationRead
        const cancel = () => currentRead.abort(active.signal.reason)
        active.signal.addEventListener("abort", cancel, { once: true })
        returnFocus = focus; remember()
        content.querySelector("[data-sf-bi-detail]")?.remove()
        status.textContent = "Abrindo o detalhe autorizado desta análise…"
        try {
          const endpoint = new URL(location.href)
          endpoint.search = new URLSearchParams({ sf: "bi-decision", selectionRef: request.value.selectionRef, viewId: request.value.viewId, start: request.value.period.start, end: request.value.period.end, snapshot: navigation.snapshot, target: entries[0]!.token }).toString()
          const found = await readJson(endpoint, currentRead)
          if (!found || attempt !== generation || active.signal.aborted || currentRead.signal.aborted || currentNavigation !== navigationAttempt) return
          const detail = found.body?.value as SfBiNavigationDetail | undefined
          if (!found.response.ok || found.body?.status !== "ok" || !detail || typeof detail.title !== "string" || typeof detail.reference !== "string" || !Array.isArray(detail.facts) || !Array.isArray(detail.tables) || !Array.isArray(detail.links)) { status.textContent = "O detalhe mudou ou não está autorizado. Recarregue a seleção atual."; return }
          if (kind === "case") {
            const target = detail.links.map((link) => safeDestination(link.url)).find((url) => url?.searchParams.get("sf") === "workbench-case")
            if (!target) { status.textContent = "O case não tem um destino autorizado disponível."; return }
            location.assign(target.toString()); return
          }
          const opened = renderSfBiNavigationDetail(detail, safeDestination, () => {
            forgetDetail()
            opened.section.remove()
            status.textContent = "Análise atual preservada."
            if (returnFocus) restoreBiFocus(content, returnFocus)
          })
          selectedDetail = { kind, key, focus, selectionRef: request.value.selectionRef, viewId: request.value.viewId, start: request.value.period.start, end: request.value.period.end }
          content.prepend(opened.section)
          if (position) {
            for (const [index, region] of [...opened.section.querySelectorAll<HTMLElement>('[role="region"]')].entries()) region.scrollLeft = position.regionOffsets[index] ?? 0
            if (position.focusIndex >= 0) {
              const focused = opened.section.querySelectorAll<HTMLElement>("button,a,[tabindex]")[position.focusIndex]
              if (focused) focused.focus({ preventScroll: true })
              else opened.focus()
            }
            window.scrollTo(position.x, position.y)
          } else opened.focus()
          status.textContent = restoring ? "Detalhe reautorizado e posição de leitura preservada." : "Detalhe autorizado. Use Voltar à análise para retomar o mesmo ponto."
        } catch { if (attempt === generation && !active.signal.aborted && !currentRead.signal.aborted && currentNavigation === navigationAttempt) status.textContent = "Não foi possível abrir o detalhe. Recarregue os dados autorizados." }
        finally { active.signal.removeEventListener("abort", cancel) }
      }
      const chart = renderBiView(request.value, projection.value, async (selected) => {
        if (attempt !== generation || active.signal.aborted) return
        forgetDetail()
        navigationRead?.abort(); const currentNavigation = ++navigationAttempt
        if (!selected.reference) { status.textContent = "Escolha uma origem explícita deste valor."; return }
        navigationRead = new AbortController(); const currentRead = navigationRead
        const cancel = () => currentRead.abort(active.signal.reason)
        active.signal.addEventListener("abort", cancel, { once: true })
        returnFocus = selected.valueId; remember()
        content.querySelector("[data-sf-bi-detail]")?.remove()
        try {
        const source = new URL(location.href)
        source.search = new URLSearchParams({ sf: "bi-source", selectionRef: selected.selectionRef, viewId: request.value.viewId, start: request.value.period.start, end: request.value.period.end, valueId: selected.valueId, referenceDigest: selected.reference.refDigest }).toString()
        const found = await readJson(source, currentRead)
        if (!found) return
        const opened = found.response, value = found.body
        if (attempt !== generation || active.signal.aborted || currentRead.signal.aborted || currentNavigation !== navigationAttempt) return
        if (!opened.ok || !Array.isArray(value?.links) || !value.links.length) { status.textContent = "A origem não está disponível para esta seleção. Recarregue as escolhas e confira seu acesso."; return }
        const sources = document.createElement("nav"); sources.setAttribute("aria-label", "Origens autorizadas do valor")
        for (const link of value.links) { const destination = typeof link.url === "string" ? safeDestination(link.url) : undefined; if (!destination) continue; const anchor = document.createElement("a"); anchor.href = destination.toString(); anchor.textContent = link.label; sources.append(anchor, document.createTextNode(" ")) }
        content.append(sources)
        } catch { if (attempt === generation && !active.signal.aborted && !currentRead.signal.aborted && currentNavigation === navigationAttempt) status.textContent = "A origem não está disponível. Recarregue as escolhas autorizadas." }
        finally { active.signal.removeEventListener("abort", cancel) }
      }, body.presentation as BiPresentation, {
        openSource: (source) => { void openDecision("source", sfBiSourceNavigationKey(source), source.id) },
        openEvidence: (reference) => { void openDecision("evidence", reference.refDigest, reference.refId) },
        openCoverage: (reference) => { void openDecision("coverage", reference, reference) },
        openQuestion: (reference) => { void openDecision("question", reference, reference) },
        openResult: (reference) => { void openDecision("result", reference, reference) },
        openCase: (reference) => { void openDecision("case", reference, reference) },
      })
      content.replaceChildren(chart); status.textContent = "Dados atualizados."; accessChanged = false
      displayed = true; remember()
      if (heldDetail) {
        if (heldDetail.selectionRef === request.value.selectionRef && heldDetail.viewId === request.value.viewId && heldDetail.start === request.value.period.start && heldDetail.end === request.value.period.end)
          await openDecision(heldDetail.kind, heldDetail.key, heldDetail.focus, true)
        else { forgetDetail(); status.textContent = "A seleção mudou durante a atualização. Escolha um detalhe da análise atual."; if (returnFocus) restoreBiFocus(content, returnFocus) }
      } else if (returnFocus) restoreBiFocus(content, returnFocus)
    } catch (error) { if (attempt === generation) status.textContent = `Seleção indisponível: ${error instanceof Error ? error.message : "erro de leitura"}. Recarregue as escolhas; nenhum resultado alternativo foi selecionado.` }
    finally { if (attempt === generation) choiceState(); scheduleRefresh() }
  }
  const selectionChanged = () => {
    forgetDetail()
    generation++; optionsGeneration++; controller?.abort(); optionsController?.abort(); content.replaceChildren()
    status.textContent = "Atualize a visualização para a seleção atual."
    displayed = false; returnFocus = undefined; restoreChoice = undefined; restoreData = false; remember()
    choiceState(); scheduleRefresh()
  }
  selection.addEventListener("change", selectionChanged); baseline.addEventListener("change", selectionChanged); candidate.addEventListener("change", selectionChanged); currency.addEventListener("input", selectionChanged)
  const filtersChanged = () => { forgetDetail(); displayed = false; returnFocus = undefined; restoreChoice = undefined; restoreData = false; void loadOptions() }
  view.addEventListener("change", filtersChanged); start.addEventListener("change", filtersChanged); end.addEventListener("change", filtersChanged)
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
    if (logout.dataset.bound === "true") { clearPrivate(); return }
    if (stopped) return
    clearPrivate()
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
  window.addEventListener("pagehide", () => { stopped = true; clearPrivate(true) }, { once: true })
  window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload() })
  void loadOptions().then((loaded) => {
    if (!loaded) return
    if (restoreData && selection.value && !button.disabled) void load()
    else if (!restored && ["BI01", "BI07", "BI08"].includes(view.value) && !initial.searchParams.has("selectionRef")) void load(false)
    restoreData = false
  })
}
