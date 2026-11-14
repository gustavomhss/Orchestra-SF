import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"

export type SfBiNavigationKind = "source" | "evidence" | "coverage" | "question" | "result" | "case"
export type SfBiNavigation = { snapshot: string; entries: readonly { kind: SfBiNavigationKind; key: string; token: string }[] }
export type SfBiNavigationDetail = {
  title: string
  reference: string
  facts: readonly { label: string; value: string }[]
  tables: readonly { title: string; columns: readonly string[]; rows: readonly (readonly string[])[] }[]
  links: readonly { label: string; url: string }[]
}

/** Observation time is not identity; every field and physical incarnation is. */
export function sfBiSourceNavigationKey(source: SourceRef) {
  return JSON.stringify([source.surface, source.type, source.id, source.incarnation, source.version, source.fields, source.period])
}

/** Read-only, text-only details from the current protected producer response. */
export function renderSfBiNavigationDetail(detail: SfBiNavigationDetail, destination: (value: string) => URL | undefined, back: () => void) {
  const section = document.createElement("section")
  section.dataset.sfBiDetail = "true"; section.setAttribute("aria-label", "Detalhe da análise")
  section.style.minWidth = "0"; section.style.maxWidth = "100%"; section.style.overflowWrap = "anywhere"
  const heading = document.createElement("h2"); heading.textContent = detail.title; heading.tabIndex = -1
  const close = document.createElement("button"); close.type = "button"; close.textContent = "Voltar à análise"
  close.addEventListener("click", back)
  const reference = document.createElement("p"); reference.textContent = detail.reference
  const facts = document.createElement("dl")
  for (const fact of detail.facts) {
    const label = document.createElement("dt"), value = document.createElement("dd")
    label.textContent = fact.label; value.textContent = fact.value; facts.append(label, value)
  }
  section.append(close, heading, reference, facts)
  for (const data of detail.tables) {
    const table = document.createElement("table"), caption = document.createElement("caption"), head = document.createElement("thead"), row = document.createElement("tr"), body = document.createElement("tbody")
    caption.textContent = data.title
    for (const label of data.columns) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = label; row.append(cell) }
    head.append(row)
    for (const values of data.rows) { const row = document.createElement("tr"); for (const value of values) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell) }; body.append(row) }
    const container = document.createElement("div")
    container.style.maxWidth = "100%"; container.style.overflowX = "auto"
    container.tabIndex = 0; container.setAttribute("role", "region"); container.setAttribute("aria-label", data.title)
    table.append(caption, head, body); container.append(table); section.append(container)
  }
  const links = document.createElement("nav"); links.setAttribute("aria-label", "Destinos autorizados do detalhe")
  for (const link of detail.links) {
    const url = destination(link.url)
    if (!url) continue
    const anchor = document.createElement("a"); anchor.href = url.toString(); anchor.textContent = link.label; links.append(anchor, document.createTextNode(" "))
  }
  section.append(links)
  return { section, focus: () => heading.focus() }
}
