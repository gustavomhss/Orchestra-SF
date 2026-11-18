export * as WorkbookDate from "./workbook-date"

export function parse(value: unknown): string | undefined {
  if (value == null) return ""
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return undefined
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined
    const date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86400000)
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined
  }
  if (typeof value !== "string") return undefined

  const token = value.trim()
  if (!token) return ""
  const iso = token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return calendarISO(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const dayFirst = token.match(/^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/)
  if (dayFirst) return calendarISO(Number(dayFirst[4]), Number(dayFirst[3]), Number(dayFirst[1]))
  return undefined
}

function calendarISO(year: number, month: number, day: number): string | undefined {
  const token = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const date = new Date(`${token}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== token) return undefined
  return token
}
