import { createReviewBrowser } from "../../../../modules/sucafina/Sucafinav1/product/reviews/browser.ts"
import { createReviewPreparationView } from "../../../../modules/sucafina/Sucafinav1/product/reviews/workspace.ts"
import type { ReviewAgendaItem } from "../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import type { PreservedReview, DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SfReviewUpdate } from "./extended-review-cycle.ts"

const root = document.querySelector<HTMLElement>("[data-sf-review-workspace]")
const bootstrap = document.querySelector<HTMLScriptElement>("script[data-sf-review-bootstrap]")
const reviewUrl = (reviewRef: string, sectionId?: string) => {
  const url = new URL(location.href)
  url.searchParams.set("sf", "review"); url.searchParams.set("reviewRef", reviewRef)
  url.searchParams.delete("previousReviewRef"); url.searchParams.delete("sectionId")
  if (sectionId) url.searchParams.set("sectionId", sectionId)
  return url
}
if (root && bootstrap) {
  const value = JSON.parse(bootstrap.textContent ?? "null")
  if (value && typeof value === "object" && typeof value.reviewRef === "string") {
    const status = document.createElement("p"), sources = document.createElement("nav")
    status.setAttribute("role", "status"); sources.setAttribute("aria-label", "Origens autorizadas da revisão")
    const openSource = async (reference: BusinessEvidenceRef) => {
      sources.replaceChildren(); status.textContent = "Conferindo a origem e seu acesso…"
      const url = new URL(location.href)
      url.search = new URLSearchParams({ sf: "review-source", reviewRef: value.reviewRef, referenceId: reference.refId }).toString()
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined), body = await response?.json().catch(() => undefined)
      if (!response?.ok || !Array.isArray(body?.links) || !body.links.length) { status.textContent = "A origem mudou, foi substituída ou não está mais acessível. A revisão preservada permanece separada dos dados atuais."; return }
      const prefix = location.pathname.replace(/\/dashboard\/?$/, "")
      for (const link of body.links) {
        if (typeof link.url !== "string" || typeof link.label !== "string") continue
        const destination = new URL(link.url, location.href)
        if (destination.origin !== location.origin || !["dashboard", "planner", "procurement"].some((surface) => destination.pathname === `${prefix}/${surface}`)) continue
        const anchor = document.createElement("a"); anchor.href = destination.toString(); anchor.textContent = link.label; sources.append(anchor, document.createTextNode(" "))
      }
      status.textContent = "Escolha a origem autorizada para abri-la."
    }
    const view = createReviewBrowser({ reviewRef: value.reviewRef,
      checkUpdate: async (reference) => {
        const url = new URL(location.href); url.search = new URLSearchParams({ sf: "review-update", reviewRef: reference }).toString()
        const response = await fetch(url, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined), body = await response?.json().catch(() => undefined)
        if (!response?.ok || body?.status !== "ok" || typeof body.value?.available !== "boolean") {
          status.textContent = typeof body?.reason === "string" ? `Não foi possível conferir a atualização: ${body.reason}.` : "Não foi possível conferir a atualização. Verifique seu acesso e tente novamente."
          return { status: response?.status === 403 ? "denied" : "unavailable", reason: "review-update-unavailable" }
        }
        status.textContent = body.value.available ? "Há uma fonte atualizada. A sucessora preservará vínculo, tópicos, períodos e notas; confira e confirme a seleção atual de registros." : "As fontes conferidas mantêm as versões preservadas."
        if (body.value.unavailableSections?.length) status.textContent += " Alguns tópicos exigem nova seleção explícita de origem."
        return { status: "ok", value: { available: body.value.available } }
      },
      requestUpdate: (reference) => {
        const url = new URL(location.href); url.searchParams.delete("reviewRef"); url.searchParams.delete("sectionId"); url.searchParams.set("previousReviewRef", reference)
        location.assign(url)
      },
      openSource, openReviewSection: (reference, sectionId) => location.assign(reviewUrl(reference, sectionId)),
    })
    const selected = value.selectedSection as PreservedReview["sections"][number] | undefined
    const selectedView = selected ? selectedSection(selected, openSource) : undefined
    root.replaceChildren(...(selectedView ? [selectedView] : []), view.element, status, sources)
    window.addEventListener("pagehide", () => view.dispose(), { once: true })
  } else if (value && typeof value === "object" && Array.isArray(value.items)) {
    const update = value as Partial<SfReviewUpdate> & { items: ReviewAgendaItem[] }
    const view = createReviewPreparationView({ items: update.items, ...(typeof update.previousReviewRef === "string" ? { previousReviewRef: update.previousReviewRef } : {}),
      openReview: (reference) => location.assign(reviewUrl(reference)) })
    const choices = document.createElement("fieldset"), legend = document.createElement("legend"), message = document.createElement("p")
    legend.textContent = "Seleção da revisão sucessora"; choices.append(legend); message.setAttribute("role", "status")
    const checks: HTMLInputElement[] = []
    const confirm = (label: string) => {
      const container = document.createElement("label"), check = document.createElement("input")
      check.type = "checkbox"; checks.push(check); container.append(check, document.createTextNode(label)); choices.append(container, document.createElement("br"))
      check.addEventListener("change", () => { view.element.inert = checks.some((entry) => !entry.checked) || !update.items.length; message.textContent = view.element.inert ? "Confirme a nova seleção antes de carregar e preservar." : "Carregue a seleção, confira os registros e preserve a sucessora." })
    }
    for (const entry of update.confirmations ?? []) confirm(entry.label)
    for (const entry of update.unavailableSections ?? []) confirm(`Excluir explicitamente o tópico ${entry.title} desta nova pauta. ${entry.reason}`)
    view.element.inert = checks.length > 0 || !update.items.length
    if (update.previousReviewRef) {
      const previous = document.createElement("a"); previous.href = reviewUrl(update.previousReviewRef).toString(); previous.textContent = "Reabrir a revisão anterior"; choices.append(previous)
      message.textContent = update.items.length ? "A revisão anterior permanecerá preservada. Confirme a seleção de cada tópico para preparar sua sucessora." : "Nenhum tópico pode ser reconstruído com uma seleção exata. Abra a origem e prepare uma nova agenda; nenhum tópico foi substituído automaticamente."
    }
    root.replaceChildren(...(update.previousReviewRef ? [choices, message] : []), view.element)
    window.addEventListener("pagehide", () => view.dispose(), { once: true })
  }
}

