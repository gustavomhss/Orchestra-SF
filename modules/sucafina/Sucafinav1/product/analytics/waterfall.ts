import type { DomainProjection } from "../contracts/context.ts"
import type { BiSelection } from "./catalog.ts"
import { waterfallGeometry } from "./geometry.ts"

/** All endpoints and deltas come from the domain projection; BI does not accumulate them. */
export type WaterfallPlan = {
  segments: readonly { label: string; startValueId: string; endValueId: string; componentValueId: string }[]
  finalValueId: string
  reconciliation: "reconciled" | "unreconciled" | "unavailable"
}

export function resolveWaterfall(projection: DomainProjection, plan: WaterfallPlan) {
  const values = new Map(projection.values.map((value) => [value.id, value]))
  if (values.size !== projection.values.length) return { status: "unavailable", reason: "duplicate-value-id" } as const
  const ids = [...plan.segments.flatMap((segment) => [segment.startValueId, segment.endValueId, segment.componentValueId]), plan.finalValueId]
  if (ids.some((id) => !values.has(id))) return { status: "unavailable", reason: "missing-waterfall-value" } as const
  const points = ids.flatMap((id) => {
    const value = values.get(id)
    return value ? [value] : []
  })
  if (new Set(points.flatMap((value) => value.currency ? [value.currency] : [])).size > 1 || new Set(points.flatMap((value) => value.unit ? [value.unit] : [])).size > 1) return { status: "unavailable", reason: "incompatible-unit-or-currency" } as const
  const number = (id: string) => {
    const source = values.get(id)
    return source?.evidenceState !== "absent" && typeof source?.value === "number" && Number.isFinite(source.value) ? source.value : null
  }
  const segments = plan.segments.map((segment) => ({ ...segment, start: number(segment.startValueId), end: number(segment.endValueId), amount: number(segment.componentValueId), source: values.get(segment.componentValueId)! }))
  const final = number(plan.finalValueId)
  const incomplete = final === null || segments.some((segment) => segment.start === null || segment.end === null || segment.amount === null)
  const continuous = segments.every((segment, index) => index === 0 || segments[index - 1]?.end === segment.start)
  const endpointsMatch = segments.length > 0 && continuous && segments.at(-1)?.end === final
  const reconciliation = incomplete || plan.reconciliation === "unavailable" ? "unavailable" : !endpointsMatch || plan.reconciliation === "unreconciled" ? "unreconciled" : "reconciled"
  return { status: "ok", segments, final, reconciliation } as const
}

export function renderWaterfall(projection: DomainProjection, selectionRef: string, plan: WaterfallPlan, open: (selection: BiSelection) => void) {
  const data = resolveWaterfall(projection, plan)
  const section = document.createElement("section")
  const title = document.createElement("h3")
  title.textContent = "Composição fornecida pelo domínio"
  section.append(title)
  const status = document.createElement("p")
  if (data.status !== "ok") {
    status.textContent = `Gráfico indisponível: ${data.reason}`
    section.append(status)
    return section
  }
  status.textContent = `Reconciliação: ${data.reconciliation}; valor final: ${data.final ?? "indisponível"} ${projection.context.currency}; ${projection.context.period.start} – ${projection.context.period.end}; v${projection.version}.`
  section.append(status)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "-8 -8 616 176")
  svg.setAttribute("width", "100%")
  svg.setAttribute("role", "group")
  svg.setAttribute("aria-label", "Waterfall de componentes; valores e fontes estão na tabela equivalente")
  const marks = waterfallGeometry(data.segments.map((segment) => ({ id: segment.componentValueId, start: segment.start, end: segment.end })), 600, 160)
  marks.forEach((mark, index) => {
    if (mark.start === null || mark.end === null) return
    const segment = data.segments[index]
    const group = document.createElementNS(svg.namespaceURI, "g")
    if (segment?.source.drilldown) {
      group.setAttribute("tabindex", "0")
      group.setAttribute("data-bi-focus", segment.componentValueId)
      group.setAttribute("role", "button")
      group.setAttribute("aria-label", `${segment.label}: ${segment.amount ?? "indisponível"}; abrir origem`)
      const select = () => open({ context: projection.context, selectionRef, projectionVersion: projection.version, engineVersion: projection.engineVersion, valueId: segment.componentValueId, reference: segment.source.drilldown })
      group.addEventListener("click", select)
      group.addEventListener("keydown", (event) => {
        if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          select()
        }
      })
    }
    const line = document.createElementNS(svg.namespaceURI, "line")
    line.setAttribute("x1", String(mark.x))
    line.setAttribute("x2", String(mark.x))
    line.setAttribute("y1", String(mark.start))
    line.setAttribute("y2", String(mark.end))
    line.setAttribute("stroke", "currentColor")
    line.setAttribute("stroke-width", "8")
    group.append(line)
    group.addEventListener("focus", () => line.setAttribute("stroke-width", "14"))
    group.addEventListener("blur", () => line.setAttribute("stroke-width", "8"))
    svg.append(group)
  })
  section.append(svg)
  const table = document.createElement("table")
  const caption = document.createElement("caption")
  caption.textContent = "Composição e origens"
  table.append(caption)
  const header = table.createTHead().insertRow()
  for (const label of ["Componente", "Início", "Contribuição", "Fim", "Origem"]) {
    const cell = document.createElement("th")
    cell.scope = "col"
    cell.textContent = label
    header.append(cell)
  }
  const body = table.createTBody()
  for (const segment of data.segments) {
    const row = body.insertRow()
    row.insertCell().textContent = segment.label
    row.insertCell().textContent = String(segment.start ?? "indisponível")
    row.insertCell().textContent = String(segment.amount ?? "indisponível")
    row.insertCell().textContent = String(segment.end ?? "indisponível")
    const cell = row.insertCell()
    if (!segment.source.drilldown) {
      cell.textContent = "Indisponível"
      continue
    }
    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("data-bi-focus", segment.componentValueId)
    button.textContent = `Abrir ${segment.label}`
    button.addEventListener("click", () => open({ context: projection.context, selectionRef, projectionVersion: projection.version, engineVersion: projection.engineVersion, valueId: segment.componentValueId, reference: segment.source.drilldown }))
    cell.append(button)
  }
  const tableContainer = document.createElement("div")
  tableContainer.style.overflowX = "auto"
  tableContainer.append(table)
  section.append(tableContainer)
  return section
}
