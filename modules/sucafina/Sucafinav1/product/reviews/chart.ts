import { deflateSync } from "node:zlib"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { ReviewChart } from "./port.ts"
import { validateReviewWaterfall } from "./waterfall.ts"

/** Render only a verified single-unit monthly/yearly trajectory. Other view kinds remain unavailable. */
export function renderReviewChart(projection: DomainProjection, chart: ReviewChart | undefined): Uint8Array | undefined {
  type Series = Extract<ReviewChart, { status: "ok" }>["series"][number]
  type Value = DomainProjection["values"][number]
  if (!chart || chart.status !== "ok" || chart.viewId !== "BI01" || !Array.isArray(chart.series) || !chart.series.length || chart.series.length > 4 || !Array.isArray(projection.values)) return
  if (chart.series.some((series: Series) => !series || !series.unit || !Array.isArray(series.valueIds) || !Array.isArray(series.values) || !series.values.length || series.valueIds.length !== series.values.length || series.values.some((value: Value, index: number) => !value || series.valueIds[index] !== value.id || !isSfPeriod(value.period) || (value.granularity !== "month" && value.granularity !== "year") || (value.unit && value.unit !== series.unit) || (value.currency && value.currency !== series.unit) || (value.value !== null && (typeof value.value !== "number" || !Number.isFinite(value.value))) || !projection.values.some((entry: Value) => digestSfValue(entry) === digestSfValue(value))))) return
  const units = new Set(chart.series.map((series: Series) => series.unit))
  const ids = chart.series.flatMap((series: Series) => series.valueIds)
  if (units.size !== 1 || new Set(ids).size !== ids.length || chart.series.some((series: Series) => new Set(series.values.map((value: Value) => `${value.period.start}/${value.period.end}`)).size !== series.values.length || new Set(series.values.map((value: Value) => value.granularity)).size > 1)) return
  const points = chart.series.flatMap((series: Series) => series.values.filter((value: Value) => typeof value.value === "number"))
  if (!points.length || new Set(chart.series.flatMap((series: Series) => series.values.map((value: Value) => value.granularity))).size !== 1) return
  const dates = points.map((value: Value) => Date.parse(`${value.period.start}T00:00:00Z`))
  if (dates.some((date) => !Number.isFinite(date))) return
  const first = dates.reduce((result, date) => Math.min(result, date), Infinity)
  const last = dates.reduce((result, date) => Math.max(result, date), -Infinity)
  const numbers = points.map((value: Value) => Number(value.value))
  const minimum = numbers.reduce((result, value) => Math.min(result, value), 0)
  const maximum = numbers.reduce((result, value) => Math.max(result, value), 0)
  const span = maximum - minimum
  if (!Number.isFinite(span)) return
  const width = 600
  const height = 260
  const pixels = new Uint8Array(width * height * 3).fill(255)
  const pixel = (x: number, y: number, color: readonly number[]) => {
    const xx = Math.round(x)
    const yy = Math.round(y)
    if (xx < 0 || yy < 0 || xx >= width || yy >= height) return
    const offset = (yy * width + xx) * 3
    pixels[offset] = color[0]!
    pixels[offset + 1] = color[1]!
    pixels[offset + 2] = color[2]!
  }
  const line = (x0: number, y0: number, x1: number, y1: number, color: readonly number[]) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    // Pixel loops avoid allocating arrays proportional to the raster work.
    for (let index = 0; index <= steps; index++) {
      const x = x0 + (x1 - x0) * index / steps
      const y = y0 + (y1 - y0) * index / steps
      pixel(x, y, color)
      pixel(x, y + 1, color)
    }
  }
  const x = (date: number) => Math.round(first === last ? width / 2 : 30 + (date - first) / (last - first) * (width - 60))
  const y = (value: number) => Math.round(span === 0 ? height / 2 : 20 + (maximum - value) / span * (height - 40))
  const axis = [80, 80, 80]
  line(30, y(0), width - 30, y(0), axis)
  line(30, 20, 30, height - 20, axis)
  const colors = [[0, 103, 69], [0, 91, 173], [172, 77, 0], [117, 49, 150]]
  chart.series.forEach((series: Series, index: number) => {
    const sorted = [...series.values].sort((left, right) => left.period.start.localeCompare(right.period.start))
    sorted.forEach((value: Value, position: number) => {
      if (typeof value.value !== "number" || !Number.isFinite(value.value)) return
      const px = x(Date.parse(`${value.period.start}T00:00:00Z`))
      const py = y(value.value)
      const color = colors[index % colors.length]!
      const previous = sorted[position - 1]
      if (previous && typeof previous.value === "number" && Number.isFinite(previous.value) && Date.parse(`${value.period.start}T00:00:00Z`) - Date.parse(`${previous.period.end}T00:00:00Z`) === 86400000)
        line(x(Date.parse(`${previous.period.start}T00:00:00Z`)), y(previous.value), px, py, color)
      for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 5; dy++) pixel(px + dx - 2, py + dy - 2, color)
    })
  })
  return encodePng(pixels, width, height)
}

