import type { DomainProjection } from "../contracts/context.ts"
import type { BiViewRequest } from "../contracts/operations.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { biViews, presentProjection } from "./catalog.ts"
import type { BiSelection } from "./catalog.ts"
import { brushPeriod, chartGeometry, temporalPosition } from "./geometry.ts"
import { resolveBiPresentation } from "./semantics.ts"
import type { BiPresentation } from "./semantics.ts"
import { renderWaterfall } from "./waterfall.ts"
import { renderTimeline } from "./milestones.ts"

/** The projection must be freshly authorized by its producer before rendering. */
export function renderBiView(request: BiViewRequest, projection: DomainProjection, open: (selection: BiSelection) => void, presentation?: BiPresentation) {
  const section = document.createElement("section")
  const view = biViews.find((entry) => entry.id === request.viewId)
  if (!view || !request.selectionRef || !isSfPeriod(request.period) || projection.context.period.start !== request.period.start || projection.context.period.end !== request.period.end || new Set(projection.values.map((value) => value.id)).size !== projection.values.length) {
    section.textContent = "Visualização indisponível: seleção ou dados inconsistentes."
    return section
  }
  const data = presentProjection(projection, request.selectionRef)
  const semantic = presentation?.viewId === request.viewId ? resolveBiPresentation(projection, presentation) : undefined
  const heading = document.createElement("h2")
  heading.textContent = view.question
  section.append(heading)
  const context = document.createElement("p")
  context.textContent = `${data.context.period.start} – ${data.context.period.end} · ${data.context.currency} · v${data.version} · ${view.producer}`
  section.append(context)
  if (semantic?.status === "ok") {
    const limitations = document.createElement("ul")
    limitations.setAttribute("aria-label", "Limitações da visualização")
    for (const limitation of semantic.limitations) {
      const item = document.createElement("li")
      item.textContent = limitation
      limitations.append(item)
    }
    section.append(limitations)
  }
  const controls = document.createElement("fieldset")
  const legend = document.createElement("legend")
  legend.textContent = "Filtrar período"
  controls.append(legend)
  const start = document.createElement("input")
  start.type = "date"
  start.value = data.context.period.start
  start.min = data.context.period.start
  start.max = data.context.period.end
  start.setAttribute("aria-label", "Início do período")
  const end = document.createElement("input")
  end.type = "date"
  end.value = data.context.period.end
  end.min = data.context.period.start
  end.max = data.context.period.end
  end.setAttribute("aria-label", "Fim do período")
  const firstDay = Date.parse(`${data.context.period.start}T00:00:00Z`)
  const lastDay = Date.parse(`${data.context.period.end}T00:00:00Z`)
  const days = Math.round((lastDay - firstDay) / 86400000)
  const brushStart = document.createElement("input")
  brushStart.type = "range"
  brushStart.min = "0"
  brushStart.max = String(days)
  brushStart.value = "0"
  brushStart.setAttribute("aria-label", "Arrastar início do período")
  const brushEnd = document.createElement("input")
  brushEnd.type = "range"
  brushEnd.min = "0"
  brushEnd.max = String(days)
  brushEnd.value = String(days)
  brushEnd.setAttribute("aria-label", "Arrastar fim do período")
  const syncBrush = () => {
    if (!isSfPeriod({ start: start.value, end: end.value }) || start.value < data.context.period.start || end.value > data.context.period.end) return
    brushStart.value = String((Date.parse(`${start.value}T00:00:00Z`) - firstDay) / 86400000)
    brushEnd.value = String((Date.parse(`${end.value}T00:00:00Z`) - firstDay) / 86400000)
    brushStart.setAttribute("aria-valuetext", start.value)
    brushEnd.setAttribute("aria-valuetext", end.value)
  }
  brushStart.addEventListener("input", () => {
    start.value = new Date(firstDay + Math.min(Number(brushStart.value), Number(brushEnd.value)) * 86400000).toISOString().slice(0, 10)
    syncBrush()
  })
  brushEnd.addEventListener("input", () => {
    end.value = new Date(firstDay + Math.max(Number(brushStart.value), Number(brushEnd.value)) * 86400000).toISOString().slice(0, 10)
    syncBrush()
  })
  start.addEventListener("change", syncBrush)
  end.addEventListener("change", syncBrush)
  syncBrush()
  const apply = document.createElement("button")
  apply.type = "button"
  apply.setAttribute("data-bi-focus-fallback", "")
  apply.textContent = "Aplicar filtro"
  controls.append(start, end, brushStart, brushEnd, apply)
  section.append(controls)
  const status = document.createElement("p")
  status.setAttribute("role", "status")
  for (const control of [start, end, brushStart, brushEnd]) control.addEventListener("input", () => { status.textContent = "Filtro alterado; aplique para atualizar o gráfico e a tabela." })
  section.append(status)
  const chart = document.createElement("div")
  section.append(chart)
  const table = document.createElement("table")
  const caption = document.createElement("caption")
  caption.textContent = "Dados e referências"
  table.append(caption)
  const header = table.createTHead().insertRow()
  for (const label of ["Medida", "Valor", "Unidade", "Período", "Granularidade", "Evidência", "Origem"]) {
    const cell = document.createElement("th")
    cell.scope = "col"
    cell.textContent = label
    header.append(cell)
  }
  const body = table.createTBody()
  const draw = () => {
    if (!start.value || !end.value || start.value < data.context.period.start || end.value > data.context.period.end || start.value > end.value) {
      status.textContent = "Escolha um período válido dentro da seleção autorizada."
      return
    }
    const period = { start: start.value, end: end.value }
    status.textContent = ""
    chart.replaceChildren()
    body.replaceChildren()
    const selected = brushPeriod(data.rows, period.start, period.end)
    if (!selected.length) status.textContent = "Nenhum dado disponível neste período."
    const waterfall = semantic?.status === "ok" && (request.viewId === "BI02" || request.viewId === "BI09") ? presentation?.waterfall : undefined
    if (waterfall) {
      const ids = new Set(selected.map((row) => row.id))
      chart.append(renderWaterfall({ ...projection, context: { ...projection.context, period }, values: projection.values.filter((value) => ids.has(value.id)) }, request.selectionRef, waterfall, open))
    }
    const timeline = semantic?.status === "ok" && (request.viewId === "BI08" || request.viewId === "BI10") ? presentation?.timeline : undefined
    if (timeline) {
      const ids = new Set(selected.map((row) => row.id))
      chart.append(renderTimeline({ ...projection, context: { ...projection.context, period }, values: projection.values.filter((value) => ids.has(value.id)) }, request.selectionRef, { ...timeline, items: timeline.items.filter((item) => ids.has(item.dateValueId)) }, open))
    }
    const groups: { unit: string; scaleKey: string; currency?: string; rows: typeof selected }[] = []
    const selectedById = new Map(selected.map((row) => [row.id, row] as const))
    const selectedIds = new Set(selectedById.keys())
    const aligned = request.viewId !== "BI04" || (semantic?.status === "ok" && semantic.series.some((series) => series.role === "fte") && semantic.series.some((series) => series.role === "cost") && semantic.series.every((series) => series.alignmentKeys && JSON.stringify(series.alignmentKeys) === JSON.stringify(semantic.series[0]?.alignmentKeys) && JSON.stringify(series.valueIds.map((id) => selectedIds.has(id))) === JSON.stringify(semantic.series[0]?.valueIds.map((id) => selectedIds.has(id)))))
    if (semantic?.status === "ok" && aligned && ["BI01", "BI03", "BI04", "BI05", "BI06", "BI07"].includes(request.viewId)) {
      for (const series of semantic.series) {
        const candidates = series.valueIds.flatMap((id) => {
          const row = selectedById.get(id)
          return row ? [row] : []
        })
        const rows = candidates.filter((row) => (request.viewId !== "BI01" && request.viewId !== "BI07") || (row.period.start >= period.start && row.period.end <= period.end))
        if (rows.length !== candidates.length) status.textContent = "Períodos parcialmente selecionados aparecem apenas na tabela, sem repartição estimada."
        if (rows.length) {
          const currency = rows.find((row) => row.currency)?.currency
          groups.push({ unit: `${series.label} · ${series.unit}`, currency, scaleKey: JSON.stringify([series.unit, currency ?? null, currency === "unspecified" ? series.id : null, request.viewId === "BI04" ? series.role : null]), rows })
        }
      }
    }
    if (semantic?.status === "ok" && semantic.unassigned.length && !status.textContent) status.textContent = "Dados sem série visual identificada permanecem na tabela."
    if (groups.length && groups.every((group) => group.rows.every((row) => typeof row.value !== "number" || !Number.isFinite(row.value)))) status.textContent = "Não há valores numéricos disponíveis para desenhar neste período."
    if (groups.some((group) => group.currency === "unspecified")) status.textContent = `${status.textContent} Moeda não especificada: escalas independentes.`.trim()
    if (!aligned) status.textContent = "Painéis indisponíveis: alinhamento entre capacidade e custo não fornecido. A tabela conserva os dados disponíveis."
    if (!semantic || semantic.status !== "ok") status.textContent = "Gráfico indisponível: identificação das séries não fornecida pelo produtor. A tabela conserva os dados disponíveis."
    if (aligned && semantic?.status === "ok" && !groups.length && !waterfall && !timeline) status.textContent = "Gráfico indisponível para esta visão ou período. A tabela conserva os dados disponíveis."
    const scales = new Map<string, { minimum: number; maximum: number }>()
    for (const group of groups) {
      for (const row of group.rows) {
        if (typeof row.value !== "number" || !Number.isFinite(row.value)) continue
        const current = scales.get(group.scaleKey)
        scales.set(group.scaleKey, { minimum: Math.min(current?.minimum ?? 0, row.value), maximum: Math.max(current?.maximum ?? 0, row.value) })
      }
    }
    for (const group of groups) {
      const unit = group.unit
      const rows = group.rows
      const finite = rows.filter((row) => typeof row.value === "number" && Number.isFinite(row.value))
      if (!finite.length) continue
      const title = document.createElement("p")
      title.textContent = `Medida: ${unit}`
      chart.append(title)
      const horizontal = request.viewId === "BI03" || request.viewId === "BI05" || request.viewId === "BI06"
      const rawGeometry = chartGeometry(rows, horizontal ? 160 : 600, horizontal ? 600 : 160, scales.get(group.scaleKey))
      const temporal = request.viewId === "BI01" || request.viewId === "BI07"
      const geometry = { ...rawGeometry, marks: rawGeometry.marks.map((mark, index) => ({ ...mark, x: temporal ? temporalPosition(rows[index]!.period.start, period, 600) ?? mark.x : mark.x })) }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      svg.setAttribute("viewBox", "-8 -8 616 176")
      svg.setAttribute("width", "100%")
      svg.setAttribute("role", "group")
      svg.setAttribute("aria-label", `${view.question} Valores em ${unit}; dados detalhados na tabela.`)
      const axis = document.createElementNS(svg.namespaceURI, "line")
      axis.setAttribute("x1", String(horizontal ? 600 - geometry.zero : 0))
      axis.setAttribute("x2", String(horizontal ? 600 - geometry.zero : 600))
      axis.setAttribute("y1", String(horizontal ? 0 : geometry.zero))
      axis.setAttribute("y2", String(horizontal ? 160 : geometry.zero))
      axis.setAttribute("stroke", "currentColor")
      axis.setAttribute("stroke-width", "1")
      svg.append(axis)
      if (request.viewId === "BI01") {
        geometry.marks.forEach((mark, index) => {
          const previous = geometry.marks[index - 1]
          const before = rows[index - 1]
          const current = rows[index]
          if (!previous || previous.y === null || mark.y === null || !before || !current || !isSfPeriod(before.period) || !isSfPeriod(current.period)) return
          if (Date.parse(`${current.period.start}T00:00:00Z`) - Date.parse(`${before.period.end}T00:00:00Z`) !== 86400000) return
          const segment = document.createElementNS(svg.namespaceURI, "line")
          segment.setAttribute("x1", String(previous.x))
          segment.setAttribute("x2", String(mark.x))
          segment.setAttribute("y1", String(previous.y))
          segment.setAttribute("y2", String(mark.y))
          segment.setAttribute("stroke", "currentColor")
          svg.append(segment)
        })
      }
      for (const mark of geometry.marks) {
        if (mark.y === null) continue
        const row = rows.find((item) => item.id === mark.id)
        const group = document.createElementNS(svg.namespaceURI, "g")
        if (row?.selection.reference) {
          group.setAttribute("tabindex", "0")
          group.setAttribute("data-bi-focus", row.id)
          group.setAttribute("role", "button")
          group.setAttribute("aria-label", `${mark.id}: ${mark.value} ${unit}. Abrir origem`)
          const select = () => open({ ...row.selection, context: { ...row.selection.context, period } })
          group.addEventListener("click", select)
          group.addEventListener("keydown", (event) => {
            if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault()
              select()
            }
          })
        }
        const line = document.createElementNS(svg.namespaceURI, "line")
        line.setAttribute("x1", String(horizontal ? 600 - mark.zero : mark.x))
        line.setAttribute("x2", String(horizontal ? 600 - mark.y : mark.x))
        line.setAttribute("y1", String(horizontal ? mark.x : mark.zero))
        line.setAttribute("y2", String(horizontal ? mark.x : mark.y))
        line.setAttribute("stroke", "currentColor")
        line.setAttribute("stroke-width", "4")
        const label = document.createElementNS(svg.namespaceURI, "title")
        label.textContent = `${mark.id}: ${mark.value} ${unit}`
        line.append(label)
        group.append(line)
        const point = document.createElementNS(svg.namespaceURI, "circle")
        point.setAttribute("cx", String(horizontal ? 600 - mark.y : mark.x))
        point.setAttribute("cy", String(horizontal ? mark.x : mark.y))
        point.setAttribute("r", "4")
        point.setAttribute("fill", "currentColor")
        group.append(point)
        group.addEventListener("focus", () => { point.setAttribute("r", "8"); line.setAttribute("stroke-width", "7") })
        group.addEventListener("blur", () => { point.setAttribute("r", "4"); line.setAttribute("stroke-width", "4") })
        svg.append(group)
      }
      chart.append(svg)
      const scaleLabel = document.createElement("p")
      scaleLabel.textContent = `Escala: ${geometry.minimum} a ${geometry.maximum} ${unit}; zero indicado no eixo. Séries comparáveis compartilham escala; capacidade e custo usam escalas próprias.`
      chart.append(scaleLabel)
      const labels = document.createElement("ol")
      labels.setAttribute("aria-label", `Pontos de ${unit} na ordem do gráfico`)
      for (const row of rows) {
        const label = document.createElement("li")
        label.textContent = `${row.id} · ${row.period.start} – ${row.period.end}: ${row.value ?? "indisponível"}`
        labels.append(label)
      }
      chart.append(labels)
    }
    for (const row of selected) {
      const line = body.insertRow()
      line.insertCell().textContent = row.id
      line.insertCell().textContent = row.value === null ? "Indisponível" : String(row.value)
      line.insertCell().textContent = row.unit ?? row.currency ?? "—"
      line.insertCell().textContent = `${row.period.start} – ${row.period.end}`
      line.insertCell().textContent = row.granularity
      line.insertCell().textContent = row.evidenceState
      const cell = line.insertCell()
      if (row.selection.reference) {
        const button = document.createElement("button")
        button.type = "button"
        button.setAttribute("data-bi-focus", row.id)
        button.textContent = "Abrir origem"
        button.addEventListener("click", () => open({ ...row.selection, context: { ...row.selection.context, period } }))
        cell.append(button)
      }
      if (!row.selection.reference) cell.textContent = "Indisponível"
    }
  }
  apply.addEventListener("click", draw)
  draw()
  const tableContainer = document.createElement("div")
  tableContainer.style.overflowX = "auto"
  tableContainer.append(table)
  section.append(tableContainer)
  const missing = document.createElement("ul")
  for (const entry of data.missing) {
    const item = document.createElement("li")
    item.textContent = `${entry.field}: ${entry.reason}`
    missing.append(item)
  }
  if (!data.rows.length && !data.missing.length) {
    const item = document.createElement("li")
    item.textContent = "Nenhum dado disponível para esta seleção."
    missing.append(item)
  }
  section.append(missing)
  return section
}

/** The host calls this after returning from a detail screen. */
export function restoreBiFocus(container: HTMLElement, selection: BiSelection | string) {
  const valueId = typeof selection === "string" ? selection : selection.valueId
  const target = Array.from(container.querySelectorAll("[data-bi-focus]"))
    .find((element) => element.getAttribute("data-bi-focus") === valueId)
    ?? container.querySelector("[data-bi-focus-fallback]")
  if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return false
  target.focus()
  return true
}
