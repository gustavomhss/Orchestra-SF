import type { SourceRef } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import { presentScenario, presentSensitivity } from "./catalog.ts"
import { sensitivityGeometry, timelineGeometry } from "./geometry.ts"

export function renderDecisionView(result: ScenarioResult, comparison: ScenarioComparison, sensitivity?: SensitivityResult, openSource?: (source: SourceRef) => void, openEvidence?: (reference: BusinessEvidenceRef) => void, openCoverage?: (reference: string) => void, openQuestion?: (reference: string) => void, openResult?: (reference: string) => void) {
  const data = presentScenario(result, comparison)
  const section = document.createElement("section")
  const heading = document.createElement("h2")
  heading.textContent = "Composição e sensibilidade da decisão"
  section.append(heading)
  const summary = document.createElement("p")
  const qualifier = data.status === "complete" ? "Completa" : `Condicionada ou indisponível (${data.status})`
  summary.textContent = `${qualifier} · ${data.currency} · ${data.horizon.start} – ${data.horizon.end} · subtotal conhecido: ${data.knownSubtotal ?? "indisponível"} · total: ${data.total ?? "indisponível"} · diferença conhecida: ${data.difference ?? "indisponível"}`
  section.append(summary)
  const timelineHeading = document.createElement("h3")
  timelineHeading.textContent = "Períodos dos componentes"
  section.append(timelineHeading)
  const marks = timelineGeometry(data.rows.map((component) => ({ id: component.id, start: component.period.start, end: component.period.end })), data.horizon, 600)
  if (marks.length) {
    const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    chart.setAttribute("viewBox", `-5 -5 610 ${Math.max(30, marks.length * 24 + 10)}`)
    chart.setAttribute("width", "100%")
    chart.setAttribute("role", "img")
    chart.setAttribute("aria-label", "Períodos no horizonte selecionado; os detalhes estão na lista seguinte")
    marks.forEach((mark, index) => {
      if (mark.x1 === null || mark.x2 === null) return
      const line = document.createElementNS(chart.namespaceURI, "line")
      line.setAttribute("x1", String(mark.x1))
      line.setAttribute("x2", String(mark.x2))
      line.setAttribute("y1", String(index * 24 + 10))
      line.setAttribute("y2", String(index * 24 + 10))
      line.setAttribute("stroke", "currentColor")
      line.setAttribute("stroke-width", "5")
      const description = document.createElementNS(chart.namespaceURI, "title")
      description.textContent = `${mark.id}${mark.clipped ? ": período parcialmente fora do horizonte" : ""}`
      line.append(description)
      chart.append(line)
    })
    section.append(chart)
    if (marks.some((mark) => mark.clipped)) {
      const note = document.createElement("p")
      note.textContent = "Alguns períodos continuam fora do horizonte; a lista mostra as datas completas."
      section.append(note)
    }
  }
  const timeline = document.createElement("ol")
  for (const component of data.rows) {
    const item = document.createElement("li")
    item.textContent = `${component.id}: ${component.period.start} – ${component.period.end}; ${component.evidenceState}`
    timeline.append(item)
  }
  if (!data.rows.length) {
    const item = document.createElement("li")
    item.textContent = "Nenhum período de componente disponível."
    timeline.append(item)
  }
  section.append(timeline)
  const table = document.createElement("table")
  const caption = document.createElement("caption")
  caption.textContent = "Componentes fornecidos pelo domínio"
  table.append(caption)
  const header = table.createTHead().insertRow()
  for (const label of ["Componente", "Valor", "Moeda", "Período", "Evidência", "Origem"]) {
    const cell = document.createElement("th")
    cell.scope = "col"
    cell.textContent = label
    header.append(cell)
  }
  const body = table.createTBody()
  for (const component of data.rows) {
    const row = body.insertRow()
    row.insertCell().textContent = component.id
    row.insertCell().textContent = component.amount === null ? "Indisponível" : String(component.amount)
    row.insertCell().textContent = component.currency
    row.insertCell().textContent = `${component.period.start} – ${component.period.end}`
    row.insertCell().textContent = component.evidenceState
    const origin = row.insertCell()
    for (const source of component.sourceRefs) {
      if (!openSource) {
        origin.append(document.createTextNode(`${source.type} ${source.id} v${source.version} `))
        continue
      }
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Abrir ${source.type} ${source.id} v${source.version}`
      button.addEventListener("click", () => openSource(source))
      origin.append(button)
    }
    if (!component.sourceRefs.length) origin.textContent = "Indisponível"
  }
  const tableContainer = document.createElement("div")
  tableContainer.style.overflowX = "auto"
  tableContainer.append(table)
  section.append(tableContainer)
  const coverage = document.createElement("ul")
  coverage.setAttribute("aria-label", "Cobertura de custos e condições")
  for (const entry of data.coverage.entries) {
    const item = document.createElement("li")
    item.append(document.createTextNode(entry.status === "pending" ? `${entry.categoryId}: pendente (${entry.reason}) ` : `${entry.categoryId}: ${entry.status} `))
    if (entry.status === "pending" && entry.questionRef && !openQuestion) item.append(document.createTextNode(`Pergunta: ${entry.questionRef}`))
    if (entry.status === "pending" && entry.questionRef && openQuestion) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Abrir pergunta sobre ${entry.categoryId}`
      button.addEventListener("click", () => openQuestion(entry.questionRef!))
      item.append(button)
    }
    if (entry.status !== "pending") {
      for (const reference of entry.evidenceRefs) {
        if (!openEvidence) {
          item.append(document.createTextNode(`Evidência: ${reference.kind} ${reference.refId} `))
          continue
        }
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = `Abrir evidência de ${entry.categoryId}: ${reference.refId}`
        button.addEventListener("click", () => openEvidence(reference))
        item.append(button)
      }
    }
    coverage.append(item)
  }
  for (const category of data.coverage.derivedMissingCategoryIds) {
    const item = document.createElement("li")
    item.textContent = `${category}: categoria ausente`
    coverage.append(item)
  }
  for (const condition of data.conditions) {
    const item = document.createElement("li")
    item.textContent = condition
    coverage.append(item)
  }
  section.append(coverage)
  for (const reference of data.costCoverageRefs) {
    if (!openCoverage) {
      const label = document.createElement("p")
      label.textContent = `Cobertura: ${reference}`
      section.append(label)
      continue
    }
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = `Abrir cobertura ${reference}`
    button.addEventListener("click", () => openCoverage(reference))
    section.append(button)
  }
  for (const reference of data.sourceRefs) {
    if (!openEvidence) {
      const label = document.createElement("p")
      label.textContent = `Fonte do cenário: ${reference.kind} ${reference.refId}`
      section.append(label)
      continue
    }
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = `Abrir fonte do cenário ${reference.refId}`
    button.addEventListener("click", () => openEvidence(reference))
    section.append(button)
  }
  if (sensitivity) {
    const evaluated = presentSensitivity(sensitivity)
    const title = document.createElement("h3")
    title.textContent = "Sensibilidade"
    section.append(title)
    const description = document.createElement("p")
    const threshold = evaluated.thresholdEvidence.state === "sampled" && Number.isFinite(evaluated.thresholdEvidence.interval.minimum) && Number.isFinite(evaluated.thresholdEvidence.interval.maximum) && evaluated.thresholdEvidence.interval.minimum <= evaluated.thresholdEvidence.interval.maximum ? `intervalo amostrado ${evaluated.thresholdEvidence.interval.minimum} – ${evaluated.thresholdEvidence.interval.maximum}` : evaluated.threshold !== null ? `limiar exato ${evaluated.threshold}` : "limiar indisponível"
    const bounds = Number.isFinite(evaluated.bounds.minimum) && Number.isFinite(evaluated.bounds.maximum) ? `${evaluated.bounds.minimum} – ${evaluated.bounds.maximum}` : "indisponível"
    const thresholdUnit = evaluated.parameterUnit?.trim() ? evaluated.parameterUnit : "não especificada"
    description.textContent = `Parâmetro ${evaluated.parameterRef}; intervalo ${bounds}; unidade informada ${evaluated.unit}; ${threshold}; unidade do limiar ${thresholdUnit}; ${evaluated.comparisonStatus}; motor ${evaluated.engineVersion}`
    section.append(description)
    if (!evaluated.parameterUnit?.trim() || !evaluated.resultUnit?.trim()) {
      const warning = document.createElement("p")
      warning.textContent = "Gráfico indisponível: unidades dos eixos não fornecidas; os pontos permanecem na lista."
      section.append(warning)
    }
    if (evaluated.parameterUnit?.trim() && evaluated.resultUnit?.trim()) {
      const axes = document.createElement("p")
      axes.textContent = `Eixo X: ${evaluated.parameterUnit}; eixo Y: ${evaluated.resultUnit}.`
      section.append(axes)
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      svg.setAttribute("viewBox", "-5 -5 610 170")
      svg.setAttribute("width", "100%")
      svg.setAttribute("role", "group")
      svg.setAttribute("aria-label", "Pontos de sensibilidade; valores e referências na lista equivalente")
      for (const point of sensitivityGeometry(evaluated.evaluated, 600, 160)) {
        if (point.x === null || point.y === null) continue
        const group = document.createElementNS(svg.namespaceURI, "g")
        if (openResult) {
          group.setAttribute("tabindex", "0")
          group.setAttribute("data-bi-focus", point.resultRef)
          group.setAttribute("role", "button")
          group.setAttribute("aria-label", `${point.parameterValue}: ${point.value}; abrir resultado`)
          group.addEventListener("click", () => openResult(point.resultRef))
          group.addEventListener("keydown", (event) => {
            if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault()
              openResult(point.resultRef)
            }
          })
        }
        const circle = document.createElementNS(svg.namespaceURI, "circle")
        circle.setAttribute("cx", String(point.x))
        circle.setAttribute("cy", String(point.y))
        circle.setAttribute("r", "4")
        circle.setAttribute("fill", "currentColor")
        const label = document.createElementNS(svg.namespaceURI, "title")
        label.textContent = `${point.parameterValue}: ${point.value}; ${point.resultRef}`
        circle.append(label)
        group.append(circle)
        group.addEventListener("focus", () => circle.setAttribute("r", "8"))
        group.addEventListener("blur", () => circle.setAttribute("r", "4"))
        svg.append(group)
      }
      section.append(svg)
    }
    const list = document.createElement("ul")
    for (const point of evaluated.evaluated) {
      const item = document.createElement("li")
      item.append(document.createTextNode(`${point.parameterValue ?? "indisponível"}: ${point.value ?? "indisponível"} `))
      if (openResult) {
        const button = document.createElement("button")
        button.type = "button"
        button.setAttribute("data-bi-focus", point.resultRef)
        button.textContent = `Abrir resultado ${point.resultRef}`
        button.addEventListener("click", () => openResult(point.resultRef))
        item.append(button)
      }
      if (!openResult) item.append(document.createTextNode(`(${point.resultRef})`))
      list.append(item)
    }
    for (const condition of evaluated.unresolvedConditions) {
      const item = document.createElement("li")
      item.textContent = `${condition.category}: ${condition.reason}`
      list.append(item)
    }
    section.append(list)
    for (const reference of evaluated.costCoverageRefs) {
      if (!openCoverage) {
        const label = document.createElement("p")
        label.textContent = `Cobertura de sensibilidade: ${reference}`
        section.append(label)
        continue
      }
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Abrir cobertura de sensibilidade ${reference}`
      button.addEventListener("click", () => openCoverage(reference))
      section.append(button)
    }
    const references = evaluated.thresholdEvidence.state === "unavailable" ? evaluated.evidenceRefs : [...evaluated.evidenceRefs, ...evaluated.thresholdEvidence.evidenceRefs]
    for (const reference of references) {
      if (!openEvidence) {
        const label = document.createElement("p")
        label.textContent = `Fonte da sensibilidade: ${reference.kind} ${reference.refId}`
        section.append(label)
        continue
      }
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Abrir fonte da sensibilidade ${reference.refId}`
      button.addEventListener("click", () => openEvidence(reference))
      section.append(button)
    }
  }
  return section
}