/** Category bars use the producer's order, units and values; no data is discarded between pages. */
export function renderReviewBars(projection: DomainProjection, chart: ReviewChart | undefined): readonly Uint8Array[] | undefined {
  type Series = Extract<ReviewChart, { status: "ok" }>["series"][number]
  type Value = DomainProjection["values"][number]
  if (!chart || chart.status !== "ok" || !["BI03", "BI04", "BI05", "BI06", "BI07"].includes(chart.viewId) || !Array.isArray(chart.series) || !chart.series.length || chart.series.length > 4 || !Array.isArray(projection.values)) return
  if (chart.series.some((series: Series) => !series || !series.unit || !Array.isArray(series.valueIds) || !Array.isArray(series.values) || !series.values.length || series.valueIds.length !== series.values.length || series.values.some((value: Value, index: number) => !value || series.valueIds[index] !== value.id || !isSfPeriod(value.period) || (value.unit && value.unit !== series.unit) || (value.currency && value.currency !== series.unit) || (value.value !== null && (typeof value.value !== "number" || !Number.isFinite(value.value))) || !projection.values.some((entry: Value) => digestSfValue(entry) === digestSfValue(value))))) return
  const ids = chart.series.flatMap((series: Series) => series.valueIds)
  if (new Set(ids).size !== ids.length) return
  if (chart.viewId !== "BI04" && new Set(chart.series.map((series: Series) => series.unit)).size !== 1) return
  if (chart.viewId === "BI04" && (!chart.series.some((series: Series) => series.role === "fte") || !chart.series.some((series: Series) => series.role === "cost") || chart.series.some((series: Series) => !series.alignmentKeys || series.alignmentKeys.length !== series.values.length || series.alignmentKeys.some((key: string) => typeof key !== "string" || !key) || new Set(series.alignmentKeys).size !== series.alignmentKeys.length || JSON.stringify(series.alignmentKeys) !== JSON.stringify(chart.series[0]?.alignmentKeys)))) return
  if (chart.viewId === "BI07") {
    if (new Set(chart.series.flatMap((series: Series) => series.values.map((value: Value) => value.granularity))).size !== 1 || chart.series.some((series: Series) => new Set(series.values.map((value: Value) => value.granularity)).size !== 1 || series.values.some((value: Value) => value.granularity !== "month" && value.granularity !== "year") || new Set(series.values.map((value: Value) => `${value.period.start}/${value.period.end}`)).size !== series.values.length)) return
  }
  if (chart.viewId !== "BI07" && new Set(chart.series.flatMap((series: Series) => series.values.map((value: Value) => `${value.period.start}/${value.period.end}`))).size !== 1) return
  const entries = chart.series.flatMap((series: Series, index: number) => series.values.map((value: Value) => ({ value, index })))
  const groups = chart.viewId === "BI04" ? chart.series.map((_series: Series, index: number) => entries.filter((entry) => entry.index === index)) : [entries]
  const scales = groups.map((group) => {
    const numbers = group.flatMap((entry) => typeof entry.value.value === "number" ? [entry.value.value] : [])
    const minimum = numbers.reduce((result, value) => Math.min(result, value), 0)
    const maximum = numbers.reduce((result, value) => Math.max(result, value), 0)
    return { minimum, maximum, span: maximum - minimum, available: numbers.length > 0 }
  })
  if (scales.some((scale) => !scale.available || !Number.isFinite(scale.span))) return
  const width = 600
  const height = 260
  const colors = [[0, 103, 69], [0, 91, 173], [172, 77, 0], [117, 49, 150]]
  return groups.flatMap((group, groupIndex) => {
    const scale = scales[groupIndex]!
    const position = (value: number) => Math.round(scale.span === 0 ? width / 2 : 30 + (value - scale.minimum) / scale.span * (width - 60))
    return Array.from({ length: Math.ceil(group.length / 8) }, (_, page) => {
      const pixels = new Uint8Array(width * height * 3).fill(255)
      const put = (x: number, y: number, color: readonly number[]) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return
        const offset = (y * width + x) * 3
        pixels[offset] = color[0]!
        pixels[offset + 1] = color[1]!
        pixels[offset + 2] = color[2]!
      }
      const zero = position(0)
      for (let y = 0; y < height - 40; y++) put(zero, y + 20, [80, 80, 80])
      group.slice(page * 8, (page + 1) * 8).forEach((entry, row) => {
        if (typeof entry.value.value !== "number") return
        const end = position(entry.value.value)
        const start = Math.min(zero, end)
        const length = Math.max(1, Math.abs(end - zero))
        const color = colors[entry.index % colors.length]!
        for (let dx = 0; dx < length; dx++) for (let dy = 0; dy < 14; dy++) put(start + dx, 28 + row * 25 + dy, color)
      })
      return encodePng(pixels, width, height)
    })
  })
}

