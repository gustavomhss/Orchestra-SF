import type { DomainProjection } from "../contracts/context.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BiSelection } from "./catalog.ts"
import { timelineGeometry } from "./geometry.ts"

export type TimelinePlan = { items: readonly { label: string; dateValueId: string; state: "planned" | "completed" | "unknown" }[] }

export function resolveTimeline(projection: DomainProjection, plan: TimelinePlan) {
  const values = new Map(projection.values.map((value) => [value.id, value]))
  if (values.size !== projection.values.length) return { status: "unavailable", reason: "duplicate-value-id" } as const
  if (plan.items.some((item) => !values.has(item.dateValueId))) return { status: "unavailable", reason: "missing-timeline-value" } as const
  return { status: "ok", items: plan.items.map((item) => {
    const source = values.get(item.dateValueId)!
    const date = source.evidenceState !== "absent" && typeof source.value === "string" && isSfPeriod({ start: source.value, end: source.value }) ? source.value : null
    return { ...item, state: item.state === "completed" && (date === null || source.evidenceState !== "confirmed") ? "unknown" as const : item.state, date, source }
  }) } as const
}

export function renderTimeline(projection: DomainProjection, selectionRef: string, plan: TimelinePlan, open: (selection: BiSelection) => void) {
  const section = document.createElement("section")
  const title = document.createElement("h3")
  title.textContent = "Datas e marcos fornecidos pelo domínio"
  section.append(title)
  const context = document.createElement("p")
  context.textContent = `${projection.context.period.start} – ${projection.context.period.end}; v${projection.version}`
  section.append(context)
  const data = resolveTimeline(projection, plan)
  if (data.status !== "ok") {
    const status = document.createElement("p")
    status.textContent = `Linha do tempo indisponível: ${data.reason}`
    section.append(status)
    return section
  }
  if (!data.items.length) {
    const status = document.createElement("p")
    status.textContent = "Nenhum marco disponível neste período."
    section.append(status)
    return section
  }
  const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  chart.setAttribute("viewBox", `-5 -5 610 ${Math.max(30, data.items.length * 24 + 10)}`)
  chart.setAttribute("width", "100%")
  chart.setAttribute("role", "group")
  chart.setAttribute("aria-label", "Marcos no horizonte; a lista informa estado, data e origem")
  const marks = timelineGeometry(data.items.map((item) => ({ id: item.dateValueId, start: item.date ?? "", end: item.date ?? "" })), projection.context.period, 600)
  marks.forEach((mark, index) => {
    if (mark.x1 === null) return
    const item = data.items[index]
    const group = document.createElementNS(chart.namespaceURI, "g")
    if (item?.source.drilldown) {
      group.setAttribute("tabindex", "0")
      group.setAttribute("data-bi-focus", item.dateValueId)
      group.setAttribute("role", "button")
      group.setAttribute("aria-label", `${item.label}: ${item.state}; ${item.date}; abrir origem`)
      const select = () => open({ context: projection.context, selectionRef, projectionVersion: projection.version, engineVersion: projection.engineVersion, valueId: item.dateValueId, reference: item.source.drilldown })
      group.addEventListener("click", select)
      group.addEventListener("keydown", (event) => {
        if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          select()
        }
      })
    }
    const circle = document.createElementNS(chart.namespaceURI, "circle")
    circle.setAttribute("cx", String(mark.x1))
    circle.setAttribute("cy", String(index * 24 + 10))
    circle.setAttribute("r", "5")
    circle.setAttribute("fill", data.items[index]?.state === "completed" ? "currentColor" : "none")
    circle.setAttribute("stroke", "currentColor")
    group.append(circle)
    group.addEventListener("focus", () => circle.setAttribute("r", "9"))
    group.addEventListener("blur", () => circle.setAttribute("r", "5"))
    chart.append(group)
  })
  section.append(chart)
  const list = document.createElement("ul")
  for (const item of data.items) {
    const row = document.createElement("li")
    row.append(document.createTextNode(`${item.label}: ${item.state}; ${item.date ?? "data indisponível"} `))
    if (item.source.drilldown) {
      const button = document.createElement("button")
      button.type = "button"
      button.setAttribute("data-bi-focus", item.dateValueId)
      button.textContent = `Abrir ${item.label}`
      button.addEventListener("click", () => open({ context: projection.context, selectionRef, projectionVersion: projection.version, engineVersion: projection.engineVersion, valueId: item.dateValueId, reference: item.source.drilldown }))
      row.append(button)
    }
    list.append(row)
  }
  section.append(list)
  return section
}
