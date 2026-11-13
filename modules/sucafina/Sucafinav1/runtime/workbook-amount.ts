export * as WorkbookAmount from "./workbook-amount"

export function parse(value: unknown, empty: number | null): number | null | undefined {
  if (value === null || value === undefined) return empty
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined
    const rounded = Math.round(value * 100) / 100
    return Number.isFinite(rounded) ? rounded : undefined
  }
  if (typeof value !== "string") return undefined

  const source = value.trim().replace(/[,\s'’]/g, "")
  if (source === "") return empty

  const multiplier = /k$/i.test(source) ? 1e3 : /m$/i.test(source) ? 1e6 : 1
  const withoutSuffix = multiplier === 1 ? source : source.slice(0, -1)
  const token = /^\(.*\)$/.test(withoutSuffix) ? `-${withoutSuffix.slice(1, -1)}` : withoutSuffix

  const number = Number(token)
  if (!Number.isFinite(number)) return undefined
  const rounded = Math.round(number * multiplier * 100) / 100
  return Number.isFinite(rounded) ? rounded : undefined
}