/** Timeline inputs are the producer's resolved items; missing dates remain missing. */
export function renderReviewTimeline(projection: DomainProjection, chart: ReviewChart | undefined): readonly Uint8Array[] | undefined {
  type Item = Extract<NonNullable<Extract<ReviewChart, { status: "ok" }>["timeline"]>, { status: "ok" }>["items"][number]
  if (!chart || chart.status !== "ok" || !["BI08", "BI10"].includes(chart.viewId) || chart.timeline?.status !== "ok" || !Array.isArray(chart.timeline.items) || !chart.timeline.items.length || !projection.context || !isSfPeriod(projection.context.period) || !Array.isArray(projection.values)) return
  if (chart.timeline.items.some((item: Item) => !item || !item.source || item.dateValueId !== item.source.id || !["planned", "completed", "unknown"].includes(item.state) || !projection.values.some((value: DomainProjection["values"][number]) => digestSfValue(value) === digestSfValue(item.source)) || (item.date !== null && (item.source.evidenceState === "absent" || typeof item.source.value !== "string" || item.date !== item.source.value || !isSfPeriod({ start: item.date, end: item.date }))) || (item.state === "completed" && (item.date === null || item.source.evidenceState !== "confirmed")))) return
  const start = Date.parse(`${projection.context.period.start}T00:00:00Z`)
  const end = Date.parse(`${projection.context.period.end}T00:00:00Z`)
  const items = chart.timeline.items
  if (!items.some((item: Item) => item.date !== null && item.date >= projection.context.period.start && item.date <= projection.context.period.end)) return
  const width = 600
  const height = 260
  return Array.from({ length: Math.ceil(items.length / 8) }, (_, page) => {
    const pixels = new Uint8Array(width * height * 3).fill(255)
    const put = (x: number, y: number, color: readonly number[]) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return
      const offset = (y * width + x) * 3
      pixels[offset] = color[0]!
      pixels[offset + 1] = color[1]!
      pixels[offset + 2] = color[2]!
    }
    for (let x = 30; x < width - 30; x++) put(x, 20, [80, 80, 80])
    items.slice(page * 8, (page + 1) * 8).forEach((item: Item, row: number) => {
      if (item.date === null || item.date < projection.context.period.start || item.date > projection.context.period.end) return
      const date = Date.parse(`${item.date}T00:00:00Z`)
      const x = Math.round(start === end ? width / 2 : 30 + (date - start) / (end - start) * (width - 60))
      const y = 36 + row * 25
      const color = item.state === "completed" ? [0, 103, 69] : item.state === "planned" ? [0, 91, 173] : [80, 80, 80]
      for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
        const distance = dx * dx + dy * dy
        if (distance <= 16 && (item.state === "completed" || distance >= 9)) put(x + dx, y + dy, color)
      }
    })
    return encodePng(pixels, width, height)
  })
}

