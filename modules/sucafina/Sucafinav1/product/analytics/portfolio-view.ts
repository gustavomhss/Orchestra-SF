import type { SourceRef } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import { renderDecisionView } from "./decision-view.ts"

export function presentPortfolio(result: PortfolioResult) {
  return { ...result, combinations: result.combinations.map((combination) => {
    const invalidComplete = combination.eligibility === "eligible-complete" && (!combination.costCoverageRefs.length || combination.costCoverageRefs.some((reference) => !reference.trim()) || combination.components.some((component) => component.evidenceState !== "confirmed" || component.amount === null || !Number.isFinite(component.amount)))
    return { ...combination, eligibility: invalidComplete ? "unavailable" as const : combination.eligibility, comparisonStatus: invalidComplete ? "unavailable" as const : combination.comparisonStatus, restrictions: [...combination.restrictions, ...(invalidComplete ? ["Cobertura ou componentes completos não puderam ser comprovados."] : [])], components: combination.components.map((component) => ({ ...component, amount: component.evidenceState !== "absent" && component.amount !== null && Number.isFinite(component.amount) ? component.amount : null })) }
  }) }
}

/** The caller supplies a freshly authorized result; this view performs no portfolio evaluation. */
export function renderPortfolioView(result: PortfolioResult, openSource?: (reference: SourceRef) => void, openEvidence?: (reference: BusinessEvidenceRef) => void, openCoverage?: (reference: string) => void, openCase?: (reference: string) => void) {
  const data = presentPortfolio(result)
  const section = document.createElement("section")
  const title = document.createElement("h2")
  title.textContent = "Combinações de portfólio"
  section.append(title)
  const limitations = document.createElement("ul")
  limitations.setAttribute("aria-label", "Limitações")
  for (const limitation of data.limitations) {
    const item = document.createElement("li")
    item.textContent = limitation
    limitations.append(item)
  }
  section.append(limitations)
  if (!data.combinations.length) {
    const empty = document.createElement("p")
    empty.textContent = "Nenhuma combinação disponível."
    section.append(empty)
  }
  for (const combination of data.combinations) {
    const item = document.createElement("section")
    const heading = document.createElement("h3")
    heading.textContent = combination.id
    item.append(heading)
    const status = document.createElement("p")
    status.textContent = `Elegibilidade: ${combination.eligibility}; comparação: ${combination.comparisonStatus}.`
    item.append(status)
    const cases = document.createElement("p")
    cases.append(document.createTextNode("Casos: "))
    for (const reference of combination.caseRefs) {
      if (!openCase) {
        cases.append(document.createTextNode(`${reference} `))
        continue
      }
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Abrir caso ${reference}`
      button.addEventListener("click", () => openCase(reference))
      cases.append(button)
    }
    if (!combination.caseRefs.length) cases.append(document.createTextNode("indisponíveis"))
    item.append(cases)
    const warnings = document.createElement("ul")
    warnings.setAttribute("aria-label", "Conflitos e restrições")
    for (const warning of [...combination.conflicts, ...combination.restrictions]) {
      const entry = document.createElement("li")
      entry.textContent = warning
      warnings.append(entry)
    }
    item.append(warnings)
    const table = document.createElement("table")
    const caption = document.createElement("caption")
    caption.textContent = "Componentes projetados; valores ausentes não são zero"
    table.append(caption)
    const header = table.createTHead().insertRow()
    for (const label of ["Componente", "Valor", "Moeda", "Período", "Evidência", "Origem"]) {
      const cell = document.createElement("th")
      cell.scope = "col"
      cell.textContent = label
      header.append(cell)
    }
    const body = table.createTBody()
    for (const component of combination.components) {
      const row = body.insertRow()
      row.insertCell().textContent = component.id
      row.insertCell().textContent = String(component.amount ?? "indisponível")
      row.insertCell().textContent = component.currency
      row.insertCell().textContent = `${component.period.start} – ${component.period.end}`
      row.insertCell().textContent = component.evidenceState
      const origin = row.insertCell()
      for (const reference of component.sourceRefs) {
        if (!openSource) {
          origin.append(document.createTextNode(`${reference.type} ${reference.id} v${reference.version} `))
          continue
        }
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = `Abrir ${reference.type} ${reference.id}`
        button.addEventListener("click", () => openSource(reference))
        origin.append(button)
      }
      if (!component.sourceRefs.length) origin.textContent = "Indisponível"
    }
    const container = document.createElement("div")
    container.style.overflowX = "auto"
    container.append(table)
    item.append(container)
    for (const reference of combination.costCoverageRefs) {
      if (!openCoverage) {
        const label = document.createElement("p")
        label.textContent = `Cobertura: ${reference}`
        item.append(label)
        continue
      }
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Abrir cobertura ${reference}`
      button.addEventListener("click", () => openCoverage(reference))
      item.append(button)
    }
    if (combination.analysis?.scenarioResultRef.trim() && combination.analysis.comparisonRef.trim()) {
      const references = document.createElement("p")
      references.textContent = `Cenário: ${combination.analysis.scenarioResultRef}; comparação: ${combination.analysis.comparisonRef}`
      item.append(references, renderDecisionView(combination.analysis.scenario, combination.analysis.comparison, undefined, openSource, openEvidence, openCoverage))
    }
    if (!combination.analysis?.scenarioResultRef.trim() || !combination.analysis.comparisonRef.trim()) {
      const unavailable = document.createElement("p")
      unavailable.textContent = "Análise de cenário e comparação indisponível."
      item.append(unavailable)
    }
    section.append(item)
  }
  for (const reference of data.evidenceRefs) {
    if (!openEvidence) {
      const label = document.createElement("p")
      label.textContent = `Evidência do portfólio: ${reference.kind} ${reference.refId}`
      section.append(label)
      continue
    }
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = `Abrir evidência do portfólio ${reference.refId}`
    button.addEventListener("click", () => openEvidence(reference))
    section.append(button)
  }
  return section
}
