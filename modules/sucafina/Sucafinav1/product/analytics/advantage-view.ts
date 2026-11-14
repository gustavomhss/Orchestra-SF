import { canonicalSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { chartGeometry } from "./geometry.ts"

/** Values come from the separately persisted inverse comparison; only chart coordinates are derived here. */
export function renderScenarioAdvantage(projection: DomainProjection, openResult?: (reference: string) => void, openEvidence?: (reference: BusinessEvidenceRef) => void) {
  const comparison = projection.comparison
  const decision = projection.decision
  if (!comparison || decision?.kind !== "scenario" || comparison.metricRef !== "planner:known-subtotal-difference" || !comparison.comparisonRef.trim() || comparison.comparisonRef === decision.comparisonRef || comparison.version !== projection.version || comparison.engineVersion !== projection.engineVersion || canonicalSfValue(comparison.context) !== canonicalSfValue(projection.context)) return
  if (new Set(comparison.values.map((row) => row.id)).size !== comparison.values.length) return
  const value = comparison.values.find((row) => row.id === "scenario:advantage-known-difference")
  const state = comparison.values.find((row) => row.id === "scenario:advantage-comparison-status")
  if (!value || !state || value.currency !== decision.scenario.currency || canonicalSfValue(value.period) !== canonicalSfValue(decision.scenario.horizon) || canonicalSfValue(state.period) !== canonicalSfValue(decision.scenario.horizon)) return
  const labels: Record<string, string> = { complete: "Completa", conditioned: "Condicionada", incompatible: "Incompatível", unavailable: "Indisponível" }
  if (typeof state.value !== "string" || !Object.hasOwn(labels, state.value)) return
  const currency = decision.scenario.currency
  const status = labels[state.value]!
  const known = value.evidenceState !== "absent" && typeof value.value === "number" && Number.isFinite(value.value) ? value.value : null
  const amount = known === null ? "Indisponível" : String(known)
  const section = document.createElement("section")
  section.setAttribute("aria-label", "Vantagem conhecida da alternativa")
  const heading = document.createElement("h3")
  heading.textContent = "Vantagem conhecida da alternativa"
  const orientation = document.createElement("p")
  orientation.textContent = `Vantagem (referência − alternativa): resultado ${decision.comparison.baselineResultRef} menos ${decision.comparison.alternativeResultRef}. Valor positivo indica custo conhecido menor da alternativa; negativo indica custo conhecido maior. ${status} · ${currency}.`
  section.append(heading, orientation)
  if (state.value === "conditioned") {
    const condition = document.createElement("p")
    condition.textContent = "Valor conhecido condicionado às pendências do resultado persistido."
    section.append(condition)
  }
  const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  chart.setAttribute("viewBox", "0 0 320 160")
  chart.style.width = "100%"
  chart.style.maxWidth = "24rem"
  chart.setAttribute("role", "img")
  chart.setAttribute("aria-label", `Vantagem conhecida (referência − alternativa): ${amount} ${currency}; ${status}`)
  const title = document.createElementNS(chart.namespaceURI, "title")
  title.textContent = chart.getAttribute("aria-label")
  chart.append(title)
  const geometry = chartGeometry([value], 320, 120)
  const mark = geometry.marks[0]
  if (mark && mark.y !== null && mark.value !== null && mark.height !== null) {
    const axis = document.createElementNS(chart.namespaceURI, "line")
    axis.setAttribute("x1", "30")
    axis.setAttribute("x2", "290")
    axis.setAttribute("y1", String(20 + geometry.zero))
    axis.setAttribute("y2", String(20 + geometry.zero))
    axis.setAttribute("stroke", "currentColor")
    const bar = document.createElementNS(chart.namespaceURI, "rect")
    bar.setAttribute("x", String(mark.x - 25))
    bar.setAttribute("y", String(20 + Math.min(mark.y, mark.zero)))
    bar.setAttribute("width", "50")
    bar.setAttribute("height", String(mark.height || 2))
    bar.setAttribute("fill", "currentColor")
    bar.setAttribute("aria-label", `${amount} ${currency}; ${status}`)
    chart.append(axis, bar)
  }
  section.append(chart)
  const table = document.createElement("table")
  const caption = table.createCaption()
  caption.textContent = "Vantagem fornecida pela comparação persistida"
  const header = table.createTHead().insertRow()
  for (const label of ["Medida", "Valor", "Moeda", "Período", "Estado", "Resultado e fontes"]) {
    const cell = document.createElement("th")
    cell.scope = "col"
    cell.textContent = label
    header.append(cell)
  }
  const row = table.createTBody().insertRow()
  for (const label of ["Vantagem conhecida (referência − alternativa)", amount, currency, `${value.period.start} – ${value.period.end}`, status]) row.insertCell().textContent = label
  const refs = row.insertCell()
  refs.textContent = comparison.comparisonRef
  if (openResult) {
    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("data-bi-focus", comparison.comparisonRef)
    button.textContent = "Abrir comparação de vantagem"
    button.addEventListener("click", () => openResult(comparison.comparisonRef))
    refs.append(button)
  }
  if (openEvidence) for (const reference of value.sourceRefs) {
    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("data-bi-focus", reference.refId)
    button.textContent = `Abrir fonte ${reference.refId}`
    button.addEventListener("click", () => openEvidence(reference))
    refs.append(button)
  }
  section.append(table)
  return section
}