function selectedSection(section: PreservedReview["sections"][number], openSource: (reference: BusinessEvidenceRef) => Promise<void>) {
  const region = document.createElement("section"), heading = document.createElement("h2"), period = document.createElement("p"), table = document.createElement("table")
  region.setAttribute("data-sf-review-selected-section", section.id); heading.textContent = `Tópico selecionado: ${section.title}`; period.textContent = `${section.period.start} – ${section.period.end} · ${section.count} registros preservados`
  const head = document.createElement("tr")
  for (const label of ["Valor preservado", "Dado", "Unidade", "Período", "Evidência", "Origem"]) { const cell = document.createElement("th"); cell.textContent = label; head.append(cell) }
  table.append(head)
  const projection = section.content as DomainProjection & { reviewAgendaNote?: string }
  for (const value of projection.values) {
    const row = document.createElement("tr")
    for (const text of [value.id, value.value === null ? "Indisponível" : String(value.value), value.unit ?? value.currency ?? "", `${value.period.start} – ${value.period.end}`, value.evidenceState]) { const cell = document.createElement("td"); cell.textContent = text; row.append(cell) }
    const cell = document.createElement("td")
    if (value.drilldown) { const button = document.createElement("button"); button.textContent = "Abrir origem"; button.addEventListener("click", () => { void openSource(value.drilldown!) }); cell.append(button) }
    row.append(cell); table.append(row)
  }
  region.append(heading, period)
  if (projection.reviewAgendaNote) { const note = document.createElement("p"); note.textContent = `Nota da pauta: ${projection.reviewAgendaNote}`; region.append(note) }
  region.append(table)
  return region
}