export function renderReviewWaterfall(projection: DomainProjection, chart: ReviewChart | undefined): readonly Uint8Array[] | undefined {
  if (!chart || chart.status !== "ok" || !["BI02", "BI09"].includes(chart.viewId) || !chart.waterfall || !validateReviewWaterfall(projection, chart.waterfall) || chart.waterfall.status !== "ok" || !chart.waterfall.segments.length) return
  const segments = chart.waterfall.segments
  const numbers = segments.flatMap((segment) => [segment.start, segment.end].filter((value): value is number => value !== null))
  if (!numbers.length) return
  const minimum = numbers.reduce((result, value) => Math.min(result, value), 0)
  const maximum = numbers.reduce((result, value) => Math.max(result, value), 0)
  const span = maximum - minimum
  if (!Number.isFinite(span)) return
  const width = 600
  const height = 260
  const position = (value: number) => Math.round(span === 0 ? width / 2 : 30 + (value - minimum) / span * (width - 60))
  return Array.from({ length: Math.ceil(segments.length / 8) }, (_, page) => {
    const pixels = new Uint8Array(width * height * 3).fill(255)
    const put = (x: number, y: number, color: readonly number[]) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return
      const offset = (y * width + x) * 3
      pixels[offset] = color[0]!
      pixels[offset + 1] = color[1]!
      pixels[offset + 2] = color[2]!
    }
    for (let y = 20; y < height - 20; y++) put(position(0), y, [80, 80, 80])
    segments.slice(page * 8, (page + 1) * 8).forEach((segment, row) => {
      if (segment.start === null || segment.end === null) return
      const start = position(segment.start)
      const end = position(segment.end)
      const color = segment.end >= segment.start ? [0, 103, 69] : [172, 77, 0]
      for (let dx = 0; dx < Math.max(1, Math.abs(end - start)); dx++) for (let dy = 0; dy < 14; dy++) put(Math.min(start, end) + dx, 28 + row * 25 + dy, color)
    })
    return encodePng(pixels, width, height)
  })
}

/** BI11 is a scatter of producer-evaluated points; it never interpolates a threshold. */
export function renderReviewSensitivity(chart: ReviewChart | undefined): Uint8Array | undefined {
  if (!chart || chart.status !== "ok" || chart.viewId !== "BI11" || !chart.sensitivity || typeof chart.sensitivity.parameterUnit !== "string" || !chart.sensitivity.parameterUnit.trim() || typeof chart.sensitivity.resultUnit !== "string" || !chart.sensitivity.resultUnit.trim() || !decodeSfOperationOutput("sf_sensitivity_evaluate", chart.sensitivity.result).ok) return
  const points = chart.sensitivity.result.evaluated.filter((point) => Number.isFinite(point.parameterValue) && point.value !== null && Number.isFinite(point.value))
  if (!points.length) return
  const minX = points.reduce((value, point) => Math.min(value, point.parameterValue), Infinity)
  const maxX = points.reduce((value, point) => Math.max(value, point.parameterValue), -Infinity)
  const minY = points.reduce((value, point) => Math.min(value, point.value!), Infinity)
  const maxY = points.reduce((value, point) => Math.max(value, point.value!), -Infinity)
  if (!Number.isFinite(maxX - minX) || !Number.isFinite(maxY - minY)) return
  const width = 600
  const height = 260
  const pixels = new Uint8Array(width * height * 3).fill(255)
  const put = (x: number, y: number, color: readonly number[]) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const offset = (y * width + x) * 3
    pixels[offset] = color[0]!
    pixels[offset + 1] = color[1]!
    pixels[offset + 2] = color[2]!
  }
  for (let x = 30; x < width - 30; x++) put(x, height - 20, [80, 80, 80])
  for (let y = 20; y < height - 20; y++) put(30, y, [80, 80, 80])
  points.forEach((point) => {
    const x = Math.round(30 + (maxX === minX ? 0.5 : (point.parameterValue - minX) / (maxX - minX)) * (width - 60))
    const y = Math.round(20 + (maxY === minY ? 0.5 : (maxY - point.value!) / (maxY - minY)) * (height - 40))
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if (dx * dx + dy * dy <= 9) put(x + dx, y + dy, [0, 91, 173])
  })
  return encodePng(pixels, width, height)
}

function encodePng(pixels: Uint8Array, width: number, height: number) {
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let row = 0; row < height; row++) rows.set(pixels.subarray(row * width * 3, (row + 1) * width * 3), row * (width * 3 + 1) + 1)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(rows)), pngChunk("IEND", Buffer.alloc(0))])
}

function pngChunk(type: string, data: Uint8Array) {
  const name = Buffer.from(type, "ascii")
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([name, data])
  const checksum = Buffer.alloc(4)
  let crc = 0xffffffff
  body.forEach((byte) => {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  })
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, body, checksum])
}
